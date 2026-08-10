import assert from "node:assert/strict";
import fs from "node:fs";

const tools = fs.readFileSync("modules/takeoff-v2/hooks/useTakeoffTools.js", "utf8");
const overlay = fs.readFileSync("modules/takeoff-v2/components/TakeoffCanvasOverlay.jsx", "utf8");
const toolbar = fs.readFileSync("modules/takeoff-v2/components/TakeoffToolbar.jsx", "utf8");
const results = fs.readFileSync("modules/takeoff-v2/components/ResultsPanel.jsx", "utf8");
const types = fs.readFileSync("modules/takeoff-v2/types.js", "utf8");

assert.match(types, /EXTERIOR_SOURCE_AUTO_DETECTOR_V2[\s\S]*return false;/, "current auto-detector-v2 exterior candidates must survive page normalization");

const detectExteriorBody = tools.match(/const detectExterior = useCallback\([\s\S]*?\n  \}, \[planGeometryIndex, page, commitPage, pushUndo, layerVisibility\]\);/)?.[0] || "";
assert.match(detectExteriorBody, /commitPage\(\{[\s\S]*exteriorWalls,/, "automatic candidate must enter React page state as page.exteriorWalls");
assert.match(detectExteriorBody, /reviewStatus:\s*candidateReady \? "candidate-ready" : "candidate-incomplete"/, "candidate state must distinguish ready vs incomplete");
assert.match(detectExteriorBody, /setActiveToolState\("edit-walls"\)/, "Detect Exterior must automatically enter Review Exterior");
assert.match(detectExteriorBody, /boundary corners,[\s\S]*exterior wall sections[\s\S]*missing sections/, "message must not confuse point count with wall count");

assert.match(tools, /function isMissingSectionIndicator/, "missing sections must be represented separately from detected walls");
assert.match(tools, /function activeWallSegments\(graph\)[\s\S]*!isMissingSectionIndicator\(segment\)/, "missing section indicators must not count as detected/active wall segments");
assert.match(tools, /const exteriorCandidateStats = useMemo/, "status panels must receive a single candidate stats object");
assert.match(tools, /traceMissingExteriorSections/, "manual tracing must be able to continue from an automatic candidate");
assert.match(tools, /setWallDrawChainVertexId\(firstGap\?\.aId \|\| null\)/, "Trace Missing Sections must start from the first gap endpoint");
assert.match(tools, /segments: nextGraph\.segments\.filter[\s\S]*isMissingSectionIndicator/, "manual tracing across a gap must replace the review marker");

assert.match(overlay, /const project = \(point\) => pageToScreenPoint\(\{ viewport, \.\.\.IDENTITY_VIEW \}/, "candidate overlay must use the existing PDF-to-screen transform");
assert.match(overlay, /visibleExteriorSegments\.map\(\(segment\) => \(/, "overlay must receive and render exterior candidate segments");
assert.match(overlay, /EXTERIOR_CANDIDATE = "#16a34a"/, "detected candidate sections must render green");
assert.match(overlay, /strokeWidth=\{selected \? 4 : 3\}/, "candidate sections must be approximately 3px visible stroke");
assert.match(overlay, /data-testid=\{missingSection \? "missing-section-indicator" : "wall-segment"\}/, "missing sections must render as review indicators, not wall segments");
assert.match(overlay, /strokeDasharray=\{missingSection \? "7 7" : undefined\}/, "missing sections must be dashed indicators");
assert.match(overlay, /source === "auto-detector-v2" && !exteriorWalls\?\.confirmed/, "candidate corner markers must be visible during review");

assert.match(toolbar, /Trace Missing Sections/, "review controls must expose Trace Missing Sections");
assert.match(toolbar, /Accept Detected/, "review controls must expose Accept Detected");
assert.match(toolbar, /Clear Candidate/, "review controls must expose Clear Candidate");
assert.match(toolbar, /Needs completion/, "toolbar progress must show Needs completion for incomplete candidates");
assert.match(toolbar, /Boundary corners:[\s\S]*Detected exterior wall sections:[\s\S]*Missing sections:/, "toolbar status must display distinct corner/segment/missing counts");

assert.match(results, /Status" value=\{exteriorWalls\?\.confirmed \? "Confirmed" : \(exteriorStats\.missingSections > 0 \? "Needs completion" : "Needs review"\)\}/, "right panel must use candidate state instead of Not started");
assert.match(results, /label="Boundary corners"/, "right panel must show boundary corner count");
assert.match(results, /label=\{exteriorWalls\?\.confirmed \? "Segments" : "Detected segments"\}/, "right panel must show detected wall sections separately");
assert.match(results, /label="Missing sections"/, "right panel must show missing section count");

console.log("exteriorCandidateReview.test.mjs passed");
