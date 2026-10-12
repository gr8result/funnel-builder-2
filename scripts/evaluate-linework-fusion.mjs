// Deterministic evaluation of linework + plan-reading fusion on a saved takeoff: the saved provider
// responses are replayed (no provider call, no cost), fused with the sheet linework, passed through
// the real analysis contract, and compared with what the estimator traced by hand.
//
//   node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs \
//     scripts/evaluate-linework-fusion.mjs --job <decoded-takeoff.json> --assets <plan-pages dir> --responses <dir> --out <dir>
//
// --responses  directory written by run-ai-takeoff-plan-set.mjs (refine-<sheet>-geometry.json, ...).
// Exit code is 0 whenever the evaluation ran; it reports accuracy, it does not assert it.
import fs from 'node:fs';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { fuseSheetLinework } from '../components/construction-estimation/ai-plan-takeoff/geometry/lineworkFusion.js';
import { normalizePlanAnalysis } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/analysisContract.js';
import { restoreAnalysisCoordinates } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/analysisPages.js';
import { mergeMeasurementScopes } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/measurementScopes.js';
import { mergePlanEvidence, projectDefaultsFromJobSetup } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/planEvidence.js';
import { detectRoomBoundary } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/roomGeometry.js';
import { groupReviewItems, reviewAudience } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/reviewSummary.js';
import { convertAiTakeoffDetections } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/adapter.js';

const args = Object.fromEntries(process.argv.slice(2).map((arg, index, all) => (arg.startsWith('--') ? [arg.slice(2), all[index + 1]] : null)).filter(Boolean));
if (!args.job || !args.assets || !args.responses || !args.out) { console.error('Usage: --job <json> --assets <dir> --responses <dir> --out <dir>'); process.exit(2); }
fs.mkdirSync(args.out, { recursive: true });
const saved = JSON.parse(fs.readFileSync(args.job, 'utf8'));
const job = saved.job, ppm = job.pixelsPerMm;
const read = (name) => JSON.parse(fs.readFileSync(path.join(args.responses, name), 'utf8')).analysis;
const assets = fs.readdirSync(args.assets).map((name) => ({ file: path.join(args.assets, name), size: fs.statSync(path.join(args.assets, name)).size }));
const isAi = (item) => item?.source === 'ai' || String(item?.id || '').startsWith('ai:');
const inspections = Object.values(job.scheduleState?.aiInspections || {}).map((entry) => entry.analysis);
const pages = job.plan.pages.map(({ pageNumber, logicalWidth, logicalHeight }) => ({ pageNumber, logicalWidth, logicalHeight }));
const COLLECTIONS = ['completedWallRuns', 'placedOpenings', 'completedFloorplans', 'completedAreas', 'completedMeasurements', 'completedEaves', 'completedPillars'];
const manual = Object.fromEntries(COLLECTIONS.map((key) => [key, (job[key] || []).filter((item) => !isAi(item))]));

const segments = (walls) => walls.flatMap((wall) => wall.nodes.slice(1).map((end, index) => ({ a: wall.nodes[index], b: end })));
const distance = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy; const t = L ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L)) : 0; return Math.hypot(a.x + t * dx - p.x, a.y + t * dy - p.y); };
const lengthMm = (segment) => Math.hypot(segment.b.x - segment.a.x, segment.b.y - segment.a.y) / ppm;
const cover = (segment, pool, toleranceMm) => {
  const parts = Math.max(1, Math.round(lengthMm(segment) / 100)), angle = Math.atan2(segment.b.y - segment.a.y, segment.b.x - segment.a.x);
  let hit = 0;
  for (let i = 0; i <= parts; i += 1) {
    const point = { x: segment.a.x + (segment.b.x - segment.a.x) * i / parts, y: segment.a.y + (segment.b.y - segment.a.y) * i / parts };
    if (pool.some((other) => { const d = Math.abs(Math.atan2(other.b.y - other.a.y, other.b.x - other.a.x) - angle) % Math.PI; return Math.min(d, Math.PI - d) < 0.35 && distance(point, other.a, other.b) <= toleranceMm * ppm; })) hit += 1;
  }
  return hit / (parts + 1);
};
const lm = (list) => +(list.reduce((sum, item) => sum + lengthMm(item), 0) / 1000).toFixed(1);
const share = (list, pool, tolerance = 300) => (list.length ? +(list.reduce((sum, item) => sum + lengthMm(item) * cover(item, pool, tolerance), 0) / list.reduce((sum, item) => sum + lengthMm(item), 0)).toFixed(3) : null);
const family = (item) => (item.type === 'window' || item.openingClass === 'Window' || item.openingClass === 'Large Glazed/Stacker/Sliding Door' ? 'glazed' : item.openingClass);

