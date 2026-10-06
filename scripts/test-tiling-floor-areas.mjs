// Tiles & Stone - Additional Floor Tiling: simple floor-only areas (alfresco, patio, balcony, entry,
// hallway ...) are an area in m2 + a floor tile + wastage. No bathroom workflow, no walls, no upstand.
//
// Usage: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-tiling-floor-areas.mjs
import assert from "node:assert/strict";
import { calculateTilingRoom, isFloorAreaRoom, roomIsExternal, tilingRoomStatus } from "../lib/builders/tilingCalculations.js";
import { applyFloorTile, connectTilingSelectionsToQuotation, floorAreaTypeForName, newFloorArea, newTilingRoom, renameFloorArea, suggestedTilingRooms, tilingProductTotals, tilingSchemeTargets, tilingSelectionPatch } from "../lib/builders/tilingRooms.js";
import { tilingTakeoffData } from "../lib/builders/tilingTakeoff.js";
import { guidedRequirementByKey } from "../lib/builders/clientSelectionWorkflow.js";

const close = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 0.005, `${label}: ${actual} != ${expected}`);
const tile = (id, applications) => ({ productId: id, productCode: `TIL-${id}`, productName: `Tile ${id}`, brand: "National Tiles", sku: id.toUpperCase(), clientPrice: 50, attributes: { boxCoverageM2: 1.44, tileApplications: applications } });
const catalogue = new Map([tile("a", ["floor", "external"]), tile("b", ["floor", "wall"])].map((p) => [p.productId, p]));
const productById = (id) => catalogue.get(id) || null;
const status = (room) => tilingRoomStatus(room, { productById });
const floor = (room) => calculateTilingRoom(room, { productById }).surfaces.find((item) => item.key === "floor");

// --- which locations are simple floor areas, and which keep the full room workflow
const kinds = Object.fromEntries(["alfresco", "patio", "balcony", "porch", "terrace", "verandah", "entry", "hallway", "other", "bathroom", "ensuite", "powder-room", "laundry", "kitchen", "butlers-pantry"].map((type) => [type, isFloorAreaRoom({ type })]));
assert.deepEqual(Object.keys(kinds).filter((type) => kinds[type]), ["alfresco", "patio", "balcony", "porch", "terrace", "verandah", "entry", "hallway", "other"]);
assert.deepEqual(Object.keys(kinds).filter((type) => !kinds[type]), ["bathroom", "ensuite", "powder-room", "laundry", "kitchen", "butlers-pantry"], "rooms with walls / splashbacks keep the room workflow");

// --- 1. project areas are imported as rows; a job without them gets none
const takeoff = tilingTakeoffData({ data: { inputDataSheet: { rows: { lowerAlfrescoAreaM2: { value: 15.3 }, lowerPatioAreaM2: { value: 22 } } } } });
let rooms = suggestedTilingRooms(["Kitchen", "Main Bathroom", "Entry"], takeoff);
assert.deepEqual(rooms.filter(isFloorAreaRoom).map((room) => `${room.name} ${room.geometry.floorAreaM2}`), ["Entry ", "Alfresco 15.3", "Patio 22"]);
assert.deepEqual(rooms.filter((room) => !isFloorAreaRoom(room)).map((room) => room.name), ["Kitchen", "Main Bathroom"]);
let alfresco = rooms.find((room) => room.name === "Alfresco");
assert.equal(alfresco.geometry.source, "takeoff");
// Nothing but a floor is ever calculated or asked for.
assert.deepEqual(calculateTilingRoom(alfresco).surfaces.map((item) => item.key), ["floor"]);
assert.deepEqual(status(alfresco).missing, ["External floor tile not selected"], "the only thing an imported area needs is its tile");

// --- 2-4. tile, wastage, required quantity, confirm
alfresco = { ...alfresco, products: { floor: "a" } };
close(floor(alfresco).order.orderAreaM2, 16.83, "Alfresco 15.30 m² + 10% = 16.83 m²");
assert.equal(floor(alfresco).order.boxes, 12);
assert.equal(status(alfresco).status, "incomplete", "chosen but not confirmed");
alfresco = { ...alfresco, confirmed: true };
assert.equal(status(alfresco).status, "complete");

// --- 5-7. a manual row: name + area in m², no dimensions required
rooms = rooms.map((room) => (room.id === alfresco.id ? alfresco : room));
let balcony = newFloorArea(rooms, { name: "Balcony", areaM2: 8.4 });
assert.deepEqual([balcony.type, balcony.geometry.mode, balcony.geometry.floorAreaM2, roomIsExternal(balcony)], ["balcony", "custom", 8.4, true]);
assert.deepEqual(calculateTilingRoom(balcony).surfaces.map((item) => item.key), ["floor"], "no upstand, walls or wastes on a balcony row");
const unnamed = newFloorArea([...rooms, balcony]);
assert.equal(unnamed.name, "Floor area 5");
assert.deepEqual(status(unnamed).missing, ["Area not entered"]);
assert.equal(roomIsExternal(unnamed), false, "an unnamed area is internal until told otherwise");
assert.deepEqual([renameFloorArea(unnamed, "Rear Terrace").type, renameFloorArea(unnamed, "Mudroom").type, renameFloorArea(unnamed, "Hallway").type], ["terrace", "other", "hallway"]);
assert.equal(floorAreaTypeForName("Ensuite"), "other", "a floor row named after a wet room is still only a floor");
assert.equal(roomIsExternal({ ...renameFloorArea(unnamed, "Store room"), external: true }), true, "External is the builder's choice");
// Optional: calculate from dimensions in mm.
close(floor({ ...unnamed, geometry: { ...unnamed.geometry, mode: "rectangle", widthMm: 3400, lengthMm: 4500 } }).areaM2, 15.3, "3400 x 4500 mm = 15.30 m²");

