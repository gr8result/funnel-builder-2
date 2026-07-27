import { createDocument } from "../../components/document-engine/core/documentState.js";
import { createA4Page } from "../../components/document-engine/core/pageEngine.js";
import { createObject } from "../../components/document-engine/core/objectEngine.js";

// 96 CSS px per inch, 72 PDF points per inch — this is why a standard A4 PDF
// (595.28 x 841.89 pt) lands almost exactly on the document engine's existing
// 794x1123 A4 default. Pages keep their own native aspect ratio instead of
// being force-scaled into a fixed box, so landscape/non-A4 PDFs import
// undistorted.
const CSS_PIXELS_PER_POINT = 96 / 72;

// Real per-page raster render used as a last-resort fallback for pages that
// yield no extractable objects (e.g. a scanned photo page), and as the OCR
// source image when a text-free page is run through the OCR fallback.
const FALLBACK_RENDER_SCALE = 2.25;
const HYBRID_RENDER_SCALE = 2.75;

const MIN_OBJECT_SIZE = 2;
const DEFAULT_TEXT_COLOR = "#0f172a";
// A page importing more objects than this still imports in full, but the
// import report flags it as unusually complex so the user knows to expect a
// slower editor rather than assuming something broke.
const COMPLEXITY_WARNING_THRESHOLD = 220;
// Two text objects are treated as duplicates (common when a PDF simulates
// bold by drawing the same run twice, or a content stream repeats a block)
// when their boxes overlap this much AND their text matches exactly.
const DUPLICATE_OVERLAP_THRESHOLD = 0.85;
const PAGE_COVERAGE_THRESHOLD = 0.82;
const HYBRID_NATIVE_OBJECT_LIMIT = 180;
const HYBRID_TEXT_OVERLAY_LIMIT = 90;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function importPdfAsStandardDocumentPreview(file, {
  onProgress = null,
  pdfjsLib = null,
  loadPdfJs = null,
  uploadAsset = null,
  runOcr = null,
} = {}) {
  const lib = pdfjsLib || (await (loadPdfJs || defaultLoadPdfJs)());
  const bytes = await readFileBytes(file);
  const pdf = await lib.getDocument({ data: bytes }).promise;
  const upload = uploadAsset || defaultUploadAsset;
  const ocr = runOcr || defaultRunOcr;

  const pages = [];
  const warnings = [];
  const pageReports = [];
  let editableTextCount = 0;
  let fixedVisualCount = 0;
  let ocrPageCount = 0;
  const imageCache = new Map();
  const fontSubstitutions = new Map(); // key: `${original}|${substituted}` -> { originalFont, substitutedFont, method, count }

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    onProgress?.({ pageNumber, pageCount: pdf.numPages });
    const page = await pdf.getPage(pageNumber);
    let pageResult;
    try {
      pageResult = await extractPdfPage({ lib, page, upload, imageCache, fontSubstitutions });
    } catch (error) {
      console.warn(`[pdfImport] Page ${pageNumber} object extraction failed; falling back to a locked page image.`, error);
      pageResult = null;
    }

    if (!pageResult || !pageResult.objects.length) {
      const fallback = await renderPageAsFallbackImage({ page, upload });
      const ocrResult = await attemptOcrFallback({ fallback, page, ocr, pageNumber });
      const pageId = `standard-inclusions-pdf-page-${Date.now()}-${pageNumber}`;
      const objects = [];
      if (fallback.imageRef) {
        objects.push(createObject("image", {
          name: `Page ${pageNumber} (locked)`,
          x: 0,
          y: 0,
          width: fallback.width,
          height: fallback.height,
          locked: !ocrResult.textObjects.length, // keep unlocked as a plain background once OCR text sits on top
          style: { objectFit: "cover" },
          data: { imageRef: fallback.imageRef, alt: `PDF page ${pageNumber}`, fixedVisual: true },
        }));
      }
      objects.push(...ocrResult.textObjects);
      pages.push(createA4Page({ id: pageId, name: `PDF Page ${pageNumber}`, width: fallback.width, height: fallback.height, objects }));
      fixedVisualCount += 1;
      if (ocrResult.textObjects.length) {
        ocrPageCount += 1;
        editableTextCount += ocrResult.textObjects.length;
        warnings.push(`Page ${pageNumber} had no PDF text layer; ${ocrResult.textObjects.length} text box(es) were recovered via OCR (lower confidence) and kept over a background image.`);
      } else {
        warnings.push(`Page ${pageNumber} could not be converted to editable objects and was imported as a locked image.`);
      }
      pageReports.push({
        pageNumber,
        method: ocrResult.textObjects.length ? "ocr-fallback" : "locked-image-fallback",
        textCount: ocrResult.textObjects.length,
        imageCount: fallback.imageRef ? 1 : 0,
        shapeCount: 0,
        ocrConfidence: ocrResult.averageConfidence,
        warnings: ocrResult.textObjects.length
          ? [`OCR fallback used (avg. confidence ${Math.round(ocrResult.averageConfidence)}%)`]
          : ["No extractable text or objects; imported as a locked image."],
      });
      continue;
    }

    const hybrid = await maybeCreateHybridPage({ page, pageResult, upload, pageNumber });
    if (hybrid) {
      pages.push(createA4Page({
        id: `standard-inclusions-pdf-page-${Date.now()}-${pageNumber}`,
        name: `PDF Page ${pageNumber}`,
        width: hybrid.width,
        height: hybrid.height,
        objects: hybrid.objects,
      }));
      const textCount = hybrid.objects.filter((object) => object.type === "text").length;
      editableTextCount += textCount;
      fixedVisualCount += 1;
      warnings.push(`Page ${pageNumber} used hybrid import because native reconstruction was not reliable enough.`);
      pageReports.push({
        pageNumber,
        method: "hybrid-background-editable-text",
        importMode: "hybrid",
        textCount,
        imageCount: hybrid.objects.some((object) => object.type === "image") ? 1 : 0,
        shapeCount: 0,
        ocrConfidence: null,
        fidelityScore: hybrid.fidelityScore,
        failed: false,
        requiresFallbackChoice: false,
        warnings: hybrid.warnings,
      });
      continue;
    }

    const textCount = pageResult.objects.filter((object) => object.type === "text").length;
    const imageCount = pageResult.objects.filter((object) => object.type === "image").length;
    const shapeCount = pageResult.objects.filter((object) => object.type === "shape" || object.type === "divider").length;
    editableTextCount += textCount;

    const pageWarnings = [];
    if (pageResult.objects.length > COMPLEXITY_WARNING_THRESHOLD) {
      pageWarnings.push(`Page ${pageNumber} contains ${pageResult.objects.length} objects, which is unusually complex — the editor may feel slower on this page.`);
      warnings.push(pageWarnings[pageWarnings.length - 1]);
    }
    if (pageResult.droppedComplexPaths > 0) {
      pageWarnings.push(`${pageResult.droppedComplexPaths} complex decorative path(s) on page ${pageNumber} could not be reconstructed as editable shapes and were left out (visible only if this page uses a background fallback).`);
    }
    if (pageResult.validation?.warnings?.length) {
      pageWarnings.push(...pageResult.validation.warnings);
      warnings.push(...pageResult.validation.warnings.map((warning) => `Page ${pageNumber}: ${warning}`));
    }

    pages.push(createA4Page({
      id: `standard-inclusions-pdf-page-${Date.now()}-${pageNumber}`,
      name: `PDF Page ${pageNumber}`,
      width: pageResult.width,
      height: pageResult.height,
      objects: pageResult.objects,
    }));
    pageReports.push({
      pageNumber,
      method: "pdf-text-extraction",
      importMode: "native",
      textCount,
      imageCount,
      shapeCount,
      ocrConfidence: null,
      fidelityScore: pageResult.validation?.fidelityScore ?? null,
      failed: Boolean(pageResult.validation?.failed),
      requiresFallbackChoice: Boolean(pageResult.validation?.failed),
      warnings: pageWarnings,
    });
  }

  const timestamp = new Date().toISOString();
  const documentBuilder = createDocument({
    id: `standard-inclusions-pdf-${Date.now()}`,
    name: file.name.replace(/\.pdf$/i, "") || "Imported PDF Standard Inclusions",
    pages,
    activePageId: pages[0]?.id || null,
    metadata: {
      documentType: "standardInclusions",
      documentSource: "pdf-import",
      sourceFileName: file.name,
      importedAt: timestamp,
      lastSavedAt: timestamp,
    },
  });

  return {
    source: "pdf-import",
    fileName: file.name,
    document: documentBuilder,
    pageCount: pages.length,
    editableTextCount,
    fixedVisualCount,
    ocrPageCount,
    warnings,
    pageReports,
    fontSubstitutions: Array.from(fontSubstitutions.values()),
    // Kept in-memory only (never persisted) so the review screen's
    // "Reprocess page" / "Use page as flat image" actions can re-run a
    // single page without re-uploading/re-parsing the whole file.
    _pdf: pdf,
    _lib: lib,
  };
}

