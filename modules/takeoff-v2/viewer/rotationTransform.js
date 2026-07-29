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
