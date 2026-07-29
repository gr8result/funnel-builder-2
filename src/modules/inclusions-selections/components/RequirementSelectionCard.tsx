import type { ProductReference, ProductVariantReference } from "../products/productReferenceTypes";
import type { RequirementNote } from "../repositories/selectionWorkspaceRepository";
import type { RequirementWorkspaceRow, RequirementSelectionStatus } from "../services/selectionWorkspaceService";
import { RequirementPricingSummary } from "./RequirementPricingSummary";
import { SelectionLocationList } from "./SelectionLocationList";
import { RequirementNotesPanel } from "./RequirementNotesPanel";
import { StandardInclusionPanel } from "./StandardInclusionPanel";
import { ProductSelectionBrowser } from "./ProductSelectionBrowser";
import { CustomSelectionEditor, type CustomSelectionDraft } from "./CustomSelectionEditor";

type Props = {
  row: RequirementWorkspaceRow;
  products: ProductReference[];
  variants: ProductVariantReference[];
  notes: RequirementNote[];
  customDraft: CustomSelectionDraft;
  onSearchProducts: (value: string) => void;
  onSelectProduct: (productId: string) => void;
  onSelectVariant: (variantId: string) => void;
  onCustomDraft: (draft: CustomSelectionDraft) => void;
  onSaveCustom: () => void;
  onStatus: (status: RequirementSelectionStatus, reason?: string) => void;
  onClear: () => void;
  onReset: () => void;
  onApplyTo: () => void;
};

export function RequirementSelectionCard(props: Props) {
  const { row } = props;
  const status = row.selection?.selectionStatus ?? "not_started";
  return (
    <article className="requirementCard">
      <div className="requirementHeader">
        <div>
          <h3>{row.requirement.title}</h3>
          <p>{row.area.name} · {row.requirement.category} · {row.requirement.applicability ?? (row.requirement.required ? "required" : "optional")}</p>
        </div>
        <span className={`statusPill status-${status}`}>{status.replace(/_/g, " ")}</span>
      </div>
      <div className="sourceLine">{row.inheritanceSource} · Tier {row.inheritedTierId ?? "not set"}</div>
      <StandardInclusionPanel row={row} />
      <ProductSelectionBrowser products={props.products} variants={props.variants} selectedProductId={row.selection?.value.productReferenceId} selectedVariantId={row.selection?.value.variantId} onSearch={props.onSearchProducts} onSelectProduct={props.onSelectProduct} onSelectVariant={props.onSelectVariant} />
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
