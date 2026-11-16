// Local OCR of opening size labels. Labels on many architectural PDFs are drawn as outlined vector
// glyphs, absent from the text layer; they are read here from the sheet's own raster. Everything runs
// on this machine: the caller supplies a local OCR reader (createTesseractLabelReader with tesseract.js,
// Apache-2.0, and its language data served from our own files). No network service is called.
import { LABEL_DEFAULTS, labelsFromTextLayer, parseOpeningLabel, proposeLabelLines } from './openingLabels.js';

const TARGET_TEXT_PX = 40;

// One label line cut from the raster, turned to read left to right, enlarged, as greyscale PGM bytes
// (read natively by Tesseract's image loader in Node and in the browser).
export function labelCrop(raster, line, rotation) {
  const { width: W, height: H, data } = raster;
  // Across the line a little margin; along it more, so a trailing suffix or a faint end glyph is kept.
  const across = Math.ceil(line.textPx * 0.2), along = Math.ceil(line.textPx * 1.1);
  const padX = line.orientation === 'h' ? along : across, padY = line.orientation === 'h' ? across : along;
  const x0 = Math.max(0, line.box.x0 - padX), y0 = Math.max(0, line.box.y0 - padY);
  const x1 = Math.min(W - 1, line.box.x1 + padX), y1 = Math.min(H - 1, line.box.y1 + padY);
  const s = Math.max(1, TARGET_TEXT_PX / line.textPx);
  const srcW = x1 - x0 + 1, srcH = y1 - y0 + 1;
  const outAlong = rotation === 0 ? srcW : srcH, outAcross = rotation === 0 ? srcH : srcW;
  const border = 12, w = Math.round(outAlong * s) + 2 * border, h = Math.round(outAcross * s) + 2 * border;
  const out = new Uint8Array(w * h).fill(255);
  // The region's luminance with long straight ink runs erased: deck boards, hatch, dimension and leader
  // lines passing under a label are longer than any glyph stroke; the glyphs are kept.
  const region = new Float32Array(srcW * srcH);
  for (let y = 0; y < srcH; y++) for (let x = 0; x < srcW; x++) {
    const p = ((y + y0) * W + x + x0) * 4;
    region[y * srcW + x] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
  }
  const longRun = Math.max(6, Math.round(line.textPx * 1.6)), erase = new Uint8Array(srcW * srcH);
  // A run reaching the crop's end along the reading direction is a line passing through, even when
  // only its stub is inside the crop.
  const runs = (count, length, at, alongReading) => {
    for (let i = 0; i < count; i++) {
      let start = -1;
      for (let j = 0; j <= length; j++) {
        const inked = j < length && region[at(i, j)] < 185;
        if (inked && start < 0) start = j;
        if (!inked && start >= 0) { const stub = alongReading && (start === 0 || j === length) && j - start >= 0.6 * line.textPx; if (j - start >= longRun || stub) for (let q = start; q < j; q++) erase[at(i, q)] = 1; start = -1; }
      }
    }
  };
  runs(srcH, srcW, (y, x) => y * srcW + x, line.orientation === 'h');
  runs(srcW, srcH, (x, y) => y * srcW + x, line.orientation === 'v');
  for (let i = 0; i < erase.length; i++) if (erase[i]) region[i] = 255;
  const lum = (x, y) => region[Math.max(0, Math.min(srcH - 1, y - y0)) * srcW + Math.max(0, Math.min(srcW - 1, x - x0))];
  const sample = (x, y) => {
    const fx = Math.floor(x), fy = Math.floor(y), ax = x - fx, ay = y - fy;
    return (lum(fx, fy) * (1 - ax) + lum(fx + 1, fy) * ax) * (1 - ay) + (lum(fx, fy + 1) * (1 - ax) + lum(fx + 1, fy + 1) * ax) * ay;
  };
  for (let v = 0; v < h - 2 * border; v++) for (let u = 0; u < w - 2 * border; u++) {
    const a = u / s, c = v / s;
    // rotation 0: as drawn. 90: text reading downward (tops toward +x). 270: reading upward (tops toward -x).
    const sx = rotation === 0 ? x0 + a : rotation === 90 ? x1 - c : x0 + c;
    const sy = rotation === 0 ? y0 + c : rotation === 90 ? y0 + a : y1 - a;
    const g = sample(sx, sy);
    out[(v + border) * w + u + border] = g < 140 ? 0 : g > 200 ? 255 : Math.round((g - 140) * 255 / 60);
  }
  return { bytes: pgm(out, w, h), width: w, height: h };
}

