function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, decimals = 2) {
  const number = numberValue(value);
  return number === null ? null : Number(number.toFixed(decimals));
}

function average(values = []) {
  const clean = values.filter(Number.isFinite);
  return clean.length ? clean.reduce((total, value) => total + value, 0) / clean.length : null;
}

function trueRange(candle, previousClose = null) {
  const high = numberValue(candle?.high);
  const low = numberValue(candle?.low);
  if (high === null || low === null) return null;
  if (previousClose === null || previousClose <= 0) return high - low;
  return Math.max(high - low, Math.abs(high - previousClose), Math.abs(low - previousClose));
}

function ratingFor(percent) {
  if (!Number.isFinite(percent)) return "UNKNOWN";
  if (percent < 1.25) return "LOW";
  if (percent < 4) return "MODERATE";
  if (percent < 8) return "HIGH";
  return "EXTREME";
}

export function volatilityTone(rating) {
  return {
    LOW: "grey",
    MODERATE: "green",
    HIGH: "amber",
    EXTREME: "red",
  }[String(rating || "").toUpperCase()] || "grey";
}

export function volatilityMessage(rating) {
  return {
    LOW: "Low volatility: may not move enough to justify a short-term trade.",
    MODERATE: "Moderate volatility: regular movement with manageable risk.",
    HIGH: "High volatility: potentially suitable for short-term trading, but wider price swings increase stop-loss risk.",
    EXTREME: "Extreme volatility: price movement is erratic and may be unsuitable.",
  }[String(rating || "").toUpperCase()] || "Volatility cannot be assessed from the available candles.";
}

export function volatilitySuitabilityScore(volatility = {}) {
  const percent = numberValue(volatility.averageDailyMovementPercent ?? volatility.atrPercent);
  const rating = String(volatility.rating || ratingFor(percent)).toUpperCase();
  if (percent === null) return 0;
  if (rating === "LOW") return Math.max(20, Math.min(58, percent * 44));
  if (rating === "MODERATE") return Math.max(72, 100 - Math.abs(percent - 2.6) * 7);
  if (rating === "HIGH") return Math.max(45, 82 - Math.max(0, percent - 4) * 9);
  if (rating === "EXTREME") return Math.max(8, 38 - Math.max(0, percent - 8) * 4);
  return 0;
}

export function calculateVolatility(candles = [], options = {}) {
  const rows = (Array.isArray(candles) ? candles : [])
    .filter((candle) => ["open", "high", "low", "close"].every((key) => Number.isFinite(Number(candle?.[key])) && Number(candle[key]) > 0));
  if (!rows.length) {
    return {
      rating: "UNKNOWN",
      tone: "grey",
      averageDailyMovementPercent: null,
      averageDailyRange: null,
      atr: null,
      atrPercent: null,
      largestDailyMovementPercent: null,
      largestDailyRange: null,
      daysOver3Percent: 0,
      candleCount: 0,
      assessment: volatilityMessage("UNKNOWN"),
      suitabilityScore: 0,
    };
  }

  const movementRows = rows.map((candle, index) => {
    const high = Number(candle.high);
    const low = Number(candle.low);
    const close = Number(candle.close);
    const previousClose = index > 0 ? numberValue(rows[index - 1].close) : null;
    const range = high - low;
    const movementPercent = close > 0 ? (range / close) * 100 : null;
    return {
      range,
      movementPercent,
      trueRange: trueRange(candle, previousClose),
    };
  });

  const averageDailyMovementPercent = average(movementRows.map((row) => row.movementPercent));
  const averageDailyRange = average(movementRows.map((row) => row.range));
  const largestRow = movementRows.reduce((best, row) => {
    if (!best || Number(row.movementPercent) > Number(best.movementPercent)) return row;
    return best;
  }, null);
  const period = Math.max(1, Number(options.atrPeriod) || 14);
  const atrRows = movementRows.slice(-period);
  const atr = average(atrRows.map((row) => row.trueRange));
  const latestClose = numberValue(rows[rows.length - 1]?.close);
  const atrPercent = atr !== null && latestClose !== null && latestClose > 0 ? (atr / latestClose) * 100 : null;
  const rating = ratingFor(averageDailyMovementPercent);
  const result = {
    rating,
    tone: volatilityTone(rating),
    averageDailyMovementPercent: round(averageDailyMovementPercent, 2),
    averageDailyRange: round(averageDailyRange, 2),
    atr: round(atr, 2),
    atrPercent: round(atrPercent, 2),
    largestDailyMovementPercent: round(largestRow?.movementPercent, 2),
    largestDailyRange: round(largestRow?.range, 2),
    daysOver3Percent: movementRows.filter((row) => Number(row.movementPercent) > 3).length,
    candleCount: rows.length,
    assessment: volatilityMessage(rating),
  };
  return {
    ...result,
    suitabilityScore: round(volatilitySuitabilityScore(result)),
  };
}
