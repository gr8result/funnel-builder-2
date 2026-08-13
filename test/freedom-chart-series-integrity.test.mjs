import assert from "node:assert/strict";
import test from "node:test";
import { auditChronology, buildFreedomChartInput, summarizeOhlc } from "../lib/freedom-trader/chartSeriesIntegrity.js";

test("raw normalized candles preserve order, close values, range, count and volume in chart input", () => {
  const normalized = [
    { date: "2026-08-13 09:30:00", open: 10, high: 10.5, low: 9.9, close: 10.2, volume: 1000 },
    { date: "2026-08-13 09:31:00", open: 10.2, high: 10.7, low: 10.1, close: 10.6, volume: 1250 },
    { date: "2026-08-13 09:32:00", open: 10.6, high: 10.8, low: 10.3, close: 10.4, volume: 900 },
  ];
  const chart = buildFreedomChartInput(normalized, { chartType: "line" });
  assert.equal(chart.lineUsesClose, true);
  assert.equal(chart.realCount, normalized.length);
  assert.equal(chart.futureCount, 0);
  assert.deepEqual(chart.timestamps, normalized.map((row) => row.date));
  assert.deepEqual(chart.chartPrice, normalized.map((row) => row.close));
  assert.deepEqual(chart.volume, normalized.map((row) => row.volume));
  assert.deepEqual(chart.candles, normalized.map((row) => [row.open, row.close, row.low, row.high]));
  assert.equal(Math.min(...chart.chartPrice), 10.2);
  assert.equal(Math.max(...chart.chartPrice), 10.6);
  assert.equal(Math.min(...normalized.map((row) => row.low)), 9.9);
  assert.equal(Math.max(...normalized.map((row) => row.high)), 10.8);
  assert.equal(auditChronology(normalized, "date").strictlyChronological, true);
  assert.deepEqual(summarizeOhlc(normalized), { count: 3, firstPrice: 10.2, sessionLow: 9.9, sessionHigh: 10.8, lastPrice: 10.4 });
});

test("future panning slots do not create synthetic market prices or volume", () => {
  const normalized = [
    { date: "2026-08-13 15:59:00", open: 11, high: 11.1, low: 10.8, close: 10.9, volume: 800 },
  ];
  const chart = buildFreedomChartInput(normalized, { chartType: "line", includeFutureSlots: true, futureDates: ["Future 1", "Future 2"] });
  assert.equal(chart.realCount, 1);
  assert.equal(chart.futureCount, 2);
  assert.deepEqual(chart.chartPrice, [10.9, null, null]);
  assert.deepEqual(chart.volume, [800, null, null]);
});

test("chart input preserves sub-cent market precision from normalized OHLC bars", () => {
  const normalized = [
    { date: "2026-08-13 09:30:00", open: 3.795, high: 3.805, low: 3.785, close: 3.795, volume: 25 },
  ];
  const chart = buildFreedomChartInput(normalized, { chartType: "line" });
  assert.equal(chart.chartPrice[0], 3.795);
  assert.deepEqual(chart.candles[0], [3.795, 3.795, 3.785, 3.805]);
});
