import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Edit3, Hand, MousePointer2, PenLine, Radar, Redo2, RotateCcw, RotateCw, Ruler, Trash2, Undo2, X } from "lucide-react";
import { createPageRenderer, computeFitScale, getPageDimensions, loadPdfDocument, clampSharpRenderScale } from "../../takeoff-v2/viewer/PdfViewport.js";
import { usePdfDocument, forgetCachedDocument } from "../../takeoff-v2/viewer/usePdfDocument.js";
import { savePdfFile, deletePdfFile } from "../../takeoff-v2/persistence/pdfFileStore.js";
import { usePlanGeometry } from "../../takeoff-v2/hooks/usePlanGeometry.js";
import { detectExteriorFromTraceGraph } from "../../takeoff-v2/takeoff/traceGraph.js";
import { createPlanDocument, createPlanPage, createPoint, createWallSegment, generateId, rotateLeft, rotateRight } from "../core/types.js";
import { documentToScreen, screenToDocument } from "../core/coordinateTransform.js";
import {
  appendWallPoint,
  calculateExteriorSummary,
  closeWallLoop,
  deletePoint,
  deleteWall,
  insertPointIntoWall,
  movePoint,
  orderedExteriorPoints,
  validateExteriorLoop,
  wallPoints,
} from "../core/geometry.js";
import { createHistory, commitHistory, redoHistory, undoHistory } from "../core/history.js";
import { nearestPoint, nearestWall } from "../core/hitTesting.js";
import { createPointerSession, TOOLS } from "../core/interactionState.js";
import { computeCalibration } from "../core/scale.js";
import { getSnapCandidate } from "../core/snapping.js";
import { createV3TraceDiagnostics } from "../core/traceDiagnostics.js";
import { deleteDocument, getSelectedPageId, listDocuments, listPages, saveDocument, savePage, savePages, setSelectedPageId } from "../persistence/planStore.js";

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 8;

const TOOL_META = [
  { id: TOOLS.SELECT, label: "Select", icon: MousePointer2 },
  { id: TOOLS.PAN, label: "Pan", icon: Hand },
  { id: TOOLS.SET_SCALE, label: "Set Scale", icon: Ruler },
  { id: TOOLS.DETECT_EXTERIOR, label: "Detect Exterior", icon: Radar },
  { id: TOOLS.DRAW_EXTERIOR, label: "Draw Exterior", icon: PenLine },
  { id: TOOLS.DRAW_INTERIOR, label: "Draw Interior", icon: PenLine },
  { id: TOOLS.EDIT, label: "Edit", icon: Edit3 },
  { id: TOOLS.DELETE, label: "Delete", icon: Trash2 },
];

function fmtM(mm) {
  return `${(mm / 1000).toFixed(2)} m`;
}

function detectorResultToV3Geometry(result) {
  const points = (result?.vertices || []).map((vertex) => createPoint({
    id: vertex.id,
    x: vertex.x,
    y: vertex.y,
  }));
  const walls = (result?.segments || []).map((segment) => createWallSegment({
    id: segment.id,
    startPointId: segment.aId,
    endPointId: segment.bId,
    wallType: "exterior",
    source: "automatic",
    confirmed: false,
  }));
  return { points, walls, openings: [] };
}

function traceLinePoints(line) {
  const start = line?.start || line?.a || null;
  const end = line?.end || line?.b || null;
  return start && end ? [start, end] : [null, null];
}

function DiagnosticOverlay({ mode, planGeometryIndex, diagnostics, viewport }) {
  if (!mode || mode === "off" || !viewport) return null;
  const lineElements = [];
  const traceableLines = Array.isArray(planGeometryIndex?.lines) ? planGeometryIndex.lines : [];
  const selectedComponent = (diagnostics?.components || []).find((component) => component.id === diagnostics?.selectedComponentId);
  const palette = ["#0284c7", "#16a34a", "#ca8a04", "#dc2626", "#7c3aed", "#0891b2"];

  const pushTraceLine = (line, key, stroke, width = 1.5, dash = "") => {
    const [start, end] = traceLinePoints(line);
    if (!start || !end) return;
    const a = documentToScreen({ viewport }, start);
    const b = documentToScreen({ viewport }, end);
    lineElements.push(
      <line
        key={key}
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        stroke={stroke}
        strokeWidth={width}
        strokeDasharray={dash}
        strokeLinecap="round"
        opacity="0.8"
        data-testid="takeoff-v3-diagnostic-line"
      />
    );
  };

  if (mode === "traceable") {
    traceableLines.forEach((line) => pushTraceLine(line, `traceable-${line.id}`, "#0284c7", 1.2));
  }
  if (mode === "components") {
    (diagnostics?.components || []).forEach((component, index) => {
      component.lines.forEach((line) => pushTraceLine(line, `${component.id}-${line.id}`, palette[index % palette.length], 1.4));
    });
  }
  if (mode === "main") {
    (selectedComponent?.lines || []).forEach((line) => pushTraceLine(line, `main-${line.id}`, "#16a34a", 2.4));
  }
  if (mode === "outside") {
    (diagnostics?.traceGraphEdges || []).forEach((edge) => {
      const from = edge.from || edge.start || null;
      const to = edge.to || edge.end || null;
      if (from && to) pushTraceLine({ start: from, end: to, id: edge.id }, `edge-${edge.id}`, "#ca8a04", 1.8, "5 4");
    });
  }
  if (mode === "final") {
    (diagnostics?.finalLoopEdges || []).forEach((edge) => pushTraceLine({ start: edge.from, end: edge.to, id: edge.id }, `final-${edge.id}`, "#dc2626", 3.2));
  }

  return (
    <g data-testid={`takeoff-v3-diagnostic-${mode}`}>
      {lineElements}
    </g>
  );
}

