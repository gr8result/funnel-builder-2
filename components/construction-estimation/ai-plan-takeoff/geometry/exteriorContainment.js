// External walls are a hard edge for AI-read floor outlines.
//
// A room's floor stops at the inside face of the external walls around it, and the building footprint
// stops at their outside face, except where a drawn outdoor area (alfresco, patio, porch, balcony) carries
// it past them. An AI outline that runs further, through a wall or out of a door or window gap into the
// yard, has those corners moved back onto the wall face. If that would leave a broken outline, the
// outline is not used. Coordinates are millimetres.
//
// A corner is outside a wall when, measured square to the wall, it lies past the face on the far side
// from the room, and either it sits along the wall's length or an edge of the outline cuts through the
// wall to reach it. The far side is the side away from the room's name for a room; for a footprint it is
// the side the footprint mostly does not cover. A room's name only decides for a wall it sits along. Openings in an external wall (up to bridgeGapMm wide,
// in line with the wall, where a door or window was found) count as wall, so an outline cannot leak out
// through a doorway.

export const CONTAINMENT_DEFAULTS = {
  toleranceMm: 30,         // a corner this close to the face is on it
  bridgeGapMm: 6000,       // in-line gaps up to this wide with a door or window in them close the wall line
  lineToleranceMm: 60,     // segments this close to one line are one wall line
  maxMoveMm: 8000,         // a corner further out than this is not a bleed this rule repairs
  maxAreaChange: 0.6,      // a result that loses more than this share of the area is not used
  faceToleranceMm: 60,     // a corner this close to a wall face is on it (for corners already placed on a wall)
  allowedReachMm: 300,     // a footprint corner this close to a drawn outdoor area belongs to it
  passes: 4,
};

const shoelace = (polygon) => polygon.reduce((sum, p, i) => { const q = polygon[(i + 1) % polygon.length]; return sum + p.x * q.y - q.x * p.y; }, 0) / 2;
const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

export function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function crossesItself(polygon) {
  const n = polygon.length;
  for (let i = 0; i < n; i += 1) for (let j = i + 2; j < n; j += 1) {
    if (i === 0 && j === n - 1) continue;
    const a = polygon[i], b = polygon[(i + 1) % n], c = polygon[j], d = polygon[(j + 1) % n];
    const d1 = cross(a, b, c), d2 = cross(a, b, d), d3 = cross(c, d, a), d4 = cross(c, d, b);
    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  }
  return false;
}

// Drop repeated corners and corners on a straight run.
function tidy(polygon) {
  let out = polygon.filter((p, i) => { const q = polygon[(i + 1) % polygon.length]; return Math.hypot(p.x - q.x, p.y - q.y) > 1; });
  let changed = true;
  while (changed && out.length > 3) {
    changed = false;
    for (let i = 0; i < out.length; i += 1) {
      const a = out[(i + out.length - 1) % out.length], b = out[i], c = out[(i + 1) % out.length];
      const length = Math.hypot(c.x - a.x, c.y - a.y);
      if (length > 0 && Math.abs(cross(a, b, c)) / length < 1 && (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y) >= 0) { out.splice(i, 1); changed = true; break; }
    }
  }
  return out;
}

/**
 * External walls as straight wall lines: each line has a unit direction, a normal, its extent along the
 * line, and half its thickness. In-line segments with gaps up to bridgeGapMm between them are one line.
 * @param walls [{ nodes: [{x,y}...] (mm), thicknessMm }]
 */
export function exteriorWallLines(walls = [], overrides = {}) {
  const options = { ...CONTAINMENT_DEFAULTS, ...overrides };
  const segments = [];
  for (const wall of walls) {
    const nodes = (wall?.nodes || []).filter((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y));
    const half = (Number(wall?.thicknessMm) || 0) / 2;
    for (let i = 0; i < nodes.length - 1; i += 1) {
      const a = nodes[i], b = nodes[i + 1];
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      if (length < 200) continue;
      let ux = (b.x - a.x) / length, uy = (b.y - a.y) / length;
      // One direction per line orientation, so in-line segments compare the same way round.
      if (ux < -1e-9 || (Math.abs(ux) <= 1e-9 && uy < 0)) { ux = -ux; uy = -uy; }
      const nx = -uy, ny = ux;
      const c = a.x * nx + a.y * ny;
      const s0 = Math.min(a.x * ux + a.y * uy, b.x * ux + b.y * uy), s1 = Math.max(a.x * ux + a.y * uy, b.x * ux + b.y * uy);
      segments.push({ ux, uy, nx, ny, c, s0, s1, half });
    }
  }
  // Merge in-line segments: same direction, same line, touching or overlapping. A gap between them is
  // closed only where a door or window was found in it (options.openings, mm): two pieces of wall in line
  // with building between them (two wings) are not one wall.
  segments.sort((p, q) => (Math.atan2(p.uy, p.ux) - Math.atan2(q.uy, q.ux)) || (p.c - q.c) || (p.s0 - q.s0));
  const sameLine = (p, q) => Math.abs(p.ux * q.ux + p.uy * q.uy) > 0.9995 && Math.abs(p.c - q.c) <= options.lineToleranceMm;
  const openingIn = (line, g0, g1) => (options.openings || []).some((o) => Number.isFinite(o?.x) && Number.isFinite(o?.y)
    && Math.abs(across(line, o)) <= line.half + 400 && along(line, o) >= g0 - 200 && along(line, o) <= g1 + 200);
  const lines = [];
  for (const segment of segments) {
    const line = lines.find((item) => sameLine(item, segment) && segment.s0 <= item.s1 + options.toleranceMm && segment.s1 >= item.s0 - options.toleranceMm);
    if (line) { line.s0 = Math.min(line.s0, segment.s0); line.s1 = Math.max(line.s1, segment.s1); line.half = Math.max(line.half, segment.half); }
    else lines.push({ ...segment });
  }
  for (let merged = true; merged;) {
    merged = false;
    for (let i = 0; i < lines.length && !merged; i += 1) for (let j = 0; j < lines.length && !merged; j += 1) {
      const p = lines[i], q = lines[j];
      if (i === j || !sameLine(p, q) || q.s0 < p.s1) continue;
      const gap = q.s0 - p.s1;
      if (gap > options.bridgeGapMm || !openingIn(p, p.s1, q.s0)) continue;
      p.s1 = Math.max(p.s1, q.s1); p.half = Math.max(p.half, q.half);
      lines.splice(j, 1); merged = true;
    }
  }
  return lines;
}

