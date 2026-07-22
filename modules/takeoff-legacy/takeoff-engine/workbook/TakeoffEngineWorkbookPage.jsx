import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TakeoffViewer from "../viewer/TakeoffViewer.jsx";
import { normalizeRasterImagePage, rotateRasterImageDataUrl } from "../import/imageNormalizer.js";
import { importPdfToRasterPages } from "../import/pdfToRaster.js";
import { detectScaleSuggestionsWithOcr } from "../import/scaleTextDetection.js";
import { analyzeRasterOrientation, applyOrientationAnalysisToRaster } from "../analysis/imageOrientationAnalysis.js";
import { normalizeRotation } from "../core/orientation.js";
import { TAKEOFF_ACTIONS, takeoffReducer } from "../state/takeoffReducer.js";
import {
  getTakeoffPersistenceDiagnostics,
  hydrateTakeoffStateFromWorkbook,
} from "../state/takeoffPersistence.js";

const PDFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const IMPORT_STEPS = [
  { key: "reading-file", label: "Reading file...", percent: 8 },
  { key: "converting-page", label: "Converting PDF page...", percent: 25 },
  { key: "detecting-orientation", label: "Detecting orientation...", percent: 45 },
  { key: "rendering-png", label: "Rendering high-resolution PNG...", percent: 65 },
  { key: "checking-scale-text", label: "Checking for scale text...", percent: 82 },
  { key: "preparing-viewer", label: "Preparing viewer...", percent: 92 },
  { key: "plan-ready", label: "Plan ready", percent: 100 },
];

function getImportStep(stage) {
  return IMPORT_STEPS.find((step) => step.key === stage) || IMPORT_STEPS[0];
}

function createIdleImportProgress() {
  return {
    active: false,
    stage: "idle",
    message: "Ready",
    detail: "",
    percent: 0,
    largePlan: false,
    error: "",
  };
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
        return;
      }
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function loadPdfJs() {
  if (typeof window === "undefined") {
    throw new Error("PDF import requires a browser.");
  }

  if (!window.pdfjsLib) {
    await loadScript(PDFJS_URL);
  }

  if (!window.pdfjsLib) {
    throw new Error("PDF.js failed to load.");
  }

  window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
  return window.pdfjsLib;
}

async function importImageFile(file, onProgress) {
  onProgress?.({
    stage: "reading-file",
    message: "Reading file...",
    detail: file.name,
  });
  const dataUrl = await readFileAsDataUrl(file);
  onProgress?.({
    stage: "detecting-orientation",
    message: "Detecting orientation...",
    detail: "Preparing image orientation fields",
  });
  const image = await loadImage(dataUrl);
  onProgress?.({
    stage: "checking-scale-text",
    message: "Checking for scale text...",
    detail: "Scale text detection is available for raster imports after OCR is connected",
  });
  const orientationAnalysis = await analyzeRasterOrientation({
    imageDataUrl: dataUrl,
    imageWidth: image.naturalWidth || image.width,
    imageHeight: image.naturalHeight || image.height,
  });
  const rotated = await applyOrientationAnalysisToRaster({
    imageDataUrl: dataUrl,
    imageWidth: image.naturalWidth || image.width,
    imageHeight: image.naturalHeight || image.height,
    orientationAnalysis,
    rotateRaster: rotateRasterImageDataUrl,
  });
  const selectedRotation = normalizeRotation(orientationAnalysis.selectedRotation || 0);
  const suggestedRotation = normalizeRotation(orientationAnalysis.suggestedRotation ?? selectedRotation);
  const appliedRotation = normalizeRotation(rotated.rotation ?? rotated.appliedRotation ?? 0);
  const scaleDetection = await detectScaleSuggestionsWithOcr({
    imageDataUrl: rotated.imageDataUrl,
    imageWidth: rotated.imageWidth,
    imageHeight: rotated.imageHeight,
    text: "",
    dpi: 300,
    source: "raster-image-ocr",
  });
  if (process.env.NODE_ENV !== "production") {
    console.info("[takeoff orientation import]", {
      metadataRotation: 0,
      analysisSuggestedRotation: suggestedRotation,
      analysisSelectedRotation: selectedRotation,
      appliedRotation,
      finalRotation: appliedRotation,
      confidence: orientationAnalysis.confidence,
      confidenceScore: orientationAnalysis.confidenceScore,
      scoreGap: orientationAnalysis.scoreGap,
      reason: orientationAnalysis.reason,
      imageWidth: rotated.imageWidth,
      imageHeight: rotated.imageHeight,
      pdfJsAlreadyAppliedRotation: false,
      rasterNormalizerAppliedRotation: appliedRotation !== 0,
    });
  }

  return normalizeRasterImagePage({
    sourceType: "image",
    sourceFileName: file.name,
    sourcePdfPageNumber: 1,
    imageDataUrl: rotated.imageDataUrl,
    imageWidth: rotated.imageWidth,
    imageHeight: rotated.imageHeight,
    dpi: 300,
    renderScale: 1,
    format: "PNG",
    orientation: {
      detectedRotation: appliedRotation,
      confidence: orientationAnalysis.confidence,
      method: "raster-orientation-analysis",
      warning: orientationAnalysis.confidence === "high" ? "" : "Orientation may need checking.",
      scores: orientationAnalysis.scores,
      orientationConfirmed: false,
    },
    orientationAnalysis: {
      ...orientationAnalysis,
      selectedRotation,
      suggestedRotation,
      appliedRotation,
    },
    scaleDetection,
    orientationApplied: true,
  });
}

