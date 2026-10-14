// Real-plan acceptance floors on the Jesmond Road construction set (vector PDF, 1:100), measured the
// way the app measures: logical units are PDF points, the raster is the page at the engine's
// 0.09 px/mm, and the linework is the set the canvas keeps with the page. Wall POSITION is checked
// against the PDF's own drawn lines, not a hand trace. No provider: room names come from the PDF's
// text layer. The floors pin what this sheet achieves today so a regression shows; they are not a
// claim that the plan is fully read (see the printed known gaps).
// node scripts/test-takeoff-jesmond-real-plan.mjs [--out <dir>]   (writes overlay PNGs when --out is given)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extractPdfLinework } from '../components/construction-estimation/ai-plan-takeoff/geometry/pdfLinework.js';
import { fuseSheetLinework } from '../components/construction-estimation/ai-plan-takeoff/geometry/lineworkFusion.js';

const PDF = process.env.GR8_JESMOND_PDF || 'E:/dev/JESMOND ROAD INDOOROOPILLY CONTRUCTION ISSUE 10 01-07-2025.pdf';
if (!fs.existsSync(PDF)) { console.log('Jesmond Road PDF not on this machine; real-plan test skipped'); process.exit(0); }
const outIndex = process.argv.indexOf('--out');
const out = outIndex > 0 ? process.argv[outIndex + 1] : null;
if (out) fs.mkdirSync(out, { recursive: true });
const require = createRequire(import.meta.url);
const { createCanvas } = require('@napi-rs/canvas');

const ROOM_WORDS = /^(bed(room)?\s*\d*|master bedroom|living( room)?|kitchen|dining|e-?suite|ens(uite)?|wir|robe|bath(room)?|powder|l'?dry|laundry|home office|office|study|pantry|outdoor terrace|terrace|balcony|lobby|store|garage|entry|alfresco|patio)$/i;
const DPI = 228.6, K = DPI / 72, LOGICAL_PPM = 72 / 25.4 / 100, IMAGE_PPM = DPI / 25.4 / 100;
const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(PDF)), isEvalSupported: false }).promise;

