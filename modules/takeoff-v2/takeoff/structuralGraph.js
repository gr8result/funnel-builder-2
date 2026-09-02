import { distance, segmentIntersection } from "./geometry.js";

const MIN_STRUCTURAL_LENGTH = 8;
const ANGLE_MERGE_TOLERANCE_DEG = 2;
const OFFSET_MERGE_TOLERANCE = 1.25;
const GAP_MERGE_TOLERANCE = 5;
const NODE_TOLERANCE = 4;
const NEAR_INTERSECTION_TOLERANCE = 6;
const TEXT_REJECTION_PADDING = 1.8;
const PLAN_REGION_PADDING = 24;
const OCCUPANCY_SAMPLE_COUNT = 7;
const OCCUPANCY_UNKNOWN_BAND = 0.08;
const EXTERIOR_SCORE_THRESHOLD = 0.62;
const INTERIOR_SCORE_THRESHOLD = 0.58;

function angleDeg(a, b) {
  const angle = ((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI + 180) % 180;
  return angle >= 180 ? angle - 180 : angle;
}

function angleDiff(a, b) {
  const diff = Math.abs(a - b);
  return Math.min(diff, 180 - diff);
}

function frameForAngle(angleDegrees) {
  const radians = angleDegrees * Math.PI / 180;
  const ux = Math.cos(radians);
  const uy = Math.sin(radians);
  return { ux, uy, nx: -uy, ny: ux };
}

function segmentFrame(segment) {
  const angle = angleDeg(segment.a, segment.b);
  const frame = frameForAngle(angle);
  const aAlong = segment.a.x * frame.ux + segment.a.y * frame.uy;
  const bAlong = segment.b.x * frame.ux + segment.b.y * frame.uy;
  const aFixed = segment.a.x * frame.nx + segment.a.y * frame.ny;
  const bFixed = segment.b.x * frame.nx + segment.b.y * frame.ny;
  return {
    angle,
    ...frame,
    startAlong: Math.min(aAlong, bAlong),
    endAlong: Math.max(aAlong, bAlong),
    fixed: (aFixed + bFixed) / 2,
  };
}

function pointOn(line, along, fixed = line.fixed) {
  return { x: line.ux * along + line.nx * fixed, y: line.uy * along + line.ny * fixed };
}

function nearestPointOnSegment(point, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (!(len2 > 0)) return a;
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * abx + (point.y - a.y) * aby) / len2));
  return { x: a.x + abx * t, y: a.y + aby * t, t };
}

function segmentTag(segment) {
  return String(segment?.geometryType || segment?.objectType || segment?.role || segment?.type || segment?.classification || "").toLowerCase();
}

function pageBounds(page = {}, planGeometryIndex = {}) {
  return {
    width: page.sourceWidth || page.width || planGeometryIndex.pageWidth || 0,
    height: page.sourceHeight || page.height || planGeometryIndex.pageHeight || 0,
  };
}

function isSheetScaleLine(segment, bounds) {
  if (!(bounds.width > 0) || !(bounds.height > 0)) return false;
  const minX = Math.min(segment.a.x, segment.b.x);
  const maxX = Math.max(segment.a.x, segment.b.x);
  const minY = Math.min(segment.a.y, segment.b.y);
  const maxY = Math.max(segment.a.y, segment.b.y);
  const marginX = bounds.width * 0.045;
  const marginY = bounds.height * 0.045;
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  if (spanX > bounds.width * 0.82 && (minY <= marginY || maxY >= bounds.height - marginY)) return true;
  if (spanY > bounds.height * 0.82 && (minX <= marginX || maxX >= bounds.width - marginX)) return true;
  if (spanX > bounds.width * 0.92 || spanY > bounds.height * 0.92) return true;
  return false;
}

function hasDash(segment) {
  const dash = segment.dashPattern || segment.metadata?.dashPattern;
  if (!Array.isArray(dash) || dash.length === 0) return false;
  const values = dash.flat ? dash.flat(Infinity) : dash;
  return values.some((value) => Number(value) > 0);
}

function expandedBox(box, padding) {
  return {
    x: box.x - padding,
    y: box.y - padding,
    width: box.width + padding * 2,
    height: box.height + padding * 2,
  };
}

function boxesIntersect(a, b) {
  return a.x <= b.x + b.width &&
    a.x + a.width >= b.x &&
    a.y <= b.y + b.height &&
    a.y + a.height >= b.y;
}

function segmentBounds(segment) {
  const minX = Math.min(segment.a.x, segment.b.x);
  const maxX = Math.max(segment.a.x, segment.b.x);
  const minY = Math.min(segment.a.y, segment.b.y);
  const maxY = Math.max(segment.a.y, segment.b.y);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function segmentIntersectsBox(segment, box) {
  if (boxesIntersect(segmentBounds(segment), box) === false) return false;
  const samples = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    x: segment.a.x + (segment.b.x - segment.a.x) * t,
    y: segment.a.y + (segment.b.y - segment.a.y) * t,
  }));
  return samples.some((point) => (
    point.x >= box.x &&
    point.x <= box.x + box.width &&
    point.y >= box.y &&
    point.y <= box.y + box.height
  ));
}

function textHits(segment, textBoxes = []) {
  return textBoxes.filter((text) => {
    const box = expandedBox(text.bbox, Math.max(TEXT_REJECTION_PADDING, text.fontSize * 0.18));
    return segmentIntersectsBox(segment, box);
  });
}

function isNumericText(text) {
  return /\d/.test(String(text || "")) && !/[A-Za-z]{4,}/.test(String(text || ""));
}

function distanceToBox(segment, box) {
  const mid = { x: (segment.a.x + segment.b.x) / 2, y: (segment.a.y + segment.b.y) / 2 };
  const clampedX = Math.max(box.x, Math.min(box.x + box.width, mid.x));
  const clampedY = Math.max(box.y, Math.min(box.y + box.height, mid.y));
  return Math.hypot(mid.x - clampedX, mid.y - clampedY);
}

function nearNumericText(segment, textBoxes = []) {
  return textBoxes.some((text) => (
    isNumericText(text.text) &&
    distanceToBox(segment, expandedBox(text.bbox, Math.max(12, text.fontSize * 1.2))) <= Math.max(12, text.fontSize * 1.4)
  ));
}

function lineInsideBox(lineBox, region) {
  if (!region) return true;
  const mid = { x: lineBox.x + lineBox.width / 2, y: lineBox.y + lineBox.height / 2 };
  return mid.x >= region.x &&
    mid.x <= region.x + region.width &&
    mid.y >= region.y &&
    mid.y <= region.y + region.height;
}

