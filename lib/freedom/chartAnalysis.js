/**
 * Chart analysis helpers for the Freedom historical chart.
 *
 * Pure functions over validated OHLCV candles. Nothing here fetches data or invents
 * candles: every function returns null / an empty result when the input is insufficient,
 * so the chart can show an explicit error instead of a fabricated series.
 */

export const CHART_RANGES = [
  { id: "1mo", label: "1 Month", approxDays: 31 },
  { id: "3mo", label: "3 Months", approxDays: 92 },
  { id: "6mo", label: "6 Months", approxDays: 183 },
  { id: "1y", label: "1 Year", approxDays: 370 },
  { id: "5y", label: "5 Years", approxDays: 1830 },
];

export const DEFAULT_CHART_RANGE = "6mo";

export function isValidRange(value) {
  return CHART_RANGES.some((range) => range.id === String(value || "").toLowerCase());
}

function numberValue(value) {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, decimals = 2) {
  const number = numberValue(value);
  return number === null ? null : Number(number.toFixed(decimals));
}

/**
 * Nearest-rank percentile, biased inward (away from the extremes).
 *
 * Interpolating would blend the outlier itself back into the result: with 90 samples the
 * 99th percentile lands between the last two, so a single absurd print still leaks into
 * the "core" band. Rounding inward picks a real, non-extreme sample instead.
 */
function percentile(sorted, fraction, direction = "high") {
  if (!sorted.length) return null;
  if (sorted.length === 1) return sorted[0];
  const position = (sorted.length - 1) * Math.min(1, Math.max(0, fraction));
  const index = direction === "low" ? Math.ceil(position) : Math.floor(position);
  return sorted[Math.min(sorted.length - 1, Math.max(0, index))];
}

/**
 * Price scale that stays readable.
 *
 * Using raw min/max lets a single bad print (or a target far above the market) compress
 * every normal day into a flat line. Instead the core range comes from the 1st/99th
 * percentile of candle lows/highs, and markers may expand it by only a bounded amount.
 * Markers outside that bound are reported as clamped so the chart can pin them to the
 * edge with an indicator rather than destroying the scale.
 */
export function computePriceScale(candles = [], markers = [], options = {}) {
  const lows = candles.map((candle) => numberValue(candle?.low)).filter((value) => value !== null).sort((a, b) => a - b);
  const highs = candles.map((candle) => numberValue(candle?.high)).filter((value) => value !== null).sort((a, b) => a - b);
  if (!lows.length || !highs.length) return null;

  const lowPercentile = options.lowPercentile ?? 0.01;
  const highPercentile = options.highPercentile ?? 0.99;
  const maxExpansion = options.maxExpansion ?? 0.6;

  // Percentile core, widened to the true extremes only when they are not wild outliers.
  const coreLow = percentile(lows, lowPercentile, "low");
  const coreHigh = percentile(highs, highPercentile, "high");
  const coreRange = Math.max(coreHigh - coreLow, Math.abs(coreHigh) * 0.005, 1e-6);

  const trueLow = lows[0];
  const trueHigh = highs[highs.length - 1];
  // Absorb the real extremes when they sit within half the core range of the percentile
  // band; beyond that they are spikes and get clipped.
  let min = trueLow >= coreLow - coreRange * 0.5 ? trueLow : coreLow;
  let max = trueHigh <= coreHigh + coreRange * 0.5 ? trueHigh : coreHigh;

  // How far a marker may pull the scale. Tying this only to the candle range would clamp
  // a perfectly ordinary Safety Exit on a calm stock, so it is also allowed to reach a
  // fixed share of the price level - which still rejects markers orders of magnitude out.
  const midPrice = Math.abs((min + max) / 2) || Math.abs(coreHigh) || 1;
  const allowance = Math.max(coreRange * maxExpansion, midPrice * (options.priceAllowance ?? 0.3));
  const allowedLow = min - allowance;
  const allowedHigh = max + allowance;

  const clamped = [];
  markers.forEach((marker) => {
    const value = numberValue(marker?.value ?? marker);
    if (value === null) return;
    const label = marker?.label ?? null;
    if (value < allowedLow) {
      clamped.push({ label, value, side: "below" });
      return;
    }
    if (value > allowedHigh) {
      clamped.push({ label, value, side: "above" });
      return;
    }
    min = Math.min(min, value);
    max = Math.max(max, value);
  });

  if (!(max > min)) {
    const centre = max || 1;
    min = centre * 0.98;
    max = centre * 1.02;
  }

  const padding = (max - min) * (options.padding ?? 0.06);
  // A price axis must never run below zero: on a wide range the padding can otherwise
  // push the floor negative, wasting a slice of the chart on impossible prices.
  const paddedMin = Math.max(0, min - padding);
  const paddedMax = max + padding;
  return {
    min: paddedMin,
    max: paddedMax,
    clamped,
    spikesClipped: trueLow < paddedMin || trueHigh > paddedMax,
  };
}

