// Room setup review, safe merging and the "requires your attention" list.
// Run: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-client-selections-room-review.mjs
import assert from "node:assert/strict";
import { confirmProjectRooms, keepRoomsSeparate, possibleDuplicateRooms, projectRoomModel, projectRoomsConfirmed, roomRecordKeys, unlistedSelectionLocations } from "../lib/builders/projectRoomModel.js";
import { plumbingLocationKey } from "../lib/builders/plumbingFixtureAllocation.js";
import { overlappingAssignments, selectionAttention } from "../lib/builders/selectionAttention.js";
import { buildSelectionsSchedule } from "../lib/builders/selectionsScheduleDocument.js";

const results = {};
const check = (name, run) => { try { run(); results[name] = "PASS"; } catch (error) { results[name] = "FAIL"; console.error(`FAIL ${name}:`, String(error.message).slice(0, 900)); } };
const room = (name, source = "takeoff") => ({ id: `room-${plumbingLocationKey(name)}`, key: plumbingLocationKey(name), name, source });
const names = (pairs) => pairs.map((pair) => pair.rooms.map((item) => item.name).join(" / "));
let id = 0;
const line = (productName, allocations) => ({ lineId: `line-${productName}`, productId: `id-${productName}`, productName, unit: "EACH", unitPrice: 10, unitAllowance: 10, quantity: allocations.reduce((total, item) => total + item.quantity, 0),
  allocations: allocations.map((item) => ({ location: item.location, locationKey: plumbingLocationKey(item.location), quantity: item.quantity })) });
const guided = (requirementKey, requirementLabel, lines, extra = {}) => ({ id: `row-${++id}`, guidedRequirementKey: requirementKey, guidedSelection: { requirementKey, requirementLabel, productName: lines[0]?.productName || extra.productName || "", selectionStatus: "selected", plumbingAllocation: { lines }, ...extra } });
const allocationsOf = (book, key) => book.rooms[0].rows.find((row) => row.guidedRequirementKey === key).guidedSelection.plumbingAllocation.lines.map((item) => [item.productName, item.quantity, item.allocations.map((a) => `${a.location}×${a.quantity}`).join(", ")]);

const rooms = [room("Kitchen", "selections-book"), room("Pantry"), room("Butler's Pantry", "cabinetry"), room("Main Bathroom", "selections-book"), room("Bathroom"), room("Ensuite", "selections-book"), room("Main Ensuite"), room("B2 Ensuite"), room("Bedroom 2", "selections-book"),
  room("Powder Room", "selections-book"), room("WC"), room("Media"), room("Media Room"), room("Alfresco"), room("Balcony"), room("Bedroom 3", "selections-book")];
const empty = projectRoomModel(null, null);

check("POSSIBLE DUPLICATE ROOMS ARE FLAGGED, NEVER MERGED", () => {
  const flagged = names(possibleDuplicateRooms(rooms, empty));
  for (const pair of ["Pantry / Butler's Pantry", "Main Bathroom / Bathroom", "Ensuite / Main Ensuite", "Powder Room / WC", "Media / Media Room"]) assert(flagged.includes(pair), `${pair} is offered for review: ${flagged.join("; ")}`);
  // A bedroom and its ensuite, or two numbered bedrooms, are different rooms.
  assert(!flagged.some((pair) => /Bedroom 2/.test(pair)), flagged.join("; "));
  assert(!flagged.includes("Bedroom 2 / Bedroom 3"));
  // Nothing was merged: the list is untouched and the model has no entries.
  assert.equal(rooms.length, 16); assert.equal(empty.rooms.length, 0);
});
check("SEPARATE ROOMS STAY SEPARATE ONCE CONFIRMED", () => {
  const { model } = keepRoomsSeparate(empty, rooms[3], rooms[4], "2026-10-09T00:00:00.000Z");
  const flagged = names(possibleDuplicateRooms(rooms, model));
  assert(!flagged.includes("Main Bathroom / Bathroom")); assert(flagged.includes("Pantry / Butler's Pantry"));
  assert.deepEqual(model.history.at(-1), { action: "keep-separate", rooms: ["Main Bathroom", "Bathroom"], at: "2026-10-09T00:00:00.000Z" });
  // The decision survives the model being read back from the job.
  assert.deepEqual(projectRoomModel({ projectRoomModel: JSON.parse(JSON.stringify(model)) }).separate, [[rooms[3].id, rooms[4].id]]);
});

