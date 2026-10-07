// Tiles & Stone: copy / apply one room's tile scheme to other rooms.
// The scheme (products, wastage, pattern / grout / trim, tile height rules) is copied; dimensions,
// components, openings and quantities stay the destination's own. A copy is never a link.
//
// Usage: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-tiling-scheme-copy.mjs
import assert from "node:assert/strict";
import { calculateTilingRoom } from "../lib/builders/tilingCalculations.js";
import { applyTilingScheme, connectTilingSelectionsToQuotation, newTilingRoom, roomHasTileScheme, roomTileSlots, setTilingSchemeDefault, tilingProductTotals, tilingSchemeDefaultRoom, tilingSchemePreview, tilingSchemeTargets, tilingSelectionPatch } from "../lib/builders/tilingRooms.js";

const close = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 0.005, `${label}: ${actual} != ${expected}`);
const tile = (id, name, application) => ({ productId: id, productCode: `TIL-${id}`, productName: name, brand: "National Tiles", sku: id.toUpperCase(), clientPrice: 40, attributes: { boxCoverageM2: 1.44, tileLengthMm: 600, tileWidthMm: 300, tileApplications: [application] } });
const catalogue = new Map([tile("a", "Product A Floor", "floor"), tile("b", "Product B Wall", "wall"), tile("c", "Product C Feature", "wall"), tile("d", "Product D Feature", "wall"), tile("s", "Product S Splashback", "wall"), tile("old", "Old Floor", "floor")].map((p) => [p.productId, p]));
const productById = (id) => catalogue.get(id) || null;
const room = (type, name, extra) => ({ ...newTilingRoom({ type, name, id: `room-${name.toLowerCase().replace(/\s+/g, "-")}` }), ...extra });

// 1. Main Bathroom fully configured: 3100 x 4000 = 12.40 m2, shower, bath, vanity, feature wall.
const main = room("bathroom", "Main Bathroom", {
  spec: "standard", wastagePct: 12,
  geometry: { mode: "rectangle", widthMm: 3100, lengthMm: 4000, ceilingHeightMm: 2400 },
  components: { shower: { enabled: true, widthMm: 900, lengthMm: 1200, tiledWalls: 2, heightMm: 2100 }, bath: { enabled: true, lengthsMm: [1700], splashbackHeightMm: 900 }, vanity: { enabled: true, widthMm: 1200, splashback: "custom", customHeightMm: 300 }, feature: { enabled: true, walls: [{ widthMm: 1700, heightMm: 2400 }], replacesWallTiles: false } },
  products: { floor: "a", wall: "b", feature: "c", splashback: "s" },
  finish: { pattern: "Herringbone", grout: "Mapei 113 Cement Grey", trim: "Brushed nickel square edge" },
  openings: [{ type: "door", widthMm: 820, heightMm: 2040, quantity: 1 }],
});
// Ensuite: its own size (2000 x 3400 = 6.80 m2), a shower and vanity, NO bath and NO feature wall.
const ensuite = room("ensuite", "Ensuite", {
  geometry: { mode: "rectangle", widthMm: 2000, lengthMm: 3400, ceilingHeightMm: 2700 },
  components: { shower: { enabled: true, widthMm: 1000, lengthMm: 1000, tiledWalls: 3 }, vanity: { enabled: true, widthMm: 900 } },
  openings: [{ type: "door", widthMm: 720, heightMm: 2040, quantity: 1 }],
});
const powder = room("powder-room", "Powder Room", { spec: "standard", geometry: { mode: "rectangle", widthMm: 1000, lengthMm: 1800 }, components: { vanity: { enabled: true, widthMm: 600 } }, products: { floor: "old" }, finish: { grout: "White" } });
const laundry = room("laundry", "Laundry", { geometry: { mode: "rectangle", widthMm: 1800, lengthMm: 3000 }, splashback: { lengthMm: 1200, heightMm: 600 } });
const kitchen = room("kitchen", "Kitchen", { splashback: { lengthMm: 3000, heightMm: 600 } });
const alfresco = room("alfresco", "Alfresco", { geometry: { mode: "rectangle", widthMm: 4000, lengthMm: 5000 } });
let rooms = [kitchen, main, ensuite, powder, laundry, alfresco];

// --- room list: the project's own wet areas only; never the source, kitchens or external areas
const targets = tilingSchemeTargets(rooms, main.id);
assert.deepEqual(targets.map((item) => item.room.name), ["Ensuite", "Powder Room", "Laundry"]);
assert.deepEqual(targets.filter((item) => item.recommended).map((item) => item.room.name), ["Ensuite", "Powder Room"], "Select all relevant = the other bathroom-type rooms");
assert.deepEqual(targets.map((item) => item.hasExisting), [false, true, false]);
assert.deepEqual(tilingSchemeTargets([main, room("bathroom", "Bathroom 2", {})], main.id).map((item) => item.room.name), ["Bathroom 2"], "rooms come from the project, not a fixed list");

