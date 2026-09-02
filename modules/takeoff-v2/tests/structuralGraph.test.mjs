import assert from "node:assert/strict";
import {
  buildStructuralGraph,
  createStructuralSpatialIndex,
  findNearestStructuralNode,
  findNearestWallFacePair,
  resolveWallRunFromStructuralGraph,
} from "../takeoff/structuralGraph.js";
import { extractTextBoxesFromTextContent } from "../geometry/pdfTextExtraction.js";

let seq = 0;
function line(a, b, extra = {}) {
  seq += 1;
  return {
    id: extra.id || `sg-test-${seq}`,
    a,
    b,
    length: Math.hypot(b.x - a.x, b.y - a.y),
    source: "vector",
    ...extra,
  };
}

function page(overrides = {}) {
  return {
    sourceWidth: 500,
    sourceHeight: 400,
    calibration: { mmPerDocumentUnit: 10 },
    exteriorWalls: { wallThicknessMm: 250 },
    internalWalls: { wallThicknessMm: 90 },
    ...overrides,
  };
}

// ---- structural lines are normalised and collinear fragments merge --------
{
  const graph = buildStructuralGraph({
    source: "fixture",
    rawSegments: [
      line({ x: 100, y: 100 }, { x: 180, y: 100 }, { id: "frag-a" }),
      line({ x: 181, y: 100.4 }, { x: 260, y: 100.4 }, { id: "frag-b" }),
      line({ x: 100, y: 109 }, { x: 260, y: 109 }, { id: "parallel-face" }),
    ],
  }, page());
  assert.ok(graph.structuralLines.length <= 2, "collinear fragments should merge into one face line");
  assert.ok(graph.structuralLines.some((entry) => entry.sourceSegmentIds.includes("frag-a") && entry.sourceSegmentIds.includes("frag-b")));
}

// ---- obvious non-structural geometry is rejected before node creation -----
{
  const graph = buildStructuralGraph({
    source: "fixture",
    rawSegments: [
      line({ x: 100, y: 100 }, { x: 250, y: 100 }, { id: "wall-face" }),
      line({ x: 80, y: 60 }, { x: 420, y: 60 }, { id: "dimension", isDimension: true }),
      line({ x: 10, y: 20 }, { x: 490, y: 20 }, { id: "sheet-border" }),
      line({ x: 130, y: 130 }, { x: 138, y: 138 }, { id: "text-stroke", type: "text" }),
      line({ x: 160, y: 160 }, { x: 220, y: 160 }, { id: "setback", dashPattern: [[2, 2], 0] }),
    ],
  }, page());
  const rejectedIds = new Set(graph.rejected.map((entry) => entry.id));
  assert.ok(rejectedIds.has("dimension"));
  assert.ok(rejectedIds.has("sheet-border"));
  assert.ok(rejectedIds.has("text-stroke"));
  assert.ok(rejectedIds.has("setback"));
  assert.ok(graph.structuralLines.some((entry) => entry.sourceSegmentIds.includes("wall-face")));
}

// ---- graph nodes classify L/T/X and near intersections --------------------
{
  const graph = buildStructuralGraph({
    source: "fixture",
    rawSegments: [
      line({ x: 100, y: 100 }, { x: 220, y: 100 }, { id: "x-horizontal" }),
      line({ x: 160, y: 40 }, { x: 160, y: 160 }, { id: "x-vertical" }),
      line({ x: 260, y: 100 }, { x: 360, y: 100 }, { id: "t-main" }),
      line({ x: 310, y: 100 }, { x: 310, y: 170 }, { id: "t-stem" }),
      line({ x: 100, y: 220 }, { x: 180, y: 220 }, { id: "near-a" }),
      line({ x: 184, y: 150 }, { x: 184, y: 218 }, { id: "near-b" }),
    ],
  }, page());
  const types = graph.summary.nodeTypes;
  assert.ok(types.X >= 1, "crossing structural faces should create X node");
  assert.ok(types.T >= 1, "wall stem meeting face should create T node");
  assert.ok(types.near_intersection >= 1, "slightly short drafting lines should create near_intersection node");
}

