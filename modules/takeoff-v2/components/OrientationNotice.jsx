import { orientationConfidenceLabel } from "../orientation/orientationState.js";

// Product feedback, not a dev diagnostic: tells the user what automatic
// orientation did and how sure it was. Purely informational; never blocks or
// alters manual rotation.
export default function OrientationNotice({ rotation, confidence, needsConfirmation }) {
  return (
    <div style={{ ...S.wrap, ...(needsConfirmation ? S.wrapMedium : S.wrapHigh) }} data-testid="orientation-notice">
      <span>{needsConfirmation ? "Orientation uncertain - choose the correct view" : "Orientation confirmed"} - {rotation}&deg;</span>
      <span style={S.divider}>&middot;</span>
      <span>Confidence: {orientationConfidenceLabel(confidence)}</span>
    </div>
  );
}

const S = {
  wrap: { display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", fontSize: 12, fontWeight: 700, borderBottom: "1px solid transparent" },
  wrapHigh: { background: "#ecfdf5", color: "#065f46", borderBottomColor: "#a7f3d0" },
  wrapMedium: { background: "#fffbeb", color: "#92400e", borderBottomColor: "#fde68a" },
  divider: { opacity: 0.6 },
  confirmText: { marginLeft: "auto", fontWeight: 600 },
};
