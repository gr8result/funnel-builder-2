// PlanCanvas.jsx
// Professional takeoff interaction surface:
// - Geometry is stored only in plan/world coordinates.
// - Zoom and pan are viewport transforms only.
// - Drawing, editing, snapping, zoom and pan can run independently.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  pxToM2,
  fmtM,
  fmtM2,
  getPixelsPerUnit,
} from "./takeoffUtils";
import {
  distancePx,
  calculateFitView,
  formatMillimetres,
  planToScreenPoint,
  pxToMillimetres,
  pxToMetres,
  normalizeRotation,
  screenPointFromEvent,
  screenToPlanPoint,
  zoomViewportToPoint,
} from "./planCoordinateUtils";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10;
const WHEEL_ZOOM_SPEED = 0.0012;
const VIEW_STATE_SAVE_DELAY_MS = 220;
const SNAP_TOLERANCE_SCREEN_PX = 12;
const HANDLE_RADIUS_SCREEN_PX = 7;
const HIT_RADIUS_SCREEN_PX = 12;
const CLOSE_RADIUS_SCREEN_PX = 14;
const RENDER_DPI = 192;
const IS_DEVELOPMENT = process.env.NODE_ENV !== "production";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clonePoint(point) {
  return { x: point.x, y: point.y };
}

function pointKey(point) {
  return `${Math.round(point.x * 10) / 10}:${Math.round(point.y * 10) / 10}`;
}

function segDist(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (!lenSq) return dist(point, a);
  const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / lenSq, 0, 1);
  return dist(point, { x: a.x + t * dx, y: a.y + t * dy });
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (((a.y > point.y) !== (b.y > point.y)) && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

function isPolygonType(type) {
  return type === OT.ROOM || type === OT.AREA || type === OT.RECTANGLE;
}

function isMarkerType(type) {
  return type === OT.DOOR || type === OT.WINDOW || type === OT.COLUMN;
}

function overlaySegments(overlay) {
  const points = overlay.points || [];
  const segments = [];
  if (points.length < 2) return segments;
  for (let i = 1; i < points.length; i += 1) {
    segments.push({ overlayId: overlay.id, a: points[i - 1], b: points[i], index: i - 1 });
  }
  if (isPolygonType(overlay.type) && points.length > 2) {
    segments.push({ overlayId: overlay.id, a: points[points.length - 1], b: points[0], index: points.length - 1 });
  }
  return segments;
}

function segmentIntersection(a, b, c, d) {
  const r = { x: b.x - a.x, y: b.y - a.y };
  const s = { x: d.x - c.x, y: d.y - c.y };
  const denom = r.x * s.y - r.y * s.x;
  if (Math.abs(denom) < 0.000001) return null;
  const u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / denom;
  const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: a.x + t * r.x, y: a.y + t * r.y };
}

function hitOverlay(point, overlay, toleranceWorld) {
  const points = overlay.points || [];
  if (!points.length) return false;
  if (isMarkerType(overlay.type)) return dist(point, points[0]) <= toleranceWorld;
  if (overlay.type === OT.CIRCLE && points.length >= 2) {
    return Math.abs(dist(point, points[0]) - dist(points[0], points[1])) <= toleranceWorld;
  }
  if (isPolygonType(overlay.type)) {
    if (pointInPolygon(point, points)) return true;
    return overlaySegments(overlay).some((segment) => segDist(point, segment.a, segment.b) <= toleranceWorld);
  }
  return overlaySegments(overlay).some((segment) => segDist(point, segment.a, segment.b) <= toleranceWorld);
}

function overlayLabel(overlay, ppm) {
  const points = overlay.points || [];
  if (!points.length) return "";
  if (overlay.type === OT.MEASURE) {
    return measurementLengthText(points, ppm);
  }
  if ([OT.EXTERNAL_WALL, OT.INTERNAL_WALL, OT.POLYLINE].includes(overlay.type)) {
    return formatMillimetres(pxToMillimetres(polyLen(points), ppm));
  }
  if ([OT.ROOM, OT.AREA, OT.RECTANGLE].includes(overlay.type)) {
    return fmtM2(pxToM2(polyArea(points), ppm));
  }
  if (overlay.type === OT.CIRCLE && points.length >= 2) {
    return fmtM2(pxToM2(circleArea(points[0], points[1]), ppm));
  }
  return "";
}

function measurementLengthText(points, ppm) {
  const lengthPx = polyLen(points || []);
  if (!(ppm > 0)) return `${Math.round(lengthPx).toLocaleString()} px`;
  return formatMillimetres(pxToMillimetres(lengthPx, ppm));
}

function labelPoint(overlay) {
  const points = overlay.points || [];
  if (!points.length) return { x: 0, y: 0 };
  if (overlay.type === OT.CIRCLE) return points[0];
  return centroid(points);
}

function minimumPointCount(type) {
  if (isPolygonType(type)) return 3;
  if (type === OT.CIRCLE || type === OT.RECTANGLE) return 2;
  return 2;
}

