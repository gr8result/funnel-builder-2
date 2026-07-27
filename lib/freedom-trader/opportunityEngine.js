const DEFAULT_CONFIG = {
  minimumScore: 82,
  minimumDailyVolume: 1000000,
  minimumRiskReward: 2,
  maximumVolatility: 9,
  maximumEntryExtensionPercent: 3,
  staleDailyHours: 96,
};

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
  ].map(([symbol, companyName, sector, market]) => ({
    symbol, companyName, sector, market,
    exchange: "NASDAQ/NYSE",
    universe: "Supported liquid US shares",
    enabled: true,
    minimumLiquidity: 1000000,
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

export const OPPORTUNITY_ENGINE_VERSION = "freedom-opportunity-engine-v1";

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

export function supportedUniverseForMarkets(markets = ["US"]) {
  const rows = [];
  if (markets.includes("US")) rows.push(...SUPPORTED_UNIVERSES.US_LIQUID);
  if (markets.includes("ASX")) rows.push(...SUPPORTED_UNIVERSES.ASX_SUPPORTED);
  const seen = new Set();
  return rows.filter((row) => {
    if (seen.has(row.symbol)) return false;
    seen.add(row.symbol);
    return true;
  });
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
    if (failedConditions.some((reason) => /entry zone|too far above/i.test(reason))) return "WAIT FOR ENTRY";
    if (failedConditions.some((reason) => /risk\/reward|volume|volatility|history|missing|unknown|provider|stale|invalid|conflicting/i.test(reason))) return "AVOID";
    return "WATCH";
  }
  if (Number(currentPrice) > Number(setup.plannedEntry)) return "WAIT FOR ENTRY";
  if (score >= 90) return "STRONG BUY";
  if (score >= 82) return "BUY";
  if (score >= 70) return "WATCH";
  return "AVOID";
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
    entryStatus: failedConditions.some((reason) => /entry/i.test(reason)) ? "Waiting" : ["BUY", "STRONG BUY"].includes(overallStatus) ? "Valid now" : "Not ready",
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
