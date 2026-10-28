import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extractPdfLinework } from '../components/construction-estimation/ai-plan-takeoff/geometry/pdfLinework.js';
import { levelFromLinework } from '../components/construction-estimation/ai-plan-takeoff/geometry/planModelAdapter.js';
import { computeRooms, openingPosition, wallCategories, wallPoints } from '../components/construction-estimation/ai-plan-takeoff/geometry/planModel.js';
import { ACCURACY_DEFAULTS, canonicalPlanReading, compareWalls, compareJunctions, compareOpenings, compareRooms, referenceJunctions } from '../components/construction-estimation/ai-plan-takeoff/geometry/planAccuracy.js';
import { buildLocalVectorAnalysis } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/localVectorAnalysis.js';
import { convertAiTakeoffDetections } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/adapter.js';
import { detectVectorWalls } from '../components/construction-estimation/ai-plan-takeoff/geometry/vectorWalls.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.resolve(process.argv[2] || path.join(root, 'artifacts/test-results/vector-regression-2026-10-18'));
const frozen = path.join(directory, 'frozen');
const read = filename => fs.readFileSync(path.join(frozen, filename), 'utf8');
const reference = JSON.parse(read('reference.json'));
const input = JSON.parse(read('application-input.json'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const originalReference = path.join(root, 'recovery/plan-references/liberty-terrace/reference.json');
assert.equal(hash(fs.readFileSync(originalReference)), hash(read('reference.json')), 'Independent reference must remain frozen');
assert.equal(reference.pages.length, 1, 'This experiment targets the frozen Liberty page');
const pageSpec = reference.pages[0];
const referencePpm = pageSpec.pixelsPerMm;
function referenceAtScale(pixelsPerMm) {
  const referencePoint = point => ({ x: point.x / pixelsPerMm, y: point.y / pixelsPerMm });
  return {
  walls: reference.walls.map(wall => ({ ...wall, a: referencePoint(wall.a), b: referencePoint(wall.b) })),
  openings: reference.openings.map(opening => ({ ...opening, ...referencePoint(opening) })),
  rooms: reference.rooms.map(room => ({ ...room, polygon: room.polygon.map(referencePoint) })),
  };
}
const baselineSource = read('vectorWalls-baseline.mjs').replaceAll('\r\n', '\n');
const currentSource = read('vectorWalls-current.mjs').replaceAll('\r\n', '\n');
const crossingBlock = source => source.slice(source.indexOf('  const crossingIn ='), source.indexOf('  const byLine ='));
const switches = [
  { name: 'crossing', old: crossingBlock(baselineSource), next: crossingBlock(currentSource) },
  { name: 'overlap', old: 'gapMm <= options.continueGapMm && crossingIn(current, current.hi, next.lo)', next: 'gapMm <= 0 || (gapMm <= options.continueGapMm && crossingIn(current, current.hi, next.lo))' },
  { name: 'dash', old: 'const curves = (segments || []).filter((s) => onPage(s)', next: 'const curves = (segments || []).filter((s) => !s.dashed && onPage(s)' },
];
const variants = [];
for (let mask = 0; mask < 8; mask += 1) {
  let source = baselineSource;
  switches.forEach((change, index) => {
    assert.ok(source.includes(change.old), `Unique switch anchor: ${change.name}`);
    if (mask & (1 << index)) source = source.replace(change.old, change.next);
  });
  if (mask === 7) assert.equal(source, currentSource, 'The three switches must exactly reconstruct the regressed detector');
  const name = mask ? switches.filter((change, index) => mask & (1 << index)).map(change => change.name).join('+') : 'baseline';
  const instrumented = source.replace('  const byLine = [];', `  if (context.continuityTrace) context.continuityTrace.pool = pool.map(candidate => ({ ...endpoints(candidate), thicknessMm: candidate.thicknessMm, angle: candidate.angle }));\n  const byLine = [];`)
    .replace('      const gapMm = (next.lo - current.hi) / mmPx;', `      const gapMm = (next.lo - current.hi) / mmPx;\n      if (context.continuityTrace && gapMm > 0 && gapMm <= options.continueGapMm) context.continuityTrace.events.push({ current: endpoints(current), next: endpoints(next), angle: current.angle, thicknessMm: current.thicknessMm, gapMm, crossing: crossingIn(current, current.hi, next.lo) });`);
  const module = await import(`data:text/javascript;base64,${Buffer.from(instrumented).toString('base64')}`);
  variants.push({ mask, name, detect: module.detectVectorWalls, sourceHash: hash(source) });
  fs.writeFileSync(path.join(directory, `variant-${mask}.mjs`), source);
}
variants.push({ mask: 8, name: 'constrained-crossing-repair', detect: detectVectorWalls,
  sourceHash: hash(fs.readFileSync(path.join(root, 'components/construction-estimation/ai-plan-takeoff/geometry/vectorWalls.js'))) });

const loadingTask = pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(path.join(frozen, 'plan.pdf'))), isEvalSupported: false, verbosity: 0 });
const document = await loadingTask.promise;
const page = await document.getPage(pageSpec.page);
const logical = page.getViewport({ scale: 1 });
const viewport = page.getViewport({ scale: 228.6 / 72 });
const historicalCanvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
const historicalContext = historicalCanvas.getContext('2d');
historicalContext.fillStyle = '#fff'; historicalContext.fillRect(0, 0, historicalCanvas.width, historicalCanvas.height);
await page.render({ canvasContext: historicalContext, viewport }).promise;
const historicalRaster = historicalContext.getImageData(0, 0, historicalCanvas.width, historicalCanvas.height);
historicalRaster.storedPixelsPerMm = 228.6 / 72 * referencePpm;
const fullLinework = extractPdfLinework(await page.getOperatorList(), pdfjs.OPS, logical.transform);
const capturedImage = await loadImage(path.join(frozen, 'application-raster.png'));
const capturedCanvas = createCanvas(capturedImage.width, capturedImage.height);
capturedCanvas.getContext('2d').drawImage(capturedImage, 0, 0);
const applicationRaster = capturedCanvas.getContext('2d').getImageData(0, 0, capturedCanvas.width, capturedCanvas.height);
applicationRaster.storedPixelsPerMm = input.storedPixelsPerMm;

