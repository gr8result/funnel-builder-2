import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  AlpacaProvider,
  FinnhubProvider,
  TwelveDataProvider,
  providerSummary,
  selectMarketDataProvider,
} from "../lib/freedom-trader/marketDataProviders.js";
// M2.1: the route default export is now wrapped by the Freedom auth guard, so an
// anonymous call correctly returns 401. This test exercises the handler logic
// itself, which the route exposes unguarded for exactly this purpose.
import { __unguardedHandler as testFinnhubHandler } from "../pages/api/freedom/test-finnhub.js";

function restoreEnv(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function response(payload, init = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    headers: {
      get(name) {
        return init.headers?.[String(name).toLowerCase()] ?? null;
      },
    },
    async json() {
      return payload;
    },
  };
}

test("provider selection uses Finnhub for universe and pre-screen, Twelve Data for detailed history", () => {
  const previousAlpacaKey = process.env.ALPACA_API_KEY;
  const previousAlpacaSecret = process.env.ALPACA_API_SECRET;
  const previous = process.env.FINNHUB_API_KEY;
  delete process.env.ALPACA_API_KEY;
  delete process.env.ALPACA_API_SECRET;
  process.env.FINNHUB_API_KEY = "unit-test-key";
  try {
    assert.equal(selectMarketDataProvider("symbolUniverse").id, "finnhub");
    assert.equal(selectMarketDataProvider("preScreenQuote").id, "finnhub");
    assert.equal(selectMarketDataProvider("detailedHistory").id, "twelve-data");
    assert.equal(selectMarketDataProvider("detailedHistory", { forceProvider: "finnhub" }).id, "finnhub");
  } finally {
    restoreEnv("FINNHUB_API_KEY", previous);
    restoreEnv("ALPACA_API_KEY", previousAlpacaKey);
    restoreEnv("ALPACA_API_SECRET", previousAlpacaSecret);
  }
});

test("provider selection uses Alpaca as primary US OHLCV provider when configured", () => {
  const previousKey = process.env.ALPACA_API_KEY;
  const previousSecret = process.env.ALPACA_API_SECRET;
  process.env.ALPACA_API_KEY = "unit-alpaca-key";
  process.env.ALPACA_API_SECRET = "unit-alpaca-secret";
  try {
    assert.equal(selectMarketDataProvider("preScreenQuote").id, "alpaca");
    assert.equal(selectMarketDataProvider("detailedHistory").id, "alpaca");
    assert.equal(selectMarketDataProvider("usOhlcv").id, "alpaca");
  } finally {
    restoreEnv("ALPACA_API_KEY", previousKey);
    restoreEnv("ALPACA_API_SECRET", previousSecret);
  }
});

test("Alpaca authentication does not expose credentials", async () => {
  const previousKey = process.env.ALPACA_API_KEY;
  const previousSecret = process.env.ALPACA_API_SECRET;
  process.env.ALPACA_API_KEY = "unit-alpaca-key";
  process.env.ALPACA_API_SECRET = "unit-alpaca-secret";
  try {
    const result = await AlpacaProvider.authenticate({
      fetchImpl: async (url, options) => {
        assert.match(String(url), /stocks\/bars/);
        assert.equal(options.headers["APCA-API-KEY-ID"], "unit-alpaca-key");
        assert.equal(options.headers["APCA-API-SECRET-KEY"], "unit-alpaca-secret");
        return response({ bars: { MSFT: [{ t: "2026-08-13T04:00:00Z", o: 10, h: 11, l: 9, c: 10.5, v: 1000 }] } });
      },
    });
    assert.equal(result.ok, true);
    assert.equal(JSON.stringify(result).includes("unit-alpaca-key"), false);
    assert.equal(JSON.stringify(result).includes("unit-alpaca-secret"), false);
  } finally {
    restoreEnv("ALPACA_API_KEY", previousKey);
    restoreEnv("ALPACA_API_SECRET", previousSecret);
  }
});

