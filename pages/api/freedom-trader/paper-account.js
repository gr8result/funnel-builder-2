import { createSupabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { fetchTradeQuote } from "../../../lib/freedom-trader/marketData.js";
import { loadLocalPaperSnapshot } from "../../../lib/freedom-trader/localPaperStore.js";
import {
  DEFAULT_ACCOUNT_CURRENCY,
  DEFAULT_STARTING_BALANCE,
  calculateUnrealised,
  cleanNumber,
  developmentOwnerId,
  roundMoney,
} from "../../../lib/freedom-trader/paperTrading.js";

async function getOrCreateAccount(supabase, ownerId) {
  const { data: existing, error: findError } = await supabase
    .from("freedom_paper_accounts")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("currency", DEFAULT_ACCOUNT_CURRENCY)
    .maybeSingle();
  if (findError) throw findError;
  if (existing?.id) return existing;

  const startingBalance = cleanNumber(process.env.FREEDOM_PAPER_STARTING_BALANCE) || DEFAULT_STARTING_BALANCE;
  const { data, error } = await supabase
    .from("freedom_paper_accounts")
    .insert({
      owner_id: ownerId,
      starting_balance: startingBalance,
      available_cash: startingBalance,
      currency: DEFAULT_ACCOUNT_CURRENCY,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function accountSnapshot(supabase, account) {
  const [{ data: positions, error: positionsError }, { data: orders, error: ordersError }, { data: trades, error: tradesError }] = await Promise.all([
    supabase.from("freedom_paper_positions").select("*").eq("account_id", account.id).eq("status", "open").gt("quantity", 0).order("opened_at", { ascending: false }),
    supabase.from("freedom_paper_orders").select("*").eq("account_id", account.id).order("created_at", { ascending: false }),
    supabase.from("freedom_paper_trades").select("*").eq("account_id", account.id).order("traded_at", { ascending: false }),
  ]);
  if (positionsError) throw positionsError;
  if (ordersError) throw ordersError;
  if (tradesError) throw tradesError;

  const quotes = await Promise.all((positions || []).map((position) => fetchTradeQuote(position.ticker)));
  const openPositions = (positions || []).map((position, index) => {
    const quote = quotes[index];
    const metrics = calculateUnrealised(position, quote?.ok ? quote.price : null);
    return {
      id: position.id,
      ticker: position.ticker,
      companyName: position.company_name,
      exchange: position.exchange,
      currency: position.currency,
      quantity: cleanNumber(position.quantity) || 0,
      averageEntry: cleanNumber(position.average_entry_price),
      stopLoss: cleanNumber(position.stop_loss_price),
      target: cleanNumber(position.target_price),
      currentPrice: quote?.ok ? quote.price : null,
      marketValue: metrics.marketValue,
      unrealisedProfitLoss: metrics.unrealisedProfit,
      returnPercent: metrics.returnPercent,
      priceData: quote,
      openedAt: position.opened_at,
    };
  });

  const currentInvestedValue = roundMoney(openPositions.reduce((total, position) => total + (cleanNumber(position.marketValue) || 0), 0));
  const unrealised = roundMoney(openPositions.reduce((total, position) => total + (cleanNumber(position.unrealisedProfitLoss) || 0), 0));
  const realised = roundMoney((trades || []).reduce((total, trade) => total + (cleanNumber(trade.realised_profit_loss) || 0), 0));
  const today = new Date().toISOString().slice(0, 10);
  const dailyProfitLoss = roundMoney((trades || [])
    .filter((trade) => String(trade.traded_at || "").slice(0, 10) === today)
    .reduce((total, trade) => total + (cleanNumber(trade.realised_profit_loss) || 0), 0) + (unrealised || 0));
  const availableCash = cleanNumber(account.available_cash) || 0;
  const totalAccountValue = roundMoney(availableCash + (currentInvestedValue || 0));
  const startingBalance = cleanNumber(account.starting_balance) || DEFAULT_STARTING_BALANCE;

  return {
    account: {
      id: account.id,
      ownerId: account.owner_id,
      label: "PAPER TRADING - NO REAL MONEY",
      startingBalance,
      currency: account.currency,
      availableCash: roundMoney(availableCash),
      currentInvestedValue,
      totalAccountValue,
      openProfitLoss: unrealised,
      closedProfitLoss: realised,
      dailyProfitLoss,
      totalReturnPercent: startingBalance ? roundMoney(((totalAccountValue - startingBalance) / startingBalance) * 100) : null,
    },
    positions: openPositions,
    pendingOrders: (orders || []).filter((order) => order.status === "pending"),
    orders: orders || [],
    trades: trades || [],
  };
}

export async function loadPaperAccount(req) {
  try {
    const supabase = createSupabaseAdmin();
    const account = await getOrCreateAccount(supabase, developmentOwnerId(req));
    return { ...(await accountSnapshot(supabase, account)), storageMode: "supabase" };
  } catch (error) {
    console.error("Freedom paper account using local development store:", error);
    return loadLocalPaperSnapshot(fetchTradeQuote);
  }
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  try {
    const data = await loadPaperAccount(req);
    return res.status(200).json({ ok: true, ...data, databaseUnavailable: false, error: null });
  } catch (error) {
    console.error("Freedom paper account failed:", error);
    return res.status(200).json({ ok: true, ...(await loadLocalPaperSnapshot(fetchTradeQuote)), databaseUnavailable: true, error: "Supabase unavailable. Using local development paper-trading storage." });
  }
}
