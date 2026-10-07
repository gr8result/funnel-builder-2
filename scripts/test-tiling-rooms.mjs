// Tiles & Stone room-by-room tiling: calculations, saved selection, quotation/procurement output and
// migration of earlier selections.
//
// Usage: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-tiling-rooms.mjs
import assert from "node:assert/strict";
import { calculateTilingRoom, roomGeometry, tileOrder, tilingRoomInMm } from "../lib/builders/tilingCalculations.js";
import { addTilingRoom, connectTilingSelectionsToQuotation, migrateLegacyTiling, newTilingRoom, suggestedTilingRooms, tilingSelectionPatch } from "../lib/builders/tilingRooms.js";
import { plumbingSelectionPatch } from "../lib/builders/plumbingSelectionPatch.js";
import { plumbingLineWithTotals } from "../lib/builders/plumbingFixtureAllocation.js";

const close = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 0.005, `${label}: ${actual} != ${expected}`);
const floorTile = { productId: "t-floor", productCode: "TIL-NT-FLOOR", productName: "Floor Tile", brand: "National Tiles", sku: "FLOOR", clientPrice: 39.95, attributes: { boxCoverageM2: 1.44, tileLengthMm: 600, tileWidthMm: 600, tileApplications: ["floor"] } };
const wallTile = { productId: "t-wall", productCode: "TIL-NT-BELWP100", productName: "Rectified White Gloss Tile", brand: "National Tiles", sku: "BELWP100", clientPrice: 18.95, attributes: { boxCoverageM2: 1.44, tileLengthMm: 600, tileWidthMm: 300, tileApplications: ["wall"] } };
const catalogue = new Map([floorTile, wallTile].map((p) => [p.productId, p]));
const productById = (id) => catalogue.get(id) || null;

// Bathroom - Standard tiling, 2800 x 3600 x 2400mm, 900x900 shower (2 walls), 1700 bath, vanity.
// Every linear dimension is millimetres; areas are m2.
const bathroom = {
  ...newTilingRoom({ type: "bathroom", name: "Bathroom", id: "room-bathroom" }),
  spec: "standard",
  geometry: { mode: "rectangle", widthMm: 2800, lengthMm: 3600, ceilingHeightMm: 2400 },
  components: { shower: { enabled: true, widthMm: 900, lengthMm: 900, tiledWalls: 2 }, bath: { enabled: true, lengthsMm: [1700] }, vanity: { enabled: true, widthMm: 900, splashback: "single-row" } },
  openings: [{ type: "door", widthMm: 820, heightMm: 2040, quantity: 1 }],
  floorWastes: [
    { productId: "fw-insert", productName: "Tile Insert Floor Waste", application: "Floor", quantity: 1, unitPrice: 89, linear: false },
    { productId: "fw-linear", productName: "900mm Tile Insert Channel Waste", application: "Shower", quantity: 1, unitPrice: 229, linear: true },
  ],
};
const geo = roomGeometry(bathroom.geometry);
close(geo.floorAreaM2, 10.08, "floor area");
close(geo.perimeterLm, 12.8, "perimeter");
let result = calculateTilingRoom(bathroom, { productById });
const area = (key) => result.surfaces.find((s) => s.key === key)?.areaM2;
close(area("shower-walls"), 3.6, "shower walls at 2m");
close(area("bath-splashback"), 1.02, "bath splashback");
assert.equal(area("vanity-splashback"), null, "single row stays pending until a tile is chosen");
close(area("skirting"), (12.8 - 1.8 - 1.7 - 0.82) * 0.25, "skirting excludes shower, bath and doorway");

// Tiles chosen: the single row takes the wall tile's short side (300mm).
const withTiles = { ...bathroom, products: { floor: "t-floor", wall: "t-wall" } };
result = calculateTilingRoom(withTiles, { productById });
close(result.surfaces.find((s) => s.key === "vanity-splashback").areaM2, 0.9 * 0.3, "single-row vanity splashback from the tile size");
const floor = result.surfaces.find((s) => s.key === "floor");
close(floor.order.orderAreaM2, 11.088, "floor order area with 10% wastage");
assert.equal(floor.order.boxes, 8, "CEILING(11.09 / 1.44) = 8 boxes");
close(floor.order.suppliedAreaM2, 11.52, "8 boxes supply 11.52m2");
assert.equal(result.floorWasteCount, 2);
assert.equal(tileOrder(10, { wastagePct: 0, boxCoverageM2: 1.44 }).boxes, 7, "never rounded down (6.94 -> 7)");