test("Alpaca multi-symbol bars normalize chronological OHLCV without synthetic points", async () => {
  const previousKey = process.env.ALPACA_API_KEY;
  const previousSecret = process.env.ALPACA_API_SECRET;
  process.env.ALPACA_API_KEY = "unit-alpaca-key";
  process.env.ALPACA_API_SECRET = "unit-alpaca-secret";
  try {
    const batch = await AlpacaProvider.historyBatch(["TJGC", "SNDK"], { range: "5d", interval: "1day" }, {
      fetchImpl: async () => response({ bars: {
        TJGC: [
          { t: "2026-08-12T04:00:00Z", o: 3.7, h: 4, l: 3.5, c: 3.9, v: 900000 },
          { t: "2026-08-13T04:00:00Z", o: 3.8, h: 4.02, l: 3.77, c: 3.86, v: 1028123 },
        ],
        SNDK: [
          { t: "2026-08-12T04:00:00Z", o: 1300, h: 1400, l: 1290, c: 1344.29, v: 18000000 },
          { t: "2026-08-13T04:00:00Z", o: 1339.40198, h: 1580.88, l: 1331.62036, c: 1528.10999, v: 21647562 },
        ],
      } }),
    });
    const tjgc = batch.get("TJGC");
    assert.equal(tjgc.provider, "Alpaca");
    assert.equal(tjgc.candleCount, 2);
    assert.deepEqual(tjgc.candles.map((candle) => candle.date), ["2026-08-12", "2026-08-13"]);
    assert.deepEqual(tjgc.candles[1], {
      timestamp: 1786593600,
      date: "2026-08-13",
      open: 3.8,
      high: 4.02,
      low: 3.77,
      close: 3.86,
      volume: 1028123,
      provider: "Alpaca",
      delayed: true,
      freshness: "End-of-day",
      tradeCount: null,
      vwap: null,
      adjusted: false,
    });
    assert.equal(batch.diagnostics.symbolsRequested, 2);
    assert.equal(batch.diagnostics.barsReturned, 4);
    assert.equal(batch.diagnostics.apiCalls, 1);
  } finally {
    restoreEnv("ALPACA_API_KEY", previousKey);
    restoreEnv("ALPACA_API_SECRET", previousSecret);
  }
});

test("Alpaca history normalization rejects malformed OHLCV bars", async () => {
  const previousKey = process.env.ALPACA_API_KEY;
  const previousSecret = process.env.ALPACA_API_SECRET;
  process.env.ALPACA_API_KEY = "unit-alpaca-key";
  process.env.ALPACA_API_SECRET = "unit-alpaca-secret";
  try {
    const batch = await AlpacaProvider.historyBatch(["BAD"], { range: "5d", interval: "1day" }, {
      fetchImpl: async () => response({ bars: {
        BAD: [
          { t: "2026-08-12T04:00:00Z", o: 3.7, h: 4, l: 3.5, c: 3.9, v: 900000 },
          { t: "2026-08-13T04:00:00Z", o: 4.1, h: 4.15, l: 4.05, c: 4.22, v: 1200000 },
          { t: "2026-08-14T04:00:00Z", o: 4.2, h: 4.3, l: 4.1, c: 4.24, v: -1 },
        ],
      } }),
    });
    const bad = batch.get("BAD");
    assert.equal(bad.ok, true);
    assert.equal(bad.candleCount, 1);
    assert.deepEqual(bad.candles.map((candle) => candle.date), ["2026-08-12"]);
    assert.equal(batch.diagnostics.barsReturned, 1);
  } finally {
    restoreEnv("ALPACA_API_KEY", previousKey);
    restoreEnv("ALPACA_API_SECRET", previousSecret);
  }
});

