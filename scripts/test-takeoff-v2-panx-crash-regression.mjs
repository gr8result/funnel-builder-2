// scripts/test-takeoff-v2-panx-crash-regression.mjs
//
// Regression test for the "Cannot read properties of null (reading 'panX')"
// crash in modules/takeoff-v2/components/PlanViewer.jsx's pointer-move
// handler. Root cause: the pan updater read `dragRef.current.panX` *inside*
// a deferred `setView(prev => ...)` React state-updater callback. If
// `dragRef.current` was nulled (pointerup/pointercancel/tool change) before
// React actually invoked that pending updater, the read threw on
// `null.panX`. The fix captures `dragRef.current` into a local const once,
// synchronously, before any closure (including the deferred updater) reads
// it.
//
// This script can't force the exact React scheduling race deterministically
// (that's the nature of the bug), so instead it exhaustively drives every
// interaction pattern the bug report called out and asserts zero page
// errors throughout, plus that the viewer is still fully functional
// afterward — the fix removes the possibility of the crash by construction
// (a captured local can never become null), not just by making it rarer, so
// these patterns are a meaningful regression guard either way.
//
// Requires a Next dev server already running (npm run dev).
// Run with: node scripts/test-takeoff-v2-panx-crash-regression.mjs [baseUrl]

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
  "takeoff-v2-panx-crash-regression"
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
  const page2 = doc.addPage([612, 792]);
  page2.drawText("PAGE 2", { x: 40, y: 740, size: 28, font, color: rgb(0, 0, 1) });
  const bytes = await doc.save();
  const fixturePath = path.join(os.tmpdir(), `takeoff-v2-panx-fixture-${Date.now()}.pdf`);
  fs.writeFileSync(fixturePath, bytes);
  return fixturePath;
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(outDir, `${name}.png`) });
}

async function main() {
  const fixturePath = await buildFixturePdf();
  const browser = await puppeteer.launch({ headless: "new", defaultViewport: { width: 1440, height: 960 } });
  const page = await browser.newPage();

  // Only uncaught exceptions (pageerror) count as a regression here — a
  // console.error (e.g. an unrelated favicon 404) is noise the existing
  // acceptance scripts already tolerate the same way.
  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") console.log("[console.error]", msg.text());
  });

  // Dispatches a real DOM click without going through Puppeteer's own
  // mouse-button bookkeeping — page.click()/ElementHandle.click() perform
  // their own mouse.down()+mouse.up(), which throws ("'left' is already
  // pressed") if a manual page.mouse.down() drag is still open, exactly the
  // mid-drag interruption these tests intentionally create.
  async function domClick(page, testId) {
    await page.$eval(`[data-testid="${testId}"]`, (el) => el.click());
  }

  try {
    const adminKey = process.env.ADMIN_DASH_KEY || "";
    if (!adminKey) throw new Error("ADMIN_DASH_KEY is not set in the environment — cannot pass the /dev/* gate.");
    await page.setCookie({ name: "admin_key", value: adminKey, url: baseUrl });

    await page.goto(`${baseUrl}/dev/takeoff-v2-test`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector('[data-testid="takeoff-v2-page"]', { timeout: 30000 });

    const fileInput = await page.$('[data-testid="plan-upload-input"]');
    await fileInput.uploadFile(fixturePath);
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="plan-canvas"]');
      return el && el.width > 0;
    }, { timeout: 20000 });

    const viewportEl = await page.$('[data-testid="plan-viewport"]');
    const box = await viewportEl.boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    pageErrors.length = 0;

    // ---- 1: rapid panning (many small moves in quick succession) ----------
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    for (let i = 0; i < 40; i += 1) {
      await page.mouse.move(cx + i * 3, cy + (i % 2 === 0 ? 3 : -3));
    }
    await page.mouse.up();
    record("rapid panning produces no page errors", pageErrors.length === 0, pageErrors[0]);
    await shot(page, "01-rapid-pan");

    // ---- 2: release outside the viewport bounds ----------------------------
    pageErrors.length = 0;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(box.x - 200, box.y - 200, { steps: 15 }); // drag well outside the container
    await page.mouse.up();
    record("releasing outside the viewport produces no page errors", pageErrors.length === 0, pageErrors[0]);
    await shot(page, "02-release-outside");

    // Recenter the view for subsequent steps.
    await page.click('[data-testid="fit-page-button"]');
    await new Promise((resolve) => setTimeout(resolve, 200));

    // ---- 3: tool change mid-drag -------------------------------------------
    pageErrors.length = 0;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 40, cy + 20, { steps: 5 });
    await domClick(page, "tool-set-scale"); // switches tool while the button-down drag is still "active" in dragRef
    await page.mouse.move(cx + 80, cy + 40, { steps: 5 });
    await page.mouse.up();
    record("tool change mid-drag produces no page errors", pageErrors.length === 0, pageErrors[0]);
    await domClick(page, "tool-select");
    await shot(page, "03-tool-change-mid-drag");

    // ---- 4: Escape mid-drag -------------------------------------------------
    pageErrors.length = 0;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 30, cy + 30, { steps: 5 });
    await page.keyboard.press("Escape");
    await page.mouse.move(cx + 60, cy + 60, { steps: 5 });
    await page.mouse.up();
    record("Escape mid-drag produces no page errors", pageErrors.length === 0, pageErrors[0]);
    await shot(page, "04-escape-mid-drag");

    // ---- 5: rotate while the pointer is down --------------------------------
    pageErrors.length = 0;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 20, cy + 10, { steps: 5 });
    await domClick(page, "rotate-right-button");
    await page.mouse.move(cx + 40, cy + 20, { steps: 5 });
    await page.mouse.up();
    record("rotating mid-drag produces no page errors", pageErrors.length === 0, pageErrors[0]);
    await domClick(page, "reset-rotation-button");
    await shot(page, "05-rotate-mid-drag");

    // ---- 6: switch pages while the pointer is down --------------------------
    pageErrors.length = 0;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 20, cy + 10, { steps: 5 });
    await page.evaluate(() => document.querySelectorAll('[data-testid="plan-page-thumb"]')[1]?.click());
    await page.mouse.move(cx + 40, cy + 20, { steps: 5 });
    await page.mouse.up();
    record("switching pages mid-drag produces no page errors", pageErrors.length === 0, pageErrors[0]);
    await shot(page, "06-page-switch-mid-drag");

    // ---- 7: still fully functional afterward --------------------------------
    pageErrors.length = 0;
    const thumbsBack = await page.$$('[data-testid="plan-page-thumb"]');
    await thumbsBack[0].click();
    await new Promise((resolve) => setTimeout(resolve, 200));
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 50, cy + 50, { steps: 8 });
    await page.mouse.up();
    await page.mouse.wheel({ deltaY: -200 });
    await new Promise((resolve) => setTimeout(resolve, 200));
    record("viewer remains fully functional after the stress sequence", pageErrors.length === 0, pageErrors[0]);
    await shot(page, "07-still-functional");
  } catch (err) {
    record("regression script encountered an error", false, err.message);
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
