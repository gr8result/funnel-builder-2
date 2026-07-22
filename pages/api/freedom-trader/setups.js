import { createSupabaseAdmin } from "../../../lib/supabaseAdmin";

function getSupabase() {
  try {
    return createSupabaseAdmin();
  } catch (error) {
    console.error("Freedom Trader Supabase unavailable:", error);
    return null;
  }
}

function cleanNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function failure(res, status, error) {
  return res.status(status).json({ ok: false, error });
}

function normalizeSetup(row) {
  return {
    id: row.id,
    symbol: row.ticker,
    ticker: row.ticker,
    setupType: "Chart trade setup",
    tradingScore: null,
    trend: null,
    entryPrice: cleanNumber(row.entry_price),
    targetPrice: cleanNumber(row.target_price),
    stopPrice: cleanNumber(row.stop_loss),
    supportPrice: null,
    resistancePrice: null,
    riskRewardRatio: cleanNumber(row.risk_reward),
    expectedProfit: cleanNumber(row.expected_profit),
    expectedHoldingDays: null,
    confidence: null,
    status: row.status,
    reasoning: "Saved from Freedom Trader chart. No broker trade was placed.",
    fibData: row.fib_data,
    createdAt: row.created_at,
    updatedAt: row.created_at,
  };
}

async function listSetups(req, res) {
  const supabase = getSupabase();
  if (!supabase) return res.status(200).json({ ok: true, setups: [], databaseUnavailable: true, error: null });

  try {
    const { data, error } = await supabase
      .from("pending_trades")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return res.status(200).json({ ok: true, setups: (data || []).map(normalizeSetup), databaseUnavailable: false, error: null });
  } catch (error) {
    console.error("Freedom Trader pending trades list failed:", error);
    return res.status(200).json({ ok: true, setups: [], databaseUnavailable: true, error: "Pending trades database temporarily unavailable." });
  }
}

async function saveSetup(req, res) {
  const supabase = getSupabase();
  if (!supabase) return failure(res, 503, "Trade setup database temporarily unavailable.");

  const symbol = String(req.body?.symbol || req.body?.ticker || "").trim().toUpperCase();
  const entryPrice = cleanNumber(req.body?.entryPrice);
  const targetPrice = cleanNumber(req.body?.targetPrice);
  const stopPrice = cleanNumber(req.body?.stopPrice ?? req.body?.stopLoss);
  const shares = cleanNumber(req.body?.shares ?? req.body?.quantity);
  const riskRewardRatio = cleanNumber(req.body?.riskRewardRatio ?? req.body?.riskReward);
  const expectedProfit = cleanNumber(req.body?.expectedProfit);

  if (!symbol) return failure(res, 400, "Ticker is required.");
  if (!entryPrice || entryPrice <= 0) return failure(res, 400, "Entry price is required.");
  if (!targetPrice || targetPrice <= entryPrice) return failure(res, 400, "Target must be above entry.");
  if (!stopPrice || stopPrice >= entryPrice) return failure(res, 400, "Stop loss must be below entry.");

  const payload = {
    user_id: req.body?.userId || null,
    ticker: symbol,
    entry_price: entryPrice,
    stop_loss: stopPrice,
    target_price: targetPrice,
    shares,
    risk_reward: riskRewardRatio,
    expected_profit: expectedProfit,
    status: req.body?.status || "WAIT FOR ENTRY",
    fib_data: req.body?.fibData || null,
    created_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from("pending_trades")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw error;
    return res.status(200).json({ ok: true, setup: normalizeSetup(data), pendingTrade: normalizeSetup(data), error: null });
  } catch (error) {
    console.error("Freedom Trader pending trade save failed:", { error, payload });
    return failure(res, 500, "Unable to save trade setup right now.");
  }
}

export default async function handler(req, res) {
  if (req.method === "GET") return listSetups(req, res);
  if (req.method === "POST") return saveSetup(req, res);
  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ ok: false, error: "Method not allowed." });
}