function modelReading(level) {
  const categories = wallCategories(level);
  const degrees = new Map();
  for (const wall of Object.values(level.walls)) for (const nodeId of new Set(wall.nodeIds)) degrees.set(nodeId, (degrees.get(nodeId) || 0) + 1);
  return {
    walls: Object.values(level.walls).map(wall => ({ id: wall.id, points: wallPoints(level, wall), thicknessMm: wall.thicknessMm, category: categories[wall.id] })),
    openings: Object.values(level.openings).map(opening => ({ id: opening.id, ...openingPosition(level, opening), widthMm: opening.widthMm, kind: opening.kind })),
    rooms: computeRooms(level).map(room => ({ id: room.id, polygon: room.floor })),
    junctions: Object.values(level.nodes).map(node => ({ x: node.x, y: node.y, walls: degrees.get(node.id) || 0 })),
  };
}

function admittedReading(detected, pixelsPerMm) {
  const context = { jobId: 'frozen-liberty', takeoffId: 'frozen-takeoff', documentHash: hash(read('application-input.json')), pixelsPerMm,
    pages: [{ pageNumber: input.pageNumber, logicalWidth: input.logicalWidth, logicalHeight: input.logicalHeight }],
    completedWallRuns: [], placedOpenings: [], completedFloorplans: [], sheetLevels: { [input.pageNumber]: pageSpec.level } };
  const { vector, batch, analysis, rooms: roomReadings } = buildLocalVectorAnalysis({ planPage: input, detected, pixelsPerMm, level: pageSpec.level, context, runId: 'ablation' });
  const canonical = convertAiTakeoffDetections(batch, context);
  const approvedRooms = roomReadings.filter(room => room.confirmed === true && room.reviewRequired !== true);
  const reviewRooms = roomReadings.filter(room => !approvedRooms.includes(room));
  const accepted = canonicalPlanReading(canonical, approvedRooms, pixelsPerMm);
  const reviewRoomReading = canonicalPlanReading({ completedWallRuns: [], placedOpenings: [] }, reviewRooms, pixelsPerMm).rooms;
  const reviewOpeningReading = (vector.reviewOpeningCandidates || []).map(candidate => ({
    id: candidate.id, x: candidate.nodes[0].x / pixelsPerMm, y: candidate.nodes[0].y / pixelsPerMm,
    widthMm: candidate.widthMm, kind: candidate.openingKind, hostModelWallId: candidate.hostModelWallId,
  }));
  const categories = wallCategories(vector.level);
  const bridgeDetectionIds = new Set((vector.wallLineage || []).filter(lineage => lineage.detectionKey?.startsWith('linework-bridge:'))
    .map(lineage => `page-${input.pageNumber}:${lineage.detectionId}`));
  const measuredCanonical = canonical.completedWallRuns.filter(wall => !bridgeDetectionIds.has(wall.ai?.detectionId));
  const confirmedBridgeCanonical = canonical.completedWallRuns.filter(wall => bridgeDetectionIds.has(wall.ai?.detectionId));
  const candidateWalls = Object.values(vector.level.walls).filter(wall => !wall.detectionKey?.startsWith('linework-bridge:'))
    .map(wall => ({ id: wall.detectionKey || wall.id, points: wallPoints(vector.level, wall), thicknessMm: wall.thicknessMm, category: categories[wall.id] ?? null }));
  const confirmedBridgeWalls = Object.values(vector.level.walls).filter(wall => wall.detectionKey?.startsWith('linework-bridge:'))
    .map(wall => ({ id: wall.detectionKey, points: wallPoints(vector.level, wall), thicknessMm: wall.thicknessMm, category: categories[wall.id] ?? null }));
  return {
    ...accepted,
    reviewRooms: reviewRoomReading,
    reviewOpenings: reviewOpeningReading,
    candidates: { walls: candidateWalls, confirmedBridgeWalls, connectedGeometry: [...candidateWalls, ...confirmedBridgeWalls],
      measuredCanonicalWalls: measuredCanonical.map(wall => ({ id: wall.ai?.detectionId || wall.id, points: wall.nodes.map(point => ({ x: point.x / pixelsPerMm, y: point.y / pixelsPerMm })), thicknessMm: wall.thicknessMm, category: wall.category })),
      confirmedBridgeCanonicalWalls: confirmedBridgeCanonical.map(wall => ({ id: wall.ai?.detectionId || wall.id, points: wall.nodes.map(point => ({ x: point.x / pixelsPerMm, y: point.y / pixelsPerMm })), thicknessMm: wall.thicknessMm, category: wall.category })),
      openings: [...accepted.openings, ...reviewOpeningReading], rooms: [...accepted.rooms, ...reviewRoomReading] },
    withheld: analysis.unresolved, review: analysis.review, modelReport: vector.report,
  };
}