function normalizeEngineState(rawState, workbook) {
  try {
    return hydrateTakeoffStateFromWorkbook(rawState, workbook);
  } catch {
    return hydrateTakeoffStateFromWorkbook(null, workbook);
  }
}

function logTakeoffDiagnostics(label, details = {}) {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  console.info(`[takeoff-engine persistence] ${label}`, details);
}

export default function TakeoffEngineWorkbookPage({ sheet }) {
  const workbook = sheet?.workbook || {};
  const workbookEngineState = useMemo(() => normalizeEngineState(workbook.takeoffEngine, workbook), [workbook]);
  const [engineState, setEngineState] = useState(workbookEngineState);
  const [viewerKey, setViewerKey] = useState(0);
  const [status, setStatus] = useState("Ready");
  const [statusTone, setStatusTone] = useState("neutral");
  const [importProgress, setImportProgress] = useState(() => createIdleImportProgress());
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const largePlanTimerRef = useRef(null);
  const importInProgressRef = useRef(false);
  const activePage = useMemo(
    () => engineState.pages.find((page) => page.id === engineState.activePageId) || engineState.pages[0] || null,
    [engineState],
  );

  const persistEngineState = useCallback((nextState, { resetViewer = false } = {}) => {
    setEngineState(nextState);
    sheet?.updateTakeoffEngineState?.(nextState);
    logTakeoffDiagnostics("save", getTakeoffPersistenceDiagnostics({
      workbookState: nextState,
      reducerState: nextState,
      localStorageState: nextState,
      indexedDBState: nextState,
      reactState: nextState,
    }));
    if (resetViewer) {
      setViewerKey((value) => value + 1);
    }
  }, [sheet]);

  useEffect(() => () => {
    if (largePlanTimerRef.current) {
      clearTimeout(largePlanTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (importInProgressRef.current) {
      return;
    }
    logTakeoffDiagnostics("load", getTakeoffPersistenceDiagnostics({
      workbookState: workbookEngineState,
      reducerState: workbookEngineState,
      localStorageState: workbookEngineState,
      indexedDBState: workbookEngineState,
      reactState: workbookEngineState,
    }));
    setEngineState(workbookEngineState);
  }, [workbookEngineState]);

  function updateImportProgress(update = {}) {
    const step = getImportStep(update.stage);
    setImportProgress((current) => ({
      ...current,
      active: update.active ?? true,
      stage: update.stage || step.key,
      message: update.message || step.label,
      detail: update.detail || (update.pageNumber && update.pageCount ? `Page ${update.pageNumber} of ${update.pageCount}` : ""),
      percent: update.percent ?? step.percent,
      error: update.error || "",
    }));
    setStatus(update.message || step.label);
    setStatusTone("neutral");
  }

  function startImportProgress() {
    if (largePlanTimerRef.current) {
      clearTimeout(largePlanTimerRef.current);
    }
    setStatusTone("neutral");
    importInProgressRef.current = true;
    setImportProgress({
      ...createIdleImportProgress(),
      active: true,
      stage: "reading-file",
      message: "Reading file...",
      percent: 5,
    });
    largePlanTimerRef.current = setTimeout(() => {
      setImportProgress((current) => current.active ? { ...current, largePlan: true } : current);
    }, 3000);
  }

  function finishImportProgress(message = "Plan ready") {
    if (largePlanTimerRef.current) {
      clearTimeout(largePlanTimerRef.current);
      largePlanTimerRef.current = null;
    }
    setImportProgress((current) => ({
      ...current,
      active: false,
      stage: "plan-ready",
      message,
      percent: 100,
      error: "",
    }));
    setStatus(message);
    setStatusTone("success");
    importInProgressRef.current = false;
  }

  function failImportProgress(message = "Plan import failed. Please try again or upload a smaller PDF.") {
    if (largePlanTimerRef.current) {
      clearTimeout(largePlanTimerRef.current);
      largePlanTimerRef.current = null;
    }
    setImportProgress((current) => ({
      ...current,
      active: false,
      message,
      error: message,
      percent: 0,
    }));
    setStatus(message);
    setStatusTone("error");
    importInProgressRef.current = false;
  }

  const handleViewerStateChange = useCallback((nextState) => {
    if (importInProgressRef.current) {
      return;
    }
    persistEngineState(nextState);
  }, [persistEngineState]);

  function reduceEngine(action, { resetViewer = true } = {}) {
    const nextState = takeoffReducer(engineState, action);
    persistEngineState(nextState, { resetViewer });
    return nextState;
  }

  async function handleUpload(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) {
      return;
    }

    console.log("[takeoff-engine] file selected", files.map((file) => ({ name: file.name, type: file.type, size: file.size })));
    console.log("[takeoff-engine] import started");
    startImportProgress();

    try {
      let nextState = engineState;
      let importedPageCount = 0;
      for (const file of files) {
        const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
        let pages = [];

        if (isPdf) {
          updateImportProgress({
            stage: "reading-file",
            message: "Reading file...",
            detail: file.name,
          });
          const data = await readFileAsArrayBuffer(file);
          const pdfjsLib = await loadPdfJs();
          pages = await importPdfToRasterPages({
            pdfjsLib,
            data,
            sourceFileName: file.name,
            dpi: 300,
            onProgress: updateImportProgress,
          });
        } else {
          pages = [await importImageFile(file, updateImportProgress)];
        }

        console.log("[takeoff-engine] imported page count", pages.length, file.name);
        importedPageCount += pages.length;
        for (const page of pages) {
          nextState = takeoffReducer(nextState, {
            type: TAKEOFF_ACTIONS.ADD_PAGE,
            payload: page,
          });
        }
      }

      const activePageAfterImport = nextState.pages.find((page) => page.id === nextState.activePageId) || null;
      console.log("[takeoff-engine] activePageId after import", nextState.activePageId);
      console.log("[takeoff-engine] pages length after reducer update", nextState.pages.length);

      if (importedPageCount === 0 || nextState.pages.length === 0 || !activePageAfterImport) {
        failImportProgress("No plan pages were imported. Please try again.");
        event.target.value = "";
        return;
      }

      updateImportProgress({
        stage: "preparing-viewer",
        message: "Preparing viewer...",
      });
      persistEngineState(nextState, { resetViewer: true });
      finishImportProgress("Plan ready");
      event.target.value = "";
    } catch (err) {
      failImportProgress();
    }
  }

  function openPage(pageId) {
    reduceEngine({ type: TAKEOFF_ACTIONS.SET_ACTIVE_PAGE, payload: { pageId } });
  }

  function renamePage(page) {
    const name = window.prompt("Rename plan", page.sourceFileName || "Raster page");
    if (name == null) {
      return;
    }
    reduceEngine({ type: TAKEOFF_ACTIONS.RENAME_PAGE, payload: { pageId: page.id, name } });
    setStatus("Plan renamed.");
  }

  function duplicatePage(pageId) {
    reduceEngine({ type: TAKEOFF_ACTIONS.DUPLICATE_PAGE, payload: { pageId } });
    setStatus("Plan duplicated.");
  }

  function rotatePage(pageId, deltaRotation) {
    const page = engineState.pages.find((item) => item.id === pageId);
    if (!page) {
      return;
    }

    reduceEngine({
      type: TAKEOFF_ACTIONS.ROTATE_PAGE,
      payload: { pageId, deltaRotation },
    });
    setStatus("Plan rotation updated.");
  }

  function confirmDeletePage() {
    if (!deleteCandidate) {
      return;
    }
    const nextState = reduceEngine({
      type: TAKEOFF_ACTIONS.DELETE_PAGE,
      payload: { pageId: deleteCandidate.id },
    });
    setDeleteCandidate(null);
    setStatus(nextState.pages.length ? "Plan deleted." : "No plans loaded.");
  }

  return (
    <div style={styles.shell}>
      <div style={styles.header}>
        <div>
          <div style={styles.eyebrow}>Raster takeoff engine</div>
          <h2 style={styles.title}>AI Plan Takeoff</h2>
        </div>
        <div style={styles.actions}>
          <label style={importProgress.active ? styles.uploadButtonDisabled : styles.uploadButton}>
            {importProgress.active ? "Importing..." : "Upload PDF / Image"}
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              multiple
              onChange={handleUpload}
              disabled={importProgress.active}
              style={styles.fileInput}
            />
          </label>
          <span style={statusTone === "error" ? styles.errorStatus : statusTone === "success" ? styles.successStatus : styles.status}>{status}</span>
        </div>
      </div>

      {importProgress.active ? (
        <div style={styles.progressBanner}>
          <div style={styles.progressHeader}>
            <strong>{importProgress.message}</strong>
            <span>{Math.round(importProgress.percent || 0)}%</span>
          </div>
          <div style={styles.progressTrack}>
            <div style={{ ...styles.progressFill, width: `${Math.max(0, Math.min(100, importProgress.percent || 0))}%` }} />
          </div>
          <div style={styles.stepRow}>
            {IMPORT_STEPS.map((step) => (
              <span key={step.key} style={(importProgress.percent || 0) >= step.percent ? styles.stepDone : styles.step}>
                {step.label.replace("...", "")}
              </span>
            ))}
          </div>
          {importProgress.largePlan ? (
            <div style={styles.largePlanNotice}>Large plan detected. This may take a little longer.</div>
          ) : null}
        </div>
      ) : null}

      {importProgress.error ? <div style={styles.errorBanner}>{importProgress.error}</div> : null}

      <div style={styles.body}>
        <aside style={styles.sidebar}>
          <div style={styles.sidebarTitle}>Plans</div>
          {engineState.pages.length ? engineState.pages.map((page) => (
            <div key={page.id} style={page.id === activePage?.id ? styles.activeCard : styles.card}>
              <button type="button" style={styles.pageSelect} onClick={() => openPage(page.id)}>
                <strong>{page.sourceFileName || "Raster page"}</strong>
                <span>{page.imageWidth} x {page.imageHeight}px | {page.format}</span>
                <span>{page.orientation?.orientationConfirmed ? "Orientation confirmed" : "Check orientation"}</span>
              </button>
              <div style={styles.cardActions}>
                <button type="button" style={styles.smallButton} onClick={() => openPage(page.id)}>Open</button>
                <button type="button" style={styles.smallButton} onClick={() => renamePage(page)}>Rename</button>
                <button type="button" style={styles.smallButton} onClick={() => duplicatePage(page.id)}>Duplicate</button>
                <button type="button" style={styles.smallButton} onClick={() => rotatePage(page.id, 90)}>Rotate 90</button>
                <button type="button" style={styles.smallButton} onClick={() => rotatePage(page.id, 180)}>Rotate 180</button>
                <button type="button" style={styles.smallButton} onClick={() => rotatePage(page.id, 270)}>Rotate 270</button>
                <button type="button" style={styles.deleteButton} onClick={() => setDeleteCandidate(page)}>Delete</button>
              </div>
            </div>
          )) : (
            <div style={styles.empty}>No plans loaded</div>
          )}
        </aside>

        <section style={styles.viewer}>
          <TakeoffViewer
            key={`${engineState.id}:${engineState.activePageId || "none"}:${viewerKey}`}
            initialState={engineState}
            onStateChange={handleViewerStateChange}
            importProgress={importProgress}
          />
        </section>
      </div>

      {deleteCandidate ? (
        <div style={styles.modalBackdrop} role="presentation">
          <div style={styles.modal} role="dialog" aria-modal="true" aria-labelledby="delete-plan-title">
            <h2 id="delete-plan-title" style={styles.modalTitle}>Delete this plan?</h2>
            <p style={styles.modalText}>{deleteCandidate.sourceFileName || "Raster page"}</p>
            <div style={styles.modalActions}>
              <button type="button" style={styles.smallButton} onClick={() => setDeleteCandidate(null)}>Cancel</button>
              <button type="button" style={styles.confirmDeleteButton} onClick={confirmDeletePage}>Delete</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const styles = {
  shell: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    padding: 10,
  },
  eyebrow: {
    color: "#0f766e",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0,
  },
  title: {
    margin: 0,
    fontSize: 24,
  },
  actions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  uploadButton: {
    border: "1px solid #0f766e",
    background: "#0f766e",
    color: "#ffffff",
    borderRadius: 6,
    padding: "8px 10px",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
  },
  uploadButtonDisabled: {
    border: "1px solid #94a3b8",
    background: "#94a3b8",
    color: "#ffffff",
    borderRadius: 6,
    padding: "8px 10px",
    fontSize: 13,
    fontWeight: 900,
    cursor: "not-allowed",
    opacity: 0.8,
  },
  fileInput: {
    display: "none",
  },
  status: {
    color: "#475569",
    fontSize: 12,
    fontWeight: 800,
  },
  successStatus: {
    color: "#047857",
    fontSize: 12,
    fontWeight: 900,
  },
  errorStatus: {
    color: "#b91c1c",
    fontSize: 12,
    fontWeight: 900,
  },
  progressBanner: {
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    borderRadius: 6,
    padding: 10,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  progressHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    color: "#1e3a8a",
    fontSize: 12,
  },
  progressTrack: {
    height: 8,
    background: "#dbeafe",
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: "#0f766e",
    borderRadius: 999,
    transition: "width 160ms ease",
  },
  stepRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },
  step: {
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#64748b",
    borderRadius: 999,
    padding: "3px 7px",
    fontSize: 10,
    fontWeight: 900,
  },
  stepDone: {
    border: "1px solid #99f6e4",
    background: "#ccfbf1",
    color: "#0f766e",
    borderRadius: 999,
    padding: "3px 7px",
    fontSize: 10,
    fontWeight: 900,
  },
  largePlanNotice: {
    color: "#92400e",
    background: "#fffbeb",
    border: "1px solid #fde68a",
    borderRadius: 6,
    padding: "7px 8px",
    fontSize: 12,
    fontWeight: 900,
  },
  errorBanner: {
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#b91c1c",
    borderRadius: 6,
    padding: "9px 10px",
    fontSize: 12,
    fontWeight: 900,
  },
  body: {
    display: "grid",
    gridTemplateColumns: "280px minmax(0, 1fr)",
    gap: 10,
    minHeight: 620,
    height: "calc(100vh - 220px)",
  },
  sidebar: {
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    padding: 10,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  sidebarTitle: {
    color: "#334155",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
  },
  card: {
    border: "1px solid #dbe4ef",
    borderRadius: 6,
    padding: 8,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  activeCard: {
    border: "1px solid #0f766e",
    background: "#ecfdf5",
    borderRadius: 6,
    padding: 8,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  pageSelect: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 3,
    border: 0,
    background: "transparent",
    color: "#0f172a",
    padding: 0,
    textAlign: "left",
    fontSize: 12,
    cursor: "pointer",
  },
  cardActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 5,
  },
  smallButton: {
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    borderRadius: 6,
    padding: "5px 7px",
    fontSize: 11,
    fontWeight: 900,
    cursor: "pointer",
  },
  deleteButton: {
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#991b1b",
    borderRadius: 6,
    padding: "5px 7px",
    fontSize: 11,
    fontWeight: 900,
    cursor: "pointer",
  },
  empty: {
    color: "#64748b",
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    borderRadius: 6,
    padding: 12,
    fontSize: 12,
    fontWeight: 800,
  },
  viewer: {
    minWidth: 0,
    minHeight: 0,
  },
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.42)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
  },
  modal: {
    width: "min(420px, calc(100vw - 32px))",
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    boxShadow: "0 20px 50px rgba(15,23,42,0.28)",
    padding: 18,
  },
  modalTitle: {
    margin: 0,
    fontSize: 20,
    color: "#0f172a",
  },
  modalText: {
    margin: "8px 0 18px",
    color: "#475569",
    fontSize: 13,
    fontWeight: 800,
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
  },
  confirmDeleteButton: {
    border: "1px solid #dc2626",
    background: "#dc2626",
    color: "#ffffff",
    borderRadius: 6,
    padding: "8px 10px",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
  },
};
