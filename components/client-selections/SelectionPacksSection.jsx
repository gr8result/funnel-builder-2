// Client Selections -> pack cards shown above a category's individual product types
// (Bathroom Accessories -> BATHROOM ACCESSORY PACKS). Everything it shows comes from
// lib/builders/selectionPacks.js: the packs offered, the packs the project requires, and the
// selected pack rebuilt from its component allocation lines. It holds no pack data of its own.
import { useMemo, useState } from "react";
import { csPx } from "../../lib/builders/clientSelectionsTypography.js";

const money = (value) => (value === null || value === undefined ? "Price pending" : `$${Number(value).toLocaleString("en-AU", { maximumFractionDigits: 2 })}`);
const signed = (value) => (value === null || value === undefined ? "—" : `${value > 0 ? "+" : value < 0 ? "−" : ""}$${Math.abs(Number(value)).toLocaleString("en-AU", { maximumFractionDigits: 2 })}`);
const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

export default function SelectionPacksSection({ group = {}, packs = [], required = { quantity: 0, rooms: [], excluded: [] }, selected = null, allowancePerPack = 0, allowanceSource = "", alternativesFor = () => [], onSelect, onRemove, onSubstitute }) {
  const tiers = useMemo(() => Array.from(new Map(packs.map((pack) => [pack.tier, pack.tierLabel || pack.tier])).entries()), [packs]);
  const [tier, setTier] = useState("");
  const [brand, setBrand] = useState("");
  const [finish, setFinish] = useState("");
  const [viewing, setViewing] = useState(null);
  const [swapping, setSwapping] = useState(null);
  const activeTier = tier || packs.find((pack) => pack.packId === selected?.packId)?.tier || tiers[0]?.[0] || "";
  const inTier = packs.filter((pack) => pack.tier === activeTier);
  const brands = Array.from(new Set(inTier.map((pack) => pack.brand))).sort();
  const finishes = Array.from(new Set(inTier.filter((pack) => !brand || pack.brand === brand).map((pack) => pack.finish))).sort();
  const visible = inTier.filter((pack) => (!brand || pack.brand === brand) && (!finish || pack.finish === finish));
  const quantity = required.quantity;
  const roomList = required.rooms.map((room) => (room.packs > 1 ? `${room.label} ×${room.packs}` : room.label)).join(" + ");
  const totalFor = (pack) => (pack.pricePerPack === null ? null : Math.round(pack.pricePerPack * quantity * 100) / 100);
  const select = (pack) => { setViewing(null); onSelect?.(pack); };

  return (
    <section className="packSection" data-testid={`selection-packs-${group.key}`}>
      <header className="packHeader">
        <div>
          <h2>{group.label}</h2>
          <p>Choose one coordinated pack for every bathroom instead of selecting each accessory separately. You can still change any single item afterwards.</p>
        </div>
        <div className="packRequired" data-testid="selection-pack-required">
          <span>Required Quantity</span>
          <strong data-testid="selection-pack-required-quantity">{quantity}</strong>
          <em>{quantity ? roomList : "No bathroom or ensuite found in this project's rooms"}</em>
          {required.excluded.length ? <small>Not counted: {required.excluded.map((room) => room.label).join(", ")}</small> : null}
        </div>
      </header>

      {selected ? (
        <div className="packSelected" data-testid="selection-pack-selected" data-pack-id={selected.packId}>
          <div className="packSelectedTop">
            {selected.imageUrl ? <img src={selected.imageUrl} alt={selected.packName} /> : null}
            <div>
              <span>✓ Selected pack{selected.substituted ? " — with changed items" : ""}</span>
              <h3>{selected.packName}</h3>
              <em>{selected.finish}</em>
            </div>
            <dl>
              <div><dt>{plural(selected.packQuantity, "pack")} @</dt><dd>{money(selected.pricePerPack)}</dd></div>
              <div><dt>Total</dt><dd data-testid="selection-pack-selected-total">{money(selected.selectedTotal)}</dd></div>
              <div><dt>Allowance</dt><dd data-testid="selection-pack-selected-allowance">{money(selected.allowanceTotal)}</dd></div>
              <div className={selected.variation > 0 ? "bad" : selected.variation < 0 ? "good" : ""}><dt>{selected.variation < 0 ? "Credit" : "Variation"}</dt><dd data-testid="selection-pack-selected-variation">{signed(selected.variation)}</dd></div>
            </dl>
          </div>
          <table>
            <thead><tr><th>Item</th><th>Product</th><th>Per pack</th><th>Total qty</th><th>Total</th><th /></tr></thead>
            <tbody>
              {selected.components.map((component) => (
                <tr key={component.componentKey} data-testid={`selection-pack-component-${component.componentKey}`} data-quantity={component.quantity}>
                  <td>{component.label}</td>
                  <td><strong>{component.line.productName}</strong>{component.substituted ? <small>Changed from {component.packProductName}</small> : null}</td>
                  <td>{component.quantityPerPack}</td>
                  <td>{component.quantity}</td>
                  <td>{money(component.line.selectedTotal)}</td>
                  <td><button type="button" onClick={() => setSwapping(component)}>Change item</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="packSelectedActions">
            <button type="button" onClick={() => { if (typeof window === "undefined" || window.confirm(`Remove ${selected.packName} and its ${plural(selected.components.length, "item")}?`)) onRemove?.(); }}>Remove pack</button>
          </div>
        </div>
      ) : null}

      {packs.length ? (
        <>
          <div className="packFilters">
            {tiers.length > 1 ? (
              <div className="packTiers" role="tablist">
                {tiers.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={key === activeTier} className={key === activeTier ? "active" : ""} onClick={() => { setTier(key); setBrand(""); setFinish(""); }}>{label} packs</button>)}
              </div>
            ) : null}
            {brands.length > 1 ? <label><span>Brand</span><select value={brand} onChange={(event) => { setBrand(event.target.value); setFinish(""); }}><option value="">All brands</option>{brands.map((value) => <option key={value}>{value}</option>)}</select></label> : null}
            {finishes.length > 1 ? <label><span>Finish</span><select value={finish} onChange={(event) => setFinish(event.target.value)}><option value="">All finishes</option>{finishes.map((value) => <option key={value}>{value}</option>)}</select></label> : null}
            <span className="packAllowance">Allowance {money(allowancePerPack)} per pack{allowanceSource ? ` — ${allowanceSource}` : ""}</span>
          </div>
          <div className="packGrid" data-testid="selection-pack-grid">
            {visible.map((pack) => {
              const isSelected = selected?.packId === pack.packId;
              return (
                <article key={pack.packId} className={`packCard ${isSelected ? "selected" : ""}`} data-testid="selection-pack-card" data-pack-id={pack.packId}>
                  {isSelected ? <span className="packFlag">✓ Selected</span> : pack.isDefault ? <span className="packFlag standard">Standard inclusion</span> : null}
                  <button type="button" className="packImage" onClick={() => setViewing(pack)} aria-label={`View ${pack.packName}`}>
                    {pack.imageUrl ? <img src={pack.imageUrl} alt={pack.packName} loading="lazy" /> : null}
                  </button>
                  <div className="packBody">
                    <span className="packBrand">{[pack.brand, pack.range].filter(Boolean).join(" · ")}</span>
                    <h3>{pack.packName}</h3>
                    <em>{pack.finish}</em>
                    <div className="packIncludes">
                      <b>Includes:</b>
                      <ul>{pack.components.map((component) => <li key={component.componentKey}>{component.quantity} x {component.label}</li>)}</ul>
                    </div>
                    <div className="packMoney">
                      <strong>{pack.pricePerPack === null ? "Price pending" : `${money(pack.pricePerPack)} per pack`}</strong>
                      <span>Project requires: <b>{plural(quantity, "pack")}</b></span>
                      <span className="packTotal">Total: <b>{money(totalFor(pack))}</b></span>
                    </div>
                    <div className="packActions">
                      <button type="button" onClick={() => setViewing(pack)}>View Pack</button>
                      <button type="button" className="primary" data-testid="selection-pack-select" disabled={!quantity || isSelected} onClick={() => select(pack)}>{isSelected ? "Selected" : "Select Pack"}</button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      ) : <p className="packEmpty">No coordinated accessory range in the Product Library can fill a complete pack yet. Select accessories individually below.</p>}

      {viewing ? (
        <div className="packOverlay" role="dialog" aria-modal="true" aria-label={viewing.packName} data-testid="selection-pack-view" onClick={() => setViewing(null)}>
          <div className="packModal" onClick={(event) => event.stopPropagation()}>
            <header><div><span>{[viewing.brand, viewing.range, viewing.finish].filter(Boolean).join(" · ")}</span><h3>{viewing.packName}</h3></div><button type="button" aria-label="Close" onClick={() => setViewing(null)}>×</button></header>
            {viewing.description ? <p>{viewing.description}</p> : null}
            {viewing.coordination === "brand-finish" ? <p className="packNote">All items are {viewing.brand} in {viewing.finish}. No single {viewing.brand} collection offers every item in this finish, so the pack combines collections.</p> : null}
            <ul className="packItems">
              {viewing.components.map((component) => (
                <li key={component.componentKey}>
                  {component.imageUrl ? <img src={component.imageUrl} alt={component.productName} loading="lazy" /> : <span />}
                  <div><b>{component.quantity} x {component.label}</b><span>{component.productName}</span><small>Code: {component.product?.attributes?.hncProductCode || component.product?.model || component.productCode}</small></div>
                  <strong>{component.unitPrice === null ? "Price pending" : `${money(component.unitPrice)} each`}</strong>
                </li>
              ))}
            </ul>
            <dl className="packModalTotals">
              <div><dt>Price per pack</dt><dd>{money(viewing.pricePerPack)}</dd></div>
              <div><dt>Project requires</dt><dd>{plural(quantity, "pack")}{roomList ? ` (${roomList})` : ""}</dd></div>
              <div><dt>Total</dt><dd>{money(totalFor(viewing))}</dd></div>
              <div><dt>Allowance</dt><dd>{money(allowancePerPack * quantity)}</dd></div>
              <div><dt>Variation</dt><dd>{viewing.pricePerPack === null ? "—" : signed(Math.round((viewing.pricePerPack - allowancePerPack) * quantity * 100) / 100)}</dd></div>
            </dl>
            <footer>
              <button type="button" onClick={() => setViewing(null)}>Close</button>
              <button type="button" className="primary" disabled={!quantity || selected?.packId === viewing.packId} onClick={() => select(viewing)}>{selected?.packId === viewing.packId ? "Selected" : "Select Pack"}</button>
            </footer>
          </div>
        </div>
      ) : null}

      {swapping ? (
        <div className="packOverlay" role="dialog" aria-modal="true" aria-label={`Change ${swapping.label}`} data-testid="selection-pack-swap" onClick={() => setSwapping(null)}>
          <div className="packModal" onClick={(event) => event.stopPropagation()}>
            <header><div><span>{selected?.packName}</span><h3>Change {swapping.label}</h3></div><button type="button" aria-label="Close" onClick={() => setSwapping(null)}>×</button></header>
            <p>The rest of the pack stays as selected. Quantity stays at {swapping.quantity}.</p>
            <ul className="packItems">
              {alternativesFor(swapping).map((option) => (
                <li key={option.productId} className={option.current ? "current" : ""} data-testid="selection-pack-swap-option" data-product-code={option.product.productCode}>
                  {option.product.primaryImageUrl || option.product.imageUrl ? <img src={option.product.imageUrl || option.product.primaryImageUrl} alt={option.product.productName} loading="lazy" /> : <span />}
                  <div><b>{option.product.productName}</b><span>{[option.product.brand, option.finish].filter(Boolean).join(" · ")}</span>{option.coordinated ? <small>Matches this pack's brand and finish</small> : null}</div>
                  <strong>{option.unitPrice === null ? "Price pending" : `${money(option.unitPrice)} each`}</strong>
                  <button type="button" className="primary" disabled={option.current} onClick={() => { onSubstitute?.(swapping, option.product); setSwapping(null); }}>{option.current ? "Current" : "Use this"}</button>
                </li>
              ))}
            </ul>
            <footer><button type="button" onClick={() => setSwapping(null)}>Cancel</button></footer>
          </div>
        </div>
      ) : null}

      <style jsx>{`
        .packSection { display: grid; gap: 18px; border: 1px solid #cbd5e1; border-radius: 14px; background: #ffffff; padding: 22px; font-size: ${csPx("body")}; color: #0f172a; }
        .packHeader { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 18px; align-items: flex-start; }
        .packHeader h2 { margin: 0; font-size: ${csPx("featureTitle")}; font-weight: 950; text-transform: uppercase; letter-spacing: .03em; }
        .packHeader p { margin: 6px 0 0; max-width: 640px; color: #475569; }
        .packRequired { display: grid; gap: 2px; min-width: 240px; border-radius: 10px; background: #eff6ff; border: 1px solid #bfdbfe; padding: 12px 16px; }
        .packRequired span { font-weight: 900; text-transform: uppercase; letter-spacing: .04em; color: #1e40af; }
        .packRequired strong { font-size: 34px; line-height: 1; font-weight: 950; }
        .packRequired em { font-style: normal; font-weight: 800; }
        .packRequired small { font-size: ${csPx("body")}; color: #64748b; }
        .packFilters { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; }
        .packFilters label { display: grid; gap: 4px; font-weight: 800; color: #475569; }
        .packFilters select { width: auto; min-height: 40px; border: 1px solid #cbd5e1; border-radius: 8px; padding: 0 10px; font-size: ${csPx("body")}; font-weight: 700; background: #ffffff !important; color: #0f172a !important; }
        .packTiers { display: flex; gap: 6px; }
        .packTiers button { min-height: 40px; border: 1px solid #cbd5e1; border-radius: 8px; background: #ffffff; color: #0f172a; padding: 0 16px; font-size: ${csPx("button")}; font-weight: 900; cursor: pointer; }
        .packTiers button.active { border-color: #1764d9; background: #1764d9; color: #ffffff; }
        .packAllowance { margin-left: auto; font-weight: 800; color: #475569; }
        .packGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 18px; }
        .packCard { position: relative; display: grid; grid-template-rows: auto 1fr; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff; }
        .packCard.selected { border-color: #16a34a; box-shadow: 0 0 0 2px #16a34a; }
        .packFlag { position: absolute; top: 10px; left: 10px; z-index: 1; border-radius: 999px; background: #16a34a; color: #ffffff; padding: 4px 12px; font-weight: 900; }
        .packFlag.standard { background: #0f172a; }
        .packImage { border: 0; background: #f8fafc; padding: 0; cursor: pointer; height: 200px; }
        .packImage img { width: 100%; height: 100%; object-fit: contain; }
        .packBody { display: grid; gap: 8px; padding: 16px; align-content: start; }
        .packBrand { font-weight: 900; text-transform: uppercase; letter-spacing: .04em; color: #64748b; }
        .packBody h3 { margin: 0; font-size: ${csPx("cardTitle")}; font-weight: 950; text-transform: uppercase; line-height: 1.15; }
        .packBody em { font-style: normal; font-weight: 800; color: #334155; }
        .packIncludes ul { margin: 4px 0 0; padding: 0; list-style: none; display: grid; gap: 2px; }
        .packMoney { display: grid; gap: 2px; border-top: 1px solid #e2e8f0; padding-top: 10px; }
        .packMoney strong { font-size: ${csPx("price")}; font-weight: 950; }
        .packTotal b { font-size: ${csPx("price")}; }
        .packActions, .packSelectedActions, .packModal footer { display: flex; gap: 8px; justify-content: flex-end; }
        .packActions { margin-top: 6px; }
        .packActions button { flex: 1; }
        button { font-family: inherit; }
        .packActions button, .packSelectedActions button, .packModal footer button, .packItems button, .packSelected td button { min-height: 42px; border: 1px solid #cbd5e1; border-radius: 8px; background: #ffffff; color: #0f172a; padding: 0 14px; font-size: ${csPx("button")}; font-weight: 900; text-transform: uppercase; cursor: pointer; }
        button.primary { border-color: #1764d9; background: #1764d9; color: #ffffff; }
        button:disabled { opacity: .55; cursor: not-allowed; }
        .packSelected { display: grid; gap: 12px; border: 2px solid #16a34a; border-radius: 12px; background: #f0fdf4; padding: 16px; }
        .packSelectedTop { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; }
        .packSelectedTop img { width: 96px; height: 96px; object-fit: contain; border-radius: 8px; background: #ffffff; border: 1px solid #e2e8f0; }
        .packSelectedTop > div { flex: 1; min-width: 220px; display: grid; gap: 2px; }
        .packSelectedTop span { font-weight: 900; color: #15803d; text-transform: uppercase; }
        .packSelectedTop h3 { margin: 0; font-size: ${csPx("cardTitle")}; font-weight: 950; }
        .packSelectedTop em { font-style: normal; font-weight: 800; }
        .packSelected dl, .packModalTotals { display: grid; grid-template-columns: repeat(2, minmax(0, auto)); gap: 4px 20px; margin: 0; }
        .packSelected dl div, .packModalTotals div { display: flex; justify-content: space-between; gap: 12px; }
        dt { font-weight: 800; color: #475569; text-transform: uppercase; }
        dd { margin: 0; font-weight: 950; font-size: ${csPx("productName")}; }
        .bad dd { color: #b91c1c; }
        .good dd { color: #15803d; }
        .packSelected table { width: 100%; border-collapse: collapse; background: #ffffff; border-radius: 8px; }
        .packSelected th { text-align: left; padding: 8px; color: #64748b; text-transform: uppercase; font-size: ${csPx("label")}; border-bottom: 1px solid #e2e8f0; }
        .packSelected td { padding: 8px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
        .packSelected td small { display: block; color: #b45309; font-size: ${csPx("body")}; font-weight: 700; }
        .packEmpty, .packNote { margin: 0; color: #475569; font-weight: 700; }
        .packNote { border-left: 4px solid #f59e0b; padding-left: 10px; }
        .packOverlay { position: fixed; inset: 0; z-index: 1200; display: flex; align-items: center; justify-content: center; background: rgba(15,23,42,.55); padding: 16px; }
        .packModal { width: min(720px, 100%); max-height: calc(100vh - 32px); overflow: auto; display: grid; gap: 14px; border-radius: 12px; background: #ffffff; padding: 20px; }
        .packModal header { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
        .packModal header span { font-weight: 900; color: #64748b; text-transform: uppercase; }
        .packModal header h3 { margin: 2px 0 0; font-size: ${csPx("featureTitle")}; font-weight: 950; }
        .packModal header button { border: 0; background: transparent; font-size: 28px; line-height: 1; cursor: pointer; }
        .packModal p { margin: 0; }
        .packItems { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
        .packItems li { display: grid; grid-template-columns: 72px 1fr auto auto; gap: 12px; align-items: center; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; }
        .packItems li.current { border-color: #16a34a; background: #f0fdf4; }
        .packItems img, .packItems li > span { width: 72px; height: 72px; object-fit: contain; }
        .packItems div { display: grid; gap: 2px; }
        .packItems small { font-size: ${csPx("body")}; color: #64748b; }
        .packItems strong { font-size: ${csPx("productName")}; white-space: nowrap; }
        @media (max-width: 720px) {
          .packItems li { grid-template-columns: 56px 1fr; }
          .packItems img, .packItems li > span { width: 56px; height: 56px; }
          .packAllowance { margin-left: 0; }
          .packSelected thead { display: none; }
          .packSelected td { display: block; border: 0; padding: 2px 8px; }
          .packSelected tr { display: block; border-bottom: 1px solid #e2e8f0; padding: 8px 0; }
        }
      `}</style>
    </section>
  );
}
