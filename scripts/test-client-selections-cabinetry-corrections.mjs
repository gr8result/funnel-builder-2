// Client Selections cabinetry corrections (owner brief 17 Nov 2026). Read-only real job copy + synthetic cases.
//  1. No estimating measurements in Client Selections (bulkhead runs, benchtop lengths, Sharkfin arithmetic);
//     a missing measurement reaches the Quotation Builder as BUILDER MEASUREMENT REQUIRED with room, item, unit.
//  2. The Kitchen is the first cabinetry room and the master: "Apply Kitchen finishes to other rooms" copies
//     only compatible finishes into chosen rooms (never quantities, schedule, lengths or layout).
//  3. No fabricated "Copied from <room>" notes.
//  4. Sharkfin: Selected / Not selected for the client; corner cupboards count both fronts; builder review
//     note; a selection with no countable fronts is sent on for the builder, never dropped.
//  5. The duplicate bulkhead question / photograph is gone; one bulkhead selection per room.
//   node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-client-selections-cabinetry-corrections.mjs [--job=<file.gr8job>]
import assert from "node:assert/strict";
import fs from "node:fs";
import JSZip from "jszip";
import { applyCabinetryRequirementsToQuotation as apply, cabinetryQuotationBriefs, collectCabinetryRequirements, sharkfinUpgrade, updateCabinetrySelectionRequirement } from "../lib/construction-estimation/cabinetryRequirements.js";
import { applyKitchenFinishesToRooms, cabinetryCopiedItems, resolveCabinetryCopiedItems, cabinetryNotesWithoutCopyProvenance, cabinetryRoomSequence, copyCabinetryLocation, kitchenFinishTargetRooms, normaliseCabinetrySelection } from "../lib/builders/cabinetryWorkflow.js";

const results = [];
const step = (name, fn) => { try { fn(); results.push(`${name}: PASS`); } catch (error) { results.push(`${name}: FAIL`); console.error(`FAIL ${name}:`, error.message, (error.stack || "").split("\n").find((line) => line.includes("cabinetry-corrections")) || ""); process.exitCode = 1; } };
const clone = (value) => JSON.parse(JSON.stringify(value));

const file = process.argv.find((item) => item.startsWith("--job="))?.slice(6) || process.env.CLIENT_SELECTIONS_JOB_FILE || "E:/dev/quotation-recovery-20261108/restored/New Job 03 09 LATEST VERSION 11-11.gr8job";
const real = fs.existsSync(file) ? JSON.parse(await (await JSZip.loadAsync(fs.readFileSync(file))).file("estimate.json").async("string")).workbook : null;
const cabinetryRowOf = (workbook) => workbook.clientSelectionsBook.rooms.flatMap((room) => room.rows || []).find((row) => row.guidedSelection?.cabinetrySelection);
const withSelection = (workbook, selection) => {
  const next = clone(workbook);
  cabinetryRowOf(next).guidedSelection.cabinetrySelection = selection;
  return next;
};

