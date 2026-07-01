import { SUBCONTRACTOR_QUOTE_DEDUCTIONS, V4_REQUIRED_FIELDS } from "./estimateWorksheetV4Schema.js";
import { windowDoorApproximateRate, windowDoorApproximateRateSource, withWindowDoorApproximateRate } from "./windowDoorApproximatePricing.js";
import { withDoorScheduleSelection } from "./humeEntryDoorPricing.js";

const REMOVED_IMPORTED_QUOTE_SOURCE_ROWS = new Set([1248, 1250, 1251, 1350, 1351]);
const QUOTE_ROWS_WITHOUT_IMPORTED_DATA = new Set([1272, 1373, 1374, 1380, 1381, 1382]);

export const V4_DEFAULT_FORMULAS = {
  totalExternalWallsLm: "lowerExternalWallsLm + upperExternalWallsLm + thirdExternalWallsLm",
  totalInternalWallsLm: "lowerInternalWallsLm + upperInternalWallsLm + thirdInternalWallsLm",
  totalExternal70mmWallsLm: "lowerExternal70mmWallsLm + upperExternal70mmWallsLm + thirdExternal70mmWallsLm",
  totalExternal90mmWallsLm: "lowerExternal90mmWallsLm + upperExternal90mmWallsLm + thirdExternal90mmWallsLm",
  totalInternal70mmWallsLm: "lowerInternal70mmWallsLm + upperInternal70mmWallsLm + thirdInternal70mmWallsLm",
  totalInternal90mmWallsLm: "lowerInternal90mmWallsLm + upperInternal90mmWallsLm + thirdInternal90mmWallsLm",
  total70mmWallsLm: "totalExternal70mmWallsLm + totalInternal70mmWallsLm",
  total90mmWallsLm: "totalExternal90mmWallsLm + totalInternal90mmWallsLm",
  lowerExternalWallAreaM2: "GroundLevelExternalWallsLm * GroundLevelCeilingHeight",
  upperExternalWallAreaM2: "SecondLevelExternalWallsLm * (SecondLevelCeilingHeight + (SecondLevelFloorDepthMm / 1000))",
  thirdExternalWallAreaM2: "ThirdLevelExternalWallsLm * (ThirdLevelCeilingHeight + (ThirdLevelFloorDepthMm / 1000))",
  totalExternalWallAreaM2: "GroundLevelExternalWallAreaM2 + SecondLevelExternalWallAreaM2 + ThirdLevelExternalWallAreaM2",
  topLevelExternalWallAreaM2: "topLevelExternalWallAreaM2",
  lowerWindowDoorDeductionsM2: "GroundLevelWindowDoorAreaM2",
  upperWindowDoorDeductionsM2: "SecondLevelWindowDoorAreaM2",
  thirdWindowDoorDeductionsM2: "ThirdLevelWindowDoorAreaM2",
  windowDoorDeductionsM2: "lowerWindowDoorDeductionsM2 + upperWindowDoorDeductionsM2 + thirdWindowDoorDeductionsM2",
  upperBulkExternalWallAreaM2: "upperExternalWallsLm * (upperCeilingHeight + (upperFloorDepthMm / 1000))",
  thirdBulkExternalWallAreaM2: "thirdExternalWallsLm * (thirdCeilingHeight + (thirdFloorDepthMm / 1000))",
  lowerNetExternalWallAreaM2: "GroundLevelExternalWallAreaM2 - GroundLevelWindowDoorAreaM2",
  upperNetExternalWallAreaM2: "SecondLevelExternalWallAreaM2 - SecondLevelWindowDoorAreaM2",
  thirdNetExternalWallAreaM2: "ThirdLevelExternalWallAreaM2 - ThirdLevelWindowDoorAreaM2",
  upperNetExteriorWallAfterOpeningsM2: "upperBulkExternalWallAreaM2 - upperWindowDoorDeductionsM2",
  thirdNetExteriorWallAfterOpeningsM2: "thirdBulkExternalWallAreaM2 - thirdWindowDoorDeductionsM2",
  netExternalWallAreaM2: "GroundLevelExteriorAreaM2 + SecondLevelExteriorAreaM2 + ThirdLevelExteriorAreaM2",
  lowerBrickworkAreaM2: "lowerExternalWallAreaM2",
  upperCladdingAreaM2: "upperExternalWallAreaM2",
  thirdCladdingAreaM2: "thirdExternalWallAreaM2",
  lowerSelectedWallSystemAreaM2: "lowerExternalWallAreaM2",
  upperSelectedWallSystemAreaM2: "upperExternalWallAreaM2",
  thirdSelectedWallSystemAreaM2: "thirdExternalWallAreaM2",
  lowerSlabAreaM2: "GroundLevelFloorAreaM2 + GroundLevelGarageAreaM2 + GroundLevelAlfrescoAreaM2 + GroundLevelPorchAreaM2 + GroundLevelOtherAreaM2",
  secondLevelFloorAreaM2: "SecondLevelFloorAreaM2 + SecondLevelGarageAreaM2 + SecondLevelAlfrescoAreaM2 + SecondLevelPorchAreaM2 + SecondLevelOtherAreaM2 + SecondLevelBalconyAreaM2",
  thirdLevelFloorAreaM2: "ThirdLevelFloorAreaM2 + ThirdLevelGarageAreaM2 + ThirdLevelAlfrescoAreaM2 + ThirdLevelPorchAreaM2 + ThirdLevelOtherAreaM2 + ThirdLevelBalconyAreaM2",
  slabFloorAreaM2: "GroundLevelSlabAreaM2 + SecondLevelFloorAreaTotalM2 + ThirdLevelFloorAreaTotalM2",
  totalBalconyAreaM2: "GroundLevelBalconyAreaM2 + SecondLevelBalconyAreaM2 + ThirdLevelBalconyAreaM2",
  ceilingAreaM2: "lowerFloorAreaM2 + lowerGarageAreaM2 + lowerAlfrescoAreaM2 + lowerOtherAreaM2 + upperFloorAreaM2 + upperGarageAreaM2 + upperAlfrescoAreaM2 + upperOtherAreaM2 + balconyAreaM2 + thirdFloorAreaM2 + thirdGarageAreaM2 + thirdAlfrescoAreaM2 + upperBalconyAreaM2",
  externalFramedWallLm: "externalFramedWallLm",
  internalFramedWallLm: "internalFramedWallLm",
  externalFramedWall70mmLm: "lowerExternal70mmFramedWallLm + upperExternal70mmFramedWallLm + thirdExternal70mmFramedWallLm",
  externalFramedWall90mmLm: "GroundLevelExternal90mmFramedWallLm + SecondLevelExternal90mmFramedWallLm + ThirdLevelExternal90mmFramedWallLm",
  internalFramedWall70mmLm: "lowerInternal70mmFramedWallLm + upperInternal70mmFramedWallLm + thirdInternal70mmFramedWallLm",
  internalFramedWall90mmLm: "GroundLevelInternal90mmFramedWallLm + SecondLevelInternal90mmFramedWallLm + ThirdLevelInternal90mmFramedWallLm",
  prefabricatedWallFrameLm: "prefabricatedWallFrameLm",
  wallBattensLm: "wallBattensLm",
  studsEach: "(stickFramedWallLm / 0.45) * 1.15",
  studs70mmEach: "(externalFramedWall70mmLm / 0.45 * 1.15) + (internalFramedWall70mmLm / 0.45 * 1.20)",
  studs90mmEach: "((TotalExternal90mmFramedWallLm / 0.45) * 1.15) + ((TotalInternal90mmFramedWallLm / 0.45) * 1.20)",
  externalWallPlatesLm: "externalFramedWallLm * 4 * 1.2",
  internalWallPlatesLm: "internalFramedWallLm * 3 * 1.2",
  wallPlatesLm: "externalWallPlatesLm + internalWallPlatesLm",
  wallPlatesNoggins70mmLm: "wallPlatesNoggins70mmLm",
  wallPlatesNoggins90mmLm: "wallPlatesNoggins90mmLm",
  lowerWallPlatesNoggins70mmExternalLm: "GroundFloorExternal70mmWallsLm * 4",
  lowerWallPlatesNoggins70mmInternalLm: "GroundFloorInternal70mmWallsLm * 3",
  upperWallPlatesNoggins70mmExternalLm: "SecondFloorExternal70mmWallsLm * 4",
  upperWallPlatesNoggins70mmInternalLm: "SecondFloorInternal70mmWallsLm * 3",
  thirdWallPlatesNoggins70mmExternalLm: "ThirdFloorExternal70mmWallsLm * 4",
  thirdWallPlatesNoggins70mmInternalLm: "ThirdFloorInternal70mmWallsLm * 3",
  lowerWallPlatesNoggins90mmExternalLm: "GroundFloorExternal90mmWallsLm * 4",
  lowerWallPlatesNoggins90mmInternalLm: "GroundFloorInternal90mmWallsLm * 4",
  upperWallPlatesNoggins90mmExternalLm: "SecondFloorExternal90mmWallsLm * 4",
  upperWallPlatesNoggins90mmInternalLm: "SecondFloorInternal90mmWallsLm * 4",
  thirdWallPlatesNoggins90mmExternalLm: "ThirdFloorExternal90mmWallsLm * 4",
  thirdWallPlatesNoggins90mmInternalLm: "ThirdFloorInternal90mmWallsLm * 4",
  wallPlatesNoggins70mmExternalWallsLm: "GroundFloorWallPlatesNoggins70mmExternalLm + SecondFloorWallPlatesNoggins70mmExternalLm + ThirdFloorWallPlatesNoggins70mmExternalLm",
  wallPlatesNoggins90mmExternalWallsLm: "GroundFloorWallPlatesNoggins90mmExternalLm + SecondFloorWallPlatesNoggins90mmExternalLm + ThirdFloorWallPlatesNoggins90mmExternalLm",
  wallPlatesNoggins70mmInternalWallsLm: "GroundFloorWallPlatesNoggins70mmInternalLm + SecondFloorWallPlatesNoggins70mmInternalLm + ThirdFloorWallPlatesNoggins70mmInternalLm",
  wallPlatesNoggins90mmInternalWallsLm: "GroundFloorWallPlatesNoggins90mmInternalLm + SecondFloorWallPlatesNoggins90mmInternalLm + ThirdFloorWallPlatesNoggins90mmInternalLm",
  lowerStudMaterialLm: "lowerFramedWallLm * lowerCeilingHeight * 1.2",
  upperStudMaterialLm: "upperFramedWallLm * upperCeilingHeight * 1.2",
  thirdStudMaterialLm: "thirdFramedWallLm * thirdCeilingHeight * 1.2",
  lowerStudMaterial70mmExternalLm: "(GroundFloorExternal70mmWallsLm / 0.45 * 1.15) * GroundFloorCeilingHeight",
  lowerStudMaterial70mmInternalLm: "(GroundFloorInternal70mmWallsLm / 0.45 * 1.20) * GroundFloorCeilingHeight",
  upperStudMaterial70mmExternalLm: "(SecondFloorExternal70mmWallsLm / 0.45 * 1.15) * SecondFloorCeilingHeight",
  upperStudMaterial70mmInternalLm: "(SecondFloorInternal70mmWallsLm / 0.45 * 1.20) * SecondFloorCeilingHeight",
  thirdStudMaterial70mmExternalLm: "(ThirdFloorExternal70mmWallsLm / 0.45 * 1.15) * ThirdFloorCeilingHeight",
  thirdStudMaterial70mmInternalLm: "(ThirdFloorInternal70mmWallsLm / 0.45 * 1.20) * ThirdFloorCeilingHeight",
  lowerStudMaterial90mmExternalLm: "(GroundFloorExternal90mmWallsLm / 0.45 * 1.15) * GroundFloorCeilingHeight",
  lowerStudMaterial90mmInternalLm: "(GroundFloorInternal90mmWallsLm / 0.45 * 1.20) * GroundFloorCeilingHeight",
  upperStudMaterial90mmExternalLm: "(SecondFloorExternal90mmWallsLm / 0.45 * 1.15) * SecondFloorCeilingHeight",
  upperStudMaterial90mmInternalLm: "(SecondFloorInternal90mmWallsLm / 0.45 * 1.20) * SecondFloorCeilingHeight",
  thirdStudMaterial90mmExternalLm: "(ThirdFloorExternal90mmWallsLm / 0.45 * 1.15) * ThirdFloorCeilingHeight",
  thirdStudMaterial90mmInternalLm: "(ThirdFloorInternal90mmWallsLm / 0.45 * 1.20) * ThirdFloorCeilingHeight",
  lowerStudMaterial70mmLm: "GroundFloorStudMaterial70mmExternalLm + GroundFloorStudMaterial70mmInternalLm",
  upperStudMaterial70mmLm: "SecondFloorStudMaterial70mmExternalLm + SecondFloorStudMaterial70mmInternalLm",
  thirdStudMaterial70mmLm: "ThirdFloorStudMaterial70mmExternalLm + ThirdFloorStudMaterial70mmInternalLm",
  lowerStudMaterial90mmLm: "GroundFloorStudMaterial90mmExternalLm + GroundFloorStudMaterial90mmInternalLm",
  upperStudMaterial90mmLm: "SecondFloorStudMaterial90mmExternalLm + SecondFloorStudMaterial90mmInternalLm",
  thirdStudMaterial90mmLm: "ThirdFloorStudMaterial90mmExternalLm + ThirdFloorStudMaterial90mmInternalLm",
  totalStudMaterialLm: "lowerStudMaterialLm + upperStudMaterialLm + thirdStudMaterialLm",
  total70mmStudMaterialLm: "GroundFloorStudMaterial70mmExternalLm + GroundFloorStudMaterial70mmInternalLm + SecondFloorStudMaterial70mmExternalLm + SecondFloorStudMaterial70mmInternalLm + ThirdFloorStudMaterial70mmExternalLm + ThirdFloorStudMaterial70mmInternalLm",
  total90mmStudMaterialLm: "GroundFloorStudMaterial90mmExternalLm + GroundFloorStudMaterial90mmInternalLm + SecondFloorStudMaterial90mmExternalLm + SecondFloorStudMaterial90mmInternalLm + ThirdFloorStudMaterial90mmExternalLm + ThirdFloorStudMaterial90mmInternalLm",
  totalTimberFramingLm: "wallPlatesLm + totalStudMaterialLm",
  total70mmTimberFramingLm: "TotalStudMaterial70mmLm + TotalPlatesNogginsMaterial70mmLm",
  total90mmTimberFramingLm: "TotalStudMaterial90mmLm + TotalPlatesNogginsMaterial90mmLm",
  totalTimberLengthsEach: "totalTimberFramingLm / 5.4",
  total70mmTimberLengthsEach: "total70mmTimberFramingLm / 5.4",
  total90mmTimberLengthsEach: "Total90mmTimberRequiredLm / 5.4",
  lockupSingleHeightBricks: "(netExternalWallAreaM2 * 52 / 1000) * 1.1",
  lockupTwinHeightBricks: "(netExternalWallAreaM2 * 26 / 1000) * 1.1",
  lockupBrickSillsLm: "sillLm",
  lockupFaceRenderM2: "netExternalWallAreaM2",
  lockup150LineaBoardLengths: "ceil((topLevelExternalWallAreaM2 / 0.63) * 1.1)",
  lockup180LineaBoardLengths: "ceil((topLevelExternalWallAreaM2 / 0.756) * 1.1)",
  lockup405StriaCladdingLengths: "ceil((topLevelExternalWallAreaM2 / 1.701) * 1.1)",
  lowerExternalPlasterboardWallM2: "GroundLevelExternalWallsLm * GroundLevelCeilingHeight",
  lowerInternalPlasterboardWallM2: "GroundLevelInternalWallsLm * GroundLevelCeilingHeight * 2",
  lowerPlasterboardWallM2: "GroundLevelExternalPlasterboardWallM2 + GroundLevelInternalPlasterboardWallM2",
  upperExternalPlasterboardWallM2: "SecondLevelExternalWallsLm * SecondLevelCeilingHeight",
  upperInternalPlasterboardWallM2: "SecondLevelInternalWallsLm * SecondLevelCeilingHeight * 2",
  upperPlasterboardWallM2: "SecondLevelExternalPlasterboardWallM2 + SecondLevelInternalPlasterboardWallM2",
  thirdExternalPlasterboardWallM2: "ThirdLevelExternalWallsLm * ThirdLevelCeilingHeight",
  thirdInternalPlasterboardWallM2: "ThirdLevelInternalWallsLm * ThirdLevelCeilingHeight * 2",
  thirdPlasterboardWallM2: "ThirdLevelExternalPlasterboardWallM2 + ThirdLevelInternalPlasterboardWallM2",
  plasterboardWallM2: "GroundLevelPlasterboardWallM2 + SecondLevelPlasterboardWallM2 + ThirdLevelPlasterboardWallM2",
  groundFloorCeilingsM2: "GroundLevelSlabAreaM2",
  secondFloorCeilingsM2: "SecondLevelFloorAreaTotalM2",
  thirdFloorCeilingsM2: "ThirdLevelFloorAreaTotalM2",
  totalCeilingAreasM2: "TotalSlabFloorAreaM2",
  skirtingLm: "GroundLevelSkirtingLm + SecondLevelSkirtingLm + ThirdLevelSkirtingLm",
  lowerSkirtingLm: "((GroundLevelInternalWallsLm * 2) + GroundLevelExternalWallsLm) * 0.8",
  upperSkirtingLm: "((SecondLevelInternalWallsLm * 2) + SecondLevelExternalWallsLm) * 0.8",
  thirdSkirtingLm: "((ThirdLevelInternalWallsLm * 2) + ThirdLevelExternalWallsLm) * 0.8",
  skirtingLengthsEach: "(lowerSkirtingLm + upperSkirtingLm + thirdSkirtingLm) * 0.85 / 5.4",
  internalDoors: "internalDoorCount",
  architraveLm: "windowDoorArchitraveLm + manualInternalDoorArchitraveLm",
  architraveLengthsEach: "architraveLm / 5.4",
  corniceLm: "totalExternalWallsLm + (totalInternalWallsLm * 2)",
  revealLm: "windowDoorRevealLm",
  totalEavesLm: "lowerEavesLm + upperEavesLm + thirdEavesLm",
  eavesAreaM2: "(lowerEavesLm + upperEavesLm + thirdEavesLm) * eavesWidthM",
  roofPlanAreaM2: "eavesAreaM2 + lowerRoofPlanAreaM2 + upperRoofPlanAreaM2 + thirdRoofPlanAreaM2",
  roofAreaM2: "roofPlanAreaM2 / cos(roofPitchDegrees)",
  quoteFloorSystemGround300M2: "GroundLevelFloorSystem includes Suspended Timber Floor system or 300mm I Beams ? GroundLevelSlabAreaM2 : 0",
  quoteFloorSystemGround360M2: "GroundLevelFloorSystem includes 360mm I Beams ? GroundLevelSlabAreaM2 : 0",
  quoteFloorSystemSecond300M2: "SecondLevelFloorSystem includes 300mm I Beams ? SecondLevelFloorAreaTotalM2 : 0",
  quoteFloorSystemSecond360M2: "SecondLevelFloorSystem includes 360mm I Beams ? SecondLevelFloorAreaTotalM2 : 0",
  quoteFloorSystemThird300M2: "ThirdLevelFloorSystem includes 300mm I Beams ? ThirdLevelFloorAreaTotalM2 : 0",
  quoteFloorSystemThird360M2: "ThirdLevelFloorSystem includes 360mm I Beams ? ThirdLevelFloorAreaTotalM2 : 0",
};

