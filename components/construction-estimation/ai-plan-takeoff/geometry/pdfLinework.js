// PDF linework: the straight line segments a vector PDF page draws, in viewport coordinates.
//
// pdf.js 6 never emits path operators at the top level of an operator list. Every path is one
// `constructPath` operator whose arguments are [paint op, [Float32Array of draw codes], bounds],
// and the coordinates are in the user space of the current transformation matrix (CAD exports
// commonly draw at 1/8.333 scale inside nested `transform`s and form XObjects). Reading moveTo/lineTo
// at the top level, or ignoring the matrix, finds nothing or puts every line in the wrong place.
// Pure: takes an operator list, pdf.js's OPS table and the viewport transform; no DOM, no network.

// pdf.js DrawOPS (src/shared/util.js); stable since constructPath took a Float32Array.
const DRAW = { moveTo: 0, lineTo: 1, curveTo: 2, quadraticCurveTo: 3, closePath: 4 };
const IDENTITY = [1, 0, 0, 1, 0, 0];

const multiply = (m, n) => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
const apply = (m, x, y) => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] });

// Segments shorter than this (viewport units) are dropped: hatch dots and zero-length caps.
const MIN_SEGMENT = 0.05;

/**
 * @param {{fnArray: number[], argsArray: any[]}} operatorList  page.getOperatorList()
 * @param {Record<string, number>} OPS  pdfjsLib.OPS
 * @param {number[]} viewportTransform  viewport.transform (PDF user space -> viewport units)
 * @param {{curveSteps?: number}} options  curves are flattened into this many chords and flagged
 * @returns {{x1:number,y1:number,x2:number,y2:number,widthPx:number,paint:'stroke'|'fill',curve:boolean,path:number,subpath:number,color:string,dashed:boolean,layer:string|null}[]}
 *   `path` is the operator index of the path a segment belongs to and `subpath` a page-wide count of its
 *   moveTo, so a polyline (a door swing drawn as chords) can be read back as one figure. `color` is the
 *   stroke (or fill) colour as #rrggbb, `dashed` whether a dash pattern was in force, and `layer` the
 *   optional-content group the segment was drawn in (null outside any).
 */
