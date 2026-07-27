import assert from "node:assert/strict";
import test from "node:test";
import {
  calculatePositionMetrics,
  computeFibLevels,
  detectDirectionFromTrend,
  fibPriceForRatio,
  generateFibTradePlan,
  validateLevelOrder,
} from "../lib/freedom-trader/fibTradePlan.js";

// A bullish swing: low=100, high=120 (as drawn, direction-agnostic to anchor order)
const BULL_LOW = 100;
const BULL_HIGH = 120;

test("detects bullish vs bearish direction from trend text", () => {
  assert.equal(detectDirectionFromTrend("Uptrend"), "bullish");
  assert.equal(detectDirectionFromTrend("Downtrend"), "bearish");
  assert.equal(detectDirectionFromTrend("Sideways"), "bullish");
});

test("bullish Fib: 0% is the swing low, 100% is the swing high", () => {
  assert.equal(fibPriceForRatio(BULL_LOW, BULL_HIGH, 0, "bullish"), 100);
  assert.equal(fibPriceForRatio(BULL_LOW, BULL_HIGH, 1, "bullish"), 120);
  assert.equal(fibPriceForRatio(BULL_LOW, BULL_HIGH, 0.5, "bullish"), 110);
});

test("bullish Fib is anchor-order independent (drawn high-to-low or low-to-high)", () => {
  assert.equal(fibPriceForRatio(BULL_HIGH, BULL_LOW, 0, "bullish"), 100);
  assert.equal(fibPriceForRatio(BULL_HIGH, BULL_LOW, 1, "bullish"), 120);
});

test("bearish Fib: 0% is the swing high, 100% is the swing low", () => {
  assert.equal(fibPriceForRatio(BULL_LOW, BULL_HIGH, 0, "bearish"), 120);
  assert.equal(fibPriceForRatio(BULL_LOW, BULL_HIGH, 1, "bearish"), 100);
});

test("bullish extension levels project above the swing high", () => {
  const levels = computeFibLevels({ anchor1Price: BULL_LOW, anchor2Price: BULL_HIGH, direction: "bullish", includeExtensions: true });
  const ext1618 = levels.find((level) => level.key === "1618");
  assert.ok(ext1618.price > BULL_HIGH);
});

test("bearish extension levels project below the swing low", () => {
  const levels = computeFibLevels({ anchor1Price: BULL_LOW, anchor2Price: BULL_HIGH, direction: "bearish", includeExtensions: true });
  const ext1618 = levels.find((level) => level.key === "1618");
  assert.ok(ext1618.price < BULL_LOW);
});

test("validateLevelOrder accepts a well-formed bullish plan", () => {
  const result = validateLevelOrder("bullish", { entry: 110, stop: 100, target: 120, target2: 130 });
  assert.equal(result.valid, true);
});

test("validateLevelOrder rejects a bullish stop above entry", () => {
  const result = validateLevelOrder("bullish", { entry: 110, stop: 115, target: 120 });
  assert.equal(result.valid, false);
  assert.match(result.reason, /below entry/);
});

test("validateLevelOrder rejects bullish target2 below target1", () => {
  const result = validateLevelOrder("bullish", { entry: 110, stop: 100, target: 120, target2: 115 });
  assert.equal(result.valid, false);
  assert.match(result.reason, /at or above Target 1/);
});

test("validateLevelOrder accepts a well-formed bearish plan (inverted order)", () => {
  const result = validateLevelOrder("bearish", { entry: 110, stop: 120, target: 100, target2: 90 });
  assert.equal(result.valid, true);
});

test("validateLevelOrder rejects a bearish stop below entry", () => {
  const result = validateLevelOrder("bearish", { entry: 110, stop: 105, target: 100 });
  assert.equal(result.valid, false);
  assert.match(result.reason, /above entry/);
});

test("generateFibTradePlan produces a valid bullish plan with sensible defaults", () => {
  const plan = generateFibTradePlan({ anchor1Price: BULL_LOW, anchor2Price: BULL_HIGH, direction: "bullish", safetyBufferPercent: 1, minimumRiskReward: 1 });
  assert.equal(plan.valid, true);
  assert.ok(plan.entry > BULL_LOW && plan.entry < BULL_HIGH);
  assert.ok(plan.stop < BULL_LOW);
  assert.ok(plan.target >= BULL_HIGH * 0.999);
  assert.ok(plan.target2 > plan.target);
  assert.ok(plan.riskReward >= 1);
});

