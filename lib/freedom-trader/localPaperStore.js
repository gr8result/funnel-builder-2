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
    marketWatch: [],
    journal: [],
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
    journal: store.journal || [],
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

function normalizePlan(input = {}) {
  const symbol = String(input.symbol || input.ticker || "").trim().toUpperCase();
  const buyTrigger = cleanNumber(input.buyTrigger ?? input.limitPrice ?? input.entry);
  const safetyExit = cleanNumber(input.safetyExit ?? input.stopLoss);
  const takeSomeProfit = cleanNumber(input.takeSomeProfit ?? input.target);
  const finalExit = cleanNumber(input.finalExit ?? input.target);
  if (!symbol) throw new Error("Symbol is required.");
  if (![buyTrigger, safetyExit, takeSomeProfit, finalExit].every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error("Complete entry, Safety Exit, Take Some Profit and Final Exit prices are required.");
  }
  if (!(safetyExit < buyTrigger && buyTrigger < takeSomeProfit && takeSomeProfit <= finalExit)) {
    throw new Error("Trade plan order is invalid. Do not trade.");
  }
  return {
    symbol,
    companyName: input.companyName || input.company || symbol,
    exchange: input.exchange || "NASDAQ",
    currency: input.currency || "USD",
    currentPrice: cleanNumber(input.currentPrice),
    marketDataTimestamp: input.marketDataTimestamp || null,
    dataQuality: input.dataQuality || "usable",
    buyTrigger,
    safetyExit,
    takeSomeProfit,
    finalExit,
    setupExpiryDate: input.setupExpiryDate || null,
    invalidationPrice: cleanNumber(input.invalidationPrice),
    rewardToRisk: cleanNumber(input.rewardToRisk ?? input.riskReward),
    quantity: Math.floor(cleanNumber(input.quantity ?? input.positionSizing?.quantity) || 0),
    capitalRequired: cleanNumber(input.capitalRequired ?? input.positionSizing?.capitalRequired),
    maximumPlannedLoss: cleanNumber(input.maximumPlannedLoss ?? input.positionSizing?.maximumPlannedLoss),
    potentialProfitAtTakeSomeProfit: cleanNumber(input.potentialProfitAtTakeSomeProfit ?? input.positionSizing?.potentialProfitAtTakeSomeProfit),
    potentialProfitAtFinalExit: cleanNumber(input.potentialProfitAtFinalExit ?? input.positionSizing?.potentialProfitAtFinalExit),
    reason: input.reason || "",
  };
}

export async function loadLocalMarketWatch() {
  const store = await readStore();
  return {
    marketWatch: Array.isArray(store.marketWatch) ? store.marketWatch : [],
    journal: Array.isArray(store.journal) ? store.journal : [],
    storageMode: "local",
    localStorePath: STORE_PATH,
  };
}

export async function registerLocalMarketWatchPlan(input = {}) {
  const store = await readStore();
  const now = new Date().toISOString();
  const plan = normalizePlan(input);
  const existing = (store.marketWatch || []).find((item) => item.symbol === plan.symbol && ["WAITING_FOR_ENTRY", "POSITION_ACTIVE"].includes(item.state));
  if (existing) {
    existing.plan = plan;
    existing.state = "WAITING_FOR_ENTRY";
    existing.orderEnteredAt = input.orderEnteredAt || now;
    existing.updatedAt = now;
    await writeStore(store);
    return existing;
  }
  const item = {
    id: id("watch"),
    broker: "CMC",
    state: "WAITING_FOR_ENTRY",
    plan,
    orderEnteredAt: input.orderEnteredAt || now,
    filledAt: null,
    actualFillPrice: null,
    actualQuantity: null,
    events: [{ type: "ORDER_ENTERED_IN_CMC", at: now }],
    createdAt: now,
    updatedAt: now,
  };
  store.marketWatch = [item, ...(store.marketWatch || [])];
  await writeStore(store);
  return item;
}

export async function recordLocalMarketWatchFill(input = {}) {
  const store = await readStore();
  const idValue = input.id;
  const symbol = String(input.symbol || "").trim().toUpperCase();
  const item = (store.marketWatch || []).find((row) => (idValue && row.id === idValue) || (symbol && row.plan?.symbol === symbol && row.state === "WAITING_FOR_ENTRY"));
  if (!item) throw new Error("Waiting Market Watch plan was not found.");
  const actualFillPrice = cleanNumber(input.actualFillPrice ?? input.fillPrice);
  const actualQuantity = Math.floor(cleanNumber(input.quantity) || 0);
  const filledAt = input.filledAt || input.dateTime || new Date().toISOString();
  if (!Number.isFinite(actualFillPrice) || actualFillPrice <= 0) throw new Error("Actual fill price is required.");
  if (actualQuantity < 1) throw new Error("Actual quantity is required.");
  item.state = "POSITION_ACTIVE";
  item.actualFillPrice = actualFillPrice;
  item.actualQuantity = actualQuantity;
  item.remainingQuantity = actualQuantity;
  item.soldQuantity = 0;
  item.filledAt = filledAt;
  item.events = [...(item.events || []), { type: "ORDER_FILLED", at: new Date().toISOString(), actualFillPrice, actualQuantity, filledAt }];
  item.updatedAt = new Date().toISOString();
  await writeStore(store);
  return item;
}