function classifyCandidate(segment, { bounds, textBoxes = [], planRegionBBox = null, dimensionSegmentIds = null } = {}) {
  if (!segment?.a || !segment?.b) return { rejected: true, reason: "invalid" };
  const length = Number(segment.length) || distance(segment.a, segment.b);
  if (length < MIN_STRUCTURAL_LENGTH) return { rejected: true, reason: "short_fragment" };
  if (segment.isText || segment.isDimension || segment.isPageBorder || segment.isTitleBlock || segment.isDoorArc || segment.isSymbol) {
    return { rejected: true, reason: "tagged_nonstructural" };
  }
  const tag = segmentTag(segment);
  if (["annotation", "dimension", "dimension-line", "extension-line", "text", "text-bound", "leader", "arrow", "hatch", "hatching", "furniture", "cabinet", "cabinetry", "appliance", "fixture", "sanitary", "toilet", "sink", "bath", "shower", "stair", "page-border", "title-block", "title-block-rule", "elevation", "section-marker", "symbol"].includes(tag)) {
    return { rejected: true, reason: `tag:${tag}` };
  }
  if (hasDash(segment)) return { rejected: true, reason: "dashed_dimension_or_setback" };
  if (isSheetScaleLine(segment, bounds)) return { rejected: true, reason: "sheet_border_or_title_block" };
  if (dimensionSegmentIds?.has(segment.id)) return { rejected: true, reason: "dimension_chain_group" };
  const lineBox = segmentBounds(segment);
  if (planRegionBBox && !lineInsideBox(lineBox, expandedBox(planRegionBBox, PLAN_REGION_PADDING))) {
    return { rejected: true, reason: "outside_plan_region" };
  }
  const overlappingText = textHits(segment, textBoxes);
  if (overlappingText.length > 0 && (length < 42 || overlappingText.some((text) => text.text.length <= 4))) {
    return { rejected: true, reason: "text_glyph_or_label" };
  }
  if (nearNumericText(segment, textBoxes) && (length < 140 || !planRegionBBox || !lineInsideBox(lineBox, planRegionBBox))) {
    return { rejected: true, reason: "dimension_text_associated" };
  }
  const strokeWidth = Number(segment.strokeWidth ?? segment.metadata?.strokeWidth);
  const structuralScore = Math.min(1, 0.35 + length / 180 + (strokeWidth > 0.45 ? 0.1 : 0));
  return { rejected: false, confidence: Math.max(0.2, Math.min(0.98, structuralScore)) };
}

export function normalizeStructuralSegments(planGeometryIndex = {}, page = {}, options = {}) {
  const bounds = pageBounds(page, planGeometryIndex);
  const textBoxes = options.textBoxes || planGeometryIndex.textBoxes || [];
  const sourceSegments = Array.isArray(planGeometryIndex.rawSegments)
    ? planGeometryIndex.rawSegments
    : Array.isArray(planGeometryIndex.rawLines)
      ? planGeometryIndex.rawLines
      : Array.isArray(planGeometryIndex.segments)
        ? planGeometryIndex.segments
        : [];
  return sourceSegments
    .map((segment, index) => {
      const a = segment.a || segment.start;
      const b = segment.b || segment.end;
      const length = a && b ? distance(a, b) : 0;
      const base = {
        id: segment.id || `raw-${index + 1}`,
        x1: a?.x ?? null,
        y1: a?.y ?? null,
        x2: b?.x ?? null,
        y2: b?.y ?? null,
        a,
        b,
        angle: a && b ? angleDeg(a, b) : null,
        length,
        source: segment.source || planGeometryIndex.source || "pdf-vector",
        strokeWidth: segment.strokeWidth ?? segment.metadata?.strokeWidth ?? null,
        raw: segment,
      };
      const classification = classifyCandidate(
        { ...segment, a, b, length },
        { bounds, textBoxes, planRegionBBox: options.planRegionBBox || null, dimensionSegmentIds: options.dimensionSegmentIds || null }
      );
      return { ...base, ...classification };
    })
    .filter((segment) => segment.a && segment.b);
}

function pointLineDistance(point, line) {
  const projected = nearestPointOnSegment(point, line.a, line.b);
  return distance(point, projected);
}

function midpointOf(segment) {
  return { x: (segment.x1 + segment.x2) / 2, y: (segment.y1 + segment.y2) / 2 };
}

export function detectDimensionChainSegmentIds(candidates = [], planRegionBBox = null) {
  const ids = new Set();
  const usable = candidates.filter((candidate) => candidate.a && candidate.b);
  const shortTicks = usable.filter((candidate) => candidate.length >= 4 && candidate.length <= 18);
  const longLines = usable.filter((candidate) => candidate.length >= 55);
  longLines.forEach((line) => {
    const lineBox = segmentBounds(line);
    const outsideCore = planRegionBBox && !lineInsideBox(lineBox, expandedBox(planRegionBBox, -PLAN_REGION_PADDING));
    const tickCount = shortTicks.filter((tick) => {
      if (angleDiff(line.angle, tick.angle) < 25) return false;
      const mid = midpointOf(tick);
      return pointLineDistance(mid, line) <= 8;
    }).length;
    if (tickCount >= 2 && (outsideCore || tickCount >= 4)) ids.add(line.id);
  });
  return ids;
}

export function mergeCollinearStructuralLines(candidates = []) {
  const structural = candidates
    .filter((segment) => !segment.rejected)
    .map((segment) => ({ ...segment, ...segmentFrame(segment) }))
    .sort((a, b) => a.angle - b.angle || a.fixed - b.fixed || a.startAlong - b.startAlong);
  const groups = [];
  structural.forEach((line) => {
    const group = groups.find((candidate) => (
      angleDiff(candidate.angle, line.angle) <= ANGLE_MERGE_TOLERANCE_DEG &&
      Math.abs(candidate.fixed - line.fixed) <= OFFSET_MERGE_TOLERANCE
    ));
    if (!group) {
      groups.push({ angle: line.angle, fixed: line.fixed, lines: [line] });
      return;
    }
    group.lines.push(line);
    group.fixed = group.lines.reduce((sum, entry) => sum + entry.fixed, 0) / group.lines.length;
  });

  const merged = [];
  groups.forEach((group) => {
    const frame = frameForAngle(group.angle);
    const intervals = group.lines
      .sort((a, b) => a.startAlong - b.startAlong)
      .reduce((acc, line) => {
        const last = acc[acc.length - 1];
        if (!last || line.startAlong > last.endAlong + GAP_MERGE_TOLERANCE) {
          acc.push({
            startAlong: line.startAlong,
            endAlong: line.endAlong,
            sourceIds: [line.id],
            confidenceValues: [line.confidence],
          });
          return acc;
        }
        last.endAlong = Math.max(last.endAlong, line.endAlong);
        last.sourceIds.push(line.id);
        last.confidenceValues.push(line.confidence);
        return acc;
      }, []);
    intervals.forEach((interval) => {
      const line = {
        id: `sf-${merged.length + 1}`,
        angle: group.angle,
        fixed: group.fixed,
        ...frame,
        startAlong: interval.startAlong,
        endAlong: interval.endAlong,
        start: pointOn({ ...frame, fixed: group.fixed }, interval.startAlong, group.fixed),
        end: pointOn({ ...frame, fixed: group.fixed }, interval.endAlong, group.fixed),
        sourceSegmentIds: [...new Set(interval.sourceIds)],
        confidence: interval.confidenceValues.reduce((sum, value) => sum + value, 0) / interval.confidenceValues.length,
      };
      line.length = distance(line.start, line.end);
      if (line.length >= MIN_STRUCTURAL_LENGTH) merged.push(line);
    });
  });
  return merged;
}

