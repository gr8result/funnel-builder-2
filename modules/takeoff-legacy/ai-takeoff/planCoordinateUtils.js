export function normalizeRotation(value) {
  const degrees = Number(value) || 0;
  const normalized = ((degrees % 360) + 360) % 360;
  return [0, 90, 180, 270].includes(normalized) ? normalized : 0;
}

function normalizeDegrees(value) {
  const degrees = Number(value) || 0;
  return ((degrees % 360) + 360) % 360;
}

export function calculateFinalRotation({
  metadataRotation = 0,
  detectedRotation = 0,
  userRotation = 0,
} = {}) {
  return normalizeRotation(Number(metadataRotation) + Number(detectedRotation) + Number(userRotation));
}

export function screenToPlanPoint(screenX, screenY, viewState = {}) {
  const zoom = Number(viewState.zoom ?? viewState.scale) || 1;
  const pan = viewState.pan || { x: 0, y: 0 };
  const origin = viewState.origin || { x: 0, y: 0 };
  return {
    x: (Number(screenX) - origin.x - pan.x) / zoom,
    y: (Number(screenY) - origin.y - pan.y) / zoom,
  };
}

export function screenToPagePoint(screenX, screenY, viewState = {}) {
  return screenToPlanPoint(screenX, screenY, viewState);
}

export function planToScreenPoint(planX, planY, viewState = {}) {
  const zoom = Number(viewState.zoom ?? viewState.scale) || 1;
  const pan = viewState.pan || { x: 0, y: 0 };
  const origin = viewState.origin || { x: 0, y: 0 };
  return {
    x: origin.x + pan.x + Number(planX) * zoom,
    y: origin.y + pan.y + Number(planY) * zoom,
  };
}

export function pageToScreenPoint(pageX, pageY, viewState = {}) {
  return planToScreenPoint(pageX, pageY, viewState);
}

export function zoomViewportToPoint(viewState = {}, screenX, screenY, nextZoom) {
  const currentZoom = Number(viewState.zoom ?? viewState.scale) || 1;
  const zoom = Number(nextZoom) || currentZoom;
  const pan = viewState.pan || { x: 0, y: 0 };
  const origin = viewState.origin || { x: 0, y: 0 };
  const world = screenToPlanPoint(screenX, screenY, { zoom: currentZoom, pan, origin });
  return {
    zoom,
    pan: {
      x: Number(screenX) - origin.x - world.x * zoom,
      y: Number(screenY) - origin.y - world.y * zoom,
    },
    origin,
  };
}

export function calculateFitView(containerWidth, containerHeight, imageWidth, imageHeight, paddingRatio = 0.94) {
  const cw = Number(containerWidth);
  const ch = Number(containerHeight);
  const iw = Number(imageWidth);
  const ih = Number(imageHeight);
  if (!(cw > 0 && ch > 0 && iw > 0 && ih > 0)) {
    return { zoom: 1, pan: { x: 32, y: 32 } };
  }
  const zoom = Math.min(cw / iw, ch / ih) * Number(paddingRatio || 1);
  return {
    zoom,
    pan: {
      x: (cw - iw * zoom) / 2,
      y: (ch - ih * zoom) / 2,
    },
  };
}

export function distancePx(pointA, pointB) {
  return Math.sqrt((pointB.x - pointA.x) ** 2 + (pointB.y - pointA.y) ** 2);
}

export function polygonAreaPx(points = []) {
  if (points.length < 3) return 0;
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    area += current.x * next.y - next.x * current.y;
  }
  return Math.abs(area / 2);
}

export function snapAngle(pointA, pointB, allowedAngles = []) {
  if (!pointA || !pointB || !allowedAngles.length) return pointB;
  const length = distancePx(pointA, pointB);
  if (!length) return { ...pointB };
  const rawAngle = normalizeDegrees(Math.atan2(pointB.y - pointA.y, pointB.x - pointA.x) * 180 / Math.PI);
  const nearest = allowedAngles
    .map((angle) => normalizeDegrees(angle))
    .reduce((best, angle) => {
      const diff = Math.min(Math.abs(rawAngle - angle), 360 - Math.abs(rawAngle - angle));
      return diff < best.diff ? { angle, diff } : best;
    }, { angle: 0, diff: Infinity }).angle;
  const radians = nearest * Math.PI / 180;
  return {
    x: pointA.x + Math.cos(radians) * length,
    y: pointA.y + Math.sin(radians) * length,
  };
}

export function calculatePixelsPerMetre(pointA, pointB, realDistanceMetres) {
  const metres = Number(realDistanceMetres);
  const px = distancePx(pointA, pointB);
  return px > 0 && metres > 0 ? px / metres : null;
}

export function pxToMetres(px, pixelsPerMetre) {
  const ppm = Number(pixelsPerMetre);
  return ppm > 0 ? Number(px) / ppm : null;
}

export function pxToMillimetres(px, pixelsPerMetre) {
  const metres = pxToMetres(px, pixelsPerMetre);
  return metres == null ? null : metres * 1000;
}

export function formatMillimetres(value, { includeMetres = true } = {}) {
  const mm = Number(value);
  if (!Number.isFinite(mm)) return "-";
  const rounded = Math.round(mm);
  const main = `${rounded.toLocaleString()} mm`;
  if (!includeMetres) return main;
  return `${main} (${(mm / 1000).toFixed(2)} m)`;
}

// Backward-compatible aliases for older tests/imports.
export const screenToDocument = (screenPoint, view) => screenToPlanPoint(screenPoint.x, screenPoint.y, view);
export const documentToScreen = (documentPoint, view) => planToScreenPoint(documentPoint.x, documentPoint.y, view);
export const documentDistance = distancePx;
export function documentLength(points = []) {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += distancePx(points[index - 1], points[index]);
  }
  return total;
}

export function screenPointFromEvent(event) {
  return {
    x: event.clientX,
    y: event.clientY,
  };
}
