import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
const require = createRequire(import.meta.url);
const { transformSync } = require("next/dist/build/swc");
const compiled = transformSync(fs.readFileSync("components/freedom/FreedomTradeChart.js", "utf8"), {
  filename: "FreedomTradeChart.js", jsc: { parser: { syntax: "ecmascript", jsx: true }, transform: { react: { runtime: "automatic" } }, target: "es2022" }, module: { type: "commonjs" },
}).code;
const exports = {};
vm.runInNewContext(compiled, { exports, require(name) {
  if (name.includes("FreedomVolatilityPanel")) return { __esModule: true, default: () => null, volatilityFromCandles: () => ({}) };
  return require(name);
} });
const candles = [{date:"2026-09-01", open:12,high:13,low:11,close:12.5},{date:"2026-09-02",open:12.5,high:14,low:12,close:12.69}];
test("unknown execution price and safety exit never become fabricated zero chart markers", () => {
  const html = renderToStaticMarkup(React.createElement(exports.default, { candles, entryPrice: null, currentPrice: 12.69, safetyExit: null, targets: [null,16] }));
  assert.ok(!html.includes("Entry"));
  assert.ok(!html.includes("Safety Exit"));
  assert.ok(html.includes("Now 12.690"));
  assert.ok(html.includes("Target 1 16.000"));
});
test("known AUD purchase prices are marked at their supplied precision", () => {
  const html = renderToStaticMarkup(React.createElement(exports.default, { candles, entryPrice: 71.738, currentPrice: 71.61 }));
  assert.ok(html.includes("Entry 71.738"));
  assert.ok(html.includes("Now 71.610"));
});
