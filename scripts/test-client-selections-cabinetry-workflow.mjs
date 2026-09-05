import assert from "node:assert/strict";
import fs from "node:fs";
import {
  CABINETRY_AREA_KEYS,
  CABINETRY_BENCHTOPS,
  CABINETRY_LOCATION_AREA_KEYS,
  CABINETRY_LOCATIONS,
  CABINETRY_PRICING_TIERS,
  CABINETRY_SCHEDULE_TYPE_OPTIONS,
  CABINETRY_WORKFLOW_STAGES,
  HANDLE_HOUSE_BASE_CATALOGUE,
  LAMINEX_CABINETRY_CATALOGUE,
  POLYTEC_CABINETRY_CATALOGUE,
  applyKitchenColoursToButlersPantry,
  buildCabinetrySelectionPayload,
  copyCabinetryLocation,
  cleanIncorrectButlersPantryCopiedScheduleRows,
  defaultCabinetryDraft,
  kitchenPantryCopiedScheduleLine,
  normaliseCabinetrySelection,
  overrideCabinetryArea,
} from "../lib/builders/cabinetryWorkflow.js";
import { KITCHEN_REQUIREMENTS } from "../lib/builders/clientSelectionWorkflow.js";

const requiredLocations = ["Kitchen", "Butler's Pantry", "Bathroom", "Ensuite", "Powder Room", "Laundry", "Other"];
const requiredAreas = ["lowerDoorsDrawers", "islandBenchBack", "endPanels", "overheadDoors", "kickPanels", "bulkheads"];
const requiredBathroomAreas = [
  "floorVanityDoors",
  "floorVanityDrawers",
  "floorVanityTowelDisplay",
  "wallVanityDoors",
  "wallVanityDrawers",
  "wallVanityTowelDisplay",
  "tallLinenDoors",
  "tallLinenEndPanels",
  "linenBulkhead",
  "bathroomOtherCustom",
];
const requiredScheduleTypes = [
  "Standard base unit",
  "Corner unit",
  "Sink cupboard",
  "Pull-out bin",
  "Underbench oven cabinet",
  "Dishwasher cabinet",
  "Microwave cabinet",
  "Rangehood cabinet",
  "Tall pantry",
  "Four-bank drawers",
  "Five-bank drawers",
  "Two-bank pot drawers",
  "Three-bank pot drawers: one small and two large",
  "Hidden drawers",
];
let draft = defaultCabinetryDraft({ workspaceId: "workspace-1", projectId: "project-1" });

assert.deepEqual(CABINETRY_WORKFLOW_STAGES, [
  "Scope",
  "Cabinet Schedule",
  "Doors & Panels",
  "Colours & Finishes",
  "Benchtops",
  "Handles",
  "Features",
  "Review & Confirm",
], "approved cabinetry stages must be present");
assert.equal(draft.schemaVersion, 2, "cabinetry uses the room-based schema");
assert.equal(draft.locations.length, 0, "cabinetry does not auto-create rooms");
assert.equal(draft.schedule.length, 0, "cabinetry does not auto-create schedule rows");
requiredLocations.forEach((location) => assert.ok(CABINETRY_LOCATIONS.includes(location), `${location} source-of-truth location is available`));
requiredAreas.forEach((areaKey) => assert.ok(CABINETRY_LOCATION_AREA_KEYS.includes(areaKey), `${areaKey} source-of-truth cabinetry area is available`));
requiredBathroomAreas.forEach((areaKey) => assert.ok(CABINETRY_AREA_KEYS.includes(areaKey), `${areaKey} Bathroom cabinetry area is available`));
requiredScheduleTypes.forEach((unitType) => assert.ok(CABINETRY_SCHEDULE_TYPE_OPTIONS.includes(unitType), `${unitType} schedule type is available`));
draft = normaliseCabinetrySelection({
  ...draft,
  locations: ["Kitchen", "Butler's Pantry", "Bathroom", "Ensuite"].map((location) => ({
    name: location,
    location,
    included: true,
    status: "in_progress",
    enabledAreaKeys: ["lowerDoorsDrawers"],
    areaSelections: { lowerDoorsDrawers: POLYTEC_CABINETRY_CATALOGUE[0] },
  })),
  schedule: [
    { componentId: "CAB-KIT-001", location: "Kitchen", unitType: "Standard base unit", quantity: 4, handleQuantity: 4 },
    { componentId: "CAB-BTH-001", location: "Bathroom", unitType: "Standard base unit", quantity: 1, handleQuantity: 1 },
  ],
});
assert.equal(draft.schedule.length, 1, "wet-area rooms ignore Kitchen-shaped legacy schedule rows");
assert.ok(!draft.schedule.some((line) => line.location === "Bathroom" && line.unitType === "Standard base unit"), "Bathroom does not retain Kitchen base-unit schedule rows");
assert.ok(CABINETRY_AREA_KEYS.includes("islandBenchBack"), "island back has a distinct selectable surface");

