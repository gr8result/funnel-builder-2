import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";

const baseUrl = process.env.ESTIMATE_BUILDER_BASE_URL || "http://localhost:3000";
const outDir = path.resolve("test-results", "estimate-builder-catalogue-separation");
fs.mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
  headless: "new",
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  defaultViewport: { width: 1440, height: 1040 },
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

try {
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);
  await openEstimateBuilder(page);
  await screenshot(page, "01-estimate-builder-dashboard.png");
  const dashboardText = await page.evaluate(() => document.body.innerText);
  if (dashboardText.includes("Sign in to your account") || page.url().includes("/login")) {
    await screenshot(page, "01-auth-gate.png");
    console.log(`Estimate Builder catalogue separation browser test skipped: authenticated local session required. Screenshot saved to ${outDir}`);
    process.exit(0);
  }

  await clickByText(page, "button, a, [role='button']", "Product Library");
  await page.waitForSelector('[data-catalogue-kind="product-library"]');
  await screenshot(page, "02-product-library-hierarchy.png");
  await assertNoText(page, "Site Supervision");
  await assertNoText(page, "Frame Labour");
  await assertNoText(page, "Project Management");
  await assertNoProductSearchCard(page, "SITE SUPERVISION");
  await assertNoProductSearchCard(page, "ENGINEERING");
  await assertNoProductSearchCard(page, "SOIL TEST");
  await assertNoProductSearchCard(page, "FRAME LABOUR");

  await clickBySelector(page, '[data-area-key="exterior"]');
  await page.waitForSelector('[data-category-key="exterior-bricks"]');
  await clickBySelector(page, '[data-category-key="exterior-bricks"]');
  await page.waitForSelector('[data-family-key="bricks"]');
  await clickBySelector(page, '[data-family-key="bricks"]');
  await page.waitForSelector('[data-family-key="bricks"]');
  await screenshot(page, "03-product-library-exterior-bricks.png");
  await assertText(page, "No products have been added to this catalogue yet.");

  await openEstimateBuilder(page);
  await clickByText(page, "button, a, [role='button']", "Product Library");
  await page.waitForSelector('[data-catalogue-kind="product-library"]');
  await clickBySelector(page, '[data-area-key="interior"]');
  await page.waitForSelector('[data-category-key="kitchen"]');
  await clickBySelector(page, '[data-category-key="kitchen"]');
  await page.waitForSelector('[data-family-key="ovens"]');
  await clickBySelector(page, '[data-family-key="ovens"]');
  await page.waitForSelector('[data-family-key="ovens"]');
  await screenshot(page, "04-product-library-interior-kitchen-oven.png");
  await assertText(page, "Ovens");

  await openEstimateBuilder(page);
  await clickByText(page, "button, a, [role='button']", "Estimating Catalogue");
  await page.waitForFunction(() => document.body.innerText.includes("Seed from Quote Sheet") || document.body.innerText.includes("Quote Sheet starter rows"));
  await screenshot(page, "05-estimating-catalogue-qs-table.png");
  await assertText(page, "Estimating Catalogue");

  console.log(`Estimate Builder catalogue separation browser screenshots saved to ${outDir}`);
} finally {
  await browser.close();
}

async function openEstimateBuilder(page) {
  await page.goto(`${baseUrl}/modules/estimate-builder`, { waitUntil: "domcontentloaded" });
  await wait(2500);
}

async function assertNoProductSearchCard(page, term) {
  await page.$eval('[data-catalogue-kind="product-library"] input', (input, value) => {
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, term);
  await wait(250);
  const cardTexts = await page.$$eval('[data-search-results="product-library"] button', (cards) => cards.map((card) => card.textContent || ""));
  assert.ok(!cardTexts.some((text) => text.toUpperCase().includes(term)), `Product Library search must not return ${term}`);
}

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(outDir, name), fullPage: true });
}

async function clickByText(page, selector, text) {
  await page.evaluate(({ selector: query, text: expected }) => {
    const elements = Array.from(document.querySelectorAll(query));
    const target = elements.find((element) => element.textContent?.trim().includes(expected));
    if (!target) throw new Error(`Could not find ${query} containing ${expected}`);
    target.click();
  }, { selector, text });
}

async function clickBySelector(page, selector) {
  await page.evaluate((query) => {
    const target = document.querySelector(query);
    if (!target) throw new Error(`Could not find ${query}`);
    target.click();
  }, selector);
}

async function assertText(page, text) {
  const found = await page.evaluate((expected) => document.body.innerText.includes(expected), text);
  assert.ok(found, `Expected page text: ${text}`);
}

async function assertNoText(page, text) {
  const found = await page.evaluate((expected) => document.body.innerText.includes(expected), text);
  assert.ok(!found, `Unexpected page text: ${text}`);
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