export default function PlanCanvas({
  page,
  tool,
  overlays = [],
  selectedId,
  calibrating,
  onAddOverlay,
  onUpdateOverlay,
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
  const dragRef = useRef(null);
  const spaceRef = useRef(false);
  const shiftRef = useRef(false);
  const viewportRef = useRef({
    zoom: clamp(Number(externalZoom) || 1, MIN_ZOOM, MAX_ZOOM),
    pan: { x: 32, y: 32 },
    origin: { x: 0, y: 0 },
  });
  const saveViewTimerRef = useRef(null);
  const wheelFrameRef = useRef(null);
  const wheelStateRef = useRef(null);

  const [zoom, setZoomState] = useState(() => viewportRef.current.zoom);
  const [pan, setPanState] = useState(() => viewportRef.current.pan);
  const [drawState, setDrawState] = useState(null);
  const [cursorWorld, setCursorWorld] = useState(null);
  const [snapState, setSnapState] = useState(null);
  const [selectedVertex, setSelectedVertex] = useState(null);
  const [isPanning, setIsPanning] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [mouseDebug, setMouseDebug] = useState({ screen: null, world: null, nearestSnap: null });
  const [debugVisible, setDebugVisible] = useState(false);
  const [viewInitializedPageId, setViewInitializedPageId] = useState(null);

  const width = page?.normalizedWidth || page?.naturalWidth || 1200;
  const height = page?.normalizedHeight || page?.naturalHeight || 900;
  const livePageRotation = normalizeRotation(page?.rotation ?? page?.finalRotation ?? page?.planRotation ?? 0);
  const rendererKey = `${page?.id || "no-page"}-${livePageRotation}-${page?.imageDataUrl?.length || 0}-${width}x${height}`;
  const ppm = getPixelsPerUnit(page?.scale);
  const hasScale = ppm > 0 && page?.scale?.accepted !== false;
  const needsScale = !hasScale && ![TOOLS.POINTER, TOOLS.PAN, TOOLS.DOOR, TOOLS.WINDOW, TOOLS.COLUMN, TOOLS.DELETE].includes(tool);

  const viewport = useMemo(() => ({ zoom, pan, origin: { x: 0, y: 0 } }), [zoom, pan]);

  const setViewport = useCallback((next) => {
    const current = viewportRef.current;
    const zoomValue = clamp(Number(next.zoom ?? current.zoom) || 1, MIN_ZOOM, MAX_ZOOM);
    const panValue = next.pan || current.pan || { x: 0, y: 0 };
    const viewportValue = {
      zoom: zoomValue,
      pan: { x: Number(panValue.x) || 0, y: Number(panValue.y) || 0 },
      origin: { x: 0, y: 0 },
    };
    viewportRef.current = viewportValue;
    setZoomState(viewportValue.zoom);
    setPanState(viewportValue.pan);
  }, []);

  const setDraw = useCallback((next) => {
    const value = typeof next === "function" ? next(drawRef.current) : next;
    drawRef.current = value;
    setDrawState(value);
  }, []);

  const worldFromEvent = useCallback((event) => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const currentViewport = {
      ...viewportRef.current,
      origin: { x: rect.left, y: rect.top },
    };
    const screen = screenPointFromEvent(event);
    const world = screenToPlanPoint(screen.x, screen.y, currentViewport);
    return {
      x: clamp(world.x, 0, width),
      y: clamp(world.y, 0, height),
    };
  }, [height, width]);

  const snapData = useMemo(() => {
    const vertices = [];
    const segments = [];
    const seen = new Set();
    overlays.forEach((overlay) => {
      (overlay.points || []).forEach((point, index) => {
        const key = pointKey(point);
        if (!seen.has(key)) {
          seen.add(key);
          vertices.push({ ...clonePoint(point), overlayId: overlay.id, index, type: "vertex", label: "Vertex" });
        }
      });
      segments.push(...overlaySegments(overlay));
    });

    const intersections = [];
    const seenIntersections = new Set();
    for (let i = 0; i < segments.length; i += 1) {
      for (let j = i + 1; j < segments.length; j += 1) {
        const a = segments[i];
        const b = segments[j];
        if (a.overlayId === b.overlayId && Math.abs(a.index - b.index) <= 1) continue;
        const hit = segmentIntersection(a.a, a.b, b.a, b.b);
        if (!hit) continue;
        const key = pointKey(hit);
        if (seenIntersections.has(key)) continue;
        seenIntersections.add(key);
        intersections.push({ ...hit, type: "intersection", label: "Intersection" });
      }
    }

    return { vertices, intersections, segments };
  }, [overlays]);

  const nearestSnapTarget = useCallback((rawPoint, exclude = null) => {
    const toleranceWorld = SNAP_TOLERANCE_SCREEN_PX / Math.max(viewportRef.current.zoom, MIN_ZOOM);
    let nearest = null;
    let nearestDistance = toleranceWorld;
    [...snapData.vertices, ...snapData.intersections].forEach((candidate) => {
      if (exclude && candidate.overlayId === exclude.overlayId && candidate.index === exclude.index) return;
      const distance = dist(rawPoint, candidate);
      if (distance <= nearestDistance) {
        nearest = candidate;
        nearestDistance = distance;
      }
    });
    return nearest ? { ...nearest, distance: nearestDistance } : null;
  }, [snapData.intersections, snapData.vertices]);

  const resolveSnap = useCallback((rawPoint, options = {}) => {
    const toleranceWorld = (options.toleranceScreenPx || SNAP_TOLERANCE_SCREEN_PX) / Math.max(viewportRef.current.zoom, MIN_ZOOM);
    const excluded = options.exclude || null;
    const base = options.basePoint || null;
    let point = clonePoint(rawPoint);
    let marker = null;
    const guides = [];

    const nearest = nearestSnapTarget(point, excluded);
    if (nearest) {
      point = { x: nearest.x, y: nearest.y };
      marker = nearest;
    }

    if (base) {
      const dx = Math.abs(point.x - base.x);
      const dy = Math.abs(point.y - base.y);
      if (dx <= toleranceWorld || (options.forceOrthogonal && dx <= dy)) {
        point = { x: base.x, y: point.y };
        guides.push({ type: "vertical", x: base.x });
        marker = marker || { ...point, type: "alignment", label: "Vertical" };
      } else if (dy <= toleranceWorld || options.forceOrthogonal) {
        point = { x: point.x, y: base.y };
        guides.push({ type: "horizontal", y: base.y });
        marker = marker || { ...point, type: "alignment", label: "Horizontal" };
      }
    }

    return {
      point: { x: clamp(point.x, 0, width), y: clamp(point.y, 0, height) },
      marker,
      guides,
    };
  }, [height, nearestSnapTarget, width]);

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
    setCursorWorld(null);
    setSnapState(null);
  }, [onAddOverlay, setDraw]);

  const cancelEdit = useCallback(() => {
    dragRef.current = null;
    setSelectedVertex(null);
    setSnapState(null);
  }, []);

  const cancelDraw = useCallback(() => {
    setDraw(null);
    setCursorWorld(null);
    setSnapState(null);
  }, [setDraw]);

  const hitVertex = useCallback((worldPoint) => {
    const toleranceWorld = HANDLE_RADIUS_SCREEN_PX / Math.max(viewportRef.current.zoom, MIN_ZOOM);
    let best = null;
    let bestDistance = toleranceWorld;
    overlays.forEach((overlay) => {
      (overlay.points || []).forEach((point, index) => {
        const distance = dist(worldPoint, point);
        if (distance <= bestDistance) {
          bestDistance = distance;
          best = { overlayId: overlay.id, index };
        }
      });
    });
    return best;
  }, [overlays]);

  const hitSegment = useCallback((worldPoint) => {
    const toleranceWorld = HIT_RADIUS_SCREEN_PX / Math.max(viewportRef.current.zoom, MIN_ZOOM);
    let best = null;
    let bestDistance = toleranceWorld;
    snapData.segments.forEach((segment) => {
      const distance = segDist(worldPoint, segment.a, segment.b);
      if (distance <= bestDistance) {
        bestDistance = distance;
        best = segment;
      }
    });
    return best;
  }, [snapData.segments]);

  const commitVertexDrag = useCallback((overlayId, index, rawPoint) => {
    const overlay = overlays.find((item) => item.id === overlayId);
    if (!overlay) return;
    const basePoint = dragRef.current?.basePoint || null;
    const snap = resolveSnap(rawPoint, {
      exclude: { overlayId, index },
      basePoint,
      forceOrthogonal: shiftRef.current,
    });
    const points = (overlay.points || []).map((point, pointIndex) => pointIndex === index ? snap.point : point);
    setSnapState(snap);
    setCursorWorld(snap.point);
    onUpdateOverlay?.(overlayId, { points });
  }, [onUpdateOverlay, overlays, resolveSnap]);

  useEffect(() => {
    console.log("ACTIVE PLAN RENDERER BUILD TEST 001");
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) return;
      if (event.code === "Space") {
        event.preventDefault();
        spaceRef.current = true;
        setSpaceHeld(true);
      }
      if (event.key === "Shift") shiftRef.current = true;
      if (event.key === "Escape") {
        cancelDraw();
        cancelEdit();
      }
      if (event.key === "Enter") finishDraw();
      if ((event.key === "Delete" || event.key === "Backspace") && selectedVertex) {
        const overlay = overlays.find((item) => item.id === selectedVertex.overlayId);
        if (!overlay) return;
        const nextPoints = (overlay.points || []).filter((_, index) => index !== selectedVertex.index);
        if (nextPoints.length < minimumPointCount(overlay.type)) {
          onDeleteOverlay?.(overlay.id);
        } else {
          onUpdateOverlay?.(overlay.id, { points: nextPoints });
        }
        setSelectedVertex(null);
      } else if ((event.key === "Delete" || event.key === "Backspace") && selectedId && !drawRef.current) {
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
      dragRef.current = null;
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
  }, [cancelDraw, cancelEdit, finishDraw, onDeleteOverlay, onUpdateOverlay, overlays, selectedId, selectedVertex]);

  const startPan = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    const point = screenPointFromEvent(event);
    const current = viewportRef.current;
    dragRef.current = {
      mode: "pan",
      pointerId: event.pointerId,
      startScreen: point,
      startPan: current.pan,
    };
    setIsPanning(true);
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // Pointer capture can fail for some middle-button events.
    }
  }, []);

  const handlePointerDown = useCallback((event) => {
    const shouldPan = tool === TOOLS.PAN || event.button === 1 || (event.button === 0 && spaceRef.current);
    if (shouldPan) {
      startPan(event);
      return;
    }

    if (event.button !== 0) return;
    const rawWorld = worldFromEvent(event);
    if (!rawWorld) return;
    const screen = screenPointFromEvent(event);
    setMouseDebug({
      screen,
      world: rawWorld,
      nearestSnap: nearestSnapTarget(rawWorld),
    });

    const vertexHit = hitVertex(rawWorld);
    if (vertexHit) {
      event.preventDefault();
      event.stopPropagation();
      const overlay = overlays.find((item) => item.id === vertexHit.overlayId);
      const baseIndex = vertexHit.index > 0 ? vertexHit.index - 1 : 1;
      setSelectedVertex(vertexHit);
      onSelectOverlay?.(vertexHit.overlayId);
      dragRef.current = {
        mode: "vertex",
        pointerId: event.pointerId,
        overlayId: vertexHit.overlayId,
        index: vertexHit.index,
        basePoint: overlay?.points?.[baseIndex] || null,
      };
      try {
        event.currentTarget.setPointerCapture?.(event.pointerId);
      } catch {
        // Pointer capture can fail if the browser has already consumed the pointer.
      }
      return;
    }

    if (calibrating) {
      const existingPoints = calibrating.points || [];
      const snap = resolveSnap(rawWorld, {
        basePoint: existingPoints[0] || null,
        forceOrthogonal: existingPoints.length >= 1 || shiftRef.current,
      });
      setCursorWorld(snap.point);
      setSnapState(snap);
      onCalibrationPoint?.(snap.point);
      return;
    }

    if (tool === TOOLS.DELETE) {
      const hit = [...overlays].reverse().find((overlay) => hitOverlay(rawWorld, overlay, HIT_RADIUS_SCREEN_PX / Math.max(viewportRef.current.zoom, MIN_ZOOM)));
      if (hit) onDeleteOverlay?.(hit.id);
      return;
    }

    if (tool === TOOLS.POINTER || tool === TOOLS.PAN) {
      const hit = [...overlays].reverse().find((overlay) => hitOverlay(rawWorld, overlay, HIT_RADIUS_SCREEN_PX / Math.max(viewportRef.current.zoom, MIN_ZOOM)));
      onSelectOverlay?.(hit?.id || null);
      setSelectedVertex(null);
      return;
    }

    if (needsScale) return;

    const draw = drawRef.current;
    const basePoint = draw?.points?.[draw.points.length - 1] || null;
    const snap = resolveSnap(rawWorld, {
      basePoint,
      forceOrthogonal: shiftRef.current,
    });
    const point = snap.point;
    setCursorWorld(point);
    setSnapState(snap);

    if (MARKER_TOOLS.has(tool)) {
      onAddOverlay?.(createOverlay({ type: tool, points: [point] }));
      return;
    }

    if (SEGMENT_TOOLS.has(tool)) {
      if (draw?.type === tool && draw.points.length === 1) {
        const points = [draw.points[0], point];
        const lengthMm = ppm > 0 ? pxToMillimetres(distancePx(points[0], points[1]), ppm) : null;
        onAddOverlay?.(createOverlay({
          type: tool,
          points,
          extra: {
            measurementWarning: tool === TOOLS.MEASURE && lengthMm != null && lengthMm < 100
              ? "This measurement is very small. Did you click both points correctly?"
              : "",
          },
        }));
        setDraw(null);
      } else {
        setDraw({ type: tool, points: [point] });
      }
      return;
    }

    if (TWO_POINT_TOOLS.has(tool)) {
      if (draw?.type === tool && draw.points.length === 1) {
        const points = tool === TOOLS.RECTANGLE ? rectCorners(draw.points[0], point) : [draw.points[0], point];
        onAddOverlay?.(createOverlay({ type: tool, points }));
        setDraw(null);
      } else {
        setDraw({ type: tool, points: [point] });
      }
      return;
    }

    if (POLYLINE_TOOLS.has(tool) || POLYGON_TOOLS.has(tool)) {
      if (!draw || draw.type !== tool) {
        setDraw({ type: tool, points: [point] });
        return;
      }
      const closeRadius = CLOSE_RADIUS_SCREEN_PX / Math.max(viewportRef.current.zoom, MIN_ZOOM);
      if (POLYGON_TOOLS.has(tool) && draw.points.length >= 3 && dist(point, draw.points[0]) <= closeRadius) {
        finishDraw();
        return;
      }
      setDraw({ type: tool, points: [...draw.points, point] });
    }
  }, [
    calibrating,
    finishDraw,
    hitVertex,
    nearestSnapTarget,
    needsScale,
    onAddOverlay,
    onCalibrationPoint,
    onDeleteOverlay,
    onSelectOverlay,
    overlays,
    resolveSnap,
    setDraw,
    startPan,
    tool,
    worldFromEvent,
  ]);

  const handlePointerMove = useCallback((event) => {
    const rawWorld = worldFromEvent(event);
    if (rawWorld) {
      setMouseDebug({
        screen: screenPointFromEvent(event),
        world: rawWorld,
        nearestSnap: nearestSnapTarget(rawWorld),
      });
    }

    const drag = dragRef.current;
    if (drag?.mode === "pan") {
      event.preventDefault();
      const screen = screenPointFromEvent(event);
      const nextPan = {
        x: drag.startPan.x + screen.x - drag.startScreen.x,
        y: drag.startPan.y + screen.y - drag.startScreen.y,
      };
      setViewport({ pan: nextPan });
      return;
    }

    if (!rawWorld) return;

    if (drag?.mode === "vertex") {
      event.preventDefault();
      commitVertexDrag(drag.overlayId, drag.index, rawWorld);
      return;
    }

    const draw = drawRef.current;
    const calibrationBase = calibrating?.points?.[0] || null;
    const drawBase = draw?.points?.[draw.points.length - 1] || null;
    const snap = resolveSnap(rawWorld, {
      basePoint: calibrationBase || drawBase,
      forceOrthogonal: Boolean(calibrationBase) || shiftRef.current,
    });
    setCursorWorld(snap.point);
    setSnapState(snap);
  }, [calibrating, commitVertexDrag, nearestSnapTarget, resolveSnap, setViewport, worldFromEvent]);

  const handlePointerUp = useCallback((event) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setIsPanning(false);
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch {
      // Pointer capture can already be released.
    }
  }, []);

  const handleDoubleClick = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();

    const draw = drawRef.current;
    if (draw && (POLYLINE_TOOLS.has(draw.type) || POLYGON_TOOLS.has(draw.type))) {
      finishDraw();
      return;
    }

    const worldPoint = worldFromEvent(event);
    if (!worldPoint) return;
    const segment = hitSegment(worldPoint);
    if (!segment) return;
    const overlay = overlays.find((item) => item.id === segment.overlayId);
    if (!overlay) return;
    const insertAt = segment.index + 1;
    const points = [...(overlay.points || [])];
    points.splice(insertAt, 0, worldPoint);
    onUpdateOverlay?.(overlay.id, { points });
    onSelectOverlay?.(overlay.id);
    setSelectedVertex({ overlayId: overlay.id, index: insertAt });
  }, [finishDraw, hitSegment, onSelectOverlay, onUpdateOverlay, overlays, worldFromEvent]);

  const handleWheel = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    event.nativeEvent?.stopImmediatePropagation?.();

    const root = rootRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const deltaUnit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1;
    const zoomFactor = Math.exp(-(event.deltaY * deltaUnit) * WHEEL_ZOOM_SPEED);
    const current = wheelStateRef.current || {
      viewport: viewportRef.current,
      mouse: { x: event.clientX, y: event.clientY },
    };
    const nextZoom = clamp(current.viewport.zoom * zoomFactor, MIN_ZOOM, MAX_ZOOM);
    const nextViewport = zoomViewportToPoint(
      { ...current.viewport, origin: { x: rect.left, y: rect.top } },
      event.clientX,
      event.clientY,
      nextZoom,
    );

    wheelStateRef.current = {
      viewport: { zoom: nextViewport.zoom, pan: nextViewport.pan, origin: { x: 0, y: 0 } },
      mouse: { x: event.clientX, y: event.clientY },
    };

    if (wheelFrameRef.current) return;
    wheelFrameRef.current = window.requestAnimationFrame(() => {
      wheelFrameRef.current = null;
      const pending = wheelStateRef.current;
      wheelStateRef.current = null;
      if (!pending) return;
      setViewport(pending.viewport);
    });
  }, [setViewport]);

  useEffect(() => {
    cancelDraw();
    cancelEdit();
    setViewInitializedPageId(null);
  }, [height, livePageRotation, page?.id, width, cancelDraw, cancelEdit]);

  useEffect(() => {
    const fitKey = `${page?.id || ""}-${livePageRotation}-${width}x${height}`;
    if (!page?.id || viewInitializedPageId === fitKey) return;
    const frame = window.requestAnimationFrame(() => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect?.width || !rect?.height) return;
      setViewport(calculateFitView(rect.width, rect.height, width, height));
      setViewInitializedPageId(fitKey);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [height, livePageRotation, page?.id, setViewport, viewInitializedPageId, width]);

  useEffect(() => {
    if (!page?.id || !onViewStateChange) return;
    if (saveViewTimerRef.current) window.clearTimeout(saveViewTimerRef.current);
    saveViewTimerRef.current = window.setTimeout(() => {
      saveViewTimerRef.current = null;
      const current = viewportRef.current;
      setExternalZoom?.(current.zoom);
      onViewStateChange({ zoom: current.zoom, pan: current.pan });
    }, VIEW_STATE_SAVE_DELAY_MS);
  }, [onViewStateChange, page?.id, pan, setExternalZoom, zoom]);

  useEffect(() => () => {
    if (saveViewTimerRef.current) {
      window.clearTimeout(saveViewTimerRef.current);
      saveViewTimerRef.current = null;
    }
    if (wheelFrameRef.current) {
      window.cancelAnimationFrame(wheelFrameRef.current);
      wheelFrameRef.current = null;
    }
  }, []);

  const cursor = tool === TOOLS.PAN || spaceHeld
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
        <div style={S.emptySub}>PDF pages and images render into one world coordinate space.</div>
      </div>
    );
  }

  const surfaceStyle = {
    ...S.surface,
    width,
    height,
    transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
  };

  return (
    <div
      ref={rootRef}
      style={S.root}
      onWheelCapture={handleWheel}
      onAuxClick={(event) => event.preventDefault()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div style={S.liveRotationLabel}>LIVE PAGE ROTATION: {livePageRotation}</div>
      <div style={S.viewport}>
        <div key={rendererKey} style={surfaceStyle}>
          <img key={rendererKey} src={page.imageDataUrl} alt="Plan page" style={S.image} draggable={false} />
        </div>
        <svg
          width="100%"
          height="100%"
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onDoubleClick={handleDoubleClick}
          style={{ ...S.overlay, cursor }}
        >
          {overlays.map((overlay) => (
            <OverlayShape
              key={overlay.id}
              overlay={overlay}
              selected={overlay.id === selectedId}
              ppm={ppm}
              viewport={viewport}
            />
          ))}
          <AllVertexHandles overlays={overlays} selectedVertex={selectedVertex} viewport={viewport} />
          <ScaleCalibrationLine scale={page?.scale} viewport={viewport} />
          {drawState && cursorWorld && <DrawPreview draw={drawState} cursor={cursorWorld} viewport={viewport} />}
          {calibrating && <CalibrationPreview calibrating={calibrating} cursor={cursorWorld} viewport={viewport} />}
          {snapState?.guides?.map((guide, index) => <SnapGuide key={index} guide={guide} viewport={viewport} width={width} height={height} />)}
          {snapState?.marker && <SnapMarker snap={snapState.marker} viewport={viewport} />}
          {cursorWorld && <LiveDistanceLabel calibrating={calibrating} draw={drawState} cursor={cursorWorld} ppm={ppm} viewport={viewport} />}
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

      {page?.rotationResetWarning && (
        <div style={S.warningBanner}>{page.rotationResetWarning}</div>
      )}

      <div style={S.controls}>
        <ViewButton onClick={() => setViewport({ zoom: zoom * 1.2 })} title="Zoom in">+</ViewButton>
        <ViewButton onClick={() => setViewport({ zoom: zoom / 1.2 })} title="Zoom out">-</ViewButton>
        <ViewButton onClick={() => fitToScreen(rootRef.current, width, height, setViewport)} title="Fit to page">Fit</ViewButton>
        <ViewButton onClick={() => fitToWidth(rootRef.current, width, setViewport)} title="Fit width">W</ViewButton>
        <ViewButton onClick={() => setViewport({ zoom: 1 })} title="100%">100</ViewButton>
        <ViewButton onClick={() => setViewport({ zoom: 2 })} title="200%">200</ViewButton>
        <ViewButton onClick={() => setViewport({ zoom: 4 })} title="400%">400</ViewButton>
        <div style={S.ctrlSep} />
        <ViewButton onClick={onRotateLeft} title="Rotate left">L</ViewButton>
        <ViewButton onClick={onRotateRight} title="Rotate right">R</ViewButton>
        <ViewButton onClick={onResetRotation} title="Reset rotation">0</ViewButton>
        <div style={S.ctrlSep} />
        <ViewButton onClick={() => setViewport({ zoom: 1, pan: { x: 32, y: 32 } })} title="Reset zoom and pan">1:1</ViewButton>
        {IS_DEVELOPMENT && <ViewButton onClick={() => setDebugVisible((value) => !value)} title="Toggle debug">Debug</ViewButton>}
      </div>

      <div style={S.badge}>{Math.round(zoom * 100)}%</div>
      <div style={{ ...S.scaleBadge, ...(hasScale ? S.scaleBadgeSet : S.scaleBadgeMissing) }}>{scaleStatusText(page?.scale)}</div>
      {IS_DEVELOPMENT && debugVisible && (
        <DebugPanel
          page={page}
          tool={tool}
          zoom={zoom}
          pan={pan}
          mouseDebug={mouseDebug}
          selectedVertex={selectedVertex}
          scale={page?.scale}
        />
      )}
    </div>
  );
}

