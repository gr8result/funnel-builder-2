import { withFreedomApi } from "../../../platform-core/api-guards/freedomApiGuard.js";

/**
 * Ticker lookup for the manual trade entry forms.
 *
 * Delegates to resolveFreedomTraderStock, which preserves the exchange-aware resolution
 * fix: an exact symbol match with exactly one US listing resolves to that listing (so
 * CMG resolves to Chipotle on the US market rather than the ASX company of the same
 * ticker). Ambiguous symbols are returned as a match list for the user to choose from.
 */

import { resolveTicker } from "../../../lib/freedom/marketLookup.js";
import { quotesForSymbols } from "../../../lib/freedom/marketLookup.js";

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  const query = String(req.query?.q || req.query?.symbol || "").trim();
  if (!query) return res.status(400).json({ ok: false, error: "A ticker or company name is required." });

  try {
    const result = await resolveTicker(query);
    if (!result.ok) {
      return res.status(200).json({ ok: false, query, matches: [], resolved: null, error: result.error });
    }

    // Attach a live price to the single resolved match so the form can pre-fill and the
    // user can sanity-check the price against their broker before saving.
    let quote = null;
    if (result.resolved?.symbol) {
      const quotes = await quotesForSymbols([result.resolved.symbol]).catch(() => new Map());
      const found = quotes.get(result.resolved.symbol);
      if (found) quote = { price: found.price, timestamp: found.timestamp, error: found.error };
    }

    return res.status(200).json({
      ok: true,
      query,
      matches: result.matches,
      resolved: result.resolved,
      ambiguous: Boolean(result.ambiguous),
      quote,
      error: null,
    });
  } catch (error) {
    console.error("Freedom ticker resolution failed:", error);
    return res.status(200).json({ ok: false, query, matches: [], resolved: null, error: "Ticker lookup failed." });
  }
}

// M2.1: authentication + freedom entitlement enforced before this handler.
export default withFreedomApi(handler);
