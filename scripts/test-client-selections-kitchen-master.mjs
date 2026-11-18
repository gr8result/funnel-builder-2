// The Kitchen is the master cabinetry room (owner brief "CORRECT THE CABINETRY WORKFLOW", 17 Nov 2026).
//  1. Kitchen first: on a job where no cabinetry room was ever approved, the other rooms wait for the Kitchen.
//  2. No reverse copying: no other room's specification (whole room or section) can be copied into the Kitchen.
//  3/4. Apply Kitchen finishes copies finishes (colours, door material, profile, handles, benchtop surface,
//     bulkhead / kick finish) into chosen rooms only - never cabinets, quantities, lengths or layout.
//  5. Rooms stay independent: a room's own finishes and schedule survive; changing it later never touches the Kitchen.
//  8. Kitchen approval holds while finishes are applied to other rooms; each room approves on its own and reloads.
//   node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-client-selections-kitchen-master.mjs
import assert from "node:assert/strict";
import { applyKitchenFinishesToRooms, approveCabinetryRoom, cabinetryKitchenFirstPending, cabinetryRoomSequence, copyCabinetryLocation, copyCabinetryLocationSections, isCabinetryRoomApproved, normaliseCabinetrySelection } from "../lib/builders/cabinetryWorkflow.js";

const results = [];
const step = (name, fn) => { try { fn(); results.push(`${name}: PASS`); } catch (error) { results.push(`${name}: FAIL`); console.error(`FAIL ${name}:`, error.message); process.exitCode = 1; } };
const JOB = "job-kitchen-master";
const roomModel = { rooms: [
  { id: "room-kitchen", name: "Kitchen" }, { id: "room-bp", name: "Butler's Pantry" }, { id: "room-bath", name: "Main Bathroom" },
  { id: "room-ensuite", name: "Ensuite" }, { id: "room-powder", name: "Powder Room" }, { id: "room-laundry", name: "Laundry" },
] };
const colour = (name) => ({ id: `c-${name}`, supplier: "Polytec", colourName: name, finish: "Woodmatt", productRange: "Decorative" });
const surface = { supplier: "Caesarstone", productId: "cs-eclipse", colourName: "Eclipse", collection: "Classico" };
const handle = { openingMethod: "Sharkfin", productName: "Sharkfin" };
const blank = (location, projectRoomId, extra = {}) => ({ location, name: location, included: true, status: "in_progress", projectRoomId, areaSelections: {}, handles: {}, ...extra });
const schedule = [
  { componentId: "K1", location: "Kitchen", cabinetTypeId: "base_unit_1200_2door", unitType: "2 door base unit - 1200mm", quantity: 4 },
  { componentId: "K2", location: "Kitchen", cabinetTypeId: "overhead_2door_standard", unitType: "Overhead cabinet - 2 door - standard height", quantity: 3 },
  { componentId: "B1", location: "Butler's Pantry", cabinetTypeId: "base_unit_1200_2door", unitType: "2 door base unit - 1200mm", quantity: 1 },
  { componentId: "B2", location: "Butler's Pantry", cabinetTypeId: "overhead_2door_standard", unitType: "Overhead cabinet - 2 door - standard height", quantity: 2 },
  { componentId: "L1", location: "Laundry", cabinetTypeId: "base_unit_1200_2door", unitType: "2 door base unit - 1200mm", quantity: 1 },
  { componentId: "L2", location: "Laundry", cabinetTypeId: "overhead_2door_standard", unitType: "Overhead cabinet - 2 door - standard height", quantity: 3 },
  ...["Main Bathroom", "Ensuite", "Powder Room"].map((room, i) => ({ componentId: `W${i}`, location: room, cabinetTypeId: "vanity_wallhung_2drawer_750", type: "bath-wall-two-drawer", unitType: "Wall hung vanity - 2 drawer - 750mm", quantity: 1 })),
];
const wetScope = { bathroomScopeKeys: ["wallMountedVanity"], bathroomScope: ["wallMountedVanity"], enabledAreaKeys: ["wallVanityDoors", "wallVanityDrawers"], bathroomHandles: {}, bathroomBenchtops: {} };
// A brand-new job: every room has its builder schedule but no client finish selections.
const newJob = () => normaliseCabinetrySelection({ projectId: JOB, schedule, locations: [
  blank("Butler's Pantry", "room-bp", { benchtopAreas: [{ id: "benchtop-bp", label: "Main benchtop", lengthMm: 2400, depthMm: 600, surface: null }] }),
  blank("Kitchen", "room-kitchen"), blank("Main Bathroom", "room-bath", wetScope), blank("Ensuite", "room-ensuite", wetScope), blank("Powder Room", "room-powder", wetScope), blank("Laundry", "room-laundry"),
] }, roomModel);
const update = (selection, name, patch) => normaliseCabinetrySelection({ ...selection, locations: selection.locations.map((l) => l.location === name ? { ...l, ...patch } : l) }, roomModel);
const kitchenChoices = { doorMaterialGroup: "Standard colourboard", supplier: "Polytec", customProfile: "Shaker 60mm", bulkheadFinishMode: "raw_mdf_site_paint", kickPanelFinishMode: "match_base",
  areaSelections: { lowerDoorsDrawers: colour("Arcadia Oak"), overheadDoors: colour("Arabica") }, handles: { base: handle, overhead: { openingMethod: "Handleless", productName: "Handleless" } }, benchtop: surface, benchtops: surface };
