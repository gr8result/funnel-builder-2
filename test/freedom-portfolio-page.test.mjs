import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import * as client from "../lib/freedom/portfolioClient.js";
import { brokerHoldingValuation, reconcileBrokerHoldings } from "../lib/freedom/brokerHoldingsSnapshot.js";
import { importNativeBrokerPosition } from "../lib/freedom/importNativeBrokerPosition.js";

const require = createRequire(import.meta.url);
const { transformSync } = require("next/dist/build/swc");
const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost:3000/freedom/my-trades" });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const auth = {
  getSession: async () => ({ data: { session: { access_token: "isolated-test-token" } } }),
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
};
const frame = ({ children }) => React.createElement("div", null, children);
const source = fs.readFileSync(new URL("../pages/freedom/my-trades.js", import.meta.url), "utf8");
const compiled = transformSync(source, {
  filename: "my-trades.js", jsc: { parser: { syntax: "ecmascript", jsx: true },
    transform: { react: { runtime: "automatic" } }, target: "es2022" }, module: { type: "commonjs" },
}).code;
const exports = {};
vm.runInNewContext(compiled, {
  exports, require(name) {
    if (name.includes("supabaseClient")) return { supabase: { auth } };
    if (name.includes("portfolioClient")) return client;
    if (name === "next/head") return { __esModule: true, default: () => null };
    if (name.includes("FreedomShell")) return { __esModule: true, default: frame, FreedomNotice: frame,
      formatMoney: String, formatPercent: String, formatSignedMoney: String, formatTimestamp: String };
    if (name.includes("FreedomTradeChart")) return { __esModule: true, default: props => React.createElement("div", { "data-entry-price": props.entryPrice }, "Test chart") };
    return require(name);
  }, console: { ...console, error() {} }, AbortController, queueMicrotask, URLSearchParams,
  window: dom.window, document: dom.window.document, fetch: (...args) => globalThis.fetch(...args),
});
const Page = exports.default;
let root;
const container = document.getElementById("root");
const text = () => container.textContent.replace(/\s+/g, " ");
async function settle() { await act(async () => { await new Promise(resolve => setTimeout(resolve, 15)); }); }
async function mount() {
  root = createRoot(container);
  await act(async () => root.render(React.createElement(Page)));
  await settle();
}
async function click(button) { assert.ok(button); await act(async () => button.click()); await settle(); }
test.afterEach(async () => { if (root) await act(async () => root.unmount()); root = null; });
test.after(() => dom.window.close());
const response = (body, status = 200) => ({ status, ok: status === 200, json: async () => body });

test("Tiger USD position does not change CMC AUD totals or fabricate missing costs", async () => {
  const snapshot = JSON.parse(fs.readFileSync("data/freedom/tiger-tjgc-2026-09-06.json", "utf8"));
  const tiger = brokerHoldingValuation(importNativeBrokerPosition({ shortTermTrades: [], longTermHoldings: [] }, snapshot, "now").shortTermTrades[0]);
  const cmc = JSON.parse(fs.readFileSync("data/freedom/cmc-holdings-2026-09-06.json", "utf8"));
  const holdings = cmc.holdings.map(item => brokerHoldingValuation({ id: item.recordId, symbol: item.symbol, quantity: item.quantity, status: "open", brokerHoldingSnapshot: item }));
  globalThis.fetch = async url => response(url.includes("long-term") ? { holdings } : { trades: url.includes("ACTIVE_HOLDING") ? [tiger] : [] });
  await mount();
  const summary = document.querySelector('.fdPortfolioSummary').textContent;
  assert.match(summary, /31017\.64/);
  assert.match(summary, /31482\.05/);
  assert.ok(!summary.includes('42680.32'));
  const card = document.querySelector('[data-symbol="TJGC"]');
  assert.match(card.textContent, /FIFO Price \(rounded\) \(USD\)/);
  assert.match(card.textContent, /Not supplied/);
  assert.ok(!card.textContent.includes('AUD buy line'));
  assert.equal(card.querySelector('[data-entry-price]').getAttribute('data-entry-price'), '10.05');
});

