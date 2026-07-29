import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_REPORT_SETTINGS, classifyMarketData, generateFreedomTraderReport } from "../lib/freedom-trader/actionReport.js";

const NOW = new Date("2026-07-29T22:00:00.000Z");

function row(symbol, overrides = {}) {
  return {
    symbol,
    companyName: symbol,
    currency: "USD",
    currentPrice: 100,
    recommendedEntry: 101,
    stopLoss: 96,
    target: 113,
    riskReward: 2.4,
    tradingScore: 90,
    priceTimestamp: "2026-07-29T21:30:00.000Z",
    dataStatus: { readyForScore: true, latestTimestamp: "2026-07-29T21:30:00.000Z" },
    opportunity: { score: 90, riskReward: 2.4, failedConditions: [] },
    ...overrides,
  };
}

function report(input = {}) {
  return generateFreedomTraderReport({
    now: NOW,
    scannerRows: [row("AVGO")],
    positions: [],
    pendingOrders: [],
    trades: [],
    settings: DEFAULT_REPORT_SETTINGS,
    ...input,
  });
}

test("creates one valid READY TO BUY trade with CMC instructions", () => {
  const result = report();
  const trade = result.recommendations[0];
  assert.equal(trade.status, "READY TO BUY");
  assert.equal(trade.suggestedQuantity, 15);
  assert.equal(trade.maximumPlannedLoss, 75);
  assert.match(result.greeting, /^Hi Grant — here are your best options right now\./);
  assert.equal(result.orderInstructions.approvedTrades[0].symbol, "AVGO");
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
  const result = report({ scannerRows: [] });
  assert.equal(result.recommendations[0].status, "NO ACTION");
  assert.match(result.overallInstruction, /Do nothing/);
});

test("does not recommend fresh purchases from stale market data", () => {
  const result = report({ scannerRows: [row("STALE", { priceTimestamp: "2026-07-20T00:00:00.000Z", dataStatus: { latestTimestamp: "2026-07-20T00:00:00.000Z" } })] });
  assert.equal(result.recommendations[0].status, "DATA UNAVAILABLE");
  assert.equal(result.recommendations[0].marketDataQuality, "stale");
});

test("does not recommend fresh purchases from unavailable market data", () => {
  const result = report({ scannerRows: [row("MISS", { status: "DATA UNAVAILABLE", error: "provider down" })] });
  assert.equal(result.recommendations[0].status, "DATA UNAVAILABLE");
  assert.match(result.recommendations[0].reason, /cannot assess/i);
});

test("labels delayed market data clearly while allowing a valid plan", () => {
  const delayed = row("DELAY", { dataStatus: { delayed: true, latestTimestamp: "2026-07-29T21:30:00.000Z" } });
  assert.equal(classifyMarketData(delayed, NOW), "delayed");
  const result = report({ scannerRows: [delayed] });
  assert.equal(result.recommendations[0].marketDataQuality, "delayed");
  assert.equal(result.marketDataQuality, "delayed");
});

test("missing entry, stop or target is DATA UNAVAILABLE", () => {
  for (const missing of ["recommendedEntry", "stopLoss", "target"]) {
    const broken = row("BROKEN", { [missing]: null });
    const result = report({ scannerRows: [broken] });
    assert.equal(result.recommendations[0].status, "DATA UNAVAILABLE");
  }
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
  const result = report({ settings: { ...DEFAULT_REPORT_SETTINGS, maximumPlannedLossPerTrade: 1 } });
  assert.equal(result.recommendations[0].status, "WAIT");
  assert.match(result.recommendations[0].technicalDetails.failedReason, /quantity/);
});

test("account balance exceeded prevents a recommendation", () => {
  const result = report({ settings: { ...DEFAULT_REPORT_SETTINGS, tradingBalance: 50, maximumTotalMoneyCommitted: 50 } });
  assert.equal(result.recommendations[0].status, "WAIT");
});

test("maximum planned loss exceeded prevents additional approved trades", () => {
  const result = report({
    scannerRows: [row("ONE"), row("TWO", { tradingScore: 89, opportunity: { score: 89, riskReward: 2.4, failedConditions: [] } })],
    settings: { ...DEFAULT_REPORT_SETTINGS, maximumTotalPlannedLoss: 75 },
  });
  assert.equal(result.recommendations[0].status, "READY TO BUY");
  assert.equal(result.recommendations[1].status, "WAIT");
  assert.match(result.recommendations[1].technicalDetails.failedReason, /planned loss/);
});

test("maximum simultaneous trades reached prevents new trades", () => {
  const result = report({
    positions: [
      { ticker: "A", quantity: 1, averageEntry: 10, currentPrice: 11, status: "open" },
      { ticker: "B", quantity: 1, averageEntry: 10, currentPrice: 11, status: "open" },
      { ticker: "C", quantity: 1, averageEntry: 10, currentPrice: 11, status: "open" },
    ],
  });
  assert.equal(result.recommendations[0].status, "WAIT");
  assert.match(result.recommendations[0].technicalDetails.failedReason, /simultaneous/);
});

test("open position reaching its target is a SELL AT TARGET action", () => {
  const result = report({ positions: [{ ticker: "AVGO", quantity: 2, averageEntry: 100, currentPrice: 120, target: 115, stopLoss: 95, unrealisedProfitLoss: 40, status: "open" }] });
  assert.equal(result.positionActions[0].action, "SELL AT TARGET");
});

test("open position reaching its stop is an EXIT NOW action", () => {
  const result = report({ positions: [{ ticker: "AVGO", quantity: 2, averageEntry: 100, currentPrice: 94, target: 115, stopLoss: 95, unrealisedProfitLoss: -12, status: "open" }] });
  assert.equal(result.positionActions[0].action, "EXIT NOW");
  assert.match(result.overallInstruction, /Exit AVGO/);
});

test("order that should be cancelled is listed", () => {
  const result = report({ scannerRows: [row("BAD", { status: "DATA UNAVAILABLE", error: "missing" })] });
  assert.equal(result.orderInstructions.ordersToCancel[0].symbol, "BAD");
});

test("Morning Report includes morning-focused sections", () => {
  const result = report({ reportType: "morning" });
  assert.ok(result.summary.bestNewSetups);
  assert.ok(result.summary.conditionalOrdersToPrepare);
  assert.ok(Object.hasOwn(result.summary, "totalProposedPurchaseValue"));
});

test("Evening Report includes evening-focused sections", () => {
  const result = report({ reportType: "evening", scannerRows: [row("NVDA", { currentPrice: 110 })] });
  assert.ok(result.summary.tradesNotTriggered);
  assert.ok(result.summary.ordersToCancelBeforeNextSession);
  assert.ok(result.summary.positionsThatMayRemainOpen);
});

test("current report ends with one clear overall instruction", () => {
  const result = report();
  assert.equal(typeof result.overallInstruction, "string");
  assert.ok(result.overallInstruction.length > 10);
});

test("report can still be generated when persistence is unavailable", () => {
  const result = report();
  assert.equal(result.reportType, "now");
  assert.equal(result.recommendations.length, 1);
});
