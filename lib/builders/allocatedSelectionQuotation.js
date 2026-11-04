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
import { formatPlumbingAllocations, plumbingAllocationLocationKey, plumbingLineWithTotals, plumbingLinesFromSelection, plumbingLocationKey } from "./plumbingFixtureAllocation.js";
import { linkServiceQuotationEntries, updateServiceQuotationRows, RESIDENTIAL_SERVICE_KEYS } from './residentialServices.js';

import { ALLOCATED_SELECTION_SOURCE } from "./selectionSources.js";
export { ALLOCATED_SELECTION_SOURCE };
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
      rate: exGstRate(line.unitPrice, line.priceIncludesGst === true ? "inc GST" : line.priceIncludesGst === false ? "ex GST" : line.priceBasis || (line.supplier === "Harvey Norman Commercial" ? "SRP inc GST" : "")),
    }));
  });
}

function allocatedEntryIdentity(entry) {
  const line = entry.line;
  const identity = line.configuredSelection
    ? line.lineId || line.productId || line.productCode || ""
    : line.productId || line.productCode || line.lineId || "";
  return `${entry.sectionName}\u0000${entry.requirementKey}\u0000${identity}`;
}

function allocatedCommercialSignature(line = {}) {
  const pack = line.selectionPack ? { ...line.selectionPack, packQuantity: undefined } : null;
  return JSON.stringify({
    productId: line.productId || "",
    productCode: line.productCode || "",
    productName: line.productName || "",
    supplier: line.supplier || "",
    supplierCode: line.supplierCode || "",
    model: line.model || "",
    brand: line.brand || "",
    finish: line.finish || "",
    unit: line.unit || "EACH",
    unitPrice: line.unitPrice ?? null,
    unitAllowance: line.unitAllowance ?? null,
    priceIncludesGst: line.priceIncludesGst ?? null,
    priceBasis: line.priceBasis || "",
    priceSource: line.priceSource || "",
    rateBasis: line.rateBasis || "",
    configuredSelection: Boolean(line.configuredSelection),
    specification: line.specification || "",
    configuration: line.configuration || null,
    quoteReference: line.quoteReference || "",
    originalMaterialAllowance: line.originalMaterialAllowance ?? null,
    isBuilderStandard: Boolean(line.isBuilderStandard),
    selectionPack: pack,
  });
}

function allocationQuantities(allocations = []) {
  const quantities = new Map();
  for (const allocation of allocations) {
    const key = plumbingAllocationLocationKey(allocation);
    const quantity = Number(allocation.quantity) || 0;
    if (!key || !(quantity > 0) || quantities.has(key)) return null;
    quantities.set(key, quantity);
  }
  return quantities;
}

function sameAllocationScope(row, allocations) {
  const existing = allocationQuantities(row.locationSchedule || []);
  const incoming = allocationQuantities(allocations);
  if (!existing || !incoming || existing.size !== incoming.size) return false;
  return [...existing].every(([key, quantity]) => Math.abs(quantity - (incoming.get(key) || 0)) < 0.005);
}

function lockedProcurementForReplacement(workbook, requirementKey, productId) {
  const prefix = `allocated-selection:${requirementKey}:`;
  const statuses = new Set(['approved', 'approved for ordering', 'ordered', 'issued', 'delivered', 'received', 'closed']);
  return (workbook.procurement?.items || []).some((item) => {
    if (item.productId !== productId || !item.id?.startsWith(prefix)) return false;
    const orderStatus = String(item.orderStatus || item.status || '').trim().toLowerCase();
    const deliveryStatus = String(item.deliveryStatus || '').trim().toLowerCase();
    return item.approvedForOrdering === true || statuses.has(orderStatus) || statuses.has(deliveryStatus);
  });
}

function aggregateAllocatedSelectionEntries(entries = []) {
  const result = [];
  const byIdentity = new Map();
  for (const entry of entries) {
    if (entry.serviceSelection) {
      result.push(entry);
      continue;
    }
    const identity = allocatedEntryIdentity(entry);
    const existing = byIdentity.get(identity);
    if (!existing) {
      const copy = { ...entry, line: plumbingLineWithTotals(entry.line) };
      byIdentity.set(identity, copy);
      result.push(copy);
      continue;
    }
    const line = entry.line;
    if (existing.line.productId !== line.productId || allocatedCommercialSignature(existing.line) !== allocatedCommercialSignature(line)) {
      const error = new Error(`Client Selections has conflicting products or pricing for ${entry.requirementLabel || entry.requirementKey}; save is blocked until the selections are reconciled.`);
      error.code = "ALLOCATED_SELECTION_CONFLICT";
      throw error;
    }
    const occupied = new Set(existing.line.allocations.map(plumbingAllocationLocationKey));
    const overlap = line.allocations.find(allocation => occupied.has(plumbingAllocationLocationKey(allocation)));
    if (overlap) {
      const error = new Error(`Client Selections repeats ${line.productName || line.productId} in ${overlap.location}; save is blocked until the duplicate allocation is resolved.`);
      error.code = "ALLOCATED_SELECTION_CONFLICT";
      throw error;
    }
    const stableLineId = existing.line.lineId === line.lineId
      ? existing.line.lineId
      : existing.line.productId || existing.line.productCode || [existing.line.lineId, line.lineId].sort()[0];
    const merged = plumbingLineWithTotals({ ...existing.line, lineId: stableLineId, allocations: [...existing.line.allocations, ...line.allocations] });
    existing.line = merged;
    existing.locations = formatPlumbingAllocations(merged.allocations, merged.unit);
    existing.rate = exGstRate(merged.unitPrice, merged.priceIncludesGst === true ? "inc GST" : merged.priceIncludesGst === false ? "ex GST" : merged.priceBasis || (merged.supplier === "Harvey Norman Commercial" ? "SRP inc GST" : ""));
  }
  return result;
}

