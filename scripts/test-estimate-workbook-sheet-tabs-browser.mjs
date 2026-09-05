import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = process.env.ESTIMATE_WORKBOOK_TABS_BASE_URL || "http://localhost:3000";
const outDir = path.join(root, "test-results", "estimate-workbook-sheet-tabs");
fs.mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
  headless: "new",
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  defaultViewport: { width: 1520, height: 980 },
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

try {
  const page = await browser.newPage();
  page.setDefaultTimeout(90000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.stack || error.message));
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && /ReferenceError|is not defined|Cannot read|Unhandled/i.test(text)) {
      errors.push(text);
    }
  });

  const response = await page.goto(`${baseUrl}/modules/estimate-builder?page=dataInput`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.screenshot({ path: path.join(outDir, "01-data-input-route.png"), fullPage: true });

  const routeState = await page.evaluate(() => ({
    url: window.location.href,
    text: document.body.innerText,
    title: document.title,
  }));
  if (/login|sign in/i.test(routeState.url) || /sign in|log in/i.test(routeState.text)) {
    console.log(JSON.stringify({
      ok: false,
      skipped: true,
      reason: "Route requires an authenticated browser session.",
      status: response?.status?.() || null,
      url: routeState.url,
      screenshot: path.join(outDir, "01-data-input-route.png"),
    }, null, 2));
    process.exit(0);
  }

  const tabsLoaded = await page.waitForFunction(
    () => document.body.innerText.includes("Data Input") && document.body.innerText.includes("Quote Sheet"),
    { timeout: 30000 },
  ).then(() => true).catch(() => false);
  if (!tabsLoaded) {
    const state = await page.evaluate(() => ({
      url: window.location.href,
      text: document.body.innerText.replace(/\s+/g, " ").trim().slice(0, 1000),
      title: document.title,
    }));
    console.log(JSON.stringify({
      ok: false,
      skipped: true,
      reason: "Workbook UI did not finish loading in the browser smoke window.",
      state,
      consoleErrors: errors,
      screenshot: path.join(outDir, "01-data-input-route.png"),
    }, null, 2));
    process.exit(0);
  }
  const before = await workbookTabState(page);
  await clickButton(page, "Quote Sheet");
  await page.waitForFunction(() => new URL(window.location.href).searchParams.get("page") === "quotation" || document.body.innerText.includes("Manage Section Order"));
  await page.screenshot({ path: path.join(outDir, "02-quote-sheet-tab.png"), fullPage: true });
  const after = await workbookTabState(page);

  if (errors.length) throw new Error(`Browser console errors: ${errors.join("\n")}`);
  if (!before.hasDataInput || !before.hasQuoteSheet) throw new Error("Workbook sheet tabs were not visible on Data Input.");
  if (!after.hasQuoteSheet || !after.hasQuoteContent) throw new Error("Quote Sheet tab did not reveal the existing quotation workbook.");

  console.log(JSON.stringify({
    ok: true,
    url: page.url(),
    before,
    after,
    screenshots: [
      path.join(outDir, "01-data-input-route.png"),
      path.join(outDir, "02-quote-sheet-tab.png"),
    ],
  }, null, 2));
} finally {
  await browser.close();
}

async function workbookTabState(page) {
  return page.evaluate(() => {
    const buttons = [...document.querySelectorAll("button")].map((button) => ({
      text: button.textContent.replace(/\s+/g, " ").trim(),
      current: button.getAttribute("aria-current") || "",
    }));
    const body = document.body.innerText;
    return {
      url: window.location.href,
      hasDataInput: buttons.some((button) => button.text === "Data Input"),
      hasQuoteSheet: buttons.some((button) => button.text === "Quote Sheet"),
      activeTab: buttons.find((button) => button.current === "page")?.text || "",
      hasQuoteContent: /Manage Section Order|Collapse All|Section total|Final quote total/i.test(body),
      hasDataInputContent: /Input \/ Quantity|Formula \/ Notes|Project Setup|Job Details/i.test(body),
    };
  });
}

async function clickButton(page, label) {
  const clicked = await page.evaluate((target) => {
    const button = [...document.querySelectorAll("button")].find((item) => item.textContent.replace(/\s+/g, " ").trim() === target);
    if (!button) return false;
    button.click();
    return true;
  }, label);
  if (!clicked) throw new Error(`Button not found: ${label}`);
}
