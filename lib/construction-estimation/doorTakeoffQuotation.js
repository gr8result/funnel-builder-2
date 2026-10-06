// AI Plan Takeoff -> Quotation Builder purchasing rows and labour quantities for internal doors,
// door furniture, door jambs, cavity sliding door cages and window installation.
//
//   Takeoff (createInternalDoorPurchaseSchedule / createJobSetupWindowSchedule)
//     + Client Selections (workbook.clientSelectionsBook - the chosen canonical product IDs)
//     + Product Library (catalogueService.getCategoryProducts - the builder's effective catalogue)
//   -> generated quotation rows (never persisted) + quantities for the existing labour rows.
//
// Only a job with a Takeoff (placedOpenings) is affected; without one this returns nothing and every
// existing row keeps its current quantity source. Quantities are always derived from the Takeoff
// schedules - nothing here is specific to one job.

import { createInternalDoorPurchaseSchedule, createJobSetupWindowSchedule } from "../../components/construction-estimation/ai-plan-takeoff/takeoffSchedule.js";
import { getCategoryProducts, toCanonicalProductContract } from "../product-library/catalogueService.js";
import { resolveProductPrice } from "../product-library/catalogueModel.js";
import { productCategory } from "../product-library/productCategoryRegistry.js";

export const DOOR_TAKEOFF_SOURCE = "takeoff-door-quotation";
export const PRICE_REQUIRED_LABEL = "PRODUCT / PRICE REQUIRED";
// Quantity keys for the existing labour rows (see doorTakeoffQuantityKey below).
export const DOOR_TAKEOFF_KEYS = Object.freeze({
  cavityCageInstall: "takeoffCavityCageCount",
  cavityDoorHang: "takeoffCavitySliderDoorCount",
  singleDoorHang: "takeoffSingleHingedDoorCount",
  doubleDoorHang: "takeoffDoubleDoorSetCount",
  superseded: "takeoffSupersededCageMaterial",
});
const JAMB_KEYS = { 70: "jamb90x19StockLengthsEach", 90: "jamb110x19StockLengthsEach" };
const JAMB_LABELS = { 70: "90 x 19 INTERNAL DOOR JAMBS (70mm WALLS) - 5.4m LENGTHS", 90: "110 x 19 INTERNAL DOOR JAMBS (90mm WALLS) - 5.4m LENGTHS" };

const number = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const sum = (rows, field = "quantity") => rows.reduce((total, row) => total + number(row[field]), 0);
const exGst = (price, gstIncluded) => (price == null ? null : gstIncluded ? Math.round((price / 1.1) * 10000) / 10000 : price);

function takeoffJob(workbook = {}) {
  const job = workbook?.aiPlanTakeoffJob || workbook?.takeoffEngine?.aiPlanTakeoffJob || null;
  // A Takeoff with no measured openings does not own window/door quantities yet (Job Setup keeps them).
  return job && typeof job === "object" && Array.isArray(job.placedOpenings) && job.placedOpenings.length > 0 ? job : null;
}

function selectionRows(book = {}, requirementKey = "") {
  return (book?.rooms || []).flatMap((room) => room?.rows || [])
    .map((row) => row?.guidedSelection)
    .filter((selection) => selection?.requirementKey === requirementKey && (selection.productId || selection.productCode));
}

function findProduct(products = [], reference = "") {
  if (!reference) return null;
  return products.find((product) => product.productId === reference || product.productCode === reference) || null;
}

// "2040 x 720 x 35 mm" -> exact height/width match only ("Up to ..." allowances never match).
function sizeOptionFor(product = {}, widthMm, heightMm) {
  const options = [...(product.attributes?.sizeOptions || []), ...(product.attributes?.sizePrices || []).map((entry) => entry.size)];
  return options.find((option) => {
    const match = String(option || "").match(/^\s*(\d+)\s*x\s*(\d+)/i);
    return match && Number(match[1]) === heightMm && Number(match[2]) === widthMm;
  }) || "";
}

// Builder override -> size/master price -> PRICE REQUIRED (resolveProductPrice), then ex GST
// because Quotation Builder adds GST itself. Never $0 for a missing price.
function productRate(product, size = "") {
  const resolved = resolveProductPrice(product, { size });
  if (resolved.priceRequired || resolved.price == null) return { rate: null, status: "quote_required", source: "" };
  if (size && product.attributes?.sizePrices?.length && resolved.size && resolved.size !== size && product.builderPrice == null) {
    return { rate: null, status: "quote_required", source: "" };
  }
  return { rate: exGst(resolved.price, resolved.gstIncluded ?? product.gstIncluded ?? true), status: "current", source: resolved.source || "" };
}

