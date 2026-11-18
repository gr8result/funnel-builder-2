// Outdoor areas (balcony, terrace, alfresco, patio, deck, porch) measured from the drawing's own linework.
//
// A plan names an outdoor area with a text label and draws its extent with solid edge lines: slab or deck
// edges, balustrade, the house wall. Inside, it is usually hatched (decking boards, a tile grid), and outside
// it there are often dashed lines (roof or eaves over) and dimension lines. The area is read as the LARGEST
// axis-aligned rectangle around the label whose four sides are each drawn solid along their length and reach
// both corners. Dashed lines fail the solid test, dimension lines fail the corner test (side lines stop at the
// slab edge), hatching only ever makes smaller rectangles. The rectangle must touch the house (an outdoor
// area named on a floor plan is attached to it) and must not overlap it; its side along the house is then put
// on the house's outer face. Anything else (L-shaped, curved, detached, or no closed solid outline) is not
// guessed: no area is produced and the reading stays with the builder.
//
// Units: millimetres throughout (segments, labels and building outline are converted by the caller).

export const OUTDOOR_LABEL = /\b(alfresco|patio|balcony|porch|portico|verandah|veranda|deck|terrace|courtyard)\b/i;
const TYPE_OF = [[/alfresco/i, 'Alfresco'], [/balcony/i, 'Balcony'], [/porch|portico|verandah|veranda/i, 'Porch'], [/deck/i, 'Deck'], [/terrace|patio|courtyard/i, 'Patio']];
export const outdoorTypeOf = (text) => TYPE_OF.find(([pattern]) => pattern.test(String(text || '')))?.[1] || null;

export const OUTDOOR_DEFAULTS = {
  windowMm: 15000,        // edges are looked for within this distance of the label
  lineTolMm: 30,          // segments within this distance across belong to one drawn line
  joinGapMm: 120,         // gaps up to this along a line are one stroke (posts, line joins)
  solidShare: 0.85,       // share of a side that must be drawn
  cornerReachMm: 150,     // a side must be drawn to within this of both corners
  minAreaM2: 2, maxAreaM2: 150,
  houseOverlapM2: 0.3,    // allowed overlap with the building outline (line weights, rounding)...
  houseStripMm: 120,      // ...plus a strip this deep along a side (the outline sits a line weight off the face)
  axisTolMm: 50,          // building outline edges within this (or 2% of their length) of level count as straight
  tickMm: [100, 600],     // dimension ticks: short 45-degree strokes centred on a dimension line
  touchHouseMm: 1500,     // a side parallel to and within this of the house outline counts as attached
};

// Dimension lines carry 45-degree tick strokes centred on them; they are never an area's edge.
// A diagonal drawn inside a small square of its own size is a post or column symbol, not a tick.
function tickMidpoints(segments, options) {
  const axis = segments.filter((s) => Math.abs(s.x2 - s.x1) < 1 || Math.abs(s.y2 - s.y1) < 1);
  const boxed = (m, side) => axis.filter((s) => { const len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1); if (Math.abs(len - side) > 0.3 * side) return false;
    const mx = (s.x1 + s.x2) / 2, my = (s.y1 + s.y2) / 2; return Math.abs(Math.hypot(mx - m.x, my - m.y) - side / 2) <= 0.3 * side; }).length >= 2;
  return segments.filter((s) => { const len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1); const a = Math.abs(Math.atan2(s.y2 - s.y1, s.x2 - s.x1)) % (Math.PI / 2);
    return len >= options.tickMm[0] && len <= options.tickMm[1] && Math.abs(a - Math.PI / 4) <= 0.17; })
    .map((s) => ({ x: (s.x1 + s.x2) / 2, y: (s.y1 + s.y2) / 2, side: Math.hypot(s.x2 - s.x1, s.y2 - s.y1) / Math.SQRT2 }))
    .filter((m) => !boxed(m, m.side));
}
// A side whose span carries ticks strictly between its ends is a dimension chain. A rectangle with a tick
// at a corner is a dimension line meeting its extension lines (which run on in line with the real edges).
function ticksWithin(c, a, b, horizontal, ticks, tol) {
  return ticks.filter((t) => Math.abs((horizontal ? t.y : t.x) - c) <= tol && (horizontal ? t.x : t.y) > a + tol && (horizontal ? t.x : t.y) < b - tol).length;
}
const tickAtCorner = (rect, ticks, tol) => [[rect.l, rect.t], [rect.r, rect.t], [rect.l, rect.b], [rect.r, rect.b]].some(([x, y]) => ticks.some((t) => Math.hypot(t.x - x, t.y - y) <= tol));
const straight = (p, q, horizontal, options) => Math.abs(horizontal ? p.y - q.y : p.x - q.x) <= Math.max(options.axisTolMm, 0.02 * Math.abs(horizontal ? p.x - q.x : p.y - q.y));

