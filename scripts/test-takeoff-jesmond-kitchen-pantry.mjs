// Real-plan regression (Jesmond Upper, locally cached sheet; skips when absent), production path:
//  - the frame drawn along the internal wall behind the kitchen joinery is not a counted window; it is
//    listed for the builder (it was a false 2584 mm "window");
//  - the kitchen-to-pantry open threshold (wall stops with no jamb) is listed as an opening to
//    confirm, measured from the wall end to the facing wall, and the pantry stays its own room.
// Run: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-takeoff-jesmond-kitchen-pantry.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module'; import { fileURLToPath } from 'node:url';
import { detectVectorWalls } from '../components/construction-estimation/ai-plan-takeoff/geometry/vectorWalls.js';
import { buildLocalVectorAnalysis } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/localVectorAnalysis.js';
import { convertAiTakeoffDetections } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/adapter.js';

const require = createRequire(import.meta.url); const { createCanvas, loadImage } = require('@napi-rs/canvas');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cache = path.join(root, 'artifacts/test-results/takeoff-quick-accuracy-cache');
const dirName = fs.existsSync(cache) && fs.readdirSync(cache).find((name) => name.startsWith('JESMOND') && name.endsWith('-p4'));
if (!dirName) { console.log('SKIPPED Jesmond kitchen/pantry regression: local plan cache not present.'); process.exit(0); }
const dir = path.join(cache, dirName);
const input = JSON.parse(fs.readFileSync(path.join(dir, 'application-input.json'), 'utf8'));
const img = await loadImage(fs.readFileSync(path.join(dir, 'application-raster.png')));
const canvas = createCanvas(img.width, img.height); canvas.getContext('2d').drawImage(img, 0, 0);
const raster = canvas.getContext('2d').getImageData(0, 0, img.width, img.height); raster.storedPixelsPerMm = input.storedPixelsPerMm;
const detected = detectVectorWalls(input.vectorSegments, { ...input, raster, textItems: input.textItems || [] }, {});
const ppm = input.pixelsPerMm, pageNumber = input.pageNumber, level = 'Upper Floor';
const context = { jobId: 'kp', takeoffId: 'kp', documentHash: 'kp', pixelsPerMm: ppm, pages: [{ pageNumber, logicalWidth: input.logicalWidth, logicalHeight: input.logicalHeight }],
  completedWallRuns: [], placedOpenings: [], completedFloorplans: [], sheetLevels: { [pageNumber]: level } };
const prepared = buildLocalVectorAnalysis({ planPage: input, detected, pixelsPerMm: ppm, level, context, runId: 'kp', semanticInput: { page: pageNumber, level, walls: [], openings: [], rooms: [], review: [] } });
const canonical = convertAiTakeoffDetections(prepared.batch, context);
const review = prepared.vector.reviewOpeningCandidates;
const near = (item, x, y, reach) => Math.hypot(item.x - x, item.y - y) <= reach; // logical pt

// The frame the detector reads along the kitchen joinery wall (logical 569.9, 722.5).
const frame = detected.openings.find((item) => item.evidence === 'window frame drawn along the wall' && near(item, 569.9, 722.5, 6));
assert.ok(frame, 'the detector still measures the frame (evidence kept, not discarded)');
const placedAtFrame = canonical.placedOpenings.filter((item) => near(item, 569.9, 722.5, 12)); // placed openings are in logical pt
assert.equal(placedAtFrame.length, 0, 'no window is counted for the frame on the internal kitchen wall');
const frameReview = review.find((item) => item.modelKind === 'window-frame-internal' && near({ x: item.nodes[0].x, y: item.nodes[0].y }, 569.9, 722.5, 6));
assert.ok(frameReview, 'the frame is listed for the builder');
assert.equal(frameReview.hostCategory, 'interior');

// The kitchen-to-pantry open threshold: from the wall end (606.6, 828) across to the south wall (898).
const threshold = review.find((item) => item.modelKind === 'open-threshold' && near({ x: item.nodes[0].x, y: item.nodes[0].y }, 606.6, 863, 15));
assert.ok(threshold, 'the kitchen-to-pantry open threshold is listed as an opening to confirm');
assert.ok(threshold.widthMm > 2300 && threshold.widthMm < 2600, `measured wall end to facing wall: ${threshold.widthMm} mm`);
assert.match(threshold.evidence || '', /pantry/, 'it is the threshold separating the pantry');
assert.ok(prepared.rooms.some((room) => /pantry/i.test(room.name || '')), 'the pantry remains its own room');

// Windows elsewhere on the sheet are still counted: the east-wall window box.
const eastWindows = canonical.placedOpenings.filter((item) => item.type === 'window' && Math.abs(item.x - 607.6) < 4 && item.y > 580 && item.y < 680);
// Without the printed-label (OCR) stage the four panes are one box whose panel count the builder confirms.
assert.equal(eastWindows.length, 1, 'the east-wall window box is still counted');
assert.ok(eastWindows[0].widthMm > 3400 && eastWindows[0].widthMm < 3800 && eastWindows[0].needsClassification, `east box ${eastWindows[0].widthMm} mm, panel count to confirm`);

console.log(`PASS Jesmond kitchen/pantry: frame on internal wall listed not counted (${frameReview.widthMm} mm); open threshold ${threshold.widthMm} mm listed; pantry room kept; east window box counted`);
