import type { OrientationResult, PlanRotation } from "../state/takeoffTypes";
import { applyRotation, normalizeRotation, rotatedDimensions } from "../rendering/CoordinateTransform";

const ROTATIONS: PlanRotation[] = [0, 90, 180, 270];

function angularDistance(a: number, b: number) {
  const diff = Math.abs(normalizeDegrees(a) - normalizeDegrees(b));
  return Math.min(diff, 360 - diff);
}

function normalizeDegrees(value: number) {
  return ((Number(value || 0) % 360) + 360) % 360;
}

function textAngle(item: { transform?: number[] }) {
  const transform = item.transform || [];
  return ((Math.atan2(Number(transform[1]) || 0, Number(transform[0]) || 0) * 180 / Math.PI) % 360 + 360) % 360;
}

function scoreTextForRotation(
  textItems: Array<{ text?: string; x?: number; y?: number; width?: number; height?: number; transform?: number[] }>,
  rotation: PlanRotation,
  pageWidth: number,
  pageHeight: number,
) {
  let score = 0;
  const rotated = rotatedDimensions(pageWidth, pageHeight, rotation);
  for (const item of textItems || []) {
    const text = String(item.text || "").trim();
    if (!text) continue;
    const width = Math.abs(Number(item.width || 0));
    const height = Math.abs(Number(item.height || 0));
    const angle = textAngle(item);
    const candidateAngle = normalizeDegrees(angle + rotation);
    const uprightBaseline = angularDistance(candidateAngle, 0);
    const upsideDownBaseline = angularDistance(candidateAngle, 180);
    const sidewaysBaseline = Math.min(angularDistance(candidateAngle, 90), angularDistance(candidateAngle, 270));
    const horizontal = width >= height;
    const hasRoomLabel = /\b(bed|bath|kitchen|living|garage|entry|robe|wc|ens|alfresco|lounge|dining|laundry|pantry|void)\b/i.test(text);
    const hasDimension = /\b\d+(\.\d+)?\s*(mm|m)\b/i.test(text) || /\b1\s*:\s*\d+\b/.test(text);
    const hasDrawingTitle = /\b(plan|elevation|section|site|floor|ground|upper|lower|sheet|drawing|revision|scale)\b/i.test(text);
    const hasTitleBlockText = /\b(project|client|builder|drawing|sheet|date|revision|scale|north)\b/i.test(text);
    const rotatedPoint = applyRotation(
      { x: Number(item.x || 0), y: Number(item.y || 0) },
      pageWidth,
      pageHeight,
      rotation,
    );
    const inTitleBlockZone = rotatedPoint.y > rotated.height * 0.68 || rotatedPoint.x > rotated.width * 0.68;
    const base = Math.min(24, text.length);

    if (uprightBaseline <= 10) score += base * 5;
    else if (uprightBaseline <= 25) score += base * 2;
    else if (upsideDownBaseline <= 14) score -= base * 4;
    else if (sidewaysBaseline <= 18) score -= base * 2;
    else score -= base * 0.25;

    if (horizontal && uprightBaseline <= 20) score += base;
    if (hasRoomLabel && uprightBaseline <= 20) score += 32;
    if (hasDimension && uprightBaseline <= 20) score += 18;
    if (hasDrawingTitle && uprightBaseline <= 20) score += 20;
    if (hasTitleBlockText && inTitleBlockZone && uprightBaseline <= 25) score += 28;
  }
  return score;
}

export async function detectOrientation({
  pdfRotation = 0,
  textItems = [],
  vectorPaths = [],
  pageWidth = 0,
  pageHeight = 0,
}: {
  pdfRotation?: number;
  textItems?: Array<{ text?: string; x?: number; y?: number; width?: number; height?: number; transform?: number[] }>;
  vectorPaths?: Array<{ points?: Array<{ x: number; y: number }> }>;
  pageWidth?: number;
  pageHeight?: number;
}): Promise<OrientationResult> {
  const metadataRotation = normalizeRotation(pdfRotation);
  const readableText = textItems.filter((item) => String(item.text || "").trim().length >= 2);
  if (readableText.length < 3) {
    return {
      rotation: metadataRotation,
      confidence: 0.35,
      signals: {
        pdfMetadataRotation: metadataRotation,
        readableTextItems: readableText.length,
        vectorPathCount: vectorPaths.length,
        ocrFallback: "unavailable",
      },
    };
  }
  const lineScore = Math.min(40, (vectorPaths || []).length / 25);
  const scored = ROTATIONS.map((rotation) => ({
    rotation,
    score: scoreTextForRotation(readableText, rotation, pageWidth, pageHeight) + lineScore + (rotation === metadataRotation ? 12 : 0),
  })).sort((a, b) => b.score - a.score);
  const best = scored[0] || { rotation: metadataRotation, score: 0 };
  const second = scored[1] || { score: 0 };
  const confidence = Math.max(0.35, Math.min(0.98, 0.55 + (best.score - second.score) / Math.max(60, best.score || 1)));
  return {
    rotation: best.rotation,
    confidence,
    signals: {
      pdfMetadataRotation: metadataRotation,
      readableTextItems: textItems.length,
      vectorPathCount: vectorPaths.length,
      bestScore: Math.round(best.score),
      runnerUpScore: Math.round(second.score),
      ocrFallback: false,
    },
  };
}
