// Local OCR of opening size labels on the benchmark plans (Liberty, Jesmond lower and upper), scored
// against the printed labels recorded in the hand references. Local only: tesseract.js with language
// data from a local folder (--tessdata <dir> containing eng.traineddata, tessdata_fast, Apache-2.0).
//   node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs \
//     scripts/takeoff-label-ocr-eval.mjs --tessdata <dir> [--json out.json] [--verbose]
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
import { detectVectorWalls } from '../components/construction-estimation/ai-plan-takeoff/geometry/vectorWalls.js';
import { recogniseOpeningLabels, createTesseractLabelReader } from '../components/construction-estimation/ai-plan-takeoff/geometry/localLabelOcr.js';
import { associateOpeningLabels, applyOpeningLabels, parseOpeningLabel } from '../components/construction-estimation/ai-plan-takeoff/geometry/openingLabels.js';

const root = process.cwd();
const require = createRequire(path.join(root, 'package.json'));
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { createWorker } = require('tesseract.js');
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]] : acc), []));
const tessdata = args.tessdata || path.join(root, 'public/takeoff-ocr/tessdata');
if (!fs.existsSync(path.join(tessdata, 'eng.traineddata'))) { console.log(`SKIPPED: no local eng.traineddata in ${tessdata}`); process.exit(0); }

const cache = path.join(root, 'artifacts/test-results/takeoff-quick-accuracy-cache');
const jesRef = path.join(root, '.claude/worktrees/ai-takeoff-geometry/recovery/plan-references/jesmond-road/reference.json');
const libDir = path.join(root, 'artifacts/test-results/vector-regression-2026-10-18/frozen');
const sheets = [];
if (fs.existsSync(path.join(libDir, 'application-input.json'))) sheets.push({ name: 'Liberty', dir: libDir, ref: JSON.parse(fs.readFileSync(path.join(libDir, 'reference.json'), 'utf8')), page: 1 });
if (fs.existsSync(cache) && fs.existsSync(jesRef)) for (const [name, page] of [['Jesmond Lower', 5], ['Jesmond Upper', 4]]) {
  const d = fs.readdirSync(cache).find((x) => x.startsWith('JESMOND') && x.endsWith('-p' + page));
  if (d) sheets.push({ name, dir: path.join(cache, d), ref: JSON.parse(fs.readFileSync(jesRef, 'utf8')), page });
}

