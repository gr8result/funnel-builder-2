// AIPlanTakeoffPage.jsx — AI-assisted Manual Takeoff.

import { useState, useCallback, useReducer, useEffect, useRef } from "react";

import PDFUploadPanel        from "./PDFUploadPanel";
import ScaleCalibrationPanel from "./ScaleCalibrationPanel";
import TakeoffToolbar        from "./TakeoffToolbar";
import PlanCanvas            from "./PlanCanvas";
import RoomPanel             from "./RoomPanel";
import ObjectPanel           from "./ObjectPanel";
import AIReviewPanel         from "./AIReviewPanel";

import { TOOLS } from "./takeoffTypes";
import { saveProject, loadByJobId, summarise, getPixelsPerUnit, polyLen } from "./takeoffUtils";
import {
  activeTakeoffPageId,
  countTakeoffPages,
  countTakeoffPlans,
  hasSavedTakeoffState,
  resolveTakeoffProject as resolveSavedTakeoffProject,
  takeoffProjectSignature,
} from "./aiTakeoffPersistence";
import { runDetection } from "./aiDetectionService";
import { renderPdfDataUrlPage, normalizePlanRotation, getFinalPlanRotation, DEFAULT_PDF_TARGET_DPI, rotateRasterImageDataUrl } from "./pdfPlanRendering";

const ROTATION_RESET_WARNING = "This page was rotated. Scale and measurements were reset because the coordinate system changed.";

// ── Reducer: pages array with undo/redo ───────────────────────────────────────

const initState = (pages) => ({ pages, undo:[], redo:[] });

function normalizePageShape(page = {}) {
  const metadataRotation = normalizePlanRotation(page.metadataRotation ?? page.pdfMetadataRotation ?? 0);
  const detectedRotation = normalizePlanRotation(page.detectedRotation ?? 0);
  const userRotation = normalizePlanRotation(page.userRotation ?? page.planRotation ?? 0);
  const rotation = normalizePlanRotation(page.rotation ?? page.finalRotation ?? page.planRotation ?? getFinalPlanRotation({ metadataRotation, detectedRotation, userRotation }));
  const finalRotation = rotation;
  const normalizedWidth = Number(page.normalizedWidth || page.naturalWidth || page.originalWidth || 0);
  const normalizedHeight = Number(page.normalizedHeight || page.naturalHeight || page.originalHeight || 0);
  return {
    ...page,
    sourceType: page.sourceType || (String(page.originalFileName || page.planFileName || "").toLowerCase().endsWith(".pdf") ? "pdf" : "image"),
    sourceFileName: page.sourceFileName || page.originalFileName || page.planFileName || "",
    originalWidth: Number(page.originalWidth || page.naturalWidth || normalizedWidth || 0),
    originalHeight: Number(page.originalHeight || page.naturalHeight || normalizedHeight || 0),
    metadataRotation,
    detectedRotation,
    userRotation,
    finalRotation,
    rotation,
    imageWidth: Number(page.imageWidth || page.normalizedWidth || page.naturalWidth || 0),
    imageHeight: Number(page.imageHeight || page.normalizedHeight || page.naturalHeight || 0),
    renderScale: Number(page.renderScale || (DEFAULT_PDF_TARGET_DPI / 72)),
    dpi: Number(page.dpi || DEFAULT_PDF_TARGET_DPI),
    format: page.format || "PNG",
    sourcePdfPageNumber: page.sourcePdfPageNumber || page.pageNumber || 1,
    orientationMethod: page.orientationMethod || "",
    orientationConfidence: page.orientationConfidence || "",
    orientationConfirmed: Boolean(page.orientationConfirmed),
    orientationScores: Array.isArray(page.orientationScores) ? page.orientationScores : [],
    detectedScaleText: page.detectedScaleText || "",
    planRotation: finalRotation,
    normalizedWidth,
    normalizedHeight,
    naturalWidth: normalizedWidth,
    naturalHeight: normalizedHeight,
    scale: page.scale || null,
    overlays: Array.isArray(page.overlays) ? page.overlays : [],
    viewState: page.viewState || null,
  };
}

function normalizeProjectShape(project = {}) {
  return {
    ...project,
    pages: Array.isArray(project.pages) ? project.pages.map(normalizePageShape) : [],
  };
}

function resolveTakeoffProject(savedTakeoffProject, jobId) {
  return normalizeProjectShape(resolveSavedTakeoffProject(savedTakeoffProject, jobId));
}

function getLocalStorageProjectCounts(jobId) {
  const stored = loadByJobId(jobId);
  return {
    pages: countTakeoffPages(stored),
    plans: countTakeoffPlans(stored),
  };
}

function logTakeoffPersistence(event, details = {}) {
  if (typeof window === "undefined") return;
  console.info(`[AI Takeoff Persistence] ${event}`, details);
}

function getPageRotation(page) {
  return normalizePlanRotation(page?.rotation ?? getFinalPlanRotation(page));
}

