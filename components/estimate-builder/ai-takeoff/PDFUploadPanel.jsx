// PDFUploadPanel.jsx
// Multi-plan upload manager for Estimate Builder AI takeoff.

import { useState, useRef, useCallback } from "react";
import { createPage, LEVEL_OPTIONS } from "./takeoffTypes";
import { getPixelsPerUnit } from "./takeoffUtils";
import {
  loadPdfJs,
  renderPdfPageToDataUrl,
  renderPdfDataUrlPage,
  normalizePlanRotation,
} from "./pdfPlanRendering";

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

function isPdfPage(page) {
  const name = `${page?.originalFileName || page?.planFileName || ""}`.toLowerCase();
  return Boolean(page?.originalFileUrl && name.endsWith(".pdf"));
}

async function renderPageWithPlanRotation(page, rotationDegrees) {
  const planRotation = normalizePlanRotation(rotationDegrees);
  if (!isPdfPage(page)) {
    return {
      ...page,
      planRotation,
    };
  }

  const rendered = await renderPdfDataUrlPage(page.originalFileUrl, page.pageNumber || 1, planRotation, 2.0);
  return {
    ...page,
    imageDataUrl: rendered.dataUrl,
    naturalWidth: rendered.width,
    naturalHeight: rendered.height,
    originalWidth: rendered.width,
    originalHeight: rendered.height,
    normalisedImageData: rendered.dataUrl,
    normalisedImageUrl: rendered.dataUrl,
    planRotation: rendered.planRotation,
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
    planRotation: normalizePlanRotation(firstPage?.planRotation || 0),
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
            const rendered = await renderPdfPageToDataUrl(pdfDoc, pageNum, 2.0, 0);
            const pg = createPage(pageNum);
            pg.imageDataUrl = rendered.dataUrl;
            pg.naturalWidth = rendered.width;
            pg.naturalHeight = rendered.height;
            pg.planRotation = rendered.planRotation || 0;
            pg.originalFileName = file.name;
            pg.originalFileUrl = originalFileUrl;
            pg.originalWidth = rendered.width;
            pg.originalHeight = rendered.height;
            createdPages.push(pg);
          }
        } else {
          const rendered = await renderImageToDataUrl(file);
          const pg = createPage(1);
          pg.imageDataUrl = rendered.dataUrl;
          pg.naturalWidth = rendered.width;
          pg.naturalHeight = rendered.height;
          pg.planRotation = 0;
          pg.originalFileName = file.name;
          pg.originalFileUrl = originalFileUrl;
          pg.originalWidth = rendered.width;
          pg.originalHeight = rendered.height;
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
        plan.normalisedImageData = createdPages[0]?.normalisedImageData || createdPages[0]?.imageDataUrl || "";
        plan.normalisedImageUrl = createdPages[0]?.normalisedImageUrl || createdPages[0]?.imageDataUrl || "";
        plan.planRotation = normalizePlanRotation(createdPages[0]?.planRotation || 0);
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
    const degrees = normalizePlanRotation(rotationDegrees);
    if (!degrees) return;
    setProgress("Rotating plan...");
    try {
      const rotatedPages = await Promise.all(pages.map(async (page) => {
        if (page.planId !== planId) return page;
        const nextRotation = normalizePlanRotation((page.planRotation || 0) + degrees);
        return renderPageWithPlanRotation(page, nextRotation);
      }));
      const firstPage = rotatedPages.find((page) => page.planId === planId);
      const planRotation = normalizePlanRotation(firstPage?.planRotation || 0);
      const nextPlans = plans.map((plan) => plan.id === planId ? {
        ...plan,
        planRotation,
        fileUrl: firstPage?.imageDataUrl || plan.fileUrl,
        normalisedImageData: firstPage?.normalisedImageData || firstPage?.imageDataUrl || plan.normalisedImageData,
        normalisedImageUrl: firstPage?.normalisedImageUrl || firstPage?.imageDataUrl || plan.normalisedImageUrl,
        originalWidth: firstPage?.originalWidth || firstPage?.naturalWidth || plan.originalWidth,
        originalHeight: firstPage?.originalHeight || firstPage?.naturalHeight || plan.originalHeight,
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
      const nextPlans = plans.map((plan) => plan.id === planId ? {
        ...plan,
        planRotation: 0,
        fileUrl: firstPage?.imageDataUrl || plan.fileUrl,
        normalisedImageData: firstPage?.normalisedImageData || firstPage?.imageDataUrl || plan.normalisedImageData,
        normalisedImageUrl: firstPage?.normalisedImageUrl || firstPage?.imageDataUrl || plan.normalisedImageUrl,
        originalWidth: firstPage?.originalWidth || firstPage?.naturalWidth || plan.originalWidth,
        originalHeight: firstPage?.originalHeight || firstPage?.naturalHeight || plan.originalHeight,
      } : plan);
      onPagesChange(resetPages);
      onPlansChange(nextPlans);
    } finally {
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
              onResetRotation={() => resetPlanRotation(plan.id)}
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

function PlanCard({ plan, index, pages, selectedPageId, onUpdate, onPreview, onDelete, onRotateLeft, onRotateRight, onResetRotation, onPageSelect, onPageLevelChange }) {
  const scaleSet = Boolean(plan.scale?.accepted || getPixelsPerUnit(plan.scale) || plan.scale?.preset);
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
        {page.scale && <div style={S.thumbScale}>{page.scale.method === "preset" ? page.scale.preset : `${getPixelsPerUnit(page.scale).toFixed(0)} px/unit`}</div>}
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
