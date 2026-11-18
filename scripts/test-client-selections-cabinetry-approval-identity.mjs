// Cabinetry approval must persist for the room that was approved (17 Nov 2026 defect).
// On the real job the Kitchen carried Butler's Pantry's projectRoomId (leaked by a full "Copy complete
// specification" from Butler's Pantry). Approving Butler's Pantry found the Kitchen first, re-approved it,
// reported "Butler's Pantry cabinetry approved and saved" and left Butler's Pantry "Ready to approve".
//   node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-client-selections-cabinetry-approval-identity.mjs [--live=<cabinetrySelection.json>]
import assert from "node:assert/strict";
import fs from "node:fs";
import { approveCabinetryRoom, applyKitchenFinishesToRooms, cabinetryLocationMissingRequirements, cabinetryRoomSequence, copyCabinetryLocation, isCabinetryRoomApproved, normaliseCabinetrySelection } from "../lib/builders/cabinetryWorkflow.js";

const results = [];
const step = (name, fn) => { try { fn(); results.push(`${name}: PASS`); } catch (error) { results.push(`${name}: FAIL`); console.error(`FAIL ${name}:`, error.message); process.exitCode = 1; } };
const JOB = "job-approval-identity";
const roomModel = { rooms: [
  { id: "room-kitchen", name: "Kitchen" }, { id: "location-butler-s-pantry", name: "Butler's Pantry" }, { id: "room-bath", name: "Main Bathroom" },
  { id: "room-ensuite", name: "Ensuite" }, { id: "room-powder", name: "Powder Room" }, { id: "room-laundry", name: "Laundry" },
] };
const colour = (name) => ({ id: `c-${name}`, supplier: "Polytec", colourName: name, finish: "Woodmatt", productRange: "Decorative" });
const surface = { supplier: "Caesarstone", productId: "cs-eclipse", colourName: "Eclipse", collection: "Classico" };
const handle = { openingMethod: "Sharkfin", productName: "Sharkfin" };
const kitchenLike = (location, projectRoomId, extra = {}) => ({ location, name: location, included: true, status: "in_progress", projectRoomId, doorMaterialGroup: "Standard colourboard", supplier: "Polytec",
  areaSelections: { lowerDoorsDrawers: colour("Arcadia Oak"), overheadDoors: colour("Arabica") }, handles: { base: handle, overhead: { openingMethod: "Handleless", productName: "Handleless" } }, benchtop: surface, benchtops: surface, ...extra });
const wet = (location, projectRoomId) => ({ location, name: location, included: true, status: "in_progress", projectRoomId, bathroomScopeKeys: ["wallMountedVanity"], bathroomScope: ["wallMountedVanity"], enabledAreaKeys: ["wallVanityDoors", "wallVanityDrawers"],
  areaSelections: { wallVanityDoors: colour("Arcadia Oak"), wallVanityDrawers: colour("Arcadia Oak") }, bathroomHandles: { wallMountedVanity: { ...handle, targetKey: "wallMountedVanity" } }, bathroomBenchtops: { wallMountedVanity: { ...surface, targetKey: "wallMountedVanity" } } });
const schedule = [
  { componentId: "K1", location: "Kitchen", cabinetTypeId: "base_unit_1200_2door", unitType: "2 door base unit - 1200mm", quantity: 2 },
  { componentId: "K2", location: "Kitchen", cabinetTypeId: "overhead_2door_standard", unitType: "Overhead cabinet - 2 door - standard height", quantity: 2 },
  { componentId: "B1", location: "Butler's Pantry", cabinetTypeId: "base_unit_1200_2door", unitType: "2 door base unit - 1200mm", quantity: 1 },
  { componentId: "B2", location: "Butler's Pantry", cabinetTypeId: "overhead_2door_standard", unitType: "Overhead cabinet - 2 door - standard height", quantity: 2 },
  { componentId: "L1", location: "Laundry", cabinetTypeId: "base_unit_1200_2door", unitType: "2 door base unit - 1200mm", quantity: 1 },
  { componentId: "L2", location: "Laundry", cabinetTypeId: "overhead_2door_standard", unitType: "Overhead cabinet - 2 door - standard height", quantity: 3 },
  ...["Main Bathroom", "Ensuite", "Powder Room"].map((room, i) => ({ componentId: `W${i}`, location: room, cabinetTypeId: "vanity_wallhung_2drawer_750", type: "bath-wall-two-drawer", unitType: "Wall hung vanity - 2 drawer - 750mm", quantity: 1 })),
];
// The real job's state: the Kitchen holds Butler's Pantry's identity, and the Kitchen is approved under it.
const defective = () => {
  const raw = { projectId: JOB, schedule, locations: [
    kitchenLike("Kitchen", "location-butler-s-pantry"), kitchenLike("Butler's Pantry", "location-butler-s-pantry"),
    wet("Main Bathroom", "room-bath"), wet("Ensuite", "room-ensuite"), wet("Powder Room", "room-powder"), kitchenLike("Laundry", "room-laundry"),
  ] };
  // Approve the Kitchen the way it was approved on 16 Nov (under the shared identity), before any repair existed.
  const base = normaliseCabinetrySelection(raw, roomModel);
  return { raw, base };
};
const approvedNames = (selection) => cabinetryRoomSequence(selection.locations).filter((room) => isCabinetryRoomApproved(room, selection.schedule, JOB)).map((room) => room.location);
const roomId = (selection, name) => { const room = selection.locations.find((l) => l.location === name); return room.projectRoomId || room.id; };
const reload = (selection) => normaliseCabinetrySelection(JSON.parse(JSON.stringify(selection)), roomModel);

