// Client Selections cabinetry defects (18 Nov 2026 owner brief), on synthetic rooms and - when given -
// a read-only copy of the real job (New Job 03/09):
//  1. Kitchen island: no "copied island" warning for the Kitchen; the builder marks which ordinary
//     cabinets stand in the island; the island benchtop and finishes are kept; no extra charge; the
//     client's approval stands. A genuinely copied island (Laundry) is still flagged.
//  2. Builder-only facts (island count, edge construction) never withdraw a client approval.
//  3. Wall-mounted -> floor-mounted vanity: colours, handle, stone and its thickness / basin carry
//     over onto the new vanity, one benchtop only, nothing the new vanity has is replaced.
//  4. "Match floor-mounted vanity" on the floor vanity itself is not a colour.
//  5. Main Bathroom finishes -> Ensuite: wall-vanity finishes reach a floor-mounted vanity; existing
//     finishes are only replaced on request; cabinets, quantities and benchtop sizes never change.
//  6. The real Ensuite can be approved once the Main Bathroom finishes are applied.
//  7. Quotation Builder: island count and edge construction are builder actions; no duplicate rows.
//   node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-client-selections-cabinetry-defects-20261118.mjs [--live=<job.json>]
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  applyRoomFinishesToRooms, cabinetryIslandConfiguration, cabinetryLocationMissingRequirements, copiedIslandBenchBack,
  isCabinetryRoomApproved, normaliseCabinetrySelection, roomFinishesCopyVerified, setCabinetryIslandQuantity,
  approveCabinetryRoom,
} from "../lib/builders/cabinetryWorkflow.js";
import { applyCabinetryRequirementsToQuotation, cabinetryQuotationBriefs, cabinetryWetAreaTag, updateCabinetrySelectionRequirement } from "../lib/construction-estimation/cabinetryRequirements.js";
// A bathroom line as the Cabinet Schedule saves it: with its wet-area tag (the scope comes from it).
const wetLine = (componentId, location, cabinetTypeId, quantity) => ({ componentId, location, cabinetTypeId, quantity, type: cabinetryWetAreaTag(cabinetTypeId) });

const results = [];
const step = (name, fn) => { try { fn(); results.push(`${name}: PASS`); } catch (error) { results.push(`${name}: FAIL`); console.error(`FAIL ${name}: ${error.message}`); if (error.actual !== undefined) console.error(error); process.exitCode = 1; } };
const room = (selection, name) => selection.locations.find((location) => location.location === name);
const colour = (id, name) => ({ id, colourName: name, supplier: "Polytec", productRange: "Decorative 18mm doors and panels", finish: "Woodmatt" });
const stone = (id, name) => ({ supplier: "Caesarstone", productId: id, colourName: name, materialChoice: "stone", category: "Stone, Porcelain & Sintered Benchtops", slabThickness: "20mm", slabThicknessOptions: ["20mm"] });

