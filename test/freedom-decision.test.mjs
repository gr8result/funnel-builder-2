import assert from "node:assert/strict";
import test from "node:test";

import {
  actionForStatus,
  buildOpportunitiesPayload,
  entryRangeFor,
  planIsComplete,
  toOpportunity,
  triggerStatusFor,
} from "../lib/freedom/decision.js";

function validRow(overrides = {}) {
  return {
    symbol: "AAPL",
    companyName: "Apple Inc",
    exchange: "NASDAQ",
    currency: "USD",
    status: "READY",
    currentPrice: 100,
    recommendedEntry: 100,
    safetyExit: 90,
    takeSomeProfit: 120,
    finalExit: 130,
    riskReward: 3,
    reason: "Pullback reversal confirmed.",
    tradingScore: 88,
    marketData: { latestCandleDate: "2026-08-21" },
    market: "US",
    marketStatus: "CLOSED",
    priceSession: "Last regular-session price",
    quoteMode: "previous close",
    dataSource: "Alpaca",
    ...overrides,
  };
}

test("every internal status maps to a known action", () => {
  assert.equal(actionForStatus("READY"), "BUY");
  assert.equal(actionForStatus("WAIT FOR PULLBACK"), "WAIT");
  assert.equal(actionForStatus("REVERSAL DEVELOPING"), "WATCH");
  assert.equal(actionForStatus("WAIT FOR REVERSAL"), "WATCH");
  assert.equal(actionForStatus("OVEREXTENDED"), "AVOID");
  assert.equal(actionForStatus("SKIP"), "AVOID");
  assert.equal(actionForStatus("DATA UNAVAILABLE"), "UNAVAILABLE");
});

test("an unrecognised status never becomes a tradable action", () => {
  assert.equal(actionForStatus("SOMETHING NEW"), "UNAVAILABLE");
  assert.equal(actionForStatus(null), "UNAVAILABLE");
  assert.equal(actionForStatus(""), "UNAVAILABLE");
});

test("plan validity requires a coherent long price ladder", () => {
  assert.equal(planIsComplete(validRow()), true);
  assert.equal(planIsComplete(validRow({ safetyExit: 110 })), false, "safety exit above entry");
  assert.equal(planIsComplete(validRow({ takeSomeProfit: 95 })), false, "target below entry");
  assert.equal(planIsComplete(validRow({ finalExit: 110 })), false, "final exit below take-some");
  assert.equal(planIsComplete(validRow({ recommendedEntry: 0 })), false, "zero entry");
  assert.equal(planIsComplete(validRow({ safetyExit: null })), false, "missing safety exit");
});

test("a READY row with an incomplete plan is downgraded to AVOID, never shown as BUY", () => {
  const opportunity = toOpportunity(validRow({ safetyExit: 110 }));
  assert.equal(opportunity.action, "AVOID");
  assert.equal(opportunity.detail.planComplete, false);
});

test("buy trigger band brackets the preferred entry", () => {
  const range = entryRangeFor(validRow());
  assert.equal(range.preferred, 100);
  assert.ok(range.low < 100, "low bound below preferred");
  assert.ok(range.high > 100, "high bound above preferred");
  assert.equal(entryRangeFor({ recommendedEntry: null }), null);
});

test("opportunity exposes every field the page must display", () => {
  const opportunity = toOpportunity(validRow());
  assert.equal(opportunity.action, "BUY");
  assert.equal(opportunity.colour, "green");
  assert.equal(opportunity.currentPrice, 100);
  assert.equal(opportunity.market, "US");
  assert.equal(opportunity.marketStatus, "CLOSED");
  assert.equal(opportunity.priceSession, "Last regular-session price");
  assert.equal(opportunity.quoteMode, "previous close");
  assert.equal(opportunity.dataSource, "Alpaca");
  assert.equal(opportunity.safetyExit, 90);
  assert.deepEqual(opportunity.targets, [120, 130]);
  assert.equal(opportunity.riskRewardLabel, "3:1");
  assert.equal(opportunity.dataTimestamp, "2026-08-21");
  assert.ok(opportunity.timeframe);
  assert.ok(opportunity.reason);
});

