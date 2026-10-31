// Wall junctions: walls that meet share one point.
//
// Measured walls come out as separate strips: a wall stops where its own faces stop, which at an L or
// T junction is the other wall's face, not its centreline. Left like that, two walls that meet on the
// drawing do not meet in the takeoff: their centrelines stop half a thickness apart or run past each
// other, so lengths are wrong at every corner and nothing downstream can tell which walls connect.
// This stage gives every wall end that stops at another wall one exact meeting point, and records the
// junction (an id shared by every wall that meets there):
//   - L: two walls that both end at a corner meet where their centrelines cross (the centreline
//     method: a building's perimeter is the sum of its external walls, each corner counted once);
//   - T: a wall that ends against a wall running on past it goes to that wall's face, where it is
//     built to (a partition between two external walls measures face to face, as it is framed);
//     shortened if it ran past, lengthened if it stopped short;
//   - two ends of walls on one line that a sliver separates meet at its middle (a wall broken by
//     a junction line or lettering);
//   - an end with nothing within reach stays where it is and is reported as free.
// Gaps the width of an opening are never closed here. Coordinates are logical pixels.

export const JUNCTION_DEFAULTS = {
  reachMm: 220,          // an end this far beyond (or short of) a crossing wall's face meets it
  collinearSliverMm: 300, // walls on one line closer than this meet (shorter than any opening)
  collinearOffsetMm: 45, // ... when their centrelines are this close across
  pointMergePx: 0.5,     // junction points this close are one junction
};

const along = (wall, point) => (wall.axis === 'h' ? point.x : point.y);
const across = (wall, point) => (wall.axis === 'h' ? point.y : point.x);
const at = (wall, s, c) => (wall.axis === 'h' ? { x: s, y: c } : { x: c, y: s });

/**
 * @param walls measured walls ({ id, axis: 'h'|'v'|'d', nodes:[a,b], thicknessMm, measuredThicknessMm })
 * @returns {{ walls, junctions, report }} walls with ends moved onto junctions and `junctionIds`
 *   ([start, end], null where free); junctions as { id, x, y, wallIds, kind: 'L'|'T'|'X'|'line' }
 */
