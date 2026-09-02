import { distance } from "./geometry.js";
import { findHighlightableWallAtPoint } from "./localWallHighlighter.js";
import { scaleToolLineSelection } from "./lineSelection.js";
import {
  detectOpeningIntervals,
  detectOpeningSpan,
  projectRawSegmentToGuide,
  MAX_BRIDGEABLE_OPENING_MM,
} from "./wallOpeningSpan.js";
import { resolveWallRunFromStructuralGraph } from "./structuralGraph.js";

const DEFAULT_WALL_THICKNESS_MM = 200;
const DEFAULT_WALL_THICKNESS_DOC_UNITS = 7;
const MIN_RENDER_THICKNESS_DOC_UNITS = 3;
const MAX_INFERRED_THICKNESS_DOC_UNITS = 12;
const EXTERIOR_CLUSTER_MIN_LINES = 2;
const EXTERIOR_CLUSTER_MAX_LINES = 4;
const EXTERIOR_PARALLEL_TOLERANCE_DEG = 4;
const EXTERIOR_MIN_OVERLAP_DOC_UNITS = 24;
const EXTERIOR_DEFAULT_MIN_THICKNESS_DOC_UNITS = 5;
const EXTERIOR_DEFAULT_MAX_THICKNESS_DOC_UNITS = 26;
const EXTERIOR_TARGET_THICKNESS_MM = 240;
const EXTERIOR_THICKNESS_TOLERANCE_MM = 90;
const EXTERIOR_ALLOWED_RANGES_MM = [
  { type: "brick veneer", preferredMin: 230, preferredMax: 250, min: 200, max: 300, target: 240 },
  { type: "lightweight/cladding", preferredMin: 70, preferredMax: 90, min: 60, max: 140, target: 80 },
];
const INTERIOR_ALLOWED_RANGES_MM = [
  { type: "interior partition", preferredMin: 70, preferredMax: 110, min: 60, max: 160, target: 90 },
];
const EXTERIOR_MAX_ADJACENT_FACE_GAP_DOC_UNITS = 14;
const EXTERIOR_DIRECTION_TOLERANCE_DEG = 12;
const EXTERIOR_CORNER_ANGLE_MIN_DEG = 65;
const EXTERIOR_CORNER_ANGLE_MAX_DEG = 115;
const MIN_SCALE_MM_PER_DOC_UNIT = 0.000001;

function nearestPointOnSegment(point, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (!(len2 > 0)) return a;
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * abx + (point.y - a.y) * aby) / len2));
  return { x: a.x + abx * t, y: a.y + aby * t };
}

function lineForWall(wall) {
  if (wall?.centreline?.start && wall?.centreline?.end) return wall.centreline;
  if (wall?.axis?.start && wall?.axis?.end) return wall.axis;
  if (wall?.startJunction && wall?.endJunction) return { start: wall.startJunction, end: wall.endJunction };
  if (wall?.start && wall?.end) return { start: wall.start, end: wall.end };
  return null;
}

function unitNormal(start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy);
  if (!(len > 0)) return null;
  return { ux: dx / len, uy: dy / len, nx: -dy / len, ny: dx / len, length: len };
}

function offsetPoint(point, normal, offset) {
  return { x: point.x + normal.nx * offset, y: point.y + normal.ny * offset };
}

function faceOffset(face, start, normal) {
  if (!face?.start || !face?.end) return null;
  const a = (face.start.x - start.x) * normal.nx + (face.start.y - start.y) * normal.ny;
  const b = (face.end.x - start.x) * normal.nx + (face.end.y - start.y) * normal.ny;
  return (a + b) / 2;
}

function defaultThicknessDocUnits(page, field) {
  const graph = page?.[field];
  const thicknessMm = graph?.wallThicknessMm || DEFAULT_WALL_THICKNESS_MM;
  const mmPerDocumentUnit = page?.calibration?.mmPerDocumentUnit;
  if (mmPerDocumentUnit > 0) {
    return Math.max(MIN_RENDER_THICKNESS_DOC_UNITS, Math.min(MAX_INFERRED_THICKNESS_DOC_UNITS, thicknessMm / mmPerDocumentUnit));
  }
  return DEFAULT_WALL_THICKNESS_DOC_UNITS;
}

function rawSegments(planGeometryIndex) {
  const raw = Array.isArray(planGeometryIndex?.rawSegments)
    ? planGeometryIndex.rawSegments
    : typeof planGeometryIndex?.getCandidateWallSegments === "function"
      ? planGeometryIndex.getCandidateWallSegments()
      : planGeometryIndex?.segments;
  return Array.isArray(raw) ? raw : [];
}

function segmentTag(segment) {
  return String(segment?.geometryType || segment?.objectType || segment?.role || segment?.type || segment?.classification || "").toLowerCase();
}

function isStructuralLine(segment, page = {}) {
  if (!segment?.a || !segment?.b) return false;
  if (segment.isText || segment.isDimension || segment.isPageBorder || segment.isTitleBlock || segment.isDoorArc || segment.isSymbol) return false;
  const tag = segmentTag(segment);
  if (["annotation", "dimension", "dimension-line", "extension-line", "text", "text-bound", "door-arc", "symbol", "page-border", "title-block", "title-block-rule", "leader", "hatch", "hatching", "furniture", "furniture-edge", "cabinet", "cabinetry", "bench", "appliance", "window", "window-symbol", "glazing", "door", "door-symbol", "garage-door", "opening", "note", "arrow", "setback", "stair", "stair-tread", "tread"].includes(tag)) return false;
  const width = page?.sourceWidth || page?.width || 0;
  const height = page?.sourceHeight || page?.height || 0;
  if (width > 0 && height > 0) {
    const minX = Math.min(segment.a.x, segment.b.x);
    const maxX = Math.max(segment.a.x, segment.b.x);
    const minY = Math.min(segment.a.y, segment.b.y);
    const maxY = Math.max(segment.a.y, segment.b.y);
    if ((maxX - minX) > width * 0.9 || (maxY - minY) > height * 0.9) return false;
    const marginX = width * 0.05;
    const marginY = height * 0.05;
    if ((maxX - minX > width * 0.82 && (minY <= marginY || maxY >= height - marginY)) ||
      (maxY - minY > height * 0.82 && (minX <= marginX || maxX >= width - marginX))) return false;
  }
  return distance(segment.a, segment.b) >= 10;
}

function normalizeAngle(angle) {
  let next = angle;
  while (next < 0) next += Math.PI;
  while (next >= Math.PI) next -= Math.PI;
  return next;
}

function angleDiffDeg(a, b) {
  const diff = Math.abs(a - b);
  return Math.min(diff, Math.PI - diff) * 180 / Math.PI;
}

function angleForPoints(a, b) {
  if (!a || !b) return null;
  const len = distance(a, b);
  if (!(len > 0)) return null;
  return normalizeAngle(Math.atan2(b.y - a.y, b.x - a.x));
}

function oriented(segment) {
  const dx = segment.b.x - segment.a.x;
  const dy = segment.b.y - segment.a.y;
  const length = Math.hypot(dx, dy);
  if (!(length > 0)) return null;
  const angle = normalizeAngle(Math.atan2(dy, dx));
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const nx = -uy;
  const ny = ux;
  const aAlong = segment.a.x * ux + segment.a.y * uy;
  const bAlong = segment.b.x * ux + segment.b.y * uy;
  const fixed = ((segment.a.x * nx + segment.a.y * ny) + (segment.b.x * nx + segment.b.y * ny)) / 2;
  return {
    ...segment,
    angle,
    ux,
    uy,
    nx,
    ny,
    fixed,
    startAlong: Math.min(aAlong, bAlong),
    endAlong: Math.max(aAlong, bAlong),
    length,
  };
}

function pointOn(line, along, fixed = line.fixed) {
  return { x: line.ux * along + line.nx * fixed, y: line.uy * along + line.ny * fixed };
}

function linePointDistance(point, line) {
  return distance(point, nearestPointOnSegment(point, line.a, line.b));
}

function infiniteLineIntersection(a, b, c, d) {
  const denominator = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
  if (Math.abs(denominator) < 1e-9) return null;
  const px = ((a.x * b.y - a.y * b.x) * (c.x - d.x) - (a.x - b.x) * (c.x * d.y - c.y * d.x)) / denominator;
  const py = ((a.x * b.y - a.y * b.x) * (c.y - d.y) - (a.y - b.y) * (c.x * d.y - c.y * d.x)) / denominator;
  return { x: px, y: py };
}

function alongOn(line, point) {
  return point.x * line.ux + point.y * line.uy;
}

function lineIncludesAlong(line, along, tolerance) {
  return along >= line.startAlong - tolerance && along <= line.endAlong + tolerance;
}

function customWallRange(page, field) {
  const graph = page?.[field];
  const range = graph?.wallThicknessRangeMm || graph?.customWallThicknessRangeMm || page?.wallThicknessRangeMm;
  if (range && Number(range.min) > 0 && Number(range.max) >= Number(range.min)) {
    const target = Number(range.target) > 0 ? Number(range.target) : (Number(range.min) + Number(range.max)) / 2;
    return { type: "custom", preferredMin: Number(range.min), preferredMax: Number(range.max), min: Number(range.min), max: Number(range.max), target };
  }
  const thickness = Number(graph?.customWallThicknessMm);
  if (thickness > 0) {
    const tolerance = Math.max(15, thickness * 0.2);
    return { type: "custom", preferredMin: thickness - tolerance / 2, preferredMax: thickness + tolerance / 2, min: thickness - tolerance, max: thickness + tolerance, target: thickness };
  }
  const lockedThickness = Number(graph?.thicknessLocked ? graph?.wallThicknessMm : null);
  if (lockedThickness > 0) {
    const tolerance = Math.max(8, lockedThickness * 0.12);
    return {
      type: graph?.constructionType || "locked",
      preferredMin: lockedThickness - tolerance / 2,
      preferredMax: lockedThickness + tolerance / 2,
      min: lockedThickness - tolerance,
      max: lockedThickness + tolerance,
      target: lockedThickness,
    };
  }
  const configuredThickness = Number(graph?.wallThicknessMm);
  const hasConfiguredThickness = configuredThickness > 0 && (
    Object.prototype.hasOwnProperty.call(graph || {}, "wallThicknessMm") ||
    Object.prototype.hasOwnProperty.call(graph || {}, "constructionType")
  );
  if (hasConfiguredThickness) {
    const tolerance = Math.max(12, configuredThickness * 0.18);
    return {
      type: graph?.constructionType || (field === "exteriorWalls" ? "configured exterior" : "configured interior"),
      preferredMin: configuredThickness - tolerance / 2,
      preferredMax: configuredThickness + tolerance / 2,
      min: configuredThickness - tolerance,
      max: configuredThickness + tolerance,
      target: configuredThickness,
    };
  }
  return null;
}