// --- 8-9. apply the Alfresco tile to the Balcony: product + wastage copied, area kept
alfresco = { ...alfresco, wastagePct: 12 };
const balconyTiled = applyFloorTile(alfresco, balcony, { now: "2026-10-03T00:00:00.000Z" });
assert.equal(balconyTiled.products.floor, "a");
assert.equal(balconyTiled.wastagePct, 12);
assert.deepEqual(balconyTiled.geometry, balcony.geometry, "the Balcony keeps its own area");
close(floor(balconyTiled).areaM2, 8.4, "Balcony area");
close(floor(balconyTiled).order.orderAreaM2, 8.4 * 1.12, "Balcony quantity from its own area");
assert.notEqual(balconyTiled.confirmed, true, "an applied tile still has to be confirmed on that row");
const changed = { ...balconyTiled, products: { floor: "b" } };
assert.equal(alfresco.products.floor, "a", "changing the Balcony does not change the Alfresco");
assert.equal(changed.products.floor, "b");
// Floor areas are never offered a bathroom tile scheme.
assert.deepEqual(tilingSchemeTargets([newTilingRoom({ type: "bathroom", name: "Main Bathroom", id: "m" }), alfresco, balconyTiled], "m"), []);

// --- 10. downstream: one section per location, consolidated product total with the breakdown
alfresco = { ...alfresco, wastagePct: 10 };
const balconyDone = { ...applyFloorTile(alfresco, balcony), confirmed: true };
const patio = { ...rooms.find((room) => room.name === "Patio") };
const finalRooms = [alfresco, balconyDone, patio];
const totals = tilingProductTotals(finalRooms, { productById });
assert.equal(totals.length, 1);
assert.deepEqual(totals[0].rooms.map((item) => [item.roomName, Math.round(item.orderAreaM2 * 100) / 100]), [["Alfresco", 16.83], ["Balcony", 9.24]]);
close(totals[0].orderAreaM2, 26.07, "Tile A total 26.07 m²");
const requirement = guidedRequirementByKey("tiling-rooms");
const patch = JSON.parse(JSON.stringify(tilingSelectionPatch(requirement, finalRooms, { productById })));
assert.deepEqual([patch.guidedSelection.tilingFloorAreas, patch.guidedSelection.tilingCompleteFloorAreas], [3, 2], "2 of 3 areas complete");
const workbook = connectTilingSelectionsToQuotation({ quotation: {}, procurement: { items: [] } }, { rooms: [{ rows: [{ id: "row", guidedRequirementKey: "tiling-rooms", ...patch }] }] }, { productById });
assert.deepEqual(Object.fromEntries(Object.entries(workbook.quotation).map(([name, section]) => [name, section.rows.map((row) => `${row.item.split(" - ")[0]} ${row.qty} ${row.unit}`)])), {
  "TILING - ALFRESCO": ["External floor tiles 16.83 M2", "Labour 15.3 M2"],
  "TILING - BALCONY": ["External floor tiles 9.24 M2", "Labour 8.4 M2"],
  "TILING - PATIO": ["External floor tiles 24.2 M2", "Labour 22 M2"],
}, "only floor tile + floor labour lines, per location");
const orders = workbook.procurement.items;
assert.deepEqual(orders.map((item) => `${item.location} ${item.qty} ${item.unit} total ${item.productTotalOrderAreaM2}`), ["Alfresco 12 BOX total 26.07", "Balcony 7 BOX total 26.07"]);

// --- migration: an existing balcony "room" with the old implied upstand is now just a floor
const oldBalconyRoom = { id: "tiling-room-balcony", name: "Balcony", type: "balcony", wastagePct: 10, products: { floor: "a" }, geometry: { mode: "rectangle", widthM: 2, lengthM: 4.2 }, components: {}, openings: [], floorWastes: [], confirmed: true };
assert.equal(isFloorAreaRoom(oldBalconyRoom), true, "shown as an Additional Floor Tiling row, not a second copy");
assert.deepEqual(calculateTilingRoom(oldBalconyRoom, { productById }).surfaces.map((item) => [item.key, Math.round(item.areaM2 * 100) / 100]), [["floor", 8.4]]);
assert.equal(status(oldBalconyRoom).status, "complete");

console.log(JSON.stringify({ passed: true, tileA: { rooms: totals[0].rooms.map((item) => `${item.roomName}: ${item.orderAreaM2.toFixed(2)} m²`), total: `${totals[0].orderAreaM2.toFixed(2)} m²` } }, null, 2));