function reducer(state, action) {
  switch (action.type) {

    case "RESET":
      return initState(action.pages);

    case "SET_PAGES":
      return { pages:action.pages, undo:[...state.undo,state.pages].slice(-60), redo:[] };

    case "PATCH_PAGE": {
      const pages = state.pages.map(pg => pg.id===action.pageId ? action.fn(pg) : pg);
      return { pages, undo:[...state.undo,state.pages].slice(-60), redo:[] };
    }

    case "PATCH_PAGE_SILENT": {
      let changed = false;
      const pages = state.pages.map(pg => {
        if (pg.id !== action.pageId) return pg;
        const next = action.fn(pg);
        if (next !== pg) changed = true;
        return next;
      });
      return changed ? { ...state, pages } : state;
    }

    case "UPDATE_OVERLAY": {
      const pages = state.pages.map(pg =>
        pg.id!==action.pageId ? pg : {
          ...pg,
          overlays: pg.overlays.map(o => o.id===action.id ? {...o,...action.patch} : o),
        }
      );
      return { pages, undo:[...state.undo,state.pages].slice(-60), redo:[] };
    }

    case "UNDO":
      if (!state.undo.length) return state;
      return { pages:state.undo[state.undo.length-1], undo:state.undo.slice(0,-1), redo:[state.pages,...state.redo] };

    case "REDO":
      if (!state.redo.length) return state;
      return { pages:state.redo[0], undo:[...state.undo,state.pages], redo:state.redo.slice(1) };

    default: return state;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AIPlanTakeoffPage({ sheet }) {
  const jobId = sheet?.workbook?.openedFileName || sheet?.workbook?.id || "";
  const savedTakeoffProject = sheet?.workbook?.aiTakeoffProject;
  const initialProjectRef = useRef(resolveTakeoffProject(savedTakeoffProject, jobId));
  const loadedProjectSignatureRef = useRef(takeoffProjectSignature(initialProjectRef.current));
  const skipNextAutosaveRef = useRef(false);

  const [project, setProject] = useState(() => initialProjectRef.current);
  const [plans, setPlans] = useState(() => initialProjectRef.current.plans || []);
  const [state,   dispatch]   = useReducer(reducer, initState(initialProjectRef.current.pages || []));
  const pages = state.pages;

  // View state
  const [selectedPageId, setSelectedPageId] = useState(pages[0]?.id || null);
  const [activeTool,     setActiveTool]     = useState(TOOLS.POINTER);
  const [selectedId,     setSelectedId]     = useState(null);
  const [calibrating,    setCalibrating]    = useState(null);
  const [rightTab,       setRightTab]       = useState("rooms"); // "rooms" | "properties" | "ai"

  // ── AI detection state ─────────────────────────────────────────────────────
  const [analysing,  setAnalysing]  = useState(false);
  const [aiMessage,  setAiMessage]  = useState("");

  const [zoom,     setZoom]     = useState(1);
  const [manualRotationDiagnostics, setManualRotationDiagnostics] = useState({
    clickCount: 0,
    before: 0,
    after: 0,
    selectedPageId: "",
    stateUpdateResult: "No manual rotation click yet",
  });
  const selectedPage = pages.find(p=>p.id===selectedPageId) || pages[0] || null;
  const rawPpm       = getPixelsPerUnit(selectedPage?.scale);
  const overlays     = selectedPage?.overlays || [];
  const selectedOv   = overlays.find(o=>o.id===selectedId) || null;
  const scaleConfirmed = getPixelsPerUnit(selectedPage?.scale) > 0 && selectedPage.scale.accepted !== false;
  const ppm          = scaleConfirmed ? rawPpm : 0;
  const totals       = summarise(overlays, ppm);
  const measurementOverlays = overlays.filter((overlay) => overlay.type === TOOLS.MEASURE);
  const setupReady = !!selectedPage && scaleConfirmed;

  useEffect(() => {
    const savedZoom = Number(selectedPage?.viewState?.zoom);
    setZoom(Number.isFinite(savedZoom) && savedZoom > 0 ? savedZoom : 1);
  }, [selectedPage?.id]);

  useEffect(() => {
    const incomingProject = resolveTakeoffProject(savedTakeoffProject, jobId);
    const incomingSignature = takeoffProjectSignature(incomingProject);
    if (!incomingSignature || incomingSignature === loadedProjectSignatureRef.current) return;
    if (!hasSavedTakeoffState(incomingProject)) return;

    loadedProjectSignatureRef.current = incomingSignature;
    skipNextAutosaveRef.current = true;
    logTakeoffPersistence("load", {
      source: hasSavedTakeoffState(savedTakeoffProject) ? "workbook.aiTakeoffProject" : "workbook.emptyTakeoffProject",
      workbookPages: countTakeoffPages(incomingProject),
      reducerPages: countTakeoffPages({ pages: incomingProject.pages || [] }),
      localStoragePages: getLocalStorageProjectCounts(jobId).pages,
      indexedDBPages: countTakeoffPages(incomingProject),
      pagesCount: countTakeoffPages(incomingProject),
      activePageId: activeTakeoffPageId(incomingProject),
      selectedPageId: activeTakeoffPageId(incomingProject),
      workbookPlans: countTakeoffPlans({ plans: sheet?.workbook?.plans }),
    });
    setProject(incomingProject);
    const incomingPlans = incomingProject.plans || [];
    setPlans(incomingPlans);
    dispatch({ type: "RESET", pages: incomingProject.pages || [] });
    setSelectedPageId((current) => (incomingProject.pages || []).some((page) => page.id === current)
      ? current
      : incomingProject.pages?.[0]?.id || null);
    setSelectedId(null);
    setCalibrating(null);
  }, [jobId, savedTakeoffProject, sheet?.workbook?.plans]);

  // ── Auto-save ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return;
    }
    const nextActivePageId = pages.some((page) => page.id === selectedPageId) ? selectedPageId : pages[0]?.id || null;
    const p = {
      ...project,
      jobId,
      plans,
      pages,
      activePageId: nextActivePageId,
      selectedPageId: nextActivePageId,
      ...(pages.length ? {} : {
        measurements: [],
        areas: [],
        scale: null,
        orientation: null,
      }),
      updatedAt:new Date().toISOString(),
    };
    loadedProjectSignatureRef.current = takeoffProjectSignature(p);
    setProject(p);
    saveProject(p);
    logTakeoffPersistence("Saving workbook", {
      workbookPages: countTakeoffPages(p),
      reducerPages: countTakeoffPages({ pages }),
      localStoragePages: getLocalStorageProjectCounts(jobId).pages,
      indexedDBPages: countTakeoffPages(p),
      pagesCount: countTakeoffPages(p),
      activePageId: activeTakeoffPageId(p, selectedPageId),
      selectedPageId,
      workbookPlans: countTakeoffPlans({ plans }),
    });
    sheet?.updateTakeoffProject?.(p);
  }, [pages, plans]); // eslint-disable-line

  useEffect(() => {
    if (!setupReady && activeTool !== TOOLS.POINTER && activeTool !== TOOLS.PAN) {
      setActiveTool(TOOLS.POINTER);
      setCalibrating(null);
    }
  }, [activeTool, setupReady]);

  // ── PDF upload ─────────────────────────────────────────────────────────────
  const handlePagesChange = useCallback((newPages, filename) => {
    const normalizedPages = (newPages || []).map(normalizePageShape);
    dispatch({ type:"SET_PAGES", pages:normalizedPages });
    setProject(p=>({...p,pdfFilename:filename||p.pdfFilename}));
    setSelectedPageId((current) => normalizedPages.some((page) => page.id === current) ? current : normalizedPages[0]?.id || null);
    setSelectedId(null);
    setActiveTool(TOOLS.POINTER);
  }, []);

  const handlePlansChange = useCallback((newPlans) => {
    const safePlans = Array.isArray(newPlans) ? newPlans : [];
    setPlans(safePlans);
    sheet?.updatePlans?.(safePlans);
  }, [sheet]);

  const handleTakeoffDataChange = useCallback((newPages, newPlans, filename) => {
    const normalizedPages = (newPages || []).map(normalizePageShape);
    const safePlans = Array.isArray(newPlans) ? newPlans : [];
    const nextActivePageId = normalizedPages[0]?.id || null;
    const nextProject = {
      ...project,
      jobId,
      plans: safePlans,
      pages: normalizedPages,
      pdfFilename: filename || project.pdfFilename,
      activePageId: nextActivePageId,
      selectedPageId: nextActivePageId,
      ...(normalizedPages.length ? {} : {
        measurements: [],
        areas: [],
        scale: null,
        orientation: null,
      }),
      updatedAt: new Date().toISOString(),
    };

    dispatch({ type: "SET_PAGES", pages: normalizedPages });
    setPlans(safePlans);
    setProject(nextProject);
    setSelectedPageId((current) => normalizedPages.some((page) => page.id === current) ? current : normalizedPages[0]?.id || null);
    setSelectedId(null);
    setCalibrating(null);
    setActiveTool(TOOLS.POINTER);
    loadedProjectSignatureRef.current = takeoffProjectSignature(nextProject);
    saveProject(nextProject);
    sheet?.updatePlans?.(safePlans);
    sheet?.updateTakeoffProject?.(nextProject);
    logTakeoffPersistence("Saving workbook", {
      source: "atomic takeoff data change",
      workbookPages: countTakeoffPages(nextProject),
      reducerPages: countTakeoffPages({ pages: normalizedPages }),
      localStoragePages: getLocalStorageProjectCounts(jobId).pages,
      indexedDBPages: countTakeoffPages(nextProject),
      pagesCount: countTakeoffPages(nextProject),
      activePageId: activeTakeoffPageId(nextProject),
      selectedPageId: nextActivePageId,
      workbookPlans: countTakeoffPlans({ plans: safePlans }),
    });
  }, [jobId, project, sheet]);

  // ── Scale ──────────────────────────────────────────────────────────────────
  const handleScaleChange = useCallback((scale) => {
    if (!selectedPageId) return;
    dispatch({ type:"PATCH_PAGE", pageId:selectedPageId, fn:pg=>({...pg,scale,scaleNeedsReview:!scale?.accepted,scaleConfidence:scale?.confidence||pg.scaleConfidence||0}) });
    if (scale?.accepted) {
      setCalibrating(null);
      setSelectedId(null);
      setActiveTool(TOOLS.POINTER);
    }
    const page = pages.find((pg) => pg.id === selectedPageId);
    if (page?.planId) {
      const nextPlans = plans.map((plan) => plan.id === page.planId ? {
        ...plan,
        scale,
        scaleNeedsReview: !scale?.accepted,
        scaleConfidence: scale?.confidence || plan.scaleConfidence || 0,
      } : plan);
      setPlans(nextPlans);
      sheet?.updatePlans?.(nextPlans);
    }
  }, [pages, plans, selectedPageId, sheet]);

  const handleStartCalibration  = useCallback(() => {
    setSelectedId(null);
    setActiveTool(TOOLS.POINTER);
    setCalibrating({points:[]});
  }, []);
  const handleCancelCalibration = useCallback(() => { setCalibrating(null); }, []);
  const handleCalibrationPoint  = useCallback((pt) => {
    setCalibrating(prev=>({ points:[...(prev?.points||[]),pt].slice(0,2) }));
  }, []);

  const handleViewStateChange = useCallback((viewState) => {
    if (!selectedPageId || !viewState) return;
    dispatch({
      type: "PATCH_PAGE_SILENT",
      pageId: selectedPageId,
      fn: (pg) => {
        const nextZoom = Number(viewState.zoom);
        const nextPan = viewState.pan || {};
        const next = {
          zoom: Number.isFinite(nextZoom) && nextZoom > 0 ? nextZoom : 1,
          pan: {
            x: Number.isFinite(Number(nextPan.x)) ? Number(nextPan.x) : 32,
            y: Number.isFinite(Number(nextPan.y)) ? Number(nextPan.y) : 32,
          },
        };
        const current = pg.viewState || {};
        if (current.zoom === next.zoom && current.pan?.x === next.pan.x && current.pan?.y === next.pan.y) return pg;
        return { ...pg, viewState: next };
      },
    });
  }, [selectedPageId]);

  const renderSelectedPageRotation = useCallback(async (page, nextRotation) => {
    const rotation = normalizePlanRotation(nextRotation);
    const rotationState = {
      metadataRotation: page?.metadataRotation || 0,
      detectedRotation: page?.detectedRotation || 0,
      userRotation: rotation,
      rotation,
      orientationMethod: page?.orientationMethod,
      orientationConfidence: page?.orientationConfidence,
      orientationScores: page?.orientationScores,
      orientationConfirmed: false,
    };
    const finalRotation = rotation;
    const fileName = `${page?.originalFileName || page?.planFileName || ""}`.toLowerCase();
    const isPdf = Boolean(page?.originalFileUrl && fileName.endsWith(".pdf"));
    if (!isPdf) {
      const delta = normalizePlanRotation(rotation - getPageRotation(page));
      const rotated = page?.imageDataUrl && delta
        ? await rotateRasterImageDataUrl(page.imageDataUrl, delta)
        : { dataUrl: page?.imageDataUrl, width: page?.normalizedWidth || page?.naturalWidth || 0, height: page?.normalizedHeight || page?.naturalHeight || 0 };
      return {
        imageDataUrl: rotated.dataUrl,
        naturalWidth: rotated.width,
        naturalHeight: rotated.height,
        normalizedWidth: rotated.width,
        normalizedHeight: rotated.height,
        imageWidth: rotated.width,
        imageHeight: rotated.height,
        userRotation: rotation,
        finalRotation,
        rotation,
        planRotation: finalRotation,
        renderScale: page?.renderScale || (DEFAULT_PDF_TARGET_DPI / 72),
        dpi: page?.dpi || DEFAULT_PDF_TARGET_DPI,
        format: page?.format || "PNG",
        orientationMethod: "manual",
        orientationConfidence: "manual",
        orientationConfirmed: false,
        scale: null,
        overlays: [],
        viewState: null,
        rotationResetWarning: ROTATION_RESET_WARNING,
      };
    }

    const rendered = await renderPdfDataUrlPage(page.originalFileUrl, page.pageNumber || 1, rotationState, page.dpi || DEFAULT_PDF_TARGET_DPI);
    return {
      imageDataUrl: rendered.dataUrl,
      naturalWidth: rendered.normalizedWidth,
      naturalHeight: rendered.normalizedHeight,
      originalWidth: rendered.originalWidth,
      originalHeight: rendered.originalHeight,
      metadataRotation: rendered.metadataRotation,
      detectedRotation: rendered.detectedRotation,
      userRotation: rendered.rotation,
      finalRotation: rendered.rotation,
      rotation: rendered.rotation,
      renderScale: rendered.renderScale,
      dpi: rendered.dpi,
      orientationMethod: "manual",
      orientationConfidence: "manual",
      orientationScores: rendered.orientationScores,
      normalizedWidth: rendered.normalizedWidth,
      normalizedHeight: rendered.normalizedHeight,
      imageWidth: rendered.imageWidth,
      imageHeight: rendered.imageHeight,
      viewportWidth: rendered.viewportWidth,
      viewportHeight: rendered.viewportHeight,
      canvasPixelWidth: rendered.canvasPixelWidth,
      canvasPixelHeight: rendered.canvasPixelHeight,
      canvasCssWidth: rendered.canvasCssWidth,
      canvasCssHeight: rendered.canvasCssHeight,
      normalisedImageData: rendered.dataUrl,
      normalisedImageUrl: rendered.dataUrl,
      planRotation: rendered.rotation,
      format: rendered.format,
      sourcePdfPageNumber: rendered.sourcePdfPageNumber,
      detectedScaleText: rendered.detectedScaleText,
      orientationConfirmed: false,
      scale: null,
      overlays: [],
      viewState: null,
      rotationResetWarning: ROTATION_RESET_WARNING,
    };
  }, []);

  useEffect(() => {
    if (!manualRotationDiagnostics.expectedPageId) return;
    const current = pages.find((page) => page.id === manualRotationDiagnostics.expectedPageId);
    const currentRotation = getPageRotation(current);
    const expectedRotation = normalizePlanRotation(manualRotationDiagnostics.after);
    const nextResult = current && currentRotation === expectedRotation
      ? `pages[] updated: ${current.id} rotation ${currentRotation}`
      : `pages[] not updated yet: current ${currentRotation}, expected ${expectedRotation}`;
    setManualRotationDiagnostics((previous) => (
      previous.stateUpdateResult === nextResult
        ? previous
        : { ...previous, stateUpdateResult: nextResult }
    ));
  }, [manualRotationDiagnostics.after, manualRotationDiagnostics.expectedPageId, pages]);

  const rotateSelectedPage = useCallback(async (deltaDegrees, sourcePlanId = "") => {
    const targetPage = (sourcePlanId
      ? pages.find((page) => page.id === selectedPageId && page.planId === sourcePlanId)
        || pages.find((page) => page.planId === sourcePlanId)
      : null)
      || pages.find((page) => page.id === selectedPageId)
      || pages[0];
    if (!targetPage) return;
    const currentPage = targetPage;
    if (!currentPage) return;
    const nextRotation = normalizePlanRotation(getPageRotation(currentPage) + deltaDegrees);
    const beforeRotation = getPageRotation(currentPage);
    console.log("MANUAL ROTATE CLICKED", {
      pageId: currentPage.id,
      before: beforeRotation,
      requested: `+${normalizePlanRotation(deltaDegrees)}`,
      after: nextRotation,
      orientationConfirmed: Boolean(currentPage.orientationConfirmed),
    });
    setSelectedPageId(currentPage.id);
    setManualRotationDiagnostics((previous) => ({
      clickCount: Number(previous.clickCount || 0) + 1,
      before: beforeRotation,
      after: nextRotation,
      selectedPageId: currentPage.id,
      expectedPageId: currentPage.id,
      stateUpdateResult: "Rendering rotation patch...",
    }));
    const patch = await renderSelectedPageRotation(currentPage, nextRotation);
    dispatch({ type:"PATCH_PAGE", pageId:currentPage.id, fn:pg=>({...pg,...patch}) });
    setManualRotationDiagnostics((previous) => ({
      ...previous,
      stateUpdateResult: `PATCH_PAGE dispatched: ${currentPage.id} rotation ${normalizePlanRotation(patch.rotation ?? patch.finalRotation ?? patch.planRotation ?? 0)}`,
    }));

    if (currentPage.planId) {
      const nextPlans = plans.map((plan) => plan.id === currentPage.planId ? {
        ...plan,
        metadataRotation: normalizePlanRotation(patch.metadataRotation || 0),
        detectedRotation: normalizePlanRotation(patch.detectedRotation || 0),
        userRotation: normalizePlanRotation(patch.rotation || 0),
        finalRotation: normalizePlanRotation(patch.rotation || 0),
        rotation: normalizePlanRotation(patch.rotation || 0),
        planRotation: normalizePlanRotation(patch.rotation || 0),
        imageWidth: patch.imageWidth || patch.normalizedWidth || plan.imageWidth,
        imageHeight: patch.imageHeight || patch.normalizedHeight || plan.imageHeight,
        renderScale: patch.renderScale || plan.renderScale || (DEFAULT_PDF_TARGET_DPI / 72),
        dpi: patch.dpi || plan.dpi,
        format: patch.format || plan.format || "PNG",
        sourcePdfPageNumber: patch.sourcePdfPageNumber || plan.sourcePdfPageNumber,
        orientationMethod: patch.orientationMethod || plan.orientationMethod,
        orientationConfidence: patch.orientationConfidence || plan.orientationConfidence,
        orientationConfirmed: false,
        detectedScaleText: patch.detectedScaleText || plan.detectedScaleText,
        fileUrl: patch.imageDataUrl || plan.fileUrl,
        normalisedImageData: patch.normalisedImageData || plan.normalisedImageData,
        normalisedImageUrl: patch.normalisedImageUrl || plan.normalisedImageUrl,
        originalWidth: patch.originalWidth || plan.originalWidth,
        originalHeight: patch.originalHeight || plan.originalHeight,
        normalizedWidth: patch.normalizedWidth || patch.naturalWidth || plan.normalizedWidth,
        normalizedHeight: patch.normalizedHeight || patch.naturalHeight || plan.normalizedHeight,
        scale: null,
        scaleNeedsReview: true,
        rotationResetWarning: ROTATION_RESET_WARNING,
      } : plan);
      setPlans(nextPlans);
      sheet?.updatePlans?.(nextPlans);
    }
  }, [pages, plans, renderSelectedPageRotation, selectedPageId, sheet]);

  const resetSelectedPageRotation = useCallback(async () => {
    if (!selectedPageId) return;
    const currentPage = pages.find((page) => page.id === selectedPageId);
    if (!currentPage) return;
    const patch = await renderSelectedPageRotation(currentPage, 0);
    dispatch({ type:"PATCH_PAGE", pageId:selectedPageId, fn:pg=>({...pg,...patch}) });

    if (currentPage.planId) {
      const nextPlans = plans.map((plan) => plan.id === currentPage.planId ? {
        ...plan,
        metadataRotation: normalizePlanRotation(patch.metadataRotation || 0),
        detectedRotation: normalizePlanRotation(patch.detectedRotation || 0),
        userRotation: 0,
        finalRotation: normalizePlanRotation(patch.rotation ?? patch.finalRotation ?? patch.planRotation ?? 0),
        rotation: normalizePlanRotation(patch.rotation ?? patch.finalRotation ?? patch.planRotation ?? 0),
        planRotation: normalizePlanRotation(patch.rotation ?? patch.finalRotation ?? patch.planRotation ?? 0),
        imageWidth: patch.imageWidth || patch.normalizedWidth || plan.imageWidth,
        imageHeight: patch.imageHeight || patch.normalizedHeight || plan.imageHeight,
        renderScale: patch.renderScale || plan.renderScale || (DEFAULT_PDF_TARGET_DPI / 72),
        dpi: patch.dpi || plan.dpi,
        format: patch.format || plan.format || "PNG",
        sourcePdfPageNumber: patch.sourcePdfPageNumber || plan.sourcePdfPageNumber,
        orientationMethod: patch.orientationMethod || plan.orientationMethod,
        orientationConfidence: patch.orientationConfidence || plan.orientationConfidence,
        orientationConfirmed: false,
        detectedScaleText: patch.detectedScaleText || plan.detectedScaleText,
        fileUrl: patch.imageDataUrl || plan.fileUrl,
        normalisedImageData: patch.normalisedImageData || plan.normalisedImageData,
        normalisedImageUrl: patch.normalisedImageUrl || plan.normalisedImageUrl,
        originalWidth: patch.originalWidth || plan.originalWidth,
        originalHeight: patch.originalHeight || plan.originalHeight,
        normalizedWidth: patch.normalizedWidth || patch.naturalWidth || plan.normalizedWidth,
        normalizedHeight: patch.normalizedHeight || patch.naturalHeight || plan.normalizedHeight,
        scale: null,
        scaleNeedsReview: true,
        rotationResetWarning: ROTATION_RESET_WARNING,
      } : plan);
      setPlans(nextPlans);
      sheet?.updatePlans?.(nextPlans);
    }
  }, [pages, plans, renderSelectedPageRotation, selectedPageId, sheet]);

  // ── Overlays ───────────────────────────────────────────────────────────────
  const addOverlay = useCallback((ov) => {
    if (!selectedPageId) return;
    dispatch({ type:"PATCH_PAGE", pageId:selectedPageId, fn:pg=>({...pg,overlays:[...(pg.overlays||[]),ov]}) });
    setSelectedId(ov.id);
    if (ov.type==="room") setRightTab("rooms");
    if (ov.type===TOOLS.MEASURE) setRightTab("properties");
  }, [selectedPageId]);

  const deleteOverlay = useCallback((id) => {
    if (!selectedPageId) return;
    dispatch({ type:"PATCH_PAGE", pageId:selectedPageId, fn:pg=>({...pg,overlays:pg.overlays.filter(o=>o.id!==id)}) });
    if (selectedId===id) setSelectedId(null);
  }, [selectedPageId, selectedId]);

  const updateOverlay = useCallback((id, patch) => {
    if (!selectedPageId) return;
    dispatch({ type:"UPDATE_OVERLAY", pageId:selectedPageId, id, patch });
  }, [selectedPageId]);

  // ── Tool change ────────────────────────────────────────────────────────────
  const handleToolChange = useCallback((t) => {
    if (!setupReady && t !== TOOLS.POINTER && t !== TOOLS.PAN) {
      setAiMessage("Confirm the plan scale before using takeoff tools.");
      return;
    }
    setActiveTool(t);
    if (t!==TOOLS.CALIBRATE) handleCancelCalibration();
    if (t===TOOLS.POINTER) setRightTab("properties");
    else if (t===TOOLS.ROOM) setRightTab("rooms");
  }, [handleCancelCalibration, setupReady]);

  // ── AI detection ──────────────────────────────────────────────────────────
  const analyseSinglePage = useCallback(async (page) => {
    if (!page?.imageDataUrl) return { detected: 0, message: "No plan image available." };
    const detectionPage = page;
    setAiMessage(`Analysing ${page.planFileName || `page ${page.pageNumber}`}...`);

    const result = await runDetection({
      imageDataUrl: detectionPage.imageDataUrl,
      imageWidth: detectionPage.naturalWidth,
      imageHeight: detectionPage.naturalHeight,
      scale: detectionPage.scale,
      level: detectionPage.level,
    });

    if (!result.connected) {
      return { detected: 0, message: result.message || "AI detection service is not connected yet." };
    }

    if (!result.overlays?.length) {
      return { detected: 0, message: result.message || "AI did not detect walls or rooms on the selected plan." };
    }

    dispatch({
      type: "PATCH_PAGE",
      pageId: page.id,
      fn: pg => ({
        ...pg,
        overlays:     [...(pg.overlays || []), ...result.overlays],
        roomAnalysis: { rooms: result.rooms || [], analyzedAt: new Date().toISOString() },
      }),
    });

    return {
      detected: result.overlays.length,
      message: result.message || `Detected ${result.overlays.length} items.`,
    };
  }, []);
  const handleAnalysePlan = useCallback(async () => {
    if (!pages.length) { setAiMessage("Upload plan files first."); return; }
    const includedPlanIds = new Set(plans.filter((plan) => plan.includedInTakeoff !== false).map((plan) => plan.id));
    const pagesToAnalyse = pages.filter((page) => !page.planId || includedPlanIds.has(page.planId));
    if (!pagesToAnalyse.length) { setAiMessage("Select at least one plan to include in AI takeoff."); return; }
    const pagesMissingScale = pagesToAnalyse.filter((page) => !(getPixelsPerUnit(page.scale) > 0) || page.scale?.accepted === false);
    if (pagesMissingScale.length) {
      setAiMessage("Confirm the plan scale before running AI takeoff.");
      return;
    }

    setAnalysing(true);
    let detectedTotal = 0;
    const messages = [];
    for (const page of pagesToAnalyse) {
      const result = await analyseSinglePage(page);
      detectedTotal += result.detected || 0;
      if (result.message) messages.push(result.message);
    }
    setAiMessage(detectedTotal
      ? `AI analysed ${pagesToAnalyse.length} selected plan page${pagesToAnalyse.length === 1 ? "" : "s"} and added ${detectedTotal} suggestions.`
      : messages[0] || "AI did not detect takeoff items on the selected plans.");
    setRightTab("ai");
    setAnalysing(false);
  }, [analyseSinglePage, pages, plans]);

  // Accept: change a single suggestion to "edited" (user-acknowledged, can still edit)
  const acceptSuggestion = useCallback((id) => {
    updateOverlay(id, { status: "edited" });
  }, [updateOverlay]);

  // Confirm: accept + lock as confirmed (counts toward measurements)
  const confirmSuggestion = useCallback((id) => {
    updateOverlay(id, { status: "confirmed" });
  }, [updateOverlay]);

  // Accept all high-confidence suggestions
  const acceptAllHigh = useCallback(() => {
    overlays.filter(o => o.status === "suggested" && o.confidence === "high" && o.source === "ai")
            .forEach(o => updateOverlay(o.id, { status: "edited" }));
  }, [overlays, updateOverlay]);

  // Delete all AI suggestions on this page
  const deleteAllSuggested = useCallback(() => {
    if (!selectedPageId) return;
    dispatch({
      type: "PATCH_PAGE",
      pageId: selectedPageId,
      fn: pg => ({ ...pg, overlays: (pg.overlays || []).filter(o => !(o.status === "suggested" && o.source === "ai")) }),
    });
  }, [selectedPageId]);

  const confirmedCount = overlays.filter(o=>o.status==="confirmed").length;
  const suggestedCount = overlays.filter(o=>o.status==="suggested" && o.source==="ai").length;

  return (
    <div style={S.root}>
      <div style={S.buildMarker}>ACTIVE TAKEOFF COMPONENT - BUILD TEST 001</div>
      {/* Toolbar */}
      <TakeoffToolbar
        activeTool={activeTool}     onToolChange={handleToolChange}
        onUndo={()=>dispatch({type:"UNDO"})} canUndo={state.undo.length>0}
        onRedo={()=>dispatch({type:"REDO"})} canRedo={state.redo.length>0}
        overlayCount={overlays.length}
        confirmedCount={confirmedCount}
        onAnalysePlan={handleAnalysePlan}
        analysing={analysing}
        hasPage={pages.length>0}
        setupReady={setupReady}
      />

      {/* AI status banner */}
      {aiMessage && (
        <div style={S.aiBanner}>
          🤖 {aiMessage}
          <button style={S.aiBannerClose} onClick={()=>setAiMessage("")}>✕</button>
        </div>
      )}

      <div style={S.body}>

        {/* Left: PDF upload + scale */}
        <div style={S.left}>
          <PDFUploadPanel
            pages={pages}
            plans={plans}
            jobId={jobId}
            onPagesChange={handlePagesChange}
            onPlansChange={handlePlansChange}
            onTakeoffDataChange={handleTakeoffDataChange}
            onSelectPage={id=>{setSelectedPageId(id);setSelectedId(null);}}
            selectedPageId={selectedPageId}
            onRotateSelectedPage={rotateSelectedPage}
          />

          {selectedPage && (
            <>
              <div style={S.divider}/>
              <ScaleCalibrationPanel
                scale={selectedPage.scale}
                calibrating={calibrating}
                measuredFloorAreaM2={totals.floorAreaM2}
                onScaleChange={handleScaleChange}
                onStartCalibration={handleStartCalibration}
                onCancelCalibration={handleCancelCalibration}
              />
            </>
          )}

          {/* Takeoff summary */}
          {overlays.length > 0 && (
            <>
              <div style={S.divider}/>
              <Summary totals={totals} ppm={ppm}/>
            </>
          )}
        </div>

        {/* Centre: canvas */}
        <div style={S.centre}>
          <ManualRotationDiagnostics diagnostics={manualRotationDiagnostics} />
          <PlanCanvas
            key={`${selectedPage?.id || "no-page"}-${selectedPage?.rotation ?? selectedPage?.finalRotation ?? selectedPage?.planRotation ?? 0}-${selectedPage?.imageDataUrl?.length || 0}`}
            page={selectedPage}
            tool={activeTool}
            overlays={overlays}
            selectedId={selectedId}
            calibrating={calibrating}
            onAddOverlay={addOverlay}
            onUpdateOverlay={updateOverlay}
            onDeleteOverlay={deleteOverlay}
            onSelectOverlay={id=>{setSelectedId(id);if(id)setRightTab("properties");}}
            onCalibrationPoint={handleCalibrationPoint}
            zoom={zoom}         setZoom={setZoom}
            viewState={selectedPage?.viewState}
            onViewStateChange={handleViewStateChange}
            onRotateLeft={()=>rotateSelectedPage(270)}
            onRotateRight={()=>rotateSelectedPage(90)}
            onResetRotation={resetSelectedPageRotation}
          />
        </div>

        {/* Right: rooms / properties / AI review */}
        <div style={S.right}>
          <div style={S.rightTabs}>
            <button style={{...S.tab,...(rightTab==="rooms"?S.tabOn:{})}} onClick={()=>setRightTab("rooms")}>
              ⬡ Rooms{totals.rooms.length>0&&<span style={S.tabBadge}>{totals.rooms.length}</span>}
            </button>
            <button style={{...S.tab,...(rightTab==="properties"?S.tabOn:{})}} onClick={()=>setRightTab("properties")}>
              ↖ Properties
            </button>
            <button style={{...S.tab,...(rightTab==="ai"?S.tabOn:{})}} onClick={()=>setRightTab("ai")}>
              🤖 AI{suggestedCount>0&&<span style={{...S.tabBadge,background:"#fef9c3",color:"#92400e"}}>{suggestedCount}</span>}
            </button>
          </div>
          <div style={S.rightContent}>
            {rightTab==="rooms"&&(
              <RoomPanel
                overlays={overlays} ppm={ppm}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onUpdate={updateOverlay}
              />
            )}
            {rightTab==="properties"&&(
              <>
                <ObjectPanel
                  overlay={selectedOv} ppm={ppm}
                  onUpdate={updateOverlay}
                  onDelete={deleteOverlay}
                />
                <RecentMeasurementsPanel
                  measurements={measurementOverlays}
                  ppm={ppm}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              </>
            )}
            {rightTab==="ai"&&(
              <AIReviewPanel
                overlays={overlays}
                aiRooms={selectedPage?.roomAnalysis?.rooms}
                ppm={ppm}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onAccept={acceptSuggestion}
                onConfirm={confirmSuggestion}
                onDelete={deleteOverlay}
                onAcceptAllHigh={acceptAllHigh}
                onDeleteAllSuggested={deleteAllSuggested}
              />
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Takeoff summary (left panel) ──────────────────────────────────────────────

function RecentMeasurementsPanel({ measurements = [], ppm, selectedId, onSelect }) {
  const recent = measurements.slice(-8).reverse();
  return (
    <div style={MR.wrap}>
      <div style={MR.title}>Recent Measurements</div>
      {!ppm && <div style={MR.empty}>Scale not set</div>}
      {ppm > 0 && recent.length === 0 && <div style={MR.empty}>No measured lines yet.</div>}
      {ppm > 0 && recent.map((measurement) => {
        const lengthPx = polyLen(measurement.points || []);
        const metres = lengthPx / ppm;
        const millimetres = Math.round(metres * 1000);
        const active = measurement.id === selectedId;
        return (
          <button
            key={measurement.id}
            type="button"
            onClick={() => onSelect?.(measurement.id)}
            style={{ ...MR.row, ...(active ? MR.rowOn : {}) }}
          >
            <span style={MR.name}>{measurement.label || "Measured line"}</span>
            <span style={MR.value}>{millimetres.toLocaleString()} mm ({metres.toFixed(2)} m)</span>
            {millimetres < 100 && <span style={MR.warning}>This measurement is very small. Did you click both points correctly?</span>}
          </button>
        );
      })}
    </div>
  );
}

const MR = {
  wrap: { marginTop: 12, padding: 10, border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", display: "flex", flexDirection: "column", gap: 6 },
  title: { fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" },
  empty: { fontSize: 12, color: "#64748b" },
  row: { width: "100%", border: "1px solid #e2e8f0", borderRadius: 7, background: "#fff", padding: "7px 8px", display: "flex", flexDirection: "column", gap: 2, textAlign: "left", cursor: "pointer" },
  rowOn: { borderColor: "#2563eb", background: "#eff6ff" },
  name: { fontSize: 12, fontWeight: 700, color: "#334155" },
  value: { fontSize: 12, fontWeight: 800, color: "#0369a1" },
  warning: { marginTop: 3, fontSize: 11, fontWeight: 800, color: "#b91c1c" },
};

function Summary({ totals, ppm }) {
  const r2 = n => (n||0).toFixed(2);
  return (
    <div style={SS.wrap}>
      <div style={SS.title}>Takeoff Summary</div>
      {!ppm&&<div style={SS.noScale}>Set scale for measurements</div>}
      <SRow label="Ext Walls"    value={ppm?`${r2(totals.externalWallLM)} m`:"—"} />
      <SRow label="Int Walls"    value={ppm?`${r2(totals.internalWallLM)} m`:"—"} />
      <SRow label="Floor Area"   value={ppm?`${r2(totals.floorAreaM2)} m²`:"—"} />
      <SRow label="Doors"        value={`${totals.doorCount}`} />
      <SRow label="Windows"      value={`${totals.windowCount}`} />
      {totals.columnCount>0&&<SRow label="Columns" value={`${totals.columnCount}`} />}
    </div>
  );
}

function SRow({label,value}) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"2px 0"}}>
      <span style={{color:"#64748b"}}>{label}</span>
      <span style={{fontWeight:700,color:"#0f172a"}}>{value}</span>
    </div>
  );
}

function ManualRotationDiagnostics({ diagnostics }) {
  return (
    <div style={S.manualRotationDiagnostics}>
      <div>CLICK COUNT: {diagnostics?.clickCount || 0}</div>
      <div>ROTATION BEFORE: {diagnostics?.before ?? 0}</div>
      <div>ROTATION AFTER: {diagnostics?.after ?? 0}</div>
      <div>SELECTED PAGE ID: {diagnostics?.selectedPageId || ""}</div>
      <div>STATE UPDATE RESULT: {diagnostics?.stateUpdateResult || ""}</div>
    </div>
  );
}

const SS = {
  wrap:    {display:"flex",flexDirection:"column",gap:3,padding:"8px 10px",background:"#f8fafc",borderRadius:8,border:"1px solid #e2e8f0"},
  title:   {fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:2},
  noScale: {fontSize:11,color:"#d97706",fontStyle:"italic",marginBottom:2},
};

const S = {
  root:          {display:"flex",flexDirection:"column",height:"calc(100vh - 96px)",minHeight:680,background:"#f8fafc",fontFamily:"'Manrope','Segoe UI',system-ui,sans-serif"},
  buildMarker:   {padding:"10px 14px",background:"#fff200",color:"#111827",border:"4px solid #ff00ff",fontSize:18,fontWeight:900,textAlign:"center",letterSpacing:0},
  aiBanner:      {display:"flex",alignItems:"center",gap:10,padding:"8px 14px",background:"#faf5ff",borderBottom:"1.5px solid #e9d5ff",fontSize:12,color:"#6d28d9",flexShrink:0},
  aiBannerClose: {marginLeft:"auto",background:"none",border:"none",cursor:"pointer",fontSize:14,color:"#9333ea"},
  body:          {display:"flex",flex:1,overflow:"hidden",minHeight:0},
  left:          {width:230,flexShrink:0,display:"flex",flexDirection:"column",gap:10,padding:12,background:"#fff",borderRight:"1.5px solid #e2e8f0",overflowY:"auto"},
  divider:       {height:1,background:"#e2e8f0"},
  centre:        {flex:1,overflow:"hidden",position:"relative",minWidth:0},
  manualRotationDiagnostics: {position:"absolute",top:78,left:12,zIndex:95,display:"grid",gap:4,maxWidth:520,padding:"10px 12px",background:"#111827",color:"#f8fafc",border:"4px solid #fff200",borderRadius:4,fontSize:14,fontWeight:950,lineHeight:1.25,pointerEvents:"none",boxShadow:"0 10px 22px rgba(15,23,42,0.28)"},
  right:         {width:270,flexShrink:0,display:"flex",flexDirection:"column",background:"#fff",borderLeft:"1.5px solid #e2e8f0",overflow:"hidden"},
  rightTabs:     {display:"flex",borderBottom:"1.5px solid #e2e8f0",flexShrink:0},
  tab:           {flex:1,padding:"8px 3px",border:"none",background:"#f8fafc",color:"#64748b",fontSize:11,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:3},
  tabOn:         {background:"#fff",color:"#0f172a",borderBottom:"2px solid #2563eb"},
  tabBadge:      {fontSize:10,fontWeight:700,background:"#dbeafe",color:"#1d4ed8",padding:"0 5px",borderRadius:99},
  rightContent:  {flex:1,overflowY:"auto",padding:12,minHeight:0},
};