const cabinetryRows = KITCHEN_REQUIREMENTS.filter((requirement) => /cabinet|handle|bench/i.test(`${requirement.requirementKey} ${requirement.label}`));
assert.deepEqual(cabinetryRows.map((requirement) => requirement.requirementKey), ["cabinetry"], "Kitchen checklist exposes one primary Cabinetry row");

const polytecStandard = POLYTEC_CABINETRY_CATALOGUE.find((item) => item.productFamily.includes("Decorative 18mm") && item.colourName === "White");
const islandFeature = POLYTEC_CABINETRY_CATALOGUE.find((item) => item.colourName === "Tasmanian Oak");
const overheadColour = LAMINEX_CABINETRY_CATALOGUE.find((item) => item.colourName === "Polar White");
assert.ok(polytecStandard, "Polytec standard decorative board colour is imported");
assert.ok(islandFeature, "Polytec feature colour is imported");
assert.ok(overheadColour, "Laminex colour is imported separately");

const legacyUnsafeDraft = normaliseCabinetrySelection({
  activeLocation: "Kitchen",
  locations: [
    {
      location: "Kitchen",
      included: true,
      supplier: "Laminex",
      defaultColour: "Legacy colour name only",
      areaSelections: "Legacy area selection text",
      coloursAndFinishes: {
        supplier: "Laminex",
        defaultColour: null,
        areaSelections: { lowerDoorsDrawers: "Deleted old catalogue record" },
      },
    },
    {
      location: "Laundry",
      included: true,
      supplier: "Polytec",
      defaultColour: { supplier: "Polytec", colourName: "Deleted colour", productRange: "Old range", finish: "Old finish" },
      areaSelections: { lowerDoorsDrawers: { supplier: "Polytec", colourName: "Partial old colour" } },
    },
  ],
});
const legacyKitchen = legacyUnsafeDraft.locations.find((item) => item.location === "Kitchen");
const legacyLaundry = legacyUnsafeDraft.locations.find((item) => item.location === "Laundry");
assert.equal(legacyKitchen.defaultColour, null, "legacy string defaultColour normalises to null instead of crashing render");
assert.equal(legacyKitchen.areaSelections.lowerDoorsDrawers, null, "legacy string area selection normalises to null");
assert.equal(legacyKitchen.supplier, "Laminex", "legacy Laminex supplier remains available without a colour record");
assert.equal(legacyLaundry.defaultColour.colourName, "Deleted colour", "deleted catalogue colour objects remain readable for legacy summaries");
assert.equal(legacyLaundry.areaSelections.lowerDoorsDrawers.colourName, "Partial old colour", "partial Polytec colour records remain readable");

draft = overrideCabinetryArea(draft, "Kitchen", "lowerDoorsDrawers", polytecStandard);
draft = overrideCabinetryArea(draft, "Butler's Pantry", "islandBenchBack", islandFeature);
draft = overrideCabinetryArea(draft, "Kitchen", "overheadDoors", overheadColour);
assert.equal(draft.locations.find((item) => item.location === "Kitchen").areaSelections.lowerDoorsDrawers.supplier, "Polytec", "Polytec standard board applies to Kitchen lower doors");
assert.equal(draft.locations.find((item) => item.location === "Butler's Pantry").areaSelections.islandBenchBack.colourName, "Tasmanian Oak", "feature colour applies to island bench back");
assert.equal(draft.locations.find((item) => item.location === "Kitchen").areaSelections.overheadDoors.supplier, "Laminex", "overhead colour can differ from lower doors");

const laminateBench = CABINETRY_BENCHTOPS.find((item) => item.id === "laminated-laminex");
const stone20 = CABINETRY_BENCHTOPS.find((item) => item.id === "stone-20mm");
draft.locations = draft.locations.map((location) => location.location === "Kitchen" ? { ...location, benchtop: laminateBench } : location);
assert.equal(normaliseCabinetrySelection(draft).locations.find((item) => item.location === "Kitchen").benchtop.category, "Laminated", "laminated benchtop can be selected");
draft.locations = draft.locations.map((location) => location.location === "Kitchen" ? { ...location, benchtop: stone20 } : location);
assert.equal(normaliseCabinetrySelection(draft).locations.find((item) => item.location === "Kitchen").benchtop.thickness, "20 mm", "20mm stone benchtop can replace laminate");
assert.match(stone20.thicknessConfiguration, /supplier|Solid/i, "20mm stone stores thickness configuration instead of assuming 40mm solid slab");

