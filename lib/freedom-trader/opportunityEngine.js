const DEFAULT_CONFIG = {
  minimumScore: 82,
  minimumDailyVolume: 1000000,
  minimumRiskReward: 2,
  maximumVolatility: 9,
  maximumEntryExtensionPercent: 3,
  staleDailyHours: 96,
  maximumPlannedLossPerTrade: 75,
  maximumPositionValue: 1250,
  availableCash: 5000,
};

export const FREEDOM_TRADER_V1_MARKETS = ["US"];
export const FREEDOM_TRADER_V1_MARKET_SCOPE_MESSAGE = "Freedom Trader V1.0 currently analyses US markets only. ASX support is planned for the next major milestone.";
export const MARKET_DATA_STATUSES = ["READY", "DELAYED", "CACHED", "STALE", "UNAVAILABLE", "UNSUPPORTED", "PERMISSION_DENIED", "RATE_LIMITED"];
export const OPPORTUNITY_ACTIONS = ["READY TO BUY", "DEVELOPING", "WAIT", "NO ACTION", "DATA UNAVAILABLE"];
const PRIORITY_TIER_1_SYMBOLS = new Set(["AVGO", "NVDA", "MSFT", "AMZN", "AAPL", "META", "GOOGL"]);

export const SUPPORTED_UNIVERSES = {
  US_LIQUID: [
    ["AAPL", "Apple", "Technology", "US"], ["MSFT", "Microsoft", "Software", "US"], ["NVDA", "NVIDIA", "Semiconductors", "US"],
    ["AMZN", "Amazon", "Cloud & E-commerce", "US"], ["META", "Meta Platforms", "Digital Advertising & AI", "US"], ["GOOGL", "Alphabet", "Digital Advertising & AI", "US"],
    ["AVGO", "Broadcom", "Semiconductors", "US"], ["AMD", "Advanced Micro Devices", "Semiconductors", "US"], ["TSLA", "Tesla", "EV & Energy", "US"],
    ["PLTR", "Palantir", "AI Software", "US"], ["COST", "Costco", "Consumer Defensive", "US"], ["V", "Visa", "Payments", "US"],
    ["MA", "Mastercard", "Payments", "US"], ["NFLX", "Netflix", "Streaming", "US"], ["ADBE", "Adobe", "Software", "US"],
    ["CRM", "Salesforce", "Software", "US"], ["ORCL", "Oracle", "Software", "US"], ["NOW", "ServiceNow", "Software", "US"],
    ["INTC", "Intel", "Semiconductors", "US"], ["QCOM", "Qualcomm", "Semiconductors", "US"], ["MU", "Micron", "Semiconductors", "US"],
    ["AMAT", "Applied Materials", "Semiconductor Equipment", "US"], ["LRCX", "Lam Research", "Semiconductor Equipment", "US"], ["ASML", "ASML", "Semiconductor Equipment", "US"],
    ["TSM", "Taiwan Semiconductor", "Semiconductors", "US"], ["JPM", "JPMorgan Chase", "Financials", "US"], ["BAC", "Bank of America", "Financials", "US"],
    ["GS", "Goldman Sachs", "Financials", "US"], ["MS", "Morgan Stanley", "Financials", "US"], ["UNH", "UnitedHealth", "Healthcare", "US"],
    ["LLY", "Eli Lilly", "Healthcare", "US"], ["MRK", "Merck", "Healthcare", "US"], ["ABBV", "AbbVie", "Healthcare", "US"],
    ["XOM", "Exxon Mobil", "Energy", "US"], ["CVX", "Chevron", "Energy", "US"], ["CAT", "Caterpillar", "Industrials", "US"],
    ["GE", "GE Aerospace", "Industrials", "US"], ["BA", "Boeing", "Industrials", "US"], ["DE", "Deere", "Industrials", "US"],
    ["WMT", "Walmart", "Consumer Defensive", "US"], ["HD", "Home Depot", "Retail", "US"], ["LOW", "Lowe's", "Retail", "US"],
    ["NKE", "Nike", "Consumer", "US"], ["MCD", "McDonald's", "Restaurants", "US"], ["SBUX", "Starbucks", "Restaurants", "US"],
    ["COIN", "Coinbase", "Crypto Infrastructure", "US"], ["MSTR", "MicroStrategy", "Bitcoin Treasury", "US"], ["SMCI", "Super Micro Computer", "AI Infrastructure", "US"],
  ].map(([symbol, companyName, sector, market], index) => ({
    symbol, companyName, sector, market,
    exchange: "NASDAQ/NYSE",
    universe: "Supported liquid US shares",
    enabled: true,
    minimumLiquidity: 1000000,
    priorityRank: index + 1,
    priorityTier: PRIORITY_TIER_1_SYMBOLS.has(symbol) ? 1 : index < 27 ? 2 : 3,
  })),
  // Disabled by default: the currently subscribed Twelve Data plan (Basic)
  // and Finnhub plan (free) both exclude ASX-listed symbols -- confirmed
  // directly against both providers (403/404 "requires Pro/Venture plan" /
  // "no access to this resource"). Scanning these returns honest
  // "Data unavailable" rows rather than silently failing; flip `enabled`
  // to true once a plan that covers the ASX is in place.
  ASX_SUPPORTED: [
    ["BHP.AX", "BHP Group", "Materials", "ASX"], ["CBA.AX", "Commonwealth Bank", "Financials", "ASX"], ["CSL.AX", "CSL", "Healthcare", "ASX"],
    ["NAB.AX", "National Australia Bank", "Financials", "ASX"], ["WBC.AX", "Westpac", "Financials", "ASX"], ["ANZ.AX", "ANZ Group", "Financials", "ASX"],
    ["WES.AX", "Wesfarmers", "Retail", "ASX"], ["WOW.AX", "Woolworths", "Consumer Defensive", "ASX"], ["MQG.AX", "Macquarie Group", "Financials", "ASX"],
  ].map(([symbol, companyName, sector, market]) => ({
    symbol, companyName, sector, market,
    exchange: "ASX",
    universe: "Supported ASX shares",
    enabled: false,
    disabledReason: "ASX market data requires a Twelve Data Pro/Venture plan (or an alternative ASX-capable provider). Currently unavailable on the Basic plan.",
    minimumLiquidity: 500000,
  })),
};