export function calculateEstimateBuilderWorkbook(workbook) {
  const wd = calculateWindowsDoors(workbook.windowsDoors);
  const v = (section, key) => value(workbook, section, key);
  const lowerExt = v("walls", "lowerExternalWallsLm");
  const upperExt = v("walls", "upperExternalWallsLm");
  const thirdExt = v("walls", "thirdExternalWallsLm");
  const lowerInt = v("walls", "lowerInternalWallsLm");
  const upperInt = v("walls", "upperInternalWallsLm");
  const thirdInt = v("walls", "thirdInternalWallsLm");
  const lowerHeight = v("walls", "lowerCeilingHeight") || 2.7;
  const upperHeight = v("walls", "upperCeilingHeight");
  const thirdHeight = v("walls", "thirdCeilingHeight");
  const lowerFloorDepthMm = v("inputDataSheet", "lowerFloorDepthMm");
  const upperFloorDepthMm = v("inputDataSheet", "upperFloorDepthMm");
  const thirdFloorDepthMm = v("inputDataSheet", "thirdFloorDepthMm");
  const lowerFloorSystem = raw(workbook, "inputDataSheet", "lowerFloorDepthMm");
  const upperFloorSystem = raw(workbook, "inputDataSheet", "upperFloorDepthMm");
  const thirdFloorSystem = raw(workbook, "inputDataSheet", "thirdFloorDepthMm");
  const upperFloorDepthM = upperFloorDepthMm / 1000;
  const thirdFloorDepthM = thirdFloorDepthMm / 1000;
  const lowerExternalWallAreaM2 = round(lowerExt * lowerHeight);
  const upperExternalWallAreaM2 = round(upperExt * (upperHeight ? upperHeight + upperFloorDepthM : 0));
  const thirdExternalWallAreaM2 = round(thirdExt * (thirdHeight ? thirdHeight + thirdFloorDepthM : 0));
  const upperBulkExternalWallAreaM2 = round(upperExt * (upperHeight ? upperHeight + upperFloorDepthM : 0));
  const thirdBulkExternalWallAreaM2 = round(thirdExt * (thirdHeight ? thirdHeight + thirdFloorDepthM : 0));
  const totalExternalWallAreaM2 = round(lowerExternalWallAreaM2 + upperExternalWallAreaM2 + thirdExternalWallAreaM2);
  const netExternalWallAreaM2 = round(Math.max(0, totalExternalWallAreaM2 - wd.totals.totalArea));
  const lowerFloor = v("areas", "lowerFloorAreaM2");
  const upperFloor = v("areas", "upperFloorAreaM2");
  const thirdFloor = v("areas", "thirdFloorAreaM2");
  const garage = v("areas", "lowerGarageAreaM2") || v("areas", "garageAreaM2");
  const alfresco = v("areas", "lowerAlfrescoAreaM2") || v("areas", "alfrescoAreaM2");
  const porch = v("areas", "lowerPorchAreaM2") || v("areas", "porchAreaM2");
  const lowerOther = v("areas", "lowerOtherAreaM2");
  const upperGarage = v("areas", "upperGarageAreaM2");
  const upperAlfresco = v("areas", "upperAlfrescoAreaM2");
  const upperPorch = v("areas", "upperPorchAreaM2");
  const upperOther = v("areas", "upperOtherAreaM2");
  const thirdGarage = v("areas", "thirdGarageAreaM2");
  const thirdAlfresco = v("areas", "thirdAlfrescoAreaM2");
  const thirdPorch = v("areas", "thirdPorchAreaM2");
  const lowerBalcony = v("areas", "lowerBalconyAreaM2") || v("areas", "groundBalconyAreaM2") || v("areas", "groundLevelBalconyAreaM2");
  const balcony = v("areas", "balconyAreaM2");
  const upperBalcony = v("areas", "upperBalconyAreaM2");
  const totalBalconyAreaM2 = round(lowerBalcony + balcony + upperBalcony);
  const eavesWidthM = v("roofSite", "eavesWidthM");
  const lowerEavesLm = v("roofSite", "lowerEavesLm");
  const upperEavesLm = v("roofSite", "upperEavesLm");
  const thirdEavesLm = v("roofSite", "thirdEavesLm");
  const totalEavesLm = round(lowerEavesLm + upperEavesLm + thirdEavesLm);
  const lowerSlabAreaM2 = round(lowerFloor + garage + alfresco + porch + lowerOther);
  const secondLevelFloorAreaM2 = round(upperFloor + upperGarage + upperAlfresco + upperPorch + upperOther + balcony);
  const thirdLevelFloorAreaM2 = round(thirdFloor + thirdGarage + thirdAlfresco + thirdPorch + upperBalcony);
  const totalFloorAreaM2 = round(lowerSlabAreaM2 + secondLevelFloorAreaM2 + thirdLevelFloorAreaM2);
  const eavesAreaM2 = round((lowerEavesLm + upperEavesLm + thirdEavesLm) * eavesWidthM);
  const floorCount = raw(workbook, "projectSetup", "floorCount");
  const topLevelNumber = floorCountToLevels(floorCount);
  const topLevelFloorAreaM2 = topLevelNumber === 3
    ? thirdLevelFloorAreaM2
    : topLevelNumber === 2
      ? secondLevelFloorAreaM2
      : lowerSlabAreaM2;
  const lowerRoofRemainderM2 = round(lowerSlabAreaM2 - topLevelFloorAreaM2);
  const defaultLowerRoofPlanAreaM2 = topLevelNumber === 1
    ? lowerSlabAreaM2
    : lowerRoofRemainderM2 > 0
      ? lowerRoofRemainderM2
      : "";
  const defaultUpperRoofPlanAreaM2 = topLevelNumber === 2 ? secondLevelFloorAreaM2 : "";
  const defaultThirdRoofPlanAreaM2 = topLevelNumber === 3 ? thirdLevelFloorAreaM2 : "";
  const lowerRoofPlanAreaM2 = manualOrDefault(workbook, "roofSite", "lowerRoofPlanAreaM2", defaultLowerRoofPlanAreaM2);
  const upperRoofPlanAreaM2 = manualOrDefault(workbook, "roofSite", "upperRoofPlanAreaM2", defaultUpperRoofPlanAreaM2);
  const thirdRoofPlanAreaM2 = manualOrDefault(workbook, "roofSite", "thirdRoofPlanAreaM2", defaultThirdRoofPlanAreaM2);
  const roofPlanAreaM2 = round(eavesAreaM2 + number(lowerRoofPlanAreaM2) + number(upperRoofPlanAreaM2) + number(thirdRoofPlanAreaM2));
  const ceilingAreaM2 = round(
    lowerFloor + garage + alfresco + lowerOther +
    upperFloor + upperGarage + upperAlfresco + upperOther + balcony +
    thirdFloor + thirdGarage + thirdAlfresco + upperBalcony
  );
  const roofPlan = v("roofSite", "roofPlanAreaM2") || roofPlanAreaM2;
  const pitch = v("roofSite", "roofPitchDegrees") || 22.5;
  const lowerSystem = raw(workbook, "walls", "lowerWallSystem");
  const upperSystem = raw(workbook, "walls", "upperWallSystem");
  const thirdSystem = raw(workbook, "walls", "thirdWallSystem");
  const topLevelWallSystem = topLevelNumber === 3 ? thirdSystem : topLevelNumber === 2 ? upperSystem : lowerSystem;
  const topLevelExternalWallAreaM2 = topLevelNumber === 3
    ? thirdExternalWallAreaM2
    : topLevelNumber === 2
      ? upperExternalWallAreaM2
      : lowerExternalWallAreaM2;
  const topLevelWindowDoorDeductionsM2 = topLevelNumber === 3
    ? wd.totals.thirdLevelArea
    : topLevelNumber === 2
      ? wd.totals.secondLevelArea
      : wd.totals.groundFloorArea;
  const topLevelNetExternalWallAreaM2 = round(Math.max(0, topLevelExternalWallAreaM2 - topLevelWindowDoorDeductionsM2));
  const hasLightweightCladding = [lowerSystem, upperSystem, thirdSystem].some(isLightweightCladdingSystem);
  const lowerExternalLining = raw(workbook, "walls", "lowerExternalWallLining");
  const upperExternalLining = raw(workbook, "walls", "upperExternalWallLining");
  const thirdExternalLining = raw(workbook, "walls", "thirdExternalWallLining");
  const lowerInternalSystem = raw(workbook, "walls", "lowerInternalWallSystem") || "Timber/steel framed";
  const upperInternalSystem = raw(workbook, "walls", "upperInternalWallSystem") || (upperInt ? "Timber/steel framed" : "None");
  const thirdInternalSystem = raw(workbook, "walls", "thirdInternalWallSystem") || (thirdInt ? "Timber/steel framed" : "None");
  const frameMethod = raw(workbook, "projectSetup", "frameMethod") || "Stick frame built on site";
  const manualInternalDoors = v("liningsTrim", "internalDoors");
  const internalDoors = wd.totals.internalDoorCount || manualInternalDoors;
  const manualInternalDoorArchitraveLm = wd.totals.internalDoorCount ? 0 : round(manualInternalDoors * 5.4 * 2);
  const activeUpperExt = topLevelNumber >= 2 ? upperExt : 0;
  const activeThirdExt = topLevelNumber >= 3 ? thirdExt : 0;
  const activeUpperInt = topLevelNumber >= 2 ? upperInt : 0;
  const activeThirdInt = topLevelNumber >= 3 ? thirdInt : 0;
  const totalInternalWallsLm = round(lowerInt + activeUpperInt + activeThirdInt);
  const lowerExternalFramedWallLm = framedExternalLm(lowerSystem, lowerExt);
  const upperExternalFramedWallLm = framedExternalLm(upperSystem, activeUpperExt);
  const thirdExternalFramedWallLm = framedExternalLm(thirdSystem, activeThirdExt);
  const lowerInternalFramedWallLm = framedInternalLm(lowerInternalSystem, lowerInt);
  const upperInternalFramedWallLm = framedInternalLm(upperInternalSystem, activeUpperInt);
  const thirdInternalFramedWallLm = framedInternalLm(thirdInternalSystem, activeThirdInt);
  const lowerExternalThickness = raw(workbook, "walls", "lowerWallThicknessMm");
  const upperExternalThickness = raw(workbook, "walls", "upperWallThicknessMm");
  const thirdExternalThickness = raw(workbook, "walls", "thirdWallThicknessMm");
  const lowerInternalThickness = raw(workbook, "walls", "lowerInternalWallThicknessMm");
  const upperInternalThickness = raw(workbook, "walls", "upperInternalWallThicknessMm");
  const thirdInternalThickness = raw(workbook, "walls", "thirdInternalWallThicknessMm");
  const totalExternal70mmWallsLm = round(
    thicknessWallLm(lowerExt, lowerExternalThickness, "70") +
    thicknessWallLm(activeUpperExt, upperExternalThickness, "70") +
    thicknessWallLm(activeThirdExt, thirdExternalThickness, "70")
  );
  const totalExternal90mmWallsLm = round(
    thicknessWallLm(lowerExt, lowerExternalThickness, "90") +
    thicknessWallLm(activeUpperExt, upperExternalThickness, "90") +
    thicknessWallLm(activeThirdExt, thirdExternalThickness, "90")
  );
  const totalInternal70mmWallsLm = round(
    thicknessWallLm(lowerInt, lowerInternalThickness, "70") +
    thicknessWallLm(activeUpperInt, upperInternalThickness, "70") +
    thicknessWallLm(activeThirdInt, thirdInternalThickness, "70")
  );
  const totalInternal90mmWallsLm = round(
    thicknessWallLm(lowerInt, lowerInternalThickness, "90") +
    thicknessWallLm(activeUpperInt, upperInternalThickness, "90") +
    thicknessWallLm(activeThirdInt, thirdInternalThickness, "90")
  );
  const total70mmWallsLm = round(totalExternal70mmWallsLm + totalInternal70mmWallsLm);
  const total90mmWallsLm = round(totalExternal90mmWallsLm + totalInternal90mmWallsLm);
  const lowerExternal70mmWallsLm = thicknessWallLm(lowerExt, lowerExternalThickness, "70");
  const upperExternal70mmWallsLm = thicknessWallLm(activeUpperExt, upperExternalThickness, "70");
  const thirdExternal70mmWallsLm = thicknessWallLm(activeThirdExt, thirdExternalThickness, "70");
  const lowerExternal90mmWallsLm = thicknessWallLm(lowerExt, lowerExternalThickness, "90");
  const upperExternal90mmWallsLm = thicknessWallLm(activeUpperExt, upperExternalThickness, "90");
  const thirdExternal90mmWallsLm = thicknessWallLm(activeThirdExt, thirdExternalThickness, "90");
  const lowerInternal70mmWallsLm = thicknessWallLm(lowerInt, lowerInternalThickness, "70");
  const upperInternal70mmWallsLm = thicknessWallLm(activeUpperInt, upperInternalThickness, "70");
  const thirdInternal70mmWallsLm = thicknessWallLm(activeThirdInt, thirdInternalThickness, "70");
  const lowerInternal90mmWallsLm = thicknessWallLm(lowerInt, lowerInternalThickness, "90");
  const upperInternal90mmWallsLm = thicknessWallLm(activeUpperInt, upperInternalThickness, "90");
  const thirdInternal90mmWallsLm = thicknessWallLm(activeThirdInt, thirdInternalThickness, "90");
  const lowerExternal70mmFramedWallLm = thicknessWallLm(lowerExternalFramedWallLm, lowerExternalThickness, "70");
  const upperExternal70mmFramedWallLm = thicknessWallLm(upperExternalFramedWallLm, upperExternalThickness, "70");
  const thirdExternal70mmFramedWallLm = thicknessWallLm(thirdExternalFramedWallLm, thirdExternalThickness, "70");
  const lowerExternal90mmFramedWallLm = thicknessWallLm(lowerExternalFramedWallLm, lowerExternalThickness, "90");
  const upperExternal90mmFramedWallLm = thicknessWallLm(upperExternalFramedWallLm, upperExternalThickness, "90");
  const thirdExternal90mmFramedWallLm = thicknessWallLm(thirdExternalFramedWallLm, thirdExternalThickness, "90");
  const lowerInternal70mmFramedWallLm = thicknessWallLm(lowerInternalFramedWallLm, lowerInternalThickness, "70");
  const upperInternal70mmFramedWallLm = thicknessWallLm(upperInternalFramedWallLm, upperInternalThickness, "70");
  const thirdInternal70mmFramedWallLm = thicknessWallLm(thirdInternalFramedWallLm, thirdInternalThickness, "70");
  const lowerInternal90mmFramedWallLm = thicknessWallLm(lowerInternalFramedWallLm, lowerInternalThickness, "90");
  const upperInternal90mmFramedWallLm = thicknessWallLm(upperInternalFramedWallLm, upperInternalThickness, "90");
  const thirdInternal90mmFramedWallLm = thicknessWallLm(thirdInternalFramedWallLm, thirdInternalThickness, "90");
  const lower70mmFramedWallLm = round(lowerExternal70mmFramedWallLm + lowerInternal70mmFramedWallLm);
  const upper70mmFramedWallLm = round(upperExternal70mmFramedWallLm + upperInternal70mmFramedWallLm);
  const third70mmFramedWallLm = round(thirdExternal70mmFramedWallLm + thirdInternal70mmFramedWallLm);
  const lower90mmFramedWallLm = round(lowerExternal90mmFramedWallLm + lowerInternal90mmFramedWallLm);
  const upper90mmFramedWallLm = round(upperExternal90mmFramedWallLm + upperInternal90mmFramedWallLm);
  const third90mmFramedWallLm = round(thirdExternal90mmFramedWallLm + thirdInternal90mmFramedWallLm);
  const external70mmFramedWallLm = round(
    lowerExternal70mmFramedWallLm +
    upperExternal70mmFramedWallLm +
    thirdExternal70mmFramedWallLm
  );
  const external90mmFramedWallLm = round(
    lowerExternal90mmFramedWallLm +
    upperExternal90mmFramedWallLm +
    thirdExternal90mmFramedWallLm
  );
  const internal70mmFramedWallLm = round(
    lowerInternal70mmFramedWallLm +
    upperInternal70mmFramedWallLm +
    thirdInternal70mmFramedWallLm
  );
  const internal90mmFramedWallLm = round(
    lowerInternal90mmFramedWallLm +
    upperInternal90mmFramedWallLm +
    thirdInternal90mmFramedWallLm
  );
  const framedWall70mmLm = round(external70mmFramedWallLm + internal70mmFramedWallLm);
  const framedWall90mmLm = round(external90mmFramedWallLm + internal90mmFramedWallLm);
  const studs70mmEach = round(studCountForWallLm(external70mmFramedWallLm, 1.15) + studCountForWallLm(internal70mmFramedWallLm, 1.2));
  const studs90mmEach = round(studCountForWallLm(external90mmFramedWallLm, 1.15) + studCountForWallLm(internal90mmFramedWallLm, 1.2));
  const wallPlatesNoggins70mmExternalWallsLm = round(external70mmFramedWallLm * 4);
  const wallPlatesNoggins90mmExternalWallsLm = round(external90mmFramedWallLm * 4);
  const wallPlatesNoggins70mmInternalWallsLm = round(internal70mmFramedWallLm * 3);
  const wallPlatesNoggins90mmInternalWallsLm = round(internal90mmFramedWallLm * 4);
  const lowerWallPlatesNoggins70mmExternalLm = round(lowerExternal70mmFramedWallLm * 4);
  const lowerWallPlatesNoggins70mmInternalLm = round(lowerInternal70mmFramedWallLm * 3);
  const upperWallPlatesNoggins70mmExternalLm = round(upperExternal70mmFramedWallLm * 4);
  const upperWallPlatesNoggins70mmInternalLm = round(upperInternal70mmFramedWallLm * 3);
  const thirdWallPlatesNoggins70mmExternalLm = round(thirdExternal70mmFramedWallLm * 4);
  const thirdWallPlatesNoggins70mmInternalLm = round(thirdInternal70mmFramedWallLm * 3);
  const lowerWallPlatesNoggins90mmExternalLm = round(lowerExternal90mmFramedWallLm * 4);
  const lowerWallPlatesNoggins90mmInternalLm = round(lowerInternal90mmFramedWallLm * 4);
  const upperWallPlatesNoggins90mmExternalLm = round(upperExternal90mmFramedWallLm * 4);
  const upperWallPlatesNoggins90mmInternalLm = round(upperInternal90mmFramedWallLm * 4);
  const thirdWallPlatesNoggins90mmExternalLm = round(thirdExternal90mmFramedWallLm * 4);
  const thirdWallPlatesNoggins90mmInternalLm = round(thirdInternal90mmFramedWallLm * 4);
  const wallPlatesNoggins70mmLm = round(wallPlatesNoggins70mmExternalWallsLm + wallPlatesNoggins70mmInternalWallsLm);
  const wallPlatesNoggins90mmLm = round(wallPlatesNoggins90mmExternalWallsLm + wallPlatesNoggins90mmInternalWallsLm);
  const lowerStudMaterial70mmExternalLm = round(studCountForWallLm(lowerExternal70mmFramedWallLm, 1.15) * lowerHeight);
  const lowerStudMaterial70mmInternalLm = round(studCountForWallLm(lowerInternal70mmFramedWallLm, 1.2) * lowerHeight);
  const upperStudMaterial70mmExternalLm = round(studCountForWallLm(upperExternal70mmFramedWallLm, 1.15) * (upperHeight || 0));
  const upperStudMaterial70mmInternalLm = round(studCountForWallLm(upperInternal70mmFramedWallLm, 1.2) * (upperHeight || 0));
  const thirdStudMaterial70mmExternalLm = round(studCountForWallLm(thirdExternal70mmFramedWallLm, 1.15) * (thirdHeight || 0));
  const thirdStudMaterial70mmInternalLm = round(studCountForWallLm(thirdInternal70mmFramedWallLm, 1.2) * (thirdHeight || 0));
  const lowerStudMaterial90mmExternalLm = round(studCountForWallLm(lowerExternal90mmFramedWallLm, 1.15) * lowerHeight);
  const lowerStudMaterial90mmInternalLm = round(studCountForWallLm(lowerInternal90mmFramedWallLm, 1.2) * lowerHeight);
  const upperStudMaterial90mmExternalLm = round(studCountForWallLm(upperExternal90mmFramedWallLm, 1.15) * (upperHeight || 0));
  const upperStudMaterial90mmInternalLm = round(studCountForWallLm(upperInternal90mmFramedWallLm, 1.2) * (upperHeight || 0));
  const thirdStudMaterial90mmExternalLm = round(studCountForWallLm(thirdExternal90mmFramedWallLm, 1.15) * (thirdHeight || 0));
  const thirdStudMaterial90mmInternalLm = round(studCountForWallLm(thirdInternal90mmFramedWallLm, 1.2) * (thirdHeight || 0));
  const lowerStudMaterial70mmLm = round(lowerStudMaterial70mmExternalLm + lowerStudMaterial70mmInternalLm);
  const upperStudMaterial70mmLm = round(upperStudMaterial70mmExternalLm + upperStudMaterial70mmInternalLm);
  const thirdStudMaterial70mmLm = round(thirdStudMaterial70mmExternalLm + thirdStudMaterial70mmInternalLm);
  const lowerStudMaterial90mmLm = round(lowerStudMaterial90mmExternalLm + lowerStudMaterial90mmInternalLm);
  const upperStudMaterial90mmLm = round(upperStudMaterial90mmExternalLm + upperStudMaterial90mmInternalLm);
  const thirdStudMaterial90mmLm = round(thirdStudMaterial90mmExternalLm + thirdStudMaterial90mmInternalLm);
  const total70mmStudMaterialLm = round(lowerStudMaterial70mmLm + upperStudMaterial70mmLm + thirdStudMaterial70mmLm);
  const total90mmStudMaterialLm = round(lowerStudMaterial90mmLm + upperStudMaterial90mmLm + thirdStudMaterial90mmLm);
  const total70mmTimberFramingLm = round(wallPlatesNoggins70mmLm + total70mmStudMaterialLm);
  const total90mmTimberFramingLm = round(wallPlatesNoggins90mmLm + total90mmStudMaterialLm);
  const total70mmTimberLengthsEach = round(total70mmTimberFramingLm / 5.4);
  const total90mmTimberLengthsEach = round(total90mmTimberFramingLm / 5.4);
  const lowerFramedWallLm = round(lowerExternalFramedWallLm + lowerInternalFramedWallLm);
  const upperFramedWallLm = round(upperExternalFramedWallLm + upperInternalFramedWallLm);
  const thirdFramedWallLm = round(thirdExternalFramedWallLm + thirdInternalFramedWallLm);
  const externalFramedWallLm = round(lowerExternalFramedWallLm + upperExternalFramedWallLm + thirdExternalFramedWallLm);
  const internalFramedWallLm = round(lowerInternalFramedWallLm + upperInternalFramedWallLm + thirdInternalFramedWallLm);
  const framedWallLm = round(externalFramedWallLm + internalFramedWallLm);
  const prefabFrameMethod = normalizeFrameMethod(frameMethod) === "prefab";
  const stickFramedWallLm = prefabFrameMethod ? 0 : framedWallLm;
  const prefabricatedWallFrameLm = prefabFrameMethod ? framedWallLm : 0;
  const lowerExternalPlasterboardWallM2 = round(lowerExt * lowerHeight);
  const upperExternalPlasterboardWallM2 = round(activeUpperExt * (upperHeight || 0));
  const thirdExternalPlasterboardWallM2 = round(activeThirdExt * (thirdHeight || 0));
  const lowerInternalPlasterboardWallM2 = round(lowerInt * lowerHeight * 2);
  const upperInternalPlasterboardWallM2 = round(activeUpperInt * (upperHeight || 0) * 2);
  const thirdInternalPlasterboardWallM2 = round(activeThirdInt * (thirdHeight || 0) * 2);
  const externalPlasterboardWallM2 = round(lowerExternalPlasterboardWallM2 + upperExternalPlasterboardWallM2 + thirdExternalPlasterboardWallM2);
  const internalPlasterboardWallM2 = round(lowerInternalPlasterboardWallM2 + upperInternalPlasterboardWallM2 + thirdInternalPlasterboardWallM2);
  const wallBattensLm = round(
    battenLm(lowerExternalWallAreaM2, lowerExternalLining) +
    battenLm(upperExternalWallAreaM2, upperExternalLining) +
    battenLm(thirdExternalWallAreaM2, thirdExternalLining)
  );

  const quantities = {
    siteItem: 1,
    lowerExternalWallsLm: lowerExt,
    upperExternalWallsLm: activeUpperExt,
    thirdExternalWallsLm: activeThirdExt,
    totalExternalWallsLm: round(lowerExt + activeUpperExt + activeThirdExt),
    lowerInternalWallsLm: lowerInt,
    upperInternalWallsLm: activeUpperInt,
    thirdInternalWallsLm: activeThirdInt,
    totalInternalWallsLm,
    lowerExternal70mmWallsLm,
    upperExternal70mmWallsLm,
    thirdExternal70mmWallsLm,
    lowerExternal90mmWallsLm,
    upperExternal90mmWallsLm,
    thirdExternal90mmWallsLm,
    lowerInternal70mmWallsLm,
    upperInternal70mmWallsLm,
    thirdInternal70mmWallsLm,
    lowerInternal90mmWallsLm,
    upperInternal90mmWallsLm,
    thirdInternal90mmWallsLm,
    totalExternal70mmWallsLm,
    totalExternal90mmWallsLm,
    totalInternal70mmWallsLm,
    totalInternal90mmWallsLm,
    total70mmWallsLm,
    total90mmWallsLm,
    lowerFloorDepthMm,
    upperFloorDepthMm,
    thirdFloorDepthMm,
    lowerFloorSystem,
    upperFloorSystem,
    thirdFloorSystem,
    lowerExternalWallAreaM2,
    upperExternalWallAreaM2,
    thirdExternalWallAreaM2,
    totalExternalWallAreaM2,
    topLevelExternalWallAreaM2,
    topLevelNetExternalWallAreaM2,
    lowerWindowDoorDeductionsM2: wd.totals.groundFloorArea,
    upperWindowDoorDeductionsM2: wd.totals.secondLevelArea,
    thirdWindowDoorDeductionsM2: wd.totals.thirdLevelArea,
    windowDoorDeductionsM2: wd.totals.totalArea,
    upperBulkExternalWallAreaM2,
    thirdBulkExternalWallAreaM2,
    lowerNetExternalWallAreaM2: round(Math.max(0, lowerExternalWallAreaM2 - wd.totals.groundFloorArea)),
    upperNetExternalWallAreaM2: round(Math.max(0, upperExternalWallAreaM2 - wd.totals.secondLevelArea)),
    thirdNetExternalWallAreaM2: round(Math.max(0, thirdExternalWallAreaM2 - wd.totals.thirdLevelArea)),
    upperNetExteriorWallAfterOpeningsM2: round(Math.max(0, upperBulkExternalWallAreaM2 - wd.totals.secondLevelArea)),
    thirdNetExteriorWallAfterOpeningsM2: round(Math.max(0, thirdBulkExternalWallAreaM2 - wd.totals.thirdLevelArea)),
    netExternalWallAreaM2,
    lowerBrickworkAreaM2: isBrick(lowerSystem) ? lowerExternalWallAreaM2 : 0,
    upperCladdingAreaM2: isCladding(upperSystem) ? upperExternalWallAreaM2 : 0,
    thirdCladdingAreaM2: isCladding(thirdSystem) ? thirdExternalWallAreaM2 : 0,
    lowerSelectedWallSystemAreaM2: lowerExternalWallAreaM2,
    upperSelectedWallSystemAreaM2: upperExternalWallAreaM2,
    thirdSelectedWallSystemAreaM2: thirdExternalWallAreaM2,
    thirdFloorAreaM2: thirdFloor,
    upperBalconyAreaM2: upperBalcony,
    lowerSlabAreaM2,
    secondLevelFloorAreaM2,
    thirdLevelFloorAreaM2,
    slabFloorAreaM2: totalFloorAreaM2,
    groundFloorCeilingsM2: lowerSlabAreaM2,
    secondFloorCeilingsM2: secondLevelFloorAreaM2,
    thirdFloorCeilingsM2: thirdLevelFloorAreaM2,
    totalCeilingAreasM2: totalFloorAreaM2,
    ceilingAreaM2,
    externalFramedWallLm,
    internalFramedWallLm,
    externalFramedWall70mmLm: external70mmFramedWallLm,
    externalFramedWall90mmLm: external90mmFramedWallLm,
    internalFramedWall70mmLm: internal70mmFramedWallLm,
    internalFramedWall90mmLm: internal90mmFramedWallLm,
    lowerExternal70mmFramedWallLm,
    upperExternal70mmFramedWallLm,
    thirdExternal70mmFramedWallLm,
    lowerExternal90mmFramedWallLm,
    upperExternal90mmFramedWallLm,
    thirdExternal90mmFramedWallLm,
    lowerInternal70mmFramedWallLm,
    upperInternal70mmFramedWallLm,
    thirdInternal70mmFramedWallLm,
    lowerInternal90mmFramedWallLm,
    upperInternal90mmFramedWallLm,
    thirdInternal90mmFramedWallLm,
    lowerFramedWallLm,
    upperFramedWallLm,
    thirdFramedWallLm,
    framedWall70mmLm,
    framedWall90mmLm,
    framedWallLm,
    stickFramedWallLm,
    prefabricatedWallFrameLm,
    lowerExternalPlasterboardWallM2,
    upperExternalPlasterboardWallM2,
    thirdExternalPlasterboardWallM2,
    lowerInternalPlasterboardWallM2,
    upperInternalPlasterboardWallM2,
    thirdInternalPlasterboardWallM2,
    externalPlasterboardWallM2,
    internalPlasterboardWallM2,
    plasterboardWallM2: round(internalPlasterboardWallM2 + externalPlasterboardWallM2),
    wallBattensLm,
    studs70mmEach,
    studs90mmEach,
    wallPlatesNoggins70mmLm,
    wallPlatesNoggins90mmLm,
    wallPlatesNoggins70mmExternalWallsLm,
    wallPlatesNoggins90mmExternalWallsLm,
    wallPlatesNoggins70mmInternalWallsLm,
    wallPlatesNoggins90mmInternalWallsLm,
    lowerWallPlatesNoggins70mmExternalLm,
    lowerWallPlatesNoggins70mmInternalLm,
    upperWallPlatesNoggins70mmExternalLm,
    upperWallPlatesNoggins70mmInternalLm,
    thirdWallPlatesNoggins70mmExternalLm,
    thirdWallPlatesNoggins70mmInternalLm,
    lowerWallPlatesNoggins90mmExternalLm,
    lowerWallPlatesNoggins90mmInternalLm,
    upperWallPlatesNoggins90mmExternalLm,
    upperWallPlatesNoggins90mmInternalLm,
    thirdWallPlatesNoggins90mmExternalLm,
    thirdWallPlatesNoggins90mmInternalLm,
    totalPlatesNogginsMaterial70mmLm: wallPlatesNoggins70mmLm,
    totalPlatesNogginsMaterial90mmLm: wallPlatesNoggins90mmLm,
    lowerStudMaterial70mmExternalLm,
    lowerStudMaterial70mmInternalLm,
    upperStudMaterial70mmExternalLm,
    upperStudMaterial70mmInternalLm,
    thirdStudMaterial70mmExternalLm,
    thirdStudMaterial70mmInternalLm,
    lowerStudMaterial90mmExternalLm,
    lowerStudMaterial90mmInternalLm,
    upperStudMaterial90mmExternalLm,
    upperStudMaterial90mmInternalLm,
    thirdStudMaterial90mmExternalLm,
    thirdStudMaterial90mmInternalLm,
    lowerStudMaterial70mmLm,
    upperStudMaterial70mmLm,
    thirdStudMaterial70mmLm,
    lowerStudMaterial90mmLm,
    upperStudMaterial90mmLm,
    thirdStudMaterial90mmLm,
    total70mmStudMaterialLm,
    total90mmStudMaterialLm,
    totalStudMaterial70mmLm: total70mmStudMaterialLm,
    totalStudMaterial90mmLm: total90mmStudMaterialLm,
    total70mmTimberFramingLm,
    total90mmTimberFramingLm,
    total70mmTimberRequiredLm: total70mmTimberFramingLm,
    total90mmTimberRequiredLm: total90mmTimberFramingLm,
    total70mmTimberLengthsEach,
    total90mmTimberLengthsEach,
    studsEach: 0,
    wallPlatesLm: 0,
    lowerSkirtingLm: round(((lowerInt * 2) + lowerExt) * 0.8),
    upperSkirtingLm: round(((upperInt * 2) + upperExt) * 0.8),
    thirdSkirtingLm: round(((thirdInt * 2) + thirdExt) * 0.8),
    skirtingLm: round((((lowerInt * 2) + lowerExt) + ((upperInt * 2) + upperExt) + ((thirdInt * 2) + thirdExt)) * 0.8),
    architraveLm: round(wd.totals.architraveLength + manualInternalDoorArchitraveLm),
    corniceLm: round((lowerExt + upperExt + thirdExt) + ((lowerInt + upperInt + thirdInt) * 2)),
    revealLm: wd.totals.revealLength,
    sillLm: wd.totals.sillLength,
    internalDoors,
    manualInternalDoorArchitraveLm,
    internalDoorCount: wd.totals.internalDoorCount,
    eavesWidthM,
    lowerEavesLm,
    upperEavesLm,
    thirdEavesLm,
    totalEavesLm,
    eavesAreaM2,
    defaultLowerRoofPlanAreaM2,
    defaultUpperRoofPlanAreaM2,
    defaultThirdRoofPlanAreaM2,
    lowerRoofPlanAreaM2,
    upperRoofPlanAreaM2,
    thirdRoofPlanAreaM2,
    roofPlanAreaM2,
    roofAreaM2: round(roofPlan / Math.cos((pitch * Math.PI) / 180)),
    concreteM3: v("roofSite", "concreteM3"),
    cutFillM3: v("roofSite", "cutFillM3"),
    retainingWallLm: v("roofSite", "retainingWallLm"),
    drivewayM2: v("roofSite", "drivewayM2"),
    pcItems: v("roofSite", "pcItems"),
    provisionalSums: v("roofSite", "provisionalSums"),
    windowDoorAreaM2: wd.totals.totalArea,
    lowerWindowDoorAreaM2: wd.totals.groundFloorArea,
    upperWindowDoorAreaM2: wd.totals.secondLevelArea,
    thirdWindowDoorAreaM2: wd.totals.thirdLevelArea,
    windowDoorCount: wd.totals.itemCount,
    windowCount: wd.totals.windowCount,
    groundFloorWindowCount: wd.totals.groundFloorWindowCount,
    secondLevelWindowCount: wd.totals.secondLevelWindowCount,
    thirdLevelWindowCount: wd.totals.thirdLevelWindowCount,
    lightweightCladdingWindowCount: hasLightweightCladding ? wd.totals.windowCount : 0,
    garageDoorCount: wd.totals.garageDoorCount,
    entryDoorCount: wd.totals.entryDoorCount,
    paintM2: round(netExternalWallAreaM2 + lowerFloor + upperFloor + thirdFloor),
  };

  applyEditableFormulas(quantities, workbook.formulas || {}, {
    totalWallLm: quantities.totalInternalWallsLm + quantities.totalExternalWallsLm,
    totalPlateLm: (quantities.totalInternalWallsLm + quantities.totalExternalWallsLm) * 2,
    internalWallLm: quantities.totalInternalWallsLm,
    externalWallLm: quantities.totalExternalWallsLm,
    wallHeight: lowerHeight,
    ceilingArea: quantities.ceilingAreaM2,
    lowerCeilingHeight: lowerHeight,
    upperCeilingHeight: upperHeight || lowerHeight,
    thirdCeilingHeight: thirdHeight || upperHeight || lowerHeight,
    lowerWallSystem: lowerSystem,
    upperWallSystem: upperSystem,
    thirdWallSystem: thirdSystem,
    externalFramedWallLm,
    internalFramedWallLm,
    lowerFramedWallLm,
    upperFramedWallLm,
    thirdFramedWallLm,
    framedWallLm,
    stickFramedWallLm,
    prefabricatedWallFrameLm,
    lowerExternalPlasterboardWallM2,
    upperExternalPlasterboardWallM2,
    thirdExternalPlasterboardWallM2,
    lowerInternalPlasterboardWallM2,
    upperInternalPlasterboardWallM2,
    thirdInternalPlasterboardWallM2,
    externalPlasterboardWallM2,
    internalPlasterboardWallM2,
    wallBattensLm,
    lowerExternal70mmWallsLm,
    upperExternal70mmWallsLm,
    thirdExternal70mmWallsLm,
    lowerExternal90mmWallsLm,
    upperExternal90mmWallsLm,
    thirdExternal90mmWallsLm,
    lowerInternal70mmWallsLm,
    upperInternal70mmWallsLm,
    thirdInternal70mmWallsLm,
    lowerInternal90mmWallsLm,
    upperInternal90mmWallsLm,
    thirdInternal90mmWallsLm,
    externalFramedWall70mmLm: external70mmFramedWallLm,
    externalFramedWall90mmLm: external90mmFramedWallLm,
    internalFramedWall70mmLm: internal70mmFramedWallLm,
    internalFramedWall90mmLm: internal90mmFramedWallLm,
    lowerExternal70mmFramedWallLm,
    upperExternal70mmFramedWallLm,
    thirdExternal70mmFramedWallLm,
    lowerExternal90mmFramedWallLm,
    upperExternal90mmFramedWallLm,
    thirdExternal90mmFramedWallLm,
    lowerInternal70mmFramedWallLm,
    upperInternal70mmFramedWallLm,
    thirdInternal70mmFramedWallLm,
    lowerInternal90mmFramedWallLm,
    upperInternal90mmFramedWallLm,
    thirdInternal90mmFramedWallLm,
    framedWall70mmLm,
    framedWall90mmLm,
    studs70mmEach,
    studs90mmEach,
    wallPlatesNoggins70mmLm,
    wallPlatesNoggins90mmLm,
    wallPlatesNoggins70mmExternalWallsLm,
    wallPlatesNoggins90mmExternalWallsLm,
    wallPlatesNoggins70mmInternalWallsLm,
    wallPlatesNoggins90mmInternalWallsLm,
    lowerWallPlatesNoggins70mmExternalLm,
    lowerWallPlatesNoggins70mmInternalLm,
    upperWallPlatesNoggins70mmExternalLm,
    upperWallPlatesNoggins70mmInternalLm,
    thirdWallPlatesNoggins70mmExternalLm,
    thirdWallPlatesNoggins70mmInternalLm,
    lowerWallPlatesNoggins90mmExternalLm,
    lowerWallPlatesNoggins90mmInternalLm,
    upperWallPlatesNoggins90mmExternalLm,
    upperWallPlatesNoggins90mmInternalLm,
    thirdWallPlatesNoggins90mmExternalLm,
    thirdWallPlatesNoggins90mmInternalLm,
    totalPlatesNogginsMaterial70mmLm: wallPlatesNoggins70mmLm,
    totalPlatesNogginsMaterial90mmLm: wallPlatesNoggins90mmLm,
    lowerStudMaterial70mmExternalLm,
    lowerStudMaterial70mmInternalLm,
    upperStudMaterial70mmExternalLm,
    upperStudMaterial70mmInternalLm,
    thirdStudMaterial70mmExternalLm,
    thirdStudMaterial70mmInternalLm,
    lowerStudMaterial90mmExternalLm,
    lowerStudMaterial90mmInternalLm,
    upperStudMaterial90mmExternalLm,
    upperStudMaterial90mmInternalLm,
    thirdStudMaterial90mmExternalLm,
    thirdStudMaterial90mmInternalLm,
    lowerStudMaterial70mmLm,
    upperStudMaterial70mmLm,
    thirdStudMaterial70mmLm,
    lowerStudMaterial90mmLm,
    upperStudMaterial90mmLm,
    thirdStudMaterial90mmLm,
    total70mmStudMaterialLm,
    total90mmStudMaterialLm,
    totalStudMaterial70mmLm: total70mmStudMaterialLm,
    totalStudMaterial90mmLm: total90mmStudMaterialLm,
    total70mmTimberFramingLm,
    total90mmTimberFramingLm,
    total70mmTimberRequiredLm: total70mmTimberFramingLm,
    total90mmTimberRequiredLm: total90mmTimberFramingLm,
    total70mmTimberLengthsEach,
    total90mmTimberLengthsEach,
    lowerFloorAreaM2: lowerFloor,
    upperFloorAreaM2: upperFloor,
    secondlevelFloorAreaM2: upperFloor,
    secondLevelAreaM2: upperFloor,
    thirdFloorAreaM2: thirdFloor,
    thirdlevelFloorAreaM2: thirdFloor,
    thirdLevelAreaM2: thirdFloor,
    garageAreaM2: garage,
    alfrescoAreaM2: alfresco,
    porchAreaM2: porch,
    lowerBalconyAreaM2: lowerBalcony,
    groundBalconyAreaM2: lowerBalcony,
    groundLevelBalconyAreaM2: lowerBalcony,
    balconyAreaM2: balcony,
    secondlevelBalconyAreaM2: balcony,
    secondLevelBalconyAreaM2: balcony,
    upperBalconyAreaM2: upperBalcony,
    thirdlevelBalconyAreaM2: upperBalcony,
    thirdLevelBalconyAreaM2: upperBalcony,
    totalBalconyAreaM2,
    lowerSlabAreaM2,
    secondLevelFloorAreaM2,
    thirdLevelFloorAreaM2,
    eavesWidthM,
    lowerEavesLm,
    upperEavesLm,
    thirdEavesLm,
    totalEavesLm,
    lowerRoofPlanAreaM2,
    upperRoofPlanAreaM2,
    thirdRoofPlanAreaM2,
    roofPlanAreaM2: roofPlan,
    roofPitchDegrees: pitch,
    internalDoors,
    manualInternalDoorArchitraveLm,
    windowDoorAreaM2: wd.totals.totalArea,
    lowerWindowDoorAreaM2: wd.totals.groundFloorArea,
    upperWindowDoorAreaM2: wd.totals.secondLevelArea,
    thirdWindowDoorAreaM2: wd.totals.thirdLevelArea,
    windowDoorCount: wd.totals.itemCount,
    windowCount: wd.totals.windowCount,
    windowDoorArchitraveLm: wd.totals.architraveLength,
    windowDoorRevealLm: wd.totals.revealLength,
  }, workbook.formulaRows || []);
  quantities.totalPlatesNogginsMaterial70mmLm = quantities.wallPlatesNoggins70mmLm;
  quantities.totalPlatesNogginsMaterial90mmLm = quantities.wallPlatesNoggins90mmLm;
  quantities.totalStudMaterial70mmLm = quantities.total70mmStudMaterialLm;
  quantities.totalStudMaterial90mmLm = quantities.total90mmStudMaterialLm;
  quantities.total70mmTimberRequiredLm = quantities.total70mmTimberFramingLm;
  quantities.total90mmTimberRequiredLm = quantities.total90mmTimberFramingLm;
  quantities.internalDoors = wd.totals.internalDoorCount || manualInternalDoors;
  const cavityDoorCageRow = Object.values(workbook.quotation || {}).flatMap((s) => s?.rows || []).find((r) => quoteRowSourceNumber(r) === 104);
  quantities.cavityDoorQty = cavityDoorCageRow ? quoteQuantityValue(cavityDoorCageRow.quantity, quantities) : 0;

  const isRenderedBrickVeneer = isRenderedBrickVeneerSystem(lowerSystem);
  const isFaceBrickVeneer = isFaceBrickVeneerSystem(lowerSystem);
  const isLightweightWall = isLightweightCladdingSystem(lowerSystem);
  const brickSillBricks = (isRenderedBrickVeneer || isFaceBrickVeneer) ? roundTo((number(quantities.sillLm) / 0.085) / 1000, 3) : "";
  if (isRenderedBrickVeneer) {
    quantities.lockupTwinHeightBricks = round((quantities.netExternalWallAreaM2 * 26 / 1000) * 1.1);
    quantities.lockupSingleHeightBricks = round(quantities.lockupTwinHeightBricks * 0.1);
    quantities.lockupBrickSillsLm = quantities.sillLm;
    quantities.lockupFaceRenderM2 = quantities.netExternalWallAreaM2;
  } else if (isFaceBrickVeneer) {
    quantities.lockupTwinHeightBricks = "";
    quantities.lockupSingleHeightBricks = round((quantities.netExternalWallAreaM2 * 52 / 1000) * 1.1);
    quantities.lockupBrickSillsLm = quantities.sillLm;
    quantities.lockupFaceRenderM2 = "";
  } else if (isLightweightWall) {
    quantities.lockupTwinHeightBricks = "";
    quantities.lockupSingleHeightBricks = "";
    quantities.lockupBrickSillsLm = "";
    quantities.lockupFaceRenderM2 = "";
  } else {
    quantities.lockupTwinHeightBricks = "";
    quantities.lockupSingleHeightBricks = "";
    quantities.lockupBrickSillsLm = "";
    quantities.lockupFaceRenderM2 = "";
  }
  quantities.quoteFaceBricksBaseRange = isFaceBrickVeneer ? quantities.lockupSingleHeightBricks : "";
  quantities.quoteCommonSingleHeights = isRenderedBrickVeneer ? quantities.lockupSingleHeightBricks : "";
  quantities.quoteCommonTwinHeights = isRenderedBrickVeneer ? quantities.lockupTwinHeightBricks : "";
  quantities.quoteBrickSillBricks = brickSillBricks;
  quantities.quoteBricklayerFaceBricks = quantities.quoteFaceBricksBaseRange;
  quantities.quoteBricklayerSingleHeight = quantities.quoteCommonSingleHeights;
  quantities.quoteBricklayerDoubleHeights = quantities.quoteCommonTwinHeights;
  quantities.quoteBricklayerSillsLm = (isRenderedBrickVeneer || isFaceBrickVeneer) ? quantities.sillLm : "";
  quantities.quoteRenderingNetWallAreaM2 = isRenderedBrickVeneer ? quantities.netExternalWallAreaM2 : "";
  quantities.quoteRenderingSillsLm = isRenderedBrickVeneer ? quantities.sillLm : "";
  quantities.quoteFrameInstallWindows = quantities.windowCount;
  quantities.quoteFrameSecondStoreyWindows = quantities.secondLevelWindowCount;
  quantities.quoteFrameThirdStoreyWindows = quantities.thirdLevelWindowCount;
  quantities.quoteFrameRoofTrusses = quantities.roofAreaM2;
  quantities.quoteFrameSecondStoreyTrusses = quantities.upperRoofPlanAreaM2;
  quantities.quoteFrameThirdStoreyTrusses = quantities.thirdRoofPlanAreaM2;
  quantities.quoteFrameCeilingBattensGroundM2 = topLevelNumber === 1 ? quantities.lowerSlabAreaM2 : "";
  quantities.quoteFrameCeilingBattensSecondM2 = topLevelNumber === 2 ? quantities.secondLevelFloorAreaM2 : "";
  quantities.quoteFrameCeilingBattensThirdM2 = topLevelNumber === 3 ? quantities.thirdLevelFloorAreaM2 : "";
  quantities.quoteFrameCeilingBattensM2 = quantities.quoteFrameCeilingBattensGroundM2;
  quantities.quoteFrameTieDownSheetBracingGroundM2 = quantities.lowerSlabAreaM2;
  quantities.quoteFrameTieDownSheetBracingSecondM2 = quantities.secondLevelFloorAreaM2;
  quantities.quoteFrameTieDownSheetBracingThirdM2 = quantities.thirdLevelFloorAreaM2;
  quantities.quoteFrameExteriorWallsGroundLm = quantities.lowerExternalWallsLm;
  quantities.quoteFrameExteriorWallsSecondLm = quantities.upperExternalWallsLm;
  quantities.quoteFrameExteriorWallsThirdLm = quantities.thirdExternalWallsLm;
  quantities.quoteFrameInteriorWallsGroundLm = quantities.lowerInternalWallsLm;
  quantities.quoteFrameInteriorWallsSecondLm = quantities.upperInternalWallsLm;
  quantities.quoteFrameInteriorWallsThirdLm = quantities.thirdInternalWallsLm;
  quantities.quoteFrameFloorJoistsSecondM2 = quantities.secondLevelFloorAreaM2;
  quantities.quoteFrameSheetFlooringSecondM2 = quantities.secondLevelFloorAreaM2;
  quantities.quoteFrameFloorJoistsThirdM2 = quantities.thirdLevelFloorAreaM2;
  quantities.quoteFrameSheetFlooringThirdM2 = quantities.thirdLevelFloorAreaM2;
  Object.assign(quantities, floorSystemQuoteQuantities({
    groundSystem: lowerFloorSystem,
    secondSystem: upperFloorSystem,
    thirdSystem: thirdFloorSystem,
    groundArea: quantities.lowerSlabAreaM2,
    secondArea: quantities.secondLevelFloorAreaM2,
    thirdArea: quantities.thirdLevelFloorAreaM2,
  }));
  quantities.quoteCeilingInsulationFlatM2 = round(number(quantities.lowerRoofPlanAreaM2) + number(quantities.upperRoofPlanAreaM2) + number(quantities.thirdRoofPlanAreaM2));
  quantities.quoteSisalationInstallGroundM2 = quantities.lowerNetExternalWallAreaM2;
  quantities.quoteSisalationInstallSecondM2 = quantities.upperBulkExternalWallAreaM2;
  quantities.quoteSisalationInstallThirdM2 = quantities.thirdBulkExternalWallAreaM2;
  quantities.quoteWallBattsInstallGroundM2 = quantities.lowerNetExternalWallAreaM2;
  quantities.quoteWallBattsInstallSecondM2 = quantities.upperNetExternalWallAreaM2;
  quantities.quoteWallBattsInstallThirdM2 = quantities.thirdNetExternalWallAreaM2;
  quantities.quoteLightweightCladdingInstallGroundM2 = isLightweightInstallCladdingSystem(lowerSystem)
    ? quantities.lowerNetExternalWallAreaM2
    : "";
  quantities.quoteLightweightCladdingInstallSecondM2 = isLightweightInstallCladdingSystem(upperSystem)
    ? quantities.upperNetExternalWallAreaM2
    : "";
  quantities.quoteLightweightCladdingInstallThirdM2 = isLightweightInstallCladdingSystem(thirdSystem)
    ? quantities.thirdNetExternalWallAreaM2
    : "";
  quantities.quoteLightweightCladdingM2 = topLevelWallSystem === "Timber/Steel Framed with lightweight cladding"
    ? quantities.topLevelExternalWallAreaM2
    : "";
  quantities.lockup150LineaBoardLengths = topLevelWallSystem === "Timber/Steel Framed 150 Linea Board Cladding"
    ? boardLengthsWithWaste(quantities.topLevelExternalWallAreaM2, 0.63)
    : "";
  quantities.lockup180LineaBoardLengths = topLevelWallSystem === "Timber/Steel Framed 180 Linea Board Cladding"
    ? boardLengthsWithWaste(quantities.topLevelExternalWallAreaM2, 0.756)
    : "";
  quantities.lockup405StriaCladdingLengths = topLevelWallSystem === "Timber/Steel Framed 405 Stria Cladding"
    ? boardLengthsWithWaste(quantities.topLevelExternalWallAreaM2, 1.701)
    : "";
  quantities.quote150LineaBoardLengths = quantities.lockup150LineaBoardLengths;
  quantities.quote180LineaBoardLengths = quantities.lockup180LineaBoardLengths;
  quantities.quote405StriaCladdingLengths = quantities.lockup405StriaCladdingLengths;
  if (!isBrick(lowerSystem)) quantities.lowerBrickworkAreaM2 = 0;
  if (!isCladding(upperSystem)) quantities.upperCladdingAreaM2 = 0;
  if (!isCladding(thirdSystem)) quantities.thirdCladdingAreaM2 = 0;
  assignWallSystemAreas(quantities, [
    { system: lowerSystem, area: lowerExternalWallAreaM2 },
    { system: upperSystem, area: upperExternalWallAreaM2 },
    { system: thirdSystem, area: thirdExternalWallAreaM2 },
  ]);

  const quotationResult = calculateQuotation(workbook.quotation, quantities, { frameMethod, windowsDoors: wd, workbook });
  const { quotation, fees } = quotationResult;
  const baseLineItemSubtotal = round(Object.values(quotation).reduce((sum, section) => sum + section.subtotal, 0));
  const preliminaryCostsPercent = summaryAdjustmentPercent(workbook, "preliminaryCostsPercent", 0);
  const overheadsPercent = summaryAdjustmentPercent(workbook, "overheadsPercent", v("roofSite", "overheadsPercent") || 0);
  const marginPercent = summaryAdjustmentPercent(workbook, "marginPercent", v("roofSite", "marginPercent") || 0);
  const profitPercent = summaryAdjustmentPercent(workbook, "profitPercent", v("roofSite", "profitPercent") || 0);
  const gstPercent = summaryAdjustmentPercent(workbook, "gstPercent", 10);
  const salesCommissionPercent = summaryAdjustmentPercent(workbook, "salesCommissionPercent", v("roofSite", "salesCommissionPercent") || 0);
  const preliminaryCostsAmount = round(baseLineItemSubtotal * preliminaryCostsPercent / 100);
  const overheadsAmount = round(baseLineItemSubtotal * overheadsPercent / 100);
  const marginAmount = round(baseLineItemSubtotal * marginPercent / 100);
  const profitBase = round(baseLineItemSubtotal + preliminaryCostsAmount + overheadsAmount + marginAmount);
  const profitAmount = round(profitBase * profitPercent / 100);
  const subtotalBeforeGst = round(profitBase + profitAmount);
  const totalAllowances = round(preliminaryCostsAmount + overheadsAmount + marginAmount + profitAmount);
  const gst = round(subtotalBeforeGst * gstPercent / 100);
  const qbsaRegistration = summaryAdjustmentAmount(workbook, "qbsaRegistration", fees.qbsaRegistration || 0);
  const qLeaveFees = summaryAdjustmentAmount(workbook, "qLeaveFees", fees.qLeaveFees || 0);
  const totalBeforeSalesCommission = round(subtotalBeforeGst + gst + qbsaRegistration + qLeaveFees);
  const salesCommissionAmount = salesCommissionPercent > 0 && salesCommissionPercent < 100
    ? round(totalBeforeSalesCommission * salesCommissionPercent / (100 - salesCommissionPercent))
    : 0;
  const finalQuoteTotal = round(totalBeforeSalesCommission + salesCommissionAmount);
  const subtotalBeforeMargin = baseLineItemSubtotal;

  console.log("Estimate Builder summary recalculation", {
    baseSubtotal: baseLineItemSubtotal,
    overheadRate: overheadsPercent,
    overheadAmount: overheadsAmount,
    marginRate: marginPercent,
    marginAmount,
    profitRate: profitPercent,
    profitAmount,
    gstAmount: gst,
    salesCommissionRate: salesCommissionPercent,
    salesCommissionAmount,
    finalTotal: finalQuoteTotal,
  });

  return {
    windowsDoors: wd,
    quantities,
    quotation,
    missingRequired: missingRequired(workbook),
    summary: {
      baseLineItemSubtotal,
      subtotalBeforeMargin,
      preliminaryCostsPercent,
      preliminaryCostsAmount,
      salesCommissionPercent,
      salesCommissionAmount,
      overheadsPercent,
      overheadsAmount,
      marginPercent,
      marginAmount,
      profitPercent,
      profitAmount,
      gstPercent,
      totalAllowances,
      subtotalBeforeGst,
      gst,
      qbsaRegistration,
      qLeaveFees,
      totalBeforeSalesCommission,
      finalQuoteTotal,
    },
  };
}

