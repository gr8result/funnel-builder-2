// Client Selections benchtops (owner brief "COMPLETE BENCHTOP SELECTIONS", 17 Nov 2026).
//  1. A Kitchen benchtop named after Butler's Pantry is found (even with no copied cabinets left) and renamed
//     to the Kitchen's own, keeping its surface; Butler's Pantry is untouched; a new job cannot get one.
//  2. Nominal thickness 20 / 40 / 60 mm per area, full slab vs mitred / built-up edge, offered from the
//     Product Library thickness data; no data -> builder confirmation; laminate -> no stone thickness.
//  3. Thickness is per area: the island linked to the main benchtop, "apply to all" and Kitchen finish
//     copying never copy a thickness, edge construction or vanity choice.
//  4. Vanity: wall-hung 350 mm depth, basin types, 100 / 150 / 200 mm drop-front, fabricator reviews.
//  5. Quotation: area specification + builder reviews, mitred edge row (builder-measured), drop-front reported
//     for the builder to price (no invented rate), basin cut-outs by basin type without double counting.
//  6. Client PDF: specification shown, no lengths.
//   node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-client-selections-benchtop-fabrication.mjs
import assert from "node:assert/strict";
import { applyKitchenFinishesToRooms, cabinetryCopiedItems, copyCabinetryLocation, normaliseCabinetrySelection, resolveCabinetryCopiedItems } from "../lib/builders/cabinetryWorkflow.js";
import { benchtopLocationPatch, benchtopAreasFor, benchtopSetupFor, stoneSurfaceForArea } from "../lib/builders/benchtopSelection.js";
import { benchtopFabrication, benchtopFabricationReviews, benchtopSpecificationText, benchtopThicknessOptions, vanityBasinOptions, vanityDepthOptions, vanityDropFrontOptions, withThickness } from "../lib/builders/benchtopFabrication.js";
import { applyIslandInheritance } from "../lib/builders/benchtopInheritance.js";
import { activeStoneBenchtopProducts } from "../lib/builders/stoneBenchtopWorkflow.js";
import { collectCabinetryRequirements, planCabinetryQuotation } from "../lib/construction-estimation/cabinetryRequirements.js";
import { buildSelectionsSchedule } from "../lib/builders/selectionsScheduleDocument.js";

const results = [];
const step = (name, fn) => { try { fn(); results.push(`${name}: PASS`); } catch (error) { results.push(`${name}: FAIL`); console.error(`FAIL ${name}:`, error.message); process.exitCode = 1; } };
const products = activeStoneBenchtopProducts();
const caesarstone20 = products.find((p) => p.supplier === "Caesarstone" && JSON.stringify(p.thicknessOptions) === '["20mm"]');
const unknownStone = products.find((p) => p.supplier === "Stone Ambassador");
assert.ok(caesarstone20 && unknownStone, "fixture products");
const surfaceOf = (product, room, label) => stoneSurfaceForArea(product, { room, area: { label }, setup: { edgeProfile: "Pencil round", waterfallEnds: "None", upstand: "None", cutouts: [] }, ranges: {} });
const laminate = { materialChoice: "laminate", supplier: "Laminex", colourName: "White", rangeKey: "standard_laminate" };
const room = (selection, name) => selection.locations.find((l) => l.location === name);

