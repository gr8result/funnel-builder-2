// lib/product-library/catalogueService.js
//
// ONE canonical catalogue service.
//
// Layering (strict, one direction only):
//
//   STATIC MASTER CATALOGUE FILES   <- committed JSON, immutable base data
//        |
//   MASTER PRODUCT CATALOGUE       <- getMasterProducts(), rebuilt every call
//        |
//   BUILDER OVERRIDES / ENABLEMENT <- per-organisation deltas ONLY
//        |
//   CLIENT SELECTIONS              <- getClientSelectableProducts()
//
// Hard rules enforced here:
//   1. The master catalogue is ALWAYS derived from the committed JSON imports.
//      No browser state, and no caller, can reduce those counts.
//   2. Builder state stores deltas keyed by (organisationId, masterProductCode).
//      It never stores a copy of the master catalogue.
//   3. Absence of builder state means "enabled". Enablement needs no seeding,
//      so a missing/cleared store can never empty a family.

import {
  normalizeMasterProductRecord,
  LOCKED_PRODUCT_FAMILIES,
  familyIsLocked,
} from "./catalogueModel.js";

import qldBrickMasterCatalogue from "../../data/product-library/catalogues/bricks/QLD-BRICKS-MASTER-CATALOGUE.json";
import auMetalRoofingCatalogue from "../../data/product-library/catalogues/roofing/AU-METAL-ROOFING-CATALOGUE.json";
import auFasciaGutterDownpipeCatalogue from "../../data/product-library/catalogues/roofing/AU-FASCIA-GUTTER-DOWNPIPE-CATALOGUE.json";
import auMonierRoofTilesCatalogue from "../../data/product-library/catalogues/roofing/AU-MONIER-ROOF-TILES-CATALOGUE.json";
import auBristileRoofTilesCatalogue from "../../data/product-library/catalogues/roofing/AU-BRISTILE-ROOF-TILES-CATALOGUE.json";
import exteriorFinishesCatalogue from "../../data/product-library/catalogues/exterior/AU-EXTERIOR-FINISHES-CATALOGUE.json";
import exteriorOpeningsCatalogue from "../../data/product-library/catalogues/exterior/AU-WINDOWS-ENTRY-DOORS-GARAGE-DOORS-CATALOGUE.json";
import entryDoorFurnitureCatalogue from "../../data/product-library/catalogues/exterior/AU-ENTRY-DOOR-FURNITURE-CATALOGUE.json";
import internalAreasCatalogue from "../../data/product-library/catalogues/internal/AU-INTERNAL-AREAS-CATALOGUE.json";
import kitchenProductCatalogue from "../../data/product-library/catalogues/kitchen/AU-KITCHEN-PRODUCT-CATALOGUE.json";
import clientSelectionsMigratedCatalogue from "../../data/product-library/catalogues/client-selections/AU-CLIENT-SELECTIONS-MIGRATED-CATALOGUE.js";
import stoneBenchtopCatalogue from "../../data/product-library/catalogues/benchtops/AU-STONE-BENCHTOP-CATALOGUE.json";
import {
  getProductLibraryCabinetryMasterProducts,
} from "./cabinetryCatalogueSelectors.js";
import {
  getAppliancePacks,
  getClientVisibleApplianceRecords,
  getPlatformMasterApplianceRecords,
} from "./applianceCatalogueSelectors.js";
import {
  resolveQuotationBuilderMappingForProduct,
} from "./productLibraryTaxonomy.js";

// --------------------------------------------------------------------------
// Static sources
// --------------------------------------------------------------------------

const LEGACY_KITCHEN_DELEGATED_FAMILY_KEYS = new Set(["cabinetry", "cabinet-finish", "handles", "stone-benchtops"]);

const MASTER_CATALOGUE_SOURCES = [
  { key: "bricks", catalogue: qldBrickMasterCatalogue },
  { key: "roofing", catalogue: auMetalRoofingCatalogue },
  { key: "fascia-gutter-downpipe", catalogue: auFasciaGutterDownpipeCatalogue },
  { key: "monier-roof-tiles", catalogue: auMonierRoofTilesCatalogue },
  { key: "bristile-roof-tiles", catalogue: auBristileRoofTilesCatalogue },
  { key: "exterior-finishes", catalogue: exteriorFinishesCatalogue },
  { key: "exterior-openings", catalogue: exteriorOpeningsCatalogue },
  { key: "kitchen", catalogue: withoutLegacyDelegatedSeeds(kitchenProductCatalogue) },
  { key: "client-selections-migrated", catalogue: clientSelectionsMigratedCatalogue },
  { key: "cabinetry", catalogue: { products: getProductLibraryCabinetryMasterProducts() } },
  { key: "stone-benchtop-surfaces", catalogue: { products: (stoneBenchtopCatalogue.products || []).map(stoneBenchtopToMasterProduct) } },
  { key: "appliances", catalogue: { products: getPlatformMasterApplianceRecords().map(applianceToMasterProduct) } },
  { key: "appliance-packs", catalogue: { products: getAppliancePacks().map(appliancePackToMasterProduct) } },
  { key: "entry-door-furniture", catalogue: entryDoorFurnitureCatalogue },
  { key: "internal-areas", catalogue: internalAreasCatalogue },
];

const APPLIANCE_FAMILY_KEYS = new Set([
  "ovens",
  "cooktops",
  "rangehoods",
  "dishwashers",
  "microwaves",
  "fridges",
  "freestanding-cookers",
]);

const APPLIANCE_CATALOGUE_FAMILY_KEYS = new Set([...APPLIANCE_FAMILY_KEYS, "appliance-packs"]);
const CABINETRY_CATALOGUE_FAMILY_KEYS = new Set(["cabinetry", "cabinet-finish", "handles", "stone-benchtops", "stone-20mm-tops", "stone-40mm-tops"]);

