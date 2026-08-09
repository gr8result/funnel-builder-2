import assert from "node:assert/strict";
import {
  clampSharpRenderScale,
  MAX_RENDER_CANVAS_DIMENSION,
  MAX_RENDER_CANVAS_PIXELS,
} from "../viewer/PdfViewport.js";

// Well within limits: returns the requested scale unchanged.
const small = clampSharpRenderScale({
  baseScale: 1, zoomScale: 2, unrotatedWidth: 612, unrotatedHeight: 792, rotation: 0, pixelRatio: 2,
});
assert.ok(Math.abs(small - 2) < 1e-9, `expected ~2, got ${small}`);

// Extreme zoom: backing store must stay within both the per-side and total-pixel caps.
const huge = clampSharpRenderScale({
  baseScale: 1, zoomScale: 50, unrotatedWidth: 612, unrotatedHeight: 792, rotation: 0, pixelRatio: 2,
});
const backingWidth = 612 * huge * 2;
const backingHeight = 792 * huge * 2;
assert.ok(backingWidth <= MAX_RENDER_CANVAS_DIMENSION + 1e-6, `width ${backingWidth} exceeds cap`);
assert.ok(backingHeight <= MAX_RENDER_CANVAS_DIMENSION + 1e-6, `height ${backingHeight} exceeds cap`);
assert.ok(backingWidth * backingHeight <= MAX_RENDER_CANVAS_PIXELS + 1, "pixel count exceeds cap");
assert.ok(huge < 50, "extreme zoom must be capped below the requested scale");

// Rotation swaps which source dimension maps to canvas width/height.
const portrait = clampSharpRenderScale({ baseScale: 1, zoomScale: 30, unrotatedWidth: 400, unrotatedHeight: 3000, rotation: 0, pixelRatio: 2 });
const rotated = clampSharpRenderScale({ baseScale: 1, zoomScale: 30, unrotatedWidth: 400, unrotatedHeight: 3000, rotation: 90, pixelRatio: 2 });
const portraitBacking = { width: 400 * portrait * 2, height: 3000 * portrait * 2 };
const rotatedBacking = { width: 3000 * rotated * 2, height: 400 * rotated * 2 };
assert.ok(portraitBacking.height <= MAX_RENDER_CANVAS_DIMENSION + 1e-6, "portrait height exceeds cap");
assert.ok(rotatedBacking.width <= MAX_RENDER_CANVAS_DIMENSION + 1e-6, "rotated width exceeds cap");
assert.ok(portraitBacking.height > portraitBacking.width, "portrait backing dimensions should remain portrait");
assert.ok(rotatedBacking.width > rotatedBacking.height, "rotated backing dimensions should become landscape");

// Degenerate inputs don't throw or divide by zero into NaN/Infinity misuse.
const zeroDims = clampSharpRenderScale({ baseScale: 1, zoomScale: 2, unrotatedWidth: 0, unrotatedHeight: 0, rotation: 0, pixelRatio: 2 });
assert.equal(zeroDims, 2);

console.log("clampSharpRenderScale.test.mjs passed");
