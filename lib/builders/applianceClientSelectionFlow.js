import { numberValue, roundMoney } from "./selectionBudget.js";
import { APPLIANCE_IMAGE_FALLBACK_LABEL, isApplianceRecordVisible } from "../product-library/applianceCatalogueSelectorsCore.js";
import { PRODUCT_PRICE_SOURCES, resolveProductPrice } from "../product-library/catalogueModel.js";

export const APPLIANCE_CLIENT_FAMILY_KEYS = [
  "ovens",
  "cooktops",
  "rangehoods",
  "dishwashers",
  "microwaves",
  "fridges",
  "freestanding-cookers",
  "dryers",
  "appliance-packs",
];

export function isApplianceRequirement(requirement = {}) {
  return requirement.areaKey === "appliances" && APPLIANCE_CLIENT_FAMILY_KEYS.includes(requirement.familyKey);
}

export function applianceSequenceRequirements(requirements = []) {
  return APPLIANCE_CLIENT_FAMILY_KEYS.filter((key) => key !== "appliance-packs")
    .map((key) => requirements.find((requirement) => isApplianceRequirement(requirement) && requirement.familyKey === key))
    .filter(Boolean);
}

export function applianceRecordsForRequirement(records = [], requirement = {}) {
  if (!isApplianceRequirement(requirement)) return [];
  return (Array.isArray(records) ? records : [])
    .filter((record) => record.familyId === requirement.familyKey)
    .filter((record) => record.active !== false && record.selectable !== false)
    .filter((record) => !["hidden", "draft"].includes(record.eligibility))
    .sort((left, right) => [
      left.brand || "",
      left.range || "",
      left.model || "",
      left.name || "",
    ].join(" ").localeCompare([
      right.brand || "",
      right.range || "",
      right.model || "",
      right.name || "",
    ].join(" ")));
}

export function applianceRecordsForBrand(records = [], brand = "") {
  const brandKey = String(brand || "").trim().toLowerCase();
  return (Array.isArray(records) ? records : [])
    .filter((record) => record.active !== false && record.selectable !== false)
    .filter((record) => !["hidden", "draft"].includes(record.eligibility))
    .filter((record) => !brandKey || String(record.brand || record.brandName || "").trim().toLowerCase() === brandKey);
}

export function applianceBrandSummaries(records = [], packs = []) {
  const byBrand = new Map();
  (Array.isArray(records) ? records : [])
    .filter(isApplianceRecordVisible)
    .forEach((record) => {
      const brand = record.brand || record.brandName || "Brand to be confirmed";
      const summary = byBrand.get(brand) || {
        brand,
        brandId: record.brandId || `brand:${slugId(brand)}`,
        productCount: 0,
        packageCount: 0,
        familyIds: new Set(),
        ranges: new Set(),
        logo: record.brandLogo || record.logo || "",
        fallbackLabel: APPLIANCE_IMAGE_FALLBACK_LABEL,
      };
      summary.productCount += 1;
      if (record.familyId) summary.familyIds.add(record.familyId);
      if (record.range) summary.ranges.add(record.range);
      byBrand.set(brand, summary);
    });
  (Array.isArray(packs) ? packs : []).filter(isApplianceRecordVisible).forEach((pack) => {
    const brand = pack.brand || pack.brandName || "Brand to be confirmed";
    const summary = byBrand.get(brand) || {
      brand,
      brandId: pack.brandId || `brand:${slugId(brand)}`,
      productCount: 0,
      packageCount: 0,
      familyIds: new Set(),
      ranges: new Set(),
      logo: pack.brandLogo || pack.logo || "",
      fallbackLabel: APPLIANCE_IMAGE_FALLBACK_LABEL,
    };
    summary.packageCount += 1;
    byBrand.set(brand, summary);
  });
  return Array.from(byBrand.values()).map((summary) => ({
    ...summary,
    familyIds: Array.from(summary.familyIds).sort((left, right) => left.localeCompare(right)),
    ranges: Array.from(summary.ranges).sort((left, right) => left.localeCompare(right)),
  })).sort((left, right) => left.brand.localeCompare(right.brand));
}

