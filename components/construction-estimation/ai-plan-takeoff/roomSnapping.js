// Snapping a dragged room corner onto the walls drawn on the sheet. Targets, nearest first within the
// tolerance: a wall junction (where the faces of two walls meet), else a wall corner (centreline node or
// a corner of the wall body), else a wall face or the wall centreline. A corner taken past the inside
// face of an external wall (out into the yard) is pulled back onto that face. A room is measured to the inside face of its walls, so faces are offered as well as
// centrelines; whichever line the builder drops the corner closest to is used.
import { generateOffsetPolygon } from './wallUtils.js';
import { exteriorWallLines, containCorner } from './geometry/exteriorContainment.js';

const segmentsOf = (points, closed = false) => {
  const list = [];
  for (let i = 0; i < points.length - 1; i += 1) list.push([points[i], points[i + 1]]);
  if (closed && points.length > 2) list.push([points[points.length - 1], points[0]]);
  return list;
};

// walls: completedWallRuns of the sheet (plan pixels); pixelsPerMm: the sheet scale.
export function roomSnapTargets(walls = [], pixelsPerMm = 1) {
  const points = [], segments = [], faces = [], exterior = [];
  for (const wall of walls) {
    const nodes = (wall.nodes || []).filter((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y));
    if (nodes.length < 2) continue;
    points.push(...nodes);
    segments.push(...segmentsOf(nodes).map(([a, b]) => ({ a, b, kind: 'centreline' })));
    const thickness = Number(wall.thicknessMm) || 0;
    if (thickness > 0) {
      const body = generateOffsetPolygon(nodes, thickness, wall.alignment, pixelsPerMm).filter((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y));
      points.push(...body);
      const bodyFaces = segmentsOf(body, true).map(([a, b]) => ({ a, b, kind: 'face' }));
      segments.push(...bodyFaces);
      faces.push(...bodyFaces.map((face) => ({ ...face, key: wall.id ?? walls.indexOf(wall), reach: thickness * pixelsPerMm })));
    }
    if (wall.category === 'exterior') exterior.push({ nodes: nodes.map((p) => ({ x: p.x / pixelsPerMm, y: p.y / pixelsPerMm })), thicknessMm: thickness });
  }
  // Junctions: where a face of one wall meets a face of another (faces may stop just short of each other).
  const junctions = [];
  for (let i = 0; i < faces.length; i += 1) for (let j = i + 1; j < faces.length; j += 1) {
    if (faces[i].key === faces[j].key) continue;
    const hit = lineMeet(faces[i], faces[j], Math.max(faces[i].reach, faces[j].reach));
    if (hit && !junctions.some((p) => Math.hypot(p.x - hit.x, p.y - hit.y) < 0.5)) junctions.push(hit);
  }
  return { points, segments, junctions, exteriorLines: exteriorWallLines(exterior), pixelsPerMm };
}

// Where two non-parallel faces meet, if that point is on both (or within reach past an end of either).
function lineMeet(p, q, reach) {
  const rx = p.b.x - p.a.x, ry = p.b.y - p.a.y, sx = q.b.x - q.a.x, sy = q.b.y - q.a.y;
  const denominator = rx * sy - ry * sx;
  const lr = Math.hypot(rx, ry), ls = Math.hypot(sx, sy);
  if (!lr || !ls || Math.abs(denominator) < 0.2 * lr * ls) return null;
  const t = ((q.a.x - p.a.x) * sy - (q.a.y - p.a.y) * sx) / denominator;
  const u = ((q.a.x - p.a.x) * ry - (q.a.y - p.a.y) * rx) / denominator;
  const slackP = reach / lr, slackQ = reach / ls;
  if (t < -slackP || t > 1 + slackP || u < -slackQ || u > 1 + slackQ) return null;
  return { x: p.a.x + t * rx, y: p.a.y + t * ry };
}

function project(point, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length)) : 0;
  const x = a.x + t * dx, y = a.y + t * dy;
  return { x, y, distance: Math.hypot(point.x - x, point.y - y) };
}

// Returns { x, y, snapped: 'junction' | 'corner' | 'face' | 'centreline' | null }.
export function snapRoomVertex(point, targets, tolerancePx) {
  let best = null;
  for (const p of targets?.junctions || []) {
    const distance = Math.hypot(point.x - p.x, point.y - p.y);
    if (distance <= tolerancePx && (!best || distance < best.distance)) best = { x: p.x, y: p.y, distance, snapped: 'junction' };
  }
  if (best) return { x: best.x, y: best.y, snapped: best.snapped };
  for (const p of targets?.points || []) {
    const distance = Math.hypot(point.x - p.x, point.y - p.y);
    if (distance <= tolerancePx && (!best || distance < best.distance)) best = { x: p.x, y: p.y, distance, snapped: 'corner' };
  }
  if (best) return { x: best.x, y: best.y, snapped: best.snapped };
  for (const segment of targets?.segments || []) {
    const hit = project(point, segment.a, segment.b);
    if (hit.distance <= tolerancePx && (!best || hit.distance < best.distance)) best = { ...hit, snapped: segment.kind };
  }
  return best ? { x: best.x, y: best.y, snapped: best.snapped } : { x: point.x, y: point.y, snapped: null };
}

// Live figures while dragging (the saved room is measured again by measureRoom on drop).
export function polygonAreaPerimeter(polygon = [], pixelsPerMm = 1) {
  if (polygon.length < 3 || !(pixelsPerMm > 0)) return { areaM2: null, perimeterM: null };
  let twice = 0, perimeter = 0;
  polygon.forEach((a, i) => {
    const b = polygon[(i + 1) % polygon.length];
    twice += a.x * b.y - b.x * a.y;
    perimeter += Math.hypot(b.x - a.x, b.y - a.y);
  });
  return { areaM2: Math.abs(twice / 2) / (pixelsPerMm * pixelsPerMm) / 1e6, perimeterM: perimeter / pixelsPerMm / 1000 };
}

// A dragged corner stays inside the external walls: taken past the inside face of an external wall
// (as seen from the middle of the room before the drag), it is pulled back onto that face.
// polygon: the room before the drag (plan pixels). Returns { x, y, clipped }.
export function keepRoomCornerInside(point, polygon, targets) {
  const ppm = targets?.pixelsPerMm;
  if (!point || !(ppm > 0) || !targets?.exteriorLines?.length || !Array.isArray(polygon) || polygon.length < 3) return { ...point, clipped: false };
  let twice = 0, cx = 0, cy = 0;
  polygon.forEach((a, i) => { const b = polygon[(i + 1) % polygon.length]; const k = a.x * b.y - b.x * a.y; twice += k; cx += (a.x + b.x) * k; cy += (a.y + b.y) * k; });
  if (!twice) return { ...point, clipped: false };
  const centre = { x: cx / (3 * twice), y: cy / (3 * twice) };
  const result = containCorner({ x: point.x / ppm, y: point.y / ppm }, targets.exteriorLines, { x: centre.x / ppm, y: centre.y / ppm });
  return result.clipped ? { x: result.x * ppm, y: result.y * ppm, clipped: true } : { x: point.x, y: point.y, clipped: false };
}
