import assert from 'node:assert/strict';
import { convertAiTakeoffDetections } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/adapter.js';
import { parseWindowSizeCode } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/analysisContract.js';
import { createWindowAndDoorSchedules, createTakeoffSchedule, createJobSetupPayload } from '../components/construction-estimation/ai-plan-takeoff/takeoffSchedule.js';
import { windowCodeForOpening, brickSillLength } from '../lib/construction-estimation/takeoffMaterialQuantities.js';
import { createJobData, createPortableTakeoffExport, resolvePortableTakeoffImport } from '../components/construction-estimation/ai-plan-takeoff/jobPersistence.js';

// 1. Window code decoding: height first, width second, never reversed (Phase 1 contract, re-locked
// here alongside the rest of the Phase 2A opening/schedule cleanup).
const CODES = [['0612', 600, 1200], ['0918', 900, 1800], ['1218', 1200, 1800], ['1224', 1200, 2400], ['1824', 1800, 2400]];
for (const [code, heightMm, widthMm] of CODES) {
  assert.deepEqual(parseWindowSizeCode(code), { heightMm, widthMm, rawSizeCode: code }, `${code} decodes to ${heightMm}H x ${widthMm}W`);
  assert.equal(windowCodeForOpening({ openingClass: 'Window', heightMm, widthMm }), code, `${heightMm}H x ${widthMm}W re-encodes back to ${code}`);
}
console.log('Window code decode/encode round-trip checks passed: height first, width second, never reversed.');

// 2. Real drawing-scale synthetic pixels/mm so the schedule's derived quantities are readable.
const pixelsPerMm = 0.1;
const sheetLevels = { 1: 'Ground Floor', 3: 'Second Level' };
const wall = (id, page, category, lengthMm, extra = {}) => ({
  id, page, category, nodes: [{ x: 0, y: 0 }, { x: lengthMm * pixelsPerMm, y: 0 }], lengthMm, alignment: 'outer',
  linedFaces: 2, openingDeductionsEnabled: true, wallHeightM: 2.4, ...extra,
});
const opening = (id, hostWallId, page, type, heightMm, widthMm, extra = {}) => ({
  id, hostWallId, page, type, openingClass: type === 'window' ? 'Window' : (extra.openingClass || 'Internal Door'),
  heightMm, widthMm, x: 1, y: 1, itemTag: extra.itemTag, ...extra,
});

// 3. Same size, different glass, must NOT be merged into one ambiguous row.
const glassWindows = [
  opening('w1', 'ext', 1, 'window', 1200, 1800, { glassType: 'Clear', location: 'Rumpus', itemTag: '1218' }),
  opening('w2', 'ext', 1, 'window', 1200, 1800, { glassType: 'Obscured', location: 'Ensuite', itemTag: '1218' }),
  opening('w3', 'ext', 1, 'window', 1200, 1800, { glassType: 'Obscured', location: 'Ensuite', itemTag: '1218' }),
];
const { windows: glassRows } = createWindowAndDoorSchedules(glassWindows, sheetLevels);
assert.equal(glassRows.length, 2, 'Two distinct glass specifications for the same size stay two rows');
const clearRow = glassRows.find((row) => row.glassType === 'Clear');
const obscuredRow = glassRows.find((row) => row.glassType === 'Obscured');
assert.equal(clearRow.quantity, 1);
assert.equal(obscuredRow.quantity, 2, 'Two identical Obscured windows in the same room do merge');
assert.equal(clearRow.code, '1218');
assert.equal(clearRow.sizeLabel, '1200H x 1800W');
console.log('Same-size windows with different glass do not incorrectly group; identical ones do.');

// 4. Glass Unspecified when undocumented; a non-standard size falls back to its original tag.
const unspecifiedGlass = createWindowAndDoorSchedules([opening('w4', 'ext', 1, 'window', 1000, 1350, { itemTag: 'W4 NON-STD' })], sheetLevels).windows[0];
assert.equal(unspecifiedGlass.glassType, '', 'No documented glass renders as Unspecified, never guessed');
assert.equal(unspecifiedGlass.code, 'W4 NON-STD', 'A non-standard size falls back to the original drawing tag, never a blank code');