export function applianceModelsForBrand(records = [], familyId = "", brand = "") {
  const brandKey = String(brand || "").trim().toLowerCase();
  return (Array.isArray(records) ? records : [])
    .filter(isApplianceRecordVisible)
    .filter((record) => !familyId || record.familyId === familyId)
    .filter((record) => !brandKey || String(record.brand || record.brandName || "").trim().toLowerCase() === brandKey)
    .sort((left, right) => (left.model || left.name || "").localeCompare(right.model || right.name || ""));
}

export function applianceProductTypesForBrand(records = [], requirements = [], brand = "") {
  const brandRecords = applianceRecordsForBrand(records, brand);
  return applianceSequenceRequirements(requirements)
    .map((requirement) => {
      const products = brandRecords.filter((record) => record.familyId === requirement.familyKey);
      return {
        requirement,
        products,
        productCount: products.length,
        available: products.length > 0,
      };
    });
}

export function applianceProductToGuidedOption(record = {}, requirement = {}) {
  const price = record.price == null ? null : numberValue(record.price);
  const priceState = price == null ? "Quote Required" : "Current Price";
  const priceIncludesGst = appliancePriceIncludesGst(record);
  return {
    id: record.productId || record.stableProductId || "",
    productId: record.productId || record.stableProductId || "",
    productCode: record.productCode || record.productId || "",
    canonicalProductId: record.productId || record.stableProductId || "",
    applianceSelectionProduct: true,
    familyKey: record.familyId || requirement.familyKey || "",
    familyName: record.familyName || requirement.label || "",
    brand: record.brand || record.brandName || "",
    brandLogo: record.brandLogo || record.logo || record.logoUrl || "",
    logo: record.logo || record.brandLogo || record.logoUrl || "",
    supplier: record.supplier || record.brand || record.brandName || "",
    range: record.range || "",
    model: record.model || record.manufacturerModel || "",
    productName: record.name || record.productName || "",
    description: record.description || "",
    specifications: record.specificationSummary || record.specifications || {},
    dimensions: dimensionLabel(record),
    size: dimensionLabel(record),
    fuelOrEnergyType: record.fuelOrEnergyType || "",
    installationType: record.installationType || "",
    finish: record.finish || "",
    unit: record.unit || requirement.defaultUnit || "EACH",
    selectedCost: price,
    gstIncluded: priceIncludesGst,
    priceIncludesGst,
    priceStatus: record.priceStatus || (price == null ? "quote_required" : "current"),
    priceState,
    allowance: numberValue(requirement.defaultAllowance),
    imageUrl: record.image || "",
    imageFallbackLabel: record.image ? "" : (record.imageFallbackLabel || APPLIANCE_IMAGE_FALLBACK_LABEL),
    imageVerificationStatus: record.image ? "approved" : "awaiting_supplier_verification",
    productUrl: record.productPageUrl || "",
    documentUrls: Array.isArray(record.documentUrls) ? record.documentUrls : [],
    sourceCatalogueVersion: record.schemaVersion || "AU-APPLIANCE-CATALOGUE",
    sourcePlatform: record.sourcePlatform || "platform-master",
    metadata: {
      applianceCatalogueRecord: {
        productId: record.productId || record.stableProductId || "",
        familyId: record.familyId || requirement.familyKey || "",
        brand: record.brand || record.brandName || "",
        brandLogo: record.brandLogo || record.logo || record.logoUrl || "",
        logo: record.logo || record.brandLogo || record.logoUrl || "",
        range: record.range || "",
        model: record.model || record.manufacturerModel || "",
        name: record.name || record.productName || "",
        description: record.description || "",
        specificationSummary: record.specificationSummary || record.specifications || {},
        dimensions: dimensionLabel(record),
        fuelOrEnergyType: record.fuelOrEnergyType || "",
        installationType: record.installationType || "",
        finish: record.finish || "",
        unit: record.unit || requirement.defaultUnit || "EACH",
        price: record.price ?? null,
        priceStatus: record.priceStatus || "",
        image: record.image || "",
        imageFallbackLabel: record.imageFallbackLabel || "",
        productPageUrl: record.productPageUrl || "",
        documentUrls: Array.isArray(record.documentUrls) ? record.documentUrls : [],
        schemaVersion: record.schemaVersion || "AU-APPLIANCE-CATALOGUE",
        sourcePlatform: record.sourcePlatform || "platform-master",
      },
    },
  };
}

