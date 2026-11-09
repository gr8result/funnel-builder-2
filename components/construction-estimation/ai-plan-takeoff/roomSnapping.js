// Snapping a dragged room corner onto the walls drawn on the sheet. Targets, nearest first within the
// tolerance: a wall corner (centreline node or a corner of the wall body), else a wall face or the
// wall centreline. A room is measured to the inside face of its walls, so faces are offered as well as
// centrelines; whichever line the builder drops the corner closest to is used.
import { generateOffsetPolygon } from './wallUtils.js';

const segmentsOf = (points, closed = false) => {
  const list = [];
  for (let i = 0; i < points.length - 1; i += 1) list.push([points[i], points[i + 1]]);
  if (closed && points.length > 2) list.push([points[points.length - 1], points[0]]);
  return list;
};

// walls: completedWallRuns of the sheet (plan pixels); pixelsPerMm: the sheet scale.
export function roomSnapTargets(walls = [], pixelsPerMm = 1) {
  const points = [], segments = [];
  for (const wall of walls) {
    const nodes = (wall.nodes || []).filter((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y));
    if (nodes.length < 2) continue;
    points.push(...nodes);
    segments.push(...segmentsOf(nodes).map(([a, b]) => ({ a, b, kind: 'centreline' })));
    const thickness = Number(wall.thicknessMm) || 0;
    if (thickness > 0) {
      const body = generateOffsetPolygon(nodes, thickness, wall.alignment, pixelsPerMm).filter((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y));
      points.push(...body);
      segments.push(...segmentsOf(body, true).map(([a, b]) => ({ a, b, kind: 'face' })));
    }
  }
  return { points, segments };
}

function project(point, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length)) : 0;
  const x = a.x + t * dx, y = a.y + t * dy;
  return { x, y, distance: Math.hypot(point.x - x, point.y - y) };
}

// Returns { x, y, snapped: 'corner' | 'face' | 'centreline' | null }.
export function snapRoomVertex(point, targets, tolerancePx) {
  let best = null;
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
