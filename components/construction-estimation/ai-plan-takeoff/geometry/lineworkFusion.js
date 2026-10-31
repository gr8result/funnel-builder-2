// Joins the two readings of a floor-plan sheet. The linework engine says WHERE walls are, how
// long and thick they are and whether each is external or internal (the outside lies against an
// external wall's face); the plan reading (AI) adds what the drawing's lines cannot say - the
// construction system, finishes, and which opening is which door or window. A wall position the
// model reported is never used as geometry, and a wall the linework does not show is never added
// on the model's word.
//
// Input and output are one sheet's analysis response in the shape normalizePlanAnalysis already
// takes (normalized 0..1 coordinates on the unrotated sheet), so the contract, the adapter and
// everything downstream are unchanged. Pure functions.
import { absorbPockets, detectPlanGeometry, pointInPolygon, traceOutlinedArea } from './planGeometry.js';
import { fitWallsToVectorLinework } from './vectorWallFit.js';
import { connectWallJunctions } from './wallJunctions.js';
import { detectVectorDoorSwings, swingEvidence } from './vectorDoorSwings.js';
import { snapRoomToWallFaces } from './roomWallFaces.js';
import { gapGlazingEvidence } from './vectorGapEvidence.js';

const CONTRACT_THICKNESSES = [70, 90, 100, 110, 140, 150, 200, 230, 270, 300, 350];
const nearest = (value, list) => list.reduce((best, item) => (Math.abs(item - value) < Math.abs(best - value) ? item : best));
const CLASSIFICATION_FIELDS = ['constructionSystem', 'frameThicknessMm', 'exteriorFinish', 'exteriorFinishCustomLabel', 'customSystemLabel', 'wallHeightM'];

export const FUSION_DEFAULTS = {
  minimumStoredPixelsPerMm: 0.05, // below this a 70 mm wall is under 3.5 stored pixels: its two faces are one blur
  externalWallMinMm: 180,  // a door across a gap this thick, with no host wall of its own, is in an external wall
  garageDoorMinMm: 2200,   // and at least this wide it is a garage door
  pocketMaxM2: 1.5,        // an unnamed space this small, cut off from a room only by unconfirmed gaps, is part of that room
  categoryReachMm: 1500,   // how far a model wall trace may be from the wall it classifies
  supportReachMm: 600,     // a model wall trace this close to linework is "the same wall"
  minimumClassificationShare: 0.35, // at least 35% of a measured run needs aligned AI trace
  hostReachMm: 1200,       // an opening with no gap of its own is put on the nearest wall this close
  modelOpeningReachMm: 2000, // the plan reading locates an opening only roughly: it may be this far from the gap or frame it is
  modelOpeningFarReachMm: 3500, // and this far where its width matches exactly
  roomLabelReachMm: 2500,  // the plan reading places a room name only roughly: it may be this far outside the space it names
  smallRoomMaxM2: 10, largeRoomMinM2: 6, // a wet area, robe or store is no bigger; a bedroom or living space no smaller
  shareRatherThanMoveMm: 1500, // a name inside a large space shares it unless a free space of its own is nearer than this
  sharedSpaceMinM2: 12,    // several names in one measured space this big are one open-plan space
  maxRoomCorners: 80,      // boundaries are handed on with at most this many corners
  minFrameOpeningMm: 500,  // a frame in an external wall narrower than this is not offered as a window
  duplicateMm: 400,        // two openings of one kind this close on one wall are one opening
};

