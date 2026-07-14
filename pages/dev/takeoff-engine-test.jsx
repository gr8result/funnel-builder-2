import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TakeoffViewer from "../../components/estimate-builder/takeoff-engine/viewer/TakeoffViewer.jsx";
import { normalizeRasterImagePage, rotateRasterImageDataUrl, rotateRasterPage } from "../../components/estimate-builder/takeoff-engine/import/imageNormalizer.js";
import { importPdfToRasterPages } from "../../components/estimate-builder/takeoff-engine/import/pdfToRaster.js";
import { analyzeRasterOrientation, applyOrientationAnalysisToRaster } from "../../components/estimate-builder/takeoff-engine/analysis/imageOrientationAnalysis.js";
import { applyManualRotation, normalizeRotation } from "../../components/estimate-builder/takeoff-engine/core/orientation.js";
import { TAKEOFF_ACTIONS, createInitialTakeoffState, takeoffReducer } from "../../components/estimate-builder/takeoff-engine/state/takeoffReducer.js";
import {
  TAKEOFF_ENGINE_STORAGE_KEY,
  clearTakeoffStateFromStorage,
  loadTakeoffStateFromStorage,
  saveTakeoffStateToStorage,
} from "../../components/estimate-builder/takeoff-engine/state/takeoffPersistence.js";

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
  const selectedRotation = normalizeRotation(rotated.rotation ?? rotated.appliedRotation ?? orientationAnalysis.selectedRotation);

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
      detectedRotation: selectedRotation,
      confidence: orientationAnalysis.confidence,
      method: "raster-orientation-analysis",
      warning: orientationAnalysis.confidence === "high" ? "" : "Orientation may need checking.",
      scores: orientationAnalysis.scores,
      orientationConfirmed: false,
    },
    orientationAnalysis: {
      ...orientationAnalysis,
      selectedRotation,
    },
    orientationApplied: true,
  });
}

