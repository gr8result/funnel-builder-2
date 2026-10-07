// Selection Packs (Bathroom Accessory Packs): pack -> rooms -> component allocation lines ->
// Client Selections totals / allowance / variation -> Quotation Builder -> BOQ -> Procurement.
//
// Run: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-selection-packs.mjs
import assert from "node:assert/strict";
import { getEffectiveProductCatalogue } from "../lib/product-library/catalogueService.js";
import { guidedRequirementByKey, statusForRequirement } from "../lib/builders/clientSelectionWorkflow.js";
import { plumbingLinesFromSelection, upsertPlumbingLine } from "../lib/builders/plumbingFixtureAllocation.js";
import { plumbingSelectionPatch } from "../lib/builders/plumbingSelectionPatch.js";
import { connectAllocatedSelectionsToQuotation } from "../lib/builders/allocatedSelectionQuotation.js";
import { quoteQuantity, quotationSectionsForFinalBoq } from "../lib/construction-estimation/finalQuotationBoq.js";
import {
  BATHROOM_ACCESSORY_PACK_GROUP as GROUP,
  availableSelectionPacks,
  generateCoordinatedPacks,
  normaliseSelectionPack,
  productRangeName,
  saveBuilderSelectionPackConfig,
  getBuilderSelectionPackConfig,
  selectedSelectionPack,
  selectionPackChanges,
  selectionPackComponentAlternatives,
  selectionPackRooms,
  substituteSelectionPackComponent,
} from "../lib/builders/selectionPacks.js";

const products = getEffectiveProductCatalogue().products;

// --- range names come from the library's own product names
assert.equal(productRangeName({ productName: "Vivid Slimline 800mm Single Towel Rail", range: "Vivid" }), "Vivid Slimline");
assert.equal(productRangeName({ productName: "Riviere Towel Ring" }), "Riviere");
assert.equal(productRangeName({ productName: "Olde English Toilet Roll Holder", range: "Olde" }), "Olde English");

// --- packs offered: coordinated, never mixing brand or finish
const offered = availableSelectionPacks({ products });
assert(offered.packs.length >= 4, "the library fills several coordinated packs");
for (const pack of offered.packs) {
  assert(pack.available && pack.packName && pack.brand && pack.finish && pack.imageUrl, `pack card data: ${pack.packId}`);
  for (const component of pack.components) {
    assert.equal(component.product.brand, pack.brand, `${pack.packId}: one brand`);
    assert.equal(component.product.finish || component.product.colour, pack.finish, `${pack.packId}: one finish`);
    if (pack.coordination === "range") assert.equal(productRangeName(component.product), pack.range, `${pack.packId}: one range`);
  }
  assert.equal(pack.pricePerPack, pack.components.reduce((total, component) => total + component.unitPrice * component.quantity, 0));
}
const standard = offered.packs.find((pack) => pack.isDefault);
assert(standard && standard.tier === "standard" && standard.packId === offered.defaultPackId);
assert.equal(offered.allowancePerPack, standard.pricePerPack, "allowance per pack = the standard pack");
assert.deepEqual(standard.components.map((component) => [component.componentKey, component.quantity]), [["towel-rail", 1], ["hand-towel", 1], ["toilet-roll-holder", 1], ["robe-hook", 1]]);
const upgraded = offered.packs.find((pack) => pack.tier === "upgraded" && pack.pricePerPack > standard.pricePerPack);
assert.equal(upgraded.components.find((component) => component.componentKey === "robe-hook").quantity, 2);
assert.equal(generateCoordinatedPacks([], undefined).length, 0);

// --- required quantity from the project's rooms; Powder Room / WC / Laundry never count
const rooms = (names) => selectionPackRooms(GROUP, names);
assert.equal(rooms(["Kitchen", "Laundry", "Main Bathroom", "Ensuite", "Powder Room", "Bedroom 1"]).quantity, 2);
assert.equal(rooms(["Bathroom", "Ensuite", "Ensuite 2", "WC"]).quantity, 3);
assert.equal(rooms(["Main Bathroom", "Bathroom", "Bathroom Vanity", "Ensuite", "Ensuite Vanity"]).quantity, 2, "one room named three ways is one room");
assert.equal(rooms(["Powder Room", "WC", "Laundry"]).quantity, 0);
assert.equal(selectionPackRooms(GROUP, ["Main Bathroom", "Ensuite", "Bathroom Accessories"], {}, { notRooms: ["Bathroom Accessories", "Plumbing Fixtures"] }).quantity, 2, "a selection category is not a bathroom");
assert.deepEqual(rooms(["Main Bathroom", "Ensuite", "Powder Room"]).excluded.map((room) => room.label), ["Powder Room"]);
assert.equal(selectionPackRooms(GROUP, ["Bathroom", "Powder Room"], { [GROUP]: { roomRules: { "powder-room": 1 } } }).quantity, 2, "room rules are configuration");

