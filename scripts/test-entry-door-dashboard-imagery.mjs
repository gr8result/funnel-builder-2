import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import puppeteer from "puppeteer";

const baseUrl = process.env.CLIENT_SELECTIONS_BASE_URL || "http://localhost:3000";
const outDir = path.resolve("test-results", "entry-door-dashboard-imagery");
const dashboardImage = "/images/product-library/entry-doors/entry-doors-dashboard-contemporary.webp";
const sunburstImage = "/images/product-library/entry-doors/entry-doors-sunburst-lifestyle.jpg";
const garageDashboardImage = "/images/product-library/garage-doors/garage-doors-modern-flatline.webp";
fs.mkdirSync(outDir, { recursive: true });

for (const asset of [dashboardImage, sunburstImage, garageDashboardImage]) {
  assert.ok(fs.existsSync(path.resolve("public", asset.replace(/^\//, ""))), `${asset} must exist in public assets`);
}

const catalogue = JSON.parse(fs.readFileSync("data/product-library/catalogues/exterior/AU-WINDOWS-ENTRY-DOORS-GARAGE-DOORS-CATALOGUE.json", "utf8"));
const entryDoorProducts = catalogue.products.filter((product) => (product.family_key || product.familyKey) === "entry-doors");
const lifestyleLeaks = entryDoorProducts.filter((product) => new RegExp(`${dashboardImage}|${sunburstImage}|${garageDashboardImage}|Downloads|blob:`, "i").test(JSON.stringify(product)));
assert.deepEqual(lifestyleLeaks, [], "Lifestyle dashboard images must not replace exact entry-door product images");
const garageDoorProducts = catalogue.products.filter((product) => (product.family_key || product.familyKey) === "garage-doors");
const garageDashboardLeaks = garageDoorProducts.filter((product) => JSON.stringify(product).includes(garageDashboardImage));
assert.deepEqual(garageDashboardLeaks, [], "Garage dashboard image must not replace exact garage-door product images");

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
  await assertDashboardCard(page, {
    label: "Entry Doors",
    expectedImage: dashboardImage,
    expectedAlt: "Contemporary timber entry door installed in a modern brick home",
  });
  await assertDashboardCard(page, {
    label: "Garage Doors",
    expectedImage: garageDashboardImage,
    expectedAlt: "Modern black flatline sectional garage door installed on a contemporary home",
  });
  await page.screenshot({ path: path.join(outDir, "entry-doors-category-desktop.png"), fullPage: true });

  await page.setViewport({ width: 390, height: 920 });
  await page.reload({ waitUntil: "networkidle2" });
  await clickButtonContaining(page, "Exterior");
  await page.waitForSelector('[data-testid="showroom-exterior-categories"]');
  await assertDashboardCard(page, {
    label: "Entry Doors",
    expectedImage: dashboardImage,
    expectedAlt: "Contemporary timber entry door installed in a modern brick home",
  });
  await assertDashboardCard(page, {
    label: "Garage Doors",
    expectedImage: garageDashboardImage,
    expectedAlt: "Modern black flatline sectional garage door installed on a contemporary home",
  });
  await page.screenshot({ path: path.join(outDir, "entry-doors-category-mobile.png"), fullPage: true });

  console.log(`Exterior Doors dashboard imagery test passed. Screenshots saved to ${outDir}`);
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

async function assertDashboardCard(page, { label, expectedImage, expectedAlt }) {
  await page.waitForFunction(({ label }) => {
    const button = [...document.querySelectorAll("button")]
      .find((item) => item.textContent?.replace(/\s+/g, " ").trim().includes(label));
    const image = button?.querySelector("img");
    return Boolean(image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
  }, {}, { label });
  const card = await page.evaluate(({ expectedImage, label }) => {
    const button = [...document.querySelectorAll("button")]
      .find((item) => item.textContent?.replace(/\s+/g, " ").trim().includes(label));
    const image = button?.querySelector("img");
    if (!button || !image) return null;
    const styles = getComputedStyle(image);
    return {
      src: image.getAttribute("src") || "",
      alt: image.getAttribute("alt") || "",
      objectFit: styles.objectFit,
      objectPosition: styles.objectPosition,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      titleVisible: button.textContent.includes(label),
      matchesExpected: image.getAttribute("src") === expectedImage,
    };
  }, { expectedImage, label });
  assert.ok(card, `${label} category card must render an image`);
  assert.equal(card.matchesExpected, true, `${label} category card must use the managed dashboard image`);
  assert.equal(card.alt, expectedAlt);
  assert.equal(card.objectFit, "cover");
  assert.ok(card.naturalWidth > 0 && card.naturalHeight > 0, `${label} dashboard image must load`);
  assert.equal(card.titleVisible, true, `${label} title must remain visible over the image`);
}
