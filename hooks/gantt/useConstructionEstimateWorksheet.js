import { useMemo, useState } from "react";
import { resolveAssemblies } from "../../lib/construction-estimation/assemblyEngine.js";
import { generateMaterialTakeoff } from "../../lib/construction-estimation/takeoffEngine.js";
import { generateProcurementPlan } from "../../lib/construction-estimation/procurementEngine.js";
import { estimateContractDuration } from "../../lib/construction-estimation/durationEngine.js";
import { ESTIMATE_WORKSHEET_SECTIONS } from "../../lib/construction-estimation/estimateInputSchema.js";
import { createEstimateInputDefaults } from "../../lib/construction-estimation/estimateInputDefaults.js";
import { findMissingRequiredFields, normaliseDetailedEstimateInput } from "../../lib/construction-estimation/estimateInputNormalizer.js";
import { calculateDetailedQuantities } from "../../lib/construction-estimation/detailedQuantityEngine.js";

export function useConstructionEstimateWorksheet(plannerAnswers = {}) {
  const [activeSection, setActiveSection] = useState("projectBasics");
  const [worksheetInput, setWorksheetInput] = useState(() => createEstimateInputDefaults(plannerAnswers));

  const normalised = useMemo(() => normaliseDetailedEstimateInput(worksheetInput), [worksheetInput]);
  const quantities = useMemo(() => calculateDetailedQuantities(worksheetInput), [worksheetInput]);
  const assemblies = useMemo(() => resolveAssemblies(normalised.engineInputs), [normalised]);
  const takeoffGroups = useMemo(() => generateMaterialTakeoff(assemblies, quantities), [assemblies, quantities]);
  const procurementItems = useMemo(() => generateProcurementPlan(takeoffGroups, assemblies), [takeoffGroups, assemblies]);
  const contractDuration = useMemo(() => estimateContractDuration(normalised.engineInputs, procurementItems), [normalised, procurementItems]);
  const missingRequired = useMemo(() => findMissingRequiredFields(worksheetInput), [worksheetInput]);

  function updateValue(sectionKey, fieldKey, value) {
    setWorksheetInput((current) => ({
      ...current,
      [sectionKey]: {
        ...current[sectionKey],
        values: {
          ...current[sectionKey].values,
          [fieldKey]: coerceValue(value),
        },
      },
    }));
  }

  function updateOverride(sectionKey, fieldKey, value) {
    setWorksheetInput((current) => ({
      ...current,
      [sectionKey]: {
        ...current[sectionKey],
        overrides: {
          ...current[sectionKey].overrides,
          [fieldKey]: coerceValue(value),
        },
      },
    }));
  }

  function updateSectionMeta(sectionKey, key, value) {
    setWorksheetInput((current) => ({
      ...current,
      [sectionKey]: {
        ...current[sectionKey],
        [key]: value,
      },
    }));
  }

  const summary = useMemo(() => ({
    missingRequired,
    quantitySummary: [
      ["Floor area", quantities.floorAreaM2, "m2"],
      ["Slab", quantities.slabM2, "m2"],
      ["Roof", quantities.roofM2, "m2"],
      ["External walls", quantities.externalWallM2, "m2"],
      ["Wet areas", quantities.wetAreaM2, "m2"],
    ],
    longLeadItems: procurementItems.filter((item) => item.critical),
    durationImpact: contractDuration.complexityAdjustments,
    allowancePlaceholders: {
      pcItems: quantities.detailed?.pcItemCount || 0,
      provisionalSums: quantities.detailed?.provisionalSumCount || 0,
      pricingEnabled: false,
    },
  }), [missingRequired, quantities, procurementItems, contractDuration]);

  return {
    sections: ESTIMATE_WORKSHEET_SECTIONS,
    activeSection,
    setActiveSection,
    worksheetInput,
    normalised,
    quantities,
    assemblies,
    takeoffGroups,
    procurementItems,
    contractDuration,
    summary,
    updateValue,
    updateOverride,
    updateSectionMeta,
  };
}

function coerceValue(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}
