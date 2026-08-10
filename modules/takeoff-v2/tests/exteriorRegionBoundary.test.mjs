import assert from "node:assert/strict";
import { detectExteriorWallsFromGeometry } from "../takeoff/vectorExteriorDetection.js";
import { findHighlightableWallAtPoint } from "../takeoff/localWallHighlighter.js";

let seq = 0;
function line(a, b, extra = {}) {
  seq += 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return {
    id: `l-${seq}`,
    source: "vector",
    stroked: true,
    strokeColor: "#000000",
    axis: Math.abs(dx) >= Math.abs(dy) ? "horizontal" : "vertical",
    a,
    b,
    length: Math.hypot(dx, dy),
    ...extra,
  };
}

function rectWallBands(x1, y1, x2, y2, thickness = 8) {
  return [
    line({ x: x1, y: y1 }, { x: x2, y: y1 }),
    line({ x: x1, y: y1 + thickness }, { x: x2, y: y1 + thickness }),
    line({ x: x1, y: y2 }, { x: x2, y: y2 }),
    line({ x: x1, y: y2 - thickness }, { x: x2, y: y2 - thickness }),
    line({ x: x1, y: y1 }, { x: x1, y: y2 }),
    line({ x: x1 + thickness, y: y1 }, { x: x1 + thickness, y: y2 }),
    line({ x: x2, y: y1 }, { x: x2, y: y2 }),
    line({ x: x2 - thickness, y: y1 }, { x: x2 - thickness, y: y2 }),
  ];
}

function detect(segments) {
  return detectExteriorWallsFromGeometry({
    planGeometryIndex: { source: "fixture", segments, rawSegments: segments },
    page: { sourceWidth: 620, sourceHeight: 460, calibration: { mmPerDocumentUnit: 20 } },
    stitchToleranceDocUnits: 6,
  });
}

function rangesOverlap(a1, a2, b1, b2) {
  return Math.max(0, Math.min(Math.max(a1, a2), Math.max(b1, b2)) - Math.max(Math.min(a1, a2), Math.min(b1, b2)));
}

function boundaryUsesStroke(points, stroke, tolerance = 2) {
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    if (Math.abs(stroke.a.y - stroke.b.y) <= tolerance && Math.abs(a.y - b.y) <= tolerance) {
      if (Math.abs(a.y - stroke.a.y) <= tolerance && rangesOverlap(a.x, b.x, stroke.a.x, stroke.b.x) > tolerance) return true;
    }
    if (Math.abs(stroke.a.x - stroke.b.x) <= tolerance && Math.abs(a.x - b.x) <= tolerance) {
      if (Math.abs(a.x - stroke.a.x) <= tolerance && rangesOverlap(a.y, b.y, stroke.a.y, stroke.b.y) > tolerance) return true;
    }
  }
  return false;
}

{
  const stairTreads = [];
  const segments = [
    ...rectWallBands(100, 100, 420, 320),
    ...rectWallBands(420, 180, 540, 320),
    line({ x: 145, y: 130 }, { x: 145, y: 285 }),
    line({ x: 153, y: 130 }, { x: 153, y: 285 }),
    line({ x: 120, y: 70 }, { x: 540, y: 70 }, { isDimension: true }),
    line({ x: 30, y: 30 }, { x: 580, y: 30 }, { classification: "title-block-rule" }),
    line({ x: 470, y: 205 }, { x: 520, y: 205 }, { classification: "cabinetry" }),
    line({ x: 470, y: 215 }, { x: 520, y: 215 }, { classification: "cabinetry" }),
    line({ x: 250, y: 150 }, { x: 278, y: 178 }, { classification: "door-arc" }),
  ];
  for (let y = 150; y <= 230; y += 10) {
    const tread = line({ x: 210, y }, { x: 270, y }, { classification: "stair-tread" });
    stairTreads.push(tread);
    segments.push(tread);
  }
  const result = detect(segments);
  assert.equal(result.isClosed, true, "main building plus garage should produce one closed outer boundary");
  assert.equal(result.exteriorPerimeter.gapCount, 0);
  assert.equal(result.exteriorPerimeter.selfIntersectionCount, 0);
  assert.ok(result.exteriorPerimeter.wallSupportRatio >= 0.7);
  assert.equal(result.diagnostics.source, "manual-trace-graph");
  assert.ok(result.diagnostics.manualTraceProof.every((item) => item.manualTraceable), "auto boundary must reuse trace-snap geometry");

  const boundaryPoints = result.exteriorPerimeter.points;
  assert.equal(stairTreads.some((tread) => boundaryUsesStroke(boundaryPoints, tread)), false, "stair treads must not appear in the exterior boundary");

  const index = { source: "fixture", rawSegments: segments };
  assert.equal(findHighlightableWallAtPoint({ point: { x: 240, y: 190 }, planGeometryIndex: index, page: { sourceWidth: 620, sourceHeight: 460 } }).wall, null, "stair tread hover must not become a wall band");
  assert.equal(findHighlightableWallAtPoint({ point: { x: 495, y: 210 }, planGeometryIndex: index, page: { sourceWidth: 620, sourceHeight: 460 } }).wall, null, "cabinet line hover must not become exterior");
  assert.equal(findHighlightableWallAtPoint({ point: { x: 260, y: 164 }, planGeometryIndex: index, page: { sourceWidth: 620, sourceHeight: 460 } }).wall, null, "door swing must not become exterior");
}

{
  const unsupported = [
    line({ x: 100, y: 100 }, { x: 420, y: 100 }),
    line({ x: 100, y: 108 }, { x: 420, y: 108 }),
    line({ x: 100, y: 320 }, { x: 420, y: 320 }),
    line({ x: 100, y: 312 }, { x: 420, y: 312 }),
  ];
  const result = detect(unsupported);
  assert.equal(result?.isClosed || false, false, "parallel isolated strokes must not bridge into a fake perimeter");
  assert.equal(result?.segments?.length || 0, 0);
}

console.log("exteriorRegionBoundary.test.mjs passed");
