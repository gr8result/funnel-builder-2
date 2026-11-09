// Recognise complete dimension graphics on the ORIGINAL strokes, before collinear
// merging. A tick crossing a wall is not evidence that the wall is a dimension.
export function dimensionAnnotationStrokes(segments, textItems, pixelsPerMm) {
  const excluded = new Set();
  if (!(pixelsPerMm > 0)) return excluded;
  const paths = new Map();
  for (const segment of segments) {
    if (segment.path === undefined || segment.curve || segment.dashed) continue;
    if (!paths.has(segment.path)) paths.set(segment.path, []);
    paths.get(segment.path).push(segment);
  }
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const ends = (s) => [{ x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }];
  const tolerance = 6 * pixelsPerMm;
  const labels = (textItems || []).filter(t => /^\s*\d{3,6}\s*$/.test(String(t.text || '')));
  // A PDF paint operation may contain disconnected wall caps and dimensions.
  // Protect connected wall polylines, not unrelated subpaths in the same paint.
  for (const [path, strokes] of paths) for (const baseline of strokes) {
    if (strokes.filter(other => other.subpath === baseline.subpath).length !== 1) continue;
    if (strokes.some(other => other !== baseline && ends(other).some(a => ends(baseline).some(b => distance(a, b) <= tolerance)))) continue;
    const [a, b] = ends(baseline), length = distance(a, b);
    if (length < 1000 * pixelsPerMm) continue;
    const u = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
    const project = (p) => ({ s: (p.x - a.x) * u.x + (p.y - a.y) * u.y, c: -(p.x - a.x) * u.y + (p.y - a.y) * u.x });
    const markers = [];
    for (const [markerPath, members] of paths) {
      if (markerPath === path || members.length < 6 || members.length > 30) continue;
      if (members.some(s => distance(...ends(s)) > 1200 * pixelsPerMm)) continue;
      const found = [a, b].map((endpoint, index) => {
        for (const stub of members) {
          const ep = ends(stub), pp = ep.map(project);
          if (Math.abs(pp[0].c) > tolerance || Math.abs(pp[1].c) > tolerance || !ep.some(p => distance(p, endpoint) < tolerance)) continue;
          const centre = { x: (ep[0].x + ep[1].x) / 2, y: (ep[0].y + ep[1].y) / 2 };
          const at = project(centre);
          if (index === 0 ? at.s >= -tolerance : at.s <= length + tolerance) continue;
          const tick = members.find(s => {
            const e = ends(s), p = e.map(project);
            const ds = Math.abs(p[1].s - p[0].s), dc = Math.abs(p[1].c - p[0].c);
            return ds > 50 * pixelsPerMm && dc > 50 * pixelsPerMm && Math.abs(ds - dc) < Math.max(ds, dc) * .15
              && distance({ x: (e[0].x + e[1].x) / 2, y: (e[0].y + e[1].y) / 2 }, centre) < tolerance;
          });
          const witness = members.find(s => {
            const p = ends(s).map(project);
            return Math.abs(p[0].s - at.s) < tolerance && Math.abs(p[1].s - at.s) < tolerance
              && Math.min(p[0].c, p[1].c) < -tolerance && Math.max(p[0].c, p[1].c) > tolerance;
          });
          if (tick && witness) return at;
        }
        return null;
      });
      if (found.every(Boolean)) markers.push({ members, found });
    }
    for (const { members, found } of markers) {
      const measured = (found[1].s - found[0].s) / pixelsPerMm;
      const labelled = labels.some(label => {
        // PDF text anchor and text centre are both allowed (rotated glyph runs).
        const points = [{ x: label.x, y: label.y }, { x: label.x + (label.width || 0) / 2, y: label.y - (label.height || 0) / 2 }].map(project);
        return Math.abs(Number(label.text) - measured) <= Math.max(20, measured * .015)
          && points.some(p => Math.abs(p.c) <= 600 * pixelsPerMm && Math.abs(p.s - length / 2) <= 1500 * pixelsPerMm);
      });
      if (!labelled) continue;
      excluded.add(baseline);
      for (const stroke of members) excluded.add(stroke);
    }
  }
  // Short dimensions can have overlapping terminal stubs and no baseline.
  // Require two complete three-stroke terminal figures, plus their measured label.
  for (const strokes of paths.values()) {
    if (strokes.length !== 6 || strokes.some(s => distance(...ends(s)) > 1200 * pixelsPerMm)) continue;
    const centres = strokes.map(s => ({ x: (s.x1 + s.x2) / 2, y: (s.y1 + s.y2) / 2 }));
    const groups = [];
    for (let i = 0; i < strokes.length; i++) {
      let group = groups.find(g => distance(g.centre, centres[i]) <= tolerance);
      if (!group) { group = { centre: centres[i], strokes: [] }; groups.push(group); }
      group.strokes.push(strokes[i]);
    }
    if (groups.length !== 2 || groups.some(g => g.strokes.length !== 3)) continue;
    const [a, b] = groups.map(g => g.centre), length = distance(a, b);
    if (length <= tolerance) continue;
    const u = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
    const complete = groups.every(g => {
      const types = g.strokes.map(s => {
        const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
        const along = Math.abs(dx * u.x + dy * u.y), across = Math.abs(-dx * u.y + dy * u.x);
        if (along <= tolerance && across > 100 * pixelsPerMm) return 'witness';
        if (across <= tolerance && along > 100 * pixelsPerMm) return 'stub';
        if (Math.min(along, across) > 50 * pixelsPerMm && Math.abs(along - across) < Math.max(along, across) * .15) return 'tick';
        return null;
      });
      return new Set(types).size === 3 && !types.includes(null);
    });
    if (!complete) continue;
    const measured = length / pixelsPerMm;
    const labelled = (textItems || []).some(label => {
      if (!/^\s*\d{2,6}\s*$/.test(String(label.text || ''))) return false;
      const dx = label.x - (a.x + b.x) / 2, dy = label.y - (a.y + b.y) / 2;
      return Math.abs(Number(label.text) - measured) <= Math.max(20, measured * .015)
        && Math.abs(dx * u.x + dy * u.y) <= 1500 * pixelsPerMm
        && Math.abs(-dx * u.y + dy * u.x) <= 600 * pixelsPerMm;
    });
    if (labelled) for (const stroke of strokes) excluded.add(stroke);
  }
  return excluded;
}