export function connectAllocatedSelectionsToQuotation(workbook = {}, book = {}, { servicesOnly = false } = {}) {
  const managed = row => row.source === ALLOCATED_SELECTION_SOURCE && (!servicesOnly || RESIDENTIAL_SERVICE_KEYS.some(key => row.id?.startsWith(`allocated-selection:${key}:`)));
  const linkedEntries = linkServiceQuotationEntries(allocatedSelectionQuotationLines(book).filter(e => !servicesOnly || RESIDENTIAL_SERVICE_KEYS.includes(e.requirementKey)), workbook);
  const entries = aggregateAllocatedSelectionEntries(linkedEntries);
  const quotation = { ...(workbook.quotation || {}) };
  const touchedSections = new Set(Object.keys(quotation).filter((name) => (quotation[name]?.rows || []).some((row) => managed(row) || row.serviceSelectionOriginal)));
  if (!entries.length && !touchedSections.size) return workbook;
  entries.forEach((entry) => touchedSections.add(entry.sectionName));
  // Rows normalised into a canonical trade section are no longer in the section this connector names.
  const everyPreviousRow = Object.values(quotation).flatMap((section) => (section?.rows || []).filter(managed));

  for (const sectionName of touchedSections) {
    const previous = quotation[sectionName] || {};
    const previousRows = previous.rows || [];
    const priorRowIdsByNewId = new Map();
    const rows = entries.filter((entry) => entry.sectionName === sectionName && !entry.serviceSelection).map(({ line, requirementKey, requirementLabel, locations, rate }) => {
      const requestedId = `allocated-selection:${requirementKey}:${line.lineId}`;
      const requirementPrefix = `allocated-selection:${requirementKey}:`;
      const rowsById = new Map([...previousRows, ...everyPreviousRow].map((item) => [item.id, item]));
      const allPreviousRows = [...rowsById.values()];
      const sameProductRow = allPreviousRows.find((item) => managed(item) && item.id.startsWith(requirementPrefix)
          && item.productId === line.productId
          && (!line.configuredSelection || (item.locationId && item.locationId === line.locationId)));
      const replacementCandidates = allPreviousRows.filter((item) => managed(item) && item.id.startsWith(requirementPrefix)
        && item.productId !== line.productId && sameAllocationScope(item, line.allocations));
      const replacementRow = !sameProductRow && replacementCandidates.length === 1 ? replacementCandidates[0] : null;
      if (replacementRow && lockedProcurementForReplacement(workbook, requirementKey, replacementRow.productId)) {
        const error = new Error(`The existing ${requirementLabel || requirementKey} selection is approved or ordered and cannot be replaced automatically.`);
        error.code = "ALLOCATED_SELECTION_CONFLICT";
        throw error;
      }
      const priorRow = allPreviousRows.find((item) => item.id === requestedId) || sameProductRow || replacementRow || null;
      const id = replacementRow ? replacementRow.id : requestedId;
      if (priorRow) priorRowIdsByNewId.set(id, priorRow.id);
      const replacingProduct = Boolean(priorRow && priorRow.productId !== line.productId);
      const old = priorRow || {};
      const manualRate = old.manualRate ?? "";
      const rateRequired = rate === null && !String(manualRate).trim();
      const manualQuantity = old.quantityManualOverride === true;
      const baselineVerified = Boolean(workbook.jobInclusionSnapshot?.items?.length || workbook.jobInclusionSnapshot?.jobInclusionSnapshot?.items?.length) || old.selectionBaselineApplied === true || old.variationBasis?.status === "BASELINE_VERIFIED";
      const preserveBaselineRate = Boolean(old.retainedBaseline) && !baselineVerified;
      const quantity = manualQuantity ? old.quantity : line.quantity;
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
        qty: quantity,
        quantity,
        quantityManualOverride: manualQuantity,
        locationSchedule: line.allocations.map((allocation) => ({ location: allocation.location, ...(allocation.locationId ? { locationKey: allocation.locationKey, locationId: allocation.locationId, levelId: allocation.levelId || "" } : {}), quantity: allocation.quantity })),
        locations,
        excelRate: (replacingProduct || preserveBaselineRate) && !baselineVerified ? old.excelRate ?? "" : rate ?? "",
        manualRate,
        cost: "",
        // An estimating allowance is not a supplier price: procurement replaces it with the
        // supplier / subcontractor quotation.
        priceStatus: manualRate ? "Manual rate" : rateRequired ? (line.configuredSelection ? "Supplier Quote Required" : "Price pending") : line.rateBasis === INDICATIVE_RATE_BASIS ? "Indicative estimating rate" : line.priceSource === "supplier-quote" ? "Supplier quote" : "Current Price",
        rateBasis: line.rateBasis || "",
        allowancePerUnit: priorRow?.retainedBaseline ? priorRow.retainedBaseline.allowancePerUnit : priorRow?.allowancePerUnit ?? line.unitAllowance,
        allowanceTotal: priorRow?.retainedBaseline ? priorRow.retainedBaseline.allowanceTotal : priorRow?.allowanceTotal ?? line.allowanceTotal,
        // A replaced product keeps its original inclusion baseline; the difference is only stored once that baseline is approved.
        variation: old.retainedBaseline ? (old.variationBasis?.status === "BASELINE_VERIFIED" ? old.variation : null) : !baselineVerified ? null : manualQuantity ? old.variation ?? line.variation : line.variation,
        // Without an inclusion-schedule snapshot (or an approval) the allowance is only a reference: no client variation is posted.
        historicalVariation: priorRow?.historicalVariation ?? priorRow?.variation ?? line.variation ?? null,
        variationBasis: old.retainedBaseline ? old.variationBasis : baselineVerified ? { status: "BASELINE_VERIFIED" } : { status: "BASELINE_UNVERIFIED", source: "ALLOWANCE_NOT_FROM_INCLUSION_SCHEDULE", allowancePerUnit: line.unitAllowance ?? null },
        included: true,
        active: true,
        quoteRequired: rateRequired,
        lineType: rateRequired ? "Quote required" : "Standard rate item",
        productLibrarySnapshot: { ...line, catalogueOwner: "product-library" },
      };
    });
    const rowsById = new Map(rows.map((row) => [row.id, row]));
    const placed = new Set();
    const orderedRows = previousRows.flatMap((row) => {
      if (!managed(row)) return [row];
      if (placed.has(row.id)) return [];
      const replacement = rowsById.get(row.id) || rows.find((item) => priorRowIdsByNewId.get(item.id) === row.id);
      if (!replacement) return [];
      placed.add(replacement.id);
      return [replacement];
    });
    rows.forEach((row) => {
      if (!placed.has(row.id)) orderedRows.push(row);
    });
    if (!orderedRows.length) delete quotation[sectionName];
    else quotation[sectionName] = { ...previous, collapsed: previous.collapsed ?? true, rows: orderedRows };
  }

  updateServiceQuotationRows(quotation, entries);

  const procurement = workbook.procurement || {};
  const items = (procurement.items || []).filter((item) => !managed(item));
  entries.forEach(({ sectionName, requirementKey, requirementLabel, line, locations, rate }) => {
    const id = `allocated-selection:${requirementKey}:${line.lineId}`;
    const requirementPrefix = `allocated-selection:${requirementKey}:`;
    const previousItem = (procurement.items || []).find((item) => item.id === id && item.productId === line.productId)
      || (procurement.items || []).find((item) => item.id?.startsWith(requirementPrefix) && item.productId === line.productId
        && (!line.configuredSelection || (item.locationId && item.locationId === line.locationId))) || {};
    items.push({
      ...previousItem,
      id,
      source: ALLOCATED_SELECTION_SOURCE,
      sectionName,
      requirementKey,
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
      locationSchedule: line.allocations.map((allocation) => ({ location: allocation.location, ...(allocation.locationId ? { locationKey: allocation.locationKey, locationId: allocation.locationId, levelId: allocation.levelId || "" } : {}), quantity: allocation.quantity })),
      orderStatus: previousItem.orderStatus || "Not Started",
      approvedForOrdering: previousItem.approvedForOrdering === true,
      selectionPack: packReference(line),
      notes: [locations, line.specification, packNote(line)].filter(Boolean).join(" - "),
    });
  });
  return { ...workbook, quotation, residentialSelectionReview: entries.filter(e => e.serviceSelection && !e.target).map(e => ({ requirementKey: e.requirementKey, productCode: e.line.productCode, reason: 'Choose the existing quotation requirement for this material selection' })), procurement: { ...procurement, items } };
}
