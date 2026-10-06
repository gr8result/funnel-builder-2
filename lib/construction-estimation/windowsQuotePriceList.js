// Section 53 WINDOWS price list: every window / glass sliding door / flyscreen line from the
// supplied price list (catalogues/data/windowsQuotePriceList.csv -> .json, built by
// scripts/build-windows-quote-price-list.mjs) is a real quote row in the WINDOWS section, and its
// Qty is linked to the canonical AI Plan Takeoff Window Schedule (createJobSetupWindowSchedule)
// through the ordinary quantityKey mechanism - the same way every other takeoff-linked quote row
// gets its quantity. Typing a Qty overrides it (quantityManualOverride); clearing it goes back to
// the takeoff count.
import priceList from "./catalogues/data/windowsQuotePriceList.json";
import { createJobSetupWindowSchedule } from "../../components/construction-estimation/ai-plan-takeoff/takeoffSchedule.js";
import { OPENING_STYLE_TO_CATALOGUE_PRODUCT_TYPE } from "./catalogues/windowDoorScreenCatalogue.js";

export const WINDOWS_PRICE_LIST_QTY_PREFIX = "windowPriceList:";
const LEGACY_SYNC_SOURCE = "ai-plan-takeoff-window-schedule";

function slug(text) {
  return String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function money(value) {
  return `$${Number(value || 0).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function sizeKey(productType, heightMm, widthMm) {
  return `${productType}|${heightMm}x${widthMm}`;
}
export function windowPriceListQuantityKey(kind, productType, heightMm, widthMm) {
  return `${WINDOWS_PRICE_LIST_QTY_PREFIX}${kind}|${sizeKey(productType, heightMm, widthMm)}`;
}

function headingRow(heading) {
  return {
    id: `quote-windows-list-heading-${slug(heading)}`,
    item: heading,
    quantity: "",
    importedQuantity: "",
    quantityKey: "",
    unit: "",
    excelRate: "",
    manualRate: "",
    sourceOfRate: "",
    windowPriceListRow: true,
    windowPriceListHeading: true,
    active: true,
    formulas: {},
  };
}

function priceRow(kind, entry) {
  return {
    id: `quote-windows-list-${kind}-${slug(entry.productType)}-${entry.heightMm}x${entry.widthMm}`,
    item: `${entry.code} ${entry.productType} - ${entry.sizeDescription}`,
    quantity: "",
    importedQuantity: "",
    quantityKey: windowPriceListQuantityKey(kind, kind === "flyscreen" ? entry.forProductType : entry.productType, entry.heightMm, entry.widthMm),
    unit: entry.unit || "EACH",
    excelRate: money(entry.price),
    manualRate: "",
    sourceOfRate: "windows price list",
    windowPriceListRow: true,
    windowCode: entry.code,
    windowType: entry.productType,
    heightMm: entry.heightMm,
    widthMm: entry.widthMm,
    active: true,
    formulas: {},
  };
}

// The price list rows in Section 53 order: WINDOW SCHEDULE (every window type), GLASS SLIDING
// DOORS, FLYSCREENS - each list under its own heading row.
let cachedRows = null;
export function windowsPriceListQuoteRows() {
  if (cachedRows) return cachedRows;
  const isDoor = (entry) => entry.productType.startsWith("Glass Sliding Door");
  cachedRows = [
    headingRow("WINDOW SCHEDULE"),
    ...priceList.windows.filter((entry) => !isDoor(entry)).map((entry) => priceRow("window", entry)),
    headingRow("GLASS SLIDING DOORS"),
    ...priceList.windows.filter(isDoor).map((entry) => priceRow("window", entry)),
    headingRow("FLYSCREENS"),
    ...priceList.flyscreens.map((entry) => priceRow("flyscreen", entry)),
  ];
  return cachedRows;
}

// Fields an estimator edits on a quote row - kept from the saved row when the price list rows are
// re-applied, so their quantity overrides, rate overrides and notes survive every load.
export const WINDOWS_QUOTE_EDITABLE_FIELDS = ["quantity", "quantityManualOverride", "manualRate", "supplierQuote", "notes", "active", "lineType", "quoteRequired", "selectionAdjustment", "selectionReference", "selectionNotes"];

export function isWindowsSectionName(name) {
  return String(name || "").replace(/\s*\(\d+\)\s*$/, "").trim().toLowerCase() === "windows";
}

// The template's placeholder rows the price list replaces: "WINDOWS QUOTE" (row 750) and the
// flyscreen quote/allowance row (row 753).
function isObsoleteWindowsPlaceholderRow(row = {}) {
  const sourceRow = Number(row.sourceRow || row.excelRow || 0);
  const item = String(row.item || "").trim().toUpperCase();
  return sourceRow === 750 || sourceRow === 753 || item === "WINDOWS QUOTE" || item === "FLYSCREEN QUOTE" || item.startsWith("FLYSCREENS - ALLOWANCE");
}

// Puts the price list into the job's existing WINDOWS section (e.g. "WINDOWS (46)"), keeping every
// other row the estimator has there. Rows from the earlier "Import/Sync Windows from Takeoff"
// button and the obsolete placeholder rows are removed - the price list rows replace them.
export function withWindowsPriceListQuotation(quotation = {}) {
  if (!quotation || typeof quotation !== "object") return quotation;
  const sectionName = Object.keys(quotation).find(isWindowsSectionName) || "WINDOWS";
  const section = quotation[sectionName] || { rows: [] };
  const savedRows = Array.isArray(section.rows) ? section.rows : [];
  const savedById = new Map(savedRows.map((row) => [row.id, row]));
  const listRows = windowsPriceListQuoteRows().map((row) => {
    const saved = savedById.get(row.id);
    const kept = saved ? Object.fromEntries(WINDOWS_QUOTE_EDITABLE_FIELDS.filter((key) => saved[key] !== undefined).map((key) => [key, saved[key]])) : {};
    return { ...row, ...kept, section: sectionName };
  });
  const otherRows = savedRows.filter((row) => !row.windowPriceListRow && row.source !== LEGACY_SYNC_SOURCE && !isObsoleteWindowsPlaceholderRow(row));
  const nextRows = [...otherRows, ...listRows];
  const unchanged = nextRows.length === savedRows.length && nextRows.every((row, index) => {
    const saved = savedRows[index];
    return saved && saved.id === row.id && saved.quantityKey === row.quantityKey && saved.excelRate === row.excelRate && saved.item === row.item && saved.section === row.section;
  });
  if (unchanged) return quotation;
  const next = { ...quotation, [sectionName]: { ...section, rows: nextRows } };
  // Sections the earlier sync button created beside WINDOWS - their rows are now in the list.
  Object.keys(next).forEach((name) => {
    const rows = next[name]?.rows || [];
    if (name === sectionName || !rows.length || !rows.every((row) => row.source === LEGACY_SYNC_SOURCE)) return;
    delete next[name];
  });
  return next;
}

function takeoffJobOf(workbook = {}) {
  const canonical = workbook?.aiPlanTakeoffJob;
  if (canonical && typeof canonical === "object") return canonical;
  const compatibility = workbook?.takeoffEngine?.aiPlanTakeoffJob;
  return compatibility && typeof compatibility === "object" ? compatibility : null;
}

const scheduleCache = new WeakMap();

const WINDOW_QTY_PREFIX = `${WINDOWS_PRICE_LIST_QTY_PREFIX}window|`;
const FLYSCREEN_QTY_PREFIX = `${WINDOWS_PRICE_LIST_QTY_PREFIX}flyscreen|`;
export const WINDOW_SCHEDULE_UNPRICED_ROW_PREFIX = "quote-windows-unpriced-";
const UNPRICED_HEADING = "WINDOW SCHEDULE ITEMS REQUIRING A RATE";
const UNPRICED_KIND_LABEL = { window: "", flyscreen: " Flyscreen", "security-screen": " Security Screen" };

// The takeoff's opening style -> price list product type. Exact label first; then the same label
// with case, spacing and a trailing "window" ignored, the price list's own product type names, and
// the raw Window Type codes - so "fixed glass", "FG" or "Awning" still reach their list.
const PRODUCT_TYPE_ALIASES = (() => {
  const norm = (text) => String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\bwindow\b/g, "").replace(/\s+/g, " ").trim();
  const map = new Map();
  Object.entries(OPENING_STYLE_TO_CATALOGUE_PRODUCT_TYPE).forEach(([style, target]) => {
    map.set(norm(style), target.productType);
    map.set(norm(target.productType), target.productType);
  });
  Object.entries({ standard: "Sliding Window", aw: "Awning", dh: "Double Hung", lvr: "Louvre", fg: "Fixed Glass", fixed: "Fixed Glass", ca: "Casement", gsd: "Glass Sliding Door - Single Opening Panel", slidingglass: "Glass Sliding Door - Single Opening Panel", stacker: "Glass Sliding Door - Stacker" })
    .forEach(([alias, productType]) => { if (!map.has(alias)) map.set(alias, productType); });
  return { norm, map };
})();
function priceListProductType(style) {
  return OPENING_STYLE_TO_CATALOGUE_PRODUCT_TYPE[style]?.productType || PRODUCT_TYPE_ALIASES.map.get(PRODUCT_TYPE_ALIASES.norm(style)) || "";
}

// A Window Schedule item with no price list row still gets a Section 53 line: its real type and
// size, the takeoff Qty, no rate, flagged as requiring a price. Never persisted as a price - the
// estimator's own edits (rate, notes, Qty override) are kept on a saved row with the same id.
function unpricedRow(kind, group) {
  const typeLabel = `${group.typeLabel}${UNPRICED_KIND_LABEL[kind] || ""}`;
  const size = `${group.heightMm || "?"}H x ${group.widthMm || "?"}W`;
  const source = `Window Schedule: ${group.itemIds.join(", ")}${group.locations.length ? ` (${group.locations.join(", ")})` : ""}`;
  return {
    id: `${WINDOW_SCHEDULE_UNPRICED_ROW_PREFIX}${kind}-${slug(group.typeLabel)}-${group.heightMm || 0}x${group.widthMm || 0}`,
    item: `${group.code ? `${group.code} ` : ""}${typeLabel} - ${size}`,
    quantity: "",
    importedQuantity: "",
    quantityKey: windowPriceListQuantityKey(kind, `CUSTOM_${group.typeLabel}`, group.heightMm || 0, group.widthMm || 0),
    unit: "EACH",
    excelRate: "",
    manualRate: "",
    sourceOfRate: "rate missing",
    quoteRequired: true,
    selectionSpec: `${source} - RATE REQUIRED`,
    notes: `RATE REQUIRED - ${group.reason}. ${source}.`,
    windowScheduleUnpricedRow: true,
    windowScheduleItemIds: group.itemIds,
    windowCode: group.code,
    windowType: group.typeLabel,
    heightMm: group.heightMm,
    widthMm: group.widthMm,
    active: true,
    formulas: {},
  };
}

// Groups unpriced items by kind + type + size, so two identical custom windows are one line of Qty 2.
function unpricedCollector() {
  const groups = new Map();
  return {
    add(kind, detail, qty, reason) {
      const key = `${kind}|${detail.typeLabel}|${detail.heightMm}x${detail.widthMm}`;
      const group = groups.get(key) || { kind, typeLabel: detail.typeLabel, heightMm: detail.heightMm, widthMm: detail.widthMm, code: detail.code || "", itemIds: [], locations: [], quantity: 0, reason };
      group.quantity += qty;
      if (detail.itemId && !group.itemIds.includes(detail.itemId)) group.itemIds.push(detail.itemId);
      if (detail.location && !group.locations.includes(detail.location)) group.locations.push(detail.location);
      groups.set(key, group);
    },
    result() {
      const rows = [];
      const quantities = {};
      const unmatched = [];
      groups.forEach((group) => {
        const row = unpricedRow(group.kind, group);
        rows.push(row);
        quantities[row.quantityKey] = group.quantity;
        unmatched.push({ kind: group.kind, style: `${group.typeLabel}${UNPRICED_KIND_LABEL[group.kind].toLowerCase()}`, productType: group.typeLabel, heightMm: group.heightMm, widthMm: group.widthMm, code: group.code, quantity: group.quantity, itemIds: group.itemIds, rowId: row.id });
      });
      return { rows, quantities, unmatched };
    },
  };
}

const EMPTY_TAKEOFF = Object.freeze({ quantities: {}, unmatched: [], customWindows: [], unpricedRows: [], outcomes: [], reconciliation: null });

// Window/door quantities for Section 53, straight from the takeoff Window Schedule. Every schedule
// item ends in exactly one outcome (see `outcomes`):
//   matched   - exact product type + size row in the price list (type aliases and whole-mm sizes
//               are normalised first); Qty goes on that row.
//   unpriced  - no price list row (custom size, or a window type the list does not carry): a
//               visible Section 53 line with the real type/size/Qty and no rate.
//   elsewhere - an external door that is not a glass sliding door; quoted in the door sections.
// Nothing is dropped: `reconciliation` totals the schedule against those outcomes. Flyscreens for
// matched windows are set afterwards - see windowPriceListFlyscreenQuantities.
export function windowPriceListTakeoffQuantities(workbook = {}) {
  const job = takeoffJobOf(workbook);
  if (!job || !Array.isArray(job.placedOpenings) || !job.placedOpenings.length) return EMPTY_TAKEOFF;
  const jobSetupRows = workbook?.data?.inputDataSheet?.rows || {};
  const cached = scheduleCache.get(job);
  if (cached && cached.jobSetupRows === jobSetupRows) return cached.result;
  let schedule;
  try {
    schedule = createJobSetupWindowSchedule({
      completedWallRuns: job.completedWallRuns || [],
      placedOpenings: job.placedOpenings || [],
      pixelsPerMm: job.pixelsPerMm,
      sheetLevels: job.sheetLevels || {},
      jobSetupRows,
    });
  } catch (error) {
    console.warn("[Section 53 WINDOWS] the Window Schedule could not be rebuilt from the saved takeoff.", error?.message || error);
    return { ...EMPTY_TAKEOFF, reconciliation: { error: String(error?.message || error) } };
  }
  const listKeys = new Set(windowsPriceListQuoteRows().map((row) => row.quantityKey).filter(Boolean));
  const quantities = {};
  const unpriced = unpricedCollector();
  const outcomes = [];
  const mm = (value) => Math.round(Number(value) || 0);
  (schedule.rows || []).forEach((row) => {
    const isWindow = row.openingType === "Window";
    const style = isWindow ? row.openingStyle : row.doorStyle;
    const productType = priceListProductType(style);
    const qty = Number(row.quantity) || 0;
    const heightMm = mm(row.heightMm);
    const widthMm = mm(row.widthMm);
    const outcome = { itemId: row.itemId, openingType: row.openingType, style: style || "", heightMm, widthMm, quantity: qty, location: row.location || "" };
    if (!isWindow && !productType) {
      outcomes.push({ ...outcome, outcome: "elsewhere" });
      return;
    }
    const key = windowPriceListQuantityKey("window", productType, heightMm, widthMm);
    const typeLabel = productType || style || (isWindow ? "Window (type not set)" : "Door");
    const detail = { typeLabel, heightMm, widthMm, code: row.windowCode || "", itemId: row.itemId, location: row.location || "" };
    if (productType && listKeys.has(key)) {
      if (qty) quantities[key] = (quantities[key] || 0) + qty;
      outcomes.push({ ...outcome, outcome: "matched", quantityKey: key });
    } else {
      const reason = !productType ? `window type "${style || "not set"}" is not in the windows price list` : `no ${heightMm}H x ${widthMm}W ${productType} in the windows price list`;
      unpriced.add("window", detail, qty, reason);
      // Same rule as the price list rows: every window/door except fixed glass takes a flyscreen.
      if (productType !== "Fixed Glass" && !row.isFixed) unpriced.add("flyscreen", detail, qty, `no flyscreen price for this custom ${typeLabel}`);
      outcomes.push({ ...outcome, outcome: "unpriced" });
    }
    if (row.securityScreenRequired) unpriced.add("security-screen", detail, qty, "security screens are not in the windows price list");
  });
  const unpricedResult = unpriced.result();
  Object.assign(quantities, unpricedResult.quantities);
  const withOutcome = (name) => outcomes.filter((item) => item.outcome === name);
  const sum = (items) => items.reduce((acc, item) => acc + item.quantity, 0);
  const section53 = outcomes.filter((item) => item.outcome !== "elsewhere");
  const reconciliation = {
    scheduleItems: outcomes.length, scheduleQty: sum(outcomes),
    section53Items: section53.length, section53Qty: sum(section53),
    matchedItems: withOutcome("matched").length, matchedQty: sum(withOutcome("matched")),
    unpricedItems: withOutcome("unpriced").length, unpricedQty: sum(withOutcome("unpriced")),
    elsewhereItems: withOutcome("elsewhere").length, elsewhereQty: sum(withOutcome("elsewhere")),
  };
  // customWindows stays in the result (always empty) for the older Windows/Doors sheet path.
  const result = { quantities, unmatched: unpricedResult.unmatched, customWindows: [], unpricedRows: unpricedResult.rows, outcomes, reconciliation };
  scheduleCache.set(job, { jobSetupRows, result });
  return result;
}

// Every window/door gets a flyscreen of the same size, with the same Qty as its window row in
// Section 53 - the takeoff count, or the Qty the estimator typed over it. Fixed glass never gets a
// flyscreen. A window with a Qty but no flyscreen of its size in the price list gets a visible
// unpriced flyscreen line (`unpricedRows`) rather than a made-up price or no line at all.
export function windowPriceListFlyscreenQuantities(quotation = {}, quantities = {}) {
  const sectionName = Object.keys(quotation || {}).find(isWindowsSectionName);
  const rows = sectionName ? quotation[sectionName]?.rows || [] : [];
  const flyscreenKeys = new Set(windowsPriceListQuoteRows().map((row) => row.quantityKey).filter((key) => key.startsWith(FLYSCREEN_QTY_PREFIX)));
  const result = {};
  const unpriced = unpricedCollector();
  rows.forEach((row) => {
    if (!row.windowPriceListRow || !String(row.quantityKey || "").startsWith(WINDOW_QTY_PREFIX)) return;
    if (row.windowType === "Fixed Glass" || row.active === false) return;
    const typed = row.quantityManualOverride === true && String(row.quantity ?? "").trim() !== "";
    const qty = typed ? Number(String(row.quantity).replace(/,/g, "")) || 0 : Number(quantities[row.quantityKey]) || 0;
    if (!qty) return;
    const key = `${FLYSCREEN_QTY_PREFIX}${row.quantityKey.slice(WINDOW_QTY_PREFIX.length)}`;
    if (!flyscreenKeys.has(key)) {
      unpriced.add("flyscreen", { typeLabel: row.windowType, heightMm: row.heightMm, widthMm: row.widthMm, code: row.windowCode || "", itemId: row.item }, qty, "no flyscreen of this type and size in the windows price list");
      return;
    }
    result[key] = (result[key] || 0) + qty;
  });
  const unpricedResult = unpriced.result();
  return { quantities: { ...result, ...unpricedResult.quantities }, unmatched: unpricedResult.unmatched, unpricedRows: unpricedResult.rows };
}

// Places the unpriced Window Schedule lines in the WINDOWS section, under their own heading above
// the price list. Saved copies of those rows only carry the estimator's edits: they are replaced by
// the freshly generated rows (edits kept by id), and a saved row whose schedule item no longer
// exists is dropped - so re-saving the takeoff never duplicates or strands a line.
export function withWindowScheduleUnpricedRows(rows = [], unpricedRows = [], sectionName = "WINDOWS") {
  const saved = new Map(rows.filter((row) => row.windowScheduleUnpricedRow).map((row) => [row.id, row]));
  const others = rows.filter((row) => !row.windowScheduleUnpricedRow);
  if (!unpricedRows.length) return saved.size ? others : rows;
  const seen = new Set();
  const generated = unpricedRows.filter((row) => !seen.has(row.id) && seen.add(row.id)).map((row) => {
    const kept = saved.get(row.id);
    const edits = kept ? Object.fromEntries(WINDOWS_QUOTE_EDITABLE_FIELDS.filter((key) => kept[key] !== undefined).map((key) => [key, kept[key]])) : {};
    const next = { ...row, ...edits, section: sectionName };
    const priced = Boolean(next.manualRate || next.supplierQuote);
    return priced ? { ...next, quoteRequired: false, selectionSpec: row.selectionSpec.replace(/ - RATE REQUIRED$/, "") } : next;
  });
  const heading = { ...headingRow(UNPRICED_HEADING), id: `${WINDOW_SCHEDULE_UNPRICED_ROW_PREFIX}heading`, windowPriceListRow: false, windowPriceListHeading: false, windowScheduleUnpricedRow: true, windowScheduleUnpricedHeading: true, section: sectionName };
  const block = [heading, ...generated];
  const at = others.findIndex((row) => row.windowPriceListHeading);
  return at < 0 ? [...others, ...block] : [...others.slice(0, at), ...block, ...others.slice(at)];
}

// Section 53 as calculated vs the Window Schedule: every Qty the schedule put on a window/door key
// must be on a visible Section 53 row. `differences` lists rows whose Quote Sheet Qty is not the
// schedule Qty (an estimator override, an inactive row, or a line that failed to appear).
export function reconcileWindowScheduleWithQuote(takeoff = {}, calculatedRows = []) {
  if (!takeoff?.reconciliation || takeoff.reconciliation.error) return takeoff?.reconciliation || null;
  const rowsByKey = new Map();
  calculatedRows.forEach((row) => { if (row.quantityKey && !rowsByKey.has(row.quantityKey)) rowsByKey.set(row.quantityKey, row); });
  let quoteSheetQty = 0;
  const differences = [];
  Object.entries(takeoff.quantities || {}).forEach(([key, scheduleQty]) => {
    if (!key.startsWith(WINDOW_QTY_PREFIX)) return;
    const row = rowsByKey.get(key);
    const qty = row ? Number(row.qty) || 0 : 0;
    quoteSheetQty += qty;
    if (qty !== scheduleQty) differences.push({ quantityKey: key, item: row?.item || "", scheduleQty, quoteSheetQty: qty, reason: !row ? "no Section 53 row" : row.active === false ? "row inactive" : "Qty overridden on the Quote Sheet" });
  });
  const { section53Qty, matchedQty, unpricedQty } = takeoff.reconciliation;
  return { ...takeoff.reconciliation, quoteSheetQty, differences, balanced: section53Qty === matchedQty + unpricedQty && !differences.some((item) => item.reason === "no Section 53 row") };
}
