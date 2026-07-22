// takeoffTypes.js — Phase 2: Manual Takeoff

// ── Tool constants ────────────────────────────────────────────────────────────

export const TOOLS = {
  POINTER:       "pointer",
  PAN:           "pan",
  MEASURE:       "measure",
  AREA:          "area",
  POLYLINE:      "polyline",
  EXTERNAL_WALL: "externalWall",
  INTERNAL_WALL: "internalWall",
  ROOM:          "room",
  RECTANGLE:     "rectangle",
  CIRCLE:        "circle",
  DOOR:          "door",
  WINDOW:        "window",
  COLUMN:        "column",
  DELETE:        "delete",
  CALIBRATE:     "calibrate",
};

// ── Overlay type constants ────────────────────────────────────────────────────

export const OT = {
  EXTERNAL_WALL: "externalWall",
  INTERNAL_WALL: "internalWall",
  ROOM:          "room",
  AREA:          "area",
  RECTANGLE:     "rectangle",
  CIRCLE:        "circle",
  POLYLINE:      "polyline",
  MEASURE:       "measure",
  DOOR:          "door",
  WINDOW:        "window",
  COLUMN:        "column",
};

// Polyline tools: click many points, double-click or Enter to finish one shape
export const POLYLINE_TOOLS = new Set([
  TOOLS.EXTERNAL_WALL, TOOLS.POLYLINE,
]);

// Segment tools: click A → click B → auto-commit, tool stays active for next segment
// Internal walls are INDEPENDENT segments, not a connected polyline.
export const SEGMENT_TOOLS = new Set([TOOLS.INTERNAL_WALL, TOOLS.MEASURE]);

// Polygon tools: click vertices, close to finish
export const POLYGON_TOOLS = new Set([TOOLS.ROOM, TOOLS.AREA]);

// Single-click marker tools
export const MARKER_TOOLS = new Set([TOOLS.DOOR, TOOLS.WINDOW, TOOLS.COLUMN]);

// Two-click area tools (rectangle = 2 corners, circle = centre + radius)
export const TWO_POINT_TOOLS = new Set([TOOLS.RECTANGLE, TOOLS.CIRCLE]);

// ── Visual style per overlay type ─────────────────────────────────────────────

export const STYLE = {
  [OT.EXTERNAL_WALL]: { stroke: "#1d4ed8", sw: 4,   fill: "none",                  label: "External Wall" },
  [OT.INTERNAL_WALL]: { stroke: "#ea580c", sw: 2.5, fill: "none",                  label: "Internal Wall" },
  [OT.ROOM]:          { stroke: "#0369a1", sw: 1.5, fill: "rgba(3,105,161,0.08)",  label: "Room"          },
  [OT.AREA]:          { stroke: "#0f766e", sw: 1.8, fill: "rgba(15,118,110,0.08)", label: "Area"          },
  [OT.RECTANGLE]:     { stroke: "#7c3aed", sw: 1.5, fill: "rgba(124,58,237,0.06)", label: "Area"          },
  [OT.CIRCLE]:        { stroke: "#0891b2", sw: 1.5, fill: "rgba(8,145,178,0.06)",  label: "Circle Area"   },
  [OT.POLYLINE]:      { stroke: "#64748b", sw: 1.5, fill: "none",                  label: "Polyline"      },
  [OT.MEASURE]:       { stroke: "#ef4444", sw: 2,   fill: "none",                  label: "Measurement"   },
  [OT.DOOR]:          { stroke: "#16a34a", sw: 2,   fill: "#16a34a",               label: "Door"          },
  [OT.WINDOW]:        { stroke: "#7c3aed", sw: 2,   fill: "#7c3aed",               label: "Window"        },
  [OT.COLUMN]:        { stroke: "#92400e", sw: 2,   fill: "#92400e",               label: "Column"        },
};

// ── Lists ─────────────────────────────────────────────────────────────────────

export const FLOOR_FINISHES = [
  { value: "",          label: "— unassigned —" },
  { value: "tiles",     label: "Tiles"           },
  { value: "carpet",    label: "Carpet"          },
  { value: "timber",    label: "Timber"          },
  { value: "laminate",  label: "Laminate"        },
  { value: "hybrid",    label: "Hybrid"          },
  { value: "vinyl",     label: "Vinyl"           },
  { value: "concrete",  label: "Concrete"        },
  { value: "other",     label: "Other"           },
];

export const WALL_TYPES = [
  { value: "",          label: "— unspecified —" },
  { value: "single",    label: "Single skin"     },
  { value: "double",    label: "Double skin"     },
  { value: "stud",      label: "Stud frame"      },
  { value: "masonry",   label: "Masonry"         },
];

export const LEVELS = [
  { value: "ground",  label: "Ground Level" },
  { value: "level-2", label: "Level 2"      },
  { value: "level-3", label: "Level 3"      },
  { value: "other",   label: "Other"        },
];

// Alias so PDFUploadPanel.jsx (unchanged file) doesn't break
export const LEVEL_OPTIONS = LEVELS;

export const SCALE_PRESETS = [
  { label: "1:50",   value: "1:50",   ratio: 50   },
  { label: "1:100",  value: "1:100",  ratio: 100  },
  { label: "1:200",  value: "1:200",  ratio: 200  },
  { label: "1:500",  value: "1:500",  ratio: 500  },
];

// ── Factories ─────────────────────────────────────────────────────────────────

let _seq = 0;
export function newId() { return `ov-${Date.now()}-${++_seq}`; }

export function createOverlay({ type, points, label, level = "ground", extra = {} }) {
  return {
    id:          newId(),
    type,
    points:      points.map(p => ({ x: p.x, y: p.y })),
    label:       label || STYLE[type]?.label || type,
    level,
    status:      "draft",           // "draft" | "confirmed"
    wallType:    "",
    floorFinish: "",
    roomName:    "",
    notes:       "",
    ...extra,
  };
}

export function createPage(pageNumber) {
  return {
    id:           `pg-${Date.now()}-${pageNumber}`,
    sourceType:   "",
    sourceFileName: "",
    pageNumber,
    level:        "ground",
    imageDataUrl: null,
    originalWidth: 0,
    originalHeight: 0,
    metadataRotation: 0,
    detectedRotation: 0,
    userRotation: 0,
    finalRotation: 0,
    rotation: 0,
    imageWidth:    0,
    imageHeight:   0,
    renderScale:   300 / 72,
    dpi:           300,
    format:        "PNG",
    sourcePdfPageNumber: pageNumber,
    orientationMethod: "",
    orientationConfidence: "",
    orientationScores: [],
    detectedScaleText: "",
    normalizedWidth: 0,
    normalizedHeight: 0,
    naturalWidth: 0,
    naturalHeight:0,
    scale:        null,
    overlays:     [],
    viewState:    null,
  };
}

export function createProject(jobId = "") {
  return {
    id:          `tp-${Date.now()}`,
    jobId,
    pdfFilename: "",
    pages:       [],
    createdAt:   new Date().toISOString(),
    updatedAt:   new Date().toISOString(),
  };
}
