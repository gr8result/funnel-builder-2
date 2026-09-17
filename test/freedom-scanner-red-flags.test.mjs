import assert from "node:assert/strict";
import test from "node:test";

import { detectRedFlags, redFlagSummary } from "../lib/freedom/scanner/redFlags.js";

test("an unmeasured flag reports UNAVAILABLE, never CLEAR by default", () => {
  const flags = detectRedFlags({});
  assert.ok(flags.every((f) => f.status === "UNAVAILABLE"));
});

test("short cash runway is DETECTED under 6 months and CLEAR at or above it", () => {
  const short = detectRedFlags({ runwayMonths: 4 }).find((f) => f.id === "short_cash_runway");
  const ok = detectRedFlags({ runwayMonths: 9 }).find((f) => f.id === "short_cash_runway");
  assert.equal(short.status, "DETECTED");
  assert.equal(ok.status, "CLEAR");
});

test("every detected flag carries a non-empty consequence explanation", () => {
  const flags = detectRedFlags({
    runwayMonths: 2, goingConcernWarning: true, capitalRaiseCount12m: 4,
    atmFacilityActive: true, atmFacilityUsd: 20_000_000, marketCap: 40_000_000,
    warrantsOutstandingRatio: 0.4, shareCountGrowthPercent: 80,
    reverseSplitDates: ["2026-01-01"], exchangeComplianceIssue: true, delistingRisk: true,
    averageDollarVolume: 10_000, promotionalActivityFlag: true, materialDebtProblem: true,
    failedClinicalOrRegulatory: true, lossOfMajorCustomer: true, auditorProblem: true,
  });
  const detected = flags.filter((f) => f.status === "DETECTED");
  assert.equal(detected.length, flags.length); // every flag should trip given these inputs
  assert.ok(detected.every((f) => typeof f.consequence === "string" && f.consequence.length > 0));
});

test("a flag firing does not imply anything about other flags - each is independent", () => {
  const flags = detectRedFlags({ runwayMonths: 2 });
  const short = flags.find((f) => f.id === "short_cash_runway");
  const goingConcern = flags.find((f) => f.id === "going_concern");
  assert.equal(short.status, "DETECTED");
  assert.equal(goingConcern.status, "UNAVAILABLE");
});

test("redFlagSummary counts detected and unavailable correctly", () => {
  const flags = detectRedFlags({ runwayMonths: 2, goingConcernWarning: false });
  const summary = redFlagSummary(flags);
  assert.equal(summary.detectedCount, 1);
  assert.deepEqual(summary.detected, ["short_cash_runway"]);
  assert.equal(summary.unavailableCount, flags.length - 2);
});
