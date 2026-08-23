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
import kitchenProductCatalogue from "../../data/product-library/catalogues/kitchen/AU-KITCHEN-PRODUCT-CATALOGUE.json";

// --------------------------------------------------------------------------
// Static sources
// --------------------------------------------------------------------------

const MASTER_CATALOGUE_SOURCES = [
  { key: "bricks", catalogue: qldBrickMasterCatalogue },
  { key: "roofing", catalogue: auMetalRoofingCatalogue },
  { key: "fascia-gutter-downpipe", catalogue: auFasciaGutterDownpipeCatalogue },
  { key: "monier-roof-tiles", catalogue: auMonierRoofTilesCatalogue },
  { key: "bristile-roof-tiles", catalogue: auBristileRoofTilesCatalogue },
  { key: "exterior-finishes", catalogue: exteriorFinishesCatalogue },
  { key: "exterior-openings", catalogue: exteriorOpeningsCatalogue },
  { key: "kitchen", catalogue: kitchenProductCatalogue },
];

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
    for (const row of rows) products.push(normalizeMasterProductRecord(row));
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
    next.imageOverride = override.imageOverride;
  }
  if (override.notes) next.notes = override.notes;
  if (override.customFields) next.customFields = { ...(next.customFields || {}), ...override.customFields };
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
