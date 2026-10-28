// Plan model: the connected wall-and-room geometry of one building level.
//
// Walls are chains of shared nodes. Where walls meet they share a node: an L corner is a node two
// walls end at, a T is a node one wall ends at and another runs through, an X is a node two walls
// run through. Walls may meet at any angle. Moving a node therefore moves every wall that meets
// there, and the rooms around them, because rooms are not stored: a room is a face of the wall
// network (the area a closed ring of walls encloses), and its floor runs to the inner faces of
// those walls. Doors and windows are hosted on a wall at a distance along it.
//
// What the estimator does is kept: a drawn or moved wall is locked, and a detection that was
// deleted or replaced is remembered (a tombstone), so analysing the sheet again never brings it
// back and never adds a second copy of a wall that is already there.
//
// Coordinates are millimetres on the sheet (page logical pixels / the sheet's pixelsPerMm), so
// every level keeps its own scale. Each level is a plain JSON object; every operation returns a
// new level and never changes the one it was given. Pure: no DOM, no network.

export const PLAN_MODEL_SCHEMA = 'gr8-plan-model.v1';

export const PLAN_MODEL_DEFAULTS = {
  snapMm: 60,               // a wall end this close to a node joins it
  joinReachMm: 200,         // a wall end pointing at a wall this far beyond its face meets it: no door is this narrow
  joinAngle: 0.52,          // radians (~30 degrees): ... when the two meet at least this steeply
  collinearJoinMm: 300,     // two wall ends on one line this close are one wall broken (an opening is wider)
  minWallMm: 50,            // shorter pieces are not walls
  collinearAngle: 0.035,    // radians (~2 degrees): walls this close in direction run along one line
  replaceShare: 0.6,        // a drawn wall running along this much of a wall replaces it
  matchAngle: 0.17,         // radians (~10 degrees) for "runs along" when matching detections
  matchReachMm: 100,        // ... beyond half the thicker wall's thickness
  openingReachMm: 300,      // an opening is hosted on a wall whose centreline is this close (beyond half its thickness)
  openingMatchMm: 300,      // two openings of one kind this close are one opening
  minRoomM2: 0.3,           // smaller enclosed faces are wall junction slivers, not rooms
  roomNameShare: 0.5,       // a room keeps its name while it shares this much of its walls with the named one
  healAngle: 0.01,          // a node inside one wall's chain, this straight, is removed when nothing else uses it
};

const EPS = 1e-9;
// A thickness that was given (0 included, for a line with no thickness); 90 mm when none was.
const thicknessOf = (value) => (value === null || value === undefined || !Number.isFinite(Number(value)) ? 90 : Number(value));
const clone = (value) => JSON.parse(JSON.stringify(value));
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
const mul = (p, k) => ({ x: p.x * k, y: p.y * k });
const dot = (p, q) => p.x * q.x + p.y * q.y;
const cross = (p, q) => p.x * q.y - p.y * q.x;
const unit = (p) => { const length = Math.hypot(p.x, p.y) || 1; return { x: p.x / length, y: p.y / length }; };
const angleBetween = (d1, d2) => { const a = Math.abs(Math.atan2(cross(d1, d2), dot(d1, d2))) % Math.PI; return Math.min(a, Math.PI - a); };

function project(point, a, b) {
  const d = sub(b, a), lengthSq = dot(d, d);
  const raw = lengthSq ? dot(sub(point, a), d) / lengthSq : 0;
  const t = Math.max(0, Math.min(1, raw));
  const foot = add(a, mul(d, t));
  return { t, raw, foot, distance: dist(point, foot) };
}

function segmentCrossing(a, b, c, d) {
  const r = sub(b, a), s = sub(d, c), denom = cross(r, s);
  if (Math.abs(denom) < EPS) return null;
  const ca = sub(c, a);
  const t = cross(ca, s) / denom, u = cross(ca, r) / denom;
  if (t <= EPS || t >= 1 - EPS || u <= EPS || u >= 1 - EPS) return null;
  return { t, u, point: add(a, mul(r, t)) };
}

export const shoelace = (polygon) => polygon.reduce((sum, p, i) => { const q = polygon[(i + 1) % polygon.length]; return sum + p.x * q.y - q.x * p.y; }, 0) / 2;

export function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

// ---- Levels ---------------------------------------------------------------------------------

export function createPlanModel() {
  return { schema: PLAN_MODEL_SCHEMA, levels: {} };
}

export function createLevel({ id, name = id, page = null, pixelsPerMm = null } = {}) {
  if (!id) throw new Error('A level needs an id.');
  return { id, name, page, pixelsPerMm, seq: 0, nodes: {}, walls: {}, openings: {}, separators: {}, roomNames: [], tombstones: [] };
}

// Each level is independent: an operation on one never reads or changes another.
export function withLevel(model, levelId, operation) {
  const level = model.levels[levelId];
  if (!level) throw new Error(`No level ${levelId} in the plan model.`);
  const result = operation(level);
  const nextLevel = result?.level || result;
  return { model: { ...model, levels: { ...model.levels, [levelId]: nextLevel } }, result };
}

export function addLevelToModel(model, spec) {
  if (model.levels[spec.id]) throw new Error(`Level ${spec.id} already exists.`);
  return { ...model, levels: { ...model.levels, [spec.id]: createLevel(spec) } };
}

const nextId = (level, prefix) => { level.seq += 1; return `${prefix}${level.seq}`; };

// ---- Reading the network ----------------------------------------------------------------------

export function wallPoints(level, wall) {
  return wall.nodeIds.map((id) => level.nodes[id]);
}

// Every straight piece between two consecutive nodes of a wall (or of a room separator).
export function networkSegments(level, { separators = true } = {}) {
  const list = [];
  for (const wall of Object.values(level.walls)) {
    for (let i = 1; i < wall.nodeIds.length; i += 1) {
      list.push({ owner: wall.id, kind: 'wall', index: i - 1, u: wall.nodeIds[i - 1], v: wall.nodeIds[i], a: level.nodes[wall.nodeIds[i - 1]], b: level.nodes[wall.nodeIds[i]], half: (wall.thicknessMm || 0) / 2 });
    }
  }
  if (separators) for (const separator of Object.values(level.separators)) {
    list.push({ owner: separator.id, kind: 'separator', index: 0, u: separator.nodeIds[0], v: separator.nodeIds[1], a: level.nodes[separator.nodeIds[0]], b: level.nodes[separator.nodeIds[1]], half: 0 });
  }
  return list;
}

