import assert from "node:assert/strict";
import { pointInRegion, polylineWithinRegion, defaultPlanRegion, normalizeRegionCorners } from "../takeoff/planRegion.js";

// No region set — nothing is filtered.
{
  assert.equal(pointInRegion({ x: 9999, y: 9999 }, null), true);
  assert.equal(polylineWithinRegion([{ x: 0, y: 0 }, { x: 1, y: 1 }], null), true);
}

// A point/polyline fully inside the region passes; fully outside is rejected.
{
  const region = { x: 0, y: 0, width: 100, height: 100 };
  assert.equal(pointInRegion({ x: 50, y: 50 }, region), true);
  assert.equal(pointInRegion({ x: 150, y: 50 }, region), false);
  assert.equal(polylineWithinRegion([{ x: 10, y: 10 }, { x: 90, y: 90 }], region), true);
  assert.equal(polylineWithinRegion([{ x: 200, y: 200 }, { x: 250, y: 250 }], region), false);
}

// A title-block table sitting just outside the plan region (e.g. bottom
// strip of the sheet) is correctly excluded even though the sheet border
// itself is a big rectangle overlapping the page.
{
  const region = { x: 0, y: 0, width: 800, height: 600 }; // the floor plan area
  const titleBlockLine = [{ x: 700, y: 650 }, { x: 780, y: 650 }]; // below the region
  assert.equal(polylineWithinRegion(titleBlockLine, region), false);
}

// A wall that just clips the region boundary (mostly inside) still counts.
{
  const region = { x: 0, y: 0, width: 100, height: 100 };
  const points = [{ x: 50, y: 50 }, { x: 60, y: 60 }, { x: 70, y: 70 }, { x: 105, y: 105 }];
  assert.equal(polylineWithinRegion(points, region), true); // 3/4 inside >= 0.6
}

// defaultPlanRegion trims a margin and is never pre-confirmed.
{
  const region = defaultPlanRegion(1000, 800, 0.05);
  assert.ok(region);
  assert.equal(region.confirmed, false);
  assert.equal(region.source, "automatic");
  assert.ok(region.x > 0 && region.y > 0);
  assert.ok(region.width < 1000 && region.height < 800);
  assert.equal(defaultPlanRegion(0, 0), null);
}

// normalizeRegionCorners handles corners given in any order.
{
  const region = normalizeRegionCorners({ x: 50, y: 80 }, { x: 10, y: 20 });
  assert.deepEqual(region, { x: 10, y: 20, width: 40, height: 60 });
}

console.log("planRegion.test.mjs passed");
