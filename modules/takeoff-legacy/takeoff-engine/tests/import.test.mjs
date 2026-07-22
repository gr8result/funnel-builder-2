import assert from "node:assert/strict";
import { createPdfRasterPageObject, detectOrientationFromTextContent, calculatePdfRenderScale, textContentToString } from "../import/pdfToRaster.js";
import { getRotatedRasterDimensions, normalizeRasterImagePage } from "../import/imageNormalizer.js";
import { detectScaleSuggestions, extractDimensionText, extractScaleText } from "../import/scaleTextDetection.js";

assert.equal(calculatePdfRenderScale(300), 300 / 72);
assert.equal(calculatePdfRenderScale(96), 300 / 72);
assert.deepEqual(getRotatedRasterDimensions(300, 200, 90), { width: 200, height: 300 });
assert.deepEqual(getRotatedRasterDimensions(300, 200, 180), { width: 300, height: 200 });

const textContent = {
  items: [
    { str: "GROUND FLOOR PLAN", transform: [1, 0, 0, 1, 10, 10] },
    { str: "SCALE 1:100 @ A3", transform: [1, 0, 0, 1, 20, 20] },
  ],
};

assert.equal(textContentToString(textContent), "GROUND FLOOR PLAN SCALE 1:100 @ A3");

const scaleText = extractScaleText(textContentToString(textContent));
assert.deepEqual(scaleText.map((candidate) => candidate.normalized), ["1:100", "@ A3"]);

const scaleDetection = detectScaleSuggestions({
  text: "SCALE 1:100 @ A3 REF 11,490 9600",
  dpi: 300,
});
assert.equal(scaleDetection.bestSuggestion.label, "Suggested scale: 1:100");
assert.equal(scaleDetection.bestSuggestion.requiresConfirmation, true);
assert.equal(scaleDetection.bestSuggestion.ratio, 100);
assert.deepEqual(scaleDetection.dimensionCandidates.map((candidate) => candidate.valueMm), [11490, 9600]);
assert.deepEqual(extractDimensionText("11490 11,490 9600 9,600").map((candidate) => candidate.valueMm), [11490, 9600]);

const orientation = detectOrientationFromTextContent(textContent);
assert.equal(orientation.confidence, "high");
assert.equal(orientation.detectedRotation, 0);

const upsideDown = detectOrientationFromTextContent({
  items: [
    { str: "TITLE BLOCK", transform: [-1, 0, 0, -1, 0, 0] },
    { str: "GROUND FLOOR", transform: [-1, 0, 0, -1, 0, 0] },
  ],
});
assert.equal(upsideDown.confidence, "high");
assert.equal(upsideDown.detectedRotation, 180);

const rasterPage = createPdfRasterPageObject({
  pageNumber: 2,
  sourceFileName: "plan.pdf",
  imageDataUrl: "data:image/png;base64,abc",
  imageWidth: 4200,
  imageHeight: 2970,
  dpi: 300,
  metadataRotation: 0,
  orientationDetection: orientation,
  textContent,
});

assert.equal(rasterPage.sourceType, "pdf");
assert.equal(rasterPage.sourcePdfPageNumber, 2);
assert.equal(rasterPage.format, "PNG");
assert.equal(rasterPage.dpi, 300);
assert.equal(rasterPage.imageWidth, 4200);
assert.equal(rasterPage.imageHeight, 2970);
assert.equal(rasterPage.orientation.orientationConfirmed, false);
assert.equal(rasterPage.orientation.confidence, "high");
assert.equal(rasterPage.metadata.detectedScaleText, "1:100");
assert.equal(rasterPage.metadata.suggestedScale.label, "Suggested scale: 1:100");
assert.equal(rasterPage.metadata.suggestedScale.requiresConfirmation, true);

const lowConfidencePage = normalizeRasterImagePage({
  imageDataUrl: "data:image/png;base64,abc",
  imageWidth: 100,
  imageHeight: 200,
  dpi: 300,
  orientation: {
    detectedRotation: 180,
    confidence: "low",
    method: "text-layer",
  },
});

assert.equal(lowConfidencePage.orientation.finalRotation, 180);
assert.equal(lowConfidencePage.orientation.trusted, false);
assert.equal(lowConfidencePage.orientation.warning, "Orientation may need checking");
assert.equal(lowConfidencePage.metadata.orientationNeedsReview, true);

console.log("import tests passed");
