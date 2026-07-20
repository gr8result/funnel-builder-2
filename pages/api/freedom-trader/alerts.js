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

function errorMessage(error, fallback) {
  if (error?.message) return error.message;
  if (typeof error === "string") return error;
  return fallback;
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

function normalizeAlert(row) {
  const currentPrice = cleanNumber(row.last_checked_price);
  const triggerPrice = cleanNumber(row.trigger_price);
  return {
    id: row.id,
    symbol: row.symbol,
    alertType: row.alert_type,
    triggerPrice,
    direction: row.direction,
    message: row.message || "",
    priority: row.priority || "normal",
    status: row.status || "active",
    currentPrice,
    distance: Number.isFinite(currentPrice) && Number.isFinite(triggerPrice) && currentPrice !== 0
      ? Number((((triggerPrice - currentPrice) / currentPrice) * 100).toFixed(2))
      : null,
    triggeredAt: row.triggered_at,
    acknowledgedAt: row.acknowledged_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listAlerts(req, res) {
  const supabase = getSupabase();
  if (!supabase) return res.status(200).json({ ok: true, alerts: [], databaseUnavailable: true, error: null });
  try {
    const { data, error } = await supabase.from("freedom_trader_alerts").select("*").order("created_at", { ascending: false });
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
  const symbol = String(req.body?.symbol || "").trim().toUpperCase();
  const alertType = String(req.body?.alertType || "").trim().toUpperCase();
  const triggerPrice = cleanNumber(req.body?.triggerPrice);
  const direction = req.body?.direction ? String(req.body.direction).trim().toLowerCase() : null;
  const priority = req.body?.priority ? String(req.body.priority).trim().toLowerCase() : "normal";

  if (!symbol || !alertType) return failure(res, 400, "Symbol and alert type are required.");
  if (!Number.isFinite(triggerPrice)) return failure(res, 400, "A valid trigger price is required.");

  const payload = {
    symbol,
    alert_type: alertType,
    trigger_price: triggerPrice,
    direction,
    message: req.body?.message || `${alertType} alert for ${symbol}. Review manually; no trade is executed automatically.`,
    priority,
    status: "active",
  };
  if (req.body?.positionId) payload.position_id = req.body.positionId;

  try {
    await ensureWatchlistSymbol(supabase, symbol, req.body?.companyName);
    const { data, error } = await supabase.from("freedom_trader_alerts").insert(payload).select("*").single();
    if (error) {
      const message = errorMessage(error, "Unable to save alert right now.");
      console.error("Freedom Trader alert insert failed", { error, payload });
      return failure(res, 500, message);
    }
    return res.status(200).json({ ok: true, alert: normalizeAlert(data), error: null });
  } catch (error) {
    const message = errorMessage(error, "Unable to save alert right now.");
    console.error("Freedom Trader alert create failed:", { error, payload });
    return failure(res, 500, message);
  }
}

async function createAlertBatch(req, res, supabase) {
  const alerts = req.body.alerts
    .map((alert) => ({
      symbol: String(alert?.symbol || req.body?.symbol || "").trim().toUpperCase(),
      companyName: alert?.companyName || req.body?.companyName || null,
      alertType: String(alert?.alertType || "").trim().toUpperCase(),
      triggerPrice: cleanNumber(alert?.triggerPrice),
      direction: alert?.direction ? String(alert.direction).trim().toLowerCase() : null,
      priority: alert?.priority ? String(alert.priority).trim().toLowerCase() : "normal",
      message: alert?.message || null,
    }))
    .filter((alert) => alert.symbol && alert.alertType && Number.isFinite(alert.triggerPrice));

  if (!alerts.length) return failure(res, 400, "Provide at least one valid alert.");

  try {
    await Promise.all([...new Set(alerts.map((alert) => alert.symbol))].map((symbol) => {
      const alert = alerts.find((item) => item.symbol === symbol);
      return ensureWatchlistSymbol(supabase, symbol, alert?.companyName);
    }));
    const rows = alerts.map((alert) => ({
      symbol: alert.symbol,
      alert_type: alert.alertType,
      trigger_price: alert.triggerPrice,
      direction: alert.direction,
      message: alert.message || `${alert.alertType} alert for ${alert.symbol}. Review manually; no trade is executed automatically.`,
      priority: alert.priority,
      status: "active",
    }));
    const { data, error } = await supabase.from("freedom_trader_alerts").insert(rows).select("*");
    if (error) {
      const message = errorMessage(error, "Unable to save alerts right now.");
      console.error("Freedom Trader batch alert insert failed", { error, rows });
      return failure(res, 500, message);
    }
    return res.status(200).json({ ok: true, alerts: (data || []).map(normalizeAlert), error: null });
  } catch (error) {
    const message = errorMessage(error, "Unable to save alerts right now.");
    console.error("Freedom Trader batch alert create failed:", error);
    return failure(res, 500, message);
  }
}

async function updateAlert(req, res) {
  const supabase = getSupabase();
  if (!supabase) return res.status(503).json({ ok: false, error: "Alerts database temporarily unavailable." });
  const id = req.body?.id;
  const action = req.body?.action;
  if (!id) return res.status(400).json({ ok: false, error: "Missing alert id." });
  try {
    const payload = { updated_at: new Date().toISOString() };
    if (action === "acknowledge") {
      payload.status = "acknowledged";
      payload.acknowledged_at = new Date().toISOString();
    } else if (action === "disable") {
      payload.status = "disabled";
    } else if (req.body?.status) {
      payload.status = req.body.status;
    }
    const { data, error } = await supabase.from("freedom_trader_alerts").update(payload).eq("id", id).select("*").single();
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
    const { error } = await supabase.from("freedom_trader_alerts").delete().eq("id", id);
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