// --- a book exactly as the Selections Book stores it: one row per requirement
const required = rooms(["Main Bathroom", "Ensuite", "Powder Room"]);
let book = { rooms: [{ rows: [] }] };
const linesOf = () => Object.fromEntries(book.rooms[0].rows.map((row) => [row.guidedRequirementKey, plumbingLinesFromSelection(row.guidedSelection)]));
const commit = (changes) => {
  changes.forEach(({ requirementKey, lines }) => {
    const requirement = guidedRequirementByKey(requirementKey);
    const previous = book.rooms[0].rows.find((row) => row.guidedRequirementKey === requirementKey);
    const built = plumbingSelectionPatch(requirement, lines, previous?.guidedSelection || null);
    const rows = book.rooms[0].rows.filter((row) => row.guidedRequirementKey !== requirementKey);
    if (built) rows.push(JSON.parse(JSON.stringify({ guidedRequirementKey: requirementKey, ...built.patch })));
    book = { rooms: [{ rows }] };
  });
};

// A towel rail the client had already chosen individually must survive every pack operation.
const ownRail = products.find((product) => product.productName === "Vela 600mm Single Towel Rail");
commit([{ requirementKey: "towel-rail", lines: upsertPlumbingLine([], { lineId: ownRail.productId, productId: ownRail.productId, productCode: ownRail.productCode, productName: ownRail.productName, unit: "EACH", unitPrice: 174, unitAllowance: 0, allocations: [{ location: "Powder Room", quantity: 1 }] }) }]);

// --- select the upgraded pack: 2 packs -> 2 of everything, 4 robe hooks
commit(selectionPackChanges(linesOf(), GROUP, upgraded, required.rooms, { allowancePerPack: offered.allowancePerPack }));
let selected = selectedSelectionPack(linesOf(), GROUP);
assert.equal(selected.packId, upgraded.packId);
assert.equal(selected.packQuantity, 2);
assert.deepEqual(Object.fromEntries(selected.components.map((component) => [component.componentKey, component.quantity])), { "towel-rail": 2, "hand-towel": 2, "toilet-roll-holder": 2, "robe-hook": 4 });
assert.equal(selected.selectedTotal, upgraded.pricePerPack * 2);
assert.equal(selected.allowanceTotal, offered.allowancePerPack * 2, "2 packs x allowance per pack");
assert.equal(selected.variation, (upgraded.pricePerPack - offered.allowancePerPack) * 2);
for (const component of selected.components) {
  assert.deepEqual(component.line.allocations.map((allocation) => [allocation.location, allocation.quantity]), [["Main Bathroom", component.quantityPerPack], ["Ensuite", component.quantityPerPack]]);
  assert.equal(statusForRequirement(guidedRequirementByKey(component.requirementKey), { selection_status: "selected", selected_details: book.rooms[0].rows.find((row) => row.guidedRequirementKey === component.requirementKey).guidedSelection }), "complete");
}
assert.equal(linesOf()["towel-rail"].length, 2, "individual towel rail kept beside the pack's");

// --- Quotation Builder, BOQ and Procurement receive component quantities, with the pack named
let workbook = connectAllocatedSelectionsToQuotation({ quotation: {}, procurement: { items: [] } }, book);
const section = workbook.quotation["FIX OUT - BATHROOM ACCESSORIES - CLIENT SELECTIONS"];
const packRows = section.rows.filter((row) => row.selectionPack);
assert.equal(packRows.length, 4);
assert.equal(section.rows.length, 5);
const hookRow = packRows.find((row) => row.selectionPack.componentLabel === "Robe Hook");
assert.equal(hookRow.qty, 4);
assert.deepEqual(hookRow.locationSchedule, [{ location: "Main Bathroom", quantity: 2 }, { location: "Ensuite", quantity: 2 }]);
assert.equal(hookRow.selectionPack.packName, upgraded.packName);
assert.match(hookRow.description, /2 x .*Accessory Pack/);
assert(hookRow.productId && hookRow.productCode, "a real Product Library product, not a pack placeholder");
const incGst = packRows.reduce((total, row) => total + row.excelRate * row.qty * 1.1, 0);
assert(Math.abs(incGst - upgraded.pricePerPack * 2) < 0.01, "quotation rows add back to the pack total (ex GST x 1.1)");
assert.equal(packRows.reduce((total, row) => total + row.allowanceTotal, 0), offered.allowancePerPack * 2);
const boq = quotationSectionsForFinalBoq(workbook.quotation).flatMap((entry) => entry.rows).filter((row) => row.selectionPack);
assert.equal(boq.length, 4, "BOQ lists each component");
assert.equal(boq.reduce((total, row) => total + quoteQuantity(row), 0), 10);
const orders = workbook.procurement.items.filter((item) => item.selectionPack);
assert.deepEqual(orders.map((item) => item.qty).sort(), [2, 2, 2, 4]);
assert(orders.every((item) => item.supplier && item.productCode && /Accessory Pack/.test(item.notes)));