const planEvidence = mergePlanEvidence(fs.readdirSync(args.responses).filter((name) => /^evidence-.*\.json$/.test(name)).map(read));
const projectDefaults = projectDefaultsFromJobSetup(saved.inputRows || {});
const sheets = Object.keys(job.sheetLevels || {}).map(Number).filter((page) => fs.existsSync(path.join(args.responses, `refine-${page}-geometry.json`)));
const plain = [], fused = [], fusionReports = {};
for (const pageNumber of sheets) {
  const rotation = inspections.find((item) => item.page === pageNumber)?.rotationToUpright || 0;
  const response = { ...restoreAnalysisCoordinates(mergeMeasurementScopes(read(`refine-${pageNumber}-geometry.json`), read(`refine-${pageNumber}-items.json`)), rotation), drawingType: 'floor_plan' };
  plain.push(response);
  const page = job.plan.pages.find((item) => item.pageNumber === pageNumber);
  const text = fs.readFileSync(assets.find((item) => item.size === page.dataUrlBytes).file, 'utf8');
  const image = await loadImage(Buffer.from(text.slice(text.indexOf(',') + 1), 'base64'));
  const canvas = createCanvas(image.width, image.height), context = canvas.getContext('2d');
  context.fillStyle = '#fff'; context.fillRect(0, 0, image.width, image.height); context.drawImage(image, 0, 0);
  const raster = context.getImageData(0, 0, image.width, image.height);
  const started = Date.now();
  const result = fuseSheetLinework(response, raster, { pageNumber, logicalWidth: page.logicalWidth, logicalHeight: page.logicalHeight, pixelsPerMm: ppm });
  fused.push(result.response);
  // Rooms exactly as the takeoff screen builds them from this sheet's fused reading.
  const roomList = (result.response.rooms || []).map((room, index) => detectRoomBoundary(room, { page: pageNumber, level: response.level, width: page.logicalWidth, height: page.logicalHeight, pixelsPerMm: ppm, walls: [], openings: [], raster: null }, index))
    .map((room) => ({ name: room.name, areaM2: room.areaM2 === null ? null : +room.areaM2.toFixed(2), corners: room.polygon?.length || 0, method: room.polygon?.length ? room.detectionMethod : 'no boundary',
      measured: Boolean(room.lineworkRoomId), verified: Boolean(room.lineworkVerified), review: room.reviewRequired ? room.reviewReasons : [], shared: room.sharedSpaceId ? true : undefined, id: room.id }));
  fusionReports[pageNumber] = { ms: Date.now() - started, ...result.report, review: undefined, reviewNotes: result.report.review, roomList };
}

