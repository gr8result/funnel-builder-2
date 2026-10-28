// Plan accuracy: how closely a reading of a floor plan matches a reference traced from that plan.
//
// Everything is in millimetres on the sheet. Walls are compared along their centrelines, sampled
// every few centimetres, so a wall found in two pieces or at a slightly different length is scored
// by how much of it is right rather than pass/fail. Junctions are the points where reference walls
// meet. Openings are paired one-to-one by distance. Rooms are compared by overlap (intersection over
// union) and floor area. Pure functions: no DOM, no files.

export const ACCURACY_DEFAULTS = {
  wallReachMm: 100,       // a reference centreline point is found when a detected centreline runs within this
  wallAngle: 0.17,        // radians (~10 degrees): and in this direction
  sampleMm: 50,
  minMissedRunMm: 200,    // missed or extra stretches shorter than this are not listed
  junctionMergeMm: 5,     // reference wall ends this close are one junction
  junctionReachMm: 150,   // a detected junction this close to a reference junction is that junction
  openingReachMm: 400,    // a detected opening this close to a reference opening is that opening
  roomMatchIou: 0.5,      // a detected room overlapping a reference room this much is that room
  iouStepMm: 25,
};

export function canonicalPlanReading(canonical, rooms, pixelsPerMm) {
  const toMm = point => ({ x: point.x / pixelsPerMm, y: point.y / pixelsPerMm });
  const wallNodes = canonical.completedWallRuns.flatMap(wall => {
    const uniqueNodes = [];
    for (const point of wall.nodes) if (!uniqueNodes.some(other => Math.hypot(point.x - other.x, point.y - other.y) < 0.01)) uniqueNodes.push(point);
    return uniqueNodes.map(point => ({ wallId: wall.id, point }));
  });
  const junctions = [];
  for (const { wallId, point } of wallNodes) {
    let junction = junctions.find(item => Math.hypot(point.x - item.x, point.y - item.y) < 0.01);
    if (!junction) { junction = { ...point, wallIds: new Set() }; junctions.push(junction); }
    junction.wallIds.add(wallId);
  }
  return {
    walls: canonical.completedWallRuns.map(wall => ({ id: wall.ai?.detectionId || wall.id, points: wall.nodes.map(toMm), thicknessMm: wall.thicknessMm, category: wall.category })),
    openings: canonical.placedOpenings.map(opening => ({ id: opening.ai?.detectionId || opening.id, ...toMm(opening), widthMm: opening.widthMm, kind: opening.type, hostWallId: opening.hostWallId })),
    rooms: rooms.map(room => ({ id: room.id, name: room.name, polygon: room.polygon.map(toMm) })),
    junctions: junctions.filter(junction => junction.wallIds.size >= 2)
      .map(junction => ({ ...toMm(junction), walls: junction.wallIds.size })),
  };
}

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const median = (values) => { if (!values.length) return null; const sorted = [...values].sort((a, b) => a - b); const mid = sorted.length >> 1; return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2; };
function project(point, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, lengthSq = dx * dx + dy * dy;
  const raw = lengthSq ? ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq : 0;
  const t = Math.max(0, Math.min(1, raw));
  return { t, raw, distance: Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy)) };
}
const direction = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
const angleOff = (p, q) => { const d = Math.abs(p - q) % Math.PI; return Math.min(d, Math.PI - d); };

// Straight pieces of a list of walls ({ id, points:[...] } or { id, a, b }).
export function wallPieces(walls) {
  return walls.flatMap((wall) => {
    const points = wall.points || [wall.a, wall.b];
    return points.slice(1).map((end, index) => ({ wall, a: points[index], b: end, angle: direction(points[index], end) }));
  });
}

function sampleAlong(pieces, other, options) {
  // For each piece, which samples have a parallel piece of `other` within reach, and which.
  return pieces.map((piece) => {
    const length = dist(piece.a, piece.b);
    const count = Math.max(1, Math.round(length / options.sampleMm));
    const samples = [];
    for (let k = 0; k <= count; k += 1) {
      const t = k / count;
      const point = { x: piece.a.x + (piece.b.x - piece.a.x) * t, y: piece.a.y + (piece.b.y - piece.a.y) * t };
      let best = null;
      for (const candidate of other) {
        if (angleOff(piece.angle, candidate.angle) > options.wallAngle) continue;
        const hit = project(point, candidate.a, candidate.b);
        if (hit.distance <= options.wallReachMm && (!best || hit.distance < best.distance)) best = { candidate, distance: hit.distance };
      }
      samples.push({ point, t, match: best });
    }
    return { piece, length, samples };
  });
}

// Unmatched stretches of a sampled piece, for listing and drawing.
function stretches(sampled, matched, options) {
  const out = [];
  for (const { piece, length, samples } of sampled) {
    let start = null;
    samples.forEach((sample, index) => {
      const hit = matched(sample);
      if (!hit && start === null) start = index;
      if ((hit || index === samples.length - 1) && start !== null) {
        const end = hit ? index - 1 : index;
        const lengthMm = ((samples[end].t - samples[start].t) * length);
        if (lengthMm >= options.minMissedRunMm) out.push({ wallId: piece.wall.id, a: samples[start].point, b: samples[end].point, lengthMm });
        start = null;
      }
    });
  }
  return out;
}