export function applianceSelectionPatch({
  requirement = {},
  record = {},
  organisationId = "",
  projectId = "",
  selectedAt = new Date().toISOString(),
  selectedBrandId = "",
  selectedBrandName = "",
  selectionMode = "build-your-own",
  selectedPackageId = "",
  selectedPackageName = "",
  packageSnapshot = null,
} = {}) {
  const option = applianceProductToGuidedOption(record, requirement);
  const allowance = numberValue(requirement.defaultAllowance);
  const quantity = numberValue(requirement.defaultQuantity) || 1;
  const selectedPrice = option.selectedCost == null ? null : numberValue(option.selectedCost);
  const allowanceKnown = requirement.allowanceStatus !== "not_set";
  const variationPending = selectedPrice == null || option.priceIncludesGst === null || !allowanceKnown;
  const selectedPriceExGst = selectedPrice === null ? null : option.priceIncludesGst === true ? roundMoney(selectedPrice / 1.1) : selectedPrice;
  const variation = variationPending ? null : roundMoney((selectedPriceExGst - allowance) * quantity);
  const imageReference = option.imageUrl || option.imageFallbackLabel || APPLIANCE_IMAGE_FALLBACK_LABEL;
  const snapshot = {
    source: "guided_client_selections",
    sourceCatalogue: "AU-APPLIANCE-CATALOGUE",
    sourceCatalogueVersion: option.sourceCatalogueVersion,
    sourcePlatform: option.sourcePlatform,
    projectId,
    organisationId,
    canonicalProductId: option.canonicalProductId,
    applianceFamily: requirement.familyKey,
    familyKey: requirement.familyKey,
    familyLabel: requirement.label,
    requirementKey: requirement.requirementKey,
    requirementLabel: requirement.label,
    selectionMode,
    selectedBrandId: selectedBrandId || record.brandId || `brand:${slugId(option.brand)}`,
    selectedBrandName: selectedBrandName || option.brand,
    selectedPackageId,
    selectedPackageName,
    brand: option.brand,
    model: option.model,
    range: option.range,
    productName: option.productName,
    selectedProduct: option.productName,
    description: option.description,
    specs: option.specifications,
    dimensions: option.dimensions,
    size: option.size,
    fuelOrEnergyType: option.fuelOrEnergyType,
    installationType: option.installationType,
    finish: option.finish,
    selectedImageRef: imageReference,
    imageReference,
    imageVerificationStatus: option.imageVerificationStatus,
    productPageUrl: option.productUrl,
    documentUrls: option.documentUrls,
    appliancePackage: packageSnapshot,
    unit: option.unit,
    quantity,
    selectedPrice,
    priceIncludesGst: option.priceIncludesGst,
    originalAllowance: allowance,
    allowance,
    allowanceStatus: requirement.allowanceStatus || (allowance > 0 ? "set" : "not_set"),
    variation,
    variationPending,
    priceStatus: option.priceStatus,
    priceState: option.priceState,
    selectionDate: selectedAt,
    selectedAt,
    updatedAt: selectedAt,
  };
  return {
    selectedOptionId: option.canonicalProductId,
    selectedProduct: option.productName,
    productModel: option.model,
    brand: option.brand,
    description: option.description,
    supplier: option.supplier,
    finishColour: option.finish,
    imageUrl: option.imageUrl || "",
    allowanceAmount: allowance,
    selectedCost: selectedPrice,
    upgradeCost: variation,
    included: selectedPrice != null && variation === 0,
    status: "selected",
    guidedSelection: snapshot,
  };
}

