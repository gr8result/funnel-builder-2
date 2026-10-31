// Linework engine output -> plan model level.
//
// The engine measures walls between their own ends, so a doorway is a gap: two wall pieces on one
// line with nothing between them. In the plan model a wall runs through its doors and windows (they
// are hosted on it), so a gap the drawing confirms as an opening (a door swing, a door line, glazing)
// is bridged with wall of the host's thickness and the opening is placed on it. A gap nothing confirms
// is left open: it may be a passage, and closing it would invent a room boundary.
// Coordinates: the engine's logical plan pixels in, millimetres (pixels / pixelsPerMm) out.
import { computeRooms, createLevel, deleteWall, updateWall, mergeDetections, openingPosition, wallCategories, wallPoints } from './planModel.js';

const toMm = (point, pixelsPerMm) => ({ x: point.x / pixelsPerMm, y: point.y / pixelsPerMm });

// One canonical opening detection for a measured opening on a wall of the given class.
function openingDetection({ id, kind, modelKind, widthMm, x, y, evidence, hostDetectionId, category }) {
  const type = kind === 'window' ? 'window' : 'door';
  const openingClass = type === 'window' ? 'Window'
    : modelKind === 'garage-door' ? 'Garage Door'
      : modelKind === 'sliding-door' ? 'Large Glazed/Stacker/Sliding Door'
        : category === 'interior' ? 'Internal Door' : 'External Door';
  const subType = ({ 'cavity-slider': 'Cavity Sliding Door', 'barn-door': 'Barn Door', 'sliding-door': 'Stacker/Sliding Door', 'garage-door': 'Garage Door' })[modelKind] || openingClass;
  return { detectionId: id, type, openingClass, ...(hostDetectionId ? { hostDetectionId } : {}), x, y, widthMm, subType, basis: 'OBSERVED', confidence: 0.8, evidence };
}

/**
 * The detections that accepting one review wall adds, once the estimator has classified it.
 * The wall and the openings hosted on it enter together, so quantities never count one without the other.
 * @returns {{ walls: object[], openings: object[] }} a plan-analysis response fragment (normalised coordinates)
 */
export function reviewCandidateResponse(candidate, openingCandidates, category) {
  if (!['interior', 'exterior'].includes(category)) throw new Error('A review wall is accepted as interior or exterior.');
  if (!candidate?.normalizedNodes?.length) throw new Error('This review wall carries no measured geometry.');
  const detectionId = `review-accepted-${candidate.id}`;
  return {
    walls: [{ detectionId, category, nodes: candidate.normalizedNodes, thicknessMm: candidate.thicknessMm, alignment: 'center', basis: 'OBSERVED', confidence: 0.85,
      evidence: `Measured wall geometry on sheet ${candidate.page}; classified ${category} by the estimator.` }],
    openings: (openingCandidates || []).filter((item) => item.hostModelWallId === candidate.modelWallId).map((item) => openingDetection({
      id: `review-accepted-${item.id}`, kind: item.openingKind, modelKind: item.modelKind, widthMm: item.widthMm, x: item.normalizedPoint.x, y: item.normalizedPoint.y,
      evidence: item.evidence || `Opening evidence measured on sheet ${item.page}.`, hostDetectionId: detectionId, category })),
  };
}

// True when most of a review wall already lies along one of the given polylines ([{x,y}] in logical px),
// within `reachPx` of it: it is that wall again (accepted, drawn by hand, or rejected earlier).
export function reviewWallCovered(candidate, polylines, reachPx, share = 0.6) {
  const points = candidate.nodes || [];
  if (points.length < 2) return false;
  const a = points[0], b = points[points.length - 1];
  const distance = (p, u, v) => {
    const dx = v.x - u.x, dy = v.y - u.y;
    const t = Math.max(0, Math.min(1, ((p.x - u.x) * dx + (p.y - u.y) * dy) / ((dx * dx + dy * dy) || 1)));
    return Math.hypot(p.x - u.x - t * dx, p.y - u.y - t * dy);
  };
  const steps = 12;
  let near = 0;
  for (let k = 0; k <= steps; k += 1) {
    const p = { x: a.x + (b.x - a.x) * k / steps, y: a.y + (b.y - a.y) * k / steps };
    if (polylines.some((line) => line.some((point, i) => i > 0 && distance(p, line[i - 1], point) <= reachPx))) near += 1;
  }
  return near / (steps + 1) >= share;
}

