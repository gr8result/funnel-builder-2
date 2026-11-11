// Electrical points read from the drawing itself (no plan reading, no AI call).
//
// Two kinds of evidence, both on one sheet in plan pixels:
//  1. Labels. A point written out on the plan ("SMOKE ALARM", "DOUBLE GPO", "CEILING FAN") counts once
//     where it is written. Labels split over two lines or two text items are joined. Short tags
//     ("SA", "DGPO", "LP", "SW") mean other things on architectural sheets ("SD" is a sliding door), so
//     they count only on an electrical or lighting sheet, or when the sheet's own legend defines them.
//     Notes ("SMOKE ALARMS TO BE INSTALLED IN ACCORDANCE WITH ...") never match: a label is the whole phrase.
//  2. Symbols. A legend entry ("DOUBLE POWER POINT" with its symbol drawn beside it) gives the shape.
//     Every copy of that shape on the sheet, at any quarter turn, is one point. The legend itself is not
//     counted.
// A label written beside a matched symbol of the same kind is one point, not two.

export const ELECTRICAL_KINDS = [
  { key: 'double-gpo', label: 'Double power point',
    full: /^(double|twin|dbl)\s*(gpo|power\s*-?\s*points?|powerpoints?|socket\s*outlets?|general\s*purpose\s*outlets?)$/i, short: /^(dgpo|dpp|gpo\s*2|2\s*gpo)$/i },
  { key: 'single-gpo', label: 'Single power point',
    full: /^(single|sgl)\s*(gpo|power\s*-?\s*points?|powerpoints?|socket\s*outlets?|general\s*purpose\s*outlets?)$/i, short: /^(sgpo|spp|gpo\s*1|1\s*gpo)$/i },
  { key: 'light-point', label: 'Light point',
    full: /^(light\s*points?|(led\s*)?down\s*-?\s*lights?|ceiling\s*lights?|pendant(\s*lights?)?|oyster(\s*lights?)?|wall\s*lights?|batten\s*(holders?|lights?))$/i, short: /^(lp|dl)$/i },
  { key: 'ceiling-fan', label: 'Ceiling fan',
    full: /^ceiling\s*fans?(\s*(with|w\/|&|\+)\s*lights?)?$/i, short: /^(cf|c\/f)$/i },
  { key: 'exhaust-fan', label: 'Exhaust fan',
    full: /^exhaust\s*fans?(\s*(with|w\/|&|\+)\s*lights?)?$/i, short: /^(ef|e\/f)$/i },
  { key: 'switch', label: 'Switch',
    full: /^((light|one|two|three|[1-6])\s*-?\s*(gang\s*)?)?(light\s*)?switch(es)?$/i, short: /^(sw)$/i },
  { key: 'smoke-alarm', label: 'Smoke alarm',
    full: /^((hard\s*-?\s*wired|interconnected|photo\s*-?\s*electric)\s*)?smoke\s*(alarms?|detectors?)$/i, short: /^(sa|sd|s\/a)$/i },
];
export const ELECTRICAL_KIND_BY_KEY = Object.fromEntries(ELECTRICAL_KINDS.map((kind) => [kind.key, kind]));

const ELECTRICAL_SHEET = /electrical|lighting\s*(plan|layout)|power\s*(plan|layout)|services\s*layout/i;
const LEGEND_HEADING = /^(electrical\s*|lighting\s*)?(legend|key|symbols?|symbol\s*legend)$/i;
const clean = (text) => String(text ?? '').replace(/\s+/g, ' ').trim();

export const ELECTRICAL_DEFAULTS = {
  joinLineGap: 1.6,      // text heights between two items on one line that still form one label
  joinStack: [0.5, 2.0], // text heights between two stacked lines of one label
  legendColumn: 2.0,     // legend entries line up within this many text heights
  legendStep: 6,         // and sit within this many text heights of the next entry
  glyphReach: 7,         // a legend symbol sits within this many text heights before its words
  matchTolerance: 0.12,  // of the symbol's size, for endpoints to coincide
  matchScore: 0.85,      // share of the symbol's lines (and the candidate's) that must coincide
  sameLabelMm: 900,      // a label this close to a matched symbol of the same kind is that symbol
};

