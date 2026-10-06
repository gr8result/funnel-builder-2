// Client Selections > Flooring. Browse the Product Library's non-tile flooring by type, choose a
// genuine colour, APPLY it to several floor areas at once, then change any single area later.
// Quantities (net -> wastage -> required -> whole packs) come from lib/builders/flooringSelection.js;
// this component only collects choices. Readable text is never below 16px.
import { useEffect, useMemo, useRef, useState } from "react";
import { activeFlooringVariants, DEFAULT_FLOORING_WASTAGE_PCT, FLOORING_TYPES, flooringCountsByType, flooringVariantPricing } from "../../lib/product-library/flooringCatalogue.js";
import { applyFlooringChoice, clearFlooringChoice, flooringAreaStatus, flooringLines, flooringVariantFor, newFlooringArea, refreshTakeoffAreas, suggestedFlooringAreas } from "../../lib/builders/flooringSelection.js";
import CarpetOrder, { CarpetSpecifications } from "./CarpetOrder.jsx";

const money = (value) => (value === null || value === undefined || value === "" ? "Price not published" : new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(Number(value)));
const m2 = (value) => (value === null || value === undefined || value === "" ? "—" : `${Number(value).toFixed(2)}m²`);
const dims = (item) => ([item?.widthMm, item?.lengthMm].every(Boolean) ? `${item.widthMm} x ${item.lengthMm}${item.thicknessMm ? ` x ${item.thicknessMm}mm` : "mm"}` : (item?.thicknessMm ? `${item.thicknessMm}mm` : ""));
const unique = (values) => [...new Set(values.filter((value) => value !== null && value !== undefined && value !== ""))];

