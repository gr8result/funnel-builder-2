import assert from "node:assert/strict";
import test from "node:test";

import {
  CHART_RANGES,
  DEFAULT_CHART_RANGE,
  assessHistoryFreshness,
  chartStatusFor,
  computePriceScale,
  findSupportResistance,
  isValidRange,
  movingAverage,
  relativeStrengthIndex,
} from "../lib/freedom/chartAnalysis.js";

function series(closes, startDate = "2026-01-01") {
  const start = Date.parse(startDate + "T00:00:00Z");
  return closes.map((close, index) => ({
    date: new Date(start + index * 86400000).toISOString().slice(0, 10),
    open: close * 0.995,
    high: close * 1.01,
    low: close * 0.99,
    close,
    volume: 1000000,
  }));
}

// ---------------------------------------------------------------------------
test("the five required timeframes are offered and 6 months is the default", () => {
  assert.deepEqual(CHART_RANGES.map((r) => r.id), ["1mo", "3mo", "6mo", "1y", "5y"]);
  assert.deepEqual(CHART_RANGES.map((r) => r.label), ["1 Month", "3 Months", "6 Months", "1 Year", "5 Years"]);
  assert.equal(DEFAULT_CHART_RANGE, "6mo");
});

test("only supported ranges are accepted", () => {
  assert.equal(isValidRange("6mo"), true);
  assert.equal(isValidRange("5y"), true);
  assert.equal(isValidRange("10y"), false);
  assert.equal(isValidRange(""), false);
  assert.equal(isValidRange(null), false);
});

// ---------------------------------------------------------------------------
test("a single spike cannot compress the chart into a flat line", () => {
  // 90 days oscillating tightly around 10, plus one absurd 500 print.
  const closes = Array.from({ length: 90 }, (_, i) => 10 + Math.sin(i / 4) * 0.5);
  const candles = series(closes);
  candles[45].high = 500;

  const scale = computePriceScale(candles, []);
  const span = scale.max - scale.min;

  // Without outlier rejection the span would be ~490, making normal movement invisible.
  assert.ok(span < 5, "scale span stayed readable, got " + span.toFixed(2));
  assert.ok(scale.max < 20, "the 500 spike did not stretch the top of the scale");
  assert.ok(scale.min > 5, "the bottom of the scale still hugs the real data");
});

test("normal price movement fills a healthy portion of the scale", () => {
  const closes = Array.from({ length: 120 }, (_, i) => 50 + Math.sin(i / 8) * 6);
  const scale = computePriceScale(series(closes), []);
  const dataSpan = 12; // the sine wave spans roughly 44 to 56
  const scaleSpan = scale.max - scale.min;
  assert.ok(scaleSpan < dataSpan * 2.2, "scale is not needlessly wide, got " + scaleSpan.toFixed(2));
});

test("markers inside a sensible band expand the scale so they stay visible", () => {
  const closes = Array.from({ length: 60 }, () => 100);
  const scale = computePriceScale(series(closes), [
    { label: "Safety Exit", value: 92 },
    { label: "Target 1", value: 112 },
  ]);
  assert.ok(scale.min <= 92, "safety exit is inside the scale");
  assert.ok(scale.max >= 112, "target is inside the scale");
  assert.equal(scale.clamped.length, 0, "nothing needed clamping");
});

test("a wildly distant marker is clamped instead of flattening the chart", () => {
  const closes = Array.from({ length: 60 }, (_, i) => 10 + Math.sin(i / 5) * 0.4);
  const scale = computePriceScale(series(closes), [{ label: "Target 2", value: 900 }]);

  assert.equal(scale.clamped.length, 1, "the distant marker was clamped");
  assert.equal(scale.clamped[0].label, "Target 2");
  assert.equal(scale.clamped[0].side, "above");
  assert.ok(scale.max < 20, "the chart scale ignored the distant marker, got " + scale.max.toFixed(2));
});

test("a flat series still produces a usable scale", () => {
  const scale = computePriceScale(series(Array.from({ length: 40 }, () => 25)), []);
  assert.ok(scale.max > scale.min, "scale has positive height");
  assert.ok(scale.max - scale.min < 5, "a flat series does not produce an absurd scale");
});

test("no candles means no scale, never a fabricated one", () => {
  assert.equal(computePriceScale([], []), null);
  assert.equal(computePriceScale([{ high: null, low: null }], []), null);
});

// ---------------------------------------------------------------------------
test("moving average is null until the window fills, then correct", () => {
  const candles = series([1, 2, 3, 4, 5, 6]);
  const ma = movingAverage(candles, 3);
  assert.equal(ma[0], null);
  assert.equal(ma[1], null);
  assert.equal(ma[2], 2, "(1+2+3)/3");
  assert.equal(ma[3], 3, "(2+3+4)/3");
  assert.equal(ma[5], 5, "(4+5+6)/3");
});

test("moving average returns all nulls when there is not enough history", () => {
  assert.deepEqual(movingAverage(series([1, 2]), 20), [null, null]);
});

test("RSI is 100 for an unbroken rise and low for an unbroken fall", () => {
  const rising = relativeStrengthIndex(series(Array.from({ length: 40 }, (_, i) => 10 + i)), 14);
  assert.equal(rising[39], 100, "a series with no losses has RSI 100");

  const falling = relativeStrengthIndex(series(Array.from({ length: 40 }, (_, i) => 100 - i)), 14);
  assert.equal(falling[39], 0, "a series with no gains has RSI 0");
});

