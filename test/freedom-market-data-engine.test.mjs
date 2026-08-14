import assert from "node:assert/strict";
import test from "node:test";

process.env.TWELVE_DATA_API_KEY = "unit-test-key";
process.env.TWELVE_DATA_CREDITS_PER_MINUTE = "48";
process.env.TWELVE_DATA_BATCH_SIZE = "8";
delete process.env.ALPACA_API_KEY;
delete process.env.ALPACA_API_SECRET;

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

test("Alpaca primary history feeds chart and analysis from the same normalized bars", async () => {
  process.env.ALPACA_API_KEY = "unit-alpaca-key";
  process.env.ALPACA_API_SECRET = "unit-alpaca-secret";
  let calls = 0;
  global.fetch = async (url) => {
    calls += 1;
    assert.match(String(url), /data\.alpaca\.markets\/v2\/stocks\/bars/);
    return makeResponse({ bars: {
      TJGC: [
        { t: "2026-08-10T04:00:00Z", o: 4.8, h: 5, l: 4.65, c: 4.65, v: 49800 },
        { t: "2026-08-11T04:00:00Z", o: 4.1, h: 4.3, l: 3.18, c: 3.6, v: 500000 },
        { t: "2026-08-12T04:00:00Z", o: 3.7, h: 4.1, l: 3.5, c: 3.9, v: 900000 },
        { t: "2026-08-13T04:00:00Z", o: 3.78, h: 4.02, l: 3.77, c: 3.86, v: 1028123 },
      ],
      SNDK: [
        { t: "2026-08-12T04:00:00Z", o: 1339.4, h: 1580.88, l: 1331.62, c: 1528.11, v: 21647562 },
      ],
    } });
  };

  const service = await importMarketDataService("alpaca");
  const { buildFreedomChartInput, summarizeOhlc } = await import("../lib/freedom-trader/chartSeriesIntegrity.js?test=alpaca");
  service.resetMarketDataMetrics();
  const snapshots = await service.getMarketSnapshotBatch(["TJGC", "SNDK"], { range: "5d", interval: "1day" });
  const tjgc = snapshots.get("TJGC");
  const chart = buildFreedomChartInput(tjgc.candles.daily, { chartType: "candles" });
  const summary = summarizeOhlc(tjgc.candles.daily);
  const metrics = service.getMarketDataMetrics();

  assert.equal(calls, 1);
  assert.equal(tjgc.source, "Alpaca");
  assert.equal(tjgc.quote.price, 3.86);
  assert.deepEqual(chart.candles[3], [3.78, 3.86, 3.77, 4.02]);
  assert.deepEqual(chart.volume, [49800, 500000, 900000, 1028123]);
  assert.deepEqual(summary, { count: 4, firstPrice: 4.65, sessionLow: 3.18, sessionHigh: 5, lastPrice: 3.86 });
  assert.equal(metrics.alpacaProviderCalls, 1);
  assert.equal(metrics.alpacaSymbolsRequested, 2);
  delete process.env.ALPACA_API_KEY;
  delete process.env.ALPACA_API_SECRET;
});
