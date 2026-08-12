import assert from "node:assert/strict";
import test from "node:test";
import { buildFreedomTradePlan, calculateFreedomPositionSize, rankMarketOpportunities } from "../lib/freedom-trader/opportunityRanking.js";

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
      takeSomeProfit: overrides.takeSomeProfit ?? target,
      finalExit: overrides.finalExit ?? target,
      riskPerShare: risk,
      rewardPerShare: reward,
      riskRewardRatio: overrides.riskReward ?? reward / risk,
      setupReasoning: overrides.setupReasoning ?? "Pullback setup with a defined stop and target.",
      setupExpiryDate: "2026-08-21T00:00:00.000Z",
    },
    setupClassification: {
      setupType: overrides.setupType ?? "PULLBACK_REVERSAL",
      recentHigh: overrides.recentHigh ?? 112,
      pullbackLow: overrides.pullbackLow ?? 94,
      pullbackPercent: overrides.pullbackPercent ?? 16.07,
      pullbackDuration: overrides.pullbackDuration ?? 12,
      distanceFromRecentHigh: overrides.distanceFromRecentHigh ?? 12,
      riseFromPullbackLow: overrides.riseFromPullbackLow ?? 6.38,
      reversalState: overrides.reversalState ?? "REVERSAL_CONFIRMED",
      reversalConfirmation: overrides.reversalConfirmation ?? entry,
      preferredEntry: entry,
      distanceFromPreferredEntry: ((currentPrice - entry) / entry) * 100,
      overextended: overrides.overextended ?? false,
      evidence: overrides.evidence ?? ["higher low", "price holding near support", "break above short-term confirmation", "short-term trend turning upward"],
      qualityScore: overrides.qualityScore ?? 88,
    },
  };
}

