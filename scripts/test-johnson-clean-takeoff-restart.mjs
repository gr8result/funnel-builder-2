import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import childProcess from "node:child_process";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import puppeteer from "puppeteer";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

const baseUrl = process.env.JOHNSON_VERIFY_BASE_URL || "http://localhost:3000";
const workspaceId = "846885cd-25b9-4eca-b9f9-3fd02f5882d8";
const sourceJobFilePath = "C:\\Users\\grant\\Downloads\\Johnson 123.gr8job";
const sourcePlanPath = "C:\\Users\\grant\\Downloads\\SAMPLE PLANS.pdf";
const outDir = path.join(root, "test-results", "johnson-clean-restart");
const downloadDir = path.join(outDir, "downloads");
const finalUrl = `${baseUrl}/modules/estimate-builder?page=aiPlanTakeoff`;

for (const required of [sourceJobFilePath, sourcePlanPath]) {
  if (!fs.existsSync(required)) throw new Error(`Missing required file: ${required}`);
}
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(downloadDir, { recursive: true });
for (const file of fs.readdirSync(downloadDir)) fs.rmSync(path.join(downloadDir, file), { force: true });

const planBytes = fs.readFileSync(sourcePlanPath);
const planPdf = await PDFDocument.load(planBytes, { ignoreEncryption: true });
if (planPdf.getPageCount() !== 5) throw new Error(`SAMPLE PLANS.pdf must be 5 pages, saw ${planPdf.getPageCount()}`);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!supabaseUrl || !anonKey || !serviceKey) throw new Error("Missing Supabase environment values.");

const runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const profileDir = path.join(outDir, `.browser-profile-${runId}`);
const email = `codex-johnson-clean-${runId}@example.test`;
const password = `Codex-${runId}-Pass!`;
const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });

const user = await ensureWorkspaceUser();
const auth = await signIn();
const browser = await puppeteer.launch({
  headless: process.env.JOHNSON_VERIFY_HEADLESS === "false" ? false : "new",
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  userDataDir: profileDir,
  defaultViewport: { width: 1540, height: 1050 },
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1540,1050"],
});

const report = {
  baseUrl,
  finalUrl,
  sourcePlan: {
    path: sourcePlanPath,
    size: planBytes.length,
    sha256: crypto.createHash("sha256").update(planBytes).digest("hex"),
    pageCount: planPdf.getPageCount(),
  },
  sourceJobFile: sourceJobFilePath,
  profileDir,
  downloadDir,
  userId: user.id,
  screenshots: {},
  checkpoints: [],
};

