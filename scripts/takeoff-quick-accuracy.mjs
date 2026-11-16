// Fast accuracy check of the application's own vector takeoff path (no provider, no raster engine)
// against independent reference plans. Use it between engine changes; plan-accuracy.mjs remains the
// full report with overlays.
//
//   node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs \
//     scripts/takeoff-quick-accuracy.mjs [--jesmond-pdf <pdf>] [--jesmond-reference <reference.json>] \
//     [--liberty <frozen fixture dir>] [--cache <dir>] [--overrides '<json>'] [--json <out.json>] [--detail]
//     [--ocr <tessdata dir>]   also run the local printed-label stage (tesseract.js, local language data)
//     [--ocr-cache <dir>]      tesseract.js language cache (keyed by language name only: use a separate one per tessdata)
//                              The app ships public/takeoff-ocr/tessdata (tessdata_fast); pass that to match the browser.
//     [--production]   include measured footprint/outdoor outlines, as the browser Run path does
//
// Pages are rendered once (raster for the ink check, linework, PDF text read exactly as the app does on
// upload) and cached; reruns score in seconds. The reference is read only after the application
// reading is complete, and nothing from it reaches the detector.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { compactPdfLinework, extractPdfLinework } from '../components/construction-estimation/ai-plan-takeoff/geometry/pdfLinework.js';
import { detectVectorWalls } from '../components/construction-estimation/ai-plan-takeoff/geometry/vectorWalls.js';
import { canonicalPlanReading, compareOpenings, compareRooms, compareWalls } from '../components/construction-estimation/ai-plan-takeoff/geometry/planAccuracy.js';
import { buildLocalVectorAnalysis } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/localVectorAnalysis.js';
import { convertAiTakeoffDetections } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/adapter.js';
import { readPdfAnalysisEvidence } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/analysisPages.js';
import { recogniseOpeningLabels, createTesseractLabelReader } from '../components/construction-estimation/ai-plan-takeoff/geometry/localLabelOcr.js';
import { applyPrintedLabels } from '../components/construction-estimation/ai-plan-takeoff/geometry/openingLabels.js';

const require = createRequire(import.meta.url);
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const args = Object.fromEntries(process.argv.slice(2).map((arg, index, all) => (arg.startsWith('--') ? [arg.slice(2), all[index + 1]?.startsWith('--') ? true : all[index + 1]] : null)).filter(Boolean));
const overrides = args.overrides ? JSON.parse(args.overrides) : {};
const labelReader = args.ocr && args.ocr !== true
  ? await createTesseractLabelReader({ createWorker: require('tesseract.js').createWorker, langPath: args.ocr, cachePath: args['ocr-cache'] && args['ocr-cache'] !== true ? path.resolve(args['ocr-cache']) : path.join(root, 'artifacts/test-results/takeoff-ocr-cache'), toImage: (crop) => Buffer.from(crop.bytes) })
  : null;
const cacheDir = args.cache || path.join(root, 'artifacts/test-results/takeoff-quick-accuracy-cache');
const ENGINE_DPI = 228.6;
const plans = [];
const jesmondPdf = args['jesmond-pdf'] || 'E:/dev/JESMOND ROAD INDOOROOPILLY CONTRUCTION ISSUE 10 01-07-2025.pdf';
const jesmondReference = args['jesmond-reference'] || path.join(root, '.claude/worktrees/ai-takeoff-geometry/recovery/plan-references/jesmond-road/reference.json');
if (fs.existsSync(jesmondPdf) && fs.existsSync(jesmondReference)) plans.push({ name: 'Jesmond', pdf: jesmondPdf, reference: JSON.parse(fs.readFileSync(jesmondReference, 'utf8')) });
const liberty = args.liberty || path.join(root, 'artifacts/test-results/vector-regression-2026-10-18/frozen');
if (fs.existsSync(path.join(liberty, 'application-input.json'))) plans.push({ name: 'Liberty', frozen: liberty });
if (!plans.length) throw new Error('No reference plan available.');

async function rasterFromPng(file, storedPixelsPerMm) {
  const image = await loadImage(fs.readFileSync(file));
  const canvas = createCanvas(image.width, image.height);
  canvas.getContext('2d').drawImage(image, 0, 0);
  const raster = canvas.getContext('2d').getImageData(0, 0, image.width, image.height);
  raster.storedPixelsPerMm = storedPixelsPerMm;
  return raster;
}

