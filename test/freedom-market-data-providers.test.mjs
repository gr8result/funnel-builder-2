import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  FinnhubProvider,
  TwelveDataProvider,
  providerSummary,
  selectMarketDataProvider,
} from "../lib/freedom-trader/marketDataProviders.js";
import testFinnhubHandler from "../pages/api/freedom/test-finnhub.js";

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
  const previous = process.env.FINNHUB_API_KEY;
  process.env.FINNHUB_API_KEY = "unit-test-key";
  try {
    assert.equal(selectMarketDataProvider("symbolUniverse").id, "finnhub");
    assert.equal(selectMarketDataProvider("preScreenQuote").id, "finnhub");
    assert.equal(selectMarketDataProvider("detailedHistory").id, "twelve-data");
    assert.equal(selectMarketDataProvider("detailedHistory", { forceProvider: "finnhub" }).id, "finnhub");
  } finally {
    restoreEnv("FINNHUB_API_KEY", previous);
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

test("client-side Freedom Trader files do not reference FINNHUB_API_KEY", async () => {
  const clientFiles = [
    "pages/freedom-trader/index.js",
    "pages/freedom-trader/market-opportunities.js",
    "pages/freedom-trader/company/[symbol].js",
    "components/freedom-trader/AnalyseStockPanel.js",
  ];
  for (const file of clientFiles) {
    const text = await readFile(file, "utf8");
    assert.equal(text.includes("FINNHUB_API_KEY"), false, file);
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
