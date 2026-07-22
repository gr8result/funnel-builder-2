// Converts a point in PDF page space (points, unrotated — what calibration and
// measurements are stored in) to screen pixels within the viewport container.
//
// `viewport` is a pdfjs-dist PageViewport (or any object exposing the same
// convertToViewportPoint method) — it already encodes rotation and the base
// render scale. `panX`/`panY`/`zoomScale` are the viewer's own pan/zoom affine on
// top of that, kept separate from pdfjs so measurements never depend on
// interactive zoom state.

export function pageToScreenPoint({ viewport, panX = 0, panY = 0, zoomScale = 1 }, pageX, pageY) {
  const [canvasX, canvasY] = viewport.convertToViewportPoint(pageX, pageY);
  return {
    x: canvasX * zoomScale + panX,
    y: canvasY * zoomScale + panY,
  };
}
