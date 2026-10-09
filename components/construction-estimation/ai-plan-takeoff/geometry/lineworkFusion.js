// Joins the two readings of a floor-plan sheet. The linework engine says WHERE walls are and how
// long and thick they are; the plan reading (AI) says WHAT they are - external or internal, their
// construction - and where doors and windows are. A wall position the model reported is never
// used as geometry, and a wall the linework does not show is never added on the model's word.
//
// Input and output are one sheet's analysis response in the shape normalizePlanAnalysis already
// takes (normalized 0..1 coordinates on the unrotated sheet), so the contract, the adapter and
// everything downstream are unchanged. Pure functions.
import { detectPlanGeometry, pointInPolygon } from './planGeometry.js';

const CONTRACT_THICKNESSES = [70, 90, 100, 110, 140, 150, 200, 230, 270, 300, 350];
const nearest = (value, list) => list.reduce((best, item) => (Math.abs(item - value) < Math.abs(best - value) ? item : best));
const CLASSIFICATION_FIELDS = ['constructionSystem', 'frameThicknessMm', 'exteriorFinish', 'exteriorFinishCustomLabel', 'customSystemLabel', 'wallHeightM'];

export const FUSION_DEFAULTS = {
  categoryReachMm: 1500,   // how far a model wall trace may be from the wall it classifies
  supportReachMm: 600,     // a model wall trace this close to linework is "the same wall"
  minimumClassificationShare: 0.35, // at least 35% of a measured run needs aligned AI trace
  hostReachMm: 1200,       // an opening with no gap of its own is put on the nearest wall this close
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
    ...modelOpenings.filter((entry) => entry.at).map((entry) => ({ ...entry.at, ref: `model:${entry.index}` })),
    ...(existing.placedOpenings || []).filter((item) => Number.isFinite(item?.x) && Number.isFinite(item?.y)).map((item) => ({ x: item.x, y: item.y, ref: `placed:${item.id}` })),
  ];
  const geometry = detectPlanGeometry(raster, { pixelsPerMm, logicalWidth, logicalHeight, openingEvidence: evidence }, overrides.geometry || {});
  const report = { engine: geometry.engine, measuredWalls: geometry.walls.length, wallsEmitted: 0, uncategorisedLm: 0, flaggedWalls: 0, modelWallLm: 0, modelWallWithoutLineworkLm: 0,
    openings: { model: modelOpenings.length, onConfirmedGap: 0, onNearestWall: 0, unplaced: 0, duplicatesRemoved: 0 }, gaps: { confirmed: 0, unconfirmed: 0 }, rooms: { verified: 0, proposed: 0, adopted: 0 }, singleFaceReviewCandidates: [], review: [] };
  if (!geometry.walls.length) {
    // Nothing measurable: the plan reading is passed through untouched and says so.
    report.review.push('No wall linework could be measured on this sheet; wall positions are the plan reading\'s own and need checking.');
    return { response: { ...response, review: [...(response.review || []), ...report.review] }, geometry, report };
  }

  // ---- Walls: measured geometry, classified by the nearest model trace ----------------------
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
    if (!match) {
      report.uncategorisedLm += measured.lengthMm / 1000;
      continue;
    }
    const source = match.other.wall;
    const classification = Object.fromEntries(CLASSIFICATION_FIELDS.filter((key) => source[key] !== undefined).map((key) => [key, source[key]]));
    // An internal timber wall reports its frame as its thickness; a measured 60-80 mm wall is a 70.
    const thicknessMm = nearest(measured.measuredThicknessMm, CONTRACT_THICKNESSES);
    if (measured.reviewRequired) report.flaggedWalls += 1;
    walls.push({
      detectionId: measured.id, page: response.page, basis: 'OBSERVED', confidence: measured.reviewRequired ? 0.6 : Math.max(0.5, Math.min(0.95, Number(source.confidence) || 0.8)),
      evidence: `Position, length and ${measured.measuredThicknessMm} mm thickness measured from the sheet linework; ${source.category} classification from the plan reading (${source.detectionId}).${measured.reviewRequired ? ` ${measured.reviewReason}` : ''}`,
      nodes: measured.nodes.map(toNormal), category: source.category, thicknessMm, exteriorType: 'Other', ...classification,
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
    report.review.push(`A ${Math.round(candidate.lengthMm / 100) / 10} m single-face line follows the manual outer footprint on sheet ${response.page}; verify it is a wall before measuring.`);
  }
  for (const segment of modelSegments) {
    const lengthM = lengthPx(segment) / pixelsPerMm / 1000;
    report.modelWallLm += lengthM;
    report.modelWallWithoutLineworkLm += lengthM * (1 - shareAlong(segment, measuredSegments, mm(options.supportReachMm), mm(100)));
  }
  if (report.uncategorisedLm >= 0.5) report.review.push(`${report.uncategorisedLm.toFixed(1)} m of wall linework on this sheet was not classified as external or internal by the plan reading and was not added. Trace or classify it on the plan.`);
  if (report.modelWallWithoutLineworkLm >= 0.5) report.review.push(`${report.modelWallWithoutLineworkLm.toFixed(1)} m of wall reported by the plan reading has no matching wall linework and was not added.`);

  // ---- Openings: on the confirmed gap they explain, else on the nearest measured wall --------
  const emitted = new Map(walls.map((wall) => [wall.lineworkWallId, wall]));
  const emittedSegments = segmentsOf(geometry.walls.filter((wall) => emitted.has(wall.id)));
  const gapByRef = new Map(geometry.openings.filter((gap) => gap.confirmed && gap.evidenceRef).map((gap) => [gap.evidenceRef, gap]));
  report.gaps.confirmed = geometry.openings.filter((gap) => gap.confirmed).length;
  report.gaps.unconfirmed = geometry.openings.length - report.gaps.confirmed;
  const placed = [];
  for (const { item, index, at } of modelOpenings) {
    if (!at) { placed.push({ item, wallId: null, at: null }); report.openings.unplaced += 1; continue; }
    const gap = gapByRef.get(`model:${index}`);
    if (gap) {
      report.openings.onConfirmedGap += 1;
      const hosted = gap.hostWallId && emitted.has(gap.hostWallId);
      placed.push({ wallId: hosted ? gap.hostWallId : null, at: { x: gap.x, y: gap.y }, item: { ...item, ...toNormal(gap), hostDetectionId: hosted ? gap.hostWallId : null, lineworkGapId: gap.id, measuredGapMm: gap.widthMm,
        evidence: `${item.evidence || ''} Positioned on a ${gap.widthMm} mm gap measured in the wall linework.`.trim() } });
      continue;
    }
    const host = emittedSegments.map((segment) => ({ segment, ...project(at, segment.a, segment.b) })).filter((entry) => entry.distance <= mm(options.hostReachMm)).sort((a, b) => a.distance - b.distance)[0];
    if (host) {
      report.openings.onNearestWall += 1;
      placed.push({ wallId: host.segment.wall.id, at: { x: host.x, y: host.y }, item: { ...item, ...toNormal(host), hostDetectionId: host.segment.wall.id,
        // The wall is measured; where along it the opening sits is still the plan reading's estimate.
        confidence: Math.min(Number(item.confidence) || 0, 0.7), positionBasis: 'plan-reading',
        evidence: `${item.evidence || ''} Attached to the nearest measured wall (${Math.round(host.distance / pixelsPerMm)} mm from the reported position); its position along the wall needs checking.`.trim() } });
      continue;
    }
    report.openings.unplaced += 1;
    placed.push({ wallId: null, at, item: { ...item, hostDetectionId: null } });
  }
  // The same opening reported twice (overlapping readings) is one opening: same kind, same wall, same place.
  const openings = [];
  for (const entry of placed.sort((a, b) => (Number(b.item.confidence) || 0) - (Number(a.item.confidence) || 0))) {
    const twin = entry.wallId && entry.at && openings.find((kept) => kept.wallId === entry.wallId && kept.item.openingClass === entry.item.openingClass
      && Math.hypot(kept.at.x - entry.at.x, kept.at.y - entry.at.y) <= mm(options.duplicateMm));
    if (twin) {
      report.openings.duplicatesRemoved += 1;
      // Keep whatever the dropped reading knew that the kept one did not (a size code, a tag).
      for (const key of ['sizeCode', 'tag', 'explicitWidthMm', 'explicitHeightMm', 'subType']) if ((twin.item[key] === null || twin.item[key] === undefined || twin.item[key] === '') && entry.item[key]) twin.item[key] = entry.item[key];
      continue;
    }
    openings.push(entry);
  }
  const nearestWallNote = report.openings.onNearestWall;
  if (nearestWallNote) report.review.push(`${nearestWallNote} opening${nearestWallNote === 1 ? ' is' : 's are'} attached to a measured wall but positioned from the plan reading; check where each sits along its wall.`);
  if (report.openings.unplaced) report.review.push(`${report.openings.unplaced} opening${report.openings.unplaced === 1 ? '' : 's'} could not be placed on any measured wall.`);
  if (report.gaps.unconfirmed) report.review.push(`${report.gaps.unconfirmed} gap${report.gaps.unconfirmed === 1 ? '' : 's'} in the wall linework ${report.gaps.unconfirmed === 1 ? 'is' : 'are'} not confirmed as a door or window; walls stop at ${report.gaps.unconfirmed === 1 ? 'it' : 'them'}.`);

  // ---- Rooms: a named room takes a verified measured boundary when exactly one name sits in it
  const verified = geometry.rooms.filter((room) => room.verified);
  report.rooms.verified = verified.length;
  report.rooms.proposed = geometry.rooms.length - verified.length;
  const labelled = (response.rooms || []).map((room) => ({ room, at: Number.isFinite(room?.x) && Number.isFinite(room?.y) ? toPixels(room) : null }));
  const rooms = labelled.map(({ room, at }) => {
    const space = at && verified.find((candidate) => pointInPolygon(at, candidate.polygon));
    if (!space || labelled.filter((other) => other.at && pointInPolygon(other.at, space.polygon)).length !== 1) return room;
    report.rooms.adopted += 1;
    return { ...room, polygon: space.polygon.map(toNormal), boundaryClosed: !space.reviewRequired, lineworkRoomId: space.id,
      evidence: `${room.evidence || ''} Boundary measured from the wall linework.`.trim() };
  });

  return { response: { ...response, walls, openings: openings.map((entry) => entry.item), rooms, review: [...(response.review || []), ...report.review] }, geometry, report };
}
