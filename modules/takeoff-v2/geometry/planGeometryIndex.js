// Uniform-grid spatial index over a page's extracted plan-line segments (from
// vector extraction or the raster fallback). No external dependency (no
// rbush/etc.) — a simple grid bucket is enough for typical plan segment
// counts and keeps pointer-move snapping responsive.
//
// Exposes the exact SnapCandidate union from the spec:
//   { type: "line" | "endpoint" | "intersection", point, lineId|lineIds, distance }
// ranked intersection > endpoint > nearest-point-on-line, so callers can just
// take candidates[0] as "the" snap target.

import { segmentIntersection } from "../takeoff/geometry.js";

const DEFAULT_CELL_SIZE = 50; // doc units (PDF points)
const PRIORITY = { intersection: 0, endpoint: 1, line: 2 };
const REJECTED_SEGMENT_TAGS = new Set(["annotation", "dimension", "dimension-line", "extension-line", "text", "text-bound", "door-arc", "symbol", "page-border", "title-block", "title-block-rule"]);

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function nearestPointOnSegment(point, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lengthSquared = abx * abx + aby * aby;
  if (lengthSquared === 0) return { x: a.x, y: a.y };
  let t = ((point.x - a.x) * abx + (point.y - a.y) * aby) / lengthSquared;
  t = Math.max(0, Math.min(1, t));
  return { x: a.x + t * abx, y: a.y + t * aby };
}

function cellKey(cx, cy) {
  return `${cx}:${cy}`;
}

function segmentTag(segment) {
  return String(segment?.geometryType || segment?.objectType || segment?.role || segment?.type || segment?.classification || "").toLowerCase();
}

function isLikelyPageBorder(segment, pageWidth, pageHeight) {
  if (!(pageWidth > 0) || !(pageHeight > 0) || !segment?.a || !segment?.b) return false;
  const minX = Math.min(segment.a.x, segment.b.x);
  const maxX = Math.max(segment.a.x, segment.b.x);
  const minY = Math.min(segment.a.y, segment.b.y);
  const maxY = Math.max(segment.a.y, segment.b.y);
  const marginX = pageWidth * 0.025;
  const marginY = pageHeight * 0.025;
  return (
    (maxX - minX > pageWidth * 0.82 && (minY <= marginY || maxY >= pageHeight - marginY)) ||
    (maxY - minY > pageHeight * 0.82 && (minX <= marginX || maxX >= pageWidth - marginX))
  );
}

function isSnapEligibleSegment(segment, pageWidth, pageHeight) {
  if (!segment?.a || !segment?.b) return false;
  if (segment.isText || segment.isDimension || segment.isPageBorder || segment.isTitleBlock || segment.isDoorArc || segment.isSymbol) return false;
  if (REJECTED_SEGMENT_TAGS.has(segmentTag(segment))) return false;
  if (isLikelyPageBorder(segment, pageWidth, pageHeight)) return false;
  return true;
}

export function buildPlanGeometryIndex(segments = [], { cellSize = DEFAULT_CELL_SIZE, pageWidth = 0, pageHeight = 0 } = {}) {
  const snapSegments = segments.filter((segment) => isSnapEligibleSegment(segment, pageWidth, pageHeight));
  const grid = new Map();
  const cellsFor = (seg) => {
    const minX = Math.min(seg.a.x, seg.b.x);
    const maxX = Math.max(seg.a.x, seg.b.x);
    const minY = Math.min(seg.a.y, seg.b.y);
    const maxY = Math.max(seg.a.y, seg.b.y);
    const cells = [];
    for (let cx = Math.floor(minX / cellSize); cx <= Math.floor(maxX / cellSize); cx += 1) {
      for (let cy = Math.floor(minY / cellSize); cy <= Math.floor(maxY / cellSize); cy += 1) {
        cells.push([cx, cy]);
      }
    }
    return cells;
  };

  snapSegments.forEach((seg) => {
    cellsFor(seg).forEach(([cx, cy]) => {
      const key = cellKey(cx, cy);
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(seg);
    });
  });

  const endpoints = [];
  snapSegments.forEach((seg) => {
    endpoints.push({ point: seg.a, lineId: seg.id });
    endpoints.push({ point: seg.b, lineId: seg.id });
  });

  // Intersections: only test segment pairs that share (or neighbor) a grid
  // cell, not a full O(n^2) pass, so this stays responsive on larger plans.
  const intersections = [];
  const seenPairs = new Set();
  const seenPoints = new Set();
  snapSegments.forEach((segA) => {
    const nearby = new Set();
    cellsFor(segA).forEach(([cx, cy]) => {
      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dy = -1; dy <= 1; dy += 1) {
          (grid.get(cellKey(cx + dx, cy + dy)) || []).forEach((segB) => nearby.add(segB));
        }
      }
    });
    nearby.forEach((segB) => {
      if (segB.id === segA.id) return;
      const pairKey = [segA.id, segB.id].sort().join("|");
      if (seenPairs.has(pairKey)) return;
      seenPairs.add(pairKey);
      const hit = segmentIntersection(segA.a, segA.b, segB.a, segB.b);
      if (!hit) return;
      const pointKey = `${hit.x.toFixed(3)},${hit.y.toFixed(3)}`;
      if (seenPoints.has(pointKey)) return;
      seenPoints.add(pointKey);
      intersections.push({ point: hit, lineIds: [segA.id, segB.id] });
    });
  });

  function segmentsNear(point, radius) {
    const results = new Set();
    for (let cx = Math.floor((point.x - radius) / cellSize); cx <= Math.floor((point.x + radius) / cellSize); cx += 1) {
      for (let cy = Math.floor((point.y - radius) / cellSize); cy <= Math.floor((point.y + radius) / cellSize); cy += 1) {
        (grid.get(cellKey(cx, cy)) || []).forEach((seg) => results.add(seg));
      }
    }
    return results;
  }

  // Returns all candidates within tolerance, ranked intersection > endpoint >
  // nearest-point-on-line, then by distance. Empty array means "no valid
  // snap target" — callers decide whether to fall back to manual placement.
  function findSnapCandidates(point, toleranceDocUnits) {
    const candidates = [];

    intersections.forEach(({ point: p, lineIds }) => {
      const d = distance(p, point);
      if (d <= toleranceDocUnits) candidates.push({ type: "intersection", point: p, lineIds, distance: d });
    });
    endpoints.forEach(({ point: p, lineId }) => {
      const d = distance(p, point);
      if (d <= toleranceDocUnits) candidates.push({ type: "endpoint", point: p, lineId, distance: d });
    });
    segmentsNear(point, toleranceDocUnits).forEach((seg) => {
      const proj = nearestPointOnSegment(point, seg.a, seg.b);
      const d = distance(proj, point);
      if (d <= toleranceDocUnits) candidates.push({ type: "line", point: proj, lineId: seg.id, distance: d });
    });

    candidates.sort((a, b) => PRIORITY[a.type] - PRIORITY[b.type] || a.distance - b.distance);
    return candidates.slice(0, 1);
  }

  return {
    segments: snapSegments,
    rawSegments: segments,
    endpoints,
    intersections,
    findSnapCandidates,
    // Explicit hook for a future exterior-wall detector to consume the same
    // extracted geometry — not wired to auto-detection in this pass.
    getCandidateWallSegments: () => snapSegments,
  };
}
