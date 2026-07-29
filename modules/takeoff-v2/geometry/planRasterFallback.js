// Raster fallback line detection — used only when vector extraction (the
// preferred source; see planVectorExtraction.js) finds too few usable
// segments, i.e. a scanned/rasterized PDF with no real vector content.
//
// Scope decision (stated plainly, not hidden): this is a simplified
// axis-aligned dark-run scanner (grayscale + long continuous dark runs per
// row/column), not a full Hough transform. Genuine Hough-line detection for
// arbitrary angles is a separate, much larger computer-vision project: this
// repo has never had one (confirmed in the prior investigation), and since
// raster is explicitly the last-priority fallback — most CAD-exported plans
// are vector — a proportionate axis-aligned detector covers the practical
// case (finding wall/dimension lines in a scanned plan) without pretending
// to be more than it is.

const DEFAULT_MIN_RUN_PX = 40;
const DEFAULT_DARKNESS_THRESHOLD = 128;
const DEFAULT_ROW_STEP = 2;

function luminanceAt(data, width, x, y) {
  const idx = (y * width + x) * 4;
  return 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
}

// Pure, unit-testable core: operates on a plain RGBA byte array (as returned
// by CanvasRenderingContext2D.getImageData(...).data), independent of any
// browser/canvas API, so it can be exercised with a synthetic fixture.
export function scanDarkRunsFromImageData(
  { data, width, height },
  { minRunPx = DEFAULT_MIN_RUN_PX, darknessThreshold = DEFAULT_DARKNESS_THRESHOLD, rowStep = DEFAULT_ROW_STEP } = {}
) {
  const segments = [];
  let seq = 0;

  for (let y = 0; y < height; y += rowStep) {
    let runStart = null;
    for (let x = 0; x < width; x += 1) {
      const dark = luminanceAt(data, width, x, y) < darknessThreshold;
      if (dark && runStart === null) runStart = x;
      if (!dark && runStart !== null) {
        if (x - runStart >= minRunPx) {
          seq += 1;
          segments.push({ id: `raster-h-${seq}`, a: { x: runStart, y }, b: { x: x - 1, y }, axis: "horizontal", source: "raster" });
        }
        runStart = null;
      }
    }
    if (runStart !== null && width - runStart >= minRunPx) {
      seq += 1;
      segments.push({ id: `raster-h-${seq}`, a: { x: runStart, y }, b: { x: width - 1, y }, axis: "horizontal", source: "raster" });
    }
  }

  for (let x = 0; x < width; x += rowStep) {
    let runStart = null;
    for (let y = 0; y < height; y += 1) {
      const dark = luminanceAt(data, width, x, y) < darknessThreshold;
      if (dark && runStart === null) runStart = y;
      if (!dark && runStart !== null) {
        if (y - runStart >= minRunPx) {
          seq += 1;
          segments.push({ id: `raster-v-${seq}`, a: { x, y: runStart }, b: { x, y: y - 1 }, axis: "vertical", source: "raster" });
        }
        runStart = null;
      }
    }
    if (runStart !== null && height - runStart >= minRunPx) {
      seq += 1;
      segments.push({ id: `raster-v-${seq}`, a: { x, y: runStart }, b: { x, y: height - 1 }, axis: "vertical", source: "raster" });
    }
  }

  return segments.map((seg) => ({ ...seg, length: Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y) }));
}

// Browser wrapper: rasterizes from an already-rendered plan canvas, converts
// the pixel-space runs back into base document coordinates via the same
// pdf.js viewport used to render it (so results land in the same coordinate
// space as vector extraction).
export function extractRasterSegments({ canvas, viewport, ...options }) {
  const context = canvas.getContext("2d");
  const { width, height } = canvas;
  const imageData = context.getImageData(0, 0, width, height);
  const pixelSegments = scanDarkRunsFromImageData({ data: imageData.data, width, height }, options);
  return pixelSegments.map((seg) => {
    const [ax, ay] = viewport.convertToPdfPoint(seg.a.x, seg.a.y);
    const [bx, by] = viewport.convertToPdfPoint(seg.b.x, seg.b.y);
    const a = { x: ax, y: ay };
    const b = { x: bx, y: by };
    return { ...seg, a, b, length: Math.hypot(b.x - a.x, b.y - a.y) };
  });
}
