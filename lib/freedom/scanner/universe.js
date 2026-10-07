/**
 * Scanner universe building - a thin wrapper over the existing, hardened
 * lib/freedom-trader/marketUniverse.js (reference listing, identity
 * validation, liquidity pre-screen, caching, scan-deadline/budget handling).
 * Nothing there is modified; this file only adds what that module does not
 * already guarantee:
 *
 *   1. Explicit OTC exclusion. marketUniverse's identityGate() ALLOWS Alpaca
 *      exchange "OTC" through its validity check (it is validating identity,
 *      not curating the scan universe), so a NASDAQ/NYSE/AMEX-listed symbol
 *      that Alpaca reports as actually trading OTC can still reach
 *      detailedCandidates. This filters those out by name, after the fact,
 *      rather than assuming the upstream gate already did it.
 *   2. Two named profiles - "penny" (Engine 1: price/cap ceiling) and "broad"
 *      (Engine 2: no price/cap ceiling) - as configuration, not two code paths.
 *   3. Market-cap filtering, applied AFTER fundamentals are fetched (this
 *      module has no market-cap data of its own - marketUniverse.js's
 *      candidates carry price/volume only).
 */

import { buildMarketDiscovery } from "../../freedom-trader/marketUniverse.js";

const ALLOWED_EXCHANGES = new Set(["NASDAQ", "NYSE", "AMEX", "ASX"]);

export const SCANNER_PROFILES = Object.freeze({
  penny: {
    id: "penny",
    label: "High-Upside / Penny & Micro-Cap",
    maxPriceUsd: 5,
    maxPriceAud: 5,
    minMarketCapUsd: 20_000_000,
    maxMarketCapUsd: 300_000_000,
    minMarketCapAud: 30_000_000,
    maxMarketCapAud: 450_000_000,
    softCapBoundary: true, // spec: do not reject an exceptional candidate solely for being slightly outside defaults
    softCapTolerancePercent: 25,
  },
  broad: {
    id: "broad",
    label: "Whole-Market Buy-Opportunity",
    maxPriceUsd: null,
    maxPriceAud: null,
    minMarketCapUsd: null,
    maxMarketCapUsd: null,
    minMarketCapAud: null,
    maxMarketCapAud: null,
    softCapBoundary: false,
    softCapTolerancePercent: 0,
  },
});

const DEFAULT_MIN_AVERAGE_DOLLAR_VOLUME = 100_000;

export function exchangeAllowed(row) {
  const exchange = String(row.exchange || "").trim().toUpperCase();
  return ALLOWED_EXCHANGES.has(exchange);
}

/**
 * @param {Object} options
 * @param {"penny"|"broad"} options.profile
 * @param {string[]} options.markets  e.g. ["US"], ["ASX"], ["US","ASX"]
 * @param {Object} [options.overrides]  passed straight through to buildMarketDiscovery
 * @returns {Promise<Object>}  { ok, candidates, otcExcludedCount, diagnostics, ...rest of buildMarketDiscovery }
 */
export async function scanUniverse({ profile = "penny", markets = ["US"], overrides = {} } = {}) {
  const profileConfig = SCANNER_PROFILES[profile] || SCANNER_PROFILES.penny;
  const settings = {
    markets,
    minimumPrice: overrides.minimumPrice ?? 0.05,
    minimumDailyVolume: overrides.minimumDailyVolume ?? Math.round(DEFAULT_MIN_AVERAGE_DOLLAR_VOLUME / 5), // rough share-volume floor; real $ filter applied downstream once price is known
    maximumVolatility: overrides.maximumVolatility ?? 30,
    detailedAnalysisLimit: overrides.detailedAnalysisLimit ?? 150,
    broadScreenLimit: overrides.broadScreenLimit,
    scanTimeoutMs: overrides.scanTimeoutMs,
    universeSelection: overrides.universeSelection,
    excludedIndustries: overrides.excludedIndustries,
  };

  const discovery = await buildMarketDiscovery(settings);
  const rawCandidates = Array.isArray(discovery.detailedCandidates) ? discovery.detailedCandidates : [];

  const otcExcluded = [];
  const candidates = rawCandidates.filter((row) => {
    if (exchangeAllowed(row)) return true;
    otcExcluded.push({ symbol: row.symbol, exchange: row.exchange });
    return false;
  });

  return {
    ok: discovery.ok,
    profile: profileConfig.id,
    markets,
    candidates,
    otcExcludedCount: otcExcluded.length,
    otcExcluded,
    universeCount: discovery.supportedUniverseCount,
    candidateUniverseCount: discovery.candidateUniverseCount,
    broadScreen: discovery.broadScreen,
    reference: discovery.reference,
    dataSource: discovery.dataSource,
  };
}

/**
 * Market-cap + (profile-specific) price ceiling filter, applied once
 * fundamentals have supplied a real market cap. Returns { pass, reasons }.
 * The "soft boundary" rule (spec section 4: "do not reject an exceptional
 * candidate solely for being slightly outside these defaults") is implemented
 * as an explicit tolerance band, not a silent override - a candidate outside
 * the hard range but inside the tolerance band passes with a flagged reason.
 */
export function applyProfileFilter({ profile = "penny", market = "US", price, marketCap, averageDollarVolume, minAverageDollarVolume = DEFAULT_MIN_AVERAGE_DOLLAR_VOLUME } = {}) {
  const config = SCANNER_PROFILES[profile] || SCANNER_PROFILES.penny;
  const reasons = [];
  let pass = true;

  if (Number.isFinite(averageDollarVolume) && averageDollarVolume < minAverageDollarVolume) {
    pass = false;
    reasons.push(`Average dollar volume ${Math.round(averageDollarVolume).toLocaleString("en-US")} is below the minimum ${minAverageDollarVolume.toLocaleString("en-US")}.`);
  }

  if (config.id === "penny") {
    const maxPrice = market === "ASX" ? config.maxPriceAud : config.maxPriceUsd;
    if (Number.isFinite(price) && Number.isFinite(maxPrice) && price > maxPrice) {
      pass = false;
      reasons.push(`Price ${price} exceeds the ${market} penny-universe ceiling of ${maxPrice}.`);
    }

    const minCap = market === "ASX" ? config.minMarketCapAud : config.minMarketCapUsd;
    const maxCap = market === "ASX" ? config.maxMarketCapAud : config.maxMarketCapUsd;
    if (Number.isFinite(marketCap) && Number.isFinite(minCap) && Number.isFinite(maxCap)) {
      const tolerance = config.softCapTolerancePercent / 100;
      const toleratedMin = minCap * (1 - tolerance);
      const toleratedMax = maxCap * (1 + tolerance);
      if (marketCap < toleratedMin || marketCap > toleratedMax) {
        pass = false;
        reasons.push(`Market cap ${marketCap.toLocaleString("en-US")} is outside the ${market} range (including a ${config.softCapTolerancePercent}% tolerance band).`);
      } else if (marketCap < minCap || marketCap > maxCap) {
        reasons.push(`Market cap ${marketCap.toLocaleString("en-US")} is outside the strict range but inside the tolerance band - kept as an exceptional candidate.`);
      }
    }
  }

  return { pass, reasons };
}
