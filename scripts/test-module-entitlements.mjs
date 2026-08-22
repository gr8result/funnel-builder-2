// Verification harness for Navigation Dashboard entitlement state.
// Run: node scripts/test-module-entitlements.mjs
import {
  MODULE_STATE,
  buildEntitledModuleIds,
  buildSubscriptionSummary,
  billingCycleRow,
  readBillingCycle,
  modulesIncludedInPlan,
  normalizeDashboardModuleId,
  resolveModuleState,
} from "../lib/moduleEntitlements.js";

let pass = 0, fail = 0;
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`}`);
  ok ? pass++ : fail++;
};
const state = (moduleId, opts) => resolveModuleState({ moduleId, ...opts });

console.log("\n=== plan tiers unlock modules via featureGates ===");
const pro = modulesIncludedInPlan("professional");
check("professional includes crm", pro.has("crm"), true);
check("professional includes funnels", pro.has("funnels"), true);
check("professional includes website_builder", pro.has("website_builder"), true);
const starter = modulesIncludedInPlan("starter");
check("starter includes crm", starter.has("crm"), true);
check("starter excludes funnels (needs growth)", starter.has("funnels"), false);
check("unknown plan grants nothing", modulesIncludedInPlan("").size, 0);

console.log("\n=== item 8: 100% discount / $0 checkout activates normally ===");
// Exactly what apply-plan writes for a fully discounted Professional checkout.
const zeroDollar = buildEntitledModuleIds({
  planId: "professional",
  entitlementRows: [
    { module_id: "crm", enabled: true },
    { module_id: "projects-hub", enabled: true },
    { module_id: "email", enabled: true },
  ],
  legacyRows: [],
  account: null,
});
check("crm entitled", zeroDollar.has("crm"), true);
check("email_marketing entitled", zeroDollar.has("email_marketing"), true);
check("project_workspace entitled via projects-hub", zeroDollar.has("project_workspace"), true);
check("plan modules still entitled", zeroDollar.has("business_automation"), true);
check("$0 does not mean unentitled", zeroDollar.size > 0, true);

console.log("\n=== item 3: entitlement / setup / availability are independent ===");
const entitled = new Set(["crm", "email_marketing", "sms_marketing", "funnels"]);
check("entitled + no setup needed -> READY",
  state("crm", { entitledIds: entitled }), MODULE_STATE.READY);
check("entitled + setup unmet -> SETUP_REQUIRED",
  state("email_marketing", { entitledIds: entitled, context: { account: {} } }), MODULE_STATE.SETUP_REQUIRED);
check("entitled + setup met -> READY",
  state("email_marketing", { entitledIds: entitled, context: { account: { sendgrid_connected: true } } }), MODULE_STATE.READY);
check("not entitled -> NOT_INCLUDED",
  state("website_builder", { entitledIds: entitled }), MODULE_STATE.NOT_INCLUDED);
check("module needing no setup is never SETUP_REQUIRED",
  state("funnels", { entitledIds: entitled, context: { account: {} } }), MODULE_STATE.READY);

console.log("\n=== item 7: Coming Soon outranks subscription state ===");
check("coming soon + entitled stays COMING_SOON",
  state("crm", { comingSoon: true, entitledIds: entitled }), MODULE_STATE.COMING_SOON);
check("coming soon + not entitled stays COMING_SOON",
  state("evergreen_webinars", { comingSoon: true, entitledIds: new Set() }), MODULE_STATE.COMING_SOON);

console.log("\n=== add-ons and plan tiers are additive ===");
const addons = buildEntitledModuleIds({
  planId: "starter",
  entitlementRows: [],
  legacyRows: [{ module_id: "__social_plan_tier:social-pro" }, { module_id: "__website_plan_tier:website-agency" }],
  account: { sms_plan_tier: "sms-pro" },
});
check("social_media from pseudo row", addons.has("social_media"), true);
check("website_builder from pseudo row", addons.has("website_builder"), true);
check("sms_marketing from account tier", addons.has("sms_marketing"), true);
check("pseudo rows are not modules themselves", [...addons].some((id) => id.startsWith("__")), false);

console.log("\n=== Projects Hub -> Project Workspace id mapping ===");
check("projects-hub maps", normalizeDashboardModuleId("projects-hub"), "project_workspace");
check("construction maps", normalizeDashboardModuleId("construction"), "project_workspace");

console.log("\n=== item 9: summary uses real data only ===");
check("plan from subscription record",
  buildSubscriptionSummary({ subscription: { plan_id: "professional", status: "active" }, billingCycle: "annual" }),
  { plan: "Professional", cycle: "Annual", status: "Active", hasSubscription: true });
check("falls back to workspace plan when no subscription row",
  buildSubscriptionSummary({ subscription: null, workspace: { plan: "growth" }, billingCycle: "" }),
  { plan: "Growth", cycle: "", status: "Active", hasSubscription: true });
check("no data -> nothing to render",
  buildSubscriptionSummary({}),
  { plan: "", cycle: "", status: "", hasSubscription: false });

console.log("\n=== billing cadence round-trip ===");
check("annual round-trip", readBillingCycle([billingCycleRow("annual"), "crm"]), "annual");
check("monthly round-trip", readBillingCycle([billingCycleRow("monthly")]), "monthly");
check("absent cadence", readBillingCycle(["crm"]), "");

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}: ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