test("CMC imported ratings stay separate from Freedom trading action", () => {
  const opportunity = toOpportunity(validRow({
    market: "ASX",
    exchange: "ASX",
    currency: "AUD",
    importedRating: "Morningstar undervalued",
    cmcComparison: {
      cmcPrice: 1.925,
      cmcTimestamp: "2026-08-28T01:59:00.000Z",
      freedomPrice: 1.94,
      freedomTimestamp: "2026-08-28",
      discrepancyPercent: 0.78,
      material: false,
    },
  }));
  assert.equal(opportunity.action, "BUY");
  assert.equal(opportunity.importedRating, "Morningstar undervalued");
  assert.equal(opportunity.cmcComparison.material, false);
});

test("watch setup below the buy trigger explains the wait with dollar and percent distance", () => {
  const opportunity = toOpportunity(validRow({
    symbol: "PLUG",
    status: "REVERSAL DEVELOPING",
    currentPrice: 2.27,
    recommendedEntry: 2.54,
    safetyExit: 2.1,
    takeSomeProfit: 4.33,
    finalExit: 4.33,
  }));
  assert.equal(opportunity.action, "WATCH");
  assert.equal(opportunity.entryRange.low, 2.48);
  assert.equal(opportunity.entryRange.high, 2.56);
  assert.equal(opportunity.triggerStatus.state, "WAITING");
  assert.equal(opportunity.triggerStatus.distance.dollars, 0.21);
  assert.equal(opportunity.triggerStatus.distance.percent, 9.25);
  assert.equal(opportunity.triggerStatus.howToRead, "Wait for the price to rise to the buy trigger.");
  assert.equal(opportunity.triggerStatus.tradeButton, "Add to Watchlist");
  assert.equal(opportunity.triggerStatus.canConfirmPurchase, false);
  assert.deepEqual(opportunity.targets, [4.33]);
});

test("price above the buy trigger uses strategy status to classify missed versus triggered", () => {
  const missed = toOpportunity(validRow({
    symbol: "JBLU",
    status: "OVEREXTENDED",
    currentPrice: 5.08,
    recommendedEntry: 4.91,
    safetyExit: 4.35,
    takeSomeProfit: 6.1,
    finalExit: 6.8,
  }));
  assert.equal(missed.entryRange.low, 4.79);
  assert.equal(missed.entryRange.high, 4.95);
  assert.equal(missed.triggerStatus.state, "MISSED");
  assert.equal(missed.triggerStatus.howToRead, "Entry missedâ€”do not chase");
  assert.equal(missed.triggerStatus.canConfirmPurchase, false);

  const triggered = triggerStatusFor(
    { status: "READY", currentPrice: 5.08 },
    "BUY",
    { low: 4.79, high: 4.95, preferred: 4.87 },
    5.08,
  );
  assert.equal(triggered.state, "TRIGGERED");
  assert.equal(triggered.canConfirmPurchase, true);
});

test("validated chart history is required before purchase confirmation is enabled", () => {
  const opportunity = toOpportunity(validRow({
    symbol: "NOCHART",
    status: "READY",
    currentPrice: 100,
    recommendedEntry: 100,
    dataStatus: { readyForScore: false, actualCandleCount: 0 },
  }));
  assert.equal(opportunity.chartValidated, false);
  assert.equal(opportunity.action, "UNAVAILABLE");
  assert.equal(opportunity.triggerStatus.canConfirmPurchase, false);
  assert.equal(opportunity.triggerStatus.tradeButton, "Add to Watchlist");
});

test("a failed scan is reported as market-data-failure, not as no trades found", () => {
  const payload = buildOpportunitiesPayload({
    ok: true,
    decisions: [],
    scanSummary: { status: "failed", message: "Could not obtain enough market data." },
  });
  assert.equal(payload.ok, false);
  assert.equal(payload.outcome, "market-data-failure");
  assert.equal(payload.opportunities.length, 0);
});

