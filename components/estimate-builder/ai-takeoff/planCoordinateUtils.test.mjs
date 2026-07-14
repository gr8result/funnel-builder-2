import assert from "node:assert/strict";
import {
  calculateFinalRotation,
  calculateFitView,
  calculatePixelsPerMetre,
  distancePx,
  formatMillimetres,
  normalizeRotation,
  polygonAreaPx,
  planToScreenPoint,
  pxToMetres,
  pxToMillimetres,
  screenToPlanPoint,
  snapAngle,
  zoomViewportToPoint,
} from "./planCoordinateUtils.js";

assert.equal(normalizeRotation(0), 0);
assert.equal(normalizeRotation(90), 90);
assert.equal(normalizeRotation(450), 90);
assert.equal(normalizeRotation(-90), 270);
assert.equal(normalizeRotation(44), 0);

assert.equal(calculateFinalRotation({ metadataRotation: 90, detectedRotation: 90, userRotation: 180 }), 0);
assert.equal(calculateFinalRotation({ metadataRotation: 0, detectedRotation: 90, userRotation: 270 }), 0);
assert.equal(calculateFinalRotation({ metadataRotation: 180, detectedRotation: 0, userRotation: 90 }), 270);
assert.equal(calculateFinalRotation({ metadataRotation: 0, detectedRotation: 180, userRotation: 0 }), 180);
assert.equal(calculateFinalRotation({ metadataRotation: 180, detectedRotation: 180, userRotation: 180 }), 180);

const viewState = {
  zoom: 5,
  pan: { x: 380, y: -170 },
  origin: { x: 25, y: 40 },
};

const planPoint = { x: 120, y: 240 };
const screenPoint = planToScreenPoint(planPoint.x, planPoint.y, viewState);
assert.deepEqual(screenToPlanPoint(screenPoint.x, screenPoint.y, viewState), planPoint);

const fitView = calculateFitView(1000, 500, 2000, 1000);
assert.equal(fitView.zoom, 0.47);
assert.equal(Math.round(fitView.pan.x), 30);
assert.equal(Math.round(fitView.pan.y), 15);

const anchoredScreen = { x: 640, y: 360 };
const worldBeforeZoom = screenToPlanPoint(anchoredScreen.x, anchoredScreen.y, viewState);
const zoomedViewport = zoomViewportToPoint(viewState, anchoredScreen.x, anchoredScreen.y, 8);
const worldAfterZoom = screenToPlanPoint(anchoredScreen.x, anchoredScreen.y, zoomedViewport);
assert.equal(Math.round(worldBeforeZoom.x * 1000), Math.round(worldAfterZoom.x * 1000));
assert.equal(Math.round(worldBeforeZoom.y * 1000), Math.round(worldAfterZoom.y * 1000));

const wall = [
  { x: 120, y: 240 },
  { x: 720, y: 240 },
];
assert.equal(distancePx(wall[0], wall[1]), 600);
assert.equal(calculatePixelsPerMetre(wall[0], wall[1], 12), 50);
assert.equal(pxToMetres(600, 50), 12);
assert.equal(pxToMillimetres(600, 50), 12000);
assert.equal(formatMillimetres(11490), "11,490 mm (11.49 m)");

const reference = [{ x: 1000, y: 2500 }, { x: 3298, y: 2500 }];
const ppmFrom11490 = calculatePixelsPerMetre(reference[0], reference[1], 11.49);
assert.equal(Math.round(pxToMillimetres(distancePx(reference[0], reference[1]), ppmFrom11490)), 11490);

const area = [
  { x: 100, y: 100 },
  { x: 500, y: 100 },
  { x: 500, y: 300 },
  { x: 100, y: 300 },
];
const baseArea = polygonAreaPx(area);
const transformedArea = area
  .map((point) => planToScreenPoint(point.x, point.y, zoomedViewport))
  .map((point) => screenToPlanPoint(point.x, point.y, zoomedViewport));
assert.equal(polygonAreaPx(transformedArea), baseArea);

const snappedHorizontal = snapAngle({ x: 0, y: 0 }, { x: 10, y: 2 }, [0, 90, 180, 270]);
assert.equal(Math.round(snappedHorizontal.y), 0);
assert.equal(Math.round(distancePx({ x: 0, y: 0 }, snappedHorizontal)), Math.round(Math.sqrt(104)));

const snappedVertical = snapAngle({ x: 0, y: 0 }, { x: 1, y: 10 }, [0, 90, 180, 270]);
assert.equal(Math.round(snappedVertical.x), 0);

const baseLength = distancePx(wall[0], wall[1]);
const zoomedWall = wall
  .map((point) => planToScreenPoint(point.x, point.y, viewState))
  .map((point) => screenToPlanPoint(point.x, point.y, viewState));
assert.equal(distancePx(zoomedWall[0], zoomedWall[1]), baseLength);
assert.equal(pxToMetres(distancePx(zoomedWall[0], zoomedWall[1]), calculatePixelsPerMetre(wall[0], wall[1], 12)), 12);

const measureState = { calibrating: null, activeTool: "measure", drawPoints: [] };
assert.equal(measureState.calibrating, null);
assert.deepEqual(measureState.drawPoints, []);

console.log("planCoordinateUtils: normalized rotation, zoom-to-cursor, area, scale and measurement tests passed");
