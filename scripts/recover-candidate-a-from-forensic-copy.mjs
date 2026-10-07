import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import puppeteer from "puppeteer";
import { AI_PLAN_TAKEOFF_FILE_TYPE } from "../lib/gr8FileTypes.js";
import { getEmbeddedPlanPages, getTakeoffCounts } from "../components/construction-estimation/ai-plan-takeoff/jobPersistence.js";

const root = path.resolve("e:/dev/funnel-builder-clean");
const forensicRoot = path.join(root, "recovery", "forensic-20260905-083625");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const runDir = path.join(forensicRoot, `candidate-a-extract-${stamp}`);
const userDataDir = path.join(runDir, "user-data");
const profileDir = path.join(userDataDir, "Profile 6");
const outputDir = path.join(runDir, "output");

const CANDIDATE_KEY = "job:03-09/123";
const APP_URL = "http://localhost:3000/modules/estimate-builder?page=aiPlanTakeoff";

fs.mkdirSync(outputDir, { recursive: true });

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (["LOCK", "SingletonLock", "SingletonCookie", "SingletonSocket"].includes(entry.name)) continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else if (entry.isFile()) {
      try {
        fs.copyFileSync(from, to);
      } catch {}
    }
  }
}

function countWindowsDoors(openings = []) {
  let windows = 0;
  let doors = 0;
  for (const opening of Array.isArray(openings) ? openings : []) {
    const text = [opening?.type, opening?.kind, opening?.category, opening?.label, opening?.name]
      .map((value) => String(value || "").toLowerCase())
      .join(" ");
    if (text.includes("window") || /^w\d+/i.test(String(opening?.id || ""))) windows += 1;
    if (text.includes("door") || /^d\d+/i.test(String(opening?.id || ""))) doors += 1;
  }
  return { windows, doors };
}

function countCalibrations(job = {}) {
  const pages = getEmbeddedPlanPages(job);
  let pageScaleCalibrations = 0;
  for (const page of pages) {
    const points = Array.isArray(page?.scale?.calibrationPoints) ? page.scale.calibrationPoints : [];
    if (points.length >= 2) pageScaleCalibrations += 1;
  }
  const hasGlobalCalibration = Number(job?.pixelsPerMm || 0) > 0 ? 1 : 0;
  return {
    pageScaleCalibrations,
    hasGlobalCalibration,
    totalCalibrationSignals: pageScaleCalibrations + hasGlobalCalibration,
  };
}

