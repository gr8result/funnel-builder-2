import assert from 'node:assert/strict';
import { createTakeoffSchedule, createJobSetupPayload } from '../components/construction-estimation/ai-plan-takeoff/takeoffSchedule.js';
import { INPUT_DATA_SHEET_TEMPLATE } from '../lib/construction-estimation/inputDataSheetTemplate.js';

// Phase 2B: Job Setup gets a clean, canonical LEVEL x CONSTRUCTION SYSTEM destination for every
// wall system, including Core-filled Blockwork and Double Brick (which previously had no Job Setup
// destination at all - Phase 2A could only warn about them). Each physical wall imports to exactly
// one destination; nothing is double counted, and every level is exercised, not just one.

const pixelsPerMm = 1;
const sheetLevels = { 1: 'Ground Floor', 2: 'Second Level', 3: 'Third Level' };
const wall = (id, page, lengthMm, extra = {}) => ({
  id, page, category: 'exterior', lengthMm,
  nodes: [{ x: 0, y: 0 }, { x: lengthMm, y: 0 }],
  alignment: 'outer', linedFaces: 2, openingDeductionsEnabled: true, wallHeightM: 2.4, ...extra,
});
const internalWall = (id, page, lengthMm, extra = {}) => ({
  id, page, category: 'interior', lengthMm,
  nodes: [{ x: 0, y: 0 }, { x: lengthMm, y: 0 }],
  alignment: 'outer', linedFaces: 2, wallHeightM: 2.4, ...extra,
});

const completedWallRuns = [
  // Ground Floor: one of every exterior system, plus a custom and unclassified internal wall.
  wall('gf-bv70', 1, 5000, { constructionSystem: 'brick_veneer', frameThicknessMm: 70 }),
  wall('gf-bv90', 1, 4000, { constructionSystem: 'brick_veneer', frameThicknessMm: 90 }),
  wall('gf-lc70', 1, 3000, { constructionSystem: 'lightweight_cladding', frameThicknessMm: 70 }),
  wall('gf-lc90', 1, 2000, { constructionSystem: 'lightweight_cladding', frameThicknessMm: 90 }),
  wall('gf-cfb', 1, 6000, { constructionSystem: 'core_filled_blockwork' }),
  wall('gf-db', 1, 7000, { constructionSystem: 'double_brick' }),
  wall('gf-custom', 1, 1500, { constructionSystem: 'custom', customSystemLabel: 'SIP panel' }),
  wall('gf-unclassified', 1, 2500, { constructionSystem: 'unclassified' }),
  internalWall('gf-int-custom', 1, 1000, { constructionSystem: 'custom' }),
  internalWall('gf-int-unclassified', 1, 1200, {}),
  // Second Level: a smaller, different mix, to prove levels do not bleed into each other.
  wall('sl-bv70', 2, 8000, { constructionSystem: 'brick_veneer', frameThicknessMm: 70 }),
  wall('sl-cfb', 2, 3000, { constructionSystem: 'core_filled_blockwork' }),
  // Third Level: double brick only.
  wall('tl-db', 3, 9000, { constructionSystem: 'double_brick' }),
];

const schedule = createTakeoffSchedule({ totalPages: 3, pixelsPerMm, sheetLevels, completedWallRuns });
const payload = createJobSetupPayload(schedule, { sheetLevels });
const fields = payload.dataInputFields;

// Ground Floor: every system lands in its own dedicated row, in metres.
assert.equal(fields.lowerBrickVeneer70mmWallsLm, 5, 'Ground Floor Brick Veneer 70mm frame');
assert.equal(fields.lowerBrickVeneer90mmWallsLm, 4, 'Ground Floor Brick Veneer 90mm frame');
assert.equal(fields.lowerLightweightCladding70mmWallsLm, 3, 'Ground Floor Lightweight Cladding 70mm frame');
assert.equal(fields.lowerLightweightCladding90mmWallsLm, 2, 'Ground Floor Lightweight Cladding 90mm frame');
assert.equal(fields.lowerCoreFilledBlockworkLm, 6, 'Ground Floor Core-filled Blockwork has its own dedicated destination');
assert.equal(fields.lowerDoubleBrickLm, 7, 'Ground Floor Double Brick has its own dedicated destination');
assert.equal(fields.lowerCustomExternalLm, 1.5, 'Ground Floor custom exterior construction');
assert.equal(fields.lowerUnclassifiedExternalLm, 2.5, 'Ground Floor unclassified exterior construction');
assert.equal(fields.lowerCustomInternalLm, 1, 'Ground Floor custom internal construction');
assert.equal(fields.lowerUnclassifiedInternalLm, 1.2, 'Ground Floor unclassified internal construction (no thickness evidence)');

