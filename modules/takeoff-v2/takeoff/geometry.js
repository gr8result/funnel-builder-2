// Pure geometry helpers operating on page-space points (PDF points, unrotated).
// Ported/adapted from components/estimate-builder/ai-takeoff/planCoordinateUtils.js
// and components/estimate-builder/takeoff-engine/core/geometry.js.

export function distance(a, b) {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

export function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// Shoelace formula. Returns area in page-space units^2 (always >= 0).
export function polygonAreaDocUnits2(points = []) {
  if (!Array.isArray(points) || points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    area += current.x * next.y - next.x * current.y;
  }
  return Math.abs(area) / 2;
}

export function polygonPerimeter(points = []) {
  if (!Array.isArray(points) || points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length; i += 1) {
    total += distance(points[i], points[(i + 1) % points.length]);
  }
  return total;
}

// Returns the intersection point of segments a->b and c->d, or null if they
// don't cross within their bounds (endpoints included, within epsilon).
export function segmentIntersection(a, b, c, d, epsilon = 1e-9) {
  const denominator = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
  if (Math.abs(denominator) < epsilon) return null;
  const t = ((a.x - c.x) * (c.y - d.y) - (a.y - c.y) * (c.x - d.x)) / denominator;
  const u = -((a.x - b.x) * (a.y - c.y) - (a.y - b.y) * (a.x - c.x)) / denominator;
  if (t < -epsilon || t > 1 + epsilon || u < -epsilon || u > 1 + epsilon) return null;
  return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
}

// Checks that a closed polygon (points in order) has no crossing between
// non-adjacent edges. Used to block area confirmation on a self-intersecting
// perimeter.
export function isSimplePolygon(points = []) {
  if (!Array.isArray(points) || points.length < 3) return false;
  const n = points.length;
  for (let i = 0; i < n; i += 1) {
    const a1 = points[i];
    const a2 = points[(i + 1) % n];
    for (let j = i + 1; j < n; j += 1) {
      const adjacent = j === i || j === (i + 1) % n || (j + 1) % n === i;
      if (adjacent) continue;
      const b1 = points[j];
      const b2 = points[(j + 1) % n];
      if (segmentIntersection(a1, a2, b1, b2)) return false;
    }
  }
  return true;
}
