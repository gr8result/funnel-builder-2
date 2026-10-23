// Client Selections -> Quotation Builder for the Exterior Colour schedule. Painting quantities and rates belong to
// AI Takeoff / Job Setup and the estimator, so the schedule is linked as a colour specification on the existing
// painter rows (like the internal paint link). Areas with no matching painter row, and factory-finish areas
// (COLORBOND roof, gutters, downpipes), are reported instead of being given an invented row.

import { resolveTradeSection } from "./quotationTradeSections.js";

const text = (value) => String(value ?? "").trim();

// Painter row patterns per colour area; a builder can replace these through workbook.exteriorPaintRowRules.
export const DEFAULT_EXTERIOR_PAINT_RULES = Object.freeze([
  { rows: /^exterior cladding/i, areas: (area) => ["walls", "cladding"].includes(text(area.areaGroup).toLowerCase()) },
  { rows: /^eaves\b/i, areas: (area) => /eaves|soffit|fascia/i.test(text(area.areaName)) },
  { rows: /^patio ceilings/i, areas: (area) => /external ceilings?|patio/i.test(text(area.areaName)) },
  { rows: /^decking/i, areas: (area) => /deck/i.test(text(area.areaName)) },
]);
const FACTORY_FINISH = /colorbond (steel|roofing)/i;

export function exteriorColourAreas(book = {}) {
  const guided = (book.rooms || []).flatMap((room) => room.rows || []).find((row) => row?.guidedSelection?.requirementKey === "exterior-paint")?.guidedSelection;
  return { confirmed: guided?.status === "confirmed" || guided?.configurationComplete === true, areas: (guided?.clientColourSchedule || []).filter((area) => area?.areaId) };
}

export function linkExteriorPaintToQuotation(workbook = {}, book = {}) {
  const { confirmed, areas } = exteriorColourAreas(book);
  const quotation = workbook.quotation || {};
  const hadSpec = Object.values(quotation).some((section) => (section.rows || []).some((row) => row.exteriorColourSpecification));
  if (!areas.length && !hadSpec) return workbook;
  const trade = resolveTradeSection({ workbook, identity: { requirementKey: "exterior-paint" } });
  if (trade.status !== "FOUND") return areas.length ? { ...workbook, exteriorPaintSyncReport: { status: "TRADE_SECTION_UNRESOLVED", trade: trade.trade, detail: trade.reason || "More than one section fits" } } : workbook;
  const rules = workbook.exteriorPaintRowRules?.length ? workbook.exteriorPaintRowRules : DEFAULT_EXTERIOR_PAINT_RULES;
  const claimed = new Set();
  let changed = false;
  const section = quotation[trade.section];
  const rows = (section.rows || []).map((row) => {
    const matching = areas.filter((area) => rules.some((rule) => rule.rows.test(text(row.item)) && rule.areas(area)));
    matching.forEach((area) => claimed.add(area.areaId));
    const next = matching.length ? {
      confirmed,
      areas: matching.map((area) => ({ areaId: area.areaId, label: text(area.areaName), substrate: text(area.material), supplier: text(area.supplier), colour: text(area.colourName), colourCode: text(area.colourCode) })),
      text: matching.map((area) => `${text(area.areaName)}: ${text(area.supplier)} ${text(area.colourName)}`.replace(/\s+/g, " ")).join("; "),
    } : null;
    const previous = row.exteriorColourSpecification ?? null;
    if (JSON.stringify(previous) === JSON.stringify(next)) return row;
    changed = true;
    const { exteriorColourSpecification, ...rest } = row;
    const ownsText = !text(row.selectionSpec) || (previous && row.selectionSpec === previous.text);
    if (ownsText) { if (next) rest.selectionSpec = next.text; else delete rest.selectionSpec; }
    return next ? { ...rest, exteriorColourSpecification: next } : rest;
  });
  const unlinked = areas.filter((area) => !claimed.has(area.areaId)).map((area) => ({ areaId: area.areaId, label: text(area.areaName), reason: FACTORY_FINISH.test(text(area.material)) ? "FACTORY_FINISH_NOT_PAINTED" : "NO_PAINTER_ROW_FOR_AREA" }));
  const report = { status: "SYNCED", section: trade.section, linked: [...claimed], unlinked };
  const reportChanged = JSON.stringify(workbook.exteriorPaintSyncReport) !== JSON.stringify(report);
  if (!changed && !reportChanged) return workbook;
  return { ...workbook, ...(changed ? { quotation: { ...quotation, [trade.section]: { ...section, rows } } } : {}), exteriorPaintSyncReport: report };
}
