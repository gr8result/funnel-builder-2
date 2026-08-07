import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOpportunityDecision,
  parseConfiguredUniverse,
  rankOpportunityDecisions,
  runOpportunityEngine,
  supportedUniverseForMarkets,
} from "../lib/freedom-trader/opportunityEngine.js";
import { effectiveTwelveDataBatchSize, twelveDataCreditCost } from "../lib/freedom-trader/marketDataService.js";
import { getMarketSessionState } from "../lib/freedom-trader/marketHours.js";
import {
  buildFailedFreedomScanSummary,
  buildFreedomScanSummaryFromEngine,
} from "../lib/freedom-trader/scanSummary.js";
import { buildScanSummary } from "../pages/api/freedom-trader/scanner.js";
import { generateFreedomTraderReport } from "../lib/freedom-trader/actionReport.js";
import { buildAssistantDecision } from "../lib/freedom-trader/assistantDecisionEngine.js";

const NOW = new Date("2026-07-30T22:00:00.000Z");

function analysis(symbol, overrides = {}) {
  return {
    symbol,
    companyName: symbol,
    exchange: "NASDAQ",
    currency: "USD",
    currentPrice: 100,
    volume: 2_000_000,
    tradingScore: 92,
    confidence: 92,
    priceTimestamp: "2026-07-30T21:30:00.000Z",
    dataQuality: "daily-only",
    dataStatus: {
      readyForScore: true,
      actualCandleCount: 240,
      latestTimestamp: "2026-07-30T21:30:00.000Z",
    },
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

test("complete scanner summary states checked and valid opportunity counts honestly", () => {
  const ready = buildOpportunityDecision(analysis("READY"), { now: NOW });
  const noAction = buildOpportunityDecision(analysis("NOPE", {
    tradingScore: 50,
    opportunity: {
      ...analysis("NOPE").opportunity,
      score: 50,
      confidenceScore: 50,
      riskReward: 0.8,
      failedConditions: ["risk/reward below configured minimum"],
    },
  }), { now: NOW });
  const summary = buildFreedomScanSummaryFromEngine({
    scanStartedAt: NOW.toISOString(),
    scanCompletedAt: NOW.toISOString(),
    scannedSymbols: ["READY", "NOPE"],
    supportedSymbols: ["READY", "NOPE"],
    decisions: [ready, noAction],
    results: [ready],
  });

  assert.equal(summary.status, "complete");
  assert.equal(summary.checkedCount, 2);
  assert.equal(summary.validOpportunityCount, 1);
  assert.equal(summary.plainEnglish, "Checked 2 companies. Found 1 valid opportunity.");
});

test("partial scanner summary separates analysed companies from unavailable market data", () => {
  const ready = buildOpportunityDecision(analysis("READY"), { now: NOW });
  const unavailable = buildOpportunityDecision(analysis("MISS", {
    dataStatus: {
      readyForScore: false,
      actualCandleCount: 0,
      latestTimestamp: "2026-07-30T21:30:00.000Z",
      status: "Provider returned no candles",
    },
    error: "Provider returned no candles",
  }), { now: NOW });
  const summary = buildFreedomScanSummaryFromEngine({
    scanStartedAt: NOW.toISOString(),
    scanCompletedAt: NOW.toISOString(),
    scannedSymbols: ["READY", "MISS"],
    supportedSymbols: ["READY", "MISS"],
    decisions: [ready, unavailable],
    results: [ready],
  });

  assert.equal(summary.status, "partial");
  assert.equal(summary.analysedCount, 1);
  assert.equal(summary.unavailableCount, 1);
  assert.equal(summary.plainEnglish, "Checked 2 companies. Found 1 valid opportunity.");
  assert.deepEqual(summary.unavailableReasons, ["Provider returned no candles"]);
});

test("failed scanner summary never reports a qualified trade", () => {
  const summary = buildFailedFreedomScanSummary({
    requestedCount: 12,
    universeCount: 48,
    error: "Market data provider failed",
  });

  assert.equal(summary.status, "failed");
  assert.equal(summary.analysedCount, 0);
  assert.equal(summary.unavailableCount, 12);
  assert.equal(summary.checkedCount, 12);
  assert.equal(summary.validOpportunityCount, 0);
  assert.equal(summary.plainEnglish, "Checked 12 companies. Found 0 valid opportunities.");
});

test("stale data is treated as unavailable and cannot enter ranked opportunities", () => {
  const stale = buildOpportunityDecision(analysis("STALE", {
    priceTimestamp: "2026-07-20T00:00:00.000Z",
    dataStatus: {
      readyForScore: true,
      actualCandleCount: 240,
      latestTimestamp: "2026-07-20T00:00:00.000Z",
    },
  }), { now: NOW });

  assert.equal(stale.couldAnalyse, false);
  assert.equal(stale.dataQualityStatus, "STALE");
  assert.equal(rankOpportunityDecisions([stale]).length, 0);
});

test("batch provider failure returns an honest failed scan instead of throwing", async () => {
  const result = await runOpportunityEngine({
    now: NOW,
    settings: { markets: ["US"], chunkSize: 2 },
    marketSnapshotBatch: async () => {
      throw new Error("Provider timeout");
    },
    analyser: async (symbol, snapshot) => {
      assert.equal(snapshot.dataQuality, "unavailable");
      return analysis(symbol, {
        currentPrice: null,
        tradingScore: null,
        dataQuality: "unavailable",
        dataStatus: {
          readyForScore: false,
          actualCandleCount: 0,
          latestTimestamp: null,
          status: snapshot.error,
        },
        error: snapshot.error,
      });
    },
  });
  const summary = buildFreedomScanSummaryFromEngine(result);

  assert.equal(result.ok, true);
  assert.equal(summary.status, "failed");
  assert.equal(summary.requestedCount, 2);
  assert.equal(summary.analysedCount, 0);
  assert.equal(summary.unavailableCount, 2);
  assert.equal(summary.validOpportunityCount, 0);
  assert.equal(summary.plainEnglish, "Checked 2 companies. Found 0 valid opportunities.");
});

test("ranked results remain ordered by opportunity quality", async () => {
  const result = await runOpportunityEngine({
    now: NOW,
    settings: { markets: ["US"], chunkSize: 3 },
    marketSnapshotBatch: async () => new Map(),
    analyser: async (symbol) => {
      if (symbol === "AAPL") return analysis(symbol, { tradingScore: 84, opportunity: { ...analysis(symbol).opportunity, score: 84, confidenceScore: 84, riskReward: 2.1 } });
      if (symbol === "MSFT") return analysis(symbol, { volume: 5_000_000, tradingScore: 96, opportunity: { ...analysis(symbol).opportunity, score: 96, confidenceScore: 96, riskReward: 3.2 } });
      return analysis(symbol, { currentPrice: 110, tradingScore: 94, opportunity: { ...analysis(symbol).opportunity, score: 94, confidenceScore: 94, riskReward: 3.4 } });
    },
  });

  assert.deepEqual(result.results.map((item) => item.symbol), ["MSFT", "AAPL", "NVDA"]);
});

test("scanner API summary keeps the required checked/found wording", async () => {
  const result = await runOpportunityEngine({
    now: NOW,
    settings: { markets: ["US"], chunkSize: 2 },
    marketSnapshotBatch: async () => new Map(),
    analyser: async (symbol) => analysis(symbol, {
      tradingScore: 50,
      opportunity: {
        ...analysis(symbol).opportunity,
        score: 50,
        confidenceScore: 50,
        riskReward: 0.8,
        failedConditions: ["risk/reward below configured minimum"],
      },
    }),
  });
  const summary = buildScanSummary(result);

  assert.equal(summary.status, "complete");
  assert.equal(summary.checkedCount, 2);
  assert.equal(summary.validOpportunityCount, 0);
  assert.equal(summary.plainEnglish, "Checked 2 companies. Found 0 valid opportunities.");
  assert.match(summary.opportunitySummary, /No trade currently meets your rules/);
});

test("scanner API states V1 is US-only and does not count ASX as unavailable", async () => {
  const result = await runOpportunityEngine({
    now: NOW,
    settings: { markets: ["US", "ASX"], chunkSize: 2 },
    marketSnapshotBatch: async (symbols) => {
      assert.deepEqual(symbols, ["AAPL", "MSFT"]);
      return new Map();
    },
    analyser: async (symbol) => analysis(symbol),
  });
  const summary = buildScanSummary(result);

  assert.deepEqual(summary.marketLabels, ["US"]);
  assert.deepEqual(summary.ignoredMarkets, ["ASX"]);
  assert.match(summary.marketScopeMessage, /US markets only/);
  assert.equal(summary.requestedCount, 2);
  assert.equal(summary.dataUnavailable, 0);
  assert.equal(summary.disabledSymbols.length, 0);
  assert.equal(summary.scannedSymbols.some((symbol) => symbol.endsWith(".AX")), false);
});

test("default V1 scan requests the configured US universe in priority order", async () => {
  const requested = [];
  const result = await runOpportunityEngine({
    now: NOW,
    settings: { markets: ["US"] },
    marketSnapshotBatch: async (symbols) => {
      requested.push(...symbols);
      return new Map();
    },
    analyser: async (symbol) => analysis(symbol),
  });
  const summary = buildScanSummary(result);

  assert.ok(result.supportedSymbols.length >= 90);
  assert.equal(result.scannedSymbols.length, 80);
  assert.equal(summary.configuredUniverseCount, result.supportedSymbols.length);
  assert.equal(summary.requestedCount, 80);
  assert.equal(summary.analysedCount + summary.unavailableCount, summary.requestedCount);
  assert.equal(summary.qualifiedCount + summary.notQualifiedCount, summary.analysedCount);
  assert.equal(summary.totalsBalanced, true);
  assert.deepEqual(requested.slice(0, 7), ["AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL", "AVGO"]);
});

test("full configured scan totals balance when the requested chunk covers the universe", async () => {
  const result = await runOpportunityEngine({
    now: NOW,
    settings: { markets: ["US"], chunkSize: 250 },
    marketSnapshotBatch: async () => new Map(),
    analyser: async (symbol) => analysis(symbol, {
      tradingScore: 50,
      opportunity: {
        ...analysis(symbol).opportunity,
        score: 50,
        confidenceScore: 50,
        riskReward: 0.8,
        failedConditions: ["risk/reward below configured minimum"],
      },
    }),
  });
  const summary = buildScanSummary(result);

  assert.equal(result.scannedSymbols.length, result.supportedSymbols.length);
  assert.equal(summary.status, "complete");
  assert.equal(summary.requested, summary.successfullyAnalysed + summary.dataUnavailable);
  assert.equal(summary.successfullyAnalysed, summary.qualified + summary.notQualified);
  assert.equal(summary.totalsBalanced, true);
});

test("scanner summary includes provider status and latest market-data timestamp", async () => {
  const result = await runOpportunityEngine({
    now: NOW,
    settings: { markets: ["US"], chunkSize: 2 },
    marketSnapshotBatch: async () => new Map(),
    analyser: async (symbol) => analysis(symbol, {
      dataStatus: {
        readyForScore: true,
        actualCandleCount: 240,
        latestTimestamp: "2026-07-30T21:30:00.000Z",
        provider: "Twelve Data",
      },
    }),
  });
  const summary = buildScanSummary(result);

  assert.equal(summary.providerStatus, "Available");
  assert.equal(summary.providerUsage["Twelve Data"], 2);
  assert.equal(summary.lastMarketDataTimestamp, "2026-07-30T21:30:00.000Z");
  assert.equal(typeof summary.elapsedMs, "number");
  assert.equal(summary.marketState[0].market, "US");
  assert.ok(["open", "closed"].includes(summary.marketState[0].state));
});

test("market data credit accounting uses one Twelve Data credit per unique symbol", () => {
  assert.equal(twelveDataCreditCost(["AAPL", "MSFT", "AAPL", "msft"]), 2);
  assert.equal(effectiveTwelveDataBatchSize({ configuredBatchSize: 8, creditsPerMinute: 7 }), 7);
  assert.equal(effectiveTwelveDataBatchSize({ configuredBatchSize: 4, creditsPerMinute: 60 }), 4);
});

test("configured US universe entries can be appended without changing scanner code", () => {
  const parsed = parseConfiguredUniverse("XYZ|Example Corp|Software, ABC|Another Corp|Healthcare", "US");
  assert.deepEqual(parsed.map((item) => item.symbol), ["XYZ", "ABC"]);

  const original = process.env.FREEDOM_TRADER_US_UNIVERSE;
  process.env.FREEDOM_TRADER_US_UNIVERSE = "ZZZT|Configured Test|Software";
  try {
    const universe = supportedUniverseForMarkets(["US"]);
    assert.ok(universe.some((item) => item.symbol === "ZZZT" && item.universe === "Configured US shares"));
  } finally {
    if (original === undefined) delete process.env.FREEDOM_TRADER_US_UNIVERSE;
    else process.env.FREEDOM_TRADER_US_UNIVERSE = original;
  }
});

test("market-hours behaviour distinguishes regular US market hours from closure", () => {
  const open = getMarketSessionState("US", new Date("2026-08-03T15:00:00.000Z"));
  const closed = getMarketSessionState("US", new Date("2026-08-08T15:00:00.000Z"));

  assert.equal(open.state, "open");
  assert.equal(open.isOpen, true);
  assert.equal(closed.state, "closed");
  assert.equal(closed.isOpen, false);
});

test("current data failure clears stale score and trade-plan fields", () => {
  const unavailable = buildOpportunityDecision(analysis("OLD", {
    currentPrice: 100,
    tradingScore: 95,
    confidence: 95,
    dataQuality: "unavailable",
    dataStatus: {
      readyForScore: false,
      actualCandleCount: 0,
      latestTimestamp: null,
      status: "Historical price data could not be loaded.",
      errorCode: "permission-denied",
    },
    error: "Historical price data could not be loaded.",
    errorCode: "permission-denied",
  }), { now: NOW });

  assert.equal(unavailable.analysed, false);
  assert.equal(unavailable.qualified, null);
  assert.equal(unavailable.tradingScore, null);
  assert.equal(unavailable.confidence, null);
  assert.equal(unavailable.entry, null);
  assert.equal(unavailable.safetyExit, null);
  assert.equal(unavailable.takeSomeProfit, null);
  assert.equal(unavailable.finalExit, null);
  assert.equal(unavailable.quoteStatus, "permission-denied");
  assert.equal(unavailable.historyStatus, "permission-denied");
});

test("rate-limited provider results are unavailable and not ranked", () => {
  const limited = buildOpportunityDecision(analysis("RATE", {
    dataQuality: "unavailable",
    dataStatus: {
      readyForScore: false,
      actualCandleCount: 0,
      latestTimestamp: null,
      status: "Twelve Data's per-minute request limit was reached.",
      errorCode: "rate-limited",
    },
    error: "Twelve Data's per-minute request limit was reached.",
    errorCode: "rate-limited",
  }), { now: NOW });

  assert.equal(limited.analysed, false);
  assert.equal(limited.quoteStatus, "rate-limited");
  assert.equal(limited.historyStatus, "rate-limited");
  assert.equal(rankOpportunityDecisions([limited]).length, 0);
});

test("impossible summary totals fail closed", () => {
  const ready = buildOpportunityDecision(analysis("READY"), { now: NOW });
  const summary = buildFreedomScanSummaryFromEngine({
    scanStartedAt: NOW.toISOString(),
    scanCompletedAt: NOW.toISOString(),
    scannedSymbols: ["READY", "MISSING"],
    supportedSymbols: ["READY", "MISSING"],
    decisions: [ready],
    results: [ready],
  });

  assert.equal(summary.status, "partial");
  assert.equal(summary.requestedCount, 2);
  assert.equal(summary.analysedCount, 1);
  assert.equal(summary.unavailableCount, 1);
  assert.equal(summary.totalsValid, true);
});

test("partial and failed scans cannot produce assistant buy advice", () => {
  const ready = buildOpportunityDecision(analysis("READY"), { now: NOW });
  const partialSummary = {
    status: "partial",
    requestedCount: 2,
    analysedCount: 1,
    unavailableCount: 1,
    qualifiedCount: 1,
    notQualifiedCount: 0,
  };
  const report = generateFreedomTraderReport({
    scannerRows: [ready],
    scanSummary: partialSummary,
    settings: { accountCurrency: "USD", currencyConversionRates: { USD: 1 } },
    now: NOW,
  });
  const decision = buildAssistantDecision({ report, scanSummary: partialSummary });

  assert.notEqual(report.recommendations[0]?.status, "READY TO BUY");
  assert.notEqual(decision.state, "READY TO PREPARE");
  assert.equal(decision.action, "WAIT");
});
