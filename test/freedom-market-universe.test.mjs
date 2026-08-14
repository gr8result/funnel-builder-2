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

function stock(symbol, name, exchange = "NASDAQ", country = "United States", currency = "USD") {
  return { symbol, name, exchange, country, currency, type: "Common Stock", mic_code: exchange === "ASX" ? "XASX" : "XNMS" };
}

async function importUniverse(tag) {
  delete globalThis.__freedomMarketUniverseReferenceCache;
  return import(`../lib/freedom-trader/marketUniverse.js?test=${tag}`);
}

test("market discovery uses provider reference universe and separates ASX entitlement", async () => {
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
        exchange: "NASDAQ",
        currency: "USD",
        datetime: "2026-08-07",
      }])));
    }
    throw new Error(`Unexpected URL ${url}`);
  };

  const { buildMarketDiscovery } = await importUniverse("basic");
  const discovery = await buildMarketDiscovery({ markets: ["US", "ASX"], minimumDailyVolume: 1_000_000 });

  assert.equal(discovery.coverage.US.totalSupported, 4);
  assert.equal(discovery.coverage.US.eligibleForScreening, 4);
  assert.equal(discovery.coverage.ASX.totalSupported, 1);
  assert.equal(discovery.coverage.ASX.eligibleForScreening, 0);
  assert.equal(discovery.coverage.ASX.unavailableReason, "ASX DATA PROVIDER REQUIRED");
  assert.equal(discovery.broadScreen.requested, 4);
  assert.equal(discovery.broadScreen.eligible, 4);
  assert.equal(discovery.detailedCandidates.length, 2);
});

function alpacaBars(symbol, volume = 2_000_000, start = 20) {
  const first = Date.UTC(2026, 5, 16, 4);
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
    if (parsed.hostname.includes("alpaca") && parsed.pathname.endsWith("/stocks/bars")) {
      alpacaCalls += 1;
      assert.equal(parsed.searchParams.get("symbols"), "AAA,BBB,PINK");
      return response({ bars: {
        AAA: alpacaBars("AAA", 2_500_000, 20),
        BBB: alpacaBars("BBB", 3_500_000, 30),
        PINK: alpacaBars("PINK", 1000, 1),
      } });
    }
    throw new Error(`Unexpected URL ${url}`);
  };

  const { buildMarketDiscovery } = await importUniverse("alpaca");
  const discovery = await buildMarketDiscovery({ markets: ["US", "ASX"], minimumDailyVolume: 1_000_000, broadScreenLimit: 4 });

  assert.equal(discovery.coverage.US.totalSupported, 3);
  assert.equal(discovery.coverage.US.eligibleForScreening, 3);
  assert.equal(discovery.coverage.ASX.unavailableReason, "ASX DATA PROVIDER REQUIRED");
  assert.equal(discovery.broadScreen.provider, "Alpaca");
  assert.equal(discovery.broadScreen.requested, 3);
  assert.equal(discovery.broadScreen.symbolsRequested, 3);
  assert.equal(discovery.broadScreen.barsReturned, 180);
  assert.equal(discovery.broadScreen.eligible, 2);
  assert.equal(discovery.detailedCandidates.length, 2);
  assert.equal(alpacaCalls, 1);
  delete process.env.FINNHUB_API_KEY;
  delete process.env.ALPACA_API_KEY;
  delete process.env.ALPACA_API_SECRET;
});
