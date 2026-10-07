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

export function createPdfDetectedImageRegion({ pageId, index = 0, boundingBox = {}, confidence = 0 } = {}) {
  if (!pageId) throw new Error("PDF detected image region requires a pageId.");
  const number = Math.max(1, Number(index || 0) + 1);
  return {
    id: `${pageId}-image-region-${String(number).padStart(3, "0")}`,
    pageId,
    type: "image",
    boundingBox,
    detectedText: "",
    confidence: Number(confidence || 0),
  };
}

export function normalisePdfOverlayBlock(object = {}, pageId = "") {
  const data = object.data || {};
  const rawType = String(object.type || "shape").toUpperCase();
  const type = rawType === "DYNAMICFIELD" ? "TEXT" : rawType === "DIVIDER" ? "SHAPE" : rawType;
  return {
    id: object.id || data.regionId || "",
    pageId,
    type: ["TEXT", "HEADING", "IMAGE", "LOGO", "SHAPE"].includes(type) ? type : "SHAPE",
    x: Number(object.x || 0),
    y: Number(object.y || 0),
    width: Number(object.width || 0),
    height: Number(object.height || 0),
    rotation: Number(object.rotation || 0),
    zIndex: Number(object.layer ?? object.zIndex ?? 0),
    content: data.text || data.imageRef || "",
    style: { ...(object.style || {}) },
    source: data.editableSource || data.overlayMode || data.source || "pdf",
    confidence: Number(data.confidence ?? data.detectedConfidence ?? 0),
  };
}

export function createPdfHybridPageModel(page = {}, order = 0) {
  const baseArtwork = page.data?.originalPageAsset || page.background?.imageRef || page.baseArtwork || "";
  const blocks = (page.objects || [])
    .filter((object) => object?.data?.acceptedEdit || object?.data?.manualRegion || !object?.data?.detectedRegion)
    .map((object) => normalisePdfOverlayBlock(object, page.id));
  const masks = Array.isArray(page.data?.acceptedMasks) ? page.data.acceptedMasks : [];
  return {
    id: page.id || "",
    width: Number(page.width || 794),
    height: Number(page.height || 1123),
    order: Number(order || 0),
    baseArtwork,
    blocks,
    masks,
  };
}

export function createPdfImportReviewSummary({
  pageCount = 0,
  editableTextCount = 0,
  editableImageCount = 0,
  preservedElementCount = 0,
  needsReviewCount = 0,
} = {}) {
  return {
    status: "IMPORT COMPLETE",
    pageCount: Math.max(0, Number(pageCount) || 0),
    editableTextCount: Math.max(0, Number(editableTextCount) || 0),
    editableImageCount: Math.max(0, Number(editableImageCount) || 0),
    preservedElementCount: Math.max(0, Number(preservedElementCount) || 0),
    needsReviewCount: Math.max(0, Number(needsReviewCount) || 0),
  };
}