step("1 KITCHEN ISLAND MADE OF ORDINARY CABINETS - NO WARNING, MARKED BY THE BUILDER, NO EXTRA LINE", () => {
  const selection = normaliseCabinetrySelection({ schedule: [
    { componentId: "k1", location: "Kitchen", cabinetTypeId: "drawer_base_3", quantity: 3 },
    { componentId: "k2", location: "Kitchen", cabinetTypeId: "short_end_panel", quantity: 2 },
    { componentId: "l1", location: "Laundry", cabinetTypeId: "base_unit_1200_2door", quantity: 1 },
  ], locations: [
    { location: "Kitchen", included: true, enabledAreaKeys: ["lowerDoorsDrawers", "islandBenchBack"], areaSelections: { lowerDoorsDrawers: colour("oak", "Oak"), islandBenchBack: colour("oak", "Oak") },
      coloursAndFinishes: { colourSourceAppliedAreaKeys: ["islandBenchBack"] },
      benchtopAreas: [{ id: "benchtop-main", label: "Main benchtop", surface: stone("cs", "Cloudburst"), fabrication: { thicknessMm: 40, edgeConstruction: "mitred" } }, { id: "benchtop-island", label: "Island benchtop", depthMm: 900, surface: stone("cs", "Cloudburst"), sameAsMain: true, fabrication: { thicknessMm: 60, edgeConstruction: "mitred" } }] },
    { location: "Laundry", included: true, enabledAreaKeys: ["lowerDoorsDrawers", "islandBenchBack"], areaSelections: { lowerDoorsDrawers: colour("oak", "Oak"), islandBenchBack: colour("oak", "Oak") }, coloursAndFinishes: { kitchenColourAppliedAreaKeys: ["islandBenchBack"] } },
  ] });
  assert.equal(copiedIslandBenchBack(room(selection, "Kitchen"), selection.schedule), false, "the Kitchen's own island is never reported as copied");
  assert.equal(copiedIslandBenchBack(room(selection, "Laundry"), selection.schedule), true, "an island bench back copied into the Laundry is still flagged");
  const before = cabinetryIslandConfiguration(room(selection, "Kitchen"), selection.schedule);
  assert.equal(before.hasIsland, true); assert.equal(before.identified, false);
  let tagged = setCabinetryIslandQuantity(selection, "k1", 2);
  tagged = setCabinetryIslandQuantity(tagged, "k2", 2);
  const island = cabinetryIslandConfiguration(room(tagged, "Kitchen"), tagged.schedule);
  assert.deepEqual(island.cabinets.map((item) => [item.componentId, item.quantity]), [["k1", 2]]);
  assert.deepEqual(island.endPanels.map((item) => [item.componentId, item.quantity]), [["k2", 2]]);
  assert.equal(island.benchtop?.id, "benchtop-island", "the island benchtop belongs to the island and is kept");
  assert.equal(room(tagged, "Kitchen").benchtopAreas.length, 2, "nothing deleted");
  assert.deepEqual(tagged.schedule.map((line) => [line.componentId, line.quantity]), selection.schedule.map((line) => [line.componentId, line.quantity]), "no line added, no quantity changed");
  assert.equal(setCabinetryIslandQuantity(tagged, "k1", 9).schedule.find((line) => line.componentId === "k1").islandQuantity, 3, "never more in the island than in the room");
  assert.equal(setCabinetryIslandQuantity(tagged, "k1", 0).schedule.find((line) => line.componentId === "k1").islandQuantity, undefined, "0 takes the line out of the island");
  assert.equal(copiedIslandBenchBack(room(setCabinetryIslandQuantity(selection, "l1", 1), "Laundry"), setCabinetryIslandQuantity(selection, "l1", 1).schedule), false, "a room whose island cabinets are identified is reconciled");
});

step("2 BUILDER-ONLY FACTS NEVER WITHDRAW THE CLIENT'S APPROVAL", () => {
  const base = normaliseCabinetrySelection({ projectId: "job-1", schedule: [{ componentId: "k1", location: "Kitchen", cabinetTypeId: "drawer_base_3", quantity: 2 }], locations: [
    { location: "Kitchen", included: true, projectRoomId: "room-k", enabledAreaKeys: ["lowerDoorsDrawers"], areaSelections: { lowerDoorsDrawers: colour("oak", "Oak") }, handles: { base: { productName: "Sharkfin", openingMethod: "Sharkfin" } }, benchtop: stone("cs", "Cloudburst"),
      benchtopAreas: [{ id: "benchtop-main", label: "Main benchtop", surface: stone("cs", "Cloudburst"), fabrication: { thicknessMm: 40, edgeConstruction: "mitred" } }] },
  ] });
  const approved = approveCabinetryRoom(base, "room-k", "job-1");
  const ok = (selection) => isCabinetryRoomApproved(room(selection, "Kitchen"), selection.schedule, "job-1");
  assert.equal(ok(approved), true, "approved");
  assert.equal(ok(setCabinetryIslandQuantity(approved, "k1", 1)), true, "an island count is the builder's, not the client's");
  const constructed = normaliseCabinetrySelection({ ...approved, locations: approved.locations.map((location) => ({ ...location, benchtopAreas: location.benchtopAreas.map((area) => ({ ...area, fabrication: { ...area.fabrication, edgeConstruction: "full" } })) })) });
  assert.equal(ok(constructed), true, "the stone's edge construction is the builder's, not the client's");
  const rethick = normaliseCabinetrySelection({ ...approved, locations: approved.locations.map((location) => ({ ...location, benchtopAreas: location.benchtopAreas.map((area) => ({ ...area, fabrication: { ...area.fabrication, thicknessMm: 20 } })) })) });
  assert.equal(ok(rethick), false, "the finished thickness is the client's choice: changing it needs approving again");
});

