import { expect, test } from "@playwright/test";

const screenshotDir = "tmp/freedom-market-opportunities";

const columns = [
  "Company",
  "Market",
  "Quote",
  "History",
  "Analysis",
  "Trading Score",
  "Confidence",
  "Current Price",
  "Recommended Entry",
  "Safety Exit",
  "Take Some Profit",
  "Final Exit",
  "Reward/Risk",
  "Status",
  "Reason",
  "Action",
];

function row(symbol, index, overrides = {}) {
  return {
    symbol,
    companyName: `${symbol} Holdings`,
    exchange: "NASDAQ",
    currency: "USD",
    quoteStatus: "verified",
    historyStatus: "verified",
    analysed: true,
    tradingScore: 95 - index,
    confidence: 91 - index,
    currentPrice: 100 + index,
    recommendedEntry: 102 + index,
    stopLoss: 96 + index,
    target: 114 + index,
    finalExit: 126 + index,
    riskReward: 2.4 + index / 10,
    status: "WAIT FOR ENTRY",
    qualified: false,
    dataQuality: "daily-only",
    provider: "Twelve Data",
    marketDataTimestamp: "2026-08-04T21:30:00.000Z",
    reason: `${symbol} has a constructive setup, but the current price has not yet reached the rules-based entry zone. Wait for confirmation instead of treating this as a ready trade.`,
    ...overrides,
  };
}

const developingRows = [
  row("ALFA", 0),
  row("BRAV", 1, { status: "WATCH", reason: "BRAV is developing cleanly with improving momentum, but the entry trigger has not confirmed yet. Keep it on the watchlist." }),
  row("CHAR", 2),
  row("DELT", 3, { status: "WATCH" }),
  row("ECHO", 4),
  row("FOXT", 5, { status: "NO TRADE", reason: "FOXT failed the minimum reward/risk rule and must remain rejected." }),
];

const qualifiedRows = [
  row("QUA1", 0, { qualified: true, status: "READY TO BUY", tradingScore: 88 }),
  row("QUA2", 1, { qualified: true, status: "READY TO BUY", tradingScore: 97 }),
  row("QUA3", 2, { qualified: true, status: "BUY NOW", tradingScore: 91 }),
  row("QUA4", 3, { qualified: true, status: "READY TO BUY", tradingScore: 89 }),
  row("QUA5", 4, { qualified: true, status: "READY TO BUY", tradingScore: 86 }),
  row("QUA6", 5, { qualified: true, status: "READY TO BUY", tradingScore: 99 }),
];

async function openMarketOpportunities(page, rows = developingRows) {
  await page.addInitScript(() => {
    window.localStorage.setItem("freedom-trader-unlocked", "true");
  });
  await page.route("**/api/freedom-trader/scanner**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        decisions: rows,
        results: rows.filter((item) => item.qualified),
        nextOffset: 0,
        updatedAt: "2026-08-04T22:00:00.000Z",
        scanSummary: {
          scanCompletionStatus: "complete",
          status: "complete",
          universe: 48,
          requested: rows.length,
          successfullyAnalysed: rows.length,
          dataUnavailable: 0,
          qualified: rows.filter((item) => item.qualified).length,
          notQualified: rows.filter((item) => !item.qualified).length,
          providerStatus: "Available",
          elapsedMs: 1200,
          scannedSymbols: rows.map((item) => item.symbol),
          marketScopeMessage: "Freedom Trader V1.0 currently analyses US markets only.",
        },
      }),
    });
  });
  await page.goto("/freedom-trader/market-opportunities", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Check Market Now" }).click();
  await expect(page.getByText(`${rows.length} ranked results`)).toBeVisible();
}

async function expectNoPageHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));
  expect(overflow.documentScrollWidth).toBeLessThanOrEqual(overflow.viewport + 1);
  expect(overflow.bodyScrollWidth).toBeLessThanOrEqual(overflow.viewport + 1);
}

