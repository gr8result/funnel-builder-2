// lib/moduleEntitlements.js
//
// Pure, dependency-free entitlement logic shared by the server
// (lib/entitlements.js, pages/api/billing/*) and the client
// (pages/dashboard.js). No DB client is imported here on purpose: the
// dashboard runs in the browser and must not pull supabaseAdmin into the
// bundle.
//
// Three states are kept strictly independent. They were previously collapsed
// into one `active` boolean, which is why a paid-up customer saw "Not set up"
// against every module:
//
//   AVAILABILITY  - is the module released, or Coming Soon?
//   ENTITLEMENT   - is it included in the current subscription?
//   SETUP         - has it actually been configured?
//
// Entitlement is derived from the existing plan-tier system
// (workspaces.plan + lib/featureGates.js) plus any add-on module rows. No new
// subscription system is introduced.

import { FEATURE_PLANS, PLANS } from "./featureGates";

// Billing/module ids -> dashboard module ids.
export const DASHBOARD_MODULE_ALIASES = {
  crm: "crm",
  email: "email_marketing",
  email_marketing: "email_marketing",
  sms: "sms_marketing",
  sms_marketing: "sms_marketing",
  social: "social_media",
  social_media: "social_media",
  calendar: "booking_calendar",
  booking_calendar: "booking_calendar",
  "website-builder": "website_builder",
  website_builder: "website_builder",
  automation: "business_automation",
  business_automation: "business_automation",
  webinars: "evergreen_webinars",
  evergreen_webinars: "evergreen_webinars",
  subscription: "pipelines",
  pipelines: "pipelines",
  funnels: "funnels",
  affiliates: "affiliate_management",
  affiliate_management: "affiliate_management",
  // Project Workspace (formerly "Projects Hub"). The billing/module id stays
  // "projects-hub" for compatibility; only the user-facing label changed.
  "projects-hub": "project_workspace",
  projects_hub: "project_workspace",
  project_workspace: "project_workspace",
  construction: "project_workspace",
};

// Dashboard module -> the featureGates feature that a base plan unlocks.
// Modules with no entry here are add-on purchases only.
export const MODULE_PLAN_FEATURES = {
  crm: "crm_basic",
  email_marketing: "email_marketing",
  sms_marketing: "sms",
  social_media: "social_media",
  booking_calendar: "booking_calendar",
  website_builder: "website_builder",
  funnels: "funnels",
  business_automation: "business_automation",
};

export function normalizeDashboardModuleId(moduleId) {
  if (!moduleId) return "";
  return DASHBOARD_MODULE_ALIASES[moduleId] || moduleId;
}

// Pseudo module_id rows already used by billing to avoid schema changes
// (e.g. "__social_plan_tier:social-pro"). Plan metadata, not entitlements.
export function isPseudoModuleRow(moduleId) {
  return typeof moduleId === "string" && moduleId.startsWith("__");
}

export const BILLING_CYCLE_ROW_PREFIX = "__billing_cycle:";

export function billingCycleRow(cycle) {
  return BILLING_CYCLE_ROW_PREFIX + cycle;
}

export function readBillingCycle(moduleIds) {
  const rows = Array.isArray(moduleIds) ? moduleIds : [];
  const row = rows.find((id) => typeof id === "string" && id.startsWith(BILLING_CYCLE_ROW_PREFIX));
  return row ? row.slice(BILLING_CYCLE_ROW_PREFIX.length) : "";
}

// --------------------------------------------------------------------------
// SETUP requirements
// --------------------------------------------------------------------------
//
// Only modules with a genuine configuration step appear here. Everything else
// is usable the moment it is entitled and must never render "Setup required"
// (item 5: a module that needs no setup is simply available immediately).

export const SETUP_REQUIREMENTS = {
  email_marketing: {
    label: "Connect your sending domain",
    isComplete: (ctx) => Boolean(ctx?.account?.sendgrid_connected || ctx?.account?.sendgrid_from_email),
  },
  sms_marketing: {
    label: "Add your SMS sender details",
    isComplete: (ctx) => Boolean(ctx?.account?.sender_id || ctx?.account?.sms_api_key || ctx?.account?.twilio_phone),
  },
};

export function moduleRequiresSetup(dashboardModuleId) {
  return Object.prototype.hasOwnProperty.call(SETUP_REQUIREMENTS, dashboardModuleId);
}

