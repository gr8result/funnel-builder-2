import { REQUIRED_ESTIMATE_FIELDS } from "./estimateInputSchema.js";
import { createEstimateInputDefaults } from "./estimateInputDefaults.js";

export function normaliseDetailedEstimateInput(input = {}) {
  const defaults = createEstimateInputDefaults();
  const sections = {};
  Object.keys(defaults).forEach((sectionKey) => {
    const section = input[sectionKey] || {};
    sections[sectionKey] = {
      ...defaults[sectionKey],
      ...section,
      values: { ...defaults[sectionKey].values, ...(section.values || {}) },
      overrides: { ...(section.overrides || {}) },
    };
  });

  const v = (section, key) => valueFor(sections, section, key);
  const additionalFeatures = [];
  if (v("internalWallsFraming", "structuralSteelRequired")) additionalFeatures.push("Structural Steel");
  if (v("externalWorks", "poolIncluded")) additionalFeatures.push("Pool");

  return {
    sections,
    engineInputs: {
      projectType: v("projectBasics", "projectType"),
      siteConditions: v("siteworks", "siteSlope"),
      slabType: v("slabConcrete", "slabType"),
      wallConstruction: v("externalWalls", "groundWallSystem"),
      groundExternalWall: v("externalWalls", "groundWallSystem"),
      firstExternalWall: v("externalWalls", "upperWallSystem"),
      roofType: v("roof", "roofType"),
      retainingWalls: v("siteworks", "retainingWallLm") > 0 ? "Engineered Retaining" : "None",
      siteAccess: v("siteworks", "accessDifficulty"),
      additionalFeatures,
      floorAreaM2: v("projectBasics", "totalLivingM2"),
      wallHeightM: v("externalWalls", "wallHeightM"),
      roofPitchDegrees: v("roof", "roofPitchDegrees"),
    },
  };
}

export function findMissingRequiredFields(input = {}) {
  return REQUIRED_ESTIMATE_FIELDS
    .filter(([section, key]) => {
      const value = input?.[section]?.values?.[key];
      return value === "" || value === null || value === undefined || Number(value) === 0;
    })
    .map(([section, key]) => ({ section, key }));
}

export function valueFor(sections, sectionKey, fieldKey) {
  const section = sections?.[sectionKey] || {};
  if (section.overrides && section.overrides[fieldKey] !== "" && section.overrides[fieldKey] !== undefined) {
    return section.overrides[fieldKey];
  }
  return section.values?.[fieldKey];
}