function pgm(pixels, w, h) {
  const header = new TextEncoder().encode(`P5\n${w} ${h}\n255\n`);
  const bytes = new Uint8Array(header.length + pixels.length); bytes.set(header); bytes.set(pixels, header.length);
  return bytes;
}

const segmentDistance = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
};

// Reads every label line near the measured walls. Returns labels in logical px with their parse, OCR
// confidence and source, plus the lines that were read but did not parse (reported, never applied).
export async function recogniseOpeningLabels({ raster, logicalWidth, pixelsPerMm, walls = [], textItems = [], reader }, overrides = {}) {
  const o = { ...LABEL_DEFAULTS, ...overrides };
  const fromText = labelsFromTextLayer(textItems);
  const { lines } = proposeLabelLines(raster, { logicalWidth }, o);
  const near = lines.filter((line) => walls.some((w) => w.nodes?.length >= 2 && segmentDistance(line.logical, w.nodes[0], w.nodes[w.nodes.length - 1]) <= o.nearWallMm * pixelsPerMm));
  // Text the PDF already carries is not read again.
  const covered = (line) => textItems.some((t) => Math.hypot((t.x ?? 0) - line.logical.x, (t.y ?? 0) - line.logical.y) <= Math.max(3, line.logical.length / 2));
  const todo = near.filter((line) => !covered(line));
  const labels = [...fromText], unreadable = [];
  for (const line of todo) {
    const rotations = line.orientation === 'h' ? [0] : [90, 270];
    let best = null;
    for (const box of [line, ...(line.alternatives || [])]) for (const rotation of rotations) {
      const crop = labelCrop(raster, box, rotation);
      const read = await reader.read(crop);
      const candidate = { rotation, ...scoredReading(read) };
      if (!best || rank(candidate) > rank(best)) best = candidate;
    }
    if (!best?.parsed || best.ocrConfidence < o.minOcrConfidence) {
      if (best?.text?.trim()) unreadable.push({ text: best.text.trim(), ocrConfidence: best.ocrConfidence, x: line.logical.x, y: line.logical.y, orientation: line.orientation, parsed: Boolean(best.parsed) });
      continue;
    }
    labels.push({ text: best.text.trim(), rawText: best.rawText, parsed: best.parsed, x: line.logical.x, y: line.logical.y, orientation: line.orientation,
      textHeight: line.logical.textHeight, rotation: best.rotation, ocrConfidence: Math.round(best.ocrConfidence), confidence: best.ocrConfidence / 100, source: 'local-ocr' });
  }
  return { labels, unreadable, stats: { lines: lines.length, nearWalls: near.length, read: todo.length, textLayer: fromText.length, labels: labels.length } };
}
// Room names printed as outlined glyphs (or on a scan) have no text layer. Every text line inside the
// building that reads clearly as a short room name becomes a room label; lines already read by the
// opening pass are reused, not read again. Anything else (notes, sizes, ceiling heights) is ignored.
export const ROOM_NAME_WORDS = /^(?:(?:master|main|guest|kids?|upper|lower|side|front|rear|open|outdoor)\s+)?(?:bed(?:room)?(?:\s*\d)?|living|lounge|family|dining|meals|kitchen|ens(?:uite)?|bath(?:room)?|wc|toilet|powder|pdr|laundry|ldry|wir|wip|robe|pantry|study|office|media|theatre|garage|carport|porch|alfresco|entry|foyer|hall(?:way)?|linen|lin|store|storage|rumpus|games|activity|retreat|patio|deck|balcony|terrace|scullery|butler|mud\s*room|pooja|gym|cellar|nook|lobby|void)(?:\s*\d)?$/i;
export async function recogniseRoomLabels({ raster, logicalWidth, pixelsPerMm, walls = [], textItems = [], reader, alreadyRead = [] }, overrides = {}) {
  const o = { ...LABEL_DEFAULTS, minRoomOcrConfidence: 85, roomNameTextReachMm: 3000, ...overrides };
  if (!walls.length) return { labels: [], stats: { read: 0, labels: 0 } };
  const pts = walls.flatMap((w) => w.nodes || []);
  const box = { x0: Math.min(...pts.map((p) => p.x)), x1: Math.max(...pts.map((p) => p.x)), y0: Math.min(...pts.map((p) => p.y)), y1: Math.max(...pts.map((p) => p.y)) };
  const { lines } = proposeLabelLines(raster, { logicalWidth }, o);
  const inside = lines.filter((l) => l.logical.x >= box.x0 && l.logical.x <= box.x1 && l.logical.y >= box.y0 && l.logical.y <= box.y1);
  const covered = (line) => textItems.some((t) => Math.hypot((t.x ?? 0) - line.logical.x, (t.y ?? 0) - line.logical.y) <= Math.max(3, line.logical.length / 2));
  const readBefore = (line) => alreadyRead.find((r) => Math.hypot(r.x - line.logical.x, r.y - line.logical.y) <= 0.5);
  const near = (line) => walls.some((w) => w.nodes?.length >= 2 && segmentDistance(line.logical, w.nodes[0], w.nodes[w.nodes.length - 1]) <= o.nearWallMm * pixelsPerMm);
  const labels = []; let read = 0;
  for (const line of inside) {
    if (covered(line)) continue;
    const before = readBefore(line);
    if (!before && near(line)) continue; // the opening pass read it and it was a size label
    // The opening pass ranks readings for size codes; a line it did not read as a room name is read again.
    let best = before && ROOM_NAME_WORDS.test(String(before.text || '').trim()) ? { text: before.text, ocrConfidence: before.ocrConfidence } : null;
    if (!best) {
      read += 1;
      for (const rotation of line.orientation === 'h' ? [0] : [90, 270]) {
        const r = await reader.read(labelCrop(raster, line, rotation));
        const candidate = { text: String(r.text || '').trim(), ocrConfidence: r.confidence || 0 };
        if (!best || candidate.ocrConfidence > best.ocrConfidence) best = candidate;
      }
    }
    const text = String(best?.text || '').replace(/\s+/g, ' ').trim();
    // Outlined (hollow) glyphs read correctly but with a low score; a whole line that is exactly a room
    // name of five or more letters is not produced by chance, so it is accepted at any score.
    const exactLongName = ROOM_NAME_WORDS.test(text) && text.replace(/[^A-Za-z]/g, '').length >= 5;
    if (!text || !ROOM_NAME_WORDS.test(text) || (best.ocrConfidence < o.minRoomOcrConfidence && !exactLongName)) continue;
    // The PDF already prints this name here: its own text is exact, so the reading adds nothing.
    const sameName = (t) => String(t.text || '').trim().toLowerCase() === text.toLowerCase()
      && Math.hypot((t.x ?? 0) - line.logical.x, (t.y ?? 0) - line.logical.y) <= o.roomNameTextReachMm * pixelsPerMm;
    if (textItems.some(sameName)) continue;
    labels.push({ text, x: line.logical.x, y: line.logical.y, ocrConfidence: Math.round(best.ocrConfidence), source: 'local-ocr' });
  }
  return { labels, stats: { lines: inside.length, read, labels: labels.length } };
}

