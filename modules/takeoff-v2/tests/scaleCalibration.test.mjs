import assert from "node:assert/strict";
import { computeCalibration, validateCalibrationShape } from "../takeoff/scaleCalibration.js";
import { lengthMm } from "../takeoff/measurement.js";
import { pageToScreenPoint } from "../viewer/pageToScreenPoint.js";
import { screenToPagePoint } from "../viewer/screenToPagePoint.js";
import { makeRotatingViewport } from "./fixtures/rotatingViewport.mjs";

const pointA = { x: 100, y: 100 };
const pointB = { x: 700, y: 100 }; // same y as A — a valid horizontal-locked segment

const calibration = computeCalibration({ pageId: "page-1", pointA, pointB, axis: "horizontal", actualLengthMm: 6000 });
assert.equal(calibration.documentDistance, 600);
assert.equal(calibration.mmPerDocumentUnit, 10);
assert.equal(calibration.axis, "horizontal");
assert.equal(calibration.pageId, "page-1");
assert.deepEqual(calibration.snapA, { kind: "manual", lineId: null, lineIds: null });
assert.equal(calibration.status, "calibrated-unverified");
assert.equal(validateCalibrationShape(calibration).label, "Scale calibrated — not independently verified");
assert.equal(validateCalibrationShape({ ...calibration, validation: { status: "passed" } }).label, "Scale confirmed");

// A vertical-locked segment uses the y-delta, not Euclidean distance.
{
  const vA = { x: 300, y: 50 };
  const vB = { x: 300, y: 450 };
  const vertical = computeCalibration({ pageId: "page-1", pointA: vA, pointB: vB, axis: "vertical", actualLengthMm: 4000 });
  assert.equal(vertical.documentDistance, 400);
  assert.equal(vertical.mmPerDocumentUnit, 10);
}

const measured = lengthMm(pointA, pointB, calibration.mmPerDocumentUnit);
assert.equal(measured, 6000);
assert.equal((measured / 1000).toFixed(3), "6.000");

// Full pipeline: project the two points through pageToScreenPoint at many
// zoom/pan/rotation combinations, then back through screenToPagePoint (as the
// real click handlers do), and confirm the recovered page-space points — and
// therefore the measured length — are unchanged in every case.
const PAGE_WIDTH = 1000;
const PAGE_HEIGHT = 1000;
for (const rotation of [0, 90, 180, 270]) {
  for (const zoomScale of [0.4, 1, 2.75]) {
    for (const [panX, panY] of [[0, 0], [37, -52], [500, 500]]) {
      const viewport = makeRotatingViewport({ width: PAGE_WIDTH, height: PAGE_HEIGHT, rotation, scale: 1.5 });
      const view = { viewport, panX, panY, zoomScale };

      const screenA = pageToScreenPoint(view, pointA.x, pointA.y);
      const screenB = pageToScreenPoint(view, pointB.x, pointB.y);
      const recoveredA = screenToPagePoint(view, screenA.x, screenA.y);
      const recoveredB = screenToPagePoint(view, screenB.x, screenB.y);

      assert.ok(Math.abs(recoveredA.x - pointA.x) < 1e-6, `rotation ${rotation} zoom ${zoomScale}: pointA.x drifted`);
      assert.ok(Math.abs(recoveredA.y - pointA.y) < 1e-6, `rotation ${rotation} zoom ${zoomScale}: pointA.y drifted`);
      assert.ok(Math.abs(recoveredB.x - pointB.x) < 1e-6, `rotation ${rotation} zoom ${zoomScale}: pointB.x drifted`);
      assert.ok(Math.abs(recoveredB.y - pointB.y) < 1e-6, `rotation ${rotation} zoom ${zoomScale}: pointB.y drifted`);

      const recoveredLengthMm = lengthMm(recoveredA, recoveredB, calibration.mmPerDocumentUnit);
      assert.ok(Math.abs(recoveredLengthMm - 6000) < 1e-6, `rotation ${rotation} zoom ${zoomScale}: length drifted`);
    }
  }
}

// Rejects invalid input
assert.throws(() => computeCalibration({ pointA, pointB, axis: "horizontal", actualLengthMm: 0 }));
assert.throws(() => computeCalibration({ pointA, pointB, axis: "horizontal", actualLengthMm: -100 }));
assert.throws(() => computeCalibration({ pointA, pointB: pointA, axis: "horizontal", actualLengthMm: 6000 }));
assert.throws(() => computeCalibration({ pointA, pointB, axis: "horizontal", actualLengthMm: NaN }));
assert.throws(() => computeCalibration({ pointA, pointB, axis: "diagonal", actualLengthMm: 6000 }));
// A "horizontal" axis claim with points that don't actually differ in x
// (e.g. an un-locked diagonal slipped through) must be rejected too.
assert.throws(() => computeCalibration({ pointA: { x: 5, y: 5 }, pointB: { x: 5, y: 50 }, axis: "horizontal", actualLengthMm: 6000 }));

console.log("scaleCalibration.test.mjs passed");
