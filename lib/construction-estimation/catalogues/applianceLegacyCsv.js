import Papa from "papaparse";

export const APPLIANCE_LEGACY_FIELD_COUNT = 19;

export const APPLIANCE_LEGACY_FIELDS = Object.freeze([
  { index: 0, key: "legacyRowId", description: "Legacy source row number from the Quotation Builder appliance block." },
  { index: 1, key: "brandName", description: "Legacy brand label used for grouping appliance options." },
  { index: 2, key: "supplierName", description: "Legacy supplier/manufacturer label; currently mirrors brand for this file." },
  { index: 3, key: "legacyCategory", description: "Unused legacy category field; blank in supplied file." },
  { index: 4, key: "legacySubcategory", description: "Unused legacy subcategory field; blank in supplied file." },
  { index: 5, key: "legacyName", description: "Legacy line item name, including pack labels and component descriptions." },
  { index: 6, key: "legacyDescription", description: "Pipe-delimited legacy description carrying section, name, unit, price, and notes." },
  { index: 7, key: "unit", description: "Legacy unit; EACH for physical component rows and PACK for appliance pack rows." },
  { index: 8, key: "costPrice", description: "Legacy cost column; blank in supplied file." },
  { index: 9, key: "sellPrice", description: "Legacy sell/client price column." },
  { index: 10, key: "rate", description: "Legacy rate column; mirrors sellPrice in supplied file." },
  { index: 11, key: "gstTreatment", description: "Legacy GST field; blank in supplied file." },
  { index: 12, key: "legacyStatus", description: "Unused legacy status field; blank in supplied file." },
  { index: 13, key: "manufacturerName", description: "Manufacturer label; currently mirrors brand for this file." },
  { index: 14, key: "imageReference", description: "Legacy image reference; blank because Checkpoint 1 does not gather images." },
  { index: 15, key: "clientSelectable", description: "Legacy selectable flag." },
  { index: 16, key: "catalogueKind", description: "Legacy catalogue kind; appliance in supplied file." },
  { index: 17, key: "active", description: "Legacy active flag." },
  { index: 18, key: "notes", description: "Legacy reconciliation notes." },
]);

const MODEL_STOP_WORDS = new Set([
  "600MM",
  "900MM",
  "60CM",
  "90CM",
  "300MM",
  "1200MM",
  "APPLIANCES",
  "APPLIANCE",
  "PACK",
  "PACKS",
  "EACH",
  "TRUE",
  "FALSE",
  "OPTION",
  "OPTIONS",
  "BUILT",
  "BUILTIN",
  "BUILT-IN",
  "FREESTANDING",
  "SLIDEOUT",
  "SLIDE",
  "RANGEHOOD",
  "RANGEHOODS",
  "COOKTOP",
  "COOKER",
  "DISHWASHER",
  "OVEN",
  "GAS",
  "ELECTRIC",
  "CANOPY",
  "UNDER",
  "CUPBOARD",
  "PYRAMID",
  "CERAMIC",
  "FUNCTION",
]);

const BRAND_ALIASES = new Map([
  ["EUROMAID", "Euromaid"],
  ["ARISTON", "Ariston"],
  ["WESTINGHOUSE", "Westinghouse"],
  ["SMEG", "Smeg"],
  ["BLANCO", "Blanco"],
  ["OMEGA", "Omega"],
]);

const FAMILY_DEFINITIONS = [
  ["freestanding-cookers", /\b(upright cooker|freestanding cooker|freestanding oven|dual fuel freestanding|90cm.*cooker)\b/i],
  ["dishwashers", /\bdishwasher\b/i],
  ["microwaves", /\bmicrowave\b/i],
  ["refrigerators", /\b(fridge|refrigerator)\b/i],
  ["rangehoods", /\b(rangehood|range hood|canopy|slide out|slideout|under cupboard|undercupboard|fixed\/under)\b/i],
  ["cooktops", /\b(cooktop|hot plate|ceramic hob|induction)\b/i],
  ["ovens", /\boven\b/i],
];

export const APPLIANCE_TAXONOMY = Object.freeze({
  ovens: { categoryId: "category:appliances", familyId: "family:built-in-ovens" },
  cooktops: { categoryId: "category:appliances", familyId: "family:cooktops" },
  rangehoods: { categoryId: "category:appliances", familyId: "family:rangehoods" },
  dishwashers: { categoryId: "category:appliances", familyId: "family:dishwashers" },
  microwaves: { categoryId: "category:appliances", familyId: "family:microwaves" },
  refrigerators: { categoryId: "category:appliances", familyId: "family:refrigerators" },
  "freestanding-cookers": { categoryId: "category:appliances", familyId: "family:freestanding-cookers" },
  "appliance-packs": { categoryId: "category:appliances", familyId: "family:appliance-packs" },
  "unresolved-appliance-type": { categoryId: "category:appliances", familyId: "family:unresolved-appliance-type" },
});

