import assert from 'node:assert/strict';
import { createTakeoffSchedule, createJobSetupPayload, createPillarSchedule } from '../components/construction-estimation/ai-plan-takeoff/takeoffSchedule.js';
import { resolvePostColumnCore } from '../components/construction-estimation/ai-plan-takeoff/takeoffRunData.js';
import { INPUT_DATA_SHEET_TEMPLATE } from '../lib/construction-estimation/inputDataSheetTemplate.js';

// Pillars, Posts & Columns: a discrete Takeoff object, never a wall. ONE physical column stays ONE
// canonical object even when it has both a structural core and a brick surround; Job Setup derives
// the post count, the frame requirement and the masonry surround quantity from that same object.

const rect = (x, y, w, d) => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + d }, { x, y: y + d }];
const pixelsPerMm = 1; // 1 px = 1 mm, so drawn rectangles read directly as millimetres.

// 1. resolvePostColumnCore: no evidence at all is unclassified, never a guessed default.
assert.deepEqual(resolvePostColumnCore({}), { coreType: 'unclassified', classificationStatus: 'unclassified', displayLabel: 'Unclassified / Review Required' });
assert.equal(resolvePostColumnCore({ coreType: 'steel' }).classificationStatus, 'classified');
assert.equal(resolvePostColumnCore({ coreType: 'custom', coreCustomLabel: 'Precast column' }).displayLabel, 'Custom: Precast column');

const timberPost = { id: 'post-timber', page: 1, level: 'Ground Floor', nodes: rect(0, 0, 150, 150), coreType: 'timber', timberSizeOption: '150 x 150', coreWidthMm: 150, coreDepthMm: 150, surroundType: 'none', heightMm: 2700, quantity: 3, location: 'Alfresco' };
const steelBrickPost = { id: 'post-steel-brick', page: 1, level: 'Ground Floor', nodes: rect(1000, 0, 350, 350), coreType: 'steel', steelSectionType: 'SHS', coreWidthMm: 100, coreDepthMm: 100, surroundType: 'brick', surroundWidthMm: 350, surroundDepthMm: 350, heightMm: 2700, quantity: 2, location: 'Entry' };
const brickPier = { id: 'post-brick-pier', page: 1, level: 'Ground Floor', nodes: rect(2000, 0, 350, 350), coreType: 'brick', brickFinish: 'Face Brick', coreWidthMm: 350, coreDepthMm: 350, surroundType: 'none', heightMm: 1500, quantity: 1, location: 'Porch' };
const unclassifiedPost = { id: 'post-unclassified', page: 2, level: 'Second Level', nodes: rect(0, 0, 90, 90), coreType: 'unclassified', surroundType: 'none', heightMm: 2400, quantity: 1, location: '' };
const customRectPost = { id: 'post-custom-rect', page: 1, level: 'Ground Floor', nodes: rect(3000, 0, 200, 300), coreType: 'timber', timberSizeOption: 'Custom', coreWidthMm: 200, coreDepthMm: 300, surroundType: 'none', heightMm: 2400, quantity: 1, location: '' };

// 2. Custom rectangular dimensions are preserved exactly - never forced square.
const customRows = createPillarSchedule([customRectPost], pixelsPerMm, {});
assert.equal(customRows[0].coreWidthMm, 200);
assert.equal(customRows[0].coreDepthMm, 300);
assert.equal(customRows[0].sizeLabel, '200x300');

// 3. Composite steel-core + brick-surround stays ONE canonical row: core AND surround both present.
const compositeRows = createPillarSchedule([steelBrickPost], pixelsPerMm, {});
assert.equal(compositeRows.length, 1, 'One physical column produces one schedule row, never two');
assert.equal(compositeRows[0].coreType, 'steel');
assert.equal(compositeRows[0].coreWidthMm, 100);
assert.equal(compositeRows[0].surroundType, 'brick');
assert.equal(compositeRows[0].finishedWidthMm, 350, 'Finished/surround size is the visible outer footprint, not the hidden core');
assert.equal(compositeRows[0].typeLabel, 'SHS 100x100');
assert.equal(compositeRows[0].quantity, 2);

// 4. Identical specification merges into one row; a genuinely different spec does not.
const twoIdenticalTimber = createPillarSchedule([timberPost, { ...timberPost, id: 'post-timber-2', quantity: 1 }], pixelsPerMm, {});
assert.equal(twoIdenticalTimber.length, 1, 'Identical posts (same level/core/size/surround/height) group into one row');
assert.equal(twoIdenticalTimber[0].quantity, 4, '3 + 1 = 4 - grouping sums quantity, never drops it');
const differentHeight = createPillarSchedule([timberPost, { ...timberPost, id: 'post-timber-tall', heightMm: 3000, quantity: 1 }], pixelsPerMm, {});
assert.equal(differentHeight.length, 2, 'A different height is a different specification - never silently merged');