// Second Level: only its own two systems are populated; nothing from Ground Floor leaks across.
// (BrickVeneer/LightweightCladding rows are always emitted at 0 for a level with any exterior wall
// - a pre-existing takeoffMaterialFields behaviour, unrelated to Phase 2B - while the new Phase 2B
// destinations (Blockwork/Double Brick/Custom/Unclassified) are only emitted when actually measured.)
assert.equal(fields.upperBrickVeneer70mmWallsLm, 8, 'Second Level Brick Veneer 70mm frame');
assert.equal(fields.upperCoreFilledBlockworkLm, 3, 'Second Level Core-filled Blockwork');
assert.equal(fields.upperBrickVeneer90mmWallsLm, 0, 'Second Level has no 90mm Brick Veneer');
assert.equal(fields.upperLightweightCladding70mmWallsLm, 0, 'Second Level has no Lightweight Cladding');
assert.equal(fields.upperDoubleBrickLm, undefined, 'Second Level has no Double Brick');

// Third Level: double brick only.
assert.equal(fields.thirdDoubleBrickLm, 9, 'Third Level Double Brick');
assert.equal(fields.thirdBrickVeneer70mmWallsLm, 0, 'Third Level has no Brick Veneer');

// Cross-level totals reconcile exactly to the sum of the per-level rows (5+8=13, 6+3=9, 7+9=16).
assert.equal(fields.totalBrickVeneer70mmWallsLm, 13, 'Cross-level Brick Veneer 70mm total');
assert.equal(fields.totalBrickVeneer90mmWallsLm, 4, 'Cross-level Brick Veneer 90mm total (Ground Floor only)');
assert.equal(fields.totalLightweightCladding70mmWallsLm, 3, 'Cross-level Lightweight Cladding 70mm total (Ground Floor only)');
assert.equal(fields.totalLightweightCladding90mmWallsLm, 2, 'Cross-level Lightweight Cladding 90mm total (Ground Floor only)');
assert.equal(fields.totalCoreFilledBlockworkLm, 9, 'Cross-level Core-filled Blockwork total');
assert.equal(fields.totalDoubleBrickLm, 16, 'Cross-level Double Brick total');
assert.equal(fields.totalCustomExternalLm, 1.5, 'Cross-level custom exterior total');
assert.equal(fields.totalCustomInternalLm, 1, 'Cross-level custom internal total');
assert.equal(fields.totalUnclassifiedInternalLm, 1.2, 'Cross-level unclassified internal total');

// Every measured metre is accounted for exactly once: summing all the dedicated per-level
// destinations for a level reconciles to that level's true measured exterior wall length, with no
// double counting and no silently dropped system.
const groundFloorExteriorLm = fields.lowerBrickVeneer70mmWallsLm + fields.lowerBrickVeneer90mmWallsLm
  + fields.lowerLightweightCladding70mmWallsLm + fields.lowerLightweightCladding90mmWallsLm
  + fields.lowerCoreFilledBlockworkLm + fields.lowerDoubleBrickLm + fields.lowerCustomExternalLm + fields.lowerUnclassifiedExternalLm;
assert.equal(groundFloorExteriorLm, 5 + 4 + 3 + 2 + 6 + 7 + 1.5 + 2.5, 'Ground Floor canonical destinations reconcile exactly to the measured exterior wall total, no double counting');

// The Core-filled Blockwork / Double Brick "no destination yet" warning from Phase 2A must not
// fire now that both systems have real Job Setup destinations.
assert.ok(!payload.warnings.some((warning) => /no CoreFilledBlockworkExternalWallsLm input/.test(warning)), 'No stale no-destination warning for Blockwork');
assert.ok(!payload.warnings.some((warning) => /no DoubleBrickExternalWallsLm input/.test(warning)), 'No stale no-destination warning for Double Brick');

// Unclassified walls (exterior and interior) get a prominent, explicit review warning - never a
// silent allocation into some other system's total.
assert.ok(payload.warnings.some((warning) => /exterior walls have no material classification/i.test(warning)), 'Prominent unclassified exterior warning');
assert.ok(payload.warnings.some((warning) => /internal walls have no material classification/i.test(warning)), 'Prominent unclassified internal warning');

// Every field this payload writes must be a real, editable, non-calculated destination - never a
// row under workbook formula control, which would silently discard the imported value.
for (const key of Object.keys(fields)) {
  const destination = INPUT_DATA_SHEET_TEMPLATE.rows.find((row) => row.key === key);
  assert.ok(destination?.editable && !destination.calculated && !destination.heading, `${key} must be an editable actual Job Setup input`);
}

console.log('Phase 2B canonical LEVEL x CONSTRUCTION SYSTEM Job Setup wall import checks passed: Ground/Second/Third levels, all 8 exterior systems, custom/unclassified internal, cross-level totals, no double counting, no stale warnings, prominent unclassified review warnings.');
