// Client/builder-facing product card for Plumbing Fixtures & Tapware.
// Large image, brand/name/model/finish/price up front; internal catalogue
// metadata (active flags, canonical source strings, taxonomy paths) stays out
// of this card - that belongs in Product Library Admin / View Details only.
//
// Quantity and room allocation are NOT captured here: that happens in Client Selections
// (Plumbing Fixtures -> Select -> Add / Allocate Product), which saves it to the project.
import ProductLibraryProductImage from "./ProductLibraryProductImage";
import { productPriceLabel } from "../../lib/product-library/productPresentation.js";

export default function PlumbingProductCard({ product, familyItem, onViewDetails, onSelect, selectable = true }) {
  const brand = product.brand || product.manufacturer || "";
  const model = product.model || product.sku || product.productCode || "";
  const finish = [product.finish, product.colour].filter(Boolean).join(" / ");
  const hncUrl = product.officialProductUrl || product.sourceUrl || "";
  const priceLabel = productPriceLabel ? productPriceLabel(product) : (product.rrp != null ? `$${product.rrp}` : "Price requires verification");

  return (
    <article className="plumbing-product-card" data-plumbing-product={product.productId || product.productCode}>
      <div className="plumbing-product-media">
        <ProductLibraryProductImage product={product} familyItem={familyItem} />
      </div>
      <div className="plumbing-product-copy">
        {brand ? <span className="plumbing-product-brand">{brand}</span> : null}
        <strong className="plumbing-product-name">{product.productName || "Unnamed product"}</strong>
        {model ? <small className="plumbing-product-model">Model: {model}</small> : null}
        {finish ? <small className="plumbing-product-finish">{finish}</small> : null}
        <span className="plumbing-product-price">{priceLabel}</span>
      </div>
      <div className="plumbing-product-actions">
        <button type="button" onClick={() => onViewDetails?.(product)}>View Details</button>
        {hncUrl ? (
          <a className="secondary" href={hncUrl} target="_blank" rel="noreferrer">View on HNC</a>
        ) : null}
        {selectable ? (
          <button type="button" className="primary" onClick={() => onSelect?.(product)}>Select</button>
        ) : null}
      </div>
      <style jsx>{`
        .plumbing-product-card {
          display: flex; flex-direction: column; border: 1px solid #e2e8f0; border-radius: 12px;
          background: #fff; overflow: hidden;
        }
        .plumbing-product-media {
          height: 220px; background: #f8fafc; display: flex; align-items: center; justify-content: center; padding: 12px;
        }
        .plumbing-product-media :global(img) { width: 100%; height: 100%; object-fit: contain; object-position: center; }
        .plumbing-product-copy { display: flex; flex-direction: column; gap: 4px; padding: 12px 14px 4px; }
        .plumbing-product-brand { font-size: 16px; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; }
        .plumbing-product-name { font-size: 16px; color: #0f172a; }
        .plumbing-product-model, .plumbing-product-finish { font-size: 16px; color: #475569; }
        .plumbing-product-price { font-size: 16px; font-weight: 600; color: #0f172a; margin-top: 4px; }
        .plumbing-product-actions { display: flex; gap: 8px; padding: 12px 14px 14px; flex-wrap: wrap; }
        .plumbing-product-actions button, .plumbing-product-actions a {
          flex: 1; text-align: center; padding: 8px 10px; border-radius: 8px; font-size: 16px;
          border: 1px solid #cbd5e1; background: #fff; color: #0f172a; cursor: pointer; text-decoration: none;
        }
        .plumbing-product-actions .primary { background: #1764d9; border-color: #1764d9; color: #fff; }
        @media (max-width: 640px) {
          .plumbing-product-media { height: 180px; }
        }
      `}</style>
    </article>
  );
}
