import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runStamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = path.join(root, "test-results", "johnson-browser-storage", runStamp);
const chromeUserData = "C:/Users/grant/AppData/Local/Google/Chrome/User Data";
const terms = [
  "estimate-builder-template-db",
  "active-template-key",
  "current",
  "Johnson 07-123",
  "Johnson 123",
  "Bob & May Johnson",
  "David Ellis",
  "GoodBuild Quality Builders",
  "$928,162.51",
  "928162",
  "Estimate Summary",
  "Important Estimate Notice",
  "Estimate Acknowledgement",
  "Premier Inclusions",
  "Project Estimate",
  "builder-template",
  "projectEstimateBuilder",
  "proposalBuilder",
];

fs.mkdirSync(outDir, { recursive: true });

const report = {
  runStamp,
  chromeUserData,
  outDir,
  remoteDebuggingDetected: await hasRemoteDebuggingEndpoint(),
  profiles: [],
  matches: [],
};

for (const profileDir of listChromeProfiles(chromeUserData)) {
  const profileName = path.basename(profileDir);
  const profileReport = {
    profile: profileName,
    path: profileDir,
    localStorage: inspectStorageDir(path.join(profileDir, "Local Storage"), { maxFiles: 80 }),
    sessionStorage: inspectStorageDir(path.join(profileDir, "Session Storage"), { maxFiles: 80 }),
    indexedDb: inspectIndexedDb(path.join(profileDir, "IndexedDB")),
    cacheStorage: { exists: fs.existsSync(path.join(profileDir, "Cache", "Cache_Data")), skipped: "cache data is not copied during recovery export" },
  };
  report.profiles.push(profileReport);

  const copiedRoot = path.join(outDir, "raw-copy", profileName);
  await copyLocalhostStorage(profileDir, copiedRoot);
}

report.matches = collectTermMatches(path.join(outDir, "raw-copy"));
fs.writeFileSync(path.join(outDir, "browser-storage-export.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));

async function hasRemoteDebuggingEndpoint() {
  try {
    const response = await fetch("http://127.0.0.1:9222/json/version", { signal: AbortSignal.timeout(1000) });
    return response.ok;
  } catch {
    return false;
  }
}

function listChromeProfiles(userDataDir) {
  if (!fs.existsSync(userDataDir)) return [];
  return fs.readdirSync(userDataDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && (entry.name === "Default" || /^Profile \d+$/.test(entry.name)))
    .map((entry) => path.join(userDataDir, entry.name));
}

function inspectStorageDir(dir, { maxFiles = 500 } = {}) {
  if (!fs.existsSync(dir)) return { exists: false, fileCount: 0, bytes: 0, files: [] };
  const files = listFiles(dir, { maxFiles });
  return {
    exists: true,
    fileCount: files.length,
    bytes: files.reduce((sum, file) => sum + fs.statSync(file).size, 0),
    files: files.map((file) => fileSummary(file, dir)).slice(0, 500),
  };
}

function inspectIndexedDb(dir) {
  const summary = inspectStorageDir(dir);
  if (!summary.exists) return { ...summary, databases: [] };
  const databases = fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.endsWith(".indexeddb.leveldb"))
    .map((entry) => {
      const dbDir = path.join(dir, entry.name);
      const files = listFiles(dbDir);
      const text = files
        .filter((file) => /\.(log|ldb|sst)$/i.test(file))
        .map((file) => readPrintable(file))
        .join("\n");
      const objectStoreNames = [...new Set([...text.matchAll(/[\w.-]*(?:template|estimate|project|page|store|current|builder)[\w.-]*/gi)].map((match) => match[0]))]
        .filter((name) => name.length >= 4)
        .slice(0, 80);
      return {
        name: entry.name,
        path: dbDir,
        fileCount: files.length,
        bytes: files.reduce((sum, file) => sum + fs.statSync(file).size, 0),
        inferredObjectStoreNames: objectStoreNames,
      };
    });
  return { ...summary, databases };
}

function listFiles(dir, { maxFiles = 2000 } = {}) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) {
        results.push(full);
        if (results.length >= maxFiles) return results;
      }
    }
  }
  return results;
}

function fileSummary(file, baseDir) {
  const stat = fs.statSync(file);
  return {
    relativePath: path.relative(baseDir, file),
    bytes: stat.size,
    modifiedAt: stat.mtime.toISOString(),
    sha256: stat.size <= 1024 * 1024 ? sha256File(file) : "skipped:large-file",
  };
}

function sha256File(file) {
  try {
    return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  } catch (error) {
    return `unreadable:${error?.code || "error"}`;
  }
}

async function copyDirectoryBestEffort(source, destination) {
  try {
    await fs.promises.cp(source, destination, { recursive: true, force: false, errorOnExist: false });
  } catch (error) {
    fs.mkdirSync(destination, { recursive: true });
    fs.writeFileSync(path.join(destination, "COPY_ERROR.txt"), `${error?.stack || error?.message || error}\n`);
  }
}

async function copyLocalhostStorage(profileDir, copiedRoot) {
  const indexedDb = path.join(profileDir, "IndexedDB");
  if (fs.existsSync(indexedDb)) {
    for (const entry of fs.readdirSync(indexedDb, { withFileTypes: true })) {
      if (!entry.isDirectory() || !/localhost_3000/i.test(entry.name)) continue;
      await copyDirectoryBestEffort(path.join(indexedDb, entry.name), path.join(copiedRoot, "IndexedDB", entry.name));
    }
  }
  const localStorageLevelDb = path.join(profileDir, "Local Storage", "leveldb");
  if (fs.existsSync(localStorageLevelDb)) {
    const destination = path.join(copiedRoot, "Local Storage", "leveldb");
    fs.mkdirSync(destination, { recursive: true });
    for (const file of fs.readdirSync(localStorageLevelDb, { withFileTypes: true })) {
      if (!file.isFile()) continue;
      const source = path.join(localStorageLevelDb, file.name);
      const text = readPrintable(source);
      if (!/localhost:3000|http_localhost_3000|estimate-builder|supabase/i.test(text)) continue;
      fs.copyFileSync(source, path.join(destination, file.name));
    }
  }
}

function collectTermMatches(dir) {
  if (!fs.existsSync(dir)) return [];
  return listFiles(dir, { maxFiles: 5000 }).flatMap((file) => {
    const stat = fs.statSync(file);
    if (stat.size > 12 * 1024 * 1024) return [];
    const text = readPrintable(file);
    if (!text) return [];
    return terms.flatMap((term) => {
      const lower = text.toLowerCase();
      const needle = term.toLowerCase();
      const index = lower.indexOf(needle);
      if (index < 0) return [];
      return [{
        term,
        file: path.relative(outDir, file),
        bytes: fs.statSync(file).size,
        context: text.slice(Math.max(0, index - 120), index + term.length + 180),
      }];
    });
  });
}

function readPrintable(file) {
  try {
    return fs.readFileSync(file)
      .toString("latin1")
      .replace(/[^\x09\x0a\x0d\x20-\x7e]+/g, " ");
  } catch {
    return "";
  }
}