function score(reading, pixelsPerMm) {
  const referenceMm = referenceAtScale(pixelsPerMm);
  const walls = compareWalls(referenceMm.walls, reading.walls);
  return { walls, junctions: compareJunctions(referenceJunctions(referenceMm.walls), reading.junctions),
    openings: compareOpenings(referenceMm.openings, reading.openings), rooms: compareRooms(referenceMm.rooms, reading.rooms),
    candidateGeometry: { walls: compareWalls(referenceMm.walls, reading.candidates?.walls || reading.walls),
      openings: compareOpenings(referenceMm.openings, reading.candidates?.openings || reading.openings),
      rooms: compareRooms(referenceMm.rooms, reading.candidates?.rooms || reading.rooms),
      unclassifiedWalls: (reading.candidates?.walls || []).filter(wall => !['interior', 'exterior'].includes(wall.category)).length },
    referenceWalls: referenceMm.walls.map(wall => { const result = compareWalls([wall], reading.walls); return { id: wall.id, foundShare: result.recall, categoryAgreement: result.categoryAgreement }; }),
  };
}

const fingerprint = item => {
  const roundPoint = point => [Number(point.x.toFixed(4)), Number(point.y.toFixed(4))];
  const geometry = item.points || item.polygon;
  if (!geometry) return JSON.stringify([roundPoint(item), item.kind, item.widthMm]);
  const points = geometry.map(roundPoint);
  return JSON.stringify([points.slice().sort((first, second) => first[0] - second[0] || first[1] - second[1]), item.category || null]);
};
const changedObjects = (before, after) => {
  const beforeKeys = new Set(before.map(fingerprint)), afterKeys = new Set(after.map(fingerprint));
  return { removed: before.filter(item => !afterKeys.has(fingerprint(item))), added: after.filter(item => !beforeKeys.has(fingerprint(item))) };
};
function difference(before, after) {
  const wallChanges = before.scores.referenceWalls.map(previous => ({ id: previous.id, before: previous,
    after: after.scores.referenceWalls.find(wall => wall.id === previous.id) })).filter(change => Math.abs(change.before.foundShare - change.after.foundShare) > 1e-8 || change.before.categoryAgreement !== change.after.categoryAgreement);
  const roomChanges = before.scores.rooms.rows.map(previous => ({ id: previous.id, name: previous.name, before: previous,
    after: after.scores.rooms.rows.find(room => room.id === previous.id) })).filter(change => Math.abs(change.before.iou - change.after.iou) > 1e-8);
  const beforeMissing = new Set(before.scores.openings.missed.map(opening => opening.id)), afterMissing = new Set(after.scores.openings.missed.map(opening => opening.id));
  const falseWalls = result => result.reading.walls.filter(wall => result.scores.walls.falseWalls.some(falseWall => falseWall.id === wall.id));
  const falseRooms = result => result.reading.rooms.filter(room => result.scores.rooms.unmatchedDetected.some(unmatched => unmatched.id === room.id));
  return { wallChanges, roomChanges,
    lostReferenceOpenings: after.scores.openings.missed.filter(opening => !beforeMissing.has(opening.id)),
    gainedReferenceOpenings: before.scores.openings.missed.filter(opening => !afterMissing.has(opening.id)),
    walls: changedObjects(before.reading.walls, after.reading.walls), openings: changedObjects(before.reading.openings, after.reading.openings), rooms: changedObjects(before.reading.rooms, after.reading.rooms),
    reviewRooms: changedObjects(before.reading.reviewRooms || [], after.reading.reviewRooms || []),
    candidateGeometry: { walls: changedObjects(before.reading.candidates?.walls || before.reading.walls, after.reading.candidates?.walls || after.reading.walls),
      openings: changedObjects(before.reading.candidates?.openings || before.reading.openings, after.reading.candidates?.openings || after.reading.openings),
      rooms: changedObjects(before.reading.candidates?.rooms || before.reading.rooms, after.reading.candidates?.rooms || after.reading.rooms) },
    falseWalls: changedObjects(falseWalls(before), falseWalls(after)), falseOpenings: changedObjects(before.scores.openings.extra, after.scores.openings.extra), falseRooms: changedObjects(falseRooms(before), falseRooms(after)) };
}