const handle = HANDLE_HOUSE_BASE_CATALOGUE.find((item) => item.productCode === "C3");
assert.ok(handle?.imageUrl && !/logo|diagram|drawing/i.test(handle.imageUrl), "Handle House handle has a product photograph rather than logo/drawing as primary image");
draft.locations = draft.locations.map((location) => location.location === "Kitchen" ? {
  ...location,
  handles: {
    base: { ...handle, selectedSize: "160mm", selectedFinish: "Brushed Stainless Steel", openingMethod: "Pull handle" },
    overhead: { productName: "Handleless overheads", productCode: "HANDLELESS-PUSH-TO-OPEN", style: "Handleless", selectedSize: "N/A", selectedFinish: "N/A", openingMethod: "Push-to-open hardware", priceStatus: "quote_required" },
  },
  integratedAppliances: [{ type: "Integrated dishwasher panel", applianceBrand: "Client to confirm", applianceModel: "Client to confirm", panelRequirements: "Panel to match lower cabinetry", ventilationRequirements: "Cabinetmaker confirmation required", openingMethod: "Pull handle", confirmationStatus: "cabinetmaker_confirmation_required" }],
} : location);
const kitchen = normaliseCabinetrySelection(draft).locations.find((item) => item.location === "Kitchen");
assert.equal(kitchen.handles.base.productCode, "C3", "Handle House handle selection persists product code");
assert.equal(kitchen.handles.overhead.openingMethod, "Push-to-open hardware", "handleless overheads record the actual opening method");
assert.equal(kitchen.integratedAppliances[0].type, "Integrated dishwasher panel", "integrated dishwasher panel is recorded");

const rawMdfBulkhead = {
  id: "bulkheads-raw-mdf-wall-paint",
  areaKey: "bulkheads",
  material: "Raw MDF",
  finalFinish: "Painted",
  paintSource: "match_wall_colour",
  colourName: "Painted to match walls",
  finish: "Painted to match walls",
  supplier: "",
  priceStatus: "supplier_quote_required",
  finishMode: "raw_mdf_wall_paint",
  procurementDescription: "Supply and install Raw MDF bulkheads, prepared and painted to match internal wall colour.",
};
const brushedAluminiumKick = {
  id: "kick-panels-brushed-aluminium",
  areaKey: "kickPanels",
  material: "Aluminium",
  finalFinish: "Brushed aluminium",
  colourName: "Natural aluminium",
  finish: "Brushed aluminium",
  supplier: "",
  priceStatus: "included",
  finishMode: "brushed_aluminium",
  heightMm: "150",
  notes: "Kitchen kick panels",
  procurementDescription: "Supply and install brushed aluminium kick panels.",
};
draft.locations = draft.locations.map((location) => location.location === "Kitchen" ? {
  ...location,
  enabledAreaKeys: Array.from(new Set([...(location.enabledAreaKeys || []), "bulkheads", "kickPanels"])),
  areaSelections: {
    ...(location.areaSelections || {}),
    bulkheads: rawMdfBulkhead,
    kickPanels: brushedAluminiumKick,
  },
  bulkheadFinishMode: "raw_mdf_wall_paint",
  kickPanelFinishMode: "brushed_aluminium",
} : location);
const kitchenAreaSpecs = normaliseCabinetrySelection(draft).locations.find((item) => item.location === "Kitchen");
assert.equal(kitchenAreaSpecs.areaSelections.bulkheads.material, "Raw MDF", "Raw MDF bulkhead material persists independently of catalogue colour");
assert.equal(kitchenAreaSpecs.areaSelections.bulkheads.paintSource, "match_wall_colour", "bulkhead paint source links to the wall colour selection");
assert.equal(kitchenAreaSpecs.areaSelections.kickPanels.material, "Aluminium", "brushed aluminium kick-panel material persists");
assert.equal(kitchenAreaSpecs.areaSelections.kickPanels.heightMm, "150", "optional kick-panel height persists");
assert.equal(kitchenAreaSpecs.bulkheadFinishMode, "raw_mdf_wall_paint", "bulkhead finish mode persists on the location");
assert.equal(kitchenAreaSpecs.kickPanelFinishMode, "brushed_aluminium", "kick-panel finish mode persists on the location");

