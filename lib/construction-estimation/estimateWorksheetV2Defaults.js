import { V2_WORKSHEET_SECTIONS } from "./estimateWorksheetV2Schema.js";

export function createEstimateWorksheetV2Defaults(plannerAnswers = {}) {
  const projectType = plannerAnswers.projectType || "Single Storey Home";
  const storeys = projectType === "Triple Storey Home" ? 3 : projectType === "Double Storey Home" || projectType === "Duplex" ? 2 : 1;
  const ground = storeys > 1 ? 160 : 220;
  const first = storeys > 1 ? 140 : 0;
  const second = storeys > 2 ? 110 : 0;
  const sections = {};

  V2_WORKSHEET_SECTIONS.forEach((section) => {
    sections[section.key] = {
      expanded: section.key === "projectBasics",
      rows: Object.fromEntries(section.rows.map((row) => [row.key, rowState(defaultFor(row.key, {
        projectType, storeys, ground, first, second, plannerAnswers,
      }))])),
    };
  });

  return {
    activePage: "rawInputs",
    activeSection: "projectBasics",
    sections,
    windowsDoors: defaultWindowDoorRows(),
  };
}

function rowState(inputValue = "") {
  return {
    inputValue,
    builderOverrideQuantity: "",
    notes: "",
    included: true,
    allowance: false,
    provisionalSum: false,
  };
}

function defaultFor(key, ctx) {
  const total = ctx.ground + ctx.first + ctx.second;
  const map = {
    jobName: "Draft Estimate V2",
    siteAddress: "",
    projectType: ctx.projectType,
    storeys: ctx.storeys,
    siteSlope: ctx.plannerAnswers.siteConditions || "Flat Site",
    accessDifficulty: ctx.plannerAnswers.siteAccess || "Easy",
    wallSystem: ctx.plannerAnswers.wallConstruction || ctx.plannerAnswers.groundExternalWall || "Brick Veneer",
    slabType: ctx.plannerAnswers.slabType || "Waffle Pod",
    roofType: ctx.plannerAnswers.roofType || "Colorbond",
    groundFloorM2: ctx.ground,
    firstFloorM2: ctx.first,
    secondFloorM2: ctx.second,
    garageM2: 36,
    alfrescoM2: 24,
    porchM2: 6,
    balconyM2: ctx.plannerAnswers.additionalFeatures?.includes("Balconies") ? 14 : 0,
    externalWallLm: Math.round(Math.sqrt(ctx.ground) * 4 * ctx.storeys),
    wallHeightM: 2.7,
    internalWallLm: Math.round(total * 0.75),
    internalWallHeightM: 2.7,
    frameType: "Timber",
    roofPlanAreaM2: ctx.ground + 12,
    roofPitchDegrees: 22.5,
    guttersLm: Math.round(Math.sqrt(ctx.ground) * 4 * 1.1),
    fasciaLm: Math.round(Math.sqrt(ctx.ground) * 4 * 1.1),
    downpipesCount: 6,
    edgeBeamLm: Math.round(Math.sqrt(ctx.ground) * 4),
    concreteM3: Math.round((ctx.ground + 60) * 0.12 * 10) / 10,
    reinforcementM2: ctx.ground + 60,
    wafflePodsM2: ctx.ground + 60,
    internalDoorCount: 14,
    cabinetryLm: Math.max(9, Math.round(total * 0.045)),
    vanities: 2,
    toilets: 2,
    showers: 2,
    baths: 1,
    tapwareSets: 5,
    hotWaterSystem: "Heat pump",
    powerPoints: Math.round(total / 5),
    lights: 18,
    downlights: Math.round(total / 5),
    fans: 4,
    smokeAlarms: 4,
    dataPoints: 4,
    tvPoints: 3,
    drivewayM2: 50,
    pathsM2: 20,
    drainageLm: 20,
    landscapingM2: 90,
    turfM2: 80,
    gardenBedsM2: 20,
    pcItemCount: 8,
    provisionalSumCount: 3,
  };
  return map[key] ?? "";
}

function defaultWindowDoorRows() {
  return [
    { id: "wd-entry", itemName: "Entry Door", type: "Entry Door", quantity: 1, height: 2.04, width: 0.92, notes: "" },
    { id: "wd-slide", itemName: "Alfresco Slider", type: "Sliding Door", quantity: 1, height: 2.1, width: 2.4, notes: "" },
    { id: "wd-window-1", itemName: "Bedroom Window", type: "Window", quantity: 4, height: 1.2, width: 1.5, notes: "" },
    { id: "wd-window-2", itemName: "Living Window", type: "Window", quantity: 2, height: 1.8, width: 2.1, notes: "" },
  ];
}
