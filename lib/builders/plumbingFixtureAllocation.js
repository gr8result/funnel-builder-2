// Plumbing Fixtures selection model: PRODUCT -> LOCATION ALLOCATIONS -> QUANTITY.
//
// One Plumbing Fixtures requirement (Sinks, Basin Mixers, ...) is still ONE selection-book row /
// ONE builder_client_selections record, exactly like every other guided requirement. What changes
// is what that record carries: guidedSelection.plumbingAllocation holds a collection of product
// lines, each allocated to one or more project locations with a real per-location quantity.
//
//   Bathroom Basins
//     line 1: Caroma Basin   Bathroom x1, Ensuite x2, Ensuite 2 x1   -> qty 4
//     line 2: Other Basin    Powder Room x1                          -> qty 1
//   category quantity = 5
//
// Location allocations are the only source of quantity (qty = sum of location quantities), so
// the two can never contradict each other.
//
// Allowance basis: every PLUMBING_FIXTURE_REQUIREMENTS entry is unit "EACH" with defaultQuantity 1
// (clientSelectionWorkflow.js), and variationFor() already computes (price - allowance) x qty. So
// requirement.defaultAllowance ($650 basin, $420 sink mixer, ...) is a PER-UNIT allowance, and the
// allowance total is unitAllowance x quantity. A product's own explicit allowance (productAllowance)
// is honoured the same way, per unit.

import { numberValue, roundMoney } from "./selectionBudget.js";
import { isGenericBuildingLevelLocation, levelIdOf, levelLabel, levelRank } from "./buildingLevels.js";

export const PLUMBING_ALLOCATION_SCHEMA_VERSION = "plumbing-allocation.v1";
export const UNALLOCATED_LOCATION_KEY = "unallocated";

// Location types, matched against real project room names.
const LOCATION_TYPES = [
  { type: "service-location", label: "Service Location", pattern: /service\s*(?:location|area)|plant\s*room/i },
  { type: "whole-house", label: "Whole House", pattern: /whole\s*(?:house|home)|entire\s*(?:house|home)/i },
  { type: "exterior", label: "Exterior", pattern: /outside|external|exterior/i },
  { type: "roof", label: "Roof", pattern: /roof(?:line|ing)?/i },
  { type: "garage", label: "Garage", pattern: /garage/i },
  { type: "alfresco", label: "Alfresco", pattern: /alfresco/i },
  { type: "patio", label: "Patio", pattern: /patio/i },
  { type: "balcony", label: "Balcony", pattern: /balcony/i },
  { type: "staircase", label: "Staircase", pattern: /\b(?:internal\s+)?stairs?\b|\bstaircase\b/i },
  { type: "kitchenette", label: "Kitchenette", pattern: /kitchenette/i },
  { type: "outdoor-kitchen", label: "Outdoor Kitchen", pattern: /outdoor\s*kitchen|alfresco\s*kitchen|bbq/i },
  { type: "butlers-pantry", label: "Butler's Pantry", pattern: /butler|scullery|walk[\s-]*in\s*pantry/i },
  { type: "kitchen", label: "Kitchen", pattern: /kitchen/i },
  { type: "laundry", label: "Laundry", pattern: /laundry/i },
  { type: "ensuite", label: "Ensuite", pattern: /ensuite|en[\s-]suite/i },
  { type: "powder-room", label: "Powder Room", pattern: /powder/i },
  { type: "wc", label: "WC", pattern: /\bw\.?c\.?\b|toilet/i },
  { type: "bathroom", label: "Bathroom", pattern: /bath/i },
  { type: "outdoor-wet", label: "Balcony", pattern: /balcony|alfresco|patio|external tiled/i },
];