function physicalThicknessRanges(page, wallType) {
  const field = wallType === "exterior" ? "exteriorWalls" : "internalWalls";
  const custom = customWallRange(page, field);
  if (custom) return [custom];
  return wallType === "exterior" ? EXTERIOR_ALLOWED_RANGES_MM : INTERIOR_ALLOWED_RANGES_MM;
}

function hasCalibratedScale(page) {
  return Number(page?.calibration?.mmPerDocumentUnit) > MIN_SCALE_MM_PER_DOC_UNIT;
}

function hasCompleteCalibrationSnapState(page) {
  return Boolean(
    hasCalibratedScale(page) &&
    page.calibration.pointA &&
    page.calibration.pointB
  );
}

function classifyThicknessMm(thicknessMm, page, wallType) {
  if (!(thicknessMm > 0)) return null;
  let best = null;
  physicalThicknessRanges(page, wallType).forEach((range) => {
    if (thicknessMm < range.min || thicknessMm > range.max) return;
    const preferred = thicknessMm >= range.preferredMin && thicknessMm <= range.preferredMax;
    const targetDelta = Math.abs(thicknessMm - range.target);
    const score = (preferred ? 1 : 0.68) - targetDelta / Math.max(range.target, 1) * 0.25;
    if (!best || score > best.score) best = { ...range, score, preferred };
  });
  return best;
}

function thicknessMmFromDocUnits(thicknessDocUnits, page) {
  const mmPerDocumentUnit = page?.calibration?.mmPerDocumentUnit;
  return mmPerDocumentUnit > 0 ? thicknessDocUnits * mmPerDocumentUnit : null;
}

function builderWallSettings(page, field, wallType) {
  const graph = page?.[field];
  if (!graph || typeof graph !== "object") return null;
  const hasBuilderSetting = Object.prototype.hasOwnProperty.call(graph, "wallThicknessMm") ||
    Object.prototype.hasOwnProperty.call(graph, "thicknessLocked") ||
    Object.prototype.hasOwnProperty.call(graph, "constructionType");
  if (!hasBuilderSetting) return null;
  const fallbackThicknessMm = wallType === "exterior" ? 250 : 90;
  const thicknessMm = Number(graph.wallThicknessMm ?? fallbackThicknessMm);
  if (!(thicknessMm > 0)) return null;
  return {
    thicknessMm,
    constructionType: graph.constructionType || (wallType === "exterior" ? "brick_veneer" : "interior_partition"),
    thicknessSource: graph.thicknessLocked ? "user_locked" : "user_override",
    thicknessLocked: Boolean(graph.thicknessLocked),
  };
}

function detectedFaceOffsets(wallBand, start, normal, wallType) {
  if (!hasDetectedWallBandFaces(wallBand)) return null;
  const primaryFaceA = wallType === "exterior" ? (wallBand.innerFace || wallBand.faceA) : wallBand.faceA;
  const primaryFaceB = wallType === "exterior" ? (wallBand.outerFace || wallBand.faceB) : wallBand.faceB;
  const offsetA = faceOffset(primaryFaceA, start, normal);
  const offsetB = faceOffset(primaryFaceB, start, normal);
  if (!Number.isFinite(offsetA) || !Number.isFinite(offsetB)) return null;
  return { offsetA, offsetB };
}

function unresolvedFacesMetadata(start, end, { wallType = "exterior", wallBand = null, page = null, field = "exteriorWalls", thicknessMm = null, thicknessSource = null, reason = "no_opposing_face" } = {}) {
  const mmPerDocumentUnit = page?.calibration?.mmPerDocumentUnit;
  return {
    type: wallType,
    centreline: { start, end },
    faceA: null,
    faceB: null,
    innerFace: null,
    outerFace: null,
    intermediateFaces: [],
    orientation: Math.abs(end.x - start.x) >= Math.abs(end.y - start.y) ? "horizontal" : "vertical",
    thicknessDocUnits: thicknessMm > 0 && mmPerDocumentUnit > 0 ? thicknessMm / mmPerDocumentUnit : null,
    thicknessPx: null,
    thicknessMm: thicknessMm ?? null,
    wallConstructionType: wallBand?.wallConstructionType || page?.[field]?.constructionType || null,
    passedThicknessValidation: false,
    thicknessValidation: wallBand?.thicknessValidation || null,
    constructionLineCount: wallBand?.constructionLineCount || 1,
    source: "manual",
    snapSource: "wall-faces-unresolved",
    sourceSegmentIds: Array.isArray(wallBand?.sourceSegmentIds) ? wallBand.sourceSegmentIds : [],
    confidence: Math.min(0.45, wallBand?.confidence ?? 0.35),
    snapConfidence: Math.min(0.45, wallBand?.confidence ?? 0.35),
    wallFacesUncertain: true,
    geometryStatus: "unresolved_faces",
    resolutionFailure: reason,
    reviewMessage: "Wall faces unresolved",
    thicknessSource,
    physicalBandDiagnostics: wallBand?.diagnostics || wallBand?.physicalBandDiagnostics || null,
  };
}

export function buildBuilderDefinedWallBandMetadata(start, end, { wallBand = null, page = null, field = "exteriorWalls", wallType = "exterior", thicknessMmOverride = null, thicknessSourceOverride = null } = {}) {
  const normal = unitNormal(start, end);
  if (!normal) return null;
  const settings = builderWallSettings(page, field, wallType);
  if (thicknessMmOverride == null && !settings?.thicknessLocked) return null;
  const thicknessMm = Number(thicknessMmOverride ?? settings?.thicknessMm);
  if (!(thicknessMm > 0)) return null;
  const mmPerDocumentUnit = page?.calibration?.mmPerDocumentUnit;
  if (!(mmPerDocumentUnit > 0)) return null;
  const thicknessSource = thicknessSourceOverride || settings?.thicknessSource || "user_override";
  if (!hasDetectedWallBandFaces(wallBand) || wallBand?.snapSource === "builder-defined-wall-band" || wallBand?.faceA?.source === "inferred" || wallBand?.faceB?.source === "inferred") {
    return unresolvedFacesMetadata(start, end, { wallType, wallBand, page, field, thicknessMm, thicknessSource });
  }

  const detectedOffsets = detectedFaceOffsets(wallBand, start, normal, wallType);
  if (!detectedOffsets) {
    return unresolvedFacesMetadata(start, end, { wallType, wallBand, page, field, thicknessMm, thicknessSource });
  }
  const detectedThicknessDocUnits = Math.abs(detectedOffsets.offsetA - detectedOffsets.offsetB);
  const detectedThicknessMm = detectedThicknessDocUnits * mmPerDocumentUnit;
  const toleranceMm = Math.max(8, thicknessMm * 0.12);
  if (Math.abs(detectedThicknessMm - thicknessMm) > toleranceMm) {
    return unresolvedFacesMetadata(start, end, {
      wallType,
      wallBand,
      page,
      field,
      thicknessMm,
      thicknessSource,
      reason: "locked_thickness_mismatch",
    });
  }
  const primaryFaceA = wallType === "exterior" ? (wallBand.innerFace || wallBand.faceA) : wallBand.faceA;
  const primaryFaceB = wallType === "exterior" ? (wallBand.outerFace || wallBand.faceB) : wallBand.faceB;
  const faceConfidence = Math.max(0.72, wallBand?.confidence ?? 0.72);
  const faceA = { ...primaryFaceA, source: primaryFaceA.source || "detected", confidence: primaryFaceA.confidence ?? faceConfidence };
  const faceB = { ...primaryFaceB, source: primaryFaceB.source || "detected", confidence: primaryFaceB.confidence ?? faceConfidence };
  const sourceIds = Array.isArray(wallBand?.sourceSegmentIds) ? wallBand.sourceSegmentIds : [];
  const constructionType = settings?.constructionType || (wallType === "exterior" ? "brick_veneer" : "interior_partition");
  const selectedPathRelation = selectedPathRelationToBand(0, Math.min(detectedOffsets.offsetA, detectedOffsets.offsetB), Math.max(detectedOffsets.offsetA, detectedOffsets.offsetB), Math.max(1.5, detectedThicknessDocUnits * 0.22));
  const confidence = Math.max(0.72, wallBand?.confidence ?? 0.72);
  return {
    type: wallType,
    centreline: { start, end },
    faceA,
    faceB,
    innerFace: wallType === "exterior" ? faceA : null,
    outerFace: wallType === "exterior" ? faceB : null,
    intermediateFaces: Array.isArray(wallBand?.intermediateFaces) ? wallBand.intermediateFaces : [],
    orientation: Math.abs(end.x - start.x) >= Math.abs(end.y - start.y) ? "horizontal" : "vertical",
    thicknessDocUnits: detectedThicknessDocUnits,
    thicknessPx: detectedThicknessDocUnits,
    thicknessMm: detectedThicknessMm,
    wallConstructionType: constructionType,
    passedThicknessValidation: true,
    thicknessValidation: { source: "builder-defined", valid: true },
    constructionLineCount: wallBand?.constructionLineCount || (detectedOffsets ? 2 : 1),
    source: "manual",
    snapSource: wallBand?.source || wallBand?.snapSource || "local-vector-wall-band",
    sourceSegmentIds: sourceIds,
    confidence,
    snapConfidence: confidence,
    geometryStatus: "resolved",
    resolutionFailure: null,
    selectedPathRelation,
    thicknessSource,
    faceASupport: wallBand?.faceASupport || null,
    faceBSupport: wallBand?.faceBSupport || null,
    detectedOpenings: Array.isArray(wallBand?.openings) ? wallBand.openings : [],
    openingSpan: wallBand?.openingSpan || null,
    physicalBandDiagnostics: {
      ...(wallBand?.diagnostics || {}),
      selectedSegment: { start, end },
      chosen: {
        selectedPathRelation,
        faceAOffsetMm: detectedOffsets.offsetA * mmPerDocumentUnit,
        faceBOffsetMm: detectedOffsets.offsetB * mmPerDocumentUnit,
        thicknessMm: detectedThicknessMm,
        thicknessSource,
      },
      builderDefinedThickness: true,
    },
  };
}

