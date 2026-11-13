// Construction quantities from approved geometry and builder answers only: insulation, waterproofing,
// skirting, cornice, stairs and roof plan area. Missing information gives a row with no quantity (and a
// review question where the builder can answer it), never an assumed figure.
import assert from 'node:assert/strict';
import { createConstructionQuantityRows, constructionDecisions, applyConstructionInput } from '../components/construction-estimation/ai-plan-takeoff/constructionQuantities.js';
import { createTakeoffSchedule, createJobSetupPayload, flattenScheduleRows } from '../components/construction-estimation/ai-plan-takeoff/takeoffSchedule.js';

const ppm = 0.1; // 0.1 px per mm: 100 px = 1 m
const box = (x0, y0, x1, y1) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
const room = (id, name, page, level, poly, extra = {}) => {
  const w = (poly[1].x - poly[0].x) / ppm / 1000, h = (poly[2].y - poly[1].y) / ppm / 1000;
  return { id, name, page, level, polygon: poly, areaM2: w * h, perimeterM: 2 * (w + h), confirmed: true, pixelsPerMm: ppm, ...extra };
};
const levelOf = (page) => ({ 1: 'Ground Floor', 2: 'Second Level' }[page] || 'Unassigned');
// Ground: Living 6x5, Bath 3x2, Garage 6x6, Stair 2x4.  Upper: Bed 4x4, Ensuite 2x2.
const rooms = [
  room('living', 'Living', 1, 'Ground Floor', box(0, 0, 600, 500)), room('bath', 'Bathroom', 1, 'Ground Floor', box(600, 0, 900, 200)),
  room('garage', 'Garage', 1, 'Ground Floor', box(0, 500, 600, 1100)), room('stair', 'Stair', 1, 'Ground Floor', box(600, 200, 800, 600)),
  room('bed', 'Bed 1', 2, 'Second Level', box(0, 0, 400, 400)), room('ens', 'Ensuite', 2, 'Second Level', box(400, 0, 600, 200)),
];
// One 900 mm door on the living room's east side (x = 600), one on the bathroom's south side.
const placedOpenings = [
  { id: 'd1', page: 1, type: 'door', widthMm: 900, heightMm: 2040, x: 600, y: 350 },
  { id: 'd2', page: 1, type: 'door', widthMm: 820, heightMm: 2040, x: 750, y: 200 },
  { id: 'w1', page: 2, type: 'window', widthMm: 1800, heightMm: 1200, x: 200, y: 0, linkedWallId: 'e-n' },
];
const completedWallRuns = [
  { id: 'e-n', page: 2, category: 'exterior', nodes: [{ x: 0, y: 0 }, { x: 600, y: 0 }], lengthMm: 6000, wallHeightM: 2.7 },
  { id: 'e-w', page: 2, category: 'exterior', nodes: [{ x: 0, y: 0 }, { x: 0, y: 400 }], lengthMm: 4000, wallHeightM: 2.7 },
];
const footprint = { id: 'fp2', page: 2, type: 'Footprint', source: 'ai', confirmed: true, nodes: box(0, 0, 600, 400) };
const base = { rooms, completedWallRuns, placedOpenings, completedFloorplans: [footprint], completedEaves: [], pixelsPerMm: ppm, levelOf };
const byKey = (rows) => Object.fromEntries(rows.map((row) => [row.itemId, row]));

{ // No builder answers yet, no eaves width or pitch.
  const rows = byKey(createConstructionQuantityRows(base));
  assert.equal(rows['construction-wall-insulation-second-level'].quantity, 10 * 2.7 - 1.8 * 1.2, 'external wall insulation = length × height less openings');
  assert.equal(rows['construction-ceiling-insulation-second-level'].quantity, 20, 'top level: every approved ceiling is under the roof');
  assert.equal(rows['construction-ceiling-insulation-ground-floor'].quantity, null, 'a lower level waits for the builder (part may be under the upper floor)');
  assert.equal(rows['construction-waterproof-floor-ground-floor'].quantity, 6, 'wet area floor = approved wet rooms');
  assert.equal(rows['construction-waterproof-junction-ground-floor'].quantity, 10, 'junction = wet room perimeters');
  assert.equal(rows['construction-waterproof-shower-ground-floor'].quantity, null, 'shower walls are never guessed');
  assert.equal(rows['construction-waterproof-floor-second-level'].quantity, 4);
  // Skirting ground: Living 22 m − 0.9 door, Stair 12 m − 0.9 (same living door) − 0.82 (bath door) = 31.38.
  // A door between two rooms is deducted from both rooms' skirting. Bath (wet, tiled) and garage excluded.
  assert.equal(rows['construction-skirting-ground-floor'].quantity, 31.38, 'skirting = perimeters of dry rooms less doorways on each side');
  assert.equal(rows['construction-cornice-ground-floor'].quantity, 22 + 10 + 12, 'cornice = perimeters, garage excluded');
  assert.equal(rows['construction-stairs-ground-floor'].quantity, null, 'stairs wait for the builder');
  assert.equal(rows['construction-roof-plan-second-level'].quantity, null, 'roof plan waits for the eaves width');
}

