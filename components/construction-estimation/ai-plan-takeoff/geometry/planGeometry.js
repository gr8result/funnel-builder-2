// Geometry-first plan reading: walls, the openings in them and the rooms they enclose are
// measured from the drawing's own linework, never from positions a language model reports.
// A wall is two long parallel faces a wall-thickness apart; a room is the space those walls
// (with their door gaps closed) enclose. Pure functions over an RGBA raster: no DOM, no network.
// All returned coordinates are logical plan pixels, the unit the canvas and calibration use.

import { detectOpeningSymbolReviewCandidates } from './openingSymbolReview.js';

const STANDARD_THICKNESSES = [70, 90, 110, 150, 200, 230, 250, 270, 300, 350];
const nearest = (value, list) => list.reduce((best, item) => (Math.abs(item - value) < Math.abs(best - value) ? item : best));

export const GEOMETRY_ENGINE_VERSION = 'plan-geometry-5';

export const DEFAULT_GEOMETRY_OPTIONS = {
  inkThreshold: 630,          // r+g+b below this is linework
  minWallMm: 60, maxWallMm: 360,
  faceRunMm: 450,             // a face this long establishes a wall
  nibRunMm: 200,              // wall fabric: shorter faces are lettering, symbols and joinery far more often than wall
  doorLineReachMm: 100,       // wall-to-wall doors: the door's lines lie this close to where the opening was located
  jambReturnRunMm: 110,       // openings: a return this short still counts when its faces line up with an established wall
  singleFaceReviewRunMm: 2500,
  singleFaceAnchorReachMm: 220,
  singleFaceJunctionReachMm: 350,
  singleFaceThicknessAgreementMm: 80,
  maxLinePx: 7,               // thicker ink is a fill, not a face line
  doorGapMm: 1300,            // a wall end this close to another wall is an opening
  collinearGapMm: 6000,       // the same wall continuing across a gap (up to a garage door)
  minOpeningMm: 400,          // shorter closures are wall junctions, not openings
  minRoomM2: 0.35, minRoomSideMm: 450,
  simplifyPx: 1.6,
  evidenceReachMm: 700,       // an opening located this close to a gap confirms it
  swingDoorMinMm: 500, swingDoorMaxMm: 1450, // a hinged door leaf is this wide (an entry door with its frame at the top end)
  closedDoorMinMm: 600,       // a door drawn closed is found by its swing alone, so short arcs (basins, pans) are left out
  wideDoorLineShare: 0.85,    // a gap wider than a doorway is a door where one unbroken line is drawn along this much of it
  slidingTracks: true, trackPanelMm: 400, trackMinMm: 900, trackMaxMm: 3800, trackMaxThicknessMm: 160, trackDoubledShare: 0.5, trackEndReachMm: 180, trackRecessMinMm: 400, trackRecessMaxMm: 900,
  cavitySliders: true, cavityPocketMinMm: 150, cavityLeafMinMm: 60,
  alignedDoorways: true,      // a door-width gap between two ends of one wall is an opening in that wall
  closedDoorSwings: true,     // also look for the swing of a door drawn closed in its wall
  swingArcShare: 0.95,        // this much of a door's quarter-circle swing has to be drawn
  isolatedRunMm: 1500,        // shorter paired linework joining no wall is not a wall
  angledWalls: true, angledFaceMm: 700, // walls at other angles: two parallel lines at least this long, a wall's thickness apart
  diagonalWalls: true, diagonalMinMm: 500, diagonalJoinMm: 250, diagonalSideReachMm: 400, // walls drawn at 45 degrees
  outsideReachMm: 700,        // the outside lies this close to the face of an external wall
  outsideDiscMm: 1500,        // the outside is what a disc this big can reach from the edge of the drawing
  proposeRooms: true,         // also return spaces that enclose only through unconfirmed gaps
};

// Ink pixels that belong to a straight run of at least minLen along the scan direction.
function longRuns(ink, width, height, minLen, vertical, crossTolerance = 0) {
  const out = new Uint8Array(width * height);
  const outer = vertical ? width : height, inner = vertical ? height : width;
  const step = vertical ? width : 1;
  const crossStep = vertical ? 1 : width;
  for (let o = 0; o < outer; o += 1) {
    const base = vertical ? o : o * width;
    let start = -1;
    for (let i = 0; i <= inner; i += 1) {
      const p = base + i * step;
      let on = i < inner && ink[p];
      for (let offset = 1; !on && i < inner && offset <= crossTolerance; offset += 1) {
        on = (o >= offset && ink[p - offset * crossStep]) || (o + offset < outer && ink[p + offset * crossStep]);
      }
      if (on && start < 0) start = i;
      else if (!on && start >= 0) {
        if (i - start >= minLen) for (let j = start; j < i; j += 1) out[base + j * step] = 1;
        start = -1;
      }
    }
  }
  return out;
}

// Length of the straight ink run each ink pixel belongs to, along the scan direction.
function runLengths(ink, width, height, vertical) {
  const out = new Uint16Array(width * height);
  const outer = vertical ? width : height, inner = vertical ? height : width;
  const step = vertical ? width : 1;
  for (let o = 0; o < outer; o += 1) {
    const base = vertical ? o : o * width;
    let start = -1;
    for (let i = 0; i <= inner; i += 1) {
      const on = i < inner && ink[base + i * step];
      if (on && start < 0) start = i;
      else if (!on && start >= 0) {
        const length = Math.min(65535, i - start);
        for (let j = start; j < i; j += 1) out[base + j * step] = length;
        start = -1;
      }
    }
  }
  return out;
}

// Mark the band between two parallel faces. `vertical` = the wall runs vertically (faces are
// vertical lines, scanned along each row). Value 2 where both faces are established, 1 for nibs.
function wallBands(ink, faceLength, strictLen, relaxedLen, width, height, vertical, tMin, tMax, maxLine, window = null) {
  const mask = new Uint8Array(width * height);
  const outer = vertical ? height : width, inner = vertical ? width : height;
  const step = vertical ? 1 : width;
  const runs = [];
  // An optional window limits the scan to part of the sheet.
  const oFrom = window ? (vertical ? window.y0 : window.x0) : 0, oTo = window ? (vertical ? window.y1 : window.x1) : outer - 1;
  const iFrom = window ? (vertical ? window.x0 : window.y0) : 0, iTo = window ? (vertical ? window.x1 : window.y1) : inner - 1;
  for (let o = oFrom; o <= oTo; o += 1) {
    const base = vertical ? o * width : o;
    runs.length = 0;
    let start = -1;
    for (let i = iFrom; i <= iTo + 1; i += 1) {
      const on = i <= iTo && ink[base + i * step];
      if (on && start < 0) start = i;
      else if (!on && start >= 0) { runs.push(start, i - 1); start = -1; }
    }
    // Candidate bands between consecutive face lines.
    const bands = [];
    for (let r = 0; r + 3 < runs.length; r += 2) {
      const a1 = runs[r], b1 = runs[r + 1], a2 = runs[r + 2], b2 = runs[r + 3];
      if (b1 - a1 >= maxLine || b2 - a2 >= maxLine) continue;
      const distance = (a2 + b2) / 2 - (a1 + b1) / 2;
      if (distance < tMin || distance > tMax) continue;
      const p1 = base + a1 * step, p2 = base + a2 * step;
      const l1 = faceLength[p1], l2 = faceLength[p2];
      if (l1 < relaxedLen || l2 < relaxedLen) continue;
      bands.push({ r, a1, b2, distance, l1, l2, level: l1 >= strictLen && l2 >= strictLen ? 2 : 1 });
    }
    // Faces shared by a run of equally spaced bands are stair treads or shelving, not walls;
    // of two bands sharing a face that together exceed a wall, the thinner one is the wall.
    // A wall with a window frame, joinery or a second leaf drawn in or against it also chains three
    // bands, unequally spaced: there the wall is the one or two bands whose faces run furthest, and
    // the stretch is marked (bit 4) as carrying a symbol, which is how windows are found.
    for (let i = 0; i < bands.length; i += 1) {
      let j = i;
      while (j + 1 < bands.length && bands[j + 1].r === bands[j].r + 2) j += 1;
      const chain = bands.slice(i, j + 1);
      const total = chain.reduce((sum, band) => sum + band.distance, 0);
      let keep = chain;
      if (chain.length >= 3) {
        const least = Math.min(...chain.map((band) => band.distance)), most = Math.max(...chain.map((band) => band.distance));
        keep = [];
        if (most - least > Math.max(2, least * 0.2)) {
          let single = null, pair = null;
          for (let s = 0; s < chain.length; s += 1) {
            const own = (chain[s].l1 + chain[s].l2) / 2;
            if (!single || own > single.score) single = { score: own, bands: [chain[s]] };
            if (s + 1 < chain.length && chain[s].distance + chain[s + 1].distance <= tMax) {
              const both = (chain[s].l1 + chain[s].l2 + chain[s + 1].l2) / 3;
              if (!pair || both > pair.score) pair = { score: both, bands: [chain[s], chain[s + 1]] };
            }
          }
          keep = (pair && pair.score >= single.score * 0.8 ? pair.bands : single.bands).map((band) => ({ ...band, level: band.level | 4 }));
        }
      } else if (chain.length === 2 && total > tMax) keep = [chain[0].distance <= chain[1].distance ? chain[0] : chain[1]];
      for (const band of keep) for (let k = band.a1; k <= band.b2; k += 1) mask[base + k * step] = band.level;
      i = j;
    }
  }
  return mask;
}

// How far the band extends either side of a pixel, across the wall: its two faces.
function faceExtents(band, p, cross) {
  let low = 0, high = 0;
  while (low < 64 && band[p - (low + 1) * cross]) low += 1;
  while (high < 64 && band[p + (high + 1) * cross]) high += 1;
  return [low, high];
}

// Jamb returns: a strip of short paired faces is taken as wall only when the same two faces carry
// on, along the same line, into wall already found. Lettering and symbols never line up that way.
function admitAlignedReturns(band, loose, crossing, width, height, vertical, reach) {
  const { labels, components } = labelComponents((p) => loose[p] && !band[p], width, height, { x0: 0, y0: 0, x1: width - 1, y1: height - 1 });
  const cross = vertical ? 1 : width;
  const inner = vertical ? height : width;
  const admit = new Uint8Array(components.length);
  for (const item of components) {
    if (!item) continue;
    const lowEnd = vertical ? item.minY : item.minX, highEnd = vertical ? item.maxY : item.maxX;
    const centre = vertical ? (item.minX + item.maxX) >> 1 : (item.minY + item.maxY) >> 1;
    const lowExtent = centre - (vertical ? item.minX : item.minY), highExtent = (vertical ? item.maxX : item.maxY) - centre;
    for (const direction of [-1, 1]) {
      for (let g = 1; g <= reach && !admit[item.id]; g += 1) {
        const i = (direction < 0 ? lowEnd : highEnd) + direction * g;
        if (i < 1 || i >= inner - 1) break;
        const q = vertical ? i * width + centre : centre * width + i;
        if (band[q]) {
          const [low, high] = faceExtents(band, q, cross);
          if (Math.abs(low - lowExtent) <= 2 && Math.abs(high - highExtent) <= 2) admit[item.id] = 1;
          break;
        }
        if (crossing[q]) break;
      }
    }
  }
  let admitted = 0;
  for (let p = 0; p < labels.length; p += 1) if (labels[p] && admit[labels[p]]) { band[p] = 1; admitted += 1; }
  return admitted;
}

// Distance from every pixel inside the bounds to the nearest pixel where test holds, as a 3-4
// chamfer (three units per pixel), capped at 65535.
function chamferDistance(test, width, height, bounds) {
  const distance = new Uint16Array(width * height).fill(65535);
  const { x0, y0, x1, y1 } = bounds;
  for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) if (test(y * width + x)) distance[y * width + x] = 0;
  const relax = (p, q, cost) => { const value = distance[q] + cost; if (value < distance[p]) distance[p] = value; };
  for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) {
    const p = y * width + x;
    if (!distance[p]) continue;
    if (x > x0) relax(p, p - 1, 3);
    if (y > y0) { relax(p, p - width, 3); if (x > x0) relax(p, p - width - 1, 4); if (x < x1) relax(p, p - width + 1, 4); }
  }
  for (let y = y1; y >= y0; y -= 1) for (let x = x1; x >= x0; x -= 1) {
    const p = y * width + x;
    if (!distance[p]) continue;
    if (x < x1) relax(p, p + 1, 3);
    if (y < y1) { relax(p, p + width, 3); if (x < x1) relax(p, p + width + 1, 4); if (x > x0) relax(p, p + width - 1, 4); }
  }
  return distance;
}

function labelComponents(test, width, height, bounds) {
  const labels = new Int32Array(width * height);
  const stack = new Int32Array(width * height);
  const components = [null];
  const { x0, y0, x1, y1 } = bounds;
  for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) {
    const seed = y * width + x;
    if (labels[seed] || !test(seed)) continue;
    const id = components.length;
    const info = { id, area: 0, minX: x, maxX: x, minY: y, maxY: y, seed, border: false };
    let top = 0;
    stack[top++] = seed; labels[seed] = id;
    while (top) {
      const p = stack[--top];
      const px = p % width, py = (p - px) / width;
      info.area += 1;
      if (px < info.minX) info.minX = px; if (px > info.maxX) info.maxX = px;
      if (py < info.minY) info.minY = py; if (py > info.maxY) info.maxY = py;
      if (px === x0 || px === x1 || py === y0 || py === y1) info.border = true;
      if (px > x0 && !labels[p - 1] && test(p - 1)) { labels[p - 1] = id; stack[top++] = p - 1; }
      if (px < x1 && !labels[p + 1] && test(p + 1)) { labels[p + 1] = id; stack[top++] = p + 1; }
      if (py > y0 && !labels[p - width] && test(p - width)) { labels[p - width] = id; stack[top++] = p - width; }
      if (py < y1 && !labels[p + width] && test(p + width)) { labels[p + width] = id; stack[top++] = p + width; }
    }
    components.push(info);
  }
  return { labels, components };
}