// Ensuite - Floor to ceiling: gross wall - openings, no shower/bath/skirting added on top.
const ensuite = {
  ...newTilingRoom({ type: "ensuite", name: "Ensuite", id: "room-ensuite" }),
  spec: "floor-to-ceiling",
  geometry: { mode: "rectangle", widthMm: 2800, lengthMm: 3600, ceilingHeightMm: 2400 },
  components: { shower: { enabled: true, widthMm: 900, lengthMm: 900, tiledWalls: 2 }, bath: { enabled: true, lengthsMm: [1700] } },
  openings: [{ type: "door", widthMm: 820, heightMm: 2040, quantity: 1 }, { type: "window", widthMm: 1200, heightMm: 900, quantity: 1 }],
};
const f2c = calculateTilingRoom(ensuite, { productById });
const walls = f2c.surfaces.find((s) => s.key === "walls");
close(walls.grossM2, 30.72, "gross wall area");
close(walls.openingsM2, 1.6728 + 1.08, "openings");
close(walls.areaM2, 27.9672, "net wall area");
assert.deepEqual(f2c.surfaces.map((s) => s.key).sort(), ["floor", "walls"], "no shower/bath/skirting surfaces added to floor-to-ceiling");

// Rooms: suggested from project room names; Add Room refuses an exact duplicate name only.
const suggested = suggestedTilingRooms(["Kitchen", "Main Bathroom", "Ensuite", "Bed 1", "Laundry", "Alfresco"]);
assert.deepEqual(suggested.map((r) => `${r.name}:${r.type}`), ["Kitchen:kitchen", "Main Bathroom:bathroom", "Ensuite:ensuite", "Laundry:laundry", "Alfresco:alfresco"]);
assert.ok(addTilingRoom(suggested, { type: "ensuite", name: "Ensuite" }).error, "duplicate refused");
assert.equal(addTilingRoom(suggested, { type: "ensuite", name: "Ensuite 2" }).rooms.length, 6);

// Saved selection (the one selection-book row) and its round trip.
const requirement = { requirementKey: "tiling-rooms", label: "Tiling (room by room)", areaKey: "tiles-stone", areaLabel: "Tiles & Stone", defaultAllowance: 0 };
const patch = tilingSelectionPatch(requirement, [withTiles, ensuite], { productById, projectId: "p", organisationId: "w" });
const reloaded = JSON.parse(JSON.stringify(patch));
assert.deepEqual(reloaded.guidedSelection.tilingRooms, [withTiles, ensuite], "every room input persists");
assert.ok(reloaded.selectedCost > 0);

// Quotation Builder + procurement: per-room sections, per-surface lines, labour kept separate.
const book = { rooms: [{ rows: [{ id: "row-tiling", guidedRequirementKey: "tiling-rooms", ...reloaded }] }] };
const workbook = connectTilingSelectionsToQuotation({ quotation: {}, procurement: { items: [] } }, book, { productById });
const bathroomSection = workbook.quotation["TILING - BATHROOM"];
assert.ok(bathroomSection && workbook.quotation["TILING - ENSUITE"], "a section per room");
const line = (text) => bathroomSection.rows.find((r) => r.item.startsWith(text));
close(line("Floor tiles").quantity, 11.09, "floor tile quote qty = order area");
assert.equal(line("Shower wall tiles").unit, "M2");
assert.ok(line("Labour - floor tiling") && line("Labour - wall tiling") && line("Labour - skirting tiles") && line("Labour - install linear drains"), "labour quantities by type");
assert.equal(bathroomSection.rows.filter((r) => /^Floor waste|^Linear drain/.test(r.item)).length, 2);
const floorItem = workbook.procurement.items.find((i) => i.id === "tiling:room-bathroom:floor");
assert.equal(floorItem.qty, 8); assert.equal(floorItem.unit, "BOX");
const again = connectTilingSelectionsToQuotation(workbook, book, { productById });
assert.equal(again.quotation["TILING - BATHROOM"].rows.length, bathroomSection.rows.length, "re-running replaces, never duplicates");

