// Client Selections > Flooring: one Product Library flooring colour (variant) per floor area,
// whole-pack ordering per colour across all its areas, and the sync to Quotation Builder,
// BOQ (built from the quotation rows) and Supplier & Procurement.
//
// A flooring area is a real location (Entry, Living, Bed 2 ...) or a measured Takeoff floor-finish
// total, each with its own net area, product colour and wastage. APPLY copies a colour + wastage
// to other areas, never their areas; afterwards every area is independent (same rule as
// Tiles & Stone "apply tile to other floor areas"). Packs are ordered per colour on the SUM of its
// areas' required area, rounded UP to whole packs - never per room, never fractional.
//
// Money: National Tiles (and most retail) prices are inc GST. Client Selections shows the supplier
// figures; the Quotation Builder carries ex GST base rates (it adds GST itself). The allowance per
// m2 comes from the project estimate's own rate for the flooring type (as Balustrades do), which
// is an ex GST quote rate, converted for the client-facing comparison.

import { DEFAULT_FLOORING_WASTAGE_PCT, FLOORING_REQUIREMENT_KEY, FLOORING_TYPES, flooringOrder, flooringType, flooringVariantPricing } from "../product-library/flooringCatalogue.js";
import { plumbingLocationKey, plumbingLocationType } from "./plumbingFixtureAllocation.js";
import { carpetEstimateRates, carpetLineDetails, measuredFlooringRooms } from "./carpetSelection.js";

export const FLOORING_SELECTION_SOURCE = "client-selections-flooring";
export const FLOORING_AREAS_SCHEMA_VERSION = "flooring-areas.v1";
const GST = 1.1;
const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;
const positive = (value) => { const number = Number(value); return Number.isFinite(number) && number > 0 ? number : 0; };
const exGst = (value) => (value === null || value === undefined ? null : Math.round((value / GST) * 10000) / 10000);

// Wet / external areas are normally tiled or concreted: offered, but not suggested for flooring.
const NOT_SUGGESTED = new Set(["bathroom", "ensuite", "powder-room", "wc", "laundry", "outdoor-wet", "outdoor-kitchen"]);
const NOT_SUGGESTED_NAMES = /garage|alfresco|patio|porch|balcony|deck|carport|pool|external/i;
// Selections-book rooms named after a trade / category are not floor areas.
const NOT_A_ROOM = /^(roof|roofing|windows?|doors?|electrical|lighting|paint|painting|plumbing|appliances|cabinetry|facade|exterior|interior|flooring|tiles?|selections?)$/i;

// Measured Takeoff floor-finish totals (Job Setup "Takeoff Mappings") that are non-tile flooring.
const TAKEOFF_FINISHES = [
  { key: "floorFinishHybridM2", label: "Hybrid floor finish (Takeoff)", flooringType: "hybrid" },
  { key: "floorFinishCarpetsM2", label: "Carpet floor finish (Takeoff)", flooringType: "carpet" },
];

export function flooringTakeoffData(workbook = {}) {
  const rows = workbook?.data?.inputDataSheet?.rows || {};
  return {
    rooms: measuredFlooringRooms(workbook),
    finishes: TAKEOFF_FINISHES.map((finish) => ({ ...finish, areaM2: round2(positive(rows?.[finish.key]?.value ?? rows?.[finish.key])) })).filter((finish) => finish.areaM2 > 0),
  };
}

let areaCounter = 0;
export function newFlooringArea({ name = "", areaM2 = "", areaSource = "manual", takeoffKey = "", flooringTypeHint = "" } = {}) {
  areaCounter += 1;
  const label = String(name || "").trim() || `Floor area ${areaCounter}`;
  return {
    id: `flooring-area-${plumbingLocationKey(label) || "area"}-${Date.now().toString(36)}-${areaCounter}`,
    name: label,
    locationKey: plumbingLocationKey(label),
    areaM2,
    areaSource,
    takeoffKey,
    flooringTypeHint,
    productId: "",
    variantId: "",
    wastagePct: DEFAULT_FLOORING_WASTAGE_PCT,
  };
}

