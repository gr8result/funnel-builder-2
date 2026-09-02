import assert from "node:assert/strict";
import fs from "node:fs";

const tools = fs.readFileSync("modules/takeoff-v2/hooks/useTakeoffTools.js", "utf8");
const overlay = fs.readFileSync("modules/takeoff-v2/components/TakeoffCanvasOverlay.jsx", "utf8");
const toolbar = fs.readFileSync("modules/takeoff-v2/components/TakeoffToolbar.jsx", "utf8");
const results = fs.readFileSync("modules/takeoff-v2/components/ResultsPanel.jsx", "utf8");
const contextPanel = fs.readFileSync("modules/takeoff-v2/components/WallContextPanel.jsx", "utf8");
const types = fs.readFileSync("modules/takeoff-v2/types.js", "utf8");

assert.match(types, /EXTERIOR_SOURCE_AUTO_DETECTOR_V2[\s\S]*return false;/, "current auto-detector-v2 exterior candidates must survive page normalization");

const detectExteriorBody = tools.match(/const detectExterior = useCallback\([\s\S]*?\n  \}, \[\]\);/)?.[0] || "";
assert.match(detectExteriorBody, /setActiveToolState\("exterior-wall"\)/, "Exterior detection must enter click-seeded wall-band tracing");
assert.match(detectExteriorBody, /click inside one exterior wall band/, "Exterior detection must ask the user for a wall seed");
assert.doesNotMatch(detectExteriorBody, /detectionProvider\.detectWalls\(/, "Exterior detection must not run an unrestricted provider scan");
assert.doesNotMatch(detectExteriorBody, /detectExteriorWallsFromGeometry\(/, "automatic candidate must not use the retired custom exterior detector");
assert.doesNotMatch(detectExteriorBody, /normalisedWallsToExteriorCandidate\(/, "provider geometry must not be mapped into exterior walls without a seed click");
assert.doesNotMatch(detectExteriorBody, /commitPage\(\{[\s\S]*exteriorWalls,/, "Exterior detection must not commit an unseeded exterior graph");
assert.match(tools, /const handleWallDrawClick = useCallback[\s\S]*detectWallRunFromSeed[\s\S]*No wall found/, "wall clicks must be seed-based wall-band detection");
assert.doesNotMatch(tools, /if \(!options\?\.altKey\)[\s\S]*detectWallRunFromSeed/, "wall tools must not expose an Alt/manual point-connection path");

assert.match(tools, /function isMissingSectionIndicator/, "missing sections must be represented separately from detected walls");
assert.match(tools, /function activeWallSegments\(graph\)[\s\S]*!isMissingSectionIndicator\(segment\)/, "missing section indicators must not count as detected/active wall segments");
assert.match(tools, /const exteriorCandidateStats = useMemo/, "status panels must receive a single candidate stats object");
assert.match(tools, /traceMissingExteriorSections/, "manual tracing must be able to continue from an automatic candidate");
assert.match(tools, /setWallDrawChainVertexId\(firstGap\?\.aId \|\| null\)/, "Trace Missing Sections must start from the first gap endpoint");
assert.match(tools, /segments: nextGraph\.segments\.filter[\s\S]*isMissingSectionIndicator/, "manual tracing across a gap must replace the review marker");

assert.match(overlay, /const project = \(point\) => pageToScreenPoint\(\{ viewport, \.\.\.IDENTITY_VIEW \}/, "candidate overlay must use the existing PDF-to-screen transform");
assert.match(overlay, /visibleExteriorSegments\.map\(\(segment\) => \(/, "overlay must receive and render exterior candidate segments");
assert.match(overlay, /EXTERIOR_CANDIDATE = "#16a34a"/, "detected candidate sections must render green");
assert.match(overlay, /data-testid="wall-band-fill"/, "candidate sections must render as a light wall band");
assert.match(overlay, /data-testid=\{missingSection \? "missing-section-indicator" : "wall-segment"\}/, "missing sections must render as review indicators, not wall segments");
assert.match(overlay, /strokeDasharray=\{missingSection \? "7 7" : selected \? "4 3" : undefined\}/, "missing sections must be dashed indicators");
assert.match(overlay, /showAllWallHandles/, "candidate/edit corner handles must be gated to edit tools instead of normal display");
assert.doesNotMatch(overlay, /data-testid="wall-draw-preview"/, "wall modes must not render point-to-point live draw previews");
assert.match(overlay, /showAreaFills = isAreaTool \|\| tools\.activeTool === "select" \|\| tools\.activeTool === "edit"/, "area fills must not display during wall detection modes");

assert.match(toolbar, /Trace Missing Sections/, "review controls must expose Trace Missing Sections");
assert.match(toolbar, /Accept Detected/, "review controls must expose Accept Detected");
assert.match(toolbar, /Clear Candidate/, "review controls must expose Clear Candidate");
assert.match(toolbar, /Exterior Wall Detection/, "toolbar must name the seeded exterior workflow");
const windowToolLine = toolbar.split(/\r?\n/).find((line) => line.includes('testId="tool-window"')) || "";
assert.match(windowToolLine, /active=\{tools\.activeTool === "window"\}/, "window tool must still exist");
assert.match(windowToolLine, /disabled=\{!wallsConfirmed\}/, "window detection/placement must stay locked until exterior approval");
assert.match(toolbar, /Needs completion/, "toolbar progress must show Needs completion for incomplete candidates");
assert.match(toolbar, /Boundary corners:[\s\S]*Detected exterior wall sections:[\s\S]*Missing sections:/, "toolbar status must display distinct corner/segment/missing counts");

assert.match(results, /Status" value=\{exteriorWalls\?\.confirmed \? "Confirmed" : \(exteriorStats\.missingSections > 0 \? "Needs completion" : "Needs review"\)\}/, "right panel must use candidate state instead of Not started");
assert.match(results, /label="Boundary corners"/, "right panel must show boundary corner count");
assert.match(results, /label=\{exteriorWalls\?\.confirmed \? "Segments" : "Detected segments"\}/, "right panel must show detected wall sections separately");
assert.match(results, /label="Missing sections"/, "right panel must show missing section count");
assert.match(results, /Confirmed Length/, "confirmed exterior runs must have their own length total");
assert.match(results, /Candidate Length/, "candidate exterior length must be displayed separately");
assert.match(results, /Outline Status/, "outline completion status must be separate from run length");

assert.match(contextPanel, /data-testid="opening-context-panel"/, "selected windows/openings must open an editor panel");
["Window type", "Window mark/code", "Width", "Height", "Quantity", "Frame material", "Frame colour", "Glazing type", "Glass thickness", "Obscure glass", "Safety glass", "Energy rating", "Flyscreen", "Security screen", "Opening direction", "Room", "Floor/level", "Elevation/location", "Supplier", "Product/model", "Installation notes", "General notes"].forEach((label) => {
  assert.match(contextPanel, new RegExp(label.replace(/[/.]/g, "\\$&")), `opening editor must expose ${label}`);
});
assert.match(tools, /openingWorkflowPatch/, "opening edits must persist window records and downstream workflow models");
assert.match(results, /WINDOW RECONCILIATION/, "results panel must expose the window reconciliation approval screen");
assert.match(results, /approveWindowReconciliation/, "window reconciliation must be approvable before order-ready use");

console.log("exteriorCandidateReview.test.mjs passed");