// The label a reference opening's note records, when the note starts with one.
function expectedLabel(note) {
  const m = String(note || '').match(/^\s*((?:2\s*x\s*\d{3})|(?:\d{4}\s*x\s*\d{3,4})|(?:\d{4}(?:\s*[A-Za-z]{2,7})*)|(?:\d{3}))(?=[\s,(]|$)/i);
  if (!m) return null;
  const parsed = parseOpeningLabel(m[1].replace(/\b(window|entry|doors?|centre|opening|servery|linen|barn)\b.*$/i, '').trim());
  return parsed ? { raw: m[1].trim(), parsed } : null;
}
// A pair of leaves is usually labelled once per leaf ("820" on each of "2 x 820").
const sameLabel = (a, b) => a.form.startsWith('leaf') ? b.form.startsWith('leaf') && a.leafWidthMm === b.leafWidthMm
  : (a.code && b.code ? a.code === b.code : a.widthMm === b.widthMm && a.heightMm === b.heightMm);

const reader = await createTesseractLabelReader({ createWorker, langPath: tessdata, cachePath: path.join(root, 'artifacts/test-results/takeoff-ocr-cache'), toImage: (crop) => Buffer.from(crop.bytes) });
const results = [];
for (const sheet of sheets) {
  const input = JSON.parse(fs.readFileSync(path.join(sheet.dir, 'application-input.json'), 'utf8'));
  const img = await loadImage(fs.readFileSync(path.join(sheet.dir, 'application-raster.png')));
  const canvas = createCanvas(img.width, img.height); canvas.getContext('2d').drawImage(img, 0, 0);
  const raster = canvas.getContext('2d').getImageData(0, 0, img.width, img.height); raster.storedPixelsPerMm = input.storedPixelsPerMm;
  const found = detectVectorWalls(input.vectorSegments, { ...input, raster, textItems: input.textItems || [] }, {});
  const started = Date.now();
  const read = await recogniseOpeningLabels({ raster, logicalWidth: input.logicalWidth, pixelsPerMm: input.pixelsPerMm, walls: found.walls, textItems: input.textItems || [], reader });
  const seconds = (Date.now() - started) / 1000;
  const association = associateOpeningLabels(read.labels, found.openings, { pixelsPerMm: input.pixelsPerMm });
  const applied = applyOpeningLabels(found.openings, association);
  const refOpenings = sheet.ref.openings.filter((o) => (o.page || 1) === sheet.page);
  const nearestRef = (p) => refOpenings.map((r) => ({ r, d: Math.hypot(r.x - p.x, r.y - p.y) / input.pixelsPerMm })).sort((a, b) => a.d - b.d)[0];
  const expected = refOpenings.map((r) => ({ r, exp: expectedLabel(r.note) })).filter((e) => e.exp);
  const recognised = [], missed = [];
  for (const { r, exp } of expected) {
    const hit = read.labels.filter((l) => sameLabel(l.parsed, exp.parsed) && Math.hypot(l.x - r.x, l.y - r.y) / input.pixelsPerMm <= 1800)
      .sort((a, b) => Math.hypot(a.x - r.x, a.y - r.y) - Math.hypot(b.x - r.x, b.y - r.y))[0];
    if (hit) recognised.push({ ref: r.id, expected: exp.raw, read: hit.text, ocr: hit.ocrConfidence, source: hit.source });
    else missed.push({ ref: r.id, expected: exp.raw });
  }
  // Association check: the opening a label was given must be the reference opening carrying that label.
  const assoc = association.assignments.map((a) => {
    const near = nearestRef(a.opening); const exp = near && near.d <= 600 ? expectedLabel(near.r.note) : null;
    const p = a.label.parsed, refOpening = near && near.d <= 600 ? near.r : null;
    // Correct when it is the reference's printed label, or a width label equal to that opening's own width.
    const correct = Boolean(refOpening && ((exp && sameLabel(exp.parsed, p)) || (p.form === 'leaf' && (p.leafWidthMm === refOpening.widthMm || p.leafWidthMm * 2 === refOpening.widthMm))));
    return { label: a.label.text, labelAt: [Math.round(a.label.x), Math.round(a.label.y)], openingAt: [Math.round(a.opening.x), Math.round(a.opening.y)], nearestRef: near?.r.id, nearestRefMm: Math.round(near?.d || 0), opening: a.opening.id, openingKind: a.opening.kind, openingWidthMm: Math.round(a.opening.widthMm), ref: near && near.d <= 600 ? near.r.id : null, refLabel: exp?.raw || null, correct, widthAgrees: a.fit.agrees };
  });
  const result = { sheet: sheet.name, seconds, stats: read.stats, expected: expected.length, recognised, missed,
    associations: assoc, wrongAssociations: assoc.filter((a) => !a.correct), ambiguous: association.ambiguous.map((a) => ({ label: a.label.text, reason: a.reason })),
    unassignedLabels: association.unassigned.map((l) => ({ text: l.text, x: Math.round(l.x), y: Math.round(l.y), nearestRef: nearestRef(l)?.r.id, refMm: Math.round(nearestRef(l)?.d || 0) })),
    resolved: applied.resolved, conflicts: applied.conflicts, weak: applied.weak.map((w) => ({ id: w.id, text: w.text, widthAgrees: w.widthAgrees })),
    unreadable: read.unreadable.length, allLabels: read.labels.map((l) => `${l.text}@${Math.round(l.x)},${Math.round(l.y)}(${l.ocrConfidence ?? 'txt'})`) };
  results.push(result);
  console.log(`\n== ${sheet.name}: ${recognised.length}/${expected.length} printed labels recognised, ${assoc.filter((a) => a.correct).length}/${assoc.length} associations correct, ${applied.resolved.length} held frames settled, ${seconds.toFixed(1)} s (${read.stats.read} lines read)`);
  console.log('  recognised:', recognised.map((r) => `${r.ref}="${r.read}"`).join(', '));
  console.log('  missed:', missed.map((m) => `${m.ref} (${m.expected})`).join(', ') || 'none');
  console.log('  wrong associations:', result.wrongAssociations.map((a) => `"${a.label}"->${a.opening}(${a.openingKind} ${a.openingWidthMm}) near ${a.ref || 'no ref'}${a.refLabel ? ` [${a.refLabel}]` : ''}`).join('; ') || 'none');
  console.log('  ambiguous:', result.ambiguous.map((a) => `"${a.label}" ${a.reason}`).join('; ') || 'none');
  console.log('  settled:', applied.resolved.map((r) => `${r.id}->${r.kind} "${r.text}"`).join(', ') || 'none', '| conflicts:', applied.conflicts.map((c) => `${c.id} ${c.drawn} vs "${c.label}"`).join(', ') || 'none');
  if (args.verbose) { console.log('  unassigned:', result.unassignedLabels.map((l) => `${l.text}@${l.x},${l.y} ~${l.nearestRef} ${l.refMm}mm`).join('; ')); console.log('  all:', result.allLabels.join(' ')); }
}
await reader.terminate();
if (args.json) fs.writeFileSync(args.json, JSON.stringify(results, null, 2));
