import { V4_REQUIRED_FIELDS } from "./estimateWorksheetV4Schema.js";

export const V4_DEFAULT_FORMULAS = {
  totalExternalWallsLm: "lowerExternalWallsLm + upperExternalWallsLm + thirdExternalWallsLm",
  totalInternalWallsLm: "lowerInternalWallsLm + upperInternalWallsLm + thirdInternalWallsLm",
  lowerExternalWallAreaM2: "lowerExternalWallsLm * lowerCeilingHeight",
  upperExternalWallAreaM2: "upperExternalWallsLm * (upperCeilingHeight + (upperFloorDepthMm / 1000))",
  thirdExternalWallAreaM2: "thirdExternalWallsLm * (thirdCeilingHeight + (thirdFloorDepthMm / 1000))",
  totalExternalWallAreaM2: "lowerExternalWallAreaM2 + upperExternalWallAreaM2 + thirdExternalWallAreaM2",
  lowerWindowDoorDeductionsM2: "lowerWindowDoorAreaM2",
  upperWindowDoorDeductionsM2: "upperWindowDoorAreaM2",
  thirdWindowDoorDeductionsM2: "thirdWindowDoorAreaM2",
  windowDoorDeductionsM2: "lowerWindowDoorDeductionsM2 + upperWindowDoorDeductionsM2 + thirdWindowDoorDeductionsM2",
  upperBulkExternalWallAreaM2: "upperExternalWallsLm * (upperCeilingHeight + (upperFloorDepthMm / 1000))",
  thirdBulkExternalWallAreaM2: "thirdExternalWallsLm * (thirdCeilingHeight + (thirdFloorDepthMm / 1000))",
  lowerNetExternalWallAreaM2: "lowerExternalWallAreaM2 - lowerWindowDoorDeductionsM2",
  upperNetExternalWallAreaM2: "upperExternalWallAreaM2 - upperWindowDoorDeductionsM2",
  thirdNetExternalWallAreaM2: "thirdExternalWallAreaM2 - thirdWindowDoorDeductionsM2",
  upperNetExteriorWallAfterOpeningsM2: "upperBulkExternalWallAreaM2 - upperWindowDoorDeductionsM2",
  thirdNetExteriorWallAfterOpeningsM2: "thirdBulkExternalWallAreaM2 - thirdWindowDoorDeductionsM2",
  netExternalWallAreaM2: "totalExternalWallAreaM2 - windowDoorDeductionsM2",
  lowerBrickworkAreaM2: "lowerExternalWallAreaM2",
  upperCladdingAreaM2: "upperExternalWallAreaM2",
  thirdCladdingAreaM2: "thirdExternalWallAreaM2",
  lowerSelectedWallSystemAreaM2: "lowerExternalWallAreaM2",
  upperSelectedWallSystemAreaM2: "upperExternalWallAreaM2",
  thirdSelectedWallSystemAreaM2: "thirdExternalWallAreaM2",
  lowerSlabAreaM2: "lowerFloorAreaM2 + lowerGarageAreaM2 + lowerAlfrescoAreaM2 + lowerPorchAreaM2 + lowerOtherAreaM2",
  secondLevelFloorAreaM2: "upperFloorAreaM2 + upperGarageAreaM2 + upperAlfrescoAreaM2 + upperPorchAreaM2 + upperOtherAreaM2 + balconyAreaM2",
  thirdLevelFloorAreaM2: "thirdFloorAreaM2 + thirdGarageAreaM2 + thirdAlfrescoAreaM2 + thirdPorchAreaM2 + upperBalconyAreaM2",
  slabFloorAreaM2: "lowerSlabAreaM2 + secondLevelFloorAreaM2 + thirdLevelFloorAreaM2",
  ceilingAreaM2: "lowerFloorAreaM2 + lowerGarageAreaM2 + lowerAlfrescoAreaM2 + lowerOtherAreaM2 + upperFloorAreaM2 + upperGarageAreaM2 + upperAlfrescoAreaM2 + upperOtherAreaM2 + balconyAreaM2 + thirdFloorAreaM2 + thirdGarageAreaM2 + thirdAlfrescoAreaM2 + upperBalconyAreaM2",
  lowerExternalPlasterboardWallM2: "lowerExternalWallsLm * lowerCeilingHeight",
  lowerInternalPlasterboardWallM2: "lowerInternalWallsLm * lowerCeilingHeight * 2",
  upperExternalPlasterboardWallM2: "upperExternalWallsLm * upperCeilingHeight",
  upperInternalPlasterboardWallM2: "upperInternalWallsLm * upperCeilingHeight * 2",
  thirdExternalPlasterboardWallM2: "thirdExternalWallsLm * thirdCeilingHeight",
  thirdInternalPlasterboardWallM2: "thirdInternalWallsLm * thirdCeilingHeight * 2",
  plasterboardWallM2: "lowerPlasterboardWallM2 + upperPlasterboardWallM2 + thirdPlasterboardWallM2",
  externalFramedWallLm: "externalFramedWallLm",
  internalFramedWallLm: "internalFramedWallLm",
  prefabricatedWallFrameLm: "prefabricatedWallFrameLm",
  wallBattensLm: "wallBattensLm",
  studsEach: "(stickFramedWallLm / 0.45) * 1.15",
  externalWallPlatesLm: "externalFramedWallLm * 4 * 1.2",
  internalWallPlatesLm: "internalFramedWallLm * 3 * 1.2",
  wallPlatesLm: "externalWallPlatesLm + internalWallPlatesLm",
  lowerStudMaterialLm: "lowerFramedWallLm * lowerCeilingHeight * 1.2",
  upperStudMaterialLm: "upperFramedWallLm * upperCeilingHeight * 1.2",
  thirdStudMaterialLm: "thirdFramedWallLm * thirdCeilingHeight * 1.2",
  total70mmStudMaterialLm: "lowerStudMaterial70mmExternalLm + lowerStudMaterial70mmInternalLm + upperStudMaterial70mmExternalLm + upperStudMaterial70mmInternalLm + thirdStudMaterial70mmExternalLm + thirdStudMaterial70mmInternalLm",
  total90mmStudMaterialLm: "lowerStudMaterial90mmExternalLm + lowerStudMaterial90mmInternalLm + upperStudMaterial90mmExternalLm + upperStudMaterial90mmInternalLm + thirdStudMaterial90mmExternalLm + thirdStudMaterial90mmInternalLm",
  totalPlatesNogginsMaterial70mmLm: "lowerWallPlatesNoggins70mmExternalLm + lowerWallPlatesNoggins70mmInternalLm + upperWallPlatesNoggins70mmExternalLm + upperWallPlatesNoggins70mmInternalLm + thirdWallPlatesNoggins70mmExternalLm + thirdWallPlatesNoggins70mmInternalLm",
  totalPlatesNogginsMaterial90mmLm: "lowerWallPlatesNoggins90mmExternalLm + lowerWallPlatesNoggins90mmInternalLm + upperWallPlatesNoggins90mmExternalLm + upperWallPlatesNoggins90mmInternalLm + thirdWallPlatesNoggins90mmExternalLm + thirdWallPlatesNoggins90mmInternalLm",
  totalTimberLengthsEach: "totalTimberFramingLm / 5.4",
  lowerPlasterboardWallM2: "lowerExternalPlasterboardWallM2 + lowerInternalPlasterboardWallM2",
  upperPlasterboardWallM2: "upperExternalPlasterboardWallM2 + upperInternalPlasterboardWallM2",
  thirdPlasterboardWallM2: "thirdExternalPlasterboardWallM2 + thirdInternalPlasterboardWallM2",
  skirtingLm: "lowerSkirtingLm + upperSkirtingLm + thirdSkirtingLm",
  lowerSkirtingLm: "((lowerInternalWallsLm * 2) + lowerExternalWallsLm) * 0.8",
  upperSkirtingLm: "((upperInternalWallsLm * 2) + upperExternalWallsLm) * 0.8",
  thirdSkirtingLm: "((thirdInternalWallsLm * 2) + thirdExternalWallsLm) * 0.8",
  skirtingLengthsEach: "(lowerSkirtingLm + upperSkirtingLm + thirdSkirtingLm) * 0.85 / 5.4",
  internalDoors: "internalDoorCount",
  architraveLm: "windowDoorArchitraveLm + manualInternalDoorArchitraveLm",
  architraveLengthsEach: "architraveLm / 5.4",
  corniceLm: "totalExternalWallsLm + (totalInternalWallsLm * 2)",
  revealLm: "windowDoorRevealLm",
  eavesAreaM2: "(lowerEavesLm + upperEavesLm + thirdEavesLm) * eavesWidthM",
  roofPlanAreaM2: "eavesAreaM2 + lowerRoofPlanAreaM2 + upperRoofPlanAreaM2 + thirdRoofPlanAreaM2",
  roofAreaM2: "roofPlanAreaM2 / cos(roofPitchDegrees)",
};

