import assert from "node:assert/strict";
import fs from "node:fs";
import JSZip from "jszip";
import { buildCabinetrySelectionPayload, normaliseCabinetrySelection } from "../lib/builders/cabinetryWorkflow.js";
import { PRODUCT_LIBRARY_CABINETRY_STRUCTURAL_PRODUCTS } from "../lib/product-library/cabinetryCatalogueSelectors.js";
import {
  applyCabinetryRequirementsToQuotation,
  cabinetryDoorPricingCategory,
  classifyLegacyCabinetLine,
} from "../lib/construction-estimation/cabinetryRequirements.js";

const sourcePath = "test-artifacts\\isolated-jobs\\gr8-reconcile-test-47c50983a480\\GR8 RESULT - QUOTATION PROGRESS ALLOCATION TEST.gr8job";
const zip = await JSZip.loadAsync(fs.readFileSync(sourcePath));
const sourceWorkbook = JSON.parse(await zip.file("estimate.json").async("string")).workbook;
const sourceSelection = sourceWorkbook.clientSelectionsBook.rooms.flatMap((room) => room.rows || [])
  .map((row) => row.guidedSelection?.cabinetrySelection)
  .find(Boolean);

const selectedLocations = sourceSelection.locations.filter((location) => ["Kitchen", "Butler's Pantry", "Laundry"].includes(location.location));
const lines = [
  { componentId: "variant-kitchen-base-600", location: "Kitchen", cabinetTypeId: "base_unit_600_1door", unitType: "1 door base unit - 600mm", quantity: 1, width: 450 },
  { componentId: "variant-kitchen-pantry-1200", location: "Kitchen", cabinetTypeId: "tall_pantry_1200", unitType: "Tall pantry cabinet - 2 door - 1200mm - 5 shelves", quantity: 1 },
  { componentId: "variant-pantry-base-1200", location: "Butler's Pantry", cabinetTypeId: "base_unit_1200_2door", unitType: "2 door base unit - 1200mm", quantity: 2 },
  { componentId: "variant-pantry-tall-600", location: "Butler's Pantry", cabinetTypeId: "tall_pantry_600", unitType: "Tall pantry cabinet - 1 door - 600mm - 5 shelves", quantity: 1 },
  { componentId: "variant-laundry-base-600", location: "Laundry", cabinetTypeId: "base_unit_600_1door", unitType: "1 door base unit - 600mm", quantity: 1 },
];
const selection = normaliseCabinetrySelection({
  ...sourceSelection,
  schemaVersion: 3,
  locations: selectedLocations,
  schedule: lines,
  legacyCabinetSchedule: [],
  cabinetScheduleMigration: [],
});

assert.equal(selection.schemaVersion, 3);
for (const line of selection.schedule) {
  assert.equal(line.selectedVariantId, line.cabinetTypeId);
  assert.match(line.cabinetProductId, /^CABINETRY-UNIT-/);
  assert.equal(line.selectedFinishKey, "standard_colourboard");
}
const base450 = selection.schedule.find((line) => line.componentId === "variant-kitchen-base-600");
assert.deepEqual({
  width: base450.width,
  widthMm: base450.widthMm,
  doorCount: base450.doorCount,
  category: base450.pricingCategoryId,
  pricingWidthMm: base450.pricingWidthMm,
}, {
  width: 450,
  widthMm: 450,
  doorCount: 1,
  category: "single_door_up_to_600",
  pricingWidthMm: 600,
});
assert.deepEqual(cabinetryDoorPricingCategory({ widthMm: 450, doors: 1 }), {
  id: "single_door_up_to_600",
  pricingWidthMm: 600,
  doors: 1,
});

const payload = buildCabinetrySelectionPayload({
  workspaceId: sourceWorkbook.workspaceId,
  projectId: "cabinet-variant-test",
  selection,
  requirement: { defaultAllowance: 2500 },
});
const reopened = JSON.parse(JSON.stringify(payload.selected_details.cabinetrySelection));
assert.deepEqual(reopened.schedule.map((line) => ({
  componentId: line.componentId,
  cabinetTypeId: line.cabinetTypeId,
  selectedVariantId: line.selectedVariantId,
  cabinetProductId: line.cabinetProductId,
  pricingCategoryId: line.pricingCategoryId,
  pricingWidthMm: line.pricingWidthMm,
  doorCount: line.doorCount,
  selectedFinishKey: line.selectedFinishKey,
})), selection.schedule.map((line) => ({
  componentId: line.componentId,
  cabinetTypeId: line.cabinetTypeId,
  selectedVariantId: line.selectedVariantId,
  cabinetProductId: line.cabinetProductId,
  pricingCategoryId: line.pricingCategoryId,
  pricingWidthMm: line.pricingWidthMm,
  doorCount: line.doorCount,
  selectedFinishKey: line.selectedFinishKey,
})));

