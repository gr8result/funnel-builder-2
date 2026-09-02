// Validation + area/perimeter calculation for a confirmed exterior-wall
// polygon, working entirely in page-space (unrotated PDF points) so results
// never change with zoom, pan, or rotation.

import { polygonAreaDocUnits2, polygonPerimeter, isSimplePolygon } from "./geometry.js";
import { orderedPerimeterPoints, isPerimeterClosed, hasDisconnectedSegments } from "./wallGraph.js";

export function validateExteriorWallsForConfirmation(page) {
  if (!page?.calibration) {
    return { valid: false, reason: "Exterior walls cannot be confirmed because scale has not been set." };
  }
  const walls = page.exteriorWalls;
  if (!walls || walls.vertices.length < 3) {
    return { valid: false, reason: "Exterior walls cannot be confirmed because fewer than three vertices exist." };
  }
  if (hasDisconnectedSegments(walls.vertices, walls.segments)) {
    return { valid: false, reason: "Exterior walls cannot be confirmed because there are disconnected wall segments." };
  }
  const activeSegments = (walls.segments || []).filter((segment) => !segment?.missingSectionIndicator && !segment?.bridgedGapLength);
  if (activeSegments.length !== (walls.segments || []).length) {
    return { valid: false, reason: "Exterior walls cannot be confirmed because review gaps or rejected connections remain." };
  }
  const unresolved = activeSegments.find((segment) => (
    segment.geometryStatus !== "resolved" ||
    !segment.faceA?.start ||
    !segment.faceA?.end ||
    !segment.faceB?.start ||
    !segment.faceB?.end
  ));
  if (unresolved) {
    return { valid: false, reason: "Exterior walls cannot be confirmed because every segment must have wall-face evidence." };
  }
  if (!isPerimeterClosed(walls.vertices, walls.segments)) {
    return { valid: false, reason: "Exterior walls cannot be confirmed because the exterior-wall perimeter is still open." };
  }
  return { valid: true, reason: "" };
}

export function validatePerimeterForArea(page) {
  const wallCheck = validateExteriorWallsForConfirmation(page);
  if (!wallCheck.valid) {
    return { valid: false, reason: wallCheck.reason.replace(/^Exterior walls/, "Area") };
  }
  if (!page.exteriorWalls.confirmed) {
    return { valid: false, reason: "Area cannot be confirmed because the exterior-wall perimeter has not been confirmed." };
  }
  const ordered = orderedPerimeterPoints(page.exteriorWalls.vertices, page.exteriorWalls.segments);
  if (!ordered) {
    return { valid: false, reason: "Area cannot be confirmed because the exterior-wall perimeter is invalid." };
  }
  if (!isSimplePolygon(ordered)) {
    return { valid: false, reason: "Area cannot be confirmed because the exterior-wall perimeter crosses itself." };
  }
  const areaDocUnits2 = polygonAreaDocUnits2(ordered);
  if (!(areaDocUnits2 > 0)) {
    return { valid: false, reason: "Area cannot be confirmed because the calculated area is zero." };
  }
  return { valid: true, reason: "", orderedPoints: ordered, areaDocUnits2 };
}

export function calculatePolygonAreaM2(vertices, mmPerDocumentUnit) {
  const areaDocUnits2 = polygonAreaDocUnits2(vertices);
  const areaMm2 = areaDocUnits2 * mmPerDocumentUnit * mmPerDocumentUnit;
  return areaMm2 / 1_000_000;
}

export function calculatePerimeterMm(vertices, segments, mmPerDocumentUnit) {
  const ordered = orderedPerimeterPoints(vertices, segments);
  if (!ordered) return 0;
  return polygonPerimeter(ordered) * mmPerDocumentUnit;
}