/** Simple moving average aligned to the input array (null until the window fills). */
export function movingAverage(candles = [], period = 20) {
  const closes = candles.map((candle) => numberValue(candle?.close));
  const output = new Array(closes.length).fill(null);
  if (period <= 0 || closes.length < period) return output;
  let sum = 0;
  let count = 0;
  for (let index = 0; index < closes.length; index += 1) {
    const value = closes[index];
    if (value === null) {
      // A gap invalidates the running window; restart it.
      sum = 0;
      count = 0;
      continue;
    }
    sum += value;
    count += 1;
    if (count > period) {
      const dropped = closes[index - period];
      if (dropped !== null) sum -= dropped;
      count = period;
    }
    if (count === period) output[index] = round(sum / period, 4);
  }
  return output;
}

/** Wilder's RSI, aligned to the input array. */
export function relativeStrengthIndex(candles = [], period = 14) {
  const closes = candles.map((candle) => numberValue(candle?.close));
  const output = new Array(closes.length).fill(null);
  if (closes.length <= period) return output;

  let gainSum = 0;
  let lossSum = 0;
  for (let index = 1; index <= period; index += 1) {
    const change = closes[index] - closes[index - 1];
    if (change >= 0) gainSum += change;
    else lossSum -= change;
  }
  let averageGain = gainSum / period;
  let averageLoss = lossSum / period;
  output[period] = round(averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss), 2);

  for (let index = period + 1; index < closes.length; index += 1) {
    const change = closes[index] - closes[index - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    averageGain = (averageGain * (period - 1) + gain) / period;
    averageLoss = (averageLoss * (period - 1) + loss) / period;
    output[index] = round(averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss), 2);
  }
  return output;
}

/** Swing pivots: bars whose high (or low) is the extreme of a +/- lookback window. */
function findPivots(candles, lookback, kind) {
  const pivots = [];
  for (let index = lookback; index < candles.length - lookback; index += 1) {
    const value = numberValue(kind === "high" ? candles[index].high : candles[index].low);
    if (value === null) continue;
    let isPivot = true;
    for (let offset = index - lookback; offset <= index + lookback; offset += 1) {
      if (offset === index) continue;
      const other = numberValue(kind === "high" ? candles[offset].high : candles[offset].low);
      if (other === null) continue;
      if (kind === "high" ? other > value : other < value) { isPivot = false; break; }
    }
    if (isPivot) pivots.push({ index, value, date: candles[index].date });
  }
  return pivots;
}

/** Group nearby pivots into one level; more touches means a stronger level. */
function clusterPivots(pivots, tolerance) {
  const clusters = [];
  pivots.slice().sort((a, b) => a.value - b.value).forEach((pivot) => {
    const existing = clusters.find((cluster) => Math.abs(cluster.value - pivot.value) <= tolerance);
    if (existing) {
      existing.touches += 1;
      existing.total += pivot.value;
      existing.value = existing.total / existing.touches;
      existing.lastIndex = Math.max(existing.lastIndex, pivot.index);
    } else {
      clusters.push({ value: pivot.value, total: pivot.value, touches: 1, lastIndex: pivot.index });
    }
  });
  return clusters;
}

/**
 * Recent support and resistance nearest the current price.
 * Returns { support, resistance }, either of which may be null when no level qualifies.
 */
