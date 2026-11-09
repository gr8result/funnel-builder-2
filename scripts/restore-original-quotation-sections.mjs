// Restores the original quotation categories and rows that later code removed from a job, onto a COPY.
// Never writes to the browser or the live job: it reads two files and writes a new one.
//
//   node scripts/restore-original-quotation-sections.mjs <current job record .json | .gr8job> <original .gr8job> <out .gr8job> [report.json]
//
// What it restores (verbatim, every field of every row, from the original):
//   - quotation sections that exist in the original and not in the current job (for job 03/09: the seven
//     Cabinet Maker sections deleted by the 8 Oct 2026 cabinetry merge, 132 rows);
//   - rows of the original that are missing from a section the current job still has (for job 03/09:
//     WINDOWS QUOTE and FLYSCREEN QUOTE, removed when the windows price list arrived).
// Nothing in the current job is removed or changed: current rows, rates and edits made after the
// original was saved all stay. Section order becomes the original order, with sections that are new
// since then kept where they are relative to their neighbours.
import fs from "node:fs";
import crypto from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const JSZip = require("jszip");

const findWorkbook = (o, depth = 0) => {
  if (!o || typeof o !== "object" || depth > 5) return null;
  if (o.quotation && typeof o.quotation === "object" && !Array.isArray(o.quotation)) return o;
  for (const v of Object.values(o)) { const r = findWorkbook(v, depth + 1); if (r) return r; }
  return null;
};
async function load(file) {
  if (/\.gr8job$/i.test(file)) {
    const zip = await JSZip.loadAsync(fs.readFileSync(file));
    const name = Object.keys(zip.files).find((n) => /estimate\.json$/.test(n));
    const data = JSON.parse(await zip.file(name).async("string"));
    return { data, workbook: findWorkbook(data) };
  }
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  return { data, workbook: findWorkbook(data) };
}

export const sectionSlug = (name) => `quote-section:${String(name).replace(/\s*\(\d+\)\s*$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;
const rowKey = (row, index) => row?.id || `#${index}`;
const orderOf = (wb) => {
  const q = wb.quotation; const names = Object.keys(q);
  const saved = Array.isArray(wb.quotationSectionOrder) ? wb.quotationSectionOrder.filter((n) => n in q) : [];
  if (saved.length) return [...saved, ...names.filter((n) => !saved.includes(n))];
  return [...names].sort((a, b) => (q[a].sortOrder ?? 1e9) - (q[b].sortOrder ?? 1e9));
};

// Original order first; a section that is new since then goes straight after the section it follows today.
export function mergeOrder(originalOrder, currentOrder) {
  const merged = [...originalOrder];
  currentOrder.forEach((name, index) => {
    if (merged.includes(name)) return;
    let at = merged.length;
    for (let i = index - 1; i >= 0; i -= 1) { const prev = merged.indexOf(currentOrder[i]); if (prev >= 0) { at = prev + 1; break; } }
    merged.splice(at, 0, name);
  });
  return merged;
}

export function restoreOriginalSections(current, original, options = {}) {
  const q = structuredClone(current.quotation);
  const report = { restoredSections: [], restoredRows: [], keptCurrentRows: 0 };
  const origOrder = orderOf(original);
  for (const name of origOrder) {
    const src = original.quotation[name];
    if (!(name in q)) {
      const { id, sectionId, ...meta } = src;
      q[name] = { ...structuredClone(meta), rows: structuredClone(src.rows || []), id: options.uuid ? options.uuid() : crypto.randomUUID(), sectionId: sectionSlug(name), restoredFrom: options.sourceLabel || "original" };
      report.restoredSections.push({ name, rows: (src.rows || []).length });
      continue;
    }
    const have = new Set((q[name].rows || []).map(rowKey));
    const rows = [...(q[name].rows || [])];
    (src.rows || []).forEach((row, index) => {
      if (have.has(rowKey(row, index))) return;
      // Put the row back after the original row that preceded it (or at the top).
      let at = 0;
      for (let i = index - 1; i >= 0; i -= 1) { const p = rows.findIndex((r, j) => rowKey(r, j) === rowKey(src.rows[i], i)); if (p >= 0) { at = p + 1; break; } }
      rows.splice(at, 0, structuredClone(row));
      report.restoredRows.push({ section: name, id: row.id, item: row.item });
    });
    q[name] = { ...q[name], rows };
  }
  // Only restored sections change the order; adding rows to existing sections keeps the current order
  // (an older original may not hold a reliable order for sections added since).
  const order = report.restoredSections.length ? mergeOrder(origOrder, orderOf(current)) : orderOf(current);
  order.forEach((name, index) => { q[name] = { ...q[name], sortOrder: index + 1 }; });
  const ordered = Object.fromEntries(order.map((name) => [name, q[name]]));
  report.keptCurrentRows = Object.values(current.quotation).reduce((n, s) => n + (s.rows || []).length, 0);
  return {
    workbook: { ...current, quotation: ordered, quotationSectionOrder: order, quotationSectionOrderIds: order.map((name) => ordered[name].sectionId || sectionSlug(name)) },
    report,
  };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) {
  const [currentFile, originalFile, outFile, reportFile] = process.argv.slice(2);
  if (!currentFile || !originalFile || !outFile) { console.error("usage: <current> <original.gr8job> <out.gr8job> [report.json]"); process.exit(2); }
  const cur = await load(currentFile); const orig = await load(originalFile);
  const { workbook, report } = restoreOriginalSections(cur.workbook, orig.workbook, { sourceLabel: originalFile.split(/[\\/]/).pop() });
  const zip = new JSZip(); zip.file("estimate.json", JSON.stringify({ workbook }));
  fs.writeFileSync(outFile, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
  // The same workbook as a browser job record (for an isolated replay only).
  if (cur.data?.key && cur.data?.workbook) fs.writeFileSync(outFile.replace(/\.gr8job$/i, ".record.json"), JSON.stringify({ ...cur.data, workbook }));
  const summary = { current: currentFile, original: originalFile, out: outFile, sections: Object.keys(workbook.quotation).length, rows: Object.values(workbook.quotation).reduce((n, s) => n + (s.rows || []).length, 0), ...report };
  if (reportFile) fs.writeFileSync(reportFile, JSON.stringify(summary, null, 1));
  console.log(JSON.stringify({ ...summary, restoredRows: summary.restoredRows.length, restoredSections: summary.restoredSections }, null, 1));
}