function run(responses, existing) {
  const context = { jobId: String(job.masterJobId || job.jobId || job.takeoffId), takeoffId: String(job.takeoffId), documentHash: 'canvas-sha256:evaluation', pixelsPerMm: ppm, pages,
    completedWallRuns: existing.completedWallRuns, placedOpenings: existing.placedOpenings, completedFloorplans: existing.completedFloorplans, completedEaves: existing.completedEaves, sheetLevels: job.sheetLevels || {} };
  const { batch, analysis } = normalizePlanAnalysis({ context, responses: structuredClone(responses), runId: 'ai-takeoff-v1', modelVersion: 'saved-responses', planEvidence, projectDefaults });
  return { batch, analysis, canonical: convertAiTakeoffDetections(batch, context) };
}
const empty = Object.fromEntries(COLLECTIONS.map((key) => [key, []]));
function measure(label, responses) {
  const { analysis, canonical } = run(responses, empty);
  const out = { pipeline: label, sheets: {} };
  for (const pageNumber of sheets) {
    const level = job.sheetLevels[pageNumber];
    const traced = manual.completedWallRuns.filter((wall) => Number(wall.page) === pageNumber);
    const got = canonical.completedWallRuns.filter((wall) => wall.page === pageNumber);
    const all = segments(traced), gotAll = segments(got);
    const walls = {};
    for (const category of ['exterior', 'interior']) {
      const reference = segments(traced.filter((wall) => wall.category === category)), produced = segments(got.filter((wall) => wall.category === category));
      walls[category] = { tracedLm: lm(reference), producedLm: lm(produced), tracedFoundWithin300mm: share(reference, gotAll), tracedFoundWithin150mm: share(reference, gotAll, 150),
        producedNotOnAnyTraceLm: +(produced.reduce((sum, item) => sum + lengthMm(item) * (1 - cover(item, all, 300)), 0) / 1000).toFixed(1) };
    }
    // Openings: each hand-placed opening against the nearest produced opening of the same kind.
    const placedByHand = manual.placedOpenings.filter((item) => Number(item.page) === pageNumber);
    const produced = canonical.placedOpenings.filter((item) => item.page === pageNumber);
    const used = new Set();
    const matches = placedByHand.map((item) => {
      const best = produced.filter((other) => !used.has(other.id) && family(other) === family(item)).map((other) => ({ other, mm: Math.hypot(other.x - item.x, other.y - item.y) / ppm })).sort((a, b) => a.mm - b.mm)[0];
      if (best && best.mm <= 1500) used.add(best.other.id);
      return { item, match: best && best.mm <= 1500 ? best : null };
    });
    const found = matches.filter((entry) => entry.match);
    const windows = matches.filter((entry) => family(entry.item) === 'glazed'), doors = matches.filter((entry) => family(entry.item) !== 'glazed');
    const count = (list, test) => list.filter(test).length;
    const tracedExt = segments(traced.filter((wall) => wall.category === 'exterior')).flatMap((segment) => [segment.a, segment.b]);
    const gotExt = segments(got.filter((wall) => wall.category === 'exterior')).flatMap((segment) => [segment.a, segment.b]);
    const extent = (points) => (points.length ? { w: (Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x))) / ppm, h: (Math.max(...points.map((p) => p.y)) - Math.min(...points.map((p) => p.y))) / ppm } : null);
    const a = extent(tracedExt), b = extent(gotExt);
    out.sheets[`${pageNumber} ${level}`] = {
      walls,
      openings: {
        handPlaced: placedByHand.length, produced: produced.length,
        windowsAndGlazedDoors: { handPlaced: windows.length, foundWithin1500mm: count(windows, (entry) => entry.match), within600mm: count(windows, (entry) => entry.match?.mm <= 600), within300mm: count(windows, (entry) => entry.match?.mm <= 300) },
        doors: { handPlaced: doors.length, foundWithin1500mm: count(doors, (entry) => entry.match), within600mm: count(doors, (entry) => entry.match?.mm <= 600), within300mm: count(doors, (entry) => entry.match?.mm <= 300) },
        medianPositionErrorMm: found.length ? Math.round(found.map((entry) => entry.match.mm).sort((x, y) => x - y)[found.length >> 1]) : null,
        widthAgreesWithHandPlaced: `${count(found, (entry) => Number(entry.match.other.widthMm) === Number(entry.item.widthMm))} of ${found.length}`,
        widthWithin100mm: `${count(found, (entry) => Math.abs(Number(entry.match.other.widthMm) - Number(entry.item.widthMm)) <= 100)} of ${found.length}`,
        list: matches.map((entry) => ({ tag: entry.item.itemTag, class: entry.item.openingClass, widthMm: entry.item.widthMm,
          found: entry.match ? { class: entry.match.other.openingClass, widthMm: entry.match.other.widthMm, mm: Math.round(entry.match.mm), from: String(entry.match.other.ai?.detectionId || entry.match.other.id).slice(0, 40) } : null })),
        extras: produced.filter((item) => !used.has(item.id)).map((item) => ({ class: item.openingClass, widthMm: item.widthMm, x: Math.round(item.x), y: Math.round(item.y), from: String(item.ai?.detectionId || item.id).slice(0, 40) })),
        attachedToAWall: `${count(produced, (item) => item.hostWallId !== '' && item.hostWallId != null)} of ${produced.length}`,
        producedWithNoHandPlacedCounterpart: produced.length - used.size,
        sizeCodesKept: `${count(produced, (item) => item.ai?.analysisEvidence?.rawSizeCode)} carry their original code`,
      },
      externalOutlineSizeMm: a && b ? { handTrace: `${Math.round(a.w)} x ${Math.round(a.h)}`, produced: `${Math.round(b.w)} x ${Math.round(b.h)}`, difference: `${Math.round(b.w - a.w)} x ${Math.round(b.h - a.h)}` } : null,
    };
  }
  const grouped = groupReviewItems(analysis.review.map((item) => ({ ...item, audience: reviewAudience(item) })));
  out.reviewGrouped = grouped.length;
  out.reviewBySeverity = grouped.reduce((map, item) => ({ ...map, [item.severity]: (map[item.severity] || 0) + 1 }), {});
  out.reviewGroupedList = grouped.map((item) => item.severity + ' | ' + (item.code || 'review') + (item.count > 1 ? ' x' + item.count : '') + ' | ' + String(item.message).slice(0, 150));
  out.reviewItems = analysis.review.length;
  out.reviewByCode = analysis.review.reduce((map, item) => ({ ...map, [item.code || 'review']: (map[item.code || 'review'] || 0) + 1 }), {});
  out.reviewByAudience = analysis.review.reduce((map, item) => ({ ...map, [item.audience || 'unset']: (map[item.audience || 'unset'] || 0) + 1 }), {});
  out.reviewSamples = Object.fromEntries(Object.keys(out.reviewByCode).map((code) => [code, analysis.review.filter((item) => (item.code || 'review') === code).slice(0, 3).map((item) => String(item.message).slice(0, 170))]));
  out.withheld = analysis.unresolved.length;
  return out;
}
const report = { job: job.jobName, pixelsPerMm: ppm, calibrationSource: 'the takeoff\'s confirmed calibration, unchanged', sheets, fusion: fusionReports,
  planReadingOnly: measure('plan reading only (as shipped)', plain), lineworkFusion: measure('linework geometry + plan reading', fused) };