test("a provider-blocked scan is scan-incomplete, not no qualifying trades", () => {
  const payload = buildOpportunitiesPayload({
    ok: true,
    decisions: [],
    scanSummary: {
      status: "blocked",
      message: "SCAN INCOMPLETE—NO MARKET CONCLUSION AVAILABLE. Provider limit reached.",
      providerBudgetExhausted: true,
      companiesChecked: 8,
      successfullyAnalysed: 0,
      expectedUniverseSize: 200,
    },
  });
  assert.equal(payload.ok, false);
  assert.equal(payload.outcome, "scan-incomplete");
  assert.match(payload.headline, /SCAN INCOMPLETE/);
  assert.equal(payload.scan.rateLimited, 1);
  assert.equal(payload.scan.companiesChecked, 8);
  assert.equal(payload.scan.successfullyAnalysed, 0);
});

test("a partial scan with no displayable opportunity is not a whole-market no-trades conclusion", () => {
  const payload = buildOpportunitiesPayload({
    ok: true,
    decisions: [validRow({ status: "DATA UNAVAILABLE", currentPrice: null })],
    scanSummary: {
      status: "partial",
      message: "Partial scan only.",
      companiesChecked: 8,
      successfullyAnalysed: 1,
      expectedUniverseSize: 300,
    },
  });
  assert.equal(payload.ok, false);
  assert.equal(payload.outcome, "scan-incomplete");
  assert.equal(payload.opportunities.length, 0);
});

test("a clean scan with nothing qualifying is reported as no-qualifying-trades", () => {
  const payload = buildOpportunitiesPayload({
    ok: true,
    decisions: [validRow({ status: "SKIP" }), validRow({ symbol: "MSFT", status: "OVEREXTENDED" })],
    scanSummary: { status: "complete", message: "Checked 500 companies." },
  });
  assert.equal(payload.ok, true);
  assert.equal(payload.outcome, "opportunities");
  assert.equal(payload.sections.closestOpportunities.length, 2);
  assert.equal(payload.counts.avoid, 2);
});

test("results are ranked BUY before WAIT before WATCH", () => {
  const payload = buildOpportunitiesPayload({
    ok: true,
    decisions: [
      validRow({ symbol: "WATCHME", status: "REVERSAL DEVELOPING" }),
      validRow({ symbol: "WAITME", status: "WAIT FOR PULLBACK" }),
      validRow({ symbol: "BUYME", status: "READY" }),
    ],
    scanSummary: { status: "complete" },
  });
  assert.equal(payload.outcome, "opportunities");
  assert.equal(payload.sections.readyAtMarketOpen[0].symbol, "BUYME");
  assert.equal(payload.sections.closestOpportunities.some((item) => item.symbol === "WAITME"), true);
  assert.equal(payload.sections.closestOpportunities.some((item) => item.symbol === "WATCHME"), true);
});

test("AVOID rows are kept out of buy/wait sections and UNAVAILABLE rows stay diagnostic only", () => {
  const payload = buildOpportunitiesPayload({
    ok: true,
    decisions: [
      validRow({ symbol: "GOOD", status: "READY" }),
      validRow({ symbol: "BAD", status: "SKIP" }),
      validRow({ symbol: "NODATA", status: "DATA UNAVAILABLE" }),
    ],
    scanSummary: { status: "partial" },
  });
  assert.deepEqual(payload.sections.readyAtMarketOpen.map((item) => item.symbol), ["GOOD"]);
  assert.equal(payload.sections.closestOpportunities.some((item) => item.symbol === "BAD"), true);
  assert.equal(payload.opportunities.some((item) => item.symbol === "NODATA"), false);
  assert.equal(payload.counts.buy, 1);
  assert.equal(payload.counts.avoid, 1);
  assert.equal(payload.counts.unavailable, 1);
});

test("the scanner is never asked to invent results when it returned none", () => {
  const payload = buildOpportunitiesPayload({ ok: true, decisions: [], scanSummary: { status: "complete" } });
  assert.equal(payload.opportunities.length, 0);
  assert.equal(payload.outcome, "no-qualifying-trades");
});