// Shared with the wall-chain snapper so corner scoring judges "plausible wall
// thickness after the turn" against exactly the same ranges the band resolver
// uses. Thickness here is always the PERPENDICULAR face separation.
export function wallThicknessRangeDocUnits(page, field = "exteriorWalls") {
  const wallType = field === "exteriorWalls" ? "exterior" : "internal";
  const mmPerDocumentUnit = page?.calibration?.mmPerDocumentUnit;
  if (!(mmPerDocumentUnit > 0)) return null;
  const ranges = physicalThicknessRanges(page, wallType);
  return {
    min: Math.min(...ranges.map((range) => range.min / mmPerDocumentUnit)),
    max: Math.max(...ranges.map((range) => range.max / mmPerDocumentUnit)),
    target: Math.min(...ranges.map((range) => range.target / mmPerDocumentUnit)),
  };
}

// Exposed so callers can apply the identical annotation/furniture/page-border
// rejection rules rather than re-deriving them.
export function isStructuralPlanLine(segment, page = {}) {
  return isStructuralLine(segment, page);
}

function exteriorThicknessRangeDocUnits(page) {
  const mmPerDocumentUnit = page?.calibration?.mmPerDocumentUnit;
  if (mmPerDocumentUnit > 0) {
    const ranges = physicalThicknessRanges(page, "exterior");
    return {
      min: Math.min(...ranges.map((range) => range.min / mmPerDocumentUnit)),
      max: Math.max(...ranges.map((range) => range.max / mmPerDocumentUnit)),
      target: EXTERIOR_TARGET_THICKNESS_MM / mmPerDocumentUnit,
    };
  }
  return { min: EXTERIOR_DEFAULT_MIN_THICKNESS_DOC_UNITS, max: EXTERIOR_DEFAULT_MAX_THICKNESS_DOC_UNITS, target: 18 };
}

function chooseExteriorFaces({ lowFace, highFace, point, seed }) {
  const pointerFixed = point.x * seed.nx + point.y * seed.ny;
  const lowFixed = faceOffset(lowFace, { x: 0, y: 0 }, { nx: seed.nx, ny: seed.ny }) ?? 0;
  const highFixed = faceOffset(highFace, { x: 0, y: 0 }, { nx: seed.nx, ny: seed.ny }) ?? 0;
  if (pointerFixed <= lowFixed) return { outerFace: lowFace, innerFace: highFace };
  if (pointerFixed >= highFixed) return { outerFace: highFace, innerFace: lowFace };
  return { outerFace: lowFace, innerFace: highFace };
}

export function detectExteriorCornerSnap(point, { planGeometryIndex, page, zoomScale = 1, preferredFrom = null } = {}) {
  if (!point || !planGeometryIndex) return null;
  const radius = Math.max(8, 12 / Math.max(zoomScale, 0.01));
  const extensionTolerance = Math.max(12, 20 / Math.max(zoomScale, 0.01));
  const preferredAngle = angleForPoints(preferredFrom, point);
  const lines = rawSegments(planGeometryIndex)
    .filter((segment) => isStructuralLine(segment, page))
    .map(oriented)
    .filter(Boolean)
    .filter((line) => linePointDistance(point, line) <= radius + extensionTolerance);
  const candidates = [];
  for (let i = 0; i < lines.length; i += 1) {
    for (let j = i + 1; j < lines.length; j += 1) {
      const a = lines[i];
      const b = lines[j];
      const diff = angleDiffDeg(a.angle, b.angle);
      if (diff < EXTERIOR_CORNER_ANGLE_MIN_DEG || diff > EXTERIOR_CORNER_ANGLE_MAX_DEG) continue;
      if (preferredAngle != null && Math.min(angleDiffDeg(a.angle, preferredAngle), angleDiffDeg(b.angle, preferredAngle)) > EXTERIOR_DIRECTION_TOLERANCE_DEG) continue;
      const hit = infiniteLineIntersection(a.a, a.b, b.a, b.b);
      if (!hit) continue;
      const d = distance(point, hit);
      if (d > radius) continue;
      const aAlong = alongOn(a, hit);
      const bAlong = alongOn(b, hit);
      if (!lineIncludesAlong(a, aAlong, extensionTolerance) || !lineIncludesAlong(b, bAlong, extensionTolerance)) continue;
      candidates.push({
        type: "intersection",
        point: hit,
        lineIds: [a.id, b.id].filter(Boolean),
        distance: d,
        directions: [
          { angle: a.angle, lineId: a.id || null },
          { angle: b.angle, lineId: b.id || null },
        ],
      });
    }
  }
  return candidates.sort((left, right) => left.distance - right.distance)[0] || null;
}

function groupedAdjacentFaces(lines, maxGap) {
  if (!lines.length) return [];
  const groups = [];
  let current = [lines[0]];
  for (let index = 1; index < lines.length; index += 1) {
    const gap = Math.abs(lines[index].fixed - current[current.length - 1].fixed);
    if (gap <= maxGap) current.push(lines[index]);
    else {
      groups.push(current);
      current = [lines[index]];
    }
  }
  groups.push(current);
  return groups;
}

function bestClusterFromGroup(group, thicknessRange) {
  let best = null;
  for (let startIndex = 0; startIndex < group.length; startIndex += 1) {
    for (let endIndex = startIndex + 1; endIndex < group.length; endIndex += 1) {
      const cluster = group.slice(startIndex, endIndex + 1);
      if (cluster.length < EXTERIOR_CLUSTER_MIN_LINES || cluster.length > EXTERIOR_CLUSTER_MAX_LINES) continue;
      const thickness = cluster[cluster.length - 1].fixed - cluster[0].fixed;
      if (thickness < thicknessRange.min || thickness > thicknessRange.max) continue;
      const score = cluster.length * 10 - Math.abs(thickness - thicknessRange.target);
      if (!best || score > best.score) best = { cluster, score };
    }
  }
  return best?.cluster || null;
}