// Close the gap from each wall end to the wall it faces. `vertical` = bands that run vertically.
function bridgeGaps(band, wall, bridge, width, height, vertical, doorGap, collinearGap, minGap, beside, diagonal = null, sideReach = 0, aligned = null) {
  const outer = vertical ? width : height, inner = vertical ? height : width;
  const step = vertical ? width : 1;
  const cross = vertical ? 1 : width;
  // Both ends of one wall have their two faces on the same lines.
  const faces = (p) => faceExtents(band, p, cross);
  const sameFaces = (p, q) => { const a = faces(p), b = faces(q); return Math.abs(a[0] - b[0]) <= 3 && Math.abs(a[1] - b[1]) <= 3; };
  for (let o = 0; o < outer; o += 1) {
    const base = vertical ? o : o * width;
    for (let i = 1; i < inner - 1; i += 1) {
      const p = base + i * step;
      if (!band[p]) continue;
      for (const direction of [1, -1]) {
        if (wall[p + direction * step]) continue;
        let hit = 0, met = 0, sameWall = false;
        for (let g = 1; g <= collinearGap; g += 1) {
          const j = i + direction * g;
          if (j < 0 || j >= inner) break;
          const q = base + j * step;
          if (!wall[q]) continue;
          met = g;
          // Reached another wall: one crossing close by, or the same wall continuing further on.
          sameWall = Boolean(band[q]) && sameFaces(p, q);
          if (g > 1 && (g <= doorGap || sameWall)) hit = g;
          break;
        }
        // A doorway that ends against the tip of a 45 degree wall: the tip rarely lies exactly on
        // this wall's line, so it is looked for a little to either side as well.
        if (!hit && diagonal && (!met || met > doorGap)) {
          let side = 0;
          for (let g = 2; g <= doorGap && !hit; g += 1) {
            const j = i + direction * g;
            if (j < 0 || j >= inner) break;
            for (let offset = 1; offset <= sideReach && !hit; offset += 1) for (const sign of [-1, 1]) {
              const q = base + j * step + sign * offset * cross;
              if (q >= 0 && q < diagonal.length && diagonal[q]) { hit = g; side = sign * offset; break; }
            }
          }
          if (hit > minGap) {
            for (let offset = 1; offset < Math.abs(side); offset += 1) { const q = base + (i + direction * hit) * step + Math.sign(side) * offset * cross; if (!wall[q]) bridge[q] = vertical ? 2 : 1; }
            for (let g = 1; g <= hit; g += 1) { const q = base + (i + direction * g) * step; if (!wall[q]) bridge[q] = vertical ? 2 : 1; }
          }
          continue;
        }
        // Two frames that project from one wall face each other along that wall: wall lies right
        // beside the space between them, so it is not a gap in a wall.
        if (hit > minGap) {
          const middle = base + (i + direction * (hit >> 1)) * step;
          for (let offset = 1; offset <= beside && hit; offset += 1) if (wall[middle - offset * cross] || wall[middle + offset * cross]) hit = 0;
        }
        for (let g = 1; g < hit; g += 1) { const q = base + (i + direction * g) * step; bridge[q] = vertical ? 2 : 1; if (aligned && sameWall) aligned[q] = 1; }
      }
    }
  }
}

// Stretches of one wall run that are drawn differently from the wall either side of them.
// widths: the run's thickness at each step along it; marked: steps already known to carry extra
// lines; inkAt(step, offset): linework across the run. Returns [from, to) step pairs.
function symbolStretches(widths, marked, inkAt, span, minPlateau, joinGap) {
  const along = widths.length;
  // Plateaus of near-constant thickness. Windows can take up most of a wall, so there is no
  // "usual" thickness to compare with: a frame is a plateau wider than the wall on both sides.
  const plateaus = [];
  for (let index = 0; index < along; index += 1) {
    const last = plateaus[plateaus.length - 1];
    if (last && Math.abs(widths[index] - last.sum / (last.to - last.from)) <= 2) { last.to = index + 1; last.sum += widths[index]; }
    else plateaus.push({ from: index, to: index + 1, sum: widths[index] });
  }
  const major = plateaus.filter((item) => item.to - item.from >= minPlateau).map((item) => ({ ...item, mean: item.sum / (item.to - item.from) }));
  const bulge = new Uint8Array(along);
  for (let index = 1; index + 1 < major.length; index += 1) {
    const { from, to, mean } = major[index];
    if (major[index - 1].mean > 0 && major[index + 1].mean > 0 && mean >= major[index - 1].mean + 3 && mean >= major[index + 1].mean + 3) bulge.fill(1, from, to);
  }
  // The wall's own line pattern across its thickness, taken from the stretches that are not
  // frames, against which every step along the wall is compared.
  const pattern = new Uint32Array(span);
  let plain = 0;
  for (let index = 0; index < along; index += 1) {
    if (!widths[index] || bulge[index] || marked[index]) continue;
    plain += 1;
    for (let offset = 0; offset < span; offset += 1) pattern[offset] += inkAt(index, offset);
  }
  const usualInk = Array.from(pattern, (count) => (plain > 0 && count > plain * 0.5 ? 1 : 0));
  const on = new Uint8Array(along);
  for (let index = 0; index < along; index += 1) {
    if (!widths[index]) continue;
    let differs = 0, solid = 0;
    for (let offset = 0; plain > 0 && offset < span; offset += 1) {
      const here = inkAt(index, offset);
      solid += here;
      const usualNear = usualInk[offset] || (offset > 0 && usualInk[offset - 1]) || (offset + 1 < span && usualInk[offset + 1]);
      const inkNear = here || (offset > 0 && inkAt(index, offset - 1)) || (offset + 1 < span && inkAt(index, offset + 1));
      if (here ? !usualNear : usualInk[offset] && !inkNear) differs += 1;
    }
    // A line crossing the wall (a junction or a frame end) is not itself a different pattern.
    on[index] = marked[index] || bulge[index] || (differs >= 2 && solid < span * 0.6) ? 1 : 0;
  }
  const stretches = [];
  for (let index = 0, from = -1; index <= along; index += 1) {
    if (index < along && on[index]) { if (from < 0) from = index; continue; }
    if (from < 0) continue;
    const last = stretches[stretches.length - 1];
    if (last && from - last[1] <= joinGap) last[1] = index; else stretches.push([from, index]);
    from = -1;
  }
  return stretches;
}

// A hinged door is drawn as a quarter circle from one jamb, with the door's width as its radius.
// Looks for that arc on either side of a gap, from either jamb. Returns the best share of the arc
// that is actually drawn (0..1) and the radius it was found at, which is the door leaf.
function doorSwingShare(inkFat, width, height, item, vertical) {
  const along = vertical ? item.maxY - item.minY + 1 : item.maxX - item.minX + 1;
  const inkNear = (x, y) => { const cx = Math.round(x), cy = Math.round(y); return cx >= 0 && cy >= 0 && cx < width && cy < height && inkFat[cy * width + cx] === 1; };
  let best = 0, radii = [];
  // The gap as bridged can start a little short of the drawn wall end, so the hinge is looked for
  // over the first part of the gap from each end, and the leaf may be narrower than the gap.
  const inset = Math.max(2, Math.round(along * 0.2));
  for (const endSign of [1, -1]) for (const sideSign of [1, -1]) {
    const endAlong = endSign > 0 ? (vertical ? item.minY : item.minX) : (vertical ? item.maxY : item.maxX);
    const faceAcross = sideSign > 0 ? (vertical ? item.maxX : item.maxY) : (vertical ? item.minX : item.minY);
    for (let shift = -2; shift <= inset; shift += 1) for (let lift = -2; lift <= 2; lift += 2) {
      const hingeAlong = endAlong + endSign * shift, hingeAcross = faceAcross + sideSign * lift;
      for (let radius = Math.round(along * 0.6); radius <= Math.round(along * 1.05); radius += 1) {
        let drawn = 0, samples = 0;
        // No better than what is already found once more points are missing than that allows.
        const allowed = Math.floor(23 * (1 - best));
        for (let degrees = 12; degrees <= 78 && samples - drawn <= allowed; degrees += 3) {
          const angle = degrees * Math.PI / 180;
          const a = hingeAlong + endSign * radius * Math.cos(angle), c = hingeAcross + sideSign * radius * Math.sin(angle);
          samples += 1;
          if (inkNear(vertical ? c : a, vertical ? a : c)) drawn += 1;
        }
        if (samples < 23) continue;
        // Every radius that fits equally well is kept: the line has width, so several do.
        if (drawn / samples > best) { best = drawn / samples; radii = [radius]; } else if (drawn / samples === best) radii.push(radius);
      }
    }
  }
  radii.sort((a, b) => a - b);
  return { share: best, radius: radii.length ? radii[radii.length >> 1] : 0 };
}

// Walls drawn at 45 degrees. The sheet is re-indexed along its diagonals (no resampling: a pixel's
// diagonal and its place along it are exact), where such a wall is an ordinary horizontal band,
// and the same paired-face test is applied. `mirror` takes the other diagonal direction.
// Returns runs as { pixels, a, b, lengthPx, thicknessPx } in raster coordinates.
function diagonalWallRuns(ink, width, height, bounds, mirror, { tMin, tMax, strictLen, maxLine, minLen }) {
  const w = bounds.x1 - bounds.x0 + 1, h = bounds.y1 - bounds.y0 + 1;
  const rw = (w + h + 2) >> 1, rh = w + h;
  const rot = new Uint8Array(rw * rh);
  // Local pixel (x, y) lies on diagonal v = y - x + (w - 1), at place u = (x + y) >> 1 along it.
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    if (!ink[(bounds.y0 + y) * width + bounds.x0 + (mirror ? w - 1 - x : x)]) continue;
    rot[(y - x + w - 1) * rw + ((x + y) >> 1)] = 1;
  }
  // A line that has been resampled (a page stored at another resolution) steps between two
  // neighbouring diagonals and drops single pixels: each diagonal takes its neighbours' ink where
  // it has none of its own between two inked places, so the run stays whole.
  for (let v = 1; v < rh - 1; v += 1) for (let u = 1; u < rw - 1; u += 1) {
    const p = v * rw + u;
    if (rot[p]) continue;
    if ((rot[p - 1] & 1) && (rot[p + 1] & 1)) rot[p] = 2;
    else if (((rot[p - rw] & 1) || (rot[p + rw] & 1)) && ((rot[p - 1] & 1) || (rot[p + 1] & 1))) rot[p] = 2;
  }
  const root2 = Math.SQRT2;
  const lengths = runLengths(rot, rw, rh, false);
  const face = Math.max(8, Math.round(strictLen / root2));
  // Most sheets have few diagonal lines that long, and none is the usual answer.
  const window = { x0: rw, y0: rh, x1: -1, y1: -1 };
  for (let v = 0; v < rh; v += 1) for (let u = 0; u < rw; u += 1) if (lengths[v * rw + u] >= face) {
    if (u < window.x0) window.x0 = u; if (u > window.x1) window.x1 = u; if (v < window.y0) window.y0 = v; if (v > window.y1) window.y1 = v;
  }
  if (window.x1 < 0) return [];
  const pad = Math.ceil(tMax * root2) + 4;
  window.x0 = Math.max(0, window.x0 - pad); window.y0 = Math.max(0, window.y0 - pad); window.x1 = Math.min(rw - 1, window.x1 + pad); window.y1 = Math.min(rh - 1, window.y1 + pad);
  const band = wallBands(rot, lengths, face, face, rw, rh, false, tMin * root2, tMax * root2, Math.ceil(maxLine * root2) + 1, window);
  const { labels, components } = labelComponents((p) => (band[p] & 3) === 2, rw, rh, window);
  const back = (u, v) => {
    // Inverse of the indexing above; of the two pixels sharing (u, v) parity picks the real one.
    const d = v - (w - 1);
    let sum = 2 * u; if (((sum + d) & 1) !== 0) sum += 1;
    const x = (sum - d) / 2, y = (sum + d) / 2;
    return { x: bounds.x0 + (mirror ? w - 1 - x : x), y: bounds.y0 + y };
  };
  const runs = [];
  for (const item of components) {
    if (!item) continue;
    const alongCells = item.maxX - item.minX + 1, acrossCells = item.maxY - item.minY + 1;
    const lengthPx = alongCells * root2;
    if (lengthPx < minLen) continue;
    const thicknessPx = item.area / alongCells / root2;
    // Not a diagonal wall if it is as wide as it is long (a filled patch) or far thicker than a wall.
    if (acrossCells / root2 > tMax * 1.3 || lengthPx < thicknessPx * 2.5) continue;
    const pixels = [];
    for (let v = item.minY; v <= item.maxY; v += 1) for (let u = item.minX; u <= item.maxX; u += 1) if (labels[v * rw + u] === item.id) pixels.push(back(u, v));
    const mid = (item.minY + item.maxY) / 2;
    runs.push({ pixels, a: back(item.minX, Math.round(mid)), b: back(item.maxX, Math.round(mid)), lengthPx, thicknessPx });
  }
  return runs;
}

