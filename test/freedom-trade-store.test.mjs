import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

// Isolate the store file before importing the module under test.
const directory = await mkdtemp(path.join(tmpdir(), "freedom-trade-store-"));
process.env.FREEDOM_TRADE_STORE_PATH = path.join(directory, "trades.json");

const store = await import("../lib/freedom/tradeStore.js");
const marketLookup = await import("../lib/freedom/marketLookup.js");

test.after(async () => {
  await rm(directory, { recursive: true, force: true });
});

function pendingTrade(overrides = {}) {
  return {
    symbol: "cmg",
    exchange: "nasdaq",
    entryPrice: 36,
    quantity: 10,
    entryDate: "2026-08-20",
    safetyExit: 33,
    takeSomeProfit: 42,
    finalExit: 48,
    ...overrides,
  };
}

test("a valid manual trade normalises ticker and exchange to upper case", () => {
  const result = store.validateShortTermTrade(pendingTrade());
  assert.equal(result.ok, true);
  assert.equal(result.value.symbol, "CMG");
  assert.equal(result.value.exchange, "NASDAQ");
  assert.equal(result.value.status, "pending", "a new manual trade defaults to pending");
  assert.ok(result.value.entryDate.startsWith("2026-08-20"));
});

test("every required manual entry field is enforced", () => {
  const result = store.validateShortTermTrade({});
  assert.equal(result.ok, false);
  const joined = result.errors.join(" ");
  for (const field of ["Ticker", "Exchange", "Entry price", "Quantity", "Date", "Safety Exit", "Take Some Profit", "Final Exit"]) {
    assert.ok(joined.includes(field), "missing validation for " + field);
  }
});

test("an incoherent price ladder is rejected", () => {
  assert.equal(store.validateShortTermTrade(pendingTrade({ safetyExit: 40 })).ok, false, "safety exit above entry");
  assert.equal(store.validateShortTermTrade(pendingTrade({ takeSomeProfit: 30 })).ok, false, "target below entry");
  assert.equal(store.validateShortTermTrade(pendingTrade({ finalExit: 38 })).ok, false, "final exit below take-some");
  assert.equal(store.validateShortTermTrade(pendingTrade({ quantity: -5 })).ok, false, "negative quantity");
});

test("a pending trade stays pending while price is above the entry", () => {
  const trade = store.validateShortTermTrade(pendingTrade()).value;
  assert.equal(store.resolvePendingStatus(trade, 40), "pending");
});

test("a pending trade triggers only when a real price reaches the entry", () => {
  const trade = store.validateShortTermTrade(pendingTrade()).value;
  assert.equal(store.resolvePendingStatus(trade, 36), "open");
  assert.equal(store.resolvePendingStatus(trade, 35), "open");
});

test("a pending trade never triggers on missing market data", () => {
  const trade = store.validateShortTermTrade(pendingTrade()).value;
  assert.equal(store.resolvePendingStatus(trade, null), "pending");
  assert.equal(store.resolvePendingStatus(trade, undefined), "pending");
  assert.equal(store.resolvePendingStatus(trade, NaN), "pending");
});

test("a waiting trade reports Waiting for Entry and no profit or loss", () => {
  const trade = store.validateShortTermTrade(pendingTrade()).value;
  const row = store.enrichShortTermTrade(trade, { price: 40, timestamp: "2026-08-21" });
  assert.equal(row.effectiveStatus, "pending");
  assert.equal(row.statusLabel, "Waiting for Entry");
  assert.equal(row.tone, "blue");
  assert.equal(row.profitLoss, null, "a pending order has no profit or loss");
  assert.equal(row.marketValue, null);
  assert.equal(row.amountInvested, 360, "planned amount is still shown");
});

