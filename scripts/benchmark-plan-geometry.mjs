// Real-plan benchmark for the geometry engine: runs it on a saved takeoff's own floor-plan sheets
// and compares the result with what the estimator traced by hand on those sheets. No provider is
// called. Room names come only from label positions already saved with the takeoff.
//
//   node scripts/benchmark-plan-geometry.mjs --job <decoded-takeoff.json> --assets <plan-pages dir> --out <dir>
//
// --job     JSON holding { job: <ai-plan-takeoff job> } (same file run-ai-takeoff-plan-set.mjs reads)
// --assets  the plan page images saved as data-URL text files (matched by byte size)
// --out     directory for report.json, geometry-<sheet>.json and overlay-<sheet>.png
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { detectPlanGeometry, pointInPolygon } from '../components/construction-estimation/ai-plan-takeoff/geometry/planGeometry.js';
import { polygonIntersectionOverUnion } from '../components/construction-estimation/ai-plan-takeoff/geometry/roomReferenceMetrics.js';
import { fuseSheetLinework } from '../components/construction-estimation/ai-plan-takeoff/geometry/lineworkFusion.js';

const args = Object.fromEntries(process.argv.slice(2).map((arg, index, all) => (arg.startsWith('--') ? [arg.slice(2), all[index + 1]] : null)).filter(Boolean));
if (!args.job || !args.out) { console.error('Usage: --job <decoded-takeoff.json|job.gr8job> [--assets <plan-pages dir>] [--room-references <manual.json>] --out <dir>'); process.exit(2); }
const { job: jobPath, assets: assetsDir, out: outDir } = args;
fs.mkdirSync(outDir, { recursive: true });
const geometryOptions = Object.fromEntries(Object.entries({
  'ink-threshold': 'inkThreshold', 'min-wall-mm': 'minWallMm', 'face-run-mm': 'faceRunMm',
  'nib-run-mm': 'nibRunMm', 'jamb-return-run-mm': 'jambReturnRunMm', 'max-line-px': 'maxLinePx', 'isolated-run-mm': 'isolatedRunMm',
  'single-face-review-run-mm': 'singleFaceReviewRunMm', 'single-face-anchor-reach-mm': 'singleFaceAnchorReachMm',
  'single-face-thickness-agreement-mm': 'singleFaceThicknessAgreementMm', 'single-face-junction-reach-mm': 'singleFaceJunctionReachMm',
}).flatMap(([argument, option]) => Number.isFinite(Number(args[argument])) ? [[option, Number(args[argument])]] : []));
const comparisonToleranceMm = Number.isFinite(Number(args['comparison-tolerance-mm'])) && Number(args['comparison-tolerance-mm']) > 0
  ? Number(args['comparison-tolerance-mm']) : 300;
let job;
if (path.extname(jobPath).toLowerCase() === '.gr8job') {
  const archive = await JSZip.loadAsync(fs.readFileSync(jobPath));
  const takeoffFile = archive.file('takeoff.json');
  if (!takeoffFile) throw new Error('Job package has no takeoff.json section.');
  const takeoff = JSON.parse(await takeoffFile.async('text'));
  job = takeoff.aiPlanTakeoffJob || takeoff.takeoff?.aiPlanTakeoffJob;
} else job = JSON.parse(fs.readFileSync(jobPath, 'utf8')).job;
if (!job?.plan?.pages?.length) throw new Error('No saved plan pages were found in the takeoff.');
const assets = assetsDir ? fs.readdirSync(assetsDir).map((name) => ({ file: path.join(assetsDir, name), size: fs.statSync(path.join(assetsDir, name)).size })) : [];
const isAi = (item) => item?.source === 'ai' || String(item?.id || '').startsWith('ai:');
const ppm = job.pixelsPerMm;
const roomReferenceSet = args['room-references'] ? JSON.parse(fs.readFileSync(args['room-references'], 'utf8')) : null;
if (roomReferenceSet && (roomReferenceSet.schemaVersion !== 'ai-takeoff-room-reference.v1'
  || roomReferenceSet.source?.method !== 'manual-original-plan'
  || roomReferenceSet.source?.tracedIndependentlyOfAi !== true
  || roomReferenceSet.coordinateSpace !== 'logical-plan-pixels'
  || !Array.isArray(roomReferenceSet.pages) || !Array.isArray(roomReferenceSet.rooms))) {
  throw new Error('Room references must be manually traced from the original plans in logical-plan-pixels using ai-takeoff-room-reference.v1.');
}
const report = { job: job.jobName, pixelsPerMm: ppm, geometryOptions,
  geometryInputs: { openingEvidence: args.evidence === 'none' ? 'none: linework only' : 'manual opening positions from the recovered takeoff; room closure assumes correctly localized openings' }, sheets: [] };

