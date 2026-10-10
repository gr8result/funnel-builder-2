import assert from "node:assert/strict";
import { quotationSectionsForFinalBoq } from "../lib/construction-estimation/finalQuotationBoq.js";
import { quoteRowCost } from "../lib/construction-estimation/quoteRowCost.js";
import { SELECTION_REPLACED_STATUS } from "../lib/construction-estimation/selectionReplacement.js";
import { applyFlooringChoice, connectFlooringSelectionsToQuotation, flooringLines, flooringSelectionPatch, flooringTakeoffData, suggestedFlooringAreas } from "../lib/builders/flooringSelection.js";

// Carpet comes only from measured carpet floor-finish records. The 152.15 m2 outer footprint is
// never carpet, and the 65.80 m2 difference (152.15 - 86.35) is never a carpet quantity.
const FOOTPRINT = 152.15, CARPET = 86.35;
const carpetParts = [18.705462969948947, 13.443071896133418, 12.186094822520342, 42.01881566155963];
const record = (kind, room, category, quantity) => ({ kind, room, category, quantity, unit: "m2" });
const schedule = { measurementRecords: [
  record("floorArea", "Outer Footprint", "Footprint", 225.5618377185214),
  record("floorArea", "Outer Footprint", "Footprint", FOOTPRINT),
  ...carpetParts.map((quantity) => record("floorFinish", `Carpets: ${quantity.toFixed(2)} m2`, "Carpets", quantity)),
  record("floorFinish", "Hybrid: 101.09 m2", "Hybrid", 101.08529089560162),
] };

const carpet = { productId: "p-carpet", productCode: "FLR-GH-TWILIGHT", familyKey: "flooring", supplier: "", brand: "Godfrey Hirst", range: "Highland Park", attributes: { flooringType: "carpet", carpetSpecs: { rollWidthM: 3.66, fibre: "Wool blend" } }, variants: [{ variantId: "godfrey-hirst:0558710160", sku: "0558710160", colour: "Twilight", productName: "Highland Park Twilight", regularPricePerM2: null, packCoverageM2: null }] };
const productById = (id) => (id === carpet.productId ? carpet : null);
const variantId = carpet.variants[0].variantId;
const carpetAllowance = { id: "quote-2015", item: "CARPET", unit: "M2", quantity: "", excelRate: "$30.00", quantityManualOverride: false };
const workbook = () => ({
  takeoffSchedule: schedule,
  data: { inputDataSheet: { rows: { floorFinishCarpetsM2: { value: "" } } } },
  quotation: { "FLOORCOVERINGS (149)": { rows: [{ ...carpetAllowance }] } },
});

const takeoff = flooringTakeoffData(workbook());
const measured = takeoff.finishes.find((finish) => finish.flooringType === "carpet");
assert.equal(measured.areaM2, CARPET, "carpet is the sum of the carpet floor-finish records");
assert.equal(takeoff.rooms.some((room) => /footprint/i.test(room.name)), false, "the outer footprint is never a flooring room");

let areas = suggestedFlooringAreas([], takeoff).filter((area) => area.takeoffKey === "floorFinishCarpetsM2");
areas = applyFlooringChoice(areas, areas.map((area) => area.id), { productId: carpet.productId, variantId });
const footprintArea = { id: "footprint-area", name: "Outer Footprint", areaM2: FOOTPRINT, areaSource: "manual", productId: carpet.productId, variantId, wastagePct: 0 };
assert.equal(flooringLines([...areas, footprintArea], { productById })[0].netAreaM2, CARPET, "a footprint-named area is ignored");

const book = { rooms: [{ rows: [flooringSelectionPatch({}, areas, { productById })] }] };
const carpetRows = (wb) => Object.values(wb.quotation).flatMap((section) => section.rows).filter((row) => row.flooringType === "carpet");
let wb = connectFlooringSelectionsToQuotation(workbook(), book, { productById });
for (let pass = 1; pass <= 4; pass += 1) {
  wb = connectFlooringSelectionsToQuotation(JSON.parse(JSON.stringify(wb)), book, { productById }); // save + reopen
  assert.equal(carpetRows(wb).length, 1, `pass ${pass}: no duplicate carpet row`);
  assert.equal(carpetRows(wb)[0].quantity, CARPET, `pass ${pass}: carpet stays 86.35`);
  assert.equal(wb.procurement.items.filter((item) => item.variantId === variantId).length, 1, `pass ${pass}: no duplicate procurement item`);
}
const allowanceOf = (w) => w.quotation["FLOORCOVERINGS (149)"].rows.find((row) => row.id === "quote-2015");
const activeCarpet = (w) => quotationSectionsForFinalBoq(w.quotation).flatMap((s) => s.rows).filter((row) => row.flooringType === "carpet" || row.id === "quote-2015");

// The estimate allowance is kept, marked replaced and inactive; never zeroed or overridden.
const allowance = allowanceOf(wb);
assert.deepEqual([allowance.quantity, allowance.excelRate, allowance.quantityManualOverride], ["", "$30.00", false], "original quantity, rate and override are preserved");
assert.equal(allowance.selectionReplacement.status, SELECTION_REPLACED_STATUS);
assert.equal(allowance.active, false);
assert.equal(allowance.selectionReplacement.replacementRowId, `flooring:${variantId}`);
assert.equal(carpetRows(wb)[0].replacesRows[0].rowId, "quote-2015", "the selected row shows what it replaces");
assert.notEqual(carpetRows(wb)[0].quantity, FOOTPRINT - CARPET);