function productFields(product) {
  if (!product) return {};
  const canonical = toCanonicalProductContract(product);
  return {
    canonicalProductId: product.productId,
    productId: product.productId,
    productCode: product.productCode,
    productName: product.productName,
    productDescription: product.description,
    brand: product.brand || product.manufacturer || "",
    manufacturer: product.manufacturer || product.brand || "",
    supplier: product.supplier || "",
    sku: product.sku || "",
    model: product.model || "",
    range: product.range || "",
    productImageUrl: product.primaryImageUrl || "",
    thumbnailUrl: product.thumbnailUrl || product.primaryImageUrl || "",
    productLibraryFamilyKey: product.familyKey,
    productLibrarySnapshot: { productId: product.productId, productCode: product.productCode, familyKey: product.familyKey, catalogueOwner: canonical.catalogueOwner },
  };
}

function headingRow(section, id, item) {
  return {
    id: `${DOOR_TAKEOFF_SOURCE}:heading:${id}`, section, item, rawText: item, values: [item],
    quantity: "", importedQuantity: "", quantityKey: "", unit: "", formulas: {},
    lineType: "Appliance heading", applianceHeadingLevel: 2, active: true,
    generatedTakeoffProductRow: true, source: DOOR_TAKEOFF_SOURCE,
  };
}

function productRow({ section, id, item, quantityKey, unit = "EACH", product = null, rate = null, notes = "", description = "", purchasingDetails = {}, takeoffSources = [] }) {
  const priced = rate != null;
  return {
    id: `${DOOR_TAKEOFF_SOURCE}:${id}`,
    section,
    item,
    rawText: item,
    values: [item],
    quantity: "",
    importedQuantity: "",
    quantityKey,
    unit,
    excelRate: priced ? rate : "",
    supplierCatalogueRate: priced ? rate : "",
    quotedSupplierRate: "",
    manualRate: "",
    supplierQuote: "",
    sourceOfRate: priced ? "Product Library" : PRICE_REQUIRED_LABEL,
    quoteRequired: !priced,
    priceStatus: priced ? "Current Price" : PRICE_REQUIRED_LABEL,
    lineType: priced ? "Standard rate item" : "Quote required",
    formulas: {},
    active: true,
    included: true,
    autoQuantity: true,
    quantityManualOverride: false,
    generatedTakeoffProductRow: true,
    productLibraryTakeoffRow: true,
    source: DOOR_TAKEOFF_SOURCE,
    ...productFields(product),
    description: description || product?.description || "",
    purchasingDetails: {
      quantityKey,
      unit,
      productId: product?.productId || "",
      productCode: product?.productCode || "",
      manufacturer: product?.manufacturer || product?.brand || "",
      sku: product?.sku || "",
      description: description || product?.description || item,
      resolvedUnitRate: priced ? rate : null,
      priceStatus: priced ? "current" : "price_required",
      ...purchasingDetails,
    },
    takeoffSources,
    notes,
  };
}

// ---------------------------------------------------------------------------------------------

