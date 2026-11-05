// A glazed entrance is an assembly, not a thin masonry wall. Require the
// complete drawn surround, capped sidelights, paired swings and two returns
// physically terminating on measured perpendicular walls. Coordinates stay in
// the detector's rotated frame; no plan labels or reference positions are used.
export function measuredGlazedEntrances({ linesByDirection, straight, arcs, candidates, accepted, mmPx, options, wallPens }) {
  const results = [];
  const near = 3 * mmPx, hingeReach = 40 * mmPx;
  for (const [angle, lines] of linesByDirection) {
    const u = { x: Math.cos(angle), y: Math.sin(angle) }, n = { x: -u.y, y: u.x };
    const project = p => ({ s: p.x * u.x + p.y * u.y, c: p.x * n.x + p.y * n.y });
    const cross = straight.map(line => {
      const a = project({ x: line.x1, y: line.y1 }), b = project({ x: line.x2, y: line.y2 });
      return { line, s: (a.s + b.s) / 2, lo: Math.min(a.c, b.c), hi: Math.max(a.c, b.c), error: Math.abs(a.s - b.s) };
    }).filter(line => line.error <= near);
    const swings = arcs.filter(arc => arc.radius / mmPx >= options.leafMinMm
      && arc.radius / mmPx <= options.leafMaxMm && arc.sweepDeg >= 70 && arc.sweepDeg <= 110)
      .flatMap(arc => (arc.closedEnd ? [arc.closedEnd] : [arc.start, arc.end]).map(closed => ({
        arc, hinge: project(arc.centre), closed: project(closed),
        open: project(closed === arc.start ? arc.end : arc.start) })))
      .filter(a => Math.abs(a.closed.c - a.hinge.c) <= hingeReach);
    for (const back of lines) {
      if (!wallPens.has(back.style)) continue;
      // Sidelight glass/frame faces must be separate, closed rectangles on the
      // same continuous back line. A single stroke is insufficient evidence.
      const panes = lines.filter(face => face !== back && wallPens.has(face.style)
        && Math.abs(face.c - back.c) / mmPx >= options.frameThicknessMm[0]
        && Math.abs(face.c - back.c) / mmPx <= options.frameThicknessMm[1]
        && face.lo >= back.lo - near && face.hi <= back.hi + near
        && (face.hi - face.lo) / mmPx >= options.frameMinMm
        && (face.hi - face.lo) / mmPx <= options.frameMaxMm
        && [face.lo, face.hi].every(end => cross.some(cap => Math.abs(cap.s - end) <= near
          && cap.lo <= Math.min(face.c, back.c) + near && cap.hi >= Math.max(face.c, back.c) - near)));
      for (const left of panes) for (const right of panes) {
        if (right.lo <= left.hi || Math.abs(left.c - right.c) > near) continue;
        const width = right.lo - left.hi;
        const side = Math.sign(left.c - back.c);
        // The full surround reaches the OUTSIDE caps of both sidelights.
        const header = lines.find(line => side * (line.c - left.c) > near
          && Math.abs(line.c - back.c) <= options.maxThicknessMm * mmPx
          && Math.abs(line.lo - left.lo) <= near && Math.abs(line.hi - right.hi) <= near
          && [...line.paths].some(path => back.paths.has(path))
          && [left.lo, right.hi].every(end => cross.some(cap => Math.abs(cap.s - end) <= near
            && cap.lo <= Math.min(line.c, back.c) + near && cap.hi >= Math.max(line.c, back.c) - near)));
        if (!header) continue;
        const leaves = [left.hi, right.lo].map((end, index) => swings.filter(swing =>
          Math.abs(swing.hinge.s - end) <= hingeReach && Math.abs(swing.hinge.c - back.c) <= options.frameThicknessMm[1] * mmPx
          && (index === 0 ? swing.closed.s > end : swing.closed.s < end)
          && Math.abs(swing.arc.radius * 2 - width) <= 2 * hingeReach
          && cross.some(leaf => Math.abs(leaf.s - end) <= near
            && leaf.lo <= Math.min(header.c, swing.open.c) + hingeReach
            && leaf.hi >= Math.max(header.c, swing.open.c) - hingeReach)));
        if (leaves.some(group => group.length !== 1)
          || Math.hypot(leaves[0][0].closed.s - leaves[1][0].closed.s,
            leaves[0][0].closed.c - leaves[1][0].closed.c) > options.frameThicknessMm[1] * mmPx) continue;
        const returns = [left.lo, right.hi].map((end, index) => candidates.filter(wall =>
          wall.angle === angle && wall.faces.includes(back) && wall.occupied < .1
          && wall.thicknessMm >= options.minThicknessMm && wall.thicknessMm <= options.maxThicknessMm
          && wall.faces.every(face => wallPens.has(face.style))
          && Math.abs((index === 0 ? wall.hi : wall.lo) - end) <= near
          && wall.faces.some(face => face !== back && [...face.paths].some(path => back.paths.has(path)))
          && accepted.some(anchor => {
            if (Math.abs(Math.cos(anchor.angle - angle)) > .01) return false;
            const au = { x: Math.cos(anchor.angle), y: Math.sin(anchor.angle) }, an = { x: -au.y, y: au.x };
            const outer = wall.faces.find(face => face !== back);
            const s = index === 0 ? outer.lo : outer.hi;
            const point = { x: u.x * s + n.x * outer.c, y: u.y * s + n.y * outer.c };
            const along = point.x * au.x + point.y * au.y, across = point.x * an.x + point.y * an.y;
            return Math.min(Math.abs(across - anchor.c0), Math.abs(across - anchor.c1)) <= near
              && along >= anchor.lo - near && along <= anchor.hi + near;
          })));
        if (returns.some(group => group.length !== 1)) continue;
        const key = `${angle}|${back.c}|${left.lo}|${right.hi}`;
        if (results.some(result => result.key === key)) continue;
        results.push({ key, angle, c: (back.c + left.c) / 2, thicknessMm: Math.abs(back.c - left.c) / mmPx,
          returns: returns.map(group => group[0]), openings: [
            { lo: left.lo, hi: left.hi, kind: 'window' },
            { lo: left.hi, hi: right.lo, kind: 'door' },
            { lo: right.lo, hi: right.hi, kind: 'window' },
          ] });
      }
    }
  }
  return results;
}
