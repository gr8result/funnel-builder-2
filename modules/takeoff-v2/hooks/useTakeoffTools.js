// All takeoff-tool interaction state (Set Scale / Measure Length / Detect,
// Edit & Confirm Exterior Walls / Confirm Area / Clear Measurements / Undo)
// for the currently selected page. Plain useState/useCallback, matching the
// rest of modules/takeoff-v2 — no reducer/context introduced.
//
// This hook never touches screen pixels or pan directly — callers
// (PlanViewer) convert screen events to page-space points via
// screenToPagePoint before calling in here, and pass the current zoomScale
// and page.rotation only so snap tolerances (given in screen pixels) and
// axis-lock intent (a screen concept) can be resolved correctly.

import { useCallback, useEffect, useMemo, useState } from "react";
import { generateId, createWallVertex, createMeasurement, createArea, createOpening, createDefaultLayerVisibility, CURRENT_EXTERIOR_WALLS_SCHEMA_VERSION, EXTERIOR_SOURCE_MANUAL_TRACE_V2 } from "../types.js";
import { distance, midpoint } from "../takeoff/geometry.js";
import { computeCalibration } from "../takeoff/scaleCalibration.js";
import { lengthMm } from "../takeoff/measurement.js";
import { computeAxisLock, applyAxisConstraint, axisAngleDegrees } from "../takeoff/axisLock.js";
import { softAxisSnap } from "../takeoff/wallDrawing.js";
import { bestSnapCandidate } from "../takeoff/planSnap.js";
import { buildSnapCandidates, snapPoint } from "../takeoff/snapping.js";
import {
  addSegment,
  moveVertex,
  deleteVertex,
  deleteSegment,
  joinVertices,
  closePerimeter,
  findOpenEndpoints,
  isPerimeterClosed,
  changeSegmentWallType,
  setSegmentThickness,
  segmentToWallSegment,
  sumSegmentLengthsMm,
  splitSegment,
} from "../takeoff/wallGraph.js";
import { findNearestWallSegment, computeOpeningWidthMm, reattachOpeningsToWall, projectOntoWall } from "../takeoff/openingPlacement.js";
import {
  validateExteriorWallsForConfirmation,
  validatePerimeterForArea,
  calculatePolygonAreaM2,
  calculatePerimeterMm,
} from "../takeoff/areaCalculation.js";
import { polygonAreaDocUnits2, isSimplePolygon } from "../takeoff/geometry.js";
import { offsetPolygonInward, offsetPolygonOutward } from "../takeoff/polygonOffset.js";
import { defaultPlanRegion, normalizeRegionCorners } from "../takeoff/planRegion.js";
import { detectRoomBoundary, rectFromCorners } from "../takeoff/roomBoundaryDetection.js";

const UNDO_LIMIT = 50;
const VERTEX_HIT_TOLERANCE_SCREEN_PX = 10;
const SNAP_TOLERANCE_SCREEN_PX = 12; // spec: "10-14 screen pixels"
const MANUAL_SNAP = { kind: "manual", lineId: null, lineIds: null };
const EMPTY_WALL_GRAPH = { vertices: [], segments: [], isClosed: false, confirmed: false, confirmedAt: null, detectionConfidence: null, detectedSnapshot: null };
const AUTO_DETECTION_DISABLED_MESSAGE = "Automatic exterior detection is temporarily disabled because it is not reliable enough. Use Trace Exterior to select the outside building corners accurately.";
const OPENING_TOOLS = ["window", "internal-door", "external-door", "sliding-door", "garage-door", "open-opening"];

function snapCandidateToMetadata(candidate) {
  if (!candidate) return MANUAL_SNAP;
  return { kind: candidate.type, lineId: candidate.lineId || null, lineIds: candidate.lineIds || null };
}

function wallFieldForTool(tool) {
  if (tool === "exterior-wall") return "exteriorWalls";
  if (tool === "internal-wall") return "internalWalls";
  return null;
}

function vertexBelongsToField(page, field, vertexId) {
  return (page?.[field]?.vertices || []).some((v) => v.id === vertexId);
}

function wallGraphList(page) {
  return [
    { key: "exterior", vertices: page?.exteriorWalls?.vertices || [], segments: page?.exteriorWalls?.segments || [] },
    { key: "internal", vertices: page?.internalWalls?.vertices || [], segments: page?.internalWalls?.segments || [] },
  ];
}

function vertexTouchesLockedSegment(graph, vertexId) {
  return Boolean(graph?.segments?.some((segment) => segment.locked && (segment.aId === vertexId || segment.bId === vertexId)));
}

function isAutomaticCandidateSegment(segment) {
  return segment?.source === "automatic" && segment.confirmed === false;
}

function activeWallSegments(graph) {
  return (graph?.segments || []).filter((segment) => !isAutomaticCandidateSegment(segment));
}

function activeWallVertexIds(graph) {
  const ids = new Set();
  activeWallSegments(graph).forEach((segment) => {
    ids.add(segment.aId);
    ids.add(segment.bId);
  });
  return ids;
}

function activeWallGraph(graph) {
  if (!graph) return null;
  const segments = activeWallSegments(graph);
  const vertexIds = new Set();
  segments.forEach((segment) => {
    vertexIds.add(segment.aId);
    vertexIds.add(segment.bId);
  });
  const vertices = (graph.vertices || []).filter((vertex) => vertexIds.has(vertex.id));
  return { ...graph, vertices, segments, isClosed: isPerimeterClosed(vertices, segments) };
}

function pageWithActiveExteriorWalls(page) {
  if (!page?.exteriorWalls) return page;
  return { ...page, exteriorWalls: activeWallGraph(page.exteriorWalls) };
}

function exteriorGraphMetadata(field, current = {}) {
  if (field !== "exteriorWalls") return {};
  return {
    boundaryBasis: current.boundaryBasis || "outside",
    wallThicknessMm: current.wallThicknessMm ?? 200,
    schemaVersion: CURRENT_EXTERIOR_WALLS_SCHEMA_VERSION,
    source: EXTERIOR_SOURCE_MANUAL_TRACE_V2,
    detectionConfidence: null,
    detectionCompleteness: null,
    connectedComponents: null,
    openGaps: null,
    detectionWarnings: [],
    detectionUseful: null,
    detectionDiagnostics: null,
    exteriorPerimeter: null,
    detectedSnapshot: null,
  };
}

function distancePointToSegment(point, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lengthSquared = abx * abx + aby * aby;
  if (lengthSquared === 0) return distance(point, a);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * abx + (point.y - a.y) * aby) / lengthSquared));
  return distance(point, { x: a.x + abx * t, y: a.y + aby * t });
}

export function tracedSegmentHasWallEvidence(from, to, planGeometryIndex, toleranceDocUnits = 8) {
  if (!from || !to || !Array.isArray(planGeometryIndex?.segments)) return false;
  const traceLength = distance(from, to);
  if (!(traceLength > 0)) return false;
  return planGeometryIndex.segments.some((segment) => {
    if (!segment?.a || !segment?.b) return false;
    const supportLength = distance(segment.a, segment.b);
    if (supportLength < Math.min(8, traceLength * 0.2)) return false;
    const endpointsNearTrace = distancePointToSegment(segment.a, from, to) <= toleranceDocUnits && distancePointToSegment(segment.b, from, to) <= toleranceDocUnits;
    const traceEndpointsNearLine = distancePointToSegment(from, segment.a, segment.b) <= toleranceDocUnits && distancePointToSegment(to, segment.a, segment.b) <= toleranceDocUnits;
    const midTrace = midpoint(from, to);
    const midSupport = midpoint(segment.a, segment.b);
    const midSupported = distancePointToSegment(midTrace, segment.a, segment.b) <= toleranceDocUnits || distancePointToSegment(midSupport, from, to) <= toleranceDocUnits;
    return midSupported && (endpointsNearTrace || traceEndpointsNearLine);
  });
}