const book = structuredClone(sourceWorkbook.clientSelectionsBook);
const cabinetryRow = book.rooms.flatMap((room) => room.rows || []).find((row) => row.guidedSelection?.cabinetrySelection);
cabinetryRow.guidedSelection.cabinetrySelection = reopened;
const workbook = {
  ...structuredClone(sourceWorkbook),
  clientSelectionsBook: book,
  selectionsBook: book,
  selectionSchedule: book,
};
const applied = applyCabinetryRequirementsToQuotation(workbook, workbook.workspaceId);
const expected = new Map([
  ["selection:variant-kitchen-base-600", { rate: 850, quantity: 1, type: "base_unit_600_1door" }],
  ["selection:variant-kitchen-pantry-1200", { rate: 2300, quantity: 1, type: "tall_pantry_1200" }],
  ["selection:variant-pantry-base-1200", { rate: 1150, quantity: 2, type: "base_unit_1200_2door" }],
  ["selection:variant-pantry-tall-600", { rate: 1800, quantity: 1, type: "tall_pantry_600" }],
  ["selection:variant-laundry-base-600", { rate: 850, quantity: 1, type: "base_unit_600_1door" }],
]);
for (const [requirementId, wanted] of expected) {
  const entry = applied.cabinetryReconciliation.entries.find((item) => item.requirementId === requirementId);
  assert.equal(entry.outcome, "MATCHED");
  assert.equal(entry.type, wanted.type);
  assert.equal(entry.quantity, wanted.quantity);
  const row = applied.quotation.CABINETRY.rows.find((item) => item.importKey === entry.matchedImportKey);
  assert.equal(row.finalRateUsed ?? row.excelRate, wanted.rate);
}
const repeated = applyCabinetryRequirementsToQuotation(applied, applied.workspaceId);
assert.deepEqual(repeated.quotation.CABINETRY.rows.map((row) => row.id), applied.quotation.CABINETRY.rows.map((row) => row.id));
assert.equal(new Set(repeated.quotation.CABINETRY.rows.map((row) => row.id)).size, repeated.quotation.CABINETRY.rows.length);

const library = PRODUCT_LIBRARY_CABINETRY_STRUCTURAL_PRODUCTS;
assert.equal(library.some((item) => ["Standard base unit", "Tall pantry"].includes(item.productName)), false);
for (const productId of [
  "CABINETRY-UNIT-BASE-UNIT-600-1DOOR",
  "CABINETRY-UNIT-BASE-UNIT-1200-2DOOR",
  "CABINETRY-UNIT-TALL-PANTRY-600",
  "CABINETRY-UNIT-TALL-PANTRY-1200",
]) assert.ok(library.some((item) => item.id === productId), `${productId} must be an authoritative Product Library record`);

let historical = structuredClone(sourceWorkbook);
for (const [componentId, variantId] of [
  ["CAB-kitchen-1789936190593", "tall_pantry_600"],
  ["CAB-butler-s-pantry-1789947466579", "base_unit_1200_2door"],
  ["CAB-butler-s-pantry-1789947471734", "tall_pantry_1200"],
  ["CAB-laundry-1790211658528", "base_unit_600_1door"],
]) historical = classifyLegacyCabinetLine(historical, componentId, variantId);
historical = applyCabinetryRequirementsToQuotation(historical, historical.workspaceId);
assert.equal(historical.cabinetryReconciliation.entries.some((entry) => entry.requirementId.startsWith("selection-retired:") && entry.outcome === "ACTION REQUIRED"), false);
const historicalSelection = historical.clientSelectionsBook.rooms.flatMap((room) => room.rows || [])
  .map((row) => row.guidedSelection?.cabinetrySelection)
  .find(Boolean);
for (const line of historicalSelection.schedule.filter((item) => item.classifiedFrom)) {
  assert.equal(line.selectedVariantId, line.cabinetTypeId);
  assert.match(line.cabinetProductId, /^CABINETRY-UNIT-/);
}

console.log("Cabinetry variant persistence: 600mm, 1200mm, 450mm pricing category, JSON reopen, approved rates, historical confirmation and idempotence verified.");
