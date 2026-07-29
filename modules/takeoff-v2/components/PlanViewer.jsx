import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { clampSharpRenderScale, computeFitScale, createPageRenderer } from "../viewer/PdfViewport.js";
import { pageToScreenPoint } from "../viewer/pageToScreenPoint.js";
import { screenToPagePoint } from "../viewer/screenToPagePoint.js";
import TakeoffCanvasOverlay from "./TakeoffCanvasOverlay.jsx";
import WallContextPanel from "./WallContextPanel.jsx";

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 8;
const CLICK_THRESHOLD_PX = 6;
const WALL_DRAW_TOOLS = ["exterior-wall", "internal-wall"];
const OPENING_TOOLS = ["window", "internal-door", "external-door", "sliding-door", "garage-door", "open-opening"];

// Shift-constrains a raw page-space point to horizontal/vertical relative to
// `anchor`, in *screen* space (what the user visually sees), then converts
// back to page-space. Free-angle drawing is the default; Shift is opt-in.
function constrainToAxis(anchor, rawPoint, view) {
  const viewArgs = { viewport: view.viewport, panX: view.panX, panY: view.panY, zoomScale: view.zoomScale };
  const anchorScreen = pageToScreenPoint(viewArgs, anchor.x, anchor.y);
  const rawScreen = pageToScreenPoint(viewArgs, rawPoint.x, rawPoint.y);
  const dx = Math.abs(rawScreen.x - anchorScreen.x);
  const dy = Math.abs(rawScreen.y - anchorScreen.y);
  const constrainedScreen = dx >= dy ? { x: rawScreen.x, y: anchorScreen.y } : { x: anchorScreen.x, y: rawScreen.y };
  return screenToPagePoint(viewArgs, constrainedScreen.x, constrainedScreen.y);
}