const polygonArea = (polygon) => Math.abs(polygon.reduce((sum, point, index) => {
  const next = polygon[(index + 1) % polygon.length];
  return sum + point.x * next.y - next.x * point.y;
}, 0)) / 2;
const polygonBounds = (polygon) => ({ minX: Math.min(...polygon.map((point) => point.x)), maxX: Math.max(...polygon.map((point) => point.x)),
  minY: Math.min(...polygon.map((point) => point.y)), maxY: Math.max(...polygon.map((point) => point.y)) });
function compareRoomReferences(pageNumber, level, detectedRooms) {
  const references = roomReferenceSet?.rooms.filter((room) => Number(room.page) === pageNumber) || [];
  if (!references.length) return { status: 'not-assessable: no independently hand-traced reference polygons for this sheet' };
  const pageReference = roomReferenceSet.pages.find((page) => Number(page.page) === pageNumber);
  const planPage = job.plan.pages.find((page) => Number(page.pageNumber) === pageNumber);
  if (!pageReference || pageReference.level !== level || pageReference.logicalWidth !== planPage.logicalWidth
    || pageReference.logicalHeight !== planPage.logicalHeight || pageReference.pixelsPerMm !== ppm) {
    throw new Error(`Room reference metadata does not match sheet ${pageNumber}'s level, dimensions or confirmed calibration.`);
  }
  for (const reference of references) {
    if (!reference.id || !reference.name || reference.level !== level || !Array.isArray(reference.polygon) || reference.polygon.length < 3
      || reference.polygon.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
      throw new Error(`Invalid manual room reference on sheet ${pageNumber}; each needs id, name, matching level and a finite polygon.`);
    }
  }
  const pairs = references.flatMap((reference, referenceIndex) => detectedRooms.map((room, roomIndex) => {
    const comparison = polygonIntersectionOverUnion(reference.polygon, room.polygon, ppm);
    return { referenceIndex, roomIndex, iou: comparison.iou, sampleStepMm: comparison.sampleStepMm };
  })).sort((a, b) => b.iou - a.iou);
  const usedReferences = new Set(), usedRooms = new Set(), matches = [];
  for (const pair of pairs) {
    if (usedReferences.has(pair.referenceIndex) || usedRooms.has(pair.roomIndex)) continue;
    usedReferences.add(pair.referenceIndex); usedRooms.add(pair.roomIndex);
    const reference = references[pair.referenceIndex], detected = detectedRooms[pair.roomIndex];
    const referenceAreaM2 = polygonArea(reference.polygon) / (ppm * ppm) / 1e6;
    const areaDifferenceM2 = detected.areaM2 - referenceAreaM2;
    matches.push({ referenceRoomId: reference.id, name: reference.name, level: reference.level, page: pageNumber,
      detectedRoomId: detected.id, iou: +pair.iou.toFixed(3), sampleStepMm: pair.sampleStepMm,
      referenceAreaM2: +referenceAreaM2.toFixed(2), detectedAreaM2: +detected.areaM2.toFixed(2),
      areaDifferenceM2: +areaDifferenceM2.toFixed(2), areaErrorPercent: referenceAreaM2 ? +(areaDifferenceM2 / referenceAreaM2 * 100).toFixed(1) : null,
      detectedReviewRequired: Boolean(detected.reviewRequired) });
  }
  return { status: 'compared', matching: 'greedy one-to-one maximum-IoU pairing; IDs and names remain the human reference values',
    references: references.length, detected: detectedRooms.length, matched: matches.filter((item) => item.iou >= 0.5).length,
    meanIoU: matches.length ? +(matches.reduce((sum, item) => sum + item.iou, 0) / matches.length).toFixed(3) : null,
    rooms: matches.sort((a, b) => a.name.localeCompare(b.name)) };
}