export const OPPORTUNITY_ENGINE_VERSION = "freedom-opportunity-engine-v2";

function round(value, decimals = 2) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(decimals)) : null;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function points(raw, maxPoints) {
  return round((clamp(Number(raw) || 0) / 100) * maxPoints, 1);
}

function hoursSince(value) {
  const timestamp = Date.parse(String(value || "").replace(" ", "T"));
  if (!Number.isFinite(timestamp)) return null;
  return (Date.now() - timestamp) / 3600000;
}

function dataAgeHours(value, now = new Date()) {
  const timestamp = Date.parse(String(value || "").replace(" ", "T"));
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, (now.getTime() - timestamp) / 3600000);
}

function cleanNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function quoteStatusFromRow(row = {}, quality = {}) {
  if (row.quoteStatus) return row.quoteStatus;
  if (row.errorCode === "permission-denied" || row.errorCode === "auth-required" || row.errorCode === "plan-restricted" || row.dataStatus?.errorCode === "permission-denied") return "permission-denied";
  if (row.errorCode === "rate-limited" || row.dataStatus?.errorCode === "rate-limited") return "rate-limited";
  if (quality.status === "PERMISSION_DENIED" || quality.status === "UNSUPPORTED") return "permission-denied";
  if (quality.status === "RATE_LIMITED") return "rate-limited";
  if (quality.status === "STALE") return "stale";
  if (quality.status === "UNAVAILABLE") return "unavailable";
  if (quality.status === "CACHED") return "cached";
  if (quality.status === "READY") return "live";
  return "delayed";
}

function historyStatusFromRow(row = {}, quality = {}) {
  if (row.historyStatus) return row.historyStatus;
  if (row.errorCode === "permission-denied" || row.errorCode === "auth-required" || row.errorCode === "plan-restricted" || row.dataStatus?.errorCode === "permission-denied") return "permission-denied";
  if (row.errorCode === "rate-limited" || row.dataStatus?.errorCode === "rate-limited") return "rate-limited";
  if (quality.status === "PERMISSION_DENIED" || quality.status === "UNSUPPORTED") return "permission-denied";
  if (quality.status === "RATE_LIMITED") return "rate-limited";
  if (quality.status === "STALE") return "stale";
  if (quality.status === "UNAVAILABLE") return "unavailable";
  if (quality.status === "CACHED") return "cached";
  return quality.couldAnalyse ? "available" : "unavailable";
}

function normalizeSettings(input = {}) {
  const requestedMarkets = Array.isArray(input.markets) && input.markets.length ? input.markets.map((market) => String(market).toUpperCase()) : FREEDOM_TRADER_V1_MARKETS;
  const ignoredMarkets = requestedMarkets.filter((market) => !FREEDOM_TRADER_V1_MARKETS.includes(market));
  return {
    ...DEFAULT_CONFIG,
    ...input,
    markets: FREEDOM_TRADER_V1_MARKETS,
    requestedMarkets,
    ignoredMarkets,
    marketScope: "US_ONLY",
    marketScopeMessage: FREEDOM_TRADER_V1_MARKET_SCOPE_MESSAGE,
    excludedIndustries: Array.isArray(input.excludedIndustries)
      ? input.excludedIndustries.map((item) => String(item).trim().toLowerCase()).filter(Boolean)
      : String(input.excludedIndustries || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean),
    chunkSize: Math.max(1, Math.min(80, Number(input.chunkSize) || 80)),
    top: Math.max(1, Math.min(5, Number(input.top) || 5)),
  };
}

