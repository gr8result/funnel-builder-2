import { money, roundCurrency } from "../shared/money";
import type { SelectionPricing, SelectionPricingInput } from "./pricingTypes";

export function calculateSelectionPricing(input: SelectionPricingInput): SelectionPricing {
  const currency = input.unitCost?.currency ?? input.allowance?.currency ?? "AUD";
  const costAmount = roundCurrency((input.unitCost?.amount ?? 0) * input.quantity);
  const sellAmount = roundCurrency(costAmount * (1 + (input.markupRate ?? 0)));
  const allowanceAmount = input.allowance?.amount ?? 0;
  const variationAmount = roundCurrency(sellAmount - allowanceAmount);
  const taxAmount = roundCurrency(Math.max(sellAmount, 0) * (input.gstRate ?? 0));

  return {
    cost: money(costAmount, currency),
    sell: money(sellAmount, currency),
    allowance: money(allowanceAmount, currency),
    variation: money(variationAmount, currency),
    tax: money(taxAmount, currency),
  };
}
