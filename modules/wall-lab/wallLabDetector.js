export const WALL_LAB_CLASSES = {
  STRUCTURAL_WALL: "structural-wall",
  DIMENSION: "dimension",
  FURNITURE: "furniture",
  TEXT: "text",
  UNKNOWN: "unknown",
};

export const WALL_LAB_COLORS = {
  [WALL_LAB_CLASSES.STRUCTURAL_WALL]: "#1d4ed8",
  [WALL_LAB_CLASSES.DIMENSION]: "#dc2626",
  [WALL_LAB_CLASSES.FURNITURE]: "#6b7280",
  [WALL_LAB_CLASSES.TEXT]: "transparent",
  [WALL_LAB_CLASSES.UNKNOWN]: "#f97316",
};

const DARK_THRESHOLD = 176;
const MIN_STROKE_RUN = 8;
const MIN_WALL_LENGTH = 32;
const MIN_WALL_THICKNESS = 4;
const MAX_WALL_THICKNESS = 24;
const PAIR_TOLERANCE = 4;

export function detectWallsFromImageData(imageData, options = {}) {
  const width = imageData.width || options.width;
  const height = imageData.height || options.height;
  const data = imageData.data;

  if (!data || !width || !height) {
    throw new Error("Wall lab detector needs ImageData with data, width, and height.");
  }

  const dark = buildDarkMap(data, width, height, options.darkThreshold || DARK_THRESHOLD);
  const horizontalRuns = scanRuns(dark, width, height, "h", options.minRun || MIN_STROKE_RUN);
  const verticalRuns = scanRuns(dark, width, height, "v", options.minRun || MIN_STROKE_RUN);
  const horizontalStrokes = mergeRuns(horizontalRuns, "h");
  const verticalStrokes = mergeRuns(verticalRuns, "v");
  const allStrokes = [...horizontalStrokes, ...verticalStrokes];

  const dimensionEvidence = new Map();
  for (const stroke of allStrokes) {
    dimensionEvidence.set(stroke.id, countDimensionTicks(stroke, allStrokes));
  }

  const wallCandidates = pairWallFaces(horizontalStrokes, verticalStrokes, dimensionEvidence);
  const acceptedWalls = scoreAndFilterWalls(wallCandidates);
  const acceptedStrokeIds = new Set(acceptedWalls.flatMap((wall) => [wall.faceA.id, wall.faceB.id]));
  const dimensionStrokeIds = new Set(
    allStrokes
      .filter((stroke) => {
        const ticks = dimensionEvidence.get(stroke.id) || 0;
        return ticks >= 3 && stroke.length >= 28;
      })
      .map((stroke) => stroke.id)
  );

  const rejected = [];
  const seenRejected = new Set();
  for (const stroke of allStrokes) {
    if (acceptedStrokeIds.has(stroke.id)) continue;

    const classification = classifyRejectedStroke(stroke, dimensionStrokeIds);
    if (classification === WALL_LAB_CLASSES.TEXT) continue;

    const key = `${classification}-${stroke.id}`;
    if (seenRejected.has(key)) continue;
    seenRejected.add(key);
    rejected.push({
      id: `rejected-${stroke.id}`,
      type: classification,
      stroke,
      bbox: strokeToBox(stroke),
      confidence: classification === WALL_LAB_CLASSES.DIMENSION ? 0.86 : 0.42,
    });
  }

  return {
    source: options.source || "png",
    width,
    height,
    darkPixelCount: dark.reduce((sum, value) => sum + value, 0),
    strokes: allStrokes,
    candidates: wallCandidates,
    walls: acceptedWalls,
    rejected,
    diagnostics: buildDiagnostics(acceptedWalls, rejected),
  };
}

export function hitTestWall(walls, point, tolerance = 10) {
  let best = null;

  for (const wall of walls || []) {
    const distance = distanceToSegment(point, wall.centreline.start, wall.centreline.end);
    const hitTolerance = Math.max(tolerance, wall.thickness / 2 + 5);
    if (distance <= hitTolerance && (!best || distance < best.distance)) {
      best = { wall, distance };
    }
  }

  return best?.wall || null;
}

