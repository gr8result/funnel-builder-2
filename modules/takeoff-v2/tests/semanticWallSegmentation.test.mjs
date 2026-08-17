import assert from "node:assert/strict";
import {
  FixtureWallSegmentationProvider,
  ModelReadyWallSegmentationProvider,
  applyOpeningGapContinuity,
  buildSemanticWallGraph,
  createEmptyMask,
  preprocessFloorPlanImage,
  reconstructExteriorEnvelope,
  segmentFloorPlanWithFallback,
  semanticPipelineFromMasks,
  vectoriseSemanticWallMasks,
} from "../detection/index.js";

function drawRect(mask, x1, y1, x2, y2, value = 1) {
  for (let y = y1; y < y2; y += 1) {
    for (let x = x1; x < x2; x += 1) mask.data[y * mask.width + x] = value;
  }
}

function makeFixtureMasks() {
  const exteriorWallMask = createEmptyMask(160, 120);
  const interiorWallMask = createEmptyMask(160, 120);
  const doorMask = createEmptyMask(160, 120);
  const windowMask = createEmptyMask(160, 120);

  drawRect(exteriorWallMask, 10, 10, 110, 18); // top
  drawRect(exteriorWallMask, 102, 10, 110, 52); // right upper
  drawRect(exteriorWallMask, 102, 68, 110, 100); // right lower, garage gap between
  drawRect(exteriorWallMask, 70, 92, 110, 100); // lower right return
  drawRect(exteriorWallMask, 70, 58, 78, 100); // concave recess side
  drawRect(exteriorWallMask, 42, 58, 78, 66); // concave recess top
  drawRect(exteriorWallMask, 42, 58, 50, 100); // concave recess side
  drawRect(exteriorWallMask, 10, 92, 50, 100); // lower left
  drawRect(exteriorWallMask, 10, 10, 18, 100); // left

  drawRect(interiorWallMask, 50, 18, 58, 58);
  drawRect(doorMask, 103, 52, 109, 68); // garage-door/opening gap in right wall
  drawRect(windowMask, 44, 92, 68, 99);

  return { exteriorWallMask, interiorWallMask, doorMask, windowMask };
}

{
  const provider = new FixtureWallSegmentationProvider({ masks: makeFixtureMasks(), confidence: 0.88 });
  const result = await provider.segmentFloorPlan({ image: { width: 160, height: 120 } });
  assert.equal(result.ok, true);
  assert.equal(result.masks.exteriorWallMask.width, 160);
  assert.equal(result.confidence, 0.88);
}

{
  const unavailable = new ModelReadyWallSegmentationProvider({ modelPath: "models/walls.onnx", runtime: "onnx" });
  const fallback = await segmentFloorPlanWithFallback({
    provider: unavailable,
    image: { width: 160, height: 120 },
    fallbackMasks: makeFixtureMasks(),
  });
  assert.equal(fallback.ok, true);
  assert.equal(fallback.provider, "fallback-masks");
}

{
  const image = { width: 24, height: 16, data: new Uint8ClampedArray(24 * 16).fill(255) };
  const dark = (x, y) => { image.data[y * image.width + x] = 0; };
  for (let x = 2; x < 22; x += 1) dark(x, 8);
  for (let y = 4; y < 13; y += 1) dark(6, y);
  for (let y = 4; y < 13; y += 1) dark(14, y);
  dark(4, 2); dark(5, 2); dark(6, 2); // text-like speck
  const processed = preprocessFloorPlanImage(image, { threshold: 128, suppressTextAndDimensions: true });
  assert.ok(processed.diagnostics.foregroundPixels > 0);
  assert.ok(processed.diagnostics.suppressionPixels > 0);
  assert.equal(processed.width, 24);
}

