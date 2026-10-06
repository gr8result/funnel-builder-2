import { useState } from "react";
import { appendCarpetQuote, validateCarpetQuote } from "../../lib/builders/carpetSelection.js";

const money = (n) => n == null ? "Not available" : new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);
const FIELDS = [["materialPerM2ExGst", "Material /m²"], ["underlayPerM2ExGst", "Underlay /m²"], ["installationPerM2ExGst", "Installation /m²"], ["otherExGst", "Other installation costs"]];

export default function CarpetOrder({ line, options = {}, onChange }) {
  const [quote, setQuote] = useState({ supplier: "", quoteDate: "", reference: "", materialPerM2ExGst: "", underlayPerM2ExGst: "", installationPerM2ExGst: "", otherExGst: "" });
  const [error, setError] = useState("");
  const recordQuote = () => {
    const problem = validateCarpetQuote(quote);
    if (problem) { setError(problem); return; }
    const history = appendCarpetQuote(options.supplierQuoteHistory || [], quote);
    onChange({ supplierQuoteHistory: history, selectedQuoteId: history[history.length - 1].id });
    setError("");
  };
  return <article className="fl-block" data-testid={`carpet-order-${line.sku}`}>
    <h3>{line.brand} · {line.range} · {line.colour} ({line.colourCode})</h3>
    <p>{line.fibre} · Roll width {line.rollWidthM ? `${line.rollWidthM}m` : "not published"}</p>
    <p>{line.rooms.map((r) => `${r.name} ${r.netAreaM2.toFixed(2)}m²`).join(" · ")}</p>
    <strong data-testid="carpet-net-area">Net floor area: {line.netAreaM2.toFixed(2)}m²</strong>
    <label className="fl-field">Estimated order area (m²)
      <input type="number" min={line.netAreaM2} step="0.01" value={options.estimatedOrderAreaM2 ?? ""} placeholder="Awaiting cutting plan" data-testid="carpet-order-area" onChange={(e) => onChange({ estimatedOrderAreaM2: e.target.value, orderNetAreaM2: line.netAreaM2 })} />
    </label>
    {options.estimatedOrderAreaM2 !== undefined && options.estimatedOrderAreaM2 !== "" && Number(options.estimatedOrderAreaM2) < line.netAreaM2 ? <p className="fl-error">The order area cannot be smaller than the net floor area.</p> : null}
    <p className="fl-muted">{line.orderQuantityStatus}. Roll width, direction, seams and cuts must be checked before ordering. Material uses the order area; underlay and installation use net area.</p>
    <label className="fl-field">Cutting / direction notes<input value={options.cuttingNotes || ""} onChange={(e) => onChange({ cuttingNotes: e.target.value })} /></label>
    <details open><summary><strong>Internal estimate — ex GST</strong></summary>
      <p>{line.estimateRates.source || "Enter the project's estimating allowances."}</p>
      {line.estimateRates.combinedAllowancePerM2ExGst != null ? <p>Existing combined allowance: {money(line.estimateRates.combinedAllowancePerM2ExGst)}/m². Enter a component breakdown below to replace it for this selection.</p> : null}
      <div className="fl-filters">{FIELDS.map(([field, label]) => <label className="fl-field" key={field}>{label}<input type="number" min="0" step="0.01" aria-label={`Internal ${label}`} value={options.estimate?.[field] ?? ""} placeholder={line.estimateRates[field] == null ? "Not set" : String(line.estimateRates[field])} onChange={(e) => onChange({ estimate: { ...options.estimate, [field]: e.target.value } })} /></label>)}</div>
      <p data-testid="carpet-internal-estimate">Internal estimate: {money(line.internalEstimateExGst)} ex GST{line.estimatedOrderAreaM2 == null ? " (provisional material allowance on net area; cutting waste not calculated)" : ""}</p>
      {!line.internalEstimateComplete ? <p>Estimate incomplete: some cost components have not been set.</p> : null}
    </details>
    <details><summary><strong>Retailer quotes and price history</strong></summary>
      <p>Record an actual retailer quote. Rates below are ex GST. Enter 0 for costs included or not required.</p>
      <div className="fl-filters">
        <label className="fl-field">Supplier / retailer<input aria-label="Carpet retailer" value={quote.supplier} onChange={(e) => setQuote({ ...quote, supplier: e.target.value })} /></label>
        <label className="fl-field">Quote date<input type="date" aria-label="Carpet quote date" value={quote.quoteDate} onChange={(e) => setQuote({ ...quote, quoteDate: e.target.value })} /></label>
        <label className="fl-field">Quote reference<input value={quote.reference} onChange={(e) => setQuote({ ...quote, reference: e.target.value })} /></label>
        {FIELDS.map(([field, label]) => <label className="fl-field" key={field}>{label}<input type="number" min="0" step="0.01" aria-label={`Quoted ${label}`} value={quote[field]} onChange={(e) => setQuote({ ...quote, [field]: e.target.value })} /></label>)}
      </div>
      {error ? <p role="alert" className="fl-error">{error}</p> : null}
      <button type="button" className="fl-secondary" data-testid="carpet-record-quote" onClick={recordQuote}>Record quote</button>
      <label className="fl-field">Quote used for this selection<select aria-label="Carpet selected quote" value={options.selectedQuoteId || ""} onChange={(e) => onChange({ selectedQuoteId: e.target.value })}>
        <option value="">Supplier quote required</option>
        {(options.supplierQuoteHistory || []).map((q) => <option key={q.id} value={q.id}>{q.supplier} · {q.quoteDate} · {money(q.materialPerM2ExGst)}/m² material{q.reference ? ` · ${q.reference}` : ""}</option>)}
      </select></label>
      <p>{(options.supplierQuoteHistory || []).length} quote(s) retained for this colour. Save flooring to retain this quote in the project and Product Library price history.</p>
    </details>
    <dl className="fl-order-figures">
      <div><dt>Supplier</dt><dd>{line.supplier || "Supplier quote required"}</dd></div>
      <div><dt>Selected cost, inc GST</dt><dd data-testid="carpet-selected-cost">{line.selectedCost === null ? "Awaiting retailer quote / order quantity" : money(line.selectedCost)}</dd></div>
      <div><dt>Variation, inc GST</dt><dd data-testid="carpet-variation">{line.variation === null ? "Pending quote, order quantity and allowance" : money(line.variation)}</dd></div>
    </dl>
  </article>;
}

