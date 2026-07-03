// PlanCanvas.jsx
// Deterministic PDF-canvas takeoff viewer. The only drawing coordinate space is
// the rendered plan image coordinate space.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  TOOLS,
  OT,
  STYLE,
  POLYLINE_TOOLS,
  SEGMENT_TOOLS,
  POLYGON_TOOLS,
  MARKER_TOOLS,
  TWO_POINT_TOOLS,
  createOverlay,
} from "./takeoffTypes";
import {
  dist,
  polyLen,
  polyArea,
  centroid,
  circleArea,
  rectCorners,
  pxToM,
  pxToM2,
  fmtM,
  fmtM2,
  getPixelsPerUnit,
} from "./takeoffUtils";
import { screenPointFromEvent, screenToDocument, documentToScreen } from "./planCoordinateUtils";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10;
const CLOSE_RADIUS_SCREEN_PX = 14;
const WHEEL_ZOOM_SPEED = 0.0011;
const VIEW_STATE_SAVE_DELAY_MS = 220;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function segDist(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (!lenSq) return dist(p, a);
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq, 0, 1);
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy });
}

function ptInPoly(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    if (((yi > pt.y) !== (yj > pt.y)) && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function hitOverlay(pt, ov, threshold) {
  const pts = ov.points || [];
  if (!pts.length) return false;

  if (ov.type === OT.DOOR || ov.type === OT.WINDOW || ov.type === OT.COLUMN) {
    return dist(pt, pts[0]) <= threshold;
  }
  if (ov.type === OT.CIRCLE) {
    if (pts.length < 2) return false;
    return Math.abs(dist(pt, pts[0]) - dist(pts[0], pts[1])) <= threshold;
  }
  if (ov.type === OT.ROOM || ov.type === OT.AREA || ov.type === OT.RECTANGLE) {
    if (ptInPoly(pt, pts)) return true;
    for (let i = 0; i < pts.length; i += 1) {
      if (segDist(pt, pts[i], pts[(i + 1) % pts.length]) <= threshold) return true;
    }
    return false;
  }
  for (let i = 1; i < pts.length; i += 1) {
    if (segDist(pt, pts[i - 1], pts[i]) <= threshold) return true;
  }
  return false;
}

function overlayLabel(ov, ppm) {
  const pts = ov.points || [];
  if (!pts.length) return "";

  if ([OT.EXTERNAL_WALL, OT.INTERNAL_WALL, OT.POLYLINE, OT.MEASURE].includes(ov.type)) {
    return fmtM(pxToM(polyLen(pts), ppm));
  }
  if ([OT.ROOM, OT.AREA, OT.RECTANGLE].includes(ov.type)) {
    return fmtM2(pxToM2(polyArea(pts), ppm));
  }
  if (ov.type === OT.CIRCLE && pts.length >= 2) {
    return fmtM2(pxToM2(circleArea(pts[0], pts[1]), ppm));
  }
  return "";
}

function labelPoint(ov) {
  const pts = ov.points || [];
  if (!pts.length) return { x: 0, y: 0 };
  if (ov.type === OT.CIRCLE) return pts[0];
  return centroid(pts);
}

export default function PlanCanvas({
  page,
  tool,
  overlays = [],
  selectedId,
  calibrating,
  onAddOverlay,
  onDeleteOverlay,
  onSelectOverlay,
  onCalibrationPoint,
  onRotateLeft,
  onRotateRight,
  onResetRotation,
  zoom: externalZoom = 1,
  setZoom: setExternalZoom,
  viewState,
  onViewStateChange,
}) {
  const rootRef = useRef(null);
  const drawRef = useRef(null);
  const panDragRef = useRef(null);
  const spaceRef = useRef(false);
  const shiftRef = useRef(false);
  const zoomRef = useRef(clamp(Number(externalZoom) || 1, MIN_ZOOM, MAX_ZOOM));
  const panRef = useRef({ x: 32, y: 32 });
  const viewStateSaveTimerRef = useRef(null);
  const wallSnapCanvasRef = useRef(null);
  const [drawState, setDrawState] = useState(null);
  const [cursorPt, setCursorPt] = useState(null);
  const [snapMarker, setSnapMarker] = useState(null);
  const [zoom, setZoomState] = useState(() => clamp(Number(externalZoom) || 1, MIN_ZOOM, MAX_ZOOM));
  const [pan, setPan] = useState({ x: 32, y: 32 });
  const [isPanning, setIsPanning] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);

  const W = page?.naturalWidth || 1200;
  const H = page?.naturalHeight || 900;
  const ppm = getPixelsPerUnit(page?.scale);
  const needsScale = !ppm && ![TOOLS.POINTER, TOOLS.PAN, TOOLS.DOOR, TOOLS.WINDOW, TOOLS.COLUMN, TOOLS.DELETE].includes(tool);

  const setZoom = useCallback((nextZoom) => {
    setZoomState((currentZoom) => {
      const rawZoom = typeof nextZoom === "function" ? nextZoom(currentZoom) : nextZoom;
      const clampedZoom = clamp(Number(rawZoom) || 1, MIN_ZOOM, MAX_ZOOM);
      zoomRef.current = clampedZoom;
      return clampedZoom;
    });
  }, []);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  const setDraw = useCallback((next) => {
    const value = typeof next === "function" ? next(drawRef.current) : next;
    drawRef.current = value;
    setDrawState(value);
  }, []);

  const getViewOrigin = useCallback(() => {
    const root = rootRef.current;
    if (!root) return { x: 0, y: 0 };
    const rect = root.getBoundingClientRect();
    return { x: rect.left, y: rect.top };
  }, []);

  const getDocumentView = useCallback(() => ({
    scale: zoom,
    pan,
    origin: getViewOrigin(),
  }), [getViewOrigin, pan, zoom]);

  const zoomToScreenPoint = useCallback((screenPoint, nextZoom) => {
    const documentPoint = screenToDocument(screenPoint, getDocumentView());
    const origin = getViewOrigin();
    const clampedZoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    setZoom(clampedZoom);
    setPan({
      x: screenPoint.x - origin.x - documentPoint.x * clampedZoom,
      y: screenPoint.y - origin.y - documentPoint.y * clampedZoom,
    });
  }, [getDocumentView, getViewOrigin, setZoom]);

  const zoomToViewportCentre = useCallback((nextZoom) => {
    const root = rootRef.current;
    if (!root) {
      setZoom(clamp(nextZoom, MIN_ZOOM, MAX_ZOOM));
      return;
    }
    const rect = root.getBoundingClientRect();
    zoomToScreenPoint({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    }, nextZoom);
  }, [setZoom, zoomToScreenPoint]);

  const fitToScreen = useCallback(() => {
    const root = rootRef.current;
    if (!root || !W || !H) return;
    const rect = root.getBoundingClientRect();
    const nextZoom = clamp(Math.min(rect.width / W, rect.height / H) * 0.94, MIN_ZOOM, MAX_ZOOM);
    setZoom(nextZoom);
    setPan({
      x: (rect.width - W * nextZoom) / 2,
      y: (rect.height - H * nextZoom) / 2,
    });
  }, [H, W, setZoom]);

  const fitToWidth = useCallback(() => {
    const root = rootRef.current;
    if (!root || !W) return;
    const rect = root.getBoundingClientRect();
    const nextZoom = clamp((rect.width * 0.94) / W, MIN_ZOOM, MAX_ZOOM);
    setZoom(nextZoom);
    setPan({
      x: (rect.width - W * nextZoom) / 2,
      y: 32,
    });
  }, [W, setZoom]);

  const toDocumentPoint = useCallback((event) => {
    const point = screenToDocument(screenPointFromEvent(event), getDocumentView());
    return {
      x: clamp(point.x, 0, W),
      y: clamp(point.y, 0, H),
    };
  }, [W, H, getDocumentView]);

  useEffect(() => {
    if (!page?.imageDataUrl) {
      wallSnapCanvasRef.current = null;
      return;
    }
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(image, 0, 0, W, H);
      wallSnapCanvasRef.current = canvas;
    };
    image.src = page.imageDataUrl;
  }, [H, W, page?.id, page?.imageDataUrl]);

  const findWallSnapPoint = useCallback((point, radiusScreenPx = 18) => {
    const canvas = wallSnapCanvasRef.current;
    if (!canvas || !point) return null;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    const radius = Math.max(3, Math.ceil(radiusScreenPx / Math.max(zoom, 0.1)));
    const sx = Math.max(0, Math.round(point.x - radius));
    const sy = Math.max(0, Math.round(point.y - radius));
    const sw = Math.min(radius * 2 + 1, canvas.width - sx);
    const sh = Math.min(radius * 2 + 1, canvas.height - sy);
    if (sw <= 0 || sh <= 0) return null;

    const data = ctx.getImageData(sx, sy, sw, sh).data;
    let best = null;
    let bestDistance = radius + 1;
    const isDark = (offset) => {
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const a = data[offset + 3];
      return a > 40 && (r + g + b) / 3 < 185;
    };

    for (let y = 0; y < sh; y += 1) {
      for (let x = 0; x < sw; x += 1) {
        const offset = (y * sw + x) * 4;
        if (!isDark(offset)) continue;
        const px = sx + x;
        const py = sy + y;
        const d = Math.sqrt((px - point.x) ** 2 + (py - point.y) ** 2);
        if (d < bestDistance) {
          bestDistance = d;
          best = { x: px, y: py, type: "wall-edge" };
        }
      }
    }

    if (!best) return null;
    const localX = Math.round(best.x - sx);
    const localY = Math.round(best.y - sy);
    let horizontalHits = 0;
    let verticalHits = 0;
    for (let i = -4; i <= 4; i += 1) {
      const hx = localX + i;
      const vy = localY + i;
      if (hx >= 0 && hx < sw && isDark((localY * sw + hx) * 4)) horizontalHits += 1;
      if (vy >= 0 && vy < sh && isDark((vy * sw + localX) * 4)) verticalHits += 1;
    }
    return {
      ...best,
      type: horizontalHits >= 3 && verticalHits >= 3 ? "wall-corner" : "wall-edge",
      label: horizontalHits >= 3 && verticalHits >= 3 ? "Corner" : "Wall edge",
    };
  }, [zoom]);

  const snapOrthogonalPoint = useCallback((start, point, { force = false, toleranceDeg = 5 } = {}) => {
    if (!start || !point) return point;
    const dx = point.x - start.x;
    const dy = point.y - start.y;
    if (!dx && !dy) return point;
    const angle = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
    const candidates = [0, 90, 180, 270];
    const nearest = candidates.reduce((best, candidate) => {
      const diff = Math.min(Math.abs(angle - candidate), 360 - Math.abs(angle - candidate));
      return diff < best.diff ? { angle: candidate, diff } : best;
    }, { angle: 0, diff: Infinity });

    if (!force && nearest.diff > toleranceDeg) return point;
    if (nearest.angle === 0 || nearest.angle === 180) return { x: point.x, y: start.y };
    return { x: start.x, y: point.y };
  }, []);

  const resolveSnapPoint = useCallback((rawPoint, options = {}) => {
    let point = rawPoint;
    let marker = null;
    const basePoint = options.basePoint || null;
    const forceOrthogonal = Boolean(options.forceOrthogonal);
    const nearOrthogonal = Boolean(options.nearOrthogonal);

    if (basePoint && (forceOrthogonal || nearOrthogonal)) {
      point = snapOrthogonalPoint(basePoint, point, { force: forceOrthogonal, toleranceDeg: 5 });
    }

    const wallSnap = findWallSnapPoint(point);
    if (wallSnap) {
      point = { x: wallSnap.x, y: wallSnap.y };
      marker = wallSnap;
      if (basePoint && (forceOrthogonal || nearOrthogonal)) {
        point = snapOrthogonalPoint(basePoint, point, { force: forceOrthogonal, toleranceDeg: 5 });
        marker = { ...marker, x: point.x, y: point.y };
      }
    }

    return { point: { x: clamp(point.x, 0, W), y: clamp(point.y, 0, H) }, marker };
  }, [H, W, findWallSnapPoint, snapOrthogonalPoint]);

  const finishDraw = useCallback(() => {
    const draw = drawRef.current;
    if (!draw) return;
    const points = draw.points || [];
    if (POLYLINE_TOOLS.has(draw.type) && points.length >= 2) {
      onAddOverlay?.(createOverlay({ type: draw.type, points }));
    }
    if (POLYGON_TOOLS.has(draw.type) && points.length >= 3) {
      onAddOverlay?.(createOverlay({ type: draw.type, points }));
    }
    setDraw(null);
    setCursorPt(null);
  }, [onAddOverlay, setDraw]);

  const cancelDraw = useCallback(() => {
    setDraw(null);
    setCursorPt(null);
    setSnapMarker(null);
  }, [setDraw]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) return;
      if (event.code === "Space") {
        event.preventDefault();
        spaceRef.current = true;
        setSpaceHeld(true);
      }
      if (event.key === "Shift") shiftRef.current = true;
      if (event.key === "Escape") cancelDraw();
      if (event.key === "Enter") finishDraw();
      if ((event.key === "Delete" || event.key === "Backspace") && selectedId && !drawRef.current) {
        onDeleteOverlay?.(selectedId);
      }
    };
    const onKeyUp = (event) => {
      if (event.code === "Space") {
        event.preventDefault();
        spaceRef.current = false;
        setSpaceHeld(false);
      }
      if (event.key === "Shift") shiftRef.current = false;
    };
    const onBlur = () => {
      spaceRef.current = false;
      shiftRef.current = false;
      setSpaceHeld(false);
      panDragRef.current = null;
      setIsPanning(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [cancelDraw, finishDraw, onDeleteOverlay, selectedId]);

  const handlePointerDown = useCallback((event) => {
    const shouldPan = tool === TOOLS.PAN || event.button === 1 || (event.button === 0 && spaceRef.current);

    if (shouldPan) {
      event.preventDefault();
      event.stopPropagation();
      const screenPoint = screenPointFromEvent(event);
      panDragRef.current = {
        x: screenPoint.x,
        y: screenPoint.y,
        panX: pan.x,
        panY: pan.y,
      };
      setIsPanning(true);
      if (event.pointerId != null && event.currentTarget.hasPointerCapture && !event.currentTarget.hasPointerCapture(event.pointerId)) {
        try {
          event.currentTarget.setPointerCapture?.(event.pointerId);
        } catch {
          // Some synthetic/mouse events do not have an active pointer to capture.
        }
      }
      return;
    }

    if (event.button !== 0) return;

    const pt = toDocumentPoint(event);
    if (!pt) return;

    if (calibrating) {
      const existingPoints = calibrating.points || [];
      const { point, marker } = resolveSnapPoint(pt, {
        basePoint: existingPoints[0] || null,
        forceOrthogonal: existingPoints.length >= 1 && shiftRef.current,
        nearOrthogonal: existingPoints.length >= 1,
      });
      setCursorPt(point);
      setSnapMarker(marker);
      onCalibrationPoint?.(point);
      return;
    }

    if (tool === TOOLS.DELETE) {
      const hit = [...overlays].reverse().find((ov) => hitOverlay(pt, ov, 12 / Math.max(zoom, 0.1)));
      if (hit) onDeleteOverlay?.(hit.id);
      return;
    }

    if (tool === TOOLS.POINTER || tool === TOOLS.PAN) {
      const hit = [...overlays].reverse().find((ov) => hitOverlay(pt, ov, 12 / Math.max(zoom, 0.1)));
      onSelectOverlay?.(hit?.id || null);
      return;
    }

    if (needsScale) return;

    if (MARKER_TOOLS.has(tool)) {
      const { point } = resolveSnapPoint(pt);
      onAddOverlay?.(createOverlay({ type: tool, points: [point] }));
      return;
    }

    if (SEGMENT_TOOLS.has(tool)) {
      const current = drawRef.current;
      const { point } = resolveSnapPoint(pt, {
        basePoint: current?.points?.[0] || null,
        forceOrthogonal: tool === TOOLS.MEASURE && shiftRef.current,
        nearOrthogonal: tool === TOOLS.MEASURE,
      });
      if (current?.type === tool && current.points.length === 1) {
        onAddOverlay?.(createOverlay({ type: tool, points: [current.points[0], point] }));
        setDraw(null);
        setCursorPt(null);
        setSnapMarker(null);
      } else {
        setDraw({ type: tool, points: [point] });
      }
      return;
    }

    if (TWO_POINT_TOOLS.has(tool)) {
      const current = drawRef.current;
      const { point } = resolveSnapPoint(pt);
      if (current?.type === tool && current.points.length === 1) {
        const points = tool === TOOLS.RECTANGLE ? rectCorners(current.points[0], point) : [current.points[0], point];
        onAddOverlay?.(createOverlay({ type: tool, points }));
        setDraw(null);
        setCursorPt(null);
        setSnapMarker(null);
      } else {
        setDraw({ type: tool, points: [point] });
      }
      return;
    }

    if (POLYLINE_TOOLS.has(tool) || POLYGON_TOOLS.has(tool)) {
      const current = drawRef.current;
      const { point } = resolveSnapPoint(pt);
      if (!current || current.type !== tool) {
        setDraw({ type: tool, points: [point] });
        return;
      }

      const closeRadius = CLOSE_RADIUS_SCREEN_PX / Math.max(zoom, 0.1);
      if (POLYGON_TOOLS.has(tool) && current.points.length >= 3 && dist(point, current.points[0]) <= closeRadius) {
        finishDraw();
        return;
      }
      setDraw({ type: tool, points: [...current.points, point] });
    }
  }, [
    calibrating,
    finishDraw,
    needsScale,
    onAddOverlay,
    onCalibrationPoint,
    onDeleteOverlay,
    onSelectOverlay,
    overlays,
    resolveSnapPoint,
    setDraw,
    toDocumentPoint,
    tool,
    zoom,
    pan,
  ]);

  const handlePointerMove = useCallback((event) => {
    if (panDragRef.current) {
      event.preventDefault();
      const start = panDragRef.current;
      const screenPoint = screenPointFromEvent(event);
      setPan({
        x: start.panX + screenPoint.x - start.x,
        y: start.panY + screenPoint.y - start.y,
      });
      return;
    }

    const pt = toDocumentPoint(event);
    if (!pt) return;
    const calibrationBase = calibrating?.points?.[0] || null;
    const draw = drawRef.current;
    const drawBase = draw?.points?.[0] || null;
    const shouldSnapMeasure = draw?.type === TOOLS.MEASURE;
    const { point, marker } = resolveSnapPoint(pt, {
      basePoint: calibrationBase || (shouldSnapMeasure ? drawBase : null),
      forceOrthogonal: (Boolean(calibrationBase) || shouldSnapMeasure) && shiftRef.current,
      nearOrthogonal: Boolean(calibrationBase) || shouldSnapMeasure,
    });
    setCursorPt(point);
    setSnapMarker(marker);
  }, [calibrating, resolveSnapPoint, toDocumentPoint]);

  const handlePointerUp = useCallback((event) => {
    if (!panDragRef.current) return;
    panDragRef.current = null;
    setIsPanning(false);
    if (event.pointerId != null && event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      try {
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      } catch {
        // Pointer capture may already be gone after aux/middle-button release.
      }
    }
  }, []);

  const handleDoubleClick = useCallback((event) => {
    event.preventDefault();
    if (drawRef.current && (POLYLINE_TOOLS.has(drawRef.current.type) || POLYGON_TOOLS.has(drawRef.current.type))) {
      finishDraw();
    }
  }, [finishDraw]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const onWheel = (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();

      const rect = root.getBoundingClientRect();
      const currentZoom = zoomRef.current || 1;
      const currentPan = panRef.current || { x: 0, y: 0 };
      const deltaUnit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1;
      const deltaY = event.deltaY * deltaUnit;
      const zoomFactor = Math.exp(-deltaY * WHEEL_ZOOM_SPEED);
      const nextZoom = clamp(currentZoom * zoomFactor, MIN_ZOOM, MAX_ZOOM);
      if (nextZoom === currentZoom) return;

      const offsetX = event.clientX - rect.left;
      const offsetY = event.clientY - rect.top;
      const documentPoint = {
        x: (offsetX - currentPan.x) / currentZoom,
        y: (offsetY - currentPan.y) / currentZoom,
      };
      const nextPan = {
        x: offsetX - documentPoint.x * nextZoom,
        y: offsetY - documentPoint.y * nextZoom,
      };

      zoomRef.current = nextZoom;
      panRef.current = nextPan;
      setZoom(nextZoom);
      setPan(nextPan);
    };

    root.addEventListener("wheel", onWheel, { passive: false, capture: true });
    return () => root.removeEventListener("wheel", onWheel, { capture: true });
  }, [setZoom]);

  useEffect(() => {
    cancelDraw();
  }, [page?.id, cancelDraw]);

  useEffect(() => {
    const savedPan = viewState?.pan || {};
    const savedZoom = Number(viewState?.zoom ?? externalZoom);
    const nextZoom = clamp(Number.isFinite(savedZoom) && savedZoom > 0 ? savedZoom : 1, MIN_ZOOM, MAX_ZOOM);
    zoomRef.current = nextZoom;
    setZoomState(nextZoom);
    setPan({
      x: Number.isFinite(Number(savedPan.x)) ? Number(savedPan.x) : 32,
      y: Number.isFinite(Number(savedPan.y)) ? Number(savedPan.y) : 32,
    });
  }, [page?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!page?.id || !onViewStateChange) return;
    if (viewStateSaveTimerRef.current) {
      window.clearTimeout(viewStateSaveTimerRef.current);
    }
    viewStateSaveTimerRef.current = window.setTimeout(() => {
      viewStateSaveTimerRef.current = null;
      const savedZoom = zoomRef.current || zoom;
      const savedPan = panRef.current || pan;
      setExternalZoom?.(savedZoom);
      onViewStateChange({
        zoom: savedZoom,
        pan: savedPan,
      });
    }, VIEW_STATE_SAVE_DELAY_MS);
  }, [onViewStateChange, page?.id, pan, setExternalZoom, zoom]);

  useEffect(() => () => {
    if (viewStateSaveTimerRef.current) {
      window.clearTimeout(viewStateSaveTimerRef.current);
      viewStateSaveTimerRef.current = null;
    }
  }, []);

  const overlayCursor = tool === TOOLS.PAN || spaceHeld
    ? (isPanning ? "grabbing" : "grab")
    : calibrating
      ? "crosshair"
      : tool === TOOLS.POINTER
        ? "default"
        : tool === TOOLS.DELETE
          ? "not-allowed"
          : MARKER_TOOLS.has(tool)
            ? "copy"
            : "crosshair";

  if (!page?.imageDataUrl) {
    return (
      <div style={S.empty}>
        <div style={S.emptyTitle}>Upload a plan to start takeoff</div>
        <div style={S.emptySub}>PDF pages and images render into one shared canvas coordinate space.</div>
      </div>
    );
  }

  const view = {
    scale: zoom,
    pan,
    origin: { x: 0, y: 0 },
  };

  const surfaceStyle = {
    ...S.surface,
    width: W,
    height: H,
    transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
  };

  return (
    <div ref={rootRef} style={S.root} onAuxClick={(event) => event.preventDefault()} onContextMenu={(event) => event.preventDefault()}>
      <div style={S.viewport}>
        <div style={surfaceStyle}>
          <img src={page.imageDataUrl} alt="Plan page" style={S.image} draggable={false} />
        </div>
        <svg
          width="100%"
          height="100%"
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onDoubleClick={handleDoubleClick}
          style={{ ...S.overlay, cursor: overlayCursor }}
        >
          {overlays.map((ov) => (
            <OverlayShape
              key={ov.id}
              ov={ov}
              selected={ov.id === selectedId}
              ppm={ppm}
              view={view}
            />
          ))}
          {drawState && cursorPt && <DrawPreview draw={drawState} cursor={cursorPt} view={view} />}
          {calibrating && <CalibrationPreview calibrating={calibrating} cursor={cursorPt} view={view} />}
          {snapMarker && <SnapMarker snap={snapMarker} view={view} />}
          {cursorPt && <LiveDistanceLabel calibrating={calibrating} draw={drawState} cursor={cursorPt} ppm={ppm} view={view} />}
        </svg>
      </div>

      {calibrating && (
        <div style={S.banner}>
          {(calibrating.points || []).length === 0 && "Click point 1 on the plan"}
          {(calibrating.points || []).length === 1 && "Click point 2 on the plan"}
          {(calibrating.points || []).length >= 2 && "Two points set. Enter the real distance in the Scale panel."}
        </div>
      )}

      {!drawState && !calibrating && SEGMENT_TOOLS.has(tool) && !needsScale && (
        <div style={S.banner}>{tool === TOOLS.MEASURE ? "Measure: click start point" : "Internal wall: click start point"}</div>
      )}

      {needsScale && !calibrating && (
        <div style={S.gate}>
          <div style={S.gateCard}>
            <strong>Set drawing scale first</strong>
            <p>Use the Scale panel before drawing measured takeoff items.</p>
          </div>
        </div>
      )}

      <div style={S.controls}>
        <ViewButton onClick={() => zoomToViewportCentre(zoom * 1.2)} title="Zoom in">＋</ViewButton>
        <ViewButton onClick={() => zoomToViewportCentre(zoom / 1.2)} title="Zoom out">－</ViewButton>
        <ViewButton onClick={fitToScreen} title="Fit to screen">⊡</ViewButton>
        <ViewButton onClick={fitToWidth} title="Fit width">⇔</ViewButton>
        <ViewButton onClick={() => zoomToViewportCentre(1)} title="100%">100</ViewButton>
        <div style={S.ctrlSep} />
        <ViewButton onClick={onRotateLeft} title="Rotate left">↺</ViewButton>
        <ViewButton onClick={onRotateRight} title="Rotate right">↻</ViewButton>
        <ViewButton onClick={onResetRotation} title="Reset rotation">0</ViewButton>
        <div style={S.ctrlSep} />
        <ViewButton onClick={() => { setZoom(1); setPan({ x: 32, y: 32 }); }} title="Reset zoom and pan">1:1</ViewButton>
      </div>

      <div style={S.badge}>{Math.round(zoom * 100)}%</div>
    </div>
  );
}

