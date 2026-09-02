import { useCallback, useEffect, useRef, useState } from "react";
import { clampSharpRenderScale, computeFitScale, createPageRenderer } from "../viewer/PdfViewport.js";
import { screenToPagePoint } from "../viewer/screenToPagePoint.js";
import { CLICK_THRESHOLD_PX, isClickPan, panViewFromDrag, shouldForcePan } from "../viewer/dragInteraction.js";
import { cursorForPlanViewer } from "../viewer/planViewerCursor.js";
import TakeoffCanvasOverlay from "./TakeoffCanvasOverlay.jsx";
import WallContextPanel from "./WallContextPanel.jsx";
import WallSnapDebugPanel from "./WallSnapDebugPanel.jsx";

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 8;

const TOOL_CURSORS = {
  "set-scale": "crosshair",
  area: "crosshair",
  "exterior-wall": "crosshair",
  "internal-wall": "crosshair",
  "add-corner": "crosshair",
  "move-corner": "default",
  door: "crosshair",
  window: "crosshair",
  opening: "crosshair",
  "garage-door": "crosshair",
  "edit-walls": "crosshair",
  "exterior-highlighter": "crosshair",
  "plan-region": "crosshair",
};

export default function PlanViewer({ pdfDocument, page, tools, planGeometryIndex }) {
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
    else if (tools.activeTool === "add-corner") tools.handleAddCornerClick?.(point, options);
    else if (tools.activeTool === "move-corner" || tools.activeTool === "edit-walls" || tools.activeTool === "edit" || tools.activeTool === "select") {
      if (event.detail >= 2) {
        const hitFields = tools.activeTool === "edit-walls" ? ["exteriorWalls"] : ["exteriorWalls", "internalWalls"];
        for (const field of hitFields) {
          const hit = tools.findWallSegmentNear?.(point, { field, zoomScale: view.zoomScale, toleranceScreenPx: 18 });
          if (hit?.segment?.id) {
            tools.insertWallPointAt?.(point, { field, zoomScale: view.zoomScale });
            return;
          }
        }
      }
      tools.handleEditToolClick?.(point, options);
    }
    else if (tools.activeTool === "plan-region") tools.handlePlanRegionClick?.(point, options);
    else if (["door", "window", "opening", "internal-door", "external-door", "sliding-door", "garage-door", "open-opening"].includes(tools.activeTool)) tools.handleOpeningCanvasClick?.(point, options);
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
    if ((tools?.activeTool === "move-corner" || tools?.activeTool === "edit-walls" || tools?.activeTool === "edit" || tools?.activeTool === "select") && point && !forcePan) {
      const openingHit = tools.findOpeningHandleNear?.(point, { zoomScale: view.zoomScale });
      if (openingHit?.openingId) {
        tools.beginOpeningDrag?.(openingHit.openingId, openingHit.handle);
        dragRef.current = { mode: "opening" };
        return;
      }
      if (event.detail >= 2) {
        const hitFields = tools.activeTool === "edit-walls" ? ["exteriorWalls"] : ["exteriorWalls", "internalWalls"];
        for (const field of hitFields) {
          const hit = tools.findWallSegmentNear?.(point, { field, zoomScale: view.zoomScale, toleranceScreenPx: 18 });
          if (hit?.segment?.id) {
            tools.insertWallPointAt?.(point, { field, zoomScale: view.zoomScale });
            dragRef.current = null;
            return;
          }
        }
      }
      const vertexHit = tools.findWallVertexNearAny?.(point, { zoomScale: view.zoomScale });
      if (vertexHit?.vertex?.id) {
        tools.beginWallVertexDrag?.(vertexHit.vertex.id, vertexHit.field || "exteriorWalls");
        dragRef.current = { mode: "vertex" };
        return;
      }
    }
    if (tools?.activeTool === "area" && point && !forcePan) {
      const areaVertexHit = tools.findAreaVertexNear?.(point, { zoomScale: view.zoomScale });
      if (areaVertexHit) {
        tools.beginAreaVertexDrag?.(areaVertexHit.areaId, areaVertexHit.vertexIndex);
        dragRef.current = { mode: "area-vertex" };
        return;
      }
      if (tools.areaMode !== "rectangle") {
        tools.handleAreaCanvasClick?.(point, { zoomScale: view.zoomScale, altKey: event.altKey });
        dragRef.current = { mode: "area-point" };
        return;
      }
      tools.beginAreaRectangle?.(point, { zoomScale: view.zoomScale, altKey: event.altKey });
      dragRef.current = { mode: "area-rectangle" };
      return;
    }
    dragRef.current = { mode: "pan", startX: event.clientX, startY: event.clientY, panX: view.panX, panY: view.panY };
  }, [eventToPagePoint, tools, view.panX, view.panY, view.zoomScale]);

  const handleMouseMove = useCallback((event) => {
    updateToolHover(event);
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.mode === "area-rectangle") {
      const point = eventToPagePoint(event);
      if (point) tools?.updateAreaRectangle?.(point, { zoomScale: view.zoomScale, altKey: event.altKey });
      return;
    }
    if (drag.mode === "area-vertex") {
      const point = eventToPagePoint(event);
      if (point) tools?.updateAreaVertexDrag?.(point, { zoomScale: view.zoomScale, altKey: event.altKey });
      return;
    }
    if (drag.mode === "vertex") {
      const point = eventToPagePoint(event);
      if (point) tools?.updateWallVertexDrag?.(point, { zoomScale: view.zoomScale, disableSnap: event.altKey });
      return;
    }
    if (drag.mode === "opening") {
      const point = eventToPagePoint(event);
      if (point) tools?.updateOpeningDrag?.(point, { zoomScale: view.zoomScale });
      return;
    }
    setView((prev) => panViewFromDrag(prev, drag, event));
  }, [eventToPagePoint, tools, updateToolHover, view.zoomScale]);

  const handleMouseUp = useCallback((event) => {
    const drag = dragRef.current;
    dragRef.current = null;
    event.currentTarget?.releasePointerCapture?.(event.pointerId);
    if (!drag) return;
    if (drag.mode === "area-rectangle") {
      const point = eventToPagePoint(event);
      tools?.finishAreaRectangle?.(point, { zoomScale: view.zoomScale, altKey: event.altKey });
      return;
    }
    if (drag.mode === "area-vertex") {
      tools?.endAreaVertexDrag?.();
      return;
    }
    if (drag.mode === "area-point") {
      return;
    }
    if (drag.mode === "vertex") {
      tools?.endWallVertexDrag?.({ zoomScale: view.zoomScale });
      return;
    }
    if (drag.mode === "opening") {
      tools?.endOpeningDrag?.();
      return;
    }
    if (isClickPan(drag, event, CLICK_THRESHOLD_PX) && tools?.activeTool !== "pan") {
      handleToolClick(event);
    }
  }, [eventToPagePoint, handleToolClick, tools, view.zoomScale]);

  const handleDoubleClick = useCallback((event) => {
    const point = eventToPagePoint(event);
    if (!point || !tools || (tools.activeTool !== "edit-walls" && tools.activeTool !== "edit")) return;
    const hitFields = tools.activeTool === "edit-walls" ? ["exteriorWalls"] : ["exteriorWalls", "internalWalls"];
    for (const field of hitFields) {
      const hit = tools.findWallSegmentNear?.(point, { field, zoomScale: view.zoomScale, toleranceScreenPx: 18 });
      if (hit?.segment?.id) {
        tools.insertWallPointAt?.(point, { field, zoomScale: view.zoomScale });
        return;
      }
    }
  }, [eventToPagePoint, tools, view.zoomScale]);

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

  const cursor = cursorForPlanViewer({
    activeTool: tools?.activeTool,
    dragMode: dragRef.current?.mode,
    editHoverTarget: tools?.wallEditHoverTarget,
    areaHoverTarget: tools?.areaEditHoverTarget,
  }) || TOOL_CURSORS[tools?.activeTool] || "grab";

  return (
    <div style={S.wrap}>
      <div style={S.toolbar}>
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
        onDoubleClick={handleDoubleClick}
        data-testid="plan-viewport"
      >
        <div
          style={{
            ...S.pageLayer,
            transform: `translate(${view.panX}px, ${view.panY}px) scale(${view.zoomScale})`,
            width: view.viewport?.width || 0,
            height: view.viewport?.height || 0,
          }}
          data-testid="plan-page-layer"
        >
          <canvas ref={canvasRef} style={S.pdfCanvas} data-testid="plan-canvas" />
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
        {tools && <WallContextPanel page={page} tools={tools} />}
        {tools && <WallSnapDebugPanel page={page} tools={tools} />}
      </div>
    </div>
  );
}

