// Generic "which project locations does this apply to" control for Client Selections.
//
// Locations are always passed in from the project (lib/builders/projectLocations.js, filtered to
// the rooms relevant to the selection) - this control lists nothing of its own. It works on stable
// location ids/keys, supports several ticks at once (or exactly one with multiple={false}), Select
// All / Clear, a collapsed "other project locations" list, and an optional builder-typed location.
//
//   locations / otherLocations: [{ id, key, label, source?, requiredQuantity? }]
//   value: selected location keys            onChange(keys, selectedLocations)
//   renderRow(location): extra content shown under a ticked location (e.g. its dimensions)
import { useState } from "react";

// Inline styles: the control is used inside several modals and must look the same in each.
const button = { minHeight: 36, border: "1px solid #cbd5e1", borderRadius: 8, background: "#ffffff", color: "#0f172a", padding: "0 12px", fontSize: 16, fontWeight: 850, cursor: "pointer" };
const STYLES = {
  root: { margin: 0, padding: 0, border: 0, display: "grid", gap: 8, minWidth: 0 },
  legend: { padding: 0, marginBottom: 6, fontSize: 16, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".04em", color: "#475569" },
  list: { display: "grid", gap: 6 },
  compact: { maxHeight: 320, overflow: "auto", paddingRight: 4 },
  other: { borderTop: "1px dashed #cbd5e1", paddingTop: 8 },
  row: { border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 10px", display: "grid", gap: 8, background: "#ffffff" },
  rowChecked: { borderColor: "#16a34a", background: "#f0fdf4" },
  label: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 17, fontWeight: 850, color: "#0f172a" },
  check: { width: 20, height: 20, margin: 0, accentColor: "#16a34a", flex: "none" },
  hint: { fontSize: 16, fontWeight: 700, color: "#64748b" },
  bar: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontSize: 16, color: "#0f172a" },
  count: { marginRight: "auto" },
  button,
  custom: { display: "flex", flexWrap: "wrap", gap: 6 },
  input: { flex: 1, minWidth: 180, height: 36, border: "1px solid #cbd5e1", borderRadius: 8, background: "#ffffff", color: "#0f172a", padding: "0 10px", fontSize: 16 },
  error: { flexBasis: "100%", color: "#b91c1c", fontSize: 16, fontWeight: 800 },
  empty: { margin: 0, fontSize: 16, color: "#b45309" },
};

const slugKey = (value = "") => String(value).trim().toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export default function ProjectLocationMultiSelect({
  label = "Room / location",
  locations = [],
  otherLocations = [],
  value = [],
  onChange,
  multiple = true,
  allowCustom = true,
  describe = null,
  renderRow = null,
  emptyText = "This project has no matching rooms yet. Add the rooms in Job Setup / AI Plan Takeoff, or type a location below.",
  isInvalidName = null,
  testId = "project-location-multiselect",
}) {
  const [showOther, setShowOther] = useState(false);
  const [custom, setCustom] = useState([]);
  const [customName, setCustomName] = useState("");
  const [customError, setCustomError] = useState("");
  const selected = new Set(value);
  const known = [...locations, ...otherLocations, ...custom];
  const emit = (keys) => onChange?.(keys, keys.map((key) => known.find((location) => location.key === key)).filter(Boolean));
  const toggle = (location) => {
    if (!multiple) return emit(selected.has(location.key) ? [] : [location.key]);
    emit(selected.has(location.key) ? value.filter((key) => key !== location.key) : [...value, location.key]);
  };
  const addCustom = () => {
    const name = customName.trim();
    const key = slugKey(name);
    if (!name || !key) return;
    if (isInvalidName?.(name)) { setCustomError(`"${name}" is a selection category, not a project location.`); return; }
    const existing = known.find((location) => location.key === key);
    const location = existing || { id: `location-${key}`, key, label: name, source: "custom" };
    if (!existing) setCustom((current) => [...current, location]);
    setCustomName("");
    setCustomError("");
    const keys = multiple ? Array.from(new Set([...value, key])) : [key];
    onChange?.(keys, keys.map((item) => (item === key ? location : known.find((entry) => entry.key === item))).filter(Boolean));
  };
  const visible = [...locations, ...custom, ...otherLocations.filter((location) => selected.has(location.key))].filter((location, index, all) => all.findIndex((item) => item.key === location.key) === index);
  const hiddenOther = otherLocations.filter((location) => !visible.some((item) => item.key === location.key));
  const row = (location) => {
    const checked = selected.has(location.key);
    return (
      <div key={location.key} style={{ ...STYLES.row, ...(checked ? STYLES.rowChecked : {}) }} data-testid={`${testId}-row`} data-location-key={location.key} data-location-id={location.id}>
        <label style={STYLES.label}>
          <input style={STYLES.check} type={multiple ? "checkbox" : "radio"} checked={checked} onChange={() => toggle(location)} data-testid={`${testId}-option-${location.key}`} />
          <span>{location.label}</span>
          {describe?.(location) ? <small style={STYLES.hint}>{describe(location)}</small> : null}
        </label>
        {checked && renderRow ? <div>{renderRow(location)}</div> : null}
      </div>
    );
  };
  return (
    <fieldset style={STYLES.root} data-testid={testId}>
      <legend style={STYLES.legend}>{label}</legend>
      {visible.length ? <div style={{ ...STYLES.list, ...(visible.length > 8 ? STYLES.compact : {}) }}>{visible.map(row)}</div> : <p style={STYLES.empty}>{emptyText}</p>}
      {showOther ? <div style={{ ...STYLES.list, ...STYLES.other }}>{hiddenOther.map(row)}</div> : null}
      <div style={STYLES.bar}>
        <strong style={STYLES.count} data-testid={`${testId}-count`}>{value.length} location{value.length === 1 ? "" : "s"} selected</strong>
        {multiple && visible.length > 1 ? <button type="button" style={STYLES.button} data-testid={`${testId}-select-all`} onClick={() => emit(Array.from(new Set([...value, ...visible.map((location) => location.key)])))}>Select All</button> : null}
        {value.length ? <button type="button" style={STYLES.button} data-testid={`${testId}-clear`} onClick={() => emit([])}>Clear</button> : null}
        {hiddenOther.length ? <button type="button" style={STYLES.button} data-testid={`${testId}-other`} onClick={() => setShowOther((open) => !open)}>{showOther ? "Hide other project locations" : `Other project locations (${hiddenOther.length})`}</button> : null}
      </div>
      {allowCustom ? (
        <div style={STYLES.custom}>
          <input style={STYLES.input} value={customName} placeholder="Add a project location, e.g. Ensuite 2" onChange={(event) => setCustomName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCustom(); } }} data-testid={`${testId}-custom`} />
          <button type="button" style={STYLES.button} onClick={addCustom}>Add location</button>
          {customError ? <small role="alert" style={STYLES.error}>{customError}</small> : null}
        </div>
      ) : null}
    </fieldset>
  );
}