const reload = (selection) => normaliseCabinetrySelection(JSON.parse(JSON.stringify(selection)), roomModel);
const room = (selection, name) => selection.locations.find((l) => l.location === name);
const id = (selection, name) => room(selection, name).projectRoomId || room(selection, name).id;
const approved = (selection) => cabinetryRoomSequence(selection.locations).filter((l) => isCabinetryRoomApproved(l, selection.schedule, JOB)).map((l) => l.location);
const scheduleOf = (selection, name) => JSON.stringify(selection.schedule.filter((line) => line.location === name).map(({ componentId, cabinetTypeId, quantity }) => ({ componentId, cabinetTypeId, quantity })));

let state;
step("1 KITCHEN FIRST ON A NEW JOB", () => {
  state = newJob();
  assert.equal(cabinetryRoomSequence(state.locations)[0].location, "Kitchen");
  assert.equal(cabinetryKitchenFirstPending(state, JOB), true, "other rooms wait for the Kitchen on a new job");
  state = update(state, "Kitchen", kitchenChoices);
  assert.equal(cabinetryKitchenFirstPending(state, JOB), true, "a filled-in but unapproved Kitchen still comes first");
  state = reload(approveCabinetryRoom(state, id(state, "Kitchen"), JOB));
  assert.deepEqual(approved(state), ["Kitchen"]);
  assert.equal(cabinetryKitchenFirstPending(state, JOB), false, "the other rooms open once the Kitchen is approved");
  // An existing job whose Kitchen approval was later withdrawn is not locked again.
  const withdrawn = update(state, "Kitchen", { areaSelections: { ...kitchenChoices.areaSelections, overheadDoors: colour("Black") } });
  assert.deepEqual(approved(withdrawn), [], "a real change withdraws the Kitchen approval");
  assert.equal(cabinetryKitchenFirstPending(withdrawn, JOB), false, "but a once-approved job never locks its rooms again");
});

step("2 NO REVERSE COPYING INTO THE KITCHEN", () => {
  const bp = update(state, "Butler's Pantry", { areaSelections: { lowerDoorsDrawers: colour("Black") } });
  const kitchenBefore = JSON.stringify(room(bp, "Kitchen"));
  const whole = copyCabinetryLocation(bp, "Butler's Pantry", ["Kitchen"]);
  assert.equal(JSON.stringify(room(whole, "Kitchen")), kitchenBefore, "a whole-room copy into the Kitchen does nothing");
  assert.equal(scheduleOf(whole, "Kitchen"), scheduleOf(bp, "Kitchen"), "no Butler's Pantry cabinets enter the Kitchen schedule");
  const sections = copyCabinetryLocationSections(bp, { fromLocation: "Butler's Pantry", toLocation: "Kitchen" });
  assert.equal(JSON.stringify(room(sections, "Kitchen")), kitchenBefore, "a section copy into the Kitchen does nothing");
  assert.deepEqual(approved(whole), approved(bp), "approvals untouched");
});

