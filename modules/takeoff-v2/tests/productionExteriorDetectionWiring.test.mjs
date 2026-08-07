import assert from "node:assert/strict";
import fs from "node:fs";

const toolbar = fs.readFileSync("modules/takeoff-v2/components/TakeoffToolbar.jsx", "utf8");
const tools = fs.readFileSync("modules/takeoff-v2/hooks/useTakeoffTools.js", "utf8");
const overlay = fs.readFileSync("modules/takeoff-v2/components/TakeoffCanvasOverlay.jsx", "utf8");

const detectButton = toolbar.match(/<ToolButton[\s\S]*?testId="tool-detect-exterior"[\s\S]*?<\/ToolButton>/)?.[0] || "";
const traceButton = toolbar.match(/<ToolButton[\s\S]*?testId="tool-trace-exterior"[\s\S]*?<\/ToolButton>/)?.[0] || "";
const finishButton = toolbar.match(/<ToolButton[\s\S]*?testId="tool-finish-exterior"[\s\S]*?<\/ToolButton>/)?.[0] || "";
assert.match(detectButton, /onClick=\{tools\.detectExterior\}/, "toolbar Detect Exterior must call tools.detectExterior");
assert.match(traceButton, /setActiveTool\("exterior-wall"\)/, "toolbar must keep manual Trace Exterior available beside automatic detection");
assert.match(finishButton, /onClick=\{tools\.finishHighlightedExterior\}/, "toolbar Finish Exterior must confirm the detected exterior graph");
assert.doesNotMatch(toolbar, /EXTERIOR_GENERATION_DISABLED/, "production Finish Exterior must not use the disabled exterior-generation path");

const detectExteriorBody = tools.match(/const detectExterior = useCallback\([\s\S]*?\n  \}, \[planGeometryIndex, page, commitPage, pushUndo, layerVisibility\]\);/)?.[0] || "";
assert.match(detectExteriorBody, /detectExteriorWallsFromGeometry\(/, "detectExterior must execute the existing exterior detector");
assert.match(detectExteriorBody, /commitPage\(\{[\s\S]*exteriorWalls,/, "detectExterior must commit the detector result to page.exteriorWalls");
assert.match(detectExteriorBody, /exteriorHighlightedWalls:\s*\[\]/, "detectExterior must clear old highlighted-wall state");
assert.doesNotMatch(detectExteriorBody, /detectedWalls:/, "detectExterior must not store production exterior output in detectedWalls");

const finishBody = tools.match(/const finishHighlightedExterior = useCallback\([\s\S]*?\n  \}, \[page, commitPage\]\);/)?.[0] || "";
assert.match(finishBody, /confirmed:\s*true/, "Finish Exterior must confirm the existing page.exteriorWalls graph");
assert.doesNotMatch(finishBody, /EXTERIOR_GENERATION_DISABLED/, "Finish Exterior must not report exterior generation disabled");

assert.match(overlay, /const exteriorWalls = page\?\.exteriorWalls;/, "overlay must read exterior walls from page.exteriorWalls");
assert.match(overlay, /visibleExteriorSegments\.map\(\(segment\) => \(/, "overlay must render exterior wall segments");
assert.match(overlay, /data-testid="wall-segment"/, "overlay must expose visible wall-segment elements for browser verification");

console.log("productionExteriorDetectionWiring.test.mjs passed");
