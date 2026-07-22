export const SIGNAL_TIMEFRAMES = {
  DAILY: "1D",
  WEEKLY: "1W",
  MONTHLY: "1M",
};

export const SIGNAL_LABELS = [
  "STRONG BUY",
  "BUY",
  "WATCH",
  "WAIT FOR ENTRY",
  "HOLD",
  "SELL",
  "STRONG SELL",
];

function round(value, decimals = 2) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(decimals)) : null;
}

function signalTimestamp() {
  return new Date().toISOString();
}

export function normalizeSignalLabel(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "STRONG SETUP") return "WAIT FOR ENTRY";
  if (normalized === "BUY SETUP") return "WAIT FOR ENTRY";
  if (normalized === "BUY NOW") return "BUY";
  if (normalized === "WAIT") return "WAIT FOR ENTRY";
  if (normalized === "HOLD OFF" || normalized === "NO TRADE" || normalized === "INFO" || normalized === "AVOID") return "HOLD";
  if (SIGNAL_LABELS.includes(normalized)) return normalized;
  return "WATCH";
}

export function signalClassName(signal) {
  const normalized = normalizeSignalLabel(signal);
  if (normalized === "STRONG BUY") return "strongBuy";
  if (normalized === "BUY") return "buy";
  if (normalized === "WATCH") return "watch";
  if (normalized === "WAIT FOR ENTRY" || normalized === "HOLD") return "holdOff";
  if (normalized === "SELL") return "sell";
  if (normalized === "STRONG SELL") return "strongSell";
  return "info";
}

export function calculateTraderSignal({
  ticker,
  exchange = "NASDAQ",
  currency = "USD",
  timeframe = SIGNAL_TIMEFRAMES.DAILY,
  currentPrice,
  plannedEntry,
  tradingScore,
  confidence,
  indicators = {},
  setup = {},
  marketData = {},
  dataStatus = {},
  dataProvider = null,
}) {
  const price = Number(currentPrice);
  const entry = Number(plannedEntry ?? setup?.plannedEntry);
  const score = Number(tradingScore);
  const validSetup = Boolean(setup?.valid);
  const marketValidated = marketData?.validated !== false && !dataStatus?.apiError;
  const reasons = [];

  let overallSignal = "HOLD";

  if (!marketValidated) {
    overallSignal = "HOLD";
    reasons.push("Market data is not validated, so no active trade recommendation is shown");
  } else if (validSetup && Number.isFinite(price) && Number.isFinite(entry) && price > entry) {
    overallSignal = "WAIT FOR ENTRY";
    reasons.push("A proposed setup exists, but market price has not reached or confirmed the entry level");
  } else if (validSetup && Number.isFinite(score) && score >= 90) {
    overallSignal = "STRONG BUY";
    reasons.push("All required entry conditions are confirmed for the selected timeframe");
  } else if (validSetup && Number.isFinite(score) && score >= 80) {
    overallSignal = "BUY";
    reasons.push("Most entry conditions are confirmed and entry is currently valid");
  } else if (Number.isFinite(score) && score >= 70) {
    overallSignal = "WATCH";
    reasons.push("The company is attractive, but entry conditions are not yet confirmed");
  } else if (validSetup) {
    overallSignal = "WAIT FOR ENTRY";
    reasons.push("A proposed setup exists, but confirmation is incomplete");
  } else {
    overallSignal = "HOLD";
    reasons.push(setup?.setupReasoning || dataStatus?.status || "No immediate action is required");
  }

  if (Number.isFinite(indicators?.rsi14)) {
    if (indicators.rsi14 >= 70) reasons.push("RSI is elevated");
    else if (indicators.rsi14 <= 35) reasons.push("RSI is oversold");
    else reasons.push("RSI is neutral");
  }
  if (Number.isFinite(indicators?.macdHistogram)) {
    reasons.push(indicators.macdHistogram > 0 ? "MACD is improving" : "MACD is weakening");
  }
  if (Number.isFinite(indicators?.relativeVolume)) {
    reasons.push(indicators.relativeVolume >= 1.2 ? "Volume confirmation is present" : "Volume confirmation is missing");
  }

  return {
    ticker,
    exchange,
    currency,
    selectedTimeframe: timeframe,
    timeframe,
    overallSignal,
    confidence: Number.isFinite(Number(confidence)) ? round(confidence) : Number.isFinite(score) ? round(score) : null,
    signalTimestamp: signalTimestamp(),
    marketDataTimestamp: marketData?.latestCandleDate || dataStatus?.latestTimestamp || null,
    dataProvider: dataProvider || marketData?.historySource || dataStatus?.provider || "Unknown",
    componentIndicators: indicators,
    reasons,
    explanation: reasons.join(". "),
  };
}

export function calculateInvestmentSignal({
  ticker,
  exchange = "NASDAQ",
  currency = "USD",
  timeframe = SIGNAL_TIMEFRAMES.DAILY,
  decision,
  confidence,
  buyScore,
  quote = {},
  valuation = {},
  dataProvider = "Finnhub / Yahoo Finance",
}) {
  const overallSignal = normalizeSignalLabel(decision);
  const reasons = [];
  if (overallSignal === "WATCH") reasons.push("The company is attractive, but entry conditions are not yet confirmed");
  if (overallSignal === "BUY") reasons.push("Most entry conditions are confirmed and the entry is currently valid");
  if (overallSignal === "STRONG BUY") reasons.push("All required entry conditions are confirmed");
  if (overallSignal === "HOLD") reasons.push("Already owned or no immediate action required");
  if (Number.isFinite(Number(valuation?.buyBelow)) && Number.isFinite(Number(quote?.currentPrice))) {
    reasons.push(
      Number(quote.currentPrice) <= Number(valuation.buyBelow)
        ? "Price is inside the buy-below range"
        : "Price remains above the buy-below range"
    );
  }

  return {
    ticker,
    exchange,
    currency,
    selectedTimeframe: timeframe,
    timeframe,
    overallSignal,
    confidence: Number.isFinite(Number(confidence)) ? round(confidence) : Number.isFinite(Number(buyScore)) ? round(buyScore) : null,
    signalTimestamp: signalTimestamp(),
    marketDataTimestamp: quote?.lastUpdated || quote?.timestamp || null,
    dataProvider,
    componentIndicators: {
      buyScore: round(buyScore),
      fairValue: round(valuation?.fairValue),
      buyBelow: round(valuation?.buyBelow),
      currentPrice: round(quote?.currentPrice),
    },
    reasons,
    explanation: reasons.join(". "),
  };
}