const colour = (name) => ({ id: `c-${name}`, supplier: "Polytec", colourName: name, finish: "Woodmatt", productRange: "Decorative" });
const surface = { supplier: "Caesarstone", productId: "cs-eclipse", colourName: "Eclipse", collection: "Classico", rangeKey: "stone_standard" };
const synthetic = () => normaliseCabinetrySelection({
  locations: [
    { location: "Butler's Pantry", included: true, status: "in_progress", enabledAreaKeys: ["lowerDoorsDrawers", "overheadDoors"], areaSelections: {}, handles: {}, benchtopAreas: [{ id: "benchtop-bp", label: "Butler's Pantry benchtop", lengthMm: 3000, depthMm: 600, surface: null }] },
    { location: "Kitchen", included: true, status: "complete", doorMaterialGroup: "Standard colourboard", supplier: "Polytec", enabledAreaKeys: ["lowerDoorsDrawers", "overheadDoors", "islandBenchBack", "endPanels"],
      areaSelections: { lowerDoorsDrawers: colour("Arcadia Oak"), overheadDoors: colour("Arabica"), islandBenchBack: colour("Arcadia Oak"), endPanels: colour("Arcadia Oak") }, bulkheadFinishMode: "raw_mdf_site_paint",
      handles: { base: { openingMethod: "Sharkfin", productName: "Sharkfin" }, overhead: { openingMethod: "Handleless", productName: "Handleless" } },
      benchtopAreas: [{ id: "benchtop-main", label: "Main benchtop", lengthMm: "", depthMm: 600, surface }], benchtop: surface },
    { location: "Laundry", included: true, status: "in_progress", enabledAreaKeys: ["lowerDoorsDrawers", "overheadDoors"], areaSelections: { overheadDoors: colour("Client White") }, handles: { overhead: { openingMethod: "Knob", productName: "Client knob" } } },
    { location: "Main Bathroom", included: true, status: "in_progress", enabledAreaKeys: ["wallVanityDoors", "wallVanityDrawers"], bathroomScopeKeys: ["wallMountedVanity"], areaSelections: {}, bathroomHandles: {}, bathroomBenchtops: {},
      benchtopAreas: [{ id: "wallMountedVanity", label: "Wall-mounted vanity benchtop", lengthMm: 1950, depthMm: 600, surface: null }] },
  ],
  schedule: [
    { componentId: "K1", location: "Kitchen", cabinetTypeId: "corner_base", unitType: "Corner base cabinet", quantity: 2 },
    { componentId: "K2", location: "Kitchen", cabinetTypeId: "drawer_base_4", unitType: "4 drawer base unit", quantity: 1 },
    { componentId: "K3", location: "Kitchen", cabinetTypeId: "bulkhead_300", unitType: "MDF bulkhead - 300mm - LM", quantity: 0, runs: [] },
    { componentId: "B1", location: "Butler's Pantry", cabinetTypeId: "base_unit_1200_2door", unitType: "2 door base unit - 1200mm", quantity: 1 },
    { componentId: "L1", location: "Laundry", cabinetTypeId: "overhead_2door_standard", unitType: "Overhead cabinet - 2 door - standard height", quantity: 3 },
    { componentId: "L2", location: "Laundry", cabinetTypeId: "base_unit_1200_2door", unitType: "2 door base unit - 1200mm", quantity: 1 },
    { componentId: "B2", location: "Butler's Pantry", cabinetTypeId: "overhead_2door_standard", unitType: "Overhead cabinet - 2 door - standard height", quantity: 2 },
  ],
});

step("1 KITCHEN IS THE FIRST CABINETRY ROOM", () => {
  const order = cabinetryRoomSequence(synthetic().locations).map((location) => location.location);
  assert.equal(order[0], "Kitchen", `sequence ${order.join(" > ")}`);
  if (real) assert.equal(cabinetryRoomSequence(normaliseCabinetrySelection(cabinetryRowOf(real).guidedSelection.cabinetrySelection).locations)[0].location, "Kitchen", "real job starts with the Kitchen");
});

