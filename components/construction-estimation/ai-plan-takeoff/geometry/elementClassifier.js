// Drawing-element classification: a separate stage after the vector wall detector.
//
// The detector finds measured face pairs and openings. This stage decides WHAT each one is from
// evidence around it - connections, the strokes touching it, repeated patterns, nearby text and
// opening assemblies - and records that evidence with a confidence for every element:
//
//   wall       a measured wall; kept
//   joinery    a cabinetry outline read as a wall pair; removed from the walls
//   annotation repeated identical pairs (a table, grid or schedule); removed from the walls
//   uncertain  kept as geometry but held for the builder (no wall quantity until confirmed)
//   retaining  a labelled retaining / external structure the detector set aside; reported for
//              review only, never part of the house walls or rooms
//
// Openings get separate measurements: frame width, rough opening (the wall gap) and door leaf,
// each only when the drawing shows it. The quantity width stays the leaf for a door read from its
// swing; a gap or a frame is never substituted for a leaf.
//
// Rules are general (no plan names, coordinates or object ids). Every decision is explainable from
// the evidence list it records.
import { dimensionedThicknesses } from './dimensionLinework.js';

export const CLASSIFIER_DEFAULTS = {
  removeAt: 0.85,          // confidence at which a non-wall reading removes the pair from the walls
  reviewAt: 0.6,           // confidence at which it is held for the builder instead
  carcassDepthMm: [300, 800],
  carcassFaceReachMm: 15,
  endReachMm: 60,
  repeatMin: 4,
  repeatSpacingShare: 0.5,
  repeatClearMaxMm: 600,    // clear space between rows below which nothing could be a room or passage
  // Cabinetry evidence is recorded on every pair but only acts when this is on. Measured on Liberty and
  // Jesmond (2026-11-04) the outline rule flagged 10 pairs and all 10 were true walls with cabinets built
  // against them: plan linework alone does not separate a cabinet back from a wall behind a cabinet.
  actOnCabinetry: false,
  retainingLabelReachMm: 1500,
  retainingThicknessMm: [140, 320],
  retainingMinLengthMm: 1500,
  servicesBoxMaxSideMm: 1000,   // a stack or duct box side; longer pairs are walls
  servicesBoxReachMm: 800,      // both ends of a boxing pair lie this close to where the note's leader ends
  doorLeafLengthToleranceMm: 60, // an open door's leaf read as a pair: its length is the leaf width
  doorLeafGapToleranceMm: 100,   // ... and the gap it swings from is that wide
  doorLeafJambReachMm: 150,      // ... with the leaf's hinge end this close to the gap's jamb
};

const JOINERY_WORDS = /\b(bench|benchtop|fridge|robe|wir|shelf|shelves|cupboard|pantry|cabinet|cabinetry|joinery|vanity|overhead|bulkhead|island|desk|dw|dishwasher|oven|cooktop|linen|drawers?)\b/i;
const STRUCTURE_WORDS = /\b(wall|stud|block|brick|masonry|frame|framing|bearing)\b/i;
const RETAINING_WORDS = /\b(retaining|retaining wall|boundary wall|block wall|crib wall|landscape wall)\b/i;
// Notes naming a services enclosure (stair "risers" are deliberately not included).
const SERVICES_WORDS = /\b(plumbing stack|stack|duct shaft|services duct|service duct|sewer vent|vent stack)\b/i;

function frameOf(a, b) {
  const L = Math.hypot(b.x - a.x, b.y - a.y);
  const u = { x: (b.x - a.x) / L, y: (b.y - a.y) / L }, n = { x: -u.y, y: u.x };
  return { L, u, n, s0: a.x * u.x + a.y * u.y, c0: a.x * n.x + a.y * n.y };
}
const along = (f, p) => p.x * f.u.x + p.y * f.u.y;
const across = (f, p) => p.x * f.n.x + p.y * f.n.y;

/** Distance from point p to the body of wall w (logical px), allowing for its thickness. */
function distanceToWall(w, p, mmPx) {
  const [a, b] = w.nodes; const f = frameOf(a, b); if (!f.L) return Infinity;
  const s = along(f, p) - f.s0, c = Math.abs(across(f, p) - f.c0);
  const out = Math.max(0, -s, s - f.L), off = Math.max(0, c - (w.measuredThicknessMm || 0) / 2 * mmPx);
  return Math.hypot(out, off);
}

// The text layer gives each item's origin and length but not its rotation, so a line of text may run
// along +x, -x, +y or -y from its origin (rotated sheets print notes vertically).
const textBaselines = (t) => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ a: { x: t.x, y: t.y }, b: { x: t.x + dx * t.width, y: t.y + dy * t.width } }));
function pointSegmentDistance(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy;
  const k = L2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2)) : 0;
  return Math.hypot(p.x - a.x - k * dx, p.y - a.y - k * dy);
}