export function safeAppliancePackagesForBrand({ packs = [], records = [], requirements = [], brand = "" } = {}) {
  const brandKey = String(brand || "").trim().toLowerCase();
  const recordById = new Map((Array.isArray(records) ? records : []).filter(isApplianceRecordVisible).map((record) => [record.productId || record.stableProductId, record]));
  const requirementByFamily = new Map((Array.isArray(requirements) ? requirements : [])
    .filter((requirement) => isApplianceRequirement(requirement))
    .map((requirement) => [requirement.familyKey, requirement]));
  return (Array.isArray(packs) ? packs : [])
    .filter((pack) => !brandKey || String(pack.brand || pack.brandName || "").trim().toLowerCase() === brandKey)
    .map((pack) => {
      const componentProductIds = appliancePackComponentProductIds(pack);
      const componentRecords = componentProductIds
        .map((componentId) => recordById.get(componentId))
        .filter(Boolean)
        .filter((record) => String(record.brand || record.brandName || "").trim().toLowerCase() === String(pack.brand || pack.brandName || "").trim().toLowerCase());
      const componentFamilies = new Set(componentRecords.map((record) => record.familyId).filter(Boolean));
      const unresolvedComponentIds = componentProductIds.filter((componentId) => !recordById.has(componentId));
      const missingRequirementFamilies = Array.from(componentFamilies).filter((familyId) => !requirementByFamily.has(familyId));
      const selectable = Boolean(componentRecords.length)
        && unresolvedComponentIds.length === 0
        && missingRequirementFamilies.length === 0
        && pack.selectable !== false
        && pack.active !== false
        && !["hidden", "draft"].includes(pack.eligibility || "");
      return {
        ...pack,
        selectable,
        componentProductIds,
        componentRecords,
        unresolvedComponentIds,
        missingRequirementFamilies,
        safeComponentCount: componentRecords.length,
      };
    })
    .filter((pack) => pack.selectable)
    .sort((left, right) => (left.name || left.packName || "").localeCompare(right.name || right.packName || ""));
}

function appliancePackComponentProductIds(pack = {}) {
  if (Array.isArray(pack.componentProductIds) && pack.componentProductIds.length) {
    return pack.componentProductIds.filter(Boolean);
  }
  return (Array.isArray(pack.componentRelationships) ? pack.componentRelationships : [])
    .map((relationship) => relationship.componentProductId || relationship.productId || "")
    .filter(Boolean);
}

export function appliancePackageSelectionPatches({
  packageOption = {},
  requirements = [],
  organisationId = "",
  projectId = "",
  selectedAt = new Date().toISOString(),
} = {}) {
  const selectedBrandName = packageOption.brand || packageOption.brandName || "";
  const selectedBrandId = packageOption.brandId || `brand:${slugId(selectedBrandName)}`;
  const selectedPackageId = packageOption.packId || packageOption.productId || "";
  const selectedPackageName = packageOption.packName || packageOption.name || "";
  const packageSnapshot = {
    packageId: selectedPackageId,
    packageName: selectedPackageName,
    brand: selectedBrandName,
    price: packageOption.price ?? packageOption.sourcePackPrice ?? packageOption.tenantSellPrice ?? null,
    priceStatus: packageOption.priceStatus || "",
    selectedAt,
  };
  return (packageOption.componentRecords || [])
    .map((record) => {
      const requirement = (requirements || []).find((item) => item.familyKey === record.familyId);
      if (!requirement) return null;
      return {
        requirement,
        patch: applianceSelectionPatch({
          requirement,
          record,
          organisationId,
          projectId,
          selectedAt,
          selectedBrandId,
          selectedBrandName,
          selectionMode: "package",
          selectedPackageId,
          selectedPackageName,
          packageSnapshot,
        }),
      };
    })
    .filter(Boolean);
}

