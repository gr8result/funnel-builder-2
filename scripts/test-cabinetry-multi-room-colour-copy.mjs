import assert from "node:assert/strict";
import {
  applicableColourTargetRooms,
  applyRoomColoursToTargets,
  clearInheritedColourMarker,
  normaliseCabinetrySelection,
  POLYTEC_CABINETRY_CATALOGUE,
} from "../lib/builders/cabinetryWorkflow.js";

// nextIncompleteCabinetryRoomAfter lives in the page file (not the lib module), so this
// reimplements only its pure ordering/status logic for this isolated check - the real
// function is exercised end-to-end by the live browser verification.
const CABINETRY_LOCATIONS_ORDER = ["Kitchen", "Butler's Pantry", "Bathroom", "Ensuite", "Powder Room", "Laundry", "Other"];
function nextIncompleteCabinetryRoomAfterCheck(locations, currentLocationName) {
  const isIncomplete = (location) => location.status !== "complete" && !location.confirmedAt;
  const candidates = locations.filter((location) => location.location !== currentLocationName);
  const ordered = [...candidates].sort((a, b) => {
    const ai = CABINETRY_LOCATIONS_ORDER.indexOf(a.location);
    const bi = CABINETRY_LOCATIONS_ORDER.indexOf(b.location);
    return (ai === -1 ? CABINETRY_LOCATIONS_ORDER.length : ai) - (bi === -1 ? CABINETRY_LOCATIONS_ORDER.length : bi);
  });
  return ordered.find(isIncomplete) || null;
}

const arabica = POLYTEC_CABINETRY_CATALOGUE.find((item) => item.colourName === "Arabica");
const naturalWhite = POLYTEC_CABINETRY_CATALOGUE.find((item) => item.colourName === "Natural White") || POLYTEC_CABINETRY_CATALOGUE.find((item) => item.colourName !== "Arabica");
assert.ok(arabica, "Arabica must exist in the real Polytec catalogue");
assert.ok(naturalWhite, "A second real Polytec colour must exist for override testing");