export default function TakeoffEngineTestPage() {
  const [state, setState] = useState(() => createInitialTakeoffState({ name: "Takeoff engine test" }));
  const [viewerKey, setViewerKey] = useState(0);
  const [status, setStatus] = useState("Ready");
  const [statusTone, setStatusTone] = useState("neutral");
  const [importProgress, setImportProgress] = useState(() => createIdleImportProgress());
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const largePlanTimerRef = useRef(null);
  const activePage = useMemo(() => state.pages.find((page) => page.id === state.activePageId) || state.pages[0] || null, [state]);

  useEffect(() => () => {
    if (largePlanTimerRef.current) {
      clearTimeout(largePlanTimerRef.current);
    }
  }, []);

  const handleViewerStateChange = useCallback((nextState) => {
    setState(nextState);
  }, []);

  function replaceState(nextState) {
    setState(nextState);
    setViewerKey((value) => value + 1);
  }

  function applyExternalAction(action) {
    replaceState(takeoffReducer(state, action));
  }

  function persistState(nextState) {
    saveTakeoffStateToStorage(window.localStorage, nextState);
  }

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
  }

  function failImportProgress() {
    if (largePlanTimerRef.current) {
      clearTimeout(largePlanTimerRef.current);
      largePlanTimerRef.current = null;
    }
    const message = "Plan import failed. Please try again or upload a smaller PDF.";
    setImportProgress((current) => ({
      ...current,
      active: false,
      message,
      error: message,
      percent: 0,
    }));
    setStatus(message);
    setStatusTone("error");
  }

  async function handleUpload(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) {
      return;
    }

    startImportProgress();

    try {
      let nextState = state;
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

        for (const page of pages) {
          nextState = takeoffReducer(nextState, {
            type: TAKEOFF_ACTIONS.ADD_PAGE,
            payload: page,
          });
        }
      }

      updateImportProgress({
        stage: "preparing-viewer",
        message: "Preparing viewer...",
      });
      replaceState(nextState);
      finishImportProgress("Plan ready");
      event.target.value = "";
    } catch (err) {
      failImportProgress();
    }
  }

  function saveProject() {
    try {
      saveTakeoffStateToStorage(window.localStorage, state);
      setStatus(`Saved to localStorage: ${TAKEOFF_ENGINE_STORAGE_KEY}`);
    } catch (err) {
      setStatus(err?.message || "Save failed.");
    }
  }

  function loadProject() {
    try {
      replaceState(loadTakeoffStateFromStorage(window.localStorage));
      setStatus("Loaded from localStorage.");
    } catch (err) {
      setStatus(err?.message || "Load failed.");
    }
  }

  function resetProject() {
    clearTakeoffStateFromStorage(window.localStorage);
    replaceState(createInitialTakeoffState({ name: "Takeoff engine test" }));
    setStatus("Project reset.");
  }

  function openPage(pageId) {
    applyExternalAction({ type: TAKEOFF_ACTIONS.SET_ACTIVE_PAGE, payload: { pageId } });
  }

  function renamePage(page) {
    const name = window.prompt("Rename plan", page.sourceFileName || "Raster page");
    if (name == null) {
      return;
    }

    const nextState = takeoffReducer(state, {
      type: TAKEOFF_ACTIONS.RENAME_PAGE,
      payload: { pageId: page.id, name },
    });
    replaceState(nextState);
    setStatus("Plan renamed.");
  }

  function duplicatePage(pageId) {
    const nextState = takeoffReducer(state, {
      type: TAKEOFF_ACTIONS.DUPLICATE_PAGE,
      payload: { pageId },
    });
    replaceState(nextState);
    setStatus("Plan duplicated.");
  }

  async function rotatePage(pageId) {
    const page = state.pages.find((item) => item.id === pageId);
    if (!page) {
      return;
    }

    const rotatedPage = await rotateRasterPage(page, 90);
    const nextState = takeoffReducer(state, {
      type: TAKEOFF_ACTIONS.REPLACE_PAGE,
      payload: {
        ...rotatedPage,
        orientation: applyManualRotation(page.orientation, 90),
      },
    });
    replaceState(nextState);
    setStatus("Plan rotated. Scale and measurements were reset for that page.");
  }

  function requestDeletePage(page) {
    setDeleteCandidate(page);
  }

  function confirmDeletePage() {
    if (!deleteCandidate) {
      return;
    }

    const nextState = takeoffReducer(state, {
      type: TAKEOFF_ACTIONS.DELETE_PAGE,
      payload: { pageId: deleteCandidate.id },
    });
    replaceState(nextState);
    persistState(nextState);
    setDeleteCandidate(null);
    setStatus(nextState.pages.length ? "Plan deleted and saved." : "Final plan deleted and saved.");
  }

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <div>
          <div style={styles.eyebrow}>Development Test Harness</div>
          <h1 style={styles.title}>Takeoff Engine Test</h1>
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
          <button type="button" style={styles.button} onClick={saveProject}>Save</button>
          <button type="button" style={styles.button} onClick={loadProject}>Load</button>
          <button type="button" style={styles.dangerButton} onClick={resetProject}>Clear</button>
        </div>
      </section>

      <section style={styles.statusBar}>
        <span style={statusTone === "error" ? styles.errorStatus : statusTone === "success" ? styles.successStatus : undefined}>{status}</span>
        <span>{state.pages.length} page{state.pages.length === 1 ? "" : "s"}</span>
      </section>

      {importProgress.active ? (
        <section style={styles.progressBanner}>
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
        </section>
      ) : null}

      {importProgress.error ? <section style={styles.errorBanner}>{importProgress.error}</section> : null}

      <section style={styles.layout}>
        <aside style={styles.sidebar}>
          <div style={styles.sidebarTitle}>Raster pages</div>
          {state.pages.length ? state.pages.map((page) => (
            <div key={page.id} style={page.id === activePage?.id ? styles.activePageCard : styles.pageCard}>
              <button type="button" style={styles.pageSelect} onClick={() => openPage(page.id)}>
                <strong>{page.sourceFileName || "Raster page"}</strong>
                <span>{page.imageWidth} x {page.imageHeight}px | {page.format}</span>
                <span>{page.orientation?.orientationConfirmed ? "Orientation confirmed" : "Orientation not confirmed"}</span>
              </button>
              <div style={styles.pageActions}>
                <button type="button" style={styles.smallButton} onClick={() => openPage(page.id)}>Open</button>
                <button type="button" style={styles.smallButton} onClick={() => renamePage(page)}>Rename</button>
                <button type="button" style={styles.smallButton} onClick={() => duplicatePage(page.id)}>Duplicate</button>
                <button type="button" style={styles.smallButton} onClick={() => rotatePage(page.id)}>Rotate</button>
                <button type="button" style={styles.deletePageButton} onClick={() => requestDeletePage(page)}>Delete</button>
              </div>
            </div>
          )) : (
            <div style={styles.empty}>No pages imported yet.</div>
          )}
        </aside>

        <section style={styles.viewerShell}>
          <TakeoffViewer
            key={viewerKey}
            initialState={state}
            onStateChange={handleViewerStateChange}
            importProgress={importProgress}
          />
        </section>
      </section>

      {deleteCandidate ? (
        <div style={styles.modalBackdrop} role="presentation">
          <div style={styles.modal} role="dialog" aria-modal="true" aria-labelledby="delete-plan-title">
            <h2 id="delete-plan-title" style={styles.modalTitle}>Delete this plan?</h2>
            <p style={styles.modalText}>{deleteCandidate.sourceFileName || "Raster page"}</p>
            <div style={styles.modalActions}>
              <button type="button" style={styles.button} onClick={() => setDeleteCandidate(null)}>Cancel</button>
              <button type="button" style={styles.confirmDeleteButton} onClick={confirmDeletePage}>Delete</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#e2e8f0",
    color: "#0f172a",
    padding: 18,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    padding: 14,
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
    lineHeight: 1.1,
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
  button: {
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    borderRadius: 6,
    padding: "8px 10px",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
  },
  successStatus: {
    color: "#047857",
    fontWeight: 900,
  },
  errorStatus: {
    color: "#b91c1c",
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
  dangerButton: {
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#991b1b",
    borderRadius: 6,
    padding: "8px 10px",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
  },
  statusBar: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    background: "#f8fafc",
    border: "1px solid #cbd5e1",
    padding: "8px 10px",
    color: "#334155",
    fontSize: 12,
    fontWeight: 800,
  },
  layout: {
    display: "grid",
    gridTemplateColumns: "280px minmax(0, 1fr)",
    gap: 12,
    minHeight: 620,
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
  pageCard: {
    border: "1px solid #dbe4ef",
    borderRadius: 6,
    padding: 8,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  activePageCard: {
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
  pageActions: {
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
  deletePageButton: {
    alignSelf: "flex-start",
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#991b1b",
    borderRadius: 6,
    padding: "5px 7px",
    fontSize: 11,
    fontWeight: 900,
    cursor: "pointer",
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
  empty: {
    color: "#64748b",
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    borderRadius: 6,
    padding: 12,
    fontSize: 12,
    fontWeight: 800,
  },
  viewerShell: {
    minWidth: 0,
  },
};
