import assert from 'node:assert/strict';
import { createTakeoffSchedule } from '../components/construction-estimation/ai-plan-takeoff/takeoffSchedule.js';

// Synthetic audit cases, not a reproduction of the reported 15.39 m discrepancy.
const run = (id, lengthMm, extra = {}) => ({
  id, page: 3, nodes: [{ x: 0, y: 0 }, { x: lengthMm, y: 0 }],
  lengthMm, level: 'Second Level', widthOption: '600', widthMm: 600, ...extra,
});
const input = {
  currentPage: 3, totalPages: 5, pixelsPerMm: 1,
  sheetLevels: { 3: 'Second Level', 4: 'Ground Floor' },
  completedEaves: [
    run('stored', 1200),
    run('missing-length', 2300, { lengthMm: undefined }),
    run('zero-length-other-level', 3400, { lengthMm: 0, level: 'Ground Floor', widthOption: 'Special' }),
    run('string-page', 4500, { page: '3' }),
    run('other-page-width', 5600, { page: 4, widthOption: '450', widthMm: 450 }),
  ],
};
const originalInput = structuredClone(input);
const withoutAudit = createTakeoffSchedule(input);
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const originalLog = console.log;
const audits = [];
let withAudit;
try {
  globalThis.window = {};
  console.log = (label, json) => {
    assert.equal(label, '[AI Plan Takeoff eave audit]');
    audits.push(JSON.parse(json));
  };
  withAudit = createTakeoffSchedule(input);
} finally {
  console.log = originalLog;
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
  else delete globalThis.window;
}
assert.deepEqual(input, originalInput, 'The diagnostic must not mutate source measurements');
assert.deepEqual(
  { ...withAudit, generatedAt: null }, { ...withoutAudit, generatedAt: null },
  'Enabling the diagnostic must preserve every schedule section and measurement record',
);
assert.equal(audits.length, 2, 'Capture current sheet and project scope');
const [sheet, project] = audits;
assert.deepEqual(sheet.pages, [3]);
assert.deepEqual(project.pages, [1, 2, 3, 4, 5]);
assert.equal(sheet.completedEaves.length, 5);
assert.deepEqual(sheet.eaves.map((item) => item.id), ['stored', 'missing-length', 'zero-length-other-level']);
assert.equal(sheet.runs[1].lengthMm, null);
assert.equal(sheet.runs[1].storedLengthM, 0);
assert.equal(sheet.runs[1].runLengthM, 2.3);
assert.equal(sheet.runs[1].nodeLengthM, 2.3);
assert.equal(sheet.runs[2].storedLevel, 'Ground Floor');
assert.equal(sheet.runs[2].sheetLevel, 'Second Level');
assert.equal(sheet.runs[2].resolvedSheetLevel, 'Second Level');
assert.equal(sheet.runs[2].widthLabel, '600mm Special');
assert.equal(sheet.runs[2].groupingKey, 'Ground Floor|600mm Special');
assert.equal(project.runs[3].included, false, 'Expose the production filter excluding string page numbers');
assert.equal(sheet.totals.stored.all.storedLengthM, 11.3);
assert.equal(sheet.totals.stored.all.runLengthM, 17);
assert.equal(sheet.totals.filtered.all.storedLengthM, 1.2);
assert.equal(sheet.totals.filtered.all.runLengthM, 6.9);
assert.equal(sheet.totals.filtered.secondLevel.runLengthM, 3.5);
assert.equal(sheet.totals.filtered.otherOrUnassignedLevels.runLengthM, 3.4);
assert.equal(sheet.totals.stored.width600mm.runLengthM, 11.4);
assert.equal(sheet.totals.stored.otherWidths.runLengthM, 5.6);
assert.deepEqual(sheet.groupedRows, withAudit.currentSheet.roofAndEaves);
assert.deepEqual(project.groupedRows, withAudit.projectTotals.roofAndEaves);

console.log('Takeoff eave diagnostic checks passed: lengths, levels, widths, page filtering, and unchanged schedule output.');
console.log('Diagnostic coverage only; the reported 15.39 m discrepancy still requires live run evidence.');
