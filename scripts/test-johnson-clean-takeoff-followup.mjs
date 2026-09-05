import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import childProcess from "node:child_process";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import puppeteer from "puppeteer";
import { createClient } from "@supabase/supabase-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

const outDir = path.join(root, "test-results", "johnson-clean-restart");
const reportPath = path.join(outDir, "clean-restart-report.json");
const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const baseUrl = report.baseUrl || process.env.JOHNSON_VERIFY_BASE_URL || "http://localhost:3000";
const finalUrl = report.finalUrl || `${baseUrl}/modules/estimate-builder?page=aiPlanTakeoff`;
const profileDir = report.profileDir;
const downloadDir = report.downloadDir || path.join(outDir, "downloads");
const workspaceId = "846885cd-25b9-4eca-b9f9-3fd02f5882d8";

if (!profileDir || !fs.existsSync(profileDir)) throw new Error(`Missing saved browser profile: ${profileDir}`);
fs.mkdirSync(downloadDir, { recursive: true });
for (const file of fs.readdirSync(downloadDir)) fs.rmSync(path.join(downloadDir, file), { force: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!supabaseUrl || !anonKey || !serviceKey) throw new Error("Missing Supabase environment values.");

const runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const email = `codex-johnson-followup-${runId}@example.test`;
const password = `Codex-${runId}-Pass!`;
const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
const user = await ensureWorkspaceUser();
const auth = await signIn();

report.followup = report.followup || {};
report.followup.checkpoints = [];
writeReport("follow-up started");

let browser = await launchBrowser(profileDir);
try {
  let page = await browser.newPage();
  page.setDefaultTimeout(120000);
  await enableDownloads(page);
  attachDialogHandler(page);
  attachDiagnostics(page);
  await goto(page, finalUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
  await waitForBodyText(page, "Sheet 1 of 5", 120000);
  await waitForCanvasNonBlank(page);
  await waitForSavedSmallTakeoffUi(page);
  report.screenshots.afterNavigateBack = await screenshot(page, "04-after-navigation-return.png");
  report.afterNavigateBackRecord = await readActiveAiTakeoffRecord(page);
  assertSmallTakeoff(report.afterNavigateBackRecord);
  writeReport("small takeoff survived fresh browser return");

  await page.reload({ waitUntil: "domcontentloaded", timeout: 120000 });
  await waitForBodyText(page, "Sheet 1 of 5", 120000);
  await waitForCanvasNonBlank(page);
  await waitForSavedSmallTakeoffUi(page);
  report.screenshots.afterRefresh = await screenshot(page, "05-after-refresh.png");
  report.afterRefreshRecord = await readActiveAiTakeoffRecord(page);
  assertSmallTakeoff(report.afterRefreshRecord);
  writeReport("small takeoff survived refresh");

  await browser.close().catch(() => {});
  browser = null;
  report.serverRestart = await restartDevServer();
  writeReport("development server restarted");

  browser = await launchBrowser(profileDir);
  page = await browser.newPage();
  page.setDefaultTimeout(120000);
  await enableDownloads(page);
  attachDialogHandler(page);
  attachDiagnostics(page);
  await goto(page, finalUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
  await waitForBodyText(page, "Sheet 1 of 5", 120000);
  await waitForCanvasNonBlank(page);
  await waitForSavedSmallTakeoffUi(page);
  report.screenshots.afterServerRestart = await screenshot(page, "06-after-server-restart.png");
  report.afterServerRestartRecord = await readActiveAiTakeoffRecord(page);
  assertSmallTakeoff(report.afterServerRestartRecord);
  writeReport("small takeoff survived dev server restart");

  report.downloadedBackup = await downloadTakeoffBackup(page);
  report.downloadedBackupParsed = parseTakeoffBackup(report.downloadedBackup.path);
  assertSmallTakeoff(report.downloadedBackupParsed);
  writeReport("Johnson.takeoff.gr8takeoff downloaded and parsed");

  report.importedBackupRecord = await independentlyOpenDownloadedTakeoff(auth.session, report.downloadedBackup.path);
  assertSmallTakeoff(report.importedBackupRecord);
  writeReport("downloaded takeoff opened independently without attaching");
} catch (error) {
  report.followup.error = error?.stack || error?.message || String(error);
  try {
    const pages = browser ? await browser.pages() : [];
    const page = pages.at(-1);
    if (page) {
      report.followup.failureUrl = page.url();
      report.followup.failureText = await page.evaluate(() => document.body.innerText.slice(0, 4000)).catch(() => "");
      report.screenshots.followupFailure = await screenshot(page, "followup-failure.png");
    }
  } catch {}
  writeReport("follow-up failed");
  throw error;
} finally {
  if (browser) await browser.close().catch(() => {});
}

writeReport("follow-up complete");
console.log(JSON.stringify(report, null, 2));

function writeReport(label) {
  report.followup.checkpoints.push({ label, at: new Date().toISOString() });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

async function ensureWorkspaceUser() {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  await upsertWithFallback("accounts", {
    user_id: data.user.id,
    email,
    full_name: "Codex Johnson Follow-up Tester",
    business_name: "Johnson Follow-up Test",
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

async function launchBrowser(userDataDir) {
  return puppeteer.launch({
    headless: process.env.JOHNSON_VERIFY_HEADLESS === "false" ? false : "new",
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    userDataDir,
    defaultViewport: { width: 1540, height: 1050 },
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1540,1050"],
  });
}

async function enableDownloads(page) {
  const session = await page.createCDPSession();
  await session.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: downloadDir });
}

function attachDialogHandler(page) {
  page.on("dialog", async (dialog) => {
    if (dialog.type() === "prompt" && /Detected takeoff|Type "attach"/i.test(dialog.message())) {
      await dialog.accept("open");
      return;
    }
    await dialog.accept();
  });
}

function attachDiagnostics(page) {
  const consoleLog = path.join(outDir, "browser-console.log");
  const networkLog = path.join(outDir, "browser-network-errors.log");
  page.on("pageerror", (error) => fs.appendFileSync(consoleLog, `pageerror ${error.stack || error.message}\n`));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) fs.appendFileSync(consoleLog, `${message.type()} ${message.text()}\n`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) fs.appendFileSync(networkLog, `${response.status()} ${response.url()}\n`);
  });
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

async function goto(page, url, options = {}) {
  const response = await page.goto(url, options).catch((error) => {
    const message = String(error?.message || error);
    if (message.includes("net::ERR_ABORTED") || message.includes("Navigating frame was detached")) return null;
    throw error;
  });
  await page.waitForFunction(() => document.readyState !== "loading", { timeout: 30000 }).catch(() => null);
  if (response && response.status() >= 400) throw new Error(`Navigation failed ${response.status()} ${url}`);
}

async function waitForBodyText(page, text, timeout = 60000) {
  await page.waitForFunction((expected) => document.body.innerText.includes(expected), { timeout }, text);
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
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const job = data.takeoffJob || data.takeoffData || data.aiPlanTakeoffJob || data;
  const pages = job?.plan?.pages || job?.planPages || [];
  const walls = Array.isArray(job?.completedWallRuns) ? job.completedWallRuns : [];
  return {
    fileName: path.basename(filePath),
    size: fs.statSync(filePath).size,
    sha256: crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex"),
    revision: Number(job?.revision || data.revision || 0),
    pageCount: pages.length,
    renderablePlanPages: pages.filter((pageItem) => typeof pageItem?.dataUrl === "string" && pageItem.dataUrl.startsWith("data:")).length,
    walls: walls.length,
    wallSegments: walls.reduce((sum, wall) => sum + Math.max(0, (wall.nodes || []).length - 1), 0),
    openings: Array.isArray(job?.placedOpenings) ? job.placedOpenings.length : 0,
    floorCoverings: Array.isArray(job?.completedAreas) ? job.completedAreas.length : 0,
    floorplans: Array.isArray(job?.completedFloorplans) ? job.completedFloorplans.length : 0,
    hasCalibration: Boolean(job?.pixelsPerMm),
    takeoffName: job?.takeoffName || job?.jobName || data.takeoffName || "",
    sourceFileName: job?.sourceFileName || data.sourceFileName || "",
  };
}

async function independentlyOpenDownloadedTakeoff(authSession, filePath) {
  const importProfileDir = path.join(outDir, `.browser-profile-${runId}-import-check`);
  fs.rmSync(importProfileDir, { recursive: true, force: true });
  const importBrowser = await launchBrowser(importProfileDir);
  try {
    const page = await importBrowser.newPage();
    page.setDefaultTimeout(120000);
    attachDialogHandler(page);
    attachDiagnostics(page);
    await primeBrowserSession(page, authSession);
    await goto(page, finalUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
    const input = await page.waitForSelector("#legacy-job-loader", { timeout: 120000 });
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
  if (record.pageCount !== 5) throw new Error(`Expected 5 plan pages, saw ${record.pageCount}`);
  if (record.wallSegments < 2) throw new Error(`Expected at least 2 connected wall segments, saw ${record.wallSegments}`);
  if (record.openings < 2) throw new Error(`Expected 2 openings, saw ${record.openings}`);
  if (record.floorCoverings < 1) throw new Error(`Expected 1 floor-covering area, saw ${record.floorCoverings}`);
  if (record.floorplans < 1) throw new Error(`Expected 1 footprint area, saw ${record.floorplans}`);
  if (!record.hasCalibration) throw new Error("Expected calibration.");
}

async function screenshot(page, name) {
  const filePath = path.join(outDir, name);
  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
