// Real-plan regression for the frame, pier and classification rules, on the locally cached Jesmond
// sheets (confidential: read from the local benchmark cache and reference, never committed). Skips when
// they are not on this machine. Positions come from the hand reference by id, not from the rules.
import assert from 'node:assert/strict';
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
import { detectVectorWalls } from '../components/construction-estimation/ai-plan-takeoff/geometry/vectorWalls.js';

const root = process.cwd();
const cache = path.join(root, 'artifacts/test-results/takeoff-quick-accuracy-cache');
const refFile = path.join(root, '.claude/worktrees/ai-takeoff-geometry/recovery/plan-references/jesmond-road/reference.json');
if (!fs.existsSync(cache) || !fs.existsSync(refFile)) { console.log('SKIPPED Jesmond classification regression: local plan cache/reference not present.'); process.exit(0); }
const require = createRequire(path.join(root, 'package.json')); const { createCanvas, loadImage } = require('@napi-rs/canvas');
const ref = JSON.parse(fs.readFileSync(refFile, 'utf8'));
async function sheet(page) {
  const dirName = fs.readdirSync(cache).find((d) => d.startsWith('JESMOND') && d.endsWith('-p' + page));
  if (!dirName) return null;
  const dir = path.join(cache, dirName);
  const input = JSON.parse(fs.readFileSync(path.join(dir, 'application-input.json'), 'utf8'));
  const img = await loadImage(fs.readFileSync(path.join(dir, 'application-raster.png')));
  const canvas = createCanvas(img.width, img.height); canvas.getContext('2d').drawImage(img, 0, 0);
  const raster = canvas.getContext('2d').getImageData(0, 0, img.width, img.height); raster.storedPixelsPerMm = input.storedPixelsPerMm;
  return { input, raster, found: detectVectorWalls(input.vectorSegments, { ...input, raster, textItems: input.textItems || [] }, {}) };
}
const at = (id) => ref.openings.find((o) => o.id === id);
const within = (input, o, point, mm) => Math.hypot(o.x - point.x, o.y - point.y) <= mm * input.pixelsPerMm;

const lower = await sheet(5);
if (!lower) { console.log('SKIPPED: lower sheet not cached.'); process.exit(0); }
{
  const { input, found } = lower;
  const gsd = found.openings.filter((o) => within(input, o, at('L-laundry-gsd'), 400) && Math.abs(o.widthMm - 1800) <= 60);
  assert.equal(gsd.length, 1, '2118 GSD: one frame unit about 1800 wide');
  assert.equal(gsd[0].needsClassification, true, 'held for the builder: window or sliding door');
  assert.equal(gsd[0].measurements?.frameWidthMm, gsd[0].widthMm);
  const sgd = found.openings.filter((o) => within(input, o, at('L-bed2-sgd'), 500) && Math.abs(o.widthMm - 2400) <= 60);
  assert.equal(sgd.length, 1, '2124 SGD: one capped frame about 2400 wide'); assert.equal(sgd[0].needsClassification, true);
  const store = found.openings.filter((o) => within(input, o, at('L-store-external'), 400));
  const storeDoors = store.filter((o) => o.kind === 'door' && !o.bridgeOnly);
  assert.equal(storeDoors.length, 1, 'the store\'s external door is read once');
  assert.ok(Math.abs(storeDoors[0].measurements.leafWidthMm - 820) <= 15, 'its leaf is the drawn leaf');
  assert.ok(storeDoors[0].measurements.roughOpeningMm > storeDoors[0].measurements.leafWidthMm, 'the wall gap is recorded as the rough opening, not as the leaf');
  assert.ok(!store.some((o) => o.kind === 'opening' && !o.bridgeOnly), 'no second, wider reading of the same doorway');
  assert.ok((found.classification || []).filter((r) => r.element === 'annotation').length >= 5, 'the schedule rows outside the plan are notation');
  const retaining = (found.structures || []).filter((s) => s.element === 'retaining');
  assert.ok(retaining.length >= 1 && retaining.every((s) => /retaining/i.test(s.label)), 'the labelled retaining wall is reported as a structure for review');
  assert.ok(!found.walls.some((w) => w.classification?.element === 'joinery'), 'no wall removed as cabinetry (evidence-only by default)');
}
{
  // Drawing evidence: the 0315 FG OBS frame is x=422.41..464.85, projecting south
  // from y=936.41. Its 144 mm host break contains the ensuite partition junction.
  const { input, raster, found } = lower;
  const atFrame = o => Math.abs(o.x - 443.63) < 2 && Math.abs(o.y - 937.97) < 2;
  const frames = found.openings.filter(atFrame);
  assert.equal(frames.length, 1, '0315 frame is read once');
  assert.equal(frames[0].frameUnit, true);
  assert.equal(frames[0].kind, 'window');
  assert.ok(Math.abs(frames[0].widthMm - 1500) < 20, 'frame width comes from the drawn caps');
  assert.equal(frames[0].needsClassification, true, 'without its printed label, the frame still needs builder classification');
  assert.ok(!found.walls.some(w => w.nodes.every(p => p.x >= 422 && p.x <= 465 && p.y >= 936 && p.y <= 945)), 'frame/glass lines are not a wall');
  assert.ok(!found.openings.some(o => Math.abs(o.x - 489.01) < 2 && Math.abs(o.y - 938.51) < 2), 'adjacent hatched wall is not a false 1705 window');
  const rerunWithout = predicate => detectVectorWalls(input.vectorSegments.filter(s => !predicate(s)), { ...input, raster }, {});
  const vertical = s => Math.abs(s.x1 - s.x2) < .02;
  const missingCaps = rerunWithout(s => vertical(s) && [422.41, 464.85].some(x => Math.abs(s.x1 - x) < .02)
    && Math.min(s.y1, s.y2) >= 936 && Math.max(s.y1, s.y2) <= 945);
  assert.ok(!missingCaps.openings.some(o => atFrame(o) && o.frameUnit), 'no projected frame inferred without its drawn end caps');
  const missingJunction = rerunWithout(s => vertical(s) && ((s.x1 >= 418 && s.x1 <= 422) || (s.x1 >= 465 && s.x1 <= 469))
    && Math.max(s.y1, s.y2) <= 936.5 && Math.max(s.y1, s.y2) >= 936);
  assert.ok(!missingJunction.openings.some(o => atFrame(o) && o.frameUnit), 'nearby wall alone is insufficient without the partition junction');
}
const upper = await sheet(4);
if (upper) {
  const { input, found } = upper;
  const bank = found.openings.filter((o) => within(input, o, { x: 607.59 * 1, y: 631 }, 700) && o.widthMm >= 3000);
  assert.equal(bank.length, 1, 'the unlabelled 4-panel east window bank stays one held unit');
  assert.equal(bank[0].needsClassification, true);
  assert.equal(found.walls.filter((w) => w.quantityReview && /pier/i.test(w.quantityReview)).length >= 2, true, 'pier edges paired with passing lines are held, not quantified');
}
console.log('Jesmond classification regression: GSD/SGD frame units, store door leaf vs rough opening, notation rows, retaining structure, upstairs window bank and pier rims passed.');
