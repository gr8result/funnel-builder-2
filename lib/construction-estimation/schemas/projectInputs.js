import { AUSTRALIAN_DEFAULTS, getDefaultFloorArea } from "../data/australianDefaults.js";

export const PROJECT_INPUT_FIELDS = [
  "projectType",
  "siteConditions",
  "slabType",
  "wallConstruction",
  "roofType",
  "retainingWalls",
  "siteAccess",
  "additionalFeatures",
  "floorAreaM2",
  "wallHeightM",
  "roofPitchDegrees",
];

export function normaliseProjectInputs(input = {}) {
  const projectType = input.projectType || "Single Storey Home";
  return {
    projectType,
    siteConditions: input.siteConditions || "Flat Site",
    slabType: input.slabType || "Waffle Pod",
    wallConstruction: input.wallConstruction || "Brick Veneer",
    groundExternalWall: input.groundExternalWall || input.wallConstruction || "Brick Veneer",
    firstExternalWall: input.firstExternalWall || null,
    secondExternalWall: input.secondExternalWall || null,
    roofType: input.roofType || "Colorbond",
    retainingWalls: input.retainingWalls || "None",
    siteAccess: input.siteAccess || "Easy",
    additionalFeatures: Array.isArray(input.additionalFeatures) ? input.additionalFeatures : [],
    floorAreaM2: Number(input.floorAreaM2) || getDefaultFloorArea(projectType),
    wallHeightM: Number(input.wallHeightM) || AUSTRALIAN_DEFAULTS.wallHeightM,
    roofPitchDegrees: Number(input.roofPitchDegrees) || AUSTRALIAN_DEFAULTS.roofPitchDegrees,
    floorBreakdown: input.floorBreakdown || {},
  };
}
