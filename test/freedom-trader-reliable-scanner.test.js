import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOpportunityDecision,
  rankOpportunityDecisions,
  runOpportunityEngine,
} from "../lib/freedom-trader/opportunityEngine.js";
import {
  buildFailedFreedomScanSummary,
  buildFreedomScanSummaryFromEngine,
} from "../lib/freedom-trader/scanSummary.js";

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
