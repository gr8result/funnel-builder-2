import { selectionVariation } from '../builders/selectionQuoteEngine.js';
import { brickOrderQuantities, EXTERIOR_WALL_SYSTEM_FIELD_KEYS, takeoffLevelWallHeightM } from './takeoffMaterialQuantities.js';
import { calculateWallLinings, wallLiningRowPolicy, wallLiningWorking, withWallLiningMappings } from './quotationWallLinings.js';
import { CLADDING_PLANK_PRODUCTS, calculateCladdingPlankQty, claddingPlankWorkingText } from './claddingPlankCalculation.js';
import { ARCHITRAVE_DEFAULTS } from "./architraveCutting.js";
import { resolveStairFlight, stairFlightsFromLevels } from "./stairGeometry.js";
import { CEILING_BATTEN_FORMULA, CEILING_BATTEN_QUANTITY_KEY, calculateCeilingBattens } from "./ceilingBattens.js";
import { SUBCONTRACTOR_QUOTE_DEDUCTIONS, V4_REQUIRED_FIELDS } from "./estimateWorksheetV4Schema.js";
import { windowDoorApproximateRate, windowDoorApproximateRateSource, withWindowDoorApproximateRate } from "./windowDoorApproximatePricing.js";
import { withDoorScheduleSelection } from "./humeEntryDoorPricing.js";
import { createCavitySliderCageSchedule, createCladdingProductWallSchedule, createInternalDoorSizeSchedule, createJobSetupWindowSchedule, createRobeSlidingDoorSchedule } from "../../components/construction-estimation/ai-plan-takeoff/takeoffSchedule.js";
import { quoteRowCost, resolveQuoteRowQuantity, sumQuoteRowCosts } from "./quoteRowCost.js";
import { quoteQuantityExplanation } from "./quoteQuantityFormula.js";
import { DOOR_TAKEOFF_KEYS, SUPERSEDED_NOTE, takeoffDoorQuotation, takeoffRowQuantityKey } from "./doorTakeoffQuotation.js";
import { windowPriceListTakeoffQuantities, windowPriceListFlyscreenQuantities, isWindowsSectionName, windowPriceListQuantityKey, withWindowScheduleUnpricedRows, reconcileWindowScheduleWithQuote } from "./windowsQuotePriceList.js";

