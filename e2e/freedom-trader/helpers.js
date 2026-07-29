import fs from "fs";
import { AUTH_STATE_PATH } from "./global-setup.js";

export const FREEDOM_PASSWORD = process.env.FREEDOM_TERMINAL_PASSWORD || "freedom123";
export const TEST_SYMBOL = process.env.FREEDOM_TRADER_E2E_SYMBOL || "NVDA";

export function readTestUsers() {
  if (!fs.existsSync(AUTH_STATE_PATH)) return { available: false, users: [] };
  return JSON.parse(fs.readFileSync(AUTH_STATE_PATH, "utf8"));
}

export async function unlockFreedomTrader(page, symbol = TEST_SYMBOL) {
  await page.goto(`/freedom-trader/company/${symbol}`, { waitUntil: "domcontentloaded" });
  const passwordInput = page.locator('input[type="password"]');
  const chartPanel = page.locator(".chartPanel");
  // First navigation can be slow (dev-mode cold compile of the route);
  // wait for whichever of the gate or the already-unlocked page shows up
  // first, rather than guessing with a short fixed timeout.
  await Promise.race([
    passwordInput.waitFor({ state: "visible", timeout: 45000 }).catch(() => {}),
    chartPanel.waitFor({ state: "visible", timeout: 45000 }).catch(() => {}),
  ]);
  if (await passwordInput.isVisible().catch(() => false)) {
    await passwordInput.fill(FREEDOM_PASSWORD);
    await page.getByRole("button", { name: /unlock trader/i }).click();
  }
  await chartPanel.waitFor({ state: "visible", timeout: 45000 });
  // The chart's ECharts instance only has a real coordinate system once
  // candle data has actually loaded -- .dataLabel only renders then. Fib
  // drawing before this point silently no-ops (chartPointFromEvent returns
  // null against an empty/cleared chart).
  await page.locator(".dataLabel").waitFor({ state: "visible", timeout: 30000 });
}

export async function signIn(page, email, password) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 20000 }).catch(() => {});
}

// Draws a Fib retracement by simulating a pointer drag on the chart's draft
// layer, from a point ~30% down the plot to ~70% down the plot. Synthetic
// drags against a canvas-rendered chart are occasionally missed by the
// browser's compositor, so retry a couple of times before failing.
export async function drawFibRetracement(page, attempts = 3) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    await page.getByRole("button", { name: "Fib Retracement" }).click();
    const draftLayer = page.locator(".fibDraftLayer");
    await draftLayer.waitFor({ state: "visible", timeout: 10000 });
    const box = await draftLayer.boundingBox();
    if (!box) throw new Error("Fib draft layer did not render a bounding box.");
    const x = box.x + box.width * (0.55 + attempt * 0.05);
    const startY = box.y + box.height * 0.3;
    const endY = box.y + box.height * 0.7;

    await page.mouse.move(x, startY);
    await page.mouse.down();
    await page.waitForTimeout(80);
    await page.mouse.move(x, (startY + endY) / 2, { steps: 12 });
    await page.waitForTimeout(80);
    await page.mouse.move(x, endY, { steps: 12 });
    await page.waitForTimeout(80);
    await page.mouse.up();

    const drawn = await page.locator(".fibLevel").first().waitFor({ state: "visible", timeout: 8000 }).then(() => true).catch(() => false);
    if (drawn) return;
  }
  throw new Error(`Fib retracement did not render after ${attempts} attempts.`);
}

export async function assignFibLevel(page, levelLabelPattern, assignmentButtonName) {
  const level = page.locator(".fibLevel", { hasText: levelLabelPattern }).first();
  // Fib level positions are recalculated (refreshOverlayPixels) on chart
  // resize/re-render; force bypasses Playwright's actionability "stable
  // position" check, which can spuriously time out against a legitimately
  // clickable element whose pixel position shifts by sub-pixel amounts.
  await level.click({ force: true });
  const menuButton = page.getByRole("button", { name: assignmentButtonName, exact: true });
  await menuButton.waitFor({ state: "attached", timeout: 10000 });
  await menuButton.click({ force: true });
}

export function parseCurrency(text) {
  if (!text) return null;
  const cleaned = text.replace(/[^0-9.-]/g, "");
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}