function DocumentList({ jobId, documents, pagesByDocument, selectedPageId, onRefresh, onSelectPage }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  const upload = useCallback(async (files) => {
    setError("");
    for (const file of Array.from(files || [])) {
      if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
        setError("Upload a PDF plan.");
        continue;
      }
      const documentId = generateId("doc");
      setBusy(`Saving ${file.name}...`);
      const fileRecord = await savePdfFile(documentId, file);
      setBusy(`Reading ${file.name}...`);
      const pdfDocument = await loadPdfDocument(file);
      const planDocument = createPlanDocument({ id: documentId, jobId, fileName: file.name, ...fileRecord });
      const pages = [];
      for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
        const { width, height } = await getPageDimensions(pdfDocument, pageNumber);
        pages.push(createPlanPage({ id: generateId("page"), documentId, pageNumber, sourceWidth: width, sourceHeight: height }));
      }
      saveDocument(planDocument);
      savePages(documentId, pages);
      onRefresh();
      if (!selectedPageId && pages[0]) onSelectPage(documentId, pages[0].id);
    }
    setBusy("");
  }, [jobId, onRefresh, onSelectPage, selectedPageId]);

  const remove = useCallback(async (documentId) => {
    deleteDocument(jobId, documentId);
    forgetCachedDocument(documentId);
    await deletePdfFile(documentId);
    onRefresh();
  }, [jobId, onRefresh]);

  return (
    <aside style={S.left}>
      <div style={S.panelTitle}>Plans</div>
      <button type="button" style={S.upload} onClick={() => inputRef.current?.click()} data-testid="takeoff-v3-upload-button">
        {busy || "Upload PDF"}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,application/pdf"
        style={{ display: "none" }}
        onChange={(event) => {
          upload(event.target.files).catch((err) => setError(err.message));
          event.target.value = "";
        }}
        data-testid="takeoff-v3-upload-input"
      />
      {error && <div style={S.error}>{error}</div>}
      {documents.length === 0 && <div style={S.empty} data-testid="takeoff-v3-empty">No plans uploaded.</div>}
      {documents.map((planDocument) => (
        <div key={planDocument.id} style={S.docCard}>
          <div style={S.docTitle}>{planDocument.fileName}</div>
          <button type="button" style={S.smallDanger} onClick={() => remove(planDocument.id)}>Delete</button>
          <div style={S.thumbGrid}>
            {(pagesByDocument[planDocument.id] || []).map((page) => (
              <Thumb
                key={page.id}
                planDocument={planDocument}
                page={page}
                selected={page.id === selectedPageId}
                onSelect={() => onSelectPage(planDocument.id, page.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </aside>
  );
}

function Thumb({ planDocument, page, selected, onSelect }) {
  const { pdfDocument } = usePdfDocument(planDocument);
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);

  useEffect(() => {
    if (!pdfDocument || !canvasRef.current) return undefined;
    if (!rendererRef.current) rendererRef.current = createPageRenderer(canvasRef.current);
    const sideways = page.rotation === 90 || page.rotation === 270;
    const baseScale = 86 / (sideways ? page.sourceHeight : page.sourceWidth);
    rendererRef.current.render({ pdfDocument, pageNumber: page.pageNumber, rotation: page.rotation, scale: baseScale }).catch(() => {});
    return () => rendererRef.current?.cancel();
  }, [pdfDocument, page.pageNumber, page.rotation, page.sourceHeight, page.sourceWidth]);

  return (
    <button type="button" style={{ ...S.thumb, ...(selected ? S.thumbSelected : {}) }} onClick={onSelect} data-testid="takeoff-v3-page-thumb">
      <canvas ref={canvasRef} style={S.thumbCanvas} />
      <span>Page {page.pageNumber}</span>
    </button>
  );
}

function Toolbar({ activeTool, setActiveTool, canUndo, canRedo, onUndo, onRedo, onClear, onDetectExterior }) {
  return (
    <div style={S.topToolbar}>
      {TOOL_META.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          title={label}
          aria-label={label}
          style={{ ...S.toolButton, ...(activeTool === id ? S.toolButtonActive : {}) }}
          onClick={() => {
            if (id === TOOLS.DETECT_EXTERIOR) onDetectExterior();
            else setActiveTool(id);
          }}
          data-testid={`takeoff-v3-tool-${id}`}
        >
          <Icon size={16} />
          <span>{label}</span>
        </button>
      ))}
      <span style={S.flexSpacer} />
      <button type="button" title="Undo" aria-label="Undo" style={S.iconButton} disabled={!canUndo} onClick={onUndo} data-testid="takeoff-v3-undo"><Undo2 size={16} /></button>
      <button type="button" title="Redo" aria-label="Redo" style={S.iconButton} disabled={!canRedo} onClick={onRedo} data-testid="takeoff-v3-redo"><Redo2 size={16} /></button>
      <button type="button" title="Clear" aria-label="Clear" style={S.iconButton} onClick={onClear} data-testid="takeoff-v3-clear"><X size={16} /></button>
    </div>
  );
}

function PlanViewerV3({ pdfDocument, page, history, setHistory, commitPage, activeTool, detectMessage, planGeometryIndex, traceDiagnostics, debugTraceMode, setDebugTraceMode }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const fitScaleRef = useRef(1);
  const renderRequestRef = useRef(0);
  const pointerRef = useRef(null);
  const keysRef = useRef({ space: false });
  const drawRef = useRef({ startPointId: null, lastPointId: null, wallType: "exterior" });
  const scaleRef = useRef({ pointA: null });
  const [view, setView] = useState({ viewport: null, zoomScale: 1, panX: 0, panY: 0 });
  const [hover, setHover] = useState(null);
  const [selected, setSelected] = useState({ type: null, id: null });
  const [status, setStatus] = useState("");
  const geometry = history.present;

  const viewState = useMemo(() => ({ viewport: view.viewport, panX: view.panX, panY: view.panY, zoomScale: view.zoomScale }), [view]);
  const summary = useMemo(() => calculateExteriorSummary(geometry, page.calibration), [geometry, page.calibration]);

  const commitGeometry = useCallback((nextGeometry) => {
    const nextHistory = commitHistory(history, nextGeometry);
    setHistory(nextHistory);
    commitPage({ geometry: nextHistory.present, exteriorConfirmed: false, exteriorConfirmedAt: null });
  }, [commitPage, history, setHistory]);

  const fitTo = useCallback(async (mode) => {
    if (!pdfDocument || !page || !canvasRef.current || !containerRef.current) return;
    if (!rendererRef.current) rendererRef.current = createPageRenderer(canvasRef.current);
    const rawPage = await pdfDocument.getPage(page.pageNumber);
    const rawViewport = rawPage.getViewport({ scale: 1, rotation: page.rotation });
    const fitScale = computeFitScale({
      pageWidth: rawViewport.width,
      pageHeight: rawViewport.height,
      containerWidth: containerRef.current.clientWidth,
      containerHeight: containerRef.current.clientHeight,
      mode,
    });
    fitScaleRef.current = fitScale;
    const { viewport } = await rendererRef.current.render({ pdfDocument, pageNumber: page.pageNumber, rotation: page.rotation, scale: fitScale, displayScale: fitScale });
    setView({
      viewport,
      zoomScale: 1,
      panX: Math.max(0, (containerRef.current.clientWidth - viewport.width) / 2),
      panY: Math.max(0, (containerRef.current.clientHeight - viewport.height) / 2),
    });
  }, [page, pdfDocument]);

  const renderAtZoom = useCallback(async (zoomScale) => {
    if (!pdfDocument || !page || !canvasRef.current) return;
    if (!rendererRef.current) rendererRef.current = createPageRenderer(canvasRef.current);
    const requestId = renderRequestRef.current + 1;
    renderRequestRef.current = requestId;
    const scale = clampSharpRenderScale({
      baseScale: fitScaleRef.current,
      zoomScale,
      unrotatedWidth: page.sourceWidth,
      unrotatedHeight: page.sourceHeight,
      rotation: page.rotation,
      pixelRatio: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
    });
    const { viewport } = await rendererRef.current.render({ pdfDocument, pageNumber: page.pageNumber, rotation: page.rotation, scale, displayScale: fitScaleRef.current });
    if (renderRequestRef.current === requestId) setView((prev) => ({ ...prev, viewport }));
  }, [page, pdfDocument]);

  useEffect(() => {
    fitTo("fit-page").catch((err) => setStatus(err.message));
    return () => rendererRef.current?.cancel();
  }, [fitTo]);

  useEffect(() => {
    if (!view.viewport || view.zoomScale === 1) return undefined;
    const timeout = window.setTimeout(() => renderAtZoom(view.zoomScale).catch((err) => setStatus(err.message)), 100);
    return () => window.clearTimeout(timeout);
  }, [renderAtZoom, view.viewport, view.zoomScale]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.code === "Space") keysRef.current.space = true;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        const next = event.shiftKey ? redoHistory(history) : undoHistory(history);
        setHistory(next);
        commitPage({ geometry: next.present, exteriorConfirmed: false, exteriorConfirmedAt: null });
      }
      if (event.key === "Enter" && drawRef.current.startPointId && drawRef.current.lastPointId) {
        const next = closeWallLoop(geometry, drawRef.current.startPointId, drawRef.current.lastPointId, drawRef.current.wallType);
        commitGeometry(next);
        drawRef.current = { startPointId: null, lastPointId: null, wallType: "exterior" };
        setStatus("Exterior: Closed - Needs Review");
      }
      if (event.key === "Escape") {
        drawRef.current = { startPointId: null, lastPointId: null, wallType: "exterior" };
        setHover(null);
        setStatus("Free point");
      }
    };
    const onKeyUp = (event) => { if (event.code === "Space") keysRef.current.space = false; };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [commitGeometry, commitPage, geometry, history, setHistory]);

  const eventPoint = useCallback((event) => {
    if (!view.viewport || !containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    return screenToDocument(viewState, { x: event.clientX - rect.left, y: event.clientY - rect.top });
  }, [view.viewport, viewState]);

  const toleranceDoc = useCallback((px = 12) => px / Math.max(0.1, fitScaleRef.current * view.zoomScale), [view.zoomScale]);

  const pointerDown = useCallback((event) => {
    if (!view.viewport || !containerRef.current) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const point = eventPoint(event);
    const pointHit = nearestPoint(geometry, point, toleranceDoc(12));
    const wallHit = pointHit ? null : nearestWall(geometry, point, toleranceDoc(12));
    const targetType = pointHit ? "vertex" : (wallHit ? "wall" : "empty");
    const rect = containerRef.current.getBoundingClientRect();
    const session = createPointerSession({
      pointerId: event.pointerId,
      tool: activeTool,
      targetType,
      documentPoint: point,
      screenPoint: { x: event.clientX - rect.left, y: event.clientY - rect.top },
      spaceKey: keysRef.current.space,
    });

    if (activeTool === TOOLS.DELETE) {
      if (pointHit) commitGeometry(deletePoint(geometry, pointHit.point.id));
      else if (wallHit) commitGeometry(deleteWall(geometry, wallHit.wall.id));
      return;
    }

    if (session.owner === "viewer") {
      pointerRef.current = { ...session, panStart: { clientX: event.clientX, clientY: event.clientY, panX: view.panX, panY: view.panY } };
      return;
    }

    if (activeTool === TOOLS.SELECT || activeTool === TOOLS.EDIT) {
      if (pointHit) {
        setSelected({ type: "point", id: pointHit.point.id });
        pointerRef.current = { ...session, dragPointId: pointHit.point.id, originalGeometry: history.present, moved: false };
      } else if (wallHit) {
        setSelected({ type: "wall", id: wallHit.wall.id });
        if (event.detail >= 2 || event.altKey) {
          const inserted = insertPointIntoWall(geometry, wallHit.wall.id, point);
          commitGeometry(inserted.geometry);
          setSelected({ type: "point", id: inserted.pointId });
        }
      } else {
        setSelected({ type: null, id: null });
      }
      return;
    }

    if (activeTool === TOOLS.SET_SCALE) {
      if (!scaleRef.current.pointA) {
        scaleRef.current.pointA = point;
        setStatus("Pick scale end point");
      } else {
        const raw = window.prompt("Known length in millimetres?", "1000");
        const actualLengthMm = Number(raw);
        const calibration = computeCalibration({ pointA: scaleRef.current.pointA, pointB: point, actualLengthMm });
        commitPage({ calibration });
        scaleRef.current.pointA = null;
        setStatus("Scale set");
      }
      return;
    }

    if (activeTool === TOOLS.DRAW_EXTERIOR || activeTool === TOOLS.DRAW_INTERIOR) {
      const wallType = activeTool === TOOLS.DRAW_INTERIOR ? "interior" : "exterior";
      const snap = getSnapCandidate(geometry, point, toleranceDoc(10));
      const drawPoint = snap.point;
      setStatus(snap.label);
      if (!drawRef.current.lastPointId) {
        const tempPointId = generateId("pt");
        const nextGeometry = { ...geometry, points: [...geometry.points, { id: tempPointId, x: drawPoint.x, y: drawPoint.y }] };
        commitGeometry(nextGeometry);
        drawRef.current = { startPointId: tempPointId, lastPointId: tempPointId, wallType };
      } else {
        const appended = appendWallPoint(geometry, drawRef.current.lastPointId, drawPoint, wallType);
        commitGeometry(appended.geometry);
        drawRef.current = { ...drawRef.current, lastPointId: appended.pointId, wallType };
      }
    }
  }, [activeTool, commitGeometry, commitPage, eventPoint, geometry, toleranceDoc, view.panX, view.panY, view.viewport]);

  const pointerMove = useCallback((event) => {
    const point = eventPoint(event);
    if (!point) return;
    setHover(point);
    const session = pointerRef.current;
    if (!session) return;
    if (session.owner === "viewer") {
      const pan = session.panStart;
      setView((prev) => ({
        ...prev,
        panX: pan.panX + event.clientX - pan.clientX,
        panY: pan.panY + event.clientY - pan.clientY,
      }));
      return;
    }
    if (session.dragPointId) {
      const next = movePoint(geometry, session.dragPointId, point);
      pointerRef.current = { ...session, moved: true };
      setHistory((prev) => ({ ...prev, present: next }));
      commitPage({ geometry: next, exteriorConfirmed: false, exteriorConfirmedAt: null });
    }
  }, [commitPage, eventPoint, geometry, setHistory]);

  const pointerUp = useCallback((event) => {
    const session = pointerRef.current;
    if (session?.dragPointId && session.moved) {
      setHistory((prev) => ({
        past: [...prev.past, session.originalGeometry],
        present: prev.present,
        future: [],
      }));
    }
    pointerRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }, [setHistory]);

  const wheel = useCallback((event) => {
    event.preventDefault();
    setView((prev) => {
      if (!prev.viewport || !containerRef.current) return prev;
      const rect = containerRef.current.getBoundingClientRect();
      const cursorX = event.clientX - rect.left;
      const cursorY = event.clientY - rect.top;
      const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev.zoomScale * (event.deltaY > 0 ? 0.9 : 1.1)));
      const ratio = nextZoom / prev.zoomScale;
      return {
        ...prev,
        zoomScale: nextZoom,
        panX: cursorX - (cursorX - prev.panX) * ratio,
        panY: cursorY - (cursorY - prev.panY) * ratio,
      };
    });
  }, []);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;
    node.addEventListener("wheel", wheel, { passive: false });
    return () => node.removeEventListener("wheel", wheel);
  }, [wheel]);

  useEffect(() => {
    if (view.viewport) console.log("[V3 DETECT] overlay rendered");
  }, [geometry, view.viewport]);

  const confirmExterior = useCallback(() => {
    const validation = validateExteriorLoop(geometry);
    if (!validation.valid) {
      setStatus(validation.reason);
      return;
    }
    commitPage({
      geometry: {
        ...geometry,
        walls: geometry.walls.map((wall) => (wall.wallType === "exterior" ? { ...wall, confirmed: true } : wall)),
      },
      exteriorConfirmed: true,
      exteriorConfirmedAt: new Date().toISOString(),
    });
    setStatus("Exterior confirmed");
  }, [commitPage, geometry]);

  const cursor = keysRef.current.space || activeTool === TOOLS.PAN ? "grab" : (activeTool.includes("draw") || activeTool === TOOLS.SET_SCALE ? "crosshair" : "default");
  const ordered = orderedExteriorPoints(geometry);

  return (
    <div style={S.viewerWrap}>
      <div style={S.viewerControls}>
        <button type="button" style={S.iconButton} title="Rotate left" onClick={() => commitPage({ rotation: rotateLeft(page.rotation) })} data-testid="takeoff-v3-rotate-left"><RotateCcw size={16} /></button>
        <button type="button" style={S.iconButton} title="Rotate right" onClick={() => commitPage({ rotation: rotateRight(page.rotation) })} data-testid="takeoff-v3-rotate-right"><RotateCw size={16} /></button>
        <button type="button" style={S.viewerButton} onClick={() => fitTo("fit-page")} data-testid="takeoff-v3-fit-page">Fit Page</button>
        <button type="button" style={S.viewerButton} onClick={() => fitTo("fit-width")} data-testid="takeoff-v3-fit-width">Fit Width</button>
        <button type="button" style={S.viewerButton} onClick={() => setView((prev) => ({ ...prev, zoomScale: 2.5 }))} data-testid="takeoff-v3-zoom-250">250%</button>
        {setDebugTraceMode && (
          <select
            value={debugTraceMode}
            onChange={(event) => setDebugTraceMode(event.target.value)}
            style={S.debugSelect}
            data-testid="takeoff-v3-debug-trace-mode"
          >
            <option value="off">Diagnostics off</option>
            <option value="traceable">Traceable segments</option>
            <option value="components">Components</option>
            <option value="main">Main component</option>
            <option value="outside">Outside-face edges</option>
            <option value="final">Final loop</option>
          </select>
        )}
        <span style={S.rotationLabel}>{page.rotation} deg</span>
      </div>
      {detectMessage && <div style={S.detectStatus} data-testid="takeoff-v3-detect-status">{detectMessage}</div>}
      {status && <div style={S.status} data-testid="takeoff-v3-status">{status}</div>}
      <div
        ref={containerRef}
        style={{ ...S.viewport, cursor }}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
        data-testid="takeoff-v3-viewport"
      >
        <div
          style={{
            ...S.pageLayer,
            width: view.viewport?.width || 0,
            height: view.viewport?.height || 0,
            transform: `translate(${view.panX}px, ${view.panY}px) scale(${view.zoomScale})`,
          }}
          data-testid="takeoff-v3-page-layer"
        >
          <canvas ref={canvasRef} style={S.pdfCanvas} data-testid="takeoff-v3-canvas" />
          {view.viewport && (
            <svg style={S.overlay} width={view.viewport.width} height={view.viewport.height} data-testid="takeoff-v3-overlay">
              <DiagnosticOverlay
                mode={debugTraceMode}
                planGeometryIndex={planGeometryIndex}
                diagnostics={traceDiagnostics}
                viewport={view.viewport}
              />
              {geometry.walls.map((wall) => {
                const [a, b] = wallPoints(geometry, wall);
                if (!a || !b) return null;
                const sa = documentToScreen({ viewport: view.viewport }, a);
                const sb = documentToScreen({ viewport: view.viewport }, b);
                const selectedWall = selected.type === "wall" && selected.id === wall.id;
                return (
                  <line
                    key={wall.id}
                    x1={sa.x}
                    y1={sa.y}
                    x2={sb.x}
                    y2={sb.y}
                    stroke={wall.wallType === "exterior" ? "#0f766e" : "#7c3aed"}
                    strokeWidth={selectedWall ? 5 : 3}
                    strokeLinecap="round"
                  />
                );
              })}
              {ordered.length >= 3 && (
                <polygon
                  points={ordered.map((point) => {
                    const screen = documentToScreen({ viewport: view.viewport }, point);
                    return `${screen.x},${screen.y}`;
                  }).join(" ")}
                  fill="rgba(20, 184, 166, 0.08)"
                  stroke="none"
                />
              )}
              {geometry.points.map((point) => {
                const screen = documentToScreen({ viewport: view.viewport }, point);
                const selectedPoint = selected.type === "point" && selected.id === point.id;
                return <circle key={point.id} cx={screen.x} cy={screen.y} r={selectedPoint ? 6 : 4} fill={selectedPoint ? "#f97316" : "#111827"} stroke="#fff" strokeWidth="1.5" />;
              })}
              {hover && (activeTool === TOOLS.DRAW_EXTERIOR || activeTool === TOOLS.DRAW_INTERIOR) && drawRef.current.lastPointId && (
                <line
                  x1={documentToScreen({ viewport: view.viewport }, geometry.points.find((point) => point.id === drawRef.current.lastPointId) || hover).x}
                  y1={documentToScreen({ viewport: view.viewport }, geometry.points.find((point) => point.id === drawRef.current.lastPointId) || hover).y}
                  x2={documentToScreen({ viewport: view.viewport }, hover).x}
                  y2={documentToScreen({ viewport: view.viewport }, hover).y}
                  stroke="#f97316"
                  strokeWidth="2"
                  strokeDasharray="6 5"
                />
              )}
            </svg>
          )}
        </div>
      </div>
      <button type="button" style={S.confirmButton} onClick={confirmExterior} data-testid="takeoff-v3-confirm-exterior">Confirm Exterior</button>
      <div style={S.mobileSummary}>Perimeter {fmtM(summary.perimeterMm)} / Area {summary.areaM2.toFixed(2)} m2</div>
    </div>
  );
}