const bathroomColour = LAMINEX_CABINETRY_CATALOGUE.find((item) => item.colourName === "Polar White") || LAMINEX_CABINETRY_CATALOGUE[0];
const bathroomWallColour = POLYTEC_CABINETRY_CATALOGUE.find((item) => item.colourName === "Agave") || POLYTEC_CABINETRY_CATALOGUE[0];
const bathroomDraft = normaliseCabinetrySelection({
  ...draft,
  locations: draft.locations.map((location) => location.location === "Bathroom" ? {
    ...location,
    bathroomScopeKeys: ["floorMountedVanity", "wallMountedVanity", "tallLinenCupboard", "mirroredShavingCabinet", "linenBulkhead"],
    enabledAreaKeys: ["floorVanityDoors", "floorVanityDrawers", "wallVanityDoors", "wallVanityDrawers", "tallLinenDoors", "tallLinenEndPanels", "linenBulkhead"],
    areaSelections: {
      floorVanityDoors: bathroomColour,
      floorVanityDrawers: bathroomColour,
      wallVanityDoors: bathroomWallColour,
      wallVanityDrawers: bathroomWallColour,
      tallLinenDoors: { id: "tall-match-wall", areaKey: "tallLinenDoors", material: "Match wall-mounted vanity", finishMode: "match_wall_vanity", colourName: "Match wall-mounted vanity", finish: "Match wall-mounted vanity" },
      tallLinenEndPanels: { id: "tall-end-match-tall", areaKey: "tallLinenEndPanels", material: "Match tall linen cupboard", finishMode: "match_tall_linen", colourName: "Match tall linen cupboard", finish: "Match tall linen cupboard" },
      linenBulkhead: { id: "linen-bulkhead-raw-mdf-wall-paint", areaKey: "linenBulkhead", material: "Raw MDF", finalFinish: "Painted", paintSource: "match_wall_colour", colourName: "Painted to match walls", finish: "Painted to match walls", supplier: "", finishMode: "raw_mdf_wall_paint", procurementDescription: "Supply and install Raw MDF bulkheads, prepared and painted to match internal wall colour." },
    },
    bathroomBenchtops: {
      floorMountedVanity: { targetKey: "floorMountedVanity", materialChoice: "Stone benchtop", supplier: "Caesarstone", productRange: "Mineral", colourName: "Fresh Concrete", finish: "Honed", thickness: "20 mm", edgeProfile: "Square arris" },
      wallMountedVanity: { targetKey: "wallMountedVanity", materialChoice: "Stone with mitred drop front", supplier: "Smartstone", productRange: "Porcelain", colourName: "Calacatta", finish: "Natural", thickness: "12 mm", dropFrontDetail: "Mitred drop front required" },
    },
    bathroomHandles: {
      floorMountedVanity: { openingMethod: "Finger Pull - Shark Fin", productName: "Finger Pull - Shark Fin" },
      wallMountedVanity: { openingMethod: "Push-to-open", productName: "Push-to-open" },
      tallLinenCupboard: { openingMethod: "Pull handle from Handle House builder range", productCode: "C3", selectedFinish: "Brushed Stainless Steel" },
      mirroredShavingCabinet: { openingMethod: "Handleless", productName: "Handleless" },
    },
  } : location),
  schedule: [
    ...draft.schedule,
    { componentId: "CAB-BATH-FLOOR-2DOOR", location: "Bathroom", type: "bath-floor-two-door", unitType: "Base unit with two doors", quantity: 1, width: "900", handleQuantity: 2, clientSelectableSurfaces: ["floorVanityDoors"] },
    { componentId: "CAB-BATH-WALL-3DRAWER", location: "Bathroom", type: "bath-wall-three-drawer", unitType: "Three-drawer unit", quantity: 1, width: "1200", handleQuantity: 3, clientSelectableSurfaces: ["wallVanityDrawers"] },
    { componentId: "CAB-BATH-TALL-LINEN", location: "Bathroom", type: "bath-tall-linen", unitType: "Tall linen cupboard", quantity: 1, width: "600", handleQuantity: 2, clientSelectableSurfaces: ["tallLinenDoors", "tallLinenEndPanels"] },
    { componentId: "CAB-BATH-SHAVING", location: "Bathroom", type: "bath-shaving-two-door", unitType: "Two-door mirrored shaving cabinet", quantity: 1, width: "900", handleQuantity: 0, clientSelectableSurfaces: [] },
  ],
});
const bathroomLocation = bathroomDraft.locations.find((item) => item.location === "Bathroom");
assert.deepEqual(bathroomLocation.bathroomScopeKeys, ["floorMountedVanity", "wallMountedVanity", "tallLinenCupboard", "mirroredShavingCabinet", "linenBulkhead"], "Bathroom scope persists independently of Kitchen area scope");
assert.ok(bathroomLocation.enabledAreaKeys.includes("floorVanityDoors"), "Bathroom floor vanity doors remain enabled after normalisation");
assert.ok(bathroomLocation.enabledAreaKeys.includes("wallVanityDrawers"), "Bathroom wall vanity drawers remain enabled after normalisation");
assert.ok(bathroomLocation.enabledAreaKeys.includes("linenBulkhead"), "Bathroom linen bulkhead remains enabled after normalisation");
assert.equal(bathroomLocation.areaSelections.linenBulkhead.material, "Raw MDF", "Bathroom bulkhead can be Raw MDF without catalogue colour");
assert.equal(bathroomLocation.areaSelections.tallLinenEndPanels.finishMode, "match_tall_linen", "Bathroom tall linen end panels can deliberately match tall linen");
assert.equal(bathroomLocation.bathroomBenchtops.wallMountedVanity.dropFrontDetail, "Mitred drop front required", "wall-mounted vanity retains mitred drop-front detail");
assert.equal(bathroomLocation.bathroomHandles.wallMountedVanity.openingMethod, "Push-to-open", "Bathroom handles persist per cabinet group");
assert.ok(bathroomDraft.schedule.some((line) => line.type === "bath-floor-two-door" && line.width === "900"), "Bathroom schedule stores standard item width without Add Row flow");
assert.ok(bathroomDraft.schedule.some((line) => line.type === "bath-shaving-two-door" && line.clientSelectableSurfaces.length === 0), "mirrored shaving cabinet mirror faces are not decorative board colour areas");