export function supportedUniverseForMarkets(markets = ["US"]) {
  const rows = [];
  rows.push(...SUPPORTED_UNIVERSES.US_LIQUID);
  const seen = new Set();
  return rows.filter((row) => {
    if (seen.has(row.symbol)) return false;
    seen.add(row.symbol);
    return true;
  }).sort((a, b) => (a.priorityTier || 9) - (b.priorityTier || 9) || (a.priorityRank || 999) - (b.priorityRank || 999));
}

function scoreBreakdown({ currentPrice, indicators = {}, volume, setup = {}, dataStatus = {}, marketData = {} }) {
  const ma20 = Number(indicators.ma20);
  const ma50 = Number(indicators.ma50);
  const ma200 = Number(indicators.ma200);
  const rsi = Number(indicators.rsi14);
  const macdHistogram = Number(indicators.macdHistogram);
  const relativeVolume = Number(indicators.relativeVolume);
  const volatility = Number(indicators.volatility20);
  const riskReward = Number(setup.riskRewardRatio);
  const distanceFromSupport = Number(indicators.distanceFromSupport);
  const distanceFromResistance = Number(indicators.distanceFromResistance);
  const price = Number(currentPrice);

  const trendRaw = [price, ma20, ma50, ma200].every(Number.isFinite)
    ? (price > ma20 ? 30 : 8) + (price > ma50 ? 25 : 8) + (price > ma200 ? 25 : 8) + (ma20 > ma50 && ma50 > ma200 ? 20 : 5)
    : 0;
  const momentumRaw = Number.isFinite(rsi) && Number.isFinite(macdHistogram)
    ? clamp(55 + (macdHistogram > 0 ? 20 : -12) - Math.abs(rsi - 55) * 1.2)
    : 0;
  const volumeRaw = Number.isFinite(relativeVolume) && Number.isFinite(Number(volume))
    ? clamp(45 + relativeVolume * 28)
    : 0;
  const entryRaw = [distanceFromSupport, distanceFromResistance, volatility].every(Number.isFinite)
    ? clamp(78 - Math.max(0, distanceFromSupport - 3) * 9 + Math.max(0, distanceFromResistance) * 1.5 - Math.max(0, volatility - 7) * 6)
    : 0;
  const riskRaw = Number.isFinite(riskReward) ? clamp((riskReward / 3) * 100) : 0;
  const dataRaw = dataStatus.readyForScore && marketData?.validated !== false ? 100 : 0;

  return {
    trend: { label: "Trend", points: points(trendRaw, 25), max: 25 },
    momentum: { label: "Momentum", points: points(momentumRaw, 20), max: 20 },
    volumeAndLiquidity: { label: "Volume and liquidity", points: points(volumeRaw, 15), max: 15 },
    entryQuality: { label: "Entry quality", points: points(entryRaw, 20), max: 20 },
    riskReward: { label: "Risk/reward", points: points(riskRaw, 15), max: 15 },
    dataQuality: { label: "Data quality", points: points(dataRaw, 5), max: 5 },
  };
}

function mandatoryFailures({ ticker, exchange, currency, currentPrice, indicators = {}, volume, setup = {}, dataStatus = {}, marketData = {}, config }) {
  const failures = [];
  const latestTimestamp = dataStatus.latestTimestamp || marketData.latestCandleDate || marketData.quoteDate;
  const ageHours = hoursSince(latestTimestamp);
  if (!ticker) failures.push("unsupported symbol");
  if (!Number.isFinite(Number(currentPrice))) failures.push("current price is missing");
  if (!exchange || exchange === "--") failures.push("exchange is unknown");
  if (!currency || currency === "--") failures.push("currency is unknown");
  if (Number.isFinite(ageHours) && ageHours > config.staleDailyHours) failures.push("market data is stale beyond the accepted interval");
  if (dataStatus.apiError) failures.push(dataStatus.apiError);
  if (!dataStatus.readyForScore) failures.push(dataStatus.status || "insufficient candle history");
  if (Number(dataStatus.actualCandleCount) < 200) failures.push("insufficient candle history");
  if (marketData?.validated === false) failures.push(...(marketData.issues || ["conflicting provider data"]));
  if (!Number.isFinite(Number(volume)) || Number(volume) < config.minimumDailyVolume) failures.push("average daily volume below configured minimum");
  if (!Number.isFinite(Number(setup.stop))) failures.push("stop loss cannot be calculated");
  if (!Number.isFinite(Number(setup.target))) failures.push("target cannot be calculated");
  if (!Number.isFinite(Number(setup.riskRewardRatio)) || Number(setup.riskRewardRatio) < config.minimumRiskReward) failures.push("risk/reward below configured minimum");
  if (Number.isFinite(Number(setup.stop)) && Number.isFinite(Number(setup.plannedEntry)) && Number(setup.stop) >= Number(setup.plannedEntry)) failures.push("proposed stop is above or equal to the entry");
  if (Number.isFinite(Number(setup.target)) && Number.isFinite(Number(setup.plannedEntry)) && Number(setup.target) <= Number(setup.plannedEntry)) failures.push("proposed target is below or equal to the entry");
  if (Number.isFinite(Number(currentPrice)) && Number.isFinite(Number(setup.plannedEntry))) {
    const extension = ((Number(currentPrice) - Number(setup.plannedEntry)) / Number(setup.plannedEntry)) * 100;
    if (extension > config.maximumEntryExtensionPercent) failures.push("price is too far above the proposed entry zone");
  }
  if (!Number.isFinite(Number(indicators.volatility20)) || Number(indicators.volatility20) > config.maximumVolatility) failures.push("volatility outside configured limit");
  return Array.from(new Set(failures.filter(Boolean)));
}

