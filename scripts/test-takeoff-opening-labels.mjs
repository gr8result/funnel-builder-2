// Printed opening labels: size-code parsing, label-line finding, association to measured openings,
// settling held frames, splitting labelled multi-panel frames, conflicts held for review, and (when the
// local language data is present) a real local OCR read of rendered labels. No network access.
import assert from 'node:assert/strict';
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
import { parseOpeningLabel, proposeLabelLines, associateOpeningLabels, applyOpeningLabels, splitPanelsByLabels, applyPrintedLabels } from '../components/construction-estimation/ai-plan-takeoff/geometry/openingLabels.js';
import { scoredReading, labelCrop, recogniseOpeningLabels, createTesseractLabelReader } from '../components/construction-estimation/ai-plan-takeoff/geometry/localLabelOcr.js';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
// A named installed font: the generic sans-serif family does not resolve on every machine.
const FONT = GlobalFonts.families.some((f) => f.family === 'Arial') ? 'Arial' : GlobalFonts.families[0]?.family || 'sans-serif';

// 1. Size codes.
{
  const p = (t) => parseOpeningLabel(t);
  assert.deepEqual([p('2118 GSD').heightMm, p('2118 GSD').widthMm, p('2118 GSD').kind], [2100, 1800, 'sliding-door']);
  assert.equal(p('2124SGD').kind, 'sliding-door', 'suffix written against the number');
  assert.equal(p('2124 SOD').kind, 'sliding-door', 'misread middle letter of SGD');
  assert.equal(p('2131 stacker').widthMm, 3100);
  assert.deepEqual([p('1809LV').kind, p('1809LV').widthMm, p('1809LV').heightMm], ['window', 900, 1800]);
  assert.equal(p('0315 FG OBS').widthMm, 1500);
  assert.equal(p('1224').kind, 'window', 'below door height: a window');
  assert.equal(p('2124').kind, 'door-height', 'full height with no suffix: undecided');
  assert.deepEqual([p('820').form, p('820').leafWidthMm], ['leaf', 820]);
  assert.equal(p('720 CSD').kind, 'cavity-slider');
  assert.deepEqual([p('2 x 820').leaves, p('2 x 820').leafWidthMm], [2, 820]);
  assert.deepEqual([p('2100 x 645 FG SL').heightMm, p('2100 x 645 FG SL').widthMm], [2100, 645]);
  for (const bad of ['5600', '1200', '3', 'Bedroom 3', '100 Step down', '835']) assert.equal(p(bad), null, `${bad} is not a size label`);
  assert.equal(p('1430 - 3 door').knownSuffix, false, 'a joinery note is parsed but flagged as unknown words');
}

// 2. OCR confidence: a faint suffix read badly is dropped, the number is kept and trusted on its own.
{
  const sym = (s, c) => [...s].map((ch) => ({ text: ch, confidence: c }));
  const read = scoredReading({ text: '1809Lv', confidence: 37, symbols: [...sym('1809', 95), ...sym('Lv', 30)] });
  assert.equal(read.text, '1809'); assert.equal(read.ocrConfidence, 95); assert.equal(read.parsed.kind, 'window');
  const good = scoredReading({ text: '2118 GSD', confidence: 90, symbols: [...sym('2118', 96), ...sym('GSD', 92)] });
  assert.equal(good.parsed.kind, 'sliding-door'); assert.equal(good.ocrConfidence, 92);
}

// 3. Label lines found in a raster: horizontal and vertical text, never the long lines beside them.
function sheet(items, { w = 900, h = 700, lines = [] } = {}) {
  const c = createCanvas(w, h), g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#000'; g.lineWidth = 1.5; for (const [a, b, x, y] of lines) { g.beginPath(); g.moveTo(a, b); g.lineTo(x, y); g.stroke(); }
  g.fillStyle = '#000'; g.font = `22px ${FONT}`;
  for (const { text, x, y, rotate = 0 } of items) { g.save(); g.translate(x, y); g.rotate(rotate); g.fillText(text, 0, 0); g.restore(); }
  return g.getImageData(0, 0, w, h);
}
const raster = sheet([{ text: '1809 DH', x: 100, y: 120 }, { text: '2118 GSD', x: 600, y: 225, rotate: Math.PI / 2 }],
  { lines: [[50, 200, 850, 200], [50, 206, 850, 206], [540, 40, 540, 660]] });