const S = {
  wrap: { position: "relative", display: "flex", flexDirection: "column", height: "100%", minHeight: 0 },
  toolbar: { position: "absolute", top: 10, left: 10, zIndex: 12, display: "flex", alignItems: "center", gap: 4, padding: 5, border: "1px solid rgba(148, 163, 184, 0.9)", borderRadius: 7, background: "rgba(255,255,255,0.92)", boxShadow: "0 8px 24px rgba(15,23,42,0.16)" },
  button: { border: "1px solid #cbd5e1", background: "#fff", color: "#334155", borderRadius: 5, padding: "4px 7px", fontSize: 11, fontWeight: 800, cursor: "pointer" },
  divider: { width: 1, alignSelf: "stretch", background: "#e2e8f0", margin: "0 4px" },
  rotationLabel: { marginLeft: "auto", fontSize: 12, fontWeight: 800, color: "#1d4ed8" },
  status: { padding: "4px 8px", fontSize: 12, color: "#b91c1c" },
  viewport: { position: "relative", flex: 1, overflow: "hidden", background: "#e2e8f0", cursor: "grab" },
  pageLayer: { position: "absolute", left: 0, top: 0, transformOrigin: "0 0", background: "transparent", lineHeight: 0 },
  pdfCanvas: { display: "block", background: "#fff" },
};