draft = copyCabinetryLocation(bathroomDraft, "Bathroom", ["Ensuite"]);
draft = overrideCabinetryArea(draft, "Ensuite", "floorVanityDoors", POLYTEC_CABINETRY_CATALOGUE.find((item) => item.colourName === "Evergreen"));
assert.notEqual(draft.locations.find((item) => item.location === "Bathroom").areaSelections.floorVanityDoors.colourName, draft.locations.find((item) => item.location === "Ensuite").areaSelections.floorVanityDoors.colourName, "Ensuite wet-area colour override does not overwrite Bathroom");
const ensuiteLocation = draft.locations.find((item) => item.location === "Ensuite");
assert.deepEqual(ensuiteLocation.bathroomScopeKeys, bathroomLocation.bathroomScopeKeys, "Ensuite uses the same wet-area scope structure as Bathroom");
assert.ok(ensuiteLocation.enabledAreaKeys.every((areaKey) => requiredBathroomAreas.includes(areaKey)), "Ensuite enabled areas are restricted to wet-area vanity surfaces");

const legacyEnsuiteDraft = normaliseCabinetrySelection({
  locations: [{
    location: "Ensuite",
    included: true,
    bathroomScopeKeys: ["floorMountedVanity", "mirroredShavingCabinet"],
    enabledAreaKeys: ["lowerDoorsDrawers", "islandBenchBack", "endPanels", "overheadDoors", "floorVanityDoors"],
    areaSelections: {
      lowerDoorsDrawers: POLYTEC_CABINETRY_CATALOGUE[0],
      floorVanityDoors: bathroomColour,
    },
  }],
  schedule: [
    { componentId: "CAB-ENS-KITCHEN-BASE", location: "Ensuite", unitType: "Standard base unit", quantity: 1, handleQuantity: 1 },
    { componentId: "CAB-ENS-KITCHEN-DISH", location: "Ensuite", unitType: "Dishwasher cabinet", quantity: 1, handleQuantity: 1 },
    { componentId: "CAB-ENS-FLOOR", location: "Ensuite", type: "bath-floor-two-door", unitType: "Base unit with 2 doors", quantity: 1, handleQuantity: 2, clientSelectableSurfaces: ["floorVanityDoors"] },
  ],
});
const legacyEnsuite = legacyEnsuiteDraft.locations.find((item) => item.location === "Ensuite");
assert.deepEqual(legacyEnsuite.enabledAreaKeys, ["floorVanityDoors"], "legacy Ensuite Kitchen-shaped area keys are ignored");
assert.equal(legacyEnsuiteDraft.schedule.length, 1, "legacy Ensuite Kitchen schedule rows are ignored");
assert.equal(legacyEnsuiteDraft.schedule[0].type, "bath-floor-two-door", "legacy Ensuite keeps compatible wet-area schedule rows");
const legacyEnsuiteColourMigration = normaliseCabinetrySelection({
  locations: [{
    location: "Ensuite",
    included: true,
    enabledAreaKeys: ["lowerDoorsDrawers"],
    areaSelections: { lowerDoorsDrawers: POLYTEC_CABINETRY_CATALOGUE[0] },
  }],
});
const migratedEnsuite = legacyEnsuiteColourMigration.locations.find((item) => item.location === "Ensuite");
assert.deepEqual(migratedEnsuite.bathroomScopeKeys, ["floorMountedVanity"], "legacy Ensuite lower-door scope migrates to floor-mounted vanity");
assert.equal(migratedEnsuite.areaSelections.floorVanityDoors.colourName, POLYTEC_CABINETRY_CATALOGUE[0].colourName, "legacy Ensuite lower-door colour is preserved as floor vanity colour");

