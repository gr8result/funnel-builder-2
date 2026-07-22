import { fetchTraderHistory } from "./history.js";
import { TRADER_WATCHLIST } from "./watchlist.js";
import { calculateTraderSignal } from "../../../lib/freedom/signalEngine.js";

function round(value, decimals = 2) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(decimals)) : null;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function normalizeSymbol(value) {
  return String(value || "").trim().toUpperCase();
}

function parseSymbols(req) {
  const raw = req.query.symbols || req.query.symbol || "NVDA";
  const value = Array.isArray(raw) ? raw[0] : raw;
  return String(value).split(",").map(normalizeSymbol).filter(Boolean);
}

function sma(values, period) {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return round(slice.reduce((total, value) => total + value, 0) / period);
}

function emaSeries(values, period) {
  if (values.length < period) return [];
  const multiplier = 2 / (period + 1);
  let previous = values.slice(0, period).reduce((total, value) => total + value, 0) / period;
  const output = Array(period - 1).fill(null).concat(previous);
  for (let index = period; index < values.length; index += 1) {
    previous = values[index] * multiplier + previous * (1 - multiplier);
    output.push(previous);
  }
  return output;
}

function calculateRsi(closes, period = 14) {
  if (closes.length <= period) return null;
  let gains = 0;
  let losses = 0;
  for (let index = closes.length - period; index < closes.length; index += 1) {
    const change = closes[index] - closes[index - 1];
    if (change >= 0) gains += change;
    else losses += Math.abs(change);
  }
  if (!losses) return 100;
  const relativeStrength = gains / period / (losses / period);
  return round(100 - 100 / (1 + relativeStrength));
}

function calculateMacd(closes) {
  if (closes.length < 35) return { macd: null, signal: null, histogram: null };
  const ema12 = emaSeries(closes, 12);
  const ema26 = emaSeries(closes, 26);
  const macdLine = closes.map((_, index) => {
    if (!Number.isFinite(ema12[index]) || !Number.isFinite(ema26[index])) return null;
    return ema12[index] - ema26[index];
  });
  const cleanMacd = macdLine.filter(Number.isFinite);
  if (cleanMacd.length < 9) return { macd: null, signal: null, histogram: null };
  const signalSeries = emaSeries(cleanMacd, 9);
  const macd = cleanMacd[cleanMacd.length - 1];
  const signal = signalSeries[signalSeries.length - 1];
  return {
    macd: round(macd),
    signal: round(signal),
    histogram: Number.isFinite(macd) && Number.isFinite(signal) ? round(macd - signal) : null,
  };
}

function average(values) {
  const clean = values.filter(Number.isFinite);
  return clean.length ? clean.reduce((total, value) => total + value, 0) / clean.length : null;
}

function dateFromUnixSeconds(value) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? new Date(timestamp * 1000).toISOString().slice(0, 10) : null;
}

function priceDifference(actual, expected) {
  if (!Number.isFinite(actual) || !Number.isFinite(expected) || expected === 0) return null;
  return {
    actual: round(actual),
    expected: round(expected),
    absolute: round(actual - expected, 4),
    percent: round(((actual - expected) / expected) * 100, 4),
  };
}

function materialPriceMismatch(actual, expected, tolerancePercent = 0.25) {
  const difference = priceDifference(actual, expected);
  return difference && Math.abs(difference.percent) > tolerancePercent;
}

