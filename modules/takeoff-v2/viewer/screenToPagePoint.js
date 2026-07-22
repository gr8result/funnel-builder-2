// Inverse of pageToScreenPoint.js — screen pixels within the viewport container
// back to PDF page space (points, unrotated).

export function screenToPagePoint({ viewport, panX = 0, panY = 0, zoomScale = 1 }, screenX, screenY) {
  const canvasX = (screenX - panX) / zoomScale;
  const canvasY = (screenY - panY) / zoomScale;
  const [pageX, pageY] = viewport.convertToPdfPoint(canvasX, canvasY);
  return { x: pageX, y: pageY };
}