const wallEnsuite = () => ({ location: "Ensuite", included: true, enabledAreaKeys: ["floorVanityDoors", "floorVanityDrawers"],
  areaSelections: { wallVanityDoors: colour("blonde", "Blonde Oak"), wallVanityDrawers: colour("blonde", "Blonde Oak"),
    floorVanityDoors: { id: "floorVanityDoors-match_floor_vanity", areaKey: "floorVanityDoors", colourName: "Match floor-mounted vanity", finish: "Match floor-mounted vanity", finishMode: "match_floor_vanity" } },
  bathroomHandles: { wallMountedVanity: { targetKey: "wallMountedVanity", productName: "Sharkfin", openingMethod: "Sharkfin" } },
  bathroomBenchtops: { wallMountedVanity: { ...stone("eclipse", "Eclipse"), targetKey: "wallMountedVanity" } },
  benchtopAreas: [{ id: "wallMountedVanity", label: "Wall-mounted vanity benchtop", lengthMm: 1200, depthMm: 600, surface: stone("eclipse", "Eclipse"), fabrication: { thicknessMm: 20, edgeConstruction: "full", vanityDepthMm: 460, basinType: "Semi-recessed", dropFrontMm: 150 } }] });

step("3 WALL-MOUNTED -> FLOOR-MOUNTED VANITY CARRIES THE CHOICES, ONE BENCHTOP, NOTHING DUPLICATED", () => {
  const selection = normaliseCabinetrySelection({ schedule: [wetLine("e1", "Ensuite", "vanity_floor_2door_1200", 1)], locations: [wallEnsuite()] });
  const ensuite = room(selection, "Ensuite");
  assert.deepEqual(ensuite.bathroomScopeKeys, ["floorMountedVanity"], "the schedule now says floor-mounted");
  assert.equal(ensuite.areaSelections.floorVanityDoors?.colourName, "Blonde Oak", "door colour carried (the self-referring placeholder did not block it)");
  assert.equal(ensuite.areaSelections.floorVanityDrawers?.colourName, "Blonde Oak");
  assert.equal(ensuite.areaSelections.wallVanityDoors, null, "obsolete wall-vanity slot emptied once carried");
  assert.equal(ensuite.bathroomHandles.floorMountedVanity?.productName, "Sharkfin"); assert.equal(ensuite.bathroomHandles.wallMountedVanity, undefined);
  assert.equal(ensuite.bathroomBenchtops.floorMountedVanity?.colourName, "Eclipse");
  assert.equal(ensuite.benchtopAreas.length, 1, "one vanity benchtop, not two");
  const [area] = ensuite.benchtopAreas;
  assert.equal(area.id, "floorMountedVanity"); assert.equal(area.surface.colourName, "Eclipse");
  assert.deepEqual([area.fabrication.thicknessMm, area.fabrication.basinType, area.fabrication.dropFrontMm, area.lengthMm], [20, "Semi-recessed", 150, 1200], "thickness, basin, drop-front and size kept");
  assert.deepEqual(cabinetryLocationMissingRequirements(ensuite).map((item) => item.key), [], "nothing new is asked for: every requirement is met by a carried choice");
  assert.deepEqual(normaliseCabinetrySelection(selection).locations.map((l) => JSON.parse(JSON.stringify(l))), JSON.parse(JSON.stringify(selection.locations)), "idempotent");
  // A real choice the new vanity already has is never replaced.
  const own = wallEnsuite(); own.areaSelections.floorVanityDoors = colour("white", "Classic White");
  const kept = room(normaliseCabinetrySelection({ schedule: [wetLine("e1", "Ensuite", "vanity_floor_2door_1200", 1)], locations: [own] }), "Ensuite");
  assert.equal(kept.areaSelections.floorVanityDoors.colourName, "Classic White");
  assert.equal(kept.areaSelections.floorVanityDrawers.colourName, "Blonde Oak");
});

step("4 'MATCH FLOOR-MOUNTED VANITY' ON THE FLOOR VANITY ITSELF IS NOT A COLOUR", () => {
  const match = { colourName: "Match floor-mounted vanity", finishMode: "match_floor_vanity" };
  const only = normaliseCabinetrySelection({ schedule: [wetLine("e1", "Ensuite", "vanity_floor_2door_1200", 1)], locations: [{ location: "Ensuite", included: true, enabledAreaKeys: ["floorVanityDoors", "floorVanityDrawers"], areaSelections: { floorVanityDoors: match, floorVanityDrawers: match } }] });
  assert.deepEqual(cabinetryLocationMissingRequirements(room(only, "Ensuite")).filter((item) => item.key.startsWith("colour:")).map((item) => item.key), ["colour:floorVanityDoors", "colour:floorVanityDrawers"]);
  const drawersMatchDoors = normaliseCabinetrySelection({ schedule: [wetLine("e1", "Ensuite", "vanity_floor_2door_1200", 1)], locations: [{ location: "Ensuite", included: true, enabledAreaKeys: ["floorVanityDoors", "floorVanityDrawers"], areaSelections: { floorVanityDoors: colour("oak", "Oak"), floorVanityDrawers: match } }] });
  assert.deepEqual(cabinetryLocationMissingRequirements(room(drawersMatchDoors, "Ensuite")).filter((item) => item.key.startsWith("colour:")), [], "drawers matching doors that have a colour is complete");
});

