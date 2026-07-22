import assert from "node:assert/strict";
import { calculateFitView, imageToScreenPoint, panView, screenToImagePoint, zoomToScreenPoint } from "../core/viewTransform.js";

const view = { zoom: 2, panX: 100, panY: 50 };
const imagePoint = { x: 200, y: 125 };
const screenPoint = imageToScreenPoint(imagePoint, view);

assert.deepEqual(screenPoint, { x: 500, y: 300 });
assert.deepEqual(screenToImagePoint(screenPoint, view), imagePoint);

const zoomed = zoomToScreenPoint(view, screenPoint, 4);
assert.deepEqual(screenToImagePoint(screenPoint, zoomed), imagePoint);

const panned = panView(view, 25, -10);
assert.deepEqual(panned, { zoom: 2, panX: 125, panY: 40, minZoom: 0.1, maxZoom: 10 });

const fit = calculateFitView({
  containerWidth: 1000,
  containerHeight: 600,
  imageWidth: 2000,
  imageHeight: 1000,
  padding: 20,
});
assert.equal(fit.zoom, 0.48);
assert.equal(fit.panX, 20);
assert.equal(fit.panY, 60);

console.log("view transform tests passed");

