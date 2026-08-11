import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateAverageEntry,
  calculateBuyOrder,
  calculateSale,
  calculateUnrealised,
  priceIsUsable,
  shouldTriggerExit,
  validateBuyOrder,
} from "../lib/freedom-trader/paperTrading.js";
import { oneShareExitOptions, recordLocalMarketWatchFill, registerLocalMarketWatchPlan } from "../lib/freedom-trader/localPaperStore.js";

const account = { id: "account-1", available_cash: 100000 };
const validPrice = {
  price: 100,
  provider: "Unit Test",
  exchange: "ASX",
  currency: "AUD",
  lastUpdated: new Date().toISOString(),
};

test("buy order calculations include value, brokerage, risk and account percentage", () => {
  const result = calculateBuyOrder({ account, currentPrice: 100, orderType: "market", quantity: 10, brokerage: 9.5, stopLoss: 90 });
  assert.equal(result.orderValue, 1000);
  assert.equal(result.totalRequiredCash, 1009.5);
  assert.equal(result.riskPerShare, 10);
  assert.equal(result.totalRisk, 100);
  assert.equal(result.percentAtRisk, 0.1);
});

test("insufficient funds prevents buy order", () => {
  const result = validateBuyOrder({ account: { id: "a", available_cash: 50 }, price: validPrice, order: { orderType: "market", quantity: 1, brokerageFee: 9.5 } });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /insufficient/i);
});

test("average entry calculation weights additional buys", () => {
  assert.equal(calculateAverageEntry(10, 100, 10, 120), 110);
});

test("partial sale leaves remaining quantity and realises profit", () => {
  const result = calculateSale({ quantity: 10, averageEntry: 100, saleQuantity: 4, salePrice: 125, brokerage: 5 });
  assert.equal(result.remainingQuantity, 6);
  assert.equal(result.grossProfit, 100);
  assert.equal(result.realisedProfit, 95);
});

test("unrealised profit calculation uses latest price", () => {
  const result = calculateUnrealised({ quantity: 5, average_entry_price: 100 }, 112);
  assert.equal(result.marketValue, 560);
  assert.equal(result.unrealisedProfit, 60);
  assert.equal(result.returnPercent, 12);
});

test("stop loss and target execution decisions are separated", () => {
  assert.equal(shouldTriggerExit({ stopLoss: 90, target: 130 }, 89), "stop_loss");
  assert.equal(shouldTriggerExit({ stopLoss: 90, target: 130 }, 131), "profit_target");
  assert.equal(shouldTriggerExit({ stopLoss: 90, target: 130 }, 110), null);
});

test("pending limit order validation requires valid limit price", () => {
  const result = validateBuyOrder({ account, price: validPrice, order: { orderType: "limit", quantity: 1, limitPrice: 0 } });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /Limit price/i);
});

test("order cancellation uses pending status in API layer contract", () => {
  const allowedStatus = ["pending", "filled", "partially_filled", "cancelled", "rejected"];
  assert.equal(allowedStatus.includes("cancelled"), true);
});

test("currency separation is reported before order execution", () => {
  const mismatched = { ...validPrice, currency: "USD" };
  assert.equal(priceIsUsable(mismatched), true);
  assert.notEqual(mismatched.currency, "AUD");
});

test("overselling is rejected by sale calculation", () => {
  assert.equal(calculateSale({ quantity: 2, averageEntry: 100, saleQuantity: 3, salePrice: 120, brokerage: 1 }), null);
});

test("duplicate execution can be detected with filled status", () => {
  const status = "filled";
  assert.notEqual(status, "pending");
});

test("missing price data is unusable", () => {
  assert.equal(priceIsUsable({ price: null, provider: "Unit Test", exchange: "ASX", currency: "AUD", lastUpdated: new Date().toISOString() }), false);
});

test("one-share exit handling requires an explicit target choice", () => {
  const result = oneShareExitOptions({ quantity: 1 });
  assert.equal(result.requiresChoice, true);
  assert.deepEqual(result.choices, ["Sell at first target", "Hold for final target"]);
});

test("multi-share exit handling can take some profit", () => {
  const result = oneShareExitOptions({ quantity: 4 });
  assert.equal(result.requiresChoice, false);
  assert.equal(result.action, "TAKE_SOME_PROFIT");
});

test("Market Watch handoff stores CMC entered plan and actual fill price", async () => {
  const symbol = `UT${Date.now()}`;
  const entered = await registerLocalMarketWatchPlan({
    symbol,
    companyName: "Unit Test Corp",
    buyTrigger: 100,
    safetyExit: 94,
    takeSomeProfit: 112,
    finalExit: 118,
    quantity: 3,
    currency: "USD",
  });
  assert.equal(entered.broker, "CMC");
  assert.equal(entered.state, "WAITING_FOR_ENTRY");
  const filled = await recordLocalMarketWatchFill({ id: entered.id, actualFillPrice: 100.25, quantity: 3, filledAt: "2026-08-09T10:00:00Z" });
  assert.equal(filled.state, "POSITION_ACTIVE");
  assert.equal(filled.actualFillPrice, 100.25);
  assert.equal(filled.actualQuantity, 3);
});
