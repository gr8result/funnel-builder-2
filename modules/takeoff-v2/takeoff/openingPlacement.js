// Places/keeps windows, doors and other wall openings exactly on their host
// wall's line, in page-space (unrotated PDF points) — the same coordinate
// space every other geometry type in this module uses. Widths are always
// computed from calibrated geometry, never trusted from a label.

import { distance } from "./geometry.js";

// Nearest point on segment wallStart->wallEnd to `point`, plus the
// parametric position t (0 = wallStart, 1 = wallEnd) along it.
export function projectOntoWall(point, wallStart, wallEnd) {
  const abx = wallEnd.x - wallStart.x;
  const aby = wallEnd.y - wallStart.y;
  const lengthSquared = abx * abx + aby * aby;
  if (lengthSquared === 0) return { point: { x: wallStart.x, y: wallStart.y }, t: 0 };
  let t = ((point.x - wallStart.x) * abx + (point.y - wallStart.y) * aby) / lengthSquared;
  t = Math.max(0, Math.min(1, t));
  return { point: { x: wallStart.x + t * abx, y: wallStart.y + t * aby }, t };
}

export function computeOpeningWidthMm(start, end, mmPerDocumentUnit) {
  return distance(start, end) * mmPerDocumentUnit;
}

function faceOffset(face, wallStart, normal) {
  if (!face?.start || !face?.end) return null;
  const a = (face.start.x - wallStart.x) * normal.nx + (face.start.y - wallStart.y) * normal.ny;
  const b = (face.end.x - wallStart.x) * normal.nx + (face.end.y - wallStart.y) * normal.ny;
  return (a + b) / 2;
}

function wallBandHitDistance(point, wallStart, wallEnd, segment) {
  if (!segment?.faceA?.start || !segment?.faceA?.end || !segment?.faceB?.start || !segment?.faceB?.end) return null;
  const dx = wallEnd.x - wallStart.x;
  const dy = wallEnd.y - wallStart.y;
  const len = Math.hypot(dx, dy);
  if (!(len > 0)) return null;
  const normal = { nx: -dy / len, ny: dx / len };
  const offsetA = faceOffset(segment.faceA, wallStart, normal);
  const offsetB = faceOffset(segment.faceB, wallStart, normal);
  if (!Number.isFinite(offsetA) || !Number.isFinite(offsetB)) return null;
  const pointerOffset = (point.x - wallStart.x) * normal.nx + (point.y - wallStart.y) * normal.ny;
  const minOffset = Math.min(offsetA, offsetB);
  const maxOffset = Math.max(offsetA, offsetB);
  if (pointerOffset >= minOffset && pointerOffset <= maxOffset) return 0;
  return Math.min(Math.abs(pointerOffset - minOffset), Math.abs(pointerOffset - maxOffset));
}

// Searches every segment across one or more wall graphs (exterior + internal)
// for the nearest one within tolerance — used for "hover highlights the host
// wall" and to resolve which wall a newly-placed opening belongs to.
// `wallGraphs`: [{ key: "exterior"|"internal", vertices, segments }]
export function findNearestWallSegment(point, wallGraphs, toleranceDocUnits) {
  let best = null;
  wallGraphs.forEach(({ key, vertices, segments }) => {
    const byId = new Map(vertices.map((v) => [v.id, v]));
    segments.forEach((segment) => {
      const a = byId.get(segment.aId);
      const b = byId.get(segment.bId);
      if (!a || !b) return;
      const { point: projected } = projectOntoWall(point, a, b);
      const centrelineDistance = distance(projected, point);
      const bandDistance = wallBandHitDistance(point, a, b, segment);
      const d = bandDistance == null ? centrelineDistance : Math.min(centrelineDistance, bandDistance);
      if (d <= toleranceDocUnits && (!best || d < best.distance)) {
        best = {
          wallId: segment.id,
          wallGraph: key,
          start: { x: a.x, y: a.y },
          end: { x: b.x, y: b.y },
          point: projected,
          distance: d,
        };
      }
    });
  });
  return best;
}

// Keeps a single opening's start/end exactly on its host wall's line after
// the wall's endpoints move, by preserving the opening's fractional position
// along the wall (computed against the wall's *old* endpoints) rather than
// its absolute coordinates.
export function reattachOpeningToWall(opening, oldWallStart, oldWallEnd, newWallStart, newWallEnd) {
  const startT = projectOntoWall(opening.start, oldWallStart, oldWallEnd).t;
  const endT = projectOntoWall(opening.end, oldWallStart, oldWallEnd).t;
  const lerp = (t) => ({
    x: newWallStart.x + t * (newWallEnd.x - newWallStart.x),
    y: newWallStart.y + t * (newWallEnd.y - newWallStart.y),
  });
  return { ...opening, start: lerp(startT), end: lerp(endT) };
}

export function reattachOpeningsToWall(openings, wallId, oldWallStart, oldWallEnd, newWallStart, newWallEnd) {
  return openings.map((opening) =>
    opening.wallId === wallId ? reattachOpeningToWall(opening, oldWallStart, oldWallEnd, newWallStart, newWallEnd) : opening
  );
}
