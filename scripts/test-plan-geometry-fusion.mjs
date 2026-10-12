// What the drawing itself establishes without a plan reading, and how a roughly located plan
// reading is joined to it: external/internal walls, door swings, 45 degree walls, openings added
// from linework, and room names assigned to measured spaces. Drawings have known measurements
// (10 mm per pixel).
import assert from 'node:assert/strict';
import { detectPlanGeometry } from '../components/construction-estimation/ai-plan-takeoff/geometry/planGeometry.js';
import { fuseSheetLinework } from '../components/construction-estimation/ai-plan-takeoff/geometry/lineworkFusion.js';
import { detectRoomBoundary } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/roomGeometry.js';

const width = 1000, height = 800;
const context = { pixelsPerMm: 0.1, logicalWidth: width, logicalHeight: height };
const sheet = { pageNumber: 1, ...context };
function drawing(extra, shell = true) {
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  const ink = (x, y) => { const p = (Math.round(y) * width + Math.round(x)) * 4; data[p] = 0; data[p + 1] = 0; data[p + 2] = 0; };
  const hline = (y, x0, x1) => { for (let x = x0; x <= x1; x += 1) { ink(x, y); ink(x, y + 1); } };
  const vline = (x, y0, y1) => { for (let y = y0; y <= y1; y += 1) { ink(x, y); ink(x + 1, y); } };
  // 230 mm external shell, 8 m x 6 m outside.
  if (shell) { hline(100, 100, 901); hline(700, 100, 901); vline(100, 100, 701); vline(900, 100, 701); hline(123, 123, 877); hline(676, 123, 877); vline(123, 123, 677); vline(876, 123, 677); }
  extra({ ink, hline, vline });
  return { width, height, data };
}
const normal = (x, y) => ({ x: x / width, y: y / height });

// --- A 90 mm partition with an 820 mm doorway whose swing is drawn --------------------------------
const swingDoor = drawing(({ ink, hline, vline }) => {
  vline(500, 125, 299); vline(509, 125, 299); hline(298, 500, 510);
  vline(500, 383, 675); vline(509, 383, 675); hline(383, 500, 510);
  // Quarter circle hinged on the lower jamb, radius = the 820 mm leaf, with the open leaf drawn.
  for (let degrees = 0; degrees <= 90; degrees += 0.25) { const a = degrees * Math.PI / 180; ink(500 - 82 * Math.sin(a), 383 - 82 * Math.cos(a)); }
  for (let x = 418; x <= 500; x += 1) ink(x, 383);
});
const bare = detectPlanGeometry(swingDoor, context);
const door = bare.openings.find((opening) => opening.kind === 'wall-gap');
assert.ok(door, 'the doorway is found');
assert.equal(door.confirmed, true, 'a drawn door swing confirms the doorway with nothing else locating it');
assert.equal(door.basis, 'door-swing');
assert.ok(Math.abs(door.leafMm - 820) <= 30, `the swing radius is the door leaf: ${door.leafMm} mm`);
assert.equal(bare.rooms.filter((room) => room.verified).length, 2, 'the swing-confirmed doorway closes both rooms');
assert.equal(bare.walls.filter((wall) => wall.category === 'exterior').length, 4, 'the four shell walls are external');
const partition = bare.walls.filter((wall) => wall.category === 'interior');
assert.equal(partition.length, 1, 'the partition is one internal wall, gross through its doorway');
assert.ok(Math.abs(partition[0].lengthMm - 5530) <= 120, `partition length ${Math.round(partition[0].lengthMm)} mm`);

// The same doorway with no swing drawn is a candidate only.
const plainDoor = drawing(({ hline, vline }) => { vline(500, 125, 299); vline(509, 125, 299); hline(298, 500, 510); vline(500, 383, 675); vline(509, 383, 675); hline(383, 500, 510); });
const plain = detectPlanGeometry(plainDoor, context).openings.find((opening) => opening.kind === 'wall-gap');
assert.deepEqual([plain.confirmed, plain.basis, plain.reviewRequired], [true, 'aligned-wall-ends', true], 'a door-width gap between two ends of one wall is a doorway, flagged for its type');
assert.equal(detectPlanGeometry(plainDoor, context).rooms.filter((room) => room.verified).length, 2, 'and it closes its rooms');
assert.equal(detectPlanGeometry(plainDoor, context, { alignedDoorways: false }).openings.find((opening) => opening.kind === 'wall-gap').confirmed, false);

