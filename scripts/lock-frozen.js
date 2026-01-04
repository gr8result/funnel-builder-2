// scripts/lock-frozen.js
// Creates/updates scripts/.frozen.json from the list in scripts/frozen.list.
// Each line in frozen.list is a relative file path (no globs). Blank lines and # comments are ignored.
// Example lines:
//   pages/dashboard.js
//   components/SideNav.jsx

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const LIST = path.join(process.cwd(), "scripts", "frozen.list");
const SNAP = path.join(process.cwd(), "scripts", ".frozen.json");

function sha256(buf) {
  return require("crypto").createHash("sha256").update(buf).digest("hex");
}

function cleanLine(s) {
  return s.trim().replace(/\\/g, "/");
}

function readList() {
  if (!fs.existsSync(LIST)) {
    console.error("scripts/frozen.list not found. Create it with one relative file path per line.");
    process.exit(1);
  }
  const lines = fs.readFileSync(LIST, "utf8").split(/\r?\n/);
  return lines
    .map(cleanLine)
    .filter((s) => s.length && !s.startsWith("#"));
}

function snapFor(paths) {
  const files = {};
  for (const rel of paths) {
    const abs = path.join(process.cwd(), rel);
    if (!fs.existsSync(abs)) {
      console.error(`• Skipping (not found): ${rel}`);
      continue;
    }
    const buf = fs.readFileSync(abs);
    files[rel] = sha256(buf);
  }
  return {
    createdAt: new Date().toISOString(),
    files,
  };
}

(function main() {
  const items = readList();
  if (!items.length) {
    console.error("frozen.list is empty — add paths to lock, one per line.");
    process.exit(1);
  }
  const snap = snapFor(items);
  fs.writeFileSync(SNAP, JSON.stringify(snap, null, 2));
  console.log(`Wrote snapshot for ${Object.keys(snap.files).length} file(s) -> scripts/.frozen.json`);
})();
