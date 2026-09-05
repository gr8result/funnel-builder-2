import { withFreedomApi } from "../../../platform-core/api-guards/freedomApiGuard.js";

/**
 * Today's Opportunities.
 *
 * Runs the existing, hardened Freedom Trader scan over the configured universe and
 * reduces it to the five-action vocabulary. All market data, ranking and validation
 * rules are unchanged - this route only presents them.
 */

import { cleanSettings, runCompleteScan } from "../freedom-trader/scanner.js";
import { loadLocalLastGoodScan } from "../../../lib/freedom-trader/localPaperStore.js";
import { buildOpportunitiesPayload } from "../../../lib/freedom/decision.js";
import { marketSessionSnapshot } from "../../../lib/freedom/marketSessions.js";

const cache = globalThis.__freedomOpportunitiesCache || { key: "", cachedAt: 0, payload: null };
const inFlight = globalThis.__freedomOpportunitiesInFlight || new Map();
globalThis.__freedomOpportunitiesCache = cache;
globalThis.__freedomOpportunitiesInFlight = inFlight;

const CACHE_TTL_MS = 10 * 60 * 1000;

async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, outcome: "method-not-allowed", error: "Method not allowed." });
  }

  const body = req.method === "POST" ? req.body || {} : req.query || {};
  const force = body.force === true || body.force === "true";
  const limit = Number(body.limit) || 12;
  const settings = cleanSettings(body);
  const key = JSON.stringify({
    marketSelection: settings.marketSelection,
    markets: settings.markets,
    universeSelection: settings.universeSelection,
    symbols: settings.symbols,
    importedSymbols: (settings.importedCandidates || []).map((item) => item.symbol),
  });

  if (!force && cache.payload && cache.key === key && Date.now() - cache.cachedAt < CACHE_TTL_MS) {
    return res.status(200).json({ ...cache.payload, fromCache: true });
  }

  try {
    if (!inFlight.has(key)) {
      inFlight.set(key, runCompleteScan(settings).finally(() => inFlight.delete(key)));
    }
    const scan = await inFlight.get(key);
    const payload = buildOpportunitiesPayload(scan, { limit, marketSelection: settings.marketSelection });
    if (payload.ok) {
      cache.key = key;
      cache.cachedAt = Date.now();
      cache.payload = payload;
    }
    return res.status(200).json({ ...payload, fromCache: false });
  } catch (error) {
    console.error("Freedom opportunities scan failed:", error);
    // A hard scan failure must never be presented as "no trades found".
    const lastGood = await loadLocalLastGoodScan().catch(() => null);
    const reason = error?.message || "The market scan could not complete.";
    if (lastGood?.ok) {
      const restored = buildOpportunitiesPayload({ ...lastGood, fromLastGoodScan: true }, { limit, marketSelection: settings.marketSelection });
      return res.status(200).json({
        ...restored,
        ok: false,
        outcome: "market-data-failure",
        headline: "Market data failure",
        message: "Live market data failed: " + reason + " The results below are from the last successful scan and may be out of date.",
        stale: true,
      });
    }
    return res.status(200).json({
      ok: false,
      outcome: "market-data-failure",
      headline: "Market data failure",
      message: "Live market data failed: " + reason + " Freedom has no valid results to show.",
      opportunities: [],
      counts: { buy: 0, wait: 0, watch: 0, avoid: 0, unavailable: 0 },
      scan: { sessions: marketSessionSnapshot(), marketSelection: settings.marketSelection, requestedMarkets: settings.markets },
      stale: false,
    });
  }
}

// M2.1: authentication + freedom entitlement enforced before this handler.
export default withFreedomApi(handler);
