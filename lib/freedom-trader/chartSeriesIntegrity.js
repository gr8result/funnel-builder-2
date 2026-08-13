export function buildFreedomChartInput(candles = [], options = {}) {
  const includeFutureSlots = options.includeFutureSlots === true;
  const chartType = String(options.chartType || "line").toLowerCase();
  const marketCandles = Array.isArray(candles) ? candles : [];
  const dates = marketCandles.map((candle) => candle.date);
  const futureDates = includeFutureSlots && Array.isArray(options.futureDates) ? options.futureDates : [];
  const allDates = [...dates, ...futureDates];
  const chartPrice = marketCandles.map((candle) => candle.close);
  return {
    timestamps: allDates,
    chartPrice: [...chartPrice, ...futureDates.map(() => null)],
    volume: [...marketCandles.map((candle) => candle.volume || 0), ...futureDates.map(() => null)],
    candles: [
      ...marketCandles.map((candle) => [candle.open, candle.close, candle.low, candle.high]),
      ...futureDates.map(() => chartType === "line" || chartType === "area" ? null : [null, null, null, null]),
    ],
    realCount: marketCandles.length,
    futureCount: futureDates.length,
    lineUsesClose: true,
  };
}

export function auditChronology(rows = [], timestampKey = "timestamp") {
  const timestamps = rows.map((row) => row?.[timestampKey]).filter((value) => value !== undefined && value !== null);
  const duplicates = [];
  const seen = new Set();
  timestamps.forEach((timestamp) => {
    if (seen.has(timestamp)) duplicates.push(timestamp);
    seen.add(timestamp);
  });
  const outOfOrder = [];
  for (let index = 1; index < timestamps.length; index += 1) {
    if (String(timestamps[index]) <= String(timestamps[index - 1])) {
      outOfOrder.push({ index, previous: timestamps[index - 1], current: timestamps[index] });
    }
  }
  return {
    count: timestamps.length,
    strictlyChronological: outOfOrder.length === 0 && duplicates.length === 0,
    duplicateCount: duplicates.length,
    duplicates,
    outOfOrder,
    firstTimestamp: timestamps[0] || null,
    lastTimestamp: timestamps[timestamps.length - 1] || null,
  };
}

export function summarizeOhlc(rows = []) {
  const closeValues = rows.map((row) => Number(row.close)).filter(Number.isFinite);
  const highValues = rows.map((row) => Number(row.high)).filter(Number.isFinite);
  const lowValues = rows.map((row) => Number(row.low)).filter(Number.isFinite);
  return {
    count: rows.length,
    firstPrice: closeValues[0] ?? null,
    sessionLow: lowValues.length ? Math.min(...lowValues) : null,
    sessionHigh: highValues.length ? Math.max(...highValues) : null,
    lastPrice: closeValues[closeValues.length - 1] ?? null,
  };
}