async function measure(pageNumber) {
  const page = await doc.getPage(pageNumber);
  const big = page.getViewport({ scale: K }), logical = page.getViewport({ scale: 1 });
  const canvas = createCanvas(Math.round(big.width), Math.round(big.height));
  const g = canvas.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: g, viewport: big }).promise;
  const raster = g.getImageData(0, 0, canvas.width, canvas.height); raster.storedPixelsPerMm = 6 * LOGICAL_PPM;
  const operatorList = await page.getOperatorList();
  const linework = extractPdfLinework(operatorList, pdfjs.OPS, logical.transform).filter((s) => Math.hypot(s.x2 - s.x1, s.y2 - s.y1) >= 1)
    .map(({ x1, y1, x2, y2, path, subpath, curve }) => ({ x1: Math.round(x1 * 100) / 100, y1: Math.round(y1 * 100) / 100, x2: Math.round(x2 * 100) / 100, y2: Math.round(y2 * 100) / 100, path, subpath, ...(curve ? { curve: true } : {}) }));
  const strokes = extractPdfLinework(operatorList, pdfjs.OPS, logical.transform).filter((s) => s.paint === 'stroke' && !s.curve);
  const labels = (await page.getTextContent()).items.filter((item) => ROOM_WORDS.test(item.str.trim())).map((item) => {
    const [x, y] = logical.convertToViewportPoint(item.transform[4], item.transform[5]);
    const rot = Math.atan2(item.transform[1], item.transform[0]);
    return { name: item.str.trim(), x: x + Math.cos(rot) * item.width / 2, y: y - Math.sin(rot) * item.width / 2 };
  });
  const sheet = { pageNumber, logicalWidth: logical.width, logicalHeight: logical.height, pixelsPerMm: LOGICAL_PPM };
  const response = { page: pageNumber, walls: [], openings: [], rooms: labels.map((l) => ({ page: pageNumber, name: l.name, x: l.x / logical.width, y: l.y / logical.height, basis: 'OBSERVED', confidence: 0.95, evidence: 'PDF text layer' })) };
  const fused = fuseSheetLinework(response, raster, sheet, { vectorLinework: linework });
  // Face position: both faces of each axis-aligned wall vs the nearest drawn parallel line, outside openings.
  const lines = { h: [], v: [] };
  for (const s of strokes) {
    if (Math.abs(s.y2 - s.y1) < 0.2 && Math.abs(s.x2 - s.x1) > 0.6) lines.h.push({ c: (s.y1 + s.y2) / 2, s0: Math.min(s.x1, s.x2), s1: Math.max(s.x1, s.x2) });
    else if (Math.abs(s.x2 - s.x1) < 0.2 && Math.abs(s.y2 - s.y1) > 0.6) lines.v.push({ c: (s.x1 + s.x2) / 2, s0: Math.min(s.y1, s.y2), s1: Math.max(s.y1, s.y2) });
  }
  const geo = fused.geometry;
  const offsets = [];
  for (const w of geo.walls.filter((item) => item.axis === 'h' || item.axis === 'v')) {
    const hz = w.axis === 'h'; const [a, b] = w.nodes; const c = hz ? (a.y + b.y) / 2 : (a.x + b.x) / 2;
    const s0 = Math.min(hz ? a.x : a.y, hz ? b.x : b.y), s1 = Math.max(hz ? a.x : a.y, hz ? b.x : b.y), half = w.measuredThicknessMm * LOGICAL_PPM / 2;
    const n = Math.max(3, Math.ceil((s1 - s0) / 3));
    for (let k = 1; k < n; k += 1) {
      const s = s0 + (s1 - s0) * k / n;
      if (geo.openings.some((o) => o.axis === w.axis && Math.abs((hz ? o.y : o.x) - c) <= half + 50 * LOGICAL_PPM && Math.abs((hz ? o.x : o.y) - s) <= (o.widthMm || 0) * LOGICAL_PPM / 2)) continue;
      const face = (fc) => lines[w.axis].reduce((best, l) => (s >= l.s0 - 0.2 && s <= l.s1 + 0.2 ? Math.min(best, Math.abs(l.c - fc)) : best), Infinity);
      offsets.push(Math.max(face(c - half), face(c + half)) / LOGICAL_PPM);
    }
  }
  offsets.sort((x, y) => x - y);
  const ends = geo.walls.flatMap((w) => w.junctionIds || [null, null]);
  const rooms = fused.response.rooms.filter((r) => r.polygon?.length >= 3);
  const result = {
    page: pageNumber, walls: geo.walls.length, fitted: fused.report.vectorFit.fitted, doorSwings: fused.report.vectorFit.doorSwings, glazedGaps: fused.report.vectorFit.glazedGaps,
    faceMedianMm: offsets[offsets.length >> 1], faceWithin25: offsets.filter((v) => v <= 25).length / offsets.length,
    joinedEnds: ends.filter(Boolean).length / ends.length, confirmedGaps: fused.report.gaps.confirmed,
    verifiedNames: rooms.filter((r) => r.lineworkVerified).map((r) => r.name).sort(),
    rooms: rooms.map((r) => `${r.name}${r.lineworkVerified ? '' : '?'} ${r.lineworkAreaM2}`),
    exteriorLm: geo.walls.filter((w) => w.category === 'exterior').reduce((s, w) => s + w.lengthMm, 0) / 1000,
  };
  if (out) {
    g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(0, 0, canvas.width, canvas.height);
    const W = canvas.width, H = canvas.height;
    for (const r of rooms) { g.save(); g.strokeStyle = r.lineworkVerified ? '#15803d' : '#7c3aed'; g.fillStyle = r.lineworkVerified ? 'rgba(34,197,94,0.14)' : 'rgba(124,58,237,0.08)'; g.lineWidth = 3; if (!r.lineworkVerified) g.setLineDash([10, 6]); g.beginPath(); r.polygon.forEach((p, i) => (i ? g.lineTo(p.x * W, p.y * H) : g.moveTo(p.x * W, p.y * H))); g.closePath(); g.fill(); g.stroke(); g.restore(); }
    for (const w of geo.walls) { const [a, b] = [w.nodes[0], w.nodes[w.nodes.length - 1]]; g.strokeStyle = w.category === 'exterior' ? 'rgba(37,99,235,0.5)' : 'rgba(234,88,12,0.5)'; g.lineWidth = w.measuredThicknessMm * IMAGE_PPM; g.beginPath(); g.moveTo(a.x * K, a.y * K); g.lineTo(b.x * K, b.y * K); g.stroke(); }
    for (const j of geo.junctions || []) { g.fillStyle = '#16a34a'; g.beginPath(); g.arc(j.x * K, j.y * K, 3.5, 0, Math.PI * 2); g.fill(); }
    for (const w of geo.walls) (w.junctionIds || []).forEach((id, i) => { if (id) return; const p = w.nodes[i === 0 ? 0 : w.nodes.length - 1]; g.strokeStyle = '#dc2626'; g.lineWidth = 2.5; g.beginPath(); g.arc(p.x * K, p.y * K, 7, 0, Math.PI * 2); g.stroke(); });
    for (const o of geo.openings) { g.strokeStyle = o.confirmed ? '#059669' : '#be123c'; g.lineWidth = 2.5; if (o.confirmed) g.strokeRect(o.x * K - 6, o.y * K - 6, 12, 12); else { g.beginPath(); g.moveTo(o.x * K - 6, o.y * K - 6); g.lineTo(o.x * K + 6, o.y * K + 6); g.moveTo(o.x * K + 6, o.y * K - 6); g.lineTo(o.x * K - 6, o.y * K + 6); g.stroke(); } }
    g.font = 'bold 22px sans-serif'; g.fillStyle = '#111';
    for (const r of rooms) { const cx = r.polygon.reduce((s, p) => s + p.x, 0) / r.polygon.length * W, cy = r.polygon.reduce((s, p) => s + p.y, 0) / r.polygon.length * H; g.fillText(`${r.name} ${r.lineworkAreaM2 ?? ''}`, cx - 40, cy); }
    fs.writeFileSync(`${out}/jesmond-page-${pageNumber}.png`, canvas.toBuffer('image/png'));
  }
  return result;
}