{ // Builder answers and Job Setup entries fill the gaps.
  let analysis = { rooms };
  const questions = constructionDecisions(analysis);
  assert.deepEqual(questions.map((q) => q.id).sort(), ['construction:ceiling-under-roof:Ground Floor', 'construction:stair-flights']);
  const ceilingQuestion = questions.find((q) => q.field === 'ceilingUnderRoofM2');
  assert.equal(ceilingQuestion.action.suggested, 30 + 6 + 36 + 8 - 20, 'suggestion = lower ceilings less the upper floor (a suggestion only)');
  assert.equal(ceilingQuestion.action.allowZero, true, '0 is a valid answer');
  for (const question of questions) analysis = applyConstructionInput(analysis, question, question.field === 'stairFlights' ? 2 : 0);
  assert.deepEqual(analysis.constructionInputs, { stairFlights: 2, ceilingUnderRoofM2: { 'Ground Floor': 0 } });
  assert.deepEqual(constructionDecisions(analysis), [], 'answered questions are not asked again');
  const rows = byKey(createConstructionQuantityRows({ ...base, inputs: analysis.constructionInputs, jobSetupRows: { eavesWidthM: { value: '0.6' }, roofPitchDegrees: { value: '22.5' } } }));
  assert.equal(rows['construction-ceiling-insulation-ground-floor'].quantity, 0, 'the builder said none of the ground floor has roof above');
  assert.equal(rows['construction-stairs-ground-floor'].quantity, 2);
  // Footprint 6 x 4 m grown by 0.6 m eaves: 7.2 x 5.2 = 37.44 m2 (= 24 + 20 × 0.6 + 4 × 0.36).
  assert.equal(rows['construction-roof-plan-second-level'].quantity, 37.44);
  assert.equal(rows['construction-roof-pitched-second-level'].quantity, Math.round(37.44 / Math.cos(22.5 * Math.PI / 180) * 100) / 100);
}

{ // Unapproved rooms and walls without heights are never counted.
  const pending = rooms.map((r) => (r.id === 'bath' ? { ...r, confirmed: false } : r));
  const rows = byKey(createConstructionQuantityRows({ ...base, rooms: pending, completedWallRuns: completedWallRuns.map((w) => ({ ...w, wallHeightM: undefined })) }));
  assert.equal(rows['construction-waterproof-floor-ground-floor'].quantity, null, 'the only wet room is not approved yet');
  assert.equal(rows['construction-wall-insulation-second-level'].quantity, null, 'no wall height, no wall insulation figure');
  assert.match(rows['construction-wall-insulation-second-level'].notes, /wall height/);
  const footprintPending = byKey(createConstructionQuantityRows({ ...base, completedFloorplans: [{ ...footprint, confirmed: false }], jobSetupRows: { eavesWidthM: { value: '0.6' } } }));
  assert.equal(footprintPending['construction-roof-plan-second-level'].quantity, null, 'an unapproved AI footprint gives no roof area');
}

{ // Through the schedule, the review and the Job Setup hand-off.
  const schedule = createTakeoffSchedule({ totalPages: 2, currentPage: 1, pixelsPerMm: ppm, sheetLevels: { 1: 'Ground Floor', 2: 'Second Level' },
    completedWallRuns, placedOpenings, completedFloorplans: [footprint], jobSetupRows: { eavesWidthM: { value: '0.6' } },
    aiAnalysis: { rooms, constructionInputs: { stairFlights: 1 } } });
  const rows = schedule.projectTotals.constructionQuantities;
  assert.ok(rows.length >= 10 && rows.every((row) => row.section === 'Construction Quantities'));
  assert.ok(flattenScheduleRows(schedule).some((row) => row.section === 'Construction Quantities'), 'in the flat schedule (CSV / report)');
  const payload = createJobSetupPayload(schedule);
  assert.equal(payload.constructionQuantities.length, rows.length, 'carried in the Job Setup hand-off');
  assert.ok(payload.review.decisions.some((d) => d.id === 'construction:ceiling-under-roof:Ground Floor'), 'the open question is a review item');
  assert.ok(!payload.review.decisions.some((d) => d.id === 'construction:stair-flights'), 'an answered question is not');
}
{ // Levels named the way drawings name them (Jesmond: Lower Floor below Upper Floor) keep their storey order.
  const named = rooms.map((r) => ({ ...r, level: r.level === 'Ground Floor' ? 'Lower Floor' : 'Upper Floor' }));
  const questions = constructionDecisions({ rooms: named });
  // Drawing names land on the app's level names (the names sheet assignments, Job Setup and the other review
  // questions use), so the answer is stored under the same level the schedule rows use.
  assert.deepEqual(questions.map((q) => q.id).sort(), ['construction:ceiling-under-roof:Ground Floor', 'construction:stair-flights'], 'the lower floor is asked about, never the upper');
  const rows = byKey(createConstructionQuantityRows({ ...base, rooms: named, levelOf: (page) => ({ 1: 'Lower Floor', 2: 'Upper Floor' }[page]) }));
  assert.equal(rows['construction-ceiling-insulation-second-level'].quantity, 20, 'the upper floor is the top level');
}
{ // Mixed: upper rooms carry the drawing's "Upper Floor", lower rooms carry no level and take their sheet's
  // assignment ("Ground Floor"). 12 Nov browser run on Jesmond: this made three levels and asked whether the
  // UPPER floor had roof above it. One storey must stay one level.
  const mixed = rooms.map((r) => (r.level === 'Ground Floor' ? { ...r, level: undefined } : { ...r, level: 'Upper Floor' }));
  const levelOf = (page) => ({ 1: 'Ground Floor', 2: 'Second Level' }[page]);
  const questions = constructionDecisions({ rooms: mixed }, levelOf);
  assert.deepEqual(questions.map((q) => q.id).sort(), ['construction:ceiling-under-roof:Ground Floor', 'construction:stair-flights'], 'two levels, the lower one asked about');
  const rows = createConstructionQuantityRows({ ...base, rooms: mixed, levelOf });
  assert.deepEqual([...new Set(rows.map((row) => row.level))].sort(), ['Ground Floor', 'Second Level'], 'rows on two levels only');
}
console.log('Construction quantities: insulation, waterproofing, skirting, cornice, stairs and roof plan from approved geometry and builder answers; nothing assumed.');