function fitToScreen(root, width, height, setViewport) {
  if (!root || !width || !height) return;
  const rect = root.getBoundingClientRect();
  setViewport(calculateFitView(rect.width, rect.height, width, height));
}

function fitToWidth(root, width, setViewport) {
  if (!root || !width) return;
  const rect = root.getBoundingClientRect();
  const zoom = clamp((rect.width * 0.94) / width, MIN_ZOOM, MAX_ZOOM);
  setViewport({
    zoom,
    pan: {
      x: (rect.width - width * zoom) / 2,
      y: 32,
    },
  });
}

function screenPointString(points, viewport) {
  return points.map((point) => {
    const screen = planToScreenPoint(point.x, point.y, viewport);
    return `${screen.x},${screen.y}`;
  }).join(" ");
}

function OverlayShape({ overlay, selected, ppm, viewport }) {
  const points = overlay.points || [];
  const style = STYLE[overlay.type] || { stroke: "#64748b", sw: 2, fill: "none" };
  const dash = overlay.status === "suggested" ? "8 5" : "none";
  const opacity = overlay.status === "suggested" ? 0.7 : 1;

  let shape = null;
  if (isMarkerType(overlay.type)) {
    const point = points[0];
    if (!point) return null;
    const screen = planToScreenPoint(point.x, point.y, viewport);
    shape = (
      <>
        {overlay.type === OT.DOOR && <circle cx={screen.x} cy={screen.y} r={10} fill="#16a34a" stroke="#fff" strokeWidth={2} />}
        {overlay.type === OT.WINDOW && <polygon points={`${screen.x},${screen.y - 10} ${screen.x + 10},${screen.y} ${screen.x},${screen.y + 10} ${screen.x - 10},${screen.y}`} fill="#7c3aed" stroke="#fff" strokeWidth={2} />}
        {overlay.type === OT.COLUMN && <rect x={screen.x - 10} y={screen.y - 10} width={20} height={20} fill="#92400e" stroke="#fff" strokeWidth={2} />}
      </>
    );
  } else if (overlay.type === OT.CIRCLE && points.length >= 2) {
    const center = planToScreenPoint(points[0].x, points[0].y, viewport);
    const radius = dist(points[0], points[1]) * viewport.zoom;
    shape = (
      <>
        {selected && <circle cx={center.x} cy={center.y} r={radius} stroke="#f59e0b" strokeWidth={style.sw + 5} fill="none" />}
        <circle cx={center.x} cy={center.y} r={radius} stroke={style.stroke} strokeWidth={style.sw} fill={style.fill || "none"} strokeDasharray={dash} />
      </>
    );
  } else if (isPolygonType(overlay.type) && points.length >= 3) {
    const pointString = screenPointString(points, viewport);
    shape = (
      <>
        {selected && <polygon points={pointString} stroke="#f59e0b" strokeWidth={style.sw + 4} fill="none" />}
        <polygon points={pointString} stroke={style.stroke} strokeWidth={style.sw} fill={style.fill || "none"} strokeDasharray={dash} strokeLinejoin="round" />
      </>
    );
  } else if (points.length >= 2) {
    const pointString = screenPointString(points, viewport);
    shape = (
      <>
        <polyline points={pointString} stroke="transparent" strokeWidth={18} fill="none" />
        {selected && <polyline points={pointString} stroke="#f59e0b" strokeWidth={style.sw + 6} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
        <polyline points={pointString} stroke={style.stroke} strokeWidth={style.sw} fill="none" strokeDasharray={dash} strokeLinecap="round" strokeLinejoin="round" />
      </>
    );
  }

  return (
    <g opacity={opacity}>
      {shape}
      <OverlayText overlay={overlay} ppm={ppm} viewport={viewport} />
    </g>
  );
}

function AllVertexHandles({ overlays, selectedVertex, viewport }) {
  return (
    <g>
      {overlays.flatMap((overlay) => (overlay.points || []).map((point, index) => (
        <VertexHandle
          key={`${overlay.id}-${index}`}
          point={point}
          active={selectedVertex?.overlayId === overlay.id && selectedVertex?.index === index}
          viewport={viewport}
        />
      )))}
    </g>
  );
}

function VertexHandle({ point, active, viewport }) {
  const screen = planToScreenPoint(point.x, point.y, viewport);
  return (
    <g style={{ pointerEvents: "none" }}>
      <circle cx={screen.x} cy={screen.y} r={active ? 9 : 6} fill={active ? "#f97316" : "#fff"} stroke="#0f172a" strokeWidth={2} />
      <circle cx={screen.x} cy={screen.y} r={2.5} fill={active ? "#fff" : "#0f172a"} />
    </g>
  );
}

function ScaleCalibrationLine({ scale, viewport }) {
  const points = scale?.calibrationPoints || [];
  if (points.length < 2) return null;
  const a = planToScreenPoint(points[0].x, points[0].y, viewport);
  const b = planToScreenPoint(points[1].x, points[1].y, viewport);
  return (
    <g style={{ pointerEvents: "none" }}>
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#16a34a" strokeWidth={3} strokeDasharray="10 5" />
      <circle cx={a.x} cy={a.y} r={8} fill="#dcfce7" stroke="#16a34a" strokeWidth={2.5} />
      <circle cx={b.x} cy={b.y} r={8} fill="#dcfce7" stroke="#16a34a" strokeWidth={2.5} />
      <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 12} textAnchor="middle" fontSize={12} fontWeight={900} fill="#166534" stroke="#fff" strokeWidth={3} paintOrder="stroke">
        {scaleStatusText(scale)}
      </text>
    </g>
  );
}

