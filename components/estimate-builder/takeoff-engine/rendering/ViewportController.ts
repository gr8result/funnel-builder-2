import type { ViewportState } from "../state/takeoffTypes";

export const MIN_VIEWPORT_SCALE = 0.08;
export const MAX_VIEWPORT_SCALE = 8;

export function createViewportState(overrides: Partial<ViewportState> = {}): ViewportState {
  return {
    scale: Number.isFinite(Number(overrides.scale)) ? Number(overrides.scale) : 1,
    offsetX: Number.isFinite(Number(overrides.offsetX)) ? Number(overrides.offsetX) : 0,
    offsetY: Number.isFinite(Number(overrides.offsetY)) ? Number(overrides.offsetY) : 0,
  };
}

export function clampScale(scale: number) {
  return Math.max(MIN_VIEWPORT_SCALE, Math.min(MAX_VIEWPORT_SCALE, Number(scale) || 1));
}

export function zoomAtPoint(viewport: ViewportState, point: { x: number; y: number }, nextScale: number): ViewportState {
  const current = createViewportState(viewport);
  const scale = clampScale(nextScale);
  const planX = (point.x - current.offsetX) / Math.max(0.0001, current.scale);
  const planY = (point.y - current.offsetY) / Math.max(0.0001, current.scale);
  return {
    scale,
    offsetX: point.x - planX * scale,
    offsetY: point.y - planY * scale,
  };
}

export function panViewport(viewport: ViewportState, deltaX: number, deltaY: number): ViewportState {
  const current = createViewportState(viewport);
  return {
    ...current,
    offsetX: current.offsetX + Number(deltaX || 0),
    offsetY: current.offsetY + Number(deltaY || 0),
  };
}

export function fitPage(container: { width: number; height: number }, page: { width: number; height: number }, padding = 32): ViewportState {
  const availableWidth = Math.max(1, container.width - padding * 2);
  const availableHeight = Math.max(1, container.height - padding * 2);
  const scale = clampScale(Math.min(availableWidth / Math.max(1, page.width), availableHeight / Math.max(1, page.height)));
  return {
    scale,
    offsetX: (container.width - page.width * scale) / 2,
    offsetY: (container.height - page.height * scale) / 2,
  };
}

export function fitWidth(container: { width: number; height: number }, page: { width: number; height: number }, padding = 32): ViewportState {
  const scale = clampScale((Math.max(1, container.width) - padding * 2) / Math.max(1, page.width));
  return {
    scale,
    offsetX: (container.width - page.width * scale) / 2,
    offsetY: padding,
  };
}
