// Ground-truth accuracy run: a plan PDF and a reference traced from it in, scores and overlays out.
// No provider is called and nothing leaves the machine. Two readings are scored against the same
// reference: the linework engine as the app uses it today, and the connected plan model built from
// that engine's walls and openings (rooms as faces of the wall network).
//
//   node scripts/plan-accuracy.mjs --reference <reference.json> --pdf <plan.pdf> --out <dir> [--bridge-unconfirmed-mm <width>]
//
// Writes <out>/report.json, <out>/report.md and per page: page-<n>-walls.png (reference walls green,
// model walls magenta, missed reference wall red, unsupported model wall orange, missed junctions red
// rings, openings: reference green squares, model blue crosses) and page-<n>-rooms-<reading>.png
// (reference rooms dashed green, read rooms filled by overlap: green >= 0.9, amber >= 0.5, red below).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extractPdfLinework } from '../components/construction-estimation/ai-plan-takeoff/geometry/pdfLinework.js';
import { fuseSheetLinework } from '../components/construction-estimation/ai-plan-takeoff/geometry/lineworkFusion.js';
import { levelFromLinework, openingKindOf } from '../components/construction-estimation/ai-plan-takeoff/geometry/planModelAdapter.js';
import { computeRooms, describeLevel, openingPosition, wallCategories, wallPoints } from '../components/construction-estimation/ai-plan-takeoff/geometry/planModel.js';
import { compareJunctions, compareOpenings, compareRooms, compareWalls, referenceJunctions } from '../components/construction-estimation/ai-plan-takeoff/geometry/planAccuracy.js';