// ---- calibrated wall-face pairs are found for 70/90/230/250mm -------------
{
  const rawSegments = [];
  [70, 90, 230, 250].forEach((mm, index) => {
    const y = 80 + index * 70;
    const separation = mm / 10;
    rawSegments.push(line({ x: 80, y }, { x: 260, y }, { id: `face-${mm}-a` }));
    rawSegments.push(line({ x: 80, y: y + separation }, { x: 260, y: y + separation }, { id: `face-${mm}-b` }));
  });
  const graph = buildStructuralGraph({ source: "fixture", rawSegments }, page());
  const paired = new Set(graph.facePairs.map((pair) => pair.targetThicknessMm));
  assert.ok(paired.has(70));
  assert.ok(paired.has(90));
  assert.ok(paired.has(230));
  assert.ok(paired.has(250));
}

// ---- PDF text boxes reject short glyph-like structural false positives ----
{
  const textBoxes = extractTextBoxesFromTextContent({
    items: [
      { str: "LAUNDRY", width: 50, height: 9, transform: [9, 0, 0, 9, 150, 150] },
    ],
  }, { pageWidth: 500, pageHeight: 400 });
  const graph = buildStructuralGraph({
    source: "fixture",
    rawSegments: [
      line({ x: 153, y: 142 }, { x: 162, y: 142 }, { id: "glyph-stroke" }),
      line({ x: 100, y: 100 }, { x: 260, y: 100 }, { id: "real-wall-a" }),
      line({ x: 100, y: 109 }, { x: 260, y: 109 }, { id: "real-wall-b" }),
    ],
    textBoxes,
  }, page(), { textBoxes });
  assert.ok(graph.rejected.some((entry) => entry.id === "glyph-stroke" && entry.reason === "text_glyph_or_label"));
}

// ---- primary plan region excludes title-block / notes-area survivors ------
{
  const graph = buildStructuralGraph({
    source: "fixture",
    rawSegments: [
      line({ x: 100, y: 100 }, { x: 260, y: 100 }, { id: "building-a" }),
      line({ x: 100, y: 109 }, { x: 260, y: 109 }, { id: "building-b" }),
      line({ x: 110, y: 150 }, { x: 260, y: 150 }, { id: "building-c" }),
      line({ x: 430, y: 320 }, { x: 490, y: 320 }, { id: "notes-line" }),
    ],
  }, page(), { planRegionBBox: { x: 70, y: 70, width: 240, height: 140 } });
  assert.ok(graph.rejected.some((entry) => entry.id === "notes-line" && entry.reason === "outside_plan_region"));
}

// ---- dimension chains reject the long string, not only individual ticks ---
{
  const graph = buildStructuralGraph({
    source: "fixture",
    rawSegments: [
      line({ x: 90, y: 90 }, { x: 260, y: 90 }, { id: "wall-a" }),
      line({ x: 90, y: 99 }, { x: 260, y: 99 }, { id: "wall-b" }),
      line({ x: 90, y: 300 }, { x: 260, y: 300 }, { id: "dimension-string" }),
      line({ x: 110, y: 294 }, { x: 116, y: 306 }, { id: "tick-a" }),
      line({ x: 180, y: 294 }, { x: 186, y: 306 }, { id: "tick-b" }),
      line({ x: 240, y: 294 }, { x: 246, y: 306 }, { id: "tick-c" }),
    ],
  }, page(), { planRegionBBox: { x: 70, y: 70, width: 230, height: 90 } });
  assert.ok(graph.rejected.some((entry) => entry.id === "dimension-string" && entry.reason === "dimension_chain_group"));
}

// ---- dashed/reference vectors are rejected when dash metadata is present --
{
  const graph = buildStructuralGraph({
    source: "fixture",
    rawSegments: [
      line({ x: 100, y: 100 }, { x: 250, y: 100 }, { id: "dashed-ref", dashPattern: [[4, 2], 0] }),
    ],
  }, page(), { planRegionBBox: { x: 50, y: 50, width: 300, height: 120 } });
  assert.ok(graph.rejected.some((entry) => entry.id === "dashed-ref" && entry.reason === "dashed_dimension_or_setback"));
}

