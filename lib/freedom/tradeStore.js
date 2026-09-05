/**
 * Storage for manually entered Freedom trades.
 *
 * Deliberately separate from lib/freedom-trader/localPaperStore.js: that store models a
 * simulated broker account (orders, fills, cash). This one records what the user actually
 * did or intends to do, which is a much simpler shape and must stay reliable.
 *
 * A short-term trade is "pending" until its entry price trades. Pending trades are shown
 * as "Waiting for Entry" and never counted as open positions.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { brokerHoldingValuation, editBrokerHolding } from "./brokerHoldingsSnapshot.js";
import { importFingerprint as buildImportFingerprint } from "./tradeImport.js";

function storePath() {
  return process.env.FREEDOM_TRADE_STORE_PATH || path.join(process.cwd(), "tmp", "freedom-trades.json");
}

let writeQueue = Promise.resolve();

function emptyStore() {
  return { version: 1, shortTermTrades: [], longTermHoldings: [], tradeImports: [], updatedAt: null };
}

function legacyPaperStorePath() {
  if (process.env.FREEDOM_PAPER_STORE_PATH) return process.env.FREEDOM_PAPER_STORE_PATH;
  if (process.env.FREEDOM_TRADE_STORE_PATH) return null;
  return path.join(process.cwd(), "tmp", "freedom-paper-local.json");
}

function newId(prefix) {
  return prefix + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

export function numberValue(value) {
  // Number(null), Number("") and Number(false) are all 0. Treating those as a real price
  // would let a missing quote trigger a pending trade, so reject them outright.
  if (value === null || value === undefined || value === "" || typeof value === "boolean") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, decimals = 2) {
  const number = numberValue(value);
  return number === null ? null : Number(number.toFixed(decimals));
}

function normalizeSymbol(value) {
  return String(value || "").trim().toUpperCase();
}

function isoDate(value) {
  if (!value) return null;
  const raw = String(value);
  const parsed = Date.parse(raw.length <= 10 ? raw + "T00:00:00Z" : raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

async function readStore() {
  try {
    const parsed = JSON.parse(await readFile(storePath(), "utf8"));
    if (!parsed || !Array.isArray(parsed.shortTermTrades) || !Array.isArray(parsed.longTermHoldings)) {
      throw new Error("Invalid Freedom portfolio store: holdings and trades must be arrays.");
    }
    return await mergeLegacyFreedomStore({
      ...emptyStore(),
      ...parsed,
      shortTermTrades: Array.isArray(parsed?.shortTermTrades) ? parsed.shortTermTrades : [],
      longTermHoldings: Array.isArray(parsed?.longTermHoldings) ? parsed.longTermHoldings : [],
      tradeImports: Array.isArray(parsed?.tradeImports) ? parsed.tradeImports : [],
    });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return await mergeLegacyFreedomStore(emptyStore());
  }
}

function hasRecord(rows = [], candidate = {}) {
  return rows.some((row) => row.id === candidate.id || (
    row.sourceLegacyId && candidate.sourceLegacyId && row.sourceLegacyId === candidate.sourceLegacyId
  ));
}

function legacyMarketWatchToTrade(item = {}) {
  const plan = item.plan || {};
  const symbol = normalizeSymbol(plan.symbol || item.symbol);
  if (!symbol) return null;
  const status = String(item.state || "").toUpperCase() === "ACTIVE" ? "open"
    : String(item.state || "").toUpperCase() === "COMPLETED" ? "closed"
    : "pending";
  const trade = {
    id: "legacy_market_watch_" + String(item.id || symbol).replace(/[^a-z0-9_-]/gi, "_"),
    kind: "short-term",
    symbol,
    exchange: String(plan.exchange || item.exchange || "US").trim().toUpperCase(),
    currency: String(plan.currency || item.currency || "USD").trim().toUpperCase(),
    companyName: plan.companyName || item.companyName || null,
    entryPrice: status === "open" || status === "closed" ? (item.actualFillPrice || plan.buyTrigger) : plan.buyTrigger,
    quantity: status === "open" || status === "closed" ? (item.actualQuantity || plan.quantity || 1) : (plan.quantity || 1),
    entryDate: item.filledAt || item.orderEnteredAt || item.createdAt,
    safetyExit: plan.safetyExit,
    takeSomeProfit: plan.takeSomeProfit,
    finalExit: plan.finalExit,
    status,
    importedOrder: false,
    broker: item.broker || "CMC",
    termClassification: "short-term",
    requiresFillConfirmation: status === "pending",
    notes: plan.reason || null,
    sourceLegacyId: item.id || null,
    sourceStorage: "tmp/freedom-paper-local.json:marketWatch",
    orderHistory: Array.isArray(item.events) ? item.events : [],
    createdAt: item.createdAt || item.orderEnteredAt || new Date().toISOString(),
    updatedAt: item.updatedAt || new Date().toISOString(),
  };
  const validated = validateShortTermTrade(trade);
  return validated.ok ? validated.value : null;
}

async function mergeLegacyFreedomStore(store) {
  const legacyPath = legacyPaperStorePath();
  if (!legacyPath) return store;
  try {
    const legacy = JSON.parse(await readFile(legacyPath, "utf8"));
    const legacyTrades = (Array.isArray(legacy?.marketWatch) ? legacy.marketWatch : [])
      .map(legacyMarketWatchToTrade)
      .filter(Boolean);
    let added = 0;
    for (const trade of legacyTrades) {
      if (!hasRecord(store.shortTermTrades, trade) && !hasRecord(store.longTermHoldings, trade)) {
        store.shortTermTrades.push(trade);
        added += 1;
      }
    }
    if (added) Object.defineProperty(store, "__legacyMerged", { value: added, enumerable: false });
  } catch {}
  return store;
}

async function writeStoreSnapshot(store) {
  const target = storePath();
  const snapshot = { ...store, updatedAt: new Date().toISOString() };
  delete snapshot.__legacyMerged;
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(snapshot, null, 2));
}

/** Serialised so concurrent API calls cannot clobber each other's writes. */
async function mutateStore(mutator) {
  const task = writeQueue.then(async () => {
    const target = storePath();
    const store = await readStore();
    const result = await mutator(store);
    store.updatedAt = new Date().toISOString();
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, JSON.stringify(store, null, 2));
    return result;
  });
  writeQueue = task.then(() => undefined, () => undefined);
  return task;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate a manually entered short-term trade. Returns { ok, errors, value }.
 * Rejects anything that would produce nonsensical profit/loss maths downstream.
 */
