// Plan model on a real plan: an estimator's corrections survive the next analysis.
//
// Reads a saved engine reading of a real sheet (page-<n>-engine-geometry.json written by
// scripts/plan-accuracy.mjs) and the reference traced from that sheet. Builds the plan model from
// the engine reading, then acts as an estimator would: deletes read "walls" that are not walls on
// the plan (joinery, frames, downpipes) and draws the walls the reading missed. The sheet is then
// analysed again from the same reading, and nothing the estimator did may be undone: no deleted
// wall comes back, no drawn wall is lost or doubled, and the rooms stay as corrected.
// Local files only; skipped when they are not on this machine.
//   node scripts/test-plan-model-real-plan.mjs --reference <reference.json> --geometry <page-1-engine-geometry.json> [--bridge-unconfirmed-mm 5600]
//   (or GR8_PLAN_REFERENCE / GR8_PLAN_ENGINE_GEOMETRY)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { levelFromLinework } from '../components/construction-estimation/ai-plan-takeoff/geometry/planModelAdapter.js';
import { computeRooms, deleteWall, describeLevel, drawWall, wallCategories, wallPoints } from '../components/construction-estimation/ai-plan-takeoff/geometry/planModel.js';
import { compareRooms, compareWalls } from '../components/construction-estimation/ai-plan-takeoff/geometry/planAccuracy.js';

const args = Object.fromEntries(process.argv.slice(2).map((arg, index, all) => (arg.startsWith('--') ? [arg.slice(2), all[index + 1]] : null)).filter(Boolean));
// Plan references stay outside the repository (git-ignored recovery/ folder); point at them here.
const referencePath = args.reference || process.env.GR8_PLAN_REFERENCE;
const geometryPath = args.geometry || process.env.GR8_PLAN_ENGINE_GEOMETRY;
if (!referencePath || !geometryPath || !fs.existsSync(referencePath) || !fs.existsSync(geometryPath)) { console.log('real-plan reference or saved engine reading not given or not on this machine; test skipped'); process.exit(0); }
const reference = JSON.parse(fs.readFileSync(referencePath, 'utf8'));
const geometry = JSON.parse(fs.readFileSync(geometryPath, 'utf8'));
const pageSpec = reference.pages[0];
const ppm = pageSpec.pixelsPerMm;
const mm = (p) => ({ x: p.x / ppm, y: p.y / ppm });
const refWalls = reference.walls.filter((wall) => wall.page === pageSpec.page).map((wall) => ({ ...wall, a: mm(wall.a), b: mm(wall.b) }));
const refRooms = reference.rooms.filter((room) => room.page === pageSpec.page).map((room) => ({ ...room, polygon: room.polygon.map(mm) }));
const spec = { id: 'ground', name: pageSpec.level, page: pageSpec.page, pixelsPerMm: ppm };
const bridge = Number(args['bridge-unconfirmed-mm'] ?? 5600);

const modelWalls = (level) => { const categories = wallCategories(level); return Object.values(level.walls).map((wall) => ({ id: wall.id, points: wallPoints(level, wall), thicknessMm: wall.thicknessMm, category: categories[wall.id] })); };
const rooms = (level) => computeRooms(level).map((room) => ({ id: room.id, polygon: room.floor }));
const summary = (level) => { const w = compareWalls(refWalls, modelWalls(level)); const r = compareRooms(refRooms, rooms(level)); return { recall: w.recall, precision: w.precision, roomsMatched: r.matched, iouMedian: r.iouMedian, missed: w.missed, rows: r.rows }; };

// 1. The reading as the engine gives it.
let level = levelFromLinework(geometry, spec, { bridgeUnconfirmedMaxMm: bridge }).level;
const before = summary(level);

// 2. The estimator deletes what is not a wall: a read wall with under a fifth of its length on a plan wall.
const deleted = [];
for (const wall of modelWalls(level)) {
  const support = compareWalls([{ id: wall.id, a: wall.points[0], b: wall.points[wall.points.length - 1], thicknessMm: wall.thicknessMm }], refWalls).recall;
  if (support < 0.2) { deleted.push({ id: wall.id, key: level.walls[wall.id].detectionKey }); level = deleteWall(level, wall.id); }
}
// 3. ... and draws each wall stretch the reading missed (as long as a door or more).
const drawn = [];
for (const run of compareWalls(refWalls, modelWalls(level)).missed.filter((item) => item.lengthMm >= 300)) {
  const wall = refWalls.find((item) => item.id === run.wallId);
  const dir = { x: (run.b.x - run.a.x) / run.lengthMm, y: (run.b.y - run.a.y) / run.lengthMm };
  const result = drawWall(level, { a: { x: run.a.x - dir.x * 60, y: run.a.y - dir.y * 60 }, b: { x: run.b.x + dir.x * 60, y: run.b.y + dir.y * 60 }, thicknessMm: wall.thicknessMm });
  level = result.level;
  drawn.push(...result.wallIds);
}
const corrected = summary(level);
const correctedWalls = JSON.stringify(level.walls);

// 4. The sheet is analysed again from the same reading.
const rerun = levelFromLinework(geometry, spec, { level, bridgeUnconfirmedMaxMm: bridge });
const after = summary(rerun.level);

const fmt = (s) => `wall recall ${(100 * s.recall).toFixed(1)}%, precision ${(100 * s.precision).toFixed(1)}%, rooms matched ${s.roomsMatched}/${refRooms.length}, median room overlap ${s.iouMedian.toFixed(3)}`;
console.log(`  engine reading:         ${fmt(before)}`);
console.log(`  after corrections:      ${fmt(corrected)}  (${deleted.length} non-walls deleted, ${drawn.length} walls drawn)`);
console.log(`  after re-analysis:      ${fmt(after)}  (rejected again: ${rerun.report.wallsRejectedBefore}, already present: ${rerun.report.wallsAlreadyPresent}, added: ${rerun.report.wallsAdded})`);
console.log(`  rooms after corrections: ${corrected.rows.map((row) => `${row.name} ${row.iou.toFixed(2)}`).join('; ')}`);

assert.ok(corrected.precision > before.precision, 'deleting non-walls raises precision');
assert.ok(corrected.recall > before.recall, 'drawing missed walls raises recall');
assert.ok(corrected.roomsMatched >= before.roomsMatched, 'corrections do not lose rooms');
for (const item of deleted) assert.ok(!Object.values(rerun.level.walls).some((wall) => wall.detectionKey === item.key), `deleted wall ${item.id} does not come back`);
for (const id of drawn) assert.ok(rerun.level.walls[id] && rerun.level.walls[id].source === 'manual', `drawn wall ${id} survives re-analysis`);
assert.equal(rerun.report.wallsAdded, 0, 're-analysis of the same reading adds nothing');
assert.equal(JSON.stringify(rerun.level.walls), correctedWalls, 'walls are exactly as the estimator left them');
assert.deepEqual(after.rows.map((row) => row.iou), corrected.rows.map((row) => row.iou), 'rooms are exactly as corrected');
console.log(`  model after corrections: ${JSON.stringify(describeLevel(rerun.level))}`);
console.log('plan model real plan: corrections survive re-analysis');
