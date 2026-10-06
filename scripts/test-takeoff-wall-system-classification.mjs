import assert from 'node:assert/strict';
import { convertAiTakeoffDetections } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/adapter.js';
import {
  resolveConstructionSystem, EXTERIOR_CONSTRUCTION_SYSTEMS, INTERIOR_CONSTRUCTION_SYSTEMS,
  CLADDING_PRODUCTS, CLADDING_PRODUCT_CUSTOM,
} from '../components/construction-estimation/ai-plan-takeoff/takeoffRunData.js';
import { createTakeoffSchedule, createJobSetupPayload } from '../components/construction-estimation/ai-plan-takeoff/takeoffSchedule.js';
import { createJobData, createPortableTakeoffExport, resolvePortableTakeoffImport } from '../components/construction-estimation/ai-plan-takeoff/jobPersistence.js';

// 1-9: canonical exterior/interior systems classify correctly, independent of the legacy
// exteriorType axis, with the correct frame and no invented overall thickness for cladding.
const wall = (extra = {}) => ({ id: `wall-${Math.random()}`, category: 'exterior', ...extra });

const bv70 = resolveConstructionSystem(wall({ constructionSystem: 'brick_veneer', frameThicknessMm: 70 }));
assert.equal(bv70.system, 'brick_veneer');
assert.equal(bv70.frameThicknessMm, 70);
assert.equal(bv70.overallNominalThicknessMm, 230, '230mm nominal for a 70mm-framed brick veneer wall');
assert.equal(bv70.displayLabel, '230mm Brick Veneer');
assert.equal(bv70.frameMaterial, 'timber');
assert.equal(bv70.classificationStatus, 'classified');

const bv90 = resolveConstructionSystem(wall({ constructionSystem: 'brick_veneer', frameThicknessMm: 90 }));
assert.equal(bv90.overallNominalThicknessMm, 250, '250mm nominal for a 90mm-framed brick veneer wall');
assert.equal(bv90.displayLabel, '250mm Brick Veneer');

const clad70 = resolveConstructionSystem(wall({ constructionSystem: 'lightweight_cladding', frameThicknessMm: 70 }));
assert.equal(clad70.system, 'lightweight_cladding');
assert.equal(clad70.frameThicknessMm, 70);
assert.equal(clad70.overallNominalThicknessMm, null, 'Cladding never gets an invented overall/nominal thickness');
assert.equal(clad70.displayLabel, 'Lightweight Cladding');

const clad90 = resolveConstructionSystem(wall({ constructionSystem: 'lightweight_cladding', frameThicknessMm: 90 }));
assert.equal(clad90.frameThicknessMm, 90);
assert.equal(clad90.overallNominalThicknessMm, null);

const blockwork = resolveConstructionSystem(wall({ constructionSystem: 'core_filled_blockwork' }));
assert.equal(blockwork.system, 'core_filled_blockwork');
assert.equal(blockwork.frameThicknessMm, null, 'Core-filled blockwork carries no timber frame');
assert.equal(blockwork.frameMaterial, null);
assert.equal(blockwork.overallNominalThicknessMm, 200);
assert.equal(blockwork.displayLabel, '200mm Core-filled Blockwork');

const doubleBrick = resolveConstructionSystem(wall({ constructionSystem: 'double_brick' }));
assert.equal(doubleBrick.frameThicknessMm, null, 'Double brick carries no timber frame');
assert.equal(doubleBrick.overallNominalThicknessMm, 230);
assert.equal(doubleBrick.displayLabel, '230mm Double Brick');

const internal70 = resolveConstructionSystem({ id: 'i70', category: 'interior', constructionSystem: 'internal_timber_frame', thicknessMm: 70 });
assert.equal(internal70.system, 'internal_timber_frame');
assert.equal(internal70.frameThicknessMm, 70);
assert.equal(internal70.frameMaterial, 'timber');

const internal90 = resolveConstructionSystem({ id: 'i90', category: 'interior', constructionSystem: 'internal_timber_frame', thicknessMm: 90 });
assert.equal(internal90.frameThicknessMm, 90);