const along = (line, p) => p.x * line.ux + p.y * line.uy;
const across = (line, p) => p.x * line.nx + p.y * line.ny - line.c;

// Does segment p-q cross the wall line strictly within its extent?
function edgeCutsLine(line, p, q, tolerance) {
  const dp = across(line, p), dq = across(line, q);
  if ((dp > 0) === (dq > 0) || dp === dq) return false;
  const t = dp / (dp - dq);
  const s = along(line, { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
  return s >= line.s0 - tolerance && s <= line.s1 + tolerance;
}

// Which side of a wall line a footprint covers: sample the bands either side of it.
function coveredSide(line, polygon) {
  let plus = 0, minus = 0;
  for (const share of [0.25, 0.5, 0.75]) {
    const s = line.s0 + (line.s1 - line.s0) * share;
    for (let offset = 300; offset <= 4500; offset += 300) {
      const base = { x: line.ux * s + line.nx * line.c, y: line.uy * s + line.ny * line.c };
      const reach = line.half + offset;
      if (pointInPolygon({ x: base.x + line.nx * reach, y: base.y + line.ny * reach }, polygon)) plus += 1;
      if (pointInPolygon({ x: base.x - line.nx * reach, y: base.y - line.ny * reach }, polygon)) minus += 1;
    }
  }
  return plus === minus ? 0 : plus > minus ? 1 : -1;
}

/**
 * @param polygon outline corners (mm)
 * @param lines   exteriorWallLines(...)
 * @param options face: 'inner' (rooms) | 'outer' (footprint); anchor: a point inside the room (its name)
 *                for 'inner'; allowed: polygons (mm) a corner may sit in past the walls (drawn outdoor areas)
 * @returns {{ status: 'unchanged'|'contained'|'rejected', polygon, moves: [{ index, distanceMm }], beforeM2, afterM2, reason? }}
 */
export function containOutline(polygon, lines, overrides = {}) {
  const options = { ...CONTAINMENT_DEFAULTS, face: 'inner', anchor: null, allowed: [], ...overrides };
  const beforeM2 = Array.isArray(polygon) && polygon.length >= 3 ? Math.abs(shoelace(polygon)) / 1e6 : 0;
  if (!(beforeM2 > 0) || !lines?.length) return { status: 'unchanged', polygon, moves: [], beforeM2, afterM2: beforeM2 };
  // The room's side of each wall line (+1 / -1), or 0 where it cannot be told.
  const sides = lines.map((line) => {
    // The room name decides the side of a wall it sits along; for a wall beyond the name (an L room's
    // other arm), the side the room covers beside that wall decides.
    if (options.face === 'inner' && options.anchor) {
      const s = along(line, options.anchor), d = across(line, options.anchor);
      if (s >= line.s0 && s <= line.s1) return Math.abs(d) <= line.half ? 0 : Math.sign(d);
    }
    return coveredSide(line, polygon);
  });
  // In, on, or within allowedReachMm of a drawn outdoor area (traced outlines sit a line-width or so off).
  const nearEdge = (p, area) => area.some((a, i) => { const b = area[(i + 1) % area.length]; const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy;
    const t = l ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l)) : 0; return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy) <= options.allowedReachMm; });
  const allowedAt = (p) => (options.allowed || []).some((area) => area?.length >= 3 && (pointInPolygon(p, area) || nearEdge(p, area)));
  // A corner already on the face of another external wall is a real corner of the building: a measured
  // wall that runs on past a corner (into the building, as an internal wall) does not move it.
  const onAnotherFace = (p, except) => lines.some((line) => line !== except
    && Math.abs(Math.abs(across(line, p)) - line.half) <= options.faceToleranceMm
    && along(line, p) >= line.s0 - line.half - options.toleranceMm && along(line, p) <= line.s1 + line.half + options.toleranceMm);
  let current = polygon.map((p) => ({ x: p.x, y: p.y }));
  const moves = new Map();
  const startAt = current.map((p) => ({ ...p }));
  for (let pass = 0; pass < options.passes; pass += 1) {
    let movedThisPass = false;
    const n = current.length;
    for (let i = 0; i < n; i += 1) {
      const p = current[i];
      if (options.face === 'outer' && allowedAt(p)) continue;
      let best = null;
      lines.forEach((line, index) => {
        const side = sides[index];
        if (!side || onAnotherFace(p, line)) return;
        const face = options.face === 'inner' ? line.half : -line.half;
        const overshoot = face - side * across(line, p);
        if (overshoot <= options.toleranceMm || overshoot > options.maxMoveMm) return;
        // A footprint corner at the end of a wall line may be the corner of another wing (a notch in the
        // building), so for the footprint only corners well within the wall's length are moved; its corners
        // at wall ends are placed by the footprint wall constraint.
        const endSlack = options.face === 'outer' ? -(line.half + options.toleranceMm) : options.toleranceMm;
        const s = along(line, p);
        const alongWall = s >= line.s0 - endSlack && s <= line.s1 + endSlack;
        const reachedThroughWall = !alongWall && [current[(i + n - 1) % n], current[(i + 1) % n]]
          .some((q) => side * across(line, q) >= face - options.toleranceMm && edgeCutsLine(line, q, p, endSlack));
        if (!alongWall && !reachedThroughWall) return;
        if (!best || overshoot < best.overshoot) best = { line, side, overshoot };
      });
      if (!best) continue;
      current[i] = { x: p.x + best.line.nx * best.side * best.overshoot, y: p.y + best.line.ny * best.side * best.overshoot };
      moves.set(i, (moves.get(i) || 0) + best.overshoot);
      movedThisPass = true;
    }
    if (!movedThisPass) break;
  }
  if (!moves.size) return { status: 'unchanged', polygon, moves: [], beforeM2, afterM2: beforeM2 };
  const result = tidy(current);
  const afterM2 = result.length >= 3 ? Math.abs(shoelace(result)) / 1e6 : 0;
  const moveList = [...moves].map(([index, distanceMm]) => ({ index, distanceMm: Math.round(distanceMm), from: { x: Math.round(startAt[index].x), y: Math.round(startAt[index].y) }, to: { x: Math.round(current[index].x), y: Math.round(current[index].y) } }));
  if (result.length < 3 || !(afterM2 > 0)) return { status: 'rejected', polygon, moves: moveList, beforeM2, afterM2: 0, reason: 'nothing of the outline is inside the external walls' };
  if (crossesItself(result)) return { status: 'rejected', polygon, moves: moveList, beforeM2, afterM2, reason: 'moving it onto the wall faces folds the outline' };
  if (afterM2 < beforeM2 * (1 - options.maxAreaChange)) return { status: 'rejected', polygon, moves: moveList, beforeM2, afterM2, reason: `most of the outline (${(beforeM2 - afterM2).toFixed(1)} of ${beforeM2.toFixed(1)} m²) is outside the external walls` };
  return { status: 'contained', polygon: result, moves: moveList, beforeM2, afterM2 };
}

