import assert from "node:assert/strict";
import fs from "node:fs";
import {
  calculateSelectionVariation,
  calculateSessionBudget,
  buildSelectionSnapshot,
  hasActiveDraftVariation,
  roundMoney,
} from "../lib/builders/selectionBudget.js";

function read(relativePath) {
  return fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

// --- Selection-control-type resolution matters for "no plain text-only dropdowns for visual products" ---
const migrationSql = read("supabase/migrations/20260729_guided_selections_workflow.sql");
assert.match(migrationSql, /selection_control_type text/, "categories must carry a selection_control_type");
assert.match(migrationSql, /check \(selection_control_type in \('cards', 'swatches', 'dropdown'\)\)/, "only the three defined control types are allowed");
assert.match(migrationSql, /builder_selection_checklist_items/, "the required-selections checklist must be a real table (data, not code)");
assert.match(migrationSql, /required boolean not null default true/, "checklist items must support required/optional");

// --- Appliance catalogue import: shared source, not a second stove list ---
assert.match(migrationSql, /library_scope='BOTH'/i.test(migrationSql) ? /library_scope='BOTH'/i : /'BOTH'/, "imported appliances must be visible to both Estimating and Client Selections");
assert.match(migrationSql, /EUROMAID/);
assert.match(migrationSql, /appliancePackageRows\.json/i, "the import must be documented as sourced from the existing Quotation Builder seed, not invented");
assert.ok(!/width|fuel_type|fuel type/i.test(migrationSql.split("appliance_seed")[1] || ""), "must not fabricate width/fuel-type fields that were never structured in the source data");

// --- Brand correction: the source JSON's own brand field is wrong for several rows ---
assert.match(migrationSql, /OMEGA 60CM 4 FUNCTION OVEN OBO660X', 'ovens', 'OMEGA'/, "OMEGA rows must be corrected to brand OMEGA, not the source file's mislabelled ARISTON");
assert.match(migrationSql, /BLANCO 60CM ELECTRIC OVEN BOSE65XM', 'ovens', 'BLANCO'/, "BLANCO rows must be corrected to brand BLANCO");

// --- Checklist excludes non-selectable estimating items (earthworks, concrete, labour, etc.) ---
const checklistSection = migrationSql.split("checklist_seed(")[1] || "";
["earthwork", "concrete", "reinforcement", "structural framing", "temporary fencing", "site access", "labour"].forEach((banned) => {
  assert.ok(!new RegExp(banned, "i").test(checklistSection), `checklist must not include the non-selectable construction item "${banned}"`);
});

// --- EstimateBuilderWorkbook.js is untouched (off-limits) — the migration may
// document in a comment that it deliberately does not depend on it, but must
// never import/require/reference it as a code path.
assert.ok(!/require\(.*EstimateBuilderWorkbook|import .*EstimateBuilderWorkbook/.test(migrationSql), "the migration must not import/require the off-limits workbook file");

// --- Guided workflow page reuses the existing engine rather than rebuilding it ---
const pageSource = read("pages/modules/builders/guided-selections/[projectId].js");
assert.match(pageSource, /calculateSelectionVariation/, "product selection must use the existing shared variation calculator");
assert.match(pageSource, /calculateSessionBudget/, "running totals must use the existing shared budget calculator");
assert.match(pageSource, /buildSelectionSnapshot/, "a selection snapshot must be captured at selection time (historical protection)");
assert.match(pageSource, /hasActiveDraftVariation/, "finalising must not create a duplicate draft variation");
assert.match(pageSource, /metadata: \{ checklist_item_id: activeItem\.id/, "a selection must be traceable back to its checklist item");
assert.match(pageSource, /available_for_selection.*true/s, "the product query must exclude products not marked available for selection");
assert.match(pageSource, /library_scope.*CLIENT_SELECTION.*BOTH|CLIENT_SELECTION.*BOTH/, "the product query must only load client-selection-visible products");

// --- Checklist nav renders complete/incomplete state, not a flat list ---
const navSource = read("components/product-library/SelectionChecklistNav.jsx");
assert.match(navSource, /selectedByItemId/, "the nav must know which checklist items already have an active selection");
assert.match(navSource, /warn/, "a missing required item must be visually flagged");

// --- Workspace renders per selection_control_type, never a plain dropdown for visual products ---
const workspaceSource = read("components/product-library/GuidedSelectionWorkspace.jsx");
["swatches", "dropdown", "cards"].forEach((mode) => {
  assert.ok(workspaceSource.includes(`controlType === "${mode}"`), `the workspace must render a distinct UI for "${mode}"`);
});
assert.match(workspaceSource, /ExternalProductLink/, "product images/names must open the real product page, reusing the existing component");
assert.match(workspaceSource, /ProductImageMagnifier/, "products must support the existing in-platform magnifier, not a duplicate implementation");
assert.match(workspaceSource, /Exact product image not yet available/, "missing images must use the brief's exact placeholder wording, never a stock photo");

// --- Running summary never shows internal cost/margin fields ---
const summarySource = read("components/product-library/RunningSelectionsSummary.jsx");
assert.ok(!/builder_cost|builderCost|markup_percent|marginPercent/i.test(summarySource), "the client-facing running summary must not surface builder cost/margin fields");
assert.match(summarySource, /Finalise Client Selections/);
assert.match(summarySource, /Generate Inclusions Schedule/);
assert.match(summarySource, /Prepare Quote Update/);

// --- Colorbond/Monier seed data: real published colour ranges, not invented placeholders ---
const seedSql = read("supabase/migrations/20260730_colorbond_monier_seed_products.sql");
["Surfmist", "Shale Grey", "Monument", "Woodland Grey"].forEach((colourName) => {
  assert.ok(seedSql.includes(colourName), `Colorbond seed must include the real published colour "${colourName}"`);
});
["Horizon", "Elabana", "Shingle"].forEach((rangeName) => {
  assert.ok(seedSql.includes(rangeName), `Monier seed must include the real tile range "${rangeName}"`);
});
assert.match(seedSql, /verification_status.*'unverified'/, "seeded colour/tile rows must be flagged unverified, not silently presented as confirmed product data");
assert.match(seedSql, /roof_colour|gutters_colour|fascia_colour|downpipes_colour/, "seed must populate the colour categories the guided workflow example depends on");

// --- Checklist admin CRUD panel: real data mutation, not a hardcoded static list ---
const adminPanelSource = read("components/product-library/ChecklistAdminPanel.jsx");
["onCreate", "onUpdate", "onDeactivate"].forEach((handlerName) => {
  assert.ok(adminPanelSource.includes(handlerName), `ChecklistAdminPanel must support ${handlerName} so the checklist stays real editable data`);
});
assert.match(pageSource, /ChecklistAdminPanel/, "the guided selections page must wire in the checklist admin panel");
assert.match(pageSource, /builder_selection_checklist_items.*insert|insert.*builder_selection_checklist_items/s, "creating a checklist item must write to the real table");

// --- Pure calculation sanity (reusing the already-tested shared engine, just confirming the guided page's usage shape is valid input) ---
const variation = calculateSelectionVariation({
  allowance: 500,
  selectedProduct: { builderCost: 850, installationCost: 0 },
  quantity: 1,
  projectPricingSettings: { default_gst_rate: 10 },
});
assert.ok(variation.clientVariationTotal > 0, "a product costing more than its allowance must produce a positive (upgrade) variation");

const snapshot = buildSelectionSnapshot(
  { id: "p1", product_name: "Test Oven", model: "T1", cost_price: 850 },
  { includedAllowance: 500, builderCost: 850, variationAmount: variation.clientVariationTotal }
);
assert.equal(snapshot.productName, "Test Oven");
assert.equal(roundMoney(snapshot.includedAllowance), 500);

assert.equal(hasActiveDraftVariation({ variation_id: null }), false, "a session with no variation has nothing to duplicate");
assert.equal(hasActiveDraftVariation({ variation_id: "v1" }, { status: "void" }), false, "a void variation should not block a new one");
assert.equal(hasActiveDraftVariation({ variation_id: "v1" }, { status: "draft" }), true, "an in-progress draft must block creating a second one");

const sessionBudget = calculateSessionBudget({
  originalEstimateTotal: 500000,
  privateUpgradeCeiling: 0,
  selections: [
    { is_active: true, selection_status: "selected", variation_amount: 350 },
    { is_active: true, selection_status: "selected", variation_amount: -100 },
    { is_active: false, selection_status: "replaced", variation_amount: 9999 },
  ],
});
assert.equal(sessionBudget.currentNetSelectionVariation, 250, "inactive/replaced selections must not count toward the running total");

console.log("Guided Client Selections workflow tests passed.");
