import { V2_WORKSHEET_SECTIONS, V2_REQUIRED_FIELDS } from "./estimateWorksheetV2Schema.js";
import { calculateWorksheetV2Areas } from "./areaCalculationEngine.js";

export function buildWorksheetV2Preview(worksheet) {
  const areas = calculateWorksheetV2Areas(worksheet);
  const finalQuantities = {};
  const missingRequired = [];

  V2_WORKSHEET_SECTIONS.forEach((section) => {
    section.rows.forEach((schemaRow) => {
      const row = worksheet.sections?.[section.key]?.rows?.[schemaRow.key] || {};
      const calculatedValue = areas.calculated[schemaRow.key] ?? "";
      const finalQuantity = finalValue(row, calculatedValue);
      finalQuantities[schemaRow.key] = {
        section: section.label,
        label: schemaRow.label,
        inputValue: row.inputValue ?? "",
        calculatedValue,
        builderOverrideQuantity: row.builderOverrideQuantity ?? "",
        finalQuantity,
        unit: schemaRow.unit || "",
        notes: row.notes || "",
        included: row.included !== false,
      };
    });
  });

  V2_REQUIRED_FIELDS.forEach(([section, key]) => {
    const row = worksheet.sections?.[section]?.rows?.[key];
    if (!row || row.inputValue === "" || row.inputValue === 0) missingRequired.push({ section, key });
  });

  return {
    areas,
    finalQuantities,
    missingRequired,
    summaryQuantities: {
      totalFloorAreaM2: areas.calculated.totalFloorAreaM2,
      netExternalWallM2: areas.calculated.netExternalWallM2,
      internalWallAreaM2: areas.calculated.internalWallAreaM2,
      slabAreaM2: areas.calculated.slabAreaM2,
      roofAreaM2: areas.calculated.roofAreaM2,
      windowDoorAreaM2: areas.windowDoor.totals.windowDoorAreaM2,
      architraveLm: areas.calculated.architraveLm,
      skirtingLm: areas.calculated.skirtingLm,
      corniceLm: areas.calculated.corniceLm,
    },
  };
}

function finalValue(row, calculatedValue) {
  if (row?.builderOverrideQuantity !== "" && row?.builderOverrideQuantity !== undefined && row?.builderOverrideQuantity !== null) {
    return row.builderOverrideQuantity;
  }
  if (calculatedValue !== "" && calculatedValue !== undefined && calculatedValue !== null) return calculatedValue;
  return row?.inputValue ?? "";
}
