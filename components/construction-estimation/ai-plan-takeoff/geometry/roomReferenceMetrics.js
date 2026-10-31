import { pointInPolygon } from './planGeometry.js';

export function polygonIntersectionOverUnion(first, second, pixelsPerMm, sampleStepMm = 100) {
  if (!(pixelsPerMm > 0) || !(sampleStepMm > 0) || first.length < 3 || second.length < 3) {
    throw new Error('Room polygon comparison needs two valid polygons and a positive plan scale.');
  }
  const x0 = Math.min(...first.map((point) => point.x), ...second.map((point) => point.x));
  const x1 = Math.max(...first.map((point) => point.x), ...second.map((point) => point.x));
  const y0 = Math.min(...first.map((point) => point.y), ...second.map((point) => point.y));
  const y1 = Math.max(...first.map((point) => point.y), ...second.map((point) => point.y));
  const step = Math.max(1, pixelsPerMm * sampleStepMm);
  let intersection = 0, union = 0;
  for (let y = y0 + step / 2; y < y1; y += step) for (let x = x0 + step / 2; x < x1; x += step) {
    const inFirst = pointInPolygon({ x, y }, first), inSecond = pointInPolygon({ x, y }, second);
    if (inFirst || inSecond) union += 1;
    if (inFirst && inSecond) intersection += 1;
  }
  return { iou: union ? intersection / union : 0, sampleStepMm: step / pixelsPerMm };
}