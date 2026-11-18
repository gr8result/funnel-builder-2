// Cabinetry room contamination (16 Nov 2026), on a read-only copy of the real job.
// Reported: "while reviewing Kitchen cabinetry, the benchtop selector displayed Butler's Pantry".
// Causes found:
//  1. Copying Kitchen colours put the Kitchen's island bench back into Butler's Pantry's scope, so
//     the Pantry listed an "Island benchtop" (islandEvidence reads the room's scope).
//  2. "Copy complete specification" copied the source's benchtop areas with their names, so Kitchen
//     listed "Butler's Pantry benchtop" after a copy from the Pantry; it also kept no record of the
//     specification it replaced, and carried the source room's approval.
//   node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-cabinetry-room-contamination.mjs [--job=<file.gr8job>]
import assert from "node:assert/strict";
import fs from "node:fs";
import JSZip from "jszip";
import { applyKitchenColoursToButlersPantry, applyRoomColoursToTargets, colourCopyAreaAllowed, copiedIslandBenchBack, copyCabinetryLocation, normaliseCabinetrySelection, removeCopiedIslandBenchBack } from "../lib/builders/cabinetryWorkflow.js";
import { benchtopAreasFor, islandEvidence } from "../lib/builders/benchtopSelection.js";
import { projectRoomModel } from "../lib/builders/projectRoomModel.js";

const file = process.argv.find((item) => item.startsWith("--job="))?.slice(6) || process.env.CLIENT_SELECTIONS_JOB_FILE || "E:/dev/quotation-recovery-20261108/restored/New Job 03 09 LATEST VERSION 11-11.gr8job";
assert(fs.existsSync(file), `real job copy not found: ${file}`);
const workbook = JSON.parse(await (await JSZip.loadAsync(fs.readFileSync(file))).file("estimate.json").async("string")).workbook;
const saved = workbook.clientSelectionsBook.rooms.flatMap((room) => room.rows || []).find((row) => row.guidedSelection?.cabinetrySelection).guidedSelection.cabinetrySelection;
const model = projectRoomModel(workbook.clientSelectionsBook, workbook);
const room = (selection, name) => selection.locations.find((location) => location.location === name);
const linesOf = (selection, name) => selection.schedule.filter((line) => line.location === name);
const areaLabels = (selection, name) => benchtopAreasFor(room(selection, name), { scheduleLines: linesOf(selection, name), workbook }).map((area) => area.label);

// The real Kitchen has an island bench back (its colour is Arcadia Oak).
const base = normaliseCabinetrySelection(saved, model);
assert.ok(room(base, "Kitchen").enabledAreaKeys.includes("islandBenchBack"), "fixture: the real Kitchen has an island bench back");

// The real Butler's Pantry, as it was before any colour copy: its own scope, no island.
const withoutIsland = (selections) => Object.fromEntries(Object.entries(selections || {}).filter(([key]) => key !== "islandBenchBack"));
const pantryScope = room(base, "Butler's Pantry").enabledAreaKeys.filter((key) => key !== "islandBenchBack");
const clean = normaliseCabinetrySelection({ ...base, locations: base.locations.map((location) => location.location === "Butler's Pantry"
  ? { ...location, enabledAreaKeys: pantryScope, scope: pantryScope, areaSelections: withoutIsland(location.areaSelections),
      coloursAndFinishes: { ...(location.coloursAndFinishes || {}), areaSelections: withoutIsland(location.coloursAndFinishes?.areaSelections) }, benchtopAreas: (location.benchtopAreas || []).filter((area) => !/island/i.test(area.label)) }
  : location) }, model);
assert.equal(islandEvidence(room(clean, "Butler's Pantry"), { scheduleLines: linesOf(clean, "Butler's Pantry"), workbook }), "", "fixture: the Pantry has no island before the copy");

// 1a. "Apply Kitchen Colours to Other Rooms" -> Butler's Pantry.
const { selection: afterRooms, skippedSummary } = applyRoomColoursToTargets(clean, { sourceLocationName: "Kitchen", targetLocationNames: ["Butler's Pantry"] });
assert.ok(!room(afterRooms, "Butler's Pantry").enabledAreaKeys.includes("islandBenchBack"), "copying Kitchen colours does not add an island bench back to the Pantry");
assert.ok(!areaLabels(afterRooms, "Butler's Pantry").some((label) => /island/i.test(label)), "the Pantry lists no Island benchtop after the copy");
assert.ok((skippedSummary["Butler's Pantry"] || []).includes("islandBenchBack"), "the island colour is reported as not part of the Pantry");
assert.deepEqual(linesOf(afterRooms, "Butler's Pantry").map((line) => [line.componentId, line.quantity]), linesOf(clean, "Butler's Pantry").map((line) => [line.componentId, line.quantity]), "copying colours never changes the Pantry cabinet schedule or quantities");
// 1b. "Apply Kitchen Colours to Butler's Pantry" (the dedicated modal), every area ticked.
const afterModal = applyKitchenColoursToButlersPantry(clean, { areaKeys: Object.keys(room(clean, "Kitchen").areaSelections || {}), overwrite: true });
assert.ok(!room(afterModal, "Butler's Pantry").enabledAreaKeys.includes("islandBenchBack"), "the Kitchen -> Pantry modal does not add an island either");
assert.ok(!areaLabels(afterModal, "Butler's Pantry").some((label) => /island/i.test(label)), "no Island benchtop in the Pantry after the modal copy");
// 1c. A brand-new room may take the common areas, never an island.
assert.equal(colourCopyAreaAllowed({ enabledAreaKeys: [] }, "lowerDoorsDrawers"), true);
assert.equal(colourCopyAreaAllowed({ enabledAreaKeys: [] }, "islandBenchBack"), false);
assert.equal(colourCopyAreaAllowed({ enabledAreaKeys: ["lowerDoorsDrawers"] }, "bulkheads"), true, "bulkhead / kick-panel finishes are carried by every room");