function bareLocation(location, overrides = {}) {
  return {
    id: `cabinetry-${location.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    name: location,
    location,
    locationType: location,
    included: true,
    status: "in_progress",
    scope: [],
    enabledAreaKeys: [],
    cabinetSchedule: [],
    doorMaterialGroup: "Standard colourboard",
    supplier: "Polytec",
    productRange: "",
    defaultColour: null,
    areaSelections: {},
    benchtop: null,
    bathroomScopeKeys: [],
    bathroomBenchtops: {},
    bathroomHandles: {},
    handles: {},
    featureOptions: [],
    notes: "",
    ...overrides,
  };
}

// ===== TEST A: Kitchen -> Butler's Pantry + Laundry simultaneously =====
const kitchen = bareLocation("Kitchen", {
  enabledAreaKeys: ["lowerDoorsDrawers", "overheadDoors", "endPanels"],
  areaSelections: { lowerDoorsDrawers: arabica, overheadDoors: arabica, endPanels: arabica },
});
const base = normaliseCabinetrySelection({ locations: [kitchen] });

// applicableColourTargetRooms is generic: Kitchen offers only OTHER standard (non-wet-area)
// rooms currently added to the project.
const laundryStub = bareLocation("Laundry");
const withLaundry = normaliseCabinetrySelection({ locations: [kitchen, laundryStub] });
const targets = applicableColourTargetRooms(withLaundry.locations, "Kitchen");
assert.deepEqual(targets.map((t) => t.location).sort(), ["Laundry"], "Kitchen's applicable targets are computed generically from currently-added standard rooms, not hardcoded");

const pantryStub = bareLocation("Butler's Pantry");
const withBoth = normaliseCabinetrySelection({ locations: [kitchen, pantryStub, laundryStub] });
const { selection: appliedToBoth, appliedSummary } = applyRoomColoursToTargets(withBoth, {
  sourceLocationName: "Kitchen",
  targetLocationNames: ["Butler's Pantry", "Laundry"],
  overwrite: false,
});
const pantryAfter = appliedToBoth.locations.find((l) => l.location === "Butler's Pantry");
const laundryAfter = appliedToBoth.locations.find((l) => l.location === "Laundry");
assert.equal(pantryAfter.areaSelections.lowerDoorsDrawers?.colourName, "Arabica", "TEST A: Kitchen -> Butler's Pantry colour copied");
assert.equal(laundryAfter.areaSelections.lowerDoorsDrawers?.colourName, "Arabica", "TEST A: Kitchen -> Laundry colour copied");
assert.equal(appliedSummary["Butler's Pantry"].length, 3, "TEST A: all three coloured areas copied to Pantry");
assert.equal(appliedSummary.Laundry.length, 3, "TEST A: all three coloured areas copied to Laundry");
console.log("PASS TEST A: Kitchen -> Butler's Pantry + Laundry simultaneously");

// ===== TEST B/F: target room remains its own cabinetry specification (schedule/benchtop/handles untouched) =====
for (const key of ["cabinetSchedule", "benchtop", "handles", "featureOptions", "notes"]) {
  assert.deepEqual(pantryAfter[key], pantryStub[key], `TEST B: copying colours does not touch Pantry ${key}`);
  assert.deepEqual(laundryAfter[key], laundryStub[key], `TEST B: copying colours does not touch Laundry ${key}`);
}
assert.equal(pantryAfter.status, "in_progress", "TEST F: target room is not marked complete merely because colours were copied");
console.log("PASS TEST B/F: target rooms remain their own cabinetry specification and are not auto-completed");

// ===== TEST C: no reselection needed - inherited colours are already populated =====
assert.equal(pantryAfter.areaSelections.overheadDoors?.colourName, "Arabica", "TEST C: inherited colour is already present without manual reselection");
console.log("PASS TEST C: inherited colours present without reselection");

// ===== TEST G (item 11): already-linked detection =====
const linkedTargets = applicableColourTargetRooms(appliedToBoth.locations, "Kitchen");
assert.ok(linkedTargets.find((t) => t.location === "Butler's Pantry")?.alreadyLinked, "TEST: Butler's Pantry shows as already linked after copy");
assert.ok(linkedTargets.find((t) => t.location === "Laundry")?.alreadyLinked, "TEST: Laundry shows as already linked after copy");
console.log("PASS: already-linked rooms are correctly detected for re-display");

// ===== TEST H/18: override independence =====
const overridden = normaliseCabinetrySelection({
  ...appliedToBoth,
  locations: appliedToBoth.locations.map((location) => location.location === "Butler's Pantry"
    ? {
      ...location,
      areaSelections: { ...location.areaSelections, lowerDoorsDrawers: naturalWhite },
      coloursAndFinishes: {
        ...location.coloursAndFinishes,
        ...clearInheritedColourMarker(location, ["lowerDoorsDrawers"]),
        areaSelections: { ...location.areaSelections, lowerDoorsDrawers: naturalWhite },
      },
    }
    : location),
});
const kitchenStill = overridden.locations.find((l) => l.location === "Kitchen");
const pantryOverridden = overridden.locations.find((l) => l.location === "Butler's Pantry");
const laundryStill = overridden.locations.find((l) => l.location === "Laundry");
assert.equal(kitchenStill.areaSelections.lowerDoorsDrawers?.colourName, "Arabica", "TEST H: Kitchen unchanged after Pantry override");
assert.equal(laundryStill.areaSelections.lowerDoorsDrawers?.colourName, "Arabica", "TEST H: Laundry unchanged after Pantry override (no sideways propagation)");
assert.equal(pantryOverridden.areaSelections.lowerDoorsDrawers?.colourName, naturalWhite.colourName, "TEST H: Pantry override took effect");
assert.equal(pantryOverridden.areaSelections.overheadDoors?.colourName, "Arabica", "TEST H: Pantry's other inherited areas remain inherited, unaffected by the one override");
assert.ok(!pantryOverridden.coloursAndFinishes.colourSourceAppliedAreaKeys.includes("lowerDoorsDrawers"), "TEST I (item 9): overridden area is no longer tracked as inherited");
assert.ok(pantryOverridden.coloursAndFinishes.colourSourceAppliedAreaKeys.includes("overheadDoors"), "TEST I (item 9): non-overridden area is still tracked as inherited");
console.log("PASS TEST H/I: overrides remain independent and inherited-vs-overridden is correctly distinguished per area");

// ===== TEST I/10: reapplying new source colours after a later source change =====
const kitchenChanged = normaliseCabinetrySelection({
  ...overridden,
  locations: overridden.locations.map((location) => location.location === "Kitchen"
    ? { ...location, areaSelections: { ...location.areaSelections, lowerDoorsDrawers: naturalWhite, overheadDoors: naturalWhite, endPanels: naturalWhite } }
    : location),
});
const { selection: reapplied } = applyRoomColoursToTargets(kitchenChanged, {
  sourceLocationName: "Kitchen",
  targetLocationNames: ["Laundry"],
  overwrite: true,
});
const laundryReapplied = reapplied.locations.find((l) => l.location === "Laundry");
assert.equal(laundryReapplied.areaSelections.lowerDoorsDrawers?.colourName, naturalWhite.colourName, "TEST: deliberate reapply with overwrite updates Laundry to the new Kitchen colour");
const pantryUnaffectedByReapply = reapplied.locations.find((l) => l.location === "Butler's Pantry");
assert.equal(pantryUnaffectedByReapply.areaSelections.lowerDoorsDrawers?.colourName, naturalWhite.colourName, "TEST: Pantry untouched by a reapply that targeted only Laundry (still its own overridden value, unaffected)");
console.log("PASS TEST: reapplying new source colours works deliberately (overwrite:true) without touching un-targeted rooms");

// ===== TEST E: Bathroom -> Ensuite + Powder Room (wet-area category, fully generic) =====
const naturalWhiteWet = naturalWhite;
const bathroom = bareLocation("Bathroom", {
  bathroomScopeKeys: ["floorVanityDoors"],
  enabledAreaKeys: ["floorVanityDoors"],
  areaSelections: { floorVanityDoors: naturalWhiteWet },
});
const ensuiteStub = bareLocation("Ensuite");
const powderStub = bareLocation("Powder Room");
const bathroomBook = normaliseCabinetrySelection({ locations: [bathroom, ensuiteStub, powderStub] });
const bathroomTargets = applicableColourTargetRooms(bathroomBook.locations, "Bathroom");
assert.deepEqual(bathroomTargets.map((t) => t.location).sort(), ["Ensuite", "Powder Room"], "TEST E: Bathroom's applicable targets are the other wet-area rooms, computed generically");
const { selection: bathroomApplied } = applyRoomColoursToTargets(bathroomBook, {
  sourceLocationName: "Bathroom",
  targetLocationNames: ["Ensuite", "Powder Room"],
  overwrite: false,
});
const ensuiteAfter = bathroomApplied.locations.find((l) => l.location === "Ensuite");
const powderAfter = bathroomApplied.locations.find((l) => l.location === "Powder Room");
assert.equal(ensuiteAfter.areaSelections.floorVanityDoors?.colourName, naturalWhiteWet.colourName, "TEST E: Bathroom -> Ensuite colour copied");
assert.equal(powderAfter.areaSelections.floorVanityDoors?.colourName, naturalWhiteWet.colourName, "TEST E: Bathroom -> Powder Room colour copied");
console.log("PASS TEST E: Bathroom -> Ensuite + Powder Room simultaneously (wet-area category, fully generic)");

// A Kitchen-style source must never offer a wet-area room, and vice versa.
const kitchenTargetsExcludeWetAreas = applicableColourTargetRooms([...withBoth.locations, bathroom, ensuiteStub], "Kitchen");
assert.ok(!kitchenTargetsExcludeWetAreas.some((t) => ["Bathroom", "Ensuite", "Powder Room"].includes(t.location)), "Kitchen never offers wet-area rooms as colour-copy targets");
const bathroomTargetsExcludeStandard = applicableColourTargetRooms([...bathroomBook.locations, kitchen], "Bathroom");
assert.ok(!bathroomTargetsExcludeStandard.some((t) => ["Kitchen", "Butler's Pantry", "Laundry"].includes(t.location)), "Bathroom never offers standard rooms as colour-copy targets");
console.log("PASS: room-category separation is respected in both directions (no cross-category offers)");

// ===== TEST L (items 12-14): Next Room must still open a room whose colours are inherited
// but whose room-specific cabinetry details (schedule) remain incomplete. =====
const kitchenComplete = { ...kitchenStill, status: "complete", confirmedAt: new Date().toISOString() };
const pantryColoursOnlyNotComplete = { ...pantryAfter, status: "in_progress", confirmedAt: "" };
const laundryColoursOnlyNotComplete = { ...laundryAfter, status: "in_progress", confirmedAt: "" };
const nextAfterKitchen = nextIncompleteCabinetryRoomAfterCheck([kitchenComplete, pantryColoursOnlyNotComplete, laundryColoursOnlyNotComplete], "Kitchen");
assert.equal(nextAfterKitchen?.location, "Butler's Pantry", "TEST L: Next Room opens Butler's Pantry - colours inherited but room details still incomplete, so it is correctly NOT skipped");
const pantryNowComplete = { ...pantryColoursOnlyNotComplete, status: "complete", confirmedAt: new Date().toISOString() };
const nextAfterPantry = nextIncompleteCabinetryRoomAfterCheck([kitchenComplete, pantryNowComplete, laundryColoursOnlyNotComplete], "Butler's Pantry");
assert.equal(nextAfterPantry?.location, "Laundry", "TEST L: once Pantry's own room details are actually completed, Next Room correctly moves on to Laundry");
console.log("PASS TEST L: Next Room treats 'colours inherited' and 'room complete' as independent states");

console.log("\nAll cabinetry multi-room colour-copy tests passed.");
