import assert from "node:assert/strict";
import test from "node:test";
import { rankMarketOpportunities } from "../lib/freedom-trader/opportunityRanking.js";

const settings = {
  minimumScore: 82,
  minimumDailyVolume: 1_000_000,
  minimumRiskReward: 2,
  maximumVolatility: 9,
};

function row(symbol, overrides = {}) {
  const currentPrice = overrides.currentPrice ?? 100;
  const entry = overrides.entry ?? 100;
  const stop = overrides.stop ?? 94;
  const target = overrides.target ?? 114;
  const risk = entry - stop;
  const reward = target - entry;
  return {
    symbol,
    companyName: `${symbol} Corp`,
    exchange: "NASDAQ",
    currency: "USD",
    currentPrice,
    changePercent: overrides.changePercent ?? 1.2,
    volume: overrides.volume ?? 2_500_000,
    candleCount: overrides.candleCount ?? 240,
    tradingScore: overrides.tradingScore ?? 88,
    confidence: overrides.confidence ?? 86,
    trend: overrides.trend ?? "Uptrend",
    dataStatus: { readyForScore: overrides.readyForScore ?? true, actualCandleCount: overrides.candleCount ?? 240, latestTimestamp: overrides.latestTimestamp ?? "2026-08-07" },
    marketData: { validated: overrides.validated ?? true, latestCandleDate: overrides.latestTimestamp ?? "2026-08-07" },
    indicators: {
      ma20: overrides.ma20 ?? 98,
      ma50: overrides.ma50 ?? 95,
      ma200: overrides.ma200 ?? 90,
      relativeVolume: overrides.relativeVolume ?? 1.4,
      volatility20: overrides.volatility20 ?? 4,
    },
    scoreExplanation: {
      trendStrength: { score: overrides.trendQuality ?? 88 },
      momentum: { score: overrides.momentum ?? 84 },
      volumeConfirmation: { score: overrides.volumeScore ?? 82 },
      volatilitySuitability: { score: overrides.volatilityScore ?? 86 },
    },
    setup: {
      valid: true,
      plannedEntry: entry,
      stop,
      target,
      riskPerShare: risk,
      rewardPerShare: reward,
      riskRewardRatio: overrides.riskReward ?? reward / risk,
      setupReasoning: overrides.setupReasoning ?? "Pullback setup with a defined stop and target.",
      setupExpiryDate: "2026-08-21T00:00:00.000Z",
    },
  };
}

test("100 analysed rows returns five displayed opportunities and counts qualified rows", () => {
  const rows = Array.from({ length: 100 }, (_, index) => row(`T${index}`, { currentPrice: 100 + (index % 4), entry: 100, tradingScore: 82 + (index % 12) }));
  const ranking = rankMarketOpportunities(rows, settings, { now: "2026-08-09T00:00:00Z" });
  assert.equal(ranking.topFive.length, 5);
  assert.equal(ranking.qualified.length, 100);
});

test("zero qualified rows returns no current trade and no setup to watch when rules fail", () => {
  const ranking = rankMarketOpportunities([row("LOW", { volume: 1000, tradingScore: 55 })], settings, { now: "2026-08-09T00:00:00Z" });
  assert.equal(ranking.bestCurrentTrade, null);
  assert.equal(ranking.bestSetupToWatch, null);
  assert.equal(ranking.topOpportunity, null);
  assert.equal(ranking.topFive.length, 0);
  assert.equal(ranking.qualified.length, 0);
});

test("more than five qualified rows still displays maximum five", () => {
  const ranking = rankMarketOpportunities(Array.from({ length: 12 }, (_, index) => row(`Q${index}`)), settings, { now: "2026-08-09T00:00:00Z" });
  assert.equal(ranking.topFive.length, 5);
});

