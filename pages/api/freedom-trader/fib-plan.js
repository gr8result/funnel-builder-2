import { createSupabaseAdmin } from "../../../lib/supabaseAdmin";

function getSupabase() {
  try {
    return createSupabaseAdmin();
  } catch (error) {
    console.error("Freedom Trader Supabase unavailable:", error);
    return null;
  }
}

function getBearerToken(req) {
  const header = String(req.headers.authorization || req.headers.Authorization || "").trim();
  if (!header.toLowerCase().startsWith("bearer ")) return "";
  return header.slice(7).trim();
}

async function requireUserId(req, res, supabase) {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ ok: false, error: "Sign in to save Fib trade plans to your account." });
    return null;
  }
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.id) {
    res.status(401).json({ ok: false, error: "Authentication failed." });
    return null;
  }
  return data.user.id;
}

function cleanNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeSymbol(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeLevel(level) {
  if (!level || !Number.isFinite(Number(level.price))) return null;
  const source = ["analysis", "fib-auto", "fib-manual", "custom"].includes(level.source) ? level.source : "custom";
  return { price: cleanNumber(level.price), fibLevel: Number.isFinite(Number(level.fibLevel)) ? Number(level.fibLevel) : null, source };
}

function normalizeAssignments(assignments = {}) {
  return {
    entry: normalizeLevel(assignments.entry),
    stopLoss: normalizeLevel(assignments.stopLoss),
    target1: normalizeLevel(assignments.target1),
    target2: normalizeLevel(assignments.target2),
  };
}

function rowToPlan(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    symbol: row.symbol,
    opportunityId: row.opportunity_id,
    direction: row.direction === "bearish" ? "bearish" : "bullish",
    anchors: {
      start: { timestamp: row.anchor_start_timestamp, price: cleanNumber(row.anchor_start_price) },
      end: { timestamp: row.anchor_end_timestamp, price: cleanNumber(row.anchor_end_price) },
    },
    showExtensions: Boolean(row.show_extensions),
    assignments: normalizeAssignments(row.assignments || {}),
    minimumRiskReward: cleanNumber(row.minimum_risk_reward) ?? 2,
    calculatedRiskReward: cleanNumber(row.calculated_risk_reward),
    analysisGeneratedAt: row.analysis_generated_at,
    marketDataTimestamp: row.market_data_timestamp,
    analysisVersion: row.analysis_version,
    migratedFromLocalStorage: Boolean(row.migrated_from_local_storage),
    updatedAt: row.updated_at,
  };
}

function planToRow(userId, symbol, plan) {
  return {
    user_id: userId,
    symbol,
    opportunity_id: plan.opportunityId || null,
    direction: plan.direction === "bearish" ? "bearish" : "bullish",
    anchor_start_timestamp: plan.anchors?.start?.timestamp != null ? String(plan.anchors.start.timestamp) : null,
    anchor_start_price: cleanNumber(plan.anchors?.start?.price),
    anchor_end_timestamp: plan.anchors?.end?.timestamp != null ? String(plan.anchors.end.timestamp) : null,
    anchor_end_price: cleanNumber(plan.anchors?.end?.price),
    show_extensions: Boolean(plan.showExtensions),
    assignments: normalizeAssignments(plan.assignments || {}),
    minimum_risk_reward: cleanNumber(plan.minimumRiskReward) ?? 2,
    calculated_risk_reward: cleanNumber(plan.calculatedRiskReward),
    analysis_generated_at: plan.analysisGeneratedAt || null,
    market_data_timestamp: plan.marketDataTimestamp || null,
    analysis_version: plan.analysisVersion || null,
    migrated_from_local_storage: Boolean(plan.migratedFromLocalStorage),
    updated_at: new Date().toISOString(),
  };
}

export default async function handler(req, res) {
  const supabase = getSupabase();
  if (!supabase) return res.status(200).json({ ok: true, plan: null, databaseUnavailable: true, error: null });

  const userId = await requireUserId(req, res, supabase);
  if (!userId) return;

  const symbol = normalizeSymbol(req.method === "GET" || req.method === "DELETE" ? req.query.symbol : req.body?.symbol);
  if (!symbol) return res.status(400).json({ ok: false, error: "A symbol is required." });

  if (req.method === "GET") {
    try {
      const { data, error } = await supabase
        .from("freedom_trader_fib_plans")
        .select("*")
        .eq("user_id", userId)
        .eq("symbol", symbol)
        .maybeSingle();
      if (error) throw error;
      return res.status(200).json({ ok: true, plan: rowToPlan(data), databaseUnavailable: false, error: null });
    } catch (error) {
      console.error("Freedom Trader fib-plan load failed:", error);
      return res.status(200).json({ ok: true, plan: null, databaseUnavailable: true, error: "Fib plan database temporarily unavailable." });
    }
  }

  if (req.method === "POST") {
    const plan = req.body?.plan;
    if (!plan) return res.status(400).json({ ok: false, error: "A plan payload is required." });
    try {
      const row = planToRow(userId, symbol, plan);
      const { data, error } = await supabase
        .from("freedom_trader_fib_plans")
        .upsert(row, { onConflict: "user_id,symbol" })
        .select("*")
        .single();
      if (error) throw error;
      return res.status(200).json({ ok: true, plan: rowToPlan(data), error: null });
    } catch (error) {
      console.error("Freedom Trader fib-plan save failed:", error);
      return res.status(500).json({ ok: false, error: "Unable to save the Fib trade plan right now." });
    }
  }

  if (req.method === "DELETE") {
    try {
      const { error } = await supabase.from("freedom_trader_fib_plans").delete().eq("user_id", userId).eq("symbol", symbol);
      if (error) throw error;
      return res.status(200).json({ ok: true, error: null });
    } catch (error) {
      console.error("Freedom Trader fib-plan delete failed:", error);
      return res.status(500).json({ ok: false, error: "Unable to clear the Fib trade plan right now." });
    }
  }

  res.setHeader("Allow", "GET, POST, DELETE");
  return res.status(405).json({ ok: false, error: "Method not allowed." });
}