export function CarpetSpecifications({ product, variant }) {
  const s = product.attributes?.carpetSpecs || {};
  const entries = [["Manufacturer", product.manufacturer], ["Brand", product.brand], ["Colour code", variant.colourCode], ["Fibre", s.fibre], ["Yarn", s.yarn], ["Style", s.style], ["Construction", s.construction], ["Roll width", s.rollWidthPublished ? `${s.rollWidthPublished}m` : null], ["Total thickness (mm)", s.totalThicknessMm], ["Pile height (mm)", s.pileHeightMm], ["Gauge", s.gauge], ["Pattern repeat", s.patternRepeat], ["Residential rating", s.residentialRating], ["Commercial rating", s.commercialRating], ["Warranty", s.warranty], ["Australian made", s.australianMade === true ? "Yes" : null], ["Stain resistance", s.stainResistance], ["Pet suitability", s.petSuitability], ...Object.entries(s.sustainability || {}), ["Last checked", variant.checkedAt?.slice(0, 10)]];
  return <div className="fl-details" data-testid="carpet-specifications">
    <p>{product.description}</p>
    <dl>{entries.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "Not published"}</dd></div>)}</dl>
    <a href={product.officialProductUrl || variant.productUrl} target="_blank" rel="noreferrer">Manufacturer product page</a>
    {s.specificationUrl ? <a href={s.specificationUrl} target="_blank" rel="noreferrer">Manufacturer specification sheet</a> : null}
    <p>Supplier quote required. The manufacturer does not publish Australian retailer prices.</p>
  </div>;
}