function textFrame(item) {
  const angle = Number(item.angle);
  const u = Number.isFinite(angle) ? { x: Math.cos(angle * Math.PI / 180), y: Math.sin(angle * Math.PI / 180) } : { x: 1, y: 0 };
  const up = { x: u.y, y: -u.x };
  const h = Math.max(1, Math.abs(Number(item.height) || 0) || 8);
  const w = Math.max(0, Number(item.width) || 0);
  return { ...item, text: clean(item.text), u, up, h, w, known: Number.isFinite(angle),
    centre: { x: item.x + u.x * w / 2 + up.x * h / 2, y: item.y + u.y * w / 2 + up.y * h / 2 } };
}

const along = (a, p) => (p.x - a.x) * a.u.x + (p.y - a.y) * a.u.y;
const across = (a, p) => (p.x - a.x) * a.up.x + (p.y - a.y) * a.up.y;

// Can b follow a within one label? Returns 'line' | 'stack' | null.
function joins(a, b, options) {
  if (a === b || !a.text || !b.text) return null;
  const h = Math.max(a.h, b.h);
  if (a.known && b.known && Math.abs(a.u.x * b.u.x + a.u.y * b.u.y) < 0.98) return null;
  const off = across(a, { x: b.x, y: b.y }), start = along(a, { x: b.x, y: b.y });
  if (Math.abs(off) < 0.5 * h && start > a.w - 0.3 * h && start - a.w < options.joinLineGap * h) return 'line';
  const [lo, hi] = options.joinStack;
  const overlap = Math.min(a.w, start + b.w) - Math.max(0, start);
  if (off < -lo * h && off > -hi * h && overlap > -0.5 * h) return 'stack';
  // Unknown orientation (older saved sheets): anchors close together, either way round.
  if (!a.known && Math.hypot(b.x - a.x, b.y - a.y) < hi * h) return 'stack';
  return null;
}

function phraseCandidates(items, options) {
  const out = [];
  items.forEach((a, i) => {
    out.push([i]);
    items.forEach((b, j) => {
      if (!joins(a, b, options)) return;
      out.push([i, j]);
      items.forEach((c, k) => { if (k !== i && joins(b, c, options)) out.push([i, j, k]); });
    });
  });
  return out;
}

function classify(text, { shortAllowed }) {
  for (const kind of ELECTRICAL_KINDS) if (kind.full.test(text)) return { kind, short: false };
  for (const kind of ELECTRICAL_KINDS) if (kind.short.test(text) && shortAllowed(kind.key)) return { kind, short: true };
  return null;
}

// Labels: whole phrases that name a point, longest first, each text item used once.
function readLabels(items, options, shortAllowed) {
  const matches = [];
  for (const ids of phraseCandidates(items, options)) {
    const text = ids.map((id) => items[id].text).join(' ');
    const reversed = ids.length > 1 ? [...ids].reverse().map((id) => items[id].text).join(' ') : null;
    const forward = classify(text, { shortAllowed });
    const backward = !forward && reversed ? classify(reversed, { shortAllowed }) : null;
    if (forward || backward) matches.push({ ids, text: forward ? text : reversed, ...(forward || backward) });
  }
  matches.sort((a, b) => b.ids.length - a.ids.length);
  const used = new Set(), labels = [];
  for (const match of matches) {
    if (match.ids.some((id) => used.has(id))) continue;
    match.ids.forEach((id) => used.add(id));
    const parts = match.ids.map((id) => items[id]);
    labels.push({ ...match, items: parts, h: Math.max(...parts.map((p) => p.h)),
      left: parts[0], centre: { x: parts.reduce((s, p) => s + p.centre.x, 0) / parts.length, y: parts.reduce((s, p) => s + p.centre.y, 0) / parts.length } });
  }
  return labels;
}

