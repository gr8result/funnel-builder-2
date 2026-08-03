import assert from "node:assert/strict";
import test from "node:test";
import {
  DAILY_DASHBOARD_STATES,
  buildAssistantDecision,
  buildDailyAssistantAnswer,
  validateAssistantRecommendation,
} from "../lib/freedom-trader/assistantDecisionEngine.js";

const COMPLETE_SCAN = {
  status: "complete",
  requestedCount: 20,
  analysedCount: 18,
  unavailableCount: 0,
  qualifiedCount: 1,
  completedAt: "2026-08-02T07:30:00.000Z",
};

function recommendation(overrides = {}) {
  return {
    status: "READY TO BUY",
    symbol: "AVGO",
    companyName: "Broadcom",
    currency: "USD",
    entryBuyPrice: 381.18,
    safetyExit: 377.8,
    takeSomeProfit: 389.5,
    finalExit: 396,
    suggestedQuantity: 1,
    maximumPlannedLoss: 3.38,
    technicalDetails: { score: 90 },
    ...overrides,
  };
}

function watch(overrides = {}) {
  return {
    service: { enabled: true },
    plans: [{
      id: "plan-avgo",
      symbol: "AVGO",
      state: "WAITING_FOR_ENTRY",
      entryPrice: 381.18,
      safetyExit: 377.8,
      takeSomeProfit: 389.5,
      quantity: 1,
    }],
    alerts: [{
      id: "alert-avgo",
      planId: "plan-avgo",
      action: "BUY NOW",
      symbol: "AVGO",
      companyName: "Broadcom",
      currentPrice: 381.18,
      triggerPrice: 381.18,
      createdAt: "2026-08-02T07:34:21.000Z",
      message: "ACTION REQUIRED\n\nBuy 1 Broadcom share now.",
    }],
    ...overrides,
  };
}

function report(overrides = {}) {
  return {
    scanSummary: COMPLETE_SCAN,
    recommendations: [recommendation()],
    ...overrides,
  };
}

test("BUY cannot render without symbol", () => {
  const decision = buildAssistantDecision({ report: report(), marketWatch: watch({ alerts: [{ ...watch().alerts[0], symbol: "" }] }) });
  const validation = validateAssistantRecommendation({ state: "ACTION REQUIRED", action: "BUY NOW", alert: { ...watch().alerts[0], symbol: "" } }, { report: report(), scanSummary: COMPLETE_SCAN, marketWatch: watch() });
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join(" "), /symbol/);
  assert.notEqual(decision.action, "BUY NOW");
});

test("BUY cannot render without entry", () => {
  const marketWatch = watch({ plans: [{ ...watch().plans[0], entryPrice: null }] });
  const decision = buildAssistantDecision({ report: report(), marketWatch });
  assert.notEqual(decision.action, "BUY NOW");
  assert.equal(decision.state, "MONITORING");
});

test("BUY cannot render without monitoring", () => {
  const decision = buildAssistantDecision({ report: report(), marketWatch: watch({ service: { enabled: false } }) });
  assert.notEqual(decision.action, "BUY NOW");
  assert.equal(decision.state, "READY TO PREPARE");
});

test("BUY cannot render without completed scan", () => {
  const decision = buildAssistantDecision({ report: report({ scanSummary: { ...COMPLETE_SCAN, status: "partial" } }), marketWatch: watch() });
  assert.notEqual(decision.action, "BUY NOW");
  assert.equal(decision.state, "WAIT");
});

test("BUY cannot render with unknown price", () => {
  const decision = buildAssistantDecision({ report: report(), marketWatch: watch({ alerts: [{ ...watch().alerts[0], currentPrice: null }] }) });
  assert.notEqual(decision.action, "BUY NOW");
  assert.equal(decision.state, "MONITORING");
});

test("WAIT renders correctly", () => {
  const decision = buildAssistantDecision({
    report: report({ recommendations: [] }),
    marketWatch: watch({ alerts: [], plans: watch().plans }),
  });
  assert.equal(decision.state, "MONITORING");
  assert.equal(decision.action, "WAIT");
});

test("PREPARE TRADE renders correctly", () => {
  const decision = buildAssistantDecision({ report: report(), marketWatch: watch({ service: { enabled: false }, alerts: [], plans: [] }) });
  assert.equal(decision.state, "READY TO PREPARE");
  assert.equal(decision.headline, "Prepare Trade");
});