function nodeUse(level) {
  const use = new Map();
  const count = (id, owner) => { if (!use.has(id)) use.set(id, new Set()); use.get(id).add(owner); };
  for (const wall of Object.values(level.walls)) wall.nodeIds.forEach((id) => count(id, wall.id));
  for (const separator of Object.values(level.separators)) separator.nodeIds.forEach((id) => count(id, separator.id));
  return use;
}

// Number of wall pieces that leave a node.
function nodeDegree(level, nodeId) {
  let degree = 0;
  for (const wall of Object.values(level.walls)) wall.nodeIds.forEach((id, index) => {
    if (id !== nodeId) return;
    if (index > 0) degree += 1;
    if (index < wall.nodeIds.length - 1) degree += 1;
  });
  for (const separator of Object.values(level.separators)) if (separator.nodeIds.includes(nodeId)) degree += 1;
  return degree;
}

export function wallLengthMm(level, wall) {
  const points = wallPoints(level, wall);
  return points.slice(1).reduce((sum, point, index) => sum + dist(points[index], point), 0);
}

// Length as framed: a wall that ends against another wall running through (a T) stops at that
// wall's face, so half the through wall's thickness comes off that end. Corners (L) and crossings
// (X) are measured to the shared centreline point.
export function wallNetLengthMm(level, wall) {
  let length = wallLengthMm(level, wall);
  for (const endId of [wall.nodeIds[0], wall.nodeIds[wall.nodeIds.length - 1]]) {
    const through = Object.values(level.walls).filter((other) => other.id !== wall.id && other.nodeIds.indexOf(endId) > 0 && other.nodeIds.indexOf(endId) < other.nodeIds.length - 1);
    if (through.length) length -= Math.max(...through.map((other) => other.thicknessMm || 0)) / 2;
  }
  return Math.max(0, length);
}

// A point on a wall at a distance (mm) along it from its first node.
export function pointAlongWall(level, wall, offsetMm) {
  const points = wallPoints(level, wall);
  let remaining = Math.max(0, offsetMm);
  for (let i = 1; i < points.length; i += 1) {
    const length = dist(points[i - 1], points[i]);
    if (remaining <= length || i === points.length - 1) {
      const t = length ? Math.min(1, remaining / length) : 0;
      return { ...add(points[i - 1], mul(sub(points[i], points[i - 1]), t)), direction: unit(sub(points[i], points[i - 1])) };
    }
    remaining -= length;
  }
  return { ...points[0], direction: { x: 1, y: 0 } };
}

// Where a point falls along a wall: distance along it and distance from it.
export function locateOnWall(level, wall, point) {
  const points = wallPoints(level, wall);
  let best = null, before = 0;
  for (let i = 1; i < points.length; i += 1) {
    const hit = project(point, points[i - 1], points[i]);
    const length = dist(points[i - 1], points[i]);
    if (!best || hit.distance < best.distance) best = { offsetMm: before + hit.t * length, distance: hit.distance, foot: hit.foot };
    before += length;
  }
  return best;
}

// ---- Building the network ------------------------------------------------------------------------

function newNode(level, point) {
  const id = nextId(level, 'n');
  level.nodes[id] = { id, x: point.x, y: point.y };
  return id;
}

// Put a node into a wall's chain between two consecutive nodes u and v.
function insertIntoChain(level, ownerId, u, v, nodeId) {
  const owner = level.walls[ownerId] || level.separators[ownerId];
  const chain = owner.nodeIds;
  for (let i = 1; i < chain.length; i += 1) {
    if ((chain[i - 1] === u && chain[i] === v) || (chain[i - 1] === v && chain[i] === u)) { chain.splice(i, 0, nodeId); return true; }
  }
  return false;
}

// How far from a wall's centreline an end may be and still meet it: half the wall's thickness (an
// end stops at the face) plus the snap reach; an end that runs towards the wall at a steep angle
// meets it from further off, since a gap that narrow is never an opening.
function meetReach(segment, endPoint, outward, options) {
  if (!outward) return segment.half + options.snapMm;
  const steep = angleBetween(outward, sub(segment.b, segment.a)) >= options.joinAngle;
  const foot = project(endPoint, segment.a, segment.b).foot;
  const ahead = dot(sub(foot, endPoint), outward) >= 0;
  return segment.half + (steep && ahead ? options.joinReachMm : options.snapMm);
}

// The node a wall end lands on: an existing node within snap reach, else a point on an existing
// wall's centreline (a wall stopping at the face of the wall it meets reaches across to its
// centreline), else a new node. `outward` is the wall's direction travelling out through this end.
function resolveEnd(level, point, options, outward = null) {
  let bestNode = null;
  for (const node of Object.values(level.nodes)) {
    const d = dist(node, point);
    if (d <= options.snapMm && (!bestNode || d < bestNode.d)) bestNode = { id: node.id, d };
  }
  if (bestNode) return bestNode.id;
  let bestSegment = null;
  for (const segment of networkSegments(level)) {
    const hit = project(point, segment.a, segment.b);
    if (hit.raw <= 0 || hit.raw >= 1) continue;
    const reach = meetReach(segment, point, outward, options);
    if (hit.distance <= reach && (!bestSegment || hit.distance < bestSegment.hit.distance)) bestSegment = { segment, hit };
  }
  if (bestSegment) {
    const id = newNode(level, bestSegment.hit.foot);
    insertIntoChain(level, bestSegment.segment.owner, bestSegment.segment.u, bestSegment.segment.v, id);
    return id;
  }
  return newNode(level, point);
}

// Make the network planar: every node lying on a wall piece becomes part of that wall's chain, and
// every crossing of two pieces becomes a shared node (an X). Repeats until nothing changes.
function planarize(level, options) {
  for (let pass = 0; pass < 50; pass += 1) {
    let changed = false;
    const segments = networkSegments(level);
    // Nodes on a piece they are not part of.
    for (const node of Object.values(level.nodes)) {
      for (const segment of segments) {
        if (segment.u === node.id || segment.v === node.id) continue;
        const hit = project(node, segment.a, segment.b);
        if (hit.raw <= EPS || hit.raw >= 1 - EPS || hit.distance > 0.5) continue;
        const owner = level.walls[segment.owner] || level.separators[segment.owner];
        if (owner.nodeIds.includes(node.id)) continue;
        insertIntoChain(level, segment.owner, segment.u, segment.v, node.id);
        changed = true;
        break;
      }
      if (changed) break;
    }
    if (changed) continue;
    // Pieces crossing each other.
    outer: for (let i = 0; i < segments.length; i += 1) for (let j = i + 1; j < segments.length; j += 1) {
      const s = segments[i], t = segments[j];
      if (s.u === t.u || s.u === t.v || s.v === t.u || s.v === t.v) continue;
      const crossing = segmentCrossing(s.a, s.b, t.a, t.b);
      if (!crossing) continue;
      const near = [s.u, s.v, t.u, t.v].map((id) => level.nodes[id]).find((node) => dist(node, crossing.point) <= options.snapMm / 4);
      const id = near ? near.id : newNode(level, crossing.point);
      if (!(level.walls[s.owner] || level.separators[s.owner]).nodeIds.includes(id)) insertIntoChain(level, s.owner, s.u, s.v, id);
      if (!(level.walls[t.owner] || level.separators[t.owner]).nodeIds.includes(id)) insertIntoChain(level, t.owner, t.u, t.v, id);
      changed = true;
      break outer;
    }
    if (!changed) return;
  }
}

