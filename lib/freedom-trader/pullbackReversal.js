const MIN_PULLBACK_PERCENT = 4;
const MAX_ENTRY_EXTENSION_PERCENT = 3.5;

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, decimals = 2) {
  const number = numberValue(value);
  return number === null ? null : Number(number.toFixed(decimals));
}

function clamp(value, min = 0, max = 100) {
  const number = numberValue(value);
  if (number === null) return null;
  return Math.max(min, Math.min(max, number));
}

function average(values) {
  const clean = values.filter(Number.isFinite);
  return clean.length ? clean.reduce((total, value) => total + value, 0) / clean.length : null;
}

function averageRange(candles) {
  const ranges = candles
    .map((candle) => {
      const high = numberValue(candle.high);
      const low = numberValue(candle.low);
      const close = numberValue(candle.close);
      return high !== null && low !== null && close ? ((high - low) / close) * 100 : null;
    })
    .filter(Number.isFinite);
  return average(ranges);
}

function localHighAfterLow(candles, lowIndex) {
  const slice = candles.slice(Math.max(0, lowIndex + 1), Math.max(lowIndex + 2, candles.length - 2));
  if (!slice.length) return null;
  return Math.max(...slice.map((candle) => candle.high).filter(Number.isFinite));
}

function setupFromFallback(row = {}) {
  const current = numberValue(row.currentPrice);
  const entry = numberValue(row.setup?.plannedEntry);
  const stop = numberValue(row.setup?.stop);
  const target = numberValue(row.setup?.target);
  if ([current, entry, stop, target].some((value) => value === null)) return null;
  const recentHigh = numberValue(row.setupClassification?.recentHigh) ?? round(Math.max(current, target));
  const pullbackLow = numberValue(row.setupClassification?.pullbackLow) ?? round(Math.min(stop * 1.01, current * 0.94));
  const pullbackPercent = numberValue(row.setupClassification?.pullbackPercent) ?? round(((recentHigh - pullbackLow) / recentHigh) * 100);
  const distanceFromEntry = round(((current - entry) / entry) * 100);
  const riseFromLow = round(((current - pullbackLow) / pullbackLow) * 100);
  return {
    setupType: row.setupClassification?.setupType || "PULLBACK_REVERSAL",
    recentHigh,
    pullbackLow,
    pullbackPercent,
    pullbackDuration: row.setupClassification?.pullbackDuration ?? 12,
    distanceFromRecentHigh: round(((recentHigh - current) / current) * 100),
    riseFromPullbackLow: riseFromLow,
    reversalState: row.setupClassification?.reversalState || "REVERSAL_CONFIRMED",
    reversalConfirmation: row.setupClassification?.reversalConfirmation ?? entry,
    preferredEntry: entry,
    distanceFromPreferredEntry: distanceFromEntry,
    overextended: Boolean(row.setupClassification?.overextended) || distanceFromEntry > MAX_ENTRY_EXTENSION_PERCENT,
    evidence: row.setupClassification?.evidence || ["higher low", "buyers returned", "price recovered above confirmation"],
    qualityScore: numberValue(row.setupClassification?.qualityScore) ?? 80,
  };
}

