import { classifyTextItem, scoreOrientationCandidates, confidenceTier } from "./analyzeOrientation.js";

/**
 * Runs automatic orientation detection for one page using native pdf.js text
 * extraction. Only ever called from the "first import" path (PlanDocumentList
 * upload) or an explicit user-triggered Re-detect Orientation click — never on
 * a plain reload of an already-saved page.
 */
export async function detectPageOrientation(pdfDocument, pageNumber, { sourceWidth, sourceHeight }) {
  const page = await pdfDocument.getPage(pageNumber);
  const textContent = await page.getTextContent();
  const textItems = (textContent.items || []).map(classifyTextItem).filter(Boolean);

  const result = scoreOrientationCandidates({ textItems, sourceWidth, sourceHeight, metadataRotation: page.rotate || 0 });
  const tier = confidenceTier(result);

  return { ...result, tier };
}
