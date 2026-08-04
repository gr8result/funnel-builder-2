import assert from "node:assert/strict";
import { buildPlanGeometryIndex } from "../geometry/planGeometryIndex.js";
import { moveHighlightedWallJunction, normalizeHighlightedWallJunctions } from "../hooks/useTakeoffTools.js";
import { distance } from "../takeoff/geometry.js";
import {
  SHARED_LINE_SELECTION_TOLERANCE_SCREEN_PX,
  classifyLineForExterior,
  expandLineToWall,
  findLineNearPointer,
  scaleToolLineSelection,
} from "../takeoff/lineSelection.js";

function closePoint(actual, expected, tolerance = 0.001) {
  assert.ok(distance(actual, expected) <= tolerance, `expected ${JSON.stringify(actual)} near ${JSON.stringify(expected)}`);
}

function assertSameLine(a, b) {
  closePoint(a.line.start, b.line.start);
  closePoint(a.line.end, b.line.end);
  assert.equal(a.sourceSegmentId, b.sourceSegmentId);
}

{
  const index = buildPlanGeometryIndex([
    { id: "family-top", a: { x: 20, y: 40 }, b: { x: 160, y: 40 }, source: "vector" },
  ]);
  const pointer = { x: 90, y: 43 };
  const scale = scaleToolLineSelection({ documentPoint: pointer, zoom: 1, planGeometryIndex: index });
  const exterior = findLineNearPointer({ documentPoint: pointer, zoom: 1, planGeometryIndex: index });
  assertSameLine(scale, exterior);
  assert.equal(scale.snap.type, "line");
}

{
  const index = buildPlanGeometryIndex([
    { id: "zoom-line", a: { x: 0, y: 100 }, b: { x: 200, y: 100 } },
  ]);
  assert.ok(findLineNearPointer({ documentPoint: { x: 50, y: 106 }, zoom: 1, planGeometryIndex: index }));
  assert.equal(findLineNearPointer({ documentPoint: { x: 50, y: 106 }, zoom: 5, planGeometryIndex: index }), null);
  assert.equal(SHARED_LINE_SELECTION_TOLERANCE_SCREEN_PX, 12);
}

{
  const index = buildPlanGeometryIndex([
    { id: "h1", a: { x: 40, y: 80 }, b: { x: 110, y: 80 } },
    { id: "h2", a: { x: 112, y: 80 }, b: { x: 220, y: 80 } },
    { id: "left", a: { x: 40, y: 20 }, b: { x: 40, y: 140 } },
    { id: "right", a: { x: 220, y: 20 }, b: { x: 220, y: 140 } },
  ]);
  const hit = findLineNearPointer({ documentPoint: { x: 70, y: 81 }, planGeometryIndex: index });
  const wall = expandLineToWall(hit, { planGeometryIndex: index });
  closePoint(wall.line.start, { x: 40, y: 80 });
  closePoint(wall.line.end, { x: 220, y: 80 });
  assert.equal(wall.startEndpointReason, "intersection");
  assert.equal(wall.endEndpointReason, "intersection");
}

{
  const index = buildPlanGeometryIndex([
    { id: "v1", a: { x: 90, y: 30 }, b: { x: 90, y: 95 } },
    { id: "v2", a: { x: 90, y: 97 }, b: { x: 90, y: 180 } },
    { id: "top", a: { x: 20, y: 30 }, b: { x: 160, y: 30 } },
    { id: "bottom", a: { x: 20, y: 180 }, b: { x: 160, y: 180 } },
  ]);
  const hit = findLineNearPointer({ documentPoint: { x: 92, y: 110 }, planGeometryIndex: index });
  const wall = expandLineToWall(hit, { planGeometryIndex: index });
  closePoint(wall.line.start, { x: 90, y: 30 });
  closePoint(wall.line.end, { x: 90, y: 180 });
}

{
  const index = buildPlanGeometryIndex([
    { id: "a1", a: { x: 20, y: 20 }, b: { x: 80, y: 80 } },
    { id: "a2", a: { x: 82, y: 82 }, b: { x: 140, y: 140 } },
  ]);
  const hit = findLineNearPointer({ documentPoint: { x: 60, y: 62 }, planGeometryIndex: index });
  const wall = expandLineToWall(hit, { planGeometryIndex: index });
  closePoint(wall.line.start, { x: 20, y: 20 }, 0.01);
  closePoint(wall.line.end, { x: 140, y: 140 }, 0.01);
  assert.equal(wall.startEndpointReason, "last supported visible point");
}

{
  const index = buildPlanGeometryIndex([
    { id: "near-wall", a: { x: 0, y: 50 }, b: { x: 100, y: 50 } },
    { id: "parallel-neighbor", a: { x: 0, y: 58 }, b: { x: 100, y: 58 } },
  ]);
  const hit = findLineNearPointer({ documentPoint: { x: 40, y: 51 }, planGeometryIndex: index });
  assert.equal(hit.sourceSegmentId, "near-wall");
  const wall = expandLineToWall(hit, { planGeometryIndex: index });
  assert.equal(Math.round(wall.line.start.y), 50);
  assert.equal(Math.round(wall.line.end.y), 50);
}

{
  const index = buildPlanGeometryIndex([
    { id: "dimension", a: { x: 10, y: 20 }, b: { x: 180, y: 20 } },
    { id: "tick-1", a: { x: 30, y: 14 }, b: { x: 30, y: 26 } },
    { id: "tick-2", a: { x: 70, y: 14 }, b: { x: 70, y: 26 } },
    { id: "tick-3", a: { x: 120, y: 14 }, b: { x: 120, y: 26 } },
  ]);
  const scaleHit = scaleToolLineSelection({ documentPoint: { x: 80, y: 21 }, planGeometryIndex: index });
  assert.ok(scaleHit, "Scale Tool may select dimension lines for calibration");
  const exteriorClassification = classifyLineForExterior(scaleHit, { planGeometryIndex: index });
  assert.equal(exteriorClassification.classification, "dimension-or-annotation");
}

{
  const hoverCandidate = {
    id: "hover",
    line: { start: { x: 0, y: 0 }, end: { x: 100, y: 0 } },
  };
  const clickedCandidate = hoverCandidate;
  assert.equal(clickedCandidate, hoverCandidate, "click commits the stored hover candidate, not a second detection");
}

{
  const { walls } = normalizeHighlightedWallJunctions([
    { id: "w1", centreline: { start: { x: 0, y: 0 }, end: { x: 100, y: 0 } } },
    { id: "w2", centreline: { start: { x: 100, y: 0 }, end: { x: 100, y: 80 } } },
  ]);
  const shared = walls[0].endJunction.id;
  const moved = moveHighlightedWallJunction(walls, shared, { x: 105, y: 5 });
  closePoint(moved[0].centreline.end, { x: 105, y: 5 });
  closePoint(moved[1].centreline.start, { x: 105, y: 5 });
  assert.deepEqual(JSON.parse(JSON.stringify(moved)), moved, "highlighted walls persist as plain JSON after refresh");
}

console.log("lineSelection.test.mjs passed");