// The parts of a straight run [a, b] not already covered by a wall on the same line: a wall drawn
// or detected along an existing wall is that wall, not a second one.
function uncoveredIntervals(level, a, b, half, options) {
  const length = dist(a, b), direction = unit(sub(b, a));
  let intervals = [[0, length]];
  for (const segment of networkSegments(level, { separators: false })) {
    const segmentDirection = unit(sub(segment.b, segment.a));
    if (angleBetween(direction, segmentDirection) > options.collinearAngle) continue;
    const reach = Math.max(half, segment.half, options.snapMm);
    const offset = (point) => Math.abs(cross(direction, sub(point, a)));
    if (offset(segment.a) > reach || offset(segment.b) > reach) continue;
    const s0 = dot(sub(segment.a, a), direction), s1 = dot(sub(segment.b, a), direction);
    const lo = Math.min(s0, s1), hi = Math.max(s0, s1);
    intervals = intervals.flatMap(([from, to]) => {
      if (hi <= from || lo >= to) return [[from, to]];
      const left = lo > from ? [[from, lo]] : [];
      const right = hi < to ? [[hi, to]] : [];
      return [...left, ...right];
    });
  }
  return intervals.filter(([from, to]) => to - from >= options.minWallMm).map(([from, to]) => [add(a, mul(direction, from)), add(a, mul(direction, to))]);
}

function insertWallPiece(level, a, b, spec, options) {
  const half = thicknessOf(spec.thicknessMm) / 2;
  const forward = unit(sub(b, a));
  const start = resolveEnd(level, a, options, mul(forward, -1));
  const end = resolveEnd(level, b, options, forward);
  if (start === end) return null;
  const A = level.nodes[start], B = level.nodes[end];
  // Free wall ends that stop at this wall's face (the stem of a T), or a little short of it, reach
  // across to its centreline.
  for (const node of Object.values(level.nodes)) {
    if (node.id === start || node.id === end || nodeDegree(level, node.id) !== 1) continue;
    const hit = project(node, A, B);
    if (hit.raw <= 0 || hit.raw >= 1) continue;
    const owner = Object.values(level.walls).find((wall) => wall.nodeIds.includes(node.id));
    const index = owner ? owner.nodeIds.indexOf(node.id) : -1;
    const neighbour = owner ? level.nodes[owner.nodeIds[index === 0 ? 1 : index - 1]] : null;
    const outward = neighbour ? unit(sub(node, neighbour)) : null;
    if (hit.distance > meetReach({ a: A, b: B, half }, node, outward, options)) continue;
    level.nodes[node.id] = { ...node, x: hit.foot.x, y: hit.foot.y };
  }
  const id = spec.id && !level.walls[spec.id] ? spec.id : nextId(level, 'w');
  level.walls[id] = {
    id, nodeIds: [start, end], thicknessMm: thicknessOf(spec.thicknessMm),
    category: spec.category || null, categorySource: spec.category ? (spec.source === 'manual' ? 'manual' : 'detected') : null,
    source: spec.source || 'detected', detectionKey: spec.detectionKey || null,
    locked: spec.source === 'manual' || spec.locked === true, edited: false,
    ...(spec.attributes ? { attributes: spec.attributes } : {}),
  };
  planarize(level, options);
  return id;
}

function insertWall(level, spec, options) {
  const a = { x: spec.a.x, y: spec.a.y }, b = { x: spec.b.x, y: spec.b.y };
  if (dist(a, b) < options.minWallMm) return [];
  const half = thicknessOf(spec.thicknessMm) / 2;
  const pieces = uncoveredIntervals(level, a, b, half, options);
  const ids = [];
  pieces.forEach(([p, q], index) => {
    const id = insertWallPiece(level, p, q, { ...spec, id: index === 0 ? spec.id : undefined }, options);
    if (id) ids.push(id);
  });
  return ids;
}

/**
 * Add a wall from a to b (mm). Ends join nodes and walls within reach; crossings become shared
 * nodes; any part already covered by a wall on the same line is not added again.
 * @returns {{ level, wallIds: string[] }}
 */
export function addWall(level, spec, overrides = {}) {
  const options = { ...PLAN_MODEL_DEFAULTS, ...overrides };
  const next = clone(level);
  const wallIds = insertWall(next, spec, options);
  return { level: next, wallIds };
}

// A boundary between two rooms where no wall stands (an open-plan transition or a doorway the
// estimator closes): it bounds rooms but is never a wall quantity.
export function addSeparator(level, { a, b }, overrides = {}) {
  const options = { ...PLAN_MODEL_DEFAULTS, ...overrides };
  const next = clone(level);
  const start = resolveEnd(next, a, options), end = resolveEnd(next, b, options);
  if (start === end) return { level: next, separatorId: null };
  const id = nextId(next, 's');
  next.separators[id] = { id, nodeIds: [start, end], source: 'manual' };
  planarize(next, options);
  return { level: next, separatorId: id };
}

// The direction a wall travels out through its free end node.
function outwardAt(level, nodeId) {
  const owner = Object.values(level.walls).find((wall) => wall.nodeIds[0] === nodeId || wall.nodeIds[wall.nodeIds.length - 1] === nodeId);
  if (!owner) return null;
  const first = owner.nodeIds[0] === nodeId;
  const neighbour = level.nodes[owner.nodeIds[first ? 1 : owner.nodeIds.length - 2]];
  return unit(sub(level.nodes[nodeId], neighbour));
}

function mergeNodeInto(level, fromId, toId) {
  for (const owner of [...Object.values(level.walls), ...Object.values(level.separators)]) {
    owner.nodeIds = owner.nodeIds.map((id) => (id === fromId ? toId : id)).filter((id, index, list) => index === 0 || id !== list[index - 1]);
  }
  for (const [id, wall] of Object.entries(level.walls)) if (wall.nodeIds.length < 2) delete level.walls[id];
  delete level.nodes[fromId];
}

