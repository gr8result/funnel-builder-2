import { AUSTRALIAN_DEFAULTS } from "./data/australianDefaults.js";
import { DURATION_RULES } from "./data/durationRules.js";
import { normaliseProjectInputs } from "./schemas/projectInputs.js";

export function estimateContractDuration(rawInput = {}, procurementItems = []) {
  const input = normaliseProjectInputs(rawInput);
  const baseDurationDays = DURATION_RULES.baseContractDays[input.projectType] || 180;
  const complexityAdjustments = [];

  addAdjustment(complexityAdjustments, input.siteConditions, DURATION_RULES.conditionAdjustments[input.siteConditions]);
  addAdjustment(complexityAdjustments, input.siteAccess, DURATION_RULES.conditionAdjustments[input.siteAccess]);
  input.additionalFeatures.forEach((feature) => addAdjustment(complexityAdjustments, feature, DURATION_RULES.featureAdjustments[feature]));

  if (input.retainingWalls && input.retainingWalls !== "None") addAdjustment(complexityAdjustments, `${input.retainingWalls} retaining walls`, 10);
  if (input.wallConstruction === "Lightweight Cladding") addAdjustment(complexityAdjustments, "Lightweight cladding coordination", 5);

  const longestLead = procurementItems.reduce((max, item) => Math.max(max, item.leadTimeDays || 0), 0);
  if (longestLead > 42) addAdjustment(complexityAdjustments, "Long-lead procurement", Math.ceil((longestLead - 42) / 7) * 5);

  const allowanceDays = {
    weather: AUSTRALIAN_DEFAULTS.weatherAllowanceDays,
    miscellaneous: AUSTRALIAN_DEFAULTS.miscAllowanceDays,
    unforeseen: AUSTRALIAN_DEFAULTS.unforeseenAllowanceDays,
  };
  const adjustmentDays = complexityAdjustments.reduce((sum, item) => sum + item.days, 0);
  const allowanceTotal = allowanceDays.weather + allowanceDays.miscellaneous + allowanceDays.unforeseen;
  const estimatedContractDays = baseDurationDays + adjustmentDays + allowanceTotal;

  return {
    baseDurationDays,
    complexityAdjustments,
    allowanceDays,
    estimatedContractDays,
    estimatedWorkingDays: estimateWorkingDays(estimatedContractDays),
    region: AUSTRALIAN_DEFAULTS.region,
    longestLeadTimeDays: longestLead,
  };
}

function addAdjustment(list, reason, days) {
  if (!days) return;
  list.push({ reason, days });
}

function estimateWorkingDays(calendarDays) {
  return Math.round((Number(calendarDays) || 0) * (5 / 7));
}
