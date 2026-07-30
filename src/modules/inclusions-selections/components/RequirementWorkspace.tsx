import type { RequirementNote } from "../repositories/selectionWorkspaceRepository";
import type { RequirementSelectionStatus, RequirementWorkspaceRow } from "../services/selectionWorkspaceService";
import { RequirementSelectionCard } from "./RequirementSelectionCard";
import type { CustomSelectionDraft } from "./CustomSelectionEditor";

export function RequirementWorkspace({ rows, notes, customDraft, onCustomDraft, onSaveCustom, onOpenProductPicker, onStatus, onClear, onReset, onApplyTo }: { rows: RequirementWorkspaceRow[]; notes: RequirementNote[]; customDraft: CustomSelectionDraft; onCustomDraft: (draft: CustomSelectionDraft) => void; onSaveCustom: (requirementId: string) => void; onOpenProductPicker: (requirementId: string) => void; onStatus: (requirementId: string, status: RequirementSelectionStatus, reason?: string) => void; onClear: (requirementId: string) => void; onReset: (requirementId: string) => void; onApplyTo: (requirementId: string) => void }) {
  if (rows.length === 0) return <section className="workspacePanel"><p>No requirements match the current filters.</p></section>;
  return (
    <section className="requirementWorkspace">
      {rows.map((row) => (
        <RequirementSelectionCard
          key={row.requirement.id}
          row={row}
          notes={notes.filter((note) => note.requirementId === row.requirement.id)}
          customDraft={customDraft}
          onCustomDraft={onCustomDraft}
          onSaveCustom={() => onSaveCustom(row.requirement.id)}
          onOpenProductPicker={() => onOpenProductPicker(row.requirement.id)}
          onStatus={(status, reason) => onStatus(row.requirement.id, status, reason)}
          onClear={() => onClear(row.requirement.id)}
          onReset={() => onReset(row.requirement.id)}
          onApplyTo={() => onApplyTo(row.requirement.id)}
        />
      ))}
    </section>
  );
}
