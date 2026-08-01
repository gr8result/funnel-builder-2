import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_REPORT_SETTINGS, calculatePartialExit, classifyMarketData, generateFreedomTraderReport } from "../lib/freedom-trader/actionReport.js";
import { buildFailedFreedomScanSummary, scanActionText } from "../lib/freedom-trader/scanSummary.js";

const NOW = new Date("2026-07-29T22:00:00.000Z");

const BASE_SETTINGS = {
  ...DEFAULT_REPORT_SETTINGS,
  accountCurrency: "USD",
  tradingBalance: 5000,
  availableCash: 5000,
  maximumPlannedLossPerTrade: 75,
  maximumOpenPositions: 3,
  maximumTotalMoneyCommitted: 2500,
  maximumTotalPlannedLoss: 150,
  maximumPositionValue: 1250,
  currencyConversionRates: { USD: 1, AUD: 1 },
};

function row(symbol, overrides = {}) {
  return {
    symbol,
    companyName: symbol,
    currency: "USD",
    currentPrice: 100,
    recommendedEntry: 101,
    stopLoss: 96,
    target: 113,
    target2: 121,
    riskReward: 2.4,
    tradingScore: 90,
    priceTimestamp: "2026-07-29T21:30:00.000Z",
    dataStatus: { readyForScore: true, actualCandleCount: 220, latestTimestamp: "2026-07-29T21:30:00.000Z" },
    opportunity: { score: 90, riskReward: 2.4, failedConditions: [] },
    ...overrides,
  };
}

function report(input = {}) {
  return generateFreedomTraderReport({
    now: NOW,
    scannerRows: [row("AVGO")],
    scanSummary: { status: "complete", requestedCount: 1, analysedCount: 1, unavailableCount: 0, qualifiedCount: 1, completedAt: NOW.toISOString(), dataLabel: "Delayed by 15 minutes" },
    positions: [],
    pendingOrders: [],
    trades: [],
    settings: BASE_SETTINGS,
    ...input,
  });
}

test("creates one valid READY TO BUY trade with exact CMC instructions", () => {
  const result = report();
  const trade = result.recommendations[0];
  assert.equal(trade.status, "READY TO BUY");
  assert.equal(trade.suggestedQuantity, 10);
  assert.equal(trade.maximumPlannedLoss, 50);
  assert.equal(trade.expectedProfit, 200);
  assert.equal(trade.rewardRisk, 4);
  assert.equal(trade.entryBuyPrice, 101);
  assert.equal(trade.safetyExit, 96);
  assert.equal(trade.takeSomeProfit, 113);
  assert.equal(trade.finalExit, 121);
  assert.match(result.greeting, /^Hi Grant/);
  assert.equal(result.orderInstructions.approvedTrades[0].symbol, "AVGO");
  assert.match(result.orderInstructions.approvedTrades[0].conditionalBuy, /10 AVGO shares/);
  assert.match(result.overallInstruction, /Prepare one conditional AVGO order in CMC/);
});

test("ranks multiple opportunities to the best five", () => {
  const result = report({
    scannerRows: [
      row("A", { tradingScore: 70, opportunity: { score: 70, riskReward: 2.4, failedConditions: [] } }),
      row("B", { tradingScore: 95, opportunity: { score: 95, riskReward: 2.4, failedConditions: [] } }),
      row("C", { tradingScore: 88, opportunity: { score: 88, riskReward: 2.4, failedConditions: [] } }),
      row("D", { tradingScore: 91, opportunity: { score: 91, riskReward: 2.4, failedConditions: [] } }),
      row("E", { tradingScore: 93, opportunity: { score: 93, riskReward: 2.4, failedConditions: [] } }),
      row("F", { tradingScore: 89, opportunity: { score: 89, riskReward: 2.4, failedConditions: [] } }),
    ],
  });
  assert.deepEqual(result.recommendations.map((item) => item.symbol), ["B", "E", "D", "F", "C"]);
});

