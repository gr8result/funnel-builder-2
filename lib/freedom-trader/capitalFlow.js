const CAPITAL_FLOW_STATES = ["NORMAL", "ACTIVITY DETECTED", "DEVELOPING", "REVIEW NOW", "TRADE READY", "FADED", "REJECTED", "DATA UNAVAILABLE"];

function num(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, decimals = 2) {
  const number = num(value);
  return number === null ? null : Number(number.toFixed(decimals));
}

function clamp(value, min = 0, max = 100) {
  const number = num(value);
  if (number === null) return null;
  return Math.max(min, Math.min(max, number));
}

function latestCandles(row) {
  const source = row?.marketData?.candles || row?.source?.marketData?.candles || row?.candles || {};
  if (Array.isArray(source.intraday) && source.intraday.length) return source.intraday;
  if (Array.isArray(source.daily) && source.daily.length) return source.daily;
  return [];
}

function closeOf(candle) {
  return num(candle?.close ?? candle?.price);
}

function volumeOf(candle) {
  return num(candle?.volume);
}

export function classifyBuyingPressure({ priceChangePercent, relativeVolume, closes = [] } = {}) {
  const change = num(priceChangePercent);
  const rvol = num(relativeVolume);
  if (change === null || rvol === null) return "DATA UNAVAILABLE";
  const recent = closes.map(num).filter((value) => value !== null);
  const persistence = recent.length >= 4 ? recent.slice(-4).filter((value, index, list) => index === 0 || value >= list[index - 1]).length : 0;
  if (rvol >= 1.8 && change >= 0.75 && persistence >= 3) return "STRONG BUYING PRESSURE";
  if (rvol >= 1.35 && change >= 0.25) return "BUYING PRESSURE";
  if (rvol >= 1.8 && change <= -0.75) return "STRONG SELLING PRESSURE";
  if (rvol >= 1.35 && change <= -0.25) return "SELLING PRESSURE";
  return "BALANCED";
}

export function capitalFlowStatus(flow = {}) {
  if (flow.dataQuality === "unavailable" || flow.capitalFlowScore === null) return "DATA UNAVAILABLE";
  if (/SELLING/.test(flow.pressure || "")) return "REJECTED";
  if (flow.relativeVolume >= 2.8 && Math.abs(flow.priceChangePercent || 0) < 0.25 && (flow.acceleration <= -12 || flow.previousScore >= 75)) return "FADED";
  if (flow.capitalFlowScore >= 88 && flow.pressure === "STRONG BUYING PRESSURE") return "TRADE READY";
  if (flow.capitalFlowScore >= 78 && /BUYING/.test(flow.pressure || "")) return "REVIEW NOW";
  if (flow.capitalFlowScore >= 58 && /BUYING/.test(flow.pressure || "")) return "DEVELOPING";
  if (flow.capitalFlowScore >= 42 && flow.relativeVolume >= 1.25) return "ACTIVITY DETECTED";
  return "NORMAL";
}