// --- substitute one component; the rest of the pack, its quantity and allowance stay
const rail = selected.components.find((component) => component.componentKey === "towel-rail");
const alternatives = selectionPackComponentAlternatives(products, rail);
assert(alternatives[0].coordinated, "same brand + finish offered first");
assert.equal(alternatives.filter((option) => option.current).length, 1);
const swap = alternatives.find((option) => !option.current && option.unitPrice !== null && option.unitPrice !== rail.line.unitPrice);
commit([{ requirementKey: "towel-rail", lines: linesOf()["towel-rail"].map((line) => (line.lineId === rail.line.lineId ? substituteSelectionPackComponent(line, swap.product) : line)) }]);
const afterSwap = selectedSelectionPack(linesOf(), GROUP);
const swappedRail = afterSwap.components.find((component) => component.componentKey === "towel-rail");
assert(afterSwap.substituted && swappedRail.substituted);
assert.equal(swappedRail.line.productName, swap.product.productName);
assert.equal(swappedRail.packProductName, rail.line.productName);
assert.equal(swappedRail.quantity, 2);
assert.equal(afterSwap.selectedTotal, selected.selectedTotal + (swap.unitPrice - rail.line.unitPrice) * 2, "price recalculated");
assert.equal(afterSwap.allowanceTotal, selected.allowanceTotal, "allowance unchanged");
assert.equal(afterSwap.variation, selected.variation + (swap.unitPrice - rail.line.unitPrice) * 2, "variation recalculated");
assert.equal(afterSwap.components.filter((component) => component.substituted).length, 1);
workbook = connectAllocatedSelectionsToQuotation(workbook, book);
const swappedRow = workbook.quotation["FIX OUT - BATHROOM ACCESSORIES - CLIENT SELECTIONS"].rows.find((row) => row.selectionPack?.componentLabel === "Towel Rail");
assert.equal(swappedRow.productCode, swap.product.productCode);
assert(swappedRow.selectionPack.substituted);
// Choosing the pack's own product again clears the substitution.
const back = alternatives.find((option) => option.current).product;
assert.equal(substituteSelectionPackComponent(swappedRail.line, back).selectionPack.substituted, false);

// --- selecting another pack replaces the first; removing it leaves only the individual rail
commit(selectionPackChanges(linesOf(), GROUP, standard, required.rooms, { allowancePerPack: offered.allowancePerPack }));
selected = selectedSelectionPack(linesOf(), GROUP);
assert.equal(selected.packId, standard.packId);
assert.equal(selected.variation, 0, "the standard pack is the allowance");
assert.equal(selected.components.find((component) => component.componentKey === "robe-hook").quantity, 2);
commit(selectionPackChanges(linesOf(), GROUP, null));
assert.equal(selectedSelectionPack(linesOf(), GROUP), null);
assert.deepEqual(Object.keys(linesOf()), ["towel-rail"]);
assert.equal(linesOf()["towel-rail"][0].productName, ownRail.productName);
workbook = connectAllocatedSelectionsToQuotation(workbook, book);
assert.equal(workbook.procurement.items.filter((item) => item.selectionPack).length, 0);

// --- builder-configured pack: own contents, quantities, pack price and allowance
const cfg = saveBuilderSelectionPackConfig("org-test", {
  packs: [normaliseSelectionPack({
    packId: "custom-pack", packName: "Display Home Accessory Pack", brand: standard.brand, finish: standard.finish, packPrice: 300, isDefault: true,
    components: standard.components.map((component) => ({ componentKey: component.componentKey, requirementKey: component.requirementKey, label: component.label, quantity: component.componentKey === "robe-hook" ? 3 : 1, productCode: component.productCode })),
  })],
  settings: { [GROUP]: { allowancePerPack: 300 } },
});
assert.equal(getBuilderSelectionPackConfig("org-test").packs.length, 1);
assert.equal(getBuilderSelectionPackConfig("other-org").packs.length, 0);
const configured = availableSelectionPacks({ products, config: cfg });
const custom = configured.packs.find((pack) => pack.packId === "custom-pack");
assert(custom.isDefault && custom.pricePerPack === 300 && configured.allowancePerPack === 300);
book = { rooms: [{ rows: [] }] };
commit(selectionPackChanges(linesOf(), GROUP, custom, required.rooms, { allowancePerPack: configured.allowancePerPack }));
selected = selectedSelectionPack(linesOf(), GROUP);
assert.equal(selected.selectedTotal, 600, "pack price carried by the components");
assert.equal(selected.allowanceTotal, 600);
assert.equal(selected.components.find((component) => component.componentKey === "robe-hook").quantity, 6);
// The user's example: allowance 2 x $300, selected 2 x $420 -> +$240.
const example = { ...custom, packId: "example", packPrice: 420, pricePerPack: 420, components: custom.components.map((component) => ({ ...component, quantity: 1 })) };
book = { rooms: [{ rows: [] }] };
commit(selectionPackChanges(linesOf(), GROUP, example, required.rooms, { allowancePerPack: 300 }));
selected = selectedSelectionPack(linesOf(), GROUP);
assert.deepEqual([selected.allowanceTotal, selected.selectedTotal, selected.variation], [600, 840, 240]);

console.log(JSON.stringify({ passed: true, packs: offered.packs.length, standard: `${standard.packName} (${standard.finish}) $${standard.pricePerPack}`, upgraded: `${upgraded.packName} (${upgraded.finish}) $${upgraded.pricePerPack}`, requiredForBathroomPlusEnsuite: required.quantity }, null, 2));
