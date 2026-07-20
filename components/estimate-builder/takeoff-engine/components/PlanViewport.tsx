import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getPdfDocument } from "../rendering/PdfRenderer";
import OverlayRenderer from "../rendering/OverlayRenderer";
import { fitPage, fitWidth, panViewport } from "../rendering/ViewportController";
import type { TakeoffDocument, TakeoffObject, TakeoffPage, ViewportState } from "../state/takeoffTypes";
import { getRelativePoint } from "../interactions/PointerController";
import { isPanGesture } from "../interactions/PanController";
import { zoomViewportFromWheel } from "../interactions/ZoomController";
import { screenToPlan } from "../rendering/CoordinateTransform";

type ScaleDraft = {
  start: { x: number; y: number } | null;
  end: { x: number; y: number } | null;
  liveEnd: { x: number; y: number } | null;
};

export default function PlanViewport({
  document,
  page,
  viewport,
  activeTool,
  fitRequest,
  onViewportChange,
  onViewportCommit,
  selectedObjectId,
  draftPoints = [],
  scaleDraft,
  onPlanPointer,
  onPlanMove,
  onScaleHandleDrag,
  onSelectObject,
}: {
  document: TakeoffDocument;
  page: TakeoffPage | null;
  viewport: ViewportState;
  activeTool: string;
  fitRequest: { mode: "page" | "width" | "preset"; key: number; scale?: number };
  onViewportChange: (viewport: ViewportState) => void;
  onViewportCommit: (viewport: ViewportState) => void;
  selectedObjectId?: string | null;
  draftPoints?: Array<{ x: number; y: number }>;
  scaleDraft?: ScaleDraft;
  onPlanPointer?: (point: { x: number; y: number }, shiftKey?: boolean) => void;
  onPlanMove?: (point: { x: number; y: number }, shiftKey?: boolean) => void;
  onScaleHandleDrag?: (handle: "start" | "end", point: { x: number; y: number }, shiftKey?: boolean) => void;
  onSelectObject?: (objectId: string | null) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef(viewport);
  const dragRef = useRef<{ active: boolean; pointerId: number; x: number; y: number }>({ active: false, pointerId: -1, x: 0, y: 0 });
  const handleDragRef = useRef<{ active: boolean; pointerId: number; handle: "start" | "end" | null }>({ active: false, pointerId: -1, handle: null });
  const rafRef = useRef<number | null>(null);
  const settleRef = useRef<number | null>(null);
  const renderTaskRef = useRef<any>(null);
  const latestRenderIdRef = useRef(0);
  const [renderScale, setRenderScale] = useState(1);
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [renderRetryKey, setRenderRetryKey] = useState(0);
  const [spacePressed, setSpacePressed] = useState(false);
  const [snapMarker, setSnapMarker] = useState<{ x: number; y: number } | null>(null);

  viewportRef.current = viewport;

  const pageSize = useMemo(() => ({
    width: Math.max(1, page?.renderedWidth || 1),
    height: Math.max(1, page?.renderedHeight || 1),
  }), [page?.renderedWidth, page?.renderedHeight]);

  const scheduleViewport = useCallback((next: ViewportState, commit = false) => {
    viewportRef.current = next;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => onViewportChange(next));
    if (settleRef.current) window.clearTimeout(settleRef.current);
    settleRef.current = window.setTimeout(() => {
      onViewportCommit(viewportRef.current);
      setRenderScale(Math.min(3, Math.max(1, viewportRef.current.scale * window.devicePixelRatio)));
    }, commit ? 0 : 220);
  }, [onViewportChange, onViewportCommit]);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (settleRef.current) window.clearTimeout(settleRef.current);
    renderTaskRef.current?.cancel?.();
    renderTaskRef.current = null;
  }, []);

  useEffect(() => {
    if (!page || !canvasRef.current) return;
    let effectCancelled = false;
    const canvas = canvasRef.current;
    const renderId = ++latestRenderIdRef.current;

    renderTaskRef.current?.cancel?.();
    renderTaskRef.current = null;

    setRendering(true);
    setRenderError(null);

    getPdfDocument(document)
      .then(async (pdf) => {
        if (effectCancelled || renderId !== latestRenderIdRef.current) return;
        const pdfPage = await pdf.getPage(page.pageNumber);
        if (effectCancelled || renderId !== latestRenderIdRef.current) return;
        const viewport = pdfPage.getViewport({
          scale: renderScale,
          rotation: page.finalRotation,
        });
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("Canvas rendering is unavailable.");

        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        canvas.style.width = `${Math.ceil(viewport.width / renderScale)}px`;
        canvas.style.height = `${Math.ceil(viewport.height / renderScale)}px`;
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);

        const task = pdfPage.render({ canvasContext: context, viewport });
        renderTaskRef.current = task;
        try {
          await task.promise;
        } catch (error: any) {
          if (error?.name !== "RenderingCancelledException") {
            throw error;
          }
        } finally {
          if (renderTaskRef.current === task) {
            renderTaskRef.current = null;
          }
        }

        if (renderId !== latestRenderIdRef.current) return;
      })
      .catch((error) => {
        if (error?.name !== "RenderingCancelledException") {
          console.error("[takeoff-engine] PDF render failed", error);
          setRenderError(error instanceof Error ? error.message : String(error));
        }
      })
      .finally(() => {
        if (!effectCancelled && renderId === latestRenderIdRef.current) setRendering(false);
      });

    return () => {
      effectCancelled = true;
      renderTaskRef.current?.cancel?.();
      renderTaskRef.current = null;
    };
  }, [document.id, page?.id, page?.finalRotation, renderScale, renderRetryKey]);

  useEffect(() => {
    const element = hostRef.current;
    if (!element) return undefined;
    function handleNativeWheel(event: WheelEvent) {
      if (!page) return;
      event.preventDefault();
      const point = getRelativePoint(event, element);
      scheduleViewport(zoomViewportFromWheel(viewportRef.current, point, event.deltaY));
    }
    element.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => {
      element.removeEventListener("wheel", handleNativeWheel);
    };
  }, [page, scheduleViewport]);

  useEffect(() => {
    if (!page || !hostRef.current || fitRequest.key === 0) return;
    const rect = hostRef.current.getBoundingClientRect();
    if (fitRequest.mode === "width") {
      scheduleViewport(fitWidth({ width: rect.width, height: rect.height }, pageSize), true);
      return;
    }
    if (fitRequest.mode === "preset") {
      scheduleViewport({
        scale: fitRequest.scale || 1,
        offsetX: (rect.width - pageSize.width * (fitRequest.scale || 1)) / 2,
        offsetY: (rect.height - pageSize.height * (fitRequest.scale || 1)) / 2,
      }, true);
      return;
    }
    scheduleViewport(fitPage({ width: rect.width, height: rect.height }, pageSize), true);
  }, [fitRequest.key, fitRequest.mode, fitRequest.scale, page, pageSize, scheduleViewport]);

  useEffect(() => {
    if (!page || page.viewport || !hostRef.current) return;
    const rect = hostRef.current.getBoundingClientRect();
    scheduleViewport(fitPage({ width: rect.width, height: rect.height }, pageSize), true);
  }, [page?.id]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        setSpacePressed(true);
        event.preventDefault();
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") setSpacePressed(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!hostRef.current || !page || !isPanGesture(event, activeTool, spacePressed)) return;
    event.preventDefault();
    hostRef.current.setPointerCapture(event.pointerId);
    dragRef.current = { active: true, pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const handleDrag = handleDragRef.current;
    if (handleDrag.active && handleDrag.pointerId === event.pointerId && handleDrag.handle && hostRef.current) {
      event.preventDefault();
      const point = snapToKnownPoint(screenToPlan(getRelativePoint(event, hostRef.current), viewportRef.current), page, 12 / Math.max(0.1, viewportRef.current.scale));
      onScaleHandleDrag?.(handleDrag.handle, point, event.shiftKey);
      return;
    }
    const drag = dragRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const deltaX = event.clientX - drag.x;
    const deltaY = event.clientY - drag.y;
    dragRef.current = { ...drag, x: event.clientX, y: event.clientY };
    scheduleViewport(panViewport(viewportRef.current, deltaX, deltaY));
  }

  function finishPan(event: React.PointerEvent<HTMLDivElement>) {
    if (handleDragRef.current.pointerId === event.pointerId) {
      handleDragRef.current = { active: false, pointerId: -1, handle: null };
      return;
    }
    const drag = dragRef.current;
    if (drag.pointerId === event.pointerId) {
      dragRef.current = { active: false, pointerId: -1, x: 0, y: 0 };
      onViewportCommit(viewportRef.current);
    }
  }

  function objectAtPlanPoint(point: { x: number; y: number }) {
    const tolerance = 10 / Math.max(0.1, viewportRef.current.scale);
    return [...(page?.objects || [])].reverse().find((object) => {
      if (object.status === "rejected") return false;
      if (object.source === "ai" && !page?.aiDetectionRun) return false;
      if (object.source !== "ai" && page?.scaleStatus !== "confirmed") return false;
      return hitObject(object, point, tolerance);
    }) || null;
  }

  function handleInteractionClick(event: React.PointerEvent<HTMLDivElement>) {
    if (!hostRef.current || !page || dragRef.current.active) return;
    if (handleDragRef.current.active) return;
    if (activeTool === "pan") return;
    const screen = getRelativePoint(event, hostRef.current);
    const planPoint = snapToKnownPoint(screenToPlan(screen, viewportRef.current), page, 12 / Math.max(0.1, viewportRef.current.scale));
    if (activeTool === "select") {
      onSelectObject?.(objectAtPlanPoint(planPoint)?.id || null);
      return;
    }
    onPlanPointer?.(planPoint, event.shiftKey);
  }

  function handleInteractionMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!hostRef.current || !page) return;
    const screen = getRelativePoint(event, hostRef.current);
    const point = screenToPlan(screen, viewportRef.current);
    const snapped = snapToKnownPoint(point, page, 12 / Math.max(0.1, viewportRef.current.scale));
    setSnapMarker(snapped.x !== point.x || snapped.y !== point.y ? snapped : null);
    onPlanMove?.(snapped, event.shiftKey);
  }

  function handleInteractionDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!hostRef.current || !page || activeTool !== "scale" || !scaleDraft?.start) return;
    const point = screenToPlan(getRelativePoint(event, hostRef.current), viewportRef.current);
    const tolerance = 10 / Math.max(0.1, viewportRef.current.scale);
    const end = scaleDraft.end || scaleDraft.liveEnd;
    const startDistance = Math.hypot(point.x - scaleDraft.start.x, point.y - scaleDraft.start.y);
    const endDistance = end ? Math.hypot(point.x - end.x, point.y - end.y) : Number.POSITIVE_INFINITY;
    const handle = startDistance <= tolerance ? "start" : endDistance <= tolerance ? "end" : null;
    if (!handle) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    handleDragRef.current = { active: true, pointerId: event.pointerId, handle };
  }

  if (!page) {
    return <div ref={hostRef} style={styles.empty}>Upload a PDF plan</div>;
  }

  return (
    <div
      ref={hostRef}
      style={{ ...styles.host, cursor: activeTool === "scale" ? "crosshair" : activeTool === "pan" || spacePressed ? "grab" : "default" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPan}
      onPointerCancel={finishPan}
      data-takeoff-engine-canvas
    >
      <div
        style={{
          ...styles.plan,
          width: pageSize.width,
          height: pageSize.height,
          transform: `translate3d(${viewport.offsetX}px, ${viewport.offsetY}px, 0) scale(${viewport.scale})`,
        }}
      >
        <canvas ref={canvasRef} style={styles.canvas} />
        <div style={styles.aiLayer}><OverlayRenderer page={page} selectedObjectId={selectedObjectId} showAiObjects={Boolean(page.aiDetectionRun && page.scaleStatus === "confirmed")} /></div>
        <svg style={styles.draftLayer} aria-hidden="true">
          <ScaleLineOverlay page={page} scaleDraft={scaleDraft} />
          {draftPoints.length >= 2 ? (
            <polyline
              points={draftPoints.map((point) => `${point.x},${point.y}`).join(" ")}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2.5"
              strokeDasharray="7 5"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
          {draftPoints.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r={4} fill="#f59e0b" vectorEffect="non-scaling-stroke" />)}
          {snapMarker ? <circle cx={snapMarker.x} cy={snapMarker.y} r={7} fill="none" stroke="#22c55e" strokeWidth={2} vectorEffect="non-scaling-stroke" /> : null}
        </svg>
        <div style={styles.manualLayer} />
        <div style={styles.measurementLayer} />
        <div style={styles.handlesLayer} />
        <div
          style={styles.pointerLayer}
          onPointerDown={handleInteractionDown}
          onPointerUp={handleInteractionClick}
          onPointerMove={handleInteractionMove}
          onPointerLeave={() => setSnapMarker(null)}
        />
      </div>
      {rendering ? <div style={styles.rendering}>Rendering sharp PDF</div> : null}
      {renderError ? (
        <div style={styles.renderError} role="alert">
          <strong>PDF render failed</strong>
          <span>{renderError}</span>
          <button type="button" style={styles.retryButton} onClick={() => setRenderRetryKey((current) => current + 1)}>Retry</button>
        </div>
      ) : null}
      <div style={styles.readout}>Page {page.pageNumber} | Rotation {page.finalRotation} | {Math.round(viewport.scale * 100)}%</div>
    </div>
  );
}

function ScaleLineOverlay({ page, scaleDraft }: { page: TakeoffPage; scaleDraft?: ScaleDraft }) {
  const confirmed = page.showCalibrationLine && page.calibrationLine ? page.calibrationLine : null;
  const start = scaleDraft?.start || confirmed?.start || null;
  const end = scaleDraft?.end || scaleDraft?.liveEnd || confirmed?.end || null;
  if (!start) return null;
  const distance = end ? Math.hypot(end.x - start.x, end.y - start.y) : 0;
  return (
    <g>
      {end ? (
        <>
          <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="#dc2626" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
          <text x={(start.x + end.x) / 2 + 8} y={(start.y + end.y) / 2 - 8} fill="#991b1b" fontSize="12" fontWeight="800" vectorEffect="non-scaling-stroke">
            {distance.toFixed(1)} plan units
          </text>
        </>
      ) : null}
      <circle cx={start.x} cy={start.y} r={5} fill="#dc2626" stroke="#ffffff" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      {end ? <circle cx={end.x} cy={end.y} r={5} fill="#dc2626" stroke="#ffffff" strokeWidth={2} vectorEffect="non-scaling-stroke" /> : null}
    </g>
  );
}

function distanceToSegment(point: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

function hitObject(object: TakeoffObject, point: { x: number; y: number }, tolerance: number) {
  const points = object.points || [];
  if (object.type === "room" || object.type === "column") {
    return pointInPolygon(point, points) || points.some((item) => Math.hypot(item.x - point.x, item.y - point.y) <= tolerance);
  }
  for (let index = 1; index < points.length; index += 1) {
    if (distanceToSegment(point, points[index - 1], points[index]) <= tolerance) return true;
  }
  return points.some((item) => Math.hypot(item.x - point.x, item.y - point.y) <= tolerance);
}

function pointInPolygon(point: { x: number; y: number }, polygon: Array<{ x: number; y: number }>) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const pi = polygon[i];
    const pj = polygon[j];
    if (((pi.y > point.y) !== (pj.y > point.y)) && point.x < ((pj.x - pi.x) * (point.y - pi.y)) / ((pj.y - pi.y) || 1) + pi.x) {
      inside = !inside;
    }
  }
  return inside;
}