function internalDoorRows(schedule, { products, selected, defaultProduct, quantities }) {
  const section = "FIX OUT";
  // Leaves, not openings: a double set is two leaves of half its width; cavity sliders hang an
  // ordinary leaf (their cage is ordered separately); robe sliders are a separate product stream.
  const leaves = new Map();
  for (const opening of schedule.openings) {
    if (opening.purchaseType === "robe") continue;
    const leafType = opening.purchaseType === "barn" ? "barn" : "standard";
    const leafWidth = opening.purchaseType === "double" ? Math.round(opening.widthMm / 2) : opening.widthMm;
    const leafCount = opening.quantity * (opening.purchaseType === "double" ? 2 : 1);
    const key = `${leafType}:${leafWidth}x${opening.heightMm}`;
    const group = leaves.get(key) || { leafType, widthMm: leafWidth, heightMm: opening.heightMm, quantity: 0, breakdown: {}, sources: [] };
    group.quantity += leafCount;
    group.breakdown[opening.purchaseType] = (group.breakdown[opening.purchaseType] || 0) + leafCount;
    group.sources.push({ openingId: opening.id, level: opening.level, doorType: opening.purchaseType, openings: opening.quantity, leaves: leafCount, wallThicknessMm: opening.wallThicknessMm });
    leaves.set(key, group);
  }
  const groups = [...leaves.values()].sort((a, b) => (a.leafType === b.leafType ? a.widthMm - b.widthMm || a.heightMm - b.heightMm : a.leafType === "standard" ? -1 : 1));
  return groups.map((group) => {
    const quantityKey = `takeoffInternalDoor:${group.leafType}:${group.widthMm}x${group.heightMm}`;
    quantities[quantityKey] = group.quantity;
    const candidate = group.leafType === "barn"
      ? (selected && /barn/i.test(`${selected.range} ${selected.productName}`) ? selected : null)
      : (selected || defaultProduct);
    const size = candidate ? sizeOptionFor(candidate, group.widthMm, group.heightMm) : "";
    const sizeAvailable = Boolean(candidate && (size || !(candidate.attributes?.sizeOptions || []).length));
    const { rate } = sizeAvailable ? productRate(candidate, size) : { rate: null };
    const product = sizeAvailable ? candidate : null;
    const label = group.leafType === "barn" ? "BARN DOOR" : "INTERNAL DOOR";
    const breakdown = Object.entries(group.breakdown).map(([type, count]) => `${count} ${type === "double" ? "leaves from double sets" : type === "cavity" ? "cavity slider leaves" : type}`).join(", ");
    const notes = [
      `Takeoff: ${breakdown}.`,
      product ? `${selected && product === selected ? "Client Selection" : "Builder default"}: ${product.productName}${size ? ` (${size})` : ""}.` : "",
      !product ? `${PRICE_REQUIRED_LABEL}: ${candidate ? `${candidate.productName} is not available in ${group.widthMm} x ${group.heightMm}` : `select a ${label.toLowerCase()} product`}.` : "",
      product && rate == null ? `${PRICE_REQUIRED_LABEL}: no published price for this size.` : "",
    ].filter(Boolean).join(" ");
    return productRow({
      section, id: `internal-door:${group.leafType}:${group.widthMm}x${group.heightMm}`,
      item: `${group.widthMm} x ${group.heightMm} ${product ? `${product.range || product.productName} ` : ""}${label}`.toUpperCase(),
      quantityKey, product, rate, notes,
      description: product ? `${product.productName}${size ? ` - ${size}` : ""}` : `${group.widthMm} x ${group.heightMm} ${label.toLowerCase()} leaf`,
      purchasingDetails: { doorWidthMm: group.widthMm, doorHeightMm: group.heightMm, size: size || `${group.heightMm} x ${group.widthMm}`, leafType: group.leafType, breakdown: group.breakdown },
      takeoffSources: group.sources,
    });
  });
}

function hardwareKind(selection = {}, product = null) {
  const text = [selection.productName, selection.range, selection.function, product?.productName, product?.range, product?.attributes?.hardwareType].filter(Boolean).join(" ");
  if (/cavity|sliding/i.test(text)) return "cavity";
  const fn = String(selection.function || product?.attributes?.function || "").toLowerCase();
  if (/dummy/.test(fn)) return "dummy";
  return "hinged";
}

