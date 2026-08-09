import { distance } from "./geometry.js";

const REGION_PAD = 14;
const COMPONENT_TOUCH_TOLERANCE = 10;

function boundsOfPoints(points = []) {
  if (!points.length) return null;
  return points.reduce(
    (acc, point) => ({
      minX: Math.min(acc.minX, point.x),
      minY: Math.min(acc.minY, point.y),
      maxX: Math.max(acc.maxX, point.x),
      maxY: Math.max(acc.maxY, point.y),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );
}

function linePoints(line) {
  if (line?.centerline?.start && line?.centerline?.end) return [line.centerline.start, line.centerline.end];
  if (line?.a && line?.b) return [line.a, line.b];
  return [];
}

function boundsFor(items = []) {
  return boundsOfPoints(items.flatMap(linePoints));
}

function rectFromBounds(bounds, pageWidth, pageHeight, pad = REGION_PAD) {
  if (!bounds) return null;
  const minX = Math.max(0, bounds.minX - pad);
  const minY = Math.max(0, bounds.minY - pad);
  const maxX = pageWidth > 0 ? Math.min(pageWidth, bounds.maxX + pad) : bounds.maxX + pad;
  const maxY = pageHeight > 0 ? Math.min(pageHeight, bounds.maxY + pad) : bounds.maxY + pad;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function polygonFromRect(rect) {
  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ];
}

function rectFromPolygon(polygon = []) {
  const bounds = boundsOfPoints(polygon);
  return bounds ? { x: bounds.minX, y: bounds.minY, width: bounds.maxX - bounds.minX, height: bounds.maxY - bounds.minY } : null;
}

export function pointInBuildingRegion(point, region, { tolerance = 0 } = {}) {
  const rect = region?.rect || rectFromPolygon(region?.polygon);
  if (!rect || !point) return false;
  return (
    point.x >= rect.x - tolerance &&
    point.x <= rect.x + rect.width + tolerance &&
    point.y >= rect.y - tolerance &&
    point.y <= rect.y + rect.height + tolerance
  );
}

export function segmentInBuildingRegion(segment, region, options = {}) {
  const [a, b] = linePoints(segment);
  return pointInBuildingRegion(a, region, options) && pointInBuildingRegion(b, region, options);
}

function overlap(a1, a2, b1, b2) {
  return Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));
}

function bandsTouch(a, b) {
  const ax = [Math.min(a.centerline.start.x, a.centerline.end.x), Math.max(a.centerline.start.x, a.centerline.end.x)];
  const ay = [Math.min(a.centerline.start.y, a.centerline.end.y), Math.max(a.centerline.start.y, a.centerline.end.y)];
  const bx = [Math.min(b.centerline.start.x, b.centerline.end.x), Math.max(b.centerline.start.x, b.centerline.end.x)];
  const by = [Math.min(b.centerline.start.y, b.centerline.end.y), Math.max(b.centerline.start.y, b.centerline.end.y)];
  if (a.orientation === b.orientation) {
    const parallelGap = a.orientation === "horizontal"
      ? Math.abs(a.centerline.start.y - b.centerline.start.y)
      : Math.abs(a.centerline.start.x - b.centerline.start.x);
    const alongOverlap = a.orientation === "horizontal" ? overlap(ax[0], ax[1], bx[0], bx[1]) : overlap(ay[0], ay[1], by[0], by[1]);
    return parallelGap <= COMPONENT_TOUCH_TOLERANCE && alongOverlap > 0;
  }
  return (
    ax[0] <= bx[1] + COMPONENT_TOUCH_TOLERANCE &&
    ax[1] >= bx[0] - COMPONENT_TOUCH_TOLERANCE &&
    ay[0] <= by[1] + COMPONENT_TOUCH_TOLERANCE &&
    ay[1] >= by[0] - COMPONENT_TOUCH_TOLERANCE
  );
}

function connectedBandComponents(wallBands = []) {
  const seen = new Set();
  const components = [];
  wallBands.forEach((band) => {
    if (seen.has(band.id)) return;
    const stack = [band];
    const group = [];
    seen.add(band.id);
    while (stack.length) {
      const current = stack.pop();
      group.push(current);
      wallBands.forEach((other) => {
        if (seen.has(other.id)) return;
        if (!bandsTouch(current, other)) return;
        seen.add(other.id);
        stack.push(other);
      });
    }
    components.push(group);
  });
  return components;
}

