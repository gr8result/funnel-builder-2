// "Review / Sync Windows": the preview lists what applying the price list changes; applying it touches
// only the WINDOWS section, keeps the builder's uncharged WINDOWS QUOTE / FLYSCREEN QUOTE placeholders,
// and a second sync changes nothing. Optional real job:
//   node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-windows-price-list-sync-action.mjs [job.gr8job]
import assert from "node:assert/strict";
import fs from "node:fs";
import JSZip from "jszip";
import { windowsPriceListSyncPreview, windowsSyncSummary } from "../lib/construction-estimation/windowsPriceListSync.js";

const synthetic = {
  "FIX OUT (88)": { rows: [{ id: "f1", item: "Skirting", excelRate: "$12.00" }] },
  "WINDOWS (46)": { rows: [
    { id: "quote-750", item: "WINDOWS QUOTE", quantity: "", excelRate: "$8,032.00", sourceRow: 750 },
    { id: "quote-753", item: "FLYSCREEN QUOTE", quantity: "", excelRate: "$1,538.99", sourceRow: 753 },
    { id: "custom-1", item: "Builder custom window note", quantity: "1", manualRate: "$250.00" },
  ] },
};

async function check(quotation, name) {
  const preview = windowsPriceListSyncPreview(quotation);
  const windowsName = Object.keys(quotation).find((key) => /^WINDOWS(\s*\(\d+\))?$/i.test(key));
  // Only the WINDOWS section may differ.
  for (const section of Object.keys(quotation)) {
    if (section === windowsName) continue;
    assert.deepEqual(preview.quotation[section], quotation[section], `${name}: ${section} unchanged`);
  }
  const rows = (q) => q[windowsName]?.rows || [];
  for (const id of ["quote-750", "quote-753"]) {
    const before = rows(quotation).find((row) => row.id === id);
    if (!before) continue;
    const after = rows(preview.quotation).find((row) => row.id === id);
    assert.ok(after, `${name}: ${before.item} kept`);
    assert.equal(after.excelRate, before.excelRate, `${name}: ${before.item} rate kept`);
  }
  for (const row of rows(quotation).filter((r) => !r.windowPriceListRow && !String(r.source || "").includes("sync"))) {
    if (Number(String(row.quantity || "").replace(/[^0-9.]/g, "")) > 0 && ["WINDOWS QUOTE", "FLYSCREEN QUOTE"].includes(String(row.item).toUpperCase())) continue;
    assert.ok(rows(preview.quotation).some((r) => r.id === row.id), `${name}: builder row ${row.item} kept`);
  }
  // Applying it twice is the same as once.
  assert.equal(windowsPriceListSyncPreview(preview.quotation).changed, false, `${name}: second sync changes nothing`);
  console.log(`${name}: changed=${preview.changed} added ${preview.added.length}, changed ${preview.updated.length}, removed ${preview.removed.length}, sections removed ${preview.removedSections.length}`);
  return preview;
}

const syntheticPreview = await check(synthetic, "synthetic");
assert.ok(syntheticPreview.changed && syntheticPreview.added.length > 0, "the price list rows are offered on a job that lacks them");
assert.match(windowsSyncSummary(syntheticPreview), /Rows added/);
assert.match(windowsSyncSummary({ changed: false }), /already up to date/);

if (process.argv[2]) {
  const zip = await JSZip.loadAsync(fs.readFileSync(process.argv[2]));
  const quotation = JSON.parse(await zip.file("estimate.json").async("string")).workbook.quotation;
  const real = await check(quotation, "real job");
  console.log(windowsSyncSummary(real, 5).split("\n").slice(0, 14).join("\n"));
}
console.log("PASS: Review / Sync Windows previews, changes only the WINDOWS section, keeps builder placeholders and custom rows, and is idempotent.");
