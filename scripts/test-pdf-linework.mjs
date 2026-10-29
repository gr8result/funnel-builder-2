// PDF linework extraction through pdf.js 6: every path arrives as one constructPath operator whose
// coordinates are in the current transformation matrix's space. A PDF is written here with known
// lines under nested `cm` transforms, a saved/restored state and a closed rectangle path; the lines
// read back must land exactly where the page draws them. Where the Jesmond Road construction set
// is on this machine, its floor plans are read too and the lines must lie on the rendered ink.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { PDFDocument, pushGraphicsState, popGraphicsState, concatTransformationMatrix, moveTo, lineTo, closePath, stroke, setLineWidth, appendBezierCurve } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { compactPdfLinework, extractPdfLinework, readPdfPageLinework } from '../components/construction-estimation/ai-plan-takeoff/geometry/pdfLinework.js';

const near = (a, b, tolerance = 1e-3) => Math.abs(a - b) <= tolerance;
const has = (segments, x1, y1, x2, y2, tolerance = 1e-3) => segments.some((s) => (near(s.x1, x1, tolerance) && near(s.y1, y1, tolerance) && near(s.x2, x2, tolerance) && near(s.y2, y2, tolerance))
  || (near(s.x1, x2, tolerance) && near(s.y1, y2, tolerance) && near(s.x2, x1, tolerance) && near(s.y2, y1, tolerance)));

// ---- A real PDF: 600 x 400 pt page -------------------------------------------------------------
const pdf = await PDFDocument.create();
const page = pdf.addPage([600, 400]);
page.pushOperators(
  // Untransformed: a horizontal line at PDF y = 300 (viewport y = 100) from x 50 to 250.
  setLineWidth(2), moveTo(50, 300), lineTo(250, 300), stroke(),
  // CAD-style: drawn at 1/8 inside a scaled and translated frame, nested twice, in a saved state.
  pushGraphicsState(), concatTransformationMatrix(0.5, 0, 0, 0.5, 100, 50),
  pushGraphicsState(), concatTransformationMatrix(0.25, 0, 0, 0.25, 0, 0),
  setLineWidth(8), moveTo(0, 0), lineTo(800, 0), lineTo(800, 400), closePath(), stroke(),
  appendBezierCurve(0, 0, 0, 0, 0, 0), // degenerate curve: must not break the reading
  popGraphicsState(), popGraphicsState(),
  // After restore the matrix is the page's again: a vertical line x = 500 from PDF y 100 to 200.
  setLineWidth(1), moveTo(500, 100), lineTo(500, 200), stroke(),
);
const bytes = await pdf.save();
const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false }).promise;
const loaded = await doc.getPage(1);
const viewport = loaded.getViewport({ scale: 1 });
const operatorList = await loaded.getOperatorList();

// The old reading: top-level moveTo/lineTo. pdf.js 6 has none, which is why snapping never worked.
assert.equal(operatorList.fnArray.filter((fn) => fn === pdfjs.OPS.moveTo || fn === pdfjs.OPS.lineTo || fn === pdfjs.OPS.rectangle).length, 0, 'pdf.js 6 emits no top-level path operators');
assert.ok(operatorList.fnArray.includes(pdfjs.OPS.constructPath), 'paths arrive as constructPath');

const segments = extractPdfLinework(operatorList, pdfjs.OPS, viewport.transform);
const straight = segments.filter((s) => !s.curve);
assert.ok(has(straight, 50, 100, 250, 100), 'untransformed line at its viewport position (y flipped)');
// Inner frame: x' = 0.5 * (0.25 x) + 100, y' = 0.5 * (0.25 y) + 50; viewport y = 400 - y'.
// (0,0) -> (100, 350); (800,0) -> (200, 350); (800,400) -> (200, 300).
assert.ok(has(straight, 100, 350, 200, 350), 'nested-transform line placed through both matrices');
assert.ok(has(straight, 200, 350, 200, 300), 'second segment of the nested path');
assert.ok(has(straight, 200, 300, 100, 350), 'closePath closes back to the subpath start');
assert.ok(has(straight, 500, 300, 500, 200), 'restore returns to the page matrix');
const inner = straight.find((s) => has([s], 100, 350, 200, 350));
assert.ok(near(inner.widthPx, 8 * 0.125, 1e-6), `line width scales with the matrix (got ${inner.widthPx})`);
assert.ok(straight.every((s) => s.paint === 'stroke'), 'stroked paths are marked stroke');
const compact = compactPdfLinework([{ ...inner, color: '#123456', dashed: true, layer: 'walls' }])[0];
assert.equal(compact.paint, 'stroke', 'compact linework retains the paint operation');
assert.equal(compact.widthPx, inner.widthPx, 'compact linework retains scaled stroke width');
assert.equal(compact.color, '#123456', 'compact linework retains its pen color');
assert.equal(compact.dashed, true, 'compact linework retains dash state');
assert.equal(compact.layer, 'walls', 'compact linework retains optional-content layer');