// Free wall ends left where walls plainly meet: two ends on one line a sliver apart become one
// point, and an end that runs into a wall a little short of it reaches its centreline. Gaps the
// width of an opening are never closed.
function joinFreeEnds(level, options) {
  for (let pass = 0; pass < 200; pass += 1) {
    let changed = false;
    const free = Object.keys(level.nodes).filter((id) => nodeDegree(level, id) === 1);
    for (const id of free) {
      const node = level.nodes[id], outward = outwardAt(level, id);
      if (!node || !outward) continue;
      // Collinear partner pointing back at this end.
      const partner = free.filter((other) => other !== id && level.nodes[other]).map((other) => {
        const there = level.nodes[other], back = outwardAt(level, other);
        if (!back || dot(back, outward) > -Math.cos(options.collinearAngle * 3)) return null;
        const gap = dot(sub(there, node), outward), offset = Math.abs(cross(outward, sub(there, node)));
        return gap >= -options.snapMm && gap <= options.collinearJoinMm && offset <= options.snapMm ? { other, gap } : null;
      }).filter(Boolean).sort((p, q) => p.gap - q.gap)[0];
      if (partner) {
        const there = level.nodes[partner.other];
        level.nodes[id] = { id, x: (node.x + there.x) / 2, y: (node.y + there.y) / 2 };
        mergeNodeInto(level, partner.other, id);
        changed = true; break;
      }
      // A corner both walls stop short of: they meet where their centrelines cross.
      const corner = free.filter((other) => other !== id && level.nodes[other]).map((other) => {
        const there = level.nodes[other], back = outwardAt(level, other);
        if (!back || angleBetween(outward, back) < options.joinAngle) return null;
        const denom = cross(outward, back);
        if (Math.abs(denom) < EPS) return null;
        const t = cross(sub(there, node), back) / denom, u = cross(sub(there, node), outward) / denom;
        const point = add(node, mul(outward, t));
        const reach = options.joinReachMm + Math.max(...[id, other].map((nodeId) => Math.max(0, ...Object.values(level.walls).filter((wall) => wall.nodeIds.includes(nodeId)).map((wall) => (wall.thicknessMm || 0) / 2))));
        return t >= -options.snapMm && t <= reach && u >= -options.snapMm && u <= reach ? { other, point, t: Math.abs(t) + Math.abs(u) } : null;
      }).filter(Boolean).sort((p, q) => p.t - q.t)[0];
      if (corner) {
        level.nodes[id] = { id, x: corner.point.x, y: corner.point.y };
        mergeNodeInto(level, corner.other, id);
        changed = true; break;
      }
      // A wall ahead.
      let best = null;
      for (const segment of networkSegments(level)) {
        if (segment.u === id || segment.v === id) continue;
        const hit = project(node, segment.a, segment.b);
        if (hit.raw <= 0 || hit.raw >= 1) continue;
        if (hit.distance > meetReach(segment, node, outward, options)) continue;
        if (dot(sub(hit.foot, node), outward) < -options.snapMm) continue;
        if (!best || hit.distance < best.hit.distance) best = { segment, hit };
      }
      if (best && best.hit.distance > 0.5) {
        level.nodes[id] = { id, x: best.hit.foot.x, y: best.hit.foot.y };
        insertIntoChain(level, best.segment.owner, best.segment.u, best.segment.v, id);
        changed = true; break;
      }
    }
    if (!changed) return;
  }
}

// Remove nodes nothing uses, and straight-through nodes inside a single wall's chain that no other
// wall or opening needs (left behind when the wall that met there was deleted).
function tidy(level, options) {
  const use = nodeUse(level);
  for (const id of Object.keys(level.nodes)) if (!use.has(id)) delete level.nodes[id];
  for (const wall of Object.values(level.walls)) {
    for (let i = wall.nodeIds.length - 2; i >= 1; i -= 1) {
      const id = wall.nodeIds[i];
      if (use.get(id)?.size !== 1) continue;
      const before = level.nodes[wall.nodeIds[i - 1]], here = level.nodes[id], after = level.nodes[wall.nodeIds[i + 1]];
      if (angleBetween(sub(here, before), sub(after, here)) > options.healAngle) continue;
      wall.nodeIds.splice(i, 1);
      delete level.nodes[id];
    }
  }
}

/**
 * Move a node (a corner or junction): every wall through it and every room around it follows.
 * Walls through the node become estimator-edited and are kept as they are by later analysis.
 * Dropped onto another node within snap reach, the two become one junction.
 */
export function moveNode(level, nodeId, point, overrides = {}) {
  const options = { ...PLAN_MODEL_DEFAULTS, ...overrides };
  const next = clone(level);
  if (!next.nodes[nodeId]) throw new Error(`No node ${nodeId}.`);
  next.nodes[nodeId] = { id: nodeId, x: point.x, y: point.y };
  for (const wall of Object.values(next.walls)) if (wall.nodeIds.includes(nodeId)) { wall.edited = true; wall.locked = true; }
  const target = Object.values(next.nodes).find((node) => node.id !== nodeId && dist(node, point) <= options.snapMm);
  if (target) {
    for (const owner of [...Object.values(next.walls), ...Object.values(next.separators)]) {
      owner.nodeIds = owner.nodeIds.map((id) => (id === nodeId ? target.id : id)).filter((id, index, list) => index === 0 || id !== list[index - 1]);
    }
    for (const [id, wall] of Object.entries(next.walls)) if (wall.nodeIds.length < 2) delete next.walls[id];
    delete next.nodes[nodeId];
  }
  planarize(next, options);
  tidy(next, options);
  return next;
}

// ---- Openings -------------------------------------------------------------------------------------

function nearestWall(level, point, options, filter = () => true) {
  let best = null;
  for (const wall of Object.values(level.walls)) {
    if (!filter(wall)) continue;
    const hit = locateOnWall(level, wall, point);
    if (!hit) continue;
    const reach = (wall.thicknessMm || 0) / 2 + options.openingReachMm;
    if (hit.distance <= reach && (!best || hit.distance < best.hit.distance)) best = { wall, hit };
  }
  return best;
}

