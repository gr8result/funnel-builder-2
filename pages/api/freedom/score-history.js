import { buildCalibrationSummary, DEFAULT_CALIBRATION } from "../../../lib/freedom-terminal/adaptiveBuyScore";
import { createSupabaseAdmin } from "../../../lib/supabaseAdmin";

function unavailableResponse(res, extra = {}) {
  return res.status(200).json({
    ok: true,
    databaseAvailable: false,
    history: [],
    calibration: DEFAULT_CALIBRATION,
    review: buildCalibrationSummary([]),
    message: "Score history database unavailable. Live scoring remains active.",
    ...extra,
  });
}

function normalizeHistoryRow(row) {
  return {
    id: row.id,
    company: row.company,
    symbol: row.symbol,
    date: row.recommendation_date || row.date || row.created_at,
    buyScore: row.buy_score,
    conviction: row.conviction_score,
    decision: row.decision,
    currentPrice: row.current_price,
    fairValue: row.fair_value,
    reason: row.reason,
    scoreDetails: row.score_details || null,
    sixMonthReturn: row.six_month_return,
    oneYearReturn: row.one_year_return,
    twoYearReturn: row.two_year_return,
    accuracy: row.accuracy,
  };
}

async function getSupabase() {
  try {
    return createSupabaseAdmin();
  } catch (error) {
    console.error("Freedom score history unavailable:", error);
    return null;
  }
}

async function handleGet(req, res) {
  const supabase = await getSupabase();
  if (!supabase) return unavailableResponse(res);

  try {
    const symbol = String(req.query.symbol || "").trim().toUpperCase();
    let query = supabase
      .from("freedom_score_history")
      .select("*")
      .order("recommendation_date", { ascending: false })
      .limit(250);

    if (symbol) query = query.eq("symbol", symbol);

    const [historyResult, calibrationResult] = await Promise.all([
      query,
      supabase
        .from("freedom_score_calibration")
        .select("*")
        .eq("active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (historyResult.error) throw historyResult.error;

    const history = (historyResult.data || []).map(normalizeHistoryRow);
    const calibration = calibrationResult.error ? DEFAULT_CALIBRATION : calibrationResult.data?.weights || DEFAULT_CALIBRATION;

    return res.status(200).json({
      ok: true,
      databaseAvailable: true,
      history,
      calibration,
      review: buildCalibrationSummary(historyResult.data || []),
      message: null,
    });
  } catch (error) {
    console.error("Freedom score history load failed:", error);
    return unavailableResponse(res);
  }
}

async function handlePost(req, res) {
  const supabase = await getSupabase();
  if (!supabase) {
    return res.status(200).json({
      ok: true,
      stored: false,
      message: "Score history database unavailable. Recommendation was not stored.",
    });
  }

  try {
    const body = req.body || {};
    const symbol = String(body.symbol || "").trim().toUpperCase();
    const company = String(body.company || symbol || "").trim();
    if (!symbol || !company) return res.status(400).json({ ok: false, error: "Symbol and company are required." });

    const row = {
      company,
      symbol,
      recommendation_date: body.date || new Date().toISOString(),
      buy_score: Number(body.buyScore),
      conviction_score: Number(body.convictionScore ?? body.conviction),
      decision: String(body.decision || "").trim().toUpperCase(),
      current_price: Number.isFinite(Number(body.currentPrice)) ? Number(body.currentPrice) : null,
      fair_value: Number.isFinite(Number(body.fairValue)) ? Number(body.fairValue) : null,
      reason: String(body.reason || "").trim(),
      score_details: body.scoreDetails || null,
    };

    if (!Number.isFinite(row.buy_score) || !Number.isFinite(row.conviction_score) || !row.decision) {
      return res.status(400).json({ ok: false, error: "Buy score, conviction score and decision are required." });
    }

    const { error } = await supabase.from("freedom_score_history").insert(row);
    if (error) throw error;

    return res.status(200).json({ ok: true, stored: true });
  } catch (error) {
    console.error("Freedom score history save failed:", error);
    return res.status(200).json({
      ok: true,
      stored: false,
      message: "Score history database unavailable. Recommendation was not stored.",
    });
  }
}

async function handlePut(req, res) {
  const supabase = await getSupabase();
  if (!supabase) {
    return res.status(200).json({
      ok: true,
      stored: false,
      calibration: req.body?.weights || DEFAULT_CALIBRATION,
      message: "Score calibration database unavailable. Local weights remain usable.",
    });
  }

  try {
    const weights = req.body?.weights || DEFAULT_CALIBRATION;
    const { error } = await supabase.from("freedom_score_calibration").insert({
      active: true,
      weights,
      notes: String(req.body?.notes || "Manual calibration adjustment").slice(0, 500),
    });
    if (error) throw error;
    return res.status(200).json({ ok: true, stored: true, calibration: weights });
  } catch (error) {
    console.error("Freedom score calibration save failed:", error);
    return res.status(200).json({
      ok: true,
      stored: false,
      calibration: req.body?.weights || DEFAULT_CALIBRATION,
      message: "Score calibration database unavailable. Local weights remain usable.",
    });
  }
}

export default async function handler(req, res) {
  if (req.method === "GET") return handleGet(req, res);
  if (req.method === "POST") return handlePost(req, res);
  if (req.method === "PUT") return handlePut(req, res);
  res.setHeader("Allow", "GET, POST, PUT");
  return res.status(405).json({ ok: false, error: "Method not allowed." });
}
