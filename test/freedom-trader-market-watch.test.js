import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMarketWatchAnswer,
  evaluateWatchPlan,
  normalizeMarketWatchSettings,
  normalizeTradePlan,
  runMarketWatchCycle,
  updateAlertState,
} from "../lib/freedom-trader/marketWatchEngine.js";
import { DesktopNotificationProvider } from "../lib/freedom-trader/notificationProvider.js";
import { MarketWatchService } from "../lib/freedom-trader/marketWatchService.js";
import { clearCompletedMarketWatchAlerts, writeMarketWatchStore } from "../lib/freedom-trader/marketWatchStore.js";

const NOW = new Date("2026-08-01T09:00:00.000Z");

function plan(overrides = {}) {
  return normalizeTradePlan({
    id: "plan-avgo",
    symbol: "AVGO",
    companyName: "Broadcom",
    currency: "USD",
    entryPrice: 381.18,
    safetyExit: 377.8,
    takeSomeProfit: 389.5,
    finalExit: 396,
    quantity: 1,
    maximumPlannedLoss: 3.38,
    confidence: 90,
    createdAt: NOW.toISOString(),
    expiresAt: new Date(NOW.getTime() + 3600000).toISOString(),
    ...overrides,
  }, {}, NOW);
}

test("BUY NOW fires when entry is reached", () => {
  const result = evaluateWatchPlan(plan(), { price: 381.18 }, {}, NOW);
  assert.equal(result.action, "BUY NOW");
  assert.equal(result.nextState, "ACTIVE");
  assert.equal(result.triggerPrice, 381.18);
});

test("SAFETY EXIT fires when stop is reached", () => {
  const result = evaluateWatchPlan(plan({ state: "ACTIVE" }), { price: 377.79 }, {}, NOW);
  assert.equal(result.action, "SAFETY EXIT");
  assert.equal(result.nextState, "STOPPED");
});

test("TAKE SOME PROFIT fires at Target 1", () => {
  const result = evaluateWatchPlan(plan({ state: "ACTIVE" }), { price: 389.5 }, {}, NOW);
  assert.equal(result.action, "TAKE SOME PROFIT");
  assert.equal(result.nextState, "PARTIAL_PROFIT");
});

test("FINAL EXIT fires at Target 2", () => {
  const result = evaluateWatchPlan(plan({ state: "PARTIAL_PROFIT" }), { price: 396 }, {}, NOW);
  assert.equal(result.action, "FINAL EXIT");
  assert.equal(result.nextState, "COMPLETED");
});

test("expired setup creates a cancel setup result and expires the plan", () => {
  const result = evaluateWatchPlan(plan({ expiresAt: new Date(NOW.getTime() - 1000).toISOString() }), { price: 382 }, {}, NOW);
  assert.equal(result.action, "CANCEL SETUP");
  assert.equal(result.nextState, "EXPIRED");
});

test("invalid setup creates a cancel setup result", () => {
  const result = evaluateWatchPlan(plan({ invalidated: true }), { price: 382 }, {}, NOW);
  assert.equal(result.action, "CANCEL SETUP");
  assert.equal(result.nextState, "CANCELLED");
});

test("duplicate alerts are suppressed between cycles", async () => {
  const first = await runMarketWatchCycle({
    plans: [plan()],
    alerts: [],
    fetchQuote: async () => ({ price: 381.18 }),
    now: NOW,
  });
  const second = await runMarketWatchCycle({
    plans: first.plans,
    alerts: first.alerts,
    fetchQuote: async () => ({ price: 381.18 }),
    now: new Date(NOW.getTime() + 60000),
  });
  assert.equal(first.newAlerts.length, 1);
  assert.equal(second.newAlerts.length, 0);
});

test("refresh with no trigger keeps monitoring answer quiet", async () => {
  const result = await runMarketWatchCycle({
    plans: [plan()],
    alerts: [],
    fetchQuote: async () => ({ price: 382 }),
    now: NOW,
  });
  assert.equal(result.evaluations[0].action, "WAIT");
  assert.equal(result.answer.heading, "Monitoring 1 active setup.");
  assert.equal(result.answer.message, "No action required right now.");
});

test("browser restart can rebuild the same dashboard answer from serialized state", async () => {
  const result = await runMarketWatchCycle({
    plans: [plan()],
    alerts: [],
    fetchQuote: async () => ({ price: 382 }),
    now: NOW,
  });
  const restored = JSON.parse(JSON.stringify({ plans: result.plans, alerts: result.alerts }));
  assert.deepEqual(buildMarketWatchAnswer(restored.plans, restored.alerts), result.answer);
});

test("dashboard refresh prioritises active alert actions", async () => {
  const result = await runMarketWatchCycle({
    plans: [plan()],
    alerts: [],
    fetchQuote: async () => ({ price: 381.18 }),
    now: NOW,
  });
  assert.equal(result.answer.heading, "ACTION REQUIRED");
  assert.equal(result.answer.action, "BUY NOW");
  assert.match(result.answer.message, /Open CMC/);
  assert.match(result.alerts[0].message, /^ACTION REQUIRED/);
  assert.equal(result.alerts[0].notificationTitle, "ACTION REQUIRED");
});

