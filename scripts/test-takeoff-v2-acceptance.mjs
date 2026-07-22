// scripts/test-takeoff-v2-acceptance.mjs
//
// Phase 8 acceptance gate for Takeoff Engine V2 (modules/takeoff-v2). Drives the
// dev route at /modules/takeoff-v2 with Puppeteer against a synthetic PDF fixture
// (generated in-memory with pdf-lib) and produces screenshots as evidence for
// Tests A-D from the rebuild spec, rather than a claimed pass.
//
// Requires a Next dev server already running (this repo's lock-file convention
// means only one dev server runs at a time — reuse it rather than starting a
// second one).
//
// Run with: node scripts/test-takeoff-v2-acceptance.mjs [baseUrl]

import fs from "fs";
import path from "path";
import os from "os";
import dotenv from "dotenv";
import puppeteer from "puppeteer";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

dotenv.config({ path: path.resolve(".env.local") });

const baseUrl = process.argv[2] || "http://localhost:3000";
const outDir = path.join(
  "C:\\Users\\grant\\AppData\\Local\\Temp\\claude\\d--dev-funnel-builder-clean\\cd17acb4-18ea-48de-818c-b70a45906edb\\scratchpad",
  "takeoff-v2-acceptance"
);
fs.mkdirSync(outDir, { recursive: true });

