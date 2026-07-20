import { createScaleCalibration, createScaleFromSuggestion } from "../core/scale.js";
import { TOOL_IDS, createRasterPage, createTakeoffDocument } from "../core/types.js";
import { applyManualRotation, confirmOrientation } from "../core/orientation.js";
import { createAreaMeasurement, createDistanceMeasurement } from "../core/measurement.js";

export const TAKEOFF_ACTIONS = Object.freeze({
  RESET: "takeoff/reset",
  ADD_PAGE: "takeoff/addPage",
  REPLACE_PAGE: "takeoff/replacePage",
  DELETE_PAGE: "takeoff/deletePage",
  DUPLICATE_PAGE: "takeoff/duplicatePage",
  RENAME_PAGE: "takeoff/renamePage",
  SET_ACTIVE_PAGE: "takeoff/setActivePage",
  SET_TOOL: "takeoff/setTool",
  SET_SNAP_ENABLED: "takeoff/setSnapEnabled",
  SET_VIEW_STATE: "takeoff/setViewState",
  SET_SCALE: "takeoff/setScale",
  APPLY_SCALE_SUGGESTION: "takeoff/applyScaleSuggestion",
  CLEAR_SCALE: "takeoff/clearScale",
  ADD_DISTANCE_MEASUREMENT: "takeoff/addDistanceMeasurement",
  DELETE_MEASUREMENT: "takeoff/deleteMeasurement",
  ADD_AREA_MEASUREMENT: "takeoff/addAreaMeasurement",
  DELETE_AREA: "takeoff/deleteArea",
  ROTATE_PAGE: "takeoff/rotatePage",
  CONFIRM_ORIENTATION: "takeoff/confirmOrientation",
});

export function createInitialTakeoffState(overrides = {}) {
  return createTakeoffDocument(overrides);
}

function updateActivePage(state, updater) {
  if (!state.activePageId) {
    return state;
  }

  return {
    ...state,
    pages: state.pages.map((page) => (page.id === state.activePageId ? updater(page) : page)),
    updatedAt: new Date().toISOString(),
  };
}

function updatePageById(state, pageId, updater) {
  if (!pageId) {
    return state;
  }

  return {
    ...state,
    pages: state.pages.map((page) => (page.id === pageId ? updater(page) : page)),
    updatedAt: new Date().toISOString(),
  };
}

function clonePage(page) {
  return JSON.parse(JSON.stringify(page));
}

