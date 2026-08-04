import { createDetectedOrientationState } from "./orientationState.js";

// Shared by both first import and explicit Re-detect. Automatic detection
// always applies its best correction so a low-confidence page does not remain
// sideways; the UI uses orientationConfidence/tier to ask for review.
export function applyOrientationResult(page, detection) {
  const orientationState = createDetectedOrientationState(detection);
  return {
    ...page,
    rotation: orientationState.finalAppliedRotation,
    orientationState,
    orientationSource: detection?.source === "metadata" ? "metadata" : "auto",
    orientationConfidence: orientationState.confidence,
    orientationConfirmed: false,
  };
}
