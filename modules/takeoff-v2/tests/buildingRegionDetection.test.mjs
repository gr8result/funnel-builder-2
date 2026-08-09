import assert from "node:assert/strict";
import { detectBuildingRegion, segmentInBuildingRegion } from "../takeoff/buildingRegionDetection.js";

function band(id, x1, y1, x2, y2, orientation = Math.abs(x2 - x1) >= Math.abs(y2 - y1) ? "horizontal" : "vertical") {
  return {
    id,
    orientation,
    centerline: { start: { x: x1, y: y1 }, end: { x: x2, y: y2 } },
    thickness: 8,
    confidence: 0.8,
  };
}

const house = [
  band("top", 100, 100, 420, 100),
  band("bottom", 100, 320, 420, 320),
  band("left", 100, 100, 100, 320, "vertical"),
  band("right", 420, 100, 420, 320, "vertical"),
  band("garage-top", 420, 180, 540, 180),
  band("garage-bottom", 420, 320, 540, 320),
  band("garage-right", 540, 180, 540, 320, "vertical"),
];

const titleBlock = [
  band("title-a", 30, 25, 580, 25),
  band("title-b", 30, 35, 580, 35),
  band("title-c", 30, 45, 580, 45),
  band("title-d", 30, 55, 580, 55),
];

const result = detectBuildingRegion({ wallBands: [...titleBlock, ...house], pageWidth: 620, pageHeight: 460 });

assert.ok(result.region, "primary building region should be selected");
assert.ok(result.region.confidence >= 0.45);
assert.ok(segmentInBuildingRegion({ a: { x: 120, y: 110 }, b: { x: 400, y: 110 } }, result.region));
assert.equal(segmentInBuildingRegion({ a: { x: 40, y: 30 }, b: { x: 570, y: 30 } }, result.region), false, "title block should be outside the selected building region");
assert.ok(result.region.excludedRegions.length >= 1, "non-primary regions should be reported as excluded debug overlays");

console.log("buildingRegionDetection.test.mjs passed");