export function detectPrimaryPlanRegion(candidates = [], bounds = {}) {
  const usable = candidates.filter((segment) => (
    !segment.rejected &&
    segment.length >= 18 &&
    segment.length <= Math.max(260, (bounds.width || 0) * 0.42) &&
    segment.x1 != null &&
    segment.y1 != null &&
    segment.x2 != null &&
    segment.y2 != null
  ));
  if (usable.length < 12) return null;
  const cellSize = 60;
  const cellMap = new Map();
  const addPoint = (point, segment) => {
    const cx = Math.floor(point.x / cellSize);
    const cy = Math.floor(point.y / cellSize);
    const key = `${cx}:${cy}`;
    if (!cellMap.has(key)) cellMap.set(key, { cx, cy, count: 0, segments: [] });
    const cell = cellMap.get(key);
    cell.count += 1;
    cell.segments.push(segment);
  };
  usable.forEach((segment) => {
    addPoint({ x: (segment.x1 + segment.x2) / 2, y: (segment.y1 + segment.y2) / 2 }, segment);
    if (segment.length < 120) {
      addPoint({ x: segment.x1, y: segment.y1 }, segment);
      addPoint({ x: segment.x2, y: segment.y2 }, segment);
    }
  });
  const denseKeys = new Set([...cellMap.entries()].filter(([, cell]) => cell.count >= 3).map(([key]) => key));
  const visited = new Set();
  const components = [];
  denseKeys.forEach((key) => {
    if (visited.has(key)) return;
    const stack = [key];
    visited.add(key);
    const cells = [];
    while (stack.length) {
      const current = stack.pop();
      const cell = cellMap.get(current);
      if (!cell) continue;
      cells.push(cell);
      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dy = -1; dy <= 1; dy += 1) {
          if (dx === 0 && dy === 0) continue;
          const next = `${cell.cx + dx}:${cell.cy + dy}`;
          if (denseKeys.has(next) && !visited.has(next)) {
            visited.add(next);
            stack.push(next);
          }
        }
      }
    }
    const segments = [...new Set(cells.flatMap((cell) => cell.segments))];
    const xs = segments.flatMap((segment) => [segment.x1, segment.x2]);
    const ys = segments.flatMap((segment) => [segment.y1, segment.y2]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const touchesLeftMargin = bounds.width > 0 && minX < bounds.width * 0.12;
    const touchesBottomNotes = bounds.height > 0 && maxY > bounds.height * 0.88;
    const score = segments.length + cells.reduce((sum, cell) => sum + cell.count, 0) * 0.1 - (touchesLeftMargin ? 80 : 0) - (touchesBottomNotes ? 80 : 0);
    components.push({ minX, maxX, minY, maxY, score, segments: segments.length });
  });
  const best = components.sort((a, b) => b.score - a.score)[0];
  if (!best) return null;
  const width = Math.max(1, best.maxX - best.minX);
  const height = Math.max(1, best.maxY - best.minY);
  const padX = Math.max(45, width * 0.12);
  const padY = Math.max(45, height * 0.12);
  const minX = Math.max(0, best.minX - padX);
  const minY = Math.max(0, best.minY - padY);
  const maxX = bounds.width > 0 ? Math.min(bounds.width, best.maxX + padX) : best.maxX + padX;
  const maxY = bounds.height > 0 ? Math.min(bounds.height, best.maxY + padY) : best.maxY + padY;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function onLineAlong(line, point) {
  return point.x * line.ux + point.y * line.uy;
}

function lineIncludes(line, point, tolerance) {
  const along = onLineAlong(line, point);
  const fixed = point.x * line.nx + point.y * line.ny;
  return (
    Math.abs(fixed - line.fixed) <= tolerance &&
    along >= line.startAlong - tolerance &&
    along <= line.endAlong + tolerance
  );
}

function endpointNearLine(endpoint, line, tolerance) {
  const projected = nearestPointOnSegment(endpoint, line.start, line.end);
  if (distance(endpoint, projected) > tolerance) return null;
  const along = onLineAlong(line, projected);
  if (along < line.startAlong - tolerance || along > line.endAlong + tolerance) return null;
  return projected;
}

function nodeTypeFor(point, lines) {
  const endpointCount = lines.filter((line) => (
    distance(point, line.start) <= NODE_TOLERANCE ||
    distance(point, line.end) <= NODE_TOLERANCE
  )).length;
  const uniqueAngles = [];
  lines.forEach((line) => {
    if (!uniqueAngles.some((angle) => angleDiff(angle, line.angle) <= ANGLE_MERGE_TOLERANCE_DEG)) uniqueAngles.push(line.angle);
  });
  if (lines.length >= 4 && uniqueAngles.length >= 2) return "X";
  if (lines.length >= 3 && uniqueAngles.length >= 2) return "T";
  if (lines.length === 2 && uniqueAngles.length >= 2 && endpointCount === 0) return "X";
  if (lines.length === 2 && uniqueAngles.length >= 2 && endpointCount === 1) return "T";
  if (lines.length === 2 && uniqueAngles.length >= 2 && endpointCount >= 2) return "L";
  if (lines.length === 2 && uniqueAngles.length >= 2) return "near_intersection";
  return "endpoint";
}

function addNode(nodes, point, lines, type = null, confidence = 0.75) {
  const existing = nodes.find((node) => distance(node, point) <= NODE_TOLERANCE);
  const lineIds = lines.map((line) => line.id).filter(Boolean);
  if (existing) {
    existing.x = (existing.x + point.x) / 2;
    existing.y = (existing.y + point.y) / 2;
    existing.connectedEdges = [...new Set([...existing.connectedEdges, ...lineIds])];
    if (type && existing.type === "endpoint") existing.type = type;
    if (!type && existing.type === "endpoint" && existing.connectedEdges.length > 1) {
      existing.type = nodeTypeFor(point, lines);
    }
    existing.confidence = Math.max(existing.confidence, confidence);
    return existing;
  }
  const node = {
    id: `sgn-${nodes.length + 1}`,
    x: point.x,
    y: point.y,
    type: type || nodeTypeFor(point, lines),
    connectedEdges: [...new Set(lineIds)],
    confidence,
    source: type ? "structural-node" : "structural-intersection",
  };
  nodes.push(node);
  return node;
}

export function findStructuralNodes(lines = []) {
  const nodes = [];
  lines.forEach((line) => {
    addNode(nodes, line.start, [line], "endpoint", 0.55);
    addNode(nodes, line.end, [line], "endpoint", 0.55);
  });
  for (let i = 0; i < lines.length; i += 1) {
    for (let j = i + 1; j < lines.length; j += 1) {
      const a = lines[i];
      const b = lines[j];
      if (angleDiff(a.angle, b.angle) <= ANGLE_MERGE_TOLERANCE_DEG) continue;
      const hit = segmentIntersection(a.start, a.end, b.start, b.end);
      if (hit && lineIncludes(a, hit, NODE_TOLERANCE) && lineIncludes(b, hit, NODE_TOLERANCE)) {
        addNode(nodes, hit, [a, b], null, 0.9);
        continue;
      }
      const near = [
        endpointNearLine(a.start, b, NEAR_INTERSECTION_TOLERANCE),
        endpointNearLine(a.end, b, NEAR_INTERSECTION_TOLERANCE),
        endpointNearLine(b.start, a, NEAR_INTERSECTION_TOLERANCE),
        endpointNearLine(b.end, a, NEAR_INTERSECTION_TOLERANCE),
      ].filter(Boolean).sort((left, right) => distance(left, a.start) - distance(right, a.start))[0];
      if (near) addNode(nodes, near, [a, b], "near_intersection", 0.68);
    }
  }
  return nodes.map((node) => ({
    ...node,
    point: { x: node.x, y: node.y },
  }));
}

function configuredThicknesses(page = {}) {
  const values = [70, 90, 230, 250];
  const exterior = Number(page.exteriorWalls?.wallThicknessMm);
  const internal = Number(page.internalWalls?.wallThicknessMm);
  if (exterior > 0) values.push(exterior);
  if (internal > 0) values.push(internal);
  return [...new Set(values.map((value) => Math.round(value)).filter((value) => value > 0))];
}

