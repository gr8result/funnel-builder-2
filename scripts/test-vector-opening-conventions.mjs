// Drawing conventions for openings found on Liberty Terrace (2026-11-15). Each case is a real drawing
// convention the detector previously left as an unconfirmed gap or missed altogether:
//   1. a wall continuing past a capped opening keeps its off-mode thickness (200 mm dining/foyer wall);
//   2. a dashed head line along both faces across a gap confirms an opening (no text layer needed);
//   3. barn doors drawn slid part-way open (one leaf, or a pair parting to each end) confirm a door;
//   4. "770 SQUARE ..." is an opening width, and an agreeing opening label confirms a bare gap,
//      while a plain size code beside a bare gap still settles nothing.
// Run: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-vector-opening-conventions.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { detectVectorWalls } from '../components/construction-estimation/ai-plan-takeoff/geometry/vectorWalls.js';
import { parseOpeningLabel, applyOpeningLabels } from '../components/construction-estimation/ai-plan-takeoff/geometry/openingLabels.js';
import { privateTestDataUrl } from './lib/privateTestData.mjs';

const fixture = new URL(privateTestDataUrl('vector-regression-2026-10-18', 'frozen'));
const input = JSON.parse(fs.readFileSync(new URL('application-input.json', fixture)));
const image = await loadImage(fs.readFileSync(new URL('application-raster.png', fixture)));
const canvas = createCanvas(image.width, image.height); canvas.getContext('2d').drawImage(image, 0, 0);
const raster = canvas.getContext('2d').getImageData(0, 0, image.width, image.height); raster.storedPixelsPerMm = input.storedPixelsPerMm;
const detected = detectVectorWalls(input.vectorSegments, { ...input, raster });
const ppm = input.pixelsPerMm;
const reference = JSON.parse(fs.readFileSync(new URL('reference.json', fixture)));
const at = (id) => reference.openings.find((o) => o.id === id);
const nearest = (point) => detected.openings.map((o) => ({ o, mm: Math.hypot(o.x - point.x, o.y - point.y) / ppm })).sort((p, q) => p.mm - q.mm)[0];

// 1. The 200 mm dining/foyer wall either side of its opening.
const onLine = detected.walls.filter((w) => w.nodes.every((p) => Math.abs(p.y - 531.83) < 1) && Math.round(w.measuredThicknessMm) === 201);
assert.equal(onLine.length, 2, `both pieces of the 200 mm wall are walls (got ${onLine.length})`);
assert.ok(onLine.some((w) => w.nodes.some((p) => p.x > 300)), 'the 816 mm piece past the opening is kept');

// 2. Dashed head line: confirmed opening, width between the drawn jambs.
{
  const ref = at('dining-foyer-opening'), { o, mm } = nearest(ref);
  assert.ok(mm < 100, `dining/foyer opening found (${Math.round(mm)} mm off)`);
  assert.equal(o.kind, 'opening'); assert.equal(o.confirmed, true);
  assert.match(o.evidence, /dashed head line/);
  assert.ok(Math.abs(o.widthMm - 1658) <= 20, `jamb-to-jamb width ${o.widthMm} (drawn 1658, printed 1640)`);
}
// 3. Barn doors drawn slid open.
for (const [id, leaves] of [['bed1-barn-door', 1], ['media-opening', 2]]) {
  const { o, mm } = nearest(at(id));
  assert.ok(mm < 100, `${id} found (${Math.round(mm)} mm off)`);
  assert.equal(o.kind, 'barn-door', `${id} kind`); assert.equal(o.confirmed, true, `${id} confirmed`);
  assert.match(o.evidence, new RegExp(`${leaves} barn door lea`), `${id}: ${o.evidence}`);
}
// The WIR gap has nothing drawn in it: still unconfirmed from linework alone.
{
  const { o, mm } = nearest(at('bed1-wir-opening'));
  assert.ok(mm < 100); assert.equal(o.confirmed, false, 'a bare gap is never confirmed by linework alone');
}

// 4. Labels.
{
  const width = parseOpeningLabel('770 SQUARE');
  assert.equal(width.form, 'width'); assert.equal(width.widthMm, 770); assert.equal(width.kind, 'opening');
  assert.equal(parseOpeningLabel('820 BARN').form, 'leaf', 'a leaf label is still a leaf');
  assert.equal(parseOpeningLabel('2100 X 770 SQUARE SET OPENING').kind, 'opening');
  const gap = () => ({ id: 'g', kind: 'opening', confirmed: false, widthMm: 778, x: 0, y: 0, direction: { x: 0, y: 1 } });
  const assign = (opening, text) => ({ assignments: [{ opening, label: { parsed: parseOpeningLabel(text), confidence: 0.99, source: 'ocr' }, fit: { agrees: true, compatible: true, differenceMm: 8 }, perpMm: 200, alongMm: 0 }] });
  const named = gap(); applyOpeningLabels([named], assign(named, '770 SQUARE'));
  assert.equal(named.confirmed, true, 'an agreeing "SQUARE SET OPENING" label confirms the bare gap');
  assert.equal(named.kind, 'opening', 'it stays an opening (Other Opening, type confirmed by the builder)');
  const sized = gap(); applyOpeningLabels([sized], assign(sized, '2108'));
  assert.equal(sized.confirmed, false, 'a size code beside a bare gap does not say what fills it');
}
console.log('Opening drawing-convention checks passed: wall continued past a capped opening, dashed head line, barn doors slid open (1 and 2 leaves), bare gap unconfirmed, opening labels.');