/** Note blocks: each line matching `words`, with the lines of the same size printed beside it (any orientation). */
function noteBlocks(textItems, words) {
  const items = (textItems || []).filter((t) => Number.isFinite(t.x) && Number.isFinite(t.y) && t.width > 0 && t.height > 0);
  return items.filter((t) => words.test(String(t.text || ''))).map((seed) => {
    const block = [seed];
    for (let grew = true; grew;) {
      grew = false;
      for (const t of items) {
        if (block.includes(t) || Math.abs(t.height - seed.height) > 0.25 * seed.height) continue;
        if (block.some((b) => textBaselines(b).some((e) => pointSegmentDistance(t, e.a, e.b) <= 1.8 * seed.height))) { block.push(t); grew = true; }
      }
    }
    return { label: seed.text, block, reach: 1.5 * seed.height };
  });
}

/** Strokes, plus arrowheads (small filled triangles; the tip is the vertex with the sharpest angle). */
function leaderLinework(segments, mmPx) {
  const strokes = segments.filter((s) => s.paint !== 'fill' && Math.hypot(s.x2 - s.x1, s.y2 - s.y1) > 0.5);
  const fills = new Map();
  for (const s of segments) if (s.paint === 'fill') { const k = `${s.path}|${s.subpath}`; if (!fills.has(k)) fills.set(k, []); fills.get(k).push(s); }
  const arrows = [];
  for (const parts of fills.values()) {
    const pts = [];
    for (const s of parts) for (const p of [{ x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }]) if (!pts.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 0.3)) pts.push(p);
    if (pts.length !== 3) continue;
    const size = Math.max(...pts.map((p) => Math.max(...pts.map((q) => Math.hypot(q.x - p.x, q.y - p.y)))));
    if (size < 50 * mmPx || size > 1500 * mmPx) continue;
    const angle = (i) => { const [p, q, r] = [pts[i], pts[(i + 1) % 3], pts[(i + 2) % 3]];
      const u = { x: q.x - p.x, y: q.y - p.y }, v = { x: r.x - p.x, y: r.y - p.y };
      return Math.acos(Math.max(-1, Math.min(1, (u.x * v.x + u.y * v.y) / Math.hypot(u.x, u.y) / Math.hypot(v.x, v.y)))); };
    const tipIndex = [0, 1, 2].sort((i, j) => angle(i) - angle(j))[0];
    if (angle(tipIndex) > Math.PI / 4) continue;
    const base = pts.filter((_, i) => i !== tipIndex);
    arrows.push({ tip: pts[tipIndex], base: { x: (base[0].x + base[1].x) / 2, y: (base[0].y + base[1].y) / 2 }, size });
  }
  return { strokes, arrows };
}

/**
 * Where a note's leaders end: chains of strokes starting beside the note text, followed while the
 * continuation is unambiguous. Returns the arrowhead (when the chain ends in one) and the chain's end.
 */
function leaderEnds(note, strokes, arrows) {
  const nearText = (p) => note.block.some((t) => textBaselines(t).some((e) => pointSegmentDistance(p, e.a, e.b) <= note.reach));
  const out = [];
  // A leader is drawn as its own small path; wall, grid and tile linework sits in long paths.
  const pathSize = new Map();
  for (const s of strokes) pathSize.set(s.path, (pathSize.get(s.path) || 0) + 1);
  const leaderLike = (s) => s.path === undefined || (pathSize.get(s.path) || 0) <= 4;
  // Leaders leave a note from the start or end of one of its lines, not from the middle of the text.
  const atLineEnd = (p) => note.block.some((t) => textBaselines(t).some((e) => Math.min(Math.hypot(p.x - e.a.x, p.y - e.a.y), Math.hypot(p.x - e.b.x, p.y - e.b.y)) <= note.reach));
  for (const first of strokes) {
    if (!leaderLike(first)) continue;
    for (const startEnd of [0, 1]) {
      const start = startEnd ? { x: first.x2, y: first.y2 } : { x: first.x1, y: first.y1 };
      if (!atLineEnd(start)) continue;
      let seg = first, end = startEnd ? { x: first.x1, y: first.y1 } : { x: first.x2, y: first.y2 }, arrow = null, steps = 0;
      const seen = new Set([seg]);
      for (; steps < 8; steps++) {
        arrow = arrows.find((a) => Math.hypot(a.base.x - end.x, a.base.y - end.y) <= Math.max(2, 0.25 * a.size)) || null;
        if (arrow) break;
        const next = strokes.filter((s) => !seen.has(s) && leaderLike(s) && (Math.hypot(s.x1 - end.x, s.y1 - end.y) <= 0.75 || Math.hypot(s.x2 - end.x, s.y2 - end.y) <= 0.75));
        const pick = next.length === 1 ? next[0] : next.filter((s) => s.path === seg.path).length === 1 ? next.find((s) => s.path === seg.path) : null;
        if (!pick) break;
        seen.add(pick); seg = pick;
        end = Math.hypot(pick.x1 - end.x, pick.y1 - end.y) <= 0.75 ? { x: pick.x2, y: pick.y2 } : { x: pick.x1, y: pick.y1 };
      }
      const target = arrow ? arrow.tip : end;
      if (nearText(target)) continue;
      out.push({ arrow, end, target, strokes: seen.size });
    }
  }
  return out;
}