step("3/4 APPLY KITCHEN FINISHES - FINISHES ONLY, CHOSEN ROOMS ONLY", () => {
  const before = state;
  const { selection } = applyKitchenFinishesToRooms(before, { targetLocationNames: ["Butler's Pantry", "Laundry", "Main Bathroom"] });
  state = reload(selection);
  const bp = room(state, "Butler's Pantry");
  assert.equal(bp.areaSelections.lowerDoorsDrawers.colourName, "Arcadia Oak");
  assert.equal(bp.areaSelections.overheadDoors.colourName, "Arabica");
  assert.equal(bp.doorMaterialGroup, "Standard colourboard");
  assert.equal(bp.customProfile, "Shaker 60mm", "door profile copied");
  assert.equal(bp.handles.base.openingMethod, "Sharkfin");
  assert.equal(bp.bulkheadFinishMode, "raw_mdf_site_paint");
  assert.equal(bp.kickPanelFinishMode, "match_base");
  assert.equal(bp.benchtopAreas[0].surface.colourName, "Eclipse", "benchtop finish copied onto its own benchtop");
  assert.equal(bp.benchtopAreas[0].lengthMm, 2400, "its own benchtop measurement kept");
  assert.equal(room(state, "Main Bathroom").areaSelections.wallVanityDoors?.colourName, "Arcadia Oak", "bathroom vanity takes the Kitchen door colour");
  for (const name of ["Butler's Pantry", "Laundry", "Main Bathroom", "Ensuite", "Powder Room", "Kitchen"]) assert.equal(scheduleOf(state, name), scheduleOf(before, name), `${name} cabinets and quantities unchanged`);
  assert.equal(Object.keys(room(state, "Ensuite").areaSelections || {}).filter((k) => room(state, "Ensuite").areaSelections[k]?.colourName).length, 0, "a room that was not ticked receives nothing");
  assert.ok(!JSON.stringify(state.locations.map((l) => l.notes || "")).match(/copied from/i), "no copy notes written");
  const ids = state.locations.map((l) => l.projectRoomId);
  assert.equal(new Set(ids).size, ids.length, "no duplicate room identities");
});

step("5 ROOMS STAY INDEPENDENT", () => {
  const changed = update(state, "Butler's Pantry", { areaSelections: { ...room(state, "Butler's Pantry").areaSelections, overheadDoors: colour("Black") } });
  assert.equal(room(changed, "Butler's Pantry").areaSelections.overheadDoors.colourName, "Black");
  assert.equal(room(changed, "Kitchen").areaSelections.overheadDoors.colourName, "Arabica", "changing Butler's Pantry never touches the Kitchen");
  assert.equal(room(changed, "Laundry").areaSelections.overheadDoors.colourName, "Arabica", "or another room");
  state = changed;
});

step("8 KITCHEN APPROVAL HOLDS; EACH ROOM APPROVES ON ITS OWN AND RELOADS", () => {
  assert.deepEqual(approved(state), ["Kitchen"], "applying Kitchen finishes did not withdraw the Kitchen approval");
  // Complete the rooms the client did not tick, then approve every room in order.
  state = update(state, "Ensuite", { areaSelections: { wallVanityDoors: colour("White"), wallVanityDrawers: colour("White") }, bathroomHandles: { wallMountedVanity: { ...handle, targetKey: "wallMountedVanity" } }, bathroomBenchtops: { wallMountedVanity: { ...surface, targetKey: "wallMountedVanity" } } });
  state = update(state, "Powder Room", { areaSelections: { wallVanityDoors: colour("Grey"), wallVanityDrawers: colour("Grey") }, bathroomHandles: { wallMountedVanity: { ...handle, targetKey: "wallMountedVanity" } }, bathroomBenchtops: { wallMountedVanity: { ...surface, targetKey: "wallMountedVanity" } } });
  const order = cabinetryRoomSequence(state.locations).map((l) => l.location);
  for (const [index, name] of order.entries()) {
    if (name === "Kitchen") continue;
    state = reload(approveCabinetryRoom(state, id(state, name), JOB));
    assert.deepEqual(approved(state), order.slice(0, index + 1), `after approving ${name}`);
  }
  assert.deepEqual(approved(reload(reload(state))), order, "all six approvals survive save and reopen");
});

console.log(results.join("\n"));
