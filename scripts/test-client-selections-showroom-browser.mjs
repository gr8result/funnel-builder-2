import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";

const baseUrl = process.env.CLIENT_SELECTIONS_BASE_URL || "http://localhost:3000";
const outDir = path.resolve("test-results", "client-selections-showroom");
fs.mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
  headless: "new",
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  defaultViewport: { width: 1440, height: 1040 },
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

try {
  const page = await browser.newPage();
  page.setDefaultTimeout(45000);
  await page.goto(`${baseUrl}/modules/builders/client-selections`, { waitUntil: "networkidle2" });
  await page.waitForSelector('[data-testid="showroom-choose-area"]');
  await screenshot(page, "01-choose-area-desktop.png");

  await clickByText(page, "button", "Exterior");
  await page.waitForSelector('[data-testid="showroom-exterior-categories"]');
  await screenshot(page, "02-exterior-categories-desktop.png");

  await clickByText(page, "button", "Back");
  await page.waitForSelector('[data-testid="showroom-choose-area"]');
  await clickByText(page, "button", "Interior");
  await page.waitForSelector('[data-testid="showroom-interior-categories"]');
  await screenshot(page, "03-interior-categories-desktop.png");

  await clickByText(page, "button", "Kitchen");
  await page.waitForSelector('[data-testid="showroom-kitchen-checklist"]');
  await screenshot(page, "04-kitchen-checklist-desktop.png");

  await clickRowButton(page, "selection-row-oven");
  await page.waitForSelector('[data-testid="showroom-oven-product-grid"]');
  await screenshot(page, "05-oven-grid-desktop.png");

  await clickByText(page, "button", "View Details");
  await page.waitForSelector('[data-testid="showroom-product-detail"]');
  await screenshot(page, "06-oven-details-desktop.png");

  await clickByText(page, "button", "Select This Product");
  await page.waitForSelector(".alert.success");
  await clickByText(page, "button", "Back to Kitchen");
  await page.waitForSelector('[data-testid="showroom-kitchen-checklist"]');
  await screenshot(page, "07-oven-selected-desktop.png");

  await clickByText(page, "button", "Back");
  await page.waitForSelector('[data-testid="showroom-choose-area"]');
  await clickByText(page, "button", "Exterior");
  await page.waitForSelector('[data-testid="showroom-exterior-categories"]');
  await clickByText(page, "button", "Bricks");
  await page.waitForSelector('[data-testid="showroom-bricks-product-grid"]');
  await screenshot(page, "08-bricks-grid-desktop.png");

  await clickByText(page, "button", "Back to Exterior");
  await page.waitForSelector('[data-testid="showroom-exterior-categories"]');
  await clickByText(page, "button", "Roofing");
  await page.waitForSelector('[data-testid="showroom-roofing-product-grid"]');
  await screenshot(page, "09-roofing-selector-desktop.png");

  await page.setViewport({ width: 900, height: 1180 });
  await page.goto(`${baseUrl}/modules/builders/client-selections`, { waitUntil: "networkidle2" });
  await page.waitForSelector('[data-testid="showroom-choose-area"]');
  await screenshot(page, "10-choose-area-tablet.png");

  await page.setViewport({ width: 390, height: 920 });
  await page.goto(`${baseUrl}/modules/builders/client-selections`, { waitUntil: "networkidle2" });
  await page.waitForSelector('[data-testid="showroom-choose-area"]');
  await screenshot(page, "11-choose-area-mobile.png");

  console.log(`Client Selections showroom screenshots saved to ${outDir}`);
} finally {
  await browser.close();
}

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(outDir, name), fullPage: true });
}

async function clickRowButton(page, testId) {
  await page.evaluate((id) => {
    const row = document.querySelector(`[data-testid="${id}"]`);
    row?.querySelector("button")?.click();
  }, testId);
}

async function clickByText(page, selector, text) {
  await page.evaluate(({ selector: query, text: expected }) => {
    const elements = Array.from(document.querySelectorAll(query));
    const target = elements.find((element) => element.textContent?.trim().includes(expected));
    if (!target) throw new Error(`Could not find ${query} containing ${expected}`);
    target.click();
  }, { selector, text });
}
