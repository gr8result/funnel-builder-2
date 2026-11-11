// The building outline from measured geometry, not from the plan reading's rough rectangle.
//
// Every indoor room is measured to the faces of its walls. The building is those rooms, the walls
// between them, and the walls round them out to their outer face, with door and window gaps closed.
// Walls further than a wall's thickness from any room (retaining walls, fences, a walled undercroft)
// are not building. The result is one closed outline per building, in millimetres. Rooms must be on
// one sheet in one coordinate space.

export const OUTLINE_DEFAULTS = {
  cellMm: 40,          // grid the outline is found on
  wallReachMm: 400,    // walls within this of a room belong to the building
  closeMm: 160,        // gaps narrower than twice this (door and window gaps, wall joints) are closed
  minComponentM2: 4,   // separate pieces smaller than this are not a building
  simplifyMm: 30,
};

const shoelace = (polygon) => polygon.reduce((sum, p, i) => { const q = polygon[(i + 1) % polygon.length]; return sum + p.x * q.y - q.x * p.y; }, 0) / 2;

function fillPolygon(grid, polygon, toCell) {
  const { width, height, data } = grid;
  const pts = polygon.map(toCell);
  let y0 = Infinity, y1 = -Infinity;
  for (const p of pts) { y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
  for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(height - 1, Math.ceil(y1)); y += 1) {
    const cy = y + 0.5, xs = [];
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[i], b = pts[j];
      if ((a.y > cy) !== (b.y > cy)) xs.push(a.x + (cy - a.y) * (b.x - a.x) / (b.y - a.y));
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.max(0, Math.ceil(xs[k] - 0.5)); x <= Math.min(width - 1, Math.floor(xs[k + 1] - 0.5)); x += 1) data[y * width + x] = 1;
    }
  }
}

// Square-structuring-element dilation / erosion by r cells (separable).
function morph(grid, r, grow) {
  if (r <= 0) return grid;
  const { width, height } = grid;
  const pass = (src, horizontal) => {
    const out = new Uint8Array(src.length);
    for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
      let v = grow ? 0 : 1;
      for (let d = -r; d <= r; d += 1) {
        const xx = horizontal ? x + d : x, yy = horizontal ? y : y + d;
        const inside = xx >= 0 && yy >= 0 && xx < width && yy < height ? src[yy * width + xx] : 0;
        if (grow && inside) { v = 1; break; }
        if (!grow && !inside) { v = 0; break; }
      }
      out[y * width + x] = v;
    }
    return out;
  };
  return { width, height, data: pass(pass(grid.data, true), false) };
}

function fillHoles(grid) {
  const { width, height, data } = grid;
  const outside = new Uint8Array(data.length);
  const stack = [];
  for (let x = 0; x < width; x += 1) { stack.push(x, (height - 1) * width + x); }
  for (let y = 0; y < height; y += 1) { stack.push(y * width, y * width + width - 1); }
  while (stack.length) {
    const p = stack.pop();
    if (outside[p] || data[p]) continue;
    outside[p] = 1;
    const x = p % width, y = (p - x) / width;
    if (x > 0) stack.push(p - 1); if (x < width - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - width); if (y < height - 1) stack.push(p + width);
  }
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i += 1) out[i] = outside[i] ? 0 : 1;
  return { width, height, data: out };
}

function components(grid) {
  const { width, height, data } = grid;
  const label = new Int32Array(data.length);
  const list = [];
  for (let start = 0; start < data.length; start += 1) {
    if (!data[start] || label[start]) continue;
    const id = list.length + 1, cells = [];
    const stack = [start]; label[start] = id;
    while (stack.length) {
      const p = stack.pop(); cells.push(p);
      const x = p % width, y = (p - x) / width;
      for (const q of [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, y > 0 ? p - width : -1, y < height - 1 ? p + width : -1]) {
        if (q >= 0 && data[q] && !label[q]) { label[q] = id; stack.push(q); }
      }
    }
    list.push({ id, cells });
  }
  return { label, list };
}

// Outer boundary of one labelled component, as cell-corner points (cell units), counter-clockwise.
function traceOuter(label, width, height, id) {
  const inside = (x, y) => x >= 0 && y >= 0 && x < width && y < height && label[y * width + x] === id;
  const edges = new Map();
  const add = (ax, ay, bx, by) => { edges.set(`${ax},${ay}`, [...(edges.get(`${ax},${ay}`) || []), { bx, by }]); };
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    if (!inside(x, y)) continue;
    if (!inside(x, y - 1)) add(x, y, x + 1, y);
    if (!inside(x + 1, y)) add(x + 1, y, x + 1, y + 1);
    if (!inside(x, y + 1)) add(x + 1, y + 1, x, y + 1);
    if (!inside(x - 1, y)) add(x, y + 1, x, y);
  }
  const loops = [];
  while (edges.size) {
    const [key] = edges.keys();
    const [sx, sy] = key.split(',').map(Number);
    const loop = [{ x: sx, y: sy }];
    let cx = sx, cy = sy, guard = 0;
    while (guard++ < 4e6) {
      const k = `${cx},${cy}`; const out = edges.get(k);
      if (!out?.length) break;
      const next = out.shift(); if (!out.length) edges.delete(k);
      cx = next.bx; cy = next.by;
      if (cx === sx && cy === sy) break;
      loop.push({ x: cx, y: cy });
    }
    loops.push(loop);
  }
  return loops.sort((a, b) => Math.abs(shoelace(b)) - Math.abs(shoelace(a)))[0] || [];
}

