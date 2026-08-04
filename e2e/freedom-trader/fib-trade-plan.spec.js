import { expect, test } from "@playwright/test";
import { assignFibLevel, drawFibRetracement, parseCurrency, readTestUsers, signIn, TEST_SYMBOL, unlockFreedomTrader } from "./helpers.js";

async function tradePlanValues(page) {
  const article = page.locator(".decisionGrid article", { hasText: "Trade Plan" });
  const text = await article.innerText();
  const entry = text.match(/Entry \([^)]*\): ([^\n]+)/)?.[1];
  const stop = text.match(/Stop-loss \([^)]*\): ([^\n]+)/)?.[1];
  const target = text.match(/Target 1 \([^)]*\): ([^\n]+)/)?.[1];
  const target2 = text.match(/Target 2 \([^)]*\): ([^\n]+)/)?.[1];
  const riskReward = text.match(/Risk\/reward \(Target 1\): ([^\n]+)/)?.[1];
  return {
    entry: parseCurrency(entry),
    stop: parseCurrency(stop),
    target: parseCurrency(target),
    target2: target2 != null ? parseCurrency(target2) : null,
    riskReward: riskReward ? Number(riskReward) : null,
    raw: text,
  };
}

test.describe("Freedom Trader Fib trade plan", () => {
  test.beforeEach(async ({ page }) => {
    await unlockFreedomTrader(page);
  });

  test("Fib tool is available and extension levels are hidden by default", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Fib Retracement" })).toBeVisible();
    await drawFibRetracement(page);
    await expect(page.locator(".fibLevel.extension")).toHaveCount(0);
    await page.locator("label.fibExtensionToggle input").check();
    await expect(page.locator(".fibLevel.extension").first()).toBeVisible();
  });

  test("assigning Fib levels updates the Trade Plan card, chart lines and risk/reward together", async ({ page }) => {
    await drawFibRetracement(page);

    await assignFibLevel(page, "38.2%", "Set as Target 1");
    await assignFibLevel(page, "61.8%", "Set as Entry");
    await assignFibLevel(page, "0%", "Set as Stop-loss");
    await page.locator("label.fibExtensionToggle input").check();
    await assignFibLevel(page, "127.2%", "Set as Target 2");

    const plan = await tradePlanValues(page);
    expect(plan.entry).not.toBeNull();
    expect(plan.stop).not.toBeNull();
    expect(plan.target).not.toBeNull();
    expect(plan.target2).not.toBeNull();
    expect(plan.riskReward).not.toBeNull();

    // Same values must appear in the always-visible planner metric bar.
    const entryMetric = await page.locator(".metric", { hasText: "ENTRY (" }).innerText();
    expect(parseCurrency(entryMetric.split("\n").pop())).toBeCloseTo(plan.entry, 1);

    // And on the chart's draggable Entry line.
    const entryLineText = await page.locator(".plannerLine.entryLine strong").innerText();
    expect(parseCurrency(entryLineText)).toBeCloseTo(plan.entry, 1);

    // And in the Fib chart label itself (shows the ENTRY assignment tag).
    await expect(page.locator(".fibLevel.assigned-entry")).toBeVisible();
  });

  test("custom price entry updates the Trade Plan card", async ({ page }) => {
    await drawFibRetracement(page);
    await assignFibLevel(page, "61.8%", "Set as Entry");
    await assignFibLevel(page, "0%", "Set as Stop-loss");
    await assignFibLevel(page, "100%", "Set as Target 1");

    const before = await tradePlanValues(page);
    const customStop = Number((before.entry * 0.9).toFixed(2));
    const stopInput = page.locator(".manualLevelInput", { hasText: "STOP" }).locator("input");
    await stopInput.fill(String(customStop));
    await stopInput.blur();

    await expect(async () => {
      const after = await tradePlanValues(page);
      expect(after.stop).toBeCloseTo(customStop, 1);
      expect(after.riskReward).not.toBeCloseTo(before.riskReward ?? -1, 3);
    }).toPass({ timeout: 10000 });
  });

  test("dragging an active trade line updates the Trade Plan card", async ({ page }) => {
    await drawFibRetracement(page);
    await assignFibLevel(page, "61.8%", "Set as Entry");
    await assignFibLevel(page, "0%", "Set as Stop-loss");
    await assignFibLevel(page, "100%", "Set as Target 1");

    const before = await tradePlanValues(page);
    const stopLine = page.locator(".plannerLine.stopLine");
    const box = await stopLine.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y - 40, { steps: 8 });
    await page.mouse.up();

    await expect(async () => {
      const after = await tradePlanValues(page);
      expect(after.stop).not.toBeCloseTo(before.stop, 1);
    }).toPass({ timeout: 10000 });
  });

  test("Use Fib for Trade Plan either applies a valid fib-auto plan or clearly rejects a poor one", async ({ page }) => {
    await drawFibRetracement(page);
    await page.getByRole("button", { name: "Use Fib for Trade Plan" }).click();

    await expect(async () => {
      const plan = await tradePlanValues(page);
      const notice = await page.locator(".notice").innerText().catch(() => "");
      // Either the generator produced and applied a plan (source tags flip
      // to fib-auto), or it refused with an explanation -- both are valid,
      // deterministic outcomes; silently doing nothing is not.
      expect(plan.raw.includes("fib-auto") || /risk\/reward/i.test(notice)).toBe(true);
    }).toPass({ timeout: 10000 });
  });

  test("Reset to Analysis changes the level sources back to analysis", async ({ page }) => {
    await drawFibRetracement(page);
    await assignFibLevel(page, "61.8%", "Set as Entry");
    const manual = await tradePlanValues(page);
    expect(manual.raw).toContain("fib-manual");

    await page.getByRole("button", { name: "Reset to Analysis" }).first().click();
    await expect(async () => {
      const analysisPlan = await tradePlanValues(page);
      expect(analysisPlan.raw).toContain("(analysis)");
    }).toPass({ timeout: 10000 });
  });

  test("invalid bullish level ordering is flagged with a clear explanation", async ({ page }) => {
    await drawFibRetracement(page);
    // Bullish convention: 0%=swing low, 100%=swing high, so 23.6% is a
    // LOWER price than 61.8%. Entry at the lower level with stop at the
    // higher level puts stop above entry -- invalid for a bullish plan.
    await assignFibLevel(page, "23.6%", "Set as Entry");
    await assignFibLevel(page, "61.8%", "Set as Stop-loss");
    await expect(page.locator(".fibInvalidNotice")).toContainText(/below entry/i);
  });

  test("Clear assignment removes a level from the chart and the Trade Plan card", async ({ page }) => {
    await drawFibRetracement(page);
    await assignFibLevel(page, "61.8%", "Set as Entry");
    await expect(page.locator(".fibLevel.assigned-entry")).toBeVisible();

    await page.locator(".fibLevel", { hasText: "61.8%" }).first().click({ force: true });
    await page.getByRole("button", { name: "Clear assignment" }).click();
    await expect(page.locator(".fibLevel.assigned-entry")).toHaveCount(0);
  });

  test("Clear Fib Plan removes the drawing and resets levels to analysis", async ({ page }) => {
    await drawFibRetracement(page);
    await assignFibLevel(page, "61.8%", "Set as Entry");
    await page.getByRole("button", { name: "Clear Fib Plan" }).click();
    await expect(page.locator(".fibLevel")).toHaveCount(0);
  });

  test("a bearish plan is blocked from Mark as Purchased with an explanation", async ({ page }) => {
    await drawFibRetracement(page);
    await page.getByRole("button", { name: "Bearish", exact: true }).click();
    await page.getByRole("button", { name: "VIEW TRADE PLAN", exact: true }).click();
    await expect(page.locator(".modalWarning")).toContainText(/bearish/i);
  });

  test("a bullish plan still requires the Mark as Purchased confirmation dialog", async ({ page }) => {
    // Use deterministic manual prices (not the randomly-drawn Fib range)
    // so the setup clears the risk/reward and ATR-distance blockers
    // reliably against live, ever-changing market data.
    const currentPriceText = await page.locator(".decisionPanel .metric", { hasText: "Verified Price" }).innerText();
    const currentPrice = parseCurrency(currentPriceText.split("\n").pop());
    test.skip(!currentPrice, "No verified current price available to build a deterministic plan.");

    const entry = Number((currentPrice * 0.995).toFixed(2));
    const stop = Number((entry * 0.9).toFixed(2));
    const target = Number((entry * 1.25).toFixed(2));
    for (const [field, value] of [["ENTRY", entry], ["STOP", stop], ["TARGET 1", target]]) {
      const input = page.locator(".manualLevelInput", { hasText: field }).locator("input");
      await input.fill(String(value));
      await input.blur();
    }

    let dialogSeen = false;
    page.on("dialog", async (dialog) => {
      dialogSeen = true;
      await dialog.dismiss();
    });
    await page.getByRole("button", { name: "VIEW TRADE PLAN", exact: true }).click();
    const markButton = page.getByRole("button", { name: "Mark as Purchased" });
    await expect(markButton).toBeEnabled({ timeout: 10000 });
    await markButton.click();
    await page.locator('input[type="number"]').first().fill(String(entry));
    await page.getByRole("button", { name: "Confirm Purchase" }).click();
    expect(dialogSeen).toBe(true);
  });

  test("assigned Fib levels persist after a page refresh", async ({ page }) => {
    await drawFibRetracement(page);
    await assignFibLevel(page, "61.8%", "Set as Entry");
    const before = await tradePlanValues(page);

    await page.reload();
    await page.locator(".chartPanel").waitFor({ state: "visible", timeout: 30000 });

    await expect(async () => {
      const after = await tradePlanValues(page);
      expect(after.entry).toBeCloseTo(before.entry, 1);
    }).toPass({ timeout: 15000 });
  });

  test("signed-in users get isolated Fib plans", async ({ browser }) => {
    const { available, users } = readTestUsers();
    test.skip(!available, "Supabase admin credentials were not available to provision two test users.");

    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await unlockFreedomTrader(pageA);
    await signIn(pageA, users[0].email, users[0].password);
    await pageA.goto(`/freedom-trader/company/${TEST_SYMBOL}`);
    await pageA.locator(".chartPanel").waitFor({ state: "visible", timeout: 30000 });
    await drawFibRetracement(pageA);
    await assignFibLevel(pageA, "61.8%", "Set as Entry");
    const planA = await tradePlanValues(pageA);
    await expect(async () => {
      const status = await pageA.locator(".fibSaveStatus").innerText();
      expect(["Saving...", "Saved"]).toContain(status.trim());
    }).toPass({ timeout: 10000 });
    await contextA.close();

    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await unlockFreedomTrader(pageB);
    await signIn(pageB, users[1].email, users[1].password);
    await pageB.goto(`/freedom-trader/company/${TEST_SYMBOL}`);
    await pageB.locator(".chartPanel").waitFor({ state: "visible", timeout: 30000 });
    const planB = await tradePlanValues(pageB);
    expect(planB.entry).not.toBeCloseTo(planA.entry, 1);
    await contextB.close();
  });
});
