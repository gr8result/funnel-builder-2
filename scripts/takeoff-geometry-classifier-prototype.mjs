// Isolated prototype (not wired into the app): can a small locally trained model tell a detected wall
// pair that is really a wall from one that is joinery or another drawn element, from the PDF linework
// around it? Features are computed from the raw vector segments; labels come from the hand references
// (a detected pair mostly on a reference wall is a wall, mostly off every reference wall is not).
// Model: L2-regularised logistic regression, plain JS, no dependencies, trained here in milliseconds.
// Scored leave-one-sheet-out: trained on two sheets, tested on the third.
//   node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs \
//     scripts/takeoff-geometry-classifier-prototype.mjs [--json out.json]
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
import { detectVectorWalls } from '../components/construction-estimation/ai-plan-takeoff/geometry/vectorWalls.js';

const root = process.cwd();
const require = createRequire(path.join(root, 'package.json'));
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const args = process.argv.slice(2);
const cache = path.join(root, 'artifacts/test-results/takeoff-quick-accuracy-cache');
const jesRefFile = path.join(root, '.claude/worktrees/ai-takeoff-geometry/recovery/plan-references/jesmond-road/reference.json');
const libDir = path.join(root, 'artifacts/test-results/vector-regression-2026-10-18/frozen');
const sheets = [];
if (fs.existsSync(path.join(libDir, 'application-input.json'))) sheets.push({ name: 'Liberty', dir: libDir, ref: JSON.parse(fs.readFileSync(path.join(libDir, 'reference.json'), 'utf8')), page: null });
if (fs.existsSync(cache) && fs.existsSync(jesRefFile)) for (const [name, page] of [['Jesmond Lower', 5], ['Jesmond Upper', 4]]) {
  const d = fs.readdirSync(cache).find((x) => x.startsWith('JESMOND') && x.endsWith('-p' + page));
  if (d) sheets.push({ name, dir: path.join(cache, d), ref: JSON.parse(fs.readFileSync(jesRefFile, 'utf8')), page });
}
if (sheets.length < 3) { console.log('SKIPPED: the three local benchmark sheets are not present.'); process.exit(0); }

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y }), dot = (a, b) => a.x * b.x + a.y * b.y, len = (a) => Math.hypot(a.x, a.y);
function segDistance(p, a, b) { const d = sub(b, a), l2 = dot(d, d), t = l2 ? Math.max(0, Math.min(1, dot(sub(p, a), d) / l2)) : 0; return len(sub(p, { x: a.x + t * d.x, y: a.y + t * d.y })); }

// Features of one detected pair, in mm, from the segments near it.
function features(wall, segments, walls, mmPx) {
  const [a, b] = wall.nodes, d = sub(b, a), L = len(d), u = { x: d.x / L, y: d.y / L }, n = { x: -u.y, y: u.x };
  const lengthMm = L / mmPx, t = wall.measuredThicknessMm || 90;
  const local = (p) => ({ s: dot(sub(p, a), u) / mmPx, c: dot(sub(p, a), n) / mmPx });
  const near = [];
  for (const seg of segments) {
    const p = local({ x: seg.x1, y: seg.y1 }), q = local({ x: seg.x2, y: seg.y2 });
    if (Math.max(p.s, q.s) < -900 || Math.min(p.s, q.s) > lengthMm + 900 || Math.min(Math.abs(p.c), Math.abs(q.c)) > 1200) continue;
    const segLen = Math.hypot(q.s - p.s, q.c - p.c); if (segLen < 1) continue;
    const parallel = Math.abs(q.c - p.c) / segLen < 0.05, perpendicular = Math.abs(q.s - p.s) / segLen < 0.05;
    near.push({ p, q, seg, segLen, parallel, perpendicular });
  }
  // Faces: parallel strokes on each face line.
  const faceStrokes = (side) => near.filter((x) => x.parallel && Math.abs((x.p.c + x.q.c) / 2 - side * t / 2) <= Math.max(12, t * 0.2));
  const faces = [faceStrokes(-1), faceStrokes(1)];
  const cover = (strokes) => { const iv = strokes.map((x) => [Math.max(0, Math.min(x.p.s, x.q.s)), Math.min(lengthMm, Math.max(x.p.s, x.q.s))]).filter(([lo, hi]) => hi > lo).sort((x, y) => x[0] - y[0]); let sum = 0, end = -1; for (const [lo, hi] of iv) { if (hi <= end) continue; sum += hi - Math.max(lo, end); end = hi; } return lengthMm ? sum / lengthMm : 0; };
  const penOf = (strokes) => { const w = new Map(); for (const x of strokes) w.set(x.seg.widthPx || 0, (w.get(x.seg.widthPx || 0) || 0) + x.segLen); return [...w].sort((p, q) => q[1] - p[1])[0]?.[0] || 0; };
  const pens = faces.map(penOf), paths = faces.map((f) => new Set(f.map((x) => x.seg.path)));
  const samePath = [...paths[0]].some((p) => paths[1].has(p)) ? 1 : 0;
  const singleStrokeFaces = faces.every((f) => f.filter((x) => x.segLen / mmPx >= 0.8 * lengthMm).length >= 1) ? 1 : 0;
  // Carcass sides: perpendicular strokes starting on one face and running 250-900 mm away from it.
  const stubs = (side) => near.filter((x) => x.perpendicular && x.p.s > 30 && x.p.s < lengthMm - 30).filter((x) => {
    const lo = Math.min(x.p.c * side, x.q.c * side), hi = Math.max(x.p.c * side, x.q.c * side);
    return Math.abs(lo - t / 2) <= 40 && hi - lo >= 250 && hi - lo <= 900;
  }).length;
  const stubsPerM = Math.max(stubs(-1), stubs(1)) / Math.max(1, lengthMm / 1000);
  // Cabinet front: a parallel line 300-800 mm off one face covering much of the pair.
  const frontCover = Math.max(...[-1, 1].map((side) => cover(near.filter((x) => x.parallel && side * (x.p.c + x.q.c) / 2 - t / 2 >= 300 && side * (x.p.c + x.q.c) / 2 - t / 2 <= 800))));
  // Inner lines between the faces (hatch, insulation, joinery divisions).
  const inner = near.filter((x) => Math.abs((x.p.c + x.q.c) / 2) < t / 2 - 8 && Math.min(x.p.s, x.q.s) >= 0 && Math.max(x.p.s, x.q.s) <= lengthMm).length / Math.max(1, lengthMm / 1000);
  // Ends meeting other detected pairs.
  const endJoins = [a, b].filter((e) => walls.some((w) => w !== wall && segDistance(e, w.nodes[0], w.nodes[1]) <= 120 * mmPx)).length;
  return { lengthM: lengthMm / 1000, thicknessMm: t, minPen: Math.min(...pens), maxPen: Math.max(...pens), samePath, singleStrokeFaces, faceCover: Math.min(cover(faces[0]), cover(faces[1])),
    stubsPerM, frontCover, innerPerM: inner, endJoins };
}
const FEATURES = ['lengthM', 'thicknessMm', 'minPen', 'maxPen', 'samePath', 'singleStrokeFaces', 'faceCover', 'stubsPerM', 'frontCover', 'innerPerM', 'endJoins'];

