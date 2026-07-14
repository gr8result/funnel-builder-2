import assert from "node:assert/strict";
import { createScaleCalibration, createScaleFromSuggestion, estimateDrawingScale, formatMillimetres, millimetresToPixels, pixelsToMillimetres } from "../core/scale.js";

const scale = createScaleCalibration({
  start: { x: 100, y: 100 },
  end: { x: 752, y: 100 },
  realDistanceMm: 11490,
});

assert.equal(scale.pixelDistance, 652);
assert.equal(Math.round(pixelsToMillimetres(652, scale)), 11490);
assert.equal(Math.round(millimetresToPixels(11490, scale)), 652);
assert.equal(formatMillimetres(11490), "11,490 mm (11.49 m)");
assert.equal(formatMillimetres(11490, { includeMetres: false }), "11,490 mm");
assert.equal(Number.isInteger(estimateDrawingScale(scale, 300)), true);
assert.throws(() => createScaleCalibration({ start: { x: 0, y: 0 }, end: { x: 0, y: 0 }, realDistanceMm: 1000 }));

const suggestedScale = createScaleFromSuggestion({
  normalized: "1:100",
  ratio: 100,
  dpi: 300,
});
assert.equal(suggestedScale.label, "1:100");
assert.equal(suggestedScale.unit, "mm");
assert.equal(suggestedScale.source, "confirmed-scale-suggestion");
assert.equal(Math.round(suggestedScale.millimetresPerPixel * 1000) / 1000, 8.467);

console.log("scale tests passed");
