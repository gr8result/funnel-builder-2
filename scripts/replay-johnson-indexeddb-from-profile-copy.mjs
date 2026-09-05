import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import puppeteer from "puppeteer";

const RAW_EXPORT_ROOT = path.resolve("test-results/johnson-browser-storage/2026-08-28T05-36-30-389Z/raw-copy");
const RAW_PROFILE = path.join(RAW_EXPORT_ROOT, "Profile 6");
const outDir = path.resolve("test-results/johnson-indexeddb-replay", new Date().toISOString().replace(/[:.]/g, "-"));
const userDataDir = path.join(outDir, "user-data");
const replayProfile = path.join(userDataDir, "Profile 6");
await fs.mkdir(replayProfile, { recursive: true });

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.name === "LOCK" || entry.name === "SingletonLock" || entry.name === "SingletonCookie" || entry.name === "SingletonSocket") continue;
    if (entry.isDirectory()) {
      await copyDir(from, to);
    } else if (entry.isFile()) {
      await fs.copyFile(from, to).catch(() => {});
    }
  }
}

await copyDir(RAW_PROFILE, replayProfile);
await fs.copyFile(path.join(RAW_EXPORT_ROOT, "Local State"), path.join(userDataDir, "Local State")).catch(() => {});

const browser = await puppeteer.launch({
  headless: true,
  userDataDir,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--profile-directory=Profile 6",
  ],
});

try {
  const page = await browser.newPage();
  await page.goto("http://localhost:3000/modules/estimate-builder", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => Boolean(window.indexedDB), { timeout: 10000 });

  const dump = await page.evaluate(async () => {
    const clone = (value) => {
      try {
        return JSON.parse(JSON.stringify(value));
      } catch {
        return { unserializable: String(value) };
      }
    };
    const readStore = (db, storeName) =>
      new Promise((resolve) => {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve(clone(req.result || []));
        req.onerror = () => resolve({ error: req.error?.message || "getAll failed" });
      });
    const databases = typeof indexedDB.databases === "function" ? await indexedDB.databases() : [];
    const output = [];
    for (const info of databases) {
      const dbName = info.name;
      if (!dbName) continue;
      const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open(dbName);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }).catch((error) => ({ error: error?.message || String(error) }));
      if (!db || db.error) {
        output.push({ name: dbName, error: db?.error || "open failed" });
        continue;
      }
      const stores = Array.from(db.objectStoreNames);
      const records = {};
      for (const storeName of stores) records[storeName] = await readStore(db, storeName);
      db.close();
      output.push({ name: dbName, version: info.version, stores, records });
    }
    return output;
  });

  const terms = [
    "Johnson",
    "Bob",
    "May",
    "Johnson 07-123",
    "928162",
    "928,162.51",
    "2 Anotherstreet",
    "GoodBuild Quality Builders",
    "Project Estimate",
    "Estimate Summary",
    "Important Estimate Notice",
    "Acceptance",
    "Premier Inclusions",
    "master-estimate-template",
  ];

  const candidates = [];
  for (const database of dump) {
    for (const [storeName, records] of Object.entries(database.records || {})) {
      if (!Array.isArray(records)) continue;
      records.forEach((record, index) => {
        const text = JSON.stringify(record);
        const hits = terms.filter((term) => text.toLowerCase().includes(term.toLowerCase()));
        if (!hits.length) return;
        const pages = Array.isArray(record?.pages)
          ? record.pages
          : Array.isArray(record?.builder?.pages)
            ? record.builder.pages
            : Array.isArray(record?.projectEstimateBuilder?.pages)
              ? record.projectEstimateBuilder.pages
              : [];
        candidates.push({
          database: database.name,
          storeName,
          index,
          key: record?.key || record?.id || record?.templateKey || record?.jobKey || null,
          name: record?.name || record?.templateName || record?.title || record?.activeDocumentName || null,
          savedAt: record?.savedAt || record?.updatedAt || record?.createdAt || null,
          pageCount: pages.length,
          pageNames: pages.map((page) => page?.name || page?.pageName || page?.title || page?.pageType || page?.id).filter(Boolean),
          hits,
          sha256: crypto.createHash("sha256").update(text).digest("hex"),
          record,
        });
      });
    }
  }

  await fs.writeFile(path.join(outDir, "indexeddb-dump.json"), JSON.stringify(dump, null, 2));
  await fs.writeFile(path.join(outDir, "indexeddb-candidates.json"), JSON.stringify(candidates, null, 2));
  console.log(JSON.stringify({
    outDir,
    databaseCount: dump.length,
    databases: dump.map((db) => ({ name: db.name, version: db.version, stores: db.stores })),
    candidateCount: candidates.length,
    candidates: candidates.map(({ record, ...candidate }) => candidate),
  }, null, 2));
} finally {
  await browser.close();
}