// Reference label: share of the pair's centreline within reach of a parallel reference wall.
function support(wall, refWalls, mmPx, refScale) {
  const [a, b] = wall.nodes, d = sub(b, a), L = len(d), u = { x: d.x / L, y: d.y / L };
  const steps = Math.max(2, Math.round(L / mmPx / 100)); let hit = 0;
  for (let i = 0; i <= steps; i++) {
    const p = { x: a.x + d.x * i / steps, y: a.y + d.y * i / steps };
    if (refWalls.some((r) => { const ra = { x: r.a.x * refScale, y: r.a.y * refScale }, rb = { x: r.b.x * refScale, y: r.b.y * refScale }, rd = sub(rb, ra), rl = len(rd);
      return rl > 0 && Math.abs(dot(u, { x: rd.x / rl, y: rd.y / rl })) > 0.97 && segDistance(p, ra, rb) <= Math.max(150, wall.measuredThicknessMm || 90) * mmPx; })) hit++;
  }
  return hit / (steps + 1);
}

const rows = [];
for (const sheet of sheets) {
  const input = JSON.parse(fs.readFileSync(path.join(sheet.dir, 'application-input.json'), 'utf8'));
  const img = await loadImage(fs.readFileSync(path.join(sheet.dir, 'application-raster.png')));
  const canvas = createCanvas(img.width, img.height); canvas.getContext('2d').drawImage(img, 0, 0);
  const raster = canvas.getContext('2d').getImageData(0, 0, img.width, img.height); raster.storedPixelsPerMm = input.storedPixelsPerMm;
  const found = detectVectorWalls(input.vectorSegments, { ...input, raster, textItems: input.textItems || [] }, {});
  const pageSpec = sheet.page ? sheet.ref.pages.find((p) => p.page === sheet.page) : null;
  const refScale = pageSpec ? input.pixelsPerMm / pageSpec.pixelsPerMm : 1;
  const refWalls = sheet.ref.walls.filter((w) => !sheet.page || w.page === sheet.page);
  const strokes = input.vectorSegments.filter((s) => s.paint === 'stroke');
  for (const wall of found.walls) {
    const share = support(wall, refWalls, input.pixelsPerMm, refScale);
    const label = share >= 0.7 ? 1 : share <= 0.3 ? 0 : null;
    rows.push({ sheet: sheet.name, id: wall.id, label, share: Math.round(share * 100) / 100, lengthMm: Math.round(wall.lengthMm || 0), f: features(wall, strokes, found.walls, input.pixelsPerMm) });
  }
}
const labelled = rows.filter((r) => r.label !== null);
console.log('Detected pairs:', rows.length, '| labelled wall:', labelled.filter((r) => r.label === 1).length, '| labelled not-a-wall:', labelled.filter((r) => r.label === 0).length, '| ambiguous:', rows.length - labelled.length);
for (const s of sheets) console.log(`  ${s.name}: not-a-wall pairs ${labelled.filter((r) => r.sheet === s.name && r.label === 0).map((r) => `${r.id} ${r.lengthMm}mm t${Math.round(r.f.thicknessMm)}`).join(', ') || 'none'}`);