const args = Object.fromEntries(process.argv.slice(2).map((arg, index, all) => (arg.startsWith('--') ? [arg.slice(2), all[index + 1]] : null)).filter(Boolean));
if (!args.reference || !args.pdf || !args.out) { console.error('Usage: --reference <reference.json> --pdf <plan.pdf> --out <dir>'); process.exit(2); }
const reference = JSON.parse(fs.readFileSync(args.reference, 'utf8'));
if (reference.schemaVersion !== 'gr8-plan-reference.v1' || reference.coordinateSpace !== 'logical-plan-pixels') throw new Error('Reference must be gr8-plan-reference.v1 in logical-plan-pixels.');
fs.mkdirSync(args.out, { recursive: true });
const require = createRequire(import.meta.url);
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
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
  const linework = extractPdfLinework(operatorList, pdfjs.OPS, logical.transform).filter((s) => Math.hypot(s.x2 - s.x1, s.y2 - s.y1) >= 1)
    .map(({ x1, y1, x2, y2, path: pathId, subpath, curve }) => ({ x1, y1, x2, y2, path: pathId, subpath, ...(curve ? { curve: true } : {}) }));
  const sheet = { pageNumber: pageSpec.page, logicalWidth: logical.width, logicalHeight: logical.height, pixelsPerMm: pageSpec.pixelsPerMm };
  const fused = fuseSheetLinework({ page: pageSpec.page, walls: [], openings: [], rooms: [] }, raster, sheet, { vectorLinework: linework });
  return { page, logical, fused, linework };
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
  const { page, fused } = await readPage(pageSpec);
  const engineMs = Date.now() - started;
  const modelStarted = Date.now();
  const built = levelFromLinework(fused.geometry, { id: pageSpec.level || `page-${pageSpec.page}`, name: pageSpec.level, page: pageSpec.page, pixelsPerMm: ppm }, { bridgeUnconfirmedMaxMm: Number(args['bridge-unconfirmed-mm']) || 0 });
  const modelMs = Date.now() - modelStarted;
  const readings = { engine: engineReading(fused.geometry, ppm), model: modelReading(built.level) };
  const scores = { engine: score(referenceMm, readings.engine), model: score(referenceMm, readings.model) };
  fs.writeFileSync(path.join(args.out, `page-${pageSpec.page}-engine-geometry.json`), JSON.stringify({ engine: fused.geometry.engine, walls: fused.geometry.walls, openings: fused.geometry.openings,
    rooms: fused.geometry.rooms.map(({ id, polygon, areaM2, verified, partOf }) => ({ id, polygon, areaM2, verified, partOf })), junctions: fused.geometry.junctions }));
  report.pages.push({ page: pageSpec.page, level: pageSpec.level, engineMs, modelMs, engineVersion: fused.geometry.engine, model: { ...describeLevel(built.level), build: built.report }, scores });

  // Walls overlay (model reading).
  const P = (p) => [p.x * ppm * DRAW_SCALE, p.y * ppm * DRAW_SCALE];
  const { canvas, g } = await drawBase(page);
  for (const wall of referenceMm.walls) { g.strokeStyle = 'rgba(22,163,74,0.35)'; g.lineWidth = Math.max(4, wall.thicknessMm * ppm * DRAW_SCALE); g.beginPath(); g.moveTo(...P(wall.a)); g.lineTo(...P(wall.b)); g.stroke(); }
  for (const wall of readings.model.walls) { g.strokeStyle = wall.category === 'exterior' ? '#1d4ed8' : '#c026d3'; g.lineWidth = 2; g.beginPath(); wall.points.forEach((p, i) => (i ? g.lineTo(...P(p)) : g.moveTo(...P(p)))); g.stroke(); }
  for (const run of scores.model.walls.missed) { g.strokeStyle = 'rgba(220,38,38,0.85)'; g.lineWidth = 7; g.beginPath(); g.moveTo(...P(run.a)); g.lineTo(...P(run.b)); g.stroke(); }
  for (const run of scores.model.walls.extra) { g.strokeStyle = 'rgba(234,88,12,0.85)'; g.lineWidth = 7; g.beginPath(); g.moveTo(...P(run.a)); g.lineTo(...P(run.b)); g.stroke(); }
  for (const junction of scores.model.junctions.missed) { g.strokeStyle = '#dc2626'; g.lineWidth = 3; g.beginPath(); g.arc(...P(junction), 12, 0, Math.PI * 2); g.stroke(); }
  for (const item of referenceMm.openings) { const [x, y] = P(item); g.strokeStyle = '#15803d'; g.lineWidth = 3; g.strokeRect(x - 9, y - 9, 18, 18); }
  for (const item of readings.model.openings) { const [x, y] = P(item); g.strokeStyle = '#2563eb'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 8, y - 8); g.lineTo(x + 8, y + 8); g.moveTo(x + 8, y - 8); g.lineTo(x - 8, y + 8); g.stroke(); }
  legend(g, [['reference wall', 'rgba(22,163,74,0.6)'], ['model wall: external / internal', '#1d4ed8'], ['reference wall the model missed', '#dc2626'], ['model wall not in the reference', '#ea580c'], ['opening: reference box, model cross', '#2563eb']]);
  fs.writeFileSync(path.join(args.out, `page-${pageSpec.page}-walls.png`), canvas.toBuffer('image/png'));

  // Rooms overlays.
  for (const name of ['engine', 'model']) {
    const { canvas: roomCanvas, g: rg } = await drawBase(page);
    const rows = scores[name].rooms.rows;
    const iouOf = new Map();
    for (const row of rows) if (row.detectedId) iouOf.set(row.detectedId, Math.max(iouOf.get(row.detectedId) || 0, row.iou));
    for (const room of readings[name].rooms) {
      const iou = iouOf.get(room.id) || 0;
      rg.fillStyle = iou >= 0.9 ? 'rgba(34,197,94,0.30)' : iou >= 0.5 ? 'rgba(245,158,11,0.30)' : 'rgba(239,68,68,0.25)';
      rg.strokeStyle = 'rgba(55,65,81,0.9)'; rg.lineWidth = 2;
      rg.beginPath(); room.polygon.forEach((p, i) => (i ? rg.lineTo(...P(p)) : rg.moveTo(...P(p)))); rg.closePath(); rg.fill(); rg.stroke();
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
}

// Markdown summary.
const md = [`# Plan accuracy: ${report.plan}`, '', `Reference: ${path.basename(args.reference)}. Generated ${report.generated}. No provider called.`, ''];
for (const pageReport of report.pages) {
  md.push(`## Page ${pageReport.page} (${pageReport.level})`, '', '| Measure | Engine today | Plan model |', '|---|---|---|');
  const e = pageReport.scores.engine, m = pageReport.scores.model;
  const row = (label, a, b) => md.push(`| ${label} | ${a} | ${b} |`);
  row('Reference wall length found (recall)', `${pct(e.walls.recall)} of ${num(e.walls.referenceLm)} lm`, `${pct(m.walls.recall)} of ${num(m.walls.referenceLm)} lm`);
  row('Read wall length that is a reference wall (precision)', `${pct(e.walls.precision)} of ${num(e.walls.detectedLm)} lm`, `${pct(m.walls.precision)} of ${num(m.walls.detectedLm)} lm`);
  row('Centreline offset, median', `${num(e.walls.centrelineOffsetMedianMm)} mm`, `${num(m.walls.centrelineOffsetMedianMm)} mm`);
  row('Thickness error, median', `${num(e.walls.thicknessErrorMedianMm)} mm`, `${num(m.walls.thicknessErrorMedianMm)} mm`);
  row('External/internal agreement (by length)', pct(e.walls.categoryAgreement), pct(m.walls.categoryAgreement));
  row('Reference junctions found (within 150 mm)', `${e.junctions.found} / ${e.junctions.reference} (${pct(e.junctions.share)})`, `${m.junctions.found} / ${m.junctions.reference} (${pct(m.junctions.share)})`);
  row('Junction position error, median', `${num(e.junctions.errorMedianMm)} mm`, `${num(m.junctions.errorMedianMm)} mm`);
  row('Openings found (within 400 mm)', `${e.openings.matched} / ${e.openings.reference} (${pct(e.openings.recall)}), ${e.openings.detected} read`, `${m.openings.matched} / ${m.openings.reference} (${pct(m.openings.recall)}), ${m.openings.detected} read`);
  row('Opening width error, median', pct(e.openings.widthErrorMedian), pct(m.openings.widthErrorMedian));
  row('Rooms matched (overlap >= 0.5)', `${e.rooms.matched} / ${e.rooms.reference}`, `${m.rooms.matched} / ${m.rooms.reference}`);
  row('Room overlap, median', num(e.rooms.iouMedian, 3), num(m.rooms.iouMedian, 3));
  row('Matched room area error, median', pct(e.rooms.areaErrorMedianAbs), pct(m.rooms.areaErrorMedianAbs));
  md.push('', '| Room | Reference m² | Engine IoU | Engine area | Model IoU | Model area |', '|---|---|---|---|---|---|');
  e.rooms.rows.forEach((row, index) => {
    const mr = m.rooms.rows[index];
    md.push(`| ${row.name} | ${row.referenceM2.toFixed(2)} | ${row.iou.toFixed(2)} | ${row.detectedM2 === null ? '-' : row.detectedM2.toFixed(2)} | ${mr.iou.toFixed(2)} | ${mr.detectedM2 === null ? '-' : mr.detectedM2.toFixed(2)} |`);
  });
  md.push('', `Model: ${pageReport.model.walls} walls, ${pageReport.model.nodes} nodes, ${pageReport.model.freeEnds} free wall ends of ${pageReport.model.wallEnds}, ${pageReport.model.rooms} rooms, ${pageReport.model.build.bridges} confirmed gaps bridged. Engine ${pageReport.engineMs} ms, model ${pageReport.modelMs} ms.`, '');
}
fs.writeFileSync(path.join(args.out, 'report.md'), md.join('\n'));
fs.writeFileSync(path.join(args.out, 'report.json'), JSON.stringify(report, (key, value) => (typeof value === 'number' ? Math.round(value * 1000) / 1000 : value), 2));
console.log(md.join('\n'));
