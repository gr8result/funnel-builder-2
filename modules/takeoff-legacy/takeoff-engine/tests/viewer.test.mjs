import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRasterPage, createTakeoffDocument } from "../core/types.js";
import { calculateFitView, screenToImagePoint, zoomToScreenPoint } from "../core/viewTransform.js";
import { TAKEOFF_ACTIONS, takeoffReducer } from "../state/takeoffReducer.js";

function getActivePage(state) {
  return state.pages.find((page) => page.id === state.activePageId) || state.pages[0] || null;
}

const page = createRasterPage({
  id: "page-1",
  imageDataUrl: "data:image/png;base64,abc",
  imageWidth: 4200,
  imageHeight: 2970,
  orientation: {
    confidence: "low",
    warning: "Orientation may need checking",
    orientationConfirmed: false,
  },
});

const state = createTakeoffDocument({
  pages: [page],
  activePageId: "page-1",
});

const controlsSource = readFileSync(new URL("../viewer/TakeoffControls.jsx", import.meta.url), "utf8");
const canvasSource = readFileSync(new URL("../viewer/TakeoffCanvas.jsx", import.meta.url), "utf8");
const viewerSource = readFileSync(new URL("../viewer/TakeoffViewer.jsx", import.meta.url), "utf8");

assert.match(controlsSource, /Fit/);
assert.match(controlsSource, /100%/);
assert.match(controlsSource, /200%/);
assert.match(controlsSource, /400%/);
assert.match(controlsSource, /Rotate 90/);
assert.match(controlsSource, /Rotate 180/);
assert.match(controlsSource, /Rotate 270/);
assert.match(controlsSource, /Set orientation as correct/);
assert.match(controlsSource, /Set Scale/);
assert.match(controlsSource, /Measure/);
assert.match(controlsSource, /Area/);
assert.match(controlsSource, /Orientation may need checking/);
assert.match(canvasSource, /openseadragon/);
assert.match(canvasSource, /generateTilePyramid/);
assert.match(canvasSource, /getTileUrl/);
assert.match(canvasSource, /viewerElementToImageCoordinates/);
assert.match(canvasSource, /imageToViewerElementCoordinates/);
assert.match(viewerSource, /CONFIRM_ORIENTATION/);
assert.match(viewerSource, /rotateRasterPage/);
assert.match(viewerSource, /REPLACE_PAGE/);
assert.match(viewerSource, /setFitRequestKey/);

const fit = calculateFitView({
  containerWidth: 1000,
  containerHeight: 700,
  imageWidth: 4200,
  imageHeight: 2970,
  padding: 24,
});
assert.equal(Number(fit.zoom.toFixed(3)), 0.22);
assert.equal(Number(fit.panX.toFixed(1)), 39);
assert.equal(Number(fit.panY.toFixed(1)), 24);

const pointer = { x: 500, y: 350 };
const beforeImagePoint = screenToImagePoint(pointer, fit);
const zoomed = zoomToScreenPoint(fit, pointer, fit.zoom * 2);
const afterImagePoint = screenToImagePoint(pointer, zoomed);
assert.equal(Number(beforeImagePoint.x.toFixed(6)), Number(afterImagePoint.x.toFixed(6)));
assert.equal(Number(beforeImagePoint.y.toFixed(6)), Number(afterImagePoint.y.toFixed(6)));

const withView = takeoffReducer(state, {
  type: TAKEOFF_ACTIONS.SET_VIEW_STATE,
  payload: { viewState: zoomed },
});
assert.equal(getActivePage(withView).viewState.zoom, zoomed.zoom);
assert.equal(getActivePage(withView).viewState.panX, zoomed.panX);

const rotated = takeoffReducer(state, {
  type: TAKEOFF_ACTIONS.ROTATE_PAGE,
  payload: { deltaRotation: 180 },
});
assert.equal(getActivePage(rotated).orientation.userRotation, 180);
assert.equal(getActivePage(rotated).orientation.orientationConfirmed, false);

const confirmed = takeoffReducer(rotated, { type: TAKEOFF_ACTIONS.CONFIRM_ORIENTATION });
assert.equal(getActivePage(confirmed).orientation.orientationConfirmed, true);
assert.equal(getActivePage(confirmed).orientation.confidence, "confirmed");

const pageWithMeasurements = createTakeoffDocument({
  pages: [
    createRasterPage({
      id: "page-with-measurements",
      imageDataUrl: "data:image/png;base64,abc",
      imageWidth: 300,
      imageHeight: 200,
      scale: { pointA: { x: 0, y: 0 }, pointB: { x: 100, y: 0 }, referenceDistanceMm: 1000 },
      measurements: [{ id: "measurement-1", points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] }],
      areas: [{ id: "area-1", points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }] }],
    }),
  ],
  activePageId: "page-with-measurements",
});
const resetOverlaysAfterRotation = takeoffReducer(pageWithMeasurements, {
  type: TAKEOFF_ACTIONS.ROTATE_PAGE,
  payload: { deltaRotation: 90 },
});
assert.equal(getActivePage(resetOverlaysAfterRotation).scale, null);
assert.equal(getActivePage(resetOverlaysAfterRotation).measurements.length, 0);
assert.equal(getActivePage(resetOverlaysAfterRotation).areas.length, 0);

const importedPages = [
  createRasterPage({
    id: "imported-page-1",
    sourceFileName: "registered-job-plan.pdf",
    imageDataUrl: "data:image/png;base64,page1",
    imageWidth: 5100,
    imageHeight: 3300,
  }),
];
const importedState = importedPages.reduce((currentState, importedPage) => takeoffReducer(currentState, {
  type: TAKEOFF_ACTIONS.ADD_PAGE,
  payload: importedPage,
}), createTakeoffDocument({ pages: [], activePageId: null }));
assert.equal(importedState.pages.length, 1);
assert.equal(importedState.activePageId, "imported-page-1");
assert.equal(getActivePage(importedState)?.id, "imported-page-1");

console.log("viewer tests passed");