function detectPhysicalWallCluster(point, { planGeometryIndex, page, zoomScale = 1, preferredFrom = null, wallType = "exterior" } = {}) {
  if (!hasCalibratedScale(page)) return null;
  const searchRadiusDocUnits = Math.max(10, 22 / Math.max(zoomScale, 0.01));
  const preferredAngle = angleForPoints(preferredFrom, point);
  const localScaleHit = typeof planGeometryIndex?.findSnapCandidates === "function" && hasCompleteCalibrationSnapState(page)
    ? scaleToolLineSelection({
      documentPoint: point,
      zoom: zoomScale,
      planGeometryIndex,
      page,
      screenTolerance: 18,
    })
    : null;
  const lines = rawSegments(planGeometryIndex)
    .filter((segment) => isStructuralLine(segment, page))
    .map(oriented)
    .filter(Boolean);
  const localLineIds = new Set([
    localScaleHit?.sourceSegmentId,
    localScaleHit?.snap?.lineId,
    ...(localScaleHit?.snap?.lineIds || []),
  ].filter(Boolean));
  const localStructuralLine = lines.find((line) => localLineIds.has(line.id));
  const localAngle = localStructuralLine?.angle ?? null;
  const seedHits = lines
    .map((line) => ({ line, distance: linePointDistance(point, line) }))
    .filter((hit) => hit.distance <= searchRadiusDocUnits)
    .filter((hit) => preferredAngle == null || angleDiffDeg(hit.line.angle, preferredAngle) <= EXTERIOR_DIRECTION_TOLERANCE_DEG)
    .filter((hit) => localAngle == null || localLineIds.has(hit.line.id) || angleDiffDeg(hit.line.angle, localAngle) <= EXTERIOR_DIRECTION_TOLERANCE_DEG)
    .sort((a, b) => a.distance - b.distance);
  if (!seedHits.length) return null;

  const mmPerDocumentUnit = page?.calibration?.mmPerDocumentUnit;
  const ranges = physicalThicknessRanges(page, wallType === "exterior" ? "exterior" : "internal");
  const thicknessRange = {
    min: Math.min(...ranges.map((range) => range.min / mmPerDocumentUnit)),
    max: Math.max(...ranges.map((range) => range.max / mmPerDocumentUnit)),
    target: Math.min(...ranges.map((range) => range.target / mmPerDocumentUnit)),
  };
  const candidates = [];
  seedHits.slice(0, 12).forEach(({ line: seed, distance: pointerDistance }) => {
    const pointerAlong = point.x * seed.ux + point.y * seed.uy;
    const pointerFixed = point.x * seed.nx + point.y * seed.ny;
    const parallel = lines
      .filter((line) => angleDiffDeg(seed.angle, line.angle) <= EXTERIOR_PARALLEL_TOLERANCE_DEG)
      .filter((line) => Math.abs(line.fixed - seed.fixed) <= thicknessRange.max)
      .filter((line) => Math.min(seed.endAlong, line.endAlong) - Math.max(seed.startAlong, line.startAlong) >= EXTERIOR_MIN_OVERLAP_DOC_UNITS)
      .sort((a, b) => a.fixed - b.fixed);
    const unique = [];
    parallel.forEach((line) => {
      const existing = unique.find((candidate) => Math.abs(candidate.fixed - line.fixed) <= 1.5);
      if (!existing) unique.push(line);
      else if (line.length > existing.length) Object.assign(existing, line);
    });

    const maxAdjacentGap = Math.max(EXTERIOR_MAX_ADJACENT_FACE_GAP_DOC_UNITS, thicknessRange.max);
    groupedAdjacentFaces(unique, maxAdjacentGap).forEach((group) => {
      const cluster = bestClusterFromGroup(group, thicknessRange);
      if (!cluster) return;
        if (cluster.length < EXTERIOR_CLUSTER_MIN_LINES || cluster.length > EXTERIOR_CLUSTER_MAX_LINES) return;
        const minFixed = cluster[0].fixed;
        const maxFixed = cluster[cluster.length - 1].fixed;
        const thickness = maxFixed - minFixed;
        if (thickness < thicknessRange.min || thickness > thicknessRange.max) return;
        const thicknessMm = thicknessMmFromDocUnits(thickness, page);
        const thicknessClass = thicknessMm == null
          ? null
          : classifyThicknessMm(thicknessMm, page, wallType === "exterior" ? "exterior" : "internal");
        if (!thicknessClass) return;
        const bandDistance = pointerFixed < minFixed ? minFixed - pointerFixed : pointerFixed > maxFixed ? pointerFixed - maxFixed : 0;
        if (bandDistance > searchRadiusDocUnits) return;
        const startAlong = Math.max(...cluster.map((line) => line.startAlong));
        const endAlong = Math.min(...cluster.map((line) => line.endAlong));
        if (endAlong - startAlong < EXTERIOR_MIN_OVERLAP_DOC_UNITS) return;
        if (pointerAlong < startAlong - searchRadiusDocUnits || pointerAlong > endAlong + searchRadiusDocUnits) return;

        const centerFixed = (minFixed + maxFixed) / 2;
        const centreline = { start: pointOn(seed, startAlong, centerFixed), end: pointOn(seed, endAlong, centerFixed) };
        const lowFace = { start: pointOn(seed, startAlong, minFixed), end: pointOn(seed, endAlong, minFixed) };
        const highFace = { start: pointOn(seed, startAlong, maxFixed), end: pointOn(seed, endAlong, maxFixed) };
        const { innerFace, outerFace } = wallType === "exterior"
          ? chooseExteriorFaces({ lowFace, highFace, point, seed })
          : { innerFace: null, outerFace: null };
        const faceA = wallType === "exterior" ? innerFace : lowFace;
        const faceB = wallType === "exterior" ? outerFace : highFace;
        const intermediateFaces = cluster.slice(1, -1).map((line) => ({
          start: pointOn(seed, startAlong, line.fixed),
          end: pointOn(seed, endAlong, line.fixed),
          sourceLineId: line.id || null,
        }));
        const targetScore = Math.max(0, 0.24 * thicknessClass.score);
        const lineCountScore = cluster.length >= 3 ? 0.2 : 0.1;
        const distanceScore = Math.max(0, 0.18 - bandDistance / 120);
        const lengthScore = Math.min(0.18, (endAlong - startAlong) / 900);
        const preferredScore = thicknessClass.preferred ? 0.14 : 0;
        const confidence = Math.min(0.98, 0.38 + targetScore + lineCountScore + distanceScore + lengthScore);
        candidates.push({
          point: nearestPointOnSegment(point, centreline.start, centreline.end),
          centreline,
          faceA,
          faceB,
          innerFace,
          outerFace,
          intermediateFaces,
          thicknessDocUnits: thickness,
          thicknessMm,
          wallConstructionType: thicknessClass.type,
          passedThicknessValidation: true,
          thicknessValidation: {
            type: thicknessClass.type,
            preferred: Boolean(thicknessClass.preferred),
            minMm: thicknessClass.min ?? null,
            maxMm: thicknessClass.max ?? null,
            targetMm: thicknessClass.target ?? null,
          },
          sourceSegmentIds: cluster.map((line) => line.id).filter(Boolean),
          confidence,
          source: wallType === "exterior" ? "local-vector-exterior-wall-cluster" : "local-vector-interior-wall-cluster",
          constructionLineCount: cluster.length,
          pointerDistance,
          thicknessScore: thicknessClass.score + preferredScore,
        });
    });
  });

  return candidates.sort((a, b) => (
    b.thicknessScore - a.thicknessScore ||
    b.confidence - a.confidence ||
    b.constructionLineCount - a.constructionLineCount ||
    a.pointerDistance - b.pointerDistance
  ))[0] || null;
}

export function detectManualWallBand(point, { planGeometryIndex, page, zoomScale = 1, wallType = "internal", preferredFrom = null } = {}) {
  if (!point || !planGeometryIndex) return null;
  if (!hasCalibratedScale(page)) return null;
  if (wallType === "exterior") {
    const cluster = detectPhysicalWallCluster(point, { planGeometryIndex, page, zoomScale, preferredFrom, wallType: "exterior" });
    if (cluster) return cluster;
  } else {
    const cluster = detectPhysicalWallCluster(point, { planGeometryIndex, page, zoomScale, preferredFrom, wallType: "internal" });
    if (cluster) return cluster;
  }
  const searchRadiusDocUnits = Math.max(10, 18 / Math.max(zoomScale, 0.01));
  const { wall } = findHighlightableWallAtPoint({
    point,
    planGeometryIndex,
    page,
    searchRadiusDocUnits,
    diagnosticsEnabled: false,
  });
  const centreline = lineForWall(wall);
  if (!centreline?.start || !centreline?.end || !(distance(centreline.start, centreline.end) > 0)) return null;
  const thicknessDocUnits = wall.thickness || wall.thicknessDocUnits || null;
  const thicknessMm = thicknessMmFromDocUnits(thicknessDocUnits, page);
  const thicknessClass = thicknessMm == null
    ? { type: wallType === "exterior" ? "uncalibrated exterior" : "uncalibrated interior", score: 0.55, preferred: false }
    : classifyThicknessMm(thicknessMm, page, wallType === "exterior" ? "exterior" : "internal");
  if (!thicknessClass) return null;
  const snapPoint = nearestPointOnSegment(point, centreline.start, centreline.end);
  return {
    point: snapPoint,
    centreline,
    faceA: wall.faceA || null,
    faceB: wall.faceB || null,
    innerFace: wall.innerFace || null,
    outerFace: wall.outerFace || null,
    intermediateFaces: [],
    thicknessDocUnits,
    thicknessMm,
    wallConstructionType: thicknessClass.type,
    passedThicknessValidation: true,
    thicknessValidation: {
      type: thicknessClass.type,
      preferred: Boolean(thicknessClass.preferred),
      minMm: thicknessClass.min ?? null,
      maxMm: thicknessClass.max ?? null,
      targetMm: thicknessClass.target ?? null,
    },
    sourceSegmentIds: Array.isArray(wall.sourceSegmentIds) ? wall.sourceSegmentIds : [],
    confidence: wall.confidence ?? null,
    source: wall.source || "local-vector-wall-band",
    constructionLineCount: wall.constructionLineCount || 2,
  };
}

function guideFrame(start, end) {
  const normal = unitNormal(start, end);
  if (!normal) return null;
  return {
    ...normal,
    angle: normalizeAngle(Math.atan2(end.y - start.y, end.x - start.x)),
    startAlong: start.x * normal.ux + start.y * normal.uy,
    endAlong: end.x * normal.ux + end.y * normal.uy,
    fixed: ((start.x * normal.nx + start.y * normal.ny) + (end.x * normal.nx + end.y * normal.ny)) / 2,
  };
}

function projectSegmentToGuide(segment, guide) {
  if (!segment?.a || !segment?.b) return null;
  const angle = angleForPoints(segment.a, segment.b);
  if (angle == null || angleDiffDeg(angle, guide.angle) > EXTERIOR_PARALLEL_TOLERANCE_DEG) return null;
  const aAlong = segment.a.x * guide.ux + segment.a.y * guide.uy;
  const bAlong = segment.b.x * guide.ux + segment.b.y * guide.uy;
  const fixedA = segment.a.x * guide.nx + segment.a.y * guide.ny;
  const fixedB = segment.b.x * guide.nx + segment.b.y * guide.ny;
  return {
    id: segment.id || null,
    startAlong: Math.min(aAlong, bAlong),
    endAlong: Math.max(aAlong, bAlong),
    fixed: (fixedA + fixedB) / 2,
    length: distance(segment.a, segment.b),
  };
}

function guidePoint(guide, along, fixed) {
  return { x: guide.ux * along + guide.nx * fixed, y: guide.uy * along + guide.ny * fixed };
}

function uniqueGuideLines(lines) {
  const unique = [];
  lines
    .slice()
    .sort((left, right) => left.fixed - right.fixed || right.length - left.length)
    .forEach((line) => {
      const existing = unique.find((candidate) => Math.abs(candidate.fixed - line.fixed) <= 1.5);
      if (!existing) unique.push(line);
      else if (line.length > existing.length) Object.assign(existing, line);
    });
  return unique;
}

const WALL_BAND_SAMPLE_POSITIONS = [0.2, 0.35, 0.5, 0.65, 0.8];

function selectedPathRelationToBand(guideFixed, minFixed, maxFixed, toleranceDocUnits) {
  if (guideFixed >= minFixed - toleranceDocUnits && guideFixed <= maxFixed + toleranceDocUnits) {
    return Math.abs(guideFixed - minFixed) <= toleranceDocUnits || Math.abs(guideFixed - maxFixed) <= toleranceDocUnits
      ? "touches-face"
      : "inside";
  }
  return "outside";
}

function variance(values) {
  if (!values.length) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return values.reduce((sum, value) => sum + (value - mean) * (value - mean), 0) / values.length;
}