/**
 * One corner (a corner being dragged on the canvas): moved back onto the inside face of any external
 * wall it has been taken past, as seen from a point inside the room. Returns { x, y, clipped }.
 */
export function containCorner(point, lines, anchor, overrides = {}) {
  const options = { ...CONTAINMENT_DEFAULTS, ...overrides };
  if (!point || !anchor || !lines?.length) return { ...point, clipped: false };
  let current = { x: point.x, y: point.y };
  let clipped = false;
  for (let pass = 0; pass < options.passes; pass += 1) {
    let best = null;
    for (const line of lines) {
      const d = across(line, anchor), sa = along(line, anchor);
      if (Math.abs(d) <= line.half || sa < line.s0 || sa > line.s1) continue;
      const side = Math.sign(d);
      const overshoot = line.half - side * across(line, current);
      if (overshoot <= options.toleranceMm || overshoot > options.maxMoveMm) continue;
      const s = along(line, current);
      const alongWall = s >= line.s0 - options.toleranceMm && s <= line.s1 + options.toleranceMm;
      if (!alongWall && !edgeCutsLine(line, anchor, current, options.toleranceMm)) continue;
      if (!best || overshoot < best.overshoot) best = { line, side, overshoot };
    }
    if (!best) break;
    current = { x: current.x + best.line.nx * best.side * best.overshoot, y: current.y + best.line.ny * best.side * best.overshoot };
    clipped = true;
  }
  return { ...current, clipped };
}
