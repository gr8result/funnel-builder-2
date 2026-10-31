// Room boundaries on wall faces: a room's floor runs to the faces of the walls around it.
//
// The linework engine finds a room as the space its walls enclose, traced at raster resolution, so
// each edge sits within a line-width of the wall face it follows. Once the walls themselves are
// measured exactly (fitted to the drawn face lines) each straight edge of a room is moved onto the
// face of the wall it runs along: the room's outline and area then come from the measured walls
// rather than from rendered pixels. An edge with no wall face along it (an open-plan transition, a
// closed doorway) stays where it is.
// Coordinates are logical plan pixels.

export const ROOM_FACE_DEFAULTS = {
  reachMm: 120,        // an edge this close to a wall face is on that face
  minOverlapShare: 0.3, // ... where the wall runs along this much of the edge
  axisTolerancePx: 0.75,
};

const shoelace = (polygon) => Math.abs(polygon.reduce((sum, p, i) => { const q = polygon[(i + 1) % polygon.length]; return sum + p.x * q.y - q.x * p.y; }, 0)) / 2;
const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
// Any two non-adjacent edges touching or crossing (the room check rejects such a boundary).
function crossesItself(polygon) {
  const n = polygon.length;
  for (let i = 0; i < n; i += 1) for (let j = i + 2; j < n; j += 1) {
    if (i === 0 && j === n - 1) continue;
    const a = polygon[i], b = polygon[(i + 1) % n], c = polygon[j], d = polygon[(j + 1) % n];
    if (cross(a, b, c) * cross(a, b, d) <= 0 && cross(c, d, a) * cross(c, d, b) <= 0
      && Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)) <= Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x))
      && Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y)) <= Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y))) return true;
  }
  return false;
}

/**
 * @param polygon room boundary (logical px)
 * @param walls measured walls ({ axis: 'h'|'v', nodes, measuredThicknessMm|thicknessMm })
 * @returns {{ polygon, movedEdges: number, edges: number, areaChangeM2: number }}
 */
export function snapRoomToWallFaces(polygon, walls, pixelsPerMm, overrides = {}) {
  const options = { ...ROOM_FACE_DEFAULTS, ...overrides };
  if (!Array.isArray(polygon) || polygon.length < 3 || !(pixelsPerMm > 0)) return { polygon, movedEdges: 0, edges: polygon?.length || 0, areaChangeM2: 0 };
  const faces = { h: [], v: [] };
  for (const wall of walls || []) {
    if (wall.axis !== 'h' && wall.axis !== 'v') continue;
    const [a, b] = wall.nodes;
    const horizontal = wall.axis === 'h';
    const c = horizontal ? (a.y + b.y) / 2 : (a.x + b.x) / 2;
    const half = (Number(wall.measuredThicknessMm) || Number(wall.thicknessMm) || 90) * pixelsPerMm / 2;
    const s0 = Math.min(horizontal ? a.x : a.y, horizontal ? b.x : b.y), s1 = Math.max(horizontal ? a.x : a.y, horizontal ? b.x : b.y);
    faces[wall.axis].push({ c: c - half, s0, s1 }, { c: c + half, s0, s1 });
  }
  const n = polygon.length;
  const targets = polygon.map((a, i) => {
    const b = polygon[(i + 1) % n];
    const axis = Math.abs(a.y - b.y) <= options.axisTolerancePx ? 'h' : Math.abs(a.x - b.x) <= options.axisTolerancePx ? 'v' : null;
    if (!axis) return null;
    const e = axis === 'h' ? (a.y + b.y) / 2 : (a.x + b.x) / 2;
    const e0 = Math.min(axis === 'h' ? a.x : a.y, axis === 'h' ? b.x : b.y), e1 = Math.max(axis === 'h' ? a.x : a.y, axis === 'h' ? b.x : b.y);
    if (e1 - e0 < 1) return null;
    let best = null;
    for (const face of faces[axis]) {
      const distance = Math.abs(face.c - e);
      if (distance > options.reachMm * pixelsPerMm) continue;
      const overlap = Math.min(e1, face.s1) - Math.max(e0, face.s0);
      if (overlap < (e1 - e0) * options.minOverlapShare) continue;
      if (!best || distance < best.distance) best = { axis, c: face.c, distance };
    }
    return best;
  });
  let moved = 0;
  for (const target of targets) if (target && target.distance > 1e-6) moved += 1;
  const snapped = polygon.map((point, i) => {
    const incoming = targets[(i + n - 1) % n], outgoing = targets[i];
    let { x, y } = point;
    for (const target of [incoming, outgoing]) {
      if (!target) continue;
      if (target.axis === 'h') y = target.c; else x = target.c;
    }
    return { x, y };
  });
  // A move that folds the outline (an edge driven across its neighbour, so it reverses or the outline
  // crosses itself) is not taken: the traced outline is kept.
  const before = shoelace(polygon), after = shoelace(snapped);
  const reversed = polygon.some((a, i) => {
    const b = polygon[(i + 1) % n], p = snapped[i], q = snapped[(i + 1) % n];
    return (b.x - a.x) * (q.x - p.x) + (b.y - a.y) * (q.y - p.y) <= 0;
  });
  if (!(after > 0) || Math.abs(after - before) > before * 0.25 || reversed || crossesItself(snapped)) return { polygon, movedEdges: 0, edges: n, areaChangeM2: 0, rejected: true };
  return { polygon: snapped, movedEdges: moved, edges: n, areaChangeM2: (after - before) / (pixelsPerMm * pixelsPerMm) / 1e6 };
}
