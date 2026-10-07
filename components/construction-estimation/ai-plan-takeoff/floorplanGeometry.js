export function resolveFloorplanPoint(rawPoint, snappedPoint, previousPoint, shiftKey = false) {
  const candidate = snappedPoint || rawPoint;

  if (!shiftKey || !previousPoint) {
    return { x: candidate.x, y: candidate.y };
  }

  const dx = Math.abs(candidate.x - previousPoint.x);
  const dy = Math.abs(candidate.y - previousPoint.y);

  if (dx >= dy) {
    return { x: candidate.x, y: previousPoint.y };
  }

  return { x: previousPoint.x, y: candidate.y };
}

export function resolveFloorplanFreePoint(rawPoint, previousPoint, shiftKey = false) {
  if (!shiftKey || !previousPoint) {
    return { x: rawPoint.x, y: rawPoint.y };
  }

  return resolveFloorplanPoint(rawPoint, rawPoint, previousPoint, true);
}

export function findFloorplanCornerSnapPoint(vectorSegments, rawPoint, snapRadius) {
  let bestSnap = null;
  let minDistance = snapRadius;

  for (let seg of vectorSegments || []) {
    const endpoints = [
      { x: seg.x1, y: seg.y1 },
      { x: seg.x2, y: seg.y2 }
    ];

    for (let endpoint of endpoints) {
      const distance = Math.hypot(endpoint.x - rawPoint.x, endpoint.y - rawPoint.y);
      if (distance < minDistance) {
        minDistance = distance;
        bestSnap = { x: endpoint.x, y: endpoint.y, snapped: true, nearestSegment: seg };
      }
    }
  }

  return bestSnap || { x: rawPoint.x, y: rawPoint.y, snapped: false, nearestSegment: null };
}

export function calculatePolygonAreaM2(nodes, scalePxPerMm) {
  if (!nodes || nodes.length < 3 || !scalePxPerMm) return 0;

  let areaPxSq = 0;
  for (let i = 0; i < nodes.length; i++) {
    const nextIndex = (i + 1) % nodes.length;
    areaPxSq += nodes[i].x * nodes[nextIndex].y;
    areaPxSq -= nodes[nextIndex].x * nodes[i].y;
  }

  return Math.abs(areaPxSq / 2) / (scalePxPerMm * scalePxPerMm) / 1000000;
}
