import { loadStoredAnalysis, serializeStoredValuation } from "../../../lib/freedom-terminal/analysisEngine";
import { normalizeTicker } from "../../../lib/freedom-terminal/core";

function getSymbol(req) {
  return normalizeTicker(Array.isArray(req.query.symbol) ? req.query.symbol[0] : req.query.symbol || "MSFT");
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({
      ok: false,
      symbol: null,
      valuationRating: "UNKNOWN",
      assumptions: null,
      error: "Method not allowed.",
    });
  }

  const symbol = getSymbol(req);
  if (!/^[A-Z0-9.\-]{1,12}$/.test(symbol)) {
    return res.status(400).json({
      ok: false,
      symbol,
      valuationRating: "UNKNOWN",
      assumptions: null,
      error: "Provide a valid symbol query, such as MSFT.",
    });
  }

  try {
    const analysis = await loadStoredAnalysis(symbol);
    const valuation = serializeStoredValuation(symbol, analysis);
    if (!valuation) {
      return res.status(200).json({
        ok: false,
        symbol,
        fairValue: null,
        buyBelow: null,
        strongBuyBelow: null,
        expensiveAbove: null,
        marginOfSafety: null,
        expectedFiveYearReturn: null,
        valuationRating: "WATCH",
        assumptions: null,
        error: "Research data unavailable.",
      });
    }
    return res.status(200).json(valuation);
  } catch (error) {
    console.error("Freedom Terminal valuation error:", error);
    return res.status(error.statusCode || 500).json({
      ok: false,
      symbol,
      valuationRating: "UNKNOWN",
      assumptions: null,
      error: "Research data unavailable.",
    });
  }
}