function simplify(points, tolerance) {
  if (points.length < 4) return points;
  const rdp = (pts) => {
    if (pts.length < 3) return pts;
    const a = pts[0], b = pts[pts.length - 1];
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    let worst = 0, index = 0;
    for (let i = 1; i < pts.length - 1; i += 1) {
      const d = Math.abs((b.x - a.x) * (a.y - pts[i].y) - (a.x - pts[i].x) * (b.y - a.y)) / length;
      if (d > worst) { worst = d; index = i; }
    }
    return worst > tolerance ? [...rdp(pts.slice(0, index + 1)).slice(0, -1), ...rdp(pts.slice(index))] : [a, b];
  };
  // Split the ring at its two furthest-apart points so both halves simplify.
  let far = 0;
  for (let i = 1; i < points.length; i += 1) if (Math.hypot(points[i].x - points[0].x, points[i].y - points[0].y) > Math.hypot(points[far].x - points[0].x, points[far].y - points[0].y)) far = i;
  const first = rdp(points.slice(0, far + 1)), second = rdp([...points.slice(far), points[0]]);
  return [...first.slice(0, -1), ...second.slice(0, -1)];
}

/**
 * @param rooms indoor room outlines (mm) [[{x,y}...], ...]
 * @param walls measured walls (mm) [{ nodes: [{x,y}...], thicknessMm }]
 * @returns [{ polygon (mm, outer face of the walls), areaM2, roomsM2, rooms: number }] largest first
 */
export function buildingOutlines(rooms = [], walls = [], overrides = {}) {
  const options = { ...OUTLINE_DEFAULTS, ...overrides };
  const roomRings = rooms.filter((ring) => Array.isArray(ring) && ring.length >= 3 && Math.abs(shoelace(ring)) > 0);
  if (!roomRings.length) return [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const ring of roomRings) for (const p of ring) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  const margin = options.wallReachMm + options.closeMm + 4 * options.cellMm;
  x0 -= margin; y0 -= margin; x1 += margin; y1 += margin;
  const cell = options.cellMm;
  const width = Math.ceil((x1 - x0) / cell), height = Math.ceil((y1 - y0) / cell);
  if (width * height > 2.5e7) return [];
  const toCell = (p) => ({ x: (p.x - x0) / cell, y: (p.y - y0) / cell });
  const roomGrid = { width, height, data: new Uint8Array(width * height) };
  for (const ring of roomRings) fillPolygon(roomGrid, ring, toCell);
  const near = morph(roomGrid, Math.round(options.wallReachMm / cell), true);
  const wallGrid = { width, height, data: new Uint8Array(width * height) };
  for (const wall of walls) {
    const nodes = (wall?.nodes || []).filter((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y));
    const half = (Number(wall?.thicknessMm) || 90) / 2;
    for (let i = 0; i < nodes.length - 1; i += 1) {
      const a = nodes[i], b = nodes[i + 1];
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      if (!length) continue;
      const nx = -(b.y - a.y) / length * half, ny = (b.x - a.x) / length * half;
      fillPolygon(wallGrid, [{ x: a.x + nx, y: a.y + ny }, { x: b.x + nx, y: b.y + ny }, { x: b.x - nx, y: b.y - ny }, { x: a.x - nx, y: a.y - ny }], toCell);
    }
  }
  const union = { width, height, data: new Uint8Array(width * height) };
  for (let i = 0; i < union.data.length; i += 1) union.data[i] = roomGrid.data[i] || (wallGrid.data[i] && near.data[i]) ? 1 : 0;
  const r = Math.round(options.closeMm / cell);
  const closed = fillHoles(morph(morph(union, r, true), r, false));
  const { label, list } = components(closed);
  const cellM2 = (cell * cell) / 1e6;
  const out = [];
  for (const component of list) {
    const areaM2 = component.cells.length * cellM2;
    if (areaM2 < options.minComponentM2) continue;
    const roomCells = component.cells.filter((p) => roomGrid.data[p]).length;
    if (!roomCells) continue;
    const ring = traceOuter(label, width, height, component.id).map((p) => ({ x: x0 + p.x * cell, y: y0 + p.y * cell }));
    const polygon = simplify(ring, options.simplifyMm);
    out.push({ polygon, areaM2: Math.abs(shoelace(polygon)) / 1e6, roomsM2: roomCells * cellM2, rooms: roomRings.filter((ring) => component.cells.length && label[Math.floor(toCell(ring[0]).y) * width + Math.floor(toCell(ring[0]).x)] === component.id).length });
  }
  return out.sort((a, b) => b.areaM2 - a.areaM2);
}