export function compareDetectionResults(pngResult, pdfResult) {
  if (!pngResult || !pdfResult) return null;

  const pngWalls = pngResult.walls.length;
  const pdfWalls = pdfResult.walls.length;
  const delta = pdfWalls - pngWalls;
  const ratio = pngWalls ? pdfWalls / pngWalls : 0;
  const likelyReasons = [];

  if (ratio < 0.75) {
    likelyReasons.push("PDF rasterisation is losing dark wall pixels, changing line thickness, or cropping the floorplan.");
  }
  if (ratio > 1.25) {
    likelyReasons.push("PDF rasterisation is exposing title-block, dimension, or annotation geometry that is absent from the PNG benchmark.");
  }
  if (Math.abs(delta) <= Math.max(4, pngWalls * 0.1)) {
    likelyReasons.push("PNG and PDF wall counts are close; remaining differences should be inspected in the rejected geometry panel.");
  }

  return {
    pngDetectedWalls: pngWalls,
    pdfDetectedWalls: pdfWalls,
    delta,
    ratio,
    likelyReasons,
  };
}

function buildDarkMap(data, width, height, threshold) {
  const dark = new Uint8Array(width * height);
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    const alpha = data[offset + 3];
    const gray = data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114;
    dark[index] = alpha > 32 && gray < threshold ? 1 : 0;
  }
  return dark;
}

function scanRuns(dark, width, height, orientation, minRun) {
  const runs = [];
  const outer = orientation === "h" ? height : width;
  const inner = orientation === "h" ? width : height;

  for (let a = 0; a < outer; a += 1) {
    let start = -1;
    for (let b = 0; b <= inner; b += 1) {
      const x = orientation === "h" ? b : a;
      const y = orientation === "h" ? a : b;
      const isDark = b < inner && dark[y * width + x] === 1;

      if (isDark && start < 0) start = b;
      if ((!isDark || b === inner) && start >= 0) {
        const end = b - 1;
        if (end - start + 1 >= minRun) {
          runs.push(runToStroke(orientation, a, start, end));
        }
        start = -1;
      }
    }
  }

  return runs;
}

function runToStroke(orientation, fixed, start, end) {
  if (orientation === "h") {
    return { orientation, x1: start, x2: end, y1: fixed, y2: fixed, length: end - start + 1, thickness: 1 };
  }

  return { orientation, x1: fixed, x2: fixed, y1: start, y2: end, length: end - start + 1, thickness: 1 };
}

function mergeRuns(runs, orientation) {
  const sorted = [...runs].sort((a, b) => {
    if (orientation === "h") return a.y1 - b.y1 || a.x1 - b.x1;
    return a.x1 - b.x1 || a.y1 - b.y1;
  });
  const merged = [];

  for (const run of sorted) {
    const match = findMergeTarget(merged, run, orientation);
    if (!match) {
      merged.push({ ...run, runCount: 1 });
      continue;
    }

    match.x1 = Math.min(match.x1, run.x1);
    match.x2 = Math.max(match.x2, run.x2);
    match.y1 = Math.min(match.y1, run.y1);
    match.y2 = Math.max(match.y2, run.y2);
    match.runCount += 1;
    match.thickness = orientation === "h" ? match.y2 - match.y1 + 1 : match.x2 - match.x1 + 1;
    match.length = orientation === "h" ? match.x2 - match.x1 + 1 : match.y2 - match.y1 + 1;
  }

  return merged
    .filter((stroke) => stroke.length >= MIN_STROKE_RUN)
    .map((stroke, index) => ({ ...stroke, id: `${orientation}-${index}` }));
}

function findMergeTarget(merged, run, orientation) {
  for (let index = merged.length - 1; index >= 0; index -= 1) {
    const candidate = merged[index];
    const fixedGap = orientation === "h" ? run.y1 - candidate.y2 : run.x1 - candidate.x2;
    if (fixedGap > 2) break;
    if (fixedGap < -2) continue;

    const overlap = orientation === "h"
      ? overlapLength(run.x1, run.x2, candidate.x1, candidate.x2)
      : overlapLength(run.y1, run.y2, candidate.y1, candidate.y2);
    const minLength = Math.min(run.length, candidate.length);
    const closeEnds = orientation === "h"
      ? Math.abs(run.x1 - candidate.x1) <= 8 || Math.abs(run.x2 - candidate.x2) <= 8
      : Math.abs(run.y1 - candidate.y1) <= 8 || Math.abs(run.y2 - candidate.y2) <= 8;

    if (overlap >= Math.max(5, minLength * 0.45) || closeEnds) return candidate;
  }

  return null;
}

function pairWallFaces(horizontalStrokes, verticalStrokes, dimensionEvidence) {
  return [
    ...pairOrientation(horizontalStrokes, "h", dimensionEvidence),
    ...pairOrientation(verticalStrokes, "v", dimensionEvidence),
  ].map((wall, index) => ({ ...wall, id: `wall-${index}` }));
}

