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

const exteriorTypes = ["Bricks", "Cladding", "Render", "Roof", "Roof Colour", "Windows", "Entry Door", "Garage Door", "Gutters", "Fascia", "Lighting", "Driveway", "Decking", "Balustrades", "Pool", "Exterior Paint"];
const interiorRooms = ["Kitchen", "Bathroom", "Ensuite", "Laundry", "Bedrooms", "Living Areas", "Media", "Study", "Garage"];
const kitchenTypes = ["Cabinetry", "Cabinet Finish", "Handles", "Benchtops", "Splashback", "Sink", "Sink Mixer", "Oven", "Cooktop", "Rangehood", "Dishwasher", "Microwave", "Lighting", "Flooring", "Paint"];

async function firstButton(page, label) {
  return page.getByRole("button", { name: label }).first();
}

async function verifyBackground(locator, label) {
  const background = await locator.evaluate((node) => window.getComputedStyle(node).backgroundImage);
  if (!background || background === "none") throw new Error(`${label} tile has no image background.`);
}

async function assertVisibleCards(page, labels, contextLabel) {
  const failures = [];
  for (const label of labels) {
    try {
      const button = await firstButton(page, label);
      await button.waitFor({ timeout: 10000 });
      await verifyBackground(button.locator(".visual-tile-image"), `${contextLabel} / ${label}`);
    } catch (error) {
      failures.push(`${contextLabel} / ${label}: ${error.message}`);
    }
  }
  return failures;
}

async function verifyTerminalCategory(page, label, expectedKey, parentLabel, forbiddenText) {
  const button = await firstButton(page, label);
  await verifyBackground(button.locator(".visual-tile-image"), `${parentLabel} / ${label}`);
  const categoryKey = await button.getAttribute("data-category-key");
  const areaKey = await button.getAttribute("data-area-key");
  if (categoryKey !== expectedKey) throw new Error(`${label} opened with category key ${categoryKey || "(missing)"}.`);
  if (!areaKey) throw new Error(`${label} tile is missing area context.`);
  await button.click();
  await page.waitForTimeout(150);
  const bodyText = await page.locator("body").innerText();
  const useful = bodyText.includes(`No ${label} products have been imported yet.`)
    || bodyText.includes("Import Products")
    || bodyText.includes("Add Product")
    || (await page.locator(".product-card").count()) > 0;
  if (!useful) throw new Error(`${label} did not show products or a category-specific empty state.`);
  for (const forbidden of forbiddenText) {
    if (bodyText.includes(forbidden)) throw new Error(`${label} leaked ${forbidden} content.`);
  }
  await firstButton(page, `Back to ${parentLabel}`).click();
  await firstButton(page, label).waitFor({ timeout: 10000 });
}

async function clickEveryTile(page) {
  const failures = [];
  await assertVisibleCards(page, ["Exterior", "Interior"], "Choose Area").then((items) => failures.push(...items));

  await firstButton(page, "Exterior").click();
  await assertVisibleCards(page, exteriorTypes, "Exterior").then((items) => failures.push(...items));
  try {
    await verifyTerminalCategory(page, "Garage Door", "garage-door", "Exterior", ["Bricks", "Mortar"]);
  } catch (error) {
    failures.push(`Exterior / Garage Door: ${error.message}`);
  }
  await firstButton(page, "Back to Choose Area").click();

  await firstButton(page, "Interior").click();
  await assertVisibleCards(page, interiorRooms, "Interior").then((items) => failures.push(...items));
  await firstButton(page, "Kitchen").click();
  await assertVisibleCards(page, kitchenTypes, "Kitchen").then((items) => failures.push(...items));
  try {
    await verifyTerminalCategory(page, "Oven", "oven", "Kitchen", ["Master Bedroom"]);
  } catch (error) {
    failures.push(`Kitchen / Oven: ${error.message}`);
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
  const hasFamilies = ["Exterior", "Interior"].every((label) => text.includes(label));
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
