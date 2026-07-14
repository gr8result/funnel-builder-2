import { loadStoredAnalysis, serializeStoredResearch } from "../../../lib/freedom-terminal/analysisEngine";
import { normalizeTicker, supabaseAdmin } from "../../../lib/freedom-terminal/core";

function getSymbol(req) {
  return normalizeTicker(
    Array.isArray(req.query.symbol)
      ? req.query.symbol[0]
      : Array.isArray(req.query.ticker)
        ? req.query.ticker[0]
        : req.query.symbol || req.query.ticker || req.body?.symbol || req.body?.ticker
  );
}

function isValidSymbol(symbol) {
  return /^[A-Z0-9.\-]{1,12}$/.test(symbol);
}

function publicResearchError(statusCode = 500) {
  return {
    statusCode,
    payload: {
      ok: false,
      error: "Research data unavailable.",
    },
  };
}

async function saveManualResearch(symbol, body) {
  const analysis = await loadStoredAnalysis(symbol);
  if (!analysis?.company?.id) {
    const error = new Error("Run Refresh Analysis before saving manual research notes for this company.");
    error.statusCode = 409;
    throw error;
  }

  const { error } = await supabaseAdmin.from("freedom_research").upsert(
    {
      company_id: analysis.company.id,
      business_summary: String(body.businessSummary || "").trim(),
      investment_thesis: String(body.thesis || body.investmentThesis || "").trim(),
      why_we_like_it: String(body.whyWeLikeIt || "").trim(),
      competitive_advantage: String(body.competitiveAdvantage || body.whyWeLikeIt || "").trim(),
      key_risks: String(body.keyRisks || "").trim(),
      bull_case: String(body.bullCase || "").trim(),
      bear_case: String(body.bearCase || "").trim(),
      research_status: "manual_reviewed",
      source_notes: String(body.sourceNotes || "Manual research note edited in Freedom Terminal.").trim(),
      last_updated: new Date().toISOString(),
    },
    { onConflict: "company_id" }
  );
  if (error) throw error;
  return loadStoredAnalysis(symbol);
}

export default async function handler(req, res) {
  try {
    const symbol = getSymbol(req);
    if (!isValidSymbol(symbol)) return res.status(400).json({ ok: false, error: "Provide a valid ticker query, such as MSFT." });

    if (req.method === "GET") {
      const analysis = await loadStoredAnalysis(symbol);
      return res.status(200).json({
        ok: Boolean(analysis?.research),
        note: serializeStoredResearch(symbol, analysis),
        analysis,
        error: analysis?.research ? null : "Research data unavailable.",
      });
    }

    if (req.method === "POST") {
      const analysis = await saveManualResearch(symbol, req.body || {});
      return res.status(200).json({
        ok: true,
        note: serializeStoredResearch(symbol, analysis),
        analysis,
      });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  } catch (error) {
    console.error("Freedom Terminal research error:", error);
    const safe = publicResearchError(error.statusCode || 500);
    return res.status(safe.statusCode).json(safe.payload);
  }
}