// Where each category's fixture normally goes. Suggestions only: any plumbing location can
// still be chosen (a Sink Mixer in the Laundry is legitimate).
export const PLUMBING_LOCATION_TYPES_BY_REQUIREMENT = {
  "hot-water-system": ["exterior", "roof", "garage", "alfresco", "patio", "balcony", "whole-house", "service-location"],
  sink: ["kitchen", "butlers-pantry", "laundry", "kitchenette", "outdoor-kitchen"],
  "sink-mixer": ["kitchen", "butlers-pantry", "laundry", "kitchenette", "outdoor-kitchen"],
  "bathroom-basin": ["bathroom", "ensuite", "powder-room"],
  "basin-mixer": ["bathroom", "ensuite", "powder-room"],
  bath: ["bathroom", "ensuite"],
  "bath-mixer": ["bathroom", "ensuite"],
  "shower-fixtures": ["bathroom", "ensuite"],
  "toilet-suite": ["bathroom", "ensuite", "powder-room", "wc"],
  "laundry-tub": ["laundry"],
  "floor-waste": ["bathroom", "ensuite", "laundry", "powder-room", "wc", "outdoor-wet"],
};

// Floor wastes drain a specific tiled area, so each bathroom / ensuite in the project offers its
// floor and its shower separately ("Ensuite Floor", "Ensuite Shower"). Derived from the project's
// own room names - never a fixed list.
// Bath & Shower Mixers: the same mixer can serve the bath or the shower in one room, so each
// bathroom / ensuite offers both ("Bathroom Bath", "Bathroom Shower").
export const PLUMBING_APPLICATION_SUFFIXES = { "floor-waste": ["Floor", "Shower"], "bath-mixer": ["Bath", "Shower"] };

// The application an allocation label names ("Ensuite Shower" -> "Shower"), or "".
export function plumbingAllocationApplication(location = "") {
  // A room name plus an application word ("Ensuite Shower"); a bare room name is not an application.
  const match = String(location).trim().match(/^\S.*\s(bath|shower|floor)$/i);
  return match ? match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase() : "";
}

function expandedLocationLabels(requirementKey, labels = []) {
  const suffixes = PLUMBING_APPLICATION_SUFFIXES[requirementKey];
  if (!suffixes) return labels;
  return labels.flatMap((label) => {
    const type = plumbingLocationType(label);
    if (type !== "bathroom" && type !== "ensuite") return [label];
    return plumbingAllocationApplication(label) ? [label] : suffixes.map((suffix) => `${label} ${suffix}`);
  });
}