step("2 APPLY KITCHEN FINISHES TO CHOSEN ROOMS - FINISHES ONLY", () => {
  const before = synthetic();
  const targets = kitchenFinishTargetRooms(before.locations).map((item) => item.location);
  assert.deepEqual(targets.sort(), ["Butler's Pantry", "Laundry", "Main Bathroom"], "every other cabinetry room of the job is offered, bathrooms included");
  const { selection, appliedSummary } = applyKitchenFinishesToRooms(before, { targetLocationNames: ["Butler's Pantry", "Laundry", "Main Bathroom"] });
  const room = (name) => selection.locations.find((location) => location.location === name);
  // Butler's Pantry: colours for the areas it has, handles, benchtop surface on its OWN area, bulkhead finish.
  assert.equal(room("Butler's Pantry").areaSelections.lowerDoorsDrawers.colourName, "Arcadia Oak");
  assert.equal(room("Butler's Pantry").areaSelections.overheadDoors.colourName, "Arabica");
  assert.ok(!room("Butler's Pantry").areaSelections.islandBenchBack, "no island bench back in a room without an island");
  assert.equal(room("Butler's Pantry").handles.base.openingMethod, "Sharkfin");
  assert.equal(room("Butler's Pantry").benchtopAreas[0].surface.colourName, "Eclipse");
  assert.equal(room("Butler's Pantry").benchtopAreas[0].lengthMm, 3000, "its own benchtop length is kept");
  assert.equal(room("Butler's Pantry").benchtopAreas[0].label, "Butler's Pantry benchtop", "its own benchtop area is kept");
  assert.equal(room("Butler's Pantry").bulkheadFinishMode, "raw_mdf_site_paint");
  // Laundry: its own choices are never overwritten.
  assert.equal(room("Laundry").areaSelections.overheadDoors.colourName, "Client White", "a colour the room chose itself is kept");
  assert.equal(room("Laundry").handles.overhead.productName, "Client knob", "a handle the room chose itself is kept");
  assert.equal(room("Laundry").areaSelections.lowerDoorsDrawers.colourName, "Arcadia Oak");
  // Main Bathroom: Kitchen door colour onto its vanity, base handle and benchtop onto each vanity.
  assert.equal(room("Main Bathroom").areaSelections.wallVanityDoors.colourName, "Arcadia Oak");
  assert.equal(room("Main Bathroom").areaSelections.wallVanityDrawers.colourName, "Arcadia Oak");
  assert.ok(!room("Main Bathroom").areaSelections.floorVanityDoors, "a vanity the room does not have gets nothing");
  assert.equal(room("Main Bathroom").bathroomHandles.wallMountedVanity.openingMethod, "Sharkfin");
  assert.equal(room("Main Bathroom").bathroomBenchtops.wallMountedVanity.colourName, "Eclipse");
  assert.equal(room("Main Bathroom").benchtopAreas[0].lengthMm, 1950, "the vanity benchtop length is kept");
  // Never: quantities, schedule, layout. The Kitchen itself is untouched.
  assert.deepEqual(selection.schedule, before.schedule, "the cabinet schedule (quantities, bulkheads) is not copied or changed");
  assert.deepEqual(room("Kitchen"), before.locations.find((location) => location.location === "Kitchen"), "the Kitchen is unchanged");
  assert.ok(Object.values(appliedSummary).every((items) => items.length), "each chosen room reports what it received");
  assert.equal(selection.audit.at(-1).action, "apply_kitchen_finishes_to_rooms", "the copy is recorded in the history");
  for (const name of ["Butler's Pantry", "Laundry", "Main Bathroom"]) assert.equal(room(name).status, "in_progress", `${name} is reviewed again, never auto-completed`);
  // A room can then be customised without changing the Kitchen.
  const customised = normaliseCabinetrySelection({ ...selection, locations: selection.locations.map((location) => location.location === "Butler's Pantry" ? { ...location, areaSelections: { ...location.areaSelections, lowerDoorsDrawers: colour("Pantry Blue") } } : location) });
  assert.equal(customised.locations.find((location) => location.location === "Kitchen").areaSelections.lowerDoorsDrawers.colourName, "Arcadia Oak");
  // Rooms not chosen are not touched.
  const onlyPantry = applyKitchenFinishesToRooms(before, { targetLocationNames: ["Butler's Pantry"] }).selection;
  assert.deepEqual(onlyPantry.locations.find((location) => location.location === "Laundry"), before.locations.find((location) => location.location === "Laundry"));
});

step("3 NO FABRICATED 'COPIED FROM' NOTES", () => {
  const copied = copyCabinetryLocation(synthetic(), "Butler's Pantry", ["Laundry"]);
  assert.ok(copied.schedule.filter((line) => line.location === "Laundry").every((line) => !/copied from/i.test(line.notes || "")), "a copy no longer writes 'Copied from' into the notes");
  assert.ok(copied.audit.some((entry) => entry.action === "copy_location_selections" && entry.fromLocation === "Butler's Pantry" && entry.toLocations.includes("Laundry")), "the real copy is kept in the history, not in the notes");
  assert.equal(cabinetryNotesWithoutCopyProvenance("Copied from Butler's Pantry"), "", "an older saved note is not shown");
  assert.equal(cabinetryNotesWithoutCopyProvenance("Left of the oven - Copied from Butler's Pantry"), "Left of the oven", "the client's own note is kept");
  assert.equal(cabinetryNotesWithoutCopyProvenance("Copied from the display home brochure"), "Copied from the display home brochure", "only the generated room provenance is removed");
  if (real) {
    const selection = normaliseCabinetrySelection(cabinetryRowOf(real).guidedSelection.cabinetrySelection);
    const kitchen = selection.locations.find((location) => location.location === "Kitchen");
    assert.equal(kitchen.copiedFromLocation, "", "the real Kitchen carries no copy provenance");
    assert.ok(!selection.schedule.some((line) => line.location === "Kitchen" && /copied from/i.test(line.notes || "")), "no real Kitchen line carries a copy note");
  }
});