function summaryAdjustmentPercent(workbook = {}, key, fallback = 0) {
  const saved = workbook.summaryAdjustments?.[key];
  if (saved === "" || saved === undefined || saved === null) return number(fallback);
  return number(saved);
}

function summaryAdjustmentAmount(workbook = {}, key, fallback = 0) {
  const saved = workbook.summaryAdjustments?.[key];
  if (saved === "" || saved === undefined || saved === null) return number(fallback);
  return round(number(saved));
}

export function calculateWindowsDoors(rows = []) {
  const calculatedRows = rows.map((sourceRow) => {
    const row = withWindowDoorApproximateRate(withDoorScheduleSelection(sourceRow));
    const approximateRate = windowDoorApproximateRate(row);
    const rowRate = row.rate || approximateRate;
    const quantity = number(row.quantity);
    const width = number(row.width);
    const height = number(row.height);
    const area = width && height ? round(width * height) : number(row.area);
    const totalArea = area && quantity ? round(area * quantity) : number(row.totalArea);
    const sillLength = width && isWindow(row.type) ? round(width * quantity) : number(row.sillLength);
    const headLength = width ? round(width * quantity) : number(row.headLength);
    const jambLength = height ? round(height * 2 * quantity) : number(row.jambLength);
    const revealLength = width || height ? round((width + height * 2) * quantity) : number(row.revealLength);
    const architraveLength = doorArchitraveLength(row, quantity, revealLength || number(row.architraveLength));
    const rate = number(row.supplierQuote || rowRate);
    const cost = rate && quantity ? round(rate * quantity) : number(row.cost);
    return {
      ...row,
      rate: rowRate,
      sourceOfRate: row.sourceOfRate || (row.rate ? "windows/doors schedule" : windowDoorApproximateRateSource(row)),
      level: normalizeLevel(row.level),
      quantity,
      width,
      height,
      area,
      totalArea,
      sillLength,
      headLength,
      jambLength,
      revealLength,
      architraveLength,
      cost,
    };
  });
  const groundFloorArea = round(sumLevel(calculatedRows, "ground", "totalArea"));
  const secondLevelArea = round(sumLevel(calculatedRows, "second", "totalArea"));
  const thirdLevelArea = round(sumLevel(calculatedRows, "third", "totalArea"));
  const groundFloorWindowCount = countWindowLevel(calculatedRows, "ground");
  const secondLevelWindowCount = countWindowLevel(calculatedRows, "second");
  const thirdLevelWindowCount = countWindowLevel(calculatedRows, "third");
  return {
    rows: calculatedRows,
    totals: {
      totalArea: round(sum(calculatedRows, "totalArea")),
      groundFloorArea,
      secondLevelArea,
      thirdLevelArea,
      sillLength: round(sum(calculatedRows, "sillLength")),
      headLength: round(sum(calculatedRows, "headLength")),
      jambLength: round(sum(calculatedRows, "jambLength")),
      revealLength: round(sum(calculatedRows, "revealLength")),
      architraveLength: round(sum(calculatedRows, "architraveLength")),
      itemCount: calculatedRows.reduce((total, row) => total + number(row.quantity), 0),
      windowCount: calculatedRows.filter((row) => isWindow(row.type)).reduce((total, row) => total + number(row.quantity), 0),
      groundFloorWindowCount,
      secondLevelWindowCount,
      thirdLevelWindowCount,
      garageDoorCount: countType(calculatedRows, "Garage Door"),
      entryDoorCount: countType(calculatedRows, "Entry Door"),
      internalDoorCount: countInternalDoors(calculatedRows),
    },
  };
}