export function connectWallJunctions(walls, pixelsPerMm, overrides = {}) {
  const options = { ...JUNCTION_DEFAULTS, ...overrides };
  const mm = (value) => value * pixelsPerMm;
  const items = walls.map((wall) => {
    if (wall.axis !== 'h' && wall.axis !== 'v') return { wall, fixed: true };
    const [a, b] = wall.nodes;
    const forward = along(wall, a) <= along(wall, b);
    return { wall, c: (across(wall, a) + across(wall, b)) / 2, s: forward ? [along(wall, a), along(wall, b)] : [along(wall, b), along(wall, a)], forward,
      half: mm(wall.measuredThicknessMm || wall.thicknessMm || 90) / 2, ends: [null, null] };
  });
  // A piece lying wholly inside a crossing wall's thickness is the raster's view of that wall's
  // junction (the corner square seen from the other direction), not a wall: it is set aside.
  const nubs = new Set();
  for (const item of items) {
    if (item.fixed) continue;
    for (const other of items) {
      if (other === item || other.fixed || other.wall.axis === item.wall.axis) continue;
      const inside = item.s[0] >= other.c - other.half - mm(30) && item.s[1] <= other.c + other.half + mm(30);
      const within = item.c >= other.s[0] - mm(30) && item.c <= other.s[1] + mm(30);
      if (inside && within) { nubs.add(item); break; }
    }
  }
  const axial = items.filter((item) => !item.fixed && !nubs.has(item));
  // Each end against the nearest crossing wall. Positions are read from the original spans, so the
  // order walls are visited in does not change the result.
  const original = new Map(axial.map((item) => [item, [...item.s]]));
  for (const item of axial) {
    for (const index of [0, 1]) {
      const end = original.get(item)[index];
      let best = null;
      for (const other of axial) {
        if (other === item || other.wall.axis === item.wall.axis) continue;
        const [o0, o1] = original.get(other);
        // The end's centreline has to cross the other wall's extent (with the reach at its ends).
        if (item.c < o0 - other.half - mm(options.reachMm) || item.c > o1 + other.half + mm(options.reachMm)) continue;
        const distance = Math.abs(other.c - end);
        if (distance > other.half + mm(options.reachMm)) continue;
        // The wall must not cross through the other: the far side of this wall stays on its own side.
        const inward = index === 0 ? original.get(item)[1] - other.c : other.c - original.get(item)[0];
        if (inward < mm(100)) continue;
        if (!best || distance < best.distance) best = { other, distance };
      }
      // Both ends of one wall never meet the same crossing wall: the nearer end does.
      if (best && index === 1 && item.ends[0]?.other === best.other) {
        if (Math.abs(best.other.c - original.get(item)[0]) <= best.distance) continue;
        item.s[0] = original.get(item)[0]; item.ends[0] = null;
      }
      if (best) {
        // A T when the other wall carries on past this one on both sides; otherwise a corner.
        const [o0, o1] = original.get(best.other);
        const through = item.c - o0 > item.half + mm(50) && o1 - item.c > item.half + mm(50);
        const face = index === 0 ? best.other.c + best.other.half : best.other.c - best.other.half;
        item.s[index] = through ? face : best.other.c;
        item.ends[index] = { kind: 'cross', other: best.other, through };
      }
    }
  }
  // Collinear neighbours: ends a sliver apart meet in the middle.
  for (const item of axial) for (const other of axial) {
    if (other === item || other.wall.axis !== item.wall.axis || item.ends[1] || other.ends[0]) continue;
    if (Math.abs(other.c - item.c) > mm(options.collinearOffsetMm)) continue;
    const gap = other.s[0] - item.s[1];
    if (gap < -mm(50) || gap > mm(options.collinearSliverMm)) continue;
    const middle = (item.s[1] + other.s[0]) / 2;
    item.s[1] = middle; other.s[0] = middle;
    const c = (item.c + other.c) / 2; item.joinC1 = c; other.joinC0 = c;
    item.ends[1] = { kind: 'line', other }; other.ends[0] = { kind: 'line', other: item };
  }
  // Junction points and shared ids.
  const junctions = [];
  const junctionAt = (point, wallId) => {
    let found = junctions.find((item) => Math.hypot(item.x - point.x, item.y - point.y) <= options.pointMergePx);
    if (!found) { found = { id: `j-${junctions.length + 1}`, x: point.x, y: point.y, wallIds: [] }; junctions.push(found); }
    if (!found.wallIds.includes(wallId)) found.wallIds.push(wallId);
    return found.id;
  };
  const report = { ends: 0, joined: 0, free: 0, lengthened: 0, shortened: 0, maxMoveMm: 0, nubsSetAside: nubs.size };
  const out = items.filter((item) => !nubs.has(item)).map((item) => {
    if (item.fixed) return { ...item.wall, junctionIds: [null, null] };
    const [o0, o1] = original.get(item);
    const point = (index) => {
      const end = item.ends[index];
      if (!end) return at(item.wall, item.s[index], item.c);
      if (end.kind === 'line') return at(item.wall, item.s[index], index === 0 ? item.joinC0 : item.joinC1);
      return at(item.wall, item.s[index], item.c);
    };
    const nodes = [point(0), point(1)];
    const ids = [0, 1].map((index) => (item.ends[index] ? junctionAt(nodes[index], item.wall.id) : null));
    report.ends += 2;
    for (const index of [0, 1]) {
      if (!item.ends[index]) { report.free += 1; continue; }
      report.joined += 1;
      const before = index === 0 ? o0 : o1, after = along(item.wall, nodes[index]);
      const longer = index === 0 ? after < before : after > before;
      if (Math.abs(after - before) > 0.01) report[longer ? 'lengthened' : 'shortened'] += 1;
      report.maxMoveMm = Math.max(report.maxMoveMm, Math.round(Math.abs(after - before) / pixelsPerMm));
    }
    const ordered = item.forward ? nodes : [nodes[1], nodes[0]];
    const orderedIds = item.forward ? ids : [ids[1], ids[0]];
    return { ...item.wall, nodes: ordered, lengthMm: Math.hypot(ordered[1].x - ordered[0].x, ordered[1].y - ordered[0].y) / pixelsPerMm, junctionIds: orderedIds,
      connectedEnds: orderedIds.filter(Boolean).length };
  });
  // A crossing wall that other walls end against carries the junction too (a T's stem meets its top).
  const byId = new Map(out.map((wall) => [wall.id, wall]));
  for (const item of axial) for (const index of [0, 1]) {
    const end = item.ends[index];
    if (end?.kind !== 'cross') continue;
    const id = byId.get(item.wall.id).junctionIds[(item.forward ? index : 1 - index)];
    const junction = junctions.find((entry) => entry.id === id);
    if (junction && !junction.wallIds.includes(end.other.wall.id)) junction.wallIds.push(end.other.wall.id);
  }
  for (const junction of junctions) {
    const ending = junction.wallIds.filter((id) => byId.get(id)?.junctionIds?.includes(junction.id)).length;
    // Every wall ends here: an L (two walls at right angles), a line (one wall broken), or a cross of ends;
    // otherwise one wall runs through and the rest end against it: a T.
    junction.kind = ending === junction.wallIds.length
      ? (junction.wallIds.length === 2 ? (byId.get(junction.wallIds[0]).axis === byId.get(junction.wallIds[1]).axis ? 'line' : 'L') : 'X')
      : 'T';
  }
  return { walls: out, junctions, report, setAside: [...nubs].map((item) => ({ id: item.wall.id, reason: 'inside-crossing-wall' })) };
}
