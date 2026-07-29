// Two-point, axis-locked scale calibration. pointA/pointB are page-space
// points (PDF points, unrotated) that must already be exactly axis-locked
// (see takeoff/axisLock.js) by the time this is called — computeCalibration
// itself re-derives the distance from the *axis*, not raw Euclidean
// distance, per spec: for an axis-locked segment the perpendicular
// component is exactly zero, but using the axis-aware formula is the
// authoritative definition regardless.

const AXES = new Set(["horizontal", "vertical"]);

// { pageId, pointA, pointB, axis, actualLengthMm, snapA, snapB } -> Calibration
// Throws if the axis is missing/invalid, the two points don't actually
// differ along that axis, or the distance is not a positive number —
// callers (the calibration dialog) validate user input before calling this.
export function computeCalibration({ pageId, pointA, pointB, axis, actualLengthMm, snapA, snapB }) {
  if (!AXES.has(axis)) {
    throw new Error('Calibration axis must be "horizontal" or "vertical".');
  }
  const documentDistance = axis === "horizontal" ? Math.abs(pointB.x - pointA.x) : Math.abs(pointB.y - pointA.y);
  if (!Number.isFinite(documentDistance) || documentDistance <= 0) {
    throw new Error("Calibration requires two different points along the locked axis.");
  }
  if (!Number.isFinite(actualLengthMm) || actualLengthMm <= 0) {
    throw new Error("Calibration requires a positive real-world distance.");
  }
  return {
    pageId,
    pointA,
    pointB,
    axis,
    actualLengthMm,
    documentDistance,
    mmPerDocumentUnit: actualLengthMm / documentDistance,
    snapA: snapA || { kind: "manual", lineId: null, lineIds: null },
    snapB: snapB || { kind: "manual", lineId: null, lineIds: null },
    confirmedAt: new Date().toISOString(),
  };
}

export function documentUnitsToMm(documentUnits, mmPerDocumentUnit) {
  return documentUnits * mmPerDocumentUnit;
}

export function mmToDocumentUnits(mm, mmPerDocumentUnit) {
  if (!mmPerDocumentUnit) return 0;
  return mm / mmPerDocumentUnit;
}