// Allocates Takeoff door counts to the door furniture selected in Client Selections. A selection
// with an explicit quantity (> 1) keeps it; the remaining doors of its kind go to the single
// selection of that kind without one. Several unquantified selections of one kind are never each
// given the whole count - their quantity is left for the builder to allocate.
function doorFurnitureRows(schedule, { products, selections, quantities }) {
  const section = "FIX OUT";
  const count = (type) => sum(schedule.openings.filter((opening) => opening.purchaseType === type));
  const pools = { hinged: count("single") + count("double"), dummy: count("double"), cavity: count("cavity") };
  const poolLabels = { hinged: "hinged internal doors (singles + active leaf of double sets)", dummy: "double door sets (inactive leaf)", cavity: "cavity sliding doors" };
  const entries = selections.map((selection, index) => {
    const product = findProduct(products, selection.productId) || findProduct(products, selection.productCode);
    return { selection, product, index, kind: hardwareKind(selection, product), explicit: number(selection.quantity) > 1 ? number(selection.quantity) : null };
  });
  return entries.map((entry) => {
    const sameKind = entries.filter((other) => other.kind === entry.kind);
    const explicitTotal = sum(sameKind.filter((other) => other.explicit != null), "explicit");
    const unquantified = sameKind.filter((other) => other.explicit == null);
    let quantity = entry.explicit;
    let allocationNote = entry.explicit != null ? "Quantity set in Client Selections." : "";
    if (quantity == null) {
      if (unquantified.length === 1) {
        quantity = Math.max(0, pools[entry.kind] - explicitTotal);
        allocationNote = `Takeoff: ${pools[entry.kind]} ${poolLabels[entry.kind]}${explicitTotal ? ` less ${explicitTotal} allocated to other selections` : ""}.`;
      } else {
        quantity = null;
        allocationNote = `QTY ALLOCATION REQUIRED: ${Math.max(0, pools[entry.kind] - explicitTotal)} ${poolLabels[entry.kind]} to allocate across ${unquantified.length} selections.`;
      }
    }
    const quantityKey = `takeoffDoorFurniture:${entry.index}:${entry.selection.productId || entry.selection.productCode}`;
    quantities[quantityKey] = quantity ?? 0;
    const selection = entry.selection;
    let { rate } = entry.product ? productRate(entry.product) : { rate: null };
    if (!entry.product && selection.selectedPrice != null) rate = exGst(number(selection.selectedPrice), selection.priceIncludesGst);
    const fn = selection.function || entry.product?.attributes?.function || "";
    const name = entry.product?.productName || selection.productName || "Door furniture";
    return productRow({
      section, id: `door-furniture:${entry.index}:${selection.productId || selection.productCode}`,
      item: `${name}${fn ? ` - ${fn}` : ""}`.toUpperCase(), quantityKey, product: entry.product, rate,
      notes: [allocationNote, rate == null ? `${PRICE_REQUIRED_LABEL}: no published price.` : ""].filter(Boolean).join(" "),
      description: [entry.product?.description || selection.description, selection.finish].filter(Boolean).join(" - "),
      purchasingDetails: { function: fn, finish: selection.finish || "", allocation: entry.kind, allocationRequired: quantity == null },
    });
  });
}

function jambRows(schedule, { quantities }) {
  const section = "FIX OUT";
  return [70, 90].map((wall) => {
    const key = JAMB_KEYS[wall];
    const contributing = schedule.jambTrace.filter((trace) => trace.jambBucket === key);
    quantities[key] = sum(contributing, "contributedLengths");
    return productRow({
      section, id: `jamb:${wall}`, item: JAMB_LABELS[wall], quantityKey: key, unit: "LENGTH",
      notes: `Takeoff: ${contributing.length} internal door openings in ${wall}mm walls (cavity sliders excluded - jamb supplied with the cage). ${PRICE_REQUIRED_LABEL}: no jamb product in Product Library.`,
      description: `${wall === 70 ? "90 x 19" : "110 x 19"} jamb stock, 5.4m lengths, for ${wall}mm wall internal doors`,
      purchasingDetails: { wallThicknessMm: wall, jambSize: wall === 70 ? "90 x 19" : "110 x 19", stockLengthM: 5.4 },
      takeoffSources: contributing.map((trace) => ({ openingId: trace.id, level: trace.level, lengths: trace.contributedLengths, wallThicknessMm: trace.wallThicknessMm })),
    });
  });
}