/**
 * Rooms as the closed faces of the walls now on the sheet (drawn, accepted or corrected by hand),
 * with the room names read from the plan. Same record shape as the vector run's own rooms.
 * @param runs   canvas wall runs [{ nodes:[{x,y}] logical px, thicknessMm, category }] for this sheet
 * @param labels [{ name, x, y }] logical px
 */
export function roomsFromWallRuns(runs, spec, labels = []) {
  const ppm = spec.pixelsPerMm;
  if (!(ppm > 0)) throw new Error('A sheet scale (pixelsPerMm) is needed to measure rooms.');
  const walls = runs.filter((run) => run.nodes?.length >= 2).flatMap((run, index) => run.nodes.slice(1).map((node, i) => ({
    a: toMm(run.nodes[i], ppm), b: toMm(node, ppm), thicknessMm: Math.round(run.thicknessMm || 90),
    category: run.category === 'exterior' ? 'exterior' : 'interior', detectionKey: `wall-run:${index}:${i}`,
  })));
  const { level } = mergeDetections(createLevel(spec), { walls, rooms: labels.map((label) => ({ ...toMm(label, ppm), name: label.name })) });
  const slug = (value) => String(value).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60);
  return computeRooms(level).map((room) => {
    const polygon = room.floor.map((point) => ({ x: point.x * ppm / spec.logicalWidth, y: point.y * ppm / spec.logicalHeight }));
    const centre = polygon.reduce((sum, point) => ({ x: sum.x + point.x / polygon.length, y: sum.y + point.y / polygon.length }), { x: 0, y: 0 });
    const id = `corrected-room-${spec.page}-${slug(room.id)}`;
    return { id, lineworkRoomId: id, name: room.name || `Unlabelled room ${slug(room.id).slice(-6)}`, polygon, ...centre, basis: 'OBSERVED', confidence: 0.8,
      confirmed: false, boundaryClosed: true, geometryReview: 'Confirm this room boundary and assign its plan label.',
      evidence: 'Boundary is a closed face of the walls now on this sheet.' };
  }).filter((room) => room.polygon.length >= 3);
}

// Door types the vector detector names; all are doors for quantities, the type is kept as an attribute.
const DOOR_TYPES = new Set(['door', 'cavity-slider', 'sliding-door', 'garage-door', 'barn-door']);

// What a measured opening is.
export function openingKindOf(found) {
  if (found.kind === 'window') return 'window';
  if (DOOR_TYPES.has(found.kind)) return 'door';
  if (found.kind === 'opening') return 'opening';
  if (found.kind === 'wall-symbol') return 'window';
  if (/glaz/i.test(String(found.basis || '')) || found.glazed) return 'window';
  return found.confirmed === false ? 'opening' : 'door';
}

/**
 * @param geometry engine/fusion geometry ({ walls:[{id,nodes,measuredThicknessMm,category}], openings:[{id,x,y,axis,widthMm,hostThicknessMm,kind,confirmed}] })
 * @param spec     { id, name, page, pixelsPerMm } the level (pixelsPerMm is the sheet's logical px per mm)
 * @param options  { level } an existing level to merge into (estimator edits and rejections are kept); { labels } room names [{x,y,name}] in logical px;
 *                 { bridgeUnconfirmedMaxMm } also bridge gaps nothing confirms, up to this width (0 = never): the wall line
 *                 continues across them and the opening is listed as an unconfirmed 'opening' for review
 * @returns {{ level, report }}
 */
