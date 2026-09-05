import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadPortfolio, portfolioHeaders } from "../lib/freedom/portfolioClient.js";

const auth = { getSession: async () => ({ data: { session: { access_token: "test-session" } } }) };
const holding = { id: "holding-original", kind: "long-term", symbol: "TEST", quantity: 5,
  purchasePrice: 20, pendingSellOrders: [{ id: "sell-original", quantity: 5, targetPrice: 30 }] };
const orders = ["long-term", "short-term"].map((termClassification, i) => ({
  id: `order-original-${i}`, kind: "short-term", termClassification, status: "pending",
  orderClassification: "PENDING_BUY_ORDER", quantity: 10, entryPrice: 15,
  importedOrder: true, requiresFillConfirmation: true,
}));
const reply = (body, status = 200) => ({ status, json: async () => body });
const populated = async (url, options) => {
  assert.equal(options.headers.Authorization, "Bearer test-session");
  assert.equal(options.cache, "no-store");
  return reply(url.includes("long-term") ? { ok: true, holdings: [holding] } : { ok: true, trades: orders });
};

test("populated response preserves stable IDs, original fields and attached sells", async () => {
  const result = await loadPortfolio({ auth, fetcher: populated });
  assert.deepEqual(result.holdings.data, [holding]);
  assert.deepEqual(result.pendingBuyOrders.data, orders);
  assert.ok(Object.values(result).every(c => c.status === "success"));
});
test("only successful, genuinely empty collections load as empty", async () => {
  const result = await loadPortfolio({ auth, fetcher: async () => reply({ holdings: [], trades: [] }) });
  assert.ok(Object.values(result).every(c => c.status === "success" && c.data.length === 0));
});
for (const status of [401, 403, 500]) {
  test(`${status} is handled locally without discarding successful collections`, async () => {
    const result = await loadPortfolio({ auth, fetcher: async (url, options) =>
      url.includes("long-term") ? reply({ error: "original server error" }, status) : populated(url, options)
    });
    assert.equal(result.holdings.status, "error");
    assert.equal(result.holdings.error.status, status);
    assert.ok(result.holdings.error.message.includes("original server error"));
    assert.deepEqual(result.pendingBuyOrders.data, orders);
    assert.equal(result.shortTermHoldings.status, "success");
  });
}
test("network failures become collection errors, never successful emptiness", async () => {
  const result = await loadPortfolio({ auth, fetcher: async () => { throw new TypeError("Failed to fetch"); } });
  assert.ok(Object.values(result).every(c => c.status === "error" && c.error.message.includes("Failed to fetch")));
});
test("malformed, non-JSON and unsuccessful 200 responses are failures", async () => {
  for (const body of [null, {}, { holdings: null, trades: [] }, { ok: false, holdings: [], trades: [] }]) {
    const result = await loadPortfolio({ auth, fetcher: async () => reply(body) });
    assert.equal(result.holdings.status, "error");
  }
  const result = await loadPortfolio({ auth, fetcher: async () => ({ status: 200, json: async () => { throw Error("HTML"); } }) });
  assert.ok(Object.values(result).every(c => c.status === "error"));
});
test("session failures are handled and authenticated mutation headers are consistent", async () => {
  assert.deepEqual(await portfolioHeaders(auth, true), { "Content-Type": "application/json", Authorization: "Bearer test-session" });
  const result = await loadPortfolio({ auth: { getSession: async () => ({ error: Error("expired session") }) } });
  assert.ok(Object.values(result).every(c => c.status === "error" && c.error.message === "expired session"));
});
test("collections are delivered as each finishes without waiting for a slow sibling", async () => {
  let release;
  const seen = [];
  const pending = loadPortfolio({auth, onCollection: name => seen.push(name), fetcher: async url =>
    url.includes("long-term") ? new Promise(resolve => { release = resolve; }) : reply({ trades: orders }) });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(seen.sort(), ["pendingBuyOrders", "shortTermHoldings"]);
  release(reply({holdings: [holding]}));
  await pending;
  assert.ok(seen.includes("holdings"));
});

const directory = await mkdtemp(path.join(tmpdir(), "freedom-portfolio-loading-"));
const storeFile = path.join(directory, "portfolio.json");
process.env.FREEDOM_TRADE_STORE_PATH = storeFile;
const store = await import("../lib/freedom/tradeStore.js");
test.after(async () => { await rm(directory, { recursive: true, force: true }); });

test("mixed holdings and pending orders persist across fresh loads without writes or P&L", async () => {
  const original = JSON.stringify({ version: 1, longTermHoldings: [holding], shortTermTrades: orders, tradeImports: [], updatedAt: "2026-09-01" });
  await writeFile(storeFile, original);
  const fetcher = async url => reply(url.includes("long-term")
    ? { holdings: await store.listLongTermHoldings() }
    : { trades: (await store.listShortTermTrades()).map(order => store.enrichShortTermTrade(order, { price: 10 })) });
  const first = await loadPortfolio({ auth, fetcher });
  const reload = await loadPortfolio({ auth, fetcher });
  assert.deepEqual(first, reload);
  assert.deepEqual(first.holdings.data, [holding]);
  assert.deepEqual(first.pendingBuyOrders.data.map(o => o.termClassification), ["long-term", "short-term"]);
  for (const row of reload.pendingBuyOrders.data) {
    assert.equal(row.effectiveStatus, "pending");
    assert.equal(row.profitLoss, null);
    assert.equal(row.marketValue, null);
  }
  await store.persistTriggeredTrades(reload.pendingBuyOrders.data);
  assert.equal(await readFile(storeFile, "utf8"), original);
});
test("corrupt or mismatched storage raises an error and is never overwritten", async () => {
  for (const source of ["{broken", '{"longTermHoldings":{},"shortTermTrades":[]}', "null"]) {
    await writeFile(storeFile, source);
    await assert.rejects(store.listLongTermHoldings());
    await assert.rejects(store.listShortTermTrades());
    assert.equal(await readFile(storeFile, "utf8"), source);
  }
});