test("100 analysed rows returns five displayed opportunities and counts qualified rows", () => {
  const rows = Array.from({ length: 100 }, (_, index) => row(`T${index}`, { currentPrice: 100 + (index % 2) * 0.25, entry: 100, tradingScore: 82 + (index % 12) }));
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
  const wait = row("WAIT", { currentPrice: 104, entry: 100, tradingScore: 94, overextended: true });
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

test("unavailable data is excluded from best trade selection", () => {
  const ranking = rankMarketOpportunities([
    row("BAD", { readyForScore: false }),
    row("GOOD", { currentPrice: 100.1, entry: 100 }),
  ], settings, { now: "2026-08-09T00:00:00Z" });
  assert.equal(ranking.ranked.find((item) => item.symbol === "BAD").status, "DATA UNAVAILABLE");
  assert.equal(ranking.bestCurrentTrade.symbol, "GOOD");
});

test("invalid trade-plan ordering rejects a READY-looking setup", () => {
  const ranking = rankMarketOpportunities([row("BADPLAN", { stop: 102 })], settings, { now: "2026-08-09T00:00:00Z" });
  assert.equal(ranking.bestCurrentTrade, null);
  assert.match(ranking.ranked[0].eligibilityReasons.join(" "), /safety exit/i);
});

test("best current trade includes complete CMC plan and position sizing", () => {
  const ranking = rankMarketOpportunities([row("PLAN", { currentPrice: 100.2, entry: 100, stop: 94, target: 118 })], settings, {
    now: "2026-08-09T00:00:00Z",
    account: { currency: "USD", availableCash: 20_000 },
    positionSettings: { maximumCapitalPerTrade: 2500, maximumAcceptableLoss: 300 },
  });
  assert.equal(ranking.bestTradePlan.symbol, "PLAN");
  assert.equal(ranking.bestTradePlan.cmcOrder.broker, "CMC");
  assert.equal(ranking.bestTradePlan.cmcOrder.orderType, "LIMIT");
  assert.equal(ranking.bestTradePlan.positionSizing.quantity, 25);
  assert.equal(ranking.bestTradePlan.positionSizing.capitalRequired, 2500);
  assert.equal(ranking.bestTradePlan.positionSizing.maximumPlannedLoss, 150);
});

test("insufficient cash and whole-share sizing are respected", () => {
  const plan = { currency: "USD", buyTrigger: 100, safetyExit: 90, takeSomeProfit: 120, finalExit: 130 };
  const sized = calculateFreedomPositionSize(plan, { currency: "USD", availableCash: 150 }, { maximumCapitalPerTrade: 1000, maximumAcceptableLoss: 100 });
  assert.equal(sized.quantity, 1);
  assert.equal(sized.ok, true);
  const none = calculateFreedomPositionSize(plan, { currency: "USD", availableCash: 50 }, { maximumCapitalPerTrade: 1000, maximumAcceptableLoss: 100 });
  assert.equal(none.ok, false);
  assert.match(none.errors.join(" "), /zero/i);
});

test("CMC instructions contain no Tiger wording in current workflow", () => {
  const plan = buildFreedomTradePlan({
    status: "READY",
    symbol: "CMC",
    companyName: "CMC Test",
    currency: "USD",
    currentPrice: 100,
    recommendedEntry: 100,
    safetyExit: 94,
    takeSomeProfit: 112,
    finalExit: 118,
    riskReward: 3,
  }, { currency: "USD", availableCash: 10_000 });
  assert.match(JSON.stringify(plan.cmcOrder), /CMC/);
  assert.doesNotMatch(JSON.stringify(plan), /Tiger/i);
});

test("price already beyond entry is skipped and entry not reached is wait", () => {
  const ranking = rankMarketOpportunities([
    row("CHASE", { currentPrice: 112, entry: 100, overextended: true }),
    row("PULL", { currentPrice: 98, entry: 100, reversalState: "REVERSAL_DEVELOPING" }),
  ], settings, { now: "2026-08-09T00:00:00Z" });
  assert.equal(ranking.ranked.find((item) => item.symbol === "CHASE").status, "OVEREXTENDED");
  assert.equal(ranking.ranked.find((item) => item.symbol === "PULL").status, "REVERSAL DEVELOPING");
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
  const developing = row("DEV", { tradingScore: 78, currentPrice: 100, entry: 100, reversalState: "REVERSAL_DEVELOPING" });
  const ranking = rankMarketOpportunities([developing], settings, { now: "2026-08-09T00:00:00Z", includeDevelopingTopFive: true });
  assert.equal(ranking.bestCurrentTrade, null);
  assert.equal(ranking.qualified.length, 0);
  assert.equal(ranking.topFive.length, 1);
  assert.equal(ranking.topFive[0].status, "REVERSAL DEVELOPING");
});

test("clean pullback with confirmed reversal becomes READY", () => {
  const ranking = rankMarketOpportunities([row("REV", { currentPrice: 100.2, entry: 100 })], settings, { now: "2026-08-09T00:00:00Z" });
  assert.equal(ranking.bestCurrentTrade.symbol, "REV");
  assert.equal(ranking.topFive[0].primarySetupType, "PULLBACK_REVERSAL");
});

test("pullback still falling waits for reversal", () => {
  const ranking = rankMarketOpportunities([row("FALL", { setupType: "FALLING_NO_REVERSAL", reversalState: "STILL_FALLING" })], settings, { now: "2026-08-09T00:00:00Z", includeDevelopingTopFive: true });
  assert.equal(ranking.topFive[0].status, "WAIT FOR REVERSAL");
  assert.equal(ranking.bestCurrentTrade, null);
});

test("large rally after reversal becomes overextended", () => {
  const ranking = rankMarketOpportunities([row("LATE", { currentPrice: 111, entry: 100, overextended: true, riseFromPullbackLow: 18 })], settings, { now: "2026-08-09T00:00:00Z", includeDevelopingTopFive: true });
  assert.equal(ranking.ranked[0].status, "OVEREXTENDED");
  assert.equal(ranking.topFive.length, 0);
  assert.equal(ranking.bestCurrentTrade, null);
});

test("strong momentum without pullback is not primary READY", () => {
  const ranking = rankMarketOpportunities([row("MOMO", { currentPrice: 100, entry: 100, setupType: "MOMENTUM_CONTINUATION", pullbackPercent: 1.2, qualityScore: 40 })], settings, { now: "2026-08-09T00:00:00Z", includeDevelopingTopFive: true });
  assert.equal(ranking.topFive[0].status, "WAIT FOR PULLBACK");
  assert.equal(ranking.bestCurrentTrade, null);
});

test("breakout without pullback is not primary READY", () => {
  const ranking = rankMarketOpportunities([row("BRK", { currentPrice: 100, entry: 100, setupType: "BREAKOUT", pullbackPercent: 1.5 })], settings, { now: "2026-08-09T00:00:00Z", includeDevelopingTopFive: true });
  assert.equal(ranking.topFive[0].status, "WAIT FOR PULLBACK");
});

test("ABNB-style rally after pullback is not READY from momentum alone", () => {
  const abnbLike = row("ABNB", {
    currentPrice: 178.07,
    entry: 171.5,
    stop: 164.5,
    target: 187,
    changePercent: 17.43,
    relativeVolume: 3.69,
    setupType: "OVEREXTENDED",
    recentHigh: 178.48,
    pullbackLow: 164.7,
    pullbackPercent: 7.72,
    riseFromPullbackLow: 8.12,
    overextended: true,
    qualityScore: 55,
  });
  const ranking = rankMarketOpportunities([abnbLike], settings, { now: "2026-08-09T00:00:00Z", includeDevelopingTopFive: true });
  assert.equal(ranking.bestCurrentTrade, null);
  assert.equal(ranking.ranked[0].status, "OVEREXTENDED");
  assert.equal(ranking.topFive.length, 0);
});
