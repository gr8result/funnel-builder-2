// Outdoor areas from the drawn outline (geometry/outdoorAreas.js): synthetic cases for what must and must not
// be read, then the real Jesmond Road balcony and terrace against the plan's printed area table (local cache;
// that part skips when the plan is not on this machine). The printed figures are only compared at the end;
// nothing from them reaches the reading.
import assert from 'node:assert/strict';
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
import { traceOutdoorArea, outdoorTypeOf } from '../components/construction-estimation/ai-plan-takeoff/geometry/outdoorAreas.js';
import { detectVectorWalls } from '../components/construction-estimation/ai-plan-takeoff/geometry/vectorWalls.js';
import { vectorProductionAnalysis } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/vectorProductionAnalysis.js';
import { roomLabelsFromText } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/localVectorAnalysis.js';

const seg = (x1, y1, x2, y2) => ({ x1, y1, x2, y2 });
const rect = (l, t, r, b) => [seg(l, t, r, t), seg(r, t, r, b), seg(r, b, l, b), seg(l, b, l, t)];
const dashed = (x1, y1, x2, y2, dash = 300) => { const out = []; const len = Math.hypot(x2 - x1, y2 - y1); for (let s = 0; s < len; s += 2 * dash) { const e = Math.min(len, s + dash); out.push(seg(x1 + (x2 - x1) * s / len, y1 + (y2 - y1) * s / len, x1 + (x2 - x1) * e / len, y1 + (y2 - y1) * e / len)); } return out; };
const tick = (x, y) => seg(x - 120, y + 120, x + 120, y - 120);
const house = [{ x: 0, y: 0 }, { x: 10000, y: 0 }, { x: 10000, y: 8000 }, { x: 0, y: 8000 }];
const houseLines = rect(0, 0, 10000, 8000);

{ // A balcony along the house: decking hatch inside, posts on the outer edge, a dashed roof line around it,
  // a dimension line below with extension lines in line with its sides.
  const segments = [...houseLines, ...rect(0, 8000, 10000, 10000)];
  for (let y = 8300; y < 10000; y += 300) segments.push(seg(0, y, 4500, y), seg(5500, y, 10000, y)); // boards, broken by the label
  for (const x of [70, 5000, 9930]) segments.push(...rect(x - 70, 9930, x + 70, 10070), seg(x - 70, 9930, x + 70, 10070)); // posts
  segments.push(...dashed(-600, 8000, -600, 10600), ...dashed(-600, 10600, 10600, 10600), ...dashed(10600, 10600, 10600, 8000));
  segments.push(seg(-300, 11000, 10300, 11000), tick(0, 11000), tick(10000, 11000), seg(0, 10100, 0, 11200), seg(10000, 10100, 10000, 11200));
  segments.push(seg(-1000, 8000, -1000, 10000), tick(-1000, 8000), tick(-1000, 10000), seg(-1200, 8000, 0, 8000), seg(-1200, 10000, 0, 10000)); // side dimension
  const found = traceOutdoorArea({ segments, label: { text: 'BALCONY', x: 5000, y: 9000 }, building: house });
  assert.ok(!found.failed, found.failed);
  assert.equal(found.type, 'Balcony');
  assert.equal(found.areaM2.toFixed(2), '20.00', 'the slab outline, not the roof line, the dimension line or a decking strip');
}
{ // The house face stands a line weight off the outline: the side along the house goes onto the outline.
  const segments = [...houseLines, seg(0, 8040, 10000, 8040), seg(10000, 8040, 10000, 12000), seg(10000, 12000, 0, 12000), seg(0, 12000, 0, 8040)];
  const found = traceOutdoorArea({ segments, label: { text: 'outdoor terrace', x: 5000, y: 10000 }, building: house });
  assert.ok(!found.failed, found.failed);
  assert.equal(found.type, 'Patio');
  assert.equal(found.depthMm, 4000, 'side along the house put on the building outline');
}
{ // Not read: an outline with an open side, an area away from the house, a label inside the house.
  const open = traceOutdoorArea({ segments: [...houseLines, seg(10000, 8000, 10000, 10000), seg(10000, 10000, 0, 10000)], label: { text: 'Patio', x: 5000, y: 9000 }, building: house });
  assert.ok(open.failed, 'open on one side: not guessed');
  const detached = traceOutdoorArea({ segments: [...houseLines, ...rect(0, 12000, 6000, 15000)], label: { text: 'Patio', x: 3000, y: 13500 }, building: house });
  assert.ok(detached.failed, 'not attached to the house: left to the builder');
  const inside = traceOutdoorArea({ segments: [...houseLines, ...rect(1000, 1000, 4000, 4000)], label: { text: 'Deck', x: 2000, y: 2000 }, building: house });
  assert.ok(inside.failed, 'inside the building outline: not an outdoor area');
  assert.equal(outdoorTypeOf('Alfresco'), 'Alfresco'); assert.equal(outdoorTypeOf('front porch'), 'Porch'); assert.equal(outdoorTypeOf('Courtyard'), 'Patio');
}