// Migration: saved Floor Wastes & Drains allocations move into their rooms; tile picks are kept.
const wasteRequirement = { requirementKey: "floor-waste", label: "Floor Wastes & Drains", areaKey: "tiles-stone", areaLabel: "Tiles & Stone", unit: "EACH" };
const wastePatch = plumbingSelectionPatch(wasteRequirement, [plumbingLineWithTotals({ lineId: "fw1", productId: "fw1", productName: "1200mm Tile Insert Channel Waste", unit: "EACH", unitPrice: 199, allocations: [{ location: "Ensuite Shower", quantity: 1 }, { location: "Laundry", quantity: 1 }] })], null, {});
const selections = new Map([["floor-waste", { selected_details: wastePatch.patch.guidedSelection }], ["floor-tiles", { selected_product_name: "Old Floor Tile", selected_details: { productId: "old", selectedPrice: 45 } }]]);
const migrated = migrateLegacyTiling(suggestedTilingRooms(["Ensuite"]), selections);
const ensuiteRoom = migrated.rooms.find((r) => r.name === "Ensuite");
assert.equal(ensuiteRoom.floorWastes[0].application, "Shower");
assert.ok(migrated.rooms.find((r) => r.name === "Laundry")?.floorWastes.length, "a room is created for a waste allocated to an unlisted room");
assert.equal(migrated.legacySelections[0].productName, "Old Floor Tile", "earlier tile selection kept");

// ---------------------------------------------------------------------------------------------
// Millimetre inputs -> m2 (the four cases from the brief)
// ---------------------------------------------------------------------------------------------
const rectangle = (widthMm, lengthMm) => roomGeometry({ mode: "rectangle", widthMm, lengthMm });
close(rectangle(3000, 4000).floorAreaM2, 12.0, "TEST 1: 3000 x 4000mm floor");
close(rectangle(3000, 4000).perimeterLm, 14.0, "TEST 1: perimeter stays in metres");
const kitchen = { ...newTilingRoom({ type: "kitchen", name: "Kitchen", id: "room-kitchen" }), splashback: { lengthMm: 3000, heightMm: 600 } };
close(calculateTilingRoom(kitchen).surfaces.find((s) => s.key === "splashback").areaM2, 1.8, "TEST 2: 3000 x 600mm splashback");
const featureRoom = { ...newTilingRoom({ type: "bathroom", name: "Feature", id: "room-feature" }), spec: "standard", geometry: { mode: "rectangle", widthMm: 2400, lengthMm: 2400 }, components: { feature: { enabled: true, walls: [{ widthMm: 2400, heightMm: 2400 }] } } };
close(calculateTilingRoom(featureRoom).surfaces.find((s) => s.key === "feature").areaM2, 5.76, "TEST 3: 2400 x 2400mm wall");
close(rectangle(3500, 4200).floorAreaM2, 14.7, "TEST 4: 3500 x 4200mm floor");
// Standard residential sizes are whole millimetres and never scaled by 1,000 or 1,000,000.
for (const size of [600, 900, 1200, 1800, 2400, 2700, 3000, 4500, 6000]) close(rectangle(size, 1000).floorAreaM2, size / 1000, `${size}mm x 1000mm`);
// Custom / irregular room: area entered in m2, edge length in mm.
const irregular = roomGeometry({ mode: "custom", floorAreaM2: 13.5, perimeterMm: 16400 });
close(irregular.floorAreaM2, 13.5, "custom floor area"); close(irregular.perimeterLm, 16.4, "custom perimeter mm -> m");
// A 2400mm ceiling over a 14.0m perimeter is 33.6m2 of wall, not 33,600.
const f2cRoom = { ...newTilingRoom({ type: "ensuite", name: "F2C", id: "room-f2c" }), spec: "floor-to-ceiling", geometry: { mode: "rectangle", widthMm: 3000, lengthMm: 4000, ceilingHeightMm: 2400 } };
close(calculateTilingRoom(f2cRoom).surfaces.find((s) => s.key === "walls").areaM2, 33.6, "floor to ceiling walls");