// 5. Level grouping: Ground Floor and Second Level never mix.
const byLevel = createPillarSchedule([timberPost, unclassifiedPost], pixelsPerMm, { 2: 'Second Level' });
assert.deepEqual(new Set(byLevel.map((row) => row.level)), new Set(['Ground Floor', 'Second Level']));

// 6. Job Setup: canonical fields preserved, level counts, unclassified review warning, and the
// derived brick surround quantity (perimeter x height, never footprint x height).
const schedule = createTakeoffSchedule({
  totalPages: 2, pixelsPerMm, sheetLevels: { 1: 'Ground Floor', 2: 'Second Level' },
  completedPillars: [timberPost, steelBrickPost, brickPier, unclassifiedPost],
});
const payload = createJobSetupPayload(schedule, { sheetLevels: { 1: 'Ground Floor', 2: 'Second Level' } });
const fields = payload.dataInputFields;

assert.equal(fields.lowerPostColumnsEach, 6, 'Ground Floor: 3 timber + 2 steel/brick + 1 brick pier');
assert.equal(fields.upperPostColumnsEach, 1, 'Second Level: 1 unclassified post');
assert.equal(fields.totalPostColumnsEach, 7);
assert.equal(fields.totalUnclassifiedPostColumnsEach, 1, 'Only the genuinely unclassified post counts as unclassified');
assert.ok(payload.warnings.some((warning) => /posts\/columns have no structural\/core classification/.test(warning)), 'Prominent unclassified post/column review warning');

// Steel+brick post: surround face = perimeter(350+350)*2/1000 * 2700/1000 * qty2 = 1.4*2.7*2 = 7.56 m2, face finish (no brickFinish set -> defaults to face, not rendered).
// Brick pier (no surround, brick core): perimeter(350+350)*2/1000 * 1500/1000 * qty1 = 1.4*1.5 = 2.1 m2, Face Brick finish.
const expectedFaceNetM2 = Math.round((1.4 * 2.7 * 2 + 1.4 * 1.5) * 10000) / 10000;
assert.equal(fields.totalPostColumnFaceBrickNetM2, expectedFaceNetM2, 'Derived from perimeter x height, never footprint x height');
assert.ok(fields.totalPostColumnFaceBrickOrderEach > 0, 'The existing brick-order engine (waste/course conversion) produced a real order quantity');
assert.equal(fields.totalPostColumnRenderedBrickNetM2, undefined, 'No rendered-finish post/column was measured');

// A rendered-finish brick surround/core routes to the rendered bucket instead.
const renderedPier = { ...brickPier, id: 'post-rendered-pier', brickFinish: 'Rendered Brick' };
const renderedSchedule = createTakeoffSchedule({ totalPages: 1, pixelsPerMm, sheetLevels: { 1: 'Ground Floor' }, completedPillars: [renderedPier] });
const renderedPayload = createJobSetupPayload(renderedSchedule, { sheetLevels: { 1: 'Ground Floor' } });
assert.equal(renderedPayload.dataInputFields.totalPostColumnFaceBrickNetM2, undefined);
assert.equal(renderedPayload.dataInputFields.totalPostColumnRenderedBrickNetM2, 2.1);

// 7. Every field this payload writes must be a real, editable, non-calculated Job Setup destination.
for (const key of Object.keys(fields)) {
  const destination = INPUT_DATA_SHEET_TEMPLATE.rows.find((row) => row.key === key);
  assert.ok(destination?.editable && !destination.calculated && !destination.heading, `${key} must be an editable actual Job Setup input`);
}

// 8. A pillar on an unassigned sheet is reported unsupported, exactly like walls/floor areas.
const unassignedSchedule = createTakeoffSchedule({ totalPages: 1, pixelsPerMm, sheetLevels: {}, completedPillars: [{ ...timberPost, level: undefined }] });
const unassignedPayload = createJobSetupPayload(unassignedSchedule, { sheetLevels: {} });
assert.ok(unassignedPayload.unsupported.some((item) => item.itemId === 'post-timber'), 'Unassigned-level pillar is reported, not silently imported');

console.log('Pillars, Posts & Columns checks passed: canonical classification, composite core+surround as one object, custom rectangular dimensions, grouping, level assignment, Job Setup counts, unclassified review warning, and derived brick surround quantity via the existing brick-order engine.');