// The number and its suffix are scored separately: a faint suffix (LV, DH) read with low confidence is
// dropped and the code kept on its own; the number's own confidence is what the label is trusted by.
export function scoredReading(read, minSuffixConfidence = 55) {
  const raw = String(read.text || '').trim();
  // A stray mark read in front of the label ("3  1806"): one or two leading characters that are not a
  // word are dropped once. Longer leading words are kept, so a note never turns into a label.
  const trimmed = raw.replace(/^\s*[^\s]{1,2}\s+(?=\d)/, '').trim();
  let text = !parseOpeningLabel(raw) && trimmed !== raw && parseOpeningLabel(trimmed) ? trimmed : raw;
  // A drawn mark beside the label read as one or two short trailing tokens ("1809LV x": the cross of a
  // downpipe symbol; "2136 STACKER f": a wall line through the next word). Dropped once, and only when
  // what remains is a complete code with a recognised type word ("1809 LV", "2136 STACKER"); a bare
  // number or a note never becomes a label this way. The dropped marks do not count against the
  // confidence of the label they sit beside.
  let tail = 0;
  const whole = parseOpeningLabel(text);
  if (whole) {
    const words = text.split(/\s+/);
    for (let k = 1; k <= 2 && k < words.length; k += 1) {
      const dropped = words.slice(-k);
      if (!dropped.every((w) => /^[A-Za-z0-9]{1,2}$/.test(w))) break;
      const keptText = words.slice(0, -k).join(' '), kept = parseOpeningLabel(keptText);
      if (kept?.knownSuffix && kept.suffix && (!whole.knownSuffix || kept.text === whole.text)) { text = keptText; tail = dropped.join('').length; break; }
    }
  }
  const allSymbols = read.symbols || [];
  const symbols = tail ? allSymbols.slice(0, Math.max(0, allSymbols.length - tail)) : allSymbols;
  if (!symbols.length) return { text, rawText: raw, ocrConfidence: read.confidence, parsed: parseOpeningLabel(text) };
  const digits = symbols.filter((sym) => /\d/.test(sym.text));
  const letters = symbols.filter((sym) => /[A-Za-z]/.test(sym.text) && !/^x$/i.test(sym.text));
  const numberConfidence = digits.length ? Math.min(...digits.map((sym) => sym.confidence)) : read.confidence;
  const suffixConfidence = letters.length ? Math.min(...letters.map((sym) => sym.confidence)) : 100;
  let parsed = parseOpeningLabel(text), used = text, confidence = Math.min(numberConfidence, suffixConfidence);
  if ((!parsed || suffixConfidence < minSuffixConfidence) && letters.length) {
    const bare = text.match(/^\s*(\d{3,4}(?:\s*[xX]\s*\d{3,4})?)(?![\d])/)?.[1];
    const reparsed = bare ? parseOpeningLabel(bare) : null;
    if (reparsed) { parsed = reparsed; used = bare.trim(); confidence = numberConfidence; }
  }
  return { text: used, rawText: raw, ocrConfidence: confidence, parsed };
}
const rank = (c) => (c.parsed ? 1000 : 0) + (c.parsed?.knownSuffix ? 100 : 0) + (c.ocrConfidence || 0);