// --- A window that breaks the shell's linework does not let the outside in --------------------------
const brokenShell = drawing(({ hline, vline }) => {
  hline(100, 100, 499); hline(100, 621, 901); hline(700, 100, 901); vline(100, 100, 701); vline(900, 100, 701);
  hline(123, 123, 499); hline(123, 621, 877); hline(676, 123, 877); vline(123, 123, 677); vline(876, 123, 677);
  vline(499, 100, 124); vline(621, 100, 124);
  // The window: a thin frame set proud of the wall, so no wall band and no aligned wall ends to close.
  hline(92, 499, 621); vline(499, 92, 100); vline(621, 92, 100);
  vline(300, 125, 675); vline(309, 125, 675);
}, false);
const shell = detectPlanGeometry(brokenShell, context);
const inner = shell.walls.find((wall) => wall.axis === 'v' && Math.abs(wall.nodes[0].x - 305) < 8);
assert.ok(inner, 'the partition behind the window is measured');
assert.equal(inner.category, 'interior', 'a partition is not external because a window nearby is drawn open');
assert.ok(shell.walls.filter((wall) => wall.category === 'exterior').length >= 4, 'the shell walls stay external');
assert.ok(shell.rooms.length >= 2 && shell.rooms.every((room) => room.netAreaM2 < 33), 'the rooms behind the window are still enclosed');

// --- A wall drawn at 45 degrees ---------------------------------------------------------------------
const angled = drawing(({ ink }) => {
  for (let t = 0; t <= 225; t += 1) for (const offset of [0, 13]) { ink(650 + offset + t, 125 + t); ink(651 + offset + t, 125 + t); }
});
const diagonal = detectPlanGeometry(angled, context);
const slanted = diagonal.walls.filter((wall) => wall.axis === 'd');
assert.equal(slanted.length, 1, 'the 45 degree wall is measured once');
assert.ok(Math.abs(slanted[0].lengthMm - 3000) <= 350, `diagonal wall length ${Math.round(slanted[0].lengthMm)} mm`);
assert.equal(slanted[0].category, 'interior');
assert.equal(slanted[0].connectedEnds, 2, 'it meets the shell at both ends');
assert.equal(diagonal.rooms.filter((room) => room.verified).length, 2, 'the diagonal wall divides the space');
const corner = diagonal.rooms.filter((room) => room.verified).sort((a, b) => a.netAreaM2 - b.netAreaM2)[0];
assert.ok(corner.netAreaM2 > 1.5 && corner.netAreaM2 < 3, `corner room ${corner.netAreaM2.toFixed(2)} m2`);
// A lone pair of diagonal lines in the middle of a room (hatching, a symbol) is not a wall.
const hatch = drawing(({ ink }) => { for (let t = 0; t <= 120; t += 1) for (const offset of [0, 13]) { ink(400 + offset + t, 300 + t); ink(401 + offset + t, 300 + t); } });
assert.equal(detectPlanGeometry(hatch, context).walls.filter((wall) => wall.axis === 'd').length, 0, 'diagonal linework joining no wall is not a wall');

// --- Fusion: every measured wall, openings from the drawing, a roughly located plan reading -------
const fuse = (response, raster = swingDoor) => fuseSheetLinework({ page: 1, walls: [], openings: [], rooms: [], ...response }, raster, sheet);
const alone = fuse({});
assert.equal(alone.response.walls.length, alone.geometry.walls.length, 'every measured wall is returned with no plan reading at all');
assert.equal(alone.response.walls.filter((wall) => wall.category === 'exterior').length, 4);
assert.equal(alone.response.openings.length, 1, 'the swing door is returned as an opening');
const found = alone.response.openings[0];
assert.ok(found.detectionId.startsWith('linework:') && found.type === 'door' && found.openingClass === 'Internal Door');
assert.equal(found.widthMm, 820, 'its width is the measured leaf, as a standard door size');
assert.equal(found.needsClassification, true, 'it is flagged for the estimator to confirm');
assert.ok(found.hostDetectionId, 'it is attached to its wall');
assert.equal(alone.report.openings.fromDoorSwing, 1);

