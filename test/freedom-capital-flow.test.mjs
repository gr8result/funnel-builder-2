import assert from "node:assert/strict";
import test from "node:test";
import { computeCapitalFlow, classifyBuyingPressure } from "../lib/freedom-trader/capitalFlow.js";
import { rankMarketOpportunities } from "../lib/freedom-trader/opportunityRanking.js";
import { sendFreedomNotification } from "../lib/freedom-trader/notifications.js";

const settings = {
  minimumScore: 82,
  minimumDailyVolume: 1_000_000,
  minimumRiskReward: 2,
  maximumVolatility: 9,
};

function candles({ start = 100, step = 1, volume = 1_000_000, count = 20 } = {}) {
  return Array.from({ length: count }, (_, index) => ({
    date: `2026-08-${String(index + 1).padStart(2, "0")}`,
    open: start + step * index - 0.2,
    high: start + step * index + 0.5,
    low: start + step * index - 0.5,
    close: start + step * index,
    volume: volume + index * 1000,
  }));
}

function row(symbol, overrides = {}) {
  const currentPrice = overrides.currentPrice ?? 100;
  const entry = overrides.entry ?? 100;
  const stop = overrides.stop ?? 94;
  const target = overrides.target ?? 118;
  return {
    symbol,
    companyName: `${symbol} Corp`,
    exchange: "NASDAQ",
    currency: "USD",
    currentPrice,
    changePercent: overrides.changePercent ?? 2.2,
    volume: overrides.volume ?? 3_000_000,
    averageVolume: overrides.averageVolume ?? 1_000_000,
    candleCount: 240,
    tradingScore: overrides.tradingScore ?? 88,
    confidence: 86,
    trend: "Uptrend",
    previousCapitalFlow: overrides.previousCapitalFlow,
    dataStatus: { readyForScore: overrides.readyForScore ?? true, actualCandleCount: 240, latestTimestamp: "2026-08-07" },
    marketData: { validated: overrides.validated ?? true, latestCandleDate: "2026-08-07", candles: { daily: overrides.candles || candles({ step: overrides.step ?? 1, volume: overrides.volume ?? 3_000_000 }) } },
    indicators: {
      ma20: 98,
      ma50: 95,
      ma200: 90,
      relativeVolume: overrides.relativeVolume ?? 3,
      volatility20: 4,
    },
    setup: {
      valid: true,
      plannedEntry: entry,
      stop,
      target,
      takeSomeProfit: target,
      finalExit: target,
      riskPerShare: entry - stop,
      rewardPerShare: target - entry,
      riskRewardRatio: overrides.riskReward ?? (target - entry) / (entry - stop),
      setupExpiryDate: "2026-08-21T00:00:00.000Z",
    },
    setupClassification: {
      setupType: overrides.setupType ?? "PULLBACK_REVERSAL",
      recentHigh: 120,
      pullbackLow: 94,
      pullbackPercent: 21.66,
      pullbackDuration: 10,
      distanceFromRecentHigh: 20,
      riseFromPullbackLow: 6.38,
      reversalState: overrides.reversalState ?? "REVERSAL_CONFIRMED",
      reversalConfirmation: entry,
      preferredEntry: entry,
      distanceFromPreferredEntry: ((currentPrice - entry) / entry) * 100,
      overextended: overrides.overextended ?? false,
      evidence: ["higher low", "price holding near support", "break above short-term confirmation", "short-term trend turning upward"],
      qualityScore: 88,
    },
  };
}

test("Capital Flow detects strong accumulation without using jargon in explanation", () => {
  const flow = computeCapitalFlow(row("ACC", { relativeVolume: 3.2, changePercent: 2.4 }));
  assert.equal(flow.pressure, "STRONG BUYING PRESSURE");
  assert.ok(["REVIEW NOW", "TRADE READY"].includes(flow.state));
  assert.ok(flow.capitalFlowScore >= 78);
  assert.doesNotMatch(flow.explanation, /\bRVOL\b|\bMACD\b|\bRSI\b/i);
});

