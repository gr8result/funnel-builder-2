import type { ApplyToPreview as ApplyToPreviewModel } from "../services/selectionWorkspaceService";

export function ApplyToPreview({ preview, selectedTargets, onToggleTarget, onConfirm }: { preview: ApplyToPreviewModel | null; selectedTargets: string[]; onToggleTarget: (requirementId: string) => void; onConfirm: () => void }) {
  if (!preview) return null;
  return (
    <section className="applyPreview">
      <h3>Apply To Preview</h3>
      <div className="previewColumns">
        <div>
          <strong>Compatible Targets</strong>
          {preview.compatibleTargets.map((target) => (
            <label key={target.requirementId} className="targetRow">
              <input type="checkbox" checked={selectedTargets.includes(target.requirementId)} onChange={() => onToggleTarget(target.requirementId)} />
              <span>{target.projectAreaName} - {target.requirementName}</span>
            </label>
          ))}
        </div>
        <div><strong>Incompatible Targets</strong>{preview.incompatibleTargets.map((target) => <p key={target.requirementId}>{target.projectAreaName} - {target.reason}</p>)}</div>
        <div><strong>Skipped Targets</strong>{preview.skippedTargets.map((target) => <p key={target.requirementId}>{target.projectAreaName} - {target.reason}</p>)}</div>
      </div>
      <button type="button" className="primaryButton" onClick={onConfirm}>Apply Selected Compatible Targets</button>
    </section>
  );
}