function decision({ score, failedConditions, currentPrice, setup }) {
  if (failedConditions.length) {
    if (failedConditions.some((reason) => /entry zone|too far above/i.test(reason))) return "WAIT";
    if (failedConditions.some((reason) => /risk\/reward|volume|volatility|invalid/i.test(reason))) return "NO ACTION";
    if (failedConditions.some((reason) => /history|missing|unknown|provider|stale|conflicting/i.test(reason))) return "DATA UNAVAILABLE";
    return "DEVELOPING";
  }
  if (Number(currentPrice) > Number(setup.plannedEntry)) return "DEVELOPING";
  if (score >= 82) return "READY TO BUY";
  if (score >= 70) return "DEVELOPING";
  return "NO ACTION";
}

export function evaluateOpportunity(input = {}) {
  const config = { ...DEFAULT_CONFIG, ...(input.config || {}) };
  const breakdown = scoreBreakdown(input);
  const score = round(Object.values(breakdown).reduce((total, item) => total + (Number(item.points) || 0), 0), 0);
  const failedConditions = mandatoryFailures({ ...input, config });
  const overallStatus = decision({ score, failedConditions, currentPrice: input.currentPrice, setup: input.setup || {} });
  const entry = Number(input.setup?.plannedEntry);
  const stop = Number(input.setup?.stop);
  const target1 = Number(input.setup?.target);
  const riskPerShare = Number.isFinite(entry) && Number.isFinite(stop) ? round(entry - stop) : null;
  const rewardPerShare = Number.isFinite(target1) && Number.isFinite(entry) ? round(target1 - entry) : null;
  const reasonsFor = [];
  const reasonsAgainst = [];

  if (breakdown.trend.points >= 18) reasonsFor.push("Trend is favourable against key moving averages");
  else reasonsAgainst.push("Trend confirmation is incomplete");
  if (breakdown.momentum.points >= 14) reasonsFor.push("Momentum is supportive");
  else reasonsAgainst.push("Momentum is still weak or mixed");
  if (breakdown.volumeAndLiquidity.points >= 10) reasonsFor.push("Liquidity and relative volume are acceptable");
  else reasonsAgainst.push("Volume confirmation is missing or liquidity is too low");
  if (breakdown.entryQuality.points >= 14) reasonsFor.push("Price is near a valid entry area");
  else reasonsAgainst.push("Entry quality is not yet confirmed");
  if (breakdown.riskReward.points >= 10) reasonsFor.push("Risk/reward meets the configured minimum");
  else reasonsAgainst.push("Risk/reward is not acceptable yet");
  reasonsAgainst.push(...failedConditions);

  return {
    ticker: input.ticker,
    companyName: input.companyName,
    exchange: input.exchange,
    currency: input.currency,
    timeframe: input.timeframe || "1D",
    dataProvider: input.dataProvider || input.dataStatus?.provider || input.marketData?.historySource || "Unknown",
    dataStatus: input.dataStatus,
    priceTimestamp: input.dataStatus?.latestTimestamp || input.marketData?.latestCandleDate || null,
    currentPrice: round(input.currentPrice),
    overallStatus,
    score,
    confidence: failedConditions.length ? "Low" : score >= 90 ? "High" : score >= 82 ? "Medium" : "Low",
    confidenceScore: failedConditions.length ? Math.min(score, 60) : score,
    entryStatus: failedConditions.some((reason) => /entry/i.test(reason)) ? "Waiting" : overallStatus === "READY TO BUY" ? "Valid now" : "Not ready",
    proposedEntryLow: Number.isFinite(entry) ? round(entry * 0.995) : null,
    proposedEntryHigh: Number.isFinite(entry) ? round(entry * 1.005) : null,
    stopLoss: Number.isFinite(stop) ? round(stop) : null,
    target1: Number.isFinite(target1) ? round(target1) : null,
    target2: Number.isFinite(target1) && Number.isFinite(rewardPerShare) ? round(target1 + rewardPerShare) : null,
    riskPerShare,
    rewardPerShare,
    riskReward: round(input.setup?.riskRewardRatio),
    scoreBreakdown: breakdown,
    reasonsFor: Array.from(new Set(reasonsFor)),
    reasonsAgainst: Array.from(new Set(reasonsAgainst.filter(Boolean))),
    failedConditions,
    dataWarnings: Array.from(new Set([...(input.marketData?.warnings || []), ...(input.dataStatus?.apiError ? [input.dataStatus.apiError] : [])].filter(Boolean))),
    engineVersion: OPPORTUNITY_ENGINE_VERSION,
  };
}

