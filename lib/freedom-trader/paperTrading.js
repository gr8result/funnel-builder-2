export const PAPER_OWNER_ID = "00000000-0000-4000-8000-000000000001";
export const DEFAULT_STARTING_BALANCE = 100000;
export const DEFAULT_ACCOUNT_CURRENCY = "AUD";
export const DEFAULT_BROKERAGE_FEE = 9.5;
export const MAX_TRADE_PRICE_AGE_MS = 4 * 24 * 60 * 60 * 1000;

export function roundMoney(value, decimals = 2) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(decimals)) : null;
}

export function cleanNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function normalizeSymbol(value) {
  return String(value || "").trim().toUpperCase();
}

export function developmentOwnerId(req) {
  const header = req?.headers?.["x-freedom-paper-owner"];
  const configured = process.env.FREEDOM_PAPER_OWNER_ID;
  return String(header || configured || PAPER_OWNER_ID);
}

export function priceIsUsable(price) {
  const amount = cleanNumber(price?.price);
  const updatedAt = price?.lastUpdated ? new Date(price.lastUpdated).getTime() : null;
  const ageMs = updatedAt ? Date.now() - updatedAt : null;
  return Boolean(
    Number.isFinite(amount) &&
    amount > 0 &&
    price?.provider &&
    price?.exchange &&
    price?.currency &&
    Number.isFinite(ageMs) &&
    ageMs >= 0 &&
    ageMs <= MAX_TRADE_PRICE_AGE_MS
  );
}

export function brokerageFee(input) {
  const explicit = cleanNumber(input);
  return Number.isFinite(explicit) && explicit >= 0 ? roundMoney(explicit) : DEFAULT_BROKERAGE_FEE;
}

export function calculateBuyOrder({
  account,
  currentPrice,
  limitPrice,
  orderType = "market",
  quantity,
  brokerage = DEFAULT_BROKERAGE_FEE,
  stopLoss,
}) {
  const shares = Math.floor(cleanNumber(quantity) || 0);
  const price = String(orderType).toLowerCase() === "limit" ? cleanNumber(limitPrice) : cleanNumber(currentPrice);
  const fee = brokerageFee(brokerage);
  const availableCash = cleanNumber(account?.available_cash ?? account?.availableCash) || 0;
  const stop = cleanNumber(stopLoss);
  const orderValue = Number.isFinite(price) ? price * shares : null;
  const totalRequiredCash = Number.isFinite(orderValue) ? orderValue + fee : null;
  const riskPerShare = Number.isFinite(stop) && Number.isFinite(price) ? price - stop : null;
  const totalRisk = Number.isFinite(riskPerShare) ? riskPerShare * shares : null;
  const percentAtRisk = availableCash > 0 && Number.isFinite(totalRisk) ? (totalRisk / availableCash) * 100 : null;

  return {
    quantity: shares,
    price: roundMoney(price),
    orderValue: roundMoney(orderValue),
    brokerageFee: fee,
    totalRequiredCash: roundMoney(totalRequiredCash),
    riskPerShare: roundMoney(riskPerShare),
    totalRisk: roundMoney(totalRisk),
    percentAtRisk: roundMoney(percentAtRisk),
  };
}

export function validateBuyOrder({ account, price, order }) {
  const errors = [];
  const type = String(order?.orderType || order?.order_type || "market").toLowerCase();
  const quantity = Math.floor(cleanNumber(order?.quantity) || 0);
  const currentPrice = cleanNumber(price?.price ?? order?.currentPrice);
  const limitPrice = cleanNumber(order?.limitPrice ?? order?.requestedPrice);
  const executionPrice = type === "limit" ? limitPrice : currentPrice;
  const stopLoss = cleanNumber(order?.stopLoss ?? order?.stop_loss_price);
  const calculation = calculateBuyOrder({
    account,
    currentPrice,
    limitPrice,
    orderType: type,
    quantity,
    brokerage: order?.brokerageFee ?? order?.brokerage_fee,
    stopLoss,
  });

  if (quantity < 1) errors.push("Quantity must be greater than zero.");
  if (!priceIsUsable(price)) errors.push("Current price data is missing, stale or invalid.");
  if (type === "limit" && (!Number.isFinite(limitPrice) || limitPrice <= 0)) errors.push("Limit price must be a positive number.");
  if (!Number.isFinite(executionPrice) || executionPrice <= 0) errors.push("A valid buy price is required.");
  if (Number.isFinite(stopLoss) && stopLoss >= executionPrice) errors.push("Stop loss must be below the buy price.");
  if (!account?.id) errors.push("Paper trading account is required.");
  if (Number.isFinite(calculation.totalRequiredCash) && calculation.totalRequiredCash > (cleanNumber(account?.available_cash) || 0)) {
    errors.push("Available paper cash is insufficient.");
  }

  return { ok: errors.length === 0, errors, calculation };
}

export function calculateAverageEntry(existingQuantity, existingAverage, buyQuantity, buyPrice) {
  const oldQty = cleanNumber(existingQuantity) || 0;
  const oldAverage = cleanNumber(existingAverage) || 0;
  const newQty = cleanNumber(buyQuantity) || 0;
  const price = cleanNumber(buyPrice) || 0;
  const totalQuantity = oldQty + newQty;
  if (totalQuantity <= 0) return null;
  return roundMoney(((oldQty * oldAverage) + (newQty * price)) / totalQuantity, 6);
}

export function calculateSale({ quantity, averageEntry, saleQuantity, salePrice, brokerage = 0 }) {
  const held = cleanNumber(quantity) || 0;
  const sold = Math.floor(cleanNumber(saleQuantity) || 0);
  const entry = cleanNumber(averageEntry);
  const price = cleanNumber(salePrice);
  const fee = brokerageFee(brokerage);
  if (sold < 1 || sold > held || !Number.isFinite(entry) || !Number.isFinite(price)) return null;
  const gross = (price - entry) * sold;
  const realised = gross - fee;
  return {
    remainingQuantity: held - sold,
    grossProfit: roundMoney(gross),
    realisedProfit: roundMoney(realised),
    returnPercent: entry * sold ? roundMoney((realised / (entry * sold)) * 100) : null,
  };
}

export function calculateUnrealised(position, currentPrice) {
  const quantity = cleanNumber(position?.quantity) || 0;
  const averageEntry = cleanNumber(position?.average_entry_price ?? position?.averageEntry);
  const price = cleanNumber(currentPrice);
  if (!quantity || !Number.isFinite(averageEntry) || !Number.isFinite(price)) return { marketValue: null, unrealisedProfit: null, returnPercent: null };
  const marketValue = quantity * price;
  const cost = quantity * averageEntry;
  const unrealisedProfit = marketValue - cost;
  return {
    marketValue: roundMoney(marketValue),
    unrealisedProfit: roundMoney(unrealisedProfit),
    returnPercent: cost ? roundMoney((unrealisedProfit / cost) * 100) : null,
  };
}

export function shouldTriggerExit(position, currentPrice) {
  const price = cleanNumber(currentPrice);
  const stop = cleanNumber(position?.stop_loss_price ?? position?.stopLoss);
  const target = cleanNumber(position?.target_price ?? position?.target);
  if (!Number.isFinite(price)) return null;
  if (Number.isFinite(stop) && price <= stop) return "stop_loss";
  if (Number.isFinite(target) && price >= target) return "profit_target";
  return null;
}

export function csvEscape(value) {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
