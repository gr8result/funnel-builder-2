// Snap-target discovery: wall vertices/intersections, measurement endpoints and
// the current calibration points, all in page-space. Ported/adapted from
// components/estimate-builder/ai-takeoff/PlanCanvas.jsx's nearestSnapTarget /
// resolveSnap and components/estimate-builder/takeoff-engine/core/snapping.js's
// lineIntersection / findNearestSnapPoint.

import { distance, segmentIntersection } from "./geometry.js";

function sameLocation(a, b) {
  return Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9;
}

// Segments that share an endpoint (e.g. two consecutive wall segments meeting
// at a corner) always "intersect" there trivially — that's already a vertex
// candidate, not a new snap point, so it's excluded here.
function sharesEndpoint(segmentA, segmentB) {
  return (
    sameLocation(segmentA.a, segmentB.a) || sameLocation(segmentA.a, segmentB.b) ||
    sameLocation(segmentA.b, segmentB.a) || sameLocation(segmentA.b, segmentB.b)
  );
}

// Builds the full list of candidate snap points for a page's current takeoff
// state. `excludeVertexId` lets a vertex being dragged skip itself.
export function buildSnapCandidates(page, { excludeVertexId = null } = {}) {
  const points = [];
  const segments = [];

  if (page?.exteriorWalls) {
    const byId = new Map(page.exteriorWalls.vertices.map((v) => [v.id, v]));
    page.exteriorWalls.vertices.forEach((vertex) => {
      if (vertex.id === excludeVertexId) return;
      points.push({ x: vertex.x, y: vertex.y, kind: "vertex", refId: vertex.id });
    });
    page.exteriorWalls.segments.forEach((segment) => {
      const a = byId.get(segment.aId);
      const b = byId.get(segment.bId);
      if (a && b) segments.push({ a, b });
    });
  }

  (page?.measurements || []).forEach((measurement) => {
    points.push({ x: measurement.pointA.x, y: measurement.pointA.y, kind: "measurement" });
    points.push({ x: measurement.pointB.x, y: measurement.pointB.y, kind: "measurement" });
    segments.push({ a: measurement.pointA, b: measurement.pointB });
  });

  if (page?.calibration) {
    points.push({ x: page.calibration.pointA.x, y: page.calibration.pointA.y, kind: "calibration" });
    points.push({ x: page.calibration.pointB.x, y: page.calibration.pointB.y, kind: "calibration" });
  }

  for (let i = 0; i < segments.length; i += 1) {
    for (let j = i + 1; j < segments.length; j += 1) {
      if (sharesEndpoint(segments[i], segments[j])) continue;
      const hit = segmentIntersection(segments[i].a, segments[i].b, segments[j].a, segments[j].b);
      if (hit) points.push({ x: hit.x, y: hit.y, kind: "intersection" });
    }
  }

  return points;
}

// Returns the nearest candidate within toleranceDocUnits of `point`, or null.
export function findNearestSnapPoint(point, candidates, toleranceDocUnits) {
  let best = null;
  let bestDistance = toleranceDocUnits;
  for (const candidate of candidates) {
    const d = distance(point, candidate);
    if (d <= bestDistance) {
      best = candidate;
      bestDistance = d;
    }
  }
  return best;
}

// Snaps `point` to the nearest candidate within tolerance, otherwise returns
// point unchanged. toleranceScreenPx/zoomScale converts a screen-pixel
// tolerance into page-space (document) units, matching how PlanViewer already
// converts pixel tolerances for wheel-zoom cursor math.
export function snapPoint(point, candidates, { toleranceScreenPx = 10, zoomScale = 1 } = {}) {
  const toleranceDocUnits = toleranceScreenPx / Math.max(zoomScale, 0.01);
  const nearest = findNearestSnapPoint(point, candidates, toleranceDocUnits);
  if (!nearest) return { point, snappedTo: null };
  return { point: { x: nearest.x, y: nearest.y }, snappedTo: nearest };
}
