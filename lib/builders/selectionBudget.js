export const DEFAULT_WARNING_THRESHOLD_PERCENT = 80;

export const SELECTION_BUDGET_STATUSES = {
  WITHIN_BUDGET: "within_budget",
  APPROACHING_LIMIT: "approaching_limit",
  LIMIT_REACHED: "limit_reached",
  OVER_LIMIT: "over_limit",
};

export const CLIENT_SELECTION_STATUSES = [
  "not_selected",
  "selected",
  "replaced",
  "removed",
  "approved",
];

export const SELECTION_CATEGORIES = [
  "appliances",
  "plumbing_fixtures",
  "tapware",
  "bathroom_fixtures",
  "kitchen_fixtures",
  "tiles",
  "carpet",
  "hybrid_flooring",
  "timber_flooring",
  "cabinetry",
  "benchtops",
  "door_hardware",
  "windows_and_doors",
  "bricks",
  "roofing_colours",
  "cladding",
  "paint_colours",
  "electrical_fixtures",
  "lighting",
  "ceiling_fans",
  "garage_door",
  "air_conditioning",
  "external_finishes",
  "other",
];

export function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function calculateClientSelectionPrice(input = {}) {
  const builderCost = numberValue(input.builderCost ?? input.builder_cost);
  const installationCost = numberValue(input.installationCost ?? input.installation_cost);
  const builderMarkupPercent = numberValue(input.builderMarkupPercent ?? input.builder_markup_percent);
  const fixedBuilderMarkup = numberValue(input.fixedBuilderMarkup ?? input.fixed_builder_markup);
  const gstRate = numberValue(input.gstRate ?? input.gst_rate ?? 10);
  const manualOverridePrice = input.manualOverridePrice ?? input.manual_override_price;
  const hasManualOverride = input.hasManualOverride
    ?? input.has_manual_override
    ?? (manualOverridePrice !== "" && manualOverridePrice !== null && manualOverridePrice !== undefined);

  const baseCost = roundMoney(builderCost + installationCost);
  const markupAmount = roundMoney(fixedBuilderMarkup > 0 ? fixedBuilderMarkup : baseCost * (builderMarkupPercent / 100));
  const priceBeforeGst = roundMoney(baseCost + markupAmount);
  const calculatedClientSelectionPrice = roundMoney(priceBeforeGst * (1 + gstRate / 100));
  const clientSelectionPrice = hasManualOverride
    ? roundMoney(manualOverridePrice)
    : calculatedClientSelectionPrice;

  return {
    baseCost,
    markupAmount,
    priceBeforeGst,
    calculatedClientSelectionPrice,
    clientSelectionPrice,
    gstRate,
    hasManualOverride: Boolean(hasManualOverride),
  };
}

export function calculateSelectionFinancials(input = {}) {
  const includedAllowance = numberValue(input.includedAllowance ?? input.allowance_amount ?? input.included_allowance);
  const pricing = calculateClientSelectionPrice(input);
  const variationAmount = roundMoney(pricing.clientSelectionPrice - includedAllowance);

  return {
    ...pricing,
    includedAllowance,
    variationAmount,
    isIncludedSelection: variationAmount === 0,
    impactType: variationAmount > 0 ? "upgrade" : variationAmount < 0 ? "credit" : "included",
  };
}

export function calculateBudgetStatus(currentNetSelectionVariation, privateUpgradeCeiling, warningThresholdPercent = DEFAULT_WARNING_THRESHOLD_PERCENT) {
  const current = numberValue(currentNetSelectionVariation);
  const ceiling = numberValue(privateUpgradeCeiling);
  const thresholdPercent = numberValue(warningThresholdPercent) || DEFAULT_WARNING_THRESHOLD_PERCENT;
  const warningThreshold = roundMoney(ceiling * (thresholdPercent / 100));

  if (ceiling <= 0) return SELECTION_BUDGET_STATUSES.WITHIN_BUDGET;
  if (current > ceiling) return SELECTION_BUDGET_STATUSES.OVER_LIMIT;
  if (current === ceiling) return SELECTION_BUDGET_STATUSES.LIMIT_REACHED;
  if (current >= warningThreshold) return SELECTION_BUDGET_STATUSES.APPROACHING_LIMIT;
  return SELECTION_BUDGET_STATUSES.WITHIN_BUDGET;
}

export function calculateSessionBudget({ originalEstimateTotal = 0, privateUpgradeCeiling = 0, warningThresholdPercent = DEFAULT_WARNING_THRESHOLD_PERCENT, selections = [] } = {}) {
  const currentNetSelectionVariation = roundMoney(
    selections
      .filter((selection) => selection?.is_active !== false && !["replaced", "removed"].includes(selection?.selection_status || selection?.status))
      .reduce((total, selection) => total + numberValue(selection.variation_amount ?? selection.selected_details?.variationAmount), 0)
  );
  const currentUpdatedEstimateTotal = roundMoney(numberValue(originalEstimateTotal) + currentNetSelectionVariation);
  const selectionBudgetStatus = calculateBudgetStatus(currentNetSelectionVariation, privateUpgradeCeiling, warningThresholdPercent);

  return {
    originalEstimateTotal: roundMoney(originalEstimateTotal),
    privateUpgradeCeiling: roundMoney(privateUpgradeCeiling),
    currentNetSelectionVariation,
    currentUpdatedEstimateTotal,
    warningThresholdPercent: numberValue(warningThresholdPercent) || DEFAULT_WARNING_THRESHOLD_PERCENT,
    selectionBudgetStatus,
    remainingCapacity: roundMoney(numberValue(privateUpgradeCeiling) - currentNetSelectionVariation),
    percentageUsed: numberValue(privateUpgradeCeiling) > 0 ? roundMoney((currentNetSelectionVariation / numberValue(privateUpgradeCeiling)) * 100) : 0,
  };
}

export function clientPriceImpactLabel(variationAmount) {
  const value = roundMoney(variationAmount);
  if (value === 0) return "Included";
  const absolute = Math.abs(value).toLocaleString("en-AU", { maximumFractionDigits: 2 });
  return value > 0 ? `+$${absolute} Upgrade` : `-$${absolute} Credit`;
}
