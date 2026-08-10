export function createPdfImportBatchId(fileName = "", now = Date.now()) {
  const safeName = String(fileName || "standard-inclusions-pdf")
    .replace(/\.pdf$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "standard-inclusions-pdf";
  return `standard-inclusions-pdf-${safeName}-${now}`;
}

export function createStableImportedPdfPageId(importId, pageNumber) {
  const number = Math.max(1, Number(pageNumber || 1));
  return `${importId}-page-${String(number).padStart(2, "0")}`;
}

export function createPdfDetectedTextRegion({ pageId, index = 0, text = "", boundingBox = {}, confidence = 0 } = {}) {
  if (!pageId) throw new Error("PDF detected text region requires a pageId.");
  const number = Math.max(1, Number(index || 0) + 1);
  return {
    id: `${pageId}-text-region-${String(number).padStart(3, "0")}`,
    pageId,
    type: "text",
    boundingBox,
    detectedText: text,
    confidence: Number(confidence || 0),
  };
}