function clusterLines(segments, horizontal, tol) {
  const items = segments.filter((s) => (horizontal ? Math.abs(s.y2 - s.y1) <= tol * 0.2 && Math.abs(s.x2 - s.x1) > 0 : Math.abs(s.x2 - s.x1) <= tol * 0.2 && Math.abs(s.y2 - s.y1) > 0))
    .map((s) => horizontal ? { c: (s.y1 + s.y2) / 2, a: Math.min(s.x1, s.x2), b: Math.max(s.x1, s.x2) } : { c: (s.x1 + s.x2) / 2, a: Math.min(s.y1, s.y2), b: Math.max(s.y1, s.y2) })
    .sort((p, q) => p.c - q.c);
  const lines = [];
  for (const item of items) {
    const last = lines.at(-1);
    if (last && item.c - last.cMax <= tol) { last.parts.push(item); last.cMax = item.c; last.sum += item.c; } else lines.push({ parts: [item], cMax: item.c, sum: item.c });
  }
  return lines.map((line) => ({ c: line.sum / line.parts.length, intervals: mergeIntervals(line.parts) }));
}
function mergeIntervals(parts, gap = 0) {
  const sorted = [...parts].sort((p, q) => p.a - q.a); const out = [];
  for (const p of sorted) { const last = out.at(-1); if (last && p.a <= last.b + gap) last.b = Math.max(last.b, p.b); else out.push({ a: p.a, b: p.b }); }
  return out;
}
// Is [a, b] drawn along this line: enough of it, and right out to both ends?
function drawnAlong(line, a, b, options) {
  const joined = line.joined || (line.joined = mergeIntervals(line.intervals, options.joinGapMm));
  let covered = 0, reachA = false, reachB = false;
  for (const iv of joined) {
    const lo = Math.max(a, iv.a), hi = Math.min(b, iv.b);
    if (hi > lo) covered += hi - lo;
    if (iv.a <= a + options.cornerReachMm && iv.b >= a) reachA = true;
    if (iv.b >= b - options.cornerReachMm && iv.a <= b) reachB = true;
  }
  return reachA && reachB && covered >= options.solidShare * (b - a);
}
const polygonArea = (poly) => Math.abs(poly.reduce((s, p, i) => { const q = poly[(i + 1) % poly.length]; return s + p.x * q.y - q.x * p.y; }, 0)) / 2;
// Area of a polygon inside an axis-aligned rectangle (Sutherland-Hodgman against the four sides).
function overlapArea(poly, r) {
  let out = poly;
  const clip = (inside, cut) => { const res = []; for (let i = 0; i < out.length; i++) { const p = out[i], q = out[(i + 1) % out.length]; const pi = inside(p), qi = inside(q); if (pi) res.push(p); if (pi !== qi) res.push(cut(p, q)); } out = res; };
  const atX = (x) => (p, q) => ({ x, y: p.y + (q.y - p.y) * (x - p.x) / (q.x - p.x) });
  const atY = (y) => (p, q) => ({ x: p.x + (q.x - p.x) * (y - p.y) / (q.y - p.y), y });
  clip((p) => p.x >= r.l, atX(r.l)); if (out.length) clip((p) => p.x <= r.r, atX(r.r));
  if (out.length) clip((p) => p.y >= r.t, atY(r.t)); if (out.length) clip((p) => p.y <= r.b, atY(r.b));
  return out.length >= 3 ? polygonArea(out) : 0;
}
export function pointInPolygon(point, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside; }
  return inside;
}
// Distance from a rectangle side to the nearest parallel, overlapping (>= half the side) building edge.
// Building edges along one side: parallel (within the axis tolerance) and overlapping it. A side usually
// meets several short outline edges (jogs at openings), so their overlaps are summed.
function houseEdgesAlong(side, building, options, reachMm) {
  const edges = [];
  for (let j = 0; j < building.length; j++) {
    const p = building[j], q = building[(j + 1) % building.length];
    if (!straight(p, q, side.horizontal, options)) continue;
    const f0 = side.horizontal ? Math.min(p.x, q.x) : Math.min(p.y, q.y), f1 = side.horizontal ? Math.max(p.x, q.x) : Math.max(p.y, q.y);
    const overlap = Math.min(side.b, f1) - Math.max(side.a, f0); if (overlap <= 0) continue;
    const c = side.horizontal ? (p.y + q.y) / 2 : (p.x + q.x) / 2;
    if (Math.abs(c - side.c) <= reachMm) edges.push({ c, overlap });
  }
  return edges;
}
function sideToHouse(side, building, options) {
  const edges = houseEdgesAlong(side, building, options, options.touchHouseMm);
  if (edges.reduce((s, e) => s + e.overlap, 0) < 0.5 * (side.b - side.a)) return Infinity;
  return Math.min(...edges.map((e) => Math.abs(e.c - side.c)));
}

