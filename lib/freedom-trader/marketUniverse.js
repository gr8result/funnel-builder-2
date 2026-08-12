import { fetchTwelveDataApiUsage, fetchTwelveDataQuoteBatch, fetchTwelveDataStocks } from "./twelveData.js";

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
  const requests = [
    { exchange: "NASDAQ", country: "United States", type: "Common Stock" },
    { exchange: "NYSE", country: "United States", type: "Common Stock" },
    { exchange: "AMEX", country: "United States", type: "Common Stock" },
    { exchange: "ASX", country: "Australia", type: "Common Stock" },
  ];
  const results = await Promise.all(requests.map((params) => fetchTwelveDataStocks(params).then((result) => ({ params, result }))));
  const failures = results.filter(({ result }) => !result.ok);
  const symbols = results.flatMap(({ result }) => result.ok ? result.symbols : []);
  if (!symbols.length) {
    referenceCache.error = failures.map(({ params, result }) => `${params.exchange}: ${result.error || "unavailable"}`).join("; ") || "Twelve Data reference universe unavailable.";
    return { ok: false, rows: referenceCache.rows, cacheHit: Boolean(referenceCache.rows.length), fetchedAt: referenceCache.fetchedAt, error: referenceCache.error };
  }
  referenceCache.rows = dedupe(symbols.map(mapReferenceRow).filter((row) => row.market && isOrdinaryShare(row)));
  referenceCache.fetchedAt = Date.now();
  referenceCache.error = failures.length
    ? failures.map(({ params, result }) => `${params.exchange}: ${result.error || "unavailable"}`).join("; ")
    : null;
  return { ok: failures.length === 0, rows: referenceCache.rows, cacheHit: false, fetchedAt: referenceCache.fetchedAt, error: referenceCache.error };
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
  const asxUnavailable = !usage?.ok
    ? `Provider account usage could not be verified: ${usage?.error || "unknown provider error"}. ASX scanning is paused until entitlement can be confirmed.`
    : plan === "basic"
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

export async function buildMarketDiscovery(settings = {}) {
  const [usage, reference] = await Promise.all([
    fetchTwelveDataApiUsage().catch((error) => ({ ok: false, error: error.message })),
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
  const broad = usageBudgetExhausted
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
