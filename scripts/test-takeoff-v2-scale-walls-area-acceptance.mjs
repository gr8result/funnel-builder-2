// scripts/test-takeoff-v2-scale-walls-area-acceptance.mjs
//
// Acceptance walkthrough for the Set Scale / Measure Length / Detect & Confirm
// Exterior Walls / Confirm Area restoration on Takeoff Engine V2
// (modules/takeoff-v2). Drives the dev route with Puppeteer against the same
// pdf-lib synthetic fixture used by scripts/test-takeoff-v2-acceptance.mjs.
//
// Two things are intentionally deterministic rather than pixel-perfect:
//  - Scale calibration uses two arbitrary (but fixed) screen points and a
//    known input distance (6000mm), then re-measures the *same* two points —
//    this is self-consistent regardless of the exact pdf.js viewport math, so
//    the test never has to reimplement that math to predict an expected value.
//  - Exterior walls are seeded directly into the page's persisted record
//    (matching modules/takeoff-v2/persistence/planStore.js's storage key
//    format) rather than relying on a live GPT-4o call against a fixture that
//    isn't a real floor plan — Detect Exterior Walls is still exercised once
//    against the real endpoint to prove it doesn't crash and reports honestly
//    whether or not OPENAI_API_KEY is configured, but the deterministic
//    edit/confirm-walls/confirm-area flow that follows uses the seeded data.
//
// Requires a Next dev server already running (npm run dev).
// Run with: node scripts/test-takeoff-v2-scale-walls-area-acceptance.mjs [baseUrl]

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
  "takeoff-v2-scale-walls-area-acceptance"
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
  page1.drawText("PAGE 1 - TOP", { x: 40, y: 740, size: 28, font, color: rgb(0, 0, 0) });
  page1.drawLine({ start: { x: 100, y: 650 }, end: { x: 400, y: 650 }, thickness: 4, color: rgb(0.8, 0, 0) });
  page1.drawText("300pt reference line", { x: 100, y: 660, size: 14, font });
  page1.drawRectangle({ x: 20, y: 20, width: 572, height: 752, borderColor: rgb(0, 0, 0), borderWidth: 2 });
  const bytes = await doc.save();
  const fixturePath = path.join(os.tmpdir(), `takeoff-v2-swa-fixture-${Date.now()}.pdf`);
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

async function isDisabled(page, testId) {
  return page.$eval(`[data-testid="${testId}"]`, (el) => el.disabled);
}

