import { resolveQuotationTarget, selectionIdentitiesFromBook, SCHEDULE_REQUIREMENTS, TARGET_STATUS } from "./quotationTargetResolver.js";
import { PRODUCT_PRICE_SOURCES, resolveProductPrice } from "../product-library/catalogueModel.js";
import { EXTERNAL_LIGHTING_SOURCE } from "./selectionSources.js";
import * as plumbingAllocation from "./plumbingFixtureAllocation.js";
import { windowPriceListTakeoffQuantities } from "../construction-estimation/windowsQuotePriceList.js";

export const PRODUCT_SELECTION_OUTCOME = Object.freeze({
  PRICED_IN_QUOTE: "PRICED_IN_QUOTE",
  VERIFIED_INCLUDED_IN_PACKAGE: "VERIFIED_INCLUDED_IN_PACKAGE",
  VERIFIED_REPLACEMENT: "VERIFIED_REPLACEMENT",
  BLOCKED_MISSING_PRICE: "BLOCKED_MISSING_PRICE",
  BLOCKED_MISSING_QUANTITY: "BLOCKED_MISSING_QUANTITY",
  BLOCKED_MISSING_TARGET: "BLOCKED_MISSING_TARGET",
  BLOCKED_MISSING_ALLOCATION: "BLOCKED_MISSING_ALLOCATION",
  BLOCKED_DUPLICATE_ALLOCATION: "BLOCKED_DUPLICATE_ALLOCATION",
  BLOCKED_MISSING_PROCUREMENT: "BLOCKED_MISSING_PROCUREMENT",
  BLOCKED_INVALID_PRODUCT_REFERENCE: "BLOCKED_INVALID_PRODUCT_REFERENCE",
  BLOCKED_DUPLICATE_SELECTION: "BLOCKED_DUPLICATE_SELECTION",
  BLOCKED_UNVERIFIED_BASELINE: "BLOCKED_UNVERIFIED_BASELINE",
  BLOCKED_AMBIGUOUS_MAPPING: "BLOCKED_AMBIGUOUS_MAPPING",
  BLOCKED_BUILDER_APPROVAL: "BLOCKED_BUILDER_APPROVAL",
});

const positive = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value)) && Number(value) > 0;
const positiveRate = (value) => {
  if (positive(value)) return true;
  const normalized = String(value ?? "").replace(/[$,\s]/g, "");
  return normalized !== "" && Number.isFinite(Number(normalized)) && Number(normalized) > 0;
};
const text = (value) => String(value ?? "").trim();
const AGGREGATED_SERVICE_REQUIREMENTS = new Set(["interior-lighting", "ceiling-fan"]);
const rowProducts = (row = {}) => [row.productId, row.activeProductId, row.selectedProductId, row.selectionSpecProductId, row.productLibrarySnapshot?.productId,
  ...(row.productIds || []), ...(row.selectedProducts || []).map((product) => product.productId || product.id)].filter(Boolean).map(String);
function rowIntentionallyAggregatesProducts(row = {}, owners = []) {
  const selected = new Set((row.selectedProducts || []).map((product) => String(product.productId || product.id || "")).filter(Boolean));
  const oneRequirement = owners.length > 1 && new Set(owners.map((owner) => owner.requirementKey)).size === 1;
  return oneRequirement && (selected.size > 0 || AGGREGATED_SERVICE_REQUIREMENTS.has(owners[0].requirementKey));
}
function mappingsIntentionallyAggregateProducts(workbook = {}, section = "", rowId = "", owners = []) {
  if (owners.length <= 1 || new Set(owners.map((owner) => owner.requirementKey)).size !== 1) return false;
  const mappings = (workbook.quoteTargetMappings || []).filter((mapping) => mapping.status === "MAPPED"
    && mapping.quote_row_id === rowId
    && (!mapping.quote_section_id || mapping.quote_section_id === section));
  return owners.every((owner) => mappings.some((mapping) =>
    (mapping.product_id || mapping.metadata?.productId) === owner.productId
    && (mapping.requirement_key || mapping.metadata?.requirementKey) === owner.requirementKey));
}
const { plumbingLocationKey } = plumbingAllocation;
// Connectors write canonical location labels ("Internal stairs" -> "Staircase",
// "DOWNSTAIRS" -> "Ground Floor"); saved selections may still hold the original
// wording. Compare canonical identities so a relabel is not reported as a mismatch.
function canonicalLocationKey(location = "") {
  const canonical = typeof plumbingAllocation.canonicalSelectionLocation === "function"
    ? plumbingAllocation.canonicalSelectionLocation(location)
    : null;
  return canonical?.locationKey || plumbingLocationKey(location);
}

function selectionLocationKey(location = "", knownRoomKeys = new Set()) {
  const key = canonicalLocationKey(location);
  const hasMainBathroom = knownRoomKeys.has("main-bathroom");
  const hasBathroom = knownRoomKeys.has("bathroom");
  if (hasMainBathroom === hasBathroom) return key;
  if (key === "main-bathroom") return "bathroom";
  if (key.startsWith("main-bathroom-")) return key.replace(/^main-bathroom/, "bathroom");
  return key;
}

function knownRoomLocationKeys(book = {}) {
  const names = (book.rooms || []).map((room) => room?.name).filter(Boolean);
  for (const room of book.rooms || []) for (const row of room.rows || []) {
    const selection = row.guidedSelection || row.selected_details || row.selectedDetails || {};
    names.push(...(selection.cabinetrySelection?.locations || []).map((item) => item.location || item.name).filter(Boolean));
  }
  const keys = new Set(names.map((name) => plumbingLocationKey(name)));
  return keys;
}

