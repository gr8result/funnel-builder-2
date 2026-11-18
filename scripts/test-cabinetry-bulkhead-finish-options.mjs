// Kitchen bulkheads: exactly four client options, synced 1:1 to the quotation. Only Raw MDF site-painted has
// quotation rows (MDF bulkhead 300/450 - LM in the room's finish block); custom paint and Laminex Decorative
// Board 300/450 have no row or rate, so their lengths are never priced on the MDF rows and they are
// Builder Review Required.
//   node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-cabinetry-bulkhead-finish-options.mjs
import assert from "node:assert/strict";
import { BULKHEAD_FINISH_OPTIONS, bulkheadFinishOption, collectCabinetryRequirements, CABINETRY_RATE_REQUIRED, unpricedBulkheadFinishRooms } from "../lib/construction-estimation/cabinetryRequirements.js";
import { selectionVariationItems, variationPricingState, PRICING_STATES } from "../lib/builders/selectionVariationPricing.js";

assert.deepEqual(BULKHEAD_FINISH_OPTIONS.map((option) => option.label), ["Raw MDF 300/450 (site-painted)", "Raw MDF - custom paint colour", "Laminex Decorative Board 300mm", "Laminex Decorative Board 450mm"]);
assert.deepEqual(BULKHEAD_FINISH_OPTIONS.map((option) => option.priced), [true, false, false, false]);
assert(!BULKHEAD_FINISH_OPTIONS.some((option) => /match (walls|ceiling)/i.test(option.label)), "no painted-to-match options");
// Earlier saved finishes: painted-to-match were site-painted MDF (keep the MDF rows); decorative boards had no row.
assert.equal(bulkheadFinishOption("raw_mdf_ceiling_paint").key, "raw_mdf_site_paint");
assert.equal(bulkheadFinishOption("raw_mdf_wall_paint").priced, true);
assert.equal(bulkheadFinishOption("laminex_colour").priced, false);
assert.equal(bulkheadFinishOption("other_custom"), null);

const run = (mm) => [{ id: "r1", location: "Wall", lengthMm: mm }];
const workbookFor = (mode, { takeoffRun = false } = {}) => ({
  clientSelectionsBook: { rooms: [{ rows: [{ guidedSelection: { cabinetrySelection: {
    projectId: "job", locations: [{ id: "cabinetry-kitchen", location: "Kitchen", name: "Kitchen", included: true, bulkheadFinishMode: mode }],
    schedule: [{ componentId: "bh", location: "Kitchen", cabinetTypeId: "bulkhead_300", unitType: "MDF bulkhead 300mm", quantity: 4.2, handleQuantity: 0, runs: run(4200) }],
  } } }] }] },
  ...(takeoffRun ? { cabinetryRequirements: [{ id: "takeoff-bh", room: "Kitchen", type: "bulkhead_450", quantity: 3, source: "AI_TAKEOFF" }] } : {}),
});
const bulkheads = (workbook) => collectCabinetryRequirements(workbook).filter((item) => /^bulkhead_/.test(item.type));

// Site-painted Raw MDF: priced on the MDF row (no issue), 4.2 LM.
const mdf = bulkheads(workbookFor("raw_mdf_site_paint"));
assert.equal(mdf.length, 1);
assert.equal(mdf[0].issue, undefined);
assert.equal(mdf[0].quantity, 4.2);
// A legacy painted-to-match choice prices exactly as before.
assert.equal(bulkheads(workbookFor("raw_mdf_ceiling_paint"))[0].issue, undefined);

// Unpriced finishes: length kept, rate flagged, never priced on the MDF row - including a measured run.
for (const mode of ["raw_mdf_custom_paint", "laminex_decorative_300", "laminex_decorative_450", "laminex_colour"]) {
  const items = bulkheads(workbookFor(mode, { takeoffRun: true }));
  assert(items.length >= 2, `${mode}: selection and measured run both listed`);
  items.forEach((item) => {
    assert.equal(item.issueFlag, CABINETRY_RATE_REQUIRED, `${mode}: ${item.id} rate required`);
    assert.match(item.issue, /No quotation rate is set for .* bulkheads - Builder Review Required/);
  });
  assert.equal(items.find((item) => item.id.startsWith("selection:")).quantity, 4.2, "length kept for the builder");
}
assert.equal(unpricedBulkheadFinishRooms(workbookFor("laminex_decorative_450")).get("kitchen").label, "Laminex Decorative Board 450mm");
assert.equal(unpricedBulkheadFinishRooms(workbookFor("raw_mdf_site_paint")).size, 0);

// Variation Summary: an unpriced finish is Builder Review Required with the measured length; once the
// builder enters the rate and the MDF rate (allowance) the difference is calculated.
const book = workbookFor("laminex_decorative_450").clientSelectionsBook;
const [finishItem] = selectionVariationItems(book, { jobId: "job" }).filter((item) => item.kind === "cabinetry-bulkhead-finish");
assert(finishItem, "finish item listed");
assert.equal(finishItem.quantity, 4.2);
assert.equal(finishItem.standard, "Raw MDF 300/450 (site-painted)");
const state = variationPricingState(finishItem);
assert.equal(state.state, PRICING_STATES.builderReview);
assert.deepEqual(state.missing.map((entry) => entry.key), ["price"]);
const priced = variationPricingState(finishItem, { selectionKey: "cabinetry-bulkhead-finish|bulkhead-finish-laminex_decorative_450|laminex_decorative_450", unitPrice: 420, allowance: 290, priceIncludesGst: false });
assert.equal(priced.state, PRICING_STATES.calculable);
assert.equal(priced.amountExGst, Math.round((420 - 290) * 4.2 * 100) / 100);
assert.equal(selectionVariationItems(workbookFor("raw_mdf_site_paint").clientSelectionsBook, { jobId: "job" }).filter((item) => item.kind === "cabinetry-bulkhead-finish").length, 0, "the standard finish is not a variation");

console.log("cabinetry bulkhead finish options: 4 options, MDF priced on its rows, the other 3 Builder Review Required and never priced on MDF rows");
