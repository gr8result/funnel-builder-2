import type { ProductReference, ProductVariantReference } from "../products/productReferenceTypes";
import type { SupplierReference, ProductSearchFilters } from "../products/productSelectionCatalogueAdapter";
import { evaluateProductCompatibility } from "../products/requirementProductMatching";
import type { RequirementWorkspaceRow } from "../services/selectionWorkspaceService";

type Props = {
  row: RequirementWorkspaceRow;
  products: ProductReference[];
  variants: ProductVariantReference[];
  suppliers: SupplierReference[];
  filters: ProductSearchFilters;
  selectedProductId?: string;
  selectedVariantId?: string;
  compareIds: string[];
  loading?: boolean;
  successMessage?: string;
  errorMessage?: string;
  onFilterChange: (filters: ProductSearchFilters) => void;
  onChooseProduct: (productId: string) => void;
  onChooseVariant: (variantId: string) => void;
  onSelect: (productId: string, variantId?: string) => void;
  onToggleCompare: (productId: string) => void;
  onApplyToOtherRooms: () => void;
  onClose: () => void;
};

function aud(amount?: number, currency = "AUD") {
  if (amount === undefined) return "Price Missing";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency }).format(amount);
}

function variationLabel(row: RequirementWorkspaceRow, product: ProductReference, variant?: ProductVariantReference) {
  const allowance = product.allowance?.amount ?? row.selection?.allowance?.amount ?? 0;
  const selected = variant?.unitCost?.amount ?? product.unitCost?.amount;
  if (selected === undefined) return "Price Missing";
  const variation = selected - allowance;
  if (variation > 0) return `+${aud(variation, product.unitCost?.currency)} Upgrade`;
  if (variation < 0) return `-${aud(Math.abs(variation), product.unitCost?.currency)} Credit`;
  return "Included";
}

function specLine(product: ProductReference, variant?: ProductVariantReference) {
  return [
    product.compatibility.width ?? variant?.width,
    product.compatibility.fuelType ?? variant?.fuelType,
    product.compatibility.installationType,
    variant?.colour ?? product.colour,
    variant?.finish ?? product.finish,
  ].filter(Boolean).join(" / ");
}

