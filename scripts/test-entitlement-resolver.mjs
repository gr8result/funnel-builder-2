// Entitlement resolver contract tests (M1).
//
// These cover the vocabulary, bundle expansion, grant closure and the
// server-side resolver, plus the two safety properties the platform depends on:
//   - resolution never REMOVES access a customer already has;
//   - grants are directional, so leads never confers crm.

import assert from "node:assert/strict";
import {
  MODULE_CODES,
  ALL_MODULE_CODES,
  FORBIDDEN_CODES,
  CORE_SERVICES_WITHOUT_CODES,
  BUNDLES,
  GRANTS,
  isBundleCode,
  isKnownModuleCode,
  normaliseCode,
  expandBundles,
  applyGrants,
  resolveEntitlements,
  hasModuleAccess,
  createEntitlementResolver,
} from "../platform-core/subscription-entitlements/index.js";

let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks += 1; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); checks += 1; };

// ---------------------------------------------------------------- vocabulary
{
  const approved = [
    "estimate_builder", "quotation_builder", "estimating_catalogue",
    "budget_vs_actual", "ai_plan_takeoff", "product_library",
    "product_library_read", "client_selections", "standard_inclusions",
    "boq", "variations", "supplier_procurement", "document_vault",
    "rfi_reports", "gantt_chart", "job_board", "client_portal",
    "freedom", "leads", "crm", "website_builder",
  ];
  for (const code of approved) {
    ok(Object.values(MODULE_CODES).includes(code), `${code} must be an approved module code`);
    ok(isKnownModuleCode(code), `${code} must be recognised by isKnownModuleCode`);
  }
  eq(Object.values(MODULE_CODES).length, approved.length,
    "MODULE_CODES must contain exactly the approved codes and no extras");
}

// Purchase Orders, Supplier Invoices and Quote Approvals live inside
// supplier-procurement and must never gain codes of their own.
for (const forbidden of FORBIDDEN_CODES) {
  ok(!ALL_MODULE_CODES.includes(forbidden), `${forbidden} must not exist as a code`);
  ok(!isKnownModuleCode(forbidden), `${forbidden} must not be a known module code`);
  ok(!Object.keys(GRANTS).includes(forbidden), `${forbidden} must not appear in GRANTS`);
  for (const members of Object.values(BUNDLES)) {
    ok(!members.includes(forbidden), `${forbidden} must not appear in any bundle`);
  }
}

// Job Details is core and deliberately has no code.
ok(CORE_SERVICES_WITHOUT_CODES.includes("job-details"), "job-details must be core with no code");
ok(!ALL_MODULE_CODES.includes("job_details"), "job_details must not exist as a code");

// ------------------------------------------------------------------- bundles
{
  eq(BUNDLES.builder_suite.length, 14, "builder_suite must contain 14 modules");
  eq([...BUNDLES.estimate_bundle], ["estimate_builder", "quotation_builder"],
    "estimate_bundle must be exactly estimate_builder + quotation_builder");

  ok(!BUNDLES.builder_suite.includes("estimating_catalogue"),
    "estimating_catalogue is granted, not bundled directly");
  for (const members of Object.values(BUNDLES)) {
    ok(!members.includes("freedom"), "freedom must appear in no bundle");
  }

  ok(isBundleCode("builder_suite"), "builder_suite is a bundle");
  ok(!isBundleCode("estimate_builder"), "estimate_builder is a module, not a bundle");

  // Every bundle member must be a real module code.
  for (const [bundle, members] of Object.entries(BUNDLES)) {
    for (const m of members) ok(isKnownModuleCode(m), `${bundle} member ${m} must be a known code`);
  }
}

// Bundle expansion
{
  const out = expandBundles(new Set(["builder_suite"]));
  for (const m of BUNDLES.builder_suite) ok(out.has(m), `builder_suite must expand to include ${m}`);
  ok(out.has("builder_suite"), "the bundle code itself is retained so its origin stays visible");
  ok(!out.has("freedom"), "builder_suite must not confer freedom");
}

// -------------------------------------------------------------------- grants
{
  const eb = resolveEntitlements({ addOns: ["estimate_builder"] });
  ok(eb.has("estimating_catalogue"), "estimate_builder grants estimating_catalogue");
  ok(eb.has("product_library_read"), "estimate_builder grants product_library_read");
  ok(!eb.has("product_library"), "estimate_builder must NOT grant product_library admin");
  ok(!eb.has("quotation_builder"), "estimate_builder must not confer quotation_builder");

  const qb = resolveEntitlements({ addOns: ["quotation_builder"] });
  ok(qb.has("estimating_catalogue"), "quotation_builder grants estimating_catalogue");
  ok(qb.has("product_library_read"), "quotation_builder grants product_library_read");

  const cs = resolveEntitlements({ addOns: ["client_selections"] });
  ok(cs.has("product_library_read"), "client_selections grants product_library_read");
  ok(!cs.has("estimating_catalogue"), "client_selections must not grant estimating_catalogue");

  const pl = resolveEntitlements({ addOns: ["product_library"] });
  ok(pl.has("product_library_read"), "product_library admin grants read");

  // Directional: crm -> leads, never the reverse.
  const crm = resolveEntitlements({ addOns: ["crm"] });
  ok(crm.has("leads"), "crm grants leads");
  const leads = resolveEntitlements({ addOns: ["leads"] });
  ok(!leads.has("crm"), "leads must NOT grant crm");
  ok(leads.has("leads"), "leads keeps its own access");
}

