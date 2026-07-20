import { analyseSymbol } from "./analysis.js";
import { createSupabaseAdmin } from "../../../lib/supabaseAdmin.js";

const FALLBACK_UNIVERSE = [
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
  ["BHP.AX", "BHP Group", "Materials", "ASX"], ["CBA.AX", "Commonwealth Bank", "Financials", "ASX"], ["CSL.AX", "CSL", "Healthcare", "ASX"],
  ["NAB.AX", "National Australia Bank", "Financials", "ASX"], ["WBC.AX", "Westpac", "Financials", "ASX"], ["ANZ.AX", "ANZ Group", "Financials", "ASX"],
  ["WES.AX", "Wesfarmers", "Retail", "ASX"], ["WOW.AX", "Woolworths", "Consumer Defensive", "ASX"], ["MQG.AX", "Macquarie Group", "Financials", "ASX"],
].map(([symbol, companyName, sector, market]) => ({ symbol, companyName, sector, market }));

const DEFAULT_SETTINGS = {
  markets: ["US"],
  minimumScore: 82,
  minimumDailyVolume: 1000000,
  minimumRiskReward: 2,
  maximumVolatility: 9,
  excludedIndustries: [],
  scanFrequency: "during-session",
  chunkSize: 30,
};

const SCANNER_MAX_TWELVE_DATA_CREDITS_PER_MINUTE = 6;
const scannerCache = globalThis.__freedomTraderScannerCache || new Map();
const scannerMinuteWindow = globalThis.__freedomTraderScannerMinuteWindow || { minute: "", credits: 0 };
globalThis.__freedomTraderScannerCache = scannerCache;
globalThis.__freedomTraderScannerMinuteWindow = scannerMinuteWindow;

function minuteKey() {
  return new Date().toISOString().slice(0, 16);
}

function resetScannerMinuteIfNeeded() {
  const minute = minuteKey();
  if (scannerMinuteWindow.minute !== minute) {
    scannerMinuteWindow.minute = minute;
    scannerMinuteWindow.credits = 0;
  }
}

function scannerCacheKey(symbol) {
  return `${symbol}:1y:1d`;
}

function cachedScannerResult(symbol) {
  const cached = scannerCache.get(scannerCacheKey(symbol));
  if (!cached || Date.now() - cached.cachedAt > 10 * 60 * 1000) return null;
  return {
    ...cached.row,
    dataStatus: {
      ...(cached.row.dataStatus || {}),
      cacheStatus: "scanner-cache-hit",
    },
  };
}

function waitingRow(item, reason = "Waiting for scanner") {
  return {
    symbol: item.symbol,
    companyName: item.companyName,
    exchange: item.market,
    sector: item.sector,
    currentPrice: null,
    changePercent: null,
    volume: null,
    indicators: {},
    tradingScore: null,
    trend: reason,
    status: "INFO",
    confidence: null,
    scoreExplanation: {},
    setup: { valid: false, setupReasoning: reason },
    dataStatus: {
      provider: "Twelve Data",
      requestedRange: "1y",
      requestedInterval: "1d",
      actualCandleCount: 0,
      firstTimestamp: null,
      latestTimestamp: null,
      cacheStatus: "queued",
      apiError: null,
      status: reason,
      readyForScore: false,
    },
    error: reason,
  };
}

function cleanSettings(input = {}) {
  const markets = Array.isArray(input.markets) && input.markets.length ? input.markets : DEFAULT_SETTINGS.markets;
  return {
    markets,
    minimumScore: Number(input.minimumScore) || DEFAULT_SETTINGS.minimumScore,
    minimumDailyVolume: Number(input.minimumDailyVolume) || DEFAULT_SETTINGS.minimumDailyVolume,
    minimumRiskReward: Number(input.minimumRiskReward) || DEFAULT_SETTINGS.minimumRiskReward,
    maximumVolatility: Number(input.maximumVolatility) || DEFAULT_SETTINGS.maximumVolatility,
    excludedIndustries: Array.isArray(input.excludedIndustries)
      ? input.excludedIndustries.map((item) => String(item).trim().toLowerCase()).filter(Boolean)
      : String(input.excludedIndustries || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean),
    scanFrequency: input.scanFrequency || DEFAULT_SETTINGS.scanFrequency,
    chunkSize: Math.max(5, Math.min(80, Number(input.chunkSize) || DEFAULT_SETTINGS.chunkSize)),
  };
}

async function fetchFinnhubSymbols(settings) {
  const apiKey = process.env.FINNHUB_API_KEY?.trim();
  if (!apiKey || !settings.markets.includes("US")) return [];
  try {
    const response = await fetch(`https://finnhub.io/api/v1/stock/symbol?exchange=US&token=${encodeURIComponent(apiKey)}`);
    const data = await response.json().catch(() => []);
    if (!response.ok || !Array.isArray(data)) return [];
    return data
      .filter((item) => /common stock/i.test(String(item.type || "")))
      .filter((item) => /^[A-Z]{1,5}$/.test(String(item.symbol || "")))
      .map((item) => ({ symbol: item.symbol, companyName: item.description || item.symbol, sector: "US Listed", market: "US" }));
  } catch {
    return [];
  }
}

async function getUniverse(settings) {
  const dynamic = await fetchFinnhubSymbols(settings);
  const fallback = FALLBACK_UNIVERSE.filter((item) => settings.markets.includes(item.market === "ASX" ? "ASX" : "US"));
  const rows = [...dynamic, ...fallback];
  const seen = new Set();
  return rows.filter((item) => {
    if (seen.has(item.symbol)) return false;
    seen.add(item.symbol);
    if (!settings.markets.includes(item.market === "ASX" ? "ASX" : "US")) return false;
    const sector = String(item.sector || "").toLowerCase();
    return !settings.excludedIndustries.some((industry) => sector.includes(industry));
  });
}