const results = [];
for (const variant of variants) {
  for (const mode of ['historical', 'application']) {
    const pixelsPerMm = mode === 'historical' ? referencePpm : input.pixelsPerMm;
    const continuity = { events: [] };
    const detected = variant.detect(mode === 'historical' ? fullLinework : input.vectorSegments, {
      pixelsPerMm, logicalWidth: logical.width, logicalHeight: logical.height, raster: mode === 'historical' ? historicalRaster : applicationRaster,
      continuityTrace: continuity,
    });
    const reading = mode === 'historical'
      ? modelReading(levelFromLinework(detected, { id: 'ground', name: pageSpec.level, page: pageSpec.page, pixelsPerMm }, { bridgeUnconfirmedMaxMm: 6200 }).level)
      : admittedReading(detected, pixelsPerMm);
    const result = { mask: variant.mask, name: variant.name, mode, pixelsPerMm, raw: detected, continuity, reading, scores: score(reading, pixelsPerMm) };
    results.push(result);
    fs.writeFileSync(path.join(directory, `${mode}-${variant.mask}.json`), JSON.stringify(result));
    console.log(`${mode} ${variant.mask} ${variant.name}: walls ${reading.walls.length}, recall ${(result.scores.walls.recall * 100).toFixed(1)}%, precision ${(result.scores.walls.precision * 100).toFixed(1)}%, category ${(result.scores.walls.categoryAgreement * 100).toFixed(1)}%, openings ${result.scores.openings.matched}/33, rooms ${result.scores.rooms.matched}/15`);
  }
}
for (const [mask, filename] of [[0, 'plan-accuracy-2026-10-17-final'], [7, 'plan-accuracy-2026-10-18-fixes']]) {
  const recorded = JSON.parse(fs.readFileSync(path.join(root, 'artifacts/test-results', filename, 'report.json'), 'utf8')).pages[0].scores.vector;
  const actual = results.find(result => result.mode === 'historical' && result.mask === mask).scores;
  for (const key of ['recall', 'precision', 'categoryAgreement']) assert.equal(actual.walls[key].toFixed(3), recorded.walls[key].toFixed(3), `Reproduce historical ${mask} ${key}`);
  assert.equal(actual.openings.matched, recorded.openings.matched);
  assert.equal(actual.rooms.matched, recorded.rooms.matched);
}
const browser = JSON.parse(read('browser-before.json')).cases.detected;
const applicationCurrent = results.find(result => result.mode === 'application' && result.mask === 7);
assert.equal(applicationCurrent.reading.walls.length, browser.walls, 'Replay exactly reproduces browser wall admission');
assert.equal(applicationCurrent.reading.openings.length, browser.openings, 'Replay exactly reproduces browser opening admission');
assert.equal(applicationCurrent.reading.reviewRooms.length, browser.roomBoundaries, 'Replay exactly reproduces browser review-only room boundaries');
const browserObjects = JSON.parse(read('browser-before.json')).cases.localVectorResult;
const browserPoint = point => ({ x: point.x / input.pixelsPerMm, y: point.y / input.pixelsPerMm });
const signatures = objects => objects.map(fingerprint).sort();
assert.deepEqual(signatures(applicationCurrent.reading.walls), signatures(browserObjects.completedWallRuns.map(wall => ({ points: wall.nodes.map(browserPoint), category: wall.category }))), 'Replay matches exact browser wall geometry and classes');
assert.deepEqual(signatures(applicationCurrent.reading.openings), signatures(browserObjects.placedOpenings.map(opening => ({ ...browserPoint(opening), kind: opening.type, widthMm: opening.widthMm }))), 'Replay matches exact browser opening geometry and quantities');
for (const mode of ['historical', 'application']) {
  const baseline = results.find(result => result.mode === mode && result.mask === 0);
  const repaired = results.find(result => result.mode === mode && result.mask === 8);
  for (const kind of ['walls', 'openings', 'rooms']) assert.deepEqual(signatures(repaired.reading[kind]), signatures(baseline.reading[kind]), `Repair preserves original ${mode} ${kind} geometry`);
  if (mode === 'application') assert.deepEqual(signatures(repaired.reading.reviewRooms), signatures(baseline.reading.reviewRooms), 'Repair preserves the same application review-room candidates');
}
const browserAfterFile = path.join(directory, 'browser-after.json');
if (fs.existsSync(browserAfterFile)) {
  const browserAfter = JSON.parse(fs.readFileSync(browserAfterFile, 'utf8'));
  const repairedApplication = results.find(result => result.mode === 'application' && result.mask === 8);
  const correctedBrowser = browserAfter.cases.localVectorResult;
  const browserLineage = browserAfter.cases.wallLineage;
  const measuredDetectionIds = new Set(browserLineage.filter(item => item.detectionKey?.startsWith('linework:')).map(item => `page-${input.pageNumber}:${item.detectionId}`));
  const bridgeDetectionIds = new Set(browserLineage.filter(item => item.detectionKey?.startsWith('linework-bridge:')).map(item => `page-${input.pageNumber}:${item.detectionId}`));
  assert.deepEqual(signatures(repairedApplication.reading.walls), signatures(correctedBrowser.completedWallRuns.filter(wall => wall.source === 'ai').map(wall => ({ points: wall.nodes.map(browserPoint), category: wall.category }))), 'Repaired replay matches final browser wall objects exactly');
  assert.deepEqual(signatures(repairedApplication.reading.openings), signatures(correctedBrowser.placedOpenings.filter(opening => opening.source === 'ai').map(opening => ({ ...browserPoint(opening), kind: opening.type, widthMm: opening.widthMm }))), 'Repaired replay matches final browser opening objects exactly');
  assert.deepEqual(signatures(repairedApplication.reading.reviewRooms), signatures(browserAfter.cases.savedRoomBoundaries.map(room => ({ polygon: room.polygon.map(browserPoint) }))), 'Repaired replay matches the review-only polygons persisted by the final browser workflow');
  const browserCandidateWalls = [
    ...correctedBrowser.completedWallRuns.filter(wall => measuredDetectionIds.has(wall.ai?.detectionId)).map(wall => ({ points: wall.nodes.map(browserPoint), category: wall.category })),
    ...browserAfter.cases.reviewWallCandidates.candidates.map(candidate => ({ points: candidate.nodes.map(browserPoint), category: null })),
  ];
  assert.deepEqual(signatures(repairedApplication.reading.candidates.walls), signatures(browserCandidateWalls), 'Connected measured candidates equal accepted measured walls plus review-only browser walls exactly');
  assert.deepEqual(signatures(repairedApplication.reading.candidates.confirmedBridgeCanonicalWalls), signatures(correctedBrowser.completedWallRuns.filter(wall => bridgeDetectionIds.has(wall.ai?.detectionId)).map(wall => ({ points: wall.nodes.map(browserPoint), category: wall.category }))), 'Confirmed-opening bridges accepted by the browser match bridge lineage exactly');
  assert.equal(browserAfter.cases.unclassifiedBridges, repairedApplication.reading.modelReport.unclassifiedBridges, 'Unclassified confirmed-opening bridge topology remains review-only in both paths');
  const browserCandidateOpenings = [
    ...correctedBrowser.placedOpenings.filter(opening => opening.source === 'ai').map(opening => ({ ...browserPoint(opening), kind: opening.type, widthMm: opening.widthMm })),
    ...browserAfter.cases.reviewOpeningCandidates.candidates.map(opening => ({ ...browserPoint(opening.nodes[0]), kind: opening.openingKind, widthMm: opening.widthMm })),
  ];
  assert.deepEqual(signatures(repairedApplication.reading.candidates.openings), signatures(browserCandidateOpenings), 'Accepted plus uncertain-host opening geometry matches the actual browser geometry');
}
const edges = [];
for (const mode of ['historical', 'application']) for (let mask = 0; mask < 8; mask += 1) for (let index = 0; index < 3; index += 1) {
  if (mask & (1 << index)) continue;
  const before = results.find(result => result.mode === mode && result.mask === mask);
  const after = results.find(result => result.mode === mode && result.mask === (mask | (1 << index)));
  edges.push({ mode, change: switches[index].name, before: before.name, after: after.name, ...difference(before, after) });
}
fs.writeFileSync(path.join(directory, 'object-differences.json'), JSON.stringify(edges, null, 2));
const repairDifferences = ['historical', 'application'].flatMap(mode => [0, 7].map(mask => {
  const before = results.find(result => result.mode === mode && result.mask === mask);
  const after = results.find(result => result.mode === mode && result.mask === 8);
  return { mode, before: before.name, after: after.name, ...difference(before, after) };
}));
fs.writeFileSync(path.join(directory, 'repair-object-differences.json'), JSON.stringify(repairDifferences, null, 2));
const manifest = { generatedAt: new Date().toISOString(), scoring: ACCURACY_DEFAULTS,
  hashes: Object.fromEntries(['plan.pdf', 'reference.json', 'vectorWalls-baseline.mjs', 'vectorWalls-current.mjs', 'application-input.json', 'application-raster.png'].map(filename => [filename, hash(fs.readFileSync(path.join(frozen, filename)))])),
  applicationCalibration: input.pixelsPerMm, historicalCalibration: referencePpm,
  calibrationErrorShare: Math.abs(input.pixelsPerMm / referencePpm - 1),
  coordinateComparison: 'Reference and detected sheet coordinates are converted with the same per-run calibration; frozen reference geometry and scorer tolerances are unchanged.',
  variants: variants.map(({ mask, name, sourceHash }) => ({ mask, name, sourceHash })) };
