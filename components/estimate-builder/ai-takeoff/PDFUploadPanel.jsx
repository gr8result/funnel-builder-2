// PDFUploadPanel.jsx
// Multi-plan upload manager for Estimate Builder AI takeoff.

import { useState, useRef, useCallback } from "react";
import { createPage, LEVEL_OPTIONS } from "./takeoffTypes";
import { getPixelsPerUnit } from "./takeoffUtils";
import {
  loadPdfJs,
  renderPdfDataUrlPage,
  normalizePlanRotation,
  getFinalPlanRotation,
  DEFAULT_PDF_TARGET_DPI,
  rotateRasterImageDataUrl,
} from "./pdfPlanRendering";
import { renderPdfPageToRaster } from "../takeoff-engine/import/pdfToRaster.js";
import { analyzeRasterOrientation, applyOrientationAnalysisToRaster } from "../takeoff-engine/analysis/imageOrientationAnalysis.js";
import {
  rotateRasterImageDataUrl as rotateEngineRasterImageDataUrl,
} from "../takeoff-engine/import/imageNormalizer.js";

const ROTATION_RESET_WARNING = "This page was rotated. Scale and measurements were reset because the coordinate system changed.";

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

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Could not read file."));
    reader.readAsDataURL(file);
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

async function renderImageFileWithEngineAnalysis(file) {
  const rendered = await renderImageToDataUrl(file);
  const orientationAnalysis = await analyzeRasterOrientation({
    imageDataUrl: rendered.dataUrl,
    imageWidth: rendered.width,
    imageHeight: rendered.height,
  });
  const rotated = await applyOrientationAnalysisToRaster({
    imageDataUrl: rendered.dataUrl,
    imageWidth: rendered.width,
    imageHeight: rendered.height,
    orientationAnalysis,
    rotateRaster: rotateEngineRasterImageDataUrl,
  });
  const selectedRotation = normalizePlanRotation(rotated.rotation ?? rotated.appliedRotation ?? orientationAnalysis.selectedRotation);

  return {
    imageDataUrl: rotated.imageDataUrl || rotated.dataUrl || rendered.dataUrl,
    imageWidth: rotated.imageWidth || rotated.width || rendered.width,
    imageHeight: rotated.imageHeight || rotated.height || rendered.height,
    originalWidth: rendered.width,
    originalHeight: rendered.height,
    metadataRotation: 0,
    detectedRotation: selectedRotation,
    userRotation: 0,
    finalRotation: selectedRotation,
    renderScale: 1,
    dpi: 300,
    format: "PNG",
    sourcePdfPageNumber: 1,
    orientationMethod: "raster-orientation-analysis",
    orientationConfidence: orientationAnalysis.confidence,
    orientationScores: orientationAnalysis.scores,
    orientationAnalysis,
    detectedScaleText: "",
  };
}

