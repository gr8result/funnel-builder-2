import assert from "node:assert/strict";
import test from "node:test";

import { buildCatalystEntry, buildCatalysts, classifyCatalyst, primaryCatalyst } from "../lib/freedom/scanner/catalysts.js";

test("an SEC filing with a source date is CONFIRMED", () => {
  assert.equal(classifyCatalyst({ sourceType: "SEC_FILING", sourceDate: "2026-09-01" }), "CONFIRMED");
});

test("an ASX announcement with a source date is CONFIRMED", () => {
  assert.equal(classifyCatalyst({ sourceType: "ASX_ANNOUNCEMENT", sourceDate: "2026-09-01" }), "CONFIRMED");
});

test("a primary source with NO retrievable date stays SPECULATIVE - never fabricate confirmation", () => {
  assert.equal(classifyCatalyst({ sourceType: "SEC_FILING" }), "SPECULATIVE");
});

test("an estimate/rumour is always SPECULATIVE even with a date", () => {
  assert.equal(classifyCatalyst({ sourceType: "ESTIMATE", sourceDate: "2026-09-01" }), "SPECULATIVE");
});

test("an explicit officiallyConfirmed:false overrides everything else to SPECULATIVE", () => {
  assert.equal(classifyCatalyst({ sourceType: "SEC_FILING", sourceDate: "2026-09-01", officiallyConfirmed: false }), "SPECULATIVE");
});

test("buildCatalystEntry preserves source, timing and explanatory fields", () => {
  const entry = buildCatalystEntry({
    description: "Phase 2 readout",
    sourceType: "SEC_FILING",
    sourceUrl: "https://www.sec.gov/example",
    sourceDate: "2026-08-01",
    timing: { type: "WINDOW", windowStart: "2026-10-01", windowEnd: "2026-11-01", label: "Q4 2026" },
    whyItMatters: "Primary value driver.",
    potentialPositiveEffect: "Validates the platform.",
    failureConsequence: "Removes the core thesis.",
  });
  assert.equal(entry.classification, "CONFIRMED");
  assert.equal(entry.catalyst, "Phase 2 readout");
  assert.equal(entry.timing.type, "WINDOW");
  assert.equal(entry.source, "SEC_FILING");
  assert.equal(entry.failureConsequence, "Removes the core thesis.");
});

test("primaryCatalyst prefers a CONFIRMED catalyst over a nearer-dated SPECULATIVE one", () => {
  const list = buildCatalysts([
    { description: "Rumoured buyout", sourceType: "ESTIMATE", timing: { type: "DATE", date: "2026-09-20" } },
    { description: "10-Q filing event", sourceType: "SEC_FILING", sourceDate: "2026-09-01", timing: { type: "DATE", date: "2026-11-01" } },
  ]);
  const best = primaryCatalyst(list);
  assert.equal(best.catalyst, "10-Q filing event");
});

test("primaryCatalyst returns null for an empty list", () => {
  assert.equal(primaryCatalyst([]), null);
});
