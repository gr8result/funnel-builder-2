// Opening size labels read from the drawing itself: finding the printed label lines, parsing the
// architectural size codes, and associating each label with one measured opening. Pure functions; the
// OCR engine is supplied by the caller (see localLabelOcr.js), so this file runs anywhere and is tested
// without one. Nothing here invents a dimension: a label that does not parse, does not fit the opening
// it sits beside, or could belong to more than one opening is reported, never applied.

export const LABEL_DEFAULTS = {
  darkLuminance: 165, // glyph ink incl. anti-aliased thin strokes; the drawing's light grey hatch and tiles are lighter
  minTextPx: 2.2, maxTextPx: 14, // text height range, logical px (PDF points)
  minGlyphs: 3, maxLineGlyphs: 24,
  nearWallMm: 1500, // only label lines this close to a measured wall are read
  maxPerpMm: 1400, alongSlackMm: 700, // association window around an opening
  widthToleranceMm: 160, widthToleranceShare: 0.12,
  ambiguityRatio: 0.75, // a second opening scoring this close to the best makes the label ambiguous
  minOcrConfidence: 60,
  minLabelConfidence: 0.7,
};

// ---------------------------------------------------------------------------------------------------
// 1. Label lines: glyph-sized ink marks grouped into straight runs of similar height, horizontal or
// vertical (labels run along the wall they belong to). Coordinates in raster px; logical px reported too.
export function proposeLabelLines(raster, { logicalWidth } = {}, overrides = {}) {
  const o = { ...LABEL_DEFAULTS, ...overrides };
  const { width: W, height: H, data } = raster;
  const k = logicalWidth > 0 ? W / logicalWidth : 1;
  const dark = new Uint8Array(W * H);
  for (let i = 0, p = 0; i < dark.length; i++, p += 4) {
    const lum = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
    if (lum < o.darkLuminance && data[p + 3] > 128) dark[i] = 1;
  }
  // Long straight ink runs (wall faces, door leaves, leader and dimension lines) are taken out first, so a
  // label touching a line is not swallowed into one large mark with it. No glyph stroke is this long.
  const longRun = Math.round(o.maxTextPx * k * 0.9);
  const keep = dark.slice();
  for (let y = 0; y < H; y++) {
    let start = -1;
    for (let x = 0; x <= W; x++) {
      const inked = x < W && dark[y * W + x];
      if (inked && start < 0) start = x;
      if (!inked && start >= 0) { if (x - start >= longRun) keep.fill(0, y * W + start, y * W + x); start = -1; }
    }
  }
  for (let x = 0; x < W; x++) {
    let start = -1;
    for (let y = 0; y <= H; y++) {
      const inked = y < H && dark[y * W + x];
      if (inked && start < 0) start = y;
      if (!inked && start >= 0) { if (y - start >= longRun) for (let q = start; q < y; q++) keep[q * W + x] = 0; start = -1; }
    }
  }
  // Lines are read from the ink as drawn and from the ink with long lines removed: a label crossed by a
  // line can split in the second, a label touching a line merges into it in the first. Overlapping
  // readings of one label are kept as alternatives for the reader.
  const maxSide = Math.ceil(o.maxTextPx * k * 1.6);
  const lines = [];
  for (const line of [...groupLines(connectedComponents(dark, W, H, maxSide), k, o), ...groupLines(connectedComponents(keep, W, H, maxSide), k, o)]) {
    const same = lines.findIndex((other) => other.orientation === line.orientation && boxOverlap(other.box, line.box) > 0.3);
    if (same < 0) { lines.push(line); continue; }
    // Two different boxes for one label: both are kept and the OCR reading decides between them.
    const kept = lines[same], identical = ['x0', 'y0', 'x1', 'y1'].every((key) => Math.abs(kept.box[key] - line.box[key]) <= 1);
    if (!identical && !(kept.alternatives || []).length) kept.alternatives = [line];
  }
  return { lines, k };
}

