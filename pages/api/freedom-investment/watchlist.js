import { addInvestmentWatchlistItem, loadInvestmentStore } from "../../../lib/freedom-investment/localStore.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const store = await loadInvestmentStore();
      return res.status(200).json({ ok: true, watchlist: store.watchlist, error: null });
    }
    if (req.method === "POST") {
      const item = await addInvestmentWatchlistItem(req.body || {});
      return res.status(200).json({ ok: true, item, error: null });
    }
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  } catch (error) {
    return res.status(400).json({ ok: false, error: error?.message || "Watchlist update failed." });
  }
}
