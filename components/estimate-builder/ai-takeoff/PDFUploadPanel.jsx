// PDFUploadPanel.jsx
// Multi-plan upload manager for Estimate Builder AI takeoff.

import { useState, useRef, useCallback } from "react";
import { createPage, LEVEL_OPTIONS } from "./takeoffTypes";
import { runOrientationCandidateScoring } from "./aiDetectionService";

const PDFJS_VERSION = "3.11.174";
const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;
const PLAN_TYPES = [
  { value: "floor-plan", label: "Floor plan" },
  { value: "site-plan", label: "Site plan" },
  { value: "elevations", label: "Elevations" },
  { value: "sections", label: "Sections" },
  { value: "engineering", label: "Engineering drawings" },
  { value: "electrical", label: "Electrical plan" },
  { value: "plumbing", label: "Plumbing plan" },
  { value: "other", label: "Other" },
];
const ORIENTATION_CONFIDENCE_THRESHOLD = 0.45;

let pdfJsPromise = null;

function loadPdfJs() {
  if (pdfJsPromise) return pdfJsPromise;
  pdfJsPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined") { reject(new Error("SSR")); return; }
    if (window.pdfjsLib) { resolve(window.pdfjsLib); return; }

    const script = document.createElement("script");
    script.src = `${PDFJS_CDN}/pdf.min.js`;
    script.async = true;
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.js`;
      resolve(window.pdfjsLib);
    };
    script.onerror = () => reject(new Error("Failed to load PDF.js"));
    document.head.appendChild(script);
  });
  return pdfJsPromise;
}

async function renderPdfPageToDataUrl(pdfDoc, pageNum, scale = 2.0) {
  const page = await pdfDoc.getPage(pageNum);
  const pdfPageRotation = normalizeRotationDegrees(page.rotate || 0);
  const pdfTextRotationDegrees = await detectPdfTextRotationDegrees(page, pdfPageRotation);
  console.info("[EstimateBuilder] PDF render viewport rotation", {
    pageNumber: pageNum,
    pdfPageRotation,
    viewportRotationUsed: pdfPageRotation,
    pdfTextRotationDegrees,
  });
  const viewport = page.getViewport({ scale, rotation: pdfPageRotation });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  await page.render({ canvasContext: ctx, viewport }).promise;
  return {
    dataUrl: canvas.toDataURL("image/png"),
    width: canvas.width,
    height: canvas.height,
    pdfPageRotation,
    pdfTextRotationDegrees,
  };
}

async function detectPdfTextRotationDegrees(page, pdfPageRotation = 0) {
  try {
    const textContent = await page.getTextContent();
    const buckets = { 0: 0, 90: 0, 180: 0, 270: 0 };
    (textContent.items || []).forEach((item) => {
      const text = String(item?.str || "").trim();
      if (text.length < 2 || !Array.isArray(item?.transform)) return;
      const [a, b] = item.transform;
      const angle = normalizeRotationDegrees(Math.round((Math.atan2(b, a) * 180) / Math.PI));
      const snapped = snapRotation(angle);
      buckets[snapped] += Math.min(text.length, 40);
    });
    const entries = Object.entries(buckets).sort((a, b) => b[1] - a[1]);
    const [dominantAngle, dominantWeight] = entries[0] || [0, 0];
    const totalWeight = Object.values(buckets).reduce((sum, value) => sum + value, 0);
    if (!totalWeight || dominantWeight / totalWeight < 0.45) {
      return { rotationDegrees: 0, confidence: 0, dominantTextAngle: 0, source: "pdf-text" };
    }
    const dominantTextAngle = Number(dominantAngle);
    return {
      rotationDegrees: normalizeRotationDegrees(360 - dominantTextAngle - normalizeRotationDegrees(pdfPageRotation)),
      confidence: dominantWeight / totalWeight,
      dominantTextAngle,
      pdfPageRotation: normalizeRotationDegrees(pdfPageRotation),
      source: "pdf-text",
    };
  } catch (error) {
    return { rotationDegrees: 0, confidence: 0, dominantTextAngle: 0, source: "pdf-text", error: error.message };
  }
}

function snapRotation(angle) {
  const normalized = normalizeRotationDegrees(angle);
  const options = [0, 90, 180, 270];
  return options.reduce((best, option) => {
    const bestDistance = circularRotationDistance(normalized, best);
    const optionDistance = circularRotationDistance(normalized, option);
    return optionDistance < bestDistance ? option : best;
  }, 0);
}

function circularRotationDistance(a, b) {
  const diff = Math.abs(normalizeRotationDegrees(a) - normalizeRotationDegrees(b));
  return Math.min(diff, 360 - diff);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

function createImageThumbnailDataUrl(dataUrl, width, height, maxSize = 220) {
  return new Promise((resolve) => {
    const sourceWidth = Number(width) || 0;
    const sourceHeight = Number(height) || 0;
    if (!dataUrl || !sourceWidth || !sourceHeight) {
      resolve(dataUrl || "");
      return;
    }
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(sourceWidth, sourceHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(sourceWidth * scale));
      canvas.height = Math.max(1, Math.round(sourceHeight * scale));
      const ctx = canvas.getContext("2d");
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
}

function renderImageToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth || image.width;
      canvas.height = image.naturalHeight || image.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(image, 0, 0);
      resolve({
        dataUrl: canvas.toDataURL("image/png"),
        width: canvas.width,
        height: canvas.height,
      });
      URL.revokeObjectURL(image.src);
    };
    image.onerror = () => reject(new Error("Could not load image plan."));
    image.src = URL.createObjectURL(file);
  });
}

function normalizeRotationDegrees(value) {
  const degrees = Number(value) || 0;
  const normalized = ((degrees % 360) + 360) % 360;
  return [0, 90, 180, 270].includes(normalized) ? normalized : 0;
}

function rotateImageDataUrl(dataUrl, width, height, rotationDegrees) {
  return new Promise((resolve, reject) => {
    const degrees = normalizeRotationDegrees(rotationDegrees);
    const sourceWidth = Number(width) || 0;
    const sourceHeight = Number(height) || 0;
    if (!dataUrl || !degrees || !sourceWidth || !sourceHeight) {
      resolve({ dataUrl, width: sourceWidth, height: sourceHeight });
      return;
    }
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const swap = degrees === 90 || degrees === 270;
      canvas.width = swap ? sourceHeight : sourceWidth;
      canvas.height = swap ? sourceWidth : sourceHeight;
      const ctx = canvas.getContext("2d");
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((degrees * Math.PI) / 180);
      ctx.drawImage(image, -sourceWidth / 2, -sourceHeight / 2, sourceWidth, sourceHeight);
      resolve({ dataUrl: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height });
    };
    image.onerror = () => reject(new Error("Could not rotate plan image."));
    image.src = dataUrl;
  });
}

function rotatePoint(point, width, height, rotationDegrees) {
  const degrees = normalizeRotationDegrees(rotationDegrees);
  const x = Number(point?.x) || 0;
  const y = Number(point?.y) || 0;
  const W = Number(width) || 0;
  const H = Number(height) || 0;
  if (degrees === 90) return { x: H - y, y: x };
  if (degrees === 180) return { x: W - x, y: H - y };
  if (degrees === 270) return { x: y, y: W - x };
  return { x, y };
}

async function rotatePage(page, rotationDegrees, source = "manual") {
  const degrees = normalizeRotationDegrees(rotationDegrees);
  if (!degrees) return page;
  const rotatedImage = await rotateImageDataUrl(page.imageDataUrl, page.naturalWidth, page.naturalHeight, degrees);
  const pdfPageRotationDegrees = normalizeRotationDegrees(page.pdfPageRotationDegrees || page.pdfPageRotation || page.pdfRotationDegrees || 0);
  const detectedRotationDegrees = normalizeRotationDegrees(page.detectedRotationDegrees || 0);
  const manualRotationDegrees = normalizeRotationDegrees((page.manualRotationDegrees || page.userRotationDegrees || 0) + degrees);
  return {
    ...page,
    imageDataUrl: rotatedImage.dataUrl,
    normalisedImageData: rotatedImage.dataUrl,
    normalisedImageUrl: rotatedImage.dataUrl,
    naturalWidth: rotatedImage.width,
    naturalHeight: rotatedImage.height,
    pdfPageRotationDegrees,
    pdfPageRotation: pdfPageRotationDegrees,
    pdfRotationDegrees: pdfPageRotationDegrees,
    detectedRotationDegrees,
    manualRotationDegrees,
    userRotationDegrees: manualRotationDegrees,
    finalRotationDegrees: normalizeRotationDegrees(pdfPageRotationDegrees + detectedRotationDegrees + manualRotationDegrees),
    planRotationDegrees: normalizeRotationDegrees(pdfPageRotationDegrees + detectedRotationDegrees + manualRotationDegrees),
    orientationCorrection: {
      ...(page.orientationCorrection || {}),
      rotationDegrees: manualRotationDegrees,
      source,
      correctedAt: new Date().toISOString(),
    },
    overlays: (page.overlays || []).map((overlay) => ({
      ...overlay,
      points: (overlay.points || []).map((point) => rotatePoint(point, page.naturalWidth, page.naturalHeight, degrees)),
    })),
  };
}

function getPdfTextRotationAfterAppliedRotation(pdfTextRotationDegrees, appliedRotationDegrees = 0) {
  const confidence = Number(pdfTextRotationDegrees?.confidence || 0);
  if (!pdfTextRotationDegrees || confidence < ORIENTATION_CONFIDENCE_THRESHOLD) return 0;
  return normalizeRotationDegrees((pdfTextRotationDegrees.rotationDegrees || 0) - normalizeRotationDegrees(appliedRotationDegrees));
}

async function createOrientationCandidates(page, rotations = [0, 90, 180, 270]) {
  const sourceDataUrl = page?.imageDataUrl || page?.normalisedImageData || page?.normalisedImageUrl || "";
  const sourceWidth = Number(page?.naturalWidth || page?.originalWidth || 0);
  const sourceHeight = Number(page?.naturalHeight || page?.originalHeight || 0);
  const uniqueRotations = rotations
    .map((rotation) => normalizeRotationDegrees(rotation))
    .filter((rotation, index, values) => values.indexOf(rotation) === index);

  return Promise.all(uniqueRotations.map(async (rotationDegrees) => {
    const rotated = await rotateImageDataUrl(sourceDataUrl, sourceWidth, sourceHeight, rotationDegrees);
    const thumbnailDataUrl = await createImageThumbnailDataUrl(rotated.dataUrl, rotated.width, rotated.height);
    return {
      rotationDegrees,
      imageDataUrl: rotated.dataUrl,
      thumbnailDataUrl,
      imageWidth: rotated.width,
      imageHeight: rotated.height,
    };
  }));
}

function chooseBestOrientationScore(scores = []) {
  const safeScores = Array.isArray(scores) ? scores : [];
  return safeScores.slice().sort((a, b) => {
    const confidenceDiff = Number(b?.confidence || 0) - Number(a?.confidence || 0);
    if (confidenceDiff) return confidenceDiff;
    return Number(b?.score || 0) - Number(a?.score || 0);
  })[0] || null;
}

function logOrientationScoreTable(fileName, scores = []) {
  if (typeof console === "undefined" || !Array.isArray(scores) || !scores.length) return;
  console.info("[EstimateBuilder] Orientation scores", fileName, scores.map((score) => ({
    rotationDegrees: normalizeRotationDegrees(score?.rotationDegrees),
    confidence: Number(score?.confidence || 0),
    score: Number(score?.score || 0),
    wordCount: Number(score?.wordCount || 0),
    horizontalWordCount: Number(score?.horizontalWordCount || 0),
  })));
}

async function rotateNormalisedPageByDelta(page, rotationDegrees, detectedRotationDegrees, source = "redetect") {
  const degrees = normalizeRotationDegrees(rotationDegrees);
  if (!degrees) {
    return {
      ...page,
      detectedRotationDegrees: normalizeRotationDegrees(detectedRotationDegrees ?? page.detectedRotationDegrees ?? 0),
    };
  }
  const rotated = await rotateImageDataUrl(page.imageDataUrl, page.naturalWidth, page.naturalHeight, degrees);
  const pdfPageRotationDegrees = normalizeRotationDegrees(page.pdfPageRotationDegrees || page.pdfPageRotation || page.pdfRotationDegrees || 0);
  const nextDetectedRotationDegrees = normalizeRotationDegrees(detectedRotationDegrees ?? (page.detectedRotationDegrees || 0) + degrees);
  const manualRotationDegrees = normalizeRotationDegrees(page.manualRotationDegrees || page.userRotationDegrees || 0);
  return {
    ...page,
    imageDataUrl: rotated.dataUrl,
    normalisedImageData: rotated.dataUrl,
    normalisedImageUrl: rotated.dataUrl,
    naturalWidth: rotated.width,
    naturalHeight: rotated.height,
    detectedRotationDegrees: nextDetectedRotationDegrees,
    finalRotationDegrees: normalizeRotationDegrees(pdfPageRotationDegrees + nextDetectedRotationDegrees + manualRotationDegrees),
    planRotationDegrees: normalizeRotationDegrees(pdfPageRotationDegrees + nextDetectedRotationDegrees + manualRotationDegrees),
    orientationCorrection: {
      ...(page.orientationCorrection || {}),
      detectedRotationDegrees: nextDetectedRotationDegrees,
      source,
      correctedAt: new Date().toISOString(),
    },
  };
}

function rotateDetectedPageByDelta(page, rotationDegrees, source = "redetect") {
  const detectedRotationDegrees = normalizeRotationDegrees((page.detectedRotationDegrees || 0) + normalizeRotationDegrees(rotationDegrees));
  return rotateNormalisedPageByDelta(page, rotationDegrees, detectedRotationDegrees, source);
}

async function normalisePageToLandscape(page) {
  let width = Number(page.naturalWidth) || 0;
  let height = Number(page.naturalHeight) || 0;
  const pdfPageRotationDegrees = normalizeRotationDegrees(page.pdfPageRotationDegrees || page.pdfPageRotation || page.pdfRotationDegrees || 0);
  const manualRotationDegrees = normalizeRotationDegrees(page.manualRotationDegrees || page.userRotationDegrees || 0);
  let imageDataUrl = page.imageDataUrl;
  let forcedLandscapeRotation = 0;

  if (width && height && height > width) {
    forcedLandscapeRotation = 90;
    const rotatedImage = await rotateImageDataUrl(imageDataUrl, width, height, forcedLandscapeRotation);
    imageDataUrl = rotatedImage.dataUrl;
    width = rotatedImage.width;
    height = rotatedImage.height;
  }

  const textDetectedRotation = getPdfTextRotationAfterAppliedRotation(page.pdfTextRotationDegrees, forcedLandscapeRotation);
  if (textDetectedRotation) {
    const textRotatedImage = await rotateImageDataUrl(imageDataUrl, width, height, textDetectedRotation);
    imageDataUrl = textRotatedImage.dataUrl;
    width = textRotatedImage.width;
    height = textRotatedImage.height;
  }

  const detectedRotationDegrees = normalizeRotationDegrees(forcedLandscapeRotation + textDetectedRotation);
  const textConfidence = Number(page.pdfTextRotationDegrees?.confidence || 0);
  const orientationSource = textDetectedRotation ? "pdf-text-layer" : forcedLandscapeRotation ? "landscape-normalise" : "manual-ready";
  return {
    ...page,
    imageDataUrl,
    normalisedImageData: imageDataUrl,
    normalisedImageUrl: imageDataUrl,
    naturalWidth: width,
    naturalHeight: height,
    forcedLandscapeRotation,
    textDetectedRotation,
    landscapeLocked: true,
    detectedRotationDegrees,
    finalRotationDegrees: normalizeRotationDegrees(pdfPageRotationDegrees + detectedRotationDegrees + manualRotationDegrees),
    planRotationDegrees: normalizeRotationDegrees(pdfPageRotationDegrees + detectedRotationDegrees + manualRotationDegrees),
    orientationAccepted: true,
    orientationNeedsReview: false,
    orientationCorrection: {
      ...(page.orientationCorrection || {}),
      forcedLandscapeRotation,
      textDetectedRotation,
      detectedRotationDegrees,
      confidence: textConfidence || 1,
      reason: textDetectedRotation
        ? "PDF text layer rotation was applied after landscape normalisation."
        : forcedLandscapeRotation
          ? "Portrait render was rotated into landscape."
          : "Uploaded in landscape. Rotate manually if needed.",
      source: orientationSource,
      correctedAt: new Date().toISOString(),
    },
  };
}

function createPlanRecord(file, firstPage, index, jobId = "") {
  const id = `plan-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`;
  const inferred = inferPlanMeta(file.name, index);
  return {
    id,
    jobId,
    fileName: file.name,
    originalFileName: file.name,
    originalFileUrl: firstPage?.originalFileUrl || "",
    originalWidth: firstPage?.originalWidth || firstPage?.naturalWidth || 0,
    originalHeight: firstPage?.originalHeight || firstPage?.naturalHeight || 0,
    fileUrl: firstPage?.imageDataUrl || "",
    normalisedImageData: firstPage?.normalisedImageData || firstPage?.imageDataUrl || "",
    normalisedImageUrl: firstPage?.normalisedImageUrl || firstPage?.imageDataUrl || "",
    fileType: file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image"),
    planType: inferred.planType,
    levelLabel: inferred.levelLabel,
    includedInTakeoff: true,
    pdfPageRotationDegrees: normalizeRotationDegrees(firstPage?.pdfPageRotationDegrees || firstPage?.pdfPageRotation || firstPage?.pdfRotationDegrees || 0),
    forcedLandscapeRotation: normalizeRotationDegrees(firstPage?.forcedLandscapeRotation || 0),
    textDetectedRotation: normalizeRotationDegrees(firstPage?.textDetectedRotation || 0),
    landscapeLocked: firstPage?.landscapeLocked !== false,
    detectedRotationDegrees: normalizeRotationDegrees(firstPage?.detectedRotationDegrees || 0),
    manualRotationDegrees: normalizeRotationDegrees(firstPage?.manualRotationDegrees || firstPage?.userRotationDegrees || 0),
    finalRotationDegrees: normalizeRotationDegrees((firstPage?.pdfPageRotationDegrees || firstPage?.pdfPageRotation || firstPage?.pdfRotationDegrees || 0) + (firstPage?.detectedRotationDegrees || 0) + (firstPage?.manualRotationDegrees || firstPage?.userRotationDegrees || 0)),
    planRotationDegrees: normalizeRotationDegrees((firstPage?.pdfPageRotationDegrees || firstPage?.pdfPageRotation || firstPage?.pdfRotationDegrees || 0) + (firstPage?.detectedRotationDegrees || 0) + (firstPage?.manualRotationDegrees || firstPage?.userRotationDegrees || 0)),
    orientationConfidence: firstPage?.orientationCorrection?.confidence || 0,
    orientationSource: firstPage?.orientationCorrection?.source || "",
    orientationAccepted: Boolean(firstPage?.orientationAccepted),
    orientationConfirmed: Boolean(firstPage?.orientationAccepted),
    orientationNeedsReview: Boolean(firstPage?.orientationNeedsReview),
    orientationCandidates: firstPage?.orientationCandidates || [],
    orientationDebugScores: firstPage?.orientationDebugScores || [],
    detectedScale: firstPage?.detectedScale || null,
    scale: firstPage?.scale || null,
    scaleConfidence: firstPage?.scaleConfidence || firstPage?.detectedScale?.confidence || 0,
    scaleNeedsReview: Boolean(firstPage?.scaleNeedsReview || !firstPage?.scale?.accepted),
    uploadedAt: new Date().toISOString(),
  };
}

function inferPlanMeta(fileName = "", index = 0) {
  const text = fileName.toLowerCase();
  if (text.includes("site")) return { planType: "site-plan", levelLabel: "Site Plan" };
  if (text.includes("elevation")) return { planType: "elevations", levelLabel: "Elevations" };
  if (text.includes("section")) return { planType: "sections", levelLabel: "Sections" };
  if (text.includes("engineer")) return { planType: "engineering", levelLabel: "Engineering" };
  if (text.includes("electrical")) return { planType: "electrical", levelLabel: "Electrical" };
  if (text.includes("plumb")) return { planType: "plumbing", levelLabel: "Plumbing" };
  if (text.includes("first") || text.includes("upper") || text.includes("level 2")) return { planType: "floor-plan", levelLabel: "First Floor" };
  if (text.includes("ground") || index === 0) return { planType: "floor-plan", levelLabel: "Ground Floor" };
  return { planType: "floor-plan", levelLabel: `Plan ${index + 1}` };
}

function levelFromLabel(label = "") {
  const text = label.toLowerCase();
  if (text.includes("first") || text.includes("upper") || text.includes("2")) return "level-2";
  if (text.includes("third") || text.includes("3")) return "level-3";
  if (text.includes("ground")) return "ground";
  return "other";
}

export default function PDFUploadPanel({
  pages,
  plans = [],
  jobId = "",
  onPagesChange,
  onPlansChange,
  onSelectPage,
  selectedPageId,
}) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);

  const processFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setError("");
    setLoading(true);

    try {
      const nextPlans = [...plans];
      const nextPages = [...pages];

      for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
        const file = files[fileIndex];
        const isPdf = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
        const isImage = file.type.startsWith("image/");
        if (!isPdf && !isImage) {
          setError("Only PDF and image plan files are supported.");
          continue;
        }

        setProgress(`Processing ${file.name}...`);
        const originalFileUrl = await readFileAsDataUrl(file).catch(() => "");
        const createdPages = [];

        if (isPdf) {
          const pdfjsLib = await loadPdfJs();
          const arrayBuffer = await file.arrayBuffer();
          const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum += 1) {
            setProgress(`Rendering ${file.name} page ${pageNum} of ${pdfDoc.numPages}...`);
            const rendered = await renderPdfPageToDataUrl(pdfDoc, pageNum);
            const pg = createPage(pageNum);
            pg.imageDataUrl = rendered.dataUrl;
            pg.naturalWidth = rendered.width;
            pg.naturalHeight = rendered.height;
            pg.pdfPageRotationDegrees = rendered.pdfPageRotation || 0;
            pg.pdfPageRotation = rendered.pdfPageRotation || 0;
            pg.pdfRotationDegrees = rendered.pdfPageRotation || 0;
            pg.pdfTextRotationDegrees = rendered.pdfTextRotationDegrees || null;
            pg.originalFileName = file.name;
            pg.originalFileUrl = originalFileUrl;
            pg.originalWidth = rendered.width;
            pg.originalHeight = rendered.height;
            pg.detectedRotationDegrees = 0;
            pg.manualRotationDegrees = 0;
            pg.userRotationDegrees = 0;
            pg.finalRotationDegrees = rendered.pdfPageRotation || 0;
            pg.planRotationDegrees = rendered.pdfPageRotation || 0;
            setProgress(`Preparing landscape orientation for ${file.name} page ${pageNum}...`);
            createdPages.push(await normalisePageToLandscape(pg));
          }
        } else {
          const rendered = await renderImageToDataUrl(file);
          const pg = createPage(1);
          pg.imageDataUrl = rendered.dataUrl;
          pg.naturalWidth = rendered.width;
          pg.naturalHeight = rendered.height;
          pg.pdfPageRotationDegrees = 0;
          pg.pdfPageRotation = 0;
          pg.originalFileName = file.name;
          pg.originalFileUrl = originalFileUrl;
          pg.originalWidth = rendered.width;
          pg.originalHeight = rendered.height;
          pg.detectedRotationDegrees = 0;
          pg.manualRotationDegrees = 0;
          pg.userRotationDegrees = 0;
          pg.finalRotationDegrees = 0;
          pg.planRotationDegrees = 0;
          setProgress(`Preparing landscape orientation for ${file.name}...`);
          createdPages.push(await normalisePageToLandscape(pg));
        }

        if (!createdPages.length) continue;
        const plan = createPlanRecord(file, createdPages[0], nextPlans.length, jobId);
        createdPages.forEach((pg, pageIndex) => {
          pg.planId = plan.id;
          pg.planFileName = file.name;
          pg.level = levelFromLabel(plan.levelLabel);
          pg.pageNumber = pageIndex + 1;
        });
        plan.fileUrl = createdPages[0]?.imageDataUrl || plan.fileUrl;
        plan.originalFileUrl = originalFileUrl || plan.originalFileUrl;
        plan.originalFileName = file.name;
        plan.originalWidth = createdPages[0]?.originalWidth || createdPages[0]?.naturalWidth || plan.originalWidth || 0;
        plan.originalHeight = createdPages[0]?.originalHeight || createdPages[0]?.naturalHeight || plan.originalHeight || 0;
        plan.normalisedImageData = createdPages[0]?.normalisedImageData || createdPages[0]?.imageDataUrl || "";
        plan.normalisedImageUrl = createdPages[0]?.normalisedImageUrl || createdPages[0]?.imageDataUrl || "";
        plan.pdfPageRotationDegrees = createdPages[0]?.pdfPageRotationDegrees || createdPages[0]?.pdfPageRotation || 0;
        plan.pdfPageRotation = plan.pdfPageRotationDegrees;
        plan.forcedLandscapeRotation = createdPages[0]?.forcedLandscapeRotation || 0;
        plan.textDetectedRotation = createdPages[0]?.textDetectedRotation || 0;
        plan.landscapeLocked = createdPages[0]?.landscapeLocked !== false;
        plan.detectedRotationDegrees = createdPages[0]?.detectedRotationDegrees || 0;
        plan.manualRotationDegrees = createdPages[0]?.manualRotationDegrees || createdPages[0]?.userRotationDegrees || 0;
        plan.userRotationDegrees = plan.manualRotationDegrees;
        plan.finalRotationDegrees = normalizeRotationDegrees(plan.pdfPageRotationDegrees + plan.detectedRotationDegrees + plan.manualRotationDegrees);
        plan.planRotationDegrees = plan.finalRotationDegrees;
        plan.orientationConfidence = createdPages[0]?.orientationCorrection?.confidence || 0;
        plan.orientationSource = createdPages[0]?.orientationCorrection?.source || "";
        plan.orientationAccepted = Boolean(createdPages[0]?.orientationAccepted);
        plan.orientationConfirmed = Boolean(createdPages[0]?.orientationAccepted);
        plan.orientationNeedsReview = Boolean(createdPages[0]?.orientationNeedsReview);
        plan.orientationCandidates = createdPages[0]?.orientationCandidates || [];
        plan.orientationDebugScores = createdPages[0]?.orientationDebugScores || [];
        plan.detectedScale = createdPages[0]?.detectedScale || null;
        plan.scale = createdPages[0]?.scale || null;
        plan.scaleConfidence = createdPages[0]?.scaleConfidence || createdPages[0]?.detectedScale?.confidence || 0;
        plan.scaleNeedsReview = Boolean(createdPages[0]?.scaleNeedsReview || !createdPages[0]?.scale?.accepted);
        console.info("[EstimateBuilder] Plan orientation saved", {
          planFileName: plan.fileName,
          pdfPageRotationDegrees: plan.pdfPageRotationDegrees,
          detectedRotationDegrees: plan.detectedRotationDegrees,
          manualRotationDegrees: plan.manualRotationDegrees,
          savedRotationValue: plan.finalRotationDegrees,
          orientationSource: plan.orientationSource,
          orientationConfidence: plan.orientationConfidence,
        });
        nextPlans.push(plan);
        nextPages.push(...createdPages);
      }

      onPlansChange(nextPlans);
      onPagesChange(nextPages);
      if (!selectedPageId && nextPages[0]) onSelectPage(nextPages[0].id);
    } catch (err) {
      setError(`Failed to process plan file: ${err.message}`);
    } finally {
      setLoading(false);
      setProgress("");
    }
  }, [jobId, onPagesChange, onPlansChange, onSelectPage, pages, plans, selectedPageId]);

  const handleFileInput = useCallback((event) => {
    processFiles(event.target.files);
    event.target.value = "";
  }, [processFiles]);

  const handleDrop = useCallback((event) => {
    event.preventDefault();
    setDragging(false);
    processFiles(event.dataTransfer.files);
  }, [processFiles]);

  const updatePlan = useCallback((planId, patch) => {
    const nextPlans = plans.map((plan) => plan.id === planId ? { ...plan, ...patch } : plan);
    const changedPlan = nextPlans.find((plan) => plan.id === planId);
    const nextPages = pages.map((page) => page.planId === planId && patch.levelLabel
      ? { ...page, level: levelFromLabel(patch.levelLabel) }
      : page);
    onPlansChange(nextPlans);
    if (changedPlan && patch.levelLabel) onPagesChange(nextPages);
  }, [onPagesChange, onPlansChange, pages, plans]);

  const acceptPlanOrientation = useCallback((planId) => {
    const targetPlan = plans.find((plan) => plan.id === planId);
    if (targetPlan?.orientationNeedsReview || (!targetPlan?.orientationAccepted && Number(targetPlan?.orientationConfidence || 0) <= 0)) {
      setError("Choose the upright orientation thumbnail before accepting this plan.");
      return;
    }
    const nextPlans = plans.map((plan) => plan.id === planId ? {
      ...plan,
      orientationAccepted: true,
      orientationAcceptedAt: new Date().toISOString(),
    } : plan);
    const nextPages = pages.map((page) => page.planId === planId ? {
      ...page,
      orientationAccepted: true,
      orientationAcceptedAt: new Date().toISOString(),
    } : page);
    onPagesChange(nextPages);
    onPlansChange(nextPlans);
  }, [onPagesChange, onPlansChange, pages, plans]);

  const choosePlanOrientation = useCallback(async (planId, rotationDegrees) => {
    const degrees = normalizeRotationDegrees(rotationDegrees);
    const plan = plans.find((item) => item.id === planId);
    if (!plan) return;
    setLoading(true);
    setProgress("Saving selected plan orientation...");
    try {
      const rotatedPages = await Promise.all(pages.map((page) => (
        page.planId === planId ? (async () => {
          const selectedCandidate = (page.orientationCandidates || []).find((candidate) => normalizeRotationDegrees(candidate.rotationDegrees) === degrees);
          if (selectedCandidate?.imageDataUrl) {
            return {
              ...page,
              imageDataUrl: selectedCandidate.imageDataUrl,
              normalisedImageData: selectedCandidate.imageDataUrl,
              normalisedImageUrl: selectedCandidate.imageDataUrl,
              naturalWidth: selectedCandidate.imageWidth || page.naturalWidth,
              naturalHeight: selectedCandidate.imageHeight || page.naturalHeight,
              forcedLandscapeRotation: page.originalHeight > page.originalWidth ? degrees : page.forcedLandscapeRotation || 0,
              textDetectedRotation: page.originalHeight > page.originalWidth ? 0 : degrees,
              detectedRotationDegrees: degrees,
              manualRotationDegrees: 0,
              userRotationDegrees: 0,
              finalRotationDegrees: normalizeRotationDegrees((page.pdfPageRotationDegrees || page.pdfPageRotation || page.pdfRotationDegrees || 0) + degrees),
              planRotationDegrees: normalizeRotationDegrees((page.pdfPageRotationDegrees || page.pdfPageRotation || page.pdfRotationDegrees || 0) + degrees),
            };
          }
          return rotateNormalisedPageByDelta({
            ...page,
            manualRotationDegrees: 0,
            userRotationDegrees: 0,
          }, degrees, degrees, "user-selected");
        })() : page
      )));
      const firstPage = rotatedPages.find((page) => page.planId === planId);
      const nextPages = rotatedPages.map((page) => page.planId === planId ? {
        ...page,
        orientationAccepted: true,
        orientationNeedsReview: false,
        orientationSelectedAt: new Date().toISOString(),
        orientationCorrection: {
          ...(page.orientationCorrection || {}),
          forcedLandscapeRotation: page.forcedLandscapeRotation || 0,
          textDetectedRotation: page.textDetectedRotation || 0,
          detectedRotationDegrees: degrees,
          rotationDegrees: 0,
          confidence: 1,
          reason: "User selected upright orientation.",
          source: "user-selected",
          correctedAt: new Date().toISOString(),
        },
      } : page);
      const pdfPageRotationDegrees = normalizeRotationDegrees(plan.pdfPageRotationDegrees || plan.pdfPageRotation || plan.pdfRotationDegrees || 0);
      const nextPlans = plans.map((item) => item.id === planId ? {
        ...item,
        fileUrl: firstPage?.imageDataUrl || item.fileUrl,
        normalisedImageData: firstPage?.normalisedImageData || firstPage?.imageDataUrl || item.normalisedImageData,
        normalisedImageUrl: firstPage?.normalisedImageUrl || firstPage?.imageDataUrl || item.normalisedImageUrl,
        detectedScale: firstPage?.detectedScale || item.detectedScale || null,
        scale: firstPage?.scale || item.scale || null,
        scaleConfidence: firstPage?.scaleConfidence || firstPage?.detectedScale?.confidence || item.scaleConfidence || 0,
        scaleNeedsReview: Boolean(firstPage?.scaleNeedsReview || !firstPage?.scale?.accepted),
        forcedLandscapeRotation: firstPage?.forcedLandscapeRotation || item.forcedLandscapeRotation || 0,
        textDetectedRotation: firstPage?.textDetectedRotation || item.textDetectedRotation || 0,
        detectedRotationDegrees: degrees,
        manualRotationDegrees: 0,
        userRotationDegrees: 0,
        finalRotationDegrees: normalizeRotationDegrees(pdfPageRotationDegrees + degrees),
        planRotationDegrees: normalizeRotationDegrees(pdfPageRotationDegrees + degrees),
        orientationConfidence: 1,
        orientationSource: "user-selected",
        orientationAccepted: true,
        orientationConfirmed: true,
        orientationNeedsReview: false,
        orientationSelectedAt: new Date().toISOString(),
      } : item);
      onPagesChange(nextPages);
      onPlansChange(nextPlans);
      console.info("[EstimateBuilder] User selected plan orientation", {
        planFileName: plan.fileName,
        selectedRotationDegrees: degrees,
        savedRotationValue: normalizeRotationDegrees(pdfPageRotationDegrees + degrees),
      });
    } finally {
      setLoading(false);
      setProgress("");
    }
  }, [onPagesChange, onPlansChange, pages, plans]);

  const deletePlan = useCallback((planId) => {
    const nextPlans = plans.filter((plan) => plan.id !== planId);
    const nextPages = pages.filter((page) => page.planId !== planId);
    onPlansChange(nextPlans);
    onPagesChange(nextPages);
    if (selectedPageId && !nextPages.some((page) => page.id === selectedPageId)) {
      onSelectPage(nextPages[0]?.id || null);
    }
  }, [onPagesChange, onPlansChange, onSelectPage, pages, plans, selectedPageId]);

  const rotatePlan = useCallback(async (planId, rotationDegrees) => {
    const degrees = normalizeRotationDegrees(rotationDegrees);
    if (!degrees) return;
    setLoading(true);
    setProgress("Rotating plan...");
    try {
      const rotatedPages = await Promise.all(pages.map((page) => (
        page.planId === planId ? rotatePage(page, degrees, "manual") : page
      )));
      const firstPage = rotatedPages.find((page) => page.planId === planId);
      const nextPlans = plans.map((plan) => plan.id === planId ? {
        ...plan,
        fileUrl: firstPage?.imageDataUrl || plan.fileUrl,
        normalisedImageData: firstPage?.normalisedImageData || firstPage?.imageDataUrl || plan.normalisedImageData,
        normalisedImageUrl: firstPage?.normalisedImageUrl || firstPage?.imageDataUrl || plan.normalisedImageUrl,
        pdfPageRotationDegrees: normalizeRotationDegrees(plan.pdfPageRotationDegrees || plan.pdfPageRotation || plan.pdfRotationDegrees || 0),
        pdfPageRotation: normalizeRotationDegrees(plan.pdfPageRotationDegrees || plan.pdfPageRotation || plan.pdfRotationDegrees || 0),
        detectedRotationDegrees: normalizeRotationDegrees(plan.detectedRotationDegrees || 0),
        manualRotationDegrees: normalizeRotationDegrees((plan.manualRotationDegrees || plan.userRotationDegrees || 0) + degrees),
        userRotationDegrees: normalizeRotationDegrees((plan.manualRotationDegrees || plan.userRotationDegrees || 0) + degrees),
        finalRotationDegrees: normalizeRotationDegrees((plan.pdfPageRotationDegrees || plan.pdfPageRotation || plan.pdfRotationDegrees || 0) + (plan.detectedRotationDegrees || 0) + (plan.manualRotationDegrees || plan.userRotationDegrees || 0) + degrees),
        planRotationDegrees: normalizeRotationDegrees((plan.pdfPageRotationDegrees || plan.pdfPageRotation || plan.pdfRotationDegrees || 0) + (plan.detectedRotationDegrees || 0) + (plan.manualRotationDegrees || plan.userRotationDegrees || 0) + degrees),
        orientationSource: "manual",
      } : plan);
      onPagesChange(rotatedPages);
      onPlansChange(nextPlans);
      const savedPlan = nextPlans.find((plan) => plan.id === planId);
      console.info("[EstimateBuilder] Manual plan rotation saved", {
        planFileName: savedPlan?.fileName || "",
        appliedRotation: degrees,
        pdfPageRotationDegrees: savedPlan?.pdfPageRotationDegrees || 0,
        detectedRotationDegrees: savedPlan?.detectedRotationDegrees || 0,
        manualRotationDegrees: savedPlan?.manualRotationDegrees || 0,
        savedRotationValue: savedPlan?.finalRotationDegrees || savedPlan?.planRotationDegrees || 0,
      });
    } finally {
      setLoading(false);
      setProgress("");
    }
  }, [onPagesChange, onPlansChange, pages, plans]);

  const redetectPlanOrientation = useCallback(async (planId) => {
    const plan = plans.find((item) => item.id === planId);
    const targetPage = pages.find((page) => page.planId === planId);
    if (!plan || !targetPage) return;
    setLoading(true);
    setProgress("Re-detecting plan orientation...");
    try {
      const orientationCandidates = await createOrientationCandidates(targetPage, targetPage.landscapeLocked ? [0, 180] : [0, 90, 180, 270]);
      const orientation = await runOrientationCandidateScoring({ candidates: orientationCandidates });
      const bestCandidate = chooseBestOrientationScore(orientation.scores || []);
      logOrientationScoreTable(plan.fileName, orientation.scores || []);
      const detectedRotationDelta = normalizeRotationDegrees(bestCandidate?.rotationDegrees ?? orientation.detectedRotationDegrees ?? 0);
      const confidence = Number(bestCandidate?.confidence ?? orientation.confidence ?? 0);
      if (confidence < ORIENTATION_CONFIDENCE_THRESHOLD) {
        const nextPlans = plans.map((item) => item.id === planId ? {
          ...item,
          orientationConfidence: 0,
          orientationSource: "needs-user-selection",
          orientationAccepted: false,
          orientationNeedsReview: true,
          orientationCandidates,
          orientationDebugScores: orientation.scores || item.orientationDebugScores || [],
        } : item);
        const nextPages = pages.map((page) => page.planId === planId ? {
          ...page,
          orientationAccepted: false,
          orientationNeedsReview: true,
          orientationCandidates,
          orientationDebugScores: orientation.scores || page.orientationDebugScores || [],
          orientationCorrection: {
            ...(page.orientationCorrection || {}),
            confidence: 0,
            reason: "Orientation confidence was too low. User must choose the upright version.",
            source: "needs-user-selection",
            correctedAt: new Date().toISOString(),
          },
        } : page);
        onPagesChange(nextPages);
        onPlansChange(nextPlans);
        return;
      }
      const detectedRotationDegrees = normalizeRotationDegrees((plan.detectedRotationDegrees || 0) + detectedRotationDelta);
      const rotatedPages = await Promise.all(pages.map((page) => (
        page.planId === planId ? rotateDetectedPageByDelta(page, detectedRotationDelta, "redetect") : page
      )));
      const firstPage = rotatedPages.find((page) => page.planId === planId);
      const pdfPageRotationDegrees = normalizeRotationDegrees(plan.pdfPageRotationDegrees || plan.pdfPageRotation || plan.pdfRotationDegrees || 0);
      const manualRotationDegrees = normalizeRotationDegrees(plan.manualRotationDegrees || plan.userRotationDegrees || 0);
      const nextPlans = plans.map((item) => item.id === planId ? {
        ...item,
        fileUrl: firstPage?.imageDataUrl || item.fileUrl,
        normalisedImageData: firstPage?.normalisedImageData || firstPage?.imageDataUrl || item.normalisedImageData,
        normalisedImageUrl: firstPage?.normalisedImageUrl || firstPage?.imageDataUrl || item.normalisedImageUrl,
        detectedRotationDegrees,
        manualRotationDegrees,
        userRotationDegrees: manualRotationDegrees,
        finalRotationDegrees: normalizeRotationDegrees(pdfPageRotationDegrees + detectedRotationDegrees + manualRotationDegrees),
        planRotationDegrees: normalizeRotationDegrees(pdfPageRotationDegrees + detectedRotationDegrees + manualRotationDegrees),
        orientationConfidence: confidence,
        orientationSource: "redetect",
        orientationAccepted: true,
        orientationNeedsReview: false,
        orientationCandidates,
        orientationDebugScores: orientation.scores || item.orientationDebugScores || [],
      } : item);
      onPagesChange(rotatedPages);
      onPlansChange(nextPlans);
    } finally {
      setLoading(false);
      setProgress("");
    }
  }, [onPagesChange, onPlansChange, pages, plans]);

  const resetPlanRotation = useCallback(async (planId) => {
    const plan = plans.find((item) => item.id === planId);
    const currentManualRotation = normalizeRotationDegrees(plan?.manualRotationDegrees || plan?.userRotationDegrees || 0);
    if (!currentManualRotation) return;
    const degrees = normalizeRotationDegrees(360 - currentManualRotation);
    setLoading(true);
    setProgress("Resetting plan rotation...");
    try {
      const rotatedPages = await Promise.all(pages.map(async (page) => {
        if (page.planId !== planId) return page;
        const rotated = await rotatePage(page, degrees, "manual-reset");
        return {
          ...rotated,
          manualRotationDegrees: 0,
          userRotationDegrees: 0,
          finalRotationDegrees: normalizeRotationDegrees((rotated.pdfPageRotationDegrees || rotated.pdfPageRotation || rotated.pdfRotationDegrees || 0) + (rotated.detectedRotationDegrees || 0)),
          planRotationDegrees: normalizeRotationDegrees((rotated.pdfPageRotationDegrees || rotated.pdfPageRotation || rotated.pdfRotationDegrees || 0) + (rotated.detectedRotationDegrees || 0)),
          orientationCorrection: {
            ...(rotated.orientationCorrection || {}),
            rotationDegrees: 0,
            source: "manual-reset",
            correctedAt: new Date().toISOString(),
          },
        };
      }));
      const firstPage = rotatedPages.find((page) => page.planId === planId);
      const nextPlans = plans.map((item) => item.id === planId ? {
        ...item,
        fileUrl: firstPage?.imageDataUrl || item.fileUrl,
        normalisedImageData: firstPage?.normalisedImageData || firstPage?.imageDataUrl || item.normalisedImageData,
        normalisedImageUrl: firstPage?.normalisedImageUrl || firstPage?.imageDataUrl || item.normalisedImageUrl,
        pdfPageRotationDegrees: normalizeRotationDegrees(item.pdfPageRotationDegrees || item.pdfPageRotation || item.pdfRotationDegrees || 0),
        pdfPageRotation: normalizeRotationDegrees(item.pdfPageRotationDegrees || item.pdfPageRotation || item.pdfRotationDegrees || 0),
        detectedRotationDegrees: normalizeRotationDegrees(item.detectedRotationDegrees || 0),
        manualRotationDegrees: 0,
        userRotationDegrees: 0,
        finalRotationDegrees: normalizeRotationDegrees((item.pdfPageRotationDegrees || item.pdfPageRotation || item.pdfRotationDegrees || 0) + (item.detectedRotationDegrees || 0)),
        planRotationDegrees: normalizeRotationDegrees((item.pdfPageRotationDegrees || item.pdfPageRotation || item.pdfRotationDegrees || 0) + (item.detectedRotationDegrees || 0)),
        orientationSource: "manual-reset",
      } : item);
      onPagesChange(rotatedPages);
      onPlansChange(nextPlans);
      const savedPlan = nextPlans.find((item) => item.id === planId);
      console.info("[EstimateBuilder] Manual plan rotation reset", {
        planFileName: savedPlan?.fileName || "",
        pdfPageRotationDegrees: savedPlan?.pdfPageRotationDegrees || 0,
        detectedRotationDegrees: savedPlan?.detectedRotationDegrees || 0,
        manualRotationDegrees: savedPlan?.manualRotationDegrees || 0,
        savedRotationValue: savedPlan?.finalRotationDegrees || savedPlan?.planRotationDegrees || 0,
      });
    } finally {
      setLoading(false);
      setProgress("");
    }
  }, [onPagesChange, onPlansChange, pages, plans]);

  const updatePageLevel = useCallback((pageId, level) => {
    onPagesChange(pages.map((page) => page.id === pageId ? { ...page, level } : page));
  }, [pages, onPagesChange]);

  const selectFirstPlanPage = useCallback((planId) => {
    const firstPage = pages.find((page) => page.planId === planId);
    if (firstPage) onSelectPage(firstPage.id);
  }, [onSelectPage, pages]);

  return (
    <div style={S.wrap}>
      <div style={S.title}>Plan Files</div>

      <div
        style={{ ...S.dropZone, ...(dragging ? S.dropZoneActive : {}) }}
        onClick={() => fileRef.current?.click()}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        {loading ? (
          <div style={S.loadingBox}>
            <div style={S.spinner} />
            <div style={S.progressText}>{progress}</div>
          </div>
        ) : (
          <>
            <div style={S.uploadIcon}>+</div>
            <div style={S.uploadLabel}>Upload Plans</div>
            <div style={S.uploadSub}>Drop PDFs/images here or click to choose multiple files</div>
          </>
        )}
      </div>
      <input ref={fileRef} type="file" multiple accept=".pdf,image/png,image/jpeg,image/webp" style={{ display: "none" }} onChange={handleFileInput} />

      {error && <div style={S.error}>{error}</div>}

      {plans.length > 0 ? (
        <div style={S.planList}>
          <div style={S.stripTitle}>Uploaded plans</div>
          {plans.map((plan, index) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              index={index}
              pages={pages.filter((page) => page.planId === plan.id)}
              selectedPageId={selectedPageId}
              onUpdate={(patch) => updatePlan(plan.id, patch)}
              onPreview={() => selectFirstPlanPage(plan.id)}
              onDelete={() => deletePlan(plan.id)}
              onRotateLeft={() => rotatePlan(plan.id, 270)}
              onRotateRight={() => rotatePlan(plan.id, 90)}
              onPageSelect={onSelectPage}
              onPageLevelChange={updatePageLevel}
            />
          ))}
        </div>
      ) : (
        <div style={S.emptyPlans}>No plans uploaded for this job yet.</div>
      )}
    </div>
  );
}

function PlanCard({ plan, index, pages, selectedPageId, onUpdate, onPreview, onDelete, onRotateLeft, onRotateRight, onPageSelect, onPageLevelChange }) {
  const scaleSet = Boolean(plan.scale?.accepted || plan.scale?.pixelsPerMetre || plan.scale?.preset);
  return (
    <div style={S.planCard}>
      <div style={S.planHeader}>
        <strong>{plan.fileName}</strong>
        <label style={S.includeToggle}>
          <input
            type="checkbox"
            checked={plan.includedInTakeoff !== false}
            onChange={(event) => onUpdate({ includedInTakeoff: event.target.checked })}
          />
          AI
        </label>
      </div>
      <div style={S.planMeta}>
        Uploaded {formatDate(plan.uploadedAt)}
        <span style={S.scaleMeta}>Scale: {scaleSet ? "set" : "not set"}</span>
        {!scaleSet && <span style={S.reviewBadge}>Needs scale</span>}
      </div>
      <label style={S.fieldLabel}>
        Plan type
        <select style={S.select} value={plan.planType || "floor-plan"} onChange={(event) => onUpdate({ planType: event.target.value })}>
          {PLAN_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <label style={S.fieldLabel}>
        Level/floor label
        <input style={S.input} value={plan.levelLabel || ""} onChange={(event) => onUpdate({ levelLabel: event.target.value })} placeholder={index === 0 ? "Ground Floor" : "First Floor"} />
      </label>
      <div style={S.planActions}>
        <button type="button" style={S.previewButton} onClick={onPreview}>Preview</button>
        <button type="button" style={S.rotateButton} onClick={onRotateLeft}>Rotate left</button>
        <button type="button" style={S.rotateButton} onClick={onRotateRight}>Rotate right</button>
        <button type="button" style={S.deleteButton} onClick={onDelete}>Delete</button>
      </div>
      {pages.length > 1 && (
        <div style={S.pageStrip}>
          {pages.map((page) => (
            <PageThumb
              key={page.id}
              page={page}
              selected={page.id === selectedPageId}
              onSelect={() => onPageSelect(page.id)}
              onLevelChange={(level) => onPageLevelChange(page.id, level)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PageThumb({ page, selected, onSelect, onLevelChange }) {
  const overlayCount = page.overlays?.length || 0;
  const confirmedCount = page.overlays?.filter((overlay) => overlay.status === "confirmed").length || 0;

  return (
    <div style={{ ...S.thumb, ...(selected ? S.thumbActive : {}) }} onClick={onSelect}>
      {page.imageDataUrl ? (
        <img src={page.imageDataUrl} alt={`Page ${page.pageNumber}`} style={S.thumbImg} />
      ) : (
        <div style={S.thumbPlaceholder}>P{page.pageNumber}</div>
      )}
      <div style={S.thumbMeta}>
        <div style={S.thumbLabel}>Page {page.pageNumber}</div>
        {overlayCount > 0 && <div style={S.thumbStats}>{confirmedCount}/{overlayCount} confirmed</div>}
        {!page.scale && <div style={S.thumbNoScale}>No scale</div>}
        {page.scale && <div style={S.thumbScale}>{page.scale.method === "preset" ? page.scale.preset : `${(page.scale.pixelsPerMetre || 0).toFixed(0)} px/m`}</div>}
        <select
          value={page.level}
          onChange={(event) => { event.stopPropagation(); onLevelChange(event.target.value); }}
          onClick={(event) => event.stopPropagation()}
          style={S.levelSelect}
        >
          {LEVEL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
    </div>
  );
}

function formatDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : "not recorded";
}

const S = {
  wrap: { display: "flex", flexDirection: "column", gap: 10 },
  title: { fontSize: 15, fontWeight: 800, color: "#1e293b" },
  dropZone: {
    border: "2px dashed #93c5fd",
    borderRadius: 10,
    padding: "20px 12px",
    textAlign: "center",
    cursor: "pointer",
    background: "#f0f9ff",
    transition: "all 0.15s",
  },
  dropZoneActive: { borderColor: "#3b82f6", background: "#dbeafe" },
  loadingBox: { display: "flex", flexDirection: "column", alignItems: "center", gap: 10 },
  spinner: {
    width: 30,
    height: 30,
    borderRadius: "50%",
    border: "3px solid #e2e8f0",
    borderTopColor: "#3b82f6",
    animation: "spin 0.8s linear infinite",
  },
  progressText: { fontSize: 13, color: "#64748b" },
  uploadIcon: { width: 32, height: 32, margin: "0 auto 5px", borderRadius: 999, background: "#dbeafe", color: "#1d4ed8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 900 },
  uploadLabel: { fontSize: 15, fontWeight: 800, color: "#1d4ed8" },
  uploadSub: { fontSize: 12, color: "#64748b", marginTop: 4, lineHeight: 1.35 },
  error: { background: "#fef2f2", color: "#dc2626", padding: "9px 12px", borderRadius: 7, fontSize: 13 },
  emptyPlans: { border: "1px dashed #cbd5e1", borderRadius: 8, padding: 12, color: "#64748b", fontSize: 12, textAlign: "center" },
  planList: { display: "flex", flexDirection: "column", gap: 10 },
  stripTitle: { fontSize: 12, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" },
  planCard: { display: "grid", gap: 8, padding: 10, border: "1.5px solid #cbd5e1", borderRadius: 9, background: "#ffffff", boxShadow: "0 8px 18px rgba(15, 23, 42, 0.06)" },
  planHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, color: "#0f172a", fontSize: 13, lineHeight: 1.3 },
  includeToggle: { display: "inline-flex", alignItems: "center", gap: 4, color: "#0f766e", fontSize: 12, fontWeight: 900, cursor: "pointer" },
  planMeta: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, color: "#64748b", fontSize: 11 },
  scaleMeta: { color: "#334155", fontWeight: 800 },
  reviewBadge: { display: "inline-flex", alignItems: "center", border: "1px solid #fbbf24", borderRadius: 999, padding: "2px 7px", background: "#fffbeb", color: "#92400e", fontWeight: 900 },
  fieldLabel: { display: "grid", gap: 4, color: "#475569", fontSize: 11, fontWeight: 800 },
  select: { width: "100%", border: "1.5px solid #cbd5e1", borderRadius: 6, background: "#f8fafc", color: "#0f172a", padding: "7px 8px", fontSize: 12 },
  input: { width: "100%", boxSizing: "border-box", border: "1.5px solid #cbd5e1", borderRadius: 6, background: "#ffffff", color: "#0f172a", padding: "7px 8px", fontSize: 12 },
  planActions: { display: "flex", flexWrap: "wrap", gap: 6 },
  previewButton: { flex: 1, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", borderRadius: 6, padding: "6px 8px", fontSize: 12, fontWeight: 800, cursor: "pointer" },
  rotateButton: { border: "1px solid #cbd5e1", background: "#f8fafc", color: "#334155", borderRadius: 6, padding: "6px 8px", fontSize: 12, fontWeight: 800, cursor: "pointer" },
  deleteButton: { border: "1px solid #fecaca", background: "#fff1f2", color: "#b91c1c", borderRadius: 6, padding: "6px 8px", fontSize: 12, fontWeight: 800, cursor: "pointer" },
  pageStrip: { display: "flex", flexDirection: "column", gap: 8, paddingTop: 4, borderTop: "1px solid #e2e8f0" },
  thumb: { display: "flex", gap: 8, alignItems: "flex-start", padding: 8, borderRadius: 8, border: "1.5px solid #e2e8f0", background: "#ffffff", cursor: "pointer" },
  thumbActive: { borderColor: "#3b82f6", background: "#eff6ff" },
  thumbImg: { width: 70, height: 52, objectFit: "contain", background: "#f1f5f9", borderRadius: 4, flexShrink: 0 },
  thumbPlaceholder: { width: 70, height: 52, display: "flex", alignItems: "center", justifyContent: "center", background: "#f1f5f9", borderRadius: 4, fontSize: 18, color: "#94a3b8", flexShrink: 0 },
  thumbMeta: { display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 0 },
  thumbLabel: { fontSize: 12, fontWeight: 800, color: "#334155" },
  thumbStats: { fontSize: 11, color: "#16a34a", fontWeight: 700 },
  thumbNoScale: { fontSize: 11, color: "#d97706" },
  thumbScale: { fontSize: 11, color: "#2563eb" },
  levelSelect: { fontSize: 11, padding: "4px 6px", border: "1.5px solid #e2e8f0", borderRadius: 6, background: "#f8fafc", color: "#334155", width: "100%", cursor: "pointer" },
};