function placeOpening(level, spec, options) {
  const detectedHost = spec.hostWallDetectionKey && Object.values(level.walls).find((wall) => wall.detectionKey === spec.hostWallDetectionKey
    || (wall.absorbedKeys || []).includes(spec.hostWallDetectionKey));
  if (spec.hostWallDetectionKey && !detectedHost) return null;
  const explicitHost = spec.wallId && level.walls[spec.wallId] ? level.walls[spec.wallId] : detectedHost;
  const host = explicitHost
    ? { wall: explicitHost, hit: locateOnWall(level, explicitHost, spec) }
    : nearestWall(level, spec, options);
  if (!host) return null;
  const id = spec.id && !level.openings[spec.id] ? spec.id : nextId(level, 'o');
  level.openings[id] = {
    id, wallId: host.wall.id, offsetMm: host.hit.offsetMm, widthMm: spec.widthMm || 820, kind: spec.kind || 'door',
    source: spec.source || 'detected', detectionKey: spec.detectionKey || null, locked: spec.source === 'manual' || spec.locked === true,
    ...(spec.attributes ? { attributes: spec.attributes } : {}),
  };
  return id;
}

/**
 * Put a door or window on its wall: the given wall, else the wall whose centreline is nearest
 * (within half its thickness plus openingReachMm). Stored as a distance along that wall.
 * @returns {{ level, openingId: string|null }}
 */
export function addOpening(level, spec, overrides = {}) {
  const options = { ...PLAN_MODEL_DEFAULTS, ...overrides };
  const next = clone(level);
  const openingId = placeOpening(next, spec, options);
  return { level: next, openingId };
}

export function openingPosition(level, opening) {
  const wall = level.walls[opening.wallId];
  if (!wall) return null;
  const length = wallLengthMm(level, wall);
  return pointAlongWall(level, wall, Math.min(opening.offsetMm, length));
}

// ---- Deleting and replacing -------------------------------------------------------------------------

function tombstoneFor(level, wall, reason) {
  const points = wallPoints(level, wall);
  return { kind: 'wall', reason, detectionKey: wall.detectionKey, absorbedKeys: wall.absorbedKeys || [], a: { x: points[0].x, y: points[0].y }, b: { x: points[points.length - 1].x, y: points[points.length - 1].y }, thicknessMm: wall.thicknessMm };
}

function removeWall(level, wallId, reason, options, { keepOpenings = false } = {}) {
  const wall = level.walls[wallId];
  if (!wall) return [];
  if (wall.source !== 'manual') level.tombstones.push(tombstoneFor(level, wall, reason));
  const hosted = Object.values(level.openings).filter((opening) => opening.wallId === wallId);
  const positions = hosted.map((opening) => ({ opening, at: openingPosition(level, opening) }));
  for (const opening of hosted) {
    delete level.openings[opening.id];
    if (!keepOpenings && opening.source !== 'manual') {
      const at = positions.find((item) => item.opening === opening).at;
      level.tombstones.push({ kind: 'opening', reason: 'host-deleted', detectionKey: opening.detectionKey, x: at.x, y: at.y, widthMm: opening.widthMm, openingKind: opening.kind });
    }
  }
  delete level.walls[wallId];
  tidy(level, options);
  return positions;
}

/**
 * Delete a wall. A detected wall is remembered as rejected so later analysis does not add it
 * again; its detected openings go with it.
 */
export function deleteWall(level, wallId, { reason = 'deleted' } = {}, overrides = {}) {
  const options = { ...PLAN_MODEL_DEFAULTS, ...overrides };
  const next = clone(level);
  removeWall(next, wallId, reason, options);
  return next;
}

export function deleteOpening(level, openingId, { reason = 'deleted' } = {}) {
  const next = clone(level);
  const opening = next.openings[openingId];
  if (!opening) return next;
  if (opening.source !== 'manual') {
    const at = openingPosition(next, opening);
    next.tombstones.push({ kind: 'opening', reason, detectionKey: opening.detectionKey, x: at.x, y: at.y, widthMm: opening.widthMm, openingKind: opening.kind });
  }
  delete next.openings[openingId];
  return next;
}

// Share of run [a, b] lying along (parallel to, within reach of) any of the given segments.
function shareAlong(a, b, half, segments, options) {
  const length = dist(a, b);
  if (!length) return 0;
  const direction = unit(sub(b, a));
  const parts = Math.max(4, Math.ceil(length / 50));
  let along = 0;
  for (let k = 0; k <= parts; k += 1) {
    const point = add(a, mul(sub(b, a), k / parts));
    if (segments.some((segment) => angleBetween(direction, sub(segment.b, segment.a)) <= options.matchAngle
      && project(point, segment.a, segment.b).distance <= Math.max(half, segment.half) + options.matchReachMm)) along += 1;
  }
  return along / (parts + 1);
}

/**
 * The estimator draws a wall. Any wall it runs along for most of that wall's length is the wrong
 * version of it: that wall is replaced (remembered as rejected if it was detected) and its doors
 * and windows move onto the drawn wall. The drawn wall is locked.
 * @returns {{ level, wallIds: string[], replacedIds: string[] }}
 */
export function drawWall(level, spec, overrides = {}) {
  const options = { ...PLAN_MODEL_DEFAULTS, ...overrides };
  const next = clone(level);
  const half = thicknessOf(spec.thicknessMm) / 2;
  const drawn = [{ a: spec.a, b: spec.b, half }];
  const replacedIds = Object.values(next.walls).filter((wall) => {
    const points = wallPoints(next, wall);
    return shareAlong(points[0], points[points.length - 1], (wall.thicknessMm || 0) / 2, drawn, options) >= options.replaceShare;
  }).map((wall) => wall.id);
  const carried = replacedIds.flatMap((id) => removeWall(next, id, 'replaced', options, { keepOpenings: true }));
  const wallIds = insertWall(next, { ...spec, source: 'manual' }, options);
  joinFreeEnds(next, options);
  planarize(next, options);
  for (const { opening, at } of carried) {
    if (!at) continue;
    placeOpening(next, { ...opening, id: opening.id, x: at.x, y: at.y, wallId: undefined }, { ...options, openingReachMm: options.openingReachMm + half });
  }
  return { level: next, wallIds, replacedIds };
}

function isTombstonedWall(level, detection, options) {
  return level.tombstones.some((stone) => {
    if (stone.kind !== 'wall') return false;
    if (detection.detectionKey && (stone.detectionKey === detection.detectionKey || (stone.absorbedKeys || []).includes(detection.detectionKey))) return true;
    const half = Math.max(thicknessOf(detection.thicknessMm), thicknessOf(stone.thicknessMm)) / 2;
    // A detection lying mostly along a rejected wall is that wall (or a piece of it) again.
    return shareAlong(detection.a, detection.b, half, [{ a: stone.a, b: stone.b, half }], options) >= options.replaceShare;
  });
}

function isTombstonedOpening(level, detection, options) {
  return level.tombstones.some((stone) => stone.kind === 'opening'
    && ((detection.detectionKey && stone.detectionKey === detection.detectionKey)
      || (dist(stone, detection) <= options.openingMatchMm && (!stone.openingKind || !detection.kind || stone.openingKind === detection.kind))));
}