export function extractPdfLinework(operatorList, OPS, viewportTransform = IDENTITY, { curveSteps = 6 } = {}) {
  const segments = [];
  const stack = [];
  let ctm = [...viewportTransform];
  let lineWidth = 1, strokeColor = '#000000', fillColor = '#000000', dashed = false;
  const layers = [];
  const hex = (args) => (typeof args?.[0] === 'string' ? args[0] : Array.isArray(args) || ArrayBuffer.isView(args)
    ? `#${Array.from(args).slice(0, 3).map((v) => Math.round(Number(v) || 0).toString(16).padStart(2, '0')).join('')}` : '#000000');
  const strokeOps = new Set([OPS.stroke, OPS.closeStroke, OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke, OPS.closeEOFillStroke].filter((op) => op !== undefined));
  const fillOps = new Set([OPS.fill, OPS.eoFill].filter((op) => op !== undefined));
  let pathIndex = -1, subpath = -1;
  const push = (a, b, paint, curve) => {
    if (Math.hypot(b.x - a.x, b.y - a.y) < MIN_SEGMENT) return;
    // A stroke's drawn width in viewport units: the line width scaled by the matrix (uniform scale assumed).
    const scale = Math.sqrt(Math.abs(ctm[0] * ctm[3] - ctm[1] * ctm[2])) || 1;
    segments.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, widthPx: Math.max(lineWidth, 0) * scale, paint, curve, path: pathIndex, subpath,
      color: paint === 'fill' ? fillColor : strokeColor, dashed, layer: layers.length ? layers[layers.length - 1] : null });
  };
  const { fnArray, argsArray } = operatorList;
  for (let i = 0; i < fnArray.length; i += 1) {
    const fn = fnArray[i];
    const args = argsArray[i];
    if (fn === OPS.save) stack.push({ ctm, lineWidth, strokeColor, fillColor, dashed });
    else if (fn === OPS.restore) { const state = stack.pop(); if (state) ({ ctm, lineWidth, strokeColor, fillColor, dashed } = state); }
    else if (fn === OPS.setStrokeRGBColor) strokeColor = hex(args);
    else if (fn === OPS.setFillRGBColor) fillColor = hex(args);
    else if (fn === OPS.setDash) dashed = Array.isArray(args?.[0]) ? args[0].some((value) => Number(value) > 0) : false;
    else if (fn === OPS.beginMarkedContentProps) layers.push(args?.[0] === 'OC' ? String(args?.[1]?.id ?? args?.[1] ?? 'oc') : (layers.length ? layers[layers.length - 1] : null));
    else if (fn === OPS.beginMarkedContent) layers.push(layers.length ? layers[layers.length - 1] : null);
    else if (fn === OPS.endMarkedContent) layers.pop();
    else if (fn === OPS.transform) ctm = multiply(ctm, args);
    else if (fn === OPS.setLineWidth) lineWidth = Number(args[0]) || 0;
    else if (fn === OPS.paintFormXObjectBegin) {
      stack.push({ ctm, lineWidth, strokeColor, fillColor, dashed });
      if (Array.isArray(args?.[0]) || ArrayBuffer.isView(args?.[0])) ctm = multiply(ctm, Array.from(args[0]));
    } else if (fn === OPS.paintFormXObjectEnd) { const state = stack.pop(); if (state) ({ ctm, lineWidth, strokeColor, fillColor, dashed } = state); }
    else if (fn === OPS.constructPath) {
      const paintOp = args[0];
      const paint = strokeOps.has(paintOp) ? 'stroke' : fillOps.has(paintOp) ? 'fill' : null;
      if (!paint) continue; // clipping paths and endPath draw nothing
      const data = Array.isArray(args[1]) ? args[1][0] : args[1];
      if (!data) continue;
      pathIndex = i;
      let current = null, start = null;
      for (let k = 0; k < data.length;) {
        const code = data[k];
        if (code === DRAW.moveTo) { current = apply(ctm, data[k + 1], data[k + 2]); start = current; subpath += 1; k += 3; }
        else if (code === DRAW.lineTo) { const next = apply(ctm, data[k + 1], data[k + 2]); if (current) push(current, next, paint, false); current = next; k += 3; }
        else if (code === DRAW.curveTo || code === DRAW.quadraticCurveTo) {
          const cubic = code === DRAW.curveTo;
          const raw = cubic ? [data[k + 1], data[k + 2], data[k + 3], data[k + 4], data[k + 5], data[k + 6]] : [data[k + 1], data[k + 2], data[k + 3], data[k + 4]];
          const end = cubic ? apply(ctm, raw[4], raw[5]) : apply(ctm, raw[2], raw[3]);
          if (current) {
            const p0 = current, c1 = apply(ctm, raw[0], raw[1]), c2 = cubic ? apply(ctm, raw[2], raw[3]) : null;
            let previous = p0;
            for (let s = 1; s <= curveSteps; s += 1) {
              const t = s / curveSteps, u = 1 - t;
              const point = cubic
                ? { x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * end.x, y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * end.y }
                : { x: u * u * p0.x + 2 * u * t * c1.x + t * t * end.x, y: u * u * p0.y + 2 * u * t * c1.y + t * t * end.y };
              push(previous, point, paint, true);
              previous = point;
            }
          }
          current = end; k += cubic ? 7 : 5;
        } else if (code === DRAW.closePath) { if (current && start) push(current, start, paint, false); current = start; k += 1; }
        else break; // unknown code: stop reading this path rather than misread the rest
      }
    }
  }
  return segments;
}

// Convenience for a pdf.js page: segments in the coordinates of `viewport` (logical plan pixels
// when viewport is page.getViewport({ scale: 1 })).
export async function readPdfPageLinework(page, viewport, OPS, options) {
  const operatorList = await page.getOperatorList();
  return extractPdfLinework(operatorList, OPS, viewport.transform, options);
}

export function compactPdfLinework(linework = []) {
  const round = (value) => Math.round(value * 100) / 100;
  return linework.filter((segment) => Math.hypot(segment.x2 - segment.x1, segment.y2 - segment.y1) >= 1)
    .map(({ x1, y1, x2, y2, widthPx, paint, color, dashed, layer, path, subpath, curve }) => ({
      x1: round(x1), y1: round(y1), x2: round(x2), y2: round(y2), path, subpath,
      widthPx: round(widthPx), paint, color, dashed,
      ...(layer ? { layer } : {}), ...(curve ? { curve: true } : {}),
    }));
}