// The edge of an outdoor area that runs along the house (parallel, within 1.5 m, overlapping) is moved onto
// the building outline's edge, so it neither overlaps the house nor leaves a gap against it.
export function againstBuilding(polygon, building, reachMm = 1500, overrides = {}) {
  const options = { ...OUTDOOR_DEFAULTS, ...overrides };
  const n = polygon.length; let changed = false; const out = polygon.map((p) => ({ ...p }));
  for (let i = 0; i < n; i++) {
    const a = polygon[i], b = polygon[(i + 1) % n]; const horizontal = Math.abs(a.y - b.y) < Math.abs(a.x - b.x);
    const e0 = Math.min(horizontal ? a.x : a.y, horizontal ? b.x : b.y), e1 = Math.max(horizontal ? a.x : a.y, horizontal ? b.x : b.y); const c = horizontal ? (a.y + b.y) / 2 : (a.x + b.x) / 2;
    // The face this side lies against: the overlap-weighted position of the building edges along it.
    const edges = houseEdgesAlong({ horizontal, c, a: e0, b: e1 }, building, options, reachMm);
    const covered = edges.reduce((s, e) => s + e.overlap, 0);
    if (covered < (e1 - e0) * 0.5) continue;
    const fc = edges.reduce((s, e) => s + e.c * e.overlap, 0) / covered;
    const best = Math.abs(fc - c) >= 1 ? { fc } : null;
    if (!best) continue;
    if (horizontal) { out[i].y = best.fc; out[(i + 1) % n].y = best.fc; } else { out[i].x = best.fc; out[(i + 1) % n].x = best.fc; }
    changed = true;
  }
  return { polygon: out, changed };
}

/**
 * @param segments [{x1,y1,x2,y2}] drawn linework of the sheet, mm
 * @param label {text, x, y} the outdoor area's name on the plan, mm
 * @param building [{x,y}] building outline (outer wall faces), mm
 * @returns {{ polygon, areaM2, type, label, evidence } | { failed: string }}
 */