export function plumbingLocationKey(label = "") {
  let value = String(label || "").trim().toLowerCase().replace(/['’]/g, "").replace(/\b(1st|first)\s+bedroom\b/g, "bedroom 1").replace(/\b(2nd|second)\s+bedroom\b/g, "bedroom 2").replace(/\b(3rd|third)\s+bedroom\b/g, "bedroom 3").replace(/\b(\d+)(st|nd|rd|th)\b/g, "$1");
  value = value.replace(/\b(?:b|bed|bedroom)\s*(\d+)\b/g, "bedroom $1").replace(/\b(\d+)\s+bedroom\b/g, "bedroom $1");
  const bedroomEnsuite = value.match(/\bbedroom\s+(\d+)\b/)?.[1];
  if (bedroomEnsuite && /\bensuite\b/.test(value)) {
    const suffix = value.replace(/\bbedroom\s+\d+\b|\bensuite\b/g, " ").split(/[^a-z0-9]+/).filter(Boolean).sort();
    return ["bedroom", bedroomEnsuite, "ensuite", ...suffix].join("-");
  }
  return value.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function plumbingLocationType(label = "") {
  const text = String(label || "");
  return LOCATION_TYPES.find((entry) => entry.pattern.test(text))?.type || "";
}

export function isSupportedNonRoomLocation(label = "") {
  return ["exterior", "roof", "garage", "alfresco", "patio", "balcony", "staircase", "whole-house", "service-location"].includes(plumbingLocationType(label));
}

export function canonicalSelectionLocation(label = "") {
  const location = String(label || "").trim();
  const levelId = levelIdOf(location);
  if (levelId && isGenericBuildingLevelLocation(location)) {
    return { location: levelLabel(levelId), locationKey: plumbingLocationKey(levelLabel(levelId)), levelId, assignmentReviewRequired: true };
  }
  if (/^(?:outside|external|exterior)$/i.test(location)) {
    return { location: "Outside", locationKey: "outside", locationType: "exterior" };
  }
  if (/^(?:internal\s+)?stairs?$/i.test(location) || /^staircase$/i.test(location)) {
    return { location: "Staircase", locationKey: plumbingLocationKey("Staircase"), locationType: "staircase" };
  }
  return { location, locationKey: plumbingLocationKey(location) };
}

export function plumbingAllocationLocationKey(allocation = {}) {
  const location = String(allocation?.location || allocation?.label || "").trim();
  const canonical = plumbingLocationKey(location);
  if (allocation?.locationId && allocation?.locationKey) return allocation.locationKey;
  const canonicalLocation = canonicalSelectionLocation(location);
  if (canonicalLocation.levelId || canonicalLocation.locationType === "staircase") return canonicalLocation.locationKey;
  if (allocation?.levelId && allocation?.locationKey) return allocation.locationKey;
  return /^bedroom-\d+-ensuite(?:-|$)/.test(canonical) ? canonical : allocation?.locationKey || canonical;
}

// projectLocationNames: real room names from the project (Selections Book rooms, Cabinetry
// locations, ...). Returns every plumbing-capable location, suggested ones first.
export function plumbingLocationsForRequirement(requirementKey = "", projectLocationNames = [], existingLines = []) {
  const residentialServices = ["interior-lighting", "ceiling-fan", "air-conditioning"].includes(requirementKey);
  const suggestedTypes = PLUMBING_LOCATION_TYPES_BY_REQUIREMENT[requirementKey] || [];
  const sourceLocations = (Array.isArray(projectLocationNames) ? projectLocationNames : []).map((location) => {
    if (location && typeof location === "object") {
      const name = String(location.name || location.roomName || location.label || "").trim();
      return { id: location.id || location.locationId || "", name, label: String(location.displayName || location.label || name).trim(), key: String(location.allocationKey || location.identityKey || location.key || plumbingLocationKey(name)), locationId: location.id || location.locationId || "", levelId: location.levelId || "" };
    }
    const name = String(location || "").trim();
    return { name, label: name, key: plumbingLocationKey(name), locationId: "", levelId: "" };
  }).filter((location, index, all) => location.name && location.key && !isGenericBuildingLevelLocation(location.name) && all.findIndex((other) => other.key === location.key) === index)
    .filter((location) => residentialServices || plumbingLocationType(location.name));
  const repeatedNames = new Set(sourceLocations.filter((location, index, all) => all.some((other, otherIndex) => otherIndex !== index && plumbingLocationKey(other.name) === plumbingLocationKey(location.name))).map((location) => plumbingLocationKey(location.name)));
  sourceLocations.forEach((location) => { location.identityRequired = repeatedNames.has(plumbingLocationKey(location.name)); });
  if (requirementKey === "hot-water-system") {
    const projectNameKeys = new Set(sourceLocations.map((location) => plumbingLocationKey(location.name)));
    ["Exterior", "Roof", "Garage", "Alfresco", "Patio", "Balcony", "Whole House", "Service Location"].forEach((label) => {
      if (!projectNameKeys.has(plumbingLocationKey(label))) sourceLocations.push({ name: label, label, key: plumbingLocationKey(label), source: "standard-location" });
    });
  }
  const base = sourceLocations.flatMap((location) => expandedLocationLabels(requirementKey, [location.label]).map((label) => ({ ...location, label, key: label === location.label ? location.key : plumbingLocationKey(label) })));
  // Locations already allocated (including custom ones) must always stay visible for editing.
  const allocated = existingLines.flatMap((line) => (line.allocations || []).map((allocation) => ({
    name: allocation.roomName || allocation.location,
    label: allocation.location,
    key: allocation.locationKey || plumbingLocationKey(allocation.location),
    ...(allocation.locationId ? { locationId: allocation.locationId } : {}),
    ...(allocation.levelId ? { levelId: allocation.levelId } : {}),
    source: "saved-allocation",
  })));
  const candidates = [...base.map((location) => ({ ...location, source: location.source || "project" })), ...allocated];
  const unique = candidates.filter((location, index, all) => location.key !== UNALLOCATED_LOCATION_KEY && all.findIndex((other) => other.key === location.key) === index);
  const projectKeys = new Set(base.map((location) => location.key));
  const locations = unique.map((location) => {
    const type = plumbingLocationType(location.name || location.label);
    return { ...location, type, suggested: residentialServices || suggestedTypes.includes(type), source: projectKeys.has(location.key) ? (location.source || "project") : location.source || "saved-allocation" };
  });
  const typeOrder = (type) => {
    const index = suggestedTypes.indexOf(type);
    return index >= 0 ? index : suggestedTypes.length + LOCATION_TYPES.findIndex((entry) => entry.type === type);
  };
  return locations.sort((left, right) => (
    Number(right.suggested) - Number(left.suggested)
    || typeOrder(left.type) - typeOrder(right.type)
    || levelRank(left.levelId || "") - levelRank(right.levelId || "")
    || left.label.localeCompare(right.label, undefined, { numeric: true })
  ));
}

function uniqueLabels(labels = []) {
  const seen = new Set();
  return labels
    .map((label) => String(label || "").trim())
    .filter((label) => {
      const key = plumbingLocationKey(label);
      if (!label || !key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

// Measured units (a balustrade in lineal metres) keep their decimals; counted units stay whole.
const MEASURED_UNITS = new Set(["LM", "M", "M2", "M²", "SQM"]);
export function isMeasuredUnit(unit = "") {
  return MEASURED_UNITS.has(String(unit || "").trim().toUpperCase());
}

function roundQuantity(value, measured) {
  const quantity = Math.max(0, numberValue(value));
  return measured ? Math.round(quantity * 100) / 100 : Math.round(quantity);
}

function selectionPackAllocations(line = {}) {
  if (!line.selectionPack?.packId) return line.allocations || [];
  const byLocation = new Map();
  (line.allocations || []).forEach((allocation) => {
    const location = String(allocation?.location || allocation?.label || "").trim();
    const key = plumbingAllocationLocationKey(allocation);
    const quantity = roundQuantity(allocation?.quantity, isMeasuredUnit(line.unit));
    if (!location || !key || !quantity) return;
    const existing = byLocation.get(key);
    if (!existing) {
      byLocation.set(key, { ...(allocation.locationId ? { locationId: allocation.locationId } : {}), ...(allocation.levelId ? { levelId: allocation.levelId } : {}), ...(allocation.roomName ? { roomName: allocation.roomName } : {}), locationKey: key, location, quantity, ...(allocation.additional === true ? { additional: true } : {}) });
      return;
    }
    if (existing.additional === true || allocation.additional === true) {
      byLocation.set(key, { ...existing, locationKey: key, location: existing.location, quantity: roundQuantity(existing.quantity + quantity, isMeasuredUnit(line.unit)), additional: true });
    } else if (quantity > existing.quantity) {
      byLocation.set(key, { ...existing, locationKey: key, location: existing.location, quantity });
    }
  });
  return Array.from(byLocation.values());
}

export function normaliseAllocations(allocations = [], { unit = "" } = {}) {
  const measured = isMeasuredUnit(unit);
  const byKey = new Map();
  (Array.isArray(allocations) ? allocations : []).forEach((allocation) => {
    const originalLocation = String(allocation?.location || allocation?.label || "").trim();
    const canonical = canonicalSelectionLocation(originalLocation);
    const location = canonical.location;
    const key = allocation.locationId ? plumbingAllocationLocationKey(allocation) : canonical.locationKey;
    const quantity = roundQuantity(allocation?.quantity, measured);
    if (!key || !location || !quantity) return;
    const existing = byKey.get(key);
    const identity = {
      ...(allocation.locationId ? { locationId: allocation.locationId } : {}),
      ...(allocation.levelId ? { levelId: allocation.levelId } : {}),
      ...(allocation.roomName ? { roomName: allocation.roomName } : {}),
      ...(!allocation.locationId && canonical.levelId ? { levelId: canonical.levelId } : {}),
      ...(canonical.assignmentReviewRequired ? { assignmentReviewRequired: true } : {}),
      ...(canonical.locationType ? { locationType: canonical.locationType } : {}),
      ...(originalLocation && originalLocation !== location ? { legacyLocation: allocation.legacyLocation || originalLocation } : allocation.legacyLocation ? { legacyLocation: allocation.legacyLocation } : {}),
      ...(allocation.intendedLevelId ? { intendedLevelId: allocation.intendedLevelId } : {}),
      ...(allocation.historicalFloorLocation ? { historicalFloorLocation: allocation.historicalFloorLocation } : {}),
    };
    if (!existing) {
      byKey.set(key, { ...identity, locationKey: key, location, quantity, ...(allocation.additional === true ? { additional: true } : {}) });
      return;
    }
    const intentionalAdditional = existing.additional === true || allocation.additional === true;
    const repeatedAlias = !intentionalAdditional && existing.location.toLowerCase() !== location.toLowerCase() && existing.quantity === quantity;
    if (repeatedAlias) return;
    byKey.set(key, {
      ...existing,
      ...identity,
      locationKey: key,
      location: existing.location,
      quantity: roundQuantity(existing.quantity + quantity, measured),
      ...(intentionalAdditional ? { additional: true } : {}),
    });
  });
  return Array.from(byKey.values());
}

export function allocationQuantity(allocations = []) {
  return normaliseAllocations(allocations).reduce((total, allocation) => total + allocation.quantity, 0);
}

function declaredGstBasis(line = {}) {
  if (typeof line.priceIncludesGst === "boolean") return line.priceIncludesGst;
  const basis = `${line.priceBasis || ""} ${line.gstTreatment || ""}`;
  if (/\b(?:inc(?:lusive)?|including|included)\.?\s*gst\b|\bgst\s*(?:inclusive|included)\b/i.test(basis)) return true;
  if (/\b(?:ex(?:clusive)?|excluding|excluded)\.?\s*gst\b|\bgst\s*(?:exclusive|excluded)\b/i.test(basis)) return false;
  return null;
}

// Recomputes every derived figure on a line from its allocations + unit rates.
export function plumbingLineWithTotals(line = {}) {
  const allocations = normaliseAllocations(selectionPackAllocations(line), { unit: line.unit });
  const quantity = roundQuantity(allocations.reduce((total, allocation) => total + allocation.quantity, 0), isMeasuredUnit(line.unit));
  const priced = line.unitPrice !== null && line.unitPrice !== undefined && line.unitPrice !== "" && Number.isFinite(Number(line.unitPrice));
  const unitPrice = priced ? roundMoney(numberValue(line.unitPrice)) : null;
  const unitAllowance = roundMoney(numberValue(line.unitAllowance));
  const priceIncludesGst = declaredGstBasis(line);
  const allowanceTotal = roundMoney(unitAllowance * quantity);
  const selectedTotal = priced ? roundMoney(unitPrice * quantity) : null;
  const selectionPack = line.selectionPack?.packId ? {
    ...line.selectionPack,
    packQuantity: Math.round(quantity / Math.max(1, numberValue(line.selectionPack.quantityPerPack) || 1)),
  } : line.selectionPack;
  return {
    ...line,
    allocations,
    quantity,
    unitPrice,
    unitAllowance,
    allowanceBasis: "per_unit",
    selectedTotal,
    allowanceTotal,
    priceIncludesGst,
    variation: priced && typeof priceIncludesGst === 'boolean' && !line.allowancePending
      ? roundMoney((priceIncludesGst ? selectedTotal / 1.1 : selectedTotal) - allowanceTotal) : null,
    ...(selectionPack ? { selectionPack } : {}),
  };
}

export function plumbingAllocationSummary(lines = []) {
  const computed = (lines || []).map(plumbingLineWithTotals).filter((line) => line.quantity > 0);
  const quantity = computed.reduce((total, line) => total + line.quantity, 0);
  const allPriced = computed.length > 0 && computed.every((line) => line.unitPrice !== null);
  const allowanceTotal = roundMoney(computed.reduce((total, line) => total + line.allowanceTotal, 0));
  const selectedTotal = allPriced ? roundMoney(computed.reduce((total, line) => total + line.selectedTotal, 0)) : null;
  return {
    lines: computed,
    quantity,
    allPriced,
    allowanceTotal,
    selectedTotal,
    variation: allPriced && computed.every(line => line.variation !== null) ? roundMoney(computed.reduce((sum, line) => sum + line.variation, 0)) : null,
    // Unit figures that multiply back to the totals: the rest of Client Selections (budget dock,
    // area totals, builder_client_selections) reads selectedPrice/allowance x quantity.
    unitAllowance: quantity ? allowanceTotal / quantity : 0,
    unitPrice: allPriced && quantity ? selectedTotal / quantity : null,
  };
}

// The product line identity for a catalogue product. A category can hold several lines; the same
// product is always one line.
export function plumbingProductLineId(product = {}) {
  return String(product.productId || product.id || product.productCode || product.model || product.productName || "").trim();
}

export function plumbingLineFromProduct(product = {}, { unitPrice = null, unitAllowance = 0, priceState = "", allocations = [] } = {}) {
  const entity = product.metadata?.productEntity || product;
  return plumbingLineWithTotals({
    lineId: plumbingProductLineId(product),
    productId: product.productId || product.id || "",
    productCode: entity.productCode || product.productCode || "",
    supplierCode: entity.attributes?.hncProductCode || product.attributes?.hncProductCode || product.model || "",
    productName: product.productName || entity.productName || "",
    brand: product.brand || entity.brand || "",
    supplier: product.supplier || entity.supplier || "",
    model: product.model || entity.model || "",
    colour: product.colour || entity.colour || "",
    finish: product.finish || entity.finish || product.colour || "",
    imageUrl: product.imageUrl || product.primaryImageUrl || entity.primaryImageUrl || "",
    officialProductURL: entity.officialProductURL || entity.officialProductUrl || product.productUrl || product.officialProductUrl || "",
    priceBasis: entity.attributes?.priceBasis || product.attributes?.priceBasis || "",
    priceIncludesGst: typeof entity.gstIncluded === "boolean" ? entity.gstIncluded : typeof product.gstIncluded === "boolean" ? product.gstIncluded : null,
    unit: "EACH",
    unitPrice,
    unitAllowance,
    priceState,
    allocations,
  });
}

// Reads the lines out of a saved selection (a guidedSelection / selected_details object). An older
// single-product selection with no allocation structure is read as that product x its saved
// quantity (default 1) in an "Unallocated" location - never dropped, never rewritten on load.
export function plumbingLinesFromSelection(details = null) {
  if (!details) return [];
  const saved = details.plumbingAllocation?.lines;
  if (Array.isArray(saved)) return saved.map(plumbingLineWithTotals).filter((line) => line.quantity > 0);
  const productName = details.productName || details.selectedProduct || "";
  if (!productName && !details.productId && !details.productCode) return [];
  const quantity = Math.max(1, Math.round(numberValue(details.quantity) || 1));
  const legacyAllocations = normaliseAllocations(details.locationAllocations);
  return [plumbingLineWithTotals({
    lineId: String(details.productId || details.productCode || productName),
    productId: details.productId || "",
    productCode: details.productCode || "",
    supplierCode: details.model || "",
    productName,
    brand: details.brand || "",
    supplier: details.supplier || "",
    model: details.model || "",
    colour: details.colour || "",
    finish: details.finish || "",
    imageUrl: details.imageReference || details.imageUrl || "",
    officialProductURL: details.officialProductURL || "",
    unit: details.unit || "EACH",
    unitPrice: details.selectedPrice ?? null,
    unitAllowance: details.allowance ?? 0,
    priceState: details.priceState || details.priceStatus || "",
    allocations: legacyAllocations.length ? legacyAllocations : [{ locationKey: UNALLOCATED_LOCATION_KEY, location: "Unallocated", quantity }],
    legacySingleSelection: true,
  })];
}

// Replace (or add) one product's line; a line whose allocations are all zero is removed.
export function upsertPlumbingLine(lines = [], nextLine) {
  const computed = plumbingLineWithTotals(nextLine);
  const others = (lines || []).filter((line) => line.lineId !== computed.lineId);
  if (!computed.quantity) return others.map(plumbingLineWithTotals);
  const index = (lines || []).findIndex((line) => line.lineId === computed.lineId);
  const next = others.map(plumbingLineWithTotals);
  next.splice(index >= 0 ? index : next.length, 0, computed);
  return next;
}

export function removePlumbingLine(lines = [], lineId = "") {
  return (lines || []).filter((line) => line.lineId !== lineId).map(plumbingLineWithTotals);
}

export function formatPlumbingAllocations(allocations = [], unit = "") {
  const measured = isMeasuredUnit(unit);
  return normaliseAllocations(allocations, { unit }).map((allocation) => (
    measured ? `${allocation.location} ${allocation.quantity} ${String(unit).toUpperCase()}` : `${allocation.location} ×${allocation.quantity}`
  )).join(", ");
}

// requiredQuantity is not invented: it is set only when a real source (Takeoff / Estimate /
// Standard Inclusions) supplies it. Without one the category keeps the manual path - it is
// complete once at least one product is allocated.
export function plumbingAllocationProgress(details = null) {
  const allocation = details?.plumbingAllocation || null;
  const allocated = plumbingLinesFromSelection(details).reduce((total, line) => total + line.quantity, 0);
  const required = Math.max(0, Math.round(numberValue(allocation?.requiredQuantity)));
  return {
    required: required || null,
    requiredSource: required ? allocation?.requiredQuantitySource || "" : "",
    allocated,
    remaining: required ? Math.max(0, required - allocated) : null,
    complete: required ? allocated >= required : allocated > 0,
  };
}

export function plumbingAllocationRecord(requirement = {}, lines = [], previous = null) {
  const summary = plumbingAllocationSummary(lines);
  return {
    schemaVersion: PLUMBING_ALLOCATION_SCHEMA_VERSION,
    requirementKey: requirement.requirementKey || "",
    requirementLabel: requirement.label || "",
    requiredQuantity: previous?.requiredQuantity ?? null,
    requiredQuantitySource: previous?.requiredQuantitySource || "",
    allowanceBasis: "per_unit",
    allowanceSource: "requirement.defaultAllowance per EACH unless the product carries its own allowance",
    lines: summary.lines,
    allocatedQuantity: summary.quantity,
    allowanceTotal: summary.allowanceTotal,
    selectedTotal: summary.selectedTotal,
    variation: summary.variation,
    allPriced: summary.allPriced,
    // Flat per-location view for procurement / BOQ / trade schedules.
    locationSchedule: summary.lines.flatMap((line) => line.allocations.map((allocation) => ({
      lineId: line.lineId,
      productId: line.productId,
      productCode: line.productCode,
      supplierCode: line.supplierCode,
      productName: line.productName,
      brand: line.brand,
      location: allocation.location,
      locationKey: allocation.locationKey,
      quantity: allocation.quantity,
    }))),
  };
}
