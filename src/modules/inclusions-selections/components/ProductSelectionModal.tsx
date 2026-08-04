import { useState } from "react";
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
  loading?: boolean;
  successMessage?: string;
  errorMessage?: string;
  onFilterChange: (filters: ProductSearchFilters) => void;
  onChooseProduct: (productId: string) => void;
  onChooseVariant: (variantId: string) => void;
  onSelect: (productId: string, variantId?: string) => void;
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
  const [detailProductId, setDetailProductId] = useState<string | null>(null);
  const selectedProduct = props.products.find((product) => product.id === props.selectedProductId);
  const selectedVariant = props.variants.find((variant) => variant.id === props.selectedVariantId);
  const detailProduct = props.products.find((product) => product.id === detailProductId);
  const brands = [...new Set(props.products.map((product) => product.brand).filter(Boolean))].sort() as string[];
  const widths = [...new Set(props.products.map((product) => product.compatibility.width).filter(Boolean))].sort() as string[];
  const fuelTypes = [...new Set(props.products.map((product) => product.compatibility.fuelType).filter(Boolean))].sort() as string[];

  return (
    <div className="productModalBackdrop" role="presentation">
      <section className="productModal" role="dialog" aria-modal="true" aria-labelledby="product-modal-title">
        <header className="productModalHeader">
          <div>
            <span className="modalEyebrow">{props.row.area.name}</span>
            <h2 id="product-modal-title">{props.row.requirement.title}</h2>
            <p>Choose a product, finish or fixture for this selection.</p>
          </div>
          <button type="button" onClick={props.onClose} aria-label="Close product picker">Close</button>
        </header>

        {props.successMessage ? <div className="successNotice">{props.successMessage}<button type="button" onClick={props.onApplyToOtherRooms}>Apply to Other Rooms</button></div> : null}
        {props.errorMessage ? <div className="errorNotice">{props.errorMessage}</div> : null}

        <div className="simplePickerControls">
          <input value={props.filters.search ?? ""} onChange={(event) => props.onFilterChange({ ...props.filters, search: event.target.value })} placeholder="Search products" aria-label="Search products" />
          <div className="brandPills" aria-label="Brands">
            <button type="button" className={!props.filters.brand ? "active" : ""} onClick={() => props.onFilterChange({ ...props.filters, brand: undefined })}>All Brands</button>
            {brands.map((brand) => (
              <button key={brand} type="button" className={props.filters.brand === brand ? "active" : ""} onClick={() => props.onFilterChange({ ...props.filters, brand })}>{brand}</button>
            ))}
          </div>
          {(widths.length || fuelTypes.length) ? (
            <div className="quickFilters" aria-label="Product filters">
              {widths.map((width) => (
                <button key={width} type="button" className={props.filters.width === width ? "active" : ""} onClick={() => props.onFilterChange({ ...props.filters, width: props.filters.width === width ? undefined : width })}>{width}</button>
              ))}
              {fuelTypes.map((fuel) => (
                <button key={fuel} type="button" className={props.filters.fuelType === fuel ? "active" : ""} onClick={() => props.onFilterChange({ ...props.filters, fuelType: props.filters.fuelType === fuel ? undefined : fuel })}>{fuel}</button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="productModalBody">
          <div className="productGridPanel">
            {props.loading ? <p>Loading compatible products.</p> : null}
            {!props.loading && props.products.length === 0 ? <p>No products have been added for this category yet.</p> : null}
            {detailProduct ? (
              <ProductDetailView
                product={detailProduct}
                variants={props.selectedProductId === detailProduct.id ? props.variants : []}
                selectedVariant={detailProduct.id === props.selectedProductId ? selectedVariant : undefined}
                selectedVariantId={detailProduct.id === props.selectedProductId ? props.selectedVariantId : undefined}
                row={props.row}
                onBack={() => setDetailProductId(null)}
                onChooseProduct={() => props.onChooseProduct(detailProduct.id)}
                onChooseVariant={props.onChooseVariant}
                onSelect={() => props.onSelect(detailProduct.id, detailProduct.id === props.selectedProductId ? props.selectedVariantId : undefined)}
              />
            ) : null}
            <div className={detailProduct ? "modalProductGrid hidden" : "modalProductGrid"}>
              {props.products.map((product) => {
                const productVariants = props.selectedProductId === product.id ? props.variants : [];
                const variant = product.id === props.selectedProductId ? selectedVariant : undefined;
                const requiresVariant = product.requiresVariant && productVariants.length > 0;
                const compatibility = evaluateProductCompatibility(props.row.requirement, product, productVariants, props.row.area, props.row.inheritedTierId);
                return (
                  <article key={product.id} className={props.selectedProductId === product.id ? "modalProductCard selected" : "modalProductCard"}>
                    <button type="button" className="modalProductImage" onClick={() => { props.onChooseProduct(product.id); setDetailProductId(product.id); }} aria-label={`View details for ${product.name}`}>
                      {product.imageUrl ? <img src={product.imageUrl} alt={product.name} /> : <span>{(product.brand || product.name).slice(0, 2).toUpperCase()}</span>}
                    </button>
                    <div className="modalProductContent">
                      <div className="modalProductTop">
                        <div>
                          <strong>{product.brand}</strong>
                          <h3>{product.name}</h3>
                          <p>{[product.range, product.model, specLine(product, variant)].filter(Boolean).join(" / ")}</p>
                        </div>
                      </div>
                      <p>{product.description}</p>
                      <dl className="productFacts">
                        <div><dt>Supplier</dt><dd>{product.supplierName ?? product.supplierId ?? "Not recorded"}</dd></div>
                        <div><dt>Model</dt><dd>{product.model ?? product.productCode ?? "Not recorded"}</dd></div>
                        <div><dt>Colour</dt><dd>{variant?.colour ?? product.colour ?? "Not recorded"}</dd></div>
                        <div><dt>Price</dt><dd>{aud((variant?.unitCost ?? product.unitCost)?.amount)}</dd></div>
                        <div><dt>Variation</dt><dd>{variationLabel(props.row, product, variant)}</dd></div>
                        <div><dt>Availability</dt><dd>{compatibility.priceStatus === "price_missing" ? "Price pending" : "Available"}</dd></div>
                      </dl>
                      {requiresVariant ? (
                        <label className="variantPicker"><span>Variant</span><select value={product.id === props.selectedProductId ? props.selectedVariantId ?? "" : ""} onChange={(event) => props.onChooseVariant(event.target.value)} onFocus={() => props.onChooseProduct(product.id)}><option value="">Choose variant</option>{productVariants.map((item) => <option key={item.id} value={item.id}>{item.name} / {aud(item.unitCost?.amount)}</option>)}</select></label>
                      ) : null}
                      <div className="modalProductActions">
                        <button type="button" onClick={() => { props.onChooseProduct(product.id); setDetailProductId(product.id); }}>View Details</button>
                        {product.productUrl ? <a href={product.productUrl} target="_blank" rel="noopener noreferrer">View Official Product Page</a> : null}
                        <button type="button" className="primaryButton" disabled={Boolean(requiresVariant && !props.selectedVariantId)} onClick={() => props.onSelect(product.id, product.id === props.selectedProductId ? props.selectedVariantId : undefined)}>Add To Selections</button>
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

function ProductDetailView(props: {
  product: ProductReference;
  variants: ProductVariantReference[];
  selectedVariant?: ProductVariantReference;
  selectedVariantId?: string;
  row: RequirementWorkspaceRow;
  onBack: () => void;
  onChooseProduct: () => void;
  onChooseVariant: (variantId: string) => void;
  onSelect: () => void;
}) {
  const variant = props.selectedVariant;
  const productUrl = variant?.productUrl || props.product.productUrl;
  const requiresVariant = Boolean(props.product.requiresVariant && props.variants.length > 0);
  const canSelect = !requiresVariant || Boolean(props.selectedVariantId);
  return (
    <article className="productDetailView">
      <button type="button" className="backButton" onClick={props.onBack}>Back to Products</button>
        <div className="detailLayout">
          <div className="detailMedia">
          <div className="detailImage">{props.product.imageUrl ? <img src={props.product.imageUrl} alt={props.product.name} /> : <span>{(props.product.brand || props.product.name).slice(0, 2).toUpperCase()}</span>}</div>
          <div className="detailGallery">
            {(props.product.galleryImageUrls?.length ? props.product.galleryImageUrls : [props.product.imageUrl]).filter(Boolean).slice(0, 4).map((image, index) => (
              <span key={`${image}-${index}`}>{typeof image === "string" ? <img src={image} alt="" /> : index + 1}</span>
            ))}
          </div>
        </div>
        <div className="detailCopy">
          <p className="modalEyebrow">{props.product.supplierName ?? "Supplier not recorded"}</p>
          <h3>{props.product.name}</h3>
          <p>{props.product.description}</p>
          <dl className="productFacts detailFacts">
            <div><dt>Brand</dt><dd>{props.product.brand ?? "Not recorded"}</dd></div>
            <div><dt>Range</dt><dd>{props.product.range ?? "Not recorded"}</dd></div>
            <div><dt>Model</dt><dd>{props.product.model ?? "Not recorded"}</dd></div>
            <div><dt>Colour</dt><dd>{variant?.colour ?? props.product.colour ?? "Not recorded"}</dd></div>
            <div><dt>Finish</dt><dd>{variant?.finish ?? props.product.finish ?? "Not recorded"}</dd></div>
            <div><dt>Supplier SKU</dt><dd>{variant?.supplierSku ?? variant?.sku ?? props.product.supplierSku ?? "Not recorded"}</dd></div>
            <div><dt>Client Price</dt><dd>{aud((variant?.unitCost ?? props.product.unitCost)?.amount)}</dd></div>
            <div><dt>Allowance</dt><dd>{aud(props.product.allowance?.amount ?? props.row.selection?.allowance?.amount)}</dd></div>
            <div><dt>Variation</dt><dd>{variationLabel(props.row, props.product, variant)}</dd></div>
          </dl>
          {requiresVariant ? (
            <label className="variantPicker"><span>Variant</span><select value={props.selectedVariantId ?? ""} onChange={(event) => { props.onChooseProduct(); props.onChooseVariant(event.target.value); }}><option value="">Choose variant</option>{props.variants.map((item) => <option key={item.id} value={item.id}>{item.name} / {aud(item.unitCost?.amount)}</option>)}</select></label>
          ) : null}
          <div className="modalProductActions">
            {productUrl ? <a href={productUrl} target="_blank" rel="noopener noreferrer">View Official Product Page</a> : <span className="disabledLink">Supplier product page not available.</span>}
            <button type="button" className="primaryButton" disabled={!canSelect} onClick={props.onSelect}>Add To Selections</button>
          </div>
        </div>
      </div>
    </article>
  );
}
