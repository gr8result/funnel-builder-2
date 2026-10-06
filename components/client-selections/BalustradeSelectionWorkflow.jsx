// Client Selections -> Balustrades.
// Systems come from the canonical Product Library (balustrade system records). A selection is a
// configured system x LM per location, priced at the system's indicative estimating rate per LM
// and compared with the project's balustrade allowance per LM (from the Project Estimate).
import { Fragment, useMemo, useState } from "react";
import { getEffectiveProductCatalogue } from "../../lib/product-library/catalogueService.js";
import { csPx } from "../../lib/builders/clientSelectionsTypography.js";
import {
  BALUSTRADE_FILTERS,
  BALUSTRADE_LOCATIONS,
  BALUSTRADE_UNIT,
  balustradeAllowanceForSystem,
  balustradeFilterOptions,
  balustradeLine,
  balustradeRate,
  balustradeSystems,
  defaultBalustradeConfiguration,
  filterBalustradeSystems,
  projectBalustradeEstimate,
  validateBalustradeConfiguration,
} from "../../lib/builders/balustradeSelection.js";
import {
  plumbingAllocationSummary,
  plumbingLinesFromSelection,
  plumbingLocationKey,
  removePlumbingLine,
  upsertPlumbingLine,
} from "../../lib/builders/plumbingFixtureAllocation.js";

const money = (value) => (value === null || value === undefined ? "—" : `$${Math.round(Number(value)).toLocaleString("en-AU")}`);
const signedPerLm = (value) => (value === null || value === undefined ? "—" : `${value > 0 ? "+" : value < 0 ? "−" : ""}$${Math.abs(Math.round(value)).toLocaleString("en-AU")} / LM`);
const lm = (value) => `${Math.round(Number(value || 0) * 100) / 100} LM`;
const attributesOf = (product) => product?.attributes || {};
const TIMBER_LABELS = { species: "Timber species / material", postSize: "Post size", handrailProfile: "Handrail profile", balusterProfile: "Baluster profile", balusterSpacing: "Baluster spacing", finish: "Timber finish", use: "Use" };

