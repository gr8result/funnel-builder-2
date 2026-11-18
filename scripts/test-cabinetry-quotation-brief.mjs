// Client Selections cabinetry -> Quotation Builder (16 Nov 2026), on a read-only copy of the real job.
//  - every room's confirmed client specification reaches the quotation brief, in its own room only;
//  - benchtop / bulkhead runs with no measurement are BUILDER ACTION REQUIRED (never zero-filled);
//  - the builder enters a length in the Quotation Builder: it becomes an approved quantity on the
//    quotation row and does NOT withdraw the client's cabinetry approval;
//  - a later client change of benchtop product keeps the approved length;
//  - re-running the import adds no row and changes no quantity (no duplicate charges).
//   node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-cabinetry-quotation-brief.mjs [--job=<file.gr8job>]
import assert from "node:assert/strict";
import fs from "node:fs";
import JSZip from "jszip";
import { applyCabinetryRequirementsToQuotation as apply, cabinetryQuotationBriefs, updateCabinetrySelectionRequirement } from "../lib/construction-estimation/cabinetryRequirements.js";
import { isCabinetryRoomApproved, normaliseCabinetrySelection } from "../lib/builders/cabinetryWorkflow.js";

const file = process.argv.find((item) => item.startsWith("--job="))?.slice(6) || process.env.CLIENT_SELECTIONS_JOB_FILE || "E:/dev/quotation-recovery-20261108/restored/New Job 03 09 LATEST VERSION 11-11.gr8job";
assert(fs.existsSync(file), `real job copy not found: ${file}`);
const original = JSON.parse(await (await JSZip.loadAsync(fs.readFileSync(file))).file("estimate.json").async("string")).workbook;
const owner = original.workspaceId;
const cabinetryOf = (workbook) => workbook.clientSelectionsBook.rooms.flatMap((room) => room.rows || []).find((row) => row.guidedSelection?.cabinetrySelection).guidedSelection.cabinetrySelection;
const kitchenApproved = (workbook) => {
  const selection = normaliseCabinetrySelection(cabinetryOf(workbook));
  const kitchen = selection.locations.find((location) => location.location === "Kitchen");
  return isCabinetryRoomApproved(kitchen, selection.schedule, kitchen.reviewApproval?.jobId || "");
};
const brief = (workbook, room) => cabinetryQuotationBriefs(workbook).find((item) => item.room === room);
const value = (item, label) => item.clientSelections.find((line) => line.label === label)?.value || "";
const quantityRows = (workbook) => (workbook.quotation.CABINETRY?.rows || []).filter((row) => Number(row.quantity) > 0).map((row) => `${row.importKey}=${row.quantity}`).sort();

const settled = apply(original, owner);
assert.equal(kitchenApproved(settled), true, "the real Kitchen approval (stored before 16 Nov) is still honoured");

// 1. The client's confirmed specification, room by room.
const kitchen = brief(settled, "Kitchen");
assert.equal(value(kitchen, "Base doors & drawers"), "Polytec Arcadia Oak / Woodmatt");
assert.equal(value(kitchen, "Overhead doors"), "Polytec Arabica / Smooth");
assert.match(value(kitchen, "Main benchtop"), /Eclipse/, "the Kitchen benchtop product reaches the quotation");
assert.equal(value(kitchen, "Bulkheads"), "Raw MDF 300/450 (site-painted)");
assert.equal(value(kitchen, "Handles - base units"), "Sharkfin");
assert.ok(kitchen.clientSelections.some((line) => line.productId), "Product Library identities are carried");
const pantry = brief(settled, "Butler's Pantry");
assert.ok(!pantry.clientSelections.some((line) => /Eclipse/.test(line.value)), "the Kitchen benchtop does not appear in Butler's Pantry");
assert.ok(!kitchen.clientSelections.some((line) => /butler/i.test(`${line.label} ${line.value}`)), "nothing of Butler's Pantry appears in Kitchen");
assert.match(value(brief(settled, "Laundry"), "Bulkheads"), /Raw MDF 300\/450 \(site-painted\) - paint colour to match the walls/, "a legacy painted bulkhead names the substrate and the outstanding paint colour separately");

