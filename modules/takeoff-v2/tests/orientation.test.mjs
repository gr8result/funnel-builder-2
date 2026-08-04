import assert from "node:assert/strict";
import {
  classifyTextItem,
  scoreOrientationCandidates,
  confidenceTier,
  CONFIDENCE_HIGH,
  CONFIDENCE_MEDIUM,
} from "../orientation/analyzeOrientation.js";
import { applyOrientationResult } from "../orientation/applyOrientationResult.js";
import { applyManualOrientationState, resetToDetectedOrientationState } from "../orientation/orientationState.js";
import { scoreVectorLayoutOrientation } from "../orientation/vectorLayoutOrientation.js";
import { CURRENT_ORIENTATION_STATE_VERSION, normaliseQuarterTurn, sourceOrientationToCorrection, withPlanPageDefaults } from "../types.js";

assert.equal(normaliseQuarterTurn(-90), 270);
assert.equal(normaliseQuarterTurn(450), 90);
assert.equal(sourceOrientationToCorrection(90), 270);
assert.equal(sourceOrientationToCorrection(270), 90);
assert.equal(sourceOrientationToCorrection(180), 180);
assert.equal(sourceOrientationToCorrection(0), 0);

// classifyTextItem: angle comes from atan2(b, a) of the transform.
const upright = classifyTextItem({ str: "SITE PLAN", transform: [12, 0, 0, 12, 0, 0] });
assert.equal(upright.angle, 0);
assert.equal(upright.isKeyword, true);
assert.ok(upright.weight > 30); // fontSize contribution + keyword bonus

const sideways = classifyTextItem({ str: "SITE PLAN", transform: [0, 12, -12, 0, 0, 0] }); // rotated 90deg
assert.equal(sideways.angle, 90);

const upsideDown = classifyTextItem({ str: "SITE PLAN", transform: [-12, 0, 0, -12, 0, 0] }); // 180deg
assert.equal(upsideDown.angle, 180);

// Trivial/short strings are ignored.
assert.equal(classifyTextItem({ str: "", transform: [10, 0, 0, 10, 0, 0] }), null);
assert.equal(classifyTextItem({ str: "x", transform: [10, 0, 0, 10, 0, 0] }), null);

// Dimension-like text is kept but heavily down-weighted vs a real keyword at the same font size.
const dimension = classifyTextItem({ str: "3600", transform: [10, 0, 0, 10, 0, 0] });
const keyword = classifyTextItem({ str: "KITCHEN", transform: [10, 0, 0, 10, 0, 0] });
assert.ok(dimension.weight < keyword.weight);

// A page whose text is entirely upright at rotation 0 should score rotation 0 highest.
const uprightPage = scoreOrientationCandidates({
  textItems: [
    classifyTextItem({ str: "SITE PLAN", transform: [20, 0, 0, 20, 0, 0] }),
    classifyTextItem({ str: "PROPOSED DWELLING", transform: [10, 0, 0, 10, 0, 0] }),
    classifyTextItem({ str: "3600", transform: [6, 0, 0, 6, 0, 0] }),
  ],
  sourceWidth: 595,
  sourceHeight: 842,
});
assert.equal(uprightPage.bestRotation, 0);
assert.ok(uprightPage.confidence >= CONFIDENCE_HIGH, `expected high confidence, got ${uprightPage.confidence}`);
assert.equal(confidenceTier(uprightPage), "high");

// A page whose text is all rotated -90 (i.e. reads correctly only once the
// page itself is rotated +90) should score rotation 90 highest — this is the
// SAMPLE PLANS.pdf "SITE PLAN" real-world case.
const sidewaysPage = scoreOrientationCandidates({
  textItems: [
    classifyTextItem({ str: "SITE PLAN", transform: [0, -20, 20, 0, 0, 0] }),
    classifyTextItem({ str: "PROPOSED DWELLING", transform: [0, -10, 10, 0, 0, 0] }),
  ],
  sourceWidth: 595,
  sourceHeight: 842,
});
assert.equal(sidewaysPage.bestRotation, 90);

// No text at all (scanned page) -> no signal, tier "none".
const scannedPage = scoreOrientationCandidates({ textItems: [], sourceWidth: 595, sourceHeight: 842 });
assert.equal(scannedPage.hasSignal, false);
assert.equal(confidenceTier(scannedPage), "none");

