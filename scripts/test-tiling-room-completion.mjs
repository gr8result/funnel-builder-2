// Tiles & Stone room completion: a room is judged only on the tiled surfaces that apply to it,
// "not tiled" / "not required" is a decision, and external areas (alfresco, patio, balcony, porch)
// come from the job's own Job Setup / Takeoff areas.
//
// Usage: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-tiling-room-completion.mjs
import assert from "node:assert/strict";
import { calculateTilingRoom, tilingRoomStatus } from "../lib/builders/tilingCalculations.js";
import { connectTilingSelectionsToQuotation, newTilingRoom, roomTypeForName, suggestedTilingRooms, takeoffExternalRoomsToAdd, tilingRoomFromTakeoff, tilingSelectionPatch } from "../lib/builders/tilingRooms.js";
import { tilingTakeoffData } from "../lib/builders/tilingTakeoff.js";
import { guidedRequirementByKey, statusForRequirement } from "../lib/builders/clientSelectionWorkflow.js";

const tile = (id, applications) => ({ productId: id, productCode: `TIL-${id}`, productName: `Tile ${id}`, brand: "National Tiles", sku: id.toUpperCase(), clientPrice: 40, attributes: { boxCoverageM2: 1.44, tileLengthMm: 600, tileWidthMm: 300, tileApplications: applications } });
const catalogue = new Map([tile("wall", ["wall"]), tile("floor", ["floor", "wall"]), tile("ext", ["floor", "external"])].map((p) => [p.productId, p]));
const productById = (id) => catalogue.get(id) || null;
const room = (type, name, extra) => ({ ...newTilingRoom({ type, name, id: `room-${name.toLowerCase().replace(/\s+/g, "-")}` }), ...extra });
const status = (value) => tilingRoomStatus(value, { productById });

// --- TEST 1: Kitchen with only a splashback
let kitchen = room("kitchen", "Kitchen");
assert.equal(status(kitchen).status, "not_started");
assert.deepEqual(calculateTilingRoom(kitchen).surfaces.map((item) => item.key), ["splashback"], "a kitchen is a splashback; no floor, wall or shower is asked for");
kitchen = { ...kitchen, splashback: { lengthMm: 3000, heightMm: 600 } };
assert.deepEqual(status(kitchen).missing, ["Splashback tile not selected"], "exactly what is missing");
assert.equal(status(kitchen).status, "incomplete");
kitchen = { ...kitchen, products: { splashback: "wall" } };
assert.deepEqual(status(kitchen), { status: "incomplete", ready: true, confirmed: false, missing: [], decisions: [{ label: "Floor tiles", state: "Not tiled" }] }, "ready, awaiting Confirm room");
kitchen = { ...kitchen, confirmed: true };
assert.equal(status(kitchen).status, "complete", "TEST 1: Kitchen = COMPLETE");

// --- TEST 2: Kitchen floor explicitly NOT TILED, and the tiled-floor alternative
assert.equal(status({ ...kitchen, floorTiled: false }).status, "complete", "TEST 2: floor not tiled + splashback = COMPLETE");
const tiledFloor = { ...kitchen, floorTiled: true };
assert.deepEqual(status(tiledFloor).missing, ["Room dimensions not entered"], "a floor the builder says IS tiled must then be measured");
assert.equal(status(tiledFloor).status, "incomplete", "confirmed earlier, but no longer complete");
const tiledFloorDone = { ...tiledFloor, geometry: { mode: "rectangle", widthMm: 3000, lengthMm: 4000 }, products: { splashback: "wall", floor: "floor" } };
assert.equal(status(tiledFloorDone).status, "complete");
assert.deepEqual(status(tiledFloorDone).decisions, []);

