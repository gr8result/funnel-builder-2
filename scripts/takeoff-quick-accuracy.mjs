// Fast accuracy check of the application's own vector takeoff path (no provider, no raster engine)
// against independent reference plans. Use it between engine changes; plan-accuracy.mjs remains the
// full report with overlays.
//
//   node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs \
//     scripts/takeoff-quick-accuracy.mjs [--jesmond-pdf <pdf>] [--jesmond-reference <reference.json>] \
//     [--liberty <frozen fixture dir>] [--cache <dir>] [--overrides '<json>'] [--json <out.json>] [--detail]
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

const require = createRequire(import.meta.url);
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const args = Object.fromEntries(process.argv.slice(2).map((arg, index, all) => (arg.startsWith('--') ? [arg.slice(2), all[index + 1]?.startsWith('--') ? true : all[index + 1]] : null)).filter(Boolean));
const overrides = args.overrides ? JSON.parse(args.overrides) : {};
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
    const level = pageSpec.level || 'Ground Floor';
    const pageNumber = input.pageNumber;
    const context = { jobId: 'quick-accuracy', takeoffId: 'quick-accuracy', documentHash: 'quick', pixelsPerMm: ppm,
      pages: [{ pageNumber, logicalWidth: input.logicalWidth, logicalHeight: input.logicalHeight }],
      completedWallRuns: [], placedOpenings: [], completedFloorplans: [], sheetLevels: { [pageNumber]: level } };
    const prepared = buildLocalVectorAnalysis({ planPage: input, detected, pixelsPerMm: ppm, level, context, runId: 'quick' });
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
    void mm;
    const walls = compareWalls(ref.walls, accepted.walls);
    const openings = compareOpenings(ref.openings, accepted.openings);
    const roomCandidates = compareRooms(ref.rooms, candidates.rooms);
    const roomsAccepted = compareRooms(ref.rooms, accepted.rooms);
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
      reviewWalls: prepared.vector?.wallReviewCandidates?.length ?? prepared.vector?.reviewWallCandidates?.length ?? '-', ms });
    detail.push({ plan: plan.name, page: pageSpec.page, walls: { missing: walls.missingWalls, false: walls.falseWalls },
      openings: { missed: openings.missed.map((item) => ({ id: item.id, kind: item.kind, widthMm: item.widthMm })), extra: openings.extra.map((item) => ({ id: item.id, kind: item.kind, widthMm: item.widthMm, x: Math.round(item.x), y: Math.round(item.y) })) },
      rooms: roomCandidates.rows.map((row) => ({ name: row.name, iou: Math.round(row.iou * 100) / 100, areaError: row.areaError === null ? null : Math.round(row.areaError * 1000) / 10 })),
      raw: { detectorWalls: detected.walls.length, detectorOpenings: detected.openings.length } });
  }
}
console.table(rows);
if (args.detail) console.log(JSON.stringify(detail, null, 1));
if (args.json && args.json !== true) fs.writeFileSync(args.json, JSON.stringify({ overrides, rows, detail }, null, 2));
