import { normaliseQuarterTurn } from "../types.js";

const ROTATIONS = [0, 90, 180, 270];
const OUTER_STRIP_RATIO = 0.18;
const MIN_VECTOR_SEGMENTS = 80;

function emptyEdgeScores() {
  return {
    left: { length: 0, count: 0, shortCount: 0 },
    right: { length: 0, count: 0, shortCount: 0 },
    top: { length: 0, count: 0, shortCount: 0 },
    bottom: { length: 0, count: 0, shortCount: 0 },
  };
}

function addEdgeScore(edge, segment) {
  edge.length += segment.length || 0;
  edge.count += 1;
  if ((segment.length || 0) <= 10) edge.shortCount += 1;
}

function titleBlockEdgeToCorrection(edgeName) {
  // In base PDF coordinates, a left-side title strip needs a 270deg clockwise
  // correction to sit along the bottom of the displayed sheet. The other edges
  // follow the same "move title strip to bottom" convention.
  if (edgeName === "left") return 270;
  if (edgeName === "right") return 90;
  if (edgeName === "top") return 180;
  return 0;
}

export function scoreVectorLayoutOrientation({ segments = [], sourceWidth = 0, sourceHeight = 0, metadataRotation = 0 }) {
  const scores = { 0: 0, 90: 0, 180: 0, 270: 0 };
  const edgeScores = emptyEdgeScores();
  if (!sourceWidth || !sourceHeight || segments.length < MIN_VECTOR_SEGMENTS) {
    const metadataCorrection = normaliseQuarterTurn(metadataRotation);
    scores[metadataCorrection] = metadataRotation ? 20 : 1;
    return {
      scores,
      bestRotation: metadataCorrection,
      detectedCorrection: metadataCorrection,
      confidence: metadataRotation ? 55 : 20,
      hasSignal: Boolean(metadataRotation),
      source: "metadata",
      edgeScores,
    };
  }

  const leftLimit = sourceWidth * OUTER_STRIP_RATIO;
  const rightLimit = sourceWidth * (1 - OUTER_STRIP_RATIO);
  const bottomLimit = sourceHeight * OUTER_STRIP_RATIO;
  const topLimit = sourceHeight * (1 - OUTER_STRIP_RATIO);

  for (const segment of segments) {
    const midX = ((segment.a?.x || 0) + (segment.b?.x || 0)) / 2;
    const midY = ((segment.a?.y || 0) + (segment.b?.y || 0)) / 2;
    if (midX <= leftLimit) addEdgeScore(edgeScores.left, segment);
    if (midX >= rightLimit) addEdgeScore(edgeScores.right, segment);
    if (midY <= bottomLimit) addEdgeScore(edgeScores.bottom, segment);
    if (midY >= topLimit) addEdgeScore(edgeScores.top, segment);
  }

  for (const [edgeName, edge] of Object.entries(edgeScores)) {
    const correction = titleBlockEdgeToCorrection(edgeName);
    // Short vector strokes are a useful proxy for exploded/CAD text in title
    // strips. Length still matters, but count keeps dense title blocks from
    // losing to one or two long drawing/grid runs.
    scores[correction] += edge.count * 2 + edge.shortCount * 4 + edge.length * 0.08;
  }

  // Portrait PDFs containing landscape architectural sheets are common. Use a
  // small tie-break toward a landscape display only when vector evidence exists.
  if (sourceHeight > sourceWidth) {
    scores[90] += 25;
    scores[270] += 25;
  }

  const metadataCorrection = normaliseQuarterTurn(metadataRotation);
  if (metadataRotation) scores[metadataCorrection] += 40;

  const total = ROTATIONS.reduce((sum, rotation) => sum + scores[rotation], 0);
  let bestRotation = ROTATIONS.reduce((best, rotation) => (scores[rotation] > scores[best] ? rotation : best), 0);
  if (
    sourceHeight > sourceWidth &&
    bestRotation === 90 &&
    scores[270] > 0 &&
    scores[270] >= scores[90] * 0.96
  ) {
    bestRotation = 270;
  }
  const confidence = total > 0 ? Math.round((scores[bestRotation] / total) * 100) : 0;

  return {
    scores,
    bestRotation,
    detectedCorrection: bestRotation,
    confidence,
    hasSignal: total > 0,
    source: "raster-analysis",
    edgeScores,
  };
}

export async function detectVectorLayoutOrientation(pdfDocument, pageNumber, { sourceWidth, sourceHeight, metadataRotation = 0 }) {
  try {
    const { extractVectorSegments } = await import("../geometry/planVectorExtraction.js");
    const segments = await extractVectorSegments(pdfDocument, pageNumber, {
      pageWidth: sourceWidth,
      pageHeight: sourceHeight,
    });
    return scoreVectorLayoutOrientation({ segments, sourceWidth, sourceHeight, metadataRotation });
  } catch {
    return scoreVectorLayoutOrientation({ segments: [], sourceWidth, sourceHeight, metadataRotation });
  }
}
