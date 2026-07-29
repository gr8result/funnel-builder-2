// Plan region: a user-adjustable rectangle (page-space, unrotated PDF
// points) marking the actual floor-plan drawing area, used to keep notes,
// title blocks, legends, floor-area tables and the sheet border out of
// automatic exterior-wall detection. Deliberately a manual/confirmable
// rectangle rather than an attempt to auto-classify "is this a legend or a
// wall" from geometry alone — this repo has no real vector/text
// classifier, and a wrong auto-classification would be worse than asking
// the user to confirm or drag a box once per plan.

export function pointInRegion(point, region) {
  if (!region) return true; // no region set yet — no filtering
  return (
    point.x >= region.x && point.x <= region.x + region.width &&
    point.y >= region.y && point.y <= region.y + region.height
  );
}

// A polyline/segment counts as "inside" the region when most of its points
// are — a wall that clips slightly across the region boundary shouldn't be
// discarded outright, but a legend table sitting entirely outside it should.
export function polylineWithinRegion(points, region, { minFractionInside = 0.6 } = {}) {
  if (!region || !Array.isArray(points) || points.length === 0) return true;
  const insideCount = points.filter((p) => pointInRegion(p, region)).length;
  return insideCount / points.length >= minFractionInside;
}

// A conservative starting guess before the user has ever set one: a fixed
// margin trimmed from the full page, which at least drops a page border /
// crop marks. Always source:"automatic" and unconfirmed — never treated as
// authoritative until the user accepts or adjusts it.
export function defaultPlanRegion(pageWidth, pageHeight, marginRatio = 0.04) {
  if (!(pageWidth > 0) || !(pageHeight > 0)) return null;
  const marginX = pageWidth * marginRatio;
  const marginY = pageHeight * marginRatio;
  return {
    x: marginX,
    y: marginY,
    width: pageWidth - marginX * 2,
    height: pageHeight - marginY * 2,
    confirmed: false,
    source: "automatic",
  };
}

export function normalizeRegionCorners(a, b) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const width = Math.abs(b.x - a.x);
  const height = Math.abs(b.y - a.y);
  return { x, y, width, height };
}
