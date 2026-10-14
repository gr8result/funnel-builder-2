// Door swings in a vector PDF: a hinged door is drawn as a quarter circle whose centre is the hinge
// and whose radius is the leaf, usually with the open leaf as a straight line from the hinge. CAD
// exports draw the arc as a curve or as a chain of short chords; both arrive from extractPdfLinework
// as segments of one subpath. Each swing says where a doorway is: from the hinge to the arc's end that
// lies on the wall line (the other end is the open leaf's tip). That is drawing evidence for the gap
// it spans, the same kind of evidence a door the estimator placed gives.
// Coordinates are the segments' (logical plan pixels).

export const VECTOR_SWING_DEFAULTS = {
  minLeafMm: 500, maxLeafMm: 1450, // a hinged leaf is this wide (an entry door with its frame at the top end)
  spanDegrees: [78, 102],          // a quarter circle
  roundnessMm: 25,                 // every point of the arc this close to the circle
  leafReachMm: 40,                 // a straight leaf line starts this close to the hinge
};

function circleThrough(a, b, c) {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-9) return null;
  const sa = a.x * a.x + a.y * a.y, sb = b.x * b.x + b.y * b.y, sc = c.x * c.x + c.y * c.y;
  const x = (sa * (b.y - c.y) + sb * (c.y - a.y) + sc * (a.y - b.y)) / d;
  const y = (sa * (c.x - b.x) + sb * (a.x - c.x) + sc * (b.x - a.x)) / d;
  return { x, y, r: Math.hypot(a.x - x, a.y - y) };
}

/**
 * @returns {{ hinge, radiusMm, closedEnd, openEnd, centre, leafDrawn: boolean }[]} one per swing;
 *   `centre` is the doorway's middle (null when which arc end is the open leaf cannot be told).
 */
export function detectVectorDoorSwings(segments, pixelsPerMm, overrides = {}) {
  const options = { ...VECTOR_SWING_DEFAULTS, ...overrides };
  if (!segments?.length || !(pixelsPerMm > 0)) return [];
  const mm = (value) => value * pixelsPerMm;
  const groups = new Map();
  for (const segment of segments) {
    if (segment.subpath === undefined) continue;
    const key = `${segment.path}:${segment.subpath}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(segment);
  }
  const straight = segments.filter((segment) => !segment.curve);
  const swings = [];
  for (const group of groups.values()) {
    if (group.length < 3) continue;
    const points = [{ x: group[0].x1, y: group[0].y1 }, ...group.map((segment) => ({ x: segment.x2, y: segment.y2 }))];
    const first = points[0], last = points[points.length - 1];
    const circle = circleThrough(first, points[Math.floor(points.length / 2)], last);
    if (!circle || circle.r < mm(options.minLeafMm) || circle.r > mm(options.maxLeafMm)) continue;
    if (points.some((point) => Math.abs(Math.hypot(point.x - circle.x, point.y - circle.y) - circle.r) > mm(options.roundnessMm))) continue;
    let span = Math.abs(Math.atan2(last.y - circle.y, last.x - circle.x) - Math.atan2(first.y - circle.y, first.x - circle.x)) * 180 / Math.PI;
    if (span > 180) span = 360 - span;
    if (span < options.spanDegrees[0] || span > options.spanDegrees[1]) continue;
    const hinge = { x: circle.x, y: circle.y };
    // The open leaf: a straight line from the hinge to one end of the arc.
    const leafTo = [first, last].find((end) => straight.some((segment) => {
      const from = [{ x: segment.x1, y: segment.y1 }, { x: segment.x2, y: segment.y2 }];
      return from.some((p, i) => Math.hypot(p.x - hinge.x, p.y - hinge.y) <= mm(options.leafReachMm) && Math.hypot(from[1 - i].x - end.x, from[1 - i].y - end.y) <= mm(options.leafReachMm));
    }));
    const openEnd = leafTo || null;
    const closedEnd = leafTo ? (leafTo === first ? last : first) : null;
    swings.push({
      hinge, radiusMm: Math.round(circle.r / pixelsPerMm), openEnd, closedEnd, leafDrawn: Boolean(leafTo),
      centre: closedEnd ? { x: (hinge.x + closedEnd.x) / 2, y: (hinge.y + closedEnd.y) / 2 } : null,
    });
  }
  // The same swing drawn twice (a door symbol on two layers) is one door.
  return swings.filter((swing, index) => !swings.slice(0, index).some((other) => Math.hypot(other.hinge.x - swing.hinge.x, other.hinge.y - swing.hinge.y) <= mm(30) && Math.abs(other.radiusMm - swing.radiusMm) <= 30));
}

// Engine evidence: each swing confirms the doorway it spans. Without a drawn leaf the hinge itself
// (a jamb of that doorway) is the located point.
export function swingEvidence(swings) {
  return swings.map((swing, index) => ({ ...(swing.centre || swing.hinge), ref: `pdf-swing:${index}`, kind: 'door', widthMm: swing.radiusMm }));
}
