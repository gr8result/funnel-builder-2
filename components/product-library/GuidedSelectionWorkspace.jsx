import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import ExternalProductLink from "./ExternalProductLink";
import ProductImageMagnifier from "./ProductImageMagnifier";
import { money, effectiveUpgradeValue, upgradeImpactLabel } from "../../lib/product-library/helpers";

function ProductOptionCard({ product, manufacturerName, supplierName, selected, canViewCosts, onSelect }) {
  const upgradeValue = effectiveUpgradeValue(product);
  return (
    <div className={`optionCard ${selected ? "selected" : ""}`}>
      <div className="thumb">
        <ExternalProductLink url={product.product_url} showIcon={false}>
          {product.primary_image_url ? (
            <img src={product.primary_image_url} alt={product.product_name} loading="lazy" />
          ) : (
            <span className="placeholder">Exact product image not yet available</span>
          )}
        </ExternalProductLink>
        <ProductImageMagnifier
          imageUrl={product.primary_image_url}
          name={product.product_name}
          brand={manufacturerName}
          model={product.model}
          colour={product.colour}
          finish={product.finish}
          supplier={supplierName}
          verificationStatus={product.verification_status}
          productUrl={product.product_url}
          triggerClassName="magnifier"
        />
        {selected && <span className="selectedBadge"><Check size={14} /> Selected</span>}
      </div>
      <div className="body">
        <ExternalProductLink url={product.product_url}><strong>{product.product_name}</strong></ExternalProductLink>
        <small>{manufacturerName || "No brand"}{product.model ? ` · ${product.model}` : ""}</small>
        <small className="impact">{upgradeImpactLabel(upgradeValue)}</small>
        {canViewCosts && <small className="cost">{money(product.cost_price)}</small>}
      </div>
      <button type="button" className="selectButton" onClick={() => onSelect(product)}>
        {selected ? "Selected" : "Select"}
      </button>
      <style jsx>{`
        .optionCard { border: 1px solid rgba(148,163,184,0.25); border-radius: 12px; background: rgba(15,23,42,0.7); overflow: hidden; display: grid; grid-template-rows: 150px auto auto; }
        .optionCard.selected { border-color: #22c55e; box-shadow: 0 0 0 1px #22c55e; }
        .thumb { position: relative; background: #0b1626; }
        .thumb :global(a) { display: grid; place-items: center; width: 100%; height: 100%; }
        .thumb img { width: 100%; height: 100%; object-fit: cover; }
        .placeholder { color: #64748b; font-size: 11px; text-align: center; padding: 0 10px; }
        .thumb :global(.magnifier) { position: absolute; bottom: 6px; right: 6px; }
        .selectedBadge { position: absolute; top: 6px; left: 6px; display: flex; align-items: center; gap: 4px; background: #16a34a; color: #fff; font-size: 11px; font-weight: 700; padding: 3px 7px; border-radius: 999px; }
        .body { padding: 8px 10px; display: grid; gap: 2px; }
        .body small { color: #93a4bd; font-size: 11px; }
        .body small.impact { color: #7dd3fc; font-weight: 700; }
        .body small.cost { color: #a7f3d0; }
        .selectButton { margin: 0 10px 10px; border: 0; border-radius: 8px; padding: 8px; font-weight: 800; cursor: pointer; background: ${selected ? "#16a34a" : "#2563eb"}; color: #fff; }
      `}</style>
    </div>
  );
}

function SwatchTile({ product, selected, onSelect }) {
  const upgradeValue = effectiveUpgradeValue(product);
  return (
    <button type="button" className={`swatch ${selected ? "selected" : ""}`} onClick={() => onSelect(product)}>
      <span className="swatchImage">
        {product.primary_image_url ? <img src={product.primary_image_url} alt={product.product_name} /> : <span className="swatchFallback" style={{ background: product.colour || "#94a3b8" }} />}
        {selected && <span className="tick"><Check size={12} /></span>}
      </span>
      <span className="swatchName">{product.product_name}</span>
      <span className="swatchImpact">{upgradeImpactLabel(upgradeValue)}</span>
      <style jsx>{`
        .swatch { border: 2px solid transparent; background: transparent; padding: 0; cursor: pointer; display: grid; gap: 4px; text-align: center; }
        .swatch.selected .swatchImage { border-color: #22c55e; }
        .swatchImage { position: relative; display: block; width: 100%; aspect-ratio: 1; border-radius: 10px; overflow: hidden; border: 2px solid rgba(148,163,184,0.3); background: #0b1626; }
        .swatchImage img { width: 100%; height: 100%; object-fit: cover; }
        .swatchFallback { display: block; width: 100%; height: 100%; }
        .tick { position: absolute; top: 4px; right: 4px; background: #16a34a; color: #fff; border-radius: 999px; width: 18px; height: 18px; display: grid; place-items: center; }
        .swatchName { font-size: 11px; color: #cbd5e1; font-weight: 700; }
        .swatchImpact { font-size: 10px; color: #7dd3fc; }
      `}</style>
    </button>
  );
}