// Walls at any other angle. The angle is read from the drawing: linework that is neither
// horizontal nor vertical is gathered, and a direction counts where two long parallel lines lie a
// wall's thickness apart along it (a Hough vote on line direction and offset). That part of the
// sheet is then turned so those lines are horizontal and measured exactly as an orthogonal wall is.
// Returns the same runs as diagonalWallRuns. Walls within a few degrees of horizontal or vertical
// are drawn as long level steps and are left to the orthogonal stage.
function angledWallRuns(ink, lengthH, lengthV, width, height, bounds, { tMin, tMax, strictLen, maxLine, minLen, minFace, skip = [45, 135], maxAngles = 4, maxPoints = 600000 }) {
  const w = bounds.x1 - bounds.x0 + 1, h = bounds.y1 - bounds.y0 + 1;
  const level = Math.max(16, Math.round(minFace / 3));
  const xs = [], ys = [];
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    const p = (bounds.y0 + y) * width + bounds.x0 + x;
    if (ink[p] && lengthH[p] < level && lengthV[p] < level) { xs.push(x); ys.push(y); }
  }
  if (xs.length < minFace * 2 || xs.length > maxPoints) return [];
  const reach = Math.ceil(Math.hypot(w, h)) + 2;
  const votes = new Int32Array(reach * 2 + 3);
  const paired = (degrees) => {
    const normal = (degrees + 90) * Math.PI / 180, c = Math.cos(normal), s = Math.sin(normal);
    votes.fill(0);
    for (let i = 0; i < xs.length; i += 1) votes[Math.round(xs[i] * c + ys[i] * s) + reach + 1] += 1;
    const lines = [];
    for (let r = 1; r < votes.length - 1; r += 1) {
      const count = votes[r] + Math.max(votes[r - 1], votes[r + 1]);
      if (count >= minFace && votes[r] >= votes[r - 1] && votes[r] >= votes[r + 1]) lines.push({ r, count });
    }
    let best = 0;
    for (let i = 0; i < lines.length; i += 1) for (let j = i + 1; j < lines.length && lines[j].r - lines[i].r <= tMax + 2; j += 1) {
      if (lines[j].r - lines[i].r >= tMin - 1) best = Math.max(best, Math.min(lines[i].count, lines[j].count));
    }
    return best;
  };
  const found = [];
  for (let degrees = 6; degrees <= 174; degrees += 0.5) {
    if (Math.abs(degrees - 90) < 6 || skip.some((angle) => Math.abs(degrees - angle) < 2)) continue;
    const score = paired(degrees);
    if (score) found.push({ degrees, score });
  }
  found.sort((a, b) => b.score - a.score);
  const angles = [];
  for (const item of found) {
    if (angles.length >= maxAngles) break;
    if (angles.some((kept) => Math.abs(kept - item.degrees) < 6)) continue;
    // The exact direction is where the votes are most concentrated: every pixel of a line then falls on one offset.
    let best = { degrees: item.degrees, sharp: 0 };
    for (let degrees = item.degrees - 0.6; degrees <= item.degrees + 0.601; degrees += 0.05) {
      if (!paired(degrees)) continue;
      let sharp = 0;
      for (let r = 0; r < votes.length; r += 1) sharp += votes[r] * votes[r];
      if (sharp > best.sharp) best = { degrees, sharp };
    }
    angles.push(best.degrees);
  }
  const runs = [];
  const cx = w / 2, cy = h / 2, side = reach + 1, size = side * 2 + 1;
  for (const degrees of angles) {
    const turn = degrees * Math.PI / 180, c = Math.cos(turn), s = Math.sin(turn);
    // (u, v) in the turned sheet is (x, y) = centre + u * (c, s) + v * (-s, c) in this one.
    const turned = new Uint8Array(size * size);
    for (let v = -side; v <= side; v += 1) for (let u = -side; u <= side; u += 1) {
      const x = Math.round(cx + u * c - v * s), y = Math.round(cy + u * s + v * c);
      if (x >= 0 && y >= 0 && x < w && y < h && ink[(bounds.y0 + y) * width + bounds.x0 + x]) turned[(v + side) * size + u + side] = 1;
    }
    // Turning a thin line drops single pixels along it.
    for (let p = 1; p < turned.length - 1; p += 1) if (!turned[p] && (turned[p - 1] & 1) && (turned[p + 1] & 1)) turned[p] = 2;
    // A turned line wanders a pixel either side of level. Thickened by a pixel each way it has an
    // unbroken level run through it, which is what a face is measured by.
    const source = turned.slice();
    for (let p = size; p < turned.length - size; p += 1) if (!source[p] && (source[p - size] || source[p + size])) turned[p] = 2;
    const lengths = runLengths(turned, size, size, false);
    // A face is as long as the longest level run anywhere through its thickness, not only along its edge.
    for (let u = 0; u < size; u += 1) for (let v = 0; v < size; v += 1) {
      if (!turned[v * size + u]) continue;
      let end = v, longest = 0;
      while (end < size && turned[end * size + u]) { if (lengths[end * size + u] > longest) longest = lengths[end * size + u]; end += 1; }
      for (let row = v; row < end; row += 1) lengths[row * size + u] = longest;
      v = end;
    }
    const window = { x0: size, y0: size, x1: -1, y1: -1 };
    for (let v = 0; v < size; v += 1) for (let u = 0; u < size; u += 1) if (lengths[v * size + u] >= strictLen) {
      if (u < window.x0) window.x0 = u; if (u > window.x1) window.x1 = u; if (v < window.y0) window.y0 = v; if (v > window.y1) window.y1 = v;
    }
    if (window.x1 < 0) continue;
    const pad = Math.ceil(tMax) + 4;
    window.x0 = Math.max(0, window.x0 - pad); window.y0 = Math.max(0, window.y0 - pad); window.x1 = Math.min(size - 1, window.x1 + pad); window.y1 = Math.min(size - 1, window.y1 + pad);
    const band = wallBands(turned, lengths, strictLen, strictLen, size, size, false, tMin, tMax + 2, maxLine + 4, window);
    const { labels, components } = labelComponents((p) => (band[p] & 3) === 2, size, size, window);
    const back = (u, v) => ({ x: bounds.x0 + Math.round(cx + (u - side) * c - (v - side) * s), y: bounds.y0 + Math.round(cy + (u - side) * s + (v - side) * c) });
    for (const item of components) {
      if (!item) continue;
      const lengthPx = item.maxX - item.minX + 1, across = item.maxY - item.minY + 1;
      if (lengthPx < minLen || across > tMax * 1.3) continue;
      const thicknessPx = Math.max(tMin, item.area / lengthPx - 2);   // less the pixel each face was thickened by
      if (lengthPx < thicknessPx * 2.5) continue;
      const seen = new Set(), pixels = [];
      for (let v = item.minY; v <= item.maxY; v += 1) for (let u = item.minX; u <= item.maxX; u += 1) {
        if (labels[v * size + u] !== item.id) continue;
        const point = back(u, v);
        if (point.x < 0 || point.y < 0 || point.x >= width || point.y >= height) continue;
        const key = point.y * width + point.x;
        if (!seen.has(key)) { seen.add(key); pixels.push(point); }
      }
      const mid = (item.minY + item.maxY) / 2;
      runs.push({ pixels, a: back(item.minX, Math.round(mid)), b: back(item.maxX, Math.round(mid)), lengthPx, thicknessPx, degrees });
    }
  }
  return runs;
}

// A door drawn closed lies in its wall's line, so there is no gap to find: only its swing, a quarter
// circle hinged on the wall's face with the leaf along the wall. Looks along both faces of one wall
// run. Returns [{ along, across, direction, side, radius, share }] in raster pixels.
function closedDoorSwings(inkFat, width, height, item, vertical, minRadius, maxRadius, needShare) {
  const low = vertical ? item.minY : item.minX, high = vertical ? item.maxY : item.maxX;
  const faces = [[vertical ? item.minX : item.minY, -1], [vertical ? item.maxX : item.maxY, 1]];
  const at = (a, c) => { const x = Math.round(vertical ? c : a), y = Math.round(vertical ? a : c); return x >= 1 && y >= 1 && x < width - 1 && y < height - 1 ? y * width + x : -1; };
  const inkNear = (a, c) => { const p = at(a, c); return p >= 0 && inkFat[p] === 1; };
  const found = [];
  const thickness = Math.abs(faces[1][0] - faces[0][0]);
  for (const [edge, side] of faces) for (let inset = 0; inset <= thickness; inset += 2) for (const direction of [1, -1]) {
    const face = edge - side * inset;
    for (let hinge = low; hinge <= high; hinge += 2) {
      for (let radius = minRadius; radius <= maxRadius; radius += 1) {
        // The leaf has to lie along this wall, and the middle of the swing has to be drawn.
        const leafEnd = hinge + direction * radius;
        if (leafEnd < low - 3 || leafEnd > high + 3) break;
        if (!inkNear(hinge + direction * radius * 0.7071, face + side * (1 + radius * 0.7071))) continue;
        let drawn = 0, samples = 0, missed = 0;
        for (let degrees = 12; degrees <= 78 && missed <= 2; degrees += 3) {
          const angle = degrees * Math.PI / 180;
          samples += 1;
          if (inkNear(hinge + direction * radius * Math.cos(angle), face + side * (1 + radius * Math.sin(angle)))) drawn += 1; else missed += 1;
        }
        if (missed > 2 || drawn / 23 < needShare) continue;
        // A door's swing is a quarter circle and no more: a basin, a pan, a column or hatching carries on round.
        let beyond = 0;
        for (const degrees of [-18, -12, -6, 96, 102, 108]) {
          const angle = degrees * Math.PI / 180;
          if (inkNear(hinge + direction * radius * Math.cos(angle), face + side * (1 + radius * Math.sin(angle)))) beyond += 1;
        }
        if (beyond > 2) continue;
        // And it is one thin line through clear floor: lettering, a cooktop or a bath has linework either side of it.
        let crowded = 0;
        for (let degrees = 12; degrees <= 78; degrees += 3) {
          const angle = degrees * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
          for (const offset of [-5, 5]) if (inkNear(hinge + direction * (radius + offset) * cos, face + side * (1 + (radius + offset) * sin))) crowded += 1;
        }
        if (crowded > 46 * 0.3) continue;
        found.push({ along: hinge + direction * radius / 2, across: face, direction, side, radius, share: drawn / 23, hinge });
      }
    }
  }
  // One door per place: the best-drawn arc among those that overlap.
  found.sort((a, b) => b.share - a.share);
  const kept = [];
  for (const swing of found) if (!kept.some((other) => Math.abs(other.along - swing.along) < (other.radius + swing.radius) / 2)) kept.push(swing);
  return kept;
}

// Boundary of a labelled region as a closed polygon on pixel corners, region on the right.
function traceBoundary(labels, width, height, id, seed) {
  const inside = (x, y) => x >= 0 && y >= 0 && x < width && y < height && labels[y * width + x] === id;
  const sx = seed % width, sy = (seed - sx) / width;
  const dx = [1, 0, -1, 0], dy = [0, 1, 0, -1];
  const right = [[0, 0], [-1, 0], [-1, -1], [0, -1]], left = [[0, -1], [0, 0], [-1, 0], [-1, -1]];
  const points = [];
  let x = sx, y = sy, d = 0;
  // The seed is the region's first pixel in scan order, so its top-left corner is a boundary
  // corner and the walk ends when it is about to leave that corner eastwards a second time.
  const limit = 4 * (width + height) + 16 * width;
  for (let n = 0; n < limit * 64; n += 1) {
    let next = d;
    if (!inside(x + right[d][0], y + right[d][1])) next = (d + 1) % 4;
    else if (inside(x + left[d][0], y + left[d][1])) next = (d + 3) % 4;
    if (next !== d) { points.push({ x, y }); d = next; }
    if (n > 0 && x === sx && y === sy && d === 0) return points;
    if (!inside(x + right[d][0], y + right[d][1])) continue;
    x += dx[d]; y += dy[d];
  }
  return [];
}

function simplifyClosed(points, tolerance) {
  if (points.length < 4) return points;
  const distance = (p, a, b) => {
    const vx = b.x - a.x, vy = b.y - a.y, length = vx * vx + vy * vy;
    const t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / length)) : 0;
    return Math.hypot(a.x + t * vx - p.x, a.y + t * vy - p.y);
  };
  const reduce = (list) => {
    if (list.length < 3) return list;
    let worst = 0, index = 0;
    for (let i = 1; i < list.length - 1; i += 1) { const d = distance(list[i], list[0], list[list.length - 1]); if (d > worst) { worst = d; index = i; } }
    if (worst <= tolerance) return [list[0], list[list.length - 1]];
    return [...reduce(list.slice(0, index + 1)).slice(0, -1), ...reduce(list.slice(index))];
  };
  // Split at the two mutually farthest-ish vertices so both halves have fixed ends.
  let far = 0, best = -1;
  points.forEach((p, i) => { const d = Math.hypot(p.x - points[0].x, p.y - points[0].y); if (d > best) { best = d; far = i; } });
  const first = reduce(points.slice(0, far + 1)), second = reduce([...points.slice(far), points[0]]);
  const merged = [...first.slice(0, -1), ...second.slice(0, -1)];
  // Square up edges that are within the tolerance of horizontal or vertical.
  for (let i = 0; i < merged.length; i += 1) {
    const a = merged[i], b = merged[(i + 1) % merged.length];
    if (Math.abs(a.x - b.x) <= tolerance && Math.abs(a.y - b.y) > tolerance * 3) { const x = (a.x + b.x) / 2; a.x = x; b.x = x; }
    else if (Math.abs(a.y - b.y) <= tolerance && Math.abs(a.x - b.x) > tolerance * 3) { const y = (a.y + b.y) / 2; a.y = y; b.y = y; }
  }
  return merged.filter((p, i) => { const q = merged[(i + 1) % merged.length]; return Math.hypot(p.x - q.x, p.y - q.y) > 0.01; });
}

const shoelace = (polygon) => Math.abs(polygon.reduce((sum, p, i) => { const q = polygon[(i + 1) % polygon.length]; return sum + p.x * q.y - q.x * p.y; }, 0)) / 2;
const perimeterOf = (polygon) => polygon.reduce((sum, p, i) => { const q = polygon[(i + 1) % polygon.length]; return sum + Math.hypot(q.x - p.x, q.y - p.y); }, 0);