export function parseApplianceLegacyCsv(csvText = "") {
  const result = Papa.parse(csvText, { skipEmptyLines: true });
  const parsedRows = result.data.map((fields, index) => parseApplianceLegacyRow(fields, index + 1));
  return {
    records: parsedRows.filter((row) => row.valid),
    rejectedRows: parsedRows.filter((row) => !row.valid),
    errors: result.errors || [],
  };
}

export function parseApplianceLegacyRow(fields = [], sourceLineNumber = 0) {
  const sourceFields = [...fields];
  if (sourceFields.length !== APPLIANCE_LEGACY_FIELD_COUNT) {
    return Object.freeze({
      valid: false,
      sourceLineNumber,
      sourceFields,
      rejectionReason: `expected ${APPLIANCE_LEGACY_FIELD_COUNT} fields, received ${sourceFields.length}`,
    });
  }
  const record = { valid: true, sourceLineNumber, sourceFields };
  for (const field of APPLIANCE_LEGACY_FIELDS) record[field.key] = clean(sourceFields[field.index]);
  record.brand = normalizeBrand(record.brandName);
  record.supplier = normalizeBrand(record.supplierName) || record.brand;
  record.manufacturer = normalizeBrand(record.manufacturerName) || record.brand;
  record.unit = record.unit.toUpperCase();
  record.rowKind = record.unit === "PACK" ? "pack" : record.unit === "EACH" ? "component" : "unresolved";
  record.modelNumber = record.rowKind === "component" ? extractApplianceModelNumber(record.legacyName) : "";
  record.applianceFamily = record.rowKind === "pack" ? "appliance-packs" : classifyApplianceFamily(record.legacyName);
  record.price = numberOrNull(record.sellPrice);
  record.ratePrice = numberOrNull(record.rate);
  record.isClientSelectable = booleanValue(record.clientSelectable);
  record.isActive = booleanValue(record.active);
  return Object.freeze(record);
}

export function reconcileApplianceLegacyRecords(records = []) {
  const sourceRecords = records.map((record) => ({ ...record }));
  const componentRows = sourceRecords.filter((record) => record.rowKind === "component" && record.applianceFamily !== "unresolved-appliance-type");
  const packRows = sourceRecords.filter((record) => record.rowKind === "pack");
  const unresolvedRows = sourceRecords.filter((record) => record.rowKind === "unresolved" || (record.rowKind === "component" && record.applianceFamily === "unresolved-appliance-type"));
  const productMap = new Map();
  for (const record of componentRows) {
    const key = productIdentityKey(record);
    if (!productMap.has(key)) productMap.set(key, productCandidate(record, key));
    productMap.get(key).sourceRowIds.push(record.legacyRowId);
  }
  const products = Array.from(productMap.values()).sort((left, right) => left.productId.localeCompare(right.productId));
  const relationships = packComponentRelationships(sourceRecords, products);
  const packs = packRows.map((pack) => packCandidate(pack, relationships.filter((relationship) => relationship.packSourceRowId === pack.legacyRowId)));
  const duplicates = componentRows.length - products.length;
  const priceConflicts = detectPriceConflicts(componentRows);
  const identityVariationGroups = detectIdentityVariationGroups(componentRows);
  const accountedSourceRowIds = new Set([
    ...componentRows.map((row) => row.legacyRowId),
    ...packRows.map((row) => row.legacyRowId),
    ...unresolvedRows.map((row) => row.legacyRowId),
  ]);
  return {
    sourceRows: sourceRecords.length,
    products,
    packs,
    relationships,
    duplicateComponentRows: duplicates,
    duplicateComponentRowDetails: duplicateDetails(componentRows),
    unresolvedRows,
    rejectedRows: [],
    priceConflicts,
    identityVariationGroups,
    countsByBrand: countBy(sourceRecords, "brand"),
    countsByFamily: countBy(products, "family"),
    accountedSourceRows: accountedSourceRowIds.size,
  };
}

export function extractApplianceModelNumber(value = "") {
  const normalized = modelBearingText(value)
    .toUpperCase()
    .replace(/[()]/g, " ");
  const trailingModel = normalized.match(/\b(?:OVEN|COOKTOP|RANGEHOOD|DISHWASHER|COOKER|HOB)\s+([A-Z0-9][A-Z0-9 /-]*[0-9][A-Z0-9 /-]*)$/i);
  if (trailingModel) return normalizeModelNumber(trailingModel[1]);
  const candidates = normalized.match(/\b[A-Z0-9][A-Z0-9-]{2,}\b/g) || [];
  const filtered = candidates.filter((token) => (
    /[A-Z]/.test(token) &&
    /\d/.test(token) &&
    !MODEL_STOP_WORDS.has(token) &&
    !/^\d+(MM|CM|M)$/.test(token) &&
    !/^\d+$/.test(token)
  ));
  return filtered.at(-1) || "";
}

