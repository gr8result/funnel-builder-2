import assert from "node:assert/strict";
import test from "node:test";
import { calculateVolatility, volatilitySuitabilityScore } from "../lib/freedom-trader/volatility.js";

function candles(count, { start = 20, rangePercent = 2 } = {}) {
  return Array.from({ length: count }, (_, index) => {
    const close = start + index * 0.05;
    const range = close * (rangePercent / 100);
    return {
      date: `2026-08-${String(index + 1).padStart(2, "0")}`,
      open: close - range * 0.2,
      high: close + range * 0.5,
      low: close - range * 0.5,
      close,
      volume: 1_000_000,
    };
  });
}

test("volatility summary is calculated only from supplied historical candles", () => {
  const summary = calculateVolatility(candles(20, { rangePercent: 2.5 }));
  assert.equal(summary.rating, "MODERATE");
  assert.equal(summary.averageDailyMovementPercent, 2.5);
  assert.equal(summary.daysOver3Percent, 0);
  assert.equal(summary.candleCount, 20);
  assert.match(summary.assessment, /Moderate volatility/);
  assert.ok(summary.atr > 0);
  assert.ok(summary.atrPercent > 0);
});

test("volatility suitability favours usable movement, not the most volatile symbol", () => {
  const moderate = calculateVolatility(candles(20, { rangePercent: 2.5 }));
  const high = calculateVolatility(candles(20, { rangePercent: 5 }));
  const extreme = calculateVolatility(candles(20, { rangePercent: 11 }));

  assert.equal(moderate.rating, "MODERATE");
  assert.equal(high.rating, "HIGH");
  assert.equal(extreme.rating, "EXTREME");
  assert.ok(volatilitySuitabilityScore(moderate) > volatilitySuitabilityScore(high));
  assert.ok(volatilitySuitabilityScore(high) > volatilitySuitabilityScore(extreme));
});