const REMOVED_IMPORTED_QUOTE_SOURCE_ROWS = new Set([161, 162, 163, 30076, 30077, 30080, 1248, 1250, 1251, 1350, 1351]);
const REMOVED_QUOTE_ROW_IDS = new Set(["quote-161", "quote-162", "quote-30076", "quote-30077", "quote-30080"]);
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
  lowerSlabAreaM2: "GroundLevelFloorAreaM2 + GroundLevelGarageAreaM2 + GroundLevelAlfrescoAreaM2 + GroundLevelPorchAreaM2 + GroundLevelOtherAreaM2 + lowerPatioAreaM2",
  secondLevelFloorAreaM2: "SecondLevelFloorAreaM2 + SecondLevelGarageAreaM2 + SecondLevelAlfrescoAreaM2 + SecondLevelPorchAreaM2 + SecondLevelOtherAreaM2 + SecondLevelBalconyAreaM2 + upperPatioAreaM2",
  thirdLevelFloorAreaM2: "ThirdLevelFloorAreaM2 + ThirdLevelGarageAreaM2 + ThirdLevelAlfrescoAreaM2 + ThirdLevelPorchAreaM2 + ThirdLevelOtherAreaM2 + ThirdLevelBalconyAreaM2 + thirdPatioAreaM2",
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
  studs90mmEach: "((TotalExternal90mmFramedWallLm / 0.45) * 1.15) + (lowerInternal90mmStudsEach + upperInternal90mmStudsEach + thirdInternal90mmStudsEach)",
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
  lowerWallPlatesNoggins90mmInternalLm: "GroundFloorInternal90mmWallsLm * 3",
  upperWallPlatesNoggins90mmExternalLm: "SecondFloorExternal90mmWallsLm * 4",
  upperWallPlatesNoggins90mmInternalLm: "SecondFloorInternal90mmWallsLm * 3",
  thirdWallPlatesNoggins90mmExternalLm: "ThirdFloorExternal90mmWallsLm * 4",
  thirdWallPlatesNoggins90mmInternalLm: "ThirdFloorInternal90mmWallsLm * 3",
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
  lowerStudMaterial90mmInternalLm: "lowerInternal90mmStudsEach * GroundFloorCeilingHeight",
  upperStudMaterial90mmExternalLm: "(SecondFloorExternal90mmWallsLm / 0.45 * 1.15) * SecondFloorCeilingHeight",
  upperStudMaterial90mmInternalLm: "upperInternal90mmStudsEach * SecondFloorCeilingHeight",
  thirdStudMaterial90mmExternalLm: "(ThirdFloorExternal90mmWallsLm / 0.45 * 1.15) * ThirdFloorCeilingHeight",
  thirdStudMaterial90mmInternalLm: "thirdInternal90mmStudsEach * ThirdFloorCeilingHeight",
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
  lockupSingleHeightBricks: "(faceBrickOrderEach + renderedSingleOrderEach) / 1000",
  lockupTwinHeightBricks: "renderedTwinOrderEach / 1000",
  lockupBrickSillsLm: "brickVeneerSillsLm",
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
  totalPlasterboardM2: "GroundLevelPlasterboardWallM2 + SecondLevelPlasterboardWallM2 + ThirdLevelPlasterboardWallM2 + GroundFloorCeilingsM2 + SecondFloorCeilingsM2 + ThirdFloorCeilingsM2",
  skirtingLm: "GroundLevelSkirtingLm + SecondLevelSkirtingLm + ThirdLevelSkirtingLm",
  lowerSkirtingLm: "((GroundLevelInternalWallsLm * 2) + GroundLevelExternalWallsLm) * 0.8",
  upperSkirtingLm: "((SecondLevelInternalWallsLm * 2) + SecondLevelExternalWallsLm) * 0.8",
  thirdSkirtingLm: "((ThirdLevelInternalWallsLm * 2) + ThirdLevelExternalWallsLm) * 0.8",
  skirtingLengthsEach: "(lowerSkirtingLm + upperSkirtingLm + thirdSkirtingLm) * 0.85 / 5.4",
  internalDoors: "internalDoorCount",
  architraveLm: "architraveTotalLm",
  architraveLengthsEach: "architraveTotalLengthsQty",
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
  // The wall-system + frame-thickness breakdown (lowerExternal70mmWallsLm etc., populated directly
  // from AI Plan Takeoff) is now the source of truth for a level's external/internal wall length -
  // it wins whenever Takeoff has measured either thickness. lowerExternalWallsLm/lowerInternalWallsLm
  // stay as the manual-entry fallback for a job with no such measured breakdown yet, so nothing
  // regresses for a job that predates this import.
  const wallLmFromBreakdown = (prefix, type, fallbackKey) => {
    const seventy = raw(workbook, "inputDataSheet", `${prefix}${type}70mmWallsLm`);
    const ninety = raw(workbook, "inputDataSheet", `${prefix}${type}90mmWallsLm`);
    const measured = [seventy, ninety].some((entry) => entry !== "" && entry !== undefined && entry !== null);
    return measured ? round(number(seventy) + number(ninety)) : v("walls", fallbackKey);
  };
  const lowerExt = wallLmFromBreakdown("lower", "External", "lowerExternalWallsLm");
  const upperExt = wallLmFromBreakdown("upper", "External", "upperExternalWallsLm");
  const thirdExt = wallLmFromBreakdown("third", "External", "thirdExternalWallsLm");
  const lowerInt = wallLmFromBreakdown("lower", "Internal", "lowerInternalWallsLm");
  const upperInt = wallLmFromBreakdown("upper", "Internal", "upperInternalWallsLm");
  const thirdInt = wallLmFromBreakdown("third", "Internal", "thirdInternalWallsLm");
  const heightM = (value) => value > 20 ? value / 1000 : value;
  const lowerHeight = heightM(v("walls", "lowerCeilingHeight")) || 2.7;
  const upperHeight = heightM(v("walls", "upperCeilingHeight"));
  const thirdHeight = heightM(v("walls", "thirdCeilingHeight"));
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
  // Items 83/84/85: the canonical source for a level's external opening deduction is Window
  // Schedule's own per-level total (lowerExternalOpeningAreaM2 etc - the exact field
  // createJobSetupWindowSchedule's own level totals read from, see takeoffMaterialFields in
  // takeoffMaterialQuantities.js), imported here once Takeoff/Job Setup import has run. wd.totals
  // (the separate Windows & Doors sheet, keyed by hand with no connection to the Takeoff) stays the
  // fallback only for a job with no such canonical import yet, so nothing regresses for one that
  // predates it - but it must never be preferred over a real Takeoff-measured deduction that exists.
  const canonicalOpeningDeductionM2 = (prefix, fallback) => {
    const measured = raw(workbook, "inputDataSheet", `${prefix}ExternalOpeningAreaM2`);
    return measured !== "" && measured !== undefined && measured !== null ? number(measured) : number(fallback);
  };
  const lowerWindowDoorDeductionsM2 = canonicalOpeningDeductionM2("lower", wd.totals.groundFloorArea);
  const upperWindowDoorDeductionsM2 = canonicalOpeningDeductionM2("upper", wd.totals.secondLevelArea);
  const thirdWindowDoorDeductionsM2 = canonicalOpeningDeductionM2("third", wd.totals.thirdLevelArea);
  const windowDoorDeductionsM2 = round(lowerWindowDoorDeductionsM2 + upperWindowDoorDeductionsM2 + thirdWindowDoorDeductionsM2);
  const netExternalWallAreaM2 = round(Math.max(0, totalExternalWallAreaM2 - windowDoorDeductionsM2));
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
  const lowerSlabAreaM2 = round(lowerFloor + garage + alfresco + porch + lowerOther + v("inputDataSheet", "lowerPatioAreaM2"));
  const secondLevelFloorAreaM2 = round(upperFloor + upperGarage + upperAlfresco + upperPorch + upperOther + balcony + v("inputDataSheet", "upperPatioAreaM2"));
  const thirdLevelFloorAreaM2 = round(thirdFloor + thirdGarage + thirdAlfresco + thirdPorch + upperBalcony + v("inputDataSheet", "thirdPatioAreaM2"));
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
  // The Windows/Doors schedule wins when it has been filled in; otherwise fall back to the
  // internal doors counted by AI Plan Takeoff, then to a manually keyed count.
  const takeoffInternalDoors = v("inputDataSheet", "internalDoorOpeningsQty");
  const internalDoors = wd.totals.internalDoorCount || manualInternalDoors || takeoffInternalDoors;
  const manualInternalDoorArchitraveLm = wd.totals.internalDoorCount ? 0 : round((manualInternalDoors || takeoffInternalDoors) * 5.4 * 2);
  // Measured architraves: two 5.4m lengths per internal door (both faces), the perimeter of every
  // window, and head-plus-two-jambs on exterior, sliding and stacker doors, which are trimmed
  // on the inside face only and never along the sill.
  const takeoffInternalDoorArchitraveLm = round(takeoffInternalDoors * 5.4 * 2);
  // Architrave is cut from 5.4m lengths and offcuts are waste, so the number of lengths comes from
  // the takeoff's cutting calculation and must never be re-derived by dividing metres by 5.4.
  const architraveMeasuredLm = v("inputDataSheet", "architraveMeasuredLm");
  const architraveLengthsQty = v("inputDataSheet", "architraveLengthsQty");
  const windowArchitraveLm = v("inputDataSheet", "windowArchitraveLm");
  const architraveWasteLm = v("inputDataSheet", "architraveWasteLm");
  const externalDoorArchitraveLm = v("inputDataSheet", "externalDoorArchitraveLm");
  const slidingDoorArchitraveLm = v("inputDataSheet", "slidingDoorArchitraveLm");
  const takeoffArchitraveLm = architraveMeasuredLm
    || round(takeoffInternalDoorArchitraveLm + windowArchitraveLm + externalDoorArchitraveLm + slidingDoorArchitraveLm);
  const architraveTotalLm = takeoffArchitraveLm || round(wd.totals.architraveLength + manualInternalDoorArchitraveLm);
  // Without per-opening sizes there is nothing to pack, so round up whole lengths rather than
  // leaving a fraction that could only be met by joining offcuts.
  const architraveTotalLengthsQty = architraveLengthsQty || Math.ceil(architraveTotalLm / ARCHITRAVE_DEFAULTS.stockLengthM);
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
  const measuredWallLm = (prefix, type, lm, thickness, target) => {
    const value = raw(workbook, "inputDataSheet", `${prefix}${type}${target}mmWallsLm`);
    return value !== "" && value !== undefined && value !== null ? number(value) : thicknessWallLm(lm, thickness, target);
  };
  const totalExternal70mmWallsLm = round(
    measuredWallLm("lower", "External", lowerExt, lowerExternalThickness, "70") +
    measuredWallLm("upper", "External", activeUpperExt, upperExternalThickness, "70") +
    measuredWallLm("third", "External", activeThirdExt, thirdExternalThickness, "70")
  );
  const totalExternal90mmWallsLm = round(
    measuredWallLm("lower", "External", lowerExt, lowerExternalThickness, "90") +
    measuredWallLm("upper", "External", activeUpperExt, upperExternalThickness, "90") +
    measuredWallLm("third", "External", activeThirdExt, thirdExternalThickness, "90")
  );
  const totalInternal70mmWallsLm = round(
    measuredWallLm("lower", "Internal", lowerInt, lowerInternalThickness, "70") +
    measuredWallLm("upper", "Internal", activeUpperInt, upperInternalThickness, "70") +
    measuredWallLm("third", "Internal", activeThirdInt, thirdInternalThickness, "70")
  );
  const totalInternal90mmWallsLm = round(
    measuredWallLm("lower", "Internal", lowerInt, lowerInternalThickness, "90") +
    measuredWallLm("upper", "Internal", activeUpperInt, upperInternalThickness, "90") +
    measuredWallLm("third", "Internal", activeThirdInt, thirdInternalThickness, "90")
  );
  const total70mmWallsLm = round(totalExternal70mmWallsLm + totalInternal70mmWallsLm);
  const total90mmWallsLm = round(totalExternal90mmWallsLm + totalInternal90mmWallsLm);
  const lowerExternal70mmWallsLm = measuredWallLm("lower", "External", lowerExt, lowerExternalThickness, "70");
  const upperExternal70mmWallsLm = measuredWallLm("upper", "External", activeUpperExt, upperExternalThickness, "70");
  const thirdExternal70mmWallsLm = measuredWallLm("third", "External", activeThirdExt, thirdExternalThickness, "70");
  const lowerExternal90mmWallsLm = measuredWallLm("lower", "External", lowerExt, lowerExternalThickness, "90");
  const upperExternal90mmWallsLm = measuredWallLm("upper", "External", activeUpperExt, upperExternalThickness, "90");
  const thirdExternal90mmWallsLm = measuredWallLm("third", "External", activeThirdExt, thirdExternalThickness, "90");
  const lowerInternal70mmWallsLm = measuredWallLm("lower", "Internal", lowerInt, lowerInternalThickness, "70");
  const upperInternal70mmWallsLm = measuredWallLm("upper", "Internal", activeUpperInt, upperInternalThickness, "70");
  const thirdInternal70mmWallsLm = measuredWallLm("third", "Internal", activeThirdInt, thirdInternalThickness, "70");
  const lowerInternal90mmWallsLm = measuredWallLm("lower", "Internal", lowerInt, lowerInternalThickness, "90");
  const upperInternal90mmWallsLm = measuredWallLm("upper", "Internal", activeUpperInt, upperInternalThickness, "90");
  const thirdInternal90mmWallsLm = measuredWallLm("third", "Internal", activeThirdInt, thirdInternalThickness, "90");
  const lowerExternal70mmFramedWallLm = measuredWallLm("lower", "External", lowerExternalFramedWallLm, lowerExternalThickness, "70");
  const upperExternal70mmFramedWallLm = measuredWallLm("upper", "External", upperExternalFramedWallLm, upperExternalThickness, "70");
  const thirdExternal70mmFramedWallLm = measuredWallLm("third", "External", thirdExternalFramedWallLm, thirdExternalThickness, "70");
  const lowerExternal90mmFramedWallLm = measuredWallLm("lower", "External", lowerExternalFramedWallLm, lowerExternalThickness, "90");
  const upperExternal90mmFramedWallLm = measuredWallLm("upper", "External", upperExternalFramedWallLm, upperExternalThickness, "90");
  const thirdExternal90mmFramedWallLm = measuredWallLm("third", "External", thirdExternalFramedWallLm, thirdExternalThickness, "90");
  const lowerInternal70mmFramedWallLm = measuredWallLm("lower", "Internal", lowerInternalFramedWallLm, lowerInternalThickness, "70");
  const upperInternal70mmFramedWallLm = measuredWallLm("upper", "Internal", upperInternalFramedWallLm, upperInternalThickness, "70");
  const thirdInternal70mmFramedWallLm = measuredWallLm("third", "Internal", thirdInternalFramedWallLm, thirdInternalThickness, "70");
  const lowerInternal90mmFramedWallLm = measuredWallLm("lower", "Internal", lowerInternalFramedWallLm, lowerInternalThickness, "90");
  const upperInternal90mmFramedWallLm = measuredWallLm("upper", "Internal", upperInternalFramedWallLm, upperInternalThickness, "90");
  const thirdInternal90mmFramedWallLm = measuredWallLm("third", "Internal", thirdInternalFramedWallLm, thirdInternalThickness, "90");
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
  const internal90mmStuds = (prefix, lm) => {
    const cavityLm = Math.min(lm, v("inputDataSheet", `${prefix}CavitySlider90mmWallsLm`));
    return studCountForWallLm(Math.max(0, lm - cavityLm), 1.2) + v("inputDataSheet", `${prefix}CavitySlider90mmStudsEach`);
  };
  const lowerInternal90mmStudsEach = internal90mmStuds("lower", lowerInternal90mmFramedWallLm);
  const upperInternal90mmStudsEach = internal90mmStuds("upper", upperInternal90mmFramedWallLm);
  const thirdInternal90mmStudsEach = internal90mmStuds("third", thirdInternal90mmFramedWallLm);
  const studs70mmEach = round(studCountForWallLm(external70mmFramedWallLm, 1.15) + studCountForWallLm(internal70mmFramedWallLm, 1.2));
  const studs90mmEach = round(studCountForWallLm(external90mmFramedWallLm, 1.15) + lowerInternal90mmStudsEach + upperInternal90mmStudsEach + thirdInternal90mmStudsEach);
  const wallPlatesNoggins70mmExternalWallsLm = round(external70mmFramedWallLm * 4);
  const wallPlatesNoggins90mmExternalWallsLm = round(external90mmFramedWallLm * 4);
  const wallPlatesNoggins70mmInternalWallsLm = round(internal70mmFramedWallLm * 3);
  const wallPlatesNoggins90mmInternalWallsLm = round(internal90mmFramedWallLm * 3);
  const lowerWallPlatesNoggins70mmExternalLm = round(lowerExternal70mmFramedWallLm * 4);
  const lowerWallPlatesNoggins70mmInternalLm = round(lowerInternal70mmFramedWallLm * 3);
  const upperWallPlatesNoggins70mmExternalLm = round(upperExternal70mmFramedWallLm * 4);
  const upperWallPlatesNoggins70mmInternalLm = round(upperInternal70mmFramedWallLm * 3);
  const thirdWallPlatesNoggins70mmExternalLm = round(thirdExternal70mmFramedWallLm * 4);
  const thirdWallPlatesNoggins70mmInternalLm = round(thirdInternal70mmFramedWallLm * 3);
  const lowerWallPlatesNoggins90mmExternalLm = round(lowerExternal90mmFramedWallLm * 4);
  const lowerWallPlatesNoggins90mmInternalLm = round(lowerInternal90mmFramedWallLm * 3);
  const upperWallPlatesNoggins90mmExternalLm = round(upperExternal90mmFramedWallLm * 4);
  const upperWallPlatesNoggins90mmInternalLm = round(upperInternal90mmFramedWallLm * 3);
  const thirdWallPlatesNoggins90mmExternalLm = round(thirdExternal90mmFramedWallLm * 4);
  const thirdWallPlatesNoggins90mmInternalLm = round(thirdInternal90mmFramedWallLm * 3);
  const wallPlatesNoggins70mmLm = round(wallPlatesNoggins70mmExternalWallsLm + wallPlatesNoggins70mmInternalWallsLm);
  const wallPlatesNoggins90mmLm = round(wallPlatesNoggins90mmExternalWallsLm + wallPlatesNoggins90mmInternalWallsLm);
  const lowerStudMaterial70mmExternalLm = round(studCountForWallLm(lowerExternal70mmFramedWallLm, 1.15) * lowerHeight);
  const lowerStudMaterial70mmInternalLm = round(studCountForWallLm(lowerInternal70mmFramedWallLm, 1.2) * lowerHeight);
  const upperStudMaterial70mmExternalLm = round(studCountForWallLm(upperExternal70mmFramedWallLm, 1.15) * (upperHeight || 0));
  const upperStudMaterial70mmInternalLm = round(studCountForWallLm(upperInternal70mmFramedWallLm, 1.2) * (upperHeight || 0));
  const thirdStudMaterial70mmExternalLm = round(studCountForWallLm(thirdExternal70mmFramedWallLm, 1.15) * (thirdHeight || 0));
  const thirdStudMaterial70mmInternalLm = round(studCountForWallLm(thirdInternal70mmFramedWallLm, 1.2) * (thirdHeight || 0));
  const lowerStudMaterial90mmExternalLm = round(studCountForWallLm(lowerExternal90mmFramedWallLm, 1.15) * lowerHeight);
  const lowerStudMaterial90mmInternalLm = round(lowerInternal90mmStudsEach * lowerHeight);
  const upperStudMaterial90mmExternalLm = round(studCountForWallLm(upperExternal90mmFramedWallLm, 1.15) * (upperHeight || 0));
  const upperStudMaterial90mmInternalLm = round(upperInternal90mmStudsEach * (upperHeight || 0));
  const thirdStudMaterial90mmExternalLm = round(studCountForWallLm(thirdExternal90mmFramedWallLm, 1.15) * (thirdHeight || 0));
  const thirdStudMaterial90mmInternalLm = round(thirdInternal90mmStudsEach * (thirdHeight || 0));
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
    // Floor-to-floor height and risers per stair flight (stairGeometry.js), from Job Setup.
    ...stairQuantities(workbook),
    lowerInternal90mmStudsEach, upperInternal90mmStudsEach, thirdInternal90mmStudsEach,
    lowerPatioAreaM2: v("inputDataSheet", "lowerPatioAreaM2"), upperPatioAreaM2: v("inputDataSheet", "upperPatioAreaM2"), thirdPatioAreaM2: v("inputDataSheet", "thirdPatioAreaM2"),
    siteItem: 1,
    lowerExternalWallsLm: lowerExt,
    upperExternalWallsLm: activeUpperExt,
    thirdExternalWallsLm: activeThirdExt,
    // Same already-computed totals as the three lines above, exposed under the Wall Frames
    // section's own display key (lowerExternalWallsLm etc. stay a separate, still-editable Job
    // Setup import destination in their own right - this is an alias onto the same value, not a
    // second calculation of it).
    lowerExteriorWallFramesLm: lowerExt,
    upperExteriorWallFramesLm: activeUpperExt,
    thirdExteriorWallFramesLm: activeThirdExt,
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
    lowerWindowDoorDeductionsM2,
    upperWindowDoorDeductionsM2,
    thirdWindowDoorDeductionsM2,
    windowDoorDeductionsM2,
    upperBulkExternalWallAreaM2,
    thirdBulkExternalWallAreaM2,
    lowerNetExternalWallAreaM2: round(Math.max(0, lowerExternalWallAreaM2 - lowerWindowDoorDeductionsM2)),
    upperNetExternalWallAreaM2: round(Math.max(0, upperExternalWallAreaM2 - upperWindowDoorDeductionsM2)),
    thirdNetExternalWallAreaM2: round(Math.max(0, thirdExternalWallAreaM2 - thirdWindowDoorDeductionsM2)),
    upperNetExteriorWallAfterOpeningsM2: round(Math.max(0, upperBulkExternalWallAreaM2 - upperWindowDoorDeductionsM2)),
    thirdNetExteriorWallAfterOpeningsM2: round(Math.max(0, thirdBulkExternalWallAreaM2 - thirdWindowDoorDeductionsM2)),
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
    totalPlasterboardM2: round(internalPlasterboardWallM2 + externalPlasterboardWallM2
      + lowerSlabAreaM2 + secondLevelFloorAreaM2 + thirdLevelFloorAreaM2),
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
    architraveLm: architraveTotalLm,
    architraveTotalLm,
    architraveTotalLengthsQty,
    architraveLengthsEach: architraveTotalLengthsQty,
    corniceLm: round((lowerExt + upperExt + thirdExt) + ((lowerInt + upperInt + thirdInt) * 2)),
    revealLm: wd.totals.revealLength,
    sillLm: wd.totals.sillLength,
    internalDoors,
    manualInternalDoorArchitraveLm,
    takeoffInternalDoorArchitraveLm,
    architraveMeasuredLm,
    architraveLengthsQty,
    architraveWasteLm,
    windowArchitraveLm,
    externalDoorArchitraveLm,
    slidingDoorArchitraveLm,
    takeoffArchitraveLm,
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
  quantities.internalDoors = wd.totals.internalDoorCount || manualInternalDoors || takeoffInternalDoors;
  const cavityDoorCageRow = Object.values(workbook.quotation || {}).flatMap((s) => s?.rows || []).find((r) => quoteRowSourceNumber(r) === 104);
  quantities.cavityDoorQty = cavityDoorCageRow ? quoteQuantityValue(cavityDoorCageRow.quantity, quantities) : 0;

  // Legacy manual inputs still calculate per level. Measured wall systems replace these
  // fallback areas below, after the editable workbook formulas have run.
  const manualBrickLevels = [
    [lowerSystem, quantities.lowerNetExternalWallAreaM2],
    [upperSystem, quantities.upperNetExternalWallAreaM2],
    [thirdSystem, quantities.thirdNetExternalWallAreaM2],
  ];
  const faceNet = manualBrickLevels.filter(([system]) => isFaceBrickVeneerSystem(system)).reduce((sum, [, area]) => sum + number(area), 0);
  const renderedNet = manualBrickLevels.filter(([system]) => isRenderedBrickVeneerSystem(system)).reduce((sum, [, area]) => sum + number(area), 0);
  Object.assign(quantities, brickOrderQuantities(faceNet, renderedNet));
  quantities.faceBrickNetM2 = faceNet;
  quantities.renderedNetM2 = renderedNet;
  quantities.brickVeneerSillsLm = v("inputDataSheet", "brickVeneerSillsLm") || v("inputDataSheet", "totalBrickSillLengthLm");
  quantities.lockupSingleHeightBricks = (quantities.faceBrickOrderEach + quantities.renderedSingleOrderEach) / 1000;
  quantities.lockupTwinHeightBricks = quantities.renderedTwinOrderEach / 1000;
  quantities.lockupBrickSillsLm = quantities.brickVeneerSillsLm;
  quantities.lockupFaceRenderM2 = renderedNet;
  quantities.quoteFaceBricksBaseRange = quantities.faceBrickOrderEach / 1000;
  quantities.quoteCommonSingleHeights = quantities.renderedSingleOrderEach / 1000;
  quantities.quoteCommonTwinHeights = quantities.renderedTwinOrderEach / 1000;
  quantities.quoteBrickSillBricks = roundTo(quantities.brickVeneerSillsLm / 0.085 / 1000, 3);
  quantities.quoteBricklayerFaceBricks = quantities.quoteFaceBricksBaseRange;
  quantities.quoteBricklayerSingleHeight = quantities.quoteCommonSingleHeights;
  quantities.quoteBricklayerDoubleHeights = quantities.quoteCommonTwinHeights;
  quantities.quoteBricklayerSillsLm = quantities.brickVeneerSillsLm;
  quantities.quoteRenderingNetWallAreaM2 = renderedNet;
  quantities.quoteRenderingSillsLm = renderedNet ? quantities.brickVeneerSillsLm : 0;
  quantities.quoteFrameInstallWindows = quantities.windowCount;
  quantities.quoteFrameSecondStoreyWindows = quantities.secondLevelWindowCount;
  quantities.quoteFrameThirdStoreyWindows = quantities.thirdLevelWindowCount;
  // PORCH/VERANDAH ROOF & CEILING FRAMEWORK (quote sourceRow 82): the item's own legacy Excel
  // quantity formula references another sheet by name ('Data Input Sheet'!C40+...) and can never
  // evaluate in evaluateFormula(), so it has always shown as a manual-entry blank. Alfresco, porch
  // and balcony area are already measured/entered per level (see alfresco/upperAlfresco/thirdAlfresco,
  // porch/upperPorch/thirdPorch above and totalBalconyAreaM2) - this only sums those existing areas.
  quantities.quoteFramePorchVerandahFrameworkM2 = round(alfresco + upperAlfresco + thirdAlfresco + porch + upperPorch + thirdPorch + totalBalconyAreaM2);
  // EXTRA COST FOR 2.7m WALLS (quote sourceRow 68): applies to whichever level(s) are built above
  // the standard 2.4m ceiling height, using each level's own already-computed external wall area -
  // no new geometry, just a threshold selection over lowerHeight/upperHeight/thirdHeight.
  quantities.quoteFrameExtraCost27mWallsM2 = round(
    (lowerHeight > 2.4 ? lowerExternalWallAreaM2 : 0) +
    (upperHeight > 2.4 ? upperExternalWallAreaM2 : 0) +
    (thirdHeight > 2.4 ? thirdExternalWallAreaM2 : 0)
  );
  // Cavity slider cage count: Job Setup already holds this (one cage per measured cavity sliding
  // door, imported by Apply Takeoff into inputDataSheet.totalCavitySliderCagesEach), but it was
  // never promoted into the quantities a quote row's quantityKey can link to.
  quantities.totalCavitySliderCagesEach = v("inputDataSheet", "totalCavitySliderCagesEach");
  // HIGHSET ALLOWANCE (quote sourceRow 100, "CHIPPY HIGHT SET ALLOWANCE"): the existing catalogue
  // rate ($500 ITEM) already covers this - it only ever needed the qty, which is 1 (the allowance
  // applies) once the project is more than a single storey, 0 otherwise.
  quantities.quoteFrameHighsetAllowance = topLevelNumber > 1 ? 1 : 0;
  // Robe / linen door counts: genuine per-project quantities with no reliable takeoff signal to
  // derive them from automatically - a takeoff opening's subType 'Robe' only flags a SLIDING
  // wardrobe door (isRobeSlider), never a hinged one, so counting it alone would silently
  // under-count; no 'linen' room or door-type classification exists anywhere in the takeoff at all.
  // Both are entered once in Job Setup (inputDataSheet.robeDoorCount / linenDoorCount) and read
  // straight through here, exactly like totalCavitySliderCagesEach above.
  quantities.robeDoorCount = v("inputDataSheet", "robeDoorCount");
  quantities.linenDoorCount = v("inputDataSheet", "linenDoorCount");
  // TIE DOWN: cyclone rods, connector nuts, chemset and SQ washers/nuts, all derived from the same
  // canonical ground/upper exterior wall LM already computed above (lowerExternalWallsLm /
  // upperExternalWallsLm) - never re-measured here. Rods are spaced at 1.5m centres and, like
  // architraveTotalLengthsQty above, round UP: a discrete rod or chemset cartridge can't be joined
  // from a fraction, so under-rounding would leave the job short. upperExternalWallsLm is already
  // zeroed for a single-storey project (see activeUpperExt above), so the 2.7m rod count and
  // everything chained from it naturally resolves to 0 without any extra single-storey check here.
  quantities.tieDownGroundCycloneRods = Math.ceil(Number(quantities.lowerExternalWallsLm) / 1.5) || 0;
  quantities.tieDownUpperCycloneRods = Math.ceil(Number(quantities.upperExternalWallsLm) / 1.5) || 0;
  // Connector nuts cover every rod across both levels - summing the two already-rounded rod counts
  // above (never re-deriving from wall LM directly) keeps it permanently in sync with them.
  quantities.tieDownConnectorNuts = quantities.tieDownGroundCycloneRods + quantities.tieDownUpperCycloneRods;
  // Chemset and SQ washers/nuts are keyed off the ground-floor rod count only, never the combined total.
  quantities.tieDownChemset = Math.ceil(quantities.tieDownGroundCycloneRods / 10) || 0;
  quantities.tieDownSqWashersAndNuts = quantities.tieDownGroundCycloneRods;
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
   quantities.quote180LineaBoardLM = Math.ceil(quantities.topLevelExternalWallAreaM2 / 0.63);
  if (!isBrick(lowerSystem)) quantities.lowerBrickworkAreaM2 = 0;
  if (!isCladding(upperSystem)) quantities.upperCladdingAreaM2 = 0;
  if (!isCladding(thirdSystem)) quantities.thirdCladdingAreaM2 = 0;
  assignWallSystemAreas(quantities, [
    { system: lowerSystem, area: lowerExternalWallAreaM2 },
    { system: upperSystem, area: upperExternalWallAreaM2 },
    { system: thirdSystem, area: thirdExternalWallAreaM2 },
  ]);

