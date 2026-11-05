import assert from 'node:assert/strict';
import { pairedPartialSwingDoors } from '../components/construction-estimation/ai-plan-takeoff/geometry/pairedPartialSwingDoors.js';
import { VECTOR_WALL_DEFAULTS as options } from '../components/construction-estimation/ai-plan-takeoff/geometry/vectorWalls.js';

for (const mmPx of [.0283, .09]) for (const angle of [0, Math.PI / 4, Math.PI / 2]) {
  const P = (x, y) => ({ x: (10000 + x * Math.cos(angle) - y * Math.sin(angle)) * mmPx,
    y: (10000 + x * Math.sin(angle) + y * Math.cos(angle)) * mmPx });
  const straight = [];
  const line = (x, y, X, Y, path, tag) => {
    const a = P(x, y), b = P(X, Y);
    const segment = { x1: a.x, y1: a.y, x2: b.x, y2: b.y, path, tag };
    straight.push(segment); return segment;
  };
  const top = [line(0, 1900, 1000, 1900, 100, 'wall'), line(0, 1970, 930, 1970, 100, 'wall')];
  const bottom = [line(0, 3280, 930, 3280, 200, 'wall'), line(0, 3350, 930, 3350, 200, 'wall')];
  line(1000, 1900, 1000, 2000, 100, 'return');
  line(930, 3240, 930, 3280, 200, 'return');
  line(930, 2000, 1000, 2000, 300, 'cap');
  line(930, 3240, 1000, 3240, 301, 'cap');
  const swing = 39 * Math.PI / 180;
  const tipX = 1000 + 620 * Math.sin(swing), dy = 620 * Math.cos(swing);
  line(1000, 2000, tipX, 2000 + dy, 400, 'leaf');
  line(1000, 3240, tipX, 3240 - dy, 401, 'leaf');
  const arcs = [
    { centre: P(1000, 2000), start: P(1000, 2620), end: P(tipX, 2000 + dy), radius: 620 * mmPx, sweepDeg: 39 },
    { centre: P(1000, 3240), start: P(tipX, 3240 - dy), end: P(1000, 2620), radius: 620 * mmPx, sweepDeg: 39 },
  ];
  const along = (x, y) => x * Math.cos(angle) + y * Math.sin(angle);
  const accepted = [top, bottom].map(parts => ({ angle, thicknessMm: 70,
    lo: Math.max(...parts.map(s => Math.min(along(s.x1, s.y1), along(s.x2, s.y2)))),
    hi: Math.min(...parts.map(s => Math.max(along(s.x1, s.y1), along(s.x2, s.y2)))),
    faces: parts.map(segment => ({ pieces: [{ path: segment.path, segment }] })) }));
  const read = overrides => pairedPartialSwingDoors({ arcs, straight, accepted, openings: [], mmPx, options, ...overrides });
  const before = JSON.stringify({ straight, accepted });
  const found = read({});
  assert.equal(found.length, 1, 'two partial swings are supported by the complete measured assembly');
  assert.equal(found[0].widthMm, 1240);
  assert.equal(found[0].leafCount, 2);
  assert.ok(Math.hypot(found[0].x - P(965, 2620).x, found[0].y - P(965, 2620).y) < 1e-8);
  for (const tag of ['leaf', 'cap', 'return']) {
    const remove = straight.find(s => s.tag === tag);
    assert.equal(read({ straight: straight.filter(s => s !== remove) }).length, 0, `missing ${tag} cannot confirm a paired door`);
  }
  assert.equal(read({ accepted: accepted.slice(1) }).length, 0, 'both measured wall anchors are required');
  assert.equal(read({ accepted: accepted.map(w => ({ ...w, hi: w.hi - 1000 * mmPx })) }).length, 0,
    'an original stroke extending far beyond its measured wall cannot anchor a jamb');
  assert.equal(read({ arcs: [arcs[0]] }).length, 0, 'a lone partial swing is not promoted');
  assert.equal(read({ arcs: [] }).length, 0, 'real capped wall returns without drawn swings remain walls');
  const separatedTips = structuredClone(arcs);
  separatedTips[1].end = P(1000, 2720);
  assert.equal(read({ arcs: separatedTips }).length, 0, 'unconnected closed tips cannot confirm a shared opening');
  const merged = accepted.map(wall => ({ ...wall, faces: [], sourceFaces: wall.faces }));
  assert.equal(read({ accepted: merged }).length, 1, 'merged runs preserve later original face provenance for the jamb anchor');
  assert.equal(read({ accepted: merged.map(wall => ({ ...wall, sourceFaces: [] })) }).length, 0,
    'a merged wall extent alone cannot replace actual connecting face strokes');
  assert.equal(read({ openings: found }).length, 0, 'existing opening is not duplicated');
  assert.equal(JSON.stringify({ straight, accepted }), before, 'real wall geometry is never altered');
}
console.log('Partial paired doors: measured caps, connected returns, both radial leaves and meeting closed tips required; real walls untouched.');