export function classifyPullbackReversal(candles = [], options = {}) {
  const clean = candles.filter((candle) => ["open", "high", "low", "close"].every((key) => Number.isFinite(candle[key])));
  const current = numberValue(options.currentPrice) ?? clean[clean.length - 1]?.close ?? null;
  if (clean.length < 40 || current === null) return { setupType: "NO_SETUP", reversalState: "STILL_FALLING", qualityScore: 0 };

  const lookback = clean.slice(-90);
  let highIndex = 0;
  let recentHigh = lookback[0].high;
  lookback.forEach((candle, index) => {
    if (candle.high > recentHigh) {
      recentHigh = candle.high;
      highIndex = index;
    }
  });

  const afterHigh = lookback.slice(highIndex + 1);
  if (afterHigh.length < 5) {
    const latestMove = numberValue(options.changePercent) || 0;
    return {
      setupType: latestMove > 2 ? "BREAKOUT" : "MOMENTUM_CONTINUATION",
      reversalState: "REVERSAL_CONFIRMED",
      recentHigh: round(recentHigh),
      pullbackLow: null,
      pullbackPercent: 0,
      pullbackDuration: 0,
      distanceFromRecentHigh: round(((recentHigh - current) / current) * 100),
      qualityScore: 20,
    };
  }

  let lowOffset = 0;
  let pullbackLow = afterHigh[0].low;
  afterHigh.forEach((candle, index) => {
    if (candle.low < pullbackLow) {
      pullbackLow = candle.low;
      lowOffset = index;
    }
  });
  const lowIndex = highIndex + 1 + lowOffset;
  const pullbackDuration = Math.max(1, lowIndex - highIndex);
  const pullbackPercent = ((recentHigh - pullbackLow) / recentHigh) * 100;
  const volatilityPercent = numberValue(options.volatilityPercent) ?? averageRange(lookback.slice(-20)) ?? 2;
  const meaningfulThreshold = Math.max(MIN_PULLBACK_PERCENT, volatilityPercent * 1.8);
  const meaningfulPullback = pullbackPercent >= meaningfulThreshold && pullbackDuration >= 4;

  const last12 = lookback.slice(-12);
  const last6 = lookback.slice(-6);
  const previous6 = lookback.slice(-12, -6);
  const lowTolerance = Math.max(pullbackLow * 0.015, pullbackLow * (volatilityPercent / 100) * 0.6);
  const supportTests = last12.filter((candle) => candle.low <= pullbackLow + lowTolerance).length;
  const latest = lookback[lookback.length - 1];
  const previous = lookback[lookback.length - 2] || latest;
  const latestLow = Math.min(...last6.map((candle) => candle.low));
  const previousLow = previous6.length ? Math.min(...previous6.map((candle) => candle.low)) : null;
  const higherLow = lowIndex < lookback.length - 4 && latestLow > pullbackLow + lowTolerance * 0.4;
  const downsideSlowing = previousLow === null || latestLow >= previousLow - lowTolerance;
  const rejection = latest.close > latest.open && latest.close > latest.low + (latest.high - latest.low) * 0.55;
  const confirmationPrice = localHighAfterLow(lookback, lowIndex) ?? round(pullbackLow + (recentHigh - pullbackLow) * 0.35);
  const brokeLocalHigh = confirmationPrice !== null && current >= confirmationPrice;
  const avgVol20 = average(lookback.slice(-20).map((candle) => candle.volume));
  const improvingVolume = Number.isFinite(latest.volume) && Number.isFinite(avgVol20) && latest.volume >= avgVol20 * 1.05;
  const sma5 = average(lookback.slice(-5).map((candle) => candle.close));
  const sma10 = average(lookback.slice(-10).map((candle) => candle.close));
  const shortTermTurn = Number.isFinite(sma5) && Number.isFinite(sma10) && sma5 >= sma10;
  const evidence = [
    higherLow ? "higher low" : null,
    downsideSlowing ? "selling pressure slowing" : null,
    supportTests >= 2 ? "price holding near support" : null,
    rejection ? "rejection of lower prices" : null,
    brokeLocalHigh ? "break above short-term confirmation" : null,
    improvingVolume ? "buying volume improving" : null,
    shortTermTurn ? "short-term trend turning upward" : null,
  ].filter(Boolean);

  let reversalState = "STILL_FALLING";
  if (supportTests >= 2 || downsideSlowing) reversalState = "STABILISING";
  if (evidence.length >= 3 && (higherLow || rejection)) reversalState = "REVERSAL_DEVELOPING";
  if (evidence.length >= 4 && higherLow && brokeLocalHigh && shortTermTurn) reversalState = "REVERSAL_CONFIRMED";

  const preferredEntry = round(confirmationPrice ?? current);
  const distanceFromPreferredEntry = preferredEntry ? ((current - preferredEntry) / preferredEntry) * 100 : null;
  const riseFromPullbackLow = ((current - pullbackLow) / pullbackLow) * 100;
  const distanceFromRecentHigh = ((recentHigh - current) / current) * 100;
  const extensionLimit = Math.max(MAX_ENTRY_EXTENSION_PERCENT, volatilityPercent * 1.7);
  const overextended = riseFromPullbackLow > Math.max(8, volatilityPercent * 4) || (distanceFromPreferredEntry !== null && distanceFromPreferredEntry > extensionLimit);

  let setupType = "NO_SETUP";
  if (!meaningfulPullback && current >= recentHigh * 0.98) setupType = "MOMENTUM_CONTINUATION";
  else if (!meaningfulPullback) setupType = "NO_SETUP";
  else if (overextended) setupType = "OVEREXTENDED";
  else if (reversalState === "STILL_FALLING") setupType = "FALLING_NO_REVERSAL";
  else setupType = "PULLBACK_REVERSAL";

  const qualityScore = clamp(
    pullbackPercent * 4 +
    evidence.length * 10 +
    (reversalState === "REVERSAL_CONFIRMED" ? 25 : reversalState === "REVERSAL_DEVELOPING" ? 14 : reversalState === "STABILISING" ? 7 : 0) -
    Math.max(0, riseFromPullbackLow - 5) * 4
  );

  return {
    setupType,
    recentHigh: round(recentHigh),
    pullbackLow: round(pullbackLow),
    pullbackPercent: round(pullbackPercent),
    pullbackDuration,
    distanceFromRecentHigh: round(distanceFromRecentHigh),
    riseFromPullbackLow: round(riseFromPullbackLow),
    reversalState,
    reversalConfirmation: round(confirmationPrice),
    preferredEntry,
    distanceFromPreferredEntry: round(distanceFromPreferredEntry),
    overextended,
    evidence,
    qualityScore: round(qualityScore),
  };
}

export function setupClassificationForRow(row = {}) {
  if (row.setupClassification) return { ...row.setupClassification };
  return setupFromFallback(row);
}