test("an open trade reports dollar and percentage profit", () => {
  const trade = store.validateShortTermTrade(pendingTrade({ status: "open" })).value;
  const row = store.enrichShortTermTrade(trade, { price: 39.6, timestamp: "2026-08-21" });
  assert.equal(row.effectiveStatus, "open");
  assert.equal(row.amountInvested, 360);
  assert.equal(row.marketValue, 396);
  assert.equal(row.profitLoss, 36);
  assert.equal(row.profitLossPercent, 10);
  assert.equal(row.tone, "green");
});

test("an open trade in loss is amber and a breached safety exit is red", () => {
  const trade = store.validateShortTermTrade(pendingTrade({ status: "open" })).value;
  assert.equal(store.enrichShortTermTrade(trade, { price: 35 }).tone, "amber");
  const breached = store.enrichShortTermTrade(trade, { price: 32 });
  assert.equal(breached.tone, "red");
  assert.equal(breached.safetyExitBreached, true);
  assert.match(breached.statusMessage, /Safety Exit/);
});

test("missing market data is grey and explicitly flagged, not shown as zero", () => {
  const trade = store.validateShortTermTrade(pendingTrade({ status: "open" })).value;
  const row = store.enrichShortTermTrade(trade, null);
  assert.equal(row.dataAvailable, false);
  assert.equal(row.tone, "grey");
  assert.equal(row.currentPrice, null);
  assert.equal(row.profitLoss, null);
  assert.match(row.statusMessage, /unavailable/i);
});

test("long-term holdings require an investment reason", () => {
  const missing = store.validateLongTermHolding({ symbol: "MSFT", exchange: "NASDAQ", purchasePrice: 400, quantity: 5, purchaseDate: "2025-01-10" });
  assert.equal(missing.ok, false);
  assert.ok(missing.errors.join(" ").includes("reason"));
});

test("a long-term holding computes current value and profit", () => {
  const holding = store.validateLongTermHolding({
    symbol: "MSFT", exchange: "NASDAQ", purchasePrice: 400, quantity: 5,
    purchaseDate: "2025-01-10", reason: "Long-term compounding position.",
  }).value;
  const row = store.enrichLongTermHolding(holding, { price: 483.33 });
  assert.equal(row.amountInvested, 2000);
  assert.equal(row.currentValue, 2416.65);
  assert.equal(row.profitLoss, 416.65);
  assert.equal(row.tone, "green");
  assert.equal(row.reason, "Long-term compounding position.");
});

test("long-term holdings preserve actual average purchase price precision", () => {
  const holding = store.validateLongTermHolding({
    symbol: "CBA",
    exchange: "ASX",
    currency: "AUD",
    purchasePrice: 159.174,
    quantity: 45,
    purchaseDate: "2026-08-01",
    reason: "Imported broker average cost.",
  });
  assert.equal(holding.ok, true);
  assert.equal(holding.value.purchasePrice, 159.174);
});

test("portfolio totals exclude unpriced holdings rather than treating them as zero", () => {
  const rows = [
    { dataAvailable: true, amountInvested: 1000, currentValue: 1200 },
    { dataAvailable: false, amountInvested: 500, currentValue: null },
  ];
  const totals = store.longTermTotals(rows);
  assert.equal(totals.holdings, 2);
  assert.equal(totals.pricedHoldings, 1);
  assert.equal(totals.unpricedHoldings, 1);
  assert.equal(totals.amountInvested, 1000, "unpriced holding is excluded from the total");
  assert.equal(totals.currentValue, 1200);
  assert.equal(totals.profitLoss, 200);
});

test("trades persist to disk and survive a reload", async () => {
  const added = await store.addShortTermTrade(pendingTrade({ symbol: "AAPL", entryPrice: 300, safetyExit: 280, takeSomeProfit: 340, finalExit: 380 }));
  assert.equal(added.ok, true);

  const reloaded = await store.listShortTermTrades();
  assert.ok(reloaded.some((row) => row.symbol === "AAPL"), "trade is present after reload");

  const raw = JSON.parse(await readFile(process.env.FREEDOM_TRADE_STORE_PATH, "utf8"));
  assert.ok(raw.shortTermTrades.some((row) => row.symbol === "AAPL"), "trade is on disk");

  await store.removeShortTermTrade(added.value.id);
  const after = await store.listShortTermTrades();
  assert.equal(after.some((row) => row.id === added.value.id), false, "trade is removed");
});

