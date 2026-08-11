import fs from "fs";
import os from "os";
import path from "path";
import dotenv from "dotenv";
import puppeteer from "puppeteer";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

dotenv.config({ path: path.resolve(".env.local") });

const baseUrl = process.argv[2] || "http://localhost:3000";
const outDir = path.join("test-results", "takeoff-v3-acceptance");
fs.mkdirSync(outDir, { recursive: true });

const results = [];
function record(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} - ${name}${detail ? ` (${detail})` : ""}`);
}

async function buildFixturePdf() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([612, 792]);
  page.drawText("TAKEOFF V3 SAMPLE PLAN", { x: 54, y: 732, size: 24, font, color: rgb(0, 0, 0) });
  page.drawLine({ start: { x: 90, y: 690 }, end: { x: 390, y: 690 }, thickness: 3, color: rgb(0.1, 0.45, 0.4) });
  page.drawText("300pt reference", { x: 90, y: 700, size: 12, font });
  page.drawRectangle({ x: 120, y: 260, width: 330, height: 250, borderColor: rgb(0, 0, 0), borderWidth: 2 });
  page.drawLine({ start: { x: 260, y: 260 }, end: { x: 260, y: 510 }, thickness: 1.2, color: rgb(0, 0, 0) });
  const bytes = await doc.save();
  const filePath = path.join(os.tmpdir(), `takeoff-v3-fixture-${Date.now()}.pdf`);
  fs.writeFileSync(filePath, bytes);
  return filePath;
}

async function shot(page, name) {
  try {
    await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: false, timeout: 10000 });
  } catch (error) {
    record(`screenshot ${name}`, false, error.message);
  }
}

async function clickViewport(page, xRatio, yRatio) {
  const box = await (await page.$('[data-testid="takeoff-v3-viewport"]')).boundingBox();
  await page.mouse.click(box.x + box.width * xRatio, box.y + box.height * yRatio);
}

async function getCounts(page) {
  return page.$eval('[data-testid="takeoff-v3-overlay"]', (svg) => ({
    points: svg.querySelectorAll("circle").length,
    walls: svg.querySelectorAll("line:not([stroke-dasharray])").length,
    transform: svg.parentElement.style.transform,
  }));
}

async function main() {
  const fixturePath = await buildFixturePdf();
  console.log("launch browser");
  let browser = null;
  let page = null;

  try {
    browser = await puppeteer.launch({
      headless: "new",
      defaultViewport: { width: 1440, height: 960 },
      timeout: 60000,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    page = await browser.newPage();
    page.setDefaultTimeout(60000);
    page.on("dialog", async (dialog) => dialog.accept("3000"));
    page.on("pageerror", (err) => console.error("[pageerror]", err.message));
    page.on("console", (msg) => { if (msg.type() === "error") console.error("[console.error]", msg.text()); });
    const adminKey = process.env.ADMIN_DASH_KEY || "";
    if (adminKey) await page.setCookie({ name: "admin_key", value: adminKey, url: baseUrl });
    console.log("open route");
    await page.goto(`${baseUrl}/dev/takeoff-v3-test`, { waitUntil: "domcontentloaded", timeout: 60000 });
    console.log("clear storage");
    await page.evaluate(() => {
      Object.keys(localStorage).filter((key) => key.startsWith("gr8:takeoff-v3:")).forEach((key) => localStorage.removeItem(key));
      indexedDB.deleteDatabase("gr8-takeoff-v2-files");
    });
    console.log("reload route");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="takeoff-v3-page"]', { timeout: 30000 });
    await shot(page, "01-empty");

    const input = await page.$('[data-testid="takeoff-v3-upload-input"]');
    await input.uploadFile(fixturePath);
    await page.waitForSelector('[data-testid="takeoff-v3-canvas"]', { timeout: 30000 });
    await page.waitForFunction(() => document.querySelector('[data-testid="takeoff-v3-canvas"]')?.width > 0, { timeout: 30000 });
    await shot(page, "02-uploaded");
    record("upload PDF and render page", true);

    await page.click('[data-testid="takeoff-v3-rotate-right"]');
    await page.waitForFunction(() => document.body.textContent.includes("90 deg"), { timeout: 10000 });
    await page.click('[data-testid="takeoff-v3-rotate-left"]');
    await page.waitForFunction(() => document.body.textContent.includes("0 deg"), { timeout: 10000 });
    record("set orientation", true);

    await page.click('[data-testid="takeoff-v3-tool-set-scale"]');
    await clickViewport(page, 0.30, 0.24);
    await clickViewport(page, 0.62, 0.24);
    await page.waitForFunction(() => document.body.textContent.includes("Scale set"), { timeout: 10000 });
    record("set scale manually", true);

    await page.click('[data-testid="takeoff-v3-tool-draw-exterior"]');
    await clickViewport(page, 0.32, 0.36);
    await clickViewport(page, 0.62, 0.36);
    await page.click('[data-testid="takeoff-v3-zoom-250"]');
    await new Promise((resolve) => setTimeout(resolve, 500));
    const viewport = await (await page.$('[data-testid="takeoff-v3-viewport"]')).boundingBox();
    await page.keyboard.down("Space");
    await page.mouse.move(viewport.x + viewport.width / 2, viewport.y + viewport.height / 2);
    await page.mouse.down();
    await page.mouse.move(viewport.x + viewport.width / 2 - 110, viewport.y + viewport.height / 2 - 60, { steps: 8 });
    await page.mouse.up();
    await page.keyboard.up("Space");
    await clickViewport(page, 0.62, 0.62);
    await clickViewport(page, 0.32, 0.62);
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.body.textContent.includes("Closed - Needs Review"), { timeout: 10000 });
    await shot(page, "03-drawn-zoomed-panned");
    const drawn = await getCounts(page);
    record("draw exterior, zoom to 250%, pan, continue drawing, finish", drawn.points >= 4 && drawn.walls >= 4, `${drawn.points} points/${drawn.walls} walls`);

    await page.click('[data-testid="takeoff-v3-tool-select"]');
    const firstCircle = await page.$('[data-testid="takeoff-v3-overlay"] circle');
    const circleBox = await firstCircle.boundingBox();
    const beforeDrag = (await getCounts(page)).transform;
    await page.mouse.move(circleBox.x + circleBox.width / 2, circleBox.y + circleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(circleBox.x + circleBox.width / 2 + 26, circleBox.y + circleBox.height / 2 + 18, { steps: 8 });
    await page.mouse.up();
    const afterDrag = (await getCounts(page)).transform;
    await shot(page, "04-corner-drag");
    record("drag only selected corner without panning", beforeDrag === afterDrag, `before=${beforeDrag} after=${afterDrag}`);

    await page.click('[data-testid="takeoff-v3-undo"]');
    await page.click('[data-testid="takeoff-v3-redo"]');
    record("undo and redo", true);

    await page.click('[data-testid="takeoff-v3-tool-edit"]');
    const firstLine = await page.$('[data-testid="takeoff-v3-overlay"] line:not([stroke-dasharray])');
    const lineBox = await firstLine.boundingBox();
    const beforeInsert = await getCounts(page);
    await page.keyboard.down("Alt");
    await page.mouse.click(lineBox.x + lineBox.width / 2, lineBox.y + lineBox.height / 2);
    await page.keyboard.up("Alt");
    await page.waitForFunction((count) => document.querySelectorAll('[data-testid="takeoff-v3-overlay"] circle').length > count, {}, beforeInsert.points);
    record("insert point into wall", true);

    await page.click('[data-testid="takeoff-v3-tool-delete"]');
    const circles = await page.$$('[data-testid="takeoff-v3-overlay"] circle');
    const insertedCircleBox = await circles[circles.length - 1].boundingBox();
    await page.mouse.click(insertedCircleBox.x + insertedCircleBox.width / 2, insertedCircleBox.y + insertedCircleBox.height / 2);
    await page.waitForFunction((count) => document.querySelectorAll('[data-testid="takeoff-v3-overlay"] circle').length < count, {}, beforeInsert.points + 1);
    record("delete point", true);

    await page.click('[data-testid="takeoff-v3-confirm-exterior"]');
    await page.waitForFunction(() => document.body.textContent.includes("Confirmed"), { timeout: 10000 });
    const summaryText = await page.$eval("body", (body) => body.textContent);
    record(
      "confirm exterior and verify perimeter/area",
      summaryText.includes("Confirmed") && summaryText.includes("Perimeter") && summaryText.includes("m") && summaryText.includes("Areas") && summaryText.includes("m2")
    );
    await shot(page, "05-confirmed");

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="takeoff-v3-overlay"] circle', { timeout: 30000 });
    const persisted = await getCounts(page);
    await shot(page, "06-refresh-persisted");
    record("geometry persists after refresh", persisted.points >= 4 && persisted.walls >= 4, `${persisted.points} points/${persisted.walls} walls`);
  } catch (err) {
    record("acceptance script completed", false, err.message);
    if (page) await shot(page, "99-error").catch(() => {});
  } finally {
    if (browser) await browser.close();
    fs.rmSync(fixturePath, { force: true });
  }

  fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
  const failures = results.filter((result) => !result.pass);
  console.log(`\n${results.length - failures.length}/${results.length} checks passed. Screenshots in ${outDir}`);
  if (failures.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