export function validateShortTermTrade(input = {}) {
  const errors = [];
  const symbol = normalizeSymbol(input.symbol);
  const exchange = String(input.exchange || "").trim().toUpperCase();
  const entryPrice = numberValue(input.entryPrice);
  const quantity = numberValue(input.quantity);
  const safetyExit = numberValue(input.safetyExit);
  const takeSomeProfit = numberValue(input.takeSomeProfit);
  const finalExit = numberValue(input.finalExit);
  const entryDate = isoDate(input.entryDate);
  const importedPendingOrder = Boolean(input.importedOrder) && (input.status || "pending") === "pending";

  if (!symbol) errors.push("Ticker is required.");
  if (!exchange) errors.push("Exchange is required.");
  if (entryPrice === null || entryPrice <= 0) errors.push("Entry price must be a positive number.");
  if (quantity === null || quantity <= 0) errors.push("Quantity must be a positive number.");
  if (!entryDate) errors.push("Date is required and must be a valid date.");
  if (!importedPendingOrder && (safetyExit === null || safetyExit <= 0)) errors.push("Safety Exit must be a positive number.");
  if (!importedPendingOrder && (takeSomeProfit === null || takeSomeProfit <= 0)) errors.push("Take Some Profit target must be a positive number.");
  if (!importedPendingOrder && (finalExit === null || finalExit <= 0)) errors.push("Final Exit target must be a positive number.");

  if (safetyExit !== null && entryPrice !== null && safetyExit >= entryPrice) {
    errors.push("Safety Exit must be below the entry price.");
  }
  if (takeSomeProfit !== null && entryPrice !== null && takeSomeProfit <= entryPrice) {
    errors.push("Take Some Profit must be above the entry price.");
  }
  if (takeSomeProfit !== null && finalExit !== null && finalExit < takeSomeProfit) {
    errors.push("Final Exit must be at or above Take Some Profit.");
  }

  const status = input.status === "closed" ? "closed" : input.status === "open" ? "open" : "pending";
  if (errors.length) return { ok: false, errors, value: null };

  return {
    ok: true,
    errors: [],
    value: {
      id: input.id || newId("st"),
      kind: "short-term",
      symbol,
      exchange,
      currency: String(input.currency || "USD").trim().toUpperCase(),
      companyName: input.companyName ? String(input.companyName).trim() : null,
      entryPrice: round(entryPrice, importedPendingOrder ? 4 : 2),
      quantity: round(quantity, 4),
      entryDate,
      safetyExit: round(safetyExit),
      takeSomeProfit: round(takeSomeProfit),
      finalExit: round(finalExit),
      status,
      importedOrder: Boolean(input.importedOrder),
      broker: input.broker ? String(input.broker).trim() : null,
      side: input.side ? String(input.side).trim().toUpperCase() : "BUY",
      orderStatus: input.orderStatus ? String(input.orderStatus).trim() : null,
      orderClassification: input.orderClassification || null,
      importFingerprint: input.importFingerprint || null,
      averageFilledPrice: round(input.averageFilledPrice),
      filledQuantity: round(input.filledQuantity),
      expiry: input.expiry || null,
      goodTillCancelled: Boolean(input.goodTillCancelled),
      termClassification: input.termClassification || "short-term",
      requiresFillConfirmation: input.requiresFillConfirmation !== false && Boolean(input.importedOrder),
      orderHistory: Array.isArray(input.orderHistory) ? input.orderHistory : [],
      notes: input.notes ? String(input.notes).trim() : null,
      sourceSymbolResolved: input.sourceSymbolResolved || null,
      sourceLegacyId: input.sourceLegacyId || null,
      sourceStorage: input.sourceStorage || null,
      createdAt: input.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
}

/** Validate a manually entered long-term holding. */
export function validateLongTermHolding(input = {}) {
  const errors = [];
  const symbol = normalizeSymbol(input.symbol);
  const exchange = String(input.exchange || "").trim().toUpperCase();
  const purchasePrice = numberValue(input.purchasePrice);
  const quantity = numberValue(input.quantity);
  const purchaseDate = isoDate(input.purchaseDate);
  const reason = String(input.reason || "").trim();
  const targetPrice = numberValue(input.targetPrice);
  const safetyExit = numberValue(input.safetyExit);

  if (!symbol) errors.push("Ticker is required.");
  if (!exchange) errors.push("Exchange is required.");
  if (purchasePrice === null || purchasePrice <= 0) errors.push("Purchase price must be a positive number.");
  if (quantity === null || quantity <= 0) errors.push("Quantity must be a positive number.");
  if (!purchaseDate) errors.push("Purchase date is required and must be a valid date.");
  if (!reason) errors.push("An investment reason is required.");

  if (targetPrice !== null && targetPrice <= 0) errors.push("Target price must be a positive number or empty.");
  if (safetyExit !== null && safetyExit <= 0) errors.push("Safety Exit must be a positive number or empty.");
  if (targetPrice !== null && purchasePrice !== null && targetPrice <= purchasePrice) {
    errors.push("Target price must be above purchase price.");
  }
  if (safetyExit !== null && purchasePrice !== null && safetyExit >= purchasePrice) {
    errors.push("Safety Exit must be below purchase price.");
  }

  if (errors.length) return { ok: false, errors, value: null };

  return {
    ok: true,
    errors: [],
    value: {
      id: input.id || newId("lt"),
      kind: "long-term",
      symbol,
      exchange,
      currency: String(input.currency || "USD").trim().toUpperCase(),
      companyName: input.companyName ? String(input.companyName).trim() : null,
      purchasePrice: round(purchasePrice, 4),
      quantity: round(quantity, 4),
      purchaseDate,
      reason,
      targetPrice: round(targetPrice),
      safetyExit: round(safetyExit),
      broker: input.broker ? String(input.broker).trim() : null,
      importFingerprint: input.importFingerprint || null,
      sourceTradeId: input.sourceTradeId || null,
      sourceLegacyId: input.sourceLegacyId || null,
      sourceStorage: input.sourceStorage || null,
      createdAt: input.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
}

// ---------------------------------------------------------------------------
// Live enrichment
// ---------------------------------------------------------------------------

/**
 * Decide whether a pending trade has triggered.
 *
 * A pending long entry triggers when price trades at or below the entry price. Without a
 * valid current price the trade stays exactly as it was - Freedom never guesses a fill.
 */
export function resolvePendingStatus(trade = {}, currentPrice = null) {
  if (trade.status !== "pending") return trade.status;
  if (trade.requiresFillConfirmation || trade.importedOrder) return "pending";
  const price = numberValue(currentPrice);
  if (price === null) return "pending";
  const entry = numberValue(trade.entryPrice);
  if (entry === null) return "pending";
  return price <= entry ? "open" : "pending";
}

const STATUS_LABELS = {
  pending: "Waiting for Entry",
  open: "Open",
  closed: "Closed",
};

/**
 * Attach live price, profit/loss and a display status to a short-term trade.
 * `quote` is { price, timestamp } or null when market data is unavailable.
 */
export function enrichShortTermTrade(trade = {}, quote = null) {
  if (trade.brokerHoldingSnapshot && trade.status === "open") return brokerHoldingValuation(trade);
  const currentPrice = numberValue(quote?.price);
  const entryPrice = numberValue(trade.entryPrice);
  const quantity = numberValue(trade.quantity);
  const dataAvailable = currentPrice !== null;

  const effectiveStatus = trade.status === "closed" ? "closed" : resolvePendingStatus(trade, currentPrice);
  const amountInvested = entryPrice !== null && quantity !== null ? round(entryPrice * quantity) : null;

  // Profit and loss is only meaningful once the position is actually open.
  const isOpen = effectiveStatus === "open";
  const marketValue = isOpen && dataAvailable && quantity !== null ? round(currentPrice * quantity) : null;
  const profitLoss = isOpen && dataAvailable && entryPrice !== null && quantity !== null
    ? round((currentPrice - entryPrice) * quantity)
    : null;
  const profitLossPercent = isOpen && dataAvailable && entryPrice !== null && entryPrice > 0
    ? round(((currentPrice - entryPrice) / entryPrice) * 100)
    : null;

  let tone = "grey";
  if (!dataAvailable) tone = "grey";
  else if (effectiveStatus === "pending") tone = "blue";
  else if (currentPrice !== null && numberValue(trade.safetyExit) !== null && currentPrice <= trade.safetyExit) tone = "red";
  else if (profitLoss !== null && profitLoss >= 0) tone = "green";
  else if (profitLoss !== null && profitLoss < 0) tone = "amber";

  const safetyExitBreached = dataAvailable && numberValue(trade.safetyExit) !== null && currentPrice <= trade.safetyExit;
  const takeSomeProfitHit = dataAvailable && isOpen && numberValue(trade.takeSomeProfit) !== null && currentPrice >= trade.takeSomeProfit;
  const finalExitHit = dataAvailable && isOpen && numberValue(trade.finalExit) !== null && currentPrice >= trade.finalExit;

  let statusMessage = STATUS_LABELS[effectiveStatus] || "Unknown";
  if (!dataAvailable) statusMessage = "Market data unavailable";
  else if (safetyExitBreached) statusMessage = "Safety Exit reached - exit this trade";
  else if (finalExitHit) statusMessage = "Final Exit target reached";
  else if (takeSomeProfitHit) statusMessage = "Take Some Profit target reached";

  return {
    ...trade,
    effectiveStatus,
    statusLabel: STATUS_LABELS[effectiveStatus] || "Unknown",
    statusMessage,
    tone,
    dataAvailable,
    currentPrice,
    dataTimestamp: quote?.timestamp || null,
    amountInvested,
    estimatedOrderValue: amountInvested,
    distanceFromLimit: currentPrice !== null && entryPrice !== null ? round(currentPrice - entryPrice) : null,
    distanceFromLimitPercent: currentPrice !== null && entryPrice !== null && entryPrice > 0 ? round(((currentPrice - entryPrice) / entryPrice) * 100) : null,
    notYetOwned: effectiveStatus === "pending",
    marketValue,
    profitLoss,
    profitLossPercent,
    safetyExitBreached,
    takeSomeProfitHit,
    finalExitHit,
  };
}

/** Attach live price, current value and profit/loss to a long-term holding. */
export function enrichLongTermHolding(holding = {}, quote = null) {
  if (holding.brokerHoldingSnapshot && holding.status !== "archived") return brokerHoldingValuation(holding);
  const currentPrice = numberValue(quote?.price);
  const purchasePrice = numberValue(holding.purchasePrice);
  const targetPrice = numberValue(holding.targetPrice);
  const safetyExit = numberValue(holding.safetyExit);
  const quantity = numberValue(holding.quantity);
  const dataAvailable = currentPrice !== null;

  const amountInvested = purchasePrice !== null && quantity !== null ? round(purchasePrice * quantity) : null;
  const currentValue = dataAvailable && quantity !== null ? round(currentPrice * quantity) : null;
  const profitLoss = currentValue !== null && amountInvested !== null ? round(currentValue - amountInvested) : null;
  const profitLossPercent = profitLoss !== null && amountInvested ? round((profitLoss / amountInvested) * 100) : null;

  // Distance to target and safety exit
  const distanceToTarget = dataAvailable && targetPrice !== null && currentPrice !== null 
    ? round(targetPrice - currentPrice) : null;
  const distanceToTargetPercent = dataAvailable && targetPrice !== null && currentPrice !== null && currentPrice > 0
    ? round(((targetPrice - currentPrice) / currentPrice) * 100) : null;
  const distanceToSafetyExit = dataAvailable && safetyExit !== null && currentPrice !== null
    ? round(currentPrice - safetyExit) : null;
  const distanceToSafetyExitPercent = dataAvailable && safetyExit !== null && currentPrice !== null && currentPrice > 0
    ? round(((currentPrice - safetyExit) / currentPrice) * 100) : null;

  const safetyExitBreached = dataAvailable && safetyExit !== null && currentPrice <= safetyExit;
  const targetHit = dataAvailable && targetPrice !== null && currentPrice >= targetPrice;

  let tone = "grey";
  if (!dataAvailable) tone = "grey";
  else if (safetyExitBreached) tone = "red";
  else if (profitLoss !== null && profitLoss >= 0) tone = "green";
  else if (profitLoss !== null && profitLoss < 0) tone = "amber";

  return {
    ...holding,
    dataAvailable,
    currentPrice,
    dataTimestamp: quote?.timestamp || null,
    amountInvested,
    currentValue,
    profitLoss,
    profitLossPercent,
    distanceToTarget,
    distanceToTargetPercent,
    distanceToSafetyExit,
    distanceToSafetyExitPercent,
    safetyExitBreached,
    targetHit,
    tone,
    statusMessage: dataAvailable ? "Held" : "Market data unavailable",
  };
}

/** Totals for the Long-Term Portfolio page. Rows without data are excluded, not zeroed. */
export function longTermTotals(rows = []) {
  const priced = rows.filter((row) => row.dataAvailable && row.currentValue !== null && row.amountInvested !== null);
  const invested = priced.reduce((total, row) => total + row.amountInvested, 0);
  const value = priced.reduce((total, row) => total + row.currentValue, 0);
  return {
    holdings: rows.length,
    pricedHoldings: priced.length,
    unpricedHoldings: rows.length - priced.length,
    amountInvested: round(invested),
    currentValue: round(value),
    profitLoss: round(value - invested),
    profitLossPercent: invested ? round(((value - invested) / invested) * 100) : null,
  };
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export async function listShortTermTrades() {
  const store = await readStore();
  if (store.__legacyMerged) await writeStoreSnapshot(store);
  return store.shortTermTrades;
}

export async function listArchivedHoldings() {
  const store = await readStore();
  return store.archivedHoldings || [];
}

export async function listLongTermHoldings() {
  const store = await readStore();
  if (store.__legacyMerged) await writeStoreSnapshot(store);
  return store.longTermHoldings;
}

export async function addShortTermTrade(input) {
  const validated = validateShortTermTrade(input);
  if (!validated.ok) return validated;
  return mutateStore(async (store) => {
    store.shortTermTrades.push(validated.value);
    return validated;
  });
}

function importEvent(row = {}, type = "IMPORTED") {
  return {
    type,
    at: new Date().toISOString(),
    fingerprint: row.importFingerprint || null,
    classification: row.classification || row.orderClassification || null,
    source: row.broker || null,
  };
}

function orderEvent(type, details = {}) {
  return {
    type,
    at: new Date().toISOString(),
    ...details,
  };
}

function tradeFromImportRow(row = {}) {
  const filled = numberValue(row.averageFilledPrice);
  const filledQuantity = numberValue(row.filledQuantity);
  const isFilled = ["COMPLETED_PURCHASE", "PARTIALLY_FILLED_ORDER"].includes(row.classification) && filled !== null && filledQuantity !== null && filledQuantity > 0;
  return {
    symbol: row.symbol,
    exchange: row.exchange || (row.currency === "AUD" ? "ASX" : "US"),
    currency: row.currency || "USD",
    companyName: row.companyName || null,
    entryPrice: isFilled ? filled : row.limitPrice,
    quantity: isFilled ? filledQuantity : row.quantity,
    entryDate: row.orderDate || new Date().toISOString().slice(0, 10),
    safetyExit: row.safetyExit,
    takeSomeProfit: row.target1,
    finalExit: row.target2,
    status: isFilled ? "open" : "pending",
    importedOrder: true,
    broker: row.broker,
    side: row.side || "BUY",
    orderStatus: isFilled ? "Filled" : "Waiting for Entry",
    orderClassification: row.classification,
    importFingerprint: row.importFingerprint,
    averageFilledPrice: row.averageFilledPrice,
    filledQuantity: row.filledQuantity,
    expiry: row.expiry,
    goodTillCancelled: row.goodTillCancelled,
    termClassification: row.termClassification || "short-term",
    requiresFillConfirmation: !isFilled,
    orderHistory: [importEvent(row, isFilled ? "FILLED_IMPORT" : "ORDER_IMPORT")],
    notes: row.notes || null,
  };
}

function holdingFromImportRow(row = {}) {
  const filled = numberValue(row.averageFilledPrice);
  const filledQuantity = numberValue(row.filledQuantity);
  return {
    id: row.importFingerprint ? "lt_imp_" + row.importFingerprint : undefined,
    symbol: row.symbol,
    exchange: row.exchange || (row.currency === "AUD" ? "ASX" : "US"),
    currency: row.currency || "USD",
    companyName: row.companyName || null,
    purchasePrice: filled ?? row.limitPrice,
    quantity: filledQuantity ?? row.quantity,
    purchaseDate: row.orderDate || new Date().toISOString().slice(0, 10),
    reason: row.notes || "Imported broker purchase marked as long-term.",
    broker: row.broker,
    importFingerprint: row.importFingerprint,
    sourceStorage: "freedom-trades.json:longTermHoldings",
  };
}

function holdingFromShortTermTrade(trade = {}, patch = {}) {
  return {
    id: patch.longTermId || "lt_from_" + trade.id,
    symbol: patch.symbol ?? trade.symbol,
    exchange: patch.exchange ?? trade.exchange,
    currency: patch.currency ?? trade.currency,
    companyName: patch.companyName ?? trade.companyName,
    purchasePrice: patch.purchasePrice ?? patch.entryPrice ?? trade.entryPrice,
    quantity: patch.quantity ?? trade.quantity,
    purchaseDate: patch.purchaseDate ?? patch.entryDate ?? trade.entryDate,
    reason: patch.reason || patch.notes || trade.notes || "Moved from My Trades as a long-term holding.",
    sourceTradeId: trade.id,
    sourceLegacyId: trade.sourceLegacyId || null,
    sourceStorage: "freedom-trades.json:shortTermTrades",
    createdAt: trade.createdAt,
  };
}

function shortTermTradeFromHolding(holding = {}, patch = {}) {
  const targetPrice = patch.targetPrice ?? holding.targetPrice;
  return {
    id: patch.shortTermId || holding.id,
    symbol: patch.symbol ?? holding.symbol,
    exchange: patch.exchange ?? holding.exchange,
    currency: patch.currency ?? holding.currency,
    companyName: patch.companyName ?? holding.companyName,
    entryPrice: patch.entryPrice ?? patch.purchasePrice ?? holding.purchasePrice,
    quantity: patch.quantity ?? holding.quantity,
    entryDate: patch.entryDate ?? patch.purchaseDate ?? holding.purchaseDate,
    safetyExit: patch.safetyExit ?? holding.safetyExit,
    takeSomeProfit: patch.takeSomeProfit ?? targetPrice,
    finalExit: patch.finalExit ?? targetPrice,
    status: patch.status || "open",
    importedOrder: false,
    broker: patch.broker ?? holding.broker,
    termClassification: "short-term",
    requiresFillConfirmation: false,
    notes: patch.notes || holding.reason || "Moved from long-term holding in My Trades.",
    sourceLegacyId: holding.sourceLegacyId || null,
    sourceStorage: "freedom-trades.json:longTermHoldings",
    createdAt: holding.createdAt,
  };
}

export async function importReviewedTrades(rows = []) {
  return mutateStore(async (store) => {
    const reports = [];
    for (const input of rows) {
      const row = { ...input, importFingerprint: buildImportFingerprint(input) };
      if (!row.checked) {
        reports.push({ row, result: "skipped", reason: "Row was not selected." });
        continue;
      }
      if (Array.isArray(row.uncertainFields) && row.uncertainFields.length) {
        reports.push({ row, result: "conflict", reason: "Uncertain fields require manual review." });
        continue;
      }
      if (row.side === "SELL" && !["COMPLETED_SALE", "PENDING_SELL_ORDER"].includes(row.classification)) {
        reports.push({ row, result: "conflict", reason: "Sell row classification is unclear." });
        continue;
      }
      if (row.classification === "CURRENT_HOLDING" || row.classification === "HISTORICAL_TRANSACTION") {
        reports.push({ row, result: "skipped", reason: "Historical rows and holdings are not imported as active trades from this screen." });
        continue;
      }

      const existing = store.shortTermTrades.find((trade) => trade.importFingerprint && trade.importFingerprint === row.importFingerprint);
      if (existing) {
        if (["COMPLETED_PURCHASE", "PARTIALLY_FILLED_ORDER"].includes(row.classification) && numberValue(row.averageFilledPrice) !== null && numberValue(row.filledQuantity) !== null) {
          if (row.termClassification === "long-term" || existing.termClassification === "long-term") {
            const holdingInput = holdingFromImportRow(row);
            const validatedHolding = validateLongTermHolding(holdingInput);
            if (!validatedHolding.ok) {
              reports.push({ row, result: "conflict", reason: validatedHolding.errors.join(" ") });
              continue;
            }
            const holdingIndex = store.longTermHoldings.findIndex((holding) => holding.importFingerprint && holding.importFingerprint === row.importFingerprint);
            if (holdingIndex === -1) store.longTermHoldings.push(validatedHolding.value);
            else store.longTermHoldings[holdingIndex] = { ...store.longTermHoldings[holdingIndex], ...validatedHolding.value, id: store.longTermHoldings[holdingIndex].id };
            store.shortTermTrades = store.shortTermTrades.filter((trade) => trade.id !== existing.id);
            reports.push({ row, result: holdingIndex === -1 ? "moved_to_long_term" : "updated_long_term", id: validatedHolding.value.id });
            continue;
          }
          existing.status = "open";
          existing.entryPrice = round(row.averageFilledPrice);
          existing.quantity = round(row.filledQuantity, 4);
          existing.averageFilledPrice = round(row.averageFilledPrice);
          existing.filledQuantity = round(row.filledQuantity, 4);
          existing.requiresFillConfirmation = false;
          existing.orderStatus = "Filled";
          existing.orderClassification = row.classification;
          existing.triggeredAt = existing.triggeredAt || new Date().toISOString();
          existing.orderHistory = [...(existing.orderHistory || []), importEvent(row, "FILLED_IMPORT_UPDATED")];
          existing.updatedAt = new Date().toISOString();
          reports.push({ row, result: "updated", id: existing.id });
        } else {
          reports.push({ row, result: "already_imported", id: existing.id });
        }
        continue;
      }

      if (row.classification === "COMPLETED_SALE" || row.classification === "PENDING_SELL_ORDER") {
        reports.push({ row, result: "conflict", reason: "Sell orders require an existing matching trade before import." });
        continue;
      }

      if (row.termClassification === "long-term" && ["COMPLETED_PURCHASE", "PARTIALLY_FILLED_ORDER"].includes(row.classification)) {
        const validatedHolding = validateLongTermHolding(holdingFromImportRow(row));
        if (!validatedHolding.ok) {
          reports.push({ row, result: "conflict", reason: validatedHolding.errors.join(" ") });
          continue;
        }
        const existingHolding = store.longTermHoldings.find((holding) => holding.importFingerprint && holding.importFingerprint === row.importFingerprint);
        if (existingHolding) reports.push({ row, result: "already_imported", id: existingHolding.id });
        else {
          store.longTermHoldings.push(validatedHolding.value);
          reports.push({ row, result: "new_long_term", id: validatedHolding.value.id });
        }
        continue;
      }

      const validated = validateShortTermTrade(tradeFromImportRow(row));
      if (!validated.ok) {
        reports.push({ row, result: "conflict", reason: validated.errors.join(" ") });
        continue;
      }
      store.shortTermTrades.push(validated.value);
      reports.push({ row, result: "new", id: validated.value.id });
    }
    store.tradeImports = [
      ...(store.tradeImports || []),
      {
        id: newId("imp"),
        at: new Date().toISOString(),
        rowCount: rows.length,
        reports: reports.map((report) => ({
          result: report.result,
          fingerprint: report.row?.importFingerprint || null,
          symbol: report.row?.symbol || null,
          reason: report.reason || null,
          id: report.id || null,
        })),
      },
    ];
    return { ok: true, reports };
  });
}

export async function addLongTermHolding(input) {
  const validated = validateLongTermHolding(input);
  if (!validated.ok) return validated;
  return mutateStore(async (store) => {
    store.longTermHoldings.push(validated.value);
    return validated;
  });
}

export async function updateShortTermTrade(id, patch = {}) {
  return mutateStore(async (store) => {
    const index = store.shortTermTrades.findIndex((row) => row.id === id);
    if (index === -1) return { ok: false, errors: ["Trade not found."], value: null };
    const current = store.shortTermTrades[index];
    if (current.brokerHoldingSnapshot) {
      const result = editBrokerHolding(current, patch);
      if (result.ok) {
        if (patch.termClassification === "long-term") {
          result.value.kind = "long-term";
          result.value.termClassification = "long-term";
          store.shortTermTrades.splice(index, 1);
          store.longTermHoldings.push(result.value);
        } else store.shortTermTrades[index] = result.value;
      }
      return result;
    }
    const isPendingBuyOrder = current.status === "pending" && current.orderClassification === "PENDING_BUY_ORDER";
    if (patch.termClassification === "long-term" && !isPendingBuyOrder) {
      const validatedHolding = validateLongTermHolding(holdingFromShortTermTrade(store.shortTermTrades[index], patch));
      if (!validatedHolding.ok) return validatedHolding;
      store.shortTermTrades.splice(index, 1);
      const existingHoldingIndex = store.longTermHoldings.findIndex((holding) => holding.sourceTradeId === id || holding.id === validatedHolding.value.id);
      if (existingHoldingIndex === -1) store.longTermHoldings.push(validatedHolding.value);
      else store.longTermHoldings[existingHoldingIndex] = { ...store.longTermHoldings[existingHoldingIndex], ...validatedHolding.value, id: store.longTermHoldings[existingHoldingIndex].id };
      return { ...validatedHolding, movedTo: "long-term" };
    }
    const validated = validateShortTermTrade({ ...store.shortTermTrades[index], ...patch, id });
    if (!validated.ok) return validated;
    store.shortTermTrades[index] = validated.value;
    return validated;
  });
}

export async function updatePendingOrder(id, action, patch = {}) {
  return mutateStore(async (store) => {
    const trade = store.shortTermTrades.find((row) => row.id === id);
    if (!trade) return { ok: false, errors: ["Order not found."], value: null };
    if (trade.status !== "pending" || !trade.importedOrder) {
      return { ok: false, errors: ["Only genuine pending broker orders can be changed here."], value: null };
    }
    const now = new Date().toISOString();
    const history = Array.isArray(trade.orderHistory) ? trade.orderHistory : [];
    if (action === "change_limit") {
      const nextLimit = numberValue(patch.entryPrice ?? patch.limitPrice ?? patch.newLimitPrice);
      if (nextLimit === null || nextLimit <= 0) return { ok: false, errors: ["New limit price must be a positive number."], value: null };
      const previousLimit = trade.entryPrice;
      trade.entryPrice = round(nextLimit, 4);
      trade.orderHistory = [...history, orderEvent("LIMIT_RECORDED_IN_FREEDOM", {
        previousLimit,
        newLimit: trade.entryPrice,
        brokerOrderChanged: false,
        note: "Changing this value in Freedom does not change the broker order.",
      })];
      trade.updatedAt = now;
      return { ok: true, errors: [], value: trade, brokerOrderChanged: false };
    }
    if (action === "partial_fill") {
      const filledQuantity = numberValue(patch.filledQuantity);
      if (filledQuantity === null || filledQuantity <= 0) return { ok: false, errors: ["Filled quantity must be a positive number."], value: null };
      if (numberValue(trade.quantity) !== null && filledQuantity > trade.quantity) return { ok: false, errors: ["Filled quantity cannot exceed order quantity."], value: null };
      trade.filledQuantity = round(filledQuantity, 4);
      trade.orderStatus = "Partially Filled";
      trade.orderClassification = "PARTIALLY_FILLED_ORDER";
      trade.orderHistory = [...history, orderEvent("PARTIAL_FILL_RECORDED", { filledQuantity: trade.filledQuantity })];
      trade.updatedAt = now;
      return { ok: true, errors: [], value: trade };
    }
    if (action === "filled") {
      const side = String(trade.side || "BUY").toUpperCase();
      trade.status = side === "SELL" ? "closed" : "open";
      trade.filledQuantity = numberValue(patch.filledQuantity) !== null ? round(patch.filledQuantity, 4) : trade.quantity;
      trade.averageFilledPrice = numberValue(patch.averageFilledPrice) !== null ? round(patch.averageFilledPrice) : trade.entryPrice;
      trade.entryPrice = trade.averageFilledPrice || trade.entryPrice;
      trade.orderStatus = "Filled";
      trade.orderClassification = side === "SELL" ? "COMPLETED_SALE" : "COMPLETED_PURCHASE";
      trade.requiresFillConfirmation = false;
      trade.triggeredAt = now;
      trade.orderHistory = [...history, orderEvent("FILL_RECORDED", { filledQuantity: trade.filledQuantity, averageFilledPrice: trade.averageFilledPrice })];
      trade.updatedAt = now;
      return { ok: true, errors: [], value: trade };
    }
    if (action === "archive") {
      trade.status = "closed";
      trade.orderStatus = "Archived";
      trade.archivedAt = now;
      trade.orderHistory = [...history, orderEvent("ORDER_ARCHIVED", { reason: patch.reason || "Cancelled or archived in Freedom." })];
      trade.updatedAt = now;
      return { ok: true, errors: [], value: trade };
    }
    return { ok: false, errors: ["Unknown pending order action."], value: null };
  });
}

export async function removeShortTermTrade(id) {
  return mutateStore(async (store) => {
    const before = store.shortTermTrades.length;
    store.shortTermTrades = store.shortTermTrades.filter((row) => row.id !== id);
    return { ok: store.shortTermTrades.length < before, errors: [], value: null };
  });
}

export async function removeLongTermHolding(id) {
  return mutateStore(async (store) => {
    const before = store.longTermHoldings.length;
    store.longTermHoldings = store.longTermHoldings.filter((row) => row.id !== id);
    return { ok: store.longTermHoldings.length < before, errors: [], value: null };
  });
}

export async function updateLongTermHolding(id, patch = {}) {
  return mutateStore(async (store) => {
    const index = store.longTermHoldings.findIndex((row) => row.id === id);
    if (index === -1) return { ok: false, errors: ["Holding not found."], value: null };
    if (store.longTermHoldings[index].brokerHoldingSnapshot) {
      const result = editBrokerHolding(store.longTermHoldings[index], patch);
      if (result.ok) {
        if (patch.kind === "short-term" || patch.termClassification === "short-term") {
          result.value.kind = "short-term";
          result.value.termClassification = "short-term";
          store.longTermHoldings.splice(index, 1);
          store.shortTermTrades.push(result.value);
        } else store.longTermHoldings[index] = result.value;
      }
      return result;
    }
    if (patch.kind === "short-term" || patch.termClassification === "short-term") {
      const validatedTrade = validateShortTermTrade(shortTermTradeFromHolding(store.longTermHoldings[index], patch));
      if (!validatedTrade.ok) return validatedTrade;
      store.longTermHoldings.splice(index, 1);
      const existingTradeIndex = store.shortTermTrades.findIndex((trade) => trade.id === validatedTrade.value.id);
      if (existingTradeIndex === -1) store.shortTermTrades.push(validatedTrade.value);
      else store.shortTermTrades[existingTradeIndex] = validatedTrade.value;
      return { ...validatedTrade, movedTo: "short-term" };
    }
    const validated = validateLongTermHolding({ ...store.longTermHoldings[index], ...patch, id });
    if (!validated.ok) return validated;
    store.longTermHoldings[index] = validated.value;
    return validated;
  });
}

/**
 * Persist a status transition discovered during enrichment (pending -> open), so a trade
 * that has triggered stays triggered across reloads.
 */
export async function persistTriggeredTrades(enrichedRows = []) {
  const triggered = enrichedRows.filter((row) => row.status === "pending" && row.effectiveStatus === "open");
  if (!triggered.length) return 0;
  return mutateStore(async (store) => {
    let changed = 0;
    triggered.forEach((row) => {
      const target = store.shortTermTrades.find((item) => item.id === row.id);
      if (target && target.status === "pending") {
        target.status = "open";
        target.triggeredAt = new Date().toISOString();
        target.updatedAt = target.triggeredAt;
        changed += 1;
      }
    });
    return changed;
  });
}