// Glyph-sized marks grouped into lines of text, horizontal and vertical.
function groupLines(glyphs, k, o) {
  const minPx = o.minTextPx * k, maxPx = o.maxTextPx * k;
  const lines = [];
  for (const orientation of ['h', 'v']) {
    // Along = reading direction; across = text height.
    const items = glyphs.map((g) => orientation === 'h'
      ? { g, a0: g.x0, a1: g.x1, c0: g.y0, c1: g.y1 }
      : { g, a0: g.y0, a1: g.y1, c0: g.x0, c1: g.x1 })
      .map((it) => ({ ...it, across: it.c1 - it.c0 + 1, along: it.a1 - it.a0 + 1 }))
      .filter((it) => it.across >= minPx && it.across <= maxPx && it.along <= it.across * 1.6 && it.g.n >= 4);
    items.sort((a, b) => a.a0 - b.a0);
    const parent = items.map((_, i) => i);
    const find = (i) => { while (parent[i] !== i) i = parent[i] = parent[parent[i]]; return i; };
    for (let i = 0; i < items.length; i++) {
      const a = items[i];
      for (let j = i + 1; j < items.length; j++) {
        const b = items[j];
        const big = Math.max(a.across, b.across);
        if (b.a0 - a.a1 > 1.4 * big) break;
        const small = Math.min(a.across, b.across);
        if (small < 0.4 * big) continue;
        const centred = Math.abs((a.c0 + a.c1) - (b.c0 + b.c1)) / 2 <= 0.3 * big;
        const baseline = Math.abs(a.c1 - b.c1) <= 0.22 * big || Math.abs(a.c0 - b.c0) <= 0.22 * big;
        if (!centred && !baseline) continue;
        if (b.a0 - a.a1 > 1.4 * big) continue;
        parent[find(j)] = find(i);
      }
    }
    const groups = new Map();
    items.forEach((it, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(it); });
    for (const members of groups.values()) {
      if (members.length < o.minGlyphs || members.length > o.maxLineGlyphs) continue;
      const across = median(members.map((m) => m.across));
      const x0 = Math.min(...members.map((m) => m.g.x0)), x1 = Math.max(...members.map((m) => m.g.x1));
      const y0 = Math.min(...members.map((m) => m.g.y0)), y1 = Math.max(...members.map((m) => m.g.y1));
      lines.push({ orientation, glyphs: members.length, textPx: across, box: { x0, y0, x1, y1 },
        logical: { x: (x0 + x1) / 2 / k, y: (y0 + y1) / 2 / k, textHeight: across / k, length: (orientation === 'h' ? x1 - x0 : y1 - y0) / k } });
    }
  }
  return lines;
}

const boxOverlap = (a, b) => {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  if (w <= 0 || h <= 0) return 0;
  const area = (r) => (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1);
  return (w * h) / Math.min(area(a), area(b));
};

function connectedComponents(mask, W, H, maxSide) {
  const seen = new Uint8Array(mask.length), out = [], stack = new Int32Array(mask.length);
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    let top = 0, n = 0, x0 = W, y0 = H, x1 = -1, y1 = -1, big = false;
    stack[top++] = start; seen[start] = 1;
    while (top) {
      const i = stack[--top], x = i % W, y = (i - x) / W; n++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (x1 - x0 > maxSide || y1 - y0 > maxSide) big = true;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx; if (mask[j] && !seen[j]) { seen[j] = 1; stack[top++] = j; }
      }
    }
    if (!big) out.push({ x0, y0, x1, y1, n });
  }
  return out;
}

const median = (values) => { const s = [...values].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };

// ---------------------------------------------------------------------------------------------------
// 2. Architectural size codes (Australian residential convention):
//    HHWW [suffix]  height and width in hundreds of mm: 1809 = 1800 high x 900 wide; 2124 SGD = 2100 x 2400
//                   sliding glass door; 2131 STACKER; 0912; 1809 DH / LV / FG / OBS.
//    NNN [CSD]      a door leaf width: 820, 720 CSD (cavity slider), 2 x 820 (a pair of leaves).
//    HHHH x WWW     explicit height x width: 2100 x 645 FG SL.
const SLIDING = /\b(SGD|GSD|SD|SLD|STACKER|STACK|SLIDER|SLIDING)\b/;
const WINDOW_TYPES = /\b(DH|LV|LVR|FG|OBS|AW|AWN|CW|SH|SL|HS|FIXED)\b/;
const CAVITY = /\b(CSD|CAV|CAVITY)\b/;