// ---- paired faces with node support reinforce structural confidence -------
{
  const graph = buildStructuralGraph({
    source: "fixture",
    rawSegments: [
      line({ x: 100, y: 100 }, { x: 260, y: 100 }, { id: "pair-a" }),
      line({ x: 100, y: 109 }, { x: 260, y: 109 }, { id: "pair-b" }),
      line({ x: 100, y: 80 }, { x: 100, y: 130 }, { id: "left-return" }),
      line({ x: 260, y: 80 }, { x: 260, y: 130 }, { id: "right-return" }),
      line({ x: 330, y: 220 }, { x: 410, y: 220 }, { id: "isolated" }),
    ],
  }, page());
  const pairedLine = graph.structuralLines.find((entry) => entry.sourceSegmentIds.includes("pair-a"));
  const isolated = graph.structuralLines.find((entry) => entry.sourceSegmentIds.includes("isolated"));
  assert.ok(pairedLine?.structuralConfidence > (isolated?.structuralConfidence || 0));
  assert.ok(graph.wallAssemblies.some((assembly) => Math.round(assembly.thicknessMm) === 90 && assembly.nodeSupport > 0));
}

// ---- spatial index and nearest structural node lookup --------------------
{
  const graph = buildStructuralGraph({
    source: "fixture",
    rawSegments: [
      line({ x: 100, y: 100 }, { x: 260, y: 100 }, { id: "node-wall-a" }),
      line({ x: 100, y: 109 }, { x: 260, y: 109 }, { id: "node-wall-b" }),
      line({ x: 100, y: 70 }, { x: 100, y: 140 }, { id: "node-return-left" }),
    ],
  }, page());
  const index = createStructuralSpatialIndex(graph.nodes);
  assert.ok(index.query({ x: 100, y: 104 }, 12).length > 0, "index should return nearby nodes only");
  const node = findNearestStructuralNode({ ...graph, nodeSpatialIndex: index }, { x: 101, y: 104 }, { radiusDocUnits: 14 });
  assert.ok(node, "nearest-node lookup should find supported node");
  assert.ok(["jamb", "L", "T", "near_intersection", "endpoint"].includes(node.type));
}

// ---- graph face-pair lookup honors configured interior thickness ----------
{
  const graph = buildStructuralGraph({
    source: "fixture",
    rawSegments: [
      line({ x: 80, y: 120 }, { x: 340, y: 120 }, { id: "lookup-70-a" }),
      line({ x: 80, y: 127 }, { x: 340, y: 127 }, { id: "lookup-70-b" }),
      line({ x: 80, y: 140 }, { x: 340, y: 140 }, { id: "lookup-90-a" }),
      line({ x: 80, y: 149 }, { x: 340, y: 149 }, { id: "lookup-90-b" }),
    ],
  }, page({ internalWalls: { wallThicknessMm: 70, thicknessLocked: true } }));
  const found = findNearestWallFacePair(graph, { x: 160, y: 121 }, { wallType: "internal", field: "internalWalls", radiusDocUnits: 12 });
  assert.ok(found?.pair, "face-pair lookup should resolve a nearby structural pair");
  assert.equal(Math.round(found.pair.separationMm), 70);
}

// ---- one click resolves full interior wall run between structural nodes ---
{
  const fixturePage = page({ internalWalls: { wallThicknessMm: 90, thicknessLocked: true } });
  const planGeometryIndex = {
    source: "fixture",
    rawSegments: [
      line({ x: 110, y: 140 }, { x: 410, y: 140 }, { id: "run-face-a" }),
      line({ x: 110, y: 149 }, { x: 410, y: 149 }, { id: "run-face-b" }),
      line({ x: 110, y: 90 }, { x: 110, y: 190 }, { id: "run-left-t" }),
      line({ x: 410, y: 90 }, { x: 410, y: 190 }, { id: "run-right-t" }),
    ],
  };
  const result = resolveWallRunFromStructuralGraph(
    { x: 270, y: 142 },
    { planGeometryIndex, page: fixturePage, wallType: "internal", field: "internalWalls" },
  );
  assert.equal(result.status, "resolved");
  assert.equal(Math.round(result.start.x), 110);
  assert.equal(Math.round(result.end.x), 410);
  assert.equal(Math.round(result.metadata.thicknessMm), 90);
  assert.ok(result.startNode);
  assert.ok(result.endNode);
  assert.equal(result.metadata.wallRunDetection.mode, "wall-assembly-graph-one-click");
  assert.ok(result.metadata.wallRunDetection.wallAssemblyId);
}