export function computeCapitalFlow(row = {}, previous = null, options = {}) {
  const previousFlow = previous || row.previousCapitalFlow || null;
  if (row?.dataStatus?.readyForScore === false || row?.marketData?.validated === false) {
    return {
      capitalFlowScore: null,
      state: "DATA UNAVAILABLE",
      pressure: "DATA UNAVAILABLE",
      relativeVolume: null,
      priceChangePercent: null,
      acceleration: null,
      catalyst: { detected: false, label: "No obvious catalyst identified." },
      explanation: "Market data is unavailable. Freedom cannot assess capital flow.",
      components: { dataQuality: 0 },
      dataQuality: "unavailable",
    };
  }

  const candles = latestCandles(row);
  const closes = candles.map(closeOf).filter((value) => value !== null);
  const volumes = candles.map(volumeOf).filter((value) => value !== null);
  const lastVolume = num(row.volume) ?? volumes[volumes.length - 1];
  const averageVolume = num(row.averageVolume) || num(row.indicators?.averageVolume20) || (volumes.length ? volumes.slice(-20).reduce((total, value) => total + value, 0) / Math.min(20, volumes.length) : null);
  const relativeVolume = num(row.indicators?.relativeVolume) ?? (lastVolume !== null && averageVolume ? lastVolume / averageVolume : null);
  const priceChangePercent = num(row.changePercent) ?? (closes.length >= 2 && closes[closes.length - 2] ? ((closes[closes.length - 1] - closes[closes.length - 2]) / closes[closes.length - 2]) * 100 : null);
  const pressure = classifyBuyingPressure({ priceChangePercent, relativeVolume, closes });
  const previousScore = num(previousFlow?.capitalFlowScore);
  const volumeComponent = relativeVolume === null ? 0 : clamp((relativeVolume / 3) * 46);
  const momentumComponent = priceChangePercent === null ? 0 : clamp(20 + priceChangePercent * 8, 0, 28);
  const persistence = closes.length >= 4 ? closes.slice(-4).filter((value, index, list) => index === 0 || value >= list[index - 1]).length / 4 : 0.5;
  const persistenceComponent = clamp(persistence * 16);
  const directionComponent = /STRONG BUYING/.test(pressure) ? 10 : pressure === "BUYING PRESSURE" ? 6 : /SELLING/.test(pressure) ? -18 : 0;
  const actualAcceleration = previousScore === null ? 0 : round((volumeComponent + momentumComponent + persistenceComponent + directionComponent) - previousScore, 2);
  const score = clamp(volumeComponent + momentumComponent + persistenceComponent + directionComponent + Math.max(0, actualAcceleration) * 0.35);
  const catalyst = options.catalyst || row.catalyst || { detected: false, label: "No obvious catalyst identified." };
  const flow = {
    capitalFlowScore: round(score),
    previousScore,
    state: "NORMAL",
    pressure,
    relativeVolume: round(relativeVolume),
    priceChangePercent: round(priceChangePercent),
    acceleration: actualAcceleration,
    catalyst,
    explanation: "No unusual capital flow is visible.",
    components: {
      relativeVolume: round(volumeComponent),
      priceMomentum: round(momentumComponent),
      persistence: round(persistenceComponent),
      buyingSellingPressure: directionComponent,
      acceleration: round(Math.max(0, actualAcceleration) * 0.35),
    },
    dataQuality: candles.length ? "daily-or-intraday" : "snapshot-only",
  };
  flow.state = capitalFlowStatus(flow);
  if (/SELLING/.test(pressure)) {
    flow.explanation = `Trading activity is approximately ${round(relativeVolume, 1)} times normal, but price is falling with the increased volume. Freedom treats this as selling pressure, not a buying opportunity.`;
  } else if (/BUYING/.test(pressure)) {
    flow.explanation = `Trading activity is approximately ${round(relativeVolume, 1)} times normal, price is rising with the increased volume, and buying pressure has persisted across the latest data.`;
  } else if (flow.state === "FADED") {
    flow.explanation = "A one-off activity spike faded before becoming a reliable opportunity.";
  }
  return flow;
}

export function capitalFlowSummary(rows = []) {
  const list = rows.map((row) => ({ ...(row.capitalFlow || row), symbol: row.symbol, companyName: row.companyName, currentPrice: row.currentPrice, currency: row.currency })).filter(Boolean);
  return {
    scanning: rows.length,
    strongBuyingPressure: list.filter((item) => item.pressure === "STRONG BUYING PRESSURE").length,
    developing: list.filter((item) => item.state === "DEVELOPING").length,
    reviewNow: list.filter((item) => item.state === "REVIEW NOW" || item.state === "TRADE READY").length,
    top: list.filter((item) => Number.isFinite(Number(item.capitalFlowScore))).sort((a, b) => Number(b.capitalFlowScore) - Number(a.capitalFlowScore)).slice(0, 5),
  };
}

export { CAPITAL_FLOW_STATES };
