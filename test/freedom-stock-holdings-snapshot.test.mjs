import assert from "node:assert/strict";
import test from "node:test";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { reconcileBrokerHoldings, brokerHoldingValuation, editBrokerHolding } from "../lib/freedom/brokerHoldingsSnapshot.js";

const previous = JSON.parse(await readFile(new URL("../data/freedom/cmc-holdings-2026-09-06.json", import.meta.url)));
const snapshot = JSON.parse(await readFile(new URL("../data/freedom/cmc-holdings-2026-09-09.json", import.meta.url)));
const importedAt = "2026-09-09T03:15:00.000Z";

function prior() {
  const rows = previous.holdings.map(item => ({
    id: item.recordId, symbol: item.symbol, quantity: item.quantity,
    kind: item.symbol === "CLSK" ? "short-term" : "long-term", status: "open",
    purchasePrice: item.averageBuyPriceAud, purchasePriceCurrency: "AUD",
    targetPrice: item.symbol === "CLSK" ? 16 : null,
    safetyExit: item.symbol === "CLSK" ? 10.67 : null,
    originalOrder: { id: `original-${item.symbol}`, entryPrice: 10, createdAt: "2026-08-01" },
    brokerHoldingSnapshot: { ...item, id: previous.id, importedAt: "previous-import", fxRate: null },
    brokerSnapshotHistory: [{ snapshotId: previous.id, importedAt: "previous-import", previousRecord: { symbol: item.symbol } }],
    orderHistory: [{ type: "ORIGINAL_ORDER", at: "2026-08-01" }],
    pendingSellOrders: item.symbol === "JBLU" ? [{ id: "jblu-sell", quantity: 240, targetPrice: 6, status: "Open" }] : [],
  }));
  return {
    longTermHoldings: rows.filter(row => row.kind === "long-term"),
    shortTermTrades: [...rows.filter(row => row.kind === "short-term"),
      { id: "pending-nwh", symbol: "NWH", status: "pending", quantity: 2000, kind: "short-term" },
      { id: "tiger-tjgc", symbol: "TJGC", broker: "Tiger Brokers", status: "open", quantity: 4096, kind: "short-term" }],
    archivedHoldings: [{ id: "archived-wulf", symbol: "WULF", status: "archived" }],
    tradeImports: [{ id: "earlier-import" }],
    brokerPortfolioSnapshot: previous,
  };
}

const active = store => [...store.longTermHoldings, ...store.shortTermTrades];
const cmc = store => active(store).filter(row => row.brokerHoldingSnapshot?.id === snapshot.id);

test("stock holdings retain the displayed values and reconcile the table independently of the account header", () => {
  const next = reconcileBrokerHoldings(prior(), snapshot, importedAt);
  const views = cmc(next).map(brokerHoldingValuation);
  assert.equal(Number(views.reduce((sum, row) => sum + row.currentValue, 0).toFixed(2)), 19005.36);
  assert.equal(next.brokerPortfolioSnapshot.accountSummary.totalHoldingsAud, 19152.07);
  assert.equal(next.brokerPortfolioSnapshot.accountSummary.totalPortfolioAud, 32408.52);
  assert.equal(next.brokerPortfolioSnapshot.accountSummary.profitLossAud, 576.26);
  assert.equal(next.brokerPortfolioSnapshot.accountSummary.dailyProfitLossAud, 134.56);
  for (const row of views) {
    assert.equal(row.profitLoss, null);
    assert.equal(row.tone, "grey");
    assert.equal(row.profitLossPercent, null);
    assert.equal(row.dailyProfitLoss, null);
    assert.equal(row.dataTimestamp, null);
    assert.equal(row.brokerHoldingSnapshot.fxTimestamp, null);
  }
  const clsk = views.find(row => row.symbol === "CLSK");
  assert.equal(clsk.currentPrice, 13.48);
  assert.equal(clsk.brokerHoldingSnapshot.fxRate, 0.727);
  assert.equal(clsk.brokerHoldingSnapshot.nativePriceChange, 0.79);
  assert.equal(clsk.brokerHoldingSnapshot.priceChangePercent, 6.23);
  assert.equal(clsk.brokerHoldingSnapshot.conditionalOrders, -320);
  assert.equal(clsk.brokerHoldingSnapshot.availableToSell, 320);
  const jblu = views.find(row => row.symbol === "JBLU");
  assert.equal(jblu.quantity, 240);
  assert.equal(jblu.currentPrice, 4.52);
  assert.equal(jblu.currentValue, 0);
  assert.equal(jblu.dataAvailable, true);
  assert.equal(jblu.effectiveStatus, "open");
  assert.equal(jblu.brokerHoldingSnapshot.openSells, 240);
  assert.equal(jblu.brokerHoldingSnapshot.availableToSell, 0);
});

