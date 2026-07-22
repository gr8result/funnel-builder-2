import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createScaleCalibration, formatMillimetres, pixelsToMillimetres } from "../core/scale.js";
import { createRasterPage, createTakeoffDocument, TOOL_IDS } from "../core/types.js";
import { screenToImagePoint } from "../core/viewTransform.js";
import { TAKEOFF_ACTIONS, takeoffReducer } from "../state/takeoffReducer.js";

const scaleToolSource = readFileSync(new URL("../tools/ScaleTool.jsx", import.meta.url), "utf8");
const viewerSource = readFileSync(new URL("../viewer/TakeoffViewer.jsx", import.meta.url), "utf8");
const canvasSource = readFileSync(new URL("../viewer/TakeoffCanvas.jsx", import.meta.url), "utf8");

assert.match(scaleToolSource, /Reference:/);
assert.match(scaleToolSource, /Scale ready/);
assert.match(scaleToolSource, /Enter a positive distance in millimetres/);
assert.match(scaleToolSource, /placeholder="11490"/);
assert.match(viewerSource, /SET_SCALE/);
assert.match(viewerSource, /TOOL_IDS\.SELECT/);
assert.match(canvasSource, /screenToImagePoint/);

const pointA = { x: 100, y: 200 };
const pointB = { x: 752, y: 200 };
const scale = createScaleCalibration({
  start: pointA,
  end: pointB,
  realDistanceMm: 11490,
});

assert.deepEqual(scale.pointA, pointA);
assert.deepEqual(scale.pointB, pointB);
assert.equal(scale.referenceDistanceMm, 11490);
assert.equal(scale.pixelDistance, 652);
assert.equal(scale.pixelsPerMm, 652 / 11490);
assert.equal(scale.mmPerPixel, 11490 / 652);
assert.equal(formatMillimetres(scale.referenceDistanceMm, { includeMetres: false }), "11,490 mm");
assert.equal(Math.round(pixelsToMillimetres(652, scale)), 11490);

assert.throws(() => createScaleCalibration({ start: pointA, end: pointB, realDistanceMm: "" }));
assert.throws(() => createScaleCalibration({ start: pointA, end: pointB, realDistanceMm: 0 }));
assert.throws(() => createScaleCalibration({ start: pointA, end: pointB, realDistanceMm: -1 }));
assert.throws(() => createScaleCalibration({ start: pointA, end: pointB, realDistanceMm: "nope" }));

const page = createRasterPage({
  id: "page-1",
  imageDataUrl: "data:image/png;base64,abc",
  imageWidth: 4200,
  imageHeight: 2970,
});
const state = createTakeoffDocument({
  pages: [page],
  activePageId: "page-1",
  activeTool: TOOL_IDS.SCALE,
});
const withScale = takeoffReducer(state, {
  type: TAKEOFF_ACTIONS.SET_SCALE,
  payload: scale,
});
const savedPage = withScale.pages[0];

assert.equal(savedPage.scale.referenceDistanceMm, 11490);
assert.deepEqual(savedPage.scale.pointA, pointA);
assert.deepEqual(savedPage.scale.pointB, pointB);

const viewA = { zoom: 1, panX: 0, panY: 0 };
const viewB = { zoom: 4, panX: -300, panY: 120 };
const imagePoint = { x: 500, y: 300 };
const screenA = { x: imagePoint.x * viewA.zoom + viewA.panX, y: imagePoint.y * viewA.zoom + viewA.panY };
const screenB = { x: imagePoint.x * viewB.zoom + viewB.panX, y: imagePoint.y * viewB.zoom + viewB.panY };

assert.deepEqual(screenToImagePoint(screenA, viewA), imagePoint);
assert.deepEqual(screenToImagePoint(screenB, viewB), imagePoint);

console.log("scale tool tests passed");

