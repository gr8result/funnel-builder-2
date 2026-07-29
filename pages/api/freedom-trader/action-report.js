import { createSupabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { developmentOwnerId } from "../../../lib/freedom-trader/paperTrading.js";
import { DEFAULT_REPORT_SETTINGS, generateFreedomTraderReport } from "../../../lib/freedom-trader/actionReport.js";

function getSupabase() {
  try {
    return createSupabaseAdmin();
  } catch (error) {
    console.error("Freedom Trader report Supabase unavailable:", error);
    return null;
  }
}

function rowToReport(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    reportType: row.report_type,
    generatedAt: row.generated_at,
    marketDataTimestamp: row.market_data_timestamp,
    marketDataQuality: row.market_data_quality,
    recommendations: row.recommendations || [],
    positionActions: row.position_actions || [],
    orderInstructions: row.order_instructions || {},
    settings: row.settings || DEFAULT_REPORT_SETTINGS,
    summary: row.summary || null,
    overallInstruction: row.overall_instruction,
    greeting: "Hi Grant — here are your best options right now.",
  };
}

async function saveReport(supabase, report) {
  const reportRow = {
    user_id: report.userId,
    report_type: report.reportType,
    generated_at: report.generatedAt,
    market_data_timestamp: report.marketDataTimestamp || null,
    market_data_quality: report.marketDataQuality,
    recommendations: report.recommendations,
    position_actions: report.positionActions,
    order_instructions: report.orderInstructions,
    settings: report.settings,
    summary: report.summary,
    overall_instruction: report.overallInstruction,
  };
  const { data, error } = await supabase.from("freedom_trader_reports").insert(reportRow).select("*").single();
  if (error) throw error;

  const alerts = (report.actionAlerts || []).map((alert) => ({
    user_id: alert.userId,
    symbol: alert.symbol || null,
    action: alert.action,
    message: alert.message,
    trigger_price: alert.triggerPrice || null,
    created_at: alert.createdAt,
  }));
  if (alerts.length) {
    const { error: alertError } = await supabase.from("freedom_action_alerts").insert(alerts);
    if (alertError) throw alertError;
  }
  return rowToReport(data);
}

async function getLatestReport(req, res, supabase, userId) {
  if (!supabase) return res.status(200).json({ ok: true, report: null, alerts: [], databaseUnavailable: true, error: null });
  try {
    const reportType = ["now", "morning", "evening"].includes(req.query.reportType) ? req.query.reportType : "now";
    const [{ data: reportRows, error: reportError }, { data: alertRows, error: alertError }] = await Promise.all([
      supabase.from("freedom_trader_reports").select("*").eq("user_id", userId).eq("report_type", reportType).order("generated_at", { ascending: false }).limit(1),
      supabase.from("freedom_action_alerts").select("*").eq("user_id", userId).is("acknowledged_at", null).order("created_at", { ascending: false }).limit(20),
    ]);
    if (reportError) throw reportError;
    if (alertError) throw alertError;
    return res.status(200).json({
      ok: true,
      report: rowToReport(reportRows?.[0]),
      alerts: (alertRows || []).map((row) => ({
        id: row.id,
        userId: row.user_id,
        symbol: row.symbol,
        action: row.action,
        message: row.message,
        triggerPrice: row.trigger_price,
        createdAt: row.created_at,
        acknowledgedAt: row.acknowledged_at,
      })),
      databaseUnavailable: false,
      error: null,
    });
  } catch (error) {
    console.error("Freedom Trader report load failed:", error);
    return res.status(200).json({ ok: true, report: null, alerts: [], databaseUnavailable: true, error: "Report database temporarily unavailable. Run supabase/migrations/20260729_freedom_trader_action_reports.sql if this is the first run." });
  }
}

export default async function handler(req, res) {
  const userId = developmentOwnerId(req);
  const supabase = getSupabase();

  if (req.method === "GET") return getLatestReport(req, res, supabase, userId);

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  const reportType = ["now", "morning", "evening"].includes(req.body?.reportType) ? req.body.reportType : "now";
  const report = generateFreedomTraderReport({
    reportType,
    userId,
    scannerRows: Array.isArray(req.body?.scannerRows) ? req.body.scannerRows : [],
    positions: Array.isArray(req.body?.positions) ? req.body.positions : [],
    pendingOrders: Array.isArray(req.body?.pendingOrders) ? req.body.pendingOrders : [],
    trades: Array.isArray(req.body?.trades) ? req.body.trades : [],
    settings: req.body?.settings || {},
  });

  if (!supabase) {
    return res.status(200).json({
      ok: true,
      report,
      alerts: report.actionAlerts,
      databaseUnavailable: true,
      persistenceError: "Report generated, but Supabase is unavailable so it was not saved.",
      error: null,
    });
  }

  try {
    const savedReport = await saveReport(supabase, report);
    return res.status(200).json({ ok: true, report: savedReport, alerts: report.actionAlerts, databaseUnavailable: false, error: null });
  } catch (error) {
    console.error("Freedom Trader report save failed:", error);
    return res.status(200).json({
      ok: true,
      report,
      alerts: report.actionAlerts,
      databaseUnavailable: true,
      persistenceError: "Report generated, but it could not be saved. Run supabase/migrations/20260729_freedom_trader_action_reports.sql if this is the first run.",
      error: null,
    });
  }
}