function snapToKnownPoint(point: { x: number; y: number }, page: TakeoffPage, tolerance: number) {
  const candidates = [
    ...(page.objects || []).flatMap((object) => object.points || []),
    ...(page.vectorPaths || []).flatMap((path) => path.points || []),
    ...lineIntersections(page.vectorPaths || []),
  ];
  let best = point;
  let bestDistance = tolerance;
  for (const candidate of candidates) {
    const distance = Math.hypot(candidate.x - point.x, candidate.y - point.y);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

function lineIntersections(paths: TakeoffPage["vectorPaths"]) {
  const lines = paths.filter((path) => path.points?.length >= 2).slice(0, 500);
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < lines.length; i += 1) {
    for (let j = i + 1; j < lines.length; j += 1) {
      const point = intersectSegments(lines[i].points[0], lines[i].points[1], lines[j].points[0], lines[j].points[1]);
      if (point) points.push(point);
      if (points.length > 1000) return points;
    }
  }
  return points;
}

function intersectSegments(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }, d: { x: number; y: number }) {
  const denominator = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
  if (Math.abs(denominator) < 0.0001) return null;
  const x = ((a.x * b.y - a.y * b.x) * (c.x - d.x) - (a.x - b.x) * (c.x * d.y - c.y * d.x)) / denominator;
  const y = ((a.x * b.y - a.y * b.x) * (c.y - d.y) - (a.y - b.y) * (c.x * d.y - c.y * d.x)) / denominator;
  const within = (value: number, p: number, q: number) => value >= Math.min(p, q) - 0.5 && value <= Math.max(p, q) + 0.5;
  return within(x, a.x, b.x) && within(y, a.y, b.y) && within(x, c.x, d.x) && within(y, c.y, d.y) ? { x, y } : null;
}

