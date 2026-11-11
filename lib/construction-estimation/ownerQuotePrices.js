// Prices for Quotation Builder rows that have no Product Library price (owner instructions, 10 Nov
// 2026). Used by the quotation rate resolver (finalRate in estimateBuilderWorkbookCalculations.js): a
// row's own supplier quote, manual rate or quoted supplier rate still wins. Saved rows are not
// rewritten. Every price here has a stated source; nothing is estimated.
//
//  1. Supplier prices (data/pricing/supplier-prices.json): retail prices read from the supplier's own
//     store, with the product, size and URL each was taken from. Retail prices include GST; the
//     Quotation Builder works ex GST, so they are divided by 1.1.
//  2. Owner allowances (supplier-prices.json "items" with supplier "Owner allowance", ex GST): items
//     no supplier sells as a stock line, at the rate the owner set (11 Nov 2026).
//  3. Tiling labour at the owner's rates (supplier-prices.json "tilingLabour", 11 Nov 2026): laying
//     per m2 by tile size (600 x 600 and larger, or standard), skirting per LM. These replace the
//     TILE LAYER rate the tiling connector copies onto the row; a manual rate on the row still wins.
//  4. Labour from the builder's own price book in this job, for rows with no rate of their own: floor
//     wastes / speciality tiling from the TILE LAYER rows and electrical points from the ELECTRICAL
//     rate rows. Read from the job each time, so a rate the builder changes follows through.
import supplierPrices from "../../data/pricing/supplier-prices.json";
import { getMasterProducts } from "../product-library/catalogueService.js";

