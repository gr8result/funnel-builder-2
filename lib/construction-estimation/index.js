import { calculateQuantities } from "./quantityEngine.js";
import { resolveAssemblies } from "./assemblyEngine.js";
import { generateMaterialTakeoff } from "./takeoffEngine.js";
import { generateProcurementPlan } from "./procurementEngine.js";
import { estimateContractDuration } from "./durationEngine.js";
import { normaliseProjectInputs } from "./schemas/projectInputs.js";

export function buildConstructionEstimatePreview(rawInput = {}) {
  const inputs = normaliseProjectInputs(mapPlannerAnswersToEstimateInputs(rawInput));
  const quantities = calculateQuantities(inputs);
  const assemblies = resolveAssemblies(inputs);
  const takeoffGroups = generateMaterialTakeoff(assemblies, quantities);
  const procurementItems = generateProcurementPlan(takeoffGroups, assemblies);
  const contractDuration = estimateContractDuration(inputs, procurementItems);

  return {
    inputs,
    quantities,
    assemblies: assemblies.map(({ appliesWhen: _appliesWhen, ...assembly }) => assembly),
    takeoffGroups,
    procurementItems,
    contractDuration,
  };
}

export function mapPlannerAnswersToEstimateInputs(answers = {}) {
  return {
    projectType: answers.projectType,
    siteConditions: answers.siteConditions,
    slabType: answers.slabType,
    wallConstruction: answers.groundExternalWall || answers.wallConstruction,
    roofType: answers.roofType,
    retainingWalls: answers.retainingWalls,
    siteAccess: answers.siteAccess,
    additionalFeatures: answers.additionalFeatures || [],
    groundExternalWall: answers.groundExternalWall,
    firstExternalWall: answers.firstExternalWall,
    secondExternalWall: answers.secondExternalWall,
    floorBreakdown: {
      ground: {
        floorStructure: answers.groundFloorStructure,
        externalWall: answers.groundExternalWall,
        internalFrame: answers.groundInternalFrame,
        specialRequirements: answers.groundSpecialRequirements || [],
      },
      first: {
        floorStructure: answers.firstFloorStructure,
        externalWall: answers.firstExternalWall,
        internalFrame: answers.firstInternalFrame,
        specialRequirements: answers.firstSpecialRequirements || [],
      },
      second: {
        floorStructure: answers.secondFloorStructure,
        externalWall: answers.secondExternalWall,
        internalFrame: answers.secondInternalFrame,
        specialRequirements: answers.secondSpecialRequirements || [],
      },
    },
  };
}