// The raster is 3 px per logical px (as a stored sheet is), so the text is about 5 logical px tall.
const RASTER_K = 3, LOGICAL_W = 900 / RASTER_K;
{
  const { lines } = proposeLabelLines(raster, { logicalWidth: LOGICAL_W });
  assert.ok(lines.some((l) => l.orientation === 'h' && Math.abs(l.logical.y * RASTER_K - 112) < 12 && l.logical.x * RASTER_K < 250), 'horizontal label found');
  assert.ok(lines.some((l) => l.orientation === 'v' && Math.abs(l.logical.x * RASTER_K - 607) < 12 && l.logical.y * RASTER_K > 225), 'vertical label found');
  assert.ok(!lines.some((l) => l.logical.length * RASTER_K > 400), 'long wall lines are not text');
  const crop = labelCrop(raster, lines.find((l) => l.orientation === 'v'), 90);
  assert.ok(crop.width > crop.height, 'vertical label turned to read along its length');
}

// 4. Association and application.
const ppm = 0.05; // logical px per mm
const along = { x: 1, y: 0 };
const opening = (id, kind, xMm, widthMm, extra = {}) => ({ id, kind, confirmed: true, x: xMm * ppm, y: 0, direction: along, widthMm, ...extra });
const label = (text, xMm, yMm, extra = {}) => ({ text, parsed: parseOpeningLabel(text), x: xMm * ppm, y: yMm * ppm, orientation: 'h', confidence: 0.95, ocrConfidence: 95, source: 'local-ocr', ...extra });
{
  const frame = opening('f', 'window', 2000, 1798, { frameUnit: true, needsClassification: true });
  const door = opening('d', 'door', 5000, 823, { leafMm: 823, measurements: { leafWidthMm: 823 } });
  const labels = [label('2118 GSD', 2050, 450), label('820', 5000, -400), label('1809', 5100, 500)];
  const assoc = associateOpeningLabels(labels, [frame, door], { pixelsPerMm: ppm });
  assert.deepEqual(assoc.assignments.map((a) => `${a.label.text}->${a.opening.id}`).sort(), ['2118 GSD->f', '820->d']);
  assert.ok(!assoc.assignments.some((a) => a.label.text === '1809'), 'a window code is never given to a swing door');
  const report = applyOpeningLabels([frame, door], assoc);
  assert.equal(frame.kind, 'sliding-door'); assert.equal(frame.needsClassification, false, 'the label settles the held frame');
  assert.equal(frame.widthMm, 1798, 'the measured width is kept'); assert.equal(frame.heightMm, 2100);
  assert.equal(frame.measurements.labelFrameWidthMm, 1800);
  assert.equal(door.measurements.leafWidthMm, 823, 'the drawn leaf stays the leaf'); assert.equal(door.measurements.labelLeafWidthMm, 820);
  assert.equal(report.resolved.length, 1);
}
{
  // Width disagreement: attached as weak evidence, never applied.
  const frame = opening('f', 'window', 2000, 1650, { frameUnit: true, needsClassification: true });
  const assoc = associateOpeningLabels([label('2121 SGD', 2000, 450)], [frame], { pixelsPerMm: ppm });
  const report = applyOpeningLabels([frame], assoc);
  assert.equal(frame.needsClassification, true); assert.equal(report.weak.length, 1);
  // Far too different: not associated at all.
  assert.equal(associateOpeningLabels([label('2136 SGD', 2000, 450)], [opening('g', 'window', 2000, 1200)], { pixelsPerMm: ppm }).assignments.length, 0);
}
{
  // Ambiguous: two equally placed openings; a note with unknown words; a low-confidence read.
  const a = opening('a', 'window', 1000, 900), b = opening('b', 'window', 2400, 900);
  const assoc = associateOpeningLabels([label('1809', 1700, 400)], [a, b], { pixelsPerMm: ppm });
  assert.equal(assoc.assignments.length, 0); assert.equal(assoc.ambiguous.length, 1);
  assert.equal(associateOpeningLabels([label('1809 niche', 1000, 300)], [a], { pixelsPerMm: ppm }).assignments.length, 0);
  const weak = associateOpeningLabels([label('1809 DH', 1000, 300, { confidence: 0.5 })], [{ ...a, needsClassification: true, frameUnit: true }], { pixelsPerMm: ppm });
  const held = weak.assignments[0].opening; applyOpeningLabels([held], weak);
  assert.equal(held.needsClassification, true, 'a weak read never settles anything');
}
{
  // A label contradicting the drawn symbol holds the opening for the builder.
  const garage = opening('g', 'garage-door', 3000, 3227);
  applyOpeningLabels([garage], associateOpeningLabels([label('2136 STACKER', 3000, 500)], [garage], { pixelsPerMm: ppm }));
  assert.equal(garage.needsClassification, true); assert.match(garage.labelConflict, /STACKER/);
  // A leaf label is only given to a gap it fits.
  assert.equal(associateOpeningLabels([label('720', 3000, 300)], [opening('gap', 'opening', 3000, 1876, { confirmed: false })], { pixelsPerMm: ppm }).assignments.length, 0);
  assert.equal(associateOpeningLabels([label('820', 3000, 300)], [opening('gap', 'opening', 3000, 900, { confirmed: false })], { pixelsPerMm: ppm }).assignments.length, 1);
}