step("1 KITCHEN BENCHTOP NAMED AFTER BUTLER'S PANTRY - FOUND, RENAMED, BUTLER'S PANTRY UNTOUCHED", () => {
  const bpSurface = surfaceOf(caesarstone20, "Butler's Pantry", "Butler's Pantry benchtop");
  const kSurface = surfaceOf(caesarstone20, "Kitchen", "Butler's Pantry benchtop");
  const selection = normaliseCabinetrySelection({ locations: [
    { location: "Kitchen", included: true, enabledAreaKeys: ["lowerDoorsDrawers"], benchtopAreas: [{ id: "benchtop-main", label: "Butler's Pantry benchtop", lengthMm: 3000, depthMm: 600, surface: kSurface, fabrication: { thicknessMm: 40, edgeConstruction: "mitred" } }, { id: "benchtop-island", label: "Island benchtop", depthMm: 900, surface: null }] },
    { location: "Butler's Pantry", included: true, enabledAreaKeys: ["lowerDoorsDrawers"], benchtopAreas: [{ id: "benchtop-main", label: "Butler's Pantry benchtop", lengthMm: 2400, depthMm: 600, surface: bpSurface }] },
  ], schedule: [] });
  const found = cabinetryCopiedItems(selection, "Kitchen");
  assert.equal(found.fromLocation, "Butler's Pantry");
  assert.deepEqual(found.lines, [], "no copied cabinets left");
  assert.deepEqual(found.benchtopAreas.map((a) => a.label), ["Butler's Pantry benchtop"], "the mislabelled Kitchen benchtop is listed");
  assert.deepEqual(cabinetryCopiedItems(selection, "Butler's Pantry").benchtopAreas, [], "Butler's Pantry's own benchtop is not flagged");
  const fixed = resolveCabinetryCopiedItems(selection, "Kitchen", "remove");
  const kitchenAreas = room(fixed, "Kitchen").benchtopAreas;
  assert.deepEqual(kitchenAreas.map((a) => a.label), ["Main benchtop", "Island benchtop"], "the Kitchen shows only its own areas");
  assert.equal(kitchenAreas[0].surface.colourName, caesarstone20.colourName, "its surface is kept");
  assert.equal(kitchenAreas[0].fabrication.thicknessMm, 40, "its thickness is kept");
  assert.equal(JSON.stringify(room(fixed, "Butler's Pantry")), JSON.stringify(room(selection, "Butler's Pantry")), "Butler's Pantry unchanged");
  assert.deepEqual(cabinetryCopiedItems(fixed, "Kitchen").benchtopAreas, [], "the review does not come back");
  // New job: a Butler's Pantry copy into the Kitchen is refused, so the Kitchen keeps "Main benchtop".
  const fresh = normaliseCabinetrySelection({ locations: [
    { location: "Kitchen", included: true, enabledAreaKeys: ["lowerDoorsDrawers"], benchtopAreas: [{ id: "benchtop-main", label: "Main benchtop", depthMm: 600, surface: null }] },
    { location: "Butler's Pantry", included: true, enabledAreaKeys: ["lowerDoorsDrawers"], benchtopAreas: [{ id: "benchtop-main", label: "Butler's Pantry benchtop", depthMm: 600, surface: bpSurface }] },
  ], schedule: [] });
  assert.deepEqual(room(copyCabinetryLocation(fresh, "Butler's Pantry", ["Kitchen"]), "Kitchen").benchtopAreas.map((a) => a.label), ["Main benchtop"]);
  assert.deepEqual(benchtopAreasFor({ location: "Kitchen", enabledAreaKeys: [] }).map((a) => a.label), ["Main benchtop"], "a new Kitchen's main benchtop is named for the Kitchen");
});

step("2 THICKNESS 20 / 40 / 60 FROM PRODUCT LIBRARY DATA", () => {
  const known = benchtopThicknessOptions(surfaceOf(caesarstone20, "Kitchen", "Main benchtop"));
  assert.deepEqual(known.map((o) => o.thicknessMm), [20, 40, 60]);
  assert.deepEqual(known.map((o) => o.constructions.map((c) => `${c.key}:${c.status}:${c.slabMm}`)), [["full:supported:20"], ["mitred:supported:20"], ["mitred:supported:20"]], "40 / 60 mm are mitred edges on the 20 mm slab; no 40 mm slab is invented");
  const unknown = benchtopThicknessOptions(surfaceOf(unknownStone, "Kitchen", "Main benchtop"));
  assert.ok(unknown.every((o) => o.constructions.every((c) => c.status === "builder_confirm")), "no thickness data -> builder confirmation");
  assert.deepEqual(benchtopThicknessOptions(laminate), [], "laminate has no stone thickness choice");
  const area = { id: "benchtop-main", label: "Main benchtop", surface: surfaceOf(unknownStone, "Kitchen", "Main benchtop") };
  const chosen = { ...area, fabrication: withThickness(area, 60) };
  assert.equal(chosen.fabrication.thicknessMm, 60);
  assert.match(benchtopFabricationReviews(chosen, { room: "Kitchen" }).join(" "), /confirm .* 60 mm .*no thickness data/i, "unknown compatibility needs builder confirmation");
});