function sampleSupportForLine(line, sampleAlong, toleranceDocUnits) {
  return sampleAlong >= line.startAlong - toleranceDocUnits && sampleAlong <= line.endAlong + toleranceDocUnits;
}

function lineSupportsMiddleRun(line, sampleAlongValues, toleranceDocUnits) {
  const supportedSamples = sampleAlongValues.filter((sampleAlong) => sampleSupportForLine(line, sampleAlong, toleranceDocUnits));
  return {
    count: supportedSamples.length,
    samples: supportedSamples,
  };
}

function clusterFaceOffsets(lines, sampleAlongValues, offsetToleranceDocUnits, sampleToleranceDocUnits) {
  return lines
    .map((line) => ({
      ...line,
      support: lineSupportsMiddleRun(line, sampleAlongValues, sampleToleranceDocUnits),
    }))
    .filter((line) => line.support.count > 0)
    .sort((left, right) => left.fixed - right.fixed || right.support.count - left.support.count)
    .reduce((clusters, line) => {
      const existing = clusters.find((cluster) => Math.abs(cluster.fixed - line.fixed) <= offsetToleranceDocUnits);
      if (!existing) {
        clusters.push({
          fixed: line.fixed,
          lines: [line],
          values: [line.fixed],
          supportSamples: new Set(line.support.samples),
          ids: line.id ? [line.id] : [],
          length: line.length,
          startAlong: line.startAlong,
          endAlong: line.endAlong,
        });
        return clusters;
      }
      existing.lines.push(line);
      existing.values.push(line.fixed);
      existing.fixed = existing.values.reduce((sum, value) => sum + value, 0) / existing.values.length;
      line.support.samples.forEach((sample) => existing.supportSamples.add(sample));
      if (line.id) existing.ids.push(line.id);
      existing.length = Math.max(existing.length, line.length);
      existing.startAlong = Math.min(existing.startAlong, line.startAlong);
      existing.endAlong = Math.max(existing.endAlong, line.endAlong);
      return clusters;
    }, [])
    .map((cluster) => ({
      ...cluster,
      supportCount: cluster.supportSamples.size,
      supportTotal: sampleAlongValues.length,
      variance: variance(cluster.values),
      sourceLineIds: [...new Set(cluster.ids)],
    }))
    .sort((left, right) => left.fixed - right.fixed);
}

function sampleOffsetDiagnostics(faceClusters, sampleAlongValues, guide, mmPerDocumentUnit) {
  return sampleAlongValues.map((sampleAlong, index) => ({
    label: `sample ${index + 1}`,
    position: WALL_BAND_SAMPLE_POSITIONS[index],
    offsetsMm: faceClusters
      .filter((cluster) => cluster.supportSamples?.has(sampleAlong))
      .map((cluster) => Math.round((cluster.fixed - guide.fixed) * mmPerDocumentUnit)),
  }));
}

function resolutionFailureFromRejected(rejected, faceClusters) {
  if (!faceClusters.length) return "no_opposing_face";
  if (rejected.some((entry) => String(entry.reason || "").includes("thickness"))) return "implausible_thickness";
  if (rejected.some((entry) => String(entry.reason || "").includes("support") || String(entry.reason || "").includes("overlap"))) return "insufficient_line_support";
  if (rejected.some((entry) => String(entry.reason || "").includes("outside"))) return "ambiguous_faces";
  return "no_opposing_face";
}

function segmentBandDiagnostics({ start, end, guide, samples, faceClusters = [], mmPerDocumentUnit = 1, best = null, rejected = [] }) {
  return {
    selectedSegment: { start, end },
    selectedPathOffsetDocUnits: guide?.fixed ?? null,
    samplePositions: WALL_BAND_SAMPLE_POSITIONS,
    sampleCount: samples?.length || 0,
    crossSectionOffsets: sampleOffsetDiagnostics(faceClusters, samples || [], guide, mmPerDocumentUnit),
    chosen: best ? {
      outerFaceOffsetMm: best.outerOffsetMm ?? null,
      innerFaceOffsetMm: best.innerOffsetMm ?? null,
      faceAOffsetMm: best.faceAOffsetMm ?? null,
      faceBOffsetMm: best.faceBOffsetMm ?? null,
      thicknessMm: best.thicknessMm ?? null,
      constructionType: best.wallConstructionType || null,
      faceASupport: best.faceASupport || null,
      faceBSupport: best.faceBSupport || null,
      selectedPathRelation: best.selectedPathRelation || null,
    } : null,
    rejectedCandidates: rejected.slice(0, 16),
    unresolvedReason: best ? null : resolutionFailureFromRejected(rejected, faceClusters),
    units: "mm offsets relative to selected topology path",
  };
}

// Openings are stored as 0..1 offsets along the traced segment so rendering
// and opening records do not have to know about the guide frame.
function normaliseOpeningsToSegment(openings, guideStartAlong, guideEndAlong) {
  const span = guideEndAlong - guideStartAlong;
  if (!(span > 0) || !openings?.length) return [];
  return openings
    .map((opening) => {
      const startOffset = Math.max(0, Math.min(1, (opening.start - guideStartAlong) / span));
      const endOffset = Math.max(0, Math.min(1, (opening.end - guideStartAlong) / span));
      if (endOffset - startOffset <= 0.005) return null;
      return {
        startOffset,
        endOffset,
        type: opening.type,
        widthMm: opening.widthMm,
        confidence: opening.confidence,
        reason: opening.reason,
        startJambIds: opening.startJambIds || [],
        endJambIds: opening.endJambIds || [],
      };
    })
    .filter(Boolean);
}

function intervalsForFace(lines, fixed, tolerance) {
  return lines
    .filter((line) => Math.abs(line.fixed - fixed) <= tolerance)
    .map((line) => ({ start: line.startAlong, end: line.endAlong, ids: line.id ? [line.id] : [] }))
    .filter((interval) => interval.end - interval.start > 1)
    .sort((left, right) => left.start - right.start);
}

function mergeTraceIntervals(intervals, bridgeGapDocUnits) {
  if (!intervals.length) return [];
  const merged = [];
  intervals.forEach((interval) => {
    const last = merged[merged.length - 1];
    if (!last || interval.start - last.end > bridgeGapDocUnits) {
      merged.push({ ...interval, ids: [...(interval.ids || [])] });
      return;
    }
    last.end = Math.max(last.end, interval.end);
    last.ids = [...new Set([...(last.ids || []), ...(interval.ids || [])])];
  });
  return merged;
}

function intervalContaining(intervals, along, tolerance) {
  return intervals.find((interval) => along >= interval.start - tolerance && along <= interval.end + tolerance) || null;
}

function overlappingRunAroundSeed(faceAIntervals, faceBIntervals, seedAlong, bridgeGapDocUnits) {
  const candidates = [];
  faceAIntervals.forEach((a) => {
    faceBIntervals.forEach((b) => {
      const start = Math.max(a.start, b.start);
      const end = Math.min(a.end, b.end);
      if (end - start <= 1) return;
      candidates.push({
        start,
        end,
        sourceSegmentIds: [...new Set([...(a.ids || []), ...(b.ids || [])])],
      });
    });
  });
  return candidates
    .filter((candidate) => seedAlong >= candidate.start - bridgeGapDocUnits && seedAlong <= candidate.end + bridgeGapDocUnits)
    .sort((left, right) => (right.end - right.start) - (left.end - left.start))[0] || null;
}

function wallRunKeyFromLine(line) {
  if (!line) return null;
  return `${Math.round(line.angle * 1000)}:${Math.round(line.fixed * 10)}`;
}

function structuralNodeAtBoundary({ guide, boundaryAlong, faceAOffset, faceBOffset, rawLines, toleranceDocUnits }) {
  const minFixed = Math.min(faceAOffset, faceBOffset);
  const maxFixed = Math.max(faceAOffset, faceBOffset);
  const spanTolerance = Math.max(2, toleranceDocUnits);
  const nearBoundary = rawLines.filter((line) => (
    boundaryAlong >= line.startAlong - spanTolerance &&
    boundaryAlong <= line.endAlong + spanTolerance
  ));
  const turning = nearBoundary.filter((line) => Math.abs(line.fixed - minFixed) <= spanTolerance || Math.abs(line.fixed - maxFixed) <= spanTolerance);
  const jambs = rawLines.filter((line) => {
    if (Math.abs(line.midAlong - boundaryAlong) > spanTolerance) return false;
    const low = Math.min(line.minFixed ?? line.fixed, line.maxFixed ?? line.fixed);
    const high = Math.max(line.minFixed ?? line.fixed, line.maxFixed ?? line.fixed);
    return low <= maxFixed + spanTolerance && high >= minFixed - spanTolerance;
  });
  const point = guidePoint(guide, boundaryAlong, guide.fixed);
  const type = jambs.length >= 1
    ? "jamb"
    : turning.length >= 2
      ? "corner"
      : turning.length === 1
        ? "junction"
        : "endpoint";
  return {
    type,
    point,
    along: boundaryAlong,
    evidenceCount: turning.length + jambs.length,
    sourceSegmentIds: [...new Set([...turning, ...jambs].map((line) => line.id).filter(Boolean))],
  };
}