export default function BalustradeSelectionWorkflow({ requirement, organisationId = "", selection = null, workbook = {}, budgetDock = null, backLabel = "← Back", onBack, onSave }) {
  const systems = useMemo(() => balustradeSystems(getEffectiveProductCatalogue({ organisationId }).products), [organisationId]);
  const estimate = useMemo(() => projectBalustradeEstimate(workbook), [workbook]);
  const options = useMemo(() => balustradeFilterOptions(systems), [systems]);
  const [filters, setFilters] = useState({});
  const [details, setDetails] = useState(null);
  const [configuring, setConfiguring] = useState(null);
  const visible = filterBalustradeSystems(systems, filters);
  const lines = plumbingLinesFromSelection(selection?.selected_details || null).filter((line) => line.unit === BALUSTRADE_UNIT);
  const summary = plumbingAllocationSummary(lines);

  const save = (nextLines) => onSave?.(nextLines);

  return (
    <section className="balShell" data-testid="guided-balustrade-workflow">
      {budgetDock}
      <header className="balHeader">
        <div>
          {onBack ? <button type="button" className="balBack" onClick={onBack}>{backLabel}</button> : null}
          <span>{requirement?.areaLabel || "Exterior"} / Balustrades</span>
          <strong>{systems.length} balustrade systems · priced per lineal metre</strong>
          <p>Select a system, configure it, then enter the lineal metres for each location. Rates are indicative estimating allowances (supply and install, inc GST) until a supplier quotation replaces them at procurement.</p>
        </div>
        <div className="balTotals">
          <Total label="Selected LM" value={lm(summary.quantity)} />
          <Total label="Allowance" value={money(summary.allowanceTotal)} />
          <Total label="Selection value" value={money(summary.selectedTotal)} />
          <Total label={summary.variation < 0 ? "Credit" : "Variation"} value={summary.variation === null ? "—" : `${summary.variation > 0 ? "+" : ""}${money(summary.variation)}`} tone={summary.variation > 0 ? "bad" : summary.variation < 0 ? "good" : ""} />
        </div>
      </header>

      <div className="balQuantitySource" data-testid="balustrade-quantity-source">
        {estimate.totalLm > 0
          ? <span><strong>Project Estimate:</strong> {lm(estimate.totalLm)} of balustrade ({estimate.lmLines.filter((line) => line.quantity > 0).map((line) => `${line.item} ${lm(line.quantity)}`).join("; ")}).</span>
          : <span><strong>No balustrade LM in the Project Estimate yet.</strong> Enter measured LM for each location when you select a system.</span>}
      </div>

      {lines.length ? (
        <div className="balSelected" data-testid="balustrade-selected-lines">
          <h3>Selected balustrades</h3>
          <table>
            <thead><tr><th>System</th><th>Configuration</th><th>Locations</th><th>LM</th><th>Rate</th><th>Value</th><th /></tr></thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.lineId} data-testid="balustrade-selected-line">
                  <td><strong>{line.productName}</strong><small>{line.brand}</small></td>
                  <td>{line.configurationSummary || line.finish}</td>
                  <td>{line.allocations.map((allocation) => `${allocation.location} ${lm(allocation.quantity)}`).join(", ")}</td>
                  <td>{lm(line.quantity)}</td>
                  <td>{money(line.unitPrice)} / LM<small>Indicative rate</small></td>
                  <td>{money(line.selectedTotal)}</td>
                  <td className="balRowActions">
                    <button type="button" onClick={() => { const product = systems.find((item) => item.productCode === line.productCode); if (product) setConfiguring({ product, line }); }}>Edit</button>
                    <button type="button" onClick={() => save(removePlumbingLine(lines, line.lineId))}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="balFilters" data-testid="balustrade-filters">
        {BALUSTRADE_FILTERS.map(({ key, label }) => (
          <label key={key}>
            <span>{label}</span>
            <select value={filters[key] || ""} onChange={(event) => setFilters((current) => ({ ...current, [key]: event.target.value }))} data-testid={`balustrade-filter-${key}`}>
              <option value="">All</option>
              {(options[key] || []).map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
        ))}
        {Object.values(filters).some(Boolean) ? <button type="button" className="balClear" onClick={() => setFilters({})}>Clear filters</button> : null}
        <em>{visible.length} of {systems.length} systems</em>
      </div>

      <div className="balGrid" data-testid="balustrade-system-grid">
        {visible.map((product) => {
          const attributes = attributesOf(product);
          const rate = balustradeRate(product);
          const allowance = balustradeAllowanceForSystem(product, estimate);
          const variation = allowance.allowancePerLm > 0 && rate !== null ? rate - allowance.allowancePerLm : null;
          const selectedLm = lines.filter((line) => line.productCode === product.productCode).reduce((total, line) => total + line.quantity, 0);
          return (
            <article key={product.productCode} className={`balCard ${selectedLm ? "selected" : ""}`} data-testid="balustrade-system-card" data-product-code={product.productCode}>
              <div className="balImage">
                <img src={product.primaryImageUrl} alt={product.productName} loading="lazy" />
                {selectedLm ? <span className="balBadge">✓ Selected — {lm(selectedLm)}</span> : null}
              </div>
              <div className="balBody">
                <span className="balType">{attributes.systemType}</span>
                <strong>{product.productName}</strong>
                <small>{attributes.referenceSystem?.brand ? `${attributes.referenceSystem.brand} — ${attributes.referenceSystem.name}` : product.brand}</small>
                <dl>
                  <dt>Suitable for</dt><dd>{(attributes.applications || []).join(" / ")}</dd>
                  <dt>Mounting</dt><dd>{(attributes.mountingOptions || []).join(" / ")}</dd>
                  <dt>Finish</dt><dd>{(attributes.finishOptions || []).slice(0, 3).join(" / ")}</dd>
                </dl>
                <div className="balMoney">
                  <Total label="Indicative rate" value={rate === null ? "—" : `${money(rate)} / LM`} />
                  <Total label="Allowance" value={allowance.allowancePerLm > 0 ? `${money(allowance.allowancePerLm)} / LM` : "Not set"} />
                  <Total label="Variation" value={signedPerLm(variation)} tone={variation > 0 ? "bad" : variation < 0 ? "good" : ""} />
                </div>
              </div>
              <div className="balActions">
                <button type="button" onClick={() => setDetails(product)}>View Details</button>
                <button type="button" className="primary" onClick={() => setConfiguring({ product, line: null })} data-testid="balustrade-select">{selectedLm ? "Add / Edit" : "Select"}</button>
              </div>
            </article>
          );
        })}
      </div>

      {details ? <BalustradeDetails product={details} onClose={() => setDetails(null)} /> : null}
      {configuring ? (
        <BalustradeConfigurator
          product={configuring.product}
          line={configuring.line}
          estimate={estimate}
          onCancel={() => setConfiguring(null)}
          onSave={(nextLine, replacedLineId) => {
            const base = replacedLineId && replacedLineId !== nextLine.lineId ? removePlumbingLine(lines, replacedLineId) : lines;
            save(upsertPlumbingLine(base, nextLine));
            setConfiguring(null);
          }}
        />
      ) : null}

      <style jsx>{`
        .balShell { display: grid; gap: 18px; font-size: ${csPx("body")}; }
        .balHeader { display: flex; justify-content: space-between; gap: 18px; flex-wrap: wrap; background: #fff; border: 1px solid #dbe3ee; border-radius: 16px; padding: 20px 22px; }
        .balHeader span { display: block; color: #52627a; font-size: ${csPx("label")}; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 6px; }
        .balHeader strong { display: block; font-size: ${csPx("pageTitle")}; color: #102033; margin: 4px 0; }
        .balHeader p { margin: 0; color: #52627a; max-width: 720px; line-height: 1.5; }
        .balBack { border: 1px solid #cdd7e4; background: #f5f8fc; border-radius: 999px; padding: 10px 18px; font-size: ${csPx("button")}; cursor: pointer; font-weight: 600; }
        .balTotals, .balMoney { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; align-self: end; }
        .balMoney { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
        .balQuantitySource { background: #f1f6fd; border: 1px solid #cfe0f5; border-radius: 12px; padding: 12px 16px; color: #1c3553; }
        .balSelected { background: #fff; border: 1px solid #dbe3ee; border-radius: 16px; padding: 16px 20px; overflow-x: auto; }
        .balSelected h3 { margin: 0 0 10px; font-size: ${csPx("cardTitle")}; }
        .balSelected table { width: 100%; border-collapse: collapse; font-size: ${csPx("body")}; }
        .balSelected th, .balSelected td { text-align: left; padding: 8px; border-top: 1px solid #edf1f6; vertical-align: top; }
        .balSelected small { display: block; color: #52627a; font-size: ${csPx("body")}; }
        .balRowActions { white-space: nowrap; }
        .balRowActions button { margin-right: 6px; border: 1px solid #cdd7e4; background: #fff; border-radius: 8px; padding: 8px 14px; font-size: ${csPx("button")}; cursor: pointer; }
        .balFilters { display: flex; flex-wrap: wrap; gap: 12px; align-items: end; background: #fff; border: 1px solid #dbe3ee; border-radius: 16px; padding: 14px 18px; }
        .balFilters label { display: grid; gap: 6px; font-size: ${csPx("label")}; font-weight: 700; color: #52627a; text-transform: uppercase; letter-spacing: 0.05em; }
        .balFilters select { min-width: 190px; padding: 10px 12px; border: 1px solid #cdd7e4; border-radius: 10px; font-size: ${csPx("body")}; text-transform: none; }
        .balFilters em { margin-left: auto; color: #52627a; }
        .balClear { border: 0; background: none; color: #0b62d6; cursor: pointer; font-weight: 600; font-size: ${csPx("button")}; }
        .balGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; align-items: stretch; }
        .balCard { display: flex; flex-direction: column; background: #fff; border: 1px solid #dbe3ee; border-radius: 18px; overflow: hidden; box-shadow: 0 8px 22px rgba(15, 35, 60, 0.06); }
        .balCard.selected { border-color: #1f8a4c; box-shadow: 0 0 0 2px rgba(31, 138, 76, 0.25); }
        .balImage { position: relative; width: 100%; aspect-ratio: 4 / 3; background: #eef2f7; }
        .balImage img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
        .balBadge { position: absolute; left: 12px; top: 12px; background: #1f8a4c; color: #fff; font-weight: 700; font-size: ${csPx("label")}; padding: 5px 10px; border-radius: 999px; }
        .balBody { display: flex; flex-direction: column; gap: 6px; padding: 16px 18px 10px; flex: 1; }
        .balType { color: #0b62d6; font-weight: 800; font-size: ${csPx("label")}; text-transform: uppercase; letter-spacing: 0.06em; }
        .balBody strong { font-size: ${csPx("productName")}; color: #102033; line-height: 1.3; }
        .balBody small { color: #52627a; font-size: ${csPx("body")}; }
        .balBody dl { display: grid; grid-template-columns: 118px 1fr; gap: 6px 12px; margin: 8px 0; font-size: ${csPx("body")}; }
        .balBody dt { color: #6b7a90; font-weight: 600; }
        .balBody dd { margin: 0; color: #1c2b3d; }
        .balMoney { margin-top: auto; }
        .balActions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 12px 18px 18px; }
        .balActions button { min-height: 48px; padding: 12px 14px; font-size: ${csPx("button")}; border-radius: 10px; border: 1px solid #cdd7e4; background: #fff; font-weight: 700; cursor: pointer; }
        .balActions button.primary { background: #0b62d6; border-color: #0b62d6; color: #fff; }
        @media (max-width: 900px) { .balTotals { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      `}</style>
    </section>
  );
}

function Total({ label, value, tone = "" }) {
  return (
    <div className={`balTotal ${tone}`}>
      <span>{label}</span>
      <b>{value}</b>
      <style jsx>{`
        .balTotal { background: #f7f9fc; border: 1px solid #e3e9f1; border-radius: 10px; padding: 8px 10px; min-width: 0; }
        .balTotal span { display: block; font-size: ${csPx("label")}; color: #6b7a90; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 700; }
        .balTotal b { display: block; font-size: ${csPx("price")}; color: #102033; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .balTotal.bad b { color: #b42318; }
        .balTotal.good b { color: #1f8a4c; }
      `}</style>
    </div>
  );
}

function BalustradeDetails({ product, onClose }) {
  const attributes = attributesOf(product);
  const rate = attributes.estimatingRate || {};
  return (
    <div className="balModalBackdrop" role="dialog" aria-modal="true" aria-label={`${product.productName} details`} onMouseDown={onClose}>
      <div className="balModal" onMouseDown={(event) => event.stopPropagation()} data-testid="balustrade-details">
        <img src={product.primaryImageUrl} alt={product.productName} />
        <h2>{product.productName}</h2>
        <p>{product.description}</p>
        {attributes.referenceSystem ? <p><strong>Reference system:</strong> <a href={attributes.referenceSystem.url} target="_blank" rel="noreferrer">{attributes.referenceSystem.brand} — {attributes.referenceSystem.name}</a></p> : null}
        <dl>
          <dt>Material</dt><dd>{attributes.material}{attributes.glassSystem ? ` · ${attributes.glassSystem}` : ""}</dd>
          <dt>Mounting</dt><dd>{(attributes.mountingOptions || []).join(" / ")}</dd>
          <dt>Suitable for</dt><dd>{(attributes.applications || []).join(" / ")}</dd>
          <dt>Finishes</dt><dd>{(attributes.finishOptions || []).join(" / ")}</dd>
          {(attributes.glassOptions || []).length ? <Fragment><dt>Glass</dt><dd>{attributes.glassOptions.join(" / ")}</dd></Fragment> : null}
          {Object.entries(attributes.timberOptions || {}).map(([key, values]) => <Fragment key={key}><dt>{TIMBER_LABELS[key] || key}</dt><dd>{(values || []).join(" / ")}</dd></Fragment>)}
        </dl>
        <h3>Indicative estimating rate: ${rate.ratePerLm} / LM</h3>
        <p className="balNote">{rate.label}. {rate.note}</p>
        <table>
          <thead><tr><th>Evidence</th><th>Published range</th><th>Applies to</th></tr></thead>
          <tbody>{(rate.evidence || []).map((item, index) => <tr key={index}><td><a href={item.url} target="_blank" rel="noreferrer">{item.source}</a></td><td>{item.range}</td><td>{item.appliesTo}</td></tr>)}</tbody>
        </table>
        <p className="balNote">{attributes.compliance}</p>
        {(attributes.notes || []).map((note) => <p key={note} className="balNote">{note}</p>)}
        <button type="button" onClick={onClose}>Close</button>
      </div>
      <ModalStyles />
    </div>
  );
}

function BalustradeConfigurator({ product, line = null, estimate, onCancel, onSave }) {
  const attributes = attributesOf(product);
  const rate = balustradeRate(product);
  const allowance = balustradeAllowanceForSystem(product, estimate);
  const [configuration, setConfiguration] = useState(() => line?.configuration || defaultBalustradeConfiguration(product));
  const suggested = attributes.applications || [];
  const initialLocations = Array.from(new Set([...suggested, ...BALUSTRADE_LOCATIONS, ...(line?.allocations || []).map((allocation) => allocation.location)]));
  const [locations, setLocations] = useState(initialLocations);
  const [quantities, setQuantities] = useState(() => Object.fromEntries((line?.allocations || []).map((allocation) => [allocation.location, String(allocation.quantity)])));
  const [customName, setCustomName] = useState("");
  const [error, setError] = useState("");
  const allocations = locations
    .map((location) => ({ location, locationKey: plumbingLocationKey(location), quantity: Number(quantities[location] || 0) }))
    .filter((allocation) => allocation.quantity > 0);
  const draft = balustradeLine(product, { configuration, allocations, allowancePerLm: allowance.allowancePerLm, allowanceSource: allowance.source, quantitySource: estimate.totalLm > 0 ? "Project Estimate / measured" : "Measured (manual)" });
  const setOption = (key, value) => setConfiguration((current) => ({ ...current, [key]: value }));
  const setTimber = (key, value) => setConfiguration((current) => ({ ...current, timber: { ...(current.timber || {}), [key]: value } }));
  const useEstimate = () => {
    const target = suggested[0] || locations[0];
    setQuantities((current) => ({ ...current, [target]: String(estimate.totalLm) }));
  };
  const save = () => {
    const errors = validateBalustradeConfiguration(product, configuration);
    if (errors.length) { setError(errors.join(" ")); return; }
    if (!draft.quantity) { setError("Enter the lineal metres for at least one location."); return; }
    onSave(draft, line?.lineId || "");
  };
  return (
    <div className="balModalBackdrop" role="dialog" aria-modal="true" aria-label={`Configure ${product.productName}`} onMouseDown={onCancel}>
      <div className="balModal wide" onMouseDown={(event) => event.stopPropagation()} data-testid="balustrade-configurator">
        <div className="balConfigHead">
          <img src={product.primaryImageUrl} alt={product.productName} />
          <div>
            <span className="balTypeLabel">{attributes.systemType}</span>
            <h2>{product.productName}</h2>
            <p>Indicative rate {money(rate)} / LM · Allowance {allowance.allowancePerLm > 0 ? `${money(allowance.allowancePerLm)} / LM (${allowance.source})` : "not set in the Project Estimate"}</p>
          </div>
        </div>
        <div className="balConfigGrid">
          <Choice label="Mounting" value={configuration.mounting} values={attributes.mountingOptions} onChange={(value) => setOption("mounting", value)} testId="balustrade-config-mounting" />
          <Choice label="Finish / hardware" value={configuration.finish} values={attributes.finishOptions} onChange={(value) => setOption("finish", value)} testId="balustrade-config-finish" />
          {(attributes.glassOptions || []).length ? <Choice label="Glass" value={configuration.glass} values={attributes.glassOptions} onChange={(value) => setOption("glass", value)} testId="balustrade-config-glass" /> : null}
          {Object.entries(attributes.timberOptions || {}).map(([key, values]) => (
            <Choice key={key} label={TIMBER_LABELS[key] || key} value={configuration.timber?.[key] || ""} values={values} onChange={(value) => setTimber(key, value)} testId={`balustrade-config-timber-${key}`} />
          ))}
        </div>
        <h3>Lineal metres by location</h3>
        {estimate.totalLm > 0 ? <button type="button" className="balLink" onClick={useEstimate} data-testid="balustrade-use-estimate">Use Project Estimate quantity ({lm(estimate.totalLm)})</button> : <p className="balNote">No balustrade LM in the Project Estimate - enter measured LM.</p>}
        <div className="balLocations">
          {locations.map((location) => (
            <label key={location} className={suggested.includes(location) ? "suggested" : ""}>
              <span>{location}{suggested.includes(location) ? "" : " (not a typical use)"}</span>
              <input type="number" min="0" step="0.1" inputMode="decimal" value={quantities[location] || ""} placeholder="0.0" onChange={(event) => setQuantities((current) => ({ ...current, [location]: event.target.value }))} data-testid={`balustrade-lm-${plumbingLocationKey(location)}`} />
              <em>LM</em>
            </label>
          ))}
        </div>
        <div className="balAddLocation">
          <input value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder="Other location (e.g. Rear balcony)" />
          <button type="button" onClick={() => { const name = customName.trim(); if (name && !locations.includes(name)) setLocations((current) => [...current, name]); setCustomName(""); }}>Add location</button>
        </div>
        <div className="balConfigTotals" data-testid="balustrade-config-totals">
          <Total label="Total LM" value={lm(draft.quantity)} />
          <Total label="Rate × LM" value={draft.selectedTotal === null ? "—" : money(draft.selectedTotal)} />
          <Total label="Allowance × LM" value={money(draft.allowanceTotal)} />
          <Total label="Variation" value={draft.variation === null ? "—" : `${draft.variation > 0 ? "+" : ""}${money(draft.variation)}`} tone={draft.variation > 0 ? "bad" : draft.variation < 0 ? "good" : ""} />
        </div>
        {error ? <p className="balError" role="alert">{error}</p> : null}
        <div className="balModalActions">
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="button" className="primary" onClick={save} data-testid="balustrade-save">Save balustrade</button>
        </div>
      </div>
      <ModalStyles />
    </div>
  );
}

function Choice({ label, value, values = [], onChange, testId }) {
  return (
    <label className="balChoice">
      <span>{label}</span>
      <select value={value || ""} onChange={(event) => onChange(event.target.value)} data-testid={testId}>
        {values.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      <style jsx>{`
        .balChoice { display: grid; gap: 6px; font-size: ${csPx("label")}; font-weight: 700; color: #52627a; text-transform: uppercase; letter-spacing: 0.04em; }
        .balChoice select { padding: 10px 12px; border: 1px solid #cdd7e4; border-radius: 10px; font-size: ${csPx("body")}; text-transform: none; font-weight: 500; color: #102033; }
      `}</style>
    </label>
  );
}

function ModalStyles() {
  return (
    <style jsx global>{`
      .balModalBackdrop { position: fixed; inset: 0; background: rgba(10, 20, 35, 0.55); display: flex; align-items: flex-start; justify-content: center; padding: 40px 16px; z-index: 2000; overflow-y: auto; }
      .balModal { background: #fff; border-radius: 18px; padding: 28px; font-size: ${csPx("body")}; width: min(760px, 100%); display: grid; gap: 12px; }
      .balModal.wide { width: min(980px, 100%); }
      .balModal > img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 12px; }
      .balModal h2 { margin: 0; color: #102033; font-size: ${csPx("pageTitle")}; }
      .balModal h3 { margin: 6px 0 0; color: #102033; font-size: ${csPx("cardTitle")}; }
      .balModal dl { display: grid; grid-template-columns: 170px 1fr; gap: 6px 12px; margin: 0; }
      .balModal dt { color: #6b7a90; font-weight: 700; }
      .balModal dd { margin: 0; }
      .balModal table { width: 100%; border-collapse: collapse; font-size: ${csPx("body")}; }
      .balModal th, .balModal td { text-align: left; border-top: 1px solid #edf1f6; padding: 6px; vertical-align: top; }
      .balModal button { justify-self: end; min-height: 48px; padding: 12px 18px; font-size: ${csPx("button")}; border-radius: 10px; border: 1px solid #cdd7e4; background: #fff; font-weight: 700; cursor: pointer; }
      .balModal button.primary { background: #0b62d6; border-color: #0b62d6; color: #fff; }
      .balNote { color: #52627a; font-size: ${csPx("body")}; margin: 0; }
      .balConfigHead { display: grid; grid-template-columns: 220px 1fr; gap: 18px; align-items: center; }
      .balConfigHead img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 12px; }
      .balTypeLabel { color: #0b62d6; font-weight: 800; font-size: ${csPx("label")}; text-transform: uppercase; letter-spacing: 0.06em; }
      .balConfigGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
      .balLocations { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 10px; }
      .balLocations label { display: grid; grid-template-columns: 1fr 120px 28px; align-items: center; gap: 8px; border: 1px solid #e3e9f1; border-radius: 10px; padding: 10px 12px; font-size: ${csPx("body")}; }
      .balLocations label.suggested { background: #f5f9ff; border-color: #cfe0f5; }
      .balLocations input { padding: 9px 10px; border: 1px solid #cdd7e4; border-radius: 8px; font-size: ${csPx("body")}; }
      .balAddLocation { display: flex; gap: 10px; }
      .balAddLocation input { flex: 1; padding: 10px 12px; border: 1px solid #cdd7e4; border-radius: 10px; font-size: ${csPx("body")}; }
      .balAddLocation button { justify-self: auto; }
      .balConfigTotals { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
      .balModalActions { display: flex; justify-content: flex-end; gap: 10px; }
      .balLink { justify-self: start !important; border: 0 !important; background: none !important; color: #0b62d6; padding: 0 !important; }
      .balError { color: #b42318; font-weight: 600; margin: 0; }
    `}</style>
  );
}