function OverlayText({ overlay, ppm, viewport }) {
  if (!overlay.points?.length) return null;
  const label = labelPoint(overlay);
  const point = planToScreenPoint(label.x, label.y, viewport);
  const isMeasurement = overlay.type === OT.MEASURE;
  const title = overlay.roomName || (isMeasurement ? overlayLabel(overlay, ppm) : overlay.label);
  const measure = overlay.type !== OT.MEASURE ? overlayLabel(overlay, ppm) : "";
  const titleWidth = title ? Math.max(82, title.length * 7.5 + 20) : 0;
  return (
    <g style={{ pointerEvents: "none" }}>
      {title && isMeasurement && (
        <g>
          <rect x={point.x - titleWidth / 2} y={point.y - 28} width={titleWidth} height={24} rx={7} fill="rgba(15,23,42,0.88)" stroke="#f59e0b" strokeWidth={1.5} />
          <text x={point.x} y={point.y - 12} textAnchor="middle" fontSize={12} fontWeight={900} fill="#fff">
            {title}
          </text>
        </g>
      )}
      {title && !isMeasurement && (
        <text x={point.x} y={point.y - 8} textAnchor="middle" fontSize={12} fontWeight={800} fill="#0f172a" stroke="#fff" strokeWidth={3} paintOrder="stroke">
          {title}
        </text>
      )}
      {measure && (
        <text x={point.x} y={point.y + 8} textAnchor="middle" fontSize={10} fontWeight={800} fill="#334155" stroke="#fff" strokeWidth={3} paintOrder="stroke">
          {measure}
        </text>
      )}
      {isMeasurement && overlay.measurementWarning && (
        <text x={point.x} y={point.y + 10} textAnchor="middle" fontSize={11} fontWeight={900} fill="#dc2626" stroke="#fff" strokeWidth={3} paintOrder="stroke">
          {overlay.measurementWarning}
        </text>
      )}
    </g>
  );
}