// 2. "Copy complete specification" never copies into the Kitchen (17 Nov 2026 owner rule: the Kitchen is the
// master room). Into another room (Laundry) it renames the source's named benchtop and keeps the target identity.
const pantryNamed = normaliseCabinetrySelection({ ...clean, locations: clean.locations.map((location) => location.location === "Butler's Pantry" ? { ...location, benchtopAreas: [{ id: "benchtop-main", label: "Butler's Pantry benchtop", lengthMm: 3000, depthMm: 600, source: "manual", surface: null }] } : location) }, model);
const intoKitchen = copyCabinetryLocation(pantryNamed, "Butler's Pantry", ["Kitchen"]);
assert.deepEqual(room(intoKitchen, "Kitchen"), room(pantryNamed, "Kitchen"), "a copy into the Kitchen is refused - the Kitchen is unchanged");
assert.deepEqual(intoKitchen.schedule.filter((line) => line.location === "Kitchen"), pantryNamed.schedule.filter((line) => line.location === "Kitchen"), "no Butler's Pantry cabinets enter the Kitchen");
const target = "Laundry";
const targetBefore = room(pantryNamed, target);
const copied = copyCabinetryLocation(pantryNamed, "Butler's Pantry", [target]);
const targetAfter = room(copied, target);
assert.ok(!areaLabels(copied, target).some((label) => /butler/i.test(label)), `${target} never lists a Butler's Pantry benchtop after a copy (got ${areaLabels(copied, target).join(", ")})`);
assert.ok(areaLabels(copied, target).includes("Laundry benchtop"), `the copied area is named for the ${target} (got ${areaLabels(copied, target).join(", ")})`);
assert.equal(targetAfter.reviewApproval, null, "a replaced specification is not left approved");
assert.equal(targetAfter.copiedFromLocation, "Butler's Pantry");
assert.equal(targetAfter.projectRoomId || targetAfter.id, targetBefore.projectRoomId || targetBefore.id, `the ${target} keeps its own room identity`);
const audit = copied.audit.at(-1);
assert.equal(audit.action, "copy_location_selections");
assert.equal(audit.replaced?.[0]?.location, target, `the replaced ${target} specification is kept in the audit history`);
assert.deepEqual(audit.replaced[0].specification.areaSelections, targetBefore.areaSelections, `the audit holds the ${target}'s own previous colours`);
assert.equal(room(copied, "Butler's Pantry").location, "Butler's Pantry", "the source room is unchanged");

// 3. The real Pantry (island already copied in): unticking Island bench back removes the Island benchtop,
// even though the copied island colour is still stored on the room.
const realPantry = room(base, "Butler's Pantry");
assert.ok(realPantry.areaSelections?.islandBenchBack, "fixture: the real Pantry still holds the copied island colour");
const unticked = { ...realPantry, enabledAreaKeys: realPantry.enabledAreaKeys.filter((key) => key !== "islandBenchBack"), scope: realPantry.enabledAreaKeys.filter((key) => key !== "islandBenchBack") };
assert.equal(islandEvidence(unticked, { scheduleLines: linesOf(base, "Butler's Pantry"), workbook }), "", "an unticked island bench back is not island evidence, whatever colour is left on the room");
assert.ok(islandEvidence({ ...realPantry, enabledAreaKeys: [], scope: [] }, { scheduleLines: [], workbook }), "a legacy room with no scope list still reads its island colour");

// 4. Repair of the real job: the copied island is flagged in Butler's Pantry and Laundry (never in the
// Kitchen), and removing it takes the Island benchtop with it, leaves the schedule alone and is audited.
for (const name of ["Butler's Pantry", "Laundry"]) assert.equal(copiedIslandBenchBack(room(base, name), base.schedule), true, `${name}: copied island flagged`);
assert.equal(copiedIslandBenchBack(room(base, "Kitchen"), base.schedule), false, "the Kitchen's own island is never flagged");
const repaired = removeCopiedIslandBenchBack(base, "Butler's Pantry");
assert.ok(!room(repaired, "Butler's Pantry").enabledAreaKeys.includes("islandBenchBack"));
assert.ok(!room(repaired, "Butler's Pantry").areaSelections?.islandBenchBack, "the copied island colour is removed");
assert.ok(!areaLabels(repaired, "Butler's Pantry").some((label) => /island/i.test(label)), "no Island benchtop after the repair");
assert.ok(areaLabels(repaired, "Butler's Pantry").includes("Butler's Pantry benchtop"), "the Pantry keeps its own benchtop");
assert.deepEqual(linesOf(repaired, "Butler's Pantry"), linesOf(base, "Butler's Pantry"), "the repair never changes the cabinet schedule");
assert.ok(room(repaired, "Kitchen").enabledAreaKeys.includes("islandBenchBack"), "the Kitchen island is untouched");
assert.equal(repaired.audit.at(-1).action, "remove_copied_island_bench_back");
assert.equal(copiedIslandBenchBack(room(repaired, "Butler's Pantry"), repaired.schedule), false, "nothing left to flag");

console.log("cabinetry room contamination: Kitchen colours never add an island to Butler's Pantry; a complete copy never names the source room's benchtop in Kitchen, withdraws approval and keeps the replaced specification");
