import { calculateWindowDoorSchedule } from "./windowDoorCalculations.js";

export function calculateWorksheetV2Areas(worksheet) {
  const get = (section, key) => valueOf(worksheet, section, key);
  const windowDoor = calculateWindowDoorSchedule(worksheet.windowsDoors || []);
  const storeys = get("projectBasics", "storeys") || 1;
  const ground = get("areas", "groundFloorM2");
  const first = get("areas", "firstFloorM2");
  const second = get("areas", "secondFloorM2");
  const garage = get("areas", "garageM2");
  const alfresco = get("areas", "alfrescoM2");
  const porch = get("areas", "porchM2");
  const balcony = get("areas", "balconyM2");
  const totalFloorAreaM2 = round(ground + first + second + garage + alfresco + porch + balcony);
  const wallHeight = get("exteriorWalls", "wallHeightM") || 2.7;
  const externalWallLm = get("exteriorWalls", "externalWallLm") || Math.sqrt(Math.max(ground, 1)) * 4 * storeys;
  const grossExternalWallM2 = round(externalWallLm * wallHeight);
  const externalOpeningAreaM2 = windowDoor.totals.windowDoorAreaM2;
  const netExternalWallM2 = round(Math.max(0, grossExternalWallM2 - externalOpeningAreaM2));
  const internalWallLm = get("interiorWalls", "internalWallLm");
  const internalWallHeight = get("interiorWalls", "internalWallHeightM") || 2.7;
  const internalWallAreaM2 = round(internalWallLm * internalWallHeight * 2);
  const roofPitch = get("roof", "roofPitchDegrees") || 22.5;
  const roofPlanAreaM2 = get("roof", "roofPlanAreaM2") || ground + garage + alfresco + porch;
  const roofAreaM2 = round(roofPlanAreaM2 / Math.cos((roofPitch * Math.PI) / 180));
  const slabAreaM2 = round(ground + garage + alfresco + porch);
  const corniceLm = round(internalWallLm + externalWallLm);
  const skirtingLm = round(internalWallLm + externalWallLm - windowDoor.totals.itemCount * 0.8);
  const architraveLm = windowDoor.totals.architraveLengthLm + get("fixout", "internalDoorCount") * 5.4 * 2;

  return {
    windowDoor,
    calculated: {
      totalFloorAreaM2,
      grossExternalWallM2,
      externalOpeningAreaM2,
      netExternalWallM2,
      internalWallAreaM2,
      slabAreaM2,
      roofAreaM2,
      roofInsulationM2: roofAreaM2,
      sarkingM2: roofAreaM2,
      plasterboardWallM2: round(internalWallAreaM2 + netExternalWallM2),
      ceilingM2: round(ground + first + second),
      corniceLm,
      insulationM2: round(netExternalWallM2 + roofAreaM2),
      internalPaintM2: round(internalWallAreaM2 + ground + first + second),
      externalPaintM2: netExternalWallM2,
      skirtingLm,
      architraveLm: round(architraveLm),
    },
  };
}

export function valueOf(worksheet, section, key) {
  const row = worksheet?.sections?.[section]?.rows?.[key];
  if (!row) return 0;
  if (row.builderOverrideQuantity !== "" && row.builderOverrideQuantity !== null && row.builderOverrideQuantity !== undefined) {
    return number(row.builderOverrideQuantity);
  }
  return number(row.inputValue);
}

function number(value) {
  if (typeof value === "boolean") return value ? 1 : 0;
  return Number(value) || 0;
}

function round(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}
