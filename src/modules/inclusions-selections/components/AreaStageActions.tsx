type Props = {
  canContinue: boolean;
  saving: boolean;
  onSave: () => void;
  onContinue: () => void;
};

export function AreaStageActions({ canContinue, saving, onSave, onContinue }: Props) {
  return (
    <footer className="stageActions">
      <button type="button" onClick={onSave} disabled={saving}>{saving ? "Saving" : "Save Draft"}</button>
      <button type="button" className="primaryButton" onClick={onContinue} disabled={!canContinue || saving}>Choose Area</button>
    </footer>
  );
}
