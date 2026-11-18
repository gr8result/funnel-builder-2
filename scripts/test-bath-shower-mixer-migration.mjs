// Bath Mixers + Shower Mixers -> one "Bath & Shower Mixers" category: saved selections migrate
// without loss or double counting, and flow downstream as one line per product.
//
// Usage: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-bath-shower-mixer-migration.mjs
import assert from "node:assert/strict";
import { migrateBathShowerMixerRooms } from "../lib/builders/bathShowerMixerMigration.js";
import { plumbingSelectionPatch } from "../lib/builders/plumbingSelectionPatch.js";
import { plumbingLineWithTotals, plumbingLinesFromSelection } from "../lib/builders/plumbingFixtureAllocation.js";
import { PLUMBING_FIXTURE_REQUIREMENTS } from "../lib/builders/clientSelectionWorkflow.js";
import { CLIENT_SELECTION_CATEGORY_BY_KEY } from "../lib/builders/clientSelectionCategories.js";
import { plumbingFixtureCategoryDetails, plumbingFixtureProducts } from "../lib/product-library/plumbingFixtureCatalogue.js";
import { allocatedSelectionQuotationLines, connectAllocatedSelectionsToQuotation } from "../lib/builders/allocatedSelectionQuotation.js";

const legacyRequirement = { requirementKey: "shower-mixer", label: "Shower Mixer", areaKey: "plumbing-fixtures", areaLabel: "Plumbing Fixtures", unit: "EACH" };
const bathRequirement = PLUMBING_FIXTURE_REQUIREMENTS.find((r) => r.requirementKey === "bath-mixer");
const line = (id, name, price, allocations) => plumbingLineWithTotals({ lineId: id, productId: id, productCode: id, productName: name, brand: "Phoenix", supplier: "Harvey Norman Commercial", unit: "EACH", unitPrice: price, priceIncludesGst: true, unitAllowance: 0, allocations });
const row = (requirement, lines, item) => ({ id: `row-${requirement.requirementKey}`, item, guidedRequirementKey: requirement.requirementKey, ...plumbingSelectionPatch(requirement, lines, null, { projectId: "p", organisationId: "w", now: "2026-09-01T00:00:00.000Z" }).patch });

// Saved before the merge: Vivid as a Bath Mixer x1 AND as a Shower Mixer x3, plus a second shower mixer.
const vivid = ["PLB-VIVID-SLIM", "Vivid Slimline Shower/Bath Mixer", 229];
const before = [
  { name: "Plumbing Fixtures", rows: [
    { id: "untouched", item: "Toilet Suite", guidedRequirementKey: "toilet-suite", guidedSelection: { requirementKey: "toilet-suite", productName: "Toilet" } },
    row(bathRequirement, [line(...vivid, [{ location: "Bathroom", quantity: 1 }])], "Bath Mixer"),
    row(legacyRequirement, [
      line(...vivid, [{ location: "Bathroom", quantity: 1 }, { location: "Ensuite", quantity: 1 }, { location: "Ensuite 2", quantity: 1 }]),
      line("PLB-WILTERN", "Wiltern SwitchMix Shower / Wall Mixer", 189, [{ location: "Powder Room", quantity: 1 }]),
    ], "Shower Mixer"),
  ] },
];
const beforeTotal = before[0].rows.slice(1).reduce((sum, r) => sum + r.guidedSelection.selectedTotal, 0);

const after = migrateBathShowerMixerRooms(before);
const rows = after[0].rows;
assert.equal(rows.filter((r) => (r.guidedSelection?.requirementKey || r.guidedRequirementKey) === "shower-mixer").length, 0, "Shower Mixer row removed");
assert.equal(rows.find((r) => r.id === "untouched"), before[0].rows[0], "other selections untouched");
const merged = rows.find((r) => r.guidedRequirementKey === "bath-mixer");
assert.equal(merged.id, "row-bath-mixer", "the existing Bath Mixer row keeps its identity");
const lines = plumbingLinesFromSelection(merged.guidedSelection);
const vividLine = lines.find((l) => l.productId === "PLB-VIVID-SLIM");
assert.equal(lines.filter((l) => l.productId === "PLB-VIVID-SLIM").length, 1, "one line per product - no duplicate");
assert.equal(vividLine.quantity, 4, "1 bath + 3 shower = 4, not double counted");
assert.deepEqual(vividLine.allocations.map((a) => `${a.location} x${a.quantity}`).sort(), ["Bathroom Bath x1", "Bathroom Shower x1", "Ensuite 2 Shower x1", "Ensuite Shower x1"]);
assert.equal(vividLine.unitPrice, 229, "price preserved");
assert.equal(merged.guidedSelection.quantity, 5);
assert.equal(merged.guidedSelection.selectedTotal, beforeTotal, "selected total unchanged by the merge");
assert.equal(merged.guidedSelection.variation, 1004.55, "variation uses the GST-exclusive selected total against a zero allowance");
assert.equal(migrateBathShowerMixerRooms(after), after, "idempotent: a refresh changes nothing");

// Category structure: one Bath & Shower Mixers card, Bath Spouts and Shower Rails & Roses separate.
const hub = CLIENT_SELECTION_CATEGORY_BY_KEY["plumbing-fixtures"];
const titles = hub.requirementKeys.map((key) => plumbingFixtureCategoryDetails({ requirementKey: key }).title);
assert.deepEqual(titles, ["Sinks", "Sink Mixers", "Bathroom Basins", "Basin Mixers", "Baths", "Bath & Shower Mixers", "Bath Spouts", "Shower Rails & Roses", "Toilet Suites", "Laundry Tubs"]);
const pool = plumbingFixtureProducts("bath-mixer");
assert.equal(new Set(pool.map((p) => p.productId)).size, pool.length, "each product appears once in the merged pool");

