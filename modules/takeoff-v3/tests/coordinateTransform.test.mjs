import assert from "node:assert/strict";
import { documentToScreen, screenToDocument } from "../core/coordinateTransform.js";

function makeViewport({ scale = 2, rotation = 0, width = 600, height = 400 } = {}) {
  return {
    convertToViewportPoint(x, y) {
      if (rotation === 90) return [height - y * scale, x * scale];
      if (rotation === 180) return [width - x * scale, height - y * scale];
      if (rotation === 270) return [y * scale, width - x * scale];
      return [x * scale, y * scale];
    },
    convertToPdfPoint(x, y) {
      if (rotation === 90) return [y / scale, (height - x) / scale];
      if (rotation === 180) return [(width - x) / scale, (height - y) / scale];
      if (rotation === 270) return [(width - y) / scale, x / scale];
      return [x / scale, y / scale];
    },
  };
}

for (const rotation of [0, 90, 180, 270]) {
  const view = { viewport: makeViewport({ rotation }), panX: 37, panY: -22, zoomScale: 2.5, devicePixelRatio: 2 };
  const documentPoint = { x: 111.25, y: 72.5 };
  const screen = documentToScreen(view, documentPoint);
  const roundTrip = screenToDocument(view, screen);
  assert.ok(Math.abs(roundTrip.x - documentPoint.x) < 1e-9, `x roundtrip at ${rotation}`);
  assert.ok(Math.abs(roundTrip.y - documentPoint.y) < 1e-9, `y roundtrip at ${rotation}`);
}

const base = { viewport: makeViewport(), panX: 10, panY: 20, zoomScale: 1 };
const zoomed = { ...base, zoomScale: 3, panX: -50, panY: 75 };
assert.deepEqual(screenToDocument(base, documentToScreen(base, { x: 5, y: 8 })), { x: 5, y: 8 });
assert.deepEqual(screenToDocument(zoomed, documentToScreen(zoomed, { x: 5, y: 8 })), { x: 5, y: 8 });

console.log("takeoff-v3 coordinateTransform.test.mjs passed");
