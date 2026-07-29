// scripts/test-takeoff-v2-exterior-tracing-acceptance.mjs
//
// Acceptance walkthrough for THIS session's exterior-wall-tracing-and-area
// work: the rewritten toolbar (Select/Pan/Set Scale/Auto Detect
// Exterior/Draw Exterior/Edit Exterior/Delete Segment/Close Shape/Clear
// Exterior/Area Tool/Undo/Redo), Draw Exterior + Close Shape, Clear Exterior
// with confirm, Create Area From Exterior Walls (external footprint
// readout), manual Area Tool tracing + its confirm dialog, ResultsPanel, and
// the Pan tool. Distinct from the older
// test-takeoff-v2-scale-walls-area-acceptance.mjs script, which predates
// this session's toolbar rewrite and uses stale test-ids/status text.
//
// Requires a Next dev server already running (npm run dev).
// Run with: node scripts/test-takeoff-v2-exterior-tracing-acceptance.mjs [baseUrl]

import fs from "fs";
import path from "path";
import os from "os";
import dotenv from "dotenv";
import puppeteer from "puppeteer";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

dotenv.config({ path: path.resolve(".env.local") });

const baseUrl = process.argv[2] || "http://localhost:3000";
const outDir = path.join(
  "C:\\Users\\grant\\AppData\\Local\\Temp\\claude\\d--dev-funnel-builder-clean\\f6d0d120-c0e0-4c78-85c6-82420a41782b\\scratchpad",
  "takeoff-v2-exterior-tracing-acceptance"
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
  const page1 = doc.addPage([612, 792]);
  page1.drawText("PAGE 1", { x: 40, y: 740, size: 28, font, color: rgb(0, 0, 0) });
  // Reference line near the top of the page (PDF y-up) — used only for Set
  // Scale. The wall-drawing rectangle below is clicked in the lower half of
  // the viewport, well clear of this line and the border, so nothing here
  // interferes with those raw/manual clicks.
  page1.drawLine({ start: { x: 100, y: 650 }, end: { x: 400, y: 650 }, thickness: 4, color: rgb(0.8, 0, 0) });
  page1.drawRectangle({ x: 20, y: 20, width: 572, height: 752, borderColor: rgb(0, 0, 0), borderWidth: 2 });
  const bytes = await doc.save();
  const fixturePath = path.join(os.tmpdir(), `takeoff-v2-tracing-fixture-${Date.now()}.pdf`);
  fs.writeFileSync(fixturePath, bytes);
  return fixturePath;
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(outDir, `${name}.png`) });
}

async function textOf(page, testId) {
  const el = await page.$(`[data-testid="${testId}"]`);
  if (!el) return null;
  return page.evaluate((node) => node.textContent.trim(), el);
}

async function exists(page, testId) {
  return Boolean(await page.$(`[data-testid="${testId}"]`));
}

