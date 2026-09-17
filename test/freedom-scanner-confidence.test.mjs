import assert from "node:assert/strict";
import test from "node:test";

import { assessDataConfidence, CRITICAL_FIELDS } from "../lib/freedom/scanner/confidence.js";

function fullAvailability(overrides = {}) {
  const base = {};
  for (const field of CRITICAL_FIELDS) base[field] = "AVAILABLE";
  base.debt = "AVAILABLE";
  base.revenue = "AVAILABLE";
  base.revenueGrowthPercent = "AVAILABLE";
  base.operatingCashFlow = "AVAILABLE";
  base.insiderOwnershipPercent = "AVAILABLE";
  base.institutionalOwnershipPercent = "AVAILABLE";
  return { ...base, ...overrides };
}

test("full coverage of critical and supporting fields yields HIGH confidence", () => {
  const result = assessDataConfidence(fullAvailability());
  assert.equal(result.level, "HIGH");
  assert.equal(result.missingCritical.length, 0);
});

test("a single missing critical field forces LOW confidence, never HIGH or MEDIUM", () => {
  const result = assessDataConfidence(fullAvailability({ cash: "UNAVAILABLE" }));
  assert.equal(result.level, "LOW");
  assert.deepEqual(result.missingCritical, ["cash"]);
});

test("a stale critical field alone does not collapse to LOW, but two do", () => {
  const oneStale = assessDataConfidence(fullAvailability({ cash: "STALE" }));
  assert.notEqual(oneStale.level, "HIGH");
  assert.notEqual(oneStale.level, "LOW");

  const twoStale = assessDataConfidence(fullAvailability({ cash: "STALE", sharesOutstanding: "STALE" }));
  assert.equal(twoStale.level, "LOW");
});

test("missing supporting fields alone (all critical present) never reaches LOW", () => {
  const result = assessDataConfidence(fullAvailability({
    debt: "UNAVAILABLE", revenue: "UNAVAILABLE", revenueGrowthPercent: "UNAVAILABLE",
    operatingCashFlow: "UNAVAILABLE", insiderOwnershipPercent: "UNAVAILABLE", institutionalOwnershipPercent: "UNAVAILABLE",
  }));
  assert.notEqual(result.level, "LOW");
});

test("a candidate cannot show HIGH confidence when any critical field is missing (spec section 16 invariant)", () => {
  for (const field of CRITICAL_FIELDS) {
    const result = assessDataConfidence(fullAvailability({ [field]: "UNAVAILABLE" }));
    assert.notEqual(result.level, "HIGH", `missing ${field} must not still be HIGH confidence`);
  }
});