function latestCmcPortfolio() {
  const previous = JSON.parse(fs.readFileSync("data/freedom/cmc-holdings-2026-09-06.json", "utf8"));
  const snapshot = JSON.parse(fs.readFileSync("data/freedom/cmc-holdings-2026-09-09.json", "utf8"));
  const rows = previous.holdings.map(item => ({
    id: item.recordId, symbol: item.symbol, quantity: item.quantity, status: "open",
    kind: item.termClassification || "long-term", currency: "AUD",
    exchange: item.nativeCurrency === "USD" ? "US" : "ASX",
    brokerHoldingSnapshot: { ...item, id: previous.id },
  }));
  rows.find(row => row.symbol === "CLSK").pendingSellOrders = [{
    id: "retained-sell-order", quantity: 320, targetPrice: 18, orderType: "Conditional Sell",
    status: "Active", cmcSnapshot: { currency: "USD" },
  }];
  const store = reconcileBrokerHoldings({
    longTermHoldings: rows.filter(row => row.kind === "long-term"),
    shortTermTrades: rows.filter(row => row.kind === "short-term"),
    brokerPortfolioSnapshot: previous,
  }, snapshot, "2026-09-09T03:00:00.000Z");
  const tigerSnapshot = JSON.parse(fs.readFileSync("data/freedom/tiger-tjgc-2026-09-06.json", "utf8"));
  const tiger = importNativeBrokerPosition({ shortTermTrades: [], longTermHoldings: [] }, tigerSnapshot, "now").shortTermTrades[0];
  return {
    holdings: store.longTermHoldings.map(brokerHoldingValuation),
    shortHoldings: [...store.shortTermTrades, tiger].map(brokerHoldingValuation),
    archivedHoldings: store.archivedHoldings,
    brokerPortfolioSnapshot: store.brokerPortfolioSnapshot,
  };
}

const summaryValues = () => Object.fromEntries([...document.querySelectorAll(".fdSummaryCard")].map(card => [
  card.querySelector(".fdSummaryLabel").textContent, card.querySelector(".fdSummaryValue").textContent,
]));
const holdingValues = card => Object.fromEntries([...card.querySelectorAll(".fdStat")].map(stat => [
  stat.querySelector("dt").textContent, stat.querySelector("dd").textContent,
]));

test("latest CMC stock holdings show account totals, supplied FX and pending sells without a false JBLU loss", async () => {
  const portfolio = latestCmcPortfolio();
  globalThis.fetch = async url => response(url.includes("long-term") ? portfolio
    : { trades: url.includes("ACTIVE_HOLDING") ? portfolio.shortHoldings : [] });
  await mount();
  assert.deepEqual(summaryValues(), {
    "Active CMC Holdings": "4", "Total Holdings (AUD)": "19152.07", "Cash (AUD)": "13256.45",
    "Total Portfolio (AUD)": "32408.52", "Total P&L (AUD)": "576.26", Return: "2.89",
    "Daily P&L (AUD)": "134.56", "Holdings Table Value (AUD)": "19005.36",
  });
  const cards = [...document.querySelectorAll(".fdHoldingCard")];
  assert.deepEqual(cards.map(card => card.dataset.symbol), ["CBA", "CLSK", "IVV", "JBLU", "TJGC"]);
  for (const [symbol, quantity, price, fx, change] of [
    ["CBA", "45", "A$155.160", "1.000", "-A$3.530"],
    ["CLSK", "320", "US$13.480", "0.727", "+US$0.790"],
    ["IVV", "86", "A$70.800", "1.000", "-A$0.200"],
    ["JBLU", "240", "US$4.520", "0.727", "-US$0.110"],
  ]) {
    const card = cards.find(item => item.dataset.symbol === symbol);
    const values = holdingValues(card);
    const nativeCurrency = ["CLSK", "JBLU"].includes(symbol) ? "USD" : "AUD";
    assert.equal(values["Quantity Owned"], quantity);
    assert.equal(values[`Current Price (${nativeCurrency})`], price);
    assert.equal(values[`Price Change (${nativeCurrency})`], change);
    assert.equal(values["CMC FX Rate"], fx);
    assert.match(card.textContent, /retained from the earlier CMC snapshot/);
    assert.match(card.textContent, /Per-holding P&L and return were not supplied/);
    assert.equal(card.querySelector(".fdHoldingPL"), null);
    assert.ok(!card.textContent.includes("FX rate were not supplied"));
  }
  const jblu = cards.find(card => card.dataset.symbol === "JBLU");
  const jbluValues = holdingValues(jblu);
  assert.equal(jbluValues["CMC Table Value (AUD)"], "0");
  assert.equal(jbluValues["Open Sells"], "240");
  assert.equal(jbluValues["Available to Sell"], "0");
  assert.match(jblu.textContent, /SELL PENDING/);
  assert.match(jblu.textContent, /still hold 240 shares; execution is not confirmed/);
  assert.equal(jblu.querySelectorAll(".fdSellOrder").length, 0, "No sell limit price is invented from an open-sell quantity");
  assert.ok(!jblu.textContent.includes("-100"));
  const clsk = cards.find(card => card.dataset.symbol === "CLSK");
  assert.equal(holdingValues(clsk)["Conditional Orders"], "-320");
  assert.equal(holdingValues(clsk)["Available to Sell"], "320");
  assert.match(clsk.querySelector(".fdSellOrder").textContent, /Target Price18/);
  assert.match(document.querySelector(".fdArchivedSection").textContent, /NWH/);
  assert.match(document.querySelector(".fdSummaryTotals").textContent, /Shares Held691/);
  assert.match(document.querySelector(".fdSummaryTotals").textContent, /Available to Sell451/);
});