const custom = resolveConstructionSystem(wall({ constructionSystem: 'custom', customSystemLabel: 'SIP panel wall' }));
assert.equal(custom.system, 'custom');
assert.equal(custom.classificationStatus, 'custom');
assert.equal(custom.displayLabel, 'Custom: SIP panel wall');
const customInternal = resolveConstructionSystem({ id: 'ci', category: 'interior', constructionSystem: 'custom' });
assert.equal(customInternal.system, 'custom');
assert.equal(customInternal.classificationStatus, 'custom');

const unclassified = resolveConstructionSystem(wall({ constructionSystem: 'unclassified' }));
assert.equal(unclassified.system, 'unclassified');
assert.equal(unclassified.classificationStatus, 'unclassified');
assert.equal(unclassified.frameThicknessMm, null);
const noEvidence = resolveConstructionSystem(wall({ exteriorType: 'Other', thicknessMm: 230 }));
assert.equal(noEvidence.system, 'unclassified', 'Category and thickness alone never imply a construction system');

// 10: legacy "Other" normalizes to unclassified, never a guessed system; other legacy exteriorType
// values migrate to their real construction without inventing new evidence.
assert.equal(resolveConstructionSystem(wall({ exteriorType: 'Other' })).system, 'unclassified');
assert.equal(resolveConstructionSystem(wall({})).system, 'unclassified', 'No legacy classification at all is also unclassified, not a guess');
const legacyFace = resolveConstructionSystem(wall({ exteriorType: 'Face Brick Veneer', thicknessMm: 230 }));
assert.equal(legacyFace.system, 'brick_veneer');
assert.equal(legacyFace.exteriorFinish, 'face_brick');
assert.equal(legacyFace.frameThicknessMm, 70, '230mm legacy overall thickness maps to a 70mm frame');
const legacyFace90 = resolveConstructionSystem(wall({ exteriorType: 'Face Brick Veneer', thicknessMm: 250 }));
assert.equal(legacyFace90.frameThicknessMm, 90, '250mm legacy overall thickness maps to a 90mm frame');
const legacyRendered = resolveConstructionSystem(wall({ exteriorType: 'Rendered Brick Veneer', thicknessMm: 230 }));
assert.equal(legacyRendered.system, 'brick_veneer');
assert.equal(legacyRendered.exteriorFinish, 'rendered_brick');
const legacyCladding = resolveConstructionSystem(wall({ exteriorType: 'Lightweight Cladding', thicknessMm: 230 }));
assert.equal(legacyCladding.system, 'lightweight_cladding');
assert.equal(legacyCladding.frameThicknessMm, 70, 'Legacy cladding with no frame evidence defaults to the common 70mm frame');
const legacyMasonry = resolveConstructionSystem(wall({ exteriorType: 'Rendered Masonry', thicknessMm: 230 }));
assert.equal(legacyMasonry.system, 'core_filled_blockwork', 'Rendered masonry migrates to the closest canonical system: core-filled blockwork');
assert.equal(legacyMasonry.exteriorFinish, 'rendered');
assert.equal(legacyMasonry.frameThicknessMm, null);
// A legacy exterior wall whose overall thickness already reads as a valid frame value (an
// unusual but real synthetic case exercised elsewhere in the regression suite) is trusted as-is.
assert.equal(resolveConstructionSystem(wall({ exteriorType: 'Brick Veneer', thicknessMm: 90 })).frameThicknessMm, 90);
// Legacy interior walls with a real thickness classify as timber-framed; with none, unclassified.
assert.equal(resolveConstructionSystem({ id: 'legacy-int', category: 'interior', thicknessMm: 70 }).system, 'internal_timber_frame');
assert.equal(resolveConstructionSystem({ id: 'legacy-int-none', category: 'interior' }).system, 'unclassified');

console.log('Canonical construction-system classification, legacy migration and frame/finish separation checks passed.');

