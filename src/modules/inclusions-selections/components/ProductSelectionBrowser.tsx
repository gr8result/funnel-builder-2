import type { ProductReference, ProductVariantReference } from "../products/productReferenceTypes";
import { ProductVariantSelector } from "./ProductVariantSelector";

export function ProductSelectionBrowser({ products, variants, selectedProductId, selectedVariantId, onSearch, onSelectProduct, onSelectVariant }: { products: ProductReference[]; variants: ProductVariantReference[]; selectedProductId?: string; selectedVariantId?: string; onSearch: (value: string) => void; onSelectProduct: (productId: string) => void; onSelectVariant: (variantId: string) => void }) {
  return (
    <div className="productBrowser">
      <input onChange={(event) => onSearch(event.target.value)} placeholder="Search compatible products" aria-label="Search compatible products" />
      <div className="productResults">
        {products.length === 0 ? <p className="muted">No compatible products found.</p> : products.map((product) => (
          <button type="button" key={product.id} className={selectedProductId === product.id ? "productResult selected" : "productResult"} onClick={() => onSelectProduct(product.id)}>
            <strong>{product.name}</strong>
            <span>{[product.brand, product.model, product.colour].filter(Boolean).join(" · ") || "Development adapter product"}</span>
            <span>{product.unitCost ? `$${product.unitCost.amount}` : "Price missing"} · {product.active ? "Active" : "Unavailable"}</span>
          </button>
        ))}
      </div>
      <ProductVariantSelector variants={variants} value={selectedVariantId} onChange={onSelectVariant} />
    </div>
  );
}
