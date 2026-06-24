import { AUSTRALIAN_DEFAULTS, getDefaultFloorArea } from "./data/australianDefaults.js";

export function createEstimateInputDefaults(plannerAnswers = {}) {
  const projectType = plannerAnswers.projectType || "Single Storey Home";
  const totalLivingM2 = getDefaultFloorArea(projectType);
  const storeys = projectType === "Triple Storey Home" ? 3 : projectType === "Double Storey Home" || projectType === "Duplex" ? 2 : 1;
  const footprintM2 = Math.round(totalLivingM2 / storeys);
  const perimeterLm = Math.round(Math.sqrt(footprintM2) * 4);
  const roofM2 = Math.round(footprintM2 * 1.17);
  const wallM2 = Math.round(perimeterLm * AUSTRALIAN_DEFAULTS.wallHeightM * storeys);

  return {
    projectBasics: section({
      jobName: "Draft Estimate",
      clientName: "",
      siteAddress: "",
      projectType,
      storeys,
      totalLivingM2,
      groundFloorM2: footprintM2,
      firstFloorM2: storeys > 1 ? footprintM2 : 0,
      secondFloorM2: storeys > 2 ? footprintM2 : 0,
      garageM2: 36,
      alfrescoM2: 24,
      porchM2: 6,
      balconyM2: plannerAnswers.additionalFeatures?.includes("Balconies") ? 14 : 0,
    }),
    siteworks: section({
      siteSlope: plannerAnswers.siteConditions || "Flat Site",
      accessDifficulty: plannerAnswers.siteAccess || "Easy",
      cutFillM3: plannerAnswers.siteConditions === "Heavy Cut & Fill" ? 90 : 12,
      retainingWallLm: plannerAnswers.retainingWalls && plannerAnswers.retainingWalls !== "None" ? 18 : 0,
      drivewayM2: 50,
      pathsM2: 20,
      stormwaterPits: 3,
      agPipeLm: 20,
      landscapingM2: 90,
    }),
    slabConcrete: section({
      slabType: plannerAnswers.slabType || "Waffle Pod",
      slabAreaM2: footprintM2 + 36 + 24,
      edgeBeamLm: perimeterLm,
      concreteM3: Math.round((footprintM2 + 60) * 0.12 * 10) / 10,
      reinforcementM2: footprintM2 + 60,
      wafflePodsM2: plannerAnswers.slabType === "Waffle Pod" || !plannerAnswers.slabType ? footprintM2 + 60 : 0,
      pierCount: 0,
      pierDepthM: 0,
      suspendedSlabM2: plannerAnswers.slabType === "Suspended Slab" ? footprintM2 : 0,
    }),
    externalWalls: section({
      externalWallLm: perimeterLm * storeys,
      wallHeightM: AUSTRALIAN_DEFAULTS.wallHeightM,
      groundWallSystem: plannerAnswers.groundExternalWall || plannerAnswers.wallConstruction || "Brick Veneer",
      upperWallSystem: plannerAnswers.firstExternalWall || plannerAnswers.wallConstruction || "Brick Veneer",
      brickVeneerM2: wallSystemArea("Brick Veneer", plannerAnswers, wallM2),
      blockworkM2: wallSystemArea("Blockwork", plannerAnswers, wallM2),
      hebelM2: wallSystemArea("Hebel", plannerAnswers, wallM2),
      lightweightCladdingM2: wallSystemArea("Lightweight cladding", plannerAnswers, wallM2),
      renderM2: wallSystemArea("Rendered cladding", plannerAnswers, wallM2),
    }),
    internalWallsFraming: section({
      internalWallLm: Math.round(totalLivingM2 * 0.75),
      wallHeightM: AUSTRALIAN_DEFAULTS.wallHeightM,
      frameType: plannerAnswers.groundInternalFrame || "Timber",
      timberFrameLm: Math.round(totalLivingM2 * 0.95),
      steelFrameLm: 0,
      bracingPanels: Math.max(8, Math.round(totalLivingM2 / 28)),
      structuralSteelRequired: plannerAnswers.additionalFeatures?.includes("Structural Steel") || false,
      structuralSteelTonnes: plannerAnswers.additionalFeatures?.includes("Structural Steel") ? Math.round(totalLivingM2 * 0.006 * 10) / 10 : 0,
    }),
    roof: section({
      roofAreaM2: roofM2,
      roofPitchDegrees: AUSTRALIAN_DEFAULTS.roofPitchDegrees,
      roofType: plannerAnswers.roofType || "Colorbond",
      guttersLm: Math.round(perimeterLm * 1.1),
      fasciaLm: Math.round(perimeterLm * 1.1),
      downpipesCount: 6,
      insulationM2: roofM2,
      sarkingM2: roofM2,
    }),
    doorsWindows: section({ entryDoorType: "Hinged", entryDoorSize: "920 x 2040", internalDoorCount: 14, cavitySliderCount: 2, garageDoorType: "Sectional", garageDoorSize: "Double", windowCount: 16, slidingDoorCount: 2, stackerDoorCount: 0, securityScreenCount: 0 }),
    kitchenAppliances: section({ oven: "Allowance", cooktop: "Allowance", rangehood: "Allowance", dishwasher: "Allowance", microwaveProvision: true, fridgeTap: true, cabinetryLm: Math.max(9, Math.round(totalLivingM2 * 0.045)), benchtopType: "Stone", benchtopM2: 6 }),
    bathroomsPlumbing: section({ vanities: 2, basins: 2, toilets: 2, showers: 2, baths: 1, tapwareSets: 5, towelRails: 2, mirrors: 2, accessories: 6, hotWaterSystem: "Heat pump" }),
    electrical: section({ powerPoints: Math.round(totalLivingM2 / 5), lights: 18, downlights: Math.round(totalLivingM2 / 5), fans: 4, switches: 18, smokeAlarms: 4, dataPoints: 4, tvPoints: 3, solarKw: 0, batteryKwh: 0, evCharger: false }),
    liningsFinishes: section({ plasterboardWallM2: Math.round(totalLivingM2 * 2.8), ceilingM2: totalLivingM2, corniceLm: Math.round(totalLivingM2 * 0.8), skirtingLm: Math.round(totalLivingM2 * 0.75), architravesLm: 140, internalPaintM2: Math.round(totalLivingM2 * 3.2), externalPaintM2: Math.round(wallM2 * 0.3) }),
    flooringTiling: section({ carpetM2: 80, vinylHybridM2: 90, timberFlooringM2: 0, tileFloorM2: 45, wallTileM2: 55, waterproofingM2: 32 }),
    joineryFitout: section({ wardrobes: 4, linenCupboards: 1, laundryCabinetryLm: 3, robeShelvingLm: 12, shelvingLm: 8, storageUnits: 1 }),
    externalWorks: section({ decksM2: 0, patiosM2: 0, fencingLm: 0, turfM2: 80, gardenBedsM2: 20, retainingLm: plannerAnswers.retainingWalls && plannerAnswers.retainingWalls !== "None" ? 18 : 0, poolIncluded: plannerAnswers.additionalFeatures?.includes("Pool") || false, shedM2: 0 }),
    allowancesSelections: section({ pcItemCount: 8, provisionalSumCount: 3, clientSelectionCount: 10, supplierAllowances: "Placeholder only", upgradeOptions: "Placeholder only" }, { allowance: true }),
  };
}

function section(values, meta = {}) {
  return { included: true, allowance: false, provisionalSum: false, notes: "", overrides: {}, ...meta, values };
}

function wallSystemArea(system, answers, wallM2) {
  const systems = [answers.wallConstruction, answers.groundExternalWall, answers.firstExternalWall, answers.secondExternalWall].filter(Boolean);
  if (!systems.length && system === "Brick Veneer") return wallM2;
  return systems.some((item) => String(item).toLowerCase() === system.toLowerCase()) ? Math.round(wallM2 / Math.max(1, systems.length)) : 0;
}