// A label is a legend entry when it sits under a legend heading or lines up with other entries.
function legendEntries(labels, items, options) {
  const headings = items.filter((item) => LEGEND_HEADING.test(item.text));
  return labels.filter((label) => {
    const h = label.h;
    const underHeading = headings.some((head) => {
      const dx = along(head, label.left), dy = -across(head, label.left);
      return dy > 0 && dy < 40 * h && dx > -15 * h && dx < 25 * h;
    });
    if (underHeading) return true;
    const column = labels.filter((other) => other !== label && !other.short && Math.abs(along(label.left, other.left)) < options.legendColumn * h
      && Math.abs(across(label.left, other.left)) < options.legendStep * h * 3);
    return !label.short && column.length >= 2 && new Set([label.kind.key, ...column.map((other) => other.kind.key)]).size >= 3;
  });
}

const bboxOf = (segments) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of segments) { x0 = Math.min(x0, s.x1, s.x2); y0 = Math.min(y0, s.y1, s.y2); x1 = Math.max(x1, s.x1, s.x2); y1 = Math.max(y1, s.y1, s.y2); }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
};

function groupByPath(segments) {
  const paths = new Map();
  segments.forEach((s) => { const key = s.path ?? `${s.x1},${s.y1}`; if (!paths.has(key)) paths.set(key, []); paths.get(key).push(s); });
  return [...paths.values()].map((list) => ({ segments: list, box: bboxOf(list) }));
}

// The symbol drawn just before a legend entry's words: whole paths inside that window.
function legendGlyph(entry, paths, options) {
  const { h, left } = entry;
  const inWindow = (p) => { const a = along(left, p), c = across(left, p); return a < -0.15 * h && a > -options.glyphReach * h && Math.abs(c - h / 2) < 2.2 * h; };
  const own = paths.filter(({ segments }) => segments.every((s) => inWindow({ x: s.x1, y: s.y1 }) && inWindow({ x: s.x2, y: s.y2 })));
  if (!own.length) return null;
  // Keep the cluster nearest the words (a legend may draw a box round each entry or a rule beside it).
  own.sort((a, b) => along(left, { x: b.box.x1, y: b.box.cy }) - along(left, { x: a.box.x1, y: a.box.cy }));
  const near = [own[0]];
  for (const path of own.slice(1)) {
    const box = bboxOf(near.flatMap((p) => p.segments));
    if (path.box.x0 <= box.x1 + 0.4 * h && path.box.x1 >= box.x0 - 0.4 * h && path.box.y0 <= box.y1 + 0.4 * h && path.box.y1 >= box.y0 - 0.4 * h) near.push(path);
  }
  const segments = near.flatMap((p) => p.segments);
  const box = bboxOf(segments);
  const size = Math.max(box.w, box.h);
  if (segments.length < 2 || size < 0.4 * h || size > 4.5 * h) return null;
  const rel = segments.map((s) => ({ x1: s.x1 - box.cx, y1: s.y1 - box.cy, x2: s.x2 - box.cx, y2: s.y2 - box.cy }));
  return { segments: rel, box, size, paths: near };
}

const ROTATIONS = [[1, 0, 0, 1], [0, -1, 1, 0], [-1, 0, 0, -1], [0, 1, -1, 0]];
const turn = (m, x, y) => ({ x: m[0] * x + m[1] * y, y: m[2] * x + m[3] * y });

