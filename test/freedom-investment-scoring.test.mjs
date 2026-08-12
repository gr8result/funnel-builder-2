import assert from "node:assert/strict";
import test from "node:test";
import {
  analyseInvestmentCandidate,
  assessFinancialStrength,
  assessGrowth,
  assessValuation,
  portfolioSummary,
  prepareInvestment,
  rankInvestmentOpportunities,
} from "../lib/freedom-investment/scoring.js";

function candidate(symbol, overrides = {}) {
  const metrics = {
    grossMarginTTM: 68,
    operatingMarginTTM: 34,
    netProfitMarginTTM: 27,
    roeTTM: 32,
    "totalDebt/totalEquityQuarterly": 20,
    currentRatioQuarterly: 1.9,
    interestCoverageTTM: 22,
    freeCashFlowPerShareTTM: 8,
    revenueGrowthTTMYoy: 14,
    epsGrowthTTMYoy: 16,
    peTTM: 22,
    forwardPE: 20,
    psTTM: 6,
    evToEbitdaTTM: 15,
    epsTTM: 6,
    dividendYieldIndicatedAnnual: 0.8,
    payoutRatioTTM: 22,
    ...(overrides.metrics || {}),
  };
  return analyseInvestmentCandidate({
    symbol,
    companyName: `${symbol} Corp`,
    sector: "Software",
    currency: "USD",
    quote: { currentPrice: overrides.currentPrice ?? 96 },
    metrics,
    profile: { name: `${symbol} Corp`, marketCapitalization: overrides.marketCapitalization ?? 250000 },
  });
}

test("excellent company at attractive valuation is ATTRACTIVE", () => {
  const row = candidate("GOOD", { currentPrice: 88 });
  assert.equal(row.status, "ATTRACTIVE");
  assert.ok(row.investmentScore >= 82);
  assert.equal(row.financialStrength.classification, "EXCELLENT");
});

test("excellent company at extreme valuation is not forced into ATTRACTIVE", () => {
  const row = candidate("RICH", { currentPrice: 320, metrics: { peTTM: 78, forwardPE: 64, psTTM: 22, evToEbitdaTTM: 48 } });
  assert.ok(["WATCH", "EXPENSIVE"].includes(row.status));
  assert.ok(["EXPENSIVE", "VERY EXPENSIVE"].includes(row.valuation.classification));
});

test("weak company is rejected even when superficially cheap", () => {
  const row = candidate("CHEAP", {
    currentPrice: 12,
    metrics: {
      grossMarginTTM: 14,
      operatingMarginTTM: -4,
      netProfitMarginTTM: -8,
      roeTTM: -12,
      "totalDebt/totalEquityQuarterly": 240,
      freeCashFlowPerShareTTM: -1,
      revenueGrowthTTMYoy: -18,
      epsGrowthTTMYoy: -30,
      peTTM: 6,
      psTTM: 0.7,
    },
  });
  assert.equal(row.status, "AVOID");
  assert.ok(row.businessQuality.score < 45 || row.financialStrength.classification === "HIGH RISK");
});

test("excessive debt deteriorates financial strength and risk", () => {
  const strength = assessFinancialStrength({
    grossMarginTTM: 55,
    operatingMarginTTM: 22,
    netProfitMarginTTM: 16,
    roeTTM: 14,
    "totalDebt/totalEquityQuarterly": 260,
    freeCashFlowPerShareTTM: 4,
  });
  assert.ok(["WEAK", "HIGH RISK", "ACCEPTABLE"].includes(strength.classification));
  assert.match(strength.explanation, /debt/i);
});

test("missing fundamental data becomes DATA INSUFFICIENT", () => {
  const row = analyseInvestmentCandidate({ symbol: "MISS", quote: { currentPrice: 10 }, metrics: {}, profile: {} });
  assert.equal(row.status, "DATA INSUFFICIENT");
  assert.equal(row.investmentScore, null);
});

test("growth and valuation classifications are deterministic", () => {
  assert.equal(assessGrowth({ revenueGrowthTTMYoy: 18, epsGrowthTTMYoy: 22 }).classification, "STRONG GROWTH");
  assert.equal(assessGrowth({ revenueGrowthTTMYoy: -5, epsGrowthTTMYoy: -12 }).classification, "DECLINING");
  assert.equal(assessValuation({ metrics: { peTTM: 16, forwardPE: 15, psTTM: 3, epsTTM: 5 }, quote: { currentPrice: 55 }, growth: { inputs: { epsGrowth: 8 } } }).classification, "ATTRACTIVE");
});

test("ranking favours attractive long-term candidates", () => {
  const rows = [
    candidate("EXP", { currentPrice: 260, metrics: { peTTM: 70, forwardPE: 58, psTTM: 20 } }),
    candidate("ATT", { currentPrice: 88 }),
    analyseInvestmentCandidate({ symbol: "BAD", quote: { currentPrice: 10 }, metrics: {}, profile: {} }),
  ];
  const ranked = rankInvestmentOpportunities(rows);
  assert.equal(ranked[0].symbol, "ATT");
  assert.equal(ranked[0].status, "ATTRACTIVE");
});

test("staged investment calculation limits initial allocation", () => {
  const row = candidate("STAGE", { currentPrice: 100 });
  const plan = prepareInvestment(row, { portfolioValue: 100000, maximumPositionPercent: 8, initialStagePercent: 25 });
  assert.equal(plan.suggestedMaximumAllocation, 8000);
  assert.equal(plan.suggestedInitialInvestmentAmount, 2000);
  assert.equal(plan.approximateShares, 20);
});

test("portfolio allocation reports concentration", () => {
  const latest = [candidate("STAGE", { currentPrice: 100 }), candidate("SMALL", { currentPrice: 20 })];
  const summary = portfolioSummary([
    { symbol: "STAGE", companyName: "Stage Corp", shares: 100, averageCost: 80, sector: "Software" },
    { symbol: "SMALL", companyName: "Small Corp", shares: 10, averageCost: 18, sector: "Software" },
  ], latest);
  assert.ok(summary.holdings.find((row) => row.symbol === "STAGE").portfolioWeight > 15);
  assert.ok(summary.concentrationWarnings.length >= 1);
});