function allocationEvidence(allocations = [], knownRoomKeys = new Set()) {
  const byLocation = new Map();
  let duplicate = false;
  for (const allocation of allocations) {
    const location = text(allocation.location);
    const key = selectionLocationKey(location, knownRoomKeys);
    const quantity = Number(allocation.quantity) || 0;
    if (!key || !location || !(quantity > 0)) continue;
    const existing = byLocation.get(key);
    if (!existing) {
      byLocation.set(key, { location, quantity, ...(allocation.additional === true ? { additional: true } : {}) });
      continue;
    }
    const intentionalAdditional = existing.additional === true || allocation.additional === true;
    const repeatedAlias = !intentionalAdditional && existing.location.toLowerCase() !== location.toLowerCase() && existing.quantity === quantity;
    if (repeatedAlias) continue;
    if (!intentionalAdditional) duplicate = true;
    byLocation.set(key, {
      location: existing.location,
      quantity: existing.quantity + quantity,
      ...(intentionalAdditional ? { additional: true } : {}),
    });
  }
  return { allocations: [...byLocation.values()], duplicate };
}

function allSelectedIdentities(book = {}, knownRoomKeys = new Set()) {
  const rowsById = new Map((book?.rooms || []).flatMap((room) => (room.rows || []).map((row) => [row.id, row])));
  const result = selectionIdentitiesFromBook(book)
    .filter((identity) => Boolean(identity.productId) || (Boolean(identity.productName) && !SCHEDULE_REQUIREMENTS.has(identity.requirementKey)))
    .filter((identity) => !(rowsById.get(identity.rowId)?.guidedSelection?.plumbingAllocation?.lines?.length
      || rowsById.get(identity.rowId)?.selected_details?.plumbingAllocation?.lines?.length))
    .map((identity) => {
      const selection = rowsById.get(identity.rowId)?.guidedSelection || rowsById.get(identity.rowId)?.selected_details || rowsById.get(identity.rowId)?.selectedDetails || {};
      return {
        ...identity,
        procurementSchedule: selection.procurementSchedule || selection.windowWorkflow?.procurementSchedule || [],
        lightingSchedule: selection.lightingSchedule || [],
        compositeSelection: Boolean(selection.roofPackage || selection.roofingConfiguration?.roofPackage),
      };
    });
  const add = (row, room, selection, requirementKey, product, { quantity, location, unitPrice, unit, priceIncludesGst, pricePending = false, allocationMissing = false, locationAllocations = [] } = {}) => {
    const productId = text(product?.productId || product?.canonicalProductId || product?.id || product?.productCode || "");
    const productName = text(product?.productName || product?.product_name || product?.name || product?.description);
    if ((!productId && !productName) || !requirementKey) return;
    const key = [requirementKey, productId || "MISSING_PRODUCT_ID", allocationMissing ? "MISSING_LOCATION" : location || room?.name || "", productId ? "" : productName, product?.configuredSelection ? product.lineId || "" : ""].join("|");
    const normalizedAllocations = allocationEvidence(locationAllocations, knownRoomKeys);
    const allocationQuantity = normalizedAllocations.allocations.reduce((total, allocation) => total + allocation.quantity, 0);
    result.push({ key, rowId: row.id || "", requirementKey, productId,
      productName,
      productCode: text(product?.productCode || ""), supplier: text(product?.supplier || ""),
      lineId: text(product?.lineId || ""), configuredSelection: Boolean(product?.configuredSelection),
      location: text(allocationMissing ? "" : normalizedAllocations.allocations.map((allocation) => allocation.location).join(", ") || location || room?.name),
      quantity: locationAllocations.length ? allocationQuantity : Number.isFinite(Number(quantity)) ? Number(quantity) : null,
      unit: text(unit || product.unit || product.priceUnit),
      unitPrice: unitPrice === null || unitPrice === undefined || unitPrice === "" ? null : Number(unitPrice),
      priceIncludesGst: typeof priceIncludesGst === "boolean" ? priceIncludesGst : null,
      pricePending: pricePending || /pending|quote|required/i.test(String(product.priceStatus || product.priceState || "")),
      allocationMissing: Boolean(allocationMissing),
      allocationDuplicate: normalizedAllocations.duplicate,
      locationAllocations: normalizedAllocations.allocations.map((item) => ({ location: text(item.location), quantity: Number(item.quantity) || 0, ...(item.additional === true ? { additional: true } : {}) })),
      allowanceUnit: null, scheduleOwned: false, enteredArea: null });
  };
  for (const room of book?.rooms || []) for (const row of room.rows || []) {
    const selection = row.guidedSelection || row.selected_details || row.selectedDetails || {};
    for (const line of selection.plumbingAllocation?.lines || []) {
      add(row, room, selection, line.requirementKey || selection.requirementKey,
        { ...line, id: line.productId }, { quantity: line.quantity, location: (line.allocations || []).map((allocation) => allocation.location).filter(Boolean).join(", "), allocationMissing: !(line.allocations || []).some((allocation) => text(allocation.location) && Number(allocation.quantity) > 0), locationAllocations: line.allocations || [], unitPrice: line.unitPrice, unit: line.unit, priceIncludesGst: line.priceIncludesGst ?? (/inc\s*gst/i.test(line.priceBasis || "") ? true : line.priceBasis ? false : null) });
    }
    for (const entry of selection.entryDoors || []) {
      const product = entry.entryDoorFurniture;
      if (!product) continue;
      add(row, room, selection, "entry-door-furniture", product, {
        quantity: entry.door?.quantity ?? entry.quantity ?? selection.quantity,
        location: [entry.door?.level, entry.door?.location].filter(Boolean).join(" / "),
        unitPrice: product.selectedCost ?? product.clientPrice ?? product.unitPrice,
        unit: product.unit || "EACH", priceIncludesGst: product.priceIncludesGst ?? product.gstIncluded,
      });
    }
    for (const product of selection.selectedProducts || []) {
      const requirementKey = product.requirementKey || selection.requirementKey;
      add(row, room, selection, requirementKey, product, {
        quantity: product.quantity ?? selection.quantity, location: product.location || selection.location || room.name,
        unitPrice: product.selectedPrice ?? product.unitPrice ?? product.clientPrice,
        unit: product.unit || selection.unit,
        priceIncludesGst: product.priceIncludesGst ?? selection.priceIncludesGst,
      });
    }
  }
  return result;
}