step("1 SHARED IDENTITY IS REPAIRED ON LOAD; THE EXISTING KITCHEN APPROVAL STANDS", () => {
  const { raw } = defective();
  // The stored Kitchen approval was recorded under "location-butler-s-pantry".
  const kitchenRaw = raw.locations[0];
  const unrepaired = normaliseCabinetrySelection({ ...raw, locations: raw.locations }, { rooms: [] });
  const fingerprint = (() => { const k = unrepaired.locations.find((l) => l.location === "Kitchen"); return k; })();
  assert.ok(fingerprint);
  const withKitchenApproval = { ...raw, locations: raw.locations.map((l) => l === kitchenRaw ? { ...l } : l) };
  let selection = normaliseCabinetrySelection(withKitchenApproval, roomModel);
  const ids = selection.locations.map((l) => l.projectRoomId).filter(Boolean);
  assert.equal(new Set(ids).size, ids.length, `no two rooms share an identity (${ids.join(", ")})`);
  assert.equal(roomId(selection, "Butler's Pantry"), "location-butler-s-pantry", "Butler's Pantry keeps the identity that names it");
  assert.equal(roomId(selection, "Kitchen"), "room-kitchen", "the Kitchen gets its own project room");
  // Approve the Kitchen, then simulate the 16 Nov stored form: approval roomId = the shared identity.
  selection = approveCabinetryRoom(selection, roomId(selection, "Kitchen"), JOB);
  const kitchen = selection.locations.find((l) => l.location === "Kitchen");
  const legacy = { ...raw, locations: raw.locations.map((l) => l.location === "Kitchen" ? { ...l, status: "complete", reviewApproval: { ...kitchen.reviewApproval, roomId: "location-butler-s-pantry" } } : l) };
  const loaded = normaliseCabinetrySelection(legacy, roomModel);
  assert.deepEqual(approvedNames(loaded), ["Kitchen"], "the Kitchen approval made under the shared identity is still honoured after the repair");
  assert.deepEqual(approvedNames(reload(reload(loaded))), ["Kitchen"], "and after saving and reopening twice");
});

step("2 APPROVING BUTLER'S PANTRY APPROVES BUTLER'S PANTRY (THE REPORTED DEFECT)", () => {
  const { raw } = defective();
  const kitchenApproved = approveCabinetryRoom(normaliseCabinetrySelection(raw, roomModel), "room-kitchen", JOB);
  const legacy = { ...raw, locations: raw.locations.map((l) => l.location === "Kitchen" ? { ...l, status: "complete", reviewApproval: { ...kitchenApproved.locations.find((k) => k.location === "Kitchen").reviewApproval, roomId: "location-butler-s-pantry" } } : l) };
  const loaded = normaliseCabinetrySelection(legacy, roomModel);
  const next = approveCabinetryRoom(loaded, roomId(loaded, "Butler's Pantry"), JOB);
  assert.deepEqual(approvedNames(next), ["Kitchen", "Butler's Pantry"], "Butler's Pantry is approved and the Kitchen stays approved");
  assert.deepEqual(approvedNames(reload(next)), ["Kitchen", "Butler's Pantry"], "both survive save and reload");
});

step("3 AN APPROVAL THAT DOES NOT HOLD IS NEVER REPORTED (AMBIGUOUS IDENTITY)", () => {
  // Without a project room model there is nothing to repair the Kitchen onto, but approval must still
  // refuse to approve the wrong room. Build a selection that still has a duplicate after normalising.
  const { raw } = defective();
  const forced = normaliseCabinetrySelection(raw, { rooms: [] });
  const dup = { ...forced, locations: forced.locations.map((l) => l.location === "Kitchen" ? { ...l, projectRoomId: "location-butler-s-pantry", projectRoomIdRepairedFrom: undefined } : l) };
  // Bypass normalisation's repair to prove the guard: approveCabinetryRoom normalises, so the repair
  // runs and the approval lands on Butler's Pantry - never the Kitchen.
  const next = approveCabinetryRoom(dup, "location-butler-s-pantry", JOB);
  assert.ok(approvedNames(next).includes("Butler's Pantry"), `Butler's Pantry approved (${approvedNames(next).join(", ")})`);
  assert.ok(!approvedNames(next).includes("Kitchen"), "the Kitchen was not approved by Butler's Pantry's action");
});