// First visit: the project's dry rooms (areas blank until measured / entered) plus any measured
// Takeoff flooring totals. Nothing is invented: a room's area is never guessed.
export function suggestedFlooringAreas(projectLocationNames = [], takeoff = {}) {
  const known = new Map((takeoff.rooms || []).map((r) => [plumbingLocationKey(r.name), r]));
  const rooms = [...new Set([...projectLocationNames, ...(takeoff.rooms || []).map((r) => r.name)].map((name) => String(name || "").trim()).filter(Boolean))]
    .filter((name) => !NOT_SUGGESTED.has(plumbingLocationType(name)) && !NOT_SUGGESTED_NAMES.test(name) && !NOT_A_ROOM.test(name))
    .map((name) => { const r = known.get(plumbingLocationKey(name)); return { ...newFlooringArea({ name, areaM2: r?.areaM2 || "", areaSource: r?.areaM2 ? r.source : "manual", flooringTypeHint: r?.flooringType || "" }), widthMm: r?.widthMm, lengthMm: r?.lengthMm }; });
  const measured = (takeoff.finishes || []).filter((finish) => finish.flooringType !== "carpet" || !rooms.some((r) => positive(r.areaM2))).map((finish) => newFlooringArea({ name: finish.label, areaM2: finish.areaM2, areaSource: "takeoff", takeoffKey: finish.key, flooringTypeHint: finish.flooringType }));
  return [...measured, ...rooms];
}

// Re-reads Takeoff totals into areas that came from Takeoff (a builder edit to the area keeps the
// builder's figure: areaSource becomes "manual").
export function refreshTakeoffAreas(areas = [], takeoff = {}) {
  const byKey = new Map((takeoff.finishes || []).map((finish) => [finish.key, finish]));
  const rooms = new Map((takeoff.rooms || []).map((r) => [plumbingLocationKey(r.name), r]));
  return areas.map((area) => {
    if (area.areaSource === "takeoff" && byKey.has(area.takeoffKey)) return { ...area, areaM2: byKey.get(area.takeoffKey).areaM2 };
    const room = rooms.get(plumbingLocationKey(area.name));
    return room?.areaM2 && (area.areaSource !== "manual" || area.areaM2 === "") ? { ...area, areaM2: room.areaM2, areaSource: room.source, widthMm: room.widthMm, lengthMm: room.lengthMm } : area;
  });
}

// APPLY: the colour and wastage of one choice to the selected areas; their areas are untouched and
// they are not linked afterwards.
export function applyFlooringChoice(areas = [], targetIds = [], { productId = "", variantId = "", wastagePct } = {}, { now = new Date().toISOString() } = {}) {
  const targets = new Set(targetIds);
  return areas.map((area) => (targets.has(area.id) ? {
    ...area,
    productId,
    variantId,
    ...(wastagePct === undefined || wastagePct === null || wastagePct === "" ? {} : { wastagePct: Number(wastagePct) }),
    appliedAt: now,
  } : area));
}

export function clearFlooringChoice(areas = [], areaId = "") {
  return areas.map((area) => (area.id === areaId ? { ...area, productId: "", variantId: "" } : area));
}

export function flooringVariantFor(product = null, variantId = "") {
  return (product?.variants || []).find((variant) => variant.variantId === variantId) || null;
}

const areaWastage = (area) => (Number.isFinite(Number(area.wastagePct)) && Number(area.wastagePct) >= 0 && area.wastagePct !== "" ? Number(area.wastagePct) : DEFAULT_FLOORING_WASTAGE_PCT);

// The project estimate's rate for a flooring type: the first priced row in that type's own
// estimate section (e.g. HYBRID FLOORING -> "Hybrid Standard"), an ex GST base rate per m2.
export function flooringAllowanceFromQuotation(quotation = {}, typeKey = "") {
  const type = flooringType(typeKey);
  if (!type) return { allowancePerM2ExGst: 0, source: "" };
  const base = (name) => String(name || "").replace(/\s*\(\d+\)\s*$/, "").trim().toUpperCase();
  const entry = Object.entries(quotation || {}).find(([name]) => base(name) === type.quoteSection);
  const rate = (row) => { const value = Number(String(row?.manualRate || row?.excelRate || row?.rate || "").replace(/[^0-9.]/g, "")); return Number.isFinite(value) && value > 0 ? value : 0; };
  const rows = (entry?.[1]?.rows || []).filter((row) => row.source !== FLOORING_SELECTION_SOURCE && rate(row) > 0);
  const match = rows.find((row) => /standard|entry|builder|base/i.test(row.item || "")) || rows[0];
  return match ? { allowancePerM2ExGst: round2(rate(match)), source: `${entry[0]}: ${match.item}` } : { allowancePerM2ExGst: 0, source: "" };
}

