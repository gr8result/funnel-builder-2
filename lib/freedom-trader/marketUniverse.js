import { fetchTwelveDataApiUsage, fetchTwelveDataQuoteBatch, fetchTwelveDataStocks } from "./twelveData.js";
import { AlpacaProvider, FinnhubProvider, selectMarketDataProvider } from "./marketDataProviders.js";

const REFERENCE_TTL_MS = Math.max(60 * 60 * 1000, Number(process.env.FREEDOM_UNIVERSE_CACHE_TTL_MS) || 24 * 60 * 60 * 1000);

const referenceCache = globalThis.__freedomMarketUniverseReferenceCache || { fetchedAt: 0, rows: [], error: null };
globalThis.__freedomMarketUniverseReferenceCache = referenceCache;

const US_HIGH_LIQUIDITY_V1_UNIVERSE = [
  "NVDA", "MSFT", "AAPL", "AMZN", "META", "GOOGL", "GOOG", "AVGO", "TSLA", "AMD", "NFLX", "PLTR", "COIN", "MSTR", "SMCI", "CRM",
  "ORCL", "ADBE", "NOW", "INTC", "QCOM", "MU", "AMAT", "LRCX", "KLAC", "PANW", "CRWD", "SNOW", "DDOG", "MDB", "NET", "SHOP",
  "UBER", "ABNB", "DASH", "RBLX", "ROKU", "AFRM", "SOFI", "HOOD", "SQ", "PYPL", "AXP", "V", "MA", "JPM", "BAC", "C", "WFC",
  "GS", "MS", "BLK", "SCHW", "BRK.B", "UNH", "LLY", "JNJ", "MRK", "ABBV", "PFE", "TMO", "ISRG", "VRTX", "REGN", "GILD",
  "AMGN", "COST", "WMT", "HD", "LOW", "TGT", "NKE", "SBUX", "MCD", "CMG", "LULU", "DIS", "CMCSA", "T", "VZ", "TMUS",
  "XOM", "CVX", "COP", "SLB", "OXY", "EOG", "GE", "CAT", "DE", "BA", "RTX", "LMT", "HON", "ETN", "EMR", "MMM",
  "LIN", "APD", "FCX", "NUE", "AA", "CLF", "F", "GM", "RIVN", "LCID", "ENPH", "SEDG", "FSLR", "NEE", "DUK", "SO",
  "SPGI", "ICE", "CME", "NDAQ", "BKNG", "MAR", "HLT", "DAL", "UAL", "AAL", "CCL", "RCL", "NCLH", "FDX", "UPS", "CSX",
  "UNP", "TGT", "KO", "PEP", "PG", "MDLZ", "MO", "PM", "EL", "CL", "KMB", "CVS", "WBA", "TGT", "KR", "DG", "DLTR",
  "URI", "PHM", "LEN", "DHI", "TOL", "ITB", "ANET", "DELL", "HPQ", "WDC", "STX", "ON", "MRVL", "ARM", "TEAM", "ZS",
];

function broadQuoteLimit(settings = {}) {
  return Math.max(1, Number(settings.broadScreenLimit) || Number(process.env.FREEDOM_BROAD_SCREEN_LIMIT) || 64);
}

function detailedAnalysisLimit(settings = {}) {
  return Math.max(1, Number(settings.detailedAnalysisLimit) || Number(process.env.FREEDOM_DETAILED_ANALYSIS_LIMIT) || 32);
}

function broadQuoteBatchSize() {
  return Math.max(1, Math.min(8, Number(process.env.FREEDOM_BROAD_QUOTE_BATCH_SIZE) || 8));
}

function broadAlpacaBatchSize() {
  return Math.max(1, Math.min(200, Number(process.env.FREEDOM_BROAD_ALPACA_BATCH_SIZE) || 200));
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
  const active = !["inactive", "delisted", "closed"].includes(normalizeText(row.status || row.is_active).toLowerCase());
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
    active,
    liquidityEligible: false,
    tradable: Boolean(active && market && isOrdinaryShare(row)),
  };
}

