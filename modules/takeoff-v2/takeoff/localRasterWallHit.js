import { distance } from "./geometry.js";

const DARK_THRESHOLD = 168;
const EDGE_SEARCH_PX = 34;
const POINTER_BAND_TOLERANCE_PX = 12;
const MIN_THICKNESS_PX = 4;
const MAX_THICKNESS_PX = 34;
const MIN_WALL_LENGTH_PX = 56;
const MAX_OPENING_GAP_PX = 86;
const FACE_TOLERANCE_PX = 2;
const CORNER_SEARCH_PX = 28;
const LOCAL_FACE_EVIDENCE_HALF_SPAN_PX = 46;
const MIN_LOCAL_FACE_RUN_PX = 8;
const DIMENSION_TICK_REJECTION_COUNT = 5;

function luminanceAt(data, width, x, y) {
  const idx = (y * width + x) * 4;
  return 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
}

function isDark(image, x, y) {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 0 || iy < 0 || ix >= image.width || iy >= image.height) return false;
  return luminanceAt(image.data, image.width, ix, iy) < DARK_THRESHOLD;
}

function clusterValues(values) {
  const sorted = [...new Set(values.map(Math.round))].sort((a, b) => a - b);
  const clusters = [];
  sorted.forEach((value) => {
    const current = clusters[clusters.length - 1];
    if (current && value <= current.end + 1) {
      current.end = value;
      current.values.push(value);
    } else {
      clusters.push({ start: value, end: value, values: [value] });
    }
  });
  return clusters.map((cluster) => ({
    ...cluster,
    center: cluster.values.reduce((sum, value) => sum + value, 0) / cluster.values.length,
    weight: cluster.values.length,
  }));
}

function darkNear(image, x, y, axis) {
  for (let offset = -FACE_TOLERANCE_PX; offset <= FACE_TOLERANCE_PX; offset += 1) {
    if (axis === "horizontal" && isDark(image, x, y + offset)) return true;
    if (axis === "vertical" && isDark(image, x + offset, y)) return true;
  }
  return false;
}

function rowEvidence(image, pointer) {
  const ys = [];
  for (let y = Math.max(0, Math.round(pointer.y - EDGE_SEARCH_PX)); y <= Math.min(image.height - 1, Math.round(pointer.y + EDGE_SEARCH_PX)); y += 1) {
    let run = 0;
    let bestRun = 0;
    for (let x = Math.max(0, Math.round(pointer.x - LOCAL_FACE_EVIDENCE_HALF_SPAN_PX)); x <= Math.min(image.width - 1, Math.round(pointer.x + LOCAL_FACE_EVIDENCE_HALF_SPAN_PX)); x += 1) {
      if (isDark(image, x, y)) {
        run += 1;
        bestRun = Math.max(bestRun, run);
      } else {
        run = 0;
      }
    }
    if (bestRun >= MIN_LOCAL_FACE_RUN_PX) ys.push(y);
  }
  return clusterValues(ys).filter((cluster) => cluster.weight >= 1);
}

function columnEvidence(image, pointer) {
  const xs = [];
  for (let x = Math.max(0, Math.round(pointer.x - EDGE_SEARCH_PX)); x <= Math.min(image.width - 1, Math.round(pointer.x + EDGE_SEARCH_PX)); x += 1) {
    let run = 0;
    let bestRun = 0;
    for (let y = Math.max(0, Math.round(pointer.y - LOCAL_FACE_EVIDENCE_HALF_SPAN_PX)); y <= Math.min(image.height - 1, Math.round(pointer.y + LOCAL_FACE_EVIDENCE_HALF_SPAN_PX)); y += 1) {
      if (isDark(image, x, y)) {
        run += 1;
        bestRun = Math.max(bestRun, run);
      } else {
        run = 0;
      }
    }
    if (bestRun >= MIN_LOCAL_FACE_RUN_PX) xs.push(x);
  }
  return clusterValues(xs).filter((cluster) => cluster.weight >= 1);
}

