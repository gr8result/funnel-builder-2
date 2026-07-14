import assert from "node:assert/strict";
import {
  calculateSelectionFinancials,
  calculateSessionBudget,
  clientPriceImpactLabel,
  roundMoney,
} from "../lib/builders/selectionBudget.js";

function selectionWithClientPrice(includedAllowance, clientSelectionPrice, extra = {}) {
  return {
    includedAllowance,
    manualOverridePrice: clientSelectionPrice,
    hasManualOverride: true,
    gstRate: 10,
    ...extra,
  };
}

const included = calculateSelectionFinancials(selectionWithClientPrice(1200, 1200));
assert.equal(included.variationAmount, 0);
assert.equal(clientPriceImpactLabel(included.variationAmount), "Included");

const upgrade = calculateSelectionFinancials(selectionWithClientPrice(1200, 1850));
assert.equal(upgrade.variationAmount, 650);
assert.equal(clientPriceImpactLabel(upgrade.variationAmount), "+$650 Upgrade");

const credit = calculateSelectionFinancials(selectionWithClientPrice(1200, 950));
assert.equal(credit.variationAmount, -250);
assert.equal(clientPriceImpactLabel(credit.variationAmount), "-$250 Credit");

const oldVariation = 650;
const newVariation = 200;
assert.equal(roundMoney(oldVariation - newVariation), 450);

const approaching = calculateSessionBudget({
  originalEstimateTotal: 485000,
  privateUpgradeCeiling: 15000,
  selections: [{ variation_amount: 12500, selection_status: "selected", is_active: true }],
});
assert.equal(approaching.selectionBudgetStatus, "approaching_limit");
assert.equal(approaching.remainingCapacity, 2500);
assert.equal(approaching.currentUpdatedEstimateTotal, 497500);

const over = calculateSessionBudget({
  originalEstimateTotal: 485000,
  privateUpgradeCeiling: 15000,
  selections: [{ variation_amount: 16250, selection_status: "selected", is_active: true }],
});
assert.equal(over.selectionBudgetStatus, "over_limit");
assert.equal(over.remainingCapacity, -1250);
assert.equal(over.currentNetSelectionVariation, 16250);

const fullFormula = calculateSelectionFinancials({
  includedAllowance: 1200,
  builderCost: 1000,
  installationCost: 200,
  builderMarkupPercent: 25,
  fixedBuilderMarkup: 0,
  gstRate: 10,
});
assert.equal(fullFormula.baseCost, 1200);
assert.equal(fullFormula.markupAmount, 300);
assert.equal(fullFormula.clientSelectionPrice, 1650);
assert.equal(fullFormula.variationAmount, 450);

console.log("Selection Budget Manager acceptance calculations passed.");
