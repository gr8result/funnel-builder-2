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
  results.push({ ...viewport, hasProductLibrary, hasFamilies, requiresLogin, consoleErrors });
  await page.close();
}
await browser.close();

console.log(JSON.stringify({ outDir, results }, null, 2));
if (results.some((result) => result.consoleErrors.length)) process.exitCode = 1;
if (results.every((result) => result.requiresLogin)) process.exitCode = 2;