test("high-volume selloff is classified as selling pressure and rejected", () => {
  const flow = computeCapitalFlow(row("SELL", { relativeVolume: 3.5, changePercent: -4, step: -1 }));
  assert.equal(flow.pressure, "STRONG SELLING PRESSURE");
  assert.equal(flow.state, "REJECTED");
  assert.match(flow.explanation, /selling pressure/i);
});

test("one-off spike fades instead of sending a trade alert", () => {
  const flow = computeCapitalFlow(row("SPIKE", { relativeVolume: 3.4, changePercent: 0.05, step: 0, previousCapitalFlow: { capitalFlowScore: 85 } }));
  assert.equal(flow.state, "FADED");
});

test("slow accumulation progresses from developing to review now", () => {
  const first = computeCapitalFlow(row("SLOW", { relativeVolume: 1.7, changePercent: 0.8 }));
  const second = computeCapitalFlow(row("SLOW", { relativeVolume: 2.9, changePercent: 1.8, previousCapitalFlow: first }));
  assert.ok(["ACTIVITY DETECTED", "DEVELOPING"].includes(first.state));
  assert.ok(["REVIEW NOW", "TRADE READY"].includes(second.state));
  assert.ok(second.capitalFlowScore > first.capitalFlowScore);
});

test("bad Capital Flow data stays unavailable with no recommendation", () => {
  const flow = computeCapitalFlow(row("BAD", { readyForScore: false }));
  assert.equal(flow.state, "DATA UNAVAILABLE");
  assert.match(flow.explanation, /unavailable/i);
});

test("buying and selling pressure classification is direction-aware", () => {
  assert.equal(classifyBuyingPressure({ priceChangePercent: 2, relativeVolume: 2.4, closes: [1, 2, 3, 4] }), "STRONG BUYING PRESSURE");
  assert.equal(classifyBuyingPressure({ priceChangePercent: -2, relativeVolume: 2.4, closes: [4, 3, 2, 1] }), "STRONG SELLING PRESSURE");
});

test("ranking integration favours actionable Capital Flow over distant deep-pullback watch", () => {
  const flowReady = row("FLOW", { setupType: "MOMENTUM_CONTINUATION", relativeVolume: 3.4, changePercent: 2.8, currentPrice: 100.2, entry: 100 });
  const distant = row("FAR", { tradingScore: 99, currentPrice: 109, entry: 100, overextended: true, relativeVolume: 1.1, changePercent: 0.2 });
  const ranking = rankMarketOpportunities([distant, flowReady], settings, { now: "2026-08-09T00:00:00Z" });
  assert.equal(ranking.bestCurrentTrade.symbol, "FLOW");
  assert.equal(ranking.bestTradePlan.cmcOrder.broker, "CMC");
  assert.ok(ranking.ranked.find((item) => item.symbol === "FLOW").capitalFlowScore >= 78);
});

test("Freedom notification adapter suppresses duplicate SMS alerts", async () => {
  const input = { symbol: `CF${Date.now()}`, alertType: "REVIEW_NOW", triggerState: "REVIEW NOW", message: "Unusual buying activity detected.", sms: true };
  const first = await sendFreedomNotification(input, { settings: { smsEnabled: false, mobile: "" } });
  const second = await sendFreedomNotification(input, { settings: { smsEnabled: false, mobile: "" } });
  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
});

test("Freedom notification adapter records SMS blocker without losing alert", async () => {
  const result = await sendFreedomNotification({ symbol: `BK${Date.now()}`, alertType: "TRADE_READY", triggerState: "TRADE READY", sms: true }, { settings: { smsEnabled: true, mobile: "0400000315" } });
  assert.equal(result.ok, false);
  assert.equal(result.notification.smsStatus, "blocked");
  assert.match(result.notification.smsError, /not configured/i);
});