for (const [pageKey, level] of Object.entries(job.sheetLevels || {})) {
  const pageNumber = Number(pageKey);
  const page = job.plan.pages.find((item) => item.pageNumber === pageNumber);
  const asset = assets.find((item) => item.size === page.dataUrlBytes);
  const text = page.dataUrl?.startsWith('data:') ? page.dataUrl : asset ? fs.readFileSync(asset.file, 'utf8') : null;
  if (!text) throw new Error(`No embedded plan image or matching asset for sheet ${pageNumber}.`);
  const image = await loadImage(Buffer.from(text.slice(text.indexOf(',') + 1), 'base64'));
  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext('2d');
  context.fillStyle = '#fff'; context.fillRect(0, 0, image.width, image.height); context.drawImage(image, 0, 0);
  const raster = context.getImageData(0, 0, image.width, image.height);
  const started = Date.now();
  const manualOpenings = (job.placedOpenings || []).filter((item) => !isAi(item) && Number(item.page) === pageNumber);
  const result = detectPlanGeometry(raster, { pixelsPerMm: ppm, logicalWidth: page.logicalWidth, logicalHeight: page.logicalHeight,
    openingEvidence: args.evidence === 'none' ? [] : manualOpenings.filter((item) => Number.isFinite(item.x) && Number.isFinite(item.y)).map((item) => ({ x: item.x, y: item.y, ref: String(item.id) })) }, geometryOptions);
  const manualFootprints = (job.completedFloorplans || []).filter((item) => !isAi(item) && item.type === 'Footprint' && Number(item.page) === pageNumber);
  const footprintFusion = fuseSheetLinework({ page: pageNumber, walls: [], openings: [], rooms: [] }, raster,
    { pageNumber, logicalWidth: page.logicalWidth, logicalHeight: page.logicalHeight, pixelsPerMm: ppm },
    { placedOpenings: manualOpenings, completedFloorplans: manualFootprints }, { geometry: geometryOptions });
  const ms = Date.now() - started;
  const { wall, bridge, width, height } = result.debug;
  const s = width / page.logicalWidth;
  const k = result.rasterPixelsPerMm;
  const manualWalls = (job.completedWallRuns || []).filter((item) => !isAi(item) && Number(item.page) === pageNumber);

  // Compare aligned wall runs, not merely nearby pixels: an intersecting wall is not support.
  const angleDifference = (a, b) => {
    const difference = Math.abs(Math.atan2(a.b.y - a.a.y, a.b.x - a.a.x) - Math.atan2(b.b.y - b.a.y, b.b.x - b.a.x)) % Math.PI;
    return Math.min(difference, Math.PI - difference);
  };
  const projectDistance = (point, a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
    const t = length ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length)) : 0;
    return Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy);
  };
  const alignedCoverage = (segment, candidates, toleranceMm = comparisonToleranceMm) => {
    const lengthMm = Math.hypot(segment.b.x - segment.a.x, segment.b.y - segment.a.y) / ppm;
    const parts = Math.max(1, Math.round(lengthMm / 100));
    let hit = 0;
    for (let part = 0; part <= parts; part += 1) {
      const point = { x: segment.a.x + (segment.b.x - segment.a.x) * part / parts, y: segment.a.y + (segment.b.y - segment.a.y) * part / parts };
      if (candidates.some((candidate) => angleDifference(segment, candidate) < 0.35
        && projectDistance(point, candidate.a, candidate.b) <= toleranceMm * ppm)) hit += 1;
    }
    return hit / (parts + 1);
  };
  const detectedSegments = result.walls.map((item) => ({ a: item.nodes[0], b: item.nodes[1] }));
  const coverage = {};
  const missed = [];
  for (const item of manualWalls) {
    const bucket = coverage[item.category] ||= { tracedLm: 0, coveredLm: 0 };
    for (let i = 1; i < item.nodes.length; i += 1) {
      const a = item.nodes[i - 1], b = item.nodes[i];
      const lengthMm = Math.hypot(b.x - a.x, b.y - a.y) / ppm;
      const share = alignedCoverage({ a, b }, detectedSegments);
      bucket.tracedLm += lengthMm / 1000; bucket.coveredLm += lengthMm / 1000 * share;
      if (share < 0.6 && lengthMm > 300) missed.push({ category: item.category, lengthM: +(lengthMm / 1000).toFixed(2), covered: +share.toFixed(2), from: a, to: b });
    }
  }
  // The same comparison, counting only detected walls the engine gave the same category.
  const categoryCoverage = {};
  for (const item of manualWalls) {
    const bucket = categoryCoverage[item.category] ||= { tracedLm: 0, coveredLm: 0 };
    const same = result.walls.filter((wall) => wall.category === item.category).map((wall) => ({ a: wall.nodes[0], b: wall.nodes[1] }));
    for (let i = 1; i < item.nodes.length; i += 1) {
      const a = item.nodes[i - 1], b = item.nodes[i];
      const lengthMm = Math.hypot(b.x - a.x, b.y - a.y) / ppm;
      bucket.tracedLm += lengthMm / 1000; bucket.coveredLm += lengthMm / 1000 * alignedCoverage({ a, b }, same);
    }
  }
  for (const bucket of Object.values(categoryCoverage)) { bucket.share = +(bucket.coveredLm / bucket.tracedLm).toFixed(3); bucket.tracedLm = +bucket.tracedLm.toFixed(1); bucket.coveredLm = +bucket.coveredLm.toFixed(1); }
  for (const bucket of Object.values(coverage)) { bucket.share = +(bucket.coveredLm / bucket.tracedLm).toFixed(3); bucket.tracedLm = +bucket.tracedLm.toFixed(1); bucket.coveredLm = +bucket.coveredLm.toFixed(1); }

  const manualSegments = manualWalls.flatMap((item) => item.nodes.slice(1).map((end, index) => ({ a: item.nodes[index], b: end })));
  const detectedWallLengthMm = result.walls.reduce((sum, item) => sum + item.lengthMm, 0);
  const unsupportedSegments = [];
  let manualSupportedWallLengthMm = 0;
  for (const item of result.walls) {
    const [a, b] = item.nodes;
    const lengthMm = Math.hypot(b.x - a.x, b.y - a.y) / ppm;
    const parts = Math.max(1, Math.round(lengthMm / 100));
    let supported = 0;
    for (let part = 0; part <= parts; part += 1) {
      const point = { x: a.x + (b.x - a.x) * part / parts, y: a.y + (b.y - a.y) * part / parts };
      if (manualSegments.some((segment) => angleDifference({ a, b }, segment) < 0.35
        && projectDistance(point, segment.a, segment.b) <= comparisonToleranceMm * ppm)) supported += 1;
    }
    const supportShare = supported / (parts + 1);
    manualSupportedWallLengthMm += lengthMm * supportShare;
    if (supportShare < 0.6) unsupportedSegments.push({ id: item.id, lengthLm: +(lengthMm / 1000).toFixed(2), manualSupport: +supportShare.toFixed(2),
      measuredThicknessMm: item.measuredThicknessMm, axis: item.axis, nodes: item.nodes });
  }
  const unsupportedByManualLm = Math.max(0, detectedWallLengthMm - manualSupportedWallLengthMm) / 1000;

  // Each detected room named by the takeoff's own evidence: the saved AI room labels (position
  // only) and the estimator's floorplan polygons.
  const labels = (job.scheduleState?.aiAnalysis?.rooms || []).filter((room) => Number(room.page) === pageNumber && Number.isFinite(room.x));
  const rooms = result.rooms.map((room) => ({
    id: room.id, areaM2: +room.areaM2.toFixed(2), netAreaM2: +room.netAreaM2.toFixed(2), perimeterM: +room.perimeterM.toFixed(2), vertices: room.polygon.length,
    labels: labels.filter((label) => pointInPolygon({ x: label.x * page.logicalWidth, y: label.y * page.logicalHeight }, room.polygon)).map((label) => label.name),
    ...(room.reviewRequired ? { review: room.reviewReason } : {}),
  }));
  const roomReferenceComparison = compareRoomReferences(pageNumber, level, result.rooms);
  const manualAreas = (job.completedFloorplans || []).filter((item) => Number(item.page) === pageNumber).map((item) => ({
    type: item.type, label: item.label,
    areaM2: +(Math.abs(item.nodes.reduce((sum, p, i) => { const q = item.nodes[(i + 1) % item.nodes.length]; return sum + p.x * q.y - q.x * p.y; }, 0)) / 2 / ppm / ppm / 1e6).toFixed(2),
  }));
  const openingPairs = manualOpenings.flatMap((item, index) => result.openings.map((gap, gapIndex) => ({ item, index, gap, gapIndex,
    distanceMm: Math.hypot(gap.x - item.x, gap.y - item.y) / ppm }))).filter((pair) => pair.distanceMm < 700).sort((a, b) => a.distanceMm - b.distanceMm);
  const matchedManual = new Set(), matchedGaps = new Set(), openingMatches = [];
  for (const pair of openingPairs) {
    if (matchedManual.has(pair.index) || matchedGaps.has(pair.gapIndex)) continue;
    matchedManual.add(pair.index); matchedGaps.add(pair.gapIndex);
    openingMatches.push({ referenceIndex: pair.index, tag: pair.item.itemTag, type: pair.item.type, openingClass: pair.item.openingClass, widthMm: pair.item.widthMm, foundWidthMm: pair.gap.widthMm,
      positionErrorMm: Math.round(pair.distanceMm), widthErrorMm: Number(pair.item.widthMm) > 0 ? Math.abs(pair.gap.widthMm - pair.item.widthMm) : null });
  }
  const widthMatches = openingMatches.filter((item) => item.widthErrorMm !== null);
  const openingMatchesByReference = new Map(openingMatches.map((item) => [item.referenceIndex, item]));
  const unmatchedOpeningDiagnostics = manualOpenings.flatMap((item, index) => {
    if (openingMatchesByReference.has(index)) return [];
    const nearestGap = result.openings.map((gap) => ({ gap, distanceMm: Math.hypot(gap.x - item.x, gap.y - item.y) / ppm }))
      .sort((a, b) => a.distanceMm - b.distanceMm)[0];
    return [{ tag: item.itemTag, type: item.type, openingClass: item.openingClass, widthMm: item.widthMm,
      nearestDistanceMm: nearestGap ? Math.round(nearestGap.distanceMm) : null, nearestGapWidthMm: nearestGap?.gap.widthMm ?? null,
      nearestGapAxis: nearestGap?.gap.axis ?? null, nearestGapPosition: nearestGap ? { x: nearestGap.gap.x, y: nearestGap.gap.y } : null }];
  });
  const byOpeningClass = Object.fromEntries([...new Set(manualOpenings.map((item) => item.openingClass || item.type || 'Unclassified'))].map((openingClass) => {
    const indices = manualOpenings.flatMap((item, index) => (item.openingClass || item.type || 'Unclassified') === openingClass ? [index] : []);
    const matched = indices.map((index) => openingMatchesByReference.get(index)).filter(Boolean);
    return [openingClass, { manual: indices.length, matchedWithin700mm: matched.length, matchedWithin200mm: matched.filter((item) => item.positionErrorMm <= 200).length,
      matchedWithin350mm: matched.filter((item) => item.positionErrorMm <= 350).length }];
  }));
  const symbolCandidates = result.embeddedOpeningReviewCandidates || [];
  const symbolCandidatePairs = symbolCandidates.flatMap((candidate, candidateIndex) => manualOpenings.map((item, referenceIndex) => ({ candidate, candidateIndex, item, referenceIndex,
    distanceMm: Math.hypot(candidate.x - item.x, candidate.y - item.y) / ppm }))).filter((pair) => pair.distanceMm <= 700).sort((a, b) => a.distanceMm - b.distanceMm);
  const usedSymbolCandidates = new Set(), usedSymbolReferences = new Set(), symbolCandidateMatches = [];
  for (const pair of symbolCandidatePairs) {
    if (usedSymbolCandidates.has(pair.candidateIndex) || usedSymbolReferences.has(pair.referenceIndex)) continue;
    usedSymbolCandidates.add(pair.candidateIndex); usedSymbolReferences.add(pair.referenceIndex);
    symbolCandidateMatches.push({ tag: pair.item.itemTag, openingClass: pair.item.openingClass, referenceWidthMm: pair.item.widthMm,
      candidateWidthMm: pair.candidate.widthMm, positionErrorMm: Math.round(pair.distanceMm), hostWallId: pair.candidate.hostWallId,
      evidence: pair.candidate.evidence });
  }
  const positionErrors = openingMatches.map((item) => item.positionErrorMm).sort((a, b) => a - b);
  const percentile = (values, share) => values.length ? values[Math.min(values.length - 1, Math.ceil(values.length * share) - 1)] : null;
  const missingManualWallLengthLm = Object.fromEntries(Object.entries(coverage).map(([category, bucket]) => [category, +Math.max(0, bucket.tracedLm - bucket.coveredLm).toFixed(1)]));
  report.sheets.push({
    page: pageNumber, level, ms, diagnostics: result.diagnostics,
    walls: { detected: result.walls.length, detectedLm: +(detectedWallLengthMm / 1000).toFixed(1), unsupportedByManualLm: +unsupportedByManualLm.toFixed(1),
      comparisonToleranceMm, angleToleranceRad: 0.35,
      unsupportedSegments: unsupportedSegments.sort((a, b) => b.lengthLm - a.lengthLm).slice(0, 30),
      byThickness: result.walls.reduce((map, item) => ({ ...map, [item.thicknessMm]: +((map[item.thicknessMm] || 0) + item.lengthMm / 1000).toFixed(1) }), {}), flagged: result.walls.filter((item) => item.reviewRequired).length },
    singleFaceReviewCandidates: footprintFusion.report.singleFaceReviewCandidates.map((candidate) => ({ id: candidate.id, axis: candidate.axis,
      lengthLm: +(candidate.lengthMm / 1000).toFixed(2), endpointAnchorThicknessesMm: candidate.endpointAnchorThicknessesMm,
      endpointFaceSupport: candidate.endpointFaceSupport,
      footprintIds: candidate.footprintIds, nodes: candidate.nodes, reviewReason: candidate.reviewReason })),
    singleFaceCandidateChecks: result.debug.singleFaceDebug,
    manualWallCoverage: coverage, manualWallCoverageSameCategory: categoryCoverage, missingManualWallLengthLm,
    missedManualSegments: missed.length, missed: missed.slice(0, 12),
    rooms: { detected: rooms.length, labelled: rooms.filter((room) => room.labels.length).length, unlabelledLabels: labels.filter((label) => !result.rooms.some((room) => pointInPolygon({ x: label.x * page.logicalWidth, y: label.y * page.logicalHeight }, room.polygon))).map((label) => label.name), list: rooms },
    sumRoomAreaM2: +rooms.reduce((sum, room) => sum + room.areaM2, 0).toFixed(2), manualAreas,
    openings: { manual: manualOpenings.length, candidateGaps: result.openings.length, matched: openingMatches.length,
      unmatchedManual: manualOpenings.length - openingMatches.length, unmatchedCandidateGaps: result.openings.length - openingMatches.length,
      matchedWithin200mm: positionErrors.filter((value) => value <= 200).length,
      matchedWithin350mm: positionErrors.filter((value) => value <= 350).length,
      meanPositionErrorMm: positionErrors.length ? Math.round(positionErrors.reduce((sum, value) => sum + value, 0) / positionErrors.length) : null,
      medianPositionErrorMm: percentile(positionErrors, 0.5), p90PositionErrorMm: percentile(positionErrors, 0.9),
      widthWithin100mm: widthMatches.filter((item) => item.widthErrorMm <= 100).length,
      openingClassAccuracy: 'not assessed: raster geometry returns gap candidates, not door/window classification', byManualClass: byOpeningClass,
      unmatchedManualItems: unmatchedOpeningDiagnostics, list: openingMatches.map(({ referenceIndex, ...item }) => item) },
    embeddedFrameReview: { candidateCount: symbolCandidates.length, matchedManualWithin700mm: symbolCandidateMatches.length,
      candidates: symbolCandidates.map((candidate) => ({ id: candidate.id, x: candidate.x, y: candidate.y, widthMm: candidate.widthMm, hostWallId: candidate.hostWallId,
        symbolEvidence: candidate.symbolEvidence, reviewRequired: candidate.reviewRequired })), matches: symbolCandidateMatches },
    roomPolygonAccuracy: roomReferenceComparison,
  });

  // Overlay for visual checking: wall fabric red, closed openings green, rooms tinted.
  const overlay = context.getImageData(0, 0, width, height);
  const roomIds = new Map(result.rooms.map((room, index) => [room.id, index]));
  const tint = [[66, 133, 244], [251, 188, 5], [52, 168, 83], [171, 71, 188], [0, 172, 193], [255, 112, 67]];
  const labelsMap = result.debug.labels;
  const roomOfLabel = new Map();
  for (const room of result.rooms) {
    const cx = Math.round(room.centroid.x * s), cy = Math.round(room.centroid.y * s);
    // find the label id at any pixel of the polygon's centroid neighbourhood
    for (let r = 0; r < 200 && !roomOfLabel.has(room.id); r += 3) for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r]]) {
      const id = labelsMap[(cy + dy) * width + cx + dx];
      if (id && !wall[(cy + dy) * width + cx + dx] && pointInPolygon({ x: (cx + dx) / s, y: (cy + dy) / s }, room.polygon)) { roomOfLabel.set(room.id, id); break; }
    }
  }
  const colourOf = new Map([...roomOfLabel].map(([roomId, id]) => [id, tint[roomIds.get(roomId) % tint.length]]));
  for (let p = 0; p < width * height; p += 1) {
    const colour = wall[p] ? [220, 38, 38] : bridge[p] ? [22, 163, 74] : colourOf.get(labelsMap[p]);
    if (!colour) continue;
    const alpha = wall[p] || bridge[p] ? 0.55 : 0.28;
    for (let c = 0; c < 3; c += 1) overlay.data[p * 4 + c] = Math.round(overlay.data[p * 4 + c] * (1 - alpha) + colour[c] * alpha);
  }
  context.putImageData(overlay, 0, 0);
  context.strokeStyle = '#00a6a6'; context.lineWidth = Math.max(3, s * 1.4); context.lineCap = 'round';
  for (const wall of process.argv.includes('--plain-overlay') ? [] : manualWalls) {
    context.beginPath();
    wall.nodes.forEach((point, index) => index ? context.lineTo(point.x * s, point.y * s) : context.moveTo(point.x * s, point.y * s));
    context.stroke();
  }
  context.strokeStyle = '#1d4ed8'; context.lineWidth = 3;
  for (const room of result.rooms) { context.beginPath(); room.polygon.forEach((p, i) => (i ? context.lineTo(p.x * s, p.y * s) : context.moveTo(p.x * s, p.y * s))); context.closePath(); context.stroke(); }
  // Candidate openings: confirmed magenta, unconfirmed orange, drawn at their measured width.
  for (const opening of result.openings) {
    const half = opening.widthMm * ppm * s / 2;
    context.strokeStyle = opening.confirmed ? '#c026d3' : '#f97316'; context.lineWidth = opening.kind === 'wall-symbol' ? 7 : 4;
    context.beginPath();
    if (opening.axis === 'v') { context.moveTo(opening.x * s, opening.y * s - half); context.lineTo(opening.x * s, opening.y * s + half); }
    else { context.moveTo(opening.x * s - half, opening.y * s); context.lineTo(opening.x * s + half, opening.y * s); }
    context.stroke();
  }
  const b = result.debug.bounds;
  const crop = createCanvas(b.x1 - b.x0, b.y1 - b.y0);
  crop.getContext('2d').drawImage(canvas, b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0, 0, 0, b.x1 - b.x0, b.y1 - b.y0);
  fs.writeFileSync(path.join(outDir, `overlay-${pageNumber}.png`), crop.toBuffer('image/png'));
  const { debug, ...saved } = result;
  fs.writeFileSync(path.join(outDir, `geometry-${pageNumber}.json`), JSON.stringify(saved));
}
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 1));
for (const sheet of report.sheets) {
  console.log(`\nSheet ${sheet.page} (${sheet.level}) ${sheet.ms} ms`);
  console.log(' walls', JSON.stringify(sheet.walls));
  console.log(' manual wall coverage', JSON.stringify(sheet.manualWallCoverage), 'missed segments', sheet.missedManualSegments);
  console.log(' rooms', sheet.rooms.detected, 'labelled', sheet.rooms.labelled, 'labels outside any room:', sheet.rooms.unlabelledLabels.join(', '));
  for (const room of sheet.rooms.list) console.log(`   ${room.areaM2.toFixed(2).padStart(7)} m²  ${String(room.vertices).padStart(3)}v  ${room.labels.join(' + ') || '-'}${room.review ? `  [${room.review}]` : ''}`);
  console.log(' sum rooms', sheet.sumRoomAreaM2, 'manual areas', JSON.stringify(sheet.manualAreas));
  console.log(' openings', JSON.stringify({ ...sheet.openings, list: undefined }));
  console.log(' room polygons', sheet.roomPolygonAccuracy);
}
