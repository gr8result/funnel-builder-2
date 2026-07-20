import { normalizeRotation } from "./orientation.js";
import { createViewState } from "./viewTransform.js";

export function createPlanPoint(point = {}) {
  return {
    x: Number.isFinite(Number(point.x)) ? Number(point.x) : 0,
    y: Number.isFinite(Number(point.y)) ? Number(point.y) : 0,
  };
}

export function applyPageRotation(point = {}, dimensions = {}, rotation = 0) {
  const source = createPlanPoint(point);
  const width = Number(dimensions.width ?? dimensions.pageWidth ?? dimensions.imageWidth ?? 0);
  const height = Number(dimensions.height ?? dimensions.pageHeight ?? dimensions.imageHeight ?? 0);

  switch (normalizeRotation(rotation)) {
    case 90:
      return { x: height - source.y, y: source.x };
    case 180:
      return { x: width - source.x, y: height - source.y };
    case 270:
      return { x: source.y, y: width - source.x };
    default:
      return source;
  }
}

export function unapplyPageRotation(point = {}, dimensions = {}, rotation = 0) {
  return applyPageRotation(point, dimensions, normalizeRotation(360 - normalizeRotation(rotation)));
}

export function pdfToPlanCoordinates(point = {}, page = {}) {
  const pdfPoint = createPlanPoint(point);
  const dimensions = {
    width: page.pageWidthPoints || page.metadata?.pageWidthPoints || page.pdfWidthPoints || page.imageWidth || 0,
    height: page.pageHeightPoints || page.metadata?.pageHeightPoints || page.pdfHeightPoints || page.imageHeight || 0,
  };
  const yFlipped = {
    x: pdfPoint.x,
    y: Number(dimensions.height || 0) - pdfPoint.y,
  };
  return applyPageRotation(yFlipped, dimensions, page.finalRotation ?? page.orientation?.finalRotation ?? 0);
}

export function planToPdfCoordinates(point = {}, page = {}) {
  const dimensions = {
    width: page.pageWidthPoints || page.metadata?.pageWidthPoints || page.pdfWidthPoints || page.imageWidth || 0,
    height: page.pageHeightPoints || page.metadata?.pageHeightPoints || page.pdfHeightPoints || page.imageHeight || 0,
  };
  const unrotated = unapplyPageRotation(point, dimensions, page.finalRotation ?? page.orientation?.finalRotation ?? 0);
  return {
    x: unrotated.x,
    y: Number(dimensions.height || 0) - unrotated.y,
  };
}

export function planToScreenCoordinates(point = {}, viewState = {}) {
  const view = createViewState(viewState);
  const source = createPlanPoint(point);
  return {
    x: source.x * view.zoom + view.panX,
    y: source.y * view.zoom + view.panY,
  };
}

export function screenToPlanCoordinates(point = {}, viewState = {}) {
  const view = createViewState(viewState);
  const source = createPlanPoint(point);
  return {
    x: (source.x - view.panX) / Math.max(view.zoom, 0.0001),
    y: (source.y - view.panY) / Math.max(view.zoom, 0.0001),
  };
}

export function applyZoomAndPan(point = {}, viewState = {}) {
  return planToScreenCoordinates(point, viewState);
}
