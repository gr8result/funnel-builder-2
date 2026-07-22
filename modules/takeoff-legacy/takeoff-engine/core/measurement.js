import { boundingBox, distancePx, midpoint, polygonAreaPx2 } from "./geometry.js";
import { formatMillimetres, formatSquareMillimetres, pixelsToMillimetres, pixelsToSquareMillimetres } from "./scale.js";
import { MEASUREMENT_TYPES } from "./types.js";

export function createDistanceMeasurement({ id, start, end, scale, label = "" }) {
  const pixelLength = distancePx(start, end);
  const lengthMm = pixelsToMillimetres(pixelLength, scale);

  return {
    id: id || `measurement-${Date.now()}`,
    type: MEASUREMENT_TYPES.DISTANCE,
    pointA: start,
    pointB: end,
    points: [start, end],
    pixelLength,
    lengthMm,
    displayText: formatMillimetres(lengthMm),
    labelPoint: midpoint(start, end),
    label,
    warning: lengthMm > 0 && lengthMm < 100 ? "This measurement is very small. Did you click both points correctly?" : "",
  };
}

export function createAreaMeasurement({ id, points, scale, label = "" }) {
  const areaPx2 = polygonAreaPx2(points);
  const areaMm2 = pixelsToSquareMillimetres(areaPx2, scale);
  const box = boundingBox(points);

  return {
    id: id || `area-${Date.now()}`,
    type: MEASUREMENT_TYPES.AREA,
    points,
    areaPx2,
    areaMm2,
    displayText: formatSquareMillimetres(areaMm2),
    labelPoint: {
      x: box.minX + box.width / 2,
      y: box.minY + box.height / 2,
    },
    label,
  };
}

export function rectanglePointsFromCorners(pointA, pointB) {
  if (!pointA || !pointB) {
    return [];
  }

  return [
    { x: pointA.x, y: pointA.y },
    { x: pointB.x, y: pointA.y },
    { x: pointB.x, y: pointB.y },
    { x: pointA.x, y: pointB.y },
  ];
}

export function buildRectangleArea({ pointA, pointB, scale, label = "" }) {
  const points = rectanglePointsFromCorners(pointA, pointB);
  if (!scale) {
    throw new Error("Set scale before measuring areas.");
  }
  if (points.length !== 4) {
    throw new Error("Select two rectangle corners before saving area.");
  }

  return createAreaMeasurement({ points, scale, label });
}

export function buildPolygonArea({ points, scale, label = "" }) {
  if (!scale) {
    throw new Error("Set scale before measuring areas.");
  }
  if (!Array.isArray(points) || points.length < 3) {
    throw new Error("Select at least three polygon points before saving area.");
  }

  return createAreaMeasurement({ points, scale, label });
}

export function recalculateMeasurement(measurement, scale) {
  if (measurement?.type === MEASUREMENT_TYPES.AREA) {
    return createAreaMeasurement({ ...measurement, points: measurement.points, scale });
  }

  const [start, end] = measurement?.points || [];
  return createDistanceMeasurement({ ...measurement, start, end, scale });
}