step("3b ITEMS COPIED FROM ANOTHER ROOM ARE LISTED FOR KEEP / REMOVE, NEVER REMOVED SILENTLY", () => {
  const base = synthetic();
  const legacy = normaliseCabinetrySelection({ ...base, schedule: [...base.schedule, { componentId: "BP-COPY-1", location: "Kitchen", cabinetTypeId: "overhead_2door_standard", unitType: "Overhead cabinet - 2 door - standard height", quantity: 2, notes: "Copied from Butler's Pantry" },
    { componentId: "BP-COPY-2", location: "Kitchen", cabinetTypeId: "bulkhead_300", unitType: "MDF bulkhead - 300mm - LM", quantity: 3.2, runs: [{ id: "run-1", location: "Above overheads", lengthMm: 3200 }], notes: "Copied from Butler's Pantry" }],
    locations: base.locations.map((l) => l.location === "Kitchen" ? { ...l, benchtopAreas: [{ id: "benchtop-main", label: "Butler's Pantry benchtop", lengthMm: 3000, depthMm: 600, surface }] } : l) });
  const copied = cabinetryCopiedItems(legacy, "Kitchen");
  assert.equal(copied.fromLocation, "Butler's Pantry");
  assert.deepEqual(copied.lines.map((l) => l.componentId), ["BP-COPY-1", "BP-COPY-2"]);
  assert.deepEqual(copied.benchtopAreas.map((a) => a.label), ["Butler's Pantry benchtop"]);
  const kept = resolveCabinetryCopiedItems(legacy, "Kitchen", "keep");
  assert.equal(kept.schedule.length, legacy.schedule.length, "keep removes nothing");
  assert.equal(cabinetryCopiedItems(kept, "Kitchen").lines.length, 0, "the review is recorded once decided");
  const removed = resolveCabinetryCopiedItems(legacy, "Kitchen", "remove");
  assert.deepEqual(removed.schedule.filter((l) => l.location === "Kitchen").map((l) => l.componentId), ["K1", "K2", "K3"], "only the copied lines leave the Kitchen");
  assert.deepEqual(removed.schedule.filter((l) => l.location === "Butler's Pantry"), legacy.schedule.filter((l) => l.location === "Butler's Pantry"), "Butler's Pantry is unchanged");
  const area = removed.locations.find((l) => l.location === "Kitchen").benchtopAreas[0];
  assert.deepEqual([area.label, area.lengthMm, area.surface.colourName], ["Main benchtop", "", "Eclipse"], "the copied benchtop area becomes the Kitchen's own, unmeasured; its surface is kept");
  assert.equal(removed.audit.at(-1).action, "remove_copied_room_items");
  assert.equal(removed.audit.at(-1).removedLines.length, 2, "removed items are kept in the history");
});

step("4 SHARKFIN: CORNER BOTH FRONTS, BUILDER REVIEW, NEVER DROPPED", () => {
  const selection = synthetic();
  const kitchen = selection.locations.find((location) => location.location === "Kitchen");
  const upgrade = sharkfinUpgrade(kitchen, selection.schedule.filter((line) => line.location === "Kitchen"));
  assert.equal(upgrade.quantity, 2 * 2 + 4, "2 corner cupboards x 2 fronts + 4 drawer fronts");
  const workbook = { workspaceId: "w", quotation: {}, clientSelectionsBook: { rooms: [{ rows: [{ guidedSelection: { cabinetrySelection: selection } }] }] } };
  const requirement = collectCabinetryRequirements(workbook).find((item) => item.id === "sharkfin:kitchen");
  assert.equal(requirement.quantity, 8);
  assert.match(requirement.builderReview, /Builder to verify the number of Sharkfin fronts \(8 calculated, including 2 corner cupboards at 2 fronts each\)/);
  // Selected (Handles: Sharkfin) in a room whose cabinets have no countable front: sent on, not dropped.
  const empty = normaliseCabinetrySelection({ ...selection, schedule: selection.schedule.filter((line) => line.location !== "Kitchen") });
  const emptyWorkbook = { ...workbook, clientSelectionsBook: { rooms: [{ rows: [{ guidedSelection: { cabinetrySelection: empty } }] }] } };
  const pending = collectCabinetryRequirements(emptyWorkbook).find((item) => item.id === "sharkfin:kitchen");
  assert.ok(pending, "a selected Sharkfin upgrade with no counted fronts is still a requirement");
  assert.equal(pending.issueFlag, "MEASUREMENT REQUIRED");
  assert.equal(pending.action.kind, "enter-sharkfin-fronts");
  // The builder enters the verified number of fronts in the Quotation Builder.
  const verified = updateCabinetrySelectionRequirement(emptyWorkbook, "sharkfin:kitchen", 6);
  const after = collectCabinetryRequirements(verified).find((item) => item.id === "sharkfin:kitchen");
  assert.equal(after.quantity, 6);
  assert.equal(after.issue, undefined);
  assert.match(after.builderReview, /^Builder verified 6 Sharkfin fronts/);
  assert.equal(collectCabinetryRequirements(verified).filter((item) => item.type === "handle_upgrade_sharkfin").length, 1, "one Sharkfin charge per room, no double charge");
});