function sha256Text(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function makePortableBackup(takeoffJob, summary = {}) {
  return {
    gr8FileType: AI_PLAN_TAKEOFF_FILE_TYPE.gr8FileType,
    moduleType: AI_PLAN_TAKEOFF_FILE_TYPE.moduleType,
    schemaVersion: "ai-plan-takeoff.export.v1",
    createdAt: new Date().toISOString(),
    takeoffId: String(takeoffJob?.takeoffId || takeoffJob?.id || "").trim(),
    takeoffName: String(takeoffJob?.takeoffName || takeoffJob?.jobName || summary.displayName || "Recovered Takeoff").trim(),
    associatedProjectId: String(takeoffJob?.associatedProjectId || takeoffJob?.projectId || summary.associatedProjectId || "").trim(),
    associatedProjectName: String(takeoffJob?.associatedProjectName || takeoffJob?.platformProject?.projectName || summary.associatedProjectName || "").trim(),
    sourceFileName: String(takeoffJob?.sourceFileName || "").trim(),
    revision: Number(takeoffJob?.revision || 0),
    counts: getTakeoffCounts(takeoffJob || {}),
    takeoffJob,
  };
}

const report = {
  generatedAt: new Date().toISOString(),
  candidateKey: CANDIDATE_KEY,
  appUrl: APP_URL,
  forensicRoot,
  runDir,
  outputDir,
  copiedArtifactsReady: false,
  extraction: {
    ok: false,
    mode: "",
    message: "",
  },
};

try {
  copyDir(path.join(forensicRoot, "http_localhost_3000.indexeddb.leveldb"), path.join(profileDir, "IndexedDB", "http_localhost_3000.indexeddb.leveldb"));
  copyDir(path.join(forensicRoot, "http_localhost_3000.indexeddb.blob"), path.join(profileDir, "IndexedDB", "http_localhost_3000.indexeddb.blob"));
  copyDir(path.join(forensicRoot, "leveldb"), path.join(profileDir, "Local Storage", "leveldb"));
  if (fs.existsSync(path.join(forensicRoot, "Session Storage"))) {
    copyDir(path.join(forensicRoot, "Session Storage"), path.join(profileDir, "Session Storage"));
  }
  if (fs.existsSync(path.join(forensicRoot, "WebStorage"))) {
    copyDir(path.join(forensicRoot, "WebStorage"), path.join(profileDir, "WebStorage"));
  }
  report.copiedArtifactsReady = true;

  const browser = await puppeteer.launch({
    headless: true,
    userDataDir,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--profile-directory=Profile 6"],
  });

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(120000);
    await page.goto(APP_URL, { waitUntil: "domcontentloaded", timeout: 120000 });

    const state = await page.evaluate(async (candidateKey) => {
      const openDb = () => new Promise((resolve, reject) => {
        const req = indexedDB.open("estimate-builder-template-db", 2);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error("IndexedDB open failed"));
      });
      const db = await openDb();
      try {
        const tx = db.transaction("jobs", "readonly");
        const store = tx.objectStore("jobs");

        const getByKey = (key) => new Promise((resolve, reject) => {
          const req = store.get(key);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => reject(req.error || new Error(`get failed for ${key}`));
        });

        const getKeys = () => new Promise((resolve, reject) => {
          const req = store.getAllKeys();
          req.onsuccess = () => resolve((req.result || []).map((item) => String(item)));
          req.onerror = () => reject(req.error || new Error("getAllKeys failed"));
        });

        const [candidate, active, keys] = await Promise.all([
          getByKey(candidateKey),
          getByKey("active-job"),
          getKeys(),
        ]);

        return { candidate, active, keys };
      } finally {
        db.close();
      }
    }, CANDIDATE_KEY);

    fs.writeFileSync(path.join(outputDir, "indexeddb-keys.json"), JSON.stringify(state.keys || [], null, 2));
    fs.writeFileSync(path.join(outputDir, "active-job-pointer.json"), JSON.stringify(state.active || null, null, 2));

    if (!state.candidate) {
      report.extraction.ok = false;
      report.extraction.mode = "pointer-or-fragment-only";
      report.extraction.message = "Copied storage did not yield a deserialized jobs record for key job:03-09/123 in isolated replay.";
    } else {
      report.extraction.ok = true;
      report.extraction.mode = "full-record";
      const rawPath = path.join(outputDir, "candidate-A-job-03-09-123.raw.json");
      fs.writeFileSync(rawPath, JSON.stringify(state.candidate, null, 2));

      const workbook = state.candidate?.workbook || {};
      const takeoffJob = workbook.aiPlanTakeoffJob || workbook.takeoffEngine?.aiPlanTakeoffJob || null;
      const takeoffPath = path.join(outputDir, "candidate-A-ai-plan-takeoff-job.json");
      fs.writeFileSync(takeoffPath, JSON.stringify(takeoffJob || null, null, 2));

      if (!takeoffJob) {
        report.extraction.ok = false;
        report.extraction.mode = "pointer-or-fragment-only";
        report.extraction.message = "Candidate IndexedDB record exists but contains no recoverable aiPlanTakeoffJob payload.";
      } else {
        const counts = getTakeoffCounts(takeoffJob);
        const pages = getEmbeddedPlanPages(takeoffJob);
        const renderable = pages.filter((pageItem) => typeof pageItem?.dataUrl === "string" && pageItem.dataUrl.startsWith("data:")).length;
        const calibration = countCalibrations(takeoffJob);
        const openingBreakdown = countWindowsDoors(takeoffJob?.placedOpenings || []);

        const portable = makePortableBackup(takeoffJob, {
          displayName: takeoffJob.takeoffName || takeoffJob.jobName || "",
          associatedProjectId: takeoffJob.associatedProjectId || takeoffJob.projectId || "",
          associatedProjectName: takeoffJob.associatedProjectName || takeoffJob.platformProject?.projectName || "",
        });

        const portableJson = JSON.stringify(portable, null, 2);
        const backupPath = path.join(outputDir, `candidate-A-${stamp}.gr8takeoff`);
        fs.writeFileSync(backupPath, portableJson);

        const parsedPortable = JSON.parse(fs.readFileSync(backupPath, "utf8"));
        const parsedJob = parsedPortable.takeoffJob || parsedPortable.takeoffData || parsedPortable.aiPlanTakeoffJob || null;
        const parsedCounts = getTakeoffCounts(parsedJob || {});
        const parsedPages = getEmbeddedPlanPages(parsedJob || {});

        const rawSize = fs.statSync(rawPath).size;
        const backupSize = fs.statSync(backupPath).size;

        report.extraction.message = "Candidate A fully extracted from copied storage and exported as non-zero gr8takeoff backup.";
        report.candidate = {
          key: CANDIDATE_KEY,
          rawPath,
          rawSizeBytes: rawSize,
          savedAt: String(takeoffJob?.updatedAt || state.candidate?.savedAt || "").trim(),
          revision: Number(takeoffJob?.revision || 0),
          planPageCount: counts.planPages,
          renderablePlanPages: renderable,
          calibrationCount: calibration.totalCalibrationSignals,
          pageScaleCalibrations: calibration.pageScaleCalibrations,
          globalCalibrationFlag: calibration.hasGlobalCalibration,
          walls: counts.walls,
          windows: openingBreakdown.windows,
          doors: openingBreakdown.doors,
          areas: counts.floorplans,
          floorCoverings: counts.floorCoverings,
          eaves: counts.eaves,
          measurements: counts.measurements,
          openingsTotal: counts.openings,
          backupPath,
          backupSizeBytes: backupSize,
          backupSha256: sha256Text(portableJson),
        };

        report.parsedBackup = {
          parseOk: Boolean(parsedJob),
          revision: Number(parsedJob?.revision || 0),
          savedAt: String(parsedJob?.updatedAt || "").trim(),
          planPageCount: parsedCounts.planPages,
          renderablePlanPages: parsedPages.filter((pageItem) => typeof pageItem?.dataUrl === "string" && pageItem.dataUrl.startsWith("data:")).length,
          walls: parsedCounts.walls,
          openings: parsedCounts.openings,
          floorCoverings: parsedCounts.floorCoverings,
          areas: parsedCounts.floorplans,
          eaves: parsedCounts.eaves,
          measurements: parsedCounts.measurements,
        };
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }
} catch (error) {
  report.extraction.ok = false;
  report.extraction.mode = "failed";
  report.extraction.message = error?.stack || error?.message || String(error);
}

const outPath = path.join(outputDir, "candidate-a-recovery-report.json");
fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ outPath, extraction: report.extraction, candidate: report.candidate || null, parsedBackup: report.parsedBackup || null }, null, 2));