// The viewport container can shift by a few pixels as the toolbar grows
// (Recalibrate/Clear Scale buttons, status text) after calibration — so the
// click points must be recomputed fresh from the *current* bounding box each
// time, not reused from a box captured earlier in the walkthrough.
async function getReferencePoints(page) {
  const box = await (await page.$('[data-testid="plan-viewport"]')).boundingBox();
  return {
    box,
    pointA: { x: box.x + box.width * 0.3, y: box.y + box.height * 0.5 },
    pointB: { x: box.x + box.width * 0.65, y: box.y + box.height * 0.5 },
  };
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

    // ---------- Toolbar is present and not hidden in a menu ----------
    const toolIds = [
      "tool-select", "tool-set-scale", "tool-measure-length", "tool-detect-walls",
      "tool-edit-walls", "tool-confirm-walls", "tool-confirm-area",
      "tool-clear-measurements", "tool-undo",
    ];
    for (const id of toolIds) {
      const el = await page.$(`[data-testid="${id}"]`);
      record(`toolbar button visible: ${id}`, Boolean(el));
    }

    // ---------- Gating before calibration ----------
    record("Measure Length disabled before scale is set", await isDisabled(page, "tool-measure-length"));
    record("Detect Exterior Walls disabled before scale is set", await isDisabled(page, "tool-detect-walls"));
    record("Confirm Exterior Walls disabled before scale is set", await isDisabled(page, "tool-confirm-walls"));
    record("Confirm Area disabled before scale is set", await isDisabled(page, "tool-confirm-area"));
    const scaleStatusBefore = await textOf(page, "scale-status");
    record("scale status reads 'Not set' before calibration", scaleStatusBefore === "Scale: Not set", scaleStatusBefore);

    // ---------- Set Scale: two-point calibration ----------
    let { pointA, pointB, box: viewportBox } = await getReferencePoints(page);

    await page.click('[data-testid="tool-set-scale"]');
    await page.mouse.click(pointA.x, pointA.y);
    await page.mouse.click(pointB.x, pointB.y);
    await page.waitForSelector('[data-testid="scale-calibration-dialog"]', { timeout: 5000 });
    await shot(page, "02-calibration-dialog");

    const distanceInput = await page.$('[data-testid="calibration-distance-input"]');
    await distanceInput.click({ clickCount: 3 });
    await distanceInput.type("6000");
    await page.click('[data-testid="calibration-confirm"]');
    await page.waitForFunction(
      () => document.querySelector('[data-testid="scale-status"]')?.textContent.includes("Calibrated"),
      { timeout: 5000 }
    );
    const scaleStatusAfter = await textOf(page, "scale-status");
    record("scale confirmed with 6000mm reference", scaleStatusAfter === "Scale: Calibrated — 6000 mm reference", scaleStatusAfter);
    await shot(page, "03-scale-confirmed");

    // ---------- Measure Length on the exact calibration segment ~= 6.00 m ----------
    // Note on tolerance: this measurement comes from a *second*, independent
    // Puppeteer mouse click sequence at the same on-screen position as the
    // calibration clicks — sub-pixel rounding in real browser event dispatch
    // (not present in the exact, non-browser scaleCalibration.test.mjs unit
    // test, which proves the underlying math is precise to 1e-6) means it
    // will not be bit-for-bit identical to the calibration input. A 1%
    // tolerance comfortably covers that automation jitter while still failing
    // on any real unit/scale bug (e.g. an off-by-1000 or off-by-2 error).
    function metersFrom(text) {
      const match = /^([\d.]+) m$/.exec(text || "");
      return match ? Number(match[1]) : NaN;
    }
    function closeToSixMetres(text) {
      const value = metersFrom(text);
      return Number.isFinite(value) && Math.abs(value - 6) / 6 < 0.01;
    }

    record("Measure Length enabled after calibration", !(await isDisabled(page, "tool-measure-length")));
    ({ pointA, pointB, box: viewportBox } = await getReferencePoints(page));
    await page.click('[data-testid="tool-measure-length"]');
    await page.mouse.click(pointA.x, pointA.y);
    await page.mouse.click(pointB.x, pointB.y);
    await page.waitForSelector('[data-testid="measurement-line"]', { timeout: 5000 });
    let measurementText = await textOf(page, "measurement-line");
    record("measuring the calibration segment reports ~6.00 m", closeToSixMetres(measurementText), measurementText);
    await shot(page, "04-measured");

    // ---------- Undo removes the measurement, then re-add it ----------
    await page.click('[data-testid="tool-undo"]');
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="measurement-line"]').length === 0, { timeout: 5000 });
    record("Undo removes the last measurement", true);

    ({ pointA, pointB, box: viewportBox } = await getReferencePoints(page));
    await page.click('[data-testid="tool-measure-length"]');
    await page.mouse.click(pointA.x, pointA.y);
    await page.mouse.click(pointB.x, pointB.y);
    await page.waitForSelector('[data-testid="measurement-line"]', { timeout: 5000 });
    measurementText = await textOf(page, "measurement-line");
    record("measurement re-created after undo reports ~6.00 m", closeToSixMetres(measurementText), measurementText);

    // ---------- Zoom + pan must not change the *stored* measurement's display ----------
    // (No new clicks happen here — this re-reads the same persisted measurement
    // record, so it must be byte-identical, not just within tolerance.)
    await page.click('[data-testid="tool-select"]');
    await page.mouse.move(viewportBox.x + viewportBox.width / 2, viewportBox.y + viewportBox.height / 2);
    await page.mouse.wheel({ deltaY: -300 });
    await new Promise((resolve) => setTimeout(resolve, 250));
    await page.mouse.down();
    await page.mouse.move(viewportBox.x + viewportBox.width / 2 + 80, viewportBox.y + viewportBox.height / 2 + 40, { steps: 8 });
    await page.mouse.up();
    await new Promise((resolve) => setTimeout(resolve, 250));
    const measurementAfterZoomPan = await textOf(page, "measurement-line");
    const scaleAfterZoomPan = await textOf(page, "scale-status");
    record("stored measurement text unchanged after zoom+pan", measurementAfterZoomPan === measurementText, measurementAfterZoomPan);
    record("scale status unchanged after zoom+pan", scaleAfterZoomPan === scaleStatusAfter, scaleAfterZoomPan);
    await shot(page, "05-after-zoom-pan");

    // ---------- Rotation must not change the *stored* measurement's display ----------
    await page.click('[data-testid="rotate-right-button"]');
    await page.waitForFunction(() => document.querySelector('[data-testid="current-rotation"]').textContent.includes("90"), { timeout: 10000 });
    await new Promise((resolve) => setTimeout(resolve, 250));
    const measurementAfterRotate = await textOf(page, "measurement-line");
    const scaleAfterRotate = await textOf(page, "scale-status");
    record("stored measurement text unchanged after 90deg rotation", measurementAfterRotate === measurementText, measurementAfterRotate);
    record("scale status unchanged after 90deg rotation", scaleAfterRotate === scaleStatusAfter, scaleAfterRotate);
    await shot(page, "06-after-rotation");

    await page.click('[data-testid="reset-rotation-button"]');
    await page.waitForFunction(() => document.querySelector('[data-testid="current-rotation"]').textContent.includes("0"), { timeout: 10000 });
    await page.click('[data-testid="fit-page-button"]');
    await new Promise((resolve) => setTimeout(resolve, 250));

    // ---------- Detect Exterior Walls: exercised for real, honestly reported ----------
    await page.click('[data-testid="tool-detect-walls"]');
    await page.waitForFunction(
      () => {
        const status = document.querySelector('[data-testid="wall-status"]')?.textContent || "";
        const message = document.querySelector('[data-testid="wall-detection-message"]')?.textContent || "";
        return status.length > 0 || message.length > 0;
      },
      { timeout: 20000 }
    );
    const wallMessageOrStatus = (await textOf(page, "wall-status")) || (await textOf(page, "wall-detection-message"));
    record("Detect Exterior Walls completes and reports honestly", Boolean(wallMessageOrStatus), wallMessageOrStatus);
    await shot(page, "07-detect-walls-result");

    // ---------- Seed a deterministic closed rectangle perimeter (see file header) ----------
    await page.evaluate(() => {
      const pagesKey = Object.keys(localStorage).find((k) => k.startsWith("gr8:takeoff-v2:pages:"));
      const pages = JSON.parse(localStorage.getItem(pagesKey));
      const vertices = [
        { id: "wv1", x: 100, y: 100 },
        { id: "wv2", x: 500, y: 100 },
        { id: "wv3", x: 500, y: 600 },
        { id: "wv4", x: 100, y: 600 },
      ];
      const segments = [
        { id: "ws1", aId: "wv1", bId: "wv2", source: "detected", confidence: "high" },
        { id: "ws2", aId: "wv2", bId: "wv3", source: "detected", confidence: "high" },
        { id: "ws3", aId: "wv3", bId: "wv4", source: "detected", confidence: "medium" },
        { id: "ws4", aId: "wv4", bId: "wv1", source: "detected", confidence: "high" },
      ];
      pages[0].exteriorWalls = {
        vertices, segments, isClosed: true, confirmed: false, confirmedAt: null,
        detectionConfidence: 80, detectedSnapshot: { vertices, segments },
      };
      localStorage.setItem(pagesKey, JSON.stringify(pages));
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="takeoff-toolbar"]', { timeout: 20000 });
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="plan-canvas"]');
      return el && el.width > 0;
    }, { timeout: 20000 });

    const seededWallStatus = await textOf(page, "wall-status");
    record(
      "seeded exterior walls show 4 segments at 80% confidence",
      seededWallStatus === "Detected exterior walls: 4 segments — Confidence: 80%",
      seededWallStatus
    );
    await shot(page, "08-seeded-walls");

    // ---------- Edit Exterior Walls activates without breaking anything ----------
    await page.click('[data-testid="tool-edit-walls"]');
    await new Promise((resolve) => setTimeout(resolve, 200));
    const wallVertexCount = await page.$$eval('[data-testid="wall-vertex"]', (els) => els.length);
    record("edit mode renders 4 numbered vertices", wallVertexCount === 4, String(wallVertexCount));
    await shot(page, "09-edit-walls");
    await page.click('[data-testid="tool-select"]');

    // ---------- Confirm Exterior Walls ----------
    record("Confirm Exterior Walls enabled for a valid closed perimeter", !(await isDisabled(page, "tool-confirm-walls")));
    await page.click('[data-testid="tool-confirm-walls"]');
    await page.waitForFunction(
      () => document.querySelector('[data-testid="wall-status"]')?.textContent.includes("confirmed"),
      { timeout: 5000 }
    );
    const confirmedWallStatus = await textOf(page, "wall-status");
    record("wall status shows confirmed + total perimeter", /^Exterior walls confirmed — Total perimeter: [\d.]+ ?(mm|m)$/.test(confirmedWallStatus), confirmedWallStatus);
    await shot(page, "10-walls-confirmed");

    // ---------- Confirm Area ----------
    record("Confirm Area enabled once walls are confirmed", !(await isDisabled(page, "tool-confirm-area")));
    await page.click('[data-testid="tool-confirm-area"]');
    await page.waitForSelector('[data-testid="area-confirm-dialog"]', { timeout: 5000 });
    const areaReadout = await textOf(page, "area-readout");
    record("area dialog shows a calculated footprint", /Calculated building footprint: [\d.]+ ?m²/.test(areaReadout), areaReadout);
    await shot(page, "11-area-dialog");

    await page.click('[data-testid="area-accept"]');
    await page.waitForSelector('[data-testid="area-status"]', { timeout: 5000 });
    const areaStatus = await textOf(page, "area-status");
    record("area status shows confirmed area", /^Area confirmed: [\d.]+ ?m²$/.test(areaStatus), areaStatus);
    await shot(page, "12-area-confirmed");

    // ---------- Everything survives a reload ----------
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="takeoff-toolbar"]', { timeout: 20000 });
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="plan-canvas"]');
      return el && el.width > 0;
    }, { timeout: 20000 });

    const scaleAfterReload = await textOf(page, "scale-status");
    const wallStatusAfterReload = await textOf(page, "wall-status");
    const areaStatusAfterReload = await textOf(page, "area-status");
    record("scale persists after reload", scaleAfterReload === scaleStatusAfter, scaleAfterReload);
    record("confirmed exterior walls persist after reload", wallStatusAfterReload === confirmedWallStatus, wallStatusAfterReload);
    record("confirmed area persists after reload", areaStatusAfterReload === areaStatus, areaStatusAfterReload);
    await shot(page, "13-after-reload");
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
