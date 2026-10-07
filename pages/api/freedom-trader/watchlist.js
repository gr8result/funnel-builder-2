import { withFreedomApi } from "../../../platform-core/api-guards/freedomApiGuard.js";

const WATCHLIST = [
  { symbol: "NVDA", companyName: "NVIDIA", exchange: "NASDAQ", sector: "Semiconductors" },
  { symbol: "AMD", companyName: "Advanced Micro Devices", exchange: "NASDAQ", sector: "Semiconductors" },
  { symbol: "TSLA", companyName: "Tesla", exchange: "NASDAQ", sector: "EV & Energy" },
  { symbol: "PLTR", companyName: "Palantir", exchange: "NASDAQ", sector: "AI Software" },
  { symbol: "META", companyName: "Meta Platforms", exchange: "NASDAQ", sector: "Digital Advertising & AI" },
  { symbol: "AMZN", companyName: "Amazon", exchange: "NASDAQ", sector: "Cloud & E-commerce" },
  { symbol: "SMCI", companyName: "Super Micro Computer", exchange: "NASDAQ", sector: "AI Infrastructure" },
  { symbol: "COIN", companyName: "Coinbase", exchange: "NASDAQ", sector: "Crypto Infrastructure" },
  { symbol: "MSTR", companyName: "MicroStrategy", exchange: "NASDAQ", sector: "Bitcoin Treasury" },
  { symbol: "AVGO", companyName: "Broadcom", exchange: "NASDAQ", sector: "Semiconductors" },
];
import { addLocalTraderWatchlistItem, checkLocalMarketWatch, loadLocalMarketWatch, loadLocalTraderWatchlist, recordLocalMarketWatchFill, recordLocalMarketWatchSale, registerLocalMarketWatchPlan } from "../../../lib/freedom-trader/localPaperStore.js";

export const TRADER_WATCHLIST = WATCHLIST;

async function handler(req, res) {
  if (!["GET", "POST", "PATCH"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST, PATCH");
    return res.status(405).json({ ok: false, watchlist: [], error: "Method not allowed." });
  }

  try {
    if (req.method === "POST") {
      if (req.body?.action === "add_watchlist") {
        const watchlistItem = await addLocalTraderWatchlistItem(req.body?.item || req.body || {});
        return res.status(200).json({ ok: true, watchlistItem, message: `${watchlistItem.symbol} added to Watchlist.`, error: null });
      }
      const item = await registerLocalMarketWatchPlan(req.body?.plan || req.body || {});
      return res.status(200).json({ ok: true, state: item.state, marketWatchItem: item, message: "CMC order marked entered. Market Watch is waiting for entry.", error: null });
    }
    if (req.method === "PATCH") {
      if (req.body?.action === "check") {
        const result = await checkLocalMarketWatch(req.body || {});
        return res.status(200).json({ ok: true, reports: result.reports, marketWatch: result.marketWatch, error: null });
      }
      if (req.body?.action === "record_sale") {
        const item = await recordLocalMarketWatchSale(req.body || {});
        return res.status(200).json({ ok: true, state: item.state, marketWatchItem: item, message: item.state === "COMPLETED" ? "Trade completed and journal updated." : "Sale recorded. Position remains active.", error: null });
      }
      const item = await recordLocalMarketWatchFill(req.body || {});
      return res.status(200).json({ ok: true, state: item.state, marketWatchItem: item, message: "Actual fill recorded. Market Watch is using the actual fill price.", error: null });
    }
    const marketWatch = await loadLocalMarketWatch();
    const localWatchlist = await loadLocalTraderWatchlist();
    const bySymbol = new Map();
    [...localWatchlist, ...WATCHLIST].forEach((item) => item?.symbol && bySymbol.set(item.symbol, item));
    const watchlist = Array.from(bySymbol.values());
    return res.status(200).json({
      ok: true,
      watchlist,
      marketWatch: marketWatch.marketWatch,
      journal: marketWatch.journal,
      count: watchlist.length,
      updatedAt: new Date().toISOString(),
      error: null,
    });
  } catch (error) {
    return res.status(400).json({ ok: false, watchlist: WATCHLIST, error: error.message || "Market Watch update failed." });
  }
}

// M2.1: authentication + freedom entitlement enforced before this handler.
export default withFreedomApi(handler);
