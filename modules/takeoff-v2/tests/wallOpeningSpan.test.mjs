import assert from "node:assert/strict";
import { buildWallBandSegmentMetadata, detectManualWallBandForSegment } from "../takeoff/manualWallBand.js";
import { classifyOpeningWidthMm, detectOpeningSpan, findJambsAt, projectRawSegmentToGuide } from "../takeoff/wallOpeningSpan.js";

let lineSeq = 0;
function line(a, b, extra = {}) {
  lineSeq += 1;
  return {
    id: `line-${lineSeq}`,
    source: "vector",
    stroked: true,
    strokeColor: "#000000",
    a,
    b,
    length: Math.hypot(b.x - a.x, b.y - a.y),
    ...extra,
  };
}

// 10 mm per document unit throughout, so a 240 mm brick veneer exterior wall
// is 24 document units thick and a 2600 mm garage door is 260 units wide.
const page = { sourceWidth: 900, sourceHeight: 600, calibration: { mmPerDocumentUnit: 10 } };
const OUTER_Y = 100;
const INNER_Y = 124;

// A front elevation wall running left to right with a hole in it:
//   solid  x=60..200 | OPENING x=200..gapEnd | solid gapEnd..760
// Jamb returns close off the wall material at each side of the opening.
function frontWallWithGap(gapStart, gapEnd) {
  return [
    line({ x: 60, y: OUTER_Y }, { x: gapStart, y: OUTER_Y }),
    line({ x: 60, y: INNER_Y }, { x: gapStart, y: INNER_Y }),
    line({ x: gapEnd, y: OUTER_Y }, { x: 760, y: OUTER_Y }),
    line({ x: gapEnd, y: INNER_Y }, { x: 760, y: INNER_Y }),
    // jamb returns (perpendicular, spanning the wall thickness)
    line({ x: gapStart, y: OUTER_Y }, { x: gapStart, y: INNER_Y }),
    line({ x: gapEnd, y: OUTER_Y }, { x: gapEnd, y: INNER_Y }),
  ];
}

// ---- opening width is classified ALONG the wall, never by thickness -------
{
  assert.equal(classifyOpeningWidthMm(900, { hasStartJamb: true, hasEndJamb: true }).type, "door");
  assert.equal(classifyOpeningWidthMm(2600, { hasStartJamb: true, hasEndJamb: true }).type, "garage_door");
  assert.equal(classifyOpeningWidthMm(4800, { hasStartJamb: true, hasEndJamb: true }).type, "garage_door");
  // Genuinely ambiguous widths continue the chain as a candidate rather than
  // rejecting it.
  assert.equal(classifyOpeningWidthMm(1650, { hasStartJamb: true, hasEndJamb: true }).type, "opening_candidate");
  // Beyond a real opening this is two different walls, not one run.
  assert.equal(classifyOpeningWidthMm(9000, { hasStartJamb: true, hasEndJamb: true }), null);
}

// ---- jamb evidence is found perpendicular to the wall direction -----------
{
  const guide = { ux: 1, uy: 0, nx: 0, ny: 1, angle: 0 };
  const rawGuideLines = frontWallWithGap(200, 460)
    .map((segment) => projectRawSegmentToGuide(segment, guide))
    .filter(Boolean);
  assert.ok(findJambsAt(rawGuideLines, { along: 200, faceLowFixed: OUTER_Y, faceHighFixed: INNER_Y }).length > 0, "jamb A must be found");
  assert.ok(findJambsAt(rawGuideLines, { along: 460, faceLowFixed: OUTER_Y, faceHighFixed: INNER_Y }).length > 0, "jamb B must be found");
  assert.equal(findJambsAt(rawGuideLines, { along: 330, faceLowFixed: OUTER_Y, faceHighFixed: INNER_Y }).length, 0, "mid-opening has no jamb");
}

// ---- TEST A: garage door jamb-to-jamb is one continuous exterior run ------
{
  const planGeometryIndex = { source: "fixture", rawSegments: frontWallWithGap(200, 460) };
  const span = detectOpeningSpan({
    guideLines: frontWallWithGap(200, 460)
      .map((segment) => projectRawSegmentToGuide(segment, { ux: 1, uy: 0, nx: 0, ny: 1, angle: 0 }))
      .filter((entry) => entry.angleDiffFromGuide < 5),
    rawGuideLines: frontWallWithGap(200, 460)
      .map((segment) => projectRawSegmentToGuide(segment, { ux: 1, uy: 0, nx: 0, ny: 1, angle: 0 })),
    spanStart: 200,
    spanEnd: 460,
    thicknessRange: { min: 20, max: 30, target: 24 },
    mmPerDocumentUnit: 10,
  });
  assert.ok(span, "garage span between two jambs must be recognised");
  assert.equal(span.type, "garage_door");
  assert.equal(Math.round(span.widthMm), 2600);
  assert.equal(Math.round(span.thicknessDocUnits), 24);

  // The user clicks jamb A then jamb B: the band must resolve, not fail.
  const band = detectManualWallBandForSegment(
    { x: 200, y: 112 },
    { x: 460, y: 112 },
    { planGeometryIndex, page, wallType: "exterior" },
  );
  assert.equal(band.geometryStatus, "resolved", "garage jamb-to-jamb span must resolve as exterior topology");
  assert.equal(band.openingSpan?.type, "garage_door");
  assert.equal(Math.round(band.thicknessMm), 240, "thickness stays perpendicular, unaffected by the 2600 mm width");

  const metadata = buildWallBandSegmentMetadata(
    { x: 200, y: 112 },
    { x: 460, y: 112 },
    { page, field: "exteriorWalls", wallType: "exterior", planGeometryIndex },
  );
  assert.equal(metadata.geometryStatus, "resolved");
  assert.equal(metadata.detectedOpenings.length, 1);
  assert.equal(metadata.detectedOpenings[0].type, "garage_door");
  // No green wall material across the opening: it spans the whole segment.
  assert.equal(metadata.detectedOpenings[0].startOffset, 0);
  assert.equal(metadata.detectedOpenings[0].endOffset, 1);
}