const payload = buildCabinetrySelectionPayload({ workspaceId: "workspace-1", projectId: "project-1", requirement: KITCHEN_REQUIREMENTS[0], selection: draft });
const connected = payload.selected_details.cabinetrySelection;
const bathroomPayload = buildCabinetrySelectionPayload({ workspaceId: "workspace-1", projectId: "project-1", requirement: KITCHEN_REQUIREMENTS[0], selection: bathroomDraft });
const bathroomConnected = bathroomPayload.selected_details.cabinetrySelection;
assert.equal(payload.selected_details.requirementKey, "cabinetry", "selection saves as one cabinetry record");
assert.equal(payload.selected_details.selectionType, "cabinetry_specification", "selection has canonical cabinetry selection type");
assert.equal(payload.selected_details.workflowType, "guided_cabinetry", "selection routes by canonical cabinetry workflow type");
assert.equal(payload.selected_details.schemaVersion, 2, "selection has cabinetry schema version");
assert.equal(connected.summary.allowance, 2500, "existing Cabinetry allowance remains attached to Cabinetry");
assert.ok(payload.metadata.connectedAliases.includes("handles"), "legacy Handles row aliases route into Cabinetry");
assert.ok(connected.boqLines.some((line) => line.unit === "EACH" && line.itemName.includes("handles")), "BOQ has handle quantity lines");
assert.ok(connected.boqLines.some((line) => line.material === "Raw MDF" && line.itemName === "Supply and install Raw MDF bulkheads, prepared and painted to match internal wall colour."), "BOQ exports Raw MDF bulkheads as a material specification");
assert.ok(connected.boqLines.some((line) => line.material === "Aluminium" && line.itemName === "Supply and install brushed aluminium kick panels."), "BOQ exports brushed aluminium kick panels as a material specification");
assert.equal(connected.cabinetmakerRfq.lines.reduce((sum, line) => sum + line.handleQuantity, 0), connected.summary.handleQuantity, "RFQ handle quantity reconciles to schedule");
assert.ok(connected.cabinetmakerRfq.areaSpecifications.some((line) => line.material === "Raw MDF" && line.paintSource === "match_wall_colour"), "cabinetmaker RFQ includes Raw MDF wall-paint bulkhead area specification");
assert.ok(connected.cabinetmakerRfq.areaSpecifications.some((line) => line.material === "Aluminium" && line.finish === "Brushed aluminium"), "cabinetmaker RFQ includes brushed aluminium kick-panel area specification");
assert.ok(connected.procurementSchedule.length >= connected.boqLines.length, "procurement schedule is generated from cabinetry BOQ lines");
assert.ok(connected.procurementSchedule.some((line) => line.metadata?.material === "Raw MDF"), "procurement schedule retains Raw MDF bulkhead material");
assert.ok(connected.procurementSchedule.some((line) => line.metadata?.material === "Aluminium" && line.metadata?.finish === "Brushed aluminium"), "procurement schedule retains brushed aluminium kick-panel finish");
assert.ok(bathroomConnected.cabinetmakerRfq.areaSpecifications.some((line) => line.location === "Bathroom" && line.areaKey === "linenBulkhead" && line.material === "Raw MDF"), "Bathroom cabinetmaker RFQ includes Raw MDF linen bulkhead");
assert.ok(bathroomConnected.boqLines.some((line) => line.location === "Bathroom" && line.itemName.includes("Raw MDF bulkheads")), "Bathroom BOQ exports linen bulkhead as a Raw MDF material specification");
assert.equal(connected.summary.selectedPrice, null, "pricing remains pending until builder rates or supplier quote exists");
assert.ok(connected.pricingTiers.every((tier) => CABINETRY_PRICING_TIERS.some((configured) => configured.key === tier.key)), "builder-configurable pricing tiers are attached");
assert.ok(connected.supplierRecords.find((item) => item.supplier === "Laminex")?.importedRecords >= 6, "Laminex ranges imported with verification record");
assert.ok(connected.supplierRecords.find((item) => item.supplier === "Polytec")?.importedRecords >= 8, "Polytec ranges imported with verification record");
assert.ok(connected.supplierRecords.find((item) => item.supplier === "Handle House")?.importedRecords >= 8, "Handle House products imported with verification record");