test("Alpaca latest trade and one-sided quote normalization do not fabricate midpoint prices", async () => {
  const previousKey = process.env.ALPACA_API_KEY;
  const previousSecret = process.env.ALPACA_API_SECRET;
  process.env.ALPACA_API_KEY = "unit-alpaca-key";
  process.env.ALPACA_API_SECRET = "unit-alpaca-secret";
  try {
    const quote = await AlpacaProvider.quote("AAPL", {
      fetchImpl: async () => response({ quotes: { AAPL: { t: "2026-08-14T19:59:00Z", bp: 290.32, ap: 0, bs: 1, as: 0 } } }),
    });
    const trade = await AlpacaProvider.latestTrade("AAPL", {
      fetchImpl: async () => response({ trades: { AAPL: { t: "2026-08-14T19:59:01Z", p: 305.94, s: 100, x: "V" } } }),
    });
    assert.equal(quote.ok, false);
    assert.equal(quote.price, null);
    assert.equal(trade.ok, true);
    assert.equal(trade.price, 305.94);
    assert.equal(JSON.stringify(trade).includes("unit-alpaca-key"), false);
  } finally {
    restoreEnv("ALPACA_API_KEY", previousKey);
    restoreEnv("ALPACA_API_SECRET", previousSecret);
  }
});

test("Alpaca latest trade batch and asset metadata stay credential-safe", async () => {
  const previousKey = process.env.ALPACA_API_KEY;
  const previousSecret = process.env.ALPACA_API_SECRET;
  process.env.ALPACA_API_KEY = "unit-alpaca-key";
  process.env.ALPACA_API_SECRET = "unit-alpaca-secret";
  try {
    const trades = await AlpacaProvider.latestTradeBatch(["SNDK", "TJGC"], {
      fetchImpl: async (url, options) => {
        assert.match(String(url), /stocks\/trades\/latest/);
        assert.equal(options.headers["APCA-API-KEY-ID"], "unit-alpaca-key");
        return response({ trades: {
          SNDK: { t: "2026-08-14T19:59:00Z", p: 1641.275, s: 100, x: "V" },
          TJGC: { t: "2026-08-14T18:16:00Z", p: 3.96, s: 245, x: "V" },
        } });
      },
    });
    const sndk = trades.get("SNDK");
    assert.equal(sndk.ok, true);
    assert.equal(sndk.price, 1641.275);
    assert.equal(trades.diagnostics.apiCalls, 1);
    assert.equal(JSON.stringify(trades).includes("unit-alpaca-secret"), false);

    const assets = await AlpacaProvider.assetUniverse({
      fetchImpl: async (url) => {
        assert.match(String(url), /paper-api\.alpaca\.markets\/v2\/assets/);
        return response([
          { id: "sndk-asset", class: "us_equity", exchange: "NASDAQ", symbol: "SNDK", name: "Sandisk Corporation Common Stock", status: "active", tradable: true },
          { id: "tjgc-asset", class: "us_equity", exchange: "NASDAQ", symbol: "TJGC", name: "TJGC Group Ltd. Class A Ordinary Shares", status: "active", tradable: true },
        ]);
      },
    });
    assert.equal(assets.ok, true);
    assert.equal(assets.assetsBySymbol.get("SNDK").assetClass, "us_equity");
    assert.equal(assets.assetsBySymbol.get("SNDK").providerSymbol, "SNDK");
    assert.equal(JSON.stringify(assets).includes("unit-alpaca-key"), false);
  } finally {
    restoreEnv("ALPACA_API_KEY", previousKey);
    restoreEnv("ALPACA_API_SECRET", previousSecret);
  }
});

test("Finnhub authentication does not expose the API key", async () => {
  const previous = process.env.FINNHUB_API_KEY;
  process.env.FINNHUB_API_KEY = "secret-unit-key";
  try {
    const result = await FinnhubProvider.authenticate({
      fetchImpl: async (url) => {
        assert.match(String(url), /token=secret-unit-key/);
        return response({ c: 100, pc: 99, t: 1786651200 }, { headers: { "x-ratelimit-limit": "60", "x-ratelimit-remaining": "59" } });
      },
    });
    assert.equal(result.ok, true);
    assert.equal(JSON.stringify(result).includes("secret-unit-key"), false);
    assert.deepEqual(Object.keys(result.rateLimit).sort(), ["limit", "remaining", "reset", "retryAfter"].sort());
  } finally {
    restoreEnv("FINNHUB_API_KEY", previous);
  }
});