test("returns no suitable trades when scanner has no rows", () => {
  const result = report({ scannerRows: [], scanSummary: { status: "complete", requestedCount: 4, analysedCount: 4, unavailableCount: 0, qualifiedCount: 0, completedAt: NOW.toISOString(), dataLabel: "Delayed by 15 minutes" } });
  assert.equal(result.recommendations[0].status, "NO ACTION");
  assert.match(result.overallInstruction, /Do nothing and wait/);
  assert.doesNotMatch(result.overallInstruction, /No trade currently/);
});

test("does not claim no qualifying trades when zero symbols were analysed", () => {
  const result = report({ scannerRows: [], scanSummary: buildFailedFreedomScanSummary({ requestedCount: 20, error: "market data unavailable" }) });
  assert.equal(result.recommendations[0].status, "DATA UNAVAILABLE");
  assert.match(result.overallInstruction, /Do not place a new trade/);
  assert.doesNotMatch(`${result.overallInstruction}\n${result.recommendations[0].reason}`, /No trade currently/);
});

test("partial scans are reported separately from complete scans", () => {
  const scanSummary = { status: "partial", requestedCount: 20, analysedCount: 12, unavailableCount: 8, qualifiedCount: 0, completedAt: NOW.toISOString(), dataLabel: "Delayed by 15 minutes" };
  const result = report({ scannerRows: [], scanSummary });
  assert.equal(result.recommendations[0].status, "NO ACTION");
  assert.match(result.recommendations[0].reason, /could only analyse part of the market/i);
  assert.match(result.overallInstruction, /Wait until market data is available/);
});

test("shared scan action text separates complete, partial and failed scans", () => {
  assert.match(scanActionText({ status: "complete", analysedCount: 5, qualifiedCount: 0 }).body, /successfully analysed 5/);
  assert.match(scanActionText({ status: "partial", analysedCount: 3, unavailableCount: 2, qualifiedCount: 0 }).body, /only analyse part/);
  assert.match(scanActionText({ status: "failed", analysedCount: 0 }).body, /data is unavailable/);
});

test("missing quote data is DATA UNAVAILABLE", () => {
  const result = report({ scannerRows: [row("MISS", { currentPrice: null })] });
  assert.equal(result.recommendations[0].status, "DATA UNAVAILABLE");
  assert.match(result.recommendations[0].technicalDetails.failedReason, /quote/);
});

test("missing historical data is DATA UNAVAILABLE", () => {
  const result = report({ scannerRows: [row("HIST", { dataStatus: { readyForScore: false, actualCandleCount: 45, latestTimestamp: "2026-07-29T21:30:00.000Z" } })] });
  assert.equal(result.recommendations[0].status, "DATA UNAVAILABLE");
  assert.match(result.recommendations[0].technicalDetails.failedReason, /historical/);
});

test("stale market data prevents fresh purchases", () => {
  const result = report({ scannerRows: [row("STALE", { priceTimestamp: "2026-07-20T00:00:00.000Z", dataStatus: { readyForScore: true, actualCandleCount: 220, latestTimestamp: "2026-07-20T00:00:00.000Z" } })] });
  assert.equal(result.recommendations[0].status, "DATA UNAVAILABLE");
  assert.equal(result.recommendations[0].marketDataQuality, "stale");
});

test("delayed market data is labelled while allowing a valid plan", () => {
  const delayed = row("DELAY", { dataStatus: { readyForScore: true, actualCandleCount: 220, delayed: true, latestTimestamp: "2026-07-29T21:30:00.000Z" } });
  assert.equal(classifyMarketData(delayed, NOW), "delayed");
  const result = report({ scannerRows: [delayed] });
  assert.equal(result.recommendations[0].marketDataQuality, "delayed");
  assert.equal(result.marketDataQuality, "delayed");
});