// 11-14: Ground Floor / Second Level grouping, derived level totals, in the redesigned schedule.
const pixelsPerMm = 0.1;
const sheetLevels = { 1: 'Ground Floor', 3: 'Second Level' };
const run = (id, page, category, lengthMm, extra = {}) => ({
  id, page, category, nodes: [{ x: 0, y: 0 }, { x: lengthMm * pixelsPerMm, y: 0 }], lengthMm, alignment: 'outer',
  linedFaces: 2, openingDeductionsEnabled: true, wallHeightM: null, ...extra,
});
const completedWallRuns = [
  run('gf-bv70', 1, 'exterior', 18420, { constructionSystem: 'brick_veneer', frameThicknessMm: 70 }),
  run('gf-clad70', 1, 'exterior', 12000, { constructionSystem: 'lightweight_cladding', frameThicknessMm: 70 }),
  run('gf-unclassified', 1, 'exterior', 5000, { constructionSystem: 'unclassified' }),
  run('gf-int70', 1, 'interior', 30000, { constructionSystem: 'internal_timber_frame', thicknessMm: 70 }),
  run('sl-bv70', 3, 'exterior', 18420, { constructionSystem: 'brick_veneer', frameThicknessMm: 70 }),
  run('sl-clad70', 3, 'exterior', 31030, { constructionSystem: 'lightweight_cladding', frameThicknessMm: 70 }),
  run('sl-int70', 3, 'interior', 67150, { constructionSystem: 'internal_timber_frame', thicknessMm: 70 }),
  run('sl-int90', 3, 'interior', 3630, { constructionSystem: 'internal_timber_frame', thicknessMm: 90 }),
];
const input = { currentPage: 1, totalPages: 3, pixelsPerMm, sheetLevels, completedWallRuns };
const schedule = createTakeoffSchedule(input);
const levels = schedule.projectTotals.wallSystems.levels;
const groundFloor = levels.find((entry) => entry.level === 'Ground Floor');
const secondLevel = levels.find((entry) => entry.level === 'Second Level');
assert.ok(groundFloor && secondLevel, 'Both levels are grouped separately');

const rowFor = (levelGroup, side, system, frame) => levelGroup[side].rows.find((row) => row.system === system && row.frameThicknessMm === frame);
assert.equal(rowFor(groundFloor, 'external', 'brick_veneer', 70).lengthM, 18.42);
assert.equal(rowFor(groundFloor, 'external', 'lightweight_cladding', 70).lengthM, 12);
assert.equal(rowFor(groundFloor, 'external', 'unclassified', null).lengthM, 5);
assert.equal(groundFloor.external.totalLengthM, 35.42, 'Ground Floor external total derives from its own rows');
assert.equal(rowFor(groundFloor, 'internal', 'internal_timber_frame', 70).lengthM, 30);
assert.equal(groundFloor.internal.totalLengthM, 30);

assert.equal(rowFor(secondLevel, 'external', 'brick_veneer', 70).lengthM, 18.42);
assert.equal(rowFor(secondLevel, 'external', 'lightweight_cladding', 70).lengthM, 31.03);
assert.equal(secondLevel.external.totalLengthM, 49.45, 'Second Level external total matches the acceptance scenario');
assert.equal(rowFor(secondLevel, 'internal', 'internal_timber_frame', 70).lengthM, 67.15);
assert.equal(rowFor(secondLevel, 'internal', 'internal_timber_frame', 90).lengthM, 3.63);
assert.equal(secondLevel.internal.totalLengthM, 70.78, 'Second Level internal total matches the acceptance scenario');

// Brick veneer and lightweight cladding sharing a 70mm frame both contribute to the same derived
// downstream 70mm external framing total; neither is folded into the other's construction system.
const jobSetupPayload = createJobSetupPayload(schedule, { sheetLevels });
assert.equal(jobSetupPayload.dataInputFields.upperExternal70mmWallsLm, 49.45, 'Brick veneer + lightweight cladding both feed the shared 70mm external framing total');
assert.equal(jobSetupPayload.dataInputFields.upperInternal70mmWallsLm, 67.15);
assert.equal(jobSetupPayload.dataInputFields.upperInternal90mmWallsLm, 3.63);
// upperExternalWallsLm is a derived sheet total; reconcile against the canonical per-system rows.
assert.equal((jobSetupPayload.dataInputFields.upperBrickVeneer70mmWallsLm || 0) + (jobSetupPayload.dataInputFields.upperLightweightCladding70mmWallsLm || 0), 49.45, 'The unchanged legacy exterior total is untouched by classification');
console.log('Ground Floor / Second Level wall-system grouping and derived 70mm framing totals passed.');

