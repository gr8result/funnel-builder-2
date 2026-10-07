// Internal Doors: door type first (Flush Panel always first), supplier as a filter, search in
// builders' words, filter -> priority -> sort -> paginate. No product is removed from the library.
//
// Usage: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-internal-door-types.mjs
import assert from "node:assert/strict";
import { getEffectiveProductCatalogue } from "../lib/product-library/catalogueService.js";
import { ALL_DOOR_TYPES, INTERNAL_DOOR_TYPES, classifyInternalDoor, internalDoorMeta, internalDoorSizes, queryInternalDoors } from "../lib/product-library/internalDoorTypes.js";

const doors = getEffectiveProductCatalogue({ organisationId: "", familyKey: "internal-doors" }).products.filter((product) => product.familyKey === "internal-doors");
assert.equal(doors.length, 586, "every internal door is still in the Product Library");

// --- explicit type priority: Flush Panel first, by configuration not by alphabet
assert.deepEqual(INTERNAL_DOOR_TYPES.map((type) => type.key), ["flush", "moulded", "routed", "glazed", "barn", "other"]);
assert.deepEqual(INTERNAL_DOOR_TYPES.map((type) => type.priority), [1, 2, 3, 4, 5, 6]);

// --- every door has exactly one type; nothing is hidden
const byType = {};
for (const door of doors) (byType[classifyInternalDoor(door)] ||= []).push(door);
assert.equal(Object.values(byType).reduce((sum, list) => sum + list.length, 0), 586);
assert.ok(byType.flush.length >= 7 && byType.flush.every((door) => /flush/i.test(door.range)), "Flush Panel = the library's flush ranges");
assert.ok(byType.moulded.every((door) => /moulded|impressions|madison/i.test(door.range)));
assert.ok(byType.barn.every((door) => /barn/i.test(door.range)));
assert.ok(byType.glazed.every((door) => !(door.attributes.glazingOptions || []).includes("None")));
assert.ok(byType.routed.length > 100 && byType.glazed.length > 50, "decorative and glazed doors remain available");

// --- default view: Flush Panel, standard, on page 1, before any other door
const first = queryInternalDoors(doors);
assert.equal(first.activeType, "flush");
assert.equal(first.page, 0);
assert.equal(first.total, byType.flush.length);
assert.ok(first.items.every((door) => classifyInternalDoor(door) === "flush"));
assert.ok(first.items.every((door) => internalDoorMeta(door).isStandard && internalDoorMeta(door).displayPriority === 1));
assert.match(first.items[0].productName, /Flush Interior PMDF/, "paint-grade flush first");
assert.equal(internalDoorMeta(first.items[0]).core, "hollow core", "hollow core before solid core and veneer");
assert.ok(/OAK/.test(first.items.at(-1).productName), "veneer flush doors after the primed ones");
assert.deepEqual(first.types.map((type) => type.key), ["flush", "moulded", "routed", "glazed", "barn", "other"].filter((key) => byType[key]?.length), "only types that exist, in priority order");
assert.equal(first.types[0].count, byType.flush.length);

// --- All doors: still type-priority ordered, so flush doors lead page 1 of the whole catalogue
const all = queryInternalDoors(doors, { type: ALL_DOOR_TYPES });
assert.equal(all.total, 586);
assert.equal(all.pages, 25);
assert.ok(all.items.slice(0, byType.flush.length).every((door) => classifyInternalDoor(door) === "flush"), "flush doors are the first products of page 1");
const priorities = Array.from({ length: all.pages }, (_, page) => queryInternalDoors(doors, { type: ALL_DOOR_TYPES, page }).items).flat().map((door) => internalDoorMeta(door).displayPriority);
assert.deepEqual(priorities, [...priorities].sort((a, b) => a - b), "the whole catalogue pages in type priority order");
assert.equal(priorities.length, 586, "pagination loses nothing");

// --- filter first, THEN paginate
const routed = queryInternalDoors(doors, { type: "routed" });
assert.equal(routed.items.length, 24);
assert.equal(routed.pages, Math.ceil(byType.routed.length / 24));
assert.ok(queryInternalDoors(doors, { type: "routed", page: routed.pages - 1 }).items.every((door) => classifyInternalDoor(door) === "routed"));