import { APPLIANCE_SELECTION_QUOTE_SOURCE } from "./selectionSources.js";
export { APPLIANCE_SELECTION_QUOTE_SOURCE };
const APPLIANCE_QUOTE_SECTION = "APPLIANCES & WHITE GOODS";

function applianceSelectionRows(book = {}) {
  return (book?.rooms || []).flatMap((room) => room.rows || []).flatMap((row) => {
    const selection = row?.guidedSelection || {};
    const productId = selection.canonicalProductId || selection.productId || selection.selectedProductId || "";
    if (!productId || !(selection.applianceFamily || selection.sourceCatalogue === "AU-APPLIANCE-CATALOGUE")) return [];
    return [{ selection, productId }];
  });
}

function appliancePrice(selection = {}) {
  const state = String(selection.priceStatus || selection.priceState || "").toLowerCase().replace(/[^a-z]/g, "");
  if (!["current", "fixed", "currentprice", "approved", "sale"].includes(state)) return null;
  const price = Number(selection.selectedPrice ?? selection.selectedCost);
  return Number.isFinite(price) && price >= 0 ? price : null;
}

function corroboratedApplianceGstBasis(selection = {}, productId, productById) {
  if (typeof selection.priceIncludesGst === "boolean" || typeof productById !== "function") return null;
  const selectedPrice = appliancePrice(selection);
  if (selectedPrice === null) return null;
  const product = productById(productId);
  if (!product) return null;
  const price = resolveProductPrice(product);
  if (price.status !== "current" || price.priceRequired || !Number.isFinite(Number(price.price))
    || typeof price.gstIncluded !== "boolean"
    || ![PRODUCT_PRICE_SOURCES.supplier, PRODUCT_PRICE_SOURCES.builderOverride].includes(price.source)
    || Math.abs(Number(price.price) - selectedPrice) > 0.005) return null;
  const lower = (value) => String(value || "").trim().toLowerCase();
  const selectedSupplier = lower(selection.supplier || selection.brand);
  const catalogueSupplier = lower(product.supplier || product.brand);
  // Older selections stored the brand in `supplier` when the catalogue had no supplier yet.
  // That is not a competing supplier: the same product, price and unit still corroborate.
  const legacyBrandAsSupplier = Boolean(selectedSupplier) && selectedSupplier === lower(selection.brand)
    && selectedSupplier === lower(product.brand);
  if (selectedSupplier && catalogueSupplier && selectedSupplier !== catalogueSupplier && !legacyBrandAsSupplier) return null;
  const selectedUnit = String(selection.unit || "").trim().toUpperCase();
  const catalogueUnit = String(price.unit || "").trim().toUpperCase();
  if (selectedUnit && catalogueUnit && selectedUnit !== catalogueUnit) return null;
  return {
    gstIncluded: price.gstIncluded, source: price.source, sourceUrl: price.sourceUrl, updatedAt: price.updatedAt,
    supplier: String(product.supplier || "").trim(),
  };
}