export function takeoffReducer(state = createInitialTakeoffState(), action = {}) {
  switch (action.type) {
    case TAKEOFF_ACTIONS.RESET:
      return createInitialTakeoffState(action.payload || {});

    case TAKEOFF_ACTIONS.ADD_PAGE: {
      const page = createRasterPage(action.payload || {});
      return {
        ...state,
        pages: [...state.pages, page],
        activePageId: state.activePageId || page.id,
        updatedAt: new Date().toISOString(),
      };
    }

    case TAKEOFF_ACTIONS.REPLACE_PAGE: {
      const page = createRasterPage(action.payload || {});
      if (!page.id || !state.pages.some((item) => item.id === page.id)) {
        return state;
      }

      return {
        ...state,
        pages: state.pages.map((item) => (item.id === page.id ? page : item)),
        activePageId: state.activePageId || page.id,
        updatedAt: new Date().toISOString(),
      };
    }

    case TAKEOFF_ACTIONS.DELETE_PAGE: {
      const pageId = action.payload?.pageId;
      const deleteIndex = state.pages.findIndex((page) => page.id === pageId);
      const pages = state.pages.filter((page) => page.id !== pageId);
      const nextActivePage = state.activePageId === pageId
        ? pages[Math.min(Math.max(deleteIndex, 0), pages.length - 1)] || null
        : pages.find((page) => page.id === state.activePageId) || null;
      return {
        ...state,
        pages,
        activePageId: nextActivePage?.id || null,
        activeTool: pages.length ? state.activeTool : TOOL_IDS.SELECT,
        selectedMeasurementId: null,
        selectedAreaId: null,
        updatedAt: new Date().toISOString(),
      };
    }

    case TAKEOFF_ACTIONS.DUPLICATE_PAGE: {
      const sourcePage = state.pages.find((page) => page.id === action.payload?.pageId);
      if (!sourcePage) {
        return state;
      }

      const page = {
        ...clonePage(sourcePage),
        id: `page-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        sourceFileName: `${sourcePage.sourceFileName || "Raster page"} copy`,
        viewState: null,
      };

      const sourceIndex = state.pages.findIndex((item) => item.id === sourcePage.id);
      const pages = [...state.pages];
      pages.splice(sourceIndex + 1, 0, page);

      return {
        ...state,
        pages,
        activePageId: page.id,
        selectedMeasurementId: null,
        selectedAreaId: null,
        updatedAt: new Date().toISOString(),
      };
    }

    case TAKEOFF_ACTIONS.RENAME_PAGE:
      return updatePageById(state, action.payload?.pageId, (page) => ({
        ...page,
        sourceFileName: String(action.payload?.name || page.sourceFileName || "Raster page").trim() || page.sourceFileName,
      }));

    case TAKEOFF_ACTIONS.SET_ACTIVE_PAGE:
      return {
        ...state,
        activePageId: state.pages.some((page) => page.id === action.payload?.pageId) ? action.payload.pageId : null,
        updatedAt: new Date().toISOString(),
      };

    case TAKEOFF_ACTIONS.SET_TOOL:
      return {
        ...state,
        activeTool: action.payload?.tool || TOOL_IDS.SELECT,
        updatedAt: new Date().toISOString(),
      };

    case TAKEOFF_ACTIONS.SET_SNAP_ENABLED:
      return {
        ...state,
        settings: {
          ...(state.settings || {}),
          snapEnabled: Boolean(action.payload?.enabled),
        },
        updatedAt: new Date().toISOString(),
      };

    case TAKEOFF_ACTIONS.SET_VIEW_STATE:
      return updateActivePage(state, (page) => ({ ...page, viewState: action.payload?.viewState || null }));

    case TAKEOFF_ACTIONS.SET_SCALE:
      return updateActivePage(state, (page) => ({
        ...page,
        scale: createScaleCalibration(action.payload || {}),
      }));

    case TAKEOFF_ACTIONS.APPLY_SCALE_SUGGESTION:
      return updateActivePage(state, (page) => ({
        ...page,
        scale: createScaleFromSuggestion(action.payload?.suggestion || page.metadata?.suggestedScale || {}),
        metadata: {
          ...page.metadata,
          scaleSuggestionConfirmed: true,
          confirmedScaleSuggestion: action.payload?.suggestion || page.metadata?.suggestedScale || null,
        },
      }));

    case TAKEOFF_ACTIONS.CLEAR_SCALE:
      return updateActivePage(state, (page) => ({
        ...page,
        scale: null,
      }));

    case TAKEOFF_ACTIONS.ADD_DISTANCE_MEASUREMENT:
      return updateActivePage(state, (page) => ({
        ...page,
        measurements: [
          ...page.measurements,
          createDistanceMeasurement({
            ...(action.payload || {}),
            start: action.payload?.start || action.payload?.pointA || action.payload?.points?.[0],
            end: action.payload?.end || action.payload?.pointB || action.payload?.points?.[1],
            scale: page.scale,
          }),
        ],
      }));

    case TAKEOFF_ACTIONS.DELETE_MEASUREMENT:
      return updateActivePage(state, (page) => ({
        ...page,
        measurements: page.measurements.filter((measurement) => measurement.id !== action.payload?.measurementId),
      }));

    case TAKEOFF_ACTIONS.ADD_AREA_MEASUREMENT:
      return updateActivePage(state, (page) => ({
        ...page,
        areas: [
          ...page.areas,
          createAreaMeasurement({
            ...(action.payload || {}),
            scale: page.scale,
          }),
        ],
      }));

    case TAKEOFF_ACTIONS.DELETE_AREA:
      return updateActivePage(state, (page) => ({
        ...page,
        areas: page.areas.filter((area) => area.id !== action.payload?.areaId),
      }));

    case TAKEOFF_ACTIONS.ROTATE_PAGE: {
      const updater = (page) => {
        const orientation = applyManualRotation(page.orientation, action.payload?.deltaRotation || 0);
        return {
          ...page,
          autoRotation: orientation.autoRotation,
          manualRotation: orientation.manualRotation,
          finalRotation: orientation.finalRotation,
          orientationMode: orientation.orientationMode,
          orientation,
          scale: null,
          measurements: [],
          areas: [],
          viewState: null,
          metadata: {
            ...(page.metadata || {}),
            orientationMode: orientation.orientationMode,
            orientationManualOverride: true,
            orientationAutoApplied: false,
          },
          orientationResetWarning: "This page was rotated manually. Scale and measurements were reset because the coordinate system changed.",
        };
      };
      return action.payload?.pageId
        ? updatePageById(state, action.payload.pageId, updater)
        : updateActivePage(state, updater);
    }

    case TAKEOFF_ACTIONS.CONFIRM_ORIENTATION:
      return updateActivePage(state, (page) => ({
        ...page,
        ...(() => {
          const orientation = confirmOrientation(page.orientation);
          return {
            autoRotation: orientation.autoRotation,
            manualRotation: orientation.manualRotation,
            finalRotation: orientation.finalRotation,
            orientationMode: orientation.orientationMode,
            orientation,
            metadata: {
              ...(page.metadata || {}),
              orientationMode: orientation.orientationMode,
              orientationManualOverride: true,
              orientationAutoApplied: false,
            },
          };
        })(),
      }));

    default:
      return state;
  }
}
