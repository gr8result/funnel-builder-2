import assert from 'node:assert/strict';
import { levelFromLinework } from '../components/construction-estimation/ai-plan-takeoff/geometry/planModelAdapter.js';
import { computeRooms, wallLengthMm } from '../components/construction-estimation/ai-plan-takeoff/geometry/planModel.js';
import { detectVectorWalls } from '../components/construction-estimation/ai-plan-takeoff/geometry/vectorWalls.js';
import { roomNameFromReading } from '../components/construction-estimation/ai-plan-takeoff/geometry/localLabelOcr.js';

// General wall-continuity rules (2026-11-18), on drawings that are not any one job.
const ppm = 0.0283465; // logical px per mm (1:100 in points)
const px = (mm) => mm * ppm;
const wall = (id, x1, y1, x2, y2, thicknessMm = 90) => ({ id, nodes: [{ x: px(x1), y: px(y1) }, { x: px(x2), y: px(y2) }], measuredThicknessMm: thicknessMm });
const spec = { id: 'l', name: 'L', page: 1, pixelsPerMm: ppm };
const roomArea = (level) => Math.max(0, ...computeRooms(level).map((room) => room.areaM2 || 0));
const totalWallMm = (level) => Object.values(level.walls).reduce((sum, item) => sum + wallLengthMm(level, item), 0);

// 1. A wall that stops 300 mm short of the corner (narrower than any door) is closed virtually: the room
//    closes, and the closure is a separator, not wall length.
{
  const walls = [wall('n', 0, 0, 6000, 0), wall('e', 6000, 0, 6000, 4000), wall('s', 6000, 4000, 0, 4000), wall('w', 0, 4000, 0, 300)];
  const { level, report } = levelFromLinework({ walls, openings: [] }, spec);
  assert.equal(report.gapClosures.length, 1, 'one virtual closure');
  assert.ok(Math.abs(roomArea(level) - 23.1) < 0.5, `the room closes (${roomArea(level).toFixed(2)} m²)`);
  assert.ok(Object.values(level.separators).some((s) => s.basis === 'gap-closure'), 'the closure is a separator');
  assert.ok(Math.abs(totalWallMm(level) - (6000 + 4000 + 6000 + 3700)) < 5, 'no wall length was added');
}
// 2. A door-width gap with nothing drawn in it is NOT closed (it may be a doorway the drawing leaves open).
{
  const walls = [wall('n', 0, 0, 6000, 0), wall('e', 6000, 0, 6000, 4000), wall('s', 6000, 4000, 0, 4000), wall('w', 0, 4000, 0, 1500)];
  const { report } = levelFromLinework({ walls, openings: [] }, spec);
  assert.equal(report.gapClosures.length, 0, 'an unexplained 1.5 m gap stays open');
}
// 3. A 2.4 m sliding door drawn from the corner (its frame read, not taken as a wall) closes the wall line
//    as an opening closure: the room closes, no wall length is added.
{
  const walls = [wall('n', 0, 0, 6000, 0), wall('e', 6000, 0, 6000, 4000), wall('s', 6000, 4000, 2400, 4000), wall('w', 0, 4000, 0, 0)];
  const rejected = [{ a: { x: px(150), y: px(4000) }, b: { x: px(2400), y: px(4000) }, thicknessMm: 110, lengthMm: 2250, reason: "faces not drawn with the drawing's wall pens" }];
  const without = levelFromLinework({ walls, openings: [] }, spec);
  const withFrame = levelFromLinework({ walls, openings: [], rejected }, spec);
  assert.equal(without.report.gapClosures.length, 0, 'without the frame the 2.4 m gap stays open');
  assert.equal(withFrame.report.gapClosures.filter((c) => c.acrossFrame).length, 1, 'with the frame drawn across it, the gap is closed as an opening');
  assert.ok(Math.abs(roomArea(withFrame.level) - 23.1) < 0.5, `the room closes across the door (${roomArea(withFrame.level).toFixed(2)} m²)`);
  assert.ok(Math.abs(totalWallMm(withFrame.level) - totalWallMm(without.level)) < 5, 'the door is not wall length');
}
// 4. Detector: a sliding-door frame lying in the gap between two pieces of one wall (a long clean pair at a
//    thickness the drawing does not use) is not a wall; the gap is an opening between the real pieces.
{
  const segments = [];
  let path = 0;
  const line = (x1, y1, x2, y2) => segments.push({ x1: px(x1) + 20, y1: px(y1) + 20, x2: px(x2) + 20, y2: px(y2) + 20, path: ++path, subpath: segments.length, paint: 'stroke', widthPx: 0.24, color: '#000000' });
  const box = (x0, y0, x1, y1) => { line(x0, y0, x1, y0); line(x1, y0, x1, y1); line(x1, y1, x0, y1); line(x0, y1, x0, y0); };
  // A 9 x 6 m building with 140 mm walls; the top wall has a 2.4 m sliding door from x 3000 to 5400.
  line(0, 0, 3000, 0); line(5400, 0, 9000, 0); line(140, 140, 3000, 140); line(5400, 140, 8860, 140);
  line(3000, 0, 3000, 140); line(5400, 0, 5400, 140);
  line(9000, 0, 9000, 6000); line(8860, 140, 8860, 5860); line(9000, 6000, 0, 6000); line(8860, 5860, 140, 5860); line(0, 6000, 0, 0); line(140, 5860, 140, 140);
  line(4500, 140, 4500, 5860); line(4640, 140, 4640, 5860);
  // The door's frame: two lines 118 mm apart running the full gap.
  line(3000, 11, 5400, 11); line(3000, 129, 5400, 129);
  void box;
  const found = detectVectorWalls(segments, { pixelsPerMm: ppm, logicalWidth: px(9000) + 40, logicalHeight: px(6000) + 40 });
  const inGap = (w) => w.nodes.every((n) => n.x > px(3000) + 20 - 1 && n.x < px(5400) + 20 + 1 && n.y < px(200) + 20);
  assert.ok(!found.walls.some((w) => inGap(w) && Math.abs(w.measuredThicknessMm - 118) < 10), 'the frame is not a wall');
  assert.ok(found.openings.some((o) => Math.abs(o.widthMm - 2400) < 60), `the gap is an opening (${found.openings.map((o) => `${o.kind} ${o.widthMm}`).join(', ')})`);
}
// 5. Room names from OCR readings: short marks either side and stray digits are dropped; nothing else is a name.
assert.equal(roomNameFromReading('BATHI'), 'BATH');
assert.equal(roomNameFromReading('ll WIR f'), 'WIR');
assert.equal(roomNameFromReading('BED2'), 'BED2');
assert.equal(roomNameFromReading('FAMILY 7'), 'FAMILY');
for (const noise of ['Mi', 'OJ', 'towel rail', 'Parapet wall', 'balustrade', 'We']) assert.equal(roomNameFromReading(noise), null, noise);
console.log('Wall continuity: short gaps and drawn sliding doors close rooms virtually (never wall length), unexplained gaps stay open, frames in gaps are openings, OCR room names cleaned.');