// The allowance used for a flooring type: a builder-entered MATERIAL allowance per m2 (ex GST,
// saved with the selection) when set, otherwise the estimate's own rate for that type. An
// estimate row may be an all-in supply & install rate, so the builder can state the material part.
export function flooringAllowanceResolver(quotation = {}, overrides = {}) {
  return (typeKey) => {
    const value = overrides?.[typeKey];
    if (value !== undefined && value !== null && value !== "" && Number.isFinite(Number(value)) && Number(value) >= 0) {
      return { allowancePerM2ExGst: round2(Number(value)), source: "Builder material allowance (ex GST)" };
    }
    return flooringAllowanceFromQuotation(quotation, typeKey);
  };
}

// One line per selected colour: its areas, whole packs on the summed required area, cost at the
// regular (estimating) price, allowance on the NET area, variation.
export function flooringLines(areas = [], { productById = () => null, allowanceFor = () => ({ allowancePerM2ExGst: 0, source: "" }), carpetOptions = {}, carpetRates = {} } = {}) {
  const lines = new Map();
  for (const area of areas) {
    const net = positive(area.areaM2);
    if (!area.variantId || !net) continue;
    const product = productById(area.productId) || area.productSnapshot;
    const variant = flooringVariantFor(product, area.variantId) || area.variantSnapshot || null;
    if (!variant) continue;
    const isCarpet = product?.attributes?.flooringType === "carpet" || variant.flooringType === "carpet";
    const wastagePct = isCarpet ? 0 : areaWastage(area);
    const required = net * (1 + wastagePct / 100);
    if (!lines.has(area.variantId)) lines.set(area.variantId, { area, product, variant, rooms: [], net: 0, required: 0 });
    const line = lines.get(area.variantId);
    line.rooms.push({ areaId: area.id, name: area.name, netAreaM2: round2(net), wastagePct: isCarpet ? null : wastagePct, requiredAreaM2: isCarpet ? null : round2(required), areaSource: area.areaSource, widthMm: area.widthMm, lengthMm: area.lengthMm });
    line.net += net;
    line.required += required;
  }
  return [...lines.values()].map(({ product, variant, rooms, net, required }) => {
    const pricing = flooringVariantPricing(variant);
    // Packs on the summed required area (wastage already applied per area), never per room.
    const order = flooringOrder(required, { wastagePct: 0, packCoverageM2: pricing.packCoverageM2 });
    const typeKey = product?.attributes?.flooringType || variant.flooringType || "";
    const type = flooringType(typeKey);
    const materialCost = order.packs
      ? (pricing.regularPricePerPack ? round2(order.packs * pricing.regularPricePerPack) : round2(order.purchasedAreaM2 * pricing.regularPricePerM2))
      : (pricing.regularPricePerM2 ? round2(required * pricing.regularPricePerM2) : null);
    const allowance = allowanceFor(typeKey);
    const allowancePerM2 = round2(allowance.allowancePerM2ExGst * GST);
    const allowanceTotal = round2(allowancePerM2 * net);
    return {
      lineId: variant.variantId,
      productId: product?.productId || product?.id || "",
      productCode: product?.productCode || "",
      variantId: variant.variantId,
      sku: variant.sku || "",
      supplier: product?.supplier || "",
      brand: product?.brand || product?.manufacturer || "",
      range: product?.range || product?.attributes?.collection || "",
      colour: variant.colour || variant.variantName || "",
      productName: variant.productName || product?.productName || "",
      flooringType: typeKey,
      flooringTypeLabel: type?.label || "",
      quoteSection: type?.quoteSection || "FLOORCOVERINGS",
      imageUrl: variant.imageUrl || product?.primaryImageUrl || "",
      productUrl: variant.productUrl || "",
      dimensions: [variant.widthMm, variant.lengthMm].every(Boolean) ? `${variant.widthMm} x ${variant.lengthMm}${variant.thicknessMm ? ` x ${variant.thicknessMm}mm` : "mm"}` : "",
      rooms,
      netAreaM2: round2(net),
      wastagePct: rooms.length && rooms.every((room) => room.wastagePct === rooms[0].wastagePct) ? rooms[0].wastagePct : round2((required / net - 1) * 100),
      requiredAreaM2: round2(required),
      packCoverageM2: pricing.packCoverageM2,
      packs: order.packs,
      purchasedAreaM2: order.purchasedAreaM2,
      regularPricePerM2: pricing.regularPricePerM2,
      regularPricePerPack: pricing.regularPricePerPack,
      salePricePerM2: pricing.salePricePerM2,
      priceBasis: variant.priceBasis || product?.attributes?.priceBasis || "",
      priceRetrievedAt: variant.priceRetrievedAt || "",
      materialCost,
      priced: materialCost !== null,
      allowancePerM2,
      allowancePerM2ExGst: allowance.allowancePerM2ExGst,
      allowanceSource: allowance.source,
      allowanceTotal,
      variation: materialCost === null ? null : round2(materialCost - allowanceTotal),
      ...(typeKey === "carpet" ? carpetLineDetails({ product, variant, rooms, net, options: carpetOptions[variant.variantId], estimateRates: carpetRates }) : {}),
    };
  });
}