export function validateMarketData(row = {}, universeItem = {}, { now = new Date(), staleDailyHours = DEFAULT_CONFIG.staleDailyHours } = {}) {
  if (universeItem?.enabled === false) {
    return { status: "UNSUPPORTED", couldAnalyse: false, reason: universeItem.disabledReason || "Unsupported exchange" };
  }
  if (row.unsupported || /unsupported/i.test(String(row.error || ""))) {
    return { status: "UNSUPPORTED", couldAnalyse: false, reason: row.error || "Unsupported symbol" };
  }
  if (row.status === "DATA UNAVAILABLE" || row.dataQuality === "unavailable" || row.dataStatus?.apiError || row.error) {
    const text = String(row.error || row.dataStatus?.apiError || row.dataStatus?.status || "Market data unavailable");
    if (/auth|api key|401/i.test(text)) return { status: "PERMISSION_DENIED", couldAnalyse: false, reason: "Market-data authentication failed" };
    if (/permission|access|plan|403/i.test(text)) return { status: "PERMISSION_DENIED", couldAnalyse: false, reason: text };
    if (/rate|limit|429/i.test(text)) return { status: "RATE_LIMITED", couldAnalyse: false, reason: text };
    return { status: "UNAVAILABLE", couldAnalyse: false, reason: text };
  }
  if (row.marketStatus === "suspended" || row.dataStatus?.marketStatus === "suspended") {
    return { status: "UNAVAILABLE", couldAnalyse: false, reason: "Suspended market" };
  }
  if (row.dataStatus?.permissionFailure || /permission|access|plan/i.test(String(row.dataStatus?.status || ""))) {
    return { status: "PERMISSION_DENIED", couldAnalyse: false, reason: row.dataStatus.status || "Market-data permission failure" };
  }
  if (row.dataStatus?.readyForScore === false || Number(row.dataStatus?.actualCandleCount) < 200 || Number(row.candleCount) < 200) {
    return { status: "UNAVAILABLE", couldAnalyse: false, reason: "Insufficient history" };
  }
  if (!Array.isArray(row.source?.candles) && row.missingCandles) {
    return { status: "UNAVAILABLE", couldAnalyse: false, reason: "Missing candles" };
  }
  if (!Number.isFinite(Number(row.volume ?? row.indicators?.averageVolume20))) {
    return { status: "UNAVAILABLE", couldAnalyse: false, reason: "Missing volume" };
  }
  const timestamp = row.priceTimestamp || row.marketDataTimestamp || row.dataStatus?.latestTimestamp || row.opportunity?.priceTimestamp;
  const age = dataAgeHours(timestamp, now);
  if (Number.isFinite(age) && age > staleDailyHours) {
    return { status: "STALE", couldAnalyse: false, reason: "Stale data" };
  }
  if (row.dataQuality === "daily-only" || row.dataStatus?.delayed) {
    return { status: "DELAYED", couldAnalyse: true, reason: "Delayed market data" };
  }
  if (row.dataQuality === "cached" || row.dataStatus?.cacheStatus === "hit") {
    return { status: "CACHED", couldAnalyse: true, reason: "Cached market data" };
  }
  return { status: "READY", couldAnalyse: true, reason: null };
}

function tradeValues(row = {}) {
  return {
    entry: cleanNumber(row.opportunity?.proposedEntryLow ?? row.recommendedEntry ?? row.setup?.plannedEntry),
    entryHigh: cleanNumber(row.opportunity?.proposedEntryHigh ?? row.entryZoneHigh ?? row.setup?.plannedEntry),
    safetyExit: cleanNumber(row.opportunity?.stopLoss ?? row.stopLoss ?? row.setup?.stop),
    takeSomeProfit: cleanNumber(row.opportunity?.target1 ?? row.target ?? row.setup?.target),
    finalExit: cleanNumber(row.opportunity?.target2 ?? row.target2),
    currentPrice: cleanNumber(row.currentPrice ?? row.opportunity?.currentPrice),
    riskReward: cleanNumber(row.opportunity?.riskReward ?? row.riskReward ?? row.setup?.riskRewardRatio),
  };
}