export function findWallFacePairs(lines = [], page = {}) {
  const mmPerDocumentUnit = page?.calibration?.mmPerDocumentUnit;
  if (!(mmPerDocumentUnit > 0)) return [];
  const targetMm = configuredThicknesses(page);
  const pairs = [];
  for (let i = 0; i < lines.length; i += 1) {
    for (let j = i + 1; j < lines.length; j += 1) {
      const a = lines[i];
      const b = lines[j];
      if (angleDiff(a.angle, b.angle) > ANGLE_MERGE_TOLERANCE_DEG) continue;
      const overlap = Math.min(a.endAlong, b.endAlong) - Math.max(a.startAlong, b.startAlong);
      if (overlap < Math.min(32, Math.max(18, Math.min(a.length, b.length) * 0.35))) continue;
      const separationDocUnits = Math.abs(a.fixed - b.fixed);
      const separationMm = separationDocUnits * mmPerDocumentUnit;
      const target = targetMm
        .map((mm) => ({ mm, delta: Math.abs(separationMm - mm) }))
        .sort((left, right) => left.delta - right.delta)[0];
      if (!target) continue;
      const tolerance = Math.max(8, target.mm * 0.14);
      if (target.delta > tolerance) continue;
      pairs.push({
        id: `wfp-${pairs.length + 1}`,
        faceAId: a.id,
        faceBId: b.id,
        faceA: a,
        faceB: b,
        separationDocUnits,
        separationMm,
        targetThicknessMm: target.mm,
        overlap,
        overlapStart: Math.max(a.startAlong, b.startAlong),
        overlapEnd: Math.min(a.endAlong, b.endAlong),
        confidence: Math.max(0.35, Math.min(0.96, 0.9 - target.delta / Math.max(tolerance, 1) * 0.35 + Math.min(0.12, overlap / 800))),
      });
    }
  }
  return pairs.sort((a, b) => b.confidence - a.confidence || b.overlap - a.overlap);
}

function lineAlong(line, point) {
  return point.x * line.ux + point.y * line.uy;
}

function lineFixed(line, point) {
  return point.x * line.nx + point.y * line.ny;
}

function projectPointToStructuralLine(point, line) {
  const along = Math.max(line.startAlong, Math.min(line.endAlong, lineAlong(line, point)));
  return { ...pointOn(line, along), along };
}

function facePairFrame(pair) {
  const faceA = pair?.faceA;
  if (!faceA) return null;
  return {
    angle: faceA.angle,
    ux: faceA.ux,
    uy: faceA.uy,
    nx: faceA.nx,
    ny: faceA.ny,
    fixed: (pair.faceA.fixed + pair.faceB.fixed) / 2,
    startAlong: Math.max(pair.faceA.startAlong, pair.faceB.startAlong),
    endAlong: Math.min(pair.faceA.endAlong, pair.faceB.endAlong),
  };
}

function facePairCentrePoint(pair, along) {
  const frame = facePairFrame(pair);
  return frame ? pointOn(frame, along, frame.fixed) : null;
}

function distanceToFacePairBand(point, pair) {
  const frame = facePairFrame(pair);
  if (!frame) return Infinity;
  const along = point.x * frame.ux + point.y * frame.uy;
  const fixed = point.x * frame.nx + point.y * frame.ny;
  const minFixed = Math.min(pair.faceA.fixed, pair.faceB.fixed);
  const maxFixed = Math.max(pair.faceA.fixed, pair.faceB.fixed);
  const clampedAlong = Math.max(frame.startAlong, Math.min(frame.endAlong, along));
  const clampedFixed = Math.max(minFixed, Math.min(maxFixed, fixed));
  const closest = pointOn(frame, clampedAlong, clampedFixed);
  return distance(point, closest);
}

function distanceToAssemblyBand(point, assembly) {
  return distanceToFacePairBand(point, assembly.pair || assembly);
}

function assemblyFrame(assembly) {
  return assembly?.frame || facePairFrame(assembly?.pair || assembly);
}

function assemblyCentrePoint(assembly, along) {
  const frame = assemblyFrame(assembly);
  return frame ? pointOn(frame, along, frame.fixed) : null;
}

function pointInBox(point, box) {
  if (!point || !box) return false;
  return point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height;
}

function buildOccupancyModel(facePairs = [], nodes = [], bounds = {}, planRegionBBox = null) {
  const supportedLineIds = new Set();
  nodes.forEach((node) => {
    if (node.type === "endpoint" && node.confidence < 0.7) return;
    (node.connectedEdges || []).forEach((id) => supportedLineIds.add(id));
  });
  const usablePairs = facePairs.filter((pair) => (
    pair.overlap >= 18 &&
    (supportedLineIds.has(pair.faceAId) || supportedLineIds.has(pair.faceBId) || pair.confidence >= 0.76)
  ));
  const xs = [];
  const ys = [];
  usablePairs.forEach((pair) => {
    const frame = facePairFrame(pair);
    if (!frame) return;
    [frame.startAlong, frame.endAlong].forEach((along) => {
      const p = pointOn(frame, along, frame.fixed);
      xs.push(p.x);
      ys.push(p.y);
    });
  });
  const fallback = planRegionBBox || {
    x: 0,
    y: 0,
    width: bounds.width || 0,
    height: bounds.height || 0,
  };
  if (xs.length < 4 || ys.length < 4) {
    return {
      bbox: fallback,
      coreBox: fallback,
      source: "fallback-plan-region",
      classifyPoint(point) {
        if (!pointInBox(point, fallback)) return "outside";
        return "unknown";
      },
      isExteriorBandPoint() {
        return false;
      },
    };
  }
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const padX = Math.max(10, width * 0.045);
  const padY = Math.max(10, height * 0.045);
  const bbox = {
    x: Math.max(0, minX - padX),
    y: Math.max(0, minY - padY),
    width: (bounds.width > 0 ? Math.min(bounds.width, maxX + padX) : maxX + padX) - Math.max(0, minX - padX),
    height: (bounds.height > 0 ? Math.min(bounds.height, maxY + padY) : maxY + padY) - Math.max(0, minY - padY),
  };
  const coreInsetX = Math.max(4, Math.min(22, width * 0.035));
  const coreInsetY = Math.max(4, Math.min(22, height * 0.035));
  const coreBox = {
    x: bbox.x + coreInsetX,
    y: bbox.y + coreInsetY,
    width: Math.max(1, bbox.width - coreInsetX * 2),
    height: Math.max(1, bbox.height - coreInsetY * 2),
  };
  return {
    bbox,
    coreBox,
    source: "structural-assembly-bounds",
    classifyPoint(point) {
      if (!pointInBox(point, bbox)) return "outside";
      if (pointInBox(point, coreBox)) return "building";
      return "unknown";
    },
    isExteriorBandPoint(point) {
      return pointInBox(point, bbox) && !pointInBox(point, coreBox);
    },
  };
}

function sampleSideOccupancy(pair, sideSign, occupancyModel) {
  const frame = facePairFrame(pair);
  if (!frame) return { classification: "unknown", buildingRatio: 0, outsideRatio: 0, unknownRatio: 1, samples: [] };
  const offset = Math.max(pair.separationDocUnits * 0.9, 8);
  const samples = [];
  for (let i = 0; i < OCCUPANCY_SAMPLE_COUNT; i += 1) {
    const t = OCCUPANCY_SAMPLE_COUNT === 1 ? 0.5 : i / (OCCUPANCY_SAMPLE_COUNT - 1);
    const along = frame.startAlong + (frame.endAlong - frame.startAlong) * t;
    const point = pointOn(frame, along, frame.fixed + sideSign * offset);
    const classification = occupancyModel.classifyPoint(point);
    samples.push({ point, classification });
  }
  const building = samples.filter((sample) => sample.classification === "building").length;
  const outside = samples.filter((sample) => sample.classification === "outside").length;
  const exteriorBand = samples.filter((sample) => sample.classification === "unknown" && occupancyModel.isExteriorBandPoint?.(sample.point)).length;
  const unknown = samples.length - building - outside;
  const buildingRatio = building / samples.length;
  const outsideRatio = (outside + exteriorBand) / samples.length;
  const unknownRatio = unknown / samples.length;
  let classification = "unknown";
  if (buildingRatio >= Math.max(0.5, outsideRatio + OCCUPANCY_UNKNOWN_BAND)) classification = "building";
  else if (outsideRatio >= Math.max(0.5, buildingRatio + OCCUPANCY_UNKNOWN_BAND)) classification = "outside";
  return { classification, buildingRatio, outsideRatio, unknownRatio, samples };
}