const lowConfidenceApplied = applyOrientationResult(
  { id: "page-1", rotation: 0 },
  { bestRotation: 270, detectedCorrection: 270, pdfMetadataRotation: 0, source: "raster-analysis", confidence: 36, tier: "low" }
);
assert.equal(lowConfidenceApplied.rotation, 270);
assert.equal(lowConfidenceApplied.orientationState.finalAppliedRotation, 270);
assert.equal(lowConfidenceApplied.orientationState.detectedCorrection, 270);
assert.equal(lowConfidenceApplied.orientationSource, "auto");

const manualOverride = applyManualOrientationState(lowConfidenceApplied.orientationState, 90);
assert.equal(manualOverride.finalAppliedRotation, 90);
assert.equal(manualOverride.detectedCorrection, 270);
assert.equal(manualOverride.source, "manual");
const resetManual = resetToDetectedOrientationState(manualOverride);
assert.equal(resetManual.finalAppliedRotation, 270);
assert.equal(resetManual.detectedCorrection, 270);
assert.equal(resetManual.source, "raster-analysis");

const staleManualZero = withPlanPageDefaults({
  id: "stale-page",
  rotation: 0,
  orientationSource: "manual",
  orientationConfirmed: true,
  orientationState: {
    source: "manual",
    manualOverride: 0,
    detectedCorrection: 270,
    finalAppliedRotation: 0,
    confidence: 100,
  },
});
assert.equal(staleManualZero.orientationSource, null);
assert.equal(staleManualZero.orientationConfirmed, false);
assert.equal(staleManualZero.rotation, 270);
assert.equal(staleManualZero.orientationState.version, 0);
assert.equal(staleManualZero.orientationState.source, "metadata");

const currentManualZero = withPlanPageDefaults({
  id: "current-page",
  rotation: 0,
  orientationSource: "manual",
  orientationConfirmed: true,
  orientationState: {
    version: CURRENT_ORIENTATION_STATE_VERSION,
    source: "manual",
    manualOverride: 0,
    detectedCorrection: 270,
    finalAppliedRotation: 0,
    confidence: 100,
  },
});
assert.equal(currentManualZero.orientationSource, "manual");
assert.equal(currentManualZero.orientationConfirmed, true);
assert.equal(currentManualZero.rotation, 0);
assert.equal(currentManualZero.orientationState.source, "manual");

// Ambiguous: two candidates with roughly equal keyword weight should NOT be high confidence.
const ambiguousPage = scoreOrientationCandidates({
  textItems: [
    classifyTextItem({ str: "KITCHEN", transform: [10, 0, 0, 10, 0, 0] }), // 0deg
    classifyTextItem({ str: "GARAGE", transform: [0, 10, -10, 0, 0, 0] }), // 90deg
  ],
  sourceWidth: 595,
  sourceHeight: 842,
});
assert.ok(ambiguousPage.confidence < CONFIDENCE_HIGH);

// Landscape prior is small: a single strong upright keyword on a landscape
// page must still win at 0deg even though 0deg isn't the "landscape" pick
// when sourceWidth < sourceHeight (portrait source, rotated to landscape at 90/270).
const strongTextBeatsLandscapePrior = scoreOrientationCandidates({
  textItems: [classifyTextItem({ str: "FLOOR PLAN", transform: [24, 0, 0, 24, 0, 0] })],
  sourceWidth: 400, // portrait source; 90/270 would be "landscape" and get the small prior
  sourceHeight: 800,
});
assert.equal(strongTextBeatsLandscapePrior.bestRotation, 0);

const leftTitleStripSegments = Array.from({ length: 120 }, (_, index) => ({
  a: { x: 20, y: index * 4 },
  b: { x: 24, y: index * 4 + 2 },
  length: 4.5,
}));
const vectorFallback = scoreVectorLayoutOrientation({
  segments: leftTitleStripSegments,
  sourceWidth: 595,
  sourceHeight: 842,
});
assert.equal(vectorFallback.bestRotation, 270);
assert.equal(vectorFallback.detectedCorrection, 270);
assert.equal(vectorFallback.source, "raster-analysis");

const textlessMetadataTie = { hasSignal: false, confidence: 44 };
assert.equal(Boolean(vectorFallback.hasSignal && (!textlessMetadataTie.hasSignal || vectorFallback.confidence >= textlessMetadataTie.confidence)), true);

console.log("orientation.test.mjs passed");
