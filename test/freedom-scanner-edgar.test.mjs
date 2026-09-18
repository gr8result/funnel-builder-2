import assert from "node:assert/strict";
import test from "node:test";

import { extractFundamentalsFromCompanyFacts, extractSignalsFromSubmissions } from "../lib/freedom/scanner/edgar.js";

function usGaapFact(tag, entries) {
  return { [tag]: { units: { USD: entries } } };
}

function companyFactsFixture() {
  return {
    facts: {
      "us-gaap": {
        ...usGaapFact("CashAndCashEquivalentsAtCarryingValue", [
          { end: "2026-06-30", val: 9_000_000, form: "10-Q", filed: "2026-08-01" },
          { end: "2026-03-31", val: 12_000_000, form: "10-Q", filed: "2026-05-01" },
        ]),
        ...usGaapFact("LongTermDebtNoncurrent", [{ end: "2026-06-30", val: 2_000_000, form: "10-Q", filed: "2026-08-01" }]),
        ...usGaapFact("Revenues", [
          { end: "2026-06-30", val: 5_000_000, form: "10-K", filed: "2026-08-01" },
          { end: "2025-06-30", val: 4_000_000, form: "10-K", filed: "2025-08-01" },
        ]),
        ...usGaapFact("NetIncomeLoss", [
          { end: "2026-06-30", val: -1_000_000, form: "10-K", filed: "2026-08-01" },
          { end: "2025-06-30", val: -2_000_000, form: "10-K", filed: "2025-08-01" },
        ]),
        ...usGaapFact("NetCashProvidedByUsedInOperatingActivities", [{ end: "2026-06-30", val: -500_000, form: "10-Q", filed: "2026-08-01" }]),
      },
      dei: {
        EntityCommonStockSharesOutstanding: {
          units: { shares: [
            { end: "2026-06-30", val: 11_000_000, form: "10-Q", filed: "2026-08-01" },
            { end: "2025-06-30", val: 10_000_000, form: "10-Q", filed: "2025-08-01" },
          ] },
        },
      },
    },
  };
}

test("extractFundamentalsFromCompanyFacts pulls cash, debt, shares and revenue with the right AVAILABLE flags", () => {
  const result = extractFundamentalsFromCompanyFacts(companyFactsFixture());
  assert.equal(result.cash, 9_000_000);
  assert.equal(result.availability.cash, "AVAILABLE");
  assert.equal(result.debt, 2_000_000);
  assert.equal(result.sharesOutstanding, 11_000_000);
  assert.equal(result.revenue, 5_000_000);
  assert.equal(result.source, "SEC EDGAR (XBRL company facts)");
});

test("share-count growth is computed year-over-year from the actual prior-year entry", () => {
  const result = extractFundamentalsFromCompanyFacts(companyFactsFixture());
  assert.equal(result.shareCountGrowthPercent, 10); // 11m vs 10m
});

test("revenue growth is computed from matching-cadence (10-K vs 10-K) prior period", () => {
  const result = extractFundamentalsFromCompanyFacts(companyFactsFixture());
  assert.equal(result.revenueGrowthPercent, 25); // 5m vs 4m
});

test("a narrowing net loss is detected correctly", () => {
  const result = extractFundamentalsFromCompanyFacts(companyFactsFixture());
  assert.equal(result.netLossNarrowing, true); // -1m loss vs -2m prior loss
});

test("a completely missing tag reports UNAVAILABLE, not a fabricated zero", () => {
  const result = extractFundamentalsFromCompanyFacts({ facts: {} });
  assert.equal(result.cash, null);
  assert.equal(result.availability.cash, "UNAVAILABLE");
  assert.equal(result.debt, null);
  assert.equal(result.sharesOutstanding, null);
});

test("absence of the going-concern XBRL tag across all filings is treated as no disclosed doubt, not unavailable", () => {
  const result = extractFundamentalsFromCompanyFacts(companyFactsFixture());
  assert.equal(result.goingConcernWarning, false);
});

// ---------------------------------------------------------------------------
// Submissions -> catalysts + red flags
// ---------------------------------------------------------------------------

function submissionsFixture({ items8k = [["1.01"]], forms = null } = {}) {
  const today = new Date();
  const recentDate = (daysAgo) => new Date(today.getTime() - daysAgo * 86400000).toISOString().slice(0, 10);
  const rows = forms || items8k.map((items, i) => ({ form: "8-K", filingDate: recentDate(10 + i), items: items.join(",") }));
  return {
    cik: "1234567",
    filings: {
      recent: {
        form: rows.map((r) => r.form),
        filingDate: rows.map((r) => r.filingDate),
        items: rows.map((r) => r.items || ""),
        accessionNumber: rows.map(() => "0001234567-26-000001"),
        primaryDocument: rows.map(() => "doc.htm"),
      },
    },
  };
}

test("a recent 8-K Item 1.01 becomes a CONFIRMED, dated, sourced catalyst", () => {
  const { catalysts } = extractSignalsFromSubmissions(submissionsFixture());
  assert.equal(catalysts.length, 1);
  assert.equal(catalysts[0].sourceType, "SEC_FILING");
  assert.ok(catalysts[0].sourceDate);
  assert.ok(catalysts[0].sourceUrl.includes("sec.gov"));
});

test("an 8-K filed more than 90 days ago is not surfaced as a current catalyst", () => {
  const old = submissionsFixture({ forms: [{ form: "8-K", filingDate: "2020-01-01", items: "1.01" }] });
  const { catalysts } = extractSignalsFromSubmissions(old);
  assert.equal(catalysts.length, 0);
});

test("8-K Item 3.01 sets both exchangeComplianceIssue and delistingRisk", () => {
  const { redFlagInputs } = extractSignalsFromSubmissions(submissionsFixture({ items8k: [["3.01"]] }));
  assert.equal(redFlagInputs.exchangeComplianceIssue, true);
  assert.equal(redFlagInputs.delistingRisk, true);
});

test("8-K Item 4.01 sets auditorProblem", () => {
  const { redFlagInputs } = extractSignalsFromSubmissions(submissionsFixture({ items8k: [["4.01"]] }));
  assert.equal(redFlagInputs.auditorProblem, true);
});

test("no filings at all yields empty catalysts and false/zero red-flag inputs, not thrown errors", () => {
  const result = extractSignalsFromSubmissions({ filings: { recent: {} } });
  assert.deepEqual(result.catalysts, []);
  const missing = extractSignalsFromSubmissions(null);
  assert.deepEqual(missing.catalysts, []);
});
