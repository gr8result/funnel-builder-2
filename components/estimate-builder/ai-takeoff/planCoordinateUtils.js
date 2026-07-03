export function screenToDocument(screenPoint, view) {
  const scale = Number(view?.scale) || 1;
  const pan = view?.pan || { x: 0, y: 0 };
  const origin = view?.origin || { x: 0, y: 0 };
  return {
    x: (screenPoint.x - origin.x - pan.x) / scale,
    y: (screenPoint.y - origin.y - pan.y) / scale,
  };
}

export function screenPointFromEvent(event) {
  return {
    x: event.clientX,
    y: event.clientY,
  };
}

export function documentToScreen(documentPoint, view) {
  const scale = Number(view?.scale) || 1;
  const pan = view?.pan || { x: 0, y: 0 };
  const origin = view?.origin || { x: 0, y: 0 };
  return {
    x: origin.x + pan.x + documentPoint.x * scale,
    y: origin.y + pan.y + documentPoint.y * scale,
  };
}

export function documentDistance(a, b) {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

export function documentLength(points = []) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += documentDistance(points[i - 1], points[i]);
  }
  return total;
}
