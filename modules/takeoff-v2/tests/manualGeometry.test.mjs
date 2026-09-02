import assert from "node:assert/strict";
import { createWallSegment, createWallVertex, createOpening, createArea } from "../types.js";
import { manualGeometryFromPage, canonicalOpeningType } from "../takeoff/manualGeometry.js";
import { applyRoomIntrusionPolicy, findBoundaryConnectedIntrusions, setRoomIntrusionIncluded } from "../takeoff/roomIntrusions.js";
import { resolveManualTracePoint } from "../hooks/useTakeoffTools.js";

const v0 = createWallVertex({ id: "v0", x: 0, y: 0 });
const v1 = createWallVertex({ id: "v1", x: 100, y: 0 });
const v2 = createWallVertex({ id: "v2", x: 100, y: 80 });
const s0 = createWallSegment({
  id: "s0",
  aId: "v0",
  bId: "v1",
  wallType: "exterior",
  source: "manual",
  faceA: { start: { x: 0, y: 12 }, end: { x: 100, y: 12 } },
  faceB: { start: { x: 0, y: -12 }, end: { x: 100, y: -12 } },
  innerFace: { start: { x: 0, y: 12 }, end: { x: 100, y: 12 } },
  outerFace: { start: { x: 0, y: -12 }, end: { x: 100, y: -12 } },
  intermediateFaces: [{ start: { x: 0, y: 0 }, end: { x: 100, y: 0 } }],
  thicknessPx: 24,
  thicknessMm: 240,
  constructionLineCount: 3,
});
const s1 = createWallSegment({ id: "s1", aId: "v1", bId: "v2", wallType: "exterior", source: "manual" });

const page = {
  id: "page-1",
  calibration: {
    pointA: { x: 0, y: 0 },
    pointB: { x: 100, y: 0 },
    actualLengthMm: 10_000,
    documentDistance: 100,
    mmPerDocumentUnit: 100,
  },
  exteriorWalls: {
    vertices: [v0, v1, v2],
    segments: [s0, s1],
    wallThicknessMm: 200,
  },
  openings: [
    createOpening({
      id: "op0",
      wallId: "s0",
      wallGraph: "exterior",
      openingType: "garage-door",
      start: { x: 20, y: 0 },
      end: { x: 60, y: 0 },
      widthMm: 4000,
    }),
  ],
  areas: [
    createArea({
      id: "room0",
      name: "Family",
      vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 80 }, { x: 0, y: 80 }],
      source: "manual",
    }),
  ],
};

{
  const model = manualGeometryFromPage(page);
  assert.equal(model.walls.length, 2);
  assert.equal(model.walls[0].type, "exterior");
  assert.deepEqual(model.walls[0].innerFace, s0.innerFace);
  assert.deepEqual(model.walls[0].outerFace, s0.outerFace);
  assert.equal(model.walls[0].intermediateFaces.length, 1);
  assert.equal(model.walls[0].thicknessPx, 24);
  assert.equal(model.walls[0].thicknessMm, 240);
  assert.equal(model.walls[0].constructionLineCount, 3);
  assert.equal(model.walls[0].constructionType, "brick veneer");
  assert.equal(model.walls[0].lengthMm, 10_000);
  assert.deepEqual(model.walls[0].openings, ["op0"]);
  assert.equal(model.openings[0].type, "garage_door");
  assert.equal(model.openings[0].startOffset, 0.2);
  assert.equal(model.openings[0].endOffset, 0.6);
  assert.equal(model.rooms[0].areaM2, 80);
  assert.equal(model.scale.calibrated, true);
  assert.equal(model.scale.pixelsPerMm, 0.01);
}

{
  assert.equal(canonicalOpeningType("door"), "door");
  assert.equal(canonicalOpeningType("external-door"), "door");
  assert.equal(canonicalOpeningType("open-opening"), "opening");
  assert.equal(canonicalOpeningType("garage-door"), "garage_door");
}

{
  const free = resolveManualTracePoint(
    { x: 100, y: 100 },
    { lastVertex: { x: 0, y: 0 }, snapCandidate: { type: "endpoint", point: { x: 100, y: 100 }, confidence: 1 }, forceOrthogonal: false }
  );
  assert.equal(free.locked, false);
  assert.deepEqual(free.point, { x: 100, y: 100 });

  const forced = resolveManualTracePoint(
    { x: 100, y: 100 },
    { lastVertex: { x: 0, y: 0 }, snapCandidate: { type: "endpoint", point: { x: 100, y: 100 }, confidence: 1 }, forceOrthogonal: true }
  );
  assert.equal(forced.locked, true);
  assert.ok(forced.axis === "horizontal" || forced.axis === "vertical");
}

{
  const room = createArea({
    id: "bedroom",
    name: "Bedroom",
    grossAreaM2: 10.8,
    calculatedAreaM2: 10.8,
    vertices: [
      { x: 0, y: 0 },
      { x: 120, y: 0 },
      { x: 120, y: 90 },
      { x: 0, y: 90 },
    ],
  });
  const robe = {
    id: "robe-1",
    intrusionType: "robe",
    vertices: [
      { x: 80, y: 0 },
      { x: 120, y: 0 },
      { x: 120, y: 24 },
      { x: 80, y: 24 },
    ],
    source: "ai",
  };
  const freestanding = {
    id: "loose-island",
    intrusionType: "column",
    vertices: [
      { x: 20, y: 20 },
      { x: 30, y: 20 },
      { x: 30, y: 30 },
      { x: 20, y: 30 },
    ],
  };

  const detected = findBoundaryConnectedIntrusions(room, [robe, freestanding]);
  assert.equal(detected.length, 1);
  assert.equal(detected[0].id, "robe-1");
  assert.ok(detected[0].confidence > 0.7);

  const withIntrusion = applyRoomIntrusionPolicy(room, [robe, freestanding], { mmPerDocumentUnit: 100 });
  assert.equal(withIntrusion.holes.length, 1);
  assert.equal(withIntrusion.holes[0].included, false);
  assert.equal(withIntrusion.holes[0].excluded, true);
  assert.equal(withIntrusion.holes[0].overrideable, true);
  assert.equal(withIntrusion.excludedAreaM2, 9.6);
  assert.equal(Math.round(withIntrusion.netAreaM2 * 10) / 10, 1.2);

  const included = setRoomIntrusionIncluded(withIntrusion, "robe-1", true);
  assert.equal(included.holes[0].included, true);
  assert.equal(included.holes[0].excluded, false);
  assert.equal(included.holes[0].source, "manual-override");
  assert.equal(included.excludedAreaM2, 0);
  assert.equal(included.netAreaM2, 10.8);
}
