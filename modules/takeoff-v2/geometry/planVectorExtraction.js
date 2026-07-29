// Extracts straight-line vector segments from a PDF page's real drawing
// operators (pdf.js's operator list), in base document coordinates (the same
// unrotated PDF-point space PlanPage geometry is always stored in).
//
// This is priority #1/#2 from the plan-geometry spec ("PDF vector drawing
// operators" / "PDF.js operator list and path geometry") — used instead of
// raster/image analysis whenever the PDF actually has vector content, which
// covers essentially all CAD-exported architectural plans.
//
// The `OPS.constructPath` packed sub-op encoding (the numeric codes 0/1/4
// below for moveTo/lineTo/closePath *inside* a constructPath call) is not
// part of pdfjs-dist's public API — it was verified empirically against this
// repo's pinned pdfjs-dist version (6.1.200) by dumping the operator list for
// a known vector line + rectangle (see plan notes). If a future pdfjs-dist
// upgrade changes this encoding, `LOCAL_PATH_OP.LINE_TO` etc. simply won't
// match and extraction safely yields fewer/no segments (caught by the
// try/catch in extractVectorSegments and the low-segment-count fallback in
// planGeometryService.js) rather than corrupting coordinates.
const LOCAL_PATH_OP = { MOVE_TO: 0, LINE_TO: 1, CLOSE_PATH: 4 };

const IDENTITY_MATRIX = [1, 0, 0, 1, 0, 0];

// Standard PDF matrix concatenation: transformPoint(multiplyMatrix(m1, m2), p)
// === transformPoint(m2, transformPoint(m1, p)) — i.e. "apply m1, then m2".
export function multiplyMatrix(m1, m2) {
  const [a1, b1, c1, d1, e1, f1] = m1;
  const [a2, b2, c2, d2, e2, f2] = m2;
  return [
    a1 * a2 + b1 * c2,
    a1 * b2 + b1 * d2,
    c1 * a2 + d1 * c2,
    c1 * b2 + d1 * d2,
    e1 * a2 + f1 * c2 + e2,
    e1 * b2 + f1 * d2 + f2,
  ];
}

export function transformPoint(matrix, x, y) {
  const [a, b, c, d, e, f] = matrix;
  return { x: a * x + c * y + e, y: b * x + d * y + f };
}

const DEFAULT_MIN_LENGTH_DOC_UNITS = 4;
const DEFAULT_BORDER_MARGIN_RATIO = 0.03;
const AXIS_EPSILON_DEGREES = 0.5;

function classifyAxis(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const angle = ((Math.atan2(dy, dx) * 180) / Math.PI + 180) % 180; // [0,180)
  if (angle <= AXIS_EPSILON_DEGREES || angle >= 180 - AXIS_EPSILON_DEGREES) return "horizontal";
  if (Math.abs(angle - 90) <= AXIS_EPSILON_DEGREES) return "vertical";
  return "diagonal";
}

// A segment is "near the page border" only when BOTH endpoints are close to
// the *same* edge (i.e. it runs along that edge) — not merely when each
// endpoint happens to be close to *some* edge independently. The latter
// would wrongly discard a perfectly ordinary interior wall that starts near
// the top margin and ends near the bottom margin, for example.
function isNearPageBorder(a, b, pageWidth, pageHeight, marginRatio) {
  if (!pageWidth || !pageHeight) return false;
  const marginX = pageWidth * marginRatio;
  const marginY = pageHeight * marginRatio;
  const bothNear = (test) => test(a) && test(b);
  return (
    bothNear((p) => Math.abs(p.x - 0) <= marginX) ||
    bothNear((p) => Math.abs(p.x - pageWidth) <= marginX) ||
    bothNear((p) => Math.abs(p.y - 0) <= marginY) ||
    bothNear((p) => Math.abs(p.y - pageHeight) <= marginY)
  );
}

function extractSubpathSegments(packed, ctm, out) {
  if (!packed || typeof packed.length !== "number") return;
  let index = 0;
  let current = null;
  let subpathStart = null;
  while (index < packed.length) {
    const opCode = packed[index];
    if (opCode === LOCAL_PATH_OP.MOVE_TO) {
      current = transformPoint(ctm, packed[index + 1], packed[index + 2]);
      subpathStart = current;
      index += 3;
    } else if (opCode === LOCAL_PATH_OP.LINE_TO) {
      const next = transformPoint(ctm, packed[index + 1], packed[index + 2]);
      if (current) out.push({ a: current, b: next });
      current = next;
      index += 3;
    } else if (opCode === LOCAL_PATH_OP.CLOSE_PATH) {
      if (current && subpathStart && (current.x !== subpathStart.x || current.y !== subpathStart.y)) {
        out.push({ a: current, b: subpathStart });
      }
      current = subpathStart;
      index += 1;
    } else {
      // Unsupported op inside this subpath (e.g. a bezier curve) — stop
      // walking it rather than guess an arg count and misalign parsing.
      break;
    }
  }
}

// Pure, unit-testable core: given the raw {fnArray, argsArray} from
// page.getOperatorList() and the pdfjs-dist OPS enum, walks the CTM stack and
// returns classified/filtered straight-line segments in base coordinates.
export function extractVectorSegmentsFromOperatorList(
  { fnArray, argsArray, OPS },
  { pageWidth = 0, pageHeight = 0, minLengthDocUnits = DEFAULT_MIN_LENGTH_DOC_UNITS, borderMarginRatio = DEFAULT_BORDER_MARGIN_RATIO } = {}
) {
  const ctmStack = [];
  let ctm = IDENTITY_MATRIX;
  const rawSegments = [];

  for (let i = 0; i < fnArray.length; i += 1) {
    const fn = fnArray[i];
    const args = argsArray[i];
    if (fn === OPS.save) {
      ctmStack.push(ctm);
    } else if (fn === OPS.restore) {
      ctm = ctmStack.pop() || IDENTITY_MATRIX;
    } else if (fn === OPS.transform) {
      ctm = multiplyMatrix(args, ctm);
    } else if (fn === OPS.constructPath) {
      const subpaths = args?.[1];
      if (Array.isArray(subpaths)) {
        subpaths.forEach((packed) => extractSubpathSegments(packed, ctm, rawSegments));
      }
    }
  }

  let seq = 0;
  const segments = [];
  for (const { a, b } of rawSegments) {
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length < minLengthDocUnits) continue;
    if (isNearPageBorder(a, b, pageWidth, pageHeight, borderMarginRatio)) continue;
    seq += 1;
    segments.push({ id: `vec-${seq}`, a, b, length, axis: classifyAxis(a, b), source: "vector" });
  }
  return segments;
}

// Real pdf.js wrapper — fetches the operator list for a page and runs it
// through the pure extractor above. Never throws: a decode mismatch or any
// unexpected operator-list shape yields an empty segment list, letting
// planGeometryService.js fall back to the raster detector.
export async function extractVectorSegments(pdfDocument, pageNumber, { pageWidth, pageHeight } = {}) {
  try {
    const { getOperatorListForPage } = await import("../viewer/PdfViewport.js");
    const { operatorList, OPS } = await getOperatorListForPage(pdfDocument, pageNumber);
    return extractVectorSegmentsFromOperatorList(
      { fnArray: operatorList.fnArray, argsArray: operatorList.argsArray, OPS },
      { pageWidth, pageHeight }
    );
  } catch {
    return [];
  }
}
