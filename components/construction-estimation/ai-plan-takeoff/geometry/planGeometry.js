// Geometry-first plan reading: walls, the openings in them and the rooms they enclose are
// measured from the drawing's own linework, never from positions a language model reports.
// A wall is two long parallel faces a wall-thickness apart; a room is the space those walls
// (with their door gaps closed) enclose. Pure functions over an RGBA raster: no DOM, no network.
// All returned coordinates are logical plan pixels, the unit the canvas and calibration use.

import { detectOpeningSymbolReviewCandidates } from './openingSymbolReview.js';

const STANDARD_THICKNESSES = [70, 90, 110, 150, 200, 230, 250, 270, 300, 350];
const nearest = (value, list) => list.reduce((best, item) => (Math.abs(item - value) < Math.abs(best - value) ? item : best));

export const GEOMETRY_ENGINE_VERSION = 'plan-geometry-2';

export const DEFAULT_GEOMETRY_OPTIONS = {
  inkThreshold: 630,          // r+g+b below this is linework
  minWallMm: 60, maxWallMm: 360,
  faceRunMm: 450,             // a face this long establishes a wall
  nibRunMm: 110,              // shorter faces only extend an established wall
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
  isolatedRunMm: 1500,        // shorter paired linework joining no wall is not a wall
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

// Mark the band between two parallel faces. `vertical` = the wall runs vertically (faces are
// vertical lines, scanned along each row). Value 2 where both faces are established, 1 for nibs.
function wallBands(ink, strict, relaxed, width, height, vertical, tMin, tMax, maxLine) {
  const mask = new Uint8Array(width * height);
  const outer = vertical ? height : width, inner = vertical ? width : height;
  const step = vertical ? 1 : width;
  const runs = [];
  for (let o = 0; o < outer; o += 1) {
    const base = vertical ? o * width : o;
    runs.length = 0;
    let start = -1;
    for (let i = 0; i <= inner; i += 1) {
      const on = i < inner && ink[base + i * step];
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
      if (!relaxed[p1] || !relaxed[p2]) continue;
      bands.push({ r, a1, b2, distance, level: strict[p1] && strict[p2] ? 2 : 1 });
    }
    // Faces shared by a run of equally spaced bands are stair treads or shelving, not walls;
    // of two bands sharing a face that together exceed a wall, the thinner one is the wall.
    for (let i = 0; i < bands.length; i += 1) {
      let j = i;
      while (j + 1 < bands.length && bands[j + 1].r === bands[j].r + 2) j += 1;
      const chain = bands.slice(i, j + 1);
      const total = chain.reduce((sum, band) => sum + band.distance, 0);
      let keep = chain;
      if (chain.length >= 3) keep = [];
      else if (chain.length === 2 && total > tMax) keep = [chain[0].distance <= chain[1].distance ? chain[0] : chain[1]];
      for (const band of keep) for (let k = band.a1; k <= band.b2; k += 1) mask[base + k * step] = band.level;
      i = j;
    }
  }
  return mask;
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
function bridgeGaps(band, wall, bridge, width, height, vertical, doorGap, collinearGap) {
  const outer = vertical ? width : height, inner = vertical ? height : width;
  const step = vertical ? width : 1;
  const cross = vertical ? 1 : width;
  // Both ends of one wall have their two faces on the same lines.
  const faces = (p) => {
    let low = 0, high = 0;
    while (low < 64 && band[p - (low + 1) * cross]) low += 1;
    while (high < 64 && band[p + (high + 1) * cross]) high += 1;
    return [low, high];
  };
  const sameFaces = (p, q) => { const a = faces(p), b = faces(q); return Math.abs(a[0] - b[0]) <= 3 && Math.abs(a[1] - b[1]) <= 3; };
  for (let o = 0; o < outer; o += 1) {
    const base = vertical ? o : o * width;
    for (let i = 1; i < inner - 1; i += 1) {
      const p = base + i * step;
      if (!band[p]) continue;
      for (const direction of [1, -1]) {
        if (wall[p + direction * step]) continue;
        let hit = 0;
        for (let g = 1; g <= collinearGap; g += 1) {
          const j = i + direction * g;
          if (j < 0 || j >= inner) break;
          const q = base + j * step;
          if (!wall[q]) continue;
          // Reached another wall: one crossing close by, or the same wall continuing further on.
          if (g > 1 && (g <= doorGap || (band[q] && sameFaces(p, q)))) hit = g;
          break;
        }
        for (let g = 1; g < hit; g += 1) bridge[base + (i + direction * g) * step] = vertical ? 2 : 1;
      }
    }
  }
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
  const tMin = px(options.minWallMm), tMax = px(options.maxWallMm);
  const strictLen = Math.max(12, Math.round(px(options.faceRunMm))), nibLen = Math.max(6, Math.round(px(options.nibRunMm)));
  const strictH = longRuns(ink, width, height, strictLen, false), strictV = longRuns(ink, width, height, strictLen, true);
  const reviewFaceH = longRuns(ink, width, height, strictLen, false, 1), reviewFaceV = longRuns(ink, width, height, strictLen, true, 1);
  const bandH = wallBands(ink, strictH, longRuns(ink, width, height, nibLen, false), width, height, false, tMin, tMax, options.maxLinePx);
  const bandV = wallBands(ink, strictV, longRuns(ink, width, height, nibLen, true), width, height, true, tMin, tMax, options.maxLinePx);

  // Keep only wall fabric that contains established faces; lettering and symbols do not.
  const full = { x0: 0, y0: 0, x1: width - 1, y1: height - 1 };
  const raw = labelComponents((p) => bandH[p] || bandV[p], width, height, full);
  const strictCount = new Int32Array(raw.components.length);
  for (let p = 0; p < raw.labels.length; p += 1) if (raw.labels[p] && (bandH[p] === 2 || bandV[p] === 2)) strictCount[raw.labels[p]] += 1;
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
  for (const item of established) {
    const root = find(item.id);
    const drawing = drawings.get(root) || { strict: 0, minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
    drawing.strict += strictCount[item.id];
    drawing.minX = Math.min(drawing.minX, item.minX); drawing.maxX = Math.max(drawing.maxX, item.maxX);
    drawing.minY = Math.min(drawing.minY, item.minY); drawing.maxY = Math.max(drawing.maxY, item.maxY);
    drawings.set(root, drawing);
  }
  let building = null, buildingRoot = null;
  for (const [root, drawing] of drawings) if (!building || drawing.strict > building.strict) { building = drawing; buildingRoot = root; }
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

  const bridge = new Uint8Array(width * height);
  bridgeGaps(bandH, wall, bridge, width, height, false, Math.round(px(options.doorGapMm)), Math.round(px(options.collinearGapMm)));
  bridgeGaps(bandV, wall, bridge, width, height, true, Math.round(px(options.doorGapMm)), Math.round(px(options.collinearGapMm)));

  const evidence = (context.openingEvidence || []).filter((item) => Number.isFinite(item?.x) && Number.isFinite(item?.y));

  // Gaps: every closure is a CANDIDATE opening. A gap is treated as part of its wall only when it
  // is a junction-sized break in one wall, or something says an opening is there (a door or window
  // the estimator placed, or one the plan reading located). Nothing is closed merely because it
  // would complete a room.
  const openings = [];
  const closed = new Uint8Array(width * height);
  for (const value of [1, 2]) {
    const { labels, components } = labelComponents((p) => bridge[p] === value && !wall[p], width, height, bounds);
    const verdict = new Uint8Array(components.length);
    for (const item of components) {
      if (!item) continue;
      const along = value === 2 ? item.maxY - item.minY + 1 : item.maxX - item.minX + 1;
      const across = value === 2 ? item.maxX - item.minX + 1 : item.maxY - item.minY + 1;
      const widthMm = along / k;
      const centre = toLogical((item.minX + item.maxX + 1) / 2, (item.minY + item.maxY + 1) / 2);
      if (widthMm < options.minOpeningMm) { verdict[item.id] = 1; continue; }
      if (across < tMin * 0.6) continue;
      const reachPx = Math.max(options.evidenceReachMm, widthMm * 0.6) * pixelsPerMm;
      const support = evidence.map((point) => ({ point, distance: Math.hypot(point.x - centre.x, point.y - centre.y) })).filter((entry) => entry.distance <= reachPx).sort((a, b) => a.distance - b.distance)[0];
      if (support) verdict[item.id] = 1;
      openings.push({ id: `go-${value === 2 ? 'v' : 'h'}-${Math.round(centre.x * 10)}-${Math.round(centre.y * 10)}`, axis: value === 2 ? 'v' : 'h', ...centre, widthMm: Math.round(widthMm), hostThicknessMm: Math.round(across / k), kind: 'wall-gap',
        confirmed: Boolean(support), ...(support?.point.ref !== undefined ? { evidenceRef: support.point.ref } : {}), reviewRequired: !support, seed: item.seed, axisIndex: value - 1 });
    }
    for (let p = 0; p < labels.length; p += 1) if (labels[p] && verdict[labels[p]]) closed[p] = value;
  }

  // Walls: each band, with the confirmed openings along it, becomes one centreline run with its
  // measured thickness. A wall's run is gross through a confirmed opening and stops at any other gap.
  const walls = [];
  const runOf = [null, null];
  const fabric = (p) => wall[p] || closed[p];
  for (const [band, vertical] of [[bandH, false], [bandV, true]]) {
    const own = vertical ? 2 : 1;
    const { labels: runLabels, components } = labelComponents((p) => band[p] > 0 || closed[p] === own, width, height, bounds);
    const ids = new Map();
    runOf[vertical ? 1 : 0] = { labels: runLabels, ids };
    for (const item of components) {
      if (!item) continue;
      const along = vertical ? item.maxY - item.minY + 1 : item.maxX - item.minX + 1;
      const across = vertical ? item.maxX - item.minX + 1 : item.maxY - item.minY + 1;
      if (along < px(options.nibRunMm)) continue;
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
      ids.set(item.id, `gw-${vertical ? 'v' : 'h'}-${Math.round(a.x * 10)}-${Math.round(a.y * 10)}`);
      walls.push({
        id: ids.get(item.id),
        axis: vertical ? 'v' : 'h', nodes: [a, b], lengthMm, connectedEnds,
        measuredThicknessMm: Math.round(thicknessMm), thicknessMm: nearest(thicknessMm, STANDARD_THICKNESSES),
        ...(reasons.length ? { reviewRequired: true, reviewReason: reasons.join(' ') } : {}),
      });
    }
  }
  // A confirmed opening is hosted by the wall run it was closed along.
  for (const opening of openings) {
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
      // A proposal that is the same space as a verified room adds nothing.
      if (proposed && verifiedSeeds.has(roomId(item))) continue;
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
        bounds: { ...toLogical(item.minX, item.minY), x2: (item.maxX + 1) / sx, y2: (item.maxY + 1) / sy },
        verified: !proposed,
        ...(reasons.length ? { reviewRequired: true, reviewReason: reasons.join(' ') } : {}),
      });
    }
    return found;
  };
  const free = collect((p) => !wall[p] && !closed[p], false, null);
  if (options.proposeRooms) collect((p) => !wall[p] && !bridge[p], true, new Set(rooms.map((room) => room.id)));
  rooms.sort((a, b) => a.bounds.y - b.bounds.y || a.bounds.x - b.bounds.x);
  const embeddedOpeningReviewCandidates = detectOpeningSymbolReviewCandidates({ ink, width, height, pixelsPerMm, logicalWidth, logicalHeight, walls });
  return { engine: GEOMETRY_ENGINE_VERSION, rasterPixelsPerMm: k, walls, openings, rooms, singleFaceReviewCandidates, embeddedOpeningReviewCandidates, diagnostics, debug: { wall, bridge, closed, bandH, bandV, labels: free.labels, width, height, bounds, singleFaceDebug } };
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
