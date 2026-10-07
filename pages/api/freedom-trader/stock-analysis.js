import { withFreedomApi } from "../../../platform-core/api-guards/freedomApiGuard.js";

import { resolveFreedomTraderStock } from "../../../lib/freedom-trader/marketUniverse.js";
import { buildSingleStockDecision } from "../../../lib/freedom-trader/singleStockAnalysis.js";
import { addLocalTraderWatchlistItem, registerLocalMarketWatchPlan } from "../../../lib/freedom-trader/localPaperStore.js";
import { rankMarketOpportunities } from "../../../lib/freedom-trader/opportunityRanking.js";
import { analyseSymbol } from "./analysis.js";

function pickResolved(lookup, requestedSymbol = "") {
  if (lookup?.resolved) return lookup.resolved;
  const symbol = String(requestedSymbol || "").trim().toUpperCase();
  return lookup?.matches?.find((item) => item.symbol === symbol) || null;
}

async function analyseResolvedStock(query) {
  const lookup = await resolveFreedomTraderStock(query);
  const publicLookup = lookup ? { ok: lookup.ok, query: lookup.query, matches: lookup.matches, resolved: lookup.resolved, ambiguous: lookup.ambiguous, error: lookup.error } : null;
  if (!lookup.ok || !lookup.matches.length) {
    return { ok: false, lookup: publicLookup, error: "Freedom could not find that company or ticker." };
  }
  if (lookup.ambiguous && !lookup.resolved) {
    return { ok: true, ambiguous: true, lookup: publicLookup, matches: lookup.matches, error: null };
  }
  const resolved = pickResolved(lookup, query);
  const analysis = await analyseSymbol(resolved.symbol, null, resolved);
  const ranking = rankMarketOpportunities([analysis], {}, { includeDevelopingTopFive: true });
  const decision = buildSingleStockDecision({ analysis, ranking, settings: { accountCurrency: analysis.currency || resolved.currency || "USD" } });
  return {
    ok: true,
    ambiguous: false,
    resolved,
    analysis,
    opportunity: decision.ranking,
    decision,
    lookup: publicLookup,
    error: null,
    updatedAt: new Date().toISOString(),
  };
}

async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }
  try {
    const query = req.method === "GET" ? (req.query.query || req.query.symbol) : (req.body?.query || req.body?.symbol);
    const result = await analyseResolvedStock(query);
    if (!result.ok) return res.status(404).json(result);
    if (req.method === "GET" || result.ambiguous || !req.body?.action) return res.status(200).json(result);

    if (req.body?.action === "add_watchlist") {
      const watchlistItem = await addLocalTraderWatchlistItem(result.resolved);
      return res.status(200).json({ ...result, watchlistItem, message: `${result.resolved.symbol} added to Watchlist.` });
    }
    if (req.body?.action === "monitor") {
      if (!result.decision?.canMonitor || !result.decision?.tradePlan) {
        return res.status(400).json({ ...result, error: "This stock is not eligible for Market Watch yet." });
      }
      const marketWatchItem = await registerLocalMarketWatchPlan(result.decision.tradePlan);
      return res.status(200).json({ ...result, marketWatchItem, message: `${result.resolved.symbol} added to Market Watch.` });
    }
    return res.status(400).json({ ...result, error: "Unknown stock action." });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "Stock analysis failed." });
  }
}

// M2.1: authentication + freedom entitlement enforced before this handler.
export default withFreedomApi(handler);
