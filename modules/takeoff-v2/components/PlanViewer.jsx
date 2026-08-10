import { useCallback, useEffect, useRef, useState } from "react";
import { clampSharpRenderScale, computeFitScale, createPageRenderer } from "../viewer/PdfViewport.js";
import { screenToPagePoint } from "../viewer/screenToPagePoint.js";
import { CLICK_THRESHOLD_PX, isClickPan, panViewFromDrag, shouldForcePan } from "../viewer/dragInteraction.js";
import TakeoffCanvasOverlay from "./TakeoffCanvasOverlay.jsx";

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 8;

const TOOL_CURSORS = {
  "set-scale": "crosshair",
  area: "crosshair",
  "exterior-wall": "crosshair",
  "internal-wall": "crosshair",
  "edit-walls": "crosshair",
  "exterior-highlighter": "crosshair",
  "plan-region": "crosshair",
};

export default function PlanViewer({ pdfDocument, page, tools, planGeometryIndex, onRotateLeft, onRotateRight, onResetRotation }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const dragRef = useRef(null);
  const fitScaleRef = useRef(1);
  const renderRequestRef = useRef(0);

  const [view, setView] = useState({ viewport: null, zoomScale: 1, panX: 0, panY: 0 });
  const [status, setStatus] = useState("");

  const eventToPagePoint = useCallback((event) => {
    if (!view.viewport || !containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    return screenToPagePoint(
      { viewport: view.viewport, panX: view.panX, panY: view.panY, zoomScale: view.zoomScale },
      event.clientX - rect.left,
      event.clientY - rect.top
    );
  }, [view.panX, view.panY, view.viewport, view.zoomScale]);

  const handleToolClick = useCallback((event) => {
    const point = eventToPagePoint(event);
    if (!point || !tools) return;
    const options = { zoomScale: view.zoomScale, shiftKey: event.shiftKey, altKey: event.altKey };
    if (tools.activeTool === "set-scale" || tools.activeTool === "measure") tools.placePointerPoint?.(point, options);
    else if (tools.activeTool === "area") tools.handleAreaCanvasClick?.(point, options);
    else if (tools.activeTool === "exterior-wall" || tools.activeTool === "internal-wall") tools.handleWallDrawClick?.(point, options);
    else if (tools.activeTool === "edit-walls" || tools.activeTool === "edit") tools.handleEditToolClick?.(point, options);
    else if (tools.activeTool === "plan-region") tools.handlePlanRegionClick?.(point, options);
    else if (["window", "internal-door", "external-door", "sliding-door", "garage-door", "open-opening"].includes(tools.activeTool)) tools.handleOpeningCanvasClick?.(point, options);
    else if (tools.activeTool === "exterior-highlighter") tools.toggleExteriorHighlightedWall?.();
  }, [eventToPagePoint, tools, view.zoomScale]);

  const updateToolHover = useCallback((event) => {
    const point = eventToPagePoint(event);
    if (!point || !tools) return;
    const options = { zoomScale: view.zoomScale, shiftKey: event.shiftKey, altKey: event.altKey };
    tools.setHoverPoint?.(point);
    tools.updatePointerHover?.(point, options);
    tools.updateWallDrawHover?.(point, options);
    tools.updateWallEditHover?.(point, options);
    tools.updateAreaHover?.(point, options);
    tools.updatePlanRegionHover?.(point, options);
    tools.updateOpeningHover?.(point, options);
    tools.updateExteriorHighlighterHover?.(point, { ...options, sourceCanvas: canvasRef.current });
  }, [eventToPagePoint, tools, view.zoomScale]);

  const renderAtZoom = useCallback(async (zoomScale) => {
    if (!pdfDocument || !page || !canvasRef.current) return;
    if (!rendererRef.current) rendererRef.current = createPageRenderer(canvasRef.current);

    const requestId = renderRequestRef.current + 1;
    renderRequestRef.current = requestId;

    try {
      const { viewport } = await rendererRef.current.render({
        pdfDocument,
        pageNumber: page.pageNumber,
        rotation: page.rotation,
        scale: clampSharpRenderScale({
          baseScale: fitScaleRef.current,
          zoomScale,
          unrotatedWidth: page.sourceWidth,
          unrotatedHeight: page.sourceHeight,
          rotation: page.rotation,
          pixelRatio: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
        }),
        displayScale: fitScaleRef.current,
      });
      if (renderRequestRef.current === requestId) {
        setView((prev) => ({ ...prev, viewport }));
        setStatus("");
      }
    } catch (err) {
      if (err?.name !== "RenderingCancelledException") setStatus(`Render failed: ${err.message}`);
    }
  }, [pdfDocument, page?.pageNumber, page?.rotation]);

  const fitTo = useCallback(async (mode) => {
    if (!pdfDocument || !page || !canvasRef.current || !containerRef.current) return;
    if (!rendererRef.current) rendererRef.current = createPageRenderer(canvasRef.current);

    const container = containerRef.current;
    const rawPage = await pdfDocument.getPage(page.pageNumber);
    const rotatedViewportAtOne = rawPage.getViewport({ scale: 1, rotation: page.rotation });

    const fitScale = computeFitScale({
      pageWidth: rotatedViewportAtOne.width,
      pageHeight: rotatedViewportAtOne.height,
      containerWidth: container.clientWidth,
      containerHeight: container.clientHeight,
      mode,
    });

    try {
      fitScaleRef.current = fitScale;
      const { viewport } = await rendererRef.current.render({
        pdfDocument,
        pageNumber: page.pageNumber,
        rotation: page.rotation,
        scale: fitScale,
        displayScale: fitScale,
      });
      const panX = Math.max(0, (container.clientWidth - viewport.width) / 2);
      const panY = Math.max(0, (container.clientHeight - viewport.height) / 2);
      setView({ viewport, zoomScale: 1, panX, panY });
      setStatus("");
    } catch (err) {
      if (err?.name !== "RenderingCancelledException") setStatus(`Render failed: ${err.message}`);
    }
  }, [pdfDocument, page?.pageNumber, page?.rotation]);

  // Every rotation (or page switch) re-renders from scratch and re-fits, per spec.
  useEffect(() => {
    fitTo("fit-page");
    return () => rendererRef.current?.cancel();
  }, [fitTo]);

  const hasViewport = Boolean(view.viewport);

  useEffect(() => {
    if (!hasViewport || view.zoomScale === 1) return undefined;
    const timeoutId = window.setTimeout(() => {
      renderAtZoom(view.zoomScale);
    }, 120);
    return () => window.clearTimeout(timeoutId);
  }, [hasViewport, renderAtZoom, view.zoomScale]);

  const handleWheelRef = useRef(() => {});
  handleWheelRef.current = useCallback((event) => {
    event.preventDefault();
    setView((prev) => {
      if (!prev.viewport || !containerRef.current) return prev;
      const rect = containerRef.current.getBoundingClientRect();
      const cursorX = event.clientX - rect.left;
      const cursorY = event.clientY - rect.top;
      const factor = event.deltaY > 0 ? 0.9 : 1.1;
      const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.zoomScale * factor));
      const ratio = nextZoom / prev.zoomScale;
      return {
        ...prev,
        zoomScale: nextZoom,
        panX: cursorX - (cursorX - prev.panX) * ratio,
        panY: cursorY - (cursorY - prev.panY) * ratio,
      };
    });
  }, []);

  // Attached as a native listener (not React's onWheel) because React registers
  // wheel handlers as passive by default, so event.preventDefault() inside a
  // synthetic onWheel handler silently does nothing and the outer page can
  // scroll while the user is trying to zoom the plan.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const listener = (event) => handleWheelRef.current(event);
    container.addEventListener("wheel", listener, { passive: false });
    return () => container.removeEventListener("wheel", listener);
  }, []);

  const handleMouseDown = useCallback((event) => {
    event.currentTarget?.setPointerCapture?.(event.pointerId);
    const forcePan = shouldForcePan(event, tools?.activeTool);
    const point = eventToPagePoint(event);
    if (tools?.activeTool === "area" && tools.areaMode === "rectangle" && point && !forcePan) {
      tools.beginAreaRectangle?.(point);
      dragRef.current = { mode: "area-rectangle" };
      return;
    }
    dragRef.current = { mode: "pan", startX: event.clientX, startY: event.clientY, panX: view.panX, panY: view.panY };
  }, [eventToPagePoint, tools, view.panX, view.panY]);

  const handleMouseMove = useCallback((event) => {
    updateToolHover(event);
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.mode === "area-rectangle") {
      const point = eventToPagePoint(event);
      if (point) tools?.updateAreaRectangle?.(point);
      return;
    }
    setView((prev) => panViewFromDrag(prev, drag, event));
  }, [eventToPagePoint, tools, updateToolHover]);

  const handleMouseUp = useCallback((event) => {
    const drag = dragRef.current;
    dragRef.current = null;
    event.currentTarget?.releasePointerCapture?.(event.pointerId);
    if (!drag) return;
    if (drag.mode === "area-rectangle") {
      tools?.finishAreaRectangle?.();
      return;
    }
    if (isClickPan(drag, event, CLICK_THRESHOLD_PX) && tools?.activeTool !== "pan") {
      handleToolClick(event);
    }
  }, [handleToolClick, tools]);

  useEffect(() => {
    const clearDrag = () => { dragRef.current = null; };
    window.addEventListener("mouseup", clearDrag);
    window.addEventListener("pointerup", clearDrag);
    window.addEventListener("blur", clearDrag);
    return () => {
      window.removeEventListener("mouseup", clearDrag);
      window.removeEventListener("pointerup", clearDrag);
      window.removeEventListener("blur", clearDrag);
    };
  }, []);

  const cursor = tools?.activeTool === "pan" ? "grab" : (TOOL_CURSORS[tools?.activeTool] || "grab");

  return (
    <div style={S.wrap}>
      <div style={S.toolbar}>
        <button type="button" style={S.button} onClick={onRotateLeft} data-testid="rotate-left-button">Rotate Left</button>
        <button type="button" style={S.button} onClick={onRotateRight} data-testid="rotate-right-button">Rotate Right</button>
        <button type="button" style={S.button} onClick={onResetRotation} data-testid="reset-rotation-button">Reset Rotation</button>
        <span style={S.divider} />
        <button type="button" style={S.button} onClick={() => fitTo("fit-page")} data-testid="fit-page-button">Fit Page</button>
        <button type="button" style={S.button} onClick={() => fitTo("fit-width")} data-testid="fit-width-button">Fit Width</button>
        <button type="button" style={S.button} onClick={() => fitTo("fit-page")} data-testid="reset-view-button">Reset View</button>
        <span style={S.rotationLabel} data-testid="current-rotation">{page?.rotation ?? 0}&deg;</span>
      </div>

      {status && <div style={S.status}>{status}</div>}

      <div
        ref={containerRef}
        style={{ ...S.viewport, cursor }}
        onPointerDown={handleMouseDown}
        onPointerMove={handleMouseMove}
        onPointerUp={handleMouseUp}
        onPointerCancel={handleMouseUp}
        onPointerLeave={handleMouseUp}
        data-testid="plan-viewport"
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            transform: `translate(${view.panX}px, ${view.panY}px) scale(${view.zoomScale})`,
            transformOrigin: "0 0",
          }}
        >
          <canvas ref={canvasRef} data-testid="plan-canvas" />
          {view.viewport && tools && (
            <TakeoffCanvasOverlay
              page={page}
              tools={tools}
              viewport={view.viewport}
              planGeometryIndex={planGeometryIndex}
              sourceCanvas={canvasRef.current}
            />
          )}
        </div>
      </div>
    </div>
  );
}

const S = {
  wrap: { display: "flex", flexDirection: "column", height: "100%" },
  toolbar: { display: "flex", alignItems: "center", gap: 6, padding: 8, borderBottom: "1px solid #e2e8f0", background: "#f8fafc" },
  button: { border: "1px solid #cbd5e1", background: "#fff", color: "#334155", borderRadius: 6, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" },
  divider: { width: 1, alignSelf: "stretch", background: "#e2e8f0", margin: "0 4px" },
  rotationLabel: { marginLeft: "auto", fontSize: 12, fontWeight: 800, color: "#1d4ed8" },
  status: { padding: "4px 8px", fontSize: 12, color: "#b91c1c" },
  viewport: { position: "relative", flex: 1, overflow: "hidden", background: "#e2e8f0", cursor: "grab" },
};
