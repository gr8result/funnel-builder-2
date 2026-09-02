import assert from "node:assert/strict";
import fs from "node:fs";

const planViewer = fs.readFileSync("modules/takeoff-v2/components/PlanViewer.jsx", "utf8");
const tools = fs.readFileSync("modules/takeoff-v2/hooks/useTakeoffTools.js", "utf8");

const runWallDetection = tools.match(/const runWallDetection = useCallback\([\s\S]*?\n  \}, \[detectionProvider, planGeometryIndex, page, commitPage\]\);/)?.[0] || "";

assert.ok(runWallDetection, "runWallDetection body should be found");
assert.doesNotMatch(runWallDetection, /fitTo\s*\(/, "detection must not fit page");
assert.doesNotMatch(runWallDetection, /setView\s*\(/, "detection must not mutate viewer state");
assert.doesNotMatch(runWallDetection, /panX|panY|zoomScale|baseScale|renderScale/, "detection must not read or rewrite viewport transform");
assert.doesNotMatch(runWallDetection, /rotation\s*:/, "detection must not change rotation");

const fitToCallback = planViewer.match(/const fitTo = useCallback\([\s\S]*?\n  \}, \[pdfDocument, page\?\.pageNumber, page\?\.rotation\]\);/)?.[0] || "";
const effectBody = planViewer.match(/useEffect\(\(\) => \{\s*\n    fitTo\("fit-page"\);[\s\S]*?\n  \}, \[fitTo\]\);/)?.[0] || "";
assert.ok(fitToCallback && effectBody, "fit-page effect should still depend only on document/page/rotation through fitTo");
assert.doesNotMatch(`${fitToCallback}\n${effectBody}`, /detectedWalls|wallDetection|exteriorHighlightedWalls|exteriorWalls/, "detection results must not be fit-page dependencies");

console.log("detectionViewportStability.test.mjs passed");
