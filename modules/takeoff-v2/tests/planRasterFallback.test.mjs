import assert from "node:assert/strict";
import { scanDarkRunsFromImageData } from "../geometry/planRasterFallback.js";

const WIDTH = 20;
const HEIGHT = 10;

function makeWhiteCanvas(width, height) {
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  return data;
}

function paintPixel(data, width, x, y) {
  const idx = (y * width + x) * 4;
  data[idx] = 0;
  data[idx + 1] = 0;
  data[idx + 2] = 0;
  data[idx + 3] = 255;
}

const data = makeWhiteCanvas(WIDTH, HEIGHT);

// A horizontal dark run along y=5, x=2..13 (12px long).
for (let x = 2; x <= 13; x += 1) paintPixel(data, WIDTH, x, 5);
// A vertical dark run along x=17, y=0..8 (9px long).
for (let y = 0; y <= 8; y += 1) paintPixel(data, WIDTH, 17, y);

const segments = scanDarkRunsFromImageData({ data, width: WIDTH, height: HEIGHT }, { minRunPx: 5, rowStep: 1 });

const horizontal = segments.filter((s) => s.axis === "horizontal");
const vertical = segments.filter((s) => s.axis === "vertical");

assert.ok(horizontal.length >= 1, "expected at least one horizontal run");
const hRun = horizontal.find((s) => s.a.y === 5);
assert.ok(hRun, "expected a horizontal run at y=5");
assert.equal(hRun.a.x, 2);
assert.ok(hRun.b.x >= 12, `expected the run to span most of x=2..13, got b.x=${hRun.b.x}`);

assert.ok(vertical.length >= 1, "expected at least one vertical run");
const vRun = vertical.find((s) => s.a.x === 17);
assert.ok(vRun, "expected a vertical run at x=17");
assert.equal(vRun.a.y, 0);
assert.ok(vRun.b.y >= 7, `expected the run to span most of y=0..8, got b.y=${vRun.b.y}`);

// A run shorter than minRunPx must not appear.
const shortData = makeWhiteCanvas(WIDTH, HEIGHT);
for (let x = 2; x <= 4; x += 1) paintPixel(shortData, WIDTH, x, 3); // 3px, below minRunPx=5
const shortSegments = scanDarkRunsFromImageData({ data: shortData, width: WIDTH, height: HEIGHT }, { minRunPx: 5, rowStep: 1 });
assert.equal(shortSegments.filter((s) => s.a.y === 3).length, 0);

console.log("planRasterFallback.test.mjs passed");