function setupType(row) {
  const reasoning = String(row.setup?.setupReasoning || "").toLowerCase();
  if (reasoning.includes("breakout")) return "Breakout";
  if (reasoning.includes("pullback")) return "Pullback";
  return "Developing";
}

function displayStatus(row) {
  if (!Number.isFinite(row.tradingScore) || row.tradingScore < 70) return "No Trade";
  if (!Number.isFinite(row.setup?.riskRewardRatio) || row.setup.riskRewardRatio < 2) return "Watch";
  if (row.tradingScore >= 82 && Number.isFinite(row.currentPrice) && Number.isFinite(row.setup?.plannedEntry)) {
    return row.currentPrice <= row.setup.plannedEntry ? "Buy Now" : "Wait for Entry";
  }
  return row.tradingScore >= 70 ? "Watch" : "No Trade";
}

function detectionReason(row) {
  if (!row.dataStatus?.readyForScore) return row.dataStatus?.status || row.error || "Waiting for scanner";
  return `${setupType(row)} detected with score ${row.tradingScore}, relative volume ${row.indicators?.relativeVolume ?? "--"}x and risk/reward ${row.setup?.riskRewardRatio ?? "--"}.`;
}

function passesFilters(row, settings) {
  return row.dataStatus?.readyForScore &&
    Number(row.tradingScore) >= settings.minimumScore &&
    Number(row.volume) >= settings.minimumDailyVolume &&
    Number(row.setup?.riskRewardRatio) >= settings.minimumRiskReward &&
    Number(row.indicators?.volatility20) <= settings.maximumVolatility &&
    ["Buy Now", "Wait for Entry"].includes(displayStatus(row));
}

async function createApprovedAlert(result) {
  try {
    const supabase = createSupabaseAdmin();
    const { data: existing } = await supabase
      .from("freedom_trader_alerts")
      .select("id")
      .eq("symbol", result.symbol)
      .eq("alert_type", "SCANNER ENTRY")
      .eq("trigger_price", result.recommendedEntry)
      .eq("status", "active")
      .maybeSingle();
    if (existing?.id) return;
    await supabase.from("freedom_trader_alerts").insert({
      symbol: result.symbol,
      alert_type: "SCANNER ENTRY",
      trigger_price: result.recommendedEntry,
      direction: "below",
      priority: "high",
      status: "active",
      message: `Market scanner found ${result.symbol}: ${result.reason} Alert only; no trade is placed automatically.`,
    });
  } catch (error) {
    console.error("Scanner alert creation skipped:", error);
  }
}

export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  const settings = cleanSettings(req.method === "POST" ? req.body : req.query);
  const universe = await getUniverse(settings);
  const offset = Math.max(0, Number(req.query.offset ?? req.body?.offset) || 0);
  const chunk = universe.slice(offset, offset + settings.chunkSize);
  const nextOffset = offset + settings.chunkSize >= universe.length ? 0 : offset + settings.chunkSize;
  resetScannerMinuteIfNeeded();
  const analysed = [];
  for (const item of chunk) {
    const cached = cachedScannerResult(item.symbol);
    if (cached) {
      analysed.push(cached);
      continue;
    }
    if (scannerMinuteWindow.credits >= SCANNER_MAX_TWELVE_DATA_CREDITS_PER_MINUTE) {
      analysed.push(waitingRow(item, "Twelve Data minute limit reached"));
      continue;
    }
    scannerMinuteWindow.credits += 1;
    try {
      const row = await analyseSymbol(item.symbol);
      scannerCache.set(scannerCacheKey(item.symbol), { cachedAt: Date.now(), row });
      analysed.push(row);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Scanner analysis failed";
      const row = waitingRow(item, reason);
      scannerCache.set(scannerCacheKey(item.symbol), { cachedAt: Date.now(), row });
      analysed.push(row);
    }
  }
  const results = analysed
    .filter((row) => passesFilters(row, settings))
    .map((row) => ({
      symbol: row.symbol,
      companyName: row.companyName,
      currentPrice: row.currentPrice,
      tradingScore: row.tradingScore,
      setupType: setupType(row),
      recommendedEntry: row.setup?.plannedEntry,
      target: row.setup?.target,
      stopLoss: row.setup?.stop,
      riskReward: row.setup?.riskRewardRatio,
      confidence: row.confidence,
      status: displayStatus(row),
      reason: detectionReason(row),
      dataStatus: row.dataStatus,
      fibonacci: row.fibonacci,
      source: row,
    }))
    .sort((a, b) => b.tradingScore - a.tradingScore || b.riskReward - a.riskReward);

  await Promise.all(results.slice(0, 10).map(createApprovedAlert));

  return res.status(200).json({
    ok: true,
    settings,
    universeCount: universe.length,
    scannedCount: chunk.length,
    nextOffset,
    results,
    scannerStatus: analysed.map((row) => ({
      symbol: row.symbol,
      companyName: row.companyName,
      tradingScore: row.tradingScore,
      status: row.status,
      dataStatus: row.dataStatus,
      error: row.error,
    })),
    twelveDataCreditsUsedThisMinute: scannerMinuteWindow.credits,
    updatedAt: new Date().toISOString(),
    schedule: ["before market open", "during trading session", "after market close"],
    error: null,
  });
}