function SummaryPanel({ page }) {
  const geometry = page?.geometry || { points: [], walls: [], openings: [] };
  const summary = calculateExteriorSummary(geometry, page?.calibration);
  const exteriorValidation = validateExteriorLoop(geometry);
  return (
    <aside style={S.right}>
      <div style={S.panelTitle}>Takeoff Summary</div>
      <SummaryRow label="Orientation" value={`${page?.rotation ?? 0} deg`} />
      <SummaryRow label="Scale" value={page?.calibration ? `${page.calibration.mmPerDocumentUnit.toFixed(4)} mm/pt` : "Not set"} />
      <SummaryRow label="Exterior walls" value={geometry.walls.filter((wall) => wall.wallType === "exterior").length} />
      <SummaryRow label="Interior walls" value={geometry.walls.filter((wall) => wall.wallType === "interior").length} />
      <SummaryRow label="Windows" value={geometry.openings.filter((opening) => opening.type === "window").length} />
      <SummaryRow label="Doors" value={geometry.openings.filter((opening) => opening.type === "door").length} />
      <SummaryRow label="Openings" value={geometry.openings.filter((opening) => opening.type === "opening").length} />
      <SummaryRow label="Exterior status" value={page?.exteriorConfirmed ? "Confirmed" : (exteriorValidation.valid ? "Closed - Needs Review" : "Draft")} />
      <SummaryRow label="Perimeter" value={summary.valid ? fmtM(summary.perimeterMm) : "-"} />
      <SummaryRow label="Areas" value={summary.valid ? `${summary.areaM2.toFixed(2)} m2` : "-"} />
    </aside>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div style={S.summaryRow}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function TakeoffV3Page({ jobId = "dev-job-1" }) {
  const [documents, setDocuments] = useState([]);
  const [pagesByDocument, setPagesByDocument] = useState({});
  const [selectedPageId, setSelectedPageIdState] = useState(null);
  const [activeTool, setActiveTool] = useState(TOOLS.SELECT);
  const [history, setHistory] = useState(createHistory({ points: [], walls: [], openings: [] }));
  const [detectMessage, setDetectMessage] = useState("");
  const [traceDiagnostics, setTraceDiagnostics] = useState(null);
  const [debugTraceMode, setDebugTraceMode] = useState("off");

  const refresh = useCallback(() => {
    const docs = listDocuments(jobId);
    const pages = {};
    docs.forEach((doc) => { pages[doc.id] = listPages(doc.id); });
    setDocuments(docs);
    setPagesByDocument(pages);
  }, [jobId]);

  useEffect(() => {
    refresh();
    setSelectedPageIdState(getSelectedPageId(jobId));
  }, [jobId, refresh]);

  const selectedPage = useMemo(() => Object.values(pagesByDocument).flat().find((page) => page.id === selectedPageId) || null, [pagesByDocument, selectedPageId]);
  const selectedDocument = useMemo(() => documents.find((doc) => doc.id === selectedPage?.documentId) || null, [documents, selectedPage]);
  const { pdfDocument, error } = usePdfDocument(selectedDocument);
  const { geometry: planGeometryIndex } = usePlanGeometry(pdfDocument, selectedPage?.pageNumber);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("debugTrace") === "1") setDebugTraceMode("traceable");
  }, []);

  useEffect(() => {
    if (selectedPage) {
      setHistory(createHistory(selectedPage.geometry));
      setTraceDiagnostics(selectedPage.exteriorDetectionDiagnostics || null);
    }
  }, [selectedPage?.id]);

  const selectPage = useCallback((documentId, pageId) => {
    setSelectedPageIdState(pageId);
    setSelectedPageId(jobId, pageId);
  }, [jobId]);

  const commitPage = useCallback((patch) => {
    if (!selectedPage) return;
    const updated = savePage({ ...selectedPage, ...patch });
    setPagesByDocument((prev) => ({
      ...prev,
      [selectedPage.documentId]: (prev[selectedPage.documentId] || []).map((page) => (page.id === updated.id ? updated : page)),
    }));
  }, [selectedPage]);

  const undo = useCallback(() => {
    const next = undoHistory(history);
    setHistory(next);
    commitPage({ geometry: next.present, exteriorConfirmed: false, exteriorConfirmedAt: null });
  }, [commitPage, history]);

  const redo = useCallback(() => {
    const next = redoHistory(history);
    setHistory(next);
    commitPage({ geometry: next.present, exteriorConfirmed: false, exteriorConfirmedAt: null });
  }, [commitPage, history]);

  const clear = useCallback(() => {
    const next = createHistory({ points: [], walls: [], openings: [] });
    setHistory(next);
    setTraceDiagnostics(null);
    commitPage({ geometry: next.present, exteriorConfirmed: false, exteriorConfirmedAt: null, exteriorDetectionDiagnostics: null });
  }, [commitPage]);

  const handleDetectExterior = useCallback(() => {
    console.log("[V3 DETECT] clicked");
    const availableLines = planGeometryIndex?.lines?.length || 0;
    console.log(`[V3 DETECT] geometry available: ${availableLines} lines`);
    setDetectMessage("Detecting exterior walls...");
    console.log("[V3 DETECT] detector started");

    window.setTimeout(() => {
      const started = performance.now();
      let result = null;
      try {
        if (!planGeometryIndex || availableLines === 0) {
          result = {
            useful: false,
            segments: [],
            warnings: ["No traceable PDF geometry is available."],
            message: "No traceable PDF geometry is available.",
          };
        } else if ((history.present?.walls || []).some((wall) => wall.source !== "automatic")) {
          result = {
            useful: false,
            segments: [],
            warnings: ["Existing manual trace was preserved."],
            message: "Existing manual trace was preserved.",
          };
        } else {
          result = detectExteriorFromTraceGraph({ planGeometryIndex, page: selectedPage });
        }
      } catch (error) {
        result = {
          useful: false,
          segments: [],
          warnings: [error.message],
          message: error.message,
        };
      }
      const diagnostics = createV3TraceDiagnostics({
        planGeometryIndex,
        detectorResult: result,
        runtimeMs: performance.now() - started,
      });
      setTraceDiagnostics(diagnostics);
      console.log("[V3 DETECT] detector result:", result);
      console.log("[V3 DETECT] diagnostics:", diagnostics);

      const manualProof = result?.diagnostics?.manualTraceProof || [];
      const hasUnsupportedEdges = manualProof.some((proof) => proof.manualTraceable !== true);
      if (result?.useful && result?.isClosed && result?.segments?.length && !hasUnsupportedEdges) {
        const nextGeometry = detectorResultToV3Geometry(result);
        const nextHistory = commitHistory(history, nextGeometry);
        setHistory(nextHistory);
        commitPage({
          geometry: nextHistory.present,
          exteriorConfirmed: false,
          exteriorConfirmedAt: null,
          exteriorDetectionDiagnostics: diagnostics,
        });
        console.log("[V3 DETECT] geometry committed", { committed: true, walls: nextGeometry.walls.length });
        setDetectMessage("Exterior detected — review the highlighted perimeter.");
        return;
      }

      commitPage({ exteriorDetectionDiagnostics: diagnostics });
      console.log("[V3 DETECT] geometry committed", { committed: false, reason: result?.message || result?.warnings?.[0] || "no candidate" });
      setDetectMessage("Exterior could not be detected reliably. Use Trace Exterior.");
    }, 250);
  }, [commitPage, history, planGeometryIndex, selectedPage]);

  return (
    <div style={S.page} data-testid="takeoff-v3-page">
      <div style={S.v3Badge} data-testid="takeoff-v3-badge">TAKEOFF V3</div>
      <Toolbar
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        onUndo={undo}
        onRedo={redo}
        onClear={clear}
        onDetectExterior={handleDetectExterior}
      />
      <div style={S.body}>
        <DocumentList
          jobId={jobId}
          documents={documents}
          pagesByDocument={pagesByDocument}
          selectedPageId={selectedPageId}
          onRefresh={refresh}
          onSelectPage={selectPage}
        />
        <main style={S.center}>
          {selectedPage && pdfDocument ? (
            <PlanViewerV3
              key={selectedPage.id}
              pdfDocument={pdfDocument}
              page={selectedPage}
              history={history}
              setHistory={setHistory}
              commitPage={commitPage}
              activeTool={activeTool}
              detectMessage={detectMessage}
              planGeometryIndex={planGeometryIndex}
              traceDiagnostics={traceDiagnostics}
              debugTraceMode={debugTraceMode}
              setDebugTraceMode={debugTraceMode === "off" && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debugTrace") !== "1" ? null : setDebugTraceMode}
            />
          ) : (
            <div style={S.emptyViewer} data-testid="takeoff-v3-viewer-empty">{error || "Upload or select a plan page."}</div>
          )}
        </main>
        <SummaryPanel page={selectedPage} />
      </div>
    </div>
  );
}

