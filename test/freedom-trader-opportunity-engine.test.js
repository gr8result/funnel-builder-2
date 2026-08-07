import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOpportunityDecision,
  calculateOpportunityQuantity,
  rankOpportunityDecisions,
  runOpportunityEngine,
  supportedUniverseForMarkets,
  validateMarketData,
} from "../lib/freedom-trader/opportunityEngine.js";
import { DEFAULT_REPORT_SETTINGS, generateFreedomTraderReport } from "../lib/freedom-trader/actionReport.js";
import { buildFreedomScanSummaryFromEngine } from "../lib/freedom-trader/scanSummary.js";

const NOW = new Date("2026-07-30T22:00:00.000Z");

function analysis(symbol, overrides = {}) {
  return {
    symbol,
    companyName: symbol === "AVGO" ? "Broadcom" : symbol,
    exchange: "NASDAQ",
    currency: "USD",
    currentPrice: 100,
    volume: 2_000_000,
    tradingScore: 92,
    confidence: 92,
    priceTimestamp: "2026-07-30T21:30:00.000Z",
    dataQuality: "live",
    dataStatus: { readyForScore: true, actualCandleCount: 240, latestTimestamp: "2026-07-30T21:30:00.000Z" },
    indicators: { averageVolume20: 2_000_000, distanceFromResistance: 8 },
    setup: { plannedEntry: 101, stop: 96, target: 113, riskRewardRatio: 2.4 },
    opportunity: {
      score: 92,
      confidenceScore: 92,
      riskReward: 2.4,
      proposedEntryLow: 101,
      proposedEntryHigh: 102,
      stopLoss: 96,
      target1: 113,
      target2: 121,
      failedConditions: [],
      scoreBreakdown: { trend: { points: 21 } },
    },
    ...overrides,
  };
}

test("valid opportunity becomes READY TO BUY with a complete trade plan", () => {
  const result = buildOpportunityDecision(analysis("AVGO"), {
    now: NOW,
    settings: { minimumScore: 82, minimumRiskReward: 2, maximumPlannedLossPerTrade: 75, maximumPositionValue: 1250 },
  });
  assert.equal(result.companyName, "Broadcom");
  assert.equal(result.status, "READY TO BUY");
  assert.equal(result.tradePlan.entry, 101);
  assert.equal(result.tradePlan.safetyExit, 96);
  assert.equal(result.tradePlan.takeSomeProfit, 113);
  assert.equal(result.tradePlan.finalExit, 121);
  assert.equal(result.tradePlan.suggestedQuantity, 12);
  assert.equal(result.tradePlan.maximumLoss, 60);
  assert.match(result.plainEnglish, /Broadcom[\s\S]*READY TO BUY[\s\S]*Safety Exit/);
});

test("stale data is not analysed or ranked", () => {
  const stale = buildOpportunityDecision(analysis("STALE", {
    priceTimestamp: "2026-07-20T00:00:00.000Z",
    dataStatus: { readyForScore: true, actualCandleCount: 240, latestTimestamp: "2026-07-20T00:00:00.000Z" },
  }), { now: NOW });
  assert.equal(stale.status, "DATA UNAVAILABLE");
  assert.equal(stale.dataQualityStatus, "STALE");
  assert.equal(rankOpportunityDecisions([stale]).length, 0);
});

test("unsupported symbol is labelled Could not analyse", () => {
  const result = buildOpportunityDecision(analysis("BHP.AX"), {
    now: NOW,
    universeItem: { symbol: "BHP.AX", enabled: false, disabledReason: "Unsupported exchange" },
  });
  assert.equal(result.status, "DATA UNAVAILABLE");
  assert.equal(result.dataQualityStatus, "UNSUPPORTED");
  assert.equal(result.couldAnalyse, false);
  assert.equal(result.couldNotAnalyseReason, "Unsupported exchange");
});

test("missing candles and permission failures are Could not analyse, not failed trades", () => {
  assert.deepEqual(validateMarketData(analysis("MISS", {
    dataStatus: { readyForScore: false, actualCandleCount: 12, latestTimestamp: "2026-07-30T21:30:00.000Z" },
  }), {}, { now: NOW }).reason, "Insufficient history");
  assert.match(validateMarketData(analysis("PERM", {
    dataStatus: { readyForScore: false, permissionFailure: true, status: "permission failure" },
  }), {}, { now: NOW }).reason, /permission/i);
});

test("no opportunities returns a teaching summary", async () => {
  const result = await runOpportunityEngine({
    now: NOW,
    settings: { markets: ["US"], chunkSize: 2 },
    marketSnapshotBatch: async () => new Map(),
    analyser: async (symbol) => analysis(symbol, {
      tradingScore: 50,
      opportunity: { ...analysis(symbol).opportunity, score: 50, riskReward: 0.8, failedConditions: ["risk/reward below configured minimum"] },
    }),
  });
  assert.equal(result.results.length, 2);
  assert.equal(result.summary.counts["READY TO BUY"], 0);
  assert.match(result.summary.plainEnglish, /No trade currently meets your rules/);
});

