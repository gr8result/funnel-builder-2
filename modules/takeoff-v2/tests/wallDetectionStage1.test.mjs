import assert from "node:assert/strict";
import { detectExteriorWalls } from "../takeoff/wallDetection.js";

globalThis.fetch = async () => {
  throw new Error("Stage 1 must not call image or AI exterior detection");
};

const result = await detectExteriorWalls({
  imageDataUrl: "data:image/png;base64,ignored",
  imageWidth: 100,
  imageHeight: 100,
  viewport: { convertToPdfPoint: (x, y) => [x, y] },
  planGeometryIndex: { lines: [], segments: [] },
});

assert.equal(result.connected, false);
assert.equal(result.code, "GEOMETRY_REQUIRED");
assert.equal(result.segments.length, 0);
assert.match(result.message, /disabled for Stage 1/);

console.log("wallDetectionStage1.test.mjs passed");