function pairOrientation(strokes, orientation, dimensionEvidence) {
  const walls = [];
  const sorted = [...strokes].filter((stroke) => stroke.length >= MIN_WALL_LENGTH);

  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = i + 1; j < sorted.length; j += 1) {
      const a = sorted[i];
      const b = sorted[j];
      const gap = orientation === "h" ? Math.abs(midY(a) - midY(b)) : Math.abs(midX(a) - midX(b));
      if (gap < MIN_WALL_THICKNESS || gap > MAX_WALL_THICKNESS) continue;

      const overlap = orientation === "h"
        ? overlapSpan(a.x1, a.x2, b.x1, b.x2)
        : overlapSpan(a.y1, a.y2, b.y1, b.y2);
      if (!overlap || overlap.length < MIN_WALL_LENGTH) continue;

      const endMisalignment = orientation === "h"
        ? Math.min(Math.abs(a.x1 - b.x1), Math.abs(a.x2 - b.x2))
        : Math.min(Math.abs(a.y1 - b.y1), Math.abs(a.y2 - b.y2));
      const tickPenalty = Math.max(dimensionEvidence.get(a.id) || 0, dimensionEvidence.get(b.id) || 0);
      const lengthScore = clamp(overlap.length / 120, 0.2, 1);
      const thicknessScore = gap >= 6 && gap <= 18 ? 1 : 0.72;
      const alignmentScore = endMisalignment <= PAIR_TOLERANCE ? 1 : 0.8;
      const confidence = clamp(0.2 + lengthScore * 0.35 + thicknessScore * 0.25 + alignmentScore * 0.15 - tickPenalty * 0.08, 0, 1);
      const centre = orientation === "h"
        ? {
            start: { x: overlap.start, y: (midY(a) + midY(b)) / 2 },
            end: { x: overlap.end, y: (midY(a) + midY(b)) / 2 },
          }
        : {
            start: { x: (midX(a) + midX(b)) / 2, y: overlap.start },
            end: { x: (midX(a) + midX(b)) / 2, y: overlap.end },
          };

      walls.push({
        type: WALL_LAB_CLASSES.STRUCTURAL_WALL,
        orientation,
        faceA: a,
        faceB: b,
        thickness: Math.round(gap),
        length: Math.round(overlap.length),
        centreline: centre,
        bbox: wallBox(a, b, orientation),
        confidence,
        rejectionEvidence: tickPenalty > 0 ? { dimensionTicks: tickPenalty } : null,
      });
    }
  }

  return dedupeWalls(walls);
}

function scoreAndFilterWalls(candidates) {
  const connected = annotateConnections(candidates);
  return connected
    .map((wall) => ({
      ...wall,
      confidence: clamp(wall.confidence + Math.min(wall.connections, 2) * 0.07, 0, 1),
    }))
    .filter((wall) => wall.confidence >= 0.58 && (!wall.rejectionEvidence || wall.rejectionEvidence.dimensionTicks < 3))
    .sort((a, b) => b.confidence - a.confidence);
}

function annotateConnections(walls) {
  return walls.map((wall) => {
    const endpoints = [wall.centreline.start, wall.centreline.end];
    let connections = 0;
    for (const other of walls) {
      if (other === wall || other.orientation === wall.orientation) continue;
      const otherEndpoints = [other.centreline.start, other.centreline.end];
      if (endpoints.some((a) => otherEndpoints.some((b) => pointDistance(a, b) <= 18))) {
        connections += 1;
      }
    }
    return { ...wall, connections };
  });
}

function dedupeWalls(walls) {
  const kept = [];
  for (const wall of [...walls].sort((a, b) => b.confidence - a.confidence)) {
    const duplicate = kept.some((existing) => {
      if (existing.orientation !== wall.orientation) return false;
      const centreDistance = wall.orientation === "h"
        ? Math.abs(wall.centreline.start.y - existing.centreline.start.y)
        : Math.abs(wall.centreline.start.x - existing.centreline.start.x);
      const overlap = wall.orientation === "h"
        ? overlapLength(wall.centreline.start.x, wall.centreline.end.x, existing.centreline.start.x, existing.centreline.end.x)
        : overlapLength(wall.centreline.start.y, wall.centreline.end.y, existing.centreline.start.y, existing.centreline.end.y);
      return centreDistance <= 5 && overlap >= Math.min(wall.length, existing.length) * 0.65;
    });
    if (!duplicate) kept.push(wall);
  }
  return kept;
}