function hasVerifiedPrice(identity, rows) {
  if (identity.pricePending) return false;
  if (positive(identity.unitPrice) && (identity.priceIncludesGst === true || identity.priceIncludesGst === false)) return true;
  return rows.some(({ row }) => {
    if (row.quoteRequired === true || /pending|quote required|unconfirmed/i.test(String(row.priceStatus || row.rateStatus || ""))) return false;
    if (positiveRate(row.manualRate) && (row.manualRateApproved === true || row.manualRateSource === "supplier-quote" || row.priceStatus === "Manual rate")) return true;
    const linked = rowProducts(row).includes(String(identity.productId || ""));
    const snapshot = row.productLibrarySnapshot || {};
    const verified = /current|verified|supplier quote|approved/i.test(String(row.priceStatus || row.rateStatus || snapshot.priceStatus || ""));
    const knownBasis = snapshot.priceIncludesGst === true || snapshot.priceIncludesGst === false || row.priceIncludesGst === true || row.priceIncludesGst === false;
    return linked && verified && knownBasis && positiveRate(row.finalRateUsed ?? row.excelRate ?? row.supplierQuote ?? row.quotedSupplierRate);
  });
}

function matchingProductLibraryPrice(identity, productById) {
  if (!identity.productId || !positive(identity.unitPrice) || typeof productById !== "function") return null;
  if (/quote|required|expired/i.test(String(identity.priceStatus || ""))) return null;
  const product = productById(identity.productId);
  if (!product) return null;
  const resolved = resolveProductPrice(product);
  if (resolved.status !== "current" || resolved.priceRequired || !positive(resolved.price) || typeof resolved.gstIncluded !== "boolean"
    || ![PRODUCT_PRICE_SOURCES.supplier, PRODUCT_PRICE_SOURCES.builderOverride].includes(resolved.source)
    || Math.abs(Number(identity.unitPrice) - Number(resolved.price)) > 0.005) return null;
  const selectedUnit = String(identity.unit || "").trim().toUpperCase();
  const catalogueUnit = String(resolved.unit || "").trim().toUpperCase();
  if (selectedUnit && catalogueUnit && selectedUnit !== catalogueUnit) return null;
  return { priceIncludesGst: resolved.gstIncluded, source: resolved.source };
}

function externalLightingPriceEvidence(identity, rows) {
  if (identity.requirementKey !== "external-lighting" || !identity.lightingSchedule?.length || !identity.procurementSchedule?.length) return null;
  const expectedBySku = new Map();
  for (const line of identity.lightingSchedule) {
    const sku = text(line.sku);
    const location = text(line.exactLocation || line.roomOrExteriorArea);
    const quantity = Number(line.quantity) || 0;
    if (!sku || !location || !(quantity > 0)) return null;
    const expected = expectedBySku.get(sku) || { quantity: 0, locations: new Map() };
    expected.quantity += quantity;
    expected.locations.set(selectionLocationKey(location), (expected.locations.get(selectionLocationKey(location)) || 0) + quantity);
    expectedBySku.set(sku, expected);
  }
  let selectedTotal = 0;
  let gstBasis = null;
  for (const [sku, expected] of expectedBySku) {
    const savedPrices = identity.procurementSchedule.filter(item => text(item.sku) === sku);
    const quoteRows = rows.filter(({ row }) => row.source === EXTERNAL_LIGHTING_SOURCE && text(row.productCode) === sku);
    if (savedPrices.length !== 1 || quoteRows.length !== 1) return null;
    const saved = savedPrices[0];
    const { row } = quoteRows[0];
    const snapshot = row.productLibrarySnapshot || {};
    const unitPrice = Number(snapshot.selectedUnitPrice);
    const gstIncluded = snapshot.priceIncludesGst;
    if (!Number.isFinite(unitPrice) || unitPrice <= 0 || typeof gstIncluded !== "boolean"
      || ![PRODUCT_PRICE_SOURCES.supplier, PRODUCT_PRICE_SOURCES.builderOverride].includes(snapshot.priceSource)
      || row.quoteRequired === true || Math.abs(Number(saved.unitPrice) - unitPrice) > 0.005
      || Math.abs(Number(row.qty ?? row.quantity) - expected.quantity) > 0.005) return null;
    const actualLocations = new Map();
    for (const allocation of row.locationSchedule || []) {
      const key = selectionLocationKey(allocation.location);
      actualLocations.set(key, (actualLocations.get(key) || 0) + (Number(allocation.quantity) || 0));
    }
    if (actualLocations.size !== expected.locations.size) return null;
    for (const [location, quantity] of expected.locations) if (Math.abs((actualLocations.get(location) || 0) - quantity) > 0.005) return null;
    if (gstBasis !== null && gstBasis !== gstIncluded) return null;
    gstBasis = gstIncluded;
    selectedTotal += unitPrice * expected.quantity;
  }
  if (!positive(identity.unitPrice) || Math.abs(Number(identity.unitPrice) - selectedTotal) > 0.01) return null;
  return { priceIncludesGst: gstBasis, source: "VERIFIED_PRODUCT_LIBRARY_SCHEDULE", selectedTotal };
}

