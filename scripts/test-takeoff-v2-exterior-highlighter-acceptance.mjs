import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import puppeteer from "puppeteer";

dotenv.config({ path: path.resolve(".env.local") });

const baseUrl = process.argv[2] || "http://localhost:3000";
const samplePath = process.env.TAKEOFF_SAMPLE_PLANS_PDF || "C:/Users/grant/Downloads/SAMPLES PLANS W DIMS.pdf";
const outDir = path.join("tmp", "takeoff-v2-exterior-highlighter");
fs.mkdirSync(outDir, { recursive: true });

function record(name, pass, detail = "") {
  console.log(`${pass ? "PASS" : "FAIL"} - ${name}${detail ? ` (${detail})` : ""}`);
  if (!pass) process.exitCode = 1;
}

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: false });
}

async function highlightedCount(page) {
  return page.$$eval('[data-testid="highlighted-exterior-wall"]', (nodes) => nodes.length);
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
    };
  }).catch(() => null);
}

async function moveAndReadPreview(page, x, y) {
  await page.mouse.move(x, y);
  await new Promise((resolve) => setTimeout(resolve, 25));
  return previewState(page);
}

async function scanVisiblePreviews(page) {
  const rect = await page.$eval('[data-testid="plan-canvas"]', (canvas) => {
    const box = canvas.getBoundingClientRect();
    return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
  });
  const byId = new Map();
  for (let y = rect.top + 40; y < rect.bottom - 40; y += 18) {
    for (let x = rect.left + 40; x < rect.right - 40; x += 18) {
      const preview = await moveAndReadPreview(page, x, y);
      if (!preview?.id || byId.has(preview.id)) continue;
      byId.set(preview.id, preview);
    }
  }
  return [...byId.values()];
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

async function savedState(page) {
  return page.evaluate(() => {
    const pagesKey = Object.keys(localStorage).find((key) => key.startsWith("gr8:takeoff-v2:pages:"));
    const selectedKey = Object.keys(localStorage).find((key) => key.startsWith("gr8:takeoff-v2:selectedPage:"));
    const selectedPageId = JSON.parse(localStorage.getItem(selectedKey));
    const pages = JSON.parse(localStorage.getItem(pagesKey));
    const planPage = pages.find((candidate) => candidate.id === selectedPageId);
    return {
      highlightedWalls: planPage?.exteriorHighlightedWalls?.length || 0,
      highlightedWallIds: planPage?.exteriorHighlightedWallIds?.length || 0,
      exteriorGenerated: Boolean(planPage?.exteriorWalls),
    };
  });
}

async function clickPreview(page, preview) {
  await page.mouse.move(preview.x, preview.y);
  await new Promise((resolve) => setTimeout(resolve, 80));
  await page.mouse.click(preview.x, preview.y);
}

function chooseTargets(previews) {
  const usable = previews.filter((preview) => preview.length > 80);
  const vertical = usable.filter((preview) => preview.vertical);
  const horizontal = usable.filter((preview) => !preview.vertical);
  return {
    right: vertical.toSorted((a, b) => b.x - a.x)[0],
    alfresco: horizontal.toSorted((a, b) => a.y - b.y)[0],
    garage: vertical.toSorted((a, b) => a.x - b.x)[0],
    studyReturn: usable.toSorted((a, b) => a.length - b.length)[0],
  };
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

  const previews = await scanVisiblePreviews(page);
  record("sample plan exposes local hoverable wall bands", previews.length >= 4, `${previews.length} unique previews`);
  const targets = chooseTargets(previews);
  record("required wall targets found", Boolean(targets.right && targets.alfresco && targets.garage && targets.studyReturn));
  if (!targets.right || !targets.alfresco || !targets.garage || !targets.studyReturn) {
    await screenshot(page, "00-no-local-wall-previews-found");
    throw new Error(`Only found ${previews.length} local wall preview(s).`);
  }

  await moveAndReadPreview(page, targets.right.x, targets.right.y);
  await screenshot(page, "01-right-wall-hover-full-length");
  record("right-hand wall hover shows one preview", await page.$$eval('[data-testid="highlightable-wall-preview"]', (nodes) => nodes.length) === 1);
  await clickPreview(page, targets.right);
  await screenshot(page, "02-right-wall-highlighted");
  record("right-hand wall click highlights one wall", await highlightedCount(page) === 1);
  await clickPreview(page, targets.right);
  record("clicking same preview toggles it off", await highlightedCount(page) === 0);
  await clickPreview(page, targets.right);

  await clickPreview(page, targets.alfresco);
  await screenshot(page, "03-alfresco-wall-highlighted");
  await clickPreview(page, targets.garage);
  await screenshot(page, "04-garage-wall-highlighted");
  await clickPreview(page, targets.studyReturn);
  record("repeat clicks add independent highlighted walls", await highlightedCount(page) >= 3);

  const beforeRejectClicks = await highlightedCount(page);
  const canvasRect = await page.$eval('[data-testid="plan-canvas"]', (canvas) => {
    const box = canvas.getBoundingClientRect();
    return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
  });
  await page.mouse.move(canvasRect.left + canvasRect.width * 0.5, canvasRect.top + 25);
  await page.mouse.click(canvasRect.left + canvasRect.width * 0.5, canvasRect.top + 25);
  await screenshot(page, "05-dimension-line-rejected");
  await page.mouse.move(canvasRect.right - 60, canvasRect.bottom - 60);
  await page.mouse.click(canvasRect.right - 60, canvasRect.bottom - 60);
  await screenshot(page, "06-title-block-line-rejected");
  record("dimension/title-block clicks do not add highlights", await highlightedCount(page) === beforeRejectClicks);

  await page.click('[data-testid="tool-finish-exterior"]');
  await page.waitForFunction(() => {
    const msg = document.querySelector('[data-testid="wall-detection-message"]')?.textContent || "";
    return msg.includes("Exterior generation will be enabled after full-wall selection is reliable.");
  }, { timeout: 10000 });
  const finalState = await savedState(page);
  record("highlight state persists in page storage", finalState.highlightedWalls >= 3 && finalState.highlightedWalls === finalState.highlightedWallIds, JSON.stringify(finalState));
  record("finish exterior does not generate a polygon", finalState.exteriorGenerated === false, JSON.stringify(finalState));
} finally {
  await browser.close();
}