applyMeasuredTakeoffQuantities(quantities, workbook);
  const wallLinings = calculateWallLinings(workbook, quantities);
  Object.assign(quantities, wallLinings.quantities);
  Object.assign(quantities, takeoffOpeningCounts(workbook));
  // Internal doors, door furniture, jambs, cavity cages and window/door labour from the Takeoff.
  const doorTakeoff = takeoffDoorQuotation(workbook);
  Object.assign(quantities, doorTakeoff.quantities);
  const claddingPlanks = calculateCladdingPlanks(workbook);
  claddingPlanks.forEach((product) => { quantities[product.quantityKey] = product.plankQty || ""; });
  // CEILING BATTENS (first row of the section): every level's roofed ceiling area and roofed-zone
  // perimeter, after the measured Takeoff quantities above have been applied (ceilingBattens.js).
  const ceilingBattens = calculateCeilingBattens({
    job: workbook?.aiPlanTakeoffJob || workbook?.takeoffEngine?.aiPlanTakeoffJob || null,
    roofPlanAreaM2: { lower: quantities.lowerRoofPlanAreaM2, upper: quantities.upperRoofPlanAreaM2, third: quantities.thirdRoofPlanAreaM2 },
    externalWallsLm: { lower: quantities.lowerExternalWallsLm, upper: quantities.upperExternalWallsLm, third: quantities.thirdExternalWallsLm },
    topLevelPrefix: topLevelNumber === 3 ? "third" : topLevelNumber === 2 ? "upper" : "lower",
  });
  quantities[CEILING_BATTEN_QUANTITY_KEY] = ceilingBattens.qty || "";
  quantities.roofedCeilingArea = round(ceilingBattens.roofedCeilingArea);
  quantities.roofedCeilingPerimeter = round(ceilingBattens.roofedCeilingPerimeter);
  for (const entry of ceilingBattens.levels) {
    quantities[`${entry.prefix}RoofedCeilingAreaM2`] = round(entry.areaM2);
    quantities[`${entry.prefix}RoofedCeilingPerimeterLm`] = round(entry.perimeterLm);
  }
   // Section 53 WINDOWS price list quantities, counted from the takeoff Window Schedule.
   const windowPriceListTakeoff = windowPriceListTakeoffQuantities(workbook);
   Object.assign(quantities, windowPriceListTakeoff.quantities);
   // Flyscreens: same Qty as each window row (not fixed glass).
   const windowPriceListFlyscreens = windowPriceListFlyscreenQuantities(workbook.quotation, quantities);
   Object.assign(quantities, windowPriceListFlyscreens.quantities);
   // Window Schedule items (and their flyscreens) with no price list row: visible unpriced lines.
   const windowScheduleUnpricedRows = [...windowPriceListTakeoff.unpricedRows, ...windowPriceListFlyscreens.unpricedRows];
   const windowPriceList = { unmatched: [...windowPriceListTakeoff.unmatched, ...windowPriceListFlyscreens.unmatched], customWindows: windowPriceListTakeoff.customWindows };
   const quotationResult = calculateQuotation(withWallLiningMappings(workbook.quotation), quantities, { frameMethod, windowsDoors: wd, workbook, customWindows: windowPriceListTakeoff.customWindows, windowScheduleUnpricedRows, claddingPlanks, ceilingBattens, doorTakeoff, wallLinings });
  const { quotation, fees } = quotationResult;
  const windowsSectionName = Object.keys(quotation).find(isWindowsSectionName);
  const windowScheduleReconciliation = reconcileWindowScheduleWithQuote(windowPriceListTakeoff, windowsSectionName ? quotation[windowsSectionName].rows : []);
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
    windowScheduleUnmatched: windowPriceList.unmatched,
    windowScheduleOutcomes: windowPriceListTakeoff.outcomes,
    windowScheduleReconciliation,
    claddingPlanks,
    ceilingBattens,
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
  const quotationWithWindowDoors = ensureInternal90mmWallFrameRow(injectDoorTakeoffRows(injectWindowDoorQuoteRows(quotation, options.windowsDoors, options.customWindows, options.windowScheduleUnpricedRows), options.doorTakeoff), quantities);
  const flyscreenAllowance = round(selectedWindowDoorSubtotal(options.windowsDoors?.rows || []) * 0.1);
  const quoteRowValues = buildQuoteRowFormulaValues(quotation, quantities, options.doorTakeoff);
  // Neither quantities nor quoteRowValues changes while rows are calculated below, so the
  // formula lookup is built once (on first use) instead of re-spread for every quote row.
  let formulaLookup = null;
  const quoteFormulaLookup = () => formulaLookup || (formulaLookup = { ...quantities, ...quoteRowValues });
  const claddingPlankByKey = Object.fromEntries((options.claddingPlanks || []).map((product) => [product.quantityKey, product]));
  let calculatedQuotation = Object.fromEntries(Object.entries(quotationWithWindowDoors).map(([sectionName, section]) => {
    const blankInputs = isBlankInputQuoteSectionName(sectionName);
    const blankQty = isBlankQtyQuoteSectionName(sectionName);
    const rows = removeRemovedImportedQuoteRows(removeRoofingMaterialsRemovedRows(sectionName, section.rows)).map((row) => {
      if (['heading', 'spacer'].includes(row.cabinetryRowType)) return { ...row, qty:0, quantity:'', cost:0, finalRateUsed:'', sourceOfRate:'' };
      if (isForcedBlankQuoteQtyRow(row)) return forcedBlankQuoteQtyRow(row);
      if (isLinea180M2ReferenceRow(row)) return linea180M2ReferenceRow(row);
      const quoteRow = isFlyscreenAllowanceQuoteRow(row) ? flyscreenAllowanceQuoteRow(row, flyscreenAllowance) : row;
      if (blankInputs && !isRoofTrussesRoofAreaQuoteRow(quoteRow)) return blankInputQuoteRow(quoteRow);
      const qtyRow = blankFoundationsHeaderQtyRow(blankQty && !quoteRow.generatedWindowDoorQuoteRow && !quoteRow.generatedFlyscreenQuoteRow && !quoteRow.windowPriceListRow && !quoteRow.windowScheduleUnpricedRow ? blankQtyQuoteRow(quoteRow) : quoteRow);
      const doorTakeoffKey = doorTakeoffQuantityKey(qtyRow, sectionName, options.doorTakeoff);
      const skirtingLabour = isSkirtingInstallLabourRow(qtyRow, sectionName);
      const wallPolicy = wallLiningRowPolicy(qtyRow);
      const quantityKey = wallPolicy?.key || (skirtingLabour ? SKIRTING_TOTAL_QUANTITY_KEY : doorTakeoffKey ?? normalizedQuoteQuantityKey(qtyRow));
      const linkedQty = number(quantities[quantityKey]);
      const takeoffMaterialKey = ({
        quoteFaceBricksBaseRange: "faceBrickOrderEach",
        quoteCommonTwinHeights: "renderedTwinOrderEach",
        quoteCommonSingleHeights: "renderedSingleOrderEach",
        // Sill materials and labour share the opening-derived LM source. Old spreadsheet
        // quantity formulas must not replace it or add it to the net wall brick quantity.
        quoteBrickSillBricks: "brickVeneerSillsLm",
        quoteBricklayerSillsLm: "brickVeneerSillsLm",
      })[quantityKey];
      const forceLinkedQty = Boolean(wallPolicy?.key) || skirtingLabour || (!qtyRow.quantityFormulaOverride && !qtyRow.quantityManualOverride && (isForcedLinkedQuantityKey(quantityKey, options.doorTakeoff) || (takeoffMaterialKey && quantities[takeoffMaterialKey] !== undefined)));
      const floorSystemQty = !qtyRow.quantityFormulaOverride && isFloorSystemQuoteQuantityKey(quantityKey);
      const floorSystemLinkedQty = floorSystemQty ? floorSystemQuoteQuantity(qtyRow, quantityKey, quantities) : 0;
      const linkedQtyRow = Boolean(quantityKey);
      const manualOverride = qtyRow.quantityManualOverride === true;
      const linkedQuantityControlsDisplay = forceLinkedQty || floorSystemQty || (linkedQtyRow && !manualOverride);
      // The user owns this quantity: a blank or 0 means 0, never the old Takeoff / formula value.
      const userEnteredQty = !skirtingLabour && isUserEnteredQuoteQuantity(qtyRow, { forceLinked: forceLinkedQty || floorSystemQty });
      const manualQty = userEnteredQty ? quoteQuantityValue(qtyRow.quantity, quantities) : 0;
      const quantityFormula = !userEnteredQty && !forceLinkedQty && !floorSystemQty ? effectiveQuoteQuantityFormula(qtyRow, quantityKey) : "";
      const formulaQty = quantityFormula ? quoteFormulaQuantity({ formulas: { B: quantityFormula } }, quoteFormulaLookup()) : 0;
      // Legacy imported rows may retain an unresolved spreadsheet formula alongside
      // a live quantity link. Keep that fallback; an estimator's formula (even zero)
      // and the canonical door subtraction always own the result.
      const formulaControlsQty = Boolean(quantityFormula && (qtyRow.quantityFormulaOverride || quantityKey === DOOR_TAKEOFF_KEYS.singleDoorHang || !quantityKey || formulaQty));
      const qty = floorSystemQty
        ? floorSystemLinkedQty
        : formulaControlsQty ? formulaQty
        : resolveQuoteRowQuantity({ userEntered: userEnteredQty, manualQuantity: manualQty, linkedQuantity: linkedQty });
      const derivedQuantityFormula = userEnteredQty ? "" : formulaControlsQty ? quantityFormula : quantityKey;
      const sourceNotes = isRow150CavitySliderQtyImport(qtyRow) ? "Formula: =B104" : qtyRow.notes;
      const notes = quantityKey === DOOR_TAKEOFF_KEYS.superseded ? SUPERSEDED_NOTE : qtyRow.generatedTakeoffProductRow ? qtyRow.notes : quoteNotesWithImportedData(sourceNotes, Boolean(quoteRowSourceNumber(qtyRow) !== 116 && !userEnteredQty && (formulaQty || linkedQty || floorSystemLinkedQty) && qty), quantityKey);
      const rateInfo = finalRate(qtyRow);
      const excluded = qtyRow.lineType === "Excluded item";
      const waitingOnQuote = (qtyRow.lineType === "Quote required" || qtyRow.quoteRequired) && rateInfo.rate === "";
      const frameInactive = isFrameMethodInactive(qtyRow, options.frameMethod);
      const inactive = qtyRow.active === false || excluded || waitingOnQuote || frameInactive;
      const rate = number(rateInfo.rate);
      const cost = quoteRowCost({ quantity: qty, rate, inactive });
      const feeType = quoteFeeType(qtyRow);
      if (feeType) fees[feeType] = round(fees[feeType] + cost);
      const hidden = frameInactive || isHiddenQuoteRow(qtyRow) || shouldHideZeroLinkedQuoteRow(qtyRow, quantityKey, qty);
      const row150CavitySliderQtyImport = isRow150CavitySliderQtyImport(qtyRow);
      // The batten row shows its real formula and per-level working, and keeps the source values.
      const ceilingBattenRow = quantityKey === CEILING_BATTEN_QUANTITY_KEY && options.ceilingBattens ? options.ceilingBattens : null;
      return {
        ...qtyRow,
        derivedQuantityFormula: ceilingBattenRow ? CEILING_BATTEN_FORMULA : derivedQuantityFormula,
        derivedQuantityExplanation: wallPolicy?.key ? wallLiningWorking(wallPolicy, options.wallLinings) : ceilingBattenRow ? ceilingBattenRow.working : quoteQuantityExplanation(derivedQuantityFormula, quoteFormulaLookup(), qty),
        ...(wallPolicy?.key ? { quantityLocked: true, quantitySource: options.wallLinings } : {}),
        ...(ceilingBattenRow ? { quantitySource: {
          formula: CEILING_BATTEN_FORMULA,
          roofedCeilingAreaByLevel: ceilingBattenRow.roofedCeilingAreaByLevel,
          roofedCeilingPerimeterByLevel: ceilingBattenRow.roofedCeilingPerimeterByLevel,
          fieldBattenLm: round(ceilingBattenRow.fieldLm),
          perimeterBattenLm: round(ceilingBattenRow.perimeterLm),
          totalLm: round(ceilingBattenRow.totalLm),
          adjustedLm: round(ceilingBattenRow.adjustedLm),
          quantity: ceilingBattenRow.qty,
        } } : {}),
        quantity: row150CavitySliderQtyImport ? (hidden || !qty ? "" : String(qty)) : (linkedQuantityControlsDisplay ? (hidden || !qty ? "" : String(qty)) : qtyRow.quantity),
        quantityKey,
        autoQuantity: linkedQuantityControlsDisplay ? Boolean(qty) : qtyRow.autoQuantity,
        quantityManualOverride: row150CavitySliderQtyImport ? false : (linkedQuantityControlsDisplay ? false : qtyRow.quantityManualOverride),
        qty: hidden ? 0 : qty,
        ...(skirtingLabour ? { unit: "LM" } : {}),
        finalRateUsed: rateInfo.rate,
        sourceOfRate: rateInfo.source,
        ...(qtyRow.selectionSource ? selectionVariation(qtyRow, hidden ? 0 : qty) : {}),
        cost: hidden ? 0 : cost,
        ...(claddingPlankByKey[quantityKey] ? { selectionSpec: claddingPlankByKey[quantityKey].workingText } : {}),
        notes,
        feeType,
        inactiveReason: frameInactive ? `Hidden by ${options.frameMethod}` : "",
      };
    });
    const subtotalBeforeTotalRows = sumQuoteRowCosts(rows, (row) => !(row.feeType || row.cabinetMakerTotalRow));
    const rowsWithTotals = rows.map((row) => (
      row.cabinetMakerTotalRow
        ? { ...row, quantity: "", qty: 0, finalRateUsed: "", sourceOfRate: "manual", cost: subtotalBeforeTotalRows }
        : row
    ));
    const calculatedSubtotal = sumQuoteRowCosts(rowsWithTotals, (row) => !(row.feeType || row.cabinetMakerTotalRow));
    const workbookSubtotal = number(section.workbookSummaryValue);
    return [sectionName, { ...section, rows: rowsWithTotals, subtotal: workbookSubtotal || calculatedSubtotal }];
  }));
  calculatedQuotation = applySubcontractorQuoteAllocations(calculatedQuotation, options.workbook || {});
  return { quotation: calculatedQuotation, fees };
}

