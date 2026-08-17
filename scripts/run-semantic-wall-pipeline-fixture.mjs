import fs from "node:fs";
import path from "node:path";
import {
  FixtureWallSegmentationProvider,
  createEmptyMask,
  semanticPipelineFromMasks,
  vectoriseSemanticWallMasks,
} from "../modules/takeoff-v2/detection/index.js";

const outDir = path.resolve("test-results", "semantic-wall-pipeline");
fs.mkdirSync(outDir, { recursive: true });

const masks = makeFixtureMasks();
const provider = new FixtureWallSegmentationProvider({ masks, confidence: 0.87 });
const segmentation = await provider.segmentFloorPlan({ image: { width: 160, height: 120 } });
const pipeline = semanticPipelineFromMasks({
  segmentation,
  scale: { mmPerPixel: 10 },
  vectorise: vectoriseSemanticWallMasks,
});

writeJson("segmentation-summary.json", {
  provider: segmentation.provider,
  confidence: segmentation.confidence,
  classes: ["background", "exterior_wall", "interior_wall", "door", "window_opening"],
});
writeJson("vectorised-walls.json", {
  walls: pipeline.vectors.walls,
  openings: pipeline.vectors.openings,
  diagnostics: pipeline.vectors.diagnostics,
});
writeJson("wall-graph.json", pipeline.graph);
writeJson("exterior-envelope.json", pipeline.envelope);
writePgm("exterior-wall-mask.pgm", masks.exteriorWallMask);
writePgm("interior-wall-mask.pgm", masks.interiorWallMask);
writePgm("door-mask.pgm", masks.doorMask);
writePgm("window-mask.pgm", masks.windowMask);

console.log(`Semantic wall pipeline fixture output saved to ${outDir}`);
console.log(JSON.stringify({
  exteriorSegments: pipeline.graph.edges.filter((edge) => edge.classification === "exterior").length,
  interiorSegments: pipeline.graph.edges.filter((edge) => edge.classification === "interior").length,
  openings: pipeline.graph.openings.length,
  closedEnvelope: pipeline.envelope.closed,
  concavePreserved: pipeline.envelope.concavePreserved,
}, null, 2));

function makeFixtureMasks() {
  const exteriorWallMask = createEmptyMask(160, 120);
  const interiorWallMask = createEmptyMask(160, 120);
  const doorMask = createEmptyMask(160, 120);
  const windowMask = createEmptyMask(160, 120);
  drawRect(exteriorWallMask, 10, 10, 110, 18);
  drawRect(exteriorWallMask, 102, 10, 110, 52);
  drawRect(exteriorWallMask, 102, 68, 110, 100);
  drawRect(exteriorWallMask, 70, 92, 110, 100);
  drawRect(exteriorWallMask, 70, 58, 78, 100);
  drawRect(exteriorWallMask, 42, 58, 78, 66);
  drawRect(exteriorWallMask, 42, 58, 50, 100);
  drawRect(exteriorWallMask, 10, 92, 50, 100);
  drawRect(exteriorWallMask, 10, 10, 18, 100);
  drawRect(interiorWallMask, 50, 18, 58, 58);
  drawRect(doorMask, 103, 52, 109, 68);
  drawRect(windowMask, 44, 92, 68, 99);
  return { exteriorWallMask, interiorWallMask, doorMask, windowMask };
}

function drawRect(mask, x1, y1, x2, y2, value = 1) {
  for (let y = y1; y < y2; y += 1) {
    for (let x = x1; x < x2; x += 1) mask.data[y * mask.width + x] = value;
  }
}

function writeJson(name, value) {
  fs.writeFileSync(path.join(outDir, name), `${JSON.stringify(value, null, 2)}\n`);
}

function writePgm(name, mask) {
  const pixels = Array.from(mask.data, (value) => (value ? 255 : 0)).join(" ");
  fs.writeFileSync(path.join(outDir, name), `P2\n${mask.width} ${mask.height}\n255\n${pixels}\n`);
}