function componentScore(component, pageWidth, pageHeight) {
  const bounds = boundsFor(component);
  if (!bounds) return 0;
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const area = width * height;
  const orientations = new Set(component.map((band) => band.orientation));
  const touchesTitleBlock = pageHeight > 0 && bounds.minY < pageHeight * 0.12 && height < pageHeight * 0.24;
  const notesColumn = pageWidth > 0 && bounds.minX < pageWidth * 0.15 && width < pageWidth * 0.28;
  const pageFrame = pageWidth > 0 && pageHeight > 0 && width > pageWidth * 0.82 && height > pageHeight * 0.82;
  const orthogonalBonus = orientations.has("horizontal") && orientations.has("vertical") ? 1 : 0.08;
  const density = component.length / Math.max(Math.sqrt(Math.max(area, 1)), 1);
  const penalty = (touchesTitleBlock ? 0.05 : 1) * (notesColumn ? 0.25 : 1) * (pageFrame ? 0.05 : 1);
  return component.length * Math.sqrt(Math.max(area, 1)) * orthogonalBonus * (1 + density) * penalty;
}

export function detectBuildingRegion({ wallBands = [], lines = [], pageWidth = 0, pageHeight = 0 } = {}) {
  const components = connectedBandComponents(wallBands)
    .map((bands) => {
      const bounds = boundsFor(bands);
      return { bands, bounds, score: componentScore(bands, pageWidth, pageHeight) };
    })
    .filter((component) => component.bands.length >= 4 && component.bounds)
    .sort((a, b) => b.score - a.score);

  const best = components[0];
  if (!best || best.score <= 0) return { region: null, candidates: components, excludedRegions: [] };
  const rect = rectFromBounds(best.bounds, pageWidth, pageHeight);
  const pageArea = Math.max(pageWidth * pageHeight, 1);
  const confidence = Math.max(0.35, Math.min(0.96, 0.42 + Math.min(0.28, best.bands.length / 80) + Math.min(0.2, (rect.width * rect.height) / pageArea)));
  const excludedRegions = components.slice(1, 8).map((component) => {
    const excludedRect = rectFromBounds(component.bounds, pageWidth, pageHeight, 8);
    return excludedRect ? polygonFromRect(excludedRect) : null;
  }).filter(Boolean);
  return {
    region: {
      polygon: polygonFromRect(rect),
      rect,
      confidence,
      excludedRegions,
      supportBandIds: best.bands.map((band) => band.id),
    },
    candidates: components,
    excludedRegions,
    diagnostics: {
      candidateCount: components.length,
      selectedBandCount: best.bands.length,
      lineCount: lines.length,
      bounds: best.bounds,
      score: Math.round(best.score),
    },
  };
}

export function boundarySupportRatio(points = [], wallBands = [], tolerance = 8) {
  if (!Array.isArray(points) || points.length < 2) return 0;
  let supported = 0;
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    const length = distance(a, b);
    const hasSupport = wallBands.some((band) => distanceSegmentToSegment(a, b, band.centerline.start, band.centerline.end) <= tolerance && projectedOverlapRatio(a, b, band.centerline.start, band.centerline.end) >= 0.35);
    if (hasSupport) supported += length;
  }
  const total = points.reduce((sum, point, index) => sum + distance(point, points[(index + 1) % points.length]), 0);
  return total > 0 ? supported / total : 0;
}

function distancePointToSegment(point, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lengthSquared = abx * abx + aby * aby;
  if (lengthSquared === 0) return distance(point, a);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * abx + (point.y - a.y) * aby) / lengthSquared));
  return distance(point, { x: a.x + abx * t, y: a.y + aby * t });
}

function distanceSegmentToSegment(a, b, c, d) {
  return Math.min(distancePointToSegment(a, c, d), distancePointToSegment(b, c, d), distancePointToSegment(c, a, b), distancePointToSegment(d, a, b));
}

function projectedOverlapRatio(a, b, c, d) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (!(length > 0)) return 0;
  const ux = dx / length;
  const uy = dy / length;
  const project = (point) => point.x * ux + point.y * uy;
  const aa = [project(a), project(b)].sort((x, y) => x - y);
  const bb = [project(c), project(d)].sort((x, y) => x - y);
  return overlap(aa[0], aa[1], bb[0], bb[1]) / Math.max(Math.min(aa[1] - aa[0], bb[1] - bb[0]), 1);
}
