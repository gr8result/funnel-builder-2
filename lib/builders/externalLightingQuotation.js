// Client Selections -> Quotation Builder for the External Lighting schedule: one managed supply row per
// Product Library fitting inside the existing light-fittings trade section. The schedule's fitting counts are
// product counts by definition; manual rates and manual quantities on an existing row always win, and a
// price whose GST basis is not stated is left blank for the estimator rather than guessed.

import { EXTERNAL_LIGHTING_SOURCE } from "./selectionSources.js";
import { resolveTradeSection } from "./quotationTradeSections.js";
import { withClientSelectionsHeading } from "./quotationTargetResolver.js";
import { PRODUCT_PRICE_SOURCES, resolveProductPrice } from "../product-library/catalogueModel.js";

const text = (value) => String(value ?? "").trim();
const number = (value) => (value === null || value === undefined || value === "" || !Number.isFinite(Number(value)) ? null : Number(value));
const managed = (row) => row?.source === EXTERNAL_LIGHTING_SOURCE;

export function externalLightingFittings(book = {}, { productByCode } = {}) {
  const guided = (book.rooms || []).flatMap((room) => room.rows || []).find((row) => row?.guidedSelection?.requirementKey === "external-lighting")?.guidedSelection;
  if (!guided) return [];
  const bySku = new Map();
  for (const line of guided.lightingSchedule || []) {
    const sku = text(line.sku);
    if (!sku) continue;
    const entry = bySku.get(sku) || { sku, productName: text(line.productName), quantity: 0, locations: [], category: text(line.category), finish: text(line.colourFinish) };
    entry.quantity += number(line.quantity) ?? 0;
    entry.locations.push({ location: text(line.exactLocation || line.roomOrExteriorArea), quantity: number(line.quantity) ?? 0, pointId: text(line.lightingPointId) });
    bySku.set(sku, entry);
  }
  for (const line of guided.procurementSchedule || []) {
    const entry = bySku.get(text(line.sku));
    if (entry) Object.assign(entry, { supplier: text(line.supplier), brand: text(line.brand), unitPrice: number(line.unitPrice), priceIncludesGst: typeof line.priceIncludesGst === "boolean" ? line.priceIncludesGst : null });
  }
  return [...bySku.values()].filter((entry) => entry.quantity > 0).map((entry) => {
    if (typeof productByCode !== "function") return entry;
    const product = productByCode(entry.sku, entry.supplier || guided.supplier || "");
    if (!product) return entry;
    const price = resolveProductPrice(product);
    const expectedSupplier = text(entry.supplier || guided.supplier);
    const catalogueSupplier = text(product.supplier);
    if (price.status !== "current" || price.priceRequired || !Number.isFinite(Number(price.price)) || Number(price.price) <= 0
      || typeof price.gstIncluded !== "boolean"
      || ![PRODUCT_PRICE_SOURCES.supplier, PRODUCT_PRICE_SOURCES.builderOverride].includes(price.source)
      || (expectedSupplier && catalogueSupplier && expectedSupplier.toLowerCase() !== catalogueSupplier.toLowerCase())
      || (entry.unitPrice !== null && Math.abs(entry.unitPrice - price.price) > 0.005)) return entry;
    return { ...entry, productId: product.productId, unitPrice: price.price, priceIncludesGst: price.gstIncluded, priceSource: price.source };
  });
}

export function connectExternalLightingToQuotation(workbook = {}, book = {}, options = {}) {
  const fittings = externalLightingFittings(book, options);
  const quotation = workbook.quotation || {};
  const had = Object.values(quotation).some((section) => (section.rows || []).some(managed));
  if (!fittings.length && !had) return workbook;
  const previousRows = Object.values(quotation).flatMap((section) => section.rows || []).filter(managed);
  const trade = resolveTradeSection({ workbook, identity: { requirementKey: "external-lighting" } });
  if (trade.status !== "FOUND") return fittings.length ? { ...workbook, externalLightingSyncReport: { status: "TRADE_SECTION_UNRESOLVED", trade: trade.trade, detail: trade.reason || "More than one section fits", candidates: trade.candidates || [] } } : workbook;

  const rows = fittings.map((fitting) => {
    const id = `external-lighting:${fitting.sku}`;
    const old = previousRows.find((row) => row.id === id) || {};
    const manualQuantity = old.quantityManualOverride === true;
    const quantity = manualQuantity ? old.quantity : fitting.quantity;
    const gstKnown = typeof fitting.priceIncludesGst === "boolean";
    const rate = fitting.unitPrice === null || !gstKnown ? null : fitting.priceIncludesGst ? Math.round((fitting.unitPrice / 1.1) * 10000) / 10000 : fitting.unitPrice;
    const manualRate = old.manualRate ?? "";
    return {
      ...old, id, source: EXTERNAL_LIGHTING_SOURCE, section: trade.section, requirementKey: "external-lighting",
      item: `External Lighting / ${fitting.productName} (${fitting.sku})`,
      description: `${[fitting.brand, fitting.productName].filter(Boolean).join(" ")} (${fitting.sku}) - ${fitting.locations.map((entry) => `${entry.location} x${entry.quantity}`).join("; ")}`,
      productId: fitting.productId || `external-lighting:${fitting.sku}`, productCode: fitting.sku, productName: fitting.productName, supplier: fitting.supplier || "", finish: fitting.finish,
      unit: "EACH", qty: quantity, quantity, quantityManualOverride: manualQuantity, quantitySource: manualQuantity ? "MANUAL_OVERRIDE" : "SELECTION_PRODUCT_COUNT",
      locationSchedule: fitting.locations.map(({ location, quantity: count }) => ({ location, quantity: count })),
      excelRate: rate ?? "", manualRate, cost: "",
      priceStatus: String(manualRate).trim() ? "Manual rate" : rate === null ? (fitting.unitPrice === null ? "Price pending" : "Price basis to confirm") : "Current Price",
      quoteRequired: rate === null && !String(manualRate).trim(), included: true, active: true,
      lineType: rate === null && !String(manualRate).trim() ? "Quote required" : "Standard rate item",
      variationBasis: { status: "NEW_STANDALONE_ITEM", variation: null },
      productLibrarySnapshot: { productId: fitting.productId || "", sku: fitting.sku, productName: fitting.productName, selectedUnitPrice: fitting.unitPrice, priceIncludesGst: fitting.priceIncludesGst, priceSource: fitting.priceSource || "", catalogueOwner: "product-library" },
    };
  });

  const next = { ...quotation };
  for (const [name, section] of Object.entries(next)) {
    if ((section.rows || []).some(managed)) next[name] = { ...section, rows: section.rows.filter((row) => !managed(row)) };
  }
  const target = next[trade.section] || { collapsed: true, rows: [] };
  next[trade.section] = rows.length ? { ...target, rows: [...withClientSelectionsHeading(target, trade.section), ...rows] } : target;
  return { ...workbook, quotation: next, externalLightingSyncReport: { status: "SYNCED", section: trade.section, fittings: rows.length } };
}
