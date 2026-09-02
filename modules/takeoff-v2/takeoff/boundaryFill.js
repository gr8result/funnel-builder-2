import { createArea } from "../types.js";
import { calculatePolygonAreaM2 } from "./areaCalculation.js";
import { distance } from "./geometry.js";

export function createBoundaryFillSession({ seedPoint, sensitivity = 0.5, temporaryBoundaries = [] } = {}) {
  return {
    seedPoint,
    sensitivity: clamp01(sensitivity),
    temporaryBoundaries: Array.isArray(temporaryBoundaries) ? temporaryBoundaries : [],
    status: "draft",
    previewPolygon: null,
    leak: null,
  };
}

export function boundaryFillUnavailableResult(reason = "Boundary fill engine is not implemented yet.") {
  return {
    ok: false,
    status: "unavailable",
    reason,
    previewPolygon: null,
    leak: null,
  };
}

export function previewBoundaryFillFromSegments({
  seedPoint,
  boundarySegments = [],
  temporaryBoundaries = [],
  bounds = null,
  cellSize = 4,
  maxCells = 90000,
} = {}) {
  if (!seedPoint) return boundaryFillUnavailableResult("Boundary fill needs a seed point.");
  const allSegments = [...normaliseSegments(boundarySegments), ...normaliseSegments(temporaryBoundaries)];
  if (!allSegments.length) return boundaryFillUnavailableResult("Boundary fill needs boundary segments.");

  const fillBounds = expandBounds(bounds || boundsFromSegments(allSegments, seedPoint), Number(cellSize) * 2);
  const step = Math.max(1, Number(cellSize) || 4);
  const cols = Math.ceil((fillBounds.maxX - fillBounds.minX) / step);
  const rows = Math.ceil((fillBounds.maxY - fillBounds.minY) / step);
  if (cols <= 1 || rows <= 1 || cols * rows > maxCells) {
    return boundaryFillUnavailableResult("Boundary fill region is too large for the local preview engine.");
  }

  const blocked = new Uint8Array(cols * rows);
  allSegments.forEach((segment) => rasteriseSegment(blocked, cols, rows, fillBounds, step, segment));

  const seedCol = Math.floor((seedPoint.x - fillBounds.minX) / step);
  const seedRow = Math.floor((seedPoint.y - fillBounds.minY) / step);
  if (!inside(seedCol, seedRow, cols, rows)) return boundaryFillUnavailableResult("Seed point is outside the fill bounds.");
  const seedIndex = seedRow * cols + seedCol;
  if (blocked[seedIndex]) return boundaryFillUnavailableResult("Seed point is on a boundary.");

  const visited = new Uint8Array(cols * rows);
  const queue = [seedIndex];
  visited[seedIndex] = 1;
  let head = 0;
  let leaked = false;
  let minCol = seedCol;
  let maxCol = seedCol;
  let minRow = seedRow;
  let maxRow = seedRow;
  const deltas = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  while (head < queue.length) {
    const index = queue[head++];
    const row = Math.floor(index / cols);
    const col = index - row * cols;
    minCol = Math.min(minCol, col);
    maxCol = Math.max(maxCol, col);
    minRow = Math.min(minRow, row);
    maxRow = Math.max(maxRow, row);
    if (col === 0 || row === 0 || col === cols - 1 || row === rows - 1) leaked = true;
    deltas.forEach(([dc, dr]) => {
      const nextCol = col + dc;
      const nextRow = row + dr;
      if (!inside(nextCol, nextRow, cols, rows)) return;
      const nextIndex = nextRow * cols + nextCol;
      if (visited[nextIndex] || blocked[nextIndex]) return;
      visited[nextIndex] = 1;
      queue.push(nextIndex);
    });
  }

  if (leaked) {
    return {
      ok: false,
      status: "leaked",
      reason: "Boundary fill leaked to the preview bounds. Add a temporary boundary or close the room.",
      previewPolygon: null,
      leak: { reachedPreviewBounds: true },
    };
  }

  const previewPolygon = [
    cellCorner(fillBounds, step, minCol, minRow),
    cellCorner(fillBounds, step, maxCol + 1, minRow),
    cellCorner(fillBounds, step, maxCol + 1, maxRow + 1),
    cellCorner(fillBounds, step, minCol, maxRow + 1),
  ];
  return {
    ok: true,
    status: "preview",
    reason: "",
    previewPolygon,
    leak: null,
    diagnostics: {
      cellSize: step,
      filledCells: queue.length,
      boundarySegments: allSegments.length,
    },
  };
}

export function acceptBoundaryFillPreview({ previewPolygon, page, name = "Room", source = "boundary-fill" } = {}) {
  if (!Array.isArray(previewPolygon) || previewPolygon.length < 3) return null;
  const calculatedAreaM2 = calculatePolygonAreaM2(previewPolygon, page?.calibration);
  return createArea({
    name,
    areaType: "Room",
    vertices: previewPolygon,
    calculatedAreaM2,
    confirmedAreaM2: calculatedAreaM2,
    source,
    confirmed: true,
  });
}

function clamp01(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0.5;
  return Math.max(0, Math.min(1, number));
}

function normaliseSegments(segments = []) {
  return (Array.isArray(segments) ? segments : [])
    .map((segment) => {
      const start = segment.start || segment.pointA || segment.a || segment.p1;
      const end = segment.end || segment.pointB || segment.b || segment.p2;
      const a = toPoint(start);
      const b = toPoint(end);
      return a && b && distance(a, b) > 0 ? { start: a, end: b } : null;
    })
    .filter(Boolean);
}

function toPoint(value) {
  const point = Array.isArray(value)
    ? { x: Number(value[0]), y: Number(value[1]) }
    : value && typeof value === "object"
      ? { x: Number(value.x), y: Number(value.y) }
      : null;
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  return point;
}

function boundsFromSegments(segments, seedPoint) {
  const xs = [seedPoint.x];
  const ys = [seedPoint.y];
  segments.forEach((segment) => {
    xs.push(segment.start.x, segment.end.x);
    ys.push(segment.start.y, segment.end.y);
  });
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

function expandBounds(bounds, amount) {
  return {
    minX: Number(bounds.minX) - amount,
    minY: Number(bounds.minY) - amount,
    maxX: Number(bounds.maxX) + amount,
    maxY: Number(bounds.maxY) + amount,
  };
}

function rasteriseSegment(blocked, cols, rows, bounds, step, segment) {
  const length = distance(segment.start, segment.end);
  const samples = Math.max(1, Math.ceil(length / Math.max(1, step / 2)));
  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;
    const x = segment.start.x + (segment.end.x - segment.start.x) * t;
    const y = segment.start.y + (segment.end.y - segment.start.y) * t;
    const col = Math.floor((x - bounds.minX) / step);
    const row = Math.floor((y - bounds.minY) / step);
    for (let dc = -1; dc <= 1; dc += 1) {
      for (let dr = -1; dr <= 1; dr += 1) {
        const c = col + dc;
        const r = row + dr;
        if (inside(c, r, cols, rows)) blocked[r * cols + c] = 1;
      }
    }
  }
}

function inside(col, row, cols, rows) {
  return col >= 0 && row >= 0 && col < cols && row < rows;
}

function cellCorner(bounds, step, col, row) {
  return {
    x: bounds.minX + col * step,
    y: bounds.minY + row * step,
  };
}
