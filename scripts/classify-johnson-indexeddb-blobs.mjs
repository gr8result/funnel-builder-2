import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const root = path.resolve("test-results/johnson-browser-storage/2026-08-28T05-36-30-389Z/raw-copy/Profile 6/IndexedDB/http_localhost_3000.indexeddb.blob");
const outDir = path.resolve("test-results/johnson-indexeddb-blob-classification", new Date().toISOString().replace(/[:.]/g, "-"));
await fs.mkdir(outDir, { recursive: true });

const terms = [
  "Bob & May Johnson",
  "Johnson 07-123",
  "Johnson 123",
  "928,162.51",
  "928162",
  "2 Anotherstreet",
  "Project Estimate",
  "Estimate Summary",
  "Important Estimate Notice",
  "Estimate Acknowledgement",
  "Acceptance",
  "GoodBuild Quality Builders",
  "QA quality builder",
  "Premier Inclusions",
  "Master Estimate Template",
  "Approved Project Estimate",
  "pageOrder",
  "blocks",
  "pageType",
  "canvasJson",
  "documentBuilder",
];

async function* walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}

function printableAscii(buffer) {
  return buffer.toString("latin1").replace(/[^\x20-\x7e\r\n\t]/g, " ");
}

function printableUtf16(buffer) {
  const text = buffer.toString("utf16le");
  return text.replace(/[^\x20-\x7e\r\n\t]/g, " ");
}

function matches(text) {
  const lower = text.toLowerCase();
  return terms.filter((term) => lower.includes(term.toLowerCase()));
}

function uniq(list) {
  return Array.from(new Set(list.filter(Boolean)));
}

function around(text, term, radius = 140) {
  const idx = text.toLowerCase().indexOf(term.toLowerCase());
  if (idx < 0) return null;
  return text.slice(Math.max(0, idx - radius), Math.min(text.length, idx + term.length + radius)).replace(/\s+/g, " ").trim();
}

const rows = [];
for await (const file of walk(root)) {
  const stat = await fs.stat(file);
  const buffer = await fs.readFile(file);
  const ascii = printableAscii(buffer);
  const utf16 = printableUtf16(buffer);
  const text = `${ascii}\n${utf16}`;
  const hits = matches(text);
  if (!hits.length) continue;
  const pageTypeHits = uniq([...text.matchAll(/pageType"?\s*"?([A-Za-z0-9_-]+)/g)].map((m) => m[1]));
  const pageLabelHits = uniq([...text.matchAll(/Page\s+(?:label|0[1-9]|1[0-9]|2[0-1]|Cover|Estimate Summary|Pricing|Acceptance|Plans|Important Estimate Notice)/gi)].map((m) => m[0]));
  const objectIds = uniq([...text.matchAll(/id"?\s*"?([A-Za-z0-9_-]{4,80})/g)].map((m) => m[1])).slice(0, 80);
  const snippets = Object.fromEntries(hits.map((term) => [term, around(text, term)]));
  rows.push({
    file,
    relativeFile: path.relative(root, file),
    bytes: stat.size,
    modifiedAt: stat.mtime.toISOString(),
    sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
    hits,
    pageTypeHits,
    pageLabelHits,
    objectIds,
    snippets,
  });
}

rows.sort((a, b) => a.modifiedAt.localeCompare(b.modifiedAt) || a.relativeFile.localeCompare(b.relativeFile));
await fs.writeFile(path.join(outDir, "blob-classification.json"), JSON.stringify(rows, null, 2));

const strongest = rows
  .map((row) => ({
    relativeFile: row.relativeFile,
    bytes: row.bytes,
    modifiedAt: row.modifiedAt,
    hits: row.hits,
    pageTypeHits: row.pageTypeHits,
    pageLabelHits: row.pageLabelHits,
    snippets: row.snippets,
  }))
  .filter((row) => row.hits.some((hit) => !["Project Estimate", "pageOrder", "blocks", "pageType"].includes(hit)));

console.log(JSON.stringify({
  outDir,
  matchedBlobCount: rows.length,
  strongestCount: strongest.length,
  strongest,
}, null, 2));
