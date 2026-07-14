import { loadStoredAnalysis, serializeStoredCommittee } from "../../../lib/freedom-terminal/analysisEngine";
import { normalizeTicker } from "../../../lib/freedom-terminal/core";

function getSymbol(req) {
  return normalizeTicker(Array.isArray(req.query.symbol) ? req.query.symbol[0] : req.query.symbol || "MSFT");
}

function emptyCommittee(symbol, error = "Research data unavailable.") {
  return {
    ok: false,
    symbol,
    overallDecision: "WATCH",
    committeeScore: null,
    confidence: null,
    healthScore: null,
    analysts: [],
    finalSummary: error,
    error,
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json(emptyCommittee(null, "Method not allowed."));
  }

  const symbol = getSymbol(req);
  if (!/^[A-Z0-9.\-]{1,12}$/.test(symbol)) {
    return res.status(400).json(emptyCommittee(symbol, "Provide a valid symbol query, such as MSFT."));
  }

  try {
    const analysis = await loadStoredAnalysis(symbol);
    const committee = serializeStoredCommittee(symbol, analysis);
    return res.status(200).json(committee ? { ok: true, ...committee } : emptyCommittee(symbol));
  } catch (error) {
    console.error("Freedom Terminal committee error:", error);
    return res.status(error.statusCode || 500).json(emptyCommittee(symbol));
  }
}