// A label reader over a local tesseract.js worker. The caller passes createWorker (from tesseract.js)
// and local paths for the language data and, in the browser, the worker and core files, so nothing is
// fetched from a CDN. Lines are read one at a time as a single text line.
export async function createTesseractLabelReader({ createWorker, langPath, cachePath, workerPath, corePath, toImage }) {
  const options = { langPath, gzip: false, ...(cachePath ? { cachePath } : {}), ...(workerPath ? { workerPath } : {}), ...(corePath ? { corePath } : {}) };
  const worker = await createWorker('eng', 1, options);
  await worker.setParameters({
    tessedit_pageseg_mode: '7',
    tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz ',
    user_defined_dpi: '300',
    preserve_interword_spaces: '1',
  });
  return {
    async read(crop) {
      const image = toImage ? toImage(crop) : crop.bytes;
      const { data } = await worker.recognize(image, {}, { blocks: true });
      const words = (data.blocks || []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words)));
      const confidence = words.length ? Math.min(...words.map((w) => w.confidence)) : data.confidence || 0;
      const symbols = words.flatMap((w) => (w.symbols || []).map((sym) => ({ text: sym.text, confidence: sym.confidence })));
      return { text: words.length ? words.map((w) => w.text).join(' ') : (data.text || '').trim(), confidence, symbols };
    },
    terminate: () => worker.terminate(),
  };
}