export function normaliseLabelText(text) {
  let t = String(text || '').toUpperCase().replace(/[|]/g, '1').replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  // Common OCR confusions inside numbers only: O->0, I/L->1, S->5 when flanked by digits.
  t = t.replace(/(?<=\d)[O](?=\d|\b)|(?<=\b)[O](?=\d)/g, '0').replace(/(?<=\d)[IL](?=\d)|(?<=\b)[IL](?=\d{2,})/g, '1');
  // A leading 0 misread as a round letter (J906, C906 -> 0906), only before exactly three digits.
  t = t.replace(/^[OQDUCJ](?=\d{3}(?!\d))/, '0');
  // A leading 1 misread as a thin letter (F806, I809 -> 1806, 1809), only before exactly three digits.
  t = t.replace(/^[FILT](?=\d{3}(?!\d))/, '1');
  // A suffix written against the number (1809LV, 2118GSD) is a separate word.
  t = t.replace(/^(\d{3,4})([A-WYZ][A-Z]*)\b/, '$1 $2');
  // Sliding-door suffixes misread in their middle letter (SOD, S6D -> SGD; G5D -> GSD); a stray single
  // character at the end is noise from a neighbouring mark.
  t = t.split(' ').map((w, i) => (i && /^S[A-Z0-9]D$/.test(w) ? 'SGD' : i && /^G[A-Z0-9]D$/.test(w) ? 'GSD' : w)).join(' ');
  t = t.replace(/(?<=\S) [A-WYZ0-9]$/, '');
  return t;
}

export function parseOpeningLabel(text) {
  const t = normaliseLabelText(text);
  if (!t) return null;
  let m = t.match(/^(\d{4}) ?X ?(\d{3,4})\b(.*)$/);
  if (m) {
    const heightMm = Number(m[1]), widthMm = Number(m[2]), rest = m[3].trim();
    if (heightMm < 300 || heightMm > 3000 || widthMm < 300 || widthMm > 6000) return null;
    return finish(t, { form: 'explicit', heightMm, widthMm, suffix: rest });
  }
  m = t.match(/^(2) ?X ?(\d{3})\b(.*)$/);
  if (m) {
    const leaf = Number(m[2]); if (!plausibleLeaf(leaf)) return null;
    return finish(t, { form: 'leaf-pair', leafWidthMm: leaf, leaves: 2, suffix: m[3].trim() });
  }
  m = t.match(/^(\d{4})(?: (.*))?$/);
  if (m) {
    const hh = Number(m[1].slice(0, 2)), ww = Number(m[1].slice(2));
    if (hh < 3 || hh > 27 || ww < 3 || ww > 60) return null;
    return finish(t, { form: 'code', code: m[1], heightMm: hh * 100, widthMm: ww * 100, suffix: (m[2] || '').trim() });
  }
  m = t.match(/^(\d{3})(?: (.*))?$/);
  if (m) {
    const leaf = Number(m[1]); if (!plausibleLeaf(leaf)) return null;
    return finish(t, { form: 'leaf', leafWidthMm: leaf, leaves: 1, suffix: (m[2] || '').trim() });
  }
  return null;
}
const plausibleLeaf = (mm) => mm >= 420 && mm <= 1220 && mm % 10 === 0;