async function main() {
  const fixturePath = await buildFixturePdf();
  const browser = await puppeteer.launch({ headless: "new", defaultViewport: { width: 1440, height: 960 } });
  const page = await browser.newPage();
  page.on("pageerror", (err) => console.error("[pageerror]", err.message));
  page.on("console", (msg) => { if (msg.type() === "error") console.error("[console.error]", msg.text()); });

  try {
    const adminKey = process.env.ADMIN_DASH_KEY || "";
    if (!adminKey) throw new Error("ADMIN_DASH_KEY is not set in the environment — cannot pass the /dev/* gate.");
    await page.setCookie({ name: "admin_key", value: adminKey, url: baseUrl });

    await page.goto(`${baseUrl}/dev/takeoff-v2-test`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector('[data-testid="takeoff-v2-page"]', { timeout: 30000 });

    const fileInput = await page.$('[data-testid="plan-upload-input"]');
    await fileInput.uploadFile(fixturePath);
    await page.waitForSelector('[data-testid="plan-document-card"]', { timeout: 20000 });
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="plan-canvas"]');
      return el && el.width > 0 && el.height > 0;
    }, { timeout: 20000 });
    await shot(page, "01-uploaded");

    // ---------- Exact required toolbar, all flat (no submenu) ----------
    const requiredToolIds = [
      "tool-select", "tool-pan", "tool-set-scale", "tool-detect-exterior",
      "tool-draw-exterior", "tool-edit-exterior", "tool-delete-segment",
      "tool-close-shape", "tool-clear-exterior", "tool-area", "tool-undo", "tool-redo",
    ];
    for (const id of requiredToolIds) {
      record(`toolbar button present: ${id}`, await exists(page, id));
    }

    // ---------- Set Scale ----------
    const viewportBox = await (await page.$('[data-testid="plan-viewport"]')).boundingBox();
    const scaleA = { x: viewportBox.x + viewportBox.width * 0.3, y: viewportBox.y + viewportBox.height * 0.5 };
    const scaleB = { x: viewportBox.x + viewportBox.width * 0.65, y: viewportBox.y + viewportBox.height * 0.5 };

    await page.click('[data-testid="tool-set-scale"]');
    // Neither click lands exactly on the fixture's real reference line, so
    // Place Manually must be enabled first — mandatory snapping otherwise
    // rejects a raw click outright (see takeoff/planSnap.js / resolvePlacement).
    await page.click('[data-testid="place-manually-toggle"]');
    await page.mouse.click(scaleA.x, scaleA.y);
    await page.mouse.click(scaleB.x, scaleB.y);
    await page.waitForSelector('[data-testid="scale-calibration-dialog"]', { timeout: 5000 });
    const distanceInput = await page.$('[data-testid="calibration-distance-input"]');
    await distanceInput.click({ clickCount: 3 });
    await distanceInput.type("6000");
    await page.click('[data-testid="calibration-confirm"]');
    await page.waitForFunction(
      () => document.querySelector('[data-testid="scale-status"]')?.textContent.includes("Calibrated"),
      { timeout: 5000 }
    );
    record("scale calibrated", (await textOf(page, "scale-status")).includes("Calibrated"));
    await shot(page, "02-scale-confirmed");

    // ---------- Draw Exterior: click a rectangle, then Close Shape ----------
    await page.click('[data-testid="tool-draw-exterior"]');
    const rect = {
      x0: viewportBox.x + viewportBox.width * 0.25, y0: viewportBox.y + viewportBox.height * 0.68,
      x1: viewportBox.x + viewportBox.width * 0.7, y1: viewportBox.y + viewportBox.height * 0.92,
    };
    const corners = [
      { x: rect.x0, y: rect.y0 },
      { x: rect.x1, y: rect.y0 },
      { x: rect.x1, y: rect.y1 },
      { x: rect.x0, y: rect.y1 },
    ];
    for (const corner of corners) {
      await page.mouse.click(corner.x, corner.y);
    }
    await shot(page, "03-exterior-traced-open");

    const vertexCountAfterTrace = await page.$$eval('[data-testid="wall-vertex"]', (els) => els.length).catch(() => 0);
    // wall-vertex dots only render in edit-walls/exterior-wall tool modes for
    // the graph being edited — while still in Draw Exterior they render too
    // (see TakeoffCanvasOverlay.jsx), so 4 is expected here.
    record("four corners placed while drawing", vertexCountAfterTrace === 4, `count=${vertexCountAfterTrace}`);

    const closeShapeDisabledBeforeReady = await page.$eval('[data-testid="tool-close-shape"]', (el) => el.disabled);
    record("Close Shape enabled once >=3 vertices with an open 2-endpoint chain", closeShapeDisabledBeforeReady === false);

    await page.click('[data-testid="tool-close-shape"]');
    await page.waitForFunction(
      () => document.querySelector('[data-testid="close-shape-success"]')?.textContent.includes("Exterior perimeter closed"),
      { timeout: 5000 }
    ).catch(() => {});
    record("Close Shape success message shown", (await textOf(page, "close-shape-success")) === "Exterior perimeter closed");
    await shot(page, "04-exterior-closed");

    const wallStatusAfterClose = await textOf(page, "wall-status");
    record("wall-status reports Closed", (wallStatusAfterClose || "").includes("Closed"), wallStatusAfterClose);

    // ---------- Confirm Exterior Walls ----------
    const confirmWallsDisabled = await page.$eval('[data-testid="tool-confirm-walls"]', (el) => el.disabled).catch(() => true);
    record("Confirm Exterior Walls enabled after closing a valid perimeter", confirmWallsDisabled === false);
    await page.click('[data-testid="tool-confirm-walls"]');
    await page.waitForFunction(
      () => document.querySelector('[data-testid="wall-status"]')?.textContent.includes("confirmed"),
      { timeout: 5000 }
    );
    record("exterior walls confirmed", (await textOf(page, "wall-status")).includes("confirmed"));

    // ---------- Create Area From Exterior Walls (Method A) ----------
    await page.click('[data-testid="tool-area"]');
    await page.waitForSelector('[data-testid="area-from-exterior"]', { timeout: 5000 });
    await page.click('[data-testid="area-from-exterior"]');
    await page.waitForSelector('[data-testid="area-confirm-dialog"]', { timeout: 5000 });
    const footprintText = await textOf(page, "area-external-footprint");
    record("area dialog shows an external footprint figure", /External footprint: [\d.]+ m/.test(footprintText || ""), footprintText);
    await shot(page, "05-area-confirm-dialog");
    await page.click('[data-testid="area-accept"]');
    await page.waitForSelector('[data-testid="area-status"]', { timeout: 5000 });
    record("area confirmed and shown in toolbar", await exists(page, "area-status"));

    // ---------- ResultsPanel reflects both ----------
    record("results panel present", await exists(page, "results-panel"));
    const resultsText = await page.$eval('[data-testid="results-panel"]', (el) => el.textContent);
    record("results panel shows exterior wall segment/perimeter info", /Segments:/.test(resultsText) && /Perimeter:/.test(resultsText));
    record("results panel lists the confirmed area", await exists(page, "results-area-row"));
    await shot(page, "06-results-panel");

    // ---------- Manual Area Tool (Method B) ----------
    await page.click('[data-testid="tool-select"]');
    await page.click('[data-testid="tool-area"]');
    const triangle = [
      { x: viewportBox.x + viewportBox.width * 0.1, y: viewportBox.y + viewportBox.height * 0.15 },
      { x: viewportBox.x + viewportBox.width * 0.18, y: viewportBox.y + viewportBox.height * 0.15 },
      { x: viewportBox.x + viewportBox.width * 0.14, y: viewportBox.y + viewportBox.height * 0.25 },
    ];
    for (const point of triangle) await page.mouse.click(point.x, point.y);
    await page.click('[data-testid="area-finish-trace"]');
    await page.waitForSelector('[data-testid="manual-area-confirm-dialog"]', { timeout: 5000 });
    const manualReadout = await textOf(page, "manual-area-readout");
    record("manual area dialog shows a calculated area", /Calculated area: [\d.]+ m/.test(manualReadout || ""), manualReadout);
    await shot(page, "07-manual-area-dialog");
    await page.click('[data-testid="manual-area-accept"]');
    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid="results-area-row"]').length >= 2,
      { timeout: 5000 }
    );
    record("second (manually traced) area appears in results panel", true);

    // ---------- Persistence across reload ----------
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="takeoff-v2-page"]', { timeout: 30000 });
    await page.waitForSelector('[data-testid="results-panel"]', { timeout: 20000 });
    const wallStatusAfterReload = await textOf(page, "wall-status");
    record("exterior walls confirmed state persists across reload", (wallStatusAfterReload || "").includes("confirmed"), wallStatusAfterReload);
    const areaRowsAfterReload = await page.$$eval('[data-testid="results-area-row"]', (els) => els.length);
    record("both areas persist across reload", areaRowsAfterReload === 2, `count=${areaRowsAfterReload}`);
    const resultsTextAfterReload = await page.$eval('[data-testid="results-panel"]', (el) => el.textContent);
    record("external footprint / internal floor area figures persist across reload", /Internal floor area: 16.25/.test(resultsTextAfterReload), resultsTextAfterReload);
    await shot(page, "10-after-reload");
    // Layout may have shifted slightly after reload (banners etc.) — refetch
    // rather than trust the pre-reload box for subsequent coordinate math.
    Object.assign(viewportBox, await (await page.$('[data-testid="plan-viewport"]')).boundingBox());

    // ---------- Clear Exterior (with confirm) ----------
    await page.click('[data-testid="tool-select"]');
    await page.click('[data-testid="tool-clear-exterior"]');
    await page.waitForSelector('[data-testid="clear-exterior-confirm"]', { timeout: 5000 });
    await page.click('[data-testid="clear-exterior-confirm-cancel"]');
    record("Cancel leaves exterior walls intact", await exists(page, "wall-status"));
    await page.click('[data-testid="tool-clear-exterior"]');
    await page.waitForSelector('[data-testid="clear-exterior-confirm"]', { timeout: 5000 });
    await page.click('[data-testid="clear-exterior-confirm-yes"]');
    await page.waitForFunction(
      () => !document.querySelector('[data-testid="wall-status"]'),
      { timeout: 5000 }
    );
    record("Clear Exterior removes the exterior perimeter after confirming", !(await exists(page, "wall-status")));
    await shot(page, "08-cleared");

    // ---------- Undo restores it ----------
    await page.click('[data-testid="tool-undo"]');
    await page.waitForSelector('[data-testid="wall-status"]', { timeout: 5000 });
    record("Undo restores the cleared exterior perimeter", await exists(page, "wall-status"));

    // ---------- Pan tool doesn't fire click-tool side effects ----------
    await page.click('[data-testid="tool-pan"]');
    const areaRowsBeforePan = await page.$$eval('[data-testid="results-area-row"]', (els) => els.length);
    await page.mouse.move(viewportBox.x + viewportBox.width * 0.5, viewportBox.y + viewportBox.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(viewportBox.x + viewportBox.width * 0.6, viewportBox.y + viewportBox.height * 0.6, { steps: 5 });
    await page.mouse.up();
    const areaRowsAfterPan = await page.$$eval('[data-testid="results-area-row"]', (els) => els.length);
    record("Pan tool drag does not create a new area (no click side effects)", areaRowsBeforePan === areaRowsAfterPan);
    await shot(page, "09-after-pan");
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.pass);
  fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length > 0) {
    console.error(`${failed.length} FAILED:`, failed.map((f) => f.name));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