test("invalid price ordering is rejected", () => {
  const result = report({ scannerRows: [row("BAD", { stopLoss: 102 })] });
  assert.equal(result.recommendations[0].status, "WAIT");
  assert.match(result.recommendations[0].technicalDetails.failedReason, /ordering/);
});

test("minimum reward-to-risk failure is rejected", () => {
  const result = report({ scannerRows: [row("LOWRR", { target: 105, riskReward: 0.8, opportunity: { score: 90, riskReward: 0.8, failedConditions: [] } })] });
  assert.equal(result.recommendations[0].status, "WAIT");
  assert.match(result.recommendations[0].reason, /possible profit/);
});

test("quantity below one is rejected", () => {
  const result = report({ settings: { ...BASE_SETTINGS, defaultMaximumLoss: 1, maximumPlannedLossPerTrade: 1 } });
  assert.equal(result.recommendations[0].status, "WAIT");
  assert.match(result.recommendations[0].technicalDetails.failedReason, /one whole share|buying power|quantity/);
});

test("insufficient cash prevents a recommendation", () => {
  const result = report({ settings: { ...BASE_SETTINGS, availableCash: 50, maximumPositionValue: 50, maximumTotalMoneyCommitted: 50 } });
  assert.equal(result.recommendations[0].status, "WAIT");
  assert.match(result.recommendations[0].technicalDetails.failedReason, /buying power|cash|quantity/);
});

test("maximum planned loss exceeded prevents additional approved trades", () => {
  const result = report({
    scannerRows: [row("ONE"), row("TWO", { tradingScore: 89, opportunity: { score: 89, riskReward: 2.4, failedConditions: [] } })],
    settings: { ...BASE_SETTINGS, maximumTotalPlannedLoss: 60 },
  });
  assert.equal(result.recommendations[0].status, "READY TO BUY");
  assert.equal(result.recommendations[1].status, "WAIT");
  assert.match(result.recommendations[1].technicalDetails.failedReason, /planned loss/);
});

test("maximum open positions reached prevents new trades", () => {
  const result = report({
    positions: [
      { ticker: "A", quantity: 1, averageEntry: 10, currentPrice: 11, status: "open", priceTimestamp: "2026-07-29T21:30:00.000Z" },
      { ticker: "B", quantity: 1, averageEntry: 10, currentPrice: 11, status: "open", priceTimestamp: "2026-07-29T21:30:00.000Z" },
      { ticker: "C", quantity: 1, averageEntry: 10, currentPrice: 11, status: "open", priceTimestamp: "2026-07-29T21:30:00.000Z" },
    ],
  });
  assert.equal(result.recommendations[0].status, "WAIT");
  assert.match(result.recommendations[0].technicalDetails.failedReason, /open positions/);
});

test("duplicate active symbol prevents a new order", () => {
  const result = report({ pendingOrders: [{ symbol: "AVGO", status: "pending", requestedPrice: 100, quantity: 1 }] });
  assert.equal(result.recommendations[0].status, "WAIT");
  assert.match(result.recommendations[0].technicalDetails.failedReason, /duplicate/);
});

test("missing currency conversion prevents cross-currency sizing", () => {
  const result = report({ settings: { ...BASE_SETTINGS, accountCurrency: "AUD", currencyConversionRates: { AUD: 1 } } });
  assert.equal(result.recommendations[0].status, "DATA UNAVAILABLE");
  assert.match(result.recommendations[0].reason, /currency conversion/);
});

test("open position reaching Take Some Profit creates a partial exit action", () => {
  const result = report({ positions: [{ ticker: "AVGO", quantity: 5, averageEntry: 100, currentPrice: 114, target: 113, target2: 121, stopLoss: 96, unrealisedProfitLoss: 70, status: "open", priceTimestamp: "2026-07-29T21:30:00.000Z" }] });
  assert.equal(result.positionActions[0].action, "TAKE SOME PROFIT");
  assert.equal(result.positionActions[0].partialExit.sellQuantity, 3);
  assert.equal(result.positionActions[0].partialExit.remainingQuantity, 2);
  assert.equal(result.positionActions[0].moveSafetyExitTo, 100);
});