/**
 * Structures a retaining note points at with a leader: note lines (the matching line and the lines
 * printed with it) -> a chain of strokes starting beside the text -> a filled arrowhead -> the pair of
 * parallel face lines the arrow tip lands on, at a retaining-wall thickness. Dashed faces are bridged.
 */
export function leaderPointedStructures(segments, textItems, mmPx, options = CLASSIFIER_DEFAULTS) {
  const notes = noteBlocks(textItems, RETAINING_WORDS);
  if (!notes.length) return [];
  const { strokes, arrows } = leaderLinework(segments, mmPx);
  const found = [];
  for (const note of notes) {
    for (const { arrow } of leaderEnds(note, strokes, arrows)) {
      if (!arrow) continue;
      const pair = facePairAt(arrow.tip, strokes, mmPx, options);
      if (!pair) continue;
      if (found.some((f) => Math.hypot(f.nodes[0].x - pair.nodes[0].x, f.nodes[0].y - pair.nodes[0].y) < 1 && Math.hypot(f.nodes[1].x - pair.nodes[1].x, f.nodes[1].y - pair.nodes[1].y) < 1)) continue;
      found.push({ element: 'retaining', nodes: pair.nodes, thicknessMm: pair.thicknessMm, confidence: 0.75, label: note.label,
        evidence: [`the note "${note.block.map((t) => t.text).join(' / ')}" points here with a leader and arrowhead`,
          `${pair.thicknessMm} mm between two parallel face lines ${Math.round(pair.lengthMm)} mm long (faces drawn over ${Math.round(pair.coverage[0] * 100)}% and ${Math.round(pair.coverage[1] * 100)}% of that length; dashed lengths bridged)`] });
    }
  }
  return found;
}

/**
 * Small boxes a services note (plumbing stack, duct) points into: every short pair lying entirely
 * within `reachMm` of the leader's end is boxing around a pipe or duct, not a room wall.
 */
export function servicesBoxingPoints(segments, textItems, mmPx) {
  const notes = noteBlocks(textItems, SERVICES_WORDS);
  if (!notes.length) return [];
  const { strokes, arrows } = leaderLinework(segments, mmPx);
  return notes.flatMap((note) => leaderEnds(note, strokes, arrows).map(({ target }) => ({ point: target, label: note.label })));
}

/** The parallel face pair an arrow tip lands on: the tip's face line and a partner at retaining thickness. */
function facePairAt(tip, strokes, mmPx, options) {
  const minLen = 500 * mmPx, onTol = 1.5, lineTol = 0.6, gap = 600 * mmPx;
  const host = strokes.filter((s) => Math.hypot(s.x2 - s.x1, s.y2 - s.y1) >= minLen && pointSegmentDistance(tip, { x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }) <= onTol)
    .sort((p, q) => Math.hypot(q.x2 - q.x1, q.y2 - q.y1) - Math.hypot(p.x2 - p.x1, p.y2 - p.y1))[0];
  if (!host) return null;
  const f = frameOf({ x: host.x1, y: host.y1 }, { x: host.x2, y: host.y2 });
  const parallel = strokes.filter((s) => { const L = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
    return L >= 2 && Math.abs(((s.x2 - s.x1) * f.n.x + (s.y2 - s.y1) * f.n.y) / L) < 0.02; })
    .map((s) => { const a = along(f, { x: s.x1, y: s.y1 }), b = along(f, { x: s.x2, y: s.y2 });
      return { c: (across(f, { x: s.x1, y: s.y1 }) + across(f, { x: s.x2, y: s.y2 })) / 2, lo: Math.min(a, b), hi: Math.max(a, b) }; });
  const sTip = along(f, tip), cA = across(f, tip);
  const runAt = (c) => {
    const pieces = parallel.filter((p) => Math.abs(p.c - c) <= lineTol).sort((p, q) => p.lo - q.lo);
    const runs = [];
    for (const p of pieces) { const last = runs[runs.length - 1]; if (last && p.lo <= last.hi + gap) { last.hi = Math.max(last.hi, p.hi); last.pieces.push(p); } else runs.push({ lo: p.lo, hi: p.hi, pieces: [p] }); }
    return runs.find((r) => sTip >= r.lo - onTol && sTip <= r.hi + onTol) || null;
  };
  const drawn = (run, lo, hi) => {
    const parts = run.pieces.map((p) => [Math.max(lo, p.lo), Math.min(hi, p.hi)]).filter(([a, b]) => b > a).sort((p, q) => p[0] - q[0]);
    let total = 0, reach = lo; for (const [a, b] of parts) { if (b > reach) { total += b - Math.max(a, reach); reach = b; } } return total;
  };
  const runA = runAt(cA); if (!runA) return null;
  let best = null;
  for (const c of [...new Set(parallel.map((p) => Math.round(p.c * 10) / 10))]) {
    const t = Math.abs(c - cA) / mmPx; if (t < options.retainingThicknessMm[0] || t > options.retainingThicknessMm[1]) continue;
    const runB = runAt(c); if (!runB) continue;
    const lo = Math.max(runA.lo, runB.lo), hi = Math.min(runA.hi, runB.hi); if (hi - lo < options.retainingMinLengthMm * mmPx) continue;
    const coverage = [drawn(runA, lo, hi) / (hi - lo), drawn(runB, lo, hi) / (hi - lo)];
    if (Math.min(...coverage) < 0.6) continue;
    const score = (hi - lo) * Math.min(...coverage);
    if (!best || score > best.score) best = { score, lo, hi, c, coverage };
  }
  if (!best) return null;
  // Face A's position: length-weighted over its pieces inside the pair.
  const inA = runA.pieces.map((p) => ({ c: p.c, w: Math.max(0, Math.min(best.hi, p.hi) - Math.max(best.lo, p.lo)) })).filter((p) => p.w > 0);
  const faceA = inA.reduce((s, p) => s + p.c * p.w, 0) / inA.reduce((s, p) => s + p.w, 0);
  const mid = (faceA + best.c) / 2;
  const point = (s) => ({ x: f.u.x * s + f.n.x * mid, y: f.u.y * s + f.n.y * mid });
  return { nodes: [point(best.lo), point(best.hi)], thicknessMm: Math.round(Math.abs(best.c - faceA) / mmPx), lengthMm: (best.hi - best.lo) / mmPx, coverage: best.coverage };
}

