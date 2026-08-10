import { fetchTwelveDataApiUsage, fetchTwelveDataQuoteBatch, fetchTwelveDataStocks } from "./twelveData.js";

const REFERENCE_TTL_MS = Math.max(60 * 60 * 1000, Number(process.env.FREEDOM_UNIVERSE_CACHE_TTL_MS) || 24 * 60 * 60 * 1000);

const referenceCache = globalThis.__freedomMarketUniverseReferenceCache || { fetchedAt: 0, rows: [], error: null };
globalThis.__freedomMarketUniverseReferenceCache = referenceCache;

function broadQuoteLimit() {
  return Math.max(1, Number(process.env.FREEDOM_BROAD_SCREEN_LIMIT) || 64);
}

function detailedAnalysisLimit() {
  return Math.max(1, Number(process.env.FREEDOM_DETAILED_ANALYSIS_LIMIT) || 32);
}

function broadQuoteBatchSize() {
  return Math.max(1, Math.min(8, Number(process.env.FREEDOM_BROAD_QUOTE_BATCH_SIZE) || 8));
}

function normalizeSymbol(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeText(value) {
  return String(value || "").trim();
}

function marketFromRow(row) {
  const country = normalizeText(row.country).toLowerCase();
  const currency = normalizeText(row.currency).toUpperCase();
  const exchange = normalizeText(row.exchange).toUpperCase();
  if ((country === "united states" || country === "us") && currency === "USD" && ["NASDAQ", "NYSE", "AMEX"].includes(exchange)) return "US";
  if ((country === "australia" || country === "au") && currency === "AUD" && exchange === "ASX") return "ASX";
  return null;
}

function isOrdinaryShare(row) {
  return normalizeText(row.type).toLowerCase() === "common stock";
}

function mapReferenceRow(row) {
  const market = marketFromRow(row);
  return {
    symbol: normalizeSymbol(row.symbol),
    companyName: normalizeText(row.name),
    exchange: normalizeText(row.exchange).toUpperCase(),
    country: normalizeText(row.country),
    currency: normalizeText(row.currency).toUpperCase(),
    assetType: normalizeText(row.type),
    type: normalizeText(row.type),
    micCode: normalizeText(row.mic_code),
    market,
    active: true,
    tradable: Boolean(market && isOrdinaryShare(row)),
  };
}

function dedupe(rows) {
  const output = new Map();
  rows.forEach((row) => {
    if (!row.symbol || !row.market) return;
    const key = `${row.market}:${row.symbol}`;
    if (!output.has(key)) output.set(key, row);
  });
  return Array.from(output.values());
}

async function loadReferenceRows() {
  if (referenceCache.rows.length && Date.now() - referenceCache.fetchedAt < REFERENCE_TTL_MS) {
    return { ok: true, rows: referenceCache.rows, cacheHit: true, fetchedAt: referenceCache.fetchedAt, error: referenceCache.error };
  }
  const result = await fetchTwelveDataStocks();
  if (!result.ok) {
    referenceCache.error = result.error || "Twelve Data reference universe unavailable.";
    return { ok: false, rows: referenceCache.rows, cacheHit: Boolean(referenceCache.rows.length), fetchedAt: referenceCache.fetchedAt, error: referenceCache.error };
  }
  referenceCache.rows = dedupe(result.symbols.map(mapReferenceRow).filter((row) => row.market && isOrdinaryShare(row)));
  referenceCache.fetchedAt = Date.now();
  referenceCache.error = null;
  return { ok: true, rows: referenceCache.rows, cacheHit: false, fetchedAt: referenceCache.fetchedAt, error: null };
}

function excludedBySettings(row, settings) {
  const exclusions = Array.isArray(settings.excludedIndustries)
    ? settings.excludedIndustries
    : String(settings.excludedIndustries || "").split(",");
  const terms = exclusions.map((item) => String(item).trim().toLowerCase()).filter(Boolean);
  if (!terms.length) return false;
  const haystack = `${row.companyName} ${row.assetType}`.toLowerCase();
  return terms.some((term) => haystack.includes(term));
}

function marketCoverage(rows, usage, settings) {
  const usSupported = rows.filter((row) => row.market === "US");
  const asxSupported = rows.filter((row) => row.market === "ASX");
  const usEligible = usSupported.filter((row) => row.tradable && !excludedBySettings(row, settings));
  const asxEligible = asxSupported.filter((row) => row.tradable && !excludedBySettings(row, settings));
  const plan = String(usage?.plan_category || "").toLowerCase();
  const asxUnavailable = plan === "basic"
    ? "Twelve Data Basic returned an entitlement error for CBA:ASX history: ASX symbols require Pro or Venture."
    : null;
  return {
    US: {
      totalSupported: usSupported.length,
      eligibleForScreening: usEligible.length,
      broadScreened: 0,
      detailedAnalyses: 0,
      successfullyScreened: 0,
      unavailableReason: null,
    },
    ASX: {
      totalSupported: asxSupported.length,
      eligibleForScreening: asxUnavailable ? 0 : asxEligible.length,
      broadScreened: 0,
      detailedAnalyses: 0,
      successfullyScreened: 0,
      unavailableReason: asxUnavailable,
    },
  };
}

function candidateUniverse(rows, settings, coverage) {
  const markets = Array.isArray(settings.markets) && settings.markets.length ? settings.markets : ["US"];
  return rows.filter((row) => {
    if (!markets.includes(row.market)) return false;
    if (row.market === "ASX" && coverage.ASX.unavailableReason) return false;
    return row.tradable && !excludedBySettings(row, settings);
  });
}

function broadScore(row, quote) {
  const price = Number(quote?.price);
  const volume = Number(quote?.volume);
  const move = Math.abs(Number(quote?.percentChange) || 0);
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(volume)) return null;
  return {
    ...row,
    currentPrice: price,
    volume,
    changePercent: Number(quote.percentChange) || 0,
    quoteTimestamp: quote.timestamp || null,
    broadScore: Math.round(Math.min(100, Math.log10(Math.max(volume, 1)) * 10 + Math.min(move, 12) * 2 + Math.min(price, 250) / 25)),
  };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function msUntilNextMinute() {
  const now = new Date();
  return 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 250;
}

async function broadQuoteScreen(candidates, settings, usage) {
  const minimumVolume = Number(settings.minimumDailyVolume) || 1_000_000;
  const creditsPerMinute = Math.max(1, Number(usage?.plan_limit) || 8);
  const quoteLimit = Math.min(broadQuoteLimit(), candidates.length);
  const pool = candidates.slice(0, quoteLimit);
  const screened = [];
  let providerCalls = 0;
  let minuteCredits = 0;
  let minuteKey = new Date().toISOString().slice(0, 16);
  let providerWaitMs = 0;
  let providerWaits = 0;
  const batchSize = Math.min(broadQuoteBatchSize(), creditsPerMinute);
  for (let offset = 0; offset < pool.length; offset += batchSize) {
    const batch = pool.slice(offset, offset + batchSize);
    const currentMinute = new Date().toISOString().slice(0, 16);
    if (currentMinute !== minuteKey) {
      minuteKey = currentMinute;
      minuteCredits = 0;
    }
    if (minuteCredits + batch.length > creditsPerMinute) {
      const waitMs = msUntilNextMinute();
      providerWaits += 1;
      providerWaitMs += waitMs;
      await wait(waitMs);
      minuteKey = new Date().toISOString().slice(0, 16);
      minuteCredits = 0;
    }
    minuteCredits += batch.length;
    providerCalls += 1;
    const quotes = await fetchTwelveDataQuoteBatch({ symbols: batch.map((row) => row.symbol) });
    batch.forEach((row) => {
      const scored = broadScore(row, quotes.get(row.symbol));
      if (scored && scored.volume >= minimumVolume) screened.push(scored);
    });
  }
  screened.sort((a, b) => (b.broadScore - a.broadScore) || (b.volume - a.volume) || a.symbol.localeCompare(b.symbol));
  return {
    providerCalls,
    providerWaits,
    providerWaitMs,
    quoteLimit,
    screenedCount: pool.length,
    eligible: screened,
  };
}

export async function buildMarketDiscovery(settings = {}) {
  const [usage, reference] = await Promise.all([
    fetchTwelveDataApiUsage().catch((error) => ({ ok: false, error: error.message })),
    loadReferenceRows(),
  ]);
  const rows = reference.rows || [];
  const coverage = marketCoverage(rows, usage, settings);
  const candidates = candidateUniverse(rows, settings, coverage);
  const broad = await broadQuoteScreen(candidates, settings, usage);
  broad.eligible.forEach((row) => {
    if (coverage[row.market]) coverage[row.market].successfullyScreened += 1;
  });
  coverage.US.broadScreened = broad.screenedCount;
  coverage.ASX.broadScreened = 0;
  const limit = detailedAnalysisLimit();
  const detailedCandidates = broad.eligible.slice(0, Math.min(limit, broad.eligible.length));
  detailedCandidates.forEach((row) => {
    if (coverage[row.market]) coverage[row.market].detailedAnalyses += 1;
  });
  const now = new Date().toISOString();
  return {
    ok: reference.ok,
    usage,
    reference: {
      cacheHit: reference.cacheHit,
      fetchedAt: reference.fetchedAt ? new Date(reference.fetchedAt).toISOString() : null,
      error: reference.error || null,
    },
    coverage,
    supportedUniverseCount: rows.length,
    candidateUniverseCount: candidates.length,
    broadScreen: {
      requested: broad.screenedCount,
      eligible: broad.eligible.length,
      providerCalls: broad.providerCalls,
      providerWaits: broad.providerWaits,
      providerWaitMs: broad.providerWaitMs,
      quoteLimit: broad.quoteLimit,
      limitReason: candidates.length > broad.quoteLimit
        ? `Current Twelve Data ${usage?.plan_category || "account"} allowance is ${usage?.plan_limit || "unknown"} credits/min and ${usage?.plan_daily_limit || "unknown"} credits/day, so Freedom pre-screens ${broad.quoteLimit} symbols per run unless FREEDOM_BROAD_SCREEN_LIMIT is increased.`
        : null,
    },
    detailedCandidates,
    detailedAnalysisLimit: limit,
    dataSource: reference.cacheHit ? "Cached reference / fresh quotes" : "Fresh reference / fresh quotes",
    oldestMarketDataAgeMs: 0,
    newestMarketDataAgeMs: 0,
    lastProviderRefresh: now,
  };
}