function calculateQuotation(quotation, quantities, options = {}) {
  const fees = { qbsaRegistration: 0, qLeaveFees: 0 };
  const quotationWithWindowDoors = injectWindowDoorQuoteRows(quotation, options.windowsDoors);
  const flyscreenAllowance = round(selectedWindowDoorSubtotal(options.windowsDoors?.rows || []) * 0.1);
  const quoteRowValues = buildQuoteRowFormulaValues(quotation, quantities);
  let calculatedQuotation = Object.fromEntries(Object.entries(quotationWithWindowDoors).map(([sectionName, section]) => {
    const blankInputs = isBlankInputQuoteSectionName(sectionName);
    const blankQty = isBlankQtyQuoteSectionName(sectionName);
    const rows = removeRemovedImportedQuoteRows(removeRoofingMaterialsRemovedRows(sectionName, section.rows)).map((row) => {
      if (isForcedBlankQuoteQtyRow(row)) return forcedBlankQuoteQtyRow(row);
      const quoteRow = isFlyscreenAllowanceQuoteRow(row) ? flyscreenAllowanceQuoteRow(row, flyscreenAllowance) : row;
      if (blankInputs && !isRoofTrussesRoofAreaQuoteRow(quoteRow)) return blankInputQuoteRow(quoteRow);
      const qtyRow = blankFoundationsHeaderQtyRow(blankQty && !quoteRow.generatedWindowDoorQuoteRow && !quoteRow.generatedFlyscreenQuoteRow ? blankQtyQuoteRow(quoteRow) : quoteRow);
      const quantityKey = normalizedQuoteQuantityKey(qtyRow);
      const linkedQty = number(quantities[quantityKey]);
      const forceLinkedQty = FORCE_LINKED_QUOTE_QTY_KEYS.has(quantityKey);
      const floorSystemQty = isFloorSystemQuoteQuantityKey(quantityKey);
      const floorSystemLinkedQty = floorSystemQty ? floorSystemQuoteQuantity(qtyRow, quantityKey, quantities) : 0;
      const linkedQtyRow = Boolean(quantityKey);
      const manualOverride = qtyRow.quantityManualOverride === true;
      const linkedQuantityControlsDisplay = forceLinkedQty || floorSystemQty || (linkedQtyRow && !manualOverride);
      const manualQty = qtyRow.autoQuantity || forceLinkedQty || floorSystemQty || (linkedQtyRow && !manualOverride)
        ? 0
        : (isRow150CavitySliderQtyImport(qtyRow) ? 0 : quoteQuantityValue(qtyRow.quantity, quantities));
      const formulaQty = !forceLinkedQty && !floorSystemQty && (!hasManualQuantity(qtyRow) || isRow150CavitySliderQtyImport(qtyRow)) ? quoteFormulaQuantity(qtyRow, { ...quantities, ...quoteRowValues }) : 0;
      const qty = floorSystemQty ? floorSystemLinkedQty : (manualQty || formulaQty || linkedQty);
      const sourceNotes = isRow150CavitySliderQtyImport(qtyRow) ? "Formula: =B104" : qtyRow.notes;
      const notes = quoteNotesWithImportedData(sourceNotes, Boolean(quoteRowSourceNumber(qtyRow) !== 116 && !manualQty && (formulaQty || linkedQty || floorSystemLinkedQty) && qty), quantityKey);
      const rateInfo = finalRate(qtyRow);
      const excluded = qtyRow.lineType === "Excluded item";
      const waitingOnQuote = (qtyRow.lineType === "Quote required" || qtyRow.quoteRequired) && rateInfo.rate === "";
      const frameInactive = isFrameMethodInactive(qtyRow, options.frameMethod);
      const inactive = qtyRow.active === false || excluded || waitingOnQuote || frameInactive;
      const rate = number(rateInfo.rate);
      const cost = !inactive && qty && rate ? round(qty * rate) : 0;
      const feeType = quoteFeeType(qtyRow);
      if (feeType) fees[feeType] = round(fees[feeType] + cost);
      const hidden = frameInactive || isHiddenQuoteRow(qtyRow) || shouldHideZeroLinkedQuoteRow(qtyRow, quantityKey, qty);
      const row150CavitySliderQtyImport = isRow150CavitySliderQtyImport(qtyRow);
      return {
        ...qtyRow,
        quantity: row150CavitySliderQtyImport ? (hidden || !qty ? "" : String(qty)) : (linkedQuantityControlsDisplay ? (hidden || !qty ? "" : String(qty)) : qtyRow.quantity),
        quantityKey,
        autoQuantity: linkedQuantityControlsDisplay ? Boolean(qty) : qtyRow.autoQuantity,
        quantityManualOverride: row150CavitySliderQtyImport ? false : (linkedQuantityControlsDisplay ? false : qtyRow.quantityManualOverride),
        qty: hidden ? 0 : qty,
        finalRateUsed: rateInfo.rate,
        sourceOfRate: rateInfo.source,
        cost: hidden ? 0 : cost,
        notes,
        feeType,
        inactiveReason: frameInactive ? `Hidden by ${options.frameMethod}` : "",
      };
    });
    const subtotalBeforeTotalRows = round(rows.reduce((sum, row) => sum + (row.feeType || row.cabinetMakerTotalRow ? 0 : row.cost), 0));
    const rowsWithTotals = rows.map((row) => (
      row.cabinetMakerTotalRow
        ? { ...row, quantity: "", qty: 0, finalRateUsed: "", sourceOfRate: "manual", cost: subtotalBeforeTotalRows }
        : row
    ));
    const calculatedSubtotal = round(rowsWithTotals.reduce((sum, row) => sum + (row.feeType || row.cabinetMakerTotalRow ? 0 : row.cost), 0));
    const workbookSubtotal = number(section.workbookSummaryValue);
    return [sectionName, { ...section, rows: rowsWithTotals, subtotal: workbookSubtotal || calculatedSubtotal }];
  }));
  calculatedQuotation = applySubcontractorQuoteAllocations(calculatedQuotation, options.workbook || {});
  return { quotation: calculatedQuotation, fees };
}