function unavailableSnapshot(symbol, error) {
  return {
    symbol,
    exchange: null,
    currency: String(symbol || "").endsWith(".AX") ? "AUD" : "USD",
    quote: { price: null, previousClose: null, change: null, changePercent: null, timestamp: null, delayed: true },
    candles: { daily: [], intraday: null },
    averageVolume: null,
    source: "Market data provider",
    fetchedAt: new Date().toISOString(),
    dataQuality: "unavailable",
    candleCount: 0,
    error: error instanceof Error ? error.message : String(error || "Market data provider failed"),
  };
}

export function calculateOpportunityQuantity({ entry, safetyExit, settings = {}, currencyRate = 1 } = {}) {
  const cleanSettings = { ...DEFAULT_CONFIG, ...settings };
  const riskPerShare = cleanNumber(entry) - cleanNumber(safetyExit);
  if (!Number.isFinite(riskPerShare) || riskPerShare <= 0) {
    return { quantity: 0, maximumLoss: null, riskPerShare: null, reason: "Safety Exit is not below the entry" };
  }
  const maxByRisk = Math.floor((cleanNumber(cleanSettings.maximumPlannedLossPerTrade) || 0) / riskPerShare);
  const maxByCash = Math.floor((cleanNumber(cleanSettings.maximumPositionValue) || cleanSettings.availableCash || 0) / (cleanNumber(entry) * currencyRate));
  const quantity = Math.max(0, Math.min(maxByRisk, maxByCash));
  return {
    quantity,
    riskPerShare: round(riskPerShare),
    maximumLoss: quantity > 0 ? round(quantity * riskPerShare * currencyRate) : null,
    reason: quantity > 0 ? null : "Suggested quantity is below one share",
  };
}

function actionReason(action, row, quality, values) {
  if (action === "READY TO BUY") {
    return "The price has returned to the preferred buying range. The possible reward is more than twice the planned loss. Trend remains positive.";
  }
  if (action === "DEVELOPING") {
    return values.currentPrice > values.entry
      ? "The setup is developing, but the current price is still above the preferred buying range."
      : "The setup is improving but has not met every rule required for a new order.";
  }
  if (action === "WAIT") return "The company is worth watching, but the entry or risk rules are not safe enough today.";
  if (action === "DATA UNAVAILABLE") return quality.reason || "Freedom could not analyse this symbol with trustworthy market data.";
  return row.opportunity?.failedConditions?.[0] || "No valid trade setup is present today.";
}