try {
  writeCheckpoint("browser launched");
  let page = await browser.newPage();
  page.setDefaultTimeout(120000);
  await enableDownloads(page);
  attachDiagnostics(page);
  attachDialogHandler(page);
  await primeBrowserSession(page, auth.session);

  await goto(page, `${baseUrl}/modules/estimate-builder?page=projectEstimate`, { waitUntil: "networkidle2", timeout: 120000 });
  await waitForBodyText(page, "Project Estimate", 120000);
  const localJobInput = await page.waitForSelector('[data-testid="open-local-job-file-input"]', { timeout: 120000 });
  await localJobInput.uploadFile(sourceJobFilePath);
  await waitForBodyText(page, "Johnson", 120000);
  writeCheckpoint("local Johnson job file opened");

  await goto(page, finalUrl, { waitUntil: "networkidle2", timeout: 120000 });
  await waitForBodyText(page, "No takeoff job open", 120000);
  await clearBrokenTakeoffRecentEntries(page);
  report.screenshots.blank = await screenshot(page, "01-no-takeoff-job-open.png");
  writeCheckpoint("blank AI Plan Takeoff state confirmed");

  await clickText(page, "button", "Create New Takeoff Job");
  await waitForBodyText(page, "New takeoff job created", 120000);

  const planInput = await page.waitForSelector('input[type="file"][accept="image/*,.pdf"]', { timeout: 120000 });
  await planInput.uploadFile(sourcePlanPath);
  await waitForBodyText(page, "Sheet 1 of 5", 120000);
  await waitForCanvasNonBlank(page);
  report.screenshots.importedSheet1 = await screenshot(page, "02-imported-sheet-1.png");
  writeCheckpoint("five-page SAMPLE PLANS.pdf imported");

  report.sheetScreenshots = [];
  for (let pageNumber = 1; pageNumber <= 5; pageNumber += 1) {
    await waitForBodyText(page, `Sheet ${pageNumber} of 5`, 120000);
    await waitForCanvasNonBlank(page);
    report.sheetScreenshots.push(await screenshot(page, `sheet-${pageNumber}-fresh-plan.png`));
    if (pageNumber < 5) await page.click("#ai-plan-takeoff-next-sheet-button");
  }
  writeCheckpoint("all five fresh plan sheets rendered");
  for (let pageNumber = 5; pageNumber > 1; pageNumber -= 1) {
    await page.click("#ai-plan-takeoff-prev-sheet-button");
    await waitForBodyText(page, `Sheet ${pageNumber - 1} of 5`, 120000);
  }

  await makeSmallTakeoff(page);
  await waitForBodyText(page, "Saved revision", 120000);
  report.screenshots.afterSmallTest = await screenshot(page, "03-small-test-items-saved.png");
  report.afterSmallTestRecord = await readActiveAiTakeoffRecord(page);
  assertSmallTakeoff(report.afterSmallTestRecord);
  writeCheckpoint("small takeoff saved and read back");

  page = await browser.newPage();
  page.setDefaultTimeout(120000);
  await enableDownloads(page);
  attachDiagnostics(page);
  attachDialogHandler(page);
  await primeBrowserSession(page, auth.session);
  await goto(page, finalUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
  await waitForBodyText(page, "Sheet 1 of 5", 120000);
  await waitForCanvasNonBlank(page);
  await waitForSavedSmallTakeoffUi(page);
  report.screenshots.afterNavigateBack = await screenshot(page, "04-after-navigation-return.png");
  report.afterNavigateBackRecord = await readActiveAiTakeoffRecord(page);
  assertSmallTakeoff(report.afterNavigateBackRecord);
  writeCheckpoint("small takeoff survived navigation away and return");

  await page.reload({ waitUntil: "networkidle2", timeout: 120000 });
  await waitForBodyText(page, "Sheet 1 of 5", 120000);
  await waitForCanvasNonBlank(page);
  await waitForSavedSmallTakeoffUi(page);
  report.screenshots.afterRefresh = await screenshot(page, "05-after-refresh.png");
  report.afterRefreshRecord = await readActiveAiTakeoffRecord(page);
  assertSmallTakeoff(report.afterRefreshRecord);
  writeCheckpoint("small takeoff survived browser refresh");

  report.downloadedBackup = await downloadTakeoffBackup(page);
  report.downloadedBackupParsed = parseTakeoffBackup(report.downloadedBackup.path);
  assertSmallTakeoff(report.downloadedBackupParsed);
  writeCheckpoint("Johnson.takeoff.gr8takeoff downloaded and parsed");

  report.importedBackupRecord = await independentlyOpenDownloadedTakeoff(auth.session, report.downloadedBackup.path);
  assertSmallTakeoff(report.importedBackupRecord);
  writeCheckpoint("downloaded takeoff opened independently without attaching");

  report.beforeRestartRecord = await readActiveAiTakeoffRecord(page);
  assertSmallTakeoff(report.beforeRestartRecord);
  await browser.close();
  writeCheckpoint("browser closed before dev server restart");

  report.serverRestart = await restartDevServer();
  writeCheckpoint("development server restarted");

  const browserAfterRestart = await puppeteer.launch({
    headless: process.env.JOHNSON_VERIFY_HEADLESS === "false" ? false : "new",
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    userDataDir: profileDir,
    defaultViewport: { width: 1540, height: 1050 },
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1540,1050"],
  });
  try {
    const restartPage = await browserAfterRestart.newPage();
    restartPage.setDefaultTimeout(120000);
    attachDiagnostics(restartPage);
    attachDialogHandler(restartPage);
    await primeBrowserSession(restartPage, auth.session);
    await goto(restartPage, finalUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
    await waitForBodyText(restartPage, "Sheet 1 of 5", 120000);
    await waitForCanvasNonBlank(restartPage);
    await waitForSavedSmallTakeoffUi(restartPage);
    report.screenshots.afterServerRestart = await screenshot(restartPage, "06-after-server-restart.png");
    report.afterServerRestartRecord = await readActiveAiTakeoffRecord(restartPage);
    assertSmallTakeoff(report.afterServerRestartRecord);
    writeCheckpoint("small takeoff survived dev server restart");
  } finally {
    await browserAfterRestart.close().catch(() => {});
  }
} catch (error) {
  report.error = error?.stack || error?.message || String(error);
  try {
    const pages = await browser.pages();
    const page = pages.at(-1);
    if (page) {
      report.failureUrl = page.url();
      report.failureText = await page.evaluate(() => document.body.innerText.slice(0, 4000)).catch(() => "");
      report.screenshots.failure = await screenshot(page, "failure.png");
    }
  } catch {}
  await browser.close().catch(() => {});
  fs.writeFileSync(path.join(outDir, "clean-restart-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  throw error;
}

fs.writeFileSync(path.join(outDir, "clean-restart-report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));

function writeCheckpoint(label) {
  report.checkpoints.push({ label, at: new Date().toISOString() });
  fs.writeFileSync(path.join(outDir, "clean-restart-report.json"), `${JSON.stringify(report, null, 2)}\n`);
}

async function ensureWorkspaceUser() {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  await upsertWithFallback("accounts", {
    user_id: data.user.id,
    email,
    full_name: "Codex Johnson Clean Takeoff Tester",
    business_name: "Johnson Clean Takeoff Test",
    approved: true,
    is_approved: true,
    status: "approved",
    subscription_status: "active",
    onboarding_completed: true,
    phone_verified: true,
    email_verified: true,
  }, "user_id");
  await admin.from("workspace_members").insert({ workspace_id: workspaceId, user_id: data.user.id, role: "owner", status: "active" });
  return data.user;
}

async function upsertWithFallback(table, payload, onConflict) {
  let next = { ...payload };
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const { data, error } = await admin.from(table).upsert(next, { onConflict }).select("*").single();
    if (!error) return data;
    const missing = missingColumn(error);
    if (!missing || !(missing in next)) throw error;
    delete next[missing];
  }
  throw new Error(`Could not upsert ${table}.`);
}

function missingColumn(error) {
  const message = `${error?.message || ""} ${error?.details || ""}`;
  const match = message.match(/'([^']+)' column|column "([^"]+)"/i);
  return match?.[1] || match?.[2] || "";
}

async function signIn() {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function primeBrowserSession(page, authSession) {
  const ref = new URL(supabaseUrl).hostname.split(".")[0];
  await page.evaluateOnNewDocument(({ key, sessionObject, activeWorkspaceId }) => {
    localStorage.setItem(key, JSON.stringify(sessionObject));
    localStorage.setItem(`${key}-fallback`, JSON.stringify({ currentSession: sessionObject, expiresAt: sessionObject?.expires_at || null }));
    localStorage.setItem("active_workspace_id", activeWorkspaceId);
    localStorage.removeItem("gr8:ai-plan-takeoff:recent-jobs");
  }, { key: `sb-${ref}-auth-token`, sessionObject: authSession, activeWorkspaceId: workspaceId });
}

function attachDiagnostics(page) {
  const consoleLog = path.join(outDir, "browser-console.log");
  const networkLog = path.join(outDir, "browser-network-errors.log");
  fs.rmSync(consoleLog, { force: true });
  fs.rmSync(networkLog, { force: true });
  page.on("pageerror", (error) => fs.appendFileSync(consoleLog, `pageerror ${error.stack || error.message}\n`));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) fs.appendFileSync(consoleLog, `${message.type()} ${message.text()}\n`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) fs.appendFileSync(networkLog, `${response.status()} ${response.url()}\n`);
  });
}

function attachDialogHandler(page) {
  page.on("dialog", async (dialog) => {
    const message = dialog.message();
    if (dialog.type() === "prompt" && /takeoff job name/i.test(message)) {
      await dialog.accept("Johnson Takeoff");
      return;
    }
    if (dialog.type() === "prompt" && /known dimension/i.test(message)) {
      await dialog.accept("5000");
      return;
    }
    if (dialog.type() === "prompt" && /Detected takeoff|Type "attach"/i.test(message)) {
      await dialog.accept("open");
      return;
    }
    await dialog.accept();
  });
}

async function goto(page, url, options = {}) {
  let response = null;
  try {
    response = await page.goto(url, options);
  } catch (error) {
    const message = String(error?.message || error);
    const detachedFrame = message.includes("Navigating frame was detached") || message.includes("detached Frame");
    if (!message.includes("net::ERR_ABORTED") && !detachedFrame) throw error;
    if (detachedFrame) {
      await sleep(1500);
      response = await page.goto(url, options).catch((retryError) => {
        const retryMessage = String(retryError?.message || retryError);
        if (retryMessage.includes("net::ERR_ABORTED") || retryMessage.includes("Navigating frame was detached") || retryMessage.includes("detached Frame")) return null;
        throw retryError;
      });
    }
  }
  try {
    await page.waitForFunction(() => document.readyState !== "loading", { timeout: 30000 });
  } catch (error) {
    if (!String(error?.message || error).includes("detached Frame") && !String(error?.message || error).includes("detached frame")) {
      await sleep(1500);
    }
  }
  if (response && response.status() >= 400) throw new Error(`Navigation failed ${response.status()} ${url}`);
}

async function enableDownloads(page) {
  const session = await page.createCDPSession();
  await session.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: downloadDir });
}

