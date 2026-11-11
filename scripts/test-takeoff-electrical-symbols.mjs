// Electrical points read from the drawing: labels (joined over lines, notes ignored, short tags only on an
// electrical sheet or when the legend defines them) and symbols matched to the sheet's own legend at any
// quarter turn, through the same PDF reading the takeoff uses. Then per-room allocation and the hand-off.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PDFDocument, StandardFonts, degrees } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { readPdfAnalysisEvidence } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/analysisPages.js';
import { extractPdfLinework } from '../components/construction-estimation/ai-plan-takeoff/geometry/pdfLinework.js';
import { readElectricalPoints, allocatePointsToRooms } from '../components/construction-estimation/ai-plan-takeoff/geometry/electricalSymbols.js';
import { createTakeoffSchedule, createJobSetupPayload, flattenScheduleRows } from '../components/construction-estimation/ai-plan-takeoff/takeoffSchedule.js';

let groups = 0;
const group = async (name, fn) => { await fn(); groups += 1; console.log("ok", name); };
const item = (text, x, y, extra = {}) => ({ text, x, y, width: text.length * 5, height: 8, angle: 0, ...extra });

await group('labels: whole phrases only, split labels joined, notes and look-alikes ignored', () => {
  const r = readElectricalPoints({ textItems: [
    item('SMOKE', 100, 100), item('ALARM', 100, 110),                // two lines
    item('DOUBLE', 300, 100), item('GPO', 334, 100),                 // two items on one line
    item('CEILING FAN', 500, 100),
    item('SMOKE ALARMS TO BE INSTALLED IN', 100, 400), item('ACCORDANCE WITH THE NCC', 100, 410),
    item('FAN COIL UNIT', 300, 400), item('SD', 500, 400), item('SA', 600, 400), item('GPO', 700, 400),
  ] });
  assert.deepEqual(r.counts, { 'double-gpo': 1, 'ceiling-fan': 1, 'smoke-alarm': 1 });
  assert.match(r.points.find((p) => p.kind === 'smoke-alarm').evidence, /"SMOKE ALARM"/);
});

await group('labels: text running up the sheet (CAD sheets drawn rotated) still joins line to line', () => {
  // Jesmond's sheets: each label is two items, "SMOKE" then "ALARM" on the next line, text at 90 degrees.
  const r = readElectricalPoints({ textItems: [
    { text: 'SMOKE', x: 576, y: 806, width: 28.5, height: 7.9, angle: 90 }, { text: 'ALARM', x: 569, y: 806, width: 27.3, height: 7.9, angle: 90 },
    { text: 'SMOKE', x: 541, y: 770, width: 28.5, height: 7.9, angle: 90 }, { text: 'ALARM', x: 534, y: 771, width: 27.3, height: 7.9, angle: 90 },
  ] });
  assert.equal(r.counts['smoke-alarm'], 2);
  assert.ok(r.points.every((p) => /"SMOKE ALARM"/.test(p.evidence)));
});

await group('short tags count on an electrical sheet, never on an architectural one', () => {
  const tags = [item('SA', 100, 100), item('DGPO', 200, 100), item('LP', 300, 100), item('SW', 400, 100), item('CF', 500, 100)];
  assert.deepEqual(readElectricalPoints({ textItems: tags }).counts, {});
  const r = readElectricalPoints({ textItems: [...tags, item('ELECTRICAL PLAN', 100, 600)] });
  assert.deepEqual(r.counts, { 'smoke-alarm': 1, 'double-gpo': 1, 'light-point': 1, 'switch': 1, 'ceiling-fan': 1 });
});