test("a triggered pending trade is persisted as open so monitoring continues", async () => {
  const added = await store.addShortTermTrade(pendingTrade({ symbol: "NVDA", entryPrice: 100, safetyExit: 90, takeSomeProfit: 120, finalExit: 140 }));
  const enriched = [store.enrichShortTermTrade(added.value, { price: 95 })];
  assert.equal(enriched[0].effectiveStatus, "open");

  const changed = await store.persistTriggeredTrades(enriched);
  assert.equal(changed, 1);

  const reloaded = await store.listShortTermTrades();
  const found = reloaded.find((row) => row.id === added.value.id);
  assert.equal(found.status, "open", "the promotion survived the reload");
  assert.ok(found.triggeredAt, "the trigger time was recorded");

  await store.removeShortTermTrade(added.value.id);
});

test("long-term holdings persist separately from short-term trades", async () => {
  const added = await store.addLongTermHolding({
    symbol: "MSFT", exchange: "NASDAQ", purchasePrice: 400, quantity: 5,
    purchaseDate: "2025-01-10", reason: "Core long-term holding.",
  });
  assert.equal(added.ok, true);

  const holdings = await store.listLongTermHoldings();
  const trades = await store.listShortTermTrades();
  assert.ok(holdings.some((row) => row.symbol === "MSFT"));
  assert.equal(trades.some((row) => row.symbol === "MSFT"), false, "long-term holding did not leak into short-term trades");

  await store.removeLongTermHolding(added.value.id);
});

test("legacy Freedom market-watch trades are restored into the new store", async () => {
  const legacyPath = path.join(directory, "freedom-paper-local.json");
  const previousPaperPath = process.env.FREEDOM_PAPER_STORE_PATH;
  process.env.FREEDOM_PAPER_STORE_PATH = legacyPath;
  await writeFile(legacyPath, JSON.stringify({
    marketWatch: [{
      id: "watch_legacy_cmg",
      broker: "CMC",
      state: "WAITING_FOR_ENTRY",
      plan: {
        symbol: "CMG",
        companyName: "CHIPOTLE MEXICAN GRILL INC",
        exchange: "US",
        currency: "USD",
        buyTrigger: 32.99,
        safetyExit: 31.11,
        takeSomeProfit: 38.63,
        finalExit: 38.63,
        quantity: 151,
        reason: "Legacy waiting-for-entry plan.",
      },
      orderEnteredAt: "2026-08-16T23:13:52.326Z",
      createdAt: "2026-08-15T20:49:43.596Z",
      updatedAt: "2026-08-21T10:29:40.349Z",
    }],
  }));

  try {
    const restored = await store.listShortTermTrades();
    const trade = restored.find((row) => row.symbol === "CMG");
    assert.ok(trade, "legacy CMG trade was restored");
    assert.equal(trade.id, "legacy_market_watch_watch_legacy_cmg");
    assert.equal(trade.status, "pending");
    assert.equal(trade.sourceStorage, "tmp/freedom-paper-local.json:marketWatch");

    const raw = JSON.parse(await readFile(process.env.FREEDOM_TRADE_STORE_PATH, "utf8"));
    assert.ok(raw.shortTermTrades.some((row) => row.id === trade.id), "restored trade was written to the new store");
  } finally {
    if (previousPaperPath === undefined) delete process.env.FREEDOM_PAPER_STORE_PATH;
    else process.env.FREEDOM_PAPER_STORE_PATH = previousPaperPath;
    await store.removeShortTermTrade("legacy_market_watch_watch_legacy_cmg");
  }
});