test("generateFibTradePlan applies the safety buffer below the swing low", () => {
  const noBuffer = generateFibTradePlan({ anchor1Price: BULL_LOW, anchor2Price: BULL_HIGH, direction: "bullish", safetyBufferPercent: 0, minimumRiskReward: 0.1 });
  const withBuffer = generateFibTradePlan({ anchor1Price: BULL_LOW, anchor2Price: BULL_HIGH, direction: "bullish", safetyBufferPercent: 5, minimumRiskReward: 0.1 });
  assert.ok(withBuffer.stop < noBuffer.stop);
});

test("generateFibTradePlan prefers the retracement level nearest the analysed entry zone", () => {
  const plan = generateFibTradePlan({ anchor1Price: BULL_LOW, anchor2Price: BULL_HIGH, direction: "bullish", analysisEntry: 118, minimumRiskReward: 0.1 });
  // Nearest of 38.2/50/61.8% to 118 is 61.8% (~112.36) -- still the closest available.
  assert.equal(plan.entryFibLabel, "61.8%");
});

test("generateFibTradePlan rejects a plan below the minimum risk/reward instead of returning bad numbers", () => {
  // A very shallow, noisy range with a high minimum requirement should fail cleanly.
  const plan = generateFibTradePlan({ anchor1Price: 100, anchor2Price: 100.5, direction: "bullish", minimumRiskReward: 50 });
  assert.equal(plan.valid, false);
  assert.match(plan.reason, /risk\/reward/i);
});

test("generateFibTradePlan produces a valid bearish plan (inverted structure)", () => {
  const plan = generateFibTradePlan({ anchor1Price: BULL_LOW, anchor2Price: BULL_HIGH, direction: "bearish", minimumRiskReward: 1 });
  assert.equal(plan.valid, true);
  assert.ok(plan.stop > BULL_HIGH);
  assert.ok(plan.entry > plan.target);
  assert.ok(plan.target2 < plan.target);
});

test("calculatePositionMetrics matches the required formulas", () => {
  const metrics = calculatePositionMetrics({ direction: "bullish", entry: 110, stop: 100, target: 130, portfolioValue: 100000, maxRiskPercent: 1, tradingCapital: 50000 });
  // riskPerShare = 10, maximumRiskAmount = 1000, quantity = floor(1000/10) = 100
  assert.equal(metrics.riskLimit, 1000);
  assert.equal(metrics.positionSize, 100);
  assert.equal(metrics.capitalRequired, 11000);
  assert.equal(metrics.maximumLoss, 1000);
  assert.equal(metrics.expectedProfit, 2000);
  assert.equal(metrics.riskReward, 2);
});

test("calculatePositionMetrics never returns a quantity below zero and handles missing levels", () => {
  const metrics = calculatePositionMetrics({ direction: "bullish", entry: null, stop: 100, target: 130 });
  assert.equal(metrics.positionSize, 0);
  assert.equal(metrics.riskReward, null);
});

test("calculatePositionMetrics enforces a maximum position value cap", () => {
  const metrics = calculatePositionMetrics({ direction: "bullish", entry: 110, stop: 100, target: 130, portfolioValue: 1000000, maxRiskPercent: 5, tradingCapital: 1000000, maxPositionValue: 5000 });
  // Without the cap, risk/capital sizing would allow far more than 45 shares (~5000/110).
  assert.ok(metrics.positionSize <= Math.floor(5000 / 110));
});

test("calculatePositionMetrics computes bearish risk/reward correctly (short direction)", () => {
  const metrics = calculatePositionMetrics({ direction: "bearish", entry: 110, stop: 120, target: 90, portfolioValue: 100000, maxRiskPercent: 1, tradingCapital: 50000 });
  assert.equal(metrics.riskReward, 2);
  assert.equal(metrics.positionSize, 100);
});