function externalLightingProcurementRepresents(items, identity, rows) {
  if (identity.requirementKey !== "external-lighting" || !identity.lightingSchedule?.length || !externalLightingPriceEvidence(identity, rows)) return false;
  const expectedBySku = new Map();
  for (const line of identity.lightingSchedule) {
    const sku = text(line.sku);
    const location = text(line.exactLocation || line.roomOrExteriorArea);
    const quantity = Number(line.quantity) || 0;
    if (!sku || !location || !(quantity > 0)) return false;
    const expected = expectedBySku.get(sku) || new Map();
    expected.set(location, (expected.get(location) || 0) + quantity);
    expectedBySku.set(sku, expected);
  }
  return [...expectedBySku].every(([sku, expectedLocations]) => {
    const scheduleMatches = identity.procurementSchedule.filter(item => text(item.sku) === sku);
    if (scheduleMatches.length !== 1) return false;
    const [item] = scheduleMatches;
    const expectedQuantity = [...expectedLocations.values()].reduce((sum, quantity) => sum + quantity, 0);
    if (Number(item.quantity) !== expectedQuantity || !text(item.supplier) || !positive(item.unitPrice)) return false;
    return true;
  });
}

function procurementWorkflowStatus(items, { included, priced }) {
  if (included) return "INCLUDED_IN_EXISTING_SUBCONTRACT";
  if (!items.length) return priced ? "PRICED_NOT_APPROVED" : "REQUIRED_BUT_UNPRICED";
  const statuses = items.map((item) => String(item.orderStatus || item.deliveryStatus || item.status || "").trim().toLowerCase());
  if (statuses.some((status) => ["delivered", "received", "closed"].includes(status))) return "DELIVERED";
  if (statuses.some((status) => ["ordered", "issued", "part_received", "partially_delivered"].includes(status))) return "ORDERED";
  if (statuses.some((status) => ["approved", "approved for ordering", "approved_for_ordering"].includes(status))) return "APPROVED_FOR_ORDERING";
  return priced ? "PRICED_NOT_APPROVED" : "REQUIRED_BUT_UNPRICED";
}

function quoteRateIsVerified(row = {}) {
  if (row.quoteRequired === true || /pending|quote required|unconfirmed/i.test(String(row.priceStatus || row.rateStatus || ""))) return false;
  const manualRate = Number(String(row.manualRate || "").replace(/[$,]/g, ""));
  if (Number.isFinite(manualRate) && manualRate > 0) return row.manualRateApproved === true || row.manualRateSource === "supplier-quote" || row.priceStatus === "Manual rate";
  const catalogueRate = Number(String(row.excelRate || "").replace(/[$,]/g, ""));
  return Number.isFinite(catalogueRate) && catalogueRate > 0
    && (row.sourceOfRate === "windows price list" || (row.windowPriceListRow === true && row.sourceOfRate === "workbook"));
}

function unambiguousExistingTarget(target = {}) {
  const recommended = target.recommended;
  const chargedAlternative = (target.alsoPresent || []).some((candidate) => Number(candidate.quantity) > 0);
  if (target.status !== TARGET_STATUS.PROPOSED_MAPPING || !recommended || chargedAlternative) return null;
  const exact = recommended.score === 1 && recommended.sizeMismatch !== true;
  const uniqueStrong = target.candidates?.length === 1 && recommended.score >= 0.75 && recommended.sizeMismatch !== true;
  return exact || uniqueStrong ? recommended : null;
}

function windowScheduleEvidence(workbook = {}, identity = {}, knownRoomKeys = new Set()) {
  const expected = windowPriceListTakeoffQuantities(workbook).outcomes.filter((opening) => opening.outcome !== "elsewhere");
  const schedule = identity.procurementSchedule || [];
  const byId = new Map(schedule.map((item) => [String(item.windowId || ""), item]));
  const rows = Object.values(workbook.quotation || {}).flatMap((section) => section.rows || []);
  const complete = expected.length > 0 && byId.size === schedule.length && byId.size === expected.length
    && expected.every((opening) => {
      const item = byId.get(String(opening.itemId));
      return Boolean(item && Number(item.quantity) === Number(opening.quantity)
        && (!opening.location || selectionLocationKey(item.room || "", knownRoomKeys) === selectionLocationKey(opening.location, knownRoomKeys)));
    });
  const unpricedOpenings = expected.filter((opening) => {
    const row = opening.outcome === "unpriced"
      ? rows.find((candidate) => candidate.windowScheduleUnpricedRow && (candidate.windowScheduleItemIds || []).map(String).includes(String(opening.itemId)))
      : rows.find((candidate) => candidate.quantityKey === opening.quantityKey);
    return !quoteRateIsVerified(row || {});
  }).map((opening) => {
    const row = opening.outcome === "unpriced"
      ? rows.find((candidate) => candidate.windowScheduleUnpricedRow && (candidate.windowScheduleItemIds || []).map(String).includes(String(opening.itemId)))
      : rows.find((candidate) => candidate.quantityKey === opening.quantityKey);
    return {
    itemId: String(opening.itemId), location: opening.location || "",
    size: `${opening.heightMm}H x ${opening.widthMm}W`, type: opening.style || "Window",
      rowId: row?.id || "",
    };
  });
  return {
    complete,
    quantity: expected.reduce((sum, opening) => sum + (Number(opening.quantity) || 0), 0),
    priced: complete && unpricedOpenings.length === 0,
    unpricedOpenings,
  };
}

function connectorOwnedProcurement(item = {}, identity = {}) {
  const id = String(item.id || "");
  return Boolean(identity.requirementKey) && (id.startsWith(`appliance-selection:${identity.requirementKey}:`)
    || id.startsWith(`allocated-selection:${identity.requirementKey}:`));
}