export function normalizeBrand(value = "") {
  const key = clean(value).toUpperCase();
  if (!key) return "";
  return BRAND_ALIASES.get(key) || titleCase(key);
}

export function classifyApplianceFamily(value = "") {
  for (const [family, pattern] of FAMILY_DEFINITIONS) {
    if (pattern.test(value)) return family;
  }
  return "unresolved-appliance-type";
}

export function stableApplianceProductId(record = {}) {
  const brand = slug(record.brand || record.brandName || "unknown-brand");
  const family = record.applianceFamily || classifyApplianceFamily(record.legacyName || record.productName);
  const model = record.modelNumber || extractApplianceModelNumber(record.legacyName || record.productName);
  const identity = model ? slug(model) : slug(normalizeProductName(record.legacyName || record.productName));
  return `product:appliances:${family}:${brand}:${identity}`;
}

export function stableAppliancePackId(record = {}) {
  return `pack:appliances:${slug(record.brand || record.brandName || "unknown-brand")}:${slug(record.legacyName || record.productName || record.legacyRowId)}`;
}

function productIdentityKey(record) {
  if (record.modelNumber) return `${slug(record.brand)}::${slug(record.modelNumber)}`;
  return `${slug(record.brand)}::name::${slug(normalizeProductName(record.legacyName))}`;
}

function productCandidate(record, identityKey) {
  const taxonomy = APPLIANCE_TAXONOMY[record.applianceFamily] || APPLIANCE_TAXONOMY["unresolved-appliance-type"];
  return {
    productId: stableApplianceProductId(record),
    identityKey,
    sourceRowIds: [],
    brand: record.brand,
    supplier: record.supplier,
    categoryId: taxonomy.categoryId,
    familyId: taxonomy.familyId,
    family: record.applianceFamily,
    modelNumber: record.modelNumber,
    productName: normalizeProductName(record.legacyName),
    description: record.legacyDescription,
    unit: record.unit,
    price: record.price,
    selectable: record.isClientSelectable,
    active: record.isActive,
    imageReference: "",
  };
}

function packCandidate(record, productsByBrandFamily) {
  const requiredFamilies = packFamilies(record.legacyName);
  const relationships = Array.isArray(productsByBrandFamily) ? productsByBrandFamily : [];
  const componentProductIds = relationships.map((relationship) => relationship.componentProductId);
  return {
    packId: stableAppliancePackId(record),
    sourceRowId: record.legacyRowId,
    brand: record.brand,
    productName: normalizeProductName(record.legacyName),
    description: record.legacyDescription,
    unit: record.unit,
    price: record.price,
    categoryId: APPLIANCE_TAXONOMY["appliance-packs"].categoryId,
    familyId: APPLIANCE_TAXONOMY["appliance-packs"].familyId,
    containsOven: includesFamily(requiredFamilies, "ovens"),
    containsCooktop: includesFamily(requiredFamilies, "cooktops"),
    containsRangehood: includesFamily(requiredFamilies, "rangehoods"),
    containsDishwasher: includesFamily(requiredFamilies, "dishwashers"),
    containsMicrowave: includesFamily(requiredFamilies, "microwaves"),
    containsRefrigerator: includesFamily(requiredFamilies, "refrigerators"),
    containsFreestandingCooker: includesFamily(requiredFamilies, "freestanding-cookers"),
    containsOtherComponent: requiredFamilies.includes("unresolved-appliance-type"),
    componentProductIds: Array.from(new Set(componentProductIds)),
    unresolvedComponentFamilies: requiredFamilies.filter((family) => !(relationships.some((relationship) => relationship.componentFamily === family))),
  };
}

function packFamilies(name = "") {
  const text = name.toLowerCase();
  const families = [];
  if (/upright cooker|freestanding cooker/.test(text)) families.push("freestanding-cookers");
  else if (/oven/.test(text)) families.push("ovens");
  if (/cooktop|hot plate/.test(text) && !/upright cooker/.test(text)) families.push("cooktops");
  if (/rangehood|range hood|canopy|slideout|under cupboard/.test(text)) families.push("rangehoods");
  if (/dishwasher/.test(text)) families.push("dishwashers");
  if (/microwave/.test(text)) families.push("microwaves");
  if (/fridge|refrigerator/.test(text)) families.push("refrigerators");
  return families.length ? Array.from(new Set(families)) : ["unresolved-appliance-type"];
}