function segmentIndex(segments, cell) {
  const grid = new Map();
  segments.forEach((s, i) => {
    const key = `${Math.floor((s.x1 + s.x2) / 2 / cell)},${Math.floor((s.y1 + s.y2) / 2 / cell)}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(i);
  });
  return (x0, y0, x1, y1) => {
    const out = [];
    for (let gx = Math.floor(x0 / cell); gx <= Math.floor(x1 / cell); gx += 1) for (let gy = Math.floor(y0 / cell); gy <= Math.floor(y1 / cell); gy += 1) out.push(...(grid.get(`${gx},${gy}`) || []));
    return out;
  };
}

const sameSegment = (s, t, tol) => (Math.hypot(s.x1 - t.x1, s.y1 - t.y1) <= tol && Math.hypot(s.x2 - t.x2, s.y2 - t.y2) <= tol)
  || (Math.hypot(s.x1 - t.x2, s.y1 - t.y2) <= tol && Math.hypot(s.x2 - t.x1, s.y2 - t.y1) <= tol);

// Every copy of a legend symbol on the sheet, at any quarter turn.
function matchSymbol(glyph, segments, paths, query, exclude, options) {
  const tol = Math.max(0.5, options.matchTolerance * glyph.size);
  const largest = groupByPath(glyph.segments).sort((a, b) => Math.max(b.box.w, b.box.h) - Math.max(a.box.w, a.box.h))[0].box;
  const found = [];
  for (const m of ROTATIONS) {
    const template = glyph.segments.map((s) => { const a = turn(m, s.x1, s.y1), b = turn(m, s.x2, s.y2); return { x1: a.x, y1: a.y, x2: b.x, y2: b.y }; });
    const anchorOffset = turn(m, largest.cx, largest.cy);
    const lw = m[0] ? largest.w : largest.h, lh = m[0] ? largest.h : largest.w;
    const half = glyph.size / 2 + tol;
    for (const path of paths) {
      const { box } = path;
      if (Math.abs(box.w - lw) > tol * 1.5 || Math.abs(box.h - lh) > tol * 1.5) continue;
      const cx = box.cx - anchorOffset.x, cy = box.cy - anchorOffset.y;
      if (found.some((f) => Math.hypot(f.x - cx, f.y - cy) < glyph.size / 2)) continue;
      if (exclude.some((e) => cx >= e.x0 - tol && cx <= e.x1 + tol && cy >= e.y0 - tol && cy <= e.y1 + tol)) continue;
      const nearby = query(cx - half, cy - half, cx + half, cy + half).map((i) => segments[i]);
      const placed = template.map((s) => ({ x1: s.x1 + cx, y1: s.y1 + cy, x2: s.x2 + cx, y2: s.y2 + cy }));
      const covered = placed.filter((s) => nearby.some((t) => sameSegment(s, t, tol))).length / placed.length;
      if (covered < options.matchScore) continue;
      const inside = nearby.filter((t) => Math.max(Math.abs(t.x1 - cx), Math.abs(t.x2 - cx), Math.abs(t.y1 - cy), Math.abs(t.y2 - cy)) <= half);
      const explained = inside.filter((t) => placed.some((s) => sameSegment(s, t, tol))).length / Math.max(1, inside.length);
      if (explained < options.matchScore) continue;
      found.push({ x: cx, y: cy, rotation: ROTATIONS.indexOf(m) * 90, score: Math.min(covered, explained) });
    }
  }
  return found;
}

/**
 * @param textItems [{ text, x, y (baseline, plan pixels), width, height, angle? (degrees, plan pixels) }]
 * @param segments  vector linework in plan pixels ({ x1, y1, x2, y2, path }), optional
 * @param pixelsPerMm sheet scale, optional (used only to treat a label beside a symbol as that symbol)
 * @returns {{ points: [{ kind, label, x, y, source: 'label'|'symbol', evidence }], counts, legend, electricalSheet, report }}
 */
export function readElectricalPoints({ textItems = [], segments = [], pixelsPerMm = null } = {}, overrides = {}) {
  const options = { ...ELECTRICAL_DEFAULTS, ...overrides };
  const items = textItems.filter((item) => Number.isFinite(item?.x) && Number.isFinite(item?.y) && clean(item.text)).map(textFrame);
  const electricalSheet = items.some((item) => ELECTRICAL_SHEET.test(item.text));
  // First pass with full words only, to find the legend; the legend then admits its own short tags.
  const fullLabels = readLabels(items, options, () => false);
  const legend = legendEntries(fullLabels, items, options);
  const legendKinds = new Set(legend.map((entry) => entry.kind.key));
  const labels = readLabels(items, options, (key) => electricalSheet || legendKinds.has(key));
  const legendItems = new Set(legend.flatMap((entry) => entry.items));
  const lines = segments.filter((s) => [s.x1, s.y1, s.x2, s.y2].every(Number.isFinite));
  const paths = lines.length ? groupByPath(lines) : [];
  const symbols = [], glyphs = [];
  if (paths.length && legend.length) {
    const query = segmentIndex(lines, Math.max(4, Math.max(...legend.map((entry) => entry.h)) * 3));
    for (const entry of legend) {
      const glyph = legendGlyph(entry, paths, options);
      if (!glyph) { glyphs.push({ kind: entry.kind.key, text: entry.text, symbol: false }); continue; }
      glyphs.push({ kind: entry.kind.key, text: entry.text, symbol: true, box: glyph.box, lines: glyph.segments.length });
    }
    const exclude = glyphs.filter((g) => g.box).map((g) => g.box);
    for (const entry of legend) {
      const glyph = legendGlyph(entry, paths, options);
      if (!glyph) continue;
      for (const hit of matchSymbol(glyph, lines, paths, query, exclude, options)) {
        symbols.push({ kind: entry.kind.key, label: entry.kind.label, x: hit.x, y: hit.y, source: 'symbol', rotation: hit.rotation,
          evidence: `Symbol matches the legend's "${entry.text}" (${Math.round(hit.score * 100)}% of its lines)` });
      }
    }
  }
  // Two legend symbols matching one spot: keep the better (first found per spot by kind order is not enough).
  const sameSpot = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < 1e-6 + Math.min(...legend.map((e) => e.h)) * 0.8;
  const distinctSymbols = symbols.filter((s, i) => !symbols.some((t, j) => j < i && sameSpot(s, t)));
  const reach = pixelsPerMm > 0 ? options.sameLabelMm * pixelsPerMm : null;
  const labelPoints = labels.filter((label) => !label.items.some((item) => legendItems.has(item))).flatMap((label) => {
    // Measured from the label's middle, so half its length counts as beside it as well.
    const limit = Math.max(reach || 0, Math.max(...label.items.map((part) => part.w)) / 2 + 3 * label.h);
    if (distinctSymbols.some((s) => s.kind === label.kind.key && Math.hypot(s.x - label.centre.x, s.y - label.centre.y) <= limit)) return [];
    return [{ kind: label.kind.key, label: label.kind.label, x: label.centre.x, y: label.centre.y, source: 'label',
      evidence: `Written on the plan: "${label.text}"${label.short ? (electricalSheet ? ' (electrical sheet tag)' : ' (tag defined in the legend)') : ''}` }];
  });
  const points = [...distinctSymbols, ...labelPoints];
  const counts = Object.fromEntries(ELECTRICAL_KINDS.map((kind) => [kind.key, points.filter((p) => p.kind === kind.key).length]).filter(([, n]) => n > 0));
  return {
    points, counts, electricalSheet,
    legend: glyphs.length ? glyphs : legend.map((entry) => ({ kind: entry.kind.key, text: entry.text, symbol: false })),
    report: { labels: labelPoints.length, symbols: distinctSymbols.length, legendEntries: legend.length,
      legendWithoutSymbol: glyphs.filter((g) => !g.symbol).map((g) => g.text) },
  };
}

const inside = (point, polygon) => {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < a.x + (point.y - a.y) * (b.x - a.x) / (b.y - a.y)) hit = !hit;
  }
  return hit;
};

// Each point to the room it sits in (rooms on the same sheet, same plan pixels); the smallest room wins
// where outlines overlap. Points in no room are kept with room: null.
export function allocatePointsToRooms(points = [], rooms = []) {
  const usable = rooms.filter((room) => !room.excluded && Array.isArray(room.polygon) && room.polygon.length >= 3);
  const area = (polygon) => Math.abs(polygon.reduce((s, p, i) => { const q = polygon[(i + 1) % polygon.length]; return s + p.x * q.y - q.x * p.y; }, 0) / 2);
  return points.map((point) => {
    const room = usable.filter((r) => inside(point, r.polygon)).sort((a, b) => area(a.polygon) - area(b.polygon))[0] || null;
    return { ...point, roomId: room?.id ?? null, room: room?.name ?? null };
  });
}
