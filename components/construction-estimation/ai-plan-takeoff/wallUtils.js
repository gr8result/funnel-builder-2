// wallUtils.js

// Standard Australian architectural wall thicknesses (mm)
export const STANDARD_WALL_THICKNESSES = [70, 90, 110, 150, 200, 230];

/**
 * Snaps any raw measured thickness to the nearest standard architectural wall size.
 */
export function snapToStandardThickness(measuredMm) {
  return STANDARD_WALL_THICKNESSES.reduce((prev, curr) =>
    Math.abs(curr - measuredMm) < Math.abs(prev - measuredMm) ? curr : prev
  );
}

/**
 * Reads pixel brightness from canvas context. Returns true if white/light background.
 */
function isLightBackground(ctx, x, y) {
  try {
    const pixel = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
    // Light background check (R, G, B all > 180)
    return pixel[0] > 180 && pixel[1] > 180 && pixel[2] > 180;
  } catch (e) {
    return true; // Edge of canvas fallback
  }
}

/**
 * Detects wall thickness by stepping across line boundaries along 5 parallel rays.
 */
export function detectWallThicknessAtPoint(ctx, startPoint, endPoint, pixelsPerMm, activeWallType) {
  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  const len = Math.hypot(dx, dy);

  // Default fallback if wall line is too short
  const defaultMm = activeWallType === 'exterior' ? 230 : 70;
  if (len < 5) return defaultMm;

  // Calculate perpendicular normal vectors (both directions)
  const nx = -dy / len;
  const ny = dx / len;

  const scale = pixelsPerMm || 1;
  const maxPx = 350 * scale; // Max search distance (~350mm)
  const step = 0.5; // Sub-pixel resolution scan step

  // Sample at 5 locations along the drawn wall line
  const sampleRatios = [0.2, 0.35, 0.5, 0.65, 0.8];
  const detectedMmList = [];

  sampleRatios.forEach((ratio) => {
    const originX = startPoint.x + dx * ratio;
    const originY = startPoint.y + dy * ratio;

    // Check both normal directions (+nx/ny and -nx/ny)
    const directions = [
      { dirX: nx, dirY: ny },
      { dirX: -nx, dirY: -ny }
    ];

    directions.forEach(({ dirX, dirY }) => {
      let rayDist = 0;
      let insideWallLine = false;
      let startWallPx = 0;
      let endWallPx = 0;

      for (let d = 0; d < maxPx; d += step) {
        const checkX = originX + dirX * d;
        const checkY = originY + dirY * d;
        const isBg = isLightBackground(ctx, checkX, checkY);

        // State 1: We hit the dark ink of the wall edge
        if (!isBg && !insideWallLine) {
          insideWallLine = true;
          startWallPx = d;
        }

        // State 2: We passed through the wall ink and reached white background again
        if (isBg && insideWallLine) {
          endWallPx = d;
          rayDist = endWallPx - startWallPx;
          break;
        }
      }

      const mm = rayDist / scale;
      // Accept valid wall thickness ranges (40mm to 300mm)
      if (mm >= 40 && mm <= 300) {
        detectedMmList.push(mm);
      }
    });
  });

  // If rays failed due to text/symbols, return the active wall type standard default
  if (detectedMmList.length === 0) return defaultMm;

  // Pick the smallest valid wall thickness found across rays
  const bestMm = Math.min(...detectedMmList);
  return snapToStandardThickness(bestMm);
}

/**
 * Snaps target node coordinates to existing wall nodes or corner points within a pixel radius.
 */
export function snapNodeToIntersections(point, walls = [], snapRadiusPx = 14) {
  let closest = { ...point };
  let minDistance = snapRadiusPx;

  walls.forEach((wall) => {
    if (!wall.nodes) return;
    wall.nodes.forEach((node) => {
      const dist = Math.hypot(node.x - point.x, node.y - point.y);
      if (dist < minDistance) {
        minDistance = dist;
        closest = { x: node.x, y: node.y };
      }
    });
  });

  return closest;
}

/**
 * Calculates miter join offsets for wall segment corners.
 */
function calculateMiter(nPrev, nNext, offsetDist) {
  const dx = nPrev.nx + nNext.nx;
  const dy = nPrev.ny + nNext.ny;
  const len = Math.hypot(dx, dy);

  if (len < 1e-4) return { x: nPrev.nx * offsetDist, y: nPrev.ny * offsetDist };

  const miterX = dx / len;
  const miterY = dy / len;
  const dot = nNext.nx * miterX + nNext.ny * miterY;

  if (Math.abs(dot) < 0.1) return { x: nPrev.nx * offsetDist, y: nPrev.ny * offsetDist };

  const length = offsetDist / dot;
  const maxLength = Math.abs(offsetDist) * 3;
  const actualLength = Math.sign(length) * Math.min(Math.abs(length), maxLength);

  return { x: miterX * actualLength, y: miterY * actualLength };
}

/**
 * Generates an offset polygon for drawing walls cleanly on canvas.
 */
export function generateOffsetPolygon(nodes, thicknessMm, alignMode, pixelsPerMm = 1) {
  if (!nodes || nodes.length < 2) return [];
  const tPx = thicknessMm * (pixelsPerMm || 1);
  const offsetDist = alignMode === 'outer' ? -tPx : tPx;

  const pts = nodes.filter((pt, idx) => {
    if (idx === 0) return true;
    return Math.hypot(pt.x - nodes[idx - 1].x, pt.y - nodes[idx - 1].y) > 0.01;
  });

  if (pts.length < 2) return [];
  const n = pts.length;
  const isClosed = n > 2 && Math.hypot(pts[0].x - pts[n - 1].x, pts[0].y - pts[n - 1].y) < 1e-3;

  const normals = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = pts[i + 1].x - pts[i].x;
    const dy = pts[i + 1].y - pts[i].y;
    const len = Math.hypot(dx, dy);
    if (len === 0) normals.push({ nx: 0, ny: 0 });
    else normals.push({ nx: -dy / len, ny: dx / len });
  }

  const baseSide = [];
  const offsetSide = [];

  for (let i = 0; i < pts.length; i++) {
    baseSide.push({ x: pts[i].x, y: pts[i].y });
    let offsetVector = { x: 0, y: 0 };

    if (i === 0) {
      if (isClosed && normals.length > 0) {
        offsetVector = calculateMiter(normals[normals.length - 1], normals[0], offsetDist);
      } else if (normals.length > 0) {
        offsetVector = { x: normals[0].nx * offsetDist, y: normals[0].ny * offsetDist };
      }
    } else if (i === pts.length - 1) {
      if (isClosed && normals.length > 0) {
        offsetVector = calculateMiter(normals[normals.length - 1], normals[0], offsetDist);
      } else if (normals.length > 0) {
        const nPrev = normals[normals.length - 1];
        offsetVector = { x: nPrev.nx * offsetDist, y: nPrev.ny * offsetDist };
      }
    } else {
      const nPrev = normals[i - 1];
      const nNext = normals[i];
      if (nPrev && nNext) {
        offsetVector = calculateMiter(nPrev, nNext, offsetDist);
      } else if (nPrev) {
        offsetVector = { x: nPrev.nx * offsetDist, y: nPrev.ny * offsetDist };
      }
    }

    offsetSide.push({
      x: pts[i].x + offsetVector.x,
      y: pts[i].y + offsetVector.y,
    });
  }

  return [...baseSide, ...offsetSide.reverse()];
}