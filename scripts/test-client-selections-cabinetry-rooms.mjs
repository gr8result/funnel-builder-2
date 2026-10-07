import assert from "node:assert/strict";
import { getProductLibraryCabinetryBenchtopRecords } from "../lib/product-library/cabinetryCatalogueSelectors.js";
import { productSnapshot, productVariantSnapshot } from "../components/product-library/cabinetry/cabinetryUi.js";
import {
  applySavedCabinetryRoom,
  buildCabinetryRoomSelectionPayload,
  cabinetryRoomKey,
  cabinetrySelectionsForScope,
  copyCabinetryRoom,
  defaultCabinetryRoom,
  hydrateCabinetryRooms,
  isSameCabinetryRoomSelection,
  persistCabinetryRoomSelection,
} from "../lib/builders/cabinetryRoomSelection.js";

const clone = (value) => JSON.parse(JSON.stringify(value));
const scope = { workspaceId: "workspace-a", projectId: "project-a", snapshotId: "snapshot-a", sessionId: "session-a", userId: "user-a" };
const product = (id) => ({ id, productId: `product-${id}`, productCode: `code-${id}`, sku: `sku-${id}`, productName: id, brand: "Catalogue fixture", colour: "White", finish: "Matt" });
function completeRoom(key) {
  return defaultCabinetryRoom(key, {
    configuration: { components: { [key === "bathroom" ? "wallVanity2Door" : "baseCabinets"]: true }, quantities: { [key === "bathroom" ? "wallVanity2Door" : "baseCabinets"]: key === "kitchen" ? 5 : 2 } },
    finish: product(`${key}-external`),
    internals: { type: "matching", exposed: true, product: product(`${key}-internal`), exposedFinish: product(`${key}-exposed`), openShelfFinish: product(`${key}-open-shelf`) },
    kickboard: { type: "catalogue", product: product(`${key}-kick`) },
    handles: { system: "bar", product: product(`${key}-handle`), size: "160 mm", finish: "Brushed nickel" },
    benchtop: { material: "stone", product: product(`${key}-stone`), fabrication: { thickness: "20 mm", edgeProfile: "Arris", mitredDrop: true, waterfallEnds: "2", splashback: "100 mm upstand" } },
    hardware: { softCloseDoors: true, softCloseDrawers: true, drawerSystem: "Tandem", hinges: "Concealed" },
    specialFeatures: { openShelving: true, rawMdfBulkheads: true },
  });
}
function databaseFixture(seed = []) {
  const rows = clone(seed), calls = [];
  let sequence = 0;
  const db = {
    rows, calls, failInsert: false, failRetire: false, hideRetirementRows: false,
    from(table) {
      assert.equal(table, "builder_client_selections", "Cabinetry must use the canonical table");
      let action = "select", payload, single = false;
      const filters = [];
      const chain = {
        insert(value) { action = "insert"; payload = clone(value); return chain; },
        update(value) { action = "update"; payload = clone(value); return chain; },
        select() { return chain; },
        single() { single = true; return chain; },
        eq(key, value) { filters.push(["eq", key, value]); return chain; },
        is(key, value) { filters.push(["eq", key, value]); return chain; },
        in(key, value) { filters.push(["in", key, value]); return chain; },
        order() { return chain; },
        then(resolve, reject) {
          return Promise.resolve().then(() => {
            calls.push({ table, action, payload, filters: clone(filters) });
            if (action === "insert") {
              if (db.failInsert) return { data: null, error: new Error("insert unavailable") };
              for (const field of ["client_selection_price", "calculated_client_selection_price", "variation_amount"]) assert.equal(typeof payload[field], "number", `${field} is NOT NULL`);
              const row = { ...payload, id: `saved-${++sequence}`, updated_at: `2026-09-11T00:00:${String(sequence).padStart(2, "0")}.000Z` };
              rows.push(clone(row));
              return { data: clone(single ? row : [row]), error: null };
            }
            const matches = rows.filter((row) => filters.every(([op, key, value]) => {
              const [column, property] = key.split("->>");
              const actual = property ? row[column]?.[property] : row[column];
              return op === "in" ? value.includes(actual) : (actual ?? null) === value;
            }));
            if (action === "update") {
              if (db.failRetire) return { data: null, error: new Error("retirement unavailable") };
              if (db.hideRetirementRows) return { data: [], error: null };
              matches.forEach((row) => Object.assign(row, payload));
            }
            return { data: clone(single ? matches[0] || null : matches), error: null };
          }).then(resolve, reject);
        },
      };
      return chain;
    },
  };
  return db;
}
const checks = [];
async function check(name, run) { await run(); checks.push(name); console.log(`PASS ${name}`); }
const db = databaseFixture();
let selections = [];
for (const key of ["kitchen", "laundry", "bathroom"]) {
  await check(`${key}: canonical save -> discard local state -> load -> hydrate all sections`, async () => {
    let localRoom = completeRoom(key);
    const expected = clone(localRoom);
    const payload = buildCabinetryRoomSelectionPayload({ ...scope, room: localRoom });
    assert.equal(payload.room, expected.roomLabel);
    assert.equal(payload.selected_details.requirementKey, `cabinetry:${key}`);
    assert.ok(payload.subcategory.includes(expected.roomLabel), "Subcategory includes the room and cannot collide across rooms");
    const saved = await persistCabinetryRoomSelection({ supabase: db, payload, selections });
    selections = applySavedCabinetryRoom(selections, saved.inserted, saved.replacedIds);
    localRoom = null;
    selections = [];
    const { data } = await db.from("builder_client_selections").select("*").eq("workspace_id", scope.workspaceId).eq("project_id", scope.projectId).eq("session_id", scope.sessionId).eq("snapshot_id", scope.snapshotId).order("updated_at", { ascending: false });
    selections = data;
    const loaded = hydrateCabinetryRooms(data);
    assert.deepEqual(loaded[key], expected);
    for (const identity of ["id", "productId", "productCode", "sku"]) {
      assert.equal(loaded[key].finish[identity], expected.finish[identity]);
      assert.equal(loaded[key].handles.product[identity], expected.handles.product[identity]);
      assert.equal(loaded[key].benchtop.product[identity], expected.benchtop.product[identity]);
    }
    loaded[key].configuration.quantities.arbitraryLocalEdit = 999;
    assert.equal(hydrateCabinetryRooms(data)[key].configuration.quantities.arbitraryLocalEdit, undefined, "Hydration does not alias saved JSON");
  });
}
await check("multi-room replacement isolation and requirementKey/subcategory uniqueness", async () => {
  const before = clone(hydrateCabinetryRooms(selections));
  const kitchen = completeRoom("kitchen");
  kitchen.configuration.quantities.baseCabinets = 17;
  const payload = buildCabinetryRoomSelectionPayload({ ...scope, room: kitchen });
  const otherScope = buildCabinetryRoomSelectionPayload({ ...scope, sessionId: "session-other", room: kitchen });
  const { inserted } = await persistCabinetryRoomSelection({ supabase: db, payload: otherScope, selections });
  selections.push(inserted);
  const sameProjectOtherSnapshot = { ...selections[0], id: "other-snapshot", snapshot_id: "snapshot-other" };
  const sameRoomOtherProject = { ...selections[0], id: "other-project", project_id: "project-other" };
  const sameRoomOtherWorkspace = { ...selections[0], id: "other-workspace", workspace_id: "workspace-other" };
  for (const row of [inserted, sameProjectOtherSnapshot, sameRoomOtherProject, sameRoomOtherWorkspace]) assert.equal(isSameCabinetryRoomSelection(row, payload), false);
  const saved = await persistCabinetryRoomSelection({ supabase: db, payload, selections });
  assert.equal(saved.replacedIds.length, 1);
  const update = db.calls.filter((call) => call.action === "update").at(-1);
  for (const field of ["workspace_id", "project_id", "session_id", "snapshot_id", "selected_details->>requirementKey", "id"]) assert.ok(update.filters.some((filter) => filter[1] === field), `Retirement is scoped by ${field}`);
  selections = applySavedCabinetryRoom(selections, saved.inserted, saved.replacedIds);
  const rooms = hydrateCabinetryRooms(selections.filter((row) => row.session_id === scope.sessionId));
  assert.equal(rooms.kitchen.configuration.quantities.baseCabinets, 17);
  assert.deepEqual(rooms.laundry, before.laundry);
  assert.deepEqual(rooms.bathroom, before.bathroom);
  assert.equal(db.rows.find((row) => row.id === inserted.id).is_active, true);
  assert.equal(new Set(["kitchen", "laundry", "bathroom"].map((key) => buildCabinetryRoomSelectionPayload({ ...scope, room: completeRoom(key) }).subcategory)).size, 3);
});
await check("failed insert leaves saved room and other rooms active", async () => {
  const before = clone(db.rows);
  db.failInsert = true;
  await assert.rejects(persistCabinetryRoomSelection({ supabase: db, payload: buildCabinetryRoomSelectionPayload({ ...scope, room: completeRoom("bathroom") }), selections }), /insert unavailable/);
  assert.deepEqual(db.rows, before);
  db.failInsert = false;
});
await check("failed retirement retains durable new revision; latest hydration wins", async () => {
  db.failRetire = true;
  const changed = completeRoom("bathroom"); changed.finish = product("new-bathroom-finish");
  const saved = await persistCabinetryRoomSelection({ supabase: db, payload: buildCabinetryRoomSelectionPayload({ ...scope, room: changed }), selections });
  assert.ok(saved.warning);
  assert.deepEqual(saved.replacedIds, []);
  assert.equal(hydrateCabinetryRooms(db.rows.filter((row) => row.session_id === scope.sessionId)).bathroom.finish.id, "new-bathroom-finish");
  db.failRetire = false;
});
await check("zero-match retirement warns and does not claim earlier records were retired", async () => {
  db.hideRetirementRows = true;
  const before = clone(db.rows);
  const saved = await persistCabinetryRoomSelection({ supabase: db, payload: buildCabinetryRoomSelectionPayload({ ...scope, room: completeRoom("laundry") }), selections });
  assert.ok(saved.warning); assert.deepEqual(saved.replacedIds, []);
  assert.deepEqual(db.rows.slice(0, before.length), before);
  assert.ok(db.rows.some((row) => row.id === saved.inserted.id));
  db.hideRetirementRows = false;
});
await check("Copy Colours Only preserves destination scope, quantities and non-finish specifications", () => {
  const source = completeRoom("kitchen"), destination = completeRoom("butlers-pantry");
  destination.internals.type = "white";
  destination.internals.exposed = false;
  destination.legacySelections = [{ id: "destination-legacy" }];
  const before = clone(destination), copied = copyCabinetryRoom(source, destination, "colours");
  assert.equal(copied.roomKey, before.roomKey); assert.equal(copied.roomLabel, before.roomLabel);
  for (const section of ["configuration", "handles", "benchtop", "hardware", "specialFeatures", "legacySelections"]) assert.deepEqual(copied[section], before[section]);
  assert.deepEqual(copied.finish, source.finish);
  assert.deepEqual(copied.internals.exposedFinish, source.internals.exposedFinish);
  assert.equal(copied.internals.type, "white"); assert.equal(copied.internals.exposed, false);
  copied.finish.colour = "Changed copy"; copied.internals.exposedFinish.colour = "Changed copy";
  assert.equal(source.finish.colour, "White"); assert.equal(source.internals.exposedFinish.colour, "White");
  assert.deepEqual(destination, before);
});
await check("Copy Complete Specification deep-copies all eight sections and preserves destination identity", () => {
  const source = completeRoom("kitchen"), destination = completeRoom("butlers-pantry");
  destination.legacySelections = [{ id: "destination-legacy" }];
  const copied = copyCabinetryRoom(source, destination, "complete");
  for (const section of ["configuration", "finish", "internals", "kickboard", "handles", "benchtop", "hardware", "specialFeatures"]) assert.deepEqual(copied[section], source[section]);
  assert.equal(copied.roomKey, destination.roomKey); assert.equal(copied.roomLabel, destination.roomLabel);
  assert.deepEqual(copied.legacySelections, destination.legacySelections);
  copied.configuration.quantities.baseCabinets = 500; copied.benchtop.fabrication.thickness = "Different"; copied.handles.product.productCode = "Changed";
  assert.equal(source.configuration.quantities.baseCabinets, 5);
  assert.equal(source.benchtop.fabrication.thickness, "20 mm"); assert.notEqual(source.handles.product.productCode, "Changed");
});
await check("legacy generic Kitchen cabinetry maps safely and unsupported original data survives resave", () => {
  const legacy = { id: "legacy-kitchen", workspace_id: scope.workspaceId, project_id: scope.projectId, session_id: scope.sessionId, snapshot_id: scope.snapshotId, room: "Kitchen", category: "kitchen", subcategory: "cabinetry", selected_product_name: "Legacy Polar White", selected_supplier_name: "Laminex", selected_colour: "Polar White", is_active: true, selected_details: { requirementKey: "cabinetry", productId: "legacy-product-id", productCode: "legacy-code", unsupportedDetails: { archivedFinishNotes: "Retain original information", customAppliance: ["legacy", "record"] } } };
  const before = clone(legacy);
  const mapped = hydrateCabinetryRooms([legacy]);
  assert.equal(mapped.kitchen.finish.productId, "legacy-product-id");
  assert.equal(mapped.kitchen.finish.productCode, "legacy-code");
  assert.equal(mapped.kitchen.legacyReviewRequired, true);
  assert.deepEqual(mapped.kitchen.legacySelections, [legacy]);
  const resaved = buildCabinetryRoomSelectionPayload({ ...scope, room: mapped.kitchen });
  assert.equal(isSameCabinetryRoomSelection(legacy, resaved), false, "Legacy row is retained, not retired by the room-specific replacement rule");
  assert.deepEqual(hydrateCabinetryRooms([{ ...resaved, id: "new-room" }, legacy]).kitchen.legacySelections[0], legacy);
  assert.deepEqual(legacy, before);
});
await check("legacy multiple locations keep their room identity and custom cabinetry rooms remain supported", () => {
  const old = { id: "legacy-multi-room", category: "cabinetry", room: "Cabinetry", selected_details: { cabinetrySelection: { locations: [{ location: "Kitchen", defaultColour: product("old-kitchen") }, { location: "Laundry", defaultColour: product("old-laundry") }] } } };
  const rooms = hydrateCabinetryRooms([old]);
  assert.equal(rooms.kitchen.finish.id, "old-kitchen"); assert.equal(rooms.laundry.finish.id, "old-laundry");
  assert.equal(cabinetryRoomKey("Butler's Pantry"), "butlers-pantry");
  assert.equal(cabinetryRoomKey("powder"), "powder-room");
  const custom = defaultCabinetryRoom("Media Joinery");
  assert.equal(custom.roomKey, "media-joinery"); assert.equal(custom.roomLabel, "Media Joinery");
});
await check("hydration isolates workspace/project/session/snapshot while retaining project-level legacy evidence", () => {
  const saved = buildCabinetryRoomSelectionPayload({ ...scope, room: completeRoom("kitchen") });
  const legacy = { id: "project-level-legacy", workspace_id: scope.workspaceId, project_id: scope.projectId, session_id: null, snapshot_id: null, room: "Kitchen", subcategory: "cabinetry", selected_details: { requirementKey: "cabinetry", productName: "Retained project finish" } };
  const rows = [saved, legacy, { ...saved, session_id: "another-session" }, { ...saved, snapshot_id: "another-snapshot" }, { ...saved, project_id: "another-project" }, { ...saved, workspace_id: "another-workspace" }];
  assert.deepEqual(cabinetrySelectionsForScope(rows, scope), [saved, legacy]);
  assert.deepEqual(cabinetrySelectionsForScope(rows, { ...scope, workspaceId: "" }), []);
  assert.deepEqual(cabinetrySelectionsForScope(rows, { ...scope, sessionId: "", snapshotId: "" }), [legacy], "An unselected session must not combine saved modern sessions");
});
await check("unavailable laminate material saves a pending draft without inventing a product", () => {
  const room = completeRoom("laundry");
  room.benchtop = { material: "laminate", brand: "Laminex", product: null, fabrication: { thickness: "33 mm", edgeProfile: "Square" } };
  const payload = buildCabinetryRoomSelectionPayload({ ...scope, room });
  assert.equal(payload.selection_status, "not_selected");
  assert.equal(payload.selected_details.configurationComplete, false);
  assert.equal(payload.selected_details.materialSelectionPending, true);
  assert.equal(payload.selected_details.cabinetryRoom.benchtop.product, null);
  assert.deepEqual(payload.selected_details.cabinetryRoom.benchtop.fabrication, room.benchtop.fabrication);
});
for (const brand of ["Polytec", "Laminex"]) await check(`${brand}: real laminate identity and sheet variant survive save, hydration and copying`, async () => {
  const record = getProductLibraryCabinetryBenchtopRecords({ material: "laminate", brand })[0];
  const variant = record.variants[0];
  const room = completeRoom("kitchen");
  room.benchtop = { material: "laminate", brand, product: productSnapshot(record), fabrication: { thickness: "33", edgeProfile: "square" } };
  assert.equal(buildCabinetryRoomSelectionPayload({ ...scope, room }).selected_details.materialSelectionPending, true, "A colour without a sheet variant remains incomplete");
  room.benchtop.product = productVariantSnapshot(record, variant);
  const localDb = databaseFixture();
  const payload = buildCabinetryRoomSelectionPayload({ ...scope, room });
  assert.equal(payload.selection_status, "selected");
  const saved = await persistCabinetryRoomSelection({ supabase: localDb, payload });
  const loaded = hydrateCabinetryRooms([JSON.parse(JSON.stringify(saved.inserted))]).kitchen;
  assert.deepEqual(loaded.benchtop, room.benchtop);
  for (const key of ["productId", "variantId", "sku", "productCode", "finish", "size", "thickness", "thicknessKind", "sourceUrl"]) assert.equal(loaded.benchtop.product[key], room.benchtop.product[key]);
  assert.equal(loaded.benchtop.product.variants, undefined);
  const destination = completeRoom("laundry");
  assert.deepEqual(copyCabinetryRoom(loaded, destination, "colours").benchtop, destination.benchtop);
  const copied = copyCabinetryRoom(loaded, destination, "complete");
  assert.deepEqual(copied.benchtop, room.benchtop);
  assert.equal(copied.roomKey, "laundry");
  copied.benchtop.product.sku = "edited-copy";
  assert.equal(loaded.benchtop.product.sku, variant.sku);
});
console.log(`Cabinetry room persistence regression: ${checks.length} checks passed (isolated canonical table test double).`);