function actionKey(report) {
  return `${report.id || report.symbol}:${report.action}:${report.trigger ?? ""}:${report.currentPrice ?? ""}`;
}

export function evaluateMarketWatchItem(item = {}, quote = {}, options = {}) {
  const plan = item.plan || {};
  const symbol = plan.symbol || item.symbol;
  const timestamp = quote.timestamp || quote.lastUpdated || options.timestamp || new Date().toISOString();
  const currentPrice = cleanNumber(quote.price ?? quote.currentPrice);
  const base = {
    id: item.id,
    symbol,
    currentPrice: Number.isFinite(currentPrice) ? currentPrice : null,
    timestamp,
    state: item.state,
    trigger: null,
    action: "HOLD",
    reason: "No action required.",
  };
  if (!quote?.ok || !Number.isFinite(currentPrice) || currentPrice <= 0) {
    return { ...base, action: "REVIEW_DATA_UNAVAILABLE", reason: "Market data is unavailable. Do not act on missing data." };
  }
  if (item.state === "WAITING_FOR_ENTRY") {
    const expiry = Date.parse(plan.setupExpiryDate || item.setupExpiryDate || "");
    if (Number.isFinite(expiry) && Date.parse(timestamp) > expiry) {
      return { ...base, action: "CANCEL_SETUP", reason: "The setup has expired before entry." };
    }
    const invalidationPrice = cleanNumber(plan.invalidationPrice);
    if (Number.isFinite(invalidationPrice) && currentPrice <= invalidationPrice) {
      return { ...base, trigger: invalidationPrice, action: "CANCEL_SETUP", reason: "The setup has invalidated before entry." };
    }
    if (currentPrice <= cleanNumber(plan.buyTrigger)) {
      return { ...base, trigger: cleanNumber(plan.buyTrigger), action: "ENTRY_CONDITION_REACHED", reason: "Review CMC. The entry condition has been reached, but Freedom cannot confirm a broker fill." };
    }
    return { ...base, trigger: cleanNumber(plan.buyTrigger), action: "WAIT", reason: "Waiting for the preferred entry." };
  }
  if (item.state !== "POSITION_ACTIVE") return { ...base, action: item.state === "TRADE_COMPLETED" ? "TRADE_COMPLETE" : "HOLD" };
  if (!Number.isFinite(cleanNumber(item.actualFillPrice)) || !Number.isFinite(cleanNumber(item.actualQuantity))) {
    return { ...base, action: "REVIEW_DATA_UNAVAILABLE", reason: "Position Active is missing actual fill information." };
  }
  const remaining = cleanNumber(item.remainingQuantity ?? item.actualQuantity) || 0;
  if (remaining <= 0) return { ...base, action: "TRADE_COMPLETE", reason: "No remaining shares." };
  const safetyExit = cleanNumber(plan.safetyExit);
  const takeSomeProfit = cleanNumber(plan.takeSomeProfit);
  const finalExit = cleanNumber(plan.finalExit);
  if (Number.isFinite(safetyExit) && currentPrice <= safetyExit) return { ...base, trigger: safetyExit, action: "SAFETY_EXIT", reason: "Safety Exit reached." };
  if (Number.isFinite(finalExit) && currentPrice >= finalExit) return { ...base, trigger: finalExit, action: "FINAL_EXIT", reason: "Final Exit reached." };
  if (Number.isFinite(takeSomeProfit) && currentPrice >= takeSomeProfit && !item.takeSomeProfitAcknowledgedAt) {
    if (remaining === 1) {
      return { ...base, trigger: takeSomeProfit, action: "ONE_SHARE_EXIT_CHOICE_REQUIRED", reason: oneShareExitOptions({ quantity: 1 }).message };
    }
    return { ...base, trigger: takeSomeProfit, action: "TAKE_SOME_PROFIT", reason: "Take Some Profit reached." };
  }
  return { ...base, action: "HOLD", reason: "Position remains within the plan." };
}

