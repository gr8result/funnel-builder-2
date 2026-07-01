import { V3_REQUIRED_FIELDS } from "./estimateWorksheetV3Schema.js";

export function calculateEstimateWorksheetV3(worksheet) {
  const wd = calculateWindowDoorsV3(worksheet.windowsDoors);
  const get = (section, key) => number(rowValue(worksheet, section, key));
  const lowerExt = get("externalWalls", "lowerExternalWallsLm");
  const upperExt = get("externalWalls", "upperExternalWallsLm");
  const lowerInt = get("internalWalls", "lowerInternalWallsLm");
  const upperInt = get("internalWalls", "upperInternalWallsLm");
  const lowerHeight = get("externalWalls", "lowerCeilingHeight") || 2.7;
  const upperHeight = get("externalWalls", "upperCeilingHeight");
  const lowerWallArea = round(lowerExt * lowerHeight);
  const upperWallArea = round(upperExt * upperHeight);
  const totalWallArea = round(lowerWallArea + upperWallArea);
  const netExternalWallArea = round(Math.max(0, totalWallArea - wd.totals.totalArea));
  const lowerSystem = rowValue(worksheet, "externalWalls", "lowerWallSystem");
  const upperSystem = rowValue(worksheet, "externalWalls", "upperWallSystem");
  const lowerFloor = get("areas", "lowerFloorAreaM2");
  const upperFloor = get("areas", "upperFloorAreaM2");
  const garage = get("areas", "garageAreaM2");
  const alfresco = get("areas", "alfrescoAreaM2");
  const porch = get("areas", "porchAreaM2");
  const balcony = get("areas", "balconyAreaM2");
  const totalFloor = round(lowerFloor + upperFloor + garage + alfresco + porch + balcony);
  const roofPlan = get("slabRoofLinings", "roofPlanAreaM2") || lowerFloor + garage + alfresco + porch;
  const pitch = get("slabRoofLinings", "roofPitchDegrees") || 22.5;
  const roofArea = round(roofPlan / Math.cos((pitch * Math.PI) / 180));
  const totalInternalWalls = round(lowerInt + upperInt);
  const plasterboardWallArea = round((lowerInt * lowerHeight + upperInt * (upperHeight || lowerHeight)) * 2);
  const ceilingArea = round(lowerFloor + upperFloor);
  const cornice = round(totalInternalWalls + lowerExt + upperExt);
  const internalDoors = get("fixtures", "internalDoors");
  const architrave = round(wd.totals.architraveLength + internalDoors * 5.4 * 2);

  const calculated = {
    totalExternalWallsLm: round(lowerExt + upperExt),
    lowerWallAreaM2: lowerWallArea,
    upperWallAreaM2: upperWallArea,
    totalWallAreaM2: totalWallArea,
    windowDoorDeductionsM2: wd.totals.totalArea,
    netExternalWallAreaM2: netExternalWallArea,
    brickworkAreaM2: lowerSystem === "Brick Veneer" || lowerSystem === "Blockwork" ? lowerWallArea : 0,
    upperCladdingAreaM2: isCladding(upperSystem) ? upperWallArea : 0,
    totalInternalWallsLm: totalInternalWalls,
    plasterboardWallAreaM2: plasterboardWallArea,
    totalFloorAreaM2: totalFloor,
    slabAreaM2: round(lowerFloor + garage + alfresco + porch),
    roofAreaM2: roofArea,
    ceilingAreaM2: ceilingArea,
    corniceLm: cornice,
    skirtingLm: round(totalInternalWalls + lowerExt + upperExt - wd.totals.itemCount * 0.8),
    architraveLm: architrave,
    revealLm: wd.totals.revealLength,
    roofInsulationM2: roofArea,
    sarkingM2: roofArea,
    insulationM2: round(netExternalWallArea + roofArea),
    internalPaintM2: round(plasterboardWallArea + ceilingArea),
    externalPaintM2: netExternalWallArea,
  };

  return {
    windowDoors: wd,
    calculated,
    missingRequired: missingRequired(worksheet),
    finalQuantities: buildFinalQuantities(worksheet, calculated),
    quotation: buildQuotationPreview(worksheet, calculated, wd),
  };
}