export function buildOpportunityDecision(row = {}, { settings = {}, universeItem = {}, now = new Date() } = {}) {
  const cleanSettings = { ...DEFAULT_CONFIG, ...settings };
  const quality = validateMarketData(row, universeItem, { now, staleDailyHours: cleanSettings.staleDailyHours });
  const values = tradeValues(row);
  const opportunity = row.opportunity || {};
  let action = "DATA UNAVAILABLE";
  const analysed = Boolean(quality.couldAnalyse);

  if (analysed) {
    const failed = Array.isArray(opportunity.failedConditions) ? opportunity.failedConditions : [];
    const score = cleanNumber(opportunity.score ?? row.tradingScore) || 0;
    const trendQuality = cleanNumber(row.indicators?.distanceFromResistance) ?? 0;
    if (!failed.length && score >= cleanSettings.minimumScore && values.currentPrice <= values.entry && values.riskReward >= cleanSettings.minimumRiskReward) {
      action = "READY TO BUY";
    } else if (score >= 70 && values.riskReward >= cleanSettings.minimumRiskReward && Number.isFinite(values.entry)) {
      action = "DEVELOPING";
    } else if (score >= 60 || trendQuality > 0) {
      action = "WAIT";
    } else {
      action = "NO ACTION";
    }
  }

  const sizing = calculateOpportunityQuantity({ entry: values.entry, safetyExit: values.safetyExit, settings: cleanSettings, currencyRate: 1 });
  if (action === "READY TO BUY" && sizing.quantity < 1) action = "WAIT";
  const reward = Number.isFinite(values.takeSomeProfit) && Number.isFinite(values.entry) ? round(values.takeSomeProfit - values.entry) : null;
  const risk = Number.isFinite(values.entry) && Number.isFinite(values.safetyExit) ? round(values.entry - values.safetyExit) : null;
  const reason = actionReason(action, row, quality, values);
  const quoteStatus = quoteStatusFromRow(row, quality);
  const historyStatus = historyStatusFromRow(row, quality);
  const score = analysed ? cleanNumber(opportunity.score ?? row.tradingScore) : null;
  const confidence = analysed ? cleanNumber(opportunity.confidenceScore ?? row.confidence ?? opportunity.score ?? row.tradingScore) : null;
  const qualified = analysed ? action === "READY TO BUY" : null;

  return {
    symbol: row.symbol || row.ticker || universeItem.symbol,
    company: row.companyName || universeItem.companyName || row.symbol || universeItem.symbol,
    companyName: row.companyName || universeItem.companyName || row.symbol || universeItem.symbol,
    exchange: row.exchange || universeItem.exchange,
    currency: row.currency || opportunity.currency || (String(row.symbol || universeItem.symbol || "").endsWith(".AX") ? "AUD" : "USD"),
    sector: row.sector || universeItem.sector,
    status: action,
    action,
    dataQualityStatus: quality.status,
    dataQuality: quality.status.toLowerCase(),
    quoteStatus,
    historyStatus,
    analysed,
    qualified,
    couldAnalyse: analysed,
    couldNotAnalyseReason: analysed ? null : quality.reason,
    currentPrice: analysed ? values.currentPrice : null,
    priceTimestamp: analysed ? row.priceTimestamp || row.dataStatus?.latestTimestamp || opportunity.priceTimestamp || null : null,
    marketDataTimestamp: analysed ? row.priceTimestamp || row.dataStatus?.latestTimestamp || opportunity.priceTimestamp || null : null,
    provider: row.dataStatus?.provider || row.marketData?.historySource || opportunity.dataProvider || "Twelve Data",
    entry: analysed ? values.entry : null,
    recommendedEntry: analysed ? values.entry : null,
    entryZoneHigh: analysed ? values.entryHigh : null,
    safetyExit: analysed ? values.safetyExit : null,
    stopLoss: analysed ? values.safetyExit : null,
    takeSomeProfit: analysed ? values.takeSomeProfit : null,
    target: analysed ? values.takeSomeProfit : null,
    finalExit: analysed ? values.finalExit : null,
    target2: analysed ? values.finalExit : null,
    risk: analysed ? risk : null,
    reward: analysed ? reward : null,
    riskReward: analysed ? values.riskReward : null,
    rewardToRisk: analysed ? values.riskReward : null,
    suggestedQuantity: action === "READY TO BUY" ? sizing.quantity : 0,
    maximumLoss: action === "READY TO BUY" ? sizing.maximumLoss : null,
    maximumPlannedLoss: action === "READY TO BUY" ? sizing.maximumLoss : null,
    score,
    confidence,
    tradingScore: score,
    reason,
    errorCode: analysed ? null : row.errorCode || row.dataStatus?.errorCode || quality.status.toLowerCase(),
    errorMessage: analysed ? null : quality.reason,
    plainEnglish: `${row.companyName || universeItem.companyName || row.symbol || universeItem.symbol}\n\n${action}\n\n${action === "READY TO BUY" ? `Buy only if price reaches ${values.entry}.\nSafety Exit ${values.safetyExit}.\nTake Some Profit ${values.takeSomeProfit}.\nFinal Exit ${values.finalExit}.\nSuggested quantity ${sizing.quantity}.\nMaximum planned loss ${sizing.maximumLoss}.\nReason: ${reason}` : reason}`,
    tradePlan: action === "READY TO BUY" ? {
      entry: values.entry,
      safetyExit: values.safetyExit,
      takeSomeProfit: values.takeSomeProfit,
      finalExit: values.finalExit,
      risk,
      reward,
      riskReward: values.riskReward,
      suggestedQuantity: sizing.quantity,
      maximumLoss: sizing.maximumLoss,
      confidence: cleanNumber(opportunity.confidenceScore ?? row.confidence ?? opportunity.score ?? row.tradingScore),
      reason,
    } : null,
    opportunity,
    source: row,
  };
}

export function rankOpportunityDecisions(decisions = [], top = 5) {
  const rankable = decisions.filter((item) => item.couldAnalyse && item.dataQualityStatus !== "STALE");
  const weight = (item) => {
    const statusWeight = item.status === "READY TO BUY" ? 1000 : item.status === "DEVELOPING" ? 500 : item.status === "WAIT" ? 200 : 0;
    const confidence = cleanNumber(item.confidence) || 0;
    const riskReward = cleanNumber(item.riskReward) || 0;
    const liquidity = cleanNumber(item.source?.volume ?? item.source?.indicators?.averageVolume20) || 0;
    const data = item.dataQualityStatus === "READY" ? 50 : item.dataQualityStatus === "DELAYED" ? 25 : 0;
    const trend = cleanNumber(item.source?.scoreExplanation?.trend?.points ?? item.source?.opportunity?.scoreBreakdown?.trend?.points) || 0;
    return statusWeight + confidence * 4 + riskReward * 35 + Math.log10(Math.max(liquidity, 1)) * 12 + trend * 5 + data;
  };
  return rankable
    .map((item) => ({ ...item, rankingScore: round(weight(item), 2) }))
    .sort((a, b) => b.rankingScore - a.rankingScore)
    .slice(0, top);
}