const sharedLayer: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
};

const styles: Record<string, React.CSSProperties> = {
  host: {
    position: "relative",
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden",
    background: "#e5e7eb",
    touchAction: "none",
    userSelect: "none",
  },
  plan: {
    position: "absolute",
    left: 0,
    top: 0,
    transformOrigin: "0 0",
    background: "#ffffff",
    boxShadow: "0 8px 26px rgba(15, 23, 42, 0.18)",
    willChange: "transform",
  },
  canvas: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    display: "block",
    background: "#ffffff",
  },
  aiLayer: sharedLayer,
  manualLayer: sharedLayer,
  draftLayer: sharedLayer,
  measurementLayer: sharedLayer,
  handlesLayer: sharedLayer,
  pointerLayer: {
    ...sharedLayer,
    pointerEvents: "auto",
  },
  rendering: {
    position: "absolute",
    right: 10,
    top: 10,
    border: "1px solid #bfdbfe",
    borderRadius: 6,
    background: "#eff6ff",
    color: "#1e3a8a",
    padding: "5px 8px",
    fontSize: 12,
    fontWeight: 900,
  },
  renderError: {
    position: "absolute",
    left: 10,
    right: 10,
    top: 10,
    display: "grid",
    gap: 6,
    maxWidth: 520,
    border: "1px solid #fecaca",
    borderRadius: 6,
    background: "#fff7f7",
    color: "#7f1d1d",
    padding: 10,
    fontSize: 12,
    fontWeight: 800,
    zIndex: 30,
  },
  retryButton: {
    justifySelf: "start",
    border: "1px solid #0f766e",
    borderRadius: 6,
    background: "#0f766e",
    color: "#ffffff",
    padding: "6px 8px",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
  readout: {
    position: "absolute",
    left: 10,
    bottom: 10,
    borderRadius: 6,
    background: "rgba(15, 23, 42, 0.86)",
    color: "#ffffff",
    padding: "5px 8px",
    fontSize: 12,
    fontWeight: 800,
  },
  empty: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 480,
    color: "#475569",
    background: "#f1f5f9",
    fontWeight: 800,
  },
};