// A wall classified only under the new canonical system (no legacy exteriorType at all) must not
// be miscounted as "unclassified" in the Job Setup mapping just because it has no legacy alias.
const newSystemsOnly = createTakeoffSchedule({
  currentPage: 1, totalPages: 1, pixelsPerMm, sheetLevels: { 1: 'Ground Floor' },
  completedWallRuns: [
    run('bw', 1, 'exterior', 5000, { constructionSystem: 'core_filled_blockwork' }),
    run('db', 1, 'exterior', 6000, { constructionSystem: 'double_brick' }),
    run('un', 1, 'exterior', 2000, { constructionSystem: 'unclassified' }),
  ],
});
const newSystemsPayload = createJobSetupPayload(newSystemsOnly, { sheetLevels: { 1: 'Ground Floor' } });
assert.equal(newSystemsPayload.dataInputFields.totalUnclassifiedExteriorWallsLm, 2, 'Only the genuinely unclassified wall counts as unclassified');
// Phase 2B: Core-filled Blockwork and Double Brick now have real, dedicated Job Setup destinations
// (no longer just a "no destination yet" warning) - each wall imports to its own canonical row, and
// all three reconcile to the overall exterior total via the canonical rows, not the derived legacy total.
assert.equal(newSystemsPayload.dataInputFields.lowerCoreFilledBlockworkLm, 5, 'Core-filled Blockwork imports to its own dedicated destination');
assert.equal(newSystemsPayload.dataInputFields.lowerDoubleBrickLm, 6, 'Double Brick imports to its own dedicated destination');
assert.equal(newSystemsPayload.dataInputFields.lowerUnclassifiedExternalLm, 2, 'Unclassified imports to its own review destination');
assert.equal(
  newSystemsPayload.dataInputFields.lowerCoreFilledBlockworkLm + newSystemsPayload.dataInputFields.lowerDoubleBrickLm + newSystemsPayload.dataInputFields.lowerUnclassifiedExternalLm,
  13,
  'All three walls still reach the overall exterior total',
);
assert.ok(!newSystemsPayload.warnings.some((warning) => /no CoreFilledBlockworkExternalWallsLm input/.test(warning)), 'Blockwork no longer needs a no-destination warning now that one exists');
assert.ok(!newSystemsPayload.warnings.some((warning) => /no DoubleBrickExternalWallsLm input/.test(warning)), 'Double brick no longer needs a no-destination warning now that one exists');
console.log('Blockwork/double-brick walls with no legacy exteriorType import to their own dedicated Job Setup destinations.');

// 15: AI provenance survives the canonical adapter for a fully classified wall.
const context = {
  jobId: 'job-1', takeoffId: 'takeoff-1', documentHash: 'hash-1', pixelsPerMm: 0.1,
  pages: [{ pageNumber: 1, logicalWidth: 1000, logicalHeight: 800 }],
};
const aiWall = {
  detectionId: 'ai-wall-1', kind: 'wall', page: 1, confidence: 0.92,
  coordinates: { space: 'logical' }, nodes: [{ x: 100, y: 100 }, { x: 500, y: 100 }],
  category: 'exterior', thicknessMm: 230, alignment: 'outer', exteriorType: 'Face Brick Veneer',
  constructionSystem: 'brick_veneer', frameThicknessMm: 70, exteriorFinish: 'face_brick',
  analysisEvidence: { basis: 'OBSERVED', confidence: 0.92, evidence: 'Brick veneer notes on the elevation.' },
};
const batch = { jobId: context.jobId, takeoffId: context.takeoffId, documentHash: context.documentHash, runId: 'run-1', modelVersion: 'mock-v1', detections: [aiWall] };
const converted = convertAiTakeoffDetections(batch, context);
const convertedWall = converted.completedWallRuns[0];
assert.equal(convertedWall.constructionSystem, 'brick_veneer');
assert.equal(convertedWall.frameThicknessMm, 70);
assert.equal(convertedWall.exteriorFinish, 'face_brick');
assert.equal(convertedWall.source, 'ai');
assert.equal(resolveConstructionSystem(convertedWall).displayLabel, '230mm Brick Veneer');
// An older AI detection that omits the new fields still classifies correctly from legacy data.
const legacyAiWall = { ...aiWall, detectionId: 'ai-wall-2' };
delete legacyAiWall.constructionSystem; delete legacyAiWall.frameThicknessMm; delete legacyAiWall.exteriorFinish;
const legacyConverted = convertAiTakeoffDetections({ ...batch, detections: [legacyAiWall] }, context).completedWallRuns[0];
assert.equal(legacyConverted.constructionSystem, undefined, 'An older AI detection is not retroactively given a new field it never sent');
assert.equal(resolveConstructionSystem(legacyConverted).system, 'brick_veneer', 'It still classifies correctly by deriving from its legacy exteriorType/thicknessMm');
console.log('AI provenance and construction-system classification through the Phase 1 adapter passed.');