test.describe("Market Opportunities layout", () => {
  test("uses the wide viewport and keeps detailed table overflow internal", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1100 });
    await openMarketOpportunities(page);

    await expectNoPageHorizontalOverflow(page);
    const metrics = await page.locator(".panel").evaluate((panel) => {
      const tableWrap = panel.querySelector("[data-testid='market-opportunities-table-scroll']");
      return {
        panelWidth: panel.getBoundingClientRect().width,
        wrapClientWidth: tableWrap.clientWidth,
        wrapScrollWidth: tableWrap.scrollWidth,
      };
    });
    expect(metrics.panelWidth).toBeGreaterThan(1500);
    expect(metrics.wrapScrollWidth).toBeGreaterThan(metrics.wrapClientWidth);

    for (const column of columns) {
      await expect(page.getByRole("columnheader", { name: column })).toBeVisible();
    }

    await page.screenshot({ path: `${screenshotDir}/desktop-full-width-results.png`, fullPage: true });
  });

  test("keeps Company sticky and makes the Action column reachable", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await openMarketOpportunities(page);

    const wrap = page.locator("[data-testid='market-opportunities-table-scroll']");
    const company = page.getByRole("cell", { name: /ALFA Holdings/ }).first();
    const before = await company.boundingBox();
    await wrap.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
    const after = await company.boundingBox();
    expect(Math.abs(after.x - before.x)).toBeLessThan(2);
    await expect(page.getByRole("link", { name: "Open Company" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Open Company" }).first()).toHaveAttribute("href", /from=scanner&prepare=1/);

    await page.screenshot({ path: `${screenshotDir}/desktop-table-scrolled-right.png`, fullPage: true });
  });

  test("shows fallback Top 5 cards as not ready without changing row statuses", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1100 });
    await openMarketOpportunities(page);

    const cards = page.locator(".topOpportunityCards article");
    await expect(cards).toHaveCount(5);
    await expect(cards.nth(0)).toContainText("#1");
    await expect(cards.nth(0)).toContainText("ALFA Holdings");
    await expect(cards.nth(0)).toContainText("WAIT");
    await expect(cards.nth(0)).toContainText("Not ready");
    await expect(cards.nth(1)).toContainText("DEVELOPING");
    await expect(cards.nth(4)).toContainText("ECHO Holdings");
    const topCardText = await cards.allInnerTexts();
    expect(topCardText.join("\n")).not.toContain("QUALIFIED");
    await expect(page.locator("tbody tr").first()).toContainText("WAIT FOR ENTRY");

    await page.screenshot({ path: `${screenshotDir}/top-5-cards.png`, fullPage: true });
  });

  test("uses existing ranked qualified results for Top 5 cards", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await openMarketOpportunities(page, qualifiedRows);

    const cards = page.locator(".topOpportunityCards article");
    await expect(cards).toHaveCount(5);
    await expect(cards.nth(0)).toContainText("QUA1 Holdings");
    await expect(cards.nth(1)).toContainText("QUA2 Holdings");
    await expect(cards.nth(4)).toContainText("QUA5 Holdings");
    const topCardText = await cards.allInnerTexts();
    expect(topCardText.join("\n")).not.toContain("QUA6 Holdings");
  });

  test("opens full Reason text from the compact table preview", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await openMarketOpportunities(page);
    await page.getByRole("button", { name: "View reason" }).first().click();

    const dialog = page.getByRole("dialog", { name: "ALFA Holdings" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Wait for confirmation instead of treating this as a ready trade.");
    await page.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toBeHidden();
  });

  test("stacks cards responsively without page-level horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 1100 });
    await openMarketOpportunities(page);
    await expectNoPageHorizontalOverflow(page);
    const tabletColumns = await page.locator(".topOpportunityCards").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
    expect(tabletColumns).toBe(2);
    await page.screenshot({ path: `${screenshotDir}/tablet-layout.png`, fullPage: true });

    await page.setViewportSize({ width: 390, height: 1000 });
    await expectNoPageHorizontalOverflow(page);
    const mobileColumns = await page.locator(".topOpportunityCards").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
    expect(mobileColumns).toBe(1);
    await page.screenshot({ path: `${screenshotDir}/mobile-layout.png`, fullPage: true });
  });
});
