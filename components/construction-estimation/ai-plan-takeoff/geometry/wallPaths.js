// Wall paths: the measured wall segments joined into the walls an architect drew.
//
// The linework stage measures wall fabric piece by piece: a wall is broken wherever a door, a
// window, a junction or a piece of lettering interrupts its faces. A plan reader sees one wall
// running from corner to corner with openings in it. This stage rebuilds that view from the
// measurements, without inventing fabric:
//   1. pieces on one line (same direction, same centreline, same thickness) are one wall;
//   2. two pieces of one wall are joined across a gap only where an opening is found in that gap
//      (a door or window is part of its wall), or where the gap is a sliver a junction leaves;
//   3. each end of a wall is taken to the centreline of the wall it meets (L and T junctions);
//   4. a short piece that joins nothing is set aside (lettering, a symbol, a fixture), not deleted.
// Where a plan reading traced the walls (whole-plan visual interpretation), each traced wall is
// matched to the measured path it follows: a path the reading confirms is the reading's wall at
// the drawing's measured position; a traced wall with no linework under it stays the reading's
// alone and is marked so.
// Coordinates are the sheet's logical pixels; `pixelsPerMm` is the sheet's scale.

export const WALL_PATH_DEFAULTS = {
  lineToleranceMm: 70,      // two pieces whose centrelines are this close are on one line
  thicknessToleranceMm: 60, // and this close in thickness are one wall
  sliverMm: 250,            // a gap this short between pieces of one wall is a junction or lettering
  openingFitShare: 0.5,     // an opening explains a gap it covers this much of
  junctionReachMm: 200,     // an end this far short of (or past) a crossing wall's face meets it
  isolatedMaxMm: 600,       // a piece this short joining nothing is set aside
  readingReachMm: 350,      // a traced wall this close to a path, and parallel to it, is that wall
};

const along = (axis, point) => (axis === 'h' ? point.x : point.y);
const across = (axis, point) => (axis === 'h' ? point.y : point.x);
const at = (axis, s, c) => (axis === 'h' ? { x: s, y: c } : { x: c, y: s });

