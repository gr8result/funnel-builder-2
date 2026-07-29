import assert from "node:assert/strict";
import { extractVectorSegmentsFromOperatorList, multiplyMatrix, transformPoint } from "../geometry/planVectorExtraction.js";

// Numeric values match this repo's actual pinned pdfjs-dist (6.1.200), dumped
// empirically from a real pdf-lib-generated fixture — see planVectorExtraction.js's
// header comment for how/why.
const OPS = { save: 10, restore: 11, transform: 12, constructPath: 91 };

// ---- matrix helpers ---------------------------------------------------
{
  const translate = [1, 0, 0, 1, 20, 20];
  const identity = [1, 0, 0, 1, 0, 0];
  const combined = multiplyMatrix(translate, multiplyMatrix(identity, identity));
  assert.deepEqual(transformPoint(combined, 0, 0), { x: 20, y: 20 });
  assert.deepEqual(transformPoint(combined, 572, 752), { x: 592, y: 772 });
}

// ---- a real drawn line (verbatim operator-list shape, incl. the duplicate
//      moveTo pdf-lib actually emits) ------------------------------------
{
  const fnArray = [OPS.save, OPS.constructPath, OPS.restore];
  const argsArray = [
    null,
    [20, [[0, 100, 650, 0, 100, 650, 1, 400, 650]], [100, 650, 400, 650]],
    null,
  ];
  const segments = extractVectorSegmentsFromOperatorList({ fnArray, argsArray, OPS });
  // The duplicate moveTo(100,650)->moveTo(100,650) produces a zero-length
  // candidate that the min-length filter drops on its own.
  assert.equal(segments.length, 1);
  assert.deepEqual(segments[0].a, { x: 100, y: 650 });
  assert.deepEqual(segments[0].b, { x: 400, y: 650 });
  assert.equal(segments[0].axis, "horizontal");
  assert.equal(segments[0].length, 300);
  assert.equal(segments[0].source, "vector");
}

// ---- a real drawn rectangle under nested save/transform/transform/transform,
//      including the implicit closePath edge -----------------------------
{
  const fnArray = [OPS.save, OPS.transform, OPS.transform, OPS.transform, OPS.constructPath, OPS.restore];
  const argsArray = [
    null,
    [1, 0, 0, 1, 20, 20],
    [1, 0, 0, 1, 0, 0],
    [1, 0, 0, 1, 0, 0],
    [20, [[0, 0, 0, 1, 0, 752, 1, 572, 752, 1, 572, 0, 4]], [0, 0, 572, 752]],
    null,
  ];
  const segments = extractVectorSegmentsFromOperatorList({ fnArray, argsArray, OPS });
  assert.equal(segments.length, 4);
  const points = segments.map((s) => [s.a, s.b]);
  assert.deepEqual(points[0], [{ x: 20, y: 20 }, { x: 20, y: 772 }]);
  assert.deepEqual(points[1], [{ x: 20, y: 772 }, { x: 592, y: 772 }]);
  assert.deepEqual(points[2], [{ x: 592, y: 772 }, { x: 592, y: 20 }]);
  assert.deepEqual(points[3], [{ x: 592, y: 20 }, { x: 20, y: 20 }]); // implicit closePath edge
  assert.equal(segments[0].axis, "vertical");
  assert.equal(segments[1].axis, "horizontal");
}

// ---- restore pops back to the outer CTM, not identity --------------------
{
  const fnArray = [OPS.save, OPS.transform, OPS.save, OPS.transform, OPS.restore, OPS.constructPath, OPS.restore];
  const argsArray = [
    null,
    [1, 0, 0, 1, 100, 0], // outer: translate x+100
    null,
    [1, 0, 0, 1, 0, 100], // inner: translate y+100 (popped before the path is drawn)
    null,
    [20, [[0, 0, 0, 1, 10, 0]], [0, 0, 10, 0]],
    null,
  ];
  const segments = extractVectorSegmentsFromOperatorList({ fnArray, argsArray, OPS });
  assert.equal(segments.length, 1);
  // Only the outer translate should apply — the inner one was popped by restore.
  assert.deepEqual(segments[0].a, { x: 100, y: 0 });
  assert.deepEqual(segments[0].b, { x: 110, y: 0 });
}

// ---- an unsupported op (e.g. a curve) inside a subpath stops that subpath
//      instead of misparsing subsequent numbers as coordinates ------------
{
  const fnArray = [OPS.constructPath];
  const argsArray = [
    [20, [[0, 0, 0, 1, 50, 0, 99, 1, 2, 3, 4, 5, 6]], [0, 0, 50, 0]], // 99 = unknown/curve marker
  ];
  const segments = extractVectorSegmentsFromOperatorList({ fnArray, argsArray, OPS });
  assert.equal(segments.length, 1);
  assert.deepEqual(segments[0].a, { x: 0, y: 0 });
  assert.deepEqual(segments[0].b, { x: 50, y: 0 });
}

// ---- min-length filtering drops tiny decorative marks ---------------------
{
  const fnArray = [OPS.constructPath];
  const argsArray = [[20, [[0, 0, 0, 1, 1, 1]], [0, 0, 1, 1]]]; // ~1.4pt diagonal tick mark
  const segments = extractVectorSegmentsFromOperatorList({ fnArray, argsArray, OPS }, { minLengthDocUnits: 4 });
  assert.equal(segments.length, 0);
}

// ---- page-border filtering drops a full-span frame edge, but not an
//      interior wall that merely touches one edge -------------------------
{
  const fnArray = [OPS.constructPath, OPS.constructPath];
  const argsArray = [
    [20, [[0, 0, 0, 1, 612, 0]], [0, 0, 612, 0]], // spans the entire bottom border
    [20, [[0, 300, 0, 1, 300, 50]], [300, 0, 300, 50]], // touches bottom edge once, interior otherwise
  ];
  const segments = extractVectorSegmentsFromOperatorList(
    { fnArray, argsArray, OPS },
    { pageWidth: 612, pageHeight: 792, minLengthDocUnits: 4 }
  );
  assert.equal(segments.length, 1);
  assert.deepEqual(segments[0].a, { x: 300, y: 0 });
  assert.deepEqual(segments[0].b, { x: 300, y: 50 });
  assert.equal(segments[0].axis, "vertical");
}

// ---- border filtering must not discard a segment whose two endpoints are
//      each near a *different* edge (e.g. a real interior wall running from
//      near the top margin down to near the bottom margin) — only a segment
//      that runs ALONG one shared edge should be treated as a page border ---
{
  const fnArray = [OPS.constructPath];
  // A vertical run from (20,20) to (20,772) on a 612x792 page (matching the
  // real fixture's inset rectangle edge): y=20 is within a 3% margin of
  // y=0, and y=772 is within a 3% margin of y=792 — but this segment does
  // NOT run along the x=0/x=612/y=0/y=792 border itself (it's the vertical
  // edge of an inset rectangle), so it must survive.
  const argsArray = [[20, [[0, 20, 20, 1, 20, 772]], [20, 20, 20, 772]]];
  const segments = extractVectorSegmentsFromOperatorList(
    { fnArray, argsArray, OPS },
    { pageWidth: 612, pageHeight: 792, minLengthDocUnits: 4 }
  );
  assert.equal(segments.length, 1, "a segment near different edges at each endpoint must not be filtered");
  assert.equal(segments[0].axis, "vertical");
}

console.log("planVectorExtraction.test.mjs passed");