const projectRooms = [room("Main Bathroom", "selections-book"), room("Ensuite", "selections-book"), room("Powder Room", "selections-book"), room("B2 Ensuite"), room("Alfresco"), room("Balcony"), room("Bedroom 1", "selections-book"), room("Bedroom 2", "selections-book")];
const book = { rooms: [{ name: "Selections", rows: [
  guided("towel-rail", "Towel Rails", [line("Linfa Towel Rail", [{ location: "Main Bathroom", quantity: 1 }, { location: "Ensuite", quantity: 1 }, { location: "2nd BEDROOM ENSUITE", quantity: 1 }, { location: "B2 Ensuite", quantity: 1 }])]),
  guided("bathroom-basin", "Bathroom Basin", [line("Riviere Basin", [{ location: "Main Bathroom", quantity: 1 }, { location: "Ensuite", quantity: 2 }, { location: "Bed 2 Ensuite", quantity: 1 }])]),
  guided("bath-mixer", "Bath & Shower Mixer", [line("O.Novo Mixer", [{ location: "Ensuite Shower", quantity: 1 }, { location: "2nd Bedroom Ensuite Shower", quantity: 1 }])]),
  guided("toilet-suite", "Toilet Suite", [line("ICON Toilet", [{ location: "Main Bathroom", quantity: 1 }, { location: "B2 Ensuite", quantity: 1 }]), line("Origin Toilet", [{ location: "Main Bathroom", quantity: 1 }, { location: "2nd BEDROOM ENSUITE", quantity: 1 }])]),
  guided("ceiling-fan", "Ceiling Fans", [line("AeroFlow Fan", [{ location: "DOWNSTAIRS", quantity: 2 }, { location: "UPSTAIRS", quantity: 5 }]), line("Spyda Fan", [{ location: "ALFRESCO", quantity: 1 }]), line("Stanza Fan", [{ location: "Bedroom 1", quantity: 1 }, { location: "Bedroom 2", quantity: 1 }, { location: "Alfresco", quantity: 1 }])]),
  guided("bath", "Bath", [line("Chios Bath", [{ location: "Unallocated", quantity: 1 }])], { priceStatus: "Quote Required" }),
  guided("hot-water-system", "Hot Water System", [line("Infinity 32", [{ location: "outside", quantity: 1 }])]),
  { id: "row-paint", guidedRequirementKey: "interior-paint", guidedSelection: { requirementKey: "interior-paint", requirementLabel: "Internal Paint Colours", productName: "Internal paint colours", selectionStatus: "pending", paintScheme: {} } },
  { id: "row-robes", guidedRequirementKey: "robes", guidedSelection: { requirementKey: "robes", requirementLabel: "Wardrobe Systems", productName: "", selectionStatus: "" } },
] }] };

