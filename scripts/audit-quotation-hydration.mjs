import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { createTakeoffSchedule } from "../components/construction-estimation/ai-plan-takeoff/takeoffSchedule.js";

process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= "test-anon-key";
const { __quotationPersistenceTestUtils: persistence } = await import("../hooks/estimate-builder/useEstimateBuilderWorkbook.js");
const { calculateEstimateBuilderWorkbook } = await import("../lib/construction-estimation/estimateBuilderWorkbookCalculations.js");
const outDir = path.resolve("artifacts/test-artifacts/quotation-hydration-integrity");
const files = process.argv.slice(2);
assert(files.length, "Provide one or more real-job package paths; sources are read only.");
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const clone = (value) => JSON.parse(JSON.stringify(value));

function rowsOf(quotation = {}) {
  return Object.entries(quotation).flatMap(([section, group], sectionIndex) => (group.rows || []).map((row, index) => ({ section, sectionIndex, index, row: clone(row) })));
}

function diff(before, after) {
  const buckets = (rows) => {
    const map = new Map();
    for (const entry of rows) map.set(String(entry.row.id), [...(map.get(String(entry.row.id)) || []), entry]);
    return map;
  };
  const prior = buckets(before), next = buckets(after);
  const changes = [];
  for (const id of new Set([...prior.keys(), ...next.keys()])) {
    const old = prior.get(id) || [], current = next.get(id) || [];
    for (let occurrence = 0; occurrence < Math.max(old.length, current.length); occurrence += 1) {
      const from = old[occurrence], to = current[occurrence];
      const fields = from && to ? Object.fromEntries([...new Set([...Object.keys(from.row), ...Object.keys(to.row)])].filter((field) => JSON.stringify(from.row[field]) !== JSON.stringify(to.row[field])).map((field) => [field, { before: from.row[field] ?? null, after: to.row[field] ?? null }])) : {};
      const kind = !from ? "ADDED" : !to ? "REMOVED" : from.section !== to.section ? "MOVED" : Object.keys(fields).length ? "UPDATED" : from.index !== to.index ? "REORDERED" : "UNCHANGED";
      changes.push({ id, occurrence, kind, beforeSection: from?.section || null, afterSection: to?.section || null, beforeIndex: from?.index ?? null, afterIndex: to?.index ?? null, item: to?.row.item || from?.row.item || "", source: to?.row.source || from?.row.source || "", fields, ...(!from || !to ? { beforeRow: from?.row || null, afterRow: to?.row || null } : {}) });
    }
  }
  return changes;
}

function summarize(rows) {
  const ids = new Map();
  for (const { section, row } of rows) ids.set(String(row.id), [...(ids.get(String(row.id)) || []), section]);
  const headings = rows.filter(({ row }) => row.lineType === "Heading" || row.applianceHeading === true || row.lineType === "Appliance heading").length;
  return { rows: rows.length, headings, nonHeadingRows: rows.length - headings, sections: new Set(rows.map((entry) => entry.section)).size, duplicateIds: [...ids].filter(([id, sections]) => id === "undefined" || sections.length > 1).map(([id, sections]) => ({ id, sections })) };
}

