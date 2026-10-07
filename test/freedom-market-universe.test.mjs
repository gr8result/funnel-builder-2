import assert from "node:assert/strict";
import test from "node:test";

process.env.TWELVEDATA_API_KEY = "unit-test-key";
process.env.FREEDOM_BROAD_SCREEN_LIMIT = "4";
process.env.FREEDOM_DETAILED_ANALYSIS_LIMIT = "2";
process.env.FREEDOM_DISABLE_PROVIDER_WAITS = "true";
delete process.env.FINNHUB_API_KEY;
delete process.env.ALPACA_API_KEY;
delete process.env.ALPACA_API_SECRET;

function response(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    async json() {
      return payload;
    },
  };
}

function restoreEnv(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function stock(symbol, name, exchange = "NASDAQ", country = "United States", currency = "USD") {
  return { symbol, name, exchange, country, currency, type: "Common Stock", mic_code: exchange === "ASX" ? "XASX" : "XNMS" };
}

async function importUniverse(tag) {
  delete globalThis.__freedomMarketUniverseReferenceCache;
  delete globalThis.__freedomAlpacaAssetCache;
  delete globalThis.__freedomDailyPreScreenCache;
  return import(`../lib/freedom-trader/marketUniverse.js?test=${tag}`);
}

test("market discovery uses provider reference universe and separates ASX entitlement", async () => {
  const previousProvider = process.env.FREEDOM_MARKET_DATA_PROVIDER;
  process.env.FREEDOM_MARKET_DATA_PROVIDER = "twelve-data";
  global.fetch = async (url) => {
    const parsed = new URL(String(url));
    if (parsed.pathname.endsWith("/api_usage")) {
      return response({ plan_category: "basic", plan_limit: 8, plan_daily_limit: 800 });
    }
    if (parsed.pathname.endsWith("/stocks")) {
      return response({ data: [
        stock("AAA", "AAA Corp"),
        stock("BBB", "BBB Corp", "NYSE"),
        stock("CCC", "CCC Corp", "AMEX"),
        stock("ETF", "ETF Trust", "NASDAQ", "United States", "USD"),
        { ...stock("ASX1", "ASX One", "ASX", "Australia", "AUD") },
      ] });
    }
    if (parsed.pathname.endsWith("/quote")) {
      const symbols = parsed.searchParams.get("symbol").split(",");
      return response(Object.fromEntries(symbols.map((symbol, index) => [symbol, {
        symbol,
        close: String(20 + index),
        previous_close: String(19 + index),
        percent_change: String(2 + index),
        volume: String(2_000_000 + index * 1000),
        exchange: symbol.endsWith(":ASX") ? "ASX" : "NASDAQ",
        currency: symbol.endsWith(":ASX") ? "AUD" : "USD",
        datetime: "2026-08-14",
      }])));
    }
    throw new Error(`Unexpected URL ${url}`);
  };

  const { buildMarketDiscovery } = await importUniverse("basic");
  const discovery = await buildMarketDiscovery({ markets: ["US", "ASX"], minimumDailyVolume: 1_000_000 });

  assert.equal(discovery.coverage.US.totalSupported, 4);
  assert.equal(discovery.coverage.US.eligibleForScreening, 4);
  assert.equal(discovery.coverage.ASX.totalSupported, 1);
  assert.equal(discovery.coverage.ASX.eligibleForScreening, 1);
  assert.equal(discovery.coverage.ASX.unavailableReason, null);
  assert.equal(discovery.broadScreen.requested, 4);
  assert.equal(discovery.broadScreen.eligible, 4);
  assert.equal(discovery.detailedCandidates.length, 2);
  restoreEnv("FREEDOM_MARKET_DATA_PROVIDER", previousProvider);
});

test("ASX discovery uses Yahoo Finance and rejects mismatched ASX history identity", async () => {
  const previousKey = process.env.TWELVEDATA_API_KEY;
  delete process.env.TWELVEDATA_API_KEY;
  let { buildMarketDiscovery } = await importUniverse("asx-no-key");
  global.fetch = async () => response({ data: [{ ...stock("ASX1", "ASX One", "ASX", "Australia", "AUD") }] });
  let discovery = await buildMarketDiscovery({ markets: ["ASX"], minimumDailyVolume: 1_000_000 });
  assert.equal(discovery.coverage.ASX.eligibleForScreening, 0);
  assert.equal(discovery.coverage.ASX.unavailableReason, null);

  process.env.TWELVEDATA_API_KEY = previousKey || "unit-test-key";
  buildMarketDiscovery = (await importUniverse("asx-mismatch")).buildMarketDiscovery;
  global.fetch = async (url) => {
    const parsed = new URL(String(url));
    if (parsed.pathname.endsWith("/api_usage")) return response({ plan_category: "basic", plan_limit: 8, plan_daily_limit: 800 });
    if (parsed.pathname.endsWith("/stocks")) return response({ data: [{ ...stock("ASX1", "ASX One", "ASX", "Australia", "AUD") }] });
    if (parsed.hostname.includes("yahoo") && parsed.pathname.includes("/chart/")) {
      return response({ chart: { result: [{
        meta: { symbol: "ASX1.AX", exchangeName: "NASDAQ", fullExchangeName: "NASDAQ", currency: "USD" },
        timestamp: Array.from({ length: 60 }, (_, index) => Date.UTC(2026, 5, 1 + index) / 1000),
        indicators: { quote: [{
          open: Array.from({ length: 60 }, (_, index) => 20 + index * 0.02),
          high: Array.from({ length: 60 }, (_, index) => 20.4 + index * 0.02),
          low: Array.from({ length: 60 }, (_, index) => 19.8 + index * 0.02),
          close: Array.from({ length: 60 }, (_, index) => 20.1 + index * 0.02),
          volume: Array.from({ length: 60 }, () => 2_500_000),
        }] },
      }], error: null } });
    }
    throw new Error(`Unexpected URL ${url}`);
  };
  discovery = await buildMarketDiscovery({ markets: ["ASX"], minimumDailyVolume: 1_000_000 });
  assert.equal(discovery.coverage.ASX.eligibleForScreening, 1);
  assert.equal(discovery.broadScreen.eligible, 0);
  assert.match(discovery.broadScreen.unavailable[0].reason, /expected ASX AUD/i);
  restoreEnv("TWELVEDATA_API_KEY", previousKey);
});

function alpacaBars(symbol, volume = 2_000_000, start = 20) {
  const first = Date.now() - 59 * 86400000;
  return Array.from({ length: 60 }, (_, index) => {
    const close = start + index * 0.08;
    return {
      t: new Date(first + index * 86400000).toISOString(),
      o: Number((close - 0.2).toFixed(2)),
      h: Number((close + 0.35).toFixed(2)),
      l: Number((close - 0.3).toFixed(2)),
      c: Number(close.toFixed(2)),
      v: volume + index * 1000,
    };
  });
}

test("market discovery combines Finnhub US symbols with Alpaca batched OHLCV pre-screen", async () => {
  process.env.FINNHUB_API_KEY = "unit-finnhub-key";
  process.env.ALPACA_API_KEY = "unit-alpaca-key";
  process.env.ALPACA_API_SECRET = "unit-alpaca-secret";
  let alpacaCalls = 0;
  global.fetch = async (url) => {
    const parsed = new URL(String(url));
    if (parsed.hostname.includes("finnhub") && parsed.pathname.endsWith("/stock/symbol")) {
      return response([
        { symbol: "AAA", description: "AAA Corp", type: "Common Stock", currency: "USD" },
        { symbol: "BBB", description: "BBB Corp", type: "Common Stock", currency: "USD" },
        { symbol: "ETF", description: "ETF Trust", type: "ETP", currency: "USD" },
        { symbol: "PINK", description: "Pink Sheet", type: "Common Stock", currency: "USD" },
      ]);
    }
    if (parsed.hostname.includes("twelvedata") && parsed.pathname.endsWith("/stocks")) {
      return response({ data: [{ ...stock("ASX1", "ASX One", "ASX", "Australia", "AUD") }] });
    }
    if (parsed.hostname.includes("alpaca") && parsed.pathname.endsWith("/assets")) {
      return response([
        { id: "asset-aaa", class: "us_equity", exchange: "NASDAQ", symbol: "AAA", name: "AAA Corp Common Stock", status: "active", tradable: true },
        { id: "asset-bbb", class: "us_equity", exchange: "NYSE", symbol: "BBB", name: "BBB Corp Common Stock", status: "active", tradable: true },
        { id: "asset-pink", class: "us_equity", exchange: "OTC", symbol: "PINK", name: "Pink Sheet Common Stock", status: "active", tradable: true },
      ]);
    }
    if (parsed.hostname.includes("alpaca") && parsed.pathname.endsWith("/stocks/bars")) {
      alpacaCalls += 1;
      assert.equal(parsed.searchParams.get("symbols"), "AAA,BBB,PINK");
      return response({ bars: {
        AAA: alpacaBars("AAA", 2_500_000, 20),
        BBB: alpacaBars("BBB", 3_500_000, 30),
        PINK: alpacaBars("PINK", 1000, 1),
      } });
    }
    if (parsed.hostname.includes("yahoo") && parsed.pathname.includes("/chart/")) {
      const bars = alpacaBars("ASX1", 2_500_000, 4);
      return response({ chart: { result: [{
        meta: { symbol: "ASX1.AX", exchangeName: "ASX", fullExchangeName: "ASX", currency: "AUD", instrumentType: "EQUITY" },
        timestamp: bars.map((bar) => Date.parse(bar.t) / 1000),
        indicators: { quote: [{
          open: bars.map((bar) => bar.o),
          high: bars.map((bar) => bar.h),
          low: bars.map((bar) => bar.l),
          close: bars.map((bar) => bar.c),
          volume: bars.map((bar) => bar.v),
        }] },
      }], error: null } });
    }
    throw new Error(`Unexpected URL ${url}`);
  };

  const { buildMarketDiscovery } = await importUniverse("alpaca");
  const discovery = await buildMarketDiscovery({ markets: ["US", "ASX"], minimumDailyVolume: 1_000_000, broadScreenLimit: 4 });

  assert.equal(discovery.coverage.US.totalSupported, 3);
  assert.equal(discovery.coverage.US.eligibleForScreening, 3);
  assert.equal(discovery.coverage.ASX.unavailableReason, null);
  assert.equal(discovery.broadScreen.provider, "Alpaca + Yahoo Finance");
  assert.equal(discovery.broadScreen.requested, 4);
  assert.equal(discovery.broadScreen.symbolsRequested, 4);
  assert.equal(discovery.broadScreen.barsReturned, 240);
  assert.equal(discovery.broadScreen.eligible, 3);
  assert.equal(discovery.detailedCandidates.length, 2);
  assert.equal(alpacaCalls, 1);
  delete process.env.FINNHUB_API_KEY;
  delete process.env.ALPACA_API_KEY;
  delete process.env.ALPACA_API_SECRET;
});

test("identity gate rejects ambiguous Alpaca assets before analysis", async () => {
  const { identityGate } = await importUniverse("identity");
  const rows = [
    { symbol: "SNDK", companyName: "Sandisk Corporation", exchange: "US", market: "US", currency: "USD", active: true, tradable: true },
    { symbol: "BAD", companyName: "Wrong Corp", exchange: "US", market: "US", currency: "USD", active: true, tradable: true },
    { symbol: "INACTIVE", companyName: "Inactive Corp", exchange: "US", market: "US", currency: "USD", active: true, tradable: true },
  ];
  const assets = new Map([
    ["SNDK", { id: "sndk-asset", providerSymbol: "SNDK", symbol: "SNDK", name: "Sandisk Corporation Common Stock", assetClass: "us_equity", exchange: "NASDAQ", active: true, tradable: true }],
    ["BAD", { id: "bad-asset", providerSymbol: "BAD", symbol: "BAD", name: "Different Company Common Stock", assetClass: "us_equity", exchange: "NASDAQ", active: true, tradable: true }],
    ["INACTIVE", { id: "inactive-asset", providerSymbol: "INACTIVE", symbol: "INACTIVE", name: "Inactive Corp Common Stock", assetClass: "us_equity", exchange: "NASDAQ", active: false, tradable: false }],
  ]);

  const result = identityGate(rows, assets);

  assert.equal(result.rows.find((row) => row.symbol === "SNDK").identityValid, true);
  assert.equal(result.rows.find((row) => row.symbol === "SNDK").alpacaAssetId, "sndk-asset");
  assert.equal(result.rows.find((row) => row.symbol === "BAD").identityValid, false);
  assert.match(result.rows.find((row) => row.symbol === "BAD").identityInvalidReason, /company name mismatch/);
  assert.equal(result.rows.find((row) => row.symbol === "INACTIVE").identityValid, false);
  assert.equal(result.invalid.length, 2);
});

test("daily Alpaca pre-screen cache is reused on a second same-day discovery", async () => {
  process.env.FINNHUB_API_KEY = "unit-finnhub-key";
  process.env.ALPACA_API_KEY = "unit-alpaca-key";
  process.env.ALPACA_API_SECRET = "unit-alpaca-secret";
  let alpacaBarsCalls = 0;
  global.fetch = async (url) => {
    const parsed = new URL(String(url));
    if (parsed.hostname.includes("finnhub") && parsed.pathname.endsWith("/stock/symbol")) {
      return response([
        { symbol: "AAA", description: "AAA Corp", type: "Common Stock", currency: "USD" },
        { symbol: "BBB", description: "BBB Corp", type: "Common Stock", currency: "USD" },
      ]);
    }
    if (parsed.hostname.includes("twelvedata") && parsed.pathname.endsWith("/stocks")) return response({ data: [] });
    if (parsed.hostname.includes("alpaca") && parsed.pathname.endsWith("/assets")) {
      return response([
        { id: "asset-aaa", class: "us_equity", exchange: "NASDAQ", symbol: "AAA", name: "AAA Corp Common Stock", status: "active", tradable: true },
        { id: "asset-bbb", class: "us_equity", exchange: "NASDAQ", symbol: "BBB", name: "BBB Corp Common Stock", status: "active", tradable: true },
      ]);
    }
    if (parsed.hostname.includes("alpaca") && parsed.pathname.endsWith("/stocks/bars")) {
      alpacaBarsCalls += 1;
      return response({ bars: { AAA: alpacaBars("AAA", 2_500_000, 20), BBB: alpacaBars("BBB", 3_000_000, 30) } });
    }
    throw new Error(`Unexpected URL ${url}`);
  };

  const { buildMarketDiscovery } = await importUniverse("cache");
  const first = await buildMarketDiscovery({ markets: ["US"], minimumDailyVolume: 1_000_000, broadScreenLimit: 2 });
  const second = await buildMarketDiscovery({ markets: ["US"], minimumDailyVolume: 1_000_000, broadScreenLimit: 2 });

  assert.equal(alpacaBarsCalls, 1);
  assert.equal(first.broadScreen.cacheHits, 0);
  assert.equal(second.broadScreen.cacheHits, 2);
  assert.equal(second.broadScreen.freshFetches, 0);
  delete process.env.FINNHUB_API_KEY;
  delete process.env.ALPACA_API_KEY;
  delete process.env.ALPACA_API_SECRET;
});
