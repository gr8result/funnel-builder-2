import assert from "node:assert/strict";
import { createDistanceMeasurement, createAreaMeasurement } from "../core/measurement.js";
import { createScaleCalibration } from "../core/scale.js";

const scale = createScaleCalibration({
  start: { x: 100, y: 100 },
  end: { x: 752, y: 100 },
  realDistanceMm: 11490,
});

const measurement = createDistanceMeasurement({
  start: { x: 100, y: 100 },
  end: { x: 752, y: 100 },
  scale,
});

assert.equal(Math.round(measurement.lengthMm), 11490);
assert.equal(measurement.displayText, "11,490 mm (11.49 m)");
assert.equal(measurement.warning, "");

const tiny = createDistanceMeasurement({
  start: { x: 0, y: 0 },
  end: { x: 1, y: 0 },
  scale,
});
assert.match(tiny.warning, /very small/);

const area = createAreaMeasurement({
  points: [{ x: 0, y: 0 }, { x: 652, y: 0 }, { x: 652, y: 652 }, { x: 0, y: 652 }],
  scale,
});
assert.equal(area.areaPx2, 425104);
assert.equal(area.areaMm2 > 0, true);

console.log("measurement tests passed");

