import assert from 'node:assert/strict';
import { levelFromLinework, vectorAnalysisFromLinework } from '../components/construction-estimation/ai-plan-takeoff/geometry/planModelAdapter.js';
import { computeRooms, wallLengthMm } from '../components/construction-estimation/ai-plan-takeoff/geometry/planModel.js';
import { detectVectorWalls } from '../components/construction-estimation/ai-plan-takeoff/geometry/vectorWalls.js';
import { vectorProductionAnalysis } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/vectorProductionAnalysis.js';
import { roomNameFromReading } from '../components/construction-estimation/ai-plan-takeoff/geometry/localLabelOcr.js';

// Room-schedule rules (2026-11-18, round 3), on drawings that are not any one job. Spec in mm (1 px = 1 mm).
const spec = { id: 'l', name: 'L', page: 1, pixelsPerMm: 1, logicalWidth: 20000, logicalHeight: 20000 };
const wall = (id, x1, y1, x2, y2, t = 90) => ({ id, nodes: [{ x: x1, y: y1 }, { x: x2, y: y2 }], measuredThicknessMm: t });
const frame = (x1, y1, x2, y2, t = 110) => ({ a: { x: x1, y: y1 }, b: { x: x2, y: y2 }, thicknessMm: t, lengthMm: Math.hypot(x2 - x1, y2 - y1), reason: "faces not drawn with the drawing's wall pens" });
const line = (x1, y1, x2, y2) => ({ x1, y1, x2, y2 });
const totalWallMm = (level) => Object.values(level.walls).reduce((sum, item) => sum + wallLengthMm(level, item), 0);

// 1. A stacker door drawn along a whole side, from the corner of one wall to the face of another (no free wall
//    end to start from): the side closes as an opening for rooms only, never wall length, listed for review.
{
  const walls = [wall('n', 0, 0, 6000, 0), wall('e', 6000, 0, 6000, 4000), wall('s', 6000, 4000, 0, 4000), wall('w', 0, 0, 0, 500), wall('o', 0, 500, -1500, 500)];
  const without = levelFromLinework({ walls, openings: [] }, spec);
  const withFrame = levelFromLinework({ walls, openings: [], rejected: [frame(40, 560, 40, 3960)] }, spec);
  assert.equal(computeRooms(without.level).length, 0, 'without the frame the side is open');
  assert.equal(computeRooms(withFrame.level).length, 1, 'with the stacker frame drawn along it the room closes');
  assert.ok(withFrame.report.gapClosures.some((c) => c.acrossFrame), 'closed across the frame');
  assert.ok(Math.abs(totalWallMm(withFrame.level) - totalWallMm(without.level)) < 5, 'the door is not wall length');
  const analysis = vectorAnalysisFromLinework({ walls, openings: [], rejected: [frame(40, 560, 40, 3960)] }, spec);
  assert.ok(analysis.reviewOpeningCandidates.some((item) => item.modelKind === 'frame-closure' && Math.abs(item.widthMm - 3500) < 150), 'the door is listed for the builder to confirm');
  // Hatching (repeated parallel figures) is not a door frame.
  const hatch = [0, 300, 600].map((dx) => frame(40 + dx, 560, 40 + dx, 3960));
  assert.equal(computeRooms(levelFromLinework({ walls: walls.filter((w) => w.id !== 's').concat([wall('s2', 6000, 4000, 1500, 4000)]), openings: [], rejected: hatch }, spec).level).length, 0, 'hatching does not close a side');
}

// 2. A closure that lands on another closure (planarize adds a node to it): every piece of it still bounds rooms.
{
  const walls = [wall('n', 0, 0, 6000, 0), wall('e', 6000, 0, 6000, 8000), wall('s', 6000, 8000, 0, 8000), wall('w', 0, 8000, 0, 4300), wall('w2', 0, 0, 0, 500), wall('o', 0, 500, -1500, 500),
    wall('p1', 3000, 4000, 6000, 4000)];
  const rejected = [frame(40, 4000, 2960, 4000), frame(40, 560, 40, 3960)];
  const { level } = levelFromLinework({ walls, openings: [], rejected }, spec);
  const rooms = computeRooms(level);
  assert.equal(rooms.length, 2, `two rooms, the closures bounding both (${rooms.map((r) => r.areaM2.toFixed(1)).join(', ')})`);
}