test("acknowledgement removes an alert from the active dashboard answer", async () => {
  const result = await runMarketWatchCycle({
    plans: [plan()],
    alerts: [],
    fetchQuote: async () => ({ price: 381.18 }),
    now: NOW,
  });
  const acknowledged = updateAlertState(result.alerts, result.alerts[0].id, { acknowledgedAt: NOW.toISOString() });
  const answer = buildMarketWatchAnswer(result.plans, acknowledged);
  assert.equal(answer.action, "WAIT");
  assert.equal(answer.message, "No action required right now.");
});

test("alert ordering is newest first", async () => {
  const older = await runMarketWatchCycle({
    plans: [plan({ id: "buy-plan" })],
    alerts: [],
    fetchQuote: async () => ({ price: 381.18 }),
    now: NOW,
  });
  const newer = await runMarketWatchCycle({
    plans: [plan({ id: "stop-plan", state: "ACTIVE" })],
    alerts: older.alerts,
    fetchQuote: async () => ({ price: 377.8 }),
    now: new Date(NOW.getTime() + 60000),
  });
  assert.equal(newer.alerts[0].action, "SAFETY EXIT");
  assert.equal(newer.alerts[1].action, "BUY NOW");
});

test("monitoring interval scheduling accepts only configured choices", () => {
  assert.equal(normalizeMarketWatchSettings({ intervalSeconds: 30 }).intervalSeconds, 30);
  assert.equal(normalizeMarketWatchSettings({ intervalSeconds: 120 }).intervalSeconds, 120);
  assert.equal(normalizeMarketWatchSettings({ intervalSeconds: 17 }).intervalSeconds, 60);
});

test("failure recovery continues remaining symbols and logs errors", async () => {
  const result = await runMarketWatchCycle({
    plans: [plan({ id: "bad", symbol: "BAD" }), plan({ id: "good", symbol: "GOOD" })],
    alerts: [],
    fetchQuote: async (symbol) => {
      if (symbol === "BAD") throw new Error("quote failed");
      return { price: 381.18, dataQuality: "live" };
    },
    now: NOW,
  });
  assert.equal(result.evaluations.length, 2);
  assert.equal(result.errors[0].symbol, "BAD");
  assert.equal(result.newAlerts.length, 1);
});

test("desktop notification provider sends ACTION REQUIRED notifications", async () => {
  const sent = [];
  global.window = {
    Notification: class {
      static permission = "granted";
      static async requestPermission() { return "granted"; }
      constructor(title, options) {
        sent.push({ title, options });
      }
    },
    focus() {},
    location: { href: "" },
  };
  global.Notification = global.window.Notification;
  const provider = new DesktopNotificationProvider();
  const result = await provider.send({ id: "alert-1", notificationTitle: "ACTION REQUIRED", notificationBody: "Buy Broadcom now.", companyUrl: "/freedom-trader/company/AVGO" });
  assert.equal(result.ok, true);
  assert.equal(sent[0].title, "ACTION REQUIRED");
  assert.equal(sent[0].options.body, "Buy Broadcom now.");
  delete global.window;
  delete global.Notification;
});

test("monitoring service starts and pauses without overlapping ownership in the dashboard", async () => {
  await writeMarketWatchStore({ settings: { intervalSeconds: 60 }, service: { enabled: false }, plans: [], alerts: [], cycles: [] });
  const service = new MarketWatchService();
  const started = await service.start();
  assert.equal(started.service.enabled, true);
  assert.ok(started.service.nextScheduledCheckAt);
  const paused = await service.pause("test pause");
  assert.equal(paused.service.enabled, false);
  assert.equal(paused.pausedReason, "test pause");
});

test("manual Run Check Now does not enable paused monitoring", async () => {
  await writeMarketWatchStore({ settings: { intervalSeconds: 60 }, service: { enabled: false }, plans: [], alerts: [], cycles: [] });
  const service = new MarketWatchService();
  const snapshot = await service.runNow();
  assert.equal(snapshot.service.enabled, false);
  assert.equal(snapshot.pausedReason, "Monitoring paused.");
  assert.equal(snapshot.cycles.length, 1);
});

test("completed alert cleanup preserves pending alerts", async () => {
  await writeMarketWatchStore({
    settings: { intervalSeconds: 60 },
    service: { enabled: false },
    plans: [],
    alerts: [
      { id: "keep", action: "BUY NOW", createdAt: "2026-08-01T09:00:00.000Z" },
      { id: "drop", action: "FINAL EXIT", createdAt: "2026-08-01T09:01:00.000Z", completedAt: "2026-08-01T09:02:00.000Z" },
    ],
    cycles: [],
  });
  const result = await clearCompletedMarketWatchAlerts();
  assert.deepEqual(result.alerts.map((item) => item.id), ["keep"]);
});
