// Read-only inventory. Run from the repository root; redirect stdout to save it.
// --include-untracked also audits new, non-ignored files without staging them.
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const excludedDirectories = new Set([
  "node_modules", ".git", ".venv", ".history", ".cache", ".vercel",
  "build", "dist", "out", "coverage", "__pycache__", "python-deps", "test-artifacts",
]);
const bands = [
  { label: "10000+", min: 10000, max: Infinity },
  { label: "5000-9999", min: 5000, max: 9999 },
  { label: "2000-4999", min: 2000, max: 4999 },
];
const includeUntracked = process.argv.includes("--include-untracked");
const args = ["ls-files", "--cached", "-z"];
if (includeUntracked) args.push("--others", "--exclude-standard");
const paths = [...new Set(execFileSync("git", args, { encoding: "utf8" })
  .split("\0").filter(Boolean))];
const excluded = [];
const missing = [];
const binary = [];
const oversized = [];
const failures = [];
let cursor = 0;
let textFiles = 0;

async function inspect(filePath) {
  if (filePath.startsWith("public/vendor/") || filePath.split("/").some((part) =>
    excludedDirectories.has(part) || part.startsWith(".next"))) {
    excluded.push(filePath);
    return;
  }
  let handle;
  try {
    handle = await fs.open(filePath, "r");
    const stat = await handle.stat();
    if (!stat.isFile()) return;
    // Avoid reading large binary assets in full just to count source lines.
    const sample = Buffer.alloc(Math.min(8192, stat.size));
    await handle.read(sample, 0, sample.length, 0);
    if (sample.includes(0)) {
      binary.push(filePath);
      return;
    }
    const bytes = await handle.readFile();
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      binary.push(filePath);
      return;
    }
    textFiles += 1;
    let lines = bytes.length && bytes.at(-1) !== 10 ? 1 : 0;
    for (const byte of bytes) if (byte === 10) lines += 1;
    if (lines < 2000) return;
    oversized.push({
      path: filePath,
      lines,
      bytes: bytes.length,
      kind: path.basename(filePath) === "package-lock.json" ? "dependency-lock" : "source/data",
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  } catch (error) {
    if (error.code === "ENOENT") missing.push(filePath);
    else failures.push({ path: filePath, error: error.message });
  } finally {
    await handle?.close();
  }
}

await Promise.all(Array.from({ length: 16 }, async () => {
  while (cursor < paths.length) await inspect(paths[cursor++]);
}));
oversized.sort((a, b) => b.lines - a.lines || a.path.localeCompare(b.path));
const count = (files) => Object.fromEntries(bands.map(({ label, min, max }) =>
  [label, files.filter((file) => file.lines >= min && file.lines <= max).length]));
console.log(JSON.stringify({
  scope: includeUntracked ? "tracked and non-ignored untracked" : "tracked",
  scannedPaths: paths.length,
  textFiles,
  sourceDataBands: count(oversized.filter((file) => file.kind === "source/data")),
  allTextBands: count(oversized),
  oversized,
  excluded: excluded.sort(),
  missing: missing.sort(),
  binary: binary.sort(),
  failures,
}, null, 2));
if (failures.length) process.exitCode = 1;
