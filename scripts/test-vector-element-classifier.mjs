// The drawing-element classification stage: repeated notation, cabinetry evidence, retaining
// structures, separate opening measurements, and the builder's control over structures.
import assert from 'node:assert/strict';
import { classifyDrawingElements } from '../components/construction-estimation/ai-plan-takeoff/geometry/elementClassifier.js';
import { vectorAnalysisFromLinework } from '../components/construction-estimation/ai-plan-takeoff/geometry/planModelAdapter.js';

const mmPx = 0.05;
const P = (x, y) => ({ x: x * mmPx, y: y * mmPx });
const wall = (id, a, b, t = 90) => ({ id, nodes: [P(...a), P(...b)], measuredThicknessMm: t, lengthMm: Math.round(Math.hypot(b[0] - a[0], b[1] - a[1])) });
const stroke = (a, b) => ({ x1: a[0] * mmPx, y1: a[1] * mmPx, x2: b[0] * mmPx, y2: b[1] * mmPx, path: 1, subpath: 1, paint: 'stroke', color: '#000000' });
const room = [wall('r1', [0, 0], [6000, 0]), wall('r2', [6000, 0], [6000, 5000]), wall('r3', [6000, 5000], [0, 5000]), wall('r4', [0, 5000], [0, 0])];

// 1. Rows of identical pairs at an even spacing much closer than their length are a table or grid.
{
  const rows = Array.from({ length: 7 }, (_, i) => wall(`t${i}`, [20000, 1000 + i * 550], [24000, 1000 + i * 550], i ? 275 : 254));
  const out = classifyDrawingElements({ walls: [...room, ...rows], openings: [], straight: [], mmPx });
  assert.equal(out.walls.length, 4, 'table rows removed, room walls kept');
  assert.ok(out.records.filter((r) => r.element === 'annotation').every((r) => r.evidence.some((e) => e.rule === 'repeated-pattern')));
  // Real wall nibs repeated along a facade are far apart relative to their length: kept.
  const nibs = Array.from({ length: 4 }, (_, i) => wall(`n${i}`, [i * 2400, 8000], [i * 2400, 8534]));
  assert.equal(classifyDrawingElements({ walls: [...room, ...nibs], openings: [], straight: [], mmPx }).walls.length, 8, 'evenly spaced nibs stay walls');
}

// 2. Cabinetry outline evidence is recorded but, by default, never removes or holds a wall.
{
  const back = wall('k', [1000, 2000], [4600, 2000], 72);
  const carcass = [stroke([1000, 2036], [1000, 2700]), stroke([2100, 2036], [2100, 2700]), stroke([1000, 2700], [4600, 2700])];
  const out = classifyDrawingElements({ walls: [...room, back], openings: [], straight: carcass, mmPx });
  const record = out.records.find((r) => r.id === 'k');
  assert.equal(record.element, 'wall', 'evidence only by default');
  assert.ok(record.evidence.some((e) => e.rule === 'cabinetry-outline'), 'the cabinetry evidence is recorded');
  const acted = classifyDrawingElements({ walls: [...room, back], openings: [], straight: carcass, mmPx }, { actOnCabinetry: true });
  assert.ok(['joinery', 'uncertain'].includes(acted.records.find((r) => r.id === 'k').element), 'switched on, the same evidence classifies it');
  assert.equal(acted.walls.filter((w) => w.id.startsWith('r')).length, 4, 'room walls are never touched by it');
}

