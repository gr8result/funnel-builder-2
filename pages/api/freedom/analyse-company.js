import { ANALYSIS_STAGES, analyseCompany } from "../../../lib/freedom-terminal/analysisEngine";

function getSymbol(req) {
  return String(req.body?.symbol || req.body?.ticker || "").trim().toUpperCase();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      ok: false,
      stages: ["validating"],
      currentStage: "validating",
      error: "Method not allowed.",
    });
  }

  const symbol = getSymbol(req);

  try {
    const result = await analyseCompany(symbol);
    return res.status(200).json({
      ...result,
      stages: ANALYSIS_STAGES,
      currentStage: "completed",
    });
  } catch (error) {
    console.error("Freedom Terminal analyse-company error:", error);
    return res.status(error.statusCode || 500).json({
      ok: false,
      symbol,
      stages: ANALYSIS_STAGES,
      currentStage: "saving",
      error: "Research data unavailable.",
    });
  }
}
