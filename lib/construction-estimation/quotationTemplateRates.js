// Template rate schedules for rows the system GENERATES (Client Selections tiling labour and
// electrical room points). These are estimating defaults, not supplier quotations.
//
// Schedule date: 7 November 2026. Units as shown. All rates EXCLUDE GST (the Quote Sheet adds 10%).
// Basis: new single-dwelling residential work in South-East Queensland, standard access, labour
// for installation only (tile and floor-waste materials are priced on their own rows from the
// selected product). Electrical points are supply and install: rough-in, cable from the nearest
// circuit (or a new circuit where stated), standard white plate and fit-off.
//
// A template rate is written to `excelRate` only. A rate the builder typed (`manualRate`) always
// wins and is never changed. A rate that already exists on a generated row is kept.

export const TEMPLATE_RATE_SCHEDULE = Object.freeze({
  id: "gr8-template-rates-2026-11-07",
  date: "2026-11-07",
  gst: "excluded",
  label: "Template estimate rate (7 Nov 2026, ex GST) - edit to confirm",
});

// Keys match the labour keys in lib/builders/tilingCalculations.js.
// Waterproofing is NOT generated per room: it stays in the job's WATERPROOFING section (lump sum
// or per-room rows there), so nothing here can charge it twice.
export const TILING_LABOUR_TEMPLATE_RATES = Object.freeze({
  floorM2: { rate: 65, unit: "M2", basis: "Lay floor tiles up to 600x600, adhesive and grout, per m2 laid" },
  wallM2: { rate: 75, unit: "M2", basis: "Lay wall tiles, adhesive and grout, per m2 laid (walls slower than floors)" },
  featureM2: { rate: 95, unit: "M2", basis: "Feature / patterned tiling, per m2" },
  mosaicM2: { rate: 130, unit: "M2", basis: "Mosaic sheets, per m2" },
  splashbackM2: { rate: 90, unit: "M2", basis: "Splashback tiling incl. cutting around outlets, per m2" },
  skirtingLm: { rate: 28, unit: "LM", basis: "Tiled skirting, cut and set, per lineal metre" },
  floorWasteQty: { rate: 45, unit: "EACH", basis: "Set and tile in a floor waste insert (same as the template TILE LAYER floor-waste rate)" },
  linearDrainQty: { rate: 140, unit: "EACH", basis: "Set and tile in a linear/strip drain" },
});

// Keys match ELECTRICAL_POINT_TYPES in lib/builders/electricalSchedule.js.
export const ELECTRICAL_POINT_TEMPLATE_RATES = Object.freeze({
  "double-gpo": { rate: 110, unit: "EACH", basis: "Double power point on an existing power circuit" },
  "single-gpo": { rate: 95, unit: "EACH", basis: "Single power point on an existing power circuit" },
  "usb-gpo": { rate: 145, unit: "EACH", basis: "Double power point with USB-A/C outlets" },
  tv: { rate: 120, unit: "EACH", basis: "TV point with coax run to the roof space" },
  data: { rate: 145, unit: "EACH", basis: "Cat6 data point cabled back to a central location and terminated" },
  phone: { rate: 95, unit: "EACH", basis: "Phone point cabled to the NBN entry" },
  appliance: { rate: 185, unit: "EACH", basis: "Dedicated 20 A appliance circuit and outlet" },
  fridge: { rate: 110, unit: "EACH", basis: "Fridge power point (single dedicated outlet)" },
  dishwasher: { rate: 125, unit: "EACH", basis: "Dishwasher power point on its own circuit" },
  microwave: { rate: 110, unit: "EACH", basis: "Microwave power point in cabinetry" },
  rangehood: { rate: 95, unit: "EACH", basis: "Rangehood power point in cabinetry (hood installation priced separately)" },
  oven: { rate: 180, unit: "EACH", basis: "Wall oven circuit and isolator" },
  cooktop: { rate: 240, unit: "EACH", basis: "32 A cooktop circuit and isolator" },
  "washing-machine": { rate: 110, unit: "EACH", basis: "Washing machine power point" },
  dryer: { rate: 110, unit: "EACH", basis: "Dryer power point" },
  "garage-door": { rate: 120, unit: "EACH", basis: "Ceiling power point for a garage door motor" },
  "weatherproof-gpo": { rate: 140, unit: "EACH", basis: "Weatherproof double power point (IP rated)" },
});