// ---- Real plan: Jesmond Road, through the same production analysis the Run uses ----
const root = process.cwd();
const cache = path.join(root, 'artifacts/test-results/takeoff-quick-accuracy-cache');
const refFile = path.join(root, '.claude/worktrees/ai-takeoff-geometry/recovery/plan-references/jesmond-road/reference.json');
if (!fs.existsSync(cache) || !fs.existsSync(refFile)) { console.log('Outdoor areas: synthetic cases passed; SKIPPED the Jesmond plan (local cache/reference not present).'); process.exit(0); }
const require = createRequire(path.join(root, 'package.json')); const { createCanvas, loadImage } = require('@napi-rs/canvas');
const printed = JSON.parse(fs.readFileSync(refFile, 'utf8')).printedAreas;
const results = [];
for (const [page, type, printedM2] of [[5, 'Balcony', printed.lowerBalconyM2], [4, 'Patio', printed.upperTerraceM2]]) {
  const dirName = fs.readdirSync(cache).find((d) => d.startsWith('JESMOND') && d.endsWith('-p' + page));
  if (!dirName) { console.log(`SKIPPED Jesmond sheet ${page}: not cached.`); continue; }
  const dir = path.join(cache, dirName);
  const input = JSON.parse(fs.readFileSync(path.join(dir, 'application-input.json'), 'utf8'));
  const img = await loadImage(fs.readFileSync(path.join(dir, 'application-raster.png')));
  const canvas = createCanvas(img.width, img.height); canvas.getContext('2d').drawImage(img, 0, 0);
  const raster = canvas.getContext('2d').getImageData(0, 0, img.width, img.height); raster.storedPixelsPerMm = input.storedPixelsPerMm;
  const detected = detectVectorWalls(input.vectorSegments, { ...input, raster, textItems: input.textItems || [] }, {});
  const spec = { id: `page-${page}`, name: 'L', page, pixelsPerMm: input.pixelsPerMm, logicalWidth: input.logicalWidth, logicalHeight: input.logicalHeight };
  const measured = vectorProductionAnalysis({ page, level: 'L', walls: [], openings: [], rooms: [], review: [] }, detected, spec,
    { labels: roomLabelsFromText({ ...input, pageNumber: page }), outdoor: { segments: input.vectorSegments, textItems: input.textItems } });
  const ring = (nodes) => Math.abs(nodes.reduce((s, p, i) => { const q = nodes[(i + 1) % nodes.length]; return s + p.x * q.y - q.x * p.y; }, 0)) / 2;
  const toMm2 = (nodes) => ring(nodes.map((p) => ({ x: p.x * input.logicalWidth / input.pixelsPerMm, y: p.y * input.logicalHeight / input.pixelsPerMm }))) / 1e6;
  const outdoor = measured.response.buildingAreas.filter((a) => a.measuredFrom === 'drawn-outline');
  assert.equal(outdoor.length, 1, `sheet ${page}: one outdoor area read (the area table's labels are not areas: ${JSON.stringify(measured.vector.report.footprint.outdoor)})`);
  assert.equal(outdoor[0].type, type);
  const areaM2 = toMm2(outdoor[0].nodes);
  const error = (areaM2 - printedM2) / printedM2;
  assert.ok(Math.abs(error) <= 0.04, `sheet ${page} ${type}: ${areaM2.toFixed(2)} m² within 4% of the printed ${printedM2} m²`);
  const footprint = measured.response.buildingAreas.find((a) => a.type === 'Footprint');
  const overlap = (() => { const fp = footprint.nodes, o = outdoor[0].nodes; const inFp = (p) => { let inside = false; for (let i = 0, j = fp.length - 1; i < fp.length; j = i++) { const a = fp[i], b = fp[j]; if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside; } return inside; };
    const cx = o.reduce((s, p) => s + p.x, 0) / o.length, cy = o.reduce((s, p) => s + p.y, 0) / o.length; return inFp({ x: cx, y: cy }); })();
  assert.equal(overlap, false, 'the outdoor area lies outside the building footprint');
  results.push(`${type} ${areaM2.toFixed(2)} m² vs printed ${printedM2} (${(error * 100).toFixed(1)}%)`);
}
console.log(`Outdoor areas: synthetic cases passed; Jesmond ${results.join(', ')}.`);
