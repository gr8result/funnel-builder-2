import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import puppeteer from "puppeteer";

const baseUrl = process.env.CLIENT_SELECTIONS_BASE_URL || "http://localhost:3000";
const outDir = path.resolve("test-results", "beacon-outdoor-catalogue");
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
  page.on("dialog", async (dialog) => dialog.accept());

  await page.goto(`${baseUrl}/modules/builders/client-selections`, { waitUntil: "networkidle2" });
  await page.evaluate(() => window.localStorage.removeItem("clientSelections.demoSelections.v1"));
  await page.reload({ waitUntil: "networkidle2" });
  await clickButtonContaining(page, "Exterior");
  await page.waitForSelector('[data-testid="showroom-exterior-categories"]');
  await page.waitForFunction(() => {
    const image = document.querySelector('[data-requirement-key="external-lighting"] img');
    return image?.complete && image.naturalWidth > 0;
  });
  await page.screenshot({ path: path.join(outDir, "01-external-lighting-dashboard-card.png"), fullPage: true });

  const dashboardImageState = await page.evaluate(() => {
    const card = document.querySelector('[data-requirement-key="external-lighting"]');
    const image = card?.querySelector("img");
    return {
      text: card?.textContent?.replace(/\s+/g, " ").trim() || "",
      src: image?.getAttribute("src") || "",
      alt: image?.getAttribute("alt") || "",
      complete: Boolean(image?.complete && image?.naturalWidth > 0),
    };
  });
  assert.match(dashboardImageState.text, /External Lighting/);
  assert.match(dashboardImageState.src, /external-lighting-dashboard-modern-entrance\.webp/);
  assert.equal(dashboardImageState.alt, "Exterior wall lighting illuminating a modern residential entrance");
  assert.equal(dashboardImageState.complete, true, "External Lighting dashboard image must load");

  await clickButtonContaining(page, "External Lighting");
  await page.waitForSelector('[data-testid="showroom-external-lighting-product-grid"]');
  await page.waitForFunction(() => [...document.querySelectorAll(".lightingProductCard img")].slice(0, 4).every((image) => image.complete && image.naturalWidth > 0));
  await page.screenshot({ path: path.join(outDir, "02-external-lighting-category-page.png"), fullPage: true });

  const initialState = await page.evaluate(() => ({
    text: document.body.innerText,
    categoryButtons: [...document.querySelectorAll(".lightingCategoryGrid button")].map((button) => button.textContent?.replace(/\s+/g, " ").trim()),
    productCards: document.querySelectorAll(".lightingProductCard").length,
    officialImages: [...document.querySelectorAll(".lightingProductCard img")].every((image) => image.src.includes("beaconlighting.com.au/media/catalog/product/") && image.complete && image.naturalWidth > 0),
  }));

  assert.match(initialState.text, /Beacon outdoor lighting schedule/);
  assert.ok(initialState.categoryButtons.some((text) => /Wall Lights/.test(text)), "Wall Lights category must render");
  assert.ok(initialState.categoryButtons.some((text) => /Security & Sensor/.test(text)), "Security & Sensor category must render");
  assert.ok(initialState.categoryButtons.some((text) => /Floodlights/.test(text)), "Floodlights category must render");
  assert.ok(initialState.productCards > 3, "External Lighting must render the rebuilt Beacon catalogue, not three products");
  assert.equal(initialState.officialImages, true, "Rendered product cards must use official Beacon images");
  assert.doesNotMatch(initialState.text, /table lamp|builder configurable|Brilliant Lighting/i);
  assert.doesNotMatch(initialState.text, /Next Selection/i, "External Lighting save must not expose auto-open next selection behaviour");

  await searchCurrentCategory(page, "2303181");
  await page.waitForFunction(() => document.body.innerText.includes("Sentinel 2 Light Wall Bracket"));
  assert.equal(await productCardCount(page), 1, "Searching SKU 2303181 should show exactly one Beacon product");
  await clickProductAction(page, "Add to Lighting Schedule");
  await page.waitForSelector('[data-testid="external-lighting-location-assignment"]');
  await clickButtonContaining(page, "+");
  await clickButtonContaining(page, "Add to Schedule");
  await page.waitForFunction(() => /1 product \/ 2 fittings/.test(document.body.innerText));

  await clickButtonContaining(page, "Security & Sensor");
  await searchCurrentCategory(page, "2409230");
  await page.waitForFunction(() => document.body.innerText.includes("Ledlux Field 20w LED Exterior Flood Light With Sensor"));
  assert.equal(await productCardCount(page), 1, "Searching SKU 2409230 should show exactly one Beacon sensor spotlight");
  await clickProductAction(page, "Add to Lighting Schedule");
  await page.waitForSelector('[data-testid="external-lighting-location-assignment"]');
  await clickButtonContaining(page, "Add to Schedule");
  await page.waitForFunction(() => /2 products \/ 3 fittings/.test(document.body.innerText));
  await page.screenshot({ path: path.join(outDir, "03-external-lighting-two-line-schedule.png"), fullPage: true });

  const scheduleState = await page.evaluate(() => ({
    text: document.body.innerText,
    lines: document.querySelectorAll(".lightingScheduleLine").length,
    points: [...document.querySelectorAll(".lightingScheduleLine small")].map((node) => node.textContent || "").join(" "),
  }));
  assert.equal(scheduleState.lines, 2, "Schedule must keep wall lights and sensor spotlight as separate lines");
  assert.match(scheduleState.text, /3 fittings/);
  assert.match(scheduleState.points, /EL01 Front entry, left side/);
  assert.match(scheduleState.points, /EL02 Front entry, right side/);
  assert.match(scheduleState.points, /EL03 Garage exterior/);

  await clickButtonContaining(page, "Save Progress");
  await page.reload({ waitUntil: "networkidle2" });
  await clickButtonContaining(page, "Exterior");
  await clickButtonContaining(page, "External Lighting");
  await page.waitForSelector('[data-testid="external-lighting-selected-schedule"]');
  await page.waitForFunction(() => /2 products \/ 3 fittings/.test(document.body.innerText));
  await page.screenshot({ path: path.join(outDir, "04-external-lighting-after-refresh.png"), fullPage: true });

  await clickFirstScheduleButton(page, "Edit");
  await page.waitForSelector('[data-testid="external-lighting-location-assignment"]');
  await clickButtonContaining(page, "+");
  await clickButtonContaining(page, "Add to Schedule");
  await page.waitForFunction(() => /2 products \/ 4 fittings/.test(document.body.innerText));

  await clickLastScheduleButton(page, "Remove");
  await page.waitForFunction(() => document.querySelectorAll(".lightingScheduleLine").length === 1);
  await clickButtonContaining(page, "Security & Sensor");
  await searchCurrentCategory(page, "2409230");
  await clickProductAction(page, "Add to Lighting Schedule");
  await page.waitForSelector('[data-testid="external-lighting-location-assignment"]');
  await clickButtonContaining(page, "Add to Schedule");
  await page.waitForFunction(() => /2 products \/ 4 fittings/.test(document.body.innerText));
  await page.screenshot({ path: path.join(outDir, "05-external-lighting-edited-readded.png"), fullPage: true });

  await clickButtonContaining(page, "Confirm External Lighting");
  await page.waitForSelector('[data-testid="showroom-exterior-categories"]');
  const dashboardState = await page.evaluate(() => ({
    returnedDashboard: document.body.innerText.includes("Choose a selection category"),
    stillOpen: Boolean(document.querySelector('[data-testid="showroom-external-lighting-product-grid"]')),
    lightingCardText: [...document.querySelectorAll('[data-requirement-key="external-lighting"]')]
      .map((card) => card.textContent?.replace(/\s+/g, " ").trim())
      .find(Boolean) || "",
  }));
  assert.equal(dashboardState.returnedDashboard, true, "Confirm should return to the Exterior dashboard");
  assert.equal(dashboardState.stillOpen, false, "External Lighting save must not auto-open another category");
  assert.match(dashboardState.lightingCardText, /4 fittings selected/);
  await page.screenshot({ path: path.join(outDir, "06-external-lighting-return-dashboard.png"), fullPage: true });

  await page.setViewport({ width: 390, height: 900 });
  await page.screenshot({ path: path.join(outDir, "07-external-lighting-mobile-dashboard.png"), fullPage: true });

  console.log(`Beacon External Lighting browser test passed. Screenshots saved to ${outDir}`);
} finally {
  await browser.close();
}

