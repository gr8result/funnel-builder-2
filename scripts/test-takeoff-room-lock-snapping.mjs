// Room boundaries: a confirmed + locked boundary survives re-scans and re-measures unchanged; corners
// snap to wall corners, faces and centrelines; colours follow hover / approved / review.
import assert from 'node:assert/strict';
import { mergeRoomReadings } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/roomSchedule.js';
import { roomSnapTargets, snapRoomVertex, polygonAreaPerimeter } from '../components/construction-estimation/ai-plan-takeoff/roomSnapping.js';
import { roomStatusAppearance } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/roomAppearance.js';

const square = (x0, y0, x1, y1) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
const builderPolygon = square(100, 100, 300, 260);
const locked = { id: 'room-1', page: 2, level: 'Ground Floor', name: 'Kitchen', label: 'Kitchen', x: 0.2, y: 0.2, source: 'plan',
  polygon: builderPolygon, confirmed: true, boundaryClosed: true, boundaryLocked: true, lockedAt: '2026-11-09T00:00:00Z', areaM2: 80 };
const unlocked = { ...locked, id: 'room-2', name: 'Laundry', label: 'Laundry', x: 0.6, y: 0.6, boundaryLocked: false, lockedAt: null };

// 1. A re-scan of the same sheet offering new outlines and a new level.
const reading = { page: 2, level: 'Upper Floor', rooms: [
  { id: 'room-1', name: 'Kitchen', x: 0.2, y: 0.2, polygon: square(90, 90, 320, 280) },
  { id: 'room-2', name: 'Laundry', x: 0.6, y: 0.6, polygon: square(400, 400, 500, 500) },
] };
const merged = mergeRoomReadings([locked, unlocked], [reading]);
const kitchen = merged.find((room) => room.id === 'room-1');
assert.ok(kitchen, 'locked room kept');
assert.deepEqual(kitchen.polygon, builderPolygon, 'locked boundary corners unchanged by a re-scan');
assert.equal(kitchen.level, 'Ground Floor', 'locked room level unchanged');
assert.equal(kitchen.boundaryLocked, true);
assert.equal(merged.filter((room) => room.name === 'Kitchen').length, 1, 'the re-scan does not add a second Kitchen');
const laundry = merged.find((room) => room.id === 'room-2');
assert.deepEqual(laundry.polygon, square(400, 400, 500, 500), 'an approved but unlocked, unedited room still takes the new reading (existing rule)');

// 2. Re-measure from walls goes through the same merge: a second pass changes nothing on the locked room.
const again = mergeRoomReadings(merged, [{ ...reading, rooms: [{ id: 'room-1', name: 'Kitchen', x: 0.2, y: 0.2, polygon: square(0, 0, 50, 50) }] }]);
assert.deepEqual(again.find((room) => room.id === 'room-1').polygon, builderPolygon);

// 3. Snapping: corner first, then the nearest face or centreline; nothing within tolerance = unchanged.
const walls = [{ nodes: [{ x: 0, y: 0 }, { x: 200, y: 0 }], thicknessMm: 100, alignment: 'center' }];
const targets = roomSnapTargets(walls, 0.1); // 100 mm = 10 px
assert.ok(targets.segments.some((s) => s.kind === 'face') && targets.segments.some((s) => s.kind === 'centreline'));
const nearCorner = snapRoomVertex({ x: 3, y: 2 }, targets, 6);
assert.equal(nearCorner.snapped, 'corner');
const nearLine = snapRoomVertex({ x: 100, y: 2 }, targets, 6);
assert.ok(['face', 'centreline'].includes(nearLine.snapped));
assert.ok(Math.abs(nearLine.x - 100) < 1e-9, 'slides along the line, not to a corner');
const far = snapRoomVertex({ x: 100, y: 60 }, targets, 6);
assert.deepEqual(far, { x: 100, y: 60, snapped: null });

// 4. Live area and perimeter while dragging: 200 x 160 px at 0.1 px/mm = 2 m x 1.6 m.
const live = polygonAreaPerimeter(builderPolygon, 0.1);
assert.ok(Math.abs(live.areaM2 - 3.2) < 1e-9 && Math.abs(live.perimeterM - 7.2) < 1e-9);

// 5. Colours: hover blue, approved green, review amber.
assert.match(roomStatusAppearance(locked, true).fill, /^rgba\(37,99,235/);
assert.match(roomStatusAppearance(locked, false).fill, /^rgba\(22,163,74/);
assert.match(roomStatusAppearance({ ...unlocked, confirmed: false, reviewRequired: true }, false).fill, /^rgba\(245,158,11/);

console.log('PASS: locked room boundaries survive re-scan and re-measure; corners snap to wall corners, faces and centrelines; live area; hover/approved/review colours.');
