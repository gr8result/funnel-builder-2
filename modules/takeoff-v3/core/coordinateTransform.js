export function documentToScreen({ viewport, panX = 0, panY = 0, zoomScale = 1 }, point) {
  const [canvasX, canvasY] = viewport.convertToViewportPoint(point.x, point.y);
  return {
    x: canvasX * zoomScale + panX,
    y: canvasY * zoomScale + panY,
  };
}

export function screenToDocument({ viewport, panX = 0, panY = 0, zoomScale = 1 }, point) {
  const canvasX = (point.x - panX) / zoomScale;
  const canvasY = (point.y - panY) / zoomScale;
  const [x, y] = viewport.convertToPdfPoint(canvasX, canvasY);
  return { x, y };
}
