// Public surface of the subscription-entitlements package.
//
// Consumers should import from here, never from the individual files, so the
// internals can be reorganised without touching call sites.

export {
  MODULE_CODES,
  LEGACY_MODULE_CODES,
  ALL_MODULE_CODES,
  CORE_SERVICES_WITHOUT_CODES,
  FORBIDDEN_CODES,
  BUNDLES,
  GRANTS,
  isBundleCode,
  isKnownModuleCode,
} from "./moduleCatalog.js";

export {
  normaliseCode,
  normaliseCodes,
  expandBundles,
  applyGrants,
  resolveEntitlements,
  hasModuleAccess,
} from "./resolveEntitlements.js";

export {
  createEntitlementResolver,
  entitlementResolver,
} from "./serverEntitlements.js";
