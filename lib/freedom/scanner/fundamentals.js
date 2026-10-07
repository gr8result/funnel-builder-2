/**
 * Batched fundamentals + market-cap + upcoming-earnings lookups.
 *
 * Reuses the existing, hardened FinnhubProvider.companyProfile() for market
 * cap/exchange/industry (lib/freedom-trader/marketDataProviders.js is left
 * completely unmodified). stock/metric and calendar/earnings have no existing
 * wrapper in this codebase, so this file adds a small, self-contained Finnhub
 * GET helper for exactly those two endpoints, following the same key-check /
 * error-shape conventions as the existing provider file.
 *
 * Every symbol is fetched with a small concurrency cap and per-symbol try/catch
 * so one bad symbol cannot abort a whole batch - a failure for symbol X reports
 * X as unavailable, nothing else.
 */

import { FinnhubProvider } from "../../freedom-trader/marketDataProviders.js";

const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";
const FETCH_TIMEOUT_MS = 8000;
const BATCH_CONCURRENCY = 5;
const METRIC_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const metricCache = globalThis.__freedomScannerMetricCache || new Map();
globalThis.__freedomScannerMetricCache = metricCache;
const earningsCache = globalThis.__freedomScannerEarningsCache || new Map();
globalThis.__freedomScannerEarningsCache = earningsCache;

function finnhubKey() {
  return process.env.FINNHUB_API_KEY?.trim() || "";
}

async function fetchFinnhubJson(path, params = {}) {
  const key = finnhubKey();
  if (!key) return { ok: false, data: null, error: "FINNHUB_API_KEY is not configured." };
  const url = new URL(`${FINNHUB_BASE_URL}/${path}`);
  Object.entries({ ...params, token: key }).forEach(([name, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(name, String(value));
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal });
    const data = await response.json().catch(() => null);
    return { ok: response.ok, data, error: response.ok ? null : `Finnhub ${path} failed: ${response.status}` };
  } catch (error) {
    return { ok: false, data: null, error: error?.message || `Finnhub ${path} request failed.` };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchMetric(symbol) {
  const cached = metricCache.get(symbol);
  if (cached && Date.now() - cached.fetchedAt < METRIC_CACHE_TTL_MS) return cached.result;
  const result = await fetchFinnhubJson("stock/metric", { symbol, metric: "all" });
  metricCache.set(symbol, { fetchedAt: Date.now(), result });
  return result;
}

async function fetchEarningsCalendar(symbol) {
  const cached = earningsCache.get(symbol);
  if (cached && Date.now() - cached.fetchedAt < METRIC_CACHE_TTL_MS) return cached.result;
  const from = new Date().toISOString().slice(0, 10);
  const to = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
  const result = await fetchFinnhubJson("calendar/earnings", { symbol, from, to });
  earningsCache.set(symbol, { fetchedAt: Date.now(), result });
  return result;
}

/**
 * @param {string} symbol
 * @returns {Promise<{ symbol, marketCap: number|null, exchange, industry, currency,
 *                      insiderOwnershipPercent, institutionalOwnershipPercent,
 *                      nextEarningsDate: string|null, availability: Object, error: string|null }>}
 */
export async function fetchFundamentalsForSymbol(symbol) {
  const [profile, metric, earnings] = await Promise.all([
    FinnhubProvider.companyProfile(symbol).catch((error) => ({ ok: false, error: error?.message })),
    fetchMetric(symbol),
    fetchEarningsCalendar(symbol),
  ]);

  const metricSeries = metric?.data?.metric || null;
  const availability = {
    marketCap: profile?.ok && Number.isFinite(profile.marketCapitalization) ? "AVAILABLE" : "UNAVAILABLE",
    insiderOwnershipPercent: Number.isFinite(metricSeries?.monthlyInsiderNetShares) || Number.isFinite(metricSeries?.["insiderOwnPercent"]) ? "AVAILABLE" : "UNAVAILABLE",
    institutionalOwnershipPercent: "UNAVAILABLE", // Finnhub free tier does not expose this reliably
  };

  const nextEarnings = Array.isArray(earnings?.data?.earningsCalendar) && earnings.data.earningsCalendar.length
    ? earnings.data.earningsCalendar.sort((a, b) => Date.parse(a.date) - Date.parse(b.date))[0]
    : null;

  return {
    symbol,
    marketCap: profile?.ok && Number.isFinite(profile.marketCapitalization) ? Number(profile.marketCapitalization) * 1_000_000 : null,
    exchange: profile?.exchange || null,
    industry: profile?.industry || null,
    currency: profile?.currency || null,
    insiderOwnershipPercent: Number.isFinite(metricSeries?.["insiderOwnPercent"]) ? Number(metricSeries["insiderOwnPercent"]) : null,
    peRatio: Number.isFinite(metricSeries?.peBasicExclExtraTTM) ? Number(metricSeries.peBasicExclExtraTTM) : null,
    week52High: Number.isFinite(metricSeries?.["52WeekHigh"]) ? Number(metricSeries["52WeekHigh"]) : null,
    week52Low: Number.isFinite(metricSeries?.["52WeekLow"]) ? Number(metricSeries["52WeekLow"]) : null,
    // Finnhub's metric endpoint gives 10-day average SHARE volume, not dollar volume.
    // averageDollarVolume is derived downstream (orchestrator) as price * this value,
    // once a real, validated current price is known - it is never computed here.
    averageShareVolume10Day: Number.isFinite(metricSeries?.["10DayAverageTradingVolume"]) ? Number(metricSeries["10DayAverageTradingVolume"]) * 1_000_000 : null,
    nextEarningsDate: nextEarnings?.date || null,
    availability,
    source: "Finnhub",
    error: profile?.ok === false && metric?.ok === false ? "Finnhub data unavailable for this symbol." : null,
  };
}

/**
 * Fetches fundamentals for a list of symbols with bounded concurrency.
 * @returns {Promise<Map<string, Object>>}
 */
export async function fetchFundamentalsBatch(symbols = []) {
  const unique = Array.from(new Set(symbols.map((s) => String(s || "").trim().toUpperCase()).filter(Boolean)));
  const output = new Map();
  let cursor = 0;

  async function worker() {
    while (cursor < unique.length) {
      const symbol = unique[cursor++];
      try {
        output.set(symbol, await fetchFundamentalsForSymbol(symbol));
      } catch (error) {
        output.set(symbol, { symbol, error: error?.message || "Fundamentals fetch failed.", availability: {} });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(BATCH_CONCURRENCY, unique.length) }, worker));
  return output;
}