step("5 MAIN BATHROOM FINISHES -> ENSUITE (FLOOR-MOUNTED), REPLACE ONLY ON REQUEST", () => {
  const selection = normaliseCabinetrySelection({ schedule: [
    wetLine("b1", "Main Bathroom", "vanity_wallhung_2door_1200", 1),
    wetLine("e1", "Ensuite", "vanity_floor_2door_1200", 2),
    wetLine("e2", "Ensuite", "vanity_floor_2drawer_600", 1),
  ], locations: [
    { location: "Kitchen", included: true, enabledAreaKeys: ["lowerDoorsDrawers"], areaSelections: { lowerDoorsDrawers: colour("oak", "Oak") } },
    { location: "Main Bathroom", included: true, enabledAreaKeys: ["wallVanityDoors", "wallVanityDrawers"], doorMaterialGroup: "Standard colourboard", areaSelections: { wallVanityDoors: colour("blonde", "Blonde Oak"), wallVanityDrawers: colour("blonde", "Blonde Oak") },
      bathroomHandles: { wallMountedVanity: { productName: "Sharkfin", openingMethod: "Sharkfin" } },
      benchtopAreas: [{ id: "wallMountedVanity", label: "Wall-mounted vanity benchtop", surface: stone("eclipse", "Eclipse"), fabrication: { thicknessMm: 40, edgeConstruction: "mitred", vanityDepthMm: 350, basinType: "Undermount", dropFrontMm: 200 } }] },
    { location: "Ensuite", included: true, enabledAreaKeys: ["floorVanityDoors", "floorVanityDrawers"], doorMaterialGroup: "Premium laminate", areaSelections: { floorVanityDoors: colour("white", "Classic White") },
      benchtopAreas: [{ id: "floorMountedVanity", label: "Floor-mounted vanity benchtop", lengthMm: 3000, depthMm: 600, surface: null, fabrication: { thicknessMm: 20, vanityDepthMm: 500, basinType: "Above-counter" } }] },
  ] });
  const fill = applyRoomFinishesToRooms(selection, { sourceLocationName: "Main Bathroom", targetLocationNames: ["Ensuite", "Kitchen"] });
  const e1 = room(fill.selection, "Ensuite");
  assert.equal(e1.areaSelections.floorVanityDoors.colourName, "Classic White", "an existing colour is not replaced without asking");
  assert.equal(e1.areaSelections.floorVanityDrawers.colourName, "Blonde Oak", "the empty drawer slot takes the wall-vanity colour");
  assert.ok(fill.filledSummary.Ensuite.some((item) => /doors colour/.test(item)), "the screen is told what the Ensuite already has, to offer Replace");
  assert.equal(e1.benchtopAreas[0].surface.colourName, "Eclipse", "stone copied");
  assert.deepEqual([e1.benchtopAreas[0].fabrication.thicknessMm, e1.benchtopAreas[0].fabrication.vanityDepthMm, e1.benchtopAreas[0].fabrication.basinType, e1.benchtopAreas[0].fabrication.dropFrontMm, e1.benchtopAreas[0].lengthMm], [20, 500, "Above-counter", "", 3000], "the Ensuite's thickness, depth, basin and size are its own");
  assert.equal(e1.bathroomHandles.floorMountedVanity.productName, "Sharkfin", "handle mapped wall -> floor");
  assert.deepEqual(room(fill.selection, "Kitchen").areaSelections.lowerDoorsDrawers.colourName, "Oak", "the Kitchen is never a target");
  const replace = applyRoomFinishesToRooms(selection, { sourceLocationName: "Main Bathroom", targetLocationNames: ["Ensuite"], overwrite: true });
  const e2 = room(replace.selection, "Ensuite");
  assert.equal(e2.areaSelections.floorVanityDoors.colourName, "Blonde Oak", "Replace uses the Main Bathroom colour");
  assert.equal(e2.doorMaterialGroup, "Standard colourboard", "with its door material");
  assert.deepEqual(replace.selection.schedule.filter((line) => line.location === "Ensuite").map((line) => [line.cabinetTypeId, line.quantity]), [["vanity_floor_2door_1200", 2], ["vanity_floor_2drawer_600", 1]], "cabinets and quantities unchanged");
  assert.deepEqual(e2.bathroomScopeKeys, ["floorMountedVanity"], "vanity configuration unchanged");
  assert.deepEqual(roomFinishesCopyVerified(replace.selection, { sourceLocationName: "Main Bathroom", appliedSummary: replace.appliedSummary }), { Ensuite: true });
  const nothing = applyRoomFinishesToRooms(replace.selection, { sourceLocationName: "Main Bathroom", targetLocationNames: ["Ensuite"] });
  assert.deepEqual(nothing.appliedSummary.Ensuite, [], "a second copy with nothing to fill applies nothing (and so reports nothing as applied)");
});