// ---- exterior assemblies require outside on one side/building on the other -
{
  const graph = buildStructuralGraph({
    source: "fixture",
    rawSegments: [
      line({ x: 100, y: 100 }, { x: 400, y: 100 }, { id: "top-outer" }),
      line({ x: 100, y: 125 }, { x: 400, y: 125 }, { id: "top-inner" }),
      line({ x: 100, y: 300 }, { x: 400, y: 300 }, { id: "bottom-inner" }),
      line({ x: 100, y: 325 }, { x: 400, y: 325 }, { id: "bottom-outer" }),
      line({ x: 100, y: 100 }, { x: 100, y: 325 }, { id: "left-outer" }),
      line({ x: 125, y: 100 }, { x: 125, y: 325 }, { id: "left-inner" }),
      line({ x: 375, y: 100 }, { x: 375, y: 325 }, { id: "right-inner" }),
      line({ x: 400, y: 100 }, { x: 400, y: 325 }, { id: "right-outer" }),
      line({ x: 150, y: 210 }, { x: 350, y: 210 }, { id: "cross-a" }),
      line({ x: 150, y: 235 }, { x: 350, y: 235 }, { id: "cross-b" }),
    ],
  }, page());
  const exterior = graph.exteriorAssemblies.find((assembly) => assembly.faceA.sourceSegmentIds.includes("top-outer") || assembly.faceB.sourceSegmentIds.includes("top-outer"));
  const chord = graph.wallAssemblies.find((assembly) => assembly.faceA.sourceSegmentIds.includes("cross-a") || assembly.faceB.sourceSegmentIds.includes("cross-a"));
  assert.ok(exterior?.exteriorScore >= 0.62, "outer shell should classify as exterior");
  assert.ok(chord?.rejectedAsExterior, "cross-building pair should be rejected as exterior");
  assert.ok(chord.rejectionReasons.some((reason) => reason.includes("building occupancy both sides")));
}

// ---- interior assemblies require building/room occupancy on both sides ----
{
  const graph = buildStructuralGraph({
    source: "fixture",
    rawSegments: [
      line({ x: 80, y: 80 }, { x: 420, y: 80 }, { id: "shell-top-a" }),
      line({ x: 80, y: 105 }, { x: 420, y: 105 }, { id: "shell-top-b" }),
      line({ x: 80, y: 320 }, { x: 420, y: 320 }, { id: "shell-bottom-a" }),
      line({ x: 80, y: 345 }, { x: 420, y: 345 }, { id: "shell-bottom-b" }),
      line({ x: 80, y: 80 }, { x: 80, y: 345 }, { id: "shell-left-a" }),
      line({ x: 105, y: 80 }, { x: 105, y: 345 }, { id: "shell-left-b" }),
      line({ x: 395, y: 80 }, { x: 395, y: 345 }, { id: "shell-right-a" }),
      line({ x: 420, y: 80 }, { x: 420, y: 345 }, { id: "shell-right-b" }),
      line({ x: 230, y: 110 }, { x: 230, y: 315 }, { id: "partition-a" }),
      line({ x: 239, y: 110 }, { x: 239, y: 315 }, { id: "partition-b" }),
      line({ x: 230, y: 110 }, { x: 270, y: 110 }, { id: "partition-t-top" }),
      line({ x: 230, y: 315 }, { x: 270, y: 315 }, { id: "partition-t-bottom" }),
    ],
  }, page());
  const partition = graph.interiorAssemblies.find((assembly) => assembly.faceA.sourceSegmentIds.includes("partition-a") || assembly.faceB.sourceSegmentIds.includes("partition-a"));
  assert.ok(partition?.interiorScore >= 0.58, "connected partition should classify as interior");
  assert.equal(partition.sideAOccupancy.classification, "building");
  assert.equal(partition.sideBOccupancy.classification, "building");
}