test("missing account metadata does not turn the zero CMC table value into aggregate P&L", async () => {
  const portfolio = latestCmcPortfolio();
  globalThis.fetch = async url => response(url.includes("long-term")
    ? { ...portfolio, brokerPortfolioSnapshot: null }
    : { trades: url.includes("ACTIVE_HOLDING") ? portfolio.shortHoldings : [] });
  await mount();
  const summary = summaryValues();
  assert.equal(summary["Holdings Table Value (AUD)"], "19005.36");
  assert.equal(summary["P&L"], "Not supplied");
  assert.equal(summary.Return, "Not supplied");
  assert.ok(!("Best Performer" in summary));
  assert.ok(!("Worst Performer" in summary));
});

for (const failure of [401, 403, 500, "network"]) {
  test(`rendered page: ${failure} shows only load error, no false empty state; Retry recovers`, async () => {
    globalThis.fetch = async () => {
      if (failure === "network") throw new TypeError("Failed to fetch");
      return response({ error: "Original error" }, failure);
    };
    await mount();
    assert.equal(document.querySelectorAll('[role="alert"]').length, 3);
    assert.ok(!text().includes("No active holdings or pending orders"));
    assert.equal(document.querySelectorAll("article").length, 0);
    globalThis.fetch = async () => response({ holdings: [], trades: [] });
    for (const button of [...document.querySelectorAll("button")].filter(b => b.textContent === "Retry")) await click(button);
    assert.ok(text().includes("No active holdings or pending orders"));
    assert.ok(!document.querySelector('[role="alert"]'));
  });
}
test("rendered page waits for orders before declaring the portfolio empty", async () => {
  let release;
  globalThis.fetch = async url => url.includes("PENDING_BUY_ORDER")
    ? new Promise(resolve => { release = resolve; }) : response({ holdings: [], trades: [] });
  await mount();
  assert.ok(text().includes("Loading pending orders"));
  assert.ok(!text().includes("No active holdings"));
  await act(async () => release(response({ trades: [] })));
  await settle();
  assert.ok(text().includes("No active holdings or pending orders"));
});
test("real page keeps populated records separate, survives remount, and opens Edit and Chart for each", async () => {
  const holdings = [{ id: "saved-holding", kind: "long-term", symbol: "HOLD", exchange: "US", quantity: 3, purchasePrice: 20, currency: "AUD", pendingSellOrders: [{ id: "saved-sell", targetPrice: 25, cmcSnapshot: { currency: "USD" } }] }];
  const trades = ["long-term", "short-term"].map((termClassification, i) => ({ id: `saved-order-${i}`, symbol: `BUY${i}`, quantity: 4, entryPrice: 15, currency: "AUD", termClassification, status: "pending", orderClassification: "PENDING_BUY_ORDER" }));
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    assert.equal(options.headers.Authorization, "Bearer isolated-test-token");
    if (url.includes("chart?")) return response({ ok: true, candles: [
      { date: "2026-09-01", open: 10, high: 12, low: 9, close: 11 },
      { date: "2026-09-02", open: 11, high: 13, low: 10, close: 12 },
    ] });
    return response(url.includes("long-term") ? { holdings } : { trades: url.includes("ACTIVE_HOLDING") ? [] : trades });
  };
  await mount();
  for (let i = 0; i < 3; i++) {
    const card = document.querySelectorAll("article")[i];
    await click([...card.querySelectorAll("button")].find(b => b.textContent.includes("View Full Chart")));
    assert.ok(document.querySelector('[role="dialog"]'));
    assert.ok(text().includes("Test chart"));
    if (i === 2) {
      assert.ok(requests.at(-1).url.includes("currency=USD"), "chart uses sell-order market currency, not AUD purchase-cost currency");
      assert.equal(document.querySelector('[role="dialog"] [data-entry-price]'), null, "AUD purchase cost is not plotted on a USD chart");
    }
    await click(document.querySelector('[role="dialog"] button[aria-label="Close"]'));
    await click([...card.querySelectorAll("button")].find(b => /Edit Holding|Edit Order/.test(b.textContent)));
    assert.ok(document.querySelector('[role="dialog"] h2').textContent.startsWith("Edit "));
    if (i < 2) assert.equal(document.getElementById("classification").value, trades[i].termClassification);
    // Saving an unchanged edit must reload with authentication, without a write.
    await click([...document.querySelectorAll('[role="dialog"] button')].find(b => b.textContent.includes("Save")));
  }
  await act(async () => root.unmount());
  root = null;
  await mount();
  assert.equal(document.querySelectorAll("article").length, 3);
  assert.ok(!text().includes("No active holdings or pending orders"));
  assert.equal(requests.some(r => r.options.method === "PATCH"), false);
});