function procurementRepresentsIdentity(items = [], identity = {}, quantity = null, included = false, workbook = {}, knownRoomKeys = new Set()) {
  if (included) return true;
  if (externalLightingProcurementRepresents(items, identity, workbook.quotation ? Object.entries(workbook.quotation).flatMap(([section, group]) => (group.rows || []).map(row => ({ section, row }))) : [])) return true;
  if (identity.requirementKey === "windows") return windowScheduleEvidence(workbook, identity, knownRoomKeys).complete;
  const candidates = items.filter((item) => item.productId === identity.productId
    && (item.requirementKey ? item.requirementKey === identity.requirementKey : !item.id?.startsWith("allocated-selection:") || item.id.startsWith(`allocated-selection:${identity.requirementKey}:`))
    && (!identity.configuredSelection || item.id === `allocated-selection:${identity.requirementKey}:${identity.lineId}`)
    && (!identity.productCode || item.productCode === identity.productCode)
    // Connector rows take supplier from catalogue price evidence, which can correct a saved
    // selection that stored the brand as its supplier. They stay authoritative for supplier.
    && (!identity.supplier || item.supplier === identity.supplier || connectorOwnedProcurement(item, identity))
    && (!identity.unit || String(item.unit || "").toUpperCase() === String(identity.unit).toUpperCase()));
  if (candidates.length !== 1 || !(Number(quantity) > 0) || identity.allocationMissing) return false;
  if (identity.locationAllocations?.length) {
    const actual = new Map();
    for (const item of candidates) for (const allocation of item.locationSchedule || []) {
      const key = selectionLocationKey(allocation.location || "", knownRoomKeys);
      actual.set(key, (actual.get(key) || 0) + (Number(allocation.quantity) || 0));
    }
    const expected = new Map(identity.locationAllocations.map((allocation) => [selectionLocationKey(allocation.location || "", knownRoomKeys), Number(allocation.quantity) || 0]));
    if (!actual.size || actual.size !== expected.size) return false;
    return [...expected].every(([location, amount]) => Math.abs((actual.get(location) || 0) - amount) < 0.005);
  }
  const actual = Number(candidates[0].qty ?? candidates[0].quantity ?? 0);
  return Number.isFinite(actual) && Math.abs(actual - Number(quantity)) < 0.005;
}

