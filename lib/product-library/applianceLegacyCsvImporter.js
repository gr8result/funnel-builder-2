import { readFileSync } from "node:fs";

// Deprecated after Stage 3B Checkpoint 1 reconciliation.
// The authoritative parser is lib/construction-estimation/catalogues/applianceLegacyCsv.js.
// Keep this file temporarily only for historical comparison/removal planning.
export const APPLIANCE_LEGACY_SOURCE_COLUMNS = [
  { index: 0, key: "legacySourceRow", description: "Legacy workbook/source row number." },
  { index: 1, key: "supplierName", description: "Supplier/manufacturer label from the legacy row." },
  { index: 2, key: "brandName", description: "Product brand." },
  { index: 3, key: "rangeName", description: "Legacy range column; blank in the supplied appliance file." },
  { index: 4, key: "existingStableProductId", description: "Existing stable Product Library ID; blank in the supplied appliance file." },
  { index: 5, key: "legacyProductName", description: "Legacy line item/product name." },
  { index: 6, key: "legacyCompositeDescription", description: "Pipe-delimited legacy category, name, unit, price and note text." },
  { index: 7, key: "unit", description: "Legacy unit. Expected values are EACH or PACK." },
  { index: 8, key: "sku", description: "Legacy SKU column; blank in the supplied appliance file." },
  { index: 9, key: "costPrice", description: "Legacy numeric cost price." },
  { index: 10, key: "sellPrice", description: "Legacy numeric sell/client price." },
  { index: 11, key: "gstStatus", description: "Legacy GST status column; blank in the supplied appliance file." },
  { index: 12, key: "imageUrl", description: "Legacy image URL column; blank in the supplied appliance file." },
  { index: 13, key: "manufacturerName", description: "Manufacturer label." },
  { index: 14, key: "imageSourceUrl", description: "Legacy image/source URL column; blank in the supplied appliance file." },
  { index: 15, key: "selectable", description: "Legacy client-selectable flag." },
  { index: 16, key: "category", description: "Legacy category. Expected value is appliance." },
  { index: 17, key: "active", description: "Legacy active flag." },
  { index: 18, key: "notes", description: "Legacy notes." },
];

const APPLIANCE_CATEGORY_ID = "category:appliances";
const SCHEMA_VERSION = "product-library.appliances.legacy-csv.v1";

export function importLegacyApplianceCsvFile(filePath) {
  return importLegacyApplianceCsv(readFileSync(filePath, "utf8"), { sourceFile: filePath });
}