async function clearBrokenTakeoffRecentEntries(page) {
  await page.evaluate(() => {
    const key = "gr8:ai-plan-takeoff:recent-jobs";
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const blocked = /recovery|recovered|mountain creek|johnson \(11\)|archived-failed-johnson-recovery/i;
    const next = JSON.parse(raw).filter((item) => !blocked.test(JSON.stringify(item)));
    localStorage.setItem(key, JSON.stringify(next));
  });
}

async function makeSmallTakeoff(page) {
  await page.waitForFunction(() => typeof window.__gr8CreateJohnsonSmallTakeoff === "function", { timeout: 120000 });
  await page.evaluate(() => window.__gr8CreateJohnsonSmallTakeoff());
  await waitForTakeoffState(page, (state) => state.floorplans >= 1, "one footprint area");
  await waitForTakeoffState(page, (state) => state.floorCoverings >= 1, "one floor-covering area");
  await waitForTakeoffState(page, (state) => state.wallSegments >= 2, "two connected wall segments");
  await waitForTakeoffState(page, (state) => state.openings >= 2, "one window and one door");
  await clickText(page, "button", "Save Progress");
  await waitForBodyText(page, "Saved - Revision", 120000);
}

async function canvasClick(page, xRatio, yRatio) {
  const rect = await page.evaluate(() => {
    const target = document.querySelector(".konvajs-content");
    if (!target) throw new Error("Konva canvas is not mounted.");
    const r = target.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  });
  const x = rect.left + rect.width * xRatio;
  const y = rect.top + rect.height * yRatio;
  await page.mouse.move(x, y);
  await sleep(100);
  await page.mouse.down();
  await sleep(80);
  await page.mouse.up();
  await sleep(650);
}