export function reconcileProductSelections({ workbook = {}, book = workbook.clientSelectionsBook || workbook.selectionsBook, mappings = [], productById = null } = {}) {
  const quotationRows = Object.entries(workbook.quotation || {}).flatMap(([section, group]) => (group.rows || []).map((row) => ({ section, row })));
  const procurement = workbook.procurement?.items || [];
  const knownRoomKeys = knownRoomLocationKeys(book);
  const identities = allSelectedIdentities(book, knownRoomKeys);
  const groups = new Map();
  identities.forEach((identity) => groups.set(identity.key, [...(groups.get(identity.key) || []), identity]));
  const duplicateSelectionIdentities = [...groups].filter(([, group]) => group.length > 1).map(([key, group]) => ({
    key, requirementKey: group[0].requirementKey, productId: group[0].productId, productName: group[0].productName,
    location: group[0].location, rowIds: group.map((identity) => identity.rowId).filter(Boolean), count: group.length,
  }));
  const duplicateKeys = new Set(duplicateSelectionIdentities.map((item) => item.key));
  const occurrence = new Map();
  const entries = identities.map((identity) => {
    const index = occurrence.get(identity.key) || 0;
    occurrence.set(identity.key, index + 1);
    const duplicateIdentity = duplicateKeys.has(identity.key);
    const windowEvidence = identity.requirementKey === "windows" ? windowScheduleEvidence(workbook, identity, knownRoomKeys) : null;
    const target = resolveQuotationTarget({ workbook, identity, mappings });
    const automaticTarget = unambiguousExistingTarget(target);
    const targetIds = new Set([
      ...(target.rowIds || (target.rowId ? [target.rowId] : [])),
      automaticTarget?.rowId,
    ].filter(Boolean));
    const rows = quotationRows.filter(({ section, row }) => (targetIds.has(row.id) && (!target.section || section === target.section))
      || rowProducts(row).includes(String(identity.productId || "")));
    const relatedIds = new Set([identity.productId, ...rows.map(({ row }) => row.id)].filter(Boolean).map(String));
    const procurementRows = procurement.filter((item) => relatedIds.has(String(item.productId || "")) || relatedIds.has(String(item.id || ""))
      || relatedIds.has(String(item.quoteRowId || item.sourceQuoteRowId || "")));
    const procurementLineKeys = procurementRows.map((item) => JSON.stringify([
      item.productId || identity.productId || "", item.unit || identity.unit || "",
      (item.locationSchedule || []).map((location) => [String(location.location || "").trim().toLowerCase(), Number(location.quantity) || 0]).sort(),
    ]));
    const duplicateProcurement = new Set(procurementLineKeys).size < procurementLineKeys.length;
    const takeoffDoorQuantity = target.status === TARGET_STATUS.VERIFIED_SCHEDULE_ROWS && ["internal-doors", "door-hardware"].includes(identity.requirementKey)
      ? rows.reduce((total, { row }) => total + (positive(row.qty ?? row.quantity) ? Number(row.qty ?? row.quantity) : 0), 0)
      : null;
    const externalLightingQuantity = identity.requirementKey === "external-lighting" && identity.lightingSchedule.length
      ? identity.lightingSchedule.reduce((total, line) => total + (Number(line.quantity) || 0), 0)
      : null;
    const quantity = windowEvidence?.quantity ?? externalLightingQuantity ?? (identity.locationAllocations?.length
      ? identity.quantity
      : takeoffDoorQuantity ?? rows.map(({ row }) => row.qty ?? row.quantity).find(positive) ?? identity.quantity);
    const libraryPrice = matchingProductLibraryPrice(identity, productById);
    const schedulePrice = externalLightingPriceEvidence(identity, rows);
    const priceIncludesGst = typeof identity.priceIncludesGst === "boolean" ? identity.priceIncludesGst : libraryPrice?.priceIncludesGst ?? schedulePrice?.priceIncludesGst ?? null;
    const specificationSchedule = ["interior-paint", "exterior-paint"].includes(identity.requirementKey)
      && target.status === TARGET_STATUS.VERIFIED_SCHEDULE_ROWS
      && rows.length > 0;
    const specificationInclusion = target.status === TARGET_STATUS.VERIFIED_SPECIFICATION_ROW || target.mapping?.mode === "SPECIFICATION_ONLY" || target.mode === "SPECIFICATION_ONLY";
    const specificationRateVerified = specificationInclusion && rows.some(({ row }) => positiveRate(row.manualRate || row.excelRate || row.finalRateUsed)
      && row.quoteRequired !== true
      && !/pending|quote required|unconfirmed/i.test(String(row.priceStatus || row.rateStatus || "")));
    const priced = specificationSchedule || specificationRateVerified || (windowEvidence ? windowEvidence.priced : schedulePrice ? true : hasVerifiedPrice({ ...identity, pricePending: identity.pricePending && !libraryPrice, priceIncludesGst }, rows));
    const included = specificationSchedule || specificationInclusion
      || rows.some(({ row }) => (row.selectionSpecProductId === identity.productId
        || (row.selectedProducts || []).some((product) => String(product.productId || product.id || "") === String(identity.productId || "")))
        && (row.selectionSpecificationOnly === true || row.serviceSelectionStatus === "Standard included" || row.includedInProductPackage === true));
    const productRepresented = included || Boolean(automaticTarget) || target.status === TARGET_STATUS.VERIFIED_SCHEDULE_ROWS || Boolean(windowEvidence?.complete) || rows.some(({ row }) => rowProducts(row).includes(String(identity.productId || ""))
      || (row.selectedProducts || []).some((product) => String(product.productId || product.id || "") === String(identity.productId || "")));
    const replacementRows = rows.filter(({ row }) => rowProducts(row).includes(String(identity.productId || ""))
      && (row.activeProductId === identity.productId || row.selectedProductId === identity.productId)
      && Boolean(row.retainedBaseline || row.baselineProductId || row.variationBasis || row.selectionBaselineApplied));
    const replacement = replacementRows.length > 0;
    const procurementRepresented = procurementRepresentsIdentity(procurementRows, identity, quantity, included, workbook, knownRoomKeys);
    const procurementStatus = duplicateProcurement ? "DUPLICATE_REQUIREMENT"
      : procurementRepresented ? procurementWorkflowStatus(procurementRows, { included, priced })
        : procurementRows.length ? "QUANTITY_OR_LOCATION_MISMATCH" : procurementWorkflowStatus([], { included, priced });
    const productReferenceInvalid = !identity.scheduleOwned && !identity.compositeSelection
      && typeof productById === "function" && Boolean(identity.productId) && !productById(identity.productId);
    const unapprovedContractChange = rows.some(({ row }) => row.retainedBaseline?.productId
      && row.retainedBaseline.productId !== identity.productId
      && row.variationBasis?.status !== "BASELINE_VERIFIED"
      && row.selectionBaselineApplied !== true);
    let outcome;
    if (duplicateIdentity) outcome = PRODUCT_SELECTION_OUTCOME.BLOCKED_DUPLICATE_SELECTION;
    else if (productReferenceInvalid) outcome = PRODUCT_SELECTION_OUTCOME.BLOCKED_INVALID_PRODUCT_REFERENCE;
    else if (identity.allocationDuplicate) outcome = PRODUCT_SELECTION_OUTCOME.BLOCKED_DUPLICATE_ALLOCATION;
    else if (identity.allocationMissing) outcome = PRODUCT_SELECTION_OUTCOME.BLOCKED_MISSING_ALLOCATION;
    else if (target.status === TARGET_STATUS.REVIEW_REQUIRED && ["AMBIGUOUS_TARGETS", "TRADE_SECTION_AMBIGUOUS"].includes(target.reason)) outcome = PRODUCT_SELECTION_OUTCOME.BLOCKED_AMBIGUOUS_MAPPING;
    else if (target.status === TARGET_STATUS.PROPOSED_MAPPING && !automaticTarget) outcome = target.candidates?.length > 1 ? PRODUCT_SELECTION_OUTCOME.BLOCKED_AMBIGUOUS_MAPPING : PRODUCT_SELECTION_OUTCOME.BLOCKED_MISSING_TARGET;
    else if (!target.section || !rows.length || !productRepresented) outcome = PRODUCT_SELECTION_OUTCOME.BLOCKED_MISSING_TARGET;
    else if (!positive(quantity)) outcome = PRODUCT_SELECTION_OUTCOME.BLOCKED_MISSING_QUANTITY;
    else if (included && priced) outcome = PRODUCT_SELECTION_OUTCOME.VERIFIED_INCLUDED_IN_PACKAGE;
    else if (unapprovedContractChange || (replacement && replacementRows.some(({ row }) => row.variationBasis?.status !== "BASELINE_VERIFIED" && row.selectionBaselineApplied !== true))) outcome = PRODUCT_SELECTION_OUTCOME.BLOCKED_UNVERIFIED_BASELINE;
    else if (!priced || rows.every(({ row }) => row.quoteRequired === true)) outcome = PRODUCT_SELECTION_OUTCOME.BLOCKED_MISSING_PRICE;
    else if (!procurementRepresented) outcome = PRODUCT_SELECTION_OUTCOME.BLOCKED_MISSING_PROCUREMENT;
    else if (replacement) outcome = PRODUCT_SELECTION_OUTCOME.VERIFIED_REPLACEMENT;
    else outcome = PRODUCT_SELECTION_OUTCOME.PRICED_IN_QUOTE;
    const price = positive(identity.unitPrice) ? Number(identity.unitPrice) : null;
    const exGst = price === null ? null : priceIncludesGst === true ? price / 1.1 : priceIncludesGst === false ? price : null;
    const exposure = schedulePrice
      ? Math.round((schedulePrice.priceIncludesGst ? schedulePrice.selectedTotal / 1.1 : schedulePrice.selectedTotal) * 100) / 100
      : exGst !== null && positive(quantity) ? Math.round(exGst * Number(quantity) * 100) / 100 : null;
    const requirementTerms = String(identity.requirementKey || "").toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 3);
    const productTerms = String(identity.productName || "").toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 4);
    const expandedTargetCandidates = (target.candidates || []).flatMap((candidate) => {
      if (candidate && typeof candidate === "object") return [candidate];
      const value = String(candidate || "");
      const exact = quotationRows.find(({ row }) => row.id === value);
      if (exact) return [{ section: exact.section, rowId: exact.row.id, item: exact.row.item || exact.row.description || exact.row.id, unit: exact.row.unit || "", quantity: exact.row.qty ?? exact.row.quantity ?? "", rate: exact.row.manualRate || exact.row.excelRate || "" }];
      return (workbook.quotation?.[value]?.rows || [])
        .filter((row) => row.lineType !== "Heading")
        .filter((row) => {
          const haystack = `${row.requirementKey || ""} ${row.item || ""} ${row.description || ""}`.toLowerCase();
          return row.requirementKey === identity.requirementKey
            || requirementTerms.some((term) => haystack.includes(term))
            || productTerms.filter((term) => haystack.includes(term)).length >= 2;
        })
        .map((row) => ({ section: value, rowId: row.id, item: row.item || row.description || row.id, unit: row.unit || "", quantity: row.qty ?? row.quantity ?? "", rate: row.manualRate || row.excelRate || "" }));
    });
    const targetCandidates = [...new Map(expandedTargetCandidates
      .filter((candidate) => candidate?.rowId)
      .map((candidate) => [`${candidate.section || ""}:${candidate.rowId}`, candidate])).values()].slice(0, 100);
    return {
      key: duplicateIdentity ? `${identity.key}|duplicate:${identity.rowId || index}` : identity.key,
      identityKey: identity.key, rowId: identity.rowId, lineId: identity.lineId || "", configuredSelection: Boolean(identity.configuredSelection), duplicateIdentity, allocationDuplicate: Boolean(identity.allocationDuplicate), allocationMissing: Boolean(identity.allocationMissing), productReferenceInvalid, unapprovedContractChange,
      productId: identity.productId || "", productCode: identity.productCode || "", supplier: identity.supplier || "", requirementKey: identity.requirementKey,
      productName: identity.productName || "", location: identity.location || "", category: identity.requirementKey,
      locationAllocations: identity.locationAllocations || [],
      unpricedOpeningIds: windowEvidence?.unpricedOpenings.map((opening) => opening.itemId) || [],
      unpricedOpenings: windowEvidence?.unpricedOpenings || [],
      outcome, targetStatus: target.status, targetReason: target.reason || "", section: target.section || "",
      targetCandidates,
      automaticTarget: automaticTarget ? { section: automaticTarget.section || target.section || "", rowId: automaticTarget.rowId, score: automaticTarget.score } : null,
      quoteRowIds: [...new Set(rows.map(({ row }) => row.id).filter(Boolean))], quantity: positive(quantity) ? Number(quantity) : null,
      unit: identity.unit || "", selectedUnitPrice: price, priceIncludesGst, priceVerified: priced,
      priceEvidenceSource: priced ? libraryPrice?.source || schedulePrice?.source || (typeof identity.priceIncludesGst === "boolean" ? "SAVED_SELECTION" : "") : "",
      quantityVerified: positive(quantity), productRepresented, packageVerified: included,
      baselineVerified: replacementRows.length > 0 && replacementRows.every(({ row }) => row.variationBasis?.status === "BASELINE_VERIFIED" || row.selectionBaselineApplied === true),
      procurementStatus, procurementRepresented,
      procurementIssue: procurementRepresented ? "" : procurementRows.length ? "QUANTITY_OR_LOCATION_MISMATCH" : "MISSING",
      procurementIds: procurementRows.map((item) => item.id), estimatedExposureExGst: exposure,
    };
  });
  const statuses = Object.values(PRODUCT_SELECTION_OUTCOME);
  const counts = Object.fromEntries(statuses.map((status) => [status, entries.filter((entry) => entry.outcome === status).length]));
  const categories = [...new Set(entries.map((entry) => entry.category))].sort().map((category) => ({
    category, selected: entries.filter((entry) => entry.category === category).length,
    outcomes: Object.fromEntries(statuses.map((status) => [status, entries.filter((entry) => entry.category === category && entry.outcome === status).length])),
  }));
  const claims = new Map();
  for (const entry of entries.filter((item) => item.targetStatus !== TARGET_STATUS.VERIFIED_SCHEDULE_ROWS)) for (const rowId of entry.quoteRowIds) {
    const key = `${entry.section}\u0000${rowId}`;
    claims.set(key, [...(claims.get(key) || []), entry.key]);
  }
  const entryByKey = new Map(entries.map((entry) => [entry.key, entry]));
  const quoteRowsByKey = new Map(quotationRows.map(({ section, row }) => [`${section}\u0000${row.id}`, row]));
  const duplicates = [...claims].filter(([key, owners]) => {
    const ownerEntries = owners.map((owner) => entryByKey.get(owner)).filter(Boolean);
    return owners.length > 1
      && new Set(ownerEntries.map((owner) => owner.productId)).size > 1
      && !rowIntentionallyAggregatesProducts(quoteRowsByKey.get(key), ownerEntries)
      && !mappingsIntentionallyAggregateProducts(workbook, key.split("\u0000")[0], key.split("\u0000")[1], ownerEntries);
  })
    .map(([key, owners]) => ({ section: key.split("\u0000")[0], rowId: key.split("\u0000")[1], selections: owners }));
  const blocked = entries.filter((entry) => entry.outcome.startsWith("BLOCKED_"));
  return {
    jobId: workbook.jobId || "", workspaceId: workbook.workspaceId || "", selected: entries.length,
    counts, categories, entries, blocked, duplicates, duplicateSelectionIdentities, unresolvedCount: blocked.length,
    supportedUnresolvedExposureExGst: blocked.reduce((sum, entry) => sum + (entry.estimatedExposureExGst ?? 0), 0),
    procurementMissing: entries.filter((entry) => !entry.procurementRepresented),
    procurementDuplicates: entries.filter((entry) => entry.procurementStatus === "DUPLICATE_REQUIREMENT"),
  };
}

