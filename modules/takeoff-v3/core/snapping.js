import { distance, pointById, wallPoints } from "./geometry.js";
import { distanceToSegment } from "./hitTesting.js";

export function getSnapCandidate(geometry, point, toleranceDocumentUnits = 8) {
  let best = null;
  for (const existingPoint of geometry.points) {
    const d = distance(point, existingPoint);
    if (d <= toleranceDocumentUnits && (!best || d < best.distance)) {
      best = { type: "existing-point", label: "Snapped to corner", point: existingPoint, distance: d };
    }
  }
  for (const wall of geometry.walls) {
    const [a, b] = wallPoints(geometry, wall);
    if (!a || !b) continue;
    const d = distanceToSegment(point, a, b);
    if (d <= toleranceDocumentUnits && (!best || d < best.distance)) {
      const horizontal = Math.abs(a.y - b.y) < Math.abs(a.x - b.x);
      best = {
        type: horizontal ? "horizontal-wall-line" : "vertical-wall-line",
        label: "Snapped to wall",
        point: horizontal ? { x: point.x, y: a.y } : { x: a.x, y: point.y },
        wallId: wall.id,
        distance: d,
      };
    }
  }
  return best || { type: "free", label: "Free point", point, distance: Infinity };
}

export function getEndpointSnap(geometry, point, toleranceDocumentUnits = 8) {
  const candidate = getSnapCandidate(geometry, point, toleranceDocumentUnits);
  if (candidate.type === "existing-point") return candidate;
  return { type: "free", label: "Free point", point, distance: Infinity };
}
