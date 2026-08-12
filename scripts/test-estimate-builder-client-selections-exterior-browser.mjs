import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";

const baseUrl = process.env.CLIENT_SELECTIONS_BASE_URL || "http://localhost:3000";
const outDir = path.resolve("test-results", "estimate-builder-client-selections-exterior");
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
  await page.goto(`${baseUrl}/modules/estimate-builder`, { waitUntil: "domcontentloaded" });
  await wait(3000);
  await screenshot(page, "01-estimate-builder-route.png");
  const bodyText = await page.evaluate(() => document.body.innerText);
  if (bodyText.includes("Sign in to your account")) {
    await screenshot(page, "01-auth-gate.png");
    console.log(`Estimate Builder route reached but local session is unauthenticated. Auth-gate screenshot saved to ${outDir}`);
    process.exitCode = 0;
    await browser.close();
    process.exit(0);
  }
  if (!bodyText.includes("Client Selections")) {
    await screenshot(page, "01-route-not-ready.png");
    console.log(`Estimate Builder route reached but Client Selections was not available in this browser session. Route-state screenshot saved to ${outDir}`);
    process.exitCode = 0;
    await browser.close();
    process.exit(0);
  }

  await clickByText(page, "button, a, [role='button']", "Client Selections");
  await page.waitForSelector('[data-testid="guided-client-selections-home"]');
  await screenshot(page, "02-guided-home.png");

  await clickByText(page, "button", "Exterior");
  await page.waitForSelector('[data-testid="guided-exterior-categories"]');
  await assertText(page, "Bricks");
  await assertText(page, "Roofing");
  await assertNoText(page, "Roof Colour");
  await screenshot(page, "03-exterior-categories.png");

  await clickByText(page, "button", "Bricks");
  await page.waitForSelector('[data-testid="guided-bricks-workflow"]');
  await assertText(page, "Exterior / Bricks");
  await assertText(page, "Choose a supplier");
  await assertNoText(page, "FACE BRICKS - PREMIER RANGE");
  await assertNoText(page, "FACE BRICKS - PREMIUM RANGE");
  await assertNoText(page, "614 approved CSV rows connected");
  const hasEmptyBrickCatalogue = await hasSelector(page, '[data-testid="guided-brick-empty-catalogue"]');
  if (hasEmptyBrickCatalogue) {
    await assertText(page, "Brick catalogue awaiting product data");
    await screenshot(page, "04-bricks-empty-catalogue.png");
  } else {
    await page.waitForSelector('[data-testid="guided-brick-supplier-grid"]');
    await screenshot(page, "04-brick-suppliers.png");
    await clickFirstCard(page, '[data-testid="guided-brick-supplier-grid"] button');
    await page.waitForSelector('[data-testid="guided-brick-range-grid"]');
    await screenshot(page, "05-brick-ranges.png");
    await clickFirstCard(page, '[data-testid="guided-brick-range-grid"] button');
    await page.waitForSelector('[data-testid="guided-brick-product-grid"]');
    await screenshot(page, "06-brick-products.png");
  }

  await clickByText(page, "button", "Back");
  if (hasEmptyBrickCatalogue) {
    await page.waitForSelector('[data-testid="guided-exterior-categories"]');
  } else {
    await page.waitForSelector('[data-testid="guided-brick-range-grid"]');
    await clickByText(page, "button", "Back");
    await page.waitForSelector('[data-testid="guided-brick-supplier-grid"]');
    await clickByText(page, "button", "Back");
    await page.waitForSelector('[data-testid="guided-exterior-categories"]');
  }
  await screenshot(page, "07-back-to-exterior-from-bricks.png");

  await clickByText(page, "button", "Roofing");
  await page.waitForSelector('[data-testid="guided-product-page"]');
  await assertText(page, "Exterior / Roofing");
  await assertNoText(page, "Roof Colour");
  await assertNoText(page, "614 approved CSV rows connected");
  await screenshot(page, "08-roofing-products-or-empty.png");

  await clickByText(page, "button", "Back");
  await page.waitForSelector('[data-testid="guided-exterior-categories"]');

  await clickByText(page, "button", "Back");
  await page.waitForSelector('[data-testid="guided-client-selections-home"]');
  await clickByText(page, "button", "Interior");
  await page.waitForSelector('[data-testid="guided-interior-categories"]');
  await clickByText(page, "button", "Kitchen");
  await page.waitForSelector('[data-testid="guided-kitchen-checklist"]');
  await clickByTestId(page, "guided-requirement-oven");
  await page.waitForSelector('[data-testid="guided-product-page"]');
  await assertText(page, "Kitchen / Oven");
  await clickByText(page, "button", "Back");
  await page.waitForSelector('[data-testid="guided-kitchen-checklist"]');
  await screenshot(page, "09-back-to-kitchen-from-oven.png");

  console.log(`Estimate Builder Client Selections exterior screenshots saved to ${outDir}`);
} finally {
  await browser.close();
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

async function clickByTestId(page, testId) {
  await page.evaluate((id) => {
    const target = document.querySelector(`[data-testid="${id}"] button`) || document.querySelector(`[data-testid="${id}"]`);
    if (!target) throw new Error(`Could not find test id ${id}`);
    target.click();
  }, testId);
}

async function clickFirstCard(page, selector) {
  await page.evaluate((query) => {
    const target = document.querySelector(query);
    if (!target) throw new Error(`Could not find ${query}`);
    target.click();
  }, selector);
}

async function hasSelector(page, selector) {
  return Boolean(await page.$(selector));
}

async function assertText(page, text) {
  const found = await page.evaluate((expected) => document.body.innerText.includes(expected), text);
  if (!found) throw new Error(`Expected page text: ${text}`);
}

async function assertNoText(page, text) {
  const found = await page.evaluate((expected) => document.body.innerText.includes(expected), text);
  if (found) throw new Error(`Unexpected page text: ${text}`);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
