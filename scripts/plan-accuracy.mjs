// Ground-truth accuracy run: a plan PDF and a reference traced from it in, scores and overlays out.
// No provider is called and nothing leaves the machine. Two readings are scored against the same
// reference: the linework engine as the app uses it today, and the connected plan model built from
// that engine's walls and openings (rooms as faces of the wall network).
//
//   node scripts/plan-accuracy.mjs --reference <reference.json> --pdf <plan.pdf> --out <dir> [--application-input <captured-browser-directory>]
//
// The application column scores compact vectors through the live normalizer and canonical adapter;
// unconfirmed gap bridges are forbidden. Without captured input its raster is labelled reconstructed.
// Writes <out>/report.json, <out>/report.md and per page: page-<n>-walls.png (reference walls green,
// model walls magenta, missed reference wall red, unsupported model wall orange, missed junctions red
// rings, openings: reference green squares, model blue crosses) and page-<n>-rooms-<reading>.png
// (reference rooms dashed green, read rooms filled by overlap: green >= 0.9, amber >= 0.5, red below).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { compactPdfLinework, extractPdfLinework } from '../components/construction-estimation/ai-plan-takeoff/geometry/pdfLinework.js';
import { fuseSheetLinework } from '../components/construction-estimation/ai-plan-takeoff/geometry/lineworkFusion.js';
import { detectVectorWalls } from '../components/construction-estimation/ai-plan-takeoff/geometry/vectorWalls.js';
import { levelFromLinework, openingKindOf } from '../components/construction-estimation/ai-plan-takeoff/geometry/planModelAdapter.js';
import { computeRooms, describeLevel, openingPosition, wallCategories, wallPoints } from '../components/construction-estimation/ai-plan-takeoff/geometry/planModel.js';
import { canonicalPlanReading, compareJunctions, compareOpenings, compareRooms, compareWalls, referenceJunctions } from '../components/construction-estimation/ai-plan-takeoff/geometry/planAccuracy.js';
import { buildLocalVectorAnalysis } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/localVectorAnalysis.js';
import { convertAiTakeoffDetections } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/adapter.js';
import { readPdfAnalysisEvidence } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/analysisPages.js';
// --vector-overrides '<json>' changes detector options for a controlled before/after (e.g. {"stairLabelReachMm":0});
// --no-pdf-text withholds the PDF text layer, as the runner did before it read text the way the app does.

const args = Object.fromEntries(process.argv.slice(2).map((arg, index, all) => (arg.startsWith('--') ? [arg.slice(2), all[index + 1]] : null)).filter(Boolean));
const vectorOverrides = args['vector-overrides'] ? JSON.parse(args['vector-overrides']) : {};
if (!args.reference || !args.pdf || !args.out) { console.error('Usage: --reference <reference.json> --pdf <plan.pdf> --out <dir>'); process.exit(2); }
if (Number(args['bridge-unconfirmed-mm']) > 0) throw new Error('Unconfirmed wall bridges are not permitted in application accuracy scoring.');
const reference = JSON.parse(fs.readFileSync(args.reference, 'utf8'));
if (reference.schemaVersion !== 'gr8-plan-reference.v1' || reference.coordinateSpace !== 'logical-plan-pixels') throw new Error('Reference must be gr8-plan-reference.v1 in logical-plan-pixels.');
fs.mkdirSync(args.out, { recursive: true });
const require = createRequire(import.meta.url);
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const applicationInput = args['application-input'] ? JSON.parse(fs.readFileSync(path.join(args['application-input'], 'application-input.json'), 'utf8')) : null;
const font = ['C:/Windows/Fonts/arial.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/System/Library/Fonts/Supplemental/Arial.ttf'].find((file) => fs.existsSync(file));
if (font) GlobalFonts.registerFromPath(font, 'ReportFont');

const ENGINE_DPI = 228.6; // the raster resolution the app's engine runs at for a 1:100 sheet (0.09 px/mm)
const DRAW_SCALE = 3;     // overlay pixels per logical pixel
const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(args.pdf)), isEvalSupported: false, verbosity: 0 }).promise;
const pct = (value) => (value === null || value === undefined ? '-' : `${(100 * value).toFixed(1)}%`);
const num = (value, digits = 1) => (value === null || value === undefined ? '-' : Number(value).toFixed(digits));

async function readPage(pageSpec) {
  const page = await doc.getPage(pageSpec.page);
  const logical = page.getViewport({ scale: 1 });
  const k = ENGINE_DPI / 72;
  const big = page.getViewport({ scale: k });
  const canvas = createCanvas(Math.round(big.width), Math.round(big.height));
  const g = canvas.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: g, viewport: big }).promise;
  const raster = g.getImageData(0, 0, canvas.width, canvas.height);
  raster.storedPixelsPerMm = k * pageSpec.pixelsPerMm;
  const operatorList = await page.getOperatorList();
  const fullLinework = extractPdfLinework(operatorList, pdfjs.OPS, logical.transform);
  const linework = fullLinework.filter((s) => Math.hypot(s.x2 - s.x1, s.y2 - s.y1) >= 1)
    .map(({ x1, y1, x2, y2, path: pathId, subpath, curve }) => ({ x1, y1, x2, y2, path: pathId, subpath, ...(curve ? { curve: true } : {}) }));
  const sheet = { pageNumber: pageSpec.page, logicalWidth: logical.width, logicalHeight: logical.height, pixelsPerMm: pageSpec.pixelsPerMm };
  const fused = fuseSheetLinework({ page: pageSpec.page, walls: [], openings: [], rooms: [] }, raster, sheet, { vectorLinework: linework });
  return { page, logical, fused, linework, fullLinework, raster };
}

function engineReading(geometry, ppm) {
  const mm = (p) => ({ x: p.x / ppm, y: p.y / ppm });
  return {
    walls: geometry.walls.map((wall) => ({ id: wall.id, points: wall.nodes.map(mm), thicknessMm: wall.measuredThicknessMm, category: wall.category })),
    junctions: (geometry.junctions || []).map((junction) => ({ ...mm(junction), walls: junction.wallIds.length })),
    openings: geometry.openings.filter((item) => item.confirmed !== false).map((item) => ({ id: item.id, ...mm(item), widthMm: item.leafMm || item.widthMm, kind: openingKindOf(item) })),
    rooms: geometry.rooms.filter((room) => !room.partOf && room.polygon?.length >= 3).map((room) => ({ id: room.id, polygon: room.polygon.map(mm) })),
  };
}

