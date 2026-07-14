import assert from "node:assert/strict";
import {
  DEFAULT_PDF_TARGET_DPI,
  MAX_PDF_TARGET_DPI,
  PDF_RASTER_FORMAT,
  PDF_RENDER_DPI,
  buildRasterPageMetadata,
  clampRenderScale,
  clampTargetDpi,
  createRenderMetadata,
  detectOrientationFromTextItems,
  extractDetectedScaleText,
} from "./pdfPlanRendering.js";

assert.equal(DEFAULT_PDF_TARGET_DPI, 300);
assert.equal(MAX_PDF_TARGET_DPI, 400);
assert.equal(PDF_RENDER_DPI, 300);
assert.equal(PDF_RASTER_FORMAT, "PNG");
assert.equal(clampTargetDpi(120), 300);
assert.equal(clampTargetDpi(350), 350);
assert.equal(clampTargetDpi(900), 400);
assert.equal(Math.round(clampRenderScale(1) * 1000), Math.round((300 / 72) * 1000));

assert.deepEqual(createRenderMetadata(300), { dpi: 300, renderScale: 300 / 72, format: "PNG" });
assert.deepEqual(createRenderMetadata(400), { dpi: 400, renderScale: 400 / 72, format: "PNG" });

const rasterPage = buildRasterPageMetadata({
  dataUrl: "data:image/png;base64,abc",
  canvasWidth: 4200,
  canvasHeight: 2970,
  originalWidth: 1008,
  originalHeight: 713,
  metadataRotation: 0,
  detectedRotation: 180,
  userRotation: 0,
  renderScale: 300 / 72,
  dpi: 300,
  sourcePdfPageNumber: 2,
  orientationMethod: "raster-text",
  orientationConfidence: "high",
  orientationConfirmed: true,
  detectedScaleText: "1:100",
});

assert.equal(rasterPage.imageDataUrl, "data:image/png;base64,abc");
assert.equal(rasterPage.imageWidth, 4200);
assert.equal(rasterPage.imageHeight, 2970);
assert.equal(rasterPage.normalizedWidth, 4200);
assert.equal(rasterPage.normalizedHeight, 2970);
assert.equal(rasterPage.format, "PNG");
assert.equal(rasterPage.dpi, 300);
assert.equal(rasterPage.sourcePdfPageNumber, 2);
assert.equal(rasterPage.finalRotation, 180);
assert.equal(rasterPage.orientationConfirmed, true);
assert.equal(rasterPage.detectedScaleText, "1:100");

const upsideDownText = [
  { str: "GROUND FLOOR PLAN", transform: [-10, 0, 0, -10, 100, 100] },
  { str: "SCALE 1:100", transform: [-10, 0, 0, -10, 200, 120] },
  { str: "BEDROOM", transform: [-10, 0, 0, -10, 300, 140] },
];
const orientation = detectOrientationFromTextItems(upsideDownText, 0);
assert.equal(orientation.detectedRotation, 180);
assert.equal(orientation.method, "raster-text");
assert.equal(orientation.confidence, "high");

assert.equal(extractDetectedScaleText("GROUND FLOOR PLAN SCALE 1:100 @ A3"), "1:100");
assert.equal(extractDetectedScaleText("1 : 200"), "1:200");
assert.equal(extractDetectedScaleText("printed @ A3"), "@ A3");
assert.equal(extractDetectedScaleText("no scale here"), "");

console.log("pdfPlanRendering: raster metadata, orientation and scale text tests passed");
