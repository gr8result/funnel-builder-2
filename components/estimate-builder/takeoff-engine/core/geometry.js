import { createPoint } from "./types.js";

export function isFinitePoint(point) {
  return Boolean(point) && Number.isFinite(point.x) && Number.isFinite(point.y);
}

export function toPoint(point) {
  if (!point || typeof point !== "object") {
    return createPoint(0, 0);
  }
  return createPoint(point.x, point.y);
}

export function distancePx(pointA, pointB) {
  const a = toPoint(pointA);
  const b = toPoint(pointB);
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function midpoint(pointA, pointB) {
  const a = toPoint(pointA);
  const b = toPoint(pointB);
  return createPoint((a.x + b.x) / 2, (a.y + b.y) / 2);
}

export function polygonAreaPx2(points = []) {
  if (!Array.isArray(points) || points.length < 3) {
    return 0;
  }

  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = toPoint(points[index]);
    const next = toPoint(points[(index + 1) % points.length]);
    area += current.x * next.y - next.x * current.y;
  }

  return Math.abs(area) / 2;
}

export function polylineLengthPx(points = []) {
  if (!Array.isArray(points) || points.length < 2) {
    return 0;
  }

  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += distancePx(points[index - 1], points[index]);
  }
  return total;
}

export function boundingBox(points = []) {
  const validPoints = points.map(toPoint).filter(isFinitePoint);
  if (!validPoints.length) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  const xs = validPoints.map((point) => point.x);
  const ys = validPoints.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function round(value, decimals = 3) {
  const factor = 10 ** decimals;
  return Math.round((Number(value) || 0) * factor) / factor;
}

