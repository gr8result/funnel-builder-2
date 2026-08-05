import assert from "node:assert/strict";
import { findHighlightableWallAtPoint } from "../takeoff/localWallHighlighter.js";
import { withPlanPageDefaults } from "../types.js";

function segment(id, ax, ay, bx, by, extra = {}) {
  return {
    id,
    a: { x: ax, y: ay },
    b: { x: bx, y: by },
    stroked: true,
    length: Math.hypot(bx - ax, by - ay),
    ...extra,
  };
}

function wallFaceSegments(prefix, { start = 0, end = 300, y = 100, thickness = 8, gaps = [] } = {}) {
  const ranges = [];
  let cursor = start;
  gaps.sort((a, b) => a.start - b.start).forEach((gap) => {
    if (gap.start > cursor) ranges.push([cursor, gap.start]);
    cursor = Math.max(cursor, gap.end);
  });
  if (cursor < end) ranges.push([cursor, end]);
  return ranges.flatMap(([from, to], index) => [
    segment(`${prefix}-face-a-${index}`, from, y, to, y),
    segment(`${prefix}-face-b-${index}`, from, y + thickness, to, y + thickness),
  ]);
}

function jambs(prefix, x, y = 100, thickness = 8) {
  return [segment(`${prefix}-jamb-${x}`, x, y, x, y + thickness, { role: "wall-return" })];
}

function wallHit(segments, point) {
  return findHighlightableWallAtPoint({
    point,
    planGeometryIndex: { rawSegments: segments },
    page: { sourceWidth: 400, sourceHeight: 220 },
    searchRadiusDocUnits: 10,
    diagnosticsEnabled: true,
  });
}

function assertSectionTypes(wall, expected) {
  assert.deepEqual(wall.sections.map((section) => section.type), expected);
}

{
  const segments = [
    ...wallFaceSegments("family", { gaps: [{ start: 130, end: 170 }] }),
    ...jambs("family-start", 130),
    ...jambs("family-end", 170),
    segment("family-window-glazing", 136, 104, 164, 104, { objectType: "window", label: "W01" }),
  ];

  const solidHit = wallHit(segments, { x: 60, y: 104 }).wall;
  const openingHit = wallHit(segments, { x: 150, y: 104 }).wall;

  assert.ok(solidHit, "solid wall hover should return a wall assembly");
  assert.ok(openingHit, "hover inside a supported opening should return the same wall assembly");
  assert.equal(openingHit.id, solidHit.id);
  assert.deepEqual(openingHit.axis, solidHit.axis);
  assertSectionTypes(solidHit, ["solid", "window", "solid"]);
  assert.equal(solidHit.openings.length, 1);
  assert.equal(solidHit.openings[0].type, "window");
  assert.equal(solidHit.openings[0].startOffset, 130);
  assert.equal(solidHit.openings[0].endOffset, 170);
}

{
  const segments = [
    ...wallFaceSegments("garage", { gaps: [{ start: 80, end: 220 }] }),
    ...jambs("garage-start", 80),
    ...jambs("garage-end", 220),
    segment("garage-panel-1", 92, 102, 208, 102, { objectType: "garage-door", label: "panel lift garage door" }),
    segment("garage-panel-2", 92, 106, 208, 106, { objectType: "garage-door", label: "panel lift garage door" }),
  ];

  const wall = wallHit(segments, { x: 150, y: 104 }).wall;

  assert.ok(wall, "hover inside a garage opening should return a continuous wall assembly");
  assertSectionTypes(wall, ["solid", "garage-door", "solid"]);
  assert.equal(wall.openings.length, 1);
  assert.equal(wall.openings[0].type, "garage-door");
  assert.equal(wall.axis.start.x, 0);
  assert.equal(wall.axis.end.x, 300);
}

{
  const segments = wallFaceSegments("unsupported-gap", { gaps: [{ start: 130, end: 250 }] });
  const leftWall = wallHit(segments, { x: 60, y: 104 }).wall;
  const gapHit = wallHit(segments, { x: 190, y: 104 }).wall;

  assert.ok(leftWall, "solid fragment should still be selectable");
  assert.equal(leftWall.openings.length, 0, "unsupported gaps must not be converted into openings");
  assert.ok(leftWall.axis.end.x <= 130, "unsupported gaps must split the wall assembly");
  assert.equal(gapHit, null, "hovering an unsupported gap should not invent a wall");
}

{
  const segments = [
    ...wallFaceSegments("persisted", { gaps: [{ start: 130, end: 170 }] }),
    ...jambs("persisted-start", 130),
    ...jambs("persisted-end", 170),
    segment("persisted-window-glazing", 136, 104, 164, 104, { objectType: "window", label: "W02" }),
  ];
  const wall = wallHit(segments, { x: 150, y: 104 }).wall;
  const page = withPlanPageDefaults({ id: "page-1", exteriorHighlightedWalls: [wall] });

  assert.equal(page.exteriorHighlightedWalls.length, 1);
  assertSectionTypes(page.exteriorHighlightedWalls[0], ["solid", "window", "solid"]);
  assert.equal(page.exteriorHighlightedWalls[0].openings[0].type, "window");
}

console.log("wallAssembly tests passed");