function train(data, { lambda = 1, epochs = 3000, lr = 0.1 } = {}) {
  const mean = FEATURES.map((k) => data.reduce((s, r) => s + r.f[k], 0) / data.length);
  const sd = FEATURES.map((k, i) => Math.sqrt(data.reduce((s, r) => s + (r.f[k] - mean[i]) ** 2, 0) / data.length) || 1);
  const x = (r) => FEATURES.map((k, i) => (r.f[k] - mean[i]) / sd[i]);
  // Class weights: false walls are rare; each class carries equal total weight.
  const pos = data.filter((r) => r.label === 1).length, neg = data.length - pos;
  const weight = (r) => (r.label === 1 ? data.length / (2 * pos) : data.length / (2 * Math.max(1, neg)));
  let w = FEATURES.map(() => 0), bias = 0;
  for (let e = 0; e < epochs; e++) {
    const g = w.map(() => 0); let gb = 0;
    for (const r of data) { const xi = x(r), p = 1 / (1 + Math.exp(-(bias + xi.reduce((s, v, i) => s + v * w[i], 0)))), err = (p - r.label) * weight(r); xi.forEach((v, i) => { g[i] += err * v; }); gb += err; }
    w = w.map((wi, i) => wi - lr * (g[i] / data.length + lambda * wi / data.length)); bias -= lr * gb / data.length;
  }
  return { predict: (r) => 1 / (1 + Math.exp(-(bias + x(r).reduce((s, v, i) => s + v * w[i], 0)))), weights: Object.fromEntries(FEATURES.map((k, i) => [k, Math.round(w[i] * 100) / 100])) };
}

const results = [];
for (const test of sheets.map((s) => s.name)) {
  const trainSet = labelled.filter((r) => r.sheet !== test), testSet = rows.filter((r) => r.sheet === test);
  const model = train(trainSet);
  // A pair is flagged "not a wall" only below 0.2 wall probability (the cost of removing a real wall is high).
  const scored = testSet.map((r) => ({ ...r, pWall: Math.round(model.predict(r) * 100) / 100 }));
  const flagged = scored.filter((r) => r.pWall < 0.2);
  const tp = flagged.filter((r) => r.label === 0), fp = flagged.filter((r) => r.label === 1);
  const negatives = scored.filter((r) => r.label === 0);
  const kitchen = test === 'Jesmond Upper' ? scored.filter((r) => r.label === 0 && r.lengthMm >= 3500 && r.lengthMm <= 3800) : [];
  results.push({ test, trainNegatives: trainSet.filter((r) => r.label === 0).length, weights: model.weights,
    falseWallsCaught: `${tp.length}/${negatives.length}`, falseWallLengthCaughtM: (tp.reduce((s, r) => s + r.lengthMm, 0) / 1000).toFixed(1), falseWallLengthM: (negatives.reduce((s, r) => s + r.lengthMm, 0) / 1000).toFixed(1),
    trueWallsFlagged: fp.length, trueWallLengthFlaggedM: (fp.reduce((s, r) => s + r.lengthMm, 0) / 1000).toFixed(1),
    negativesScored: negatives.map((r) => `${r.id}:${r.lengthMm}mm p=${r.pWall}`), kitchenRun: kitchen.map((r) => ({ id: r.id, lengthMm: r.lengthMm, pWall: r.pWall, features: r.f })) });
  console.log(`\nTest ${test} (trained on the other two; ${trainSet.filter((r) => r.label === 0).length} not-a-wall examples to learn from)`);
  console.log(`  false walls caught ${tp.length}/${negatives.length} (${results.at(-1).falseWallLengthCaughtM} of ${results.at(-1).falseWallLengthM} m); true walls wrongly flagged ${fp.length} (${results.at(-1).trueWallLengthFlaggedM} m)`);
  console.log('  not-a-wall pairs scored:', results.at(-1).negativesScored.join(', ') || 'none');
  if (kitchen.length) console.log('  kitchen run:', JSON.stringify(results.at(-1).kitchenRun.map((k) => ({ id: k.id, pWall: k.pWall, stubsPerM: Math.round(k.features.stubsPerM * 10) / 10, frontCover: Math.round(k.features.frontCover * 100) / 100, pens: [k.features.minPen, k.features.maxPen], samePath: k.features.samePath }))));
  console.log('  weights:', JSON.stringify(model.weights));
}
const idx = args.indexOf('--json'); if (idx >= 0) fs.writeFileSync(args[idx + 1], JSON.stringify({ features: FEATURES, rows, results }, null, 2));
