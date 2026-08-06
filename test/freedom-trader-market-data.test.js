import assert from "node:assert/strict";
import test from "node:test";
import { classifyTwelveDataError, fetchTwelveDataHistory } from "../lib/freedom-trader/twelveData.js";
import { evaluateOpportunity } from "../lib/freedom-trader/opportunityEngine.js";
import { analyseSymbol } from "../pages/api/freedom-trader/analysis.js";

// --- Provider error classification (Stage 1: distinguish plan restriction
// from a transient rate limit from a generic failure) ---

test("classifies a Twelve Data plan-restriction error", () => {
  assert.equal(classifyTwelveDataError("This symbol is available starting with the Pro or Venture plan."), "plan-restricted");
});

test("classifies a Twelve Data per-minute rate limit error", () => {
  assert.equal(classifyTwelveDataError("You have run out of API credits for the current minute."), "rate-limited");
});

test("classifies an unrecognised error as generic", () => {
  assert.equal(classifyTwelveDataError("Network failure"), "error");
});

test("classifies provider status failures without exposing credentials", () => {
  assert.equal(classifyTwelveDataError("Unauthorized", 401), "auth-required");
  assert.equal(classifyTwelveDataError("Forbidden", 403), "permission-denied");
  assert.equal(classifyTwelveDataError("Too many requests", 429), "rate-limited");
  assert.equal(classifyTwelveDataError("Request timed out"), "timeout");
  assert.equal(classifyTwelveDataError("Malformed JSON response"), "malformed-provider-response");
});

test("Twelve Data parser rejects candles with invalid dates or zero prices", async () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.TWELVE_DATA_API_KEY;
  process.env.TWELVE_DATA_API_KEY = "test-key";
  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      meta: { symbol: "BAD", interval: "1day", exchange: "NASDAQ", currency: "USD" },
      values: [
        { datetime: "not-a-date", open: "100", high: "101", low: "99", close: "100", volume: "1000000" },
        { datetime: "2026-08-04", open: "0", high: "101", low: "99", close: "100", volume: "1000000" },
        { datetime: "2026-08-05", open: "100", high: "102", low: "99", close: "101", volume: "1000000" },
      ],
    }),
  });

  try {
    const history = await fetchTwelveDataHistory({ symbol: "BAD", range: "1y", interval: "1day" });
    assert.equal(history.ok, true);
    assert.equal(history.candleCount, 1);
    assert.equal(history.candles[0].date, "2026-08-05");
    assert.equal(Number.isFinite(history.candles[0].timestamp), true);
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.TWELVE_DATA_API_KEY;
    else process.env.TWELVE_DATA_API_KEY = originalKey;
  }
});

// --- Synthetic candle builder for deterministic scoring tests ---

function buildCandles({ days = 220, startPrice = 100, drift = 0.15, finalPullbackPercent = 0 } = {}) {
  const candles = [];
  let price = startPrice;
  const start = new Date("2026-01-01T00:00:00Z");
  for (let i = 0; i < days; i += 1) {
    const wobble = Math.sin(i / 5) * 0.6;
    price = Math.max(1, price + drift + wobble);
    if (i === days - 1 && finalPullbackPercent) price *= 1 - finalPullbackPercent / 100;
    const open = price - 0.3;
    const close = price;
    const high = Math.max(open, close) + 0.4;
    const low = Math.min(open, close) - 0.4;
    const date = new Date(start.getTime() + i * 86400000).toISOString().slice(0, 10);
    candles.push({ date, open: Number(open.toFixed(2)), high: Number(high.toFixed(2)), low: Number(low.toFixed(2)), close: Number(close.toFixed(2)), volume: 2_000_000 + (i % 5) * 100000 });
  }
  return candles;
}

function fakeSnapshot(candles, overrides = {}) {
  const latest = candles[candles.length - 1];
  return {
    symbol: "TEST",
    exchange: "NASDAQ",
    currency: "USD",
    quote: { price: latest.close, previousClose: candles[candles.length - 2]?.close ?? null, change: null, changePercent: null, timestamp: latest.date, delayed: true },
    candles: { daily: candles, intraday: null },
    averageVolume: 2_000_000,
    source: "Twelve Data",
    fetchedAt: new Date().toISOString(),
    dataQuality: "daily-only",
    candleCount: candles.length,
    error: null,
    ...overrides,
  };
}

// --- Data-availability classification (Stage 1/2/4: "data unavailable" must
// never be scored like a rejected trade) ---

