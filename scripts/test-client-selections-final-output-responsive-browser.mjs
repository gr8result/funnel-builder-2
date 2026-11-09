import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import puppeteer from "puppeteer";
import { createClient } from "@supabase/supabase-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local"), quiet: true });
dotenv.config({ path: path.join(root, ".env"), quiet: true });

const arg = (name, fallback = "") => process.argv.find((item) => item.startsWith(`--${name}=`))?.split("=").slice(1).join("=") || fallback;
const origin = arg("origin", process.env.CLIENT_SELECTIONS_BASE_URL || "http://localhost:3000");
const jobFile = path.resolve(arg("job", process.env.CLIENT_SELECTIONS_RESPONSIVE_JOB || ""));
assert(jobFile && fs.existsSync(jobFile), "Pass --job=<corrected .gr8job>.");

const out = path.join(root, "artifacts", "test-results", "client-selections-final-output-responsive");
fs.mkdirSync(out, { recursive: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
assert(supabaseUrl && anonKey && serviceKey, "Existing test authentication requires Supabase environment values.");

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const { data: link, error: linkError } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email: process.env.PRODUCT_LIBRARY_TEST_EMAIL || "support@gr8result.com",
});
if (linkError) throw linkError;
const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
const { data: auth, error: authError } = await authClient.auth.verifyOtp({
  type: "magiclink",
  token_hash: link.properties.hashed_token,
});
if (authError) throw authError;

const browser = await puppeteer.launch({
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  protocolTimeout: 900000,
  defaultViewport: { width: 1920, height: 1080 },
});
const page = await browser.newPage();
page.setDefaultTimeout(300000);
const report = { jobFile, origin, cases: [], blockedWrites: 0, runtimeErrors: [] };
page.on("pageerror", (error) => report.runtimeErrors.push(error.message));
page.on("dialog", (dialog) => dialog.accept());
await page.setRequestInterception(true);
page.on("request", (request) => {
  const write = !["GET", "HEAD", "OPTIONS"].includes(request.method());
  const target = new URL(request.url());
  if (write && (/\/(rest|storage)\/v1\//.test(target.pathname) || target.pathname.startsWith("/api/"))) {
    report.blockedWrites += 1;
    void request.respond({ status: 200, contentType: "application/json", body: "{}" });
    return;
  }
  void request.continue();
});
await page.evaluateOnNewDocument(({ key, session }) => {
  localStorage.setItem(key, JSON.stringify(session));
}, {
  key: `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`,
  session: auth.session,
});

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
async function clickButton(label) {
  return page.evaluate((text) => {
    const button = [...document.querySelectorAll("button")].find((candidate) => !candidate.disabled && candidate.offsetParent && candidate.innerText.trim() === text);
    button?.click();
    return Boolean(button);
  }, label);
}

async function openCorrectedJob() {
  await page.goto(`${origin}/modules/estimate-builder?page=clientSelections`, { waitUntil: "domcontentloaded", timeout: 600000 });
  const input = await page.waitForSelector('[data-testid="open-local-job-file-input"]', { timeout: 600000 });
  await input.uploadFile(jobFile);
  for (let attempt = 0; attempt < 80; attempt += 1) {
    await delay(750);
    for (const label of ["Discard Changes", "Open Job", "Open Job File", "Keep Local"]) await clickButton(label);
    if (await page.$('[data-testid="guided-client-selections-home"]')) break;
  }
  await page.waitForSelector('[data-testid="guided-client-selections-home"]', { timeout: 600000 });
  assert(await clickButton("Review Schedule"), "Review Schedule button is available.");
  await page.waitForSelector(".contractSchedulePanel", { timeout: 300000 });
  await page.waitForFunction(() => document.querySelector('[data-testid="schedule-reconciliation"]')?.textContent?.includes("saved selection records represented"), { timeout: 300000 });
}

async function inspectLayout(physicalWidth, zoom) {
  const cssWidth = Math.floor(physicalWidth / zoom);
  const cssHeight = Math.floor(1000 / zoom);
  const client = await page.target().createCDPSession();
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: cssWidth,
    height: cssHeight,
    deviceScaleFactor: zoom,
    mobile: false,
    screenWidth: physicalWidth,
    screenHeight: 1000,
  });
  await delay(400);
  await page.$eval(".contractSchedulePanel", (element) => element.scrollIntoView({ block: "start" }));
  await delay(200);
  const result = await page.$eval(".contractSchedulePanel", (panel) => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" && element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0;
    };
    const rectangle = (element) => {
      const box = element.getBoundingClientRect();
      return { top: box.top, right: box.right, bottom: box.bottom, left: box.left, width: box.width, height: box.height };
    };
    const overlaps = (first, second) => Math.min(first.right, second.right) - Math.max(first.left, second.left) > 1
      && Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top) > 1;
    const direct = [...panel.children].filter(visible);
    const directBoxes = direct.map((element) => ({ name: element.className || element.tagName, box: rectangle(element) }));
    const directOverlaps = [];
    for (let first = 0; first < directBoxes.length; first += 1) {
      for (let second = first + 1; second < directBoxes.length; second += 1) {
        if (overlaps(directBoxes[first].box, directBoxes[second].box)) directOverlaps.push([directBoxes[first].name, directBoxes[second].name]);
      }
    }
    const metrics = [...panel.querySelectorAll(".scheduleReviewStats > div")].filter(visible);
    const metricBoxes = metrics.map(rectangle);
    const metricOverlaps = [];
    for (let first = 0; first < metricBoxes.length; first += 1) {
      for (let second = first + 1; second < metricBoxes.length; second += 1) {
        if (overlaps(metricBoxes[first], metricBoxes[second])) metricOverlaps.push([first, second]);
      }
    }
    const buttons = [...panel.querySelectorAll(".scheduleIssueActions button")].filter(visible);
    const buttonBoxes = buttons.map(rectangle);
    const buttonOverlaps = [];
    for (let first = 0; first < buttonBoxes.length; first += 1) {
      for (let second = first + 1; second < buttonBoxes.length; second += 1) {
        if (overlaps(buttonBoxes[first], buttonBoxes[second])) buttonOverlaps.push([first, second]);
      }
    }
    const descendants = [...panel.querySelectorAll("h2, p, dt, dd, strong, span, button")].filter(visible);
    const clipped = descendants.filter((element) => element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1)
      .map((element) => ({ tag: element.tagName, className: element.className, text: element.textContent.trim().slice(0, 100), client: [element.clientWidth, element.clientHeight], scroll: [element.scrollWidth, element.scrollHeight] }));
    const panelBox = rectangle(panel);
    const outside = [...metrics, ...buttons].filter((element) => {
      const box = rectangle(element);
      return box.left < panelBox.left - 1 || box.right > panelBox.right + 1;
    }).map((element) => element.textContent.trim().slice(0, 80));
    const labels = metrics.map((metric) => ({
      value: metric.querySelector("dd")?.textContent.trim() || "",
      label: metric.querySelector("dt")?.textContent.trim() || "",
    }));
    return {
      viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
      panel: panelBox,
      directOverlaps,
      metricOverlaps,
      buttonOverlaps,
      clipped,
      outside,
      labels,
      actionLabels: buttons.map((button) => button.getAttribute("aria-label") || ""),
    };
  });
  const focusable = await page.$$eval(".scheduleIssueActions button:not([disabled])", (buttons) => buttons.every((button) => {
    button.focus();
    return document.activeElement === button;
  }));
  const shot = path.join(out, `final-output-${physicalWidth}px-${Math.round(zoom * 100)}pct.png`);
  await page.$eval(".contractSchedulePanel", (element) => element.scrollIntoView({ block: "start" }));
  await page.screenshot({ path: shot });
  await client.detach();
  return { physicalWidth, zoom, cssWidth, shot, focusable, ...result };
}