// ---------------------------------------------------------------------------------------------
// Rooms saved in metres (before the mm convention) are converted once, safely
// ---------------------------------------------------------------------------------------------
const legacyBathroom = {
  id: "room-bathroom", name: "Bathroom", type: "bathroom", spec: "standard", wastagePct: 10, products: { floor: "t-floor", wall: "t-wall" },
  geometry: { mode: "rectangle", widthM: 2.8, lengthM: 3.6, ceilingHeightM: 2.4, floorAreaM2: "", perimeterLm: "", source: "manual" },
  components: { shower: { enabled: true, widthM: 0.9, lengthM: 0.9, tiledWalls: 2 }, bath: { enabled: true, lengthsLm: [1.7], splashbackHeightM: 0.6 }, vanity: { enabled: true, widthM: 0.9, splashback: "custom", customHeightM: 0.2 }, feature: { enabled: true, walls: [{ widthM: 1.2, heightM: 2.4 }] } },
  openings: [{ type: "door", widthMm: 820, heightMm: 2040, quantity: 1 }], floorWastes: [],
};
const converted = tilingRoomInMm(legacyBathroom);
assert.equal(converted.dimensionUnit, "mm");
assert.deepEqual([converted.geometry.widthMm, converted.geometry.lengthMm, converted.geometry.ceilingHeightMm], [2800, 3600, 2400]);
assert.ok(!("widthM" in converted.geometry) && !("perimeterLm" in converted.geometry), "no metre fields left behind");
assert.deepEqual([converted.components.shower.widthMm, converted.components.bath.lengthsMm[0], converted.components.bath.splashbackHeightMm, converted.components.vanity.customHeightMm, converted.components.feature.walls[0].heightMm], [900, 1700, 600, 200, 2400]);
assert.equal(converted.openings[0].widthMm, 820, "openings were always millimetres and are untouched");
assert.equal(converted.dimensionMigration, undefined, "nothing ambiguous in a genuine metres room");
assert.equal(tilingRoomInMm(converted), converted, "converting twice changes nothing");
// The old saved room calculates exactly what it did before, without being re-saved first.
const legacyResult = calculateTilingRoom(legacyBathroom, { productById });
close(legacyResult.geometry.floorAreaM2, 10.08, "legacy room floor area");
close(legacyResult.surfaces.find((s) => s.key === "shower-walls").areaM2 + legacyResult.surfaces.find((s) => s.key === "feature").areaM2, 3.6, "legacy shower walls + feature");
close(legacyResult.surfaces.find((s) => s.key === "bath-splashback").areaM2, 1.02, "legacy bath splashback");
// A kitchen where 3000 and 600 were typed into the fields labelled "m": kept as millimetres.
const mislabelled = tilingRoomInMm({ id: "k", name: "Kitchen", type: "kitchen", geometry: { mode: "rectangle", widthM: 3.2, lengthM: 4100 }, splashback: { lengthM: 3000, heightM: 600 } });
assert.deepEqual([mislabelled.splashback.lengthMm, mislabelled.splashback.heightMm], [3000, 600], "never multiplied to 3,000,000mm");
assert.deepEqual([mislabelled.geometry.widthMm, mislabelled.geometry.lengthMm], [3200, 4100], "a mix of metres and millimetres in one room is resolved per field");
assert.deepEqual(mislabelled.dimensionMigration.keptAsMm, ["geometry.lengthMm", "splashback.lengthMm", "splashback.heightMm"], "kept-as-mm fields are recorded for the builder to check");
close(calculateTilingRoom(mislabelled).surfaces.find((s) => s.key === "splashback").areaM2, 1.8, "mislabelled splashback area");
// Saving writes millimetres only, and the quotation reads an old saved room identically.
const legacyPatch = tilingSelectionPatch(requirement, [legacyBathroom], { productById });
assert.equal(legacyPatch.guidedSelection.tilingDimensionUnit, "mm");
assert.equal(legacyPatch.guidedSelection.tilingRooms[0].geometry.widthMm, 2800);
const legacyBook = { rooms: [{ rows: [{ id: "row", guidedRequirementKey: "tiling-rooms", guidedSelection: { requirementKey: "tiling-rooms", tilingRooms: [legacyBathroom] } }] }] };
const legacyQuote = connectTilingSelectionsToQuotation({ quotation: {}, procurement: { items: [] } }, legacyBook, { productById });
close(legacyQuote.quotation["TILING - BATHROOM"].rows.find((r) => r.item.startsWith("Floor tiles")).quantity, 11.09, "old saved room quotes the same floor area");
assert.equal(legacyQuote.procurement.items.find((i) => i.id === "tiling:room-bathroom:floor").qty, 8, "old saved room orders the same boxes");

console.log("mm inputs: 3000x4000 = 12.00m2, 3000x600 = 1.80m2, 2400x2400 = 5.76m2, 3500x4200 = 14.70m2; legacy metre rooms converted");
console.log("Bathroom (standard): floor 10.08m2, perimeter 12.80lm, shower 3.60m2, bath 1.02m2, skirting", area("skirting").toFixed(2), "m2, vanity single row 0.27m2 with a 300x600 tile");
console.log("Floor order: 10.08 + 10% = 11.09m2 -> 8 boxes of 1.44m2 = 11.52m2 supplied");
console.log("Ensuite (floor to ceiling): 30.72 gross - 2.75 openings = 27.97m2 net, no shower/bath/skirting added");
console.log("Quotation sections:", Object.keys(workbook.quotation).join(", "), `(${bathroomSection.rows.length} bathroom lines)`);
console.log("\nTiling rooms tests passed.");
