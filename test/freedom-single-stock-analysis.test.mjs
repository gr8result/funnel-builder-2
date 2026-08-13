import assert from "node:assert/strict";
import test from "node:test";
import { buildSingleStockDecision, marketDataStatusForAnalysis, resolveStockQueryFromRows } from "../lib/freedom-trader/singleStockAnalysis.js";

const rows = [
  { symbol: "SNDK", companyName: "Sandisk Corporation", exchange: "NASDAQ", country: "United States", currency: "USD", market: "US", assetType: "Common Stock", active: true, tradable: true },
  { symbol: "AAPL", companyName: "Apple Inc", exchange: "NASDAQ", country: "United States", currency: "USD", market: "US", assetType: "Common Stock", active: true, tradable: true },
  { symbol: "ABC", companyName: "ABC Technologies", exchange: "NASDAQ", country: "United States", currency: "USD", market: "US", assetType: "Common Stock", active: true, tradable: true },
  { symbol: "ABCL", companyName: "AbCellera Biologics", exchange: "NASDAQ", country: "United States", currency: "USD", market: "US", assetType: "Common Stock", active: true, tradable: true },
];

function analysis(overrides = {}) {
  return {
    symbol: "SNDK",
    companyName: "Sandisk Corporation",
    exchange: "NASDAQ",
    currency: "USD",
    currentPrice: 99,
    setup: { plannedEntry: 100, stop: 94, target: 118, riskRewardRatio: 3, setupReasoning: "Pullback reversal setup is developing." },
    dataStatus: { readyForScore: true, latestTimestamp: "2026-08-12" },
    marketData: { validated: true, historySource: "Twelve Data", latestCandleDate: "2026-08-12" },
    ...overrides,
  };
}

test("ticker lookup resolves SNDK from provider-style rows without hardcoding", () => {
  const result = resolveStockQueryFromRows(rows, "sndk");
  assert.equal(result.ok, true);
  assert.equal(result.resolved.symbol, "SNDK");
  assert.equal(result.resolved.companyName, "Sandisk Corporation");
  assert.equal(result.resolved.exchange, "NASDAQ");
});

test("company lookup resolves by company name", () => {
  const result = resolveStockQueryFromRows(rows, "Apple");
  assert.equal(result.ok, true);
  assert.equal(result.resolved.symbol, "AAPL");
});

test("ambiguous lookup returns selectable matches", () => {
  const result = resolveStockQueryFromRows(rows, "ab");
  assert.equal(result.ok, true);
  assert.equal(result.ambiguous, true);
  assert.deepEqual(result.matches.map((match) => match.symbol), ["ABC", "ABCL"]);
});

test("invalid lookup uses the required user-facing message", () => {
  const result = resolveStockQueryFromRows(rows, "not a real company");
  assert.equal(result.ok, false);
  assert.equal(result.error, "Freedom could not find that company or ticker.");
});

test("BUY NOW is not returned without a valid existing trade plan", () => {
  const decision = buildSingleStockDecision({
    analysis: analysis(),
    ranking: { results: [{ symbol: "SNDK", companyName: "Sandisk Corporation", status: "READY", recommendedEntry: 100, safetyExit: 94, takeSomeProfit: 112, finalExit: 118, riskReward: 3 }] },
  });
  assert.notEqual(decision.action, "BUY NOW");
});

test("BUY NOW is returned only when ranking has a valid CMC order", () => {
  const tradePlan = {
    symbol: "SNDK",
    companyName: "Sandisk Corporation",
    currency: "USD",
    buyTrigger: 100,
    safetyExit: 94,
    takeSomeProfit: 112,
    finalExit: 118,
    rewardToRisk: 3,
    positionSizing: { quantity: 5, errors: [] },
    cmcOrder: { broker: "CMC", action: "BUY", quantity: 5 },
  };
  const decision = buildSingleStockDecision({
    analysis: analysis(),
    ranking: { bestCurrentTrade: { ...tradePlan, status: "READY", currentPrice: 99, reason: "Ready by existing Freedom rules." }, bestTradePlan: tradePlan },
  });
  assert.equal(decision.action, "BUY NOW");
});

test("unavailable market data blocks trade action", () => {
  const status = marketDataStatusForAnalysis(analysis({ error: "History unavailable", marketData: { validated: false }, dataStatus: { readyForScore: false } }));
  const decision = buildSingleStockDecision({ analysis: analysis({ error: "History unavailable", marketData: { validated: false }, dataStatus: { readyForScore: false } }) });
  assert.equal(status.state, "unavailable");
  assert.equal(decision.action, "AVOID");
});
