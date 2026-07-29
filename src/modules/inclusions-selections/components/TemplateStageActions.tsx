type Props = {
  canContinue: boolean;
  saving: boolean;
  onBack: () => void;
  onPreview: () => void;
  onGenerate: () => void;
  onSave: () => void;
  onContinue: () => void;
};

export function TemplateStageActions({ canContinue, saving, onBack, onPreview, onGenerate, onSave, onContinue }: Props) {
  return (
    <footer className="stageActions">
      <button type="button" onClick={onBack}>Back to Areas</button>
      <button type="button" onClick={onPreview}>Preview All Requirements</button>
      <button type="button" onClick={onGenerate}>Generate Requirements</button>
      <button type="button" onClick={onSave} disabled={saving}>{saving ? "Saving" : "Save Draft"}</button>
      <button type="button" className="primaryButton" onClick={onContinue} disabled={!canContinue || saving}>Continue to Selection Workspace</button>
    </footer>
  );
}
