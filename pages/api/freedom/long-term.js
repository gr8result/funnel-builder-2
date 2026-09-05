import { withFreedomApi } from "../../../platform-core/api-guards/freedomApiGuard.js";

/**
 * Long-Term Portfolio - manually entered long-term investments (Microsoft and others).
 * Tracked entirely separately from short-term trades.
 */

import {
  addLongTermHolding,
  enrichLongTermHolding,
  listLongTermHoldings,
  listArchivedHoldings,
  longTermTotals,
  removeLongTermHolding,
  updateLongTermHolding,
} from "../../../lib/freedom/tradeStore.js";
import { quotesForSymbols } from "../../../lib/freedom/marketLookup.js";

async function respondWithHoldings(res, extra = {}) {
  const holdings = await listLongTermHoldings();
  let quotes = new Map();
  let marketDataError = null;
  if (holdings.length) {
    try {
      quotes = await quotesForSymbols(holdings.map((row) => row.symbol), { instruments: holdings, withCandles: true, candleLimit: 120 });
    } catch (error) {
      marketDataError = error?.message || "Market data unavailable.";
    }
  }

  const enriched = holdings.map((holding) => {
    const quote = quotes.get(holding.symbol) || null;
    const row = enrichLongTermHolding(holding, quote);
    return { ...row, candles: quote?.candles || [], marketDataError: quote?.error || marketDataError || null };
  });

  const priced = enriched.filter((row) => row.dataAvailable);
  return res.status(200).json({
    ok: true,
    holdings: enriched,
    archivedHoldings: await listArchivedHoldings(),
    totals: longTermTotals(enriched),
    marketDataFailure: Boolean(marketDataError) || (holdings.length > 0 && priced.length === 0),
    marketDataError,
    ...extra,
  });
}

async function handler(req, res) {
  try {
    if (req.method === "GET") return await respondWithHoldings(res);

    if (req.method === "POST") {
      const result = await addLongTermHolding(req.body || {});
      if (!result.ok) return res.status(400).json({ ok: false, errors: result.errors });
      return await respondWithHoldings(res, { created: result.value });
    }

    if (req.method === "PATCH") {
      const id = req.body?.id || req.query?.id;
      if (!id) return res.status(400).json({ ok: false, errors: ["A holding id is required."] });
      const result = await updateLongTermHolding(id, req.body || {});
      if (!result.ok) return res.status(400).json({ ok: false, errors: result.errors });
      return await respondWithHoldings(res, { updated: result.value });
    }

    if (req.method === "DELETE") {
      const id = req.body?.id || req.query?.id;
      if (!id) return res.status(400).json({ ok: false, errors: ["A holding id is required."] });
      const result = await removeLongTermHolding(id);
      if (!result.ok) return res.status(404).json({ ok: false, errors: ["Holding not found."] });
      return await respondWithHoldings(res, { deleted: id });
    }

    res.setHeader("Allow", "GET, POST, PATCH, DELETE");
    return res.status(405).json({ ok: false, errors: ["Method not allowed."] });
  } catch (error) {
    console.error("Freedom long-term route failed:", error);
    return res.status(500).json({ ok: false, errors: [error?.message || "The portfolio store could not be read."] });
  }
}

// M2.1: authentication + freedom entitlement enforced before this handler.
export default withFreedomApi(handler);