function sideOccupancyForPair(pair, occupancyModel) {
  const sideA = sampleSideOccupancy(pair, 1, occupancyModel);
  const sideB = sampleSideOccupancy(pair, -1, occupancyModel);
  return { sideA, sideB };
}

function endpointSupportForAssembly(pair, nodes = []) {
  const frame = facePairFrame(pair);
  if (!frame) return { start: 0, end: 0 };
  const edgeIds = new Set([pair.faceAId, pair.faceBId]);
  const scoreAt = (along) => nodes.reduce((score, node) => {
    const connected = (node.connectedEdges || []).some((id) => edgeIds.has(id));
    if (!connected) return score;
    const nodeAlong = node.x * frame.ux + node.y * frame.uy;
    const nodeFixed = node.x * frame.nx + node.y * frame.ny;
    if (Math.abs(nodeAlong - along) > Math.max(10, pair.separationDocUnits)) return score;
    if (nodeFixed < Math.min(pair.faceA.fixed, pair.faceB.fixed) - pair.separationDocUnits ||
      nodeFixed > Math.max(pair.faceA.fixed, pair.faceB.fixed) + pair.separationDocUnits) return score;
    const typeScore = node.type === "jamb" || node.type === "reentrant" ? 0.9 : node.type === "L" || node.type === "T" || node.type === "X" ? 1 : 0.45;
    return Math.max(score, typeScore * (node.confidence || 0.6));
  }, 0);
  return { start: scoreAt(frame.startAlong), end: scoreAt(frame.endAlong) };
}

function isFixtureLikeAssembly(pair, support, endpointSupport = { start: 0, end: 0 }, textBoxes = []) {
  const frame = facePairFrame(pair);
  if (!frame) return false;
  const length = frame.endAlong - frame.startAlong;
  const weakEndpoints = Math.min(endpointSupport.start || 0, endpointSupport.end || 0) < 0.35;
  const nearbyFixtureText = textBoxes.some((text) => {
    const label = String(text.text || "").toLowerCase();
    if (!/(cab|cupboard|fridge|island|bench|shelf|robe|linen|pantry|wc|bath|shr|sink|stair|up|dw)/.test(label)) return false;
    const centre = pointOn(frame, (frame.startAlong + frame.endAlong) / 2, frame.fixed);
    return distanceToBox({ a: centre, b: centre }, expandedBox(text.bbox, Math.max(18, text.fontSize * 2))) <= Math.max(18, text.fontSize * 2);
  });
  return (
    (length < 75 && weakEndpoints) ||
    (length < 55 && support < 1.1) ||
    (length < 90 && support < 0.8) ||
    nearbyFixtureText ||
    (pair.targetThicknessMm <= 110 && support < 0.5 && length < 130)
  );
}

function scoreWallAssembly(pair, nodes = [], occupancyModel, textBoxes = []) {
  const frame = facePairFrame(pair);
  const supportByLine = nodeSupportByLine(nodes);
  const nodeSupport = (supportByLine.get(pair.faceAId) || 0) + (supportByLine.get(pair.faceBId) || 0);
  const endpointSupport = endpointSupportForAssembly(pair, nodes);
  const occupancy = sideOccupancyForPair(pair, occupancyModel);
  const sideClasses = [occupancy.sideA.classification, occupancy.sideB.classification];
  const buildingBothSides = sideClasses.every((side) => side === "building");
  const outsideBothSides = sideClasses.every((side) => side === "outside");
  const buildingOutside = sideClasses.includes("building") && sideClasses.includes("outside");
  const sideBuildingMax = Math.max(occupancy.sideA.buildingRatio, occupancy.sideB.buildingRatio);
  const sideOutsideMax = Math.max(occupancy.sideA.outsideRatio, occupancy.sideB.outsideRatio);
  const sideBuildingMin = Math.min(occupancy.sideA.buildingRatio, occupancy.sideB.buildingRatio);
  const lengthScore = Math.min(0.18, (pair.overlap || 0) / 500);
  const continuityScore = Math.min(0.24, nodeSupport * 0.035 + (endpointSupport.start + endpointSupport.end) * 0.08);
  const shellScore = buildingOutside ? 0.34 + sideBuildingMax * 0.16 + sideOutsideMax * 0.16 : 0;
  const chordPenalty = buildingBothSides && sideBuildingMin >= 0.58 ? 0.72 : 0;
  const shortcutPenalty = buildingBothSides && pair.overlap > Math.max(120, (occupancyModel.coreBox?.width || 0) * 0.35) ? 0.35 : 0;
  const fixtureLike = isFixtureLikeAssembly(pair, nodeSupport, endpointSupport, textBoxes);
  const exteriorScore = Math.max(0, Math.min(0.99, pair.confidence * 0.26 + shellScore + continuityScore + lengthScore - chordPenalty - shortcutPenalty));
  const interiorScore = Math.max(0, Math.min(0.99,
    pair.confidence * 0.28 +
    (buildingBothSides ? 0.38 + sideBuildingMin * 0.18 : 0) +
    Math.min(0.26, nodeSupport * 0.045) +
    (endpointSupport.start > 0.35 && endpointSupport.end > 0.35 ? 0.12 : 0) +
    (pair.targetThicknessMm <= 120 ? 0.08 : -0.18) -
    (outsideBothSides ? 0.5 : 0) -
    (buildingOutside ? 0.24 : 0) -
    (fixtureLike ? 0.42 : 0)
  ));
  const rejectionReasons = [];
  if (buildingBothSides && sideBuildingMin >= 0.58) rejectionReasons.push("rejected: building occupancy both sides");
  if (shortcutPenalty > 0) rejectionReasons.push("rejected: perimeter shortcut");
  if (outsideBothSides) rejectionReasons.push("rejected: outside occupancy both sides");
  if (fixtureLike) rejectionReasons.push("rejected: fixture/cabinet-like isolated object");
  return {
    frame,
    nodeSupport,
    endpointSupport,
    sideAOccupancy: occupancy.sideA,
    sideBOccupancy: occupancy.sideB,
    exteriorScore,
    interiorScore,
    fixtureLike,
    rejectedAsExterior: rejectionReasons.some((reason) => reason !== "rejected: fixture/cabinet-like isolated object"),
    rejectionReasons,
  };
}

