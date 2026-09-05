import { numberValue, roundMoney } from "./selectionBudget.js";
import { APPLIANCE_IMAGE_FALLBACK_LABEL } from "../product-library/applianceCatalogueSelectorsCore.js";

export const APPLIANCE_CLIENT_FAMILY_KEYS = [
  "ovens",
  "cooktops",
  "rangehoods",
  "dishwashers",
  "microwaves",
  "fridges",
  "freestanding-cookers",
  "appliance-packs",
];

export function isApplianceRequirement(requirement = {}) {
  return requirement.areaKey === "appliances" && APPLIANCE_CLIENT_FAMILY_KEYS.includes(requirement.familyKey);
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
  (Array.isArray(packs) ? packs : []).forEach((pack) => {
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
    .filter((record) => !familyId || record.familyId === familyId)
    .filter((record) => !brandKey || String(record.brand || record.brandName || "").trim().toLowerCase() === brandKey)
    .sort((left, right) => (left.model || left.name || "").localeCompare(right.model || right.name || ""));
}

export function applianceProductTypesForBrand(records = [], requirements = [], brand = "") {
  const brandRecords = applianceRecordsForBrand(records, brand);
  return (Array.isArray(requirements) ? requirements : [])
    .filter((requirement) => isApplianceRequirement(requirement) && requirement.familyKey !== "appliance-packs")
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
  const variation = selectedPrice == null ? null : roundMoney((selectedPrice - allowance) * quantity);
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
    originalAllowance: allowance,
    allowance,
    variation,
    variationPending: selectedPrice == null,
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
  const recordById = new Map((Array.isArray(records) ? records : []).map((record) => [record.productId || record.stableProductId, record]));
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

function slugId(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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
