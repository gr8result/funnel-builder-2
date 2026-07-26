import { memo } from "react";
import { money, computeSellPrice, isMissingRequiredImage, effectiveUpgradeValue, upgradeImpactLabel } from "../../lib/product-library/helpers";
import { PRICING_TIERS } from "../../lib/product-library/constants";

function tierLabel(tier) {
  return PRICING_TIERS.find((entry) => entry.value === (tier || "CLASSIC"))?.label || "Classic";
}

function Card({ product, categoryName, supplierName, manufacturerName, canViewCosts, onOpen }) {
  const missingImage = isMissingRequiredImage(product);
  const sellPrice = computeSellPrice(product);
  const upgradeValue = effectiveUpgradeValue(product);

  if (!product.is_visual_product) {
    return (
      <button type="button" className="card compact" onClick={() => onOpen(product)}>
        <span className="icon">{(categoryName || "•")[0]}</span>
        <span className="body">
          <strong>{product.product_name}</strong>
          <small>{categoryName || "Uncategorised"} · {supplierName || "No supplier"}</small>
          <small className="impact">{upgradeImpactLabel(upgradeValue)}</small>
          {canViewCosts && <small className="price">{money(product.cost_price)}{sellPrice != null ? ` → ${money(sellPrice)}` : ""}</small>}
        </span>
        <span className={product.active === false ? "status inactive" : "status active"}>{product.active === false ? "Inactive" : "Active"}</span>
      </button>
    );
  }

  return (
    <button type="button" className="card visual" onClick={() => onOpen(product)}>
      <span className="thumb">
        {product.primary_image_url ? (
          <img src={product.primary_image_url} alt={product.product_name} loading="lazy" />
        ) : missingImage ? (
          <span className="required-badge">Image required</span>
        ) : (
          <span className="placeholder">No Product Image Available</span>
        )}
        <span className="tier-badge">{tierLabel(product.pricing_tier)}</span>
      </span>
      <span className="body">
        <strong>{product.product_name}</strong>
        <small>{manufacturerName || "No brand"}{product.model ? ` · ${product.model}` : ""}</small>
        <small>{[categoryName, product.subcategory].filter(Boolean).join(" · ") || categoryName}</small>
        <small>{supplierName || "No supplier"}</small>
        <small className="impact">{upgradeImpactLabel(upgradeValue)}</small>
        {canViewCosts && <small className="price">{money(product.cost_price) || money(product.retail_price)}{sellPrice != null ? ` → ${money(sellPrice)}` : ""}</small>}
      </span>
      <span className={product.active === false ? "status inactive" : "status active"}>{product.active === false ? "Inactive" : "Active"}</span>
    </button>
  );
}

const MemoCard = memo(Card);

export default function ProductLibraryCards({ products, categoryById, supplierById, manufacturerById, canViewCosts = true, onOpenProduct }) {
  return (
    <div className="card-grid">
      {products.map((product) => (
        <MemoCard
          key={product.id}
          product={product}
          categoryName={categoryById.get(product.category_id)}
          supplierName={supplierById.get(product.supplier_id)}
          manufacturerName={manufacturerById.get(product.manufacturer_id)}
          canViewCosts={canViewCosts}
          onOpen={onOpenProduct}
        />
      ))}
      {!products.length && <p className="empty">No products match the current filters.</p>}

      <style jsx>{`
        .card-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }
        @media (max-width: 1280px) {
          .card-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        @media (max-width: 900px) {
          .card-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 560px) {
          .card-grid {
            grid-template-columns: 1fr;
          }
        }
        .card {
          display: grid;
          text-align: left;
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 12px;
          background: rgba(15, 23, 42, 0.85);
          color: #e5eefb;
          cursor: pointer;
          padding: 0;
          overflow: hidden;
        }
        .card.visual {
          grid-template-rows: 160px auto;
        }
        .card.visual .thumb {
          position: relative;
          display: grid;
          place-items: center;
          background: #0b1626;
          overflow: hidden;
        }
        .card.visual .thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .required-badge {
          color: #fbbf24;
          font-weight: 800;
          font-size: 12px;
        }
        .placeholder {
          color: #64748b;
          font-size: 12px;
        }
        .card.compact {
          grid-template-columns: 44px minmax(0, 1fr) auto;
          align-items: center;
          gap: 10px;
          padding: 12px;
        }
        .card.compact .icon {
          display: grid;
          place-items: center;
          width: 44px;
          height: 44px;
          border-radius: 8px;
          background: rgba(56, 189, 248, 0.14);
          color: #38bdf8;
          font-weight: 800;
          text-transform: uppercase;
        }
        .body {
          display: grid;
          gap: 3px;
          padding: 12px;
        }
        .card.compact .body {
          padding: 0;
        }
        .body strong {
          font-size: 14px;
        }
        .body small {
          color: #93a4bd;
          font-size: 12px;
        }
        .body small.price {
          color: #a7f3d0;
          font-weight: 700;
        }
        .body small.impact {
          color: #7dd3fc;
          font-weight: 700;
        }
        .tier-badge {
          position: absolute;
          top: 8px;
          left: 8px;
          background: rgba(2, 6, 23, 0.72);
          color: #e5eefb;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          padding: 3px 8px;
          border-radius: 999px;
        }
        .status {
          justify-self: start;
          margin: 0 12px 12px;
          padding: 2px 8px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
          width: fit-content;
        }
        .card.compact .status {
          margin: 0;
        }
        .status.active {
          background: rgba(34, 197, 94, 0.16);
          color: #4ade80;
        }
        .status.inactive {
          background: rgba(148, 163, 184, 0.16);
          color: #94a3b8;
        }
        .empty {
          grid-column: 1 / -1;
          color: #93a4bd;
          text-align: center;
          padding: 40px 0;
        }
      `}</style>
    </div>
  );
}