async function clickButtonContaining(page, text) {
  await page.evaluate((expected) => {
    const target = [...document.querySelectorAll("button")]
      .find((button) => button.textContent?.replace(/\s+/g, " ").trim().includes(expected));
    if (!target) throw new Error(`Could not find button containing ${expected}`);
    target.click();
  }, text);
}

async function clickProductAction(page, text) {
  await page.evaluate((expected) => {
    const target = [...document.querySelectorAll(".lightingProductCard button")]
      .find((button) => button.textContent?.replace(/\s+/g, " ").trim().includes(expected));
    if (!target) throw new Error(`Could not find product action containing ${expected}`);
    target.click();
  }, text);
}

async function clickFirstScheduleButton(page, text) {
  await page.evaluate((expected) => {
    const firstLine = document.querySelector(".lightingScheduleLine");
    const target = [...(firstLine?.querySelectorAll("button") || [])]
      .find((button) => button.textContent?.replace(/\s+/g, " ").trim().includes(expected));
    if (!target) throw new Error(`Could not find first schedule button containing ${expected}`);
    target.click();
  }, text);
}

async function clickLastScheduleButton(page, text) {
  await page.evaluate((expected) => {
    const lines = [...document.querySelectorAll(".lightingScheduleLine")];
    const lastLine = lines.at(-1);
    const target = [...(lastLine?.querySelectorAll("button") || [])]
      .find((button) => button.textContent?.replace(/\s+/g, " ").trim().includes(expected));
    if (!target) throw new Error(`Could not find last schedule button containing ${expected}`);
    target.click();
  }, text);
}

async function searchCurrentCategory(page, term) {
  await page.click(".lightingFilters input");
  await page.keyboard.down("Control");
  await page.keyboard.press("A");
  await page.keyboard.up("Control");
  await page.keyboard.type(term);
}

async function productCardCount(page) {
  return page.evaluate(() => document.querySelectorAll(".lightingProductCard").length);
}
