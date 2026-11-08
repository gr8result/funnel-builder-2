// A building footprint read by the plan-reading model is a rough outline (its positions can be a
// metre or more out, and the error is often a stretch across the sheet). Each edge of that outline is
// moved onto measured drawing geometry running along it: the outer face of a measured external wall
// (the gross footprint is measured to the outside of the external walls) or, on an open side, the
// drawn outline of an alfresco, patio or balcony traced from the sheet. Edges with neither stay where
// the reading put them. Only the reading's own footprints are passed in; traced or approved outlines
// are never changed here.

export const FOOTPRINT_CONSTRAINT_DEFAULTS = {
  minEdgeMm: 1000,         // shorter edges (jogs) keep their line; their ends follow the neighbours
  reachMm: 3000,           // furthest an edge may move onto a wall face or drawn outline
  parallelCos: 0.996,      // within about 5 degrees
  minOverlapShare: 0.5,    // the wall runs along at least half the edge...
  minOverlapMm: 3000,      // ...or at least this long a stretch of it
  maxAreaChangeShare: 0.12, // a larger change means the walls and the outline are not the same building
  minSupportedShare: 0.5,  // share of the perimeter on measured walls for the outline to count as verified
};

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const dot = (a, b) => a.x * b.x + a.y * b.y;
const signedArea = (nodes) => nodes.reduce((sum, p, i) => { const q = nodes[(i + 1) % nodes.length]; return sum + p.x * q.y - q.x * p.y; }, 0) / 2;

function segmentsCross(a, b, c, d) {
  const o = (p, q, r) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}
function selfCrossing(nodes) {
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 2; j < nodes.length; j += 1) {
      if (i === 0 && j === nodes.length - 1) continue;
      if (segmentsCross(nodes[i], nodes[(i + 1) % nodes.length], nodes[j], nodes[(j + 1) % nodes.length])) return true;
    }
  }
  return false;
}
// Where two edge lines (point + direction) meet; null when they are parallel.
function meet(p, u, q, v) {
  const denominator = u.x * v.y - u.y * v.x;
  if (Math.abs(denominator) < 1e-9) return null;
  const t = ((q.x - p.x) * v.y - (q.y - p.y) * v.x) / denominator;
  return { x: p.x + u.x * t, y: p.y + u.y * t };
}

/**
 * @param nodes footprint outline in millimetres (sheet frame)
 * @param walls measured supports in mm: external walls { id, nodes, thicknessMm } and drawn outdoor
 *   outlines { id, nodes, closed: true, kind: 'outline' } (thickness 0: the line itself is the edge)
 * @returns {{ nodes, status, edges, movedEdges, supportedShare, beforeM2, afterM2, moves, reason? }}
 */
export function constrainFootprintToWalls(nodes, walls, overrides = {}) {
  const options = { ...FOOTPRINT_CONSTRAINT_DEFAULTS, ...overrides };
  const beforeM2 = Math.abs(signedArea(nodes)) / 1e6;
  const base = { nodes, edges: nodes.length, movedEdges: 0, supportedShare: 0, beforeM2, afterM2: beforeM2, moves: [] };
  if (!Array.isArray(nodes) || nodes.length < 3 || !walls.length) return { ...base, status: 'unverified', reason: 'no measured external walls or drawn outdoor outlines on this sheet' };
  // The outward side of each edge: left of the direction of travel on a negative-area outline.
  const outwardSign = signedArea(nodes) > 0 ? -1 : 1;
  const segments = walls.flatMap((wall) => { const ring = wall.closed ? [...wall.nodes, wall.nodes[0]] : wall.nodes; return ring.slice(1).map((end, index) => ({ wall, a: ring[index], b: end })); })
    .filter((segment) => Math.hypot(segment.b.x - segment.a.x, segment.b.y - segment.a.y) > 1);
  let perimeter = 0;
  let supported = 0;
  const lines = nodes.map((a, i) => {
    const b = nodes[(i + 1) % nodes.length];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    perimeter += length;
    if (length < 1e-6) return { p: a, u: { x: 1, y: 0 }, length, moved: false };
    const u = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
    const out = { x: -u.y * outwardSign, y: u.x * outwardSign };
    if (length < options.minEdgeMm) return { p: a, u, length, moved: false };
    let best = null;
    for (const segment of segments) {
      const wallLength = Math.hypot(segment.b.x - segment.a.x, segment.b.y - segment.a.y);
      const w = { x: (segment.b.x - segment.a.x) / wallLength, y: (segment.b.y - segment.a.y) / wallLength };
      if (Math.abs(dot(w, u)) < options.parallelCos) continue;
      const t0 = dot(sub(segment.a, a), u), t1 = dot(sub(segment.b, a), u);
      const overlap = Math.max(0, Math.min(length, Math.max(t0, t1)) - Math.max(0, Math.min(t0, t1)));
      if (overlap < Math.min(options.minOverlapMm, options.minOverlapShare * length)) continue;
      // The wall's outer face, measured along the edge's outward normal from the edge.
      const centre = dot(sub({ x: (segment.a.x + segment.b.x) / 2, y: (segment.a.y + segment.b.y) / 2 }, a), out);
      const shift = centre + (Number(segment.wall.thicknessMm) || 0) / 2;
      if (Math.abs(shift) > options.reachMm) continue;
      // The nearest support wins: a stretched reading can leave an edge closer to the wrong wall's
      // centre than to its own, but never past a nearer wall face along the same edge.
      if (!best || Math.abs(shift) < Math.abs(best.shift)) best = { overlap, shift, wallId: segment.wall.id, kind: segment.wall.kind || 'wall' };
    }
    if (!best) return { p: a, u, length, moved: false };
    supported += Math.min(length, best.overlap);
    return { p: { x: a.x + out.x * best.shift, y: a.y + out.y * best.shift }, u, length, moved: true, shift: best.shift, wallId: best.wallId, kind: best.kind };
  });
  const moves = lines.map((line, index) => (line.moved ? { edge: index, onto: line.kind, id: line.wallId, shiftMm: Math.round(line.shift) } : null)).filter(Boolean);
  const supportedShare = perimeter ? supported / perimeter : 0;
  if (!moves.length) return { ...base, supportedShare, status: 'unverified', reason: 'no edge runs along a measured external wall or drawn outdoor outline' };
  // Each corner is where its two (possibly moved) edge lines meet; a straight-through corner keeps
  // the moved end of the edge it starts.
  const next = nodes.map((node, i) => {
    const before = lines[(i - 1 + nodes.length) % nodes.length], after = lines[i];
    return meet(before.p, before.u, after.p, after.u) || (after.moved ? after.p : node);
  });
  const afterM2 = Math.abs(signedArea(next)) / 1e6;
  const result = { ...base, supportedShare, moves };
  if (selfCrossing(next)) return { ...result, status: 'rejected', reason: 'moving the edges onto the walls made the outline cross itself' };
  if (Math.abs(afterM2 - beforeM2) > options.maxAreaChangeShare * beforeM2) return { ...result, status: 'rejected', reason: `moving the edges onto the walls changed the area by ${Math.round(100 * Math.abs(afterM2 - beforeM2) / beforeM2)}%` };
  return { ...result, nodes: next, afterM2, movedEdges: moves.length, status: supportedShare >= options.minSupportedShare ? 'constrained' : 'partial' };
}
