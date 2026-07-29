export function WorkspaceStageActions({ saving, canContinue, onSave, onBack, onReviewIncomplete, onContinue }: { saving: boolean; canContinue: boolean; onSave: () => void; onBack: () => void; onReviewIncomplete: () => void; onContinue: () => void }) {
  return (
    <footer className="stageActions">
      <button type="button" onClick={onBack}>Back to Templates</button>
      <button type="button" onClick={onReviewIncomplete}>Review Incomplete</button>
      <button type="button" onClick={onSave} disabled={saving}>{saving ? "Saving" : "Save Draft"}</button>
      <button type="button" className="primaryButton" disabled={!canContinue || saving} onClick={onContinue}>Continue to Review and Variations</button>
    </footer>
  );
}