const segmentsOf = (walls) => walls.flatMap((wall) => wall.nodes.slice(1).map((end, index) => ({ wall, a: wall.nodes[index], b: end })));
function project(point, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, lengthSq = dx * dx + dy * dy;
  const t = lengthSq ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq)) : 0;
  const x = a.x + t * dx, y = a.y + t * dy;
  return { x, y, distance: Math.hypot(x - point.x, y - point.y) };
}
const parallel = (p, q) => { const d = Math.abs(Math.atan2(p.b.y - p.a.y, p.b.x - p.a.x) - Math.atan2(q.b.y - q.a.y, q.b.x - q.a.x)) % Math.PI; return Math.min(d, Math.PI - d) < 0.35; };
const lengthPx = (segment) => Math.hypot(segment.b.x - segment.a.x, segment.b.y - segment.a.y);
// A closed boundary reduced to at most `limit` corners, dropping the corners that matter least first.
function reduceBoundary(polygon, limit, tolerance) {
  let points = polygon;
  const offLine = (list, i) => { const a = list[(i + list.length - 1) % list.length], b = list[(i + 1) % list.length]; return project(list[i], a, b).distance; };
  for (let allowed = tolerance; ; allowed *= 1.5) {
    const kept = new Set();
    for (;;) {
      let least = Infinity, index = -1;
      for (let i = 0; i < points.length; i += 1) { if (kept.has(points[i])) continue; const d = offLine(points, i); if (d < least) { least = d; index = i; } }
      if (index < 0 || least > allowed || points.length <= 4) break;
      const without = points.filter((_, i) => i !== index);
      if (crossesItself(without)) { kept.add(points[index]); continue; }
      points = without;
    }
    if (points.length <= limit || allowed > tolerance * 60) return points;
  }
}
// What kind of space a printed room name is, as far as its size goes: a wet area, robe or store is
// never a 20 m² space and a bedroom or living room is never a cupboard. Outdoor areas are not
// enclosed by walls at all.
function roomSizeClass(name = '') {
  const text = String(name).toLowerCase();
  if (/\b(alfresco|patio|balcony|porch|verandah|veranda|deck|terrace|courtyard|portico)\b/.test(text)) return 'outdoor';
  if (/\b(ens|ensuite|bath|bathroom|wc|toilet|pwd|powder|ldry|laundry|l'dry|pan|pantry|robe|wir|linen|store|storage|cupboard|cpd|broom|void|duct|riser)\b/.test(text)) return 'small';
  if (/\b(bed|bedroom|master|rumpus|media|theatre|family|living|lounge|dining|meals|kitchen|garage|study|office|w\/shop|workshop|foyer|entry|games|retreat|sitting)\b/.test(text)) return 'large';
  return 'any';
}

// A built-in robe (not a walk-in one) belongs to a bedroom.
const isBuiltInRobe = (name = '') => /\brobe\b/i.test(name) && !/\b(w\.?i\.?r|walk)/i.test(name);
const isBedroom = (name = '') => /\b(bed|bedroom|master|guest)\b/i.test(name);

// The least floor a named room can have (m²): a name is never given a pocket smaller than its kind of room.
function roomMinimumM2(name = '') {
  const text = String(name).toLowerCase();
  if (/\b(ens|ensuite|bath|bathroom|ldry|laundry|l'dry)\b/.test(text)) return 1.8;
  if (/\b(wc|toilet|pwd|powder|pan|pantry|wir)\b/.test(text)) return 0.8;
  if (/\b(robe|linen|store|storage|cupboard|cpd|broom)\b/.test(text)) return 0.3;
  return 0;
}

// Minimum-cost assignment of rows to columns (rows <= columns), the Hungarian method.
function assign(cost) {
  const n = cost.length, m = cost[0]?.length || 0;
  const u = new Array(n + 1).fill(0), v = new Array(m + 1).fill(0), p = new Array(m + 1).fill(0), way = new Array(m + 1).fill(0);
  for (let i = 1; i <= n; i += 1) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(m + 1).fill(Infinity), used = new Array(m + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity, j1 = 0;
      for (let j = 1; j <= m; j += 1) {
        if (used[j]) continue;
        const current = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (current < minv[j]) { minv[j] = current; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for (let j = 0; j <= m; j += 1) { if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta; }
      j0 = j1;
    } while (p[j0] !== 0);
    do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
  }
  const result = new Array(n).fill(-1);
  for (let j = 1; j <= m; j += 1) if (p[j]) result[p[j] - 1] = j - 1;
  return result;
}
// True when two sides of a closed boundary that are not neighbours cross.
function crossesItself(polygon) {
  const side = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  for (let i = 0; i < polygon.length; i += 1) for (let j = i + 2; j < polygon.length; j += 1) {
    if (i === 0 && j === polygon.length - 1) continue;
    const a = polygon[i], b = polygon[(i + 1) % polygon.length], c = polygon[j], d = polygon[(j + 1) % polygon.length];
    if (side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0) return true;
  }
  return false;
}
const DOOR_LEAVES = [520, 620, 720, 770, 820, 870, 920, 1020, 1200];
// What the plan reading says an opening is, for matching it to a gap (door) or a frame drawn in a wall (window).
const openingKind = (item) => (item?.type === 'window' && item?.openingClass === 'Window' ? 'window' : ['Internal Door', 'External Door', 'Garage Door'].includes(item?.openingClass) ? 'door' : undefined);
const openingWidth = (item) => [item?.explicitWidthMm, item?.widthMm].map(Number).find((value) => value > 0) || 0;
// A four-digit size code is height then width or width then height (2130 is 2100 x 3000 either way round): both are possible widths.
const codeWidths = (item) => { const match = String(item?.sizeCode || '').trim().match(/^([0-9]{2})([0-9]{2})/); return match ? [Number(match[1]) * 100, Number(match[2]) * 100].filter((value) => value >= 300) : []; };

// Share of a segment that runs along (parallel to, within reach of) any segment of the pool.
function shareAlong(segment, pool, reachPx, stepPx) {
  const parts = Math.max(1, Math.round(lengthPx(segment) / stepPx));
  let hit = 0;
  for (let i = 0; i <= parts; i += 1) {
    const point = { x: segment.a.x + (segment.b.x - segment.a.x) * i / parts, y: segment.a.y + (segment.b.y - segment.a.y) * i / parts };
    if (pool.some((other) => parallel(segment, other) && project(point, other.a, other.b).distance <= reachPx)) hit += 1;
  }
  return hit / (parts + 1);
}

function manualFootprintSupport(candidate, footprints, pixelsPerMm) {
  const segment = { a: candidate.nodes[0], b: candidate.nodes[1] };
  const edges = footprints.flatMap((area) => (area.nodes || []).map((a, index, nodes) => ({
    wall: area, a: nodes[index], b: nodes[(index + 1) % nodes.length],
  })));
  const matching = edges.filter((edge) => shareAlong(segment, [edge], 250 * pixelsPerMm, 100 * pixelsPerMm) >= 0.75);
  return { supported: matching.length > 0, footprintIds: [...new Set(matching.map((edge) => edge.wall.id))] };
}

/**
 * @param response one sheet's merged analysis ({ page, walls, openings, rooms, ... }), normalized coordinates
 * @param raster   { width, height, data } RGBA pixels of that sheet
 * @param sheet    { pageNumber, logicalWidth, logicalHeight, pixelsPerMm } with the confirmed calibration
 * @param existing { placedOpenings } already in the takeoff on this sheet (logical pixels): more opening evidence
 * @returns {{ response, geometry, report }} the response with measured walls and re-positioned openings
 */
export function fuseSheetLinework(response, raster, sheet, existing = {}, overrides = {}) {
  const options = { ...FUSION_DEFAULTS, ...overrides };
  const { logicalWidth, logicalHeight, pixelsPerMm } = sheet;
  const toPixels = (point) => ({ x: point.x * logicalWidth, y: point.y * logicalHeight });
  const toNormal = (point) => ({ x: Math.min(1, Math.max(0, point.x / logicalWidth)), y: Math.min(1, Math.max(0, point.y / logicalHeight)) });
  const mm = (value) => value * pixelsPerMm;
  const modelOpenings = (response.openings || []).map((item, index) => ({ item, index, at: Number.isFinite(item?.x) && Number.isFinite(item?.y) ? toPixels(item) : null }));
  const evidence = [
    ...modelOpenings.filter((entry) => entry.at).map((entry) => ({ ...entry.at, ref: `model:${entry.index}`, reachMm: options.modelOpeningReachMm, farReachMm: options.modelOpeningFarReachMm, kind: openingKind(entry.item), widthMm: codeWidths(entry.item).length ? 0 : openingWidth(entry.item), widths: codeWidths(entry.item) })),
    ...(existing.placedOpenings || []).filter((item) => Number.isFinite(item?.x) && Number.isFinite(item?.y)).map((item) => ({ x: item.x, y: item.y, ref: `placed:${item.id}` })),
  ];
  // A vector PDF draws each hinged door's swing: the doorway it spans is drawing evidence, as a placed door is.
  const vectorLinework = existing.vectorLinework || sheet.vectorLinework || [];
  const vectorSwings = detectVectorDoorSwings(vectorLinework, pixelsPerMm);
  evidence.push(...swingEvidence(vectorSwings));
  const storedPixelsPerMm = Number(raster?.storedPixelsPerMm ?? sheet.storedPixelsPerMm) || 0;
  if (storedPixelsPerMm > 0 && storedPixelsPerMm < options.minimumStoredPixelsPerMm) {
    // The stored image is too coarse to tell a wall's two faces apart. Nothing is measured from
    // it: what would come out is not the drawing.
    const review = [{ code: 'linework-failed', message: `Sheet ${response.page} is stored too coarsely to measure walls from: a 70 mm wall is ${(70 * storedPixelsPerMm).toFixed(1)} pixels wide on it and at least ${(70 * options.minimumStoredPixelsPerMm).toFixed(1)} are needed. Nothing was measured from its linework. Import the sheet again at a higher resolution, or use a larger-scale drawing of this level.` }];
    return { response: { ...response, review: [...(response.review || []), ...review] }, geometry: { engine: 'not-run', walls: [], openings: [], rooms: [], diagnostics: [{ code: 'stored-resolution-too-low', storedPixelsPerMm }] }, report: { engine: 'not-run', measuredWalls: 0, storedPixelsPerMm, review } };
  }
  let geometry = detectPlanGeometry(raster, { pixelsPerMm, logicalWidth, logicalHeight, openingEvidence: evidence }, overrides.geometry || {});
  // A gap with frame and glass lines drawn across it is a window (or slider) on the drawing's own
  // evidence. Gaps are only known once measured, so the sheet is measured again with that evidence.
  const glazing = gapGlazingEvidence(geometry.openings.filter((opening) => opening.kind === 'wall-gap'), vectorLinework, pixelsPerMm);
  if (glazing.length) {
    evidence.push(...glazing);
    geometry = detectPlanGeometry(raster, { pixelsPerMm, logicalWidth, logicalHeight, openingEvidence: evidence }, overrides.geometry || {});
  }
  // On a vector PDF the drawn face lines say exactly where each wall is (raster faces are a line-width
  // or two out); then every wall that meets another shares the point where their centrelines cross.
  const vectorFit = fitWallsToVectorLinework(geometry.walls, vectorLinework, pixelsPerMm, overrides.vectorFit || {});
  const connected = connectWallJunctions(vectorFit.walls, pixelsPerMm, overrides.junctions || {});
  geometry.walls = connected.walls;
  geometry.junctions = connected.junctions;
  const report = { engine: geometry.engine, vectorFit: { ...vectorFit.report, doorSwings: vectorSwings.length, glazedGaps: glazing.length }, junctions: connected.report, measuredWalls: geometry.walls.length, wallsEmitted: 0, uncategorisedLm: 0, categoryFromLineworkOnlyLm: 0, categoryDisagreementLm: 0, flaggedWalls: 0, modelWallLm: 0, modelWallWithoutLineworkLm: 0,
    openings: { model: modelOpenings.length, onConfirmedGap: 0, onNearestWall: 0, unplaced: 0, duplicatesRemoved: 0, embeddedSymbolReviewCandidates: 0, fromDoorSwing: 0, fromExternalFrame: 0, fromDoorway: 0, fromDoorLine: 0, held: [] },
    gaps: { confirmed: 0, unconfirmed: 0 }, rooms: { verified: 0, proposed: 0, adopted: 0, adoptedByProximity: 0, sharedSpaces: 0, withoutBoundary: 0, outdoorOutlined: 0, builtInRobes: 0, readingBoundariesWithheld: 0, pocketsAbsorbed: 0 }, singleFaceReviewCandidates: [], review: [] };
  if (!geometry.walls.length) {
    // Nothing measurable: the plan reading is passed through untouched and says so.
    report.review.push({ code: 'linework-failed', message: 'No wall linework could be measured on this sheet; wall positions are the plan reading\'s own and need checking.' });
    return { response: { ...response, review: [...(response.review || []), ...report.review] }, geometry, report };
  }
  // Findings are coded so the review can say which are errors to correct, which need confirming and which are notes.
  const note = (code, message) => report.review.push({ code, message });

  // ---- Walls: measured geometry and category; construction details from the nearest model trace
  const modelSegments = segmentsOf((response.walls || []).filter((wall) => Array.isArray(wall?.nodes) && wall.nodes.length >= 2).map((wall) => ({ ...wall, nodes: wall.nodes.map(toPixels) })));
  const walls = [];
  for (const measured of geometry.walls) {
    const segment = { a: measured.nodes[0], b: measured.nodes[1] };
    const middle = { x: (segment.a.x + segment.b.x) / 2, y: (segment.a.y + segment.b.y) / 2 };
    const match = modelSegments.filter((other) => parallel(segment, other)).map((other) => ({ other,
      distance: project(middle, other.a, other.b).distance,
      support: shareAlong(segment, [other], mm(options.supportReachMm), mm(100)),
    })).filter((entry) => entry.distance <= mm(options.categoryReachMm) && entry.support >= options.minimumClassificationShare)
      .sort((a, b) => b.support - a.support || a.distance - b.distance)[0];
    // The plan reading's construction details are taken only from a trace of the same category.
    const source = match && match.other.wall.category === measured.category ? match.other.wall : null;
    if (!source) report.categoryFromLineworkOnlyLm += measured.lengthMm / 1000;
    if (match && !source) report.categoryDisagreementLm += measured.lengthMm / 1000;
    const classification = source ? Object.fromEntries(CLASSIFICATION_FIELDS.filter((key) => source[key] !== undefined).map((key) => [key, source[key]])) : {};
    // An internal timber wall reports its frame as its thickness; a measured 60-80 mm wall is a 70.
    const thicknessMm = nearest(measured.measuredThicknessMm, CONTRACT_THICKNESSES);
    if (measured.reviewRequired) report.flaggedWalls += 1;
    walls.push({
      detectionId: measured.id, page: response.page, basis: 'OBSERVED', confidence: measured.reviewRequired ? 0.6 : source ? Math.max(0.5, Math.min(0.95, Number(source.confidence) || 0.8)) : 0.8,
      evidence: `Position, length and ${measured.measuredThicknessMm} mm thickness measured from the sheet linework; ${measured.category === 'exterior' ? 'external: the outside lies against its face' : 'internal: enclosed on both faces'}${source ? `, as the plan reading also has it (${source.detectionId})` : ''}.${measured.reviewRequired ? ` ${measured.reviewReason}` : ''}`,
      nodes: measured.nodes.map(toNormal), category: measured.category, thicknessMm, exteriorType: 'Other', ...classification,
      lineworkWallId: measured.id, measuredThicknessMm: measured.measuredThicknessMm,
    });
  }
  report.wallsEmitted = walls.length;
  const measuredSegments = segmentsOf(geometry.walls);
  const footprints = (existing.completedFloorplans || []).filter((area) => Number(area.page) === Number(response.page)
    && area.type === 'Footprint' && Array.isArray(area.nodes) && area.nodes.length >= 3);
  for (const candidate of geometry.singleFaceReviewCandidates || []) {
    if (candidate.lengthMm < 2000 || !footprints.length) continue;
    const support = manualFootprintSupport(candidate, footprints, pixelsPerMm);
    if (!support.supported) continue;
    const reviewCandidate = { ...candidate, footprintIds: support.footprintIds,
      reviewReason: 'Single-face plan linework follows the manually traced outer footprint. A second wall face and thickness are not established; verify manually before measuring.' };
    report.singleFaceReviewCandidates.push(reviewCandidate);
    note('single-face-line', `A ${Math.round(candidate.lengthMm / 100) / 10} m single-face line follows the manual outer footprint on sheet ${response.page}; verify it is a wall before measuring.`);
  }
  report.openings.embeddedSymbolReviewCandidates = geometry.embeddedOpeningReviewCandidates?.length || 0;
  // Frame marks across a wall that are not already a candidate opening: listed together, once per sheet.
  const frameMarks = (geometry.embeddedOpeningReviewCandidates || []).filter((candidate) => !geometry.openings.some((opening) => Math.hypot(opening.x - candidate.x, opening.y - candidate.y) <= mm(700)));
  if (frameMarks.length) note('unclassified-opening', `${frameMarks.length} place${frameMarks.length === 1 ? '' : 's'} on sheet ${response.page} ${frameMarks.length === 1 ? 'has' : 'have'} frame marks drawn across a wall that may be a door, window or wall detail (${frameMarks.map((candidate) => `${candidate.widthMm} mm at ${Math.round(candidate.x)}, ${Math.round(candidate.y)}`).join('; ')}); check each on the plan.`);
  for (const segment of modelSegments) {
    const lengthM = lengthPx(segment) / pixelsPerMm / 1000;
    report.modelWallLm += lengthM;
    report.modelWallWithoutLineworkLm += lengthM * (1 - shareAlong(segment, measuredSegments, mm(options.supportReachMm), mm(100)));
  }
  if (report.categoryDisagreementLm >= 0.5) note('wall-category-check', `${report.categoryDisagreementLm.toFixed(1)} m of wall on sheet ${response.page} is external or internal by its position on the drawing where the plan reading had it the other way; the drawing was followed.`);
  if (report.modelWallWithoutLineworkLm >= 0.5) note('reading-not-in-linework', `${report.modelWallWithoutLineworkLm.toFixed(1)} m of wall reported by the plan reading has no matching wall linework and was not added.`);

  // ---- Openings: on the confirmed gap they explain, else on the nearest measured wall --------
  const emitted = new Map(walls.map((wall) => [wall.lineworkWallId, wall]));
  const emittedSegments = segmentsOf(geometry.walls.filter((wall) => emitted.has(wall.id)));
  report.gaps.confirmed = geometry.openings.filter((gap) => gap.confirmed).length;
  report.gaps.unconfirmed = geometry.openings.length - report.gaps.confirmed;
  // Which measured opening each reported opening is: one assignment over the whole sheet, so a
  // reported entry door goes to the door swing drawn in the external wall rather than to whichever
  // gap happens to lie nearest the position the plan reading gave it. Cost is distance, plus what
  // disagrees: a window on a doorway, a door on a frame, the wrong side of the building, the width.
  const wallOf = new Map(geometry.walls.map((wall) => [wall.id, wall]));
  const hostOf = (found) => {
    if (found.hostWallId && wallOf.has(found.hostWallId)) return wallOf.get(found.hostWallId);
    // An unconfirmed gap lies between two wall ends: the nearer of them is its wall.
    const near = emittedSegments.map((segment) => ({ segment, ...project(found, segment.a, segment.b) })).filter((entry) => entry.distance <= mm(found.widthMm / 2 + 300)).sort((a, b) => a.distance - b.distance)[0];
    return near ? near.segment.wall : null;
  };
  const candidates = geometry.openings.map((found) => ({ found, host: hostOf(found) }));
  const located = modelOpenings.filter((entry) => entry.at);
  const FAR = 1e7;
  const matchCost = (entry, candidate) => {
    const { found, host } = candidate;
    const distanceMm = Math.hypot(found.x - entry.at.x, found.y - entry.at.y) / pixelsPerMm;
    if (distanceMm > options.modelOpeningFarReachMm) return FAR;
    const kind = openingKind(entry.item), widths = codeWidths(entry.item).length ? codeWidths(entry.item) : [openingWidth(entry.item)].filter(Boolean);
    const isFrame = found.kind === 'wall-symbol', isDoorway = !isFrame;
    let cost = distanceMm;
    if (kind === 'window' && isDoorway) cost += found.aligned && host?.category === 'exterior' ? 400 : 1500;
    if (kind === 'door' && isFrame) cost += 1500;
    if (isFrame && !found.inExternalWall) cost += 600;
    // A measured width that agrees pulls an opening to its place; one that disagrees pushes it away.
    const measuredWidth = found.kind === 'wall-swing' || found.basis === 'door-swing' ? (found.leafMm || found.widthMm) : found.widthMm;
    if (widths.length) {
      const off = Math.min(...widths.map((value) => Math.abs(value - measuredWidth) / value));
      // An opening twice the size of what is drawn, or half it, is another opening.
      if (off > 0.45) return FAR;
      if (off <= 0.08) cost -= 500; else if (off > 0.3) cost += Math.min(1800, off * 2000);
    }
    const outside = ['External Door', 'Garage Door', 'Window', 'Large Glazed/Stacker/Sliding Door'].includes(entry.item.openingClass);
    if (host) { if (outside !== (host.category === 'exterior')) cost += 1500; } else cost += 300;
    if (found.basis === 'door-swing' && kind === 'door') cost -= 300;
    if (isFrame && found.inExternalWall && kind === 'window') cost -= 300;
    if (distanceMm > options.modelOpeningReachMm && !(widths.length && Math.min(...widths.map((value) => Math.abs(value - measuredWidth) / value)) <= 0.08)) return FAR;
    return cost;
  };
  const assignedTo = new Map();
  if (located.length && candidates.length) {
    const cost = located.map((entry) => [...candidates.map((candidate) => matchCost(entry, candidate)), // Left unplaced: dearer than any acceptable place for an opening whose size is known; an opening reported with no size is only worth a close match.
      ...located.map((other) => (other === entry ? (codeWidths(entry.item).length || openingWidth(entry.item) ? options.modelOpeningFarReachMm + 1500 : 1800) : FAR))]);
    assign(cost).forEach((column, row) => { if (column >= 0 && column < candidates.length && cost[row][column] < FAR) assignedTo.set(located[row].index, candidates[column]); });
    // How each reported opening was resolved, for diagnostics.
    report.openings.assignments = located.map((entry, row) => { const best = cost[row].slice(0, candidates.length).map((value, column) => ({ value, column })).sort((p, q) => p.value - q.value).slice(0, 3); const got = assignedTo.get(entry.index);
      return { detectionId: entry.item.detectionId, openingClass: entry.item.openingClass, at: { x: Math.round(entry.at.x), y: Math.round(entry.at.y) }, widths: codeWidths(entry.item).length ? codeWidths(entry.item) : [openingWidth(entry.item)].filter(Boolean), to: got ? got.found.id : null,
        nearest: best.filter((item) => item.value < FAR).map((item) => `${candidates[item.column].found.id}:${candidates[item.column].found.kind}:${candidates[item.column].found.widthMm}:${Math.round(item.value)}`) }; });
  }
  const claimedIds = new Set([...assignedTo.values()].map((candidate) => candidate.found.id));
  const placed = [];
  for (const { item, index, at } of modelOpenings) {
    if (!at) { report.openings.unplaced += 1; report.openings.held.push({ detectionId: item.detectionId, openingClass: item.openingClass, type: item.type, sizeCode: item.sizeCode || null, widthMm: openingWidth(item) || null, heightMm: Number(item.heightMm) || null, near: null, evidence: item.evidence || '' }); continue; }
    const match = assignedTo.get(index);
    if (match) {
      const gap = match.found;
      report.openings.onConfirmedGap += 1;
      const hosted = match.host && emitted.has(match.host.id) ? match.host.id : null;
      const what = gap.kind === 'wall-symbol' ? `a ${gap.widthMm} mm frame drawn in the wall` : gap.kind === 'wall-swing' ? `a door drawn with its swing (${gap.leafMm} mm)` : gap.kind === 'door-line' ? `a ${gap.widthMm} mm door line` : `a ${gap.widthMm} mm gap measured in the wall linework`;
      placed.push({ wallId: hosted, at: { x: gap.x, y: gap.y }, item: { ...item, ...toNormal(gap), hostDetectionId: hosted, lineworkGapId: gap.id, measuredGapMm: gap.widthMm, positionBasis: 'linework',
        ...(gap.confirmed ? {} : { confidence: Math.min(Number(item.confidence) || 0.7, 0.7) }),
        evidence: `${item.evidence || ''} Positioned on ${what}.`.trim() } });
      continue;
    }
    // Nothing in the wall linework is this opening. The plan reading's own position is good to a
    // metre or two at best, so it is not placed there: it is held for the estimator to place.
    report.openings.unplaced += 1;
    report.openings.held.push({ detectionId: item.detectionId, openingClass: item.openingClass, type: item.type, sizeCode: item.sizeCode || null, widthMm: openingWidth(item) || null, heightMm: Number(item.heightMm) || null,
      near: toNormal(at), evidence: item.evidence || '' });
  }
  // Openings the drawing shows on its own evidence, which the plan reading did not locate: a door
  // whose swing is drawn at a gap, and a frame drawn in an external wall. Their class and height
  // are not known from the linework, so each is added for the estimator to confirm.
  const wallById = new Map(geometry.walls.map((wall) => [wall.id, wall]));
  for (const found of geometry.openings) {
    if (claimedIds.has(found.id) || String(found.evidenceRef || '').startsWith('placed:')) continue;
    const swing = (found.kind === 'wall-gap' || found.kind === 'wall-swing') && found.basis === 'door-swing';
    const frame = found.kind === 'wall-symbol' && found.inExternalWall && found.widthMm >= options.minFrameOpeningMm;
    // A door-width opening in an internal wall with no swing drawn. In an external wall the frames already say what is there.
    const doorway = found.kind === 'wall-gap' && found.basis === 'aligned-wall-ends' && found.confirmed && wallById.get(found.hostWallId)?.category === 'interior';
    // A door drawn across an opening wider than a doorway.
    const wide = found.kind === 'wall-gap' && found.basis === 'door-line-across';
    // Sliding panels drawn across a recess a robe deep.
    const track = found.kind === 'door-line' && found.basis === 'track-across-recess';
    // A leaf drawn in a wall pocket: a cavity slider, single or double.
    const cavity = found.kind === 'wall-gap' && found.basis === 'cavity-pocket';
    if (!swing && !frame && !doorway && !wide && !track && !cavity) continue;
    const hosted = found.hostWallId && emitted.has(found.hostWallId) ? found.hostWallId : null;
    const hostCategory = wallById.get(found.hostWallId)?.category;
    const external = hostCategory === 'exterior' || (wide && !hostCategory && found.hostThicknessMm >= options.externalWallMinMm);
    const garage = wide && external && found.widthMm >= options.garageDoorMinMm;
    const leaf = swing ? nearest(found.leafMm || found.widthMm, DOOR_LEAVES) : null;
    const widthMm = swing ? (Math.abs(leaf - (found.leafMm || found.widthMm)) <= 60 ? leaf : Math.round((found.leafMm || found.widthMm) / 10) * 10) : Math.round(found.widthMm / 10) * 10;
    if (swing) report.openings.fromDoorSwing += 1; else if (frame) report.openings.fromExternalFrame += 1; else if (wide || track || cavity) report.openings.fromDoorLine += 1; else report.openings.fromDoorway += 1;
    placed.push({ wallId: hosted, at: { x: found.x, y: found.y }, fromLinework: true, item: {
      detectionId: `linework:${found.id}`, page: response.page, basis: 'OBSERVED', confidence: swing ? 0.75 : track ? 0.7 : frame || wide ? 0.6 : 0.55,
      evidence: swing
        ? (found.kind === 'wall-swing'
          ? `A door is drawn closed in this wall with its swing; the swing radius measures ${found.leafMm} mm. Not located by the plan reading: confirm its type, width and height.`
          : `A door swing is drawn at a ${found.widthMm} mm gap in the wall linework; the leaf measures ${found.leafMm} mm. Not located by the plan reading: confirm its type and height.`)
        : track ? `Two thin door panels are drawn from wall to wall across a recess ${found.recessDepthMm} mm deep, ${found.widthMm} mm wide: sliding robe doors. Not located by the plan reading: confirm the door type and height.`
        : wide ? (garage
          ? `A door is drawn across a ${found.widthMm} mm opening in an external wall, from one wall end to the other: a garage door. Not located by the plan reading: confirm its type and height.`
          : `A door is drawn across a ${found.widthMm} mm opening, from one wall end to the other: a sliding robe door or a cavity slider. Not located by the plan reading: confirm its type and height.`)
        : frame ? `A frame ${found.widthMm} mm long is drawn in an external wall. Not located by the plan reading: confirm it is a window or glazed door, and its size.`
          : `A ${found.widthMm} mm opening lies between two ends of one internal wall, with no door swing drawn: a sliding door, a cavity slider or an open doorway. Confirm what it is.`,
      ...toNormal(found), type: frame ? 'window' : 'door', openingClass: frame ? 'Window' : garage ? 'Garage Door' : (external ? 'External Door' : 'Internal Door'),
      hostDetectionId: hosted, tag: null, sizeCode: null, explicitWidthMm: null, explicitHeightMm: null, widthMm, heightMm: null,
      dimensionBasis: 'OBSERVED', dimensionEvidence: `Width measured from the sheet linework (${swing ? 'door swing radius' : frame ? 'frame length' : 'gap between the wall ends'}).`,
      lineworkBasis: swing ? 'door-swing' : frame ? 'frame-in-external-wall' : wide ? 'door-line-across' : track ? 'track-across-recess' : 'aligned-wall-ends',
      ...(track ? { subType: 'Robe sliding door' } : {}),
      subType: null, quantity: 1, glassType: 'Unspecified', scheduleGlassType: 'Unspecified',
      lineworkGapId: found.id, measuredGapMm: found.widthMm, positionBasis: 'linework', needsClassification: true,
    } });
    if (cavity) {
      // One door per leaf: a double cavity slider is two leaves meeting in the middle of the opening.
      const entry = placed.pop();
      const leaves = found.cavityLeaves === 2 ? 2 : 1;
      const each = found.widthMm / leaves, standard = nearest(each, DOOR_LEAVES);
      const leafMm = Math.abs(standard - each) <= 60 ? standard : Math.round(each / 10) * 10;
      const quarter = mm(found.widthMm / 4);
      for (const side of leaves === 2 ? [-1, 1] : [0]) {
        const at = { x: found.x + (found.axis === 'h' ? side * quarter : 0), y: found.y + (found.axis === 'h' ? 0 : side * quarter) };
        placed.push({ ...entry, at, item: { ...entry.item, ...toNormal(at), detectionId: `linework:${found.id}${side ? (side < 0 ? ':a' : ':b') : ''}`, widthMm: leafMm, confidence: 0.7,
          subType: 'Cavity sliding door', lineworkBasis: 'cavity-pocket', measuredGapMm: Math.round(each),
          dimensionEvidence: 'Width measured from the sheet linework (clear opening between the wall pockets).',
          evidence: `A door leaf is drawn part way out of a pocket in the wall ${leaves === 2 ? 'at each side of' : 'beside'} a ${found.widthMm} mm clear opening: ${leaves === 2 ? 'one leaf of a double cavity sliding door' : 'a cavity sliding door'}. Not located by the plan reading: confirm its type and height.` } });
      }
      if (leaves === 2) report.openings.fromDoorLine += 1;
    }
  }
  // (the note is written after duplicates are removed, below)
  // The same opening reported twice (overlapping readings) is one opening: same kind, same wall, same place.
  const openings = [];
  for (const entry of placed.sort((a, b) => (a.fromLinework ? 1 : 0) - (b.fromLinework ? 1 : 0) || (Number(b.item.confidence) || 0) - (Number(a.item.confidence) || 0))) {
    const twin = entry.at && openings.find((kept) => kept.at && (entry.fromLinework
      ? Math.hypot(kept.at.x - entry.at.x, kept.at.y - entry.at.y) <= (['door-line-across', 'track-across-recess', 'cavity-pocket'].includes(entry.item.lineworkBasis) ? mm(options.duplicateMm) : Math.max(mm(options.duplicateMm), mm(entry.item.measuredGapMm || 0) * 0.5))
      : entry.wallId && kept.wallId === entry.wallId && kept.item.openingClass === entry.item.openingClass && Math.hypot(kept.at.x - entry.at.x, kept.at.y - entry.at.y) <= mm(options.duplicateMm)));
    if (twin && entry.fromLinework) { report.openings[{ 'door-swing': 'fromDoorSwing', 'frame-in-external-wall': 'fromExternalFrame', 'aligned-wall-ends': 'fromDoorway', 'door-line-across': 'fromDoorLine', 'track-across-recess': 'fromDoorLine', 'cavity-pocket': 'fromDoorLine' }[entry.item.lineworkBasis]] -= 1; continue; }
    if (twin) {
      report.openings.duplicatesRemoved += 1;
      // Keep whatever the dropped reading knew that the kept one did not (a size code, a tag).
      for (const key of ['sizeCode', 'tag', 'explicitWidthMm', 'explicitHeightMm', 'subType']) if ((twin.item[key] === null || twin.item[key] === undefined || twin.item[key] === '') && entry.item[key]) twin.item[key] = entry.item[key];
      continue;
    }
    openings.push(entry);
  }
  const lineworkOnly = report.openings.fromDoorSwing + report.openings.fromExternalFrame + report.openings.fromDoorway + report.openings.fromDoorLine;
  const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
  if (lineworkOnly) note('opening-needs-classification', `${plural(lineworkOnly, 'opening')} on sheet ${response.page} ${lineworkOnly === 1 ? 'was' : 'were'} added from the drawing's own linework (${plural(report.openings.fromDoorSwing, 'door swing')}, ${plural(report.openings.fromExternalFrame, 'frame')} in external walls, ${plural(report.openings.fromDoorway, 'doorway')} with no swing); confirm each one's type and height.`);
  if (report.openings.held.length) note('opening-not-in-linework', `${plural(report.openings.held.length, 'opening')} the plan reading reported on sheet ${response.page} ${report.openings.held.length === 1 ? 'is' : 'are'} not in the wall linework where it put ${report.openings.held.length === 1 ? 'it' : 'them'} and ${report.openings.held.length === 1 ? 'was' : 'were'} not added: ${report.openings.held.map((item) => `${item.openingClass.toLowerCase()}${item.sizeCode ? ` ${item.sizeCode}` : item.widthMm ? ` ${item.widthMm} wide` : ''}`).join(', ')}. Place ${report.openings.held.length === 1 ? 'it' : 'them'} on the plan if ${report.openings.held.length === 1 ? 'it exists' : 'they exist'}.`);
  if (report.gaps.unconfirmed) note('unconfirmed-gaps', `${report.gaps.unconfirmed} gap${report.gaps.unconfirmed === 1 ? '' : 's'} in the wall linework ${report.gaps.unconfirmed === 1 ? 'is' : 'are'} not confirmed as a door or window; walls stop at ${report.gaps.unconfirmed === 1 ? 'it' : 'them'}.`);

  // ---- Rooms: each named room takes the measured space its name is printed in ----------------
  // The engine measures spaces; the plan reading supplies names. A name goes to the smallest
  // measured space containing it. Where two names land in one space the nearer keeps it and the
  // other is offered the nearest space still unnamed; names sharing one large space with no wall
  // between them (kitchen, dining, family) are returned as that one open-plan space.
  const verified = geometry.rooms.filter((room) => room.verified);
  report.rooms.verified = verified.length;
  report.rooms.proposed = geometry.rooms.length - verified.length;
  const labelled = (response.rooms || []).map((room, index) => ({ room, index, at: Number.isFinite(room?.x) && Number.isFinite(room?.y) ? toPixels(room) : null }));
  const spaceOf = new Map();
  const distanceTo = (at, space) => (pointInPolygon(at, space.polygon) ? 0
    : space.polygon.reduce((least, a, i) => Math.min(least, project(at, a, space.polygon[(i + 1) % space.polygon.length]).distance), Infinity));
  // Spaces a name may take: the measured parts, and any whole that has no parts.
  const spaces = geometry.rooms.filter((space) => !space.dividedInto);
  const named = labelled.filter((entry) => entry.at && roomSizeClass(entry.room.name) !== 'outdoor');
  const reach = mm(options.roomLabelReachMm);
  const fits = (entry, space) => {
    const size = roomSizeClass(entry.room.name);
    return !(size === 'small' && space.netAreaM2 > options.smallRoomMaxM2) && !(size === 'large' && space.netAreaM2 < options.largeRoomMinM2) && space.netAreaM2 >= roomMinimumM2(entry.room.name);
  };
  // A name printed inside a large space that another name takes shares it rather than being moved elsewhere.
  const insideLarge = (entry) => roomSizeClass(entry.room.name) !== 'small' && spaces.find((space) => space.netAreaM2 >= options.sharedSpaceMinM2 && pointInPolygon(entry.at, space.polygon));
  if (named.length && spaces.length) {
    const BLOCKED = 1e7;
    const cost = named.map((entry) => [
      ...spaces.map((space) => { const distance = distanceTo(entry.at, space); return fits(entry, space) && distance <= reach ? distance : BLOCKED; }),
      // One "takes no space of its own" column per name.
      ...named.map((other) => (other === entry ? (insideLarge(entry) ? mm(options.shareRatherThanMoveMm) : reach) : BLOCKED)),
    ]);
    assign(cost).forEach((column, row) => {
      if (column < 0 || column >= spaces.length || cost[row][column] >= BLOCKED) return;
      spaceOf.set(named[row].index, { space: spaces[column], byProximity: cost[row][column] > 0 });
    });
    // Names left without a space of their own, printed inside a large space: one open-plan space.
    for (const entry of named) {
      if (spaceOf.has(entry.index)) continue;
      const space = insideLarge(entry);
      if (space) spaceOf.set(entry.index, { space, byProximity: false, sharing: true });
    }
  }
  const measuredRoom = (space, extra = {}) => {
    const reasons = [space.reviewReason, extra.review].filter(Boolean);
    // The outline runs to the measured wall faces; the area moves with it (deductions kept).
    const outline = reduceBoundary(space.polygon, options.maxRoomCorners, mm(25));
    const onFaces = snapRoomToWallFaces(outline, geometry.walls, pixelsPerMm);
    report.rooms.edgesOnWallFaces = (report.rooms.edgesOnWallFaces || 0) + onFaces.movedEdges;
    return { polygon: onFaces.polygon.map(toNormal), boundaryClosed: Boolean(space.verified) && !space.reviewRequired && !extra.review,
      lineworkRoomId: space.id, lineworkVerified: Boolean(space.verified), lineworkAreaM2: +(space.netAreaM2 + onFaces.areaChangeM2).toFixed(2), ...(reasons.length ? { lineworkReview: reasons.join(' ') } : {}) };
  };
  const rooms = [];
  const shared = new Map();
  // A room the drawing gives no boundary keeps its name and nothing else: a boundary the plan
  // reading drew is good to a metre or two, so it is not passed on as a measured room.
  const unmeasured = (room, extra = {}) => {
    const had = (Array.isArray(room.polygon) && room.polygon.length >= 3) || (Array.isArray(room.nodes) && room.nodes.length >= 3);
    const { polygon, nodes, ...rest } = room;
    if (had) report.rooms.readingBoundariesWithheld += 1;
    return { ...rest, ...extra, ...(had ? { boundaryWithheld: true } : {}) };
  };
  for (const entry of labelled) {
    const found = spaceOf.get(entry.index);
    if (!found && entry.at && roomSizeClass(entry.room.name) === 'outdoor') {
      // Outdoor areas have no enclosing walls. One drawn as a closed outline is measured to that outline;
      // one left open on a side is given no boundary rather than an invented one.
      const outlined = traceOutlinedArea(raster, { pixelsPerMm, logicalWidth, logicalHeight }, entry.at);
      const insideARoom = outlined && geometry.rooms.some((space) => pointInPolygon(entry.at, space.polygon));
      if (outlined && !insideARoom) {
        report.rooms.outdoorOutlined += 1;
        rooms.push({ ...entry.room, polygon: reduceBoundary(outlined.polygon, options.maxRoomCorners, mm(25)).map(toNormal), boundaryClosed: false, lineworkRoomId: `outline-${Math.round(entry.at.x)}-${Math.round(entry.at.y)}`,
          lineworkVerified: false, lineworkAreaM2: +outlined.areaM2.toFixed(2), outdoorArea: true, confidence: Math.min(Number(entry.room.confidence) || 0.6, 0.7),
          lineworkReview: 'An outdoor area measured to its drawn outline, not to walls; check the outline is the edge of the paving or slab.',
          evidence: `${entry.room.evidence || ''} Measured to the outline drawn round it (${outlined.areaM2.toFixed(2)} m²); it is not enclosed by walls.`.trim() });
        continue;
      }
      rooms.push(unmeasured(entry.room, { outdoorArea: true }));
      continue;
    }
    if (!found) { if (entry.at) report.rooms.withoutBoundary += 1; rooms.push(unmeasured(entry.room)); continue; }
    const together = labelled.filter((other) => spaceOf.get(other.index)?.space === found.space);
    if (together.length > 1) {
      const names = together.map((other) => other.room.name);
      if (together[0] !== entry) {
        rooms.push({ ...unmeasured(entry.room), sharedSpaceId: found.space.id, openPlanIn: together[0].room.name,
          evidence: `${entry.room.evidence || ''} Part of one open space with ${names.filter((name) => name !== entry.room.name).join(', ')}; no wall separates them on the drawing. Its floor is measured once, under ${together[0].room.name}.`.trim() });
        continue;
      }
      shared.set(found.space, together);
      report.rooms.sharedSpaces += 1;
      const { polygon: readingPolygon, nodes: readingNodes, ...namedRoom } = entry.room;
      rooms.push({ ...namedRoom, ...measuredRoom(found.space), sharedSpaceId: found.space.id, openPlanWith: names.filter((name) => name !== entry.room.name),
        confidence: found.space.verified ? 0.9 : 0.7,
        evidence: `${entry.room.evidence || ''} One open space of ${found.space.netAreaM2.toFixed(2)} m² measured from the wall linework; the drawing names ${names.join(', ')} in it with no wall between them. The whole floor is recorded here once.`.trim() });
      note('open-plan-space', `${names.join(', ')} on sheet ${response.page} are one open space of ${found.space.netAreaM2.toFixed(1)} m² with no wall between them; its floor is measured once, under ${entry.room.name}. Draw each room's boundary if they are to be measured separately.`);
      continue;
    }
    report.rooms.adopted += 1;
    if (found.byProximity) report.rooms.adoptedByProximity += 1;
    // The measured boundary replaces whatever boundary the plan reading drew for this room.
    const { polygon: readingPolygon, nodes: readingNodes, ...namedRoom } = entry.room;
    rooms.push({ ...namedRoom, ...measuredRoom(found.space, found.byProximity ? { review: 'The room name is printed beside this space, not inside it; check it is the right room.' } : {}),
      confidence: found.space.verified && !found.byProximity ? Math.max(Number(entry.room.confidence) || 0, 0.9) : Math.min(Number(entry.room.confidence) || 0.6, 0.7),
      evidence: `${entry.room.evidence || ''} Boundary and ${found.space.netAreaM2.toFixed(2)} m² floor area measured from the wall linework${found.space.verified ? '' : ', closing gaps that are not confirmed as doors or windows'}.`.trim() });
  }
  // Joinery does not enclose: small spaces no name was given to, cut off from a named room only by
  // closures that no door or window confirms, are that room's (behind a bench, a tub, a vanity).
  // Smallest rooms first, so a wet area takes its own fixtures before the room beside it is looked at.
  const spaceLabel = new Map(geometry.rooms.map((space) => [space.id, space.spaceLabel]));
  const takenLabels = new Set(rooms.map((room) => spaceLabel.get(room.lineworkRoomId)).filter(Boolean));
  for (const room of rooms.filter((item) => item.lineworkRoomId && !item.lineworkVerified && item.polygon?.length >= 3).sort((a, b) => a.lineworkAreaM2 - b.lineworkAreaM2)) {
    const whole = absorbPockets(geometry, room.lineworkRoomId, takenLabels, { pocketMaxM2: options.pocketMaxM2 });
    if (!whole) continue;
    whole.labels.forEach((label) => takenLabels.add(label));
    report.rooms.pocketsAbsorbed += whole.labels.length;
    const said = `Includes ${plural(whole.labels.length, 'small space')} (${whole.pocketsM2.toFixed(2)} m²) that only joinery or unconfirmed gaps cut off from it, such as the floor under a bench, tub or vanity; check they are part of this room.`;
    room.polygon = reduceBoundary(whole.polygon, options.maxRoomCorners, mm(25)).map(toNormal);
    room.lineworkAreaM2 = +whole.netAreaM2.toFixed(2);
    room.pocketsAbsorbedM2 = +whole.pocketsM2.toFixed(2);
    room.lineworkReview = [room.lineworkReview, said].filter(Boolean).join(' ');
    room.evidence = `${room.evidence || ''} ${said}`.trim();
  }
  // A built-in robe stays with its bedroom: it is measured on its own where the drawing separates it
  // (so its floor can be finished or left out on its own) and is named as that bedroom's robe. The
  // bedroom's own boundary then stops at the robe front, so no floor is counted twice.
  const bedrooms = rooms.filter((room) => isBedroom(room.name) && Array.isArray(room.polygon) && room.polygon.length >= 3);
  for (const room of rooms) {
    if (!isBuiltInRobe(room.name) || !Array.isArray(room.polygon) || room.polygon.length < 3 || !bedrooms.length) continue;
    const centre = room.polygon.reduce((sum, p) => ({ x: sum.x + p.x * logicalWidth / room.polygon.length, y: sum.y + p.y * logicalHeight / room.polygon.length }), { x: 0, y: 0 });
    const nearest = bedrooms.map((bedroom) => ({ bedroom, distance: bedroom.polygon.reduce((least, a, i) => Math.min(least, project(centre, toPixels(a), toPixels(bedroom.polygon[(i + 1) % bedroom.polygon.length])).distance), Infinity) }))
      .sort((a, b) => a.distance - b.distance)[0];
    if (!nearest || nearest.distance > mm(1500)) continue;
    room.robeOf = nearest.bedroom.name;
    report.rooms.builtInRobes += 1;
  }
  if (report.rooms.withoutBoundary) note('room-without-boundary', `${report.rooms.withoutBoundary} room name${report.rooms.withoutBoundary === 1 ? '' : 's'} on sheet ${response.page} ${report.rooms.withoutBoundary === 1 ? 'is' : 'are'} not inside any space the wall linework encloses; draw ${report.rooms.withoutBoundary === 1 ? 'its' : 'their'} boundary.`);

  return { response: { ...response, walls, openings: openings.map((entry) => entry.item), rooms,
    openingSymbolReviewCandidates: geometry.embeddedOpeningReviewCandidates || [], review: [...(response.review || []), ...report.review] }, geometry, report };
}