step("5 REAL JOB: SELECTIONS REACH THE QUOTATION WITH BUILDER NOTES", () => {
  if (!real) { console.log(`SKIP real job copy not found: ${file}`); return; }
  const settled = apply(real, real.workspaceId);
  const briefs = cabinetryQuotationBriefs(settled);
  const kitchen = briefs.find((item) => item.room === "Kitchen");
  const required = kitchen.measurements.filter((item) => item.status === "required");
  assert.ok(required.some((item) => /bulkhead/i.test(item.label) && item.unit === "LM" && item.quantity === null), "Kitchen bulkhead: BUILDER MEASUREMENT REQUIRED in LM, never zero-filled");
  assert.ok(required.some((item) => /benchtop/i.test(item.label) && item.unit === "LM"), "Kitchen benchtop: BUILDER MEASUREMENT REQUIRED in LM");
  const sharkfin = kitchen.builderReviews.find((item) => /sharkfin/i.test(item.label));
  assert.ok(sharkfin && /corner cupboard/.test(sharkfin.note), `Kitchen Sharkfin carries the builder review note (${sharkfin?.note})`);
  // Every included cabinetry room is in the quotation brief, with its own client selections.
  const rooms = normaliseCabinetrySelection(cabinetryRowOf(real).guidedSelection.cabinetrySelection).locations.filter((location) => location.included !== false).map((location) => location.location);
  assert.deepEqual(briefs.map((item) => item.room).sort(), rooms.sort());
  assert.ok(briefs.filter((item) => item.room !== "Powder Room").every((item) => item.clientSelections.length > 0), "each room's selections are carried");
  // Re-running the transfer is stable: no duplicate rows or changed quantities.
  const again = apply(settled, real.workspaceId);
  assert.deepEqual(again.quotation.CABINETRY.rows.map((row) => [row.importKey, row.quantity]), settled.quotation.CABINETRY.rows.map((row) => [row.importKey, row.quantity]));
  // A Kitchen-finishes copy on the real job changes no quantity on the quotation.
  const selection = normaliseCabinetrySelection(cabinetryRowOf(real).guidedSelection.cabinetrySelection);
  const copied = applyKitchenFinishesToRooms(selection, { targetLocationNames: ["Butler's Pantry", "Laundry", "Main Bathroom", "Ensuite", "Powder Room"] }).selection;
  assert.deepEqual(copied.schedule, selection.schedule, "real job: the schedule is untouched by the finishes copy");
  const quantities = (workbook) => (workbook.quotation.CABINETRY?.rows || []).filter((row) => /bulkhead|sharkfin/i.test(row.item || "")).map((row) => `${row.importKey}=${row.quantity}`).sort();
  assert.deepEqual(quantities(apply(withSelection(settled, copied), real.workspaceId)), quantities(settled), "bulkhead and Sharkfin quantities are unchanged by copying finishes");
});

step("6 CLIENT SELECTIONS SCREENS HAVE NO MEASUREMENT ENTRY OR DUPLICATE BULKHEAD QUESTION", () => {
  const book = fs.readFileSync("pages/modules/builders/selections-book.js", "utf8");
  const benchtop = fs.readFileSync("components/client-selections/BenchtopSelectionWorkflow.jsx", "utf8");
  assert.doesNotMatch(book, /<h3>Would you like bulkheads above/, "the duplicate bulkhead question is gone");
  assert.doesNotMatch(book, /kitchen-bulkhead-reference/, "the kitchen bulkhead photograph is gone");
  assert.doesNotMatch(book, /data-testid="cabinetry-bulkhead-question"/);
  assert.doesNotMatch(book, /<BulkheadRunsEditor|<SharkfinUpgradeDetail/, "no bulkhead run lengths or Sharkfin arithmetic / override in Client Selections");
  assert.doesNotMatch(benchtop, /data-testid="benchtop-area-length"/, "no benchtop length entry in Client Selections");
  // 18 Nov 2026: the measurement notice is builder-only - it lives in the Quotation Builder, never on this client screen.
  assert.doesNotMatch(benchtop, /BUILDER MEASUREMENT REQUIRED/, "no builder measurement notice on the client benchtop screen");
  assert.match(book, /Apply Kitchen finishes to other rooms/);
  assert.match(book, /activeLocation\.location !== "Kitchen" \? <><div className="cabinetryInlineEditor"><label><span>Copy complete specification/, "the Kitchen is never overwritten from another room");
});

console.log(results.join("\n"));