test("Finnhub symbol resolution and normalized quote shape are provider-neutral", async () => {
  const previous = process.env.FINNHUB_API_KEY;
  process.env.FINNHUB_API_KEY = "secret-unit-key";
  try {
    const search = await FinnhubProvider.searchSymbols("SNDK", {
      fetchImpl: async () => response({ result: [{ symbol: "SNDK", displaySymbol: "SNDK", description: "SANDISK CORP", type: "Common Stock" }] }),
    });
    assert.equal(search.matches[0].symbol, "SNDK");
    assert.equal(search.matches[0].type, "Common Stock");

    const quote = await FinnhubProvider.quote("TJGC", {
      fetchImpl: async () => response({ c: 3.86, o: 3.79, h: 4.02, l: 3.77, pc: 3.75, dp: 2.93, t: 1786651200 }),
    });
    assert.deepEqual({
      ok: quote.ok,
      symbol: quote.symbol,
      provider: quote.provider,
      price: quote.price,
      previousClose: quote.previousClose,
      timestamp: quote.timestamp,
    }, {
      ok: true,
      symbol: "TJGC",
      provider: "Finnhub",
      price: 3.86,
      previousClose: 3.75,
      timestamp: 1786651200,
    });
  } finally {
    restoreEnv("FINNHUB_API_KEY", previous);
  }
});

test("provider failure stays structured so scanner fallback can choose another provider", async () => {
  const previous = process.env.FINNHUB_API_KEY;
  process.env.FINNHUB_API_KEY = "secret-unit-key";
  try {
    const history = await FinnhubProvider.history("TJGC", {}, {
      fetchImpl: async () => response({ error: "You don't have access to this resource." }, { ok: false, status: 403 }),
    });
    assert.equal(history.ok, false);
    assert.equal(history.provider, "Finnhub");
    assert.match(history.error, /access/i);
    assert.equal(selectMarketDataProvider("detailedHistory").id, TwelveDataProvider.id);
  } finally {
    restoreEnv("FINNHUB_API_KEY", previous);
  }
});

test("client-side Freedom Trader files do not reference server market-data keys", async () => {
  const clientFiles = [
    "pages/freedom-trader/index.js",
    "pages/freedom-trader/market-opportunities.js",
    "pages/freedom-trader/company/[symbol].js",
    "components/freedom-trader/AnalyseStockPanel.js",
  ];
  for (const file of clientFiles) {
    const text = await readFile(file, "utf8");
    assert.equal(text.includes("FINNHUB_API_KEY"), false, file);
    assert.equal(text.includes("ALPACA_API_KEY"), false, file);
    assert.equal(text.includes("ALPACA_API_SECRET"), false, file);
    assert.equal(text.includes("APCA_API_KEY_ID"), false, file);
    assert.equal(text.includes("APCA_API_SECRET_KEY"), false, file);
  }
});

test("Finnhub diagnostic route returns only safe authentication metadata", async () => {
  const previous = process.env.FINNHUB_API_KEY;
  process.env.FINNHUB_API_KEY = "secret-unit-key";
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => response({ c: 100, pc: 99, t: 1786651200 });
  try {
    let statusCode = 0;
    let body = null;
    await testFinnhubHandler({ method: "GET" }, {
      status(code) {
        statusCode = code;
        return this;
      },
      json(payload) {
        body = payload;
        return payload;
      },
    });
    assert.equal(statusCode, 200);
    assert.equal(body.configured, true);
    assert.equal(body.authenticated, true);
    assert.equal(JSON.stringify(body).includes("secret-unit-key"), false);
    assert.equal("keyStartsWith" in body, false);
    assert.equal("requestUrlPreview" in body, false);
  } finally {
    globalThis.fetch = previousFetch;
    restoreEnv("FINNHUB_API_KEY", previous);
  }
});

test("provider summary exposes environment variable name but not value", () => {
  const previous = process.env.FINNHUB_API_KEY;
  process.env.FINNHUB_API_KEY = "secret-unit-key";
  try {
    const summary = providerSummary();
    assert.equal(summary.providers.find((provider) => provider.id === "finnhub").envVarName, "FINNHUB_API_KEY");
    assert.equal(JSON.stringify(summary).includes("secret-unit-key"), false);
  } finally {
    restoreEnv("FINNHUB_API_KEY", previous);
  }
});
