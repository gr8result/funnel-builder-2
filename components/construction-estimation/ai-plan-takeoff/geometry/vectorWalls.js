// Vector-first wall detection: walls read from a vector PDF's own drawn lines.
//
// A wall on a plan is two long parallel face lines a wall-thickness apart with nothing drawn between
// them, joined at its ends to other walls. Much else on a plan is also parallel lines - joinery, robe
// doors, window frames, downpipes, beams, columns, fixtures, dimension chains, lettering - so a pair of
// lines is only a candidate. Each drawing is learnt first: the thicknesses its walls are drawn at and
// the pens they are drawn with are read from its own long, empty, unambiguous pairs. A candidate then
// has to fit those, be empty inside, not be a narrow detail lying alongside a longer wall (a frame,
// sill or cladding line), be visible on the rendered page, and either be long or meet other walls.
// Anything that fails is rejected with its reason, never quietly kept.
//
// Openings are read from the gaps in a wall line: the swing of a hinged door, a cavity slider's
// pocket in the wall beside the gap, a barn door hung across the face, panel or glass lines across the
// gap (sliders, stackers, windows), a wide external gap (garage door). A window drawn as a frame along
// a continuous wall is read from the frame. Every opening is tied to the wall it is in.
//
// Coordinates are the page's logical pixels (viewport scale 1); sizes are millimetres through
// pixelsPerMm. Pure: segments (and optionally the rendered raster) in, walls and openings out.

export const VECTOR_WALL_DEFAULTS = {
  minThicknessMm: 60, maxThicknessMm: 400, // no framed or masonry wall is drawn thinner (beams and frames often are)
  minFaceRunMm: 150,          // drawn lines shorter than this are lettering, ticks and symbol detail
  mergeGapMm: 12,             // pieces of one drawn line this close along it are one line
  collinearMm: 3,             // ... and this close across it
  directionBinDeg: 0.5,
  minDirectionShare: 0.01,    // a direction carrying less than this share of the long linework holds no walls
  minOverlapMm: 200,          // both faces must run together at least this far
  stairLabelReachMm: 1600,    // repeated treads are detail only when a nearby PDF label identifies stairs
  occupiedShare: 0.35,        // a pair with another line running between its faces along this much of it is not one wall
  modeShare: 0.04,            // a thickness carrying this share of the clean pairs' length is one the drawing uses
  cleanLongWallMm: 1500,      // a clean pair this long is a wall whatever its thickness
  thicknessToleranceMm: 12, thicknessToleranceShare: 0.08,
  strongWallMm: 1200,         // clean pairs this long teach the drawing's wall pens and thicknesses
  minIsolatedWallMm: 900,     // a wall that meets no other wall must be at least this long
  meetReachMm: 150,           // an end this far beyond the face of another wall meets it
  besideReachMm: 250,         // a pair this close alongside a longer wall ...
  besideShare: 0.8,           // ... over this much of its length is that wall's frame, sill, lining or cladding
  besideLengthRatio: 1.1,     // ... when the wall is at least this much longer
  lightPenLuminance: 0.6,     // pens lighter than this (greys) draw background: roofs, hatching, landings, not walls
  inkShare: 0.6,              // both faces must show on the rendered page along this much of their length
  inkThreshold: 600,          // r + g + b below this is ink
  continueGapMm: 450,         // a wall interrupted by a crossing wall continues across a gap this wide
  openingMinMm: 400, openingMaxMm: 6200,
  swingReachMm: 200,          // a door swing's hinge lies this close to the end of the gap it closes
  frameMinMm: 400, frameMaxMm: 4000, frameThicknessMm: [25, 80],
  windowLabelReachMm: 1500,
  cornerReturnMaxMm: 300,     // a window may stop this short of the corner wall (the wall's short return)  // a window's size code is printed within this of it
  projectedBoxMinMm: 60, projectedBoxMaxMm: 450, projectedBoxEndMm: 40, // a window box out from the wall: how far past the face, cap tolerance
  projectedFrameMaxThicknessMm: 180, projectedFrameReachMm: 100, frameCapToleranceMm: 20,
  frameJoinMm: 150,           // frame pieces along one wall this close are one window (split at a mullion)
  garageMinMm: 2700,
  buildingShare: 0.25,        // a cluster of walls joined to nothing else must have this share of the main building's wall length          // a wide gap with a single door line is a garage door from this width
  leafMinMm: 500, leafMaxMm: 1250, // a hinged door leaf (the swing's radius)
  swingWallReachMm: 150,      // a swing's hinge lies within half the wall's thickness plus this of the wall centreline
};

const deg = Math.PI / 180;
const len = (s) => Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
const median = (values) => { if (!values.length) return null; const v = [...values].sort((a, b) => a - b); return v[v.length >> 1]; };
const styleOf = (s) => `${s.paint}|${(Math.round((s.widthPx || 0) * 100) / 100).toFixed(2)}|${s.color || '#000000'}`;

// Dominant drawing directions (radians in [0, pi)), from the length of long lines in each half-degree.
function dominantDirections(segments, mmPx, options) {
  const bins = new Map();
  let total = 0;
  for (const s of segments) {
    const length = len(s);
    if (length < options.minFaceRunMm * mmPx) continue;
    let angle = Math.atan2(s.y2 - s.y1, s.x2 - s.x1); if (angle < 0) angle += Math.PI; if (angle >= Math.PI) angle -= Math.PI;
    const bin = Math.round(angle / (options.directionBinDeg * deg)) % Math.round(180 / options.directionBinDeg);
    bins.set(bin, (bins.get(bin) || 0) + length); total += length;
  }
  const peaks = [...bins].filter(([bin, value]) => value >= total * options.minDirectionShare
    && value >= (bins.get(bin - 1) || 0) && value >= (bins.get(bin + 1) || 0)).map(([bin]) => bin * options.directionBinDeg * deg);
  return peaks.sort((a, b) => a - b);
}

// Lines of one direction, in a frame turned to it: s along, c across. Collinear pieces merged.
function directionLines(segments, angle, mmPx, options) {
  const u = { x: Math.cos(angle), y: Math.sin(angle) }, n = { x: -u.y, y: u.x };
  const tolerance = options.directionBinDeg * deg;
  const pieces = [];
  for (const s of segments) {
    let a = Math.atan2(s.y2 - s.y1, s.x2 - s.x1); if (a < 0) a += Math.PI; if (a >= Math.PI) a -= Math.PI;
    const off = Math.min(Math.abs(a - angle), Math.PI - Math.abs(a - angle));
    if (off > tolerance) continue;
    const s1 = s.x1 * u.x + s.y1 * u.y, s2 = s.x2 * u.x + s.y2 * u.y;
    const c = ((s.x1 + s.x2) / 2) * n.x + ((s.y1 + s.y2) / 2) * n.y;
    pieces.push({ c, lo: Math.min(s1, s2), hi: Math.max(s1, s2), style: styleOf(s), width: s.widthPx || 0 });
  }
  pieces.sort((p, q) => p.c - q.c || p.lo - q.lo);
  // Group by c, then merge intervals.
  const lines = [];
  let group = [];
  const flush = () => {
    if (!group.length) return;
    group.sort((p, q) => p.lo - q.lo);
    let current = null;
    for (const piece of group) {
      if (current && piece.lo <= current.hi + options.mergeGapMm * mmPx) {
        current.hi = Math.max(current.hi, piece.hi); current.cSum += piece.c * (piece.hi - piece.lo); current.weight += piece.hi - piece.lo;
        current.styles.set(piece.style, (current.styles.get(piece.style) || 0) + piece.hi - piece.lo);
      } else {
        if (current) lines.push(current);
        current = { lo: piece.lo, hi: piece.hi, cSum: piece.c * (piece.hi - piece.lo), weight: piece.hi - piece.lo, styles: new Map([[piece.style, piece.hi - piece.lo]]) };
      }
    }
    if (current) lines.push(current);
    group = [];
  };
  for (const piece of pieces) {
    if (group.length && piece.c - group[0].c > options.collinearMm * mmPx) flush();
    group.push(piece);
  }
  flush();
  return lines.map((line) => ({ c: line.weight ? line.cSum / line.weight : 0, lo: line.lo, hi: line.hi,
    style: [...line.styles].sort((p, q) => q[1] - p[1])[0][0] }))
    .filter((line) => line.hi - line.lo >= options.minFaceRunMm * mmPx).sort((p, q) => p.c - q.c);
}

