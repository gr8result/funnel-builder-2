import assert from "node:assert/strict";
import { createPdfRasterPageObject, detectOrientationFromTextContent, calculatePdfRenderScale, renderPdfPageToRaster, textContentToString } from "../import/pdfToRaster.js";
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

const previousDocument = globalThis.document;
let renderedRotation = null;
globalThis.document = {
  createElement(name) {
    assert.equal(name, "canvas");
    return {
      width: 0,
      height: 0,
      getContext() {
        return {};
      },
      toDataURL() {
        return "data:image/png;base64,upright";
      },
    };
  },
};

const fakePdfPage = {
  pageNumber: 1,
  rotate: 90,
  getTextContent: async () => ({
    items: [
      { str: "GROUND FLOOR PLAN", transform: [0, 1, -1, 0, 0, 0] },
      { str: "SCALE 1:100", transform: [0, 1, -1, 0, 0, 0] },
    ],
  }),
  getViewport({ rotation }) {
    renderedRotation = rotation;
    return { width: rotation === 90 || rotation === 270 ? 200 : 300, height: rotation === 90 || rotation === 270 ? 300 : 200 };
  },
  render() {
    return { promise: Promise.resolve() };
  },
  getOperatorList: async () => ({
    fnArray: [1, 2],
    argsArray: [[0, 0], [100, 0]],
  }),
};

const renderedPdfPage = await renderPdfPageToRaster(fakePdfPage, {
  sourceFileName: "rotated.pdf",
  sourcePdfDataUrl: "data:application/pdf;base64,abc",
  sourceFingerprint: "sha256-test",
  pdfjsLib: { OPS: { moveTo: 1, lineTo: 2 } },
});
assert.equal(renderedRotation, 0);
assert.equal(renderedPdfPage.orientation.metadataRotation, 90);
assert.equal(renderedPdfPage.orientation.detectedRotation, 270);
assert.equal(renderedPdfPage.orientation.appliedRotation, 0);
assert.equal(renderedPdfPage.pdfMetadataRotation, 90);
assert.equal(renderedPdfPage.finalRotation, 0);
assert.equal(renderedPdfPage.manualRotation, null);
assert.equal(renderedPdfPage.orientationConfidence, "high");
assert.equal(renderedPdfPage.metadata.orientationMode, "auto");
assert.equal(renderedPdfPage.metadata.sourcePdfDataUrl, "data:application/pdf;base64,abc");
assert.equal(renderedPdfPage.originalFileUrl, "data:application/pdf;base64,abc");
assert.equal(renderedPdfPage.fileHash, "sha256-test");
assert.equal(renderedPdfPage.pageWidthPoints, 300);
assert.equal(renderedPdfPage.pageHeightPoints, 200);
assert.equal(renderedPdfPage.rasterPreviewUrl, "data:image/png;base64,upright");
assert.equal(renderedPdfPage.textData.length, 2);
assert.equal(renderedPdfPage.vectorData.lineSegments.length, 1);
assert.equal(renderedPdfPage.vectorData.lineSegments[0].source, "pdf-operator");
assert.deepEqual(renderedPdfPage.detections, {
  walls: [],
  rooms: [],
  openings: [],
  columns: [],
  structuralElements: [],
});

globalThis.document = previousDocument;

console.log("import tests passed");