const blank = (value) => value === undefined || value === null || String(value).trim() === "";

// ---- Load-time safeguard for rows already stored on a job ---------------------------------------
// Client Selections rows are only regenerated when selections are saved, so a job saved before this
// fix still holds the old generated rows. This pass corrects ONLY those generated rows:
//   1. drops exact clones of a generated tiling floor-waste row (same id and same item, quantity and
//      rate in the same section) - the duplicate charges left by the old floor-waste editor;
//   2. recounts each tiling room's floor-waste / linear-drain labour from the floor wastes left;
//   3. fills a blank rate on generated tiling labour and electrical point rows from the schedule.
// Saved selections, builder-typed rates and every other row are untouched. Safe to run repeatedly.
const TILING_SOURCE = "client-selections-tiling-room";
const ELECTRICAL_SOURCE = "client-selections-electrical-schedule";
const tilingLabourKey = (row) => String(row?.id || "").match(/^tiling:.+:labour-([A-Za-z0-9]+)(?::from-.*)?$/)?.[1] || "";
const baseRowId = (row) => String(row?.legacyRowId || row?.id || "").replace(/:from-[a-z0-9-]+$/, "");
const isTilingWaste = (row) => row?.source === TILING_SOURCE && /^tiling:.+:waste-/.test(baseRowId(row));
const cloneKey = (row) => [baseRowId(row), String(row.item || ""), Number(row.quantity) || 0, String(row.excelRate ?? ""), String(row.manualRate ?? "")].join("|");

export function applyGeneratedRowSafeguards(quotation = {}) {
  if (!quotation || typeof quotation !== "object" || Array.isArray(quotation)) return quotation;
  let changed = false;
  const result = {};
  for (const [name, section] of Object.entries(quotation)) {
    const rows = Array.isArray(section?.rows) ? section.rows : null;
    if (!rows) { result[name] = section; continue; }
    const seen = new Set();
    const removedByRoom = new Map();
    let next = rows.filter((row) => {
      if (!isTilingWaste(row)) return true;
      const key = cloneKey(row);
      if (!seen.has(key)) { seen.add(key); return true; }
      removedByRoom.set(row.tilingRoomId || "", true);
      return false;
    });
    next = next.map((row) => {
      if (row?.source === TILING_SOURCE) {
        const labourKey = tilingLabourKey(row);
        if (!labourKey) return row;
        let updated = row;
        if ((labourKey === "floorWasteQty" || labourKey === "linearDrainQty") && removedByRoom.has(row.tilingRoomId || "")) {
          const linear = labourKey === "linearDrainQty";
          const count = next.filter((item) => isTilingWaste(item) && (item.tilingRoomId || "") === (row.tilingRoomId || "") && /^Linear drain/i.test(String(item.item || "")) === linear)
            .reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
          if (count !== Number(row.quantity)) updated = { ...updated, quantity: count, qty: count, quantityCorrection: { from: row.quantity, to: count, reason: "Duplicate floor-waste entries removed from the quotation" } };
        }
        const template = TILING_LABOUR_TEMPLATE_RATES[labourKey];
        if (template && blank(updated.excelRate) && blank(updated.manualRate)) updated = { ...updated, excelRate: template.rate, rateSource: TEMPLATE_RATE_SCHEDULE.label, rateScheduleId: TEMPLATE_RATE_SCHEDULE.id, templateRateBasis: template.basis };
        return updated;
      }
      if (row?.source === ELECTRICAL_SOURCE) {
        const template = ELECTRICAL_POINT_TEMPLATE_RATES[row.electricalPointKey];
        if (template && blank(row.excelRate) && blank(row.manualRate)) return { ...row, excelRate: template.rate, priceStatus: TEMPLATE_RATE_SCHEDULE.label, rateSource: TEMPLATE_RATE_SCHEDULE.label, rateScheduleId: TEMPLATE_RATE_SCHEDULE.id, templateRateBasis: template.basis };
      }
      return row;
    });
    const sectionChanged = next.length !== rows.length || next.some((row, index) => row !== rows[index]);
    if (sectionChanged) changed = true;
    result[name] = sectionChanged ? { ...section, rows: next } : section;
  }
  return changed ? result : quotation;
}