// 16: save/reopen preserves every canonical field exactly, including custom and unclassified walls.
const saveInput = {
  currentPage: 1, totalPages: 1, pixelsPerMm, sheetLevels: { 1: 'Ground Floor' },
  planPages: [{ pageNumber: 1, dataUrl: 'data:image/png;base64,synthetic-wall-system-plan', width: 1000, height: 800, logicalWidth: 1000, logicalHeight: 800, renderScale: 1, vectorSegments: [] }],
  completedWallRuns: [
    run('save-bv', 1, 'exterior', 10000, { constructionSystem: 'brick_veneer', frameThicknessMm: 90, exteriorFinish: 'rendered_brick', exteriorType: 'Rendered Brick Veneer' }),
    run('save-blockwork', 1, 'exterior', 5000, { constructionSystem: 'core_filled_blockwork', exteriorFinish: 'rendered' }),
    run('save-double-brick', 1, 'exterior', 6000, { constructionSystem: 'double_brick' }),
    run('save-custom', 1, 'exterior', 3000, { constructionSystem: 'custom', customSystemLabel: 'SIP panel wall' }),
    run('save-unclassified', 1, 'exterior', 2000, { constructionSystem: 'unclassified' }),
    run('save-int90', 1, 'interior', 4000, { constructionSystem: 'internal_timber_frame', thicknessMm: 90 }),
  ],
};
const saved = createJobData({ ...saveInput, name: 'Wall system classification regression', takeoffId: 'wall-system-regression', revision: 1 });
const untouchedSaved = structuredClone(saved);
const imported = resolvePortableTakeoffImport(JSON.parse(JSON.stringify(createPortableTakeoffExport(saved))));
assert.equal(imported.ok, true);
assert.deepEqual(saved, untouchedSaved, 'Portable export does not mutate the current takeoff');
const reopenedWalls = imported.job.completedWallRuns;
for (const wallId of ['save-bv', 'save-blockwork', 'save-double-brick', 'save-custom', 'save-unclassified', 'save-int90']) {
  const before = saveInput.completedWallRuns.find((item) => item.id === wallId);
  const after = reopenedWalls.find((item) => item.id === wallId);
  assert.ok(after, `${wallId} survives save/reopen`);
  assert.equal(after.constructionSystem, before.constructionSystem, `${wallId} constructionSystem survives save/reopen`);
  assert.equal(after.frameThicknessMm ?? null, before.frameThicknessMm ?? null, `${wallId} frameThicknessMm survives save/reopen`);
  assert.equal(after.exteriorFinish, before.exteriorFinish, `${wallId} exteriorFinish survives save/reopen`);
  assert.equal(after.customSystemLabel, before.customSystemLabel, `${wallId} customSystemLabel survives save/reopen`);
  assert.deepEqual(resolveConstructionSystem(after), resolveConstructionSystem(before), `${wallId} resolves identically before and after save/reopen`);
}
console.log('Save/reopen preserves every canonical construction-system field, including custom and unclassified walls.');