/**
 * An area drawn as an outline rather than enclosed by walls: an alfresco, a patio, a balcony.
 * Starting at `point` (logical pixels, anywhere inside it) the clear paper is filled out to the
 * solid lines round it. Dashed lines (a bulkhead or roof line overhead) do not stop it; lettering
 * inside it is part of it. Returns null when the outline is not closed (the fill reaches the edge
 * of the sheet or grows beyond `maxAreaM2`), so an open-sided area is never given a made-up edge.
 * @returns {{ polygon, areaM2, perimeterM } | null} in logical plan pixels
 */
export function traceOutlinedArea(raster, context, point, { inkThreshold = DEFAULT_GEOMETRY_OPTIONS.inkThreshold, maxAreaM2 = 150, minAreaM2 = 2, startReachMm = 400, simplifyPx = DEFAULT_GEOMETRY_OPTIONS.simplifyPx } = {}) {
  const { width, height, data } = raster;
  const { pixelsPerMm, logicalWidth, logicalHeight } = context;
  if (!(pixelsPerMm > 0) || !(width > 0 && height > 0) || !point) return null;
  const sx = width / logicalWidth, sy = height / logicalHeight, k = pixelsPerMm * sx;
  const inkAt = (p) => data[p * 4 + 3] > 127 && data[p * 4] + data[p * 4 + 1] + data[p * 4 + 2] < inkThreshold;
  // A line stops the fill with a pixel to spare each side, so a one-pixel break in it does not leak.
  const blocked = (x, y) => { const p = y * width + x; return inkAt(p) || (x > 0 && inkAt(p - 1)) || (x < width - 1 && inkAt(p + 1)) || (y > 0 && inkAt(p - width)) || (y < height - 1 && inkAt(p + width)); };
  let startX = Math.round(point.x * sx), startY = Math.round(point.y * sy);
  if (startX < 1 || startY < 1 || startX >= width - 1 || startY >= height - 1) return null;
  // The name may be read on top of its own lettering: begin on the nearest clear paper.
  if (blocked(startX, startY)) {
    const reach = Math.round(startReachMm * k);
    let best = null;
    for (let r = 2; r <= reach && !best; r += 2) for (let a = 0; a < 16 && !best; a += 1) {
      const x = Math.round(startX + r * Math.cos(a * Math.PI / 8)), y = Math.round(startY + r * Math.sin(a * Math.PI / 8));
      if (x >= 1 && y >= 1 && x < width - 1 && y < height - 1 && !blocked(x, y)) best = { x, y };
    }
    if (!best) return null;
    startX = best.x; startY = best.y;
  }
  const limit = Math.ceil(maxAreaM2 * 1e6 * k * k);
  const labels = new Int32Array(width * height);
  const stack = [startY * width + startX];
  labels[stack[0]] = 1;
  let area = 0, seed = stack[0];
  while (stack.length) {
    const p = stack.pop();
    area += 1;
    if (area > limit) return null;
    if (p < seed) seed = p;
    const x = p % width, y = (p - x) / width;
    if (x === 0 || y === 0 || x === width - 1 || y === height - 1) return null;
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      const q = ny * width + nx;
      if (!labels[q] && !blocked(nx, ny)) { labels[q] = 1; stack.push(q); }
    }
  }
  const boundary = simplifyClosed(traceBoundary(labels, width, height, 1, seed), simplifyPx);
  if (boundary.length < 3) return null;
  const polygon = boundary.map((p) => ({ x: p.x / sx, y: p.y / sy }));
  const areaM2 = shoelace(polygon) / (pixelsPerMm * pixelsPerMm) / 1e6;
  if (areaM2 < minAreaM2 || areaM2 > maxAreaM2) return null;
  return { polygon, areaM2, perimeterM: perimeterOf(polygon) / pixelsPerMm / 1000 };
}

/**
 * @param raster { width, height, data } RGBA pixels of the whole sheet
 * @param context { pixelsPerMm, logicalWidth, logicalHeight, openingEvidence? } the sheet's confirmed
 *   calibration, and where openings are known to be ([{ x, y, ref? }] in logical pixels)
 * @returns {{ walls, openings, rooms, diagnostics, debug }} in logical plan pixels
 */
