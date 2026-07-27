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

function round(value, decimals = 2) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(decimals)) : null;
}

// Computes profit/loss, return % and R-multiple from the raw trade fields on
// every read, same as the previous filesystem-backed version -- these are
// never persisted, only derived, so they're always consistent with the
// stored inputs.
function enrichTrade(row) {
  const quantity = cleanNumber(row.quantity) || 0;
  const actualFillPrice = cleanNumber(row.actual_fill_price) || 0;
  const brokerageFees = cleanNumber(row.brokerage_fees) || 0;
  const closingPrice = cleanNumber(row.closing_price);
  const stopLoss = cleanNumber(row.stop_loss);
  const target = cleanNumber(row.target);
  const side = String(row.side || "buy").toLowerCase() === "sell" ? "sell" : "buy";
  const status = String(row.status || "open").toLowerCase() === "closed" ? "closed" : "open";
  const totalEntryValue = round(quantity * actualFillPrice);
  const totalExitValue = Number.isFinite(closingPrice) ? round(quantity * closingPrice) : null;
  const rawProfit = Number.isFinite(totalExitValue) ? (side === "buy" ? totalExitValue - totalEntryValue : totalEntryValue - totalExitValue) : null;
  const realisedProfitLoss = status === "closed" && Number.isFinite(rawProfit) ? round(rawProfit - brokerageFees) : null;
  const unrealisedProfitLoss = status !== "closed" && Number.isFinite(closingPrice) ? round((side === "buy" ? closingPrice - actualFillPrice : actualFillPrice - closingPrice) * quantity - brokerageFees) : null;
  const returnPercent = Number.isFinite(realisedProfitLoss) && totalEntryValue ? round((realisedProfitLoss / totalEntryValue) * 100) : Number.isFinite(unrealisedProfitLoss) && totalEntryValue ? round((unrealisedProfitLoss / totalEntryValue) * 100) : null;
  const riskPerShare = Number.isFinite(stopLoss) ? Math.abs(actualFillPrice - stopLoss) : null;
  const rewardPerShare = Number.isFinite(target) ? Math.abs(target - actualFillPrice) : null;

  return {
    id: row.id,
    broker: row.broker || "",
    ticker: row.ticker,
    company: row.company || "",
    exchange: row.exchange || "",
    currency: row.currency || "USD",
    side,
    tradeDateTime: row.trade_date_time,
    quantity,
    actualFillPrice,
    brokerageFees,
    stopLoss,
    target,
    status,
    closingPrice,
    closingDate: row.closing_date || "",
    exitReason: row.exit_reason || "",
    notes: row.notes || "",
    documentReference: row.document_reference || "",
    pendingTradeId: row.pending_trade_id || null,
    openPositionId: row.open_position_id || null,
    totalEntryValue,
    totalExitValue,
    realisedProfitLoss,
    unrealisedProfitLoss,
    returnPercent,
    totalFees: round(brokerageFees),
    riskRewardAchieved: Number.isFinite(riskPerShare) && riskPerShare > 0 && Number.isFinite(rewardPerShare) ? round(rewardPerShare / riskPerShare) : null,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}

function toColumns(input) {
  const columns = {};
  if ("broker" in input) columns.broker = input.broker || null;
  if ("ticker" in input) columns.ticker = String(input.ticker || "").trim().toUpperCase();
  if ("company" in input) columns.company = input.company || null;
  if ("exchange" in input) columns.exchange = input.exchange || null;
  if ("currency" in input) columns.currency = input.currency || "USD";
  if ("side" in input) columns.side = String(input.side || "buy").toLowerCase() === "sell" ? "sell" : "buy";
  if ("tradeDateTime" in input) columns.trade_date_time = input.tradeDateTime || new Date().toISOString();
  if ("quantity" in input) columns.quantity = cleanNumber(input.quantity);
  if ("actualFillPrice" in input) columns.actual_fill_price = cleanNumber(input.actualFillPrice);
  if ("brokerageFees" in input) columns.brokerage_fees = cleanNumber(input.brokerageFees) || 0;
  if ("stopLoss" in input) columns.stop_loss = cleanNumber(input.stopLoss);
  if ("target" in input) columns.target = cleanNumber(input.target);
  if ("status" in input) columns.status = String(input.status || "open").toLowerCase() === "closed" ? "closed" : "open";
  if ("closingPrice" in input) columns.closing_price = cleanNumber(input.closingPrice);
  if ("closingDate" in input) columns.closing_date = input.closingDate || null;
  if ("exitReason" in input) columns.exit_reason = input.exitReason || null;
  if ("notes" in input) columns.notes = input.notes || null;
  if ("documentReference" in input) columns.document_reference = input.documentReference || null;
  if ("pendingTradeId" in input) columns.pending_trade_id = input.pendingTradeId || null;
  if ("openPositionId" in input) columns.open_position_id = input.openPositionId || null;
  return columns;
}

export default async function handler(req, res) {
  const supabase = getSupabase();
  if (!supabase) return res.status(200).json({ ok: true, trades: [], databaseUnavailable: true, error: null });

  if (req.method === "GET") {
    try {
      const { data, error } = await supabase.from("trade_journal").select("*").order("trade_date_time", { ascending: false });
      if (error) throw error;
      return res.status(200).json({ ok: true, trades: (data || []).map(enrichTrade), databaseUnavailable: false });
    } catch (error) {
      console.error("Freedom Trader trade journal list failed:", error);
      return res.status(200).json({ ok: true, trades: [], databaseUnavailable: true, error: "Trade journal database temporarily unavailable. Run the trade_journal migration (supabase/migrations/20260727_freedom_trader_trade_journal.sql) if this is the first run." });
    }
  }

  if (req.method === "POST") {
    const columns = toColumns(req.body || {});
    if (!columns.ticker || !columns.quantity || !columns.actual_fill_price) {
      return res.status(400).json({ ok: false, error: "Ticker, quantity and actual fill price are required." });
    }
    try {
      const { data, error } = await supabase.from("trade_journal").insert(columns).select("*").single();
      if (error) throw error;
      return res.status(200).json({ ok: true, trade: enrichTrade(data) });
    } catch (error) {
      console.error("Freedom Trader trade journal create failed:", error);
      return res.status(500).json({ ok: false, error: "Unable to save trade journal entry right now." });
    }
  }

  if (req.method === "PATCH") {
    const id = req.body?.id;
    if (!id) return res.status(400).json({ ok: false, error: "Missing trade id." });
    const columns = toColumns(req.body || {});
    try {
      const { data, error } = await supabase.from("trade_journal").update(columns).eq("id", id).select("*").single();
      if (error) throw error;
      return res.status(200).json({ ok: true, trade: enrichTrade(data) });
    } catch (error) {
      console.error("Freedom Trader trade journal update failed:", error);
      return res.status(500).json({ ok: false, error: "Unable to update trade journal entry right now." });
    }
  }

  res.setHeader("Allow", "GET, POST, PATCH");
  return res.status(405).json({ ok: false, error: "Method not allowed." });
}