function chooseFacePair(clusters, pointerCoord) {
  const pairs = [];
  for (let i = 0; i < clusters.length; i += 1) {
    for (let j = i + 1; j < clusters.length; j += 1) {
      const a = clusters[i].center;
      const b = clusters[j].center;
      const thickness = Math.abs(b - a);
      if (thickness < MIN_THICKNESS_PX || thickness > MAX_THICKNESS_PX) continue;
      const min = Math.min(a, b);
      const max = Math.max(a, b);
      const distanceToBand = pointerCoord < min ? min - pointerCoord : pointerCoord > max ? pointerCoord - max : 0;
      if (distanceToBand > POINTER_BAND_TOLERANCE_PX) continue;
      pairs.push({ faceA: a, faceB: b, thickness, distanceToBand, score: clusters[i].weight + clusters[j].weight - distanceToBand });
    }
  }
  return pairs.sort((a, b) => b.score - a.score || a.thickness - b.thickness)[0] || null;
}

function horizontalColumnEvidence(image, x, faceA, faceB) {
  const a = darkNear(image, x, faceA, "horizontal");
  const b = darkNear(image, x, faceB, "horizontal");
  return a && b ? 2 : a || b ? 1 : 0;
}

function verticalRowEvidence(image, y, faceA, faceB) {
  const a = darkNear(image, faceA, y, "vertical");
  const b = darkNear(image, faceB, y, "vertical");
  return a && b ? 2 : a || b ? 1 : 0;
}

function hasVerticalCorner(image, x, faceA, faceB) {
  const minY = Math.round(Math.min(faceA, faceB));
  const maxY = Math.round(Math.max(faceA, faceB));
  let hits = 0;
  for (let y = minY; y <= maxY; y += 1) {
    if (isDark(image, x, y)) hits += 1;
  }
  return hits >= Math.max(2, (maxY - minY + 1) * 0.45);
}

function hasHorizontalCorner(image, y, faceA, faceB) {
  const minX = Math.round(Math.min(faceA, faceB));
  const maxX = Math.round(Math.max(faceA, faceB));
  let hits = 0;
  for (let x = minX; x <= maxX; x += 1) {
    if (isDark(image, x, y)) hits += 1;
  }
  return hits >= Math.max(2, (maxX - minX + 1) * 0.45);
}

function extendHorizontal(image, pointerX, faceA, faceB, direction) {
  let lastEvidence = pointerX;
  let gap = 0;
  for (let x = Math.round(pointerX); x >= 0 && x < image.width; x += direction) {
    const evidence = horizontalColumnEvidence(image, x, faceA, faceB);
    if (evidence > 0) {
      lastEvidence = x;
      gap = 0;
    } else {
      gap += 1;
      if (gap > MAX_OPENING_GAP_PX) break;
    }
  }
  for (let x = lastEvidence; x !== lastEvidence - direction * CORNER_SEARCH_PX; x -= direction) {
    if (x < 0 || x >= image.width) break;
    if (hasVerticalCorner(image, x, faceA, faceB)) return x;
  }
  return lastEvidence;
}

function extendVertical(image, pointerY, faceA, faceB, direction) {
  let lastEvidence = pointerY;
  let gap = 0;
  for (let y = Math.round(pointerY); y >= 0 && y < image.height; y += direction) {
    const evidence = verticalRowEvidence(image, y, faceA, faceB);
    if (evidence > 0) {
      lastEvidence = y;
      gap = 0;
    } else {
      gap += 1;
      if (gap > MAX_OPENING_GAP_PX) break;
    }
  }
  for (let y = lastEvidence; y !== lastEvidence - direction * CORNER_SEARCH_PX; y -= direction) {
    if (y < 0 || y >= image.height) break;
    if (hasHorizontalCorner(image, y, faceA, faceB)) return y;
  }
  return lastEvidence;
}