// 3. A robe whose front is drawn as sliding doors (lines from wall to wall, no wall): its own room, the bedroom
//    stops at the front, and its doors are listed for review.
{
  const walls = [wall('n', 0, 0, 3600, 0), wall('e', 3600, 0, 3600, 4000), wall('s', 3600, 4000, 0, 4000), wall('w', 0, 4000, 0, 0)];
  const labels = [{ name: 'BED 2', x: 1500, y: 2000 }, { name: 'robe', x: 3300, y: 2000 }];
  const drawnLines = [line(2980, 45, 2980, 2000), line(3000, 1900, 3000, 3955), line(3020, 45, 3020, 3955)];
  const plain = vectorAnalysisFromLinework({ walls, openings: [] }, spec, { labels });
  const fronted = vectorAnalysisFromLinework({ walls, openings: [] }, spec, { labels, drawnLines });
  assert.equal(plain.rooms.length, 1, 'without the drawn front the robe is part of the bedroom');
  assert.deepEqual(fronted.rooms.map((r) => r.name).sort(), ['BED 2', 'robe'], 'with it, the robe is its own room');
  assert.ok(fronted.report.dividers.some((d) => d.front), 'divided at the drawn front, not by a wall');
  assert.ok(fronted.reviewOpeningCandidates.some((item) => item.modelKind === 'robe-front'), 'the robe doors are listed for review');
}

// 4. A bath whose outline closes against the bathroom walls is the bathroom's fixture, not a room. A WC with a
//    door is still a room.
{
  const walls = [wall('n', 0, 0, 3000, 0), wall('e', 3000, 0, 3000, 2500), wall('s', 3000, 2500, 0, 2500), wall('w', 0, 2500, 0, 0), wall('rim', 1200, 750, 3000, 750, 70), wall('rimw', 1200, 0, 1200, 750, 70)];
  const basin = [line(1300, 100, 2900, 100), line(2900, 100, 2900, 650), line(2900, 650, 1300, 650), line(1300, 650, 1300, 100)];
  const labels = [{ name: 'BATH', x: 1500, y: 1800 }];
  const kept = levelFromLinework({ walls, openings: [] }, spec, { labels });
  const folded = levelFromLinework({ walls, openings: [] }, spec, { labels, drawnLines: basin });
  assert.equal(computeRooms(kept.level).length, 2, 'without its drawn basin the outline closes a face');
  assert.equal(computeRooms(folded.level).length, 1, 'with it, the bath is part of the bathroom');
  assert.equal(folded.report.fixtures.length, 1);
  assert.equal(folded.report.fixtures[0].room, 'BATH');
  const withDoor = levelFromLinework({ walls, openings: [{ id: 'd', x: 1200, y: 375, axis: 'v', direction: { x: 0, y: 1 }, widthMm: 600, hostThicknessMm: 70, kind: 'door', confirmed: true }] }, spec, { labels, drawnLines: basin });
  assert.equal(withDoor.report.fixtures.length, 0, 'a space with a door into it is a room');
}

// 5. A roof over the storey below drawn inside the upper walls (no room name, a pitch noted in it): out of the
//    room schedule and the floor outline; the walls round it alone wait for the builder.
{
  const ppm = 0.05, W = 1200, H = 1200, P = (x, y) => ({ x: x * ppm, y: y * ppm });
  const pw = (id, x1, y1, x2, y2) => ({ id, nodes: [P(x1, y1), P(x2, y2)], measuredThicknessMm: 90, lengthMm: Math.hypot(x2 - x1, y2 - y1) });
  const detected = { walls: [pw('a', 1000, 1000, 6000, 1000), pw('b', 6000, 1000, 6000, 8000), pw('c', 6000, 8000, 1000, 8000), pw('d', 1000, 8000, 1000, 1000),
    pw('e', 6000, 1000, 8500, 1000), pw('f', 8500, 1000, 8500, 4000), pw('g', 8500, 4000, 6000, 4000)], openings: [], rejected: [], stats: {} };
  const s = { id: 'p', name: 'Upper', page: 2, pixelsPerMm: ppm, logicalWidth: W, logicalHeight: H };
  const response = { page: 2, level: 'Upper', walls: [], openings: [], buildingAreas: [], pillars: [], eaves: [], rooms: [], fixtures: [], documentedQuantities: [], review: [] };
  const labels = [{ name: 'BED 1', ...P(3500, 4500) }];
  const plain = vectorProductionAnalysis(response, detected, s, { labels, outdoor: { segments: [], textItems: [] } });
  const roof = vectorProductionAnalysis(response, detected, s, { labels, outdoor: { segments: [], textItems: [], notes: [{ text: '5 Pitch', ...P(7200, 2500) }] } });
  assert.equal(plain.vector.rooms.length, 2, 'unmarked, the enclosed area is a room');
  assert.equal(roof.vector.rooms.length, 1, 'marked as roof it is not');
  assert.equal(roof.vector.roofOnlySpaces.length, 1);
  assert.ok(roof.vector.report.footprint.outlineM2 < plain.vector.report.footprint.outlineM2 - 6, `the roof is out of the floor outline (${roof.vector.report.footprint.outlineM2} vs ${plain.vector.report.footprint.outlineM2} m²)`);
  assert.ok(roof.vector.reviewWallCandidates.some((item) => /roof/.test(item.reason)), 'walls bounding only the roof are held for review');
}

