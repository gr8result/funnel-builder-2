import { normalizeRotation } from "../rendering/CoordinateTransform";
import type { PlanRotation, TakeoffPage } from "../state/takeoffTypes";

export function rotateRight(currentRotation: PlanRotation) {
  return normalizeRotation(currentRotation + 90);
}

export function rotateLeft(currentRotation: PlanRotation) {
  return normalizeRotation(currentRotation + 270);
}

export function setManualRotation(page: TakeoffPage, rotation: PlanRotation): TakeoffPage {
  return {
    ...page,
    manualRotation: rotation,
    finalRotation: rotation,
    orientationMode: "manual",
  };
}