export function formatFlooringRooms(rooms = []) {
  return rooms.map((room) => `${room.name} ${room.netAreaM2.toFixed(2)}m²`).join(", ");
}

// The single human-readable order line used by the quotation row, BOQ and procurement.
export function flooringOrderText(line = {}) {
  if (line.flooringType === "carpet") return `Net ${line.netAreaM2.toFixed(2)}m²; roll width ${line.rollWidthM || "not published"}m; estimated order ${line.estimatedOrderAreaM2 === null ? "not calculated" : `${line.estimatedOrderAreaM2.toFixed(2)}m²`}; ${line.orderQuantityStatus}`;
  const parts = [`Net ${line.netAreaM2.toFixed(2)}m²`, `wastage ${line.wastagePct}%`, `required ${line.requiredAreaM2.toFixed(2)}m²`];
  if (line.packs) parts.push(`${line.packs} packs x ${line.packCoverageM2}m² = ${Number(line.purchasedAreaM2).toFixed(2)}m² purchased`);
  else parts.push("pack coverage not published - order by m²");
  return parts.join(", ");
}

export function flooringAreaStatus(areas = []) {
  const assigned = areas.filter((area) => area.variantId);
  const measured = assigned.filter((area) => positive(area.areaM2));
  return { total: areas.length, assigned: assigned.length, measured: measured.length, complete: assigned.length > 0 && measured.length === assigned.length };
}

// Client Selections record (selected_details) for the Flooring requirement.
export function flooringSelectionPatch(requirement = {}, areas = [], { productById = () => null, allowanceFor, allowanceOverrides = {}, carpetOptions = {}, carpetRates = {}, projectId = "", organisationId = "", now = new Date().toISOString() } = {}) {
  const lines = flooringLines(areas, { productById, allowanceFor, carpetOptions, carpetRates });
  // A snapshot of each chosen colour travels with its area, so a later catalogue change never
  // silently empties a saved selection.
  const savedAreas = areas.map((area) => {
    const variant = area.variantId ? (flooringVariantFor(productById(area.productId), area.variantId) || area.variantSnapshot || null) : null;
    const product = productById(area.productId) || area.productSnapshot;
    const productSnapshot = product ? { productId: product.productId, productCode: product.productCode, brand: product.brand, manufacturer: product.manufacturer, supplier: product.supplier, range: product.range, attributes: product.attributes } : null;
    return { ...area, productSnapshot, variantSnapshot: variant ? { ...variant, specs: undefined, gallery: undefined, priceHistory: undefined, description: undefined } : null };
  });
  const status = flooringAreaStatus(savedAreas);
  const selectedTotal = round2(lines.reduce((total, line) => total + ((line.flooringType === "carpet" ? line.selectedCost : line.materialCost) || 0), 0));
  const allowanceTotal = round2(lines.reduce((total, line) => total + line.allowanceTotal, 0));
  const unpriced = lines.some((line) => !line.priced);
  const variationPending = unpriced || lines.some((line) => line.variation === null);
  const netAreaM2 = round2(lines.reduce((total, line) => total + line.netAreaM2, 0));
  const summary = lines.length
    ? lines.map((line) => `${line.brand} ${line.range} ${line.colour} - ${line.rooms.map((room) => room.name).join(", ")}`).join("; ")
    : "No flooring assigned";
  return {
    selectedProduct: summary,
    description: summary,
    allowanceAmount: allowanceTotal,
    selectedCost: selectedTotal,
    upgradeCost: variationPending ? null : round2(selectedTotal - allowanceTotal),
    included: false,
    status: lines.length ? "selected" : "pending",
    guidedSelection: lines.length ? {
      source: "guided_client_selections",
      projectId,
      organisationId,
      area: requirement.areaKey,
      room: requirement.areaLabel,
      requirementKey: requirement.requirementKey || FLOORING_REQUIREMENT_KEY,
      requirementLabel: requirement.label || "Flooring",
      productName: summary,
      selectedProduct: summary,
      unit: "M2",
      quantity: netAreaM2,
      allowance: allowanceTotal,
      selectedPrice: selectedTotal,
      selectedTotal,
      variation: variationPending ? null : round2(selectedTotal - allowanceTotal),
      variationPending,
      priceState: unpriced ? "Price Pending" : "Current Price",
      schemaVersion: FLOORING_AREAS_SCHEMA_VERSION,
      flooringAreas: savedAreas,
      flooringLines: lines,
      flooringStatus: status,
      flooringAllowanceOverrides: allowanceOverrides,
      carpetOptions,
      carpetRates,
      savedAt: now,
    } : { requirementKey: requirement.requirementKey || FLOORING_REQUIREMENT_KEY, schemaVersion: FLOORING_AREAS_SCHEMA_VERSION, flooringAreas: savedAreas, flooringLines: [], flooringStatus: status, flooringAllowanceOverrides: allowanceOverrides, carpetOptions, carpetRates, savedAt: now },
  };
}