/**
 * @param {{ walls: any[], openings: any[], rejected: any[], straight: any[], textItems?: any[], mmPx: number }} input
 * @returns {{ walls: any[], openings: any[], removed: any[], structures: any[], records: any[], stats: object }}
 */
export function classifyDrawingElements({ walls, openings, rejected = [], straight = [], segments = null, textItems = [], mmPx }, overrides = {}) {
  const options = { ...CLASSIFIER_DEFAULTS, ...overrides };
  const records = new Map();
  const note = (id, rule, weight, detail) => { const r = records.get(id); r.evidence.push({ rule, weight, detail }); };
  for (const w of walls) records.set(w.id, { id: w.id, element: 'wall', evidence: [] });

  // --- Connections: what each end of a pair meets. A wall nearly always meets other walls.
  const endsMeet = new Map();
  for (const w of walls) {
    const reach = (p) => walls.some((o) => o !== w && distanceToWall(o, p, mmPx) <= ((w.measuredThicknessMm || 0) / 2 + options.endReachMm) * mmPx);
    const ends = w.nodes.map(reach);
    endsMeet.set(w.id, ends);
    const met = ends.filter(Boolean).length;
    note(w.id, 'connections', met === 2 ? 0.3 : met === 1 ? 0.1 : -0.2, `${met} of 2 ends meet another wall`);
  }

  // --- Dimensioned as a wall: the drawing's own dimension chain measures this pair's two faces as a
  // printed wall thickness. Support only; a pair without it is not thereby joinery.
  const dimensioned = segments ? dimensionedThicknesses(segments, textItems, mmPx) : [];
  for (const w of walls) {
    const [a, b] = w.nodes, half = (w.measuredThicknessMm || 0) / 2 * mmPx, tol = 15 * mmPx;
    const horizontal = Math.abs(a.y - b.y) <= 0.5 && Math.abs(a.x - b.x) > 0.5, vertical = Math.abs(a.x - b.x) <= 0.5 && Math.abs(a.y - b.y) > 0.5;
    if (!horizontal && !vertical) continue;
    const c = horizontal ? (a.y + b.y) / 2 : (a.x + b.x) / 2, axis = horizontal ? 'y' : 'x';
    const hit = dimensioned.find((d) => d.axis === axis && Math.abs(d.lo - (c - half)) <= tol && Math.abs(d.hi - (c + half)) <= tol);
    if (hit) { w.dimensionedAsWallMm = hit.valueMm; note(w.id, 'dimension-chain', 0.3, `the drawing's dimension chain measures both faces as a ${hit.valueMm} mm wall`); }
  }

  // --- Repeated identical pairs at a regular spacing: a table, schedule grid or other notation.
  // Connected groups of walls (an end touching another wall's body joins them); the building is the
  // group with the most wall length.
  const component = new Map();
  let mainComponent = -1, mainLength = -1;
  for (const start of walls) {
    if (component.has(start)) continue;
    const id = component.size ? Math.max(...component.values()) + 1 : 0;
    const stack = [start]; component.set(start, id); let length = 0;
    while (stack.length) {
      const w = stack.pop(); length += w.lengthMm || 0;
      for (const o of walls) {
        if (component.has(o)) continue;
        const reach = ((w.measuredThicknessMm || 0) + (o.measuredThicknessMm || 0)) / 2 + options.endReachMm;
        if (w.nodes.some((p) => distanceToWall(o, p, mmPx) <= reach * mmPx) || o.nodes.some((p) => distanceToWall(w, p, mmPx) <= reach * mmPx)) { component.set(o, id); stack.push(o); }
      }
    }
    if (length > mainLength) { mainLength = length; mainComponent = id; }
  }
  const groups = new Map();
  for (const w of walls) {
    const [a, b] = w.nodes; const f = frameOf(a, b);
    const key = `${Math.round(Math.atan2(f.u.y, f.u.x) * 100)}|${Math.round(f.L / mmPx / 25)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ w, f });
  }
  const annotationIds = new Set();
  for (const group of groups.values()) {
    if (group.length < options.repeatMin) continue;
    const ref = group[0].f;
    const thick = group.map(({ w }) => w.measuredThicknessMm || 0).sort((p, q) => p - q)[Math.floor(group.length / 2)];
    const aligned = group.filter(({ w }) => Math.abs((w.measuredThicknessMm || 0) - thick) <= 0.15 * thick).filter(({ w }) => Math.abs(along(ref, w.nodes[0]) - along(ref, group[0].w.nodes[0])) <= 50 * mmPx
      || Math.abs(along(ref, w.nodes[1]) - along(ref, group[0].w.nodes[0])) <= 50 * mmPx);
    if (aligned.length < options.repeatMin) continue;
    const offsets = aligned.map(({ w }) => across(ref, w.nodes[0])).sort((p, q) => p - q);
    const gaps = offsets.slice(1).map((v, i) => v - offsets[i]);
    const mean = gaps.reduce((s, v) => s + v, 0) / gaps.length;
    if (!(mean > 0) || gaps.some((g) => Math.abs(g - mean) > 0.1 * mean)) continue;
    if (mean > options.repeatSpacingShare * ref.L) continue;
    // Rows with no usable space between them (narrower than any room or passage) are not walls that
    // enclose rooms: a table, schedule or grid drawn with paired lines. Real walls repeated at an even
    // spacing have rooms between them.
    if (mean / mmPx - thick >= options.repeatClearMaxMm) continue;
    // Repetition alone is not enough (unlabelled stair treads inside a building stay for review by the
    // stair rules): the rows must also stand apart from the building's connected walls.
    if (aligned.some(({ w }) => component.get(w) === mainComponent)) continue;
    for (const { w } of aligned) { annotationIds.add(w.id); note(w.id, 'repeated-pattern', -0.9, `${aligned.length} identical ${Math.round(ref.L / mmPx)} mm pairs at an even ${Math.round(mean / mmPx)} mm spacing (a table, grid or schedule)`); }
  }

  // --- Cabinetry: single strokes running square off one face at cabinet depth (carcass sides).
  const otherFaceBands = walls.map((o) => { const f = frameOf(o.nodes[0], o.nodes[1]); return { o, f, half: (o.measuredThicknessMm || 0) / 2 * mmPx }; });
  const onSomeWall = (p, self) => otherFaceBands.some(({ o, f, half }) => o !== self && Math.abs(across(f, p) - f.c0) <= half + 3 * mmPx
    && along(f, p) >= f.s0 - 3 * mmPx && along(f, p) <= f.s0 + f.L + 3 * mmPx);
  const joineryIds = new Map();
  for (const w of walls) {
    if (annotationIds.has(w.id)) continue;
    const f = frameOf(w.nodes[0], w.nodes[1]); const half = (w.measuredThicknessMm || 0) / 2 * mmPx;
    const carcass = { [-1]: [], [1]: [] };
    for (const s of straight) {
      const p = { x: s.x1, y: s.y1 }, q = { x: s.x2, y: s.y2 };
      if (Math.abs(along(f, p) - along(f, q)) > 0.5 * mmPx) continue;              // not square to the pair
      const sAt = along(f, p) - f.s0; if (sAt < -5 * mmPx || sAt > f.L + 5 * mmPx) continue;
      for (const side of [-1, 1]) {
        const face = f.c0 + side * half;
        const cp = across(f, p), cq = across(f, q);
        const [near, far] = Math.abs(cp - face) <= Math.abs(cq - face) ? [cp, cq] : [cq, cp];
        if (Math.abs(near - face) > options.carcassFaceReachMm * mmPx || side * (far - near) <= 0) continue;
        const depth = Math.abs(far - near) / mmPx;
        if (depth < options.carcassDepthMm[0] || depth > options.carcassDepthMm[1]) continue;
        const farPoint = Math.abs(cp - face) <= Math.abs(cq - face) ? q : p;
        if (onSomeWall(farPoint, w)) continue;                                       // a wall, not a carcass side
        carcass[side].push({ sAt, depth });
      }
    }
    const side = carcass[1].length >= carcass[-1].length ? 1 : -1;
    const sides = carcass[side];
    if (sides.length < 2) continue;
    // A front line at the carcass depth, parallel to the pair, closes the cabinet outline.
    const depth = sides.reduce((s, v) => s + v.depth, 0) / sides.length;
    const front = straight.some((s) => { const p = { x: s.x1, y: s.y1 }, q = { x: s.x2, y: s.y2 };
      if (Math.abs(across(f, p) - across(f, q)) > 0.5 * mmPx) return false;
      const off = side * (across(f, p) - (f.c0 + side * half)) / mmPx;
      const lo = Math.min(along(f, p), along(f, q)) - f.s0, hi = Math.max(along(f, p), along(f, q)) - f.s0;
      return Math.abs(off - depth) <= 60 && Math.min(hi, f.L) - Math.max(lo, 0) >= 0.3 * f.L; });
    const ends = endsMeet.get(w.id); const freeEnds = ends.filter((e) => !e).length;
    // Anything structural attached to the other face (a partition meeting it) makes it a wall.
    const backed = walls.some((o) => o !== w && o.nodes.some((p) => { const c = across(f, p) - f.c0, s = along(f, p) - f.s0;
      return -side * c >= half - 3 * mmPx && -side * c <= half + ((o.measuredThicknessMm || 0) / 2 + options.endReachMm) * mmPx && s > 0.1 * f.L && s < 0.9 * f.L; }));
    const words = (textItems || []).filter((t) => Number.isFinite(t.x) && Math.abs(along(f, t) - f.s0 - f.L / 2) <= f.L / 2 + 600 * mmPx
      && side * (across(f, t) - f.c0) > 0 && side * (across(f, t) - f.c0) <= (depth + 600) * mmPx).map((t) => String(t.text || ''));
    let score = 0.35; const why = [`${sides.length} carcass sides ${Math.round(depth)} mm deep run square off one face`];
    if (front) { score += 0.15; why.push('a front line at that depth closes the outline'); }
    if (freeEnds) { score += 0.2 * freeEnds; why.push(`${freeEnds} end${freeEnds > 1 ? 's' : ''} meet${freeEnds > 1 ? '' : 's'} no wall`); }
    if (!backed) { score += 0.15; why.push('no partition meets the other face'); } else { score -= 0.4; why.push('a partition meets the other face'); }
    if (words.some((t) => JOINERY_WORDS.test(t))) { score += 0.2; why.push(`labelled ${JSON.stringify(words.find((t) => JOINERY_WORDS.test(t)))}`); }
    if (words.some((t) => STRUCTURE_WORDS.test(t) && !JOINERY_WORDS.test(t))) { score -= 0.3; why.push('a structural note sits beside it'); }
    joineryIds.set(w.id, Math.min(0.95, score));
    note(w.id, 'cabinetry-outline', -score, why.join('; '));
  }

  // --- Decide each pair.
  const kept = [], removed = [];
  for (const w of walls) {
    const r = records.get(w.id);
    if (annotationIds.has(w.id)) { r.element = 'annotation'; r.confidence = 0.9; removed.push({ wall: w, record: r }); continue; }
    const joinery = options.actOnCabinetry ? joineryIds.get(w.id) || 0 : 0;
    if (joinery >= options.removeAt) { r.element = 'joinery'; r.confidence = joinery; removed.push({ wall: w, record: r }); continue; }
    if (joinery >= options.reviewAt) {
      r.element = 'uncertain'; r.confidence = joinery;
      kept.push({ ...w, quantityReview: w.quantityReview || `Possibly cabinetry, not a wall (${r.evidence.find((e) => e.rule === 'cabinetry-outline').detail}). Confirm before it is quantified.`, classification: { element: 'uncertain', confidence: Math.round(joinery * 100) / 100 } });
      continue;
    }
    const support = r.evidence.reduce((s, e) => s + e.weight, 0);
    r.element = 'wall'; r.confidence = Math.max(0.5, Math.min(0.97, 0.75 + support));
    kept.push({ ...w, classification: { element: 'wall', confidence: Math.round(r.confidence * 100) / 100 } });
  }

  // --- Retaining and external structures the detector set aside as unjoined or off-pen pairs.
  const structures = [];
  for (const item of rejected) {
    if (!item.a || !item.b || !/not joined to the building|wall pens/.test(item.reason || '')) continue;
    const t = item.thicknessMm || 0, f = frameOf(item.a, item.b); if (!f.L) continue;
    if (t < options.retainingThicknessMm[0] || t > options.retainingThicknessMm[1] || f.L / mmPx < options.retainingMinLengthMm) continue;
    const label = (textItems || []).find((x) => Number.isFinite(x.x) && RETAINING_WORDS.test(String(x.text || ''))
      && along(f, x) >= f.s0 - options.retainingLabelReachMm * mmPx && along(f, x) <= f.s0 + f.L + options.retainingLabelReachMm * mmPx
      && Math.abs(across(f, x) - f.c0) <= options.retainingLabelReachMm * mmPx);
    if (!label) continue;
    // One record per run: overlapping collinear pieces are the same structure.
    const same = structures.find((s) => Math.abs(across(f, s.nodes[0]) - f.c0) <= 20 * mmPx && Math.abs(Math.abs(f.u.x * s.u.x + f.u.y * s.u.y) - 1) < 1e-3);
    if (same) { if (f.L > same.L) Object.assign(same, { nodes: [item.a, item.b], L: f.L, thicknessMm: t }); continue; }
    structures.push({ element: 'retaining', nodes: [item.a, item.b], L: f.L, u: f.u, thicknessMm: t, confidence: 0.8, label: label.text,
      evidence: [`${Math.round(t)} mm pair ${Math.round(f.L / mmPx)} mm long that the detector set aside (${item.reason})`, `labelled "${label.text}"`] });
  }
  // A retaining note placed away from its wall points at it with a leader ending in an arrowhead. The
  // wall is the parallel pair of face lines the arrow tip lands on (a face may be dashed where it runs
  // under a slab above). Only pairs no wall and no structure above already covers.
  if (segments?.length) {
    for (const found of leaderPointedStructures(segments, textItems, mmPx, options)) {
      const f = frameOf(found.nodes[0], found.nodes[1]);
      const lo = Math.min(along(f, found.nodes[0]), along(f, found.nodes[1])), hi = Math.max(along(f, found.nodes[0]), along(f, found.nodes[1]));
      const onLine = (s) => Math.abs(Math.abs(f.u.x * s.u.x + f.u.y * s.u.y) - 1) < 1e-3 && Math.abs(across(f, s.nodes[0]) - f.c0) <= 25 * mmPx;
      const overlaps = (s) => Math.min(along(f, s.nodes[0]), along(f, s.nodes[1])) < hi - 100 * mmPx && Math.max(along(f, s.nodes[0]), along(f, s.nodes[1])) > lo + 100 * mmPx;
      if (structures.some((s) => onLine(s) && overlaps(s))) continue;
      // House walls the detector measured on this same pair are pieces of the labelled retaining wall:
      // they stay in the room geometry but are measured with the structure, never as house walls.
      const pieces = kept.filter((w) => { const s = { nodes: w.nodes, u: frameOf(w.nodes[0], w.nodes[1]).u };
        return onLine(s) && overlaps(s) && Math.abs((w.measuredThicknessMm || 0) - found.thicknessMm) <= 40
          && Math.min(along(f, w.nodes[0]), along(f, w.nodes[1])) >= lo - 100 * mmPx && Math.max(along(f, w.nodes[0]), along(f, w.nodes[1])) <= hi + 100 * mmPx; });
      // A pair that partly overlaps a different house wall is not cleanly a separate structure.
      const clash = kept.some((w) => !pieces.includes(w) && overlaps({ nodes: w.nodes }) && onLine({ nodes: w.nodes, u: frameOf(w.nodes[0], w.nodes[1]).u }));
      if (clash) continue;
      for (const w of pieces) {
        w.retainingPiece = true;
        w.quantityReview = `Part of the labelled retaining wall ("${found.label}"): measured with that structure, not as a house wall.`;
        w.classification = { element: 'retaining', confidence: found.confidence };
        records.get(w.id)?.evidence.push({ rule: 'retaining-leader', weight: 0, detail: found.evidence[0] });
      }
      structures.push({ ...found, coversWallIds: pieces.map((w) => w.id), L: f.L, u: f.u,
        evidence: pieces.length ? [...found.evidence, `includes ${pieces.length} measured pair${pieces.length > 1 ? 's' : ''} on the same line (${pieces.map((w) => w.id).join(', ')})`] : found.evidence });
    }
    // Boxing around a pipe or duct a services note points into: short pairs wholly beside the leader's
    // end. Kept as geometry (it bounds the room) but not measured as house walls.
    for (const { point, label } of servicesBoxingPoints(segments, textItems, mmPx)) {
      for (const w of kept) {
        if (w.retainingPiece || w.servicesBoxing || (w.lengthMm || Infinity) > options.servicesBoxMaxSideMm) continue;
        if (!w.nodes.every((p) => Math.hypot(p.x - point.x, p.y - point.y) <= options.servicesBoxReachMm * mmPx)) continue;
        w.servicesBoxing = true;
        w.quantityReview = `Boxing around the services the note "${label}" points to: not a room wall; measure it with the services (lined boxing) if it is required.`;
        w.classification = { element: 'services', confidence: 0.8 };
        records.get(w.id)?.evidence.push({ rule: 'services-leader', weight: 0, detail: `the note "${label}" points into this box` });
      }
    }
  }

  // --- Opening measurements: frame, rough opening and leaf are separate, each only when drawn.
  for (const o of openings) {
    const m = {};
    if (Number.isFinite(o.leafMm)) m.leafWidthMm = Math.round(o.leafMm);
    // A frame width only where a frame was what found the opening (not a gap that merely stops at one).
    if (o.kind !== 'opening' && (o.frameUnit || /^(window box|window frame drawn|frame drawn out|d+ frame panels|closed projected frame|d+ frame or glass line)/i.test(o.evidence || ''))) m.frameWidthMm = Math.round(o.widthMm);
    if (o.kind === 'opening' || o.bridgeWidthMm) m.roughOpeningMm = Math.round(o.bridgeWidthMm || o.widthMm);
    o.measurements = m;
  }
  // A gap in the wall holding exactly one door read from its swing is that door's rough opening.
  for (const gap of openings) {
    if (gap.kind !== 'opening' || gap.bridgeOnly || !gap.direction) continue;
    const f = { u: gap.direction, n: { x: -gap.direction.y, y: gap.direction.x } };
    const sg = gap.x * f.u.x + gap.y * f.u.y, cg = gap.x * f.n.x + gap.y * f.n.y;
    // The gap's own extent (after any frame beside it was taken out), not the full bridged span.
    const half = gap.widthMm / 2 * mmPx;
    const doors = openings.filter((d) => d !== gap && d.kind === 'door' && Number.isFinite(d.leafMm) && d.direction
      && Math.abs(Math.abs(d.direction.x * f.u.x + d.direction.y * f.u.y) - 1) < 0.01
      && Math.abs(d.x * f.n.x + d.y * f.n.y - cg) <= Math.max(gap.hostThicknessMm || 0, 100) * mmPx
      && Math.abs(d.x * f.u.x + d.y * f.u.y - sg) <= half);
    if (doors.length !== 1 || doors[0].leafMm < 0.5 * gap.widthMm) continue;
    gap.bridgeOnly = true;
    gap.evidence = `${gap.evidence || 'gap'}; the wall gap of the ${Math.round(doors[0].leafMm)} mm door read from its swing`;
    doors[0].measurements = { ...doors[0].measurements, roughOpeningMm: Math.round(gap.widthMm) };
  }

  // A door drawn open: its leaf is a short double line the detector can read as a wall pair, and the
  // swing is then hung on that "wall". The pair is the leaf when it is the door's leaf length, one end
  // meets nothing and the other end sits at the jamb of a gap of the same width - the door's real opening.
  for (const door of [...openings]) {
    if (door.kind !== 'door' || !Number.isFinite(door.leafMm) || (door.hostWallIds || []).length !== 1) continue;
    const leaf = kept.find((w) => w.id === door.hostWallIds[0]);
    if (!leaf || Math.abs((leaf.lengthMm || 0) - door.leafMm) > options.doorLeafLengthToleranceMm) continue;
    const ends = leaf.nodes.map((p) => kept.some((o) => o !== leaf && distanceToWall(o, p, mmPx) <= ((leaf.measuredThicknessMm || 0) / 2 + options.endReachMm) * mmPx));
    if (ends.filter(Boolean).length > 1) continue;
    const gap = openings.find((g) => g !== door && g.kind !== 'door' && g.direction && !g.bridgeOnly && Math.abs((g.widthMm || 0) - door.leafMm) <= options.doorLeafGapToleranceMm
      && Math.abs(g.direction.x * (leaf.nodes[1].x - leaf.nodes[0].x) + g.direction.y * (leaf.nodes[1].y - leaf.nodes[0].y)) < 0.2 * (leaf.lengthMm || 1) * mmPx
      && leaf.nodes.some((p) => [-1, 1].some((side) => Math.hypot(p.x - (g.x + side * g.direction.x * g.widthMm / 2 * mmPx), p.y - (g.y + side * g.direction.y * g.widthMm / 2 * mmPx)) <= options.doorLeafJambReachMm * mmPx)));
    if (!gap) continue;
    const r = records.get(leaf.id);
    if (r) { r.element = 'door-leaf'; r.confidence = 0.85; r.evidence.push({ rule: 'open-door-leaf', weight: -0.9, detail: `the ${Math.round(door.leafMm)} mm leaf of a door drawn open (its swing is hung on it; its hinge end is at the jamb of the ${Math.round(gap.widthMm)} mm gap ${gap.id})` }); }
    kept.splice(kept.indexOf(leaf), 1); removed.push({ wall: leaf, record: r });
    Object.assign(gap, { kind: 'door', leafMm: door.leafMm, confirmed: true, needsClassification: false,
      evidence: `door swing (${Math.round(door.leafMm)} mm leaf) drawn open across ${gap.evidence ? `"${gap.evidence}"` : 'the gap'}; the gap is its opening`,
      measurements: { ...(gap.measurements || {}), leafWidthMm: Math.round(door.leafMm), roughOpeningMm: Math.round(gap.widthMm) } });
    openings.splice(openings.indexOf(door), 1);
  }

  const list = [...records.values()].map((r) => ({ ...r, confidence: Math.round((r.confidence ?? 0) * 100) / 100 }));
  return {
    walls: kept, openings, removed, structures: structures.map(({ L, u, ...s }) => s), records: list,
    stats: { walls: kept.length, joineryRemoved: removed.filter((x) => x.record.element === 'joinery').length, annotationRemoved: removed.filter((x) => x.record.element === 'annotation').length,
      uncertain: kept.filter((w) => w.classification?.element === 'uncertain').length, retaining: structures.length },
  };
}
