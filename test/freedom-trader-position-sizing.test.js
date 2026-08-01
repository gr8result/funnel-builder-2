import assert from "node:assert/strict";
import test from "node:test";
import {
  calculatePositionSize,
  normalizePositionSizingSettings,
} from "../lib/freedom-trader/positionSizingEngine.js";

const AUD_SETTINGS = {
  accountCurrency: "AUD",
  tradingAccountBalance: 5000,
  availableCash: 5000,
  currentTradeBudget: 1000,
  maximumCapitalPerTrade: 1000,
  defaultMaximumLoss: 50,
  minimumAcceptableExpectedProfit: 25,
  brokerageEstimate: 0,
  currencyConversionRates: { AUD: 1, USD: 1.5 },
};

test("normalizes the default maximum loss and budget settings", () => {
  const settings = normalizePositionSizingSettings({ maximumPlannedLossPerTrade: 60, maximumPositionValue: 700, accountCurrency: "AUD" });
  assert.equal(settings.defaultMaximumLoss, 60);
  assert.equal(settings.currentTradeBudget, 700);
  assert.equal(settings.maximumCapitalPerTrade, 700);
});

test("AUD trades calculate whole-share sizing", () => {
  const result = calculatePositionSize({ currency: "AUD", entry: 10, safetyExit: 8, takeSomeProfit: 14, finalExit: 16 }, AUD_SETTINGS);
  assert.equal(result.ok, true);
  assert.equal(result.shares, 25);
  assert.equal(result.maximumLossAccount, 50);
  assert.equal(result.expectedProfitAccount, 150);
  assert.equal(result.rewardRisk, 3);
});

test("USD trades convert capital, loss and expected profit into AUD", () => {
  const result = calculatePositionSize({ currency: "USD", entry: 20, safetyExit: 18, takeSomeProfit: 24, finalExit: 26 }, AUD_SETTINGS);
  assert.equal(result.ok, true);
  assert.equal(result.shares, 16);
  assert.equal(result.maximumLossAccount, 48);
  assert.equal(result.expectedProfitAccount, 144);
  assert.equal(result.capitalRequiredAccount, 480);
});

test("low capital rejects a trade that cannot buy one whole share", () => {
  const result = calculatePositionSize(
    { currency: "USD", entry: 385, safetyExit: 382, takeSomeProfit: 390, finalExit: 396 },
    { ...AUD_SETTINGS, currentTradeBudget: 100, maximumCapitalPerTrade: 100 }
  );
  assert.equal(result.ok, false);
  assert.match(result.blockers.join(" "), /one whole share|Expected profit/);
});

test("large capital still respects maximum loss", () => {
  const result = calculatePositionSize(
    { currency: "AUD", entry: 10, safetyExit: 9, takeSomeProfit: 12, finalExit: 13 },
    { ...AUD_SETTINGS, currentTradeBudget: 10000, maximumCapitalPerTrade: 10000, defaultMaximumLoss: 100 }
  );
  assert.equal(result.ok, true);
  assert.equal(result.shares, 100);
  assert.equal(result.maximumLossAccount, 100);
});

test("tiny profit is rejected even when the trade technically passes", () => {
  const result = calculatePositionSize(
    { currency: "AUD", entry: 10, safetyExit: 9, takeSomeProfit: 10.2, finalExit: 10.3 },
    { ...AUD_SETTINGS, minimumAcceptableExpectedProfit: 25 }
  );
  assert.equal(result.ok, false);
  assert.match(result.blockers.join(" "), /Expected profit/);
});

test("large profit and high reward are approved", () => {
  const result = calculatePositionSize(
    { currency: "AUD", entry: 25, safetyExit: 23, takeSomeProfit: 32, finalExit: 35 },
    { ...AUD_SETTINGS, defaultMaximumLoss: 80, currentTradeBudget: 2000, maximumCapitalPerTrade: 2000 }
  );
  assert.equal(result.ok, true);
  assert.equal(result.rewardRisk, 5);
  assert.equal(result.expectedProfitAccount, 400);
});

test("low reward is rejected through the minimum expected profit rule", () => {
  const result = calculatePositionSize(
    { currency: "AUD", entry: 100, safetyExit: 95, takeSomeProfit: 101, finalExit: 101 },
    { ...AUD_SETTINGS, defaultMaximumLoss: 50, minimumAcceptableExpectedProfit: 20 }
  );
  assert.equal(result.ok, false);
});

test("insufficient buying power reduces shares before approving", () => {
  const result = calculatePositionSize(
    { currency: "USD", entry: 385, safetyExit: 382, takeSomeProfit: 390, finalExit: 391 },
    { ...AUD_SETTINGS, availableCash: 7000, currentTradeBudget: 7000, maximumCapitalPerTrade: 7000, defaultMaximumLoss: 90, minimumAcceptableExpectedProfit: 25 }
  );
  assert.equal(result.ok, true);
  assert.equal(result.shares, 12);
  assert.equal(result.maximumLossAccount, 54);
  assert.equal(result.expectedProfitAccount, 108);
});

test("fractional shares are disabled by default", () => {
  const result = calculatePositionSize(
    { currency: "AUD", entry: 30, safetyExit: 28, takeSomeProfit: 35, finalExit: 36 },
    { ...AUD_SETTINGS, defaultMaximumLoss: 51 }
  );
  assert.equal(result.shares, 25);
  assert.equal(Number.isInteger(result.shares), true);
});