export function findSupportResistance(candles = [], currentPrice = null, options = {}) {
  const price = numberValue(currentPrice) ?? numberValue(candles[candles.length - 1]?.close);
  if (!candles.length || price === null) return { support: null, resistance: null };

  const lookback = options.lookback ?? Math.max(3, Math.round(candles.length / 40));
  const scale = computePriceScale(candles, []);
  if (!scale) return { support: null, resistance: null };
  const tolerance = (scale.max - scale.min) * (options.tolerance ?? 0.02);

  const highs = clusterPivots(findPivots(candles, lookback, "high"), tolerance);
  const lows = clusterPivots(findPivots(candles, lookback, "low"), tolerance);

  // Support sits below price, resistance above; prefer the closest, then the most touched.
  const supportCandidates = lows.filter((cluster) => cluster.value < price)
    .sort((a, b) => (price - a.value) - (price - b.value) || b.touches - a.touches);
  const resistanceCandidates = highs.filter((cluster) => cluster.value > price)
    .sort((a, b) => (a.value - price) - (b.value - price) || b.touches - a.touches);

  const shape = (cluster) => (cluster ? { value: round(cluster.value), touches: cluster.touches } : null);
  return { support: shape(supportCandidates[0]), resistance: shape(resistanceCandidates[0]) };
}

/**
 * Status banner for an opportunity, derived from the live price against the plan.
 * Returns { state, label, tone }.
 */
export function chartStatusFor({ action = null, currentPrice = null, entryLow = null, entryHigh = null, safetyExit = null, isOwned = false } = {}) {
  const price = numberValue(currentPrice);
  const low = numberValue(entryLow);
  const high = numberValue(entryHigh);
  const exit = numberValue(safetyExit);

  if (price === null) {
    return { state: "NO_DATA", label: "NO MARKET DATA - this chart cannot be assessed", tone: "grey" };
  }
  if (exit !== null && price <= exit) {
    return { state: "INVALIDATED", label: "SAFETY EXIT BREACHED - this setup is invalidated", tone: "red" };
  }
  if (isOwned) {
    return { state: "ACTIVE", label: "ACTIVE TRADE", tone: "green" };
  }
  if (low !== null && high !== null && price >= low && price <= high) {
    return { state: "TRIGGERED", label: "ENTRY TRIGGERED - review before purchasing", tone: "green" };
  }
  if (high !== null && price > high) {
    return { state: "ABOVE", label: "WAIT - price has moved above the buy trigger", tone: "amber" };
  }
  if (action === "AVOID") {
    return { state: "AVOID", label: "AVOID - this does not meet the trading rules", tone: "red" };
  }
  return { state: "WAIT", label: "WAIT - price has not reached the buy trigger", tone: "blue" };
}

/**
 * Reject stale or insufficient history. Freedom shows an explicit error rather than
 * drawing an out-of-date series as if it were current.
 */
export function assessHistoryFreshness(candles = [], options = {}) {
  const minimumCandles = options.minimumCandles ?? 20;
  if (!Array.isArray(candles) || candles.length < minimumCandles) {
    return {
      ok: false,
      stale: false,
      reason: "Not enough historical data to draw a reliable chart (" + (candles?.length || 0) + " candles).",
      latestDate: null,
      ageDays: null,
    };
  }
  const latest = candles[candles.length - 1];
  const parsed = Date.parse(String(latest?.date || "").length <= 10 ? latest.date + "T21:00:00Z" : latest?.date);
  if (!Number.isFinite(parsed)) {
    return { ok: false, stale: false, reason: "The latest candle has no usable date.", latestDate: null, ageDays: null };
  }
  const now = options.now ? new Date(options.now).getTime() : Date.now();
  const ageDays = (now - parsed) / 86_400_000;
  const maximumAgeDays = options.maximumAgeDays ?? 7;
  if (ageDays > maximumAgeDays) {
    return {
      ok: false,
      stale: true,
      reason: "The most recent candle is " + Math.floor(ageDays) + " days old. This history is stale and is not shown as live market data.",
      latestDate: latest.date,
      ageDays: round(ageDays, 1),
    };
  }
  return { ok: true, stale: false, reason: null, latestDate: latest.date, ageDays: round(ageDays, 1) };
}