export function detectPlanGeometry(raster, context, overrides = {}) {
  const options = { ...DEFAULT_GEOMETRY_OPTIONS, ...overrides };
  const { width, height, data } = raster;
  const { pixelsPerMm, logicalWidth, logicalHeight } = context;
  if (!(pixelsPerMm > 0)) throw new Error('Plan geometry needs the sheet\'s confirmed calibration.');
  if (!(width > 0 && height > 0 && logicalWidth > 0 && logicalHeight > 0)) throw new Error('Plan geometry needs the sheet image and its logical size.');
  const sx = width / logicalWidth, sy = height / logicalHeight;
  const k = pixelsPerMm * sx;                       // raster pixels per millimetre
  const px = (mm) => mm * k;
  const toLogical = (x, y) => ({ x: x / sx, y: y / sy });
  const diagnostics = [];
  if (Math.abs(sx - sy) / sx > 0.01) diagnostics.push({ code: 'anisotropic-raster', message: 'The sheet image is not uniformly scaled; measurements need review.' });
  if (px(90) < 4) diagnostics.push({ code: 'low-resolution', message: `A 90 mm wall is only ${px(90).toFixed(1)} pixels wide in this sheet image; thin walls cannot be separated reliably.` });

  const ink = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < ink.length; i += 1, p += 4) ink[i] = data[p + 3] > 127 && data[p] + data[p + 1] + data[p + 2] < options.inkThreshold ? 1 : 0;
  // Linework thickened by a pixel each way, for tests that ask "is a line drawn about here".
  const inkFat = new Uint8Array(width * height);
  for (let y = 1; y < height - 1; y += 1) for (let x = 1; x < width - 1; x += 1) {
    const p = y * width + x;
    if (ink[p] || ink[p - 1] || ink[p + 1] || ink[p - width] || ink[p + width] || ink[p - width - 1] || ink[p - width + 1] || ink[p + width - 1] || ink[p + width + 1]) inkFat[p] = 1;
  }
  const tMin = px(options.minWallMm), tMax = px(options.maxWallMm);
  const strictLen = Math.max(12, Math.round(px(options.faceRunMm))), nibLen = Math.max(6, Math.round(px(options.nibRunMm)));
  const returnLen = Math.min(nibLen, Math.max(6, Math.round(px(options.jambReturnRunMm))));
  const lengthH = runLengths(ink, width, height, false), lengthV = runLengths(ink, width, height, true);
  const reviewFaceH = longRuns(ink, width, height, strictLen, false, 1), reviewFaceV = longRuns(ink, width, height, strictLen, true, 1);
  const bandH = wallBands(ink, lengthH, strictLen, nibLen, width, height, false, tMin, tMax, options.maxLinePx);
  const bandV = wallBands(ink, lengthV, strictLen, nibLen, width, height, true, tMin, tMax, options.maxLinePx);
  // Each stage has its own evidence threshold: wall fabric needs faces of nibRunMm, but the short
  // return beside a door is still a wall end when it continues an established wall's two faces.
  if (returnLen < nibLen) {
    const reach = Math.round(px(options.collinearGapMm));
    const looseH = wallBands(ink, lengthH, strictLen, returnLen, width, height, false, tMin, tMax, options.maxLinePx);
    const looseV = wallBands(ink, lengthV, strictLen, returnLen, width, height, true, tMin, tMax, options.maxLinePx);
    const returns = admitAlignedReturns(bandH, looseH, bandV, width, height, false, reach) + admitAlignedReturns(bandV, looseV, bandH, width, height, true, reach);
    if (returns) diagnostics.push({ code: 'jamb-returns', message: 'Short wall returns were kept because they continue an established wall.' });
  }

  // Keep only wall fabric that contains established faces; lettering and symbols do not.
  const full = { x0: 0, y0: 0, x1: width - 1, y1: height - 1 };
  const raw = labelComponents((p) => bandH[p] || bandV[p], width, height, full);
  const strictCount = new Int32Array(raw.components.length);
  for (let p = 0; p < raw.labels.length; p += 1) if (raw.labels[p] && ((bandH[p] & 3) === 2 || (bandV[p] & 3) === 2)) strictCount[raw.labels[p]] += 1;
  // Wall fabric is broken into pieces by door gaps and junctions. Pieces that sit together form
  // one drawing; the building is the drawing with the most established wall in it, so pairs of
  // lines elsewhere on the sheet (title block, legend, details) are left out.
  const gap = (a, b) => Math.max(0, a.minX - b.maxX, b.minX - a.maxX, a.minY - b.maxY, b.minY - a.maxY);
  const pieces = raw.components.filter((item) => item && item.area >= 12);
  const established = pieces.filter((item) => strictCount[item.id] > 0);
  const parent = new Map(established.map((item) => [item.id, item.id]));
  const find = (id) => { while (parent.get(id) !== id) { parent.set(id, parent.get(parent.get(id))); id = parent.get(id); } return id; };
  const link = px(1600);
  for (let i = 0; i < established.length; i += 1) for (let j = i + 1; j < established.length; j += 1) {
    if (gap(established[i], established[j]) <= link) parent.set(find(established[i].id), find(established[j].id));
  }
  const drawings = new Map();
  const pieceCap = px(4000) * tMin;
  for (const item of established) {
    const root = find(item.id);
    const drawing = drawings.get(root) || { strict: 0, weight: 0, minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
    drawing.strict += strictCount[item.id];
    // A building is many walls; a title block or border is a few long double rules. No one piece
    // counts for more than a few metres of wall, so a border cannot outweigh a house.
    drawing.weight += Math.min(strictCount[item.id], pieceCap);
    drawing.minX = Math.min(drawing.minX, item.minX); drawing.maxX = Math.max(drawing.maxX, item.maxX);
    drawing.minY = Math.min(drawing.minY, item.minY); drawing.maxY = Math.max(drawing.maxY, item.maxY);
    drawings.set(root, drawing);
  }
  let building = null, buildingRoot = null;
  for (const [root, drawing] of drawings) if (!building || drawing.weight > building.weight) { building = drawing; buildingRoot = root; }
  if (!building || building.strict < px(3000) * tMin) return { walls: [], openings: [], rooms: [], diagnostics: [...diagnostics, { code: 'no-walls', message: 'No wall linework was found on this sheet at the confirmed calibration.' }], engine: GEOMETRY_ENGINE_VERSION };
  const keep = new Uint8Array(raw.components.length);
  for (const item of established) if (find(item.id) === buildingRoot) keep[item.id] = 1;
  // Short nibs and returns have no established face of their own; they count only where they
  // touch established wall.
  const kept = established.filter((item) => keep[item.id]);
  for (const item of pieces) {
    if (strictCount[item.id] > 0 || item.maxX < building.minX || item.minX > building.maxX || item.maxY < building.minY || item.minY > building.maxY) continue;
    if (kept.some((other) => gap(item, other) <= 3)) keep[item.id] = 1;
  }
  const margin = Math.round(px(2500));
  const bounds = { x0: Math.max(0, building.minX - margin), y0: Math.max(0, building.minY - margin), x1: Math.min(width - 1, building.maxX + margin), y1: Math.min(height - 1, building.maxY + margin) };
  const wall = new Uint8Array(width * height);
  for (let p = 0; p < wall.length; p += 1) {
    if (!keep[raw.labels[p]]) { bandH[p] = 0; bandV[p] = 0; } else wall[p] = 1;
  }

  // A short strip of paired lines that joins no other wall is joinery, a dimension or a symbol.
  // It is removed before gaps are looked for, so nothing is ever closed towards it.
  for (const [band, other, vertical] of [[bandH, bandV, false], [bandV, bandH, true]]) {
    const { labels, components } = labelComponents((p) => band[p] > 0, width, height, bounds);
    const drop = new Uint8Array(components.length);
    for (const item of components) {
      if (!item) continue;
      const along = vertical ? item.maxY - item.minY + 1 : item.maxX - item.minX + 1;
      if (along / k >= options.isolatedRunMm) continue;
      const probe = Math.max(3, Math.round(px(120)));
      let joined = false;
      for (let y = Math.max(0, item.minY - probe); y <= Math.min(height - 1, item.maxY + probe) && !joined; y += 1) {
        for (let x = Math.max(0, item.minX - probe); x <= Math.min(width - 1, item.maxX + probe); x += 1) {
          const p = y * width + x;
          if (wall[p] && labels[p] !== item.id) { joined = true; break; }
        }
      }
      if (joined) continue;
      drop[item.id] = 1;
      diagnostics.push({ code: 'isolated-linework', lengthMm: Math.round(along / k), message: 'Paired linework that joins no wall was not taken as a wall.', at: { x: (item.minX + item.maxX) / 2 / sx, y: (item.minY + item.maxY) / 2 / sy } });
    }
    for (let p = 0; p < labels.length; p += 1) if (labels[p] && drop[labels[p]]) { band[p] = 0; if (!other[p]) wall[p] = 0; }
  }

  // Long single faces are only surfaced for review when both ends meet paired, orthogonal wall
  // fabric and those junctions imply a consistent thickness. They are not measured walls.
  const singleFaceReviewCandidates = [];
  const singleFaceDebug = { vertical: [], horizontal: [] };
  for (const { face, anchorBand, perpendicularFace, vertical } of [
    { face: reviewFaceV, anchorBand: bandH, perpendicularFace: reviewFaceH, vertical: true },
    { face: reviewFaceH, anchorBand: bandV, perpendicularFace: reviewFaceV, vertical: false },
  ]) {
    const { labels, components } = labelComponents((p) => face[p] && !wall[p], width, height, bounds);
    for (const item of components) {
      if (!item) continue;
      const alongPx = vertical ? item.maxY - item.minY + 1 : item.maxX - item.minX + 1;
      const crossPx = vertical ? item.maxX - item.minX + 1 : item.maxY - item.minY + 1;
      if (alongPx < px(options.singleFaceReviewRunMm)) continue;
      const centre = vertical ? (item.minX + item.maxX) / 2 : (item.minY + item.maxY) / 2;
      const ends = vertical ? [item.minY, item.maxY] : [item.minX, item.maxX];
      const probe = Math.round(px(options.singleFaceAnchorReachMm));
      const anchorThickness = (end) => {
        let best = null;
        const y0 = Math.max(bounds.y0, Math.ceil(vertical ? end - probe : centre - probe));
        const y1 = Math.min(bounds.y1, Math.floor(vertical ? end + probe : centre + probe));
        const x0 = Math.max(bounds.x0, Math.ceil(vertical ? centre - probe : end - probe));
        const x1 = Math.min(bounds.x1, Math.floor(vertical ? centre + probe : end + probe));
        for (let y = y0; y <= y1; y += 1) {
          for (let x = x0; x <= x1; x += 1) {
            const p = y * width + x;
            if (!anchorBand[p] || !wall[p]) continue;
            const distance = Math.hypot(x - (vertical ? centre : end), y - (vertical ? end : centre));
            if (!best || distance < best.distance) best = { x, y, distance };
          }
        }
        if (!best) return null;
        const p = best.y * width + best.x;
        let low = 0, high = 0;
        const crossStep = vertical ? width : 1;
        while (low < tMax && anchorBand[p - (low + 1) * crossStep]) low += 1;
        while (high < tMax && anchorBand[p + (high + 1) * crossStep]) high += 1;
        const thicknessMm = (low + high + 1) / k;
        return thicknessMm >= options.minWallMm && thicknessMm <= options.maxWallMm ? { thicknessMm, at: { x: best.x, y: best.y }, low, high } : null;
      };
      const anchors = ends.map(anchorThickness);
      const thicknesses = anchors.map((anchor) => anchor?.thicknessMm ?? null);
      singleFaceDebug[vertical ? 'vertical' : 'horizontal'].push({ bounds: { minX: item.minX, maxX: item.maxX, minY: item.minY, maxY: item.maxY },
        lengthMm: alongPx / k, crossPx, rejectedAsWide: crossPx > options.maxLinePx + 3, thicknesses });
      if (crossPx > options.maxLinePx + 3) continue;
      const orthogonalFaceAtEnd = (end) => {
        const reach = Math.max(2, Math.round(px(options.singleFaceJunctionReachMm)));
        for (let y = Math.max(bounds.y0, vertical ? end - reach : centre - reach); y <= Math.min(bounds.y1, vertical ? end + reach : centre + reach); y += 1) {
          for (let x = Math.max(bounds.x0, vertical ? centre - reach : end - reach); x <= Math.min(bounds.x1, vertical ? centre + reach : end + reach); x += 1) {
            if (perpendicularFace[y * width + x]) return true;
          }
        }
        return false;
      };
      const endpointFaceSupport = ends.map((end, index) => thicknesses[index] !== null || orthogonalFaceAtEnd(end));
      const pairedThicknesses = thicknesses.filter((value) => value !== null);
      singleFaceDebug[vertical ? 'vertical' : 'horizontal'].push({ bounds: { minX: item.minX, maxX: item.maxX, minY: item.minY, maxY: item.maxY },
        lengthMm: alongPx / k, crossPx, rejectedAsWide: crossPx > options.maxLinePx + 3, thicknesses, endpointFaceSupport });
      if (pairedThicknesses.length === 0 || !endpointFaceSupport.some(Boolean)) continue;
      if (pairedThicknesses.length === 2 && Math.abs(pairedThicknesses[0] - pairedThicknesses[1]) > options.singleFaceThicknessAgreementMm) continue;
      const start = vertical ? toLogical(centre, item.minY) : toLogical(item.minX, centre);
      const end = vertical ? toLogical(centre, item.maxY + 1) : toLogical(item.maxX + 1, centre);
      singleFaceReviewCandidates.push({
        id: `g-review-${vertical ? 'v' : 'h'}-${Math.round(start.x * 10)}-${Math.round(start.y * 10)}`,
        axis: vertical ? 'v' : 'h', nodes: [start, end], lengthMm: alongPx / k,
        endpointAnchorThicknessesMm: thicknesses.map((value) => value === null ? null : Math.round(value)),
        endpointFaceSupport,
        reviewRequired: true,
        reviewReason: 'Only one wall face was visible; endpoint junctions support continuity, but this run has no measured wall thickness. Verify manually before measuring.',
      });
    }
  }

  // Walls at 45 degrees join the fabric before gaps are looked for, so wall ends close towards them
  // and rooms are enclosed by them. One is kept only where it meets wall already found.
  const diagonal = new Uint8Array(width * height);
  const diagonalRuns = [];
  if (options.diagonalWalls) {
    const joinReach = Math.max(4, Math.round(px(options.diagonalJoinMm)));
    const meetsWall = (point) => {
      for (let dy = -joinReach; dy <= joinReach; dy += 1) for (let dx = -joinReach; dx <= joinReach; dx += 1) {
        const x = Math.round(point.x) + dx, y = Math.round(point.y) + dy;
        if (x >= 0 && y >= 0 && x < width && y < height && wall[y * width + x] && !diagonal[y * width + x]) return true;
      }
      return false;
    };
    const slanted = [];
    for (const mirror of [false, true]) slanted.push(...diagonalWallRuns(ink, width, height, bounds, mirror, { tMin, tMax, strictLen, maxLine: options.maxLinePx, minLen: px(options.diagonalMinMm) }));
    const fortyFive = slanted.length;
    if (options.angledWalls) slanted.push(...angledWallRuns(ink, lengthH, lengthV, width, height, bounds, { tMin, tMax, strictLen, maxLine: options.maxLinePx, minLen: px(options.diagonalMinMm), minFace: Math.round(px(options.angledFaceMm)) }));
    {
      // One wall is measured once: a run lying along one already taken (the same two lines read at a
      // slightly different angle) is not a second wall.
      const taken = new Uint8Array(width * height);
      for (const [index, run] of slanted.entries()) {
        if (index >= fortyFive) run.angled = true;
        // Mostly new fabric: a strip lying along wall already found is that wall's own hatching.
        const fresh = run.pixels.filter((point) => !wall[point.y * width + point.x] && !taken[point.y * width + point.x]).length;
        if (fresh < run.pixels.length * 0.6) continue;
        const joined = (meetsWall(run.a) ? 1 : 0) + (meetsWall(run.b) ? 1 : 0);
        if (joined === 0) { diagnostics.push({ code: 'isolated-linework', lengthMm: Math.round(run.lengthPx / k), message: 'Paired diagonal linework that joins no wall was not taken as a wall.', at: toLogical((run.a.x + run.b.x) / 2, (run.a.y + run.b.y) / 2) }); continue; }
        diagonalRuns.push({ ...run, joined });
        for (const point of run.pixels) taken[point.y * width + point.x] = 1;
      }
    }
    for (const run of diagonalRuns) for (const point of run.pixels) {
      const p = point.y * width + point.x;
      wall[p] = 1; diagonal[p] = 1;
      // A diagonal chain of pixels is sealed against four-way filling.
      if (point.x + 1 < width) { wall[p + 1] = 1; diagonal[p + 1] = 1; }
      if (run.angled && point.y + 1 < height) { wall[p + width] = 1; diagonal[p + width] = 1; }
    }
    const atAngle = diagonalRuns.filter((run) => run.angled).length;
    if (diagonalRuns.length - atAngle) diagnostics.push({ code: 'diagonal-walls', message: `${diagonalRuns.length - atAngle} wall${diagonalRuns.length - atAngle === 1 ? '' : 's'} drawn at 45 degrees ${diagonalRuns.length - atAngle === 1 ? 'was' : 'were'} measured.` });
    if (atAngle) diagnostics.push({ code: 'angled-walls', angles: [...new Set(diagonalRuns.filter((run) => run.angled).map((run) => +run.degrees.toFixed(1)))], message: `${atAngle} wall${atAngle === 1 ? '' : 's'} drawn at an angle ${atAngle === 1 ? 'was' : 'were'} measured.` });
  }

  const bridge = new Uint8Array(width * height);
  // Where a gap lies between two ends of one wall (the same two faces either side of it).
  const alignedGap = new Uint8Array(width * height);
  bridgeGaps(bandH, wall, bridge, width, height, false, Math.round(px(options.doorGapMm)), Math.round(px(options.collinearGapMm)), Math.round(px(options.minOpeningMm)), Math.ceil(tMin), diagonalRuns.length ? diagonal : null, Math.round(px(options.diagonalSideReachMm)), alignedGap);
  bridgeGaps(bandV, wall, bridge, width, height, true, Math.round(px(options.doorGapMm)), Math.round(px(options.collinearGapMm)), Math.round(px(options.minOpeningMm)), Math.ceil(tMin), diagonalRuns.length ? diagonal : null, Math.round(px(options.diagonalSideReachMm)), alignedGap);

  const evidence = (context.openingEvidence || []).filter((item) => Number.isFinite(item?.x) && Number.isFinite(item?.y));

  // Gaps: every closure is a CANDIDATE opening. A gap is treated as part of its wall only when it
  // is a junction-sized break in one wall, or something says an opening is there (a door or window
  // the estimator placed, or one the plan reading located). Nothing is closed merely because it
  // would complete a room.
  const openings = [];
  const closed = new Uint8Array(width * height);
  const fabric0 = (p) => wall[p] || closed[p];
  const openingGap = new Uint8Array(width * height);
  // Evidence is matched to candidates one to one. A located opening (the estimator's, or one the
  // plan reading placed precisely) confirms the candidate it lies on. One located only roughly
  // (reachMm given) confirms a candidate further away only when nothing nearer claims it and, where
  // both widths are known, the widths agree.
  const usedEvidence = new Set();
  const claim = (centre, widthMm, kind) => {
    const preciseReach = Math.max(options.evidenceReachMm, widthMm * 0.6) * pixelsPerMm;
    let best = null;
    evidence.forEach((point, index) => {
      if (usedEvidence.has(index)) return;
      const distance = Math.hypot(point.x - centre.x, point.y - centre.y);
      let allowed = distance <= preciseReach;
      // The widths an opening may have: its stated width, or either reading of its size code.
      const widths = [point.widthMm, ...(point.widths || [])].filter((value) => value > 0);
      const agrees = (tolerance, share) => widths.some((value) => Math.abs(value - widthMm) <= Math.max(tolerance, value * share));
      if (!allowed && (!point.kind || point.kind === kind)) {
        if (point.reachMm > 0 && distance <= point.reachMm * pixelsPerMm) allowed = !widths.length || agrees(150, 0.25);
        // Further away only on an exact width: the reading shifted the opening along its wall.
        else if (point.farReachMm > 0 && distance <= point.farReachMm * pixelsPerMm) allowed = widths.length > 0 && agrees(80, 0.06);
      }
      if (allowed && (!best || distance < best.distance)) best = { point, index, distance };
    });
    if (best && best.point.reachMm > 0) usedEvidence.add(best.index);
    return best;
  };
  const nearestEvidence = (centre) => evidence.reduce((least, point) => Math.min(least, Math.hypot(point.x - centre.x, point.y - centre.y)), Infinity);
  const gapSets = [];
  for (const value of [1, 2]) {
    const { labels, components } = labelComponents((p) => bridge[p] === value && !wall[p], width, height, bounds);
    const verdict = new Uint8Array(components.length);
    const candidates = [];
    for (const item of components) {
      if (!item) continue;
      const along = value === 2 ? item.maxY - item.minY + 1 : item.maxX - item.minX + 1;
      const across = value === 2 ? item.maxX - item.minX + 1 : item.maxY - item.minY + 1;
      const widthMm = along / k;
      const centre = toLogical((item.minX + item.maxX + 1) / 2, (item.minY + item.maxY + 1) / 2);
      if (widthMm < options.minOpeningMm) { verdict[item.id] = 1; continue; }
      if (across < tMin * 0.6) continue;
      // A door's swing drawn at the gap is the drawing itself saying this gap is a doorway.
      const swing = widthMm >= options.swingDoorMinMm && widthMm <= options.swingDoorMaxMm ? doorSwingShare(inkFat, width, height, item, value === 2) : { share: 0, radius: 0 };
      let alignedPixels = 0;
      for (let y = item.minY; y <= item.maxY; y += 1) for (let x = item.minX; x <= item.maxX; x += 1) { const p = y * width + x; if (labels[p] === item.id && alignedGap[p]) alignedPixels += 1; }
      const aligned = alignedPixels >= item.area * 0.6;
      // A gap wider than a doorway between two ends of one wall: what is drawn along it. A sliding
      // door's panels are lines from one end to the other; an open-plan opening has none, or a dashed
      // bulkhead line. Measured as the most-drawn line along the gap and its longest unbroken piece.
      let line = { share: 0, unbroken: 0 };
      if (aligned && widthMm > options.doorGapMm) {
        const vertical = value === 2;
        const c0 = vertical ? item.minX : item.minY, c1 = vertical ? item.maxX : item.maxY, a0 = vertical ? item.minY : item.minX;
        for (let c = c0; c <= c1; c += 1) {
          let count = 0, run = 0, longest = 0;
          for (let a = 0; a < along; a += 1) {
            const p = vertical ? (a0 + a) * width + c : c * width + a0 + a;
            if (ink[p]) { count += 1; run += 1; if (run > longest) longest = run; } else run = 0;
          }
          if (count > line.share * along) line = { share: count / along, unbroken: longest / along };
        }
      }
      // A cavity slider: the wall beside the opening is drawn thinner (the pocket), and the door's
      // leaf is drawn part way out of it into an otherwise empty opening. The clear opening is the
      // stretch between the pockets. One pocket with its leaf is a single slider, two a double.
      let cavity = null;
      if (aligned && options.cavitySliders && widthMm >= options.swingDoorMinMm) {
        const vertical = value === 2;
        const a0 = vertical ? item.minY : item.minX, mid = vertical ? (item.minX + item.maxX) >> 1 : (item.minY + item.maxY) >> 1;
        const at = (a, c) => (vertical ? a * width + c : c * width + a);
        const solid = (a) => wall[at(a, mid)] || wall[at(a, mid - 1)] || wall[at(a, mid + 1)];
        const inked = (a) => ink[at(a, mid)] || ink[at(a, mid - 1)] || ink[at(a, mid + 1)];
        // The pocket begins at the thick wall's end, give or take the line that ends that wall.
        let lead = 0, trail = 0;
        for (let skip = 0; skip <= 4 && !lead; skip += 1) if (solid(a0 + skip)) { lead = skip; while (lead < along && solid(a0 + lead)) lead += 1; }
        for (let skip = 0; skip <= 4 && !trail; skip += 1) if (solid(a0 + along - 1 - skip)) { trail = skip; while (trail < along - lead && solid(a0 + along - 1 - trail)) trail += 1; }
        const leaf = (from, direction) => { let n = 0; while (n < along && inked(from + direction * n) && !solid(from + direction * n)) n += 1; return n; };
        const leaf0 = lead ? leaf(a0 + lead, 1) : 0, leaf1 = trail ? leaf(a0 + along - 1 - trail, -1) : 0;
        const clear = along - lead - trail, minPocket = px(options.cavityPocketMinMm), minLeaf = px(options.cavityLeafMinMm);
        const ends = (lead >= minPocket && leaf0 >= minLeaf ? 1 : 0) + (trail >= minPocket && leaf1 >= minLeaf ? 1 : 0);
        const open = clear - leaf0 - leaf1;
        let empty = 0;
        for (let a = a0 + lead + leaf0; a < a0 + along - trail - leaf1; a += 1) if (!inked(a)) empty += 1;
        if (ends && clear / k >= options.swingDoorMinMm && open > 0 && empty >= open * 0.8 && leaf0 + leaf1 <= clear * 0.6) cavity = { ends, clear, shift: lead + clear / 2 - along / 2, vertical };
      }
      candidates.push({ item, value, widthMm, across, centre, swing, aligned, line, cavity });
    }
    gapSets.push({ value, labels, verdict, candidates });
  }
  // Nearest pairs first, so a roughly located opening goes to the candidate it most plausibly is.
  const gapCandidates = gapSets.flatMap((set) => set.candidates.map((candidate) => ({ ...candidate, set, nearest: nearestEvidence(candidate.centre) }))).sort((a, b) => a.nearest - b.nearest);
  for (const { item, value, across, swing, set, aligned, line, cavity, ...measured } of gapCandidates) {
    // A cavity slider's opening is the clear stretch between its pockets, not the whole gap in the thick wall.
    const widthMm = cavity ? cavity.clear / k : measured.widthMm;
    const centre = cavity ? { x: measured.centre.x + (cavity.vertical ? 0 : cavity.shift / sx), y: measured.centre.y + (cavity.vertical ? cavity.shift / sy : 0) } : measured.centre;
    const support = claim(centre, widthMm, 'door');
    const swung = swing.share >= options.swingArcShare;
    const doorway = options.alignedDoorways && aligned && widthMm >= options.swingDoorMinMm && widthMm <= options.doorGapMm;
    // Wider than a doorway, with the door drawn across it from one wall end to the other: a robe
    // slider, a cavity slider, a garage door. A dashed bulkhead line over an open-plan opening is not one.
    const drawnAcross = !support && aligned && widthMm > options.doorGapMm && line.unbroken >= options.wideDoorLineShare;
    const pocketed = Boolean(cavity) && !swung;
    if (support || swung || doorway || drawnAcross || pocketed) set.verdict[item.id] = 2;
    openings.push({ id: `go-${value === 2 ? 'v' : 'h'}-${Math.round(centre.x * 10)}-${Math.round(centre.y * 10)}`, axis: value === 2 ? 'v' : 'h', ...centre, widthMm: Math.round(widthMm), hostThicknessMm: Math.round(across / k), kind: 'wall-gap',
      confirmed: Boolean(support) || swung || doorway || drawnAcross || pocketed, basis: support ? 'located' : swung ? 'door-swing' : pocketed ? 'cavity-pocket' : drawnAcross ? 'door-line-across' : aligned ? 'aligned-wall-ends' : 'none', aligned, ...(pocketed ? { cavityLeaves: cavity.ends } : {}), swingShare: +swing.share.toFixed(2), ...(line.share ? { lineShare: +line.share.toFixed(2), lineUnbrokenShare: +line.unbroken.toFixed(2) } : {}), ...(swung ? { leafMm: Math.round(swing.radius / k) } : {}),
      ...(support?.point.ref !== undefined ? { evidenceRef: support.point.ref } : {}), reviewRequired: !support && !swung, seed: item.seed, axisIndex: value - 1 });
    if (pocketed) openings[openings.length - 1].reviewReason = `A door leaf is drawn part way out of a pocket in the wall ${cavity.ends === 2 ? 'at each side of' : 'beside'} this opening: a ${cavity.ends === 2 ? 'double ' : ''}cavity sliding door.`;
    else if (drawnAcross) openings[openings.length - 1].reviewReason = 'A door is drawn from one wall end to the other across an opening wider than a doorway: a sliding robe door, a cavity slider or a garage door.';
    if (doorway && !support && !swung && !pocketed) openings[openings.length - 1].reviewReason = 'A door-width opening between two ends of one wall, with no door swing drawn: a sliding door, a cavity slider or an open doorway.';
  }
  for (const { value, labels, verdict } of gapSets) {
    for (let p = 0; p < labels.length; p += 1) if (labels[p] && verdict[labels[p]]) { closed[p] = value; if (verdict[labels[p]] === 2) openingGap[p] = 1; }
  }

  // Wall-to-wall doors (robe sliders): the opening takes the whole side of a space, so there is no
  // wall fabric to find a gap in, only the door's own thin lines running from one wall to the
  // other. Taken only where an opening is known to be and that linework is actually drawn.
  const doorLine = new Uint8Array(width * height);
  const confirmedRefs = new Set(openings.filter((opening) => opening.confirmed && opening.evidenceRef !== undefined).map((opening) => opening.evidenceRef));
  const lineBand = Math.max(3, Math.round(px(options.doorLineReachMm)));
  for (const [evidenceIndex, point] of evidence.entries()) {
    if (usedEvidence.has(evidenceIndex) || (point.ref !== undefined && confirmedRefs.has(point.ref)) || point.kind === 'window') continue;
    const ex = Math.round(point.x * sx), ey = Math.round(point.y * sy);
    if (ex < bounds.x0 + lineBand || ey < bounds.y0 + lineBand || ex > bounds.x1 - lineBand || ey > bounds.y1 - lineBand || fabric0(ey * width + ex)) continue;
    let best = null;
    for (const vertical of [false, true]) {
      const step = vertical ? width : 1, cross = vertical ? 1 : width;
      const origin = ey * width + ex;
      const limit = Math.round(px(options.collinearGapMm));
      const ends = [-1, 1].map((direction) => { for (let g = 1; g <= limit; g += 1) { const q = origin + direction * g * step; if (q < 0 || q >= wall.length) return 0; if (wall[q] || closed[q]) return g; } return 0; });
      if (!ends[0] || !ends[1]) continue;
      const span = ends[0] + ends[1] - 1;
      if (span < px(options.minOpeningMm) || span > limit) continue;
      // Linework along the span: which line across the band is drawn most, and how much of the span has any.
      const rows = new Uint32Array(lineBand * 2 + 1);
      let drawn = 0;
      for (let g = -ends[0] + 1; g < ends[1]; g += 1) {
        let any = 0;
        for (let offset = -lineBand; offset <= lineBand; offset += 1) if (ink[origin + g * step + offset * cross]) { rows[offset + lineBand] += 1; any = 1; }
        drawn += any;
      }
      const share = drawn / span;
      if (share < 0.7) continue;
      let line = 0;
      for (let index = 1; index < rows.length; index += 1) if (rows[index] > rows[line]) line = index;
      if (!best || share > best.share) best = { vertical, step, cross, origin: origin + (line - lineBand) * cross, ends, span, share };
    }
    if (!best) continue;
    const half = Math.max(2, Math.round(px(options.minWallMm) / 2));
    const own = best.vertical ? 2 : 1;
    let blocked = false;
    for (let g = -best.ends[0] + 1; g < best.ends[1] && !blocked; g += 1) if (wall[best.origin + g * best.step]) blocked = true;
    if (blocked) continue;
    for (let g = -best.ends[0] + 1; g < best.ends[1]; g += 1) for (let offset = -half; offset <= half; offset += 1) {
      const p = best.origin + g * best.step + offset * best.cross;
      if (!wall[p] && !closed[p]) { closed[p] = own; doorLine[p] = 1; }
    }
    const middle = best.origin + ((best.ends[1] - best.ends[0]) >> 1) * best.step;
    const centre = toLogical((middle % width) + 0.5, Math.floor(middle / width) + 0.5);
    openings.push({ id: `gd-${best.vertical ? 'v' : 'h'}-${Math.round(centre.x * 10)}-${Math.round(centre.y * 10)}`, axis: best.vertical ? 'v' : 'h', ...centre, widthMm: Math.round(best.span / k), hostThicknessMm: Math.round((half * 2 + 1) / k), kind: 'door-line',
      confirmed: true, basis: 'located', ...(point.ref !== undefined ? { evidenceRef: point.ref } : {}), reviewRequired: false, seed: middle, axisIndex: own - 1 });
    usedEvidence.add(evidenceIndex);
  }

  // Sliding doors across a recess (a built-in robe's front). The doors are drawn as two thin
  // panels, one behind the other, running from wall to wall: far too thin to be wall, so the recess
  // is open to its room. Taken as a door only on all of this together: a thin structure that is
  // more than one line (a shelf edge or a hanging rail is one line), drawn nearly the whole way,
  // with wall at both ends, and a wall parallel to it a robe's depth behind on one side only.
  if (options.slidingTracks) {
    const panel = Math.max(12, Math.round(px(options.trackPanelMm))), endReach = Math.max(4, Math.round(px(options.trackEndReachMm)));
    const minDepth = px(options.trackRecessMinMm), maxDepth = px(options.trackRecessMaxMm);
    for (const vertical of [false, true]) {
      const lengthAlong = vertical ? lengthV : lengthH;
      const cross = vertical ? 1 : width, step = vertical ? width : 1;
      const thin = (p) => ink[p] && !wall[p] && !closed[p] && lengthAlong[p] >= panel;
      const { labels, components } = labelComponents((p) => thin(p) || thin(p - cross) || thin(p + cross) || thin(p - 2 * cross) || thin(p + 2 * cross), width, height, bounds);
      const at = (a, c) => (vertical ? a * width + c : c * width + a);
      const limitA = vertical ? height : width, limitC = vertical ? width : height;
      const fabric = (p) => wall[p] || closed[p];
      for (const item of components) {
        if (!item) continue;
        let a0 = vertical ? item.minY : item.minX, a1 = vertical ? item.maxY : item.maxX;
        const c0 = (vertical ? item.minX : item.minY) + 2, c1 = (vertical ? item.maxX : item.maxY) - 2;
        const along = a1 - a0 + 1;
        if (c1 < c0 || along / k < options.trackMinMm || along / k > options.trackMaxMm || (c1 - c0 + 1) / k > options.trackMaxThicknessMm) continue;
        // Drawn nearly all the way, and for most of the way as more than a single line.
        let drawn = 0, doubled = 0;
        for (let a = a0; a <= a1; a += 1) {
          let rows = 0;
          for (let c = c0; c <= c1; c += 1) if (ink[at(a, c)] && !wall[at(a, c)]) rows += 1;
          if (rows) drawn += 1;
          if (rows >= 3 || (rows === 2 && c1 - c0 >= 2)) doubled += 1;
        }
        if (drawn < along * 0.85 || doubled < along * options.trackDoubledShare) continue;
        // Wall at both ends.
        const ends = [-1, 1].map((direction) => {
          for (let g = 0; g <= endReach; g += 1) {
            const a = (direction < 0 ? a0 : a1) + direction * g;
            if (a < 0 || a >= limitA) return -1;
            // (the wall it stops against may end a line or two short of it: a return's end cap)
            for (let away = 0; away <= endReach; away += 1) for (const c of away ? [c0 - away, c1 + away] : [(c0 + c1) >> 1]) {
              if (away === 0) { for (let own = c0; own <= c1; own += 1) if (fabric(at(a, own))) return { g, c: own }; continue; }
              if (c >= 0 && c < limitC && fabric(at(a, c))) return { g, c };
            }
          }
          return null;
        });
        if (!ends[0] || !ends[1]) continue;
        const meets = ends;
        // A wall parallel to it, a robe's depth away, on one side only.
        const behind = [-1, 1].map((side) => {
          let within = 0, samples = 0, total = 0;
          for (let a = a0; a <= a1; a += 2) {
            samples += 1;
            for (let g = 1; g <= maxDepth + 2; g += 1) {
              const c = (side < 0 ? c0 : c1) + side * g;
              if (c < 0 || c >= limitC) break;
              if (fabric(at(a, c))) { if (g >= minDepth && g <= maxDepth) { within += 1; total += g; } break; }
            }
          }
          return { share: within / samples, depth: within ? total / within : 0 };
        });
        const sides = behind.filter((side) => side.share >= 0.7);
        if (sides.length !== 1) continue;
        a0 -= meets[0].g; a1 += meets[1].g;
        const middle = at((a0 + a1) >> 1, (c0 + c1) >> 1);
        const centre = toLogical(((middle % width)) + 0.5, Math.floor(middle / width) + 0.5);
        if (openings.some((opening) => opening.confirmed && Math.hypot(opening.x - centre.x, opening.y - centre.y) * sx <= (a1 - a0) / 2)) continue;
        const half = Math.max(2, Math.round(px(options.minWallMm) / 2));
        const own = vertical ? 2 : 1;
        for (let a = a0; a <= a1; a += 1) for (let offset = -half; offset <= half; offset += 1) {
          const p = at(a, ((c0 + c1) >> 1) + offset);
          if (p >= 0 && p < wall.length && !wall[p] && !closed[p]) { closed[p] = own; doorLine[p] = 1; }
        }
        // Where the wall it stops against ends a little to one side of it, the corner between them is closed too.
        for (const [end, meet] of [[a0, meets[0]], [a1, meets[1]]]) for (let a = end - 1; a <= end + 1; a += 1) for (let c = Math.min(meet.c, c0); c <= Math.max(meet.c, c1); c += 1) {
          const p = at(a, c);
          if (a >= 0 && a < limitA && !wall[p] && !closed[p]) closed[p] = own;
        }
        openings.push({ id: `gt-${vertical ? 'v' : 'h'}-${Math.round(centre.x * 10)}-${Math.round(centre.y * 10)}`, axis: vertical ? 'v' : 'h', ...centre, widthMm: Math.round((a1 - a0 + 1) / k), hostThicknessMm: Math.round((half * 2 + 1) / k), kind: 'door-line',
          confirmed: true, basis: 'track-across-recess', recessDepthMm: Math.round(sides[0].depth / k), doubledShare: +(doubled / along).toFixed(2), reviewRequired: true,
          reviewReason: 'Two thin door panels are drawn from wall to wall across a recess a robe deep: sliding robe doors. Confirm the door type and height.', seed: middle, axisIndex: own - 1 });
      }
    }
  }

  // Walls: each band, with the confirmed openings along it, becomes one centreline run with its
  // measured thickness. A wall's run is gross through a confirmed opening and stops at any other gap.
  const walls = [];
  const symbolQueue = [];
  const swingQueue = [];
  const runOf = [null, null];
  const fabric = (p) => wall[p] || closed[p];
  // Outside: the open sheet around the building. It is everything a large disc can reach from
  // the edge of the drawing without crossing wall fabric or a gap in it, so it stops at the
  // building's shell even where a window breaks the wall's linework and leaves no gap to close.
  // A wall with the outside against one face is external.
  const outside = new Uint8Array(width * height);
  {
    const toFabric = chamferDistance((p) => wall[p] || bridge[p] || closed[p], width, height, bounds);
    // On a sheet cropped close to the building the disc is no bigger than the margin allows.
    const median = (values) => values.sort((a, b) => a - b)[values.length >> 1] || 0;
    const sides = [[], [], [], []];
    for (let x = bounds.x0; x <= bounds.x1; x += 1) { sides[0].push(toFabric[bounds.y0 * width + x]); sides[1].push(toFabric[bounds.y1 * width + x]); }
    for (let y = bounds.y0; y <= bounds.y1; y += 1) { sides[2].push(toFabric[y * width + bounds.x0]); sides[3].push(toFabric[y * width + bounds.x1]); }
    const clearance = Math.min(...sides.map(median));
    const disc = Math.max(3, Math.min(Math.round(px(options.outsideDiscMm) * 3), Math.floor(clearance * 0.9)));
    if (disc < px(600) * 3) diagnostics.push({ code: 'tight-margin', message: 'The sheet is cropped close to the building; external and internal walls may be confused where a wide opening is not drawn closed.' });
    const roomy = labelComponents((p) => toFabric[p] >= disc, width, height, bounds);
    const reaches = new Uint8Array(roomy.components.length);
    for (const item of roomy.components) if (item?.border) reaches[item.id] = 1;
    const toReached = chamferDistance((p) => roomy.labels[p] && reaches[roomy.labels[p]], width, height, bounds);
    for (let y = bounds.y0; y <= bounds.y1; y += 1) for (let x = bounds.x0; x <= bounds.x1; x += 1) {
      const p = y * width + x;
      if (toReached[p] <= disc && !wall[p] && !bridge[p] && !closed[p]) outside[p] = 1;
    }
  }
  const outsideReach = Math.max(4, Math.round(px(options.outsideReachMm)));
  for (const [band, vertical] of [[bandH, false], [bandV, true]]) {
    const own = vertical ? 2 : 1;
    const { labels: runLabels, components } = labelComponents((p) => band[p] > 0 || closed[p] === own, width, height, bounds);
    const ids = new Map();
    runOf[vertical ? 1 : 0] = { labels: runLabels, ids };
    for (const item of components) {
      if (!item) continue;
      const along = vertical ? item.maxY - item.minY + 1 : item.maxX - item.minX + 1;
      const across = vertical ? item.maxX - item.minX + 1 : item.maxY - item.minY + 1;
      if (along < px(Math.min(options.nibRunMm, options.jambReturnRunMm))) continue;
      const thicknessPx = Math.max(1, item.area / along);
      const thicknessMm = Math.max(options.minWallMm, (thicknessPx - 2) / k);
      const cx = (item.minX + item.maxX + 1) / 2, cy = (item.minY + item.maxY + 1) / 2;
      // Connectivity: does other wall fabric continue beyond each end of this run?
      const probe = Math.max(3, Math.round(px(120)));
      const touches = (end) => {
        for (let step = 1; step <= probe; step += 1) for (let offset = -Math.ceil(across / 2) - probe; offset <= Math.ceil(across / 2) + probe; offset += 2) {
          const x = Math.round(vertical ? cx + offset : (end < 0 ? item.minX - step : item.maxX + step));
          const y = Math.round(vertical ? (end < 0 ? item.minY - step : item.maxY + step) : cy + offset);
          if (x >= 0 && y >= 0 && x < width && y < height && fabric(y * width + x) && runLabels[y * width + x] !== item.id) return true;
        }
        return false;
      };
      const connectedEnds = (touches(-1) ? 1 : 0) + (touches(1) ? 1 : 0);
      const lengthMm = along / k;
      // A short strip of paired lines that joins no other wall is joinery, a dimension or a symbol.
      if (connectedEnds === 0 && lengthMm < options.isolatedRunMm) { diagnostics.push({ code: 'isolated-linework', lengthMm: Math.round(lengthMm), message: 'Paired linework that joins no wall was not taken as a wall.', at: toLogical(cx, cy) }); continue; }
      const a = vertical ? toLogical(cx, item.minY) : toLogical(item.minX, cy);
      const b = vertical ? toLogical(cx, item.maxY + 1) : toLogical(item.maxX + 1, cy);
      const reasons = [];
      if (across > thicknessPx * 1.6 + 3 || thicknessMm > options.maxWallMm) reasons.push('Irregular wall faces; check this wall.');
      if (connectedEnds === 0) reasons.push('This wall joins no other wall.');
      // External or internal, from the drawing: how much of the run has the outside against a face.
      let outsideSteps = 0;
      {
        const lowAlong = vertical ? item.minY : item.minX, lowAcross = vertical ? item.minX : item.minY, highAcross = vertical ? item.maxX : item.maxY;
        for (let step = 0; step < along; step += 1) {
          let seen = false;
          // Looked for on each side until other wall fabric is met; the disc leaves inside corners unfilled.
          for (const side of [-1, 1]) for (let reach = 1; reach <= outsideReach && !seen; reach += 1) {
            const across2 = side < 0 ? lowAcross - reach : highAcross + reach;
            const x = vertical ? across2 : lowAlong + step, y = vertical ? lowAlong + step : across2;
            if (x < 0 || y < 0 || x >= width || y >= height) break;
            const q = y * width + x;
            if (outside[q]) seen = true;
            else if (wall[q] && runLabels[q] !== item.id && reach > 3) break;
          }
          if (seen) outsideSteps += 1;
        }
      }
      const outsideShare = outsideSteps / along;
      if (outsideShare > 0.25 && outsideShare < 0.75) reasons.push('Part of this wall faces outside and part does not; check whether it is external or internal.');
      ids.set(item.id, `gw-${vertical ? 'v' : 'h'}-${Math.round(a.x * 10)}-${Math.round(a.y * 10)}`);
      walls.push({
        id: ids.get(item.id),
        axis: vertical ? 'v' : 'h', nodes: [a, b], lengthMm, connectedEnds,
        category: outsideShare >= 0.5 ? 'exterior' : 'interior', outsideShare: +outsideShare.toFixed(2),
        measuredThicknessMm: Math.round(thicknessMm), thicknessMm: nearest(thicknessMm, STANDARD_THICKNESSES),
        ...(reasons.length ? { reviewRequired: true, reviewReason: reasons.join(' ') } : {}),
      });
      // Doors drawn closed in this wall, known by their swing.
      if (options.closedDoorSwings) for (const swing of closedDoorSwings(inkFat, width, height, item, vertical, Math.round(px(options.closedDoorMinMm)), Math.round(px(options.swingDoorMaxMm)), options.swingArcShare)) {
        // Where the leaf would lie closed if it is drawn open here: square to this wall, from the hinge.
        let fabricSteps = 0;
        for (let step = 2; step <= swing.radius; step += 1) {
          const a = swing.hinge, c = swing.across + swing.side * step;
          const x = Math.round(vertical ? c : a), y = Math.round(vertical ? a : c);
          if (x >= 0 && y >= 0 && x < width && y < height && (wall[y * width + x] || bridge[y * width + x])) fabricSteps += 1;
        }
        // An external wall keeps its own door: an entry door is not moved into the partition its open leaf lies along.
        const drawnOpen = outsideShare < 0.5 && fabricSteps >= swing.radius * 0.6;
        const mid = swing.across + swing.side * swing.radius / 2;
        const centre = drawnOpen ? (vertical ? toLogical(mid, swing.hinge) : toLogical(swing.hinge, mid)) : (vertical ? toLogical(cx, swing.along) : toLogical(swing.along, cy));
        swingQueue.push({ centre, widthMm: swing.radius / k, vertical: drawnOpen ? !vertical : vertical, thicknessMm, hostWallId: drawnOpen ? null : ids.get(item.id), drawnOpen,
          probe: drawnOpen ? (vertical ? { x: Math.round(mid), y: Math.round(swing.hinge) } : { x: Math.round(swing.hinge), y: Math.round(mid) }) : null, external: outsideShare >= 0.5, share: swing.share });
      }
      // Windows: a stretch of this wall that carries extra lines across it, is drawn wider than the
      // wall either side, or whose lines sit differently across it, is a frame drawn in the wall. The wall stays whole (its length is
      // gross through a window); the stretch is a candidate opening on this wall, confirmed only
      // by an opening the estimator or the plan reading located there.
      const low = vertical ? item.minY : item.minX;
      const widths = new Uint16Array(along), marked = new Uint8Array(along);
      let lineOnly = 0;
      const gapAt = new Uint8Array(along);
      for (let y = item.minY; y <= item.maxY; y += 1) for (let x = item.minX; x <= item.maxX; x += 1) {
        const p = y * width + x;
        if (runLabels[p] !== item.id) continue;
        const index = (vertical ? y : x) - low;
        if (!gapAt[index]) widths[index] += 1;
        if (band[p] & 4) marked[index] = 1;
        if (doorLine[p]) lineOnly += 1;
        // An opening already closed along this run is not also a frame drawn in it.
        if (openingGap[p] || doorLine[p]) widths[index] = 0, gapAt[index] = 1;
      }
      if (lineOnly > item.area * 0.5) Object.assign(walls[walls.length - 1], { reviewRequired: true, reviewReason: [walls[walls.length - 1].reviewReason, 'This run is a wall-to-wall door opening drawn as door lines only; confirm it is measured as wall.'].filter(Boolean).join(' ') });
      const acrossLow = vertical ? item.minX : item.minY, span = across;
      const inkAt = (index, offset) => ink[vertical ? (low + index) * width + acrossLow + offset : (acrossLow + offset) * width + low + index];
      const stretches = symbolStretches(widths, marked, inkAt, span, Math.max(2, Math.round(px(120))), px(150));
      for (const [from, to] of stretches) {
        const widthMm = (to - from) / k;
        // A stretch that is the whole wall is the wall's own make-up, not something drawn in it.
        if (widthMm < options.minOpeningMm || widthMm > options.collinearGapMm || to - from > along * 0.9) continue;
        const middle = low + (from + to) / 2;
        const centre = vertical ? toLogical(cx, middle) : toLogical(middle, cy);
        symbolQueue.push({ centre, widthMm, vertical, thicknessMm, hostWallId: ids.get(item.id), external: outsideShare >= 0.5 });
      }
    }
  }
  for (const run of diagonalRuns) {
    const a = toLogical(run.a.x + 0.5, run.a.y + 0.5), b = toLogical(run.b.x + 0.5, run.b.y + 0.5);
    const thicknessMm = Math.max(options.minWallMm, (run.thicknessPx - 2) / k);
    // The outside against either face, sampled along the run.
    const nx = -(run.b.y - run.a.y) / run.lengthPx, ny = (run.b.x - run.a.x) / run.lengthPx;
    let faced = 0, samples = 0;
    for (let t = 0.1; t <= 0.9; t += 0.1) {
      const cx = run.a.x + (run.b.x - run.a.x) * t, cy = run.a.y + (run.b.y - run.a.y) * t;
      samples += 1;
      let seen = false;
      for (const side of [-1, 1]) for (let reach = run.thicknessPx / 2 + 2; reach <= run.thicknessPx / 2 + outsideReach && !seen; reach += 1) {
        const x = Math.round(cx + nx * reach * side), y = Math.round(cy + ny * reach * side);
        if (x >= 0 && y >= 0 && x < width && y < height && outside[y * width + x]) seen = true;
      }
      if (seen) faced += 1;
    }
    walls.push({ id: `gw-d-${Math.round(a.x * 10)}-${Math.round(a.y * 10)}`, axis: 'd', nodes: [a, b], lengthMm: run.lengthPx / k, connectedEnds: run.joined,
      category: faced / samples >= 0.5 ? 'exterior' : 'interior', outsideShare: +(faced / samples).toFixed(2),
      measuredThicknessMm: Math.round(thicknessMm), thicknessMm: nearest(thicknessMm, STANDARD_THICKNESSES),
      ...(run.joined < 2 ? { reviewRequired: true, reviewReason: 'This diagonal wall meets other wall at one end only; check it.' } : {}) });
  }
  // A frame drawn in an external wall is a window or glazed door on the drawing's own evidence; one
  // in an internal wall is as often joinery or a stair, so it stays a candidate until located.
  for (const symbol of symbolQueue.map((entry) => ({ ...entry, nearest: nearestEvidence(entry.centre) })).sort((a, b) => a.nearest - b.nearest)) {
    const { centre, widthMm, vertical, thicknessMm, hostWallId, external } = symbol;
    const support = claim(centre, widthMm, 'window');
    openings.push({ id: `gs-${vertical ? 'v' : 'h'}-${Math.round(centre.x * 10)}-${Math.round(centre.y * 10)}`, axis: vertical ? 'v' : 'h', ...centre, widthMm: Math.round(widthMm), hostThicknessMm: Math.round(thicknessMm), kind: 'wall-symbol',
      confirmed: Boolean(support), basis: support ? 'located' : external ? 'frame-in-external-wall' : 'none', inExternalWall: external,
      ...(support?.point.ref !== undefined ? { evidenceRef: support.point.ref } : {}), reviewRequired: !support, hostWallId });
  }
  // Doors drawn closed. One that lies on a doorway already found is that doorway's own swing.
  for (const swing of swingQueue.sort((a, b) => b.share - a.share)) {
    const { centre, widthMm, vertical, thicknessMm, external } = swing;
    let { hostWallId } = swing;
    let inExternal = external;
    if (swing.drawnOpen) {
      // The wall the doorway is in: the run of the other direction at the leaf's closed position.
      const host = runOf[vertical ? 1 : 0];
      const p = swing.probe.y * width + swing.probe.x;
      hostWallId = host?.ids.get(host.labels[p]) || null;
      const hostWall = walls.find((item) => item.id === hostWallId);
      if (!hostWall) continue;
      inExternal = hostWall.category === 'exterior';
    }
    const reach = widthMm * 1.15 * pixelsPerMm;
    if (openings.some((other) => other.kind !== 'wall-symbol' && other.confirmed && other.basis === 'door-swing' && Math.hypot(other.x - centre.x, other.y - centre.y) <= Math.max(reach, other.widthMm * 0.6 * pixelsPerMm))) continue;
    const support = claim(centre, widthMm, 'door');
    openings.push({ id: `gd-${vertical ? 'v' : 'h'}-${Math.round(centre.x * 10)}-${Math.round(centre.y * 10)}`, axis: vertical ? 'v' : 'h', ...centre, widthMm: Math.round(widthMm), leafMm: Math.round(widthMm), hostThicknessMm: Math.round(thicknessMm), kind: 'wall-swing',
      confirmed: true, basis: 'door-swing', inExternalWall: inExternal, swingShare: +swing.share.toFixed(2),
      ...(support?.point.ref !== undefined ? { evidenceRef: support.point.ref } : {}), reviewRequired: false, hostWallId });
  }
  // A confirmed opening is hosted by the wall run it was closed along; a symbol by the wall it is drawn in.
  for (const opening of openings) {
    if (opening.kind === 'wall-symbol' || opening.kind === 'wall-swing') continue;
    const host = runOf[opening.axisIndex];
    opening.hostWallId = opening.confirmed ? host.ids.get(host.labels[opening.seed]) || null : null;
    delete opening.seed; delete opening.axisIndex;
  }

  // Rooms. Verified rooms are enclosed by walls and confirmed openings alone. A space that only
  // encloses if unconfirmed gaps are closed is returned as a proposal for the estimator, never as
  // a measured room.
  const rooms = [];
  const roomId = (item) => `gr-${Math.round(item.minX / sx)}-${Math.round(item.minY / sy)}-${Math.round(item.maxX / sx)}-${Math.round(item.maxY / sy)}`;
  const collect = (test, proposed, verifiedSeeds) => {
    const found = labelComponents(test, width, height, bounds);
    for (const item of found.components) {
      if (!item || item.border) continue;
      const areaM2 = item.area / (k * k) / 1e6;
      if (areaM2 < options.minRoomM2 || Math.min(item.maxX - item.minX, item.maxY - item.minY) / k < options.minRoomSideMm) continue;
      // A long pocket narrower than a room (between a wall and a frame or hood drawn beside it) is not a room.
      if (item.area / (Math.max(item.maxX - item.minX, item.maxY - item.minY) + 1) / k < options.minRoomSideMm) continue;
      // A proposal that is the same space as a verified room adds nothing.
      if (proposed && Math.abs((verifiedSeeds.get(roomId(item)) ?? -1) - areaM2) <= areaM2 * 0.02) continue;
      const boundary = simplifyClosed(traceBoundary(found.labels, width, height, item.id, item.seed), options.simplifyPx);
      if (boundary.length < 3) continue;
      const polygon = boundary.map((p) => toLogical(p.x, p.y));
      const polygonM2 = shoelace(polygon) / (pixelsPerMm * pixelsPerMm) / 1e6;
      let cx = 0, cy = 0, n = 0;
      for (let y = item.minY; y <= item.maxY; y += 4) for (let x = item.minX; x <= item.maxX; x += 4) if (found.labels[y * width + x] === item.id) { cx += x; cy += y; n += 1; }
      const holesM2 = Math.max(0, polygonM2 - areaM2);
      const reasons = [];
      if (proposed) reasons.push('This boundary relies on gaps that are not confirmed as doors or windows.');
      if (holesM2 > Math.max(0.15, polygonM2 * 0.02)) reasons.push(holesM2.toFixed(2) + ' m² inside this boundary is wall or column.');
      rooms.push({
        id: roomId(item),
        polygon, areaM2: polygonM2, netAreaM2: areaM2, perimeterM: perimeterOf(polygon) / pixelsPerMm / 1000,
        centroid: n ? toLogical(cx / n, cy / n) : toLogical((item.minX + item.maxX) / 2, (item.minY + item.maxY) / 2),
        inner: toLogical((item.seed % width) + 0.5, Math.floor(item.seed / width) + 0.5),
        bounds: { ...toLogical(item.minX, item.minY), x2: (item.maxX + 1) / sx, y2: (item.maxY + 1) / sy },
        verified: !proposed, spaceLabel: item.id,
        ...(reasons.length ? { reviewRequired: true, reviewReason: reasons.join(' ') } : {}),
      });
    }
    return found;
  };
  const free = collect((p) => !wall[p] && !closed[p] && !outside[p], false, null);
  let proposedSpaces = null;
  if (options.proposeRooms) {
    proposedSpaces = collect((p) => !wall[p] && !bridge[p] && !closed[p] && !outside[p], true, new Map(rooms.map((room) => [room.id, room.netAreaM2])));
    // Where unconfirmed gaps divide an enclosed space, both are returned and linked: the whole
    // (dividedInto) is what the walls alone enclose, the parts (partOf) are for the estimator to
    // confirm. A consumer shows one or the other, never both, so no floor is counted twice.
    const parts = rooms.filter((room) => !room.verified);
    for (const whole of rooms.filter((room) => room.verified)) {
      // A part lies inside its whole; its centroid need not (an L-shaped space), a point in it does.
      const inside = parts.filter((part) => !part.partOf && part.netAreaM2 < whole.netAreaM2 * 0.98 && pointInPolygon(part.inner, whole.polygon));
      if (!inside.length) continue;
      for (const part of inside) { if (part.id === whole.id) part.id += '-part'; part.partOf = whole.id; }
      whole.dividedInto = inside.map((part) => part.id);
    }
  }
  // Ids come from each space's extent; two spaces with one extent are told apart.
  const seenIds = new Map();
  for (const room of rooms) { const count = (seenIds.get(room.id) || 0) + 1; seenIds.set(room.id, count); if (count > 1) room.id += `-${count}`; }
  for (const whole of rooms) if (whole.dividedInto) whole.dividedInto = rooms.filter((part) => part.partOf === whole.id).map((part) => part.id);
  rooms.sort((a, b) => a.bounds.y - b.bounds.y || a.bounds.x - b.bounds.x);
  const embeddedOpeningReviewCandidates = detectOpeningSymbolReviewCandidates({ ink, width, height, pixelsPerMm, logicalWidth, logicalHeight, walls });
  return { engine: GEOMETRY_ENGINE_VERSION, rasterPixelsPerMm: k, walls, openings, rooms, singleFaceReviewCandidates, embeddedOpeningReviewCandidates, diagnostics, debug: { wall, bridge, closed, outside, diagonal, bandH, bandV, labels: free.labels, width, height, bounds, singleFaceDebug, sx, sy, simplifyPx: options.simplifyPx, proposed: proposedSpaces && { labels: proposedSpaces.labels, components: proposedSpaces.components } } };
}

