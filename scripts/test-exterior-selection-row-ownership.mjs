// Regression: an Entry Door draft/selection must never be written into (or read from) the Bricks
// row. Reproduces the "Corinthian Sunburst on the Bricks card" defect.
import assert from "node:assert/strict";
import { patchEntryDoorDraft, entryDoorDetails } from "../lib/builders/entryDoorFurnitureSelection.js";
import { rowOwnedByOtherRequirement, selectionRowOwner } from "../lib/builders/selectionRowOwnership.js";

const brickRow = {
  id: "row-bricks",
  item: "Bricks",
  guidedRequirementKey: "bricks",
  selectedProduct: "Austral Bricks Coastal Shoreline",
  guidedSelection: { requirementKey: "bricks", productCode: "AUSTRAL-COASTAL-SHORELINE", productName: "Austral Bricks Coastal Shoreline" },
};
const claddingRow = {
  id: "row-cladding",
  item: "Cladding",
  guidedRequirementKey: "cladding",
  guidedSelection: { requirementKey: "cladding", productCode: "JH-LINEA-180", productName: "James Hardie Linea Weatherboard 180mm" },
};
const book = { rooms: [{ id: "room-exterior", name: "Exterior", rows: [brickRow, claddingRow] }] };

// No takeoff door schedule: the workflow uses the default manual door id.
const next = patchEntryDoorDraft(book, "manual-entry-door:primary", { Step: "range", Door: { doorReference: "Entry Door" } });
const rows = next.rooms.flatMap((room) => room.rows);
const bricksAfter = rows.find((row) => row.id === "row-bricks");
const claddingAfter = rows.find((row) => row.id === "row-cladding");

assert.equal(bricksAfter.guidedRequirementKey, "bricks", "Bricks row must keep its requirement");
assert.equal(bricksAfter.guidedSelection.requirementKey, "bricks", "Bricks selection must not become an entry door");
assert.equal(bricksAfter.guidedSelection.entryDoorDrafts, undefined, "No entry door draft on the Bricks row");
assert.equal(claddingAfter.guidedSelection.requirementKey, "cladding", "Cladding row untouched");
const doorRows = rows.filter((row) => selectionRowOwner(row) === "entry-door");
assert.equal(doorRows.length, 1, "Exactly one entry-door row");
assert.equal(entryDoorDetails(next).length, 1, "Entry door details come only from the entry-door row");

// A row already corrupted by the old defect (label "Bricks", owned by entry-door) is not Bricks.
const corrupted = { item: "Bricks", guidedRequirementKey: "entry-door", guidedSelection: { requirementKey: "entry-door", productName: "Corinthian Sunburst SUN GL" } };
assert.equal(rowOwnedByOtherRequirement(corrupted, "bricks"), true);
assert.equal(rowOwnedByOtherRequirement(corrupted, "entry-door"), false);
assert.equal(rowOwnedByOtherRequirement({ item: "Bricks" }, "bricks"), false, "Unowned template rows still match by label");
assert.equal(rowOwnedByOtherRequirement({ guidedRequirementKey: "entry-doors" }, "entry-door", ["entry-doors"]), false, "Legacy alias owner allowed");

console.log("exterior selection row ownership: ok");