function withoutLegacyDelegatedSeeds(catalogue = {}) {
  return {
    ...catalogue,
    products: (catalogue.products || []).filter((product) => {
      const familyKey = product.familyKey || product.family_key || "";
      return !LEGACY_KITCHEN_DELEGATED_FAMILY_KEYS.has(familyKey);
    }),
  };
}

function slug(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function applianceImageStatus(record = {}) {
  if (record.image) return "verified_exact";
  if (record.imageStatus === "pending-licence") return "review_required";
  return "missing";
}

function appliancePriceStatus(record = {}) {
  if (record.priceStatus === "fixed") return "current";
  if (record.priceStatus === "quote_required") return "quote_required";
  return record.priceStatus || "price_pending";
}

function applianceToMasterProduct(record = {}) {
  const dimensions = [
    record.width || (record.widthMm ? `${record.widthMm} mm` : ""),
    record.height || (record.heightMm ? `${record.heightMm} mm` : ""),
    record.depth || (record.depthMm ? `${record.depthMm} mm` : ""),
  ].filter(Boolean).join(" x ");
  return {
    productId: record.productId,
    productCode: record.productCode || record.productId,
    familyKey: record.familyId,
    requirementKeys: [record.familyId],
    categoryKey: "Appliances",
    topLevelArea: "kitchen",
    manufacturer: record.brand,
    brand: record.brand,
    supplier: record.supplier || record.brand,
    range: record.range || "",
    productName: record.name,
    model: record.model,
    sku: record.sku || record.model,
    description: record.description,
    finish: record.finish,
    size: record.width || (record.widthMm ? `${record.widthMm} mm` : ""),
    dimensions,
    configuration: [record.fuelOrEnergyType, record.installationType].filter(Boolean).join(" / "),
    primaryImageUrl: record.image,
    thumbnailUrl: record.image,
    imageSourceUrl: record.imageSourceUrl || record.productPageUrl || "",
    imageSourceType: record.imageStatus || "",
    imageStatus: applianceImageStatus(record),
    officialProductUrl: record.productPageUrl || "",
    specificationUrl: record.documentUrls?.[0] || "",
    supplierUrl: record.productPageUrl || "",
    clientPrice: record.price,
    normalizedUnitPrice: record.price,
    currency: "AUD",
    priceUnit: record.unit || "EACH",
    priceStatus: appliancePriceStatus(record),
    priceSourceUrl: record.productPageUrl || "",
    priceVerifiedAt: record.sourceCheckedAt || "",
    active: record.eligibility !== "hidden",
    discontinued: false,
    archived: false,
    sourceType: "canonical_appliance_catalogue",
    sourceName: "AU Appliance Catalogue",
    sourceUrl: record.productPageUrl || "data/product-library/catalogues/appliances/AU-APPLIANCE-CATALOGUE.json",
    sourceVerifiedAt: record.sourceCheckedAt || "",
    attributes: {
      applianceCatalogue: true,
      eligibility: record.eligibility,
      selectableStatus: record.selectableStatus,
      verificationStatus: record.verificationStatus,
      eligibilityReasons: record.eligibilityReasons || [],
      discontinuedStatus: record.discontinuedStatus || "",
      discontinuedReviewFlag: record.discontinued === true,
      sourceCostPrice: record.sourceCostPrice,
      familyName: record.familyName,
      applicableRooms: record.applicableRooms || [],
      sourceRowIds: record.sourceRowIds || [],
      imageFallbackLabel: record.imageFallbackLabel || "",
      specificationSummary: record.specificationSummary || {},
    },
  };
}

function appliancePackToMasterProduct(record = {}) {
  return {
    productId: record.productId,
    productCode: record.productCode || record.productId,
    familyKey: "appliance-packs",
    requirementKeys: ["appliance-packs"],
    categoryKey: "Appliances",
    topLevelArea: "kitchen",
    manufacturer: record.brand,
    brand: record.brand,
    supplier: record.supplier || record.brand,
    range: "Appliance Packs",
    productName: record.name,
    model: "",
    sku: record.productCode || record.productId,
    description: record.description,
    configuration: "pack",
    primaryImageUrl: "",
    thumbnailUrl: "",
    imageStatus: "missing",
    clientPrice: record.price,
    normalizedUnitPrice: record.price,
    currency: "AUD",
    priceUnit: "PACK",
    priceStatus: appliancePriceStatus(record),
    active: record.eligibility !== "hidden",
    discontinued: false,
    archived: false,
    sourceType: "canonical_appliance_pack_catalogue",
    sourceName: "AU Appliance Packs",
    sourceUrl: "data/product-library/catalogues/appliances/AU-APPLIANCE-PACKS.json",
    sourceVerifiedAt: record.sourceCheckedAt || "",
    attributes: {
      applianceCatalogue: true,
      appliancePack: true,
      eligibility: record.eligibility,
      selectableStatus: record.selectableStatus,
      verificationStatus: "component-references",
      eligibilityReasons: record.eligibilityReasons || [],
      componentProductIds: record.componentProductIds || [],
      componentWarnings: record.componentWarnings || [],
      imageFallbackLabel: record.imageFallbackLabel || "",
      sourceRelationshipIds: record.sourceRelationshipIds || [],
      sourceRowIds: record.sourceRowIds || [],
    },
  };
}

function masterProductToApplianceRecord(product = {}, organisationId = "") {
  const attributes = product.attributes || {};
  return {
    recordType: attributes.appliancePack ? "appliance-pack" : "appliance-product",
    stableProductId: product.productId || product.productCode || "",
    productId: product.productId || product.productCode || "",
    productCode: product.productCode || product.productId || "",
    categoryId: attributes.categoryId || "category:appliances",
    familyId: product.familyKey || "",
    familyName: attributes.familyName || product.familyKey || "",
    supplier: product.supplier || product.brand || product.manufacturer || "",
    brand: product.brand || product.manufacturer || product.supplier || "",
    brandName: product.brand || product.manufacturer || product.supplier || "",
    brandId: `brand:${slug(product.brand || product.manufacturer || product.supplier)}`,
    brandLogo: product.brandLogoUrl || attributes.brandLogoUrl || "",
    logo: product.brandLogoUrl || attributes.brandLogoUrl || "",
    range: product.range || "",
    model: product.model || product.sku || "",
    name: product.productName || "",
    productName: product.productName || "",
    description: product.description || product.productName || "",
    image: product.primaryImageUrl || "",
    imageFallbackLabel: attributes.imageFallbackLabel || "",
    unit: product.priceUnit || "EACH",
    price: product.builderPrice ?? product.clientPrice ?? product.normalizedUnitPrice ?? null,
    priceStatus: product.priceStatus || (product.clientPrice == null && product.normalizedUnitPrice == null ? "quote_required" : "current"),
    applicableRooms: attributes.applicableRooms || ["kitchen"],
    selectableStatus: attributes.selectableStatus || "client-selectable",
    eligibility: attributes.eligibility || (product.active === false || product.archived ? "hidden" : "verification-required"),
    eligibilityReasons: attributes.eligibilityReasons || [],
    verificationStatus: attributes.verificationStatus || product.imageStatus || "",
    sourcePlatform: product.isCustom ? "tenant" : "platform-master",
    tenantId: product.isCustom ? (product.organisationId || organisationId || "") : "",
    sourceCheckedAt: product.sourceVerifiedAt || "",
    productPageUrl: product.officialProductUrl || "",
    documentUrls: [product.specificationUrl, product.brochureUrl].filter(Boolean),
    width: product.size || "",
    finish: product.finish || "",
    fuelOrEnergyType: attributes.specificationSummary?.fuelOrEnergyType || product.configuration || "",
    installationType: attributes.specificationSummary?.installationType || "",
    specificationSummary: attributes.specificationSummary || attributes,
    active: product.enabled !== false && product.active !== false && !product.archived,
    selectable: product.enabled !== false,
    componentProductIds: attributes.componentProductIds || [],
    components: attributes.components || [],
    componentWarnings: attributes.componentWarnings || [],
  };
}

function laminexColourToMasterProduct(record = {}) {
  return {
    productCode: record.id,
    familyKey: "cabinet-finish",
    requirementKeys: ["cabinet-finish", "cabinetry"],
    categoryKey: "Cabinet Finish",
    topLevelArea: "kitchen",
    manufacturer: "Laminex",
    brand: record.brand || "Laminex",
    supplier: record.supplier || "Laminex",
    range: record.productRange || record.productFamily || "Laminex Decorated Panels & Boards",
    collection: "Laminex Colour Collection",
    productName: `${record.colourName} ${record.finish}`,
    model: record.colourCode || "",
    sku: record.colourCode || record.id || "",
    description: `${record.colourName} ${record.finish} for ${record.application || "cabinetry doors, drawers and panels"}.`,
    colour: record.colourName || "",
    officialColourName: record.colourName || "",
    colourGroup: record.colourFamily || "",
    finish: record.finish || "",
    configuration: record.productRange || "",
    material: record.substrate || "Laminex decorated board",
    primaryImageUrl: record.swatchImage || "",
    thumbnailUrl: record.swatchThumbnail || record.swatchImage || "",
    imageSourceUrl: record.officialSwatchUrl || record.officialProductUrl || "",
    imageSourceType: record.swatchImage ? "verified_exact" : "official_unavailable",
    imageVerifiedAt: record.verifiedAt || "",
    imageStatus: record.swatchImage ? "verified_exact" : "missing",
    officialProductUrl: record.officialProductUrl || "",
    specificationUrl: record.officialCollectionUrl || "",
    supplierUrl: "https://www.laminex.com.au/brands/laminex",
    priceStatus: record.priceStatus === "supplier_quote_required" ? "quote_required" : record.priceStatus || "price_pending",
    priceVerifiedAt: record.verifiedAt || "",
    priceUnit: "ITEM",
    active: record.availabilityStatus !== "inactive",
    discontinued: record.availabilityStatus === "inactive",
    sourceType: "official_supplier_catalogue",
    sourceName: record.source || "Laminex cabinetry colour catalogue",
    sourceUrl: record.officialCollectionUrl || record.officialProductUrl || "",
    sourceVerifiedAt: record.verifiedAt || "",
    attributes: {
      colour: record.colourName || "",
      colourFamily: record.colourFamily || "",
      colourGroup: record.colourFamily || "",
      finish: record.finish || "",
      range: record.productRange || "",
      pricingTier: record.pricingTier || "",
      priceStatus: record.priceStatus || "",
      availabilityStatus: record.availabilityStatus || "active",
      officialSwatchUrl: record.officialSwatchUrl || "",
      application: record.application || "",
    },
  };
}

function polytecColourToMasterProduct(record = {}) {
  return {
    productCode: record.id,
    familyKey: "cabinet-finish",
    requirementKeys: ["cabinet-finish", "cabinetry"],
    categoryKey: "Cabinet Finish",
    topLevelArea: "kitchen",
    manufacturer: "Polytec",
    brand: record.brand || "Polytec",
    supplier: record.supplier || "Polytec",
    range: record.productRange || record.productFamily || "Polytec cabinetry doors and panels",
    collection: "Polytec Colours",
    productName: `${record.colourName} ${record.finish}`,
    model: record.colourCode || "",
    sku: record.colourCode || record.id || "",
    description: record.description || `${record.colourName} ${record.finish} for ${record.application || "cabinetry doors and panels"}.`,
    colour: record.colourName || "",
    officialColourName: record.colourName || "",
    colourGroup: record.colourFamily || "",
    finish: record.finish || "",
    configuration: record.productRange || "",
    material: record.substrate || "Polytec decorative board",
    primaryImageUrl: record.swatchImage || "",
    thumbnailUrl: record.swatchThumbnail || record.swatchImage || "",
    imageSourceUrl: record.officialSwatchUrl || record.officialProductUrl || "",
    imageSourceType: record.swatchImage ? "verified_exact" : "official_unavailable",
    imageVerifiedAt: record.verifiedAt || "",
    imageStatus: record.swatchImage ? "verified_exact" : "missing",
    officialProductUrl: record.officialProductUrl || "",
    specificationUrl: record.officialCollectionUrl || "",
    supplierUrl: "https://www.polytec.com.au/colours/",
    priceStatus: record.priceStatus === "supplier_quote_required" ? "quote_required" : record.priceStatus || "price_pending",
    priceVerifiedAt: record.verifiedAt || "",
    priceUnit: "ITEM",
    active: record.availabilityStatus !== "inactive",
    discontinued: record.availabilityStatus === "inactive",
    sourceType: "official_supplier_catalogue",
    sourceName: record.source || "Polytec official colour page availability matrix",
    sourceUrl: record.sourceUrl || record.officialProductUrl || record.officialCollectionUrl || "",
    sourceVerifiedAt: record.verifiedAt || "",
    attributes: {
      colour: record.colourName || "",
      colourFamily: record.colourFamily || "",
      colourGroup: record.colourFamily || "",
      finish: record.finish || "",
      range: record.productRange || "",
      productApplication: record.productApplication || record.application || "",
      pricingTier: record.pricingTier || "",
      priceStatus: record.priceStatus || "",
      availabilityStatus: record.availabilityStatus || "active",
      officialSwatchUrl: record.officialSwatchUrl || "",
      application: record.application || "",
    },
  };
}

function stoneBenchtopToMasterProduct(record = {}) {
  return {
    productCode: record.id,
    familyKey: "stone-benchtops",
    requirementKeys: ["benchtop", "stone-benchtops"],
    categoryKey: "Benchtops",
    topLevelArea: "kitchen",
    manufacturer: record.supplier || "",
    brand: record.brand || record.supplier || "",
    supplier: record.supplier || "",
    range: record.collection || "",
    collection: record.collection || "",
    productName: `${record.supplier || ""} ${record.productCode || ""} ${record.colourName || ""}`.trim(),
    model: record.productCode || "",
    sku: record.productCode || record.id || "",
    description: record.description || "",
    colour: record.colourName || "",
    officialColourName: record.colourName || "",
    colourGroup: record.colourFamily || "",
    finish: (record.finishOptions || []).join(", "),
    configuration: `${record.materialType || ""} / ${(record.thicknessOptions || []).join(", ")}`.trim(),
    material: record.materialType || "",
    primaryImageUrl: record.primarySwatchImage || "",
    thumbnailUrl: record.primarySwatchImage || record.slabImage || "",
    imageSourceUrl: record.officialImageUrl || record.officialProductUrl || "",
    imageSourceType: record.primarySwatchImage ? "verified_exact" : "official_unavailable",
    imageVerifiedAt: record.verifiedAt || "",
    imageStatus: record.primarySwatchImage ? "verified_exact" : "missing",
    officialProductUrl: record.officialProductUrl || "",
    specificationUrl: record.officialCatalogueUrl || "",
    supplierUrl: record.officialCatalogueUrl || record.officialProductUrl || "",
    priceStatus: record.priceStatus === "supplier_quote_required" ? "quote_required" : record.priceStatus || "price_pending",
    priceVerifiedAt: record.verifiedAt || "",
    priceUnit: "SQM",
    active: record.availabilityStatus !== "inactive",
    discontinued: record.availabilityStatus === "inactive",
    sourceType: "official_supplier_catalogue",
    sourceName: record.source || "Stone benchtop supplier catalogue",
    sourceUrl: record.officialCatalogueUrl || record.officialProductUrl || "",
    sourceVerifiedAt: record.verifiedAt || "",
    attributes: {
      supplier: record.supplier || "",
      productCode: record.productCode || "",
      collection: record.collection || "",
      priceGroup: record.priceGroup || "",
      materialType: record.materialType || "",
      colourFamily: record.colourFamily || "",
      patternType: record.patternType || "",
      finishOptions: record.finishOptions || [],
      thicknessOptions: record.thicknessOptions || [],
      slabSizes: record.slabSizes || [],
      indoorSuitable: record.indoorSuitable,
      outdoorSuitable: record.outdoorSuitable,
      bookmatchAvailable: record.bookmatchAvailable,
      throughBodyVeining: record.throughBodyVeining,
      availabilityRegion: record.availabilityRegion || "",
      requiresManualVerification: Boolean(record.requiresManualVerification),
    },
  };
}

// Families whose committed record counts are contractual. Used by the
// destructive-write guard and by family locking.
export const EXPECTED_FAMILY_MINIMUMS = Object.fromEntries(
  Object.entries(LOCKED_PRODUCT_FAMILIES).map(([familyKey, meta]) => [familyKey, meta.expectedMinimumRecords || 0]),
);

// --------------------------------------------------------------------------
// Storage keys — overrides only. NEVER a master catalogue copy.
// --------------------------------------------------------------------------

export const BUILDER_OVERRIDES_STORAGE_KEY = "gr8:builder-product-overrides";
export const BUILDER_CUSTOM_PRODUCTS_STORAGE_KEY = "gr8:builder-custom-products";

// Retired: previously held a full mutable copy of the master catalogue and was
// the direct cause of completed families disappearing. Read once for migration,
// then never treated as master again.
export const LEGACY_MASTER_CATALOGUE_STORAGE_KEY = "gr8:master-product-catalogue";
export const LEGACY_BUILDER_ENABLEMENT_STORAGE_KEY = "gr8:builder-product-enablement";

// Injectable storage so the service is testable outside the browser.
let storageAdapter = null;

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

export function setCatalogueStorage(adapter) {
  storageAdapter = adapter || null;
}

function storage() {
  if (storageAdapter) return storageAdapter;
  if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  storageAdapter = memoryStorage();
  return storageAdapter;
}

function readJsonArray(key) {
  try {
    const raw = storage().getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeJsonArray(key, value) {
  try {
    storage().setItem(key, JSON.stringify(Array.isArray(value) ? value : []));
    return true;
  } catch {
    return false;
  }
}

// --------------------------------------------------------------------------
// MASTER — always rebuilt from the committed JSON files
// --------------------------------------------------------------------------

let masterCache = null;

export function getMasterProducts() {
  if (masterCache) return masterCache;
  const products = [];
  for (const source of MASTER_CATALOGUE_SOURCES) {
    const rows = Array.isArray(source.catalogue?.products) ? source.catalogue.products : [];
    for (const row of rows) {
      const product = normalizeMasterProductRecord(row);
      const existingIndex = source.key === 'entry-door-furniture' ? products.findIndex(p => p.productCode === product.productCode) : -1;
      if (existingIndex >= 0) products[existingIndex] = { ...products[existingIndex], ...product };
      else products.push(product);
    }
  }
  masterCache = Object.freeze(products);
  return masterCache;
}

// Test hook only — the cache is derived purely from static imports.
export function resetMasterCatalogueCache() {
  masterCache = null;
}

export function getProductsForFamily(familyKey) {
  if (!familyKey) return [];
  return getMasterProducts().filter((product) => product.familyKey === familyKey);
}

export function getMasterFamilyCounts() {
  const counts = {};
  for (const product of getMasterProducts()) {
    if (!product.familyKey) continue;
    counts[product.familyKey] = (counts[product.familyKey] || 0) + 1;
  }
  return counts;
}

export function isProductVisible(product) {
  return Boolean(product) && product.active !== false && !product.archived && !product.discontinued;
}

// --------------------------------------------------------------------------
// DESTRUCTIVE WRITE PROTECTION
// --------------------------------------------------------------------------

export class CatalogueProtectionError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "CatalogueProtectionError";
    this.details = details;
  }
}

// Blocks any operation that would wipe or gut a family that currently has data.
// Individual edits (count unchanged) and additions always pass.
export function assertNonDestructiveFamilyWrite(familyKey, proposedCount, { allowReplacement = false } = {}) {
  const existingCount = getProductsForFamily(familyKey).length;
  if (existingCount === 0) return true;
  if (proposedCount >= existingCount) return true;
  if (proposedCount === 0) {
    throw new CatalogueProtectionError(
      `Blocked: attempt to reduce master family "${familyKey}" from ${existingCount} to 0.`,
      { familyKey, existingCount, proposedCount },
    );
  }
  if (familyIsLocked(familyKey) && !allowReplacement) {
    throw new CatalogueProtectionError(
      `Blocked: "${familyKey}" is LOCKED; bulk replacement (${existingCount} -> ${proposedCount}) is not permitted.`,
      { familyKey, existingCount, proposedCount },
    );
  }
  if (proposedCount < existingCount / 2 && !allowReplacement) {
    throw new CatalogueProtectionError(
      `Blocked: attempt to remove ${existingCount - proposedCount} of ${existingCount} "${familyKey}" products.`,
      { familyKey, existingCount, proposedCount },
    );
  }
  return true;
}

export function familyStatus(familyKey) {
  return familyIsLocked(familyKey) ? "LOCKED" : "draft";
}

// --------------------------------------------------------------------------
// BUILDER LAYER — overrides + custom products, keyed by organisation
// --------------------------------------------------------------------------

const OVERRIDE_FIELDS = [
  "enabled",
  "builderPrice",
  "allowance",
  "supplierOverride",
  "imageOverride",
  "notes",
  "customFields",
];

function overrideIdentity(override) {
  return `${override.organisationId || ""}::${override.masterProductCode || ""}`;
}

export function getBuilderOverrides(organisationId = "") {
  migrateLegacyStateOnce();
  return readJsonArray(BUILDER_OVERRIDES_STORAGE_KEY).filter(
    (row) => row && row.masterProductCode && (!organisationId || row.organisationId === organisationId),
  );
}

function overrideMap(organisationId) {
  const map = new Map();
  for (const row of getBuilderOverrides(organisationId)) map.set(row.masterProductCode, row);
  return map;
}

export function getBuilderCustomProducts(organisationId = "", familyKey = "") {
  migrateLegacyStateOnce();
  return readJsonArray(BUILDER_CUSTOM_PRODUCTS_STORAGE_KEY)
    .filter((row) => row && (!organisationId || row.organisationId === organisationId))
    .filter((row) => !familyKey || row.familyKey === familyKey)
    .map((row) => ({ ...normalizeMasterProductRecord(row), organisationId: row.organisationId, isCustom: true }));
}

function applyOverride(product, override) {
  if (!override) return { ...product, enabled: true, hasOverride: false };
  const next = { ...product, enabled: override.enabled !== false, hasOverride: true };
  if (override.builderPrice != null) next.builderPrice = override.builderPrice;
  if (override.allowance != null) next.allowance = override.allowance;
  if (override.supplierOverride) next.supplier = override.supplierOverride;
  if (override.imageOverride) {
    next.media = { ...(next.media || {}), primaryImageUrl: override.imageOverride };
    next.primaryImageUrl = override.imageOverride;
    next.thumbnailUrl = override.imageOverride;
    next.imageOverride = override.imageOverride;
  }
  if (override.notes) next.notes = override.notes;
  if (override.customFields) {
    next.customFields = { ...(next.customFields || {}), ...override.customFields };
    if (override.customFields.description) next.description = override.customFields.description;
    if (override.customFields.model) next.model = override.customFields.model;
    if (override.customFields.productName) next.productName = override.customFields.productName;
    if (override.customFields.productAttributes?.internalAreasCatalogue) {
      for (const field of ['range','finish','size','profile','priceUnit','priceStatus','imageStatus']) if (override.customFields[field] != null) next[field]=override.customFields[field];
      if (override.builderPrice != null) { next.clientPrice=override.builderPrice; next.priceStatus='current'; }
    }
    next.attributes = {
      ...(next.attributes || {}),
      ...(override.customFields.productAttributes || {}),
      clientSelectable: override.customFields.clientSelectable ?? next.attributes?.clientSelectable,
      quotationEnabled: override.customFields.quotationEnabled ?? next.attributes?.quotationEnabled,
    };
  }
  return next;
}

// Full builder-facing catalogue: every master product for the family, plus the
// organisation's custom products, with overrides applied. Master records are
// always present here regardless of builder state - that is the whole point.
export function getBuilderProducts(organisationId = "", familyKey = "") {
  const overrides = overrideMap(organisationId);
  const master = (familyKey ? getProductsForFamily(familyKey) : getMasterProducts())
    .map((product) => applyOverride(product, overrides.get(product.productCode)));
  const custom = getBuilderCustomProducts(organisationId, familyKey)
    .map((product) => applyOverride(product, overrides.get(product.productCode)));
  return [...master, ...custom];
}

// What the client may actually choose: builder products that are visible and
// not explicitly disabled by the builder.
export function getClientSelectableProducts(organisationId = "", familyKey = "") {
  return getBuilderProducts(organisationId, familyKey).filter(
    (product) => product.enabled !== false && isProductVisible(product),
  );
}

// --------------------------------------------------------------------------
// MUTATIONS — always deltas, never a master rewrite
// --------------------------------------------------------------------------

export function toCanonicalProductContract(product = {}, { organisationId = "" } = {}) {
  const owner = product.isCustom ? "builder-private" : "product-library";
  const quotationMapping = resolveQuotationBuilderMappingForProduct(product);
  return {
    stableProductId: product.productId || product.productCode || "",
    productCode: product.productCode || "",
    catalogueOwner: owner,
    organisationId: product.isCustom ? (product.organisationId || organisationId || "") : "",
    categoryId: product.categoryId || product.categoryKey || "",
    categoryKey: product.categoryKey || "",
    familyId: product.familyKey || "",
    familyKey: product.familyKey || "",
    supplier: product.supplier || product.manufacturer || "",
    brand: product.brand || product.manufacturer || "",
    range: product.range || product.collection || "",
    productModel: product.model || product.sku || "",
    productName: product.productName || "",
    description: product.description || "",
    imageReference: product.primaryImageUrl || product.thumbnailUrl || "",
    imageStatus: product.imageStatus || "",
    unit: product.priceUnit || "",
    price: product.builderPrice ?? product.clientPrice ?? product.normalizedUnitPrice ?? null,
    priceStatus: product.priceStatus || "",
    applicableRooms: product.attributes?.applicableRooms || [],
    selectable: product.enabled !== false && isProductVisible(product),
    quotationMappingId: product.attributes?.quotationMappingId || product.linkedQuoteItemCode || product.quoteStructureRowId || "",
    quotationSectionId: product.attributes?.quotationSectionId || quotationMapping.quotationSectionId,
    quotationSection: product.attributes?.quotationSection || quotationMapping.quotationSection,
    quotationSubsectionId: product.attributes?.quotationSubsectionId || quotationMapping.quotationSubsectionId,
    quotationSubsection: product.attributes?.quotationSubsection || quotationMapping.quotationSubsection,
    quotationLineCategory: product.attributes?.quotationLineCategory || quotationMapping.quotationLineCategory,
    sourceType: product.sourceType || "",
    sourceName: product.sourceName || "",
    sourceUrl: product.sourceUrl || product.officialProductUrl || "",
    sourceVerifiedAt: product.sourceVerifiedAt || product.priceVerifiedAt || product.imageVerifiedAt || "",
    snapshotPolicy: "consumers store immutable selection snapshots; Product Library owns the canonical record",
  };
}

export function getEffectiveProductCatalogue({
  organisationId = "",
  tenantId = "",
  builderId = "",
  catalogueVersion = "product-library.current",
  familyKey = "",
  topLevelArea = "",
  categoryKey = "",
  roomKey = "",
  includeDisabled = false,
} = {}) {
  const effectiveOrganisationId = organisationId || builderId || tenantId || "";
  const products = (includeDisabled ? getBuilderProducts(effectiveOrganisationId, familyKey) : getClientSelectableProducts(effectiveOrganisationId, familyKey))
    .filter((product) => !topLevelArea || product.topLevelArea === topLevelArea)
    .filter((product) => !categoryKey || product.categoryKey === categoryKey)
    .filter((product) => {
      if (!roomKey) return true;
      const rooms = product.attributes?.applicableRooms || [];
      return rooms.includes(roomKey) || product.topLevelArea === roomKey;
    });
  const canonicalProducts = products.map((product) => toCanonicalProductContract(product, { organisationId: effectiveOrganisationId }));
  return Object.freeze({
    organisationId: effectiveOrganisationId,
    tenantId: tenantId || effectiveOrganisationId,
    builderId: builderId || effectiveOrganisationId,
    catalogueVersion,
    products,
    canonicalProducts,
    counts: Object.freeze({
      total: products.length,
      platformMaster: products.filter((product) => !product.isCustom).length,
      builderPrivate: products.filter((product) => product.isCustom).length,
      disabledIncluded: includeDisabled ? products.filter((product) => product.enabled === false).length : 0,
    }),
  });
}

export function getEffectiveCabinetryCatalogue({
  organisationId = "",
  roomKey = "",
  includeDisabled = false,
} = {}) {
  const products = (includeDisabled ? getBuilderProducts(organisationId) : getClientSelectableProducts(organisationId))
    .filter((product) => CABINETRY_CATALOGUE_FAMILY_KEYS.has(product.familyKey))
    .filter((product) => {
      if (product.familyKey !== "handles") return true;
      const handleUse = String(product.attributes?.handleUse || product.attributes?.choiceType || product.categoryKey || "").toLowerCase();
      return !/entry|external-door/.test(handleUse);
    })
    .filter((product) => {
      if (!roomKey) return true;
      const rooms = product.attributes?.applicableRooms || [];
      return rooms.includes(roomKey) || product.topLevelArea === roomKey;
    });
  const byCanonicalType = {};
  for (const product of products) {
    const canonicalType = product.attributes?.canonicalType
      || (product.familyKey === "cabinet-finish" ? "finish_product"
        : product.familyKey === "handles" ? "handle_product"
          : product.familyKey === "stone-benchtops" ? "benchtop_product"
            : "catalogue_product");
    byCanonicalType[canonicalType] = (byCanonicalType[canonicalType] || 0) + 1;
  }
  return Object.freeze({
    organisationId,
    serviceName: "getEffectiveCabinetryCatalogue",
    products,
    canonicalProducts: products.map((product) => toCanonicalProductContract(product, { organisationId })),
    counts: Object.freeze({
      total: products.length,
      platformMaster: products.filter((product) => !product.isCustom).length,
      builderPrivate: products.filter((product) => product.isCustom).length,
      disabledIncluded: includeDisabled ? products.filter((product) => product.enabled === false).length : 0,
      byCanonicalType: Object.freeze(byCanonicalType),
    }),
  });
}

export function getEffectiveApplianceCatalogue({ organisationId = "" } = {}) {
  const enabledProducts = getClientSelectableProducts(organisationId)
    .filter((product) => APPLIANCE_CATALOGUE_FAMILY_KEYS.has(product.familyKey))
    .filter((product) => product.attributes?.applianceCatalogue || product.isCustom);
  const enabledProductIds = new Set(enabledProducts.flatMap((product) => [product.productId, product.productCode]).filter(Boolean));
  const productRows = enabledProducts.filter((product) => APPLIANCE_FAMILY_KEYS.has(product.familyKey));
  const platformRecords = getClientVisibleApplianceRecords()
    .filter((record) => enabledProductIds.has(record.productId) || enabledProductIds.has(record.productCode));
  const platformRecordIds = new Set(platformRecords.flatMap((record) => [record.productId, record.productCode]).filter(Boolean));
  const builderPrivateRecords = productRows
    .filter((product) => product.isCustom || (!platformRecordIds.has(product.productId) && !platformRecordIds.has(product.productCode)))
    .map((product) => masterProductToApplianceRecord(product, organisationId));

  const enabledPackProducts = enabledProducts.filter((product) => product.familyKey === "appliance-packs");
  const enabledPackIds = new Set(enabledPackProducts.flatMap((product) => [product.productId, product.productCode]).filter(Boolean));
  const platformPacks = getAppliancePacks()
    .filter((pack) => enabledPackIds.has(pack.productId) || enabledPackIds.has(pack.productCode) || enabledPackIds.has(pack.packId))
    .filter((pack) => pack.active !== false && pack.selectable !== false && !["hidden", "draft"].includes(pack.eligibility || ""));
  const platformPackIds = new Set(platformPacks.flatMap((pack) => [pack.productId, pack.productCode, pack.packId]).filter(Boolean));
  const builderPrivatePacks = enabledPackProducts
    .filter((product) => product.isCustom || (!platformPackIds.has(product.productId) && !platformPackIds.has(product.productCode)))
    .map((product) => masterProductToApplianceRecord(product, organisationId));

  const records = [...platformRecords, ...builderPrivateRecords];
  const packs = [...platformPacks, ...builderPrivatePacks];
  const brands = Array.from(new Set([...records.map((record) => record.brand), ...packs.map((pack) => pack.brand)].filter(Boolean)))
    .sort((left, right) => left.localeCompare(right));
  return Object.freeze({
    organisationId,
    records,
    packs,
    brands,
    counts: Object.freeze({
      products: records.length,
      packs: packs.length,
      relationships: packs.reduce((total, pack) => total + (pack.componentRelationships?.length || pack.componentProductIds?.length || pack.components?.length || 0), 0),
      brands: brands.length,
      platformProducts: platformRecords.length,
      builderPrivateProducts: builderPrivateRecords.length,
    }),
  });
}

export function updateBuilderProductOverride(organisationId, masterProductCode, patch = {}) {
  if (!organisationId || !masterProductCode) return null;
  const rows = readJsonArray(BUILDER_OVERRIDES_STORAGE_KEY);
  const next = { organisationId, masterProductCode };
  for (const field of OVERRIDE_FIELDS) {
    if (patch[field] !== undefined) next[field] = patch[field];
  }
  const identity = overrideIdentity(next);
  const index = rows.findIndex((row) => overrideIdentity(row) === identity);
  const merged = index >= 0 ? { ...rows[index], ...next } : next;
  if (index >= 0) rows[index] = merged;
  else rows.push(merged);
  writeJsonArray(BUILDER_OVERRIDES_STORAGE_KEY, rows);
  return merged;
}

export function enableProduct(organisationId, masterProductCode) {
  return updateBuilderProductOverride(organisationId, masterProductCode, { enabled: true });
}

export function disableProduct(organisationId, masterProductCode) {
  return updateBuilderProductOverride(organisationId, masterProductCode, { enabled: false });
}

// Appends an organisation-specific product. Never touches static master data.
export function addBuilderProduct(organisationId, product = {}) {
  if (!organisationId) return null;
  const normalized = normalizeMasterProductRecord(product);
  if (!normalized.productCode) return null;
  if (getMasterProducts().some((row) => row.productCode === normalized.productCode)) {
    throw new CatalogueProtectionError(
      `Blocked: "${normalized.productCode}" is a static master product and cannot be redefined as a custom product.`,
      { productCode: normalized.productCode },
    );
  }
  const rows = readJsonArray(BUILDER_CUSTOM_PRODUCTS_STORAGE_KEY);
  const index = rows.findIndex(
    (row) => row.organisationId === organisationId && row.productCode === normalized.productCode,
  );
  const record = { ...normalized, organisationId, isCustom: true };
  if (index >= 0) rows[index] = record;
  else rows.push(record);
  writeJsonArray(BUILDER_CUSTOM_PRODUCTS_STORAGE_KEY, rows);
  return record;
}

export function removeBuilderProduct(organisationId, productCode) {
  const rows = readJsonArray(BUILDER_CUSTOM_PRODUCTS_STORAGE_KEY);
  const kept = rows.filter((row) => !(row.organisationId === organisationId && row.productCode === productCode));
  writeJsonArray(BUILDER_CUSTOM_PRODUCTS_STORAGE_KEY, kept);
  return rows.length - kept.length;
}

// --------------------------------------------------------------------------
// LEGACY MIGRATION — extract deltas from the retired master-copy key, once.
// --------------------------------------------------------------------------

let migrationDone = false;

export function resetLegacyMigrationFlag() {
  migrationDone = false;
}

export function migrateLegacyStateOnce({ force = false } = {}) {
  if (migrationDone && !force) return { migrated: false };
  migrationDone = true;

  const legacyMaster = readJsonArray(LEGACY_MASTER_CATALOGUE_STORAGE_KEY);
  const legacyEnablement = readJsonArray(LEGACY_BUILDER_ENABLEMENT_STORAGE_KEY);
  if (!legacyMaster.length && !legacyEnablement.length) return { migrated: false };

  const masterByCode = new Map(getMasterProducts().map((p) => [p.productCode, p]));
  const existing = readJsonArray(BUILDER_OVERRIDES_STORAGE_KEY);
  const byIdentity = new Map(existing.map((row) => [overrideIdentity(row), row]));
  const customRows = readJsonArray(BUILDER_CUSTOM_PRODUCTS_STORAGE_KEY);
  const organisations = new Set(legacyEnablement.map((e) => e.organisationId).filter(Boolean));

  let overrideCount = 0;
  let customCount = 0;

  // Preserve genuine per-product builder edits that were trapped in the old
  // master copy. Deliberately DROPS active/archived/discontinued/familyKey -
  // those belong to master and were the fields that hid completed families.
  for (const row of legacyMaster) {
    const code = row?.productCode || row?.product_code;
    if (!code) continue;
    if (!masterByCode.has(code)) {
      if (row.organisationId) {
        customRows.push({ ...row, organisationId: row.organisationId, isCustom: true });
        customCount += 1;
      }
      continue;
    }
    const patch = {};
    if (row.builderPrice != null) patch.builderPrice = row.builderPrice;
    if (row.allowance != null) patch.allowance = row.allowance;
    if (row.notes) patch.notes = row.notes;
    if (row.imageOverride) patch.imageOverride = row.imageOverride;
    if (!Object.keys(patch).length) continue;
    for (const org of organisations) {
      const identity = `${org}::${code}`;
      const base = byIdentity.get(identity) || { organisationId: org, masterProductCode: code };
      byIdentity.set(identity, { ...base, ...patch });
      overrideCount += 1;
    }
  }

  // Carry across explicit disables only. Everything else defaults to enabled.
  for (const row of legacyEnablement) {
    if (!row?.organisationId || !row?.masterProductCode) continue;
    if (row.enabled !== false && row.active !== false) continue;
    const identity = overrideIdentity(row);
    const base = byIdentity.get(identity) || {
      organisationId: row.organisationId,
      masterProductCode: row.masterProductCode,
    };
    byIdentity.set(identity, { ...base, enabled: false });
    overrideCount += 1;
  }

  writeJsonArray(BUILDER_OVERRIDES_STORAGE_KEY, Array.from(byIdentity.values()));
  if (customCount) writeJsonArray(BUILDER_CUSTOM_PRODUCTS_STORAGE_KEY, customRows);

  // Retire the dangerous key so it can never act as master again.
  try {
    storage().removeItem(LEGACY_MASTER_CATALOGUE_STORAGE_KEY);
  } catch {
    /* non-fatal */
  }

  return { migrated: true, overrideCount, customCount };
}

// --------------------------------------------------------------------------
// COMPATIBILITY BRIDGE
// --------------------------------------------------------------------------
//
// queryClientSelectableProducts() in catalogueModel.js is ref-driven: a master
// product is only selectable if a matching builder ref exists. That design is
// what made a missing/stale enablement store able to empty a whole family.
//
// This bridge emits a ref for EVERY master and custom product, so the default
// is "enabled" and no seeding step is required. Overrides only flip `enabled`
// and carry per-product builder values.

export function getBuilderEnablementRefs(organisationId = "", familyKey = "") {
  const overrides = overrideMap(organisationId);
  const master = familyKey ? getProductsForFamily(familyKey) : getMasterProducts();
  const custom = getBuilderCustomProducts(organisationId, familyKey);
  return [...master, ...custom].map((product) => {
    const override = overrides.get(product.productCode);
    const ref = {
      organisationId,
      masterProductCode: product.productCode,
      masterProductId: product.productId,
      enabled: override ? override.enabled !== false : true,
      active: true,
    };
    if (override?.builderPrice != null) ref.builderPrice = override.builderPrice;
    if (override?.allowance != null) ref.allowance = override.allowance;
    if (override?.supplierOverride) ref.supplierOverride = override.supplierOverride;
    if (override?.imageOverride) ref.imageOverride = override.imageOverride;
    if (override?.notes) ref.notes = override.notes;
    return ref;
  });
}

// Family counts as the builder sees them (master + custom), for Product Library.
export function getBuilderFamilyCounts(organisationId = "") {
  const counts = {};
  for (const product of getBuilderProducts(organisationId)) {
    if (!product.familyKey) continue;
    counts[product.familyKey] = (counts[product.familyKey] || 0) + 1;
  }
  return counts;
}