fs.writeFileSync(path.join(directory, 'experiment-manifest.json'), JSON.stringify(manifest, null, 2));
const md = ['# Frozen Liberty Detector Ablation', '', 'Historical = old 6200 mm unconfirmed bridges (reproduction only). Application = captured browser vectors/raster and actual normalization/canonical admission; no unconfirmed gap bridging.', '',
  '| Path | Variant | Wall Recall | Precision | Class Agreement | Openings | Rooms |', '| --- | --- | --- | --- | --- | --- | --- |'];
for (const result of results) md.push(`| ${result.mode} | ${result.name} | ${(100 * result.scores.walls.recall).toFixed(1)}% | ${(100 * result.scores.walls.precision).toFixed(1)}% | ${(100 * result.scores.walls.categoryAgreement).toFixed(1)}% | ${result.scores.openings.matched}/33 | ${result.scores.rooms.matched}/15 |`);
md.push('', '## Application Accepted vs Candidate Scores', '', 'Only the accepted columns are eligible for Takeoff quantities. Candidate geometry includes unclassified measured model walls, review-only hosted openings, and unconfirmed room boundaries; it is diagnostic and excluded from accepted quantities.', '',
  '| Variant | Accepted wall recall / precision | Candidate wall recall / precision | Accepted openings | Opening candidates | Accepted rooms | Room candidates |',
  '|---|---:|---:|---:|---:|---:|---:|');