try {
  await openCorrectedJob();
  for (const physicalWidth of [1366, 1600, 1920]) {
    for (const zoom of [1, 1.25, 1.5]) {
      const result = await inspectLayout(physicalWidth, zoom);
      report.cases.push(result);
      assert.deepEqual(result.directOverlaps, [], `${physicalWidth}px at ${zoom * 100}%: panel sections overlap`);
      assert.deepEqual(result.metricOverlaps, [], `${physicalWidth}px at ${zoom * 100}%: metrics overlap`);
      assert.deepEqual(result.buttonOverlaps, [], `${physicalWidth}px at ${zoom * 100}%: buttons overlap`);
      assert.deepEqual(result.clipped, [], `${physicalWidth}px at ${zoom * 100}%: text is clipped`);
      assert.deepEqual(result.outside, [], `${physicalWidth}px at ${zoom * 100}%: controls escape the panel`);
      assert.equal(result.labels.length, 5, `${physicalWidth}px at ${zoom * 100}%: five metrics are present`);
      assert(result.labels.every((item) => item.value && item.label), `${physicalWidth}px at ${zoom * 100}%: every metric has a label and value`);
      assert(result.actionLabels.every(Boolean), `${physicalWidth}px at ${zoom * 100}%: every action has an accessible label`);
      assert.equal(result.focusable, true, `${physicalWidth}px at ${zoom * 100}%: enabled actions are keyboard focusable`);
    }
  }
  assert.equal(report.runtimeErrors.length, 0, report.runtimeErrors.join("\n"));
  report.passed = true;
  console.log(`PASS Final Output is readable at ${report.cases.length} viewport/zoom combinations.`);
} finally {
  fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