// 3. A long thick pair the detector set aside, labelled as a retaining wall, is reported for review.
{
  const rejected = [{ reason: 'not joined to the building (a table or title box, beam, landing or other symbol)', thicknessMm: 190, lengthMm: 8000, a: P(-3000, 0), b: P(-3000, 8000) }];
  const label = [{ text: '190 Series Block Retaining Wall Determined on Site', x: -2500 * mmPx, y: 4000 * mmPx }];
  const out = classifyDrawingElements({ walls: room, openings: [], rejected, straight: [], textItems: label, mmPx });
  assert.equal(out.structures.length, 1); assert.equal(out.structures[0].element, 'retaining'); assert.match(out.structures[0].label, /Retaining/);
  assert.equal(out.walls.length, 4, 'a retaining structure is never added to the house walls');
  assert.equal(classifyDrawingElements({ walls: room, openings: [], rejected, straight: [], textItems: [], mmPx }).structures.length, 0, 'no label, no claim');
  assert.equal(classifyDrawingElements({ walls: room, openings: [], rejected: [{ ...rejected[0], thicknessMm: 70 }], straight: [], textItems: label, mmPx }).structures.length, 0, 'too thin for a retaining wall');

  // The builder decides: listed for review only; External measures it; Not a wall removes it.
  const spec = { id: 't', page: 1, name: 'Lower Floor', pixelsPerMm: mmPx, logicalWidth: 2000, logicalHeight: 2000 };
  const shift = (p) => ({ x: p.x + 500, y: p.y + 500 });
  const geometry = { walls: room.map((w) => ({ ...w, nodes: w.nodes.map(shift) })), openings: [], structures: out.structures.map((s) => ({ ...s, nodes: s.nodes.map(shift) })) };
  const pending = vectorAnalysisFromLinework(geometry, spec);
  const review = pending.reviewWallCandidates.find((item) => item.id.startsWith('review-structure-'));
  assert.ok(review && /Retaining/.test(review.reason), 'listed for review with its label');
  assert.equal(pending.response.walls.length, 4, 'not measured while pending');
  const confirmed = vectorAnalysisFromLinework(geometry, spec, { wallDecisions: { [review.detectionKey]: 'exterior' } });
  assert.equal(confirmed.response.walls.length, 5, 'confirmed External: measured as a wall');
  assert.ok(!confirmed.reviewWallCandidates.some((item) => item.id === review.id));
  const rejectedByBuilder = vectorAnalysisFromLinework(geometry, spec, { wallDecisions: { [review.detectionKey]: 'reject' } });
  assert.equal(rejectedByBuilder.response.walls.length, 4); assert.ok(!rejectedByBuilder.reviewWallCandidates.some((item) => item.id === review.id), 'Not a wall: gone');
}

// 4. Opening measurements: leaf, rough opening and frame are separate and never substituted.
{
  const u = { x: 1, y: 0 };
  const door = { id: 'd', kind: 'door', confirmed: true, leafMm: 820, widthMm: 820, x: 3000 * mmPx, y: 0, direction: u, hostThicknessMm: 90, evidence: 'door swing (820 mm leaf)' };
  const gap = { id: 'g', kind: 'opening', confirmed: false, widthMm: 1100, x: 3100 * mmPx, y: 0, direction: u, hostThicknessMm: 90, evidence: 'a gap in the wall line with nothing drawn to say what it is' };
  const frame = { id: 'f', kind: 'window', confirmed: true, widthMm: 1798, frameUnit: true, needsClassification: true, x: 5000 * mmPx, y: 0, direction: u, hostThicknessMm: 90, evidence: '2 frame panels drawn end to end in the wall' };
  const out = classifyDrawingElements({ walls: room, openings: [door, gap, frame], straight: [], mmPx });
  assert.deepEqual(door.measurements, { leafWidthMm: 820, roughOpeningMm: 1100 }, 'the gap is the door\'s rough opening; the leaf stays the leaf');
  assert.equal(door.widthMm, 820, 'the quantity width is never replaced by the gap or a jamb box');
  assert.equal(gap.bridgeOnly, true, 'the gap is not reported again as its own opening');
  assert.deepEqual(frame.measurements, { frameWidthMm: 1798 }, 'a frame records only a frame width');
  assert.equal(out.openings.length, 3);
  const second = { ...door, id: 'd2', x: 3400 * mmPx, measurements: undefined };
  const gap2 = { ...gap, id: 'g2', bridgeOnly: undefined, measurements: undefined };
  classifyDrawingElements({ walls: room, openings: [{ ...door, measurements: undefined }, second, gap2], straight: [], mmPx });
  assert.notEqual(gap2.bridgeOnly, true, 'a gap holding two doors is not given to either');
  const stopsAtFrame = { ...gap, id: 'g3', bridgeOnly: undefined, evidence: 'a gap in the wall line; stops at the frame drawn beside it' };
  classifyDrawingElements({ walls: room, openings: [stopsAtFrame], straight: [], mmPx });
  assert.equal(stopsAtFrame.measurements.frameWidthMm, undefined, 'a gap beside a frame is not a frame');
}
console.log('Element classifier: notation rows, cabinetry evidence-only default, labelled retaining structures with builder decisions, separate frame/rough/leaf measurements passed.');