function dimensionTickCountHorizontal(image, startX, endX, faceA, faceB) {
  const minX = Math.min(startX, endX);
  const maxX = Math.max(startX, endX);
  let ticks = 0;
  let inTick = false;
  for (let x = minX; x <= maxX; x += 1) {
    const tick = hasVerticalCorner(image, x, faceA, faceB);
    if (tick && !inTick) ticks += 1;
    inTick = tick;
  }
  return ticks;
}

function dimensionTickCountVertical(image, startY, endY, faceA, faceB) {
  const minY = Math.min(startY, endY);
  const maxY = Math.max(startY, endY);
  let ticks = 0;
  let inTick = false;
  for (let y = minY; y <= maxY; y += 1) {
    const tick = hasHorizontalCorner(image, y, faceA, faceB);
    if (tick && !inTick) ticks += 1;
    inTick = tick;
  }
  return ticks;
}

function makeWall({ axis, start, end, faceA, faceB, thickness, pointerDistance, imageToPagePoint }) {
  const centreline = { start: imageToPagePoint(start), end: imageToPagePoint(end) };
  const faceALine = axis === "horizontal"
    ? { start: imageToPagePoint({ x: start.x, y: faceA }), end: imageToPagePoint({ x: end.x, y: faceA }) }
    : { start: imageToPagePoint({ x: faceA, y: start.y }), end: imageToPagePoint({ x: faceA, y: end.y }) };
  const faceBLine = axis === "horizontal"
    ? { start: imageToPagePoint({ x: start.x, y: faceB }), end: imageToPagePoint({ x: end.x, y: faceB }) }
    : { start: imageToPagePoint({ x: faceB, y: start.y }), end: imageToPagePoint({ x: faceB, y: end.y }) };
  const length = distance(centreline.start, centreline.end);
  const idPoints = [
    `${Math.round(centreline.start.x)}-${Math.round(centreline.start.y)}`,
    `${Math.round(centreline.end.x)}-${Math.round(centreline.end.y)}`,
  ].sort().join("-");
  return {
    id: `hl-wall-raster-${idPoints}-${Math.round(thickness)}`,
    axis: centreline,
    centreline,
    faceA: faceALine,
    faceB: faceBLine,
    faces: { exterior: [faceALine.start, faceALine.end], interior: [faceBLine.start, faceBLine.end] },
    startJunction: { point: centreline.start, confidence: 0.78, source: "raster-face-termination" },
    endJunction: { point: centreline.end, confidence: 0.78, source: "raster-face-termination" },
    sections: [{ type: "solid", startOffset: 0, endOffset: length, confidence: 0.78 }],
    openings: [],
    thickness,
    confidence: 0.78,
    source: "local-raster-wall-band",
    diagnostics: {
      pointerDistance,
      candidateLength: length,
      parallelFaces: 2,
      estimatedThickness: thickness,
      rasterEvidence: "local-rendered-canvas",
      reason: "accepted local raster wall band",
    },
  };
}

function nullImageToPage(point) {
  return point;
}

