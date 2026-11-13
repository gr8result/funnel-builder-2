// Retaining walls on the real Jesmond Lower sheet (local benchmark cache and hand reference; skips when they
// are not on this machine). The classifier finds the two labelled retaining walls as structures for review.
// A builder who marks them "Retaining wall" gets them measured as their own quantity: length from the drawn
// faces, thickness as drawn, height left to the builder. They never become house external wall, so wall
// lining, insulation and room boundaries are unchanged.
import assert from 'node:assert/strict';
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
import { detectVectorWalls } from '../components/construction-estimation/ai-plan-takeoff/geometry/vectorWalls.js';
import { buildLocalVectorAnalysis } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/localVectorAnalysis.js';
import { createAiScheduleRows } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/scheduleEvidence.js';

const root = process.cwd();
const cache = path.join(root, 'artifacts/test-results/takeoff-quick-accuracy-cache');
const refFile = path.join(root, '.claude/worktrees/ai-takeoff-geometry/recovery/plan-references/jesmond-road/reference.json');
if (!fs.existsSync(cache) || !fs.existsSync(refFile)) { console.log('SKIPPED retaining walls: local plan cache/reference not present.'); process.exit(0); }
const dirName = fs.readdirSync(cache).find((d) => d.startsWith('JESMOND') && d.endsWith('-p5'));
if (!dirName) { console.log('SKIPPED retaining walls: Jesmond lower sheet not cached.'); process.exit(0); }
const require = createRequire(path.join(root, 'package.json')); const { createCanvas, loadImage } = require('@napi-rs/canvas');
const ref = JSON.parse(fs.readFileSync(refFile, 'utf8'));
const dir = path.join(cache, dirName);
const input = JSON.parse(fs.readFileSync(path.join(dir, 'application-input.json'), 'utf8'));
const img = await loadImage(fs.readFileSync(path.join(dir, 'application-raster.png')));
const canvas = createCanvas(img.width, img.height); canvas.getContext('2d').drawImage(img, 0, 0);
const raster = canvas.getContext('2d').getImageData(0, 0, img.width, img.height); raster.storedPixelsPerMm = input.storedPixelsPerMm;
const detected = detectVectorWalls(input.vectorSegments, { ...input, raster, textItems: input.textItems || [] }, {});
const ppm = input.pixelsPerMm, page = input.pageNumber || 5, level = 'Ground Floor';
const context = { jobId: 't', takeoffId: 't', documentHash: 't', pixelsPerMm: ppm, pages: [{ pageNumber: page, logicalWidth: input.logicalWidth, logicalHeight: input.logicalHeight }],
  completedWallRuns: [], placedOpenings: [], completedFloorplans: [], sheetLevels: { [page]: level } };
const run = (wallDecisions = {}) => buildLocalVectorAnalysis({ planPage: { ...input, pageNumber: page }, detected, pixelsPerMm: ppm, level, context, runId: 't', wallDecisions });
const lm = (walls, category) => walls.filter((w) => w.category === category).reduce((sum, w) => sum + w.nodes.slice(1).reduce((s, p, i) => s + Math.hypot(p.x - w.nodes[i].x, p.y - w.nodes[i].y), 0), 0) / ppm / 1000;

const before = run();
const structures = before.vector.reviewWallCandidates.filter((item) => item.element === 'retaining');
assert.equal(structures.length, 2, 'both labelled retaining walls are offered for review');
assert.ok(structures.every((item) => /Retaining wall/.test(item.reason)), 'the review text offers Retaining wall as the answer');
assert.deepEqual(before.vector.retainingWalls, [], 'nothing is measured as retaining before the builder decides');

const decisions = Object.fromEntries(structures.map((item) => [item.detectionKey, 'retaining']));
const after = run(decisions);
assert.equal(after.vector.retainingWalls.length, 2, 'both are measured as retaining walls');
assert.equal(after.vector.reviewWallCandidates.filter((item) => item.element === 'retaining').length, 0, 'and leave the review list');
// House walls and rooms are untouched by the decision.
assert.equal(lm(after.vector.response.walls, 'exterior').toFixed(2), lm(before.vector.response.walls, 'exterior').toFixed(2), 'external wall length unchanged');
assert.equal(lm(after.vector.response.walls, 'interior').toFixed(2), lm(before.vector.response.walls, 'interior').toFixed(2), 'internal wall length unchanged');
assert.equal(after.vector.rooms.length, before.vector.rooms.length, 'rooms unchanged');

// Lengths against the hand reference (both retaining walls traced from the drawing).
const refLengths = ['L-retaining-west', 'L-retaining-north'].map((id) => ref.walls.find((w) => w.id === id)).map((w) => Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y) / ref.pages.find((p) => p.page === 5).pixelsPerMm);
const measured = after.vector.retainingWalls.map((item) => item.lengthMm).sort((a, b) => a - b);
const expected = refLengths.sort((a, b) => a - b);
measured.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) / expected[i] <= 0.03, `retaining wall ${value} mm within 3% of the reference ${Math.round(expected[i])} mm`));
assert.ok(after.vector.retainingWalls.every((item) => item.thicknessMm >= 180 && item.thicknessMm <= 200), '190 series block thickness as drawn');

// Schedule: its own section in lm, height left to the builder, never an external wall row.
const rows = createAiScheduleRows({ retainingWalls: after.vector.retainingWalls.map((item) => ({ ...item, level })) }, [page]).customTakeoffs.filter((row) => row.section === 'Retaining Walls');
assert.equal(rows.length, 2);
assert.ok(rows.every((row) => row.unit === 'lm' && row.quantity > 0 && /Height is not taken from the floor plan/.test(row.notes)), 'length only; height for the builder');
console.log(`Retaining walls (Jesmond Lower): ${measured.map((v, i) => `${(v / 1000).toFixed(2)} m vs ${(expected[i] / 1000).toFixed(2)} m`).join(', ')}; house walls and rooms unchanged.`);