function screenPointString(points, view) {
  return points.map((point) => {
    const screen = documentToScreen(point, view);
    return `${screen.x},${screen.y}`;
  }).join(" ");
}

function OverlayShape({ ov, selected, ppm, view }) {
  const pts = ov.points || [];
  const st = STYLE[ov.type] || { stroke: "#64748b", sw: 2, fill: "none" };
  const dash = ov.status === "suggested" ? "8 5" : "none";
  const opacity = ov.status === "suggested" ? 0.7 : 1;

  if (ov.type === OT.DOOR || ov.type === OT.WINDOW || ov.type === OT.COLUMN) {
    const docPoint = pts[0];
    if (!docPoint) return null;
    const p = documentToScreen(docPoint, view);
    const r = 10;
    return (
      <g style={{ cursor: "pointer" }} opacity={opacity}>
        {selected && <circle cx={p.x} cy={p.y} r={16} fill="#f59e0b" opacity={0.2} />}
        {ov.type === OT.DOOR && <circle cx={p.x} cy={p.y} r={r} fill="#16a34a" stroke="#fff" strokeWidth={2} />}
        {ov.type === OT.WINDOW && <polygon points={`${p.x},${p.y - r} ${p.x + r},${p.y} ${p.x},${p.y + r} ${p.x - r},${p.y}`} fill="#7c3aed" stroke="#fff" strokeWidth={2} />}
        {ov.type === OT.COLUMN && <rect x={p.x - r} y={p.y - r} width={r * 2} height={r * 2} fill="#92400e" stroke="#fff" strokeWidth={2} />}
        <text x={p.x} y={p.y + 3} textAnchor="middle" fontSize={9} fontWeight="800" fill="#fff" style={{ pointerEvents: "none" }}>
          {ov.type === OT.DOOR ? "D" : ov.type === OT.WINDOW ? "W" : "C"}
        </text>
      </g>
    );
  }

  if (ov.type === OT.CIRCLE) {
    if (pts.length < 2) return null;
    const center = documentToScreen(pts[0], view);
    const r = dist(pts[0], pts[1]) * view.scale;
    return (
      <g style={{ cursor: "pointer" }} opacity={opacity}>
        {selected && <circle cx={center.x} cy={center.y} r={r} stroke="#f59e0b" strokeWidth={st.sw + 5} fill="none" />}
        <circle cx={center.x} cy={center.y} r={r} stroke={st.stroke} strokeWidth={st.sw} fill={st.fill || "none"} strokeDasharray={dash} />
        <OverlayText ov={ov} ppm={ppm} view={view} />
      </g>
    );
  }

  if (ov.type === OT.ROOM || ov.type === OT.AREA || ov.type === OT.RECTANGLE) {
    if (pts.length < 3) return null;
    const pointString = screenPointString(pts, view);
    return (
      <g style={{ cursor: "pointer" }} opacity={opacity}>
        {selected && <polygon points={pointString} stroke="#f59e0b" strokeWidth={st.sw + 4} fill="none" />}
        <polygon points={pointString} stroke={st.stroke} strokeWidth={st.sw} fill={st.fill || "none"} strokeDasharray={dash} strokeLinejoin="round" />
        <OverlayText ov={ov} ppm={ppm} view={view} />
      </g>
    );
  }

  if (pts.length < 2) return null;
  const pointString = screenPointString(pts, view);
  return (
    <g style={{ cursor: "pointer" }} opacity={opacity}>
      <polyline points={pointString} stroke="transparent" strokeWidth={18} fill="none" />
      {selected && <polyline points={pointString} stroke="#f59e0b" strokeWidth={st.sw + 6} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
      <polyline points={pointString} stroke={st.stroke} strokeWidth={st.sw} fill="none" strokeDasharray={dash} strokeLinecap="round" strokeLinejoin="round" />
      <OverlayText ov={ov} ppm={ppm} view={view} />
    </g>
  );
}

function OverlayText({ ov, ppm, view }) {
  const p = documentToScreen(labelPoint(ov), view);
  const text = ov.roomName || (ov.type === OT.MEASURE ? overlayLabel(ov, ppm) : ov.label);
  const measure = ov.type !== OT.MEASURE ? overlayLabel(ov, ppm) : "";
  return (
    <g style={{ pointerEvents: "none" }}>
      {text && (
        <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize={12} fontWeight="800" fill="#0f172a" stroke="#fff" strokeWidth={3} paintOrder="stroke">
          {text}
        </text>
      )}
      {measure && (
        <text x={p.x} y={p.y + 8} textAnchor="middle" fontSize={10} fontWeight="800" fill="#334155" stroke="#fff" strokeWidth={3} paintOrder="stroke">
          {measure}
        </text>
      )}
    </g>
  );
}

function DrawPreview({ draw, cursor, view }) {
  const st = STYLE[draw.type] || { stroke: "#2563eb", sw: 2, fill: "none" };
  const pts = draw.points || [];
  if (!cursor) return null;
  const screenCursor = documentToScreen(cursor, view);

  if (TWO_POINT_TOOLS.has(draw.type)) {
    if (!pts.length) return <circle cx={screenCursor.x} cy={screenCursor.y} r={4} fill={st.stroke} opacity={0.5} />;
    const screenStart = documentToScreen(pts[0], view);
    if (draw.type === TOOLS.CIRCLE) {
      return <circle cx={screenStart.x} cy={screenStart.y} r={dist(pts[0], cursor) * view.scale} stroke={st.stroke} strokeWidth={st.sw} fill={st.fill || "none"} strokeDasharray="8 5" />;
    }
    const corners = rectCorners(pts[0], cursor);
    return <polygon points={screenPointString(corners, view)} stroke={st.stroke} strokeWidth={st.sw} fill={st.fill || "none"} strokeDasharray="8 5" />;
  }

  const all = [...pts, cursor];
  const pointString = screenPointString(all, view);
  return (
    <g style={{ pointerEvents: "none" }}>
      {POLYGON_TOOLS.has(draw.type) && all.length >= 3 && <polygon points={pointString} fill={st.fill || "rgba(37,99,235,0.08)"} stroke="none" />}
      {all.length >= 2 && <polyline points={pointString} stroke={st.stroke} strokeWidth={st.sw} fill="none" strokeDasharray="8 5" strokeLinecap="round" strokeLinejoin="round" />}
      {pts.map((pt, index) => {
        const screen = documentToScreen(pt, view);
        return <circle key={index} cx={screen.x} cy={screen.y} r={4} fill={st.stroke} />;
      })}
      <circle cx={screenCursor.x} cy={screenCursor.y} r={4} fill={st.stroke} opacity={0.5} />
    </g>
  );
}

function CalibrationPreview({ calibrating, cursor, view }) {
  const points = calibrating?.points || [];
  const screenPoints = points.map((point) => documentToScreen(point, view));
  const screenCursor = cursor ? documentToScreen(cursor, view) : null;
  return (
    <g style={{ pointerEvents: "none" }}>
      {screenPoints.map((pt, index) => (
        <g key={index}>
          <circle cx={pt.x} cy={pt.y} r={10} fill="rgba(99,102,241,0.16)" stroke="#6366f1" strokeWidth={2.5} />
          <circle cx={pt.x} cy={pt.y} r={3.5} fill="#6366f1" />
        </g>
      ))}
      {screenPoints.length === 1 && screenCursor && (
        <>
          <line x1={screenPoints[0].x} y1={screenPoints[0].y} x2={screenCursor.x} y2={screenCursor.y} stroke="#6366f1" strokeWidth={3} strokeDasharray="8 5" />
          <circle cx={screenCursor.x} cy={screenCursor.y} r={9} fill="rgba(99,102,241,0.14)" stroke="#6366f1" strokeWidth={2.5} />
          <circle cx={screenCursor.x} cy={screenCursor.y} r={3} fill="#6366f1" />
        </>
      )}
      {screenPoints.length >= 2 && <line x1={screenPoints[0].x} y1={screenPoints[0].y} x2={screenPoints[1].x} y2={screenPoints[1].y} stroke="#6366f1" strokeWidth={2.5} />}
    </g>
  );
}

function SnapMarker({ snap, view }) {
  const point = documentToScreen(snap, view);
  const color = snap.type === "wall-corner" ? "#7c3aed" : "#f97316";
  return (
    <g style={{ pointerEvents: "none" }}>
      <circle cx={point.x} cy={point.y} r={9} fill="none" stroke={color} strokeWidth={2.5} />
      <line x1={point.x - 12} y1={point.y} x2={point.x - 4} y2={point.y} stroke={color} strokeWidth={2} />
      <line x1={point.x + 4} y1={point.y} x2={point.x + 12} y2={point.y} stroke={color} strokeWidth={2} />
      <line x1={point.x} y1={point.y - 12} x2={point.x} y2={point.y - 4} stroke={color} strokeWidth={2} />
      <line x1={point.x} y1={point.y + 4} x2={point.x} y2={point.y + 12} stroke={color} strokeWidth={2} />
      <text x={point.x + 13} y={point.y - 9} fontSize={11} fontWeight={800} fill={color} stroke="#fff" strokeWidth={3} paintOrder="stroke">
        {snap.label || "Snap"}
      </text>
    </g>
  );
}

function formatLiveDistance(lengthPx, ppm) {
  if (ppm > 0) {
    const metres = lengthPx / ppm;
    if (metres < 1) return `${Math.round(metres * 1000)} mm`;
    return `${metres.toFixed(2)} m`;
  }
  return `${Math.round(lengthPx)} px`;
}

function LiveDistanceLabel({ calibrating, draw, cursor, ppm, view }) {
  const start = calibrating?.points?.[0] || draw?.points?.[0] || null;
  if (!start || !cursor) return null;
  if (draw && draw.type !== TOOLS.MEASURE && draw.type !== TOOLS.INTERNAL_WALL) return null;
  const screen = documentToScreen(cursor, view);
  const text = formatLiveDistance(dist(start, cursor), ppm);
  const width = Math.max(58, text.length * 8 + 16);
  return (
    <g style={{ pointerEvents: "none" }}>
      <rect x={screen.x + 12} y={screen.y - 30} width={width} height={22} rx={6} fill="rgba(15,23,42,0.88)" />
      <text x={screen.x + 12 + width / 2} y={screen.y - 15} textAnchor="middle" fontSize={12} fontWeight={900} fill="#fff">
        {text}
      </text>
    </g>
  );
}

function ViewButton({ onClick, title, children }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
      style={S.ctrlBtn}
    >
      {children}
    </button>
  );
}

