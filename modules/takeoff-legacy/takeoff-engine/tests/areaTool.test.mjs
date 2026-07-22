import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildPolygonArea, buildRectangleArea, createAreaMeasurement, rectanglePointsFromCorners } from "../core/measurement.js";
import { createScaleCalibration } from "../core/scale.js";
import { createRasterPage, createTakeoffDocument, TOOL_IDS } from "../core/types.js";
import { screenToImagePoint } from "../core/viewTransform.js";
import { TAKEOFF_ACTIONS, takeoffReducer } from "../state/takeoffReducer.js";

const areaToolSource = readFileSync(new URL("../tools/AreaTool.jsx", import.meta.url), "utf8");
const viewerSource = readFileSync(new URL("../viewer/TakeoffViewer.jsx", import.meta.url), "utf8");
const canvasSource = readFileSync(new URL("../viewer/TakeoffCanvas.jsx", import.meta.url), "utf8");

assert.match(areaToolSource, /Set scale before measuring areas\./);
assert.match(areaToolSource, /Rectangle Area/);
assert.match(areaToolSource, /Polygon Area/);
assert.match(areaToolSource, /Area name/);
assert.match(areaToolSource, /Delete/);
assert.match(viewerSource, /ADD_AREA_MEASUREMENT/);
assert.match(viewerSource, /DELETE_AREA/);
assert.match(canvasSource, /areaLabel/);

const scale = createScaleCalibration({
  start: { x: 0, y: 0 },
  end: { x: 100, y: 0 },
  realDistanceMm: 1000,
});

const rectanglePointA = { x: 10, y: 20 };
const rectanglePointB = { x: 110, y: 70 };
const rectanglePoints = rectanglePointsFromCorners(rectanglePointA, rectanglePointB);
assert.deepEqual(rectanglePoints, [
  { x: 10, y: 20 },
  { x: 110, y: 20 },
  { x: 110, y: 70 },
  { x: 10, y: 70 },
]);

const rectangleArea = buildRectangleArea({
  pointA: rectanglePointA,
  pointB: rectanglePointB,
  scale,
  label: "Living",
});
assert.equal(rectangleArea.label, "Living");
assert.deepEqual(rectangleArea.points, rectanglePoints);
assert.equal(rectangleArea.areaPx2, 5000);
assert.equal(Math.round(rectangleArea.areaMm2), 500000);
assert.equal(rectangleArea.displayText, "500,000 mm² (0.50 m²)");

const polygonPoints = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 50 },
  { x: 0, y: 50 },
];
const polygonArea = buildPolygonArea({
  points: polygonPoints,
  scale,
  label: "Patio",
});
assert.equal(polygonArea.label, "Patio");
assert.deepEqual(polygonArea.points, polygonPoints);
assert.equal(polygonArea.areaPx2, 5000);
assert.equal(Math.round(polygonArea.areaMm2), 500000);

assert.throws(() => buildRectangleArea({ pointA: rectanglePointA, pointB: rectanglePointB, scale: null }));
assert.throws(() => buildPolygonArea({ points: polygonPoints.slice(0, 2), scale }));

const directArea = createAreaMeasurement({ points: polygonPoints, scale });
assert.deepEqual(directArea.points, polygonPoints);
assert.equal(Math.round(directArea.areaMm2), 500000);

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
  activeTool: TOOL_IDS.AREA,
});
const withArea = takeoffReducer(state, {
  type: TAKEOFF_ACTIONS.ADD_AREA_MEASUREMENT,
  payload: polygonArea,
});

assert.equal(withArea.pages[0].areas.length, 1);
assert.deepEqual(withArea.pages[0].areas[0].points, polygonPoints);
assert.equal(Math.round(withArea.pages[0].areas[0].areaMm2), 500000);

const deleted = takeoffReducer(withArea, {
  type: TAKEOFF_ACTIONS.DELETE_AREA,
  payload: { areaId: withArea.pages[0].areas[0].id },
});
assert.equal(deleted.pages[0].areas.length, 0);

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
assert.equal(Math.round(createAreaMeasurement({ points: polygonPoints, scale }).areaMm2), 500000);

console.log("area tool tests passed");