let kitchen;
step("3 THICKNESS IS PER AREA - ISLAND LINK, APPLY TO ALL, KITCHEN FINISH COPY", () => {
  const surface = surfaceOf(caesarstone20, "Kitchen", "Main benchtop");
  const location = { location: "Kitchen", enabledAreaKeys: ["lowerDoorsDrawers", "islandBenchBack"], benchtopSetup: { edgeProfile: "Pencil round", waterfallEnds: "None", upstand: "None", cutouts: ["Sink"], confirmedAt: "2026-11-17" } };
  const setup = benchtopSetupFor(location);
  let areas = [{ id: "benchtop-main", label: "Main benchtop", depthMm: 600, surface, fabrication: { thicknessMm: 40, edgeConstruction: "mitred" } }, { id: "benchtop-island", label: "Island benchtop", depthMm: 900, surface: null, fabrication: { thicknessMm: 60, edgeConstruction: "mitred" } }];
  const patch = benchtopLocationPatch({ location, setup, areas });
  kitchen = { ...location, ...patch };
  const [main, island] = applyIslandInheritance(patch.benchtopAreas);
  assert.equal(island.surface.colourName, caesarstone20.colourName, "the island follows the main benchtop's stone");
  assert.equal(benchtopFabrication(main).thicknessMm, 40, "Kitchen main benchtop 40 mm");
  assert.equal(benchtopFabrication(island).thicknessMm, 60, "Kitchen island 60 mm, independently");
  assert.equal(island.surface.thickness, undefined, "the inherited surface carries no thickness from the main benchtop");
  // "Apply this surface to all" moves the surface, not the thickness.
  areas = patch.benchtopAreas.map((a) => ({ ...a, surface: { ...main.surface, applications: [a.label] } }));
  const all = benchtopLocationPatch({ location, setup, areas }).benchtopAreas;
  assert.deepEqual(all.map((a) => benchtopFabrication(a).thicknessMm), [40, 60]);
  assert.deepEqual(all.map((a) => a.surface.thickness), ["40 mm", "60 mm"], "each surface mirrors its own area's thickness");
  // Kitchen finish copy into Butler's Pantry (40 mm full) and a bathroom vanity (20 mm).
  const bp = { location: "Butler's Pantry", included: true, enabledAreaKeys: ["lowerDoorsDrawers"], benchtopAreas: [{ id: "benchtop-main", label: "Butler's Pantry benchtop", depthMm: 600, surface: null, fabrication: { thicknessMm: 40, edgeConstruction: "full" } }] };
  const bath = { location: "Main Bathroom", included: true, enabledAreaKeys: ["wallVanityDoors"], bathroomScopeKeys: ["wallMountedVanity"], benchtopAreas: [{ id: "wallMountedVanity", label: "Wall-mounted vanity benchtop", depthMm: 600, surface: null, fabrication: { thicknessMm: 20, edgeConstruction: "full", vanityDepthMm: 350, basinType: "Semi-recessed", dropFrontMm: 150 } }] };
  const selection = normaliseCabinetrySelection({ locations: [{ ...kitchen, included: true, areaSelections: { lowerDoorsDrawers: { id: "c", colourName: "Oak", supplier: "Polytec" } } }, bp, bath], schedule: [] });
  const { selection: copied } = applyKitchenFinishesToRooms(selection, { targetLocationNames: ["Butler's Pantry", "Main Bathroom"] });
  const bpArea = room(copied, "Butler's Pantry").benchtopAreas[0];
  const bathArea = room(copied, "Main Bathroom").benchtopAreas[0];
  assert.equal(bpArea.surface?.colourName, caesarstone20.colourName, "Butler's Pantry took the Kitchen stone");
  // Its own 40 mm stays; the construction is settled for the stone it now has (18 Nov 2026): the Kitchen
  // stone comes as a 20 mm slab only, so a 40 mm top is a mitred edge, exactly as when the client picks it.
  assert.deepEqual(benchtopFabrication(bpArea), { thicknessMm: 40, edgeConstruction: "mitred", vanityDepthMm: "", basinType: "", dropFrontMm: "" }, "Butler's Pantry keeps its own 40 mm, built for the copied stone");
  assert.ok(!bpArea.surface.thickness && !bpArea.surface.edgeConstruction, "the Kitchen's 40 mm mitred edge is not copied on the surface");
  assert.equal(benchtopFabrication(bathArea).thicknessMm, 20, "the vanity keeps 20 mm");
  assert.equal(benchtopFabrication(bathArea).dropFrontMm, 150, "and its drop-front");
});

