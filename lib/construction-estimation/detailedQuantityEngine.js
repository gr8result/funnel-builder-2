import { calculateQuantities } from "./quantityEngine.js";
import { normaliseDetailedEstimateInput, valueFor } from "./estimateInputNormalizer.js";

export function calculateDetailedQuantities(input = {}) {
  const normalised = normaliseDetailedEstimateInput(input);
  const sections = normalised.sections;
  const base = calculateQuantities(normalised.engineInputs);
  const q = (section, key) => Number(valueFor(sections, section, key)) || 0;

  return {
    ...base,
    floorAreaM2: q("projectBasics", "totalLivingM2") || base.floorAreaM2,
    slabM2: q("slabConcrete", "slabAreaM2") || base.slabM2,
    roofM2: q("roof", "roofAreaM2") || base.roofM2,
    roofPerimeterLm: q("roof", "guttersLm") || base.roofPerimeterLm,
    externalWallM2: externalWallTotal(sections) || base.externalWallM2,
    upperExternalWallM2: q("externalWalls", "lightweightCladdingM2") || base.upperExternalWallM2,
    internalWallLm: q("internalWallsFraming", "internalWallLm") || base.internalWallLm,
    frameLm: q("internalWallsFraming", "timberFrameLm") + q("internalWallsFraming", "steelFrameLm") || base.frameLm,
    plasterboardM2: q("liningsFinishes", "plasterboardWallM2") || base.plasterboardM2,
    insulationM2: q("roof", "insulationM2") || base.insulationM2,
    wetAreaM2: q("flooringTiling", "waterproofingM2") || base.wetAreaM2,
    paintM2: q("liningsFinishes", "internalPaintM2") || base.paintM2,
    flooringM2: q("flooringTiling", "carpetM2") + q("flooringTiling", "vinylHybridM2") + q("flooringTiling", "timberFlooringM2") + q("flooringTiling", "tileFloorM2") || base.flooringM2,
    cabinetryLm: q("kitchenAppliances", "cabinetryLm") + q("joineryFitout", "laundryCabinetryLm") || base.cabinetryLm,
    windowDoorItems: q("doorsWindows", "windowCount") + q("doorsWindows", "slidingDoorCount") + q("doorsWindows", "stackerDoorCount") + 1 || base.windowDoorItems,
    plumbingPoints: plumbingPoints(sections) || base.plumbingPoints,
    electricalPoints: electricalPoints(sections) || base.electricalPoints,
    earthworksM3: q("siteworks", "cutFillM3") || base.earthworksM3,
    structuralSteelT: q("internalWallsFraming", "structuralSteelTonnes") || base.structuralSteelT,
    drivewayM2: q("siteworks", "drivewayM2") || base.drivewayM2,
    landscapingM2: q("siteworks", "landscapingM2") || base.landscapingM2,
    retainingWallLm: q("siteworks", "retainingWallLm") || q("externalWorks", "retainingLm") || base.retainingWallLm,
    detailed: {
      concreteM3: q("slabConcrete", "concreteM3"),
      brickVeneerM2: q("externalWalls", "brickVeneerM2"),
      blockworkM2: q("externalWalls", "blockworkM2"),
      hebelM2: q("externalWalls", "hebelM2"),
      lightweightCladdingM2: q("externalWalls", "lightweightCladdingM2"),
      renderM2: q("externalWalls", "renderM2"),
      downlights: q("electrical", "downlights"),
      waterproofingM2: q("flooringTiling", "waterproofingM2"),
      pcItemCount: q("allowancesSelections", "pcItemCount"),
      provisionalSumCount: q("allowancesSelections", "provisionalSumCount"),
    },
  };
}

function externalWallTotal(sections) {
  return ["brickVeneerM2", "blockworkM2", "hebelM2", "lightweightCladdingM2", "renderM2"]
    .reduce((sum, key) => sum + (Number(valueFor(sections, "externalWalls", key)) || 0), 0);
}

function plumbingPoints(sections) {
  return ["vanities", "basins", "toilets", "showers", "baths", "tapwareSets"]
    .reduce((sum, key) => sum + (Number(valueFor(sections, "bathroomsPlumbing", key)) || 0), 0);
}

function electricalPoints(sections) {
  return ["powerPoints", "lights", "downlights", "fans", "switches", "smokeAlarms", "dataPoints", "tvPoints"]
    .reduce((sum, key) => sum + (Number(valueFor(sections, "electrical", key)) || 0), 0);
}
