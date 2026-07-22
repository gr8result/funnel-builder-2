import assert from "node:assert/strict";
import {
  SNAP_TYPES,
  buildSnapPointsFromSegments,
  createSegment,
  detectLineSegmentsWithCv,
  findNearestSnapPoint,
  lineIntersection,
  snapPoint,
} from "../core/snapping.js";

const horizontal = createSegment({
  id: "h",
  pointA: { x: 0, y: 100 },
  pointB: { x: 200, y: 100 },
});
const vertical = createSegment({
  id: "v",
  pointA: { x: 100, y: 0 },
  pointB: { x: 100, y: 200 },
});

const intersection = lineIntersection(horizontal, vertical);
assert.deepEqual(intersection, { x: 100, y: 100 });

const snapPoints = buildSnapPointsFromSegments([horizontal, vertical]);
assert.ok(snapPoints.some((point) => point.type === SNAP_TYPES.ENDPOINT && point.x === 0 && point.y === 100));
assert.ok(snapPoints.some((point) => point.type === SNAP_TYPES.MIDPOINT && point.x === 100 && point.y === 100));
assert.ok(snapPoints.some((point) => point.type === SNAP_TYPES.INTERSECTION && point.x === 100 && point.y === 100));

const nearestEndpoint = findNearestSnapPoint({ x: 4, y: 102 }, snapPoints, 10);
assert.equal(nearestEndpoint.point.type, SNAP_TYPES.ENDPOINT);
assert.deepEqual({ x: nearestEndpoint.point.x, y: nearestEndpoint.point.y }, { x: 0, y: 100 });

const nearestMidOrIntersection = findNearestSnapPoint({ x: 102, y: 101 }, snapPoints, 10);
assert.ok([SNAP_TYPES.MIDPOINT, SNAP_TYPES.INTERSECTION].includes(nearestMidOrIntersection.point.type));
assert.deepEqual({ x: nearestMidOrIntersection.point.x, y: nearestMidOrIntersection.point.y }, { x: 100, y: 100 });

const snapped = snapPoint({ x: 198, y: 104 }, snapPoints, { enabled: true, tolerancePx: 8 });
assert.equal(snapped.snapped, true);
assert.equal(snapped.point.x, 200);
assert.equal(snapped.point.y, 100);

const unsnapped = snapPoint({ x: 180, y: 130 }, snapPoints, { enabled: true, tolerancePx: 8 });
assert.equal(unsnapped.snapped, false);
assert.deepEqual(unsnapped.point, { x: 180, y: 130 });

const disabled = snapPoint({ x: 198, y: 104 }, snapPoints, { enabled: false, tolerancePx: 8 });
assert.equal(disabled.snapped, false);
assert.deepEqual(disabled.point, { x: 198, y: 104 });

const cvUnavailable = detectLineSegmentsWithCv();
assert.equal(cvUnavailable.available, false);
assert.deepEqual(cvUnavailable.segments, []);

console.log("snapping tests passed");