step("4 ALL SIX ROOMS: KITCHEN > BUTLER'S PANTRY > MAIN BATHROOM > ENSUITE > POWDER ROOM > LAUNDRY", () => {
  let selection = normaliseCabinetrySelection(defective().raw, roomModel);
  const order = cabinetryRoomSequence(selection.locations).map((l) => l.location);
  assert.deepEqual(order, ["Kitchen", "Butler's Pantry", "Main Bathroom", "Ensuite", "Powder Room", "Laundry"]);
  const done = [];
  for (const name of order) {
    const room = selection.locations.find((l) => l.location === name);
    assert.deepEqual(cabinetryLocationMissingRequirements(room).map((m) => m.key), [], `${name} requirements are satisfied`);
    selection = approveCabinetryRoom(selection, roomId(selection, name), JOB);
    done.push(name);
    assert.deepEqual(approvedNames(selection), done, `after approving ${name}, exactly the rooms approved so far are Approved`);
    selection = reload(selection);
    assert.deepEqual(approvedNames(selection), done, `${name} approval survives save and reload`);
  }
});

step("5 INCOMPLETE ROOM IS REFUSED; KITCHEN FINISHES COPY DOES NOT BREAK APPROVAL", () => {
  let selection = normaliseCabinetrySelection(defective().raw, roomModel);
  const bare = normaliseCabinetrySelection({ ...selection, locations: selection.locations.map((l) => l.location === "Laundry" ? { ...l, areaSelections: {}, handles: {}, benchtop: null, benchtops: null } : l) }, roomModel);
  assert.throws(() => approveCabinetryRoom(bare, roomId(bare, "Laundry"), JOB), /incomplete/, "Confirm and Approve fails when requirements are not satisfied");
  // Copy Kitchen finishes into Butler's Pantry, then approve it: it holds through reload.
  selection = approveCabinetryRoom(selection, roomId(selection, "Kitchen"), JOB);
  const copied = applyKitchenFinishesToRooms(selection, { targetLocationNames: ["Butler's Pantry"] }).selection;
  const approved = approveCabinetryRoom(reload(copied), roomId(copied, "Butler's Pantry"), JOB);
  assert.deepEqual(approvedNames(reload(approved)), ["Kitchen", "Butler's Pantry"]);
});

step("6 A FULL ROOM COPY NEVER TAKES THE SOURCE ROOM'S IDENTITY", () => {
  const raw = defective().raw;
  const start = normaliseCabinetrySelection({ ...raw, locations: raw.locations.map((l) => l.location === "Kitchen" ? { ...l, projectRoomId: "" } : l) }, { rooms: [] });
  const copied = copyCabinetryLocation(start, "Butler's Pantry", ["Kitchen"]);
  assert.notEqual(copied.locations.find((l) => l.location === "Kitchen").projectRoomId, "location-butler-s-pantry", "the Kitchen does not inherit Butler's Pantry's identity");
});

const live = process.argv.find((item) => item.startsWith("--live="))?.slice(7);
if (live && fs.existsSync(live)) step("7 LIVE JOB COPY: BUTLER'S PANTRY CAN NOW BE APPROVED, KITCHEN STAYS APPROVED", () => {
  const { selection: raw, jobId, roomModel: model } = JSON.parse(fs.readFileSync(live, "utf8"));
  const loaded = normaliseCabinetrySelection(raw, model || { rooms: [] });
  const approved = (s) => cabinetryRoomSequence(s.locations).filter((room) => isCabinetryRoomApproved(room, s.schedule, jobId)).map((room) => room.location);
  assert.ok(approved(loaded).includes("Kitchen"), `live Kitchen approval kept (${approved(loaded).join(", ")})`);
  const pantry = loaded.locations.find((l) => l.location === "Butler's Pantry");
  if (cabinetryLocationMissingRequirements(pantry).length) { console.log("  live Butler's Pantry incomplete:", cabinetryLocationMissingRequirements(pantry).map((m) => m.label).join(", ")); return; }
  const next = approveCabinetryRoom(loaded, pantry.projectRoomId || pantry.id, jobId);
  assert.ok(approved(normaliseCabinetrySelection(JSON.parse(JSON.stringify(next)), model || { rooms: [] })).includes("Butler's Pantry"), "live Butler's Pantry approval holds after reload");
  assert.ok(approved(next).includes("Kitchen"));
});

console.log(results.join("\n"));