// A detection already covered by a wall is recorded on that wall, so deleting the wall rejects the
// detection too (it would otherwise come back as soon as the wall covering it was gone).
function absorb(level, detection, segments, options) {
  if (!detection.detectionKey) return null;
  const half = thicknessOf(detection.thicknessMm) / 2;
  let best = null;
  for (const wall of Object.values(level.walls)) {
    const own = segments.filter((segment) => segment.owner === wall.id);
    const share = shareAlong(detection.a, detection.b, half, own, options);
    if (share > 0 && (!best || share > best.share)) best = { wall, share };
  }
  if (best && !(best.wall.absorbedKeys || []).includes(detection.detectionKey)) best.wall.absorbedKeys = [...(best.wall.absorbedKeys || []), detection.detectionKey];
  return best ? { modelWallId: best.wall.id, share: best.share } : null;
}

/**
 * Bring an analysis result into the level without undoing the estimator's work.
 *   - a detection that was deleted or replaced before is not added again;
 *   - a wall already in the level (same detection key, or running along an existing wall) is not
 *     added twice, and walls the estimator drew or edited are never changed;
 *   - only what is new is added, joined into the network.
 * @param detections {{ walls?: [{a,b,thicknessMm,category,detectionKey}], openings?: [{x,y,widthMm,kind,detectionKey}], rooms?: [{x,y,name}] }} in mm
 * @returns {{ level, report }}
 */
export function mergeDetections(level, detections = {}, overrides = {}) {
  const options = { ...PLAN_MODEL_DEFAULTS, ...overrides };
  const next = clone(level);
  const report = { wallsAdded: 0, wallsAlreadyPresent: 0, wallsRejectedBefore: 0, wallOutcomes: [], openingsAdded: 0, openingsAlreadyPresent: 0, openingsRejectedBefore: 0, openingsWithoutWall: 0, roomsNamed: 0 };
  for (const detection of detections.walls || []) {
    const outcome = { detectionKey: detection.detectionKey || '', status: '', modelWallIds: [], reason: '' };
    if (isTombstonedWall(next, detection, options)) {
      report.wallsRejectedBefore += 1;
      outcome.status = 'rejected-before'; outcome.reason = 'Matches a user-deleted or replaced wall tombstone.';
      report.wallOutcomes.push(outcome); continue;
    }
    const sameDetectionOwners = detection.detectionKey ? Object.values(next.walls).filter((wall) => wall.detectionKey === detection.detectionKey || (wall.absorbedKeys || []).includes(detection.detectionKey)) : [];
    if (sameDetectionOwners.length) {
      report.wallsAlreadyPresent += 1;
      outcome.status = 'already-present'; outcome.modelWallIds = sameDetectionOwners.map((wall) => wall.id);
      outcome.reason = 'Detection key is already owned or absorbed by the connected model.';
      report.wallOutcomes.push(outcome); continue;
    }
    const half = thicknessOf(detection.thicknessMm) / 2;
    const segments = networkSegments(next, { separators: false });
    const existingShare = shareAlong(detection.a, detection.b, half, segments, options);
    if (existingShare >= options.replaceShare) {
      const owner = absorb(next, detection, segments, options);
      report.wallsAlreadyPresent += 1;
      outcome.status = 'merged-or-covered'; outcome.modelWallIds = owner ? [owner.modelWallId] : [];
      outcome.reason = `At least ${(options.replaceShare * 100).toFixed(0)}% overlaps an existing wall in the connected model (observed ${Math.round(existingShare * 100)}%).`;
      report.wallOutcomes.push(outcome); continue;
    }
    const ids = insertWall(next, { ...detection, source: 'detected' }, options);
    if (ids.length) {
      report.wallsAdded += 1;
      outcome.status = 'inserted'; outcome.modelWallIds = ids;
      outcome.reason = 'At least one uncovered wall interval met the model minimum and was inserted.';
    } else {
      const owner = absorb(next, detection, segments, options);
      report.wallsAlreadyPresent += 1;
      outcome.status = owner ? 'merged-or-covered' : 'not-inserted'; outcome.modelWallIds = owner ? [owner.modelWallId] : [];
      outcome.reason = owner
        ? 'Uncovered intervals were below the model minimum; geometry is absorbed by the best existing wall.'
        : 'No uncovered interval met the model minimum wall length.';
    }
    report.wallOutcomes.push(outcome);
  }
  for (const detection of detections.openings || []) {
    if (isTombstonedOpening(next, detection, options)) { report.openingsRejectedBefore += 1; continue; }
    const present = Object.values(next.openings).some((opening) => (detection.detectionKey && opening.detectionKey === detection.detectionKey)
      || (opening.kind === (detection.kind || 'door') && dist(openingPosition(next, opening), detection) <= options.openingMatchMm));
    if (present) { report.openingsAlreadyPresent += 1; continue; }
    if (placeOpening(next, { ...detection, source: 'detected' }, options)) report.openingsAdded += 1; else report.openingsWithoutWall += 1;
  }
  joinFreeEnds(next, options);
  planarize(next, options);
  if (detections.rooms?.length) {
    const rooms = computeRooms(next, options);
    for (const label of detections.rooms) {
      const room = rooms.find((item) => pointInPolygon(label, item.boundary));
      if (!room || room.nameSource === 'manual') continue;
      if (room.name) continue;
      next.roomNames.push({ id: nextId(next, 'r'), wallIds: room.wallIds, name: label.name, source: 'detected' });
      report.roomsNamed += 1;
    }
  }
  return { level: next, report };
}

// ---- Rooms ------------------------------------------------------------------------------------------