const lower = await measure(5), upper = await measure(4);
for (const r of [lower, upper]) console.log(`  page ${r.page}: ${r.walls} walls (${r.fitted} on drawn faces), face median ${r.faceMedianMm.toFixed(1)} mm, ${(100 * r.faceWithin25).toFixed(0)}% within 25 mm, ${(100 * r.joinedEnds).toFixed(0)}% of ends at a junction, ${r.doorSwings} door swings, ${r.glazedGaps} glazed gaps, ${r.confirmedGaps} confirmed gaps; enclosed: ${r.verifiedNames.join(', ') || '-'}`);

for (const r of [lower, upper]) {
  assert.ok(r.faceMedianMm <= 5, `page ${r.page}: wall faces lie on the drawn lines (median ${r.faceMedianMm.toFixed(1)} mm)`);
  assert.ok(r.joinedEnds >= 0.5, `page ${r.page}: walls that meet share junctions (${(100 * r.joinedEnds).toFixed(0)}%)`);
  assert.ok(r.doorSwings >= 9, `page ${r.page}: drawn door swings read (${r.doorSwings})`);
}
assert.ok(lower.faceWithin25 >= 0.7, `lower: ${(100 * lower.faceWithin25).toFixed(0)}% of wall length within 25 mm of its drawn faces`);
assert.ok(upper.faceWithin25 >= 0.7, `upper: ${(100 * upper.faceWithin25).toFixed(0)}% of wall length within 25 mm of its drawn faces`);
assert.ok(lower.confirmedGaps >= 70, `lower: doorways and windows confirmed from the drawing (${lower.confirmedGaps})`);
for (const name of ['bedroom 2', 'ldry', 'store']) assert.ok(lower.verifiedNames.includes(name), `lower: ${name} is enclosed by measured walls`);

console.log('  KNOWN GAPS (not asserted): upper-floor west and north external walls classed internal (an external stair and the');
console.log('  dimension/retaining linework keep the outside test from reaching them); most upper-floor rooms only proposed;');
console.log('  master bedroom, balcony, dining and outdoor terrace have no boundary.');
console.log('jesmond real plan: floors held');