const exGst = (price) => Math.round((Number(price) / 1.1) * 100) / 100;
const money = (value) => {
  const n = Number(String(value ?? "").replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const text = (value) => String(value ?? "").trim();
const DOOR_PRICES = new Map(Object.entries(supplierPrices.entryDoors || {}));
const ITEM_PRICES = supplierPrices.items || [];
const TILING_LABOUR = supplierPrices.tilingLabour || null;

// ---- Builder price book context (built once per calculation) ---------------------------------------
let tileById = null;
function tileInfo(productId = "") {
  if (!productId) return null;
  if (!tileById) {
    tileById = new Map();
    try {
      for (const product of getMasterProducts()) {
        const material = [product.material, product.attributes?.material, product.attributes?.nationalTilesSpecs?.Material].filter(Boolean).join(" ");
        const [a, b] = String(product.size || "").split(/x/i).map(Number);
        const lengthMm = Number(product.attributes?.tileLengthMm) || a || 0;
        const widthMm = Number(product.attributes?.tileWidthMm) || b || 0;
        if (material || lengthMm) tileById.set(product.productId, { material, lengthMm, widthMm });
      }
    } catch { /* catalogue unavailable: tile stays unknown and no laying rate is applied */ }
  }
  return tileById.get(productId) || null;
}

const tilingRoomKey = (row) => String(row?.tilingRoomId || String(row?.id || "").split(":")[1] || "");
const TILING_SURFACE = { floor: "floor", walls: "wall", splashback: "splashback", "tub-splashback": "splashback", "vanity-splashback": "splashback" };

export function ownerQuoteRateContext(quotation = {}) {
  const priceBook = new Map();
  const electrical = new Map();
  const tiling = {};
  let rangehoodCabinet = false;
  for (const [section, group] of Object.entries(quotation || {})) {
    for (const row of group?.rows || []) {
      const item = text(row.item).toUpperCase();
      const rate = money(row.manualRate) || money(row.excelRate);
      if (row.source !== "client-selections-tiling-room" && rate && !priceBook.has(item)) priceBook.set(item, { rate, section, rowId: row.id });
      if (/electrical/i.test(section) && !/client selections/i.test(section) && rate && !electrical.has(item)) electrical.set(item, { rate, section, rowId: row.id });
      if (/^rangehood cabinet$/i.test(text(row.item)) && money(row.quantity) > 0) rangehoodCabinet = true;
      if (row.source === "client-selections-tiling-room" && row.productId) {
        const surface = TILING_SURFACE[String(row.id).split(":").pop()];
        if (surface) {
          // Keyed by tiling room (the id is tiling:<room>:<part>), not by section: sections can be renamed or merged.
          const room = tilingRoomKey(row);
          tiling[room] = tiling[room] || {};
          tiling[room][surface] = tiling[room][surface] || tileInfo(row.productId);
        }
      }
    }
  }
  return { priceBook, electrical, tiling, rangehoodCabinet, quotation };
}

// Tiling labour at the owner's rates: laying by tile size, skirting per LM.
function tilingOwnerRate(row, context) {
  if (!TILING_LABOUR) return null;
  const key = String(row.id).split(":").pop();
  if (key === "labour-skirtingLm") return { rate: TILING_LABOUR.skirtingLm, source: "Owner tiling rate: skirting per LM", priceStatus: Number(TILING_LABOUR.skirtingLm) === 0 ? "No charge (owner rate)" : "Owner rate", ...(Number(TILING_LABOUR.skirtingLm) === 0 ? { noCharge: true } : {}) };
  const surface = { "labour-floorM2": "floor", "labour-wallM2": "wall", "labour-splashbackM2": "splashback" }[key];
  if (!surface) return null;
  const tile = context?.tiling?.[tilingRoomKey(row)]?.[surface];
  if (!tile?.lengthMm || !tile?.widthMm) return null;
  const large = Math.min(tile.lengthMm, tile.widthMm) >= TILING_LABOUR.largeFormatMinMm;
  return large
    ? { rate: TILING_LABOUR.largeFormatM2, priceStatus: "Owner rate", source: `Owner tiling rate: ${tile.lengthMm} x ${tile.widthMm} tiles (600 x 600 and larger) per m2` }
    : { rate: TILING_LABOUR.standardM2, priceStatus: "Owner rate", source: `Owner tiling rate: ${tile.lengthMm} x ${tile.widthMm} tiles (standard) per m2` };
}

// Other tiling labour: the same TILE LAYER item the tiling connector uses (lib/builders/tilingRooms.js).
function tilingLabourItem(row) {
  const key = String(row.id).split(":").pop();
  if (key === "labour-floorWasteQty" || key === "labour-linearDrainQty") return "FLOOR WASTES";
  if (key === "labour-featureM2" || key === "labour-mosaicM2") return "SPECIALITY WORK";
  return "";
}

// Electrical points with no rate row of their own. Appliance points are a power point at the
// appliance; the rangehood point is the slide-out fitting when the kitchen has a rangehood cabinet.
// Data points have no builder rate and stay unpriced (electrician's price needed).
const ELECTRICAL_POINT_ITEM = {
  fridge: "SINGLE POWER POINT", dishwasher: "SINGLE POWER POINT", microwave: "SINGLE POWER POINT",
  "washing-machine": "SINGLE POWER POINT", dryer: "SINGLE POWER POINT", "garage-door": "SINGLE POWER POINT",
};
function electricalPointItem(row, context) {
  const key = String(row.id).split(":").pop();
  if (key === "rangehood") return context.rangehoodCabinet ? "RANGE HOOD INC FITTING OF SLIDE OUT UNIT" : "";
  return ELECTRICAL_POINT_ITEM[key] || "";
}

export function ownerQuotePrice(row = {}, context = null) {
  // A door the Product Library already prices from a verified source (supplier price / catalogue RRP)
  // keeps that price; the supplier list fills only doors the library cannot price.
  const libraryVerified = ["supplier_price", "catalogue_rrp"].includes(row.priceSource) && money(row.supplierCatalogueRate ?? row.excelRate);
  const door = row.canonicalProductId && !libraryVerified ? DOOR_PRICES.get(row.canonicalProductId) : null;
  if (door) return { rate: exGst(door.priceIncGst), priceStatus: "Supplier price", source: `${door.supplier} ${door.product} ${door.variant} (ex GST)` };
  const item = ITEM_PRICES.find((entry) => matches(entry.match, row));
  if (item) return { rate: item.gstIncluded === false ? item.price : exGst(item.price), priceStatus: item.supplier === "Owner allowance" ? "Owner allowance" : "Supplier price", source: `${item.supplier} ${item.product}${item.variant ? ` ${item.variant}` : ""} (ex GST)` };
  const tilingRow = String(row.id).startsWith("tiling:") && row.source === "client-selections-tiling-room";
  if (tilingRow) {
    const owner = tilingOwnerRate(row, context);
    if (owner) return owner;
  }
  if (!context || money(row.excelRate)) return null;
  if (tilingRow) {
    const name = tilingLabourItem(row);
    const book = name ? context.priceBook.get(name) : null;
    if (book) return { rate: book.rate, priceStatus: "Builder rate", source: `${book.section}: ${name}` };
  }
  if (String(row.id).startsWith("electrical-schedule:")) {
    const name = electricalPointItem(row, context);
    const book = name ? context.electrical.get(name) : null;
    if (book) return { rate: book.rate, priceStatus: "Builder rate", source: `${book.section}: ${name}` };
  }
  return null;
}

// Item match rules in the data file (one key per rule): { "quantityKey": [...] } / { "productCode": [...] }
// / { "ids": [exact row ids] } / { "idIncludes": [text in the row id] } / { "idPattern": "regex on the row id" }.
function matches(rule = {}, row = {}) {
  const id = String(row.id || "");
  if (rule.quantityKey) return rule.quantityKey.includes(row.quantityKey);
  if (rule.productCode) return rule.productCode.includes(row.productCode || row.code);
  if (rule.ids) return rule.ids.includes(id);
  if (rule.idIncludes) return rule.idIncludes.some((part) => id.includes(part));
  if (rule.idPattern) return new RegExp(rule.idPattern).test(id);
  return false;
}
