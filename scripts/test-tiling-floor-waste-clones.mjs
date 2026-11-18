// Exact clone floor wastes (left by the old editor) are saved once, charged once, and the floor-waste
// labour is counted from the unique entries. Entries that differ in any priced field are kept.
//   node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-tiling-floor-waste-clones.mjs [job.json]
import assert from "node:assert/strict";
import fs from "node:fs";
import { tilingQuotationEntries, tilingSelectionPatch } from "../lib/builders/tilingRooms.js";
import { findDuplicateFloorWastes } from "../lib/builders/tilingFloorWasteDuplicates.js";

const waste = (overrides = {}) => ({ productId: "FW-100", productName: "Square floor waste", application: "Shower", quantity: 1, unitPrice: 55, linear: false, ...overrides });
const room = { id: "main-bath", name: "Main Bathroom", roomType: "bathroom", lengthMm: 3000, widthMm: 2500, heightMm: 2400, floorWastes: [waste(), waste(), waste({ application: "Floor" }), waste({ quantity: 2 })] };
const requirement = { requirementKey: "tiling-rooms", label: "Tiling", areaKey: "tiles-stone", areaLabel: "Tiles & Stone" };

const wasteRows = (entries) => entries.filter((entry) => /waste/i.test(entry.key || "") && !entry.labour);
const labourQty = (entries) => entries.filter((entry) => entry.key === "labour-floorWasteQty").reduce((sum, entry) => sum + entry.quantity, 0);

// Quotation: the clone is charged once; the Floor application and the quantity-2 entry are separate charges.
// The quotation holds one row per product and location: Shower = 1 (clone dropped) + 2 = 3, Floor = 1.
const entries = tilingQuotationEntries([room]);
const byKey = Object.fromEntries(wasteRows(entries).map((entry) => [entry.key, entry.quantity]));
assert.deepEqual(byKey, { "waste-FW-100-Shower": 3, "waste-FW-100-Floor": 1 }, JSON.stringify(byKey));
assert.equal(labourQty(entries), 4, "labour counts the unique wastes: 1 + 1 + 2 (the clone is not counted)");

// Save: a fresh save writes no clone.
const saved = tilingSelectionPatch(requirement, [room]);
const savedRooms = saved?.patch?.guidedSelection?.tilingRooms || saved?.guidedSelection?.tilingRooms || saved?.tilingRooms;
assert.ok(Array.isArray(savedRooms), "tilingSelectionPatch returns the saved rooms");
assert.equal(savedRooms[0].floorWastes.length, 3);
assert.equal(findDuplicateFloorWastes(savedRooms).length, 0, "no identical floor wastes are saved");
// An entry with its own id is never treated as a clone.
assert.equal(tilingSelectionPatch(requirement, [{ ...room, floorWastes: [waste({ id: "a" }), waste({ id: "b" })] }]).guidedSelection.tilingRooms[0].floorWastes.length, 2);

// Optional real job copy (JSON form).
if (process.argv[2]) {
  const job = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  const tilingRow = job.workbook.clientSelectionsBook.rooms.flatMap((r) => r.rows || []).find((row) => row.guidedSelection?.requirementKey === "tiling-rooms");
  const rooms = tilingRow.guidedSelection.tilingRooms;
  const clones = findDuplicateFloorWastes(rooms);
  const fresh = tilingSelectionPatch(requirement, rooms, { previous: tilingRow.guidedSelection }).guidedSelection.tilingRooms;
  assert.equal(findDuplicateFloorWastes(fresh).length, 0, "a fresh save of the real job writes no clone floor wastes");
  const realEntries = tilingQuotationEntries(rooms);
  for (const r of fresh) {
    const unique = (r.floorWastes || []).filter((w) => !w.linear).reduce((sum, w) => sum + (Number(w.quantity) || 0), 0);
    const labour = realEntries.filter((e) => e.room?.id === r.id && e.key === "labour-floorWasteQty").reduce((s, e) => s + e.quantity, 0);
    if (unique || labour) assert.equal(labour, unique, `${r.name}: labour ${labour} = unique point floor wastes ${unique}`);
  }
  console.log(`real job: ${clones.reduce((s, c) => s + c.copies - 1, 0)} clone floor wastes in ${clones.map((c) => c.roomName).join(", ")} -> saved and charged once; labour = unique wastes`);
}
console.log("PASS clone floor wastes saved and charged once; distinct entries kept; labour from unique wastes");