test("pending sell workflow can be verified with an isolated test-only order", async () => {
  const added = await store.addShortTermTrade(pendingTrade({
    symbol: "SELLTEST",
    exchange: "ASX",
    currency: "AUD",
    entryPrice: 12,
    quantity: 10,
    entryDate: "2026-08-24",
    importedOrder: true,
    broker: "CMC",
    side: "SELL",
    orderStatus: "Waiting for Entry",
    orderClassification: "PENDING_SELL_ORDER",
    importFingerprint: "test-only-pending-sell",
    safetyExit: null,
    takeSomeProfit: null,
    finalExit: null,
  }));
  assert.equal(added.ok, true);

  const changed = await store.updatePendingOrder(added.value.id, "change_limit", { newLimitPrice: 12.5 });
  assert.equal(changed.ok, true);
  assert.equal(changed.value.entryPrice, 12.5);
  assert.equal(changed.value.orderHistory.at(-1).type, "LIMIT_RECORDED_IN_FREEDOM");
  assert.equal(changed.value.orderHistory.at(-1).brokerOrderChanged, false);

  const partial = await store.updatePendingOrder(added.value.id, "partial_fill", { filledQuantity: 4 });
  assert.equal(partial.ok, true);
  assert.equal(partial.value.filledQuantity, 4);
  assert.equal(partial.value.orderStatus, "Partially Filled");

  const filled = await store.updatePendingOrder(added.value.id, "filled", { averageFilledPrice: 12.45, filledQuantity: 10 });
  assert.equal(filled.ok, true);
  assert.equal(filled.value.status, "closed");
  assert.equal(filled.value.orderClassification, "COMPLETED_SALE");

  await store.removeShortTermTrade(added.value.id);
  const after = await store.listShortTermTrades();
  assert.equal(after.some((row) => row.importFingerprint === "test-only-pending-sell"), false);
});

test("editing a pending long-term buy keeps it as an unfilled pending order", async () => {
  const added = await store.addShortTermTrade(pendingTrade({
    symbol: "IVV",
    exchange: "ASX",
    currency: "AUD",
    entryPrice: 60.25,
    quantity: 3,
    entryDate: "2026-08-24",
    importedOrder: true,
    broker: "CMC",
    orderStatus: "Waiting for Entry",
    orderClassification: "PENDING_BUY_ORDER",
    importFingerprint: "test-only-pending-long-buy",
    termClassification: "long-term",
    safetyExit: null,
    takeSomeProfit: null,
    finalExit: null,
  }));
  assert.equal(added.ok, true);

  const changed = await store.updateShortTermTrade(added.value.id, {
    termClassification: "long-term",
    expiry: "2026-10-01",
  });
  assert.equal(changed.ok, true);
  assert.equal(changed.value.id, added.value.id);
  assert.equal(changed.value.status, "pending");
  assert.equal(changed.value.orderClassification, "PENDING_BUY_ORDER");
  assert.equal(changed.value.termClassification, "long-term");

  const holdings = await store.listLongTermHoldings();
  assert.equal(holdings.some((row) => row.symbol === "IVV"), false, "pending buy was not duplicated as an owned holding");

  await store.removeShortTermTrade(added.value.id);
});

test("quote validation rejects mismatched exchange or currency before pricing an order", () => {
  const rejected = marketLookup.quoteMatchesOrder(
    { symbol: "ALK", exchange: "ASX", currency: "AUD" },
    { price: 40.41, exchange: "US", currency: "USD" },
  );
  assert.equal(rejected.ok, false);
  assert.match(rejected.reason, /currency|exchange/i);

  const accepted = marketLookup.quoteMatchesOrder(
    { symbol: "ALK", exchange: "ASX", currency: "AUD" },
    { price: 1.4, exchange: "ASX", currency: "AUD" },
  );
  assert.equal(accepted.ok, true);
});
