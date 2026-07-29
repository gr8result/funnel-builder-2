import type { Money } from "../shared/money";

export type SelectionPricingInput = {
  quantity: number;
  unitCost?: Money;
  allowance?: Money;
  markupRate?: number;
  gstRate?: number;
};

export type SelectionPricing = {
  cost: Money;
  sell: Money;
  allowance: Money;
  variation: Money;
  tax: Money;
};
