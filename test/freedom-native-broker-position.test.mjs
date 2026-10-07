import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { importNativeBrokerPosition } from "../lib/freedom/importNativeBrokerPosition.js";
import { brokerHoldingValuation, editBrokerHolding } from "../lib/freedom/brokerHoldingsSnapshot.js";
const snapshot = JSON.parse(await readFile("data/freedom/tiger-tjgc-2026-09-06.json", "utf8"));
const original = { shortTermTrades: [], longTermHoldings: [{ id: "existing-cba", symbol: "CBA", quantity: 45 }], archivedHoldings: [{ id: "wulf", symbol: "WULF" }], brokerPortfolioSnapshot: { id: "cmc" } };
test("native import preserves existing records and CMC snapshot and is idempotent", () => {
  const next = importNativeBrokerPosition(original, snapshot, "import-time");
  assert.deepEqual(next.longTermHoldings, original.longTermHoldings);
  assert.deepEqual(next.archivedHoldings, original.archivedHoldings);
  assert.deepEqual(next.brokerPortfolioSnapshot, original.brokerPortfolioSnapshot);
  assert.equal(original.shortTermTrades.length, 0);
  assert.deepEqual(importNativeBrokerPosition(next, snapshot, "later"), next);
  assert.equal(next.shortTermTrades.length, 1);
});
test("existing ticker cannot be duplicated or overwritten", () => {
  assert.throws(() => importNativeBrokerPosition({ ...original, shortTermTrades: [{ id: "saved", symbol: "TJGC:US" }] }, snapshot, "now"), /saved/);
});
test("native valuation preserves displayed FIFO and leaves unknown cost, dates and FX unknown", () => {
  const raw = importNativeBrokerPosition(original, snapshot, "now").shortTermTrades[0];
  const row = brokerHoldingValuation(raw);
  assert.equal(row.purchasePrice, 10.05);
  assert.equal(row.purchasePriceCurrency, "USD");
  assert.equal(row.currentValue, 42680.32);
  assert.equal(row.profitLoss, 1503.22);
  assert.equal(row.amountInvested, null);
  assert.equal(row.profitLossPercent, null);
  assert.equal(row.entryPrice, null);
  assert.equal(row.purchaseDate, null);
  assert.equal(row.brokerHoldingSnapshot.fxRate, null);
  assert.equal(row.dataTimestamp, null);
  assert.equal(row.targetPrice, null);
});
test("target edits preserve valuation, quantity edits invalidate unconfirmed P&L", () => {
  const row = importNativeBrokerPosition(original, snapshot, "now").shortTermTrades[0];
  assert.deepEqual(editBrokerHolding(row, { targetPrice: 12 }).value.brokerHoldingSnapshot, row.brokerHoldingSnapshot);
  const changed = brokerHoldingValuation(editBrokerHolding(row, { quantity: 4000 }).value);
  assert.equal(changed.amountInvested, null);
  assert.equal(changed.profitLoss, null);
  assert.equal(changed.currentValue, 41680);
});
test("native position and edits persist across store reloads", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "freedom-native-"));
  process.env.FREEDOM_TRADE_STORE_PATH = path.join(dir, "portfolio.json");
  try {
    const next = importNativeBrokerPosition(original, snapshot, "now");
    await writeFile(process.env.FREEDOM_TRADE_STORE_PATH, JSON.stringify(next));
    const store = await import("../lib/freedom/tradeStore.js");
    const row = (await store.listShortTermTrades())[0];
    assert.equal((await store.updateShortTermTrade(row.id, { targetPrice: 12 })).ok, true);
    const saved = (await store.listShortTermTrades())[0];
    assert.equal(saved.id, row.id);
    assert.equal(saved.targetPrice, 12);
    assert.equal(brokerHoldingValuation(saved).currentValue, 42680.32);
    assert.equal(saved.orderHistory[0].type, "BROKER_HOLDING_CONFIRMED");
  } finally { await rm(dir, { recursive: true, force: true }); }
});
