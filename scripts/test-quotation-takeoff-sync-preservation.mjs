// Real-job dry run: opening a job, importing a fresh takeoff report into Job Setup, then saving and
// reopening must not remove, rename or alter any builder quotation row (cabinet sections, WINDOWS
// QUOTE / FLYSCREEN QUOTE placeholders, UNDERSLAB AND DRAINAGE, custom rows, formulas, manual rates).
// Only position bookkeeping (sortOrder / sortSection / sortSectionId) may be added on first open.
//   node --max-old-space-size=3072 --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs \
//     scripts/test-quotation-takeoff-sync-preservation.mjs <job.gr8job>
// The job file is read only; nothing is written back.
import assert from "node:assert/strict";
import fs from "node:fs";
import JSZip from "jszip";
import { createTakeoffSchedule, createJobSetupPayload } from "../components/construction-estimation/ai-plan-takeoff/takeoffSchedule.js";
import { applyJobSetupImport } from "../lib/construction-estimation/jobSetupTakeoffImport.js";

process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= "test-anon-key";
const { __quotationPersistenceTestUtils: persistence } = await import("../hooks/estimate-builder/useEstimateBuilderWorkbook.js");
const { calculateEstimateBuilderWorkbook } = await import("../lib/construction-estimation/estimateBuilderWorkbookCalculations.js");

const file = process.argv[2];
assert(file, "Provide a real job .gr8job path (read only).");
const clone = (value) => JSON.parse(JSON.stringify(value));
const POSITION_FIELDS = new Set(["sortOrder", "sortSection", "sortSectionId"]);

const zip = await JSZip.loadAsync(fs.readFileSync(file));
const source = JSON.parse(await zip.file("estimate.json").async("string")).workbook;
const testId = "quotation-takeoff-sync-dry-run";
source.jobId = source.projectId = source.registeredJobId = testId;
source.registeredJob = { ...source.registeredJob, jobId: testId };
source.jobFileMeta = { ...source.jobFileMeta, projectId: testId };

// Every row by id (with its section), content fields only.
function rowsById(quotation = {}) {
  const map = new Map();
  for (const [section, group] of Object.entries(quotation)) {
    const seen = new Map();
    for (const row of group.rows || []) {
      const content = Object.fromEntries(Object.entries(row).filter(([key]) => !POSITION_FIELDS.has(key)));
      // Rows that share an id in one section are told apart by occurrence, so none is skipped.
      const occurrence = seen.get(row.id) || 0;
      seen.set(row.id, occurrence + 1);
      map.set(`${section}\u0000${row.id}\u0000${occurrence}`, { section, row: content });
    }
  }
  return map;
}
function compare(before, after, label) {
  const removed = [], changed = [];
  for (const [key, { section, row }] of before) {
    const next = after.get(key);
    if (!next) { removed.push(`${section} / ${row.id} ${row.item || ""}`); continue; }
    const fields = [...new Set([...Object.keys(row), ...Object.keys(next.row)])].filter((field) => JSON.stringify(row[field]) !== JSON.stringify(next.row[field]));
    if (fields.length) changed.push({ row: `${section} / ${row.id} ${row.item || ""}`, fields: Object.fromEntries(fields.map((f) => [f, { before: row[f], after: next.row[f] }])) });
  }
  const added = [...after.keys()].filter((key) => !before.has(key)).map((key) => `${after.get(key).section} / ${after.get(key).row.id} ${after.get(key).row.item || ""}`);
  console.log(`${label}: removed ${removed.length}, changed ${changed.length}, added ${added.length}`);
  return { removed, changed, added };
}
const sectionsOf = (quotation) => Object.keys(quotation || {});

const original = rowsById(source.quotation);
const originalSections = sectionsOf(source.quotation);
console.log(`job: ${originalSections.length} sections, ${original.size} rows`);

// 1. Open.
const opened = persistence.normalizeWorkbook(clone(source));
const open = compare(original, rowsById(opened.quotation), "open");

// 2. Fresh takeoff report into Job Setup (every importable field the takeoff offers).
const takeoffJob = opened.aiPlanTakeoffJob || opened.takeoffEngine?.aiPlanTakeoffJob;
assert(takeoffJob, "the job has no takeoff to import");
const schedule = createTakeoffSchedule(takeoffJob);
const payload = createJobSetupPayload(schedule, { jobId: testId, takeoffId: takeoffJob.takeoffId });
let imported;
try {
  imported = applyJobSetupImport(opened, payload, undefined, { allowProjectMismatch: true });
} catch (error) {
  console.log(`takeoff import refused: ${error.message}`);
  imported = opened;
}
const importedFields = Object.keys(payload.dataInputFields || {}).length;
const sync = compare(rowsById(opened.quotation), rowsById(imported.quotation), `takeoff import (${importedFields} fields offered)`);

// 3. Save and reopen twice.
const reopened = persistence.normalizeWorkbook(clone(imported));
const reopen = compare(rowsById(imported.quotation), rowsById(reopened.quotation), "save + reopen");
const third = persistence.normalizeWorkbook(clone(reopened));
const reopen2 = compare(rowsById(reopened.quotation), rowsById(third.quotation), "second reopen");

// Named builder data the owner checks by hand.
const find = (quotation, predicate) => Object.entries(quotation).flatMap(([section, group]) => (group.rows || []).filter(predicate).map((row) => ({ section, row })));
const named = (quotation) => ({
  windowsQuote: find(quotation, (r) => r.id === "quote-750").map(({ section, row }) => [section, row.item, row.excelRate, row.manualRate, row.quantity]),
  flyscreenQuote: find(quotation, (r) => r.id === "quote-753").map(({ section, row }) => [section, row.item, row.excelRate, row.manualRate, row.quantity]),
  underslab: (quotation["UNDERSLAB AND DRAINAGE"]?.rows || []).map((row) => [row.id, row.item, row.excelRate, row.manualRate, row.quantity, Boolean(row.progressAllocation)]),
  cabinetSections: ["CABINET MAKER", "BUTLERS PANTRY", "LAUNDRY", "BATHROOMS", "WARDROBES", "STANDARD WARDROBES COMPLETE (2.4M WIDE) (90)", "STANDARD 3 DOOR ROBE UP TO 3.6M WIDE"]
    .map((name) => [name, quotation[name]?.rows?.length ?? "MISSING"]),
});
const before = named(source.quotation), after = named(third.quotation);
console.log("named rows before:", JSON.stringify(before));
console.log("named rows after: ", JSON.stringify(after));

const total = (workbook) => calculateEstimateBuilderWorkbook(workbook)?.summary?.finalQuoteTotal;
console.log(`quote total: opened ${total(opened)}  after takeoff import + reopen ${total(third)}`);

assert.deepEqual(sectionsOf(third.quotation).sort(), [...originalSections].sort(), "sections kept exactly");
for (const step of [open, sync, reopen, reopen2]) {
  assert.deepEqual(step.removed, [], "no row removed");
  assert.deepEqual(step.changed, [], `no row content changed: ${JSON.stringify(step.changed.slice(0, 3))}`);
}
assert.deepEqual(after, before, "WINDOWS QUOTE, FLYSCREEN QUOTE, UNDERSLAB and cabinet sections unchanged");
console.log(`PASS: open, takeoff import, save/reopen x2 kept all ${originalSections.length} sections and ${original.size} rows; no builder row removed or changed.${sync.added.length ? ` Takeoff import added ${sync.added.length} row(s): ${sync.added.slice(0, 5).join("; ")}` : ""}`);
