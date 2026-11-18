// Cabinetry handles never trap a room: a handle picked in the Handles step (opening method /
// product) completes it, and the builder can take over items that block approval.
//   node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-client-selections-cabinetry-handles.mjs
import assert from "node:assert/strict";
import {
  approveCabinetryRoom, cabinetryBuilderConfirmedItems, cabinetryHandleChosen, cabinetryLocationMissingRequirements,
  cabinetrySpecificationRevision, isCabinetryRoomApproved, normaliseCabinetrySelection,
} from "../lib/builders/cabinetryWorkflow.js";

const jobId = "job-handles";
const bathroom = (fields = {}) => ({ id: "room-main-bathroom", projectRoomId: "room-main-bathroom", location: "Main Bathroom", name: "Main Bathroom", included: true,
  enabledAreaKeys: ["floorVanityDoors"], bathroomScopeKeys: ["wallMountedVanity", "tallLinenCupboard"], ...fields });
const selectionFor = (location) => normaliseCabinetrySelection({ projectId: jobId, locations: [location], schedule: [] });
const roomOf = (location) => selectionFor(location).locations[0];
const handleKeys = (location) => cabinetryLocationMissingRequirements(roomOf(location)).filter((item) => item.key.startsWith("handles:")).map((item) => item.key);

// 1. What the Handles step saves counts as a chosen handle.
assert.equal(cabinetryHandleChosen({ targetKey: "wallMountedVanity", openingMethod: "Finger pull", productName: "Finger pull", priceStatus: "price_pending" }), true);
assert.equal(cabinetryHandleChosen({ targetKey: "wallMountedVanity", priceStatus: "price_pending" }), false);
assert.equal(cabinetryHandleChosen(null), false);

// 2. The "Wall-mounted vanity handles" blocker clears once a handle is picked.
assert.deepEqual(handleKeys(bathroom()), ["handles:wallMountedVanity", "handles:tallLinenCupboard"]);
const picked = bathroom({ bathroomHandles: {
  wallMountedVanity: { targetKey: "wallMountedVanity", openingMethod: "Finger pull", productName: "Finger pull", priceStatus: "price_pending" },
  tallLinenCupboard: { targetKey: "tallLinenCupboard", openingMethod: "Push-to-open", productName: "Push-to-open", priceStatus: "price_pending" },
} });
assert.deepEqual(handleKeys(picked), [], "picked handles are recognised");

// 3. Builder takes over the remaining items: they stop blocking, are listed, and the room can be approved.
const outstanding = cabinetryLocationMissingRequirements(roomOf(picked));
const takenOver = bathroom({ ...picked, builderConfirmItems: outstanding.map(({ key, label, stage }) => ({ key, label, stage, by: "builder", at: "2026-11-10T00:00:00.000Z" })) });
assert.deepEqual(cabinetryLocationMissingRequirements(roomOf(takenOver)), []);
assert.deepEqual(cabinetryBuilderConfirmedItems(roomOf(takenOver)).map((item) => item.key), outstanding.map((item) => item.key));
const approved = approveCabinetryRoom(selectionFor(takenOver), "room-main-bathroom", jobId);
assert(isCabinetryRoomApproved(approved.locations[0], approved.schedule, jobId), "approved with builder-confirmed items");
// Handing an item back needs a fresh approval.
const handedBack = normaliseCabinetrySelection({ ...approved, locations: [{ ...approved.locations[0], builderConfirmItems: [] }] });
assert(!isCabinetryRoomApproved(handedBack.locations[0], handedBack.schedule, jobId), "undoing a takeover withdraws approval");

// 4. Once the item is actually chosen, the builder note drops away by itself.
if (outstanding.length) assert.ok(cabinetryBuilderConfirmedItems(roomOf({ ...takenOver, builderConfirmItems: [{ key: "handles:wallMountedVanity", label: "x" }] })).length === 0, "a chosen handle is not listed as builder-confirmed");

// 5. Rooms approved before this change keep their approval (no new field in the revision).
const plain = roomOf(picked);
assert.equal(cabinetrySpecificationRevision(plain, []), cabinetrySpecificationRevision({ ...plain, builderConfirmItems: [] }, []));
assert.equal("builderConfirmItems" in plain, false);

console.log("cabinetry handles: picked handles complete the room; builder can take over blockers; approvals unchanged");