export default function FlooringSelectionWorkflow({ savedAreas = [], savedAllowanceOverrides = {}, savedCarpetOptions = {}, carpetRates = {}, projectRoomNames = [], takeoff = {}, flooringProducts = [], productById = () => null, allowanceFor = () => ({ allowancePerM2ExGst: 0, source: "" }), saving = false, onSave, onBack, backLabel = "← Interior", budgetDock = null }) {
  const [areas, setAreas] = useState(() => (savedAreas.length ? refreshTakeoffAreas(savedAreas, takeoff) : suggestedFlooringAreas(projectRoomNames, takeoff)));
  // Suggested rooms are not user edits. A saved job can hydrate after this screen mounts;
  // marking suggestions dirty would prevent its existing selections from ever being adopted.
  const [dirty, setDirty] = useState(false);
  const [browsing, setBrowsing] = useState(null); // { type, forAreaId }
  const [applying, setApplying] = useState(null); // { product, variant, forAreaId }
  const [overrides, setOverrides] = useState(() => savedAllowanceOverrides || {});
  const [carpetOptions, setCarpetOptions] = useState(() => savedCarpetOptions || {});
  const lastSaved = useRef(savedAreas);
  const lastTakeoff = useRef(takeoff);
  const lastRoomNames = useRef(projectRoomNames);
  // The job's saved areas can arrive after this screen opens; adopt them unless there are edits.
  useEffect(() => {
    if (savedAreas === lastSaved.current && takeoff === lastTakeoff.current && projectRoomNames === lastRoomNames.current) return;
    lastSaved.current = savedAreas;
    lastTakeoff.current = takeoff;
    lastRoomNames.current = projectRoomNames;
    if (!dirty) { setAreas(savedAreas.length ? refreshTakeoffAreas(savedAreas, takeoff) : suggestedFlooringAreas(projectRoomNames, takeoff)); setCarpetOptions(savedCarpetOptions || {}); }
  }, [savedAreas, dirty, takeoff, savedCarpetOptions, projectRoomNames]);

  const change = (next) => { setAreas(next); setDirty(true); };
  const updateArea = (id, patch) => change(areas.map((area) => (area.id === id ? { ...area, ...patch } : area)));
  const save = async () => { await onSave?.(areas, overrides, carpetOptions); setDirty(false); };
  // Builder material allowance per m2 (ex GST) per flooring type overrides the estimate rate.
  const effectiveAllowanceFor = useMemo(() => (typeKey) => (overrides[typeKey] !== undefined && overrides[typeKey] !== "" ? { allowancePerM2ExGst: Number(overrides[typeKey]), source: "Builder material allowance (ex GST)" } : allowanceFor(typeKey)), [overrides, allowanceFor]);
  const counts = useMemo(() => flooringCountsByType(flooringProducts), [flooringProducts]);
  const lines = useMemo(() => flooringLines(areas, { productById, allowanceFor: effectiveAllowanceFor, carpetOptions, carpetRates }), [areas, productById, effectiveAllowanceFor, carpetOptions, carpetRates]);
  const status = flooringAreaStatus(areas);

  if (applying) {
    return (
      <section className="fl-shell" data-testid="flooring-apply">
        <style>{FLOORING_BROWSER_CSS}</style>
        {budgetDock}
        <ApplyPanel areas={areas} productById={productById} product={applying.product} variant={applying.variant} preselect={applying.forAreaId}
          onCancel={() => setApplying(null)}
          onApply={(ids, wastagePct) => { change(applyFlooringChoice(areas, ids, { productId: applying.product.productId, variantId: applying.variant.variantId, wastagePct })); const history = applying.product.attributes?.carpetQuoteHistory?.[applying.variant.variantId]; if (history?.length && !carpetOptions[applying.variant.variantId]) setCarpetOptions({ ...carpetOptions, [applying.variant.variantId]: { supplierQuoteHistory: history } }); setApplying(null); setBrowsing(null); }} />
      </section>
    );
  }
  if (browsing) {
    return (
      <section className="fl-shell" data-testid="flooring-browser" data-flooring-type={browsing.type}>
        <style>{FLOORING_BROWSER_CSS}</style>
        {budgetDock}
        <ProductBrowser type={browsing.type} products={flooringProducts} counts={counts} onType={(type) => setBrowsing({ ...browsing, type })}
          onBack={() => setBrowsing(null)} onSelect={(product, variant) => setApplying({ product, variant, forAreaId: browsing.forAreaId })} />
      </section>
    );
  }
  return (
    <section className="fl-shell" data-testid="flooring-workflow">
      <style>{FLOORING_BROWSER_CSS}</style>
      {budgetDock}
      <header className="fl-header">
        <div>
          {onBack ? <button type="button" className="fl-link" onClick={onBack}>{backLabel}</button> : null}
          <h2>Flooring</h2>
          <p>Choose a flooring colour, apply it to several rooms, and change any room later. Hard flooring uses whole packs. Carpet keeps net floor area and estimated roll-order area separate.</p>
          <p className="fl-count" data-testid="flooring-status"><strong>{status.assigned} of {status.total}</strong> areas have flooring{status.assigned && status.measured < status.assigned ? ` · ${status.assigned - status.measured} still need an area (m²)` : ""}</p>
        </div>
        <div className="fl-actions">
          <button type="button" className="fl-secondary" disabled={saving || !dirty} onClick={save} data-testid="flooring-save">{saving ? "Saving…" : dirty ? "Save" : "Saved"}</button>
        </div>
      </header>

      <section className="fl-block" data-testid="flooring-types">
        <h3>Browse flooring</h3>
        <div className="fl-type-grid">
          {FLOORING_TYPES.map((type) => {
            const count = counts[type.key];
            return (
              <button type="button" key={type.key} className="fl-type" data-testid={`flooring-type-${type.key}`} disabled={!count.products} onClick={() => setBrowsing({ type: type.key })}>
                <strong>{type.label}</strong>
                <span data-testid={`flooring-type-count-${type.key}`}>{count.products ? `${count.products} range${count.products === 1 ? "" : "s"} · ${count.colours} colour${count.colours === 1 ? "" : "s"} available` : "No products in the Product Library yet"}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="fl-block" data-testid="flooring-areas">
        <div className="fl-row-head"><h3>Floor areas</h3><AddArea existingNames={areas.map((area) => area.name)} onAdd={(area) => change([...areas, area])} /></div>
        {!areas.length ? <p className="fl-empty">No floor areas yet. Add the rooms or areas that get flooring.</p> : null}
        <div className="fl-area-list">
          {areas.map((area) => {
            const product = area.productId ? productById(area.productId) : null;
            const variant = flooringVariantFor(product, area.variantId) || area.variantSnapshot || null;
            return (
              <article key={area.id} className={`fl-area ${variant ? "done" : ""}`} data-testid={`flooring-area-${area.id}`} data-area-name={area.name}>
                <label className="fl-field fl-name">Area<input value={area.name} aria-label="Area name" onChange={(event) => updateArea(area.id, { name: event.target.value })} /></label>
                <label className="fl-field">Net area (m²)
                  <input type="number" min="0" step="0.01" value={area.areaM2} aria-label={`${area.name} area m2`} data-testid="flooring-area-m2" onChange={(event) => updateArea(area.id, { areaM2: event.target.value === "" ? "" : Number(event.target.value), areaSource: "manual" })} />
                  {area.areaSource === "takeoff" ? <em>Imported from Takeoff</em> : null}
                </label>
                {(product?.attributes?.flooringType || area.flooringTypeHint) !== "carpet" ? <label className="fl-field fl-narrow">Wastage %<input type="number" min="0" step="1" value={area.wastagePct ?? DEFAULT_FLOORING_WASTAGE_PCT} aria-label={`${area.name} wastage`} onChange={(event) => updateArea(area.id, { wastagePct: event.target.value === "" ? "" : Number(event.target.value) })} /></label> : <span className="fl-muted">Carpet roll order below</span>}
                <div className="fl-choice">
                  {variant ? (
                    <>
                      {variant.imageUrl ? <img src={variant.imageUrl} alt={variant.colour} /> : null}
                      <span><strong data-testid="flooring-area-choice">{product?.range || ""} {variant.colour}</strong><small>{product?.brand || ""} · {variant.sku}</small></span>
                    </>
                  ) : <span className="fl-muted">No flooring chosen</span>}
                </div>
                <div className="fl-actions">
                  <button type="button" className="fl-secondary" data-testid="flooring-area-choose" onClick={() => setBrowsing({ type: product?.attributes?.flooringType || area.flooringTypeHint || FLOORING_TYPES.find((type) => counts[type.key].products)?.key || "hybrid", forAreaId: area.id })}>{variant ? "Change" : "Choose flooring"}</button>
                  {variant ? <button type="button" className="fl-link" onClick={() => change(clearFlooringChoice(areas, area.id))}>Clear</button> : null}
                  <button type="button" className="fl-link fl-danger" onClick={() => change(areas.filter((item) => item.id !== area.id))}>Remove</button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <OrderSummary lines={lines.filter((line) => line.flooringType !== "carpet")} overrides={overrides} estimateAllowanceFor={allowanceFor} onOverride={(typeKey, value) => { setOverrides({ ...overrides, [typeKey]: value }); setDirty(true); }} />
      {lines.filter((line) => line.flooringType === "carpet").map((line) => <CarpetOrder key={line.variantId} line={line} options={carpetOptions[line.variantId]} onChange={(patch) => { setCarpetOptions({ ...carpetOptions, [line.variantId]: { ...carpetOptions[line.variantId], ...patch } }); setDirty(true); }} />)}
    </section>
  );
}

function AddArea({ existingNames = [], onAdd }) {
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [error, setError] = useState("");
  const submit = (event) => {
    event.preventDefault();
    const label = name.trim();
    if (!label) return;
    // One record per location: an area already listed is edited in the list, never added twice.
    if (existingNames.some((existing) => existing.trim().toLowerCase() === label.toLowerCase())) { setError(`${label} is already listed - enter its m² in the list below.`); return; }
    onAdd({ ...newFlooringArea({ name: label }), areaM2: area === "" ? "" : Number(area) });
    setName(""); setArea(""); setError("");
  };
  return (
    <form className="fl-add" onSubmit={submit}>
      <input value={name} placeholder="Area name (e.g. Study)" aria-label="New area name" data-testid="flooring-add-name" onChange={(event) => { setName(event.target.value); setError(""); }} />
      <input type="number" min="0" step="0.01" value={area} placeholder="m²" aria-label="New area m2" data-testid="flooring-add-m2" onChange={(event) => setArea(event.target.value)} />
      <button type="submit" className="fl-primary" data-testid="flooring-add-area">+ Add area</button>
      {error ? <span className="fl-error" role="alert" data-testid="flooring-add-error">{error}</span> : null}
    </form>
  );
}

export function ProductBrowser({ type, products, counts, onType, onBack, onSelect }) {
  const ofType = useMemo(() => products.filter((product) => product.attributes?.flooringType === type && activeFlooringVariants(product).length), [products, type]);
  const [filters, setFilters] = useState({});
  const [details, setDetails] = useState("");
  const [chosen, setChosen] = useState({}); // productId -> variantId
  const facet = (key, read) => unique(ofType.flatMap((product) => [].concat(read(product))));
  const facets = [
    ["brand", "Brand", (product) => product.brand],
    ["supplier", "Supplier", (product) => product.supplier],
    ["collection", "Collection", (product) => product.range || product.attributes?.collection],
    ["width", "Board width", (product) => (product.attributes?.widthMm ? `${product.attributes.widthMm}mm` : "")],
    ["thickness", "Thickness", (product) => (product.attributes?.thicknessMm ? `${product.attributes.thicknessMm}mm` : "")],
    ["installation", "Installation", (product) => activeFlooringVariants(product).flatMap((variant) => variant.installation || [])],
    ["waterproof", "Waterproof", (product) => activeFlooringVariants(product).map((variant) => variant.waterResistance)],
    ...(type === "carpet" ? [
      ["fibre", "Fibre", (p) => p.attributes?.carpetSpecs?.fibre],
      ["style", "Style", (p) => p.attributes?.carpetSpecs?.style],
      ["budget", "Budget", (p) => p.attributes?.carpetSpecs?.budget],
      ["rating", "Residential rating", (p) => p.attributes?.carpetSpecs?.residentialRating],
      ["pet", "Pet friendly", (p) => p.attributes?.carpetSpecs?.petFriendly === true ? "Published pet-friendly rating" : "Not published"],
      ["australian", "Australian made", (p) => p.attributes?.carpetSpecs?.australianMade === true ? "Yes" : "Not published"],
    ] : []),
  ].map(([key, label, read]) => ({ key, label, read, values: facet(key, read) })).filter((entry) => entry.values.length > 1);
  const prices = ofType.map((product) => product.attributes?.fromPricePerM2).filter(Boolean);
  const colourText = String(filters.colour || "").trim().toLowerCase();
  const visible = ofType.filter((product) => facets.every((entry) => !filters[entry.key] || [].concat(entry.read(product)).includes(filters[entry.key]))
    && (!filters.maxPrice || (product.attributes?.fromPricePerM2 && product.attributes.fromPricePerM2 <= Number(filters.maxPrice)))
    && (!colourText || activeFlooringVariants(product).some((variant) => `${variant.colour} ${variant.colourCode || ""} ${variant.colourGroup || ""}`.toLowerCase().includes(colourText))));
  return (
    <>
      <header className="fl-header">
        <div>
          {onBack ? <button type="button" className="fl-link" onClick={onBack}>← Floor areas</button> : null}
          <h2>{FLOORING_TYPES.find((item) => item.key === type)?.label} flooring</h2>
          <p data-testid="flooring-browser-count">{visible.length} of {ofType.length} ranges shown · {visible.reduce((total, product) => total + activeFlooringVariants(product).length, 0)} colours</p>
        </div>
      </header>
      <div className="fl-tabs" role="tablist">
        {FLOORING_TYPES.filter((item) => counts[item.key].products).map((item) => <button type="button" key={item.key} role="tab" aria-selected={item.key === type} className={item.key === type ? "active" : ""} onClick={() => { setFilters({}); onType(item.key); }}>{item.label} ({counts[item.key].products})</button>)}
      </div>
      <div className="fl-filters" data-testid="flooring-filters">
        {facets.map((entry) => (
          <label key={entry.key} className="fl-field">{entry.label}
            <select value={filters[entry.key] || ""} aria-label={entry.label} data-testid={`flooring-filter-${entry.key}`} onChange={(event) => setFilters({ ...filters, [entry.key]: event.target.value })}>
              <option value="">All</option>{entry.values.sort().map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
        ))}
        <label className="fl-field">Colour<input value={filters.colour || ""} placeholder={type === "carpet" ? "Colour name or code" : "e.g. oak, blackbutt"} aria-label="Colour" onChange={(event) => setFilters({ ...filters, colour: event.target.value })} /></label>
        {prices.length > 1 ? (
          <label className="fl-field">Max price /m²
            <select value={filters.maxPrice || ""} aria-label="Max price per m2" data-testid="flooring-filter-price" onChange={(event) => setFilters({ ...filters, maxPrice: event.target.value })}>
              <option value="">Any</option>{unique(prices.map((price) => Math.ceil(price / 10) * 10)).sort((a, b) => a - b).map((price) => <option key={price} value={price}>Up to ${price}</option>)}
            </select>
          </label>
        ) : null}
      </div>
      <div className="fl-card-grid">
        {visible.map((product) => {
          const variants = activeFlooringVariants(product).filter((v) => !colourText || `${v.colour} ${v.colourCode || ""} ${v.colourGroup || ""}`.toLowerCase().includes(colourText));
          const variant = variants.find((item) => item.variantId === chosen[product.productId]) || variants[0];
          if (!variant) return null;
          const pricing = flooringVariantPricing(variant);
          return (
            <article key={product.productId} className="fl-card" data-testid={`flooring-product-${product.productCode}`}>
              {variant.imageUrl ? <img className="fl-card-image" src={variant.imageUrl} alt={`${product.range} ${variant.colour}`} loading="lazy" /> : <div className="fl-card-image fl-noimage">{type === "carpet" ? "Manufacturer image unavailable" : "No supplier image"}</div>}
              <div className="fl-card-body">
                <span className="fl-brand">{product.brand}</span>
                <h4>{product.range}</h4>
                <strong className="fl-colour" data-testid="flooring-card-colour">{variant.colour}{variant.colourCode ? ` · ${variant.colourCode}` : ""}</strong>
                <span>{FLOORING_TYPES.find((item) => item.key === type)?.label} Flooring</span>
                <span>{dims(variant)}</span>
                {type === "carpet" ? <span>{product.attributes?.carpetSpecs?.fibre} · {product.attributes?.carpetSpecs?.style} · {product.attributes?.carpetSpecs?.rollWidthM || "Unpublished"}m roll</span> : <span>Pack coverage: {pricing.packCoverageM2 ? `${pricing.packCoverageM2}m²` : "not published"}</span>}
                <span className="fl-price" data-testid="flooring-card-price">{pricing.regularPricePerM2 ? `${money(pricing.regularPricePerM2)} / m²` : type === "carpet" ? "Supplier quote required" : money(null)}</span>
                {pricing.regularPricePerPack ? <span>{money(pricing.regularPricePerPack)} / pack{pricing.perPackDerived ? " (from m² price × coverage)" : ""}</span> : null}
                {pricing.salePricePerM2 ? <span className="fl-sale">Promotion: {money(pricing.salePricePerM2)} / m² (estimate uses the regular price)</span> : null}
                <div className="fl-swatches" aria-label="Colours">
                  {variants.map((item) => (
                    <button type="button" key={item.variantId} title={item.colour} aria-label={item.colour} aria-pressed={item.variantId === variant.variantId} className={item.variantId === variant.variantId ? "active" : ""} data-testid={`flooring-swatch-${item.sku}`} onClick={() => setChosen({ ...chosen, [product.productId]: item.variantId })}>
                      {item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" /> : <span>{item.colour.slice(0, 2)}</span>}
                    </button>
                  ))}
                </div>
                <span className="fl-muted">{variants.length} colour{variants.length === 1 ? "" : "s"}</span>
                <div className="fl-actions">
                  <button type="button" className="fl-secondary" onClick={() => setDetails(details === product.productId ? "" : product.productId)}>{details === product.productId ? "Hide details" : "View details"}</button>
                  {onSelect ? <button type="button" className="fl-primary" data-testid="flooring-select" onClick={() => onSelect(product, variant)}>Select</button> : null}
                </div>
                {details === product.productId ? <Details product={product} variant={variant} /> : null}
              </div>
            </article>
          );
        })}
      </div>
      {!visible.length ? <p className="fl-empty">No ranges match these filters.</p> : null}
    </>
  );
}

function Details({ product, variant }) {
  if (product.attributes?.flooringType === "carpet") return <CarpetSpecifications product={product} variant={variant} />;
  const rows = [
    ["Supplier", product.supplier], ["SKU", variant.sku], ["Size", dims(variant)], ["Surface finish", variant.surfaceFinish], ["Edge", variant.edge],
    ["Slip rating", variant.slipRating], ["Installation", (variant.installation || []).join(", ")], ["Water resistance", variant.waterResistance], ["Wear layer", variant.wearLayer],
    ["Residential warranty", variant.warranty?.residentialConsumer], ["Commercial warranty", variant.warranty?.nonResidentialBusiness || variant.warranty?.nonResidentialConsumer],
    ["Price checked", variant.priceRetrievedAt ? variant.priceRetrievedAt.slice(0, 10) : ""],
  ].filter(([, value]) => value);
  return (
    <div className="fl-details" data-testid="flooring-details">
      {variant.description ? <p>{variant.description}</p> : null}
      <dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      {variant.productUrl ? <a href={variant.productUrl} target="_blank" rel="noreferrer">View on supplier website</a> : null}
    </div>
  );
}

function ApplyPanel({ areas, productById, product, variant, preselect, onCancel, onApply }) {
  // Nothing is ticked for the builder except the area this choice was opened from.
  const [ids, setIds] = useState(() => new Set(preselect ? [preselect] : []));
  const [wastage, setWastage] = useState("");
  const toggle = (id) => setIds((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const pricing = flooringVariantPricing(variant);
  return (
    <div className="fl-block" data-testid="flooring-apply-panel">
      <h3>Apply {product.range} {variant.colour}</h3>
      <p className="fl-muted">{product.brand} · {variant.sku} · {dims(variant)} · {pricing.regularPricePerM2 ? `${money(pricing.regularPricePerM2)} / m²` : "Price not published"}. Each area keeps its own m² and can be changed on its own later.</p>
      <div className="fl-apply-list">
        {areas.map((area) => {
          const current = area.variantId ? flooringVariantFor(productById(area.productId), area.variantId) || area.variantSnapshot : null;
          return (
            <label key={area.id} className="fl-apply-item">
              <input type="checkbox" checked={ids.has(area.id)} onChange={() => toggle(area.id)} data-testid={`flooring-apply-${area.name}`} />
              <span><strong>{area.name}</strong> {area.areaM2 !== "" && area.areaM2 !== null ? `${Number(area.areaM2).toFixed(2)}m²` : "(area to enter)"}{current ? <small> · currently {current.colour}</small> : null}</span>
            </label>
          );
        })}
      </div>
      {product.attributes?.flooringType === "carpet" ? <p>Selected net area: {areas.filter((area) => ids.has(area.id)).reduce((sum, area) => sum + (Number(area.areaM2) || 0), 0).toFixed(2)}m². Roll cutting quantity is estimated separately.</p> : <label className="fl-field fl-narrow">Wastage % (blank keeps each area&apos;s own)<input type="number" min="0" step="1" value={wastage} onChange={(event) => setWastage(event.target.value)} aria-label="Apply wastage" /></label>}
      <div className="fl-actions">
        <button type="button" className="fl-secondary" onClick={onCancel}>Cancel</button>
        <button type="button" className="fl-primary" disabled={!ids.size} data-testid="flooring-apply-confirm" onClick={() => onApply([...ids], wastage === "" ? undefined : Number(wastage))}>Apply to {ids.size} area{ids.size === 1 ? "" : "s"}</button>
      </div>
    </div>
  );
}

function OrderSummary({ lines, overrides = {}, estimateAllowanceFor = () => ({}), onOverride }) {
  if (!lines.length) return null;
  return (
    <section className="fl-block" data-testid="flooring-order-summary">
      <h3>Flooring order</h3>
      {lines.map((line) => (
        <article key={line.lineId} className="fl-order" data-testid={`flooring-line-${line.sku}`}>
          {line.imageUrl ? <img src={line.imageUrl} alt={line.colour} /> : null}
          <div>
            <h4>{line.supplier} · {line.brand !== line.supplier ? `${line.brand} ` : ""}{line.range} {line.colour}</h4>
            <p className="fl-muted">{line.flooringTypeLabel} · {line.sku} · {line.dimensions}</p>
            <p>Locations: {line.rooms.map((room) => `${room.name} ${room.netAreaM2.toFixed(2)}m²`).join(", ")}</p>
            <label className="fl-field fl-allowance">Material allowance per m² (ex GST) for {line.flooringTypeLabel}
              <input type="number" min="0" step="0.01" value={overrides[line.flooringType] ?? ""} placeholder={String(estimateAllowanceFor(line.flooringType).allowancePerM2ExGst || 0)} aria-label={`${line.flooringTypeLabel} material allowance per m2`} data-testid={`flooring-allowance-${line.flooringType}`} onChange={(event) => onOverride(line.flooringType, event.target.value)} />
              <em>{overrides[line.flooringType] !== undefined && overrides[line.flooringType] !== "" ? "Builder material allowance" : estimateAllowanceFor(line.flooringType).source ? `Estimate rate: ${estimateAllowanceFor(line.flooringType).source} - may include installation; enter the material allowance if so` : "No estimate rate - enter the material allowance"}</em>
            </label>
            <dl className="fl-order-figures">
              <div><dt>Net floor area</dt><dd data-testid="flooring-line-net">{m2(line.netAreaM2)}</dd></div>
              <div><dt>Wastage</dt><dd>{line.wastagePct}%</dd></div>
              <div><dt>Required</dt><dd data-testid="flooring-line-required">{m2(line.requiredAreaM2)}</dd></div>
              <div><dt>Pack coverage</dt><dd>{line.packCoverageM2 ? `${line.packCoverageM2}m²` : "not published"}</dd></div>
              <div><dt>Packs</dt><dd data-testid="flooring-line-packs">{line.packs ?? "—"}</dd></div>
              <div><dt>Purchased coverage</dt><dd data-testid="flooring-line-purchased">{m2(line.purchasedAreaM2)}</dd></div>
              <div><dt>Material cost</dt><dd data-testid="flooring-line-cost">{money(line.materialCost)}</dd></div>
              <div><dt>Allowance</dt><dd title={line.allowanceSource}>{line.allowanceSource ? `${money(line.allowanceTotal)} (${money(line.allowancePerM2)}/m² net)` : "No estimate allowance found"}</dd></div>
              <div><dt>Variation</dt><dd data-testid="flooring-line-variation" className={line.variation > 0 ? "up" : ""}>{line.variation === null ? "Price pending" : `${line.variation > 0 ? "+" : ""}${money(line.variation)}`}</dd></div>
            </dl>
          </div>
        </article>
      ))}
    </section>
  );
}

export const FLOORING_BROWSER_CSS = `
.fl-shell { display: grid; gap: 18px; font-size: 16px; color: #0f172a; }
.fl-shell button, .fl-shell input, .fl-shell select { font-size: 16px; }
.fl-header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; flex-wrap: wrap; border: 1px solid #d7deea; border-radius: 12px; background: #fff; padding: 20px 22px; }
.fl-header h2 { margin: 4px 0; font-size: 28px; font-weight: 900; }
.fl-header p { margin: 0; font-size: 17px; color: #334155; }
.fl-count { margin-top: 8px !important; }
.fl-block { border: 1px solid #d7deea; border-radius: 12px; background: #fff; padding: 20px 22px; display: grid; gap: 14px; }
.fl-block h3 { margin: 0; font-size: 22px; font-weight: 900; }
.fl-row-head { display: flex; justify-content: space-between; gap: 12px; align-items: center; flex-wrap: wrap; }
.fl-actions { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.fl-primary, .fl-secondary { min-height: 46px; padding: 10px 20px; border-radius: 10px; font-weight: 800; cursor: pointer; }
.fl-primary { background: #0f766e; color: #fff; border: 0; }
.fl-secondary { background: #fff; color: #0f172a; border: 1px solid #94a3b8; }
.fl-primary:disabled, .fl-secondary:disabled { opacity: .55; cursor: not-allowed; }
.fl-link { background: none; border: 0; padding: 0; color: #1d4ed8; font-weight: 800; cursor: pointer; }
.fl-danger { color: #b91c1c; }
.fl-muted { color: #475569; margin: 0; }
.fl-empty { border: 1px dashed #94a3b8; border-radius: 12px; padding: 16px; background: #f8fafc; margin: 0; }
.fl-type-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(260px, 100%), 1fr)); gap: 14px; }
.fl-type { display: grid; gap: 6px; text-align: left; padding: 18px; border-radius: 12px; border: 2px solid #d7deea; background: #f8fafc; cursor: pointer; color: #0f172a; }
.fl-type strong { font-size: 22px; font-weight: 900; text-transform: uppercase; }
.fl-type span { font-size: 17px; font-weight: 700; color: #0f766e; }
.fl-type:disabled { cursor: default; opacity: .6; }
.fl-type:disabled span { color: #64748b; }
.fl-area-list { display: grid; gap: 12px; }
.fl-area { display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-end; border: 2px solid #d7deea; border-radius: 12px; padding: 14px 16px; }
.fl-area.done { border-color: #22c55e; }
.fl-field { display: grid; gap: 6px; font-weight: 700; min-width: 150px; }
.fl-field em { font-style: normal; font-weight: 800; color: #0f766e; font-size: 16px; }
.fl-name { min-width: 200px; }
.fl-narrow { min-width: 110px; max-width: 160px; }
.fl-field input, .fl-field select, .fl-add input { min-height: 44px; border: 1px solid #94a3b8; border-radius: 8px; padding: 6px 10px; background: #fff; color: #0f172a; box-sizing: border-box; width: 100%; }
.fl-choice { display: flex; gap: 10px; align-items: center; min-width: 240px; flex: 1; }
.fl-choice img { width: 64px; height: 64px; object-fit: cover; border-radius: 8px; border: 1px solid #d7deea; }
.fl-choice span { display: grid; }
.fl-choice small { font-size: 16px; color: #475569; }
.fl-add { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.fl-error { color: #b91c1c; font-weight: 800; }
.fl-add input:first-child { width: 220px; } .fl-add input:nth-child(2) { width: 110px; }
.fl-tabs { display: flex; gap: 8px; flex-wrap: wrap; }
.fl-shell .fl-tabs button { min-height: 44px; padding: 8px 16px; border-radius: 999px; border: 1px solid #94a3b8; background: #fff; color: #0f172a; font-weight: 800; cursor: pointer; }
.fl-shell .fl-tabs button.active { background: #0f766e; color: #fff; border-color: #0f766e; }
.fl-filters { display: flex; flex-wrap: wrap; gap: 12px; border: 1px solid #d7deea; border-radius: 12px; background: #fff; padding: 16px; }
.fl-card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(340px, 100%), 1fr)); gap: 18px; }
.fl-card { border: 1px solid #d7deea; border-radius: 14px; background: #fff; overflow: hidden; display: grid; align-content: start; }
.fl-card-image { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; background: #f1f5f9; }
.fl-noimage { display: grid; place-items: center; color: #64748b; font-weight: 700; }
.fl-card-body { display: grid; gap: 4px; padding: 16px 18px 18px; font-size: 17px; }
.fl-card-body h4 { margin: 0; font-size: 22px; font-weight: 900; }
.fl-brand { font-weight: 800; color: #0f766e; text-transform: uppercase; }
.fl-colour { font-size: 20px; }
.fl-price { font-size: 24px; font-weight: 900; margin-top: 6px; }
.fl-sale { color: #b45309; font-weight: 800; }
.fl-swatches { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.fl-swatches button { width: 44px; height: 44px; padding: 0; border-radius: 8px; border: 2px solid #d7deea; overflow: hidden; cursor: pointer; background: #f8fafc; }
.fl-swatches button.active { border-color: #0f766e; box-shadow: 0 0 0 2px #99f6e4; }
.fl-swatches img { width: 100%; height: 100%; object-fit: cover; }
.fl-details { display: grid; gap: 8px; border-top: 1px solid #e2e8f0; padding-top: 10px; margin-top: 8px; }
.fl-details p { margin: 0; color: #334155; }
.fl-details dl, .fl-order-figures { display: grid; gap: 6px; margin: 0; }
.fl-details dl div, .fl-order-figures div { display: flex; justify-content: space-between; gap: 12px; border-bottom: 1px solid #eef2f7; padding-bottom: 4px; }
.fl-details dt, .fl-order-figures dt { font-weight: 700; color: #334155; }
.fl-details dd, .fl-order-figures dd { margin: 0; font-weight: 800; text-align: right; }
.fl-apply-list { display: grid; gap: 8px; }
.fl-apply-item { display: flex; gap: 10px; align-items: center; min-height: 44px; border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 12px; }
.fl-apply-item input { width: 22px; height: 22px; }
.fl-apply-item small { font-size: 16px; color: #475569; }
.fl-order { display: grid; grid-template-columns: 120px minmax(0, 1fr); gap: 16px; border-top: 1px solid #e2e8f0; padding-top: 14px; }
.fl-order img { width: 120px; height: 120px; object-fit: cover; border-radius: 10px; }
.fl-order h4 { margin: 0; font-size: 20px; font-weight: 900; }
.fl-order p { margin: 4px 0; }
.fl-order-figures dd.up { color: #b45309; }
.fl-allowance { max-width: 520px; margin: 8px 0; }
`;