// One cached application input per PDF page, built as the app builds it on upload.
async function pdfPageInput(pdf, pageSpec) {
  const key = `${path.basename(pdf).replace(/[^A-Za-z0-9]+/g, '-').slice(0, 40)}-p${pageSpec.page}`;
  const dir = path.join(cacheDir, key);
  const inputFile = path.join(dir, 'application-input.json'), rasterFile = path.join(dir, 'application-raster.png');
  if (!fs.existsSync(inputFile) || !fs.existsSync(rasterFile)) {
    fs.mkdirSync(dir, { recursive: true });
    const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(pdf)), isEvalSupported: false, verbosity: 0 }).promise;
    const page = await doc.getPage(pageSpec.page);
    const logical = page.getViewport({ scale: 1 });
    const k = ENGINE_DPI / 72, big = page.getViewport({ scale: k });
    const canvas = createCanvas(Math.round(big.width), Math.round(big.height));
    const g = canvas.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: g, viewport: big }).promise;
    fs.writeFileSync(rasterFile, canvas.toBuffer('image/png'));
    const operatorList = await page.getOperatorList();
    const linework = extractPdfLinework(operatorList, pdfjs.OPS, logical.transform);
    const { textItems } = await readPdfAnalysisEvidence(page, logical);
    fs.writeFileSync(inputFile, JSON.stringify({ pageNumber: pageSpec.page, logicalWidth: logical.width, logicalHeight: logical.height,
      pixelsPerMm: pageSpec.pixelsPerMm, storedPixelsPerMm: k * pageSpec.pixelsPerMm, vectorSegments: compactPdfLinework(linework), textItems }));
  }
  const input = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  return { input, raster: await rasterFromPng(rasterFile, input.storedPixelsPerMm) };
}