// Estimating catalogue is grant-only today, but holding it directly must still
// work if it is ever sold on its own.
{
  const direct = resolveEntitlements({ addOns: ["estimating_catalogue"] });
  ok(direct.has("estimating_catalogue"), "a directly held estimating_catalogue still resolves");
  ok(!direct.has("estimate_builder"), "estimating_catalogue must not confer estimate_builder");
}

// Bundle + grant interaction: builder_suite reaches granted codes transitively.
{
  const suite = resolveEntitlements({ bundles: ["builder_suite"] });
  ok(suite.has("estimate_builder"), "builder_suite includes estimate_builder");
  ok(suite.has("estimating_catalogue"), "builder_suite reaches estimating_catalogue through a grant");
  ok(suite.has("product_library_read"), "builder_suite reaches product_library_read through a grant");
  ok(suite.has("client_portal"), "builder_suite includes client_portal");
  ok(!suite.has("freedom"), "builder_suite must never confer freedom");
  ok(!suite.has("crm"), "builder_suite must not confer crm");
}

// Grant closure terminates and is order-independent.
{
  const a = resolveEntitlements({ addOns: ["crm", "estimate_builder"] });
  const b = resolveEntitlements({ addOns: ["estimate_builder", "crm"] });
  eq([...a.modules].sort(), [...b.modules].sort(), "resolution must be order-independent");
  ok(applyGrants(new Set(["crm"])).has("leads"), "applyGrants reaches a granted code");
}

// ------------------------------------------------------- normalisation/legacy
{
  eq(normaliseCode("website-builder"), "website_builder", "legacy alias maps to canonical code");
  eq(normaliseCode("projects-hub"), "project_workspace", "projects-hub maps to project_workspace");
  eq(normaliseCode("construction"), "project_workspace", "construction maps to project_workspace");
  eq(normaliseCode("  "), "", "blank input yields no code");
  eq(normaliseCode(null), "", "null yields no code");
  eq(normaliseCode("some_future_code"), "some_future_code",
    "an unknown code passes through rather than being dropped");
}

// ------------------------------------------------------- SAFETY: never remove
{
  // Every non-bundle input code must survive resolution. This is what makes it
  // safe to place the resolver in front of existing entitlement logic.
  const legacy = [
    "crm", "email_marketing", "social_media", "website_builder", "funnels",
    "business_automation", "booking_calendar", "project_workspace",
    "affiliate_management", "pipelines", "evergreen_webinars", "sms_marketing",
  ];
  const resolved = resolveEntitlements({ legacyModuleIds: legacy });
  for (const code of legacy) {
    ok(resolved.has(code), `legacy access to ${code} must survive resolution`);
  }

  // And an unrecognised code must not be silently dropped.
  const future = resolveEntitlements({ addOns: ["not_yet_invented_module"] });
  ok(future.has("not_yet_invented_module"), "unknown codes must not be dropped");
}

// Empty input grants nothing — never fail open.
{
  const none = resolveEntitlements({});
  eq(none.modules.size, 0, "no input must yield no entitlements");
  ok(!none.has("estimate_builder"), "empty entitlement set grants nothing");
  ok(!hasModuleAccess({}, "freedom"), "hasModuleAccess is closed by default");
}

// ------------------------------------------------------------ server resolver
{
  const resolver = createEntitlementResolver({
    loadWorkspaceEntitlementData: async (workspaceId) => {
      if (workspaceId === "ws-suite") {
        return { planId: "professional", planModules: [], bundles: ["builder_suite"] };
      }
      if (workspaceId === "ws-leads") {
        return { planId: "starter", planModules: ["leads"] };
      }
      return { planId: "starter", planModules: [] };
    },
  });

  const suite = await resolver.resolveForWorkspace("ws-suite");
  eq(suite.workspaceId, "ws-suite", "resolver echoes the workspace id");
  eq(suite.planId, "professional", "resolver reports the plan id");
  ok(suite.has("estimate_builder"), "ws-suite may use estimate_builder");
  ok(suite.has("product_library_read"), "ws-suite reaches granted codes");
  ok(!suite.has("freedom"), "ws-suite may not use freedom");

  ok(await resolver.workspaceHasModule("ws-suite", "boq"), "workspaceHasModule resolves true");
  ok(!(await resolver.workspaceHasModule("ws-leads", "crm")), "leads-only workspace has no crm");
  ok(await resolver.workspaceHasModule("ws-leads", "leads"), "leads-only workspace keeps leads");

  // No workspace must never fail open.
  const anon = await resolver.resolveForWorkspace("");
  eq(anon.modules.size, 0, "missing workspace id yields no entitlements");
  ok(!(await resolver.workspaceHasModule(null, "estimate_builder")),
    "null workspace must not be entitled");

  // A loader returning nothing must not throw or fail open.
  const broken = createEntitlementResolver({ loadWorkspaceEntitlementData: async () => null });
  const out = await broken.resolveForWorkspace("ws-x");
  eq(out.modules.size, 0, "a null loader result yields no entitlements");
}

console.log(`Entitlement resolver checks passed (${checks} assertions).`);