function applySubcontractorQuoteAllocations(quotation = {}, workbook = {}) {
  return quotation;
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

// Takeoff inputs for each cladding product in CLADDING_PLANK_PRODUCTS, run through the one generic
// calculateCladdingPlankQty formula: cladded wall LM and ceiling height per level (the level's
// ceiling + floor build-up, takeoffLevelWallHeightM) and only the openings linked to those walls.
// FIX OUT architrave rows -> Takeoff opening counts.
const TAKEOFF_ARCH_QUOTE_KEYS = {
  "quote-1357": "takeoffInternalDoorCount",
  "quote-1361": "takeoffWindowCount",
  "quote-1362": "takeoffRobeDoorCount",
};

// Opening counts from the job's AI Plan Takeoff, using the Takeoff's own door and window schedules
// (quantities summed, not rows counted):
// - takeoffInternalDoorCount: hinged internal doors (createInternalDoorSizeSchedule) + cavity sliders
//   (createCavitySliderCageSchedule) - never robe doors, entry/external, sliding glass or garage doors;
// - takeoffWindowCount: Window rows of the Window Schedule (createJobSetupWindowSchedule) only;
// - takeoffRobeDoorCount: robe / sliding robe doors (createRobeSlidingDoorSchedule).
// A job with no Takeoff drawing falls back to the counts Takeoff import last wrote to Job Setup
// (internalDoorOpeningsQty, windowOpeningsQty) and the Job Setup robe door count (robeDoorCount).
const takeoffOpeningCountCache = new WeakMap();
function takeoffOpeningCounts(workbook = {}) {
  const job = workbook?.aiPlanTakeoffJob || workbook?.takeoffEngine?.aiPlanTakeoffJob || null;
  const jobSetupRows = workbook?.data?.inputDataSheet?.rows || {};
  if (!job || typeof job !== "object" || !Array.isArray(job.placedOpenings)) {
    return {
      takeoffInternalDoorCount: number(value(workbook, "inputDataSheet", "internalDoorOpeningsQty")),
      takeoffWindowCount: number(value(workbook, "inputDataSheet", "windowOpeningsQty")),
      takeoffRobeDoorCount: number(value(workbook, "inputDataSheet", "robeDoorCount")),
    };
  }
  const cached = takeoffOpeningCountCache.get(job);
  if (cached && cached.jobSetupRows === jobSetupRows) return cached.counts;
  const source = { completedWallRuns: job.completedWallRuns || [], placedOpenings: job.placedOpenings, pixelsPerMm: job.pixelsPerMm, sheetLevels: job.sheetLevels || {}, jobSetupRows };
  const total = (rows = []) => rows.reduce((sum, row) => sum + number(row.quantity), 0);
  let counts;
  try {
    counts = {
      takeoffInternalDoorCount: total(createInternalDoorSizeSchedule(source).rows) + total(createCavitySliderCageSchedule(source).rows),
      takeoffWindowCount: total(createJobSetupWindowSchedule(source).rows.filter((row) => row.openingType === "Window")),
      takeoffRobeDoorCount: total(createRobeSlidingDoorSchedule(source).rows),
    };
  } catch {
    counts = { takeoffInternalDoorCount: 0, takeoffWindowCount: 0, takeoffRobeDoorCount: 0 };
  }
  takeoffOpeningCountCache.set(job, { jobSetupRows, counts });
  return counts;
}

const claddingWallCache = new WeakMap();
function claddingProductWalls(job) {
  if (!job || typeof job !== "object") return [];
  if (claddingWallCache.has(job)) return claddingWallCache.get(job);
  let walls = [];
  try {
    walls = createCladdingProductWallSchedule({
      completedWallRuns: job.completedWallRuns || [],
      placedOpenings: job.placedOpenings || [],
      pixelsPerMm: job.pixelsPerMm,
      sheetLevels: job.sheetLevels || {},
    }).rows;
  } catch {
    walls = [];
  }
  claddingWallCache.set(job, walls);
  return walls;
}

export function calculateCladdingPlanks(workbook = {}) {
  const job = workbook?.aiPlanTakeoffJob || workbook?.takeoffEngine?.aiPlanTakeoffJob || null;
  const jobSetupRows = workbook?.data?.inputDataSheet?.rows || {};
  const walls = claddingProductWalls(job);
  return CLADDING_PLANK_PRODUCTS.map((product) => {
    const productWalls = walls.filter((wall) => wall.exteriorFinish === product.exteriorFinish);
    const levels = new Map();
    productWalls.forEach((wall) => {
      if (!levels.has(wall.levelPrefix)) {
        levels.set(wall.levelPrefix, { level: wall.level, claddedWallLm: 0, ceilingHeightM: Number(takeoffLevelWallHeightM(wall.levelPrefix, jobSetupRows)) || 0 });
      }
      levels.get(wall.levelPrefix).claddedWallLm += wall.lengthM;
    });
    const result = calculateCladdingPlankQty({
      levels: [...levels.values()],
      openingsAreaM2: productWalls.reduce((sum, wall) => sum + wall.openingAreaM2, 0),
      boardCoverageM2: product.boardCoverageM2,
    });
    return { ...product, ...result, workingText: claddingPlankWorkingText(result) };
  });
}

// The 180mm LINEA BOARD M2 row stays as a reference line only; the plank row carries the material.
function isLinea180M2ReferenceRow(row) {
  if (normalizedSectionName(row?.section) !== "external cladding") return false;
  return String(row?.id || "") === "quote-1027" || String(row?.item || "").trim().toLowerCase() === "180mm linea board";
}

function linea180M2ReferenceRow(row) {
  return {
    ...forcedBlankQuoteQtyRow(row),
    excelRate: "",
    manualRate: "",
    quotedSupplierRate: "",
    supplierCatalogueRate: "",
    finalRateUsed: "",
    sourceOfRate: "reference only",
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
  return rows.filter((row) => !isRemovedQuoteRow(row));
}

function isRemovedQuoteRow(row = {}) {
  if (REMOVED_QUOTE_ROW_IDS.has(String(row?.id || ""))) return true;
  if (REMOVED_IMPORTED_QUOTE_SOURCE_ROWS.has(quoteRowSourceNumber(row))) return true;
  const text = `${row?.section || ""} ${row?.item || ""} ${row?.rawText || ""} ${Array.isArray(row?.values) ? row.values.join(" ") : ""}`.toLowerCase();
  return (text.includes("plumber") || text.includes("electrician")) && text.includes("fit off");
}

function quoteRowSourceNumber(row) {
  const direct = row?.sourceRow ?? row?.excelRow ?? row?.importedWorkbookRow;
  const idMatch = String(row?.id || "").match(/^quote-(\d+)$/);
  const value = direct ?? idMatch?.[1];
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

// Takeoff-driven rows (doorTakeoffQuotation.js): Internal Doors / Door Furniture / Door Jambs lead
// Section 93 FIX OUT; Cavity Sliding Door Cages close FRAMING TIMBER. Generated per calculation,
// never persisted. Jamb rows are skipped where Apply Takeoff already added the same jamb lines.
function injectDoorTakeoffRows(quotation = {}, doorTakeoff = null) {
  if (!doorTakeoff?.hasTakeoff) return quotation;
  const persistedKeys = new Set(Object.values(quotation).flatMap((section) => section?.rows || [])
    .filter((row) => !row.generatedTakeoffProductRow).map((row) => row.quantityKey).filter(Boolean));
  const placed = new Set();
  return Object.fromEntries(Object.entries(quotation).map(([sectionName, section]) => {
    const key = normalizedSectionName(sectionName);
    const generated = doorTakeoff.rows?.[key];
    if (!generated || placed.has(key)) return [sectionName, section];
    placed.add(key);
    const rows = generated
      .filter((row) => !(/^jambd+x19StockLengthsEach$/.test(row.quantityKey || "") && persistedKeys.has(row.quantityKey)))
      .map((row) => ({ ...row, section: sectionName }));
    const stored = (section.rows || []).filter((row) => !row.generatedTakeoffProductRow);
    return [sectionName, { ...section, rows: key === "fix out" ? [...rows, ...stored] : [...stored, ...rows] }];
  }));
}

// The Takeoff quantity key for a row, or null when the Takeoff does not own this row's quantity.
function doorTakeoffQuantityKey(row, sectionName, doorTakeoff) {
  if (row.quantityFormulaOverride || row.quantityManualOverride) return null;
  if (row?.generatedTakeoffProductRow) return row.quantityKey || "";
  if (!doorTakeoff?.hasTakeoff) return null;
  return takeoffRowQuantityKey(row, normalizedSectionName(sectionName || row?.section), quoteRowSourceNumber(row));
}

function injectWindowDoorQuoteRows(quotation = {}, windowsDoors, customWindows = [], windowScheduleUnpricedRows = []) {
  const windowRows = selectedWindowDoorQuoteRows(windowsDoors?.rows || [], customWindows);
  const entranceDoorRows = selectedEntranceDoorQuoteRows(windowsDoors?.rows || []);
  const garageDoorRows = selectedGarageDoorWindowDoorRows(windowsDoors?.rows || []);
  return Object.fromEntries(Object.entries(quotation).map(([sectionName, section]) => {
    const name = normalizedSectionName(sectionName);
    if (name === "windows") {
      const rowsWithoutGenerated = (section.rows || []).filter((row) => !row.generatedWindowDoorQuoteRow);
      // Once the Section 53 price list (windowsQuotePriceList.js) is in this section, its rows ARE
      // the windows/doors/flyscreens quote: the old Windows/Doors schedule rows, the "WINDOWS
      // QUOTE" placeholder and the 10% flyscreen allowance are obsolete and would double count them.
      if (rowsWithoutGenerated.some((row) => row.windowPriceListRow || isTakeoffWindowSyncQuoteRow(row))) {
        return [sectionName, { ...section, rows: withWindowScheduleUnpricedRows(rowsWithoutGenerated.filter((row) => !isFlyscreenAllowanceQuoteRow(row) && !isWindowsQuotePlaceholderRow(row)), windowScheduleUnpricedRows, sectionName) }];
      }
      return [sectionName, { ...section, rows: withWindowScheduleUnpricedRows(windowRows.length ? insertRowsAfterSourceRow(rowsWithoutGenerated, windowRows, 750) : rowsWithoutGenerated, windowScheduleUnpricedRows, sectionName) }];
    }
    if (name === "doors" || name === "entrance doors") {
      const storedRows = (section.rows || []).filter((row) => !row.generatedWindowDoorQuoteRow);
      return [sectionName, { ...section, rows: [...storedRows, ...entranceDoorRows] }];
    }
    if (name === "garage doors - sectional panel lift") {
      return [sectionName, { ...section, rows: applyGarageDoorSelectionsToQuoteRows(section.rows || [], garageDoorRows) }];
    }
    return [sectionName, section];
  }));
}

function selectedWindowDoorQuoteRows(rows = [], customWindows = []) {
  return rows
    .filter((row) => number(row.quantity) > 0)
    .filter((row) => !isEntranceDoorWindowDoorRow(row))
    .map((row) => windowDoorQuoteRow(row, "WINDOWS", customWindows));
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
 
function isCustomWindow(row, customWindows) {
  // Check if this window matches any of the custom window entries
  const type = String(row.type || "").trim();
  const heightMm = number(row.heightMm);
  const widthMm = number(row.widthMm);
  const code = String(row.code || "").trim();
  
  const match = customWindows.find(custom => 
    String(custom.style || "").trim() === type &&
    number(custom.heightMm) === heightMm &&
    number(custom.widthMm) === widthMm &&
    String(custom.code || "").trim() === code
  );
  
  if (match) {
    // Return the quantityKey that would be used for this custom window
    // Using "CUSTOM_" prefix to avoid matching real price list rows
    return windowPriceListQuantityKey("window", `CUSTOM_${type}`, heightMm, widthMm);
  }
  return null;
}

function windowDoorQuoteRow(row, section = "WINDOWS", customWindows = []) {
  const quantity = number(row.quantity);
  const code = String(row.code || row.size || row.item || row.rawText || "Window/Door").trim();
  const type = String(row.type || "").trim();
  const level = String(row.level || "").trim();
  const customQuantityKey = isCustomWindow(row, customWindows);
  const isCustom = !!customQuantityKey;
  const rate = row.supplierQuote || row.rate || windowDoorApproximateRate(row) || row.excelRate || "";
  const rateSource = row.supplierQuote ? "supplier quote" : (row.sourceOfRate || windowDoorApproximateRateSource(row) || "windows/doors schedule");
  const sourceId = row.id || row.sourceRow || `${code}-${type}-${level}`;
  
  // For custom windows, create a custom description and use the custom quantityKey
  let item;
  let quantityKey = "";
  if (isCustom) {
    // Format: "CUSTOM {type} {height}H x {width}W"
    const heightMm = number(row.heightMm);
    const widthMm = number(row.widthMm);
    item = `CUSTOM ${type} ${heightMm}H x ${widthMm}W`;
    quantityKey = customQuantityKey;
  } else {
    item = [code, type, level].filter(Boolean).join(" - ");
    quantityKey = "";
  }
  
  return {
    id: `quote-window-door-${stableIdPart(sourceId)}`,
    section,
    item,
    quantity: String(quantity),
    importedQuantity: "",
    quantityKey: quantityKey,
    unit: "EACH",
    excelRate: isCustom ? "" : rate,  // Keep rate blank for custom windows so price is editable
    supplierCatalogueRate: "",
    quotedSupplierRate: "",
    manualRate: isCustom ? "" : "",   // Keep manual rate blank for custom windows
    supplierQuote: "",
    sourceOfRate: isCustom ? "custom window" : (rate ? rateSource : "rate missing"),
    active: true,
    generatedWindowDoorQuoteRow: true,
    windowDoorSourceId: row.id || "",
    windowDoorSourceRow: row.sourceRow || "",
    notes: row.supplierQuote ? "Imported from supplier quote on windows/doors schedule" : "Approximate initial estimate rate. Confirm with supplier quote.",
    values: [item, String(quantity), "", "EACH", "", isCustom ? "" : rate, ""],
    formulas: {},
  };
}

function isTakeoffWindowSyncQuoteRow(row) {
  return row?.source === "ai-plan-takeoff-window-schedule";
}

function isWindowsQuotePlaceholderRow(row) {
  return Number(row?.sourceRow || row?.excelRow || 0) === 750 || String(row?.item || "").trim().toUpperCase() === "WINDOWS QUOTE";
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
  "takeoffInternalDoorCount",
  "takeoffWindowCount",
  "takeoffRobeDoorCount",
  "quote180LineaBoardPlankQty",
  "roofAreaM2",
  "totalEavesLm",
  "quoteFrameSecondStoreyTrusses",
  "quoteFrameThirdStoreyTrusses",
  CEILING_BATTEN_QUANTITY_KEY,
]);

const HIDE_ZERO_LINKED_QUOTE_QTY_KEYS = new Set([
  "quoteFrameSecondStoreyTrusses",
  "quoteFrameThirdStoreyTrusses",
  "quoteFrameFloorJoistsThirdM2",
  "quoteFrameSheetFlooringThirdM2",
]);

// HARD-CODED row: PRE-FAB WALL FRAMES > 90mm INTERNAL WALL FRAMES.
// Whenever Job Setup's "Total Internal 90mm framed wall LM" (totalInternal90mmWallsLm) is above
// zero the section carries this row, its Qty bound to that exact field (see
// normalizedQuoteQuantityKey: quote-643 / the row label). A job or template whose section has lost
// the row gets it back here, placed after 70mm INTERNAL WALL FRAMES at the template rate; an
// existing row - by id or by label - is never duplicated, and nothing is added while the value is 0.
export const INTERNAL_90MM_WALL_FRAME_QUANTITY_KEY = "totalInternal90mmWallsLm";
const INTERNAL_90MM_WALL_FRAME_ROW_ID = "quote-643";
const INTERNAL_90MM_WALL_FRAME_ITEM = "90mm INTERNAL WALL FRAMES";
const INTERNAL_90MM_WALL_FRAME_RATE = "$52.00";
export function isInternal90mmWallFrameRow(row = {}) {
  const text = String(row?.item || row?.values?.[0] || "").toLowerCase().replace(/\s+/g, " ").trim();
  return String(row?.id || "") === INTERNAL_90MM_WALL_FRAME_ROW_ID || /^90 ?mm internal walls? frames?$/.test(text);
}
export function ensureInternal90mmWallFrameRow(quotation = {}, quantities = {}) {
  if (!(number(quantities?.[INTERNAL_90MM_WALL_FRAME_QUANTITY_KEY]) > 0)) return quotation;
  const sectionName = Object.keys(quotation || {}).find((name) => normalizedSectionName(name).replace(/\s*\(\d+\)\s*$/, "").trim() === "pre-fab wall frames");
  if (!sectionName) return quotation;
  if (Object.values(quotation).some((section) => (section?.rows || []).some(isInternal90mmWallFrameRow))) return quotation;
  const section = quotation[sectionName];
  const rows = section.rows || [];
  const after = rows.findIndex((row) => String(row?.id || "") === "quote-642" || /70 ?mm internal walls? frames?/i.test(String(row?.item || "")));
  const row = {
    id: INTERNAL_90MM_WALL_FRAME_ROW_ID, excelRow: 643, section: rows[0]?.section || sectionName,
    values: [INTERNAL_90MM_WALL_FRAME_ITEM, "", "", "LM", "", INTERNAL_90MM_WALL_FRAME_RATE, ""], formulas: {},
    item: INTERNAL_90MM_WALL_FRAME_ITEM, rawText: INTERNAL_90MM_WALL_FRAME_ITEM, quantity: "", importedQuantity: "",
    quantityKey: INTERNAL_90MM_WALL_FRAME_QUANTITY_KEY, unit: "LM", excelRate: INTERNAL_90MM_WALL_FRAME_RATE, manualRate: "",
    sourceOfRate: "workbook", importedCost: "", notes: "IMPORTED DATA", autoQuantity: true, quantityManualOverride: false,
  };
  const at = after >= 0 ? after + 1 : rows.length;
  return { ...quotation, [sectionName]: { ...section, rows: [...rows.slice(0, at), row, ...rows.slice(at)] } };
}

// HARD-CODED quantity source: Fix-out Stage Labour > INSTALL SKIRTING BOARDS is always the job's
// total skirting length in LM - skirtingLm, the sum of the Ground / Second / Third Level Skirting LM
// that Job Setup calculates from the takeoff's measured wall lengths. It is matched by the row's
// label inside that section (the row may have been added or renamed by hand, so it has no fixed
// id), recalculates with the takeoff, and gives way only to a quantity or formula the estimator
// enters through the normal Qty / Selection editing.
export const SKIRTING_TOTAL_QUANTITY_KEY = "skirtingLm";
export function isSkirtingInstallLabourRow(row = {}, sectionName = "") {
  const section = String(sectionName || "").toLowerCase().replace(/\s*\(\d+\)\s*$/, "").trim();
  if (section !== "fix-out stage labour") return false;
  const item = String(row?.item || row?.values?.[0] || "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!/^install skirting(s| boards?)?$/.test(item)) return false;
  if (row.quantityFormulaOverride) return false;
  // A typed quantity is the estimator's override; a blank left behind by an old edit is not.
  return !(row.quantityManualOverride === true && String(row.quantity ?? "").trim() !== "");
}

function isForcedLinkedQuantityKey(key, doorTakeoff) {
  // This labour row has an actual editable subtraction, not a purchasing-subtype count.
  if (key === DOOR_TAKEOFF_KEYS.singleDoorHang) return false;
  return FORCE_LINKED_QUOTE_QTY_KEYS.has(key) || Boolean(doorTakeoff?.forceLinkedKeys?.has(key));
}

function effectiveQuoteQuantityFormula(row, key) {
  if (row.quantityFormulaOverride) return row.formulas?.B || "0";
  if (key === DOOR_TAKEOFF_KEYS.singleDoorHang) return "internalDoors-cavityDoorQty";
  return row.formulas?.B || "";
}

function shouldHideZeroLinkedQuoteRow(row, quantityKey, qty) {
  if (!HIDE_ZERO_LINKED_QUOTE_QTY_KEYS.has(quantityKey)) return false;
  return !number(qty);
}

function buildQuoteRowFormulaValues(quotation, quantities, doorTakeoff = null) {
  const values = {};
  const rows = Object.values(quotation || {}).flatMap((section) => section?.rows || []);
  rows.forEach((row) => {
    const rowNumber = row.excelRow || row.sourceRow;
    if (!rowNumber) return;
    const quantityKey = doorTakeoffQuantityKey(row, row.section, doorTakeoff) ?? normalizedQuoteQuantityKey(row);
    const userEntered = isUserEnteredQuoteQuantity(row, { forceLinked: !row.quantityFormulaOverride && !row.quantityManualOverride && isForcedLinkedQuantityKey(quantityKey, doorTakeoff) });
    values[`B${rowNumber}`] = resolveQuoteRowQuantity({
      userEntered,
      manualQuantity: userEntered ? quoteQuantityValue(row.quantity, quantities) : 0,
      linkedQuantity: number(quantities[quantityKey]),
    });
  });
  for (let pass = 0; pass < 5; pass += 1) {
    let changed = false;
    // Built once per pass and kept in step with every write to values below, so each row
    // still sees the values written by earlier rows in the same pass (as the per-row
    // { ...quantities, ...values } spread did) without copying the lookup for every row.
    const lookup = { ...quantities, ...values };
    rows.forEach((row) => {
      const rowNumber = row.excelRow || row.sourceRow;
      if (!rowNumber) return;
      const passKey = doorTakeoffQuantityKey(row, row.section, doorTakeoff) ?? normalizedQuoteQuantityKey(row);
      const forced = !row.quantityFormulaOverride && !row.quantityManualOverride && isForcedLinkedQuantityKey(passKey, doorTakeoff);
      if (forced || isUserEnteredQuoteQuantity(row) || (!row.quantityFormulaOverride && isFloorSystemQuoteQuantityKey(passKey))) return;
      const formula = effectiveQuoteQuantityFormula(row, passKey);
      if (!formula) return;
      const calculated = quoteFormulaQuantity({ formulas: { B: formula } }, lookup);
      const formulaQty = row.quantityFormulaOverride || passKey === DOOR_TAKEOFF_KEYS.singleDoorHang || !passKey || calculated
        ? calculated : number(quantities[passKey]);
      if (values[`B${rowNumber}`] === formulaQty) return;
      values[`B${rowNumber}`] = formulaQty;
      lookup[`B${rowNumber}`] = formulaQty;
      changed = true;
    });
    if (!changed) break;
  }
  return values;
}

function quoteFormulaQuantity(row, quoteRowValues) {
  const formula = row?.formulas?.B || "";
  if (!formula) return 0;
  const result = Object.hasOwn(quoteRowValues, formula) ? Number(quoteRowValues[formula]) : evaluateFormula(formula, quoteRowValues);
  return Number.isFinite(result) ? round(Math.max(0, result)) : 0;
}

// Who owns a quotation row's quantity. The user owns it when they have edited it
// (quantityManualOverride), or when it is a plain manual row (no Takeoff link, not generated) with
// a quantity typed in. A linked or generated row that has not been overridden is Takeoff/formula
// driven. Forced-linked rows (e.g. brick order quantities) are always Takeoff driven.
function isUserEnteredQuoteQuantity(row = {}, { forceLinked = false } = {}) {
  if (row.quantityManualOverride === true) return true;
  if (row.quantityFormulaOverride || forceLinked || isRow150CavitySliderQtyImport(row)) return false;
  const linked = Boolean(normalizedQuoteQuantityKey(row)) || row.autoQuantity;
  return !linked && hasManualQuantity(row);
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
    quoteFaceBricksBaseRange: "faceBrickOrderEach / 1000",
    quoteCommonSingleHeights: "renderedSingleOrderEach / 1000",
    quoteCommonTwinHeights: "renderedTwinOrderEach / 1000",
    quoteBrickSillBricks: "(brickVeneerSillsLm / 0.085) / 1000",
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
  // FIX OUT architrave sets: one set per opening, counted from the Takeoff (takeoffOpeningCounts).
  // Matched by stable row identity before the no-imported-data rule that covers rows 1357-1362.
  const archKey = TAKEOFF_ARCH_QUOTE_KEYS[String(row?.id || "")] || TAKEOFF_ARCH_QUOTE_KEYS[`quote-${quoteRowSourceNumber(row)}`];
  if (archKey) return archKey;
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
  if (normalizedSectionName(row?.section) === "plasterer - supply and install" && (String(row?.id || "") === "quote-1269" || quoteRowSourceNumber(row) === 1269 || text.includes("gyprock supply & fix - exterior walls"))) return "totalExternalPlasterboardWallM2";
  if (normalizedSectionName(row?.section) === "plasterer - supply and install" && (String(row?.id || "") === "quote-1270" || quoteRowSourceNumber(row) === 1270 || text.includes("gyprock supply & fix - internal walls"))) return "totalInternalPlasterboardWallM2";
  if (normalizedSectionName(row?.section) === "frame stage labour" && text.includes("install windows")) return "quoteFrameInstallWindows";
  if (normalizedSectionName(row?.section) === "frame stage labour" && text.includes("second storey windows")) return "quoteFrameSecondStoreyWindows";
  if (normalizedSectionName(row?.section) === "frame stage labour" && text.includes("third storey windows")) return "quoteFrameThirdStoreyWindows";
  // sourceRow 82's own text is used elsewhere unambiguously ("porch/verandah roof & ceiling
  // framework" is a unique phrase), so this could be a text match too, but keying off the row
  // number matches the pattern used for the two rows below whose text is ambiguous.
  if (normalizedSectionName(row?.section) === "frame stage labour" && quoteRowSourceNumber(row) === 82) return "quoteFramePorchVerandahFrameworkM2";
  // sourceRow 68's text ("EXTRA COST FOR 2.7m WALLS") is unambiguous, but is matched by row number
  // for consistency and to avoid ever also matching sourceRow 69, "EXTRA COST FOR 3.0m WALLS".
  if (normalizedSectionName(row?.section) === "frame stage labour" && quoteRowSourceNumber(row) === 68) return "quoteFrameExtraCost27mWallsM2";
  // sourceRow 100, "CHIPPY HIGHT SET ALLOWANCE" - this is the existing catalogue's own HIGHSET
  // ALLOWANCE rate ($500 ITEM); matched by row number since "hight set"/"highset" is not otherwise
  // distinctive text to key off.
  if (normalizedSectionName(row?.section) === "frame stage labour" && quoteRowSourceNumber(row) === 100) return "quoteFrameHighsetAllowance";
  // A brand-new "INSTALL CAVITY CAGES" row (see frameStageCavityCagesRow() in
  // estimateBuilderWorkbookDefaults.js) carries this key directly; matching by text here as well
  // means a line with this text added manually to an existing job (via the ordinary "Add line"
  // button) also picks up the same automatic quantity, without needing that job's saved data migrated.
  if (normalizedSectionName(row?.section) === "frame stage labour" && text.includes("install cavity cages")) return "totalCavitySliderCagesEach";
  // Brand-new "ROBE DOORS" / "LINEN DOORS" rows (see frameStageRobeDoorsRow()/frameStageLinenDoorsRow()
  // in estimateBuilderWorkbookDefaults.js) carry these keys directly; matched by text as well, same
  // reasoning as cavity cages above. The two counts are never combined - each keys to its own field.
  if (normalizedSectionName(row?.section) === "frame stage labour" && text.includes("robe doors")) return "robeDoorCount";
  if (normalizedSectionName(row?.section) === "frame stage labour" && text.includes("linen doors")) return "linenDoorCount";
  // TIE DOWN: the imported catalogue carries TWO separate legacy row groups under this one section
  // name (sourceRow 577-585, built around "CYCLONE RODS 2.7m"; and 703-710, built around "CYCLONE
  // RODS 3.0m") - CONNECTOR NUTS/SQ WASHERS/NUTS/CHEMSET each exist as two distinct rows as a
  // result, so every match here MUST be by section + exact sourceRow, never by text alone (the
  // same "ADD FOR SECOND STOREY" reasoning as lock-up stage labour's row 117 above) - text-matching
  // would hit both rows of a pair and double the cost. Confirmed with the business which row of
  // each pair to automate; the other (579/582/583/585) is intentionally left untouched/manual.
  // CEILING BATTENS, first row (sourceRow 588 "METAL 6M"). The section holds a second "METAL 6M"
  // (sourceRow 719), so this is matched by section + row number, never by text.
  if (normalizedSectionName(row?.section) === "ceiling battens" && quoteRowSourceNumber(row) === 588) return CEILING_BATTEN_QUANTITY_KEY;
  if (normalizedSectionName(row?.section) === "tie down" && quoteRowSourceNumber(row) === 703) return "tieDownGroundCycloneRods";
  if (normalizedSectionName(row?.section) === "tie down" && quoteRowSourceNumber(row) === 577) return "tieDownUpperCycloneRods";
  if (normalizedSectionName(row?.section) === "tie down" && quoteRowSourceNumber(row) === 705) return "tieDownConnectorNuts";
  if (normalizedSectionName(row?.section) === "tie down" && quoteRowSourceNumber(row) === 710) return "tieDownChemset";
  if (normalizedSectionName(row?.section) === "tie down" && quoteRowSourceNumber(row) === 707) return "tieDownSqWashersAndNuts";
  if (normalizedSectionName(row?.section) === "tie down" && quoteRowSourceNumber(row) === 708) return "tieDownSqWashersAndNuts";
  // sourceRow 117, "ADD FOR SECOND STOREY", sits directly under the two "LINE EAVES" rows and is
  // the eaves second-storey surcharge - its own text is genuinely ambiguous (an unrelated
  // "ADD FOR SECOND STOREY" also exists under ROOFING LABOUR, sourceRow 834, a flat $1,800 item),
  // so this MUST be matched by section + row number, never by text alone.
  if (normalizedSectionName(row?.section) === "lock-up stage labour" && quoteRowSourceNumber(row) === 117) return "upperEavesLm";
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
  if (normalizedSectionName(row?.section) === "external cladding" && text.includes("180mm jh linea board planks")) return "quote180LineaBoardPlankQty";
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
  // sourceRow 82, "PORCH/VERANDAH ROOF & CEILING FRAMEWORK", is in the forced-blank list below by
  // its own text (its legacy Excel quantity formula can never evaluate - see quoteFramePorchVerandahFrameworkM2
  // above) - exempted so its new automatic alfresco+porch+balcony quantity can actually display.
  if (quoteRowSourceNumber(row) === 82) return false;
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

function applyMeasuredTakeoffQuantities(q, workbook) {
  const rows = workbook.data?.inputDataSheet?.rows || {};
  const measured = (key) => rows[key]?.value !== '' && rows[key]?.value !== null && rows[key]?.value !== undefined;
  for (const [key, row] of Object.entries(rows)) {
    if (measured(key) && /(?:PatioAreaM2|ExternalWallsLm|GrossWallM2|NetWallM2|OpeningM2|OpeningsAreaM2|OpeningAreaM2|StockLengthsEach|InternalWallGrossPlasterboardM2|InternalWallNetPlasterboardM2|brickVeneerSillsLm)$/.test(key)) q[key] = number(row.value);
  }
  q.patioAreaM2 = number(q.lowerPatioAreaM2) + number(q.upperPatioAreaM2) + number(q.thirdPatioAreaM2);
  let hasGeometry = false;
  for (const prefix of ['lower', 'upper', 'third']) {
    const systems = Object.keys(EXTERIOR_WALL_SYSTEM_FIELD_KEYS);
    if (systems.some((system) => measured(`${prefix}${system}NetWallM2`))) {
      hasGeometry = true;
      q[`${prefix}ExternalWallAreaM2`] = round(systems.reduce((sum, system) => sum + number(q[`${prefix}${system}GrossWallM2`]), 0));
      q[`${prefix}NetExternalWallAreaM2`] = round(systems.reduce((sum, system) => sum + number(q[`${prefix}${system}NetWallM2`]), 0));
      q[`${prefix}ExternalPlasterboardWallM2`] = q[`${prefix}NetExternalWallAreaM2`];
      q[`${prefix}WindowDoorDeductionsM2`] = round(systems.reduce((sum, system) => sum + number(q[`${prefix}${system}OpeningM2`]), 0));
    }
    if (measured(`${prefix}ExternalOpeningAreaM2`)) q[`${prefix}WindowDoorDeductionsM2`] = q[`${prefix}ExternalOpeningAreaM2`];
    if (measured(`${prefix}InternalWallNetPlasterboardM2`)) {
      q[`${prefix}InternalPlasterboardWallM2`] = q[`${prefix}InternalWallNetPlasterboardM2`];
      q[`${prefix}PlasterboardWallM2`] = round(q[`${prefix}InternalPlasterboardWallM2`] + number(q[`${prefix}ExternalPlasterboardWallM2`]));
    }
  }
  if (hasGeometry) {
    q.externalPlasterboardWallM2 = round(['lower', 'upper', 'third'].reduce((sum, prefix) => sum + number(q[`${prefix}ExternalPlasterboardWallM2`]), 0));
    const total = (suffix) => roundTo(['lower', 'upper', 'third'].reduce((n, prefix) => n + number(q[`${prefix}${suffix}`]), 0), 4);
    q.faceBrickNetM2 = total('BrickVeneerNetWallM2');
    // Both rendered systems order rendered bricks. Keeping them summed here leaves every existing
    // job's brick order identical - no saved wall can be Rendered Brick Veneer, because the class
    // did not exist - while a newly classified rendered brick wall orders exactly what a rendered
    // wall always did. Splitting which of the two actually produces bricks is a pricing decision,
    // not a classification one.
    q.renderedNetM2 = roundTo(total('RenderedMasonryNetWallM2') + total('RenderedBrickVeneerNetWallM2'), 4);
    Object.assign(q, brickOrderQuantities(q.faceBrickNetM2, q.renderedNetM2));
    q.netExternalWallAreaM2 = total('NetExternalWallAreaM2');
    q.totalExternalWallAreaM2 = total('ExternalWallAreaM2');
    q.windowDoorDeductionsM2 = total('WindowDoorDeductionsM2');
    q.brickVeneerAreaM2 = q.faceBrickNetM2;
    q.faceBrickBrickVeneerAreaM2 = q.faceBrickNetM2;
    q.renderedBrickVeneerAreaM2 = q.renderedNetM2;
    q.lightweightCladdingAreaM2 = total('LightweightCladdingNetWallM2');
    q.brickworkAreaM2 = round(q.faceBrickNetM2 + q.renderedNetM2);
    q.lowerBrickworkAreaM2 = number(q.lowerBrickVeneerNetWallM2) + number(q.lowerRenderedMasonryNetWallM2) + number(q.lowerRenderedBrickVeneerNetWallM2);
    // Existing quotation brick rates are per thousand. Keep their units and exact order equivalents.
    q.quoteFaceBricksBaseRange = q.faceBrickOrderEach / 1000;
    q.quoteCommonTwinHeights = q.renderedTwinOrderEach / 1000;
    q.quoteCommonSingleHeights = q.renderedSingleOrderEach / 1000;
    q.lockupSingleHeightBricks = (q.faceBrickOrderEach + q.renderedSingleOrderEach) / 1000;
    q.lockupTwinHeightBricks = q.renderedTwinOrderEach / 1000;
    q.quoteBricklayerFaceBricks = q.quoteFaceBricksBaseRange;
    q.quoteBricklayerSingleHeight = q.quoteCommonSingleHeights;
    q.quoteBricklayerDoubleHeights = q.quoteCommonTwinHeights;
    q.lockupFaceRenderM2 = q.renderedNetM2;
    q.quoteRenderingNetWallAreaM2 = q.renderedNetM2;
  }
  if (measured('brickVeneerSillsLm')) {
    q.lockupBrickSillsLm = q.brickVeneerSillsLm;
    q.quoteBricklayerSillsLm = q.brickVeneerSillsLm;
    q.quoteBrickSillBricks = roundTo(q.brickVeneerSillsLm / 0.085 / 1000, 3);
  }
  if (hasGeometry || ['lower', 'upper', 'third'].some((prefix) => measured(`${prefix}InternalWallNetPlasterboardM2`))) {
    for (const prefix of ['lower', 'upper', 'third']) q[`${prefix}PlasterboardWallM2`] = round(number(q[`${prefix}InternalPlasterboardWallM2`]) + number(q[`${prefix}ExternalPlasterboardWallM2`]));
    q.internalPlasterboardWallM2 = round(['lower', 'upper', 'third'].reduce((sum, prefix) => sum + number(q[`${prefix}InternalPlasterboardWallM2`]), 0));
    q.plasterboardWallM2 = round(q.internalPlasterboardWallM2 + q.externalPlasterboardWallM2);
    q.totalPlasterboardM2 = round(q.plasterboardWallM2 + q.groundFloorCeilingsM2 + q.secondFloorCeilingsM2 + q.thirdFloorCeilingsM2);
  }
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
  if (key === "thirdLevelFloorAreaM2" && savedFormula === "ThirdLevelFloorAreaM2 + ThirdLevelGarageAreaM2 + ThirdLevelAlfrescoAreaM2 + ThirdLevelPorchAreaM2 + ThirdLevelOtherAreaM2 + ThirdLevelBalconyAreaM2") return defaultFormula;
  if (key === "secondLevelFloorAreaM2" && savedFormula === "SecondLevelFloorAreaM2 + SecondLevelGarageAreaM2 + SecondLevelAlfrescoAreaM2 + SecondLevelPorchAreaM2 + SecondLevelOtherAreaM2 + SecondLevelBalconyAreaM2") return defaultFormula;
  if (key === "lowerSlabAreaM2" && savedFormula === "GroundLevelFloorAreaM2 + GroundLevelGarageAreaM2 + GroundLevelAlfrescoAreaM2 + GroundLevelPorchAreaM2 + GroundLevelOtherAreaM2") return defaultFormula;
  if (/WallPlatesNoggins90mmInternalLm$/.test(key) && /^\w+Internal90mmWallsLm \* 4$/.test(String(savedFormula || ""))) return defaultFormula;
  if (key === "studs90mmEach" && savedFormula === "((TotalExternal90mmFramedWallLm / 0.45) * 1.15) + ((TotalInternal90mmFramedWallLm / 0.45) * 1.20)") return defaultFormula;
  if (/StudMaterial90mmInternalLm$/.test(key) && /Internal90mmWallsLm \/ 0.45 \* 1.20/.test(String(savedFormula || ""))) return defaultFormula;
  // These four repair a saved formula that predates the floor-thickness term (Item 78/79 and their
  // "bulk" siblings used elsewhere): a level's external wall area must add its floor build-up depth
  // to ceiling height, not ceiling height alone. Moved here, above the unconditional "any saved
  // formula wins" return just below - left where they originally sat (further down this function),
  // that return short-circuits before they are ever reached, so a workbook carrying this exact stale
  // formula (as most saved workbooks do, since one is written for every key by default) keeps
  // recomputing the wrong, floor-depth-less area on every load no matter how the default formula
  // above is written.
  if (key === "upperExternalWallAreaM2" && (
    String(savedFormula || "").includes("+ 0.3") ||
    savedFormula === "upperExternalWallsLm * upperCeilingHeight"
  )) return defaultFormula;
  if (key === "thirdExternalWallAreaM2" && (
    String(savedFormula || "").includes("+ 0.3") ||
    savedFormula === "thirdExternalWallsLm * thirdCeilingHeight"
  )) return defaultFormula;
  if (key === "upperBulkExternalWallAreaM2" && String(savedFormula || "").includes("+ 0.3")) return defaultFormula;
  if (key === "thirdBulkExternalWallAreaM2" && String(savedFormula || "").includes("+ 0.3")) return defaultFormula;
  if (savedFormula !== undefined && savedFormula !== null) return String(savedFormula).trim();
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
  // upperExternalWallAreaM2 / thirdExternalWallAreaM2 / upperBulkExternalWallAreaM2 /
  // thirdBulkExternalWallAreaM2's own stale-formula repair now runs earlier in this function,
  // above the "any saved formula wins" return - this used to be their only copy, but that return
  // meant they never ran for a workbook that actually had a saved formula to repair.
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
  "totalPlasterboardM2",
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
  // Items 88/89's own net-wall-area formula ("...ExternalWallAreaM2 - ...WindowDoorAreaM2")
  // resolves this alias at evaluation time - it must point at the canonical, Window-Schedule-
  // sourced deduction (lowerWindowDoorDeductionsM2, fixed in the quantities object above to prefer
  // the Takeoff-imported opening area) rather than lowerWindowDoorAreaM2, which stays the separate,
  // manually-keyed Windows & Doors sheet total with no connection to the Takeoff.
  GroundLevelWindowDoorAreaM2: "lowerWindowDoorDeductionsM2",
  SecondLevelWindowDoorAreaM2: "upperWindowDoorDeductionsM2",
  ThirdLevelWindowDoorAreaM2: "thirdWindowDoorDeductionsM2",
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
  GroundFloorCeilingsM2: "groundFloorCeilingsM2",
  SecondFloorCeilingsM2: "secondFloorCeilingsM2",
  ThirdFloorCeilingsM2: "thirdFloorCeilingsM2",
  TotalCeilingAreasM2: "totalCeilingAreasM2",
  TotalPlasterboardWallM2: "plasterboardWallM2",
  TotalPlasterboardM2: "totalPlasterboardM2",
  GroundLevelSkirtingLm: "lowerSkirtingLm",
  SecondLevelSkirtingLm: "upperSkirtingLm",
  ThirdLevelSkirtingLm: "thirdSkirtingLm",
};

function cosDegrees(degrees) {
  return Math.cos((Number(degrees) || 0) * Math.PI / 180);
}

function finalRate(row) {
  if (row.selectionSource) return { rate: row.activeUnitPrice ?? '', source: row.selectionSource };
  if (row.supplierQuote) return { rate: row.supplierQuote, source: "supplier quote" };
  if (row.manualRate) return { rate: row.manualRate, source: "manual" };
  if (row.sourceOfRate === "manual") return { rate: "", source: "manual" };
  if (row.source === "client-selections-flooring" && row.flooringType === "carpet") return { rate: row.excelRate ?? "", source: row.carpetCosts?.supplierQuote ? "Retailer quote (allocated total)" : "Internal carpet allowance" };
  if (row.generatedFlyscreenQuoteRow) return { rate: row.excelRate, source: row.sourceOfRate || "10% of selected windows/doors" };
  if (row.generatedWindowDoorQuoteRow && String(row.sourceOfRate || "").startsWith("approx ")) return { rate: row.excelRate, source: row.sourceOfRate };
  if (row.quotedSupplierRate) return { rate: row.quotedSupplierRate, source: "quoted supplier" };
  if (row.productLibraryTakeoffRow) return { rate: row.supplierCatalogueRate ?? row.excelRate ?? "", source: row.quoteRequired ? "PRODUCT / PRICE REQUIRED" : "Product Library" };
  if (row.entryDoorLibraryRow) return { rate: row.supplierCatalogueRate ?? row.excelRate ?? "", source: row.quoteRequired ? "Quote required" : "Product Library" };
  if (row.supplierCatalogueRate) return { rate: row.supplierCatalogueRate, source: "supplier catalogue" };
  if (row.excelRate) return { rate: row.excelRate, source: "workbook" };
  return { rate: "", source: "rate missing" };
}

function missingRequired(workbook) {
  return V4_REQUIRED_FIELDS.filter(([section, key]) => raw(workbook, section, key) === "" || number(raw(workbook, section, key)) === 0).map(([section, key]) => ({ section, key }));
}

function value(workbook, section, key) { return number(raw(workbook, section, key)); }
// Stair flights between consecutive included levels, read from Job Setup: the lower level's
// ceiling height (stored in metres or millimetres) and the upper level's floor system thickness
// (e.g. "319mm Timber Floor System ..."; a blank floor system uses the same default the rest of
// the estimate uses, and says so).
const STAIR_LEVELS = [
  { key: "lower", label: "Ground Level" },
  { key: "upper", label: "Second Level" },
  { key: "third", label: "Third Level" },
];
export function stairFlightsFromJobSetup(workbook = {}) {
  const levelCount = floorCountToLevels(raw(workbook, "projectSetup", "floorCount"));
  const stored = (key) => {
    for (const section of Object.values(workbook.data || {})) {
      const value = section?.rows?.[key]?.value;
      if (value !== undefined && value !== null && value !== "") return value;
    }
    return "";
  };
  const levels = STAIR_LEVELS.slice(0, levelCount).map((level) => {
    const ceiling = number(stored(`${level.key}CeilingHeight`));
    const floorStored = stored(`${level.key}FloorDepthMm`);
    const floorSystem = floorStored === "" ? floorSystemDefaultValue(`${level.key}FloorDepthMm`) : String(floorStored);
    return {
      ...level,
      ceilingHeightMm: ceiling > 0 ? (ceiling > 20 ? ceiling : Math.round(ceiling * 1000)) : null,
      ceilingSource: ceiling > 0 ? "Imported from Job Setup" : "Not set in Job Setup",
      ceilingFieldKey: `${level.key}CeilingHeight`,
      floorThicknessMm: number(floorSystem) || null,
      floorSource: floorStored === "" ? (floorSystem ? "Job Setup default floor system" : "Not set in Job Setup") : "Imported from Job Setup",
      floorFieldKey: `${level.key}FloorDepthMm`,
      floorSystem,
    };
  });
  return stairFlightsFromLevels(levels);
}

function stairQuantities(workbook = {}) {
  const prefix = { "lower-upper": "stairLowerToUpper", "upper-third": "stairUpperToThird" };
  return Object.fromEntries(stairFlightsFromJobSetup(workbook).flatMap((flight) => {
    const resolved = resolveStairFlight(flight);
    const name = prefix[flight.flightKey];
    if (!name || !resolved.complete) return [];
    return [[`${name}FloorToFloorMm`, resolved.floorToFloorMm], [`${name}RiserCount`, resolved.riserCount], [`${name}RiserHeightMm`, round(resolved.actualRiserHeightMm)]];
  }));
}

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