// Wall thicknesses the drawing itself dimensions: consecutive ticks on one dimension chain whose spacing
// is printed as a wall thickness (e.g. "70" between two ticks). Returns intervals across the chain's
// direction in logical px: [{ axis: 'x'|'y', lo, hi, valueMm }]. A wall whose two faces sit on such an
// interval is one the draftsperson measured as a wall.
export function dimensionedThicknesses(segments, textItems, pixelsPerMm, { maxThicknessMm = 400, toleranceMm = 15 } = {}) {
  if (!(pixelsPerMm > 0)) return [];
  const ticks = [];
  for (const s of segments || []) {
    if (s.curve) continue;
    const dx = s.x2 - s.x1, dy = s.y2 - s.y1, length = Math.hypot(dx, dy);
    if (length < 2 || length > 16 || Math.abs(Math.abs(dx) - Math.abs(dy)) > 0.15 * length) continue; // ~45 degree tick
    ticks.push({ x: (s.x1 + s.x2) / 2, y: (s.y1 + s.y2) / 2 });
  }
  const labels = (textItems || []).filter((t) => /^\s*\d{2,3}\s*$/.test(String(t.text || '')) && Number(t.text) <= maxThicknessMm && Number.isFinite(t.x) && Number.isFinite(t.y));
  const intervals = [];
  for (const axis of ['x', 'y']) {
    // A chain measuring along y has its ticks on one x (and the reverse).
    const across = axis === 'y' ? 'x' : 'y';
    const lines = new Map();
    for (const tick of ticks) {
      const key = Math.round(tick[across]);
      const line = [...lines.keys()].find((k) => Math.abs(k - tick[across]) <= 1);
      lines.set(line ?? key, [...(lines.get(line ?? key) || []), tick]);
    }
    for (const [at, members] of lines) {
      const positions = [...new Set(members.map((tick) => Math.round(tick[axis] * 100) / 100))].sort((p, q) => p - q);
      for (let i = 1; i < positions.length; i += 1) {
        const lo = positions[i - 1], hi = positions[i], valueMm = (hi - lo) / pixelsPerMm;
        if (valueMm > maxThicknessMm || valueMm < 20) continue;
        const label = labels.find((t) => Math.abs(Number(t.text) - valueMm) <= toleranceMm
          && Math.abs(t[across] - at) <= 800 * pixelsPerMm && Math.abs(t[axis] - (lo + hi) / 2) <= 600 * pixelsPerMm);
        if (label) intervals.push({ axis, lo, hi, valueMm: Number(label.text) });
      }
    }
  }
  return intervals;
}
