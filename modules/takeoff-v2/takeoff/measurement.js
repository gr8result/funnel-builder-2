// Calibrated length measurement between two page-space points.

import { distance } from "./geometry.js";
import { documentUnitsToMm } from "./scaleCalibration.js";

export function lengthMm(pointA, pointB, mmPerDocumentUnit) {
  return documentUnitsToMm(distance(pointA, pointB), mmPerDocumentUnit);
}
