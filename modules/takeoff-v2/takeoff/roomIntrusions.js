import { distance, polygonAreaDocUnits2 } from "./geometry.js";

const DEFAULT_VERTEX_TOLERANCE = 2;
const DEFAULT_MIN_AREA_DOC_UNITS2 = 4;

export function findBoundaryConnectedIntrusions(room = {}, candidates = [], options = {}) {
  const boundary = room.outerBoundary || room.vertices || [];
  if (!Array.isArray(boundary) || boundary.length < 3) return [];
  const tolerance = options.vertexTolerance ?? DEFAULT_VERTEX_TOLERANCE;
  const minArea = options.minAreaDocUnits2 ?? DEFAULT_MIN_AREA_DOC_UNITS2;

  return candidates
    .map((candidate) => normalizeIntrusionCandidate(candidate))
    .filter(Boolean)
    .filter((candidate) => candidate.vertices.length >= 3)
    .filter((candidate) => Math.abs(polygonAreaDocUnits2(candidate.vertices)) >= minArea)
    .map((candidate) => {
      const contacts = candidate.vertices.filter((point) => isPointOnBoundary(point, boundary, tolerance));
      const areaDocUnits2 = Math.abs(polygonAreaDocUnits2(candidate.vertices));
      const excludedAreaM2 = options.mmPerDocumentUnit > 0 ? (areaDocUnits2 * options.mmPerDocumentUnit * options.mmPerDocumentUnit) / 1_000_000 : null;
      return {
        ...candidate,
        excludedAreaDocUnits2: areaDocUnits2,
        excludedAreaM2,
        boundaryContactCount: contacts.length,
        boundaryContacts: contacts,
        confidence: candidate.confidence ?? confidenceForIntrusion(candidate, contacts, boundary),
      };
    })
    .filter((candidate) => candidate.boundaryContactCount >= 2)
    .sort((left, right) => right.confidence - left.confidence);
}

export function applyRoomIntrusionPolicy(room = {}, intrusionCandidates = [], options = {}) {
  const detected = findBoundaryConnectedIntrusions(room, intrusionCandidates, options);
  const existingHoles = Array.isArray(room.holes) ? room.holes : [];
  const byId = new Map(existingHoles.map((hole) => [hole.id, hole]));
  const holes = [...existingHoles];

  detected.forEach((intrusion) => {
    const existing = byId.get(intrusion.id);
    if (existing?.included === true || existing?.excluded === false) return;
    if (existing) {
      const index = holes.findIndex((hole) => hole.id === intrusion.id);
      holes[index] = { ...existing, ...intrusion, excluded: true, included: false, overrideable: true };
    } else {
      holes.push({ ...intrusion, excluded: true, included: false, overrideable: true, source: intrusion.source || "wall-boundary-intrusion" });
    }
  });

  return {
    ...recomputeRoomNetArea({ ...room, holes }),
    intrusionReview: detected.length ? "Boundary intrusions detected - review include/exclude choices" : room.intrusionReview || null,
  };
}

export function setRoomIntrusionIncluded(room = {}, intrusionId, included) {
  return recomputeRoomNetArea({
    ...room,
    holes: (room.holes || []).map((hole) => (
      hole.id === intrusionId
        ? { ...hole, included: Boolean(included), excluded: !included, source: "manual-override" }
        : hole
    )),
  });
}

export function recomputeRoomNetArea(room = {}) {
  const holes = Array.isArray(room.holes) ? room.holes : [];
  const grossAreaM2 = room.grossAreaM2 ?? room.calculatedAreaM2 ?? room.confirmedAreaM2 ?? null;
  const excludedAreaM2 = holes
    .filter((hole) => hole.included === false || hole.excluded === true)
    .reduce((total, hole) => total + (Number(hole.excludedAreaM2) || 0), 0);
  return {
    ...room,
    holes,
    grossAreaM2,
    excludedAreaM2,
    netAreaM2: grossAreaM2 != null ? Math.max(0, grossAreaM2 - excludedAreaM2) : room.netAreaM2 ?? null,
    calculatedAreaM2: grossAreaM2 != null ? Math.max(0, grossAreaM2 - excludedAreaM2) : room.calculatedAreaM2 ?? null,
  };
}

function normalizeIntrusionCandidate(candidate) {
  const vertices = candidate?.vertices || candidate?.polygon || candidate?.outerBoundary || [];
  if (!Array.isArray(vertices) || vertices.length < 3) return null;
  return {
    id: candidate.id || `intrusion-${vertices.map((point) => `${Math.round(point.x)}-${Math.round(point.y)}`).join("-")}`,
    label: candidate.label || candidate.name || "Intrusion",
    intrusionType: candidate.intrusionType || candidate.type || "custom",
    vertices: vertices.map((point) => ({ x: point.x, y: point.y })),
    source: candidate.source || "ai",
    confidence: candidate.confidence ?? null,
  };
}

function isPointOnBoundary(point, boundary, tolerance) {
  return boundary.some((start, index) => distancePointToSegment(point, start, boundary[(index + 1) % boundary.length]) <= tolerance);
}

function confidenceForIntrusion(candidate, contacts, boundary) {
  const area = Math.abs(polygonAreaDocUnits2(candidate.vertices));
  const boundaryArea = Math.max(1, Math.abs(polygonAreaDocUnits2(boundary)));
  const contactScore = Math.min(0.36, contacts.length * 0.12);
  const sizeRatio = area / boundaryArea;
  const sizeScore = sizeRatio > 0.001 && sizeRatio < 0.25 ? 0.26 : 0.08;
  const typeScore = /robe|nib|column|bulkhead|recess|stair|service/i.test(candidate.intrusionType || candidate.label || "") ? 0.22 : 0.12;
  return Math.min(0.95, 0.18 + contactScore + sizeScore + typeScore);
}

function distancePointToSegment(point, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (!(len2 > 0)) return distance(point, a);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * abx + (point.y - a.y) * aby) / len2));
  return distance(point, { x: a.x + abx * t, y: a.y + aby * t });
}
