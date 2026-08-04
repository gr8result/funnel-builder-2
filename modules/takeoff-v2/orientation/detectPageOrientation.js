import { classifyTextItem, scoreOrientationCandidates, confidenceTier } from "./analyzeOrientation.js";
import { detectVectorLayoutOrientation } from "./vectorLayoutOrientation.js";
import { normaliseQuarterTurn } from "../types.js";

function vectorScoreReport(vectorResult) {
  const scores = vectorResult?.scores || {};
  return [0, 90, 180, 270].reduce((acc, rotation) => {
    acc[rotation] = {
      uprightEmbeddedTextCount: 0,
      upsideDownTextPenalty: 0,
      roomLabelScore: 0,
      titleBlockTextScore: vectorResult?.edgeScores ? (scores[rotation] || 0) : 0,
      horizontalTextLineScore: 0,
      finalWeightedScore: scores[rotation] || 0,
    };
    return acc;
  }, {});
}

function logOrientationDecision(pageNumber, result) {
  if (typeof process !== "undefined" && process.env.NODE_ENV === "production") return;
  const report = result.scoreReport || result.vectorScoreReport || result.textScoreReport;
  // eslint-disable-next-line no-console
  console.log("[takeoff-v2] orientation score report", {
    pageNumber,
    chosenRotation: result.detectedCorrection ?? result.bestRotation,
    source: result.source,
    confidence: result.confidence,
    scores: report,
  });
}

/**
 * Returns the clockwise correction to apply through pdf.js
 * getViewport({ rotation }), not the page's detected source angle.
 */
export async function detectPageOrientation(pdfDocument, pageNumber, { sourceWidth, sourceHeight }) {
  const page = await pdfDocument.getPage(pageNumber);
  const pdfMetadataRotation = normaliseQuarterTurn(page.rotate || 0);
  const textContent = await page.getTextContent();
  const textItems = (textContent.items || []).map(classifyTextItem).filter(Boolean);

  const textResult = scoreOrientationCandidates({ textItems, sourceWidth, sourceHeight, metadataRotation: pdfMetadataRotation });
  const textTier = confidenceTier(textResult);

  if (textTier === "high" || textTier === "medium") {
    const result = {
      ...textResult,
      bestRotation: normaliseQuarterTurn(textResult.bestRotation),
      detectedCorrection: normaliseQuarterTurn(textResult.bestRotation),
      pdfMetadataRotation,
      source: textItems.length ? "text-analysis" : "metadata",
      tier: textTier,
    };
    logOrientationDecision(pageNumber, result);
    return result;
  }

  const vectorResult = await detectVectorLayoutOrientation(pdfDocument, pageNumber, {
    sourceWidth,
    sourceHeight,
    metadataRotation: pdfMetadataRotation,
  });
  const useVector = vectorResult.hasSignal && (!textResult.hasSignal || vectorResult.confidence >= textResult.confidence);
  const result = useVector ? vectorResult : textResult;
  const tier = useVector ? confidenceTier({ hasSignal: true, confidence: vectorResult.confidence }) : textTier;

  const finalResult = {
    ...result,
    bestRotation: normaliseQuarterTurn(result.bestRotation),
    detectedCorrection: normaliseQuarterTurn(result.detectedCorrection ?? result.bestRotation),
    pdfMetadataRotation,
    source: useVector ? vectorResult.source : (textItems.length ? "text-analysis" : "metadata"),
    tier,
    textTier,
    textScores: textResult.scores,
    textScoreReport: textResult.scoreReport,
    vectorScores: vectorResult.scores,
    vectorScoreReport: vectorScoreReport(vectorResult),
  };
  logOrientationDecision(pageNumber, finalResult);
  return finalResult;
}