// Share of [lo, hi] along which another line of this direction runs strictly between c0 and c1 for (nearly)
// the whole length: the inner faces of a multi-leaf wall, or joinery. Shorter inner lines (a window's
// frame and glass, a cavity slider's pocket) do not disqualify a wall: they are read as its openings.
function occupancy(lines, c0, c1, lo, hi, margin) {
  const covered = [];
  for (const line of lines) {
    if (line.c <= c0 + margin || line.c >= c1 - margin) continue;
    if (Math.min(hi, line.hi) - Math.max(lo, line.lo) < 0.9 * (hi - lo)) continue;
    const a = Math.max(lo, line.lo), b = Math.min(hi, line.hi);
    if (b > a) covered.push([a, b]);
  }
  covered.sort((p, q) => p[0] - q[0]);
  let total = 0, end = lo;
  for (const [a, b] of covered) { if (b <= end) continue; total += b - Math.max(a, end); end = b; }
  return hi > lo ? total / (hi - lo) : 0;
}

function thicknessModes(candidates, options) {
  const hist = new Map();
  let total = 0;
  for (const candidate of candidates) {
    const bin = Math.round(candidate.thicknessMm / 5) * 5;
    hist.set(bin, (hist.get(bin) || 0) + candidate.lengthMm); total += candidate.lengthMm;
  }
  const smoothed = new Map([...hist.keys()].map((bin) => [bin, (hist.get(bin - 5) || 0) * 0.5 + hist.get(bin) + (hist.get(bin + 5) || 0) * 0.5]));
  return [...smoothed].filter(([bin, value]) => value >= total * options.modeShare && value >= (smoothed.get(bin - 5) || 0) && value >= (smoothed.get(bin + 5) || 0))
    .map(([bin]) => {
      // Refine to the length-weighted mean of the pairs near this bin.
      const near = candidates.filter((candidate) => Math.abs(candidate.thicknessMm - bin) <= 7.5);
      const weight = near.reduce((sum, candidate) => sum + candidate.lengthMm, 0);
      return weight ? near.reduce((sum, candidate) => sum + candidate.thicknessMm * candidate.lengthMm, 0) / weight : bin;
    }).sort((a, b) => a - b).filter((value, index, list) => index === 0 || value - list[index - 1] > 3);
}

function repeatedDetailGroups(lines, angle, mmPx, options, textItems = []) {
  const groups = [];
  // A stair is labelled by name or by its run direction (UP / DN / DOWN beside the run arrow).
  const stairLabels = textItems.filter(item => /\b(stairs?|stair\s+void|steps?\s+down|up|dn|down)\b/i.test(String(item.text || ''))
    && Number.isFinite(item.x) && Number.isFinite(item.y));
  const u = { x: Math.cos(angle), y: Math.sin(angle) };
  const n = { x: -u.y, y: u.x };
  for (let index = 0; index < lines.length; index += 1) {
    const first = lines[index];
    const extentTolerance = 25 * mmPx;
    const family = lines.slice(index).filter(line => line.style === first.style
      && Math.abs(line.lo - first.lo) <= extentTolerance && Math.abs(line.hi - first.hi) <= extentTolerance);
    if (family.length < 4) continue;
    const pitchMm = (family[1].c - first.c) / mmPx;
    if (pitchMm < options.minThicknessMm || pitchMm > options.maxThicknessMm) continue;
    const repeated = [first];
    const pitches = [];
    for (let nextIndex = 1; nextIndex < family.length; nextIndex += 1) {
      const pitch = (family[nextIndex].c - family[nextIndex - 1].c) / mmPx;
      if (Math.abs(pitch - pitchMm) > Math.max(10, pitchMm * .08)) break;
      repeated.push(family[nextIndex]);
      pitches.push(pitch);
    }
    if (repeated.length < 4) continue;
    const spanStart = Math.min(...repeated.map(line => line.lo));
    const spanEnd = Math.max(...repeated.map(line => line.hi));
    const centreS = (spanStart + spanEnd) / 2;
    const centreC = repeated.reduce((sum, line) => sum + line.c, 0) / repeated.length;
    const nearStairLabel = stairLabels.some((label) => {
      const x = label.x + Math.max(0, Number(label.width) || 0) / 2;
      const y = label.y - Math.max(0, Number(label.height) || 0) / 2;
      const along = x * u.x + y * u.y;
      const across = x * n.x + y * n.y;
      return Math.hypot(along - centreS, across - centreC) <= options.stairLabelReachMm * mmPx;
    });
    if (nearStairLabel) groups.push({
      lines: new Set(repeated),
      indexByLine: new Map(repeated.map((line, lineIndex) => [line, lineIndex])),
      pitchMm: median(pitches),
    });
  }
  return groups;
}

function rasterInk(raster, logicalWidth) {
  if (!raster?.data || !(logicalWidth > 0)) return null;
  const k = raster.width / logicalWidth;
  return (x, y, threshold) => {
    const px = Math.round(x * k), py = Math.round(y * k);
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
      const qx = px + dx, qy = py + dy;
      if (qx < 0 || qy < 0 || qx >= raster.width || qy >= raster.height) continue;
      const i = (qy * raster.width + qx) * 4;
      if (raster.data[i] + raster.data[i + 1] + raster.data[i + 2] < threshold) return true;
    }
    return false;
  };
}

/**
 * @param segments  extractPdfLinework output (logical px)
 * @param context   { pixelsPerMm, logicalWidth, logicalHeight, raster? } raster = rendered page RGBA ({width,height,data}) at any scale.
 *                  Linework outside the page (a cropped-off title block or border, which pdf.js still reports) is ignored.
 * @returns {{ walls, openings, rejected, stats }} walls: [{ id, nodes:[a,b], axis, angle, measuredThicknessMm, faces:{style}, lengthMm }]
 *   openings: [{ id, x, y, axis, direction, widthMm, hostThicknessMm, hostWallIds, kind, confirmed, evidence }]
 */
