// Corrects duplicate floor-waste charges in an ISOLATED job package copy.
// Usage: node scripts/repair-isolated-floor-waste-duplicates.mjs <input.gr8job> <output.gr8job>
// - Never writes to the input file; refuses an output path that already exists.
// - Collapses exact clone floor-waste entries in every saved tiling room list.
// - Tiling floor-waste quotation rows: keeps the first row per id, drops later rows with the same id,
//   and sets the quantity from the corrected room data (unless the builder manually overrode it).
// - Issued/locked quotations are refused.
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { collapseDuplicateFloorWastes } from "../lib/builders/tilingFloorWasteDuplicates.js";

const [input, output] = process.argv.slice(2);
if (!input || !output) { console.error("Usage: <input.gr8job> <output.gr8job>"); process.exit(2); }
if (path.resolve(input) === path.resolve(output)) { console.error("Refusing to overwrite the input package."); process.exit(2); }
if (fs.existsSync(output)) { console.error("Output already exists. Refusing to overwrite."); process.exit(2); }

const num = (v) => (v === "" || v == null ? 0 : Number(String(v).replace(/[$,]/g, "")) || 0);
const zip = await JSZip.loadAsync(fs.readFileSync(input));
const removed = [];
const rowChanges = [];
const correctQty = new Map(); // row id -> corrected quantity

function fixRooms(node, depth = 0) {
  if (!node || typeof node !== "object" || depth > 14) return;
  if (Array.isArray(node.tilingRooms)) {
    const result = collapseDuplicateFloorWastes(node.tilingRooms);
    if (result.removed.length) { node.tilingRooms = result.rooms; removed.push(...result.removed); }
    for (const room of node.tilingRooms) {
      const totals = new Map();
      for (const w of room.floorWastes || []) {
        const id = `tiling:${room.id}:waste-${w.productId}-${w.application}${w.lengthMm ? `-${w.lengthMm}` : ""}`;
        totals.set(id, (totals.get(id) || 0) + (Number(w.quantity) || 0));
      }
      for (const [id, qty] of totals) correctQty.set(id, qty);
    }
  }
  for (const value of Object.values(node)) fixRooms(value, depth + 1);
}
function fixQuotation(node, file, depth = 0) {
  if (!node || typeof node !== "object" || depth > 8) return;
  const q = node.quotation;
  if (q && typeof q === "object" && Object.values(q).some((s) => Array.isArray(s?.rows))) {
    if (node.quotationIssued || node.issuedAt || node.quotationLocked) throw new Error(`${file}: quotation is issued/locked - not modified`);
    for (const [name, section] of Object.entries(q)) {
      const seen = new Set();
      section.rows = (section.rows || []).filter((row) => {
        if (!/^tiling:[^:]+:waste-/.test(row?.id || "")) return true;
        const rate = num(row.manualRate || row.excelRate);
        if (seen.has(row.id)) { rowChanges.push({ file, section: name, id: row.id, change: "removed duplicate row", amountExGst: num(row.quantity) * rate }); return false; }
        seen.add(row.id);
        const target = correctQty.get(row.id);
        if (target != null && !row.quantityManualOverride && num(row.quantity) !== target) {
          rowChanges.push({ file, section: name, id: row.id, change: `quantity ${row.quantity} -> ${target}`, amountExGst: (num(row.quantity) - target) * rate });
          row.quantity = target; row.qty = target;
        }
        return true;
      });
    }
    return;
  }
  for (const value of Object.values(node)) fixQuotation(value, file, depth + 1);
}

const jsonFiles = Object.keys(zip.files).filter((name) => name.endsWith(".json"));
const docs = {};
for (const name of jsonFiles) docs[name] = JSON.parse(await zip.file(name).async("string"));
for (const name of jsonFiles) fixRooms(docs[name]);
for (const name of jsonFiles) fixQuotation(docs[name], name);
// Same serialisation and FNV-1a checksum as lib/jobFile.ts, so the package still verifies on import.
const checksumText = (text) => { let hash = 0x811c9dc5; for (let i = 0; i < text.length; i += 1) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 0x01000193); } return `fnv1a32-${(hash >>> 0).toString(16).padStart(8, "0")}`; };
const manifest = docs["manifest.json"] || {};
for (const name of jsonFiles) {
  if (name === "manifest.json") continue;
  const text = JSON.stringify(docs[name] || {}, null, 2);
  zip.file(name, text);
  const section = name.replace(/\.json$/, "");
  if (manifest.sectionChecksums && section in manifest.sectionChecksums) manifest.sectionChecksums[section] = checksumText(text);
}
manifest.migrationHistory = [...(manifest.migrationHistory || []), { migratedAt: new Date().toISOString(), note: "Isolated copy: duplicate floor-waste clone entries collapsed (repair-isolated-floor-waste-duplicates)." }];
zip.file("manifest.json", JSON.stringify(manifest, null, 2));
fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
fs.writeFileSync(output, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));

const removedRowsExGst = Math.round(rowChanges.reduce((s, c) => s + c.amountExGst, 0) * 100) / 100;
console.log(JSON.stringify({ input, output, duplicateRoomEntries: removed, quotationRowChanges: rowChanges, quotationReductionExGst: removedRowsExGst }, null, 2));
