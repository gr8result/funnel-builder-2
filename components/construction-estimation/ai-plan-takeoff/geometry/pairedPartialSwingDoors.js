// Partially opened paired leaves need their complete assembly as evidence.
// They do not relax the detector's single quarter-circle door rule.
export function pairedPartialSwingDoors({ arcs, straight, accepted, openings, mmPx, options }) {
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const ends = s => [{ x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }];
  const dot = (p, u) => p.x * u.x + p.y * u.y;
  const subtract = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  const reach = 40 * mmPx, exact = 3 * mmPx;
  const leaves = arcs.filter(a => a.sweepDeg > 0 && a.sweepDeg < 60
    && a.radius / mmPx >= options.leafMinMm && a.radius / mmPx <= options.leafMaxMm).flatMap(arc => {
    const matches = [];
    for (const stroke of straight) for (const [hinge, tip] of [ends(stroke), ends(stroke).reverse()]) {
      if (distance(hinge, arc.centre) > reach) continue;
      for (const [open, closed] of [[arc.start, arc.end], [arc.end, arc.start]]) {
        if (distance(tip, open) <= reach && Math.abs(distance(hinge, tip) - arc.radius) <= reach)
          matches.push({ arc, hinge, tip, closed });
      }
    }
    return matches.length === 1 ? matches : [];
  });
  const supportedCap = (leaf, u, outward) => {
    for (const cap of straight) {
      const points = ends(cap), width = distance(...points);
      if (width / mmPx < options.minThicknessMm || width / mmPx > options.maxThicknessMm
        || Math.abs(dot(subtract(points[1], points[0]), u)) > exact
        || !points.some(p => distance(p, leaf.hinge) <= exact)) continue;
      for (const point of points) for (const stroke of straight) {
        if (stroke.path === undefined) continue;
        const [a, b] = ends(stroke).sort((a, b) => distance(a, point) - distance(b, point));
        const delta = subtract(b, a), along = dot(delta, u);
        if (distance(a, point) > exact || along * outward <= 0
          || Math.hypot(delta.x - along * u.x, delta.y - along * u.y) > exact) continue;
        const anchor = accepted.find(wall => Math.abs(Math.cos(wall.angle) * u.x + Math.sin(wall.angle) * u.y) < .01
          && Math.abs(wall.thicknessMm - width / mmPx) <= options.thicknessToleranceMm
          && b.x * Math.cos(wall.angle) + b.y * Math.sin(wall.angle) >= wall.lo - wall.thicknessMm * mmPx - exact
          && b.x * Math.cos(wall.angle) + b.y * Math.sin(wall.angle) <= wall.hi + wall.thicknessMm * mmPx + exact
          && (wall.sourceFaces || wall.faces).some(face => face.pieces.some(piece => piece.path === stroke.path
            && ends(piece.segment).some(p => distance(p, b) <= exact))));
        if (anchor) return { centre: { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 }, width };
      }
    }
    return null;
  };
  const result = [];
  for (let i = 0; i < leaves.length; i++) for (let j = i + 1; j < leaves.length; j++) {
    const a = leaves[i], b = leaves[j], span = distance(a.hinge, b.hinge);
    if (!span || Math.abs(a.arc.sweepDeg - b.arc.sweepDeg) > options.directionBinDeg
      || distance(a.closed, b.closed) > reach
      || Math.abs(distance(a.hinge, a.tip) + distance(b.hinge, b.tip) - span) > reach) continue;
    const u = { x: (b.hinge.x - a.hinge.x) / span, y: (b.hinge.y - a.hinge.y) / span };
    const off = p => { const q = subtract(p, a.hinge); return q.x * -u.y + q.y * u.x; };
    if (Math.abs(off(a.closed)) > reach || Math.abs(off(b.closed)) > reach || off(a.tip) * off(b.tip) <= 0
      || dot(subtract(a.closed, a.hinge), u) <= 0 || dot(subtract(b.closed, b.hinge), u) >= 0) continue;
    const first = supportedCap(a, u, -1), last = supportedCap(b, u, 1);
    if (!first || !last || Math.abs(first.width - last.width) > options.thicknessToleranceMm * mmPx
      || Math.abs(off(first.centre) - off(last.centre)) > exact) continue;
    const centre = { x: (first.centre.x + last.centre.x) / 2, y: (first.centre.y + last.centre.y) / 2 };
    const widthMm = Math.round(span / mmPx);
    if ([...openings, ...result].some(o => distance(o, centre) <= reach && Math.abs(o.widthMm - widthMm) <= 80)) continue;
    result.push({ ...centre, direction: u, widthMm, leafCount: 2, kind: 'door', confirmed: true,
      hostThicknessMm: Math.round((first.width + last.width) / (2 * mmPx)),
      evidence: 'paired partial swings: two radial leaves, meeting closed tips, measured jamb caps and path-connected wall returns' });
  }
  return result;
}
