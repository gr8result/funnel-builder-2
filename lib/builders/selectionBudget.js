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

function sumAdditionalCosts(additionalCosts) {
  if (additionalCosts === null || additionalCosts === undefined) return 0;
  if (typeof additionalCosts === "number") return numberValue(additionalCosts);
  if (Array.isArray(additionalCosts)) return additionalCosts.reduce((total, entry) => total + numberValue(entry?.amount ?? entry), 0);
  if (typeof additionalCosts === "object") return Object.values(additionalCosts).reduce((total, value) => total + numberValue(value), 0);
  return numberValue(additionalCosts);
}

function settingValue(settings, ...keys) {
  for (const key of keys) {
    const value = settings?.[key];
    if (value !== undefined && value !== null && value !== "") return numberValue(value);
  }
  return 0;
}

function unitBuilderCost(selectedProduct = {}) {
  // Cost basis only — never a sell price — so builder margin is applied exactly once.
  const cost = selectedProduct.builderCost
    ?? selectedProduct.builder_cost
    ?? selectedProduct.cost_price
    ?? selectedProduct.supplier_cost
    ?? selectedProduct.supplierCost
    ?? 0;
  return numberValue(cost);
}

/**
 * The single shared client-variation calculator used by the Product Library
 * selection catalogue, Client Selections and (in future) variation/contract
 * pricing. Given an allowance and a SELECTED PRODUCT COST (not a marked-up
 * price), it returns the full breakdown of the amount actually charged to the
 * client. All percentages come from projectPricingSettings (sourced from
 * builder_selection_budget_settings) — nothing is hard-coded except the GST
 * fallback of 10.
 *
 * Markup and overhead are applied once, to the cost difference over the
 * allowance, so a selection whose allowance already embeds base margin is never
 * double-margined.
 */
export function calculateSelectionVariation({
  allowance = 0,
  selectedProduct = {},
  quantity = 1,
  projectPricingSettings = {},
  additionalCosts = 0,
} = {}) {
  const qty = numberValue(quantity) || 1;
  const allowanceUnit = numberValue(allowance);
  const allowanceTotal = roundMoney(allowanceUnit * qty);

  const wastagePercent = settingValue(projectPricingSettings, "default_wastage_percent", "wastagePercent");
  const markupPercent = settingValue(projectPricingSettings, "default_builder_markup_percent", "builderMarkupPercent", "markupPercent");
  const overheadPercent = settingValue(projectPricingSettings, "default_overhead_percent", "overheadPercent");
  const commissionPercent = settingValue(projectPricingSettings, "default_sales_commission_percent", "salesCommissionPercent", "commissionPercent");
  const adminFee = settingValue(projectPricingSettings, "variation_admin_fee", "administrationFee", "adminFee");
  const gstRate = settingValue(projectPricingSettings, "default_gst_rate", "gstRate") || 10;

  const installationUnit = numberValue(selectedProduct.installationCost ?? selectedProduct.installation_cost);
  const baseSelectedUnitCost = unitBuilderCost(selectedProduct) + installationUnit;
  const wastageAmount = roundMoney(baseSelectedUnitCost * qty * (wastagePercent / 100));
  const extraCosts = roundMoney(sumAdditionalCosts(additionalCosts));
  const selectedCostTotal = roundMoney(baseSelectedUnitCost * qty + wastageAmount + extraCosts);

  const rawDifference = roundMoney(selectedCostTotal - allowanceTotal);

  const markup = roundMoney(rawDifference * (markupPercent / 100));
  const overhead = roundMoney(rawDifference * (overheadPercent / 100));
  const subtotalBeforeCommission = roundMoney(rawDifference + markup + overhead);
  const commission = roundMoney(subtotalBeforeCommission * (commissionPercent / 100));
  // A flat variation admin fee applies to an upgrade only — it should not turn a
  // client credit into a smaller credit or a charge.
  const administrationFee = rawDifference > 0 ? roundMoney(adminFee) : 0;
  const subtotalBeforeGst = roundMoney(subtotalBeforeCommission + commission + administrationFee);
  const gst = roundMoney(subtotalBeforeGst * (gstRate / 100));
  const clientVariationTotal = roundMoney(subtotalBeforeGst + gst);

  return {
    allowanceTotal,
    allowanceUnitValue: allowanceUnit,
    quantity: qty,
    selectedCostTotal,
    wastageAmount,
    additionalCosts: extraCosts,
    rawDifference,
    markup,
    overhead,
    commission,
    administrationFee,
    subtotalBeforeGst,
    gst,
    gstRate,
    clientVariationTotal,
    impactType: clientVariationTotal > 0 ? "upgrade" : clientVariationTotal < 0 ? "credit" : "included",
  };
}

export function clientPriceImpactLabel(variationAmount) {
  const value = roundMoney(variationAmount);
  if (value === 0) return "Included";
  const absolute = Math.abs(value).toLocaleString("en-AU", { maximumFractionDigits: 2 });
  return value > 0 ? `+$${absolute} Upgrade` : `-$${absolute} Credit`;
}

/**
 * The point-in-time record stored on builder_client_selections.selection_snapshot
 * when a client selects a product. Historical projects must never change when
 * someone later edits the master builder_products row, so this captures every
 * client-facing detail the final schedule needs, independent of the live product.
 */
export function buildSelectionSnapshot(product = {}, selectionInput = {}) {
  return {
    productId: product.id ?? null,
    productCode: product.sku ?? product.internal_product_code ?? "",
    productName: product.product_name ?? selectionInput.productName ?? "",
    description: product.description ?? "",
    brand: product.brand ?? selectionInput.brand ?? "",
    model: product.model ?? selectionInput.model ?? "",
    supplierName: product.supplier_name ?? selectionInput.supplierName ?? "",
    colour: selectionInput.colour ?? product.colour ?? "",
    finish: selectionInput.finish ?? product.finish ?? "",
    imageRef: product.primary_image_url ?? "",
    pricingTier: product.pricing_tier ?? null,
    includedAllowance: numberValue(selectionInput.includedAllowance ?? selectionInput.allowance),
    builderCost: numberValue(selectionInput.builderCost ?? product.cost_price ?? product.trade_cost),
    upgradeValue: numberValue(selectionInput.variationAmount ?? selectionInput.upgradeValue),
    clientNotes: selectionInput.clientNotes ?? product.client_notes ?? "",
    snapshotTakenAt: new Date().toISOString(),
  };
}

/**
 * Guards against creating a second draft variation for a selections session that
 * already has one in flight. A session only needs a new draft once the existing
 * one is void/rejected (i.e. abandoned) — anything else (draft/submitted/approved/
 * invoiced) means there's already something for the office to review or that has
 * already been actioned.
 */
export function hasActiveDraftVariation(session = {}, variation = null) {
  if (!session?.variation_id) return false;
  if (!variation) return true;
  return !["void", "rejected"].includes(variation.status);
}