// --- 2-5. apply to the Ensuite: products copy, dimensions stay, quantities come from its own areas
const preview = tilingSchemePreview(main, ensuite);
assert.deepEqual(preview.products.map((item) => item.slot), ["floor", "wall", "splashback"]);
assert.deepEqual(preview.skipped.map((item) => item.slot), ["feature"], "no feature wall in the Ensuite, so no feature selection is created");
assert.equal(preview.hasExisting, false);
const appliedEnsuite = applyTilingScheme(main, ensuite, { now: "2026-10-02T00:00:00.000Z" });
assert.deepEqual(appliedEnsuite.geometry, ensuite.geometry, "room dimensions untouched");
assert.deepEqual(appliedEnsuite.openings, ensuite.openings);
assert.deepEqual([appliedEnsuite.components.shower.widthMm, appliedEnsuite.components.shower.lengthMm, appliedEnsuite.components.shower.tiledWalls, appliedEnsuite.components.vanity.widthMm], [1000, 1000, 3, 900], "shower and vanity dimensions untouched");
assert.equal(appliedEnsuite.components.bath, undefined, "no fake bath");
assert.equal(appliedEnsuite.components.feature, undefined, "no fake feature wall");
assert.deepEqual(appliedEnsuite.products, { floor: "a", wall: "b", splashback: "s" });
assert.equal(appliedEnsuite.products.feature, undefined);
assert.deepEqual(appliedEnsuite.finish, main.finish, "pattern, grout and trim copied");
assert.equal(appliedEnsuite.wastagePct, 12);
assert.equal(appliedEnsuite.spec, "standard", "tiling specification rule copied");
assert.equal(appliedEnsuite.components.shower.heightMm, 2100, "shower tile height rule copied");
assert.deepEqual([appliedEnsuite.components.vanity.splashback, appliedEnsuite.components.vanity.customHeightMm], ["custom", 300], "vanity splashback rule copied");
assert.deepEqual(appliedEnsuite.schemeCopy, { copiedFromRoomId: main.id, copiedFromRoomName: "Main Bathroom", copiedAt: "2026-10-02T00:00:00.000Z", mode: "replace", slots: ["floor", "wall", "splashback"], skipped: ["feature"] });
const mainResult = calculateTilingRoom(main, { productById });
const ensuiteResult = calculateTilingRoom(appliedEnsuite, { productById });
const floorOf = (result) => result.surfaces.find((item) => item.key === "floor");
close(floorOf(mainResult).areaM2, 12.4, "Main Bathroom floor");
close(floorOf(ensuiteResult).areaM2, 6.8, "Ensuite floor is still its own 6.80 m2");
assert.equal(floorOf(ensuiteResult).productId, "a", "Ensuite floor now uses Product A");
close(floorOf(ensuiteResult).order.orderAreaM2, 6.8 * 1.12, "Ensuite quantity from 6.80 m2 + its copied 12% wastage");
close(floorOf(mainResult).order.orderAreaM2, 12.4 * 1.12, "Main Bathroom quantity unchanged");
close(ensuiteResult.surfaces.find((item) => item.key === "shower-walls").areaM2, 3.0 * 2.1, "Ensuite shower: its own 3 walls (3000mm) at the copied 2100mm height");

// --- 6-7. a copy is not a link: changing either room leaves the other alone
rooms = rooms.map((item) => (item.id === ensuite.id ? appliedEnsuite : item));
const before = JSON.stringify(main);
const editedEnsuite = { ...appliedEnsuite, products: { ...appliedEnsuite.products, wall: "d" }, finish: { ...appliedEnsuite.finish, grout: "Charcoal" } };
assert.equal(JSON.stringify(main), before, "Main Bathroom unchanged by an Ensuite edit");
assert.equal(main.products.wall, "b");
assert.notEqual(appliedEnsuite.products, main.products, "the Ensuite holds its own selection records");
assert.notEqual(appliedEnsuite.finish, main.finish);
const editedMain = { ...main, products: { ...main.products, floor: "old" } };
assert.equal(editedEnsuite.products.floor, "a", "a later Main Bathroom change does not reach the Ensuite");
assert.equal(calculateTilingRoom(editedEnsuite, { productById }).surfaces.find((item) => item.key === "floor").productId, "a");
assert.equal(editedMain.products.floor, "old");