// 5. Labelled panels of one held frame are separate windows; otherwise the frame is left alone.
{
  const bank = () => opening('bank', 'window', 10000, 3600, { needsClassification: true, panelCount: 4, hostWallIds: ['w1'] });
  const four = ['1809 LV', '1809 FG', '1809 FG', '1809 LV'].map((t, i) => label(t, 10000 - 1350 + i * 900, 300));
  const split = splitPanelsByLabels([bank()], four, { pixelsPerMm: ppm });
  assert.equal(split.openings.length, 4); assert.ok(split.openings.every((o) => o.kind === 'window' && !o.needsClassification && o.widthMm === 900 && o.hostWallIds[0] === 'w1'));
  assert.deepEqual(split.openings.map((o) => Math.round(o.x / ppm)), [8650, 9550, 10450, 11350]);
  assert.equal(splitPanelsByLabels([bank()], four.slice(0, 3), { pixelsPerMm: ppm }).openings.length, 1, 'labels not adding up to the frame: unchanged');
  const bunched = ['1809', '1809', '1809', '1809'].map((t, i) => label(t, 8700 + i * 150, 300));
  assert.equal(splitPanelsByLabels([bank()], bunched, { pixelsPerMm: ppm }).openings.length, 1, 'labels not each within their own panel: unchanged');
  // One label spanning the whole box: one window.
  const found = { openings: [opening('box', 'window', 10000, 2423, { needsClassification: true, panelCount: 4 })] };
  const report = applyPrintedLabels(found, [label('1824', 10000, 350)], { pixelsPerMm: ppm });
  assert.equal(found.openings.length, 1); assert.equal(found.openings[0].needsClassification, false); assert.equal(report.resolved[0].kind, 'window');
}
console.log('Opening labels: size codes, suffix confidence, label lines, association, settling, weak/ambiguous/conflict handling and panel splitting passed.');

// 6. Real local OCR (skipped without the local language data; never downloads it).
const tessdata = process.env.TAKEOFF_TESSDATA || path.join(process.cwd(), 'public/takeoff-ocr/tessdata');
if (!fs.existsSync(path.join(tessdata, 'eng.traineddata'))) { console.log(`SKIPPED local OCR read: no eng.traineddata in ${tessdata}`); process.exit(0); }
const reader = await createTesseractLabelReader({ createWorker: require('tesseract.js').createWorker, langPath: tessdata, cachePath: path.join(process.cwd(), 'artifacts/test-results/takeoff-ocr-cache'), toImage: (crop) => Buffer.from(crop.bytes) });
try {
  const L = (x, y) => ({ x: x / RASTER_K, y: y / RASTER_K });
  const walls = [{ nodes: [L(50, 200), L(850, 200)] }, { nodes: [L(540, 40), L(540, 660)] }];
  const read = await recogniseOpeningLabels({ raster, logicalWidth: LOGICAL_W, pixelsPerMm: 0.05, walls, reader });
  const texts = read.labels.map((l) => l.parsed.code + ':' + l.parsed.kind);
  assert.ok(texts.includes('1809:window'), `horizontal label read (${texts})`);
  console.log(read.labels.map((l) => `${l.text} raw="${l.rawText}" ocr=${l.ocrConfidence} rot=${l.rotation}`));
  assert.ok(texts.includes("2118:sliding-door"), `vertical label read in its reading direction (${texts})`);
  console.log('Local OCR read the rendered labels:', read.labels.map((l) => `"${l.text}" (${l.ocrConfidence})`).join(', '));
} finally { await reader.terminate(); }
