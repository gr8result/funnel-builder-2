import { distancePx, midpoint, toPoint } from "./geometry.js";

export const SNAP_TYPES = Object.freeze({
  ENDPOINT: "endpoint",
  MIDPOINT: "midpoint",
  INTERSECTION: "intersection",
  CORNER: "corner",
  CV_LINE_ENDPOINT: "cv-line-endpoint",
});

export function createSnapPoint({ x = 0, y = 0, type = SNAP_TYPES.ENDPOINT, sourceId = "", weight = 1 } = {}) {
  return {
    x: Number(x || 0),
    y: Number(y || 0),
    type,
    sourceId,
    weight: Number(weight || 1),
  };
}

export function createSegment({ pointA, pointB, id = "", source = "manual" } = {}) {
  return {
    id,
    source,
    pointA: toPoint(pointA),
    pointB: toPoint(pointB),
  };
}

export function lineIntersection(segmentA, segmentB, epsilon = 1e-9) {
  const a = segmentA?.pointA;
  const b = segmentA?.pointB;
  const c = segmentB?.pointA;
  const d = segmentB?.pointB;
  if (!a || !b || !c || !d) {
    return null;
  }

  const denominator = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
  if (Math.abs(denominator) < epsilon) {
    return null;
  }

  const t = ((a.x - c.x) * (c.y - d.y) - (a.y - c.y) * (c.x - d.x)) / denominator;
  const u = -((a.x - b.x) * (a.y - c.y) - (a.y - b.y) * (a.x - c.x)) / denominator;
  if (t < -epsilon || t > 1 + epsilon || u < -epsilon || u > 1 + epsilon) {
    return null;
  }

  return {
    x: a.x + t * (b.x - a.x),
    y: a.y + t * (b.y - a.y),
  };
}

export function buildSnapPointsFromSegments(segments = []) {
  const points = [];
  for (const segment of segments) {
    if (!segment?.pointA || !segment?.pointB) {
      continue;
    }
    points.push(createSnapPoint({ ...segment.pointA, type: SNAP_TYPES.ENDPOINT, sourceId: `${segment.id}:a`, weight: 1.2 }));
    points.push(createSnapPoint({ ...segment.pointB, type: SNAP_TYPES.ENDPOINT, sourceId: `${segment.id}:b`, weight: 1.2 }));
    points.push(createSnapPoint({ ...midpoint(segment.pointA, segment.pointB), type: SNAP_TYPES.MIDPOINT, sourceId: `${segment.id}:mid`, weight: 0.85 }));
  }

  for (let outer = 0; outer < segments.length; outer += 1) {
    for (let inner = outer + 1; inner < segments.length; inner += 1) {
      const intersection = lineIntersection(segments[outer], segments[inner]);
      if (intersection) {
        points.push(createSnapPoint({
          ...intersection,
          type: SNAP_TYPES.INTERSECTION,
          sourceId: `${segments[outer].id}:${segments[inner].id}`,
          weight: 1.4,
        }));
      }
    }
  }

  return points;
}

export function createSegmentsFromPage(page = {}, drafts = {}) {
  const segments = [];
  const addSegment = (pointA, pointB, id, source = "manual") => {
    if (pointA && pointB) {
      segments.push(createSegment({ pointA, pointB, id, source }));
    }
  };

  if (page.scale?.pointA && page.scale?.pointB) {
    addSegment(page.scale.pointA, page.scale.pointB, "scale-reference", "scale");
  }
  if (drafts.scaleDraft?.pointA && drafts.scaleDraft?.pointB) {
    addSegment(drafts.scaleDraft.pointA, drafts.scaleDraft.pointB, "scale-draft", "scale-draft");
  }
  for (const measurement of page.measurements || []) {
    const pointA = measurement.pointA || measurement.points?.[0];
    const pointB = measurement.pointB || measurement.points?.[1];
    addSegment(pointA, pointB, measurement.id, "measurement");
  }
  if (drafts.measureDraft?.pointA && drafts.measureDraft?.pointB) {
    addSegment(drafts.measureDraft.pointA, drafts.measureDraft.pointB, "measure-draft", "measure-draft");
  }
  for (const area of page.areas || []) {
    const points = area.points || [];
    for (let index = 0; index < points.length; index += 1) {
      addSegment(points[index], points[(index + 1) % points.length], `${area.id}:${index}`, "area");
    }
  }
  const draftAreaPoints = drafts.areaDraft?.polygonPoints || [];
  for (let index = 1; index < draftAreaPoints.length; index += 1) {
    addSegment(draftAreaPoints[index - 1], draftAreaPoints[index], `area-draft:${index}`, "area-draft");
  }

  return segments;
}

export function findNearestSnapPoint(point, snapPoints = [], tolerancePx = 12) {
  const target = toPoint(point);
  let best = null;

  for (const snapPoint of snapPoints) {
    const distance = distancePx(target, snapPoint);
    const weightedDistance = distance / Math.max(0.1, Number(snapPoint.weight || 1));
    if (distance <= tolerancePx && (!best || weightedDistance < best.weightedDistance)) {
      best = {
        point: createSnapPoint(snapPoint),
        distance,
        weightedDistance,
      };
    }
  }

  return best;
}

export function snapPoint(point, snapPoints = [], options = {}) {
  if (options.enabled === false) {
    return {
      point: toPoint(point),
      snapped: false,
      snap: null,
    };
  }

  const nearest = findNearestSnapPoint(point, snapPoints, Number(options.tolerancePx || 12));
  if (!nearest) {
    return {
      point: toPoint(point),
      snapped: false,
      snap: null,
    };
  }

  return {
    point: toPoint(nearest.point),
    snapped: true,
    snap: nearest,
  };
}

export function detectLineSegmentsWithCv({ cv = null, imageData = null } = {}) {
  if (!cv || !imageData) {
    return {
      segments: [],
      available: false,
      reason: "OpenCV adapter is not available.",
    };
  }

  return {
    segments: [],
    available: true,
    reason: "OpenCV adapter detected. Line extraction implementation is intentionally deferred from wall detection.",
  };
}