function modelReading(level) {
  const categories = wallCategories(level);
  const walls = Object.values(level.walls);
  const counts = new Map();
  for (const wall of walls) for (const id of new Set(wall.nodeIds)) counts.set(id, (counts.get(id) || 0) + 1);
  return {
    walls: walls.map((wall) => ({ id: wall.id, points: wallPoints(level, wall).map((p) => ({ x: p.x, y: p.y })), thicknessMm: wall.thicknessMm, category: categories[wall.id] })),
    junctions: Object.values(level.nodes).map((node) => ({ x: node.x, y: node.y, walls: counts.get(node.id) || 0 })),
    openings: Object.values(level.openings).map((opening) => ({ id: opening.id, ...openingPosition(level, opening), widthMm: opening.widthMm, kind: opening.kind })),
    rooms: computeRooms(level).map((room) => ({ id: room.id, polygon: room.floor })),
  };
}

function wallMetrics(referenceWall, walls) {
  const score = compareWalls([referenceWall], walls);
  const contributions = walls.map((wall) => ({ wall, score: compareWalls([referenceWall], [wall]) }))
    .filter((item) => item.score.foundLm > 0)
    .sort((a, b) => b.score.foundLm - a.score.foundLm);
  return { foundShare: score.recall, matchedLengthMm: score.foundLm * 1000,
    categoryAgreement: score.categoryAgreement, candidateIds: contributions.slice(0, 8).map((item) => ({
      id: item.wall.id, modelId: item.wall.modelId || null, detectionKey: item.wall.detectionKey || null,
      absorbedKeys: item.wall.absorbedKeys || [], modelOutcome: item.wall.modelOutcome || null,
      share: item.score.recall, category: item.wall.category ?? null,
    })) };
}

function traceReferenceWalls(referenceWalls, stages, rejectedCandidates) {
  return referenceWalls.map((referenceWall) => {
    const stagesForWall = Object.fromEntries(Object.entries(stages).map(([name, walls]) => [name, wallMetrics(referenceWall, walls)]));
    const diagnosticReachMm = 750;
    const rejected = rejectedCandidates.map((candidate) => ({ candidate,
      overlap: compareWalls([referenceWall], [candidate], { wallReachMm: diagnosticReachMm }) }))
      .filter((item) => item.overlap.foundLm > 0)
      .sort((a, b) => b.overlap.foundLm - a.overlap.foundLm)
      .slice(0, 5)
      .map(({ candidate, overlap }) => ({ id: candidate.id, reason: candidate.reason, lengthMm: candidate.lengthMm,
        diagnosticOverlapShare: overlap.recall, diagnosticReachMm, a: candidate.a, b: candidate.b }));
    const orderedStages = ['detectorAccepted', 'connectedModel', 'classifiedModel', 'adapterResponse', 'normalizedBatch', 'canonicalAccepted'];
    let lastRetained = 'not detected';
    for (const stage of orderedStages) if (stagesForWall[stage].foundShare >= 0.5) lastRetained = stage;
    let lossStage = 'detector';
    if (stagesForWall.detectorAccepted.foundShare >= 0.5 && stagesForWall.connectedModel.foundShare < 0.5) lossStage = 'connected-model';
    else if (stagesForWall.connectedModel.foundShare >= 0.5 && stagesForWall.classifiedModel.foundShare < 0.5) lossStage = 'classification';
    else if (stagesForWall.classifiedModel.foundShare >= 0.5 && stagesForWall.adapterResponse.foundShare < 0.5) lossStage = 'adapter';
    else if (stagesForWall.adapterResponse.foundShare >= 0.5 && stagesForWall.normalizedBatch.foundShare < 0.5) lossStage = 'normalization';
    else if (stagesForWall.normalizedBatch.foundShare >= 0.5 && stagesForWall.canonicalAccepted.foundShare < 0.5) lossStage = 'canonical-admission';
    else if (stagesForWall.canonicalAccepted.foundShare >= 0.5) lossStage = null;
    return { id: referenceWall.id, lengthMm: Math.round(Math.hypot(referenceWall.b.x - referenceWall.a.x, referenceWall.b.y - referenceWall.a.y)),
      expectedCategory: referenceWall.category, finalAcceptedShare: stagesForWall.canonicalAccepted.foundShare,
      lastRetainedStage: lastRetained, lossStage, stages: stagesForWall, detectorRejectedCandidates: rejected };
  });
}