async function planClick(page, xRatio, yRatio) {
  const point = await renderedPlanPoint(page, xRatio, yRatio);
  await page.mouse.move(point.x, point.y);
  await sleep(100);
  await page.mouse.down();
  await sleep(80);
  await page.mouse.up();
  await sleep(650);
}

async function canvasDblClick(page, xRatio, yRatio) {
  const rect = await page.evaluate(() => {
    const target = document.querySelector(".konvajs-content");
    if (!target) throw new Error("Konva canvas is not mounted.");
    const r = target.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  });
  await page.mouse.click(rect.left + rect.width * xRatio, rect.top + rect.height * yRatio, { clickCount: 2 });
  await sleep(500);
}

async function planDblClick(page, xRatio, yRatio) {
  const point = await renderedPlanPoint(page, xRatio, yRatio);
  await page.mouse.click(point.x, point.y, { clickCount: 2 });
  await sleep(500);
}

async function renderedPlanPoint(page, xRatio, yRatio) {
  return page.evaluate(({ xRatio: rx, yRatio: ry }) => {
    const canvas = [...document.querySelectorAll(".konvajs-content canvas")].find((item) => item.width > 100 && item.height > 100);
    if (!canvas) throw new Error("Konva scene canvas is not mounted.");
    const context = canvas.getContext("2d");
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let minX = canvas.width;
    let minY = canvas.height;
    let maxX = 0;
    let maxY = 0;
    for (let y = 0; y < canvas.height; y += 4) {
      for (let x = 0; x < canvas.width; x += 4) {
        const alpha = data[((y * canvas.width + x) * 4) + 3];
        if (alpha > 0) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }
    if (maxX <= minX || maxY <= minY) throw new Error("Rendered plan bounds could not be detected.");
    const rect = canvas.getBoundingClientRect();
    const canvasX = minX + (maxX - minX) * rx;
    const canvasY = minY + (maxY - minY) * ry;
    return {
      x: rect.left + (canvasX / canvas.width) * rect.width,
      y: rect.top + (canvasY / canvas.height) * rect.height,
      bounds: { minX, minY, maxX, maxY }
    };
  }, { xRatio, yRatio });
}

async function waitForCanvasNonBlank(page) {
  await page.waitForFunction(() => {
    const canvases = [...document.querySelectorAll(".konvajs-content canvas")];
    return canvases.some((canvas) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 300 || rect.height < 300) return false;
      const context = canvas.getContext("2d");
      const sample = context.getImageData(Math.floor(canvas.width * 0.2), Math.floor(canvas.height * 0.2), Math.max(1, Math.floor(canvas.width * 0.6)), Math.max(1, Math.floor(canvas.height * 0.6))).data;
      for (let index = 0; index < sample.length; index += 4) {
        if (sample[index + 3] && (sample[index] < 245 || sample[index + 1] < 245 || sample[index + 2] < 245)) return true;
      }
      return false;
    });
  }, { timeout: 120000 });
}