function engineRasterToLegacyPage(rendered, file, pageNum, originalFileUrl) {
  const pg = createPage(pageNum);
  const orientation = rendered.orientation || {};
  const metadata = rendered.metadata || {};
  const analysis = metadata.orientationAnalysis || rendered.orientationAnalysis || null;
  const imageWidth = rendered.imageWidth || rendered.normalizedWidth || 0;
  const imageHeight = rendered.imageHeight || rendered.normalizedHeight || 0;
  const metadataRotation = normalizePlanRotation(orientation.metadataRotation || rendered.metadataRotation || 0);
  const detectedRotation = normalizePlanRotation(orientation.detectedRotation || rendered.detectedRotation || 0);
  const userRotation = normalizePlanRotation(orientation.userRotation || rendered.userRotation || 0);
  const finalRotation = normalizePlanRotation(orientation.finalRotation ?? rendered.finalRotation ?? getFinalPlanRotation({ metadataRotation, detectedRotation, userRotation }));

  pg.sourceType = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf") ? "pdf" : "image";
  pg.sourceFileName = file.name;
  pg.imageDataUrl = rendered.imageDataUrl;
  pg.naturalWidth = imageWidth;
  pg.naturalHeight = imageHeight;
  pg.normalizedWidth = imageWidth;
  pg.normalizedHeight = imageHeight;
  pg.imageWidth = imageWidth;
  pg.imageHeight = imageHeight;
  pg.metadataRotation = metadataRotation;
  pg.detectedRotation = detectedRotation;
  pg.userRotation = userRotation;
  pg.finalRotation = finalRotation;
  pg.planRotation = finalRotation;
  pg.renderScale = rendered.renderScale || (DEFAULT_PDF_TARGET_DPI / 72);
  pg.dpi = rendered.dpi || DEFAULT_PDF_TARGET_DPI;
  pg.format = rendered.format || "PNG";
  pg.sourcePdfPageNumber = rendered.sourcePdfPageNumber || pageNum;
  pg.orientationMethod = orientation.method || rendered.orientationMethod || "raster-orientation-analysis";
  pg.orientationConfidence = orientation.confidence || rendered.orientationConfidence || "unknown";
  pg.orientationScores = orientation.scores || rendered.orientationScores || analysis?.scores || null;
  pg.orientationAnalysis = analysis;
  pg.orientationConfirmed = false;
  if (process.env.NODE_ENV !== "production") {
    console.info("[AI takeoff orientation import]", {
      metadataRotation,
      analysisSelectedRotation: analysis?.selectedRotation ?? detectedRotation,
      appliedRotation: analysis?.diagnostics?.appliedRotation ?? finalRotation,
      finalRotation,
      confidence: orientation.confidence || analysis?.confidence || rendered.orientationConfidence || "unknown",
      reason: analysis?.reason || "",
      imageWidth: pg.imageWidth,
      imageHeight: pg.imageHeight,
      pdfJsAlreadyAppliedRotation: Boolean(analysis?.diagnostics?.pdfJsAlreadyAppliedRotation),
      rasterNormalizerAppliedRotation: Boolean(analysis?.diagnostics?.rasterNormalizerAppliedRotation),
    });
  }
  pg.detectedScaleText = metadata.detectedScaleText || rendered.detectedScaleText || "";
  pg.originalFileName = file.name;
  pg.originalFileUrl = originalFileUrl;
  pg.originalWidth = metadata.originalImageWidth || rendered.originalWidth || imageWidth;
  pg.originalHeight = metadata.originalImageHeight || rendered.originalHeight || imageHeight;
  pg.normalisedImageData = rendered.imageDataUrl;
  pg.normalisedImageUrl = rendered.imageDataUrl;
  return pg;
}

function isPdfPage(page) {
  const name = `${page?.originalFileName || page?.planFileName || ""}`.toLowerCase();
  return Boolean(page?.originalFileUrl && name.endsWith(".pdf"));
}