// --- TEST 3 / 4: Alfresco and Patio are a floor, nothing else
for (const [type, name, test] of [["alfresco", "Alfresco", "TEST 3"], ["patio", "Patio", "TEST 4"]]) {
  let area = room(type, name);
  assert.deepEqual(status(area).missing, ["Area not entered"]);
  area = { ...area, geometry: { ...area.geometry, widthMm: 4000, lengthMm: 6000 } };
  assert.deepEqual(status(area).missing, ["External floor tile not selected"]);
  area = { ...area, products: { floor: "ext" }, confirmed: true };
  assert.equal(status(area).status, "complete", `${test}: ${name} = COMPLETE`);
  assert.deepEqual(calculateTilingRoom(area, { productById }).surfaces.map((item) => [item.key, item.areaM2]), [["floor", 24]]);
}

// --- TEST 5: Balcony floor, upstand NOT REQUIRED
let balcony = room("balcony", "Balcony", { geometry: { mode: "rectangle", widthMm: 2000, lengthMm: 5000 }, products: { floor: "ext" }, confirmed: true });
// A balcony is a simple floor area: no upstand unless one is explicitly asked for.
assert.deepEqual(calculateTilingRoom(balcony, { productById }).surfaces.map((item) => item.key), ["floor"], "floor only by default");
assert.deepEqual(calculateTilingRoom({ ...balcony, skirting: true }, { productById }).surfaces.map((item) => item.key), ["floor", "skirting"], "an upstand only when asked for");
balcony = { ...balcony, skirting: false };
assert.deepEqual(status(balcony).decisions, []);
assert.equal(status(balcony).status, "complete", "TEST 5: Balcony = COMPLETE");

// --- Bathrooms: only what is in the room
const bathroom = room("bathroom", "Main Bathroom", { geometry: { mode: "rectangle", widthMm: 2800, lengthMm: 3600, ceilingHeightMm: 2400 } });
assert.deepEqual(status(bathroom).missing, ["Tiling specification not chosen"]);
const standard = { ...bathroom, spec: "standard", components: { shower: { enabled: true, widthMm: 900, lengthMm: 900 }, vanity: { enabled: true, widthMm: 900 } } };
assert.deepEqual(status(standard).missing, ["Floor tile not selected", "Shower wall tile not selected", "Wall or splashback tile not selected (sets the single-row vanity splashback)"]);
assert.equal(status({ ...standard, products: { floor: "floor", wall: "wall" }, confirmed: true }).status, "complete", "no bath or feature tile is demanded of a room without them");
assert.deepEqual(status({ ...standard, components: { ...standard.components, feature: { enabled: true, walls: [{}] } }, products: { floor: "floor", wall: "wall" } }).missing, ["Feature wall dimensions not entered"]);
assert.deepEqual(status({ ...standard, components: { shower: { enabled: true } }, products: { floor: "floor", wall: "wall" } }).missing, ["Shower dimensions not entered"]);

// --- External areas come from the job: Job Setup / Takeoff areas, never a fixed list
assert.equal(roomTypeForName("Front Porch"), "porch");
assert.equal(roomTypeForName("Rear Verandah"), "verandah");
const workbook = { data: { inputDataSheet: { rows: { lowerAlfrescoAreaM2: { value: 24.5 }, upperBalconyAreaM2: { value: 9.2 }, lowerPorchAreaM2: { value: 0 } } } } };
const takeoff = tilingTakeoffData(workbook);
const suggested = suggestedTilingRooms(["Kitchen", "Main Bathroom", "Bed 1"], takeoff);
assert.deepEqual(suggested.map((item) => `${item.name}:${item.type}`), ["Kitchen:kitchen", "Main Bathroom:bathroom", "Alfresco:alfresco", "Balcony:balcony"], "alfresco and balcony exist in this job; patio and porch do not");
const alfresco = suggested.find((item) => item.type === "alfresco");
assert.deepEqual([alfresco.geometry.mode, alfresco.geometry.floorAreaM2, alfresco.geometry.source], ["custom", 24.5, "takeoff"], "measured area pre-filled");
assert.equal(calculateTilingRoom(alfresco).surfaces[0].areaM2, 24.5);
assert.notEqual(suggested.find((item) => item.type === "balcony").id, alfresco.id, "the balcony is its own location, not merged into the alfresco");
assert.deepEqual(suggestedTilingRooms(["Kitchen"], tilingTakeoffData({})).map((item) => item.name), ["Kitchen"], "no external rooms for a job without any");
// A job whose rooms were saved earlier is offered the measured areas it does not have yet.
assert.deepEqual(takeoffExternalRoomsToAdd([alfresco], takeoff).map((item) => [item.name, item.areaM2]), [["Balcony", 9.2]]);
assert.equal(tilingRoomFromTakeoff({ type: "balcony", name: "Balcony", areaM2: 9.2 }).geometry.floorAreaM2, 9.2);
// A manual override stays on that room.
const overridden = { ...alfresco, geometry: { ...alfresco.geometry, floorAreaM2: 26, source: "manual" } };
assert.equal(calculateTilingRoom(overridden).surfaces[0].areaM2, 26);