function packComponentRelationships(records, products) {
  const relationships = [];
  const productBySourceRowId = new Map();
  for (const product of products) {
    for (const sourceRowId of product.sourceRowIds) productBySourceRowId.set(sourceRowId, product);
  }
  const byBrand = groupRows(records, "brand");
  for (const brandRows of byBrand.values()) {
    const packs = brandRows.filter((row) => row.rowKind === "pack");
    if (!packs.length) continue;
    const firstPackIndex = brandRows.findIndex((row) => row.rowKind === "pack");
    const leadingComponents = brandRows.slice(0, firstPackIndex).filter((row) => row.rowKind === "component");
    packs.forEach((pack, packIndex) => {
      const packPosition = brandRows.indexOf(pack);
      const nextPackPosition = packIndex + 1 < packs.length ? brandRows.indexOf(packs[packIndex + 1]) : brandRows.length;
      const followingComponents = brandRows.slice(packPosition + 1, nextPackPosition).filter((row) => row.rowKind === "component");
      const componentRows = packIndex === 0 ? [...leadingComponents, ...followingComponents] : followingComponents;
      componentRows.forEach((componentRow, componentIndex) => {
        const product = productBySourceRowId.get(componentRow.legacyRowId);
        if (!product) return;
        relationships.push({
          packId: stableAppliancePackId(pack),
          packSourceRowId: pack.legacyRowId,
          componentProductId: product.productId,
          componentSourceRowId: componentRow.legacyRowId,
          componentFamily: product.family,
          componentOrder: componentIndex + 1,
        });
      });
    });
  }
  return relationships;
}

function groupRows(rows, key) {
  const grouped = new Map();
  for (const row of rows) {
    const value = row[key] || "unassigned";
    if (!grouped.has(value)) grouped.set(value, []);
    grouped.get(value).push(row);
  }
  return grouped;
}

function detectPriceConflicts(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = productIdentityKey(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return Array.from(groups.entries()).flatMap(([identityKey, group]) => {
    const prices = unique(group.map((row) => row.price).filter((value) => value != null));
    const units = unique(group.map((row) => row.unit));
    const hasConflict = prices.length > 1 || units.length > 1;
    if (!hasConflict) return [];
    return [{
      identityKey,
      brand: group[0].brand,
      modelNumber: group[0].modelNumber,
      sourceRowIds: group.map((row) => row.legacyRowId),
      prices,
      units,
    }];
  });
}

function detectIdentityVariationGroups(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = productIdentityKey(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return Array.from(groups.entries()).flatMap(([identityKey, group]) => {
    if (group.length < 2) return [];
    const prices = unique(group.map((row) => row.price).filter((value) => value != null));
    const units = unique(group.map((row) => row.unit));
    const active = unique(group.map((row) => String(row.isActive)));
    const selectable = unique(group.map((row) => String(row.isClientSelectable)));
    const descriptions = unique(group.map((row) => normalizeProductName(row.legacyName)));
    const hasVariation = prices.length > 1 || units.length > 1 || active.length > 1 || selectable.length > 1 || descriptions.length > 1;
    if (!hasVariation) return [];
    return [{
      identityKey,
      brand: group[0].brand,
      modelNumber: group[0].modelNumber,
      sourceRowIds: group.map((row) => row.legacyRowId),
      prices,
      units,
      active,
      selectable,
      descriptions,
    }];
  });
}

function duplicateDetails(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = productIdentityKey(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return Array.from(groups.entries()).flatMap(([identityKey, group]) => {
    if (group.length < 2) return [];
    const canonical = group[0];
    return group.slice(1).map((row) => ({
      identityKey,
      canonicalSourceRowId: canonical.legacyRowId,
      duplicateSourceRowId: row.legacyRowId,
      brand: row.brand,
      modelNumber: row.modelNumber,
      productName: normalizeProductName(row.legacyName),
    }));
  });
}

function modelBearingText(value = "") {
  let text = clean(value).replace(/^-\s*/, "");
  const optionIndex = text.toUpperCase().lastIndexOf(" OPTION - ");
  if (optionIndex >= 0) text = text.slice(optionIndex + " OPTION - ".length);
  return text;
}

function normalizeModelNumber(value = "") {
  return clean(value)
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function normalizeProductName(value = "") {
  return clean(value).replace(/^-\s*/, "").replace(/\s+/g, " ").trim();
}

function includesFamily(families, family) {
  return families.includes(family);
}

function unique(values) {
  return Array.from(new Set(values.filter((value) => value !== "" && value != null)));
}

function countBy(rows, key) {
  return rows.reduce((acc, row) => {
    const value = row[key] || "unassigned";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function booleanValue(value) {
  return ["true", "yes", "1", "active"].includes(clean(value).toLowerCase());
}

function numberOrNull(value) {
  const numeric = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function titleCase(value) {
  return value.toLowerCase().replace(/\b[a-z]/g, (char) => char.toUpperCase());
}

function slug(value = "") {
  return clean(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function clean(value) {
  return String(value ?? "").trim();
}