export function ProductSelectionModal(props: Props) {
  const selectedProduct = props.products.find((product) => product.id === props.selectedProductId);
  const selectedVariant = props.variants.find((variant) => variant.id === props.selectedVariantId);
  const brands = [...new Set(props.products.map((product) => product.brand).filter(Boolean))].sort() as string[];
  const suppliers = props.suppliers.filter((supplier) => props.products.some((product) => product.supplierId === supplier.id));
  const widths = [...new Set(props.products.map((product) => product.compatibility.width).filter(Boolean))].sort() as string[];
  const fuelTypes = [...new Set(props.products.map((product) => product.compatibility.fuelType).filter(Boolean))].sort() as string[];
  const tiers = [
    ["tier_classic", "Classic"],
    ["tier_premier", "Premier"],
    ["tier_premium", "Premium"],
    ["tier_optional_upgrade", "Optional Upgrade"],
    ["tier_custom_only", "Custom Only"],
  ];

  return (
    <div className="productModalBackdrop" role="presentation">
      <section className="productModal" role="dialog" aria-modal="true" aria-labelledby="product-modal-title">
        <header className="productModalHeader">
          <div>
            <span className="modalEyebrow">{props.row.area.name}</span>
            <h2 id="product-modal-title">{props.row.requirement.title}</h2>
            <p>{props.row.inheritedTierId?.replace("tier_", "") ?? "No tier"} Inclusion / Allowance: {aud(props.row.selection?.allowance?.amount ?? selectedProduct?.allowance?.amount ?? 0)}</p>
          </div>
          <button type="button" onClick={props.onClose} aria-label="Close product picker">Close</button>
        </header>

        {props.successMessage ? <div className="successNotice">{props.successMessage}<button type="button" onClick={props.onApplyToOtherRooms}>Apply to Other Rooms</button></div> : null}
        {props.errorMessage ? <div className="errorNotice">{props.errorMessage}</div> : null}

        <div className="productModalBody">
          <aside className="productFilters">
            <label><span>Search</span><input value={props.filters.search ?? ""} onChange={(event) => props.onFilterChange({ ...props.filters, search: event.target.value })} placeholder="Search products" /></label>
            <label><span>Brand</span><select value={props.filters.brand ?? ""} onChange={(event) => props.onFilterChange({ ...props.filters, brand: event.target.value || undefined })}><option value="">All brands</option>{brands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}</select></label>
            <label><span>Supplier</span><select value={props.filters.supplierId ?? ""} onChange={(event) => props.onFilterChange({ ...props.filters, supplierId: event.target.value || undefined })}><option value="">All suppliers</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
            <label><span>Tier</span><select value={props.filters.tierId ?? ""} onChange={(event) => props.onFilterChange({ ...props.filters, tierId: event.target.value || undefined })}><option value="">All tiers</option>{tiers.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label><span>Width</span><select value={props.filters.width ?? ""} onChange={(event) => props.onFilterChange({ ...props.filters, width: event.target.value || undefined })}><option value="">All widths</option>{widths.map((width) => <option key={width} value={width}>{width}</option>)}</select></label>
            <label><span>Fuel type</span><select value={props.filters.fuelType ?? ""} onChange={(event) => props.onFilterChange({ ...props.filters, fuelType: event.target.value || undefined })}><option value="">All fuel types</option>{fuelTypes.map((fuel) => <option key={fuel} value={fuel}>{fuel}</option>)}</select></label>
            <label><span>Availability</span><select value={props.filters.availabilityStatus ?? ""} onChange={(event) => props.onFilterChange({ ...props.filters, availabilityStatus: event.target.value || undefined })}><option value="">Available products</option><option value="supplier_quote_required">Supplier quote required</option><option value="unavailable">Unavailable</option></select></label>
          </aside>

          <div className="productGridPanel">
            {props.loading ? <p>Loading compatible products.</p> : null}
            {!props.loading && props.products.length === 0 ? <p>No compatible products found for this selection item.</p> : null}
            <div className="modalProductGrid">
              {props.products.map((product) => {
                const productVariants = props.selectedProductId === product.id ? props.variants : [];
                const variant = product.id === props.selectedProductId ? selectedVariant : undefined;
                const requiresVariant = product.requiresVariant && productVariants.length > 0;
                const compatibility = evaluateProductCompatibility(props.row.requirement, product, productVariants, props.row.area, props.row.inheritedTierId);
                return (
                  <article key={product.id} className={props.selectedProductId === product.id ? "modalProductCard selected" : "modalProductCard"}>
                    <div className="modalProductImage">{product.imageUrl ? <span>{(product.brand || product.name).slice(0, 2).toUpperCase()}</span> : <span>No Image</span>}</div>
                    <div className="modalProductContent">
                      <div className="modalProductTop">
                        <div>
                          <strong>{product.brand}</strong>
                          <h3>{product.name}</h3>
                          <p>{[product.range, product.model, specLine(product, variant)].filter(Boolean).join(" / ")}</p>
                        </div>
                        <span className="tierBadge">{product.tierId?.replace("tier_", "").replace(/_/g, " ") ?? "No tier"}</span>
                      </div>
                      <p>{product.description}</p>
                      <dl className="productFacts">
                        <div><dt>Supplier</dt><dd>{product.supplierName ?? product.supplierId ?? "Not recorded"}</dd></div>
                        <div><dt>Code</dt><dd>{product.productCode ?? product.supplierSku ?? "Not recorded"}</dd></div>
                        <div><dt>Allowance</dt><dd>{aud(product.allowance?.amount)}</dd></div>
                        <div><dt>Selected</dt><dd>{aud((variant?.unitCost ?? product.unitCost)?.amount)}</dd></div>
                        <div><dt>Variation</dt><dd>{variationLabel(props.row, product, variant)}</dd></div>
                        <div><dt>Status</dt><dd>{compatibility.priceStatus.replace(/_/g, " ")}</dd></div>
                      </dl>
                      {requiresVariant ? (
                        <label className="variantPicker"><span>Variant</span><select value={product.id === props.selectedProductId ? props.selectedVariantId ?? "" : ""} onChange={(event) => props.onChooseVariant(event.target.value)} onFocus={() => props.onChooseProduct(product.id)}><option value="">Choose variant</option>{productVariants.map((item) => <option key={item.id} value={item.id}>{item.name} / {aud(item.unitCost?.amount)}</option>)}</select></label>
                      ) : null}
                      <div className="modalProductActions">
                        <button type="button" onClick={() => props.onChooseProduct(product.id)}>View Details</button>
                        <label><input type="checkbox" checked={props.compareIds.includes(product.id)} onChange={() => props.onToggleCompare(product.id)} /> Compare</label>
                        {product.productUrl ? <a href={product.productUrl} target="_blank" rel="noreferrer">Supplier Details</a> : null}
                        <button type="button" className="primaryButton" disabled={Boolean(requiresVariant && props.selectedProductId === product.id && !props.selectedVariantId)} onClick={() => props.onSelect(product.id, product.id === props.selectedProductId ? props.selectedVariantId : undefined)}>Select</button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
