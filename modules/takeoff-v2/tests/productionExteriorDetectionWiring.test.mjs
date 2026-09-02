import assert from "node:assert/strict";
import fs from "node:fs";

const toolbar = fs.readFileSync("modules/takeoff-v2/components/TakeoffToolbar.jsx", "utf8");
const tools = fs.readFileSync("modules/takeoff-v2/hooks/useTakeoffTools.js", "utf8");
const overlay = fs.readFileSync("modules/takeoff-v2/components/TakeoffCanvasOverlay.jsx", "utf8");

assert.doesNotMatch(toolbar, /tool-detect-exterior/, "toolbar must not expose the retired custom Detect Exterior button");
assert.match(toolbar, /Exterior Wall Detection/, "toolbar must expose click-seeded exterior wall detection");
assert.match(toolbar, /data-testid="accept-detected-exterior"/, "toolbar must expose review/accept for seeded exterior candidates");
assert.match(toolbar, /onClick=\{tools\.confirmExteriorWalls\}/, "toolbar must confirm reviewed page.exteriorWalls candidates");
assert.doesNotMatch(toolbar, /EXTERIOR_GENERATION_DISABLED/, "production Finish Exterior must not use the disabled exterior-generation path");

const detectExteriorBody = tools.match(/const detectExterior = useCallback\([\s\S]*?\n  \}, \[\]\);/)?.[0] || "";
assert.match(detectExteriorBody, /setActiveToolState\("exterior-wall"\)/, "detectExterior must switch to the click-seeded wall-band tool");
assert.match(detectExteriorBody, /click inside one exterior wall band/, "detectExterior must ask for a user seed click");
assert.doesNotMatch(detectExteriorBody, /detectionProvider\.detectWalls\(/, "detectExterior must not run an unrestricted provider scan");
assert.doesNotMatch(detectExteriorBody, /detectExteriorWallsFromGeometry\(/, "detectExterior must not run the quarantined custom exterior detector");
assert.doesNotMatch(detectExteriorBody, /normalisedWallsToExteriorCandidate\(/, "detectExterior must not convert unrestricted provider geometry into exterior walls");
assert.doesNotMatch(detectExteriorBody, /commitPage\(\{[\s\S]*exteriorWalls,/, "detectExterior must not commit an unseeded exterior wall graph");
assert.doesNotMatch(detectExteriorBody, /detectedWalls:/, "detectExterior must not store production exterior output in detectedWalls");

const finishBody = tools.match(/const finishHighlightedExterior = useCallback\([\s\S]*?\n  \}, \[page, commitPage\]\);/)?.[0] || "";
assert.match(finishBody, /confirmed:\s*true/, "Finish Exterior must confirm the existing page.exteriorWalls graph");
assert.doesNotMatch(finishBody, /EXTERIOR_GENERATION_DISABLED/, "Finish Exterior must not report exterior generation disabled");

assert.match(overlay, /const exteriorWalls = page\?\.exteriorWalls;/, "overlay must read exterior walls from page.exteriorWalls");
assert.match(overlay, /visibleExteriorSegments\.map\(\(segment\) => \(/, "overlay must render exterior wall segments");
assert.match(overlay, /data-testid=\{missingSection \? "missing-section-indicator" : "wall-segment"\}/, "overlay must expose visible wall-segment elements separately from missing-section indicators");

console.log("productionExteriorDetectionWiring.test.mjs passed");
