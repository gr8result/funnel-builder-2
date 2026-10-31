// Drawing a wall by hand: clicks snap to the walls already in the takeoff before the drawing's lines,
// and a drawn wall that corrects an existing wall replaces it instead of being counted beside it.
import assert from 'node:assert/strict';
import { reconcileDrawnWall, snapWallPoint } from '../components/construction-estimation/ai-plan-takeoff/manualWallEdit.js';

const ppm = 0.1; // 10 mm per pixel
const wall = (id, nodes, extra = {}) => ({ id, page: 1, nodes, thicknessMm: 90, category: 'interior', ...extra });
const engine = [
  wall('w-top', [{ x: 0, y: 100 }, { x: 500, y: 100 }]),
  wall('w-left', [{ x: 0, y: 100 }, { x: 0, y: 400 }]),
  wall('w-other-sheet', [{ x: 0, y: 100 }, { x: 500, y: 100 }], { page: 2 }),
];
const segments = [{ x1: 300, y1: 250, x2: 300, y2: 400 }];

// ---- Snapping -----------------------------------------------------------------------------------
let snap = snapWallPoint({ x: 4, y: 103 }, { walls: engine, page: 1, segments, radiusPx: 10 });
assert.deepEqual([snap.x, snap.y, snap.kind], [0, 100, 'wall-end'], 'a click near a wall corner lands on it');
snap = snapWallPoint({ x: 250, y: 106 }, { walls: engine, page: 1, segments, radiusPx: 10 });
assert.deepEqual([snap.x, snap.y, snap.kind, snap.wallId], [250, 100, 'wall-centreline', 'w-top'], 'a click near a wall lands on its centreline (T junction)');
snap = snapWallPoint({ x: 304, y: 300 }, { walls: engine, page: 1, segments, radiusPx: 10 });
assert.deepEqual([snap.x, snap.y, snap.kind], [300, 300, 'linework'], 'away from walls, the drawing\'s line');
snap = snapWallPoint({ x: 303, y: 253 }, { walls: engine, page: 1, segments, radiusPx: 10 });
assert.deepEqual([snap.x, snap.y], [300, 250], 'a line\'s end wins over a point along it');
snap = snapWallPoint({ x: 250, y: 106 }, { walls: engine.filter((item) => item.page === 2), page: 1, segments, radiusPx: 10 });
assert.equal(snap.snapped, false, 'walls on another sheet are not snap targets');

// ---- A drawn correction replaces the wall it redraws -------------------------------------------
// The engine's top wall is 120 mm out of place; the estimator redraws it on the drawn line.
const redrawn = wall('drawn', [{ x: 0, y: 112 }, { x: 500, y: 112 }]);
let result = reconcileDrawnWall(redrawn, engine, ppm);
assert.deepEqual(result.replacedIds, ['w-top'], 'the misplaced wall is replaced');
assert.ok(!result.walls.some((item) => item.id === 'w-top'), 'the replaced wall is gone');
assert.ok(result.walls.some((item) => item.id === 'w-other-sheet'), 'the same line on another sheet is untouched');
assert.equal(result.run.source, 'manual'); assert.deepEqual(result.run.replacesWallIds, ['w-top']);
const total = (walls, page) => walls.filter((item) => item.page === page).reduce((sum, item) => sum + Math.hypot(item.nodes[1].x - item.nodes[0].x, item.nodes[1].y - item.nodes[0].y), 0);
assert.equal(total(result.walls, 1), total(engine, 1), 'the sheet\'s wall length is not counted twice');

// ---- A drawn wall along part of a wall: both kept and flagged ----------------------------------
result = reconcileDrawnWall(wall('part', [{ x: 300, y: 100 }, { x: 500, y: 100 }]), engine, ppm);
assert.deepEqual(result.replacedIds, []); assert.deepEqual(result.overlappingIds, ['w-top']);
assert.ok(result.run.reviewRequired && result.walls.find((item) => item.id === 'w-top').reviewRequired, 'partial overlap: both walls ask to be trimmed');

// ---- A wall drawn to meet others is just added ------------------------------------------------
result = reconcileDrawnWall(wall('new', [{ x: 250, y: 100 }, { x: 250, y: 400 }]), engine, ppm);
assert.deepEqual([result.replacedIds, result.overlappingIds], [[], []], 'a wall square to another only meets it');
assert.equal(result.walls.length, engine.length + 1);
assert.ok(!result.run.reviewRequired);

// ---- A wall far off (more than half a thickness + 150 mm) is not a correction -----------------
result = reconcileDrawnWall(wall('parallel', [{ x: 0, y: 130 }, { x: 500, y: 130 }]), engine, ppm);
assert.deepEqual(result.replacedIds, [], 'a parallel wall 300 mm away is its own wall');

console.log('manual wall edit: all checks passed');
