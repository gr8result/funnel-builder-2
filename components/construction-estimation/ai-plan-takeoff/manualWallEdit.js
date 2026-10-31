// Drawing a wall by hand: where each click lands, and what the drawn wall does to walls already there.
//
// A click snaps first to the walls already in the takeoff, so a drawn wall shares the corner or the
// junction it was drawn to: an existing wall's end, then a point on an existing wall's centreline
// (a T junction). Only then does it snap to the drawing's own linework.
// A drawn wall is a correction when it runs along a wall that is already there: that wall is
// replaced (its openings move to the drawn wall), never left beside it to be counted twice. A
// drawn wall that runs along only part of another is kept, and both are flagged for the
// estimator to trim, since which part is wrong is not known.
// Coordinates are logical plan pixels; walls are canvas wall runs ({ id, page, nodes, thicknessMm }).

export const MANUAL_WALL_DEFAULTS = {
  replaceShare: 0.6,   // a wall this much of whose length the drawn wall runs along is replaced
  overlapShare: 0.15,  // less than this is a wall the drawn wall merely meets
  angleTolerance: 0.17, // radians (~10 degrees) for "runs along"
  reachMm: 150,        // beyond half the thicker wall's thickness
};

const segmentsOf = (nodes = []) => nodes.slice(1).map((end, index) => [nodes[index], end]);
function project(point, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, lengthSq = dx * dx + dy * dy;
  const t = lengthSq ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq)) : 0;
  const x = a.x + t * dx, y = a.y + t * dy;
  return { x, y, t, distance: Math.hypot(point.x - x, point.y - y) };
}

/**
 * Where a click on the wall tool lands.
 * @returns {{x, y, snapped: boolean, kind: 'wall-end'|'wall-centreline'|'linework'|null, wallId?, nearestSegment?}}
 */
export function snapWallPoint(raw, { walls = [], page = 1, segments = [], radiusPx = 10 } = {}) {
  const own = walls.filter((wall) => Number(wall.page || 1) === Number(page) && Array.isArray(wall.nodes) && wall.nodes.length >= 2);
  let best = null;
  for (const wall of own) for (const node of [wall.nodes[0], wall.nodes[wall.nodes.length - 1]]) {
    const distance = Math.hypot(node.x - raw.x, node.y - raw.y);
    if (distance <= radiusPx && (!best || distance < best.distance)) best = { x: node.x, y: node.y, distance, kind: 'wall-end', wallId: wall.id };
  }
  if (best) return { x: best.x, y: best.y, snapped: true, kind: best.kind, wallId: best.wallId };
  for (const wall of own) for (const [a, b] of segmentsOf(wall.nodes)) {
    const hit = project(raw, a, b);
    if (hit.distance <= radiusPx && (!best || hit.distance < best.distance)) best = { x: hit.x, y: hit.y, distance: hit.distance, kind: 'wall-centreline', wallId: wall.id };
  }
  if (best) return { x: best.x, y: best.y, snapped: true, kind: best.kind, wallId: best.wallId };
  // The drawing's linework: a line's end (a corner on the drawing) before a point along a line.
  for (const seg of segments) for (const end of [{ x: seg.x1, y: seg.y1 }, { x: seg.x2, y: seg.y2 }]) {
    const distance = Math.hypot(end.x - raw.x, end.y - raw.y);
    if (distance <= radiusPx && (!best || distance < best.distance)) best = { ...end, distance, seg };
  }
  if (!best) for (const seg of segments) {
    const hit = project(raw, { x: seg.x1, y: seg.y1 }, { x: seg.x2, y: seg.y2 });
    if (hit.distance <= radiusPx && (!best || hit.distance < best.distance)) best = { x: hit.x, y: hit.y, distance: hit.distance, seg };
  }
  if (best) return { x: best.x, y: best.y, snapped: true, kind: 'linework', nearestSegment: best.seg };
  return { x: raw.x, y: raw.y, snapped: false, kind: null };
}

// Share of `wall`'s length that the drawn run lies along.
function shareAlong(wall, run, pixelsPerMm, options) {
  const reach = (Math.max(Number(wall.thicknessMm) || 90, Number(run.thicknessMm) || 90) / 2 + options.reachMm) * pixelsPerMm;
  const runSegments = segmentsOf(run.nodes);
  let total = 0, along = 0;
  for (const [a, b] of segmentsOf(wall.nodes)) {
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (!length) continue;
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const parts = Math.max(4, Math.ceil(length / (100 * pixelsPerMm)));
    for (let k = 0; k <= parts; k += 1) {
      const point = { x: a.x + (b.x - a.x) * k / parts, y: a.y + (b.y - a.y) * k / parts };
      total += 1;
      if (runSegments.some(([c, d]) => {
        const difference = Math.abs(Math.atan2(d.y - c.y, d.x - c.x) - angle) % Math.PI;
        return Math.min(difference, Math.PI - difference) <= options.angleTolerance && project(point, c, d).distance <= reach;
      })) along += 1;
    }
  }
  return total ? along / total : 0;
}

/**
 * The takeoff's walls after a drawn wall is added.
 * @returns {{ walls, run, replacedIds: string[], overlappingIds: string[] }}
 */
export function reconcileDrawnWall(run, walls = [], pixelsPerMm, overrides = {}) {
  const options = { ...MANUAL_WALL_DEFAULTS, ...overrides };
  const replacedIds = [], overlappingIds = [];
  if (!(pixelsPerMm > 0) || !Array.isArray(run?.nodes) || run.nodes.length < 2) return { walls: [...walls, run], run, replacedIds, overlappingIds };
  for (const wall of walls) {
    if (Number(wall.page || 1) !== Number(run.page || 1) || !Array.isArray(wall.nodes) || wall.nodes.length < 2) continue;
    const share = shareAlong(wall, run, pixelsPerMm, options);
    if (share >= options.replaceShare) replacedIds.push(wall.id);
    else if (share >= options.overlapShare) overlappingIds.push(wall.id);
  }
  const replaced = new Set(replacedIds.map(String));
  const overlapping = new Set(overlappingIds.map(String));
  const reviewReason = overlappingIds.length ? 'This drawn wall runs along part of another wall; trim or delete the part that is wrong so it is not counted twice.' : null;
  const placed = { ...run, source: 'manual', ...(replacedIds.length ? { replacesWallIds: replacedIds } : {}), ...(reviewReason ? { reviewRequired: true, reviewReason, overlapsWallIds: overlappingIds } : {}) };
  const next = walls.filter((wall) => !replaced.has(String(wall.id))).map((wall) => (overlapping.has(String(wall.id))
    ? { ...wall, reviewRequired: true, reviewReason: 'A drawn wall runs along part of this wall; trim or delete the part that is wrong so it is not counted twice.', overlapsWallIds: [...new Set([...(wall.overlapsWallIds || []), run.id])] }
    : wall));
  return { walls: [...next, placed], run: placed, replacedIds, overlappingIds };
}
