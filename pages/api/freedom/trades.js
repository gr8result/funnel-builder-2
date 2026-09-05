import { withFreedomApi } from "../../../platform-core/api-guards/freedomApiGuard.js";

/**
 * My Trades - manually entered short-term trades.
 *
 * GET    returns every trade enriched with live price, profit/loss and chart candles.
 * POST   adds a trade (validated; rejects incoherent price plans).
 * PATCH  updates a trade.
 * DELETE removes a trade.
 *
 * Pending trades are reported as "Waiting for Entry" and are never counted as open
 * positions. A pending trade is promoted to open only when a real price trades through
 * its entry, and that promotion is persisted so monitoring continues across reloads.
 */

import {
  addShortTermTrade,
  enrichShortTermTrade,
  listShortTermTrades,
  persistTriggeredTrades,
  removeShortTermTrade,
  updatePendingOrder,
  updateShortTermTrade,
} from "../../../lib/freedom/tradeStore.js";
import { quoteMatchesOrder, quotesForSymbols } from "../../../lib/freedom/marketLookup.js";

async function respondWithTrades(res, extra = {}, filterType = null) {
  const trades = await listShortTermTrades();
  
  // Filter by order classification if specified
  const filtered = filterType === "ACTIVE_HOLDING"
    ? trades.filter(t => t.status === "open")
    : filterType ? trades.filter(t => t.orderClassification === filterType) : trades;
  
  let quotes = new Map();
  let marketDataError = null;
  if (filtered.length) {
    try {
      quotes = await quotesForSymbols(filtered.map((trade) => trade.symbol), { instruments: filtered, withCandles: true, candleLimit: 90 });
    } catch (error) {
      marketDataError = error?.message || "Market data unavailable.";
    }
  }

  const enriched = filtered.map((trade) => {
    const quote = quotes.get(trade.symbol) || null;
    const match = quoteMatchesOrder({ ...trade, currency: trade.nativeCurrency || trade.currency }, quote);
    const safeQuote = match.ok ? quote : { price: null, timestamp: quote?.timestamp || null, error: match.reason };
    const row = enrichShortTermTrade(trade, safeQuote);
    return {
      ...row,
      bid: match.ok ? quote?.bid ?? null : null,
      ask: match.ok ? quote?.ask ?? null : null,
      provider: quote?.provider || null,
      marketStatus: quote?.marketStatus || "DATA UNAVAILABLE",
      quoteStale: Boolean(quote?.stale),
      quoteValidated: Boolean(match.ok && row.dataAvailable),
      candles: match.ok ? quote?.candles || [] : [],
      marketDataError: safeQuote?.error || marketDataError || null,
    };
  });

  await persistTriggeredTrades(enriched).catch(() => 0);

  const priced = enriched.filter((row) => row.dataAvailable);
  const open = enriched.filter((row) => row.effectiveStatus === "open");
  const totals = {
    trades: enriched.length,
    pending: enriched.filter((row) => row.effectiveStatus === "pending").length,
    open: open.length,
    unavailable: enriched.length - priced.length,
    amountInvested: round(open.reduce((total, row) => total + (row.amountInvested || 0), 0)),
    profitLoss: round(open.reduce((total, row) => total + (row.profitLoss || 0), 0)),
  };

  return res.status(200).json({
    ok: true,
    trades: enriched,
    totals,
    marketDataFailure: Boolean(marketDataError) || (trades.length > 0 && priced.length === 0),
    marketDataError,
    ...extra,
  });
}

function round(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : 0;
}

async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const filterType = req.query?.type || null;
      return await respondWithTrades(res, {}, filterType);
    }

    if (req.method === "POST") {
      const result = await addShortTermTrade(req.body || {});
      if (!result.ok) return res.status(400).json({ ok: false, errors: result.errors });
      return await respondWithTrades(res, { created: result.value });
    }

    if (req.method === "PATCH") {
      const id = req.body?.id || req.query?.id;
      if (!id) return res.status(400).json({ ok: false, errors: ["A trade id is required."] });
      const action = req.body?.action || req.query?.action || null;
      const result = action ? await updatePendingOrder(id, action, req.body || {}) : await updateShortTermTrade(id, req.body || {});
      if (!result.ok) return res.status(400).json({ ok: false, errors: result.errors });
      return await respondWithTrades(res, { updated: result.value });
    }

    if (req.method === "DELETE") {
      const id = req.body?.id || req.query?.id;
      if (!id) return res.status(400).json({ ok: false, errors: ["A trade id is required."] });
      const result = await removeShortTermTrade(id);
      if (!result.ok) return res.status(404).json({ ok: false, errors: ["Trade not found."] });
      return await respondWithTrades(res, { deleted: id });
    }

    res.setHeader("Allow", "GET, POST, PATCH, DELETE");
    return res.status(405).json({ ok: false, errors: ["Method not allowed."] });
  } catch (error) {
    console.error("Freedom trades route failed:", error);
    return res.status(500).json({ ok: false, errors: [error?.message || "The trade store could not be read."] });
  }
}

// M2.1: authentication + freedom entitlement enforced before this handler.
export default withFreedomApi(handler);
