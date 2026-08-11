import { distance } from "./geometry.js";

export function computeCalibration({ pointA, pointB, actualLengthMm }) {
  const documentDistance = distance(pointA, pointB);
  if (!(documentDistance > 0)) throw new Error("Scale calibration requires two different points.");
  if (!(Number(actualLengthMm) > 0)) throw new Error("Scale calibration requires a positive real-world length.");
  return {
    pointA,
    pointB,
    actualLengthMm: Number(actualLengthMm),
    documentDistance,
    mmPerDocumentUnit: Number(actualLengthMm) / documentDistance,
    confirmedAt: new Date().toISOString(),
  };
}
