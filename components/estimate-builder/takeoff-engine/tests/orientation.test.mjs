import assert from "node:assert/strict";
import {
  applyManualRotation,
  calculateFinalRotation,
  chooseBestOrientationScore,
  confirmOrientation,
  createOrientation,
  createOrientationScore,
  detectDrawingAspectOrientation,
  normalizeRotation,
  rotateDimensions,
  shouldAutoOrient,
} from "../core/orientation.js";

assert.equal(normalizeRotation(-90), 270);
assert.equal(normalizeRotation(450), 90);
assert.equal(calculateFinalRotation({ metadataRotation: 90, detectedRotation: 180, userRotation: 270 }), 180);
assert.deepEqual(rotateDimensions(100, 200, 90), { width: 200, height: 100 });
assert.deepEqual(rotateDimensions(100, 200, 180), { width: 100, height: 200 });

const orientation = createOrientation({ metadataRotation: 90, detectedRotation: 90 });
assert.equal(orientation.finalRotation, 180);
assert.equal(shouldAutoOrient(orientation), true);

const rotated = applyManualRotation(orientation, 180);
assert.equal(rotated.userRotation, 180);
assert.equal(rotated.finalRotation, 0);
assert.equal(rotated.confidence, "manual");
assert.equal(rotated.manualOverride, true);
assert.equal(rotated.orientationConfirmed, true);

const confirmed = confirmOrientation(rotated);
assert.equal(confirmed.orientationConfirmed, true);
assert.equal(confirmed.confidence, "confirmed");
assert.equal(shouldAutoOrient(confirmed), false);

const highScore = createOrientationScore({ rotation: 180, confidence: 0.9, method: "pdf-text-layer" });
assert.equal(highScore.rotation, 180);
assert.equal(highScore.confidenceLabel, "high");

const bestScore = chooseBestOrientationScore([
  createOrientationScore({ rotation: 90, confidence: 0.3 }),
  createOrientationScore({ rotation: 180, confidence: 0.8 }),
]);
assert.equal(bestScore.rotation, 180);

const aspectScore = detectDrawingAspectOrientation({ width: 1200, height: 2400 });
assert.equal(aspectScore.rotation, 90);
assert.equal(aspectScore.confidenceLabel, "low");

console.log("orientation tests passed");