function DropdownPicker({ products, selectedId, onSelect }) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) => `${product.product_name} ${product.model || ""}`.toLowerCase().includes(term));
  }, [products, search]);
  return (
    <div className="dropdownPicker">
      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products..." />
      <div className="results">
        {filtered.map((product) => {
          const upgradeValue = effectiveUpgradeValue(product);
          return (
            <button type="button" key={product.id} className={`row ${product.id === selectedId ? "selected" : ""}`} onClick={() => onSelect(product)}>
              <span className="rowThumb">{product.primary_image_url ? <img src={product.primary_image_url} alt="" /> : "—"}</span>
              <span className="rowBody">
                <strong>{product.product_name}</strong>
                <small>{product.model}</small>
              </span>
              <span className="rowImpact">{upgradeImpactLabel(upgradeValue)}</span>
            </button>
          );
        })}
        {!filtered.length && <p className="empty">No matching products.</p>}
      </div>
      <style jsx>{`
        .dropdownPicker { display: grid; gap: 8px; }
        input { padding: 9px 10px; border-radius: 8px; border: 1px solid rgba(148,163,184,0.3); background: #0f1c30; color: #e5eefb; }
        .results { display: grid; gap: 4px; max-height: 60vh; overflow-y: auto; }
        .row { display: grid; grid-template-columns: 44px 1fr auto; gap: 10px; align-items: center; padding: 8px; border-radius: 8px; border: 1px solid rgba(148,163,184,0.2); background: rgba(15,23,42,0.6); cursor: pointer; text-align: left; }
        .row.selected { border-color: #22c55e; }
        .rowThumb { width: 44px; height: 44px; border-radius: 6px; overflow: hidden; background: #0b1626; display: grid; place-items: center; color: #64748b; font-size: 11px; }
        .rowThumb img { width: 100%; height: 100%; object-fit: cover; }
        .rowBody { display: grid; gap: 2px; color: #e5eefb; font-size: 12px; }
        .rowBody small { color: #93a4bd; }
        .rowImpact { color: #7dd3fc; font-weight: 700; font-size: 12px; white-space: nowrap; }
        .empty { color: #64748b; font-size: 13px; }
      `}</style>
    </div>
  );
}

// Centre pane: renders the current checklist item's product options using the
// category's selection_control_type (cards / swatches / dropdown) — never a
// plain text-only dropdown for a visual product, per the brief.
export default function GuidedSelectionWorkspace({ checklistItem, category, products, manufacturerById, supplierById, selectedProductId, canViewCosts, onSelectProduct }) {
  if (!checklistItem) {
    return <div className="empty">Choose a checklist item on the left to begin.</div>;
  }

  const controlType = category?.selection_control_type || "cards";

  return (
    <div className="workspace">
      <header>
        <h2>{checklistItem.item_label}</h2>
        {checklistItem.room && <span className="room">{checklistItem.room}</span>}
      </header>
      {!products.length && <p className="empty">No products are catalogued for this selection yet. An administrator can add them in the Client Selections Library.</p>}
      {controlType === "swatches" && products.length > 0 && (
        <div className="swatchGrid">
          {products.map((product) => (
            <SwatchTile key={product.id} product={product} selected={product.id === selectedProductId} onSelect={onSelectProduct} />
          ))}
        </div>
      )}
      {controlType === "dropdown" && products.length > 0 && (
        <DropdownPicker products={products} selectedId={selectedProductId} onSelect={onSelectProduct} />
      )}
      {controlType === "cards" && products.length > 0 && (
        <div className="cardGrid">
          {products.map((product) => (
            <ProductOptionCard
              key={product.id}
              product={product}
              manufacturerName={manufacturerById.get(product.manufacturer_id)}
              supplierName={supplierById.get(product.supplier_id)}
              selected={product.id === selectedProductId}
              canViewCosts={canViewCosts}
              onSelect={onSelectProduct}
            />
          ))}
        </div>
      )}
      <style jsx>{`
        .workspace { display: grid; gap: 14px; align-content: start; }
        header { display: flex; align-items: baseline; gap: 10px; }
        header h2 { margin: 0; font-size: 20px; color: #e5eefb; }
        .room { color: #93a4bd; font-size: 13px; font-weight: 700; }
        .empty { color: #93a4bd; font-size: 14px; padding: 20px; text-align: center; }
        .cardGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px; }
        .swatchGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 14px; }
      `}</style>
    </div>
  );
}