function validateMarketData({ quote, history }) {
  const latest = history?.candles?.[history.candles.length - 1] || null;
  const quoteDate = dateFromUnixSeconds(quote?.t);
  const issues = [];
  const warnings = [];
  const comparisons = {
    currentVsLatestClose: priceDifference(round(quote?.c), latest?.close),
    open: priceDifference(round(quote?.o), latest?.open),
    high: priceDifference(round(quote?.h), latest?.high),
    low: priceDifference(round(quote?.l), latest?.low),
    adjustedClose: Number.isFinite(latest?.adjClose) ? priceDifference(latest.close, latest.adjClose) : null,
  };

  if (!Number.isFinite(round(quote?.c))) issues.push("Finnhub did not return a valid current price.");
  if (!latest) issues.push(`${history?.source || "The market data provider"} did not return a latest candle.`);
  if (quoteDate && latest?.date && !String(latest.date).startsWith(quoteDate)) issues.push(`Quote date ${quoteDate} does not match candle date ${latest.date}.`);
  if (materialPriceMismatch(round(quote?.c), latest?.close)) issues.push(`Finnhub current price differs materially from ${history?.source || "the candle provider"} latest close.`);
  if (materialPriceMismatch(round(quote?.o), latest?.open, 0.5)) warnings.push(`Finnhub open differs from ${history?.source || "the candle provider"} open.`);
  if (materialPriceMismatch(round(quote?.h), latest?.high, 0.5)) warnings.push(`Finnhub day high differs from ${history?.source || "the candle provider"} high.`);
  if (materialPriceMismatch(round(quote?.l), latest?.low, 0.5)) warnings.push(`Finnhub day low differs from ${history?.source || "the candle provider"} low.`);
  if (comparisons.adjustedClose && Math.abs(comparisons.adjustedClose.percent) > 0.05) {
    warnings.push("Adjusted close differs from raw close; trading calculations use raw OHLC prices.");
  }
  if (!Number.isFinite(latest?.volume)) issues.push(`${history?.source || "The candle provider"} did not return valid latest volume.`);

  return {
    validated: issues.length === 0,
    issues,
    warnings,
    quoteSource: "Finnhub",
    historySource: history?.source || "Candle provider",
    quoteTimestamp: Number.isFinite(Number(quote?.t)) ? Number(quote.t) : null,
    quoteDate,
    latestCandleDate: latest?.date || null,
    latestVolume: Number.isFinite(latest?.volume) ? latest.volume : null,
    comparisons,
  };
}

function reconcileLatestCandleWithQuote(candles, quote, marketData) {
  if (!marketData?.validated || !Array.isArray(candles) || !candles.length) return candles;
  const next = candles.map((candle) => ({ ...candle }));
  const latest = next[next.length - 1];
  const quoteClose = round(quote?.c);
  const quoteOpen = round(quote?.o);
  const quoteHigh = round(quote?.h);
  const quoteLow = round(quote?.l);
  if (marketData.quoteDate !== latest.date || !Number.isFinite(quoteClose)) return next;

  latest.close = quoteClose;
  if (Number.isFinite(quoteOpen)) latest.open = quoteOpen;
  if (Number.isFinite(quoteHigh)) latest.high = Math.max(quoteHigh, quoteClose, latest.high);
  if (Number.isFinite(quoteLow)) latest.low = Math.min(quoteLow, quoteClose, latest.low);
  latest.priceValidated = true;
  latest.priceSource = "Finnhub quote reconciled with connected candle provider";
  return next;
}

function calculateAtr(candles, period = 14) {
  if (candles.length <= period) return null;
  const trueRanges = candles.slice(-period).map((candle, index, slice) => {
    const previousClose = index === 0 ? candles[candles.length - period - 1]?.close : slice[index - 1]?.close;
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose)
    );
  });
  return round(average(trueRanges));
}

function getMeta(symbol) {
  return TRADER_WATCHLIST.find((item) => item.symbol === symbol) || { symbol, companyName: symbol, exchange: "NASDAQ", sector: "Trading Watchlist" };
}