function DrawPreview({ draw, cursor, viewport }) {
  const style = STYLE[draw.type] || { stroke: "#2563eb", sw: 2, fill: "none" };
  const points = draw.points || [];
  const cursorScreen = planToScreenPoint(cursor.x, cursor.y, viewport);

  if (TWO_POINT_TOOLS.has(draw.type)) {
    if (!points.length) return <circle cx={cursorScreen.x} cy={cursorScreen.y} r={4} fill={style.stroke} opacity={0.55} />;
    const startScreen = planToScreenPoint(points[0].x, points[0].y, viewport);
    if (draw.type === TOOLS.CIRCLE) {
      return <circle cx={startScreen.x} cy={startScreen.y} r={dist(points[0], cursor) * viewport.zoom} stroke={style.stroke} strokeWidth={style.sw} fill={style.fill || "none"} strokeDasharray="8 5" />;
    }
    return <polygon points={screenPointString(rectCorners(points[0], cursor), viewport)} stroke={style.stroke} strokeWidth={style.sw} fill={style.fill || "none"} strokeDasharray="8 5" />;
  }

  const allPoints = [...points, cursor];
  return (
    <g style={{ pointerEvents: "none" }}>
      {POLYGON_TOOLS.has(draw.type) && allPoints.length >= 3 && <polygon points={screenPointString(allPoints, viewport)} fill={style.fill || "rgba(37,99,235,0.08)"} stroke="none" />}
      {allPoints.length >= 2 && <polyline points={screenPointString(allPoints, viewport)} stroke={style.stroke} strokeWidth={style.sw} fill="none" strokeDasharray="8 5" strokeLinecap="round" strokeLinejoin="round" />}
      {points.map((point, index) => {
        const screen = planToScreenPoint(point.x, point.y, viewport);
        return <circle key={index} cx={screen.x} cy={screen.y} r={4} fill={style.stroke} />;
      })}
      <circle cx={cursorScreen.x} cy={cursorScreen.y} r={4} fill={style.stroke} opacity={0.55} />
    </g>
  );
}

