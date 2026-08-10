import assert from "node:assert/strict";
import test from "node:test";

process.env.TWELVEDATA_API_KEY = "unit-test-key";
process.env.FREEDOM_BROAD_SCREEN_LIMIT = "4";
process.env.FREEDOM_DETAILED_ANALYSIS_LIMIT = "2";

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
  assert.match(discovery.coverage.ASX.unavailableReason, /Basic|Pro|Venture/i);
  assert.equal(discovery.broadScreen.requested, 4);
  assert.equal(discovery.broadScreen.eligible, 4);
  assert.equal(discovery.detailedCandidates.length, 2);
});