export function connectApplianceSelectionsToQuotation(workbook = {}, book = {}, { productById } = {}) {
  const selected = applianceSelectionRows(book);
  const previousRows = Object.values(workbook.quotation || {}).flatMap((section) => section?.rows || []);
  const previousManaged = previousRows.filter((row) => row.source === APPLIANCE_SELECTION_QUOTE_SOURCE);
  const quotation = Object.fromEntries(Object.entries(workbook.quotation || {}).map(([name, section]) => [
    name,
    (section?.rows || []).some((row) => row.source === APPLIANCE_SELECTION_QUOTE_SOURCE)
      ? { ...section, rows: section.rows.filter((row) => row.source !== APPLIANCE_SELECTION_QUOTE_SOURCE) }
      : section,
  ]));
  const target = quotation[APPLIANCE_QUOTE_SECTION] || { collapsed: true, rows: [] };
  const rows = selected.map(({ selection, productId }) => {
    const requirementKey = selection.requirementKey || selection.applianceFamily;
    const id = `appliance-selection:${requirementKey}:${productId}`;
    const previous = previousManaged.find((row) => row.id === id && row.productId === productId) || {};
    const quantity = selection.quantity === "" || selection.quantity == null ? 1 : numberValue(selection.quantity);
    const selectedPrice = appliancePrice(selection);
    const priceEvidence = corroboratedApplianceGstBasis(selection, productId, productById);
    const priceIncludesGst = typeof selection.priceIncludesGst === "boolean" ? selection.priceIncludesGst : priceEvidence?.gstIncluded ?? null;
    const quoteRate = selectedPrice === null || priceIncludesGst === null ? null : priceIncludesGst === true ? roundMoney(selectedPrice / 1.1) : selectedPrice;
    const variationPending = quoteRate === null || selection.variationPending === true;
    const allowance = numberValue(selection.allowance ?? selection.originalAllowance);
    const allowanceTotal = roundMoney(allowance * quantity);
    const brand = selection.brand || selection.selectedBrandName || "";
    const model = selection.model || "";
    const productName = selection.productName || selection.selectedProduct || "Selected appliance";
    const item = [brand, productName, model].filter(Boolean).join(" ");
    const description = [selection.description, selection.range, selection.finish, selection.dimensions || selection.size].filter(Boolean).join(" - ");
    const manualQuantity = previous.quantityManualOverride === true;
    return {
      ...previous,
      id,
      source: APPLIANCE_SELECTION_QUOTE_SOURCE,
      section: APPLIANCE_QUOTE_SECTION,
      item,
      rawText: item,
      description,
      productId,
      productCode: selection.productCode || productId,
      productName,
      brand,
      manufacturer: brand,
      model,
      supplier: priceEvidence?.supplier || selection.supplier || brand,
      unit: selection.unit || "EACH",
      quantity: manualQuantity ? previous.quantity : quantity,
      qty: manualQuantity ? previous.quantity : quantity,
      quantityManualOverride: manualQuantity,
      excelRate: quoteRate ?? "",
      priceIncludesGst,
      manualRate: previous.manualRate ?? "",
      sourceOfRate: selectedPrice === null ? "Supplier quote required" : priceIncludesGst === null ? "GST basis to confirm" : "Client Selections / Product Library",
      priceStatus: selectedPrice === null ? "Supplier Quote Required" : priceIncludesGst === null ? "GST basis to confirm" : "Current Price",
      quoteRequired: quoteRate === null,
      lineType: quoteRate === null ? "Quote required" : "Standard rate item",
      allowancePerUnit: allowance,
      allowanceTotal,
      allowanceSource: selection.allowanceSource || "Standard Inclusions",
      // A saved variation predates catalogue GST corroboration and treated the price as ex GST,
      // so recalculate it on the ex-GST rate (variationFor rule: price ex GST - allowance).
      variation: variationPending ? null : priceEvidence
        ? roundMoney((quoteRate - allowance) * quantity)
        : selection.variation ?? roundMoney((quoteRate - allowance) * quantity),
      variationPending,
      included: selection.included === true,
      selectionMode: selection.selectionMode || "build-your-own",
      selectedPackageId: selection.selectedPackageId || "",
      selectedPackageName: selection.selectedPackageName || "",
      selectionDate: selection.selectedAt || selection.selectionDate || "",
      productImageUrl: selection.selectedImageRef || selection.imageUrl || "",
      productLibrarySnapshot: {
        ...selection.metadata?.applianceCatalogueRecord, productId, selectedUnitPrice: selectedPrice, priceIncludesGst,
        ...(priceEvidence ? { priceEvidenceSource: priceEvidence.source, priceSourceUrl: priceEvidence.sourceUrl, priceVerifiedAt: priceEvidence.updatedAt } : {}),
      },
      active: true,
    };
  });
  if (rows.length || target.rows.length) quotation[APPLIANCE_QUOTE_SECTION] = { ...target, rows: [...target.rows.filter((row) => row.source !== APPLIANCE_SELECTION_QUOTE_SOURCE), ...rows] };
  else delete quotation[APPLIANCE_QUOTE_SECTION];

  const procurement = workbook.procurement || {};
  const oldItems = (procurement.items || []).filter((item) => item.source === APPLIANCE_SELECTION_QUOTE_SOURCE);
  const items = (procurement.items || []).filter((item) => item.source !== APPLIANCE_SELECTION_QUOTE_SOURCE);
  selected.forEach(({ selection, productId }) => {
    const requirementKey = selection.requirementKey || selection.applianceFamily;
    const id = `appliance-selection:${requirementKey}:${productId}`;
    const previous = oldItems.find((item) => item.id === id && item.productId === productId) || {};
    const price = appliancePrice(selection);
    const priceEvidence = corroboratedApplianceGstBasis(selection, productId, productById);
    const priceIncludesGst = typeof selection.priceIncludesGst === "boolean" ? selection.priceIncludesGst : priceEvidence?.gstIncluded ?? null;
    const quantity = selection.quantity === "" || selection.quantity == null ? 1 : numberValue(selection.quantity);
    const brand = selection.brand || selection.selectedBrandName || "";
    const model = selection.model || "";
    const productName = selection.productName || selection.selectedProduct || "Selected appliance";
    items.push({
      ...previous,
      id,
      source: APPLIANCE_SELECTION_QUOTE_SOURCE,
      sectionName: APPLIANCE_QUOTE_SECTION,
      itemDescription: [brand, productName, model].filter(Boolean).join(" "),
      productId,
      productCode: selection.productCode || productId,
      supplier: priceEvidence?.supplier || selection.supplier || brand,
      qty: quantity,
      unit: selection.unit || "EACH",
      estimatedRate: price,
      estimatedTotal: price === null ? null : roundMoney(price * quantity),
      priceIncludesGst,
      rateStatus: price === null ? "Supplier quote required" : priceIncludesGst === null ? "GST basis to confirm" : "Current Product Library price",
      selectionMode: selection.selectionMode || "build-your-own",
      selectedPackageId: selection.selectedPackageId || "",
      orderStatus: previous.orderStatus || "Not Started",
      notes: [selection.selectedPackageName, selection.range, selection.finish, selection.dimensions || selection.size].filter(Boolean).join(" - "),
    });
  });
  return { ...workbook, quotation, procurement: { ...procurement, items } };
}