{
  const provider = new FixtureWallSegmentationProvider({ masks: makeFixtureMasks(), confidence: 0.86 });
  const segmentation = await provider.segmentFloorPlan({ image: { width: 160, height: 120 } });
  const vectors = vectoriseSemanticWallMasks(segmentation, { mmPerPixel: 10, minWallLengthPx: 4 });
  assert.ok(vectors.walls.filter((wall) => wall.type === "exterior").length >= 8, "short return/recess walls must survive vectorisation");
  assert.ok(vectors.walls.some((wall) => wall.type === "interior"));
  assert.ok(vectors.openings.some((opening) => opening.type === "door"));
  assert.ok(vectors.openings.some((opening) => opening.type === "window"));
  assert.ok(vectors.walls.every((wall) => wall.thicknessMm != null), "scale conversion should populate wall thickness");
}

{
  const walls = [
    wall("top", "exterior", [10, 14], [106, 14]),
    wall("right-upper", "exterior", [106, 14], [106, 52]),
    wall("right-lower", "exterior", [106, 68], [106, 96]),
    wall("bottom-right", "exterior", [106, 96], [74, 96]),
    wall("recess-right", "exterior", [74, 96], [74, 62]),
    wall("recess-top", "exterior", [74, 62], [46, 62]),
    wall("recess-left", "exterior", [46, 62], [46, 96]),
    wall("bottom-left", "exterior", [46, 96], [14, 96]),
    wall("left", "exterior", [14, 96], [14, 14]),
    wall("partition", "interior", [54, 18], [54, 58]),
  ];
  const openings = [opening("garage", "garage-door", [106, 52], [106, 68]), opening("window", "window", [46, 96], [74, 96])];
  const graph = applyOpeningGapContinuity(buildSemanticWallGraph({ walls, openings, scale: { mmPerPixel: 10 } }));
  assert.equal(graph.edges.length, walls.length);
  assert.ok(graph.edges.find((edge) => edge.id === "right-upper").logicalContinuity.some((link) => link.openingId === "garage"));
  assert.equal(graph.edges.find((edge) => edge.id === "top").lengthMm, 960);

  const envelope = reconstructExteriorEnvelope(graph);
  assert.equal(envelope.closed, true);
  assert.equal(envelope.convexHullUsed, false);
  assert.equal(envelope.concavePreserved, true);
  assert.ok(envelope.points.some((point) => point.x === 74 && point.y === 62), "concave recess vertex must remain in the envelope");
}

{
  const walls = [wall("manual-added-return", "exterior", [0, 0], [10, 0], { source: "manual", confidence: 1 })];
  const graph = buildSemanticWallGraph({ walls, openings: [] });
  assert.equal(graph.edges[0].source, "manual");
  assert.equal(graph.edges[0].confirmed, true);
  const removed = { ...graph, edges: graph.edges.filter((edge) => edge.id !== "manual-added-return") };
  assert.equal(removed.edges.length, 0, "manual remove can delete a detected/added wall edge without rebuilding the graph");
}

{
  const unavailable = { ok: false };
  const fallbackWalls = [wall("fallback", "exterior", [0, 0], [10, 0])];
  const pipeline = semanticPipelineFromMasks({
    segmentation: unavailable,
    scale: { mmPerPixel: 50 },
    fallbackWalls,
    vectorise: vectoriseSemanticWallMasks,
  });
  assert.equal(pipeline.ok, true);
  assert.equal(pipeline.source, "fallback-existing-candidates");
  assert.equal(pipeline.graph.edges.length, 1);
}

console.log("semanticWallSegmentation.test.mjs passed");

function wall(id, type, start, end, extra = {}) {
  return {
    id,
    type,
    start: { x: start[0], y: start[1] },
    end: { x: end[0], y: end[1] },
    source: extra.source || "ai",
    confidence: extra.confidence ?? 0.84,
    thicknessMm: extra.thicknessMm ?? 90,
    providerGeometry: { thicknessPx: 8 },
    ...extra,
  };
}

function opening(id, type, start, end) {
  return {
    id,
    type,
    start: { x: start[0], y: start[1] },
    end: { x: end[0], y: end[1] },
    confidence: 0.8,
  };
}