export function blockedSelectionsForPurchaseOrderIssue(audit = {}, purchaseOrderItems = []) {
  const productIds = new Set(purchaseOrderItems.map((item) => String(item.productId || "")).filter(Boolean));
  const quoteRowIds = new Set(purchaseOrderItems.map((item) => String(item.sourceQuoteRowId || "")).filter(Boolean));
  return (audit.entries || []).filter((entry) =>
    (productIds.has(String(entry.productId || "")) || (entry.quoteRowIds || []).some((rowId) => quoteRowIds.has(String(rowId))))
    && (String(entry.outcome || "").startsWith("BLOCKED_") || !["APPROVED_FOR_ORDERING", "ORDERED", "DELIVERED", "INCLUDED_IN_EXISTING_SUBCONTRACT"].includes(entry.procurementStatus)));
}

export function validateProductSelectionIntegrityForExport(audit, { jobId = "", workspaceId = "" } = {}) {
  if (!audit || typeof audit !== "object" || !Array.isArray(audit.entries)) return { ok: false, code: "SELECTION_AUDIT_REQUIRED", message: "A current product-selection integrity audit is required before exporting a customer quotation." };
  if (!jobId || audit.jobId !== jobId || !workspaceId || audit.workspaceId !== workspaceId) return { ok: false, code: "SELECTION_AUDIT_IDENTITY_MISMATCH", message: "Product-selection audit belongs to another job or builder." };
  if (Number(audit.selected) !== audit.entries.length) return { ok: false, code: "SELECTION_AUDIT_INCOMPLETE", message: "Product-selection audit does not cover every selected product identity." };
  const validOutcomes = new Set(Object.values(PRODUCT_SELECTION_OUTCOME));
  const evidenceMissing = audit.entries.filter((entry) => {
    if (!validOutcomes.has(entry.outcome)) return true;
    if (entry.outcome === PRODUCT_SELECTION_OUTCOME.PRICED_IN_QUOTE) return !entry.productId || !entry.productRepresented || !entry.quantityVerified || !entry.priceVerified || !positive(entry.selectedUnitPrice) || typeof entry.priceIncludesGst !== "boolean" || !entry.quoteRowIds?.length;
    if (entry.outcome === PRODUCT_SELECTION_OUTCOME.VERIFIED_INCLUDED_IN_PACKAGE) return !entry.productId || !entry.productRepresented || !entry.quantityVerified || !entry.priceVerified || !entry.packageVerified;
    if (entry.outcome === PRODUCT_SELECTION_OUTCOME.VERIFIED_REPLACEMENT) return !entry.productId || !entry.productRepresented || !entry.quantityVerified || !entry.priceVerified || !entry.baselineVerified || !entry.quoteRowIds?.length;
    return false;
  });
  const blocked = audit.entries.filter((entry) => String(entry.outcome || "").startsWith("BLOCKED_") || entry.procurementRepresented !== true);
  const quoteClaims = new Map();
  for (const entry of audit.entries.filter((item) => item.targetStatus !== TARGET_STATUS.VERIFIED_SCHEDULE_ROWS)) for (const rowId of entry.quoteRowIds || []) {
    const key = `${entry.section}\u0000${rowId}`;
    quoteClaims.set(key, [...(quoteClaims.get(key) || []), entry]);
  }
  const duplicateCharges = Array.isArray(audit.duplicates)
    ? [...audit.duplicates]
    : [...quoteClaims].filter(([, owners]) => owners.length > 1 && new Set(owners.map((owner) => owner.productId)).size > 1);
  const procurementClaims = new Map();
  for (const entry of audit.entries) for (const itemId of entry.procurementIds || []) procurementClaims.set(itemId, [...(procurementClaims.get(itemId) || []), entry]);
  const duplicateProcurement = [...procurementClaims].filter(([, owners]) => owners.length > 1 && new Set(owners.map((owner) => owner.productId)).size > 1);
  if (Array.isArray(audit.procurementDuplicates) && audit.procurementDuplicates.length > duplicateProcurement.length) duplicateProcurement.push(...audit.procurementDuplicates.slice(duplicateProcurement.length));
  if (blocked.length || evidenceMissing.length || duplicateCharges.length || duplicateProcurement.length) return {
    ok: false, code: "SELECTION_INTEGRITY_BLOCKED",
    message: `Quotation issue blocked: ${blocked.length} selected product(s) unresolved, ${evidenceMissing.length} outcome(s) lack required evidence, ${duplicateCharges.length} duplicate quote charge(s), ${duplicateProcurement.length} duplicate procurement requirement(s).`,
    blocked: [...blocked, ...evidenceMissing].map((entry) => ({ productId: entry.productId, requirementKey: entry.requirementKey, outcome: entry.outcome, procurementStatus: entry.procurementStatus })),
  };
  return { ok: true };
}