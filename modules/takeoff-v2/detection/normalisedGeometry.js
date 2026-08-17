import { generateId } from "../types.js";
import { distance, polygonAreaDocUnits2 } from "../takeoff/geometry.js";

export const TAKEOFF_DETECTION_SCHEMA_VERSION = 1;

export function confidenceToNumber(value, fallback = null) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.min(1, value));
  const label = String(value || "").toLowerCase();
  if (label === "high") return 0.9;
  if (label === "medium") return 0.65;
  if (label === "low") return 0.35;
  return fallback;
}

export function createNormalisedWall({
  id,
  type = "unknown",
  start,
  end,
  thicknessMm = null,
  innerFace = null,
  outerFace = null,
  source = "unknown",
  confidence = null,
  openings = [],
  providerGeometry = null,
  metadata = {},
} = {}) {
  if (!start || !end) return null;
  return {
    id: id || generateId("wall"),
    type: ["exterior", "interior", "unknown"].includes(type) ? type : "unknown",
    start: point(start),
    end: point(end),
    lengthDocUnits: distance(point(start), point(end)),
    thicknessMm: finiteOrNull(thicknessMm),
    innerFace,
    outerFace,
    source,
    confidence: confidenceToNumber(confidence, confidence),
    openings: Array.isArray(openings) ? openings : [],
    providerGeometry,
    metadata,
  };
}

export function createNormalisedOpening({
  id,
  wallId = null,
  type = "opening",
  startOffset = null,
  endOffset = null,
  widthMm = null,
  source = "unknown",
  confidence = null,
  start = null,
  end = null,
  providerGeometry = null,
  metadata = {},
} = {}) {
  return {
    id: id || generateId("opening"),
    wallId,
    type,
    startOffset: finiteOrNull(startOffset),
    endOffset: finiteOrNull(endOffset),
    widthMm: finiteOrNull(widthMm),
    source,
    confidence: confidenceToNumber(confidence, confidence),
    start: start ? point(start) : null,
    end: end ? point(end) : null,
    providerGeometry,
    metadata,
  };
}

export function createNormalisedSpace({
  id,
  name = "",
  polygon = [],
  areaM2 = null,
  source = "unknown",
  confidence = null,
  providerGeometry = null,
  metadata = {},
} = {}) {
  const points = Array.isArray(polygon) ? polygon.map(point).filter(Boolean) : [];
  if (points.length < 3) return null;
  return {
    id: id || generateId("space"),
    name: String(name || "").trim(),
    polygon: points,
    areaM2: finiteOrNull(areaM2),
    areaDocUnits2: Math.abs(polygonAreaDocUnits2(points)),
    source,
    confidence: confidenceToNumber(confidence, confidence),
    providerGeometry,
    metadata,
  };
}

function point(value) {
  if (Array.isArray(value)) return { x: Number(value[0]) || 0, y: Number(value[1]) || 0 };
  if (value && typeof value === "object") return { x: Number(value.x) || 0, y: Number(value.y) || 0 };
  return null;
}

function finiteOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