export function detectWallRunFromSeed(point, { planGeometryIndex, page, zoomScale = 1, wallType = "exterior", field = null } = {}) {
  if (!point || !planGeometryIndex || !hasCalibratedScale(page)) {
    return { status: "not_found", reason: "missing_scale_or_geometry" };
  }

  const resolvedField = field || (wallType === "internal" ? "internalWalls" : "exteriorWalls");
  if (wallType === "internal") {
    const graphRun = resolveWallRunFromStructuralGraph(point, {
      planGeometryIndex,
      page,
      zoomScale,
      wallType,
      field: resolvedField,
    });
    if (graphRun?.status === "resolved") {
      return graphRun;
    }
  }

  const seedBand = detectPhysicalWallCluster(point, {
    planGeometryIndex,
    page,
    zoomScale,
    wallType,
  });
  if (!seedBand?.centreline?.start || !seedBand?.centreline?.end || !hasDetectedWallBandFaces(seedBand)) {
    return { status: "not_found", reason: "no_structural_seed" };
  }

  const seedGuide = guideFrame(seedBand.centreline.start, seedBand.centreline.end);
  if (!seedGuide) return { status: "not_found", reason: "no_wall_direction" };

  const mmPerDocumentUnit = page.calibration.mmPerDocumentUnit;
  const maxBridgeMm = wallType === "exterior" ? MAX_BRIDGEABLE_OPENING_MM : 1600;
  const bridgeGapDocUnits = Math.max(12, maxBridgeMm / mmPerDocumentUnit);
  const offsetTolerance = Math.max(1.5, Math.min(4, seedBand.thicknessDocUnits * 0.18));
  const seedAlong = point.x * seedGuide.ux + point.y * seedGuide.uy;
  const rawGuideLines = rawSegments(planGeometryIndex)
    .filter((segment) => isStructuralLine(segment, page))
    .map((segment) => projectSegmentToGuide(segment, seedGuide))
    .filter(Boolean);
  const topologyGuideLines = rawSegments(planGeometryIndex)
    .filter((segment) => isStructuralLine(segment, page))
    .map((segment) => projectRawSegmentToGuide(segment, seedGuide))
    .filter(Boolean);

  const faceAOffset = faceOffset(seedBand.faceA, { x: 0, y: 0 }, { nx: seedGuide.nx, ny: seedGuide.ny });
  const faceBOffset = faceOffset(seedBand.faceB, { x: 0, y: 0 }, { nx: seedGuide.nx, ny: seedGuide.ny });
  if (!Number.isFinite(faceAOffset) || !Number.isFinite(faceBOffset)) {
    return { status: "not_found", reason: "no_opposing_face" };
  }

  const faceAIntervals = mergeTraceIntervals(intervalsForFace(rawGuideLines, faceAOffset, offsetTolerance), bridgeGapDocUnits);
  const faceBIntervals = mergeTraceIntervals(intervalsForFace(rawGuideLines, faceBOffset, offsetTolerance), bridgeGapDocUnits);
  let run = overlappingRunAroundSeed(faceAIntervals, faceBIntervals, seedAlong, bridgeGapDocUnits);
  if (!run) {
    const a = intervalContaining(faceAIntervals, seedAlong, bridgeGapDocUnits);
    const b = intervalContaining(faceBIntervals, seedAlong, bridgeGapDocUnits);
    if (a && b) {
      run = {
        start: Math.max(a.start, b.start),
        end: Math.min(a.end, b.end),
        sourceSegmentIds: [...new Set([...(a.ids || []), ...(b.ids || [])])],
      };
    }
  }
  if (!run || run.end - run.start < EXTERIOR_MIN_OVERLAP_DOC_UNITS) {
    return { status: "not_found", reason: "no_continuous_wall_run" };
  }
  const pageWidth = page?.sourceWidth || page?.width || 0;
  const pageHeight = page?.sourceHeight || page?.height || 0;
  if (pageWidth > 0 && pageHeight > 0) {
    const runLength = run.end - run.start;
    const sheetSpan = Math.max(pageWidth, pageHeight);
    const marginSpan = sheetSpan * 0.05;
    if (runLength > sheetSpan * 0.82 && run.start <= marginSpan && run.end >= sheetSpan - marginSpan) {
      return { status: "not_found", reason: "sheet_border_or_title_block" };
    }
  }

  const start = guidePoint(seedGuide, run.start, seedGuide.fixed);
  const end = guidePoint(seedGuide, run.end, seedGuide.fixed);
  const startNode = structuralNodeAtBoundary({
    guide: seedGuide,
    boundaryAlong: run.start,
    faceAOffset,
    faceBOffset,
    rawLines: topologyGuideLines,
    toleranceDocUnits: offsetTolerance,
  });
  const endNode = structuralNodeAtBoundary({
    guide: seedGuide,
    boundaryAlong: run.end,
    faceAOffset,
    faceBOffset,
    rawLines: topologyGuideLines,
    toleranceDocUnits: offsetTolerance,
  });
  const metadata = buildWallBandSegmentMetadata(start, end, {
    wallBand: {
      ...seedBand,
      centreline: { start, end },
      faceA: { start: guidePoint(seedGuide, run.start, faceAOffset), end: guidePoint(seedGuide, run.end, faceAOffset), source: "detected" },
      faceB: { start: guidePoint(seedGuide, run.start, faceBOffset), end: guidePoint(seedGuide, run.end, faceBOffset), source: "detected" },
      innerFace: wallType === "exterior" && seedBand.innerFace ? { start: guidePoint(seedGuide, run.start, faceAOffset), end: guidePoint(seedGuide, run.end, faceAOffset), source: "detected" } : null,
      outerFace: wallType === "exterior" && seedBand.outerFace ? { start: guidePoint(seedGuide, run.start, faceBOffset), end: guidePoint(seedGuide, run.end, faceBOffset), source: "detected" } : null,
      source: `seeded-${wallType}-wall-run`,
      snapSource: `seeded-${wallType}-wall-run`,
      sourceSegmentIds: [...new Set([...(seedBand.sourceSegmentIds || []), ...(run.sourceSegmentIds || [])])],
      diagnostics: {
        seedPoint: point,
        seedAlong,
        traceRun: { start: run.start, end: run.end },
        startNode,
        endNode,
        faceAIntervals,
        faceBIntervals,
        wallRunKey: wallRunKeyFromLine(seedGuide),
      },
    },
    page,
    field: resolvedField,
    wallType,
    planGeometryIndex,
  });

  if (metadata.geometryStatus !== "resolved" || !hasDetectedWallBandFaces(metadata)) {
    return { status: "not_found", reason: metadata.resolutionFailure || "unresolved_faces", metadata };
  }

  return {
    status: "resolved",
    point: nearestPointOnSegment(point, start, end),
    start,
    end,
    wallType,
    field: resolvedField,
    metadata: {
      ...metadata,
      source: "manual",
      snapSource: `seeded-${wallType}-wall-run`,
      wallRunDetection: {
        mode: "seeded-one-click",
        seedPoint: point,
        startNode,
        endNode,
        sourceSegmentIds: metadata.sourceSegmentIds || [],
      },
    },
  };
}

export function detectExteriorWallRunFromSeed(point, options = {}) {
  return detectWallRunFromSeed(point, { ...options, wallType: "exterior", field: "exteriorWalls" });
}