// --- supplier is a filter, never the first step
const hume = queryInternalDoors(doors, { type: "moulded", suppliers: ["Hume Doors"] });
assert.ok(hume.total > 0 && hume.items.every((door) => door.brand === "Hume Doors"));
const bothMoulded = queryInternalDoors(doors, { type: "moulded" });
assert.deepEqual([...new Set(Array.from({ length: bothMoulded.pages }, (_, page) => queryInternalDoors(doors, { type: "moulded", page }).items).flat().map((door) => door.brand))].sort(), ["Corinthian Doors", "Hume Doors"], "suppliers shown together within a type");
// A supplier with no flush doors: the type list says so rather than showing someone else's.
const humeFlush = queryInternalDoors(doors, { type: "flush", suppliers: ["Hume Doors"] });
assert.equal(humeFlush.types.some((type) => type.key === "flush"), false);
assert.notEqual(humeFlush.activeType, "flush");

// --- search in builders' words, across types and suppliers
for (const term of ["flush", "flush panel", "flush door", "internal flush", "Flush Doors"]) {
  const found = queryInternalDoors(doors, { type: ALL_DOOR_TYPES, search: term });
  assert.equal(found.total, byType.flush.length, `"${term}" finds the flush doors`);
  assert.ok(found.items.every((door) => classifyInternalDoor(door) === "flush"));
}
const hollow = queryInternalDoors(doors, { type: ALL_DOOR_TYPES, search: "hollow core" });
assert.ok(hollow.total > 20 && hollow.items.every((door) => internalDoorMeta(door).core === "hollow core"));
assert.ok(classifyInternalDoor(hollow.items[0]) === "flush", "hollow core flush doors lead the hollow core results");
const solid = queryInternalDoors(doors, { type: ALL_DOOR_TYPES, search: "solid core" });
assert.ok(solid.total > 20 && solid.items.every((door) => internalDoorMeta(door).core === "solid core"));
assert.equal(queryInternalDoors(doors, { type: "flush", search: "solid core" }).items.every((door) => classifyInternalDoor(door) === "flush"), true);
assert.ok(queryInternalDoors(doors, { search: "bayview" }).total > 0, "a search with no flush match still shows its results");
assert.equal(queryInternalDoors(doors, { search: "bayview" }).activeType, ALL_DOOR_TYPES);
assert.equal(queryInternalDoors(doors, { type: ALL_DOOR_TYPES, search: "zzzz" }).total, 0);

// --- size and price
const sizes = internalDoorSizes(byType.flush);
assert.ok(sizes.includes("2040 x 820 x 35 mm"));
assert.ok(queryInternalDoors(doors, { size: "2040 x 820 x 35 mm" }).items.every((door) => door.attributes.sizeOptions.includes("2040 x 820 x 35 mm")));
const cheapest = queryInternalDoors(doors, { sort: "price-asc" }).items;
assert.ok(cheapest.every((door) => classifyInternalDoor(door) === "flush"), "price sort stays inside the chosen type");

// --- reusable metadata wins over what is derived
const custom = { productName: "Builder Standard Door", brand: "Local Joinery", range: "House range", attributes: { doorType: "flush", sizeOptions: [] } };
assert.equal(classifyInternalDoor(custom), "flush");
const promoted = { productName: "Promoted Door", brand: "Local Joinery", range: "Bayview", isStandard: true, displayPriority: 1, attributes: {} };
assert.deepEqual([internalDoorMeta(promoted).isStandard, internalDoorMeta(promoted).displayPriority], [true, 1]);
assert.equal(queryInternalDoors([...doors, promoted], { type: ALL_DOOR_TYPES }).items.slice(0, byType.flush.length + 1).includes(promoted), true, "a door flagged standard with priority 1 is listed with the standard doors");
assert.equal(classifyInternalDoor({ productName: "Unknown Range Door", range: "New Range", attributes: {} }), "other", "an unlisted range is shown under Other, never hidden");
assert.equal(queryInternalDoors([], {}).total, 0);

console.log(JSON.stringify({ passed: true, total: doors.length, types: first.types.map((type) => `${type.priority}. ${type.label}: ${type.count}`), flushPage1: first.items.map((door) => `${door.brand} ${door.productName} (${internalDoorMeta(door).core})`) }, null, 2));
