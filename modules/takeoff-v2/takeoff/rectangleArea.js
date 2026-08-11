import { calculatePolygonAreaM2 } from "./areaCalculation.js";

export function rectangleVerticesFromCorners(a, b) {
  const x1 = Math.min(a.x, b.x);
  const x2 = Math.max(a.x, b.x);
  const y1 = Math.min(a.y, b.y);
  const y2 = Math.max(a.y, b.y);
  if (Math.abs(x2 - x1) < 0.0001 || Math.abs(y2 - y1) < 0.0001) return [];
  return [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: y2 },
    { x: x1, y: y2 },
  ];
}

export function rectangleAreaMetrics(vertices, mmPerDocumentUnit) {
  if (!Array.isArray(vertices) || vertices.length < 3 || !(mmPerDocumentUnit > 0)) return {};
  const calculatedAreaM2 = calculatePolygonAreaM2(vertices, mmPerDocumentUnit);
  return {
    calculatedAreaM2,
    grossAreaM2: calculatedAreaM2,
    excludedAreaM2: 0,
    netAreaM2: calculatedAreaM2,
    confirmedAreaM2: calculatedAreaM2,
  };
}