const S = {
  root: { position: "relative", width: "100%", height: "100%", overflow: "hidden", background: "#e5e7eb", userSelect: "none", overscrollBehavior: "contain", touchAction: "none" },
  viewport: { position: "absolute", inset: 0, overflow: "hidden", touchAction: "none" },
  surface: { position: "absolute", left: 0, top: 0, background: "#fff", boxShadow: "0 10px 35px rgba(15,23,42,0.18)", transformOrigin: "0 0", willChange: "transform", contain: "layout paint style" },
  image: { position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", objectFit: "fill", pointerEvents: "none", backfaceVisibility: "hidden" },
  overlay: { position: "absolute", inset: 0, display: "block", cursor: "crosshair" },
  empty: { width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f8fafc", color: "#475569" },
  emptyTitle: { fontSize: 16, fontWeight: 900, color: "#0f172a" },
  emptySub: { fontSize: 12, marginTop: 6 },
  gate: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(248,250,252,0.76)", zIndex: 30, pointerEvents: "none" },
  gateCard: { background: "#fff", border: "1.5px solid #bfdbfe", borderRadius: 8, padding: "18px 22px", maxWidth: 300, textAlign: "center", boxShadow: "0 8px 22px rgba(15,23,42,0.12)" },
  banner: { position: "absolute", bottom: 18, left: "50%", transform: "translateX(-50%)", background: "rgba(15,23,42,0.9)", color: "#f8fafc", padding: "8px 16px", borderRadius: 999, fontSize: 13, fontWeight: 800, zIndex: 50, pointerEvents: "none", whiteSpace: "nowrap" },
  controls: { position: "absolute", right: 16, bottom: 16, zIndex: 60, display: "flex", flexDirection: "column", gap: 4, padding: 8, borderRadius: 10, background: "rgba(15,23,42,0.9)", boxShadow: "0 8px 20px rgba(15,23,42,0.35)" },
  ctrlBtn: { width: 42, height: 36, border: "none", borderRadius: 7, background: "transparent", color: "#f8fafc", fontSize: 13, fontWeight: 900, cursor: "pointer" },
  ctrlSep: { height: 1, background: "rgba(255,255,255,0.16)", margin: "2px 0" },
  badge: { position: "absolute", left: 16, bottom: 16, zIndex: 60, background: "rgba(15,23,42,0.75)", color: "#e2e8f0", borderRadius: 7, padding: "5px 9px", fontSize: 12, fontWeight: 800, pointerEvents: "none" },
};