export function importLegacyApplianceCsv(csvText, options = {}) {
  const sourceRows = parseCsv(csvText)
    .filter((columns) => columns.some((value) => String(value || "").trim()))
    .map((columns, index) => normaliseLegacyRow(columns, index + 1));

  const rejectedRows = sourceRows
    .filter((row) => row.errors.length)
    .map((row) => ({ sourceRowNumber: row.sourceRowNumber, legacySourceRow: row.legacySourceRow, errors: row.errors }));
  const validRows = sourceRows.filter((row) => !row.errors.length);
  const eachRows = validRows.filter((row) => row.unit === "EACH");
  const packRows = validRows.filter((row) => row.unit === "PACK");

  const productsByKey = new Map();
  const duplicateComponentRows = [];
  const priceConflicts = [];
  const unresolvedModelNumbers = [];

  for (const row of eachRows) {
    if (!row.manufacturerModel) unresolvedModelNumbers.push(unresolvedRow(row, "Missing manufacturer model number."));
    const dedupeKey = productDedupeKey(row);
    const existing = productsByKey.get(dedupeKey);
    if (existing) {
      existing.sourceRows.push(row.sourceRowNumber);
      existing.legacySourceRows.push(row.legacySourceRow);
      duplicateComponentRows.push({
        duplicateSourceRow: row.sourceRowNumber,
        duplicateLegacySourceRow: row.legacySourceRow,
        canonicalSourceRow: existing.sourceRows[0],
        productId: existing.productId,
        dedupeKey,
      });
      if (existing.costPrice !== row.costPrice || existing.sellPrice !== row.sellPrice) {
        priceConflicts.push({
          productId: existing.productId,
          dedupeKey,
          productName: existing.productName,
          sourceRows: [existing.sourceRows[0], row.sourceRowNumber],
          costPrices: uniqueValues([existing.costPrice, row.costPrice]).join("|"),
          sellPrices: uniqueValues([existing.sellPrice, row.sellPrice]).join("|"),
        });
      }
      continue;
    }
    productsByKey.set(dedupeKey, productRecord(row, dedupeKey, options));
  }

  const products = [...productsByKey.values()].sort(compareByProductId);
  const productIdByDedupeKey = new Map(products.map((product) => [product.dedupeKey, product.productId]));
  const packRelationships = packComponentRelationships(validRows, productIdByDedupeKey);
  const packs = packRows.map((row) => packRecord(row, packRelationships.filter((rel) => rel.packLegacySourceRow === row.legacySourceRow), options));
  const productsMissingImages = products.filter((product) => !product.imageUrl).map(productMissingMedia);
  const productsMissingDescriptions = products.filter((product) => !product.shortDescription && !product.fullDescription).map(productMissingMedia);

  return {
    schemaVersion: SCHEMA_VERSION,
    sourceFile: options.sourceFile || "",
    sourceRows,
    products,
    packs,
    packRelationships,
    invalidRows: rejectedRows,
    unresolvedModelNumbers,
    duplicateComponentRows,
    priceConflicts,
    productsMissingImages,
    productsMissingDescriptions,
    report: {
      sourceRows: sourceRows.length,
      uniqueProducts: products.length,
      packs: packs.length,
      packRelationships: packRelationships.length,
      duplicateComponentRows: duplicateComponentRows.length,
      unresolvedModelNumbers: unresolvedModelNumbers.length,
      rejectedRows: rejectedRows.length,
      priceConflicts: priceConflicts.length,
      productsMissingImages: productsMissingImages.length,
      productsMissingDescriptions: productsMissingDescriptions.length,
      brands: countBy(validRows, "brandName"),
      units: countBy(validRows, "unit"),
      productFamilies: countBy([...products, ...packs], "familyId"),
    },
  };
}

