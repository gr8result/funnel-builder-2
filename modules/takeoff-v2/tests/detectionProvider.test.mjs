import assert from "node:assert/strict";

import { createTakeoffDetectionProvider } from "../detection/index.js";
import { normalisedWallsToExteriorCandidate, normalisedWallsToWallGraph } from "../detection/gr8Geometry.js";
import { normaliseKreoOpening, normaliseKreoSpace, normaliseKreoWall } from "../detection/kreoProvider.js";

const provider = createTakeoffDetectionProvider();
const status = provider.getStatus();
assert.equal(status.id, "local-quarantined");
assert.equal(status.enabled, false);

const unavailable = await provider.detectWalls({});
assert.equal(unavailable.ok, false);
assert.equal(unavailable.status, "unavailable");
assert.match(unavailable.reason, /quarantined/i);

const wall = normaliseKreoWall({
  p1: [10, 20],
  p2: [110, 20],
  length: 4,
  thickness: 0.25,
  confidence: 0.82,
});
assert.equal(wall.type, "unknown");
assert.deepEqual(wall.start, { x: 10, y: 20 });
assert.deepEqual(wall.end, { x: 110, y: 20 });
assert.equal(wall.thicknessMm, 250);
assert.equal(wall.confidence, 0.82);

const opening = normaliseKreoOpening({
  p1: [30, 20],
  p2: [45, 20],
  length: 0.9,
  confidence: 0.76,
}, "door");
assert.equal(opening.type, "door");
assert.equal(opening.widthMm, 900);

const space = normaliseKreoSpace({
  points: [[0, 0], [100, 0], [100, 50], [0, 50]],
  area: 12.86,
  perimeter: 14.38,
  text: ["Bedroom", "13.0m²"],
});
assert.equal(space.name, "Bedroom");
assert.equal(space.areaM2, 12.86);
assert.equal(space.polygon.length, 4);

const providerGraph = normalisedWallsToWallGraph([
  { ...wall, type: "exterior", id: "provider-wall-1" },
  normaliseKreoWall({ p1: [110, 20], p2: [110, 70], thickness: 0.25, confidence: "high" }),
], { wallType: "exterior", providerId: "kreo-ai-search" });
assert.equal(providerGraph.vertices.length, 3);
assert.equal(providerGraph.segments.length, 2);
assert.equal(providerGraph.segments[0].wallType, "exterior");
assert.equal(providerGraph.segments[0].source, "kreo-ai-search");
assert.equal(providerGraph.segments[0].confirmed, false);
assert.equal(providerGraph.segments[0].providerWallId, "provider-wall-1");

const exteriorCandidate = normalisedWallsToExteriorCandidate([{ ...wall, type: "exterior" }], { providerId: "kreo-ai-search" });
assert.equal(exteriorCandidate.source, "auto-detector-v2");
assert.equal(exteriorCandidate.reviewStatus, "candidate-ready");
assert.equal(exteriorCandidate.segments.length, 1);

console.log("detectionProvider.test.mjs passed");