// Scaled viewport (as the canvas renders at 6x): every point scales with it.
const big = loaded.getViewport({ scale: 6 });
const scaled = await readPdfPageLinework(loaded, big, pdfjs.OPS);
assert.ok(has(scaled.filter((s) => !s.curve), 300, 600, 1500, 600, 1e-2), 'readPdfPageLinework follows the viewport scale');

// ---- Synthetic operator list: form XObject matrix, fill paths and clipping paths --------------
const OPS = pdfjs.OPS;
const synthetic = {
  fnArray: [OPS.paintFormXObjectBegin, OPS.constructPath, OPS.paintFormXObjectEnd, OPS.constructPath, OPS.constructPath],
  argsArray: [
    [[2, 0, 0, 2, 10, 10], [0, 0, 100, 100]],
    [OPS.stroke, [new Float32Array([0, 0, 0, 1, 5, 0])], null],
    null,
    [OPS.eoFill, [new Float32Array([0, 0, 0, 1, 0, 7, 4])], null],
    [OPS.endPath, [new Float32Array([0, 0, 0, 1, 9, 9])], null],
  ],
};
const fromForm = extractPdfLinework(synthetic, OPS);
assert.ok(has(fromForm, 10, 10, 20, 10), 'form XObject matrix applies inside the form');
assert.ok(has(fromForm, 0, 0, 0, 7) && fromForm.some((s) => s.paint === 'fill'), 'fill paths are read and marked fill (matrix restored after the form)');
assert.equal(fromForm.length, 3, 'a path that paints nothing (clip/endPath) contributes no lines');

// ---- The real construction set, if present -----------------------------------------------------
const JESMOND = process.env.GR8_JESMOND_PDF || 'E:/dev/JESMOND ROAD INDOOROOPILLY CONTRUCTION ISSUE 10 01-07-2025.pdf';
if (fs.existsSync(JESMOND)) {
  const require = createRequire(import.meta.url);
  const { createCanvas } = require('@napi-rs/canvas');
  const real = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(JESMOND)), isEvalSupported: false }).promise;
  for (const [pageNumber, minimum] of [[4, 0.9], [5, 0.78]]) {
    const plan = await real.getPage(pageNumber);
    const vp = plan.getViewport({ scale: 228.6 / 72 });
    const canvas = createCanvas(Math.round(vp.width), Math.round(vp.height));
    const g = canvas.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, canvas.width, canvas.height);
    await plan.render({ canvasContext: g, viewport: vp }).promise;
    const image = g.getImageData(0, 0, canvas.width, canvas.height);
    const ink = (x, y) => { for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) { const ix = Math.round(x) + dx, iy = Math.round(y) + dy; if (ix < 0 || iy < 0 || ix >= image.width || iy >= image.height) continue; const p = (iy * image.width + ix) * 4; if (image.data[p] + image.data[p + 1] + image.data[p + 2] < 600) return true; } return false; };
    const lines = (await readPdfPageLinework(plan, vp, pdfjs.OPS)).filter((s) => s.paint === 'stroke' && !s.curve);
    let samples = 0, onInk = 0;
    for (const s of lines) { const n = Math.max(2, Math.min(40, Math.ceil(Math.hypot(s.x2 - s.x1, s.y2 - s.y1) / 4))); for (let k = 0; k <= n; k += 1) { samples += 1; if (ink(s.x1 + (s.x2 - s.x1) * k / n, s.y1 + (s.y2 - s.y1) * k / n)) onInk += 1; } }
    assert.ok(lines.length > 5000, `Jesmond page ${pageNumber}: drawn lines found (${lines.length})`);
    // Dashed lines are read as solid (dash patterns are not applied), so a share of samples falls in dash gaps.
    assert.ok(onInk / samples >= minimum, `Jesmond page ${pageNumber}: ${(100 * onInk / samples).toFixed(1)}% of line samples on rendered ink`);
    console.log(`  Jesmond page ${pageNumber}: ${lines.length} stroked lines, ${(100 * onInk / samples).toFixed(1)}% of samples on rendered ink`);
  }
} else console.log('  (Jesmond Road PDF not on this machine; real-plan check skipped)');

console.log('pdf linework: all checks passed');