// Re-extracts a single page from an already-open pdf.js document — used by
// the import review screen's "Reprocess page" action so a transient
// extraction error on one page doesn't require re-uploading the whole file.
export async function reprocessPdfPage(pdf, pageNumber, { lib = null, upload = null } = {}) {
  const pdfjsLib = lib || (await defaultLoadPdfJs());
  const page = await pdf.getPage(pageNumber);
  const fontSubstitutions = new Map();
  const imageCache = new Map();
  const result = await extractPdfPage({ lib: pdfjsLib, page, upload: upload || defaultUploadAsset, imageCache, fontSubstitutions });
  return {
    width: result.width,
    height: result.height,
    objects: result.objects,
    fontSubstitutions: Array.from(fontSubstitutions.values()),
  };
}

// Renders a single page as one locked full-page image — used by the import
// review screen's "Use page as flat image" action for pages the user decides
// are too complex/decorative to keep editable.
export async function flattenPdfPageToImage(pdf, pageNumber, { upload = null } = {}) {
  const page = await pdf.getPage(pageNumber);
  const fallback = await renderPageAsFallbackImage({ page, upload: upload || defaultUploadAsset });
  return {
    width: fallback.width,
    height: fallback.height,
    objects: fallback.imageRef ? [createObject("image", {
      name: `Page ${pageNumber} (locked)`,
      x: 0,
      y: 0,
      width: fallback.width,
      height: fallback.height,
      locked: true,
      style: { objectFit: "cover" },
      data: { imageRef: fallback.imageRef, alt: `PDF page ${pageNumber}`, fixedVisual: true },
    })] : [],
  };
}

export async function hybridPdfPageToDocumentObjects(pdf, pageNumber, { lib = null, upload = null } = {}) {
  const pdfjsLib = lib || (await defaultLoadPdfJs());
  const page = await pdf.getPage(pageNumber);
  const fontSubstitutions = new Map();
  const imageCache = new Map();
  const pageResult = await extractPdfPage({ lib: pdfjsLib, page, upload: upload || defaultUploadAsset, imageCache, fontSubstitutions });
  const fallback = await renderPageAsFallbackImage({ page, upload: upload || defaultUploadAsset, renderScale: HYBRID_RENDER_SCALE });
  return createHybridObjectsFromPageResult({ pageResult, fallback, pageNumber });
}

async function readFileBytes(file) {
  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer);
}

async function defaultLoadPdfJs() {
  const { loadPdfJs } = await import("../../components/estimate-builder/ai-takeoff/pdfPlanRendering.js");
  return loadPdfJs();
}

async function defaultUploadAsset(dataUrl) {
  const response = await fetch("/api/standard-inclusions/pdf-import/upload-asset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataUrl }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Failed to upload an extracted PDF image.");
  return payload.url;
}

// Lazy-loaded, gracefully-degrading OCR (mirrors the eval-require pattern
// already used for puppeteer in pages/api/track/render-thumbnail.js) — OCR is
// a fallback path only, so its absence must never break the rest of the
// import.
async function defaultRunOcr(canvas) {
  try {
    const { default: Tesseract } = await import("tesseract.js");
    const { data } = await Tesseract.recognize(canvas, "eng");
    return {
      words: (data?.words || []).map((word) => ({
        text: word.text,
        confidence: word.confidence,
        bbox: word.bbox, // { x0, y0, x1, y1 } in canvas pixel space
      })),
    };
  } catch (error) {
    console.warn("[pdfImport] OCR unavailable or failed; page will import as a locked image instead.", error?.message || error);
    return { words: [] };
  }
}

// ---------------------------------------------------------------------------
// Coordinate helpers — the PDF page's own point space is the stable source
// coordinate system; every extracted object is normalised into CSS pixels at
// this single conversion point so no other component re-derives its own
// scaling. Named per the brief so future callers reuse these rather than
// inventing another inconsistent conversion.
// ---------------------------------------------------------------------------

export function pdfPointToEditorPoint(x, y) {
  return { x: x * CSS_PIXELS_PER_POINT, y: y * CSS_PIXELS_PER_POINT };
}

export function editorPointToPdfPoint(x, y) {
  return { x: x / CSS_PIXELS_PER_POINT, y: y / CSS_PIXELS_PER_POINT };
}