function finish(text, parsed) {
  const s = parsed.suffix || '';
  // Unknown trailing words make the reading suspect (a note or dimension that happened to start with digits).
  const known = s.split(' ').filter(Boolean).every((w) => SLIDING.test(w) || WINDOW_TYPES.test(w) || CAVITY.test(w) || /^(WINDOW|DOOR|BARN|ENTRY|OPENING|SQUARE|SET|GLASS)$/.test(w));
  let kind;
  if (parsed.form === 'leaf' || parsed.form === 'leaf-pair') kind = CAVITY.test(s) ? 'cavity-slider' : /BARN/.test(s) ? 'barn-door' : 'door';
  else if (SLIDING.test(s)) kind = 'sliding-door';
  else if (WINDOW_TYPES.test(s)) kind = parsed.heightMm >= 2000 && /\bSL\b/.test(s) ? 'window' : 'window';
  else if (/OPENING|SQUARE/.test(s)) kind = 'opening';
  else kind = parsed.heightMm >= 2000 ? 'door-height' : 'window';
  return { text, ...parsed, kind, knownSuffix: known };
}

// ---------------------------------------------------------------------------------------------------
// 3. Association: each label to at most one opening; each opening at most one size label and one leaf
// label. Geometry first (the label runs parallel to the opening's wall, beside it, within its extent),
// then the label's own width must agree with the measured width for the label to be applied.
const unit = (d) => { const l = Math.hypot(d?.x || 0, d?.y || 0); return l ? { x: d.x / l, y: d.y / l } : null; };

export function associateOpeningLabels(labels, openings, { pixelsPerMm }, overrides = {}) {
  const o = { ...LABEL_DEFAULTS, ...overrides };
  const pairs = [];
  for (const label of labels) {
    // Unknown words make it a note, not a size label (a niche, a joinery item, a dimension remark).
    if (!label.parsed || !label.parsed.knownSuffix) continue;
    const along = label.orientation === 'h' ? { x: 1, y: 0 } : { x: 0, y: 1 };
    for (const opening of openings) {
      if (opening.bridgeOnly) continue;
      const u = unit(opening.direction); if (!u) continue;
      if (Math.abs(u.x * along.x + u.y * along.y) < 0.97) continue;
      if (!kindSuits(label.parsed, opening)) continue;
      const dx = (label.x - opening.x) / pixelsPerMm, dy = (label.y - opening.y) / pixelsPerMm;
      const t = dx * u.x + dy * u.y, perp = Math.abs(-dx * u.y + dy * u.x);
      const half = (opening.widthMm || 0) / 2;
      if (perp > o.maxPerpMm || Math.abs(t) > half + o.alongSlackMm) continue;
      const fit = widthFit(label.parsed, opening, o);
      if (!fit.compatible) continue;
      const score = Math.exp(-perp / 700) * Math.exp(-Math.max(0, Math.abs(t) - half * 0.6) / 500) * (fit.agrees ? 1 : fit.compatible ? 0.6 : 0.25);
      pairs.push({ label, opening, perpMm: Math.round(perp), alongMm: Math.round(t), score, fit });
    }
  }
  const byLabel = new Map();
  for (const p of pairs) { if (!byLabel.has(p.label)) byLabel.set(p.label, []); byLabel.get(p.label).push(p); }
  const assignments = [], ambiguous = [], usedSize = new Set(), usedLeaf = new Set(), seconds = new Set();
  const ordered = [...byLabel.values()].map((list) => list.sort((a, b) => b.score - a.score)).sort((a, b) => b[0].score - a[0].score);
  for (const list of ordered) {
    const leaf = list[0].label.parsed.form.startsWith('leaf');
    const used = leaf ? usedLeaf : usedSize;
    // A pair of leaves is labelled once per leaf: such an opening takes a second leaf label.
    const pairTakesAnother = (p) => leaf && used.has(p.opening) && !seconds.has(p.opening) && p.opening.widthMm >= 1.7 * p.label.parsed.leafWidthMm;
    const open = list.filter((p) => !used.has(p.opening) || pairTakesAnother(p));
    if (open[0] && pairTakesAnother(open[0]) && !(open[1] && open[1].score >= o.ambiguityRatio * open[0].score)) {
      seconds.add(open[0].opening); assignments.push({ ...open[0], supporting: true }); continue;
    }
    if (!open.length) { ambiguous.push({ label: list[0].label, reason: 'every nearby opening already has a label of this kind' }); continue; }
    if (open[1] && open[1].score >= o.ambiguityRatio * open[0].score) {
      ambiguous.push({ label: open[0].label, reason: `could belong to ${open[0].opening.id} or ${open[1].opening.id}`, candidates: open.slice(0, 2).map((p) => p.opening.id) });
      continue;
    }
    used.add(open[0].opening); assignments.push(open[0]);
  }
  const assigned = new Set([...assignments.map((a) => a.label), ...ambiguous.map((a) => a.label)]);
  const unassigned = labels.filter((l) => l.parsed && !assigned.has(l));
  return { assignments, ambiguous, unassigned };
}

