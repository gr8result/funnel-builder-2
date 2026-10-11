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
import { detectPlanGeometry, pointInPolygon } from './planGeometry.js';

const CONTRACT_THICKNESSES = [70, 90, 100, 110, 140, 150, 200, 230, 270, 300, 350];
const nearest = (value, list) => list.reduce((best, item) => (Math.abs(item - value) < Math.abs(best - value) ? item : best));
const CLASSIFICATION_FIELDS = ['constructionSystem', 'frameThicknessMm', 'exteriorFinish', 'exteriorFinishCustomLabel', 'customSystemLabel', 'wallHeightM'];

export const FUSION_DEFAULTS = {
  categoryReachMm: 1500,   // how far a model wall trace may be from the wall it classifies
  supportReachMm: 600,     // a model wall trace this close to linework is "the same wall"
  minimumClassificationShare: 0.35, // at least 35% of a measured run needs aligned AI trace
  hostReachMm: 1200,       // an opening with no gap of its own is put on the nearest wall this close
  modelOpeningReachMm: 2000, // the plan reading locates an opening only roughly: it may be this far from the gap or frame it is
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
    for (;;) {
      let least = Infinity, index = -1;
      for (let i = 0; i < points.length; i += 1) { const d = offLine(points, i); if (d < least) { least = d; index = i; } }
      if (index < 0 || least > allowed || points.length <= 4) break;
      points = points.filter((_, i) => i !== index);
    }
    if (points.length <= limit) return points;
  }
}
// What kind of space a printed room name is, as far as its size goes: a wet area, robe or store is
// never a 20 m² space and a bedroom or living room is never a cupboard. Outdoor areas are not
// enclosed by walls at all.
function roomSizeClass(name = '') {
  const text = String(name).toLowerCase();
  if (/\b(alfresco|patio|balcony|porch|verandah|veranda|deck|terrace|courtyard|portico)\b/.test(text)) return 'outdoor';
  if (/\b(ens|ensuite|bath|bathroom|wc|toilet|pwd|powder|ldry|laundry|l'dry|pan|pantry|robe|wir|linen|store|storage|cupboard|cpd|broom)\b/.test(text)) return 'small';
  if (/\b(bed|bedroom|master|rumpus|media|theatre|family|living|lounge|dining|meals|kitchen|garage|study|office|w\/shop|workshop|foyer|entry|games|retreat|sitting)\b/.test(text)) return 'large';
  return 'any';
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
const DOOR_LEAVES = [520, 620, 720, 770, 820, 870, 920, 1020, 1200];
// What the plan reading says an opening is, for matching it to a gap (door) or a frame drawn in a wall (window).
const openingKind = (item) => (item?.type === 'window' && item?.openingClass === 'Window' ? 'window' : ['Internal Door', 'External Door', 'Garage Door'].includes(item?.openingClass) ? 'door' : undefined);
const openingWidth = (item) => [item?.explicitWidthMm, item?.widthMm].map(Number).find((value) => value > 0) || 0;

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
    ...modelOpenings.filter((entry) => entry.at).map((entry) => ({ ...entry.at, ref: `model:${entry.index}`, reachMm: options.modelOpeningReachMm, kind: openingKind(entry.item), widthMm: openingWidth(entry.item) })),
    ...(existing.placedOpenings || []).filter((item) => Number.isFinite(item?.x) && Number.isFinite(item?.y)).map((item) => ({ x: item.x, y: item.y, ref: `placed:${item.id}` })),
  ];
  const geometry = detectPlanGeometry(raster, { pixelsPerMm, logicalWidth, logicalHeight, openingEvidence: evidence }, overrides.geometry || {});
  const report = { engine: geometry.engine, measuredWalls: geometry.walls.length, wallsEmitted: 0, uncategorisedLm: 0, categoryFromLineworkOnlyLm: 0, categoryDisagreementLm: 0, flaggedWalls: 0, modelWallLm: 0, modelWallWithoutLineworkLm: 0,
    openings: { model: modelOpenings.length, onConfirmedGap: 0, onNearestWall: 0, unplaced: 0, duplicatesRemoved: 0, embeddedSymbolReviewCandidates: 0, fromDoorSwing: 0, fromExternalFrame: 0 },
    gaps: { confirmed: 0, unconfirmed: 0 }, rooms: { verified: 0, proposed: 0, adopted: 0, adoptedByProximity: 0, sharedSpaces: 0, withoutBoundary: 0 }, singleFaceReviewCandidates: [], review: [] };
  if (!geometry.walls.length) {
    // Nothing measurable: the plan reading is passed through untouched and says so.
    report.review.push('No wall linework could be measured on this sheet; wall positions are the plan reading\'s own and need checking.');
    return { response: { ...response, review: [...(response.review || []), ...report.review] }, geometry, report };
  }

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
    report.review.push(`A ${Math.round(candidate.lengthMm / 100) / 10} m single-face line follows the manual outer footprint on sheet ${response.page}; verify it is a wall before measuring.`);
  }
  report.openings.embeddedSymbolReviewCandidates = geometry.embeddedOpeningReviewCandidates?.length || 0;
  for (const candidate of geometry.embeddedOpeningReviewCandidates || []) {
    // A frame the engine already returns as a candidate opening is reported once, as that opening.
    if (geometry.openings.some((opening) => Math.hypot(opening.x - candidate.x, opening.y - candidate.y) <= mm(700))) continue;
    report.review.push(`Possible unclassified opening at ${Math.round(candidate.x)}, ${Math.round(candidate.y)} on sheet ${response.page}: ${candidate.evidence}`);
  }
  for (const segment of modelSegments) {
    const lengthM = lengthPx(segment) / pixelsPerMm / 1000;
    report.modelWallLm += lengthM;
    report.modelWallWithoutLineworkLm += lengthM * (1 - shareAlong(segment, measuredSegments, mm(options.supportReachMm), mm(100)));
  }
  if (report.categoryDisagreementLm >= 0.5) report.review.push(`${report.categoryDisagreementLm.toFixed(1)} m of wall on sheet ${response.page} is external or internal by its position on the drawing where the plan reading had it the other way; the drawing was followed.`);
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
  // Openings the drawing shows on its own evidence, which the plan reading did not locate: a door
  // whose swing is drawn at a gap, and a frame drawn in an external wall. Their class and height
  // are not known from the linework, so each is added for the estimator to confirm.
  const wallById = new Map(geometry.walls.map((wall) => [wall.id, wall]));
  for (const found of geometry.openings) {
    if (found.evidenceRef !== undefined) continue;
    const swing = found.kind === 'wall-gap' && found.basis === 'door-swing';
    const frame = found.kind === 'wall-symbol' && found.inExternalWall && found.widthMm >= options.minFrameOpeningMm;
    if (!swing && !frame) continue;
    const hosted = found.hostWallId && emitted.has(found.hostWallId) ? found.hostWallId : null;
    const external = wallById.get(found.hostWallId)?.category === 'exterior';
    const leaf = swing ? nearest(found.leafMm || found.widthMm, DOOR_LEAVES) : null;
    const widthMm = swing ? (Math.abs(leaf - (found.leafMm || found.widthMm)) <= 60 ? leaf : Math.round((found.leafMm || found.widthMm) / 10) * 10) : Math.round(found.widthMm / 10) * 10;
    if (swing) report.openings.fromDoorSwing += 1; else report.openings.fromExternalFrame += 1;
    placed.push({ wallId: hosted, at: { x: found.x, y: found.y }, fromLinework: true, item: {
      detectionId: `linework:${found.id}`, page: response.page, basis: 'OBSERVED', confidence: swing ? 0.75 : 0.6,
      evidence: swing
        ? `A door swing is drawn at a ${found.widthMm} mm gap in the wall linework; the leaf measures ${found.leafMm} mm. Not located by the plan reading: confirm its type and height.`
        : `A frame ${found.widthMm} mm long is drawn in an external wall. Not located by the plan reading: confirm it is a window or glazed door, and its size.`,
      ...toNormal(found), type: swing ? 'door' : 'window', openingClass: swing ? (external ? 'External Door' : 'Internal Door') : 'Window',
      hostDetectionId: hosted, tag: null, sizeCode: null, explicitWidthMm: null, explicitHeightMm: null, widthMm, heightMm: null,
      dimensionBasis: 'OBSERVED', dimensionEvidence: `Width measured from the sheet linework (${swing ? 'door swing radius' : 'frame length'}).`,
      subType: null, quantity: 1, glassType: 'Unspecified', scheduleGlassType: 'Unspecified',
      lineworkGapId: found.id, measuredGapMm: found.widthMm, positionBasis: 'linework', needsClassification: true,
    } });
  }
  const lineworkOnly = report.openings.fromDoorSwing + report.openings.fromExternalFrame;
  if (lineworkOnly) report.review.push(`${lineworkOnly} opening${lineworkOnly === 1 ? ' was' : 's were'} added from the drawing's own linework (${report.openings.fromDoorSwing} door swing${report.openings.fromDoorSwing === 1 ? '' : 's'}, ${report.openings.fromExternalFrame} frame${report.openings.fromExternalFrame === 1 ? '' : 's'} in external walls) on sheet ${response.page}; confirm each one's type and height.`);
  // The same opening reported twice (overlapping readings) is one opening: same kind, same wall, same place.
  const openings = [];
  for (const entry of placed.sort((a, b) => (a.fromLinework ? 1 : 0) - (b.fromLinework ? 1 : 0) || (Number(b.item.confidence) || 0) - (Number(a.item.confidence) || 0))) {
    const twin = entry.at && openings.find((kept) => kept.at && (entry.fromLinework
      ? Math.hypot(kept.at.x - entry.at.x, kept.at.y - entry.at.y) <= Math.max(mm(options.duplicateMm), mm(entry.item.measuredGapMm || 0) * 0.5)
      : entry.wallId && kept.wallId === entry.wallId && kept.item.openingClass === entry.item.openingClass && Math.hypot(kept.at.x - entry.at.x, kept.at.y - entry.at.y) <= mm(options.duplicateMm)));
    if (twin && entry.fromLinework) { if (entry.item.type === 'door') report.openings.fromDoorSwing -= 1; else report.openings.fromExternalFrame -= 1; continue; }
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
    return !(size === 'small' && space.netAreaM2 > options.smallRoomMaxM2) && !(size === 'large' && space.netAreaM2 < options.largeRoomMinM2);
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
    const reasons = [space.reviewReason, space.verified ? null : null, extra.review].filter(Boolean);
    return { polygon: reduceBoundary(space.polygon, options.maxRoomCorners, mm(25)).map(toNormal), boundaryClosed: Boolean(space.verified) && !space.reviewRequired && !extra.review,
      lineworkRoomId: space.id, lineworkVerified: Boolean(space.verified), lineworkAreaM2: +space.netAreaM2.toFixed(2), ...(reasons.length ? { lineworkReview: reasons.join(' ') } : {}) };
  };
  const rooms = [];
  const shared = new Map();
  for (const entry of labelled) {
    const found = spaceOf.get(entry.index);
    if (!found) { if (entry.at && roomSizeClass(entry.room.name) !== 'outdoor') report.rooms.withoutBoundary += 1; rooms.push(entry.room); continue; }
    const together = labelled.filter((other) => spaceOf.get(other.index)?.space.id === found.space.id);
    if (together.length > 1) {
      // One open space under several names: no wall separates them, so no boundary is invented.
      if (!shared.has(found.space.id)) shared.set(found.space.id, together);
      rooms.push({ ...entry.room, sharedSpaceId: found.space.id, evidence: `${entry.room.evidence || ''} Shares one open space with ${together.filter((other) => other !== entry).map((other) => other.room.name).join(', ')}; no wall separates them on the drawing.`.trim() });
      continue;
    }
    report.rooms.adopted += 1;
    if (found.byProximity) report.rooms.adoptedByProximity += 1;
    rooms.push({ ...entry.room, ...measuredRoom(found.space, found.byProximity ? { review: 'The room name is printed beside this space, not inside it; check it is the right room.' } : {}),
      confidence: found.space.verified && !found.byProximity ? Math.max(Number(entry.room.confidence) || 0, 0.9) : Math.min(Number(entry.room.confidence) || 0.6, 0.7),
      evidence: `${entry.room.evidence || ''} Boundary and ${found.space.netAreaM2.toFixed(2)} m² floor area measured from the wall linework${found.space.verified ? '' : ', closing gaps that are not confirmed as doors or windows'}.`.trim() });
  }
  for (const [spaceId, together] of shared) {
    const space = geometry.rooms.find((candidate) => candidate.id === spaceId);
    const names = together.map((entry) => entry.room.name);
    report.rooms.sharedSpaces += 1;
    rooms.push({ page: response.page, name: names.join(' / ').slice(0, 60), x: Math.min(1, Math.max(0, space.centroid.x / logicalWidth)), y: Math.min(1, Math.max(0, space.centroid.y / logicalHeight)),
      basis: 'OBSERVED', ...measuredRoom(space), confidence: space.verified ? 0.9 : 0.7, openPlanOf: names,
      evidence: `One open space of ${space.netAreaM2.toFixed(2)} m² measured from the wall linework; the drawing names ${names.join(', ')} in it with no wall between them.` });
    report.review.push(`${names.join(', ')} on sheet ${response.page} are one open space of ${space.netAreaM2.toFixed(1)} m² with no wall between them; it is measured as one room. Draw each room's boundary if they are to be measured separately.`);
  }
  if (report.rooms.withoutBoundary) report.review.push(`${report.rooms.withoutBoundary} room name${report.rooms.withoutBoundary === 1 ? '' : 's'} on sheet ${response.page} ${report.rooms.withoutBoundary === 1 ? 'is' : 'are'} not inside any space the wall linework encloses; draw ${report.rooms.withoutBoundary === 1 ? 'its' : 'their'} boundary.`);

  return { response: { ...response, walls, openings: openings.map((entry) => entry.item), rooms,
    openingSymbolReviewCandidates: geometry.embeddedOpeningReviewCandidates || [], review: [...(response.review || []), ...report.review] }, geometry, report };
}