function flooringSelectionRow(book = {}) {
  return (book?.rooms || []).flatMap((room) => room.rows || []).find((entry) => entry?.guidedSelection?.requirementKey === FLOORING_REQUIREMENT_KEY) || null;
}

// Quotation Builder + Supplier & Procurement. One row per selected colour inside that flooring
// type's EXISTING estimate section (HYBRID FLOORING, VINYL FLOORING ...), id flooring:<variantId>,
// so a change updates the row instead of adding another. The estimate's own allowance rows are
// never altered or removed. Rows this connector wrote earlier for colours no longer selected are
// removed. The BOQ reads these rows.
export function connectFlooringSelectionsToQuotation(workbook = {}, book = {}, { productById = () => null } = {}) {
  const row = flooringSelectionRow(book);
  const areas = row?.guidedSelection?.flooringAreas || [];
  const hadRows = Object.values(workbook.quotation || {}).some((section) => (section.rows || []).some((item) => item.source === FLOORING_SELECTION_SOURCE));
  const hadItems = (workbook.procurement?.items || []).some((item) => item.source === FLOORING_SELECTION_SOURCE);
  if (!areas.length && !hadRows && !hadItems) return workbook;
  const restoredQuotation = Object.fromEntries(Object.entries(workbook.quotation || {}).map(([name, section]) => [name, { ...section, rows: (section.rows || []).map((item) => item.carpetAllocation ? { ...item, ...item.carpetAllocation.original, carpetAllocation: undefined } : item) }]));
  const allowanceFor = flooringAllowanceResolver(restoredQuotation, row?.guidedSelection?.flooringAllowanceOverrides || {});
  const carpetRates = carpetEstimateRates(restoredQuotation);
  const lines = flooringLines(areas, { productById, allowanceFor, carpetOptions: row?.guidedSelection?.carpetOptions || {}, carpetRates });
  const previousRows = Object.values(workbook.quotation || {}).flatMap((section) => section.rows || []);
  const quotation = Object.fromEntries(Object.entries(restoredQuotation).map(([name, section]) => [name, { ...section, rows: (section.rows || []).filter((item) => item.source !== FLOORING_SELECTION_SOURCE) }]));
  // Replace the selected net area of an existing carpet allowance, retaining any unallocated
  // balance and restoring the original quantity when selections are cleared. Never add both costs.
  const allocatedCarpetNet = lines.filter((line) => line.flooringType === "carpet").reduce((total, line) => total + line.netAreaM2, 0);
  if (allocatedCarpetNet) for (const section of Object.values(quotation)) section.rows = section.rows.map((item) => {
    if (!carpetRates.sourceRowIds?.includes(item.id) || !/^(m2|m²)$/i.test(item.unit || "")) return item;
    const originalNet = positive(item.quantity ?? item.qty);
    if (!originalNet) return item;
    const remaining = round2(Math.max(0, originalNet - allocatedCarpetNet));
    const fields = ["qty", "quantity", "autoQuantity", "quantityManualOverride", "cost", "importedCost"];
    return { ...item, qty: remaining, quantity: remaining, autoQuantity: false, quantityManualOverride: true, cost: "", importedCost: "", carpetAllocation: { netAreaM2: allocatedCarpetNet, original: Object.fromEntries(fields.map((key) => [key, item[key] ?? ""])) } };
  });
  const base = (name) => String(name || "").replace(/\s*\(\d+\)\s*$/, "").trim().toUpperCase();
  for (const line of lines) {
    const sectionName = Object.keys(quotation).find((name) => base(name) === line.quoteSection) || line.quoteSection;
    const id = `flooring:${line.variantId}`;
    const previous = previousRows.find((item) => item.id === id) || {};
    const item = `${line.supplier} - ${line.brand !== line.supplier ? `${line.brand} ` : ""}${line.range} ${line.colour} ${line.flooringTypeLabel} (${line.sku})`.replace(/\s+/g, " ");
    const description = `${item}. ${line.dimensions ? `${line.dimensions}. ` : ""}Locations: ${formatFlooringRooms(line.rooms)}. ${flooringOrderText(line)}.`;
    const section = quotation[sectionName] || { collapsed: true, rows: [] };
    section.rows = [...(section.rows || []), {
      ...previous,
      id,
      source: FLOORING_SELECTION_SOURCE,
      section: sectionName,
      item,
      rawText: item,
      description,
      unit: "M2",
      // Purchased (whole-pack) coverage x price per m2 = packs x pack price.
      qty: line.flooringType === "carpet" ? line.netAreaM2 : line.purchasedAreaM2 ?? line.requiredAreaM2,
      quantity: line.flooringType === "carpet" ? line.netAreaM2 : line.purchasedAreaM2 ?? line.requiredAreaM2,
      excelRate: line.flooringType === "carpet" ? (line.selectedCostExGst ?? line.internalEstimateExGst) === null ? "" : (line.selectedCostExGst ?? line.internalEstimateExGst) / line.netAreaM2 : line.regularPricePerM2 === null ? "" : exGst(line.regularPricePerM2),
      manualRate: line.flooringType !== "carpet" && previous.productId === line.productId && previous.variantId === line.variantId ? (previous.manualRate ?? "") : "",
      sourceOfRate: "client-selection",
      priceStatus: line.priced ? "Current Price" : line.flooringType === "carpet" ? "Supplier quote required" : "Price pending",
      ...(line.flooringType === "carpet" ? { quoteRequired: !line.supplierQuote, costPending: line.selectedCostExGst === null } : {}),
      rateBasis: line.flooringType === "carpet" ? line.priced ? `Retailer quote ${line.supplierQuote.quoteDate}; material on order area, underlay/install on net area; total allocated per net m², ex GST` : "Internal estimating allowance only, ex GST; retailer quote and cutting plan required" : `${line.priceBasis || "Supplier price"} - quoted ex GST${line.priceRetrievedAt ? `, retrieved ${line.priceRetrievedAt.slice(0, 10)}` : ""}`,
      productId: line.productId,
      productCode: line.productCode,
      variantId: line.variantId,
      sku: line.sku,
      model: line.sku,
      productName: line.productName,
      brand: line.brand,
      supplier: line.supplier,
      colour: line.colour,
      finish: line.colour,
      flooringType: line.flooringType,
      manufacturer: line.manufacturer,
      fibre: line.fibre,
      carpetCosts: line.flooringType === "carpet" ? { estimate: line.estimateRates, supplierQuote: line.supplierQuote, selectedCostExGst: line.selectedCostExGst, internalEstimateExGst: line.internalEstimateExGst, variationExGst: line.variationExGst } : undefined,
      productImageUrl: line.imageUrl,
      locations: formatFlooringRooms(line.rooms),
      locationSchedule: line.rooms.map((room) => ({ location: room.name, quantity: room.netAreaM2, unit: "M2" })),
      flooringOrder: { netAreaM2: line.netAreaM2, wastagePct: line.wastagePct, requiredAreaM2: line.requiredAreaM2, estimatedOrderAreaM2: line.estimatedOrderAreaM2, rollWidthM: line.rollWidthM, cuttingPlan: line.cuttingPlan, packCoverageM2: line.packCoverageM2, packs: line.packs, purchasedAreaM2: line.purchasedAreaM2 },
      // The original estimate allowance stays in its own row; these record the comparison.
      allowancePerUnit: line.allowancePerM2ExGst,
      allowanceUnit: "M2 net",
      allowanceSource: line.allowanceSource,
      allowanceTotal: round2(line.allowancePerM2ExGst * line.netAreaM2),
      variation: line.flooringType === "carpet" ? line.variationExGst : line.materialCost === null ? null : round2(exGst(line.materialCost) - line.allowancePerM2ExGst * line.netAreaM2),
      lineType: "Standard rate item",
      included: true,
      active: true,
      autoQuantity: false,
      productLibrarySnapshot: { ...line, catalogueOwner: "product-library" },
    }];
    quotation[sectionName] = section;
  }

  const procurement = workbook.procurement || {};
  const items = (procurement.items || []).filter((item) => item.source !== FLOORING_SELECTION_SOURCE);
  for (const line of lines) {
    const id = `flooring:${line.variantId}`;
    const previous = (procurement.items || []).find((item) => item.id === id && item.variantId === line.variantId) || {};
    const ordered = line.packs ? { qty: line.packs, unit: "PACK" } : { qty: line.requiredAreaM2, unit: "M2" };
    items.push({
      ...previous,
      id,
      source: FLOORING_SELECTION_SOURCE,
      sectionName: Object.keys(quotation).find((name) => base(name) === line.quoteSection) || line.quoteSection,
      itemDescription: `${line.brand} ${line.range} ${line.colour} ${line.flooringTypeLabel}`.replace(/\s+/g, " "),
      productId: line.productId,
      productCode: line.productCode,
      variantId: line.variantId,
      sku: line.sku,
      colour: line.colour,
      supplier: line.supplier,
      manufacturer: line.manufacturer,
      brand: line.brand,
      range: line.range,
      fibre: line.fibre,
      estimatedOrderAreaM2: line.estimatedOrderAreaM2,
      rollWidthM: line.rollWidthM,
      orderQuantityStatus: line.orderQuantityStatus,
      supplierQuote: line.supplierQuote,
      selectedCostExGst: line.selectedCostExGst,
      internalEstimateExGst: line.internalEstimateExGst,
      variationExGst: line.variationExGst,
      ...ordered,
      packs: line.packs,
      packCoverageM2: line.packCoverageM2,
      purchasedAreaM2: line.purchasedAreaM2,
      netAreaM2: line.netAreaM2,
      wastagePct: line.wastagePct,
      requiredAreaM2: line.requiredAreaM2,
      estimatedRate: line.flooringType === "carpet" ? line.selectedCostExGst !== null && line.estimatedOrderAreaM2 > 0 ? line.selectedCostExGst / line.estimatedOrderAreaM2 : null : line.packs && line.regularPricePerPack ? exGst(line.regularPricePerPack) : exGst(line.regularPricePerM2),
      materialRateExGst: line.flooringType === "carpet" ? line.supplierQuote?.materialPerM2ExGst ?? null : undefined,
      estimatedTotal: line.flooringType === "carpet" ? line.selectedCostExGst : line.materialCost === null ? null : exGst(line.materialCost),
      estimatedMaterialTotal: line.materialCost === null ? null : exGst(line.materialCost),
      rateBasis: line.flooringType === "carpet" ? line.supplierQuote ? "Retailer quoted material, underlay, installation and other costs, ex GST; total allocated per ordered m². Component rates are retained with the retailer quote. Confirm cutting plan before ordering." : "Supplier quote required; no purchasing quantity or supplier cost assumed" : "Supplier price ex GST - confirm with supplier before ordering",
      procurementCategory: "Flooring",
      ...(line.flooringType === "carpet" ? { quoteRowId: id, flooringType: "carpet", quoteRequired: !line.supplierQuote, quantityPending: line.estimatedOrderAreaM2 === null, costPending: line.selectedCostExGst === null } : {}),
      locationSchedule: line.rooms.map((room) => ({ location: room.name, quantity: room.netAreaM2, unit: "M2" })),
      orderStatus: previous.orderStatus || "Not Started",
      notes: `${formatFlooringRooms(line.rooms)} - ${flooringOrderText(line)}`,
    });
  }
  // Drop a flooring type section this connector created that is now empty.
  for (const type of FLOORING_TYPES) if (quotation[type.quoteSection] && !(quotation[type.quoteSection].rows || []).length && !(workbook.quotation || {})[type.quoteSection]) delete quotation[type.quoteSection];
  return { ...workbook, quotation, procurement: { ...procurement, items } };
}