const pct = (value) => (value === null || value === undefined ? '-' : `${(value * 100).toFixed(1)}%`);
const polygonAreaM2 = (polygon = []) => Math.abs(polygon.reduce((sum, point, index) => {
  const next = polygon[(index + 1) % polygon.length] || point;
  return sum + point.x * next.y - next.x * point.y;
}, 0)) / 2 / 1e6;
const wallLengthM = (wall) => {
  const points = wall.points || [wall.a, wall.b].filter(Boolean);
  return points.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - points[index].x, point.y - points[index].y), 0) / 1000;
};
const totalWallM = (walls, category) => walls.filter((wall) => !category || wall.category === category).reduce((sum, wall) => sum + wallLengthM(wall), 0);
const rows = [], detail = [];
for (const plan of plans) {
  const pages = plan.frozen ? [{ page: 'frozen', level: 'Ground Floor' }] : plan.reference.pages;
  for (const pageSpec of pages) {
    const { input, raster } = plan.frozen
      ? (() => { const input = JSON.parse(fs.readFileSync(path.join(plan.frozen, 'application-input.json'), 'utf8')); return { input, rasterPromise: rasterFromPng(path.join(plan.frozen, 'application-raster.png'), input.storedPixelsPerMm) }; })()
      : await pdfPageInput(plan.pdf, pageSpec);
    const pageRaster = raster || await rasterFromPng(path.join(plan.frozen, 'application-raster.png'), input.storedPixelsPerMm);
    const ppm = input.pixelsPerMm;
    const started = Date.now();
    const detected = detectVectorWalls(input.vectorSegments, { ...input, raster: pageRaster, textItems: input.textItems || [] }, overrides);
    let labelReport = null;
    if (labelReader) {
      const read = await recogniseOpeningLabels({ raster: pageRaster, logicalWidth: input.logicalWidth, pixelsPerMm: ppm, walls: detected.walls, textItems: input.textItems || [], reader: labelReader });
      labelReport = applyPrintedLabels(detected, read.labels, { pixelsPerMm: ppm });
    }
    const level = pageSpec.level || 'Ground Floor';
    const pageNumber = input.pageNumber;
    const context = { jobId: 'quick-accuracy', takeoffId: 'quick-accuracy', documentHash: 'quick', pixelsPerMm: ppm,
      pages: [{ pageNumber, logicalWidth: input.logicalWidth, logicalHeight: input.logicalHeight }],
      completedWallRuns: [], placedOpenings: [], completedFloorplans: [], sheetLevels: { [pageNumber]: level } };
    const prepared = buildLocalVectorAnalysis({ planPage: input, detected, pixelsPerMm: ppm, level, context, runId: 'quick',
      semanticInput: args.production ? { page: pageNumber, level, walls: [], openings: [], rooms: [], review: [] } : null });
    const canonical = convertAiTakeoffDetections(prepared.batch, context);
    const approvedRooms = prepared.rooms.filter((room) => room.confirmed === true && room.reviewRequired !== true);
    const accepted = canonicalPlanReading(canonical, approvedRooms, ppm);
    const candidates = canonicalPlanReading({ completedWallRuns: [], placedOpenings: [] }, prepared.rooms, ppm);
    const ms = Date.now() - started;
    // Reference only from here on.
    const reference = plan.frozen ? JSON.parse(fs.readFileSync(path.join(plan.frozen, 'reference.json'), 'utf8')) : plan.reference;
    const onPage = (item) => plan.frozen || item.page === pageSpec.page;
    const mm = (p) => ({ x: p.x / ppm, y: p.y / ppm });
    const refPpm = plan.frozen ? ppm : pageSpec.pixelsPerMm;
    const rmm = (p) => ({ x: p.x / refPpm, y: p.y / refPpm });
    const ref = {
      walls: reference.walls.filter(onPage).map((wall) => ({ ...wall, a: rmm(wall.a), b: rmm(wall.b) })),
      openings: reference.openings.filter(onPage).map((item) => ({ ...item, ...rmm(item) })),
      rooms: reference.rooms.filter(onPage).map((room) => ({ ...room, polygon: room.polygon.map(rmm) })),
    };
    // Raw means measured pairs only: no classification or topology spans.
    // Reference scoring remains downstream of every application stage.
    const rawWalls = compareWalls(ref.walls, detected.walls.map(wall => ({ id: wall.id,
      points: wall.nodes.map(mm), thicknessMm: wall.measuredThicknessMm })));
    const rawOpenings = compareOpenings(ref.openings, detected.openings.filter(item => item.confirmed === true)
      .map(item => ({ ...item, ...mm(item) })));
    const walls = compareWalls(ref.walls, accepted.walls);
    const openings = compareOpenings(ref.openings, accepted.openings);
    const roomCandidates = compareRooms(ref.rooms, candidates.rooms);
    const roomsAccepted = compareRooms(ref.rooms, accepted.rooms);
    const referenceRoomM2 = ref.rooms.reduce((sum, room) => sum + polygonAreaM2(room.polygon), 0);
    const candidateRoomM2 = candidates.rooms.reduce((sum, room) => sum + polygonAreaM2(room.polygon), 0);
    const typeReview = canonical.placedOpenings.filter((item) => item.needsClassification).length;
    if (args.overlay && args.overlay !== true) {
      // Accepted reading over the plan: reference green, external blue / internal magenta, missed red,
      // not in the reference orange; openings: reference box, accepted cross (orange when unmatched).
      fs.mkdirSync(args.overlay, { recursive: true });
      const k = pageRaster.width / input.logicalWidth;
      const canvas = createCanvas(pageRaster.width, pageRaster.height);
      const g = canvas.getContext('2d');
      g.putImageData(pageRaster, 0, 0);
      g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(0, 0, canvas.width, canvas.height);
      const P = (p) => [p.x * ppm * k, p.y * ppm * k];
      const line = (a, b, color, width) => { g.strokeStyle = color; g.lineWidth = width; g.beginPath(); g.moveTo(...P(a)); g.lineTo(...P(b)); g.stroke(); };
      for (const wall of ref.walls) line(wall.a, wall.b, 'rgba(22,163,74,0.35)', 10);
      for (const wall of accepted.walls) wall.points.slice(1).forEach((p, i) => line(wall.points[i], p, wall.category === 'exterior' ? '#1d4ed8' : '#c026d3', 3));
      for (const run of walls.missed) line(run.a, run.b, 'rgba(220,38,38,0.85)', 7);
      for (const run of walls.extra) line(run.a, run.b, 'rgba(234,88,12,0.85)', 7);
      for (const item of ref.openings) { const [x, y] = P(item); g.strokeStyle = '#15803d'; g.lineWidth = 3; g.strokeRect(x - 10, y - 10, 20, 20); }
      for (const item of accepted.openings) {
        const [x, y] = P(item); g.strokeStyle = openings.extra.includes(item) ? '#ea580c' : '#2563eb'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(x - 9, y - 9); g.lineTo(x + 9, y + 9); g.moveTo(x + 9, y - 9); g.lineTo(x - 9, y + 9); g.stroke();
        g.fillStyle = '#111'; g.font = '16px sans-serif'; g.fillText(`${item.kind || ''} ${Math.round(item.widthMm || 0)}`, x + 10, y - 10);
      }
      fs.writeFileSync(path.join(args.overlay, `${plan.name}-${pageSpec.page}.png`), canvas.toBuffer('image/png'));
    }
    rows.push({ plan: plan.name, page: pageSpec.level || pageSpec.page,
      wallRecall: pct(walls.recall), wallPrecision: pct(walls.precision), extInt: pct(walls.categoryAgreement),
      missingWalls: walls.missingWalls.length, falseLm: (walls.detectedLm - walls.supportedLm).toFixed(1),
      openings: `${openings.matched}/${openings.reference} (${openings.detected} read)`, openKind: pct(openings.kindAgreement), typeReview,
      roomsCandidate: `${roomCandidates.matched}/${roomCandidates.reference}`, roomsAccepted: `${roomsAccepted.matched}/${roomsAccepted.reference} (${accepted.rooms.length})`,
      extLm: `${totalWallM(accepted.walls, 'exterior').toFixed(1)}/${totalWallM(ref.walls, 'exterior').toFixed(1)}`,
      intLm: `${totalWallM(accepted.walls, 'interior').toFixed(1)}/${totalWallM(ref.walls, 'interior').toFixed(1)}`,
      roomM2: `${candidateRoomM2.toFixed(1)}/${referenceRoomM2.toFixed(1)}`,
      reviewWalls: prepared.vector?.wallReviewCandidates?.length ?? prepared.vector?.reviewWallCandidates?.length ?? '-',
      counted: Object.entries(canonical.placedOpenings.filter((item) => !item.needsClassification).reduce((acc, item) => ({ ...acc, [item.openingClass]: (acc[item.openingClass] || 0) + 1 }), {})).map(([k, v]) => `${k.replace(/ Door$/, '').replace('Large Glazed/Stacker/Sliding', 'Sliding')} ${v}`).join(', '),
      ...(labelReport ? { labels: `${labelReport.applied} applied, ${labelReport.resolved.length} settled, ${labelReport.split.length} split` } : {}), ms });
    detail.push({ plan: plan.name, page: pageSpec.page, walls: {
      missing: walls.missingWalls,
      false: walls.falseWalls,
      categoryMismatches: walls.categoryMismatches.map((item) => ({
        wallId: item.wallId,
        expected: item.expected,
        checkedMm: item.checkedMm,
        mismatchMm: item.mismatchMm,
        detectedCategories: item.detectedCategories,
        detectedThicknesses: item.detectedThicknesses,
      })),
    },
      openings: { missed: openings.missed.map((item) => ({ id: item.id, kind: item.kind, widthMm: item.widthMm })), extra: openings.extra.map((item) => ({ id: item.id, kind: item.kind, widthMm: item.widthMm, x: Math.round(item.x), y: Math.round(item.y) })) },
      rooms: roomCandidates.rows.map((row) => ({
        name: row.name,
        referenceM2: Math.round(row.referenceM2 * 100) / 100,
        detectedM2: row.detectedM2 === null ? null : Math.round(row.detectedM2 * 100) / 100,
        detectedId: row.detectedId,
        iou: Math.round(row.iou * 100) / 100,
        areaError: row.areaError === null ? null : Math.round(row.areaError * 1000) / 10,
      })),
      commercialTotals: {
        walls: {
          referenceExteriorLm: Math.round(totalWallM(ref.walls, 'exterior') * 1000) / 1000,
          detectedExteriorLm: Math.round(totalWallM(accepted.walls, 'exterior') * 1000) / 1000,
          referenceInteriorLm: Math.round(totalWallM(ref.walls, 'interior') * 1000) / 1000,
          detectedInteriorLm: Math.round(totalWallM(accepted.walls, 'interior') * 1000) / 1000,
        },
        rooms: {
          referenceM2: Math.round(referenceRoomM2 * 1000) / 1000,
          candidateM2: Math.round(candidateRoomM2 * 1000) / 1000,
          approvedM2: Math.round(accepted.rooms.reduce((sum, room) => sum + polygonAreaM2(room.polygon), 0) * 1000) / 1000,
        },
      },
      raw: { detectorWalls: detected.walls.length, detectorOpenings: detected.openings.length,
        wallRecall: pct(rawWalls.recall), wallPrecision: pct(rawWalls.precision),
        confirmedOpenings: rawOpenings.detected, openingsMatched: rawOpenings.matched,
        openingReference: rawOpenings.reference, note: 'Measured wall pairs only; excludes confirmed-opening topology spans.' },
      stages: { modelWalls: Object.keys(prepared.vector.level.walls).length,
        modelOpenings: Object.keys(prepared.vector.level.openings).length,
        wallsWithheldAtClassification: prepared.vector.reviewWallCandidates.length,
        openingSpansWithheldAtClassification: prepared.vector.reviewBridgeCandidates.length,
        classifiedWalls: prepared.vector.response.walls.length,
        normalizedWalls: prepared.batch.detections.filter(item => item.kind === 'wall').length,
        normalizedOpenings: prepared.batch.detections.filter(item => item.kind === 'opening').length,
        openingsWithheldAtClassification: prepared.vector.reviewOpeningCandidates.length,
        admittedWalls: accepted.walls.length, admittedOpenings: accepted.openings.length },
      wallClassification: prepared.vector.response.walls.map((wall) => ({
        id: wall.detectionId,
        category: wall.category,
        thicknessMm: wall.thicknessMm,
        measuredThicknessMm: wall.measuredThicknessMm,
        categoryBasis: wall.categoryBasis,
      })),
      labels: labelReport ? { ...labelReport, assignments: labelReport.assignments.map((a) => ({ text: a.label.text, opening: a.opening.id, kind: a.opening.kind, widthMm: a.opening.widthMm, agrees: a.fit.agrees })) } : null,
      classified: (detected.classification || []).filter((r) => r.element !== 'wall').map((r) => ({ id: r.id, element: r.element, confidence: r.confidence, evidence: r.evidence.map((e) => `${e.rule}(${e.weight}): ${e.detail}`) })),
      structures: (detected.structures || []).map((x) => ({ element: x.element, thicknessMm: x.thicknessMm, label: x.label })),
      placed: canonical.placedOpenings.map((item) => ({ id: item.id || item.detectionId, type: item.type, openingClass: item.openingClass, subType: item.subType, leafWidthMm: item.leafWidthMm,
        widthMm: item.widthMm ?? item.width, leafMm: item.leafMm, frameWidthMm: item.frameWidthMm, roughOpeningMm: item.roughOpeningMm, needsClassification: Boolean(item.needsClassification),
        x: Math.round((item.x ?? 0) / ppm), y: Math.round((item.y ?? 0) / ppm), evidence: item.evidence })),
      review: {
        openings: prepared.vector.reviewOpeningCandidates.map((item) => ({ host: item.hostDetectionKey, kind: item.openingKind, widthMm: item.widthMm,
          x: Math.round(item.nodes[0].x / ppm), y: Math.round(item.nodes[0].y / ppm), reason: item.reason })),
        walls: prepared.vector.reviewWallCandidates.map((item) => ({ key: item.detectionKey || item.id, lengthMm: Math.round(item.lengthMm || 0),
          thicknessMm: item.thicknessMm, reason: item.reason })) } });
  }
}
console.table(rows);
if (args.detail) console.log(JSON.stringify(detail, null, 1));
if (args.json && args.json !== true) fs.writeFileSync(args.json, JSON.stringify({ overrides, rows, detail }, null, 2));
if (labelReader) await labelReader.terminate();