// The plan reading puts the door 1.1 m along the wall from where it is: it is the same door.
const located = fuse({ openings: [{ detectionId: 'items:d1', page: 1, basis: 'OBSERVED', confidence: 0.9, evidence: 'Door to Bed 2.', ...normal(505, 450), type: 'door', openingClass: 'Internal Door', widthMm: 820, heightMm: 2040, sizeCode: null }] });
assert.equal(located.response.openings.length, 1, 'a roughly located door and the door in the linework are one opening');
assert.equal(located.response.openings[0].detectionId, 'items:d1', 'the plan reading names it');
assert.ok(Math.abs(located.response.openings[0].y * height - 341) <= 6, 'the linework positions it');
assert.equal(located.report.openings.onConfirmedGap, 1);
// A door of a different width that far away is not taken to be this doorway.
const other = fuse({ openings: [{ detectionId: 'items:d2', page: 1, basis: 'OBSERVED', confidence: 0.9, evidence: 'Robe.', ...normal(505, 480), type: 'door', openingClass: 'Internal Door', widthMm: 2400, heightMm: 2040, sizeCode: null }] });
assert.ok(other.response.openings.some((opening) => opening.detectionId.startsWith('linework:')), 'a different door does not replace the one the drawing shows');

// --- Fusion: room names go to measured spaces --------------------------------------------------------
const room = (name, x, y) => ({ page: 1, name, ...normal(x, y), basis: 'OBSERVED', confidence: 0.95, evidence: `Label ${name}.` });
const asScreen = (fused) => fused.response.rooms.map((item, index) => detectRoomBoundary(item, { page: 1, level: 'Ground Floor', width, height, pixelsPerMm: context.pixelsPerMm, walls: [], openings: [], raster: null }, index));
// BED 2's name is read 250 mm on the wrong side of the partition, inside BED 1's room.
const shifted = fuse({ rooms: [room('BED 1', 300, 400), room('BED 2', 480, 420)] });
const beds = asScreen(shifted);
const [bed1, bed2] = ['BED 1', 'BED 2'].map((name) => beds.find((item) => item.name === name));
assert.equal(shifted.report.rooms.adopted, 2);
assert.ok(Math.abs(bed1.areaM2 - 3.77 * 5.53) <= 0.5, `BED 1 area ${bed1.areaM2}`);
assert.ok(Math.abs(bed2.areaM2 - 3.67 * 5.53) <= 0.5, `BED 2 takes the room next door: ${bed2.areaM2}`);
assert.equal(bed1.detectionMethod, 'wall-linework');
assert.equal(bed1.reviewRequired, false, 'a room enclosed by walls and a swing-confirmed door needs no review');
assert.equal(bed2.reviewRequired, true, 'a name read outside its room is flagged');
assert.ok(bed1.polygon.length >= 4 && bed1.polygon.length <= 80);
// Two names in one large space with no wall between them are one open-plan room, not two guesses.
const open = fuse({ rooms: [room('BED 1', 300, 400), room('KITCHEN', 650, 300), room('DINING', 700, 520)] });
const openRooms = asScreen(open);
const shared = openRooms.find((item) => item.name === 'KITCHEN / DINING');
assert.ok(shared, 'the shared space is returned once under both names');
assert.ok(Math.abs(shared.areaM2 - 3.67 * 5.53) <= 0.5);
assert.ok(openRooms.filter((item) => ['KITCHEN', 'DINING'].includes(item.name)).every((item) => !item.polygon?.length), 'neither name is given a boundary the drawing does not show');
// A wet area is never given a 20 m2 room, and an outdoor area is never given an indoor one.
const mismatched = asScreen(fuse({ rooms: [room('BED 1', 300, 400), room('WC', 650, 300), room('PATIO', 700, 500)] }));
assert.ok(!mismatched.find((item) => item.name === 'WC').polygon?.length && !mismatched.find((item) => item.name === 'PATIO').polygon?.length);

// Analysing the same sheet again gives the same walls, openings and room boundaries.
const again = fuse({ rooms: [room('BED 1', 300, 400), room('BED 2', 480, 420)] });
assert.deepEqual(again.response.walls.map((wall) => wall.detectionId), shifted.response.walls.map((wall) => wall.detectionId));
assert.deepEqual(asScreen(again).map((item) => item.id), beds.map((item) => item.id), 'room identities are stable across runs');

console.log('plan geometry fusion: classification, door swings, diagonal walls, linework openings and room naming ok');