function CalibrationPreview({ calibrating, cursor, viewport }) {
  const points = calibrating?.points || [];
  const screenPoints = points.map((point) => planToScreenPoint(point.x, point.y, viewport));
  const cursorScreen = cursor ? planToScreenPoint(cursor.x, cursor.y, viewport) : null;
  return (
    <g style={{ pointerEvents: "none" }}>
      {screenPoints.map((point, index) => (
        <g key={index}>
          <circle cx={point.x} cy={point.y} r={10} fill="rgba(99,102,241,0.16)" stroke="#6366f1" strokeWidth={2.5} />
          <circle cx={point.x} cy={point.y} r={3.5} fill="#6366f1" />
        </g>
      ))}
      {screenPoints.length === 1 && cursorScreen && (
        <>
          <line x1={screenPoints[0].x} y1={screenPoints[0].y} x2={cursorScreen.x} y2={cursorScreen.y} stroke="#6366f1" strokeWidth={3} strokeDasharray="8 5" />
          <circle cx={cursorScreen.x} cy={cursorScreen.y} r={9} fill="rgba(99,102,241,0.14)" stroke="#6366f1" strokeWidth={2.5} />
        </>
      )}
    </g>
  );
}

function SnapMarker({ snap, viewport }) {
  const screen = planToScreenPoint(snap.x, snap.y, viewport);
  const color = snap.type === "intersection" ? "#7c3aed" : snap.type === "alignment" ? "#2563eb" : "#f97316";
  return (
    <g style={{ pointerEvents: "none" }}>
      <circle cx={screen.x} cy={screen.y} r={9} fill="none" stroke={color} strokeWidth={2.5} />
      <line x1={screen.x - 12} y1={screen.y} x2={screen.x - 4} y2={screen.y} stroke={color} strokeWidth={2} />
      <line x1={screen.x + 4} y1={screen.y} x2={screen.x + 12} y2={screen.y} stroke={color} strokeWidth={2} />
      <line x1={screen.x} y1={screen.y - 12} x2={screen.x} y2={screen.y - 4} stroke={color} strokeWidth={2} />
      <line x1={screen.x} y1={screen.y + 4} x2={screen.x} y2={screen.y + 12} stroke={color} strokeWidth={2} />
      <text x={screen.x + 13} y={screen.y - 9} fontSize={11} fontWeight={800} fill={color} stroke="#fff" strokeWidth={3} paintOrder="stroke">
        {snap.label || "Snap"}
      </text>
    </g>
  );
}