export function useTakeoffTools({ page, commitPage, planGeometryIndex = null }) {
  const [activeTool, setActiveToolState] = useState("select");

  // Set Scale / Measure Length shared point-capture state.
  const [pendingPoint, setPendingPoint] = useState(null); // { point, snap } — first endpoint, once validly placed
  const [hoverPreview, setHoverPreview] = useState(null); // { point, axis, angleDegrees, snap } | null — live preview
  const [forcedAxis, setForcedAxisState] = useState(null); // "horizontal" | "vertical" | null, from H/V keys
  const [manualPlacementEnabled, setManualPlacementEnabled] = useState(false);
  const [measureAngleMode, setMeasureAngleMode] = useState("orthogonal"); // "orthogonal" | "free"
  const [calibrationDialog, setCalibrationDialog] = useState(null); // { pointA, pointB, axis, snapA, snapB, documentDistance }

  // Wall editing (exterior *or* internal — selectedField says which graph
  // selectedVertexId/selectedSegmentId belong to). Chain-draw preview reuses
  // a separate simple hover point — it has its own snapping via
  // takeoff/snapping.js, unrelated to the plan-geometry-aware pipeline above.
  const [hoverPoint, setHoverPoint] = useState(null);
  const [areaDialogOpen, setAreaDialogOpen] = useState(false);
  const [selectedField, setSelectedField] = useState("exteriorWalls"); // "exteriorWalls" | "internalWalls"
  const [selectedVertexId, setSelectedVertexId] = useState(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState(null);
  const [selectedOpeningId, setSelectedOpeningId] = useState(null);
  const [draggingVertex, setDraggingVertex] = useState(null); // { id, x, y }
  const [closeShapeError, setCloseShapeError] = useState(null);
  const [closeShapeSuccessMessage, setCloseShapeSuccessMessage] = useState("");
  const [clearExteriorConfirmOpen, setClearExteriorConfirmOpen] = useState(false);
  const [planRegionDraftCorner, setPlanRegionDraftCorner] = useState(null);
  const [planRegionHoverPoint, setPlanRegionHoverPoint] = useState(null);
  const [wallDetectionBusy, setWallDetectionBusy] = useState(false);
  const [wallDetectionMessage, setWallDetectionMessage] = useState("");
  const [wallDetectionCode, setWallDetectionCode] = useState(null); // "USER_AUTH_REQUIRED"|"PROVIDER_NOT_CONFIGURED"|"PROVIDER_AUTH_FAILED"|"PROVIDER_ERROR"|null
  const [wallDetectionStatus, setWallDetectionStatus] = useState("idle"); // "idle"|"detecting"|"unavailable"
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  // Manual Exterior Wall / Internal Wall drawing (click-and-connect chain).
  const [wallDrawChainVertexId, setWallDrawChainVertexId] = useState(null);
  const [wallDrawHoverPreview, setWallDrawHoverPreview] = useState(null); // { point, axis, angleDegrees, locked, snap }
  const [pendingUnsupportedExteriorSegment, setPendingUnsupportedExteriorSegment] = useState(null);

  // Window/Internal Door/External Door/Sliding Door/Garage Door/Open Opening
  // placement (click start, click end, both projected onto the hovered wall).
  const [openingHostWall, setOpeningHostWall] = useState(null); // { wallId, wallGraph, start, end } — the wall under the pointer
  const [openingStart, setOpeningStart] = useState(null); // Point | null — first click, awaiting the second

  // Manual Area tracing (click each corner, Finish/first-point closes it).
  const [areaMode, setAreaMode] = useState("manual-polygon"); // "room-detect" | "rectangle" | "manual-polygon"
  const [areaDraftVertices, setAreaDraftVertices] = useState([]);
  const [areaHoverPoint, setAreaHoverPoint] = useState(null);
  const [areaSearchDraft, setAreaSearchDraft] = useState(null); // { start, end } | null

  const [layerVisibility, setLayerVisibilityState] = useState(() => ({ ...createDefaultLayerVisibility(), ...(page?.layerVisibility || {}) }));

  const resetDrafts = useCallback(() => {
    setPendingPoint(null);
    setHoverPreview(null);
    setForcedAxisState(null);
    setManualPlacementEnabled(false);
    setCalibrationDialog(null);
    setHoverPoint(null);
    setSelectedVertexId(null);
    setSelectedSegmentId(null);
    setSelectedOpeningId(null);
    setDraggingVertex(null);
    setWallDrawChainVertexId(null);
    setWallDrawHoverPreview(null);
    setPendingUnsupportedExteriorSegment(null);
    setOpeningHostWall(null);
    setOpeningStart(null);
    setDraggingOpening(null);
    setAreaDraftVertices([]);
    setAreaHoverPoint(null);
    setAreaSearchDraft(null);
    setManualAreaDialogOpen(false);
    setCloseShapeError(null);
    setCloseShapeSuccessMessage("");
    setPlanRegionDraftCorner(null);
    setPlanRegionHoverPoint(null);
  }, []);

  const setActiveTool = useCallback((tool) => {
    resetDrafts();
    setActiveToolState(tool);
  }, [resetDrafts]);

  const cancelWallDrawPreview = useCallback(() => {
    setWallDrawHoverPreview(null);
    setPendingUnsupportedExteriorSegment(null);
    setForcedAxisState(null);
    setWallDetectionCode(null);
    setWallDetectionMessage("");
    setWallDetectionStatus("idle");
  }, []);

  // Esc cancels whatever is in progress without leaving the current tool
  // (including an unfinished wall-drawing segment, per spec — the run itself
  // is not discarded, only the segment still being placed); H/V force the
  // calibration/measurement/wall-drawing axis while placing a point; Delete
  // removes whatever is currently selected under the Edit tool (or the old
  // exterior-only edit-walls tool, kept for backward compatibility).
  useEffect(() => {
    function onKeyDown(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
        return;
      }
      if (event.key === "Escape") {
        if (activeTool === "exterior-wall" || activeTool === "internal-wall") cancelWallDrawPreview();
        else resetDrafts();
        return;
      }
      if (event.key === "Enter" && activeTool === "exterior-wall") {
        event.preventDefault();
        if (canCloseShape) closeWallPerimeter("exteriorWalls");
        else finishWallDrawing();
        return;
      }
      if ((activeTool === "set-scale" || activeTool === "measure" || activeTool === "exterior-wall" || activeTool === "internal-wall") && (pendingPoint || wallDrawChainVertexId)) {
        if (event.key === "h" || event.key === "H") { setForcedAxisState("horizontal"); return; }
        if (event.key === "v" || event.key === "V") { setForcedAxisState("vertical"); return; }
      }
      if ((event.key === "Delete" || event.key === "Backspace") && (activeTool === "edit-walls" || activeTool === "edit")) {
        if (selectedVertexId) deleteSelectedWallVertex();
        else if (selectedSegmentId) deleteSelectedWallSegment();
        else if (selectedOpeningId) deleteSelectedOpening();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool, pendingPoint, wallDrawChainVertexId, selectedVertexId, selectedSegmentId, selectedOpeningId, resetDrafts, cancelWallDrawPreview]);

  // Two-stack undo/redo: undo moves the current value onto redoStack before
  // applying the popped previous value; redo is the mirror image. Every
  // existing mutating call site already funnels through pushUndo, so this
  // extension needs no other call-site changes.
  const pushUndo = useCallback((field, previousValue) => {
    setUndoStack((prev) => [...prev.slice(-(UNDO_LIMIT - 1)), { field, previousValue }]);
    setRedoStack([]);
  }, []);

  const undo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setRedoStack((redoPrev) => [...redoPrev, { field: last.field, previousValue: page?.[last.field] ?? null }]);
      commitPage({ [last.field]: last.previousValue });
      return prev.slice(0, -1);
    });
  }, [commitPage, page]);

  const redo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setUndoStack((undoPrev) => [...undoPrev, { field: last.field, previousValue: page?.[last.field] ?? null }]);
      commitPage({ [last.field]: last.previousValue });
      return prev.slice(0, -1);
    });
  }, [commitPage, page]);

  // Generic wall-graph mutation, parameterized by which field ("exteriorWalls"
  // or "internalWalls") to operate on — starts from an empty graph if the
  // field doesn't exist yet (manual drawing on a blank page has no prior
  // exteriorWalls/internalWalls record to mutate, unlike the old AI-detection
  // flow which always populated exteriorWalls first).
  const mutateWallField = useCallback((field, mutator, extraPatch = {}) => {
    const current = page?.[field] || EMPTY_WALL_GRAPH;
    pushUndo(field, page?.[field] ?? null);
    const graph = mutator({ vertices: current.vertices, segments: current.segments });
    const isClosed = isPerimeterClosed(graph.vertices, graph.segments);
    const metadata = exteriorGraphMetadata(field, current);
    commitPage({ [field]: { ...metadata, ...current, vertices: graph.vertices, segments: graph.segments, isClosed, ...metadata }, ...extraPatch });
  }, [page, commitPage, pushUndo]);

  // Kept for the existing exterior-only "edit-walls" tool/tests — identical
  // behavior to before, now implemented via mutateWallField.
  const mutateWalls = useCallback((mutator) => {
    if (!page?.exteriorWalls) return;
    mutateWallField("exteriorWalls", mutator);
  }, [page, mutateWallField]);

  // ---- Set Scale / Measure Length: shared snap+axis-lock resolution ------
  //
  // `anchor` is the already-placed first point (null when resolving point A).
  // `requireAxisLock` is true for calibration's second point and for Measure
  // Length in Orthogonal mode; false for point A and for Free-angle measuring.
  // Search for a snap target near the *raw*, unconstrained pointer position
  // (not the already-axis-constrained candidate) — per spec, the endpoint
  // must snap to real geometry near where the user is pointing, then that
  // candidate's free coordinate gets projected onto the locked axis so the
  // final point is exactly on-axis even if the detected feature was a
  // fraction off.
  //
  // Always returns an object (never null) so the overlay can still show a
  // "no valid snap target" crosshair at the raw pointer position — `valid`
  // is false, and `point` is null, whenever there's no candidate and manual
  // placement hasn't been deliberately enabled; callers must check `valid`
  // before accepting/placing a point.
  const resolvePlacement = useCallback((rawPoint, { rotation = 0, zoomScale = 1, anchor = null, requireAxisLock = false } = {}) => {
    const candidate = bestSnapCandidate(rawPoint, {
      toleranceScreenPx: SNAP_TOLERANCE_SCREEN_PX,
      zoomScale,
      planGeometryIndex,
      page,
    });
    const valid = Boolean(candidate) || manualPlacementEnabled;
    const snap = candidate ? snapCandidateToMetadata(candidate) : (manualPlacementEnabled ? MANUAL_SNAP : null);
    const freeCoordinateSource = candidate ? candidate.point : rawPoint;

    if (!requireAxisLock || !anchor) {
      return { point: valid ? freeCoordinateSource : null, rawPoint, axis: null, angleDegrees: null, snap, valid };
    }

    const { axis } = computeAxisLock({ pointA: anchor, rawPointB: rawPoint, rotation, forcedAxis });
    const point = valid ? applyAxisConstraint(anchor, freeCoordinateSource, axis) : null;
    return { point, rawPoint, axis, angleDegrees: axisAngleDegrees(axis), snap, valid };
  }, [planGeometryIndex, page, manualPlacementEnabled, forcedAxis]);

  const requiresAxisLockFor = useCallback((tool) => {
    if (tool === "set-scale") return true;
    if (tool === "measure") return measureAngleMode === "orthogonal";
    return false;
  }, [measureAngleMode]);

  const updatePointerHover = useCallback((rawPoint, { rotation = 0, zoomScale = 1 } = {}) => {
    if (activeTool !== "set-scale" && activeTool !== "measure") return;
    const requireAxisLock = Boolean(pendingPoint) && requiresAxisLockFor(activeTool);
    const preview = resolvePlacement(rawPoint, { rotation, zoomScale, anchor: pendingPoint?.point, requireAxisLock });
    setHoverPreview(preview);
  }, [activeTool, pendingPoint, requiresAxisLockFor, resolvePlacement]);

  const placePointerPoint = useCallback((rawPoint, { rotation = 0, zoomScale = 1 } = {}) => {
    if (activeTool === "measure" && !page?.calibration) return;
    if (activeTool !== "set-scale" && activeTool !== "measure") return;

    if (!pendingPoint) {
      const resolved = resolvePlacement(rawPoint, { rotation, zoomScale, anchor: null, requireAxisLock: false });
      if (!resolved.valid) return; // no valid snap target yet — keep waiting (or the user enables manual placement)
      setPendingPoint({ point: resolved.point, snap: resolved.snap });
      setHoverPreview(null);
      return;
    }

    const requireAxisLock = requiresAxisLockFor(activeTool);
    const resolved = resolvePlacement(rawPoint, { rotation, zoomScale, anchor: pendingPoint.point, requireAxisLock });
    if (!resolved.valid) return;

    if (activeTool === "set-scale") {
      const documentDistance = resolved.axis === "horizontal"
        ? Math.abs(resolved.point.x - pendingPoint.point.x)
        : Math.abs(resolved.point.y - pendingPoint.point.y);
      setCalibrationDialog({
        pointA: pendingPoint.point,
        pointB: resolved.point,
        axis: resolved.axis,
        snapA: pendingPoint.snap,
        snapB: resolved.snap,
        documentDistance,
      });
    } else {
      const measurement = createMeasurement({
        id: generateId("measure"),
        pointA: pendingPoint.point,
        pointB: resolved.point,
        lengthMm: lengthMm(pendingPoint.point, resolved.point, page.calibration.mmPerDocumentUnit),
      });
      pushUndo("measurements", page.measurements || []);
      commitPage({ measurements: [...(page.measurements || []), measurement] });
    }
    setPendingPoint(null);
    setHoverPreview(null);
    setForcedAxisState(null);
  }, [activeTool, page, pendingPoint, resolvePlacement, requiresAxisLockFor, commitPage, pushUndo]);

  const toggleManualPlacement = useCallback(() => {
    setManualPlacementEnabled((prev) => !prev);
  }, []);

  const confirmCalibration = useCallback((actualLengthMm) => {
    if (!calibrationDialog || !page) return;
    const calibration = computeCalibration({
      pageId: page.id,
      pointA: calibrationDialog.pointA,
      pointB: calibrationDialog.pointB,
      axis: calibrationDialog.axis,
      actualLengthMm,
      snapA: calibrationDialog.snapA,
      snapB: calibrationDialog.snapB,
    });
    commitPage({ calibration });
    resetDrafts();
    setActiveToolState("select");
  }, [calibrationDialog, page, commitPage, resetDrafts]);

  const cancelCalibration = useCallback(() => {
    resetDrafts();
  }, [resetDrafts]);

  // Keeps point A (and its snap), drops back into placing point B — most
  // miscalibrations are about the second point, so this avoids re-doing a
  // perfectly good first snap.
  const adjustCalibrationPoints = useCallback(() => {
    if (!calibrationDialog) return;
    setPendingPoint({ point: calibrationDialog.pointA, snap: calibrationDialog.snapA });
    setCalibrationDialog(null);
    setHoverPreview(null);
    setForcedAxisState(null);
  }, [calibrationDialog]);

  const clearScale = useCallback(() => {
    commitPage({ calibration: null });
  }, [commitPage]);

  const clearMeasurements = useCallback(() => {
    pushUndo("measurements", page?.measurements || []);
    commitPage({ measurements: [] });
  }, [page, commitPage, pushUndo]);

  // ---- Exterior walls: detection -----------------------------------------

  // Automatic detection is a strict accelerator: a failure here (missing
  // session, 401, missing OPENAI_API_KEY, network error) only ever sets
  // wallDetectionStatus to "unavailable" with an honest message — every
  // manual tool keeps working regardless, and nothing already drawn/confirmed
  // is touched.
  const runWallDetection = useCallback(async ({ imageDataUrl, imageWidth, imageHeight, viewport, planGeometryIndex: snapshotPlanGeometryIndex = null } = {}) => {
    void imageDataUrl;
    void imageWidth;
    void imageHeight;
    void viewport;
    void snapshotPlanGeometryIndex;
    setWallDetectionBusy(true);
    setWallDetectionStatus("unavailable");
    setWallDetectionMessage(AUTO_DETECTION_DISABLED_MESSAGE);
    setWallDetectionCode("AUTO_DISABLED");
    try {
      await Promise.resolve();
    } finally {
      setWallDetectionBusy(false);
    }
  }, []);
  // Results-panel/toolbar "Accept All High-Confidence Segments" — confirms
  // every unreviewed automatic segment whose per-segment confidence is
  // "high" in one action, without touching medium/low-confidence ones that
  // still need a human look.
  const highConfidenceUnconfirmedCount = useMemo(() => {
    const graph = page?.exteriorWalls;
    if (!graph) return 0;
    return graph.segments.filter((s) => s.source === "automatic" && !s.confirmed && s.confidence === "high").length;
  }, [page]);

  const automaticCandidateCount = useMemo(() => {
    const graph = page?.exteriorWalls;
    if (!graph) return 0;
    return graph.segments.filter(isAutomaticCandidateSegment).length;
  }, [page]);

  const activeExteriorWallSegmentCount = useMemo(() => activeWallSegments(page?.exteriorWalls).length, [page]);
  const activeInternalWallSegmentCount = useMemo(() => activeWallSegments(page?.internalWalls).length, [page]);
  const activeExteriorWallsClosed = useMemo(() => {
    const graph = activeWallGraph(page?.exteriorWalls);
    return Boolean(graph?.isClosed);
  }, [page]);

  const acceptAllHighConfidenceSegments = useCallback((field = "exteriorWalls") => {
    const graph = page?.[field];
    if (!graph) return;
    mutateWallField(field, (g) => ({
      vertices: g.vertices,
      segments: g.segments.map((s) => (s.confidence === "high" ? { ...s, confirmed: true } : s)),
    }));
  }, [page, mutateWallField]);

  const reviewAutomaticCandidates = useCallback(() => {
    const next = { ...(page?.layerVisibility || layerVisibility), automaticCandidates: true };
    setLayerVisibilityState(next);
    commitPage({ layerVisibility: next });
    setActiveTool("edit-walls");
  }, [page, layerVisibility, commitPage, setActiveTool]);

  const rejectAutomaticCandidates = useCallback((field = "exteriorWalls") => {
    const graph = page?.[field];
    if (!graph) return;
    const candidateIds = new Set(graph.segments.filter(isAutomaticCandidateSegment).map((segment) => segment.id));
    if (candidateIds.size === 0) return;
    const next = { ...(page?.layerVisibility || layerVisibility), automaticCandidates: false };
    mutateWallField(field, (g) => {
      const segments = g.segments.filter((segment) => !candidateIds.has(segment.id));
      const vertexIds = new Set();
      segments.forEach((segment) => {
        vertexIds.add(segment.aId);
        vertexIds.add(segment.bId);
      });
      return {
        vertices: g.vertices.filter((vertex) => vertexIds.has(vertex.id)),
        segments,
      };
    }, { layerVisibility: next });
    setLayerVisibilityState(next);
    setWallDetectionStatus("idle");
    setWallDetectionMessage("");
  }, [page, mutateWallField, layerVisibility]);

  // ---- Plan region: marks the actual floor-plan area, excluding notes /
  // title block / legends / schedules / the sheet border from automatic
  // detection (see takeoff/planRegion.js and wallDetection.js). A simple
  // click-two-corners rectangle, mirroring the app's other two-point tools
  // (Set Scale) rather than a drag gesture, for consistency with the rest
  // of the pointer-event dispatch in PlanViewer.jsx.
  const suggestedPlanRegion = useMemo(() => {
    if (page?.planRegion) return page.planRegion;
    return defaultPlanRegion(page?.sourceWidth, page?.sourceHeight);
  }, [page]);

  const updatePlanRegionHover = useCallback((rawPoint) => {
    setPlanRegionHoverPoint(rawPoint);
  }, []);

  const handlePlanRegionClick = useCallback((rawPoint) => {
    if (!planRegionDraftCorner) {
      setPlanRegionDraftCorner(rawPoint);
      return;
    }
    const rect = normalizeRegionCorners(planRegionDraftCorner, rawPoint);
    pushUndo("planRegion", page?.planRegion ?? null);
    commitPage({ planRegion: { ...rect, confirmed: true, source: "manual" } });
    setPlanRegionDraftCorner(null);
    setPlanRegionHoverPoint(null);
  }, [planRegionDraftCorner, page, commitPage, pushUndo]);

  const acceptSuggestedPlanRegion = useCallback(() => {
    if (!suggestedPlanRegion) return;
    pushUndo("planRegion", page?.planRegion ?? null);
    commitPage({ planRegion: { ...suggestedPlanRegion, confirmed: true } });
  }, [suggestedPlanRegion, page, commitPage, pushUndo]);

  const clearPlanRegion = useCallback(() => {
    pushUndo("planRegion", page?.planRegion ?? null);
    commitPage({ planRegion: null });
  }, [page, commitPage, pushUndo]);

  // Dismisses the "automatic detection unavailable" banner without a retry —
  // the user is choosing to proceed with the manual tools, which never
  // called (and never need to call) this API at all.
  const continueManually = useCallback(() => {
    const next = { ...(page?.layerVisibility || layerVisibility), automaticCandidates: false };
    setLayerVisibilityState(next);
    commitPage({ layerVisibility: next });
    setWallDetectionStatus("idle");
    setWallDetectionMessage("");
    setWallDetectionCode(null);
  }, [page, layerVisibility, commitPage]);

  const resetWallsToDetected = useCallback(() => {
    setWallDetectionStatus("unavailable");
    setWallDetectionMessage(AUTO_DETECTION_DISABLED_MESSAGE);
    setWallDetectionCode("AUTO_DISABLED");
  }, []);

  // ---- Exterior walls: manual editing -------------------------------------

  const findWallVertexNear = useCallback((point, { zoomScale = 1, toleranceScreenPx = VERTEX_HIT_TOLERANCE_SCREEN_PX } = {}) => {
    if (!page?.exteriorWalls) return null;
    const toleranceDocUnits = toleranceScreenPx / Math.max(zoomScale, 0.01);
    const activeIds = activeWallVertexIds(page.exteriorWalls);
    let best = null;
    let bestDistance = toleranceDocUnits;
    page.exteriorWalls.vertices.forEach((vertex) => {
      if (!activeIds.has(vertex.id)) return;
      const d = distance(vertex, point);
      if (d <= bestDistance) { best = vertex; bestDistance = d; }
    });
    return best;
  }, [page]);

  // Empty-space click while editing: extends the chain from the currently
  // selected vertex (if any) by adding a new vertex, or clicking an existing
  // vertex selects it as the new chain start / connects it to the prior one.
  // Also merges in the shared plan-geometry index, so a new/dragged vertex
  // can snap onto real detected plan linework, not just other wall vertices.
  const handleWallCanvasClick = useCallback((rawPoint, { zoomScale = 1 } = {}) => {
    if (!page?.exteriorWalls) return;
    const candidates = buildSnapCandidates(page);
    const { point, snappedTo } = snapPoint(rawPoint, candidates, { zoomScale });

    if (snappedTo?.kind === "vertex") {
      if (selectedVertexId && selectedVertexId !== snappedTo.refId) {
        mutateWalls((graph) => addSegment(graph, selectedVertexId, snappedTo.refId));
      }
      setSelectedVertexId(snappedTo.refId);
      setSelectedSegmentId(null);
      return;
    }

    const toleranceDocUnits = VERTEX_HIT_TOLERANCE_SCREEN_PX / Math.max(zoomScale, 0.01);
    const byId = new Map(page.exteriorWalls.vertices.map((v) => [v.id, v]));
    let bestSegment = null;
    let bestSegmentDistance = toleranceDocUnits;
    activeWallSegments(page.exteriorWalls).forEach((segment) => {
      const a = byId.get(segment.aId);
      const b = byId.get(segment.bId);
      if (!a || !b) return;
      const { point: projected } = projectOntoWall(rawPoint, a, b);
      const d = distance(projected, rawPoint);
      if (d <= bestSegmentDistance) { bestSegment = segment; bestSegmentDistance = d; }
    });
    if (bestSegment) {
      setSelectedField("exteriorWalls");
      setSelectedSegmentId(bestSegment.id);
      setSelectedVertexId(null);
      setSelectedOpeningId(null);
      return;
    }

    const planCandidate = bestSnapCandidate(rawPoint, { toleranceScreenPx: VERTEX_HIT_TOLERANCE_SCREEN_PX, zoomScale, planGeometryIndex });
    const finalPoint = planCandidate ? planCandidate.point : point;

    const newVertex = createWallVertex({ id: generateId("wv"), x: finalPoint.x, y: finalPoint.y });
    mutateWalls((graph) => {
      let next = { vertices: [...graph.vertices, newVertex], segments: graph.segments };
      if (selectedVertexId) next = addSegment(next, selectedVertexId, newVertex.id);
      return next;
    });
    setSelectedVertexId(newVertex.id);
    setSelectedSegmentId(null);
  }, [page, selectedVertexId, mutateWalls, planGeometryIndex]);

  // `field` defaults to "exteriorWalls" so the original exterior-only
  // edit-walls tool's single-argument call sites are unaffected; the new
  // generic Edit tool passes the field explicitly based on which graph the
  // hit vertex belongs to.
  const beginWallVertexDrag = useCallback((vertexId, field = "exteriorWalls") => {
    const graph = page?.[field];
    const vertex = graph?.vertices.find((v) => v.id === vertexId);
    if (!vertex) return;
    if (vertexTouchesLockedSegment(graph, vertexId)) return;
    setSelectedField(field);
    setSelectedVertexId(vertexId);
    setSelectedSegmentId(null);
    setSelectedOpeningId(null);
    setDraggingVertex({ id: vertexId, field, x: vertex.x, y: vertex.y });
  }, [page]);

  const updateWallVertexDrag = useCallback((point, { zoomScale = 1 } = {}) => {
    setDraggingVertex((prev) => {
      if (!prev) return prev;
      const candidates = buildSnapCandidates(page, { excludeVertexId: prev.id });
      const { point: snapped } = snapPoint(point, candidates, { zoomScale });
      const planCandidate = bestSnapCandidate(point, { toleranceScreenPx: VERTEX_HIT_TOLERANCE_SCREEN_PX, zoomScale, planGeometryIndex });
      const final = planCandidate && planCandidate.distance < distance(point, snapped) ? planCandidate.point : snapped;
      return { ...prev, x: final.x, y: final.y };
    });
  }, [page, planGeometryIndex]);

  // Openings hosted on a segment touching the dragged vertex slide along
  // with it (preserving their fractional position on the wall) rather than
  // staying at their old absolute coordinates — "must stay attached to
  // their host walls when a wall endpoint is adjusted."
  const endWallVertexDrag = useCallback(({ zoomScale = 1 } = {}) => {
    setDraggingVertex((current) => {
      if (!current) return null;
      const field = current.field || "exteriorWalls";
      const graph = page?.[field];
      if (!graph) return null;
      const finalPoint = { x: current.x, y: current.y };
      const originalVertex = graph.vertices.find((v) => v.id === current.id);
      const openEndpoints = findOpenEndpoints(graph.vertices, graph.segments);
      const otherOpen = openEndpoints.find((v) => v.id !== current.id);
      const joinTolerance = VERTEX_HIT_TOLERANCE_SCREEN_PX / Math.max(zoomScale, 0.01);
      const touchingSegments = graph.segments.filter((s) => s.aId === current.id || s.bId === current.id);

      let nextOpenings = page.openings || [];
      if (originalVertex && touchingSegments.length > 0 && nextOpenings.length > 0) {
        touchingSegments.forEach((segment) => {
          const otherVertexId = segment.aId === current.id ? segment.bId : segment.aId;
          const otherVertex = graph.vertices.find((v) => v.id === otherVertexId);
          if (!otherVertex) return;
          const oldStart = segment.aId === current.id ? originalVertex : otherVertex;
          const oldEnd = segment.aId === current.id ? otherVertex : originalVertex;
          const newStart = segment.aId === current.id ? finalPoint : otherVertex;
          const newEnd = segment.aId === current.id ? otherVertex : finalPoint;
          nextOpenings = reattachOpeningsToWall(nextOpenings, segment.id, oldStart, oldEnd, newStart, newEnd);
        });
      }

      mutateWallField(field, (g) => {
        let moved = moveVertex(g, current.id, finalPoint);
        if (otherOpen && distance(finalPoint, otherOpen) <= joinTolerance) {
          moved = joinVertices(moved, otherOpen.id, current.id);
        }
        return moved;
      }, nextOpenings !== page.openings ? { openings: nextOpenings } : {});

      return null;
    });
  }, [page, mutateWallField]);

  const deleteSelectedWallVertex = useCallback(() => {
    if (!selectedVertexId) return;
    if (vertexTouchesLockedSegment(page?.[selectedField], selectedVertexId)) return;
    mutateWallField(selectedField, (graph) => deleteVertex(graph, selectedVertexId));
    setSelectedVertexId(null);
  }, [selectedVertexId, selectedField, page, mutateWallField]);

  const deleteSelectedWallSegment = useCallback(() => {
    if (!selectedSegmentId) return;
    const segment = page?.[selectedField]?.segments.find((s) => s.id === selectedSegmentId);
    if (segment?.locked) return;
    const priorOpenings = page?.openings || [];
    const remainingOpenings = priorOpenings.filter((o) => o.wallId !== selectedSegmentId);
    mutateWallField(
      selectedField,
      (graph) => deleteSegment(graph, selectedSegmentId),
      remainingOpenings.length !== priorOpenings.length ? { openings: remainingOpenings } : {}
    );
    setSelectedSegmentId(null);
  }, [selectedSegmentId, selectedField, mutateWallField, page]);

  // Toolbar's single flat "Delete Segment" action (spec: never hidden in a
  // submenu) — deletes whichever selection the Edit Exterior tool currently
  // has, vertex taking priority since deleting a vertex already implies
  // removing its connected segments.
  const selectedSegment = page?.[selectedField]?.segments.find((s) => s.id === selectedSegmentId) || null;
  const canDeleteWallSelection = !!(
    (selectedVertexId && !vertexTouchesLockedSegment(page?.[selectedField], selectedVertexId)) ||
    (selectedSegmentId && !selectedSegment?.locked)
  );
  const deleteSelectedWallItem = useCallback(() => {
    if (selectedVertexId) deleteSelectedWallVertex();
    else if (selectedSegmentId) deleteSelectedWallSegment();
  }, [selectedVertexId, selectedSegmentId, deleteSelectedWallVertex, deleteSelectedWallSegment]);

  // ---- Generic Edit tool: hit-testing across both wall graphs + openings ---

  const findWallVertexNearAny = useCallback((point, { zoomScale = 1, toleranceScreenPx = VERTEX_HIT_TOLERANCE_SCREEN_PX } = {}) => {
    const toleranceDocUnits = toleranceScreenPx / Math.max(zoomScale, 0.01);
    let best = null;
    let bestField = null;
    let bestDistance = toleranceDocUnits;
    ["exteriorWalls", "internalWalls"].forEach((field) => {
      const activeIds = activeWallVertexIds(page?.[field]);
      (page?.[field]?.vertices || []).forEach((vertex) => {
        if (!activeIds.has(vertex.id)) return;
        const d = distance(vertex, point);
        if (d <= bestDistance) { best = vertex; bestField = field; bestDistance = d; }
      });
    });
    return best ? { field: bestField, vertex: best } : null;
  }, [page]);

  // Click priority: vertex > segment > opening, across exterior+internal —
  // whichever is nearest within tolerance wins; empty space deselects.
  const handleEditToolClick = useCallback((rawPoint, { zoomScale = 1 } = {}) => {
    const toleranceDocUnits = VERTEX_HIT_TOLERANCE_SCREEN_PX / Math.max(zoomScale, 0.01);

    const vertexHit = findWallVertexNearAny(rawPoint, { zoomScale });
    if (vertexHit) {
      setSelectedField(vertexHit.field);
      setSelectedVertexId(vertexHit.vertex.id);
      setSelectedSegmentId(null);
      setSelectedOpeningId(null);
      return;
    }

    for (const field of ["exteriorWalls", "internalWalls"]) {
      const graph = page?.[field];
      if (!graph) continue;
      const byId = new Map(graph.vertices.map((v) => [v.id, v]));
      let bestSegment = null;
      let bestSegmentDistance = toleranceDocUnits;
      activeWallSegments(graph).forEach((segment) => {
        const a = byId.get(segment.aId);
        const b = byId.get(segment.bId);
        if (!a || !b) return;
        const { point: projected } = projectOntoWall(rawPoint, a, b);
        const d = distance(projected, rawPoint);
        if (d <= bestSegmentDistance) { bestSegment = segment; bestSegmentDistance = d; }
      });
      if (bestSegment) {
        setSelectedField(field);
        setSelectedSegmentId(bestSegment.id);
        setSelectedVertexId(null);
        setSelectedOpeningId(null);
        return;
      }
    }

    let bestOpening = null;
    let bestOpeningDistance = toleranceDocUnits;
    (page?.openings || []).forEach((opening) => {
      const { point: projected } = projectOntoWall(rawPoint, opening.start, opening.end);
      const d = distance(projected, rawPoint);
      if (d <= bestOpeningDistance) { bestOpening = opening; bestOpeningDistance = d; }
    });
    if (bestOpening) {
      setSelectedOpeningId(bestOpening.id);
      setSelectedVertexId(null);
      setSelectedSegmentId(null);
      return;
    }

    setSelectedVertexId(null);
    setSelectedSegmentId(null);
    setSelectedOpeningId(null);
  }, [page, findWallVertexNearAny]);

  const selectWallSegment = useCallback((segmentId, field = "exteriorWalls") => {
    setSelectedField(field);
    setSelectedSegmentId(segmentId);
    setSelectedVertexId(null);
    setSelectedOpeningId(null);
  }, []);

  // Wall-type / thickness edits (generic Edit tool's context panel).
  const changeSelectedSegmentWallType = useCallback((wallType) => {
    if (!selectedSegmentId) return;
    const segment = page?.[selectedField]?.segments.find((s) => s.id === selectedSegmentId);
    if (segment?.locked) return;
    mutateWallField(selectedField, (graph) => changeSegmentWallType(graph, selectedSegmentId, wallType));
  }, [selectedSegmentId, selectedField, page, mutateWallField]);

  const setSelectedSegmentThickness = useCallback((thicknessMm) => {
    if (!selectedSegmentId) return;
    const segment = page?.[selectedField]?.segments.find((s) => s.id === selectedSegmentId);
    if (segment?.locked) return;
    mutateWallField(selectedField, (graph) => setSegmentThickness(graph, selectedSegmentId, thicknessMm));
  }, [selectedSegmentId, selectedField, page, mutateWallField]);

  const setSelectedSegmentLocked = useCallback((locked) => {
    if (!selectedSegmentId) return;
    mutateWallField(selectedField, (graph) => ({
      vertices: graph.vertices,
      segments: graph.segments.map((s) => (s.id === selectedSegmentId ? { ...s, locked: Boolean(locked) } : s)),
    }));
  }, [selectedSegmentId, selectedField, mutateWallField]);

  const moveSelectedSegmentToWallGraph = useCallback((targetField) => {
    if (!selectedSegmentId || targetField === selectedField) return;
    const sourceGraph = page?.[selectedField];
    const targetGraph = page?.[targetField] || EMPTY_WALL_GRAPH;
    const segment = sourceGraph?.segments.find((s) => s.id === selectedSegmentId);
    if (!sourceGraph || !segment || segment.locked) return;
    const a = sourceGraph.vertices.find((v) => v.id === segment.aId);
    const b = sourceGraph.vertices.find((v) => v.id === segment.bId);
    if (!a || !b) return;

    const targetWallType = targetField === "exteriorWalls" ? "exterior" : "internal";
    const nextA = createWallVertex({ id: generateId("wv"), x: a.x, y: a.y });
    const nextB = createWallVertex({ id: generateId("wv"), x: b.x, y: b.y });
    const movedSegment = { ...segment, aId: nextA.id, bId: nextB.id, wallType: targetWallType };
    const nextSource = {
      ...sourceGraph,
      vertices: sourceGraph.vertices,
      segments: sourceGraph.segments.filter((s) => s.id !== selectedSegmentId),
    };
    nextSource.isClosed = isPerimeterClosed(nextSource.vertices, nextSource.segments);
    const nextTarget = {
      ...targetGraph,
      vertices: [...(targetGraph.vertices || []), nextA, nextB],
      segments: [...(targetGraph.segments || []), movedSegment],
    };
    nextTarget.isClosed = isPerimeterClosed(nextTarget.vertices, nextTarget.segments);
    const targetOpeningGraph = targetField === "exteriorWalls" ? "exterior" : "internal";
    const openings = (page?.openings || []).map((opening) =>
      opening.wallId === selectedSegmentId ? { ...opening, wallGraph: targetOpeningGraph } : opening
    );

    pushUndo(selectedField, page?.[selectedField] ?? null);
    commitPage({
      [selectedField]: nextSource,
      [targetField]: nextTarget,
      openings,
    });
    setSelectedField(targetField);
  }, [selectedSegmentId, selectedField, page, commitPage, pushUndo]);

  // WallContextPanel's "Convert to Manual" — an unreviewed automatic
  // detection becomes a confirmed, user-owned segment, matching what
  // Confirm Exterior Walls would eventually require anyway.
  const convertSelectedSegmentToManual = useCallback(() => {
    if (!selectedSegmentId) return;
    const segment = page?.[selectedField]?.segments.find((s) => s.id === selectedSegmentId);
    if (segment?.locked) return;
    mutateWallField(selectedField, (graph) => ({
      vertices: graph.vertices,
      segments: graph.segments.map((s) => (s.id === selectedSegmentId ? { ...s, source: "manual", confirmed: true, confidence: null } : s)),
    }));
  }, [selectedSegmentId, selectedField, page, mutateWallField]);

  // WallContextPanel's "Split" — splits the selected segment at its
  // midpoint; a specific split point isn't available from a single button,
  // so the midpoint is the sensible default (the user can then drag the new
  // vertex wherever it actually belongs).
  const splitSelectedSegment = useCallback(() => {
    if (!selectedSegmentId) return;
    const graph = page?.[selectedField];
    const segment = graph?.segments.find((s) => s.id === selectedSegmentId);
    if (segment?.locked) return;
    const a = segment && graph.vertices.find((v) => v.id === segment.aId);
    const b = segment && graph.vertices.find((v) => v.id === segment.bId);
    if (!a || !b) return;
    const mid = midpoint(a, b);
    mutateWallField(selectedField, (g) => splitSegment(g, selectedSegmentId, mid));
    setSelectedSegmentId(null);
  }, [selectedSegmentId, selectedField, page, mutateWallField]);

  // Validates *before* mutating — a failed close (e.g. the closing segment
  // would cross another wall) leaves the graph untouched and surfaces the
  // spec-exact reason via closeShapeError, rather than silently no-op'ing or
  // (worse) creating an invalid self-intersecting polygon.
  const closeWallPerimeter = useCallback((field = "exteriorWalls") => {
    const graph = page?.[field];
    if (!graph) return;
    const openEndpoints = findOpenEndpoints(graph.vertices, graph.segments);
    const tolerance = openEndpoints.length === 2 ? distance(openEndpoints[0], openEndpoints[1]) + 1 : Infinity;
    const result = closePerimeter(graph, tolerance);
    if (!result.closed) {
      setCloseShapeError(result.reason);
      setCloseShapeSuccessMessage("");
      return;
    }
    setCloseShapeError(null);
    setCloseShapeSuccessMessage("Exterior perimeter closed");
    mutateWallField(field, () => result.graph);
  }, [page, mutateWallField]);

  // Close Shape is only meaningful (and only worth enabling) when there's
  // exactly one gap left to bridge — the ≥3-vertices / not-already-closed /
  // "active trace" gating from the spec, expressed directly in terms of what
  // closePerimeter itself requires so the button is never enabled for a case
  // it will immediately reject.
  const canCloseShape = !!(
    page?.exteriorWalls &&
    !page.exteriorWalls.isClosed &&
    page.exteriorWalls.vertices.length >= 3 &&
    findOpenEndpoints(page.exteriorWalls.vertices, page.exteriorWalls.segments).length === 2
  );

  // Clear Exterior wipes the whole exterior-wall graph (drawn or detected)
  // back to a pristine, unconfirmed state and drops any openings hosted on
  // it — a destructive, whole-perimeter action, so it goes through an
  // explicit confirm step rather than firing on a single click.
  const canClearExterior = !!(page?.exteriorWalls && (page.exteriorWalls.vertices.length > 0 || page.exteriorWalls.segments.length > 0));

  const requestClearExterior = useCallback(() => {
    if (!canClearExterior) return;
    setClearExteriorConfirmOpen(true);
  }, [canClearExterior]);

  const cancelClearExterior = useCallback(() => setClearExteriorConfirmOpen(false), []);

  const confirmClearExterior = useCallback(() => {
    pushUndo("exteriorWalls", page?.exteriorWalls ?? null);
    const priorOpenings = page?.openings || [];
    const remainingOpenings = priorOpenings.filter((o) => o.wallGraph !== "exterior");
    commitPage({
      exteriorWalls: null,
      ...(remainingOpenings.length !== priorOpenings.length ? { openings: remainingOpenings } : {}),
    });
    resetDrafts();
    setClearExteriorConfirmOpen(false);
  }, [page, commitPage, pushUndo, resetDrafts]);

  // ---- Confirm exterior walls / area ---------------------------------------

  const wallValidation = useMemo(() => validateExteriorWallsForConfirmation(pageWithActiveExteriorWalls(page)), [page]);

  const confirmExteriorWalls = useCallback(() => {
    if (!wallValidation.valid || !page?.exteriorWalls) return;
    commitPage({
      exteriorWalls: { ...page.exteriorWalls, confirmed: true, confirmedAt: new Date().toISOString() },
    });
  }, [wallValidation, page, commitPage]);

  const totalPerimeterMm = useMemo(() => {
    if (!page?.exteriorWalls?.confirmed || !page?.calibration) return null;
    const graph = activeWallGraph(page.exteriorWalls);
    return calculatePerimeterMm(graph.vertices, graph.segments, page.calibration.mmPerDocumentUnit);
  }, [page]);

  // Live running totals for the toolbar/results panel — built length, not
  // requiring either graph to be closed or confirmed (unlike totalPerimeterMm
  // above, which is specifically the confirmed exterior perimeter).
  const totalExteriorWallLengthMm = useMemo(() => {
    if (!page?.calibration || !page?.exteriorWalls) return 0;
    return sumSegmentLengthsMm(page.exteriorWalls.vertices, activeWallSegments(page.exteriorWalls), page.calibration.mmPerDocumentUnit);
  }, [page]);

  const totalInternalWallLengthMm = useMemo(() => {
    if (!page?.calibration || !page?.internalWalls) return 0;
    return sumSegmentLengthsMm(page.internalWalls.vertices, activeWallSegments(page.internalWalls), page.calibration.mmPerDocumentUnit);
  }, [page]);

  const openingCountsByType = useMemo(() => {
    const counts = {};
    (page?.openings || []).forEach((o) => {
      if (!counts[o.openingType]) counts[o.openingType] = { detected: 0, confirmed: 0 };
      counts[o.openingType].detected += 1;
      if (o.confirmed) counts[o.openingType].confirmed += 1;
    });
    return counts;
  }, [page]);

  const areaValidation = useMemo(() => validatePerimeterForArea(pageWithActiveExteriorWalls(page)), [page]);

  const calculatedAreaM2 = useMemo(() => {
    if (!areaValidation.valid || !page?.calibration) return null;
    return calculatePolygonAreaM2(areaValidation.orderedPoints, page.calibration.mmPerDocumentUnit);
  }, [areaValidation, page]);

  // External footprint vs internal floor area, per the exterior wall's
  // recorded boundary basis (which face of the wall the trace represents).
  // Never relabels the as-traced figure as "internal" for the (default,
  // most common) "outside" basis — the internal estimate is only ever
  // produced by actually offsetting the polygon by the wall thickness, and
  // is null (with an explanatory message) whenever that offset can't be
  // computed cleanly, per spec's graceful-failure requirement.
  const footprintAndInternalArea = useMemo(() => {
    if (!areaValidation.valid || calculatedAreaM2 == null || !page?.calibration) return null;
    const basis = page.exteriorWalls?.boundaryBasis || "outside";
    const thicknessMm = page.exteriorWalls?.wallThicknessMm;
    const mmPerDocumentUnit = page.calibration.mmPerDocumentUnit;
    const ordered = areaValidation.orderedPoints;
    const hasThickness = Number.isFinite(thicknessMm) && thicknessMm > 0;
    const toM2 = (docPoints) => (docPoints ? calculatePolygonAreaM2(docPoints, mmPerDocumentUnit) : null);

    let externalFootprintM2 = null;
    let internalFloorAreaM2 = null;

    if (basis === "inside") {
      internalFloorAreaM2 = calculatedAreaM2;
      if (hasThickness) externalFootprintM2 = toM2(offsetPolygonOutward(ordered, thicknessMm / mmPerDocumentUnit));
    } else if (basis === "centreline") {
      if (hasThickness) {
        const halfDocUnits = thicknessMm / 2 / mmPerDocumentUnit;
        externalFootprintM2 = toM2(offsetPolygonOutward(ordered, halfDocUnits));
        internalFloorAreaM2 = toM2(offsetPolygonInward(ordered, halfDocUnits));
      }
    } else {
      externalFootprintM2 = calculatedAreaM2;
      if (hasThickness) internalFloorAreaM2 = toM2(offsetPolygonInward(ordered, thicknessMm / mmPerDocumentUnit));
    }

    const internalAreaError = internalFloorAreaM2 == null
      ? "Internal area could not be calculated automatically. Trace the internal boundary using the Area Tool."
      : "";
    return { basis, externalFootprintM2, internalFloorAreaM2, internalAreaError };
  }, [areaValidation, calculatedAreaM2, page]);

  const setExteriorBoundaryBasis = useCallback((basis) => {
    if (!page?.exteriorWalls) return;
    pushUndo("exteriorWalls", page.exteriorWalls);
    commitPage({ exteriorWalls: { ...page.exteriorWalls, boundaryBasis: basis } });
  }, [page, commitPage, pushUndo]);

  const setExteriorWallThicknessMm = useCallback((thicknessMm) => {
    if (!page?.exteriorWalls) return;
    pushUndo("exteriorWalls", page.exteriorWalls);
    commitPage({ exteriorWalls: { ...page.exteriorWalls, wallThicknessMm: thicknessMm } });
  }, [page, commitPage, pushUndo]);

  const confirmArea = useCallback(({ confirmedAreaM2, note, name = "Ground Floor", areaType = "Living Area" } = {}) => {
    if (!areaValidation.valid || calculatedAreaM2 == null) return;
    const finalConfirmed = Number.isFinite(confirmedAreaM2) ? confirmedAreaM2 : calculatedAreaM2;
    const area = createArea({
      id: generateId("area"),
      name,
      areaType,
      vertices: areaValidation.orderedPoints,
      calculatedAreaM2,
      source: "manual", // the exterior-wall perimeter it's generated from may itself be manual or automatic, but the *area confirmation* is always the user's own action
      externalFootprintM2: footprintAndInternalArea?.externalFootprintM2 ?? null,
      internalFloorAreaM2: footprintAndInternalArea?.internalFloorAreaM2 ?? null,
    });
    area.confirmedAreaM2 = finalConfirmed;
    area.confirmedNote = finalConfirmed !== calculatedAreaM2 ? (note || "") : "";
    area.confirmed = true;
    area.confirmedAt = new Date().toISOString();
    pushUndo("areas", page?.areas || []);
    commitPage({ areas: [...(page?.areas || []), area] });
    setAreaDialogOpen(false);
  }, [areaValidation, calculatedAreaM2, footprintAndInternalArea, page, commitPage, pushUndo]);

  // ---- Manual area tracing (Area tool) --------------------------------------
  //
  // Independent of the exterior-wall-perimeter flow above — "a manually drawn
  // exterior perimeter must work equally well" for area, and a traced area
  // need not correspond to any wall perimeter at all (a patio, a void, etc).

  const updateAreaHover = useCallback((rawPoint, { zoomScale = 1 } = {}) => {
    const candidates = buildSnapCandidates(page);
    const { point } = snapPoint(rawPoint, candidates, { zoomScale });
    const planCandidate = bestSnapCandidate(rawPoint, { toleranceScreenPx: SNAP_TOLERANCE_SCREEN_PX, zoomScale, planGeometryIndex });
    setAreaHoverPoint(planCandidate ? planCandidate.point : point);
  }, [page, planGeometryIndex]);

  const [manualAreaDialogOpen, setManualAreaDialogOpen] = useState(false);
  const [detectedRoomCandidate, setDetectedRoomCandidate] = useState(null);

  const applyDetectedRoomCandidate = useCallback((candidate) => {
    setDetectedRoomCandidate(candidate);
    setManualAreaDialogOpen(true);
  }, []);

  const handleAreaCanvasClick = useCallback((rawPoint, { zoomScale = 1 } = {}) => {
    if (areaMode === "room-detect") {
      const candidate = detectRoomBoundary({
        page,
        seedPoint: rawPoint,
        exclusionCandidates: page?.roomExclusionCandidates || [],
        wallThicknessMm: page?.internalWalls?.wallThicknessMm || page?.exteriorWalls?.wallThicknessMm || 0,
      });
      applyDetectedRoomCandidate(candidate);
      return;
    }
    if (areaMode === "rectangle") {
      if (!areaSearchDraft?.start) {
        setAreaSearchDraft({ start: rawPoint, end: rawPoint });
        return;
      }
      const searchRect = rectFromCorners(areaSearchDraft.start, rawPoint || areaSearchDraft.end || areaSearchDraft.start);
      const candidate = detectRoomBoundary({
        page,
        searchRect,
        exclusionCandidates: page?.roomExclusionCandidates || [],
        wallThicknessMm: page?.internalWalls?.wallThicknessMm || page?.exteriorWalls?.wallThicknessMm || 0,
      });
      setAreaSearchDraft(null);
      applyDetectedRoomCandidate(candidate);
      return;
    }
    if (areaMode !== "manual-polygon") return;
    const candidates = buildSnapCandidates(page);
    const { point } = snapPoint(rawPoint, candidates, { zoomScale });
    const planCandidate = bestSnapCandidate(rawPoint, { toleranceScreenPx: SNAP_TOLERANCE_SCREEN_PX, zoomScale, planGeometryIndex });
    const finalPoint = planCandidate ? planCandidate.point : point;

    if (areaDraftVertices.length >= 3) {
      const closeToleranceDocUnits = SNAP_TOLERANCE_SCREEN_PX / Math.max(zoomScale, 0.01);
      if (distance(finalPoint, areaDraftVertices[0]) <= closeToleranceDocUnits) {
        setManualAreaDialogOpen(true);
        return;
      }
    }
    setAreaDraftVertices((prev) => [...prev, finalPoint]);
  }, [
    areaMode,
    areaSearchDraft,
    page,
    planGeometryIndex,
    areaDraftVertices,
    applyDetectedRoomCandidate,
  ]);

  const beginAreaRectangle = useCallback((rawPoint) => {
    setAreaSearchDraft({ start: rawPoint, end: rawPoint });
  }, []);

  const updateAreaRectangle = useCallback((rawPoint) => {
    setAreaSearchDraft((current) => (current ? { ...current, end: rawPoint } : current));
  }, []);

  const finishAreaRectangle = useCallback((rawPoint, startPoint = null) => {
    const start = startPoint || areaSearchDraft?.start;
    if (!start) return;
    const searchRect = rectFromCorners(start, rawPoint || areaSearchDraft?.end || start);
    const candidate = detectRoomBoundary({
      page,
      searchRect,
      exclusionCandidates: page?.roomExclusionCandidates || [],
      wallThicknessMm: page?.internalWalls?.wallThicknessMm || page?.exteriorWalls?.wallThicknessMm || 0,
    });
    setAreaSearchDraft(null);
    applyDetectedRoomCandidate(candidate);
  }, [areaSearchDraft, page, applyDetectedRoomCandidate]);

  // Toolbar's Finish action — closes the polygon without needing to click
  // back on the first point.
  const finishAreaTrace = useCallback(() => {
    if (areaDraftVertices.length < 3) return;
    setManualAreaDialogOpen(true);
  }, [areaDraftVertices]);

  const cancelAreaTrace = useCallback(() => {
    setAreaDraftVertices([]);
    setAreaHoverPoint(null);
    setAreaSearchDraft(null);
    setDetectedRoomCandidate(null);
    setManualAreaDialogOpen(false);
  }, []);

  const manualAreaCandidate = useMemo(() => {
    if (detectedRoomCandidate) return detectedRoomCandidate;
    if (areaDraftVertices.length < 3 || !page?.calibration) return { valid: false, reason: "Needs at least three points and a calibrated scale." };
    if (!isSimplePolygon(areaDraftVertices)) return { valid: false, reason: "This boundary crosses itself." };
    const areaDocUnits2 = polygonAreaDocUnits2(areaDraftVertices);
    if (!(areaDocUnits2 > 0)) return { valid: false, reason: "The calculated area is zero." };
    const mm2 = areaDocUnits2 * page.calibration.mmPerDocumentUnit * page.calibration.mmPerDocumentUnit;
    return { valid: true, reason: "", calculatedAreaM2: mm2 / 1_000_000 };
  }, [detectedRoomCandidate, areaDraftVertices, page]);

  const confirmManualArea = useCallback(({ confirmedAreaM2, note, name = "Area", areaType = "Custom" } = {}) => {
    if (!manualAreaCandidate.valid) return;
    const calculatedAreaM2 = manualAreaCandidate.netAreaM2 ?? manualAreaCandidate.calculatedAreaM2;
    const finalConfirmed = Number.isFinite(confirmedAreaM2) ? confirmedAreaM2 : calculatedAreaM2;
    const boundary = manualAreaCandidate.outerBoundary || areaDraftVertices;
    const area = createArea({
      id: generateId("area"),
      name,
      areaType,
      vertices: boundary,
      outerBoundary: boundary,
      holes: manualAreaCandidate.holes || [],
      calculatedAreaM2,
      grossAreaM2: manualAreaCandidate.grossAreaM2 ?? calculatedAreaM2,
      excludedAreaM2: manualAreaCandidate.excludedAreaM2 ?? 0,
      netAreaM2: calculatedAreaM2,
      source: manualAreaCandidate.source || "manual",
      confidence: manualAreaCandidate.confidence ?? null,
      seedPoint: manualAreaCandidate.seedPoint || null,
      searchRect: manualAreaCandidate.searchRect || null,
    });
    area.confirmedAreaM2 = finalConfirmed;
    area.confirmedNote = finalConfirmed !== calculatedAreaM2 ? (note || "") : "";
    area.confirmed = true;
    area.confirmedAt = new Date().toISOString();
    pushUndo("areas", page?.areas || []);
    commitPage({ areas: [...(page?.areas || []), area] });
    setAreaDraftVertices([]);
    setAreaHoverPoint(null);
    setAreaSearchDraft(null);
    setDetectedRoomCandidate(null);
    setManualAreaDialogOpen(false);
  }, [manualAreaCandidate, areaDraftVertices, page, commitPage, pushUndo]);

  // ---- Area list management (rename/classify/include-exclude/delete) -------

  const updateArea = useCallback((areaId, patch) => {
    const areas = page?.areas || [];
    pushUndo("areas", areas);
    commitPage({ areas: areas.map((a) => (a.id === areaId ? { ...a, ...patch } : a)) });
  }, [page, commitPage, pushUndo]);

  const deleteArea = useCallback((areaId) => {
    const areas = page?.areas || [];
    pushUndo("areas", areas);
    commitPage({ areas: areas.filter((a) => a.id !== areaId) });
  }, [page, commitPage, pushUndo]);

  // ---- Wall openings (Window / Internal Door / External Door / Sliding
  //      Door / Garage Door / Open Opening) --------------------------------

  const OPENING_HOST_TOLERANCE_SCREEN_PX = 14;

  const updateOpeningHover = useCallback((rawPoint, { zoomScale = 1 } = {}) => {
    if (!OPENING_TOOLS.includes(activeTool)) return;
    const toleranceDocUnits = OPENING_HOST_TOLERANCE_SCREEN_PX / Math.max(zoomScale, 0.01);
    const host = findNearestWallSegment(rawPoint, wallGraphList(page), toleranceDocUnits);
    setOpeningHostWall(host);
  }, [activeTool, page]);

  const handleOpeningCanvasClick = useCallback((rawPoint, { zoomScale = 1 } = {}) => {
    if (!OPENING_TOOLS.includes(activeTool) || !page?.calibration) return;
    const toleranceDocUnits = OPENING_HOST_TOLERANCE_SCREEN_PX / Math.max(zoomScale, 0.01);
    const host = findNearestWallSegment(rawPoint, wallGraphList(page), toleranceDocUnits);
    if (!host) return; // openings must be placed on a wall
    setOpeningHostWall(host);

    if (!openingStart) {
      setOpeningStart(host.point);
      return;
    }

    const widthMm = computeOpeningWidthMm(openingStart, host.point, page.calibration.mmPerDocumentUnit);
    const opening = createOpening({
      id: generateId("op"),
      wallId: host.wallId,
      wallGraph: host.wallGraph,
      openingType: activeTool,
      start: openingStart,
      end: host.point,
      widthMm,
      swing: ["internal-door", "external-door"].includes(activeTool) ? { hingeSide: "start", direction: "in" } : null,
    });
    pushUndo("openings", page.openings || []);
    commitPage({ openings: [...(page.openings || []), opening] });
    setOpeningStart(null);
  }, [activeTool, page, openingStart, commitPage, pushUndo]);

  const cancelOpeningPlacement = useCallback(() => {
    setOpeningStart(null);
    setOpeningHostWall(null);
  }, []);

  const selectOpening = useCallback((openingId) => {
    setSelectedOpeningId(openingId);
    setSelectedVertexId(null);
    setSelectedSegmentId(null);
  }, []);

  const updateOpening = useCallback((openingId, patch) => {
    const openings = page?.openings || [];
    pushUndo("openings", openings);
    commitPage({ openings: openings.map((o) => (o.id === openingId ? { ...o, ...patch } : o)) });
  }, [page, commitPage, pushUndo]);

  const deleteSelectedOpening = useCallback(() => {
    if (!selectedOpeningId) return;
    const openings = page?.openings || [];
    pushUndo("openings", openings);
    commitPage({ openings: openings.filter((o) => o.id !== selectedOpeningId) });
    setSelectedOpeningId(null);
  }, [selectedOpeningId, page, commitPage, pushUndo]);

  // Lands exactly on top of the original by default — the user drags it into
  // place on the same or a different wall.
  const duplicateSelectedOpening = useCallback(() => {
    if (!selectedOpeningId) return;
    const openings = page?.openings || [];
    const original = openings.find((o) => o.id === selectedOpeningId);
    if (!original) return;
    const copy = { ...original, id: generateId("op"), start: { ...original.start }, end: { ...original.end }, confirmed: false };
    pushUndo("openings", openings);
    commitPage({ openings: [...openings, copy] });
    setSelectedOpeningId(copy.id);
  }, [selectedOpeningId, page, commitPage, pushUndo]);

  const flipOpeningSwing = useCallback((openingId) => {
    const openings = page?.openings || [];
    const opening = openings.find((o) => o.id === openingId);
    if (!opening?.swing) return;
    updateOpening(openingId, { swing: { ...opening.swing, direction: opening.swing.direction === "in" ? "out" : "in" } });
  }, [page, updateOpening]);

  const setOpeningHingeSide = useCallback((openingId, hingeSide) => {
    const openings = page?.openings || [];
    const opening = openings.find((o) => o.id === openingId);
    if (!opening?.swing) return;
    updateOpening(openingId, { swing: { ...opening.swing, hingeSide } });
  }, [page, updateOpening]);

  // Dragging an opening: "start"/"end" adjust that endpoint (and so the
  // width); "move" slides the whole opening along its host wall, preserving
  // width. Always re-projected onto the host wall's actual line — an
  // opening can never leave its wall.
  const [draggingOpening, setDraggingOpening] = useState(null); // { id, handle: "start"|"end"|"move", start, end }

  // Hit-tests an opening's start/end handles first (precise endpoint drag),
  // then its body (a "move along the wall" drag) — used by the generic Edit
  // tool's pointerdown to decide what kind of opening drag to start, if any.
  const findOpeningHandleNear = useCallback((point, { zoomScale = 1, toleranceScreenPx = VERTEX_HIT_TOLERANCE_SCREEN_PX } = {}) => {
    const toleranceDocUnits = toleranceScreenPx / Math.max(zoomScale, 0.01);
    let best = null;
    let bestDistance = toleranceDocUnits;
    (page?.openings || []).forEach((opening) => {
      const dStart = distance(opening.start, point);
      const dEnd = distance(opening.end, point);
      if (dStart <= bestDistance) { best = { openingId: opening.id, handle: "start" }; bestDistance = dStart; }
      if (dEnd <= bestDistance) { best = { openingId: opening.id, handle: "end" }; bestDistance = dEnd; }
    });
    if (best) return best;
    let bestBody = null;
    let bestBodyDistance = toleranceDocUnits;
    (page?.openings || []).forEach((opening) => {
      const { point: projected } = projectOntoWall(point, opening.start, opening.end);
      const d = distance(projected, point);
      if (d <= bestBodyDistance) { bestBody = { openingId: opening.id, handle: "move" }; bestBodyDistance = d; }
    });
    return bestBody;
  }, [page]);

  const beginOpeningDrag = useCallback((openingId, handle) => {
    const opening = (page?.openings || []).find((o) => o.id === openingId);
    if (!opening) return;
    setSelectedOpeningId(openingId);
    setDraggingOpening({ id: openingId, handle, start: opening.start, end: opening.end });
  }, [page]);

  const updateOpeningDrag = useCallback((rawPoint) => {
    setDraggingOpening((prev) => {
      if (!prev) return prev;
      const opening = (page?.openings || []).find((o) => o.id === prev.id);
      if (!opening) return prev;
      const hostField = opening.wallGraph === "exterior" ? "exteriorWalls" : "internalWalls";
      const graph = page?.[hostField];
      const segment = graph?.segments.find((s) => s.id === opening.wallId);
      if (!segment) return prev;
      const byId = new Map(graph.vertices.map((v) => [v.id, v]));
      const wallStart = byId.get(segment.aId);
      const wallEnd = byId.get(segment.bId);
      if (!wallStart || !wallEnd) return prev;
      const { point: projected, t: newT } = projectOntoWall(rawPoint, wallStart, wallEnd);

      if (prev.handle === "start") return { ...prev, start: projected };
      if (prev.handle === "end") return { ...prev, end: projected };

      const startT = projectOntoWall(prev.start, wallStart, wallEnd).t;
      const endT = projectOntoWall(prev.end, wallStart, wallEnd).t;
      const halfSpan = (endT - startT) / 2;
      const lerp = (t) => ({ x: wallStart.x + t * (wallEnd.x - wallStart.x), y: wallStart.y + t * (wallEnd.y - wallStart.y) });
      return { ...prev, start: lerp(newT - halfSpan), end: lerp(newT + halfSpan) };
    });
  }, [page]);

  const endOpeningDrag = useCallback(() => {
    setDraggingOpening((current) => {
      if (!current || !page?.calibration) return null;
      const widthMm = computeOpeningWidthMm(current.start, current.end, page.calibration.mmPerDocumentUnit);
      updateOpening(current.id, { start: current.start, end: current.end, widthMm });
      return null;
    });
  }, [page, updateOpening]);

  // ---- Manual Exterior Wall / Internal Wall drawing --------------------------
  //
  // Click-and-connect chain: click the first point, move to preview a live
  // straight segment (soft-locked to horizontal/vertical near those axes,
  // genuinely angled otherwise — see takeoff/wallDrawing.js), click to place
  // and continue the chain, double-click or Finish to end the run. Escape
  // (handled by resetDrafts) cancels only the segment in progress.

  const resolveWallDrawPoint = useCallback((rawPoint, { rotation = 0, zoomScale = 1 } = {}) => {
    const field = wallFieldForTool(activeTool);
    if (!field) return null;
    const candidate = bestSnapCandidate(rawPoint, {
      toleranceScreenPx: SNAP_TOLERANCE_SCREEN_PX, zoomScale, planGeometryIndex, page, excludeVertexId: wallDrawChainVertexId,
    });
    if (candidate) {
      return { point: candidate.point, axis: null, angleDegrees: null, locked: false, snap: snapCandidateToMetadata(candidate) };
    }
    if (wallDrawChainVertexId) {
      const lastVertex = page?.[field]?.vertices.find((v) => v.id === wallDrawChainVertexId);
      if (lastVertex) {
        const soft = softAxisSnap({ lastPoint: lastVertex, rawPoint, rotation, forcedAxis });
        return { point: soft.point, axis: soft.axis, angleDegrees: soft.angleDegrees, locked: soft.locked, snap: null };
      }
    }
    return { point: rawPoint, axis: null, angleDegrees: null, locked: false, snap: null };
  }, [activeTool, wallDrawChainVertexId, page, forcedAxis, planGeometryIndex]);

  const updateWallDrawHover = useCallback((rawPoint, options) => {
    setWallDrawHoverPreview(resolveWallDrawPoint(rawPoint, options));
  }, [resolveWallDrawPoint]);

  const handleWallDrawClick = useCallback((rawPoint, options) => {
    const field = wallFieldForTool(activeTool);
    if (!field) return;
    const resolved = resolveWallDrawPoint(rawPoint, options);
    if (!resolved) return;

    const reuseVertexId = resolved.snap?.kind === "endpoint" && vertexBelongsToField(page, field, resolved.snap.lineId)
      ? resolved.snap.lineId
      : null;
    let usedVertexId = reuseVertexId;
    const chainStart = wallDrawChainVertexId;
    if (field === "exteriorWalls" && chainStart) {
      const start = page?.[field]?.vertices.find((v) => v.id === chainStart);
      const toleranceDocUnits = SNAP_TOLERANCE_SCREEN_PX / Math.max(options?.zoomScale || 1, 0.01);
      const hasSnap = Boolean(resolved.snap?.kind && resolved.snap.kind !== "manual");
      const hasSupport = hasSnap || tracedSegmentHasWallEvidence(start, resolved.point, planGeometryIndex, toleranceDocUnits);
      const forced = pendingUnsupportedExteriorSegment &&
        distance(pendingUnsupportedExteriorSegment.from, start) <= toleranceDocUnits &&
        distance(pendingUnsupportedExteriorSegment.to, resolved.point) <= toleranceDocUnits;
      if (!hasSupport && !forced) {
        setPendingUnsupportedExteriorSegment({ from: start, to: resolved.point });
        setWallDetectionStatus("incomplete");
        setWallDetectionMessage("This segment does not appear to follow an exterior wall. Click again to force it, or choose another point.");
        setWallDetectionCode("TRACE_SEGMENT_UNSUPPORTED");
        return;
      }
    }

    mutateWallField(field, (graph) => {
      let nextGraph = graph;
      if (!usedVertexId) {
        const newVertex = createWallVertex({ id: generateId("wv"), x: resolved.point.x, y: resolved.point.y });
        nextGraph = { vertices: [...graph.vertices, newVertex], segments: graph.segments };
        usedVertexId = newVertex.id;
      }
      if (chainStart && chainStart !== usedVertexId) {
        nextGraph = addSegment(nextGraph, chainStart, usedVertexId, { wallType: field === "exteriorWalls" ? "exterior" : "internal" });
      }
      return nextGraph;
    });

    setWallDrawChainVertexId(usedVertexId);
    setWallDrawHoverPreview(null);
    setPendingUnsupportedExteriorSegment(null);
    setWallDetectionStatus("idle");
    if (field === "exteriorWalls") {
      setWallDetectionMessage(resolved.snap?.kind === "line" ? "Snapped to wall line" : resolved.snap ? "Snapped to wall corner" : "");
      setWallDetectionCode(null);
    }
  }, [activeTool, page, wallDrawChainVertexId, resolveWallDrawPoint, mutateWallField, planGeometryIndex, pendingUnsupportedExteriorSegment]);

  // Double-click or the toolbar's Finish button.
  const finishWallDrawing = useCallback(() => {
    setWallDrawChainVertexId(null);
    setWallDrawHoverPreview(null);
    setPendingUnsupportedExteriorSegment(null);
  }, []);

  // ---- Layer visibility ------------------------------------------------------

  const setLayerVisible = useCallback((layer, visible) => {
    setLayerVisibilityState((prev) => {
      const next = { ...prev, [layer]: visible };
      commitPage({ layerVisibility: next });
      return next;
    });
  }, [commitPage]);

  return {
    activeTool, setActiveTool,

    // Set Scale / Measure Length
    pendingPoint, hoverPreview, updatePointerHover, placePointerPoint,
    forcedAxis, manualPlacementEnabled, toggleManualPlacement,
    measureAngleMode, setMeasureAngleMode,
    calibrationDialog, confirmCalibration, cancelCalibration, adjustCalibrationPoints, clearScale,
    clearMeasurements,

    // Exterior walls (original exterior-only tool, unchanged) + the new
    // field-aware generalizations the Edit/drawing tools use.
    hoverPoint, setHoverPoint,
    wallDetectionBusy, wallDetectionMessage, wallDetectionStatus, wallDetectionCode, runWallDetection, resetWallsToDetected, continueManually,
    highConfidenceUnconfirmedCount, automaticCandidateCount,
    activeExteriorWallSegmentCount, activeInternalWallSegmentCount, activeExteriorWallsClosed,
    acceptAllHighConfidenceSegments, reviewAutomaticCandidates, rejectAutomaticCandidates,
    suggestedPlanRegion, planRegionDraftCorner, planRegionHoverPoint,
    updatePlanRegionHover, handlePlanRegionClick, acceptSuggestedPlanRegion, clearPlanRegion,
    findWallVertexNear, handleWallCanvasClick,
    findWallVertexNearAny, handleEditToolClick,
    beginWallVertexDrag, updateWallVertexDrag, endWallVertexDrag, draggingVertex,
    selectedField, selectedVertexId, selectedSegmentId, selectWallSegment,
    deleteSelectedWallVertex, deleteSelectedWallSegment,
    canDeleteWallSelection, deleteSelectedWallItem,
    changeSelectedSegmentWallType, setSelectedSegmentThickness,
    setSelectedSegmentLocked, moveSelectedSegmentToWallGraph,
    convertSelectedSegmentToManual, splitSelectedSegment,
    closeWallPerimeter, closeShapeError, closeShapeSuccessMessage, canCloseShape,
    canClearExterior, clearExteriorConfirmOpen, requestClearExterior, cancelClearExterior, confirmClearExterior,
    wallValidation, confirmExteriorWalls, totalPerimeterMm,
    totalExteriorWallLengthMm, totalInternalWallLengthMm,
    segmentToWallSegment,

    // Manual Exterior Wall / Internal Wall drawing
    wallDrawChainVertexId, wallDrawHoverPreview, updateWallDrawHover, handleWallDrawClick, finishWallDrawing,

    // Wall openings (Window / Internal Door / External Door / Sliding Door /
    // Garage Door / Open Opening)
    openingHostWall, openingStart, updateOpeningHover, handleOpeningCanvasClick, cancelOpeningPlacement,
    selectedOpeningId, selectOpening, updateOpening, deleteSelectedOpening, duplicateSelectedOpening,
    flipOpeningSwing, setOpeningHingeSide,
    draggingOpening, findOpeningHandleNear, beginOpeningDrag, updateOpeningDrag, endOpeningDrag,
    openingCountsByType,

    // Area — from a confirmed exterior perimeter (unchanged) and manual tracing (new)
    areaDialogOpen, setAreaDialogOpen, areaValidation, calculatedAreaM2, confirmArea,
    footprintAndInternalArea, setExteriorBoundaryBasis, setExteriorWallThicknessMm,
    areaMode, setAreaMode,
    areaDraftVertices, areaHoverPoint, areaSearchDraft,
    updateAreaHover, handleAreaCanvasClick, beginAreaRectangle, updateAreaRectangle, finishAreaRectangle,
    finishAreaTrace, cancelAreaTrace,
    manualAreaDialogOpen, setManualAreaDialogOpen, manualAreaCandidate, confirmManualArea,
    updateArea, deleteArea,

    // Layer visibility
    layerVisibility, setLayerVisible,

    undo, redo, canUndo: undoStack.length > 0, canRedo: redoStack.length > 0,
  };
}
