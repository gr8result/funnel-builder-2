// Custom bulkhead paint colour (Client Selections > Cabinetry > Colours & Finishes, 18 Nov 2026).
// A normal colour choice from the Dulux colour library: search, pick a swatch, choose a sheen. No
// pricing or quotation wording is shown to the client - the builder prices a custom paint finish in
// the Quotation Builder. Saves the same fields as before (paintBrand / paintColourName /
// paintColourCode / paintSheen), so existing records, the quotation and the PDF read it unchanged.
// Readable text is never below 16px.
import { useMemo, useState } from "react";
import { readableOn, searchColours } from "../../lib/builders/duluxColourLibrary.js";

const SHEENS = ["Matt", "Low Sheen", "Semi Gloss", "Gloss"];
const SHOWN = 24;

export default function BulkheadPaintColourPicker({ value = {}, onChange }) {
  const [search, setSearch] = useState("");
  const colours = useMemo(() => searchColours(search, "popular").slice(0, SHOWN), [search]);
  const chosen = value.paintColourName ? { name: value.paintColourName, code: value.paintColourCode, brand: value.paintBrand } : null;
  return (
    <div className="bulkheadPaintPicker" data-testid="cabinetry-bulkhead-custom-paint-fields">
      <style>{CSS}</style>
      <div className="bulkheadPaintChosen" data-testid="cabinetry-bulkhead-paint-chosen">
        <strong>Paint colour</strong>
        <span>{chosen ? [chosen.brand, chosen.name, chosen.code].filter(Boolean).join(" · ") : "Choose a colour below"}</span>
      </div>
      <div className="bulkheadPaintControls">
        <label><span>Search Dulux colours</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Colour name or code" data-testid="cabinetry-bulkhead-paint-search" /></label>
        <label><span>Sheen</span><select value={value.paintSheen || ""} onChange={(event) => onChange({ paintSheen: event.target.value })} data-testid="cabinetry-bulkhead-paint-sheen"><option value="">Choose…</option>{SHEENS.map((sheen) => <option key={sheen}>{sheen}</option>)}</select></label>
      </div>
      <div className="bulkheadPaintGrid" role="listbox" aria-label="Dulux colours">
        {colours.map((colour) => {
          const selected = value.paintColourName === colour.name && (value.paintColourCode || "") === (colour.code || "");
          return (
            <button key={colour.id} type="button" role="option" aria-selected={selected} className={selected ? "selected" : ""} onClick={() => onChange({ paintBrand: colour.manufacturer || "Dulux", paintRange: colour.collection || "", paintColourName: colour.name, paintColourCode: colour.code || "" })} data-testid="cabinetry-bulkhead-paint-swatch" data-colour={colour.name}>
              <span className="swatch" style={{ background: colour.hex || "#ffffff", color: readableOn(colour.hex || "#ffffff") }}>{selected ? "✓" : ""}</span>
              <strong>{colour.name}</strong>
              <small>{colour.code}</small>
            </button>
          );
        })}
        {!colours.length ? <p>No Dulux colour matches “{search}”.</p> : null}
      </div>
    </div>
  );
}

const CSS = `
.bulkheadPaintPicker { display: grid; gap: 14px; border-top: 1px solid #e2e8f0; padding-top: 14px; font-size: 16px; }
.bulkheadPaintChosen { display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: baseline; }
.bulkheadPaintChosen strong { font-size: 18px; font-weight: 900; color: #071827; }
.bulkheadPaintChosen span { color: #0f172a; font-weight: 700; }
.bulkheadPaintControls { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
.bulkheadPaintControls label { display: grid; gap: 6px; font-weight: 800; color: #334155; }
.bulkheadPaintControls input, .bulkheadPaintControls select { min-height: 44px; font-size: 16px; border: 1px solid #94a3b8; border-radius: 8px; padding: 8px 10px; }
.bulkheadPaintGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; }
.bulkheadPaintGrid button { display: grid; gap: 4px; text-align: left; padding: 8px; border: 2px solid #d7deea; border-radius: 8px; background: #fff; cursor: pointer; font-size: 16px; }
.bulkheadPaintGrid button.selected { border-color: #0f766e; box-shadow: inset 0 0 0 2px #0f766e; }
.bulkheadPaintGrid .swatch { display: grid; place-items: center; height: 56px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 22px; font-weight: 900; }
.bulkheadPaintGrid strong { font-size: 16px; font-weight: 800; color: #071827; }
.bulkheadPaintGrid small { font-size: 16px; color: #475569; }
`;