function bucketSummary(decisions = [], disabledRows = []) {
  const counts = Object.fromEntries(OPPORTUNITY_ACTIONS.map((status) => [status, 0]));
  decisions.forEach((item) => {
    counts[item.status] = (counts[item.status] || 0) + 1;
  });
  const couldNotAnalyse = decisions.filter((item) => !item.couldAnalyse).length + disabledRows.length;
  const failedRewardRisk = decisions.filter((item) => /reward|risk/i.test(item.reason || item.opportunity?.failedConditions?.join(" ") || "")).length;
  const developing = counts.DEVELOPING || 0;
  const noReady = !counts["READY TO BUY"];
  return {
    counts,
    couldNotAnalyse,
    failedRewardRisk,
    plainEnglish: noReady
      ? `No trade currently meets your rules. Reasons: ${developing} companies are still developing. ${couldNotAnalyse} companies did not have sufficient data. ${failedRewardRisk} companies failed the reward/risk requirement.`
      : null,
  };
}

export async function runOpportunityEngine({
  settings = {},
  offset = 0,
  analyser,
  marketSnapshotBatch,
  now = new Date(),
} = {}) {
  if (typeof analyser !== "function") throw new Error("Opportunity Engine requires an analyser function.");
  const cleanSettings = normalizeSettings(settings);
  const requested = supportedUniverseForMarkets(cleanSettings.markets).filter((item) => {
    const sector = String(item.sector || "").toLowerCase();
    return !cleanSettings.excludedIndustries.some((industry) => sector.includes(industry));
  });
  const enabled = requested.filter((item) => item.enabled !== false);
  const disabled = requested.filter((item) => item.enabled === false);
  const chunk = enabled.slice(offset, offset + cleanSettings.chunkSize);
  const nextOffset = offset + cleanSettings.chunkSize >= enabled.length ? 0 : offset + cleanSettings.chunkSize;
  const startedAt = now.toISOString();
  let snapshots = new Map();
  if (typeof marketSnapshotBatch === "function") {
    try {
      snapshots = await marketSnapshotBatch(chunk.map((item) => item.symbol), { range: "1y", interval: "1day" });
    } catch (error) {
      snapshots = new Map(chunk.map((item) => [item.symbol, unavailableSnapshot(item.symbol, error)]));
    }
  }

  const analysedRows = [];
  for (const item of chunk) {
    try {
      analysedRows.push(await analyser(item.symbol, snapshots.get?.(item.symbol)));
    } catch (error) {
      analysedRows.push({
        symbol: item.symbol,
        companyName: item.companyName,
        exchange: item.exchange,
        status: "DATA UNAVAILABLE",
        dataQuality: "unavailable",
        error: error instanceof Error ? error.message : "Could not analyse",
        dataStatus: { readyForScore: false, status: "Could not analyse" },
      });
    }
  }

  const decisions = analysedRows.map((row) => {
    const universeItem = requested.find((item) => item.symbol === row.symbol) || {};
    return buildOpportunityDecision(row, { settings: cleanSettings, universeItem, now });
  });
  const disabledDecisions = disabled.map((item) => buildOpportunityDecision({
    symbol: item.symbol,
    companyName: item.companyName,
    exchange: item.exchange,
    status: "DATA UNAVAILABLE",
    dataQuality: "unavailable",
    error: item.disabledReason,
  }, { settings: cleanSettings, universeItem: item, now }));
  const allDecisions = [...decisions, ...disabledDecisions];
  const topResults = rankOpportunityDecisions(decisions, cleanSettings.top);
  const summary = bucketSummary(allDecisions, []);
  return {
    ok: true,
    engineVersion: OPPORTUNITY_ENGINE_VERSION,
    settings: cleanSettings,
    scanStartedAt: startedAt,
    scanCompletedAt: new Date().toISOString(),
    requestedSymbols: requested.map((item) => item.symbol),
    scannedSymbols: chunk.map((item) => item.symbol),
    supportedSymbols: enabled.map((item) => item.symbol),
    disabledSymbols: disabled.map((item) => ({ symbol: item.symbol, companyName: item.companyName, reason: item.disabledReason })),
    decisions: allDecisions,
    results: topResults,
    topOpportunity: topResults[0] || null,
    summary,
    nextOffset,
  };
}
