import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import puppeteer from "puppeteer";

dotenv.config({ path: path.resolve(".env.local") });

const baseUrl = process.argv[2] || "http://localhost:3000";
const samplePath = process.env.TAKEOFF_SAMPLE_PLANS_PDF || "C:/Users/grant/Downloads/SAMPLES PLANS W DIMS.pdf";
const outDir = path.join("tmp", "takeoff-v2-first-wall");
fs.mkdirSync(outDir, { recursive: true });

function record(name, pass, detail = "") {
  console.log(`${pass ? "PASS" : "FAIL"} - ${name}${detail ? ` (${detail})` : ""}`);
  if (!pass) process.exitCode = 1;
}

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: false });
}

async function previewState(page) {
  return page.$eval('[data-testid="highlightable-wall-preview"]', (node) => {
    const line = node.querySelector("line");
    const box = line.getBoundingClientRect();
    return {
      id: node.getAttribute("data-wall-id"),
      x: box.left + box.width / 2,
      y: box.top + box.height / 2,
      width: box.width,
      height: box.height,
      length: Math.hypot(box.width, box.height),
      vertical: box.height > box.width,
      x1: Number(line.getAttribute("x1")),
      y1: Number(line.getAttribute("y1")),
      x2: Number(line.getAttribute("x2")),
      y2: Number(line.getAttribute("y2")),
    };
  }).catch(() => null);
}

async function moveAndReadPreview(page, x, y) {
  await page.mouse.move(x, y);
  await new Promise((resolve) => setTimeout(resolve, 35));
  return previewState(page);
}

async function highlightedState(page) {
  return page.$eval('[data-testid="highlighted-exterior-wall"]', (node) => {
    const line = node.querySelector("line");
    return {
      id: node.getAttribute("data-wall-id"),
      x1: Number(line.getAttribute("x1")),
      y1: Number(line.getAttribute("y1")),
      x2: Number(line.getAttribute("x2")),
      y2: Number(line.getAttribute("y2")),
      strokeWidth: Number(line.getAttribute("stroke-width") || line.getAttribute("strokeWidth") || 0),
    };
  }).catch(() => null);
}

async function findTopHorizontalPreview(page) {
  const rect = await page.$eval('[data-testid="plan-canvas"]', (canvas) => {
    const box = canvas.getBoundingClientRect();
    return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
  });
  const seen = new Set();
  for (let y = rect.top + 35; y < rect.bottom - 35; y += 18) {
    for (let x = rect.left + 35; x < rect.right - 35; x += 24) {
      const preview = await moveAndReadPreview(page, x, y);
      if (!preview?.id || seen.has(preview.id)) continue;
      seen.add(preview.id);
      if (!preview.vertical && preview.length > 90) return preview;
    }
  }
  return null;
}

async function injectScale(page) {
  await page.evaluate(() => {
    const pagesKey = Object.keys(localStorage).find((key) => key.startsWith("gr8:takeoff-v2:pages:"));
    const selectedKey = Object.keys(localStorage).find((key) => key.startsWith("gr8:takeoff-v2:selectedPage:"));
    if (!pagesKey || !selectedKey) throw new Error("Missing takeoff-v2 localStorage keys after upload.");
    const selectedPageId = JSON.parse(localStorage.getItem(selectedKey));
    const pages = JSON.parse(localStorage.getItem(pagesKey));
    const next = pages.map((planPage) => planPage.id === selectedPageId ? {
      ...planPage,
      orientationSource: "manual",
      orientationConfirmed: true,
      orientationConfidence: 100,
      calibration: {
        pageId: planPage.id,
        pointA: { x: 100, y: 100 },
        pointB: { x: 200, y: 100 },
        axis: "horizontal",
        actualLengthMm: 1000,
        documentDistance: 100,
        mmPerDocumentUnit: 10,
        snapA: { kind: "manual", lineId: null, lineIds: null },
        snapB: { kind: "manual", lineId: null, lineIds: null },
        confirmedAt: new Date().toISOString(),
      },
    } : planPage);
    localStorage.setItem(pagesKey, JSON.stringify(next));
  });
}

async function savedHighlightedWall(page) {
  return page.evaluate(() => {
    const pagesKey = Object.keys(localStorage).find((key) => key.startsWith("gr8:takeoff-v2:pages:"));
    const selectedKey = Object.keys(localStorage).find((key) => key.startsWith("gr8:takeoff-v2:selectedPage:"));
    const selectedPageId = JSON.parse(localStorage.getItem(selectedKey));
    const pages = JSON.parse(localStorage.getItem(pagesKey));
    const planPage = pages.find((candidate) => candidate.id === selectedPageId);
    return planPage?.exteriorHighlightedWalls?.[0] || null;
  });
}

