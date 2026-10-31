// Assignments: edit, replace, add another, apply to other rooms - without double counting.
// Run: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-selection-assignments.mjs
import assert from "node:assert/strict";
import { plumbingLineWithTotals, plumbingLocationKey } from "../lib/builders/plumbingFixtureAllocation.js";
import { addAssignment, applyAssignmentToRooms, applyToRoomsPreview, assignedQuantity, assignmentRows, assignmentsAt, removeAssignment, replaceAssignment, replaceLineProduct, roomConflicts, saveLineWithDecision, updateAssignment } from "../lib/builders/selectionAssignments.js";

const results = {};
const check = (name, run) => { try { run(); results[name] = "PASS"; } catch (error) { results[name] = "FAIL"; console.error(`FAIL ${name}:`, String(error.message).slice(0, 900)); } };
const NOW = "2026-10-09T00:00:00.000Z";
const line = (productName, allocations, unitPrice = 200, unitAllowance = 150) => plumbingLineWithTotals({ lineId: `line-${productName}`, productId: `id-${productName}`, productName, finish: "White", unit: "EACH", unitPrice, unitAllowance, priceIncludesGst: false,
  allocations: allocations.map(([location, quantity]) => ({ locationKey: plumbingLocationKey(location), location, quantity })) });
const view = (lines) => lines.map((item) => `${item.productName}: ${item.allocations.map((a) => `${a.location}×${a.quantity}${a.additional ? "+" : ""}`).join(", ")} = ${item.quantity}`);
const stanza = line("Stanza Fan", [["Bedroom 1", 1], ["Bedroom 2", 1], ["Dining", 1]]);
const spyda = line("Spyda Fan", [["Alfresco", 1]], 300);
const lines = [stanza, spyda];
const aero = line("AeroFlow Fan", [], 250);

