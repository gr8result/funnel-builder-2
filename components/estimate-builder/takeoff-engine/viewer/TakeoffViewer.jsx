import React, { useEffect, useMemo, useReducer, useState } from "react";
import TakeoffCanvas from "./TakeoffCanvas.jsx";
import TakeoffControls from "./TakeoffControls.jsx";
import ScaleTool from "../tools/ScaleTool.jsx";
import MeasureTool from "../tools/MeasureTool.jsx";
import AreaTool, { AREA_MODES } from "../tools/AreaTool.jsx";
import { buildPolygonArea } from "../core/measurement.js";
import { TAKEOFF_ACTIONS, createInitialTakeoffState, takeoffReducer } from "../state/takeoffReducer.js";
import { createViewState } from "../core/viewTransform.js";
import { TOOL_IDS } from "../core/types.js";
import { rotateRasterPage } from "../import/imageNormalizer.js";

export function getActivePage(state) {
  if (!state?.pages?.length) {
    return null;
  }
  return state.pages.find((page) => page.id === state.activePageId) || state.pages[0];
}

export function applyViewerViewState(state, viewState) {
  return takeoffReducer(state, {
    type: TAKEOFF_ACTIONS.SET_VIEW_STATE,
    payload: { viewState },
  });
}

export default function TakeoffViewer({
  initialState,
  onStateChange,
  onRotatePageOverride,
  onResetPageOrientation,
  importProgress = null,
}) {
  const [fitRequestKey, setFitRequestKey] = useState(0);
  const [fitRequestMode, setFitRequestMode] = useState("fit-page");
  const [scaleDraft, setScaleDraft] = useState({ pointA: null, pointB: null });
  const [measureDraft, setMeasureDraft] = useState({ pointA: null, pointB: null });
  const [areaDraft, setAreaDraft] = useState({
    mode: AREA_MODES.RECTANGLE,
    rectanglePointA: null,
    rectanglePointB: null,
    polygonPoints: [],
  });
  const [state, dispatchBase] = useReducer(takeoffReducer, initialState || createInitialTakeoffState());
  const page = useMemo(() => getActivePage(state), [state]);
  const viewState = createViewState(page?.viewState || {});

  useEffect(() => {
    onStateChange?.(state);
  }, [state, onStateChange]);

  function dispatch(action) {
    dispatchBase(action);
  }

  function setViewState(nextViewState) {
    dispatch({
      type: TAKEOFF_ACTIONS.SET_VIEW_STATE,
      payload: { viewState: nextViewState },
    });
  }

  function handleFit(mode = "fit-page") {
    setFitRequestMode(mode === "fit-width" ? "fit-width" : "fit-page");
    setFitRequestKey((value) => value + 1);
  }

  function handleZoomPreset(zoom) {
    setViewState({
      ...viewState,
      zoom,
      panX: 0,
      panY: 0,
    });
  }

  function handleSetScaleTool() {
    setScaleDraft({ pointA: null, pointB: null });
    setMeasureDraft({ pointA: null, pointB: null });
    resetAreaDraft();
    dispatch({
      type: TAKEOFF_ACTIONS.SET_TOOL,
      payload: { tool: TOOL_IDS.SCALE },
    });
  }

  function handleSetMeasureTool() {
    setMeasureDraft({ pointA: null, pointB: null });
    setScaleDraft({ pointA: null, pointB: null });
    resetAreaDraft();
    dispatch({
      type: TAKEOFF_ACTIONS.SET_TOOL,
      payload: { tool: TOOL_IDS.MEASURE },
    });
  }

  function handleSetAreaTool() {
    setScaleDraft({ pointA: null, pointB: null });
    setMeasureDraft({ pointA: null, pointB: null });
    resetAreaDraft();
    dispatch({
      type: TAKEOFF_ACTIONS.SET_TOOL,
      payload: { tool: TOOL_IDS.AREA },
    });
  }

  function handleSnapToggle(enabled) {
    dispatch({
      type: TAKEOFF_ACTIONS.SET_SNAP_ENABLED,
      payload: { enabled },
    });
  }

  function handleImageClick(point) {
    if (state.activeTool === TOOL_IDS.SCALE) {
      setScaleDraft((current) => {
        if (!current.pointA || (current.pointA && current.pointB)) {
          return { pointA: point, pointB: null };
        }
        return { ...current, pointB: point };
      });
    }

    if (state.activeTool === TOOL_IDS.MEASURE && page?.scale) {
      setMeasureDraft((current) => {
        if (!current.pointA || (current.pointA && current.pointB)) {
          return { pointA: point, pointB: null };
        }
        return { ...current, pointB: point };
      });
    }

    if (state.activeTool === TOOL_IDS.AREA && page?.scale) {
      setAreaDraft((current) => {
        if (current.mode === AREA_MODES.RECTANGLE) {
          if (!current.rectanglePointA || (current.rectanglePointA && current.rectanglePointB)) {
            return { ...current, rectanglePointA: point, rectanglePointB: null };
          }
          return { ...current, rectanglePointB: point };
        }

        return {
          ...current,
          polygonPoints: [...(current.polygonPoints || []), point],
        };
      });
    }
  }

  function handleSaveScale(scale) {
    dispatch({
      type: TAKEOFF_ACTIONS.SET_SCALE,
      payload: scale,
    });
    dispatch({
      type: TAKEOFF_ACTIONS.SET_TOOL,
      payload: { tool: TOOL_IDS.SELECT },
    });
    setScaleDraft({ pointA: null, pointB: null });
  }

  function handleApplyScaleSuggestion(suggestion) {
    dispatch({
      type: TAKEOFF_ACTIONS.APPLY_SCALE_SUGGESTION,
      payload: { suggestion },
    });
  }

  function handleResetScaleDraft() {
    setScaleDraft({ pointA: null, pointB: null });
  }

  function handleSaveMeasurement(measurement) {
    dispatch({
      type: TAKEOFF_ACTIONS.ADD_DISTANCE_MEASUREMENT,
      payload: measurement,
    });
    setMeasureDraft({ pointA: null, pointB: null });
  }

  function handleDeleteMeasurement(measurementId) {
    dispatch({
      type: TAKEOFF_ACTIONS.DELETE_MEASUREMENT,
      payload: { measurementId },
    });
  }

  function handleResetMeasureDraft() {
    setMeasureDraft({ pointA: null, pointB: null });
  }

  function resetAreaDraft(mode = areaDraft.mode || AREA_MODES.RECTANGLE) {
    setAreaDraft({
      mode,
      rectanglePointA: null,
      rectanglePointB: null,
      polygonPoints: [],
    });
  }

  function handleAreaModeChange(mode) {
    resetAreaDraft(mode);
  }

  function handleSaveArea(area) {
    dispatch({
      type: TAKEOFF_ACTIONS.ADD_AREA_MEASUREMENT,
      payload: area,
    });
    resetAreaDraft(areaDraft.mode);
  }

  function handleDeleteArea(areaId) {
    dispatch({
      type: TAKEOFF_ACTIONS.DELETE_AREA,
      payload: { areaId },
    });
  }

  function handleAreaDoubleClick() {
    if (state.activeTool !== TOOL_IDS.AREA || areaDraft.mode !== AREA_MODES.POLYGON || !page?.scale || areaDraft.polygonPoints.length < 3) {
      return;
    }

    handleSaveArea(buildPolygonArea({
      points: areaDraft.polygonPoints,
      scale: page.scale,
    }));
  }

  async function handleRotate(deltaRotation) {
    if (!page?.imageDataUrl) {
      return;
    }

    if (typeof onRotatePageOverride === "function") {
      const handled = await onRotatePageOverride(page.id, deltaRotation);
      if (handled) {
        return;
      }
    }

    try {
      const rotatedPage = await rotateRasterPage(page, deltaRotation);
      dispatch({
        type: TAKEOFF_ACTIONS.REPLACE_PAGE,
        payload: {
          ...rotatedPage,
          orientation: {
            ...(rotatedPage.orientation || page.orientation || {}),
            userRotation: ((Number(page?.orientation?.userRotation || 0) + Number(deltaRotation || 0)) % 360 + 360) % 360,
            appliedRotation: ((Number(page?.orientation?.appliedRotation || 0) + Number(deltaRotation || 0)) % 360 + 360) % 360,
            confidence: "manual",
            method: "manual-raster-rotation",
            manualOverride: true,
            orientationConfirmed: true,
            warning: "",
          },
          metadata: {
            ...(rotatedPage.metadata || page.metadata || {}),
            orientationManualOverride: true,
            orientationAutoApplied: false,
          },
        },
      });
      setScaleDraft({ pointA: null, pointB: null });
      setMeasureDraft({ pointA: null, pointB: null });
      resetAreaDraft();
      setFitRequestKey((value) => value + 1);
    } catch (error) {
      console.error("[takeoff-engine] raster rotation failed", error);
    }
  }

  function handleConfirmOrientation() {
    dispatch({ type: TAKEOFF_ACTIONS.CONFIRM_ORIENTATION });
  }

  function handleResetOrientation() {
    if (page?.id && typeof onResetPageOrientation === "function") {
      onResetPageOrientation(page.id);
    }
  }

  return (
    <section style={styles.shell} data-takeoff-engine-viewer>
      <TakeoffControls
        page={page}
        viewState={viewState}
        activeTool={state.activeTool}
        snapEnabled={state.settings?.snapEnabled !== false}
        onFit={handleFit}
        onZoomPreset={handleZoomPreset}
        onSetScaleTool={handleSetScaleTool}
        onSetMeasureTool={handleSetMeasureTool}
        onSetAreaTool={handleSetAreaTool}
        onSnapToggle={handleSnapToggle}
        onRotate={handleRotate}
        onConfirmOrientation={handleConfirmOrientation}
        onResetOrientation={handleResetOrientation}
        onApplyScaleSuggestion={handleApplyScaleSuggestion}
      />
      <div style={styles.body}>
        <TakeoffCanvas
          page={page}
          viewState={viewState}
          activeTool={state.activeTool}
          scaleDraft={scaleDraft}
          measureDraft={measureDraft}
          areaDraft={areaDraft}
          snapEnabled={state.settings?.snapEnabled !== false}
          fitRequestKey={fitRequestKey}
          fitRequestMode={fitRequestMode}
          onViewStateChange={setViewState}
          onImageClick={handleImageClick}
          onImageDoubleClick={handleAreaDoubleClick}
        />
        {importProgress?.active ? (
          <div style={styles.importOverlay} role="status" aria-live="polite">
            <div style={styles.importPanel}>
              <div style={styles.importTitle}>{importProgress.message || "Importing plan..."}</div>
              {importProgress.detail ? <div style={styles.importDetail}>{importProgress.detail}</div> : null}
              <div style={styles.progressTrack}>
                <div style={{ ...styles.progressFill, width: `${Math.max(0, Math.min(100, importProgress.percent || 0))}%` }} />
              </div>
              {importProgress.largePlan ? (
                <div style={styles.largePlanNotice}>Large plan detected. This may take a little longer.</div>
              ) : null}
            </div>
          </div>
        ) : null}
        {state.activeTool === TOOL_IDS.SCALE || (page?.scale && state.activeTool !== TOOL_IDS.MEASURE && state.activeTool !== TOOL_IDS.AREA) ? (
          <ScaleTool
            pointA={scaleDraft.pointA}
            pointB={scaleDraft.pointB}
            scale={state.activeTool === TOOL_IDS.SCALE ? null : page?.scale}
            suggestedScale={page?.metadata?.suggestedScale || null}
            dimensionCandidates={page?.metadata?.dimensionCandidates || []}
            onApplyScaleSuggestion={handleApplyScaleSuggestion}
            onSaveScale={handleSaveScale}
            onReset={handleResetScaleDraft}
          />
        ) : null}
        {state.activeTool === TOOL_IDS.MEASURE ? (
          <MeasureTool
            scale={page?.scale}
            pointA={measureDraft.pointA}
            pointB={measureDraft.pointB}
            measurements={page?.measurements || []}
            onSaveMeasurement={handleSaveMeasurement}
            onDeleteMeasurement={handleDeleteMeasurement}
            onReset={handleResetMeasureDraft}
          />
        ) : null}
        {state.activeTool === TOOL_IDS.AREA ? (
          <AreaTool
            scale={page?.scale}
            mode={areaDraft.mode}
            rectanglePointA={areaDraft.rectanglePointA}
            rectanglePointB={areaDraft.rectanglePointB}
            polygonPoints={areaDraft.polygonPoints}
            areas={page?.areas || []}
            onModeChange={handleAreaModeChange}
            onSaveArea={handleSaveArea}
            onDeleteArea={handleDeleteArea}
            onReset={() => resetAreaDraft(areaDraft.mode)}
          />
        ) : null}
      </div>
    </section>
  );
}

const styles = {
  shell: {
    display: "flex",
    flexDirection: "column",
    minHeight: 520,
    height: "100%",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    overflow: "hidden",
  },
  body: {
    display: "flex",
    flex: 1,
    minHeight: 0,
    position: "relative",
  },
  importOverlay: {
    position: "absolute",
    inset: 0,
    zIndex: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(248, 250, 252, 0.82)",
    backdropFilter: "blur(1px)",
  },
  importPanel: {
    width: "min(460px, calc(100% - 32px))",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    borderRadius: 8,
    boxShadow: "0 18px 40px rgba(15, 23, 42, 0.18)",
    padding: 16,
  },
  importTitle: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: 900,
    marginBottom: 5,
  },
  importDetail: {
    color: "#475569",
    fontSize: 12,
    fontWeight: 800,
    marginBottom: 12,
  },
  progressTrack: {
    height: 8,
    background: "#e2e8f0",
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: "#0f766e",
    borderRadius: 999,
    transition: "width 160ms ease",
  },
  largePlanNotice: {
    marginTop: 10,
    color: "#92400e",
    background: "#fffbeb",
    border: "1px solid #fde68a",
    borderRadius: 6,
    padding: "7px 8px",
    fontSize: 12,
    fontWeight: 900,
  },
};
