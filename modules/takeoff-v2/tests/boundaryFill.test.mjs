import assert from "node:assert/strict";

import { acceptBoundaryFillPreview, previewBoundaryFillFromSegments } from "../takeoff/boundaryFill.js";

const rectangle = [
  { start: { x: 0, y: 0 }, end: { x: 100, y: 0 } },
  { start: { x: 100, y: 0 }, end: { x: 100, y: 80 } },
  { start: { x: 100, y: 80 }, end: { x: 0, y: 80 } },
  { start: { x: 0, y: 80 }, end: { x: 0, y: 0 } },
];

const preview = previewBoundaryFillFromSegments({
  seedPoint: { x: 50, y: 40 },
  boundarySegments: rectangle,
  cellSize: 5,
});
assert.equal(preview.ok, true);
assert.equal(preview.status, "preview");
assert.equal(preview.previewPolygon.length, 4);
assert.equal(preview.leak, null);

const leaky = previewBoundaryFillFromSegments({
  seedPoint: { x: 50, y: 40 },
  boundarySegments: rectangle.slice(0, 3),
  cellSize: 5,
});
assert.equal(leaky.ok, false);
assert.equal(leaky.status, "leaked");

const area = acceptBoundaryFillPreview({
  previewPolygon: preview.previewPolygon,
  page: { calibration: { mmPerDocumentUnit: 10 } },
  name: "Living",
});
assert.equal(area.name, "Living");
assert.equal(area.areaType, "Room");
assert.equal(area.confirmed, true);

console.log("boundaryFill.test.mjs passed");
