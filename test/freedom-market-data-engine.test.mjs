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
    if (String(url).includes("/stocks/trades/latest")) {
      return makeResponse({ trades: {
        TJGC: { t: "2026-08-13T19:59:00Z", p: 3.95, s: 100, x: "V" },
        SNDK: { t: "2026-08-13T19:59:00Z", p: 1528.11, s: 100, x: "V" },
      } });
    }
    assert.match(String(url), /data\.alpaca\.markets\/v2\/stocks\/bars/);
    return makeResponse({ bars: {
      TJGC: [
        ...Array.from({ length: 20 }, (_, index) => ({ t: new Date(Date.UTC(2026, 6, 17 + index, 4)).toISOString(), o: 3.72 + index * 0.01, h: 4.05 + index * 0.01, l: 3.5 + index * 0.01, c: 3.8 + index * 0.01, v: 900000 + index * 1000 })),
        { t: "2026-08-10T04:00:00Z", o: 4.8, h: 5, l: 4.65, c: 4.65, v: 49800 },
        { t: "2026-08-11T04:00:00Z", o: 4.1, h: 4.3, l: 3.18, c: 3.6, v: 500000 },
        { t: "2026-08-12T04:00:00Z", o: 3.7, h: 4.1, l: 3.5, c: 3.9, v: 900000 },
        { t: "2026-08-13T04:00:00Z", o: 3.78, h: 4.02, l: 3.77, c: 3.95, v: 1028123 },
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

  assert.equal(calls, 2);
  assert.equal(tjgc.source, "Alpaca");
  assert.equal(tjgc.quote.price, 3.95);
  assert.deepEqual(chart.candles.at(-1), [3.78, 3.95, 3.77, 4.02]);
  assert.equal(chart.volume.at(-1), 1028123);
  assert.equal(summary.count, 24);
  assert.equal(summary.sessionLow, 3.18);
  assert.equal(summary.sessionHigh, 5);
  assert.equal(summary.lastPrice, 3.95);
  assert.equal(metrics.alpacaProviderCalls, 1);
  assert.equal(metrics.alpacaSymbolsRequested, 2);
  delete process.env.ALPACA_API_KEY;
  delete process.env.ALPACA_API_SECRET;
});

test("Alpaca latest trade discontinuity with daily history withholds invalid prices", async () => {
  process.env.ALPACA_API_KEY = "unit-alpaca-key";
  process.env.ALPACA_API_SECRET = "unit-alpaca-secret";
  global.fetch = async (url) => {
    if (String(url).includes("/stocks/trades/latest")) {
      return makeResponse({ trades: { SNDK: { t: "2026-08-13T19:59:00Z", p: 1641.28, s: 100, x: "V" } } });
    }
    return makeResponse({ bars: { SNDK: makeCandles(60, 40).map((candle) => ({
      t: `${candle.datetime}T04:00:00Z`,
      o: Number(candle.open),
      h: Number(candle.high),
      l: Number(candle.low),
      c: Number(candle.close),
      v: Number(candle.volume),
    })) } });
  };

  const service = await importMarketDataService("invalid-price");
  const snapshot = await service.getMarketSnapshot("SNDK", { range: "3mo", interval: "1day" });

  assert.equal(snapshot.dataQuality, "unavailable");
  assert.equal(snapshot.statusCode, "DATA_INVALID");
  assert.equal(snapshot.quote.price, null);
  assert.match(snapshot.error, /ANALYSIS WITHHELD/);
  delete process.env.ALPACA_API_KEY;
  delete process.env.ALPACA_API_SECRET;
});

test("market snapshot rejects malformed OHLCV rows instead of analysing corrupted history", async () => {
  const service = await importMarketDataService("malformed-ohlcv");
  const snapshot = service.snapshotFromHistory("BAD", {
    ok: true,
    symbol: "BAD",
    provider: "Unit Provider",
    candles: [
      ...Array.from({ length: 20 }, (_, index) => ({
        timestamp: Date.UTC(2026, 6, 10 + index, 4) / 1000,
        date: new Date(Date.UTC(2026, 6, 10 + index, 4)).toISOString().slice(0, 10),
        open: 3.8 + index * 0.01,
        high: 4.1 + index * 0.01,
        low: 3.7 + index * 0.01,
        close: 3.9 + index * 0.01,
        volume: 900000 + index * 1000,
      })),
      { timestamp: 1786593600, date: "2026-08-13", open: 4.1, high: 4.15, low: 4.05, close: 4.22, volume: 1200000 },
    ],
  }, { ok: true, price: 4.2, timestamp: "2026-08-13T19:59:00Z" });

  assert.equal(snapshot.dataQuality, "unavailable");
  assert.equal(snapshot.statusCode, "DATA_INVALID");
  assert.equal(snapshot.quote.price, null);
  assert.equal(snapshot.candles.daily.length, 0);
  assert.match(snapshot.error, /malformed OHLCV/i);
});

test("ASX snapshot requests use exchange-qualified symbols and reject USD history", async () => {
  const requested = [];
  global.fetch = async (url) => {
    const parsed = new URL(String(url));
    requested.push(parsed.hostname === "query1.finance.yahoo.com" ? parsed.pathname : parsed.searchParams.get("symbol"));
    return makeResponse({
      chart: {
        result: [{
          meta: { symbol: "ALK.AX", exchangeName: "NASDAQ", fullExchangeName: "NASDAQ", currency: "USD" },
          timestamp: Array.from({ length: 240 }, (_, index) => Date.UTC(2025, 8, 1 + index) / 1000),
          indicators: { quote: [{
            open: Array.from({ length: 240 }, (_, index) => 1 + index * 0.01),
            high: Array.from({ length: 240 }, (_, index) => 1.1 + index * 0.01),
            low: Array.from({ length: 240 }, (_, index) => 0.9 + index * 0.01),
            close: Array.from({ length: 240 }, (_, index) => 1.05 + index * 0.01),
            volume: Array.from({ length: 240 }, () => 2_000_000),
          }] },
        }],
        error: null,
      },
    });
  };

  const service = await importMarketDataService("asx-qualified");
  const snapshots = await service.getMarketSnapshotBatch([
    { symbol: "ALK", providerSymbol: "ALK:ASX", exchange: "ASX", currency: "AUD" },
  ], { range: "1y", interval: "1day" });
  const snapshot = snapshots.get("ALK");

  assert.deepEqual(requested, ["/v8/finance/chart/ALK.AX"]);
  assert.equal(snapshot.dataQuality, "unavailable");
  assert.equal(snapshot.statusCode, "DATA_INVALID");
  assert.match(snapshot.error, /Expected ASX AUD/i);
});

test("ASX unavailable history keeps requested exchange and currency in diagnostics", async () => {
  const service = await importMarketDataService("asx-unavailable-metadata");
  const snapshot = service.snapshotFromHistory("CBA", {
    ok: false,
    symbol: "CBA:ASX",
    provider: "Twelve Data",
    candles: [],
    error: "This symbol is available starting with the Pro or Venture plan.",
  }, null, { exchange: "ASX", currency: "AUD" });

  assert.equal(snapshot.dataQuality, "unavailable");
  assert.equal(snapshot.exchange, "ASX");
  assert.equal(snapshot.currency, "AUD");
  assert.equal(snapshot.quote.price, null);
  assert.match(snapshot.error, /Pro or Venture/i);
});

test("ASX history uses Yahoo Finance daily candles", async () => {
  const requested = [];
  global.fetch = async (url) => {
    const parsed = new URL(String(url));
    requested.push(parsed.toString().replace(/apikey=[^&]+/, "apikey=REDACTED"));
    const count = 240;
    return makeResponse({
      chart: {
        result: [{
          meta: {
            symbol: "CBA.AX",
            exchangeName: "ASX",
            fullExchangeName: "ASX",
            currency: "AUD",
            instrumentType: "EQUITY",
            regularMarketPrice: 159.9,
            chartPreviousClose: 158.2,
            timezone: "AEST",
          },
          timestamp: Array.from({ length: count }, (_, index) => Date.UTC(2025, 8, 1 + index) / 1000),
          indicators: {
            quote: [{
              open: Array.from({ length: count }, (_, index) => 100 + index * 0.2),
              high: Array.from({ length: count }, (_, index) => 101 + index * 0.2),
              low: Array.from({ length: count }, (_, index) => 99 + index * 0.2),
              close: Array.from({ length: count }, (_, index) => 100.5 + index * 0.2),
              volume: Array.from({ length: count }, (_, index) => 2_000_000 + index * 1000),
            }],
          },
        }],
        error: null,
      },
    });
  };

  const service = await importMarketDataService("asx-yahoo-fallback");
  service.resetMarketDataMetrics();
  const snapshots = await service.getMarketSnapshotBatch([
    { symbol: "CBA", providerSymbol: "CBA:ASX", exchange: "ASX", currency: "AUD" },
  ], { range: "1y", interval: "1day" });
  const snapshot = snapshots.get("CBA");
  const metrics = service.getMarketDataMetrics();

  assert.equal(snapshot.dataQuality, "daily-only");
  assert.equal(snapshot.source, "Yahoo Finance");
  assert.equal(snapshot.exchange, "ASX");
  assert.equal(snapshot.currency, "AUD");
  assert.equal(snapshot.candleCount, 240);
  assert.deepEqual(requested.map((item) => new URL(item).hostname), ["query1.finance.yahoo.com"]);
  assert.equal(metrics.yahooProviderCalls, 1);
  assert.equal(metrics.indicatorProviderCalls, 0);
  assert.equal(metrics.quoteProviderCalls, 0);
});
