import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync("pages/modules/takeoff-v3/index.js", "utf8");
const v3Page = fs.readFileSync("modules/takeoff-v3/components/TakeoffV3Page.jsx", "utf8");
const v2Page = fs.readFileSync("modules/takeoff-v2/components/TakeoffV2Page.jsx", "utf8");
const v2Toolbar = fs.readFileSync("modules/takeoff-v2/components/TakeoffToolbar.jsx", "utf8");

assert.match(route, /TakeoffV3Page/, "V3 route mounts TakeoffV3Page");
assert.match(route, /disableLayout\s*=\s*true/, "V3 route mounts as standalone page");

assert.match(v3Page, /TAKEOFF V3/, "V3 badge exists on V3 page");
assert.doesNotMatch(v2Page, /TAKEOFF V3/, "V3 badge is not on V2 page");
assert.doesNotMatch(v2Toolbar, /TAKEOFF V3/, "V3 badge is not on V2 toolbar");

assert.match(v3Page, /Detect Exterior/, "Detect Exterior button exists");
assert.match(v3Page, /\[V3 DETECT\] clicked/, "Detect Exterior click is logged");
assert.match(v3Page, /Detecting exterior\.\.\./, "Detecting state is visible");
assert.match(v3Page, /Exterior detection failed\. Use Draw Exterior\./, "Failure state is visible");
assert.match(v3Page, /\[V3 DETECT\] detector started/, "Detector start is logged");
assert.match(v3Page, /\[V3 DETECT\] detector result:/, "Detector result is logged");
assert.match(v3Page, /\[V3 DETECT\] geometry committed/, "Geometry commit stage is logged");
assert.match(v3Page, /\[V3 DETECT\] overlay rendered/, "Overlay render stage is logged");

console.log("takeoff-v3 routeAndDetect.test.mjs passed");
