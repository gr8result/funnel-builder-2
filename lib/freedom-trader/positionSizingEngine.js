import { cleanNumber, roundMoney } from "./paperTrading.js";

export const DEFAULT_POSITION_SIZING_SETTINGS = {
  tradingAccountBalance: 5000,
  currentTradeBudget: 1250,
  defaultMaximumLoss: 50,
  minimumAcceptableExpectedProfit: 25,
  maximumCapitalPerTrade: 1250,
  accountCurrency: "AUD",
  currencyPreference: "AUD",
  brokerageEstimate: 0,
  allowFractionalShares: false,
  currencyConversionRates: { AUD: 1 },
};

function upper(value, fallback = "AUD") {
  return String(value || fallback).trim().toUpperCase();
}

function round(value, decimals = 2) {
  return roundMoney(value, decimals);
}

function settingNumber(input, keys, fallback) {
  for (const key of keys) {
    const value = cleanNumber(input?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return fallback;
}

export function normalizePositionSizingSettings(input = {}) {
  const accountCurrency = upper(input.accountCurrency || input.currencyPreference || DEFAULT_POSITION_SIZING_SETTINGS.accountCurrency);
  const tradingAccountBalance = settingNumber(input, ["tradingAccountBalance", "tradingBalance", "accountBalance"], DEFAULT_POSITION_SIZING_SETTINGS.tradingAccountBalance);
  const availableCash = settingNumber(input, ["availableCash", "available_cash"], tradingAccountBalance);
  const maximumCapitalPerTrade = settingNumber(input, ["maximumCapitalPerTrade", "maximumPositionValue"], DEFAULT_POSITION_SIZING_SETTINGS.maximumCapitalPerTrade);
  const currentTradeBudget = settingNumber(input, ["currentTradeBudget", "tradeAllocation", "tradeBudget"], maximumCapitalPerTrade);
  return {
    ...DEFAULT_POSITION_SIZING_SETTINGS,
    ...input,
    tradingAccountBalance,
    availableCash,
    accountCurrency,
    currencyPreference: upper(input.currencyPreference || accountCurrency, accountCurrency),
    currentTradeBudget: Math.max(0, currentTradeBudget),
    defaultMaximumLoss: Math.max(0, settingNumber(input, ["defaultMaximumLoss", "maximumLoss", "maximumPlannedLossPerTrade"], DEFAULT_POSITION_SIZING_SETTINGS.defaultMaximumLoss)),
    minimumAcceptableExpectedProfit: Math.max(0, settingNumber(input, ["minimumAcceptableExpectedProfit", "minimumExpectedProfit"], DEFAULT_POSITION_SIZING_SETTINGS.minimumAcceptableExpectedProfit)),
    maximumCapitalPerTrade: Math.max(0, maximumCapitalPerTrade),
    brokerageEstimate: Math.max(0, settingNumber(input, ["brokerageEstimate", "brokerageFee", "brokerage"], DEFAULT_POSITION_SIZING_SETTINGS.brokerageEstimate)),
    allowFractionalShares: input.allowFractionalShares === true,
    currencyConversionRates: { ...DEFAULT_POSITION_SIZING_SETTINGS.currencyConversionRates, ...(input.currencyConversionRates || {}) },
  };
}

export function conversionRateToAccount(fromCurrency, settings = {}) {
  const cleanSettings = normalizePositionSizingSettings(settings);
  const from = upper(fromCurrency, cleanSettings.accountCurrency);
  if (from === cleanSettings.accountCurrency) return 1;
  const direct = cleanNumber(cleanSettings.currencyConversionRates?.[from]);
  if (Number.isFinite(direct) && direct > 0) return direct;
  return null;
}

function sizedShares(rawShares, allowFractionalShares) {
  if (!Number.isFinite(rawShares) || rawShares <= 0) return 0;
  return allowFractionalShares ? round(rawShares, 4) : Math.floor(rawShares);
}

export function calculatePositionSize(input = {}, settingsInput = {}) {
  const settings = normalizePositionSizingSettings(settingsInput);
  const tradeCurrency = upper(input.currency, settings.accountCurrency);
  const rate = conversionRateToAccount(tradeCurrency, settings);
  const entry = cleanNumber(input.entry ?? input.entryPrice ?? input.entryBuyPrice ?? input.buyPrice);
  const safetyExit = cleanNumber(input.safetyExit ?? input.stopLoss ?? input.stop);
  const takeSomeProfit = cleanNumber(input.takeSomeProfit ?? input.target ?? input.target1);
  const finalExit = cleanNumber(input.finalExit ?? input.target2 ?? takeSomeProfit);
  const maxLoss = Math.max(0, cleanNumber(input.maximumLoss ?? input.maximumPlannedLoss ?? settings.defaultMaximumLoss) ?? settings.defaultMaximumLoss);
  const blockers = [];
  const warnings = [];

  if (!Number.isFinite(rate)) blockers.push(`Missing ${tradeCurrency} to ${settings.accountCurrency} currency conversion.`);
  if (!Number.isFinite(entry) || entry <= 0) blockers.push("Entry price is missing.");
  if (!Number.isFinite(safetyExit) || safetyExit <= 0) blockers.push("Safety Exit is missing.");
  if (!Number.isFinite(takeSomeProfit) || takeSomeProfit <= 0) blockers.push("Take Some Profit is missing.");
  if (!Number.isFinite(finalExit) || finalExit <= 0) blockers.push("Final Exit is missing.");
  if (Number.isFinite(entry) && Number.isFinite(safetyExit) && safetyExit >= entry) blockers.push("Safety Exit must be below the buy price.");
  if (Number.isFinite(entry) && Number.isFinite(takeSomeProfit) && takeSomeProfit <= entry) blockers.push("Take Some Profit must be above the buy price.");
  if (Number.isFinite(takeSomeProfit) && Number.isFinite(finalExit) && finalExit < takeSomeProfit) blockers.push("Final Exit must not be below Take Some Profit.");
  if (maxLoss <= 0) blockers.push("Maximum loss must be greater than zero.");

  if (blockers.length) {
    return { ok: false, status: "REJECTED", blockers, warnings, tradeCurrency, accountCurrency: settings.accountCurrency, conversionRate: rate };
  }

  const riskPerShare = entry - safetyExit;
  const riskPerShareAccount = riskPerShare * rate;
  const entryAccount = entry * rate;
  const finalProfitPerShare = Math.max(0, finalExit - entry);
  const target1ProfitPerShare = Math.max(0, takeSomeProfit - entry);
  const finalProfitPerShareAccount = finalProfitPerShare * rate;
  const target1ProfitPerShareAccount = target1ProfitPerShare * rate;
  const capitalLimitAccount = Math.max(0, Math.min(
    settings.availableCash,
    settings.currentTradeBudget || settings.availableCash,
    settings.maximumCapitalPerTrade || settings.availableCash
  ));
  const capitalAvailableForShares = Math.max(0, capitalLimitAccount - settings.brokerageEstimate);
  const maxSharesByRisk = sizedShares(maxLoss / riskPerShareAccount, settings.allowFractionalShares);
  const maxSharesByCapital = sizedShares(capitalAvailableForShares / entryAccount, settings.allowFractionalShares);
  const shares = Math.max(0, Math.min(maxSharesByRisk, maxSharesByCapital));
  const capitalRequiredAccount = shares * entryAccount + settings.brokerageEstimate;
  const capitalRequiredTrade = shares * entry;
  const maximumLossAccount = shares * riskPerShareAccount + settings.brokerageEstimate;
  const maximumLossTrade = shares * riskPerShare;
  const expectedProfitAccount = shares * finalProfitPerShareAccount - (settings.brokerageEstimate * 2);
  const expectedProfitTrade = shares * finalProfitPerShare;
  const expectedTakeProfitAccount = shares * target1ProfitPerShareAccount - (settings.brokerageEstimate * 2);
  const rewardRisk = maximumLossAccount > 0 ? expectedProfitAccount / maximumLossAccount : null;
  const accountPercent = settings.tradingAccountBalance > 0 ? (capitalRequiredAccount / settings.tradingAccountBalance) * 100 : null;
  const lossPercent = settings.tradingAccountBalance > 0 ? (maximumLossAccount / settings.tradingAccountBalance) * 100 : null;

  if (shares < 1) blockers.push("Not enough buying power for one whole share at Grant's risk settings.");
  if (capitalRequiredAccount > capitalLimitAccount) blockers.push("Capital required exceeds the current trade budget.");
  if (maximumLossAccount > maxLoss + 0.009) blockers.push("Maximum loss exceeds the chosen limit.");
  if (expectedProfitAccount < settings.minimumAcceptableExpectedProfit) blockers.push("Expected profit is below the minimum dollar amount.");
  if (expectedProfitAccount > 0 && expectedProfitAccount < Math.max(settings.minimumAcceptableExpectedProfit, 10)) {
    warnings.push("This trade is unlikely to generate meaningful profit.");
  }

  const ok = blockers.length === 0;
  return {
    ok,
    status: ok ? "APPROVED" : "REJECTED",
    blockers,
    warnings,
    tradeCurrency,
    accountCurrency: settings.accountCurrency,
    conversionRate: rate,
    requestedMaximumLoss: round(maxLoss),
    riskPerShare: round(riskPerShare),
    riskPerShareAccount: round(riskPerShareAccount),
    shares,
    capitalRequired: round(capitalRequiredTrade),
    capitalRequiredAccount: round(capitalRequiredAccount),
    maximumLoss: round(maximumLossTrade),
    maximumLossAccount: round(maximumLossAccount),
    expectedProfit: round(expectedProfitTrade),
    expectedProfitAccount: round(expectedProfitAccount),
    expectedTakeProfitAccount: round(expectedTakeProfitAccount),
    rewardRisk: Number.isFinite(rewardRisk) ? round(rewardRisk, 2) : null,
    accountPercent: Number.isFinite(accountPercent) ? round(accountPercent, 2) : null,
    lossPercent: Number.isFinite(lossPercent) ? round(lossPercent, 2) : null,
    maximumSharesByRisk: maxSharesByRisk,
    maximumSharesByCapital: maxSharesByCapital,
    capitalLimitAccount: round(capitalLimitAccount),
    brokerageEstimate: round(settings.brokerageEstimate),
    explanation: ok
      ? `If this trade reaches your Safety Exit, you will lose approximately ${settings.accountCurrency} ${round(maximumLossAccount)}. If it reaches Final Exit, you could make approximately ${settings.accountCurrency} ${round(expectedProfitAccount)}.`
      : "This trade is not worthwhile for the current risk and budget settings.",
  };
}
