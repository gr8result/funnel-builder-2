import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createDistanceMeasurement } from "../core/measurement.js";
import { createScaleCalibration } from "../core/scale.js";
import { createRasterPage, createTakeoffDocument, TOOL_IDS } from "../core/types.js";
import { screenToImagePoint } from "../core/viewTransform.js";
import { TAKEOFF_ACTIONS, takeoffReducer } from "../state/takeoffReducer.js";

const measureToolSource = readFileSync(new URL("../tools/MeasureTool.jsx", import.meta.url), "utf8");
const viewerSource = readFileSync(new URL("../viewer/TakeoffViewer.jsx", import.meta.url), "utf8");
const canvasSource = readFileSync(new URL("../viewer/TakeoffCanvas.jsx", import.meta.url), "utf8");

assert.match(measureToolSource, /Set scale before measuring\./);
assert.match(measureToolSource, /Measurement name/);
assert.match(measureToolSource, /Delete/);
assert.match(viewerSource, /ADD_DISTANCE_MEASUREMENT/);
assert.match(viewerSource, /DELETE_MEASUREMENT/);
assert.match(canvasSource, /measurementLabel/);

const pointA = { x: 100, y: 200 };
const pointB = { x: 752, y: 200 };
const scale = createScaleCalibration({
  start: pointA,
  end: pointB,
  realDistanceMm: 11490,
});

const measurement = createDistanceMeasurement({
  start: pointA,
  end: pointB,
  scale,
  label: "Reference check",
});

assert.deepEqual(measurement.pointA, pointA);
assert.deepEqual(measurement.pointB, pointB);
assert.deepEqual(measurement.points, [pointA, pointB]);
assert.equal(Math.round(measurement.lengthMm), 11490);
assert.equal(measurement.displayText, "11,490 mm (11.49 m)");
assert.equal(measurement.label, "Reference check");

const page = createRasterPage({
  id: "page-1",
  imageDataUrl: "data:image/png;base64,abc",
  imageWidth: 4200,
  imageHeight: 2970,
  scale,
});
const state = createTakeoffDocument({
  pages: [page],
  activePageId: "page-1",
  activeTool: TOOL_IDS.MEASURE,
});
const withMeasurement = takeoffReducer(state, {
  type: TAKEOFF_ACTIONS.ADD_DISTANCE_MEASUREMENT,
  payload: measurement,
});

assert.equal(withMeasurement.pages[0].measurements.length, 1);
assert.deepEqual(withMeasurement.pages[0].measurements[0].pointA, pointA);
assert.deepEqual(withMeasurement.pages[0].measurements[0].pointB, pointB);
assert.equal(Math.round(withMeasurement.pages[0].measurements[0].lengthMm), 11490);

const deleted = takeoffReducer(withMeasurement, {
  type: TAKEOFF_ACTIONS.DELETE_MEASUREMENT,
  payload: { measurementId: withMeasurement.pages[0].measurements[0].id },
});
assert.equal(deleted.pages[0].measurements.length, 0);

const imagePoint = { x: 500, y: 300 };
const normalView = { zoom: 1, panX: 0, panY: 0 };
const zoomedPannedView = { zoom: 4, panX: -320, panY: 95 };
const normalScreenPoint = {
  x: imagePoint.x * normalView.zoom + normalView.panX,
  y: imagePoint.y * normalView.zoom + normalView.panY,
};
const zoomedScreenPoint = {
  x: imagePoint.x * zoomedPannedView.zoom + zoomedPannedView.panX,
  y: imagePoint.y * zoomedPannedView.zoom + zoomedPannedView.panY,
};

assert.deepEqual(screenToImagePoint(normalScreenPoint, normalView), imagePoint);
assert.deepEqual(screenToImagePoint(zoomedScreenPoint, zoomedPannedView), imagePoint);
assert.equal(Math.round(createDistanceMeasurement({ start: pointA, end: pointB, scale }).lengthMm), 11490);

console.log("measure tool tests passed");

