import assert from "node:assert/strict";
import test from "node:test";

import { chartMatchesRequest } from "../pages/api/freedom/chart.js";

test("chart route rejects historical data for the wrong listing before drawing it", () => {
  const request = { query: { symbol: "ALK", exchange: "ASX", currency: "AUD" } };
  const rejected = chartMatchesRequest(request, { exchange: "US", currency: "USD" });
  assert.equal(rejected.ok, false);
  assert.match(rejected.reason, /currency|exchange/i);

  const accepted = chartMatchesRequest(request, { exchange: "XASX", currency: "AUD" });
  assert.equal(accepted.ok, true);
});
