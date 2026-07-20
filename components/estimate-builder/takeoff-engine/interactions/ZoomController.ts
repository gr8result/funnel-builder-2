import { zoomAtPoint } from "../rendering/ViewportController";
import type { ViewportState } from "../state/takeoffTypes";

export function zoomViewportFromWheel(viewport: ViewportState, point: { x: number; y: number }, deltaY: number) {
  const factor = Math.exp(-deltaY * 0.0015);
  return zoomAtPoint(viewport, point, viewport.scale * factor);
}
