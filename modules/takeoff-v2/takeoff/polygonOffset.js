// Inward polygon offset (shrink a closed polygon by a fixed distance), used
// to estimate an internal floor-area boundary from an outside-face exterior
// perimeter + a wall thickness. Classic "offset each edge along its normal,
// then intersect consecutive offset edges" construction — correct for both
// convex and reflex (concave) corners as long as the offset doesn't collapse
// a feature (e.g. a very narrow wing narrower than 2x the wall thickness).
//
// This module never guesses which normal direction is "inward": it computes
// both directions and keeps whichever produces a smaller, still-valid simple
// polygon, so it works regardless of the page-space winding/vertex order or
// y-axis convention in effect.

import { polygonAreaDocUnits2, isSimplePolygon } from "./geometry.js";

function shiftEdgesAlongNormal(vertices, distanceDocUnits, sign) {
  const n = vertices.length;
  const edges = [];
  for (let i = 0; i < n; i += 1) {
    const a = vertices[i];
    const b = vertices[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-9) return null;
    const ux = dx / len;
    const uy = dy / len;
    const nx = sign * -uy;
    const ny = sign * ux;
    edges.push({
      a: { x: a.x + nx * distanceDocUnits, y: a.y + ny * distanceDocUnits },
      b: { x: b.x + nx * distanceDocUnits, y: b.y + ny * distanceDocUnits },
    });
  }
  return edges;
}

// Intersection of two infinite lines defined by point pairs (a1,a2) and (b1,b2).
function lineIntersection(a1, a2, b1, b2) {
  const d1x = a2.x - a1.x;
  const d1y = a2.y - a1.y;
  const d2x = b2.x - b1.x;
  const d2y = b2.y - b1.y;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-9) return null; // parallel edges — degenerate corner
  const t = ((b1.x - a1.x) * d2y - (b1.y - a1.y) * d2x) / denom;
  return { x: a1.x + d1x * t, y: a1.y + d1y * t };
}

function offsetOneDirection(vertices, distanceDocUnits, sign) {
  const edges = shiftEdgesAlongNormal(vertices, distanceDocUnits, sign);
  if (!edges) return null;
  const n = edges.length;
  const result = [];
  for (let i = 0; i < n; i += 1) {
    const prev = edges[(i - 1 + n) % n];
    const curr = edges[i];
    const point = lineIntersection(prev.a, prev.b, curr.a, curr.b);
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
    result.push(point);
  }
  if (!isSimplePolygon(result)) return null;
  return result;
}

function bothCandidates(vertices, distanceDocUnits) {
  const candidateA = offsetOneDirection(vertices, distanceDocUnits, 1);
  const candidateB = offsetOneDirection(vertices, distanceDocUnits, -1);
  return {
    candidateA, candidateB,
    areaA: candidateA ? polygonAreaDocUnits2(candidateA) : null,
    areaB: candidateB ? polygonAreaDocUnits2(candidateB) : null,
  };
}

// Returns the inward-offset polygon (page-space points), or null if the
// offset can't be computed cleanly (degenerate edges, or the shrink makes
// the polygon cross itself — e.g. thickness too large for a narrow wing).
// Callers must treat null as "could not calculate automatically" and fall
// back to manual tracing, per spec — never silently returning zero.
export function offsetPolygonInward(vertices, distanceDocUnits) {
  if (!Array.isArray(vertices) || vertices.length < 3) return null;
  if (!(distanceDocUnits > 0)) return null;

  const originalArea = polygonAreaDocUnits2(vertices);
  const { candidateA, candidateB, areaA, areaB } = bothCandidates(vertices, distanceDocUnits);
  const a = areaA ?? Infinity;
  const b = areaB ?? Infinity;
  const best = a <= b ? candidateA : candidateB;
  const bestArea = Math.min(a, b);
  if (!best || !(bestArea < originalArea) || !(bestArea > 0)) return null;
  return best;
}

// The outward counterpart — expands the polygon (e.g. going from a wall
// centreline or inside face out to the external footprint). Same
// shift-and-intersect construction, keeping whichever direction produces the
// *larger* valid simple polygon. Outward offsets are more prone to
// self-intersecting at sharp reflex corners than inward ones, so this still
// fails closed (null) rather than ever returning a crossed polygon.
export function offsetPolygonOutward(vertices, distanceDocUnits) {
  if (!Array.isArray(vertices) || vertices.length < 3) return null;
  if (!(distanceDocUnits > 0)) return null;

  const originalArea = polygonAreaDocUnits2(vertices);
  const { candidateA, candidateB, areaA, areaB } = bothCandidates(vertices, distanceDocUnits);
  const a = areaA ?? -Infinity;
  const b = areaB ?? -Infinity;
  const best = a >= b ? candidateA : candidateB;
  const bestArea = Math.max(a, b);
  if (!best || !(bestArea > originalArea)) return null;
  return best;
}