function boundaryNodeForFacePair(graph, pair, boundaryAlong, side) {
  const frame = facePairFrame(pair);
  if (!frame) return null;
  const centre = pointOn(frame, boundaryAlong, frame.fixed);
  const tolerance = Math.max(NODE_TOLERANCE, Math.min(12, pair.separationDocUnits * 0.8));
  const edgeIds = new Set([pair.faceAId, pair.faceBId]);
  const candidates = (graph.nodes || []).map((node) => {
    const along = node.x * frame.ux + node.y * frame.uy;
    const fixed = node.x * frame.nx + node.y * frame.ny;
    const connected = (node.connectedEdges || []).some((id) => edgeIds.has(id));
    const alongDistance = Math.abs(along - boundaryAlong);
    const fixedInside = fixed >= Math.min(pair.faceA.fixed, pair.faceB.fixed) - tolerance &&
      fixed <= Math.max(pair.faceA.fixed, pair.faceB.fixed) + tolerance;
    return {
      node,
      connected,
      alongDistance,
      fixedInside,
      distance: distance(node, centre),
    };
  }).filter((entry) => (
    entry.alongDistance <= tolerance &&
    (entry.connected || entry.fixedInside) &&
    entry.distance <= Math.max(tolerance * 1.4, pair.separationDocUnits)
  )).sort((a, b) => (
    (b.connected ? 1 : 0) - (a.connected ? 1 : 0) ||
    b.node.confidence - a.node.confidence ||
    a.distance - b.distance
  ));
  const best = candidates[0]?.node || null;
  if (best) return best;
  return {
    id: `synthetic-${pair.id}-${side}`,
    x: centre.x,
    y: centre.y,
    type: "endpoint",
    confidence: 0.55,
    connectedEdges: [pair.faceAId, pair.faceBId],
    source: "face-pair-boundary",
    synthetic: true,
    point: centre,
  };
}

function perpendicularLineSpansPair(line, pair, boundaryAlong, tolerance) {
  const frame = facePairFrame(pair);
  if (!frame || angleDiff(line.angle, pair.faceA.angle) < 35) return false;
  const lineMid = midpointOf({ x1: (line.start.x + line.end.x) / 2, y1: (line.start.y + line.end.y) / 2, x2: (line.start.x + line.end.x) / 2, y2: (line.start.y + line.end.y) / 2 });
  const midAlong = lineMid.x * frame.ux + lineMid.y * frame.uy;
  if (Math.abs(midAlong - boundaryAlong) > tolerance) return false;
  const aFixed = line.start.x * frame.nx + line.start.y * frame.ny;
  const bFixed = line.end.x * frame.nx + line.end.y * frame.ny;
  const low = Math.min(aFixed, bFixed);
  const high = Math.max(aFixed, bFixed);
  return low <= Math.max(pair.faceA.fixed, pair.faceB.fixed) + tolerance &&
    high >= Math.min(pair.faceA.fixed, pair.faceB.fixed) - tolerance;
}

function addFacePairTopologyNodes(nodes, facePairs, lines) {
  facePairs.forEach((pair) => {
    const frame = facePairFrame(pair);
    if (!frame) return;
    const tolerance = Math.max(NODE_TOLERANCE, Math.min(10, pair.separationDocUnits * 0.75));
    [
      { along: frame.startAlong, side: "start" },
      { along: frame.endAlong, side: "end" },
    ].forEach(({ along, side }) => {
      const jambSupport = lines.filter((line) => perpendicularLineSpansPair(line, pair, along, tolerance));
      if (jambSupport.length > 0) {
        addNode(nodes, pointOn(frame, along, frame.fixed), [pair.faceA, pair.faceB, ...jambSupport], "jamb", 0.88);
      }
    });
  });

  for (let i = 0; i < facePairs.length; i += 1) {
    for (let j = i + 1; j < facePairs.length; j += 1) {
      const a = facePairs[i];
      const b = facePairs[j];
      if (angleDiff(a.faceA.angle, b.faceA.angle) < 35) continue;
      const ac = { start: facePairCentrePoint(a, a.overlapStart), end: facePairCentrePoint(a, a.overlapEnd) };
      const bc = { start: facePairCentrePoint(b, b.overlapStart), end: facePairCentrePoint(b, b.overlapEnd) };
      if (!ac.start || !ac.end || !bc.start || !bc.end) continue;
      const hit = segmentIntersection(ac.start, ac.end, bc.start, bc.end);
      if (!hit) continue;
      const nearAEnd = Math.min(distance(hit, ac.start), distance(hit, ac.end));
      const nearBEnd = Math.min(distance(hit, bc.start), distance(hit, bc.end));
      const tolerance = Math.max(8, Math.min(18, Math.max(a.separationDocUnits, b.separationDocUnits)));
      if (nearAEnd <= tolerance && nearBEnd <= tolerance) {
        addNode(nodes, hit, [a.faceA, a.faceB, b.faceA, b.faceB], "reentrant", 0.84);
      }
    }
  }
}

export function createStructuralSpatialIndex(items = [], { cellSize = 32, pointForItem = (item) => item } = {}) {
  const cells = new Map();
  const keyFor = (x, y) => `${Math.floor(x / cellSize)}:${Math.floor(y / cellSize)}`;
  items.forEach((item) => {
    const point = pointForItem(item);
    if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return;
    const key = keyFor(point.x, point.y);
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(item);
  });
  return {
    cellSize,
    cells,
    query(point, radius) {
      const minX = Math.floor((point.x - radius) / cellSize);
      const maxX = Math.floor((point.x + radius) / cellSize);
      const minY = Math.floor((point.y - radius) / cellSize);
      const maxY = Math.floor((point.y + radius) / cellSize);
      const results = [];
      for (let cx = minX; cx <= maxX; cx += 1) {
        for (let cy = minY; cy <= maxY; cy += 1) {
          results.push(...(cells.get(`${cx}:${cy}`) || []));
        }
      }
      return results;
    },
  };
}

export function findNearestStructuralNode(graph, point, { radiusDocUnits = 12, nodeTypes = null } = {}) {
  const allowed = nodeTypes ? new Set(nodeTypes) : null;
  const index = graph.nodeSpatialIndex || createStructuralSpatialIndex(graph.nodes || []);
  return index.query(point, radiusDocUnits)
    .filter((node) => (!allowed || allowed.has(node.type)) && distance(node, point) <= radiusDocUnits)
    .sort((a, b) => b.confidence - a.confidence || distance(a, point) - distance(b, point))[0] || null;
}

function targetThicknessForWallType(page = {}, field = "internalWalls") {
  const graph = page?.[field] || {};
  const fallback = field === "exteriorWalls" ? 250 : 90;
  return Number(graph.wallThicknessMm || fallback);
}

export function findNearestWallAssembly(graph, point, { radiusDocUnits = 18, wallType = "internal", field = null } = {}) {
  const resolvedField = field || (wallType === "exterior" ? "exteriorWalls" : "internalWalls");
  const target = targetThicknessForWallType(graph.page || {}, resolvedField);
  const minScore = wallType === "exterior" ? EXTERIOR_SCORE_THRESHOLD : INTERIOR_SCORE_THRESHOLD;
  const scoreKey = wallType === "exterior" ? "exteriorScore" : "interiorScore";
  const candidates = (graph.wallAssemblies || []).map((assembly) => {
    const bandDistance = distanceToAssemblyBand(point, assembly);
    const thicknessDelta = Math.abs((assembly.targetThicknessMm || assembly.thicknessMm || 0) - target);
    const classificationScore = assembly[scoreKey] || 0;
    const score = bandDistance + thicknessDelta / Math.max(10, target) * 12 - classificationScore * 9 - assembly.structuralConfidence * 2;
    return { assembly, pair: assembly.pair, bandDistance, thicknessDelta, classificationScore, score };
  }).filter((entry) => (
    entry.pair &&
    entry.bandDistance <= Math.max(radiusDocUnits, entry.pair.separationDocUnits * 0.75) &&
    entry.thicknessDelta <= Math.max(12, target * 0.22) &&
    entry.classificationScore >= minScore
  )).sort((a, b) => a.score - b.score);
  return candidates[0] || null;
}