export function calculateWindowDoorsV3(rows = []) {
  const calculatedRows = rows.map((row) => {
    const quantity = number(row.quantity);
    const width = number(row.width);
    const height = number(row.height);
    const area = round(width * height);
    const totalArea = round(area * quantity);
    const sillLength = isWindow(row.type) ? round(width * quantity) : 0;
    const headLength = round(width * quantity);
    const jambLength = round(height * 2 * quantity);
    const revealLength = round((width + height * 2) * quantity);
    const architraveLength = isDoor(row.type) ? round(quantity * 5.4 * 2) : revealLength;
    return { ...row, quantity, width, height, area, totalArea, headLength, sillLength, jambLength, revealLength, architraveLength };
  });
  return {
    rows: calculatedRows,
    totals: {
      totalArea: round(sum(calculatedRows, "totalArea")),
      headLength: round(sum(calculatedRows, "headLength")),
      sillLength: round(sum(calculatedRows, "sillLength")),
      jambLength: round(sum(calculatedRows, "jambLength")),
      revealLength: round(sum(calculatedRows, "revealLength")),
      architraveLength: round(sum(calculatedRows, "architraveLength")),
      itemCount: calculatedRows.reduce((total, row) => total + number(row.quantity), 0),
    },
  };
}

function buildFinalQuantities(worksheet, calculated) {
  const output = {};
  Object.entries(worksheet.sections).forEach(([sectionKey, section]) => {
    Object.entries(section.rows).forEach(([rowKey, row]) => {
      const calc = calculated[rowKey] ?? "";
      output[rowKey] = row.builderOverrideQuantity !== "" ? row.builderOverrideQuantity : calc !== "" ? calc : row.inputValue;
    });
  });
  return output;
}

function buildQuotationPreview(worksheet, calculated, wd) {
  return Object.fromEntries(Object.entries(worksheet.quotation).map(([section, group]) => {
    const rows = group.rows.map((row) => {
      const quantity = row.quantity !== "" ? row.quantity : suggestedQuotationQuantity(section, row.item, calculated, wd);
      return { ...row, quantity, cost: "" };
    });
    return [section, { ...group, rows, subtotal: "" }];
  }));
}

function suggestedQuotationQuantity(section, item, calculated, wd) {
  const text = `${section} ${item}`.toLowerCase();
  if (text.includes("window") || text.includes("door")) return wd.totals.totalArea;
  if (text.includes("reveal")) return wd.totals.revealLength;
  if (text.includes("sill")) return wd.totals.sillLength;
  if (text.includes("slab")) return calculated.slabAreaM2;
  if (text.includes("concrete")) return calculated.slabAreaM2;
  if (text.includes("brick")) return calculated.brickworkAreaM2;
  if (text.includes("cladding")) return calculated.upperCladdingAreaM2;
  if (text.includes("roof")) return calculated.roofAreaM2;
  if (text.includes("plasterboard") || text.includes("wall")) return calculated.plasterboardWallAreaM2;
  if (text.includes("ceiling")) return calculated.ceilingAreaM2;
  if (text.includes("cornice")) return calculated.corniceLm;
  if (text.includes("skirting")) return calculated.skirtingLm;
  if (text.includes("architrave")) return calculated.architraveLm;
  if (text.includes("paint")) return calculated.internalPaintM2;
  return "";
}

function missingRequired(worksheet) {
  return V3_REQUIRED_FIELDS
    .filter(([section, key]) => rowValue(worksheet, section, key) === "" || Number(rowValue(worksheet, section, key)) === 0)
    .map(([section, key]) => ({ section, key }));
}

function rowValue(worksheet, section, key) {
  const row = worksheet.sections?.[section]?.rows?.[key];
  if (!row) return "";
  return row.builderOverrideQuantity !== "" ? row.builderOverrideQuantity : row.inputValue;
}

function isWindow(type) {
  return String(type || "").toLowerCase().includes("window");
}

function isDoor(type) {
  return String(type || "").toLowerCase().includes("door");
}

function isCladding(system) {
  return ["Hebel", "Lightweight Cladding", "Rendered Cladding", "Mixed"].includes(system);
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + number(row[key]), 0);
}

function number(value) {
  return Number(value) || 0;
}

function round(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}