/**
 * @param reference [{ id, a, b, thicknessMm, category }] mm
 * @param detected  [{ id, points|a,b, thicknessMm, category }] mm
 */
export function compareWalls(reference, detected, overrides = {}) {
  const options = { ...ACCURACY_DEFAULTS, ...overrides };
  const referencePieces = wallPieces(reference), detectedPieces = wallPieces(detected);
  const ref = sampleAlong(referencePieces, detectedPieces, options);
  const det = sampleAlong(detectedPieces, referencePieces, options);
  const share = (sampled) => {
    let total = 0, hit = 0;
    for (const { length, samples } of sampled) { const unit = length / samples.length; total += length; hit += samples.filter((sample) => sample.match).length * unit; }
    return { total, hit };
  };
  const recall = share(ref), precision = share(det);
  // Thickness and category, length-weighted over matched reference samples.
  const thicknessErrors = [];
  let categoryChecked = 0, categoryAgreed = 0;
  for (const { piece, length, samples } of ref) {
    const unit = length / samples.length;
    for (const sample of samples) {
      if (!sample.match) continue;
      const found = sample.match.candidate.wall;
      if (Number.isFinite(found.thicknessMm) && Number.isFinite(piece.wall.thicknessMm)) thicknessErrors.push(Math.abs(found.thicknessMm - piece.wall.thicknessMm));
      if (piece.wall.category) { categoryChecked += unit; if (found.category === piece.wall.category) categoryAgreed += unit; }
    }
  }
  const offsets = ref.flatMap(({ samples }) => samples.filter((sample) => sample.match).map((sample) => sample.match.distance));
  // Per wall: a reference wall is missing when under half of it is found; a read wall is false when
  // under half of it lies on a reference wall.
  const perWall = (sampled) => {
    const walls = new Map();
    for (const { piece, length, samples } of sampled) {
      const entry = walls.get(piece.wall.id) || { id: piece.wall.id, total: 0, hit: 0 };
      const unit = length / samples.length;
      entry.total += length; entry.hit += samples.filter((sample) => sample.match).length * unit;
      walls.set(piece.wall.id, entry);
    }
    return [...walls.values()].map((entry) => ({ id: entry.id, lengthMm: entry.total, share: entry.total ? entry.hit / entry.total : 0 }));
  };
  const referenceWalls = perWall(ref), readWalls = perWall(det);
  return {
    referenceLm: recall.total / 1000, foundLm: recall.hit / 1000, recall: recall.total ? recall.hit / recall.total : null,
    detectedLm: precision.total / 1000, supportedLm: precision.hit / 1000, precision: precision.total ? precision.hit / precision.total : null,
    centrelineOffsetMedianMm: median(offsets), thicknessErrorMedianMm: median(thicknessErrors),
    categoryAgreement: categoryChecked ? categoryAgreed / categoryChecked : null,
    referenceWalls: referenceWalls.length, missingWalls: referenceWalls.filter((wall) => wall.share < 0.5).map((wall) => ({ id: wall.id, lengthMm: Math.round(wall.lengthMm), foundShare: wall.share })),
    readWalls: readWalls.length, falseWalls: readWalls.filter((wall) => wall.share < 0.5).map((wall) => ({ id: wall.id, lengthMm: Math.round(wall.lengthMm), supportedShare: wall.share })),
    missed: stretches(ref, (sample) => sample.match, options),
    extra: stretches(det, (sample) => sample.match, options),
  };
}

/** Points where reference walls meet: shared ends (L, X of ends) and ends on another wall (T). */
export function referenceJunctions(reference, overrides = {}) {
  const options = { ...ACCURACY_DEFAULTS, ...overrides };
  const ends = reference.flatMap((wall) => [{ wall, point: wall.a }, { wall, point: wall.b }]);
  const clusters = [];
  for (const end of ends) {
    const cluster = clusters.find((item) => dist(item.point, end.point) <= options.junctionMergeMm);
    if (cluster) cluster.walls.add(end.wall.id); else clusters.push({ point: end.point, walls: new Set([end.wall.id]) });
  }
  for (const cluster of clusters) {
    for (const wall of reference) {
      if (cluster.walls.has(wall.id)) continue;
      const hit = project(cluster.point, wall.a, wall.b);
      if (hit.raw > 0 && hit.raw < 1 && hit.distance <= options.junctionMergeMm) cluster.walls.add(wall.id);
    }
  }
  return clusters.map((cluster) => ({ x: cluster.point.x, y: cluster.point.y, walls: cluster.walls.size }));
}

/**
 * @param reference junctions from referenceJunctions (only those where 2+ walls meet are scored)
 * @param detected  [{ x, y, walls }] detected junction points with the number of walls meeting there
 */
