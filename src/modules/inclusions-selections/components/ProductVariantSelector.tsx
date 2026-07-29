import type { ProductVariantReference } from "../products/productReferenceTypes";

export function ProductVariantSelector({ variants, value, onChange }: { variants: ProductVariantReference[]; value?: string; onChange: (variantId: string) => void }) {
  if (variants.length === 0) return null;
  return (
    <label className="fieldLabel">
      <span>Variant</span>
      <select value={value ?? ""} onChange={(event) => onChange(event.target.value)}>
        <option value="">Choose variant</option>
        {variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.name}{variant.unitCost ? ` - $${variant.unitCost.amount}` : ""}</option>)}
      </select>
    </label>
  );
}