// A one-page PDF drawn the way a CAD electrical layout is: a legend with a symbol before each entry, and
// copies of the symbols placed round the plan at quarter turns, plus look-alikes that are not symbols.
async function electricalPdf() {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([1200, 800]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const H = 800; // pdf-lib draws in PDF space (y up); the sheet reads with y down.
  const line = (x1, y1, x2, y2) => page.drawLine({ start: { x: x1, y: H - y1 }, end: { x: x2, y: H - y2 }, thickness: 0.5 });
  const turn = (r, x, y) => [[x, y], [-y, x], [-x, -y], [y, -x]][r / 90];
  const symbols = {
    // circle radius 6 with two short strokes above it
    'double-gpo': (cx, cy, r) => { page.drawCircle({ x: cx, y: H - cy, size: 6, borderWidth: 0.5 });
      for (const [a, b, c, d] of [[-3, -6, -3, -11], [3, -6, 3, -11]]) { const [x1, y1] = turn(r, a, b), [x2, y2] = turn(r, c, d); line(cx + x1, cy + y1, cx + x2, cy + y2); } },
    // circle with one stroke
    'single-gpo': (cx, cy, r) => { page.drawCircle({ x: cx, y: H - cy, size: 6, borderWidth: 0.5 });
      const [x1, y1] = turn(r, 0, -6), [x2, y2] = turn(r, 0, -11); line(cx + x1, cy + y1, cx + x2, cy + y2); },
    // circle with a cross through it
    'light-point': (cx, cy) => { page.drawCircle({ x: cx, y: H - cy, size: 6, borderWidth: 0.5 }); line(cx - 4.2, cy - 4.2, cx + 4.2, cy + 4.2); line(cx - 4.2, cy + 4.2, cx + 4.2, cy - 4.2); },
    // square with a circle inside
    'smoke-alarm': (cx, cy) => { for (const [a, b, c, d] of [[-7, -7, 7, -7], [7, -7, 7, 7], [7, 7, -7, 7], [-7, 7, -7, -7]]) line(cx + a, cy + b, cx + c, cy + d); page.drawCircle({ x: cx, y: H - cy, size: 4, borderWidth: 0.5 }); },
  };
  const entries = [['double-gpo', 'DOUBLE POWER POINT'], ['single-gpo', 'SINGLE POWER POINT'], ['light-point', 'LIGHT POINT'], ['smoke-alarm', 'SMOKE ALARM']];
  page.drawText('ELECTRICAL LEGEND', { x: 950, y: H - 100, size: 9, font });
  entries.forEach(([key, words], i) => { symbols[key](960, 125 + i * 30, 0); page.drawText(words, { x: 985, y: H - (125 + i * 30) - 3, size: 9, font }); });
  const placed = [
    ['double-gpo', 100, 100, 0], ['double-gpo', 200, 100, 90], ['double-gpo', 300, 100, 180], ['double-gpo', 400, 100, 270], ['double-gpo', 100, 400, 90],
    ['single-gpo', 500, 100, 0], ['single-gpo', 500, 400, 180],
    ['light-point', 150, 250, 0], ['light-point', 350, 250, 0], ['light-point', 550, 250, 0],
    ['smoke-alarm', 250, 350, 0],
  ];
  for (const [key, x, y, r] of placed) symbols[key](x, y, r);
  page.drawCircle({ x: 700, y: H - 300, size: 6, borderWidth: 0.5 });                    // a plain circle (a column, a bollard)
  page.drawCircle({ x: 700, y: H - 400, size: 6, borderWidth: 0.5 }); line(700, 394, 700, 380); // a circle with a long tail
  page.drawText('SMOKE ALARM', { x: 262, y: H - 352, size: 9, font });                    // written beside its own symbol: still one
  page.drawText('SMOKE ALARM', { x: 620, y: H - 600, size: 9, font });                    // written with no symbol: one more
  return { bytes: await pdf.save(), expected: { 'double-gpo': 5, 'single-gpo': 2, 'light-point': 3, 'smoke-alarm': 2 } };
}

async function readSheet(bytes, pageNumber = 1) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), disableFontFace: true, verbosity: 0 }).promise;
  const page = await doc.getPage(pageNumber); const viewport = page.getViewport({ scale: 1 });
  const { textItems } = await readPdfAnalysisEvidence(page, viewport);
  return { textItems, segments: extractPdfLinework(await page.getOperatorList(), pdfjs.OPS, viewport.transform) };
}

