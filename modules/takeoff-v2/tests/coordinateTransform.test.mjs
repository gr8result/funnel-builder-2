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

function makeRotatedViewport({ scale = 1, rotation = 0, width = 842, height = 1191 }) {
  return {
    convertToViewportPoint: (x, y) => {
      if (rotation === 90) return [y * scale, (width - x) * scale];
      if (rotation === 180) return [(width - x) * scale, (height - y) * scale];
      if (rotation === 270) return [(height - y) * scale, x * scale];
      return [x * scale, y * scale];
    },
    convertToPdfPoint: (x, y) => {
      const sx = x / scale;
      const sy = y / scale;
      if (rotation === 90) return [width - sy, sx];
      if (rotation === 180) return [width - sx, height - sy];
      if (rotation === 270) return [sy, height - sx];
      return [sx, sy];
    },
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

for (const rotation of [0, 90, 180, 270]) {
  for (const zoomScale of [0.5, 1, 2.75, 6]) {
    for (const pan of [{ x: 0, y: 0 }, { x: -120, y: 48 }, { x: 320.25, y: -77.5 }]) {
      const rotated = { viewport: makeRotatedViewport({ scale: 1.7, rotation }), panX: pan.x, panY: pan.y, zoomScale };
      for (const point of [{ x: 0, y: 0 }, { x: 100, y: 50 }, { x: 418.5, y: 763.25 }, { x: 841.5, y: 1190.5 }]) {
        const projected = pageToScreenPoint(rotated, point.x, point.y);
        const restored = screenToPagePoint(rotated, projected.x, projected.y);
        assert.ok(Math.abs(restored.x - point.x) < 1e-9, `x round-trip failed at rotation ${rotation}`);
        assert.ok(Math.abs(restored.y - point.y) < 1e-9, `y round-trip failed at rotation ${rotation}`);
      }
    }
  }
}

console.log("coordinateTransform.test.mjs passed");