// 17-18: manual reclassification (simulating the Select/Edit panel's update) recalculates the
// schedule without disturbing geometry, and moving an unclassified wall to a real system clears it
// from the unclassified review bucket.
const manualWall = run('manual-1', 1, 'exterior', 20000, { constructionSystem: 'unclassified' });
const beforeReclassify = createTakeoffSchedule({ currentPage: 1, totalPages: 1, pixelsPerMm, sheetLevels: { 1: 'Ground Floor' }, completedWallRuns: [manualWall] });
const beforeGroup = beforeReclassify.projectTotals.wallSystems.levels[0];
assert.equal(rowFor(beforeGroup, 'external', 'unclassified', null).lengthM, 20);
assert.equal(rowFor(beforeGroup, 'external', 'brick_veneer', 70).lengthM, 0);
// Exactly the update the manual editing UI performs: change constructionSystem (and frame, for a
// framed system), leave geometry untouched.
const reclassifiedWall = { ...manualWall, constructionSystem: 'brick_veneer', frameThicknessMm: 70, exteriorType: 'Face Brick Veneer' };
assert.deepEqual(reclassifiedWall.nodes, manualWall.nodes, 'Reclassification does not touch geometry');
const afterReclassify = createTakeoffSchedule({ currentPage: 1, totalPages: 1, pixelsPerMm, sheetLevels: { 1: 'Ground Floor' }, completedWallRuns: [reclassifiedWall] });
const afterGroup = afterReclassify.projectTotals.wallSystems.levels[0];
assert.equal(rowFor(afterGroup, 'external', 'unclassified', null).lengthM, 0, 'Reclassifying clears the wall from the unclassified bucket');
assert.equal(rowFor(afterGroup, 'external', 'brick_veneer', 70).lengthM, 20, 'Its full length now reports against the corrected system');
assert.equal(afterGroup.external.totalLengthM, beforeGroup.external.totalLengthM, 'The external total is unchanged by reclassification: same wall, same length');
console.log('Manual reclassification recalculates the wall-system schedule without touching geometry.');

// The exact enum lists a manual editing UI would offer, kept here so a future edit that silently
// narrows or widens them is caught.
assert.deepEqual(EXTERIOR_CONSTRUCTION_SYSTEMS, ['brick_veneer', 'core_filled_blockwork', 'double_brick', 'lightweight_cladding', 'custom', 'unclassified']);
assert.deepEqual(INTERIOR_CONSTRUCTION_SYSTEMS, ['internal_timber_frame', 'custom', 'unclassified']);

// Cladding product (Phase 2A part 2): construction system and product are separate; the product
// catalogue reuses Job Setup's own established naming (150/180 Linea, Stria) and extends it with
// the additional documented James Hardie product lines, plus Other/Custom and Unspecified.
assert.deepEqual(CLADDING_PRODUCTS, [
  'James Hardie Linea Weatherboard - 150mm', 'James Hardie Linea Weatherboard - 180mm',
  'James Hardie Matrix', 'James Hardie Axon', 'James Hardie Stria', 'James Hardie EasyLap', 'James Hardie Fine Texture',
  'Other / Custom', 'Unspecified',
]);
for (const product of ['James Hardie Linea Weatherboard - 150mm', 'James Hardie Linea Weatherboard - 180mm', 'James Hardie Matrix']) {
  const w = resolveConstructionSystem(wall({ constructionSystem: 'lightweight_cladding', frameThicknessMm: 70, exteriorFinish: product }));
  assert.equal(w.system, 'lightweight_cladding');
  assert.equal(w.frameThicknessMm, 70);
  assert.equal(w.exteriorFinish, product, `${product} is stored verbatim, not translated through a key`);
  assert.equal(w.exteriorFinishLabel, product);
}
const customCladding = resolveConstructionSystem(wall({ constructionSystem: 'lightweight_cladding', frameThicknessMm: 90, exteriorFinish: CLADDING_PRODUCT_CUSTOM, exteriorFinishCustomLabel: 'Weathertex Rustic Cladding' }));
assert.equal(customCladding.exteriorFinish, CLADDING_PRODUCT_CUSTOM);
assert.equal(customCladding.exteriorFinishLabel, 'Weathertex Rustic Cladding', 'A custom cladding PRODUCT is shown by its actual description, not the literal Other/Custom sentinel');
assert.equal(customCladding.classificationStatus, 'classified', 'A custom cladding product is a classified wall, never Unclassified');
// AI must not guess a specific product from a bare "Lightweight Cladding" note: the wall stays
// correctly classified as lightweight_cladding even with no product at all documented.
const unspecifiedProduct = resolveConstructionSystem(wall({ constructionSystem: 'lightweight_cladding', frameThicknessMm: 70, exteriorFinish: 'Unspecified' }));
assert.equal(unspecifiedProduct.system, 'lightweight_cladding');
assert.equal(unspecifiedProduct.exteriorFinishLabel, 'Unspecified');
assert.equal(unspecifiedProduct.classificationStatus, 'classified', 'The wall SYSTEM is still classified even when the specific product is not');
console.log('Cladding product catalogue, custom product description and Unspecified-product classification checks passed.');