export function levelFromLinework(geometry, spec, { level = null, labels = [], bridgeUnconfirmedMaxMm = 0 } = {}) {
  const ppm = spec.pixelsPerMm;
  if (!(ppm > 0)) throw new Error('A sheet scale (pixelsPerMm) is needed to build the plan model.');
  const walls = (geometry.walls || []).filter((wall) => Array.isArray(wall.nodes) && wall.nodes.length >= 2).map((wall) => ({
    a: toMm(wall.nodes[0], ppm), b: toMm(wall.nodes[wall.nodes.length - 1], ppm),
    thicknessMm: Math.round(wall.measuredThicknessMm || wall.thicknessMm || 90), category: wall.category === 'exterior' ? 'exterior' : wall.category === 'interior' ? 'interior' : null,
    detectionKey: `linework:${wall.id}`,
  }));
  const bridges = [], openings = [];
  for (const found of geometry.openings || []) {
    if (!Number.isFinite(found.x) || !Number.isFinite(found.y)) continue;
    const centre = toMm(found, ppm);
    const kind = openingKindOf(found);
    const bridge = found.confirmed !== false || (bridgeUnconfirmedMaxMm > 0 && found.widthMm <= bridgeUnconfirmedMaxMm);
    const direction = found.direction || (found.axis === 'h' ? { x: 1, y: 0 } : found.axis === 'v' ? { x: 0, y: 1 } : null);
    const bridged = bridge && direction && found.widthMm > 0 && !found.inWall;
    if (bridged) {
      const bridgeCentre = Number.isFinite(found.bridgeX) && Number.isFinite(found.bridgeY)
        ? toMm({ x: found.bridgeX, y: found.bridgeY }, ppm) : centre;
      const half = (found.bridgeWidthMm || found.widthMm) / 2 + 30;
      const a = { x: bridgeCentre.x - direction.x * half, y: bridgeCentre.y - direction.y * half };
      const b = { x: bridgeCentre.x + direction.x * half, y: bridgeCentre.y + direction.y * half };
      bridges.push({ a, b, thicknessMm: Math.round(found.hostThicknessMm || 90), detectionKey: `linework-bridge:${found.id}`, attributes: { spansOpening: true } });
    }
    if (!bridge || found.bridgeOnly) continue;
    const hostWallDetectionKey = bridged ? `linework-bridge:${found.id}` : found.hostWallIds?.[0] ? `linework:${found.hostWallIds[0]}` : null;
    openings.push({ ...centre, widthMm: Math.round(found.leafMm || found.widthMm || 0), kind, detectionKey: `linework-opening:${found.id}`,
      ...(hostWallDetectionKey ? { hostWallDetectionKey } : {}),
      attributes: { ...(found.needsClassification ? { needsClassification: true } : {}), ...(found.confirmed === false ? { unconfirmed: true } : {}), ...(found.kind && found.kind !== kind ? { type: found.kind } : {}), ...(found.evidence ? { evidence: found.evidence } : {}) } });
  }
  const base = level || createLevel(spec);
  const merged = mergeDetections(base, { walls: [...walls, ...bridges], openings, rooms: labels.map((label) => ({ ...toMm(label, ppm), name: label.name })) });
  return { level: merged.level, report: { ...merged.report, bridges: bridges.length, measuredWalls: walls.length } };
}

