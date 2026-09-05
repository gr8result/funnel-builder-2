import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import puppeteer from "puppeteer";

const baseUrl = process.env.CLIENT_SELECTIONS_BASE_URL || "http://localhost:3000";
const outDir = path.resolve("test-results", "entry-door-dashboard-imagery");
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
  await page.goto(`${baseUrl}/modules/builders/client-selections`, { waitUntil: "networkidle2" });
  await clickButtonContaining(page, "Exterior");
  await page.waitForSelector('[data-testid="showroom-exterior-categories"]');
  await clickButtonContaining(page, "Garage Doors");
  await page.waitForSelector('[data-testid="showroom-garage-door-product-grid"]');

  await assertText(page, /Supplier/);
  await assertText(page, /B&D Australia/);
  await clickButtonContaining(page, "B&D Australia");
  await assertText(page, /Door Type \/ Range/);
  await clickButtonContaining(page, "Panelift");
  await assertText(page, /Profile \/ Design/);
  await clickButtonContaining(page, "Seville");
  await assertText(page, /Size \/ Configuration/);
  await clickButtonContaining(page, "Open Colour / Finish");
  await page.waitForSelector('[data-testid="garage-door-colour-selector"]');

  const colourText = await page.evaluate(() => document.body.innerText);
  assert.match(colourText, /Colour \/ Finish/, "Garage Doors step navigation must include Colour / Finish");
  assert.match(colourText, /Standard COLORBOND/, "Compatible B&D standard colour family must render");
  assert.match(colourText, /Timber-look|Timbergrain/, "Compatible B&D premium colour family must render");
  assert.match(colourText, /On-screen colours are indicative/, "Physical sample warning must render");
  assert.doesNotMatch(colourText, /Steel-Line|UniCote LUX/, "Steel-Line-only finishes must not appear for B&D products");
  assert.doesNotMatch(colourText, /Next Selection/, "Garage Doors product view must not show Next Selection");

  await clickButtonContaining(page, "Monument");
  await assertText(page, /Selected/);
  await page.screenshot({ path: path.join(outDir, "garage-doors-colour-selector.png"), fullPage: true });
  await clickButtonContaining(page, "Confirm colour");
  await assertText(page, /Automation/);
  await clickButtonContaining(page, "Manual operation");
  await assertText(page, /Accessories/);
  await clickButtonContaining(page, "Review and Confirm");
  await page.waitForSelector('[data-testid="garage-door-review"]');
  await assertText(page, /Monument \/ Standard COLORBOND/);
  await assertText(page, /Save and Return to Dashboard/);
  await assertText(page, /Save Progress/);
  await page.screenshot({ path: path.join(outDir, "garage-doors-selected-colour-review.png"), fullPage: true });

  await clickButtonContaining(page, "Save and Return to Dashboard");
  await page.waitForSelector('[data-testid="showroom-exterior-categories"]');
  await page.waitForFunction(() => document.body.innerText.includes("Garage Doors"));

  const result = await page.evaluate(() => ({
    returnedDashboard: document.body.innerText.includes("Choose a selection category"),
    externalLightingOpen: Boolean(document.querySelector('[data-testid="showroom-external-lighting-product-grid"]')),
    garageCardStatus: [...document.querySelectorAll('[data-requirement-key="garage-door"]')]
      .map((card) => card.textContent?.replace(/\s+/g, " ").trim())
      .find(Boolean) || "",
  }));

  assert.equal(result.returnedDashboard, true, "Garage Doors save should return to the exterior dashboard");
  assert.equal(result.externalLightingOpen, false, "Garage Doors save must not auto-open External Lighting");
  assert.match(result.garageCardStatus, /Selected|In Progress|Open showroom/i, "Garage Doors card should remain visible after returning");

  await page.screenshot({ path: path.join(outDir, "garage-doors-return-dashboard.png"), fullPage: true });
  console.log("Exterior Doors dashboard navigation browser test passed.");
} finally {
  await browser.close();
}

async function assertText(page, pattern) {
  const text = await page.evaluate(() => document.body.innerText);
  assert.match(text, pattern);
}

async function clickButtonContaining(page, text) {
  await page.evaluate((expected) => {
    const target = [...document.querySelectorAll("button")]
      .find((button) => button.textContent?.replace(/\s+/g, " ").trim().includes(expected));
    if (!target) throw new Error(`Could not find button containing ${expected}`);
    target.click();
  }, text);
}