function cavityCageRows(schedule, { products, quantities }) {
  const section = "FRAMING TIMBER";
  const groups = new Map();
  for (const row of schedule.cavityCages) {
    const key = `${row.widthMm}|${row.heightMm}|${row.hostFrameThicknessMm ?? ""}`;
    const group = groups.get(key) || { widthMm: row.widthMm, heightMm: row.heightMm, wallThicknessMm: row.hostFrameThicknessMm ?? null, quantity: 0, sources: [] };
    group.quantity += number(row.quantity);
    group.sources.push(...(row.openings || []).map((opening) => ({ openingId: opening.id, level: row.level })));
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.widthMm - b.widthMm || number(a.wallThicknessMm) - number(b.wallThicknessMm)).map((group) => {
    const product = group.wallThicknessMm
      ? products.find((item) => number(item.attributes?.doorWidthMm) === group.widthMm
        && number(item.attributes?.wallThicknessMm) === group.wallThicknessMm
        && (!item.attributes?.doorHeightMm || number(item.attributes.doorHeightMm) === group.heightMm)) || null
      : null;
    const { rate } = product ? productRate(product) : { rate: null };
    const quantityKey = `takeoffCavityCage:${group.widthMm}x${group.heightMm}:${group.wallThicknessMm ?? "unknown"}`;
    quantities[quantityKey] = group.quantity;
    const wallLabel = group.wallThicknessMm ? `${group.wallThicknessMm}MM WALL` : "WALL THICKNESS REQUIRED";
    return productRow({
      section, id: `cavity-cage:${group.widthMm}x${group.heightMm}:${group.wallThicknessMm ?? "unknown"}`,
      item: `${group.widthMm} CAVITY CAGE - ${wallLabel}${group.heightMm && group.heightMm !== 2040 ? ` (${group.heightMm} HIGH)` : ""}`,
      quantityKey, product, rate,
      notes: [
        `Takeoff: ${group.quantity} cavity sliding door${group.quantity === 1 ? "" : "s"} ${group.widthMm} x ${group.heightMm}${group.wallThicknessMm ? ` in ${group.wallThicknessMm}mm walls` : " (host wall thickness not measured)"}.`,
        !product ? `${PRICE_REQUIRED_LABEL}: no ${group.widthMm} x ${group.heightMm} cage for ${group.wallThicknessMm ? `${group.wallThicknessMm}mm walls` : "an unmeasured wall"} in Product Library.` : "",
        product && rate == null ? `${PRICE_REQUIRED_LABEL}: ${product.productName} has no verified price.` : "",
      ].filter(Boolean).join(" "),
      description: product?.description || `Cavity sliding door cage for ${group.widthMm} x ${group.heightMm} door${group.wallThicknessMm ? `, ${group.wallThicknessMm}mm wall` : ""}`,
      purchasingDetails: { doorWidthMm: group.widthMm, doorHeightMm: group.heightMm, wallThicknessMm: group.wallThicknessMm },
      takeoffSources: group.sources,
    });
  });
}

// ---------------------------------------------------------------------------------------------

const TAKEOFF_ROW_MATCHERS = Object.freeze([
  { section: "frame stage labour", sourceRow: 104, text: "cavity door cage", key: DOOR_TAKEOFF_KEYS.cavityCageInstall },
  { section: "fix-out stage labour", sourceRow: 150, text: "cavity slider", key: DOOR_TAKEOFF_KEYS.cavityDoorHang },
  { section: "fix-out stage labour", sourceRow: 152, text: "single door", key: DOOR_TAKEOFF_KEYS.singleDoorHang },
  { section: "fix-out stage labour", sourceRow: 153, text: "double door", key: DOOR_TAKEOFF_KEYS.doubleDoorHang },
  { section: "frame stage labour", text: "install cavity cages", key: DOOR_TAKEOFF_KEYS.superseded },
  { section: "door furniture", sourceRow: 1344, text: "cavity sliding door unit", key: DOOR_TAKEOFF_KEYS.superseded },
  { source: "client-selections-internal-product", ids: ["internal-selection:internal-doors", "internal-selection:door-hardware"], key: DOOR_TAKEOFF_KEYS.superseded },
]);

// The Takeoff quantity key for an existing row (normalised section name + source row number), or null.
export function takeoffRowQuantityKey(row = {}, sectionName = "", sourceRow = 0) {
  const text = `${row.item || ""} ${row.rawText || ""}`.toLowerCase();
  const match = TAKEOFF_ROW_MATCHERS.find((matcher) => (matcher.source
    ? row.source === matcher.source && matcher.ids.includes(String(row.id || ""))
    : matcher.section === sectionName && text.includes(matcher.text) && (matcher.sourceRow === undefined || matcher.sourceRow === sourceRow)));
  return match ? match.key : null;
}

const EMPTY = Object.freeze({ hasTakeoff: false, quantities: {}, rows: {}, rowMatchers: [], forceLinkedKeys: new Set() });
const cache = new WeakMap();