test("open position reaching Final Exit creates a final exit action", () => {
  const result = report({ positions: [{ ticker: "AVGO", quantity: 2, averageEntry: 100, currentPrice: 122, target: 113, target2: 121, stopLoss: 96, unrealisedProfitLoss: 44, status: "open", priceTimestamp: "2026-07-29T21:30:00.000Z" }] });
  assert.equal(result.positionActions[0].action, "FINAL EXIT");
  assert.match(result.overallInstruction, /Final Exit/);
});

test("open position reaching Safety Exit creates a safety exit action", () => {
  const result = report({ positions: [{ ticker: "AVGO", quantity: 2, averageEntry: 100, currentPrice: 95, target: 113, target2: 121, stopLoss: 96, unrealisedProfitLoss: -10, status: "open", priceTimestamp: "2026-07-29T21:30:00.000Z" }] });
  assert.equal(result.positionActions[0].action, "SAFETY EXIT");
  assert.match(result.overallInstruction, /Safety Exit/);
});

test("partial exit calculation uses whole-share 50 percent splits", () => {
  assert.deepEqual(calculatePartialExit({ quantity: 4, percent: 50 }), { sellQuantity: 2, remainingQuantity: 2, percent: 50, unevenSplit: false });
});

test("partial exit calculation handles uneven whole-share splits", () => {
  assert.deepEqual(calculatePartialExit({ quantity: 5, percent: 50 }), { sellQuantity: 3, remainingQuantity: 2, percent: 50, unevenSplit: true });
});

test("target1 can be treated as complete exit when no Final Exit exists", () => {
  const result = report({ settings: { ...BASE_SETTINGS, target1IsCompleteExit: true }, scannerRows: [row("ONLY", { target2: null })] });
  assert.equal(result.recommendations[0].status, "READY TO BUY");
  assert.equal(result.recommendations[0].finalExit, 113);
});

test("Morning Report includes morning-focused sections", () => {
  const result = report({ reportType: "morning" });
  assert.ok(result.summary.bestNewTradeOpportunities);
  assert.ok(result.summary.exactCmcConditionalOrdersToPrepare);
  assert.ok(Object.hasOwn(result.summary, "proposedTotalPurchaseValue"));
});

test("Evening Report includes evening-focused sections", () => {
  const result = report({
    reportType: "evening",
    scannerRows: [row("NVDA", { currentPrice: 110 })],
    marketWatch: {
      alerts: [{ id: "alert-buy", action: "BUY NOW" }],
      plans: [
        { id: "completed", state: "COMPLETED" },
        { id: "cancelled", state: "CANCELLED" },
        { id: "remaining", state: "ACTIVE" },
      ],
    },
  });
  assert.ok(result.summary.ordersThatDidNotTrigger);
  assert.ok(result.summary.ordersThatShouldNowBeCancelled);
  assert.ok(result.summary.positionsThatCanRemainOpen);
  assert.equal(result.summary.marketWatch.alerts.length, 1);
  assert.equal(result.summary.marketWatch.completedTrades.length, 1);
  assert.equal(result.summary.marketWatch.cancelledSetups.length, 1);
  assert.equal(result.summary.marketWatch.remainingMonitoredTrades.length, 1);
});

test("current report ends with one clear overall instruction", () => {
  const result = report();
  assert.equal(typeof result.overallInstruction, "string");
  assert.ok(result.overallInstruction.length > 10);
});

test("report generation returns account summary and alerts without persistence", () => {
  const result = report();
  assert.equal(result.reportType, "now");
  assert.equal(result.accountSummary.availableCash, 5000);
  assert.equal(result.actionAlerts[0].action, "BUY");
});
