// "Review / Sync Windows": the windows / glass sliding doors / flyscreens price list is applied to a job's
// quotation only when the builder asks (never on open). The preview lists exactly what applying it would
// add, remove or change, so the builder sees it before confirming.
import { withWindowsPriceListQuotation } from "./windowsQuotePriceList.js";

const POSITION_FIELDS = new Set(["sortOrder", "sortSection", "sortSectionId"]);
const label = (section, row) => `${section}: ${row.item || row.id}`;

function rowsBySection(quotation = {}) {
  const map = new Map();
  for (const [section, group] of Object.entries(quotation || {})) {
    for (const row of group?.rows || []) map.set(`${section}\u0000${row.id}`, { section, row });
  }
  return map;
}

export function windowsPriceListSyncPreview(quotation = {}) {
  const next = withWindowsPriceListQuotation(quotation);
  if (next === quotation) return { changed: false, added: [], removed: [], updated: [], removedSections: [], quotation };
  const before = rowsBySection(quotation), after = rowsBySection(next);
  const added = [], removed = [], updated = [];
  for (const [key, { section, row }] of after) {
    const old = before.get(key);
    if (!old) { added.push(label(section, row)); continue; }
    const fields = [...new Set([...Object.keys(old.row), ...Object.keys(row)])]
      .filter((field) => !POSITION_FIELDS.has(field) && JSON.stringify(old.row[field]) !== JSON.stringify(row[field]));
    if (fields.length) updated.push(`${label(section, row)} (${fields.join(", ")})`);
  }
  for (const [key, { section, row }] of before) if (!after.has(key)) removed.push(label(section, row));
  const removedSections = Object.keys(quotation || {}).filter((name) => !(name in next));
  const changed = Boolean(added.length || removed.length || updated.length || removedSections.length);
  return { changed, added, removed, updated, removedSections, quotation: changed ? next : quotation };
}

// One-paragraph confirmation text for the builder.
export function windowsSyncSummary(preview, limit = 8) {
  if (preview?.contractLocked) {
    const pending = preview.changed ? ` The price list would change ${preview.added.length + preview.updated.length + preview.removed.length} row(s).` : "";
    return `This job is under contract${preview.contractLockedAt ? ` (locked ${String(preview.contractLockedAt).slice(0, 10)})` : ""}, so the contracted quotation is not changed.${pending} Price changes after contract go through a variation.`;
  }
  if (!preview?.changed) return "The windows price list is already up to date in this quotation.";
  const list = (title, items) => (items.length ? `${title} (${items.length}):\n${items.slice(0, limit).map((item) => `  - ${item}`).join("\n")}${items.length > limit ? `\n  ... and ${items.length - limit} more` : ""}` : "");
  return [
    "Apply the current windows / flyscreens price list to this quotation?",
    list("Rows added", preview.added),
    list("Rows changed", preview.updated),
    list("Rows removed", preview.removed),
    list("Sections removed", preview.removedSections),
    "Nothing else in the quotation is changed.",
  ].filter(Boolean).join("\n\n");
}
