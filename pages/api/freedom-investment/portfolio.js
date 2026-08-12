import { loadInvestmentStore, upsertInvestmentHolding } from "../../../lib/freedom-investment/localStore.js";
import { fetchInvestmentCompanyData } from "../../../lib/freedom-investment/provider.js";
import { analyseInvestmentCandidate, portfolioSummary } from "../../../lib/freedom-investment/scoring.js";

export default async function handler(req, res) {
  try {
    if (req.method === "POST") {
      const holding = await upsertInvestmentHolding(req.body || {});
      return res.status(200).json({ ok: true, holding, error: null });
    }
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({ ok: false, error: "Method not allowed." });
    }
    const store = await loadInvestmentStore();
    const symbols = store.holdings.map((holding) => holding.symbol);
    const latest = await Promise.all(symbols.map(async (symbol) => {
      const source = await fetchInvestmentCompanyData({ symbol }).catch(() => ({ symbol, quote: {}, metrics: {}, profile: {} }));
      return analyseInvestmentCandidate(source);
    }));
    const summary = portfolioSummary(store.holdings, latest);
    return res.status(200).json({ ok: true, ...summary, settings: store.settings, error: null });
  } catch (error) {
    return res.status(400).json({ ok: false, error: error?.message || "Portfolio unavailable." });
  }
}
