// Client Selections -> Quotation Builder + Procurement for every product -> room allocation
// category (Plumbing & Tapware, Bathroom Accessories, Mirrors, Hot Water, Outdoor Living, ...).
//
// Each selected product line becomes ONE quotation line in its own category's estimate section
// ("PLUMBING FIT OFF - CLIENT SELECTIONS", "PLUMBING - HOT WATER - CLIENT SELECTIONS", ...), never a
// single generic Client Selections line, carrying: Product Library ID, description, model, supplier,
// quantity, unit, rate and the exact location breakdown. Procurement gets the order quantity.
//
// Like connectInternalSelectionsToQuotation, these are snapshots of the chosen products; rows this
// connector wrote earlier are replaced, a builder's manualRate on an unchanged product is kept,
// and nothing else in the quotation is touched.

import { clientSelectionCategoryForRequirement, estimateSectionForRequirement } from "./clientSelectionCategories.js";
import { formatPlumbingAllocations, plumbingLinesFromSelection } from "./plumbingFixtureAllocation.js";
import { linkServiceQuotationEntries, updateServiceQuotationRows, RESIDENTIAL_SERVICE_KEYS } from './residentialServices.js';

export const ALLOCATED_SELECTION_SOURCE = "client-selections-allocated-product";
// Balustrade systems are priced at an indicative estimating rate per LM until a supplier quote.
export const INDICATIVE_RATE_BASIS = "indicative_estimating_rate";

// A line that came from a Selection Pack (selectionPacks.js) stays a normal component line; this is
// the pack-level reference estimating / procurement show beside it.
function packReference(line = {}) {
  const pack = line.selectionPack;
  if (!pack?.packId) return null;
  return { packId: pack.packId, packName: pack.packName, finish: pack.finish, packQuantity: pack.packQuantity, quantityPerPack: pack.quantityPerPack, componentLabel: pack.componentLabel, substituted: Boolean(pack.substituted) };
}
function packNote(line = {}) {
  const pack = packReference(line);
  return pack ? `${pack.packQuantity} x ${pack.packName}${pack.finish ? ` (${pack.finish})` : ""}, ${pack.quantityPerPack} per pack${pack.substituted ? " - substituted component" : ""}` : "";
}

function allocatedRows(book = {}) {
  return (book?.rooms || [])
    .flatMap((room) => room.rows || [])
    .filter((row) => row?.guidedSelection?.plumbingAllocation?.lines?.length);
}

// HNC (and most retail) prices are published inc GST; the Quotation Builder adds GST to its base
// rates, so the base rate is the ex-GST figure.
function exGstRate(unitPrice, priceBasis = "") {
  if (unitPrice === null || unitPrice === undefined || unitPrice === "") return null;
  const value = Number(unitPrice);
  if (!Number.isFinite(value)) return null;
  return /inc(l|\.)?\s*gst/i.test(priceBasis) ? Math.round((value / 1.1) * 10000) / 10000 : value;
}

export function allocatedSelectionQuotationLines(book = {}) {
  return allocatedRows(book).flatMap((row) => {
    const guided = row.guidedSelection;
    const category = clientSelectionCategoryForRequirement(guided.requirementKey);
    const sectionName = `${estimateSectionForRequirement(guided.requirementKey)} - CLIENT SELECTIONS`;
    return plumbingLinesFromSelection(guided).map((line) => ({
      sectionName,
      requirementKey: guided.requirementKey,
      requirementLabel: guided.requirementLabel || "",
      categoryKey: category?.key || "",
      line,
      locations: formatPlumbingAllocations(line.allocations, line.unit),
      rate: exGstRate(line.unitPrice, line.priceBasis || (line.supplier === "Harvey Norman Commercial" ? "SRP inc GST" : "")),
    }));
  });
}