test("RSI stays within 0-100 and is aligned to the input", () => {
  const candles = series(Array.from({ length: 80 }, (_, i) => 50 + Math.sin(i / 3) * 10));
  const rsi = relativeStrengthIndex(candles, 14);
  assert.equal(rsi.length, candles.length);
  assert.equal(rsi[13], null, "no RSI before the period fills");
  rsi.filter((v) => v !== null).forEach((value) => {
    assert.ok(value >= 0 && value <= 100, "RSI out of range: " + value);
  });
});

// ---------------------------------------------------------------------------
test("support sits below price and resistance above it", () => {
  // A saw-tooth that repeatedly bounces near 90 and stalls near 110.
  const closes = [];
  for (let i = 0; i < 12; i += 1) closes.push(90, 95, 100, 105, 110, 105, 100, 95);
  const candles = series(closes);
  const { support, resistance } = findSupportResistance(candles, 100);

  assert.ok(support, "a support level was found");
  assert.ok(resistance, "a resistance level was found");
  assert.ok(support.value < 100, "support is below price, got " + support.value);
  assert.ok(resistance.value > 100, "resistance is above price, got " + resistance.value);
  assert.ok(support.touches >= 1 && resistance.touches >= 1, "levels report how often they were touched");
});

test("support and resistance degrade to null rather than inventing levels", () => {
  assert.deepEqual(findSupportResistance([], 10), { support: null, resistance: null });
  const monotonic = findSupportResistance(series([1, 2, 3, 4, 5]), 5);
  assert.equal(monotonic.resistance, null, "nothing above the price to call resistance");
});

// ---------------------------------------------------------------------------
test("status banner reports waiting below the trigger", () => {
  const status = chartStatusFor({ action: "WAIT", currentPrice: 8, entryLow: 9, entryHigh: 10, safetyExit: 7 });
  assert.equal(status.state, "WAIT");
  assert.match(status.label, /has not reached the buy trigger/);
  assert.equal(status.tone, "blue");
});

test("status banner reports a triggered entry inside the range", () => {
  const status = chartStatusFor({ action: "BUY", currentPrice: 9.5, entryLow: 9, entryHigh: 10, safetyExit: 8 });
  assert.equal(status.state, "TRIGGERED");
  assert.match(status.label, /ENTRY TRIGGERED/);
  assert.equal(status.tone, "green");
});

test("status banner reports an active trade when the position is owned", () => {
  const status = chartStatusFor({ currentPrice: 9.5, entryLow: 9, entryHigh: 10, safetyExit: 8, isOwned: true });
  assert.equal(status.state, "ACTIVE");
  assert.equal(status.label, "ACTIVE TRADE");
});

test("a breached Safety Exit overrides every other status", () => {
  const status = chartStatusFor({ action: "BUY", currentPrice: 7, entryLow: 9, entryHigh: 10, safetyExit: 8, isOwned: true });
  assert.equal(status.state, "INVALIDATED");
  assert.equal(status.tone, "red");
});

test("a missing price produces a grey no-data banner, not a buy signal", () => {
  const status = chartStatusFor({ action: "BUY", currentPrice: null, entryLow: 9, entryHigh: 10 });
  assert.equal(status.state, "NO_DATA");
  assert.equal(status.tone, "grey");
});

// ---------------------------------------------------------------------------
test("fresh history is accepted", () => {
  const candles = series(Array.from({ length: 60 }, () => 10), "2026-06-01");
  const latest = candles[candles.length - 1].date;
  const result = assessHistoryFreshness(candles, { now: latest + "T22:00:00Z" });
  assert.equal(result.ok, true);
  assert.equal(result.stale, false);
  assert.equal(result.latestDate, latest);
});

test("stale history is rejected rather than drawn as live", () => {
  const candles = series(Array.from({ length: 60 }, () => 10), "2026-01-01");
  const result = assessHistoryFreshness(candles, { now: "2026-08-24T00:00:00Z" });
  assert.equal(result.ok, false);
  assert.equal(result.stale, true);
  assert.match(result.reason, /stale/i);
});

test("too little history is rejected", () => {
  const result = assessHistoryFreshness(series([1, 2, 3]));
  assert.equal(result.ok, false);
  assert.equal(result.stale, false);
  assert.match(result.reason, /Not enough historical data/);
});

test("an empty series is rejected and never treated as a valid chart", () => {
  const result = assessHistoryFreshness([]);
  assert.equal(result.ok, false);
  assert.match(result.reason, /Not enough historical data/);
});

test("the price axis never runs below zero", () => {
  // A 5-year view of a stock that fell from 45 to 2: wide range, small floor.
  const closes = Array.from({ length: 300 }, (_, i) => 45 - (i / 300) * 43);
  const scale = computePriceScale(series(closes), [{ label: "Safety Exit", value: 1.8 }]);
  assert.ok(scale.min >= 0, "scale floor is not negative, got " + scale.min);
  assert.ok(scale.max > scale.min, "scale still has height");
});

test("a low-priced stock keeps a sensible floor", () => {
  const scale = computePriceScale(series(Array.from({ length: 60 }, () => 2.27)), []);
  assert.ok(scale.min >= 0, "floor is not negative, got " + scale.min);
});