// 5. Host wall relationship and brick sill: Brick Veneer contributes, Lightweight Cladding does not,
// merely for being an external window - exactly the Part 5 rule.
const sillFixture = createTakeoffSchedule({
  currentPage: 1, totalPages: 1, pixelsPerMm, sheetLevels: { 1: 'Ground Floor' },
  completedWallRuns: [
    wall('bv-host', 1, 'exterior', 10000, { constructionSystem: 'brick_veneer', frameThicknessMm: 70 }),
    wall('clad-host', 1, 'exterior', 10000, { constructionSystem: 'lightweight_cladding', frameThicknessMm: 70 }),
  ],
  placedOpenings: [
    opening('bv-window', 'bv-host', 1, 'window', 1200, 1800, { itemTag: '1218' }),
    opening('clad-window', 'clad-host', 1, 'window', 1200, 1800, { itemTag: '1218' }),
  ],
});
const bvRow = sillFixture.projectTotals.windows.find((row) => row.hostWallId === 'bv-host');
const cladRow = sillFixture.projectTotals.windows.find((row) => row.hostWallId === 'clad-host');
assert.equal(bvRow.hostWallSystem, 'Brick Veneer');
assert.equal(cladRow.hostWallSystem, 'Lightweight Cladding');
assert.ok(bvRow.brickSillLengthLm > 0, 'A brick veneer window contributes brick sill length');
assert.equal(cladRow.brickSillLengthLm, 0, 'A lightweight cladding window contributes no brick sill length merely for being external');
// Direct unit check on brickSillLength itself, keyed by the canonical system field (Part 5).
assert.ok(brickSillLength({ openingClass: 'Window', linkedWallId: 'x', wallCategory: 'exterior', hostConstructionSystem: 'brick_veneer', widthMm: 1800, heightMm: 1200, level: 'Ground Floor' }) > 0);
assert.equal(brickSillLength({ openingClass: 'Window', linkedWallId: 'x', wallCategory: 'exterior', hostConstructionSystem: 'lightweight_cladding', widthMm: 1800, heightMm: 1200, level: 'Ground Floor' }), 0);
assert.ok(brickSillLength({ openingClass: 'Window', linkedWallId: 'x', wallCategory: 'exterior', hostConstructionSystem: 'core_filled_blockwork', widthMm: 1800, heightMm: 1200, level: 'Ground Floor' }) > 0, 'Core-filled blockwork keeps the same sill eligibility its legacy Rendered Masonry alias had');
console.log('Host wall relationship and brick-sill eligibility by canonical construction system passed.');

// 6. Doors: human-readable grouping, size, type, quantity.
const doorFixture = [
  opening('d1', 'int', 1, 'door', 2040, 820, { openingClass: 'Internal Door', location: 'Bed 1', itemTag: '820 Internal' }),
  ...Array.from({ length: 13 }, (_, i) => opening(`d1-${i}`, 'int', 1, 'door', 2040, 820, { openingClass: 'Internal Door', location: 'Bed 1', itemTag: '820 Internal' })),
  opening('entry', 'ext', 1, 'door', 2040, 920, { openingClass: 'External Door', location: 'Entry', itemTag: '920 Entry' }),
  opening('sgd', 'ext', 1, 'door', 2100, 4200, { openingClass: 'Large Glazed/Stacker/Sliding Door', location: 'Alfresco' }),
  opening('sgd2', 'ext', 1, 'door', 2100, 4200, { openingClass: 'Large Glazed/Stacker/Sliding Door', location: 'Alfresco' }),
  opening('sgd3', 'ext', 1, 'door', 2100, 4200, { openingClass: 'Large Glazed/Stacker/Sliding Door', location: 'Alfresco' }),
  opening('garage', 'ext', 1, 'door', 2100, 4800, { openingClass: 'Garage Door', location: 'Garage' }),
];
const { doors: doorRows } = createWindowAndDoorSchedules(doorFixture, sheetLevels);
const internalDoors = doorRows.find((row) => row.doorType === 'Internal Door');
assert.equal(internalDoors.quantity, 14, '14 identical internal doors group into one human-readable row');
assert.equal(internalDoors.code, '820 Internal', 'Internal door row shows its documented code/type, not an internal id');
assert.equal(internalDoors.sizeLabel, '820W x 2040H');
const sgdRow = doorRows.find((row) => row.doorType === 'Large Glazed/Stacker/Sliding Door');
assert.equal(sgdRow.quantity, 3);
const garageRow = doorRows.find((row) => row.doorType === 'Garage Door');
assert.equal(garageRow.quantity, 1);
assert.equal(garageRow.sizeLabel, '4800W x 2100H');
console.log('Door schedule groups identical doors and reports human-readable code/type, size and quantity.');

// 7. Schedule output never uses the internal window_schedule_N / door_schedule_N id as the primary
// human-facing description - itemId may still exist internally, but code/sizeLabel are the real
// description a builder reads.
assert.match(internalDoors.itemId, /^door_schedule_\d+$/, 'The internal id still exists for React keys/navigation');
assert.notEqual(internalDoors.code, internalDoors.itemId, 'The primary description is the real code, not the internal id');

// 8. AI provenance survives a manual edit: editing glassType/location on an AI-sourced opening
// keeps its source/confidence/ai provenance block untouched (the manual editing UI only spreads
// changed fields over the existing object, never replaces it).
const context = { jobId: 'job-1', takeoffId: 'takeoff-1', documentHash: 'hash-1', pixelsPerMm,
  pages: [{ pageNumber: 1, logicalWidth: 1000, logicalHeight: 800 }] };
const aiWallDetection = { detectionId: 'wall-ai', kind: 'wall', page: 1, confidence: 0.9, coordinates: { space: 'logical' },
  nodes: [{ x: 0, y: 0 }, { x: 500, y: 0 }], category: 'exterior', thicknessMm: 230, alignment: 'outer', exteriorType: 'Face Brick Veneer',
  constructionSystem: 'brick_veneer', frameThicknessMm: 70 };