function SnapGuide({ guide, viewport, width, height }) {
  if (guide.type === "vertical") {
    const a = planToScreenPoint(guide.x, 0, viewport);
    const b = planToScreenPoint(guide.x, height, viewport);
    return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#2563eb" strokeWidth={1.5} strokeDasharray="6 6" opacity={0.65} />;
  }
  const a = planToScreenPoint(0, guide.y, viewport);
  const b = planToScreenPoint(width, guide.y, viewport);
  return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#2563eb" strokeWidth={1.5} strokeDasharray="6 6" opacity={0.65} />;
}

function formatLiveDistance(lengthPx, ppm) {
  if (ppm > 0) {
    return formatMillimetres(pxToMillimetres(lengthPx, ppm));
  }
  return `${Math.round(lengthPx).toLocaleString()} px`;
}

function LiveDistanceLabel({ calibrating, draw, cursor, ppm, viewport }) {
  const start = calibrating?.points?.[0] || draw?.points?.[0] || null;
  if (!start || !cursor) return null;
  const screen = planToScreenPoint(cursor.x, cursor.y, viewport);
  const text = formatLiveDistance(distancePx(start, cursor), ppm);
  const boxWidth = Math.max(58, text.length * 8 + 16);
  return (
    <g style={{ pointerEvents: "none" }}>
      <rect x={screen.x + 12} y={screen.y - 30} width={boxWidth} height={22} rx={6} fill="rgba(15,23,42,0.88)" />
      <text x={screen.x + 12 + boxWidth / 2} y={screen.y - 15} textAnchor="middle" fontSize={12} fontWeight={900} fill="#fff">
        {text}
      </text>
    </g>
  );
}

function scaleStatusText(scale) {
  const ppm = getPixelsPerUnit(scale);
  if (!(ppm > 0) || scale?.accepted === false) return "Scale not set";
  const approxRatio = approximateScaleRatio(scale);
  if (approxRatio) return `Scale set: 1:${approxRatio.toLocaleString()} approx`;
  if (scale.method === "preset" && scale.ratio) return `Scale set: 1:${scale.ratio} approx`;
  if (scale.method === "preset" && scale.preset) return `Scale set: ${scale.preset}`;
  return "Scale set";
}

function approximateScaleRatio(scale) {
  if (scale?.ratio) return Math.round(Number(scale.ratio));
  const ppm = getPixelsPerUnit(scale);
  if (!(ppm > 0)) return null;
  const ratio = (RENDER_DPI / 25.4) * 1000 / ppm;
  return ratio > 0 ? Math.round(ratio) : null;
}