test("highest raw technical score is not automatically best executable trade", () => {
  const distant = row("FAR", { tradingScore: 98, currentPrice: 112, entry: 100 });
  const ready = row("NOW", { tradingScore: 91, currentPrice: 100.2, entry: 100 });
  const ranking = rankMarketOpportunities([distant, ready], settings, { now: "2026-08-09T00:00:00Z" });
  assert.equal(ranking.topOpportunity.symbol, "NOW");
  assert.equal(ranking.bestCurrentTrade.symbol, "NOW");
});

test("READY outranks distant WAIT where appropriate", () => {
  const wait = row("WAIT", { currentPrice: 106, entry: 100, tradingScore: 94 });
  const ready = row("READY", { currentPrice: 100.4, entry: 100, tradingScore: 86 });
  const ranking = rankMarketOpportunities([wait, ready], settings, { now: "2026-08-09T00:00:00Z" });
  assert.equal(ranking.topFive[0].symbol, "READY");
  assert.equal(ranking.topFive[0].status, "READY");
});

test("stale data, insufficient liquidity and poor reward risk are excluded", () => {
  const ranking = rankMarketOpportunities([
    row("STALE", { latestTimestamp: "2026-07-20" }),
    row("ILLIQ", { volume: 10_000 }),
    row("BADRR", { riskReward: 1.3 }),
  ], settings, { now: "2026-08-09T00:00:00Z" });
  assert.equal(ranking.qualified.length, 0);
  assert.equal(ranking.ranked.every((item) => item.status !== "READY" && item.status !== "WAIT"), true);
});

test("price already beyond entry is skipped and entry not reached is wait", () => {
  const ranking = rankMarketOpportunities([
    row("CHASE", { currentPrice: 112, entry: 100 }),
    row("PULL", { currentPrice: 104, entry: 100 }),
  ], settings, { now: "2026-08-09T00:00:00Z" });
  assert.equal(ranking.ranked.find((item) => item.symbol === "CHASE").status, "SKIP");
  assert.equal(ranking.ranked.find((item) => item.symbol === "PULL").status, "WAIT");
});

test("ranking is deterministic and explains why number one ranked first", () => {
  const rankingA = rankMarketOpportunities([row("BBB"), row("AAA")], settings, { now: "2026-08-09T00:00:00Z" });
  const rankingB = rankMarketOpportunities([row("BBB"), row("AAA")], settings, { now: "2026-08-09T00:00:00Z" });
  assert.deepEqual(rankingA.topFive.map((item) => item.symbol), rankingB.topFive.map((item) => item.symbol));
  assert.ok(rankingA.topOpportunity.whyRankedFirst.length > 0);
});

test("primary explanations avoid technical jargon and Trader statuses never emit STRONG BUY", () => {
  const ranking = rankMarketOpportunities([row("PLAIN")], settings, { now: "2026-08-09T00:00:00Z" });
  const reason = `${ranking.topOpportunity.reason} ${ranking.topOpportunity.plainEnglish.join(" ")}`;
  assert.doesNotMatch(reason, /\bRSI\b|\bMACD\b|\bATR\b|\bEMA\b|Fibonacci/i);
  assert.equal(ranking.ranked.some((item) => /STRONG BUY/i.test(item.status)), false);
});

test("dashboard and opportunities page can use the identical ranked payload", () => {
  const ranking = rankMarketOpportunities([row("SAME"), row("NEXT", { currentPrice: 104 })], settings, { now: "2026-08-09T00:00:00Z" });
  const payload = { topFive: ranking.topFive, topOpportunity: ranking.topOpportunity };
  assert.equal(payload.topFive[0].symbol, payload.topOpportunity.symbol);
});

test("scanner can display developing setups without treating them as ready trades", () => {
  const developing = row("DEV", { tradingScore: 78, currentPrice: 100, entry: 100 });
  const ranking = rankMarketOpportunities([developing], settings, { now: "2026-08-09T00:00:00Z", includeDevelopingTopFive: true });
  assert.equal(ranking.bestCurrentTrade, null);
  assert.equal(ranking.qualified.length, 0);
  assert.equal(ranking.topFive.length, 1);
  assert.equal(ranking.topFive[0].status, "DEVELOPING");
});
