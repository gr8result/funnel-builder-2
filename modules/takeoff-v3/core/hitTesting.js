import { distance, pointById, wallPoints } from "./geometry.js";

export function nearestPoint(geometry, documentPoint, toleranceDocumentUnits) {
  let best = null;
  for (const point of geometry.points) {
    const d = distance(point, documentPoint);
    if (d <= toleranceDocumentUnits && (!best || d < best.distance)) {
      best = { type: "point", point, distance: d };
    }
  }
  return best;
}

export function distanceToSegment(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length2 = dx * dx + dy * dy;
  if (!length2) return distance(point, a);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length2));
  return distance(point, { x: a.x + t * dx, y: a.y + t * dy });
}

export function nearestWall(geometry, documentPoint, toleranceDocumentUnits) {
  let best = null;
  for (const wall of geometry.walls) {
    const [a, b] = wallPoints(geometry, wall);
    if (!a || !b) continue;
    const d = distanceToSegment(documentPoint, a, b);
    if (d <= toleranceDocumentUnits && (!best || d < best.distance)) {
      best = { type: "wall", wall, distance: d };
    }
  }
  return best;
}

export function pointForWallEndpoint(geometry, wallId, endpoint) {
  const wall = geometry.walls.find((candidate) => candidate.id === wallId);
  if (!wall) return null;
  return pointById(geometry, endpoint === "end" ? wall.endPointId : wall.startPointId);
}
