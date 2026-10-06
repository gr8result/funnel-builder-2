// Builder setting: Supplier -> Supplier Price Group -> GR8 quotation range, for benchtop surfaces.
// Set once per builder; every product in a supplier's price group then inherits its quotation
// range, so Client Selections never asks for it. Nothing is pre-filled: an unmapped group stays
// "Not set" until the builder decides (lib/builders/benchtopRangeMapping.js).
// Readable text is never below 16px.
import { useEffect, useMemo, useState } from "react";
import { BENCHTOP_RANGES } from "../../lib/construction-estimation/cabinetryRequirements.js";

export default function BenchtopPriceGroupSettings({ groups = [], mapping = { groups: {} }, onSave, onClose }) {
  const saved = useMemo(() => Object.fromEntries(groups.map((group) => [group.key, mapping.groups?.[group.key]?.rangeKey || ""])), [groups, mapping]);
  const [draft, setDraft] = useState(saved);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const suppliers = [...new Set(groups.map((group) => group.supplier))];
  const changed = groups.filter((group) => (draft[group.key] || "") !== (saved[group.key] || ""));
  const unmapped = groups.filter((group) => !draft[group.key]).length;
  function save() {
    try {
      onSave?.(Object.fromEntries(changed.map((group) => [group.key, draft[group.key] || ""])));
      setMessage(`${changed.length} price group${changed.length === 1 ? "" : "s"} saved. Benchtops already selected from ${changed.length === 1 ? "it" : "them"} follow.`);
    } catch (error) { setMessage(error?.message || "The mapping could not be saved."); }
  }
  return (
    <div className="bpg-overlay" role="dialog" aria-modal="true" aria-label="Supplier price groups" data-testid="benchtop-price-group-settings" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
      <style>{PRICE_GROUP_CSS}</style>
      <div className="bpg-modal">
        <div className="bpg-head">
          <div>
            <h3>Supplier price groups</h3>
            <p>Builder setting. Choose which quotation range each supplier price group is priced on. Every benchtop surface in that group then uses it automatically, on every job.</p>
          </div>
          <button type="button" className="bpg-close" onClick={onClose} aria-label="Close" data-testid="price-groups-close">×</button>
        </div>
        <p className="bpg-status" data-testid="price-groups-status">{unmapped ? `${unmapped} of ${groups.length} price groups are not set. A surface from a group that is not set is not priced in the quotation until it is.` : `All ${groups.length} price groups are set.`}</p>
        {suppliers.map((supplier) => (
          <section key={supplier} className="bpg-supplier" data-testid="price-group-supplier" data-supplier={supplier}>
            <h4>{supplier}</h4>
            <table>
              <thead><tr><th>Supplier price group</th><th>Surfaces</th><th>Quotation range</th></tr></thead>
              <tbody>
                {groups.filter((group) => group.supplier === supplier).map((group) => (
                  <tr key={group.key} data-testid="price-group" data-group-key={group.key} data-group={group.label}>
                    <td><strong>{group.label}</strong><span>{group.examples.join(", ")}{group.products > group.examples.length ? ", …" : ""}</span></td>
                    <td>{group.products}</td>
                    <td>
                      <select value={draft[group.key] || ""} onChange={(event) => { setDraft({ ...draft, [group.key]: event.target.value }); setMessage(""); }} aria-label={`Quotation range for ${supplier} ${group.label}`} data-testid="price-group-range">
                        <option value="">Not set</option>
                        {BENCHTOP_RANGES.map((range) => <option key={range.key} value={range.key}>{range.label}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
        <div className="bpg-actions">
          {message ? <span className="bpg-message" role="status" data-testid="price-groups-message">{message}</span> : null}
          <button type="button" className="bpg-secondary" onClick={onClose}>Close</button>
          <button type="button" className="bpg-primary" disabled={!changed.length} onClick={save} data-testid="price-groups-save">Save price groups</button>
        </div>
      </div>
    </div>
  );
}

const PRICE_GROUP_CSS = `
.bpg-overlay { position: fixed; inset: 0; z-index: 1200; background: rgba(15, 23, 42, .55); display: grid; place-items: start center; padding: 4vh 16px; overflow-y: auto; }
.bpg-modal { width: min(980px, 100%); background: #fff; border-radius: 16px; padding: 22px 24px 24px; display: grid; gap: 16px; font-size: 16px; color: #0f172a; }
.bpg-modal h3, .bpg-modal h4, .bpg-modal p { margin: 0; }
.bpg-modal button, .bpg-modal select { font-size: 16px; font-family: inherit; }
.bpg-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
.bpg-head h3 { font-size: 24px; font-weight: 900; } .bpg-head p { color: #334155; margin-top: 4px; max-width: 70ch; }
.bpg-modal .bpg-close { width: 44px; height: 44px; flex: 0 0 auto; border-radius: 10px; border: 1px solid #94a3b8; background: #fff; color: #0f172a; font-size: 26px; line-height: 1; cursor: pointer; }
.bpg-status { background: #fffbeb; border: 1px solid #fcd34d; color: #78350f; border-radius: 10px; padding: 10px 14px; font-weight: 600; }
.bpg-supplier { display: grid; gap: 8px; } .bpg-supplier h4 { font-size: 20px; font-weight: 900; }
.bpg-supplier table { width: 100%; border-collapse: collapse; }
.bpg-supplier th, .bpg-supplier td { text-align: left; padding: 10px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
.bpg-supplier th { font-weight: 700; color: #475569; }
.bpg-supplier td strong { display: block; font-size: 17px; } .bpg-supplier td span { color: #64748b; }
.bpg-supplier td select { min-height: 46px; min-width: 260px; }
.bpg-actions { display: flex; justify-content: flex-end; align-items: center; gap: 12px; flex-wrap: wrap; }
.bpg-message { color: #166534; font-weight: 700; margin-right: auto; }
.bpg-primary, .bpg-secondary { min-height: 46px; padding: 10px 20px; border-radius: 10px; font-weight: 800; cursor: pointer; }
.bpg-primary { background: #0f766e; color: #fff; border: 0; } .bpg-primary:disabled { background: #94a3b8; cursor: default; }
.bpg-secondary { background: #fff; color: #0f172a; border: 1px solid #94a3b8; }
`;
