import assert from "node:assert/strict";
import {
  appendWallPoint,
  calculateExteriorSummary,
  closeWallLoop,
  deletePoint,
  deleteWall,
  insertPointIntoWall,
  movePoint,
  orderedExteriorPoints,
  validateExteriorLoop,
} from "../core/geometry.js";
import { createEmptyGeometry } from "../core/types.js";
import { commitHistory, createHistory, redoHistory, undoHistory } from "../core/history.js";

let geometry = createEmptyGeometry();
geometry = { ...geometry, points: [{ id: "a", x: 0, y: 0 }] };
let result = appendWallPoint(geometry, "a", { id: "b", x: 10, y: 0 }, "exterior");
geometry = result.geometry;
result = appendWallPoint(geometry, result.pointId, { id: "c", x: 10, y: 10 }, "exterior");
geometry = result.geometry;
result = appendWallPoint(geometry, result.pointId, { id: "d", x: 0, y: 10 }, "exterior");
geometry = closeWallLoop(result.geometry, "a", result.pointId, "exterior");

assert.equal(geometry.points.length, 4, "draw mode places points");
assert.equal(geometry.walls.length, 4, "polygon closure creates final segment");
assert.equal(validateExteriorLoop(geometry).valid, true, "polygon closure is valid");
assert.deepEqual(orderedExteriorPoints(geometry).map((point) => point.id), ["a", "b", "c", "d"]);

const moved = movePoint(geometry, "b", { x: 20, y: 0 });
assert.equal(moved.points.find((point) => point.id === "b").x, 20, "point drag moves selected point");
assert.equal(moved.points.find((point) => point.id === "c").x, 10, "point drag does not move unrelated points");

const wall = geometry.walls[0];
const inserted = insertPointIntoWall(geometry, wall.id, { x: 5, y: 0 });
assert.equal(inserted.geometry.points.length, 5, "insert point adds a point");
assert.equal(inserted.geometry.walls.length, 5, "insert point splits wall");

const removedPoint = deletePoint(inserted.geometry, inserted.pointId);
assert.equal(removedPoint.points.some((point) => point.id === inserted.pointId), false, "delete point removes point");

const removedWall = deleteWall(geometry, wall.id);
assert.equal(removedWall.walls.some((candidate) => candidate.id === wall.id), false, "delete wall removes selected wall");

let history = createHistory(createEmptyGeometry());
history = commitHistory(history, geometry);
assert.equal(history.present.walls.length, 4);
history = undoHistory(history);
assert.equal(history.present.walls.length, 0, "undo restores previous geometry");
history = redoHistory(history);
assert.equal(history.present.walls.length, 4, "redo restores next geometry");

const summary = calculateExteriorSummary(geometry, { mmPerDocumentUnit: 100 });
assert.equal(summary.valid, true);
assert.equal(summary.perimeterMm, 4000, "perimeter calculation");
assert.equal(summary.areaM2, 1, "polygon area calculation");

const selfIntersecting = {
  points: [
    { id: "a", x: 0, y: 0 },
    { id: "b", x: 10, y: 10 },
    { id: "c", x: 0, y: 10 },
    { id: "d", x: 10, y: 0 },
  ],
  walls: [
    { id: "ab", startPointId: "a", endPointId: "b", wallType: "exterior", source: "manual", confirmed: false },
    { id: "bc", startPointId: "b", endPointId: "c", wallType: "exterior", source: "manual", confirmed: false },
    { id: "cd", startPointId: "c", endPointId: "d", wallType: "exterior", source: "manual", confirmed: false },
    { id: "da", startPointId: "d", endPointId: "a", wallType: "exterior", source: "manual", confirmed: false },
  ],
  openings: [],
};
assert.equal(validateExteriorLoop(selfIntersecting).valid, false, "self-intersection rejection");

console.log("takeoff-v3 geometryEditor.test.mjs passed");