// ---- isolated cabinet/fixture rectangles are suppressed as interior walls --
{
  const graph = buildStructuralGraph({
    source: "fixture",
    rawSegments: [
      line({ x: 80, y: 80 }, { x: 420, y: 80 }, { id: "fixture-shell-top-a" }),
      line({ x: 80, y: 105 }, { x: 420, y: 105 }, { id: "fixture-shell-top-b" }),
      line({ x: 80, y: 320 }, { x: 420, y: 320 }, { id: "fixture-shell-bottom-a" }),
      line({ x: 80, y: 345 }, { x: 420, y: 345 }, { id: "fixture-shell-bottom-b" }),
      line({ x: 80, y: 80 }, { x: 80, y: 345 }, { id: "fixture-shell-left-a" }),
      line({ x: 105, y: 80 }, { x: 105, y: 345 }, { id: "fixture-shell-left-b" }),
      line({ x: 395, y: 80 }, { x: 395, y: 345 }, { id: "fixture-shell-right-a" }),
      line({ x: 420, y: 80 }, { x: 420, y: 345 }, { id: "fixture-shell-right-b" }),
      line({ x: 165, y: 180 }, { x: 225, y: 180 }, { id: "cabinet-a", type: "cabinetry" }),
      line({ x: 165, y: 189 }, { x: 225, y: 189 }, { id: "cabinet-b", type: "cabinetry" }),
      line({ x: 165, y: 180 }, { x: 165, y: 225 }, { id: "cabinet-c", type: "cabinetry" }),
      line({ x: 225, y: 180 }, { x: 225, y: 225 }, { id: "cabinet-d", type: "cabinetry" }),
      line({ x: 300, y: 170 }, { x: 355, y: 170 }, { id: "island-a" }),
      line({ x: 300, y: 179 }, { x: 355, y: 179 }, { id: "island-b" }),
    ],
  }, page());
  const isolated = graph.wallAssemblies.find((assembly) => assembly.faceA.sourceSegmentIds.includes("island-a") || assembly.faceB.sourceSegmentIds.includes("island-a"));
  assert.ok(!isolated || isolated.interiorScore < 0.58, "isolated fixture-like pair should not classify as interior");
  assert.ok(graph.rejected.some((entry) => entry.id === "cabinet-a" && entry.reason.startsWith("tag:")), "tagged cabinetry should be rejected before assembly scoring");
}