function sameSegment(a, b) {
  if (!a || !b) return false;
  return Math.abs(a.x1 - b.x1) < 0.5 &&
    Math.abs(a.y1 - b.y1) < 0.5 &&
    Math.abs(a.x2 - b.x2) < 0.5 &&
    Math.abs(a.y2 - b.y2) < 0.5;
}

if (!fs.existsSync(samplePath)) {
  throw new Error(`Missing sample plan: ${samplePath}`);
}

const browser = await puppeteer.launch({ headless: "new", defaultViewport: { width: 1600, height: 1400 }, args: ["--no-sandbox"] });
const page = await browser.newPage();
page.on("pageerror", (err) => console.error("[pageerror]", err.message));
page.on("console", (msg) => { if (msg.type() === "error") console.error("[console.error]", msg.text()); });

try {
  const adminKey = process.env.ADMIN_DASH_KEY || "";
  if (adminKey) await page.setCookie({ name: "admin_key", value: adminKey, url: baseUrl });

  await page.goto(`${baseUrl}/dev/takeoff-v2-test`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.evaluate(() => {
    Object.keys(localStorage)
      .filter((key) => key.startsWith("gr8:takeoff-v2:"))
      .forEach((key) => localStorage.removeItem(key));
    localStorage.setItem("takeoffHighlighterDebug", "1");
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="takeoff-v2-page"]', { timeout: 30000 });

  const fileInput = await page.$('[data-testid="plan-upload-input"]');
  await fileInput.uploadFile(samplePath);
  await page.waitForSelector('[data-testid="plan-canvas"]', { timeout: 30000 });
  await injectScale(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="plan-canvas"]', { timeout: 30000 });
  await page.click('[data-testid="fit-page-button"]');
  await new Promise((resolve) => setTimeout(resolve, 3000));

  await page.click('[data-testid="tool-exterior-highlighter"]');
  record("global detected-wall overlay is not rendered", await page.$$eval('[data-testid="detected-wall-object"]', (nodes) => nodes.length) === 0);

  const topFamilyWall = await findTopHorizontalPreview(page);
  record("top horizontal structural wall preview found", Boolean(topFamilyWall), topFamilyWall ? JSON.stringify({ id: topFamilyWall.id, x: topFamilyWall.x, y: topFamilyWall.y, length: Math.round(topFamilyWall.length) }) : "");
  if (!topFamilyWall) throw new Error("No top horizontal structural wall preview found.");

  await moveAndReadPreview(page, topFamilyWall.x, topFamilyWall.y);
  await page.waitForSelector('[data-testid="exterior-highlighter-debug-overlay"]', { timeout: 10000 });
  await screenshot(page, "01-top-wall-local-debug");

  const dimensionProbe = { x: topFamilyWall.x, y: topFamilyWall.y - 26 };
  const dimensionPreview = await moveAndReadPreview(page, dimensionProbe.x, dimensionProbe.y);
  await screenshot(page, "02-dimension-chain-rejected");
  record("top dimension chain does not preview", !dimensionPreview);

  await page.evaluate(() => localStorage.removeItem("takeoffHighlighterDebug"));
  const hover = await moveAndReadPreview(page, topFamilyWall.x, topFamilyWall.y);
  await screenshot(page, "03-correct-wall-hover-preview");
  record("correct wall previews before click", Boolean(hover?.id));

  await page.mouse.click(topFamilyWall.x, topFamilyWall.y);
  await page.waitForSelector('[data-testid="highlighted-exterior-wall"]', { timeout: 10000 });
  const selected = await highlightedState(page);
  await screenshot(page, "04-correct-wall-highlighted");
  record("clicked selection matches hover preview", sameSegment(hover, selected), JSON.stringify({ hover, selected }));
  record("highlight remains thin", selected?.strokeWidth <= 3, JSON.stringify(selected));

  const saved = await savedHighlightedWall(page);
  record("saved wall has structural endpoints", Boolean(saved?.centreline?.start && saved?.centreline?.end), JSON.stringify(saved?.centreline || null));

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="plan-canvas"]', { timeout: 30000 });
  await page.click('[data-testid="tool-exterior-highlighter"]');
  await page.waitForSelector('[data-testid="highlighted-exterior-wall"]', { timeout: 10000 });
  const persisted = await highlightedState(page);
  await screenshot(page, "05-correct-wall-after-refresh");
  record("correct wall persists after refresh", sameSegment(selected, persisted), JSON.stringify({ selected, persisted }));
} finally {
  await browser.close();
}
