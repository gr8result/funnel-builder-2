// Derived floor-area rows (Living = footprint less named areas, and the totals) must carry the review
// state of the outlines they come from. They used to read "Approved" and reach the quote preview while
// the AI footprint they were calculated from was still unapproved.
import assert from 'node:assert/strict';
import { createTakeoffSchedule, flattenScheduleRows, createQuotePreviewRows } from '../components/construction-estimation/ai-plan-takeoff/takeoffSchedule.js';

const square = (sideMm) => [{ x: 0, y: 0 }, { x: sideMm, y: 0 }, { x: sideMm, y: sideMm }, { x: 0, y: sideMm }];
const schedule = (floorplans) => createTakeoffSchedule({ pixelsPerMm: 1, completedFloorplans: floorplans });
const row = (s, itemId) => flattenScheduleRows(s).find((r) => r.itemId === itemId);
const quoted = (s) => new Set(createQuotePreviewRows(s).map((r) => r.itemId));

const aiFootprint = { id: 'fp', type: 'Footprint', page: 1, nodes: square(10000), source: 'ai', confirmed: false };
const aiGarage = { id: 'g', type: 'Garage', page: 1, nodes: square(5000), source: 'ai', confirmed: false };

// 1. Unapproved AI footprint and garage: every derived row is held for review and kept out of the quote.
const unapproved = schedule([aiFootprint, aiGarage]);
for (const id of ['floor_Footprint', 'floor_Living', 'floor_total_living', 'floor_total_under_roof', 'floor_garage_check']) {
  const r = row(unapproved, id);
  assert.ok(r, `${id} row exists`);
  assert.equal(r.reviewRequired, true, `${id} must need review while its outlines are unapproved`);
  assert.equal(r.commercialStatus, 'Contains unapproved areas', `${id} status`);
  assert.ok(!quoted(unapproved).has(id), `${id} must not reach the quote preview`);
}
assert.equal(row(unapproved, 'floor_Living').quantity, 75, 'Living = 100 - 25 m2');

// 2. Footprint approved but garage not: Living depends on both, so it is still held; under-roof is not.
const mixed = schedule([{ ...aiFootprint, confirmed: true }, aiGarage]);
assert.equal(row(mixed, 'floor_Living').reviewRequired, true, 'Living held while the garage it subtracts is unapproved');
assert.equal(row(mixed, 'floor_total_living').reviewRequired, true, 'Total living held likewise');
assert.equal(row(mixed, 'floor_total_under_roof').reviewRequired, false, 'Under-roof only depends on the approved footprint');
assert.equal(row(mixed, 'floor_total_under_roof').commercialStatus, 'Approved');

// 3. Everything approved: derived rows are approved and reach the quote preview.
const approved = schedule([{ ...aiFootprint, confirmed: true }, { ...aiGarage, confirmed: true }]);
for (const id of ['floor_Living', 'floor_total_living', 'floor_total_under_roof', 'floor_garage_check']) {
  assert.equal(row(approved, id).commercialStatus, 'Approved', `${id} approved`);
  assert.equal(row(approved, id).reviewRequired, false, `${id} not held`);
}
assert.ok(quoted(approved).has('floor_Living'), 'approved Living reaches the quote preview');

// 4. Manual outlines are approved as before.
const manual = schedule([{ id: 'm', type: 'Footprint', page: 1, nodes: square(10000), source: 'manual' }]);
assert.equal(row(manual, 'floor_Living').commercialStatus, 'Approved');

console.log('PASS: derived floor-area rows inherit the review state of their source outlines and stay out of the quote until approved.');