async function renderPageWithPlanRotation(page, rotationDegrees) {
  const userRotation = normalizePlanRotation(rotationDegrees);
  const rotationState = {
    metadataRotation: page.metadataRotation || 0,
    detectedRotation: page.detectedRotation || 0,
    userRotation,
    orientationMethod: page.orientationMethod,
    orientationConfidence: page.orientationConfidence,
    orientationScores: page.orientationScores,
  };
  const finalRotation = getFinalPlanRotation(rotationState);
  if (!isPdfPage(page)) {
    return {
      ...page,
      userRotation,
      finalRotation,
      planRotation: finalRotation,
      scale: null,
      overlays: [],
      rotationResetWarning: ROTATION_RESET_WARNING,
    };
  }

  const rendered = await renderPdfDataUrlPage(page.originalFileUrl, page.pageNumber || 1, rotationState, page.dpi || DEFAULT_PDF_TARGET_DPI);
  return {
    ...page,
    imageDataUrl: rendered.dataUrl,
    naturalWidth: rendered.normalizedWidth,
    naturalHeight: rendered.normalizedHeight,
    originalWidth: rendered.originalWidth,
    originalHeight: rendered.originalHeight,
    metadataRotation: rendered.metadataRotation,
    detectedRotation: rendered.detectedRotation,
    userRotation: rendered.userRotation,
    finalRotation: rendered.finalRotation,
    renderScale: rendered.renderScale,
    dpi: rendered.dpi,
    orientationMethod: rendered.orientationMethod,
    orientationConfidence: rendered.orientationConfidence,
    orientationConfirmed: false,
    orientationScores: rendered.orientationScores,
    normalizedWidth: rendered.normalizedWidth,
    normalizedHeight: rendered.normalizedHeight,
    imageWidth: rendered.imageWidth,
    imageHeight: rendered.imageHeight,
    format: rendered.format,
    sourcePdfPageNumber: rendered.sourcePdfPageNumber,
    detectedScaleText: rendered.detectedScaleText,
    normalisedImageData: rendered.dataUrl,
    normalisedImageUrl: rendered.dataUrl,
    planRotation: rendered.finalRotation,
    scale: null,
    overlays: [],
    rotationResetWarning: ROTATION_RESET_WARNING,
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
    normalizedWidth: firstPage?.normalizedWidth || firstPage?.naturalWidth || 0,
    normalizedHeight: firstPage?.normalizedHeight || firstPage?.naturalHeight || 0,
    fileUrl: firstPage?.imageDataUrl || "",
    normalisedImageData: firstPage?.normalisedImageData || firstPage?.imageDataUrl || "",
    normalisedImageUrl: firstPage?.normalisedImageUrl || firstPage?.imageDataUrl || "",
    fileType: file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image"),
    planType: inferred.planType,
    levelLabel: inferred.levelLabel,
    includedInTakeoff: true,
    metadataRotation: normalizePlanRotation(firstPage?.metadataRotation || 0),
    detectedRotation: normalizePlanRotation(firstPage?.detectedRotation || 0),
    userRotation: normalizePlanRotation(firstPage?.userRotation || 0),
    finalRotation: normalizePlanRotation(firstPage?.finalRotation ?? firstPage?.planRotation ?? 0),
    planRotation: normalizePlanRotation(firstPage?.finalRotation ?? firstPage?.planRotation ?? 0),
    imageWidth: firstPage?.imageWidth || firstPage?.normalizedWidth || 0,
    imageHeight: firstPage?.imageHeight || firstPage?.normalizedHeight || 0,
    renderScale: firstPage?.renderScale || (DEFAULT_PDF_TARGET_DPI / 72),
    dpi: firstPage?.dpi || DEFAULT_PDF_TARGET_DPI,
    format: firstPage?.format || "PNG",
    sourcePdfPageNumber: firstPage?.sourcePdfPageNumber || firstPage?.pageNumber || 1,
    orientationMethod: firstPage?.orientationMethod || "",
    orientationConfidence: firstPage?.orientationConfidence || "",
    orientationConfirmed: Boolean(firstPage?.orientationConfirmed),
    detectedScaleText: firstPage?.detectedScaleText || "",
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
  onTakeoffDataChange,
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

        setProgress(`Converting ${file.name} to high-resolution plan image...`);
        const originalFileUrl = await readFileAsDataUrl(file).catch(() => "");
        const createdPages = [];

        if (isPdf) {
          const pdfjsLib = await loadPdfJs();
          const arrayBuffer = await file.arrayBuffer();
          const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum += 1) {
            setProgress(`Detecting orientation for ${file.name} page ${pageNum} of ${pdfDoc.numPages}...`);
            const pdfPage = await pdfDoc.getPage(pageNum);
            const rendered = await renderPdfPageToRaster(pdfPage, {
              pageNumber: pageNum,
              sourceFileName: file.name,
              dpi: DEFAULT_PDF_TARGET_DPI,
              onProgress: (update) => {
                if (update?.message) setProgress(update.message);
              },
            });
            const pg = engineRasterToLegacyPage(rendered, file, pageNum, originalFileUrl);
            createdPages.push(pg);
          }
        } else {
          setProgress(`Analysing orientation for ${file.name}...`);
          const rendered = await renderImageFileWithEngineAnalysis(file);
          const pg = engineRasterToLegacyPage(rendered, file, 1, originalFileUrl);
          createdPages.push(pg);
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
        plan.normalizedWidth = createdPages[0]?.normalizedWidth || createdPages[0]?.naturalWidth || plan.normalizedWidth || 0;
        plan.normalizedHeight = createdPages[0]?.normalizedHeight || createdPages[0]?.naturalHeight || plan.normalizedHeight || 0;
        plan.imageWidth = createdPages[0]?.imageWidth || plan.normalizedWidth;
        plan.imageHeight = createdPages[0]?.imageHeight || plan.normalizedHeight;
        plan.normalisedImageData = createdPages[0]?.normalisedImageData || createdPages[0]?.imageDataUrl || "";
        plan.normalisedImageUrl = createdPages[0]?.normalisedImageUrl || createdPages[0]?.imageDataUrl || "";
        plan.metadataRotation = normalizePlanRotation(createdPages[0]?.metadataRotation || 0);
        plan.detectedRotation = normalizePlanRotation(createdPages[0]?.detectedRotation || 0);
        plan.userRotation = normalizePlanRotation(createdPages[0]?.userRotation || 0);
        plan.finalRotation = normalizePlanRotation(createdPages[0]?.finalRotation ?? createdPages[0]?.planRotation ?? 0);
        plan.planRotation = plan.finalRotation;
        plan.renderScale = createdPages[0]?.renderScale || (DEFAULT_PDF_TARGET_DPI / 72);
        plan.dpi = createdPages[0]?.dpi || DEFAULT_PDF_TARGET_DPI;
        plan.format = createdPages[0]?.format || "PNG";
        plan.sourcePdfPageNumber = createdPages[0]?.sourcePdfPageNumber || 1;
        plan.orientationMethod = createdPages[0]?.orientationMethod || "";
        plan.orientationConfidence = createdPages[0]?.orientationConfidence || "";
        plan.orientationConfirmed = Boolean(createdPages[0]?.orientationConfirmed);
        plan.detectedScaleText = createdPages[0]?.detectedScaleText || "";
        plan.detectedScale = createdPages[0]?.detectedScale || null;
        plan.scale = createdPages[0]?.scale || null;
        plan.scaleConfidence = createdPages[0]?.scaleConfidence || createdPages[0]?.detectedScale?.confidence || 0;
        plan.scaleNeedsReview = Boolean(createdPages[0]?.scaleNeedsReview || !createdPages[0]?.scale?.accepted);
        console.info("[EstimateBuilder] Plan upload rotation saved", {
          planFileName: plan.fileName,
          savedRotationValue: plan.planRotation,
        });
        nextPlans.push(plan);
        nextPages.push(...createdPages);
      }

      if (onTakeoffDataChange) {
        onTakeoffDataChange(nextPages, nextPlans);
      } else {
        onPlansChange(nextPlans);
        onPagesChange(nextPages);
      }
      if (!selectedPageId && nextPages[0]) onSelectPage(nextPages[0].id);
      setProgress("Plan ready for scale calibration.");
    } catch (err) {
      setError(`Failed to process plan file: ${err.message}`);
    } finally {
      setLoading(false);
      setProgress("");
    }
  }, [jobId, onPagesChange, onPlansChange, onSelectPage, onTakeoffDataChange, pages, plans, selectedPageId]);

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

  const deletePlan = useCallback((planId) => {
    const nextPlans = plans.filter((plan) => plan.id !== planId);
    const nextPages = pages.filter((page) => page.planId !== planId);
    if (onTakeoffDataChange) {
      onTakeoffDataChange(nextPages, nextPlans);
    } else {
      onPlansChange(nextPlans);
      onPagesChange(nextPages);
    }
    if (selectedPageId && !nextPages.some((page) => page.id === selectedPageId)) {
      onSelectPage(nextPages[0]?.id || null);
    }
  }, [onPagesChange, onPlansChange, onSelectPage, onTakeoffDataChange, pages, plans, selectedPageId]);

  const rotatePlan = useCallback(async (planId, rotationDegrees) => {
    const degrees = normalizePlanRotation(rotationDegrees);
    if (!degrees) return;
    setProgress("Rotating plan...");
    try {
      const rotatedPages = await Promise.all(pages.map(async (page) => {
        if (page.planId !== planId) return page;
        const nextRotation = normalizePlanRotation((page.userRotation || 0) + degrees);
        if (page.imageDataUrl) {
          const rotated = await rotateRasterImageDataUrl(page.imageDataUrl, degrees);
          return {
            ...page,
            imageDataUrl: rotated.dataUrl,
            naturalWidth: rotated.width,
            naturalHeight: rotated.height,
            normalizedWidth: rotated.width,
            normalizedHeight: rotated.height,
            imageWidth: rotated.width,
            imageHeight: rotated.height,
            userRotation: nextRotation,
            finalRotation: getFinalPlanRotation({ metadataRotation: page.metadataRotation || 0, detectedRotation: page.detectedRotation || 0, userRotation: nextRotation }),
            planRotation: getFinalPlanRotation({ metadataRotation: page.metadataRotation || 0, detectedRotation: page.detectedRotation || 0, userRotation: nextRotation }),
            orientationMethod: "manual",
            orientationConfidence: "manual",
            orientationConfirmed: false,
            scale: null,
            overlays: [],
            rotationResetWarning: ROTATION_RESET_WARNING,
          };
        }
        return renderPageWithPlanRotation(page, nextRotation);
      }));
      const firstPage = rotatedPages.find((page) => page.planId === planId);
      const planRotation = normalizePlanRotation(firstPage?.finalRotation ?? firstPage?.planRotation ?? 0);
      const nextPlans = plans.map((plan) => plan.id === planId ? {
        ...plan,
        metadataRotation: normalizePlanRotation(firstPage?.metadataRotation || 0),
        detectedRotation: normalizePlanRotation(firstPage?.detectedRotation || 0),
        userRotation: normalizePlanRotation(firstPage?.userRotation || 0),
        finalRotation: planRotation,
        planRotation,
        imageWidth: firstPage?.imageWidth || firstPage?.normalizedWidth || plan.imageWidth,
        imageHeight: firstPage?.imageHeight || firstPage?.normalizedHeight || plan.imageHeight,
        renderScale: firstPage?.renderScale || plan.renderScale || (DEFAULT_PDF_TARGET_DPI / 72),
        dpi: firstPage?.dpi || plan.dpi,
        format: firstPage?.format || plan.format || "PNG",
        sourcePdfPageNumber: firstPage?.sourcePdfPageNumber || plan.sourcePdfPageNumber,
        orientationMethod: firstPage?.orientationMethod || plan.orientationMethod,
        orientationConfidence: firstPage?.orientationConfidence || plan.orientationConfidence,
        orientationConfirmed: Boolean(firstPage?.orientationConfirmed),
        fileUrl: firstPage?.imageDataUrl || plan.fileUrl,
        normalisedImageData: firstPage?.normalisedImageData || firstPage?.imageDataUrl || plan.normalisedImageData,
        normalisedImageUrl: firstPage?.normalisedImageUrl || firstPage?.imageDataUrl || plan.normalisedImageUrl,
        originalWidth: firstPage?.originalWidth || plan.originalWidth,
        originalHeight: firstPage?.originalHeight || plan.originalHeight,
        normalizedWidth: firstPage?.normalizedWidth || firstPage?.naturalWidth || plan.normalizedWidth,
        normalizedHeight: firstPage?.normalizedHeight || firstPage?.naturalHeight || plan.normalizedHeight,
        scale: null,
        scaleNeedsReview: true,
        rotationResetWarning: ROTATION_RESET_WARNING,
      } : plan);
      onPagesChange(rotatedPages);
      onPlansChange(nextPlans);
      const savedPlan = nextPlans.find((plan) => plan.id === planId);
      console.info("[EstimateBuilder] Manual plan rotation saved", {
        planFileName: savedPlan?.fileName || "",
        appliedRotation: degrees,
        savedRotationValue: savedPlan?.planRotation || 0,
      });
    } finally {
      setProgress("");
    }
  }, [onPagesChange, onPlansChange, pages, plans]);

  const resetPlanRotation = useCallback(async (planId) => {
    setProgress("Resetting plan rotation...");
    try {
      const resetPages = await Promise.all(pages.map(async (page) => (
        page.planId === planId ? renderPageWithPlanRotation(page, 0) : page
      )));
      const firstPage = resetPages.find((page) => page.planId === planId);
      const finalRotation = normalizePlanRotation(firstPage?.finalRotation ?? firstPage?.planRotation ?? 0);
      const nextPlans = plans.map((plan) => plan.id === planId ? {
        ...plan,
        metadataRotation: normalizePlanRotation(firstPage?.metadataRotation || 0),
        detectedRotation: normalizePlanRotation(firstPage?.detectedRotation || 0),
        userRotation: 0,
        finalRotation,
        planRotation: finalRotation,
        imageWidth: firstPage?.imageWidth || firstPage?.normalizedWidth || plan.imageWidth,
        imageHeight: firstPage?.imageHeight || firstPage?.normalizedHeight || plan.imageHeight,
        renderScale: firstPage?.renderScale || plan.renderScale || (DEFAULT_PDF_TARGET_DPI / 72),
        dpi: firstPage?.dpi || plan.dpi,
        format: firstPage?.format || plan.format || "PNG",
        sourcePdfPageNumber: firstPage?.sourcePdfPageNumber || plan.sourcePdfPageNumber,
        orientationMethod: firstPage?.orientationMethod || plan.orientationMethod,
        orientationConfidence: firstPage?.orientationConfidence || plan.orientationConfidence,
        fileUrl: firstPage?.imageDataUrl || plan.fileUrl,
        normalisedImageData: firstPage?.normalisedImageData || firstPage?.imageDataUrl || plan.normalisedImageData,
        normalisedImageUrl: firstPage?.normalisedImageUrl || firstPage?.imageDataUrl || plan.normalisedImageUrl,
        originalWidth: firstPage?.originalWidth || plan.originalWidth,
        originalHeight: firstPage?.originalHeight || plan.originalHeight,
        normalizedWidth: firstPage?.normalizedWidth || firstPage?.naturalWidth || plan.normalizedWidth,
        normalizedHeight: firstPage?.normalizedHeight || firstPage?.naturalHeight || plan.normalizedHeight,
        scale: null,
        scaleNeedsReview: true,
        rotationResetWarning: ROTATION_RESET_WARNING,
      } : plan);
      onPagesChange(resetPages);
      onPlansChange(nextPlans);
    } finally {
      setProgress("");
    }
  }, [onPagesChange, onPlansChange, pages, plans]);

  const confirmPlanOrientation = useCallback((planId) => {
    const nextPages = pages.map((page) => page.planId === planId ? {
      ...page,
      orientationConfirmed: true,
      orientationMethod: page.orientationMethod || "manual-confirmed",
      orientationConfidence: "confirmed",
    } : page);
    const firstPage = nextPages.find((page) => page.planId === planId);
    const nextPlans = plans.map((plan) => plan.id === planId ? {
      ...plan,
      orientationConfirmed: true,
      orientationMethod: firstPage?.orientationMethod || plan.orientationMethod || "manual-confirmed",
      orientationConfidence: "confirmed",
    } : plan);
    onPagesChange(nextPages);
    onPlansChange(nextPlans);
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
              onRotate180={() => rotatePlan(plan.id, 180)}
              onResetRotation={() => resetPlanRotation(plan.id)}
              onConfirmOrientation={() => confirmPlanOrientation(plan.id)}
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

function PlanCard({ plan, index, pages, selectedPageId, onUpdate, onPreview, onDelete, onRotateLeft, onRotateRight, onRotate180, onResetRotation, onConfirmOrientation, onPageSelect, onPageLevelChange }) {
  const firstPage = pages[0] || {};
  const scaleSet = Boolean(firstPage.scale?.accepted || getPixelsPerUnit(firstPage.scale) || firstPage.scale?.preset);
  const warning = pages.find((page) => page.rotationResetWarning)?.rotationResetWarning || plan.rotationResetWarning || "";
  const orientationConfirmed = Boolean(firstPage.orientationConfirmed || plan.orientationConfirmed);
  const orientationConfidence = firstPage.orientationConfidence || plan.orientationConfidence || "";
  const showOrientationCheck = !orientationConfirmed && !["high", "confirmed", "manual"].includes(String(orientationConfidence).toLowerCase());
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
          Include
        </label>
      </div>
      <div style={S.planMeta}>
        Uploaded {formatDate(plan.uploadedAt)}
        <span style={S.scaleMeta}>Scale: {scaleSet ? "set" : "not set"}</span>
        {!scaleSet && <span style={S.reviewBadge}>Needs scale</span>}
      </div>
      <div style={S.importDetails}>
        <span>DPI: {Math.round(firstPage.dpi || plan.dpi || 300)}</span>
        <span>Format: {firstPage.format || plan.format || "PNG"}</span>
        <span>Orientation: {orientationConfirmed ? "Confirmed" : (firstPage.orientationMethod || plan.orientationMethod) === "manual" ? "Manual" : "Auto"}</span>
      </div>
      {showOrientationCheck && <div style={S.orientationCheck}>Orientation may need checking</div>}
      {(firstPage.detectedScaleText || plan.detectedScaleText) && (
        <div style={S.scaleTextFound}>Scale text found: {firstPage.detectedScaleText || plan.detectedScaleText} (not applied)</div>
      )}
      {warning && <div style={S.rotationWarning}>{warning}</div>}
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
        <button type="button" style={S.quickRotateButton} onClick={onRotateRight}>Rotate 90°</button>
        <button type="button" style={S.quickRotateButton} onClick={onRotate180}>Rotate 180°</button>
        <button type="button" style={S.quickRotateButton} onClick={onRotateLeft}>Rotate 270°</button>
        <button type="button" style={S.confirmOrientationButton} onClick={onConfirmOrientation}>Set as correct orientation</button>
        <button type="button" style={S.rotateButton} onClick={onResetRotation}>Reset rotation</button>
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
        {page.scale && <div style={S.thumbScale}>{page.scale.method === "preset" ? page.scale.preset : "Scale set"}</div>}
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
  importDetails: { display: "flex", flexWrap: "wrap", gap: 6, color: "#475569", fontSize: 11, fontWeight: 800 },
  scaleTextFound: { padding: "5px 7px", borderRadius: 6, background: "#eef2ff", color: "#3730a3", fontSize: 11, fontWeight: 800 },
  orientationCheck: { padding: "7px 8px", borderRadius: 7, background: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa", fontSize: 12, fontWeight: 900 },
  reviewBadge: { display: "inline-flex", alignItems: "center", border: "1px solid #fbbf24", borderRadius: 999, padding: "2px 7px", background: "#fffbeb", color: "#92400e", fontWeight: 900 },
  rotationWarning: { border: "1px solid #fbbf24", borderRadius: 7, padding: "7px 8px", background: "#fffbeb", color: "#92400e", fontSize: 11, fontWeight: 800, lineHeight: 1.35 },
  fieldLabel: { display: "grid", gap: 4, color: "#475569", fontSize: 11, fontWeight: 800 },
  select: { width: "100%", border: "1.5px solid #cbd5e1", borderRadius: 6, background: "#f8fafc", color: "#0f172a", padding: "7px 8px", fontSize: 12 },
  input: { width: "100%", boxSizing: "border-box", border: "1.5px solid #cbd5e1", borderRadius: 6, background: "#ffffff", color: "#0f172a", padding: "7px 8px", fontSize: 12 },
  planActions: { display: "flex", flexWrap: "wrap", gap: 6 },
  previewButton: { flex: 1, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", borderRadius: 6, padding: "6px 8px", fontSize: 12, fontWeight: 800, cursor: "pointer" },
  quickRotateButton: { flex: "1 1 76px", border: "1px solid #fdba74", background: "#fff7ed", color: "#c2410c", borderRadius: 7, padding: "8px 8px", fontSize: 12, fontWeight: 900, cursor: "pointer" },
  confirmOrientationButton: { flex: "1 1 100%", border: "1px solid #86efac", background: "#dcfce7", color: "#166534", borderRadius: 7, padding: "8px 8px", fontSize: 12, fontWeight: 900, cursor: "pointer" },
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