function DebugPanel({ page, tool, zoom, pan, mouseDebug, selectedVertex, scale }) {
  const screen = mouseDebug.screen;
  const world = mouseDebug.world;
  const snap = mouseDebug.nearestSnap;
  const scaleText = scaleStatusText(scale);
  const selectedText = selectedVertex ? `${selectedVertex.overlayId}:${selectedVertex.index}` : "-";
  const snapText = snap ? `${snap.type}:${snap.overlayId || "plan"}${snap.index != null ? `:${snap.index}` : ""}` : "-";
  const ppm = getPixelsPerUnit(scale);
  return (
    <div style={S.debugPanel}>
      <div><strong>original</strong> {Math.round(page?.originalWidth || 0)}, {Math.round(page?.originalHeight || 0)}</div>
      <div><strong>originalPageWidth</strong> {Math.round(page?.originalWidth || 0)}</div>
      <div><strong>originalPageHeight</strong> {Math.round(page?.originalHeight || 0)}</div>
      <div><strong>metadataRotation</strong> {page?.metadataRotation ?? 0}</div>
      <div><strong>detectedRotationSuggestion</strong> {page?.detectedRotation ?? 0}</div>
      <div><strong>userRotation</strong> {page?.userRotation ?? 0}</div>
      <div><strong>finalRotation</strong> {page?.finalRotation ?? page?.planRotation ?? 0}</div>
      <div><strong>page.rotation</strong> {page?.rotation ?? page?.planRotation ?? page?.finalRotation ?? 0}</div>
      <div><strong>orientationConfirmed</strong> {String(Boolean(page?.orientationConfirmed))}</div>
      <div><strong>normalized</strong> {Math.round(page?.normalizedWidth || page?.naturalWidth || 0)}, {Math.round(page?.normalizedHeight || page?.naturalHeight || 0)}</div>
      <div><strong>viewportWidth</strong> {Math.round(page?.viewportWidth || page?.normalizedWidth || page?.naturalWidth || 0)}</div>
      <div><strong>viewportHeight</strong> {Math.round(page?.viewportHeight || page?.normalizedHeight || page?.naturalHeight || 0)}</div>
      <div><strong>canvasPixelWidth</strong> {Math.round(page?.canvasPixelWidth || page?.imageWidth || page?.normalizedWidth || 0)}</div>
      <div><strong>canvasPixelHeight</strong> {Math.round(page?.canvasPixelHeight || page?.imageHeight || page?.normalizedHeight || 0)}</div>
      <div><strong>canvasCssWidth</strong> {Math.round(page?.canvasCssWidth || page?.normalizedWidth || page?.naturalWidth || 0)}</div>
      <div><strong>canvasCssHeight</strong> {Math.round(page?.canvasCssHeight || page?.normalizedHeight || page?.naturalHeight || 0)}</div>
      <div><strong>renderScale</strong> {Number(page?.renderScale || 0).toFixed(4)}</div>
      <div><strong>zoom</strong> {(zoom * 100).toFixed(1)}%</div>
      <div><strong>panX</strong> {pan.x.toFixed(1)}</div>
      <div><strong>panY</strong> {pan.y.toFixed(1)}</div>
      <div><strong>scale.pixelsPerMetre</strong> {ppm ? ppm.toFixed(4) : "-"}</div>
      <div><strong>tool</strong> {tool}</div>
      <div><strong>screen</strong> {screen ? `${Math.round(screen.x)}, ${Math.round(screen.y)}` : "-"}</div>
      <div><strong>last plan coordinate</strong> {world ? `${world.x.toFixed(1)}, ${world.y.toFixed(1)}` : "-"}</div>
      <div><strong>selected</strong> {selectedText}</div>
      <div><strong>snap</strong> {snapText}</div>
      <div><strong>scale</strong> {scaleText}</div>
    </div>
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
  liveRotationLabel: { position: "absolute", top: 12, left: 12, zIndex: 90, background: "#fff200", color: "#111827", border: "4px solid #111827", padding: "10px 14px", borderRadius: 4, fontSize: 24, fontWeight: 1000, lineHeight: 1, pointerEvents: "none", boxShadow: "0 8px 18px rgba(15,23,42,0.24)" },
  viewport: { position: "absolute", inset: 0, overflow: "hidden", touchAction: "none", border: "8px solid #ff00ff", boxSizing: "border-box" },
  surface: { position: "absolute", left: 0, top: 0, background: "#fff", boxShadow: "0 10px 35px rgba(15,23,42,0.18)", transformOrigin: "0 0", willChange: "transform", contain: "layout paint style" },
  image: { position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", objectFit: "fill", pointerEvents: "none", backfaceVisibility: "hidden", imageRendering: "auto" },
  overlay: { position: "absolute", inset: 0, display: "block" },
  empty: { width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f8fafc", color: "#475569" },
  emptyTitle: { fontSize: 16, fontWeight: 900, color: "#0f172a" },
  emptySub: { fontSize: 12, marginTop: 6 },
  gate: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(248,250,252,0.76)", zIndex: 30, pointerEvents: "none" },
  gateCard: { background: "#fff", border: "1.5px solid #bfdbfe", borderRadius: 8, padding: "18px 22px", maxWidth: 300, textAlign: "center", boxShadow: "0 8px 22px rgba(15,23,42,0.12)" },
  banner: { position: "absolute", bottom: 18, left: "50%", transform: "translateX(-50%)", background: "rgba(15,23,42,0.9)", color: "#f8fafc", padding: "8px 16px", borderRadius: 999, fontSize: 13, fontWeight: 800, zIndex: 50, pointerEvents: "none", whiteSpace: "nowrap" },
  warningBanner: { position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", maxWidth: "min(680px, calc(100% - 32px))", background: "#fffbeb", color: "#92400e", border: "1px solid #fbbf24", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 900, zIndex: 65, pointerEvents: "none", textAlign: "center", boxShadow: "0 8px 18px rgba(15,23,42,0.12)" },
  controls: { position: "absolute", right: 16, bottom: 16, zIndex: 60, display: "flex", flexDirection: "column", gap: 4, padding: 8, borderRadius: 10, background: "rgba(15,23,42,0.9)", boxShadow: "0 8px 20px rgba(15,23,42,0.35)" },
  ctrlBtn: { width: 42, height: 36, border: "none", borderRadius: 7, background: "transparent", color: "#f8fafc", fontSize: 12, fontWeight: 900, cursor: "pointer" },
  ctrlSep: { height: 1, background: "rgba(255,255,255,0.16)", margin: "2px 0" },
  badge: { position: "absolute", left: 16, bottom: 16, zIndex: 60, background: "rgba(15,23,42,0.75)", color: "#e2e8f0", borderRadius: 7, padding: "5px 9px", fontSize: 12, fontWeight: 800, pointerEvents: "none" },
  scaleBadge: { position: "absolute", left: 16, bottom: 48, zIndex: 60, borderRadius: 7, padding: "6px 10px", fontSize: 12, fontWeight: 900, pointerEvents: "none", boxShadow: "0 4px 14px rgba(15,23,42,0.14)" },
  scaleBadgeSet: { background: "#dcfce7", color: "#166534", border: "1px solid #86efac" },
  scaleBadgeMissing: { background: "#fef9c3", color: "#92400e", border: "1px solid #fde68a" },
  debugPanel: { position: "absolute", left: 16, top: 16, zIndex: 70, minWidth: 260, display: "grid", gap: 4, padding: 10, borderRadius: 8, background: "rgba(15,23,42,0.88)", color: "#e2e8f0", fontSize: 12, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", lineHeight: 1.35, pointerEvents: "none" },
};