function wallStages(detected, prepared, canonical, planPage, pixelsPerMm) {
  const toMm = (point) => ({ x: point.x / pixelsPerMm, y: point.y / pixelsPerMm });
  const detectedWalls = detected.walls.map((wall) => ({ id: wall.id, points: wall.nodes.map(toMm), thicknessMm: wall.measuredThicknessMm,
    category: wall.category ?? null }));
  const level = prepared.vector.level;
  const categories = wallCategories(level);
  const modelOutcomes = new Map((prepared.vector.report.wallOutcomes || []).map((outcome) => [outcome.detectionKey, outcome]));
  const connectedModel = Object.values(level.walls).map((wall) => ({
    id: `model-wall:${wall.id}`, modelId: wall.id, detectionKey: wall.detectionKey || null,
    absorbedKeys: wall.absorbedKeys || [], points: wallPoints(level, wall), thicknessMm: wall.thicknessMm,
    category: categories[wall.id] ?? null, syntheticConfirmedBridge: wall.detectionKey?.startsWith('linework-bridge:') || false,
    modelOutcome: modelOutcomes.get(wall.detectionKey) || null,
  }));
  const detectorToModel = detected.walls.map((wall) => {
    const detectionKey = `linework:${wall.id}`;
    const outcome = modelOutcomes.get(detectionKey) || null;
    const owners = connectedModel.filter((modelWall) => modelWall.detectionKey === detectionKey || modelWall.absorbedKeys.includes(detectionKey));
    return { detectorWallId: wall.id, detectionKey, outcome, modelWallIds: owners.map((modelWall) => modelWall.modelId),
      categories: owners.map((modelWall) => modelWall.category), geometryMm: wall.nodes.map(toMm),
      measuredThicknessMm: wall.measuredThicknessMm, measuredLengthMm: wall.lengthMm };
  });
  const measuredModel = connectedModel.filter((wall) => !wall.syntheticConfirmedBridge);
  const categorized = measuredModel.filter((wall) => ['interior', 'exterior'].includes(wall.category));
  const normalizedWalls = prepared.batch.detections.filter((detection) => detection.kind === 'wall').map((wall) => ({
    id: wall.detectionId, points: wall.nodes.map((point) => ({ x: point.x * planPage.logicalWidth / pixelsPerMm, y: point.y * planPage.logicalHeight / pixelsPerMm })),
    thicknessMm: wall.thicknessMm, category: wall.category,
  }));
  const rejectedCandidates = (detected.rejected || []).filter((candidate) => candidate.a && candidate.b).map((candidate, index) => ({
    id: `rejected-${index + 1}`, a: toMm(candidate.a), b: toMm(candidate.b), points: [toMm(candidate.a), toMm(candidate.b)],
    thicknessMm: candidate.thicknessMm, lengthMm: candidate.lengthMm, reason: candidate.reason,
  }));
  return {
    detectedWalls, detectorToModel, connectedModel, measuredModel, categorized, adapterResponse: prepared.vector.response.walls.map((wall) => ({
      id: wall.detectionId, points: wall.nodes.map((point) => ({ x: point.x * planPage.logicalWidth / pixelsPerMm, y: point.y * planPage.logicalHeight / pixelsPerMm })),
      thicknessMm: wall.thicknessMm, category: wall.category,
    })),
    normalizedWalls, canonicalWalls: canonical.completedWallRuns.map((wall) => ({
      id: wall.ai?.detectionId || wall.id, points: wall.nodes.map(toMm), thicknessMm: wall.thicknessMm, category: wall.category,
    })), rejectedCandidates,
  };
}

function score(referenceMm, reading) {
  return {
    walls: compareWalls(referenceMm.walls, reading.walls),
    junctions: compareJunctions(referenceJunctions(referenceMm.walls), reading.junctions),
    openings: compareOpenings(referenceMm.openings, reading.openings),
    rooms: compareRooms(referenceMm.rooms, reading.rooms),
  };
}

async function drawBase(page) {
  const viewport = page.getViewport({ scale: DRAW_SCALE });
  const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
  const g = canvas.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: g, viewport }).promise;
  g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(0, 0, canvas.width, canvas.height);
  return { canvas, g };
}

function legend(g, lines) {
  g.font = '26px ReportFont';
  const width = Math.max(...lines.map(([text]) => g.measureText(text).width)) + 60;
  g.fillStyle = 'rgba(255,255,255,0.92)'; g.fillRect(10, 10, width, lines.length * 34 + 16);
  lines.forEach(([text, color], index) => { g.fillStyle = color; g.fillRect(20, 24 + index * 34, 22, 22); g.fillStyle = '#111'; g.fillText(text, 52, 44 + index * 34); });
}