function applySubcontractorQuoteAllocations(quotation = {}, workbook = {}) {
  let nextQuotation = applySubcontractorQuoteAllocation(quotation, workbook, {
    contractorKey: "plumber",
    inputSourceRow: 30080,
    targetSourceRow: 30076,
    targetLabel: "Plumbing Fit Off",
  });
  nextQuotation = applySubcontractorQuoteAllocation(nextQuotation, workbook, {
    contractorKey: "electrician",
    targetSourceRow: 30077,
    targetLabel: "Electrical Fit Off",
  });
  return nextQuotation;
}

function applySubcontractorQuoteAllocation(quotation = {}, workbook = {}, config = {}) {
  const quote = subcontractorQuoteData(workbook, config.contractorKey);
  const useQuote = Boolean(quote.useQuote);
  const totalQuoteAmount = number(quote.quoteAmount);
  const inputRow = config.inputSourceRow ? findQuoteRowBySource(quotation, config.inputSourceRow) : null;
  if (!useQuote && !inputRow) return quotation;
  const quoteAmount = useQuote && totalQuoteAmount > 0 ? totalQuoteAmount : plumberQuoteInputAmount(inputRow || {});
  if (!quoteAmount && !inputRow) return quotation;
  const deductions = selectedSubcontractorDeductions(workbook, quotation, config.contractorKey);
  const deductionTotal = round(deductions.reduce((sum, deduction) => sum + deduction.amount, 0));
  const fitOffBalance = Math.max(0, round(quoteAmount - deductionTotal));
  return Object.fromEntries(Object.entries(quotation || {}).map(([sectionName, section]) => {
    let changed = false;
    const rows = (section.rows || []).map((row) => {
      const rowNumber = quoteRowSourceNumber(row);
      if (config.inputSourceRow && rowNumber === config.inputSourceRow) {
        changed = true;
        return {
          ...row,
          quantity: quoteAmount ? String(quoteAmount) : (row.quantity || row.values?.[1] || row.manualRate || row.excelRate || row.finalRateUsed || ""),
          qty: 0,
          manualRate: row.manualRate || "",
          excelRate: row.excelRate || "",
          finalRateUsed: "",
          sourceOfRate: "manual",
          cost: 0,
          importedCost: "",
          formulas: {},
          notes: "Input only: total subcontractor quote. This row is not included in the quote total.",
        };
      }
      if (useQuote && rowNumber === config.targetSourceRow) {
        changed = true;
        return {
          ...row,
          quantity: "1",
          qty: 1,
          manualRate: "",
          excelRate: fitOffBalance,
          finalRateUsed: fitOffBalance,
          sourceOfRate: "calculated",
          cost: fitOffBalance,
          notes: `Calculated balance: ${config.targetLabel} quote less ${deductions.map((deduction) => `${deduction.label} (${moneyText(deduction.amount)})`).join(", ") || "selected deductions"}`,
        };
      }
      return row;
    });
    if (!changed) return [sectionName, section];
    const subtotal = round(rows.reduce((sum, row) => sum + (row.feeType || row.cabinetMakerTotalRow ? 0 : number(row.cost)), 0));
    return [sectionName, { ...section, rows, subtotal }];
  }));
}

function subcontractorQuoteData(workbook = {}, contractorKey = "") {
  return workbook?.data?.subcontractorQuotes?.rows?.[contractorKey] || {};
}

function selectedSubcontractorDeductions(workbook = {}, quotation = {}, contractorKey = "") {
  const quote = subcontractorQuoteData(workbook, contractorKey);
  const selected = quote.deductions || {};
  return (SUBCONTRACTOR_QUOTE_DEDUCTIONS[contractorKey] || [])
    .filter((deduction) => Boolean(selected[deduction.key]))
    .map((deduction) => ({
      ...deduction,
      amount: deduction.sourceRow ? number(findQuoteRowBySource(quotation, deduction.sourceRow)?.cost) : number(selected[`${deduction.key}Amount`]),
    }));
}

function plumberQuoteInputAmount(row = {}) {
  return [
    row.quantity,
    row.qty,
    row.manualRate,
    row.supplierQuote,
    row.excelRate,
    row.finalRateUsed,
    row.cost,
    row.importedCost,
    row.values?.[1],
    row.values?.[5],
    row.values?.[6],
  ].map((value) => quoteQuantityValue(value, {})).find((value) => value > 0) || 0;
}

function findQuoteRowBySource(quotation = {}, sourceRow) {
  return Object.values(quotation || {}).flatMap((section) => section?.rows || []).find((row) => quoteRowSourceNumber(row) === sourceRow) || null;
}

