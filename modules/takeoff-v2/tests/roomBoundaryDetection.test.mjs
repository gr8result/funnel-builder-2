import assert from "node:assert/strict";
import { createWallSegment } from "../types.js";
import { detectRoomBoundary, findWallCycles, rectFromCorners } from "../takeoff/roomBoundaryDetection.js";

const MM_PER_DOC_UNIT = 1000;

function pageWithRooms({ vertices, segments, holes = [] }) {
  return {
    calibration: { mmPerDocumentUnit: MM_PER_DOC_UNIT },
    exteriorWalls: null,
    internalWalls: {
      vertices,
      segments,
      isClosed: false,
      confirmed: false,
      confirmedAt: null,
      detectionConfidence: null,
      detectedSnapshot: null,
      wallThicknessMm: 0,
    },
    roomExclusionCandidates: holes,
  };
}

function segment(id, aId, bId) {
  return createWallSegment({ id, aId, bId, wallType: "internal", source: "manual", confirmed: true });
}

function rectangleRoom(id, x, y, width, height) {
  const vertices = [
    { id: `${id}a`, x, y },
    { id: `${id}b`, x: x + width, y },
    { id: `${id}c`, x: x + width, y: y + height },
    { id: `${id}d`, x, y: y + height },
  ];
  const segments = [
    segment(`${id}s1`, `${id}a`, `${id}b`),
    segment(`${id}s2`, `${id}b`, `${id}c`),
    segment(`${id}s3`, `${id}c`, `${id}d`),
    segment(`${id}s4`, `${id}d`, `${id}a`),
  ];
  return { vertices, segments };
}

// Simple bedroom: rectangle selection returns the room polygon, not the
// dragged rectangle.
{
  const room = rectangleRoom("bed", 0, 0, 4, 3);
  const page = pageWithRooms(room);
  const result = detectRoomBoundary({
    page,
    searchRect: rectFromCorners({ x: 1, y: 1 }, { x: 2, y: 2 }),
  });
  assert.equal(result.valid, true);
  assert.equal(result.source, "rectangle");
  assert.equal(result.outerBoundary.length, 4);
  assert.equal(result.netAreaM2.toFixed(2), "12.00");
  assert.notDeepEqual(result.outerBoundary, [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 1, y: 2 }]);
}

// Bedroom with robe: gross/excluded/net use polygon holes.
{
  const room = rectangleRoom("bed", 0, 0, 4.7, 3);
  const robe = { id: "robe-1", type: "robe", vertices: [{ x: 0, y: 0 }, { x: 1.8, y: 0 }, { x: 1.8, y: 0.9 }, { x: 0, y: 0.9 }] };
  const page = pageWithRooms({ ...room, holes: [robe] });
  const result = detectRoomBoundary({ page, seedPoint: { x: 2, y: 1.5 }, exclusionCandidates: page.roomExclusionCandidates });
  assert.equal(result.valid, true);
  assert.equal(result.grossAreaM2.toFixed(2), "14.10");
  assert.equal(result.excludedAreaM2.toFixed(2), "1.62");
  assert.equal(result.netAreaM2.toFixed(2), "12.48");
  assert.equal(result.holes[0].type, "robe");
}

// Open doorway: a semantic/logical wall segment across the doorway keeps the
// bedroom region from leaking into the hallway.
{
  const room = rectangleRoom("bed", 0, 0, 4, 3);
  const hall = rectangleRoom("hall", 4, 0, 2, 3);
  const page = pageWithRooms({ vertices: [...room.vertices, ...hall.vertices], segments: [...room.segments, ...hall.segments] });
  const result = detectRoomBoundary({ page, seedPoint: { x: 2, y: 1.5 } });
  assert.equal(result.valid, true);
  assert.equal(result.netAreaM2.toFixed(2), "12.00");
}

// Open-plan area: with no separating wall, the combined polygon is selected.
{
  const combined = rectangleRoom("open", 0, 0, 8, 4);
  const page = pageWithRooms(combined);
  const result = detectRoomBoundary({ page, seedPoint: { x: 2, y: 2 } });
  assert.equal(result.valid, true);
  assert.equal(result.netAreaM2.toFixed(2), "32.00");
}

// Irregular room: an L-shaped cycle is returned instead of its bounding box.
{
  const vertices = [
    { id: "a", x: 0, y: 0 }, { id: "b", x: 5, y: 0 }, { id: "c", x: 5, y: 2 },
    { id: "d", x: 3, y: 2 }, { id: "e", x: 3, y: 5 }, { id: "f", x: 0, y: 5 },
  ];
  const segments = [
    segment("s1", "a", "b"), segment("s2", "b", "c"), segment("s3", "c", "d"),
    segment("s4", "d", "e"), segment("s5", "e", "f"), segment("s6", "f", "a"),
  ];
  const page = pageWithRooms({ vertices, segments });
  const cycles = findWallCycles(page);
  assert.equal(cycles.length, 1);
  const result = detectRoomBoundary({ page, seedPoint: { x: 1, y: 1 } });
  assert.equal(result.valid, true);
  assert.equal(result.outerBoundary.length, 6);
  assert.equal(result.netAreaM2.toFixed(2), "19.00");
}

// Rotation invariance: base-PDF coordinates give the same area regardless of
// viewer rotation metadata.
for (const rotation of [0, 90, 180, 270]) {
  const room = rectangleRoom(`r${rotation}`, 0, 0, 4, 3);
  const page = { ...pageWithRooms(room), rotation };
  const result = detectRoomBoundary({ page, seedPoint: { x: 2, y: 1.5 } });
  assert.equal(result.netAreaM2.toFixed(2), "12.00");
}

// Persistence-shaped room metadata survives JSON round-trip.
{
  const room = rectangleRoom("persist", 0, 0, 4, 3);
  const page = pageWithRooms(room);
  const result = detectRoomBoundary({ page, seedPoint: { x: 2, y: 1.5 } });
  const persisted = JSON.parse(JSON.stringify({
    outerBoundary: result.outerBoundary,
    holes: result.holes,
    grossAreaM2: result.grossAreaM2,
    excludedAreaM2: result.excludedAreaM2,
    netAreaM2: result.netAreaM2,
    source: result.source,
    confidence: result.confidence,
    confirmed: true,
  }));
  assert.equal(persisted.netAreaM2.toFixed(2), "12.00");
  assert.equal(persisted.source, "room-detect");
}

console.log("roomBoundaryDetection.test.mjs passed");