export async function checkLocalMarketWatch(input = {}) {
  const store = await readStore();
  const quotes = input.quotes || {};
  const reports = [];
  store.marketWatch = (store.marketWatch || []).map((item) => {
    const quote = quotes[item.plan?.symbol] || quotes[item.symbol] || input.quote || {};
    const report = evaluateMarketWatchItem(item, quote, input);
    const key = actionKey(report);
    const duplicate = item.lastActionKey === key;
    reports.push({ ...report, duplicateAlert: duplicate });
    if (!duplicate && !["HOLD", "WAIT", "TRADE_COMPLETE"].includes(report.action)) {
      item.events = [...(item.events || []), { type: report.action, at: report.timestamp, currentPrice: report.currentPrice, trigger: report.trigger, reason: report.reason }];
      item.lastActionKey = key;
      item.lastActionAt = report.timestamp;
    }
    if (report.action === "CANCEL_SETUP") item.state = "SETUP_CANCELLED";
    item.updatedAt = new Date().toISOString();
    return item;
  });
  await writeStore(store);
  return { reports, marketWatch: store.marketWatch };
}

function holdingPeriodDays(entryDate, exitDate) {
  const start = Date.parse(entryDate || "");
  const end = Date.parse(exitDate || "");
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, Math.ceil((end - start) / 86400000));
}

export async function recordLocalMarketWatchSale(input = {}) {
  const store = await readStore();
  const idValue = input.id;
  const symbol = String(input.symbol || "").trim().toUpperCase();
  const item = (store.marketWatch || []).find((row) => (idValue && row.id === idValue) || (symbol && row.plan?.symbol === symbol && row.state === "POSITION_ACTIVE"));
  if (!item) throw new Error("Active Market Watch position was not found.");
  const quantitySold = Math.floor(cleanNumber(input.quantitySold ?? input.quantity) || 0);
  const salePrice = cleanNumber(input.salePrice ?? input.actualSalePrice);
  const soldAt = input.soldAt || input.dateTime || new Date().toISOString();
  const reason = input.reason || "manual";
  const remainingBefore = cleanNumber(item.remainingQuantity ?? item.actualQuantity) || 0;
  if (quantitySold < 1 || quantitySold > remainingBefore) throw new Error("Sale quantity must be between 1 and the remaining quantity.");
  if (!Number.isFinite(salePrice) || salePrice <= 0) throw new Error("Actual sale price is required.");
  const fees = cleanNumber(input.fees ?? input.brokerageFee) || 0;
  const grossProfit = roundMoney((salePrice - cleanNumber(item.actualFillPrice)) * quantitySold);
  const netProfit = roundMoney(grossProfit - fees);
  item.remainingQuantity = remainingBefore - quantitySold;
  item.soldQuantity = (cleanNumber(item.soldQuantity) || 0) + quantitySold;
  item.events = [...(item.events || []), { type: "SALE_RECORDED", at: new Date().toISOString(), quantitySold, salePrice, soldAt, reason, grossProfit, netProfit }];
  item.state = item.remainingQuantity > 0 ? "POSITION_ACTIVE" : "TRADE_COMPLETED";
  item.updatedAt = new Date().toISOString();
  if (item.state === "TRADE_COMPLETED") {
    const plan = item.plan || {};
    const journal = {
      id: id("journal"),
      marketWatchId: item.id,
      companyName: plan.companyName,
      symbol: plan.symbol,
      entryDate: item.filledAt,
      entryPrice: cleanNumber(item.actualFillPrice),
      quantity: cleanNumber(item.actualQuantity),
      exitDate: soldAt,
      exitPrice: salePrice,
      grossProfit,
      estimatedFees: fees,
      netProfit,
      holdingPeriodDays: holdingPeriodDays(item.filledAt, soldAt),
      originalSafetyExit: plan.safetyExit,
      originalTargets: { takeSomeProfit: plan.takeSomeProfit, finalExit: plan.finalExit },
      exitReason: reason,
      strategy: plan.reason || "Freedom Trader setup",
      rewardToRisk: plan.rewardToRisk,
      rulesFollowed: Boolean(input.rulesFollowed ?? true),
      createdAt: new Date().toISOString(),
    };
    store.journal = [journal, ...(store.journal || [])];
    item.journalId = journal.id;
  }
  await writeStore(store);
  return item;
}

export function oneShareExitOptions(positionOrPlan = {}) {
  const quantity = Math.floor(cleanNumber(positionOrPlan.quantity ?? positionOrPlan.actualQuantity) || 0);
  if (quantity !== 1) return { requiresChoice: false, action: "TAKE_SOME_PROFIT" };
  return {
    requiresChoice: true,
    choices: ["Sell at first target", "Hold for final target"],
    message: "One-share positions cannot sell half. Choose whether to sell at the first target or hold for the final target.",
  };
}
