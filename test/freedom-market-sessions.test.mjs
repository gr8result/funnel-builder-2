import assert from "node:assert/strict";
import test from "node:test";

import { defaultMarketSelection, marketSessionSnapshot, marketsForSelection } from "../lib/freedom/marketSessions.js";

test("ASX trading hours default to Australian Market", () => {
  const sessions = marketSessionSnapshot(new Date("2026-08-27T01:00:00Z"));
  assert.equal(sessions.ASX.status, "OPEN");
  assert.equal(sessions.US.status, "CLOSED");
  assert.equal(defaultMarketSelection(new Date("2026-08-27T01:00:00Z")), "ASX");
  assert.deepEqual(marketsForSelection("BOTH"), ["ASX", "US"]);
});

test("US regular trading hours default to US Markets when ASX is closed", () => {
  const date = new Date("2026-08-27T15:00:00Z");
  const sessions = marketSessionSnapshot(date);
  assert.equal(sessions.ASX.status, "CLOSED");
  assert.equal(sessions.US.status, "OPEN");
  assert.equal(sessions.US.priceSession, "Regular-session price");
  assert.equal(defaultMarketSelection(date), "US");
});