function mapFinnhubReferenceRow(row) {
  return {
    symbol: normalizeSymbol(row.symbol),
    companyName: normalizeText(row.description || row.displaySymbol || row.symbol),
    exchange: "US",
    country: "United States",
    currency: normalizeText(row.currency || "USD").toUpperCase(),
    assetType: normalizeText(row.type),
    type: normalizeText(row.type),
    micCode: "",
    market: "US",
    active: true,
    liquidityEligible: false,
    tradable: normalizeText(row.type).toLowerCase() === "common stock" && normalizeText(row.currency || "USD").toUpperCase() === "USD",
    source: "finnhub",
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

export async function loadReferenceRows() {
  if (referenceCache.rows.length && Date.now() - referenceCache.fetchedAt < REFERENCE_TTL_MS) {
    return { ok: true, rows: referenceCache.rows, cacheHit: true, fetchedAt: referenceCache.fetchedAt, error: referenceCache.error };
  }
  const useFinnhubUniverse = selectMarketDataProvider("symbolUniverse").id === FinnhubProvider.id;
  const finnhubUS = useFinnhubUniverse
    ? await FinnhubProvider.symbolUniverse({ exchange: "US" }).catch((error) => ({ ok: false, symbols: [], error: error.message }))
    : { ok: false, symbols: [], error: null };
  const requests = [
    { exchange: "NASDAQ", country: "United States", type: "Common Stock" },
    { exchange: "NYSE", country: "United States", type: "Common Stock" },
    { exchange: "AMEX", country: "United States", type: "Common Stock" },
    { exchange: "ASX", country: "Australia", type: "Common Stock" },
  ];
  const twelveRequests = finnhubUS.ok ? requests.filter((params) => params.exchange === "ASX") : requests;
  const results = await Promise.all(twelveRequests.map((params) => fetchTwelveDataStocks(params).then((result) => ({ params, result }))));
  const failures = results.filter(({ result }) => !result.ok);
  const symbols = [
    ...(finnhubUS.ok ? finnhubUS.symbols.map(mapFinnhubReferenceRow) : []),
    ...results.flatMap(({ result }) => result.ok ? result.symbols : []),
  ];
  if (!symbols.length) {
    referenceCache.error = [
      finnhubUS.error ? `Finnhub US: ${finnhubUS.error}` : null,
      ...failures.map(({ params, result }) => `${params.exchange}: ${result.error || "unavailable"}`),
    ].filter(Boolean).join("; ") || "Reference universe unavailable.";
    return { ok: false, rows: referenceCache.rows, cacheHit: Boolean(referenceCache.rows.length), fetchedAt: referenceCache.fetchedAt, error: referenceCache.error };
  }
  referenceCache.rows = dedupe(symbols.map((row) => row.source === "finnhub" ? row : mapReferenceRow(row)).filter((row) => row.market && isOrdinaryShare(row)));
  referenceCache.fetchedAt = Date.now();
  referenceCache.error = failures.length || (!finnhubUS.ok && useFinnhubUniverse)
    ? [
      !finnhubUS.ok && useFinnhubUniverse ? `Finnhub US: ${finnhubUS.error || "unavailable"}` : null,
      ...failures.map(({ params, result }) => `${params.exchange}: ${result.error || "unavailable"}`),
    ].filter(Boolean).join("; ")
    : null;
  return { ok: failures.length === 0, rows: referenceCache.rows, cacheHit: false, fetchedAt: referenceCache.fetchedAt, error: referenceCache.error };
}

function lookupScore(row, query, normalizedQuery) {
  const name = normalizeText(row.companyName).toLowerCase();
  const symbol = normalizeSymbol(row.symbol);
  const queryText = String(query || "").trim().toLowerCase();
  if (!queryText) return 0;
  if (symbol === normalizedQuery) return 1000;
  if (symbol.startsWith(normalizedQuery)) return 760;
  if (name === queryText) return 720;
  if (name.startsWith(queryText)) return 650;
  if (name.split(/\s+/).some((part) => part.startsWith(queryText))) return 520;
  if (name.includes(queryText)) return 420;
  return 0;
}

export function resolveStockQueryFromRows(rows = [], query, options = {}) {
  const normalizedQuery = normalizeSymbol(query);
  const rawQuery = normalizeText(query);
  const limit = Math.max(1, Number(options.limit) || 8);
  if (!rawQuery) return { ok: false, query: rawQuery, matches: [], error: "Freedom could not find that company or ticker." };
  const candidates = rows
    .filter((row) => row?.symbol && row?.companyName && row.tradable !== false && row.active !== false)
    .map((row) => ({ ...row, score: lookupScore(row, rawQuery, normalizedQuery) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.symbol.localeCompare(b.symbol));
  if (!candidates.length) return { ok: false, query: rawQuery, matches: [], error: "Freedom could not find that company or ticker." };
  const exact = candidates.filter((row) => row.symbol === normalizedQuery);
  const selected = exact.length ? exact : candidates;
  const matches = selected.slice(0, limit).map((row) => ({
    symbol: row.symbol,
    companyName: row.companyName,
    exchange: row.exchange,
    country: row.country,
    currency: row.currency || (row.market === "ASX" ? "AUD" : "USD"),
    market: row.market,
    assetType: row.assetType,
    micCode: row.micCode,
  }));
  return {
    ok: true,
    query: rawQuery,
    matches,
    resolved: matches.length === 1 ? matches[0] : null,
    ambiguous: matches.length > 1,
    error: null,
  };
}

export async function resolveFreedomTraderStock(query, options = {}) {
  const reference = await loadReferenceRows();
  const result = resolveStockQueryFromRows(reference.rows || [], query, options);
  return { ...result, reference };
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
  const asxUnavailable = "ASX DATA PROVIDER REQUIRED";
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
  const priority = new Map(US_HIGH_LIQUIDITY_V1_UNIVERSE.map((symbol, index) => [symbol, index]));
  return rows.filter((row) => {
    if (!markets.includes(row.market)) return false;
    if (row.market === "ASX" && coverage.ASX.unavailableReason) return false;
    return row.tradable && !excludedBySettings(row, settings);
  }).sort((a, b) => {
    const aPriority = priority.has(a.symbol) ? priority.get(a.symbol) : Number.POSITIVE_INFINITY;
    const bPriority = priority.has(b.symbol) ? priority.get(b.symbol) : Number.POSITIVE_INFINITY;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return a.symbol.localeCompare(b.symbol);
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
    liquidityEligible: true,
    changePercent: Number(quote.percentChange) || 0,
    quoteTimestamp: quote.timestamp || null,
    broadScore: Math.round(Math.min(100, Math.log10(Math.max(volume, 1)) * 10 + Math.min(move, 12) * 2 + Math.min(price, 250) / 25)),
  };
}

function staleCutoffMs() {
  return Math.max(2 * 86400000, Number(process.env.FREEDOM_STALE_MARKET_DATA_MS) || 7 * 86400000);
}

function broadHistoryScore(row, history, settings = {}) {
  const candles = Array.isArray(history?.candles) ? history.candles : [];
  const minimumVolume = Number(settings.minimumDailyVolume) || 1_000_000;
  const minimumPrice = Number(settings.minimumPrice) || 2;
  const maximumVolatility = Number(settings.maximumVolatility) || 9;
  const minimumHistory = Math.max(20, Number(settings.minimumHistoryBars) || 50);
  if (!history?.ok) return { scored: null, unavailable: { symbol: row.symbol, statusCode: history?.statusCode || "DATA_UNAVAILABLE", reason: history?.error || "DATA_UNAVAILABLE" } };
  if (candles.length < minimumHistory) return { scored: null, unavailable: { symbol: row.symbol, statusCode: "DATA_UNAVAILABLE", reason: `Only ${candles.length} OHLCV bars returned.` } };
  const latest = candles[candles.length - 1];
  const previous = candles[candles.length - 2];
  const latestMs = Number(latest?.timestamp) * 1000;
  if (!Number.isFinite(latestMs) || Date.now() - latestMs > staleCutoffMs()) return { scored: null, unavailable: { symbol: row.symbol, statusCode: "STALE", reason: "Latest OHLCV bar is stale." } };
  const price = Number(latest.close);
  const volume = Number(latest.volume);
  const avgVolume = candles.slice(-20).reduce((total, candle) => total + (Number(candle.volume) || 0), 0) / Math.min(20, candles.length);
  const volatility = candles.slice(-20).reduce((total, candle) => {
    const close = Number(candle.close);
    return total + (close > 0 ? ((Number(candle.high) - Number(candle.low)) / close) * 100 : 0);
  }, 0) / Math.min(20, candles.length);
  if (!Number.isFinite(price) || price < minimumPrice) return { scored: null, unavailable: { symbol: row.symbol, statusCode: "DATA_UNAVAILABLE", reason: "Price is below the configured threshold." } };
  if (!Number.isFinite(volume) || !Number.isFinite(avgVolume) || avgVolume < minimumVolume) return { scored: null, unavailable: { symbol: row.symbol, statusCode: "DATA_UNAVAILABLE", reason: "Average volume is below the configured liquidity threshold." } };
  if (!Number.isFinite(volatility) || volatility > maximumVolatility) return { scored: null, unavailable: { symbol: row.symbol, statusCode: "DATA_UNAVAILABLE", reason: "Volatility is outside the configured scanner range." } };
  const changePercent = Number.isFinite(previous?.close) && previous.close ? ((price - previous.close) / previous.close) * 100 : 0;
  const move = Math.abs(changePercent);
  return {
    scored: {
      ...row,
      currentPrice: price,
      volume: Math.round(avgVolume),
      latestVolume: volume,
      liquidityEligible: true,
      changePercent,
      quoteTimestamp: latest.date || null,
      broadScore: Math.round(Math.min(100, Math.log10(Math.max(avgVolume, 1)) * 10 + Math.min(move, 12) * 2 + Math.min(price, 250) / 25)),
      provider: history.provider || "Alpaca",
      candleCount: candles.length,
    },
    unavailable: null,
  };
}

function isRateLimit(result) {
  return Number(result?.providerStatus) === 429 || /credit|limit|rate|429/i.test(String(result?.error || ""));
}

function isDailyLimit(result) {
  return /day|daily/i.test(String(result?.error || ""));
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function msUntilNextMinute() {
  const now = new Date();
  return 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 250;
}

async function broadQuoteScreen(candidates, settings, usage) {
  if (selectMarketDataProvider("preScreenQuote").id === AlpacaProvider.id) {
    return broadAlpacaScreen(candidates, settings);
  }
  const minimumVolume = Number(settings.minimumDailyVolume) || 1_000_000;
  const creditsPerMinute = Math.max(1, Number(usage?.plan_limit) || 8);
  const quoteLimit = Math.min(broadQuoteLimit(settings), candidates.length);
  const pool = candidates.slice(0, quoteLimit);
  const screened = [];
  let processedCount = 0;
  let providerCalls = 0;
  let minuteCredits = 0;
  let minuteKey = new Date().toISOString().slice(0, 16);
  let providerWaitMs = 0;
  let providerWaits = 0;
  let retries = 0;
  const unavailable = [];
  let budgetExhausted = false;
  let budgetExhaustedReason = null;
  let pausedAtOffset = null;
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
    let quotes = await fetchTwelveDataQuoteBatch({ symbols: batch.map((row) => row.symbol) });
    if (Array.from(quotes.values()).some(isRateLimit)) {
      const limitResult = Array.from(quotes.values()).find(isRateLimit);
      if (isDailyLimit(limitResult)) {
        budgetExhausted = true;
        budgetExhaustedReason = limitResult.error || "Provider daily credit limit reached.";
        pausedAtOffset = offset;
        break;
      }
      const retryAfter = Array.from(quotes.values()).find((item) => Number.isFinite(Number(item?.retryAfterMs)))?.retryAfterMs;
      const waitMs = Number.isFinite(Number(retryAfter)) ? Number(retryAfter) : msUntilNextMinute();
      providerWaits += 1;
      providerWaitMs += waitMs;
      await wait(waitMs);
      minuteKey = new Date().toISOString().slice(0, 16);
      minuteCredits = batch.length;
      retries += 1;
      providerCalls += 1;
      quotes = await fetchTwelveDataQuoteBatch({ symbols: batch.map((row) => row.symbol) });
      const retryLimitResult = Array.from(quotes.values()).find(isRateLimit);
      if (retryLimitResult) {
        budgetExhausted = true;
        budgetExhaustedReason = retryLimitResult.error || "Provider credit limit reached.";
        pausedAtOffset = offset;
        break;
      }
    }
    processedCount += batch.length;
    batch.forEach((row) => {
      const quote = quotes.get(row.symbol);
      const scored = broadScore(row, quote);
      if (scored && scored.volume >= minimumVolume) screened.push(scored);
      else unavailable.push({ symbol: row.symbol, reason: quote?.error || "Quote did not meet liquidity or price requirements." });
    });
  }
  screened.sort((a, b) => (b.broadScore - a.broadScore) || (b.volume - a.volume) || a.symbol.localeCompare(b.symbol));
  return {
    providerCalls,
    providerWaits,
    providerWaitMs,
    retries,
    quoteLimit,
    screenedCount: processedCount,
    eligible: screened,
    unavailable,
    budgetExhausted,
    budgetExhaustedReason,
    pausedAtOffset,
  };
}

async function broadAlpacaScreen(candidates, settings) {
  const quoteLimit = Math.min(broadQuoteLimit(settings), candidates.length);
  const pool = candidates.slice(0, quoteLimit);
  const started = Date.now();
  const batch = await AlpacaProvider.historyBatch(pool.map((row) => row.symbol), {
    range: settings.broadScreenRange || "3mo",
    interval: "1day",
    limit: Math.max(60, Number(settings.broadScreenBars) || 80),
  }, { chunkSize: broadAlpacaBatchSize() });
  const diagnostics = batch.diagnostics || {};
  const screened = [];
  const unavailable = [];
  pool.forEach((row) => {
    const { scored, unavailable: failed } = broadHistoryScore(row, batch.get(row.symbol), settings);
    if (scored) screened.push(scored);
    if (failed) unavailable.push(failed);
  });
  screened.sort((a, b) => (b.broadScore - a.broadScore) || (b.volume - a.volume) || a.symbol.localeCompare(b.symbol));
  return {
    provider: "Alpaca",
    providerCalls: diagnostics.apiCalls || 0,
    providerWaits: 0,
    providerWaitMs: 0,
    retries: 0,
    quoteLimit,
    screenedCount: pool.length,
    eligible: screened,
    unavailable,
    budgetExhausted: false,
    budgetExhaustedReason: null,
    pausedAtOffset: null,
    symbolsRequested: diagnostics.symbolsRequested || pool.length,
    barsReturned: diagnostics.barsReturned || 0,
    elapsedMs: Date.now() - started,
  };
}

export async function buildMarketDiscovery(settings = {}) {
  const [usage, reference] = await Promise.all([
    selectMarketDataProvider("preScreenQuote").id === AlpacaProvider.id
      ? Promise.resolve({ ok: true, provider: "Alpaca", plan_category: "alpaca", plan_limit: null, plan_daily_limit: null })
      : fetchTwelveDataApiUsage().catch((error) => ({ ok: false, error: error.message })),
    loadReferenceRows(),
  ]);
  let referenceProviderWaitMs = 0;
  let referenceProviderWaits = 0;
  if (!reference.cacheHit && Number(usage?.plan_limit) > 0 && process.env.FREEDOM_DISABLE_PROVIDER_WAITS !== "true") {
    referenceProviderWaitMs = msUntilNextMinute();
    referenceProviderWaits = 1;
    await wait(referenceProviderWaitMs);
  }
  const rows = reference.rows || [];
  const coverage = marketCoverage(rows, usage, settings);
  const candidates = candidateUniverse(rows, settings, coverage);
  const usageBudgetExhausted = !usage?.ok && isDailyLimit(usage);
  const manualSymbols = Array.isArray(settings.symbols) ? settings.symbols.map(normalizeSymbol).filter(Boolean) : [];
  const broad = manualSymbols.length
    ? {
      providerCalls: 0,
      providerWaits: 0,
      providerWaitMs: 0,
      retries: 0,
      quoteLimit: manualSymbols.length,
      screenedCount: manualSymbols.length,
      eligible: [],
      unavailable: [],
      budgetExhausted: false,
      budgetExhaustedReason: null,
      pausedAtOffset: null,
    }
    : usageBudgetExhausted
    ? {
      providerCalls: 0,
      providerWaits: 0,
      providerWaitMs: 0,
      retries: 0,
      quoteLimit: Math.min(broadQuoteLimit(settings), candidates.length),
      screenedCount: 0,
      eligible: [],
      unavailable: [],
      budgetExhausted: true,
      budgetExhaustedReason: usage.error || "Provider daily credit limit reached.",
      pausedAtOffset: 0,
    }
    : await broadQuoteScreen(candidates, settings, usage);
  broad.eligible.forEach((row) => {
    if (coverage[row.market]) coverage[row.market].successfullyScreened += 1;
  });
  coverage.US.broadScreened = Math.min(broad.screenedCount, candidates.filter((row) => row.market === "US").length);
  coverage.ASX.broadScreened = Math.max(0, broad.screenedCount - coverage.US.broadScreened);
  const limit = detailedAnalysisLimit(settings);
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
      referenceProviderWaits,
      referenceProviderWaitMs,
      retries: broad.retries,
      quoteLimit: broad.quoteLimit,
      unavailable: broad.unavailable,
      budgetExhausted: broad.budgetExhausted,
      budgetExhaustedReason: broad.budgetExhaustedReason,
      pausedAtOffset: broad.pausedAtOffset,
      limitReason: candidates.length > broad.quoteLimit
        ? broad.provider === "Alpaca"
          ? `Freedom pre-screened ${broad.quoteLimit} US symbols with Alpaca batched OHLCV. Increase FREEDOM_BROAD_SCREEN_LIMIT after integrity checks pass.`
          : `Current Twelve Data ${usage?.plan_category || "account"} allowance is ${usage?.plan_limit || "unknown"} credits/min and ${usage?.plan_daily_limit || "unknown"} credits/day, so Freedom pre-screens ${broad.quoteLimit} symbols per run unless FREEDOM_BROAD_SCREEN_LIMIT is increased.`
        : null,
      provider: broad.provider || "Twelve Data",
      symbolsRequested: broad.symbolsRequested || broad.screenedCount,
      barsReturned: broad.barsReturned || 0,
      elapsedMs: broad.elapsedMs || 0,
    },
    detailedCandidates,
    detailedAnalysisLimit: limit,
    dataSource: broad.provider === "Alpaca"
      ? (reference.cacheHit ? "Cached Finnhub reference / Alpaca batched OHLCV" : "Fresh Finnhub reference / Alpaca batched OHLCV")
      : (reference.cacheHit ? "Cached reference / fresh quotes" : "Fresh reference / fresh quotes"),
    oldestMarketDataAgeMs: 0,
    newestMarketDataAgeMs: 0,
    lastProviderRefresh: now,
  };
}