test("the latest screenshot preserves cost basis, original orders, prior snapshots and unrelated positions", () => {
  const original = prior();
  const unchanged = structuredClone(original);
  const next = reconcileBrokerHoldings(original, snapshot, importedAt);
  assert.deepEqual(original, unchanged);
  assert.deepEqual(reconcileBrokerHoldings(next, snapshot, "later"), next);
  for (const row of cmc(next)) {
    const saved = active(original).find(item => item.id === row.id);
    assert.equal(row.purchasePrice, saved.purchasePrice);
    assert.equal(row.brokerHoldingSnapshot.costAud, saved.brokerHoldingSnapshot.costAud);
    assert.equal(row.brokerHoldingSnapshot.costBasisSourceSnapshotId, previous.id);
    assert.deepEqual(row.originalOrder, saved.originalOrder);
    assert.deepEqual(row.pendingSellOrders, saved.pendingSellOrders);
    assert.deepEqual(row.orderHistory, saved.orderHistory);
    assert.equal(row.targetPrice, saved.targetPrice);
    assert.equal(row.safetyExit, saved.safetyExit);
    assert.deepEqual(row.brokerSnapshotHistory.at(-1).previousRecord, saved);
  }
  assert.deepEqual(next.brokerPortfolioSnapshotHistory[0].snapshot, previous);
  for (const id of ["pending-nwh", "tiger-tjgc"]) {
    assert.deepEqual(active(next).find(row => row.id === id), active(original).find(row => row.id === id));
  }
  assert.deepEqual(next.tradeImports, original.tradeImports);
  const nwh = next.archivedHoldings.find(row => row.id === "lt_NWH_real_1436");
  assert.equal(nwh.salePrice, null);
  assert.equal(nwh.saleDate, null);
  assert.equal(nwh.realisedProfitLoss, null);
  assert.equal(nwh.brokerHoldingSnapshot.id, previous.id);
  assert.equal(next.archivedHoldings.some(row => row.symbol === "WULF"), true);
});

test("invalid table totals, account arithmetic, availability and negative values reject without changing originals", () => {
  const original = prior();
  const unchanged = structuredClone(original);
  for (const [change, message] of [
    [value => { value.totals.marketValueAud++; }, /marketValueAud does not reconcile/],
    [value => { value.accountSummary.totalPortfolioAud++; }, /Account portfolio total/],
    [value => { value.holdings[0].availableToSell--; }, /Available to sell mismatch/],
    [value => { value.holdings[0].marketValueAud = -1; }, /Invalid marketValueAud/],
    [value => { value.holdings[1].fxRate = 0; }, /Invalid fxRate/],
  ]) {
    const invalid = structuredClone(snapshot);
    change(invalid);
    assert.throws(() => reconcileBrokerHoldings(original, invalid, importedAt), message);
    assert.deepEqual(original, unchanged);
  }
});

test("editing a stock-holdings record never fabricates P&L from its table value", () => {
  const next = reconcileBrokerHoldings(prior(), snapshot, importedAt);
  const row = cmc(next).find(item => item.symbol === "JBLU");
  assert.deepEqual(editBrokerHolding(row, { targetPrice: 7 }).value.brokerHoldingSnapshot, row.brokerHoldingSnapshot);
  const edited = editBrokerHolding(row, { quantity: 120 }).value;
  const view = brokerHoldingValuation(edited);
  assert.equal(view.currentValue, 0);
  assert.equal(view.profitLoss, null);
  assert.equal(view.profitLossPercent, null);
  assert.equal(view.dailyProfitLoss, null);
  assert.deepEqual(edited.pendingSellOrders, row.pendingSellOrders);
});

test("stock-holdings valuation persists through store reload and API enrichment", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "freedom-stock-holdings-"));
  const oldPath = process.env.FREEDOM_TRADE_STORE_PATH;
  process.env.FREEDOM_TRADE_STORE_PATH = path.join(directory, "portfolio.json");
  try {
    await writeFile(process.env.FREEDOM_TRADE_STORE_PATH, JSON.stringify(reconcileBrokerHoldings(prior(), snapshot, importedAt)));
    const store = await import("../lib/freedom/tradeStore.js");
    const row = (await store.listLongTermHoldings()).find(item => item.symbol === "JBLU");
    const view = store.enrichLongTermHolding(row, { price: 999, timestamp: "live" });
    assert.equal(view.currentPrice, 4.52);
    assert.equal(view.currentValue, 0);
    assert.equal(view.profitLoss, null);
    assert.equal((await store.updateLongTermHolding(row.id, { targetPrice: 7 })).ok, true);
    const reloaded = (await store.listLongTermHoldings()).find(item => item.id === row.id);
    assert.equal(reloaded.targetPrice, 7);
    assert.equal(reloaded.brokerHoldingSnapshot.fxRate, 0.727);
    assert.equal(reloaded.brokerHoldingSnapshot.openSells, 240);
    assert.equal((await store.listArchivedHoldings()).some(item => item.symbol === "NWH"), true);
  } finally {
    if (oldPath === undefined) delete process.env.FREEDOM_TRADE_STORE_PATH;
    else process.env.FREEDOM_TRADE_STORE_PATH = oldPath;
    await rm(directory, { recursive: true });
  }
});
