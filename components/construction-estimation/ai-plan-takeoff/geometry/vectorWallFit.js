// Vector wall fit: on a vector PDF, a measured wall is moved onto the two drawn lines that are its faces.
//
// The raster stage finds walls from rendered pixels, so a face is only known to within the width of
// its anti-aliased line and the wall's thickness comes out a line-width or two too thick. A vector PDF
// states where every line is. For each axis-aligned wall this stage looks for two parallel drawn lines
// that run along most of the wall, one either side of where the raster put it, a wall's thickness
// apart; the wall's centreline becomes their midpoint and its thickness their separation. Free ends
// (an opening's jamb, a nib) move to where both face lines stop. A wall with no such pair keeps its
// raster position and says so.
// Coordinates are the sheet's logical pixels; segments are from extractPdfLinework in the same space.

export const VECTOR_FIT_DEFAULTS = {
  axisTolerance: 0.01,     // a segment is horizontal/vertical when its slope is under this
  lineMergePx: 0.3,        // drawn segments this close across are one line
  searchMm: 110,           // a face line is looked for this far beyond the raster face
  minWallMm: 60, maxWallMm: 360,
  minFaceCoverage: 0.3,    // each face line must run along this share of the wall (openings break faces)
  endReachMm: 150,         // a free end moves to where both faces stop, if that is this close
};

const STANDARD_THICKNESSES = [70, 90, 110, 150, 200, 230, 250, 270, 300, 350];
const nearest = (value, list) => list.reduce((best, item) => (Math.abs(item - value) < Math.abs(best - value) ? item : best));

// Axis-aligned drawn lines: segments grouped by their fixed coordinate, with their covered intervals.
export function indexAxisLines(segments, options = VECTOR_FIT_DEFAULTS) {
  const out = { h: [], v: [] };
  for (const s of segments || []) {
    if (s.curve) continue;
    const dx = s.x2 - s.x1, dy = s.y2 - s.y1, length = Math.hypot(dx, dy);
    if (length < 1) continue;
    if (Math.abs(dy) <= length * options.axisTolerance) out.h.push({ c: (s.y1 + s.y2) / 2, s0: Math.min(s.x1, s.x2), s1: Math.max(s.x1, s.x2) });
    else if (Math.abs(dx) <= length * options.axisTolerance) out.v.push({ c: (s.x1 + s.x2) / 2, s0: Math.min(s.y1, s.y2), s1: Math.max(s.y1, s.y2) });
  }
  const merge = (list) => {
    list.sort((a, b) => a.c - b.c);
    const lines = [];
    for (const item of list) {
      const line = lines.length && item.c - lines[lines.length - 1].cMax <= options.lineMergePx ? lines[lines.length - 1] : null;
      if (line) { line.items.push(item); line.cMax = item.c; } else lines.push({ cMax: item.c, items: [item] });
    }
    return lines.map((line) => {
      const total = line.items.reduce((sum, item) => sum + (item.s1 - item.s0), 0) || 1;
      const intervals = line.items.map((item) => [item.s0, item.s1]).sort((a, b) => a[0] - b[0]);
      const merged = [];
      for (const [a, b] of intervals) { const last = merged[merged.length - 1]; if (last && a <= last[1] + 0.75) last[1] = Math.max(last[1], b); else merged.push([a, b]); }
      return { c: line.items.reduce((sum, item) => sum + item.c * (item.s1 - item.s0), 0) / total, intervals: merged };
    });
  };
  return { h: merge(out.h), v: merge(out.v) };
}

const coverage = (line, s0, s1) => {
  if (s1 <= s0) return 0;
  let covered = 0;
  for (const [a, b] of line.intervals) covered += Math.max(0, Math.min(b, s1) - Math.max(a, s0));
  return covered / (s1 - s0);
};
// Where the drawn line stops nearest to `s` (an interval end), or null.
const stopNear = (line, s, reach) => {
  let best = null;
  for (const [a, b] of line.intervals) for (const end of [a, b]) if (Math.abs(end - s) <= reach && (best === null || Math.abs(end - s) < Math.abs(best - s))) best = end;
  return best;
};
const linesNear = (lines, low, high) => {
  // lines are sorted by c: binary search for the first at or above `low`
  let lo = 0, hi = lines.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (lines[mid].c < low) lo = mid + 1; else hi = mid; }
  const found = [];
  for (let i = lo; i < lines.length && lines[i].c <= high; i += 1) found.push(lines[i]);
  return found;
};