export function traceOutdoorArea({ segments, label, building, exclude = [], options: overrides = {} }) {
  const options = { ...OUTDOOR_DEFAULTS, ...overrides };
  const L = { x: label.x, y: label.y };
  if (!Array.isArray(building) || building.length < 3) return { failed: 'no building outline to attach the area to' };
  if (pointInPolygon(L, building)) return { failed: 'the label is inside the building outline' };
  const near = segments.filter((s) => Math.max(s.x1, s.x2) >= L.x - options.windowMm && Math.min(s.x1, s.x2) <= L.x + options.windowMm
    && Math.max(s.y1, s.y2) >= L.y - options.windowMm && Math.min(s.y1, s.y2) <= L.y + options.windowMm);
  const spans = (line, v) => line.intervals[0].a <= v && line.intervals.at(-1).b >= v;
  const ticks = tickMidpoints(near, options);
  const horizontals = clusterLines(near, true, options.lineTolMm), verticals = clusterLines(near, false, options.lineTolMm);
  const tickTol = options.tickMm[0];
  const tops = horizontals.filter((line) => line.c < L.y && spans(line, L.x)), bottoms = horizontals.filter((line) => line.c > L.y && spans(line, L.x));
  const lefts = verticals.filter((line) => line.c < L.x && spans(line, L.y)), rights = verticals.filter((line) => line.c > L.x && spans(line, L.y));
  let best = null;
  for (const l of lefts) for (const r of rights) {
    const width = r.c - l.c;
    const across = (line) => drawnAlong(line, l.c, r.c, options) && !ticksWithin(line.c, l.c, r.c, true, ticks, tickTol);
    const ts = tops.filter(across), bs = bottoms.filter(across);
    for (const t of ts) for (const b of bs) {
      const areaM2 = width * (b.c - t.c) / 1e6;
      if (areaM2 < options.minAreaM2 || areaM2 > options.maxAreaM2 || (best && areaM2 <= best.areaM2)) continue;
      if (!drawnAlong(l, t.c, b.c, options) || !drawnAlong(r, t.c, b.c, options)) continue;
      if (ticksWithin(l.c, t.c, b.c, false, ticks, tickTol) || ticksWithin(r.c, t.c, b.c, false, ticks, tickTol)) continue;
      const rect = { l: l.c, r: r.c, t: t.c, b: b.c };
      if (tickAtCorner(rect, ticks, tickTol)) continue;
      if (overlapArea(building, rect) / 1e6 > options.houseOverlapM2 + options.houseStripMm * Math.max(width, b.c - t.c) / 1e6) continue;
      // Nor over a space that is not part of it (a roof over the storey below beside a balcony).
      if (exclude.some((poly) => poly?.length >= 3 && overlapArea(poly, rect) / 1e6 > options.houseOverlapM2 + options.houseStripMm * Math.max(width, b.c - t.c) / 1e6)) continue;
      const sides = [{ horizontal: true, c: t.c, a: l.c, b: r.c }, { horizontal: true, c: b.c, a: l.c, b: r.c }, { horizontal: false, c: l.c, a: t.c, b: b.c }, { horizontal: false, c: r.c, a: t.c, b: b.c }];
      if (!sides.some((side) => sideToHouse(side, building, options) <= options.touchHouseMm)) continue;
      best = { rect, areaM2 };
    }
  }
  if (!best) return { failed: 'no closed outline of solid drawn edges around the label that is attached to the house' };
  const { rect } = best;
  const corners = [{ x: rect.l, y: rect.t }, { x: rect.r, y: rect.t }, { x: rect.r, y: rect.b }, { x: rect.l, y: rect.b }];
  const placed = againstBuilding(corners, building, options.touchHouseMm, options);
  const polygon = placed.polygon;
  const areaM2 = polygonArea(polygon) / 1e6;
  const xs = polygon.map((p) => p.x), ys = polygon.map((p) => p.y);
  const widthMm = Math.round(Math.max(...xs) - Math.min(...xs)), depthMm = Math.round(Math.max(...ys) - Math.min(...ys));
  return {
    polygon, areaM2, type: outdoorTypeOf(label.text), label: label.text, widthMm, depthMm,
    evidence: `Outline of the solid drawn edges around "${label.text}" (${widthMm} × ${depthMm} mm)${placed.changed ? ', side along the house put on the building\'s outer face' : ''}; measured from the vector linework.`,
  };
}