step("4 VANITY - WALL-HUNG 350 MM, BASINS, DROP-FRONTS, FABRICATOR REVIEW", () => {
  assert.ok(vanityDepthOptions("wallMountedVanity").includes(350), "wall-hung offers 350 mm");
  assert.ok(!vanityDepthOptions("floorMountedVanity").includes(350), "350 mm is a wall-hung depth only");
  const stone = surfaceOf(caesarstone20, "Main Bathroom", "Wall-mounted vanity benchtop");
  assert.deepEqual(vanityBasinOptions(stone), ["Undermount", "Inset", "Semi-recessed", "Above-counter"]);
  assert.ok(!vanityBasinOptions(laminate).includes("Undermount"), "no undermount basin on a laminate top");
  assert.deepEqual(vanityDropFrontOptions(stone), [100, 150, 200]);
  assert.deepEqual(vanityDropFrontOptions(laminate), []);
  const area = { id: "wallMountedVanity", label: "Wall-mounted vanity benchtop", surface: stone, fabrication: { thicknessMm: 20, edgeConstruction: "full", vanityDepthMm: 350, basinType: "Semi-recessed", dropFrontMm: 200 } };
  assert.equal(benchtopSpecificationText(area), "20 mm · Full-thickness slab · Wall-hung vanity · 350 mm deep · Semi-recessed basin · 200 mm stone drop-front");
  const reviews = benchtopFabricationReviews(area, { room: "Ensuite" }).join(" | ");
  assert.match(reviews, /semi-recessed basin projects beyond the vanity front - stone fabricator to review .*200 mm drop-front/);
  assert.match(reviews, /350 mm deep top with a semi-recessed basin - confirm the basin fits/);
});

