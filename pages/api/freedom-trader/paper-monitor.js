import { createSupabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { fetchTradeQuote } from "../../../lib/freedom-trader/marketData.js";
import { cleanNumber, shouldTriggerExit } from "../../../lib/freedom-trader/paperTrading.js";
import { loadPaperAccount } from "./paper-account.js";
import { fillBuyOrder, fillSellOrder } from "./paper-orders.js";

async function createExitOrder(supabase, account, position, price, exitReason) {
  const { data: existing, error: existingError } = await supabase
    .from("freedom_paper_orders")
    .select("id")
    .eq("account_id", account.id)
    .eq("ticker", position.ticker)
    .eq("side", "sell")
    .eq("status", "pending")
    .in("exit_reason", [exitReason])
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing?.id) return { skipped: true, reason: "duplicate_pending_exit", orderId: existing.id };

  const { data: order, error } = await supabase
    .from("freedom_paper_orders")
    .insert({
      account_id: account.id,
      ticker: position.ticker,
      company_name: position.companyName,
      exchange: position.exchange,
      currency: position.currency,
      side: "sell",
      order_type: "market",
      quantity: position.quantity,
      requested_price: price.price,
      brokerage_fee: 9.5,
      status: "pending",
      price_provider: price.provider,
      price_source: price.source,
      price_last_updated_at: price.lastUpdated,
      price_delayed: Boolean(price.delayed),
      exit_reason: exitReason,
    })
    .select("*")
    .single();
  if (error) throw error;
  return { skipped: false, order: await fillSellOrder(supabase, account, order, price), exitReason };
}

async function processPendingLimitOrders(supabase, snapshot) {
  const pending = snapshot.orders.filter((order) => order.status === "pending" && order.order_type === "limit");
  const results = [];
  for (const order of pending) {
    const price = await fetchTradeQuote(order.ticker);
    const current = cleanNumber(price.price);
    const requested = cleanNumber(order.requested_price);
    if (!price.ok || !Number.isFinite(current) || !Number.isFinite(requested)) {
      results.push({ orderId: order.id, ticker: order.ticker, action: "skipped", reason: "price_unavailable", price });
      continue;
    }
    const shouldFill = order.side === "buy" ? current <= requested : current >= requested;
    if (!shouldFill) {
      results.push({ orderId: order.id, ticker: order.ticker, action: "still_pending", currentPrice: current, requestedPrice: requested });
      continue;
    }
    const filled = order.side === "buy"
      ? await fillBuyOrder(supabase, snapshot.account, order, price)
      : await fillSellOrder(supabase, snapshot.account, order, price);
    results.push({ orderId: order.id, ticker: order.ticker, action: "filled", order: filled });
  }
  return results;
}

async function processStopsAndTargets(supabase, snapshot) {
  const results = [];
  for (const position of snapshot.positions) {
    const price = position.priceData?.ok ? position.priceData : await fetchTradeQuote(position.ticker);
    const exitReason = shouldTriggerExit({ stopLoss: position.stopLoss, target: position.target }, price.price);
    if (!exitReason) {
      results.push({ ticker: position.ticker, action: "no_exit", currentPrice: price.price });
      continue;
    }
    const exit = await createExitOrder(supabase, snapshot.account, position, price, exitReason);
    results.push({ ticker: position.ticker, action: exit.skipped ? "skipped" : "closed", exitReason, order: exit.order || null, reason: exit.reason || null });
  }
  return results;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  try {
    const supabase = createSupabaseAdmin();
    const snapshot = await loadPaperAccount(req);
    const pendingOrders = await processPendingLimitOrders(supabase, snapshot);
    const exits = await processStopsAndTargets(supabase, await loadPaperAccount(req));
    return res.status(200).json({ ok: true, pendingOrders, exits, checkedAt: new Date().toISOString(), error: null });
  } catch (error) {
    console.error("Freedom paper monitor failed:", error);
    return res.status(500).json({ ok: false, error: error.message || "Paper monitor failed." });
  }
}