await group('symbols: every copy of a legend symbol, at any quarter turn, through the PDF reader', async () => {
  const { bytes, expected } = await electricalPdf();
  const sheet = await readSheet(bytes);
  const r = readElectricalPoints({ ...sheet, pixelsPerMm: 0.01 });
  assert.equal(r.report.legendEntries, 4, 'four legend entries');
  assert.deepEqual(r.report.legendWithoutSymbol, [], 'each legend entry has its symbol');
  assert.deepEqual(r.counts, expected);
  assert.equal(r.points.filter((p) => p.source === 'label').length, 1, 'only the label with no symbol beside it adds a point');
  assert.ok(!r.points.some((p) => p.x > 900), 'the legend itself is not counted');
  assert.deepEqual(new Set(r.points.filter((p) => p.kind === 'double-gpo').map((p) => p.rotation)), new Set([0, 90, 180, 270]));
});

await group('rooms: each point to the room it sits in; schedule and Job Setup hand-off carry counts and room areas', () => {
  const room = (id, name, x0, y0, x1, y1) => ({ id, name, page: 3, polygon: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }], confirmed: true, source: 'ai' });
  const rooms = [room('r1', 'Kitchen', 0, 0, 300, 300), room('r2', 'Bed 1', 300, 0, 600, 300), room('r3', 'Pantry', 200, 200, 280, 280)];
  const points = [{ kind: 'double-gpo', x: 50, y: 50 }, { kind: 'double-gpo', x: 250, y: 250 }, { kind: 'light-point', x: 400, y: 100 }, { kind: 'smoke-alarm', x: 900, y: 900 }];
  const allocated = allocatePointsToRooms(points, rooms);
  assert.deepEqual(allocated.map((p) => p.room), ['Kitchen', 'Pantry', 'Bed 1', null], 'smallest containing room wins; outside any room is kept');

  const schedule = createTakeoffSchedule({ totalPages: 3, currentPage: 3, pixelsPerMm: 0.1, sheetLevels: { 3: 'Ground Floor' },
    aiAnalysis: { rooms, electricalPoints: { 3: { points: points.map((p) => ({ ...p, source: 'symbol', evidence: 'test' })) } } } });
  const rows = schedule.projectTotals.electricalPoints;
  assert.deepEqual(rows.map((row) => [row.room, row.category, row.quantity]).sort(), [
    ['Bed 1', 'Light point', 1], ['Kitchen', 'Double power point', 1], ['No room', 'Smoke alarm', 1], ['Pantry', 'Double power point', 1]].sort());
  assert.equal(rows.find((row) => row.room === 'Kitchen').roomAreaM2, 9, 'the room area travels with its points (300 px / 0.1 px/mm = 3 m)');
  assert.ok(rows.every((row) => row.section === 'Electrical Points' && row.unit === 'No.' && row.level === 'Ground Floor'));
  assert.ok(flattenScheduleRows(schedule).some((row) => row.section === 'Electrical Points'), 'in the flat schedule (CSV / Basic Project Measurements)');

  const payload = createJobSetupPayload(schedule);
  assert.deepEqual(payload.electricalPoints.totals, { 'double-gpo': 2, 'light-point': 1, 'smoke-alarm': 1 });
  assert.deepEqual(payload.electricalPoints.rooms.find((r) => r.room === 'Kitchen'), { level: 'Ground Floor', roomId: 'r1', room: 'Kitchen', roomAreaM2: 9, points: { 'double-gpo': 1 } });
  assert.ok(payload.unsupported.some((row) => /electrical/i.test(row.reason)), 'Job Setup has no electrical inputs: said, not dropped');
});

const JESMOND = process.env.GR8_JESMOND_PDF || 'E:/dev/JESMOND ROAD INDOOROOPILLY CONTRUCTION ISSUE 10 01-07-2025.pdf';
if (fs.existsSync(JESMOND)) {
  await group('Jesmond Road: the smoke alarms written on the plans (2 upper, 5 lower), nothing else', async () => {
    const bytes = fs.readFileSync(JESMOND);
    for (const [pageNumber, expected] of [[4, { 'smoke-alarm': 2 }], [5, { 'smoke-alarm': 5 }]]) {
      const r = readElectricalPoints({ ...(await readSheet(bytes, pageNumber)), pixelsPerMm: 0.02834645669291339 });
      assert.deepEqual(r.counts, expected, `sheet ${pageNumber}`);
    }
  });
} else console.log('skip Jesmond Road (plan not on this machine)');

console.log(`electrical symbols: ${groups} groups passed`);