function countDimensionTicks(stroke, strokes) {
  const perpendicular = strokes.filter((item) => item.orientation !== stroke.orientation && item.length <= 34 && item.length >= 5);
  const positions = new Set();

  for (const tick of perpendicular) {
    if (stroke.orientation === "h") {
      const crossesLine = tick.y1 <= midY(stroke) + 3 && tick.y2 >= midY(stroke) - 3;
      const withinSpan = tick.x1 >= stroke.x1 - 2 && tick.x1 <= stroke.x2 + 2;
      if (crossesLine && withinSpan) positions.add(Math.round(tick.x1 / 4));
    } else {
      const crossesLine = tick.x1 <= midX(stroke) + 3 && tick.x2 >= midX(stroke) - 3;
      const withinSpan = tick.y1 >= stroke.y1 - 2 && tick.y1 <= stroke.y2 + 2;
      if (crossesLine && withinSpan) positions.add(Math.round(tick.y1 / 4));
    }
  }

  return positions.size;
}

function classifyRejectedStroke(stroke, dimensionStrokeIds) {
  if (dimensionStrokeIds.has(stroke.id)) return WALL_LAB_CLASSES.DIMENSION;
  if (stroke.length < 14) return WALL_LAB_CLASSES.TEXT;
  if (stroke.length <= 58 && stroke.thickness <= 3) return WALL_LAB_CLASSES.FURNITURE;
  return WALL_LAB_CLASSES.UNKNOWN;
}

function buildDiagnostics(walls, rejected) {
  const rejectedByType = rejected.reduce((acc, item) => {
    acc[item.type] = (acc[item.type] || 0) + 1;
    return acc;
  }, {});

  return {
    detectedWalls: walls.length,
    rejectedDimensions: rejectedByType[WALL_LAB_CLASSES.DIMENSION] || 0,
    rejectedFurniture: rejectedByType[WALL_LAB_CLASSES.FURNITURE] || 0,
    rejectedUnknown: rejectedByType[WALL_LAB_CLASSES.UNKNOWN] || 0,
    rejectedText: rejectedByType[WALL_LAB_CLASSES.TEXT] || 0,
    wallThicknessHistogram: histogram(walls.map((wall) => wall.thickness), [4, 8, 12, 16, 20, 24]),
    wallConfidenceHistogram: histogram(walls.map((wall) => Math.round(wall.confidence * 100)), [50, 60, 70, 80, 90, 100]),
    falsePositives: rejected
      .filter((item) => item.type === WALL_LAB_CLASSES.UNKNOWN && item.stroke.length >= MIN_WALL_LENGTH)
      .slice(0, 18)
      .map((item) => describeStroke(item.stroke)),
    falseNegatives: walls.length === 0 ? ["No structural wall pairs detected."] : [],
  };
}

function histogram(values, buckets) {
  const result = {};
  for (const bucket of buckets) result[`<=${bucket}`] = 0;
  for (const value of values) {
    const bucket = buckets.find((limit) => value <= limit) || buckets[buckets.length - 1];
    result[`<=${bucket}`] += 1;
  }
  return result;
}

function describeStroke(stroke) {
  return `${stroke.orientation.toUpperCase()} ${Math.round(stroke.length)}px at (${Math.round(stroke.x1)}, ${Math.round(stroke.y1)})`;
}

function strokeToBox(stroke) {
  return {
    x: stroke.x1,
    y: stroke.y1,
    width: Math.max(1, stroke.x2 - stroke.x1 + 1),
    height: Math.max(1, stroke.y2 - stroke.y1 + 1),
  };
}

function wallBox(a, b) {
  const x1 = Math.min(a.x1, b.x1);
  const y1 = Math.min(a.y1, b.y1);
  const x2 = Math.max(a.x2, b.x2);
  const y2 = Math.max(a.y2, b.y2);
  return { x: x1, y: y1, width: x2 - x1 + 1, height: y2 - y1 + 1 };
}

function overlapSpan(a1, a2, b1, b2) {
  const start = Math.max(a1, b1);
  const end = Math.min(a2, b2);
  if (end < start) return null;
  return { start, end, length: end - start + 1 };
}

function overlapLength(a1, a2, b1, b2) {
  return Math.max(0, Math.min(a2, b2) - Math.max(a1, b1) + 1);
}

function midX(stroke) {
  return (stroke.x1 + stroke.x2) / 2;
}

function midY(stroke) {
  return (stroke.y1 + stroke.y2) / 2;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function pointDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return pointDistance(point, start);
  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1);
  return pointDistance(point, { x: start.x + t * dx, y: start.y + t * dy });
}
