// CEILING BATTENS (Quotation Builder, CEILING BATTENS section, first row - sourceRow 588 "METAL 6M").
//
// Ceiling battens fix to the underside of roof trusses, so the quantity comes from every level's
// ROOFED ceiling area - never total floor area, which would include intermediate floors that have
// another storey above them.
//
//   field battens LM     = roofed ceiling area / 0.45        (450mm centres)
//   perimeter battens LM = external perimeter of each continuous roofed zone
//   battens              = CEILING((field + perimeter) x 1.08 / 6.0)
//
// A 6.6m batten laps at its joins, so it covers 6.0m: the division is by 6.0, never 6.6. The 8% is
// applied to the lineal metres before they become battens, and the result always rounds UP.
//
// Sources, per level (Ground / Second / Third):
//   area       the level's canonical roof plan area (lower/upper/thirdRoofPlanAreaM2): the Takeoff's
//              Roof Area polygons, or Job Setup's own figure for the level with nothing above it.
//   perimeter  the outline of the Takeoff's Roof Area polygons on that level. Polygons that share
//              an edge form ONE zone, and the shared edge is not perimeter. Never derived from area.

export const CEILING_BATTEN_SPACING_M = 0.45;
export const CEILING_BATTEN_WASTE_FACTOR = 1.08;
export const CEILING_BATTEN_EFFECTIVE_COVERAGE_M = 6.0;
export const CEILING_BATTEN_QUANTITY_KEY = "ceilingBattenQty";
export const CEILING_BATTEN_FORMULA = "CEILING(((roofedCeilingArea/0.45)+roofedCeilingPerimeter)*1.08/6)";

export const ROOFED_CEILING_LEVELS = [
  { prefix: "lower", level: "Ground Floor", label: "Ground" },
  { prefix: "upper", level: "Second Level", label: "Upper" },
  { prefix: "third", level: "Third Level", label: "Third" },
];

const num = (value) => (Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : 0);
const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;
const fixed = (value) => round2(value).toFixed(2);
// Hand-drawn outlines snap to corners; two edges closer than this are the same edge.
const SHARED_EDGE_TOLERANCE_MM = 30;

function polygonAreaPx(nodes) {
  let area = 0;
  for (let i = 0; i < nodes.length; i += 1) {
    const next = nodes[(i + 1) % nodes.length];
    area += nodes[i].x * next.y - next.x * nodes[i].y;
  }
  return Math.abs(area / 2);
}

const edgesOf = (nodes) => nodes.map((node, index) => [node, nodes[(index + 1) % nodes.length]]);
const lengthPx = ([a, b]) => Math.hypot(b.x - a.x, b.y - a.y);

// Length two edges run along each other (0 when they are not collinear within tolerance).
function sharedLengthPx(first, second, tolerancePx) {
  const length = lengthPx(first);
  if (length <= tolerancePx || lengthPx(second) <= tolerancePx) return 0;
  const ux = (first[1].x - first[0].x) / length;
  const uy = (first[1].y - first[0].y) / length;
  const along = (point) => (point.x - first[0].x) * ux + (point.y - first[0].y) * uy;
  const off = (point) => Math.abs((point.x - first[0].x) * uy - (point.y - first[0].y) * ux);
  if (off(second[0]) > tolerancePx || off(second[1]) > tolerancePx) return 0;
  const start = Math.max(0, Math.min(along(second[0]), along(second[1])));
  const end = Math.min(length, Math.max(along(second[0]), along(second[1])));
  return end - start > tolerancePx ? end - start : 0;
}

