import assert from "node:assert/strict";
import { pageToScreenPoint } from "../viewer/pageToScreenPoint.js";
import { screenToPagePoint } from "../viewer/screenToPagePoint.js";

// Fake pdfjs-style viewport: page space -> canvas space is a simple scale (no
// rotation, to keep the fixture legible) so this test exercises the pan/zoom
// affine that pageToScreenPoint/screenToPagePoint own, on top of whatever the
// real pdfjs viewport does.
function makeScaledViewport(scale) {
  return {
    convertToViewportPoint: (x, y) => [x * scale, y * scale],
    convertToPdfPoint: (x, y) => [x / scale, y / scale],
  };
}

const viewport = makeScaledViewport(2);

// No pan/zoom: page point (100, 50) at render scale 2 -> canvas (200, 100).
assert.deepEqual(pageToScreenPoint({ viewport }, 100, 50), { x: 200, y: 100 });

// With pan (10, 20) and zoomScale 1.5 on top of the render scale.
const view = { viewport, panX: 10, panY: 20, zoomScale: 1.5 };
const screen = pageToScreenPoint(view, 100, 50);
assert.deepEqual(screen, { x: 200 * 1.5 + 10, y: 100 * 1.5 + 20 });

// Round-trip: screenToPagePoint must invert pageToScreenPoint exactly.
const roundTripped = screenToPagePoint(view, screen.x, screen.y);
assert.ok(Math.abs(roundTripped.x - 100) < 1e-9);
assert.ok(Math.abs(roundTripped.y - 50) < 1e-9);

// Zero point stays put when there's no pan.
const originView = { viewport, panX: 0, panY: 0, zoomScale: 1 };
assert.deepEqual(pageToScreenPoint(originView, 0, 0), { x: 0, y: 0 });

console.log("coordinateTransform.test.mjs passed");