const report = { plan: reference.plan.name, generated: new Date().toISOString(), reference: args.reference, pages: [] };
for (const pageSpec of reference.pages) {
  const ppm = pageSpec.pixelsPerMm;
  const mm = (p) => ({ x: p.x / ppm, y: p.y / ppm });
  const referenceMm = {
    walls: reference.walls.filter((item) => item.page === pageSpec.page).map((wall) => ({ ...wall, a: mm(wall.a), b: mm(wall.b) })),
    openings: reference.openings.filter((item) => item.page === pageSpec.page).map((item) => ({ ...item, ...mm(item) })),
    rooms: reference.rooms.filter((item) => item.page === pageSpec.page).map((room) => ({ ...room, polygon: room.polygon.map(mm) })),
  };
  const started = Date.now();
  const { page, fused, fullLinework, raster, logical } = await readPage(pageSpec);
  const engineMs = Date.now() - started;
  const vectorStarted = Date.now();
  if (applicationInput && applicationInput.pageNumber !== pageSpec.page) throw new Error('Captured application input does not match this reference page.');
  const applicationPpm = applicationInput?.pixelsPerMm || Number(args['pixels-per-mm']) || ppm;
  const planPage = applicationInput || { pageNumber: pageSpec.page, logicalWidth: logical.width, logicalHeight: logical.height, vectorSegments: compactPdfLinework(fullLinework),
    // The app reads the text layer at the unscaled (logical) viewport on upload; do the same here.
    textItems: 'no-pdf-text' in args ? [] : (await readPdfAnalysisEvidence(page, page.getViewport({ scale: 1 }))).textItems };
  let applicationRaster = raster;
  if (applicationInput) {
    const captured = await loadImage(path.join(args['application-input'], 'application-raster.png'));
    const canvas = createCanvas(captured.width, captured.height);
    canvas.getContext('2d').drawImage(captured, 0, 0);
    applicationRaster = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    applicationRaster.storedPixelsPerMm = applicationInput.storedPixelsPerMm;
  }
  const vector = detectVectorWalls(planPage.vectorSegments, { pixelsPerMm: applicationPpm, logicalWidth: planPage.logicalWidth, logicalHeight: planPage.logicalHeight, raster: applicationRaster, textItems: planPage.textItems || [] }, vectorOverrides);
  const context = { jobId: 'accuracy-disposable', takeoffId: 'accuracy-takeoff', documentHash: 'local-frozen-input', pixelsPerMm: applicationPpm,
    pages: [{ pageNumber: pageSpec.page, logicalWidth: planPage.logicalWidth, logicalHeight: planPage.logicalHeight }],
    completedWallRuns: [], placedOpenings: [], completedFloorplans: [], sheetLevels: { [pageSpec.page]: pageSpec.level } };
  const prepared = buildLocalVectorAnalysis({ planPage, detected: vector, pixelsPerMm: applicationPpm, level: pageSpec.level, context, runId: 'accuracy' });
  const canonical = convertAiTakeoffDetections(prepared.batch, context);
  const approvedRooms = prepared.rooms.filter((room) => room.confirmed === true && room.reviewRequired !== true);
  const reviewRooms = prepared.rooms.filter((room) => !approvedRooms.includes(room));
  const admitted = canonicalPlanReading(canonical, approvedRooms, applicationPpm);
  const reviewRoomReading = canonicalPlanReading({ completedWallRuns: [], placedOpenings: [] }, reviewRooms, applicationPpm).rooms;
  const reviewOpeningReading = prepared.vector.reviewOpeningCandidates.map((candidate) => ({
    id: candidate.id, x: candidate.nodes[0].x / applicationPpm, y: candidate.nodes[0].y / applicationPpm,
    widthMm: candidate.widthMm, kind: candidate.openingKind, hostModelWallId: candidate.hostModelWallId,
  }));
  const vectorBuilt = prepared.vector;
  const vectorMs = Date.now() - vectorStarted;
  fs.writeFileSync(path.join(args.out, `page-${pageSpec.page}-vector-geometry.json`), JSON.stringify({ walls: vector.walls, openings: vector.openings, stats: vector.stats, rejected: vector.rejected }));
  const modelStarted = Date.now();
  const built = levelFromLinework(fused.geometry, { id: pageSpec.level || `page-${pageSpec.page}`, name: pageSpec.level, page: pageSpec.page, pixelsPerMm: ppm });
  const modelMs = Date.now() - modelStarted;
  const readings = { engine: engineReading(fused.geometry, ppm), model: modelReading(built.level), vector: admitted };
  const applicationReference = {
    walls: reference.walls.filter(item => item.page === pageSpec.page).map(wall => ({ ...wall, a: { x: wall.a.x / applicationPpm, y: wall.a.y / applicationPpm }, b: { x: wall.b.x / applicationPpm, y: wall.b.y / applicationPpm } })),
    openings: reference.openings.filter(item => item.page === pageSpec.page).map(opening => ({ ...opening, x: opening.x / applicationPpm, y: opening.y / applicationPpm })),
    rooms: reference.rooms.filter(item => item.page === pageSpec.page).map(room => ({ ...room, polygon: room.polygon.map(point => ({ x: point.x / applicationPpm, y: point.y / applicationPpm })) })),
  };
  const scores = { engine: score(referenceMm, readings.engine), model: score(referenceMm, readings.model), vector: score(applicationReference, readings.vector) };
  const connectedCandidateReading = modelReading(prepared.vector.level);
  const acceptedReferenceJunctions = referenceJunctions(applicationReference.walls);
  const connectedCandidateJunctions = compareJunctions(acceptedReferenceJunctions, connectedCandidateReading.junctions);
  const candidateOpenings = [...admitted.openings, ...reviewOpeningReading];
  const candidateRooms = [...admitted.rooms, ...reviewRoomReading];
  const candidateScores = {
    junctions: connectedCandidateJunctions,
    openings: compareOpenings(applicationReference.openings, candidateOpenings),
    rooms: compareRooms(applicationReference.rooms, candidateRooms),
    reviewOpeningOnly: compareOpenings(applicationReference.openings, reviewOpeningReading),
    reviewRoomOnly: compareRooms(applicationReference.rooms, reviewRoomReading),
  };
  const stages = wallStages(vector, prepared, canonical, planPage, applicationPpm);
  const candidateReference = applicationReference.walls.map(({ category, ...wall }) => wall);
  const detectorCandidateScore = compareWalls(candidateReference, stages.detectedWalls.map(({ category, ...wall }) => wall));
  const candidateGeometry = stages.measuredModel.map(({ category, syntheticConfirmedBridge, ...wall }) => wall);
  const uncertainGeometry = stages.measuredModel.filter((wall) => !['interior', 'exterior'].includes(wall.category))
    .map(({ category, syntheticConfirmedBridge, ...wall }) => wall);
  const acceptedGeometry = readings.vector.walls.map(({ category, ...wall }) => wall);
  const candidateScore = compareWalls(candidateReference, candidateGeometry);
  const uncertainScore = compareWalls(candidateReference, uncertainGeometry);
  const acceptedGeometryScore = compareWalls(candidateReference, acceptedGeometry);
  const perReferenceWall = traceReferenceWalls(applicationReference.walls, {
    detectorAccepted: stages.detectedWalls,
    connectedModel: stages.measuredModel,
    classifiedModel: stages.categorized,
    adapterResponse: stages.adapterResponse,
    normalizedBatch: stages.normalizedWalls,
    canonicalAccepted: stages.canonicalWalls,
  }, stages.rejectedCandidates);
  const modelWallOutcomes = prepared.vector.report.wallOutcomes || [];
  const measuredWallOutcomes = modelWallOutcomes.filter((outcome) => outcome.detectionKey.startsWith('linework:'));
  const bridgeOutcomes = modelWallOutcomes.filter((outcome) => outcome.detectionKey.startsWith('linework-bridge:'));
  const traceSummary = {
    rejectionDiagnosticReachMm: 750,
    stages: { detectorAccepted: stages.detectedWalls.length, detectorRejected: stages.rejectedCandidates.length,
      connectedModel: stages.measuredModel.length, syntheticConfirmedBridges: stages.connectedModel.filter((wall) => wall.syntheticConfirmedBridge).length,
      measuredInserted: measuredWallOutcomes.filter((outcome) => outcome.status === 'inserted').length,
      measuredMergedOrCovered: measuredWallOutcomes.filter((outcome) => outcome.status === 'merged-or-covered').length,
      measuredRejectedBefore: measuredWallOutcomes.filter((outcome) => outcome.status === 'rejected-before').length,
      bridgeInserted: bridgeOutcomes.filter((outcome) => outcome.status === 'inserted').length,
      bridgeMergedOrCovered: bridgeOutcomes.filter((outcome) => outcome.status === 'merged-or-covered').length,
      bridgeRejectedBefore: bridgeOutcomes.filter((outcome) => outcome.status === 'rejected-before').length,
      detectorMergeOutcomes: Object.fromEntries(['inserted', 'merged-or-covered', 'rejected-before', 'not-inserted'].map((status) =>
        [status, stages.detectorToModel.filter((wall) => wall.outcome?.status === status).length])),
      classifiedModel: stages.categorized.length, unclassifiedReviewCandidates: uncertainGeometry.length,
      adapterResponse: stages.adapterResponse.length, normalizedBatch: stages.normalizedWalls.length,
      canonicalAccepted: stages.canonicalWalls.length },
    scores: {
      detectorCandidates: { recall: detectorCandidateScore.recall, precision: detectorCandidateScore.precision, categoryAgreement: null,
        referenceWalls: detectorCandidateScore.referenceWalls, poorlyMatchedReferenceWalls: detectorCandidateScore.missingWalls.length,
        falseWalls: detectorCandidateScore.falseWalls.length, referenceLm: detectorCandidateScore.referenceLm, foundLm: detectorCandidateScore.foundLm,
        detectedLm: detectorCandidateScore.detectedLm, supportedLm: detectorCandidateScore.supportedLm,
        admittedToQuantities: false },
      accepted: { recall: acceptedGeometryScore.recall, precision: acceptedGeometryScore.precision, categoryAgreement: scores.vector.walls.categoryAgreement,
        referenceWalls: acceptedGeometryScore.referenceWalls, poorlyMatchedReferenceWalls: acceptedGeometryScore.missingWalls.length,
        falseWalls: acceptedGeometryScore.falseWalls.length, referenceLm: acceptedGeometryScore.referenceLm, foundLm: acceptedGeometryScore.foundLm,
        detectedLm: acceptedGeometryScore.detectedLm, supportedLm: acceptedGeometryScore.supportedLm, includesReviewCandidates: false },
      candidateGeometry: { recall: candidateScore.recall, precision: candidateScore.precision, categoryAgreement: null,
        referenceWalls: candidateScore.referenceWalls, poorlyMatchedReferenceWalls: candidateScore.missingWalls.length,
        falseWalls: candidateScore.falseWalls.length, referenceLm: candidateScore.referenceLm, foundLm: candidateScore.foundLm,
        detectedLm: candidateScore.detectedLm, supportedLm: candidateScore.supportedLm,
        includesReviewCandidates: true, admittedToQuantities: false },
      unclassifiedOnly: { recall: uncertainScore.recall, precision: uncertainScore.precision, categoryAgreement: null,
        candidateWalls: uncertainGeometry.length, referenceLm: uncertainScore.referenceLm, foundLm: uncertainScore.foundLm,
        detectedLm: uncertainScore.detectedLm, supportedLm: uncertainScore.supportedLm, admittedToQuantities: false },
    },
    referenceWalls: perReferenceWall,
    poorlyMatchedReferenceWalls: perReferenceWall.filter((wall) => wall.finalAcceptedShare < 0.5),
    detectorToModel: stages.detectorToModel,
    reviewCandidates: stages.measuredModel.filter((wall) => !['interior', 'exterior'].includes(wall.category)),
    connectedCandidateJunctions: connectedCandidateReading.junctions,
    unresolved: prepared.analysis.unresolved,
    review: prepared.analysis.review,
  };
  fs.writeFileSync(path.join(args.out, `page-${pageSpec.page}-application-reading.json`), JSON.stringify({
    admitted, reviewOnly: { openings: reviewOpeningReading, rooms: reviewRoomReading }, candidateScores,
    withheld: prepared.analysis.unresolved, review: prepared.analysis.review,
  }));
  fs.writeFileSync(path.join(args.out, `page-${pageSpec.page}-wall-stage-trace.json`), JSON.stringify(traceSummary, null, 2));
  fs.writeFileSync(path.join(args.out, `page-${pageSpec.page}-engine-geometry.json`), JSON.stringify({ engine: fused.geometry.engine, walls: fused.geometry.walls, openings: fused.geometry.openings,
    rooms: fused.geometry.rooms.map(({ id, polygon, areaM2, verified, partOf }) => ({ id, polygon, areaM2, verified, partOf })), junctions: fused.geometry.junctions }));
  report.pages.push({ page: pageSpec.page, level: pageSpec.level, engineMs, modelMs, engineVersion: fused.geometry.engine, vectorMs, vectorStats: vector.stats,
    application: { pixelsPerMm: applicationPpm, referencePixelsPerMm: ppm, calibrationErrorShare: Math.abs(applicationPpm / ppm - 1), input: applicationInput ? 'captured-browser' : 'node-reconstructed', unconfirmedGapBridges: 0,
      walls: admitted.walls.length, openings: admitted.openings.length, rooms: admitted.rooms.length,
      reviewWallCandidates: stages.measuredModel.filter((wall) => !['interior', 'exterior'].includes(wall.category)).length,
      reviewOpeningCandidates: reviewOpeningReading.length, reviewRoomCandidates: reviewRoomReading.length,
      reviewCandidateScores: candidateScores },
    candidateScores,
    wallTrace: { file: `page-${pageSpec.page}-wall-stage-trace.json`, stages: traceSummary.stages, accepted: traceSummary.scores.accepted,
      detectorCandidates: traceSummary.scores.detectorCandidates, candidateGeometry: traceSummary.scores.candidateGeometry,
      unclassifiedOnly: traceSummary.scores.unclassifiedOnly },
    model: { ...describeLevel(built.level), build: built.report }, vectorModel: { ...describeLevel(vectorBuilt.level), build: vectorBuilt.report }, scores });

  const P = (p) => [p.x * ppm * DRAW_SCALE, p.y * ppm * DRAW_SCALE];
  for (const name of ['engine', 'model', 'vector']) {
  const measuredP = name === 'vector' ? point => [point.x * applicationPpm * DRAW_SCALE, point.y * applicationPpm * DRAW_SCALE] : P;
  const { canvas, g } = await drawBase(page);
  for (const wall of referenceMm.walls) { g.strokeStyle = 'rgba(22,163,74,0.35)'; g.lineWidth = Math.max(4, wall.thicknessMm * ppm * DRAW_SCALE); g.beginPath(); g.moveTo(...P(wall.a)); g.lineTo(...P(wall.b)); g.stroke(); }
  for (const wall of readings[name].walls) { g.strokeStyle = wall.category === 'exterior' ? '#1d4ed8' : '#c026d3'; g.lineWidth = 2; g.beginPath(); wall.points.forEach((p, i) => (i ? g.lineTo(...measuredP(p)) : g.moveTo(...measuredP(p)))); g.stroke(); }
  for (const run of scores[name].walls.missed) { g.strokeStyle = 'rgba(220,38,38,0.85)'; g.lineWidth = 7; g.beginPath(); g.moveTo(...measuredP(run.a)); g.lineTo(...measuredP(run.b)); g.stroke(); }
  for (const run of scores[name].walls.extra) { g.strokeStyle = 'rgba(234,88,12,0.85)'; g.lineWidth = 7; g.beginPath(); g.moveTo(...measuredP(run.a)); g.lineTo(...measuredP(run.b)); g.stroke(); }
  for (const junction of scores[name].junctions.missed) { g.strokeStyle = '#dc2626'; g.lineWidth = 3; g.beginPath(); g.arc(...measuredP(junction), 12, 0, Math.PI * 2); g.stroke(); }
  for (const item of referenceMm.openings) { const [x, y] = P(item); g.strokeStyle = '#15803d'; g.lineWidth = 3; g.strokeRect(x - 9, y - 9, 18, 18); }
  for (const item of readings[name].openings) { const [x, y] = measuredP(item); g.strokeStyle = '#2563eb'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 8, y - 8); g.lineTo(x + 8, y + 8); g.moveTo(x + 8, y - 8); g.lineTo(x - 8, y + 8); g.stroke(); }
  legend(g, [['reference wall', 'rgba(22,163,74,0.6)'], [`${name} wall: external / internal`, '#1d4ed8'], ['reference wall the model missed', '#dc2626'], ['model wall not in the reference', '#ea580c'], ['opening: reference box, model cross', '#2563eb']]);
  fs.writeFileSync(path.join(args.out, `page-${pageSpec.page}-walls-${name}.png`), canvas.toBuffer('image/png'));
  }

  // Rooms overlays.
  for (const name of ['engine', 'model', 'vector']) {
    const measuredP = name === 'vector' ? point => [point.x * applicationPpm * DRAW_SCALE, point.y * applicationPpm * DRAW_SCALE] : P;
    const { canvas: roomCanvas, g: rg } = await drawBase(page);
    const rows = scores[name].rooms.rows;
    const iouOf = new Map();
    for (const row of rows) if (row.detectedId) iouOf.set(row.detectedId, Math.max(iouOf.get(row.detectedId) || 0, row.iou));
    for (const room of readings[name].rooms) {
      const iou = iouOf.get(room.id) || 0;
      rg.fillStyle = iou >= 0.9 ? 'rgba(34,197,94,0.30)' : iou >= 0.5 ? 'rgba(245,158,11,0.30)' : 'rgba(239,68,68,0.25)';
      rg.strokeStyle = 'rgba(55,65,81,0.9)'; rg.lineWidth = 2;
      rg.beginPath(); room.polygon.forEach((p, i) => (i ? rg.lineTo(...measuredP(p)) : rg.moveTo(...measuredP(p)))); rg.closePath(); rg.fill(); rg.stroke();
    }
    rg.setLineDash([14, 8]);
    for (const room of referenceMm.rooms) { rg.strokeStyle = '#15803d'; rg.lineWidth = 3; rg.beginPath(); room.polygon.forEach((p, i) => (i ? rg.lineTo(...P(p)) : rg.moveTo(...P(p)))); rg.closePath(); rg.stroke(); }
    rg.setLineDash([]);
    rg.font = '24px ReportFont';
    for (const row of rows) {
      const room = referenceMm.rooms.find((item) => item.id === row.id);
      const c = room.polygon.reduce((s, p) => ({ x: s.x + p.x / room.polygon.length, y: s.y + p.y / room.polygon.length }), { x: 0, y: 0 });
      const [x, y] = P(c);
      const text = `${row.name}: IoU ${row.iou.toFixed(2)}${row.areaError === null ? '' : `, area ${row.areaError >= 0 ? '+' : ''}${(100 * row.areaError).toFixed(1)}%`}`;
      rg.fillStyle = 'rgba(255,255,255,0.85)'; rg.fillRect(x - 6, y - 24, rg.measureText(text).width + 12, 32);
      rg.fillStyle = '#111'; rg.fillText(text, x, y);
    }
    legend(rg, [[`${name}: room overlap >= 0.9`, 'rgba(34,197,94,0.6)'], ['overlap 0.5 - 0.9', 'rgba(245,158,11,0.6)'], ['overlap below 0.5', 'rgba(239,68,68,0.6)'], ['reference room (dashed)', '#15803d']]);
    fs.writeFileSync(path.join(args.out, `page-${pageSpec.page}-rooms-${name}.png`), roomCanvas.toBuffer('image/png'));
  }
  if (reviewRoomReading.length) {
    const { canvas: candidateCanvas, g: cg } = await drawBase(page);
    const candidateP = point => [point.x * applicationPpm * DRAW_SCALE, point.y * applicationPpm * DRAW_SCALE];
    for (const room of reviewRoomReading) {
      cg.fillStyle = 'rgba(217, 119, 6, 0.10)'; cg.strokeStyle = '#d97706'; cg.lineWidth = 3; cg.setLineDash([12, 8]);
      cg.beginPath(); room.polygon.forEach((point, index) => (index ? cg.lineTo(...candidateP(point)) : cg.moveTo(...candidateP(point)))); cg.closePath(); cg.fill(); cg.stroke();
      cg.setLineDash([]);
    }
    for (const room of referenceMm.rooms) {
      cg.strokeStyle = '#15803d'; cg.lineWidth = 3; cg.setLineDash([14, 8]); cg.beginPath();
      room.polygon.forEach((point, index) => (index ? cg.lineTo(...P(point)) : cg.moveTo(...P(point)))); cg.closePath(); cg.stroke(); cg.setLineDash([]);
    }
    legend(cg, [['review-only room candidate (not quantified)', 'rgba(217,119,6,0.35)'], ['reference room (scoring only)', '#15803d']]);
    fs.writeFileSync(path.join(args.out, `page-${pageSpec.page}-rooms-review-candidates.png`), candidateCanvas.toBuffer('image/png'));
  }
  if (reviewOpeningReading.length) {
    const { canvas: candidateCanvas, g: cg } = await drawBase(page);
    const candidateP = point => [point.x * applicationPpm * DRAW_SCALE, point.y * applicationPpm * DRAW_SCALE];
    for (const opening of applicationReference.openings) {
      const [x, y] = P(opening); cg.strokeStyle = '#15803d'; cg.lineWidth = 3; cg.strokeRect(x - 9, y - 9, 18, 18);
    }
    for (const opening of admitted.openings) {
      const [x, y] = candidateP(opening); cg.strokeStyle = '#2563eb'; cg.lineWidth = 3; cg.beginPath(); cg.moveTo(x - 8, y - 8); cg.lineTo(x + 8, y + 8); cg.moveTo(x + 8, y - 8); cg.lineTo(x - 8, y + 8); cg.stroke();
    }
    for (const opening of reviewOpeningReading) {
      const [x, y] = candidateP(opening); cg.strokeStyle = '#d97706'; cg.lineWidth = 3; cg.beginPath(); cg.arc(x, y, 10, 0, Math.PI * 2); cg.stroke();
    }
    legend(cg, [['reference opening', '#15803d'], ['accepted opening', '#2563eb'], ['review-only host uncertain', '#d97706']]);
    fs.writeFileSync(path.join(args.out, `page-${pageSpec.page}-openings-review-candidates.png`), candidateCanvas.toBuffer('image/png'));
  }
}