// Faces of the wall network. Pieces that lead nowhere (a nib, a free wall end) bound no room and are
// left out; every other piece has a room or the outside on each side.
function networkFaces(level) {
  const segments = networkSegments(level);
  const edges = new Map();
  for (const segment of segments) {
    const key = segment.u < segment.v ? `${segment.u}|${segment.v}` : `${segment.v}|${segment.u}`;
    if (!edges.has(key)) edges.set(key, segment);
  }
  const adjacency = new Map();
  const link = (p, q) => { if (!adjacency.has(p)) adjacency.set(p, new Set()); adjacency.get(p).add(q); };
  for (const segment of edges.values()) { link(segment.u, segment.v); link(segment.v, segment.u); }
  // Prune dangling pieces.
  let pruned = true;
  while (pruned) {
    pruned = false;
    for (const [id, neighbours] of adjacency) {
      if (neighbours.size > 1) continue;
      for (const other of neighbours) adjacency.get(other)?.delete(id);
      adjacency.delete(id);
      pruned = true;
    }
  }
  const sorted = new Map();
  for (const [id, neighbours] of adjacency) {
    const here = level.nodes[id];
    sorted.set(id, [...neighbours].sort((p, q) => Math.atan2(level.nodes[p].y - here.y, level.nodes[p].x - here.x) - Math.atan2(level.nodes[q].y - here.y, level.nodes[q].x - here.x)));
  }
  const visited = new Set();
  const faces = [];
  for (const [start, neighbours] of sorted) for (const first of neighbours) {
    if (visited.has(`${start}>${first}`)) continue;
    const cycle = [];
    let u = start, v = first;
    for (let guard = 0; guard < 100000; guard += 1) {
      visited.add(`${u}>${v}`);
      cycle.push(u);
      const around = sorted.get(v);
      const index = around.indexOf(u);
      const w = around[(index - 1 + around.length) % around.length];
      u = v; v = w;
      if (u === start && v === first) break;
    }
    const polygon = cycle.map((id) => level.nodes[id]);
    faces.push({ nodeIds: cycle, signedArea: shoelace(polygon) });
  }
  return { faces, edges };
}

// With pieces turned through in this order, a bounded face is traced with positive signed area
// in sheet coordinates (y down); the outside of each connected network comes out negative.
const BOUNDED_SIGN = 1;

function edgeOf(edges, p, q) {
  return edges.get(p < q ? `${p}|${q}` : `${q}|${p}`);
}

// The floor of a face: each edge moved inwards by half the thickness of the wall it is, corners
// where the moved edges meet.
function floorPolygon(level, nodeIds, edges) {
  const points = nodeIds.map((id) => level.nodes[id]);
  const n = points.length;
  const lines = points.map((point, i) => {
    const next = points[(i + 1) % n];
    const direction = unit(sub(next, point));
    const edge = edgeOf(edges, nodeIds[i], nodeIds[(i + 1) % n]);
    // One side of travel; which side is inside is checked once below against the face itself.
    const inward = { x: -direction.y, y: direction.x };
    return { point, direction, half: edge?.half || 0, inward };
  });
  // Confirm the inward side once against the face itself.
  const probeLine = lines.reduce((best, line, i) => { const length = dist(line.point, points[(i + 1) % n]); return !best || length > best.length ? { line, length, i } : best; }, null);
  const probe = add(add(probeLine.line.point, mul(sub(points[(probeLine.i + 1) % n], probeLine.line.point), 0.5)), mul(probeLine.line.inward, 1));
  const flip = pointInPolygon(probe, points) ? 1 : -1;
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const previous = lines[(i - 1 + n) % n], current = lines[i];
    const p0 = add(previous.point, mul(previous.inward, flip * previous.half));
    const p1 = add(current.point, mul(current.inward, flip * current.half));
    const denom = cross(previous.direction, current.direction);
    if (Math.abs(denom) < 1e-6) {
      out.push(add(points[i], mul(previous.inward, flip * previous.half)));
      if (Math.abs(previous.half - current.half) > 1e-6) out.push(add(points[i], mul(current.inward, flip * current.half)));
      continue;
    }
    const t = cross(sub(p1, p0), current.direction) / denom;
    const corner = add(p0, mul(previous.direction, t));
    if (dist(corner, points[i]) > 10 * Math.max(previous.half, current.half, 1)) {
      out.push(add(points[i], mul(previous.inward, flip * previous.half)), add(points[i], mul(current.inward, flip * current.half)));
    } else out.push(corner);
  }
  return out;
}

const signatureOf = (wallIds) => [...wallIds].sort().join(',');
function jaccard(first, second) {
  const a = new Set(first), b = new Set(second);
  const shared = [...a].filter((id) => b.has(id)).length;
  return shared / (new Set([...a, ...b]).size || 1);
}

/**
 * The rooms of a level: every face the connected walls (and separators) enclose.
 * @returns {Array<{ id, name, nameSource, wallIds, separatorIds, nodeIds, boundary, floor, areaM2, perimeterM }>}
 *   boundary runs along wall centrelines; floor runs along the inner wall faces and gives the area.
 */
export function computeRooms(level, overrides = {}) {
  const options = { ...PLAN_MODEL_DEFAULTS, ...overrides };
  const { faces, edges } = networkFaces(level);
  const rooms = [];
  for (const face of faces) {
    if (Math.sign(face.signedArea) !== BOUNDED_SIGN) continue;
    const owners = face.nodeIds.map((id, i) => edgeOf(edges, id, face.nodeIds[(i + 1) % face.nodeIds.length]));
    const wallIds = [...new Set(owners.filter((edge) => edge?.kind === 'wall').map((edge) => edge.owner))];
    const separatorIds = [...new Set(owners.filter((edge) => edge?.kind === 'separator').map((edge) => edge.owner))];
    const boundary = face.nodeIds.map((id) => ({ x: level.nodes[id].x, y: level.nodes[id].y }));
    const floor = floorPolygon(level, face.nodeIds, edges);
    const areaM2 = Math.abs(shoelace(floor)) / 1e6;
    if (areaM2 < options.minRoomM2) continue;
    const perimeterM = floor.reduce((sum, point, i) => sum + dist(point, floor[(i + 1) % floor.length]), 0) / 1000;
    rooms.push({ wallIds, separatorIds, nodeIds: face.nodeIds, boundary, floor, areaM2, perimeterM });
  }
  // Names follow walls: a name stays with the room that shares most of the walls it was given with.
  const taken = new Set();
  for (const label of level.roomNames) {
    let best = null;
    rooms.forEach((room, index) => {
      if (taken.has(index)) return;
      const score = jaccard(label.wallIds, room.wallIds);
      if (score >= options.roomNameShare && (!best || score > best.score)) best = { index, score };
    });
    if (best) { taken.add(best.index); Object.assign(rooms[best.index], { name: label.name, nameSource: label.source, labelId: label.id }); }
  }
  return rooms.map((room) => ({ id: room.labelId ? `room:${room.labelId}` : `face:${signatureOf([...room.wallIds, ...room.separatorIds])}`, name: room.name || null, nameSource: room.nameSource || null, ...room }));
}

/** Name the room containing a point (mm). An estimator's name is never replaced by analysis. */
export function nameRoomAt(level, point, name, { source = 'manual' } = {}, overrides = {}) {
  const next = clone(level);
  const room = computeRooms(next, overrides).find((item) => pointInPolygon(point, item.boundary));
  if (!room) return { level: next, named: false };
  next.roomNames = next.roomNames.filter((label) => jaccard(label.wallIds, room.wallIds) < 0.99);
  next.roomNames.push({ id: nextId(next, 'r'), wallIds: room.wallIds, name, source });
  return { level: next, named: true };
}