test("analyseSymbol reports DATA UNAVAILABLE (not a score) when the snapshot has no usable data", async () => {
  const snapshot = {
    symbol: "BHP.AX",
    exchange: "ASX",
    currency: "AUD",
    quote: { price: null, previousClose: null, change: null, changePercent: null, timestamp: null, delayed: true },
    candles: { daily: [], intraday: null },
    averageVolume: null,
    source: "Twelve Data",
    fetchedAt: new Date().toISOString(),
    dataQuality: "unavailable",
    candleCount: 0,
    error: "ASX market data requires a Twelve Data Pro/Venture plan (or an alternative ASX-capable provider). Currently on the Basic plan.",
  };
  const row = await analyseSymbol("BHP.AX", snapshot);
  assert.equal(row.status, "DATA UNAVAILABLE");
  assert.equal(row.currentPrice, null);
  assert.equal(row.tradingScore, null);
  assert.match(row.error, /Pro\/Venture plan/);
});

test("analyseSymbol produces a real score, not a rejection, once 200+ candles are available", async () => {
  const candles = buildCandles({ days: 220, drift: 0.2 });
  const snapshot = fakeSnapshot(candles);
  const row = await analyseSymbol("TEST", snapshot);
  assert.notEqual(row.status, "DATA UNAVAILABLE");
  assert.equal(row.dataStatus.readyForScore, true);
  assert.ok(Number.isFinite(row.tradingScore));
  assert.ok(row.tradingScore >= 0 && row.tradingScore <= 100);
});

test("analyseSymbol flags insufficient history as not-ready-for-score and fails the setup, without inventing a live price", async () => {
  const candles = buildCandles({ days: 50 });
  const snapshot = fakeSnapshot(candles);
  const row = await analyseSymbol("TEST", snapshot);
  assert.equal(row.dataStatus.readyForScore, false);
  assert.match(row.dataStatus.status, /200 candles/);
  assert.ok(row.opportunity.failedConditions.some((reason) => /insufficient candle history/i.test(reason)));
  assert.notEqual(row.status, "DATA UNAVAILABLE");
  assert.notEqual(row.status, "STRONG BUY");
  assert.notEqual(row.status, "BUY");
});

test("analyseSymbol cannot score malformed daily candles as a trade candidate", async () => {
  const candles = buildCandles({ days: 220 }).map((candle) => ({ ...candle, date: "not-a-date", timestamp: NaN }));
  const snapshot = fakeSnapshot(candles);
  const row = await analyseSymbol("TEST", snapshot);
  assert.equal(row.status, "DATA UNAVAILABLE");
  assert.equal(row.dataStatus.readyForScore, false);
  assert.equal(row.dataStatus.actualCandleCount, 0);
  assert.equal(row.tradingScore, null);
  assert.equal(row.opportunity.failedConditions.some((reason) => /history|candles/i.test(reason)), true);
});

// --- Scoring / entry-stop-target / risk-reward (Stage 4/5) ---

test("evaluateOpportunity produces a breakdown that sums to the total score and includes reasons", () => {
  const opportunity = evaluateOpportunity({
    ticker: "TEST",
    companyName: "Test Co",
    exchange: "NASDAQ",
    currency: "USD",
    currentPrice: 100,
    indicators: { ma20: 95, ma50: 90, ma200: 80, rsi14: 58, macdHistogram: 0.4, relativeVolume: 1.4, volatility20: 3.5, distanceFromSupport: 2, distanceFromResistance: 6 },
    volume: 2_000_000,
    setup: { plannedEntry: 100, stop: 95, target: 112, riskRewardRatio: 2.4 },
    dataStatus: { readyForScore: true, actualCandleCount: 220, latestTimestamp: new Date().toISOString() },
    marketData: { validated: true },
  });
  const total = Object.values(opportunity.scoreBreakdown).reduce((sum, item) => sum + item.points, 0);
  assert.equal(Math.round(total), opportunity.score);
  assert.ok(opportunity.reasonsFor.length > 0);
  assert.ok(["READY TO BUY", "DEVELOPING", "WAIT", "NO ACTION", "DATA UNAVAILABLE"].includes(opportunity.overallStatus));
});

test("evaluateOpportunity rejects a setup below the minimum risk/reward with a clear reason", () => {
  const opportunity = evaluateOpportunity({
    ticker: "TEST",
    currentPrice: 100,
    indicators: { ma20: 95, ma50: 90, ma200: 80, rsi14: 58, macdHistogram: 0.4, relativeVolume: 1.4, volatility20: 3.5, distanceFromSupport: 2, distanceFromResistance: 6 },
    volume: 2_000_000,
    setup: { plannedEntry: 100, stop: 98, target: 102, riskRewardRatio: 1 },
    dataStatus: { readyForScore: true, actualCandleCount: 220, latestTimestamp: new Date().toISOString() },
    marketData: { validated: true },
  });
  assert.ok(opportunity.failedConditions.some((reason) => /risk\/reward/i.test(reason)));
  assert.notEqual(opportunity.overallStatus, "STRONG BUY");
});
