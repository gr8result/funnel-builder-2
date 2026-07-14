const SCALE_TEXT_PATTERN = /\b(?:SCALE\s*)?(?:1\s*[:/]\s*(\d{2,4})|(\d{1,2})\s*:\s*(\d{2,4}))\b/gi;
const SHEET_SIZE_PATTERN = /@\s*(A[0-5])\b/gi;
const DIMENSION_PATTERN = /\b(?:\d{1,3}(?:,\d{3})+|\d{4,6})(?:\s*mm)?\b/gi;

export function normalizeTextForScaleDetection(text = "") {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/[ï¼šâˆ¶]/g, ":")
    .trim();
}

export function extractScaleText(text = "") {
  const normalized = normalizeTextForScaleDetection(text);
  const candidates = [];
  const seen = new Set();

  for (const match of normalized.matchAll(SCALE_TEXT_PATTERN)) {
    const ratio = match[1] || match[3];
    if (!ratio) {
      continue;
    }

    const value = `1:${Number(ratio)}`;
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    candidates.push({
      text: match[0].trim(),
      normalized: value,
      ratio: Number(ratio),
      source: "scale-text",
      confidence: match[0].toUpperCase().includes("SCALE") ? "high" : "low",
      index: match.index ?? -1,
    });
  }

  for (const match of normalized.matchAll(SHEET_SIZE_PATTERN)) {
    const value = `@ ${String(match[1]).toUpperCase()}`;
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    candidates.push({
      text: match[0].trim(),
      normalized: value,
      ratio: null,
      source: "sheet-size",
      confidence: "context",
      index: match.index ?? -1,
    });
  }

  return candidates.sort((a, b) => a.index - b.index);
}

export function extractDimensionText(text = "") {
  const normalized = normalizeTextForScaleDetection(text);
  const candidates = [];
  const seen = new Set();

  for (const match of normalized.matchAll(DIMENSION_PATTERN)) {
    const raw = match[0].trim();
    const valueMm = Number(raw.replace(/,/g, "").replace(/mm/gi, "").trim());
    if (!Number.isFinite(valueMm) || valueMm < 1000) {
      continue;
    }
    if (seen.has(valueMm)) {
      continue;
    }
    seen.add(valueMm);
    candidates.push({
      text: raw,
      normalized: `${Math.round(valueMm).toLocaleString()} mm`,
      valueMm,
      source: "dimension-text",
      confidence: raw.includes(",") || /mm/i.test(raw) ? "medium" : "low",
      index: match.index ?? -1,
    });
  }

  return candidates.sort((a, b) => a.index - b.index);
}

export function bestScaleTextCandidate(text = "") {
  const candidates = extractScaleText(text);
  return candidates.find((candidate) => candidate.source === "scale-text") || candidates[0] || null;
}

export function createScaleSuggestion({ scaleCandidate = null, sheetCandidates = [], dimensionCandidates = [], dpi = 300, source = "text" } = {}) {
  if (!scaleCandidate?.ratio) {
    return null;
  }

  const ratio = Number(scaleCandidate.ratio);
  const pixelsPerPrintedMm = Number(dpi || 300) / 25.4;
  const pixelsPerMm = pixelsPerPrintedMm / ratio;
  const mmPerPixel = ratio / pixelsPerPrintedMm;

  return {
    id: `scale-suggestion-${ratio}`,
    label: `Suggested scale: 1:${ratio}`,
    normalized: `1:${ratio}`,
    ratio,
    dpi: Number(dpi || 300),
    pixelsPerMm,
    mmPerPixel,
    pixelsPerMillimetre: pixelsPerMm,
    millimetresPerPixel: mmPerPixel,
    source,
    confidence: scaleCandidate.confidence || "low",
    requiresConfirmation: true,
    scaleCandidate,
    sheetCandidates,
    dimensionCandidates,
    detectedDimensionsMm: dimensionCandidates.map((candidate) => candidate.valueMm),
  };
}

export function detectScaleSuggestions({ text = "", ocrText = "", dpi = 300, source = "import-text" } = {}) {
  const combined = normalizeTextForScaleDetection(`${text || ""} ${ocrText || ""}`);
  const scaleCandidates = extractScaleText(combined);
  const dimensionCandidates = extractDimensionText(combined);
  const sheetCandidates = scaleCandidates.filter((candidate) => candidate.source === "sheet-size");
  const scaleTextCandidates = scaleCandidates.filter((candidate) => candidate.source === "scale-text");
  const suggestions = scaleTextCandidates
    .map((candidate) => createScaleSuggestion({
      scaleCandidate: candidate,
      sheetCandidates,
      dimensionCandidates,
      dpi,
      source,
    }))
    .filter(Boolean);

  return {
    suggestions,
    scaleTextCandidates,
    sheetCandidates,
    dimensionCandidates,
    bestSuggestion: suggestions[0] || null,
  };
}

export async function detectScaleSuggestionsWithOcr({
  imageDataUrl = "",
  imageWidth = 0,
  imageHeight = 0,
  dpi = 300,
  text = "",
  ocrAdapter = null,
  source = "raster-ocr",
} = {}) {
  let ocrText = "";
  let ocrAvailable = false;
  let ocrReason = "OCR adapter is not connected yet.";

  const adapter = ocrAdapter || (typeof window !== "undefined" ? window.takeoffOcrAdapter : null);
  if (adapter && typeof adapter.recognize === "function") {
    const result = await adapter.recognize({ imageDataUrl, imageWidth, imageHeight });
    ocrText = String(result?.text || [
      ...(Array.isArray(result?.lines) ? result.lines.map((line) => line?.text || "") : []),
      ...(Array.isArray(result?.words) ? result.words.map((word) => word?.text || "") : []),
    ].join(" "));
    ocrAvailable = result?.available !== false;
    ocrReason = result?.reason || (ocrAvailable ? "OCR adapter returned text." : ocrReason);
  }

  const detection = detectScaleSuggestions({ text, ocrText, dpi, source });
  return {
    ...detection,
    ocr: {
      available: ocrAvailable,
      reason: ocrReason,
      textLength: ocrText.length,
    },
  };
}