/**
 * Joinery does not enclose a room. A bench, a tub, a vanity or a robe shelf is drawn with paired
 * lines like a short wall, and the gaps closed from it cut small pockets off the room it stands
 * in. Nothing in the linework alone tells such a strip from a wall return, so the pockets are
 * judged instead: a space smaller than `pocketMaxM2` that no room name was given to, and that is
 * separated from the room only by closures no door or window confirms (never by a wall or a
 * confirmed opening), is part of that room. Returns the room with its pockets, or null when it
 * has none. `taken` holds the space labels that already belong to a room.
 */
export function absorbPockets(geometry, roomId, taken = new Set(), { pocketMaxM2 = 1.5, reachMm = 2500 } = {}) {
  const d = geometry?.debug;
  const room = (geometry?.rooms || []).find((item) => item.id === roomId);
  if (!d?.proposed || !room || room.verified || !room.spaceLabel) return null;
  const { labels, components } = d.proposed;
  const { wall, bridge, closed, width, height, sx, sy } = d;
  const k = geometry.rasterPixelsPerMm;
  const base = components[room.spaceLabel];
  if (!base) return null;
  const reach = Math.round(reachMm * k);
  const x0 = Math.max(1, base.minX - reach), y0 = Math.max(1, base.minY - reach), x1 = Math.min(width - 2, base.maxX + reach), y1 = Math.min(height - 2, base.maxY + reach);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const isGap = (p) => bridge[p] && !wall[p] && !closed[p];
  // Unconfirmed closures in reach of the room, each with the spaces it lies between.
  const gapOf = new Int32Array(w * h);
  const gaps = [null];
  const stack = [];
  for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) {
    const start = y * width + x;
    if (!isGap(start) || gapOf[(y - y0) * w + (x - x0)]) continue;
    const info = { between: new Set(), open: false };
    const id = gaps.length;
    gapOf[(y - y0) * w + (x - x0)] = id; stack.push(start);
    while (stack.length) {
      const p = stack.pop();
      const px = p % width, py = (p - px) / width;
      if (px === x0 || px === x1 || py === y0 || py === y1) info.open = true;
      for (const q of [p - 1, p + 1, p - width, p + width]) {
        const qx = q % width, qy = (q - qx) / width;
        if (qx < x0 || qx > x1 || qy < y0 || qy > y1) continue;
        if (isGap(q)) { const index = (qy - y0) * w + (qx - x0); if (!gapOf[index]) { gapOf[index] = id; stack.push(q); } }
        else if (labels[q]) info.between.add(labels[q]);
      }
    }
    gaps.push(info);
  }
  const maxArea = pocketMaxM2 * k * k * 1e6;
  const joined = new Set([room.spaceLabel]);
  for (let changed = true; changed;) {
    changed = false;
    for (const gap of gaps) {
      if (!gap || gap.open || ![...gap.between].some((label) => joined.has(label))) continue;
      // The closure goes with the room only when everything it lies between does: the room, its
      // pockets and nothing else. One that also borders another room stays a division.
      const pocket = (label) => { const space = components[label]; return space && !taken.has(label) && !space.border && space.area <= maxArea; };
      if (![...gap.between].every((label) => joined.has(label) || pocket(label))) continue;
      for (const label of gap.between) if (!joined.has(label)) { joined.add(label); changed = true; }
    }
  }
  if (joined.size === 1) return null;
  const candidate = new Uint8Array(w * h);
  for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) {
    const p = y * width + x, index = (y - y0) * w + (x - x0);
    const gap = gapOf[index] ? gaps[gapOf[index]] : null;
    const inside = gap ? !gap.open && gap.between.size > 0 && [...gap.between].every((label) => joined.has(label)) : joined.has(labels[p]);
    if (inside) candidate[index] = 1;
  }
  // One connected floor, grown from the room itself.
  const region = new Int32Array(w * h);
  let area = 0, seed = -1;
  const from = ((base.seed - (base.seed % width)) / width - y0) * w + ((base.seed % width) - x0);
  const queue = [from]; region[from] = 1;
  while (queue.length) {
    const index = queue.pop();
    area += 1;
    if (seed < 0 || index < seed) seed = index;
    const ix = index % w;
    for (const next of [ix > 0 ? index - 1 : -1, ix < w - 1 ? index + 1 : -1, index - w, index + w]) if (next >= 0 && next < region.length && candidate[next] && !region[next]) { region[next] = 1; queue.push(next); }
  }
  const boundary = simplifyClosed(traceBoundary(region, w, h, 1, seed), d.simplifyPx);
  if (boundary.length < 3) return null;
  const polygon = boundary.map((p) => ({ x: (p.x + x0) / sx, y: (p.y + y0) / sy }));
  const pockets = [...joined].filter((label) => label !== room.spaceLabel && region[((components[label].seed - (components[label].seed % width)) / width - y0) * w + ((components[label].seed % width) - x0)]);
  if (!pockets.length) return null;
  return { polygon, netAreaM2: area / (k * k) / 1e6, labels: pockets, pocketsM2: pockets.reduce((sum, label) => sum + components[label].area, 0) / (k * k) / 1e6 };
}

// Is the point strictly inside the polygon (logical pixels)?
export function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
