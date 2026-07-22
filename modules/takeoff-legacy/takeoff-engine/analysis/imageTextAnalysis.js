import { normalizeRotation } from "../core/orientation.js";

export const TEXT_ANALYSIS_ROTATIONS = Object.freeze([0, 90, 180, 270]);

export function getPdfTextItemAngle(item) {
  const transform = item?.transform;
  if (!Array.isArray(transform) || transform.length < 4) {
    return 0;
  }

  return normalizeRotation(Math.atan2(transform[1], transform[0]) * (180 / Math.PI));
}

export function createEmptyTextRotationScores() {
  return TEXT_ANALYSIS_ROTATIONS.reduce((scores, rotation) => ({
    ...scores,
    [rotation]: 0,
  }), {});
}

function rankScores(scores) {
  return Object.entries(scores)
    .map(([rotation, score]) => ({ rotation: Number(rotation), score: Number(score || 0) }))
    .sort((a, b) => b.score - a.score);
}

export function analyzePdfTextDirection(textContent) {
  const items = Array.isArray(textContent?.items) ? textContent.items : [];
  const scores = createEmptyTextRotationScores();
  let readableCharacterCount = 0;

  for (const item of items) {
    const text = String(item?.str || "").trim();
    if (text.length < 2) {
      continue;
    }

    const angle = getPdfTextItemAngle(item);
    const correction = normalizeRotation(360 - angle);
    scores[correction] = (scores[correction] || 0) + text.length;
    readableCharacterCount += text.length;
  }

  const ranked = rankScores(scores);
  const best = ranked[0] || { rotation: 0, score: 0 };
  const second = ranked[1] || { rotation: 0, score: 0 };
  const confidence = readableCharacterCount > 0 && best.score >= Math.max(20, second.score * 2.4)
    ? "high"
    : readableCharacterCount > 0
      ? "low"
      : "none";

  return {
    selectedRotation: best.rotation,
    suggestedRotation: best.rotation,
    confidence,
    confidenceScore: readableCharacterCount ? best.score / Math.max(1, readableCharacterCount) : 0,
    reason: readableCharacterCount
      ? `PDF text direction favours ${best.rotation} degrees.`
      : "No usable PDF text items were found.",
    scores,
    ranked,
    readableCharacterCount,
    method: readableCharacterCount ? "pdf-text-direction" : "pdf-text-unavailable",
  };
}

export function createOcrAdapter(adapter = null) {
  return {
    async recognize(input = {}) {
      if (adapter && typeof adapter.recognize === "function") {
        return adapter.recognize(input);
      }

      if (typeof window !== "undefined" && window.takeoffOcrAdapter?.recognize) {
        return window.takeoffOcrAdapter.recognize(input);
      }

      return {
        text: "",
        lines: [],
        words: [],
        confidence: 0,
        available: false,
        reason: "Raster OCR adapter is not connected yet.",
      };
    },
  };
}

export function scoreOcrTextOrientation(ocrResult = {}) {
  const scores = createEmptyTextRotationScores();
  const lines = Array.isArray(ocrResult.lines) ? ocrResult.lines : [];
  let usableLineCount = 0;
  let totalWeight = 0;

  for (const line of lines) {
    const text = String(line?.text || "").trim();
    if (text.length < 2) {
      continue;
    }

    const rawAngle = Number(line.angle ?? line.rotation ?? 0);
    const correction = normalizeRotation(360 - rawAngle);
    const confidence = Math.max(0, Math.min(1, Number(line.confidence ?? ocrResult.confidence ?? 0.5)));
    const weight = text.length * Math.max(0.2, confidence);
    scores[correction] += weight;
    totalWeight += weight;
    usableLineCount += 1;
  }

  const ranked = rankScores(scores);
  const best = ranked[0] || { rotation: 0, score: 0 };
  const second = ranked[1] || { rotation: 0, score: 0 };
  const dominance = totalWeight ? best.score / totalWeight : 0;
  const confidence = usableLineCount >= 3 && dominance >= 0.72 && best.score >= second.score * 2.1
    ? "high"
    : usableLineCount
      ? "low"
      : "none";

  return {
    selectedRotation: best.rotation,
    suggestedRotation: best.rotation,
    confidence,
    confidenceScore: dominance,
    reason: usableLineCount
      ? `OCR text direction favours ${best.rotation} degrees from ${usableLineCount} lines.`
      : (ocrResult.reason || "No OCR text lines were available."),
    scores,
    ranked,
    readableCharacterCount: Math.round(totalWeight),
    method: ocrResult.available === false ? "raster-ocr-adapter-unavailable" : "raster-ocr-text-direction",
  };
}

export async function analyzeRasterTextDirection({ imageDataUrl = "", imageWidth = 0, imageHeight = 0, ocrAdapter = null } = {}) {
  const adapter = createOcrAdapter(ocrAdapter);
  const ocrResult = await adapter.recognize({ imageDataUrl, imageWidth, imageHeight });
  return scoreOcrTextOrientation(ocrResult);
}