// Manually traced geometry is authoritative: analysing over the hand trace must change none of it.
const before = JSON.stringify(manual);
const over = run(fused, manual);
const again = run(fused, manual);
report.manualPreservation = {
  handTraceUnchanged: JSON.stringify(manual) === before,
  wallsAddedOverHandTrace: over.canonical.completedWallRuns.length, openingsAddedOverHandTrace: over.canonical.placedOpenings.length,
  alreadyMeasuredNotAddedTwice: over.analysis.alreadyMeasured.length, heldBackBecauseSheetIsMeasured: over.analysis.notAdded.length,
  repeatAnalysisSameIds: JSON.stringify(over.batch.detections.map((item) => item.detectionId)) === JSON.stringify(again.batch.detections.map((item) => item.detectionId)),
};
const blankA = run(fused, empty), blankB = run(fused, empty);
report.repeatability = { sameObjectIdsOnRepeat: JSON.stringify(COLLECTIONS.map((key) => blankA.canonical[key].map((item) => item.id))) === JSON.stringify(COLLECTIONS.map((key) => blankB.canonical[key].map((item) => item.id))),
  objects: Object.fromEntries(COLLECTIONS.map((key) => [key, blankA.canonical[key].length])) };
fs.writeFileSync(path.join(args.out, 'fusion-evaluation.json'), JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