export function pdfRectToEditorRect(rect) {
  return {
    x: rect.x * CSS_PIXELS_PER_POINT,
    y: rect.y * CSS_PIXELS_PER_POINT,
    width: rect.width * CSS_PIXELS_PER_POINT,
    height: rect.height * CSS_PIXELS_PER_POINT,
  };
}

export function normalisePdfRotation(rotation) {
  return ((Number(rotation) || 0) % 360 + 360) % 360;
}

export const normalisePdfPageRotation = normalisePdfRotation;

export function pdfPointToDocumentPoint(x, y) {
  return pdfPointToEditorPoint(x, y);
}

export function documentPointToPdfPoint(x, y) {
  return editorPointToPdfPoint(x, y);
}

export function pdfRectToDocumentRect(rect) {
  return pdfRectToEditorRect(rect);
}

export function applyPdfTransform(matrix, x, y) {
  return applyMatrix(matrix, x, y);
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

// Matrices are the standard PDF/canvas 6-tuple [a, b, c, d, e, f] representing
//   | a  c  e |
//   | b  d  f |
//   | 0  0  1 |
// composeMatrix(ctm, m) returns the matrix that applies `m` first, then `ctm`
// — i.e. ctm ∘ m — matching how a PDF `cm` operator prepends a local
// transform under the current CTM, and how a glyph's text matrix is applied
// before the page viewport transform.
function composeMatrix(ctm, m) {
  return [
    ctm[0] * m[0] + ctm[2] * m[1],
    ctm[1] * m[0] + ctm[3] * m[1],
    ctm[0] * m[2] + ctm[2] * m[3],
    ctm[1] * m[2] + ctm[3] * m[3],
    ctm[0] * m[4] + ctm[2] * m[5] + ctm[4],
    ctm[1] * m[4] + ctm[3] * m[5] + ctm[5],
  ];
}

function applyMatrix(m, x, y) {
  return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
}

// Decomposes an affine matrix into an axis-aligned bounding box + rotation,
// for placing a rectangular object (text line, image, shape) on the page.
function boxFromMatrix(m, localWidth, localHeight) {
  const corners = [
    applyMatrix(m, 0, 0),
    applyMatrix(m, localWidth, 0),
    applyMatrix(m, localWidth, localHeight),
    applyMatrix(m, 0, localHeight),
  ];
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const rotation = (Math.atan2(m[1], m[0]) * 180) / Math.PI;
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
    rotation: normalisePdfRotation(rotation),
  };
}

function boxFromPoints(points) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}

export function boxOverlapRatio(a, b) {
  const left = Math.max(a.x, b.x);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const top = Math.max(a.y, b.y);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  if (right <= left || bottom <= top) return 0;
  const overlapArea = (right - left) * (bottom - top);
  const smallerArea = Math.min(a.width * a.height, b.width * b.height) || 1;
  return overlapArea / smallerArea;
}

function objectCoverageRatio(object, pageWidth, pageHeight) {
  const pageArea = Math.max(1, pageWidth * pageHeight);
  const width = Math.max(0, Math.min(object.x + object.width, pageWidth) - Math.max(object.x, 0));
  const height = Math.max(0, Math.min(object.y + object.height, pageHeight) - Math.max(object.y, 0));
  return (width * height) / pageArea;
}

