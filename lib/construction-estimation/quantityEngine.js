import { AUSTRALIAN_DEFAULTS } from "./data/australianDefaults.js";
import { normaliseProjectInputs } from "./schemas/projectInputs.js";

function roofPitchFactor(degrees) {
  const radians = (Number(degrees) || AUSTRALIAN_DEFAULTS.roofPitchDegrees) * Math.PI / 180;
  return 1 / Math.cos(radians);
}

function storeyCount(projectType) {
  if (projectType === "Triple Storey Home") return 3;
  if (projectType === "Double Storey Home" || projectType === "Duplex") return 2;
  return 1;
}

export function calculateQuantities(rawInput = {}) {
  const input = normaliseProjectInputs(rawInput);
  const storeys = storeyCount(input.projectType);
  const floorAreaM2 = input.floorAreaM2;
  const footprintM2 = floorAreaM2 / storeys;
  const perimeterLm = Math.sqrt(footprintM2) * 4;
  const roofM2 = footprintM2 * roofPitchFactor(input.roofPitchDegrees) * 1.08;
  const externalWallM2 = perimeterLm * input.wallHeightM * storeys;
  const upperExternalWallM2 = storeys > 1 ? externalWallM2 * ((storeys - 1) / storeys) : externalWallM2;
  const internalWallLm = floorAreaM2 * 0.75;
  const wetAreaM2 = Math.max(28, floorAreaM2 * 0.12);

  return {
    siteItem: 1,
    floorAreaM2: round(floorAreaM2),
    footprintM2: round(footprintM2),
    slabM2: round(footprintM2),
    roofM2: round(roofM2),
    roofPerimeterLm: round(perimeterLm * 1.1),
    externalWallM2: round(externalWallM2),
    upperExternalWallM2: round(upperExternalWallM2),
    internalWallLm: round(internalWallLm),
    frameLm: round(internalWallLm + perimeterLm * storeys),
    plasterboardM2: round((internalWallLm * input.wallHeightM * 2) + floorAreaM2),
    insulationM2: round(externalWallM2 + roofM2),
    wetAreaM2: round(wetAreaM2),
    paintM2: round(((internalWallLm * input.wallHeightM * 2) + floorAreaM2) * 1.1),
    flooringM2: round(floorAreaM2 * 0.88),
    cabinetryLm: round(Math.max(8, floorAreaM2 * 0.045)),
    windowDoorItems: Math.max(12, Math.round(floorAreaM2 / 14)),
    plumbingPoints: Math.max(18, Math.round(floorAreaM2 / 9)),
    electricalPoints: Math.max(45, Math.round(floorAreaM2 / 3.5)),
    earthworksM3: round(footprintM2 * siteworksFactor(input.siteConditions)),
    structuralSteelT: input.additionalFeatures.includes("Structural Steel") ? round(floorAreaM2 * 0.006) : 0,
    drivewayM2: round(Math.max(45, footprintM2 * 0.2)),
    landscapingM2: round(Math.max(80, footprintM2 * 0.35)),
    retainingWallLm: input.retainingWalls && input.retainingWalls !== "None" ? round(perimeterLm * 0.35) : 0,
  };
}

function siteworksFactor(siteConditions) {
  if (siteConditions === "Heavy Cut & Fill") return 0.45;
  if (siteConditions === "Steep Slope") return 0.35;
  if (siteConditions === "Moderate Slope") return 0.2;
  if (siteConditions === "Mild Slope") return 0.1;
  return 0.04;
}

function round(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}