export function connectAllocatedSelectionsToQuotation(workbook = {}, book = {}, { servicesOnly = false } = {}) {
  const managed = row => row.source === ALLOCATED_SELECTION_SOURCE && (!servicesOnly || RESIDENTIAL_SERVICE_KEYS.some(key => row.id?.startsWith(`allocated-selection:${key}:`)));
  const entries = linkServiceQuotationEntries(allocatedSelectionQuotationLines(book).filter(e => !servicesOnly || RESIDENTIAL_SERVICE_KEYS.includes(e.requirementKey)), workbook);
  const quotation = { ...(workbook.quotation || {}) };
  const touchedSections = new Set(Object.keys(quotation).filter((name) => (quotation[name]?.rows || []).some((row) => managed(row) || row.serviceSelectionOriginal)));
  if (!entries.length && !touchedSections.size) return workbook;
  entries.forEach((entry) => touchedSections.add(entry.sectionName));

  for (const sectionName of touchedSections) {
    const previous = quotation[sectionName] || {};
    const previousRows = previous.rows || [];
    const rows = entries.filter((entry) => entry.sectionName === sectionName && !entry.serviceSelection).map(({ line, requirementKey, requirementLabel, locations, rate }) => {
      const id = `allocated-selection:${requirementKey}:${line.lineId}`;
      const old = previousRows.find((item) => item.id === id && item.productId === line.productId) || {};
      return {
        ...old,
        id,
        source: ALLOCATED_SELECTION_SOURCE,
        item: [requirementLabel, line.productName, line.finish].filter(Boolean).join(" / "),
        // A configured / made-to-measure line (shower screen, mirror) carries its specification:
        // type, configuration, size, glass, finish and the supplier quote reference.
        description: `${line.brand ? `${line.brand} ` : ""}${line.productName} (${line.supplierCode || line.model || line.productCode}) - ${locations}${line.specification ? ` - ${line.specification}` : ""}${packNote(line) ? ` [${packNote(line)}]` : ""}`,
        specification: line.specification || "",
        configuration: line.configuration || null,
        quoteReference: line.quoteReference || "",
        selectionPack: packReference(line),
        productId: line.productId,
        productCode: line.productCode,
        productName: line.productName,
        brand: line.brand,
        model: line.supplierCode || line.model,
        supplier: line.supplier,
        finish: line.finish,
        productImageUrl: line.imageUrl,
        unit: line.unit || "EACH",
        qty: line.quantity,
        quantity: line.quantity,
        locationSchedule: line.allocations.map((allocation) => ({ location: allocation.location, quantity: allocation.quantity })),
        locations,
        excelRate: rate ?? "",
        manualRate: old.manualRate ?? "",
        cost: "",
        // An estimating allowance is not a supplier price: procurement replaces it with the
        // supplier / subcontractor quotation.
        priceStatus: rate === null ? (line.configuredSelection ? "Supplier Quote Required" : "Price pending") : line.rateBasis === INDICATIVE_RATE_BASIS ? "Indicative estimating rate" : line.priceSource === "supplier-quote" ? "Supplier quote" : "Current Price",
        rateBasis: line.rateBasis || "",
        allowancePerUnit: line.unitAllowance,
        allowanceTotal: line.allowanceTotal,
        variation: line.variation,
        included: true,
        active: true,
        productLibrarySnapshot: { ...line, catalogueOwner: "product-library" },
      };
    });
    const kept = previousRows.filter((row) => !managed(row));
    if (!kept.length && !rows.length) delete quotation[sectionName];
    else quotation[sectionName] = { ...previous, collapsed: previous.collapsed ?? true, rows: [...kept, ...rows] };
  }

  updateServiceQuotationRows(quotation, entries);

  const procurement = workbook.procurement || {};
  const items = (procurement.items || []).filter((item) => !managed(item));
  entries.forEach(({ sectionName, requirementKey, requirementLabel, line, locations, rate }) => {
    const id = `allocated-selection:${requirementKey}:${line.lineId}`;
    const previousItem = (procurement.items || []).find((item) => item.id === id && item.productId === line.productId) || {};
    items.push({
      ...previousItem,
      id,
      source: ALLOCATED_SELECTION_SOURCE,
      sectionName,
      itemDescription: [line.brand, line.productName, line.supplierCode || line.model].filter(Boolean).join(" "),
      productId: line.productId,
      productCode: line.productCode,
      supplier: line.supplier,
      qty: line.quantity,
      unit: line.unit || "EACH",
      estimatedRate: rate,
      estimatedTotal: rate === null ? null : Math.round(rate * line.quantity * 100) / 100,
      rateBasis: line.rateBasis || "",
      rateStatus: line.rateBasis === INDICATIVE_RATE_BASIS ? "Indicative estimating rate - replace with supplier quotation" : line.configuredSelection && rate === null ? "Supplier quote required" : line.priceSource === "supplier-quote" ? `Supplier quote${line.quoteReference ? ` ${line.quoteReference}` : ""}` : "",
      specification: line.specification || "",
      configuration: line.configuration || null,
      quoteReference: line.quoteReference || "",
      procurementCategory: requirementLabel,
      locationSchedule: line.allocations.map((allocation) => ({ location: allocation.location, quantity: allocation.quantity })),
      orderStatus: previousItem.orderStatus || "Not Started",
      selectionPack: packReference(line),
      notes: [locations, line.specification, packNote(line)].filter(Boolean).join(" - "),
    });
  });
  return { ...workbook, quotation, residentialSelectionReview: entries.filter(e => e.serviceSelection && !e.target).map(e => ({ requirementKey: e.requirementKey, productCode: e.line.productCode, reason: 'Choose the existing quotation requirement for this material selection' })), procurement: { ...procurement, items } };
}