export function calculateEstimateWorksheetV4(workbook) {
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
  const balcony = v("areas", "balconyAreaM2");
  const upperBalcony = v("areas", "upperBalconyAreaM2");
  const eavesWidthM = v("roofSite", "eavesWidthM");
  const lowerEavesLm = v("roofSite", "lowerEavesLm");
  const upperEavesLm = v("roofSite", "upperEavesLm");
  const thirdEavesLm = v("roofSite", "thirdEavesLm");
  const lowerSlabAreaM2 = round(lowerFloor + garage + alfresco + porch + lowerOther);
  const secondLevelFloorAreaM2 = round(upperFloor + upperGarage + upperAlfresco + upperPorch + upperOther + balcony);
  const thirdLevelFloorAreaM2 = round(thirdFloor + thirdGarage + thirdAlfresco + thirdPorch + upperBalcony);
  const totalFloorAreaM2 = round(lowerSlabAreaM2 + secondLevelFloorAreaM2 + thirdLevelFloorAreaM2);
  const eavesAreaM2 = round((lowerEavesLm + upperEavesLm + thirdEavesLm) * eavesWidthM);
  const floorCount = raw(workbook, "projectSetup", "floorCount");
  const topLevelNumber = floorCount === "Three storey" ? 3 : floorCount === "Two storey" ? 2 : 1;
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
  const totalInternalWallsLm = round(lowerInt + upperInt + thirdInt);
  const lowerExternalFramedWallLm = framedExternalLm(lowerSystem, lowerExt);
  const upperExternalFramedWallLm = framedExternalLm(upperSystem, upperExt);
  const thirdExternalFramedWallLm = framedExternalLm(thirdSystem, thirdExt);
  const lowerInternalFramedWallLm = framedInternalLm(lowerInternalSystem, lowerInt);
  const upperInternalFramedWallLm = framedInternalLm(upperInternalSystem, upperInt);
  const thirdInternalFramedWallLm = framedInternalLm(thirdInternalSystem, thirdInt);
  const lowerExternalThickness = raw(workbook, "walls", "lowerWallThicknessMm");
  const upperExternalThickness = raw(workbook, "walls", "upperWallThicknessMm");
  const thirdExternalThickness = raw(workbook, "walls", "thirdWallThicknessMm");
  const lowerInternalThickness = raw(workbook, "walls", "lowerInternalWallThicknessMm");
  const upperInternalThickness = raw(workbook, "walls", "upperInternalWallThicknessMm");
  const thirdInternalThickness = raw(workbook, "walls", "thirdInternalWallThicknessMm");
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
  const upperExternalPlasterboardWallM2 = round(upperExt * (upperHeight || 0));
  const thirdExternalPlasterboardWallM2 = round(thirdExt * (thirdHeight || 0));
  const lowerInternalPlasterboardWallM2 = round(lowerInt * lowerHeight * 2);
  const upperInternalPlasterboardWallM2 = round(upperInt * (upperHeight || 0) * 2);
  const thirdInternalPlasterboardWallM2 = round(thirdInt * (thirdHeight || 0) * 2);
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
    upperExternalWallsLm: upperExt,
    thirdExternalWallsLm: thirdExt,
    totalExternalWallsLm: round(lowerExt + upperExt + thirdExt),
    lowerInternalWallsLm: lowerInt,
    upperInternalWallsLm: upperInt,
    thirdInternalWallsLm: thirdInt,
    totalInternalWallsLm,
    lowerFloorDepthMm,
    upperFloorDepthMm,
    thirdFloorDepthMm,
    lowerExternalWallAreaM2,
    upperExternalWallAreaM2,
    thirdExternalWallAreaM2,
    totalExternalWallAreaM2,
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
    ceilingAreaM2,
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
    plasterboardWallM2: round(internalPlasterboardWallM2 + externalPlasterboardWallM2),
    wallBattensLm,
    studsEach: 0,
    wallPlatesLm: 0,
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
    lowerSkirtingLm: round(((lowerInt * 2) + lowerExt) * 0.8),
    upperSkirtingLm: round(((upperInt * 2) + upperExt) * 0.8),
    thirdSkirtingLm: round(((thirdInt * 2) + thirdExt) * 0.8),
    skirtingLm: round((lowerInt * 2) + lowerExt + (upperInt * 2) + upperExt + (thirdInt * 2) + thirdExt),
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
    eavesAreaM2,
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
    garageDoorCount: wd.totals.garageDoorCount,
    entryDoorCount: wd.totals.entryDoorCount,
    paintM2: round(netExternalWallAreaM2 + lowerFloor + upperFloor),
  };

  applyEditableFormulas(quantities, workbook.formulas || {}, {
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
    balconyAreaM2: balcony,
    secondlevelBalconyAreaM2: balcony,
    secondLevelBalconyAreaM2: balcony,
    upperBalconyAreaM2: upperBalcony,
    thirdlevelBalconyAreaM2: upperBalcony,
    thirdLevelBalconyAreaM2: upperBalcony,
    lowerSlabAreaM2,
    secondLevelFloorAreaM2,
    thirdLevelFloorAreaM2,
    eavesWidthM,
    lowerEavesLm,
    upperEavesLm,
    thirdEavesLm,
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
    windowDoorArchitraveLm: wd.totals.architraveLength,
    windowDoorRevealLm: wd.totals.revealLength,
  });

  if (!isBrick(lowerSystem)) quantities.lowerBrickworkAreaM2 = 0;
  if (!isCladding(upperSystem)) quantities.upperCladdingAreaM2 = 0;
  if (!isCladding(thirdSystem)) quantities.thirdCladdingAreaM2 = 0;
  assignWallSystemAreas(quantities, [
    { system: lowerSystem, area: lowerExternalWallAreaM2 },
    { system: upperSystem, area: upperExternalWallAreaM2 },
    { system: thirdSystem, area: thirdExternalWallAreaM2 },
  ]);

  const quotation = calculateQuotation(workbook.quotation, quantities, { frameMethod });
  const subtotalBeforeMargin = round(Object.values(quotation).reduce((sum, section) => sum + section.subtotal, 0));
  const salesCommissionPercent = v("roofSite", "salesCommissionPercent") || 0;
  const overheadsPercent = v("roofSite", "overheadsPercent") || 0;
  const marginPercent = v("roofSite", "marginPercent") || 0;
  const profitPercent = v("roofSite", "profitPercent") || 0;
  const salesCommissionAmount = round(subtotalBeforeMargin * salesCommissionPercent / 100);
  const overheadsAmount = round(subtotalBeforeMargin * overheadsPercent / 100);
  const marginAmount = round(subtotalBeforeMargin * marginPercent / 100);
  const profitAmount = round(subtotalBeforeMargin * profitPercent / 100);
  const totalAllowances = round(salesCommissionAmount + overheadsAmount + marginAmount + profitAmount);
  const subtotalWithMargin = round(subtotalBeforeMargin + totalAllowances);
  const gst = round(subtotalWithMargin * 0.1);
  const finalQuoteTotal = round(subtotalWithMargin + gst);

  return {
    windowsDoors: wd,
    quantities,
    quotation,
    missingRequired: missingRequired(workbook),
    summary: {
      subtotalBeforeMargin,
      salesCommissionPercent,
      salesCommissionAmount,
      overheadsPercent,
      overheadsAmount,
      marginPercent,
      marginAmount,
      profitPercent,
      profitAmount,
      totalAllowances,
      gst,
      finalQuoteTotal,
    },
  };
}

