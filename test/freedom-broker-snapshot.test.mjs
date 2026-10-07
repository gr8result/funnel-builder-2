import assert from "node:assert/strict";
import test from "node:test";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { reconcileBrokerHoldings, brokerHoldingValuation } from "../lib/freedom/brokerHoldingsSnapshot.js";

const snapshot = JSON.parse(await readFile(new URL("../data/freedom/cmc-holdings-2026-09-06.json", import.meta.url)));
const now = "2026-09-06T01:00:00.000Z";
function prior() {
  const rows = snapshot.holdings.map(row => ({ id: row.recordId, symbol: row.symbol,
    quantity: row.quantity, kind: ["IVV", "CLSK"].includes(row.symbol) ? "short-term" : "long-term",
    currency: row.nativeCurrency, exchange: row.nativeCurrency === "USD" ? "US" : "ASX",
    status: ["IVV", "CLSK"].includes(row.symbol) ? "pending" : "open",
    purchasePrice: row.symbol === "NWH" ? null : row.averageBuyPriceAud,
    entryPrice: row.symbol === "IVV" ? 71.09 : row.symbol === "CLSK" ? 10.85 : null,
    termClassification: row.symbol === "CLSK" ? "short-term" : "long-term",
    takeSomeProfit: row.symbol === "CLSK" ? 16 : null,
    safetyExit: row.symbol === "CLSK" ? 10.67 : null,
    orderHistory: [{ type: "ORIGINAL_ORDER", at: "2026-08-01" }], createdAt: "2026-08-01",
    pendingSellOrders: row.symbol === "JBLU" ? [{ id: "original-sell", targetPrice: 6 }] : [],
  }));
  return { longTermHoldings: [...rows.filter(r => r.kind === "long-term"), { id: snapshot.archiveIds[0], symbol: "WULF", quantity: 88, purchasePrice: 21.619, pendingSellOrders: [{ id: "original-wulf-sell", targetPrice: 16.4 }] }],
    shortTermTrades: rows.filter(r => r.kind === "short-term"), tradeImports: [] };
}
test("reconciliation updates stable records, preserves order provenance and is idempotent", () => {
  const original = prior();
  const next = reconcileBrokerHoldings(original, snapshot, now);
  assert.deepEqual(reconcileBrokerHoldings(next, snapshot, "later"), next);
  assert.equal(original.shortTermTrades[0].status, "pending", "input not mutated");
  const ivv = next.longTermHoldings.find(r => r.symbol === "IVV");
  const clsk = next.shortTermTrades.find(r => r.symbol === "CLSK");
  assert.equal(ivv.id, snapshot.holdings[2].recordId);
  assert.equal(ivv.originalOrder.entryPrice, 71.09);
  assert.equal(ivv.purchasePrice, 71.738);
  assert.equal(ivv.status, "open");
  assert.equal(ivv.kind, "long-term");
  assert.equal(clsk.originalOrder.entryPrice, 10.85);
  assert.equal(clsk.entryPrice, null, "AUD average must not become a USD execution price");
  assert.equal(clsk.purchasePrice, 15.326);
  assert.equal(clsk.purchasePriceCurrency, "AUD");
  assert.equal(clsk.takeSomeProfit, 16);
  assert.equal(clsk.safetyExit, 10.67);
  assert.equal(ivv.orderHistory[0].type, "ORIGINAL_ORDER");
  assert.equal(ivv.fillTimestamp, null);
  assert.equal(ivv.purchaseDate, null);
  assert.deepEqual(next.longTermHoldings.find(r => r.symbol === "JBLU").pendingSellOrders, [{ id: "original-sell", targetPrice: 6 }]);
  const all = [...next.longTermHoldings, ...next.shortTermTrades, ...next.archivedHoldings];
  assert.equal(new Set(all.map(r => r.id)).size, all.length);
});
test("broker amounts independently sum to exact CMC AUD totals without rounded-average multiplication", () => {
  const next = reconcileBrokerHoldings(prior(), snapshot, now);
  const rows = [...next.longTermHoldings, ...next.shortTermTrades].map(brokerHoldingValuation);
  const sum = key => Number(rows.reduce((n, row) => n + row[key], 0).toFixed(2));
  assert.equal(sum("amountInvested"), 31017.64);
  assert.equal(sum("currentValue"), 31482.05);
  assert.equal(sum("profitLoss"), 464.41);
  assert.equal(sum("dailyProfitLoss"), 60.27);
  assert.equal(Number((sum("profitLoss") / sum("amountInvested") * 100).toFixed(2)), 1.50);
  const clsk = rows.find(r => r.symbol === "CLSK");
  assert.equal(clsk.currentPrice, 12.690);
  assert.equal(clsk.nativeCurrency, "USD");
  assert.equal(clsk.currentValue, 5600.99);
  assert.equal(clsk.brokerHoldingSnapshot.fxRate, null);
  assert.equal(clsk.dataTimestamp, null);
});
test("WULF is archived intact without inventing a sale or realised P&L", () => {
  const next = reconcileBrokerHoldings(prior(), snapshot, now);
  assert.equal(next.longTermHoldings.some(r => r.symbol === "WULF"), false);
  const wulf = next.archivedHoldings[0];
  assert.equal(wulf.id, snapshot.archiveIds[0]);
  assert.equal(wulf.status, "archived");
  assert.equal(wulf.saleDate, null);
  assert.equal(wulf.salePrice, null);
  assert.equal(wulf.realisedProfitLoss, null);
  assert.equal(wulf.pendingSellOrders[0].targetPrice, 16.4);
  assert.match(wulf.archiveReason, /sale details require confirmation/);
});
test("missing or duplicate originals and inconsistent totals reject before any mutation", () => {
  const store = prior();store.shortTermTrades = [];
  assert.throws(() => reconcileBrokerHoldings(store, snapshot, now), /original record/);
  const duplicate = prior();duplicate.longTermHoldings.push(duplicate.longTermHoldings[0]);
  assert.throws(() => reconcileBrokerHoldings(duplicate, snapshot, now), /original record/);
  const wrong = structuredClone(snapshot);wrong.totals.costAud++;
  assert.throws(() => reconcileBrokerHoldings(prior(), wrong, now), /reconcile/);
});

