import { clamp } from "./geometry.js";

export const DEFAULT_MIN_ZOOM = 0.1;
export const DEFAULT_MAX_ZOOM = 10;

export function createViewState(overrides = {}) {
  return {
    zoom: Number(overrides.zoom || 1),
    panX: Number(overrides.panX || 0),
    panY: Number(overrides.panY || 0),
    minZoom: Number(overrides.minZoom || DEFAULT_MIN_ZOOM),
    maxZoom: Number(overrides.maxZoom || DEFAULT_MAX_ZOOM),
  };
}

export function clampZoom(zoom, viewState = {}) {
  const minZoom = Number(viewState.minZoom || DEFAULT_MIN_ZOOM);
  const maxZoom = Number(viewState.maxZoom || DEFAULT_MAX_ZOOM);
  return clamp(Number(zoom || 1), minZoom, maxZoom);
}

export function imageToScreenPoint(point, viewState) {
  const view = createViewState(viewState);
  return {
    x: point.x * view.zoom + view.panX,
    y: point.y * view.zoom + view.panY,
  };
}

export function screenToImagePoint(point, viewState) {
  const view = createViewState(viewState);
  return {
    x: (point.x - view.panX) / view.zoom,
    y: (point.y - view.panY) / view.zoom,
  };
}

export function zoomToScreenPoint(viewState, screenPoint, nextZoom) {
  const view = createViewState(viewState);
  const zoom = clampZoom(nextZoom, view);
  const imagePoint = screenToImagePoint(screenPoint, view);

  return {
    ...view,
    zoom,
    panX: screenPoint.x - imagePoint.x * zoom,
    panY: screenPoint.y - imagePoint.y * zoom,
  };
}

export function panView(viewState, deltaX, deltaY) {
  const view = createViewState(viewState);
  return {
    ...view,
    panX: view.panX + Number(deltaX || 0),
    panY: view.panY + Number(deltaY || 0),
  };
}

export function calculateFitView({ containerWidth, containerHeight, imageWidth, imageHeight, padding = 24, minZoom = DEFAULT_MIN_ZOOM, maxZoom = DEFAULT_MAX_ZOOM }) {
  const availableWidth = Math.max(1, Number(containerWidth || 0) - padding * 2);
  const availableHeight = Math.max(1, Number(containerHeight || 0) - padding * 2);
  const width = Math.max(1, Number(imageWidth || 0));
  const height = Math.max(1, Number(imageHeight || 0));
  const zoom = clamp(Math.min(availableWidth / width, availableHeight / height), minZoom, maxZoom);

  return {
    zoom,
    panX: (Number(containerWidth || 0) - width * zoom) / 2,
    panY: (Number(containerHeight || 0) - height * zoom) / 2,
    minZoom,
    maxZoom,
  };
}