// ---- TEST B: front entry door jamb-to-jamb bridges the same way -----------
{
  const planGeometryIndex = { source: "fixture", rawSegments: frontWallWithGap(300, 390) };
  const band = detectManualWallBandForSegment(
    { x: 300, y: 112 },
    { x: 390, y: 112 },
    { planGeometryIndex, page, wallType: "exterior" },
  );
  assert.equal(band.geometryStatus, "resolved", "front door span must not break the exterior chain");
  assert.equal(band.openingSpan?.type, "door");
  assert.equal(Math.round(band.openingSpan.widthMm), 900);
}

// ---- solid wall -> opening -> solid wall inside one traced segment --------
{
  const planGeometryIndex = { source: "fixture", rawSegments: frontWallWithGap(300, 390) };
  const metadata = buildWallBandSegmentMetadata(
    { x: 150, y: 112 },
    { x: 600, y: 112 },
    { page, field: "exteriorWalls", wallType: "exterior", planGeometryIndex },
  );
  assert.equal(metadata.geometryStatus, "resolved", "a run containing a door must still resolve");
  assert.equal(metadata.detectedOpenings.length, 1, "the door gap is recorded as an opening");
  assert.equal(metadata.detectedOpenings[0].type, "door");
  // Green wall material either side, none across the opening.
  assert.ok(metadata.detectedOpenings[0].startOffset > 0.2 && metadata.detectedOpenings[0].startOffset < 0.4);
  assert.ok(metadata.detectedOpenings[0].endOffset > 0.4 && metadata.detectedOpenings[0].endOffset < 0.6);
}

// ---- TEST D: an unbroken wall resolves exactly as before ------------------
{
  const solid = [
    line({ x: 60, y: OUTER_Y }, { x: 760, y: OUTER_Y }),
    line({ x: 60, y: INNER_Y }, { x: 760, y: INNER_Y }),
  ];
  const planGeometryIndex = { source: "fixture", rawSegments: solid };
  const metadata = buildWallBandSegmentMetadata(
    { x: 150, y: 112 },
    { x: 600, y: 112 },
    { page, field: "exteriorWalls", wallType: "exterior", planGeometryIndex },
  );
  assert.equal(metadata.geometryStatus, "resolved");
  assert.equal(Math.round(metadata.thicknessMm), 240);
  assert.equal(metadata.detectedOpenings.length, 0, "a solid wall must gain no openings");
  assert.equal(metadata.openingSpan, null);
}

// ---- the same wall works at real sheet scale, not just the fixture scale --
{
  // 1:100 on A3: a PDF point is 25.4/72 mm on paper, so 240 mm of wall is
  // only ~6.8 document units, not the 24 units the fixtures above use.
  const mmPerUnit = (25.4 / 72) * 100;
  const scaledPage = { sourceWidth: 900, sourceHeight: 600, calibration: { mmPerDocumentUnit: mmPerUnit } };
  const thickness = 240 / mmPerUnit;          // ~6.8 units
  const gapStart = 200;
  const gapEnd = gapStart + 2600 / mmPerUnit; // 2600 mm garage door
  const outerY = 100;
  const innerY = outerY + thickness;
  const segments = [
    line({ x: 60, y: outerY }, { x: gapStart, y: outerY }),
    line({ x: 60, y: innerY }, { x: gapStart, y: innerY }),
    line({ x: gapEnd, y: outerY }, { x: 400, y: outerY }),
    line({ x: gapEnd, y: innerY }, { x: 400, y: innerY }),
    line({ x: gapStart, y: outerY }, { x: gapStart, y: innerY }),
    line({ x: gapEnd, y: outerY }, { x: gapEnd, y: innerY }),
  ];
  const band = detectManualWallBandForSegment(
    { x: gapStart, y: outerY + thickness / 2 },
    { x: gapEnd, y: outerY + thickness / 2 },
    { planGeometryIndex: { source: "fixture", rawSegments: segments }, page: scaledPage, wallType: "exterior" },
  );
  assert.equal(band.geometryStatus, "resolved", "garage span must resolve at 1:100 sheet scale too");
  assert.equal(band.openingSpan?.type, "garage_door");
  assert.equal(Math.round(band.thicknessMm), 240);
}

// ---- a real break between two different walls is still a break ------------
{
  // 9 m of nothing is not an opening — it is two separate walls.
  const wide = [
    line({ x: 60, y: OUTER_Y }, { x: 200, y: OUTER_Y }),
    line({ x: 60, y: INNER_Y }, { x: 200, y: INNER_Y }),
    line({ x: 1100, y: OUTER_Y }, { x: 1400, y: OUTER_Y }),
    line({ x: 1100, y: INNER_Y }, { x: 1400, y: INNER_Y }),
    line({ x: 200, y: OUTER_Y }, { x: 200, y: INNER_Y }),
    line({ x: 1100, y: OUTER_Y }, { x: 1100, y: INNER_Y }),
  ];
  const planGeometryIndex = { source: "fixture", rawSegments: wide };
  const band = detectManualWallBandForSegment(
    { x: 200, y: 112 },
    { x: 1100, y: 112 },
    { planGeometryIndex, page, wallType: "exterior" },
  );
  assert.equal(band.geometryStatus, "unresolved", "an over-wide gap must not be bridged as an opening");
}

console.log("wallOpeningSpan tests passed");