export function parseCsv(csvText) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const text = String(csvText || "").replace(/^\uFEFF/, "");

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === "\"") {
      if (quoted && text[i + 1] === "\"") {
        cell += "\"";
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

export function normaliseLegacyRow(columns, sourceRowNumber) {
  const mapped = Object.fromEntries(APPLIANCE_LEGACY_SOURCE_COLUMNS.map((column) => [column.key, clean(columns[column.index])]));
  const productName = cleanProductName(mapped.legacyProductName);
  const unit = mapped.unit.toUpperCase();
  const brandName = mapped.brandName.toUpperCase();
  const familyId = classifyApplianceFamily({ ...mapped, productName, unit });
  const subfamilyIds = classifyApplianceSubfamilies({ ...mapped, productName, unit });
  const manufacturerModel = unit === "PACK" ? "" : extractManufacturerModel(productName, brandName);
  const errors = [];
  if (columns.length !== APPLIANCE_LEGACY_SOURCE_COLUMNS.length) errors.push(`Expected 19 columns but found ${columns.length}.`);
  if (!mapped.legacySourceRow) errors.push("Missing legacy source row.");
  if (!brandName) errors.push("Missing brand.");
  if (!productName) errors.push("Missing product name.");
  if (!["EACH", "PACK"].includes(unit)) errors.push(`Unsupported unit: ${mapped.unit || "(blank)"}.`);
  if (Number.isNaN(priceNumber(mapped.costPrice))) errors.push(`Invalid cost price: ${mapped.costPrice || "(blank)"}.`);
  if (Number.isNaN(priceNumber(mapped.sellPrice))) errors.push(`Invalid sell price: ${mapped.sellPrice || "(blank)"}.`);

  return {
    sourceRowNumber,
    ...mapped,
    legacySourceRow: mapped.legacySourceRow,
    supplierName: mapped.supplierName || mapped.manufacturerName || brandName,
    manufacturerName: mapped.manufacturerName || brandName,
    brandName,
    productName,
    unit,
    costPrice: priceNumber(mapped.costPrice),
    sellPrice: priceNumber(mapped.sellPrice),
    selectable: booleanValue(mapped.selectable),
    active: booleanValue(mapped.active),
    familyId,
    subfamilyIds,
    manufacturerModel,
    errors,
  };
}

export function extractManufacturerModel(productName, brandName = "") {
  const name = cleanProductName(productName).replace(new RegExp(`^${escapeRegExp(brandName)}\\s+`, "i"), "");
  const trailingModel = name.match(/\b(?:OVEN|COOKTOP|RANGEHOOD|DISHWASHER|COOKER)\s+([A-Z0-9][A-Z0-9 -]*[0-9][A-Z0-9 -]*)$/i);
  if (trailingModel) return trailingModel[1].replace(/\s+/g, " ").trim().toUpperCase();
  const candidates = name.match(/\b[A-Z0-9][A-Z0-9-]{2,}\b/g) || [];
  const ignored = new Set(["PACK", "OPTION", "OVEN", "GAS", "ELECTRIC", "CERAMIC", "INDUCTION", "COOKTOP", "RANGEHOOD", "DISHWASHER", "FREESTANDING", "BUILT", "FUNCTION", "CANOPY", "SLIDEOUT", "SLIDE", "UNDER", "CUPBOARD"]);
  const model = [...candidates].reverse().find((candidate) => (
    /[0-9]/.test(candidate)
    && !/^\d+(CM|MM)$/i.test(candidate)
    && !ignored.has(candidate.toUpperCase())
  ));
  return model || "";
}

export function classifyApplianceFamily(row) {
  const text = `${row.productName || ""}`.toLowerCase();
  if (row.unit === "PACK") return "appliance-packs";
  if (/dishwasher/.test(text)) return "dishwashers";
  if (/microwave/.test(text)) return "microwaves";
  if (/refrigerator|fridge/.test(text)) return "refrigerators";
  if (/upright cooker|freestanding cooker|free standing cooker/.test(text)) return "freestanding-cookers";
  if (/rangehood|range hood|slideout|slide out|canopy|under cupboard/.test(text)) return "rangehoods";
  if (/cooktop/.test(text)) return "cooktops";
  if (/oven/.test(text)) return "ovens";
  return "appliances-unresolved";
}

export function classifyApplianceSubfamilies(row) {
  const text = `${row.productName || ""} ${row.legacyCompositeDescription || ""}`.toLowerCase();
  const subfamilies = [];
  if (/600\s*(cm|mm)|60\s*cm/.test(text)) subfamilies.push("600-mm");
  if (/900\s*(cm|mm)|90\s*cm/.test(text)) subfamilies.push("900-mm");
  if (/single/.test(text)) subfamilies.push("single");
  if (/double/.test(text)) subfamilies.push("double");
  if (/induction/.test(text)) subfamilies.push("induction");
  if (/ceramic/.test(text)) subfamilies.push("ceramic");
  if (/\bgas\b/.test(text)) subfamilies.push("gas");
  if (/electric/.test(text)) subfamilies.push("electric");
  if (/slide\s*out|slideout/.test(text)) subfamilies.push("slide-out");
  if (/canopy/.test(text)) subfamilies.push("canopy");
  if (/under\s*cupboard/.test(text)) subfamilies.push("under-cupboard");
  if (/\bfixed\b/.test(text)) subfamilies.push("fixed");
  return uniqueValues(subfamilies);
}

function productRecord(row, dedupeKey, options) {
  const productId = row.existingStableProductId || stableProductId(row);
  return {
    productId,
    schemaVersion: "product-library.product.v1",
    categoryId: APPLIANCE_CATEGORY_ID,
    familyId: row.familyId,
    subfamilyId: row.subfamilyIds.join("|"),
    productType: "physical-product",
    brandId: stableId("brand", row.brandName),
    brandName: row.brandName,
    rangeId: row.rangeName ? stableId("range", row.brandName, row.rangeName) : "",
    rangeName: row.rangeName,
    manufacturerModel: row.manufacturerModel,
    sku: row.sku,
    productName: row.productName,
    shortDescription: "",
    fullDescription: "",
    specifications: { legacyDescription: row.legacyCompositeDescription },
    availableSizes: sizeValues(row.productName),
    availableColours: [],
    availableFinishes: finishValues(row.productName),
    fuelOrEnergyType: fuelOrEnergyType(row),
    installationType: installationType(row),
    unit: row.unit,
    costPrice: row.costPrice,
    sellPrice: row.sellPrice,
    gstStatus: row.gstStatus || "unspecified",
    priceStatus: "fixed",
    supplierId: stableId("supplier", row.supplierName),
    supplierName: row.supplierName,
    imageUrl: row.imageUrl,
    imageSourceUrl: row.imageSourceUrl,
    additionalImages: [],
    documentUrls: [],
    applicableRooms: ["kitchen"],
    selectable: row.selectable,
    active: row.active,
    source: {
      type: "legacy-no-header-csv",
      file: options.sourceFile || "",
      legacySourceRow: row.legacySourceRow,
    },
    createdAt: "",
    updatedAt: "",
    imageStatus: row.imageUrl ? "provided-unverified" : "pending-verification",
    dedupeKey,
    sourceRows: [row.sourceRowNumber],
    legacySourceRows: [row.legacySourceRow],
  };
}

function packRecord(row, relationships, options) {
  return {
    productId: row.existingStableProductId || stablePackId(row),
    schemaVersion: "product-library.appliance-pack.v1",
    categoryId: APPLIANCE_CATEGORY_ID,
    familyId: "appliance-packs",
    subfamilyId: row.subfamilyIds.join("|"),
    productType: "appliance-pack",
    brandId: stableId("brand", row.brandName),
    brandName: row.brandName,
    rangeId: row.rangeName ? stableId("range", row.brandName, row.rangeName) : "",
    rangeName: row.rangeName,
    manufacturerModel: "",
    sku: row.sku,
    productName: row.productName,
    shortDescription: "",
    fullDescription: "",
    specifications: { legacyDescription: row.legacyCompositeDescription },
    availableSizes: sizeValues(row.productName),
    availableColours: [],
    availableFinishes: finishValues(row.productName),
    fuelOrEnergyType: fuelOrEnergyType(row),
    installationType: "pack",
    unit: row.unit,
    costPrice: row.costPrice,
    sellPrice: row.sellPrice,
    gstStatus: row.gstStatus || "unspecified",
    priceStatus: "fixed",
    supplierId: stableId("supplier", row.supplierName),
    supplierName: row.supplierName,
    imageUrl: row.imageUrl,
    imageSourceUrl: row.imageSourceUrl,
    additionalImages: [],
    documentUrls: [],
    applicableRooms: ["kitchen"],
    selectable: row.selectable,
    active: row.active,
    source: {
      type: "legacy-no-header-csv",
      file: options.sourceFile || "",
      legacySourceRow: row.legacySourceRow,
    },
    createdAt: "",
    updatedAt: "",
    imageStatus: row.imageUrl ? "provided-unverified" : "pending-verification",
    componentProductIds: relationships.map((relationship) => relationship.componentProductId),
    sourceRows: [row.sourceRowNumber],
    legacySourceRows: [row.legacySourceRow],
  };
}

function packComponentRelationships(rows, productIdByDedupeKey) {
  const relationships = [];
  const byBrand = groupBy(rows, "brandName");
  for (const brandRows of byBrand.values()) {
    const packs = brandRows.filter((row) => row.unit === "PACK");
    const leadingRows = brandRows.slice(0, brandRows.findIndex((row) => row.unit === "PACK")).filter((row) => row.unit === "EACH");
    packs.forEach((pack, index) => {
      const packPosition = brandRows.indexOf(pack);
      const nextPackPosition = index + 1 < packs.length ? brandRows.indexOf(packs[index + 1]) : brandRows.length;
      const componentRows = brandRows
        .slice(packPosition + 1, nextPackPosition)
        .filter((row) => row.unit === "EACH");
      const resolvedRows = index === 0 ? [...leadingRows, ...componentRows] : componentRows;
      resolvedRows.forEach((componentRow, componentIndex) => {
        const componentProductId = productIdByDedupeKey.get(productDedupeKey(componentRow));
        if (!componentProductId) return;
        relationships.push({
          packProductId: stablePackId(pack),
          packLegacySourceRow: pack.legacySourceRow,
          packSourceRow: pack.sourceRowNumber,
          componentProductId,
          componentLegacySourceRow: componentRow.legacySourceRow,
          componentSourceRow: componentRow.sourceRowNumber,
          componentOrder: componentIndex + 1,
        });
      });
    });
  }
  return relationships;
}

function productDedupeKey(row) {
  if (row.existingStableProductId) return `id:${row.existingStableProductId}`;
  if (row.manufacturerModel) return `brand-model:${slug(row.brandName)}:${slug(row.manufacturerModel)}`;
  return `brand-name:${slug(row.brandName)}:${slug(row.productName)}`;
}

function stableProductId(row) {
  if (row.manufacturerModel) return `product:appliances:${row.familyId}:${slug(row.brandName)}:${slug(row.manufacturerModel)}`;
  return `product:appliances:${row.familyId}:${slug(row.brandName)}:${slug(row.productName)}`;
}

function stablePackId(row) {
  return `product:appliances:appliance-packs:${slug(row.brandName)}:${slug(row.legacySourceRow)}`;
}

function stableId(prefix, ...parts) {
  return `${prefix}:${parts.map(slug).filter(Boolean).join(":")}`;
}

function clean(value) {
  return String(value ?? "").trim();
}

function cleanProductName(value) {
  return clean(value).replace(/^\s*-\s*/, "").replace(/\s+/g, " ");
}

function priceNumber(value) {
  const text = clean(value).replace(/[$,\s]/g, "");
  if (!text) return Number.NaN;
  return Number(text);
}

function booleanValue(value) {
  return /^(true|yes|1)$/i.test(clean(value));
}

function slug(value) {
  return clean(value).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function escapeRegExp(value) {
  return clean(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function uniqueValues(values) {
  return [...new Set(values.filter((value) => value !== "" && value !== null && value !== undefined))];
}

function countBy(rows, key) {
  return Object.fromEntries([...groupBy(rows, key).entries()].map(([value, items]) => [value, items.length]).sort(([a], [b]) => String(a).localeCompare(String(b))));
}

function groupBy(rows, key) {
  const groups = new Map();
  rows.forEach((row) => {
    const value = row[key] || "";
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(row);
  });
  return groups;
}

function compareByProductId(a, b) {
  return a.productId.localeCompare(b.productId);
}

function unresolvedRow(row, reason) {
  return {
    sourceRowNumber: row.sourceRowNumber,
    legacySourceRow: row.legacySourceRow,
    brandName: row.brandName,
    productName: row.productName,
    reason,
  };
}

function productMissingMedia(product) {
  return {
    productId: product.productId,
    brandName: product.brandName,
    manufacturerModel: product.manufacturerModel,
    productName: product.productName,
  };
}

function sizeValues(productName) {
  return uniqueValues((productName.match(/\b(?:60|90|600|900)\s*(?:cm|mm)\b/gi) || []).map((value) => value.toUpperCase().replace(/\s+/g, " ")));
}

function finishValues(productName) {
  return /stainless|inox|\bss\b|silver/i.test(productName) ? ["stainless steel"] : [];
}

function fuelOrEnergyType(row) {
  const text = row.productName.toLowerCase();
  if (/induction/.test(text)) return "induction";
  if (/ceramic/.test(text)) return "ceramic electric";
  if (/\bgas\b/.test(text)) return "gas";
  if (/electric/.test(text)) return "electric";
  return "";
}

function installationType(row) {
  const text = row.productName.toLowerCase();
  if (/freestanding|free standing|upright/.test(text)) return "freestanding";
  if (/built[- ]?in/.test(text)) return "built-in";
  if (/slide\s*out|slideout/.test(text)) return "slide-out";
  if (/under\s*cupboard/.test(text)) return "under-cupboard";
  if (/canopy/.test(text)) return "canopy";
  return "";
}