export function buildWallPaths({ walls = [], openings = [], pixelsPerMm, reading = [] }, overrides = {}) {
  const options = { ...WALL_PATH_DEFAULTS, ...overrides };
  const mm = (value) => value * pixelsPerMm;
  const pieces = walls.filter((wall) => (wall.axis === 'h' || wall.axis === 'v') && wall.nodes?.length === 2).map((wall) => {
    const [a, b] = wall.nodes;
    return { wall, axis: wall.axis, c: (across(wall.axis, a) + across(wall.axis, b)) / 2, s0: Math.min(along(wall.axis, a), along(wall.axis, b)), s1: Math.max(along(wall.axis, a), along(wall.axis, b)), t: Number(wall.thicknessMm) || 90 };
  });
  const placed = openings.filter((opening) => opening.confirmed && Number.isFinite(opening.x) && Number.isFinite(opening.y));
  const paths = [];
  for (const axis of ['h', 'v']) {
    const own = pieces.filter((piece) => piece.axis === axis).sort((p, q) => p.c - q.c || p.s0 - q.s0);
    // 1. Lines: pieces on one centreline with one thickness.
    const lines = [];
    for (const piece of own) {
      const line = lines.find((item) => Math.abs(item.c - piece.c) <= mm(options.lineToleranceMm) && Math.abs(item.t - piece.t) <= options.thicknessToleranceMm);
      if (line) { line.pieces.push(piece); const total = line.pieces.reduce((sum, item) => sum + (item.s1 - item.s0), 0) || 1; line.c = line.pieces.reduce((sum, item) => sum + item.c * (item.s1 - item.s0), 0) / total; }
      else lines.push({ c: piece.c, t: piece.t, pieces: [piece] });
    }
    // 2. Walls along each line: pieces joined across slivers and across the openings found in a gap.
    for (const line of lines) {
      line.pieces.sort((p, q) => p.s0 - q.s0);
      let current = null;
      const close = () => { if (current) paths.push(current); current = null; };
      for (const piece of line.pieces) {
        if (current) {
          const gap = piece.s0 - current.s1;
          const inGap = gap > 0 ? placed.filter((opening) => (opening.axis ? opening.axis === axis : true) && Math.abs(across(axis, opening) - line.c) <= mm(Math.max(line.t, 120)) && along(axis, opening) >= current.s1 - mm(100) && along(axis, opening) <= piece.s0 + mm(100)) : [];
          const covered = inGap.reduce((sum, opening) => sum + mm(Number(opening.widthMm) || 0), 0);
          if (gap <= mm(options.sliverMm) || (inGap.length && covered >= gap * options.openingFitShare)) {
            current.s1 = Math.max(current.s1, piece.s1); current.pieces.push(piece);
            for (const opening of inGap) if (!current.openings.includes(opening)) current.openings.push(opening);
            continue;
          }
          close();
        }
        current = { axis, c: line.c, s0: piece.s0, s1: piece.s1, thicknessMm: line.t, pieces: [piece], openings: [] };
      }
      close();
    }
  }
  // 3. Junctions: each end goes to the centreline of the crossing wall it stops at.
  for (const path of paths) {
    path.joints = [null, null];
    for (const [index, end] of [[0, path.s0], [1, path.s1]]) {
      let best = null;
      for (const other of paths) {
        if (other === path || other.axis === path.axis) continue;
        if (path.c < other.s0 - mm(other.thicknessMm / 2 + options.junctionReachMm) || path.c > other.s1 + mm(other.thicknessMm / 2 + options.junctionReachMm)) continue;
        const distance = Math.abs(other.c - end);
        if (distance <= mm(other.thicknessMm / 2 + options.junctionReachMm) && (!best || distance < best.distance)) best = { other, distance };
      }
      if (best) { path.joints[index] = best.other; if (index === 0) path.s0 = Math.min(path.s0, best.other.c); else path.s1 = Math.max(path.s1, best.other.c); }
    }
  }
  // 4. Short pieces joining nothing.
  const result = paths.map((path, index) => {
    const lengthMm = (path.s1 - path.s0) / pixelsPerMm;
    const joined = path.joints.filter(Boolean).length;
    const byLength = {};
    for (const piece of path.pieces) byLength[piece.wall.category || 'interior'] = (byLength[piece.wall.category || 'interior'] || 0) + (piece.s1 - piece.s0);
    const category = Object.entries(byLength).sort((a, b) => b[1] - a[1])[0][0];
    return {
      id: `wp-${path.axis}-${index}`, axis: path.axis, category, thicknessMm: Math.round(path.thicknessMm),
      nodes: [at(path.axis, path.s0, path.c), at(path.axis, path.s1, path.c)], lengthMm: Math.round(lengthMm),
      pieceIds: path.pieces.map((piece) => piece.wall.id), openings: path.openings.map((opening) => ({ x: opening.x, y: opening.y, widthMm: opening.widthMm, kind: opening.kind, basis: opening.basis })),
      junctions: joined, isolated: joined === 0 && lengthMm < options.isolatedMaxMm,
      reviewRequired: path.pieces.some((piece) => piece.wall.reviewRequired),
    };
  });
  // Angled walls are carried through as they were measured.
  for (const wall of walls.filter((item) => item.axis === 'd')) result.push({ id: `wp-d-${wall.id}`, axis: 'd', category: wall.category, thicknessMm: Math.round(wall.thicknessMm || 90), nodes: wall.nodes, lengthMm: Math.round(wall.lengthMm), pieceIds: [wall.id], openings: [], junctions: wall.connectedEnds || 0, isolated: false, reviewRequired: Boolean(wall.reviewRequired) });
  // The plan reading's traced walls, matched to the measured paths they follow.
  const traced = [];
  for (const wall of reading) {
    const nodes = wall.nodes || [];
    for (let i = 0; i + 1 < nodes.length; i += 1) {
      const a = nodes[i], b = nodes[i + 1];
      const horizontal = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
      const axis = horizontal ? 'h' : 'v';
      const c = (across(axis, a) + across(axis, b)) / 2, s0 = Math.min(along(axis, a), along(axis, b)), s1 = Math.max(along(axis, a), along(axis, b));
      let support = 0;
      const matched = [];
      for (const path of result) {
        if (path.axis !== axis || path.isolated) continue;
        const pc = across(axis, path.nodes[0]);
        if (Math.abs(pc - c) > mm(options.readingReachMm)) continue;
        const overlap = Math.min(s1, along(axis, path.nodes[1])) - Math.max(s0, along(axis, path.nodes[0]));
        if (overlap > 0) { support += overlap; matched.push(path); path.confirmedByReading = true; }
      }
      traced.push({ detectionId: wall.detectionId, category: wall.category || null, nodes: [a, b], supportedShare: s1 > s0 ? Math.min(1, support / (s1 - s0)) : 0, matchedPaths: matched.map((path) => path.id) });
    }
  }
  return { paths: result, traced };
}
