import type { PlanRotation, TakeoffPage, ViewportState } from "../state/takeoffTypes";

export function normalizeRotation(value: number | null | undefined): PlanRotation {
  const normalized = (((Number(value || 0) % 360) + 360) % 360);
  return (normalized === 90 || normalized === 180 || normalized === 270 ? normalized : 0) as PlanRotation;
}

export function getFinalRotation(page: Pick<TakeoffPage, "orientationMode" | "manualRotation" | "detectedRotation">): PlanRotation {
  return page.orientationMode === "manual" && page.manualRotation !== null
    ? normalizeRotation(page.manualRotation)
    : normalizeRotation(page.detectedRotation);
}

export function rotatedDimensions(width: number, height: number, rotation: PlanRotation) {
  return rotation === 90 || rotation === 270
    ? { width: height, height: width }
    : { width, height };
}

export function applyRotation(point: { x: number; y: number }, width: number, height: number, rotation: PlanRotation) {
  const x = Number(point.x || 0);
  const y = Number(point.y || 0);
  if (rotation === 90) return { x: height - y, y: x };
  if (rotation === 180) return { x: width - x, y: height - y };
  if (rotation === 270) return { x: y, y: width - x };
  return { x, y };
}

export function invertRotation(point: { x: number; y: number }, width: number, height: number, rotation: PlanRotation) {
  const rotated = rotatedDimensions(width, height, rotation);
  if (rotation === 90) return { x: point.y, y: height - point.x };
  if (rotation === 180) return { x: width - point.x, y: height - point.y };
  if (rotation === 270) return { x: width - point.y, y: point.x };
  return { x: point.x, y: point.y, rotatedWidth: rotated.width, rotatedHeight: rotated.height };
}

export function pdfToPlan(point: { x: number; y: number }, page: TakeoffPage) {
  return applyRotation(point, page.originalWidth, page.originalHeight, page.finalRotation);
}

export function planToPdf(point: { x: number; y: number }, page: TakeoffPage) {
  return invertRotation(point, page.originalWidth, page.originalHeight, page.finalRotation);
}

export function planToScreen(point: { x: number; y: number }, viewport: ViewportState) {
  return {
    x: point.x * viewport.scale + viewport.offsetX,
    y: point.y * viewport.scale + viewport.offsetY,
  };
}

export function screenToPlan(point: { x: number; y: number }, viewport: ViewportState) {
  const scale = Math.max(0.0001, viewport.scale || 1);
  return {
    x: (point.x - viewport.offsetX) / scale,
    y: (point.y - viewport.offsetY) / scale,
  };
}

export function applyViewportTransform(point: { x: number; y: number }, viewport: ViewportState) {
  return planToScreen(point, viewport);
}
