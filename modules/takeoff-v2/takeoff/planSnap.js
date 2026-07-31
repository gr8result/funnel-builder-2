// The one unified snap API — used by Set Scale, Measure Length (Orthogonal
// mode) and Edit Exterior Walls vertex dragging, so there is exactly one
// snapping implementation rather than a per-tool copy. Merges two candidate
// sources:
//   - the plan-geometry index (real vector/raster plan linework — endpoints,
//     intersections, nearest-point-on-line; see geometry/planGeometryIndex.js)
//   - page state (existing wall vertices/segments, saved measurements, the
//     current calibration points — via the already-tested takeoff/snapping.js,
//     kept as-is rather than rewritten)
// ranked intersection > endpoint > nearest-point-on-line, matching the
// spec's SnapCandidate union and priority order.

import { buildSnapCandidates as buildPageSnapCandidates } from "./snapping.js";
import { distance } from "./geometry.js";

const PRIORITY = { intersection: 0, endpoint: 1, line: 2 };

function pageCandidateToSnapCandidate(candidate, point) {
  const d = distance(candidate, point);
  if (candidate.kind === "intersection") {
    return { type: "intersection", point: { x: candidate.x, y: candidate.y }, lineIds: [], distance: d };
  }
  // wall vertices, measurement endpoints and calibration points are all
  // "a specific known point" in page-state terms — surfaced as endpoints.
  return { type: "endpoint", point: { x: candidate.x, y: candidate.y }, lineId: candidate.refId || null, distance: d };
}

// toleranceScreenPx is converted to document units via zoomScale, exactly
// like the rest of the app's snap tolerances (see takeoff/snapping.js),
// so the feel stays consistent regardless of zoom.
export function findSnapCandidates(point, { toleranceScreenPx = 12, zoomScale = 1, planGeometryIndex = null, page = null, excludeVertexId = null } = {}) {
  const toleranceDocUnits = toleranceScreenPx / Math.max(zoomScale, 0.01);
  const results = [];

  if (planGeometryIndex) {
    results.push(...planGeometryIndex.findSnapCandidates(point, toleranceDocUnits));
  }

  if (page) {
    buildPageSnapCandidates(page, { excludeVertexId }).forEach((candidate) => {
      const snap = pageCandidateToSnapCandidate(candidate, point);
      if (snap.distance <= toleranceDocUnits) results.push(snap);
    });
  }

  results.sort((a, b) => PRIORITY[a.type] - PRIORITY[b.type] || a.distance - b.distance);
  return results.slice(0, 1);
}

// The single best candidate, or null if nothing is within tolerance — this
// is the "no valid snap target" case the caller uses to decide whether to
// require the deliberate Place Manually fallback.
export function bestSnapCandidate(point, options) {
  const candidates = findSnapCandidates(point, options);
  return candidates.length ? candidates[0] : null;
}
