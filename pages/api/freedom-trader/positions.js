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

function normalizePosition(row) {
  const quantity = cleanNumber(row.quantity) || 0;
  const entryPrice = cleanNumber(row.entry_price) || 0;
  const currentPrice = cleanNumber(row.current_price);
  const investedAmount = quantity * entryPrice;
  const unrealisedProfit = row.status === "open" && Number.isFinite(currentPrice)
    ? (currentPrice - entryPrice) * quantity
    : cleanNumber(row.unrealised_profit);
  const profitPercent = investedAmount ? (unrealisedProfit / investedAmount) * 100 : null;
  const distanceToTarget = Number.isFinite(currentPrice) && Number.isFinite(cleanNumber(row.target_price))
    ? ((cleanNumber(row.target_price) - currentPrice) / currentPrice) * 100
    : null;
  const distanceToStop = Number.isFinite(currentPrice) && Number.isFinite(cleanNumber(row.stop_price))
    ? ((currentPrice - cleanNumber(row.stop_price)) / currentPrice) * 100
    : null;
  const heldUntil = row.status === "closed" && row.exit_date ? new Date(row.exit_date).getTime() : Date.now();
  const daysHeld = row.entry_date ? Math.max(0, Math.floor((heldUntil - new Date(row.entry_date).getTime()) / 86400000)) : null;

  return {
    id: row.id,
    symbol: row.symbol,
    companyName: row.company_name || row.symbol,
    quantity,
    entryPrice,
    entryDate: row.entry_date,
    targetPrice: cleanNumber(row.target_price),
    stopPrice: cleanNumber(row.stop_price),
    currentPrice,
    status: row.status,
    exitPrice: cleanNumber(row.exit_price),
    exitDate: row.exit_date,
    brokerageBuy: cleanNumber(row.brokerage_buy) || 0,
    brokerageSell: cleanNumber(row.brokerage_sell) || 0,
    realisedProfit: cleanNumber(row.realised_profit),
    unrealisedProfit: round(unrealisedProfit),
    investedAmount: round(investedAmount),
    profitPercent: round(profitPercent),
    distanceToTarget: round(distanceToTarget),
    distanceToStop: round(distanceToStop),
    daysHeld,
    notes: row.notes || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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

async function refreshOpenPrices(supabase, rows) {
  const openRows = rows.filter((row) => row.status === "open");
  const updates = await Promise.all(openRows.map(async (row) => {
    const currentPrice = await fetchQuote(row.symbol);
    if (!Number.isFinite(currentPrice)) return null;
    const unrealisedProfit = (currentPrice - Number(row.entry_price)) * Number(row.quantity);
    const { error } = await supabase
      .from("freedom_trader_positions")
      .update({ current_price: currentPrice, unrealised_profit: unrealisedProfit, updated_at: new Date().toISOString() })
      .eq("id", row.id);
    if (error) console.error("Freedom Trader price update failed:", error);
    return { ...row, current_price: currentPrice, unrealised_profit: unrealisedProfit };
  }));
  const updatedById = new Map(updates.filter(Boolean).map((row) => [row.id, row]));
  return rows.map((row) => updatedById.get(row.id) || row);
}

async function listPositions(req, res) {
  const supabase = getSupabase();
  if (!supabase) return res.status(200).json({ ok: true, positions: [], databaseUnavailable: true, error: null });

  try {
    const { data, error } = await supabase
      .from("freedom_trader_positions")
      .select("*")
      .order("entry_date", { ascending: false });
    if (error) throw error;
    const withPrices = await refreshOpenPrices(supabase, data || []);
    return res.status(200).json({ ok: true, positions: withPrices.map(normalizePosition), databaseUnavailable: false, error: null });
  } catch (error) {
    console.error("Freedom Trader positions list failed:", error);
    return res.status(200).json({ ok: true, positions: [], databaseUnavailable: true, error: "Positions database temporarily unavailable." });
  }
}

async function createPosition(req, res) {
  const supabase = getSupabase();
  if (!supabase) return res.status(503).json({ ok: false, error: "Positions database temporarily unavailable." });

  const quantity = Math.floor(cleanNumber(req.body?.quantity) || 0);
  const entryPrice = cleanNumber(req.body?.entryPrice);
  const targetPrice = cleanNumber(req.body?.targetPrice);
  const stopPrice = cleanNumber(req.body?.stopPrice);
  const symbol = String(req.body?.symbol || "").trim().toUpperCase();

  if (!symbol || quantity < 1 || !entryPrice || entryPrice <= 0 || !targetPrice || targetPrice <= entryPrice || !stopPrice || stopPrice >= entryPrice) {
    return res.status(400).json({ ok: false, error: "Enter a valid symbol, quantity, entry, target and stop." });
  }

  try {
    await ensureWatchlistSymbol(supabase, symbol, req.body?.companyName);
    const currentPrice = await fetchQuote(symbol);
    const positionPayload = {
      symbol,
      company_name: req.body?.companyName || symbol,
      quantity,
      entry_price: entryPrice,
      entry_date: req.body?.entryDate || new Date().toISOString(),
      target_price: targetPrice,
      stop_price: stopPrice,
      current_price: currentPrice,
      status: "open",
      brokerage_buy: cleanNumber(req.body?.brokerage) || 0,
      notes: req.body?.notes || null,
    };
    const { data: position, error } = await supabase
      .from("freedom_trader_positions")
      .insert(positionPayload)
      .select("*")
      .single();
    if (error) throw error;

    const alertRows = [
      {
        symbol,
        position_id: position.id,
        alert_type: "TARGET REACHED",
        trigger_price: targetPrice,
        direction: "above",
        message: `${symbol} target reached. Review the open position; no trade is executed automatically.`,
        priority: "high",
        status: "active",
      },
      {
        symbol,
        position_id: position.id,
        alert_type: "STOP REACHED",
        trigger_price: stopPrice,
        direction: "below",
        message: `${symbol} stop reached. Review risk immediately; no trade is executed automatically.`,
        priority: "high",
        status: "active",
      },
    ];
    const { error: alertsError } = await supabase.from("freedom_trader_alerts").insert(alertRows);
    if (alertsError) console.error("Freedom Trader auto-alert creation failed:", alertsError);

    const { error: journalError } = await supabase.from("freedom_trader_journal").insert({
      position_id: position.id,
      symbol,
      event_type: "BUY RECORDED",
      price: entryPrice,
      quantity,
      notes: req.body?.notes || "Buy recorded from Freedom Trader.",
    });
    if (journalError) console.error("Freedom Trader journal creation failed:", journalError);

    return res.status(200).json({ ok: true, position: normalizePosition(position), error: null });
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
    const { data: existing, error: getError } = await supabase.from("freedom_trader_positions").select("*").eq("id", id).single();
    if (getError) throw getError;

    if (action === "close") {
      const exitPrice = cleanNumber(req.body?.exitPrice);
      const brokerageSell = cleanNumber(req.body?.brokerageSell) || 0;
      if (!exitPrice || exitPrice <= 0) return res.status(400).json({ ok: false, error: "Exit price must be positive." });
      const grossProfit = (exitPrice - Number(existing.entry_price)) * Number(existing.quantity);
      const netProfit = grossProfit - (Number(existing.brokerage_buy) || 0) - brokerageSell;
      const exitDate = req.body?.exitDate || new Date().toISOString();
      const payload = {
        status: "closed",
        exit_price: exitPrice,
        exit_date: exitDate,
        brokerage_sell: brokerageSell,
        realised_profit: netProfit,
        unrealised_profit: null,
        notes: req.body?.notes ?? existing.notes,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.from("freedom_trader_positions").update(payload).eq("id", id).select("*").single();
      if (error) throw error;
      await supabase.from("freedom_trader_alerts").update({ status: "disabled", updated_at: new Date().toISOString() }).eq("position_id", id).eq("status", "active");
      await supabase.from("freedom_trader_journal").insert({
        position_id: id,
        symbol: existing.symbol,
        event_type: "POSITION CLOSED",
        price: exitPrice,
        quantity: existing.quantity,
        notes: req.body?.notes || `Closed position. Net profit: ${round(netProfit)}`,
      });
      return res.status(200).json({ ok: true, position: normalizePosition(data), error: null });
    }

    const payload = { updated_at: new Date().toISOString() };
    if (Object.prototype.hasOwnProperty.call(req.body, "targetPrice")) payload.target_price = cleanNumber(req.body.targetPrice);
    if (Object.prototype.hasOwnProperty.call(req.body, "stopPrice")) payload.stop_price = cleanNumber(req.body.stopPrice);
    if (Object.prototype.hasOwnProperty.call(req.body, "notes")) payload.notes = req.body.notes || null;
    const { data, error } = await supabase.from("freedom_trader_positions").update(payload).eq("id", id).select("*").single();
    if (error) throw error;
    await supabase.from("freedom_trader_journal").insert({
      position_id: id,
      symbol: existing.symbol,
      event_type: action === "raise-stop" ? "STOP UPDATED" : action === "edit-target" ? "TARGET UPDATED" : "NOTE ADDED",
      price: payload.stop_price || payload.target_price || null,
      quantity: existing.quantity,
      notes: req.body?.notes || action || "Position updated.",
    });
    return res.status(200).json({ ok: true, position: normalizePosition(data), error: null });
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
