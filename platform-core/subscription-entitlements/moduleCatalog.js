// Module entitlement vocabulary.
//
// This is the single source of truth for WHAT can be entitled. It deliberately
// says nothing about WHO is entitled — that is resolveEntitlements.js — and
// nothing about where a module's code lives.
//
// The governing principle (PLATFORM_MODULARISATION_MASTER_PLAN.md §13.1):
// physical code ownership and commercial packaging are separate concerns. Every
// major feature owns a module folder even when it is commercially bundled, so a
// module can later be sold separately without a file-tree restructure. Selling a
// bundled module on its own is a data change here, not a code change.

/** Every entitlement code the platform recognises. */
export const MODULE_CODES = Object.freeze({
  // Construction / builder domain
  ESTIMATE_BUILDER: "estimate_builder",
  QUOTATION_BUILDER: "quotation_builder",
  ESTIMATING_CATALOGUE: "estimating_catalogue",
  BUDGET_VS_ACTUAL: "budget_vs_actual",
  AI_PLAN_TAKEOFF: "ai_plan_takeoff",
  PRODUCT_LIBRARY: "product_library",
  PRODUCT_LIBRARY_READ: "product_library_read",
  CLIENT_SELECTIONS: "client_selections",
  STANDARD_INCLUSIONS: "standard_inclusions",
  BOQ: "boq",
  VARIATIONS: "variations",
  SUPPLIER_PROCUREMENT: "supplier_procurement",
  DOCUMENT_VAULT: "document_vault",
  RFI_REPORTS: "rfi_reports",
  GANTT_CHART: "gantt_chart",
  JOB_BOARD: "job_board",
  CLIENT_PORTAL: "client_portal",

  // Independent
  FREEDOM: "freedom",

  // Sales / marketing
  LEADS: "leads",
  CRM: "crm",
  WEBSITE_BUILDER: "website_builder",
});

/** Codes that exist today in lib/moduleEntitlements.js and keep their meaning. */
export const LEGACY_MODULE_CODES = Object.freeze([
  "email_marketing",
  "social_media",
  "sms_marketing",
  "booking_calendar",
  "funnels",
  "business_automation",
  "affiliate_management",
  "pipelines",
  "evergreen_webinars",
  "project_workspace",
]);

export const ALL_MODULE_CODES = Object.freeze([
  ...Object.values(MODULE_CODES),
  ...LEGACY_MODULE_CODES,
]);

// Job Details is deliberately absent. It is the Project Workspace core service
// and is never sold separately, so it has no code of its own and cannot be
// accidentally gated or sold. Its folder lives at modules/job-details/.
export const CORE_SERVICES_WITHOUT_CODES = Object.freeze(["job-details"]);

// Codes that must never be created: Purchase Orders, Supplier Invoices and
// Quote Approvals are functions inside supplier-procurement, covered by the
// single supplier_procurement entitlement (master plan §13.3).
export const FORBIDDEN_CODES = Object.freeze([
  "purchase_orders",
  "supplier_invoices",
  "quote_approvals",
]);

/** Bundles: owning the bundle code entitles every member code. */
export const BUNDLES = Object.freeze({
  builder_suite: Object.freeze([
    MODULE_CODES.ESTIMATE_BUILDER,
    MODULE_CODES.QUOTATION_BUILDER,
    MODULE_CODES.CLIENT_SELECTIONS,
    MODULE_CODES.BUDGET_VS_ACTUAL,
    MODULE_CODES.AI_PLAN_TAKEOFF,
    MODULE_CODES.STANDARD_INCLUSIONS,
    MODULE_CODES.BOQ,
    MODULE_CODES.VARIATIONS,
    MODULE_CODES.SUPPLIER_PROCUREMENT,
    MODULE_CODES.DOCUMENT_VAULT,
    MODULE_CODES.RFI_REPORTS,
    MODULE_CODES.GANTT_CHART,
    MODULE_CODES.JOB_BOARD,
    MODULE_CODES.CLIENT_PORTAL,
  ]),
  estimate_bundle: Object.freeze([
    MODULE_CODES.ESTIMATE_BUILDER,
    MODULE_CODES.QUOTATION_BUILDER,
  ]),
});

/**
 * Grants: owning the key implies the values. Resolved as a transitive closure,
 * so a grant may itself grant further codes.
 *
 * Direction matters. `crm` grants `leads`; `leads` does NOT grant `crm`, so a
 * Leads-only customer never receives CRM functions.
 */
export const GRANTS = Object.freeze({
  [MODULE_CODES.ESTIMATE_BUILDER]: Object.freeze([
    MODULE_CODES.ESTIMATING_CATALOGUE,
    MODULE_CODES.PRODUCT_LIBRARY_READ,
  ]),
  [MODULE_CODES.QUOTATION_BUILDER]: Object.freeze([
    MODULE_CODES.ESTIMATING_CATALOGUE,
    MODULE_CODES.PRODUCT_LIBRARY_READ,
  ]),
  [MODULE_CODES.CLIENT_SELECTIONS]: Object.freeze([
    MODULE_CODES.PRODUCT_LIBRARY_READ,
  ]),
  [MODULE_CODES.PRODUCT_LIBRARY]: Object.freeze([
    MODULE_CODES.PRODUCT_LIBRARY_READ,
  ]),
  [MODULE_CODES.CRM]: Object.freeze([MODULE_CODES.LEADS]),
});

/** True when `code` names a bundle rather than a module. */
export function isBundleCode(code) {
  return Object.prototype.hasOwnProperty.call(BUNDLES, String(code || ""));
}

/** True when `code` is a module code this platform recognises. */
export function isKnownModuleCode(code) {
  return ALL_MODULE_CODES.includes(String(code || ""));
}