async function waitForSavedSmallTakeoffUi(page) {
  await page.waitForFunction(() => {
    const text = document.body.innerText;
    return /Sheet 1 of 5/.test(text)
      && /Outer Footprint|Footprint/.test(text)
      && /Tiles:/.test(text)
      && /exterior|interior/.test(text)
      && /W\d+:/.test(text)
      && /D\d+:/.test(text);
  }, { timeout: 120000 });
}

async function waitForTakeoffState(page, predicate, label) {
  await page.waitForFunction((expectedLabel) => {
    const state = window.__gr8AiPlanTakeoffState || {};
    window.__gr8LastTakeoffStateWait = { expectedLabel, state };
    if (expectedLabel === "one footprint area") return state.floorplans >= 1;
    if (expectedLabel === "one floor-covering area") return state.floorCoverings >= 1;
    if (expectedLabel === "two connected wall segments") return state.wallSegments >= 2;
    if (expectedLabel === "one window and one door") return state.openings >= 2;
    if (expectedLabel === "one active area point") return state.activeAreaPolylinePoints >= 1;
    if (expectedLabel === "two active area points") return state.activeAreaPolylinePoints >= 2;
    if (expectedLabel === "three active area points") return state.activeAreaPolylinePoints >= 3;
    if (expectedLabel === "four active area points") return state.activeAreaPolylinePoints >= 4;
    if (expectedLabel === "one active wall point") return state.activePolylinePoints >= 1;
    if (expectedLabel === "two active wall points") return state.activePolylinePoints >= 2;
    if (expectedLabel === "three active wall points") return state.activePolylinePoints >= 3;
    return false;
  }, { timeout: 120000 }, label).catch(async (error) => {
    const debug = await page.evaluate(() => ({
      state: window.__gr8AiPlanTakeoffState || null,
      lastClick: window.__gr8LastAiPlanTakeoffClick || null,
      lastWait: window.__gr8LastTakeoffStateWait || null,
    })).catch(() => null);
    throw new Error(`Timed out waiting for ${label}; debug=${JSON.stringify(debug)}; ${error.message}`);
  });
}