export function detectVectorWalls(segments, context, overrides = {}) {
  const options = { ...VECTOR_WALL_DEFAULTS, ...overrides };
  const mmPx = context.pixelsPerMm;
  if (!(mmPx > 0)) throw new Error('The sheet scale (pixelsPerMm) is needed to read walls.');
  const W = context.logicalWidth, H = context.logicalHeight;
  const onPage = (s) => !(W > 0 && H > 0) || [[s.x1, s.y1], [s.x2, s.y2]].every(([x, y]) => x >= -1 && y >= -1 && x <= W + 1 && y <= H + 1);
  const straight = (segments || []).filter((s) => !s.curve && !s.dashed && len(s) >= mmPx && onPage(s));
  // Door swings: drawn as curves, or (from many CAD programs) as a run of short straight chords.
  const curves = (segments || []).filter((s) => !s.dashed && onPage(s) && (s.curve || len(s) <= 250 * mmPx));
  const ink = rasterInk(context.raster, context.logicalWidth);
  const directions = dominantDirections(straight, mmPx, options);
  const rejected = [];
  const all = [];
  const linesByDirection = new Map();

  // ---- Candidates: parallel pairs a plausible thickness apart -----------------------------------------
  for (const angle of directions) {
    const lines = directionLines(straight, angle, mmPx, options);
    const repeatedDetails = repeatedDetailGroups(lines, angle, mmPx, options, context.textItems);
    linesByDirection.set(angle, lines);
    for (let i = 0; i < lines.length; i += 1) {
      for (let j = i + 1; j < lines.length; j += 1) {
        const sep = (lines[j].c - lines[i].c) / mmPx;
        if (sep < options.minThicknessMm) continue;
        if (sep > options.maxThicknessMm) break;
        const repeatedTreadPair = repeatedDetails.some((group) => {
          const firstIndex = group.indexByLine.get(lines[i]);
          const secondIndex = group.indexByLine.get(lines[j]);
          return firstIndex !== undefined && secondIndex === firstIndex + 1
            && Math.abs(sep - group.pitchMm) <= Math.max(5, group.pitchMm * 0.03);
        });
        if (repeatedTreadPair) continue;
        const lo = Math.max(lines[i].lo, lines[j].lo), hi = Math.min(lines[i].hi, lines[j].hi);
        if ((hi - lo) / mmPx < options.minOverlapMm) continue;
        all.push({ angle, c: (lines[i].c + lines[j].c) / 2, c0: lines[i].c, c1: lines[j].c, lo, hi, thicknessMm: sep, lengthMm: (hi - lo) / mmPx,
          faces: [lines[i], lines[j]], occupied: occupancy(lines, lines[i].c, lines[j].c, lo, hi, 0.5 * mmPx) });
      }
    }
  }

  // ---- Learn the drawing: thicknesses and pens of its long, clean, connected pairs -------------------------
  // Walls meet other walls; beams, frames, landings and stripes mostly do not. Only long clean pairs with an
  // end meeting another long clean pair (a corner or a T) teach the drawing's wall thicknesses and pens.
  const luminance = (style) => { const hex = style.split('|')[2] || '#000000'; const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  const longClean = all.filter((candidate) => candidate.occupied < 0.1 && candidate.lengthMm >= options.strongWallMm && candidate.faces.every((face) => luminance(face.style) <= options.lightPenLuminance));
  const endsOf = (candidate) => { const u = { x: Math.cos(candidate.angle), y: Math.sin(candidate.angle) }, n = { x: -u.y, y: u.x }; return [candidate.lo, candidate.hi].map((sv) => ({ x: u.x * sv + n.x * candidate.c, y: u.y * sv + n.y * candidate.c })); };
  // At a corner each wall stops at the other's inner face, so the reach runs round the corner too.
  const nearBody = (p, other, own) => { const u = { x: Math.cos(other.angle), y: Math.sin(other.angle) }, n = { x: -u.y, y: u.x }; const sv = p.x * u.x + p.y * u.y, cv = p.x * n.x + p.y * n.y; const along = (own.thicknessMm / 2 + options.meetReachMm) * mmPx; return sv >= other.lo - along && sv <= other.hi + along && Math.abs(cv - other.c) <= (other.thicknessMm / 2 + options.meetReachMm) * mmPx; };
  const connectedClean = longClean.filter((candidate) => endsOf(candidate).some((p) => longClean.some((other) => other !== candidate && other.angle !== candidate.angle && nearBody(p, other, candidate))));
  // ... and only those in the building's main cluster (a table box or title block is connected too).
  const clean = (() => {
    const list = connectedClean, parent = list.map((_, index) => index);
    const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    for (let i = 0; i < list.length; i += 1) for (let j = i + 1; j < list.length; j += 1) {
      if (list[i].angle === list[j].angle) { if (Math.abs(list[i].c - list[j].c) <= 10 * mmPx && Math.max(list[i].lo, list[j].lo) - Math.min(list[i].hi, list[j].hi) <= options.openingMaxMm * mmPx) parent[find(i)] = find(j); continue; }
      if (endsOf(list[i]).some((p) => nearBody(p, list[j], list[i])) || endsOf(list[j]).some((p) => nearBody(p, list[i], list[j]))) parent[find(i)] = find(j);
    }
    const totals = new Map(); list.forEach((item, index) => totals.set(find(index), (totals.get(find(index)) || 0) + item.lengthMm));
    const main = Math.max(0, ...totals.values());
    return list.filter((_, index) => totals.get(find(index)) >= main * options.buildingShare);
  })();
  const modes = thicknessModes(clean, options);
  const fits = (t) => modes.some((mode) => Math.abs(t - mode) <= Math.max(options.thicknessToleranceMm, mode * options.thicknessToleranceShare));
  const penWeight = new Map();
  for (const candidate of clean.filter((item) => fits(item.thicknessMm))) for (const face of candidate.faces) penWeight.set(face.style, (penWeight.get(face.style) || 0) + candidate.lengthMm);
  const penTotal = [...penWeight.values()].reduce((sum, value) => sum + value, 0);
  const wallPens = new Set([...penWeight].filter(([style, value]) => value >= penTotal * 0.1 && luminance(style) <= options.lightPenLuminance).map(([style]) => style));

  const reject = (candidate, reason) => { candidate.rejected = reason; rejected.push({ reason, thicknessMm: Math.round(candidate.thicknessMm), lengthMm: Math.round(candidate.lengthMm), ...endpoints(candidate) }); };
  function endpoints(candidate) {
    const u = { x: Math.cos(candidate.angle), y: Math.sin(candidate.angle) }, n = { x: -u.y, y: u.x };
    const at = (s) => ({ x: u.x * s + n.x * candidate.c, y: u.y * s + n.y * candidate.c });
    return { a: at(candidate.lo), b: at(candidate.hi) };
  }

  // ---- Screening ---------------------------------------------------------------------------------
  let pool = [];
  for (const candidate of all) {
    if (!fits(candidate.thicknessMm) && !(candidate.occupied < 0.1 && candidate.lengthMm >= options.cleanLongWallMm)) { reject(candidate, 'thickness not one the drawing uses for walls'); continue; }
    if (candidate.occupied > options.occupiedShare) { reject(candidate, 'another line runs between the faces (joinery, a frame, or the outer faces of a multi-leaf wall)'); continue; }
    if (wallPens.size && !candidate.faces.every((face) => wallPens.has(face.style))) { reject(candidate, 'faces not drawn with the drawing\'s wall pens'); continue; }
    pool.push(candidate);
  }
  // A face line can be one face of one wall only: where two pairs share a face, the nearer, cleaner,
  // longer pair is the wall.
  pool.sort((p, q) => (p.occupied - q.occupied) || (q.lengthMm - p.lengthMm));
  const claimed = new Map();
  const claimKey = (angle, face) => `${angle}|${face.c.toFixed(3)}|${face.lo.toFixed(2)}`;
  const kept = [];
  for (const candidate of pool) {
    const overlapsClaim = candidate.faces.some((face) => (claimed.get(claimKey(candidate.angle, face)) || []).some(([lo, hi]) => Math.min(hi, candidate.hi) - Math.max(lo, candidate.lo) > 0.5 * (candidate.hi - candidate.lo)));
    if (overlapsClaim) { reject(candidate, 'a face already belongs to a better wall'); continue; }
    for (const face of candidate.faces) { const key = claimKey(candidate.angle, face); claimed.set(key, [...(claimed.get(key) || []), [candidate.lo, candidate.hi]]); }
    kept.push(candidate);
  }
  pool = kept;
  // A shorter pair lying alongside a longer wall is that wall's frame, sill, lining or cladding.
  pool.sort((p, q) => q.lengthMm - p.lengthMm);
  const keptBeside = [];
  for (const candidate of pool) {
    const host = keptBeside.find((wall) => wall.angle === candidate.angle && wall.lengthMm > candidate.lengthMm * options.besideLengthRatio
      && Math.abs(wall.c - candidate.c) <= (wall.thicknessMm + candidate.thicknessMm) / 2 * mmPx + options.besideReachMm * mmPx
      && Math.abs(wall.c - candidate.c) >= (wall.thicknessMm + candidate.thicknessMm) / 2 * mmPx - 2 * mmPx
      && (Math.min(wall.hi, candidate.hi) - Math.max(wall.lo, candidate.lo)) >= options.besideShare * (candidate.hi - candidate.lo));
    if (host) { candidate.besideOf = host; reject(candidate, 'lies alongside a longer wall (frame, sill, lining or cladding)'); continue; }
    keptBeside.push(candidate);
  }
  pool = keptBeside;
  // Visible on the page: both faces inked along most of the wall.
  if (ink) {
    pool = pool.filter((candidate) => {
      const u = { x: Math.cos(candidate.angle), y: Math.sin(candidate.angle) }, n = { x: -u.y, y: u.x };
      let hits = 0, samples = 0;
      for (let k = 1; k < 12; k += 1) {
        const s = candidate.lo + (candidate.hi - candidate.lo) * k / 12;
        for (const c of [candidate.c0, candidate.c1]) { samples += 1; if (ink(u.x * s + n.x * c, u.y * s + n.y * c, options.inkThreshold)) hits += 1; }
      }
      if (hits / samples < options.inkShare) { reject(candidate, 'not visible on the rendered page (hidden or white linework)'); return false; }
      return true;
    });
  }

  // ---- Continuity: a wall interrupted only by a crossing wall continues -----------------------------------
  const sameLine = (p, q) => p.angle === q.angle && Math.abs(p.c - q.c) <= 10 * mmPx && Math.abs(p.thicknessMm - q.thicknessMm) <= 15;
  const crossingIn = (candidate, lo, hi) => pool.some((other) => other.angle !== candidate.angle && (() => {
    const u = { x: Math.cos(candidate.angle), y: Math.sin(candidate.angle) };
    const n = { x: -u.y, y: u.x };
    const ends = endpoints(other);
    const c0 = ends.a.x * n.x + ends.a.y * n.y, c1 = ends.b.x * n.x + ends.b.y * n.y;
    if (Math.abs(c1 - c0) < 1e-9) return false;
    const t = (candidate.c - c0) / (c1 - c0);
    // A T may stop at the other wall's face. Its finite run must still reach
    // this centreline; projection along the gap alone admits distant walls.
    const reach = (candidate.thicknessMm / 2 + 20) * mmPx;
    if (candidate.c < Math.min(c0, c1) - reach || candidate.c > Math.max(c0, c1) + reach) return false;
    const s0 = ends.a.x * u.x + ends.a.y * u.y, s1 = ends.b.x * u.x + ends.b.y * u.y;
    const intersection = s0 + t * (s1 - s0);
    return intersection >= lo - 20 * mmPx && intersection <= hi + 20 * mmPx;
  })());
  const sharedFaceContinues = (current, next) => current.faces.some((face) =>
    face.lo <= current.hi && face.hi >= next.lo
    && next.faces.some((other) => Math.abs(face.c - other.c) <= options.collinearMm * mmPx
      && other.lo <= current.hi && other.hi >= next.lo));
  const crossingProjectsIn = (candidate, lo, hi) => pool.some((other) => other.angle !== candidate.angle && (() => {
    const direction = { x: Math.cos(candidate.angle), y: Math.sin(candidate.angle) };
    const ends = endpoints(other);
    const start = ends.a.x * direction.x + ends.a.y * direction.y;
    const end = ends.b.x * direction.x + ends.b.y * direction.y;
    return [start, end].some((position) => position >= lo - 20 * mmPx && position <= hi + 20 * mmPx)
      || (Math.min(start, end) <= lo && Math.max(start, end) >= hi);
  })());
  const byLine = [];
  for (const candidate of pool.sort((p, q) => p.angle - q.angle || p.c - q.c || p.lo - q.lo)) {
    const line = byLine.find((group) => sameLine(group[0], candidate));
    if (line) line.push(candidate); else byLine.push([candidate]);
  }
  const walls = [];
  const openingsFromGaps = [];
  for (const group of byLine) {
    group.sort((p, q) => p.lo - q.lo);
    let current = { ...group[0] };
    const flushWall = () => walls.push(current);
    for (let k = 1; k < group.length; k += 1) {
      const next = group[k];
      const gapMm = (next.lo - current.hi) / mmPx;
      if (gapMm <= 0 || (gapMm <= options.continueGapMm && (crossingIn(current, current.hi, next.lo)
        || (crossingProjectsIn(current, current.hi, next.lo) && sharedFaceContinues(current, next))))) {
        current = { ...current, hi: Math.max(current.hi, next.hi), lengthMm: (Math.max(current.hi, next.hi) - current.lo) / mmPx };
        continue;
      }
      if (gapMm >= options.openingMinMm && gapMm <= options.openingMaxMm) openingsFromGaps.push({ host: [current, next], lo: current.hi, hi: next.lo, c: (current.c + next.c) / 2, angle: current.angle, thicknessMm: (current.thicknessMm + next.thicknessMm) / 2 });
      flushWall(); current = { ...next };
    }
    flushWall();
  }

  // ---- Isolation: a short wall that meets no other wall is a symbol, not a wall ---------------------------
  const meets = (wall, other) => {
    if (wall === other) return false;
    const e = endpoints(wall), o = endpoints(other);
    const reach = (other.thicknessMm / 2 + options.meetReachMm) * mmPx;
    const distanceTo = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy; const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0; return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy); };
    return [e.a, e.b].some((p) => distanceTo(p, o.a, o.b) <= reach) || [o.a, o.b].some((p) => distanceTo(p, e.a, e.b) <= (wall.thicknessMm / 2 + options.meetReachMm) * mmPx);
  };
  let accepted = walls;
  for (let pass = 0; pass < 4; pass += 1) {
    const next = accepted.filter((wall) => wall.lengthMm >= options.minIsolatedWallMm || accepted.some((other) => meets(wall, other)));
    for (const wall of accepted) if (!next.includes(wall)) reject(wall, 'short and meets no other wall (column, downpipe, fixture or symbol)');
    if (next.length === accepted.length) break;
    accepted = next;
  }

  // ---- Building: walls belong to the building they join. A separate cluster of "walls" (a table or
  // title box, an alfresco beam on its posts, a landing) is kept only if it is big enough to be a
  // building of its own (a detached garage or studio).
  {
    const parent = accepted.map((_, index) => index);
    const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    // Joined at a corner or T, or on one line across a doorway-width gap.
    const acrossGap = (p, q) => p.angle === q.angle && Math.abs(p.c - q.c) <= 10 * mmPx && Math.max(p.lo, q.lo) - Math.min(p.hi, q.hi) <= options.openingMaxMm * mmPx;
    for (let i = 0; i < accepted.length; i += 1) for (let j = i + 1; j < accepted.length; j += 1) if (meets(accepted[i], accepted[j]) || acrossGap(accepted[i], accepted[j])) parent[find(i)] = find(j);
    const totals = new Map();
    accepted.forEach((wall, index) => totals.set(find(index), (totals.get(find(index)) || 0) + wall.lengthMm));
    const main = Math.max(0, ...totals.values());
    const keep = accepted.filter((wall, index) => totals.get(find(index)) >= main * options.buildingShare);
    for (const wall of accepted) if (!keep.includes(wall)) reject(wall, 'not joined to the building (a table or title box, beam, landing or other symbol)');
    accepted = keep;
  }

  // ---- Openings in the gaps of a wall line ----------------------------------------------------------------
  const openings = [];
  const toXY = (angle, s, c) => { const u = { x: Math.cos(angle), y: Math.sin(angle) }, n = { x: -u.y, y: u.x }; return { x: u.x * s + n.x * c, y: u.y * s + n.y * c }; };
  const arcs = groupArcs(curves);
  // A quarter-circle alone has two possible doorway directions. The straight
  // leaf drawn from the hinge identifies the OPEN tip; the other tip is the
  // closed doorway direction. Choosing whichever tip is nearest a wall can
  // attach the door to a perpendicular partition at a junction.
  for (const arc of arcs) {
    const tips = [arc.start, arc.end];
    const leafTips = tips.filter(tip => straight.some(line => {
      const ends = [{ x: line.x1, y: line.y1 }, { x: line.x2, y: line.y2 }];
      if (!ends.some((a, i) => Math.hypot(a.x - arc.centre.x, a.y - arc.centre.y) <= 40 * mmPx
        && Math.hypot(ends[1 - i].x - tip.x, ends[1 - i].y - tip.y) <= 40 * mmPx)) return false;
      // A jamb/closed-position stroke can lie exactly on a measured wall face;
      // that is not independent evidence identifying the open door leaf.
      const wallFace = accepted.some(wall => {
        const u = { x: Math.cos(wall.angle), y: Math.sin(wall.angle) }, n = { x: -u.y, y: u.x };
        const projected = ends.map(p => ({ s: p.x * u.x + p.y * u.y, c: p.x * n.x + p.y * n.y }));
        return Math.abs(projected[0].c - projected[1].c) <= 3 * mmPx
          && projected.every(p => p.s >= wall.lo - 40 * mmPx && p.s <= wall.hi + 40 * mmPx
            && Math.min(Math.abs(p.c - wall.c0), Math.abs(p.c - wall.c1)) <= 15 * mmPx);
      });
      return !wallFace;
    }));
    if (leafTips.length === 1) arc.closedEnd = tips.find(tip => tip !== leafTips[0]);
  }
  const arcRunsAlong = (arc, angle) => !arc.closedEnd || Math.abs(
    -(arc.closedEnd.x - arc.centre.x) * Math.sin(angle)
    + (arc.closedEnd.y - arc.centre.y) * Math.cos(angle)) <= arc.radius * Math.sin(2 * deg);
  const allLines = linesByDirection;
  // A window drawn as a box projecting from the wall: its end caps run right across the wall and out
  // past one face, and an outer line joins them. Garage, barn and sliding doors do not cap the wall.
  // Caps between the ends are mullions between separate windows. Returns the box or null.
  const projectedWindowBox = (gap, half, lines) => {
    const u = { x: Math.cos(gap.angle), y: Math.sin(gap.angle) }, n = { x: -u.y, y: u.x };
    const near = options.projectedBoxEndMm * mmPx;
    const caps = straight.filter((segment) => Math.abs(segment.x1 * u.x + segment.y1 * u.y - (segment.x2 * u.x + segment.y2 * u.y)) <= 2 * mmPx)
      .map((segment) => { const c1 = segment.x1 * n.x + segment.y1 * n.y, c2 = segment.x2 * n.x + segment.y2 * n.y;
        return { s: ((segment.x1 + segment.x2) / 2) * u.x + ((segment.y1 + segment.y2) / 2) * u.y, lo: Math.min(c1, c2), hi: Math.max(c1, c2) }; })
      .filter((cap) => cap.s >= gap.lo - near && cap.s <= gap.hi + near);
    for (const side of [-1, 1]) {
      const wallFace = gap.c - side * half, outerFace = gap.c + side * half;
      const crossing = caps.filter((cap) => {
        const reachIn = side > 0 ? cap.lo <= wallFace + 5 * mmPx : cap.hi >= wallFace - 5 * mmPx;
        const beyond = side > 0 ? cap.hi - outerFace : outerFace - cap.lo;
        return reachIn && beyond >= options.projectedBoxMinMm * mmPx && beyond <= options.projectedBoxMaxMm * mmPx;
      });
      // At a corner the box may stop short of the perpendicular wall by the short return of the wall.
      const slackLo = gap.cornerAt === 'lo' ? options.cornerReturnMaxMm * mmPx : 0, slackHi = gap.cornerAt === 'hi' ? options.cornerReturnMaxMm * mmPx : 0;
      const atLo = crossing.filter((cap) => cap.s >= gap.lo - near && cap.s <= gap.lo + near + slackLo).sort((a, b) => a.s - b.s)[0];
      const atHi = crossing.filter((cap) => cap.s <= gap.hi + near && cap.s >= gap.hi - near - slackHi).sort((a, b) => b.s - a.s)[0];
      if (!atLo || !atHi) continue;
      const depth = Math.min(side > 0 ? atLo.hi : -atLo.lo, side > 0 ? atHi.hi : -atHi.lo) * side;
      const outer = lines.some((line) => side * (line.c - outerFace) >= options.projectedBoxMinMm * mmPx && Math.abs(line.c - depth) <= 20 * mmPx
        && line.lo <= atLo.s + near && line.hi >= atHi.s - near && (line.hi - line.lo) <= (atHi.s - atLo.s) + 2 * near);
      if (!outer) continue;
      const mullions = [...new Set(crossing.filter((cap) => cap.s > atLo.s + near && cap.s < atHi.s - near).map((cap) => Math.round(cap.s / mmPx)))].map((value) => value * mmPx).sort((a, b) => a - b);
      return { side, c0: Math.min(outerFace, depth), c1: Math.max(outerFace, depth), lo: Math.min(gap.lo, atLo.s), hi: Math.max(gap.hi, atHi.s), windowLo: atLo.s, windowHi: atHi.s, mullions };
    }
    return null;
  };
  const windowBoxes = [];
  // A wall that stops short of a perpendicular wall it runs into: the space between can be a window or
  // door at the end of the wall, beside a corner whose short return is too short to read as a wall of its
  // own. It is offered as a gap with its one measured host and kept only with strong drawn evidence (a
  // door swing or a capped window box), never for a single line carried across.
  for (const wall of accepted) {
    const u = { x: Math.cos(wall.angle), y: Math.sin(wall.angle) }, n = { x: -u.y, y: u.x };
    for (const direction of [-1, 1]) {
      const at = direction > 0 ? wall.hi : wall.lo;
      let best = null;
      for (const other of accepted) {
        if (Math.abs(Math.cos(other.angle - wall.angle)) > 0.05) continue;
        const e = endpoints(other);
        const sAt = ((e.a.x + e.b.x) / 2) * u.x + ((e.a.y + e.b.y) / 2) * u.y;
        const c0 = e.a.x * n.x + e.a.y * n.y, c1 = e.b.x * n.x + e.b.y * n.y, reach = other.thicknessMm / 2 * mmPx;
        // At an L or T the other wall stops at one of this wall's faces.
        const span = (wall.thicknessMm / 2 + 30) * mmPx;
        if (wall.c < Math.min(c0, c1) - span || wall.c > Math.max(c0, c1) + span) continue;
        const face = sAt - direction * reach, gapPx = direction * (face - at);
        if (gapPx < options.openingMinMm * mmPx || gapPx > options.openingMaxMm * mmPx) continue;
        if (!best || gapPx < best.gapPx) best = { face, gapPx };
      }
      // The wall carries on along the same line before the corner wall: an ordinary gap, not a corner.
      if (best && accepted.some((other) => other !== wall && sameLine(other, wall)
        && (direction > 0 ? other.lo >= at - 1e-6 && other.lo <= best.face : other.hi <= at + 1e-6 && other.hi >= best.face))) best = null;
      if (best) openingsFromGaps.push({ host: [wall], lo: Math.min(at, best.face), hi: Math.max(at, best.face), c: wall.c, angle: wall.angle, thicknessMm: wall.thicknessMm, atCorner: true, cornerAt: direction > 0 ? 'hi' : 'lo' });
    }
  }
  for (const gap of openingsFromGaps) {
    if (!gap.host.every((wall) => accepted.some((item) => item.angle === wall.angle && Math.abs(item.c - wall.c) < 1e-6 && item.lo <= wall.lo + 1e-6 && item.hi >= wall.hi - 1e-6))) continue;
    const widthMm = (gap.hi - gap.lo) / mmPx, half = gap.thicknessMm / 2 * mmPx;
    const centre = toXY(gap.angle, (gap.lo + gap.hi) / 2, gap.c);
    const evidence = [];
    let kind = 'opening', leafMm = null;
    // Hinged door: an arc hinged near one end of the gap, its radius about the gap's width (or half, a pair).
    const ends = [toXY(gap.angle, gap.lo, gap.c), toXY(gap.angle, gap.hi, gap.c)];
    const swings = arcs.filter((arc) => arcRunsAlong(arc, gap.angle) && ends.some((end) => Math.hypot(arc.centre.x - end.x, arc.centre.y - end.y) <= options.swingReachMm * mmPx + half)
      && arc.radius / mmPx >= widthMm * 0.4 && arc.radius / mmPx <= widthMm * 1.15 && arc.sweepDeg >= 60 && arc.sweepDeg <= 120);
    if (swings.length) { kind = 'door'; leafMm = Math.round(Math.max(...swings.map((arc) => arc.radius / mmPx))); evidence.push(`${swings.length} door swing${swings.length > 1 ? 's' : ''}`); }
    const lines = allLines.get(gap.angle) || [];
    const across = lines.filter((line) => Math.abs(line.c - gap.c) <= half + 30 * mmPx && Math.min(line.hi, gap.hi) - Math.max(line.lo, gap.lo) >= 0.6 * (gap.hi - gap.lo));
    const partial = lines.filter((line) => Math.abs(line.c - gap.c) <= half + 30 * mmPx && (line.hi - line.lo) >= 0.25 * (gap.hi - gap.lo) && (line.hi - line.lo) <= 0.75 * (gap.hi - gap.lo) && line.lo >= gap.lo - 50 * mmPx && line.hi <= gap.hi + 50 * mmPx);
    const outside = lines.filter((line) => Math.abs(line.c - gap.c) > half && Math.abs(line.c - gap.c) <= half + 150 * mmPx && Math.min(line.hi, gap.hi) - Math.max(line.lo, gap.lo) >= 0.8 * (gap.hi - gap.lo) && (line.hi - line.lo) <= (gap.hi - gap.lo) * 2.2);
    let openingCentre = centre, openingWidthMm = widthMm, bridgeCentre = null, bridgeWidthMm = null;
    // Cavity slider: a line down the middle of the wall beside the gap, about as long as the gap is wide.
    const pocket = lines.filter((line) => Math.abs(line.c - gap.c) < half - 5 * mmPx && Math.abs(line.c - gap.c) <= half
      && (Math.abs(line.lo - gap.hi) <= 120 * mmPx || Math.abs(line.hi - gap.lo) <= 120 * mmPx || (line.lo < gap.lo && line.hi > gap.lo) || (line.lo < gap.hi && line.hi > gap.hi))
      && (line.hi - line.lo) / mmPx >= widthMm * 0.6 && (line.hi - line.lo) / mmPx <= widthMm * 2.3);
    if (kind === 'opening' && pocket.length) { kind = 'cavity-slider'; evidence.push('door leaf drawn in a wall pocket'); }
    if (kind === 'opening' && partial.some(a => partial.some(b => Math.abs(a.c - b.c) > options.collinearMm * mmPx))) {
      const spanLo = Math.min(...partial.map(line => line.lo));
      const spanHi = Math.max(...partial.map(line => line.hi));
      const panelSpanMm = (spanHi - spanLo) / mmPx;
      // A wide multi-panel slider may draw only central/overlapping leaves.
      // Small inset window frames retain their drawn span and position.
      openingWidthMm = panelSpanMm >= 2000 ? widthMm : panelSpanMm;
      openingCentre = panelSpanMm >= 2000 ? centre : toXY(gap.angle, (spanLo + spanHi) / 2, gap.c);
      bridgeCentre = centre;
      bridgeWidthMm = widthMm;
      kind = openingWidthMm >= 2000 ? 'sliding-door' : 'window';
      evidence.push(`${partial.length} frame or glass lines across ${Math.round(openingWidthMm)} mm`);
    }
    const box = kind === 'opening' ? projectedWindowBox(gap, half, lines) : null;
    if (gap.atCorner && !box) continue;
    if (box) {
      // One window per panel between the end caps and mullions.
      windowBoxes.push({ angle: gap.angle, ...box });
      // Caps between the ends split separate windows only when each one carries its own size label
      // (one code per window); otherwise they are the mullions of one window.
      const labelAt = (lo, hi) => (context.textItems || []).some((item) => {
        if (!/^s*d{3,4}s*[A-Z]{0,3}s*$/i.test(String(item.text || '')) || !Number.isFinite(item.x) || !Number.isFinite(item.y)) return false;
        const along = item.x * Math.cos(gap.angle) + item.y * Math.sin(gap.angle), off = -item.x * Math.sin(gap.angle) + item.y * Math.cos(gap.angle);
        return along >= lo - 5 * mmPx && along <= hi + 5 * mmPx && Math.abs(off - gap.c) <= options.windowLabelReachMm * mmPx;
      });
      const panels = [box.windowLo, ...box.mullions, box.windowHi];
      const ownLabels = box.mullions.length && panels.slice(1).every((stop, k) => labelAt(panels[k], stop));
      const stops = ownLabels ? panels : [box.windowLo, box.windowHi];
      for (let k = 1; k < stops.length; k += 1) {
        const panelMm = (stops[k] - stops[k - 1]) / mmPx;
        if (panelMm < options.frameMinMm) continue;
        openings.push({ id: `vo-${openings.length + 1}`, ...toXY(gap.angle, (stops[k - 1] + stops[k]) / 2, gap.c), axis: Math.abs(Math.cos(gap.angle)) > 0.999 ? 'h' : Math.abs(Math.sin(gap.angle)) > 0.999 ? 'v' : 'd',
          direction: { x: Math.cos(gap.angle), y: Math.sin(gap.angle) }, widthMm: Math.round(panelMm), hostThicknessMm: Math.round(gap.thicknessMm),
          ...(stops.length > 2 || gap.atCorner ? { bridgeX: centre.x, bridgeY: centre.y, bridgeWidthMm: Math.round(widthMm) } : {}),
          kind: 'window', confirmed: true, evidence: `window box drawn out from the wall, capped at both ends${stops.length > 2 ? ` (${stops.length - 1} panels)` : ''}` });
      }
      continue;
    }
    if (kind === 'opening' && across.length >= 2) { kind = widthMm >= 2000 ? 'sliding-door' : 'window'; evidence.push(`${across.length} frame or glass lines across the gap`); }
    if (kind === 'opening' && across.length === 1 && widthMm >= options.garageMinMm) { kind = 'garage-door'; evidence.push('a single door line across a wide gap'); }
    if (kind === 'opening' && across.length === 1) { kind = 'window'; evidence.push('a glass line across the gap'); }
    if (kind === 'opening' && outside.length) { kind = 'barn-door'; evidence.push('a door hung across the wall face'); }
    openings.push({ id: `vo-${openings.length + 1}`, ...openingCentre, axis: Math.abs(Math.cos(gap.angle)) > 0.999 ? 'h' : Math.abs(Math.sin(gap.angle)) > 0.999 ? 'v' : 'd',
      direction: { x: Math.cos(gap.angle), y: Math.sin(gap.angle) }, widthMm: Math.round(openingWidthMm), ...(leafMm ? { leafMm } : {}), hostThicknessMm: Math.round(gap.thicknessMm),
      ...(bridgeCentre ? { bridgeX: bridgeCentre.x, bridgeY: bridgeCentre.y, bridgeWidthMm: Math.round(bridgeWidthMm) } : {}),
      kind, confirmed: kind !== 'opening', evidence: evidence.join('; ') || 'a gap in the wall line with nothing drawn to say what it is' });
  }
  // The box of a projected window is not a wall: drop measured pairs lying inside it.
  if (windowBoxes.length) {
    const inBox = (wall) => windowBoxes.some((box) => box.angle === wall.angle && wall.lo >= box.lo - 40 * mmPx && wall.hi <= box.hi + 40 * mmPx
      && wall.c >= Math.min(box.c0, wall.c) - 1e-9 && Math.min(wall.c0, wall.c1) >= Math.min(box.c0, box.c1) - (wall.thicknessMm + 10) * mmPx && Math.max(wall.c0, wall.c1) <= Math.max(box.c0, box.c1) + 5 * mmPx
      && Math.max(wall.c0, wall.c1) > Math.min(box.c0, box.c1) + 5 * mmPx);
    for (const wall of accepted) if (inBox(wall)) reject(wall, 'inside a projected window box (frame and glass, not a wall)');
    accepted = accepted.filter((wall) => !inBox(wall));
  }
  // Windows drawn as a frame along a continuous wall (the frame was set aside as lying beside the wall).
  // A frame split at a mullion is one window: pieces along one wall a short way apart are joined.
  const frames = all.filter((item) => item.besideOf && accepted.some((wall) => wall === item.besideOf || (wall.angle === item.besideOf.angle && Math.abs(wall.c - item.besideOf.c) < 1e-6 && wall.lo <= item.besideOf.lo + 1e-6 && wall.hi >= item.besideOf.hi - 1e-6)))
    .sort((p, q) => p.angle - q.angle || p.besideOf.c - q.besideOf.c || p.lo - q.lo);
  const joinedFrames = [];
  for (const frame of frames) {
    const last = joinedFrames[joinedFrames.length - 1];
    if (last && last.angle === frame.angle && Math.abs(last.besideOf.c - frame.besideOf.c) < 1e-6 && frame.lo <= last.hi + options.frameJoinMm * mmPx) {
      last.hi = Math.max(last.hi, frame.hi); last.lengthMm = (last.hi - last.lo) / mmPx;
    } else joinedFrames.push({ ...frame });
  }
  for (const candidate of joinedFrames) {
    const widthMm = candidate.lengthMm;
    if (widthMm < options.frameMinMm || widthMm > options.frameMaxMm) continue;
    if (candidate.thicknessMm < options.frameThicknessMm[0] || candidate.thicknessMm > options.frameThicknessMm[1] + 40) continue;
    const host = candidate.besideOf;
    const centre = toXY(host.angle, (candidate.lo + candidate.hi) / 2, host.c);
    if (openings.some((opening) => Math.hypot(opening.x - centre.x, opening.y - centre.y) <= 300 * mmPx)) continue;
    openings.push({ id: `vo-${openings.length + 1}`, ...centre, axis: Math.abs(Math.cos(host.angle)) > 0.999 ? 'h' : Math.abs(Math.sin(host.angle)) > 0.999 ? 'v' : 'd',
      direction: { x: Math.cos(host.angle), y: Math.sin(host.angle) }, widthMm: Math.round(widthMm), hostThicknessMm: Math.round(host.thicknessMm), kind: 'window', confirmed: true, inWall: true, needsClassification: true,
      evidence: 'window frame drawn along the wall' });
  }

  // Projected window/slider frames may be drawn outside a continuous wall face.
  // Unlike an arbitrary nearby parallel pair, a frame has matching extents and
  // drawn end caps at BOTH ends. Require a longer measured host and wall pens.
  for (const frame of all) {
    if (frame.thicknessMm < options.frameThicknessMm[0] || frame.thicknessMm > options.projectedFrameMaxThicknessMm
      || frame.lengthMm < options.frameMinMm || frame.lengthMm > options.frameMaxMm) continue;
    if (!frame.faces.every(face => wallPens.has(face.style)
      && Math.abs(face.lo - frame.lo) <= options.frameCapToleranceMm * mmPx && Math.abs(face.hi - frame.hi) <= options.frameCapToleranceMm * mmPx)) continue;
    const host = accepted.find(wall => wall.angle === frame.angle
      && wall.lengthMm > frame.lengthMm * options.besideLengthRatio
      && frame.lo >= wall.lo - 30 * mmPx && frame.hi <= wall.hi + 30 * mmPx
      && (frame.c1 < wall.c0 - 5 * mmPx || frame.c0 > wall.c1 + 5 * mmPx)
      && Math.min(Math.abs(frame.c0 - wall.c1), Math.abs(frame.c1 - wall.c0)) <= options.projectedFrameReachMm * mmPx);
    if (!host) continue;
    const u = { x: Math.cos(frame.angle), y: Math.sin(frame.angle) };
    const n = { x: -u.y, y: u.x };
    const capped = end => straight.some(line => {
      if (line.curve || line.dashed || line.paint !== 'stroke' || !wallPens.has(styleOf(line))) return false;
      const s0 = line.x1 * u.x + line.y1 * u.y, s1 = line.x2 * u.x + line.y2 * u.y;
      const c0 = line.x1 * n.x + line.y1 * n.y, c1 = line.x2 * n.x + line.y2 * n.y;
      return Math.abs(s0 - end) <= 20 * mmPx && Math.abs(s1 - end) <= 20 * mmPx
        && Math.min(c0, c1) <= frame.c0 + 20 * mmPx && Math.max(c0, c1) >= frame.c1 - 20 * mmPx
        && Math.min(c0, c1) >= Math.min(frame.c0, host.c0) - 20 * mmPx
        && Math.max(c0, c1) <= Math.max(frame.c1, host.c1) + 20 * mmPx;
    });
    if (!capped(frame.lo) || !capped(frame.hi)) continue;
    const centre = toXY(host.angle, (frame.lo + frame.hi) / 2, host.c);
    if (openings.some(opening => Math.hypot(opening.x - centre.x, opening.y - centre.y) <= 300 * mmPx)) continue;
    openings.push({ id: `vo-${openings.length + 1}`, ...centre,
      axis: Math.abs(Math.cos(host.angle)) > 0.999 ? 'h' : Math.abs(Math.sin(host.angle)) > 0.999 ? 'v' : 'd',
      direction: { x: u.x, y: u.y }, widthMm: Math.round(frame.lengthMm), hostThicknessMm: Math.round(host.thicknessMm),
      kind: 'window', confirmed: true, inWall: true, needsClassification: true,
      evidence: 'Closed projected frame with two drawn end caps beside a measured continuous wall.' });
  }

  // Windows drawn in the wall: frame or glass lines between the faces of a continuous wall, shorter than it.
  for (const wall of accepted) {
    const lines = allLines.get(wall.angle) || [];
    const half = wall.thicknessMm / 2 * mmPx;
    const inner = lines.filter((line) => Math.abs(line.c - wall.c) < half - 3 * mmPx && line.lo >= wall.lo - 30 * mmPx && line.hi <= wall.hi + 30 * mmPx
      && (line.hi - line.lo) / mmPx >= options.frameMinMm && (line.hi - line.lo) < 0.9 * (wall.hi - wall.lo)).sort((p, q) => p.lo - q.lo);
    const spans = [];
    for (const line of inner) { const last = spans[spans.length - 1]; if (last && line.lo <= last.hi + 50 * mmPx) { last.hi = Math.max(last.hi, line.hi); last.count += 1; } else spans.push({ lo: line.lo, hi: line.hi, count: 1 }); }
    for (const span of spans) {
      const widthMm = (span.hi - span.lo) / mmPx;
      if (widthMm > options.frameMaxMm) continue;
      const centre = toXY(wall.angle, (span.lo + span.hi) / 2, wall.c);
      if (openings.some((opening) => Math.hypot(opening.x - centre.x, opening.y - centre.y) <= Math.max(300, widthMm / 2) * mmPx)) continue;
      // Beside a gap in the wall line and about its width: the pocket of a cavity slider.
      const gap = openingsFromGaps.find((item) => item.angle === wall.angle && Math.abs(item.c - wall.c) <= 10 * mmPx
        && (Math.abs(item.lo - span.hi) <= 150 * mmPx || Math.abs(item.hi - span.lo) <= 150 * mmPx) && widthMm >= (item.hi - item.lo) / mmPx * 0.6 && widthMm <= (item.hi - item.lo) / mmPx * 1.5);
      if (gap) {
        const at = openings.find((opening) => Math.hypot(opening.x - toXY(gap.angle, (gap.lo + gap.hi) / 2, gap.c).x, opening.y - toXY(gap.angle, (gap.lo + gap.hi) / 2, gap.c).y) <= 50 * mmPx);
        if (at && at.kind === 'opening') { at.kind = 'cavity-slider'; at.confirmed = true; at.evidence = 'door leaf drawn in the wall pocket beside the gap'; }
        continue;
      }
      openings.push({ id: `vo-${openings.length + 1}`, ...centre, axis: Math.abs(Math.cos(wall.angle)) > 0.999 ? 'h' : Math.abs(Math.sin(wall.angle)) > 0.999 ? 'v' : 'd',
        direction: { x: Math.cos(wall.angle), y: Math.sin(wall.angle) }, widthMm: Math.round(widthMm), hostThicknessMm: Math.round(wall.thicknessMm), kind: 'window', confirmed: true, inWall: true, needsClassification: true,
        evidence: `${span.count} frame or glass line${span.count > 1 ? 's' : ''} drawn in the wall` });
    }
  }

  // Hinged doors from their swings: the hinge (the arc's centre) lies on a wall line, one end of the
  // arc lies along the wall (the door closed) and the radius is the leaf. The doorway runs from the
  // hinge along the wall by the leaf width, whether or not the wall line shows a clean gap there.
  for (const arc of arcs) {
    const leafMm = arc.radius / mmPx;
    if (leafMm < options.leafMinMm || leafMm > options.leafMaxMm || arc.sweepDeg < 70 || arc.sweepDeg > 110) continue;
    let host = null;
    for (const wall of accepted) {
      if (!arcRunsAlong(arc, wall.angle)) continue;
      const u = { x: Math.cos(wall.angle), y: Math.sin(wall.angle) }, n = { x: -u.y, y: u.x };
      const sHinge = arc.centre.x * u.x + arc.centre.y * u.y, cHinge = arc.centre.x * n.x + arc.centre.y * n.y;
      const off = Math.abs(cHinge - wall.c) / mmPx;
      if (off > wall.thicknessMm / 2 + options.swingWallReachMm) continue;
      if (sHinge < wall.lo - (leafMm + 200) * mmPx || sHinge > wall.hi + (leafMm + 200) * mmPx) continue;
      // The arc end lying along the wall line gives the side the doorway is on.
      const ends = (arc.closedEnd ? [arc.closedEnd] : [arc.start, arc.end]).map((p) => ({ s: p.x * u.x + p.y * u.y, c: p.x * n.x + p.y * n.y }));
      const closed = ends.reduce((best, e) => (Math.abs(e.c - wall.c) < Math.abs(best.c - wall.c) ? e : best));
      if (Math.abs(closed.c - wall.c) / mmPx > wall.thicknessMm / 2 + options.swingWallReachMm + 100) continue;
      if (!host || off < host.off) host = { wall, off, side: Math.sign(closed.s - sHinge) || 1, sHinge };
    }
    if (!host && arc.closedEnd) {
      const hinge = arc.centre, closed = arc.closedEnd;
      const direction = { x: (closed.x - hinge.x) / arc.radius, y: (closed.y - hinge.y) / arc.radius };
      const doorwayAngle = Math.atan2(direction.y, direction.x);
      const support = point => accepted.filter(wall => {
        const u = { x: Math.cos(wall.angle), y: Math.sin(wall.angle) }, n = { x: -u.y, y: u.x };
        const s = point.x * u.x + point.y * u.y, c = point.x * n.x + point.y * n.y;
        const along = Math.max(wall.lo - s, 0, s - wall.hi);
        const across = Math.max(0, Math.abs(c - wall.c) - wall.thicknessMm * mmPx / 2);
        return Math.hypot(along, across) <= (options.meetReachMm + 100 + wall.thicknessMm / 2) * mmPx;
      });
      const atHinge = support(hinge), atClosed = support(closed);
      const jambPair = atHinge.flatMap(a => atClosed.filter(b => b !== a).map(b => [a, b]))[0];
      if (jambPair) {
        const centre = { x: (hinge.x + closed.x) / 2, y: (hinge.y + closed.y) / 2 };
        if (!openings.some(opening => opening.confirmed && Math.hypot(opening.x - centre.x, opening.y - centre.y) < 150 * mmPx)) {
          openings.push({ id: `vo-${openings.length + 1}`, ...centre,
            axis: Math.abs(direction.x) > 0.999 ? 'h' : Math.abs(direction.y) > 0.999 ? 'v' : 'd',
            direction: { x: Math.cos(doorwayAngle), y: Math.sin(doorwayAngle) }, widthMm: Math.round(leafMm), leafMm: Math.round(leafMm),
            hostThicknessMm: Math.round(Math.min(...jambPair.map(w => w.thicknessMm))),
            kind: 'door', confirmed: true, evidence: 'Door swing with a drawn open leaf and measured wall support at both jambs.' });
        }
      }
      continue;
    }
    if (!host) continue;
    const { wall } = host;
    const sCentre = host.sHinge + host.side * arc.radius / 2;
    const centre = toXY(wall.angle, sCentre, wall.c);
    const existing = openings.find((opening) => Math.hypot(opening.x - centre.x, opening.y - centre.y) <= Math.max(300, leafMm / 2) * mmPx);
    if (existing) {
      if (existing.kind !== 'door') { existing.kind = 'door'; existing.confirmed = true; existing.leafMm = Math.round(leafMm); existing.evidence = `door swing (${Math.round(leafMm)} mm leaf)${existing.evidence ? `; ${existing.evidence}` : ''}`; }
      continue;
    }
    // A gap opening that contains this doorway is narrowed to it (two doors side by side in one gap).
    openings.push({ id: `vo-${openings.length + 1}`, ...centre, axis: Math.abs(Math.cos(wall.angle)) > 0.999 ? 'h' : Math.abs(Math.sin(wall.angle)) > 0.999 ? 'v' : 'd',
      direction: { x: Math.cos(wall.angle), y: Math.sin(wall.angle) }, widthMm: Math.round(leafMm), leafMm: Math.round(leafMm), hostThicknessMm: Math.round(wall.thicknessMm),
      kind: 'door', confirmed: true, evidence: `door swing (${Math.round(leafMm)} mm leaf)` });
  }
  // A wide unexplained gap holding the doors read from their swings is those doors: it is still bridged
  // (the wall line runs across it) but not reported as an opening of its own.
  for (let i = openings.length - 1; i >= 0; i -= 1) {
    const gap = openings[i];
    if (gap.kind !== 'opening') continue;
    const inside = openings.filter((other) => other !== gap && other.kind === 'door' && Math.hypot(other.x - gap.x, other.y - gap.y) * 1 <= gap.widthMm / 2 * mmPx);
    if (inside.length >= 2 || (inside.length === 1 && inside[0].widthMm >= gap.widthMm * 0.6)) { gap.bridgeOnly = true; gap.evidence = `holds ${inside.length} door${inside.length > 1 ? "s" : ""} read from swings`; }
  }

  const out = accepted.map((wall, index) => {
    const { a, b } = endpoints(wall);
    const horizontal = Math.abs(Math.sin(wall.angle)) < 1e-3, vertical = Math.abs(Math.cos(wall.angle)) < 1e-3;
    return { id: `vw-${index + 1}`, nodes: [a, b], axis: horizontal ? 'h' : vertical ? 'v' : 'd', angle: wall.angle, measuredThicknessMm: Math.round(wall.thicknessMm * 10) / 10,
      lengthMm: Math.round(wall.lengthMm), pens: [...new Set(wall.faces.map((face) => face.style))] };
  });
  const hostIdsFor = (opening) => {
    const direction = opening.direction || { x: Math.cos(opening.angle || 0), y: Math.sin(opening.angle || 0) };
    const angle = Math.atan2(direction.y, direction.x);
    const halfWidth = Math.max(0, opening.widthMm || 0) * mmPx / 2;
    const candidates = accepted.map((wall, index) => {
      const angleDiff = Math.abs(wall.angle - angle) % Math.PI;
      const parallelError = Math.min(angleDiff, Math.PI - angleDiff);
      if (parallelError > 2 * deg) return null;
      const u = { x: Math.cos(wall.angle), y: Math.sin(wall.angle) }, n = { x: -u.y, y: u.x };
      const s = opening.x * u.x + opening.y * u.y, c = opening.x * n.x + opening.y * n.y;
      const offset = Math.abs(c - wall.c);
      const along = s < wall.lo ? wall.lo - s : s > wall.hi ? s - wall.hi : 0;
      const offsetReach = (wall.thicknessMm + (opening.hostThicknessMm || wall.thicknessMm)) * mmPx / 2 + 100 * mmPx;
      const alongReach = (opening.inWall ? 100 : halfWidth + options.meetReachMm * mmPx);
      if (offset > offsetReach || along > alongReach) return null;
      return { index, score: offset + along };
    }).filter(Boolean).sort((a, b) => a.score - b.score);
    return candidates.slice(0, opening.inWall ? 1 : 2).map(({ index }) => out[index].id);
  };
  for (const opening of openings) opening.hostWallIds = hostIdsFor(opening);
  return {
    engine: 'vector-walls-3', walls: out, openings, rejected,
    stats: { directionsDeg: directions.map((value) => Math.round(value / deg * 10) / 10), thicknessModesMm: modes.map((value) => Math.round(value)), wallPens: [...wallPens], candidates: all.length, accepted: out.length, rejected: rejected.length },
  };
}