const directory = await mkdtemp(path.join(os.tmpdir(), "freedom-broker-snapshot-"));
process.env.FREEDOM_TRADE_STORE_PATH = path.join(directory, "portfolio.json");
const store = await import("../lib/freedom/tradeStore.js");
test.after(async () => rm(directory, { recursive: true, force: true }));
test("snapshot valuation survives API enrichment and edits survive file reload without losing provenance", async () => {
  const next = reconcileBrokerHoldings(prior(), snapshot, now);
  await writeFile(process.env.FREEDOM_TRADE_STORE_PATH, JSON.stringify(next));
  const clsk = (await store.listShortTermTrades())[0];
  const row = store.enrichShortTermTrade(clsk, { price: 999, timestamp: "live" });
  assert.equal(row.currentPrice, 12.69);
  assert.equal(row.currentValue, 5600.99);
  assert.equal(row.effectiveStatus, "open");
  assert.equal((await store.updateShortTermTrade(clsk.id, { targetPrice: 17 })).ok, true);
  const reloaded = (await store.listShortTermTrades())[0];
  assert.equal(reloaded.targetPrice, 17);
  assert.equal(reloaded.originalOrder.entryPrice, 10.85);
  assert.equal(reloaded.purchasePrice, 15.326);
  const ivv = (await store.listLongTermHoldings()).find(r => r.symbol === "IVV");
  assert.equal((await store.updateLongTermHolding(ivv.id, { safetyExit: 60 })).ok, true);
  assert.equal((await store.listLongTermHoldings()).find(r => r.id === ivv.id).safetyExit, 60);
  assert.equal((await store.listArchivedHoldings())[0].symbol, "WULF");
});

test("sell-panel prices derive from current snapshot without rewriting the historical sell order", () => {
  const next = reconcileBrokerHoldings(prior(), snapshot, now);
  const raw = next.longTermHoldings.find(row => row.symbol === "JBLU");
  const view = brokerHoldingValuation(raw);
  assert.equal(view.pendingSellOrders[0].targetPrice,6);
  assert.equal(view.pendingSellOrders[0].currentPrice,4.63);
  assert.equal(raw.pendingSellOrders[0].currentPrice,undefined);
});
