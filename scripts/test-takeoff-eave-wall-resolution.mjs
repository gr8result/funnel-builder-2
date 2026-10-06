import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTakeoffSchedule, createJobSetupPayload } from '../components/construction-estimation/ai-plan-takeoff/takeoffSchedule.js';

// Synthetic regression cases; these are not a reproduction of the reported missing 15.39 m.
const sheetLevels = { 3: 'Second Level' };
const base = { currentPage: 3, totalPages: 3, pixelsPerMm: 1, sheetLevels };
const eave = (id, lengthMm, extra = {}) => ({
  id, page: 3, lengthMm, nodes: [{ x: 0, y: 0 }, { x: lengthMm, y: 0 }],
  widthOption: '600', widthMm: 600, ...extra,
});

// Exercise the production schedule first, so the old calculation fails before helper imports.
for (const lengthMm of [undefined, 0]) {
  const schedule = createTakeoffSchedule({ ...base, completedEaves: [eave('node-fallback', 2300, { lengthMm })] });
  assert.equal(schedule.currentSheet.roofAndEaves[0].eavesLengthLm, 2.3, 'Eave nodes must count when lengthMm is absent or zero');
  assert.equal(schedule.currentSheet.roofAndEaves[0].level, 'Second Level', 'Unlabelled eaves inherit the Sheet 3 assignment');
}

const { resolveTakeoffLevel, resolveExteriorClass, createExteriorClassificationTotals } = await import('../components/construction-estimation/ai-plan-takeoff/takeoffRunData.js');

const wall = (id, lengthMm, extra = {}) => ({
  id, page: 3, category: 'exterior', lengthMm, thicknessMm: 70,
  nodes: [{ x: 0, y: 0 }, { x: lengthMm, y: 0 }], ...extra,
});
const jsx = readFileSync(new URL('../components/construction-estimation/ai-plan-takeoff/AIPlanTakeoffStandalone.jsx', import.meta.url), 'utf8');
const sourceFunction = (name) => {
  const match = jsx.match(new RegExp(`function ${name}\\([^]*?\\n\\}`));
  assert.ok(match, `Find actual ${name} implementation`);
  return match[0];
};
// Execute the actual restore function: no separate copy of its normalization logic.
const restore = new Function('resolveExteriorClass', `${sourceFunction('getDefaultWallThickness')}\n${sourceFunction('normaliseRecoveredWallRun')}\nreturn normaliseRecoveredWallRun;`)(resolveExteriorClass);
// Anchor the end search to the declaration: '  const baseScale =' also matches the four-space
// '    const baseScale =' inside renderPdfPageForJob, which appears earlier in the file and would
// slice an empty body.
const sidebarStart = jsx.indexOf('  const exteriorWallClassificationTotals =');
const sidebarEnd = jsx.indexOf('  const baseScale =', sidebarStart);
assert.ok(sidebarStart > 0 && sidebarEnd > sidebarStart, 'Locate the sidebar classification totals');
const sidebarSource = jsx.slice(sidebarStart, sidebarEnd);
const sidebar = (runs, scale, levels) => new Function(
  'useMemo', 'createExteriorClassificationTotals', 'completedWallRuns', 'pixelsPerMm', 'sheetLevels',
  `${sidebarSource}\nreturn exteriorWallClassificationTotals;`,
)((compute) => compute(), createExteriorClassificationTotals, runs, scale, levels);
for (const constructionField of ['exteriorType', 'exteriorClass', 'exteriorClassification', 'wallSystem']) {
  const source = wall(`synthetic-${constructionField}`, 48680, { [constructionField]: 'Brick Veneer' });
  const original = structuredClone(source);
  const recovered = restore(source);
  assert.equal(recovered.exteriorType, 'Face Brick Veneer', `${constructionField} survives restoration`);
  assert.deepEqual(recovered.nodes, source.nodes, 'Restoration preserves wall geometry');
  assert.equal(recovered.lengthMm, 48680, 'Restoration preserves wall measurement');
  assert.deepEqual(source, original, 'Restoration must not mutate the saved source');
  for (const run of [source, recovered]) {
    const totals = sidebar([run], 1, sheetLevels);
    assert.equal(totals.all['Face Brick Veneer'], 48.68, `${constructionField} assigns all exterior length to Brick Veneer`);
    assert.equal(totals.all.Other, 0);
    assert.equal(totals.byFloor['Second Level']['Face Brick Veneer'], 48.68);
    assert.equal(Object.values(totals.all).reduce((sum, value) => sum + value, 0), 48.68, 'Classifications conserve exterior length');
    const schedule = createTakeoffSchedule({ ...base, completedWallRuns: [run] });
    const record = schedule.currentSheet.wallRecords[0];
    assert.equal(record.level, 'Second Level');
    assert.equal(record.exteriorClassification, 'Face Brick Veneer');
    assert.equal(record.lengthM, 48.68);
    assert.ok(schedule.currentSheet.exteriorWalls.every((row) => row.floor === 'Second Level' && row.category === 'Face Brick Veneer' && row.quantity === 48.68));
    const fields = createJobSetupPayload(schedule).dataInputFields;
    assert.equal(fields.upperBrickVeneer70mmWallsLm, 48.68, 'upperExternalWallsLm is a derived total; the canonical per-system row is authoritative');
    assert.equal(fields.upperBrickVeneerExternalWallsLm, 48.68);
    assert.equal(fields.totalBrickVeneerExternalWallsLm, 48.68);
  }
}