// Wall totals must not double-count product detail: two cladding products under the same
// system/frame sum to exactly the parent row's length (Part 8's worked example).
const claddingSchedule = createTakeoffSchedule({
  currentPage: 1, totalPages: 1, pixelsPerMm, sheetLevels: { 1: 'Second Level' },
  completedWallRuns: [
    run('linea', 1, 'exterior', 24600, { constructionSystem: 'lightweight_cladding', frameThicknessMm: 70, exteriorFinish: 'James Hardie Linea Weatherboard - 180mm' }),
    run('matrix', 1, 'exterior', 6430, { constructionSystem: 'lightweight_cladding', frameThicknessMm: 70, exteriorFinish: 'James Hardie Matrix' }),
  ],
});
const claddingRow = claddingSchedule.projectTotals.wallSystems.levels[0].external.rows.find((row) => row.system === 'lightweight_cladding' && row.frameThicknessMm === 70);
assert.equal(claddingRow.lengthM, 31.03);
assert.deepEqual(claddingRow.products.map((p) => p.label), ['James Hardie Linea Weatherboard - 180mm', 'James Hardie Matrix']);
assert.equal(claddingRow.products.reduce((sum, p) => sum + p.lengthM, 0), claddingRow.lengthM, 'Product detail rows sum exactly to the parent row, never double-counted');
console.log('Cladding product detail rows do not double-count wall totals.');

// Cladding product save/reopen.
const claddingSaveInput = {
  currentPage: 1, totalPages: 1, pixelsPerMm, sheetLevels: { 1: 'Ground Floor' },
  planPages: [{ pageNumber: 1, dataUrl: 'data:image/png;base64,synthetic-cladding-plan', width: 1000, height: 800, logicalWidth: 1000, logicalHeight: 800, renderScale: 1, vectorSegments: [] }],
  completedWallRuns: [run('cladding-save', 1, 'exterior', 8000, {
    constructionSystem: 'lightweight_cladding', frameThicknessMm: 90, exteriorFinish: CLADDING_PRODUCT_CUSTOM, exteriorFinishCustomLabel: 'Weathertex Rustic Cladding',
  })],
};
const claddingSaved = createJobData({ ...claddingSaveInput, name: 'Cladding product regression', takeoffId: 'cladding-product-regression', revision: 1 });
const claddingImported = resolvePortableTakeoffImport(JSON.parse(JSON.stringify(createPortableTakeoffExport(claddingSaved))));
assert.equal(claddingImported.ok, true);
const reopenedCladdingWall = claddingImported.job.completedWallRuns.find((item) => item.id === 'cladding-save');
assert.equal(reopenedCladdingWall.exteriorFinish, CLADDING_PRODUCT_CUSTOM);
assert.equal(reopenedCladdingWall.exteriorFinishCustomLabel, 'Weathertex Rustic Cladding');
assert.equal(resolveConstructionSystem(reopenedCladdingWall).exteriorFinishLabel, 'Weathertex Rustic Cladding');
console.log('Cladding product (including a custom product description) survives save/reopen.');

console.log('Takeoff wall-system classification (Phase 2A) checks passed: canonical systems, legacy migration, level grouping, derived framing totals, AI provenance, save/reopen and manual reclassification.');