// Downstream: one quotation line per product with the full quantity; procurement the same.
const book = { rooms: after };
const quoteLines = allocatedSelectionQuotationLines(book);
const vividQuote = quoteLines.filter((l) => l.line.productId === "PLB-VIVID-SLIM");
assert.equal(vividQuote.length, 1, "one quotation line, not a Bath Mixer + Shower Mixer pair");
assert.equal(vividQuote[0].line.quantity, 4);
assert.equal(vividQuote[0].locations, "Bathroom Bath ×1, Bathroom Shower ×1, Ensuite Shower ×1, Ensuite 2 Shower ×1".split(", ").sort().join(", ") === vividQuote[0].locations.split(", ").sort().join(", ") ? vividQuote[0].locations : "mismatch");
const workbook = connectAllocatedSelectionsToQuotation({ quotation: {} }, book);
const sectionRows = Object.values(workbook.quotation).flatMap((s) => s.rows || []).filter((r) => r.productCode === "PLB-VIVID-SLIM" || r.productId === "PLB-VIVID-SLIM");
assert.equal(sectionRows.length, 1);
const procurement = (workbook.procurement?.items || []).filter((i) => i.productId === "PLB-VIVID-SLIM");
assert.equal(procurement.length, 1, "one purchase line, not separate bath and shower orders");
assert.equal(procurement[0].qty, 4);

console.log(`Card titles (${titles.length}): ${titles.join(" | ")}`);
console.log(`Merged pool: ${pool.length} products, no duplicates`);
console.log(`Migrated: ${vividLine.productName} qty ${vividLine.quantity} -> ${vividLine.allocations.map((a) => `${a.location} x${a.quantity}`).join(", ")}; plus ${lines.filter((l) => l !== vividLine).map((l) => `${l.productName} x${l.quantity} (${l.allocations.map((a) => a.location).join(", ")})`).join(", ")}`);
console.log(`Totals: selected $${merged.guidedSelection.selectedTotal} before and after; category qty ${merged.guidedSelection.quantity}`);
console.log(`Quotation: ${sectionRows[0].item || sectionRows[0].productName} qty ${sectionRows[0].quantity ?? sectionRows[0].qty}${procurement.length ? `; procurement qty ${procurement.map((i) => i.qty).join(",")}` : ""}`);
console.log("\nBath & Shower Mixers migration tests passed.");

// Regression (found on the real job 2026-11-12): the project-room clean-up turns "Ensuite Shower"
// into room "Ensuite" + fixture "Shower". On the next load this migration must treat that as already
// labelled; it used to re-label every such shower mixer "Ensuite Bath" and drop the fixture.
{
  const { canonicaliseSelectionAllocations } = await import("../lib/builders/selectionAllocationRooms.js");
  const model = { rooms: ["Main Bathroom", "Ensuite", "B2 Ensuite"].map((name) => ({ id: name, key: name.toLowerCase().replace(/\s+/g, "-"), name })) };
  const showers = [line("PLB-ONOVO", "O.Novo Style Shower/Bath Mixer", 199, [
    { location: "Ensuite Shower", quantity: 1 }, { location: "Main Bathroom Shower", quantity: 2 }, { location: "B2 Ensuite Shower", quantity: 1 },
  ]), line("PLB-VIVID-BATH", "Vivid Shower/Bath Mixer", 229, [{ location: "Main Bathroom Bath", quantity: 1 }])];
  const saved = { rooms: [{ name: "Plumbing Fixtures", rows: [row(bathRequirement, showers, "Bath & Shower Mixer")] }] };
  const fixtures = (rooms) => plumbingLinesFromSelection(rooms[0].rows[0].guidedSelection)
    .flatMap((l) => l.allocations.map((a) => `${l.productId}|${a.location}|${a.fixture || ""}|${a.quantity}`)).sort();
  // Load 1: clean-up -> saved form. Loads 2 and 3: migration, then clean-up again (the app's order).
  let book = canonicaliseSelectionAllocations(saved, model).book;
  const afterFirstLoad = fixtures(book.rooms);
  assert.deepEqual(afterFirstLoad, [
    "PLB-ONOVO|B2 Ensuite|Shower|1", "PLB-ONOVO|Ensuite|Shower|1", "PLB-ONOVO|Main Bathroom|Shower|2", "PLB-VIVID-BATH|Main Bathroom|Bath|1",
  ]);
  for (let reload = 0; reload < 2; reload += 1) {
    const migrated = migrateBathShowerMixerRooms(book.rooms);
    assert.equal(migrated, book.rooms, "a cleaned-up book (room + fixture) needs no migration");
    book = canonicaliseSelectionAllocations({ ...book, rooms: migrated }, model).book;
    assert.deepEqual(fixtures(book.rooms), afterFirstLoad, `reload ${reload + 2}: shower mixers stay showers, bath stays bath`);
  }
  // A genuinely unlabelled room (no name suffix, no fixture) is still labelled Bath, keeping its other fields.
  const bare = migrateBathShowerMixerRooms([{ name: "Plumbing Fixtures", rows: [row(bathRequirement, [line("PLB-X", "X Mixer", 100, [{ location: "Laundry", quantity: 1, levelId: "ground" }])], "Bath & Shower Mixer")] }]);
  const bareAllocation = plumbingLinesFromSelection(bare[0].rows[0].guidedSelection)[0].allocations[0];
  assert.equal(bareAllocation.location, "Laundry Bath");
  console.log("Room clean-up + reload keeps shower mixers as Shower (3 load cycles); bare rooms still labelled Bath");
}