export function vectorAnalysisFromLinework(geometry, spec, { labels = [], wallDecisions = {}, classifications = {} } = {}) {
  const built = levelFromLinework(geometry, spec, { labels });
  let level = built.level;
  const report = built.report;
  for (const wall of Object.values(level.walls)) {
    const entry = classifications[wall.detectionKey];
    if (entry && ['interior', 'exterior'].includes(entry.category)) {
      wall.category = entry.category; wall.categorySource = 'plan-evidence';
    }
  }
  // Only explicit estimator choices may promote a measured review wall. Stable
  // detection keys retain the choice when model indices change on a later run.
  for (const wall of Object.values(level.walls)) {
    const keys = [wall.detectionKey, ...(wall.absorbedKeys || [])].filter(Boolean);
    const choices = [...new Set(keys.map(key => wallDecisions[key]).filter(Boolean))];
    if (choices.length !== 1) continue; // conflicting choices still need review
    if (choices[0] === 'reject') level = deleteWall(level, wall.id);
    else if (['interior', 'exterior'].includes(choices[0])) level = updateWall(level, wall.id, { category: choices[0] });
  }
  const categories = wallCategories(level);
  const detectionIds = new Map();
  const wallLineage = [];
  const reviewWallCandidates = Object.values(level.walls).flatMap((wall) => {
    const category = categories[wall.id];
    if (wall.detectionKey?.startsWith('linework-bridge:')) return [];
    if (category === 'exterior' || category === 'interior') return [];
    return [{
      id: `review-wall-${wall.id}`,
      modelWallId: wall.id,
      detectionKey: wall.detectionKey || null,
      absorbedKeys: wall.absorbedKeys || [],
      page: spec.page,
      nodes: wallPoints(level, wall).map((point) => ({ x: point.x * spec.pixelsPerMm, y: point.y * spec.pixelsPerMm })),
      normalizedNodes: wallPoints(level, wall).map((point) => ({ x: point.x * spec.pixelsPerMm / spec.logicalWidth, y: point.y * spec.pixelsPerMm / spec.logicalHeight })),
      thicknessMm: wall.thicknessMm,
      category: null,
      status: 'review-required',
      reason: 'Measured connected wall geometry has no closed-face evidence to establish internal or external classification.',
    }];
  });
  const reviewBridgeCandidates = Object.values(level.walls).flatMap((wall) => {
    const category = categories[wall.id];
    if (!wall.detectionKey?.startsWith('linework-bridge:') || category === 'exterior' || category === 'interior') return [];
    return [{
      id: `review-bridge-${wall.id}`,
      modelWallId: wall.id,
      detectionKey: wall.detectionKey,
      page: spec.page,
      nodes: wallPoints(level, wall).map((point) => ({ x: point.x * spec.pixelsPerMm, y: point.y * spec.pixelsPerMm })),
      thicknessMm: wall.thicknessMm,
      category: null,
      status: 'review-required',
      reason: 'Confirmed-opening topology span has no closed-face evidence to establish internal or external classification; it is excluded from wall quantities.',
    }];
  });
  const walls = Object.values(level.walls).flatMap((wall, index) => {
    const category = categories[wall.id];
    if (!['exterior', 'interior'].includes(category)) return [];
    const detectionId = `vector-wall-${index + 1}`;
    detectionIds.set(wall.id, detectionId);
    wallLineage.push({ modelWallId: wall.id, detectionKey: wall.detectionKey || null,
      absorbedKeys: wall.absorbedKeys || [], detectionId, category, reviewed: wall.categorySource === 'manual' });
    return [{
      detectionId,
      category,
      nodes: wallPoints(level, wall).map((point) => ({ x: point.x * spec.pixelsPerMm / spec.logicalWidth, y: point.y * spec.pixelsPerMm / spec.logicalHeight })),
      thicknessMm: wall.thicknessMm,
      alignment: 'center',
      basis: 'OBSERVED',
      confidence: 0.85,
      evidence: `Paired vector wall faces and connected junctions measured on sheet ${spec.page}.`,
    }];
  });
  const reviewOpeningCandidates = [];
  const openings = Object.values(level.openings).flatMap((opening) => {
    const position = openingPosition(level, opening);
    const wall = level.walls[opening.wallId];
    if (!position || !wall) return [];
    const hostCategory = categories[wall.id];
    if (!['exterior', 'interior'].includes(hostCategory)) {
      reviewOpeningCandidates.push({
        id: `review-opening-${wall.id}-${opening.detectionKey || opening.id}`,
        page: spec.page,
        nodes: [{ x: position.x * spec.pixelsPerMm, y: position.y * spec.pixelsPerMm }],
        normalizedPoint: { x: position.x * spec.pixelsPerMm / spec.logicalWidth, y: position.y * spec.pixelsPerMm / spec.logicalHeight },
        widthMm: opening.widthMm,
        openingKind: opening.kind,
        modelKind: opening.attributes?.type || opening.kind,
        evidence: opening.attributes?.evidence || null,
        hostModelWallId: wall.id,
        hostDetectionKey: wall.detectionKey || null,
        status: 'review-required',
        reason: 'Measured opening is attached to a wall with unresolved internal/external classification; it is excluded from quantities.',
      });
      return [];
    }
    const hostDetectionId = detectionIds.get(wall.id);
    const modelKind = opening.attributes?.type || opening.kind;
    const type = opening.kind === 'window' ? 'window' : 'door';
    const openingClass = opening.kind === 'opening' ? 'Other Opening' : type === 'window' ? 'Window'
      : modelKind === 'garage-door' ? 'Garage Door'
        : modelKind === 'sliding-door' ? 'Large Glazed/Stacker/Sliding Door'
          : categories[wall.id] === 'interior' ? 'Internal Door' : 'External Door';
    const subtype = ({ 'cavity-slider': 'Cavity Sliding Door', 'barn-door': 'Barn Door', 'sliding-door': 'Stacker/Sliding Door', 'garage-door': 'Garage Door' })[modelKind] || openingClass;
    return [{
      detectionId: `vector-opening-${opening.detectionKey || opening.id}`,
      type,
      openingClass,
      ...(hostDetectionId ? { hostDetectionId } : {}),
      x: position.x * spec.pixelsPerMm / spec.logicalWidth,
      y: position.y * spec.pixelsPerMm / spec.logicalHeight,
      widthMm: opening.widthMm,
      ...(opening.attributes?.needsClassification ? { needsClassification: true } : {}),
      dimensionBasis: 'DERIVED',
      dimensionEvidence: `Opening width measured from calibrated linework on sheet ${spec.page}.`,
      subType: subtype,
      basis: 'OBSERVED',
      confidence: 0.8,
      evidence: opening.attributes?.evidence || `Opening evidence measured on sheet ${spec.page}.`,
    }];
  });
  const rooms = computeRooms(level).map((room, index) => {
    const polygon = room.floor.map((point) => ({ x: point.x * spec.pixelsPerMm / spec.logicalWidth, y: point.y * spec.pixelsPerMm / spec.logicalHeight }));
    const centre = polygon.reduce((sum, point) => ({ x: sum.x + point.x / polygon.length, y: sum.y + point.y / polygon.length }), { x: 0, y: 0 });
    return {
      id: `vector-room-${spec.page}-${index + 1}`,
      lineworkRoomId: `vector-room-${spec.page}-${index + 1}`,
      name: room.name || `Unlabelled room ${index + 1}`,
      polygon,
      ...centre,
      basis: 'OBSERVED',
      confidence: 0.8,
      confirmed: false,
      boundaryClosed: true,
      geometryReview: 'Confirm this room boundary and assign its plan label.',
      evidence: 'Boundary is a closed face of the connected vector wall model.',
    };
  }).filter((room) => room.polygon.length >= 3);
  return {
    level,
    response: { page: spec.page, level: spec.name || 'Unassigned', drawingType: 'floor_plan', walls, openings },
    rooms,
    wallLineage,
    reviewWallCandidates,
    reviewBridgeCandidates,
    reviewOpeningCandidates,
    report: { ...report,
      unclassifiedWalls: reviewWallCandidates.length,
      unclassifiedBridges: Object.values(level.walls).filter((wall) => wall.detectionKey?.startsWith('linework-bridge:') && !['exterior', 'interior'].includes(categories[wall.id])).length,
      openingsOnUnclassifiedWalls: reviewOpeningCandidates.length,
      openingsNeedingClassification: openings.filter(opening => opening.needsClassification).length,
    },
  };
}