export function takeoffDoorQuotation(workbook = {}) {
  const job = takeoffJob(workbook);
  if (!job) return EMPTY;
  const book = workbook.clientSelectionsBook || null;
  const organisationId = workbook.organisationId || workbook.workspaceId || workbook.jobFileMeta?.workspaceId || workbook.registeredJob?.workspaceId || "";
  const defaults = workbook.productCategoryDefaults || null;
  const jobSetupRows = workbook?.data?.inputDataSheet?.rows || {};
  const cached = cache.get(job);
  if (cached && cached.book === book && cached.organisationId === organisationId && cached.defaults === defaults && cached.jobSetupRows === jobSetupRows) return cached.result;

  const source = { completedWallRuns: job.completedWallRuns || [], placedOpenings: job.placedOpenings, pixelsPerMm: job.pixelsPerMm, sheetLevels: job.sheetLevels || {}, jobSetupRows };
  let schedule;
  let windows;
  try {
    schedule = createInternalDoorPurchaseSchedule(source);
    windows = createJobSetupWindowSchedule(source).rows.filter((row) => row.openingType === "Window");
  } catch {
    return EMPTY;
  }

  const quantities = {};
  const doorProducts = getCategoryProducts("internal-doors", { organisationId });
  const furnitureProducts = getCategoryProducts("door-furniture", { organisationId });
  const cageProducts = getCategoryProducts("cavity-sliding-door-cages", { organisationId });
  const doorSelection = selectionRows(book, productCategory("internal-doors").clientSelectionRequirementKey)
    .map((selection) => findProduct(doorProducts, selection.productId) || findProduct(doorProducts, selection.productCode))
    .find(Boolean) || null;
  const defaultReference = defaults?.["internal-doors"] || productCategory("internal-doors").defaultProductCode;
  const defaultProduct = findProduct(doorProducts, defaultReference);

  const count = (type) => sum(schedule.openings.filter((opening) => opening.purchaseType === type));
  const cavityDoors = count("cavity");
  quantities[DOOR_TAKEOFF_KEYS.cavityCageInstall] = cavityDoors;
  quantities[DOOR_TAKEOFF_KEYS.cavityDoorHang] = cavityDoors;
  // Labour uses the complete Internal Door opening class. Purchasing subtypes (robe,
  // barn, double, etc.) must not silently remove openings from this labour formula.
  quantities.internalDoors = sum(schedule.openings);
  quantities[DOOR_TAKEOFF_KEYS.singleDoorHang] = quantities.internalDoors - cavityDoors;
  quantities[DOOR_TAKEOFF_KEYS.doubleDoorHang] = count("double");
  quantities[DOOR_TAKEOFF_KEYS.superseded] = 0;
  quantities.cavityDoorQty = cavityDoors;
  // Frame stage window labour: SUM of each Takeoff window row's quantity, by level.
  quantities.quoteFrameInstallWindows = sum(windows);
  quantities.quoteFrameSecondStoreyWindows = sum(windows.filter((row) => row.level === "Second Level"));
  quantities.quoteFrameThirdStoreyWindows = sum(windows.filter((row) => row.level === "Third Level"));

  const fixOut = [
    headingRow("FIX OUT", "internal-doors", "INTERNAL DOORS"),
    ...internalDoorRows(schedule, { products: doorProducts, selected: doorSelection, defaultProduct, quantities }),
    headingRow("FIX OUT", "door-furniture", "DOOR FURNITURE"),
    ...doorFurnitureRows(schedule, { products: furnitureProducts, selections: selectionRows(book, productCategory("door-furniture").clientSelectionRequirementKey), quantities }),
    headingRow("FIX OUT", "door-jambs", "DOOR JAMBS"),
    ...jambRows(schedule, { quantities }),
  ];
  const framing = [
    headingRow("FRAMING TIMBER", "cavity-cages", "CAVITY SLIDING DOOR CAGES"),
    ...cavityCageRows(schedule, { products: cageProducts, quantities }),
  ];
  const generatedKeys = [...fixOut, ...framing].map((row) => row.quantityKey).filter(Boolean);

  const result = {
    hasTakeoff: true,
    quantities,
    rows: { "fix out": fixOut, "framing timber": framing },
    // Existing rows whose quantity now comes from the Takeoff. Row ids/numbers are not unique across
    // jobs, so each match needs the section, the row's own item text and (for template rows) its
    // number. The two cage material rows are superseded by the cage product rows above, and the
    // per-requirement Client Selections door/furniture lines by the Section 93 rows, so the same
    // material is never costed twice.
    rowMatchers: TAKEOFF_ROW_MATCHERS,
    forceLinkedKeys: new Set([...Object.values(DOOR_TAKEOFF_KEYS), ...generatedKeys]),
    schedule,
  };
  cache.set(job, { book, organisationId, defaults, jobSetupRows, result });
  return result;
}

export const SUPERSEDED_NOTE = "Superseded by the Takeoff-driven product rows (Section 93 Internal Doors / Door Furniture, Framing Cavity Sliding Door Cages) - not costed twice.";
