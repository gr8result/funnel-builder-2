import assert from "node:assert/strict";
import { analyzeRasterOrientation, applyOrientationAnalysisToRaster } from "../analysis/imageOrientationAnalysis.js";
import { analyzePdfTextDirection } from "../analysis/imageTextAnalysis.js";
import { scoreTitleBlockOrientation } from "../analysis/titleBlockDetection.js";
import { scoreDrawingBoundsOrientation } from "../analysis/drawingBoundsAnalysis.js";

const upsideDownText = {
  items: [
    { str: "GROUND FLOOR PLAN", transform: [-1, 0, 0, -1, 0, 0] },
    { str: "SCALE 1:100", transform: [-1, 0, 0, -1, 0, 0] },
  ],
};
const upsideDownTextAnalysis = analyzePdfTextDirection(upsideDownText);
assert.equal(upsideDownTextAnalysis.selectedRotation, 180);

const upsideDownOrientation = await analyzeRasterOrientation({
  imageDataUrl: "data:image/png;base64,abc",
  imageWidth: 4000,
  imageHeight: 2800,
  pdfTextContent: upsideDownText,
  titleBlock: { titleBlockPosition: "top-left" },
});
assert.equal(upsideDownOrientation.selectedRotation, 180);
assert.equal(upsideDownOrientation.confidence, "high");

const uncorroboratedUpsideDownText = await analyzeRasterOrientation({
  imageDataUrl: "data:image/png;base64,abc",
  imageWidth: 4000,
  imageHeight: 2800,
  pdfTextContent: upsideDownText,
});
assert.equal(uncorroboratedUpsideDownText.selectedRotation, 180);
assert.equal(uncorroboratedUpsideDownText.autoApplied, true);

const metadataOnly180 = await analyzeRasterOrientation({
  imageDataUrl: "data:image/png;base64,abc",
  imageWidth: 4000,
  imageHeight: 2800,
  metadataRotation: 180,
});
assert.equal(metadataOnly180.selectedRotation, 0);
assert.equal(metadataOnly180.sources.metadata.metadataRotation, 180);

const sidewaysText = {
  items: [
    { str: "BEDROOM", transform: [0, 1, -1, 0, 0, 0] },
    { str: "KITCHEN", transform: [0, 1, -1, 0, 0, 0] },
  ],
};
const sidewaysTextAnalysis = analyzePdfTextDirection(sidewaysText);
assert.ok([90, 270].includes(sidewaysTextAnalysis.selectedRotation));

const sidewaysOrientation = await analyzeRasterOrientation({
  imageDataUrl: "data:image/png;base64,abc",
  imageWidth: 2800,
  imageHeight: 4000,
  pdfTextContent: sidewaysText,
});
assert.ok([90, 270].includes(sidewaysOrientation.selectedRotation));

const titleBlockAnalysis = scoreTitleBlockOrientation({
  imageWidth: 4000,
  imageHeight: 2800,
  titleBlockPosition: "top-left",
});
assert.equal(titleBlockAnalysis.selectedRotation, 180);
assert.ok(titleBlockAnalysis.scores[180] > titleBlockAnalysis.scores[0]);

const titleDrivenOrientation = await analyzeRasterOrientation({
  imageDataUrl: "data:image/png;base64,abc",
  imageWidth: 4000,
  imageHeight: 2800,
  titleBlock: { titleBlockPosition: "top-left" },
});
assert.equal(titleDrivenOrientation.selectedRotation, 180);

const boundsAnalysis = scoreDrawingBoundsOrientation({
  imageWidth: 2200,
  imageHeight: 4200,
});
assert.equal(boundsAnalysis.selectedRotation, 90);

const applied = await applyOrientationAnalysisToRaster({
  imageDataUrl: "data:image/png;base64,abc",
  imageWidth: 300,
  imageHeight: 200,
  orientationAnalysis: { selectedRotation: 90, confidence: "high" },
  rotateRaster: async ({ imageDataUrl, rotation }) => ({
    imageDataUrl: `${imageDataUrl}:rotated-${rotation}`,
    imageWidth: 200,
    imageHeight: 300,
    rotation,
  }),
});
assert.equal(applied.rotation, 90);
assert.equal(applied.imageWidth, 200);
assert.equal(applied.imageHeight, 300);
assert.match(applied.imageDataUrl, /rotated-90/);

const lowConfidenceSkipped = await applyOrientationAnalysisToRaster({
  imageDataUrl: "data:image/png;base64,abc",
  imageWidth: 300,
  imageHeight: 200,
  orientationAnalysis: { selectedRotation: 90, suggestedRotation: 90, confidence: "low" },
  rotateRaster: async ({ imageDataUrl, rotation }) => ({
    imageDataUrl: `${imageDataUrl}:rotated-${rotation}`,
    imageWidth: 200,
    imageHeight: 300,
    rotation,
  }),
});
assert.equal(lowConfidenceSkipped.rotation, 0);
assert.equal(lowConfidenceSkipped.imageWidth, 300);
assert.doesNotMatch(lowConfidenceSkipped.imageDataUrl, /rotated/);

const confirmed = await analyzeRasterOrientation({
  imageDataUrl: "data:image/png;base64,abc",
  imageWidth: 300,
  imageHeight: 200,
  pdfTextContent: upsideDownText,
  currentOrientation: {
    orientationConfirmed: true,
    finalRotation: 0,
  },
});
assert.equal(confirmed.skipAutoOrientation, true);
assert.equal(confirmed.selectedRotation, 0);
assert.equal(confirmed.confidence, "confirmed");

console.log("analysis tests passed");
