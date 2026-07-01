export const AUSTRALIAN_DEFAULTS = {
  region: "AU-QLD",
  workingWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  wallHeightM: 2.7,
  ceilingHeightM: 2.55,
  roofPitchDegrees: 22.5,
  weatherAllowanceDays: 10,
  miscAllowanceDays: 5,
  unforeseenAllowanceDays: 5,
  wasteFactors: {
    concrete: 0.05,
    reinforcement: 0.08,
    brickwork: 0.08,
    blockwork: 0.08,
    timber: 0.1,
    steel: 0.06,
    roofing: 0.08,
    plasterboard: 0.12,
    insulation: 0.1,
    tiles: 0.1,
    cladding: 0.1,
    paint: 0.08,
    general: 0.05,
  },
  defaultAreas: {
    singleStoreyHomeM2: 220,
    doubleStoreyHomeM2: 320,
    tripleStoreyHomeM2: 420,
    duplexM2: 360,
    renovationExtensionM2: 120,
    garageM2: 36,
    alfrescoM2: 24,
  },
};

export function getDefaultFloorArea(projectType) {
  if (projectType === "Double Storey Home") return AUSTRALIAN_DEFAULTS.defaultAreas.doubleStoreyHomeM2;
  if (projectType === "Triple Storey Home") return AUSTRALIAN_DEFAULTS.defaultAreas.tripleStoreyHomeM2;
  if (projectType === "Duplex") return AUSTRALIAN_DEFAULTS.defaultAreas.duplexM2;
  if (projectType === "Renovation / Extension" || projectType === "Renovation" || projectType === "Extension") {
    return AUSTRALIAN_DEFAULTS.defaultAreas.renovationExtensionM2;
  }
  return AUSTRALIAN_DEFAULTS.defaultAreas.singleStoreyHomeM2;
}
