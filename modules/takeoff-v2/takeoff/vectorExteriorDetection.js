import { buildWallGraphFromPolylines } from "./wallGraph.js";
import { assessExteriorDetectionGraph } from "./wallDetectionQuality.js";
import { distance, isSimplePolygon, polygonAreaDocUnits2, polygonPerimeter } from "./geometry.js";
import { pointInRegion, polylineWithinRegion } from "./planRegion.js";
import { createWallSegment, createWallVertex, generateId } from "../types.js";
import { boundarySupportRatio, detectBuildingRegion, segmentInBuildingRegion } from "./buildingRegionDetection.js";

const MIN_LINE_LENGTH = 8;
const MERGE_TOLERANCE = 1.8;
const MERGE_GAP = 14;
const INTERSECTION_TOLERANCE = 2.5;
const MIN_OVERLAP = 10;
const DEFAULT_MIN_FACE_OFFSET = 1.2;
const DEFAULT_MAX_FACE_OFFSET = 12;
const ENVELOPE_CELL_SIZE = 6;
const WALL_SUPPORT_EDGE_THRESHOLD = 0.7;

const REJECTION = {
  OUTSIDE_BUILDING_REGION: "OUTSIDE_BUILDING_REGION",
  NO_VALID_PARALLEL_PAIR: "NO_VALID_PARALLEL_PAIR",
  THICKNESS_OUT_OF_RANGE: "THICKNESS_OUT_OF_RANGE",
  INSUFFICIENT_OVERLAP: "INSUFFICIENT_OVERLAP",
  COMPONENT_NOT_SELECTED: "COMPONENT_NOT_SELECTED",
  INTERIOR_CLASSIFICATION: "INTERIOR_CLASSIFICATION",
  INSUFFICIENT_BOUNDARY_SUPPORT: "INSUFFICIENT_BOUNDARY_SUPPORT",
  SIMPLIFIED_AWAY: "SIMPLIFIED_AWAY",
  DISCONNECTED: "DISCONNECTED",
  ANNOTATION_REGION: "ANNOTATION_REGION",
  DIMENSION_REGION: "DIMENSION_REGION",
  TITLE_BLOCK_REGION: "TITLE_BLOCK_REGION",
  PAGE_BORDER: "PAGE_BORDER",
  OTHER: "OTHER",
};

function lineBounds(line) {
  return {
    minX: Math.min(line.a.x, line.b.x),
    maxX: Math.max(line.a.x, line.b.x),
    minY: Math.min(line.a.y, line.b.y),
    maxY: Math.max(line.a.y, line.b.y),
  };
}

function overlaps(a1, a2, b1, b2) {
  return Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));
}

function isNearPageBorder(line, pageWidth, pageHeight) {
  if (!(pageWidth > 0) || !(pageHeight > 0)) return false;
  const b = lineBounds(line);
  const marginX = pageWidth * 0.035;
  const marginY = pageHeight * 0.035;
  return (
    b.maxX - b.minX > pageWidth * 0.85 && (b.minY <= marginY || b.maxY >= pageHeight - marginY) ||
    b.maxY - b.minY > pageHeight * 0.85 && (b.minX <= marginX || b.maxX >= pageWidth - marginX)
  );
}

function colorLooksBlack(color) {
  if (!color) return true;
  if (String(color).toLowerCase() === "#000000") return true;
  if (String(color).toLowerCase() === "#c7c7c7") return false;
  const parts = String(color).split(",").map((v) => Number(v));
  if (parts.length >= 3 && parts.every(Number.isFinite)) return parts.slice(0, 3).every((v) => v <= 80 || v <= 0.35);
  return true;
}

function isDashed(line) {
  const dash = line.dashPattern;
  if (!dash) return false;
  const pattern = Array.isArray(dash?.[0]) ? dash[0] : dash;
  return Array.isArray(pattern) && pattern.some((value) => Number(value) > 0);
}

function classifyRawLine(line, region, pageWidth, pageHeight) {
  if (!line?.a || !line?.b) return "malformed";
  if (line.source === "vector" && line.stroked === false) return "filled-path";
  if (line.axis !== "horizontal" && line.axis !== "vertical") return "diagonal";
  if (line.length < MIN_LINE_LENGTH) return "too-short";
  if (!colorLooksBlack(line.strokeColor)) return "non-black";
  if (isDashed(line)) return "dashed";
  const tag = String(line?.geometryType || line?.objectType || line?.role || line?.type || line?.classification || "").toLowerCase();
  if (/stair|tread|cabinet|cabinetry|furniture|door-arc|door|symbol|hatch|appliance/.test(tag)) return `rejected tag ${tag}`;
  if (line.pathSegmentCount > 90 && line.length < 35) return "text-symbol";
  if (isNearPageBorder(line, pageWidth, pageHeight)) return "page-border";
  if (!polylineWithinRegion([line.a, line.b], region)) return "outside-region";
  return "accepted";
}

function toAxisLine(segment) {
  const horizontal = segment.axis === "horizontal";
  const b = lineBounds(segment);
  return {
    ...segment,
    orientation: horizontal ? "horizontal" : "vertical",
    fixed: horizontal ? (segment.a.y + segment.b.y) / 2 : (segment.a.x + segment.b.x) / 2,
    start: horizontal ? b.minX : b.minY,
    end: horizontal ? b.maxX : b.maxY,
  };
}

function fromAxisLine(line) {
  if (line.orientation === "horizontal") {
    return { ...line, a: { x: line.start, y: line.fixed }, b: { x: line.end, y: line.fixed }, length: line.end - line.start };
  }
  return { ...line, a: { x: line.fixed, y: line.start }, b: { x: line.fixed, y: line.end }, length: line.end - line.start };
}

