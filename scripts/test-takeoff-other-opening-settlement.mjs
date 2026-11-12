// An opening the reading could not class asks the builder; once the builder confirms it is an opening with
// no door or window (a cased opening, a void) the question is settled and stops blocking the quotation.
import assert from 'node:assert/strict';
import { createTakeoffSchedule, createJobSetupPayload } from '../components/construction-estimation/ai-plan-takeoff/takeoffSchedule.js';
import { confirmOpeningClass } from '../components/construction-estimation/ai-plan-takeoff/manualOpeningEdit.js';

const wall = { id: 'w1', page: 1, category: 'interior', nodes: [{ x: 0, y: 0 }, { x: 400, y: 0 }], thicknessMm: 90, wallHeightM: 2.4, frameThicknessMm: 70, constructionSystem: 'internal_timber_frame' };
const opening = { id: 'o1', page: 1, type: 'opening', openingClass: 'Other Opening', widthMm: 900, heightMm: 2100, hostWallId: 'w1', linkedWallId: 'w1', x: 200, y: 0 };
const payload = (openings) => createJobSetupPayload(createTakeoffSchedule({ totalPages: 1, pixelsPerMm: 0.1, sheetLevels: { 1: 'Ground Floor' }, completedWallRuns: [wall], placedOpenings: openings, jobSetupRows: { lowerCeilingHeight: { value: '2400' } } }));
const open = payload([opening]);
assert.ok(open.review.decisions.some((d) => d.id === 'opening-class'), 'an unclassed opening asks the builder');
assert.ok(open.commercialBlockers.some((b) => b.id === 'opening-class'), 'and holds the quotation');
const confirmed = confirmOpeningClass(opening, 'Other Opening');
assert.ok(confirmed.typeConfirmedAt, 'confirming records when');
const settled = payload([confirmed]);
assert.ok(!settled.review.decisions.some((d) => d.id === 'opening-class'), 'a confirmed opening with neither door nor window is settled');
const asDoor = payload([confirmOpeningClass(opening, 'Internal Door')]);
assert.ok(!asDoor.review.decisions.some((d) => d.id === 'opening-class'), 'set as a door it is settled too');
console.log('Other openings: unclassed openings ask the builder; confirmed ones (opening, door or window) stop blocking.');
