import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("components/construction-estimation/ai-plan-takeoff/AIPlanTakeoffStandalone.jsx", "utf8");
const wallSectionStart = source.indexOf("{/* Walls & Vertex Handles */}");
const wallSectionEnd = source.indexOf("{/* Openings (Doors/Windows)", wallSectionStart);
assert.ok(wallSectionStart >= 0 && wallSectionEnd > wallSectionStart, "Wall editor render section must exist");

const wallSection = source.slice(wallSectionStart, wallSectionEnd);
assert.match(wallSection, /isSelected && run\.nodes\.map\(\(node, idx\) =>/, "Selecting a wall must expose its nodes");
assert.match(wallSection, /draggable=\{selectModeActive\}/, "Wall vertex handles must be draggable only in Select mode");
assert.match(wallSection, /onDragStart=\{\(event\) => \{[\s\S]*setDraggingVertex\(\{ type: 'wall', id: run\.id, vertexIndex: idx \}\)/, "Wall vertex drag must identify the exact wall and node");
assert.match(wallSection, /onDragEnd=\{\(event\) => \{[\s\S]*commitWallVertexDrag\(run\.id, idx, event\)/, "Wall vertex drag must commit the exact dropped position");
assert.doesNotMatch(wallSection, /const isEndpoint =/, "Every selected wall corner must be editable, not only endpoints");

const dragUpdateStart = source.indexOf("if (draggingVertex)");
const dragUpdateEnd = source.indexOf("const handleMouseUp", dragUpdateStart);
const dragUpdate = source.slice(dragUpdateStart, dragUpdateEnd);
assert.match(dragUpdate, /type === 'wall'/, "Wall drag update branch must exist");
assert.match(dragUpdate, /updatedNodes\[vertexIndex\] = \{ x: snap\.x, y: snap\.y \}/, "Wall drag must update the selected corner coordinates");
assert.match(dragUpdate, /getWallRunLengthMm\(updatedNodes, pixelsPerMm\)/, "Wall drag must recalculate the wall length");
assert.match(source, /const commitWallVertexDrag = \(wallId, vertexIndex, event\) =>/, "Wall drag must have a direct Konva drop handler");
assert.match(source, /nodes\[vertexIndex\] = \{ x: position\.x, y: position\.y \}/, "Direct wall drag must preserve the exact dropped corner position");
assert.match(source, /activeTool !== 'select'/, "Select mode must not start a canvas pan before a corner handle can drag");
assert.doesNotMatch(source, /autoDetectOpeningDimensions/, "Placing an opening must not overwrite manually entered dimensions");
assert.match(source, /widthMm: openingWidthMm/, "Placed openings must use the manually entered width");

// The pointer crosshair is the topmost child of the Konva layer and is drawn at the cursor, so if it
// listens for events it sits under every click and swallows the selection of whatever markup is
// beneath it. Selection of walls, areas and openings then fails everywhere on the sheet.
const crosshairStart = source.indexOf("{mouseHoverPos && (");
assert.ok(crosshairStart >= 0, "Pointer crosshair indicator must exist");
const crosshair = source.slice(crosshairStart, source.indexOf("</Layer>", crosshairStart));
assert.match(crosshair, /<Group x=\{mouseHoverPos\.x\} y=\{mouseHoverPos\.y\} listening=\{false\}>/, "Pointer crosshair group must not listen for pointer events");
assert.equal((crosshair.match(/listening=\{false\}/g) || []).length, 4, "Every pointer crosshair shape must opt out of hit detection");

// Auto-detection writes into the same state the Wall Thickness box is bound to, so without a guard
// it overwrites a thickness the estimator typed and finalises the run at the detected value instead.
assert.match(source, /const autoDetectWallThickness = \(clickX, clickY, nearestSegment\) => \{[\s\S]{0,80}?if \(!autoDetectWallThickness_Enabled\) return;/, "Auto-detect must not overwrite a manually entered wall thickness");
assert.match(source, /setDetectedWallThicknessMm\(parseFloat\(e\.target\.value\) \|\| 0\);[\s\S]{0,80}?setAutoDetectWallThicknessEnabled\(false\);/, "Typing a wall thickness must switch auto-detect off");

// A loose snap tolerance drags a click off the corner it landed on, which reads as the tool refusing
// to draw where you clicked.
const snapRadius = source.match(/const SNAP_RADIUS_SCREEN_PX = (\d+);/);
assert.ok(snapRadius, "Snap tolerance must be a named constant");
assert.ok(Number(snapRadius[1]) <= 20, "Snap tolerance must stay tight enough to land on the clicked corner");
assert.doesNotMatch(source, /120 \/ stageScale/, "Snap tolerance must not fall back to the old 120px radius");

// A markup that cancels the Konva bubble before checking the active tool swallows the click on its
// way to the Stage, so the Stage never runs its draw handler. With the plan covered in floorcovering
// areas and eaves, that makes wall drawing fail everywhere except blank margin.
const layerStart = source.indexOf("{/* Floorplans & Vertex Handles */}");
const layerEnd = source.indexOf("</Layer>", layerStart);
assert.ok(layerStart >= 0 && layerEnd > layerStart, "Markup render layer must exist");
const markupLayer = source.slice(layerStart, layerEnd);
const unguarded = markupLayer.match(/onClick=\{\(e\) => \{\s*e\.cancelBubble = true;/g) || [];
assert.equal(unguarded.length, 0, `Every markup click handler must check the active tool before cancelling the bubble (${unguarded.length} do not)`);

console.log("Takeoff wall vertex editor regression checks passed.");
