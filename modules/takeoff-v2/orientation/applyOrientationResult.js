// Shared by both the first-import path (PlanDocumentList upload) and the
// explicit "Re-detect Orientation" action, so the confidence-tier rules can
// never drift between the two call sites.
//
// high/medium -> apply the suggested rotation, source "auto" (medium also
// needs a confirmation notice in the UI — callers check orientationConfidence
// < CONFIDENCE_HIGH for that, not a separate flag).
// low/none    -> do not auto-rotate; leave orientationSource null so the UI
// shows the four-thumbnail picker instead.
export function applyOrientationResult(page, detection) {
  const { tier, bestRotation, confidence } = detection;

  if (tier === "high" || tier === "medium") {
    return {
      ...page,
      rotation: bestRotation,
      orientationSource: "auto",
      orientationConfidence: confidence,
      orientationConfirmed: false,
    };
  }

  return {
    ...page,
    orientationSource: null,
    orientationConfidence: tier === "none" ? null : confidence,
    orientationConfirmed: false,
  };
}
