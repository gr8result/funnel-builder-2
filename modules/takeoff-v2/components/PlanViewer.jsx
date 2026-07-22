import { useCallback, useEffect, useRef, useState } from "react";
import { computeFitScale, createPageRenderer } from "../viewer/PdfViewport.js";

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 8;

export default function PlanViewer({ pdfDocument, page, onRotateLeft, onRotateRight, onResetRotation }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const dragRef = useRef(null);

  const [view, setView] = useState({ viewport: null, zoomScale: 1, panX: 0, panY: 0 });
  const [status, setStatus] = useState("");

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
      const { viewport } = await rendererRef.current.render({
        pdfDocument,
        pageNumber: page.pageNumber,
        rotation: page.rotation,
        scale: fitScale,
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
    dragRef.current = { startX: event.clientX, startY: event.clientY, panX: view.panX, panY: view.panY };
  }, [view.panX, view.panY]);

  const handleMouseMove = useCallback((event) => {
    if (!dragRef.current) return;
    const dx = event.clientX - dragRef.current.startX;
    const dy = event.clientY - dragRef.current.startY;
    setView((prev) => ({ ...prev, panX: dragRef.current.panX + dx, panY: dragRef.current.panY + dy }));
  }, []);

  const handleMouseUp = useCallback(() => { dragRef.current = null; }, []);

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
        style={S.viewport}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
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
