import type { RequirementNote } from "../repositories/selectionWorkspaceRepository";
import type { RequirementSelectionStatus, RequirementWorkspaceRow } from "../services/selectionWorkspaceService";
import { CustomSelectionEditor, type CustomSelectionDraft } from "./CustomSelectionEditor";
import { RequirementNotesPanel } from "./RequirementNotesPanel";
import { RequirementPricingSummary } from "./RequirementPricingSummary";
import { SelectionLocationList } from "./SelectionLocationList";
import { StandardInclusionPanel } from "./StandardInclusionPanel";

type Props = {
  row: RequirementWorkspaceRow;
  notes: RequirementNote[];
  customDraft: CustomSelectionDraft;
  onCustomDraft: (draft: CustomSelectionDraft) => void;
  onSaveCustom: () => void;
  onOpenProductPicker: () => void;
  onStatus: (status: RequirementSelectionStatus, reason?: string) => void;
  onClear: () => void;
  onReset: () => void;
  onApplyTo: () => void;
};

function statusGlyph(status: RequirementSelectionStatus | "not_started") {
  if (status === "complete") return "✓";
  if (status === "needs_attention") return "!";
  if (status === "in_progress") return "!";
  return "○";
}

export function RequirementSelectionCard(props: Props) {
  const { row } = props;
  const status = row.selection?.selectionStatus ?? "not_started";
  const productName = row.selection?.value.productName ?? row.selection?.value.customSelectionName;
  const productMeta = [row.selection?.value.brand, row.selection?.value.model, row.selection?.value.colour ?? row.selection?.value.finish, row.selection?.value.supplierName].filter(Boolean).join(" / ");

  return (
    <article className="requirementCard">
      <div className="requirementHeader">
        <div>
          <h3><span className={`statusDot status-${status}`}>{statusGlyph(status)}</span>{row.requirement.title}</h3>
          <p>{row.area.name} / {row.requirement.category} / {row.requirement.applicability ?? (row.requirement.required ? "required" : "optional")}</p>
        </div>
        <span className={`statusPill status-${status}`}>{status.replace(/_/g, " ")}</span>
      </div>
      <div className="sourceLine">{row.inheritanceSource} / Tier {row.inheritedTierId ?? "not set"}</div>
      <StandardInclusionPanel row={row} />
      <section className={productName ? "selectedProductCard" : "selectedProductCard empty"}>
        <div className="selectedProductImage">
          <span>{row.selection?.value.productImageUrl ? (row.selection.value.brand || productName || "SP").slice(0, 2).toUpperCase() : productName ? "SP" : "-"}</span>
        </div>
        <div>
          <span className="modalEyebrow">Selected Product</span>
          <strong>{productName ?? "No product selected"}</strong>
          <p>{productMeta || "Choose a compatible product from the Product Library."}</p>
        </div>
        <button type="button" className="primaryButton" onClick={props.onOpenProductPicker}>{productName ? "Change Product" : "Select Product"}</button>
      </section>
      <CustomSelectionEditor row={row} draft={props.customDraft} onChange={props.onCustomDraft} onSave={props.onSaveCustom} />
      <RequirementPricingSummary selection={row.selection} />
      <SelectionLocationList locations={row.locations} />
      <RequirementNotesPanel notes={props.notes} />
      <div className="rowActions">
        <button type="button" onClick={() => props.onStatus("complete")}>Complete</button>
        <button type="button" onClick={() => props.onStatus("in_progress")}>Pending</button>
        <button type="button" onClick={() => props.onStatus("needs_attention")}>Needs Attention</button>
        <button type="button" onClick={() => props.onStatus("not_applicable", "Marked not applicable in draft workspace.")}>Not Applicable</button>
        <button type="button" onClick={props.onReset}>Reset to Inherited Selection</button>
        <button type="button" onClick={props.onClear}>Clear Draft Selection</button>
        <button type="button" onClick={props.onApplyTo}>Apply to Other Areas</button>
      </div>
    </article>
  );
}