check("EVERY ASSIGNMENT IS A ROW THAT CAN BE EDITED", () => {
  assert.deepEqual(assignmentRows(lines).map((row) => [row.productName, row.location, row.quantity, row.unitPrice, row.variationEach]), [["Stanza Fan", "Bedroom 1", 1, 200, 50], ["Stanza Fan", "Bedroom 2", 1, 200, 50], ["Stanza Fan", "Dining", 1, 200, 50], ["Spyda Fan", "Alfresco", 1, 300, 150]]);
  assert.equal(assignedQuantity(lines), 4);
  // Change a quantity: the assignment changes, no record is added.
  const more = updateAssignment(lines, stanza.lineId, "dining", { quantity: 2 }, NOW);
  assert.deepEqual(view(more), ["Stanza Fan: Bedroom 1×1, Bedroom 2×1, Dining×2 = 4", "Spyda Fan: Alfresco×1 = 1"]);
  assert.equal(more.length, 2); assert.equal(more[0].selectedTotal, 800); assert.equal(more[0].variation, 200);
  assert.deepEqual(more[0].history.at(-1), { action: "edit", from: "Dining ×1", to: "Dining ×2", at: NOW });
  // Move it to another room; moving onto a room that already has this product combines them.
  assert.deepEqual(view(updateAssignment(lines, stanza.lineId, "dining", { location: "Media Room" }, NOW)), ["Stanza Fan: Bedroom 1×1, Bedroom 2×1, Media Room×1 = 3", "Spyda Fan: Alfresco×1 = 1"]);
  assert.deepEqual(view(updateAssignment(lines, stanza.lineId, "dining", { location: "Bedroom 1" }, NOW)), ["Stanza Fan: Bedroom 1×2, Bedroom 2×1 = 3", "Spyda Fan: Alfresco×1 = 1"]);
  // Remove one assignment; removing a product's last room removes the product.
  assert.deepEqual(view(removeAssignment(lines, stanza.lineId, "bedroom-2", NOW)), ["Stanza Fan: Bedroom 1×1, Dining×1 = 2", "Spyda Fan: Alfresco×1 = 1"]);
  assert.deepEqual(view(removeAssignment(lines, spyda.lineId, "alfresco", NOW)), ["Stanza Fan: Bedroom 1×1, Bedroom 2×1, Dining×1 = 3"]);
  // The input is never changed.
  assert.deepEqual(view(lines), ["Stanza Fan: Bedroom 1×1, Bedroom 2×1, Dining×1 = 3", "Spyda Fan: Alfresco×1 = 1"]);
});
check("REPLACE EXISTING DOES NOT ADD A FAN; ADD ANOTHER DOES", () => {
  // Bedroom 2 already has a fan.
  assert.deepEqual(assignmentsAt(lines, "Bedroom 2"), [{ lineId: stanza.lineId, productName: "Stanza Fan", quantity: 1 }]);
  assert.deepEqual(assignmentsAt(lines, "Rumpus"), []);
  const replaced = replaceAssignment(lines, { location: "Bedroom 2", existingLineId: stanza.lineId }, aero, NOW);
  assert.deepEqual(view(replaced), ["Stanza Fan: Bedroom 1×1, Dining×1 = 2", "Spyda Fan: Alfresco×1 = 1", "AeroFlow Fan: Bedroom 2×1 = 1"]);
  assert.equal(assignedQuantity(replaced), assignedQuantity(lines), "the number of fans is unchanged");
  assert.equal(assignmentsAt(replaced, "Bedroom 2").length, 1);
  // Add another: a second fan in the room, marked as a deliberate addition.
  const added = addAssignment(lines, aero, "Bedroom 2", 1, { additional: true }, NOW);
  assert.deepEqual(view(added), ["Stanza Fan: Bedroom 1×1, Bedroom 2×1, Dining×1 = 3", "Spyda Fan: Alfresco×1 = 1", "AeroFlow Fan: Bedroom 2×1+ = 1"]);
  assert.equal(assignedQuantity(added), assignedQuantity(lines) + 1);
  assert.equal(assignmentRows(added).find((row) => row.productName === "AeroFlow Fan").additional, true);
  assert.deepEqual(added.at(-1).history.at(-1), { action: "add-another", location: "Bedroom 2", quantity: 1, at: NOW });
  // Replacing with the product already there, or a room with nothing in it, changes nothing.
  assert.equal(replaceAssignment(lines, { location: "Bedroom 2", existingLineId: stanza.lineId }, stanza, NOW), lines);
  assert.equal(replaceAssignment(lines, { location: "Rumpus", existingLineId: stanza.lineId }, aero, NOW), lines);
  // Replacing the last room of a product removes that product line.
  assert.deepEqual(view(replaceAssignment(lines, { location: "Alfresco", existingLineId: spyda.lineId }, stanza, NOW)), ["Stanza Fan: Bedroom 1×1, Bedroom 2×1, Dining×1, Alfresco×1 = 4"]);
});
check("REPLACE A PRODUCT EVERYWHERE IT IS USED", () => {
  const swapped = replaceLineProduct(lines, stanza.lineId, aero, NOW);
  assert.deepEqual(view(swapped), ["Spyda Fan: Alfresco×1 = 1", "AeroFlow Fan: Bedroom 1×1, Bedroom 2×1, Dining×1 = 3"]);
  assert.equal(assignedQuantity(swapped), 4);
});
check("APPLY TO OTHER ROOMS: PREVIEW, THEN INDEPENDENT ASSIGNMENTS", () => {
  const rooms = [{ name: "Bedroom 1" }, { name: "Bedroom 3" }, { name: "Bedroom 4" }, { name: "Alfresco" }];
  assert.deepEqual(applyToRoomsPreview(lines, stanza.lineId, rooms).map((entry) => [entry.room, entry.state, entry.existing.map((item) => item.productName)]),
    [["Bedroom 1", "already", []], ["Bedroom 3", "add", []], ["Bedroom 4", "add", []], ["Alfresco", "occupied", ["Spyda Fan"]]]);
  // A room that already holds another product is left alone unless the builder chose to replace it.
  const kept = applyAssignmentToRooms(lines, stanza.lineId, rooms, {}, NOW);
  assert.deepEqual(view(kept.lines), ["Stanza Fan: Bedroom 1×1, Bedroom 2×1, Dining×1, Bedroom 3×1, Bedroom 4×1 = 5", "Spyda Fan: Alfresco×1 = 1"]);
  assert.deepEqual([kept.applied, kept.skipped], [["Bedroom 3", "Bedroom 4"], ["Alfresco"]]);
  const replaced = applyAssignmentToRooms(lines, stanza.lineId, rooms, { replaceOccupied: true }, NOW);
  assert.deepEqual(view(replaced.lines), ["Stanza Fan: Bedroom 1×1, Bedroom 2×1, Dining×1, Bedroom 3×1, Bedroom 4×1, Alfresco×1 = 6"]);
  assert.equal(assignedQuantity(replaced.lines), 6, "Alfresco still has one fan, not two");
  // Each room is its own assignment: changing one does not change another.
  const changed = updateAssignment(kept.lines, stanza.lineId, "bedroom-3", { quantity: 2 }, NOW);
  assert.deepEqual(assignmentRows(changed).filter((row) => /Bedroom/.test(row.location)).map((row) => [row.location, row.quantity]), [["Bedroom 1", 1], ["Bedroom 2", 1], ["Bedroom 3", 2], ["Bedroom 4", 1]]);
  // Applying twice adds nothing.
  assert.deepEqual(view(applyAssignmentToRooms(kept.lines, stanza.lineId, rooms, {}, NOW).lines), view(kept.lines));
});
check("CHOOSING A PRODUCT FOR AN OCCUPIED ROOM ASKS FIRST", () => {
  // AeroFlow is being saved into Bedroom 2 (has a Stanza) and Rumpus (empty).
  const draft = line("AeroFlow Fan", [["Bedroom 2", 1], ["Rumpus", 1]], 250);
  const conflicts = roomConflicts(lines, draft, null);
  assert.deepEqual(conflicts.map((c) => [c.location, c.existing.map((e) => e.productName)]), [["Bedroom 2", ["Stanza Fan"]]]);
  const replaced = saveLineWithDecision(lines, draft, conflicts, "replace", NOW);
  assert.deepEqual(view(replaced), ["Stanza Fan: Bedroom 1×1, Dining×1 = 2", "Spyda Fan: Alfresco×1 = 1", "AeroFlow Fan: Bedroom 2×1, Rumpus×1 = 2"]);
  assert.equal(assignedQuantity(replaced), assignedQuantity(lines) + 1, "only the empty room gains a fan");
  const added = saveLineWithDecision(lines, draft, conflicts, "add", NOW);
  assert.deepEqual(view(added), ["Stanza Fan: Bedroom 1×1, Bedroom 2×1, Dining×1 = 3", "Spyda Fan: Alfresco×1 = 1", "AeroFlow Fan: Bedroom 2×1+, Rumpus×1 = 2"]);
  // Editing a product that already shares a room is not asked about again; no conflict when rooms are free.
  assert.deepEqual(roomConflicts(added, added.at(-1), added.at(-1)), []);
  assert.deepEqual(roomConflicts(lines, line("AeroFlow Fan", [["Rumpus", 1]]), null), []);
  // Changing the quantity of the product already in the room is an edit, not a duplicate.
  assert.deepEqual(roomConflicts(lines, line("Stanza Fan", [["Bedroom 1", 2], ["Bedroom 2", 1], ["Dining", 1]]), stanza), []);
});

for (const [name, result] of Object.entries(results)) console.log(`${name}: ${result}`);
if (Object.values(results).includes("FAIL")) process.exit(1);