check("NUMBERED ENSUITE ALIASES RESOLVE TO THE EXISTING PROJECT ROOM", () => {
  const unlisted = unlistedSelectionLocations(book, projectRooms, empty);
  assert.deepEqual(unlisted.map((item) => [item.name, item.suggestion?.name || ""]), [["DOWNSTAIRS", ""], ["UPSTAIRS", ""], ["outside", ""]]);
  assert.equal(roomRecordKeys(book).has(plumbingLocationKey("B2 Ensuite")), true);
  assert.equal(plumbingLocationKey("2nd BEDROOM ENSUITE"), plumbingLocationKey("B2 Ensuite"));
  // Fixture positions in the aliased ensuite stay attached to that same project room.
  assert(!unlisted.some((item) => /shower/i.test(item.name)));
});
check("SAME ROOM ALIASES ARE NOT OFFERED AS A MANUAL MERGE", () => {
  assert.equal(projectRooms[3].key, plumbingLocationKey("2nd BEDROOM ENSUITE"));
  assert(!unlistedSelectionLocations(book, projectRooms, empty).some((item) => /2nd BEDROOM ENSUITE|Bed 2 Ensuite/i.test(item.name)));
  const aliasRows = book.rooms[0].rows.filter((row) => ["towel-rail", "bathroom-basin", "toilet-suite"].includes(row.guidedRequirementKey));
  assert.equal(aliasRows.length, 3, "all chosen products remain in the book");
  assert.equal(allocationsOf(book, "towel-rail")[0][1], 4, "ordinary fixture allocations retain their quantities until pack-aware normalization");
});
check("OVERLAPPING ASSIGNMENTS ARE REPORTED, NOT DELETED", () => {
  const overlaps = overlappingAssignments(book, projectRooms);
  assert.deepEqual(overlaps.filter((item) => item.kind === "two-products").map((item) => [item.requirementLabel, item.location, item.products.map((product) => product.name)]),
    [["Toilet Suite", "Main Bathroom", ["ICON Toilet", "Origin Toilet"]], ["Toilet Suite", "B2 Ensuite", ["ICON Toilet", "Origin Toilet"]], ["Ceiling Fans", "ALFRESCO", ["Spyda Fan", "Stanza Fan"]]]);
  const [grouped] = overlaps.filter((item) => item.kind === "grouped-and-by-room");
  assert.deepEqual([grouped.requirementLabel, grouped.grouped, grouped.byRoomQuantity, grouped.total], ["Ceiling Fans", [{ location: "DOWNSTAIRS", quantity: 2 }, { location: "UPSTAIRS", quantity: 5 }], 4, 11]);
});
check("ATTENTION ITEMS SAY WHAT, WHERE, WHAT TO DO AND WHETHER IT BLOCKS", () => {
  const schedule = buildSelectionsSchedule(book);
  const attention = selectionAttention({ book, rooms: projectRooms, model: empty, schedule, preflight: { checks: [{ label: "Builder logo loaded", ok: false }, { label: "Client loaded", ok: true }] } });
  const group = (key) => attention.groups.find((item) => item.key === key)?.items || [];
  assert(attention.groups.every((item) => item.items.length > 0)); assert(attention.groups.length >= 5);
  for (const item of attention.groups.flatMap((entry) => entry.items)) { assert(item.title && item.detail && item.action?.label && ["rooms", "selection", "project"].includes(item.action.kind), JSON.stringify(item)); assert.equal(typeof item.blocking, "boolean"); }
  assert.deepEqual(group("decisions").map((item) => [item.title, item.action.label]), [["Internal Paint Colours", "REVIEW SELECTION"], ["Wardrobe Systems", "CHOOSE SELECTION"]]);
  assert(group("duplicates").some((item) => item.title === "Toilet Suite — B2 Ensuite" && item.action.label === "RESOLVE DUPLICATE" && item.action.kind === "selection"));
  assert(group("duplicates").some((item) => item.title === "Ceiling Fans — ALFRESCO" && /Spyda Fan × 1 and Stanza Fan × 1/.test(item.detail) && item.action.rowId));
  assert(group("duplicates").some((item) => /DOWNSTAIRS × 2, UPSTAIRS × 5/.test(item.title) && /11 in total/.test(item.detail)));
  assert.deepEqual(group("specifications").map((item) => [item.title, item.action.label]), [["Hot Water System — outside", "CHOOSE ROOM"], ["Bath — Chios Bath", "CHOOSE ROOM"]]);
  assert.deepEqual(group("pricing").map((item) => [item.title, item.blocking]), [["Bath — Chios Bath", false]]);
  assert.deepEqual(group("project").map((item) => [item.title, item.action.label, item.blocking]), [["Project rooms", "CONFIRM ROOMS", false], ["Project Details — Builder logo", "UPLOAD LOGO", true]]);
  // Completion counts client decisions only; a price or image never makes a chosen product incomplete.
  assert.deepEqual(attention.completion, { outstandingDecisions: 2, complete: false });
  assert(attention.readiness.blockingItems > attention.completion.outstandingDecisions && attention.readiness.ready === false);
  assert(!group("decisions").some((item) => /Bath|Hot Water/.test(item.title)));
  // A clean job needs nothing.
  const clean = selectionAttention({ book: { rooms: [{ rows: [guided("hot-water-system", "Hot Water System", [line("Infinity 32", [{ location: "Bedroom 1", quantity: 1 }])], { imageReference: "/images/hws.jpg" })] }] }, rooms: projectRooms, model: confirmProjectRooms(empty, projectRooms).model, schedule: null, preflight: { checks: [] } });
  assert.deepEqual([clean.total, clean.completion.complete, clean.readiness.ready], [0, true, true]);
});
check("ROOM SETUP CONFIRMATION", () => {
  assert.equal(projectRoomsConfirmed(empty), false);
  const { model } = confirmProjectRooms(empty, projectRooms, "2026-10-09T00:00:00.000Z");
  assert.equal(projectRoomsConfirmed(model), true); assert.equal(model.confirmedRoomCount, 8);
  // Reopening Room Setup does not re-add an alias as a new room.
  const later = keepRoomsSeparate(model, projectRooms[0], projectRooms[1]).model;
  assert.equal(projectRoomsConfirmed(later), true); assert.equal(later.separate.length, 1); assert.deepEqual(later.history.map((entry) => entry.action), ["confirm-rooms", "keep-separate"]);
});
check("SCHEDULE: TAKEOFF WALL CONSTRUCTION AND LOCATIONS", () => {
  const schedule = buildSelectionsSchedule(book, { exteriorWalls: [{ itemId: "ext_lower_Rendered Brick Veneer_1", category: "Rendered Brick Veneer", floor: "Ground Floor", quantity: 63 }, { itemId: "ext_lower_Rendered Brick Veneer_2", category: "Rendered Brick Veneer", floor: "Ground Floor", quantity: 4 },
    { itemId: "ext_upper_Lightweight Cladding_3", category: "Lightweight Cladding", floor: "Second Level", quantity: 20 }, { itemId: "ext_total_Ground_Floor_Rendered_Brick_Veneer", category: "Rendered Brick Veneer", floor: "Ground Floor", quantity: 67 }] });
  const walls = schedule.rows.filter((row) => /^External Walls/.test(row.item));
  assert.deepEqual(walls.map((row) => [row.section, row.group, row.item, row.product, row.status]), [["exterior", "exterior-envelope", "External Walls - Ground Floor", "Rendered Brick Veneer", "Included"], ["exterior", "exterior-envelope", "External Walls - Second Level", "Lightweight Cladding", "Included"]]);
  assert.equal(schedule.reconciliation.ok, true);
  // Alias spellings occupy one displayed room identity and keep the total quantity visible.
  assert.equal(buildSelectionsSchedule(book).rows.find((row) => row.item === "Towel Rails").qtyLocation, "Qty 4 - Main Bathroom, Ensuite, 2nd Bedroom Ensuite ×2");
});

for (const [name, result] of Object.entries(results)) console.log(`${name}: ${result}`);
if (Object.values(results).includes("FAIL")) process.exit(1);
