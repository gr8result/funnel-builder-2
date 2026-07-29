import assert from "node:assert/strict";
import { calculatePolygonAreaM2, calculatePerimeterMm, validatePerimeterForArea, validateExteriorWallsForConfirmation } from "../takeoff/areaCalculation.js";
import { buildWallGraphFromPolylines } from "../takeoff/wallGraph.js";
import { pageToScreenPoint } from "../viewer/pageToScreenPoint.js";
import { screenToPagePoint } from "../viewer/screenToPagePoint.js";
import { makeRotatingViewport } from "./fixtures/rotatingViewport.mjs";

// 6m x 4m rectangle, 1 page-space (document) unit == 1 metre.
const MM_PER_DOC_UNIT = 1000;
const rectangle = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 4 }, { x: 0, y: 4 }];

assert.equal(calculatePolygonAreaM2(rectangle, MM_PER_DOC_UNIT), 24);

const graph = buildWallGraphFromPolylines([{ points: [...rectangle, rectangle[0]] }], { tolerance: 0.01 });
const confirmedPage = {
  calibration: { mmPerDocumentUnit: MM_PER_DOC_UNIT },
  exteriorWalls: { vertices: graph.vertices, segments: graph.segments, confirmed: true },
};

assert.equal(validateExteriorWallsForConfirmation(confirmedPage).valid, true);

const validation = validatePerimeterForArea(confirmedPage);
assert.equal(validation.valid, true);
assert.ok(Math.abs(validation.areaDocUnits2 - 24) < 1e-9);
assert.equal(calculatePolygonAreaM2(validation.orderedPoints, MM_PER_DOC_UNIT).toFixed(2), "24.00");

const perimeterMm = calculatePerimeterMm(graph.vertices, graph.segments, MM_PER_DOC_UNIT);
assert.equal(perimeterMm, 20000); // 2 * (6 + 4) m * 1000mm/m

// Gating: no calibration
assert.equal(validatePerimeterForArea({ calibration: null, exteriorWalls: confirmedPage.exteriorWalls }).valid, false);
// Gating: open perimeter
const openGraph = buildWallGraphFromPolylines([{ points: rectangle }], { tolerance: 0.01 });
assert.equal(
  validatePerimeterForArea({ calibration: confirmedPage.calibration, exteriorWalls: { vertices: openGraph.vertices, segments: openGraph.segments, confirmed: true } }).valid,
  false
);
// Gating: fewer than 3 vertices
assert.equal(
  validatePerimeterForArea({ calibration: confirmedPage.calibration, exteriorWalls: { vertices: [{ id: "a", x: 0, y: 0 }], segments: [], confirmed: true } }).valid,
  false
);
// Gating: walls not yet confirmed
assert.equal(
  validatePerimeterForArea({ calibration: confirmedPage.calibration, exteriorWalls: { ...confirmedPage.exteriorWalls, confirmed: false } }).valid,
  false
);

// Area must be identical under any rotation/zoom/pan — it's always computed
// from unrotated page-space vertices, never from what's on screen.
for (const rotation of [0, 90, 180, 270]) {
  for (const zoomScale of [0.6, 1, 3]) {
    const viewport = makeRotatingViewport({ width: 20, height: 20, rotation, scale: 2 });
    const view = { viewport, panX: 12, panY: -8, zoomScale };
    const recovered = rectangle.map((p) => {
      const screen = pageToScreenPoint(view, p.x, p.y);
      return screenToPagePoint(view, screen.x, screen.y);
    });
    const area = calculatePolygonAreaM2(recovered, MM_PER_DOC_UNIT);
    assert.ok(Math.abs(area - 24) < 1e-6, `rotation ${rotation} zoom ${zoomScale}: area drifted to ${area}`);
  }
}

console.log("areaCalculation.test.mjs passed");
