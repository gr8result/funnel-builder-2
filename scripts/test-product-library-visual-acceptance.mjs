import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.PRODUCT_LIBRARY_BASE_URL || "http://127.0.0.1:3000";
const outDir = path.join(process.cwd(), "tmp", "product-library-visual-acceptance");
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const viewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "tablet", width: 900, height: 1100 },
  { name: "mobile", width: 390, height: 900 },
];

const areas = [
  { label: "Exterior", types: ["Bricks", "Cladding", "Render", "Roof", "Roof Colour", "Windows", "Entry Doors", "Garage Doors", "Gutters", "Fascia", "Lighting", "Driveway", "Decking", "Balustrades", "Pool", "Exterior Paint"] },
  { label: "Interior", types: ["Internal Doors", "Door Hardware", "Skirting", "Architraves", "Robes", "Kitchen", "Bathroom", "Ensuite", "Laundry", "Bedrooms", "Living Areas", "Media", "Study", "Garage"] },
  { label: "Kitchen", types: ["Stone Benchtops", "Ovens", "Cooktops", "Rangehoods", "Dishwashers", "Sinks", "Mixers", "Cabinetry", "Benchtops", "Splashbacks"] },
  { label: "Bathroom", types: ["Vanities", "Basins", "Mixers", "Mirrors", "Showers", "Baths", "Toilets", "Tiles", "Accessories"] },
  { label: "Bedroom", types: ["Carpet", "Hybrid Flooring", "Internal Doors", "Handles", "Robe Fitouts", "Window Furnishings", "Paint", "Lighting"] },
  { label: "Laundry", types: ["Cabinetry", "Benchtops", "Laundry Tubs", "Mixers", "Splashbacks", "Flooring"] },
  { label: "Garage", types: ["Garage Doors", "Garage Door Motors", "Internal Access Doors", "Floor Finish", "Storage"] },
  { label: "Outdoor", types: ["Alfresco Flooring", "Patio Flooring", "Balcony Flooring", "Decking", "Balustrades", "Handrails", "Outdoor Kitchen", "External Fans", "External Lighting"] },
  { label: "Pool", types: ["Pool Interior Finish", "Coping", "Waterline Tiles", "Pool Fencing", "Gates", "Lighting", "Equipment"] },
];

async function firstButton(page, label) {
  return page.getByRole("button", { name: label }).first();
}

async function verifyBackground(locator, label) {
  const background = await locator.evaluate((node) => window.getComputedStyle(node).backgroundImage);
  if (!background || background === "none") throw new Error(`${label} tile has no image background.`);
}

async function clickEveryTile(page) {
  const failures = [];
  for (const area of areas) {
    try {
      const areaButton = await firstButton(page, area.label);
      await verifyBackground(areaButton.locator(".visual-tile-image"), area.label);
      await areaButton.click();
      await page.getByRole("heading", { name: area.types[0] }).or(page.getByRole("button", { name: area.types[0] })).first().waitFor({ timeout: 10000 });
      for (const type of area.types) {
        try {
          const typeButton = await firstButton(page, type);
          await verifyBackground(typeButton.locator(".visual-tile-image"), `${area.label} / ${type}`);
          await typeButton.click();
          await page.waitForTimeout(100);
          const bodyText = await page.locator("body").innerText();
          const useful = bodyText.includes("No products have been imported for this category.")
            || bodyText.includes("Import Products")
            || bodyText.includes("Add Product")
            || (await page.locator(".product-card").count()) > 0;
          if (!useful) throw new Error(`${area.label} / ${type} did not show products or the empty-state actions.`);
          await firstButton(page, `Back to ${area.label}`).click();
          await firstButton(page, type).waitFor({ timeout: 10000 });
        } catch (error) {
          failures.push(`${area.label} / ${type}: ${error.message}`);
          await page.goto(`${baseUrl}/modules/builders/product-library?tab=selections`, { waitUntil: "networkidle", timeout: 90000 });
          await firstButton(page, area.label).click().catch(() => {});
        }
      }
      await firstButton(page, "Back to Areas").click();
      await firstButton(page, area.label).waitFor({ timeout: 10000 });
    } catch (error) {
      failures.push(`${area.label}: ${error.message}`);
      await page.goto(`${baseUrl}/modules/builders/product-library?tab=selections`, { waitUntil: "networkidle", timeout: 90000 });
    }
  }
  return failures;
}

const results = [];
for (const viewport of viewports) {
  const page = await browser.newPage({ viewport });
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  await page.goto(`${baseUrl}/modules/builders/product-library?tab=selections`, { waitUntil: "networkidle", timeout: 90000 });
  await page.screenshot({ path: path.join(outDir, `${viewport.name}.png`), fullPage: true });
  const text = await page.locator("body").innerText({ timeout: 10000 }).catch(() => "");
  const hasProductLibrary = text.includes("Product Library");
  const hasFamilies = ["Exterior", "Kitchen", "Interior"].every((label) => text.includes(label));
  const requiresLogin = /log in|login|sign in/i.test(text) && !hasProductLibrary;
  const tileFailures = hasProductLibrary && viewport.name === "desktop" ? await clickEveryTile(page) : [];
  results.push({ ...viewport, hasProductLibrary, hasFamilies, requiresLogin, consoleErrors, tileFailures });
  await page.close();
}
await browser.close();

console.log(JSON.stringify({ outDir, results }, null, 2));
if (results.some((result) => result.consoleErrors.length)) process.exitCode = 1;
if (results.some((result) => result.tileFailures?.length)) process.exitCode = 1;
if (results.every((result) => result.requiresLogin)) process.exitCode = 2;
