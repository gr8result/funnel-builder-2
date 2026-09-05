import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import puppeteer from "puppeteer";

const baseUrl = process.env.CLIENT_SELECTIONS_BASE_URL || "http://localhost:3000";
const outDir = path.resolve("test-results", "entry-door-hume-catalogue");
fs.mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
  headless: "new",
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  defaultViewport: { width: 1440, height: 1100 },
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

try {
  const page = await browser.newPage();
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) browserErrors.push(`${message.type()}: ${message.text()}`);
  });
  page.setDefaultTimeout(60000);

  await page.goto(`${baseUrl}/modules/builders/client-selections`, { waitUntil: "networkidle2" });
  await clickButtonContaining(page, "Exterior");
  await page.waitForSelector('[data-testid="showroom-exterior-categories"]');
  await clickButtonContaining(page, "Entry Doors");
  await page.waitForSelector('[data-testid="guided-entry-door-workflow"]');
  await screenshot(page, "01-entry-door-suppliers.png");

  await clickButtonContaining(page, "Hume Doors & Timber");
  await page.waitForSelector('[data-testid="entry-door-range-step"]');
  await waitForText(page, "Savoy 820");
  await waitForText(page, "Savoy 1200");
  const missingRequiredRanges = await page.evaluate(() => {
    const required = [
      "Carringbush",
      "Haven",
      "Illusion",
      "Joinery Entrance",
      "Linear Entrance",
      "Newington",
      "Nexus",
      "Regency",
      "Vaucluse",
      "Vaucluse Premier",
      "Glass Opening",
      "Bush Fire Resistant (BAL19 & BAL29 Doors)",
      "Bushfire Resistant (BAL40 Doors)",
      "Elite Aluminium",
      "Elite Aluminium with VJ Panel",
      "Savoy 820",
      "Savoy 1200",
    ];
    const text = document.body.innerText;
    return required.filter((range) => !text.includes(range));
  });
  assert.deepEqual(missingRequiredRanges, [], "Hume range selector should expose every official entrance range");
  await screenshot(page, "02-hume-range-selector.png");

  await clickButtonContaining(page, "Savoy 820");
  await page.waitForSelector('[data-testid="entry-door-design-step"]');
  await waitForText(page, "XS11");
  await waitForText(page, "XS24-820");
  await waitForText(page, "XS26-820");
  await waitForText(page, "XS28-820");
  await waitForText(page, "XS45-820");
  assert.equal(await visibleDesignCount(page), 5, "Savoy 820 should render five visible design cards");
  assert.equal(await resultCount(page), 5, "Savoy 820 result count should report five visible designs");
  await assertImagesLoaded(page);
  await screenshot(page, "03-savoy-820-designs.png");

  await clickButtonContaining(page, "Clear range");
  await waitForResultCount(page, 126);
  assert.equal(await visibleDesignCount(page), 126, "Clearing range should render every enabled Hume entrance design");

  await clickProgressItem(page, "Range");
  await clickButtonContaining(page, "Savoy 1200");
  await page.waitForSelector('[data-testid="entry-door-design-step"]');
  await waitForText(page, "XS24-1200");
  await waitForText(page, "XS26-1200");
  await waitForText(page, "XS28-1200");
  await waitForText(page, "XS45-1200");
  assert.equal(await visibleDesignCount(page), 4, "Savoy 1200 should render four visible design cards");
  assert.equal(await resultCount(page), 4, "Savoy 1200 result count should report four visible designs");
  await assertImagesLoaded(page);
  await screenshot(page, "04-savoy-1200-designs.png");

  assert.deepEqual(browserErrors.filter((message) => !/React DevTools|HMR/i.test(message)), [], "Browser console should not contain runtime errors");

  console.log(`Hume Entry Doors browser test passed. Screenshots saved to ${outDir}`);
} finally {
  await browser.close();
}

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(outDir, name), fullPage: true });
}

async function clickButtonContaining(page, text) {
  await page.evaluate((expected) => {
    const target = [...document.querySelectorAll("button")]
      .find((button) => button.textContent?.replace(/\s+/g, " ").trim().includes(expected));
    if (!target) throw new Error(`Could not find button containing ${expected}`);
    target.click();
  }, text);
}

async function clickProgressItem(page, text) {
  await page.evaluate((expected) => {
    const target = [...document.querySelectorAll('[data-testid="guided-entry-door-hierarchy"] button')]
      .find((button) => button.textContent?.replace(/\s+/g, " ").trim().includes(expected));
    if (!target) throw new Error(`Could not find progress item ${expected}`);
    target.click();
  }, text);
}

async function waitForText(page, text) {
  await page.waitForFunction((expected) => document.body.innerText.includes(expected), {}, text);
}

async function waitForResultCount(page, count) {
  await page.waitForFunction((expected) => {
    const summary = document.querySelector('[data-testid="entry-door-design-result-count"] strong');
    return Number(summary?.textContent || 0) === expected;
  }, {}, count);
}

async function resultCount(page) {
  return page.$eval('[data-testid="entry-door-design-result-count"] strong', (node) => Number(node.textContent || 0));
}

async function visibleDesignCount(page) {
  return page.$$eval('[data-testid="entry-door-design-step"] article', (cards) => cards.length);
}

async function assertImagesLoaded(page) {
  const unloaded = await page.$$eval('[data-testid="entry-door-design-step"] article img', (images) => images
    .filter((image) => !image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0)
    .map((image) => image.alt || image.src));
  assert.deepEqual(unloaded, [], "Visible Hume Entry Door cards should load official product images");
}