// Door swings: chords grouped by the figure (path and subpath) they belong to, split where the chain
// breaks, and read as circular arcs when every vertex lies on one circle.
function groupArcs(chordsIn) {
  const groups = new Map();
  for (const s of chordsIn) { const key = `${s.path}|${s.subpath}`; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(s); }
  const chains = [];
  for (const chords of groups.values()) {
    let chain = [chords[0]];
    for (let i = 1; i < chords.length; i += 1) {
      const previous = chain[chain.length - 1], next = chords[i];
      if (Math.hypot(previous.x2 - next.x1, previous.y2 - next.y1) < 1e-3) chain.push(next); else { chains.push(chain); chain = [next]; }
    }
    chains.push(chain);
  }
  const arcs = [];
  for (const chords of chains) {
    if (chords.length < 3 || (!chords[0].curve && chords.length < 4)) continue;
    const points = [{ x: chords[0].x1, y: chords[0].y1 }, ...chords.map((s) => ({ x: s.x2, y: s.y2 }))];
    const p = points[0], q = points[points.length >> 1], r = points[points.length - 1];
    const d = 2 * (p.x * (q.y - r.y) + q.x * (r.y - p.y) + r.x * (p.y - q.y));
    if (Math.abs(d) < 1e-9) continue;
    const ux = ((p.x ** 2 + p.y ** 2) * (q.y - r.y) + (q.x ** 2 + q.y ** 2) * (r.y - p.y) + (r.x ** 2 + r.y ** 2) * (p.y - q.y)) / d;
    const uy = ((p.x ** 2 + p.y ** 2) * (r.x - q.x) + (q.x ** 2 + q.y ** 2) * (p.x - r.x) + (r.x ** 2 + r.y ** 2) * (q.x - p.x)) / d;
    const radius = Math.hypot(p.x - ux, p.y - uy);
    const a0 = Math.atan2(p.y - uy, p.x - ux), a1 = Math.atan2(r.y - uy, r.x - ux);
    let sweep = Math.abs(a1 - a0) * 180 / Math.PI; if (sweep > 180) sweep = 360 - sweep;
    if (points.some((point) => Math.abs(Math.hypot(point.x - ux, point.y - uy) - radius) > radius * 0.05)) continue;
    arcs.push({ centre: { x: ux, y: uy }, radius, sweepDeg: sweep, start: p, end: r });
  }
  return arcs;
}