fs.mkdirSync(outDir, { recursive: true });
const snapshots = [];
for (const file of files) {
  const sourcePath = path.resolve(file);
  const bytes = fs.readFileSync(sourcePath), sourceHash = hash(bytes);
  const zip = await JSZip.loadAsync(bytes);
  const estimate = JSON.parse(await zip.file("estimate.json").async("string"));
  const isolated = clone(estimate.workbook);
  const isolatedId = `quotation-integrity-test-${sourceHash.slice(0, 12)}`;
  isolated.jobId = isolatedId;
  isolated.projectId = isolatedId;
  isolated.registeredJobId = isolatedId;
  isolated.registeredJob = { ...isolated.registeredJob, jobId: isolatedId };
  isolated.jobFileMeta = { ...isolated.jobFileMeta, projectId: isolatedId };
  const input = rowsOf(isolated.quotation);
  const stages = [];
  let prior = input;
  const hydrated = persistence.normalizeWorkbook(clone(isolated), { onQuotationStage: (stage, workbook) => {
    const rows = rowsOf(workbook.quotation);
    const changes = diff(prior, rows).filter((entry) => entry.kind !== "UNCHANGED");
    stages.push({ stage, ...summarize(rows), changes, counts: changes.reduce((counts, entry) => ({ ...counts, [entry.kind]: (counts[entry.kind] || 0) + 1 }), {}) });
    prior = rows;
  } });
  const reopened = persistence.normalizeWorkbook(clone(hydrated));
  const third = persistence.normalizeWorkbook(clone(reopened));
  const legacyStages = [];
  let legacyPrior = input;
  const legacyHydrated = persistence.normalizeWorkbook(clone(isolated), { allowQuotationHydration: true, onQuotationStage: (stage, workbook) => {
    const rows = rowsOf(workbook.quotation);
    const changes = diff(legacyPrior, rows).filter((entry) => entry.kind !== "UNCHANGED");
    legacyStages.push({ stage, ...summarize(rows), changes, counts: changes.reduce((counts, entry) => ({ ...counts, [entry.kind]: (counts[entry.kind] || 0) + 1 }), {}) });
    legacyPrior = rows;
  } });
  const quoteFile = zip.file("quotation.json") ? JSON.parse(await zip.file("quotation.json").async("string")) : null;
  const calc = calculateEstimateBuilderWorkbook(hydrated);
  const report = {
    sourcePath, sourceHash, isolatedId, savedAt: isolated.savedAt || null,
    savedRows: input,
    input: summarize(input), quotationSectionFile: quoteFile ? summarize(rowsOf(quoteFile.quotation || quoteFile)) : null,
    hydrated: summarize(rowsOf(hydrated.quotation)), summary: calc.summary,
    stages, reconciliation: diff(input, rowsOf(hydrated.quotation)),
    legacyHydration: { ...summarize(rowsOf(legacyHydrated.quotation)), stages: legacyStages, reconciliation: diff(input, rowsOf(legacyHydrated.quotation)), identityRepairs: rowsOf(legacyHydrated.quotation).filter(({ row }) => row.legacyRowId).map(({ section, row }) => ({ section, id: row.id, legacyRowId: row.legacyRowId, legacySectionName: row.legacySectionName, item: row.item, excelRow: row.excelRow })) },
    reopenChanges: diff(rowsOf(hydrated.quotation), rowsOf(reopened.quotation)).filter((entry) => entry.kind !== "UNCHANGED"),
    thirdOpenChanges: diff(rowsOf(reopened.quotation), rowsOf(third.quotation)).filter((entry) => entry.kind !== "UNCHANGED"),
    sectionsBefore: Object.keys(isolated.quotation || {}), sectionsAfter: Object.keys(hydrated.quotation || {}),
    sourceUnchanged: hash(fs.readFileSync(sourcePath)) === sourceHash,
  };
  assert(report.sourceUnchanged, "Source package changed during read-only audit.");
  const economicRows = (rows) => rows.map(({ section, row: { sortOrder, sortSection, sortSectionId, ...row } }) => ({ section, row })).sort((left, right) => `${left.section}:${left.row.id}`.localeCompare(`${right.section}:${right.row.id}`));
  assert.deepEqual(economicRows(rowsOf(hydrated.quotation)), economicRows(input), "Ordinary open changed saved economic quotation data.");
  assert.equal(report.reopenChanges.length, 0, "Reopen changed quotation rows.");
  assert.equal(report.thirdOpenChanges.length, 0, "Repeated reopen changed quotation rows.");
  const prefix = path.join(outDir, sourceHash.slice(0, 12));
  fs.writeFileSync(`${prefix}-report.json`, JSON.stringify(report, null, 2));
  snapshots.push({ sourcePath, sourceHash, rows: input });
  const counts = report.reconciliation.reduce((result, entry) => ({ ...result, [entry.kind]: (result[entry.kind] || 0) + 1 }), {});
  console.log(JSON.stringify({ sourcePath, report: `${prefix}-report.json`, input: report.input.rows, headings: report.input.headings, nonHeadingRows: report.input.nonHeadingRows, sectionFile: report.quotationSectionFile?.rows, hydrated: report.hydrated.rows, counts, legacyRows: report.legacyHydration.rows, legacyStages: legacyStages.map(({ stage, rows, counts }) => ({ stage, rows, counts })), reopenChanges: report.reopenChanges.length, thirdOpenChanges: report.thirdOpenChanges.length, sourceUnchanged: report.sourceUnchanged }, null, 2));
}
for (const snapshot of snapshots.slice(1)) {
  const changes = diff(snapshots[0].rows, snapshot.rows);
  const counts = changes.reduce((result, entry) => ({ ...result, [entry.kind]: (result[entry.kind] || 0) + 1 }), {});
  const additionsBySection = changes.filter((entry) => entry.kind === "ADDED").reduce((result, entry) => ({ ...result, [entry.afterSection]: (result[entry.afterSection] || 0) + 1 }), {});
  const comparison = { before: snapshots[0].sourcePath, after: snapshot.sourcePath, counts, additionsBySection, rows: changes };
  const reportPath = path.join(outDir, `${snapshots[0].sourceHash.slice(0, 12)}-to-${snapshot.sourceHash.slice(0, 12)}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(comparison, null, 2));
  console.log(JSON.stringify({ comparison: reportPath, counts, additionsBySection }, null, 2));
}
const sheetCalibrations = { 1: { pixelsPerMm: 1 }, 2: { pixelsPerMm: 2 } };
const calibratedSchedule = createTakeoffSchedule({ pixelsPerMm: 1, totalPages: 2, sheetCalibrations, scheduleState: { sheetCalibrations }, sheetLevels: { 1: "Ground Floor", 2: "Second Level" }, completedFloorplans: [1, 2].map((page) => ({ id: `calibration-probe-${page}`, page, type: "Living", nodes: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }] })) });
const calibrationProbe = {
  owner: "AI Takeoff", expectedScaleBySheet: [{ page: 1, pixelsPerMm: 1 }, { page: 2, pixelsPerMm: 2 }],
  actualScaleBySheet: calibratedSchedule.project.calibratedScaleBySheet,
  floorAreaRows: calibratedSchedule.projectTotals.floorAreas,
  actualLivingAreaM2: calibratedSchedule.projectTotals.floorAreas.find((row) => row.itemId === "floor_Living")?.quantity,
  expectedTotalFloorAreaM2: 1.25,
  status: JSON.stringify(calibratedSchedule.project.calibratedScaleBySheet) === JSON.stringify([{ page: 1, pixelsPerMm: 1 }, { page: 2, pixelsPerMm: 2 }]) ? "PASS" : "FAIL",
};
fs.writeFileSync(path.join(outDir, "calibration-owner-contract.json"), JSON.stringify(calibrationProbe, null, 2));
console.log(JSON.stringify({ calibrationProbe }, null, 2));