// 2. Outstanding measurements: genuine gaps only, never zero-filled.
const required = kitchen.measurements.filter((item) => item.status === "required").map((item) => item.label);
assert.deepEqual(required.sort(), ["MDF bulkhead - 300mm - LM", "Main benchtop"].sort(), "Kitchen needs its benchtop and bulkhead measured");
assert.ok(kitchen.measurements.filter((item) => item.status === "required").every((item) => item.quantity === null), "a missing measurement is never a zero quantity");
assert.equal(brief(settled, "Butler's Pantry").outstanding, 0, "Butler's Pantry measurements are complete (3.2 LM bulkhead, 3 LM benchtop)");
assert.ok(brief(settled, "Butler's Pantry").measurements.some((item) => item.status === "approved" && item.quantity === 3.2));

// 3. The builder enters the Kitchen benchtop and bulkhead lengths in the Quotation Builder.
const bulkheadId = kitchen.measurements.find((item) => /bulkhead/i.test(item.label)).requirementId;
const measured = apply(updateCabinetrySelectionRequirement(updateCabinetrySelectionRequirement(settled, "benchtop:kitchen:benchtop-main", { kind: "length", value: 4.2 }), bulkheadId, 3.6), owner);
const kitchenMeasured = brief(measured, "Kitchen");
assert.equal(kitchenMeasured.outstanding, 0, "no Kitchen measurement outstanding after the builder enters them");
assert.equal(kitchenMeasured.measurements.find((item) => /^Main benchtop/.test(item.label))?.quantity, 4.2, "the benchtop is an approved 4.2 LM");
assert.equal(kitchenMeasured.measurements.find((item) => /bulkhead/i.test(item.label))?.quantity, 3.6, "the bulkhead is an approved 3.6 LM");
assert.ok((measured.quotation.CABINETRY.rows || []).some((row) => /bulkhead/i.test(row.item) && /KITCHEN/.test(row.room) && Number(row.quantity) === 3.6), "the bulkhead length is the Kitchen quotation row quantity");
assert.equal(kitchenApproved(measured), true, "the builder measuring the Kitchen does not withdraw the client's approval");

// 4. The client changes the Kitchen benchtop product: the approved length stays.
const changed = structuredClone(measured);
const kitchenRoom = cabinetryOf(changed).locations.find((location) => location.location === "Kitchen");
kitchenRoom.benchtopAreas = kitchenRoom.benchtopAreas.map((area) => area.id === "benchtop-main" ? { ...area, surface: { ...area.surface, colourName: "Calacatta Test", productId: "test-calacatta" } } : area);
kitchenRoom.benchtop = kitchenRoom.benchtopAreas.find((area) => area.id === "benchtop-main").surface;
const afterChange = apply(changed, owner);
assert.match(value(brief(afterChange, "Kitchen"), "Main benchtop"), /Calacatta Test/, "the new benchtop product reaches the quotation");
assert.equal(brief(afterChange, "Kitchen").measurements.find((item) => /^Main benchtop/.test(item.label))?.quantity, 4.2, "the approved benchtop length is kept after a product change");
assert.equal(kitchenApproved(afterChange), false, "a changed client specification needs the client's approval again");

// 5. Repeated import: no new rows, no changed quantities.
const rowCount = measured.quotation.CABINETRY.rows.length;
const again = apply(apply(measured, owner), owner);
assert.equal(again.quotation.CABINETRY.rows.length, rowCount, "re-importing adds no rows");
assert.deepEqual(quantityRows(again), quantityRows(measured), "re-importing changes no quantity (no duplicate charges)");

console.log(`cabinetry quotation brief: specifications per room, ${required.length} Kitchen measurements flagged then approved by the builder without withdrawing the client approval, length kept on a product change, re-import idempotent (${rowCount} rows)`);
