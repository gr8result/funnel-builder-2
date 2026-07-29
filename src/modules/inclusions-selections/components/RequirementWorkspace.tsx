import type { ProductReference, ProductVariantReference } from "../products/productReferenceTypes";
import type { RequirementNote } from "../repositories/selectionWorkspaceRepository";
import type { RequirementSelectionStatus, RequirementWorkspaceRow } from "../services/selectionWorkspaceService";
import { RequirementSelectionCard } from "./RequirementSelectionCard";
import type { CustomSelectionDraft } from "./CustomSelectionEditor";

export function RequirementWorkspace({ rows, products, variants, notes, customDraft, onSearchProducts, onSelectProduct, onSelectVariant, onCustomDraft, onSaveCustom, onStatus, onClear, onReset, onApplyTo }: { rows: RequirementWorkspaceRow[]; products: ProductReference[]; variants: ProductVariantReference[]; notes: RequirementNote[]; customDraft: CustomSelectionDraft; onSearchProducts: (requirementId: string, value: string) => void; onSelectProduct: (requirementId: string, productId: string) => void; onSelectVariant: (requirementId: string, variantId: string) => void; onCustomDraft: (draft: CustomSelectionDraft) => void; onSaveCustom: (requirementId: string) => void; onStatus: (requirementId: string, status: RequirementSelectionStatus, reason?: string) => void; onClear: (requirementId: string) => void; onReset: (requirementId: string) => void; onApplyTo: (requirementId: string) => void }) {
  if (rows.length === 0) return <section className="workspacePanel"><p>No requirements match the current filters.</p></section>;
  return (
    <section className="requirementWorkspace">
      {rows.map((row) => (
        <RequirementSelectionCard
          key={row.requirement.id}
          row={row}
          products={products}
          variants={variants}
          notes={notes.filter((note) => note.requirementId === row.requirement.id)}
          customDraft={customDraft}
          onSearchProducts={(value) => onSearchProducts(row.requirement.id, value)}
          onSelectProduct={(productId) => onSelectProduct(row.requirement.id, productId)}
          onSelectVariant={(variantId) => onSelectVariant(row.requirement.id, variantId)}
          onCustomDraft={onCustomDraft}
          onSaveCustom={() => onSaveCustom(row.requirement.id)}
          onStatus={(status, reason) => onStatus(row.requirement.id, status, reason)}
          onClear={() => onClear(row.requirement.id)}
          onReset={() => onReset(row.requirement.id)}
          onApplyTo={() => onApplyTo(row.requirement.id)}
        />
      ))}
    </section>
  );
}
