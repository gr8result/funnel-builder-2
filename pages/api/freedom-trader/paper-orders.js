import { createSupabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { fetchTradeQuote, marketMeta } from "../../../lib/freedom-trader/marketData.js";
import { submitLocalPaperOrder } from "../../../lib/freedom-trader/localPaperStore.js";
import { loadPaperAccount } from "./paper-account.js";
import {
  calculateAverageEntry,
  calculateBuyOrder,
  calculateSale,
  cleanNumber,
  csvEscape,
  priceIsUsable,
  validateBuyOrder,
} from "../../../lib/freedom-trader/paperTrading.js";

async function event(supabase, payload) {
  await supabase.from("freedom_trade_events").insert({
    account_id: payload.accountId,
    order_id: payload.orderId || null,
    position_id: payload.positionId || null,
    event_type: payload.type,
    message: payload.message,
    metadata: payload.metadata || null,
  });
}

async function getOpenPosition(supabase, accountId, ticker, currency) {
  const { data, error } = await supabase
    .from("freedom_paper_positions")
    .select("*")
    .eq("account_id", accountId)
    .eq("ticker", ticker)
    .eq("currency", currency)
    .eq("status", "open")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fillBuyOrder(supabase, account, order, price) {
  const quantity = cleanNumber(order.quantity) || 0;
  const filledPrice = cleanNumber(price.price);
  const brokerage = cleanNumber(order.brokerage_fee) || 0;
  const requiredCash = (filledPrice * quantity) + brokerage;
  if (requiredCash > (cleanNumber(account.availableCash) || cleanNumber(account.available_cash) || 0)) {
    const { data } = await supabase.from("freedom_paper_orders").update({ status: "rejected", rejection_reason: "Available paper cash is insufficient." }).eq("id", order.id).select("*").single();
    return data;
  }

  const position = await getOpenPosition(supabase, account.id, order.ticker, order.currency);
  let positionId = position?.id;
  if (position?.id) {
    const nextQuantity = (cleanNumber(position.quantity) || 0) + quantity;
    const averageEntry = calculateAverageEntry(position.quantity, position.average_entry_price, quantity, filledPrice);
    const { data, error } = await supabase
      .from("freedom_paper_positions")
      .update({ quantity: nextQuantity, average_entry_price: averageEntry, stop_loss_price: order.stop_loss_price, target_price: order.target_price, updated_at: new Date().toISOString() })
      .eq("id", position.id)
      .select("*")
      .single();
    if (error) throw error;
    positionId = data.id;
  } else {
    const { data, error } = await supabase
      .from("freedom_paper_positions")
      .insert({
        account_id: account.id,
        ticker: order.ticker,
        company_name: order.company_name,
        exchange: order.exchange,
        currency: order.currency,
        quantity,
        average_entry_price: filledPrice,
        stop_loss_price: order.stop_loss_price,
        target_price: order.target_price,
      })
      .select("*")
      .single();
    if (error) throw error;
    positionId = data.id;
  }

  const now = new Date().toISOString();
  const [{ data: filled, error: orderError }, accountUpdate, tradeInsert] = await Promise.all([
    supabase.from("freedom_paper_orders").update({ status: "filled", filled_price: filledPrice, filled_at: now }).eq("id", order.id).select("*").single(),
    supabase.from("freedom_paper_accounts").update({ available_cash: (cleanNumber(account.availableCash) || cleanNumber(account.available_cash) || 0) - requiredCash, updated_at: now }).eq("id", account.id),
    supabase.from("freedom_paper_trades").insert({
      account_id: account.id,
      order_id: order.id,
      position_id: positionId,
      ticker: order.ticker,
      company_name: order.company_name,
      exchange: order.exchange,
      currency: order.currency,
      side: "buy",
      quantity,
      price: filledPrice,
      brokerage_fee: brokerage,
      traded_at: now,
    }),
  ]);
  if (orderError) throw orderError;
  if (accountUpdate.error) throw accountUpdate.error;
  if (tradeInsert.error) throw tradeInsert.error;
  await event(supabase, { accountId: account.id, orderId: order.id, positionId, type: "order_filled", message: `Paper buy filled for ${order.ticker}.`, metadata: { price } });
  return filled;
}

export async function fillSellOrder(supabase, account, order, price) {
  const position = await getOpenPosition(supabase, account.id, order.ticker, order.currency);
  const quantity = cleanNumber(order.quantity) || 0;
  if (!position || quantity > (cleanNumber(position.quantity) || 0)) {
    const { data } = await supabase.from("freedom_paper_orders").update({ status: "rejected", rejection_reason: "Cannot sell more shares than are owned." }).eq("id", order.id).select("*").single();
    return data;
  }

  const filledPrice = cleanNumber(price.price);
  const brokerage = cleanNumber(order.brokerage_fee) || 0;
  const sale = calculateSale({ quantity: position.quantity, averageEntry: position.average_entry_price, saleQuantity: quantity, salePrice: filledPrice, brokerage });
  if (!sale) throw new Error("Invalid sale calculation.");
  const proceeds = (filledPrice * quantity) - brokerage;
  const now = new Date().toISOString();
  const positionPatch = sale.remainingQuantity > 0
    ? { quantity: sale.remainingQuantity, updated_at: now }
    : { quantity: 0, status: "closed", closed_at: now, updated_at: now };

  const [{ data: filled, error: orderError }, positionUpdate, accountUpdate, tradeInsert] = await Promise.all([
    supabase.from("freedom_paper_orders").update({ status: "filled", filled_price: filledPrice, filled_at: now }).eq("id", order.id).select("*").single(),
    supabase.from("freedom_paper_positions").update(positionPatch).eq("id", position.id),
    supabase.from("freedom_paper_accounts").update({ available_cash: (cleanNumber(account.availableCash) || cleanNumber(account.available_cash) || 0) + proceeds, updated_at: now }).eq("id", account.id),
    supabase.from("freedom_paper_trades").insert({
      account_id: account.id,
      order_id: order.id,
      position_id: position.id,
      ticker: order.ticker,
      company_name: order.company_name,
      exchange: order.exchange,
      currency: order.currency,
      side: "sell",
      quantity,
      price: filledPrice,
      brokerage_fee: brokerage,
      realised_profit_loss: sale.realisedProfit,
      exit_reason: order.exit_reason || "manual",
      traded_at: now,
    }),
  ]);
  if (orderError) throw orderError;
  if (positionUpdate.error) throw positionUpdate.error;
  if (accountUpdate.error) throw accountUpdate.error;
  if (tradeInsert.error) throw tradeInsert.error;
  await event(supabase, { accountId: account.id, orderId: order.id, positionId: position.id, type: "order_filled", message: `Paper sell filled for ${order.ticker}.`, metadata: { price, exitReason: order.exit_reason || "manual" } });
  return filled;
}

async function createOrder(req, res) {
  const snapshot = await loadPaperAccount(req);
  const account = snapshot.account;
  if (!account?.id) return res.status(503).json({ ok: false, error: "Paper account unavailable." });

  const side = String(req.body?.side || "buy").toLowerCase();
  const orderType = String(req.body?.orderType || "market").toLowerCase();
  const ticker = String(req.body?.ticker || req.body?.symbol || "").trim().toUpperCase();
  const meta = marketMeta(ticker);
  const serverPrice = await fetchTradeQuote(ticker);
  const snapshotPrice = req.body?.priceSnapshot && priceIsUsable(req.body.priceSnapshot)
    ? { ok: true, ...req.body.priceSnapshot }
    : null;
  const price = serverPrice?.ok ? serverPrice : snapshotPrice || serverPrice;
  const requestedPrice = orderType === "limit" ? cleanNumber(req.body?.limitPrice ?? req.body?.requestedPrice) : cleanNumber(price.price);
  const brokerageFee = cleanNumber(req.body?.brokerageFee) ?? 9.5;

  if (!ticker || !["buy", "sell"].includes(side) || !["market", "limit"].includes(orderType)) {
    return res.status(400).json({ ok: false, error: "Ticker, side and order type are required." });
  }
  const currencyWarning = meta.currency !== account.currency ? `Instrument currency is ${meta.currency}; paper account display currency is ${account.currency}. No live FX conversion or broker settlement is performed.` : null;

  const calculation = calculateBuyOrder({ account: { available_cash: account.availableCash }, currentPrice: price.price, limitPrice: requestedPrice, orderType, quantity: req.body?.quantity, brokerage: brokerageFee, stopLoss: req.body?.stopLoss });
  if (side === "buy") {
    const validation = validateBuyOrder({ account: { id: account.id, available_cash: account.availableCash }, price, order: { ...req.body, orderType, requestedPrice, brokerageFee } });
    if (!validation.ok) return res.status(400).json({ ok: false, error: validation.errors[0], errors: validation.errors, calculation: validation.calculation, priceData: price });
  }
  if (side === "sell") {
    const position = snapshot.positions.find((item) => item.ticker === ticker && item.currency === meta.currency);
    const quantity = Math.floor(cleanNumber(req.body?.quantity) || 0);
    if (!price?.ok) return res.status(400).json({ ok: false, error: "Current price data is missing, stale or invalid.", priceData: price });
    if (!position || quantity < 1 || quantity > position.quantity) return res.status(400).json({ ok: false, error: "Cannot sell more shares than are currently owned." });
  }

  const status = orderType === "market" ? "pending" : "pending";
  if (snapshot.storageMode === "local") {
    const order = await submitLocalPaperOrder({
      side,
      orderType,
      ticker,
      companyName: req.body?.companyName || meta.companyName,
      exchange: meta.exchange,
      currency: meta.currency,
      quantity: calculation.quantity,
      limitPrice: requestedPrice,
      brokerageFee,
      stopLoss: req.body?.stopLoss,
      targetPrice: req.body?.targetPrice,
      exitReason: req.body?.exitReason || (side === "sell" ? "manual" : null),
    }, price);
    return res.status(200).json({ ok: true, order, calculation, priceData: price, storageMode: "local", warning: currencyWarning, error: null });
  }

  const supabase = createSupabaseAdmin();
  const { data: order, error } = await supabase
    .from("freedom_paper_orders")
    .insert({
      account_id: account.id,
      ticker,
      company_name: req.body?.companyName || meta.companyName,
      exchange: meta.exchange,
      currency: meta.currency,
      side,
      order_type: orderType,
      quantity: calculation.quantity,
      requested_price: requestedPrice,
      brokerage_fee: brokerageFee,
      status,
      stop_loss_price: cleanNumber(req.body?.stopLoss),
      target_price: cleanNumber(req.body?.targetPrice),
      price_provider: price.provider,
      price_source: price.source,
      price_last_updated_at: price.lastUpdated,
      price_delayed: Boolean(price.delayed),
      exit_reason: req.body?.exitReason || (side === "sell" ? "manual" : null),
    })
    .select("*")
    .single();
  if (error) throw error;
  await event(supabase, { accountId: account.id, orderId: order.id, type: "order_submitted", message: `Paper ${side} order submitted for ${ticker}.`, metadata: { price, calculation } });

  let finalOrder = order;
  if (orderType === "market") finalOrder = side === "buy" ? await fillBuyOrder(supabase, account, order, price) : await fillSellOrder(supabase, account, order, price);

  return res.status(200).json({ ok: true, order: finalOrder, calculation, priceData: price, storageMode: "supabase", warning: currencyWarning, error: null });
}

async function cancelOrder(req, res) {
  const snapshot = await loadPaperAccount(req);
  const supabase = createSupabaseAdmin();
  const id = req.body?.id || req.query?.id;
  if (!id) return res.status(400).json({ ok: false, error: "Order id is required." });
  const { data, error } = await supabase
    .from("freedom_paper_orders")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", id)
    .eq("account_id", snapshot.account.id)
    .eq("status", "pending")
    .select("*")
    .single();
  if (error) throw error;
  await event(supabase, { accountId: snapshot.account.id, orderId: id, type: "order_cancelled", message: `Paper order ${id} cancelled.` });
  return res.status(200).json({ ok: true, order: data, error: null });
}

export function tradesToCsv(trades) {
  const headers = ["traded_at", "ticker", "side", "quantity", "price", "brokerage_fee", "realised_profit_loss", "exit_reason"];
  return [headers.join(","), ...(trades || []).map((trade) => headers.map((key) => csvEscape(trade[key])).join(","))].join("\n");
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const snapshot = await loadPaperAccount(req);
      return res.status(200).json({ ok: true, orders: snapshot.orders, trades: snapshot.trades, error: null });
    }
    if (req.method === "POST") return createOrder(req, res);
    if (req.method === "PATCH") return cancelOrder(req, res);
    res.setHeader("Allow", "GET, POST, PATCH");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  } catch (error) {
    console.error("Freedom paper order failed:", error);
    return res.status(500).json({ ok: false, error: error.message || "Paper order failed." });
  }
}