// Markdown summary.
const md = [`# Plan accuracy: ${report.plan}`, '', `Reference: ${path.basename(args.reference)}. Generated ${report.generated}. No provider called. PDF text: ${'no-pdf-text' in args ? 'withheld' : 'read as in the app'}. Detector overrides: ${JSON.stringify(vectorOverrides)}.`, ''];
for (const pageReport of report.pages) {
  md.push(`## Page ${pageReport.page} (${pageReport.level})`, '', `Application input: ${pageReport.application.input}; calibration ${pageReport.application.pixelsPerMm} px/mm; calibration difference ${(100 * pageReport.application.calibrationErrorShare).toFixed(2)}%; unconfirmed gap bridges: 0.`, '', '| Measure | Engine today | Engine + plan model | Application Admitted Geometry |', '|---|---|---|---|');
  const e = pageReport.scores.engine, m = pageReport.scores.model, v = pageReport.scores.vector;
  const row = (label, cell) => md.push(`| ${label} | ${cell(e)} | ${cell(m)} | ${cell(v)} |`);
  const lm = (list) => num(list.reduce((t, w) => t + w.lengthMm, 0) / 1000);
  row('Wall recall: reference wall length found', (x) => `${pct(x.walls.recall)} of ${num(x.walls.referenceLm)} lm`);
  row('Wall precision: read wall length on a reference wall', (x) => `${pct(x.walls.precision)} of ${num(x.walls.detectedLm)} lm`);
  row('Missing walls (reference walls under half found)', (x) => `${x.walls.missingWalls.length} of ${x.walls.referenceWalls} (${lm(x.walls.missingWalls)} lm)`);
  row('False walls (read walls under half on a reference wall)', (x) => `${x.walls.falseWalls.length} of ${x.walls.readWalls} (${lm(x.walls.falseWalls)} lm)`);
  row('Centreline offset, median', (x) => `${num(x.walls.centrelineOffsetMedianMm)} mm`);
  row('Thickness error, median', (x) => `${num(x.walls.thicknessErrorMedianMm)} mm`);
  row('External/internal agreement (by length)', (x) => pct(x.walls.categoryAgreement));
  row('Reference junctions found (within 150 mm)', (x) => `${x.junctions.found} / ${x.junctions.reference} (${pct(x.junctions.share)})`);
  row('Junction position error, median', (x) => `${num(x.junctions.errorMedianMm)} mm`);
  row('Opening recall (within 400 mm)', (x) => `${x.openings.matched} / ${x.openings.reference} (${pct(x.openings.recall)})`);
  row('Opening precision', (x) => `${pct(x.openings.precision)} of ${x.openings.detected} read`);
  row('Opening type agreement (door / window / opening)', (x) => pct(x.openings.kindAgreement));
  row('Opening width error, median', (x) => pct(x.openings.widthErrorMedian));
  row('Rooms recognised (overlap >= 0.5)', (x) => `${x.rooms.matched} / ${x.rooms.reference}`);
  row('Room overlap, median', (x) => num(x.rooms.iouMedian, 3));
  row('Matched room area error, median', (x) => pct(x.rooms.areaErrorMedianAbs));
  const trace = pageReport.wallTrace;
  md.push('', '### Wall Geometry and Classification', '', '| Score set | Recall | Precision | Classification | Poorly matched reference walls | Quantity eligible |', '|---|---:|---:|---:|---:|---|',
    `| Detector candidates | ${pct(trace.detectorCandidates.recall)} | ${pct(trace.detectorCandidates.precision)} | Not scored | ${trace.detectorCandidates.poorlyMatchedReferenceWalls} | No |`,
    `| Connected-model measured candidates | ${pct(trace.candidateGeometry.recall)} | ${pct(trace.candidateGeometry.precision)} | Not scored | ${trace.candidateGeometry.poorlyMatchedReferenceWalls} | No |`,
    `| Unclassified review candidates only | ${pct(trace.unclassifiedOnly.recall)} | ${pct(trace.unclassifiedOnly.precision)} | Not scored | - | No |`,
    `| Canonical accepted walls | ${pct(trace.accepted.recall)} | ${pct(trace.accepted.precision)} | ${pct(trace.accepted.categoryAgreement)} | ${trace.accepted.poorlyMatchedReferenceWalls} | Yes |`,
    '', `Pipeline counts: detector ${trace.stages.detectorAccepted} accepted / ${trace.stages.detectorRejected} rejected; ${trace.stages.measuredInserted} measured walls inserted and ${trace.stages.measuredMergedOrCovered} merged/covered; ${trace.stages.bridgeInserted} confirmed-opening bridge spans inserted and ${trace.stages.bridgeMergedOrCovered} covered; connected model ${trace.stages.connectedModel} measured walls; ${trace.stages.classifiedModel} classified and ${trace.stages.unclassifiedReviewCandidates} review-only; adapter ${trace.stages.adapterResponse}; normalized ${trace.stages.normalizedBatch}; canonical ${trace.stages.canonicalAccepted}.`,
    `Per-reference-wall stage trace, merge keys, and nearby detector rejection reasons: [page-${pageReport.page}-wall-stage-trace.json](page-${pageReport.page}-wall-stage-trace.json).`,
    'Nearby rejected-candidate explanations use a 750 mm diagnostic search only; they do not change wall/opening/room score tolerances.',
    'Review candidates are never included in canonical wall quantities or accepted-wall accuracy.');
  md.push('', '| Room | Reference m² | Engine IoU / m² | Engine + model IoU / m² | Application Admitted IoU / m² |', '|---|---|---|---|---|');
  const cell = (r) => `${r.iou.toFixed(2)} / ${r.detectedM2 === null ? '-' : r.detectedM2.toFixed(2)}`;
  e.rooms.rows.forEach((row, index) => md.push(`| ${row.name} | ${row.referenceM2.toFixed(2)} | ${cell(row)} | ${cell(m.rooms.rows[index])} | ${cell(v.rooms.rows[index])} |`));
  md.push('', '### Review-Only Openings and Rooms', '', '| Candidate set | Matched | Reference count | Candidate count | Precision | Quantity eligible |', '|---|---:|---:|---:|---:|---|',
    `| Accepted openings only | ${v.openings.matched} | ${v.openings.reference} | ${v.openings.detected} | ${pct(v.openings.precision)} | Yes |`,
    `| Accepted + review-only opening candidates | ${pageReport.candidateScores.openings.matched} | ${pageReport.candidateScores.openings.reference} | ${pageReport.candidateScores.openings.detected} | ${pct(pageReport.candidateScores.openings.precision)} | No, candidate score only |`,
    `| Review-only opening candidates only | ${pageReport.candidateScores.reviewOpeningOnly.matched} | ${pageReport.candidateScores.reviewOpeningOnly.reference} | ${pageReport.candidateScores.reviewOpeningOnly.detected} | ${pct(pageReport.candidateScores.reviewOpeningOnly.precision)} | No |`,
    `| Accepted room boundaries only | ${v.rooms.matched} | ${v.rooms.reference} | ${v.rooms.detected} | ${pct(v.rooms.detected ? v.rooms.matched / v.rooms.detected : null)} | Yes |`,
    `| Accepted + review-only room candidates | ${pageReport.candidateScores.rooms.matched} | ${pageReport.candidateScores.rooms.reference} | ${pageReport.candidateScores.rooms.detected} | ${pct(pageReport.candidateScores.rooms.detected ? pageReport.candidateScores.rooms.matched / pageReport.candidateScores.rooms.detected : null)} | No, candidate score only |`,
    `| Review-only room candidates only | ${pageReport.candidateScores.reviewRoomOnly.matched} | ${pageReport.candidateScores.reviewRoomOnly.reference} | ${pageReport.candidateScores.reviewRoomOnly.detected} | ${pct(pageReport.candidateScores.reviewRoomOnly.detected ? pageReport.candidateScores.reviewRoomOnly.matched / pageReport.candidateScores.reviewRoomOnly.detected : null)} | No |`,
    '', 'Candidate-only scores never flow into Job Setup or quotation quantities.');
  md.push('', '### Junction Geometry', '', '| Junction set | Found / reference | Median location error |', '|---|---:|---:|',
    `| Canonical accepted walls | ${v.junctions.found} / ${v.junctions.reference} | ${num(v.junctions.errorMedianMm)} mm |`,
    `| Connected measured candidates + confirmed opening bridges | ${pageReport.candidateScores.junctions.found} / ${pageReport.candidateScores.junctions.reference} | ${num(pageReport.candidateScores.junctions.errorMedianMm)} mm |`,
    '', 'Candidate junctions include review-only wall geometry and are not quantity acceptance. The 150 mm junction match radius is unchanged.');
  md.push('', `Model: ${pageReport.model.walls} walls, ${pageReport.model.nodes} nodes, ${pageReport.model.freeEnds} free wall ends of ${pageReport.model.wallEnds}, ${pageReport.model.rooms} rooms, ${pageReport.model.build.bridges} confirmed gaps bridged. Engine ${pageReport.engineMs} ms, model ${pageReport.modelMs} ms.`, '',
    `Vector detection: directions ${pageReport.vectorStats.directionsDeg.join(', ')} deg, wall thicknesses learnt ${pageReport.vectorStats.thicknessModesMm.join(', ')} mm, ${pageReport.vectorStats.candidates} candidates, ${pageReport.vectorStats.accepted} walls kept, ${pageReport.vectorStats.rejected} rejected; plan model ${pageReport.vectorModel.walls} walls, ${pageReport.vectorModel.freeEnds} free ends, ${pageReport.vectorModel.rooms} rooms. ${pageReport.vectorMs} ms.`, '');
}
fs.writeFileSync(path.join(args.out, 'report.md'), md.join('\n'));
fs.writeFileSync(path.join(args.out, 'report.json'), JSON.stringify(report, (key, value) => (typeof value === 'number' ? Math.round(value * 1000) / 1000 : value), 2));
console.log(md.join('\n'));