const S = {
  page: { height: "100vh", display: "flex", flexDirection: "column", background: "#f4f6f8", color: "#111827", fontFamily: "Inter, system-ui, sans-serif" },
  v3Badge: { position: "fixed", top: 8, right: 14, zIndex: 20, border: "1px solid #0f766e", borderRadius: 6, background: "#0f766e", color: "#fff", padding: "5px 9px", fontSize: 11, fontWeight: 900, letterSpacing: 0 },
  body: { minHeight: 0, flex: 1, display: "flex" },
  left: { width: 292, borderRight: "1px solid #d7dde5", background: "#fff", padding: 12, overflowY: "auto" },
  center: { minWidth: 0, flex: 1, display: "flex", flexDirection: "column" },
  right: { width: 292, borderLeft: "1px solid #d7dde5", background: "#fbfcfd", padding: 14, overflowY: "auto" },
  topToolbar: { height: 48, display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderBottom: "1px solid #d7dde5", background: "#fff" },
  toolButton: { display: "inline-flex", alignItems: "center", gap: 6, minHeight: 34, border: "1px solid #c9d2df", borderRadius: 6, background: "#fff", color: "#243244", padding: "0 9px", fontSize: 12, fontWeight: 700, cursor: "pointer" },
  toolButtonActive: { border: "1px solid #0891b2", background: "#ecfeff", color: "#155e75" },
  iconButton: { width: 34, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid #c9d2df", borderRadius: 6, background: "#fff", color: "#243244", cursor: "pointer" },
  flexSpacer: { flex: 1 },
  panelTitle: { fontSize: 13, fontWeight: 900, color: "#1f2937", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0 },
  upload: { width: "100%", border: "1px dashed #0891b2", borderRadius: 7, background: "#ecfeff", color: "#155e75", padding: "12px 8px", fontSize: 13, fontWeight: 800, cursor: "pointer" },
  error: { marginTop: 8, color: "#b91c1c", fontSize: 12 },
  empty: { marginTop: 10, border: "1px dashed #cbd5e1", borderRadius: 6, padding: 10, color: "#64748b", fontSize: 12, textAlign: "center" },
  docCard: { marginTop: 12, borderTop: "1px solid #e5e7eb", paddingTop: 10 },
  docTitle: { fontSize: 13, fontWeight: 800, color: "#111827", overflowWrap: "anywhere" },
  smallDanger: { marginTop: 6, border: "1px solid #fecaca", borderRadius: 5, background: "#fff1f2", color: "#b91c1c", padding: "4px 7px", fontSize: 11, cursor: "pointer" },
  thumbGrid: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 },
  thumb: { width: 98, border: "1px solid #d7dde5", borderRadius: 6, background: "#fff", padding: 5, fontSize: 10, color: "#334155", cursor: "pointer" },
  thumbSelected: { borderColor: "#0891b2", background: "#ecfeff" },
  thumbCanvas: { display: "block", maxWidth: 86, margin: "0 auto 4px" },
  viewerWrap: { minHeight: 0, flex: 1, display: "flex", flexDirection: "column" },
  viewerControls: { height: 42, display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", borderBottom: "1px solid #d7dde5", background: "#f8fafc" },
  viewerButton: { border: "1px solid #c9d2df", borderRadius: 6, background: "#fff", color: "#243244", padding: "7px 9px", fontSize: 12, fontWeight: 700, cursor: "pointer" },
  debugSelect: { border: "1px solid #c9d2df", borderRadius: 6, background: "#fff", color: "#243244", padding: "6px 8px", fontSize: 12, fontWeight: 700 },
  rotationLabel: { marginLeft: "auto", fontSize: 12, fontWeight: 900, color: "#155e75" },
  status: { padding: "5px 8px", color: "#374151", background: "#fff7ed", borderBottom: "1px solid #fed7aa", fontSize: 12 },
  detectStatus: { padding: "7px 10px", color: "#0f172a", background: "#e0f2fe", borderBottom: "1px solid #7dd3fc", fontSize: 13, fontWeight: 800 },
  viewport: { position: "relative", flex: 1, overflow: "hidden", background: "#dfe5eb" },
  pageLayer: { position: "absolute", left: 0, top: 0, transformOrigin: "0 0", background: "transparent", lineHeight: 0 },
  pdfCanvas: { display: "block", background: "#fff" },
  overlay: { position: "absolute", left: 0, top: 0, display: "block", pointerEvents: "none", background: "transparent", overflow: "visible" },
  confirmButton: { position: "absolute", right: 316, bottom: 16, border: "1px solid #0f766e", borderRadius: 6, background: "#0f766e", color: "#fff", padding: "9px 12px", fontSize: 12, fontWeight: 800, cursor: "pointer" },
  mobileSummary: { display: "none" },
  emptyViewer: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", fontSize: 14 },
  summaryRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "9px 0", borderBottom: "1px solid #e5e7eb", fontSize: 12, color: "#4b5563" },
};