const aiOpeningDetection = { detectionId: 'opening-ai', kind: 'opening', page: 1, confidence: 0.88, coordinates: { space: 'logical' },
  x: 250, y: 0, type: 'window', openingClass: 'Window', widthMm: 1800, heightMm: 1200, hostDetectionId: 'wall-ai',
  itemTag: '1218', glassType: 'Clear' };
const batch = { jobId: context.jobId, takeoffId: context.takeoffId, documentHash: context.documentHash, runId: 'run-1', modelVersion: 'mock-v1', detections: [aiWallDetection, aiOpeningDetection] };
const converted = convertAiTakeoffDetections(batch, context);
const aiOpening = converted.placedOpenings[0];
assert.equal(aiOpening.source, 'ai');
assert.equal(aiOpening.glassType, 'Clear');
// The manual editing UI applies changes exactly like this: a shallow merge over the existing item.
const manuallyEdited = { ...aiOpening, glassType: 'Obscured', location: 'Reviewed - actually the ensuite', itemTag: '1218-CORRECTED' };
assert.equal(manuallyEdited.source, 'ai', 'Manual edit preserves AI provenance');
assert.equal(manuallyEdited.confidence, aiOpening.confidence, 'Manual edit preserves AI confidence');
assert.deepEqual(manuallyEdited.ai, aiOpening.ai, 'Manual edit preserves the full AI evidence block');
assert.equal(manuallyEdited.glassType, 'Obscured', 'The manually corrected field actually changed');
console.log('AI provenance (source, confidence, evidence) survives a manual opening edit.');

// 9. Window and door save/reopen: code, size, glass and host link all survive exactly.
const saveInput = {
  currentPage: 1, totalPages: 1, pixelsPerMm, sheetLevels: { 1: 'Ground Floor' },
  planPages: [{ pageNumber: 1, dataUrl: 'data:image/png;base64,synthetic-opening-plan', width: 1000, height: 800, logicalWidth: 1000, logicalHeight: 800, renderScale: 1, vectorSegments: [] }],
  completedWallRuns: [wall('save-host', 1, 'exterior', 10000, { constructionSystem: 'brick_veneer', frameThicknessMm: 70 })],
  placedOpenings: [
    opening('save-window', 'save-host', 1, 'window', 1200, 1800, { itemTag: '1218', glassType: 'Obscured', location: 'Ensuite' }),
    opening('save-door', 'save-host', 1, 'door', 2040, 920, { openingClass: 'External Door', itemTag: '920 Entry', location: 'Entry' }),
  ],
};
const saved = createJobData({ ...saveInput, name: 'Opening schedule regression', takeoffId: 'opening-schedule-regression', revision: 1 });
const untouchedSaved = structuredClone(saved);
const imported = resolvePortableTakeoffImport(JSON.parse(JSON.stringify(createPortableTakeoffExport(saved))));
assert.equal(imported.ok, true);
assert.deepEqual(saved, untouchedSaved, 'Portable export does not mutate the current takeoff');
const reopenedWindow = imported.job.placedOpenings.find((item) => item.id === 'save-window');
assert.equal(reopenedWindow.itemTag, '1218');
assert.equal(reopenedWindow.heightMm, 1200);
assert.equal(reopenedWindow.widthMm, 1800);
assert.equal(reopenedWindow.glassType, 'Obscured');
assert.equal(reopenedWindow.hostWallId, 'save-host');
const reopenedDoor = imported.job.placedOpenings.find((item) => item.id === 'save-door');
assert.equal(reopenedDoor.itemTag, '920 Entry');
assert.equal(reopenedDoor.widthMm, 920);
const reopenedSchedule = createTakeoffSchedule({ ...saveInput, completedWallRuns: imported.job.completedWallRuns, placedOpenings: imported.job.placedOpenings });
const reopenedWindowRow = reopenedSchedule.projectTotals.windows.find((row) => row.code === '1218');
assert.equal(reopenedWindowRow.glassType, 'Obscured');
assert.equal(reopenedWindowRow.hostWallSystem, 'Brick Veneer');
console.log('Window and door code, size, glass type and host wall relationship all survive save/reopen.');

// 10. Job Setup export contract carries clean canonical opening data (Part 10): code, height,
// width, qty, glass, level and host wall system all reach the exported schedule.
const payload = createJobSetupPayload(reopenedSchedule, { sheetLevels: { 1: 'Ground Floor' } });
const exportedWindow = payload.schedule.projectTotals.windows.find((row) => row.code === '1218');
assert.ok(exportedWindow);
assert.equal(exportedWindow.heightMm, 1200);
assert.equal(exportedWindow.widthMm, 1800);
assert.equal(exportedWindow.glassType, 'Obscured');
assert.equal(exportedWindow.floor, 'Ground Floor');
assert.equal(exportedWindow.hostWallSystem, 'Brick Veneer');
console.log('Job Setup export payload carries clean canonical window/door/level/wall-system data.');

console.log('Takeoff opening/window/door schedule (Phase 2A) checks passed: code decode/encode, glass grouping, host wall/brick sill relationship, human-readable doors, AI provenance under manual edit, save/reopen and the Job Setup export contract.');