export function compareJunctions(reference, detected, overrides = {}) {
  const options = { ...ACCURACY_DEFAULTS, ...overrides };
  const scored = reference.filter((item) => item.walls >= 2);
  const candidates = detected.filter((item) => item.walls >= 2);
  const errors = [], missed = [];
  for (const junction of scored) {
    const nearest = candidates.reduce((best, item) => { const d = dist(item, junction); return !best || d < best.d ? { item, d } : best; }, null);
    if (nearest && nearest.d <= options.junctionReachMm) errors.push(nearest.d); else missed.push(junction);
  }
  return { reference: scored.length, found: errors.length, share: scored.length ? errors.length / scored.length : null, errorMedianMm: median(errors), missed };
}

/** One-to-one pairing of openings, nearest first. */
export function compareOpenings(reference, detected, overrides = {}) {
  const options = { ...ACCURACY_DEFAULTS, ...overrides };
  const pairs = [];
  for (const r of reference) for (const d of detected) { const distance = dist(r, d); if (distance <= options.openingReachMm) pairs.push({ r, d, distance }); }
  pairs.sort((p, q) => p.distance - q.distance);
  const usedR = new Set(), usedD = new Set(), matched = [];
  for (const pair of pairs) { if (usedR.has(pair.r) || usedD.has(pair.d)) continue; usedR.add(pair.r); usedD.add(pair.d); matched.push(pair); }
  const widthErrors = matched.filter((pair) => pair.r.widthMm > 0 && pair.d.widthMm > 0).map((pair) => Math.abs(pair.d.widthMm - pair.r.widthMm) / pair.r.widthMm);
  return {
    reference: reference.length, detected: detected.length, matched: matched.length,
    recall: reference.length ? matched.length / reference.length : null, precision: detected.length ? matched.length / detected.length : null,
    positionErrorMedianMm: median(matched.map((pair) => pair.distance)), widthErrorMedian: median(widthErrors),
    kindAgreement: matched.length ? matched.filter((pair) => pair.r.kind === pair.d.kind).length / matched.length : null,
    missed: reference.filter((item) => !usedR.has(item)), extra: detected.filter((item) => !usedD.has(item)),
  };
}

export function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
export const polygonAreaM2 = (polygon) => Math.abs(polygon.reduce((sum, p, i) => { const q = polygon[(i + 1) % polygon.length]; return sum + p.x * q.y - q.x * p.y; }, 0)) / 2 / 1e6;
const bounds = (polygon) => ({ x0: Math.min(...polygon.map((p) => p.x)), x1: Math.max(...polygon.map((p) => p.x)), y0: Math.min(...polygon.map((p) => p.y)), y1: Math.max(...polygon.map((p) => p.y)) });

export function polygonIou(first, second, stepMm = ACCURACY_DEFAULTS.iouStepMm) {
  const a = bounds(first), b = bounds(second);
  if (a.x1 < b.x0 || b.x1 < a.x0 || a.y1 < b.y0 || b.y1 < a.y0) return 0;
  const x0 = Math.min(a.x0, b.x0), x1 = Math.max(a.x1, b.x1), y0 = Math.min(a.y0, b.y0), y1 = Math.max(a.y1, b.y1);
  let intersection = 0, union = 0;
  for (let y = y0 + stepMm / 2; y < y1; y += stepMm) for (let x = x0 + stepMm / 2; x < x1; x += stepMm) {
    const inA = pointInPolygon({ x, y }, first), inB = pointInPolygon({ x, y }, second);
    if (inA || inB) union += 1;
    if (inA && inB) intersection += 1;
  }
  return union ? intersection / union : 0;
}

/**
 * @param reference [{ id, name, polygon }] mm (floor to inner wall faces)
 * @param detected  [{ id, name?, polygon }] mm
 */
export function compareRooms(reference, detected, overrides = {}) {
  const options = { ...ACCURACY_DEFAULTS, ...overrides };
  const rows = reference.map((room) => {
    const scored = detected.map((candidate) => ({ candidate, iou: polygonIou(room.polygon, candidate.polygon, options.iouStepMm) })).sort((p, q) => q.iou - p.iou);
    const best = scored[0];
    const referenceM2 = polygonAreaM2(room.polygon);
    const detectedM2 = best && best.iou > 0 ? polygonAreaM2(best.candidate.polygon) : null;
    return { id: room.id, name: room.name, referenceM2, detectedId: best?.iou > 0 ? best.candidate.id : null, detectedM2, iou: best?.iou || 0,
      areaError: detectedM2 === null ? null : (detectedM2 - referenceM2) / referenceM2, matched: (best?.iou || 0) >= options.roomMatchIou };
  });
  const usedDetected = new Set(rows.filter((row) => row.matched).map((row) => row.detectedId));
  return {
    reference: reference.length, detected: detected.length, matched: rows.filter((row) => row.matched).length,
    recall: reference.length ? rows.filter((row) => row.matched).length / reference.length : null,
    iouMedian: median(rows.map((row) => row.iou)), areaErrorMedianAbs: median(rows.filter((row) => row.matched).map((row) => Math.abs(row.areaError))),
    rows, unmatchedDetected: detected.filter((room) => !usedDetected.has(room.id)).map((room) => ({ id: room.id, areaM2: polygonAreaM2(room.polygon) })),
  };
}
