// Large, client/builder-facing product detail panel for Plumbing Fixtures &
// Tapware. Replaces the old behaviour of routing "View Details" into the
// flat admin "Manage Catalogue Items" table - this is a proper visual
// selection surface: big image left, readable organised information right.
import { Fragment, useState } from "react";
import { X, Check, ExternalLink } from "lucide-react";
import ProductLibraryProductImage from "./ProductLibraryProductImage";
import { productPriceLabel } from "../../lib/product-library/productPresentation.js";

function galleryImages(product) {
  const images = [product.primaryImageUrl || product.primaryImage, ...(product.galleryImageUrls || product.additionalImages || [])]
    .filter(Boolean);
  return [...new Set(images)];
}

export default function PlumbingProductDetailModal({ product, familyItem, onClose, onSelect, selectable = true }) {
  const images = galleryImages(product);
  const [activeImage, setActiveImage] = useState(images[0] || "");
  if (!product) return null;

  const brand = product.brand || product.manufacturer || "";
  const model = product.model || product.sku || product.productCode || "";
  const finish = product.finish || product.colour || "";
  const priceLabel = productPriceLabel ? productPriceLabel(product) : "Price requires verification";
  const hncUrl = product.officialProductUrl || product.sourceUrl || "";
  const isHnc = /harveynormancommercial/i.test(hncUrl) || /harvey norman/i.test(product.sourceName || product.supplier || "");

  const dimensionRows = [
    ["Width", product.width],
    ["Height", product.height],
    ["Depth", product.depth],
    ["Dimensions", typeof product.dimensions === "string" ? product.dimensions : ""],
  ].filter(([, value]) => value);

  const features = Array.isArray(product.attributes?.features) ? product.attributes.features : [];

  return (
    <div className="plumbing-detail-overlay" role="dialog" aria-modal="true" aria-label={product.productName} onClick={onClose}>
      <div className="plumbing-detail-panel" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="plumbing-detail-close" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>
        <div className="plumbing-detail-body">
          <div className="plumbing-detail-media">
            <div className="plumbing-detail-image">
              {activeImage ? (
                <img src={activeImage} alt={product.productName} />
              ) : (
                <ProductLibraryProductImage product={product} familyItem={familyItem} large />
              )}
            </div>
            {images.length > 1 ? (
              <div className="plumbing-detail-thumbs">
                {images.map((src) => (
                  <button
                    key={src}
                    type="button"
                    className={src === activeImage ? "selected" : ""}
                    onClick={() => setActiveImage(src)}
                  >
                    <img src={src} alt="" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="plumbing-detail-info">
            <div className="plumbing-detail-heading">
              {brand ? <span className="plumbing-detail-brand">{brand}</span> : null}
              <h2>{product.productName || "Unnamed product"}</h2>
              {model ? <div className="plumbing-detail-model">Model / Product Code: <strong>{model}</strong></div> : null}
              <div className="plumbing-detail-price">{priceLabel}</div>
            </div>

            <div className="plumbing-detail-actions">
              {selectable ? (
                <button type="button" className="primary" onClick={() => onSelect?.(product)}><Check size={16} /> Select Product</button>
              ) : null}
              {hncUrl ? (
                <a className="secondary" href={hncUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} /> View on HNC</a>
              ) : null}
              <button type="button" className="tertiary" onClick={onClose}>Close</button>
            </div>

            {product.description ? (
              <section className="plumbing-detail-section">
                <h3>Description</h3>
                <p>{product.description}</p>
              </section>
            ) : null}

            <section className="plumbing-detail-section">
              <h3>Product Details</h3>
              <dl className="plumbing-detail-list">
                {brand ? <><dt>Brand</dt><dd>{brand}</dd></> : null}
                {model ? <><dt>Model</dt><dd>{model}</dd></> : null}
                {product.productCode ? <><dt>Product code</dt><dd>{product.productCode}</dd></> : null}
                {product.categoryKey ? <><dt>Category</dt><dd>{product.categoryKey}</dd></> : null}
                {finish ? <><dt>Finish / Colour</dt><dd>{finish}</dd></> : null}
                {dimensionRows.map(([label, value]) => (
                  <Fragment key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </Fragment>
                ))}
              </dl>
            </section>

            {features.length ? (
              <section className="plumbing-detail-section">
                <h3>Features</h3>
                <ul className="plumbing-detail-features">
                  {features.map((feature) => <li key={feature}>{feature}</li>)}
                </ul>
              </section>
            ) : null}

            <section className="plumbing-detail-section plumbing-detail-supplier">
              <h3>Supplier</h3>
              <dl className="plumbing-detail-list">
                <dt>Supplier</dt>
                <dd>{isHnc ? "Harvey Norman Commercial" : (product.supplier || product.sourceName || "Not supplied")}</dd>
                <dt>Price status</dt>
                <dd>{product.priceStatus === "current" || product.priceStatus === "fixed" ? "Verified current price" : "Price requires verification"}</dd>
                {product.sourceVerifiedAt || product.priceVerifiedAt ? (
                  <>
                    <dt>Date checked</dt>
                    <dd>{product.sourceVerifiedAt || product.priceVerifiedAt}</dd>
                  </>
                ) : null}
              </dl>
            </section>
          </div>
        </div>
      </div>
      <style jsx>{`
        .plumbing-detail-overlay {
          position: fixed; inset: 0; background: rgba(15, 23, 42, 0.55);
          display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px;
        }
        .plumbing-detail-panel {
          position: relative; background: #fff; border-radius: 16px; width: 85vw; max-width: 1300px;
          max-height: 90vh; overflow-y: auto; box-shadow: 0 24px 60px rgba(15, 23, 42, 0.35);
        }
        .plumbing-detail-close {
          position: absolute; top: 16px; right: 16px; border: none; background: #f1f5f9; border-radius: 50%;
          width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 2;
        }
        .plumbing-detail-body { display: grid; grid-template-columns: 55% 45%; gap: 0; }
        .plumbing-detail-media { display: flex; flex-direction: column; gap: 12px; padding: 32px; background: #f8fafc; border-radius: 16px 0 0 16px; }
        .plumbing-detail-image { height: 500px; display: flex; align-items: center; justify-content: center; background: #fff; border-radius: 12px; }
        .plumbing-detail-image img { max-width: 100%; max-height: 100%; object-fit: contain; }
        .plumbing-detail-thumbs { display: flex; gap: 8px; flex-wrap: wrap; }
        .plumbing-detail-thumbs button { width: 56px; height: 56px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; padding: 4px; cursor: pointer; }
        .plumbing-detail-thumbs button.selected { border-color: #1764d9; }
        .plumbing-detail-thumbs img { width: 100%; height: 100%; object-fit: contain; }
        .plumbing-detail-info { padding: 32px; display: flex; flex-direction: column; gap: 20px; }
        .plumbing-detail-brand { font-size: 16px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; font-weight: 600; }
        .plumbing-detail-heading h2 { margin: 4px 0 8px; font-size: 26px; line-height: 1.25; color: #0f172a; }
        .plumbing-detail-model { font-size: 16px; color: #475569; margin-bottom: 6px; }
        .plumbing-detail-price { font-size: 24px; font-weight: 700; color: #0f172a; }
        .plumbing-detail-actions { display: flex; gap: 10px; flex-wrap: wrap; }
        .plumbing-detail-actions button, .plumbing-detail-actions a {
          padding: 12px 18px; border-radius: 10px; font-size: 16px; font-weight: 600; cursor: pointer;
          text-decoration: none; border: 1px solid #cbd5e1; background: #fff; color: #0f172a; display: inline-flex; align-items: center; gap: 6px;
        }
        .plumbing-detail-actions .primary { background: #1764d9; border-color: #1764d9; color: #fff; }
        .plumbing-detail-actions .tertiary { background: transparent; border-color: transparent; color: #64748b; }
        .plumbing-detail-section h3 { margin: 0 0 10px; font-size: 18px; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
        .plumbing-detail-section p { font-size: 16px; line-height: 1.6; color: #334155; margin: 0; }
        .plumbing-detail-list { display: grid; grid-template-columns: 140px 1fr; row-gap: 8px; column-gap: 12px; margin: 0; }
        .plumbing-detail-list dt { font-size: 16px; color: #64748b; }
        .plumbing-detail-list dd { font-size: 16px; color: #0f172a; margin: 0; }
        .plumbing-detail-features { margin: 0; padding-left: 18px; font-size: 16px; color: #334155; line-height: 1.7; }
        .plumbing-detail-supplier { background: #f8fafc; border-radius: 10px; padding: 14px 16px; border-bottom: none; }
        .plumbing-detail-supplier h3 { border-bottom: none; padding-bottom: 0; }
        @media (max-width: 900px) {
          .plumbing-detail-panel { width: 95vw; max-height: 95vh; }
          .plumbing-detail-body { grid-template-columns: 1fr; }
          .plumbing-detail-media { border-radius: 16px 16px 0 0; }
          .plumbing-detail-image { height: 320px; }
        }
      `}</style>
    </div>
  );
}