/**
 * @param walls engine walls ({ axis: 'h'|'v'|'d', nodes:[a,b], measuredThicknessMm, thicknessMm, ... })
 * @param segments extractPdfLinework output in the walls' coordinate space
 * @returns {{ walls, report }} walls with fitted position/thickness (`positionBasis`), and counts
 */
export function fitWallsToVectorLinework(walls, segments, pixelsPerMm, overrides = {}) {
  const options = { ...VECTOR_FIT_DEFAULTS, ...overrides };
  const report = { fitted: 0, unfitted: 0, endsFromFaces: 0, meanShiftMm: 0, thicknessChanged: 0 };
  if (!segments?.length || !(pixelsPerMm > 0)) return { walls, report: { ...report, skipped: 'no-vector-linework' } };
  const mm = (value) => value * pixelsPerMm;
  const index = indexAxisLines(segments, options);
  let shiftTotal = 0;
  const fitted = walls.map((wall) => {
    if (wall.axis !== 'h' && wall.axis !== 'v') return wall;
    const horizontal = wall.axis === 'h';
    const [a, b] = wall.nodes;
    const c = horizontal ? (a.y + b.y) / 2 : (a.x + b.x) / 2;
    const s0 = Math.min(horizontal ? a.x : a.y, horizontal ? b.x : b.y), s1 = Math.max(horizontal ? a.x : a.y, horizontal ? b.x : b.y);
    const half = mm(wall.measuredThicknessMm || wall.thicknessMm || 90) / 2;
    const reach = half + mm(options.searchMm);
    const candidates = linesNear(index[wall.axis], c - reach, c + reach).map((line) => ({ line, cover: coverage(line, s0, s1) })).filter((item) => item.cover >= options.minFaceCoverage);
    let best = null;
    for (let i = 0; i < candidates.length; i += 1) for (let j = i + 1; j < candidates.length; j += 1) {
      const low = candidates[i], high = candidates[j];
      const separation = high.line.c - low.line.c;
      if (separation < mm(options.minWallMm) || separation > mm(options.maxWallMm)) continue;
      const middle = (low.line.c + high.line.c) / 2;
      // The drawn wall lies within reach of where the raster put it (a raster wall read too thick can
      // sit wholly beside its drawn faces); nearer pairs score higher.
      if (Math.abs(middle - c) > reach) continue;
      const score = 2 * Math.min(low.cover, high.cover) + (low.cover + high.cover) / 2 - Math.abs(middle - c) / reach - 0.25 * Math.abs(separation - 2 * half) / (2 * half);
      if (!best || score > best.score) best = { low, high, middle, separation, score };
    }
    if (!best) { report.unfitted += 1; return { ...wall, positionBasis: 'raster' }; }
    report.fitted += 1;
    shiftTotal += Math.abs(best.middle - c) / pixelsPerMm;
    // Free ends: where both drawn faces stop, if they stop together near the raster end.
    const endReach = mm(options.endReachMm);
    const faceEnd = (s) => {
      const p = stopNear(best.low.line, s, endReach), q = stopNear(best.high.line, s, endReach);
      return p !== null && q !== null && Math.abs(p - q) <= mm(40) ? (p + q) / 2 : null;
    };
    const e0 = faceEnd(s0), e1 = faceEnd(s1);
    if (e0 !== null) report.endsFromFaces += 1;
    if (e1 !== null) report.endsFromFaces += 1;
    const n0 = e0 ?? s0, n1 = e1 ?? s1;
    const at = (s) => (horizontal ? { x: s, y: best.middle } : { x: best.middle, y: s });
    const thicknessMm = best.separation / pixelsPerMm;
    const standard = nearest(thicknessMm, STANDARD_THICKNESSES);
    if (standard !== wall.thicknessMm) report.thicknessChanged += 1;
    return {
      ...wall, nodes: [at(n0), at(n1)], lengthMm: Math.abs(n1 - n0) / pixelsPerMm,
      measuredThicknessMm: Math.round(thicknessMm), thicknessMm: standard,
      positionBasis: 'pdf-vector', faceCoverage: [+best.low.cover.toFixed(2), +best.high.cover.toFixed(2)],
      rasterThicknessMm: wall.measuredThicknessMm,
    };
  });
  report.meanShiftMm = report.fitted ? Math.round(shiftTotal / report.fitted) : 0;
  return { walls: fitted, report };
}