/**
 * External or internal for every wall. The estimator's choice wins; otherwise a wall on the
 * outside boundary of a closed network is external and every other wall in it internal. A wall
 * not part of a closed ring keeps its explicit detection category. Otherwise it is internal
 * only when every interval of its measured run lies strictly within bounded faces; an
 * unenclosed fragment remains unclassified.
 */
export function wallCategories(level) {
  const { faces, edges } = networkFaces(level);
  const outside = new Set(), enclosed = new Set();
  for (const face of faces) {
    const owners = face.nodeIds.map((id, i) => edgeOf(edges, id, face.nodeIds[(i + 1) % face.nodeIds.length])).filter((edge) => edge?.kind === 'wall').map((edge) => edge.owner);
    for (const id of owners) (Math.sign(face.signedArea) === BOUNDED_SIGN ? enclosed : outside).add(id);
  }
  const bounded = faces.filter(face => Math.sign(face.signedArea) === BOUNDED_SIGN
    && Math.abs(face.signedArea) >= PLAN_MODEL_DEFAULTS.minRoomM2 * 1e6)
    .map(face => face.nodeIds.map(id => level.nodes[id]));
  return Object.fromEntries(Object.values(level.walls).map((wall) => {
    if (wall.categorySource === 'manual' || wall.categorySource === 'plan-evidence') return [wall.id, wall.category];
    if (outside.has(wall.id)) return [wall.id, 'exterior'];
    if (enclosed.has(wall.id)) return [wall.id, 'interior'];
    if (wall.category) return [wall.id, wall.category];
    // A partition need not itself close a room. A measured wall wholly inside
    // an existing bounded face is internal even when one or both ends are free.
    // Test every interval between boundary crossings: endpoints or a midpoint
    // alone would misclassify a wall that exits a concave face and re-enters it.
    const points = wallPoints(level, wall);
    const inside = points.length >= 2 && points.slice(1).every((b, i) => {
      const a = points[i], direction = sub(b, a);
      if (dist(a, b) < EPS) return false;
      const cuts = [0, 1];
      for (const polygon of bounded) for (let j = 0; j < polygon.length; j += 1) {
        const c = polygon[j], d = polygon[(j + 1) % polygon.length], edge = sub(d, c);
        const denom = cross(direction, edge);
        if (Math.abs(denom) < EPS) continue;
        const delta = sub(c, a), t = cross(delta, edge) / denom, u = cross(delta, direction) / denom;
        if (t > EPS && t < 1 - EPS && u >= -EPS && u <= 1 + EPS) cuts.push(t);
      }
      cuts.sort((x, y) => x - y);
      return cuts.slice(1).every((t, k) => {
        if (t - cuts[k] < EPS) return true;
        const point = add(a, mul(direction, (t + cuts[k]) / 2));
        return bounded.some(polygon => pointInPolygon(point, polygon)
          && polygon.every((c, j) => project(point, c, polygon[(j + 1) % polygon.length]).distance > 1e-4));
      });
    });
    return [wall.id, inside ? 'interior' : null];
  }));
}

/** Set a wall's thickness or category by hand; the wall becomes locked. */
/**
 * Walls the closed-face rule cannot classify, but whose own geometry shows they are internal: the wall
 * stands wholly inside the outer boundary traced around the connected network, and at least one end
 * meets another wall. Only the measured network is read; nothing outside the drawing is consulted.
 * @returns {Map<string, { evidence: string }>} wall id -> why it is internal
 */
export function inferInteriorWalls(level, categories, { reachMm = 150 } = {}) {
  const { faces } = networkFaces(level);
  const outside = faces.filter((face) => Math.sign(face.signedArea) !== BOUNDED_SIGN)
    .sort((a, b) => Math.abs(b.signedArea) - Math.abs(a.signedArea))[0];
  const inferred = new Map();
  if (!outside || outside.nodeIds.length < 3) return inferred;
  const envelope = outside.nodeIds.map((id) => level.nodes[id]);
  const walls = Object.values(level.walls);
  for (const wall of walls) {
    if (categories[wall.id] || wall.categorySource === 'manual') continue;
    const points = wallPoints(level, wall);
    const a = points[0], b = points[points.length - 1];
    const length = dist(a, b);
    if (length < PLAN_MODEL_DEFAULTS.minWallMm) continue;
    const inside = [0.2, 0.5, 0.8].every((t) => pointInPolygon(add(a, mul(sub(b, a), t)), envelope));
    if (!inside) continue;
    const reach = Math.max(reachMm, (wall.thicknessMm || 0) * 1.5);
    const meets = (end) => walls.some((other) => {
      if (other.id === wall.id) return false;
      const otherPoints = wallPoints(level, other);
      return project(end, otherPoints[0], otherPoints[otherPoints.length - 1]).distance <= reach;
    });
    if (!meets(a) && !meets(b)) continue;
    inferred.set(wall.id, { evidence: 'Stands wholly inside the outer wall boundary and meets other measured walls; classified internal from the drawing\'s own geometry.' });
  }
  return inferred;
}

export function updateWall(level, wallId, changes = {}) {
  const next = clone(level);
  const wall = next.walls[wallId];
  if (!wall) throw new Error(`No wall ${wallId}.`);
  if (changes.thicknessMm > 0) wall.thicknessMm = changes.thicknessMm;
  if (changes.category) { wall.category = changes.category; wall.categorySource = 'manual'; }
  wall.edited = true; wall.locked = true;
  return next;
}

/** A summary of a level for reports and tests. */
export function describeLevel(level) {
  const rooms = computeRooms(level);
  const categories = wallCategories(level);
  const walls = Object.values(level.walls);
  const degree = (id) => nodeDegree(level, id);
  const ends = walls.flatMap((wall) => [wall.nodeIds[0], wall.nodeIds[wall.nodeIds.length - 1]]);
  return {
    walls: walls.length, nodes: Object.keys(level.nodes).length, openings: Object.keys(level.openings).length, rooms: rooms.length,
    freeEnds: ends.filter((id) => degree(id) === 1).length, wallEnds: ends.length,
    exteriorLm: walls.filter((wall) => categories[wall.id] === 'exterior').reduce((sum, wall) => sum + wallLengthMm(level, wall), 0) / 1000,
    interiorLm: walls.filter((wall) => categories[wall.id] === 'interior').reduce((sum, wall) => sum + wallLengthMm(level, wall), 0) / 1000,
    floorM2: rooms.reduce((sum, room) => sum + room.areaM2, 0), tombstones: level.tombstones.length,
  };
}
