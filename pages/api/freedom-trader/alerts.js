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

function normalizeAlert(row) {
  const pending = row.pending_trade || row.pending_trades || {};
  const triggerPrice = cleanNumber(row.trigger_price);
  const alertType = row.alert_type || "";
  const upperType = alertType.toUpperCase();
  const direction = upperType.includes("STOP") ? "below" : "above";
  return {
    id: row.id,
    tradeId: row.trade_id,
    symbol: pending.ticker || row.ticker || "",
    alertType,
    triggerPrice,
    direction,
    message: `${alertType} alert for ${pending.ticker || "trade setup"}. Review manually; no trade is executed automatically.`,
    priority: "normal",
    status: row.triggered ? "triggered" : "active",
    currentPrice: null,
    distance: null,
    triggeredAt: row.triggered ? row.created_at : null,
    acknowledgedAt: null,
    createdAt: row.created_at,
    updatedAt: row.created_at,
  };
}

async function findOrCreatePendingTrade(supabase, alert) {
  if (alert.tradeId) {
    const { data, error } = await supabase.from("pending_trades").select("*").eq("id", alert.tradeId).single();
    if (error) throw error;
    return data;
  }

  const { data: existing, error: findError } = await supabase
    .from("pending_trades")
    .select("*")
    .eq("ticker", alert.symbol)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (findError) throw findError;
  if (existing?.id) return existing;

  const payload = {
    ticker: alert.symbol,
    entry_price: alert.alertType.includes("ENTRY") ? alert.triggerPrice : null,
    stop_loss: alert.alertType.includes("STOP") ? alert.triggerPrice : null,
    target_price: alert.alertType.includes("TARGET") ? alert.triggerPrice : null,
    shares: null,
    risk_reward: null,
    expected_profit: null,
    status: "WAIT FOR ENTRY",
    fib_data: null,
    created_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from("pending_trades").insert(payload).select("*").single();
  if (error) throw error;
  return data;
}

async function listAlerts(req, res) {
  const supabase = getSupabase();
  if (!supabase) return res.status(200).json({ ok: true, alerts: [], databaseUnavailable: true, error: null });
  try {
    const { data, error } = await supabase
      .from("trade_alerts")
      .select("*, pending_trade:pending_trades(*)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return res.status(200).json({ ok: true, alerts: (data || []).map(normalizeAlert), databaseUnavailable: false, error: null });
  } catch (error) {
    console.error("Freedom Trader alerts list failed:", error);
    return res.status(200).json({ ok: true, alerts: [], databaseUnavailable: true, error: "Alerts database temporarily unavailable." });
  }
}

async function createAlert(req, res) {
  const supabase = getSupabase();
  if (!supabase) return failure(res, 503, "Alerts database temporarily unavailable.");
  if (Array.isArray(req.body?.alerts)) return createAlertBatch(req, res, supabase);

  const alert = {
    tradeId: req.body?.tradeId || req.body?.pendingTradeId || null,
    symbol: String(req.body?.symbol || req.body?.ticker || "").trim().toUpperCase(),
    alertType: String(req.body?.alertType || "").trim().toUpperCase(),
    triggerPrice: cleanNumber(req.body?.triggerPrice),
  };
  if (!alert.symbol && !alert.tradeId) return failure(res, 400, "Ticker or trade id is required.");
  if (!alert.alertType) return failure(res, 400, "Alert type is required.");
  if (!Number.isFinite(alert.triggerPrice)) return failure(res, 400, "A valid trigger price is required.");

  try {
    const pendingTrade = await findOrCreatePendingTrade(supabase, alert);
    const payload = {
      trade_id: pendingTrade.id,
      alert_type: alert.alertType,
      trigger_price: alert.triggerPrice,
      triggered: false,
      created_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from("trade_alerts").insert(payload).select("*, pending_trade:pending_trades(*)").single();
    if (error) throw error;
    return res.status(200).json({ ok: true, alert: normalizeAlert(data), error: null });
  } catch (error) {
    console.error("Freedom Trader alert create failed:", { error, alert });
    return failure(res, 500, "Unable to save alert right now.");
  }
}

async function createAlertBatch(req, res, supabase) {
  const alerts = req.body.alerts
    .map((item) => ({
      tradeId: item?.tradeId || item?.pendingTradeId || req.body?.tradeId || req.body?.pendingTradeId || null,
      symbol: String(item?.symbol || req.body?.symbol || req.body?.ticker || "").trim().toUpperCase(),
      alertType: String(item?.alertType || "").trim().toUpperCase(),
      triggerPrice: cleanNumber(item?.triggerPrice),
    }))
    .filter((alert) => (alert.symbol || alert.tradeId) && alert.alertType && Number.isFinite(alert.triggerPrice));

  if (!alerts.length) return failure(res, 400, "Provide at least one valid alert.");

  try {
    const pendingByKey = new Map();
    const rows = [];
    for (const alert of alerts) {
      const key = alert.tradeId || alert.symbol;
      let pendingTrade = pendingByKey.get(key);
      if (!pendingTrade) {
        pendingTrade = await findOrCreatePendingTrade(supabase, alert);
        pendingByKey.set(key, pendingTrade);
      }
      rows.push({
        trade_id: pendingTrade.id,
        alert_type: alert.alertType,
        trigger_price: alert.triggerPrice,
        triggered: false,
        created_at: new Date().toISOString(),
      });
    }
    const { data, error } = await supabase.from("trade_alerts").insert(rows).select("*, pending_trade:pending_trades(*)");
    if (error) throw error;
    return res.status(200).json({ ok: true, alerts: (data || []).map(normalizeAlert), error: null });
  } catch (error) {
    console.error("Freedom Trader batch alert create failed:", { error, alerts });
    return failure(res, 500, "Unable to save alerts right now.");
  }
}

async function updateAlert(req, res) {
  const supabase = getSupabase();
  if (!supabase) return res.status(503).json({ ok: false, error: "Alerts database temporarily unavailable." });
  const id = req.body?.id;
  const action = req.body?.action;
  if (!id) return res.status(400).json({ ok: false, error: "Missing alert id." });
  try {
    const triggered = action === "acknowledge" || req.body?.status === "triggered";
    const { data, error } = await supabase
      .from("trade_alerts")
      .update({ triggered })
      .eq("id", id)
      .select("*, pending_trade:pending_trades(*)")
      .single();
    if (error) throw error;
    return res.status(200).json({ ok: true, alert: normalizeAlert(data), error: null });
  } catch (error) {
    console.error("Freedom Trader alert update failed:", error);
    return res.status(500).json({ ok: false, error: "Unable to update alert right now." });
  }
}

async function deleteAlert(req, res) {
  const supabase = getSupabase();
  if (!supabase) return res.status(503).json({ ok: false, error: "Alerts database temporarily unavailable." });
  const id = req.query.id || req.body?.id;
  if (!id) return res.status(400).json({ ok: false, error: "Missing alert id." });
  try {
    const { error } = await supabase.from("trade_alerts").delete().eq("id", id);
    if (error) throw error;
    return res.status(200).json({ ok: true, error: null });
  } catch (error) {
    console.error("Freedom Trader alert delete failed:", error);
    return res.status(500).json({ ok: false, error: "Unable to delete alert right now." });
  }
}

export default async function handler(req, res) {
  if (req.method === "GET") return listAlerts(req, res);
  if (req.method === "POST") return createAlert(req, res);
  if (req.method === "PATCH") return updateAlert(req, res);
  if (req.method === "DELETE") return deleteAlert(req, res);
  res.setHeader("Allow", "GET, POST, PATCH, DELETE");
  return res.status(405).json({ ok: false, error: "Method not allowed." });
}
