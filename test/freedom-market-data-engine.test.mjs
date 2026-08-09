import assert from "node:assert/strict";
import test from "node:test";

process.env.TWELVE_DATA_API_KEY = "unit-test-key";
process.env.TWELVE_DATA_CREDITS_PER_MINUTE = "48";
process.env.TWELVE_DATA_BATCH_SIZE = "8";

function makeHeaders(values = {}) {
  return {
    get(name) {
      return values[String(name).toLowerCase()] ?? null;
    },
  };
}

function makeResponse(payload, status = 200, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: makeHeaders(headers),
    async json() {
      return payload;
    },
  };
}

function makeCandles(count = 240, start = 100) {
  const output = [];
  const first = Date.UTC(2025, 0, 2);
  for (let index = 0; index < count; index += 1) {
    const close = start + index * 0.15 + Math.sin(index / 8);
    output.push({
      datetime: new Date(first + index * 86400000).toISOString().slice(0, 10),
      open: String((close - 0.4).toFixed(2)),
      high: String((close + 1.2).toFixed(2)),
      low: String((close - 1.1).toFixed(2)),
      close: String(close.toFixed(2)),
      volume: String(2500000 + index * 1000),
    });
  }
  return output;
}

async function importMarketDataService(tag) {
  [
    "__freedomMarketHistoryCache",
    "__freedomMarketQuoteCache",
    "__freedomMarketHistoryInFlight",
    "__freedomMarketQuoteInFlight",
    "__freedomMarketCreditWindow",
    "__freedomMarketDataMetrics",
  ].forEach((name) => {
    delete globalThis[name];
  });
  return import(`../lib/freedom-trader/marketDataService.js?test=${tag}`);
}

test("market data engine batches history, reuses cache and suppresses duplicate requests", async () => {
  let calls = 0;
  global.fetch = async (url) => {
    calls += 1;
    const symbols = new URL(String(url)).searchParams.get("symbol").split(",");
    const payload = Object.fromEntries(symbols.map((symbol, index) => [symbol, {
      meta: { symbol, interval: "1day", exchange: "NASDAQ", currency: "USD" },
      values: makeCandles(240, 100 + index),
    }]));
    return makeResponse(payload, 200, { "api-credits-used": String(calls * symbols.length), "api-credits-left": "48" });
  };

  const service = await importMarketDataService("batch");
  service.resetMarketDataMetrics();
  const first = await service.getMarketSnapshotBatch(["AAPL", "MSFT", "AAPL", "NVDA"], { range: "1y", interval: "1day" });
  const second = await service.getMarketSnapshotBatch(["AAPL", "MSFT"], { range: "1y", interval: "1day" });
  const metrics = service.getMarketDataMetrics();

  assert.equal(first.size, 3);
  assert.equal(second.get("AAPL").dataQuality, "cached");
  assert.equal(calls, 1);
  assert.equal(metrics.historyProviderCalls, 1);
  assert.equal(metrics.historySymbolsRequested, 3);
  assert.equal(metrics.historyCreditsEstimated, 3);
  assert.equal(metrics.historyCacheHits, 2);
  assert.equal(metrics.metadataProviderCalls, 0);
  assert.equal(metrics.indicatorProviderCalls, 0);
});

test("market data engine carries provider failures as unavailable data", async () => {
  global.fetch = async () => makeResponse({ status: "error", message: "API credits limit reached." }, 429, { "retry-after": "0" });

  const service = await importMarketDataService("limit");
  service.resetMarketDataMetrics();
  const snapshot = await service.getMarketSnapshot("AAPL", { range: "1y", interval: "1day" });
  const metrics = service.getMarketDataMetrics();

  assert.equal(snapshot.dataQuality, "unavailable");
  assert.match(snapshot.error, /credit|limit/i);
  assert.equal(snapshot.quote.price, null);
  assert.equal(metrics.historyProviderCalls, 2);
  assert.equal(metrics.historyRetries, 1);
});

test("market data engine times out stalled provider calls", async () => {
  process.env.TWELVE_DATA_TIMEOUT_MS = "5000";
  global.fetch = async (_url, options = {}) => new Promise((_resolve, reject) => {
    options.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
  });

  const service = await importMarketDataService("timeout");
  service.resetMarketDataMetrics();
  const started = Date.now();
  const snapshot = await service.getMarketSnapshot("MSFT", { range: "1y", interval: "1day" });

  assert.equal(snapshot.dataQuality, "unavailable");
  assert.equal(snapshot.quote.price, null);
  assert.ok(Date.now() - started < 9000);
});