function moneyText(value) {
  return `$${number(value).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function isForcedBlankQuoteQtyRow(row) {
  const rowNumber = quoteRowSourceNumber(row);
  if (rowNumber === 1280) return false;
  return rowNumber === 116 || rowNumber === 1210 || (rowNumber >= 1275 && rowNumber <= 1283);
}

function forcedBlankQuoteQtyRow(row) {
  const rateInfo = finalRate(row);
  return {
    ...row,
    quantity: "",
    importedQuantity: "",
    quantityKey: "",
    autoQuantity: false,
    quantityManualOverride: false,
    formulas: {},
    qty: 0,
    cost: 0,
    finalRateUsed: rateInfo.rate,
    sourceOfRate: rateInfo.source,
    notes: removeImportedDataNote(row.notes),
  };
}

function isNoImportedDataQuoteRow(row) {
  const rowNumber = quoteRowSourceNumber(row);
  if (rowNumber === 1280) return false;
  return normalizedSectionName(row?.section) === "waterproofing" || normalizedSectionName(row?.section) === "hot water" || QUOTE_ROWS_WITHOUT_IMPORTED_DATA.has(rowNumber) || (rowNumber >= 1275 && rowNumber <= 1283) || (rowNumber >= 1357 && rowNumber <= 1362);
}

function removeImportedDataNote(notes) {
  return String(notes || "")
    .split("|")
    .map((part) => part.trim())
    .filter((part) => part && part.toUpperCase() !== "IMPORTED DATA")
    .join(" | ");
}

function removeRoofingMaterialsRemovedRows(sectionName, rows = []) {
  if (normalizedSectionName(sectionName) !== "roofing materials") return rows;
  return rows.filter((row) => {
    const rowNumber = Number(row?.excelRow || row?.sourceRow || row?.values?.sourceRow || 0);
    return rowNumber < 1130 || rowNumber > 1266;
  });
}

function removeRemovedImportedQuoteRows(rows = []) {
  return rows.filter((row) => !REMOVED_IMPORTED_QUOTE_SOURCE_ROWS.has(quoteRowSourceNumber(row)));
}

function quoteRowSourceNumber(row) {
  const direct = row?.sourceRow ?? row?.excelRow ?? row?.importedWorkbookRow;
  const idMatch = String(row?.id || "").match(/^quote-(\d+)$/);
  const value = direct ?? idMatch?.[1];
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function injectWindowDoorQuoteRows(quotation = {}, windowsDoors) {
  const windowRows = selectedWindowDoorQuoteRows(windowsDoors?.rows || []);
  const entranceDoorRows = selectedEntranceDoorQuoteRows(windowsDoors?.rows || []);
  const garageDoorRows = selectedGarageDoorWindowDoorRows(windowsDoors?.rows || []);
  return Object.fromEntries(Object.entries(quotation).map(([sectionName, section]) => {
    const name = normalizedSectionName(sectionName);
    if (name === "windows") {
      const rowsWithoutGenerated = (section.rows || []).filter((row) => !row.generatedWindowDoorQuoteRow);
      return [sectionName, { ...section, rows: windowRows.length ? insertRowsAfterSourceRow(rowsWithoutGenerated, windowRows, 750) : rowsWithoutGenerated }];
    }
    if (name === "doors" || name === "entrance doors") {
      return [sectionName, { ...section, rows: entranceDoorRows }];
    }
    if (name === "garage doors - sectional panel lift") {
      return [sectionName, { ...section, rows: applyGarageDoorSelectionsToQuoteRows(section.rows || [], garageDoorRows) }];
    }
    return [sectionName, section];
  }));
}

function selectedWindowDoorQuoteRows(rows = []) {
  return rows
    .filter((row) => number(row.quantity) > 0)
    .filter((row) => !isEntranceDoorWindowDoorRow(row))
    .map(windowDoorQuoteRow);
}

function selectedEntranceDoorQuoteRows(rows = []) {
  return rows
    .filter((row) => number(row.quantity) > 0)
    .filter(isEntranceDoorWindowDoorRow)
    .filter((row) => !isGarageDoorWindowDoorRow(row))
    .map((row) => windowDoorQuoteRow(row, "DOORS"));
}

function selectedGarageDoorWindowDoorRows(rows = []) {
  return rows
    .filter((row) => number(row.quantity) > 0)
    .filter(isGarageDoorWindowDoorRow);
}

function selectedWindowDoorSubtotal(rows = []) {
  return rows
    .filter((row) => number(row.quantity) > 0)
    .filter((row) => !isEntranceDoorWindowDoorRow(row))
    .reduce((total, row) => total + number(row.cost), 0);
}

function isEntranceDoorWindowDoorRow(row) {
  const text = `${row?.type || ""} ${row?.section || ""} ${row?.category || ""} ${row?.code || ""}`.toLowerCase();
  return text.includes("entry doors")
    || text.includes("entry door")
    || text.includes("internal door")
    || text.includes("garage door")
    || text.includes("laundry external door")
    || text.includes("garage rear door");
}

function isGarageDoorWindowDoorRow(row) {
  const text = `${row?.type || ""} ${row?.section || ""} ${row?.category || ""} ${row?.code || ""}`.toLowerCase();
  return text.includes("garage door");
}

function applyGarageDoorSelectionsToQuoteRows(rows = [], garageDoorRows = []) {
  if (!garageDoorRows.length) return rows.map(clearGarageDoorImportedSelection);
  return rows.map((row) => {
    const matchingRows = garageDoorRows.filter((garageDoorRow) => garageDoorSelectionMatchesQuoteRow(garageDoorRow, row));
    const quantity = matchingRows.reduce((total, item) => total + number(item.quantity), 0);
    if (!quantity) return clearGarageDoorImportedSelection(row);
    const item = row.item || row.values?.[0] || "";
    return {
      ...row,
      item,
      quantity: String(quantity),
      importedQuantity: "",
      quantityKey: "",
      autoQuantity: false,
      quantityManualOverride: false,
      notes: quoteNotesWithImportedData(row.notes, true),
      values: Array.isArray(row.values) ? [item, String(quantity), row.values[2] || "", row.values[3] || "ITEM", row.values[4] || "", row.values[5] || row.excelRate || "", row.values[6] || ""] : row.values,
    };
  });
}

function clearGarageDoorImportedSelection(row) {
  const item = row.item || row.values?.[0] || "";
  return {
    ...row,
    item,
    quantity: "",
    importedQuantity: "",
    quantityKey: "",
    autoQuantity: false,
    quantityManualOverride: false,
    values: Array.isArray(row.values) ? [item, "", row.values[2] || "", row.values[3] || "ITEM", row.values[4] || "", row.values[5] || row.excelRate || "", row.values[6] || ""] : row.values,
  };
}

function garageDoorSelectionMatchesQuoteRow(selectionRow, quoteRow) {
  const selected = garageDoorDimensions(selectionRow?.code || selectionRow?.item || selectionRow?.rawText || "");
  const quoted = garageDoorDimensions(`${quoteRow?.item || ""} ${(quoteRow?.values || []).join(" ")}`);
  return selected.length === 2 && quoted.length === 2 && selected[0] === quoted[0] && selected[1] === quoted[1];
}

function garageDoorDimensions(text) {
  const matches = String(text || "").match(/\d+(?:\.\d+)?/g);
  if (!matches || matches.length < 2) return [];
  return matches.slice(0, 2).map((value) => {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) return 0;
    return numberValue < 20 ? Math.round(numberValue * 1000) : Math.round(numberValue);
  });
}

function windowDoorQuoteRow(row, section = "WINDOWS") {
  const quantity = number(row.quantity);
  const code = String(row.code || row.size || row.item || row.rawText || "Window/Door").trim();
  const type = String(row.type || "").trim();
  const level = String(row.level || "").trim();
  const rate = row.supplierQuote || row.rate || windowDoorApproximateRate(row) || row.excelRate || "";
  const rateSource = row.supplierQuote ? "supplier quote" : (row.sourceOfRate || windowDoorApproximateRateSource(row) || "windows/doors schedule");
  const sourceId = row.id || row.sourceRow || `${code}-${type}-${level}`;
  const item = [code, type, level].filter(Boolean).join(" - ");
  return {
    id: `quote-window-door-${stableIdPart(sourceId)}`,
    section,
    item,
    quantity: String(quantity),
    importedQuantity: "",
    quantityKey: "",
    unit: "EACH",
    excelRate: rate,
    supplierCatalogueRate: "",
    quotedSupplierRate: "",
    manualRate: "",
    supplierQuote: "",
    sourceOfRate: rate ? rateSource : "rate missing",
    active: true,
    generatedWindowDoorQuoteRow: true,
    windowDoorSourceId: row.id || "",
    windowDoorSourceRow: row.sourceRow || "",
    notes: row.supplierQuote ? "Imported from supplier quote on windows/doors schedule" : "Approximate initial estimate rate. Confirm with supplier quote.",
    values: [item, String(quantity), "", "EACH", "", rate, ""],
    formulas: {},
  };
}

function isFlyscreenAllowanceQuoteRow(row) {
  return normalizedSectionName(row?.section) === "windows" && Number(row?.sourceRow || row?.excelRow || 0) === 753;
}

function flyscreenAllowanceQuoteRow(row, allowance) {
  const rate = allowance ? money(allowance) : "";
  return {
    ...row,
    item: "FLYSCREENS - ALLOWANCE (10% OF WINDOWS/DOORS)",
    quantity: allowance ? "1" : "",
    importedQuantity: "",
    quantityKey: "",
    unit: "ALLOWANCE",
    excelRate: rate,
    manualRate: "",
    supplierQuote: "",
    sourceOfRate: allowance ? "10% of selected windows/doors" : "rate missing",
    generatedFlyscreenQuoteRow: true,
    notes: "Approximate flyscreen allowance. Confirm with supplier quote.",
    values: ["FLYSCREENS - ALLOWANCE (10% OF WINDOWS/DOORS)", allowance ? "1" : "", "", "ALLOWANCE", "", rate, ""],
    formulas: {},
  };
}

function insertRowsAfterSourceRow(rows = [], insertRows = [], sourceRow) {
  const insertionIndex = rows.findIndex((row) => Number(row.sourceRow || row.excelRow || 0) === sourceRow);
  if (insertionIndex < 0) return [...rows, ...insertRows];
  return [
    ...rows.slice(0, insertionIndex + 1),
    ...insertRows,
    ...rows.slice(insertionIndex + 1),
  ];
}

function stableIdPart(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "item";
}

const FORCE_LINKED_QUOTE_QTY_KEYS = new Set([
  "roofAreaM2",
  "totalEavesLm",
  "quoteFrameSecondStoreyTrusses",
  "quoteFrameThirdStoreyTrusses",
]);

const HIDE_ZERO_LINKED_QUOTE_QTY_KEYS = new Set([
  "quoteFrameSecondStoreyTrusses",
  "quoteFrameThirdStoreyTrusses",
  "quoteFrameFloorJoistsThirdM2",
  "quoteFrameSheetFlooringThirdM2",
]);

function shouldHideZeroLinkedQuoteRow(row, quantityKey, qty) {
  if (!HIDE_ZERO_LINKED_QUOTE_QTY_KEYS.has(quantityKey)) return false;
  return !number(qty);
}

function buildQuoteRowFormulaValues(quotation, quantities) {
  const values = {};
  const rows = Object.values(quotation || {}).flatMap((section) => section?.rows || []);
  rows.forEach((row) => {
    const rowNumber = row.excelRow || row.sourceRow;
    if (!rowNumber) return;
    const quantityKey = normalizedQuoteQuantityKey(row);
    const manualQty = row.autoQuantity || isRow150CavitySliderQtyImport(row) ? 0 : quoteQuantityValue(row.quantity, quantities);
    const linkedQty = number(quantities[quantityKey]);
    values[`B${rowNumber}`] = manualQty || linkedQty;
  });
  for (let pass = 0; pass < 5; pass += 1) {
    let changed = false;
    rows.forEach((row) => {
      const rowNumber = row.excelRow || row.sourceRow;
      if (!rowNumber) return;
      if (hasManualQuantity(row) && !isRow150CavitySliderQtyImport(row)) return;
      const formulaQty = quoteFormulaQuantity(row, { ...quantities, ...values });
      if (!formulaQty || values[`B${rowNumber}`] === formulaQty) return;
      values[`B${rowNumber}`] = formulaQty;
      changed = true;
    });
    if (!changed) break;
  }
  return values;
}

function quoteFormulaQuantity(row, quoteRowValues) {
  const formula = row?.formulas?.B || "";
  if (!formula) return 0;
  const result = evaluateFormula(formula, quoteRowValues);
  return Number.isFinite(result) ? round(Math.max(0, result)) : 0;
}

function hasManualQuantity(row) {
  return String(row?.quantity ?? "").trim() !== "";
}

function isRow150CavitySliderQtyImport(row) {
  return quoteRowSourceNumber(row) === 150 && String(row?.formulas?.B || "").trim() === "B104";
}

function blankQtyQuoteRow(row) {
  const importedQuantity = row.importedQuantity ?? "";
  const currentQuantity = row.quantity ?? "";
  return {
    ...row,
    quantity: importedQuantity !== "" && String(currentQuantity) === String(importedQuantity) ? "" : currentQuantity,
    importedQuantity: "",
    quantityKey: "",
  };
}

function blankFoundationsHeaderQtyRow(row) {
  if (normalizedSectionName(row.section) !== "foundations") return row;
  if (String(row.item || row.values?.[0] || "").trim().toLowerCase() !== "item") return row;
  return String(row.quantity ?? "").trim() === "280" ? { ...row, quantity: "", importedQuantity: "", quantityKey: "" } : row;
}

function blankInputQuoteRow(row) {
  const item = row.item || row.values?.[0] || "";
  const unit = row.unit || row.values?.[3] || "";
  const excelRate = row.excelRate || row.values?.[5] || "";
  const qty = quoteQuantityValue(row.quantity, {});
  const rate = number(row.manualRate || excelRate);
  const cost = qty && rate ? round(qty * rate) : 0;
  return {
    ...row,
    item,
    values: [item, "", "", unit, "", excelRate, ""],
    rawText: item,
    quantity: row.quantity || "",
    importedQuantity: "",
    quantityKey: "",
    unit,
    excelRate,
    supplierCatalogueRate: "",
    quotedSupplierRate: "",
    manualRate: row.manualRate || "",
    supplierQuote: "",
    finalRateUsed: row.manualRate || excelRate,
    sourceOfRate: excelRate ? "workbook" : "rate missing",
    importedCost: "",
    notes: row.notes || "",
    formulas: {},
    qty,
    cost,
  };
}

function isBlankInputQuoteSectionName(sectionName) {
  return normalizedSectionName(sectionName) === "roof framing";
}

function isRoofTrussesRoofAreaQuoteRow(row) {
  const rowNumber = Number(row?.excelRow || row?.sourceRow || row?.values?.sourceRow || 0);
  return rowNumber === 727 || rowNumber === 803;
}

function isBlankQtyQuoteSectionName(sectionName) {
  const name = normalizedSectionName(sectionName);
  return ["demolition works", "base brickwork", "face brickwork", "bricklayers labour", "entry doors", "double entry doors", "windows", "couplings", "misc", "materials", "roofing materials", "roofing labour", "renderers labour", "misc rendering"].includes(name) || name.startsWith("roof cover");
}

function normalizedSectionName(sectionName) {
  return String(sectionName || "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/\s*\(\d+\)\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function quoteQuantityValue(value, quantities) {
  const text = String(value ?? "").trim();
  if (!text.startsWith("=")) return number(value);
  const result = evaluateFormula(text.slice(1), quantities);
  return Number.isFinite(result) ? round(Math.max(0, result)) : 0;
}

function quoteNotesWithImportedData(notes, imported, quantityKey = "") {
  const text = String(notes || "").trim();
  if (text.toLowerCase().startsWith("formula:")) return text;
  if (!imported) return text;
  const sourceNote = quoteQuantitySourceNote(quantityKey);
  if (sourceNote) {
    const cleaned = removeImportedDataNote(text);
    if (!cleaned) return sourceNote;
    return cleaned.toLowerCase().includes(sourceNote.toLowerCase()) ? cleaned : `${cleaned} | ${sourceNote}`;
  }
  if (!text) return "IMPORTED DATA";
  return text.toUpperCase().includes("IMPORTED DATA") ? text : `${text} | IMPORTED DATA`;
}

function quoteQuantitySourceNote(quantityKey) {
  const key = String(quantityKey || "").trim();
  if (!key) return "";
  const sourceByKey = {
    quoteFaceBricksBaseRange: "(netExternalWallAreaM2 * 52 / 1000) * 1.1",
    quoteCommonSingleHeights: "quoteCommonTwinHeights * 0.1",
    quoteCommonTwinHeights: "(netExternalWallAreaM2 * 26 / 1000) * 1.1",
    quoteBrickSillBricks: "(sillLm / 0.085) / 1000",
    lowerExternalPlasterboardWallM2: "Data Input 106.1 Ground Level external plasterboard wall m2",
    lowerInternalPlasterboardWallM2: "Data Input 106.2 Ground Level internal plasterboard wall m2",
    corniceLm: "Data Input 118 Cornice LM",
    quoteFrameInstallWindows: "windowCount",
    quoteFrameSecondStoreyWindows: "secondLevelWindowCount",
    quoteFrameThirdStoreyWindows: "thirdLevelWindowCount",
  };
  return `Formula: ${key}${sourceByKey[key] ? ` = ${sourceByKey[key]}` : ""}`;
}

function normalizedQuoteQuantityKey(row) {
  const floorSystemQuantityKey = floorSystemQuoteQuantityKey(row);
  if (floorSystemQuantityKey) return floorSystemQuantityKey;
  const text = `${row?.item || ""} ${row?.rawText || ""}`.toLowerCase();
  if (isNoImportedDataQuoteRow(row)) return "";
  if (isManualSkirtingTileQuoteRow(row)) return "";
  if (isManualCeilingBattInsulationRow(row)) return "";
  if (String(row?.id || "") === "quote-1279" || quoteRowSourceNumber(row) === 1279) return "";
  if (String(row?.id || "") === "quote-1280" || quoteRowSourceNumber(row) === 1280 || text.includes("90mm cove cornice")) return "corniceLm";
  if (isBlankQuoteQtyRow(row)) return "";
  if (text.includes("cut/fill") || text.includes("cut fill")) return "cutFillM3";
  if (text.includes("total ground floor area")) return "lowerSlabAreaM2";
  if (text.includes("cornice") && text.includes("supply") && text.includes("install")) return "corniceLm";
  if (isRoofTrussesRoofAreaQuoteRow(row)) return "roofAreaM2";
  if (Number(row?.excelRow || row?.sourceRow || 0) === 629 && normalizedSectionName(row?.section) === "flooring") return "totalBalconyAreaM2";
  if (normalizedSectionName(row?.section) === "flooring" && text.includes("secura flooring") && text.includes("balcony")) return "totalBalconyAreaM2";
  if (normalizedSectionName(row?.section) === "concretors labour" && text.includes("concretor - prep, pour & dress")) return "lowerSlabAreaM2";
  if (String(row?.id || "") === "quote-489" || text.includes("70mm exterior walls frames")) return "totalExternal70mmWallsLm";
  if (String(row?.id || "") === "quote-490" || text.includes("90mm exterior walls frames")) return "totalExternal90mmWallsLm";
  if (String(row?.id || "") === "quote-642" || text.includes("70mm internal wall frames")) return "totalInternal70mmWallsLm";
  if (String(row?.id || "") === "quote-643" || text.includes("90mm internal wall frames")) return "totalInternal90mmWallsLm";
  if (normalizedSectionName(row?.section) === "face brickwork" && text.includes("face bricks - base range")) return "quoteFaceBricksBaseRange";
  if (normalizedSectionName(row?.section) === "face brickwork" && text.includes("common single heights")) return "quoteCommonSingleHeights";
  if (normalizedSectionName(row?.section) === "face brickwork" && text.includes("common twin heights")) return "quoteCommonTwinHeights";
  if (normalizedSectionName(row?.section) === "face brickwork" && text.includes("add bricks for sills")) return "quoteBrickSillBricks";
  if (normalizedSectionName(row?.section) === "bricklayers labour" && text.includes("bricklayer single height")) return "quoteBricklayerSingleHeight";
  if (normalizedSectionName(row?.section) === "bricklayers labour" && text.includes("bricklayer double heights")) return "quoteBricklayerDoubleHeights";
  if (normalizedSectionName(row?.section) === "bricklayers labour" && text.includes("brick sills")) return "quoteBricklayerSillsLm";
  if (normalizedSectionName(row?.section) === "bricklayers labour" && text.includes("brick window sills required")) return "quoteBricklayerSillsLm";
  if (normalizedSectionName(row?.section) === "bricklayers labour" && text.includes("bricklayer")) return "quoteBricklayerFaceBricks";
  if (normalizedSectionName(row?.section) === "rendering" && String(row?.item || "").trim().toLowerCase() === "item") return "quoteRenderingNetWallAreaM2";
  if (normalizedSectionName(row?.section) === "rendering" && text.includes("add for sills")) return "quoteRenderingSillsLm";
  if (normalizedSectionName(row?.section) === "plasterer - supply and install" && (String(row?.id || "") === "quote-1269" || quoteRowSourceNumber(row) === 1269 || text.includes("gyprock supply & fix - exterior walls"))) return "lowerExternalPlasterboardWallM2";
  if (normalizedSectionName(row?.section) === "plasterer - supply and install" && (String(row?.id || "") === "quote-1270" || quoteRowSourceNumber(row) === 1270 || text.includes("gyprock supply & fix - internal walls"))) return "lowerInternalPlasterboardWallM2";
  if (normalizedSectionName(row?.section) === "frame stage labour" && text.includes("install windows")) return "quoteFrameInstallWindows";
  if (normalizedSectionName(row?.section) === "frame stage labour" && text.includes("second storey windows")) return "quoteFrameSecondStoreyWindows";
  if (normalizedSectionName(row?.section) === "frame stage labour" && text.includes("third storey windows")) return "quoteFrameThirdStoreyWindows";
  if (normalizedSectionName(row?.section) === "frame stage labour" && text.includes("stand & install roof trusses")) return "quoteFrameRoofTrusses";
  if (normalizedSectionName(row?.section) === "frame stage labour" && text.includes("second storey trusses")) return "quoteFrameSecondStoreyTrusses";
  if (normalizedSectionName(row?.section) === "frame stage labour" && text.includes("third storey trusses")) return "quoteFrameThirdStoreyTrusses";
  if (normalizedSectionName(row?.section) === "frame stage labour" && text.includes("install ceiling battens ground floor")) return "quoteFrameCeilingBattensGroundM2";
  if (normalizedSectionName(row?.section) === "frame stage labour" && text.includes("install ceiling battens second level")) return "quoteFrameCeilingBattensSecondM2";
  if (normalizedSectionName(row?.section) === "frame stage labour" && text.includes("install ceiling battens third level")) return "quoteFrameCeilingBattensThirdM2";
  if (normalizedSectionName(row?.section) === "frame stage labour" && text.includes("install ceiling battens")) return "quoteFrameCeilingBattensGroundM2";
  if (normalizedSectionName(row?.section) === "lock-up stage labour" && text.includes("line eaves")) return "totalEavesLm";
  if (normalizedSectionName(row?.section) === "lock-up stage labour" && text.includes("install sisalation") && text.includes("ground")) return "quoteSisalationInstallGroundM2";
  if (normalizedSectionName(row?.section) === "lock-up stage labour" && text.includes("install sisalation") && (text.includes("second") || text.includes("upper"))) return "quoteSisalationInstallSecondM2";
  if (normalizedSectionName(row?.section) === "lock-up stage labour" && text.includes("install sisalation") && text.includes("third")) return "quoteSisalationInstallThirdM2";
  if (normalizedSectionName(row?.section) === "lock-up stage labour" && text.includes("install wall insulation batts") && text.includes("ground")) return "quoteWallBattsInstallGroundM2";
  if (normalizedSectionName(row?.section) === "lock-up stage labour" && text.includes("install wall insulation batts") && (text.includes("second") || text.includes("upper"))) return "quoteWallBattsInstallSecondM2";
  if (normalizedSectionName(row?.section) === "lock-up stage labour" && text.includes("install wall insulation batts") && text.includes("third")) return "quoteWallBattsInstallThirdM2";
  if (normalizedSectionName(row?.section) === "lock-up stage labour" && text.includes("install insulation ceiling batts")) return "quoteCeilingInsulationFlatM2";
  if (normalizedSectionName(row?.section) === "insulation" && text.includes("batts to ceilings")) return "quoteCeilingInsulationFlatM2";
  if (normalizedSectionName(row?.section) === "insulation" && (text.includes("sialation installed") || text.includes("sisalation installed") || text.includes("sisaltion installed")) && text.includes("ground level")) return "quoteSisalationInstallGroundM2";
  if (normalizedSectionName(row?.section) === "insulation" && (text.includes("sialation installed") || text.includes("sisalation installed") || text.includes("sisaltion installed")) && text.includes("second level")) return "quoteSisalationInstallSecondM2";
  if (normalizedSectionName(row?.section) === "insulation" && (text.includes("sialation installed") || text.includes("sisalation installed") || text.includes("sisaltion installed")) && text.includes("third level")) return "quoteSisalationInstallThirdM2";
  if (normalizedSectionName(row?.section) === "insulation" && text.includes("install wall batts") && text.includes("ground level")) return "quoteWallBattsInstallGroundM2";
  if (normalizedSectionName(row?.section) === "insulation" && text.includes("install wall batts") && text.includes("second level")) return "quoteWallBattsInstallSecondM2";
  if (normalizedSectionName(row?.section) === "insulation" && text.includes("install wall batts") && text.includes("third level")) return "quoteWallBattsInstallThirdM2";
  if (normalizedSectionName(row?.section) === "frame stage labour" && text.includes("tie down & sheet bracing ground level")) return "quoteFrameTieDownSheetBracingGroundM2";
  if (normalizedSectionName(row?.section) === "frame stage labour" && text.includes("tie down & sheet bracing second level")) return "quoteFrameTieDownSheetBracingSecondM2";
  if (normalizedSectionName(row?.section) === "frame stage labour" && text.includes("tie down & sheet bracing third level")) return "quoteFrameTieDownSheetBracingThirdM2";
  if (normalizedSectionName(row?.section) === "frame stage labour" && text.includes("exterior walls - ground floor")) return "quoteFrameExteriorWallsGroundLm";
  if (normalizedSectionName(row?.section) === "frame stage labour" && text.includes("exterior walls - second level")) return "quoteFrameExteriorWallsSecondLm";
  if (normalizedSectionName(row?.section) === "frame stage labour" && text.includes("exterior walls - third level")) return "quoteFrameExteriorWallsThirdLm";
  if (normalizedSectionName(row?.section) === "frame stage labour" && text.includes("interior walls - lower")) return "quoteFrameInteriorWallsGroundLm";
  if (normalizedSectionName(row?.section) === "frame stage labour" && text.includes("interior walls - second level")) return "quoteFrameInteriorWallsSecondLm";
  if (normalizedSectionName(row?.section) === "frame stage labour" && text.includes("interior walls - third level")) return "quoteFrameInteriorWallsThirdLm";
  if (normalizedSectionName(row?.section) === "frame stage labour" && text.includes("install floor joists") && text.includes("third")) return "quoteFrameFloorJoistsThirdM2";
  if (normalizedSectionName(row?.section) === "frame stage labour" && text.includes("install floor joists")) return "quoteFrameFloorJoistsSecondM2";
  if (normalizedSectionName(row?.section) === "frame stage labour" && text.includes("lay sheet flooring") && text.includes("third")) return "quoteFrameSheetFlooringThirdM2";
  if (normalizedSectionName(row?.section) === "frame stage labour" && text.includes("lay sheet flooring")) return "quoteFrameSheetFlooringSecondM2";
  if (normalizedSectionName(row?.section) === "external cladding" && text.includes("150mm linea board")) return "quote150LineaBoardLengths";
  if (normalizedSectionName(row?.section) === "external cladding" && text.includes("180mm linea board")) return "quote180LineaBoardLengths";
  if (normalizedSectionName(row?.section) === "external cladding" && text.includes("stria")) return "quote405StriaCladdingLengths";
  if (normalizedSectionName(row?.section) === "external cladding" && text.includes("matrix")) return "quoteLightweightCladdingM2";
  if (normalizedSectionName(row?.section) === "lock-up stage labour" && text.includes("install lightweight cladding") && text.includes("ground")) return "quoteLightweightCladdingInstallGroundM2";
  if (normalizedSectionName(row?.section) === "lock-up stage labour" && text.includes("install lightweight cladding") && (text.includes("second") || text.includes("upper"))) return "quoteLightweightCladdingInstallSecondM2";
  if (normalizedSectionName(row?.section) === "lock-up stage labour" && text.includes("install lightweight cladding") && text.includes("third")) return "quoteLightweightCladdingInstallThirdM2";
  if (text.includes("rolled window flashing")) return "lightweightCladdingWindowCount";
  if (row?.quantityKey === "windowDoorCount" && text.includes("window")) return "windowCount";
  return row?.quantityKey || "";
}

function isManualSkirtingTileQuoteRow(row) {
  const rowNumber = quoteRowSourceNumber(row);
  return rowNumber === 1587 || rowNumber === 1600;
}

function isManualCeilingBattInsulationRow(row) {
  if (normalizedSectionName(row?.section) !== "insulation") return false;
  const text = `${row?.item || ""} ${row?.rawText || ""}`.toLowerCase().replace(/\s+/g, " ").trim();
  return text.includes("r 1.5 batts to ceilings") || text.includes("r1.5 batts to ceilings") || text.includes("r4.8 batts to ceilings") || text.includes("r 4.8 batts to ceilings");
}

function floorSystemQuoteQuantityKey(row) {
  const byId = {
    "quote-593.4": "quoteFloorSystemGround300M2",
    "quote-593.5": "quoteFloorSystemGround360M2",
    "quote-593.6": "quoteFloorSystemSecond300M2",
    "quote-593.7": "quoteFloorSystemSecond360M2",
    "quote-593.8": "quoteFloorSystemThird300M2",
    "quote-593.9": "quoteFloorSystemThird360M2",
  };
  const id = String(row?.id || "").trim();
  if (byId[id]) return byId[id];
  const rowNumber = Number(row?.excelRow || row?.sourceRow || row?.values?.sourceRow || 0);
  if (rowNumber === 593.4) return "quoteFloorSystemGround300M2";
  if (rowNumber === 593.5) return "quoteFloorSystemGround360M2";
  if (rowNumber === 593.6) return "quoteFloorSystemSecond300M2";
  if (rowNumber === 593.7) return "quoteFloorSystemSecond360M2";
  if (rowNumber === 593.8) return "quoteFloorSystemThird300M2";
  if (rowNumber === 593.9) return "quoteFloorSystemThird360M2";
  const item = normalizedFloorSystemText(row?.item || row?.rawText || row?.values?.[0] || "");
  if (!item.includes("floor system")) return "";
  if (item.includes("ground") && (item.includes("319mm") || item.includes("300mm"))) return "quoteFloorSystemGround300M2";
  if (item.includes("ground") && (item.includes("379mm") || item.includes("360mm"))) return "quoteFloorSystemGround360M2";
  if ((item.includes("second") || item.includes("upper")) && (item.includes("319mm") || item.includes("300mm"))) return "quoteFloorSystemSecond300M2";
  if ((item.includes("second") || item.includes("upper")) && (item.includes("379mm") || item.includes("360mm"))) return "quoteFloorSystemSecond360M2";
  if (item.includes("third") && (item.includes("319mm") || item.includes("300mm"))) return "quoteFloorSystemThird300M2";
  if (item.includes("third") && (item.includes("379mm") || item.includes("360mm"))) return "quoteFloorSystemThird360M2";
  return "";
}

function floorSystemQuoteQuantity(row, quantityKey, quantities) {
  const direct = number(quantities?.[quantityKey]);
  if (direct) return direct;

  const floorSystemQuantities = floorSystemQuoteQuantities({
    groundSystem: quantities?.lowerFloorSystem,
    secondSystem: quantities?.upperFloorSystem,
    thirdSystem: quantities?.thirdFloorSystem,
    groundArea: quantities?.lowerSlabAreaM2,
    secondArea: quantities?.secondLevelFloorAreaM2,
    thirdArea: quantities?.thirdLevelFloorAreaM2,
  });
  const key = quantityKey || floorSystemQuoteQuantityKey(row);
  return number(floorSystemQuantities[key]);
}

function isFloorSystemQuoteQuantityKey(quantityKey) {
  return String(quantityKey || "").startsWith("quoteFloorSystem");
}

function isBlankQuoteQtyRow(row) {
  if (quoteRowSourceNumber(row) === 116) return false;
  if (quoteRowSourceNumber(row) === 1356) return false;
  if (quoteRowSourceNumber(row) === 1363) return false;
  const itemText = String(row?.item || "").trim().toLowerCase();
  const text = `${row?.item || ""} ${row?.rawText || ""}`.toLowerCase();
  if ([
    "install window infills to gables",
    "window infills",
    "additional height walls (window infills)",
    "fabricate entry door jamb",
    "install single entry door inc. jamb/furn",
    "install window architraves",
    "install exterior door and window architraves",
    "install skirting",
    "wall studs 70 x 35 mpg 12",
    "70 x 35 mpg 12",
    "plates and noggins 70 x 35 mpg 12",
    "tie down plates",
  ].includes(itemText)) return true;
  return [
    "title search",
    "titles search",
    "add for tile roof trusses",
    "porch/verandah roof & ceiling framework",
  ].some((item) => text.includes(item));
}

function isHiddenQuoteRow(row) {
  const itemText = String(row?.item || "").trim().toLowerCase();
  return row?.hiddenQuoteRow || itemText === "install exterior door architraves";
}

function quoteFeeType(row) {
  const text = `${row?.item || ""} ${row?.rawText || ""}`.toLowerCase();
  if (text.includes("qbsa registration")) return "qbsaRegistration";
  if (text.includes("q leave fees")) return "qLeaveFees";
  return "";
}

function isFrameMethodInactive(row, frameMethod) {
  const method = normalizeFrameMethod(frameMethod);
  const section = normalizedSectionName(row?.section);
  const text = `${row?.item || ""} ${row?.rawText || ""}`.toLowerCase();
  const prefabRow = section === "pre-fab wall frames" || text.includes("prefab") || text.includes("prefabricated");
  const stickFrameRow = section === "framing timber" || text.includes("construct stick frames") || text.includes("stick frame");
  if (method === "mixed") return false;
  if (method === "stick") {
    return prefabRow;
  }
  if (method === "prefab") {
    return stickFrameRow;
  }
  return false;
}

function normalizeFrameMethod(frameMethod) {
  const text = String(frameMethod || "").toLowerCase();
  if (text.includes("mixed")) return "mixed";
  if (text.includes("prefab") || text.includes("prefabricated")) return "prefab";
  return "stick";
}

function applyEditableFormulas(quantities, formulas, extraValues, customRows = []) {
  const values = { ...quantities, ...extraValues };
  Object.entries(V4_DEFAULT_FORMULAS).forEach(([key, defaultFormula]) => {
    refreshFormulaAliases(values, quantities);
    const formula = currentFormula(key, formulas[key], defaultFormula);
    const result = evaluateFormula(formula, { ...values, ...quantities });
    if (Number.isFinite(result)) {
      quantities[key] = round(Math.max(0, result));
      values[key] = quantities[key];
    }
  });
  customRows.forEach((row) => {
    refreshFormulaAliases(values, quantities);
    const formula = formulas[row.key] || "";
    const result = evaluateFormula(formula, { ...values, ...quantities });
    if (Number.isFinite(result)) {
      quantities[row.key] = round(Math.max(0, result));
      values[row.key] = quantities[row.key];
    }
  });
}

function refreshFormulaAliases(values, quantities) {
  const totalWallLm = number(quantities.totalInternalWallsLm) + number(quantities.totalExternalWallsLm);
  values.totalWallLm = totalWallLm;
  values.totalPlateLm = totalWallLm * 2;
  values.internalWallLm = number(quantities.totalInternalWallsLm);
  values.externalWallLm = number(quantities.totalExternalWallsLm);
  values.ceilingArea = number(quantities.ceilingAreaM2);
  values.secondlevelFloorAreaM2 = number(quantities.upperFloorAreaM2);
  values.secondLevelAreaM2 = number(quantities.upperFloorAreaM2);
  values.lowerBalconyAreaM2 = number(quantities.lowerBalconyAreaM2);
  values.groundBalconyAreaM2 = number(quantities.lowerBalconyAreaM2);
  values.groundLevelBalconyAreaM2 = number(quantities.lowerBalconyAreaM2);
  values.secondlevelBalconyAreaM2 = number(values.balconyAreaM2);
  values.secondLevelBalconyAreaM2 = number(values.balconyAreaM2);
  values.thirdlevelFloorAreaM2 = number(quantities.thirdFloorAreaM2);
  values.thirdLevelAreaM2 = number(quantities.thirdFloorAreaM2);
  values.thirdlevelBalconyAreaM2 = number(quantities.upperBalconyAreaM2);
  values.thirdLevelBalconyAreaM2 = number(quantities.upperBalconyAreaM2);
  values.totalBalconyAreaM2 = number(quantities.totalBalconyAreaM2);
}

function assignWallSystemAreas(quantities, levels) {
  const areaFor = (system) => round(levels
    .filter((level) => level.system === system)
    .reduce((total, level) => total + number(level.area), 0));
  quantities.brickVeneerAreaM2 = areaFor("Brick Veneer");
  quantities.renderedBrickVeneerAreaM2 = areaFor("Rendered Brick Veneer");
  quantities.faceBrickBrickVeneerAreaM2 = areaFor("Face Brick Brick Veneer");
  quantities.blockworkAreaM2 = areaFor("Blockwork");
  quantities.hebelAreaM2 = areaFor("Hebel");
  quantities.lightweightCladdingAreaM2 = areaFor("Lightweight Cladding");
  quantities.renderedCladdingAreaM2 = areaFor("Rendered Cladding");
  quantities.mixedWallSystemAreaM2 = areaFor("Mixed");
  quantities.brickworkAreaM2 = round(quantities.brickVeneerAreaM2 + quantities.renderedBrickVeneerAreaM2 + quantities.faceBrickBrickVeneerAreaM2 + quantities.blockworkAreaM2);
  quantities.lowerBrickworkAreaM2 = isBrick(levels[0]?.system) ? number(levels[0]?.area) : 0;
  quantities.upperCladdingAreaM2 = isCladding(levels[1]?.system) ? number(levels[1]?.area) : 0;
  quantities.thirdCladdingAreaM2 = isCladding(levels[2]?.system) ? number(levels[2]?.area) : 0;
  quantities.externalCladdingAreaM2 = round(
    quantities.hebelAreaM2 +
    quantities.lightweightCladdingAreaM2 +
    quantities.renderedCladdingAreaM2 +
    quantities.mixedWallSystemAreaM2
  );
}

function currentFormula(key, savedFormula, defaultFormula) {
  const formula = String(savedFormula || "").trim();
  if (TOTAL_WALL_LENGTH_RESULT_KEYS.has(key) || FRAMED_WALL_LENGTH_RESULT_KEYS.has(key) || CORRECTED_DEFAULT_FORMULA_KEYS.has(key)) {
    return defaultFormula;
  }
  if (defaultFormula && formula === key) {
    return defaultFormula;
  }
  if (defaultFormula && /\bC\d+\b/i.test(formula)) {
    return defaultFormula;
  }
  if (defaultFormula && /![A-Z]+\d+/i.test(formula)) {
    return defaultFormula;
  }
  if (key === "plasterboardWallM2" && (
    formula === "(totalInternalWallsLm * 2 * lowerCeilingHeight) + (totalExternalWallsLm * lowerCeilingHeight) + ceilingAreaM2"
  )) {
    return defaultFormula;
  }
  if (key === "studsEach" && (
    formula === "(totalWallLm / 0.45) * 1.15" ||
    formula === "(totalInternalWallsLm + totalExternalWallsLm) / 0.45 * 1.15"
  )) {
    return defaultFormula;
  }
  if (key === "wallPlatesLm" && (
    formula === "(totalPlateLm / 5.4) * 1.2" ||
    formula === "(totalInternalWallsLm + totalExternalWallsLm) * 2"
  )) {
    return defaultFormula;
  }
  if (key === "corniceLm" && formula === "totalInternalWallsLm + totalExternalWallsLm") {
    return defaultFormula;
  }
  if (key === "skirtingLm" && formula === "totalInternalWallsLm + totalExternalWallsLm") {
    return defaultFormula;
  }
  if (key === "lowerSkirtingLm" && (
    formula === "lowerInternalWallsLm + lowerExternalWallsLm" ||
    formula === "(lowerInternalWallsLm * 2) + lowerExternalWallsLm"
  )) {
    return defaultFormula;
  }
  if (key === "upperSkirtingLm" && (
    formula === "upperInternalWallsLm + upperExternalWallsLm" ||
    formula === "(upperInternalWallsLm * 2) + upperExternalWallsLm"
  )) {
    return defaultFormula;
  }
  if (key === "thirdSkirtingLm" && (
    formula === "thirdInternalWallsLm + thirdExternalWallsLm" ||
    formula === "(thirdInternalWallsLm * 2) + thirdExternalWallsLm"
  )) {
    return defaultFormula;
  }
  if (key === "skirtingLengthsEach" && formula === "(lowerSkirtingLm + upperSkirtingLm + thirdSkirtingLm) * 1.15 / 5.4") {
    return defaultFormula;
  }
  if (key === "totalExternalWallsLm" && formula === "lowerExternalWallsLm + upperExternalWallsLm") {
    return defaultFormula;
  }
  if (key === "totalInternalWallsLm" && formula === "lowerInternalWallsLm + upperInternalWallsLm") {
    return defaultFormula;
  }
  if (key === "netExternalWallAreaM2" && formula === "lowerExternalWallAreaM2 + upperExternalWallAreaM2 - windowDoorDeductionsM2") {
    return defaultFormula;
  }
  if (key === "upperExternalWallAreaM2" && (
    formula.includes("+ 0.3") ||
    formula === "upperExternalWallsLm * upperCeilingHeight"
  )) {
    return defaultFormula;
  }
  if (key === "thirdExternalWallAreaM2" && (
    formula.includes("+ 0.3") ||
    formula === "thirdExternalWallsLm * thirdCeilingHeight"
  )) {
    return defaultFormula;
  }
  if (key === "upperBulkExternalWallAreaM2" && formula.includes("+ 0.3")) {
    return defaultFormula;
  }
  if (key === "thirdBulkExternalWallAreaM2" && formula.includes("+ 0.3")) {
    return defaultFormula;
  }
  if (key === "ceilingAreaM2" && (
    formula === "lowerFloorAreaM2 + upperFloorAreaM2" ||
    formula === "lowerFloorAreaM2 + upperFloorAreaM2 + thirdFloorAreaM2"
  )) {
    return defaultFormula;
  }
  return formula || defaultFormula;
}

const TOTAL_WALL_LENGTH_RESULT_KEYS = new Set([
  "totalExternal70mmWallsLm",
  "totalExternal90mmWallsLm",
  "totalInternal70mmWallsLm",
  "totalInternal90mmWallsLm",
  "total70mmWallsLm",
  "total90mmWallsLm",
]);

const FRAMED_WALL_LENGTH_RESULT_KEYS = new Set([
  "externalFramedWall70mmLm",
  "externalFramedWall90mmLm",
  "internalFramedWall70mmLm",
  "internalFramedWall90mmLm",
]);

const CORRECTED_DEFAULT_FORMULA_KEYS = new Set([
  "lowerSlabAreaM2",
  "secondLevelFloorAreaM2",
  "thirdLevelFloorAreaM2",
  "slabFloorAreaM2",
  "totalExternal70mmWallsLm",
  "totalExternal90mmWallsLm",
  "totalInternal70mmWallsLm",
  "totalInternal90mmWallsLm",
  "lowerExternalWallAreaM2",
  "upperExternalWallAreaM2",
  "thirdExternalWallAreaM2",
  "totalExternalWallAreaM2",
  "lowerWindowDoorDeductionsM2",
  "upperWindowDoorDeductionsM2",
  "thirdWindowDoorDeductionsM2",
  "lowerNetExternalWallAreaM2",
  "upperNetExternalWallAreaM2",
  "thirdNetExternalWallAreaM2",
  "netExternalWallAreaM2",
  "lowerExternalPlasterboardWallM2",
  "lowerInternalPlasterboardWallM2",
  "upperExternalPlasterboardWallM2",
  "upperInternalPlasterboardWallM2",
  "thirdExternalPlasterboardWallM2",
  "thirdInternalPlasterboardWallM2",
  "studs90mmEach",
  "wallPlatesNoggins90mmExternalWallsLm",
  "wallPlatesNoggins90mmInternalWallsLm",
  "lowerWallPlatesNoggins70mmExternalLm",
  "lowerWallPlatesNoggins70mmInternalLm",
  "upperWallPlatesNoggins70mmExternalLm",
  "upperWallPlatesNoggins70mmInternalLm",
  "thirdWallPlatesNoggins70mmExternalLm",
  "thirdWallPlatesNoggins70mmInternalLm",
  "lowerWallPlatesNoggins90mmExternalLm",
  "lowerWallPlatesNoggins90mmInternalLm",
  "upperWallPlatesNoggins90mmExternalLm",
  "upperWallPlatesNoggins90mmInternalLm",
  "thirdWallPlatesNoggins90mmExternalLm",
  "thirdWallPlatesNoggins90mmInternalLm",
  "totalPlatesNogginsMaterial70mmLm",
  "totalPlatesNogginsMaterial90mmLm",
  "lowerStudMaterial70mmExternalLm",
  "lowerStudMaterial70mmInternalLm",
  "upperStudMaterial70mmExternalLm",
  "upperStudMaterial70mmInternalLm",
  "thirdStudMaterial70mmExternalLm",
  "thirdStudMaterial70mmInternalLm",
  "lowerStudMaterial90mmExternalLm",
  "lowerStudMaterial90mmInternalLm",
  "upperStudMaterial90mmExternalLm",
  "upperStudMaterial90mmInternalLm",
  "thirdStudMaterial90mmExternalLm",
  "thirdStudMaterial90mmInternalLm",
  "total70mmStudMaterialLm",
  "lowerStudMaterial90mmLm",
  "upperStudMaterial90mmLm",
  "thirdStudMaterial90mmLm",
  "total90mmStudMaterialLm",
  "total90mmTimberFramingLm",
  "total90mmTimberLengthsEach",
  "lowerPlasterboardWallM2",
  "upperPlasterboardWallM2",
  "thirdPlasterboardWallM2",
  "plasterboardWallM2",
  "architraveLm",
  "architraveLengthsEach",
  "lowerSkirtingLm",
  "upperSkirtingLm",
  "thirdSkirtingLm",
  "skirtingLm",
]);

function evaluateFormula(formula, values) {
  const expression = internalFormulaAliases(formula);
  if (!expression || !/^[A-Za-z0-9_+\-*/().\s]+$/.test(expression)) return NaN;
  const names = Object.keys(values).filter((name) => expression.includes(name));
  const args = names.map((name) => Number(values[name]) || 0);
  const jsExpression = expression
    .replace(/\bcos\s*\(/g, "cosDegrees(")
    .replace(/\bceil\s*\(/g, "Math.ceil(");
  try {
    return Function(...names, "cosDegrees", `"use strict"; return (${jsExpression});`)(...args, cosDegrees);
  } catch {
    return NaN;
  }
}

function internalFormulaAliases(formula) {
  let expression = String(formula || "").trim();
  Object.entries(USER_FORMULA_ALIASES)
    .sort(([a], [b]) => b.length - a.length)
    .forEach(([alias, key]) => {
      expression = expression.replace(new RegExp(`\\b${alias}\\b`, "g"), key);
    });
  return expression;
}

const USER_FORMULA_ALIASES = {
  GroundLevelFloorAreaM2: "lowerFloorAreaM2",
  GroundLevelGarageAreaM2: "lowerGarageAreaM2",
  GroundLevelAlfrescoAreaM2: "lowerAlfrescoAreaM2",
  GroundLevelPorchAreaM2: "lowerPorchAreaM2",
  GroundLevelOtherAreaM2: "lowerOtherAreaM2",
  GroundLevelBalconyAreaM2: "lowerBalconyAreaM2",
  GroundLevelSlabAreaM2: "lowerSlabAreaM2",
  SecondLevelFloorAreaM2: "upperFloorAreaM2",
  SecondLevelGarageAreaM2: "upperGarageAreaM2",
  SecondLevelAlfrescoAreaM2: "upperAlfrescoAreaM2",
  SecondLevelPorchAreaM2: "upperPorchAreaM2",
  SecondLevelOtherAreaM2: "upperOtherAreaM2",
  SecondLevelBalconyAreaM2: "balconyAreaM2",
  SecondLevelFloorAreaTotalM2: "secondLevelFloorAreaM2",
  ThirdLevelFloorAreaM2: "thirdFloorAreaM2",
  ThirdLevelGarageAreaM2: "thirdGarageAreaM2",
  ThirdLevelAlfrescoAreaM2: "thirdAlfrescoAreaM2",
  ThirdLevelPorchAreaM2: "thirdPorchAreaM2",
  ThirdLevelOtherAreaM2: "0",
  ThirdLevelBalconyAreaM2: "upperBalconyAreaM2",
  ThirdLevelFloorAreaTotalM2: "thirdLevelFloorAreaM2",
  TotalSlabFloorAreaM2: "slabFloorAreaM2",
  TotalBalconyAreaM2: "totalBalconyAreaM2",
  GroundLevelCeilingHeight: "lowerCeilingHeight",
  GroundFloorCeilingHeight: "lowerCeilingHeight",
  SecondLevelCeilingHeight: "upperCeilingHeight",
  SecondFloorCeilingHeight: "upperCeilingHeight",
  ThirdLevelCeilingHeight: "thirdCeilingHeight",
  ThirdFloorCeilingHeight: "thirdCeilingHeight",
  SecondLevelFloorDepthMm: "upperFloorDepthMm",
  ThirdLevelFloorDepthMm: "thirdFloorDepthMm",
  GroundLevelExternalWallsLm: "lowerExternalWallsLm",
  SecondLevelExternalWallsLm: "upperExternalWallsLm",
  ThirdLevelExternalWallsLm: "thirdExternalWallsLm",
  GroundLevelInternalWallsLm: "lowerInternalWallsLm",
  SecondLevelInternalWallsLm: "upperInternalWallsLm",
  ThirdLevelInternalWallsLm: "thirdInternalWallsLm",
  GroundLevelExternal90mmWallsLm: "lowerExternal90mmWallsLm",
  SecondLevelExternal90mmWallsLm: "upperExternal90mmWallsLm",
  ThirdLevelExternal90mmWallsLm: "thirdExternal90mmWallsLm",
  GroundLevelExternal70mmWallsLm: "lowerExternal70mmWallsLm",
  SecondLevelExternal70mmWallsLm: "upperExternal70mmWallsLm",
  ThirdLevelExternal70mmWallsLm: "thirdExternal70mmWallsLm",
  GroundLevelInternal90mmWallsLm: "lowerInternal90mmWallsLm",
  SecondLevelInternal90mmWallsLm: "upperInternal90mmWallsLm",
  ThirdLevelInternal90mmWallsLm: "thirdInternal90mmWallsLm",
  GroundLevelInternal70mmWallsLm: "lowerInternal70mmWallsLm",
  SecondLevelInternal70mmWallsLm: "upperInternal70mmWallsLm",
  ThirdLevelInternal70mmWallsLm: "thirdInternal70mmWallsLm",
  GroundFloorExternal70mmWallsLm: "lowerExternal70mmWallsLm",
  SecondFloorExternal70mmWallsLm: "upperExternal70mmWallsLm",
  ThirdFloorExternal70mmWallsLm: "thirdExternal70mmWallsLm",
  GroundFloorInternal70mmWallsLm: "lowerInternal70mmWallsLm",
  SecondFloorInternal70mmWallsLm: "upperInternal70mmWallsLm",
  ThirdFloorInternal70mmWallsLm: "thirdInternal70mmWallsLm",
  GroundFloorExternal90mmWallsLm: "lowerExternal90mmWallsLm",
  SecondFloorExternal90mmWallsLm: "upperExternal90mmWallsLm",
  ThirdFloorExternal90mmWallsLm: "thirdExternal90mmWallsLm",
  GroundFloorInternal90mmWallsLm: "lowerInternal90mmWallsLm",
  SecondFloorInternal90mmWallsLm: "upperInternal90mmWallsLm",
  ThirdFloorInternal90mmWallsLm: "thirdInternal90mmWallsLm",
  GroundLevelExternalWallAreaM2: "lowerExternalWallAreaM2",
  SecondLevelExternalWallAreaM2: "upperExternalWallAreaM2",
  ThirdLevelExternalWallAreaM2: "thirdExternalWallAreaM2",
  GroundLevelWindowDoorAreaM2: "lowerWindowDoorAreaM2",
  SecondLevelWindowDoorAreaM2: "upperWindowDoorAreaM2",
  ThirdLevelWindowDoorAreaM2: "thirdWindowDoorAreaM2",
  GroundLevelExteriorAreaM2: "lowerNetExternalWallAreaM2",
  SecondLevelExteriorAreaM2: "upperNetExternalWallAreaM2",
  ThirdLevelExteriorAreaM2: "thirdNetExternalWallAreaM2",
  GroundLevelExternal90mmFramedWallLm: "lowerExternal90mmFramedWallLm",
  SecondLevelExternal90mmFramedWallLm: "upperExternal90mmFramedWallLm",
  ThirdLevelExternal90mmFramedWallLm: "thirdExternal90mmFramedWallLm",
  GroundLevelInternal90mmFramedWallLm: "lowerInternal90mmFramedWallLm",
  SecondLevelInternal90mmFramedWallLm: "upperInternal90mmFramedWallLm",
  ThirdLevelInternal90mmFramedWallLm: "thirdInternal90mmFramedWallLm",
  GroundLevelExternal70mmFramedWallLm: "lowerExternal70mmFramedWallLm",
  SecondLevelExternal70mmFramedWallLm: "upperExternal70mmFramedWallLm",
  ThirdLevelExternal70mmFramedWallLm: "thirdExternal70mmFramedWallLm",
  GroundLevelInternal70mmFramedWallLm: "lowerInternal70mmFramedWallLm",
  SecondLevelInternal70mmFramedWallLm: "upperInternal70mmFramedWallLm",
  ThirdLevelInternal70mmFramedWallLm: "thirdInternal70mmFramedWallLm",
  TotalExternal90mmFramedWallLm: "externalFramedWall90mmLm",
  TotalInternal90mmFramedWallLm: "internalFramedWall90mmLm",
  TotalExternal70mmFramedWallLm: "externalFramedWall70mmLm",
  TotalInternal70mmFramedWallLm: "internalFramedWall70mmLm",
  WallPlatesNoggins90mmExternalWallsLm: "wallPlatesNoggins90mmExternalWallsLm",
  WallPlatesNoggins90mmInternalWallsLm: "wallPlatesNoggins90mmInternalWallsLm",
  GroundFloorWallPlatesNoggins70mmExternalLm: "lowerWallPlatesNoggins70mmExternalLm",
  GroundFloorWallPlatesNoggins70mmInternalLm: "lowerWallPlatesNoggins70mmInternalLm",
  SecondFloorWallPlatesNoggins70mmExternalLm: "upperWallPlatesNoggins70mmExternalLm",
  SecondFloorWallPlatesNoggins70mmInternalLm: "upperWallPlatesNoggins70mmInternalLm",
  ThirdFloorWallPlatesNoggins70mmExternalLm: "thirdWallPlatesNoggins70mmExternalLm",
  ThirdFloorWallPlatesNoggins70mmInternalLm: "thirdWallPlatesNoggins70mmInternalLm",
  GroundFloorWallPlatesNoggins90mmExternalLm: "lowerWallPlatesNoggins90mmExternalLm",
  GroundFloorWallPlatesNoggins90mmInternalLm: "lowerWallPlatesNoggins90mmInternalLm",
  SecondFloorWallPlatesNoggins90mmExternalLm: "upperWallPlatesNoggins90mmExternalLm",
  SecondFloorWallPlatesNoggins90mmInternalLm: "upperWallPlatesNoggins90mmInternalLm",
  ThirdFloorWallPlatesNoggins90mmExternalLm: "thirdWallPlatesNoggins90mmExternalLm",
  ThirdFloorWallPlatesNoggins90mmInternalLm: "thirdWallPlatesNoggins90mmInternalLm",
  TotalPlatesNogginsMaterial70mmLm: "totalPlatesNogginsMaterial70mmLm",
  TotalPlatesNogginsMaterial90mmLm: "totalPlatesNogginsMaterial90mmLm",
  TotalStudMaterial90mmLm: "total90mmStudMaterialLm",
  TotalStudMaterial70mmLm: "total70mmStudMaterialLm",
  Total90mmStudMaterialLm: "total90mmStudMaterialLm",
  Total70mmStudMaterialLm: "total70mmStudMaterialLm",
  Total90mmTimberRequiredLm: "total90mmTimberFramingLm",
  Total70mmTimberRequiredLm: "total70mmTimberFramingLm",
  GroundFloorStudMaterial70mmExternalLm: "lowerStudMaterial70mmExternalLm",
  GroundFloorStudMaterial70mmInternalLm: "lowerStudMaterial70mmInternalLm",
  SecondFloorStudMaterial70mmExternalLm: "upperStudMaterial70mmExternalLm",
  SecondFloorStudMaterial70mmInternalLm: "upperStudMaterial70mmInternalLm",
  ThirdFloorStudMaterial70mmExternalLm: "thirdStudMaterial70mmExternalLm",
  ThirdFloorStudMaterial70mmInternalLm: "thirdStudMaterial70mmInternalLm",
  GroundFloorStudMaterial90mmExternalLm: "lowerStudMaterial90mmExternalLm",
  GroundFloorStudMaterial90mmInternalLm: "lowerStudMaterial90mmInternalLm",
  SecondFloorStudMaterial90mmExternalLm: "upperStudMaterial90mmExternalLm",
  SecondFloorStudMaterial90mmInternalLm: "upperStudMaterial90mmInternalLm",
  ThirdFloorStudMaterial90mmExternalLm: "thirdStudMaterial90mmExternalLm",
  ThirdFloorStudMaterial90mmInternalLm: "thirdStudMaterial90mmInternalLm",
  GroundLevelStudMaterial90mmLm: "lowerStudMaterial90mmLm",
  SecondLevelStudMaterial90mmLm: "upperStudMaterial90mmLm",
  ThirdLevelStudMaterial90mmLm: "thirdStudMaterial90mmLm",
  GroundLevelExternalPlasterboardWallM2: "lowerExternalPlasterboardWallM2",
  GroundLevelInternalPlasterboardWallM2: "lowerInternalPlasterboardWallM2",
  SecondLevelExternalPlasterboardWallM2: "upperExternalPlasterboardWallM2",
  SecondLevelInternalPlasterboardWallM2: "upperInternalPlasterboardWallM2",
  ThirdLevelExternalPlasterboardWallM2: "thirdExternalPlasterboardWallM2",
  ThirdLevelInternalPlasterboardWallM2: "thirdInternalPlasterboardWallM2",
  GroundLevelPlasterboardWallM2: "lowerPlasterboardWallM2",
  SecondLevelPlasterboardWallM2: "upperPlasterboardWallM2",
  ThirdLevelPlasterboardWallM2: "thirdPlasterboardWallM2",
  GroundLevelSkirtingLm: "lowerSkirtingLm",
  SecondLevelSkirtingLm: "upperSkirtingLm",
  ThirdLevelSkirtingLm: "thirdSkirtingLm",
};

function cosDegrees(degrees) {
  return Math.cos((Number(degrees) || 0) * Math.PI / 180);
}

function finalRate(row) {
  if (row.supplierQuote) return { rate: row.supplierQuote, source: "supplier quote" };
  if (row.manualRate) return { rate: row.manualRate, source: "manual" };
  if (row.sourceOfRate === "manual") return { rate: "", source: "manual" };
  if (row.generatedFlyscreenQuoteRow) return { rate: row.excelRate, source: row.sourceOfRate || "10% of selected windows/doors" };
  if (row.generatedWindowDoorQuoteRow && String(row.sourceOfRate || "").startsWith("approx ")) return { rate: row.excelRate, source: row.sourceOfRate };
  if (row.quotedSupplierRate) return { rate: row.quotedSupplierRate, source: "quoted supplier" };
  if (row.supplierCatalogueRate) return { rate: row.supplierCatalogueRate, source: "supplier catalogue" };
  if (row.excelRate) return { rate: row.excelRate, source: "workbook" };
  return { rate: "", source: "rate missing" };
}

function missingRequired(workbook) {
  return V4_REQUIRED_FIELDS.filter(([section, key]) => raw(workbook, section, key) === "" || number(raw(workbook, section, key)) === 0).map(([section, key]) => ({ section, key }));
}

function value(workbook, section, key) { return number(raw(workbook, section, key)); }
function floorCountToLevels(floorCount) {
  const text = String(floorCount || "").toLowerCase();
  if (text.includes("three") || text.includes("3")) return 3;
  if (text.includes("two") || text.includes("2") || text.includes("double")) return 2;
  return 1;
}
function manualOrDefault(workbook, section, key, fallback) {
  const manual = raw(workbook, section, key);
  return manual === "" || manual === undefined || manual === null ? fallback : number(manual);
}
function boardLengthsWithWaste(area, coverageM2) {
  const result = (number(area) / number(coverageM2)) * 1.1;
  return result > 0 ? Math.ceil(result) : "";
}
function raw(workbook, section, key) {
  const direct = workbook.data?.[section]?.rows?.[key]?.value;
  if (direct !== undefined) return direct === "" ? floorSystemDefaultValue(key) : direct;
  for (const dataSection of Object.values(workbook.data || {})) {
    const value = dataSection?.rows?.[key]?.value;
    if (value !== undefined) return value === "" ? floorSystemDefaultValue(key) : value;
  }
  return floorSystemDefaultValue(key);
}

function floorSystemDefaultValue(key) {
  const defaults = {
    lowerFloorDepthMm: "300mm Conventional Concrete Slab & Footings",
    upperFloorDepthMm: "319mm Timber Floor System (300mm I Beams & 19mm Sheet Flooring)",
    thirdFloorDepthMm: "319mm Timber Floor System (300mm I Beams & 19mm Sheet Flooring)",
  };
  return defaults[key] || "";
}
function isWindow(type) { return String(type || "").toLowerCase().includes("window"); }
function isDoor(type) { return String(type || "").toLowerCase().includes("door"); }
function doorArchitraveLength(row, quantity, fallback) {
  return isDoor(row?.type) && number(quantity) ? round(number(quantity) * 5.4 * 2) : number(fallback);
}
function normalizedWallSystem(system) {
  return String(system || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}
function isRenderedBrickVeneerSystem(system) {
  return normalizedWallSystem(system).includes("rendered brick");
}
function isFaceBrickVeneerSystem(system) {
  const text = normalizedWallSystem(system);
  return text.includes("face brick") || text === "facebrick";
}
function isBrick(system) {
  const text = normalizedWallSystem(system);
  return text.includes("brick veneer") || text.includes("face brick") || text.includes("rendered brick") || text === "blockwork";
}
function isCladding(system) { return ["Hebel", "Lightweight Cladding", "Timber/Steel Framed with lightweight cladding", "Timber/Steel Framed 150 Linea Board Cladding", "Timber/Steel Framed 180 Linea Board Cladding", "Timber/Steel Framed 405 Stria Cladding", "Rendered Cladding", "Mixed"].includes(system); }
function isLightweightCladdingSystem(system) { return String(system || "").toLowerCase().includes("lightweight cladding"); }
function isSuspendedTimberFloorSystem(system) {
  const text = normalizedFloorSystemText(system);
  return text.includes("timber floor") || text.includes("i beam") || text.includes("i-beam");
}
function isIBeam300FloorSystem(system) {
  const text = normalizedFloorSystemText(system);
  return text.includes("300mm i beam") || text.startsWith("319mm");
}
function isIBeam360FloorSystem(system) {
  const text = normalizedFloorSystemText(system);
  return text.includes("360mm i beam") || text.startsWith("379mm");
}
function floorSystemQuoteQuantities({ groundSystem, secondSystem, thirdSystem, groundArea, secondArea, thirdArea }) {
  const ground = number(groundArea);
  const second = number(secondArea);
  const third = number(thirdArea);
  return {
    quoteFloorSystemGround300M2: isSuspendedTimberFloorSystem(groundSystem) && !isIBeam360FloorSystem(groundSystem) ? ground : "",
    quoteFloorSystemGround360M2: isIBeam360FloorSystem(groundSystem) ? ground : "",
    quoteFloorSystemSecond300M2: isIBeam300FloorSystem(secondSystem) ? second : "",
    quoteFloorSystemSecond360M2: isIBeam360FloorSystem(secondSystem) ? second : "",
    quoteFloorSystemThird300M2: isIBeam300FloorSystem(thirdSystem) ? third : "",
    quoteFloorSystemThird360M2: isIBeam360FloorSystem(thirdSystem) ? third : "",
  };
}
function normalizedFloorSystemText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[-\u2010-\u2015]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function isLightweightInstallCladdingSystem(system) {
  const text = String(system || "").toLowerCase();
  return text.includes("lightweight cladding") || text.includes("linea") || text.includes("stria");
}
function isExternallyFramed(system) { return !system || system !== "Blockwork"; }
function framedExternalLm(system, lm) { return isExternallyFramed(system) ? number(lm) : 0; }
function framedInternalLm(system, lm) { return ["Timber/steel framed", "Plasterboard to framed walls", "Plasterboard to framed wall"].includes(system) ? number(lm) : 0; }
function thicknessWallLm(lm, thickness, target) {
  const normalizedThickness = String(thickness || "").replace(/\D/g, "") || "70";
  return normalizedThickness === target ? number(lm) : 0;
}
function studCountForWallLm(lm, multiplier) { return number(lm) ? (number(lm) / 0.45) * multiplier : 0; }
function liningNeedsPlasterboard(lining, wallSystem) {
  if (lining === "Raw blockwork") return false;
  if (lining === "Painted masonry/blockwork") return false;
  if (lining === "Battened and plasterboard lined") return true;
  if (lining === "Direct-stick plasterboard") return true;
  if (lining === "Plasterboard to framed wall") return isExternallyFramed(wallSystem);
  return isExternallyFramed(wallSystem);
}
function linedExternalArea(area, lining, wallSystem) {
  return liningNeedsPlasterboard(lining, wallSystem) ? number(area) : 0;
}
function plasteredInternalWallArea(lm, height, system) {
  if (system === "Raw blockwork" || system === "None") return 0;
  return number(lm) * number(height) * 2;
}
function battenLm(area, lining) {
  return lining === "Battened and plasterboard lined" ? number(area) / 0.45 : 0;
}
function countType(rows, type) { return rows.filter((row) => row.type === type).reduce((sum, row) => sum + number(row.quantity), 0); }
function countWindowLevel(rows, level) { return rows.filter((row) => row.level === level && isWindow(row.type)).reduce((sum, row) => sum + number(row.quantity), 0); }
function countInternalDoors(rows) {
  return rows
    .filter((row) => `${row.type || ""} ${row.section || ""} ${row.code || ""}`.toLowerCase().includes("internal door"))
    .reduce((sum, row) => sum + number(row.quantity), 0);
}
function sum(rows, key) { return rows.reduce((total, row) => total + number(row[key]), 0); }
function sumLevel(rows, level, key) { return rows.filter((row) => row.level === level).reduce((total, row) => total + number(row[key]), 0); }
function normalizeLevel(value) {
  const text = String(value || "").trim().toLowerCase();
  if (["1", "ground", "ground floor", "ground level", "lower", "lower level"].includes(text)) return "ground";
  if (["2", "second", "second level", "upper", "upper level"].includes(text)) return "second";
  if (["3", "third", "third level"].includes(text)) return "third";
  return text;
}
function number(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleaned = String(value ?? "").replace(/[$,\s]/g, "");
  const parsed = Number(cleaned);
  if (Number.isFinite(parsed)) return parsed;
  const match = cleaned.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}
function round(value) { return Math.round((Number(value) || 0) * 100) / 100; }
function roundTo(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round((Number(value) || 0) * factor) / factor;
}
function money(value) {
  return `$${Number(value || 0).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