test("a failed long-term request leaves short-term holdings and pending orders visible without an overlay", async () => {
  globalThis.fetch = async url => url.includes("long-term") ? response({error: "Not entitled"},403)
    : response({ trades: url.includes("ACTIVE_HOLDING")
      ? [{id:"owned-short", symbol:"OWNED", kind:"short-term", status:"open", quantity:2, entryPrice:10}]
      : [{id:"pending-long", symbol:"PENDING", status:"pending", termClassification:"long-term", orderClassification:"PENDING_BUY_ORDER", quantity:3, entryPrice:15}] });
  await mount();
  assert.equal(document.querySelectorAll("article").length,2);
  assert.ok(text().includes("OWNED") && text().includes("PENDING"));
  assert.equal(document.querySelectorAll('[role="alert"]').length,1);
  assert.ok(!text().includes("No active holdings"));
  assert.equal(document.querySelectorAll('nextjs-portal').length,0);
});

test("editing a pending order preserves its identity and classification after reload", async () => {
  const { Simulate } = require("react-dom/test-utils");
  let saved = { id: "persisted-order", symbol: "PERSIST", quantity: 3, entryPrice: 12, currency: "AUD", termClassification: "long-term", status: "pending", orderClassification: "PENDING_BUY_ORDER" };
  const patches = [];
  globalThis.fetch = async (url, options) => {
    assert.equal(options.headers.Authorization, "Bearer isolated-test-token");
    if (options.method === "PATCH") {
      const patch = JSON.parse(options.body);
      patches.push(patch);
      saved = { ...saved, ...patch };
      return response({ ok: true, trades: [saved] });
    }
    return response(url.includes("long-term") ? { holdings: [] } : { trades: url.includes("PENDING_BUY_ORDER") ? [saved] : [] });
  };
  await mount();
  await click([...document.querySelectorAll("button")].find(b => b.textContent.includes("Edit Order")));
  const input = document.getElementById("quantity");
  await act(async () => Simulate.change(input, { target: { name: "quantity", value: "7", type: "number" } }));
  await click([...document.querySelectorAll('[role="dialog"] button')].find(b => b.textContent.includes("Save")));
  assert.deepEqual(patches, [{id:"persisted-order", quantity:7}]);
  await act(async () => root.unmount());root=null;
  await mount();
  await click([...document.querySelectorAll("button")].find(b => b.textContent.includes("Edit Order")));
  assert.equal(document.getElementById("quantity").value,"7");
  assert.equal(document.getElementById("classification").value,"long-term");
  assert.equal(saved.status,"pending");
  assert.equal(saved.id,"persisted-order");
});