const PlanViewer = forwardRef(function PlanViewer(
  { pdfDocument, page, onRotateLeft, onRotateRight, onResetRotation, onRedetectOrientation, redetecting = false, tools, planGeometryIndex },
  ref
) {
  const containerRef = useRef(null);
  const canvasARef = useRef(null);
  const canvasBRef = useRef(null);
  const renderersRef = useRef({});
  const activeCanvasRef = useRef("a");
  const renderGenerationRef = useRef(0);
  const dragRef = useRef(null);

  const [activeCanvas, setActiveCanvas] = useState("a");
  const [view, setView] = useState({ viewport: null, baseScale: 1, renderScale: 1, zoomScale: 1, panX: 0, panY: 0 });
  const [status, setStatus] = useState("");

  const getCanvas = useCallback((key) => (key === "a" ? canvasARef.current : canvasBRef.current), []);

  const getRenderer = useCallback((key) => {
    const canvas = getCanvas(key);
    if (!canvas) return null;
    if (!renderersRef.current[key]) renderersRef.current[key] = createPageRenderer(canvas);
    return renderersRef.current[key];
  }, [getCanvas]);

  const cancelRenderers = useCallback(() => {
    renderersRef.current.a?.cancel();
    renderersRef.current.b?.cancel();
  }, []);

  const renderSharpCanvas = useCallback(async ({ baseScale, zoomScale, baseViewport, panX = null, panY = null, generation }) => {
    const target = activeCanvasRef.current === "a" ? "b" : "a";
    const targetRenderer = getRenderer(target);
    if (!targetRenderer || !pdfDocument || !page) return;

    const pixelRatio = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const renderScale = clampSharpRenderScale({
      baseScale,
      zoomScale,
      unrotatedWidth: page.sourceWidth,
      unrotatedHeight: page.sourceHeight,
      rotation: page.rotation,
      pixelRatio,
    });

    try {
      await targetRenderer.render({
        pdfDocument,
        pageNumber: page.pageNumber,
        rotation: page.rotation,
        scale: renderScale,
        cssWidth: baseViewport.width,
        cssHeight: baseViewport.height,
      });

      if (renderGenerationRef.current !== generation) return;
      activeCanvasRef.current = target;
      setActiveCanvas(target);
      setView((current) => ({
        ...current,
        viewport: baseViewport,
        baseScale,
        renderScale,
        panX: panX == null ? current.panX : panX,
        panY: panY == null ? current.panY : panY,
      }));
      setStatus("");
    } catch (err) {
      if (err?.name !== "RenderingCancelledException" && renderGenerationRef.current === generation) {
        setStatus(`Render failed: ${err.message}`);
      }
    }
  }, [getRenderer, page, pdfDocument]);

  const fitTo = useCallback(async (mode) => {
    if (!pdfDocument || !page || !containerRef.current) return;

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
    const baseViewport = rawPage.getViewport({ scale: fitScale, rotation: page.rotation });
    const generation = renderGenerationRef.current + 1;
    renderGenerationRef.current = generation;

    const panX = Math.max(0, (container.clientWidth - baseViewport.width) / 2);
    const panY = Math.max(0, (container.clientHeight - baseViewport.height) / 2);
    setView((current) => ({ ...current, viewport: baseViewport, baseScale: fitScale, renderScale: fitScale, zoomScale: 1, panX, panY }));
    await renderSharpCanvas({ baseScale: fitScale, zoomScale: 1, baseViewport, panX, panY, generation });
  }, [pdfDocument, page, renderSharpCanvas]);

  // Every rotation (or page switch) re-renders from scratch and re-fits, per spec.
  useEffect(() => {
    fitTo("fit-page");
    return () => {
      renderGenerationRef.current += 1;
      cancelRenderers();
    };
  }, [fitTo]);

  useEffect(() => {
    if (!view.viewport || !view.baseScale || !pdfDocument || !page) return undefined;
    const generation = renderGenerationRef.current + 1;
    const timer = window.setTimeout(() => {
      renderGenerationRef.current = generation;
      renderSharpCanvas({
        baseScale: view.baseScale,
        zoomScale: view.zoomScale,
        baseViewport: view.viewport,
        generation,
      });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [pdfDocument, page?.id, page?.pageNumber, page?.rotation, renderSharpCanvas, view.baseScale, view.viewport, view.zoomScale]);

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

  useImperativeHandle(ref, () => ({
    captureSnapshot: () => {
      if (!view.viewport) return null;
      const canvas = activeCanvasRef.current === "a" ? canvasARef.current : canvasBRef.current;
      if (!canvas) return null;
      return {
        imageDataUrl: canvas.toDataURL("image/png"),
        imageWidth: view.viewport.width,
        imageHeight: view.viewport.height,
        viewport: view.viewport,
      };
    },
  }), [view.viewport]);

  const eventToPagePoint = useCallback((event) => {
    if (!containerRef.current || !view.viewport) return null;
    const rect = containerRef.current.getBoundingClientRect();
    return screenToPagePoint(
      { viewport: view.viewport, panX: view.panX, panY: view.panY, zoomScale: view.zoomScale },
      event.clientX - rect.left,
      event.clientY - rect.top
    );
  }, [view.viewport, view.panX, view.panY, view.zoomScale]);

  // Default (no active tool / Select tool): byte-for-byte identical to the
  // original pan-only behavior. With a takeoff tool active: pointerdown either
  // starts a vertex-drag (if it lands on an existing wall vertex while
  // editing) or records a click-candidate; pointermove still pans (so users
  // can always pan by dragging empty space, tool or no tool) and live-updates
  // the tool's hover point for line previews; pointerup fires the tool's
  // point action only if the pointer barely moved (a "click"), otherwise it
  // was a pan and today's exact behavior applies.
  //
  // Pointer events (not mouse events) are used throughout, with explicit
  // pointer capture on the container: this guarantees pointermove/pointerup
  // for a given drag keep arriving at this element even if the cursor leaves
  // its bounds mid-drag (fast panning, releasing outside the viewport, a
  // touch/pen device) — the previous mouse-event version relied on
  // onMouseLeave to end a drag, which a fast pointer could outrun.
  //
  // Root cause of the "Cannot read properties of null (reading 'panX')"
  // crash this replaces: the old pan updater read `dragRef.current.panX`
  // *inside* the `setView(prev => ...)` callback — a lazily-invoked React
  // state updater. If `dragRef.current` was nulled out by an end-of-drag
  // handler (pointerup/pointercancel/tool change) before React actually
  // invoked that pending updater, the read threw on `null.panX`. The fix
  // captures `dragRef.current` into a local const *once*, synchronously, and
  // that captured object — never a fresh `dragRef.current` re-read — is what
  // every closure in this handler (including deferred setState updaters)
  // uses from then on.
  const endDrag = useCallback(() => {
    const dragState = dragRef.current;
    dragRef.current = null;
    if (!tools || !dragState) return;
    if (dragState.mode === "vertex") tools.endWallVertexDrag({ zoomScale: view.zoomScale });
    else if (dragState.mode === "opening") tools.endOpeningDrag();
  }, [tools, view.zoomScale]);

  // Ending a drag whenever the active tool changes, the calibration dialog
  // opens, the page is switched, or the page rotates — even though none of
  // these can normally happen mid-drag through this app's own UI — is a
  // cheap, explicit safety net per spec rather than relying on that
  // assumption holding forever (a stale dragRef.panX/panY captured before a
  // rotation's re-fit would otherwise apply against the new view and jump).
  useEffect(() => {
    endDrag();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tools?.activeTool, Boolean(tools?.calibrationDialog), page?.id, page?.rotation]);

  // Window blur (switching apps/tabs mid-drag) and Escape both safely end an
  // active drag — belt-and-suspenders alongside pointer capture, and cleaned
  // up on unmount like every other global listener in this component.
  useEffect(() => {
    function onBlur() { endDrag(); }
    function onKeyDown(event) { if (event.key === "Escape") endDrag(); }
    window.addEventListener("blur", onBlur);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [endDrag]);

  useEffect(() => () => endDrag(), [endDrag]);

  const handlePointerDown = useCallback((event) => {
    containerRef.current?.setPointerCapture?.(event.pointerId);
    const tool = tools?.activeTool || "select";
    if (tool !== "select" && tool !== "pan" && tools) {
      const pagePoint = eventToPagePoint(event);
      if (tool === "edit-walls" && pagePoint) {
        const hit = tools.findWallVertexNear(pagePoint, { zoomScale: view.zoomScale });
        if (hit) {
          tools.beginWallVertexDrag(hit.id);
          dragRef.current = { mode: "vertex", startX: event.clientX, startY: event.clientY };
          return;
        }
      }
      if (tool === "edit" && pagePoint) {
        const vertexHit = tools.findWallVertexNearAny(pagePoint, { zoomScale: view.zoomScale });
        if (vertexHit) {
          tools.beginWallVertexDrag(vertexHit.vertex.id, vertexHit.field);
          dragRef.current = { mode: "vertex", startX: event.clientX, startY: event.clientY };
          return;
        }
        const openingHit = tools.findOpeningHandleNear(pagePoint, { zoomScale: view.zoomScale });
        if (openingHit) {
          tools.beginOpeningDrag(openingHit.openingId, openingHit.handle);
          dragRef.current = { mode: "opening", startX: event.clientX, startY: event.clientY };
          return;
        }
      }
      dragRef.current = {
        mode: "click-or-pan",
        startX: event.clientX, startY: event.clientY,
        panX: view.panX, panY: view.panY,
        pagePoint,
      };
      return;
    }
    dragRef.current = { mode: "pan", startX: event.clientX, startY: event.clientY, panX: view.panX, panY: view.panY };
  }, [view.panX, view.panY, view.zoomScale, tools, eventToPagePoint]);

  const handlePointerMove = useCallback((event) => {
    if (tools) {
      const pagePoint = eventToPagePoint(event);
      if (pagePoint) {
        const activeTool = tools.activeTool;
        if (activeTool === "set-scale" || activeTool === "measure") {
          // Axis-lock + snapping is mandatory here (see useTakeoffTools.js) —
          // Shift is deliberately not used to escape it for these two tools,
          // per spec ("free diagonal scale lines must not be allowed").
          tools.updatePointerHover(pagePoint, { rotation: page?.rotation ?? 0, zoomScale: view.zoomScale });
        } else if (WALL_DRAW_TOOLS.includes(activeTool)) {
          tools.updateWallDrawHover(pagePoint, { rotation: page?.rotation ?? 0, zoomScale: view.zoomScale });
        } else if (OPENING_TOOLS.includes(activeTool)) {
          tools.updateOpeningHover(pagePoint, { zoomScale: view.zoomScale });
        } else if (activeTool === "area") {
          tools.updateAreaHover(pagePoint, { zoomScale: view.zoomScale });
        } else if (activeTool === "plan-region") {
          tools.updatePlanRegionHover(pagePoint);
        } else {
          let constrained = pagePoint;
          if (event.shiftKey && activeTool === "edit-walls" && tools.selectedVertexId) {
            const anchor = page?.exteriorWalls?.vertices.find((v) => v.id === tools.selectedVertexId) || null;
            if (anchor) constrained = constrainToAxis(anchor, pagePoint, view);
          }
          tools.setHoverPoint(constrained);
        }
      }
    }

    // Captured once, synchronously — see the crash-fix note above. Every
    // reference below (including inside the deferred setView updater) uses
    // this local snapshot, never a second live read of dragRef.current.
    const dragState = dragRef.current;
    if (!dragState) return;

    if (dragState.mode === "vertex") {
      const pagePoint = eventToPagePoint(event);
      if (pagePoint) tools.updateWallVertexDrag(pagePoint, { zoomScale: view.zoomScale });
      return;
    }

    if (dragState.mode === "opening") {
      const pagePoint = eventToPagePoint(event);
      if (pagePoint) tools.updateOpeningDrag(pagePoint);
      return;
    }

    const dx = event.clientX - dragState.startX;
    const dy = event.clientY - dragState.startY;
    setView((prev) => ({ ...prev, panX: dragState.panX + dx, panY: dragState.panY + dy }));
  }, [tools, eventToPagePoint, view, page]);

  const handlePointerUp = useCallback((event) => {
    containerRef.current?.releasePointerCapture?.(event.pointerId);
    const dragState = dragRef.current;
    dragRef.current = null;
    if (!dragState) return;

    if (dragState.mode === "vertex") {
      tools.endWallVertexDrag({ zoomScale: view.zoomScale });
      return;
    }

    if (dragState.mode === "opening") {
      tools.endOpeningDrag();
      return;
    }

    if (dragState.mode === "click-or-pan" && tools && dragState.pagePoint) {
      const dx = event.clientX - dragState.startX;
      const dy = event.clientY - dragState.startY;
      if (Math.sqrt(dx * dx + dy * dy) < CLICK_THRESHOLD_PX) {
        const tool = tools.activeTool;
        if (tool === "set-scale" || tool === "measure") {
          tools.placePointerPoint(dragState.pagePoint, { rotation: page?.rotation ?? 0, zoomScale: view.zoomScale });
        } else if (tool === "edit-walls") {
          tools.handleWallCanvasClick(dragState.pagePoint, { zoomScale: view.zoomScale });
        } else if (tool === "edit") {
          tools.handleEditToolClick(dragState.pagePoint, { zoomScale: view.zoomScale });
        } else if (WALL_DRAW_TOOLS.includes(tool)) {
          tools.handleWallDrawClick(dragState.pagePoint, { rotation: page?.rotation ?? 0, zoomScale: view.zoomScale });
        } else if (OPENING_TOOLS.includes(tool)) {
          tools.handleOpeningCanvasClick(dragState.pagePoint, { zoomScale: view.zoomScale });
        } else if (tool === "area") {
          tools.handleAreaCanvasClick(dragState.pagePoint, { zoomScale: view.zoomScale });
        } else if (tool === "plan-region") {
          tools.handlePlanRegionClick(dragState.pagePoint);
        }
      }
    }
  }, [tools, view.zoomScale, page]);

  // Double-click finishes an in-progress manual wall-drawing run — the
  // alternative to the toolbar's Finish button, per spec.
  const handleDoubleClick = useCallback(() => {
    if (tools && WALL_DRAW_TOOLS.includes(tools.activeTool)) {
      tools.finishWallDrawing();
    }
  }, [tools]);

  // pointercancel (browser revokes the gesture — e.g. a touch turns into a
  // scroll, or the OS interrupts it) and lostpointercapture (capture is
  // released for any reason, including programmatically above) both just
  // end the drag with no click/pan side effects — there's no valid gesture
  // left to interpret.
  const handlePointerCancel = useCallback(() => { endDrag(); }, [endDrag]);

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
        <span style={S.divider} />
        <button
          type="button"
          style={S.button}
          onClick={onRedetectOrientation}
          disabled={redetecting}
          data-testid="redetect-orientation-button"
        >
          {redetecting ? "Detecting..." : "Re-detect Orientation"}
        </button>
        <span style={S.rotationLabel} data-testid="current-rotation">{page?.rotation ?? 0}&deg;</span>
      </div>

      {status && <div style={S.status}>{status}</div>}

      <div
        ref={containerRef}
        style={S.viewport}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onLostPointerCapture={handlePointerCancel}
        onDoubleClick={handleDoubleClick}
        data-testid="plan-viewport"
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: view.viewport ? `${view.viewport.width}px` : undefined,
            height: view.viewport ? `${view.viewport.height}px` : undefined,
            transform: `translate(${view.panX}px, ${view.panY}px) scale(${view.zoomScale})`,
            transformOrigin: "0 0",
          }}
        >
          <canvas
            ref={canvasARef}
            data-testid={activeCanvas === "a" ? "plan-canvas" : "plan-canvas-buffer"}
            data-active-canvas={activeCanvas === "a" ? "true" : "false"}
            style={{ ...S.canvasLayer, opacity: activeCanvas === "a" ? 1 : 0 }}
          />
          <canvas
            ref={canvasBRef}
            data-testid={activeCanvas === "b" ? "plan-canvas" : "plan-canvas-buffer"}
            data-active-canvas={activeCanvas === "b" ? "true" : "false"}
            style={{ ...S.canvasLayer, opacity: activeCanvas === "b" ? 1 : 0 }}
          />
          {tools && view.viewport && (
            <TakeoffCanvasOverlay
              page={page}
              tools={tools}
              viewport={view.viewport}
              planGeometryIndex={planGeometryIndex}
              sourceCanvas={activeCanvas === "a" ? canvasARef.current : canvasBRef.current}
            />
          )}
        </div>
        {tools && (tools.activeTool === "edit-walls" || tools.activeTool === "edit") && (
          <WallContextPanel page={page} tools={tools} />
        )}
      </div>
    </div>
  );
});

export default PlanViewer;

const S = {
  wrap: { display: "flex", flexDirection: "column", height: "100%" },
  toolbar: { display: "flex", alignItems: "center", gap: 6, padding: 8, borderBottom: "1px solid #e2e8f0", background: "#f8fafc" },
  button: { border: "1px solid #cbd5e1", background: "#fff", color: "#334155", borderRadius: 6, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" },
  divider: { width: 1, alignSelf: "stretch", background: "#e2e8f0", margin: "0 4px" },
  rotationLabel: { marginLeft: "auto", fontSize: 12, fontWeight: 800, color: "#1d4ed8" },
  status: { padding: "4px 8px", fontSize: 12, color: "#b91c1c" },
  viewport: { position: "relative", flex: 1, overflow: "hidden", background: "#e2e8f0", cursor: "grab" },
  canvasLayer: { position: "absolute", left: 0, top: 0, transition: "opacity 80ms linear", background: "#ffffff" },
};