async function readActiveAiTakeoffRecord(page) {
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("estimate-builder-template-db", 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const store = db.transaction("jobs", "readonly").objectStore("jobs");
      const active = await new Promise((resolve, reject) => {
        const request = store.get("active-job");
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
      const key = active?.jobKey || active?.key;
      const record = key ? await new Promise((resolve, reject) => {
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      }) : null;
      const workbook = record?.workbook || {};
      const job = workbook.aiPlanTakeoffJob || workbook.takeoffEngine?.aiPlanTakeoffJob || null;
      const allKeys = await new Promise((resolve, reject) => {
        const request = store.getAllKeys();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
      return {
        activeKey: key || "",
        snapshotCount: allKeys.filter((item) => String(item).includes(":snapshot:")).length,
        revision: Number(job?.revision || 0),
        savedAt: job?.updatedAt || record?.savedAt || "",
        pageCount: job?.plan?.pages?.length || 0,
        walls: job?.completedWallRuns?.length || 0,
        wallSegments: (job?.completedWallRuns || []).reduce((sum, wall) => sum + Math.max(0, (wall.nodes || []).length - 1), 0),
        openings: job?.placedOpenings?.length || 0,
        floorCoverings: job?.completedAreas?.length || 0,
        floorplans: job?.completedFloorplans?.length || 0,
        hasCalibration: Boolean(job?.pixelsPerMm),
        takeoffName: job?.takeoffName || job?.jobName || "",
        sourceFileName: job?.sourceFileName || job?.planFilename || "",
      };
    } finally {
      db.close();
    }
  });
}

async function downloadTakeoffBackup(page) {
  await page.click("#ai-plan-takeoff-download-backup-button");
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    const files = fs.readdirSync(downloadDir)
      .filter((file) => file.toLowerCase().endsWith(".gr8takeoff") && !file.endsWith(".crdownload"))
      .map((file) => path.join(downloadDir, file))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    if (files.length) {
      const filePath = files[0];
      const stat = fs.statSync(filePath);
      if (stat.size > 0) {
        return {
          path: filePath,
          fileName: path.basename(filePath),
          size: stat.size,
          sha256: crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex"),
        };
      }
    }
    await sleep(500);
  }
  throw new Error("Timed out waiting for Johnson.takeoff.gr8takeoff download.");
}

function parseTakeoffBackup(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  if (!text.trim()) throw new Error(`${filePath} is empty.`);
  const data = JSON.parse(text);
  const job = data.takeoffJob || data.takeoffData || data.aiPlanTakeoffJob || data;
  const planPages = job?.plan?.pages || job?.planPages || [];
  const walls = Array.isArray(job?.completedWallRuns) ? job.completedWallRuns : [];
  const openings = Array.isArray(job?.placedOpenings) ? job.placedOpenings : [];
  const floorCoverings = Array.isArray(job?.completedAreas) ? job.completedAreas : [];
  const floorplans = Array.isArray(job?.completedFloorplans) ? job.completedFloorplans : [];
  return {
    fileName: path.basename(filePath),
    size: fs.statSync(filePath).size,
    sha256: crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex"),
    pageCount: planPages.length,
    renderablePlanPages: planPages.filter((pageItem) => typeof pageItem?.dataUrl === "string" && pageItem.dataUrl.startsWith("data:")).length,
    walls: walls.length,
    wallSegments: walls.reduce((sum, wall) => sum + Math.max(0, (wall.nodes || []).length - 1), 0),
    openings: openings.length,
    floorCoverings: floorCoverings.length,
    floorplans: floorplans.length,
    hasCalibration: Boolean(job?.pixelsPerMm),
    revision: Number(job?.revision || data.revision || 0),
    takeoffName: job?.takeoffName || job?.jobName || data.takeoffName || "",
    sourceFileName: job?.sourceFileName || data.sourceFileName || "",
  };
}

async function independentlyOpenDownloadedTakeoff(authSession, filePath) {
  const importProfileDir = `${profileDir}-import-check`;
  fs.rmSync(importProfileDir, { recursive: true, force: true });
  const importBrowser = await puppeteer.launch({
    headless: process.env.JOHNSON_VERIFY_HEADLESS === "false" ? false : "new",
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    userDataDir: importProfileDir,
    defaultViewport: { width: 1540, height: 1050 },
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1540,1050"],
  });
  try {
    const page = await importBrowser.newPage();
    page.setDefaultTimeout(120000);
    attachDiagnostics(page);
    attachDialogHandler(page);
    await primeBrowserSession(page, authSession);
    await goto(page, finalUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForSelector("#legacy-job-loader", { timeout: 120000 });
    const input = await page.$("#legacy-job-loader");
    await input.uploadFile(filePath);
    await waitForBodyText(page, "Imported takeoff file", 120000);
    await waitForBodyText(page, "Sheet 1 of 5", 120000);
    await waitForCanvasNonBlank(page);
    await waitForSavedSmallTakeoffUi(page);
    report.screenshots.independentImport = await screenshot(page, "07-independent-import.png");
    return await page.evaluate(() => {
      const state = window.__gr8AiPlanTakeoffState || {};
      return {
        revision: Number(state.savedRevision || 0),
        pageCount: Number(state.planPages || 0),
        wallSegments: Number(state.wallSegments || 0),
        openings: Number(state.openings || 0),
        floorCoverings: Number(state.floorCoverings || 0),
        floorplans: Number(state.floorplans || 0),
        hasCalibration: Boolean(state.pixelsPerMm),
        takeoffName: state.jobName || "",
        sourceFileName: state.importedTakeoffFileName || "",
      };
    });
  } finally {
    await importBrowser.close().catch(() => {});
  }
}

async function restartDevServer() {
  const beforePid = getPort3000Pid();
  if (beforePid) {
    childProcess.execFileSync("powershell", ["-NoProfile", "-Command", `Stop-Process -Id ${beforePid} -Force`], { cwd: root, stdio: "ignore" });
  }
  await sleep(2500);
  childProcess.execFileSync("powershell", [
    "-NoProfile",
    "-Command",
    `Start-Process -FilePath npm.cmd -ArgumentList 'run','dev' -WorkingDirectory '${root.replace(/'/g, "''")}' -WindowStyle Hidden`,
  ], { cwd: root, stdio: "ignore" });
  const deadline = Date.now() + 180000;
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(finalUrl, { redirect: "manual" });
      if (response.status < 500) {
        return {
          beforePid,
          afterPid: getPort3000Pid(),
          status: response.status,
          restartedAt: new Date().toISOString(),
        };
      }
    } catch (error) {
      lastError = error?.message || String(error);
    }
    await sleep(2000);
  }
  throw new Error(`Development server did not return after restart. Last error: ${lastError}`);
}

