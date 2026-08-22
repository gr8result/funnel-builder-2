import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";

const organisationId = "846885cd-25b9-4eca-b9f9-3fd02f5882d8";
const baseUrl = process.env.ESTIMATE_BUILDER_BASE_URL || "http://localhost:3000";
const outDir = path.resolve("test-results", "roof-tile-catalogue-browser");
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
  page.on("console", (message) => console.log(`[browser:${message.type()}] ${message.text()}`));
  page.on("pageerror", (error) => console.log(`[browser:pageerror] ${error.message}`));

  await page.goto(`${baseUrl}/modules/estimate-builder?organisationId=${organisationId}`, { waitUntil: "domcontentloaded" });
  await waitForAnyText(page, ["Client Selections", "Selections", "Project Dashboard", "Sign in to your account"], 90000);
  await screenshot(page, "01-estimate-builder.png");
  const dashboardText = await bodyText(page);
  if (dashboardText.includes("Sign in to your account") || page.url().includes("/login")) {
    await screenshot(page, "01-auth-gate.png");
    await page.goto(`${baseUrl}/modules/builders/selections-book?organisationId=${organisationId}`, { waitUntil: "domcontentloaded" });
    await waitForText(page, "Choose an Area");
  } else {
    await clickByAnyText(page, "button, a, [role='button']", ["Client Selections", "Selections"]);
    await waitForText(page, "Choose an Area");
  }
  await screenshot(page, "02-client-selections-areas.png");

  await clickByText(page, "button", "Exterior");
  await waitForText(page, "Roofing");
  await screenshot(page, "03-client-selections-exterior.png");
  await clickByText(page, "button", "Roofing");
  await page.waitForSelector('[data-testid="roofing-three-card-home"]');
  await assertText(page, "Fascia & Gutter");
  await assertText(page, "COLORBOND Roofing");
  await assertText(page, "Roof Tiles");
  await screenshot(page, "04-roofing-three-card-home.png");

  await clickByText(page, '[data-testid="roofing-three-card-home"] button', "COLORBOND Roofing");
  await page.waitForSelector('[data-testid="roofing-profile-step"]');
  await assertText(page, "COLORBOND");
  await assertText(page, "LYSAGHT");
  await screenshot(page, "05-metal-roofing-regression.png");

  await clickByText(page, "button", "Back");
  await page.waitForSelector('[data-testid="roofing-three-card-home"]');
  await clickByText(page, '[data-testid="roofing-three-card-home"] button', "Roof Tiles");
  await page.waitForSelector('[data-testid="roofing-tile-manufacturer-step"]');
  await assertText(page, "Monier");
  await assertText(page, "Bristile");
  await screenshot(page, "06-roof-tile-manufacturers.png");

  await clickByText(page, '[data-testid="roofing-tile-manufacturer-step"] button', "Monier");
  await page.waitForSelector('[data-testid="roofing-tile-range-step"]');
  await assertText(page, "Atura");
  await assertText(page, "Cambridge");
  assert.equal((await bodyText(page)).includes("Madison"), false, "Madison must not be exposed in QLD Client Selections");
  await screenshot(page, "07-monier-ranges.png");
  await clickByText(page, '[data-testid="roofing-tile-range-step"] button', "Atura");
  await page.waitForSelector('[data-testid="roofing-tile-product-step"]');
  await assertText(page, "Sambuca");
  await assertText(page, "Barramundi");
  await screenshot(page, "08-monier-atura-products.png");

  await page.goto(`${baseUrl}/modules/builders/selections-book?organisationId=${organisationId}`, { waitUntil: "domcontentloaded" });
  await waitForText(page, "Choose an Area");
  await clickByText(page, "button", "Exterior");
  await waitForText(page, "Roofing");
  await clickByText(page, "button", "Roofing");
  await page.waitForSelector('[data-testid="roofing-three-card-home"]');
  await clickByText(page, '[data-testid="roofing-three-card-home"] button', "Roof Tiles");
  await page.waitForSelector('[data-testid="roofing-tile-manufacturer-step"]');
  await clickByText(page, '[data-testid="roofing-tile-manufacturer-step"] button', "Bristile");
  await page.waitForSelector('[data-testid="roofing-tile-range-step"]');
  await assertText(page, "Designer");
  await assertText(page, "Marseille");
  await screenshot(page, "09-bristile-ranges.png");
  await clickByText(page, '[data-testid="roofing-tile-range-step"] button', "Designer");
  await page.waitForSelector('[data-testid="roofing-tile-product-step"]');
  await assertText(page, "Alabaster");
  await assertText(page, "Cool Smoke");
  await screenshot(page, "10-bristile-designer-products.png");

  await page.goto(`${baseUrl}/modules/builders/product-library?organisationId=${organisationId}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-catalogue-kind="product-library"]');
  await clickBySelector(page, '[data-area-key="exterior"]');
  await page.waitForSelector('[data-category-key="exterior-roofing"]');
  await clickBySelector(page, '[data-category-key="exterior-roofing"]');
  await page.waitForSelector('[data-family-key="roofing"]');
  await clickBySelector(page, '[data-family-key="roofing"]');
  await waitForText(page, "Monier");
  await waitForText(page, "Bristile");
  await screenshot(page, "11-product-library-roofing.png");

  console.log(`Roof tile catalogue browser screenshots saved to ${outDir}`);
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

async function clickByAnyText(page, selector, texts) {
  await page.evaluate(({ selector: query, texts: expectedTexts }) => {
    const elements = Array.from(document.querySelectorAll(query));
    const target = elements.find((element) => expectedTexts.some((expected) => element.textContent?.trim().includes(expected)));
    if (!target) throw new Error(`Could not find ${query} containing any of ${expectedTexts.join(", ")}`);
    target.click();
  }, { selector, texts });
}

async function clickBySelector(page, selector) {
  await page.evaluate((query) => {
    const target = document.querySelector(query);
    if (!target) throw new Error(`Could not find ${query}`);
    target.click();
  }, selector);
}

async function waitForText(page, text) {
  await page.waitForFunction((expected) => document.body.innerText.includes(expected), {}, text);
}

async function waitForAnyText(page, texts, timeout) {
  await page.waitForFunction((expectedTexts) => expectedTexts.some((expected) => document.body.innerText.includes(expected)), { timeout }, texts);
}

async function assertText(page, text) {
  const found = await page.evaluate((expected) => document.body.innerText.includes(expected), text);
  assert.ok(found, `Expected page text: ${text}`);
}

async function bodyText(page) {
  return page.evaluate(() => document.body.innerText);
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