function mergeCollinear(lines) {
  const groups = new Map();
  lines.map(toAxisLine).forEach((line) => {
    const key = `${line.orientation}:${Math.round(line.fixed / MERGE_TOLERANCE)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(line);
  });

  const merged = [];
  let seq = 0;
  groups.forEach((group) => {
    group.sort((a, b) => a.start - b.start || b.end - a.end);
    let current = null;
    group.forEach((line) => {
      if (!current) {
        current = { ...line, sourceIds: [line.id], supportCount: 1 };
        return;
      }
      if (line.start <= current.end + MERGE_GAP) {
        current.end = Math.max(current.end, line.end);
        current.fixed = (current.fixed * current.supportCount + line.fixed) / (current.supportCount + 1);
        current.sourceIds.push(line.id);
        current.supportCount += 1;
      } else {
        seq += 1;
        merged.push(fromAxisLine({ ...current, id: `merged-${seq}` }));
        current = { ...line, sourceIds: [line.id], supportCount: 1 };
      }
    });
    if (current) {
      seq += 1;
      merged.push(fromAxisLine({ ...current, id: `merged-${seq}` }));
    }
  });

  return merged.filter((line) => line.length >= MIN_LINE_LENGTH);
}

function faceOffsetRange(mmPerDocumentUnit) {
  if (!(mmPerDocumentUnit > 0)) return { min: DEFAULT_MIN_FACE_OFFSET, max: DEFAULT_MAX_FACE_OFFSET };
  return {
    min: Math.max(DEFAULT_MIN_FACE_OFFSET, 70 / mmPerDocumentUnit),
    max: Math.min(18, Math.max(DEFAULT_MAX_FACE_OFFSET, 350 / mmPerDocumentUnit)),
  };
}

function pairWallFaces(lines, mmPerDocumentUnit) {
  const range = faceOffsetRange(mmPerDocumentUnit);
  const pairedIds = new Set();
  const pairs = [];
  const byOrientation = {
    horizontal: lines.filter((line) => line.orientation === "horizontal"),
    vertical: lines.filter((line) => line.orientation === "vertical"),
  };

  Object.values(byOrientation).forEach((group) => {
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const a = group[i];
        const b = group[j];
        const offset = Math.abs(a.fixed - b.fixed);
        if (offset < range.min || offset > range.max) continue;
        const overlap = overlaps(a.start, a.end, b.start, b.end);
        const shorter = Math.min(a.length, b.length);
        if (overlap < MIN_OVERLAP || overlap / Math.max(shorter, 1) < 0.35) continue;
        pairedIds.add(a.id);
        pairedIds.add(b.id);
        pairs.push({ aId: a.id, bId: b.id, orientation: a.orientation, offset, overlap });
      }
    }
  });

  return { pairedIds, pairs };
}

function auditUnpairedLines(lines, pairs, mmPerDocumentUnit) {
  const range = faceOffsetRange(mmPerDocumentUnit);
  const pairedIds = new Set(pairs.flatMap((pair) => [pair.aId, pair.bId]));
  const audits = [];
  lines.forEach((line) => {
    if (pairedIds.has(line.id)) return;
    const parallels = lines.filter((other) => other.id !== line.id && other.orientation === line.orientation);
    const hasThicknessCandidate = parallels.some((other) => {
      const offset = Math.abs(line.fixed - other.fixed);
      return offset >= range.min && offset <= range.max;
    });
    const hasOverlapCandidate = parallels.some((other) => {
      const offset = Math.abs(line.fixed - other.fixed);
      if (offset < range.min || offset > range.max) return false;
      const overlap = overlaps(line.start, line.end, other.start, other.end);
      return overlap >= MIN_OVERLAP;
    });
    audits.push({
      lineId: line.id,
      sourceLineIds: line.sourceIds || [line.id],
      orientation: line.orientation,
      fixed: line.fixed,
      start: line.start,
      end: line.end,
      length: line.length,
      accepted: false,
      rejectionCode: !hasThicknessCandidate ? REJECTION.THICKNESS_OUT_OF_RANGE : !hasOverlapCandidate ? REJECTION.INSUFFICIENT_OVERLAP : REJECTION.NO_VALID_PARALLEL_PAIR,
    });
  });
  return audits;
}

function linePoint(line, along, fixed = line.fixed) {
  if (line.orientation === "horizontal") return { x: along, y: fixed };
  return { x: fixed, y: along };
}

function createWallBands(lines, pairs) {
  const byId = new Map(lines.map((line) => [line.id, line]));
  return pairs.map((pair, index) => {
    const a = byId.get(pair.aId);
    const b = byId.get(pair.bId);
    if (!a || !b) return null;
    const start = Math.max(a.start, b.start);
    const end = Math.min(a.end, b.end);
    if (end - start < MIN_OVERLAP) return null;
    const centerFixed = (a.fixed + b.fixed) / 2;
    const faceA = { start: linePoint(a, start, a.fixed), end: linePoint(a, end, a.fixed) };
    const faceB = { start: linePoint(a, start, b.fixed), end: linePoint(a, end, b.fixed) };
    const centerline = { start: linePoint(a, start, centerFixed), end: linePoint(a, end, centerFixed) };
    return {
      id: `band-${index + 1}`,
      centerline,
      centreline: centerline,
      faceA,
      faceB,
      thickness: Math.abs(a.fixed - b.fixed),
      confidence: Math.min(0.96, 0.62 + Math.min(0.16, pair.overlap / 400) + Math.min(0.12, pair.overlap / Math.max(Math.min(a.length, b.length), 1))),
      orientation: pair.orientation,
      sourceLineIds: [a.id, b.id],
      start,
      end,
      fixed: centerFixed,
      length: end - start,
    };
  }).filter(Boolean);
}

function wallBandComponentIds(wallBands = []) {
  const componentIds = new Map();
  let componentId = 0;
  wallBands.forEach((band) => {
    if (componentIds.has(band.id)) return;
    componentId += 1;
    const stack = [band];
    componentIds.set(band.id, componentId);
    while (stack.length) {
      const current = stack.pop();
      wallBands.forEach((other) => {
        if (componentIds.has(other.id)) return;
        const currentLine = {
          orientation: current.orientation,
          fixed: current.fixed,
          start: current.start,
          end: current.end,
        };
        const otherLine = {
          orientation: other.orientation,
          fixed: other.fixed,
          start: other.start,
          end: other.end,
        };
        if (!lineIntersectsLine(currentLine, otherLine)) return;
        componentIds.set(other.id, componentId);
        stack.push(other);
      });
    }
  });
  return componentIds;
}

function exteriorScoreForBand(band, boundaryBandIds, supportBandIds) {
  let score = band.confidence || 0;
  if (boundaryBandIds.has(band.id)) score += 0.25;
  if (supportBandIds.has(band.id)) score += 0.1;
  return Math.round(Math.min(1, score) * 1000) / 1000;
}

function auditWallBands({ wallBands = [], detectedRegion = null, boundaryBandIds = new Set(), supportBandIds = new Set(), acceptedBandIds = new Set() } = {}) {
  const componentIds = wallBandComponentIds(wallBands);
  return wallBands.map((band) => {
    const inBuildingRegion = segmentInBuildingRegion({ a: band.centerline.start, b: band.centerline.end }, detectedRegion, { tolerance: 10 });
    let rejectionCode = null;
    if (!inBuildingRegion) rejectionCode = REJECTION.OUTSIDE_BUILDING_REGION;
    else if (!supportBandIds.has(band.id)) rejectionCode = REJECTION.COMPONENT_NOT_SELECTED;
    else if (!boundaryBandIds.has(band.id)) rejectionCode = REJECTION.INTERIOR_CLASSIFICATION;
    else if (!acceptedBandIds.has(band.id)) rejectionCode = REJECTION.INSUFFICIENT_BOUNDARY_SUPPORT;
    return {
      id: band.id,
      faceALineIds: band.sourceLineIds?.slice(0, 1) || [],
      faceBLineIds: band.sourceLineIds?.slice(1, 2) || [],
      sourceLineIds: band.sourceLineIds || [],
      centreline: band.centreline || band.centerline,
      orientation: band.orientation,
      thickness: band.thickness,
      length: band.length,
      componentId: componentIds.get(band.id) || null,
      inBuildingRegion,
      exteriorCandidateScore: exteriorScoreForBand(band, boundaryBandIds, supportBandIds),
      accepted: !rejectionCode,
      rejectionCode,
    };
  });
}

function edgeSupportRatio(a, b, wallBands = [], tolerance = 8) {
  const length = distance(a, b);
  if (!(length > 0)) return 0;
  const supportIntervals = [];
  const edgeHorizontal = Math.abs(a.y - b.y) < 1e-6;
  const edgeVertical = Math.abs(a.x - b.x) < 1e-6;
  if (!edgeHorizontal && !edgeVertical) return 0;
  const edgeStart = edgeHorizontal ? Math.min(a.x, b.x) : Math.min(a.y, b.y);
  const edgeEnd = edgeHorizontal ? Math.max(a.x, b.x) : Math.max(a.y, b.y);
  wallBands.forEach((band) => {
    if (edgeHorizontal && band.orientation !== "horizontal") return;
    if (edgeVertical && band.orientation !== "vertical") return;
    const fixedDistance = edgeHorizontal ? Math.abs(band.fixed - a.y) : Math.abs(band.fixed - a.x);
    if (fixedDistance > tolerance) return;
    const start = Math.max(edgeStart, band.start);
    const end = Math.min(edgeEnd, band.end);
    if (end - start <= 0) return;
    supportIntervals.push({ start, end });
  });
  supportIntervals.sort((left, right) => left.start - right.start || left.end - right.end);
  let supported = 0;
  let current = null;
  supportIntervals.forEach((interval) => {
    if (!current) {
      current = { ...interval };
      return;
    }
    if (interval.start <= current.end + tolerance) {
      current.end = Math.max(current.end, interval.end);
      return;
    }
    supported += current.end - current.start;
    current = { ...interval };
  });
  if (current) supported += current.end - current.start;
  return Math.max(0, Math.min(1, supported / length));
}

function boundaryEdgeSupport(points = [], wallBands = [], tolerance = 8) {
  if (!Array.isArray(points) || points.length < 2) return [];
  return points.map((point, index) => {
    const next = points[(index + 1) % points.length];
    const ratio = edgeSupportRatio(point, next, wallBands, tolerance);
    const orthogonal = Math.abs(point.x - next.x) < 1e-6 || Math.abs(point.y - next.y) < 1e-6;
    return { index, a: point, b: next, length: distance(point, next), wallSupportRatio: ratio, orthogonal };
  });
}

function edgeIsSupported(edgeSupport = [], index = 0, tolerance = 8) {
  const edge = edgeSupport[index];
  if (!edge?.orthogonal) return false;
  if (edge.wallSupportRatio >= WALL_SUPPORT_EDGE_THRESHOLD) return true;
  const shortCornerCap = edge.length <= tolerance * 1.25;
  if (!shortCornerCap) return false;
  const findSupportedWallEdge = (direction) => {
    for (let step = 1; step < edgeSupport.length; step += 1) {
      const candidate = edgeSupport[(index + direction * step + edgeSupport.length) % edgeSupport.length];
      if (!candidate?.orthogonal) return false;
      if (candidate.wallSupportRatio >= WALL_SUPPORT_EDGE_THRESHOLD) return true;
      if (candidate.length > tolerance * 1.25) return false;
    }
    return false;
  };
  return findSupportedWallEdge(-1) && findSupportedWallEdge(1);
}

function lineIntersectsLine(a, b) {
  if (a.orientation === b.orientation) {
    return Math.abs(a.fixed - b.fixed) <= INTERSECTION_TOLERANCE && overlaps(a.start, a.end, b.start, b.end) >= -MERGE_GAP;
  }
  const horizontal = a.orientation === "horizontal" ? a : b;
  const vertical = a.orientation === "vertical" ? a : b;
  return (
    vertical.fixed >= horizontal.start - INTERSECTION_TOLERANCE &&
    vertical.fixed <= horizontal.end + INTERSECTION_TOLERANCE &&
    horizontal.fixed >= vertical.start - INTERSECTION_TOLERANCE &&
    horizontal.fixed <= vertical.end + INTERSECTION_TOLERANCE
  );
}

function drawingComponents(lines) {
  const seen = new Set();
  const components = [];
  for (const line of lines) {
    if (seen.has(line.id)) continue;
    const stack = [line];
    const group = [];
    seen.add(line.id);
    while (stack.length) {
      const current = stack.pop();
      group.push(current);
      lines.forEach((other) => {
        if (seen.has(other.id)) return;
        if (!lineIntersectsLine(current, other)) return;
        seen.add(other.id);
        stack.push(other);
      });
    }
    const bounds = group.reduce(
      (acc, item) => {
        const b = lineBounds(item);
        return {
          minX: Math.min(acc.minX, b.minX),
          minY: Math.min(acc.minY, b.minY),
          maxX: Math.max(acc.maxX, b.maxX),
          maxY: Math.max(acc.maxY, b.maxY),
        };
      },
      { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
    );
    components.push({
      lines: group,
      bounds,
      width: bounds.maxX - bounds.minX,
      height: bounds.maxY - bounds.minY,
    });
  }
  return components;
}

function chooseMainDrawingRegion(lines, pageWidth, pageHeight) {
  if (!(pageWidth > 0) || !(pageHeight > 0) || lines.length < 8) return null;
  const components = drawingComponents(lines)
    .filter((component) => component.lines.length >= 6)
    .map((component) => {
      const area = component.width * component.height;
      const touchesBottomTitleBlock = component.bounds.minY < pageHeight * 0.12 && component.height < pageHeight * 0.24;
      const touchesLeftNotes = component.bounds.minX < pageWidth * 0.16 && component.width < pageWidth * 0.35;
      const fullSheet = component.width > pageWidth * 0.82 && component.height > pageHeight * 0.82;
      const usefulShape = component.width > pageWidth * 0.18 && component.height > pageHeight * 0.22;
      const penalty = (touchesBottomTitleBlock ? 0.08 : 1) * (touchesLeftNotes ? 0.35 : 1) * (fullSheet ? 0.05 : 1) * (usefulShape ? 1 : 0.2);
      return { ...component, score: component.lines.length * Math.sqrt(Math.max(area, 1)) * penalty };
    })
    .sort((a, b) => b.score - a.score);
  const best = components[0];
  if (!best) return null;
  const pad = 12;
  return {
    region: {
      x: Math.max(0, best.bounds.minX - pad),
      y: Math.max(0, best.bounds.minY - pad),
      width: Math.min(pageWidth, best.bounds.maxX + pad) - Math.max(0, best.bounds.minX - pad),
      height: Math.min(pageHeight, best.bounds.maxY + pad) - Math.max(0, best.bounds.minY - pad),
      source: "automatic",
      confirmed: false,
    },
    components: components.slice(0, 8).map((component) => ({
      lineCount: component.lines.length,
      x: component.bounds.minX,
      y: component.bounds.minY,
      width: component.width,
      height: component.height,
      score: Math.round(component.score),
    })),
  };
}

function rectFromPolygonBounds(points = []) {
  if (!points.length) return null;
  const bounds = points.reduce(
    (acc, point) => ({
      minX: Math.min(acc.minX, point.x),
      minY: Math.min(acc.minY, point.y),
      maxX: Math.max(acc.maxX, point.x),
      maxY: Math.max(acc.maxY, point.y),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );
  return { x: bounds.minX, y: bounds.minY, width: bounds.maxX - bounds.minX, height: bounds.maxY - bounds.minY };
}

function rectGap(a, b) {
  if (!a || !b) return Infinity;
  const gapX = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.width, b.x + b.width));
  const gapY = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.height, b.y + b.height));
  return Math.hypot(gapX, gapY);
}

function unionRects(rects, pageWidth, pageHeight, pad = 8) {
  const valid = rects.filter(Boolean);
  if (!valid.length) return null;
  const minX = Math.max(0, Math.min(...valid.map((rect) => rect.x)) - pad);
  const minY = Math.max(0, Math.min(...valid.map((rect) => rect.y)) - pad);
  const maxX = pageWidth > 0 ? Math.min(pageWidth, Math.max(...valid.map((rect) => rect.x + rect.width)) + pad) : Math.max(...valid.map((rect) => rect.x + rect.width)) + pad;
  const maxY = pageHeight > 0 ? Math.min(pageHeight, Math.max(...valid.map((rect) => rect.y + rect.height)) + pad) : Math.max(...valid.map((rect) => rect.y + rect.height)) + pad;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY, source: "automatic", confirmed: false };
}

function polygonFromRegionRect(rect) {
  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ];
}

function growRegionFromNearbyComponents(region, pageWidth, pageHeight) {
  if (!region?.rect || !Array.isArray(region.excludedRegions)) return region;
  const pageArea = Math.max(pageWidth * pageHeight, 1);
  const regionArea = region.rect.width * region.rect.height;
  const nearbyRects = region.excludedRegions
    .map((polygon) => rectFromPolygonBounds(polygon))
    .filter((rect) => {
      if (!rect) return false;
      const area = rect.width * rect.height;
      const titleBand = pageHeight > 0 && rect.y < pageHeight * 0.16 && rect.height < pageHeight * 0.18;
      const notesColumn = pageWidth > 0 && rect.x < pageWidth * 0.18 && rect.width < pageWidth * 0.25;
      const tinyDetail = area < pageArea * 0.0012;
      return !titleBand && !notesColumn && !tinyDetail && rectGap(region.rect, rect) <= Math.max(80, Math.min(region.rect.width, region.rect.height) * 0.45);
    });
  const grown = unionRects([region.rect, ...nearbyRects], pageWidth, pageHeight, 10);
  if (!grown || grown.width * grown.height <= regionArea * 1.25) return region;
  return {
    ...region,
    rect: grown,
    polygon: polygonFromRegionRect(grown),
    confidence: Math.min(0.96, Math.max(region.confidence || 0, 0.72)),
    excludedRegions: region.excludedRegions,
  };
}

function inferPlanRegion(lines, pageWidth, pageHeight) {
  const candidates = lines.filter((line) => (
    line.length >= 14 &&
    !isNearPageBorder(line, pageWidth, pageHeight) &&
    pointInRegion(line.a, { x: pageWidth * 0.08, y: pageHeight * 0.04, width: pageWidth * 0.84, height: pageHeight * 0.92 }) &&
    pointInRegion(line.b, { x: pageWidth * 0.08, y: pageHeight * 0.04, width: pageWidth * 0.84, height: pageHeight * 0.92 })
  ));
  if (candidates.length < 8) return null;
  const bounds = candidates.reduce(
    (acc, line) => {
      const b = lineBounds(line);
      return {
        minX: Math.min(acc.minX, b.minX),
        minY: Math.min(acc.minY, b.minY),
        maxX: Math.max(acc.maxX, b.maxX),
        maxY: Math.max(acc.maxY, b.maxY),
      };
    },
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );
  const pad = 8;
  return {
    x: Math.max(0, bounds.minX - pad),
    y: Math.max(0, bounds.minY - pad),
    width: Math.min(pageWidth, bounds.maxX + pad) - Math.max(0, bounds.minX - pad),
    height: Math.min(pageHeight, bounds.maxY + pad) - Math.max(0, bounds.minY - pad),
    source: "automatic",
    confirmed: false,
  };
}

function hasNeighborOnSide(line, allLines, side) {
  return allLines.some((other) => {
    if (other.id === line.id || other.orientation !== line.orientation) return false;
    const overlap = overlaps(line.start, line.end, other.start, other.end);
    if (overlap < Math.min(line.length * 0.25, 18)) return false;
    if (side < 0) return other.fixed < line.fixed - INTERSECTION_TOLERANCE;
    return other.fixed > line.fixed + INTERSECTION_TOLERANCE;
  });
}

function selectBoundaryLines(lines) {
  return lines.filter((line) => {
    const hasBefore = hasNeighborOnSide(line, lines, -1);
    const hasAfter = hasNeighborOnSide(line, lines, 1);
    return !(hasBefore && hasAfter);
  });
}

function splitAtIntersections(lines) {
  const h = lines.filter((line) => line.orientation === "horizontal");
  const v = lines.filter((line) => line.orientation === "vertical");
  const pointsById = new Map(lines.map((line) => [line.id, new Set([line.start, line.end])]));

  h.forEach((horizontal) => {
    v.forEach((vertical) => {
      if (
        vertical.fixed >= horizontal.start - INTERSECTION_TOLERANCE &&
        vertical.fixed <= horizontal.end + INTERSECTION_TOLERANCE &&
        horizontal.fixed >= vertical.start - INTERSECTION_TOLERANCE &&
        horizontal.fixed <= vertical.end + INTERSECTION_TOLERANCE
      ) {
        pointsById.get(horizontal.id).add(vertical.fixed);
        pointsById.get(vertical.id).add(horizontal.fixed);
      }
    });
  });

  const polylines = [];
  lines.forEach((line) => {
    const values = Array.from(pointsById.get(line.id) || []).sort((a, b) => a - b);
    for (let i = 0; i < values.length - 1; i += 1) {
      const start = values[i];
      const end = values[i + 1];
      if (end - start < 3) continue;
      const a = line.orientation === "horizontal" ? { x: start, y: line.fixed } : { x: line.fixed, y: start };
      const b = line.orientation === "horizontal" ? { x: end, y: line.fixed } : { x: line.fixed, y: end };
      polylines.push({ points: [a, b], confidence: line.paired ? "high" : "medium" });
    }
  });
  return polylines;
}

function graphFromLines(lines, stitchToleranceDocUnits) {
  const polylines = splitAtIntersections(lines);
  const graph = buildWallGraphFromPolylines(polylines, { tolerance: stitchToleranceDocUnits, source: "automatic" });
  const quality = assessExteriorDetectionGraph(graph.vertices, graph.segments, 0.78);
  return { graph, quality };
}

function polygonSignedArea(points = []) {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    area += current.x * next.y - next.x * current.y;
  }
  return area / 2;
}

function polygonSelfIntersectionCount(points = []) {
  return isSimplePolygon(points) ? 0 : 1;
}

function validateExteriorFootprint(points, region) {
  if (!Array.isArray(points) || points.length < 4) {
    return { valid: false, reason: "No ordered exterior polygon was produced.", gapCount: 1, selfIntersectionCount: 0 };
  }
  const selfIntersectionCount = polygonSelfIntersectionCount(points);
  const areaDocumentUnits = polygonAreaDocUnits2(points);
  const perimeterDocumentUnits = polygonPerimeter(points);
  const minArea = region ? region.width * region.height * 0.02 : 1000;
  if (selfIntersectionCount > 0) return { valid: false, reason: "Exterior polygon self-intersects.", gapCount: 0, selfIntersectionCount };
  if (!(areaDocumentUnits >= minArea)) return { valid: false, reason: "Exterior polygon area is too small.", gapCount: 0, selfIntersectionCount };
  const validationRegion = region ? {
    x: Math.max(0, region.x - ENVELOPE_CELL_SIZE * 2),
    y: Math.max(0, region.y - ENVELOPE_CELL_SIZE * 2),
    width: region.width + ENVELOPE_CELL_SIZE * 4,
    height: region.height + ENVELOPE_CELL_SIZE * 4,
  } : null;
  if (validationRegion && !points.every((point) => pointInRegion(point, validationRegion))) {
    return { valid: false, reason: "Exterior polygon crosses an excluded page zone.", gapCount: 0, selfIntersectionCount };
  }
  return { valid: true, gapCount: 0, selfIntersectionCount, areaDocumentUnits, perimeterDocumentUnits };
}

function simplifyOrthogonalLoop(points) {
  if (!Array.isArray(points) || points.length < 4) return points || [];
  const simplified = [];
  points.forEach((point) => {
    const prev = simplified[simplified.length - 1];
    if (prev && Math.abs(prev.x - point.x) < 1e-6 && Math.abs(prev.y - point.y) < 1e-6) return;
    simplified.push(point);
    while (simplified.length >= 3) {
      const a = simplified[simplified.length - 3];
      const b = simplified[simplified.length - 2];
      const c = simplified[simplified.length - 1];
      const sameX = Math.abs(a.x - b.x) < 1e-6 && Math.abs(b.x - c.x) < 1e-6;
      const sameY = Math.abs(a.y - b.y) < 1e-6 && Math.abs(b.y - c.y) < 1e-6;
      if (!sameX && !sameY) break;
      simplified.splice(simplified.length - 2, 1);
    }
  });
  if (simplified.length > 2) {
    const first = simplified[0];
    const last = simplified[simplified.length - 1];
    if (Math.abs(first.x - last.x) < 1e-6 && Math.abs(first.y - last.y) < 1e-6) simplified.pop();
  }
  return simplified;
}

function traceBoundaryLoops(boundaryEdges) {
  const key = (p) => `${p.x}:${p.y}`;
  const edgeKey = (a, b) => `${key(a)}>${key(b)}`;
  const starts = new Map();
  boundaryEdges.forEach((edge) => {
    const k = key(edge.a);
    if (!starts.has(k)) starts.set(k, []);
    starts.get(k).push(edge);
  });

  const used = new Set();
  const loops = [];
  boundaryEdges.forEach((edge) => {
    const firstKey = edgeKey(edge.a, edge.b);
    if (used.has(firstKey)) return;
    const loop = [edge.a];
    let current = edge;
    used.add(firstKey);
    for (let guard = 0; guard < boundaryEdges.length + 5; guard += 1) {
      loop.push(current.b);
      if (current.b.x === loop[0].x && current.b.y === loop[0].y) break;
      const candidates = starts.get(key(current.b)) || [];
      const next = candidates.find((candidate) => !used.has(edgeKey(candidate.a, candidate.b)));
      if (!next) break;
      current = next;
      used.add(edgeKey(current.a, current.b));
    }
    if (loop.length >= 5 && loop[0].x === loop[loop.length - 1].x && loop[0].y === loop[loop.length - 1].y) {
      loop.pop();
      loops.push(simplifyOrthogonalLoop(loop));
    }
  });
  return loops;
}

function buildEnvelopePolygon(lines, region, diagnostics) {
  if (!region || lines.length < 6) return null;
  const cell = ENVELOPE_CELL_SIZE;
  const pad = 8;
  const originX = Math.max(0, region.x - pad);
  const originY = Math.max(0, region.y - pad);
  const cols = Math.ceil((region.width + pad * 2) / cell) + 2;
  const rows = Math.ceil((region.height + pad * 2) / cell) + 2;
  if (cols <= 4 || rows <= 4 || cols * rows > 120000) return null;

  const occupied = new Uint8Array(cols * rows);
  const mark = (x, y) => {
    if (x < 0 || y < 0 || x >= cols || y >= rows) return;
    occupied[y * cols + x] = 1;
  };
  const toCol = (x) => Math.round((x - originX) / cell);
  const toRow = (y) => Math.round((y - originY) / cell);
  const radius = 2;
  lines.forEach((line) => {
    const a = line.orientation === "horizontal" ? toCol(line.start) : toRow(line.start);
    const b = line.orientation === "horizontal" ? toCol(line.end) : toRow(line.end);
    const fixed = line.orientation === "horizontal" ? toRow(line.fixed) : toCol(line.fixed);
    for (let t = Math.min(a, b); t <= Math.max(a, b); t += 1) {
      for (let d = -radius; d <= radius; d += 1) {
        if (line.orientation === "horizontal") mark(t, fixed + d);
        else mark(fixed + d, t);
      }
    }
  });

  const outside = new Uint8Array(cols * rows);
  const queue = [];
  const pushOutside = (x, y) => {
    if (x < 0 || y < 0 || x >= cols || y >= rows) return;
    const idx = y * cols + x;
    if (outside[idx] || occupied[idx]) return;
    outside[idx] = 1;
    queue.push([x, y]);
  };
  for (let x = 0; x < cols; x += 1) {
    pushOutside(x, 0);
    pushOutside(x, rows - 1);
  }
  for (let y = 0; y < rows; y += 1) {
    pushOutside(0, y);
    pushOutside(cols - 1, y);
  }
  for (let i = 0; i < queue.length; i += 1) {
    const [x, y] = queue[i];
    pushOutside(x + 1, y);
    pushOutside(x - 1, y);
    pushOutside(x, y + 1);
    pushOutside(x, y - 1);
  }

  const docPoint = (x, y) => ({ x: originX + x * cell, y: originY + y * cell });
  const edges = [];
  const isOutside = (x, y) => x < 0 || y < 0 || x >= cols || y >= rows || Boolean(outside[y * cols + x]);
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      if (!occupied[y * cols + x]) continue;
      if (isOutside(x, y - 1)) edges.push({ a: docPoint(x, y), b: docPoint(x + 1, y) });
      if (isOutside(x + 1, y)) edges.push({ a: docPoint(x + 1, y), b: docPoint(x + 1, y + 1) });
      if (isOutside(x, y + 1)) edges.push({ a: docPoint(x + 1, y + 1), b: docPoint(x, y + 1) });
      if (isOutside(x - 1, y)) edges.push({ a: docPoint(x, y + 1), b: docPoint(x, y) });
    }
  }

  const loops = traceBoundaryLoops(edges)
    .filter((loop) => loop.length >= 4)
    .map((loop) => ({ points: loop, area: Math.abs(polygonSignedArea(loop)) }))
    .sort((a, b) => b.area - a.area);
  diagnostics.envelopeLoops = loops.length;
  diagnostics.envelopeBoundaryEdges = edges.length;
  const best = loops[0];
  if (!best || best.area < region.width * region.height * 0.03) return null;
  return best.points;
}

function graphFromPolygon(points, stitchToleranceDocUnits) {
  const simplified = simplifyOrthogonalLoop(points);
  if (simplified.length < 4) return null;
  const vertices = simplified.map((point) => createWallVertex({ id: generateId("wv"), x: point.x, y: point.y }));
  const segments = vertices.map((vertex, index) => createWallSegment({
    id: generateId("ws"),
    aId: vertex.id,
    bId: vertices[(index + 1) % vertices.length].id,
    wallType: "exterior",
    source: "automatic",
    confidence: "high",
  }));
  const graph = { vertices, segments };
  const quality = assessExteriorDetectionGraph(graph.vertices, graph.segments, 0.82);
  return { graph, quality, points: simplified };
}

export function detectExteriorWallsFromGeometry({ planGeometryIndex, page = {}, planRegion = null, stitchToleranceDocUnits = 6 } = {}) {
  const rawSegments = typeof planGeometryIndex?.getCandidateWallSegments === "function"
    ? planGeometryIndex.getCandidateWallSegments()
    : planGeometryIndex?.segments;
  if (!Array.isArray(rawSegments) || rawSegments.length < 8) return null;

  const pageWidth = page.sourceWidth || page.width || 0;
  const pageHeight = page.sourceHeight || page.height || 0;
  const mmPerDocumentUnit = page.calibration?.mmPerDocumentUnit || null;
  const diagnostics = {
    source: planGeometryIndex?.source || rawSegments[0]?.source || "vector",
    rawLines: rawSegments.length,
    rejected: {},
    buildingRegion: null,
    excludedRegions: [],
    wallBands: 0,
    wallProbabilityMask: null,
    enclosedSpaceMask: null,
    filteredWallLines: 0,
    mergedLines: 0,
    wallPairs: 0,
    boundaryLines: 0,
    planRegion: planRegion || null,
    wallBandAudit: [],
    unpairedLineAudit: [],
  };

  const initialAccepted = [];
  rawSegments.forEach((segment) => {
    const reason = classifyRawLine(segment, planRegion, pageWidth, pageHeight);
    if (reason === "accepted") initialAccepted.push(segment);
    else diagnostics.rejected[reason] = (diagnostics.rejected[reason] || 0) + 1;
  });

  const mergedBeforeRegion = mergeCollinear(initialAccepted).map(toAxisLine);
  diagnostics.mergedLines = mergedBeforeRegion.length;
  if (mergedBeforeRegion.length < 6) return { vertices: [], segments: [], connected: true, isClosed: false, useful: false, diagnostics, message: "Vector geometry did not contain enough wall-like lines." };

  const initialPairs = pairWallFaces(mergedBeforeRegion, mmPerDocumentUnit).pairs;
  const initialWallBands = createWallBands(mergedBeforeRegion, initialPairs);
  diagnostics.unpairedLineAudit = auditUnpairedLines(mergedBeforeRegion, initialPairs, mmPerDocumentUnit);
  diagnostics.wallBands = initialWallBands.length;
  let detectedRegion = planRegion
    ? { polygon: [
      { x: planRegion.x, y: planRegion.y },
      { x: planRegion.x + planRegion.width, y: planRegion.y },
      { x: planRegion.x + planRegion.width, y: planRegion.y + planRegion.height },
      { x: planRegion.x, y: planRegion.y + planRegion.height },
    ], rect: planRegion, confidence: 1, excludedRegions: [], supportBandIds: initialWallBands.map((band) => band.id) }
    : detectBuildingRegion({ wallBands: initialWallBands, lines: mergedBeforeRegion, pageWidth, pageHeight }).region;
  if (!planRegion) detectedRegion = growRegionFromNearbyComponents(detectedRegion, pageWidth, pageHeight);
  if (!planRegion) {
    const mainDrawing = chooseMainDrawingRegion(mergedBeforeRegion, pageWidth, pageHeight);
    const currentArea = (detectedRegion?.rect?.width || 0) * (detectedRegion?.rect?.height || 0);
    const fallbackArea = (mainDrawing?.region?.width || 0) * (mainDrawing?.region?.height || 0);
    const fallbackIsFullSheet = pageWidth > 0 && pageHeight > 0 && mainDrawing?.region?.width > pageWidth * 0.82 && mainDrawing?.region?.height > pageHeight * 0.82;
    if (mainDrawing?.region && !fallbackIsFullSheet && fallbackArea > currentArea * 1.6) {
      detectedRegion = {
        polygon: polygonFromRegionRect(mainDrawing.region),
        rect: mainDrawing.region,
        confidence: Math.max(detectedRegion?.confidence || 0, 0.68),
        excludedRegions: detectedRegion?.excludedRegions || [],
        supportBandIds: detectedRegion?.supportBandIds || initialWallBands.map((band) => band.id),
      };
      diagnostics.drawingRegionComponents = mainDrawing.components;
    }
  }
  diagnostics.buildingRegion = detectedRegion;
  diagnostics.planRegion = detectedRegion?.rect || planRegion || null;
  diagnostics.excludedRegions = detectedRegion?.excludedRegions || [];

  if (!detectedRegion || detectedRegion.confidence < 0.45) {
    return {
      connected: true,
      vertices: [],
      segments: [],
      isClosed: false,
      exteriorPerimeter: null,
      detectionConfidence: 0,
      completeness: 0,
      connectedComponents: 0,
      openGaps: 0,
      useful: false,
      warnings: ["Exterior not detected reliably. Use Trace Exterior."],
      diagnostics,
      message: "Exterior not detected reliably. Use Trace Exterior.",
    };
  }

  let accepted = initialAccepted.filter((line) => segmentInBuildingRegion(line, detectedRegion, { tolerance: 10 }));
  diagnostics.rejected["outside-building-region"] = (diagnostics.rejected["outside-building-region"] || 0) + (initialAccepted.length - accepted.length);
  diagnostics.filteredWallLines = accepted.length;

  const merged = mergeCollinear(accepted).map(toAxisLine);
  diagnostics.mergedLines = merged.length;
  if (merged.length < 6) return { vertices: [], segments: [], connected: true, isClosed: false, useful: false, diagnostics, message: "Vector geometry did not contain enough wall-like lines." };

  const { pairedIds, pairs } = pairWallFaces(merged, mmPerDocumentUnit);
  diagnostics.wallPairs = pairs.length;
  const allWallBands = createWallBands(merged, pairs);
  const wallBands = allWallBands.filter((band) => segmentInBuildingRegion({ a: band.centerline.start, b: band.centerline.end }, detectedRegion, { tolerance: 10 }));
  diagnostics.wallBands = wallBands.length;
  diagnostics.wallProbabilityMask = {
    source: "vector+raster-compatible-band-mask",
    cellSize: ENVELOPE_CELL_SIZE,
    occupiedBandCount: wallBands.length,
    evidence: ["parallel-faces", "plausible-thickness", "overlap", "connected-corners"],
  };
  diagnostics.enclosedSpaceMask = {
    source: "wall-band-flood-fill",
    cellSize: ENVELOPE_CELL_SIZE,
    region: detectedRegion.rect,
  };
  let paired = merged.map((line) => ({ ...line, paired: pairedIds.has(line.id) }))
    .filter((line) => line.paired)
    .filter((line) => segmentInBuildingRegion(line, detectedRegion, { tolerance: 10 }));
  const boundary = selectBoundaryLines(paired.length >= 6 ? paired : merged);
  diagnostics.boundaryLines = boundary.length;

  const boundaryCandidateGraph = graphFromLines(boundary.length >= 6 ? boundary : paired, stitchToleranceDocUnits);
  diagnostics.candidateExteriorSegments = boundaryCandidateGraph.graph.segments.length;
  diagnostics.boundaryConnectedComponents = boundaryCandidateGraph.quality.connectedComponents;
  const envelopeSource = wallBands.length >= 4
    ? wallBands.map((band) => ({
      id: band.id,
      orientation: band.orientation,
      fixed: band.fixed,
      start: band.start,
      end: band.end,
      length: band.length,
    }))
    : [];
  const envelopeBoundarySource = selectBoundaryLines(envelopeSource);
  const boundaryBandIds = new Set(envelopeBoundarySource.map((band) => band.id));
  const supportBandIds = new Set(wallBands.map((band) => band.id));
  diagnostics.envelopeSourceBands = envelopeSource.length;
  diagnostics.envelopeBoundaryBands = envelopeBoundarySource.length;
  const envelopePolygon = buildEnvelopePolygon(envelopeBoundarySource.length >= 6 ? envelopeBoundarySource : envelopeSource, detectedRegion.rect, diagnostics);
  const envelopeGraph = envelopePolygon ? graphFromPolygon(envelopePolygon, stitchToleranceDocUnits) : null;
  diagnostics.boundaryBeforeSimplification = envelopePolygon || [];
  if (envelopeGraph) {
    diagnostics.boundaryAfterSimplification = envelopeGraph.points;
    diagnostics.envelopeGraphSegments = envelopeGraph.graph.segments.length;
    diagnostics.envelopeGraphComponents = envelopeGraph.quality.connectedComponents;
    diagnostics.envelopeGraphClosed = envelopeGraph.quality.isClosed;
    diagnostics.envelopeGraphOpenGaps = envelopeGraph.quality.openGaps;
  }
  if (envelopeGraph?.quality?.isClosed && envelopeGraph.graph.segments.length >= 4) {
    diagnostics.usedEnvelopePerimeter = true;
    diagnostics.envelopeVertices = envelopeGraph.points.length;
    diagnostics.candidateExteriorSegments = envelopeGraph.graph.segments.length;
  } else {
    return {
      connected: true,
      vertices: [],
      segments: [],
      isClosed: false,
      exteriorPerimeter: null,
      detectionConfidence: 0,
      completeness: 0,
      connectedComponents: boundaryCandidateGraph.quality.connectedComponents,
      openGaps: boundaryCandidateGraph.quality.openGaps,
      useful: false,
      warnings: ["Exterior detection failed - no valid closed building perimeter found."],
      diagnostics,
      message: "Exterior detection failed - no valid closed building perimeter found.",
    };
  }
  const selected = envelopeGraph;
  const { graph, quality } = selected;
  const supportTolerance = Math.max(ENVELOPE_CELL_SIZE * 4, 24);
  const wallSupportRatio = boundarySupportRatio(envelopeGraph.points, wallBands, supportTolerance);
  const edgeSupport = boundaryEdgeSupport(envelopeGraph.points, wallBands, supportTolerance);
  diagnostics.wallSupportRatio = wallSupportRatio;
  diagnostics.boundaryEdgeSupport = edgeSupport;
  const acceptedEdgeBandIds = new Set();
  edgeSupport.forEach((edge) => {
    wallBands.forEach((band) => {
      if (edgeSupportRatio(edge.a, edge.b, [band], supportTolerance) > 0) acceptedEdgeBandIds.add(band.id);
    });
  });
  diagnostics.wallBandAudit = auditWallBands({
    wallBands: allWallBands,
    detectedRegion,
    boundaryBandIds,
    supportBandIds,
    acceptedBandIds: acceptedEdgeBandIds,
  });
  const footprintValidation = validateExteriorFootprint(envelopeGraph.points, detectedRegion.rect);
  const unsupportedEdge = edgeSupport.find((edge, index) => !edgeIsSupported(edgeSupport, index, supportTolerance));
  if (unsupportedEdge) {
    footprintValidation.valid = false;
    footprintValidation.reason = unsupportedEdge.orthogonal
      ? "Exterior boundary contains an unsupported wall shortcut."
      : "Exterior boundary contains a non-orthogonal shortcut.";
    footprintValidation.unsupportedEdge = unsupportedEdge;
  }
  if (wallSupportRatio < 0.7) {
    footprintValidation.valid = false;
    footprintValidation.reason = "Exterior boundary is not sufficiently supported by wall bands.";
  }
  if (!footprintValidation.valid) {
    return {
      connected: true,
      vertices: [],
      segments: [],
      isClosed: false,
      exteriorPerimeter: null,
      detectionConfidence: 0,
      completeness: 0,
      connectedComponents: 0,
      openGaps: footprintValidation.gapCount,
      useful: false,
      warnings: [footprintValidation.reason],
      diagnostics: { ...diagnostics, footprintValidation },
      message: "Exterior detection failed - no valid closed building perimeter found.",
    };
  }
  const segments = graph.segments.map((segment) => ({
    ...segment,
    wallType: "exterior",
    confirmed: Boolean(quality.isClosed && quality.largestSegmentIds.has(segment.id)),
  }));
  const orderedPoints = envelopeGraph.points.map((point) => ({ x: point.x, y: point.y }));

  return {
    connected: true,
    vertices: graph.vertices,
    segments,
    isClosed: quality.isClosed,
    exteriorPerimeter: quality.isClosed ? {
      points: orderedPoints,
      closed: true,
      area: footprintValidation.areaDocumentUnits,
      perimeter: footprintValidation.perimeterDocumentUnits,
      selfIntersectionCount: footprintValidation.selfIntersectionCount,
      selfIntersections: footprintValidation.selfIntersectionCount,
      gapCount: footprintValidation.gapCount,
      wallSupportRatio,
      areaDocumentUnits: footprintValidation.areaDocumentUnits,
      perimeterDocumentUnits: footprintValidation.perimeterDocumentUnits,
      confidence: Math.max(quality.confidence, 82),
    } : null,
    detectionConfidence: Math.max(quality.confidence, 82),
    completeness: 100,
    connectedComponents: quality.connectedComponents,
    openGaps: quality.openGaps,
    useful: true,
    warnings: quality.warnings,
    diagnostics,
    message: `Exterior candidate found - one closed building perimeter from ${diagnostics.wallPairs} wall-band pair${diagnostics.wallPairs !== 1 ? "s" : ""}.`,
  };
}