for (const result of results.filter(item => item.mode === 'application')) {
  const accepted = result.scores, candidates = result.scores.candidateGeometry;
  md.push(`| ${result.name} | ${(100 * accepted.walls.recall).toFixed(1)}% / ${(100 * accepted.walls.precision).toFixed(1)}% | ${(100 * candidates.walls.recall).toFixed(1)}% / ${(100 * candidates.walls.precision).toFixed(1)}% | ${accepted.openings.matched}/33 (${accepted.openings.detected} accepted) | ${candidates.openings.matched}/33 (${candidates.openings.detected} with review) | ${accepted.rooms.matched}/15 (${accepted.rooms.detected} approved) | ${candidates.rooms.matched}/15 (${candidates.rooms.detected} with review) |`);
}
for (const edge of [...edges, ...repairDifferences]) {
  md.push('', `## ${edge.mode}: ${edge.before} -> ${edge.after}`, '',
    `Reference wall changes: ${edge.wallChanges.map(change => `${change.id} found ${(100 * change.before.foundShare).toFixed(1)}% -> ${(100 * change.after.foundShare).toFixed(1)}%, class ${change.before.categoryAgreement} -> ${change.after.categoryAgreement}`).join('; ') || 'none'}.`,
    `Lost openings: ${edge.lostReferenceOpenings.map(opening => opening.id).join(', ') || 'none'}. Gained openings: ${edge.gainedReferenceOpenings.map(opening => opening.id).join(', ') || 'none'}.`,
    `Room changes: ${edge.roomChanges.map(change => `${change.name} (${change.id}) IoU ${change.before.iou.toFixed(3)} -> ${change.after.iou.toFixed(3)}`).join('; ') || 'none'}.`,
    `False objects added/removed: walls ${edge.falseWalls.added.length}/${edge.falseWalls.removed.length}, openings ${edge.falseOpenings.added.length}/${edge.falseOpenings.removed.length}, rooms ${edge.falseRooms.added.length}/${edge.falseRooms.removed.length}. Exact coordinates and object records: object-differences.json.`);
}
fs.writeFileSync(path.join(directory, 'ablation.md'), md.join('\n') + '\n');
const strictApplication = results.find(result => result.mode === 'application' && result.mask === 7);
const baselineApplication = results.find(result => result.mode === 'application' && result.mask === 0);
const rejectedContinuations = strictApplication.continuity.events.filter(event => !event.crossing);
for (const [index, event] of rejectedContinuations.entries()) {
  const centre = { x: (event.current.b.x + event.next.a.x) / 2, y: (event.current.b.y + event.next.a.y) / 2 };
  const canvas = createCanvas(780, 780), context = canvas.getContext('2d');
  const radius = 65, scale = 780 / (2 * radius), rasterScale = capturedImage.width / input.logicalWidth;
  context.drawImage(capturedImage, (centre.x - radius) * rasterScale, (centre.y - radius) * rasterScale, 2 * radius * rasterScale, 2 * radius * rasterScale, 0, 0, 780, 780);
  const draw = (points, color, width) => { context.strokeStyle = color; context.lineWidth = width; context.beginPath(); points.forEach((point, pointIndex) => { const x = (point.x - centre.x + radius) * scale, y = (point.y - centre.y + radius) * scale; if (pointIndex) context.lineTo(x, y); else context.moveTo(x, y); }); context.stroke(); };
  for (const wall of strictApplication.continuity.pool) draw([wall.a, wall.b], 'rgba(16,140,60,0.35)', 2);
  draw([event.current.a, event.current.b], '#e00000', 3); draw([event.next.a, event.next.b], '#e00000', 3);
  draw([event.current.b, event.next.a], '#0077ff', 5);
  context.fillStyle = '#ffffff'; context.fillRect(0, 0, 780, 44); context.fillStyle = '#000000'; context.font = '18px sans-serif';
  context.fillText(`Gap ${index}: ${event.gapMm.toFixed(1)} mm at (${centre.x.toFixed(2)}, ${centre.y.toFixed(2)})`, 8, 28);
  fs.writeFileSync(path.join(directory, `crossing-gap-${index}.png`), canvas.toBuffer('image/png'));
}
fs.writeFileSync(path.join(directory, 'crossing-events.json'), JSON.stringify({ rejected: rejectedContinuations, baseline: baselineApplication.continuity.events }, null, 2));
const junctionEvidence = rejectedContinuations.map(event => {
  const direction = { x: Math.cos(event.angle), y: Math.sin(event.angle) }, normal = { x: -Math.sin(event.angle), y: Math.cos(event.angle) };
  const dot = (point, axis) => point.x * axis.x + point.y * axis.y;
  const centreline = dot(event.current.b, normal), gapStart = dot(event.current.b, direction), gapEnd = dot(event.next.a, direction);
  const candidates = strictApplication.continuity.pool.filter(wall => wall.angle !== event.angle).map(wall => {
    const normalStart = dot(wall.a, normal), normalEnd = dot(wall.b, normal);
    const amount = (centreline - normalStart) / (normalEnd - normalStart);
    const intersection = dot(wall.a, direction) + amount * (dot(wall.b, direction) - dot(wall.a, direction));
    return { ...wall, intersection, normalDistanceMm: Math.max(0, Math.min(normalStart, normalEnd) - centreline, centreline - Math.max(normalStart, normalEnd)) / input.pixelsPerMm };
  }).filter(wall => wall.intersection >= gapStart - 20 * input.pixelsPerMm && wall.intersection <= gapEnd + 20 * input.pixelsPerMm).sort((first, second) => first.normalDistanceMm - second.normalDistanceMm);
  return { event, nearest: candidates.slice(0, 3) };
});
fs.writeFileSync(path.join(directory, 'junction-evidence.json'), JSON.stringify(junctionEvidence, null, 2));
assert.equal(hash(fs.readFileSync(originalReference)), manifest.hashes['reference.json']);
await loadingTask.destroy();
console.log('PASS: historical before/after reproduced, all eight combinations scored, browser admission counts reproduced, frozen reference unchanged.');