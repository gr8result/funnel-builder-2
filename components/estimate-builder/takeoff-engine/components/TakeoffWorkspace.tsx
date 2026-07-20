import React, { useEffect, useMemo, useRef, useState } from "react";
import PlanToolbar from "./PlanToolbar";
import PlanPageList from "./PlanPageList";
import PlanViewport from "./PlanViewport";
import ProcessingStatus from "./ProcessingStatus";
import PropertiesPanel from "./PropertiesPanel";
import { hydrateTakeoffDocument, saveTakeoffDocument } from "../persistence/TakeoffRepository";
import { ingestPdfFile } from "../processing/PdfIngestionService";
import { renderPageThumbnail } from "../rendering/PdfRenderer";
import { rotatedDimensions } from "../rendering/CoordinateTransform";
import { createViewportState } from "../rendering/ViewportController";
import { rotateLeft, rotateRight } from "../interactions/RotationController";
import { detectOrientation } from "../processing/OrientationDetector";
import { confirmCurrentOrientation, getActivePage, selectPage, setManualPageRotation, setPageViewport, updatePage } from "../state/takeoffStore";
import {
  detectDoors,
  detectExteriorWalls,
  detectInteriorWalls,
  detectOpenings,
  detectRooms,
  detectWindows,
  replaceDetectedObjects,
} from "../processing/AiDetectionPipeline";
import type { TakeoffDocument, TakeoffObject, ViewportState } from "../state/takeoffTypes";