// --- Category status and counters: rooms that are complete / total, nothing else
const requirement = guidedRequirementByKey("tiling-rooms");
const rooms = [kitchen, { ...alfresco, products: { floor: "ext" }, confirmed: true }, room("patio", "Patio"), balcony, standard];
const patch = JSON.parse(JSON.stringify(tilingSelectionPatch(requirement, rooms, { productById })));
assert.equal(patch.guidedSelection.tilingCompleteRooms, 3);
assert.deepEqual(patch.guidedSelection.tilingRoomStatuses.map((item) => `${item.roomName}: ${item.status}`), ["Kitchen: complete", "Alfresco: complete", "Patio: not_started", "Balcony: complete", "Main Bathroom: incomplete"]);
assert.match(patch.selectedProduct, /^3 of 5 tiled rooms complete/);
assert.equal(statusForRequirement(requirement, { selection_status: "selected", selected_details: patch.guidedSelection }), "incomplete");
const allDone = JSON.parse(JSON.stringify(tilingSelectionPatch(requirement, [kitchen, balcony], { productById })));
assert.equal(statusForRequirement(requirement, { selection_status: "selected", selected_details: allDone.guidedSelection }), "complete", "every room complete = Tiles & Stone complete");
assert.equal(statusForRequirement(requirement, { selection_status: "selected", selected_details: JSON.parse(JSON.stringify(tilingSelectionPatch(requirement, [room("patio", "Patio")], { productById }))).guidedSelection }), "not_started");

// --- Downstream: room / location breakdown, correct products and quantities
const book = { rooms: [{ rows: [{ id: "row", guidedRequirementKey: "tiling-rooms", ...patch }] }] };
const quoted = connectTilingSelectionsToQuotation({ quotation: {}, procurement: { items: [] } }, book, { productById });
assert.deepEqual(Object.keys(quoted.quotation).sort(), ["TILING - ALFRESCO", "TILING - BALCONY", "TILING - KITCHEN", "TILING - MAIN BATHROOM"], "a section per tiled location; the untouched Patio adds nothing");
assert.equal(quoted.quotation["TILING - ALFRESCO"].rows.find((row) => row.item.startsWith("External floor tiles")).quantity, 26.95, "alfresco 24.50 m² + 10%");
assert.equal(quoted.quotation["TILING - KITCHEN"].rows.find((row) => row.item.startsWith("Splashback")).quantity, 1.98);
assert.equal(quoted.quotation["TILING - KITCHEN"].rows.some((row) => /Floor tiles/.test(row.item)), false, "no floor line for a kitchen whose floor is not tiled");
assert.equal(quoted.quotation["TILING - BALCONY"].rows.some((row) => /Skirting/.test(row.item)), false, "no upstand line when it is not required");
const external = quoted.procurement.items.filter((item) => item.productId === "ext");
assert.deepEqual(external.map((item) => item.location).sort(), ["Alfresco", "Balcony"], "procurement: the external tile, by location");

console.log(JSON.stringify({ passed: true, statuses: patch.guidedSelection.tilingRoomStatuses.map((item) => `${item.roomName}: ${item.status}${item.missing.length ? ` (${item.missing.join("; ")})` : ""}`) }, null, 2));
