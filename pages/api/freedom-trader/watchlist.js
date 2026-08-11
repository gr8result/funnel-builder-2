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
import { loadLocalMarketWatch, recordLocalMarketWatchFill, registerLocalMarketWatchPlan } from "../../../lib/freedom-trader/localPaperStore.js";

export const TRADER_WATCHLIST = WATCHLIST;

export default async function handler(req, res) {
  if (!["GET", "POST", "PATCH"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST, PATCH");
    return res.status(405).json({ ok: false, watchlist: [], error: "Method not allowed." });
  }

  try {
    if (req.method === "POST") {
      const item = await registerLocalMarketWatchPlan(req.body?.plan || req.body || {});
      return res.status(200).json({ ok: true, state: item.state, marketWatchItem: item, message: "CMC order marked entered. Market Watch is waiting for entry.", error: null });
    }
    if (req.method === "PATCH") {
      const item = await recordLocalMarketWatchFill(req.body || {});
      return res.status(200).json({ ok: true, state: item.state, marketWatchItem: item, message: "Actual fill recorded. Market Watch is using the actual fill price.", error: null });
    }
    const marketWatch = await loadLocalMarketWatch();
    return res.status(200).json({
      ok: true,
      watchlist: WATCHLIST,
      marketWatch: marketWatch.marketWatch,
      count: WATCHLIST.length,
      updatedAt: new Date().toISOString(),
      error: null,
    });
  } catch (error) {
    return res.status(400).json({ ok: false, watchlist: WATCHLIST, error: error.message || "Market Watch update failed." });
  }
}