const liveFile = process.argv.find((item) => item.startsWith("--live="))?.slice(7) || process.env.CLIENT_SELECTIONS_JOB_FILE || "";
if (liveFile && fs.existsSync(liveFile)) {
  const job = JSON.parse(fs.readFileSync(liveFile, "utf8"));
  const workbook = job.workbook || job;
  const row = workbook.clientSelectionsBook.rooms.flatMap((r) => r.rows || []).find((r) => r.guidedSelection?.cabinetrySelection);
  const jobId = workbook.jobId || "recovered-03-09-123";
  const withSelection = (selection) => ({ ...workbook, clientSelectionsBook: { ...workbook.clientSelectionsBook, rooms: workbook.clientSelectionsBook.rooms.map((r) => ({ ...r, rows: (r.rows || []).map((item) => (item === row ? { ...item, guidedSelection: { ...item.guidedSelection, cabinetrySelection: selection } } : item)) })) } });
  const live = normaliseCabinetrySelection({ ...row.guidedSelection.cabinetrySelection, projectId: jobId });

  step("6 REAL JOB: KITCHEN ISLAND, ENSUITE CONVERSION AND MAIN BATHROOM COPY; ENSUITE APPROVES", () => {
    const kitchen = room(live, "Kitchen");
    assert.equal(copiedIslandBenchBack(kitchen, live.schedule), false, "no misleading island warning in the Kitchen");
    assert.ok(kitchen.benchtopAreas.some((area) => area.id === "benchtop-island" && area.surface), "the Kitchen island benchtop is intact");
    for (const name of ["Kitchen", "Main Bathroom", "Butler's Pantry"]) assert.equal(isCabinetryRoomApproved(room(live, name), live.schedule, jobId), true, `${name} approval kept`);
    const ensuite = room(live, "Ensuite");
    assert.deepEqual(ensuite.bathroomScopeKeys, ["floorMountedVanity", "mirroredShavingCabinet"]);
    assert.equal(ensuite.benchtopAreas.length, 1, "one vanity benchtop");
    assert.deepEqual(cabinetryLocationMissingRequirements(ensuite).map((item) => item.key), ["benchtop:floorMountedVanity"], "only the stone the Ensuite never had is asked for");
    // Kitchen -> Ensuite fills only its handles / stone; the old "Bathroom" copy markers on the Ensuite
    // (wallVanity*) must not make the check report a saved copy as failed.
    const fromKitchen = applyRoomFinishesToRooms(live, { sourceLocationName: "Kitchen", targetLocationNames: ["Ensuite", "Powder Room", "Laundry"] });
    const appliedRooms = Object.entries(fromKitchen.appliedSummary).filter(([, items]) => items.length).map(([name]) => name);
    const verifiedRooms = roomFinishesCopyVerified(fromKitchen.selection, { sourceLocationName: "Kitchen", appliedSummary: fromKitchen.appliedSummary });
    for (const name of appliedRooms) assert.equal(verifiedRooms[name], true, `Kitchen copy to ${name} verified (${fromKitchen.appliedSummary[name]})`);
    // Without Replace: the Ensuite keeps its own colours and material, and Replace names both.
    const preview = applyRoomFinishesToRooms(live, { sourceLocationName: "Main Bathroom", targetLocationNames: ["Ensuite"] });
    assert.ok(preview.filledSummary.Ensuite.includes("Door material (Premium laminate)"), `Replace names the material change (${preview.filledSummary.Ensuite})`);
    assert.equal(room(preview.selection, "Ensuite").doorMaterialGroup, "Premium laminate", "no material change without Replace");
    const copy = applyRoomFinishesToRooms(live, { sourceLocationName: "Main Bathroom", targetLocationNames: ["Ensuite"], overwrite: true });
    const copied = room(copy.selection, "Ensuite");
    assert.ok(copy.appliedSummary.Ensuite.includes("Door material (Premium laminate to Standard colourboard)"), `the material change is reported (${copy.appliedSummary.Ensuite})`);
    // The Main Bathroom's own (wall-hung) vanity handle, not the floor-vanity record left from before its change.
    assert.equal(copied.bathroomHandles.floorMountedVanity.productName, room(live, "Main Bathroom").bathroomHandles.wallMountedVanity.productName, "handle from the Main Bathroom's actual vanity");
    assert.deepEqual(cabinetryLocationMissingRequirements(copied), [], "the Ensuite has everything it needs");
    assert.equal(copied.areaSelections.floorVanityDoors.colourName, room(live, "Main Bathroom").areaSelections.wallVanityDoors.colourName);
    assert.equal(copied.benchtopAreas[0].surface.colourName, "Eclipse");
    assert.equal(copied.benchtopAreas[0].fabrication.thicknessMm, 20); assert.equal(copied.benchtopAreas[0].fabrication.basinType, "Above-counter");
    const after = approveCabinetryRoom(copy.selection, copied.projectRoomId || copied.id, jobId);
    assert.equal(isCabinetryRoomApproved(room(after, "Ensuite"), after.schedule, jobId), true, "the Ensuite approves");
    assert.equal(isCabinetryRoomApproved(room(after, "Main Bathroom"), after.schedule, jobId), true, "Main Bathroom approval untouched by the copy");
  });

  step("7 REAL JOB QUOTATION: ISLAND COUNT AND EDGE CONSTRUCTION ARE BUILDER ACTIONS; NO DUPLICATE ROWS", () => {
    const owner = workbook.workspaceId;
    const settled = applyCabinetryRequirementsToQuotation(workbook, owner, { ignoreContractLock: true });
    const rows = (wb) => (wb.quotation.CABINETRY?.rows || []).filter((r) => Number(r.quantity) > 0).map((r) => `${r.importKey}=${r.quantity}`).sort();
    const kitchenBrief = cabinetryQuotationBriefs(settled).find((item) => item.room === "Kitchen");
    assert.equal(kitchenBrief.island.hasIsland, true);
    assert.ok(kitchenBrief.builderReviews.some((item) => item.island), "unidentified island cabinets are a builder review in the Quotation Builder");
    const drawer = kitchenBrief.island.lines.find((line) => /drawer/i.test(line.label));
    const tagged = applyCabinetryRequirementsToQuotation(updateCabinetrySelectionRequirement(settled, `island:${drawer.componentId}`, 2), owner, { ignoreContractLock: true });
    const taggedBrief = cabinetryQuotationBriefs(tagged).find((item) => item.room === "Kitchen");
    assert.equal(taggedBrief.island.identified, true); assert.ok(!taggedBrief.builderReviews.some((item) => item.island));
    assert.deepEqual(rows(tagged), rows(settled), "marking island cabinets adds no row and changes no quantity");
    const main = kitchenBrief.benchtopConstructions.find((item) => item.label === "Main benchtop");
    assert.ok(main && main.options.length, "the builder sets the Kitchen main benchtop construction in the Quotation Builder");
    const other = main.options.find((option) => option.key !== main.edgeConstruction) || main.options[0];
    const built = updateCabinetrySelectionRequirement(settled, main.requirementId, { kind: "edge-construction", value: other.key });
    assert.equal(cabinetryQuotationBriefs(built).find((item) => item.room === "Kitchen").benchtopConstructions.find((item) => item.label === "Main benchtop").edgeConstruction, other.key);
    const rawKitchen = (wb) => normaliseCabinetrySelection({ ...wb.clientSelectionsBook.rooms.flatMap((r) => r.rows || []).find((r) => r.guidedSelection?.cabinetrySelection).guidedSelection.cabinetrySelection, projectId: jobId });
    assert.equal(isCabinetryRoomApproved(room(rawKitchen(built), "Kitchen"), rawKitchen(built).schedule, jobId), true, "the client's Kitchen approval stands");
    assert.equal(withSelection, withSelection);
  });
} else results.push("6/7 REAL JOB: SKIPPED (no --live=<job.json>)");

console.log(results.join("\n"));