async function fetchQuote(symbol) {
  const apiKey = process.env.FINNHUB_API_KEY?.trim();
  if (!apiKey) return { ok: false, error: "Live quote temporarily unavailable.", data: null };
  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(apiKey)}`;

  try {
    const response = await fetch(url);
    const data = await response.json().catch(() => null);
    if (!response.ok) return { ok: false, error: "Live quote temporarily unavailable.", data: null };
    return { ok: true, data, error: null };
  } catch (error) {
    console.error("Freedom Trader quote failed:", error);
    return { ok: false, error: "Live quote temporarily unavailable.", data: null };
  }
}

function scoreStatus(score) {
  if (!Number.isFinite(score)) return "INFO";
  if (score >= 90) return "STRONG SETUP";
  if (score >= 80) return "BUY SETUP";
  if (score >= 70) return "WATCH";
  if (score >= 60) return "WAIT";
  return "NO TRADE";
}

function historyDiagnostics(history, cleanCandles, requestedRange = "1y", requestedInterval = "1d") {
  const first = cleanCandles[0]?.date || history?.candles?.[0]?.date || null;
  const latest = cleanCandles[cleanCandles.length - 1]?.date || history?.candles?.[history.candles.length - 1]?.date || null;
  const apiError = history?.error || null;
  let status = "Ready";
  if (apiError && /minute|credit|limit/i.test(apiError)) status = "Twelve Data minute limit reached";
  else if (apiError) status = apiError;
  else if (!cleanCandles.length) status = requestedInterval === "1d" ? "No daily history returned" : "No intraday history returned";
  else if (cleanCandles.length < 20) status = `Only ${cleanCandles.length} of 20 candles available`;
  else if (cleanCandles.length < 50) status = `Only ${cleanCandles.length} of 50 candles available`;
  else if (cleanCandles.length < 200) status = "Indicator requires 200 candles";
  return {
    provider: history?.provider || history?.source || "Twelve Data",
    requestedRange,
    requestedInterval,
    actualCandleCount: cleanCandles.length,
    firstTimestamp: first,
    latestTimestamp: latest,
    cacheStatus: history?.cache?.hit ? "hit" : history?.cache?.deduped ? "deduped-in-flight" : history?.cache ? "miss" : "none",
    apiError,
    status,
    readyForScore: status === "Ready",
  };
}

export function buildAnalysis({ symbol, quote, candles, marketData = null, history = null }) {
  const meta = getMeta(symbol);
  const clean = candles.filter((candle) => ["open", "high", "low", "close", "volume"].every((key) => Number.isFinite(candle[key])));
  const dataStatus = historyDiagnostics(history, clean);
  const closes = clean.map((candle) => candle.close);
  const volumes = clean.map((candle) => candle.volume);
  const latest = clean[clean.length - 1] || {};
  const currentPrice = round(quote?.c) ?? latest.close ?? null;
  const previousClose = round(quote?.pc) ?? (closes.length > 1 ? closes[closes.length - 2] : null);
  const change = Number.isFinite(currentPrice) && Number.isFinite(previousClose) ? round(currentPrice - previousClose) : round(quote?.d);
  const changePercent = Number.isFinite(currentPrice) && Number.isFinite(previousClose) && previousClose !== 0
    ? round(((currentPrice - previousClose) / previousClose) * 100)
    : round(quote?.dp);
  const ma20 = sma(closes, 20);
  const ma50 = sma(closes, 50);
  const ma200 = sma(closes, 200);
  const rsi = calculateRsi(closes);
  const macd = calculateMacd(closes);
  const atr = calculateAtr(clean);
  const avgVolume20 = round(average(volumes.slice(-20)), 0);
  const latestVolume = volumes[volumes.length - 1] ?? null;
  const relativeVolume = Number.isFinite(avgVolume20) && avgVolume20 > 0 ? round(latestVolume / avgVolume20, 2) : null;
  const recent = clean.slice(-30);
  const support = recent.length >= 10 ? round(Math.min(...recent.map((candle) => candle.low))) : null;
  const resistance = recent.length >= 10 ? round(Math.max(...recent.map((candle) => candle.high))) : null;
  const volatility = clean.length >= 20 ? round(average(clean.slice(-20).map((candle) => ((candle.high - candle.low) / candle.close) * 100))) : null;
  const distanceFromSupport = Number.isFinite(currentPrice) && Number.isFinite(support) ? round(((currentPrice - support) / currentPrice) * 100) : null;
  const distanceFromResistance = Number.isFinite(currentPrice) && Number.isFinite(resistance) ? round(((resistance - currentPrice) / currentPrice) * 100) : null;
  const oneMonthAgo = closes.length >= 21 ? closes[closes.length - 21] : null;
  const momentumReturn = Number.isFinite(currentPrice) && Number.isFinite(oneMonthAgo) ? round(((currentPrice - oneMonthAgo) / oneMonthAgo) * 100) : null;
  const enoughCore = dataStatus.readyForScore && [currentPrice, ma20, ma50, ma200, rsi, macd.histogram, atr, support, resistance, relativeVolume, volatility].every(Number.isFinite);

  let trend = dataStatus.readyForScore ? "Unknown" : dataStatus.status;
  if (Number.isFinite(currentPrice) && Number.isFinite(ma20) && Number.isFinite(ma50)) {
    trend = currentPrice > ma20 && ma20 > ma50 ? "Uptrend" : currentPrice < ma20 && ma20 < ma50 ? "Downtrend" : "Sideways";
  }

  const trendRaw = enoughCore ? (currentPrice > ma20 ? 35 : 10) + (currentPrice > ma50 ? 35 : 10) + (Number.isFinite(ma200) && currentPrice > ma200 ? 20 : 5) + (ma20 > ma50 ? 10 : 0) : null;
  const momentumRaw = Number.isFinite(momentumReturn) && Number.isFinite(macd.histogram) ? clamp(50 + momentumReturn * 3 + macd.histogram * 10) : null;
  const volumeRaw = Number.isFinite(relativeVolume) ? clamp(40 + relativeVolume * 25) : null;
  const volatilityRaw = Number.isFinite(volatility) ? clamp(100 - Math.abs(volatility - 4) * 15) : null;
  const supportRaw = Number.isFinite(distanceFromSupport) && Number.isFinite(distanceFromResistance) ? clamp(78 - distanceFromSupport * 2 + distanceFromResistance * 1.4) : null;
  const technicalRaw = Number.isFinite(rsi) && Number.isFinite(macd.histogram) ? clamp(100 - Math.abs(rsi - 55) * 2 + (macd.histogram > 0 ? 12 : -8)) : null;
  const components = {
    trendStrength: { weight: 20, score: round(trendRaw), contribution: Number.isFinite(trendRaw) ? round(trendRaw * 0.2) : null },
    momentum: { weight: 20, score: round(momentumRaw), contribution: Number.isFinite(momentumRaw) ? round(momentumRaw * 0.2) : null },
    volumeConfirmation: { weight: 15, score: round(volumeRaw), contribution: Number.isFinite(volumeRaw) ? round(volumeRaw * 0.15) : null },
    volatilitySuitability: { weight: 15, score: round(volatilityRaw), contribution: Number.isFinite(volatilityRaw) ? round(volatilityRaw * 0.15) : null },
    supportResistanceSetup: { weight: 15, score: round(supportRaw), contribution: Number.isFinite(supportRaw) ? round(supportRaw * 0.15) : null },
    technicalIndicators: { weight: 15, score: round(technicalRaw), contribution: Number.isFinite(technicalRaw) ? round(technicalRaw * 0.15) : null },
  };
  const contributions = Object.values(components).map((item) => item.contribution);
  let tradingScore = contributions.every(Number.isFinite) ? Math.round(contributions.reduce((total, value) => total + value, 0)) : null;

  let plannedEntry = null;
  let target = null;
  let stop = null;
  let riskPerShare = null;
  let rewardPerShare = null;
  let riskRewardRatio = null;
  let setupReasoning = dataStatus.readyForScore ? "Waiting for complete setup inputs." : dataStatus.status;
  let expectedHoldingPeriod = null;
  let setupExpiryDate = null;

  if (enoughCore) {
    const nearResistance = distanceFromResistance <= 2;
    const nearSupport = distanceFromSupport <= 5;
    plannedEntry = round(nearResistance && relativeVolume >= 1.2 ? resistance * 1.005 : nearSupport ? currentPrice : support + atr * 0.5);
    stop = round(Math.min(support - atr * 0.35, plannedEntry - atr));
    riskPerShare = Number.isFinite(plannedEntry) && Number.isFinite(stop) ? round(plannedEntry - stop) : null;
    const minimumTarget = Number.isFinite(riskPerShare) ? plannedEntry + riskPerShare * 2 : null;
    target = Number.isFinite(resistance) && resistance > plannedEntry ? round(Math.max(resistance, minimumTarget)) : round(minimumTarget);
    rewardPerShare = Number.isFinite(target) && Number.isFinite(plannedEntry) ? round(target - plannedEntry) : null;
    riskRewardRatio = Number.isFinite(rewardPerShare) && Number.isFinite(riskPerShare) && riskPerShare > 0 ? round(rewardPerShare / riskPerShare) : null;
    if (!Number.isFinite(riskRewardRatio) || riskRewardRatio < 2 || riskPerShare <= 0) {
      setupReasoning = "No disciplined setup yet: risk/reward is below 2:1 or stop placement is not valid.";
    } else {
      setupReasoning = nearResistance
        ? "Breakout setup: price is near resistance with sufficient relative volume. Entry waits for confirmation above resistance."
        : "Pullback setup: price is near recent support with a defined stop below support/ATR and target at resistance or better.";
      expectedHoldingPeriod = tradingScore >= 85 ? "2 days to 1 week" : "1 to 6 weeks";
      setupExpiryDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    }
  }

  const legacySetupStatus = scoreStatus(tradingScore);
  let status = legacySetupStatus;
  if ((status === "STRONG SETUP" || status === "BUY SETUP") && (!Number.isFinite(riskRewardRatio) || riskRewardRatio < 2)) {
    status = tradingScore >= 70 ? "WATCH" : tradingScore >= 60 ? "WAIT" : "NO TRADE";
  }

  const confidence = Number.isFinite(tradingScore) ? round(clamp(tradingScore * 0.8 + (Number.isFinite(relativeVolume) ? Math.min(relativeVolume, 3) * 5 : 0))) : null;
  const setup = {
    valid: status === "STRONG SETUP" || status === "BUY SETUP" || (Number.isFinite(riskRewardRatio) && riskRewardRatio >= 2),
    plannedEntry,
    target,
    stop,
    riskPerShare,
    rewardPerShare,
    riskRewardRatio,
    expectedHoldingPeriod,
    setupExpiryDate,
    setupReasoning,
  };
  const signalResult = calculateTraderSignal({
    ticker: symbol,
    exchange: meta.exchange,
    currency: "USD",
    timeframe: "1D",
    currentPrice,
    plannedEntry,
    tradingScore,
    confidence,
    indicators: {
      ma20,
      ma50,
      ma200,
      rsi14: rsi,
      macd: macd.macd,
      macdSignal: macd.signal,
      macdHistogram: macd.histogram,
      atr14: atr,
      averageVolume20: avgVolume20,
      relativeVolume,
      support,
      resistance,
      volatility20: volatility,
      distanceFromSupport,
      distanceFromResistance,
    },
    setup,
    marketData,
    dataStatus,
  });
  status = signalResult.overallSignal;

  return {
    symbol,
    companyName: meta.companyName,
    exchange: meta.exchange,
    sector: meta.sector,
    currentPrice,
    previousClose,
    change,
    changePercent,
    volume: latestVolume,
    indicators: {
      ma20,
      ma50,
      ma200,
      rsi14: rsi,
      macd: macd.macd,
      macdSignal: macd.signal,
      macdHistogram: macd.histogram,
      atr14: atr,
      averageVolume20: avgVolume20,
      relativeVolume,
      support,
      resistance,
      volatility20: volatility,
      distanceFromSupport,
      distanceFromResistance,
    },
    fibonacci: {
      anchors: null,
      levels: [],
      confluence: [],
      mode: "manual",
    },
    tradingScore,
    trend,
    status,
    legacySetupStatus,
    signalResult,
    confidence,
    scoreExplanation: components,
    setup,
    marketData,
    dataStatus,
    candleCount: clean.length,
    error: null,
  };
}

export async function analyseSymbol(symbol) {
  const requestedRange = "1y";
  const requestedInterval = "1d";
  const [quoteResult, history] = await Promise.all([
    fetchQuote(symbol),
    fetchTraderHistory(symbol, requestedRange, requestedInterval),
  ]);
  const cleanHistoryCandles = Array.isArray(history?.candles)
    ? history.candles.filter((candle) => ["open", "high", "low", "close", "volume"].every((key) => Number.isFinite(candle[key])))
    : [];
  const dataStatus = historyDiagnostics(history, cleanHistoryCandles, requestedRange, requestedInterval);

  if (!quoteResult.ok || !quoteResult.data) {
    const meta = getMeta(symbol);
    return {
      symbol,
      companyName: meta.companyName,
      exchange: meta.exchange,
      sector: meta.sector,
      currentPrice: null,
      changePercent: null,
      indicators: {},
      tradingScore: null,
      trend: "Market data not validated",
      status: "INFO",
      confidence: null,
      scoreExplanation: {},
      setup: { valid: false, setupReasoning: "Live market price could not be confirmed. No trade recommendation is available." },
      dataStatus: { ...dataStatus, status: quoteResult.error || "Live quote temporarily unavailable.", apiError: quoteResult.error || dataStatus.apiError },
      marketData: {
        validated: false,
        issues: [quoteResult.error || "Live quote temporarily unavailable."],
        warnings: [],
        quoteSource: "Finnhub",
        historySource: history?.source || "Candle provider",
      },
      candleCount: history?.candles?.length || 0,
      error: quoteResult.error || "Live quote temporarily unavailable.",
    };
  }

  if (!history.ok) {
    const meta = getMeta(symbol);
    return {
      symbol,
      companyName: meta.companyName,
      exchange: meta.exchange,
      sector: meta.sector,
      currentPrice: round(quoteResult.data?.c),
      changePercent: round(quoteResult.data?.dp),
      indicators: {},
      tradingScore: null,
      trend: dataStatus.status,
      status: "INFO",
      confidence: null,
      scoreExplanation: {},
      setup: { valid: false, setupReasoning: "Historical data temporarily unavailable. No trade recommendation is available." },
      dataStatus,
      marketData: {
        validated: false,
        issues: [history.error || "Historical data temporarily unavailable."],
        warnings: [],
        quoteSource: "Finnhub",
        historySource: history?.source || "Candle provider",
      },
      candleCount: 0,
      error: dataStatus.status || "Historical data temporarily unavailable.",
    };
  }

  const marketData = validateMarketData({ quote: quoteResult.data, history });
  if (!marketData.validated) {
    const meta = getMeta(symbol);
    return {
      symbol,
      companyName: meta.companyName,
      exchange: meta.exchange,
      sector: meta.sector,
      currentPrice: round(quoteResult.data?.c),
      previousClose: round(quoteResult.data?.pc),
      change: round(quoteResult.data?.d),
      changePercent: round(quoteResult.data?.dp),
      volume: history.candles?.[history.candles.length - 1]?.volume ?? null,
      indicators: {},
      fibonacci: { anchors: null, levels: [], confluence: [] },
      tradingScore: null,
      trend: "Market data not validated",
      status: "INFO",
      confidence: null,
      scoreExplanation: {},
      setup: { valid: false, setupReasoning: `Market data validation failed: ${marketData.issues.join(" ")}` },
      dataStatus,
      marketData,
      candleCount: history.candles?.length || 0,
      error: `Market data validation failed: ${marketData.issues.join(" ")}`,
    };
  }

  const reconciledCandles = reconcileLatestCandleWithQuote(history.candles, quoteResult.data, marketData);
  return buildAnalysis({ symbol, quote: quoteResult.data, candles: reconciledCandles, marketData, history });
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, analysis: [], error: "Method not allowed." });
  }

  const symbols = parseSymbols(req).slice(0, 20);
  const analysis = await Promise.all(symbols.map((symbol) => analyseSymbol(symbol)));

  return res.status(200).json({
    ok: true,
    analysis,
    count: analysis.length,
    updatedAt: new Date().toISOString(),
  });
}
