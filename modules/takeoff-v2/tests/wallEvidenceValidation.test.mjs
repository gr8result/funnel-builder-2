import assert from "node:assert/strict";
import { validateExteriorWallsForConfirmation } from "../takeoff/areaCalculation.js";

const calibration = { mmPerDocumentUnit: 10 };
const vertices = [
  { id: "a", x: 0, y: 0 },
  { id: "b", x: 10, y: 0 },
  { id: "c", x: 10, y: 10 },
  { id: "d", x: 0, y: 10 },
];

function evidenceSegment(id, aId, bId) {
  const a = vertices.find((vertex) => vertex.id === aId);
  const b = vertices.find((vertex) => vertex.id === bId);
  return {
    id,
    aId,
    bId,
    geometryStatus: "resolved",
    faceA: { start: a, end: b },
    faceB: { start: { x: a.x + 1, y: a.y + 1 }, end: { x: b.x + 1, y: b.y + 1 } },
  };
}

const validPage = {
  calibration,
  exteriorWalls: {
    vertices,
    segments: [
      evidenceSegment("ab", "a", "b"),
      evidenceSegment("bc", "b", "c"),
      evidenceSegment("cd", "c", "d"),
      evidenceSegment("da", "d", "a"),
    ],
  },
};

assert.equal(validateExteriorWallsForConfirmation(validPage).valid, true, "resolved face-backed exterior loops can be approved");

const unresolved = {
  ...validPage,
  exteriorWalls: {
    ...validPage.exteriorWalls,
    segments: [
      ...validPage.exteriorWalls.segments.slice(0, 3),
      { id: "da", aId: "d", bId: "a", geometryStatus: "manual" },
    ],
  },
};
assert.match(validateExteriorWallsForConfirmation(unresolved).reason, /wall-face evidence/, "point-connected exterior segments must block approval");

const missing = {
  ...validPage,
  exteriorWalls: {
    ...validPage.exteriorWalls,
    segments: [
      ...validPage.exteriorWalls.segments.slice(0, 3),
      { ...evidenceSegment("da", "d", "a"), missingSectionIndicator: true },
    ],
  },
};
assert.match(validateExteriorWallsForConfirmation(missing).reason, /review gaps|rejected connections/, "missing/rejected connection indicators must block approval");

console.log("wallEvidenceValidation.test.mjs passed");
