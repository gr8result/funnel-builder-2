import assert from "node:assert/strict";
import {
  screenToDocument,
  documentToScreen,
  documentLength,
} from "./planCoordinateUtils.js";

const wall = [
  { x: 120, y: 240 },
  { x: 720, y: 240 },
];

const baseView = {
  scale: 1,
  pan: { x: 0, y: 0 },
  origin: { x: 0, y: 0 },
};

const zoomedView = {
  scale: 5,
  pan: { x: 0, y: 0 },
  origin: { x: 0, y: 0 },
};

const zoomedAndPannedView = {
  scale: 5,
  pan: { x: 380, y: -170 },
  origin: { x: 0, y: 0 },
};

const baseLength = documentLength(wall);

const zoomedWall = wall
  .map((point) => documentToScreen(point, zoomedView))
  .map((point) => screenToDocument(point, zoomedView));

const pannedWall = wall
  .map((point) => documentToScreen(point, zoomedAndPannedView))
  .map((point) => screenToDocument(point, zoomedAndPannedView));

assert.equal(documentLength(zoomedWall), baseLength);
assert.equal(documentLength(pannedWall), baseLength);

const pixelsPerUnit = 50;
assert.equal(baseLength / pixelsPerUnit, documentLength(zoomedWall) / pixelsPerUnit);
assert.equal(baseLength / pixelsPerUnit, documentLength(pannedWall) / pixelsPerUnit);

console.log("planCoordinateUtils: zoom and pan preserve document measurement length");