export function detectManualWallBandForSegment(start, end, { planGeometryIndex, page, wallType = "exterior" } = {}) {
  if (!start || !end || !planGeometryIndex || !hasCalibratedScale(page)) return null;
  const guide = guideFrame(start, end);
  if (!guide) return null;

  const mmPerDocumentUnit = page.calibration.mmPerDocumentUnit;
  const ranges = physicalThicknessRanges(page, wallType === "exterior" ? "exterior" : "internal");
  const thicknessRange = {
    min: Math.min(...ranges.map((range) => range.min / mmPerDocumentUnit)),
    max: Math.max(...ranges.map((range) => range.max / mmPerDocumentUnit)),
    target: ranges
      .map((range) => range.target / mmPerDocumentUnit)
      .sort((left, right) => Math.abs(left - (guide.length / 12)) - Math.abs(right - (guide.length / 12)))[0] || ranges[0].target / mmPerDocumentUnit,
  };
  const guideStartAlong = Math.min(guide.startAlong, guide.endAlong);
  const guideEndAlong = Math.max(guide.startAlong, guide.endAlong);
  const guideLength = guideEndAlong - guideStartAlong;
  const sampleAlongValues = WALL_BAND_SAMPLE_POSITIONS.map((t) => guideStartAlong + guideLength * t);
  const sampleTolerance = Math.max(2, Math.min(6, guideLength * 0.025));
  const offsetClusterTolerance = Math.max(1.2, Math.min(3, thicknessRange.min * 0.18));
  const topologyTolerance = Math.max(1.5, Math.min(4, thicknessRange.min * 0.22));
  const minFaceSupport = Math.max(3, Math.ceil(sampleAlongValues.length * 0.6));
  // Proportional to the traced run rather than a flat floor, so a legitimate
  // short nib beside a front entry is not rejected for being short. Identical
  // to the previous floor for any normal-length wall.
  const minOverlap = Math.min(EXTERIOR_MIN_OVERLAP_DOC_UNITS, Math.max(6, guideLength * 0.38));
  const stripHalfWidth = Math.max(thicknessRange.max + topologyTolerance, 24);
  const rejected = [];

  const candidates = rawSegments(planGeometryIndex)
    .filter((segment) => isStructuralLine(segment, page))
    .map((segment) => projectSegmentToGuide(segment, guide))
    .filter(Boolean)
    .filter((line) => Math.abs(line.fixed - guide.fixed) <= stripHalfWidth);

  const faceClusters = clusterFaceOffsets(candidates, sampleAlongValues, offsetClusterTolerance, sampleTolerance)
    .filter((cluster) => {
      if (cluster.variance > offsetClusterTolerance * offsetClusterTolerance) {
        rejected.push({
          reason: "rejected: inconsistent offset",
          offsetMm: Math.round((cluster.fixed - guide.fixed) * mmPerDocumentUnit),
          support: `${cluster.supportCount}/${cluster.supportTotal}`,
        });
        return false;
      }
      return true;
    });

  // Raw (unfiltered) strokes projected into the guide frame. Jamb returns are
  // short perpendicular ticks that the structural-line filter deliberately
  // discards, so opening detection needs its own unfiltered view.
  const rawGuideLines = rawSegments(planGeometryIndex)
    .map((segment) => projectRawSegmentToGuide(segment, guide))
    .filter(Boolean);

  let best = null;
  // `openingAware` is false for the strict first pass, so a wall band that
  // already resolves today resolves identically. It is only re-run with
  // openings allowed when the strict pass finds nothing.
  let openingAware = false;
  const runPairPass = () => {
  for (let startIndex = 0; startIndex < faceClusters.length; startIndex += 1) {
    for (let endIndex = startIndex + 1; endIndex < faceClusters.length; endIndex += 1) {
      const faceLowCluster = faceClusters[startIndex];
      const faceHighCluster = faceClusters[endIndex];
      const intermediateClusters = faceClusters.slice(startIndex + 1, endIndex);
      const constructionLineCount = intermediateClusters.length + 2;
      if (constructionLineCount < EXTERIOR_CLUSTER_MIN_LINES || constructionLineCount > EXTERIOR_CLUSTER_MAX_LINES) {
        rejected.push({
          reason: "rejected: unsupported construction line count",
          offsetsMm: [faceLowCluster.fixed, faceHighCluster.fixed].map((fixed) => Math.round((fixed - guide.fixed) * mmPerDocumentUnit)),
          constructionLineCount,
        });
        continue;
      }
      const minFixed = faceLowCluster.fixed;
      const maxFixed = faceHighCluster.fixed;
      const thicknessDocUnits = maxFixed - minFixed;
      const thicknessMm = thicknessMmFromDocUnits(thicknessDocUnits, page);
      if (thicknessDocUnits < thicknessRange.min || thicknessDocUnits > thicknessRange.max) {
        rejected.push({
          reason: `rejected: thickness ${Math.round(thicknessMm || thicknessDocUnits)} mm`,
          thicknessMm,
          offsetsMm: [minFixed, maxFixed].map((fixed) => Math.round((fixed - guide.fixed) * mmPerDocumentUnit)),
        });
        continue;
      }
      const selectedPathRelation = selectedPathRelationToBand(guide.fixed, minFixed, maxFixed, topologyTolerance);
      if (selectedPathRelation === "outside") {
        rejected.push({
          reason: "rejected: selected path outside candidate band",
          thicknessMm,
          offsetsMm: [minFixed, maxFixed].map((fixed) => Math.round((fixed - guide.fixed) * mmPerDocumentUnit)),
        });
        continue;
      }
      const thicknessClass = classifyThicknessMm(thicknessMm, page, wallType === "exterior" ? "exterior" : "internal");
      if (!thicknessClass) {
        rejected.push({
          reason: `rejected: thickness ${Math.round(thicknessMm || 0)} mm`,
          thicknessMm,
          offsetsMm: [minFixed, maxFixed].map((fixed) => Math.round((fixed - guide.fixed) * mmPerDocumentUnit)),
        });
        continue;
      }

      // An opening interrupts the wall material but not the wall topology, so
      // samples that land inside a detected opening are excused rather than
      // counted as missing wall face. Opening width here is measured ALONG the
      // wall and is never compared with the perpendicular thickness above.
      const pairOpenings = detectOpeningIntervals({
        guideLines: candidates,
        rawGuideLines,
        faceLowFixed: minFixed,
        faceHighFixed: maxFixed,
        spanStart: guideStartAlong,
        spanEnd: guideEndAlong,
        faceTolerance: offsetClusterTolerance,
        mmPerDocumentUnit,
        requireBothJambs: !openingAware,
      });
      // Openings are *recorded* in both passes, but only the opening-aware
      // pass lets them relax the accept/reject thresholds — so the strict
      // pass reaches exactly the same verdict it did before.
      const inOpening = (along) => pairOpenings.some((opening) => along >= opening.start && along <= opening.end);
      const excusedSamples = openingAware ? sampleAlongValues.filter(inOpening).length : 0;
      const openingSpanLength = openingAware
        ? pairOpenings.reduce(
          (sum, opening) => sum + (Math.min(opening.end, guideEndAlong) - Math.max(opening.start, guideStartAlong)),
          0,
        )
        : 0;
      const requiredSupport = Math.max(1, minFaceSupport - excusedSamples);

      if (faceLowCluster.supportCount < requiredSupport || faceHighCluster.supportCount < requiredSupport) {
        rejected.push({
          reason: "rejected: insufficient sample support",
          thicknessMm,
          faceASupport: `${faceHighCluster.supportCount}/${sampleAlongValues.length}`,
          faceBSupport: `${faceLowCluster.supportCount}/${sampleAlongValues.length}`,
        });
        continue;
      }

      const overlapStart = Math.max(guideStartAlong, faceLowCluster.startAlong, faceHighCluster.startAlong);
      const overlapEnd = Math.min(guideEndAlong, faceLowCluster.endAlong, faceHighCluster.endAlong);
      const overlap = Math.max(0, overlapEnd - overlapStart);
      const requiredOverlap = Math.max(8, minOverlap - openingSpanLength);
      if (overlap < requiredOverlap) {
        rejected.push({
          reason: "rejected: insufficient overlap",
          thicknessMm,
          overlap,
          requiredOverlap,
        });
        continue;
      }

      const thicknessScore = thicknessClass.score - Math.abs(thicknessDocUnits - thicknessRange.target) / Math.max(thicknessRange.target, 1) * 0.15;
      const overlapScore = Math.min(0.28, overlap / Math.max(guideLength, 1) * 0.28);
      const supportScore = ((faceLowCluster.supportCount + faceHighCluster.supportCount) / (sampleAlongValues.length * 2)) * 0.28;
      const relationScore = selectedPathRelation === "inside" ? 0.18 : 0.14;
      const lineCountScore = constructionLineCount >= 3 ? 0.16 : 0.09;
      const variancePenalty = (faceLowCluster.variance + faceHighCluster.variance) / Math.max(offsetClusterTolerance * offsetClusterTolerance * 2, 1) * 0.08;
      const score = thicknessScore + overlapScore + supportScore + relationScore + lineCountScore - variancePenalty;
      if (!best || score > best.score) {
        const faceLow = { start: guidePoint(guide, guideStartAlong, minFixed), end: guidePoint(guide, guideEndAlong, minFixed) };
        const faceHigh = { start: guidePoint(guide, guideStartAlong, maxFixed), end: guidePoint(guide, guideEndAlong, maxFixed) };
        const faceA = wallType === "exterior" ? faceHigh : faceLow;
        const faceB = wallType === "exterior" ? faceLow : faceHigh;
        const faceAOffsetMm = Math.round((faceOffset(faceA, start, unitNormal(start, end)) || 0) * mmPerDocumentUnit);
        const faceBOffsetMm = Math.round((faceOffset(faceB, start, unitNormal(start, end)) || 0) * mmPerDocumentUnit);
        best = {
          score,
          centreline: { start, end },
          faceA,
          faceB,
          innerFace: wallType === "exterior" ? faceHigh : null,
          outerFace: wallType === "exterior" ? faceLow : null,
          intermediateFaces: intermediateClusters.map((cluster) => ({
            start: guidePoint(guide, guideStartAlong, cluster.fixed),
            end: guidePoint(guide, guideEndAlong, cluster.fixed),
            sourceLineId: cluster.sourceLineIds[0] || null,
            support: `${cluster.supportCount}/${sampleAlongValues.length}`,
          })),
          thicknessDocUnits,
          thicknessMm,
          wallConstructionType: thicknessClass.type,
          passedThicknessValidation: true,
          thicknessValidation: {
            type: thicknessClass.type,
            preferred: Boolean(thicknessClass.preferred),
            minMm: thicknessClass.min ?? null,
            maxMm: thicknessClass.max ?? null,
            targetMm: thicknessClass.target ?? null,
          },
          sourceSegmentIds: [
            ...faceLowCluster.sourceLineIds,
            ...intermediateClusters.flatMap((cluster) => cluster.sourceLineIds),
            ...faceHighCluster.sourceLineIds,
          ].filter(Boolean),
          confidence: Math.min(0.97, 0.36 + overlapScore + supportScore + relationScore + lineCountScore + Math.max(0, thicknessClass.score) * 0.14),
          source: wallType === "exterior" ? "segment-guided-exterior-wall-band" : "segment-guided-interior-wall-band",
          constructionLineCount,
          selectedPathRelation,
          faceASupport: `${faceHighCluster.supportCount}/${sampleAlongValues.length}`,
          faceBSupport: `${faceLowCluster.supportCount}/${sampleAlongValues.length}`,
          faceAOffsetMm,
          faceBOffsetMm,
          innerOffsetMm: wallType === "exterior" ? Math.round((maxFixed - guide.fixed) * mmPerDocumentUnit) : null,
          outerOffsetMm: wallType === "exterior" ? Math.round((minFixed - guide.fixed) * mmPerDocumentUnit) : null,
          openings: normaliseOpeningsToSegment(pairOpenings, guideStartAlong, guideEndAlong),
          diagnostics: null,
        };
      }
    }
  }
  };

  runPairPass();

  // ---- Opening-aware pass ---------------------------------------------------
  // Only reached when the strict pass resolved nothing, so bands that already
  // work are returned unchanged (they never enter this branch).
  if (!best) {
    openingAware = true;
    runPairPass();
  }

  // The jamb-to-jamb case: the whole traced span is the opening, so there is
  // no wall material anywhere along it and no face cluster could ever support
  // a sample. The faces are recovered from the wall that continues beyond both
  // jambs.
  if (!best) {
    const openingSpan = detectOpeningSpan({
      guideLines: rawSegments(planGeometryIndex)
        .filter((segment) => isStructuralLine(segment, page))
        .map((segment) => projectSegmentToGuide(segment, guide))
        .filter(Boolean)
        .filter((line) => Math.abs(line.fixed - guide.fixed) <= stripHalfWidth),
      rawGuideLines,
      spanStart: guideStartAlong,
      spanEnd: guideEndAlong,
      thicknessRange,
      mmPerDocumentUnit,
      faceTolerance: offsetClusterTolerance,
    });
    if (openingSpan) {
      const minFixed = openingSpan.faceLowFixed;
      const maxFixed = openingSpan.faceHighFixed;
      const faceLow = { start: guidePoint(guide, guideStartAlong, minFixed), end: guidePoint(guide, guideEndAlong, minFixed) };
      const faceHigh = { start: guidePoint(guide, guideStartAlong, maxFixed), end: guidePoint(guide, guideEndAlong, maxFixed) };
      const faceA = wallType === "exterior" ? faceHigh : faceLow;
      const faceB = wallType === "exterior" ? faceLow : faceHigh;
      const thicknessClass = classifyThicknessMm(
        thicknessMmFromDocUnits(openingSpan.thicknessDocUnits, page),
        page,
        wallType === "exterior" ? "exterior" : "internal",
      );
      best = {
        score: openingSpan.confidence,
        centreline: { start, end },
        faceA,
        faceB,
        innerFace: wallType === "exterior" ? faceHigh : null,
        outerFace: wallType === "exterior" ? faceLow : null,
        intermediateFaces: [],
        thicknessDocUnits: openingSpan.thicknessDocUnits,
        thicknessMm: thicknessMmFromDocUnits(openingSpan.thicknessDocUnits, page),
        wallConstructionType: thicknessClass?.type || null,
        passedThicknessValidation: Boolean(thicknessClass),
        thicknessValidation: thicknessClass
          ? {
            type: thicknessClass.type,
            preferred: Boolean(thicknessClass.preferred),
            minMm: thicknessClass.min ?? null,
            maxMm: thicknessClass.max ?? null,
            targetMm: thicknessClass.target ?? null,
          }
          : null,
        sourceSegmentIds: openingSpan.sourceLineIds,
        confidence: openingSpan.confidence,
        source: wallType === "exterior" ? "segment-guided-exterior-wall-band" : "segment-guided-interior-wall-band",
        constructionLineCount: 2,
        selectedPathRelation: selectedPathRelationToBand(guide.fixed, minFixed, maxFixed, topologyTolerance),
        faceASupport: "opening-span",
        faceBSupport: "opening-span",
        faceAOffsetMm: Math.round((faceOffset(faceA, start, unitNormal(start, end)) || 0) * mmPerDocumentUnit),
        faceBOffsetMm: Math.round((faceOffset(faceB, start, unitNormal(start, end)) || 0) * mmPerDocumentUnit),
        innerOffsetMm: wallType === "exterior" ? Math.round((maxFixed - guide.fixed) * mmPerDocumentUnit) : null,
        outerOffsetMm: wallType === "exterior" ? Math.round((minFixed - guide.fixed) * mmPerDocumentUnit) : null,
        // The entire segment is the opening: topology continues jamb to jamb,
        // but no green wall material is rendered across it.
        openings: [{
          startOffset: 0,
          endOffset: 1,
          type: openingSpan.type,
          widthMm: openingSpan.widthMm,
          confidence: openingSpan.confidence,
          reason: openingSpan.reason,
          startJambIds: openingSpan.startJambIds,
          endJambIds: openingSpan.endJambIds,
        }],
        openingSpan: {
          type: openingSpan.type,
          widthMm: openingSpan.widthMm,
          reason: openingSpan.reason,
          spansWholeSegment: true,
        },
        diagnostics: null,
      };
    }
  }

  if (best) {
    best.geometryStatus = "resolved";
    best.resolutionFailure = null;
    best.diagnostics = segmentBandDiagnostics({ start, end, guide, samples: sampleAlongValues, faceClusters, mmPerDocumentUnit, best, rejected });
    return best;
  }
  return {
    geometryStatus: "unresolved",
    resolutionFailure: resolutionFailureFromRejected(rejected, faceClusters),
    centreline: { start, end },
    faceA: null,
    faceB: null,
    innerFace: null,
    outerFace: null,
    intermediateFaces: [],
    thicknessDocUnits: null,
    thicknessMm: null,
    wallConstructionType: null,
    passedThicknessValidation: false,
    source: wallType === "exterior" ? "segment-guided-exterior-wall-band" : "segment-guided-interior-wall-band",
    confidence: 0,
    diagnostics: segmentBandDiagnostics({ start, end, guide, samples: sampleAlongValues, faceClusters, mmPerDocumentUnit, rejected }),
  };
}