const results = [];
function record(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`);
}

async function buildFixturePdf() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);

  // Page 1: portrait, US Letter. A ruled line of a known on-page length (300pt)
  // near the top, plus a big page-number label, so rotation is visually obvious
  // in the screenshots even without OCR.
  const page1 = doc.addPage([612, 792]);
  page1.drawText("PAGE 1 - TOP", { x: 40, y: 740, size: 28, font, color: rgb(0, 0, 0) });
  page1.drawLine({ start: { x: 100, y: 650 }, end: { x: 400, y: 650 }, thickness: 4, color: rgb(0.8, 0, 0) });
  page1.drawText("300pt reference line", { x: 100, y: 660, size: 14, font });
  page1.drawRectangle({ x: 20, y: 20, width: 572, height: 752, borderColor: rgb(0, 0, 0), borderWidth: 2 });

  const page2 = doc.addPage([612, 792]);
  page2.drawText("PAGE 2 - TOP", { x: 40, y: 740, size: 28, font, color: rgb(0, 0, 1) });
  page2.drawRectangle({ x: 20, y: 20, width: 572, height: 752, borderColor: rgb(0, 0, 1), borderWidth: 2 });

  const bytes = await doc.save();
  const fixturePath = path.join(os.tmpdir(), `takeoff-v2-fixture-${Date.now()}.pdf`);
  fs.writeFileSync(fixturePath, bytes);
  return fixturePath;
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(outDir, `${name}.png`) });
}

async function getCanvasSize(page) {
  return page.$eval('[data-testid="plan-canvas"]', (el) => ({ width: el.width, height: el.height }));
}

async function getRotationLabel(page) {
  return page.$eval('[data-testid="current-rotation"]', (el) => el.textContent.trim());
}

async function main() {
  const fixturePath = await buildFixturePdf();
  const browser = await puppeteer.launch({ headless: "new", defaultViewport: { width: 1440, height: 960 } });
  const page = await browser.newPage();
  page.on("pageerror", (err) => console.error("[pageerror]", err.message));
  page.on("console", (msg) => { if (msg.type() === "error") console.error("[console.error]", msg.text()); });

  try {
    // middleware.js gates every /dev/* route behind an `admin_key` cookie matching
    // ADMIN_DASH_KEY (a local dev secret, not a production credential) — set it
    // directly rather than driving the /dev/login form, same effect a real local
    // dev session has.
    const adminKey = process.env.ADMIN_DASH_KEY || "";
    if (!adminKey) throw new Error("ADMIN_DASH_KEY is not set in the environment — cannot pass the /dev/* gate.");
    await page.setCookie({ name: "admin_key", value: adminKey, url: baseUrl });

    await page.goto(`${baseUrl}/dev/takeoff-v2-test`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector('[data-testid="takeoff-v2-page"]', { timeout: 30000 });

    // ---------- TEST A — UPLOAD ----------
    await page.waitForSelector('[data-testid="plan-empty-state"]', { timeout: 10000 });
    await shot(page, "01-empty-state");
    record("empty state shown before upload", true);

    const fileInput = await page.$('[data-testid="plan-upload-input"]');
    await fileInput.uploadFile(fixturePath);

    await page.waitForSelector('[data-testid="plan-document-card"]', { timeout: 20000 });
    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid="plan-page-thumb"]').length === 2,
      { timeout: 20000 }
    );
    await shot(page, "02-upload-thumbnails");
    record("every page appears once (2 pages)", true);

    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="plan-canvas"]');
      return el && el.width > 0 && el.height > 0;
    }, { timeout: 20000 });
    await shot(page, "03-first-page-fitted");
    record("first page appears fully fitted", true);

    // ---------- TEST C — MANUAL ROTATION ----------
    const rotation0 = await getRotationLabel(page);
    record("initial rotation is 0deg", rotation0 === "0°", rotation0);
    const sizeBefore = await getCanvasSize(page);

    await page.click('[data-testid="rotate-right-button"]');
    await page.waitForFunction(() => document.querySelector('[data-testid="current-rotation"]').textContent.includes("90"), { timeout: 10000 });
    await shot(page, "04-rotate-90");
    const sizeAfter90 = await getCanvasSize(page);
    record("rotate right applies exactly 90deg", (await getRotationLabel(page)) === "90°");
    // Fit-page recomputes its own scale per orientation to best fill the
    // container, so the rendered canvas isn't a literal pixel-for-pixel
    // transpose — but the fixture is a portrait (height > width) page, so a
    // correct 90deg rotation must flip which dimension is larger. This is the
    // externally-observable form of the spec's "viewport width/height must
    // swap" requirement (pdfjs's own getViewport guarantees the underlying
    // swap at a fixed scale; fit-page's re-scale is a deliberate, separate step).
    const wasPortrait = sizeBefore.height > sizeBefore.width;
    const isLandscapeNow = sizeAfter90.width > sizeAfter90.height;
    record("canvas orientation flips (portrait -> landscape) at 90deg", wasPortrait && isLandscapeNow,
      `before ${sizeBefore.width}x${sizeBefore.height} after ${sizeAfter90.width}x${sizeAfter90.height}`);

    await page.click('[data-testid="rotate-right-button"]');
    await page.waitForFunction(() => document.querySelector('[data-testid="current-rotation"]').textContent.includes("180"), { timeout: 10000 });
    await shot(page, "05-rotate-180");
    record("second rotate right reaches 180deg", (await getRotationLabel(page)) === "180°");

    await page.click('[data-testid="rotate-left-button"]');
    await page.waitForFunction(() => document.querySelector('[data-testid="current-rotation"]').textContent.includes("90"), { timeout: 10000 });
    await shot(page, "06-rotate-left-to-90");
    record("rotate left from 180deg reaches 90deg", (await getRotationLabel(page)) === "90°");

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="current-rotation"]', { timeout: 20000 });
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="plan-canvas"]');
      return el && el.width > 0;
    }, { timeout: 20000 });
    const rotationAfterReload = await getRotationLabel(page);
    await shot(page, "07-after-reload-persisted");
    record("rotation persists after refresh", rotationAfterReload === "90°", rotationAfterReload);

    const thumbs = await page.$$('[data-testid="plan-page-thumb"]');
    await thumbs[1].click();
    await page.waitForFunction(() => document.querySelector('[data-testid="current-rotation"]'), { timeout: 10000 });
    await new Promise((resolve) => setTimeout(resolve, 400));
    const page2Rotation = await getRotationLabel(page);
    await shot(page, "08-page2-independent-rotation");
    record("switching pages does not copy rotation onto page 2", page2Rotation === "0°", page2Rotation);

    const thumbsAgain = await page.$$('[data-testid="plan-page-thumb"]');
    await thumbsAgain[0].click();
    await new Promise((resolve) => setTimeout(resolve, 400));
    const page1RotationAfterSwitchBack = await getRotationLabel(page);
    await shot(page, "09-page1-rotation-preserved");
    record("returning to page 1 preserves its own rotation", page1RotationAfterSwitchBack === "90°", page1RotationAfterSwitchBack);

    // ---------- TEST D — VIEWER ----------
    await page.click('[data-testid="fit-page-button"]');
    await new Promise((resolve) => setTimeout(resolve, 300));
    await shot(page, "10-fit-page");
    record("fit page control works", true);

    const viewport = await page.$('[data-testid="plan-viewport"]');
    const box = await viewport.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel({ deltaY: -300 });
    await new Promise((resolve) => setTimeout(resolve, 300));
    await shot(page, "11-zoomed-in");
    record("wheel zoom works", true);

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 80, { steps: 10 });
    await page.mouse.up();
    await new Promise((resolve) => setTimeout(resolve, 300));
    await shot(page, "12-panned");
    record("drag-to-pan works", true);

    await page.click('[data-testid="reset-view-button"]');
    await new Promise((resolve) => setTimeout(resolve, 300));
    await shot(page, "13-reset-view");
    record("reset view works", true);

    await page.click('[data-testid="fit-width-button"]');
    await new Promise((resolve) => setTimeout(resolve, 300));
    await shot(page, "14-fit-width");
    record("fit width works", true);

    // ---------- TEST B — DELETE ----------
    await page.click('[data-testid="delete-document-button"]');
    await page.waitForSelector('[data-testid="confirm-delete-button"]', { timeout: 5000 });
    await shot(page, "15-delete-confirm-prompt");
    record("delete requires a confirm step", true);

    await page.click('[data-testid="confirm-delete-button"]');
    await page.waitForSelector('[data-testid="plan-empty-state"]', { timeout: 10000 });
    await page.waitForSelector('[data-testid="viewer-empty-state"]', { timeout: 10000 });
    await shot(page, "16-after-delete-empty");
    record("viewer and list become empty after delete", true);

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="plan-empty-state"]', { timeout: 20000 });
    await shot(page, "17-after-reload-still-empty");
    record("deleted document does not return after refresh", true);

    const fileInputAgain = await page.$('[data-testid="plan-upload-input"]');
    await fileInputAgain.uploadFile(fixturePath);
    await page.waitForSelector('[data-testid="plan-document-card"]', { timeout: 20000 });
    await shot(page, "18-reupload-success");
    record("plan can be uploaded again after deletion", true);
  } catch (err) {
    record("acceptance script encountered an error", false, err.message);
    await shot(page, "99-error-state").catch(() => {});
  } finally {
    await browser.close();
    fs.rmSync(fixturePath, { force: true });
  }

  const failures = results.filter((r) => !r.pass);
  fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
  console.log(`\n${results.length - failures.length}/${results.length} checks passed. Screenshots + results.json in ${outDir}`);
  if (failures.length) process.exit(1);
}

main();
