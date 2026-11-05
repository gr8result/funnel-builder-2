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
};

const JOINERY_WORDS = /\b(bench|benchtop|fridge|robe|wir|shelf|shelves|cupboard|pantry|cabinet|cabinetry|joinery|vanity|overhead|bulkhead|island|desk|dw|dishwasher|oven|cooktop|linen|drawers?)\b/i;
const STRUCTURE_WORDS = /\b(wall|stud|block|brick|masonry|frame|framing|bearing)\b/i;
const RETAINING_WORDS = /\b(retaining|retaining wall|boundary wall|block wall|crib wall|landscape wall)\b/i;

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

/**
 * @param {{ walls: any[], openings: any[], rejected: any[], straight: any[], textItems?: any[], mmPx: number }} input
 * @returns {{ walls: any[], openings: any[], removed: any[], structures: any[], records: any[], stats: object }}
 */
export function classifyDrawingElements({ walls, openings, rejected = [], straight = [], textItems = [], mmPx }, overrides = {}) {
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

  const list = [...records.values()].map((r) => ({ ...r, confidence: Math.round((r.confidence ?? 0) * 100) / 100 }));
  return {
    walls: kept, openings, removed, structures: structures.map(({ L, u, ...s }) => s), records: list,
    stats: { walls: kept.length, joineryRemoved: removed.filter((x) => x.record.element === 'joinery').length, annotationRemoved: removed.filter((x) => x.record.element === 'annotation').length,
      uncertain: kept.filter((w) => w.classification?.element === 'uncertain').length, retaining: structures.length },
  };
}