function isDarkHex(value = "") {
  const match = /^#([0-9a-f]{6})$/i.exec(String(value || ""));
  if (!match) return false;
  const n = Number.parseInt(match[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b < 70;
}

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------

function clamp255(value) {
  return Math.max(0, Math.min(255, Math.round(value * 255)));
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((v) => clamp255(v).toString(16).padStart(2, "0")).join("")}`;
}

function grayToHex(g) {
  return rgbToHex(g, g, g);
}

function cmykToHex(c, m, y, k) {
  return rgbToHex((1 - c) * (1 - k), (1 - m) * (1 - k), (1 - y) * (1 - k));
}

// ---------------------------------------------------------------------------
// Fonts — explicit substitution map first (reported to the user), heuristic
// serif/mono/sans fallback only when a font has no explicit mapping.
// ---------------------------------------------------------------------------

export const fontFallbackMap = {
  "CanvaSans-Regular": "Arial",
  "CanvaSans-Bold": "Arial",
  Aptos: "Arial",
  Montserrat: "Montserrat",
  "Open Sans": "Open Sans",
  OpenSans: "Open Sans",
  Poppins: "Poppins",
  Lato: "Lato",
  Roboto: "Roboto",
};

const SERIF_KEYWORDS = /times|georgia|garamond|serif|minion|cambria|book/i;
const MONO_KEYWORDS = /courier|consolas|mono|menlo/i;

function cleanFontName(rawName = "") {
  return String(rawName || "").replace(/^[A-Z]{6}\+/, "").trim();
}

export function mapFontFamily(rawName, genericFamily, fontSubstitutions) {
  const cleaned = cleanFontName(rawName);
  const mapKey = Object.keys(fontFallbackMap).find((key) => key.toLowerCase() === cleaned.toLowerCase());
  let substituted;
  let method;
  if (mapKey) {
    substituted = fontFallbackMap[mapKey];
    method = "mapped";
  } else if (SERIF_KEYWORDS.test(cleaned) || /serif/i.test(genericFamily)) {
    substituted = "Georgia, 'Times New Roman', serif";
    method = "heuristic";
  } else if (MONO_KEYWORDS.test(cleaned) || /mono/i.test(genericFamily)) {
    substituted = "'Courier New', Consolas, monospace";
    method = "heuristic";
  } else {
    substituted = "Inter, Arial, sans-serif";
    method = "heuristic";
  }

  if (cleaned && fontSubstitutions) {
    const key = `${cleaned}|${substituted}`;
    const existing = fontSubstitutions.get(key);
    if (existing) existing.count += 1;
    else fontSubstitutions.set(key, { originalFont: cleaned, substitutedFont: substituted, method, count: 1 });
  }

  return substituted;
}

function resolveFontDescriptor(page, fontName) {
  try {
    if (page.commonObjs?.has && !page.commonObjs.has(fontName)) return null;
    let resolved = null;
    const returned = page.commonObjs.get(fontName, (data) => { resolved = data; });
    return returned || resolved || null;
  } catch {
    return null;
  }
}

function fontStyleFor(page, item, styles, fontSubstitutions) {
  const descriptor = resolveFontDescriptor(page, item.fontName);
  const genericFamily = styles?.[item.fontName]?.fontFamily || "";
  const rawName = descriptor?.name || descriptor?.loadedName || genericFamily;
  const bold = Boolean(descriptor?.bold) || /bold|black|heavy/i.test(rawName);
  const italic = Boolean(descriptor?.italic) || /italic|oblique/i.test(rawName);
  return {
    fontFamily: mapFontFamily(rawName, genericFamily, fontSubstitutions),
    bold,
    italic,
  };
}

// ---------------------------------------------------------------------------
// Vector path classification: rectangles, divider lines, and circles/ellipses
// (the common decorative shapes Canva schedules use). Anything else (an
// arbitrary polygon, a complex multi-curve illustration) is intentionally
// left unrecognised — per the brief, complex artwork stays flattened rather
// than forcing a fragile reconstruction.
// ---------------------------------------------------------------------------

function walkPathSegments(lib, subOps, coords) {
  const OPS = lib.OPS || {};
  const segments = [];
  let cursor = 0;
  for (const subOp of subOps) {
    if (subOp === OPS.moveTo || subOp === OPS.lineTo) {
      const x = coords[cursor];
      const y = coords[cursor + 1];
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      segments.push({ type: subOp === OPS.moveTo ? "move" : "line", x, y });
      cursor += 2;
    } else if (subOp === OPS.curveTo) {
      const x = coords[cursor + 4];
      const y = coords[cursor + 5];
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      segments.push({ type: "curve", x, y });
      cursor += 6;
    } else if (subOp === OPS.closePath) {
      segments.push({ type: "close" });
    } else {
      return null; // unsupported/complex sub-op — bail out, leave path unrecognised
    }
  }
  return segments;
}

// pdf.js represents a constructPath op as [subOps, coords, ...]. Recognises:
//   - the fast-path OPS.rectangle sub-op ([x, y, w, h])
//   - an axis-aligned 4-point polygon (rectangle)
//   - a straight 2-point path (divider line)
//   - a mostly-curved closed path with a roughly square/circular bounding box
export function classifyVectorPath(lib, args) {
  const [subOps, coords] = args;
  if (!Array.isArray(subOps) || !Array.isArray(coords)) return null;

  if (subOps.length === 1) {
    // OPS.rectangle fast path: coords = [x, y, w, h]
    const [x, y, w, h] = coords;
    if (![x, y, w, h].every((v) => Number.isFinite(v))) return null;
    return { kind: "rect", local: { x: Math.min(x, x + w), y: Math.min(y, y + h), width: Math.abs(w), height: Math.abs(h) } };
  }

  const segments = walkPathSegments(lib, subOps, coords);
  if (!segments) return null;

  const points = segments.filter((s) => s.type === "move" || s.type === "line");
  const curves = segments.filter((s) => s.type === "curve");

  if (curves.length >= 2 && points.length <= 2) {
    // Curve-dominated closed path — treat as a circle/ellipse using the
    // bounding box of every anchor point (moves + curve endpoints).
    const anchors = segments.filter((s) => s.type === "move" || s.type === "curve");
    if (anchors.length < 3) return null;
    const box = boxFromPoints(anchors);
    if (box.width < MIN_OBJECT_SIZE || box.height < MIN_OBJECT_SIZE) return null;
    return { kind: "circle", local: box };
  }

  if (points.length === 2) {
    // A single moveTo+lineTo with no closePath is a divider line, not a
    // filled shape — even if the caller reached us via a `fill` op.
    return { kind: "line", local: boxFromPoints(points), points };
  }

  if (points.length >= 4 && points.length <= 5) {
    const box = boxFromPoints(points);
    const axisAligned = points.every((p) => Math.abs(p.x - box.x) < 0.5 || Math.abs(p.x - (box.x + box.width)) < 0.5)
      && points.every((p) => Math.abs(p.y - box.y) < 0.5 || Math.abs(p.y - (box.y + box.height)) < 0.5);
    if (!axisAligned) return null;
    return { kind: "rect", local: box };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Single unified operator-list pass: tracks CTM + fill/stroke colour for
// text-colour correlation, extracts image placements, and detects simple
// shapes (rectangles, divider lines, circles/ellipses). Z-order for every
// object type is derived from the same monotonically increasing `sequence`
// counter so the final page preserves the PDF's original draw order.
// ---------------------------------------------------------------------------

async function walkOperatorList({ lib, page, viewport, upload, imageCache }) {
  const opList = await page.getOperatorList();
  const opNames = reverseOpNames(lib);

  const showTextColours = []; // { sequence, color } aligned with showText occurrence order
  const shapes = [];
  const imagePlacements = [];
  const operatorCounts = {};
  let sequence = 0;
  let droppedComplexPaths = 0;

  const stack = [];
  let ctm = viewport.transform.slice();
  let fillColor = DEFAULT_TEXT_COLOR;
  let strokeColor = "transparent";
  let pendingPath = null;

  for (let i = 0; i < opList.fnArray.length; i += 1) {
    const opName = opNames.get(opList.fnArray[i]) || "";
    const args = opList.argsArray[i];
    if (opName) operatorCounts[opName] = (operatorCounts[opName] || 0) + 1;
    try {
      if (opName === "save") {
        stack.push({ ctm: ctm.slice(), fillColor, strokeColor });
      } else if (opName === "restore") {
        const prior = stack.pop();
        if (prior) { ctm = prior.ctm; fillColor = prior.fillColor; strokeColor = prior.strokeColor; }
      } else if (opName === "transform") {
        ctm = composeMatrix(ctm, args);
      } else if (opName === "setFillRGBColor") {
        fillColor = rgbToHex(args[0], args[1], args[2]);
      } else if (opName === "setStrokeRGBColor") {
        strokeColor = rgbToHex(args[0], args[1], args[2]);
      } else if (opName === "setFillGray") {
        fillColor = grayToHex(args[0]);
      } else if (opName === "setStrokeGray") {
        strokeColor = grayToHex(args[0]);
      } else if (opName === "setFillCMYKColor") {
        fillColor = cmykToHex(args[0], args[1], args[2], args[3]);
      } else if (opName === "setStrokeCMYKColor") {
        strokeColor = cmykToHex(args[0], args[1], args[2], args[3]);
      } else if (opName === "constructPath") {
        const classified = classifyVectorPath(lib, args);
        if (!classified && Array.isArray(args?.[0]) && args[0].length > 1) droppedComplexPaths += 1;
        pendingPath = classified;
      } else if (opName === "clip" || opName === "eoClip" || opName === "endPath") {
        pendingPath = null;
      } else if (opName === "fill" || opName === "eoFill" || opName === "fillStroke" || opName === "eoFillStroke" || opName === "stroke" || opName === "closeFillStroke") {
        if (pendingPath) {
          const isStrokeOnly = opName === "stroke";
          // classifyVectorPath always returns `local` as a path-space
          // {x,y,width,height} box (for a line, the box spanning its two
          // endpoints) — translate it into the CTM the same way regardless
          // of shape kind.
          const box = boxFromMatrix(
            composeMatrix(ctm, [1, 0, 0, 1, pendingPath.local.x, pendingPath.local.y]),
            Math.max(pendingPath.local.width, MIN_OBJECT_SIZE),
            Math.max(pendingPath.local.height, MIN_OBJECT_SIZE)
          );
          shapes.push({
            sequence: sequence += 1,
            kind: pendingPath.kind,
            box,
            fill: isStrokeOnly ? "transparent" : fillColor,
            stroke: (opName === "fillStroke" || opName === "eoFillStroke" || opName === "stroke") ? (strokeColor || "transparent") : "transparent",
          });
        }
        pendingPath = null;
      } else if (opName === "paintImageXObject" || opName === "paintJpegXObject") {
        const objId = args[0];
        const box = boxFromMatrix(ctm, 1, 1);
        imagePlacements.push({ sequence: sequence += 1, objId, box, inlineImage: null });
      } else if (opName === "paintInlineImageXObject") {
        const box = boxFromMatrix(ctm, 1, 1);
        imagePlacements.push({ sequence: sequence += 1, objId: `inline-${i}`, box, inlineImage: args?.[0] || null });
      } else if (opName === "paintImageMaskXObject" || opName === "paintImageMaskXObjectGroup" || opName === "paintImageXObjectRepeat" || opName === "paintSolidColorImageMask") {
        const box = boxFromMatrix(ctm, 1, 1);
        imagePlacements.push({ sequence: sequence += 1, objId: `${opName}-${i}`, box, unsupported: true });
      } else if (opName === "showText" || opName === "showSpacedText") {
        showTextColours.push({ sequence: sequence += 1, color: fillColor });
      }
    } catch (error) {
      // Best-effort: one malformed op should never abort the whole page.
      console.warn("[pdfImport] Skipped an unrecognised PDF drawing operation", opName, error?.message || error);
    }
  }

  const images = [];
  const seenPlacements = new Set();
  for (const placement of imagePlacements) {
    const key = `${placement.objId}:${Math.round(placement.box.x)}:${Math.round(placement.box.y)}:${Math.round(placement.box.width)}:${Math.round(placement.box.height)}`;
    if (seenPlacements.has(key)) continue;
    seenPlacements.add(key);
    if (placement.box.width < MIN_OBJECT_SIZE || placement.box.height < MIN_OBJECT_SIZE) continue;
    try {
      if (placement.unsupported) continue;
      const imageRef = placement.inlineImage
        ? await uploadInlineImage({ image: placement.inlineImage, upload })
        : await resolveAndUploadImage({ page, objId: placement.objId, upload, imageCache });
      if (imageRef) images.push({ sequence: placement.sequence, box: placement.box, imageRef });
    } catch (error) {
      console.warn("[pdfImport] Could not extract an embedded image", placement.objId, error?.message || error);
    }
  }

  return { showTextColours, shapes, images, droppedComplexPaths, operatorCounts };
}

function reverseOpNames(lib) {
  const map = new Map();
  Object.keys(lib.OPS || {}).forEach((name) => map.set(lib.OPS[name], name));
  return map;
}

async function resolveAndUploadImage({ page, objId, upload, imageCache }) {
  if (imageCache.has(objId)) return imageCache.get(objId);
  let imgObj = null;
  try {
    imgObj = page.objs.get(objId);
  } catch (error) {
    console.warn("[pdfImport] Image object was not resolved by the time the page finished parsing", objId, error?.message || error);
  }
  const canvas = imageObjectToCanvas(imgObj);
  if (!canvas) {
    imageCache.set(objId, null);
    return null;
  }
  const dataUrl = canvas.toDataURL("image/png");
  const url = await upload(dataUrl);
  imageCache.set(objId, url);
  return url;
}

function imageObjectToCanvas(imgObj) {
  if (!imgObj) return null;
  const canvas = document.createElement("canvas");
  if (imgObj.bitmap) {
    canvas.width = imgObj.bitmap.width;
    canvas.height = imgObj.bitmap.height;
    canvas.getContext("2d").drawImage(imgObj.bitmap, 0, 0);
    return canvas;
  }
  const { width, height, data, kind } = imgObj;
  if (!width || !height || !data || !data.length) return null;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const imageData = ctx.createImageData(width, height);
  const out = imageData.data;
  const pixelCount = width * height;
  if (data.length >= pixelCount * 4 && kind !== 2 && kind !== 1) {
    out.set(data.subarray ? data.subarray(0, pixelCount * 4) : data.slice(0, pixelCount * 4));
  } else if (kind === 2 || data.length === pixelCount * 3) {
    for (let i = 0; i < pixelCount; i += 1) {
      out[i * 4] = data[i * 3];
      out[i * 4 + 1] = data[i * 3 + 1];
      out[i * 4 + 2] = data[i * 3 + 2];
      out[i * 4 + 3] = 255;
    }
  } else if (kind === 1 || data.length === pixelCount) {
    for (let i = 0; i < pixelCount; i += 1) {
      const v = data[i];
      out[i * 4] = v;
      out[i * 4 + 1] = v;
      out[i * 4 + 2] = v;
      out[i * 4 + 3] = 255;
    }
  } else {
    return null;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

async function uploadInlineImage({ image, upload }) {
  const canvas = imageObjectToCanvas(image);
  if (!canvas) return null;
  return upload(canvas.toDataURL("image/png"));
}

// ---------------------------------------------------------------------------
// Text: getTextContent -> line clustering -> paragraph clustering
// ---------------------------------------------------------------------------

// pdf.js's getTextContent() gives `item.transform` — already a full Trm
// (font size + rotation + baseline position) in default PDF user space —
// and `item.width` as a plain scalar length *already measured in that same
// user space* (points), not a pre-transform em-unit needing further matrix
// division. So the only extra scaling `item.width` needs is the viewport's
// own uniform points->device-pixel scale factor. Baseline origin and font
// size both fall straight out of composing item.transform with the
// viewport's transform.
async function extractTextItems({ page, viewport, fontSubstitutions }) {
  const textContent = await page.getTextContent();
  const items = [];
  for (const item of textContent.items) {
    if (!item.str || !item.str.trim()) continue;
    const combined = composeMatrix(viewport.transform, item.transform);
    const fontSize = Math.hypot(combined[0], combined[1]) || 1;
    const angleRad = Math.atan2(combined[1], combined[0]);
    const baseX = combined[4];
    const baseY = combined[5];
    const widthPx = Math.max((item.width || item.str.length * 0.5) * CSS_PIXELS_PER_POINT, fontSize * 0.3);
    const ascentRatio = textContent.styles?.[item.fontName]?.ascent;
    const ascent = Number.isFinite(ascentRatio) && ascentRatio > 0 ? ascentRatio : 0.8;
    const style = fontStyleFor(page, item, textContent.styles, fontSubstitutions);
    items.push({
      str: item.str,
      // Canva/Standard Inclusions exports are effectively always axis-aligned;
      // for the rare rotated run we accept the small top/left approximation
      // error rather than fully rotating the bounding box.
      x: baseX,
      y: baseY - ascent * fontSize,
      width: widthPx,
      height: fontSize * 1.15,
      baselineY: baseY,
      angleRad,
      fontSize,
      fontFamily: style.fontFamily,
      bold: style.bold,
      italic: style.italic,
    });
  }
  return items;
}

function groupLines(items) {
  const sorted = [...items].sort((a, b) => a.baselineY - b.baselineY || a.x - b.x);
  const lines = [];
  for (const item of sorted) {
    const tolerance = Math.max(2, item.fontSize * 0.35);
    let line = lines.find((candidate) => Math.abs(candidate.baselineY - item.baselineY) <= tolerance);
    if (!line) {
      line = { baselineY: item.baselineY, items: [] };
      lines.push(line);
    }
    line.items.push(item);
  }
  lines.forEach((line) => line.items.sort((a, b) => a.x - b.x));
  lines.sort((a, b) => a.baselineY - b.baselineY);
  return lines.map((line) => {
    const text = line.items.map((item, index) => {
      if (index === 0) return item.str;
      const prev = line.items[index - 1];
      const gap = item.x - (prev.x + prev.width);
      return gap > prev.fontSize * 0.25 ? ` ${item.str}` : item.str;
    }).join("");
    const x = Math.min(...line.items.map((item) => item.x));
    const right = Math.max(...line.items.map((item) => item.x + item.width));
    const fontSize = Math.max(...line.items.map((item) => item.fontSize));
    return {
      text,
      x,
      width: right - x,
      baselineY: line.baselineY,
      top: Math.min(...line.items.map((item) => item.y)),
      fontSize,
      fontFamily: line.items[0].fontFamily,
      bold: line.items.some((item) => item.bold),
      italic: line.items.some((item) => item.italic),
      color: line.items[0].color,
      sequence: line.items[0].sequence,
    };
  });
}

function groupParagraphs(lines) {
  const paragraphs = [];
  for (const line of lines) {
    const last = paragraphs[paragraphs.length - 1];
    const gapThreshold = line.fontSize * 1.7;
    const withinColumn = last && Math.abs(last.x - line.x) < Math.max(24, line.fontSize * 1.5);
    const closeEnough = last && (line.top - (last.top + last.height)) < gapThreshold;
    if (last && withinColumn && closeEnough && last.fontFamily === line.fontFamily && last.bold === line.bold) {
      last.lines.push(line);
      last.height = (line.top + line.fontSize * 1.15) - last.top;
      last.width = Math.max(last.width, line.width);
      continue;
    }
    paragraphs.push({
      x: line.x,
      top: line.top,
      width: line.width,
      height: line.fontSize * 1.15,
      fontSize: line.fontSize,
      fontFamily: line.fontFamily,
      bold: line.bold,
      italic: line.italic,
      color: line.color,
      sequence: line.sequence,
      lines: [line],
    });
  }
  return paragraphs;
}

// PDF text carries no paragraph-alignment flag (unlike PPTX's algn attribute)
// — it can only be inferred from line-start/end geometry, which is unreliable
// enough on real-world PDFs that guessing centre/right alignment does more
// harm than good. Left is also the correct default for the vast majority of
// schedule body copy, so builders only need to fix the rare centred heading.
function textAlignForParagraph() {
  return "left";
}

// Drops later duplicate text objects whose box overlaps an earlier one
// heavily and whose text content is identical — the common case of a PDF
// re-drawing the same run (fake-bold via double-paint, or a repeated content
// stream fragment).
export function dedupeTextObjects(objects) {
  const kept = [];
  for (const object of objects) {
    if (object.type !== "text") { kept.push(object); continue; }
    const box = { x: object.x, y: object.y, width: object.width, height: object.height };
    const isDuplicate = kept.some((existing) => existing.type === "text"
      && existing.data?.text === object.data?.text
      && boxOverlapRatio(box, { x: existing.x, y: existing.y, width: existing.width, height: existing.height }) >= DUPLICATE_OVERLAP_THRESHOLD);
    if (!isDuplicate) kept.push(object);
  }
  return kept;
}

// ---------------------------------------------------------------------------
// Per-page orchestration
// ---------------------------------------------------------------------------

async function extractPdfPage({ lib, page, upload, imageCache, fontSubstitutions }) {
  const rotation = page.rotate || 0;
  const viewport = page.getViewport({ scale: CSS_PIXELS_PER_POINT, rotation });
  const width = Math.round(viewport.width);
  const height = Math.round(viewport.height);

  const rawTextItems = await extractTextItems({ page, viewport, fontSubstitutions });
  const walk = await walkOperatorList({ lib, page, viewport, upload, imageCache });

  // Correlate getTextContent items with the operator-list showText colour
  // timeline by occurrence order. This is a best-effort heuristic (PDF has
  // no direct link between the two passes) that holds for the common case
  // of one showText call per text-content item.
  rawTextItems.forEach((item, index) => {
    item.sequence = walk.showTextColours[index]?.sequence ?? index;
    item.color = walk.showTextColours[index]?.color || DEFAULT_TEXT_COLOR;
  });

  const lines = groupLines(rawTextItems);
  const paragraphs = groupParagraphs(lines);

  let objects = [];

  paragraphs.forEach((paragraph) => {
    if (paragraph.width < MIN_OBJECT_SIZE || paragraph.height < MIN_OBJECT_SIZE) return;
    objects.push({
      ...createObject("text", {
        name: paragraph.lines[0].text.slice(0, 40) || "Imported text",
        x: paragraph.x,
        y: paragraph.top,
        width: Math.max(20, paragraph.width),
        height: Math.max(paragraph.fontSize * 1.15, paragraph.lines.length * paragraph.fontSize * 1.2),
        style: {
          fontFamily: paragraph.fontFamily,
          fontSize: Math.max(6, Math.round(paragraph.fontSize)),
          fontWeight: paragraph.bold ? 700 : 400,
          fontStyle: paragraph.italic ? "italic" : "normal",
          color: paragraph.color || DEFAULT_TEXT_COLOR,
          textAlign: textAlignForParagraph(paragraph),
          lineHeight: 1.2,
        },
        data: { text: paragraph.lines.map((line) => line.text).join("\n") },
      }),
      _sequence: paragraph.sequence,
    });
  });

  walk.shapes.forEach((shape) => {
    if (shape.box.width < MIN_OBJECT_SIZE || shape.box.height < MIN_OBJECT_SIZE) return;
    if (shape.fill === "transparent" && shape.stroke === "transparent") return;
    if (shape.kind === "line") {
      const orientation = shape.box.height > shape.box.width ? "vertical" : "horizontal";
      // The document engine's live renderer only recognises a "divider" type
      // (style.thickness/style.color) for line elements — there is no "line"
      // type, so using anything else would silently render nothing.
      objects.push({
        ...createObject("divider", {
          name: "PDF divider",
          x: shape.box.x,
          y: shape.box.y,
          width: orientation === "vertical" ? Math.max(1, Math.round(shape.box.width)) : shape.box.width,
          height: orientation === "vertical" ? shape.box.height : Math.max(1, Math.round(shape.box.height)),
          rotation: shape.box.rotation,
          style: { color: shape.stroke !== "transparent" ? shape.stroke : shape.fill, thickness: Math.max(1, Math.round(orientation === "vertical" ? shape.box.width : shape.box.height)) },
          data: { orientation },
        }),
        _sequence: shape.sequence,
      });
      return;
    }
    objects.push({
      ...createObject("shape", {
        name: shape.kind === "circle" ? "PDF circle" : "PDF shape",
        x: shape.box.x,
        y: shape.box.y,
        width: shape.box.width,
        height: shape.box.height,
        rotation: shape.box.rotation,
        style: {
          fill: shape.fill,
          stroke: shape.stroke,
          strokeWidth: shape.stroke === "transparent" ? 0 : 1.5,
          borderRadius: shape.kind === "circle" ? Math.max(shape.box.width, shape.box.height) : 0,
        },
        data: { shapeKind: shape.kind },
      }),
      _sequence: shape.sequence,
    });
  });

  walk.images.forEach((image) => {
    objects.push({
      ...createObject("image", {
        name: "PDF image",
        x: image.box.x,
        y: image.box.y,
        width: image.box.width,
        height: image.box.height,
        rotation: image.box.rotation,
        style: { objectFit: "cover" },
        data: { imageRef: image.imageRef, alt: "Imported PDF image" },
      }),
      _sequence: image.sequence,
    });
  });

  objects.sort((a, b) => a._sequence - b._sequence);
  objects.forEach((object, index) => { object.layer = index; delete object._sequence; });
  objects = dedupeTextObjects(objects);
  objects = removeSuspiciousPageCoveringDarkRectangles(objects, width, height);
  objects.forEach((object, index) => { object.layer = index; });

  const validation = validateImportedPage({ objects, width, height, rawTextItems, walk });
  return { width, height, objects, droppedComplexPaths: walk.droppedComplexPaths, validation };
}

function removeSuspiciousPageCoveringDarkRectangles(objects, width, height) {
  return objects.filter((object) => {
    if (object.type !== "shape") return true;
    if (object.data?.shapeKind !== "rect") return true;
    if (object.layer <= 1) return true;
    if (objectCoverageRatio(object, width, height) < PAGE_COVERAGE_THRESHOLD) return true;
    return !isDarkHex(object.style?.fill);
  });
}

function validateImportedPage({ objects, width, height, rawTextItems, walk }) {
  const warnings = [];
  const textObjects = objects.filter((object) => object.type === "text");
  const imageObjects = objects.filter((object) => object.type === "image");
  const shapeObjects = objects.filter((object) => object.type === "shape");
  const sourceTextCount = rawTextItems.length;
  const pageCoveringDarkShapes = shapeObjects.filter((object) => objectCoverageRatio(object, width, height) >= PAGE_COVERAGE_THRESHOLD && isDarkHex(object.style?.fill));
  const overflowObjects = objects.filter((object) => object.x < -2 || object.y < -2 || object.x + object.width > width + 2 || object.y + object.height > height + 2);
  const tinyTextObjects = textObjects.filter((object) => Number(object.style?.fontSize || 0) < 6 || object.height < 6);
  const unsupportedImageOps = (walk.operatorCounts.paintImageMaskXObject || 0)
    + (walk.operatorCounts.paintImageMaskXObjectGroup || 0)
    + (walk.operatorCounts.paintImageXObjectRepeat || 0)
    + (walk.operatorCounts.paintSolidColorImageMask || 0);

  if (sourceTextCount > 20 && textObjects.length < Math.ceil(sourceTextCount / 8)) warnings.push("Text grouping collapsed too much compared with the PDF text layer.");
  if (pageCoveringDarkShapes.length) warnings.push("A page-covering dark rectangle was detected and suppressed as suspicious.");
  if (overflowObjects.length) warnings.push(`${overflowObjects.length} object(s) overflow the page bounds.`);
  if (tinyTextObjects.length) warnings.push(`${tinyTextObjects.length} text object(s) are extremely small.`);
  if (walk.droppedComplexPaths > 8) warnings.push(`${walk.droppedComplexPaths} complex vector path(s) could not be reconstructed natively.`);
  if (unsupportedImageOps > 0) warnings.push(`${unsupportedImageOps} image mask/repeat operator(s) require hybrid or flat fallback.`);
  if (!imageObjects.length && (walk.operatorCounts.paintImageXObject || 0) + (walk.operatorCounts.paintJpegXObject || 0) + (walk.operatorCounts.paintInlineImageXObject || 0) > 0) {
    warnings.push("PDF image operators were present but no usable images were extracted.");
  }

  const failed = Boolean(pageCoveringDarkShapes.length || overflowObjects.length || tinyTextObjects.length || unsupportedImageOps > 0 || walk.droppedComplexPaths > 16);
  const scorePenalty = warnings.length * 9 + Math.min(35, walk.droppedComplexPaths * 1.5) + (unsupportedImageOps ? 22 : 0);
  return {
    failed,
    warnings,
    sourceTextCount,
    editableTextCount: textObjects.length,
    imageCount: imageObjects.length,
    shapeCount: shapeObjects.length,
    unsupportedImageOps,
    fidelityScore: Math.max(0, Math.round(100 - scorePenalty)),
  };
}

async function maybeCreateHybridPage({ page, pageResult, upload, pageNumber }) {
  if (!pageResult?.validation) return null;
  const shouldUseHybrid = pageResult.validation.failed
    || pageResult.objects.length > HYBRID_NATIVE_OBJECT_LIMIT
    || pageResult.droppedComplexPaths > 8;
  if (!shouldUseHybrid) return null;
  const fallback = await renderPageAsFallbackImage({ page, upload, renderScale: HYBRID_RENDER_SCALE });
  const hybrid = createHybridObjectsFromPageResult({ pageResult, fallback, pageNumber });
  return { ...hybrid, fidelityScore: Math.max(88, pageResult.validation.fidelityScore || 0), warnings: pageResult.validation.warnings };
}

function createHybridObjectsFromPageResult({ pageResult, fallback, pageNumber }) {
  const objects = [];
  if (fallback.imageRef) {
    objects.push(createObject("image", {
      name: `Page ${pageNumber} hybrid artwork`,
      x: 0,
      y: 0,
      width: fallback.width,
      height: fallback.height,
      locked: true,
      style: { objectFit: "cover" },
      data: { imageRef: fallback.imageRef, alt: `PDF page ${pageNumber}`, fixedVisual: true, importMode: "hybrid-background" },
      layer: 0,
    }));
  }
  const textObjects = pageResult.objects
    .filter((object) => object.type === "text")
    .slice(0, HYBRID_TEXT_OVERLAY_LIMIT)
    .map((object, index) => createObject("text", {
      ...object,
      name: object.name || "Editable PDF text",
      locked: false,
      layer: index + 1,
      data: {
        ...(object.data || {}),
        overlayMode: "pdf-text-activation",
        edited: false,
        hybridOverlay: true,
      },
      style: {
        ...(object.style || {}),
        backgroundColor: "transparent",
      },
    }));
  objects.push(...textObjects);
  return { width: fallback.width, height: fallback.height, objects };
}

async function renderPageAsFallbackImage({ page, upload, renderScale = FALLBACK_RENDER_SCALE }) {
  const rotation = page.rotate || 0;
  const cssViewport = page.getViewport({ scale: CSS_PIXELS_PER_POINT, rotation });
  const renderViewport = page.getViewport({ scale: renderScale, rotation });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(renderViewport.width);
  canvas.height = Math.ceil(renderViewport.height);
  const context = canvas.getContext("2d", { alpha: false });
  await page.render({ canvasContext: context, viewport: renderViewport }).promise;
  let imageRef = null;
  try {
    imageRef = await upload(canvas.toDataURL("image/jpeg", 0.92));
  } catch (error) {
    console.warn("[pdfImport] Failed to upload the fallback page render", error?.message || error);
  }
  return { width: Math.round(cssViewport.width), height: Math.round(cssViewport.height), imageRef, canvas, renderScale };
}

// Runs OCR against the already-rendered fallback raster (no second render
// pass) and converts any recognised words into low-confidence, editable text
// objects positioned in CSS-pixel page space, scaled down from the higher-DPI
// fallback render.
async function attemptOcrFallback({ fallback, page, ocr }) {
  if (!fallback?.canvas) return { textObjects: [], averageConfidence: 0 };
  let recognition;
  try {
    recognition = await ocr(fallback.canvas);
  } catch (error) {
    console.warn("[pdfImport] OCR fallback threw; continuing with a plain locked image.", error?.message || error);
    return { textObjects: [], averageConfidence: 0 };
  }
  const words = (recognition?.words || []).filter((word) => word?.text?.trim() && word.bbox);
  if (!words.length) return { textObjects: [], averageConfidence: 0 };

  const scale = 1 / (fallback.renderScale || FALLBACK_RENDER_SCALE);
  const textObjects = words.map((word, index) => {
    const x = word.bbox.x0 * scale;
    const y = word.bbox.y0 * scale;
    const width = Math.max(MIN_OBJECT_SIZE, (word.bbox.x1 - word.bbox.x0) * scale);
    const height = Math.max(MIN_OBJECT_SIZE, (word.bbox.y1 - word.bbox.y0) * scale);
    return createObject("text", {
      name: `OCR: ${word.text.slice(0, 30)}`,
      x,
      y,
      width,
      height,
      layer: index + 1, // sits above the background image (layer 0)
      style: {
        fontFamily: "Inter, Arial, sans-serif",
        fontSize: Math.max(6, Math.round(height * 0.85)),
        fontWeight: 400,
        color: DEFAULT_TEXT_COLOR,
        textAlign: "left",
        lineHeight: 1.2,
      },
      data: { text: word.text, ocrGenerated: true, ocrConfidence: word.confidence ?? null },
    });
  });
  const averageConfidence = words.reduce((sum, word) => sum + (Number(word.confidence) || 0), 0) / words.length;
  return { textObjects, averageConfidence };
}

// ---------------------------------------------------------------------------
// Visual fidelity comparison — operates on plain ImageData-shaped objects
// ({ data: Uint8ClampedArray|number[], width, height }) rather than live
// canvases, so the scoring math itself is engine-agnostic and unit-testable
// without a browser. Downsamples both images to a coarse grid and compares
// average luminance per cell rather than raw pixels, since font rasterisation
// differences between the source PDF renderer and the reconstructed page make
// literal pixel-perfect matching meaningless (per the brief).
// ---------------------------------------------------------------------------

const FIDELITY_GRID_SIZE = 24;

function cellLuminance(imageData, cellX, cellY, cellsPerSide) {
  const { data, width, height } = imageData;
  const startX = Math.floor((cellX / cellsPerSide) * width);
  const endX = Math.floor(((cellX + 1) / cellsPerSide) * width);
  const startY = Math.floor((cellY / cellsPerSide) * height);
  const endY = Math.floor(((cellY + 1) / cellsPerSide) * height);
  let total = 0;
  let count = 0;
  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r === undefined) continue;
      total += 0.299 * r + 0.587 * g + 0.114 * b;
      count += 1;
    }
  }
  return count ? total / count : 255;
}

// Returns { score, diffGrid } where score is 0-100 (100 = visually identical
// at this coarse resolution) and diffGrid is a FIDELITY_GRID_SIZE^2 array of
// per-cell absolute luminance differences (0-255), suitable for rendering a
// development-only visual difference heatmap.
export function computePageFidelityScore(sourceImageData, reconstructedImageData, gridSize = FIDELITY_GRID_SIZE) {
  const diffGrid = [];
  let totalDiff = 0;
  for (let cellY = 0; cellY < gridSize; cellY += 1) {
    for (let cellX = 0; cellX < gridSize; cellX += 1) {
      const sourceLum = cellLuminance(sourceImageData, cellX, cellY, gridSize);
      const reconLum = cellLuminance(reconstructedImageData, cellX, cellY, gridSize);
      const diff = Math.abs(sourceLum - reconLum);
      diffGrid.push(diff);
      totalDiff += diff;
    }
  }
  const averageDiff = totalDiff / diffGrid.length; // 0-255
  const score = Math.max(0, Math.round(100 - (averageDiff / 255) * 100));
  return { score, diffGrid, gridSize };
}