function getPort3000Pid() {
  try {
    const output = childProcess.execFileSync("powershell", [
      "-NoProfile",
      "-Command",
      "(Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess)",
    ], { cwd: root, encoding: "utf8" }).trim();
    return output ? Number(output) : null;
  } catch {
    return null;
  }
}

function assertSmallTakeoff(record) {
  if (record.pageCount !== 5) throw new Error(`Expected 5 plan pages in saved record, saw ${record.pageCount}`);
  if (record.wallSegments < 2) throw new Error(`Expected at least 2 connected wall segments, saw ${record.wallSegments}`);
  if (record.openings < 2) throw new Error(`Expected 2 openings, saw ${record.openings}`);
  if (record.floorCoverings < 1) throw new Error(`Expected 1 floor-covering area, saw ${record.floorCoverings}`);
  if (record.floorplans < 1) throw new Error(`Expected 1 footprint area, saw ${record.floorplans}`);
  if (!record.hasCalibration) throw new Error("Expected calibration in saved record.");
}

async function clickText(page, selector, text) {
  await page.evaluate(({ selector: query, text: expected }) => {
    const normalise = (value) => (value || "").replace(/\s+/g, " ").trim();
    const matches = [...document.querySelectorAll(query)].filter((element) => normalise(element.textContent).includes(expected));
    const target = matches.find((element) => !element.disabled) || matches[0];
    if (!target) throw new Error(`Could not find ${query} containing ${expected}; lastTakeoffClick=${JSON.stringify(window.__gr8LastAiPlanTakeoffClick || null)} state=${JSON.stringify(window.__gr8AiPlanTakeoffState || null)}`);
    target.scrollIntoView({ block: "center", inline: "center" });
    target.click();
  }, { selector, text });
  await sleep(500);
}

async function clickExactText(page, selector, text) {
  await page.evaluate(({ selector: query, text: expected }) => {
    const normalise = (value) => (value || "").replace(/\s+/g, " ").trim();
    const matches = [...document.querySelectorAll(query)].filter((element) => normalise(element.textContent) === expected);
    const target = matches.find((element) => !element.disabled) || matches[0];
    if (!target) throw new Error(`Could not find ${query} exactly matching ${expected}; lastTakeoffClick=${JSON.stringify(window.__gr8LastAiPlanTakeoffClick || null)} state=${JSON.stringify(window.__gr8AiPlanTakeoffState || null)}`);
    target.scrollIntoView({ block: "center", inline: "center" });
    target.click();
  }, { selector, text });
  await sleep(500);
}

async function waitForBodyText(page, text, timeout = 60000) {
  await page.waitForFunction((expected) => document.body.innerText.includes(expected), { timeout }, text);
}

async function screenshot(page, name) {
  const filePath = path.join(outDir, name);
  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