// A leaf width belongs to a swing or cavity door (or an unread gap); a window code to a window, frame or
// gap, never to a swing door; a sliding or full-height code to a frame, sliding door or gap.
const SWING = new Set(['door', 'cavity-slider', 'barn-door']);
function kindSuits(parsed, opening) {
  if (parsed.form.startsWith('leaf')) return SWING.has(opening.kind) || opening.kind === 'opening';
  return !SWING.has(opening.kind);
}

function widthFit(parsed, opening, o) {
  const tol = (mm) => Math.max(o.widthToleranceMm, o.widthToleranceShare * mm);
  if (parsed.form.startsWith('leaf')) {
    const drawn = opening.measurements?.leafWidthMm || opening.leafMm || (opening.kind !== 'opening' && opening.kind !== 'window' ? opening.widthMm : null);
    const expect = parsed.leafWidthMm * (parsed.leaves || 1);
    const measured = parsed.leaves === 2 ? (opening.widthMm || drawn) : drawn;
    if (!measured) {
      // An unread gap: the leaf must fit in it, with no more than a frame and a margin to spare.
      const gap = opening.widthMm || 0, room = gap - expect;
      return { agrees: false, compatible: opening.kind === 'opening' && room >= -60 && room <= 450, differenceMm: Math.round(Math.abs(room)) };
    }
    const d = Math.abs(measured - expect);
    return { agrees: d <= Math.max(60, 0.08 * expect), compatible: d <= tol(expect), differenceMm: Math.round(d) };
  }
  const width = opening.measurements?.frameWidthMm || opening.widthMm;
  if (!width) return { agrees: false, compatible: false };
  const d = Math.abs(width - parsed.widthMm);
  return { agrees: d <= tol(parsed.widthMm), compatible: d <= 2 * tol(parsed.widthMm), differenceMm: Math.round(d) };
}

// ---------------------------------------------------------------------------------------------------
// 3b. A held multi-panel frame ("one window or several?") whose panels each carry their own printed
// window code is several windows. Settled only when 2+ window codes lie along the frame, in order, and
// their widths add up to the measured frame width; each window gets its share of the measured width.
export function splitPanelsByLabels(openings, labels, { pixelsPerMm }, overrides = {}) {
  const o = { ...LABEL_DEFAULTS, ...overrides };
  const consumed = new Set(), report = [];
  const out = [];
  for (const opening of openings) {
    const held = opening.needsClassification && (opening.frameUnit || opening.panelCount >= 2) && !opening.bridgeOnly;
    const u = unit(opening.direction);
    if (!held || !u) { out.push(opening); continue; }
    const half = opening.widthMm / 2;
    const along = labels.filter((l) => !consumed.has(l) && l.parsed?.knownSuffix && l.parsed.form === 'code' && l.parsed.kind === 'window'
      && l.confidence >= o.minLabelConfidence && Math.abs(u.x * (l.orientation === 'h' ? 1 : 0) + u.y * (l.orientation === 'v' ? 1 : 0)) >= 0.97)
      .map((l) => { const dx = (l.x - opening.x) / pixelsPerMm, dy = (l.y - opening.y) / pixelsPerMm; return { l, t: dx * u.x + dy * u.y, perp: Math.abs(-dx * u.y + dy * u.x) }; })
      .filter((p) => p.perp <= o.maxPerpMm && Math.abs(p.t) <= half + 100)
      .sort((a, b) => a.t - b.t);
    const total = along.reduce((sum, p) => sum + p.l.parsed.widthMm, 0);
    if (along.length < 2 || Math.abs(total - opening.widthMm) > Math.max(200, 0.06 * opening.widthMm)) { out.push(opening); continue; }
    // Each label must sit within its own panel's span (labels centred on their windows).
    let start = -half; const k = opening.widthMm / total;
    const panels = along.map((p) => { const w = p.l.parsed.widthMm * k, mid = start + w / 2; start += w; return { ...p, w, mid }; });
    if (!panels.every((p) => Math.abs(p.t - p.mid) <= p.w / 2)) { out.push(opening); continue; }
    panels.forEach((p, i) => {
      consumed.add(p.l);
      const parsed = p.l.parsed;
      out.push({ ...opening, id: `${opening.id}-${i + 1}`, x: opening.x + u.x * p.mid * pixelsPerMm, y: opening.y + u.y * p.mid * pixelsPerMm,
        widthMm: Math.round(p.w), kind: 'window', needsClassification: false, frameUnit: false, panelCount: undefined, classifiedBy: 'printed-label', heightMm: parsed.heightMm,
        measurements: { frameWidthMm: Math.round(p.w), labelFrameWidthMm: parsed.widthMm, labelHeightMm: parsed.heightMm },
        labels: [{ text: parsed.text, kind: parsed.kind, confidence: round2(p.l.confidence), ocrConfidence: p.l.ocrConfidence ?? null, source: p.l.source, perpMm: Math.round(p.perp), alongMm: Math.round(p.t - p.mid), widthAgrees: true }],
        evidence: `panel ${i + 1} of ${panels.length} of a frame drawn as one unit; its own printed label "${parsed.text}" makes it a separate window` });
    });
    report.push({ id: opening.id, widthMm: opening.widthMm, windows: panels.map((p) => p.l.parsed.text) });
  }
  return { openings: out, consumed, report };
}

