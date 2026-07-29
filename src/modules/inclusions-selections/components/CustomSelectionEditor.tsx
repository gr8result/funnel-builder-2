import type { RequirementWorkspaceRow } from "../services/selectionWorkspaceService";

export type CustomSelectionDraft = {
  name: string;
  description: string;
  quantity: number;
  unit: string;
  clientPrice: number;
  allowance: number;
  brand?: string;
  model?: string;
  colour?: string;
  supplierId?: string;
  supplierSku?: string;
  notes?: string;
};

export function CustomSelectionEditor({ row, draft, onChange, onSave }: { row: RequirementWorkspaceRow; draft: CustomSelectionDraft; onChange: (draft: CustomSelectionDraft) => void; onSave: () => void }) {
  return (
    <div className="customSelectionEditor">
      <strong>Custom Selection</strong>
      <input value={draft.name} onChange={(event) => onChange({ ...draft, name: event.target.value })} placeholder="Selection name" />
      <input value={draft.description} onChange={(event) => onChange({ ...draft, description: event.target.value })} placeholder={`Description for ${row.requirement.title}`} />
      <div className="splitFields">
        <input type="number" min={0.01} value={draft.quantity} onChange={(event) => onChange({ ...draft, quantity: Number(event.target.value) })} aria-label="Quantity" />
        <input value={draft.unit} onChange={(event) => onChange({ ...draft, unit: event.target.value })} placeholder="Unit" />
        <input type="number" min={0} value={draft.allowance} onChange={(event) => onChange({ ...draft, allowance: Number(event.target.value) })} aria-label="Allowance" />
        <input type="number" min={0} value={draft.clientPrice} onChange={(event) => onChange({ ...draft, clientPrice: Number(event.target.value) })} aria-label="Client price" />
      </div>
      <input value={draft.notes ?? ""} onChange={(event) => onChange({ ...draft, notes: event.target.value })} placeholder="Notes" />
      <button type="button" onClick={onSave}>Save Custom Selection</button>
    </div>
  );
}
