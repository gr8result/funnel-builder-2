import assert from "node:assert/strict";
import fs from "node:fs";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractVectorSegmentsFromOperatorList } from "../geometry/planVectorExtraction.js";
import { buildPlanGeometryIndex } from "../geometry/planGeometryIndex.js";
import { detectExteriorWallsFromGeometry } from "../takeoff/vectorExteriorDetection.js";

let lineSeq = 0;
function line(a, b, extra = {}) {
  lineSeq += 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return {
    id: `fixture-line-${lineSeq}`,
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

function rectWallBands({ x1, y1, x2, y2, thickness = 8 }) {
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

{
  const fixtureLines = [
    ...rectWallBands({ x1: 100, y1: 100, x2: 420, y2: 320 }),
    ...rectWallBands({ x1: 420, y1: 180, x2: 540, y2: 320 }), // connected garage projection
    line({ x: 245, y: 120 }, { x: 245, y: 300 }),
    line({ x: 253, y: 120 }, { x: 253, y: 300 }), // internal wall band
    line({ x: 80, y: 70 }, { x: 560, y: 70 }), // dimension chain
    line({ x: 80, y: 75 }, { x: 560, y: 75 }),
    line({ x: 20, y: 20 }, { x: 580, y: 20 }), // page/title zone
    line({ x: 20, y: 30 }, { x: 580, y: 30 }),
  ];
  const result = detectExteriorWallsFromGeometry({
    planGeometryIndex: { source: "fixture", segments: fixtureLines },
    page: { sourceWidth: 620, sourceHeight: 460, calibration: { mmPerDocumentUnit: 20 } },
    stitchToleranceDocUnits: 6,
  });
  assert.equal(result.exteriorPerimeter.closed, true, "fixture should produce one ordered exterior polygon");
  assert.equal(result.exteriorPerimeter.gapCount, 0);
  assert.equal(result.exteriorPerimeter.selfIntersectionCount, 0);
  assert.equal(result.connectedComponents, 1);
  assert.ok(result.exteriorPerimeter.points.length <= 18, "collinear and tiny zigzag points should simplify");
  assert.ok(result.diagnostics.rejected["page-border"] >= 1 || result.diagnostics.rejected["outside-building-region"] >= 1, "page/title zone lines should be excluded");
}

{
  const invalid = [
    line({ x: 100, y: 100 }, { x: 300, y: 100 }),
    line({ x: 100, y: 160 }, { x: 300, y: 160 }),
    line({ x: 120, y: 230 }, { x: 280, y: 230 }),
    line({ x: 120, y: 310 }, { x: 280, y: 310 }),
    line({ x: 50, y: 50 }, { x: 50, y: 220 }),
    line({ x: 360, y: 80 }, { x: 360, y: 260 }),
    line({ x: 420, y: 100 }, { x: 420, y: 280 }),
    line({ x: 470, y: 110 }, { x: 470, y: 290 }),
  ];
  const result = detectExteriorWallsFromGeometry({
    planGeometryIndex: { source: "fixture", segments: invalid },
    page: { sourceWidth: 620, sourceHeight: 460, calibration: { mmPerDocumentUnit: 20 } },
    stitchToleranceDocUnits: 6,
  });
  assert.equal(result.isClosed, false, "invalid raw candidate set must not be marked closed");
  assert.equal(result.segments.length, 0, "invalid raw candidate set must not produce active exterior segments");
  assert.equal(result.exteriorPerimeter, null);
}

const localSamplePath = process.env.TAKEOFF_SAMPLE_PLANS_PDF || "C:/Users/grant/Downloads/SAMPLES PLANS W DIMS.pdf";

if (fs.existsSync(localSamplePath)) {
  const data = new Uint8Array(fs.readFileSync(localSamplePath));
  const pdf = await pdfjsLib.getDocument({ data, disableWorker: true }).promise;
  assert.equal(pdf.numPages, 4);

  const pageNumber = 1;
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1, rotation: 0 });
  const operatorList = await page.getOperatorList();
  const vectorSegments = extractVectorSegmentsFromOperatorList(
    { fnArray: operatorList.fnArray, argsArray: operatorList.argsArray, OPS: pdfjsLib.OPS },
    { pageWidth: viewport.width, pageHeight: viewport.height }
  );
  const index = { ...buildPlanGeometryIndex(vectorSegments), source: "vector", segmentCount: vectorSegments.length };
  const result = detectExteriorWallsFromGeometry({
    planGeometryIndex: index,
    page: {
      sourceWidth: viewport.width,
      sourceHeight: viewport.height,
      calibration: { mmPerDocumentUnit: 30 },
    },
    planRegion: null,
    stitchToleranceDocUnits: 6,
  });

  assert.ok(result, "expected a vector detection result");
  assert.equal(result.diagnostics.source, "vector");
  assert.ok(result.diagnostics.rawLines > 1000, "actual plan should expose substantial vector geometry");
  assert.ok(result.diagnostics.rejected["filled-path"] > 100, "filled/text-like paths should be excluded");
  assert.ok(result.diagnostics.wallPairs > 50, "wall-face pairing should find residential wall pairs");
  assert.equal(result.segments.length, result.exteriorPerimeter.points.length, "normal output should be polygon edges only");
  assert.ok(result.segments.length >= 8 && result.segments.length <= 20, "actual plan should simplify to one clean perimeter, not dozens of raw candidates");
  assert.ok(result.diagnostics.usedEnvelopePerimeter, "actual plan should assemble an exterior-envelope perimeter");
  assert.equal(result.isClosed, true, "assembled exterior-envelope perimeter should be closed");
  assert.equal(result.connectedComponents, 1, "assembled exterior perimeter should be one editable graph");
  assert.equal(result.openGaps, 0, "assembled exterior perimeter should not have dangling gaps");
  assert.equal(result.exteriorPerimeter.closed, true, "sample should produce a closed exterior perimeter object");
  assert.equal(result.exteriorPerimeter.gapCount, 0, "sample perimeter should have no gaps");
  assert.equal(result.exteriorPerimeter.selfIntersections, 0, "sample perimeter should not self-intersect");
  assert.ok(result.exteriorPerimeter.points.length >= 8, "sample exterior perimeter should be an ordered polygon");
  assert.equal(result.segments.filter((segment) => segment.confirmed).length, result.segments.length, "valid closed automatic perimeter should be active, not hidden as candidates");
} else {
  console.warn(`Skipping real SAMPLE PLANS.pdf vector detection test; copy it to ${localSamplePath} or set TAKEOFF_SAMPLE_PLANS_PDF.`);
}

console.log("exteriorVectorDetection.test.mjs passed");