// ---------------------------------------------------------------------------------------------------
// 4. Applying label evidence. A label that agrees with the measured opening may settle what a held frame
// is (window or sliding door) and records the printed nominal size; it never replaces a measured width.
// A label that disagrees, conflicts with the drawn symbol, or is weak is attached for review only.
export function applyOpeningLabels(openings, association, overrides = {}) {
  const o = { ...LABEL_DEFAULTS, ...overrides };
  const report = { applied: [], resolved: [], conflicts: [], weak: [] };
  for (const pair of association.assignments) {
    const { label, opening, fit } = pair;
    const parsed = label.parsed;
    const evidence = { text: parsed.text, kind: parsed.kind, confidence: round2(label.confidence), ocrConfidence: label.ocrConfidence ?? null, source: label.source,
      perpMm: pair.perpMm, alongMm: pair.alongMm, widthAgrees: fit.agrees, differenceMm: fit.differenceMm ?? null };
    opening.labels = [...(opening.labels || []), evidence];
    const strong = label.confidence >= o.minLabelConfidence && parsed.knownSuffix && fit.agrees;
    if (!strong && label.confidence >= o.minLabelConfidence && parsed.knownSuffix && !opening.needsClassification && conflicts(opening.kind, parsed)) {
      // A clearly read label of a different kind (and a different width) beside it: neither reading can be
      // trusted, so it is held for the builder rather than counted as what the symbol alone suggested.
      opening.labelConflict = `printed label "${parsed.text}" reads as ${parsed.kind} ${parsed.widthMm || parsed.leafWidthMm || ''} wide, the drawn symbol as a ${Math.round(opening.widthMm)} mm ${opening.kind}`;
      opening.needsClassification = true;
      opening.evidence = `${opening.evidence || opening.kind}; ${opening.labelConflict}: confirm which it is and its width`;
      report.conflicts.push({ id: opening.id, drawn: opening.kind, label: parsed.text });
      report.weak.push({ id: opening.id, ...evidence });
      continue;
    }
    if (!strong) { report.weak.push({ id: opening.id, ...evidence }); continue; }
    const m = opening.measurements = { ...(opening.measurements || {}) };
    if (parsed.form === 'code' || parsed.form === 'explicit') {
      m.labelFrameWidthMm = parsed.widthMm; m.labelHeightMm = parsed.heightMm;
      opening.heightMm = parsed.heightMm;
    } else {
      m.labelLeafWidthMm = parsed.leafWidthMm;
    }
    report.applied.push({ id: opening.id, ...evidence });
    // Classification: only a held frame is settled by its label, and only by an unambiguous kind.
    const labelKind = parsed.kind === 'sliding-door' ? 'sliding-door' : parsed.kind === 'window' && parsed.form !== 'leaf' ? 'window' : null;
    // A held frame or multi-panel window box ("window or sliding door?", "one window or several?") is
    // settled by one label whose width spans the whole of it. Unread gaps are not: a label beside a gap
    // does not show what fills it.
    const heldFrame = opening.needsClassification && opening.confirmed !== false && (opening.frameUnit || opening.panelCount >= 2 || opening.kind === 'window' || opening.kind === 'sliding-door');
    if (heldFrame && labelKind) {
      const was = opening.frameUnit ? 'frame' : opening.panelCount >= 2 ? `${opening.panelCount}-panel window box` : opening.kind;
      opening.kind = labelKind; opening.needsClassification = false; opening.classifiedBy = 'printed-label';
      opening.evidence = `${opening.evidence || was}; printed label "${parsed.text}" spans it: ${labelKind === 'window' ? 'one window' : 'a sliding door'} ${parsed.widthMm} wide`;
      report.resolved.push({ id: opening.id, kind: labelKind, text: parsed.text, was });
    } else if (!opening.needsClassification && conflicts(opening.kind, parsed)) {
      // Two sources disagree about what it is: held for the builder with both readings.
      opening.labelConflict = `printed label "${parsed.text}" reads as ${parsed.kind}, the drawn symbol as ${opening.kind}`;
      opening.needsClassification = true;
      opening.evidence = `${opening.evidence || opening.kind}; ${opening.labelConflict}: confirm which it is`;
      report.conflicts.push({ id: opening.id, drawn: opening.kind, label: parsed.text });
    }
  }
  return report;
}
const conflicts = (kind, parsed) => (parsed.form === 'code' && parsed.kind === 'window' && /door|slider/.test(kind || ''))
  || (parsed.kind === 'sliding-door' && ['window', 'garage-door'].includes(kind));
