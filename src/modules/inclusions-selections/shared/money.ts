export type CurrencyCode = "AUD" | "NZD" | "USD" | string;

export type Money = {
  amount: number;
  currency: CurrencyCode;
};

export function money(amount: number, currency: CurrencyCode = "AUD"): Money {
  return { amount: roundCurrency(amount), currency };
}

export function roundCurrency(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function addMoney(values: Money[], currency: CurrencyCode = "AUD"): Money {
  return money(
    values.reduce((total, value) => total + (value.currency === currency ? value.amount : 0), 0),
    currency,
  );
}
