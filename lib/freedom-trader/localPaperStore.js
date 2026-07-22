import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_ACCOUNT_CURRENCY,
  DEFAULT_STARTING_BALANCE,
  PAPER_OWNER_ID,
  calculateAverageEntry,
  calculateSale,
  calculateUnrealised,
  cleanNumber,
  roundMoney,
} from "./paperTrading.js";

const STORE_PATH = path.join(process.cwd(), "tmp", "freedom-paper-local.json");

function id(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function emptyStore() {
  return {
    mode: "local",
    account: {
      id: "local-paper-account",
      owner_id: PAPER_OWNER_ID,
      starting_balance: DEFAULT_STARTING_BALANCE,
      available_cash: DEFAULT_STARTING_BALANCE,
      currency: DEFAULT_ACCOUNT_CURRENCY,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    orders: [],
    positions: [],
    trades: [],
    events: [],
  };
}

async function readStore() {
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return parsed?.account ? parsed : emptyStore();
  } catch {
    return emptyStore();
  }
}

async function writeStore(store) {
  await mkdir(path.dirname(STORE_PATH), { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2));
  return store;
}

function normalizeAccount(account) {
  const startingBalance = cleanNumber(account.starting_balance) || DEFAULT_STARTING_BALANCE;
  const availableCash = cleanNumber(account.available_cash) ?? startingBalance;
  return {
    id: account.id,
    ownerId: account.owner_id,
    label: "PAPER TRADING - NO REAL MONEY",
    startingBalance,
    currency: account.currency || DEFAULT_ACCOUNT_CURRENCY,
    availableCash: roundMoney(availableCash),
    currentInvestedValue: 0,
    totalAccountValue: roundMoney(availableCash),
    openProfitLoss: 0,
    closedProfitLoss: 0,
    dailyProfitLoss: 0,
    totalReturnPercent: 0,
  };
}

export async function loadLocalPaperSnapshot(fetchQuote) {
  const store = await readStore();
  const quotes = await Promise.all(store.positions.filter((position) => position.status === "open" && Number(position.quantity) > 0).map((position) => fetchQuote(position.ticker)));
  const openRows = store.positions.filter((position) => position.status === "open" && Number(position.quantity) > 0);
  const positions = openRows.map((position, index) => {
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
  const account = normalizeAccount(store.account);
  account.currentInvestedValue = roundMoney(positions.reduce((total, position) => total + (cleanNumber(position.marketValue) || 0), 0));
  account.openProfitLoss = roundMoney(positions.reduce((total, position) => total + (cleanNumber(position.unrealisedProfitLoss) || 0), 0));
  account.closedProfitLoss = roundMoney(store.trades.reduce((total, trade) => total + (cleanNumber(trade.realised_profit_loss) || 0), 0));
  account.totalAccountValue = roundMoney(account.availableCash + (account.currentInvestedValue || 0));
  account.totalReturnPercent = account.startingBalance ? roundMoney(((account.totalAccountValue - account.startingBalance) / account.startingBalance) * 100) : null;
  const today = new Date().toISOString().slice(0, 10);
  account.dailyProfitLoss = roundMoney(store.trades.filter((trade) => String(trade.traded_at).slice(0, 10) === today).reduce((total, trade) => total + (cleanNumber(trade.realised_profit_loss) || 0), 0) + (account.openProfitLoss || 0));
  return {
    account,
    positions,
    pendingOrders: store.orders.filter((order) => order.status === "pending"),
    orders: store.orders,
    trades: store.trades,
    events: store.events,
    storageMode: "local",
    localStorePath: STORE_PATH,
  };
}

export async function submitLocalPaperOrder(input, price) {
  const store = await readStore();
  const now = new Date().toISOString();
  const quantity = Math.floor(cleanNumber(input.quantity) || 0);
  const side = String(input.side || "buy").toLowerCase();
  const orderType = String(input.orderType || "market").toLowerCase();
  const requestedPrice = orderType === "limit" ? cleanNumber(input.limitPrice) : cleanNumber(price.price);
  const brokerageFee = cleanNumber(input.brokerageFee) ?? 9.5;
  const order = {
    id: id("order"),
    account_id: store.account.id,
    ticker: input.ticker,
    company_name: input.companyName || input.ticker,
    exchange: input.exchange,
    currency: input.currency,
    side,
    order_type: orderType,
    quantity,
    requested_price: requestedPrice,
    filled_price: null,
    brokerage_fee: brokerageFee,
    status: "pending",
    stop_loss_price: cleanNumber(input.stopLoss),
    target_price: cleanNumber(input.targetPrice),
    price_provider: price.provider,
    price_source: price.source,
    price_last_updated_at: price.lastUpdated,
    price_delayed: Boolean(price.delayed),
    exit_reason: input.exitReason || null,
    created_at: now,
    filled_at: null,
  };
  store.orders.unshift(order);
  if (orderType === "market") fillLocalOrder(store, order, price);
  await writeStore(store);
  return order;
}

function fillLocalOrder(store, order, price) {
  const fillPrice = cleanNumber(price.price);
  const quantity = cleanNumber(order.quantity) || 0;
  const now = new Date().toISOString();
  order.filled_price = fillPrice;
  order.filled_at = now;
  order.status = "filled";
  if (order.side === "buy") {
    store.account.available_cash = roundMoney((cleanNumber(store.account.available_cash) || 0) - (fillPrice * quantity) - (cleanNumber(order.brokerage_fee) || 0));
    const existing = store.positions.find((position) => position.ticker === order.ticker && position.currency === order.currency && position.status === "open");
    if (existing) {
      existing.average_entry_price = calculateAverageEntry(existing.quantity, existing.average_entry_price, quantity, fillPrice);
      existing.quantity = (cleanNumber(existing.quantity) || 0) + quantity;
      existing.stop_loss_price = order.stop_loss_price;
      existing.target_price = order.target_price;
      existing.updated_at = now;
    } else {
      store.positions.unshift({
        id: id("position"),
        account_id: store.account.id,
        ticker: order.ticker,
        company_name: order.company_name,
        exchange: order.exchange,
        currency: order.currency,
        quantity,
        average_entry_price: fillPrice,
        stop_loss_price: order.stop_loss_price,
        target_price: order.target_price,
        status: "open",
        opened_at: now,
        updated_at: now,
      });
    }
    const position = store.positions.find((item) => item.ticker === order.ticker && item.currency === order.currency && item.status === "open");
    store.trades.unshift({
      id: id("trade"),
      account_id: store.account.id,
      order_id: order.id,
      position_id: position?.id || null,
      ticker: order.ticker,
      company_name: order.company_name,
      exchange: order.exchange,
      currency: order.currency,
      side: "buy",
      quantity,
      price: fillPrice,
      brokerage_fee: order.brokerage_fee,
      realised_profit_loss: null,
      exit_reason: null,
      traded_at: now,
    });
  } else {
    const position = store.positions.find((item) => item.ticker === order.ticker && item.currency === order.currency && item.status === "open");
    const sale = calculateSale({ quantity: position?.quantity, averageEntry: position?.average_entry_price, saleQuantity: quantity, salePrice: fillPrice, brokerage: order.brokerage_fee });
    if (!position || !sale) {
      order.status = "rejected";
      order.rejection_reason = "Cannot sell more shares than are owned.";
      return;
    }
    position.quantity = sale.remainingQuantity;
    position.status = sale.remainingQuantity > 0 ? "open" : "closed";
    position.updated_at = now;
    position.closed_at = sale.remainingQuantity > 0 ? null : now;
    store.account.available_cash = roundMoney((cleanNumber(store.account.available_cash) || 0) + (fillPrice * quantity) - (cleanNumber(order.brokerage_fee) || 0));
    store.trades.unshift({
      id: id("trade"),
      account_id: store.account.id,
      order_id: order.id,
      position_id: position.id,
      ticker: order.ticker,
      company_name: order.company_name,
      exchange: order.exchange,
      currency: order.currency,
      side: "sell",
      quantity,
      price: fillPrice,
      brokerage_fee: order.brokerage_fee,
      realised_profit_loss: sale.realisedProfit,
      exit_reason: order.exit_reason || "manual",
      traded_at: now,
    });
  }
}

export async function updateLocalPaperSettings(action, payload = {}) {
  const store = await readStore();
  if (action === "reset") {
    if (payload.confirmation !== "RESET PAPER ACCOUNT") throw new Error("Type RESET PAPER ACCOUNT to confirm.");
    const balance = cleanNumber(payload.startingBalance) || DEFAULT_STARTING_BALANCE;
    const next = emptyStore();
    next.account.starting_balance = balance;
    next.account.available_cash = balance;
    await writeStore(next);
    return next.account;
  }
  if (action === "change_starting_balance") {
    const balance = cleanNumber(payload.startingBalance);
    if (!Number.isFinite(balance) || balance <= 0) throw new Error("Starting balance must be positive.");
    store.account.starting_balance = balance;
    store.account.updated_at = new Date().toISOString();
  }
  if (action === "cancel_pending_orders") {
    store.orders = store.orders.map((order) => order.status === "pending" ? { ...order, status: "cancelled", cancelled_at: new Date().toISOString() } : order);
  }
  if (action === "close_positions") {
    store.positions = store.positions.map((position) => position.status === "open" ? { ...position, status: "closed", quantity: 0, closed_at: new Date().toISOString() } : position);
  }
  await writeStore(store);
  return store.account;
}