const round2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);

// Labels read from the PDF's own text layer: exact text and position, no OCR needed.
export function labelsFromTextLayer(textItems = []) {
  return textItems.map((item) => {
    const text = item.text ?? item.str; const parsed = parseOpeningLabel(text);
    if (!parsed) return null;
    const vertical = Math.abs(Math.sin(item.angle || 0)) > 0.7 || (item.height > 0 && item.width > 0 && item.height > item.width * 1.5 && String(text).length > 2);
    return { text, parsed, x: item.x, y: item.y, orientation: vertical ? 'v' : 'h', confidence: 0.98, ocrConfidence: null, source: 'pdf-text' };
  }).filter(Boolean);
}

// The whole label stage on a detector result: split labelled multi-panel frames, associate the rest,
// apply what agrees. Mutates found.openings in place (as the classification stage does) and returns
// the report kept with the analysis.
export function applyPrintedLabels(found, labels, { pixelsPerMm }, overrides = {}) {
  const split = splitPanelsByLabels(found.openings || [], labels, { pixelsPerMm }, overrides);
  found.openings = split.openings;
  const remaining = labels.filter((l) => !split.consumed.has(l));
  const association = associateOpeningLabels(remaining, found.openings.filter((op) => op.classifiedBy !== 'printed-label' || !op.labels), { pixelsPerMm }, overrides);
  const applied = applyOpeningLabels(found.openings, association, overrides);
  return {
    labels: labels.length, split: split.report, applied: applied.applied.length, resolved: applied.resolved, conflicts: applied.conflicts, weak: applied.weak,
    ambiguous: association.ambiguous.map((a) => ({ text: a.label.text, reason: a.reason })),
    unassigned: association.unassigned.map((l) => ({ text: l.text, x: Math.round(l.x), y: Math.round(l.y), source: l.source })),
    assignments: association.assignments,
  };
}
