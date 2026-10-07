import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import * as client from "../lib/freedom/portfolioClient.js";
import * as sessions from "../lib/freedom/marketSessions.js";


const require = createRequire(import.meta.url);
const { transformSync } = require("next/dist/build/swc");
const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost:3000/freedom/my-trades" });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let token = "test-token";
let authListener;
const auth = {
  getSession: async () => ({ data: { session: token ? { access_token: token } : null } }),
  onAuthStateChange: callback => (authListener = callback, { data: { subscription: { unsubscribe() {} } } }),
};
const frame = ({ children }) => React.createElement("div", null, children);
const source = fs.readFileSync(new URL("../pages/freedom/index.js", import.meta.url), "utf8");
const compiled = transformSync(source, {
  filename: "index.js", jsc: { parser: { syntax: "ecmascript", jsx: true },
    transform: { react: { runtime: "automatic" } }, target: "es2022" }, module: { type: "commonjs" },
}).code;
const exports = {};
vm.runInNewContext(compiled, {
  exports, require(name) {
    if (name.includes("supabaseClient")) return { supabase: { auth } };
    if (name.includes("portfolioClient")) return client;
    if (name === "next/router") return { useRouter: () => ({ push() {} }) };
    if (name.includes("marketSessions")) return sessions;
    if (name.includes("FreedomChartModal")) return { __esModule: true, default: () => null };
    if (name === "next/head") return { __esModule: true, default: () => null };
    if (name.includes("FreedomShell")) return { __esModule: true, default: frame, FreedomNotice: ({title,message,children}) => React.createElement("div", {role:"alert"},title,message,children), ActionBadge: frame, WhyThisResult: frame,
      formatMoney: String, formatPercent: String, formatSignedMoney: String, formatTimestamp: String };
    if (name.includes("FreedomTradeChart")) return { __esModule: true, default: props => React.createElement("div", { "data-entry-price": props.entryPrice }, "Test chart") };
    return require(name);
  }, console: { ...console, error() {} }, AbortController, queueMicrotask, URLSearchParams, setTimeout, process: {env: {NODE_ENV:"development"}},
  window: dom.window, document: dom.window.document, fetch: (...args) => globalThis.fetch(...args),
});
const Page = exports.default;
let root;
const container = document.getElementById("root");
const text = () => container.textContent.replace(/\s+/g, " ");
async function settle() { await act(async () => { await new Promise(resolve => setTimeout(resolve, 15)); }); }
async function mount() {
  root = createRoot(container);
  await act(async () => root.render(React.createElement(React.StrictMode, null, React.createElement(Page))));
  await settle();
}
async function click(button) { assert.ok(button); await act(async () => button.click()); await settle(); }
test.afterEach(async () => { if (root) await act(async () => root.unmount()); root = null; });
test.after(() => dom.window.close());
const response = (body, status = 200) => ({ status, ok: status === 200, json: async () => body });


for (const status of [401, 403, 500, "network"]) {
  test(`Strict Mode duplicated scan handles ${status} without unhandled rejection and Retry recovers`, async () => {
    token = "test-token";
    let calls = 0;
    globalThis.fetch = async () => { calls++; await new Promise(r => setTimeout(r, 5));
      if (status === "network") throw Error("Network unavailable");
      return response({ error: "Denied" }, status);
    };
    await mount();
    assert.equal(calls, 1, "Strict Mode shares one handled request");
    assert.ok(document.querySelector('[role="alert"]'));
    assert.ok(!text().includes("No qualifying trades today"));
    assert.match(text(), status === 401 ? /Sign in required/ : status === 403 ? /Unable to access Freedom/ : /Market data failure/);
    globalThis.fetch = async () => response({outcome:"no-qualifying-trades", opportunities:[]});
    await click([...document.querySelectorAll('button')].find(b=>b.textContent==='Retry'));
    assert.ok(!text().includes('Denied'));
  });
}
test("missing session makes no unauthenticated request and signing in resumes scanning", async () => {
  token = null;
  let calls=0;
  globalThis.fetch = async (url, options) => {calls++; assert.equal(options.headers.Authorization, 'Bearer renewed'); return response({ok:true, opportunities:[]});};
  await mount();
  assert.equal(calls,0);
  assert.match(text(), /Sign in required/);
  assert.equal(document.querySelector('a.fdButton').getAttribute('href'), '/login?redirect=%2Ffreedom');
  token='renewed';
  await act(async()=>authListener('SIGNED_IN'));
  await settle();
  assert.equal(calls,1);
  assert.ok(!text().includes('Sign in required'));
});
