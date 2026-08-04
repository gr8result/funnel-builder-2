// Explicit transforms between "visible rotated coordinates" (the pdf.js
// viewport's own pixel space at scale/rotation, before this app's own
// pan/zoom overlay is applied) and "base document coordinates" (unrotated
// PDF points — the same space pageToScreenPoint.js/screenToPagePoint.js
// store everything in). These are thin, explicitly-named wrappers around the
// pdf.js viewport's own convertToViewportPoint/convertToPdfPoint — the same
// primitives pageToScreenPoint/screenToPagePoint already use internally —
// so interactive code that needs to reason about rotation without pan/zoom
// in the mix (e.g. deciding calibration axis intent) doesn't have to thread
// panX/panY/zoomScale through just to cancel them back out.

export function baseToRotatedPoint(viewport, point) {
  const [x, y] = viewport.convertToViewportPoint(point.x, point.y);
  return { x, y };
}

export function rotatedToBasePoint(viewport, point) {
  const [x, y] = viewport.convertToPdfPoint(point.x, point.y);
  return { x, y };
}

export function baseToDisplayPoint(viewport, point) {
  return baseToRotatedPoint(viewport, point);
}

export function displayToBasePoint(viewport, point) {
  return rotatedToBasePoint(viewport, point);
}

export function rotatedToBaseDocumentPoint(viewport, point) {
  return rotatedToBasePoint(viewport, point);
}

export function baseDocumentToRotatedPoint(viewport, point) {
  return baseToRotatedPoint(viewport, point);
}

export function screenToDocumentPoint({ viewport, panX = 0, panY = 0, zoomScale = 1 }, point) {
  const rotated = {
    x: (point.x - panX) / zoomScale,
    y: (point.y - panY) / zoomScale,
  };
  return rotatedToBaseDocumentPoint(viewport, rotated);
}

export function documentToScreenPoint({ viewport, panX = 0, panY = 0, zoomScale = 1 }, point) {
  const rotated = baseDocumentToRotatedPoint(viewport, point);
  return {
    x: rotated.x * zoomScale + panX,
    y: rotated.y * zoomScale + panY,
  };
}

export function getRotatedPageSize({ sourceWidth = 0, sourceHeight = 0, rotation = 0 }) {
  const sideways = rotation === 90 || rotation === 270;
  return {
    width: sideways ? sourceHeight : sourceWidth,
    height: sideways ? sourceWidth : sourceHeight,
  };
}