export function hasDetectedWallBandFaces(wallBand) {
  return Boolean(
    wallBand?.faceA?.start &&
    wallBand?.faceA?.end &&
    wallBand?.faceB?.start &&
    wallBand?.faceB?.end
  );
}

export function buildWallBandSegmentMetadata(start, end, { wallBand = null, page = null, field = "exteriorWalls", wallType = "exterior", planGeometryIndex = null } = {}) {
  const normal = unitNormal(start, end);
  if (!normal) return {};
  const resolvedWallBand = hasDetectedWallBandFaces(wallBand)
    ? wallBand
    : detectManualWallBandForSegment(start, end, { planGeometryIndex, page, wallType });

  const builderDefined = buildBuilderDefinedWallBandMetadata(start, end, { wallBand: resolvedWallBand, page, field, wallType });
  if (builderDefined) return builderDefined;

  const primaryFaceA = wallType === "exterior" ? (resolvedWallBand?.innerFace || resolvedWallBand?.faceA) : resolvedWallBand?.faceA;
  const primaryFaceB = wallType === "exterior" ? (resolvedWallBand?.outerFace || resolvedWallBand?.faceB) : resolvedWallBand?.faceB;
  let offsetA = faceOffset(primaryFaceA, start, normal);
  let offsetB = faceOffset(primaryFaceB, start, normal);
  let thicknessDocUnits = Math.abs(Number(offsetA) - Number(offsetB));
  const hasDetectedFaces = Number.isFinite(offsetA) && Number.isFinite(offsetB) && thicknessDocUnits >= MIN_RENDER_THICKNESS_DOC_UNITS;

  if (!hasDetectedFaces) {
    thicknessDocUnits = resolvedWallBand?.thicknessDocUnits || wallBand?.thicknessDocUnits || defaultThicknessDocUnits(page, field);
    const mmPerDocumentUnit = page?.calibration?.mmPerDocumentUnit;
    return {
      type: wallType,
      centreline: { start, end },
      faceA: null,
      faceB: null,
      innerFace: null,
      outerFace: null,
      intermediateFaces: [],
      orientation: Math.abs(end.x - start.x) >= Math.abs(end.y - start.y) ? "horizontal" : "vertical",
      thicknessDocUnits,
      thicknessPx: null,
      thicknessMm: mmPerDocumentUnit > 0 ? thicknessDocUnits * mmPerDocumentUnit : null,
      wallConstructionType: resolvedWallBand?.wallConstructionType || wallBand?.wallConstructionType || null,
      passedThicknessValidation: false,
      thicknessValidation: resolvedWallBand?.thicknessValidation || wallBand?.thicknessValidation || null,
      constructionLineCount: 1,
      source: "manual",
      snapSource: "wall-faces-uncertain",
      sourceSegmentIds: resolvedWallBand?.sourceSegmentIds || wallBand?.sourceSegmentIds || [],
      confidence: Math.min(0.45, resolvedWallBand?.confidence ?? wallBand?.confidence ?? 0.35),
      snapConfidence: Math.min(0.45, resolvedWallBand?.confidence ?? wallBand?.confidence ?? 0.35),
      wallFacesUncertain: true,
      geometryStatus: "unresolved",
      resolutionFailure: resolvedWallBand?.resolutionFailure || "no_opposing_face",
      reviewMessage: "Thickness unresolved",
      physicalBandDiagnostics: resolvedWallBand?.diagnostics || wallBand?.diagnostics || null,
    };
  }

  const faceA = { start: offsetPoint(start, normal, offsetA), end: offsetPoint(end, normal, offsetA) };
  const faceB = { start: offsetPoint(start, normal, offsetB), end: offsetPoint(end, normal, offsetB) };
  const mmPerDocumentUnit = page?.calibration?.mmPerDocumentUnit;
  const thicknessMm = mmPerDocumentUnit > 0 ? thicknessDocUnits * mmPerDocumentUnit : null;

  return {
    type: wallType,
    centreline: { start, end },
    faceA,
    faceB,
    innerFace: wallType === "exterior" ? faceA : null,
    outerFace: wallType === "exterior" ? faceB : null,
    intermediateFaces: Array.isArray(resolvedWallBand?.intermediateFaces) ? resolvedWallBand.intermediateFaces : [],
    orientation: Math.abs(end.x - start.x) >= Math.abs(end.y - start.y) ? "horizontal" : "vertical",
    thicknessDocUnits,
    thicknessPx: thicknessDocUnits,
    thicknessMm,
    wallConstructionType: resolvedWallBand?.wallConstructionType || null,
    passedThicknessValidation: Boolean(resolvedWallBand?.passedThicknessValidation),
    thicknessValidation: resolvedWallBand?.thicknessValidation || null,
    constructionLineCount: resolvedWallBand?.constructionLineCount || (hasDetectedFaces ? 2 : 1),
    source: "manual",
    snapSource: resolvedWallBand?.source || (hasDetectedFaces ? "local-vector-wall-band" : "inferred-wall-band"),
    sourceSegmentIds: resolvedWallBand?.sourceSegmentIds || [],
    confidence: resolvedWallBand?.confidence ?? (hasDetectedFaces ? 0.82 : 0.45),
    snapConfidence: resolvedWallBand?.confidence ?? (hasDetectedFaces ? 0.82 : 0.45),
    thicknessSource: "detected",
    geometryStatus: "resolved",
    resolutionFailure: null,
    selectedPathRelation: resolvedWallBand?.selectedPathRelation || null,
    faceASupport: resolvedWallBand?.faceASupport || null,
    faceBSupport: resolvedWallBand?.faceBSupport || null,
    // Openings interrupt the green wall material without breaking topology.
    detectedOpenings: Array.isArray(resolvedWallBand?.openings) ? resolvedWallBand.openings : [],
    openingSpan: resolvedWallBand?.openingSpan || null,
    physicalBandDiagnostics: resolvedWallBand?.diagnostics || wallBand?.diagnostics || null,
  };
}