// --- 8-9. another room with existing selections: warn, then replace or only fill empty
const powderPreview = tilingSchemePreview(main, powder);
assert.equal(powderPreview.hasExisting, true);
assert.deepEqual(powderPreview.replaces, ["Floor tile", "Grout colour"], "what will be replaced is listed");
assert.deepEqual(powderPreview.skipped.map((item) => item.slot), ["feature"], "Powder Room has no feature wall");
assert.equal("showerHeightMm" in powderPreview.rules, false, "no shower rule for a room with no shower");
const replaced = applyTilingScheme(main, powder);
assert.deepEqual(replaced.products, { floor: "a", wall: "b", splashback: "s" });
assert.equal(replaced.finish.grout, "Mapei 113 Cement Grey");
assert.deepEqual(replaced.geometry, powder.geometry);
assert.equal(replaced.components.shower, undefined, "no fake shower");
const filledOnly = applyTilingScheme(main, powder, { mode: "fill-empty" });
assert.deepEqual(filledOnly.products, { floor: "old", wall: "b", splashback: "s" }, "existing floor tile kept, empty slots filled");
assert.equal(filledOnly.finish.grout, "White", "existing grout kept");
assert.equal(filledOnly.finish.pattern, "Herringbone", "empty pattern filled");
assert.equal(filledOnly.wastagePct, powder.wastagePct, "existing wastage kept when only filling");
assert.deepEqual(tilingSchemePreview(main, powder, { mode: "fill-empty" }).skipped.filter((item) => item.kept).map((item) => item.slot), ["floor"]);
// Laundry (no tiling specification, no wall slot): only what it actually has.
const laundryApplied = applyTilingScheme(main, laundry);
assert.deepEqual(roomTileSlots(laundry), ["floor", "splashback"]);
assert.deepEqual(laundryApplied.products, { floor: "a", splashback: "s" }, "wall and feature tiles are not put into a room without those surfaces");
assert.equal(laundryApplied.spec, "", "a bathroom tiling specification is not forced on a laundry");
assert.deepEqual(laundryApplied.splashback, laundry.splashback);

// --- default scheme: one room at a time, still a one-time copy
assert.equal(tilingSchemeDefaultRoom(rooms), null);
let withDefault = setTilingSchemeDefault(rooms, main.id);
assert.equal(tilingSchemeDefaultRoom(withDefault).id, main.id);
withDefault = setTilingSchemeDefault(withDefault, appliedEnsuite.id);
assert.deepEqual(withDefault.filter((item) => item.schemeDefault).map((item) => item.name), ["Ensuite"], "only one default");
assert.equal(roomHasTileScheme(laundry), false);
assert.equal(tilingSchemeDefaultRoom(setTilingSchemeDefault([laundry], laundry.id)), null, "a room with nothing chosen is not offered as a default");

// --- 10. downstream: same product, each room's own quantity, consolidated with the room breakdown
const finalRooms = [main, appliedEnsuite, replaced];
const totals = tilingProductTotals(finalRooms, { productById });
const productA = totals.find((entry) => entry.productId === "a");
assert.deepEqual(productA.rooms.map((item) => item.roomName), ["Main Bathroom", "Ensuite", "Powder Room"]);
close(productA.rooms[0].orderAreaM2, mainResult.surfaces.filter((item) => item.productId === "a").reduce((sum, item) => sum + item.order.orderAreaM2, 0), "Main Bathroom share");
close(productA.orderAreaM2, productA.rooms.reduce((sum, item) => sum + item.orderAreaM2, 0), "total = sum of the rooms");
assert.equal(productA.boxes, Math.ceil(productA.orderAreaM2 / 1.44 - 1e-9), "boxes from the consolidated area");
const requirement = { requirementKey: "tiling-rooms", label: "Tiling (room by room)", areaKey: "tiles-stone", areaLabel: "Tiles & Stone", defaultAllowance: 0 };
const patch = JSON.parse(JSON.stringify(tilingSelectionPatch(requirement, finalRooms, { productById })));
assert.equal(patch.guidedSelection.tilingProductTotals.find((entry) => entry.productId === "a").rooms.length, 3, "consolidated totals saved with the selection");
assert.equal(patch.guidedSelection.tilingRooms[1].schemeCopy.copiedFromRoomId, main.id, "audit metadata saved");
const workbook = connectTilingSelectionsToQuotation({ quotation: {}, procurement: { items: [] } }, { rooms: [{ rows: [{ id: "row", guidedRequirementKey: "tiling-rooms", ...patch }] }] }, { productById });
const floorQty = (section) => workbook.quotation[section].rows.find((row) => row.item.startsWith("Floor tiles")).quantity;
close(floorQty("TILING - MAIN BATHROOM"), 13.89, "Quotation: Main Bathroom floor 12.40 + 12%");
close(floorQty("TILING - ENSUITE"), 7.62, "Quotation: Ensuite floor 6.80 + 12%");
const procurementA = workbook.procurement.items.filter((item) => item.productId === "a" && /Floor tiles/.test(item.itemDescription));
assert.equal(procurementA.length, 3, "procurement keeps one floor line per room");
assert.ok(procurementA.every((item) => item.productTotalOrderAreaM2 === Math.round(productA.orderAreaM2 * 100) / 100 && item.productRooms.length === 3), "each line carries the product total and room breakdown");

console.log(JSON.stringify({ passed: true, productA: { rooms: productA.rooms.map((item) => `${item.roomName}: ${item.orderAreaM2.toFixed(2)} m²`), total: `${productA.orderAreaM2.toFixed(2)} m²`, boxes: productA.boxes }, ensuite: { floorArea: "6.80 m²", order: `${floorOf(ensuiteResult).order.orderAreaM2.toFixed(2)} m²`, skipped: preview.skipped.map((item) => item.label) } }, null, 2));