const pantryColourDraft = normaliseCabinetrySelection({
  ...draft,
  locations: draft.locations.map((location) => location.location === "Butler's Pantry" ? {
    ...location,
    enabledAreaKeys: ["lowerDoorsDrawers", "overheadDoors", "endPanels"],
    areaSelections: { lowerDoorsDrawers: null, overheadDoors: null, endPanels: POLYTEC_CABINETRY_CATALOGUE.find((item) => item.colourName === "Agave") },
    coloursAndFinishes: { ...(location.coloursAndFinishes || {}), areaSelections: { lowerDoorsDrawers: null, overheadDoors: null, endPanels: POLYTEC_CABINETRY_CATALOGUE.find((item) => item.colourName === "Agave") } },
    benchtop: { supplier: "Pantry supplier", range: "Manual pantry top" },
    handles: { base: { productName: "Manual pantry handle" } },
  } : location),
  schedule: [
    ...draft.schedule,
    { componentId: "CAB-PANTRY-MANUAL-BASE", location: "Butler's Pantry", unitType: "Standard base unit", quantity: 2, notes: "Manual pantry row" },
    { componentId: "CAB-PANTRY-MANUAL-SINK", location: "Butler's Pantry", unitType: "Sink cupboard", quantity: 1, notes: "Manual pantry row" },
    { componentId: "CAB-KIT-COPIED-OVEN-butler-s-pantry-1", location: "Butler's Pantry", unitType: "Underbench oven cabinet", quantity: 1, notes: "Builder-defined schedule - Copied from Kitchen" },
    { componentId: "CAB-KIT-COPIED-DISH-butler-s-pantry-2", location: "Butler's Pantry", unitType: "Dishwasher cabinet", quantity: 1, notes: "Copied from Kitchen" },
  ],
});
assert.equal(pantryColourDraft.schedule.filter(kitchenPantryCopiedScheduleLine).length, 2, "incorrect Kitchen-to-Pantry copied schedule rows are detected by copy marker");
const cleanedPantryDraft = cleanIncorrectButlersPantryCopiedScheduleRows(pantryColourDraft);
assert.ok(cleanedPantryDraft.schedule.some((item) => item.componentId === "CAB-PANTRY-MANUAL-BASE"), "manual Pantry base unit row is preserved during cleanup");
assert.ok(cleanedPantryDraft.schedule.some((item) => item.componentId === "CAB-PANTRY-MANUAL-SINK"), "manual Pantry sink cupboard row is preserved during cleanup");
assert.equal(cleanedPantryDraft.schedule.some((item) => /Copied from Kitchen/i.test(item.notes || "")), false, "copied Kitchen schedule rows are removed from Pantry");
const colourOnlyPantry = applyKitchenColoursToButlersPantry(cleanedPantryDraft, { areaKeys: ["lowerDoorsDrawers", "overheadDoors", "endPanels", "kickPanels", "bulkheads"], overwrite: false });
const colourOnlyKitchen = colourOnlyPantry.locations.find((item) => item.location === "Kitchen");
const colourOnlyPantryRoom = colourOnlyPantry.locations.find((item) => item.location === "Butler's Pantry");
assert.equal(colourOnlyPantryRoom.areaSelections.lowerDoorsDrawers?.colourName, colourOnlyKitchen.areaSelections.lowerDoorsDrawers?.colourName, "Kitchen lower door colour copies to existing Pantry lower doors");
assert.equal(colourOnlyPantryRoom.areaSelections.overheadDoors?.colourName, colourOnlyKitchen.areaSelections.overheadDoors?.colourName, "Kitchen overhead colour copies to existing Pantry overheads");
assert.equal(colourOnlyPantryRoom.areaSelections.endPanels?.colourName, "Agave", "existing Pantry colour is preserved by default");
assert.equal(colourOnlyPantryRoom.areaSelections.kickPanels, null, "Kitchen kick panels are not added when Pantry kick panels are not enabled");
assert.equal(colourOnlyPantryRoom.areaSelections.bulkheads, null, "Kitchen bulkheads are not added when Pantry bulkheads are not enabled");
assert.equal(colourOnlyPantryRoom.benchtop.range, "Manual pantry top", "Pantry benchtop is not copied from Kitchen");
assert.equal(colourOnlyPantryRoom.handles.base.productName, "Manual pantry handle", "Pantry handles are not copied from Kitchen");
const pantryOverhead = LAMINEX_CABINETRY_CATALOGUE.find((item) => item.colourName && item.colourName !== colourOnlyKitchen.areaSelections.overheadDoors?.colourName);
const changedPantry = overrideCabinetryArea(colourOnlyPantry, "Butler's Pantry", "overheadDoors", pantryOverhead);
assert.notEqual(changedPantry.locations.find((item) => item.location === "Kitchen").areaSelections.overheadDoors?.colourName, changedPantry.locations.find((item) => item.location === "Butler's Pantry").areaSelections.overheadDoors?.colourName, "changing Pantry colour does not change Kitchen colour");