export function findNearestWallFacePair(graph, point, { radiusDocUnits = 18, wallType = "internal", field = null } = {}) {
  const nearest = findNearestWallAssembly(graph, point, { radiusDocUnits, wallType, field });
  if (nearest) return nearest;
  const resolvedField = field || (wallType === "exterior" ? "exteriorWalls" : "internalWalls");
  const target = targetThicknessForWallType(graph.page || {}, resolvedField);
  const candidates = (graph.facePairs || []).map((pair) => {
    const bandDistance = distanceToFacePairBand(point, pair);
    const thicknessDelta = Math.abs((pair.targetThicknessMm || pair.separationMm || 0) - target);
    const score = bandDistance + thicknessDelta / Math.max(10, target) * 12 - pair.confidence * 4;
    return { pair, assembly: null, bandDistance, thicknessDelta, score };
  }).filter((entry) => (
    entry.bandDistance <= Math.max(radiusDocUnits, entry.pair.separationDocUnits * 0.75) &&
    entry.thicknessDelta <= Math.max(12, target * 0.2)
  )).sort((a, b) => a.score - b.score);
  return candidates[0] || null;
}

function wallRunPolygonFromPair(pair, startAlong, endAlong) {
  return [
    pointOn(pair.faceA, startAlong, pair.faceA.fixed),
    pointOn(pair.faceA, endAlong, pair.faceA.fixed),
    pointOn(pair.faceB, endAlong, pair.faceB.fixed),
    pointOn(pair.faceB, startAlong, pair.faceB.fixed),
  ];
}

export function resolveWallRunFromStructuralGraph(point, { graph, planGeometryIndex, page = {}, zoomScale = 1, wallType = "internal", field = null } = {}) {
  const structuralGraph = graph || buildStructuralGraph(planGeometryIndex, page);
  const resolvedField = field || (wallType === "exterior" ? "exteriorWalls" : "internalWalls");
  const radiusDocUnits = 18 / Math.max(zoomScale, 0.01);
  const nearest = findNearestWallAssembly(structuralGraph, point, { radiusDocUnits, wallType, field: resolvedField });
  if (!nearest?.pair) return { status: "not_found", reason: wallType === "exterior" ? "no_classified_exterior_assembly" : "no_classified_interior_assembly", graph: structuralGraph };
  const pair = nearest.pair;
  const assembly = nearest.assembly || null;
  const frame = facePairFrame(pair);
  if (!frame) return { status: "not_found", reason: "invalid_face_pair", graph: structuralGraph };

  const seedAlong = point.x * frame.ux + point.y * frame.uy;
  if (seedAlong < frame.startAlong - radiusDocUnits || seedAlong > frame.endAlong + radiusDocUnits) {
    return { status: "not_found", reason: "seed_outside_wall_run", graph: structuralGraph };
  }
  const startNode = boundaryNodeForFacePair(structuralGraph, pair, frame.startAlong, "start");
  const endNode = boundaryNodeForFacePair(structuralGraph, pair, frame.endAlong, "end");
  if (!startNode || !endNode) return { status: "not_found", reason: "missing_structural_boundaries", graph: structuralGraph };

  const start = pointOn(frame, frame.startAlong, frame.fixed);
  const end = pointOn(frame, frame.endAlong, frame.fixed);
  const lowFace = pair.faceA.fixed <= pair.faceB.fixed ? pair.faceA : pair.faceB;
  const highFace = pair.faceA.fixed <= pair.faceB.fixed ? pair.faceB : pair.faceA;
  const metadataFaceA = wallType === "exterior" ? highFace : lowFace;
  const metadataFaceB = wallType === "exterior" ? lowFace : highFace;
  const faceA = {
    start: pointOn(metadataFaceA, frame.startAlong, metadataFaceA.fixed),
    end: pointOn(metadataFaceA, frame.endAlong, metadataFaceA.fixed),
    source: "structural-graph",
    lineId: metadataFaceA.id,
  };
  const faceB = {
    start: pointOn(metadataFaceB, frame.startAlong, metadataFaceB.fixed),
    end: pointOn(metadataFaceB, frame.endAlong, metadataFaceB.fixed),
    source: "structural-graph",
    lineId: metadataFaceB.id,
  };
  const thicknessMm = pair.separationMm;
  return {
    status: "resolved",
    point: projectPointToStructuralLine(point, { ...frame, start, end, startAlong: frame.startAlong, endAlong: frame.endAlong }),
    start,
    end,
    wallType,
    field: resolvedField,
    graph: structuralGraph,
    pair,
    assembly,
    startNode,
    endNode,
    polygon: wallRunPolygonFromPair(pair, frame.startAlong, frame.endAlong),
    metadata: {
      type: wallType,
      centreline: { start, end },
      faceA,
      faceB,
      innerFace: wallType === "exterior" ? faceA : null,
      outerFace: wallType === "exterior" ? faceB : null,
      intermediateFaces: [],
      orientation: Math.abs(end.x - start.x) >= Math.abs(end.y - start.y) ? "horizontal" : "vertical",
      thicknessDocUnits: pair.separationDocUnits,
      thicknessPx: pair.separationDocUnits,
      thicknessMm,
      wallConstructionType: page?.[resolvedField]?.constructionType || (wallType === "exterior" ? "brick_veneer" : "interior_partition"),
      passedThicknessValidation: true,
      thicknessValidation: { source: "structural-graph", valid: true, targetMm: pair.targetThicknessMm },
      constructionLineCount: 2,
      source: "manual",
      snapSource: `seeded-${wallType}-wall-run`,
      sourceSegmentIds: [...new Set([...(pair.faceA.sourceSegmentIds || []), ...(pair.faceB.sourceSegmentIds || [])])],
      confidence: Math.max(0.72, pair.confidence),
      snapConfidence: Math.max(0.72, pair.confidence),
      geometryStatus: "resolved",
      resolutionFailure: null,
      selectedPathRelation: "inside",
      faceASupport: "structural-graph",
      faceBSupport: "structural-graph",
      wallRunDetection: {
        mode: "wall-assembly-graph-one-click",
        seedPoint: point,
        startNode,
        endNode,
        facePairId: pair.id,
        wallAssemblyId: assembly?.id || null,
        exteriorScore: assembly?.exteriorScore ?? null,
        interiorScore: assembly?.interiorScore ?? null,
        sideAOccupancy: assembly?.sideAOccupancy?.classification || null,
        sideBOccupancy: assembly?.sideBOccupancy?.classification || null,
      },
      physicalBandDiagnostics: {
        seedPoint: point,
        selectedWallRun: { startNode, endNode, facePairId: pair.id, wallAssemblyId: assembly?.id || null },
      },
    },
  };
}

function nodeSupportByLine(nodes = []) {
  const support = new Map();
  nodes.forEach((node) => {
    const weight = node.type === "L" || node.type === "T" || node.type === "X" ? 1 : node.type === "near_intersection" ? 0.65 : 0.25;
    (node.connectedEdges || []).forEach((lineId) => {
      support.set(lineId, (support.get(lineId) || 0) + weight);
    });
  });
  return support;
}

function pairSupportByLine(facePairs = []) {
  const support = new Map();
  facePairs.forEach((pair) => {
    support.set(pair.faceAId, (support.get(pair.faceAId) || 0) + pair.confidence);
    support.set(pair.faceBId, (support.get(pair.faceBId) || 0) + pair.confidence);
  });
  return support;
}