// ---- reverse vector direction resolves the same graph wall polygon --------
{
  const fixturePage = page({ internalWalls: { wallThicknessMm: 70, thicknessLocked: true } });
  const forward = resolveWallRunFromStructuralGraph({ x: 140, y: 100 }, {
    page: fixturePage,
    wallType: "internal",
    field: "internalWalls",
    planGeometryIndex: {
      source: "fixture",
      rawSegments: [
        line({ x: 20, y: 40 }, { x: 300, y: 40 }, { id: "forward-shell-top-a" }),
        line({ x: 20, y: 65 }, { x: 300, y: 65 }, { id: "forward-shell-top-b" }),
        line({ x: 20, y: 260 }, { x: 300, y: 260 }, { id: "forward-shell-bottom-a" }),
        line({ x: 20, y: 285 }, { x: 300, y: 285 }, { id: "forward-shell-bottom-b" }),
        line({ x: 20, y: 40 }, { x: 20, y: 285 }, { id: "forward-shell-left-a" }),
        line({ x: 45, y: 40 }, { x: 45, y: 285 }, { id: "forward-shell-left-b" }),
        line({ x: 275, y: 40 }, { x: 275, y: 285 }, { id: "forward-shell-right-a" }),
        line({ x: 300, y: 40 }, { x: 300, y: 285 }, { id: "forward-shell-right-b" }),
        line({ x: 40, y: 100 }, { x: 240, y: 100 }, { id: "forward-a" }),
        line({ x: 40, y: 107 }, { x: 240, y: 107 }, { id: "forward-b" }),
      ],
    },
  });
  const reverse = resolveWallRunFromStructuralGraph({ x: 140, y: 100 }, {
    page: fixturePage,
    wallType: "internal",
    field: "internalWalls",
    planGeometryIndex: {
      source: "fixture",
      rawSegments: [
        line({ x: 20, y: 40 }, { x: 300, y: 40 }, { id: "reverse-shell-top-a" }),
        line({ x: 20, y: 65 }, { x: 300, y: 65 }, { id: "reverse-shell-top-b" }),
        line({ x: 20, y: 260 }, { x: 300, y: 260 }, { id: "reverse-shell-bottom-a" }),
        line({ x: 20, y: 285 }, { x: 300, y: 285 }, { id: "reverse-shell-bottom-b" }),
        line({ x: 20, y: 40 }, { x: 20, y: 285 }, { id: "reverse-shell-left-a" }),
        line({ x: 45, y: 40 }, { x: 45, y: 285 }, { id: "reverse-shell-left-b" }),
        line({ x: 275, y: 40 }, { x: 275, y: 285 }, { id: "reverse-shell-right-a" }),
        line({ x: 300, y: 40 }, { x: 300, y: 285 }, { id: "reverse-shell-right-b" }),
        line({ x: 240, y: 100 }, { x: 40, y: 100 }, { id: "reverse-a" }),
        line({ x: 240, y: 107 }, { x: 40, y: 107 }, { id: "reverse-b" }),
      ],
    },
  });
  assert.equal(forward.status, "resolved");
  assert.equal(reverse.status, "resolved");
  assert.deepEqual(
    reverse.polygon.map((point) => `${Math.round(point.x)},${Math.round(point.y)}`).sort(),
    forward.polygon.map((point) => `${Math.round(point.x)},${Math.round(point.y)}`).sort(),
  );
}

// ---- T, jamb, and reentrant graph nodes survive as explicit node types ----
{
  const graph = buildStructuralGraph({
    source: "fixture",
    rawSegments: [
      line({ x: 80, y: 100 }, { x: 220, y: 100 }, { id: "jamb-face-a" }),
      line({ x: 80, y: 109 }, { x: 220, y: 109 }, { id: "jamb-face-b" }),
      line({ x: 80, y: 90 }, { x: 80, y: 120 }, { id: "jamb-left" }),
      line({ x: 220, y: 90 }, { x: 220, y: 120 }, { id: "jamb-right" }),
      line({ x: 300, y: 100 }, { x: 420, y: 100 }, { id: "reentrant-h-a" }),
      line({ x: 300, y: 109 }, { x: 420, y: 109 }, { id: "reentrant-h-b" }),
      line({ x: 300, y: 100 }, { x: 300, y: 220 }, { id: "reentrant-v-a" }),
      line({ x: 309, y: 100 }, { x: 309, y: 220 }, { id: "reentrant-v-b" }),
      line({ x: 150, y: 180 }, { x: 260, y: 180 }, { id: "t-bar" }),
      line({ x: 205, y: 180 }, { x: 205, y: 250 }, { id: "t-stem" }),
    ],
  }, page());
  assert.ok(graph.nodes.some((node) => node.type === "jamb"), "jamb nodes should be explicit");
  assert.ok(graph.nodes.some((node) => node.type === "reentrant"), "reentrant nodes should be explicit");
  assert.ok(graph.nodes.some((node) => node.type === "T"), "T nodes should survive validation");
}

// ---- invalid blank click rejects instead of falling back to cursor --------
{
  const result = resolveWallRunFromStructuralGraph({ x: 260, y: 260 }, {
    page: page({ internalWalls: { wallThicknessMm: 90, thicknessLocked: true } }),
    wallType: "internal",
    field: "internalWalls",
    planGeometryIndex: {
      source: "fixture",
      rawSegments: [
        line({ x: 80, y: 120 }, { x: 340, y: 120 }, { id: "blank-a" }),
        line({ x: 80, y: 129 }, { x: 340, y: 129 }, { id: "blank-b" }),
      ],
    },
  });
  assert.equal(result.status, "not_found");
  assert.equal(result.reason, "no_classified_interior_assembly");
}

console.log("structuralGraph.test.mjs passed");