function slugId(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function appliancePriceIncludesGst(record = {}) {
  const declared = record.priceIncludesGst ?? record.gstIncluded;
  if (typeof declared === "boolean") return declared;
  const basis = String(record.priceBasis || record.price_basis || "").trim().toLowerCase();
  if (/\b(?:inc(?:lusive)?|including)\.?\s*gst\b/.test(basis)) return true;
  if (/\b(?:ex(?:clusive)?|excluding)\.?\s*gst\b/.test(basis)) return false;
  return null;
}

export function applianceDetailRows(option = {}) {
  return [
    ["Brand", option.brand],
    ["Model", option.model],
    ["Range", option.range],
    ["Dimensions", option.dimensions || option.size],
    ["Fuel / Energy", option.fuelOrEnergyType],
    ["Installation", option.installationType],
    ["Finish", option.finish],
    ["Image Verification", option.imageVerificationStatus === "approved" ? "Approved supplier image" : APPLIANCE_IMAGE_FALLBACK_LABEL],
  ].filter(([, value]) => value != null && String(value).trim());
}

function dimensionLabel(record = {}) {
  const width = record.width || (record.widthMm ? `${record.widthMm}mm W` : "");
  const height = record.height || (record.heightMm ? `${record.heightMm}mm H` : "");
  const depth = record.depth || (record.depthMm ? `${record.depthMm}mm D` : "");
  return [width, height, depth].filter(Boolean).join(" x ");
}