const selectionsSource = fs.readFileSync("pages/modules/builders/selections-book.js", "utf8");
const productLibraryCabinetrySource = fs.readFileSync("lib/product-library/cabinetryCatalogueSelectors.js", "utf8");
const cabinetryUiContractSource = `${selectionsSource}\n${productLibraryCabinetrySource}`;
assert.match(selectionsSource, /GuidedCabinetryWorkflow/, "Client Selections renders the connected Cabinetry workflow");
assert.match(selectionsSource, /cabinetryScheduleItems/, "landscape selections schedule expands cabinetry by location");
assert.match(selectionsSource, /data-workflow-type=\{CABINETRY_WORKFLOW_TYPE\}/, "Cabinetry workflow routes by canonical workflow type");
assert.match(selectionsSource, /data-testid="cabinetry-apply-colour-to"/, "Colours & Finishes exposes an Apply colour to area selector");
assert.match(selectionsSource, /data-testid="cabinetry-area-colour-summary"/, "Colours & Finishes exposes a per-area colour summary");
assert.match(selectionsSource, /Select at least one cabinetry area before applying this colour/, "Colour application cannot silently fail without areas");
assert.match(cabinetryUiContractSource, /Raw MDF - painted to match walls/, "Bulkheads expose Raw MDF painted-to-wall option");
assert.match(cabinetryUiContractSource, /Brushed aluminium/, "Kick panels expose brushed aluminium option");
assert.match(selectionsSource, /WET_AREA_CABINETRY_CONFIG/, "Bathroom and Ensuite share one wet-area cabinetry configuration");
assert.match(cabinetryUiContractSource, /Select the vanity cabinetry required in the/, "wet-area Scope uses active room-specific copy");
assert.match(cabinetryUiContractSource, /Floor-mounted vanity/, "wet-area schedule has floor-mounted vanity group");
assert.match(cabinetryUiContractSource, /Wall-mounted vanity/, "wet-area schedule has wall-mounted vanity group");
assert.match(cabinetryUiContractSource, /Additional bathroom cabinetry/, "wet-area schedule groups tall linen, shaving cabinet and bulkhead choices");
assert.match(cabinetryUiContractSource, /Bulkhead over tall cupboard/, "Bathroom bulkhead is specific to tall cupboard workflow");
assert.match(cabinetryUiContractSource, /Stone with mitred drop front/, "Bathroom wall-mounted vanity benchtop retains mitred drop-front option");
assert.match(selectionsSource, /bathroomStoneTargetKey/, "Bathroom stone benchtop catalogue targets one vanity at a time");
assert.match(selectionsSource, /bathroom-\$\{targetKey\}-stone-benchtop-selector/, "Bathroom vanity benchtops use the visual stone catalogue selector");
assert.ok(!selectionsSource.includes('<label><span>Supplier</span><input value={current.supplier || ""}'), "Bathroom vanity benchtops no longer start with disconnected supplier text fields");
assert.match(selectionsSource, /bathroom-cabinetry-review-summary/, "Bathroom review renders a room-specific grouped summary");
assert.match(selectionsSource, /WET_AREA_CABINETRY_ROOM_NAMES/, "Ensuite resolves to wet-area cabinetry before any Kitchen fallback");
assert.match(selectionsSource, /Apply Kitchen Colours to Butler's Pantry/, "Kitchen review exposes the Pantry colours-only action");
assert.doesNotMatch(selectionsSource, /Copy Kitchen Selections to Butler's Pantry/, "Kitchen-to-Pantry UI does not expose a full specification-copy action");
assert.doesNotMatch(selectionsSource, /Copy this section to Butler's Pantry/, "Kitchen-to-Pantry modal does not offer section-level copying");
assert.match(selectionsSource, /data-testid=\"cabinetry-copy-kitchen-pantry-modal\"/, "Kitchen-to-Pantry copy confirmation modal is rendered");
assert.match(selectionsSource, /data-testid=\{`cabinetry-\$\{position\}-workflow-actions`\}/, "Cabinetry uses shared top and bottom workflow actions");
assert.match(selectionsSource, /cabinetryBackToTop/, "Cabinetry workflow includes a floating Back to Top control");
assert.doesNotMatch(selectionsSource, /Cabinetry legacy selections ready to finish/, "client interface does not render legacy cabinetry wording");
assert.doesNotMatch(selectionsSource, /Kitchen.*Cabinet Finish.*Handles.*Benchtop/s, "Kitchen checklist does not hard-code disconnected Cabinet Finish, Handles and Benchtop rows");
assert.doesNotMatch(selectionsSource, /Apply this selection to all selected cabinetry areas/, "Doors & Panels does not render the confusing apply-to-all row");

console.log(`Cabinetry workflow tests passed. Locations=${connected.summary.locationCount} Components=${connected.summary.scheduleLineCount} HandleQty=${connected.summary.handleQuantity}`);