export function calculateWindowsDoors(rows = []) {
  const calculatedRows = rows.map((row) => {
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
    const rate = number(row.supplierQuote || row.rate);
    const cost = rate && quantity ? round(rate * quantity) : number(row.cost);
    return { ...row, level: normalizeLevel(row.level), quantity, width, height, area, totalArea, sillLength, headLength, jambLength, revealLength, architraveLength, cost };
  });
  const groundFloorArea = round(sumLevel(calculatedRows, "ground", "totalArea"));
  const secondLevelArea = round(sumLevel(calculatedRows, "second", "totalArea"));
  const thirdLevelArea = round(sumLevel(calculatedRows, "third", "totalArea"));
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
      garageDoorCount: countType(calculatedRows, "Garage Door"),
      entryDoorCount: countType(calculatedRows, "Entry Door"),
      internalDoorCount: countInternalDoors(calculatedRows),
    },
  };
}

function calculateQuotation(quotation, quantities, options = {}) {
  return Object.fromEntries(Object.entries(quotation).map(([sectionName, section]) => {
    const rows = section.rows.map((row) => {
      const qty = number(row.quantity || quantities[row.quantityKey]);
      const notes = quoteNotesWithImportedData(row.notes, Boolean(!row.quantity && row.quantityKey && qty));
      const rateInfo = finalRate(row);
      const excluded = row.lineType === "Excluded item";
      const waitingOnQuote = (row.lineType === "Quote required" || row.quoteRequired) && rateInfo.rate === "";
      const frameInactive = isFrameMethodInactive(row, options.frameMethod);
      const inactive = row.active === false || excluded || waitingOnQuote || frameInactive;
      const importedCost = number(row.importedCost);
      const calculatedCost = !inactive && qty && rateInfo.rate !== "" ? round(qty * Number(rateInfo.rate)) : 0;
      const cost = row.importedWorkbookRow && row.manualRate === "" && row.supplierQuote === ""
        ? (inactive ? 0 : importedCost)
        : calculatedCost;
      return { ...row, qty: frameInactive ? 0 : qty, finalRateUsed: rateInfo.rate, sourceOfRate: rateInfo.source, cost, notes, inactiveReason: frameInactive ? `Hidden by ${options.frameMethod}` : "" };
    });
    const calculatedSubtotal = round(rows.reduce((sum, row) => sum + row.cost, 0));
    const workbookSubtotal = number(section.workbookSummaryValue);
    return [sectionName, { ...section, rows, subtotal: workbookSubtotal || calculatedSubtotal }];
  }));
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

function normalizedSectionName(sectionName) {
  return String(sectionName || "")
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/\s*\(\d+\)\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function applyEditableFormulas(quantities, formulas, extraValues) {
  const values = { ...quantities, ...extraValues };
  Object.entries(V4_DEFAULT_FORMULAS).forEach(([key, defaultFormula]) => {
    const formula = currentFormula(key, formulas[key], defaultFormula);
    const result = evaluateFormula(formula, { ...values, ...quantities });
    if (Number.isFinite(result)) {
      quantities[key] = round(Math.max(0, result));
      values[key] = quantities[key];
    }
  });
}

function evaluateFormula(formula, values) {
  const expression = String(formula || "").trim();
  if (!expression || !/^[A-Za-z0-9_+\-*/().\s]+$/.test(expression)) return NaN;
  const names = Object.keys(values).filter((name) => expression.includes(name));
  const args = names.map((name) => Number(values[name]) || 0);
  const jsExpression = expression.replace(/\bcos\s*\(/g, "cosDegrees(");
  try {
    return Function(...names, "cosDegrees", `"use strict"; return (${jsExpression});`)(...args, cosDegrees);
  } catch {
    return NaN;
  }
}

function currentFormula(key, savedFormula, defaultFormula) {
  const formula = String(savedFormula || "").trim();
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

function cosDegrees(degrees) {
  return Math.cos((Number(degrees) || 0) * Math.PI / 180);
}

function assignWallSystemAreas(quantities, levels) {
  const areaFor = (system) => round(levels
    .filter((level) => level.system === system)
    .reduce((total, level) => total + number(level.area), 0));
  quantities.brickVeneerAreaM2 = areaFor("Brick Veneer");
  quantities.blockworkAreaM2 = areaFor("Blockwork");
  quantities.hebelAreaM2 = areaFor("Hebel");
  quantities.lightweightCladdingAreaM2 = areaFor("Lightweight Cladding");
  quantities.renderedCladdingAreaM2 = areaFor("Rendered Cladding");
  quantities.mixedWallSystemAreaM2 = areaFor("Mixed");
  quantities.brickworkAreaM2 = round(quantities.brickVeneerAreaM2 + quantities.blockworkAreaM2);
  quantities.lowerBrickworkAreaM2 = ["Brick Veneer", "Blockwork"].includes(levels[0]?.system) ? number(levels[0]?.area) : 0;
  quantities.upperCladdingAreaM2 = isCladding(levels[1]?.system) ? number(levels[1]?.area) : 0;
  quantities.thirdCladdingAreaM2 = isCladding(levels[2]?.system) ? number(levels[2]?.area) : 0;
  quantities.externalCladdingAreaM2 = round(
    quantities.hebelAreaM2 +
    quantities.lightweightCladdingAreaM2 +
    quantities.renderedCladdingAreaM2 +
    quantities.mixedWallSystemAreaM2
  );
}

function finalRate(row) {
  if (row.supplierQuote) return { rate: row.supplierQuote, source: "supplier quote" };
  if (row.manualRate) return { rate: row.manualRate, source: "manual" };
  if (row.quotedSupplierRate) return { rate: row.quotedSupplierRate, source: "quoted supplier" };
  if (row.supplierCatalogueRate) return { rate: row.supplierCatalogueRate, source: "supplier catalogue" };
  if (row.excelRate) return { rate: row.excelRate, source: "workbook" };
  return { rate: "", source: "rate missing" };
}

function quoteNotesWithImportedData(notes, imported) {
  const text = String(notes || "").trim();
  if (!imported) return text;
  if (!text) return "IMPORTED DATA";
  return text.toUpperCase().includes("IMPORTED DATA") ? text : `${text} | IMPORTED DATA`;
}

function missingRequired(workbook) {
  return V4_REQUIRED_FIELDS.filter(([section, key]) => raw(workbook, section, key) === "" || number(raw(workbook, section, key)) === 0).map(([section, key]) => ({ section, key }));
}

function value(workbook, section, key) { return number(raw(workbook, section, key)); }
function manualOrDefault(workbook, section, key, fallback) {
  const manual = raw(workbook, section, key);
  return manual === "" || manual === undefined || manual === null ? fallback : number(manual);
}
function raw(workbook, section, key) {
  const direct = workbook.data?.[section]?.rows?.[key]?.value;
  if (direct !== undefined) return direct;
  for (const dataSection of Object.values(workbook.data || {})) {
    const value = dataSection?.rows?.[key]?.value;
    if (value !== undefined) return value;
  }
  return "";
}
function isWindow(type) { return String(type || "").toLowerCase().includes("window"); }
function isDoor(type) { return String(type || "").toLowerCase().includes("door"); }
function doorArchitraveLength(row, quantity, fallback) {
  return isDoor(row?.type) && number(quantity) ? round(number(quantity) * 5.4 * 2) : number(fallback);
}
function isBrick(system) { return ["Brick Veneer", "Blockwork"].includes(system); }
function isCladding(system) { return ["Hebel", "Lightweight Cladding", "Timber/Steel Framed with lightweight cladding", "Rendered Cladding", "Mixed"].includes(system); }
function isExternallyFramed(system) { return system && system !== "Blockwork"; }
function framedExternalLm(system, lm) { return isExternallyFramed(system) ? number(lm) : 0; }
function framedInternalLm(system, lm) { return ["Timber/steel framed", "Plasterboard to framed walls", "Plasterboard to framed wall"].includes(system) ? number(lm) : 0; }
function thicknessWallLm(lm, thickness, target) {
  return String(thickness || "").replace(/\D/g, "") === target ? number(lm) : 0;
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
function countInternalDoors(rows) {
  return rows
    .filter((row) => `${row.type || ""} ${row.section || ""} ${row.code || ""}`.toLowerCase().includes("internal door"))
    .reduce((sum, row) => sum + number(row.quantity), 0);
}
function sum(rows, key) { return rows.reduce((total, row) => total + number(row[key]), 0); }
function sumLevel(rows, level, key) { return rows.filter((row) => row.level === level).reduce((total, row) => total + number(row[key]), 0); }
function normalizeLevel(value) {
  const text = String(value || "").trim().toLowerCase();
  if (["1", "ground", "ground floor", "lower", "lower level"].includes(text)) return "ground";
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