export function findRasterWallBandInImage({ image, pointer, imageToPagePoint = nullImageToPage } = {}) {
  if (!image?.data || !image.width || !image.height || !pointer) {
    return { wall: null, diagnostics: { reason: "missing image or pointer" } };
  }
  const rows = rowEvidence(image, pointer);
  const columns = columnEvidence(image, pointer);
  const hPair = chooseFacePair(rows, pointer.y);
  const vPair = chooseFacePair(columns, pointer.x);
  const diagnostics = {
    rawPdfLineCount: 0,
    rasterEdgeCount: rows.length + columns.length,
    filteredLineCount: 0,
    wallBandCandidateCount: Number(Boolean(hPair)) + Number(Boolean(vPair)),
    pointerImage: pointer,
    nearestRasterEdgeDistance: Math.min(
      ...[...rows.map((row) => Math.abs(row.center - pointer.y)), ...columns.map((column) => Math.abs(column.center - pointer.x)), Infinity]
    ),
    rejectedReason: "",
  };

  const candidates = [];
  if (hPair) {
    const left = extendHorizontal(image, pointer.x, hPair.faceA, hPair.faceB, -1);
    const right = extendHorizontal(image, pointer.x, hPair.faceA, hPair.faceB, 1);
    const startX = Math.min(left, right);
    const endX = Math.max(left, right);
    const length = endX - startX;
    const tickCount = dimensionTickCountHorizontal(image, startX, endX, hPair.faceA, hPair.faceB);
    if (length >= MIN_WALL_LENGTH_PX && tickCount < DIMENSION_TICK_REJECTION_COUNT) {
      const centerY = (hPair.faceA + hPair.faceB) / 2;
      candidates.push(makeWall({
        axis: "horizontal",
        start: { x: startX, y: centerY },
        end: { x: endX, y: centerY },
        faceA: hPair.faceA,
        faceB: hPair.faceB,
        thickness: hPair.thickness,
        pointerDistance: hPair.distanceToBand,
        imageToPagePoint,
      }));
    } else {
      diagnostics.rejectedReason = length < MIN_WALL_LENGTH_PX ? "horizontal length below wall minimum" : "horizontal dimension ticks rejected";
    }
  }

  if (vPair) {
    const top = extendVertical(image, pointer.y, vPair.faceA, vPair.faceB, -1);
    const bottom = extendVertical(image, pointer.y, vPair.faceA, vPair.faceB, 1);
    const startY = Math.min(top, bottom);
    const endY = Math.max(top, bottom);
    const length = endY - startY;
    const tickCount = dimensionTickCountVertical(image, startY, endY, vPair.faceA, vPair.faceB);
    if (length >= MIN_WALL_LENGTH_PX && tickCount < DIMENSION_TICK_REJECTION_COUNT) {
      const centerX = (vPair.faceA + vPair.faceB) / 2;
      candidates.push(makeWall({
        axis: "vertical",
        start: { x: centerX, y: startY },
        end: { x: centerX, y: endY },
        faceA: vPair.faceA,
        faceB: vPair.faceB,
        thickness: vPair.thickness,
        pointerDistance: vPair.distanceToBand,
        imageToPagePoint,
      }));
    } else if (!diagnostics.rejectedReason) {
      diagnostics.rejectedReason = length < MIN_WALL_LENGTH_PX ? "vertical length below wall minimum" : "vertical dimension ticks rejected";
    }
  }

  candidates.sort((a, b) => b.diagnostics.candidateLength - a.diagnostics.candidateLength);
  return { wall: candidates[0] || null, diagnostics };
}

export function findRasterWallBandOnCanvas({ canvas, viewport, point } = {}) {
  if (!canvas || !viewport || !point) return { wall: null, diagnostics: { reason: "missing canvas, viewport or point" } };
  const context = canvas.getContext?.("2d");
  if (!context) return { wall: null, diagnostics: { reason: "canvas context unavailable" } };
  const [vx, vy] = viewport.convertToViewportPoint(point.x, point.y);
  const scaleX = canvas.width / viewport.width;
  const scaleY = canvas.height / viewport.height;
  const pointer = { x: vx * scaleX, y: vy * scaleY };
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const imageToPagePoint = (imagePoint) => {
    const cssX = imagePoint.x / scaleX;
    const cssY = imagePoint.y / scaleY;
    const [pdfX, pdfY] = viewport.convertToPdfPoint(cssX, cssY);
    return { x: pdfX, y: pdfY };
  };
  const result = findRasterWallBandInImage({
    image: { data: imageData.data, width: imageData.width, height: imageData.height },
    pointer,
    imageToPagePoint,
  });
  return {
    ...result,
    diagnostics: {
      ...result.diagnostics,
      pointerDocument: point,
      pointerImage: pointer,
      viewportSize: { width: viewport.width, height: viewport.height },
      canvasSize: { width: canvas.width, height: canvas.height },
    },
  };
}