// BOQ, totals and procurement carry exactly one active carpet quantity.
const boqRows = activeCarpet(wb);
assert.deepEqual(boqRows.map((row) => [row.id, row.quantity]), [[`flooring:${variantId}`, CARPET]], "BOQ has the selected carpet once and not the replaced allowance");
const rateBearing = JSON.parse(JSON.stringify(wb));
allowanceOf(rateBearing).quantity = "100"; // an allowance that would otherwise cost 100 x $30
const rateBearingOut = connectFlooringSelectionsToQuotation(rateBearing, book, { productById });
assert.equal(quoteRowCost({ quantity: 100, rate: 30, inactive: true }), 0);
assert.equal(allowanceOf(rateBearingOut).quantity, "100", "a real allowance quantity is kept, not reduced");
assert.equal(activeCarpet(rateBearingOut).length, 1, "a rate-bearing replaced allowance is not charged as well");
assert.equal(wb.procurement.items.filter((item) => item.flooringType === "carpet").length, 1);
assert.equal(wb.procurement.items.some((item) => item.quoteRowId === "quote-2015"), false, "the replaced allowance has no procurement item");

// A footprint-fed allowance quantity is preserved exactly (never 65.80), and is replaced not reduced.
const fed = workbook();
fed.quotation["FLOORCOVERINGS (149)"].rows[0] = { ...carpetAllowance, quantity: FOOTPRINT, autoQuantity: true };
let fedOut = connectFlooringSelectionsToQuotation(fed, book, { productById });
fedOut = connectFlooringSelectionsToQuotation(JSON.parse(JSON.stringify(fedOut)), book, { productById });
assert.equal(allowanceOf(fedOut).quantity, FOOTPRINT, "152.15 is not reduced to 65.80");
assert.equal(allowanceOf(fedOut).selectionReplacement.allowanceQuantity, FOOTPRINT);
assert.equal(activeCarpet(fedOut).length, 1);
const fedRestored = allowanceOf(connectFlooringSelectionsToQuotation(fedOut, { rooms: [] }, { productById }));
assert.deepEqual([fedRestored.quantity, fedRestored.autoQuantity, fedRestored.selectionReplacement, fedRestored.active], [FOOTPRINT, true, undefined, undefined], "removing the selection restores the original allowance");

// A genuine estimator override survives replacement and restoration.
const manual = workbook();
manual.quotation["FLOORCOVERINGS (149)"].rows[0] = { ...carpetAllowance, quantity: "20", quantityManualOverride: true };
const manualOut = connectFlooringSelectionsToQuotation(manual, book, { productById });
assert.deepEqual([allowanceOf(manualOut).quantity, allowanceOf(manualOut).quantityManualOverride], ["20", true]);
const manualBack = allowanceOf(connectFlooringSelectionsToQuotation(manualOut, { rooms: [] }, { productById }));
assert.deepEqual([manualBack.quantity, manualBack.quantityManualOverride, manualBack.active], ["20", true, undefined]);

// An estimator who had already switched the allowance off gets it back switched off.
const off = workbook();
off.quotation["FLOORCOVERINGS (149)"].rows[0] = { ...carpetAllowance, active: false };
const offOut = connectFlooringSelectionsToQuotation(off, book, { productById });
assert.equal(allowanceOf(offOut).selectionReplacement, undefined, "an already inactive allowance is not matched");
assert.equal(allowanceOf(offOut).active, false);

// A row an earlier version reduced (86.35 off 152.15, override set) returns to its recorded values.
const legacy = workbook();
legacy.quotation["FLOORCOVERINGS (149)"].rows[0] = { ...carpetAllowance, qty: 65.8, quantity: 65.8, autoQuantity: false, quantityManualOverride: true, carpetAllocation: { netAreaM2: CARPET, original: { qty: FOOTPRINT, quantity: FOOTPRINT, autoQuantity: true, quantityManualOverride: "", cost: "", importedCost: "" } } };
const healed = allowanceOf(connectFlooringSelectionsToQuotation(legacy, { rooms: [] }, { productById }));
assert.equal(healed.quantity, FOOTPRINT);
assert.equal(healed.quantityManualOverride, undefined, "the manufactured override is removed");
assert.equal(healed.carpetAllocation, undefined);

// Clearing the selection removes every connector row and restores the allowance exactly.
const cleared = connectFlooringSelectionsToQuotation(wb, { rooms: [] }, { productById });
assert.equal(carpetRows(cleared).length, 0);
assert.deepEqual(allowanceOf(cleared), { ...carpetAllowance }, "the allowance row is byte-for-byte as the estimator left it");
assert.equal(cleared.procurement.items.some((item) => item.flooringType === "carpet"), false);
console.log("flooring carpet connector: measured 86.35; footprint 152.15 and 65.80 difference never used; replacement status; idempotent; overrides preserved; allowance restored");