step("5 QUOTATION - SPECIFICATION, REVIEWS, MITRED EDGE, DROP-FRONT, BASIN CUT-OUTS", () => {
  const vanityStone = { ...surfaceOf(caesarstone20, "Main Bathroom", "Wall-mounted vanity benchtop"), rangeKey: "stone_standard", benchtopRangeKey: "stone_standard" };
  const kitchenAreas = kitchen.benchtopAreas.map((a) => ({ ...a, lengthMm: a.id === "benchtop-main" ? 3600 : 2400, surface: a.surface ? { ...a.surface, rangeKey: "stone_standard", benchtopRangeKey: "stone_standard" } : a.surface }));
  const selection = { locations: [
    { ...kitchen, included: true, benchtopAreas: kitchenAreas },
    { location: "Main Bathroom", included: true, bathroomScopeKeys: ["wallMountedVanity", "floorMountedVanity"], benchtopSetup: { edgeProfile: "Pencil round", cutouts: ["Sink", "Tap"], confirmedAt: "2026-11-17" },
      benchtopAreas: [
        { id: "wallMountedVanity", label: "Wall-mounted vanity benchtop", depthMm: 600, lengthMm: 1200, surface: vanityStone, fabrication: { thicknessMm: 20, edgeConstruction: "full", vanityDepthMm: 350, basinType: "Semi-recessed", dropFrontMm: 150 } },
        { id: "floorMountedVanity", label: "Floor-mounted vanity benchtop", depthMm: 600, lengthMm: 900, surface: vanityStone, fabrication: { thicknessMm: 20, edgeConstruction: "full", basinType: "Undermount" } },
      ] },
  ], schedule: [] };
  const workbook = { clientSelectionsBook: { rooms: [{ rows: [{ guidedSelection: { requirementKey: "cabinetry", cabinetrySelection: selection } }] }] } };
  const requirements = collectCabinetryRequirements(workbook).filter((r) => r.source === "CLIENT_SELECTION");
  const byId = (suffix) => requirements.find((r) => r.id.endsWith(suffix));
  assert.equal(byId("kitchen:benchtop-main").specification, "40 mm · Mitred / built-up edge from 20 mm slab");
  assert.equal(byId("kitchen:benchtop-island").specification, "60 mm · Mitred / built-up edge from 20 mm slab");
  assert.equal(byId("kitchen:benchtop-main:edge").type, "benchtop_mitred_edge_40");
  assert.equal(byId("kitchen:benchtop-main:edge").issueFlag, "MEASUREMENT REQUIRED", "the mitred edge length is the builder's measurement, never the bench length");
  assert.equal(byId("kitchen:benchtop-island:edge").type, "benchtop_mitred_edge_60");
  const wall = byId("main-bathroom:wallMountedVanity");
  assert.equal(wall.specification, "20 mm · Full-thickness slab · Wall-hung vanity · 350 mm deep · Semi-recessed basin · 150 mm stone drop-front");
  assert.match(wall.builderReview, /semi-recessed basin .* stone fabricator/);
  const drop = byId("main-bathroom:wallMountedVanity:drop-front");
  assert.equal(drop.issueFlag, "BUILDER REVIEW");
  assert.equal(drop.action.kind, "builder-rate-required", "no rate is invented for the drop-front");
  const cut = (type) => requirements.filter((r) => r.type === type && r.roomKey === "main-bathroom").reduce((t, r) => t + r.quantity, 0);
  assert.equal(cut("benchtop_sink_cutout"), 1, "semi-recessed basin: one standard cut-out");
  assert.equal(cut("benchtop_undermount_sink_cutout"), 1, "undermount basin: one undermount cut-out, not also a standard one");
  const plan = planCabinetryQuotation(workbook);
  const entry = plan.entries.find((e) => e.requirementId.endsWith("kitchen:benchtop-island"));
  assert.equal(entry.specification, "60 mm · Mitred / built-up edge from 20 mm slab", "the quotation entry carries the specification");
  // Builder enters the edge length: priced on the 40 mm mitred edge row, quantity from the builder only.
  const measured = { ...workbook, clientSelectionsBook: { rooms: [{ rows: [{ guidedSelection: { requirementKey: "cabinetry", cabinetrySelection: { ...selection, locations: selection.locations.map((l) => l.location !== "Kitchen" ? l : { ...l, benchtopAreas: l.benchtopAreas.map((a) => a.id === "benchtop-main" ? { ...a, fabrication: { ...a.fabrication, edgeLengthMm: 4200 } } : a) }) } } }] }] } };
  const edge = collectCabinetryRequirements(measured).find((r) => r.id.endsWith("kitchen:benchtop-main:edge"));
  assert.equal(edge.quantity, 4.2);
  assert.ok(!edge.issue);
});

step("6 CLIENT PDF - SPECIFICATION WITHOUT LENGTHS", () => {
  const selection = { locations: [{ ...kitchen, included: true, enabledAreaKeys: ["lowerDoorsDrawers"], benchtopAreas: kitchen.benchtopAreas.map((a) => ({ ...a, lengthMm: 3600 })) }], schedule: [] };
  const document = buildSelectionsSchedule({ rooms: [{ rows: [{ id: "cab", item: "Cabinetry", guidedRequirementKey: "cabinetry", selectedProduct: "", guidedSelection: { requirementKey: "cabinetry", area: "cabinetry", requirementLabel: "Cabinetry", cabinetrySelection: selection } }] }] });
  const text = JSON.stringify(document);
  // 18 Nov 2026: the client PDF names the finished thickness, not the fabricator's edge construction.
  assert.match(text, /Main benchtop: [^"]*40 mm · Pencil round edge/);
  assert.doesNotMatch(text, /Mitred|Full-thickness slab|built-up edge/, "no edge construction in the client PDF");
  assert.match(text, /Island benchtop: [^"]*60 mm/);
  assert.ok(!/3600|3\.6\s?(lm|LM)/.test(text), "no builder lengths in the client document");
});

console.log(results.join("\n"));
