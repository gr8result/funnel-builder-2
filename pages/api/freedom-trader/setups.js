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

async function ensureWatchlistSymbol(supabase, symbol, companyName = null) {
  const { error } = await supabase
    .from("freedom_trader_watchlist")
    .upsert({
      symbol,
      company_name: companyName || symbol,
      exchange: "NASDAQ",
      active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "symbol" });
  if (error) throw error;
}

function normalizeSetup(row) {
  return {
    id: row.id,
    symbol: row.symbol,
    setupType: row.setup_type,
    tradingScore: cleanNumber(row.trading_score),
    trend: row.trend,
    entryPrice: cleanNumber(row.entry_price),
    targetPrice: cleanNumber(row.target_price),
    stopPrice: cleanNumber(row.stop_price),
    supportPrice: cleanNumber(row.support_price),
    resistancePrice: cleanNumber(row.resistance_price),
    riskRewardRatio: cleanNumber(row.risk_reward_ratio),
    expectedHoldingDays: row.expected_holding_days,
    confidence: cleanNumber(row.confidence),
    status: row.status,
    reasoning: row.reasoning,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function saveSetup(req, res) {
  const supabase = getSupabase();
  if (!supabase) return failure(res, 503, "Trade setup database temporarily unavailable.");

  const symbol = String(req.body?.symbol || "").trim().toUpperCase();
  const entryPrice = cleanNumber(req.body?.entryPrice);
  const targetPrice = cleanNumber(req.body?.targetPrice);
  const stopPrice = cleanNumber(req.body?.stopPrice);
  const riskRewardRatio = cleanNumber(req.body?.riskRewardRatio);

  if (!symbol) return failure(res, 400, "Symbol is required.");
  if (!entryPrice || entryPrice <= 0) return failure(res, 400, "Entry price is required.");
  if (!targetPrice || targetPrice <= entryPrice) return failure(res, 400, "Target must be above entry.");
  if (!stopPrice || stopPrice >= entryPrice) return failure(res, 400, "Stop loss must be below entry.");

  const payload = {
    symbol,
    setup_type: req.body?.setupType || "Chart trade setup",
    trading_score: cleanNumber(req.body?.tradingScore),
    trend: req.body?.trend || null,
    entry_price: entryPrice,
    target_price: targetPrice,
    stop_price: stopPrice,
    support_price: cleanNumber(req.body?.supportPrice),
    resistance_price: cleanNumber(req.body?.resistancePrice),
    risk_reward_ratio: riskRewardRatio,
    expected_holding_days: cleanNumber(req.body?.expectedHoldingDays),
    confidence: cleanNumber(req.body?.confidence),
    status: req.body?.status || "WAIT FOR ENTRY",
    reasoning: req.body?.reasoning || "Saved from Freedom Trader chart. No broker trade was placed.",
    expires_at: req.body?.expiresAt || null,
    updated_at: new Date().toISOString(),
  };

  try {
    await ensureWatchlistSymbol(supabase, symbol, req.body?.companyName);
    const { data, error } = await supabase
      .from("freedom_trader_setups")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw error;
    return res.status(200).json({ ok: true, setup: normalizeSetup(data), error: null });
  } catch (error) {
    console.error("Freedom Trader setup save failed:", { error, payload });
    return failure(res, 500, error?.message || "Unable to save trade setup right now.");
  }
}

export default async function handler(req, res) {
  if (req.method === "POST") return saveSetup(req, res);
  res.setHeader("Allow", "POST");
  return res.status(405).json({ ok: false, error: "Method not allowed." });
}
