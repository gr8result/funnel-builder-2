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

function daysBetween(start, end) {
  if (!start || !end) return null;
  return Math.max(0, Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 86400000));
}

async function fetchQuote(symbol) {
  const apiKey = process.env.FINNHUB_API_KEY?.trim();
  if (!apiKey) return null;
  try {
    const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(apiKey)}`);
    const data = await response.json().catch(() => null);
    if (!response.ok) return null;
    return round(data?.c);
  } catch (error) {
    console.error("Freedom Trader position quote failed:", error);
    return null;
  }
}

function pendingFromOpen(row) {
  return row.pending_trade || row.pending_trades || {};
}

function pendingFromClosed(row) {
  return row.open_position?.pending_trade || row.open_position?.pending_trades || {};
}

function normalizeOpenPosition(row, currentPrice = null) {
  const pending = pendingFromOpen(row);
  const quantity = cleanNumber(row.shares) || 0;
  const entryPrice = cleanNumber(row.purchase_price) || 0;
  const targetPrice = cleanNumber(pending.target_price);
  const stopPrice = cleanNumber(pending.stop_loss);
  const investedAmount = quantity * entryPrice;
  const brokerageBuy = cleanNumber(row.brokerage) || 0;
  const unrealisedProfit = Number.isFinite(currentPrice) ? (currentPrice - entryPrice) * quantity : null;
  const profitPercent = investedAmount && Number.isFinite(unrealisedProfit) ? (unrealisedProfit / investedAmount) * 100 : null;
  const distanceToTarget = Number.isFinite(currentPrice) && Number.isFinite(targetPrice) && currentPrice !== 0
    ? ((targetPrice - currentPrice) / currentPrice) * 100
    : null;
  const distanceToStop = Number.isFinite(currentPrice) && Number.isFinite(stopPrice) && currentPrice !== 0
    ? ((currentPrice - stopPrice) / currentPrice) * 100
    : null;

  return {
    id: row.id,
    pendingTradeId: row.pending_trade_id,
    symbol: pending.ticker || row.ticker,
    companyName: pending.ticker || row.ticker,
    quantity,
    entryPrice,
    entryDate: row.purchase_date,
    targetPrice,
    stopPrice,
    currentPrice,
    status: row.status || "open",
    exitPrice: null,
    exitDate: null,
    brokerageBuy,
    brokerageSell: 0,
    grossProfit: null,
    totalBrokerage: brokerageBuy,
    realisedProfit: null,
    netProfit: null,
    percentageReturn: null,
    winLoss: null,
    unrealisedProfit: round(unrealisedProfit),
    investedAmount: round(investedAmount),
    profitPercent: round(profitPercent),
    distanceToTarget: round(distanceToTarget),
    distanceToStop: round(distanceToStop),
    daysHeld: daysBetween(row.purchase_date, new Date().toISOString()),
    notes: "",
    createdAt: row.purchase_date,
    updatedAt: row.purchase_date,
  };
}

function normalizeClosedPosition(row) {
  const open = row.open_position || {};
  const pending = pendingFromClosed(row);
  const quantity = cleanNumber(open.shares) || 0;
  const entryPrice = cleanNumber(open.purchase_price) || 0;
  const salePrice = cleanNumber(row.sale_price);
  const investedAmount = quantity * entryPrice;
  const netProfit = cleanNumber(row.net_profit);

  return {
    id: row.id,
    openPositionId: row.open_position_id,
    pendingTradeId: open.pending_trade_id,
    symbol: pending.ticker || open.ticker,
    companyName: pending.ticker || open.ticker,
    quantity,
    entryPrice,
    entryDate: open.purchase_date,
    targetPrice: cleanNumber(pending.target_price),
    stopPrice: cleanNumber(pending.stop_loss),
    currentPrice: salePrice,
    status: "closed",
    exitPrice: salePrice,
    exitDate: row.sale_date,
    brokerageBuy: cleanNumber(open.brokerage) || 0,
    brokerageSell: cleanNumber(row.brokerage) || 0,
    grossProfit: round(row.gross_profit),
    totalBrokerage: round((cleanNumber(open.brokerage) || 0) + (cleanNumber(row.brokerage) || 0)),
    realisedProfit: netProfit,
    netProfit,
    percentageReturn: round(row.return_percent),
    winLoss: Number.isFinite(netProfit) ? netProfit >= 0 ? "Win" : "Loss" : null,
    unrealisedProfit: null,
    investedAmount: round(investedAmount),
    profitPercent: null,
    distanceToTarget: null,
    distanceToStop: null,
    daysHeld: row.holding_days,
    notes: "",
    createdAt: row.sale_date,
    updatedAt: row.sale_date,
  };
}

async function listPositions(req, res) {
  const supabase = getSupabase();
  if (!supabase) return res.status(200).json({ ok: true, positions: [], databaseUnavailable: true, error: null });

  try {
    const { data: openRows, error: openError } = await supabase
      .from("open_positions")
      .select("*, pending_trade:pending_trades(*)")
      .eq("status", "open")
      .order("purchase_date", { ascending: false });
    if (openError) throw openError;

    const { data: closedRows, error: closedError } = await supabase
      .from("closed_trades")
      .select("*, open_position:open_positions(*, pending_trade:pending_trades(*))")
      .order("sale_date", { ascending: false });
    if (closedError) throw closedError;

    const openPositions = await Promise.all((openRows || []).map(async (row) => {
      const symbol = pendingFromOpen(row).ticker;
      const currentPrice = symbol ? await fetchQuote(symbol) : null;
      return normalizeOpenPosition(row, currentPrice);
    }));

    return res.status(200).json({
      ok: true,
      positions: [...openPositions, ...(closedRows || []).map(normalizeClosedPosition)],
      databaseUnavailable: false,
      error: null,
    });
  } catch (error) {
    console.error("Freedom Trader positions list failed:", error);
    return res.status(200).json({ ok: true, positions: [], databaseUnavailable: true, error: "Positions database temporarily unavailable." });
  }
}

async function findOrCreatePendingTrade(supabase, body, symbol, quantity, entryPrice, stopPrice, targetPrice) {
  if (body?.pendingTradeId) {
    const { data, error } = await supabase.from("pending_trades").select("*").eq("id", body.pendingTradeId).single();
    if (error) throw error;
    return data;
  }

  const risk = entryPrice - stopPrice;
  const reward = targetPrice - entryPrice;
  const payload = {
    user_id: body?.userId || null,
    ticker: symbol,
    entry_price: entryPrice,
    stop_loss: stopPrice,
    target_price: targetPrice,
    shares: quantity,
    risk_reward: risk > 0 ? reward / risk : null,
    expected_profit: reward * quantity,
    status: "OPEN",
    fib_data: body?.fibData || null,
    created_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from("pending_trades").insert(payload).select("*").single();
  if (error) throw error;
  return data;
}

async function createPosition(req, res) {
  const supabase = getSupabase();
  if (!supabase) return res.status(503).json({ ok: false, error: "Positions database temporarily unavailable." });

  const quantity = Math.floor(cleanNumber(req.body?.quantity ?? req.body?.shares) || 0);
  const entryPrice = cleanNumber(req.body?.entryPrice ?? req.body?.purchasePrice);
  const targetPrice = cleanNumber(req.body?.targetPrice);
  const stopPrice = cleanNumber(req.body?.stopPrice ?? req.body?.stopLoss);
  const brokerage = cleanNumber(req.body?.brokerage) || 0;
  const symbol = String(req.body?.symbol || req.body?.ticker || "").trim().toUpperCase();

  if (!symbol || quantity < 1 || !entryPrice || entryPrice <= 0 || !targetPrice || targetPrice <= entryPrice || !stopPrice || stopPrice >= entryPrice) {
    return res.status(400).json({ ok: false, error: "Enter a valid ticker, shares, entry, target and stop." });
  }

  try {
    const pendingTrade = await findOrCreatePendingTrade(supabase, req.body, symbol, quantity, entryPrice, stopPrice, targetPrice);
    const positionPayload = {
      pending_trade_id: pendingTrade.id,
      purchase_price: entryPrice,
      purchase_date: req.body?.entryDate || req.body?.purchaseDate || new Date().toISOString(),
      shares: quantity,
      brokerage,
      status: "open",
    };
    const { data: position, error } = await supabase
      .from("open_positions")
      .insert(positionPayload)
      .select("*, pending_trade:pending_trades(*)")
      .single();
    if (error) throw error;

    await supabase.from("pending_trades").update({ status: "OPEN" }).eq("id", pendingTrade.id);
    const currentPrice = await fetchQuote(symbol);
    return res.status(200).json({ ok: true, position: normalizeOpenPosition(position, currentPrice), error: null });
  } catch (error) {
    console.error("Freedom Trader position create failed:", error);
    return res.status(500).json({ ok: false, error: "Unable to save position right now." });
  }
}

async function updatePosition(req, res) {
  const supabase = getSupabase();
  if (!supabase) return res.status(503).json({ ok: false, error: "Positions database temporarily unavailable." });
  const id = req.body?.id;
  const action = req.body?.action;
  if (!id) return res.status(400).json({ ok: false, error: "Missing position id." });

  try {
    const { data: existing, error: getError } = await supabase
      .from("open_positions")
      .select("*, pending_trade:pending_trades(*)")
      .eq("id", id)
      .single();
    if (getError) throw getError;

    const pending = pendingFromOpen(existing);
    if (action === "close") {
      const exitPrice = cleanNumber(req.body?.exitPrice);
      const brokerageSell = cleanNumber(req.body?.brokerageSell) || 0;
      const sharesSold = Math.floor(cleanNumber(req.body?.sharesSold) || 0);
      const openShares = Math.floor(cleanNumber(existing.shares) || 0);
      if (!exitPrice || exitPrice <= 0) return res.status(400).json({ ok: false, error: "Exit price must be positive." });
      if (sharesSold !== openShares) return res.status(400).json({ ok: false, error: "Shares sold must match the open position quantity to close the trade." });

      const entryPrice = cleanNumber(existing.purchase_price) || 0;
      const grossProfit = (exitPrice - entryPrice) * sharesSold;
      const brokerageBuy = cleanNumber(existing.brokerage) || 0;
      const netProfit = grossProfit - brokerageBuy - brokerageSell;
      const exitDate = req.body?.exitDate || req.body?.saleDate || new Date().toISOString();
      const returnPercent = entryPrice * sharesSold ? (netProfit / (entryPrice * sharesSold)) * 100 : null;
      const payload = {
        open_position_id: existing.id,
        sale_price: exitPrice,
        sale_date: exitDate,
        brokerage: brokerageSell,
        gross_profit: grossProfit,
        net_profit: netProfit,
        return_percent: returnPercent,
        holding_days: daysBetween(existing.purchase_date, exitDate),
      };
      const { data, error } = await supabase
        .from("closed_trades")
        .insert(payload)
        .select("*, open_position:open_positions(*, pending_trade:pending_trades(*))")
        .single();
      if (error) throw error;

      await supabase.from("open_positions").update({ status: "closed" }).eq("id", existing.id);
      if (pending.id) {
        await supabase.from("pending_trades").update({ status: "CLOSED" }).eq("id", pending.id);
        await supabase.from("trade_alerts").update({ triggered: true }).eq("trade_id", pending.id).eq("triggered", false);
      }
      return res.status(200).json({ ok: true, position: normalizeClosedPosition(data), error: null });
    }

    const pendingPayload = {};
    if (Object.prototype.hasOwnProperty.call(req.body, "targetPrice")) pendingPayload.target_price = cleanNumber(req.body.targetPrice);
    if (Object.prototype.hasOwnProperty.call(req.body, "stopPrice")) pendingPayload.stop_loss = cleanNumber(req.body.stopPrice);
    if (Object.keys(pendingPayload).length && pending.id) {
      const { error } = await supabase.from("pending_trades").update(pendingPayload).eq("id", pending.id);
      if (error) throw error;
    }
    const { data, error } = await supabase
      .from("open_positions")
      .select("*, pending_trade:pending_trades(*)")
      .eq("id", id)
      .single();
    if (error) throw error;
    const currentPrice = pending.ticker ? await fetchQuote(pending.ticker) : null;
    return res.status(200).json({ ok: true, position: normalizeOpenPosition(data, currentPrice), error: null });
  } catch (error) {
    console.error("Freedom Trader position update failed:", error);
    return res.status(500).json({ ok: false, error: "Unable to update position right now." });
  }
}

export default async function handler(req, res) {
  if (req.method === "GET") return listPositions(req, res);
  if (req.method === "POST") return createPosition(req, res);
  if (req.method === "PATCH") return updatePosition(req, res);
  res.setHeader("Allow", "GET, POST, PATCH");
  return res.status(405).json({ ok: false, error: "Method not allowed." });
}