export function moduleSetupComplete(dashboardModuleId, ctx) {
  const requirement = SETUP_REQUIREMENTS[dashboardModuleId];
  if (!requirement) return true;
  try {
    return Boolean(requirement.isComplete(ctx || {}));
  } catch {
    return false;
  }
}

export function moduleSetupLabel(dashboardModuleId) {
  return SETUP_REQUIREMENTS[dashboardModuleId]?.label || "";
}

// --------------------------------------------------------------------------
// Entitlement resolution
// --------------------------------------------------------------------------

export const MODULE_STATE = {
  COMING_SOON: "coming_soon",
  READY: "ready",
  SETUP_REQUIRED: "setup_required",
  NOT_INCLUDED: "not_included",
};

function planRank(planId) {
  return PLANS[String(planId || "").toLowerCase()]?.order || 0;
}

// Modules unlocked by the base plan tier, via the existing featureGates map.
export function modulesIncludedInPlan(planId) {
  const ids = new Set();
  const rank = planRank(planId);
  if (!rank) return ids;
  for (const [moduleId, feature] of Object.entries(MODULE_PLAN_FEATURES)) {
    const requiredPlan = FEATURE_PLANS[feature];
    if (!requiredPlan) continue;
    if (planRank(requiredPlan) <= rank) ids.add(moduleId);
  }
  return ids;
}

// The entitled set: plan-included modules, plus add-on module rows, plus
// per-module plan tiers recorded on the accounts row.
export function buildEntitledModuleIds({ planId = "", entitlementRows = [], legacyRows = [], account = null } = {}) {
  const rows = (entitlementRows && entitlementRows.length) ? entitlementRows : (legacyRows || []);
  const ids = modulesIncludedInPlan(planId);

  for (const row of rows) {
    const raw = row?.module_id;
    if (!raw || isPseudoModuleRow(raw)) continue;
    const id = normalizeDashboardModuleId(raw);
    if (id) ids.add(id);
  }

  const hasPseudo = (prefix) => rows.some((row) => typeof row?.module_id === "string" && row.module_id.startsWith(prefix));
  if (hasPseudo("__social_plan_tier:")) ids.add("social_media");
  if (hasPseudo("__website_plan_tier:")) ids.add("website_builder");

  if (account?.sms_plan_tier) ids.add("sms_marketing");
  if (account?.calendar_plan_tier) ids.add("booking_calendar");
  if (account?.email_plan_tier) ids.add("email_marketing");
  if (account?.social_plan_tier) ids.add("social_media");

  return ids;
}

// Availability wins over everything: an unreleased module stays Coming Soon
// even for a subscriber (item 7).
export function resolveModuleState({ moduleId, comingSoon = false, entitledIds = new Set(), context = {} } = {}) {
  if (comingSoon) return MODULE_STATE.COMING_SOON;
  const id = normalizeDashboardModuleId(moduleId);
  if (!entitledIds.has(id)) return MODULE_STATE.NOT_INCLUDED;
  if (moduleRequiresSetup(id) && !moduleSetupComplete(id, context)) return MODULE_STATE.SETUP_REQUIRED;
  return MODULE_STATE.READY;
}

// --------------------------------------------------------------------------
// Subscription summary (item 9) - real data only, never hardcoded.
// --------------------------------------------------------------------------

export function planLabel(planId) {
  if (!planId) return "";
  const key = String(planId).toLowerCase();
  if (PLANS[key]?.name) return PLANS[key].name;
  return String(planId).replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function billingCycleLabel(cycle) {
  const value = String(cycle || "").toLowerCase();
  if (value === "annual" || value === "yearly" || value === "year") return "Annual";
  if (value === "monthly" || value === "month") return "Monthly";
  return "";
}

export function subscriptionStatusLabel(status) {
  const value = String(status || "").toLowerCase();
  if (!value) return "";
  if (value === "trialing") return "Trial";
  if (value === "active") return "Active";
  return value.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Assembles the dashboard summary from real records only. Any field with no
// backing data comes back empty so the UI omits it rather than inventing one.
export function buildSubscriptionSummary({ subscription = null, workspace = null, billingCycle = "" } = {}) {
  const plan = planLabel(subscription?.plan_id || workspace?.plan || "");
  const rawStatus = subscription?.status || (plan ? "active" : "");
  return {
    plan,
    cycle: billingCycleLabel(billingCycle),
    status: subscriptionStatusLabel(rawStatus),
    hasSubscription: Boolean(plan),
  };
}