// 6. Openings drawn in a pair prove it is a wall whatever pen it is drawn in (a lightweight extension in a finer
//    pen than the masonry); the same pair with no jambed openings is not taken.
{
  const ppm = 0.0283465, px = (mm) => mm * ppm + 20;
  const build = (jambs) => {
    const segments = []; let path = 0;
    const seg = (x1, y1, x2, y2, widthPx = 0.24) => segments.push({ x1: px(x1), y1: px(y1), x2: px(x2), y2: px(y2), path: ++path, subpath: segments.length, paint: 'stroke', widthPx, color: '#000000' });
    // Main building 9 x 6 m, 140 mm walls, a 70 mm partition (all in the 0.24 pen).
    seg(0, 0, 9000, 0); seg(140, 140, 8860, 140); seg(9000, 0, 9000, 6000); seg(8860, 140, 8860, 5860); seg(9000, 6000, 0, 6000); seg(8860, 5860, 140, 5860);
    seg(0, 6000, 0, 0); seg(140, 5860, 140, 140); seg(4500, 140, 4500, 5860); seg(4570, 140, 4570, 5860);
    // An extension wall below it in the 0.12 pen, 70 mm, in three pieces with two 900 mm windows between them.
    const y = 8000;
    for (const [a, b] of [[0, 1000], [1900, 2900], [3800, 4800]]) { seg(a, y, b, y, 0.12); seg(a, y + 70, b, y + 70, 0.12); }
    if (jambs) for (const x of [1000, 1900, 2900, 3800]) seg(x, y - 20, x, y + 90, 0.36);
    // Its side walls join it to the house.
    seg(0, 6000, 0, y + 70); seg(70, 6000, 70, y); seg(4800, 6000, 4800, y + 70); seg(4730, 6000, 4730, y);
    return detectVectorWalls(segments, { pixelsPerMm: ppm, logicalWidth: px(9000) + 40, logicalHeight: px(9000) + 40 });
  };
  const ext = (found) => found.walls.filter((w) => w.nodes.every((n) => n.y > px(7900) && n.y < px(8200)));
  assert.equal(ext(build(true)).length, 3, 'the extension wall pieces with jambed windows are walls');
  assert.equal(ext(build(false)).length, 0, 'without the window jambs the fine-pen pairs are not walls');
}

// 7. Room names read from outlined text: marks glued to the word and one misread letter in a long name.
for (const [raw, name] of [['aLLDRY ff', 'LDRY'], ['STORAGEN', 'STORAGE'], ['BITCHEN', 'KITCHEN'], ['mWIR', 'WIR'], ['BATHI', 'BATH'], ['BED2', 'BED2']]) assert.equal(roomNameFromReading(raw), name, raw);
for (const noise of ['Abed', 'AWIR', 'Pwo', 'Bulkhead', 'fridge', 'Plumbjng Stack', 'Hiche']) assert.equal(roomNameFromReading(noise), null, noise);

console.log('Room schedule rules: corner frame closures (not hatching), split closures, drawn robe fronts with review doors, bath fixtures, roof-only areas, opened-pen walls and OCR name cleaning.');