const mixedWalls = [wall('brick', 20000, { exteriorType: 'Brick Veneer' }), wall('cladding', 10000, { exteriorClass: 'lightweight cladding' }), wall('render', 8680, { wallSystem: 'Rendered Masonry' }), wall('other', 10000, { exteriorType: 'Other', exteriorClass: 'Brick Veneer' })];
const mixedTotals = createExteriorClassificationTotals(mixedWalls, 1, sheetLevels);
assert.deepEqual(mixedTotals.all, { 'Face Brick Veneer': 20, 'Rendered Brick Veneer': 0, 'Lightweight Cladding': 10, 'Rendered Masonry': 8.68, Other: 10 });
assert.equal(Object.values(mixedTotals.all).reduce((sum, value) => sum + value, 0), 48.68);
assert.equal(resolveExteriorClass(mixedWalls[3]), 'Other', 'An explicit Other selection must override a stale alias');
assert.equal(resolveExteriorClass(wall('unclassified', 48680)), 'Other', 'Exterior geometry alone must not imply Brick Veneer');
assert.equal(restore(mixedWalls[3]).exteriorType, 'Other');

const mixedEaves = [eave('ground', 1200, { level: 'Ground Floor' }), eave('upper', 2300, { level: 'Second Level', lengthMm: 0 })];
const before = structuredClone(mixedEaves);
const mixedSchedule = createTakeoffSchedule({ ...base, completedEaves: mixedEaves });
assert.deepEqual(mixedSchedule.currentSheet.roofAndEaves.map((row) => [row.level, row.eavesLengthLm]), [['Ground Floor', 1.2], ['Second Level', 2.3]], 'A single sheet can contain explicitly selected eaves from two levels');
const eaveFields = createJobSetupPayload(mixedSchedule).dataInputFields;
assert.equal(eaveFields.lowerEavesLm, 1.2);
assert.equal(eaveFields.upperEavesLm, 2.3);
assert.deepEqual(mixedEaves, before, 'Schedule calculations preserve eave geometry and measurements');
assert.equal(resolveTakeoffLevel({ page: 3 }, sheetLevels), 'Second Level');
assert.equal(resolveTakeoffLevel({ page: 3, level: 'Ground Floor' }, sheetLevels), 'Ground Floor');
assert.equal(resolveTakeoffLevel({ page: 3 }, {}), 'Unassigned');
const explicitWall = wall('explicit-upper', 48680, { level: 'Second Level', exteriorType: 'Brick Veneer' });
assert.equal(sidebar([explicitWall], 1, {}).byFloor['Second Level']['Face Brick Veneer'], 48.68, 'Sidebar uses the same explicit wall level as the schedule');
assert.equal(createTakeoffSchedule({ ...base, sheetLevels: {}, completedWallRuns: [explicitWall] }).currentSheet.wallRecords[0].level, 'Second Level');

const unassignedWall = wall('unassigned', 48680, { exteriorType: 'Brick Veneer' });
const unassignedTotals = createExteriorClassificationTotals([unassignedWall], 1, {});
assert.equal(unassignedTotals.byFloor['Sheet 3 (no level assigned)']['Face Brick Veneer'], 48.68);
const unassignedSchedule = createTakeoffSchedule({ ...base, sheetLevels: {}, completedWallRuns: [unassignedWall] });
const unassignedPayload = createJobSetupPayload(unassignedSchedule);
assert.equal(unassignedPayload.dataInputFields.upperExternalWallsLm, undefined);
assert.ok(unassignedPayload.warnings.some((warning) => /assign the measured plan sheets/i.test(warning)));
const unassignedEaves = createTakeoffSchedule({ ...base, sheetLevels: {}, completedEaves: [eave('unassigned-eave', 2300)] });
assert.equal(unassignedEaves.currentSheet.roofAndEaves[0].level, 'Unassigned');

console.log('Takeoff eave/wall resolution checks passed: absent and zero eave lengths, Sheet 3 assignment, construction recovery, schedule/sidebar/import consistency, preserved mixed eave levels, and conserved 48.68 m exterior totals.');
console.log('Synthetic regression coverage; this does not establish the reported missing 15.39 m or the saved wall construction selection.');