function reinforceStructuralLines(lines = [], nodes = [], facePairs = []) {
  const nodeSupport = nodeSupportByLine(nodes);
  const pairSupport = pairSupportByLine(facePairs);
  const reinforced = lines.map((line) => {
    const ns = nodeSupport.get(line.id) || 0;
    const ps = pairSupport.get(line.id) || 0;
    const isolatedPenalty = ns < 0.5 && ps < 0.5 ? 0.28 : 0;
    const reinforcedConfidence = Math.max(
      0.05,
      Math.min(0.99, line.confidence + Math.min(0.22, ns * 0.06) + Math.min(0.28, ps * 0.12) - isolatedPenalty)
    );
    return {
      ...line,
      nodeSupport: ns,
      pairSupport: ps,
      structuralConfidence: reinforcedConfidence,
      lowConfidence: reinforcedConfidence < 0.38,
    };
  });
  return reinforced.filter((line) => (
    line.structuralConfidence >= 0.28 &&
    !(line.length < 18 && line.nodeSupport < 1 && line.pairSupport < 0.5)
  ));
}

export function buildWallAssemblyCandidates(facePairs = [], nodes = [], { bounds = {}, planRegionBBox = null, textBoxes = [] } = {}) {
  const occupancyModel = buildOccupancyModel(facePairs, nodes, bounds, planRegionBBox);
  const assemblies = facePairs.map((pair) => {
    const scored = scoreWallAssembly(pair, nodes, occupancyModel, textBoxes);
    return {
      id: `wa-${pair.id}`,
      pair,
      facePairId: pair.id,
      faceA: pair.faceA,
      faceB: pair.faceB,
      thicknessMm: pair.separationMm,
      thicknessDocUnits: pair.separationDocUnits,
      targetThicknessMm: pair.targetThicknessMm,
      overlapLength: pair.overlap,
      startNode: null,
      endNode: null,
      connectedAssemblies: [],
      frame: scored.frame,
      nodeSupport: scored.nodeSupport,
      endpointSupport: scored.endpointSupport,
      sideAOccupancy: scored.sideAOccupancy,
      sideBOccupancy: scored.sideBOccupancy,
      exteriorScore: scored.exteriorScore,
      interiorScore: scored.interiorScore,
      fixtureLike: scored.fixtureLike,
      rejectedAsExterior: scored.rejectedAsExterior,
      rejectionReasons: scored.rejectionReasons,
      structuralConfidence: Math.max(0.05, Math.min(0.99, pair.confidence + Math.min(0.24, scored.nodeSupport * 0.04))),
      classification: scored.exteriorScore >= EXTERIOR_SCORE_THRESHOLD
        ? "exterior"
        : scored.interiorScore >= INTERIOR_SCORE_THRESHOLD
          ? "interior"
          : "ambiguous",
    };
  });
  const endpointKey = (point) => `${Math.round(point.x / NODE_TOLERANCE)}:${Math.round(point.y / NODE_TOLERANCE)}`;
  const endpointMap = new Map();
  assemblies.forEach((assembly) => {
    const frame = assembly.frame;
    if (!frame) return;
    const start = pointOn(frame, frame.startAlong, frame.fixed);
    const end = pointOn(frame, frame.endAlong, frame.fixed);
    [
      { key: "startNode", point: start },
      { key: "endNode", point: end },
    ].forEach(({ key, point }) => {
      const nodeKey = endpointKey(point);
      assembly[key] = { id: `wan-${nodeKey}`, point, synthetic: true };
      if (!endpointMap.has(nodeKey)) endpointMap.set(nodeKey, []);
      endpointMap.get(nodeKey).push(assembly.id);
    });
  });
  const byId = new Map(assemblies.map((assembly) => [assembly.id, assembly]));
  endpointMap.forEach((ids) => {
    const uniqueIds = [...new Set(ids)];
    uniqueIds.forEach((id) => {
      const assembly = byId.get(id);
      if (!assembly) return;
      assembly.connectedAssemblies = [...new Set([...(assembly.connectedAssemblies || []), ...uniqueIds.filter((otherId) => otherId !== id)])];
    });
  });
  return assemblies.sort((a, b) => (
    Math.max(b.exteriorScore, b.interiorScore) - Math.max(a.exteriorScore, a.interiorScore) ||
    b.structuralConfidence - a.structuralConfidence ||
    b.overlapLength - a.overlapLength
  ));
}

export function buildStructuralGraph(planGeometryIndex = {}, page = {}, options = {}) {
  const bounds = pageBounds(page, planGeometryIndex);
  const textBoxes = options.textBoxes || planGeometryIndex.textBoxes || [];
  const initialCandidates = normalizeStructuralSegments(planGeometryIndex, page, { textBoxes });
  const planRegionBBox = options.planRegionBBox || detectPrimaryPlanRegion(initialCandidates, bounds);
  const dimensionSegmentIds = detectDimensionChainSegmentIds(initialCandidates, planRegionBBox);
  const candidates = normalizeStructuralSegments(planGeometryIndex, page, { textBoxes, planRegionBBox, dimensionSegmentIds });
  let structuralLines = mergeCollinearStructuralLines(candidates);
  let nodes = findStructuralNodes(structuralLines);
  let facePairs = findWallFacePairs(structuralLines, page);
  addFacePairTopologyNodes(nodes, facePairs, structuralLines);
  structuralLines = reinforceStructuralLines(structuralLines, nodes, facePairs);
  nodes = findStructuralNodes(structuralLines);
  facePairs = findWallFacePairs(structuralLines, page);
  addFacePairTopologyNodes(nodes, facePairs, structuralLines);
  const wallAssemblies = buildWallAssemblyCandidates(facePairs, nodes, { bounds, planRegionBBox, textBoxes });
  const occupancyModel = buildOccupancyModel(facePairs, nodes, bounds, planRegionBBox);
  const nodeSpatialIndex = createStructuralSpatialIndex(nodes);
  return {
    source: planGeometryIndex.source || "unknown",
    page,
    textBoxes,
    planRegionBBox,
    dimensionSegmentIds: [...dimensionSegmentIds],
    candidates,
    rejected: candidates.filter((candidate) => candidate.rejected),
    structuralLines,
    nodes,
    nodeSpatialIndex,
    facePairs,
    wallAssemblies,
    occupancyModel,
    exteriorAssemblies: wallAssemblies.filter((assembly) => assembly.exteriorScore >= EXTERIOR_SCORE_THRESHOLD),
    interiorAssemblies: wallAssemblies.filter((assembly) => assembly.interiorScore >= INTERIOR_SCORE_THRESHOLD),
    rejectedExteriorAssemblies: wallAssemblies.filter((assembly) => assembly.rejectedAsExterior),
    summary: {
      rawSegments: candidates.length,
      rejectedSegments: candidates.filter((candidate) => candidate.rejected).length,
      structuralLines: structuralLines.length,
      nodes: nodes.length,
      facePairs: facePairs.length,
      wallAssemblies: wallAssemblies.length,
      exteriorCandidatesBeforeOccupancy: facePairs.filter((pair) => (pair.targetThicknessMm || 0) >= 180).length,
      exteriorCandidatesAfterOccupancy: wallAssemblies.filter((assembly) => assembly.exteriorScore >= EXTERIOR_SCORE_THRESHOLD).length,
      interiorCandidatesBeforeFiltering: facePairs.filter((pair) => (pair.targetThicknessMm || 0) <= 120).length,
      interiorCandidatesAfterFiltering: wallAssemblies.filter((assembly) => assembly.interiorScore >= INTERIOR_SCORE_THRESHOLD).length,
      rejectedCrossBuildingCandidates: wallAssemblies.filter((assembly) => assembly.rejectionReasons?.some((reason) => reason.includes("building occupancy both sides") || reason.includes("perimeter shortcut"))).length,
      fixtureLikeRejected: wallAssemblies.filter((assembly) => assembly.fixtureLike).length,
      nodeTypes: nodes.reduce((acc, node) => {
        acc[node.type] = (acc[node.type] || 0) + 1;
        return acc;
      }, {}),
    },
  };
}