test("NO ACTION renders correctly", () => {
  const decision = buildAssistantDecision({
    report: report({ scanSummary: { ...COMPLETE_SCAN, qualifiedCount: 0 }, recommendations: [] }),
    marketWatch: watch({ service: { enabled: false }, alerts: [], plans: [] }),
  });
  assert.equal(decision.state, "NO ACTION");
  assert.equal(decision.message, "No qualified trade plans exist.");
});

test("TAKE SOME PROFIT renders correctly", () => {
  const decision = buildAssistantDecision({ report: report(), marketWatch: watch({ alerts: [{ ...watch().alerts[0], action: "TAKE SOME PROFIT", currentPrice: 389.5, triggerPrice: 389.5 }] }) });
  assert.equal(decision.state, "TAKE SOME PROFIT");
});

test("FINAL EXIT renders correctly", () => {
  const decision = buildAssistantDecision({ report: report(), marketWatch: watch({ alerts: [{ ...watch().alerts[0], action: "FINAL EXIT", currentPrice: 396, triggerPrice: 396 }] }) });
  assert.equal(decision.state, "FINAL EXIT");
});

test("SAFETY EXIT renders correctly", () => {
  const decision = buildAssistantDecision({ report: report(), marketWatch: watch({ alerts: [{ ...watch().alerts[0], action: "SAFETY EXIT", currentPrice: 377.8, triggerPrice: 377.8 }] }) });
  assert.equal(decision.state, "SAFETY EXIT");
});

test("invalid states are rejected", () => {
  const validation = validateAssistantRecommendation({ state: "ACTION REQUIRED", action: "BUY NOW", alert: { action: "BUY NOW" } }, { report: report(), scanSummary: COMPLETE_SCAN, marketWatch: watch({ service: { enabled: false }, plans: [] }) });
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.length >= 5);
});

test("daily dashboard answer exposes only four Grant-facing states", () => {
  const samples = [
    buildDailyAssistantAnswer(buildAssistantDecision({ loading: true }), { scanSummary: COMPLETE_SCAN }),
    buildDailyAssistantAnswer(buildAssistantDecision({ report: report(), marketWatch: watch({ service: { enabled: false }, alerts: [], plans: [] }) }), { scanSummary: COMPLETE_SCAN }),
    buildDailyAssistantAnswer(buildAssistantDecision({ report: report(), marketWatch: watch() }), { scanSummary: COMPLETE_SCAN }),
    buildDailyAssistantAnswer(buildAssistantDecision({ report: report(), marketWatch: watch({ alerts: [{ ...watch().alerts[0], action: "TAKE SOME PROFIT", currentPrice: 389.5, triggerPrice: 389.5 }] }) }), { scanSummary: COMPLETE_SCAN }),
  ];
  samples.forEach((answer) => assert.ok(DAILY_DASHBOARD_STATES.includes(answer.state), answer.state));
  assert.deepEqual(samples.map((answer) => answer.state), ["NOTHING", "PREPARE_ONE_TRADE", "BUY_NOW", "SELL_NOW"]);
  assert.equal(samples.some((answer) => /checking|scanner|monitoring|paused|running/i.test(`${answer.headline} ${answer.primaryInstruction}`)), false);
});

test("daily dashboard answer explains no-action and prepare trade in plain English", () => {
  const nothing = buildDailyAssistantAnswer(buildAssistantDecision({
    report: report({ scanSummary: { ...COMPLETE_SCAN, requestedCount: 180, analysedCount: 180, qualifiedCount: 0 }, recommendations: [] }),
    marketWatch: watch({ service: { enabled: false }, alerts: [], plans: [] }),
  }), { scanSummary: { ...COMPLETE_SCAN, requestedCount: 180, analysedCount: 180, qualifiedCount: 0 } });
  assert.equal(nothing.state, "NOTHING");
  assert.match(nothing.primaryInstruction, /Enjoy your day/);
  assert.match(nothing.why, /I checked 180 companies/);

  const prepare = buildDailyAssistantAnswer(buildAssistantDecision({ report: report({ scanSummary: { ...COMPLETE_SCAN, requestedCount: 180, qualifiedCount: 1 } }), marketWatch: watch({ service: { enabled: false }, alerts: [], plans: [] }) }), { scanSummary: { ...COMPLETE_SCAN, requestedCount: 180, qualifiedCount: 1 } });
  assert.equal(prepare.state, "PREPARE_ONE_TRADE");
  assert.equal(prepare.companyName, "Broadcom");
  assert.match(prepare.primaryInstruction, /CMC/);
});
