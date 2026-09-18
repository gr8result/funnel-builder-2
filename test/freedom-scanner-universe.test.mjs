import assert from "node:assert/strict";
import test from "node:test";

import { applyProfileFilter, exchangeAllowed, SCANNER_PROFILES } from "../lib/freedom/scanner/universe.js";

test("OTC is excluded even when nominally tagged as a US exchange row", () => {
  assert.equal(exchangeAllowed({ exchange: "OTC" }), false);
  assert.equal(exchangeAllowed({ exchange: "OTCQB" }), false);
  assert.equal(exchangeAllowed({ exchange: "PINK" }), false);
});

test("NASDAQ, NYSE, AMEX and ASX are allowed", () => {
  for (const exchange of ["NASDAQ", "NYSE", "AMEX", "ASX"]) {
    assert.equal(exchangeAllowed({ exchange }), true);
  }
});

test("an unrecognised or missing exchange is excluded, not passed through", () => {
  assert.equal(exchangeAllowed({}), false);
  assert.equal(exchangeAllowed({ exchange: "" }), false);
  assert.equal(exchangeAllowed({ exchange: "LSE" }), false);
});

// ---------------------------------------------------------------------------
// Profile filtering (market cap / price / liquidity)
// ---------------------------------------------------------------------------

test("the broad profile has no price or market-cap ceiling", () => {
  const result = applyProfileFilter({ profile: "broad", market: "US", price: 500, marketCap: 50_000_000_000, averageDollarVolume: 10_000_000 });
  assert.equal(result.pass, true);
});

test("the penny profile rejects a price above the US ceiling", () => {
  const result = applyProfileFilter({ profile: "penny", market: "US", price: 12, marketCap: 100_000_000, averageDollarVolume: 500_000 });
  assert.equal(result.pass, false);
});

test("the penny profile accepts a candidate inside its default market-cap range", () => {
  const result = applyProfileFilter({ profile: "penny", market: "US", price: 2, marketCap: 100_000_000, averageDollarVolume: 500_000 });
  assert.equal(result.pass, true);
});

test("a market cap slightly outside the hard range but inside the tolerance band still passes, flagged", () => {
  const config = SCANNER_PROFILES.penny;
  const slightlyOver = config.maxMarketCapUsd * 1.1; // within the 25% tolerance band
  const result = applyProfileFilter({ profile: "penny", market: "US", price: 3, marketCap: slightlyOver, averageDollarVolume: 500_000 });
  assert.equal(result.pass, true);
  assert.ok(result.reasons.some((r) => r.includes("tolerance band")));
});

test("a market cap far outside even the tolerance band is rejected", () => {
  const result = applyProfileFilter({ profile: "penny", market: "US", price: 3, marketCap: 5_000_000_000, averageDollarVolume: 500_000 });
  assert.equal(result.pass, false);
});

test("illiquid candidates are rejected regardless of profile", () => {
  const penny = applyProfileFilter({ profile: "penny", market: "US", price: 1, marketCap: 50_000_000, averageDollarVolume: 1_000 });
  const broad = applyProfileFilter({ profile: "broad", market: "US", price: 100, marketCap: 5_000_000_000, averageDollarVolume: 1_000 });
  assert.equal(penny.pass, false);
  assert.equal(broad.pass, false);
});

test("ASX candidates are checked against the AUD-denominated thresholds, not the USD ones", () => {
  const result = applyProfileFilter({ profile: "penny", market: "ASX", price: 4, marketCap: 100_000_000, averageDollarVolume: 200_000 });
  assert.equal(result.pass, true);
});