test("V1 scanner ignores ASX settings and analyses the supported US universe only", async () => {
  const originalAsxFlag = process.env.FREEDOM_TRADER_ASX_MARKET_DATA_ENABLED;
  delete process.env.FREEDOM_TRADER_ASX_MARKET_DATA_ENABLED;
  try {
    const universe = supportedUniverseForMarkets(["ASX"]);
    assert.equal(universe.length, 0);

    const result = await runOpportunityEngine({
      now: NOW,
      settings: { markets: ["ASX"], chunkSize: 2 },
      marketSnapshotBatch: async (symbols) => {
        assert.deepEqual(symbols, ["AAPL", "MSFT"]);
        return new Map();
      },
      analyser: async (symbol) => analysis(symbol),
    });

    assert.deepEqual(result.settings.markets, ["US"]);
    assert.deepEqual(result.settings.ignoredMarkets, ["ASX"]);
    assert.match(result.settings.marketScopeMessage, /US markets only/);
    assert.deepEqual(result.scannedSymbols, ["AAPL", "MSFT"]);
    assert.equal(result.disabledSymbols.length, 0);
    assert.equal(result.decisions.some((item) => String(item.symbol).endsWith(".AX")), false);
  } finally {
    if (originalAsxFlag === undefined) delete process.env.FREEDOM_TRADER_ASX_MARKET_DATA_ENABLED;
    else process.env.FREEDOM_TRADER_ASX_MARKET_DATA_ENABLED = originalAsxFlag;
  }
});

test("shared scan summary records complete, partial and ranked decision counts", () => {
  const ready = buildOpportunityDecision(analysis("READY"), { now: NOW });
  const missing = buildOpportunityDecision(analysis("MISS", {
    dataStatus: { readyForScore: false, actualCandleCount: 12, latestTimestamp: "2026-07-30T21:30:00.000Z" },
  }), { now: NOW });
  const summary = buildFreedomScanSummaryFromEngine({
    scanStartedAt: NOW.toISOString(),
    scanCompletedAt: NOW.toISOString(),
    scannedSymbols: ["READY", "MISS"],
    supportedSymbols: ["READY", "MISS"],
    decisions: [ready, missing],
    results: [ready],
  });
  assert.equal(summary.status, "partial");
  assert.equal(summary.requestedCount, 2);
  assert.equal(summary.analysedCount, 1);
  assert.equal(summary.unavailableCount, 1);
  assert.equal(summary.qualifiedCount, 1);
  assert.equal(summary.rankedResults.length, 0);
});

test("multiple opportunities are ranked by action, confidence, reward/risk, liquidity and data quality", () => {
  const ranked = rankOpportunityDecisions([
    buildOpportunityDecision(analysis("LOW", { opportunity: { ...analysis("LOW").opportunity, score: 84, confidenceScore: 84, riskReward: 2.1 }, tradingScore: 84 }), { now: NOW }),
    buildOpportunityDecision(analysis("BEST", { volume: 5_000_000, opportunity: { ...analysis("BEST").opportunity, score: 96, confidenceScore: 96, riskReward: 3.2 }, tradingScore: 96 }), { now: NOW }),
    buildOpportunityDecision(analysis("DEV", { currentPrice: 110, opportunity: { ...analysis("DEV").opportunity, score: 94, confidenceScore: 94, riskReward: 3.4 }, tradingScore: 94 }), { now: NOW }),
  ]);
  assert.deepEqual(ranked.map((item) => item.symbol), ["BEST", "LOW", "DEV"]);
});

test("quantity calculation respects risk and position value", () => {
  const sizing = calculateOpportunityQuantity({ entry: 101, safetyExit: 96, settings: { maximumPlannedLossPerTrade: 75, maximumPositionValue: 1250 } });
  assert.equal(sizing.quantity, 12);
  assert.equal(sizing.maximumLoss, 60);
});

test("report and alert integration consume engine decisions without recalculating scanner rules", () => {
  const decision = buildOpportunityDecision(analysis("AVGO"), { now: NOW });
  const report = generateFreedomTraderReport({
    now: NOW,
    scannerRows: [decision],
    positions: [],
    pendingOrders: [],
    settings: { ...DEFAULT_REPORT_SETTINGS, accountCurrency: "USD", currencyConversionRates: { USD: 1 } },
  });
  assert.equal(report.recommendations[0].status, "READY TO BUY");
  assert.equal(report.orderInstructions.ordersToPrepare[0].symbol, "AVGO");
  assert.equal(report.actionAlerts[0].action, "BUY");
});