function pointInside(point, nodes, tolerancePx) {
  let inside = false;
  for (const [a, b] of edgesOf(nodes)) {
    // On (or within tolerance of) the boundary is touching, not overlapping.
    const length = lengthPx([a, b]) || 1;
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / (length * length)));
    if (Math.hypot(point.x - (a.x + t * (b.x - a.x)), point.y - (a.y + t * (b.y - a.y))) <= tolerancePx) return false;
    if ((a.y > point.y) !== (b.y > point.y) && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

// The Takeoff's Roof Area polygons on one level: net area, the external perimeter of the combined
// zones, how many separate zones they form, and whether any two genuinely overlap.
export function roofAreaOutline(job = null, level = "") {
  const pixelsPerMm = Number(job?.pixelsPerMm);
  const polygons = (Array.isArray(job?.completedAreas) ? job.completedAreas : [])
    .filter((area) => area?.category === "Roof Area" && area.level === level && Array.isArray(area.nodes) && area.nodes.length >= 3);
  if (!polygons.length || !(pixelsPerMm > 0)) return { polygons: polygons.length, measured: false, areaM2: 0, perimeterLm: 0, zones: 0, overlapping: false };
  const tolerancePx = SHARED_EDGE_TOLERANCE_MM * pixelsPerMm;
  const toM = (px) => px / pixelsPerMm / 1000;
  const zoneOf = polygons.map((_, index) => index);
  const find = (index) => (zoneOf[index] === index ? index : (zoneOf[index] = find(zoneOf[index])));
  let perimeterPx = polygons.reduce((sum, area) => sum + edgesOf(area.nodes).reduce((total, edge) => total + lengthPx(edge), 0), 0);
  let overlapping = false;
  for (let i = 0; i < polygons.length; i += 1) {
    for (let j = i + 1; j < polygons.length; j += 1) {
      // Different plan sheets have unrelated coordinates: only polygons on one sheet can adjoin.
      if (Number(polygons[i].page || 1) !== Number(polygons[j].page || 1)) continue;
      let shared = 0;
      for (const first of edgesOf(polygons[i].nodes)) for (const second of edgesOf(polygons[j].nodes)) shared += sharedLengthPx(first, second, tolerancePx);
      if (shared) { perimeterPx -= 2 * shared; zoneOf[find(i)] = find(j); }
      if (polygons[i].nodes.some((node) => pointInside(node, polygons[j].nodes, tolerancePx)) || polygons[j].nodes.some((node) => pointInside(node, polygons[i].nodes, tolerancePx))) overlapping = true;
    }
  }
  const areaPx = polygons.reduce((sum, area) => sum + Math.max(0, polygonAreaPx(area.nodes) - (area.exclusions || []).reduce((total, exclusion) => total + (exclusion?.nodes?.length >= 3 ? polygonAreaPx(exclusion.nodes) : 0), 0)), 0);
  return {
    polygons: polygons.length,
    measured: true,
    areaM2: areaPx / (pixelsPerMm * pixelsPerMm) / 1000000,
    perimeterLm: toM(Math.max(0, perimeterPx)),
    zones: new Set(polygons.map((_, index) => find(index))).size,
    overlapping,
  };
}

// roofPlanAreaM2 / externalWallsLm: { lower, upper, third } from the estimate's canonical quantities.
// topLevelPrefix: the storey with nothing above it.
export function calculateCeilingBattens({ job = null, roofPlanAreaM2 = {}, externalWallsLm = {}, topLevelPrefix = "lower" } = {}) {
  const warnings = [];
  const levels = ROOFED_CEILING_LEVELS.map(({ prefix, level, label }) => {
    const outline = roofAreaOutline(job, level);
    const areaM2 = num(roofPlanAreaM2[prefix]);
    let perimeterLm = 0;
    let perimeterSource = "";
    if (areaM2 && outline.measured) {
      perimeterLm = outline.perimeterLm;
      perimeterSource = `Takeoff Roof Area outline (${outline.zones} zone${outline.zones === 1 ? "" : "s"})`;
      if (outline.overlapping) warnings.push(`${label}: Roof Area polygons overlap in the Takeoff - area and perimeter are overstated until they are redrawn edge to edge.`);
    } else if (areaM2 && prefix === topLevelPrefix && num(externalWallsLm[prefix])) {
      // No roof outline drawn: the top storey's ceiling is bounded by its measured external walls.
      perimeterLm = num(externalWallsLm[prefix]);
      perimeterSource = `${prefix}ExternalWallsLm (no Roof Area drawn on this level)`;
      warnings.push(`${label}: perimeter taken from measured external walls. Draw the Roof Area in the Takeoff to include open edges (alfresco, porch).`);
    } else if (areaM2) {
      perimeterSource = "not measured";
      warnings.push(`${label}: no Roof Area outline in the Takeoff, so perimeter battens for this level are not included.`);
    }
    return { prefix, level, label, areaM2, perimeterLm, perimeterSource, areaSource: `${prefix}RoofPlanAreaM2`, fieldLm: areaM2 / CEILING_BATTEN_SPACING_M, zones: outline.zones };
  }).filter((entry) => entry.areaM2 > 0);
  const roofedCeilingArea = levels.reduce((sum, entry) => sum + entry.areaM2, 0);
  const roofedCeilingPerimeter = levels.reduce((sum, entry) => sum + entry.perimeterLm, 0);
  const fieldLm = roofedCeilingArea / CEILING_BATTEN_SPACING_M;
  const totalLm = fieldLm + roofedCeilingPerimeter;
  const adjustedLm = totalLm * CEILING_BATTEN_WASTE_FACTOR;
  const battens = adjustedLm / CEILING_BATTEN_EFFECTIVE_COVERAGE_M;
  // 1e-9 only absorbs float noise; a real fraction of a batten always rounds up.
  const qty = totalLm ? Math.ceil(battens - 1e-9) : 0;
  const working = !levels.length ? "No roofed ceiling area: enter the roof plan area in Job Setup or draw the Roof Area in the Takeoff." : [
    ...levels.map((entry) => `${entry.label} roofed ceiling: Area ${fixed(entry.areaM2)}m² / 0.45 = ${fixed(entry.fieldLm)} LM | Perimeter = ${fixed(entry.perimeterLm)} LM [${entry.perimeterSource}]`),
    `Total: ${levels.flatMap((entry) => [fixed(entry.fieldLm), fixed(entry.perimeterLm)]).join(" + ")} = ${fixed(totalLm)} LM`,
    `+ 8% = ${fixed(adjustedLm)} LM`,
    `/ 6.0m effective coverage = ${fixed(battens)}`,
    `ROUND UP = ${qty} BATTENS`,
    ...warnings.map((warning) => `CHECK - ${warning}`),
  ].join("\n");
  return {
    formula: CEILING_BATTEN_FORMULA,
    levels,
    roofedCeilingAreaByLevel: Object.fromEntries(levels.map((entry) => [entry.prefix, round2(entry.areaM2)])),
    roofedCeilingPerimeterByLevel: Object.fromEntries(levels.map((entry) => [entry.prefix, round2(entry.perimeterLm)])),
    roofedCeilingArea,
    roofedCeilingPerimeter,
    fieldLm,
    perimeterLm: roofedCeilingPerimeter,
    totalLm,
    adjustedLm,
    battens,
    qty,
    warnings,
    working,
  };
}