export default function TakeoffWorkspace({ sheet, activeRoute = "" }: { sheet: any; activeRoute?: string }) {
  const workbook = sheet?.workbook || {};
  const jobId = workbook.openedFileName || workbook.id || "";
  const [initialHydration] = useState(() => safeHydrateTakeoffDocument(workbook.takeoffEngine, workbook.openedFileName || workbook.projectName || "Workbook takeoff"));
  const [startupError, setStartupError] = useState<Error | null>(initialHydration.error);
  const [documentState, setDocumentState] = useState<TakeoffDocument>(initialHydration.document);
  const [activeTool, setActiveTool] = useState("select");
  const [status, setStatus] = useState<{ status: string; detail?: string; percent?: number }>({ status: "ready" });
  const [fitRequest, setFitRequest] = useState<{ mode: "page" | "width" | "preset"; key: number; scale?: number }>({ mode: "page", key: 0 });
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [draftPoints, setDraftPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [scaleDraft, setScaleDraft] = useState<{ start: { x: number; y: number } | null; end: { x: number; y: number } | null; liveEnd: { x: number; y: number } | null }>({ start: null, end: null, liveEnd: null });
  const [scaleDialog, setScaleDialog] = useState<{ start: { x: number; y: number }; end: { x: number; y: number }; distanceMm: string } | null>(null);
  const [undoStack, setUndoStack] = useState<TakeoffDocument[]>([]);
  const [redoStack, setRedoStack] = useState<TakeoffDocument[]>([]);
  const persistTimerRef = useRef<number | null>(null);

  const activePage = useMemo(() => getActivePage(documentState), [documentState]);
  const viewport = createViewportState(activePage?.viewport || {});

  useEffect(() => {
    try {
      console.info("[Takeoff] loading saved state");
      setStartupError(null);
      const hydrated = safeHydrateTakeoffDocument(workbook.takeoffEngine, workbook.openedFileName || workbook.projectName || "Workbook takeoff");
      if (hydrated.error) throw hydrated.error;
      setDocumentState(hydrated.document);
      console.info("[Takeoff] loading PDF metadata");
    } catch (error) {
      console.error("[Takeoff] initialisation failed", error);
      setStartupError(error instanceof Error ? error : new Error(String(error)));
    }
  }, [workbook.takeoffEngine, workbook.openedFileName, workbook.projectName]);

  useEffect(() => {
    if (activePage?.scaleStatus !== "confirmed" && !["select", "pan", "scale"].includes(activeTool)) {
      setActiveTool("select");
      setDraftPoints([]);
    }
  }, [activePage?.id, activePage?.scaleStatus, activeTool]);

  function commitDocument(nextDocument: TakeoffDocument, debounce = false, history = false) {
    if (history) {
      setUndoStack((current) => [...current, documentState].slice(-40));
      setRedoStack([]);
    }
    setDocumentState(nextDocument);
    if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
    const save = () => saveTakeoffDocument(sheet, nextDocument);
    if (debounce) {
      persistTimerRef.current = window.setTimeout(save, 350);
    } else {
      save();
    }
  }

  function undo() {
    setUndoStack((current) => {
      const previous = current[current.length - 1];
      if (!previous) return current;
      setRedoStack((redo) => [documentState, ...redo].slice(0, 40));
      setDocumentState(previous);
      saveTakeoffDocument(sheet, previous);
      return current.slice(0, -1);
    });
  }

  function redo() {
    setRedoStack((current) => {
      const next = current[0];
      if (!next) return current;
      setUndoStack((undoItems) => [...undoItems, documentState].slice(-40));
      setDocumentState(next);
      saveTakeoffDocument(sheet, next);
      return current.slice(1);
    });
  }

  function clearLegacyTakeoffData() {
    const emptyLegacyProject = {
      id: `takeoff-${jobId || "workbook"}`,
      jobId,
      plans: [],
      pages: [],
      activePageId: null,
      selectedPageId: null,
      measurements: [],
      areas: [],
      scale: null,
      orientation: null,
      settings: {},
      updatedAt: new Date().toISOString(),
    };
    const emptyDocument = hydrateTakeoffDocument(null, workbook.openedFileName || workbook.projectName || "Workbook takeoff");
    commitDocument(emptyDocument);
    sheet?.updatePlans?.([]);
    sheet?.updateTakeoffProject?.(emptyLegacyProject);
    try {
      const raw = window.localStorage.getItem("gr8:takeoff:v1") || "[]";
      const projects = JSON.parse(raw);
      const filtered = Array.isArray(projects)
        ? projects.filter((project) => {
          if (jobId && project?.jobId === jobId) return false;
          return project?.id !== emptyLegacyProject.id;
        })
        : [];
      window.localStorage.setItem("gr8:takeoff:v1", JSON.stringify(filtered));
    } catch {}
    setStatus({ status: "ready", detail: "Legacy takeoff data cleared", percent: 100 });
    setStartupError(null);
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = Array.from(event.target.files || []).find((item) => item.type === "application/pdf" || item.name.toLowerCase().endsWith(".pdf"));
    if (!file) return;
    try {
      setStatus({ status: "reading", detail: file.name, percent: 12 });
      const nextDocument = await ingestPdfFile(file, (update) => {
        const pageProgress = update.pageNumber && update.pageCount ? (update.pageNumber / update.pageCount) * 70 : 10;
        setStatus({ status: update.status, detail: update.detail, percent: Math.min(94, 15 + pageProgress) });
      });
      commitDocument(nextDocument);
      setStatus({ status: "ready", percent: 100 });
      setFitRequest((current) => ({ mode: "page", key: current.key + 1 }));
      event.target.value = "";
    } catch (error) {
      console.error("[takeoff-engine] PDF ingestion failed", error);
      setStatus({ status: "failed", detail: "PDF import failed", percent: 0 });
    }
  }

  function handleViewportChange(nextViewport: ViewportState) {
    if (!activePage) return;
    setDocumentState((current) => setPageViewport(current, activePage.id, nextViewport));
  }

  function handleViewportCommit(nextViewport: ViewportState) {
    if (!activePage) return;
    commitDocument(setPageViewport(documentState, activePage.id, nextViewport), true);
  }

  async function refreshThumbnail(nextDocument: TakeoffDocument, pageId: string) {
    const page = nextDocument.pages.find((item) => item.id === pageId);
    if (!page) return;
    const thumbnailDataUrl = await renderPageThumbnail(nextDocument, page).catch(() => "");
    if (!thumbnailDataUrl) return;
    commitDocument({
      ...nextDocument,
      pages: nextDocument.pages.map((item) => item.id === pageId ? { ...item, thumbnailDataUrl } : item),
      updatedAt: new Date().toISOString(),
    });
  }

  function rotateSelected(direction: "left" | "right") {
    if (!activePage) return;
    const nextRotation = direction === "right" ? rotateRight(activePage.finalRotation) : rotateLeft(activePage.finalRotation);
    const rotatedDocument = setManualPageRotation(documentState, activePage.id, nextRotation);
    const rotatedPage = rotatedDocument.pages.find((item) => item.id === activePage.id);
    const host = window.document.querySelector("[data-takeoff-engine-canvas]") as HTMLElement | null;
    let nextDocument = rotatedDocument;
    if (host && rotatedPage) {
      const rect = host.getBoundingClientRect();
      const centre = { x: rect.width / 2, y: rect.height / 2 };
      const oldScale = Math.max(0.0001, viewport.scale);
      const oldPlanCentre = {
        x: (centre.x - viewport.offsetX) / oldScale,
        y: (centre.y - viewport.offsetY) / oldScale,
      };
      const normalizedCentre = {
        x: oldPlanCentre.x / Math.max(1, activePage.renderedWidth),
        y: oldPlanCentre.y / Math.max(1, activePage.renderedHeight),
      };
      const nextPlanCentre = {
        x: normalizedCentre.x * rotatedPage.renderedWidth,
        y: normalizedCentre.y * rotatedPage.renderedHeight,
      };
      nextDocument = setPageViewport(rotatedDocument, activePage.id, {
        scale: viewport.scale,
        offsetX: centre.x - nextPlanCentre.x * viewport.scale,
        offsetY: centre.y - nextPlanCentre.y * viewport.scale,
      });
    }
    commitDocument(nextDocument, false, true);
    refreshThumbnail(nextDocument, activePage.id);
  }

  async function resetAutomatic() {
    if (!activePage) return;
    setStatus({ status: "orienting", detail: `Rechecking page ${activePage.pageNumber}`, percent: 45 });
    const orientation = await detectOrientation({
      pdfRotation: activePage.pdfRotation,
      textItems: activePage.textItems,
      vectorPaths: activePage.vectorPaths,
      pageWidth: activePage.originalWidth,
      pageHeight: activePage.originalHeight,
    });
    const rendered = rotatedDimensions(activePage.originalWidth, activePage.originalHeight, orientation.rotation);
    const nextDocument = updatePage(documentState, activePage.id, (page) => ({
      ...page,
      detectedRotation: orientation.rotation,
      manualRotation: null,
      finalRotation: orientation.rotation,
      orientationMode: "automatic",
      orientationConfidence: orientation.confidence,
      renderedWidth: rendered.width,
      renderedHeight: rendered.height,
    }));
    commitDocument(nextDocument, false, true);
    await refreshThumbnail(nextDocument, activePage.id);
    setStatus({ status: "ready", detail: "Automatic orientation reset", percent: 100 });
  }

  function confirmOrientation() {
    if (!activePage) return;
    commitDocument(confirmCurrentOrientation(documentState, activePage.id), false, true);
  }

  function patchActivePage(updater: (page: NonNullable<typeof activePage>) => NonNullable<typeof activePage>, history = true) {
    if (!activePage) return;
    commitDocument(updatePage(documentState, activePage.id, updater as any), false, history);
  }

  function setObjects(objects: TakeoffObject[], history = true) {
    patchActivePage((page) => ({ ...page, objects }), history);
  }

  function addObjects(objects: TakeoffObject[]) {
    if (!activePage || !objects.length) return;
    setObjects([...(activePage.objects || []), ...objects], true);
  }

  function updateSelectedObject(patch: Partial<TakeoffObject>) {
    if (!activePage || !selectedObjectId) return;
    setObjects((activePage.objects || []).map((object) => object.id === selectedObjectId ? { ...object, ...patch, status: patch.status || "edited" } : object), true);
  }

  function deleteSelected() {
    if (!activePage || !selectedObjectId) return;
    setObjects((activePage.objects || []).filter((object) => object.id !== selectedObjectId), true);
    setSelectedObjectId(null);
  }

  function rejectSelected() {
    updateSelectedObject({ status: "rejected" });
  }

  function confirmAll() {
    if (!activePage) return;
    setObjects((activePage.objects || []).map((object) => object.status === "detected" ? { ...object, status: "confirmed" } : object), true);
  }

  function clearAiResults() {
    if (!activePage) return;
    setObjects((activePage.objects || []).filter((object) => object.source !== "ai" || ["confirmed", "edited", "manual"].includes(object.status)), true);
  }

  function objectFromTool(tool: string, points: Array<{ x: number; y: number }>): TakeoffObject | null {
    if (!activePage) return null;
    const id = `${tool}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const scale = activePage.millimetresPerPlanUnit || 1;
    if (tool === "measure" || tool === "polyline") {
      return {
        id,
        type: tool === "measure" ? "measurement" : "polyline",
        label: tool === "measure" ? "Measurement" : "Polyline",
        points,
        lengthMm: Math.round(polyLength(points) * scale),
        confidence: 1,
        source: "manual",
        status: "manual",
        displayColour: "#ea580c",
      };
    }
    if (tool === "exteriorWall" || tool === "interiorWall") {
      return {
        id,
        type: "wall",
        wallType: tool === "exteriorWall" ? "exterior" : "interior",
        label: tool === "exteriorWall" ? "Exterior wall" : "Interior wall",
        points,
        thicknessMm: activePage.millimetresPerPlanUnit ? Math.round(activePage.millimetresPerPlanUnit) : null,
        confidence: 1,
        source: "manual",
        status: "manual",
        displayColour: tool === "exteriorWall" ? "green" : "blue",
      };
    }
    if (tool === "door" || tool === "window" || tool === "opening") {
      return { id, type: tool as any, label: tool, points, confidence: 1, source: "manual", status: "manual", displayColour: tool === "door" ? "#f97316" : tool === "window" ? "#0ea5e9" : "#a855f7" };
    }
    if (tool === "room" || tool === "rectangleArea" || tool === "polygonArea" || tool === "column") {
      const polygon = tool === "rectangleArea" && points.length >= 2 ? rectanglePoints(points[0], points[1]) : points;
      return {
        id,
        type: tool === "column" ? "column" : "room",
        label: tool === "column" ? "Column" : "Room",
        points: polygon,
        areaMm2: Math.round(polyArea(polygon) * scale * scale),
        perimeterMm: Math.round(polyLength([...polygon, polygon[0]].filter(Boolean)) * scale),
        confidence: 1,
        source: "manual",
        status: "manual",
        displayColour: tool === "column" ? "#a855f7" : "rgba(16, 185, 129, 0.28)",
      };
    }
    return null;
  }

  function completeDraftForTool(tool: string, points: Array<{ x: number; y: number }>) {
    if (["measure", "exteriorWall", "interiorWall", "door", "window", "opening", "rectangleArea"].includes(tool)) return points.length >= 2;
    if (tool === "column") return points.length >= 2;
    if (tool === "room" || tool === "polygonArea") return points.length >= 3;
    if (tool === "polyline") return points.length >= 2;
    return false;
  }

  function handlePlanPointer(point: { x: number; y: number }, shiftKey = false) {
    if (!activePage) return;
    if (activeTool === "scale") {
      if (!scaleDraft.start) {
        setScaleDraft({ start: point, end: null, liveEnd: null });
        patchActivePage((page) => ({ ...page, scaleStatus: "pending" }), false);
        return;
      }
      const end = constrainScalePoint(scaleDraft.start, point, shiftKey);
      setScaleDraft({ start: scaleDraft.start, end, liveEnd: end });
      setScaleDialog({ start: scaleDraft.start, end, distanceMm: "" });
      return;
    }
    const next = [...draftPoints, point];
    if (completeDraftForTool(activeTool, next)) {
      const object = objectFromTool(activeTool, next);
      if (object) {
        addObjects([object]);
        setSelectedObjectId(object.id);
      }
      setDraftPoints([]);
    } else {
      setDraftPoints(next);
    }
  }

  function handlePlanMove(point: { x: number; y: number }, shiftKey = false) {
    if (activeTool !== "scale" || !scaleDraft.start || scaleDialog) return;
    setScaleDraft((current) => current.start ? { ...current, liveEnd: constrainScalePoint(current.start, point, shiftKey) } : current);
  }

  function handleScaleHandleDrag(handle: "start" | "end", point: { x: number; y: number }, shiftKey = false) {
    setScaleDraft((current) => {
      if (!current.start) return current;
      if (handle === "start") return { ...current, start: point };
      return { ...current, end: constrainScalePoint(current.start, point, shiftKey), liveEnd: constrainScalePoint(current.start, point, shiftKey) };
    });
    setScaleDialog((current) => {
      if (!current) return current;
      if (handle === "start") return { ...current, start: point };
      return { ...current, end: constrainScalePoint(current.start, point, shiftKey) };
    });
  }

  function confirmScale() {
    if (!activePage || !scaleDialog) return;
    const knownDistanceMm = Number(scaleDialog.distanceMm);
    const measuredPlanDistance = Math.hypot(scaleDialog.end.x - scaleDialog.start.x, scaleDialog.end.y - scaleDialog.start.y);
    if (!(knownDistanceMm > 0) || !(measuredPlanDistance > 0)) {
      setStatus({ status: "failed", detail: "Enter a valid known distance in millimetres", percent: 0 });
      return;
    }
    const millimetresPerPlanUnit = knownDistanceMm / measuredPlanDistance;
    patchActivePage((page) => ({
      ...page,
      scaleStatus: "confirmed",
      knownDistanceMm,
      measuredPlanDistance,
      millimetresPerPlanUnit,
      scaleRatio: Math.round(millimetresPerPlanUnit),
      scaleSource: "manual",
      scaleConfidence: 1,
      calibrationLine: { start: scaleDialog.start, end: scaleDialog.end },
      showCalibrationLine: false,
    }), true);
    setScaleDialog(null);
    setScaleDraft({ start: null, end: null, liveEnd: null });
    setActiveTool("select");
    setStatus({ status: "ready", detail: "Scale confirmed", percent: 100 });
  }

  function cancelScale() {
    setScaleDialog(null);
    setScaleDraft({ start: null, end: null, liveEnd: null });
    if (activePage?.scaleStatus === "pending") {
      patchActivePage((page) => ({
        ...page,
        scaleStatus: page.millimetresPerPlanUnit ? "confirmed" : "unknown",
      }), false);
    }
  }

  async function runDetectionStep(label: string, percent: number, fn: () => TakeoffObject[] | void | Promise<TakeoffObject[] | void>) {
    setStatus({ status: "extracting", detail: label, percent });
    await new Promise((resolve) => window.setTimeout(resolve, 20));
    return fn();
  }

  async function runAiDetection() {
    if (!activePage) return;
    if (activePage.scaleStatus !== "confirmed") {
      setStatus({ status: "failed", detail: "Confirm scale before running AI detection", percent: 0 });
      return;
    }
    setStatus({ status: "reading", detail: "Analysing page", percent: 5 });
    const pageAfterScale = activePage;
    const exterior = await runDetectionStep("Detecting exterior walls", 40, () => detectExteriorWalls(pageAfterScale));
    const interior = await runDetectionStep("Detecting interior walls", 54, () => detectInteriorWalls(pageAfterScale));
    const rooms = await runDetectionStep("Detecting rooms", 68, () => detectRooms(pageAfterScale));
    const doors = await runDetectionStep("Detecting doors", 78, () => detectDoors(pageAfterScale));
    const windows = await runDetectionStep("Detecting windows", 88, () => detectWindows(pageAfterScale));
    const openings = await runDetectionStep("Detecting openings", 94, () => detectOpenings(pageAfterScale));
    const objects = replaceDetectedObjects(activePage.objects || [], [...(exterior || []), ...(interior || []), ...(rooms || []), ...(doors || []), ...(windows || []), ...(openings || [])], true);
    patchActivePage((page) => ({ ...page, objects, aiDetectionRun: true }), true);
    setStatus({ status: "ready", detail: "Ready for review", percent: 100 });
  }

  return (
    <section style={styles.shell} data-takeoff-engine-viewer>
      {startupError ? (
        <div style={styles.startupError} role="alert">
          <strong>Takeoff Engine Error</strong>
          <span>{startupError.message}</span>
          <button type="button" style={styles.primarySmallButton} onClick={clearLegacyTakeoffData}>Clear Takeoff Cache</button>
        </div>
      ) : null}
      <div style={styles.header}>
        <div>
          <div style={styles.activeMarker}>NEW TAKEOFF ENGINE BUILD ACTIVE</div>
          <div style={styles.eyebrow}>PDF takeoff engine</div>
          <h2 style={styles.title}>AI Plan Takeoff</h2>
          {activeRoute ? <div style={styles.routeText}>{activeRoute}</div> : null}
        </div>
        <div style={styles.headerActions}>
          <button type="button" style={styles.clearButton} onClick={clearLegacyTakeoffData}>Clear Legacy Takeoff Data</button>
          <label style={status.status === "ready" ? styles.uploadButton : styles.uploadButtonDisabled}>
            {status.status === "ready" ? "Upload PDF" : "Processing..."}
            <input type="file" accept="application/pdf" onChange={handleUpload} disabled={status.status !== "ready"} style={styles.fileInput} />
          </label>
        </div>
      </div>
      <PlanToolbar
        page={activePage}
        viewport={viewport}
        activeTool={activeTool}
        onToolChange={(tool) => {
          if (tool !== "select" && tool !== "pan" && tool !== "scale" && activePage?.scaleStatus !== "confirmed") return;
          setActiveTool(tool);
          setDraftPoints([]);
          if (tool !== "scale") {
            setScaleDraft({ start: null, end: null, liveEnd: null });
            setScaleDialog(null);
          }
        }}
        onRotateLeft={() => rotateSelected("left")}
        onRotateRight={() => rotateSelected("right")}
        onResetAutomatic={resetAutomatic}
        onConfirmOrientation={confirmOrientation}
        onFitPage={() => setFitRequest((current) => ({ mode: "page", key: current.key + 1 }))}
        onFitWidth={() => setFitRequest((current) => ({ mode: "width", key: current.key + 1 }))}
        onZoomPreset={(scale) => setFitRequest((current) => ({ mode: "preset", key: current.key + 1, scale }))}
        onDeleteSelected={deleteSelected}
        onUndo={undo}
        onRedo={redo}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        onRunAiDetection={runAiDetection}
        onConfirmAll={confirmAll}
        onRejectSelected={rejectSelected}
        onClearAiResults={clearAiResults}
      />
      <div style={styles.body}>
        <PlanPageList pages={documentState.pages} activePageId={documentState.activePageId} onSelectPage={(pageId) => {
          setSelectedObjectId(null);
          setDraftPoints([]);
          commitDocument(selectPage(documentState, pageId));
        }} />
        <div style={styles.viewerWrap}>
          <PlanViewport
            document={documentState}
            page={activePage}
            viewport={viewport}
            activeTool={activeTool}
            fitRequest={fitRequest}
            onViewportChange={handleViewportChange}
            onViewportCommit={handleViewportCommit}
            selectedObjectId={selectedObjectId}
            draftPoints={draftPoints}
            scaleDraft={scaleDraft}
            onPlanPointer={handlePlanPointer}
            onPlanMove={handlePlanMove}
            onScaleHandleDrag={handleScaleHandleDrag}
            onSelectObject={setSelectedObjectId}
          />
          <ProcessingStatus {...status} />
          {scaleDialog ? (
            <div style={styles.scaleDialog} role="dialog" aria-modal="true">
              <div style={styles.dialogTitle}>Known distance</div>
              <input
                autoFocus
                style={styles.scaleInput}
                inputMode="decimal"
                value={scaleDialog.distanceMm}
                onChange={(event) => setScaleDialog({ ...scaleDialog, distanceMm: event.target.value })}
                placeholder="mm"
              />
              <div style={styles.dialogActions}>
                <button type="button" style={styles.primarySmallButton} onClick={confirmScale}>Confirm Scale</button>
                <button type="button" style={styles.smallButton} onClick={cancelScale}>Cancel</button>
              </div>
            </div>
          ) : null}
        </div>
        <PropertiesPanel
          document={documentState}
          page={activePage}
          selectedObject={(activePage?.objects || []).find((object) => object.id === selectedObjectId) || null}
          onUpdateSelected={updateSelectedObject}
          onConfirmSelected={() => updateSelectedObject({ status: "confirmed" })}
          onRejectSelected={rejectSelected}
          onDeleteSelected={deleteSelected}
          onToggleCalibrationLine={() => patchActivePage((page) => ({ ...page, showCalibrationLine: !page.showCalibrationLine }), true)}
        />
      </div>
    </section>
  );
}

function polyLength(points: Array<{ x: number; y: number }>) {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
  }
  return total;
}

function polyArea(points: Array<{ x: number; y: number }>) {
  if (points.length < 3) return 0;
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const next = points[(index + 1) % points.length];
    area += points[index].x * next.y - next.x * points[index].y;
  }
  return Math.abs(area / 2);
}

function rectanglePoints(a: { x: number; y: number }, b: { x: number; y: number }) {
  return [
    { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) },
    { x: Math.max(a.x, b.x), y: Math.min(a.y, b.y) },
    { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y) },
    { x: Math.min(a.x, b.x), y: Math.max(a.y, b.y) },
  ];
}

function constrainScalePoint(start: { x: number; y: number }, point: { x: number; y: number }, shiftKey: boolean) {
  if (!shiftKey) return point;
  const dx = point.x - start.x;
  const dy = point.y - start.y;
  const length = Math.hypot(dx, dy);
  if (!length) return point;
  const angle = Math.atan2(dy, dx);
  const step = Math.PI / 4;
  const snappedAngle = Math.round(angle / step) * step;
  return {
    x: start.x + Math.cos(snappedAngle) * length,
    y: start.y + Math.sin(snappedAngle) * length,
  };
}

function safeHydrateTakeoffDocument(raw: unknown, fallbackName: string) {
  try {
    return { document: hydrateTakeoffDocument(raw, fallbackName), error: null };
  } catch (error) {
    console.error("[Takeoff] initialisation failed", error);
    return {
      document: hydrateTakeoffDocument(null, fallbackName),
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    minHeight: 620,
    height: "calc(100vh - 180px)",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    overflow: "hidden",
  },
  startupError: {
    position: "absolute",
    left: 12,
    right: 12,
    top: 12,
    zIndex: 50,
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    border: "1px solid #fecaca",
    borderRadius: 6,
    background: "#fff7f7",
    color: "#7f1d1d",
    padding: 10,
    boxShadow: "0 12px 28px rgba(15, 23, 42, 0.18)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 10,
    borderBottom: "1px solid #d7dee8",
    background: "#ffffff",
  },
  eyebrow: {
    color: "#0f766e",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
  },
  activeMarker: {
    display: "inline-flex",
    alignItems: "center",
    border: "2px solid #0f766e",
    background: "#ccfbf1",
    color: "#134e4a",
    borderRadius: 6,
    padding: "4px 8px",
    fontSize: 12,
    fontWeight: 1000,
    marginBottom: 6,
  },
  routeText: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: 800,
    marginTop: 2,
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  clearButton: {
    border: "1px solid #f97316",
    background: "#fff7ed",
    color: "#9a3412",
    borderRadius: 6,
    padding: "8px 10px",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
  },
  title: {
    margin: 0,
    color: "#0f172a",
    fontSize: 24,
  },
  uploadButton: {
    border: "1px solid #0f766e",
    background: "#0f766e",
    color: "#ffffff",
    borderRadius: 6,
    padding: "8px 10px",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
  },
  uploadButtonDisabled: {
    border: "1px solid #94a3b8",
    background: "#94a3b8",
    color: "#ffffff",
    borderRadius: 6,
    padding: "8px 10px",
    fontSize: 13,
    fontWeight: 900,
    cursor: "not-allowed",
  },
  fileInput: {
    display: "none",
  },
  body: {
    display: "flex",
    flex: 1,
    minHeight: 0,
  },
  viewerWrap: {
    position: "relative",
    display: "flex",
    flex: 1,
    minWidth: 0,
    minHeight: 0,
  },
  scaleDialog: {
    position: "absolute",
    left: "50%",
    top: 16,
    transform: "translateX(-50%)",
    display: "grid",
    gap: 8,
    width: 220,
    border: "1px solid #cbd5e1",
    borderRadius: 6,
    background: "#ffffff",
    boxShadow: "0 12px 32px rgba(15, 23, 42, 0.22)",
    padding: 12,
    zIndex: 20,
  },
  dialogTitle: {
    color: "#334155",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
  },
  scaleInput: {
    border: "1px solid #cbd5e1",
    borderRadius: 6,
    padding: "8px 9px",
    fontSize: 14,
    fontWeight: 800,
  },
  dialogActions: {
    display: "flex",
    gap: 8,
    justifyContent: "flex-end",
  },
  smallButton: {
    border: "1px solid #cbd5e1",
    borderRadius: 6,
    background: "#ffffff",
    color: "#0f172a",
    padding: "6px 8px",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
  primarySmallButton: {
    border: "1px solid #0f766e",
    borderRadius: 6,
    background: "#0f766e",
    color: "#ffffff",
    padding: "6px 8px",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
};
