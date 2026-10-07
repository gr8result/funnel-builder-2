import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useAiTakeoffBridge } from './ai-integration/useAiTakeoffBridge.js';
import { AiTakeoffDevelopmentAction } from './ai-integration/AiTakeoffDevelopmentAction.jsx';
import { AiTakeoffAction } from './ai-integration/AiTakeoffAction.jsx';
import { useAiTakeoffAnalysis } from './ai-integration/useAiTakeoffAnalysis.js';
import { readPdfAnalysisEvidence } from './ai-integration/analysisPages.js';
import { parseWindowSizeCode } from './ai-integration/analysisContract.js';
import { DOOR_SUBTYPE_LABELS } from '../../../lib/construction-estimation/takeoffMaterialQuantities.js';
import { externalizeTakeoffRecoverySnapshot, materializeTakeoffPlanPages, materializeTakeoffRecoverySnapshot } from './planBlobStorage.js';
import { getPlanDisplayIdentity, getTakeoffLifecycle, loadTakeoffPlanImage, createTakeoffObjectUrl, revokeTakeoffObjectUrl, logTakeoffPlanLoad, describePlanPageReferences } from './takeoffLifecycle.js';
import { Stage, Layer, Image as KonvaImage, Line, Circle, Text, Rect, Group } from 'react-konva';
import { RotateCw, Ruler, ChevronLeft, ChevronRight, DoorOpen, Square, Layers, Trash2, Home, Compass, Download, Upload, MousePointer2, RectangleVertical } from 'lucide-react';
import { calculatePolygonAreaM2, findFloorplanCornerSnapPoint, resolveFloorplanFreePoint } from './floorplanGeometry';
import { AI_PLAN_TAKEOFF_EXTENSION, filenameWithoutKnownGr8Extension } from '../../../lib/gr8FileTypes.js';
const AI_PLAN_TAKEOFF_FILE_DESCRIPTION = 'Gr8 Result AI Plan Takeoff';
import { EXTERIOR_WALL_CLASSES, normaliseLevel, resolveTakeoffLevel, resolveExteriorClass, runLengthM, createExteriorClassificationTotals, resolveConstructionSystem, EXTERIOR_CONSTRUCTION_SYSTEMS, INTERIOR_CONSTRUCTION_SYSTEMS, CONSTRUCTION_SYSTEM_LABELS, CLADDING_PRODUCTS, CLADDING_PRODUCT_CUSTOM, ROOM_LOCATION_OPTIONS, ROOM_LOCATION_CUSTOM_KEY, resolveOpeningRoom, POST_CORE_TYPES, POST_CORE_TYPE_LABELS, TIMBER_POST_SIZE_OPTIONS, STEEL_SECTION_TYPES, POST_SURROUND_TYPES, POST_SURROUND_TYPE_LABELS, POST_BRICK_FINISH_OPTIONS, resolvePostColumnCore } from './takeoffRunData.js';
import { createJobData, createPortableTakeoffExport, createTakeoffContentChecksum, getEmbeddedPlanPages, getSavedFloorCoveringAreas, getTakeoffCounts, hasRecoverablePlanPages, rememberRecentTakeoffJob, resolvePortableTakeoffImport } from './jobPersistence';
import {
  applyQuotePreviewRows,
  createJobSetupPayload,
  createQuotePreviewRows,
  createTakeoffSchedule,
  exportRowsToCsv,
  exportScheduleToExcelXml,
  flattenScheduleRows,
  getScheduleSignature
} from './takeoffSchedule';

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
const PDFJS_WORKER_SRC = '/pdfjs/pdf.worker.min.mjs';
const PDFJS_INIT_ERROR_MESSAGE = 'The local PDF engine could not start. Your takeoff has not been changed.';
const SAVE_VERIFICATION_FAILED_MESSAGE = 'SAVE FAILED – DO NOT CLOSE THIS TAKEOFF';
const AUTOMATIC_TAKEOFF_SAVE_ENABLED = false;
pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;

const MEASURE_LABEL_FONT_SIZE = 24;
const MEASURE_LABEL_OFFSET = 30;
const EAVE_WIDTH_OPTIONS = ['450', '600', '900', 'Special'];
const EAVE_LEVEL_OPTIONS = ['Ground Floor', 'Second Level', 'Third Level'];
// The Job Setup template carries three level slots. That is its capacity, not a claim about any
// particular building - a two-storey house uses the first two and leaves the third empty.
const SHEET_LEVEL_OPTIONS = ['Ground Floor', 'Second Level', 'Third Level'];
const OPENING_CLASS_OPTIONS = ['Window', 'Internal Door', 'External Door', 'Garage Door', 'Large Glazed/Stacker/Sliding Door', 'Other Opening'];
// Door Type / subtype refines an Opening Class (e.g. Internal Door -> Hinged vs Cavity Sliding vs
// Barn) rather than replacing it. DOOR_SUBTYPE_LABELS (takeoffMaterialQuantities.js) is the single
// source of truth for these values - isCavitySlider/isRobeSlider there match 'Cavity'/'Robe' via a
// substring check, and the Takeoff Schedule's door grouping reads the same labels.
const DOOR_SUBTYPE_OPTIONS = Object.entries(DOOR_SUBTYPE_LABELS);
// Documented on the construction drawing/window schedule, never guessed (e.g. a wet-area window is
// never auto-set to Obscured without drawing/schedule evidence). Unspecified is the honest default.
const GLASS_TYPE_OPTIONS = ['Clear', 'Obscured', 'Translucent', 'Tinted', 'Low-E', 'Laminated', 'Toughened', 'Other', 'Unspecified'];
// A wall/opening saved before this canonical list existed may carry an older synonym ('Standard
// Clear', 'Low E'); map it forward for display without silently rewriting the stored value until
// the builder actually edits it. Any other already-documented but non-canonical text is real
// evidence, not nothing, so it maps to Other rather than the honest-default Unspecified.
function normaliseGlassType(value) {
  if (GLASS_TYPE_OPTIONS.includes(value)) return value;
  if (value === 'Standard Clear') return 'Clear';
  if (value === 'Low E') return 'Low-E';
  return value ? 'Other' : 'Unspecified';
}
const EXTERIOR_WALL_CLASS_OPTIONS = EXTERIOR_WALL_CLASSES;
// Snap tolerance, in SCREEN pixels, for pulling a click onto extracted plan geometry. It is divided
// by stageScale at the point of use to convert it into plan units. This must stay tight: a loose
// tolerance silently drags a click that landed on the corner you aimed at onto some unrelated line
// up to a whole room away, which reads as "the tool refuses to draw where I clicked".
const SNAP_RADIUS_SCREEN_PX = 14;
// One swatch per construction class. Every value in EXTERIOR_WALL_CLASSES needs an entry: the wall
// fill reads this map directly, so a missing class paints an undefined fill onto the plan.
const EXTERIOR_WALL_CLASS_COLOURS = {
  'Face Brick Veneer': 'rgba(178, 34, 34, 0.45)',
  'Rendered Brick Veneer': 'rgba(230, 126, 34, 0.45)',
  'Lightweight Cladding': 'rgba(30, 136, 229, 0.45)',
  'Rendered Masonry': 'rgba(124, 77, 255, 0.45)',
  Other: 'rgba(117, 117, 117, 0.45)'
};

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function sanitizeJobFileName(name) {
  const cleaned = (name || '').trim().replace(/[^a-z0-9-_. ]/gi, '').replace(/\s+/g, '_');
  return cleaned || `takeoff_job_${Date.now()}`;
}

function sanitizeDownloadFileName(name) {
  const cleaned = (name || '').trim().replace(/[^a-z0-9-_. ]/gi, '').replace(/\s+/g, ' ').slice(0, 120);
  return cleaned || `takeoff job ${Date.now()}`;
}

async function storeEmergencyTakeoffSnapshot(snapshot) {
  if (typeof window === 'undefined' || !window.indexedDB) return Promise.resolve(false);
  snapshot = await externalizeTakeoffRecoverySnapshot(snapshot);
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open('gr8-ai-plan-takeoff-recovery-db', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('snapshots')) {
        const store = db.createObjectStore('snapshots', { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    request.onerror = () => reject(request.error || new Error('Unable to open takeoff recovery database'));
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction('snapshots', 'readwrite');
      transaction.oncomplete = () => {
        db.close();
        resolve(true);
      };
      transaction.onerror = () => {
        const error = transaction.error || new Error('Unable to store takeoff recovery snapshot');
        db.close();
        reject(error);
      };
      transaction.objectStore('snapshots').put(snapshot);
    };
  });
}

async function loadLatestEmergencyTakeoffSnapshot() {
  if (typeof window === 'undefined' || !window.indexedDB) return null;
  return new Promise((resolve) => {
    const request = window.indexedDB.open('gr8-ai-plan-takeoff-recovery-db', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('snapshots')) db.createObjectStore('snapshots', { keyPath: 'id' });
    };
    request.onerror = () => resolve([]);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction('snapshots', 'readonly');
      const read = transaction.objectStore('snapshots').openCursor(null, 'prev');
      read.onsuccess = () => resolve(read.result?.value || null);
      read.onerror = () => resolve([]);
      transaction.oncomplete = () => db.close();
      transaction.onerror = () => db.close();
    };
  });
}

function normaliseRecoveredWallRun(run = {}, index = 0) {
  const wallType = String(run.wallType || run.type || run.category || '').toLowerCase();
  const category = run.category || (wallType.includes('external') || wallType.includes('exterior') ? 'exterior' : 'interior');
  return {
    ...run,
    id: run.id || `recovered-wall-${index + 1}`,
    page: Number(run.page || run.pageId || run.sourcePage || 1),
    nodes: Array.isArray(run.nodes) ? run.nodes : (Array.isArray(run.points) ? run.points : []),
    category,
    thicknessMm: Number(run.thicknessMm || run.wallThicknessMm || getDefaultWallThickness(wallType.includes('external') ? 'exterior' : 'interior')),
    alignment: run.alignment || 'outer',
    exteriorType: category === 'exterior' ? resolveExteriorClass(run) : '',
    linedFaces: Number(run.linedFaces || 2) === 1 ? 1 : 2,
    openingDeductionsEnabled: run.openingDeductionsEnabled !== false,
    wallHeightM: Number(run.wallHeightM || run.heightM || 0) || null
  };
}

function normaliseRecoveredOpening(opening = {}, index = 0) {
  const firstPoint = opening.nodes?.[0] || opening.points?.[0] || { x: opening.x, y: opening.y };
  const openingType = String(opening.type || opening.openingType || '').toLowerCase().includes('window') ? 'window' : 'door';
  const label = opening.itemTag || opening.label || `${openingType === 'window' ? 'W' : 'D'}${index + 1}`;
  return {
    ...opening,
    id: opening.id || `recovered-opening-${index + 1}`,
    page: Number(opening.page || opening.pageId || opening.sourcePage || 1),
    x: Number(opening.x ?? firstPoint?.x ?? 0),
    y: Number(opening.y ?? firstPoint?.y ?? 0),
    type: openingType,
    openingType,
    itemTag: label,
    widthMm: Number(opening.widthMm || opening.width || 0),
    heightMm: Number(opening.heightMm || opening.height || 0),
    openingClass: classifyOpeningValue(opening),
    hostWallId: opening.hostWallId || '',
    frameMaterial: opening.frameMaterial || '',
    frameColour: opening.frameColour || '',
    sillType: opening.sillType || '',
    brickSillRequired: Boolean(opening.brickSillRequired),
    location: opening.location || '',
    frameJambDetails: opening.frameJambDetails || ''
  };
}

function normaliseRecoveredFloorplan(floorplan = {}, index = 0) {
  return {
    ...floorplan,
    id: floorplan.id || `recovered-floorplan-${index + 1}`,
    page: Number(floorplan.page || floorplan.pageId || floorplan.sourcePage || 1),
    nodes: Array.isArray(floorplan.nodes) ? floorplan.nodes : (Array.isArray(floorplan.points) ? floorplan.points : []),
    label: floorplan.label || floorplan.roomName || floorplan.type || `Recovered area ${index + 1}`,
    type: floorplan.type || 'Room',
    color: floorplan.color || 'rgba(14, 165, 233, 0.12)',
    stroke: floorplan.stroke || '#0284c7'
  };
}

function normaliseRecoveredPillar(pillar = {}, index = 0) {
  return {
    ...pillar,
    id: pillar.id || `recovered-pillar-${index + 1}`,
    page: Number(pillar.page || pillar.pageId || pillar.sourcePage || 1),
    nodes: Array.isArray(pillar.nodes) ? pillar.nodes : [],
    coreType: pillar.coreType || 'unclassified',
    surroundType: pillar.surroundType || 'none',
    quantity: Number(pillar.quantity) > 0 ? Number(pillar.quantity) : 1,
    roomKey: pillar.roomKey || '',
    roomLabel: pillar.roomLabel || '',
    location: pillar.location || '',
  };
}

function normaliseRecoveredPlanPage(page = {}) {
  const naturalWidth = Number(page.naturalWidth || page.width || page.logicalWidth || 0);
  const naturalHeight = Number(page.naturalHeight || page.height || page.logicalHeight || 0);
  return {
    ...page,
    width: Number(page.width || naturalWidth),
    height: Number(page.height || naturalHeight),
    logicalWidth: Number(page.logicalWidth || naturalWidth),
    logicalHeight: Number(page.logicalHeight || naturalHeight),
    renderScale: Number(page.renderScale || 1)
  };
}

function normaliseRecoveredPlanPages(pages = []) {
  return Array.isArray(pages) ? pages.map(normaliseRecoveredPlanPage) : [];
}

function buildTakeoffContentSnapshot({
  rotation = 0,
  pixelsPerMm = null,
  planPages = [],
  completedWallRuns = [],
  placedOpenings = [],
  completedAreas = [],
  completedFloorplans = [],
  completedMeasurements = [],
  completedEaves = [],
  completedPillars = [],
  sheetLevels = {},
  aiAppliedRuns = [],
  aiAnalysis = null,
}) {
  return {
    rotation,
    pixelsPerMm,
    plan: {
      type: 'embedded-pages',
      totalPages: Array.isArray(planPages) ? planPages.length : 0,
      pages: Array.isArray(planPages) ? planPages : [],
    },
    completedWallRuns: Array.isArray(completedWallRuns) ? completedWallRuns : [],
    placedOpenings: Array.isArray(placedOpenings) ? placedOpenings : [],
    completedAreas: Array.isArray(completedAreas) ? completedAreas : [],
    completedFloorplans: Array.isArray(completedFloorplans) ? completedFloorplans : [],
    completedMeasurements: Array.isArray(completedMeasurements) ? completedMeasurements : [],
    completedEaves: Array.isArray(completedEaves) ? completedEaves : [],
    completedPillars: Array.isArray(completedPillars) ? completedPillars : [],
    sheetLevels: sheetLevels && typeof sheetLevels === 'object' ? sheetLevels : {},
    ...((aiAppliedRuns.length || aiAnalysis) ? { scheduleState: { ...(aiAppliedRuns.length ? { aiAppliedRuns } : {}), ...(aiAnalysis ? { aiAnalysis } : {}) } } : {}),
  };
}

function checksumForTakeoffContent(content = {}) {
  return createTakeoffContentChecksum(buildTakeoffContentSnapshot(content));
}

function classifyOpeningValue(opening = {}) {
  const explicit = String(opening.openingClass || '').trim();
  if (OPENING_CLASS_OPTIONS.includes(explicit)) return explicit;
  const type = String(opening.type || '').toLowerCase();
  const subtype = String(opening.subType || '').toLowerCase();
  if (type === 'window') return 'Window';
  if (subtype.includes('garage') || subtype.includes('panel') || subtype.includes('roller')) return 'Garage Door';
  if (subtype.includes('stacker') || subtype.includes('sliding') || subtype.includes('gsd') || subtype.includes('glazed')) return 'Large Glazed/Stacker/Sliding Door';
  if (subtype.includes('internal')) return 'Internal Door';
  if (type === 'door') return 'External Door';
  return 'Other Opening';
}

function snapToStandardThickness(mm) {
  const standard = [70, 90, 100, 110, 140, 150, 200, 230, 270, 300, 350];
  let closest = standard[0];
  let minDiff = Math.abs(mm - closest);
  for (let i = 1; i < standard.length; i++) {
    const diff = Math.abs(mm - standard[i]);
    if (diff < minDiff) {
      minDiff = diff;
      closest = standard[i];
    }
  }
  return closest;
}

function getDefaultWallThickness(category) {
  return category === 'exterior' ? 230 : 70;
}

function generateOffsetPolygon(nodes, thicknessMm, alignment) {
  if (!nodes || nodes.length < 2) return [];
  const thick = thicknessMm;

  let offsetLeft = 0;
  let offsetRight = 0;
  if (alignment === 'outer') {
    offsetLeft = 0;
    offsetRight = thick;
  } else {
    offsetLeft = -thick;
    offsetRight = 0;
  }

  const leftSegs = [];
  const rightSegs = [];

  for (let i = 0; i < nodes.length - 1; i++) {
    const p1 = nodes[i];
    const p2 = nodes[i + 1];

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) continue;

    const nx = -dy / len;
    const ny = dx / len;

    leftSegs.push({
      p1: { x: p1.x + nx * offsetLeft, y: p1.y + ny * offsetLeft },
      p2: { x: p2.x + nx * offsetLeft, y: p2.y + ny * offsetLeft }
    });

    rightSegs.push({
      p1: { x: p1.x + nx * offsetRight, y: p1.y + ny * offsetRight },
      p2: { x: p2.x + nx * offsetRight, y: p2.y + ny * offsetRight }
    });
  }

  if (leftSegs.length === 0) return [];

  const getLineIntersection = (s1, s2) => {
    if (!s1 || !s2) return null;
    const x1 = s1.p1.x, y1 = s1.p1.y, x2 = s1.p2.x, y2 = s1.p2.y;
    const x3 = s2.p1.x, y3 = s2.p1.y, x4 = s2.p2.x, y4 = s2.p2.y;

    const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
    if (Math.abs(denom) < 1e-5) return null;

    const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
    return {
      x: x1 + ua * (x2 - x1),
      y: y1 + ua * (y2 - y1)
    };
  };

  const mitredLeft = [];
  mitredLeft.push(leftSegs[0].p1);
  for (let i = 0; i < leftSegs.length - 1; i++) {
    const intersection = getLineIntersection(leftSegs[i], leftSegs[i + 1]);
    if (intersection) {
      mitredLeft.push(intersection);
    } else {
      mitredLeft.push(leftSegs[i].p2);
    }
  }
  mitredLeft.push(leftSegs[leftSegs.length - 1].p2);

  const mitredRight = [];
  mitredRight.push(rightSegs[0].p1);
  for (let i = 0; i < rightSegs.length - 1; i++) {
    const intersection = getLineIntersection(rightSegs[i], rightSegs[i + 1]);
    if (intersection) {
      mitredRight.push(intersection);
    } else {
      mitredRight.push(rightSegs[i].p2);
    }
  }
  mitredRight.push(rightSegs[rightSegs.length - 1].p2);

  const polygonPoints = [];
  mitredLeft.forEach(pt => polygonPoints.push(pt));
  for (let i = mitredRight.length - 1; i >= 0; i--) {
    polygonPoints.push(mitredRight[i]);
  }

  return polygonPoints;
}

export default function AIPlanTakeoffStandalone({
  embedded = false,
  platformContext = {},
  initialJob = null,
  initialQuoteRows = null,
  onSaveToPlatform = null,
  onMasterTakeoffChange = null,
  onLinkLegacyTakeoff = null,
  onOpenMasterJob = null,
  onNewMasterJob = null,
  onJobSetupUpdate = null,
  onQuoteSheetUpdate = null,
  onBackToDashboard = null,
  openTakeoffJobRequest = null,
  onTakeoffWorkflowChange = null,
  onRecentTakeoffJobsChange = null,
  onAttachToProject = null,
  enableAiTakeoffDevelopment = false
}) {
  const initialProjectInfo = {
    projectName: platformContext.projectName || '',
    clientName: platformContext.clientName || '',
    siteAddress: platformContext.siteAddress || platformContext.projectAddress || '',
    storeyOrLevelName: platformContext.storeyOrLevelName || ''
  };
  const [image, setImage] = useState(null);
  const [rotation, setRotation] = useState(0);
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [jobName, setJobName] = useState('');
  const [jobFileHandle, setJobFileHandle] = useState(null);
  const [planPages, setPlanPages] = useState([]);
  const [planFilename, setPlanFilename] = useState(platformContext.fileName || '');
  const [planMissingFromSavedJob, setPlanMissingFromSavedJob] = useState(false);
  // A plan that cannot be restored must say so. A blank canvas is indistinguishable from a job
  // that genuinely has no plan, and it hides the asset id needed to diagnose the failure.
  const [planLoadError, setPlanLoadError] = useState(null);
  const [savedRevision, setSavedRevision] = useState(Number(initialJob?.revision || 0));
  const [lastSuccessfulSaveAt, setLastSuccessfulSaveAt] = useState(initialJob?.updatedAt || '');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [importedTakeoffFileName, setImportedTakeoffFileName] = useState(initialJob?.sourceFileName || '');
  const [attachDialogOpen, setAttachDialogOpen] = useState(false);
  const [attachProjectName, setAttachProjectName] = useState('Johnson 123');
  const [attachSaving, setAttachSaving] = useState(false);
  const [attachError, setAttachError] = useState('');
  const suppressUnsavedChangeRef = useRef(true);
  const [autosaveRequest, setAutosaveRequest] = useState(null);
  const masterTakeoffChangeRef = useRef(onMasterTakeoffChange);
  masterTakeoffChangeRef.current = onMasterTakeoffChange;
  const [projectInfo, setProjectInfo] = useState(initialProjectInfo);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleMappings, setScheduleMappings] = useState({});
  const [quoteSheetRows, setQuoteSheetRows] = useState(initialQuoteRows || [
    { id: 'quote_floor_total_living', category: 'Total living area', description: 'Total living area', quantity: 0, unit: 'm2', rate: 0, formula: '=quantity*rate' },
    { id: 'quote_external_walls', category: 'External walls', description: 'External wall length', quantity: 0, unit: 'lm', rate: 0, formula: '=quantity*rate' },
    { id: 'quote_internal_walls', category: 'Internal walls', description: 'Internal wall length', quantity: 0, unit: 'lm', rate: 0, formula: '=quantity*rate' },
    { id: 'quote_tiles', category: 'Tiles', description: 'Floor tiles', quantity: 0, unit: 'm2', rate: 0, formula: '=quantity*rate' },
    { id: 'quote_carpets', category: 'Carpets', description: 'Carpet flooring', quantity: 0, unit: 'm2', rate: 0, formula: '=quantity*rate' },
    { id: 'quote_hybrid', category: 'Hybrid', description: 'Hybrid flooring', quantity: 0, unit: 'm2', rate: 0, formula: '=quantity*rate' },
    { id: 'quote_eaves', category: 'Eaves area', description: 'Eaves area', quantity: 0, unit: 'm2', rate: 0, formula: '=quantity*rate' }
  ]);
  const [quotePreviewRows, setQuotePreviewRows] = useState([]);
  const [jobSetupPayload, setJobSetupPayload] = useState(null);
  const [lastQuoteSyncSignature, setLastQuoteSyncSignature] = useState('');
  const [platformSaveMessage, setPlatformSaveMessage] = useState('');
  const [pdfEngineError, setPdfEngineError] = useState('');
  const [openedTakeoffJob, setOpenedTakeoffJob] = useState(null);
  const [recoveryPreviewMode, setRecoveryPreviewMode] = useState(false);
  const [recoveryPreviewCounts, setRecoveryPreviewCounts] = useState(null);
  const isRecoveryPreview = Boolean(recoveryPreviewMode);

  const [pdfDoc, setPdfDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [vectorSegments, setVectorSegments] = useState([]);
  // Which building level each plan sheet represents, keyed by sheet number. Job Setup's wall and
  // area fields are all per level, so a measurement whose sheet has no level assigned has nowhere
  // to import to. A sheet's position in the PDF cannot stand in for this - sheet 3 of a two-storey
  // set is not a third level - so it is always the estimator's explicit call.
  const [sheetLevels, setSheetLevels] = useState({});
  const [calibrationMode, setCalibrationMode] = useState(false);
  const [calibPoints, setCalibPoints] = useState([]);
  const [pixelsPerMm, setPixelsPerMm] = useState(null);

  const [activeTool, setActiveTool] = useState('wall'); // 'wall', 'opening', 'floorplan', 'floorcoverings', 'roofarea', 'measure', 'eaves', 'select'

  const [wallCategory, setWallCategory] = useState('exterior');
  // The construction an exterior wall is drawn as, chosen before the first point rather than
  // corrected afterwards. It is stamped onto each run at finalisation, so changing it here never
  // touches a wall that has already been drawn, and it persists across category switches so
  // returning to Exterior Wall keeps the last construction the estimator picked.
  const [exteriorWallType, setExteriorWallType] = useState('Other');
  const [detectedWallThicknessMm, setDetectedWallThicknessMm] = useState(230);
  // Auto-detection measures the gap between parallel plan lines and writes the result straight into
  // detectedWallThicknessMm, which is the same value the Wall Thickness box shows. Left unguarded it
  // silently overwrites a thickness the estimator typed - you set 230 for brick veneer, click a
  // corner, and the run is finalised at whatever the plan lines happened to measure. Typing a
  // thickness turns detection off until it is switched back on.
  const [autoDetectWallThickness_Enabled, setAutoDetectWallThicknessEnabled] = useState(true);
  const [alignment, setAlignment] = useState('outer');
  const [activePolyline, setActivePolyline] = useState([]);
  const [completedWallRuns, setCompletedWallRuns] = useState([]);
  const [selectedWallId, setSelectedWallId] = useState(null);

  // Opening state
  const [openingHeightMm, setOpeningHeightMm] = useState(1800);
  const [openingWidthMm, setOpeningWidthMm] = useState(1200);
  const [sizeCodeInput, setSizeCodeInput] = useState('1812');
  const [openingType, setOpeningType] = useState('window'); 
  const [windowSubtype, setWindowSubtype] = useState('standard'); 
  const [doorSubtype, setDoorSubtype] = useState('Entry'); 
  const [openingClass, setOpeningClass] = useState('Window');
  const [glassType, setGlassType] = useState('Clear');
  const [placedOpenings, setPlacedOpenings] = useState([]);
  const [selectedOpeningId, setSelectedOpeningId] = useState(null);
  const [selectedMeasurementId, setSelectedMeasurementId] = useState(null);

  // Area & Floorcoverings state
  const [floorcoveringOption, setFloorcoveringOption] = useState('Tiles');
  const [areaDrawMode, setAreaDrawMode] = useState('polygon');
  const [activeAreaPolyline, setActiveAreaPolyline] = useState([]);
  const [boxStartPoint, setBoxStartPoint] = useState(null);
  const [completedAreas, setCompletedAreas] = useState([]);
  const [selectedAreaId, setSelectedAreaId] = useState(null);
  const [selectedAreaForExclusion, setSelectedAreaForExclusion] = useState(null);
  const [roofAreaLevel, setRoofAreaLevel] = useState('Ground Floor');

  // Floorplan state & Editing state
  const [floorplanType, setFloorplanType] = useState('Footprint'); 
  const [completedFloorplans, setCompletedFloorplans] = useState([]);
  const [selectedFloorplanId, setSelectedFloorplanId] = useState(null);

  // General Vertex Dragging State for Edit/Select Mode
  const [draggingVertex, setDraggingVertex] = useState(null); // { type: 'floorplan'|'area'|'wall', id, vertexIndex }
  const [draggingItem, setDraggingItem] = useState(null); // { type: 'opening', id }

  // Measure Tool State
  const [measurePoints, setMeasurePoints] = useState([]);
  const [completedMeasurements, setCompletedMeasurements] = useState([]);
  const [draggingMeasureId, setDraggingMeasureId] = useState(null);

  // Eaves Tool State
  const [eavePoints, setEavePoints] = useState([]);
  const [completedEaves, setCompletedEaves] = useState([]);
  const [draggingEaveId, setDraggingEaveId] = useState(null);
  const [selectedEaveId, setSelectedEaveId] = useState(null);
  const [eaveWidthOption, setEaveWidthOption] = useState('600');
  const [specialEaveWidthMm, setSpecialEaveWidthMm] = useState(750);
  const [eaveLevel, setEaveLevel] = useState('Ground Floor');
  const [eaveAlignment, setEaveAlignment] = useState('outer');

  // Pillars, Posts & Columns - a discrete vertical structural/architectural object, never a wall.
  // Footprint is drawn the same click-click box way as the floorcoverings box mode (boxStartPoint
  // is shared - the two tools are never active at once, so reusing it adds no ambiguity).
  const [completedPillars, setCompletedPillars] = useState([]);
  const [selectedPillarId, setSelectedPillarId] = useState(null);

  // Exactly one of these seven ids should ever be set at a time: the Delete-key
  // handler picks the first truthy one in a fixed priority order, so a stale
  // higher-priority id left over from an earlier selection can otherwise steal
  // a later delete/edit intended for whatever was actually just clicked.
  const selectOnly = (type, id) => {
    setSelectedWallId(type === 'wall' ? id : null);
    setSelectedAreaId(type === 'area' ? id : null);
    setSelectedOpeningId(type === 'opening' ? id : null);
    setSelectedFloorplanId(type === 'floorplan' ? id : null);
    setSelectedMeasurementId(type === 'measure' ? id : null);
    setSelectedEaveId(type === 'eaves' ? id : null);
    setSelectedPillarId(type === 'pillar' ? id : null);
  };

  const [mouseHoverPos, setMouseHoverPos] = useState(null);

  const stageRef = useRef(null);
  const layerRef = useRef(null);
  const canvasHostRef = useRef(null);
  const rawCanvasRef = useRef(document.createElement('canvas'));

  // Effect cleanup also runs during Fast Refresh/Strict Mode replay. Release
  // resources only if the same mounted instance does not immediately reattach.
  useEffect(() => {
    const attachment = ++takeoffLifecycle.attachment;
    logTakeoffRefresh('component-effect-setup', { attachment });
    return () => {
      logTakeoffRefresh('component-effect-cleanup', { attachment });
      queueMicrotask(() => {
        if (takeoffLifecycle.attachment !== attachment) return;
        takeoffLifecycle.imageRequest = null;
        takeoffLifecycle.hydrationVersion += 1;
        logTakeoffRefresh('component-detached');
        const canvas = rawCanvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
          canvas.width = 0;
          canvas.height = 0;
        }
        // Release object URLs from dataUrl strings to prevent memory leaks
        if (Array.isArray(planPages)) {
          planPages.forEach((page) => {
            if (page?.dataUrl && page.dataUrl.startsWith('blob:')) {
              try {
                revokeTakeoffObjectUrl(page.dataUrl, 'plan-unmount', logTakeoffRefresh);
              } catch (e) {
                // Ignore errors from already-revoked URLs
              }
            }
          });
        }
      });
    };
  }, []);
  const renderTaskRef = useRef(null);
  const loadedInitialJobRef = useRef(false);
  const takeoffLifecycle = getTakeoffLifecycle(loadedInitialJobRef, {
    pages: planPages, pageNumber: currentPage, pdfDoc, image,
    openRequest: openTakeoffJobRequest, openedTakeoffId: openedTakeoffJob?.takeoffId,
  });
  const { displayedPlanRef, handledOpenTakeoffRequestRef, log: logTakeoffRefresh } = takeoffLifecycle;
  const sheetViewStateRef = useRef({});
  const fittedSheetViewKeyRef = useRef('');
  const autosaveInFlightRef = useRef(false);
  const autosaveTimerRef = useRef(null);
  const autosaveIdleRef = useRef(null);
  const queuedAutosaveChecksumRef = useRef('');
  const lastSavedContentChecksumRef = useRef('');
  const lastSeenContentChecksumRef = useRef('');
  const pendingLoadedContentChecksumRef = useRef('');
  const suppressAutosaveFromLoadRef = useRef(true);
  const latestBuildJobDataRef = useRef(null);
  const latestAutosaveBasisRef = useRef({
    checksum: '',
    reason: '',
    editVersion: 0,
    requestedAt: 0,
  });
  const contentEditVersionRef = useRef(0);
  const lastSavedEditVersionRef = useRef(0);
  const redundantAutosaveCountRef = useRef(0);
  const manualSaveInFlightRef = useRef(false);
  const pointerEditInProgressRef = useRef(false);
  const pendingDragChecksumRef = useRef('');
  const stageContentPanRef = useRef(null);
  const suppressNextStageClickRef = useRef(false);
  const mouseHoverFrameRef = useRef(null);
  const pendingMouseHoverRef = useRef(null);
  const canvasViewLockedRef = useRef(false);
  const pendingCanvasResizeRef = useRef(false);
  const updateCanvasSizeRef = useRef(null);
  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 800 });

  const markTakeoffItemCompleted = useCallback((reason = 'item-completed') => {
    if (isRecoveryPreview) return;
    setHasUnsavedChanges(true);
    latestAutosaveBasisRef.current = {
      ...latestAutosaveBasisRef.current,
      reason,
    };
  }, [isRecoveryPreview]);

  const aiTakeoffBridge = useAiTakeoffBridge({
    jobId: String((openedTakeoffJob?.detached ? '' : (platformContext.jobId || openedTakeoffJob?.masterJobId || openedTakeoffJob?.associatedProjectId || platformContext.projectId)) || openedTakeoffJob?.takeoffId || ''),
    takeoffId: String(openedTakeoffJob?.takeoffId || ''),
    planPages, pixelsPerMm, lifecycle: takeoffLifecycle, readOnly: isRecoveryPreview,
    collections: { completedWallRuns, placedOpenings, completedFloorplans, completedAreas, completedMeasurements, completedEaves, completedPillars },
    setters: {
      completedWallRuns: setCompletedWallRuns, placedOpenings: setPlacedOpenings,
      completedFloorplans: setCompletedFloorplans, completedAreas: setCompletedAreas,
      completedMeasurements: setCompletedMeasurements, completedEaves: setCompletedEaves,
      completedPillars: setCompletedPillars,
    },
    markCompleted: markTakeoffItemCompleted,
  });

  const aiTakeoffAnalysis = useAiTakeoffAnalysis({
    jobId: String((openedTakeoffJob?.detached ? '' : (platformContext.jobId || openedTakeoffJob?.masterJobId || openedTakeoffJob?.associatedProjectId || platformContext.projectId)) || openedTakeoffJob?.takeoffId || ''),
    takeoffId: String(openedTakeoffJob?.takeoffId || ''),
    planPages, pixelsPerMm, lifecycle: takeoffLifecycle, readOnly: isRecoveryPreview,
    bridge: aiTakeoffBridge, setPixelsPerMm, markCompleted: markTakeoffItemCompleted,
    completedFloorplans,
    sheetLevels,
    // Construction defaults already entered in Job Setup resolve what the plans leave unstated.
    jobSetupRows: platformContext.jobSetupRows || {},
    // Reading rooms is a user-requested operation; save it the same way an analysis is saved.
    onRoomsRead: async () => { if (embedded && onSaveToPlatform && platformContext.jobId) await handleSaveJob(); },
    objectCount: completedWallRuns.length + placedOpenings.length + completedFloorplans.length + completedAreas.length + completedMeasurements.length + completedEaves.length + completedPillars.length,
    onDetectedLevels: (pages) => setSheetLevels((previous) => {
      const next = { ...previous };
      for (const { page, level } of pages) {
        if ((!next[page] || next[page] === 'Unassigned') && ['Ground Floor', 'Second Level', 'Third Level'].includes(level)) next[page] = level;
      }
      return next;
    }),
    onCompleted: async () => {
      setShowSchedule(true);
      // Analysis is a user-requested operation. Save through the same verified
      // master-job action used by Save Takeoff, after the hook commits results.
      if (embedded && onSaveToPlatform && platformContext.jobId) await handleSaveJob();
    },
  });

  const takeoffContentChecksum = useMemo(() => checksumForTakeoffContent({
    rotation,
    pixelsPerMm,
    planPages,
    completedWallRuns,
    placedOpenings,
    completedAreas,
    completedFloorplans,
    completedMeasurements,
    completedEaves,
    completedPillars,
    sheetLevels,
    aiAppliedRuns: aiTakeoffBridge.appliedRuns,
    aiAnalysis: aiTakeoffAnalysis.report,
  }), [rotation, pixelsPerMm, planPages, completedWallRuns, placedOpenings, completedAreas, completedFloorplans, completedMeasurements, completedEaves, completedPillars, sheetLevels, aiTakeoffBridge.appliedRuns, aiTakeoffAnalysis.report]);

  const FLOORCOVERING_CONFIGS = {
    'Tiles': { fill: 'rgba(76, 175, 80, 0.35)', stroke: '#2e7d32', text: '#1b5e20' },
    'Hybrid': { fill: 'rgba(33, 150, 243, 0.35)', stroke: '#1565c0', text: '#0d47a1' },
    'Carpets': { fill: 'rgba(255, 214, 0, 0.42)', stroke: '#f9a825', text: '#8a5a00' },
    'Polished Concrete': { fill: 'rgba(255, 152, 0, 0.35)', stroke: '#ef6c00', text: '#e65100' },
    'exposed Agg': { fill: 'rgba(233, 30, 99, 0.35)', stroke: '#c2185b', text: '#880e4f' }
  };

  const FLOORCOVERING_OPTIONS = Object.keys(FLOORCOVERING_CONFIGS);

  const FLOORPLAN_TYPES = [
    { id: 'Footprint', label: 'Outer Footprint', color: 'rgba(33, 150, 243, 0.25)', stroke: '#1565c0' },
    { id: 'Living', label: 'Living Area', color: 'rgba(76, 175, 80, 0.3)', stroke: '#2e7d32' },
    { id: 'Garage', label: 'Garage', color: 'rgba(158, 158, 158, 0.35)', stroke: '#616161' },
    { id: 'Alfresco', label: 'Alfresco', color: 'rgba(255, 152, 0, 0.3)', stroke: '#ef6c00' },
    { id: 'Patio', label: 'Patio', color: 'rgba(233, 30, 99, 0.25)', stroke: '#c2185b' },
    { id: 'Balcony', label: 'Balcony', color: 'rgba(0, 188, 212, 0.25)', stroke: '#00838f' },
    { id: 'Other', label: 'Other Non-Living', color: 'rgba(121, 85, 72, 0.28)', stroke: '#5d4037' }
  ];

  useEffect(() => {
    const updateCanvasSize = () => {
      if (canvasViewLockedRef.current) {
        pendingCanvasResizeRef.current = true;
        return;
      }
      const rect = canvasHostRef.current?.getBoundingClientRect?.();
      const nextSize = {
        width: Math.max(640, Math.floor(rect?.width || (typeof window !== 'undefined' ? window.innerWidth - 420 : 1200))),
        height: Math.max(480, Math.floor(rect?.height || (typeof window !== 'undefined' ? window.innerHeight : 800)))
      };
      setCanvasSize((current) => {
        if (current.width === nextSize.width && current.height === nextSize.height) return current;
        return nextSize;
      });
    };
    updateCanvasSizeRef.current = updateCanvasSize;
    updateCanvasSize();
    if (typeof ResizeObserver !== 'undefined' && canvasHostRef.current) {
      const observer = new ResizeObserver(updateCanvasSize);
      observer.observe(canvasHostRef.current);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, []);

  useEffect(() => {
    const locked = Boolean(
      activePolyline.length
      || activeAreaPolyline.length
      || measurePoints.length
      || eavePoints.length
      || draggingVertex
      || draggingItem
      || draggingMeasureId
      || draggingEaveId
      || stageContentPanRef.current?.active
    );
    const wasLocked = canvasViewLockedRef.current;
    canvasViewLockedRef.current = locked;
    if (wasLocked && !locked && pendingCanvasResizeRef.current) {
      pendingCanvasResizeRef.current = false;
      window.requestAnimationFrame(() => updateCanvasSizeRef.current?.());
    }
  }, [activePolyline.length, activeAreaPolyline.length, measurePoints.length, eavePoints.length, draggingVertex, draggingItem, draggingMeasureId, draggingEaveId]);

  // Save / Load Job functionality
  const buildJobData = (name) => {
    const jobData = createJobData({
      name,
      currentPage,
      totalPages,
      rotation,
      pixelsPerMm,
      planPages,
      completedWallRuns,
      placedOpenings,
      completedAreas,
      completedFloorplans,
      completedMeasurements,
      completedEaves,
      completedPillars,
      sheetLevels,
      projectInfo,
      planFilename,
      sourceFileName: importedTakeoffFileName || planFilename || '',
      takeoffId: openedTakeoffJob?.takeoffId || '',
      associatedProjectId: openedTakeoffJob?.detached ? '' : (openedTakeoffJob?.associatedProjectId || platformContext.projectId || ''),
      associatedProjectName: openedTakeoffJob?.detached ? '' : (openedTakeoffJob?.associatedProjectName || platformContext.projectName || ''),
      openedWithoutAttaching: Boolean(openedTakeoffJob?.detached),
      revision: savedRevision,
      baseRevision: savedRevision,
      platformProject: openedTakeoffJob?.detached ? {} : {
        projectId: platformContext.projectId || '',
        projectName: platformContext.projectName || '',
        jobNumber: platformContext.jobNumber || '',
        builder: platformContext.builder || '',
        workspaceId: platformContext.workspaceId || '',
        organisationId: platformContext.organisationId || ''
      },
      scheduleState: {
        aiAppliedRuns: aiTakeoffBridge.appliedRuns,
        aiAnalysis: aiTakeoffAnalysis.report,
        aiInspections: aiTakeoffAnalysis.inspections,
        sheetCalibrations: aiTakeoffAnalysis.sheetCalibrations,
        scheduleMappings,
        quoteSheetRows,
        quotePreviewRows,
        jobSetupPayload,
        lastQuoteSyncSignature
      }
    });
    const contentChecksum = checksumForTakeoffContent({
      rotation,
      pixelsPerMm,
      planPages,
      completedWallRuns,
      placedOpenings,
      completedAreas,
      completedFloorplans,
      completedMeasurements,
      completedEaves,
      completedPillars,
      sheetLevels,
      aiAppliedRuns: aiTakeoffBridge.appliedRuns,
      aiAnalysis: aiTakeoffAnalysis.report,
    });
    return {
      ...jobData,
      ...(platformContext.jobId ? { jobId: platformContext.jobId, masterJobId: platformContext.jobId } : {}),
      contentChecksum,
      takeoffCounts: getTakeoffCounts(jobData),
    };
  };

  useEffect(() => {
    latestBuildJobDataRef.current = buildJobData;
  });

  // Build the complete, self-contained payload for a manually saved file.
  //
  // A job held in memory can still describe its plan pages by asset id, and those ids only mean
  // something in this browser profile's asset store. A file written from them would reopen blank on
  // any other computer, so the images are materialized into the payload before anything is written.
  // Verification runs here too: nothing is reported as saved unless the bytes about to be written
  // would actually reopen.
  const buildPortableTakeoffPayload = async (name) => {
    const jobData = buildJobData(name);
    const workbook = await materializeTakeoffPlanPages({ aiPlanTakeoffJob: jobData });
    const materialised = workbook?.aiPlanTakeoffJob || jobData;
    const portable = createPortableTakeoffExport(materialised, {
      projectId: attachedProjectId || '',
      projectName: attachedProjectName || '',
      takeoffName: name,
      sourceFileName: importedTakeoffFileName || planFilename || '',
    });
    const verified = resolvePortableTakeoffImport(portable);
    if (!verified.ok) {
      throw new Error(`The takeoff file was not written because it could not be verified: ${verified.message}`);
    }
    return { portable, json: JSON.stringify(portable, null, 2) };
  };

  // A handle kept from an earlier open or save is only usable while the browser still grants write
  // permission; it can lapse between sessions. Returning null sends the caller to the picker.
  const ensureWritableFileHandle = async (handle) => {
    if (!handle || typeof handle.createWritable !== 'function') return null;
    try {
      if (typeof handle.queryPermission === 'function') {
        let permission = await handle.queryPermission({ mode: 'readwrite' });
        if (permission === 'prompt' && typeof handle.requestPermission === 'function') {
          permission = await handle.requestPermission({ mode: 'readwrite' });
        }
        if (permission !== 'granted') return null;
      }
      return handle;
    } catch (error) {
      logTakeoffRefresh('local-file-permission-unavailable', { message: error?.message || String(error) });
      return null;
    }
  };

  const writeTakeoffFileToHandle = async (handle, json) => {
    const writable = await handle.createWritable();
    try {
      await writable.write(json);
    } catch (error) {
      await writable.abort?.();
      throw error;
    }
    await writable.close();
  };

  const downloadPortableTakeoffJson = (name, json) => {
    const filename = `${sanitizeDownloadFileName(name)}${AI_PLAN_TAKEOFF_EXTENSION}`;
    const blob = new Blob([json], { type: 'application/json' });
    const url = createTakeoffObjectUrl(blob, 'takeoff-save', logTakeoffRefresh);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.setTimeout(() => revokeTakeoffObjectUrl(url, 'takeoff-save', logTakeoffRefresh), 5000);
    return filename;
  };

  // Save the takeoff to a file on the user's own computer. The browser still owns the permission
  // decision: the location can only ever come from the native picker or from a handle the user
  // already approved, so this can never write somewhere the user did not choose.
  //
  // Returns 'saved' (written to a chosen location), 'downloaded' (no File System Access API, so the
  // browser's download folder took it) or 'cancelled'. Cancellation is not a failure and must never
  // be reported as a save.
  const saveTakeoffToComputer = async (name, { handle = null } = {}) => {
    const { json } = await buildPortableTakeoffPayload(name);
    const reusable = await ensureWritableFileHandle(handle);
    if (reusable) {
      await writeTakeoffFileToHandle(reusable, json);
      return { status: 'saved', handle: reusable, fileName: reusable.name || `${sanitizeDownloadFileName(name)}${AI_PLAN_TAKEOFF_EXTENSION}`, bytes: json.length };
    }
    if (typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function') {
      let picked;
      try {
        picked = await window.showSaveFilePicker({
          suggestedName: `${sanitizeDownloadFileName(name)}${AI_PLAN_TAKEOFF_EXTENSION}`,
          types: [{
            description: AI_PLAN_TAKEOFF_FILE_DESCRIPTION,
            accept: { 'application/json': [AI_PLAN_TAKEOFF_EXTENSION] },
          }],
        });
      } catch (error) {
        if (error?.name === 'AbortError') return { status: 'cancelled' };
        throw error;
      }
      await writeTakeoffFileToHandle(picked, json);
      return { status: 'saved', handle: picked, fileName: picked.name || `${sanitizeDownloadFileName(name)}${AI_PLAN_TAKEOFF_EXTENSION}`, bytes: json.length };
    }
    const fileName = downloadPortableTakeoffJson(name, json);
    return { status: 'downloaded', handle: null, fileName, bytes: json.length };
  };

  // Only called once bytes have actually reached the file.
  const applyLocalSaveResult = (result, name) => {
    setJobFileHandle(result.handle || null);
    setJobName(name);
    if (result.fileName) setImportedTakeoffFileName(result.fileName);
    setHasUnsavedChanges(false);
    setLastSuccessfulSaveAt(new Date().toISOString());
    stampSavedContentBaseline({ contentChecksum: takeoffContentChecksum });
    setPlatformSaveMessage(result.status === 'downloaded'
      ? `${result.fileName} was downloaded by the browser. This browser cannot offer a folder picker, so it went to your downloads folder.`
      : `Saved to ${result.fileName} on this computer.`);
  };

  const showPlanPage = useCallback(async (pages, pageNumber) => {
    const page = pages.find((p) => p.pageNumber === pageNumber) || pages[pageNumber - 1];
    return loadTakeoffPlanImage(takeoffLifecycle, page, pageNumber, loadImageFromDataUrl, (img, segments) => {
      setImage(img);
      setVectorSegments(segments);
    });
  }, []);

  // Restore a saved job's plan images before any of it reaches component state.
  //
  // Saved jobs keep their plan pages in the browser asset store and carry only a dataUrlAssetId, so
  // a job opened without this step arrives with page metadata but no image: overlays, sheet count
  // and page number all restore correctly and the canvas renders blank. Materializing here, before
  // loadJobData touches state, also means a failed read leaves the current workspace intact.
  const restorePlanAssets = async (job, source) => {
    const references = describePlanPageReferences(getEmbeddedPlanPages(job));
    logTakeoffPlanLoad('open-job', {
      source,
      takeoffId: job?.takeoffId || job?.id || null,
      jobName: job?.takeoffName || job?.jobName || null,
      planPageCount: references.length,
      assetIds: references.map((page) => page.assetId),
      embeddedImages: references.filter((page) => page.hasEmbeddedImage).length,
    });
    if (!references.length) return job;
    // Pages that already carry their own image need no asset read; this is how a job file carried
    // from another machine opens without reaching for asset ids this profile has never held.
    if (references.every((page) => page.hasEmbeddedImage)) {
      logTakeoffPlanLoad('assets-already-embedded', { source, planPageCount: references.length });
      return job;
    }
    const pending = references.filter((page) => !page.hasEmbeddedImage).map((page) => page.assetId);
    logTakeoffPlanLoad('asset-read-start', { source, assetIds: pending });
    let restored;
    try {
      const workbook = await materializeTakeoffPlanPages({ aiPlanTakeoffJob: job });
      restored = workbook?.aiPlanTakeoffJob || job;
    } catch (error) {
      logTakeoffPlanLoad('asset-read-failed', { source, assetIds: pending, message: error?.message || String(error) });
      throw new Error(`Plan images could not be read from browser storage: ${error?.message || error}`);
    }
    const materialized = describePlanPageReferences(getEmbeddedPlanPages(restored));
    logTakeoffPlanLoad('asset-read-end', {
      source,
      materializedPages: materialized.filter((page) => page.hasEmbeddedImage).length,
      planPageCount: materialized.length,
    });
    const stillMissing = materialized.filter((page) => !page.hasEmbeddedImage);
    if (stillMissing.length) {
      const ids = stillMissing.map((page) => page.assetId || `sheet ${page.pageNumber}`);
      logTakeoffPlanLoad('asset-missing', { source, assetIds: ids });
      throw new Error(`Plan image missing from browser storage for ${ids.join(', ')}. The saved job was not changed.`);
    }
    await decodeRestoredPlanPage(restored, source);
    return restored;
  };

  // Decode the sheet the job will open on before any state is replaced. A restored asset can still
  // be an undecodable image, and finding that out inside loadJobData would leave the workspace half
  // swapped: the previous plan gone and the new one unrenderable.
  const decodeRestoredPlanPage = async (job, source) => {
    const pages = getEmbeddedPlanPages(job);
    if (!pages.length) return;
    const savedPage = Number(job?.currentPage || 1);
    const page = pages.find((item) => item.pageNumber === savedPage) || pages[savedPage - 1] || pages[0];
    if (!page?.dataUrl) return;
    const pageNumber = page.pageNumber ?? savedPage;
    logTakeoffPlanLoad('image-decode-start', { source, page: pageNumber });
    try {
      await loadImageFromDataUrl(page.dataUrl);
      logTakeoffPlanLoad('image-decode-end', { source, page: pageNumber });
    } catch (error) {
      logTakeoffPlanLoad('image-decode-failed', { source, page: pageNumber, assetId: page.dataUrlAssetId || null });
      throw new Error(`The plan image for sheet ${pageNumber} could not be decoded; the stored image appears to be damaged. The saved job was not changed.`);
    }
  };

  // One entry point for every open route, so a route can never be added that skips the asset read.
  const openTakeoffJob = async (job, fallbackName, source) => {
    const hydrationVersion = takeoffLifecycle.hydrationVersion;
    const restored = await restorePlanAssets(job, source);
    // A newer open that started while this one was reading assets owns the workspace now.
    if (hydrationVersion !== takeoffLifecycle.hydrationVersion) {
      logTakeoffPlanLoad('open-superseded', { source, takeoffId: job?.takeoffId || null });
      return;
    }
    setPlanLoadError(null);
    await loadJobData(restored, fallbackName);
  };

  const reportPlanLoadFailure = (error, source, job) => {
    const message = error?.message || String(error);
    logTakeoffPlanLoad('open-failed', { source, takeoffId: job?.takeoffId || null, message });
    console.error('TAKEOFF_PLAN_LOAD open failed:', message);
    setPlanLoadError({ source, message, jobName: job?.takeoffName || job?.jobName || '' });
  };

  const loadJobData = async (data, fallbackName = '') => {
    const imported = resolvePortableTakeoffImport(data);
    const takeoffJobData = imported.ok ? imported.job : data;
    const embeddedPages = normaliseRecoveredPlanPages(getEmbeddedPlanPages(takeoffJobData));
    const isRecoveryPreviewJob = Boolean(takeoffJobData.recoveryPreviewMode);
    if (embedded && onMasterTakeoffChange && !isRecoveryPreviewJob &&
      (!platformContext.jobId || takeoffJobData.masterJobId !== platformContext.jobId)) {
      throw new Error('Open the owning master job, or import this legacy takeoff into the current job.');
    }
    const hydrationVersion = ++takeoffLifecycle.hydrationVersion;
    takeoffLifecycle.imageRequest = null;
    logTakeoffRefresh('job-hydration-start', {
      hydrationVersion, page: takeoffJobData.currentPage || 1,
      activeEavePoints: eavePoints.length, completedEaves: completedEaves.length,
    });

    sheetViewStateRef.current = {};
    fittedSheetViewKeyRef.current = '';
    setPdfDoc(null);
    setPlanPages(embeddedPages);
    setCompletedWallRuns((takeoffJobData.completedWallRuns || []).map(normaliseRecoveredWallRun));
    setPlacedOpenings((takeoffJobData.placedOpenings || []).map(normaliseRecoveredOpening));
    setCompletedAreas(getSavedFloorCoveringAreas(takeoffJobData, takeoffJobData.pixelsPerMm || pixelsPerMm));
    setCompletedFloorplans((takeoffJobData.completedFloorplans || []).map(normaliseRecoveredFloorplan));
    setCompletedMeasurements(takeoffJobData.completedMeasurements || []);
    setCompletedEaves(takeoffJobData.completedEaves || []);
    setCompletedPillars((takeoffJobData.completedPillars || []).map(normaliseRecoveredPillar));
    setSheetLevels(takeoffJobData.sheetLevels || {});
    // A saved takeoff carries whatever projectInfo it had when it was first saved, which is often
    // all-blank because the platform job was named/addressed after the takeoff was created. Replacing
    // wholesale would clobber the live job details, so merge per field and let the platform job fill
    // any blank the saved job hands back.
    const savedProjectInfo = takeoffJobData.projectInfo || {};
    setProjectInfo({
      projectName: savedProjectInfo.projectName
        || initialProjectInfo.projectName
        || takeoffJobData.jobName
        || fallbackName
        || '',
      clientName: savedProjectInfo.clientName || initialProjectInfo.clientName || '',
      siteAddress: savedProjectInfo.siteAddress || initialProjectInfo.siteAddress || '',
      storeyOrLevelName: savedProjectInfo.storeyOrLevelName || initialProjectInfo.storeyOrLevelName || ''
    });
    setPlanFilename(takeoffJobData.planFilename || '');
    setImportedTakeoffFileName(takeoffJobData.sourceFileName || '');
    setScheduleMappings(takeoffJobData.scheduleState?.scheduleMappings || {});
    setQuoteSheetRows(takeoffJobData.scheduleState?.quoteSheetRows || quoteSheetRows);
    setQuotePreviewRows(takeoffJobData.scheduleState?.quotePreviewRows || []);
    setJobSetupPayload(takeoffJobData.scheduleState?.jobSetupPayload || null);
    setLastQuoteSyncSignature(takeoffJobData.scheduleState?.lastQuoteSyncSignature || '');
    aiTakeoffBridge.restoreAppliedRuns(takeoffJobData.scheduleState?.aiAppliedRuns);
    aiTakeoffAnalysis.restoreReport(takeoffJobData.scheduleState?.aiAnalysis, takeoffJobData.scheduleState?.aiInspections, takeoffJobData.scheduleState?.sheetCalibrations);
    setPixelsPerMm(takeoffJobData.pixelsPerMm || null);
    setRotation(takeoffJobData.rotation || 0);
    setTotalPages(embeddedPages.length || takeoffJobData.totalPages || 1);
    setCurrentPage(takeoffJobData.currentPage || 1);
    setActivePolyline([]);
    setActiveAreaPolyline([]);
    setEavePoints([]);
    setBoxStartPoint(null);
    setMeasurePoints([]);
    setCalibPoints([]);
    setSelectedFloorplanId(null);
    setSelectedWallId(null);
    setSelectedAreaId(null);
    setSelectedOpeningId(null);
    setSelectedEaveId(null);
    setSelectedMeasurementId(null);
    setSelectedPillarId(null);
    setRecoveryPreviewMode(isRecoveryPreviewJob);
    setRecoveryPreviewCounts(isRecoveryPreviewJob ? getTakeoffCounts(takeoffJobData) : null);

    setPlanMissingFromSavedJob(embeddedPages.length === 0 && Boolean(takeoffJobData.planFilename || takeoffJobData.plan?.pages?.length));
    setSavedRevision(Number(takeoffJobData.revision || 0));
    setLastSuccessfulSaveAt(takeoffJobData.updatedAt || '');
    setOpenedTakeoffJob({
      masterJobId: takeoffJobData.masterJobId || takeoffJobData.jobId || '',
      takeoffId: takeoffJobData.takeoffId || takeoffJobData.id || `takeoff-${Date.now()}`,
      associatedProjectId: isRecoveryPreviewJob ? '' : (takeoffJobData.associatedProjectId || takeoffJobData.projectId || takeoffJobData.platformProject?.projectId || ''),
      associatedProjectName: isRecoveryPreviewJob ? '' : (takeoffJobData.associatedProjectName || takeoffJobData.platformProject?.projectName || takeoffJobData.projectInfo?.projectName || ''),
      detached: Boolean(takeoffJobData.openedWithoutAttaching || isRecoveryPreviewJob)
    });
    const loadedChecksum = checksumForTakeoffContent({
      rotation: takeoffJobData.rotation || 0,
      pixelsPerMm: takeoffJobData.pixelsPerMm || null,
      planPages: embeddedPages,
      completedWallRuns: takeoffJobData.completedWallRuns || [],
      placedOpenings: takeoffJobData.placedOpenings || [],
      completedAreas: getSavedFloorCoveringAreas(takeoffJobData, takeoffJobData.pixelsPerMm || pixelsPerMm),
      completedFloorplans: takeoffJobData.completedFloorplans || [],
      completedMeasurements: takeoffJobData.completedMeasurements || [],
      completedEaves: takeoffJobData.completedEaves || [],
      completedPillars: takeoffJobData.completedPillars || [],
      sheetLevels: takeoffJobData.sheetLevels || {},
      aiAppliedRuns: takeoffJobData.scheduleState?.aiAppliedRuns || [],
      aiAnalysis: takeoffJobData.scheduleState?.aiAnalysis || null,
    });
    pendingLoadedContentChecksumRef.current = loadedChecksum;
    lastSeenContentChecksumRef.current = loadedChecksum;
    lastSavedContentChecksumRef.current = loadedChecksum;
    suppressAutosaveFromLoadRef.current = true;
    queuedAutosaveChecksumRef.current = '';
    contentEditVersionRef.current = 0;
    lastSavedEditVersionRef.current = 0;
    redundantAutosaveCountRef.current = 0;
    setHasUnsavedChanges(false);
    setAutosaveRequest(null);
    suppressUnsavedChangeRef.current = true;

    setJobName(takeoffJobData.takeoffName || takeoffJobData.jobName || fallbackName);
    try {
      if (embeddedPages.length > 0) {
        // A saved currentPage can outlive the sheet it referred to. Fall back to the first sheet
        // rather than asking the canvas for a page that is not there, which renders blank. Only the
        // displayed sheet moves: no overlay is renumbered, so nothing is re-assigned to a new sheet.
        const savedPage = Number(takeoffJobData.currentPage || 1);
        const hasSavedPage = embeddedPages.some((page, index) => page.pageNumber === savedPage || index === savedPage - 1);
        const restoredPage = hasSavedPage ? savedPage : 1;
        if (restoredPage !== savedPage) {
          logTakeoffPlanLoad('current-page-out-of-range', { savedPage, restoredPage, pageCount: embeddedPages.length });
        }
        setCurrentPage(restoredPage);
        await showPlanPage(embeddedPages, restoredPage);
        logTakeoffPlanLoad('plan-rendered', { page: restoredPage, pageCount: embeddedPages.length });
      } else {
        setImage(null);
        setVectorSegments([]);
      }
      logTakeoffRefresh('job-hydration-end', { hydrationVersion, superseded: hydrationVersion !== takeoffLifecycle.hydrationVersion });
    } catch (error) {
      logTakeoffRefresh('job-hydration-error', { hydrationVersion });
      throw error;
    }
  };

  useEffect(() => {
    if (loadedInitialJobRef.current || !initialJob) return;
    // The workbook can hand over an empty placeholder before it has hydrated. Consuming the restore
    // on that placeholder latches this guard for the life of the mount, and the real job that
    // arrives a moment later is then never loaded at all.
    if (!initialJob.masterJobId && !getEmbeddedPlanPages(initialJob).length) {
      logTakeoffPlanLoad('initial-job-not-ready', { takeoffId: initialJob?.takeoffId || null });
      return;
    }
    loadedInitialJobRef.current = true;
    const hydrationVersion = takeoffLifecycle.hydrationVersion;
    openTakeoffJob(
      initialJob,
      initialJob.takeoffName || initialJob.jobName || platformContext.projectName || '',
      'initial-job',
    ).catch((error) => {
      // A later explicit open already owns the workspace. Re-arming startup hydration on this stale
      // failure would let the old job reload over the top of the one the estimator just opened.
      if (hydrationVersion !== takeoffLifecycle.hydrationVersion) {
        logTakeoffPlanLoad('open-failed-superseded', { source: 'initial-job', takeoffId: initialJob?.takeoffId || null });
        return;
      }
      loadedInitialJobRef.current = false;
      reportPlanLoadFailure(error, 'initial-job', initialJob);
    });
  }, [initialJob, platformContext.projectName]);

  useEffect(() => {
    if (!openTakeoffJobRequest?.jobData) return;
    // A retained request is a command, not a snapshot to reapply after edits.
    // Consume it before checksum comparison and before asynchronous image loading.
    const requestIdentity = openTakeoffJobRequest.requestId ?? openTakeoffJobRequest;
    if (handledOpenTakeoffRequestRef.current === requestIdentity) {
      return;
    }
    handledOpenTakeoffRequestRef.current = requestIdentity;
    const incomingJob = openTakeoffJobRequest.jobData;
    const incomingChecksum = checksumForTakeoffContent({
      rotation: incomingJob.rotation || 0,
      pixelsPerMm: incomingJob.pixelsPerMm || null,
      planPages: normaliseRecoveredPlanPages(getEmbeddedPlanPages(incomingJob)),
      completedWallRuns: incomingJob.completedWallRuns || [],
      placedOpenings: incomingJob.placedOpenings || [],
      completedAreas: getSavedFloorCoveringAreas(incomingJob, incomingJob.pixelsPerMm || null),
      completedFloorplans: incomingJob.completedFloorplans || [],
      completedMeasurements: incomingJob.completedMeasurements || [],
      completedEaves: incomingJob.completedEaves || [],
      completedPillars: incomingJob.completedPillars || [],
      sheetLevels: incomingJob.sheetLevels || {},
      aiAppliedRuns: incomingJob.scheduleState?.aiAppliedRuns || [],
      aiAnalysis: incomingJob.scheduleState?.aiAnalysis || null,
    });
    const incomingTakeoffId = String(incomingJob.takeoffId || incomingJob.id || '');
    const currentTakeoffId = String(openedTakeoffJob?.takeoffId || '');
    if (incomingTakeoffId && currentTakeoffId && incomingTakeoffId === currentTakeoffId && incomingChecksum === lastSeenContentChecksumRef.current) {
      return;
    }
    openTakeoffJob(
      openTakeoffJobRequest.jobData,
      openTakeoffJobRequest.displayName || openTakeoffJobRequest.jobData.takeoffName || '',
      'open-request',
    ).catch((error) => reportPlanLoadFailure(error, 'open-request', openTakeoffJobRequest.jobData));
  }, [openTakeoffJobRequest, openedTakeoffJob?.takeoffId]);

  useEffect(() => {
    const handler = (event) => {
      const jobData = event?.detail?.jobData;
      if (!jobData) return;
      openTakeoffJob(
        jobData,
        event.detail.displayName || jobData.takeoffName || '',
        'open-recent',
      ).catch((error) => reportPlanLoadFailure(error, 'open-recent', jobData));
    };
    window.addEventListener('gr8:ai-plan-takeoff:open-recent', handler);
    return () => window.removeEventListener('gr8:ai-plan-takeoff:open-recent', handler);
  }, []);

  useEffect(() => {
    if (suppressUnsavedChangeRef.current || suppressAutosaveFromLoadRef.current) {
      const loadedChecksum = pendingLoadedContentChecksumRef.current;
      suppressUnsavedChangeRef.current = false;
      suppressAutosaveFromLoadRef.current = false;
      pendingLoadedContentChecksumRef.current = '';
      // Opening an empty workspace may leave the checksum unchanged, so this
      // effect next runs on the first plan import. Suppress only the loaded
      // content itself; waiting forever for its old checksum discards every edit.
      if (!loadedChecksum || loadedChecksum === takeoffContentChecksum) {
        lastSeenContentChecksumRef.current = takeoffContentChecksum;
        if (!lastSavedContentChecksumRef.current) lastSavedContentChecksumRef.current = takeoffContentChecksum;
        return;
      }
    }
    if (draggingVertex || draggingItem || draggingMeasureId || draggingEaveId) {
      pendingDragChecksumRef.current = takeoffContentChecksum;
      setHasUnsavedChanges(true);
      return;
    }
    if (takeoffContentChecksum === lastSeenContentChecksumRef.current) return;
    lastSeenContentChecksumRef.current = takeoffContentChecksum;
    contentEditVersionRef.current += 1;
    const editReason = latestAutosaveBasisRef.current.reason || 'content-change';
    latestAutosaveBasisRef.current = {
      ...latestAutosaveBasisRef.current,
      reason: '',
    };
    setHasUnsavedChanges(true);
    setAutosaveRequest({
      reason: editReason,
      requestedAt: Date.now(),
      checksum: takeoffContentChecksum,
      editVersion: contentEditVersionRef.current,
    });
    // Publish only actual content edits into the already-open master workbook.
    // Its existing autosave owns persistence; parent renders never reload this
    // workspace or start a second autosave/recalculation feedback loop.
    if (masterTakeoffChangeRef.current && platformContext.jobId && !isRecoveryPreview) {
      const result = masterTakeoffChangeRef.current(latestBuildJobDataRef.current(jobName || platformContext.projectName));
      if (result?.ok === false) setPlatformSaveMessage(result.message);
    }
  }, [
    takeoffContentChecksum,
    draggingVertex,
    draggingItem,
    draggingMeasureId,
    draggingEaveId,
  ]);

  useEffect(() => {
    setProjectInfo((prev) => ({
      projectName: prev.projectName || platformContext.projectName || '',
      clientName: prev.clientName || platformContext.clientName || '',
      siteAddress: prev.siteAddress || platformContext.siteAddress || platformContext.projectAddress || '',
      storeyOrLevelName: prev.storeyOrLevelName || platformContext.storeyOrLevelName || ''
    }));
  }, [platformContext.projectName, platformContext.clientName, platformContext.siteAddress, platformContext.projectAddress, platformContext.storeyOrLevelName]);

  useEffect(() => {
    if (Array.isArray(initialQuoteRows) && initialQuoteRows.length) {
      setQuoteSheetRows(initialQuoteRows);
    }
  }, [initialQuoteRows]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.__gr8AiPlanTakeoffState = {
      instanceId: takeoffLifecycle.instanceId,
      activeTool,
      currentPage,
      totalPages,
      stageScale,
      stagePos,
      activePolylinePoints: activePolyline.length,
      activeAreaPolylinePoints: activeAreaPolyline.length,
      eavePoints: eavePoints.length,
      measurePoints: measurePoints.length,
      completedEaves: completedEaves.length,
      completedPillars: completedPillars.length,
      pixelsPerMm,
      sheetLevels,
      wallRuns: completedWallRuns.length,
      wallSegments: completedWallRuns.reduce((sum, wall) => sum + Math.max(0, (wall.nodes || []).length - 1), 0),
      openings: placedOpenings.length,
      floorCoverings: completedAreas.length,
      floorplans: completedFloorplans.length,
      hasCalibration: Boolean(pixelsPerMm),
      // Selection diagnostics: if clicking a wall does nothing, these say whether the canvas is
      // listening at all, whether Select is really the active tool, and whether the sheet on screen
      // actually holds any exterior wall to hit.
      isRecoveryPreview,
      selectedWallId,
      exteriorWallsOnCurrentSheet: completedWallRuns.filter((wall) => (
        Number(wall.page || wall.pageId || 1) === Number(currentPage)
        && String(wall.category || '').toLowerCase() === 'exterior'
      )).length
    };
    if (takeoffLifecycle.lastPage !== currentPage) {
      logTakeoffRefresh('current-page-change', { from: takeoffLifecycle.lastPage ?? null, to: currentPage });
      takeoffLifecycle.lastPage = currentPage;
    }
    if (takeoffLifecycle.lastEavePoints !== eavePoints) {
      const previousCount = takeoffLifecycle.lastEavePoints?.length || 0;
      logTakeoffRefresh('eave-points-change', {
        page: currentPage, previousCount, count: eavePoints.length,
        reset: previousCount > 0 && eavePoints.length === 0,
      });
      takeoffLifecycle.lastEavePoints = eavePoints;
    }
  }, [activeTool, currentPage, totalPages, stageScale, stagePos, activePolyline, activeAreaPolyline, eavePoints, measurePoints, completedEaves, completedPillars, sheetLevels, completedWallRuns, placedOpenings, completedAreas, completedFloorplans, pixelsPerMm, isRecoveryPreview, selectedWallId]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof process === 'undefined' || process.env.NODE_ENV === 'production') return;
    window.__gr8CreateJohnsonSmallTakeoff = () => {
      if (!planPages.length) throw new Error('Import the five-page plan before creating the small test takeoff.');
      const scale = pixelsPerMm || 0.024;
      const now = Date.now();
      const footprint = {
        id: `johnson-test-footprint-${now}`,
        page: currentPage,
        type: 'Footprint',
        label: 'Outer Footprint',
        color: 'rgba(33, 150, 243, 0.25)',
        stroke: '#1565c0',
        nodes: [
          { x: 210, y: 250 },
          { x: 430, y: 220 },
          { x: 520, y: 370 },
          { x: 260, y: 430 }
        ]
      };
      const floorCovering = {
        id: `johnson-test-floorcovering-${now}`,
        page: currentPage,
        category: 'Tiles',
        nodes: [
          { x: 240, y: 470 },
          { x: 430, y: 470 },
          { x: 430, y: 610 },
          { x: 240, y: 610 }
        ],
        exclusions: []
      };
      const wallNodes = [
        { x: 220, y: 680 },
        { x: 420, y: 680 },
        { x: 560, y: 780 }
      ];
      const wallLengthMm = wallNodes.reduce((sum, node, index, nodes) => {
        if (index === 0) return 0;
        return sum + (Math.hypot(node.x - nodes[index - 1].x, node.y - nodes[index - 1].y) / scale);
      }, 0);
      const wallRun = {
        id: `johnson-test-wall-${now}`,
        page: currentPage,
        category: 'exterior',
        nodes: wallNodes,
        thicknessMm: 230,
        alignment: 'outer',
        lengthMm: wallLengthMm
      };
      const openings = [
        {
          id: `johnson-test-window-${now}`,
          page: currentPage,
          type: 'window',
          itemTag: 'W1: 1812',
          heightMm: 1800,
          widthMm: 1200,
          subType: 'standard',
          glassType: 'Clear',
          x: 320,
          y: 680
        },
        {
          id: `johnson-test-door-${now}`,
          page: currentPage,
          type: 'door',
          itemTag: 'D1: 2082-ENTRY',
          heightMm: 2040,
          widthMm: 820,
          subType: 'Entry',
          glassType: 'Clear',
          x: 490,
          y: 730
        }
      ];
      setPixelsPerMm(scale);
      setCompletedFloorplans([footprint]);
      setCompletedAreas([floorCovering]);
      setCompletedWallRuns([wallRun]);
      setSelectedWallId(wallRun.id);
      setPlacedOpenings(openings);
      setActivePolyline([]);
      setActiveAreaPolyline([]);
      setMeasurePoints([]);
      setCalibPoints([]);
      markTakeoffItemCompleted('johnson-small-acceptance-test');
      return { pageCount: planPages.length, floorplans: 1, floorCoverings: 1, wallSegments: 2, openings: 2, hasCalibration: true };
    };
    return () => {
      delete window.__gr8CreateJohnsonSmallTakeoff;
    };
  }, [planPages.length, pixelsPerMm, currentPage, markTakeoffItemCompleted]);

  const hasOpenTakeoffJob = Boolean(jobName || openedTakeoffJob || planPages.length);
  const attachedProjectId = openedTakeoffJob?.detached ? '' : (openedTakeoffJob?.associatedProjectId || platformContext.projectId || '');
  const attachedProjectName = openedTakeoffJob?.detached ? '' : (openedTakeoffJob?.associatedProjectName || platformContext.projectName || '');
  const hasAttachedProject = Boolean(attachedProjectId);
  const currentProjectLabel = isRecoveryPreview
    ? 'Recovery preview only'
    : hasOpenTakeoffJob
      ? (attachedProjectName || attachedProjectId || 'No platform project attached')
      : 'No takeoff job attached';

  const takeoffJobDisplayName = attachedProjectName
    || projectInfo.projectName
    || jobName
    || importedTakeoffFileName
    || planFilename
    || 'Untitled takeoff';
  const takeoffSiteAddress = projectInfo.siteAddress
    || platformContext.siteAddress
    || platformContext.projectAddress
    || '';

  useEffect(() => {
    onTakeoffWorkflowChange?.({ hasOpenTakeoffJob, isRecoveryPreview });
  }, [hasOpenTakeoffJob, isRecoveryPreview, onTakeoffWorkflowChange]);

  const createRecoverySnapshot = useCallback((jobData, reason = 'save-verification-failed') => {
    if (typeof window === 'undefined') return;
    try {
      const createdAt = new Date().toISOString();
      const snapshotId = `takeoff-recovery-${Date.now()}`;
      const takeoffName = jobData?.takeoffName || jobData?.jobName || '';
      const sourceFileName = jobData?.sourceFileName || jobData?.planFilename || '';
      const snapshot = {
        id: snapshotId,
        createdAt,
        reason,
        takeoffId: jobData?.takeoffId || '',
        takeoffName,
        revision: Number(jobData?.revision || 0),
        sourceFileName,
        counts: getTakeoffCounts(jobData),
        planPageCount: getEmbeddedPlanPages(jobData).length
      };
      const portableSnapshot = {
        ...snapshot,
        fileName: `${sanitizeJobFileName(takeoffName || sourceFileName || 'unsaved_takeoff')}-EMERGENCY-${Date.now()}.${AI_PLAN_TAKEOFF_EXTENSION}`,
        portableTakeoff: createPortableTakeoffExport(jobData, {
          takeoffName,
          projectId: jobData?.projectId || jobData?.platformProject?.projectId || '',
          projectName: jobData?.platformProject?.projectName || jobData?.projectInfo?.projectName || ''
        })
      };
      storeEmergencyTakeoffSnapshot(portableSnapshot).catch((error) => {
        console.error('Failed to store full AI Plan Takeoff recovery snapshot:', error);
      });
      try {
        window.localStorage.setItem(`gr8:ai-plan-takeoff:recovery:${Date.now()}`, JSON.stringify(snapshot));
      } catch (error) {
        console.warn('AI Plan Takeoff recovery breadcrumb could not be stored in localStorage:', error);
      }
    } catch (error) {
      console.error('Failed to create AI Plan Takeoff recovery snapshot:', error);
    }
  }, []);

  const requireVerifiedSave = useCallback((result, jobData) => {
    const verification = result?.verification;
    if (!result?.ok || !verification?.ok) {
      createRecoverySnapshot(jobData);
      // Name the check that actually failed. "SAVE FAILED" on its own gives the estimator nothing
      // to act on and gives support nothing to diagnose, and the reasons are not interchangeable:
      // a page-count mismatch is a lost plan image, a checksum mismatch is lost measurements.
      const failed = verification ? [
        verification.revisionMatches === false && 'revision',
        verification.checksumMatches === false && 'content checksum',
        verification.countsMatch === false && 'takeoff item counts',
        verification.planPageCountMatches === false
          && `plan pages (sent ${verification.submittedCounts?.renderablePlanPages ?? '?'} readable of ${verification.submittedCounts?.planPages ?? '?'}, stored ${verification.savedCounts?.renderablePlanPages ?? '?'} of ${verification.savedCounts?.planPages ?? '?'})`,
      ].filter(Boolean) : [];
      return {
        ok: false,
        message: failed.length
          ? `${SAVE_VERIFICATION_FAILED_MESSAGE} - could not confirm ${failed.join(', ')}`
          : `${SAVE_VERIFICATION_FAILED_MESSAGE} - the save did not complete`,
        verification
      };
    }
    return {
      ok: true,
      revision: Number(result.revision || verification.revision || jobData.revision || 0),
      savedAt: result.savedAt || verification.updatedAt || new Date().toISOString(),
      message: result.message || `Saved - Revision ${verification.revision || result.revision || 0}`,
      verification
    };
  }, [createRecoverySnapshot]);

  const clearTakeoffWorkspace = useCallback(() => {
    aiTakeoffBridge.restoreAppliedRuns();
    aiTakeoffAnalysis.restoreReport();
    takeoffLifecycle.hydrationVersion += 1;
    takeoffLifecycle.imageRequest = null;
    displayedPlanRef.current = null;
    sheetViewStateRef.current = {};
    fittedSheetViewKeyRef.current = '';
    setImage(null);
    setPdfDoc(null);
    setPlanPages([]);
    setPlanFilename('');
    setImportedTakeoffFileName('');
    setCurrentPage(1);
    setTotalPages(1);
    setRotation(0);
    setStageScale(1);
    setStagePos({ x: 0, y: 0 });
    setPixelsPerMm(null);
    setCalibrationMode(false);
    setCalibPoints([]);
    setMeasurePoints([]);
    setActivePolyline([]);
    setEavePoints([]);
    setActiveAreaPolyline([]);
    setBoxStartPoint(null);
    setCompletedWallRuns([]);
    setPlacedOpenings([]);
    setCompletedAreas([]);
    setCompletedFloorplans([]);
    setCompletedMeasurements([]);
    setCompletedEaves([]);
    setCompletedPillars([]);
    setSelectedWallId(null);
    setSelectedOpeningId(null);
    setSelectedAreaId(null);
    setSelectedFloorplanId(null);
    setSelectedEaveId(null);
    setSelectedPillarId(null);
    setSelectedAreaForExclusion(null);
    setDraggingVertex(null);
    setDraggingItem(null);
    setDraggingMeasureId(null);
    setDraggingEaveId(null);
    setPlanMissingFromSavedJob(false);
    setRecoveryPreviewMode(false);
    setRecoveryPreviewCounts(null);
  }, []);

  const createNewTakeoffJob = () => {
    if (isRecoveryPreview) return;
    if (embedded && onNewMasterJob) { onNewMasterJob(); return; }
    const defaultName = 'Untitled takeoff';
    const nextName = window.prompt('Takeoff job name', defaultName) || '';
    if (!nextName.trim()) return;
    clearTakeoffWorkspace();
    setJobName(nextName.trim());
    setOpenedTakeoffJob({
      takeoffId: `takeoff-${Date.now()}`,
      associatedProjectId: '',
      associatedProjectName: ''
    });
    setPlatformSaveMessage('New takeoff job created. Import a plan to begin measuring.');
    setHasUnsavedChanges(false);
  };

  const stampSavedContentBaseline = useCallback((jobData = {}, editVersion = contentEditVersionRef.current) => {
    const checksum = String(jobData?.contentChecksum || takeoffContentChecksum || '').trim();
    if (!checksum) return;
    lastSavedContentChecksumRef.current = checksum;
    lastSeenContentChecksumRef.current = checksum;
    lastSavedEditVersionRef.current = Number(editVersion || contentEditVersionRef.current || 0);
    queuedAutosaveChecksumRef.current = '';
    suppressAutosaveFromLoadRef.current = false;
    pendingLoadedContentChecksumRef.current = '';
  }, [takeoffContentChecksum]);

  const saveAttachedJobData = async (jobData) => {
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    if (autosaveIdleRef.current && typeof window.cancelIdleCallback === 'function') {
      window.cancelIdleCallback(autosaveIdleRef.current);
      autosaveIdleRef.current = null;
    }
    manualSaveInFlightRef.current = true;
    try {
      const result = await Promise.resolve(onSaveToPlatform(jobData));
      const verifiedSave = requireVerifiedSave(result, jobData);
      if (!verifiedSave.ok) {
        setHasUnsavedChanges(true);
        setPlatformSaveMessage(verifiedSave.message);
        alert(verifiedSave.message);
        return verifiedSave;
      }
      setJobName(jobData.takeoffName || jobData.jobName);
setSavedRevision(verifiedSave.revision);
       setLastSuccessfulSaveAt(verifiedSave.savedAt);
       setHasUnsavedChanges(false);
       setAutosaveRequest(null);
       stampSavedContentBaseline(jobData);
       setPlatformSaveMessage(verifiedSave.message);
       const savedJob = { ...jobData, revision: verifiedSave.revision, updatedAt: verifiedSave.savedAt, storageRecordKey: verifiedSave.key || '' };
       const recent = rememberRecentTakeoffJob(savedJob);
       onRecentTakeoffJobsChange?.(recent);
       return verifiedSave;
    } finally {
      manualSaveInFlightRef.current = false;
    }
  };

  const buildAttachedJobData = (project, name) => {
    const projectName = String(name || project?.projectName || 'Johnson 123').trim();
    const projectId = String(project?.projectId || project?.id || projectName).trim();
    const takeoffName = projectName;
    const jobData = buildJobData(takeoffName);
    return {
      ...jobData,
      jobName: takeoffName,
      takeoffName,
      associatedProjectId: projectId,
      associatedProjectName: projectName,
      openedWithoutAttaching: false,
      sourceFileName: importedTakeoffFileName || planFilename || jobData.sourceFileName || '',
      planFilename: planFilename || jobData.planFilename || '',
      platformProject: {
        ...(jobData.platformProject || {}),
        ...(project || {}),
        projectId,
        projectName,
        jobNumber: project?.jobNumber || projectName,
        workspaceId: project?.workspaceId || platformContext.workspaceId || '',
        organisationId: project?.organisationId || platformContext.organisationId || ''
      }
    };
  };

  const attachCurrentDraftToProject = async (requestedProjectName = attachProjectName) => {
    const requestedName = String(requestedProjectName || '').trim();
    if (!requestedName) {
      setAttachError('Enter a project name.');
      return { ok: false, message: 'Enter a project name.' };
    }
    if (!hasOpenTakeoffJob || !planPages.length) {
      const message = 'The current five-page browser draft is not available to attach.';
      setAttachError(message);
      return { ok: false, message };
    }
    const project = onAttachToProject
      ? await Promise.resolve(onAttachToProject({ projectName: requestedName, sourceFileName: importedTakeoffFileName || planFilename || '' }, { skipSave: true }))
      : { projectId: requestedName, projectName: requestedName, jobNumber: requestedName };
    const jobData = buildAttachedJobData(project, requestedName);
    const verification = await saveAttachedJobData(jobData);
    if (!verification.ok) return { ok: false, verification };
    setOpenedTakeoffJob({
      takeoffId: jobData.takeoffId,
      associatedProjectId: jobData.associatedProjectId,
      associatedProjectName: jobData.associatedProjectName,
      detached: false
    });
    setProjectInfo((prev) => ({
      ...prev,
      projectName: jobData.associatedProjectName || prev.projectName,
      clientName: prev.clientName || project?.clientName || '',
      siteAddress: prev.siteAddress || project?.siteAddress || project?.projectAddress || ''
    }));
    return {
      ok: true,
      projectId: jobData.associatedProjectId,
      projectName: jobData.associatedProjectName,
      takeoffId: jobData.takeoffId,
      revision: verification.revision,
      pageCount: getEmbeddedPlanPages(jobData).length,
      verification: verification.verification
    };
  };

  const handleAttachProjectSave = async () => {
    if (isRecoveryPreview || attachSaving) return;
    setAttachSaving(true);
    setAttachError('');
    try {
      const result = await attachCurrentDraftToProject(attachProjectName);
      if (result?.ok) setAttachDialogOpen(false);
    } catch (error) {
      const message = error?.message || 'Could not attach this takeoff to the project.';
      setAttachError(message);
      setPlatformSaveMessage(SAVE_VERIFICATION_FAILED_MESSAGE);
      createRecoverySnapshot(buildJobData(jobName || planFilename || 'AI Plan Takeoff'), 'attach-to-project-failed');
    } finally {
      setAttachSaving(false);
    }
  };

  const handleSaveJob = async () => {
    if (isRecoveryPreview) {
      alert("Recovery Preview is read-only and is not attached to Johnson.");
      return;
    }
    if (embedded && onSaveToPlatform) {
      if (!hasOpenTakeoffJob) {
        alert("No takeoff job is open.");
        return;
      }
      if (!hasAttachedProject) {
        setAttachProjectName('Johnson 123');
        setAttachError('');
        setAttachDialogOpen(true);
        return;
      }
      const nextName = attachedProjectName || platformContext.projectName || jobName || importedTakeoffFileName || planFilename || 'AI Plan Takeoff';
      const jobData = buildJobData(nextName);
      await saveAttachedJobData(jobData);
      return;
    }

    // Save writes back to the file this takeoff was opened from or last saved to. With no usable
    // handle there is no location to write to, so it becomes Save As and asks for one.
    const name = jobName || attachedProjectName || planFilename || 'Untitled takeoff';
    try {
      const result = await saveTakeoffToComputer(name, { handle: jobFileHandle });
      if (result.status === 'cancelled') {
        setPlatformSaveMessage('Save was cancelled. Nothing was written and the takeoff still has unsaved changes.');
        return;
      }
      applyLocalSaveResult(result, name);
    } catch (error) {
      const message = error?.message || String(error);
      setHasUnsavedChanges(true);
      setPlatformSaveMessage(`Save failed: ${message}`);
      alert(`Save failed: ${message}`);
    }
  };

  // Save As always writes a file to the user's own computer. The platform is not the permanent
  // home for a builder's takeoff: a manually saved file has to reopen on another machine, in
  // another browser, with this browser's storage empty.
  const handleSaveJobAs = async () => {
    if (isRecoveryPreview) {
      alert("Recovery Preview is read-only and cannot be saved as a new takeoff.");
      return;
    }
    if (!hasOpenTakeoffJob) {
      alert("No takeoff job is open.");
      return;
    }
    const name = jobName || attachedProjectName || planFilename || 'Untitled takeoff';
    try {
      const result = await saveTakeoffToComputer(name, { handle: null });
      if (result.status === 'cancelled') {
        setPlatformSaveMessage('Save As was cancelled. Nothing was written and the takeoff still has unsaved changes.');
        return;
      }
      applyLocalSaveResult(result, name);
    } catch (error) {
      const message = error?.message || String(error);
      setHasUnsavedChanges(true);
      setPlatformSaveMessage(`Save As failed: ${message}`);
      alert(`Save As failed: ${message}`);
    }
  };

  const handleExportTakeoffFile = async () => {
    if (isRecoveryPreview) {
      alert("Recovery Preview is read-only. The recovered file on disk was not changed.");
      return;
    }
    if (!hasOpenTakeoffJob) {
      alert("No takeoff job is open.");
      return;
    }
    const exportName = attachedProjectName || jobName || 'Untitled takeoff';
    const jobData = buildJobData(jobName || exportName);
    const portable = createPortableTakeoffExport(jobData, {
      projectId: attachedProjectId || '',
      projectName: attachedProjectName || '',
      takeoffName: attachedProjectName || jobName || importedTakeoffFileName || exportName,
      sourceFileName: importedTakeoffFileName || planFilename || ''
    });
    if (!resolvePortableTakeoffImport(portable).ok) {
      alert("Takeoff backup was not downloaded because the generated file could not be verified.");
      return;
    }
    const filename = `${sanitizeDownloadFileName(exportName)}${AI_PLAN_TAKEOFF_EXTENSION}`;
    const blob = new Blob([JSON.stringify(portable, null, 2)], { type: 'application/json' });
    const url = createTakeoffObjectUrl(blob, 'takeoff-backup', logTakeoffRefresh);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.setTimeout(() => revokeTakeoffObjectUrl(url, 'takeoff-backup', logTakeoffRefresh), 5000);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.__gr8AiPlanTakeoffRecovery = {
      inspectCurrentDraft: () => {
        const jobData = buildJobData(jobName || planFilename || importedTakeoffFileName || 'AI Plan Takeoff');
        return {
          jobName,
          planFilename,
          importedTakeoffFileName,
          platformProject: currentProjectLabel,
          attachedProjectId,
          attachedProjectName,
          savedRevision,
          lastSuccessfulSaveAt,
          hasUnsavedChanges,
          counts: getTakeoffCounts(jobData),
          pageCount: getEmbeddedPlanPages(jobData).length,
          checksum: takeoffContentChecksum
        };
      },
      attachToJohnson123: () => attachCurrentDraftToProject('Johnson 123')
    };
    return () => {
      if (window.__gr8AiPlanTakeoffRecovery?.attachToJohnson123) delete window.__gr8AiPlanTakeoffRecovery;
    };
  }, [attachedProjectId, attachedProjectName, currentProjectLabel, savedRevision, lastSuccessfulSaveAt, hasUnsavedChanges, jobName, planFilename, importedTakeoffFileName, buildJobData, attachCurrentDraftToProject, takeoffContentChecksum]);

  useEffect(() => {
    if (!AUTOMATIC_TAKEOFF_SAVE_ENABLED || !autosaveRequest || !embedded || !onSaveToPlatform || isRecoveryPreview || !hasOpenTakeoffJob || !hasAttachedProject || !planPages.length) return;
    const requestChecksum = autosaveRequest.checksum || takeoffContentChecksum;
    if (!requestChecksum || requestChecksum === lastSavedContentChecksumRef.current) {
      setAutosaveRequest(null);
      return;
    }
    latestAutosaveBasisRef.current = {
      checksum: requestChecksum,
      reason: autosaveRequest.reason || latestAutosaveBasisRef.current.reason || 'content-change',
      editVersion: autosaveRequest.editVersion || contentEditVersionRef.current,
      requestedAt: autosaveRequest.requestedAt || Date.now(),
    };
    if (manualSaveInFlightRef.current || autosaveInFlightRef.current) {
      queuedAutosaveChecksumRef.current = requestChecksum;
      return;
    }
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(() => {
      const runAutosave = async () => {
      const basis = latestAutosaveBasisRef.current;
      const nextChecksum = basis.checksum || takeoffContentChecksum;
      if (!nextChecksum || nextChecksum === lastSavedContentChecksumRef.current) {
        setAutosaveRequest(null);
        return;
      }
      if (manualSaveInFlightRef.current || autosaveInFlightRef.current) {
        queuedAutosaveChecksumRef.current = nextChecksum;
        return;
      }
      autosaveInFlightRef.current = true;
      logTakeoffRefresh('autosave-start');
      const nextName = attachedProjectName || platformContext.projectName || jobName || importedTakeoffFileName || planFilename || 'AI Plan Takeoff';
      const buildCurrentJobData = latestBuildJobDataRef.current;
      const jobData = typeof buildCurrentJobData === 'function' ? buildCurrentJobData(nextName) : buildJobData(nextName);
      const jobWithChecksum = {
        ...jobData,
        contentChecksum: nextChecksum,
      };
      setPlatformSaveMessage('Autosaving changes...');
      try {
        const result = await Promise.resolve(onSaveToPlatform(jobWithChecksum));
        const verifiedSave = requireVerifiedSave(result, jobWithChecksum);
        if (!verifiedSave.ok) {
          setHasUnsavedChanges(true);
          setPlatformSaveMessage(verifiedSave.message);
          setAutosaveRequest(null);
          return;
        }
        const alreadySavedSameChecksum = nextChecksum === lastSavedContentChecksumRef.current;
        const sameEditVersion = Number(basis.editVersion || 0) > 0 && Number(basis.editVersion || 0) === Number(lastSavedEditVersionRef.current || 0);
        if (alreadySavedSameChecksum || sameEditVersion) {
          redundantAutosaveCountRef.current += 1;
          if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production' && redundantAutosaveCountRef.current > 1) {
            console.error('[AI Plan Takeoff] Redundant autosave detected without content edit', {
              revision: verifiedSave.revision,
              checksum: nextChecksum,
              editVersion: basis.editVersion,
            });
          }
        } else {
          redundantAutosaveCountRef.current = 0;
          lastSavedContentChecksumRef.current = nextChecksum;
          lastSavedEditVersionRef.current = basis.editVersion || contentEditVersionRef.current;
        }
        setJobName(nextName);
        setSavedRevision(verifiedSave.revision);
        setLastSuccessfulSaveAt(verifiedSave.savedAt);
        setHasUnsavedChanges(false);
        setPlatformSaveMessage(verifiedSave.message);
        setAutosaveRequest(null);
        const recent = rememberRecentTakeoffJob({ ...jobWithChecksum, revision: verifiedSave.revision, updatedAt: verifiedSave.savedAt, storageRecordKey: verifiedSave.key || '' });
        onRecentTakeoffJobsChange?.(recent);
      } catch (error) {
        console.error('AI Plan Takeoff autosave failed:', error);
        createRecoverySnapshot(jobWithChecksum, 'autosave-error');
        setHasUnsavedChanges(true);
        setPlatformSaveMessage(SAVE_VERIFICATION_FAILED_MESSAGE);
      } finally {
        autosaveInFlightRef.current = false;
        logTakeoffRefresh('autosave-end');
        const queuedChecksum = queuedAutosaveChecksumRef.current;
        queuedAutosaveChecksumRef.current = '';
        if (queuedChecksum && queuedChecksum !== lastSavedContentChecksumRef.current) {
          setAutosaveRequest({
            reason: 'queued-content-change',
            requestedAt: Date.now(),
            checksum: queuedChecksum,
            editVersion: contentEditVersionRef.current,
          });
        }
      }
      };
      if (typeof window.requestIdleCallback === 'function') {
        autosaveIdleRef.current = window.requestIdleCallback(() => {
          autosaveIdleRef.current = null;
          void runAutosave();
        }, { timeout: 15000 });
      } else {
        void runAutosave();
      }
    }, 5000);
    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      if (autosaveIdleRef.current && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(autosaveIdleRef.current);
        autosaveIdleRef.current = null;
      }
    };
  }, [autosaveRequest, embedded, onSaveToPlatform, isRecoveryPreview, hasOpenTakeoffJob, hasAttachedProject, planPages.length, attachedProjectName, jobName, platformContext.projectName, importedTakeoffFileName, planFilename, takeoffContentChecksum, onRecentTakeoffJobsChange, requireVerifiedSave, createRecoverySnapshot]);

  const confirmImportedTakeoff = (imported, fileName) => {
    if (embedded && onLinkLegacyTakeoff) {
      if (!platformContext.jobId) {
        setPlatformSaveMessage('Create or open a master job before importing a takeoff.');
        return 'cancel';
      }
      return window.confirm(`Import ${fileName} into ${platformContext.projectName}? The existing master job will own its plans and takeoff results.`) ? 'attach' : 'cancel';
    }
    const counts = imported.summary.counts || {};
    const message = [
      `Filename: ${fileName}`,
      '',
      `Detected takeoff: ${imported.summary.takeoffName || fileName}`,
      `Pages: ${imported.summary.pageCount}`,
      `Revision: ${imported.summary.revision || 0}`,
      `Associated platform project: ${imported.summary.projectName || 'None recorded'}`,
      `Floor coverings: ${counts.floorCoverings || 0}`,
      `Floor areas: ${counts.floorplans || 0}`,
      `Walls: ${counts.walls || 0}`,
      `Openings: ${counts.openings || 0}`,
      `Eaves: ${counts.eaves || 0}`,
      '',
      'Type "attach" to attach to the current platform project and open, "open" to open without attaching, or leave blank to cancel.'
    ].join('\n');
    const choice = window.prompt(message, platformContext.projectId ? 'attach' : 'open');
    if (!choice) return 'cancel';
    const normalised = choice.trim().toLowerCase();
    if (normalised.startsWith('attach')) return 'attach';
    if (normalised.startsWith('open')) return 'open';
    return 'cancel';
  };

  const handleOpenJob = async () => {
    if (isRecoveryPreview) {
      alert("Recovery Preview is read-only. Close the preview before opening another takeoff.");
      return;
    }
    if (!window.showOpenFilePicker) {
      document.getElementById('legacy-job-loader')?.click();
      return;
    }
    try {
      const [fileHandle] = await window.showOpenFilePicker({
        types: [{ description: AI_PLAN_TAKEOFF_FILE_DESCRIPTION, accept: { 'application/json': [AI_PLAN_TAKEOFF_EXTENSION, '.json'] } }],
        multiple: false
      });
      const file = await fileHandle.getFile();
      if (!/\.(gr8takeoff|json)$/i.test(file.name)) {
        alert("Choose a .gr8takeoff file or a legacy standalone takeoff .json file.");
        return;
      }
      if (!file.size) {
        alert(`${file.name} is empty and cannot be imported.`);
        return;
      }
      const data = JSON.parse(await file.text());
      const imported = resolvePortableTakeoffImport(data);
      if (!imported.ok) {
        alert(imported.message);
        return;
      }
      const importChoice = confirmImportedTakeoff(imported, file.name);
      if (importChoice === 'cancel') return;
      const takeoffJobData = embedded && onLinkLegacyTakeoff
        ? onLinkLegacyTakeoff({ ...imported.job, sourceFileName: file.name })
        : { ...imported.job, sourceFileName: file.name };
      if (importChoice === 'open') {
        takeoffJobData.associatedProjectId = '';
        takeoffJobData.associatedProjectName = '';
        takeoffJobData.platformProject = {};
        takeoffJobData.openedWithoutAttaching = true;
      }
      // Keep the handle so a later Save writes back to this same file instead of asking again.
      setJobFileHandle(fileHandle);
      await loadJobData(takeoffJobData, filenameWithoutKnownGr8Extension(file.name));
      setImportedTakeoffFileName(file.name);
      if (embedded && onSaveToPlatform && importChoice === 'attach') {
        const submittedJob = {
          ...takeoffJobData,
          takeoffName: takeoffJobData.takeoffName || takeoffJobData.jobName || file.name.replace(/\.json$/i, ''),
          sourceFileName: file.name,
          baseRevision: savedRevision,
          platformProject: buildJobData(takeoffJobData.jobName || file.name).platformProject
        };
        const result = await Promise.resolve(onSaveToPlatform(submittedJob));
        const verifiedSave = requireVerifiedSave(result, submittedJob);
        if (!verifiedSave.ok) {
          setHasUnsavedChanges(true);
          setPlatformSaveMessage(verifiedSave.message);
          alert(verifiedSave.message);
          return;
        }
        setSavedRevision(verifiedSave.revision);
        setLastSuccessfulSaveAt(verifiedSave.savedAt);
        setHasUnsavedChanges(false);
        stampSavedContentBaseline(submittedJob);
        const savedJob = { ...takeoffJobData, revision: verifiedSave.revision, updatedAt: verifiedSave.savedAt, storageRecordKey: verifiedSave.key || '' };
        const recent = rememberRecentTakeoffJob(savedJob);
        onRecentTakeoffJobsChange?.(recent);
        setPlatformSaveMessage(`Imported ${file.name} and attached it to ${currentProjectLabel}. ${verifiedSave.message}`);
      } else {
        setHasUnsavedChanges(true);
        setPlatformSaveMessage(`Imported takeoff file ${file.name}.`);
      }
    } catch (err) {
      if (err?.name === 'AbortError') return;
      console.error("Failed to open job file:", err);
      alert("Invalid job file format.");
    }
  };

  const handleLoadJob = (e) => {
    if (isRecoveryPreview) {
      alert("Recovery Preview is read-only. Close the preview before importing another takeoff.");
      e.target.value = '';
      return;
    }
    const file = e.target.files[0];
    if (!file) return;
    if (!/\.(gr8takeoff|json)$/i.test(file.name)) {
      alert("Choose a .gr8takeoff file or a legacy standalone takeoff .json file.");
      e.target.value = '';
      return;
    }
    if (!file.size) {
      alert(`${file.name} is empty and cannot be imported.`);
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target.result);
        const imported = resolvePortableTakeoffImport(data);
        if (!imported.ok) {
          alert(imported.message);
          return;
        }
        const importChoice = confirmImportedTakeoff(imported, file.name);
        if (importChoice === 'cancel') return;
        const takeoffJobData = embedded && onLinkLegacyTakeoff
          ? onLinkLegacyTakeoff({ ...imported.job, sourceFileName: file.name })
          : { ...imported.job, sourceFileName: file.name };
        if (importChoice === 'open') {
          takeoffJobData.associatedProjectId = '';
          takeoffJobData.associatedProjectName = '';
          takeoffJobData.platformProject = {};
          takeoffJobData.openedWithoutAttaching = true;
        }
        setJobFileHandle(null);
        await loadJobData(takeoffJobData, filenameWithoutKnownGr8Extension(file.name));
        setImportedTakeoffFileName(file.name);
        if (embedded && onSaveToPlatform && importChoice === 'attach') {
          const submittedJob = {
            ...takeoffJobData,
            takeoffName: takeoffJobData.takeoffName || takeoffJobData.jobName || file.name.replace(/\.json$/i, ''),
            sourceFileName: file.name,
            baseRevision: savedRevision,
            platformProject: buildJobData(takeoffJobData.jobName || file.name).platformProject
          };
          const result = await Promise.resolve(onSaveToPlatform(submittedJob));
          const verifiedSave = requireVerifiedSave(result, submittedJob);
          if (!verifiedSave.ok) {
            setHasUnsavedChanges(true);
            setPlatformSaveMessage(verifiedSave.message);
            alert(verifiedSave.message);
            return;
          }
          setSavedRevision(verifiedSave.revision);
          setLastSuccessfulSaveAt(verifiedSave.savedAt);
          setHasUnsavedChanges(false);
          stampSavedContentBaseline(submittedJob);
          const savedJob = { ...takeoffJobData, revision: verifiedSave.revision, updatedAt: verifiedSave.savedAt, storageRecordKey: verifiedSave.key || '' };
          const recent = rememberRecentTakeoffJob(savedJob);
          onRecentTakeoffJobsChange?.(recent);
          setPlatformSaveMessage(`Imported ${file.name} and attached it to ${currentProjectLabel}. ${verifiedSave.message}`);
        } else {
          setHasUnsavedChanges(true);
          setPlatformSaveMessage(`Imported takeoff file ${file.name}.`);
        }
      } catch (err) {
        console.error("Failed to parse job file:", err);
        alert("Invalid job file format.");
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleWallCategoryChange = (cat) => {
    setWallCategory(cat);
    setDetectedWallThicknessMm(getDefaultWallThickness(cat));
  };

  const handleSizeCodeChange = (code) => {
    setSizeCodeInput(code);
    const cleaned = code.replace(/\D/g, '');
    if (cleaned.length >= 4) {
      const hDec = parseInt(cleaned.substring(0, 2), 10);
      const wDec = parseInt(cleaned.substring(2, 4), 10);
      if (!isNaN(hDec) && !isNaN(wDec)) {
        setOpeningHeightMm(hDec * 100);
        setOpeningWidthMm(wDec * 100);
      }
    } else if (cleaned.length === 3) {
      const hDec = parseInt(cleaned.substring(0, 1), 10);
      const wDec = parseInt(cleaned.substring(1, 3), 10);
      if (!isNaN(hDec) && !isNaN(wDec)) {
        setOpeningHeightMm(hDec * 100);
        setOpeningWidthMm(wDec * 100);
      }
    }
  };

  const getWallRunLengthMm = useCallback((nodes, scalePxPerMm) => {
    if (!nodes || nodes.length < 2 || !scalePxPerMm) return 0;
    let totalLenPx = 0;
    for (let i = 0; i < nodes.length - 1; i++) {
      totalLenPx += Math.hypot(nodes[i + 1].x - nodes[i].x, nodes[i + 1].y - nodes[i].y);
    }
    return totalLenPx / scalePxPerMm;
  }, []);

  const getEaveWidthMm = () => {
    if (eaveWidthOption === 'Special') return specialEaveWidthMm;
    return parseFloat(eaveWidthOption) || 0;
  };

  const getEaveWidthLabel = (eave) => {
    return eave.widthOption === 'Special' ? `${eave.widthMm}mm Special` : `${eave.widthMm}mm`;
  };

  const getEaveNodes = (eave) => {
    if (eave.nodes) return eave.nodes;
    return [eave.p1, eave.p2].filter(Boolean);
  };

  const getEaveLengthMm = (eave, scalePxPerMm) => {
    return runLengthM({ ...eave, nodes: getEaveNodes(eave) }, scalePxPerMm) * 1000;
  };

  const finalizeCurrentWallRun = useCallback(() => {
    if (activePolyline.length < 2 || !pixelsPerMm) {
      setActivePolyline([]);
      return;
    }

    const lengthMm = getWallRunLengthMm(activePolyline, pixelsPerMm);
    const newRun = {
      id: Date.now() + Math.random(),
      page: currentPage,
      category: wallCategory,
      nodes: [...activePolyline],
      thicknessMm: snapToStandardThickness(detectedWallThicknessMm),
      alignment,
      lengthMm,
      exteriorType: wallCategory === 'exterior' ? exteriorWallType : '',
      linedFaces: 2,
      openingDeductionsEnabled: true,
      wallHeightM: null
    };

    setCompletedWallRuns((prev) => [...prev, newRun]);
    selectOnly('wall', newRun.id);
    setActivePolyline([]);
    markTakeoffItemCompleted('wall-run');
  }, [activePolyline, pixelsPerMm, currentPage, wallCategory, exteriorWallType, detectedWallThicknessMm, alignment, getWallRunLengthMm, markTakeoffItemCompleted]);

  const finalizeCurrentEaveRun = useCallback(() => {
    if (eavePoints.length < 2 || !pixelsPerMm) {
      setEavePoints([]);
      return;
    }

    const widthMm = eaveWidthOption === 'Special' ? specialEaveWidthMm : parseFloat(eaveWidthOption) || 0;
    const newEave = {
      id: Date.now() + Math.random(),
      page: currentPage,
      nodes: [...eavePoints],
      widthOption: eaveWidthOption,
      widthMm,
      level: eaveLevel,
      lengthMm: getWallRunLengthMm(eavePoints, pixelsPerMm),
      alignment: eaveAlignment
    };

    setCompletedEaves((prev) => [...prev, newEave]);
    setSelectedEaveId(newEave.id);
    setEavePoints([]);
    markTakeoffItemCompleted('eave-run');
  }, [eavePoints, pixelsPerMm, currentPage, eaveWidthOption, specialEaveWidthMm, eaveLevel, eaveAlignment, getWallRunLengthMm, markTakeoffItemCompleted]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setActivePolyline([]);
        setEavePoints([]);
        setActiveAreaPolyline([]);
        setBoxStartPoint(null);
        setCalibrationMode(false);
        setCalibPoints([]);
        setMeasurePoints([]);
        setEavePoints([]);
        setSelectedFloorplanId(null);
        setSelectedWallId(null);
        setSelectedAreaId(null);
        setSelectedOpeningId(null);
        setSelectedEaveId(null);
        setSelectedMeasurementId(null);
        setSelectedPillarId(null);
        setDraggingVertex(null);
        setDraggingItem(null);
        setDraggingMeasureId(null);
        setDraggingEaveId(null);
        return;
      }
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      if (isRecoveryPreview) return;
      let target = null;
      if (selectedWallId) target = { type: 'wall', id: selectedWallId };
      else if (selectedAreaId) target = { type: 'area', id: selectedAreaId };
      else if (selectedOpeningId) target = { type: 'opening', id: selectedOpeningId };
      else if (selectedFloorplanId) target = { type: 'floorplan', id: selectedFloorplanId };
      else if (selectedMeasurementId) target = { type: 'measure', id: selectedMeasurementId };
      else if (selectedEaveId) target = { type: 'eaves', id: selectedEaveId };
      else if (selectedPillarId) target = { type: 'pillar', id: selectedPillarId };
      if (!target) return;
      const ok = window.confirm('Delete selected item?');
      if (!ok) return;
      e.preventDefault();
      deleteMarkupItem(target.type, target.id);
      markTakeoffItemCompleted('delete-selected-item');
      setSelectedMeasurementId(null);
      setSelectedFloorplanId(null);
      setSelectedWallId(null);
      setSelectedAreaId(null);
      setSelectedOpeningId(null);
      setSelectedEaveId(null);
      setSelectedPillarId(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteMarkupItem, isRecoveryPreview, markTakeoffItemCompleted, selectedAreaId, selectedEaveId, selectedFloorplanId, selectedMeasurementId, selectedOpeningId, selectedWallId, selectedPillarId]);

  useEffect(() => {
    if (openingType === 'door') {
      setOpeningHeightMm(2040);
      setOpeningWidthMm(820);
      setSizeCodeInput('2082');
      setOpeningClass('External Door');
    } else {
      setOpeningHeightMm(1800);
      setOpeningWidthMm(1200);
      setSizeCodeInput('1812');
      setOpeningClass('Window');
    }
  }, [openingType]);

  const extractPdfVectors = async (page, viewport) => {
    try {
      const opList = await page.getOperatorList();
      const segments = [];
      let currentPoint = { x: 0, y: 0 };

      for (let i = 0; i < opList.fnArray.length; i++) {
        const fn = opList.fnArray[i];
        const args = opList.argsArray[i];

        if (fn === pdfjsLib.OPS.moveTo) {
          currentPoint = { x: args[0], y: viewport.height - args[1] };
        } else if (fn === pdfjsLib.OPS.lineTo) {
          const nextPoint = { x: args[0], y: viewport.height - args[1] };
          segments.push({ x1: currentPoint.x, y1: currentPoint.y, x2: nextPoint.x, y2: nextPoint.y });
          currentPoint = nextPoint;
        } else if (fn === pdfjsLib.OPS.rectangle) {
          const rx = args[0], ry = args[1], rw = args[2], rh = args[3];
          const p1 = { x: rx, y: viewport.height - ry };
          const p2 = { x: rx + rw, y: viewport.height - ry };
          const p3 = { x: rx + rw, y: viewport.height - (ry + rh) };
          const p4 = { x: rx, y: viewport.height - (ry + rh) };

          segments.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
          segments.push({ x1: p2.x, y1: p2.y, x2: p3.x, y2: p3.y });
          segments.push({ x1: p3.x, y1: p3.y, x2: p4.x, y2: p4.y });
          segments.push({ x1: p4.x, y1: p4.y, x2: p1.x, y2: p1.y });
        }
      }
      return segments;
    } catch (err) {
      console.warn("Vector extraction fallback:", err);
      return [];
    }
  };

  const renderPdfPage = useCallback(async (pdf, pageNumber) => {
    if (!pdf) return;
    logTakeoffRefresh('plan-asset-load-start', { page: pageNumber, source: 'pdf-render' });
    if (renderTaskRef.current) {
      try { await renderTaskRef.current.cancel(); } catch (err) {}
    }

    try {
      const page = await pdf.getPage(pageNumber);
      const baseScale = 6.0;
      const devicePixelRatio = window.devicePixelRatio || 1;
      const totalScale = baseScale * devicePixelRatio;

      const viewport = page.getViewport({ scale: totalScale });
      const unscaledViewport = page.getViewport({ scale: 1.0 });

      const canvas = rawCanvasRef.current;
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';

      const renderTask = page.render({ canvasContext: context, viewport });
      renderTaskRef.current = renderTask;
      await renderTask.promise;

      const segments = await extractPdfVectors(page, unscaledViewport);
      setVectorSegments(segments);

      const img = new window.Image();
      img.src = canvas.toDataURL('image/png');
      img.onload = () => {
        setImage(img);
        logTakeoffRefresh('plan-asset-load-end', { page: pageNumber, source: 'pdf-render' });
      };
    } catch (error) {
      logTakeoffRefresh('plan-asset-load-error', { page: pageNumber, source: 'pdf-render' });
      if (error?.name !== 'RenderingCancelledException') console.error("PDF Render Error:", error);
    }
  }, []);

  const renderPdfPageForJob = async (pdf, pageNumber) => {
    const page = await pdf.getPage(pageNumber);
    const baseScale = 6.0;
    const devicePixelRatio = window.devicePixelRatio || 1;
    const totalScale = baseScale * devicePixelRatio;
    const viewport = page.getViewport({ scale: totalScale });
    const unscaledViewport = page.getViewport({ scale: 1.0 });

    const canvas = rawCanvasRef.current;
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    await page.render({ canvasContext: context, viewport }).promise;
    const vectorSegmentsForPage = await extractPdfVectors(page, unscaledViewport);

    return {
      pageNumber,
      dataUrl: canvas.toDataURL('image/png'),
      width: canvas.width,
      height: canvas.height,
      logicalWidth: unscaledViewport.width,
      logicalHeight: unscaledViewport.height,
      renderScale: totalScale,
      vectorSegments: vectorSegmentsForPage,
      ...await readPdfAnalysisEvidence(page, unscaledViewport)
    };
  };

  useEffect(() => {
    const next = getPlanDisplayIdentity(planPages, currentPage, pdfDoc);
    const previous = displayedPlanRef.current;
    if (previous?.pageNumber === next.pageNumber && previous.asset === next.asset) return;
    displayedPlanRef.current = next;
    if (planPages.length > 0) {
      showPlanPage(planPages, currentPage).catch((error) => {
        if (displayedPlanRef.current === next) displayedPlanRef.current = null;
        console.error('Failed to display takeoff plan:', error);
      });
    } else if (pdfDoc) {
      renderPdfPage(pdfDoc, currentPage);
    }
    // Only a deliberate sheet change ends these sheet-specific drafts. A new
    // metadata object, image decode or effect replay must preserve live points.
    if (previous && previous.pageNumber !== currentPage) {
      setActivePolyline([]);
      setActiveAreaPolyline([]);
      setEavePoints([]);
      setBoxStartPoint(null);
    }
  }, [pdfDoc, planPages, currentPage, renderPdfPage, showPlanPage]);

  useEffect(() => {
    if (image || !planPages.length) return;
    const page = planPages.find((item) => item.pageNumber === currentPage) || planPages[currentPage - 1];
    if (page?.dataUrl) void showPlanPage(planPages, currentPage).catch((error) => {
      console.error('Failed to recover takeoff plan image:', error);
    });
  }, [image, planPages, currentPage, showPlanPage]);

  const handleFileUpload = async (e, options = {}) => {
    const file = e.target.files[0];
    if (!file) return;
    const preserveTakeoffs = Boolean(options.preserveTakeoffs);
    takeoffLifecycle.hydrationVersion += 1;
    takeoffLifecycle.imageRequest = null;

    setPdfEngineError('');

    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;
        const arrayBuffer = await file.arrayBuffer();
        const loadedPdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const embeddedPages = [];
        for (let pageNumber = 1; pageNumber <= loadedPdf.numPages; pageNumber++) {
          embeddedPages.push(await renderPdfPageForJob(loadedPdf, pageNumber));
        }

        sheetViewStateRef.current = {};
        fittedSheetViewKeyRef.current = '';
        setPlanFilename(file.name);
        setProjectInfo((prev) => ({ ...prev, projectName: prev.projectName || jobName || file.name.replace(/\.[^.]+$/, '') }));
        setCalibPoints([]);
        setMeasurePoints([]);
        setEavePoints([]);
        if (!preserveTakeoffs) {
          aiTakeoffBridge.restoreAppliedRuns();
          aiTakeoffAnalysis.restoreReport();
          setCompletedMeasurements([]);
          setCompletedEaves([]);
          setCompletedWallRuns([]);
          setPlacedOpenings([]);
          setCompletedAreas([]);
          setCompletedFloorplans([]);
        }
        setActivePolyline([]);
        setActiveAreaPolyline([]);
        setBoxStartPoint(null);
        setSelectedFloorplanId(null);
        setSelectedWallId(null);
        setSelectedAreaId(null);
        setSelectedOpeningId(null);
        setSelectedEaveId(null);
        setPlanPages(embeddedPages);
        setPdfDoc(null);
        setTotalPages(loadedPdf.numPages);
        setCurrentPage(1);
        setPlanMissingFromSavedJob(false);
        await showPlanPage(embeddedPages, 1);
      } catch (error) {
        console.error('AI Plan Takeoff PDF engine failed:', error);
        setPdfEngineError(PDFJS_INIT_ERROR_MESSAGE);
      } finally {
        e.target.value = '';
      }
      return;
    }

    sheetViewStateRef.current = {};
    fittedSheetViewKeyRef.current = '';
    setPlanFilename(file.name);
    setProjectInfo((prev) => ({ ...prev, projectName: prev.projectName || jobName || file.name.replace(/\.[^.]+$/, '') }));
    setCalibPoints([]);
    setMeasurePoints([]);
    setEavePoints([]);
    if (!preserveTakeoffs) {
      aiTakeoffBridge.restoreAppliedRuns();
      aiTakeoffAnalysis.restoreReport();
      setCompletedMeasurements([]);
      setCompletedEaves([]);
      setCompletedWallRuns([]);
      setPlacedOpenings([]);
      setCompletedAreas([]);
      setCompletedFloorplans([]);
    }
    setActivePolyline([]);
    setActiveAreaPolyline([]);
    setBoxStartPoint(null);
    setSelectedFloorplanId(null);
    setSelectedWallId(null);
    setSelectedAreaId(null);
    setSelectedOpeningId(null);
    setSelectedEaveId(null);
    setPlanPages([]);

    setPdfDoc(null);
    const img = new window.Image();
    logTakeoffRefresh('plan-asset-load-start', { page: 1, source: 'image-upload' });
    img.src = createTakeoffObjectUrl(file, 'plan-upload', logTakeoffRefresh);
    img.onload = () => {
      const canvas = rawCanvasRef.current;
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL('image/png');
      setPlanPages([{
        pageNumber: 1,
        dataUrl,
        width: canvas.width,
        height: canvas.height,
        logicalWidth: canvas.width,
        logicalHeight: canvas.height,
        renderScale: 1,
        vectorSegments: []
      }]);
      setTotalPages(1);
      setCurrentPage(1);
      setPlanMissingFromSavedJob(false);
      setVectorSegments([]);
      setImage(img);
      logTakeoffRefresh('plan-asset-load-end', { page: 1, source: 'image-upload' });
    };
  };

  const getCanvasPointerPos = (event = null) => {
    const stage = stageRef.current;
    if (!stage) return null;
    const nativeEvent = event?.evt || event?.nativeEvent || event;
    if ((Number.isFinite(nativeEvent?.clientX) && Number.isFinite(nativeEvent?.clientY)) || nativeEvent?.touches) {
      // Konva normalizes client pixels against the actual canvas content box,
      // including CSS scaling. Subtracting the host rect alone shrinks nodes.
      stage.setPointersPositions(nativeEvent);
    }
    const point = stage.getPointerPosition();
    if (!point) return null;

    // Remove the complete displayed transform once: Stage zoom/pan plus the
    // plan Layer's rotation/offset. All tools store the same logical plan units.
    const transform = (layerRef.current || stage).getAbsoluteTransform().copy().invert();
    return transform.point(point);
  };

  const scheduleMouseHoverPos = useCallback((nextHoverPos) => {
    pendingMouseHoverRef.current = nextHoverPos;
    if (mouseHoverFrameRef.current) return;
    mouseHoverFrameRef.current = window.requestAnimationFrame(() => {
      mouseHoverFrameRef.current = null;
      setMouseHoverPos(pendingMouseHoverRef.current);
    });
  }, []);

  useEffect(() => () => {
    if (mouseHoverFrameRef.current) window.cancelAnimationFrame(mouseHoverFrameRef.current);
  }, []);

  const rememberCurrentSheetView = useCallback((view = null) => {
    const stage = stageRef.current;
    const nextView = view || {
      scale: Number(stage?.scaleX?.() || stageScale || 1),
      pos: {
        x: Number(stage?.x?.() ?? stagePos.x ?? 0),
        y: Number(stage?.y?.() ?? stagePos.y ?? 0)
      }
    };
    sheetViewStateRef.current[currentPage] = nextView;
  }, [currentPage, stagePos.x, stagePos.y, stageScale]);

  const goToSheet = useCallback((nextPageOrUpdater) => {
    rememberCurrentSheetView();
    setCurrentPage((current) => {
      const rawNext = typeof nextPageOrUpdater === 'function' ? nextPageOrUpdater(current) : nextPageOrUpdater;
      return Math.min(Math.max(Number(rawNext) || current, 1), totalPages || 1);
    });
  }, [rememberCurrentSheetView, totalPages]);

  const getStrictWallSnapPoint = (rawX, rawY) => {
    const nodeSnapRadius = SNAP_RADIUS_SCREEN_PX / stageScale;
    let bestSnap = null;
    let minDistance = nodeSnapRadius;

    for (let seg of vectorSegments) {
      const d1 = Math.hypot(seg.x1 - rawX, seg.y1 - rawY);
      if (d1 < minDistance) {
        minDistance = d1;
        bestSnap = { x: seg.x1, y: seg.y1, snapped: true, nearestSegment: seg };
      }
      const d2 = Math.hypot(seg.x2 - rawX, seg.y2 - rawY);
      if (d2 < minDistance) {
        minDistance = d2;
        bestSnap = { x: seg.x2, y: seg.y2, snapped: true, nearestSegment: seg };
      }

      const dx = seg.x2 - seg.x1;
      const dy = seg.y2 - seg.y1;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) continue;

      let t = ((rawX - seg.x1) * dx + (rawY - seg.y1) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      const projX = seg.x1 + t * dx;
      const projY = seg.y1 + t * dy;
      const dProj = Math.hypot(projX - rawX, projY - rawY);

      if (dProj < minDistance) {
        minDistance = dProj;
        bestSnap = { x: projX, y: projY, snapped: true, nearestSegment: seg };
      }
    }

    if (!bestSnap) {
      return { x: rawX, y: rawY, snapped: false, nearestSegment: null };
    }

    return bestSnap;
  };

  const getGeneralSnapPoint = (rawX, rawY) => {
    const snap = getStrictWallSnapPoint(rawX, rawY);
    if (snap) return snap;
    return { x: rawX, y: rawY, snapped: false, nearestSegment: null };
  };

  const getFloorplanCornerSnapPoint = (rawX, rawY) => {
    return findFloorplanCornerSnapPoint(vectorSegments, { x: rawX, y: rawY }, SNAP_RADIUS_SCREEN_PX / stageScale);
  };

  const autoDetectWallThickness = (clickX, clickY, nearestSegment) => {
    if (!autoDetectWallThickness_Enabled) return;
    if (!nearestSegment || !pixelsPerMm) return;

    const dx = nearestSegment.x2 - nearestSegment.x1;
    const dy = nearestSegment.y2 - nearestSegment.y1;
    const len = Math.hypot(dx, dy);
    if (len === 0) return;

    let minThicknessPx = Infinity;

    for (let seg of vectorSegments) {
      if (seg === nearestSegment) continue;

      const segDx = seg.x2 - seg.x1;
      const segDy = seg.y2 - seg.y1;
      const segLen = Math.hypot(segDx, segDy);
      if (segLen === 0) continue;

      const dot = Math.abs((dx * segDx + dy * segDy) / (len * segLen));
      if (dot > 0.95) {
        const dist = Math.abs((seg.x2 - seg.x1) * (seg.y1 - clickY) - (seg.x1 - clickX) * (seg.y2 - seg.y1)) / segLen;
        if (dist > 30 * pixelsPerMm && dist < 400 * pixelsPerMm && dist < minThicknessPx) {
          minThicknessPx = dist;
        }
      }
    }

    if (minThicknessPx !== Infinity) {
      const calculatedMm = Math.round(minThicknessPx / pixelsPerMm);
      if (calculatedMm >= 70 && calculatedMm <= 350) {
        setDetectedWallThicknessMm(snapToStandardThickness(calculatedMm));
      }
    }
  };

  const getNetFloorcoveringAreaM2 = (areaItem, scalePxPerMm) => {
    const baseArea = calculatePolygonAreaM2(areaItem.nodes, scalePxPerMm);
    const exclusionAreaTotal = (areaItem.exclusions || []).reduce((sum, excl) => {
      return sum + calculatePolygonAreaM2(excl.nodes, scalePxPerMm);
    }, 0);
    return Math.max(0, baseArea - exclusionAreaTotal);
  };

  const nearestPointOnNodes = (nodes = [], rawX = 0, rawY = 0) => {
    let best = null;
    let minDistance = Infinity;
    for (let index = 0; index < nodes.length - 1; index += 1) {
      const a = nodes[index];
      const b = nodes[index + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const lenSq = dx * dx + dy * dy;
      if (!lenSq) continue;
      const t = Math.max(0, Math.min(1, ((rawX - a.x) * dx + (rawY - a.y) * dy) / lenSq));
      const x = a.x + t * dx;
      const y = a.y + t * dy;
      const distance = Math.hypot(x - rawX, y - rawY);
      if (distance < minDistance) {
        minDistance = distance;
        best = { x, y, nearestSegment: { x1: a.x, y1: a.y, x2: b.x, y2: b.y }, snapped: true };
      }
    }
    return best;
  };

  const nearestWallSnapOnPage = (rawX = 0, rawY = 0, page = currentPage) => {
    let best = null;
    let bestDist = Infinity;
    activePageWalls.forEach((wall) => {
      const snap = nearestPointOnNodes(wall.nodes || [], rawX, rawY);
      if (!snap) return;
      const dist = Math.hypot(snap.x - rawX, snap.y - rawY);
      if (dist < bestDist) {
        best = { ...snap, wallId: wall.id, page };
        bestDist = dist;
      }
    });
    return best;
  };

  const handleStageClick = (e) => {
    if (suppressNextStageClickRef.current) {
      suppressNextStageClickRef.current = false;
      return;
    }
    if (draggingVertex || draggingItem || draggingMeasureId || draggingEaveId) return;
    const pos = getCanvasPointerPos(e);
    if (!pos) return;
    if (typeof window !== 'undefined') {
      window.__gr8LastAiPlanTakeoffClick = { activeTool, page: currentPage, x: pos.x, y: pos.y, at: new Date().toISOString() };
    }
    const shiftKey = !!e?.evt?.shiftKey;

    if (calibrationMode) {
      const snap = getGeneralSnapPoint(pos.x, pos.y);

      if (calibPoints.length === 0) {
        setCalibPoints([{ x: snap.x, y: snap.y }]);
      } else if (calibPoints.length === 1) {
        const firstPt = calibPoints[0];
        const dx = Math.abs(snap.x - firstPt.x);
        const dy = Math.abs(snap.y - firstPt.y);

        let lockedSecondPoint = dx >= dy ? { x: snap.x, y: firstPt.y } : { x: firstPt.x, y: snap.y };
        const distPx = Math.hypot(lockedSecondPoint.x - firstPt.x, lockedSecondPoint.y - firstPt.y);

        setCalibPoints([firstPt, lockedSecondPoint]);

        setTimeout(() => {
          const realMm = prompt("Enter known dimension in millimeters (e.g. 5000 for 5m):", "5000");
          if (realMm && parseFloat(realMm) > 0) {
            const ratio = distPx / parseFloat(realMm);
            setPixelsPerMm(ratio);
            // Remember which sheet this calibration was measured on; AI Takeoff treats it as authoritative.
            aiTakeoffAnalysis.recordSheetCalibration(currentPage, ratio);
            markTakeoffItemCompleted('calibration');
            alert(`Scale calibrated: ${ratio.toFixed(4)} px/mm`);
          }
          setCalibrationMode(false);
          setCalibPoints([]);
        }, 50);
      }
      return;
    }

    if (activeTool === 'measure') {
      const snap = getGeneralSnapPoint(pos.x, pos.y);
      if (measurePoints.length === 0) {
        setMeasurePoints([{ x: snap.x, y: snap.y }]);
      } else {
        const firstPt = measurePoints[0];
        const dx = Math.abs(snap.x - firstPt.x);
        const dy = Math.abs(snap.y - firstPt.y);
        let lockedSecondPoint = dx >= dy ? { x: snap.x, y: firstPt.y } : { x: firstPt.x, y: snap.y };

        const newMeasurement = {
          id: Date.now() + Math.random(),
          page: currentPage,
          p1: firstPt,
          p2: lockedSecondPoint,
          offset: { x: 0, y: 0 }
        };

        setCompletedMeasurements((prev) => [...prev, newMeasurement]);
        setMeasurePoints([]);
        markTakeoffItemCompleted('measurement');
      }
      return;
    }

    if (!pixelsPerMm) {
      alert("Please calibrate the plan scale in millimeters (mm) first!");
      return;
    }

    if (activeTool === 'wall') {
      const snap = getStrictWallSnapPoint(pos.x, pos.y);
      let pX = snap.x;
      let pY = snap.y;
      if (snap.nearestSegment) {
        autoDetectWallThickness(pX, pY, snap.nearestSegment);
      }
      setActivePolyline((prev) => [...prev, { x: pX, y: pY }]);
    } else if (activeTool === 'eaves') {
      const snap = getStrictWallSnapPoint(pos.x, pos.y);
      let pX = snap.x;
      let pY = snap.y;
      setEavePoints((prev) => [...prev, { x: pX, y: pY }]);
    } else if (activeTool === 'opening') {
      const targetWall = completedWallRuns.find((wall) => wall.id === selectedWallId && Number(wall.page || 1) === Number(currentPage));
      const wallSnap = targetWall ? nearestPointOnNodes(targetWall.nodes || [], pos.x, pos.y) : nearestWallSnapOnPage(pos.x, pos.y, currentPage);
      const snap = wallSnap || getGeneralSnapPoint(pos.x, pos.y);

      const hDec = Math.round(openingHeightMm / 100);
      const wDec = Math.round(openingWidthMm / 100);
      const sizeCode = sizeCodeInput || `${hDec}${wDec}`;

      let typeCode = '';
      if (openingType === 'window') {
        if (windowSubtype === 'standard') {
          typeCode = '';
        } else if (windowSubtype === 'GSD') {
          typeCode = 'GSD';
        } else if (windowSubtype === 'CO') {
          typeCode = 'CO';
        } else if (windowSubtype === 'Stacker') {
          typeCode = 'STACKER';
        } else {
          typeCode = windowSubtype;
        }
      } else {
        typeCode = doorSubtype.toUpperCase();
      }

      const obsCode = glassType === 'Obscured' ? 'OBS' : '';
      
      const tagPrefix = openingType === 'window' ? 'W' : 'D';
      const existingCountForPage = placedOpenings.filter((o) => o.page === currentPage && o.type === openingType).length;
      const itemNumber = existingCountForPage + 1;
      const autoLabel = `${tagPrefix}${itemNumber}: ${sizeCode}${typeCode ? '-' + typeCode : ''}${obsCode ? '-' + obsCode : ''}`;

      const newOpening = {
        id: Date.now() + Math.random(),
        page: currentPage,
        type: openingType,
        openingClass,
        itemTag: autoLabel,
        heightMm: openingHeightMm,
        widthMm: openingWidthMm,
        subType: openingType === 'window' ? windowSubtype : doorSubtype,
        glassType: glassType,
        hostWallId: targetWall?.id || wallSnap?.wallId || '',
        frameMaterial: '',
        frameColour: '',
        sillType: '',
        brickSillRequired: false,
        location: '',
        frameJambDetails: '',
        roomKey: '',
        roomLabel: '',
        x: snap.x,
        y: snap.y
      };

      setPlacedOpenings((prev) => [...prev, newOpening]);
      // The opening editor must appear immediately against this same canonical opening - no
      // Select tool, no re-click - exactly like a freshly drawn wall auto-selects itself.
      selectOnly('opening', newOpening.id);
      markTakeoffItemCompleted(openingType);
    } else if (activeTool === 'floorplan') {
      const snap = getFloorplanCornerSnapPoint(pos.x, pos.y);
      if (activeAreaPolyline.length >= 3 && Math.hypot(snap.x - activeAreaPolyline[0].x, snap.y - activeAreaPolyline[0].y) <= 12 / stageScale) {
        finalizeCurrentArea();
        return;
      }

      const previousPoint = activeAreaPolyline[activeAreaPolyline.length - 1];
      const nextPoint = resolveFloorplanFreePoint(pos, previousPoint, shiftKey);
      setActiveAreaPolyline((prev) => [...prev, nextPoint]);
    } else if (activeTool === 'floorcoverings' || activeTool === 'roofarea') {
      const snap = getGeneralSnapPoint(pos.x, pos.y);

      if (activeTool === 'roofarea') {
        if (activeAreaPolyline.length >= 3 && Math.hypot(snap.x - activeAreaPolyline[0].x, snap.y - activeAreaPolyline[0].y) <= 12 / stageScale) {
          finalizeCurrentArea();
          return;
        }
        setActiveAreaPolyline((prev) => [...prev, { x: snap.x, y: snap.y }]);
      } else if (areaDrawMode === 'box') {
        if (!boxStartPoint) {
          setBoxStartPoint({ x: snap.x, y: snap.y });
        } else {
          const p1 = boxStartPoint;
          const p2 = { x: snap.x, y: snap.y };

          const boxNodes = [
            { x: p1.x, y: p1.y },
            { x: p2.x, y: p1.y },
            { x: p2.x, y: p2.y },
            { x: p1.x, y: p2.y }
          ];

          const newCovering = {
            id: Date.now() + Math.random(),
            page: currentPage,
            category: floorcoveringOption,
            nodes: boxNodes,
            exclusions: []
          };

          setCompletedAreas((prev) => [...prev, newCovering]);
          setSelectedAreaId(newCovering.id);
          setBoxStartPoint(null);
          markTakeoffItemCompleted('floorcovering-box');
        }
      } else if (areaDrawMode === 'exclusion') {
        if (!selectedAreaForExclusion) {
          alert("Click an existing floorcovering area to select it before punching out an exclusion boundary!");
          return;
        }
        // Free movement without axis locking for areas/exclusions
        setActiveAreaPolyline((prev) => [...prev, { x: snap.x, y: snap.y }]);
      } else {
        // Free movement without axis locking for areas
        setActiveAreaPolyline((prev) => [...prev, { x: snap.x, y: snap.y }]);
      }
    } else if (activeTool === 'pillar') {
      // Same click-click rectangle gesture the floorcoverings box mode already uses: first click
      // sets one corner, second click sets the opposite corner and finalises. A discrete vertical
      // object, never a wall - its own tool, own array, own canonical fields.
      const snap = getGeneralSnapPoint(pos.x, pos.y);
      if (!boxStartPoint) {
        setBoxStartPoint({ x: snap.x, y: snap.y });
        return;
      }
      const p1 = boxStartPoint;
      const p2 = { x: snap.x, y: snap.y };
      const widthPx = Math.abs(p2.x - p1.x);
      const depthPx = Math.abs(p2.y - p1.y);
      if (widthPx < 2 || depthPx < 2) { setBoxStartPoint(null); return; }
      const boxNodes = [
        { x: p1.x, y: p1.y },
        { x: p2.x, y: p1.y },
        { x: p2.x, y: p2.y },
        { x: p1.x, y: p2.y },
      ];
      // The drawn box is the FINISHED/visible footprint - the surround's outer face when a surround
      // exists, or the core itself when it does not (surroundType defaults to 'none' here, so
      // coreWidthMm/coreDepthMm start equal to the drawn box; adding a surround later leaves these
      // as the correct core dimensions and the drawn box becomes the surround's own footprint).
      const widthMm = pixelsPerMm ? Math.round(widthPx / pixelsPerMm) : null;
      const depthMm = pixelsPerMm ? Math.round(depthPx / pixelsPerMm) : null;
      const newPillar = {
        id: Date.now() + Math.random(),
        page: currentPage,
        level: levelForPage(currentPage) || 'Unassigned',
        nodes: boxNodes,
        coreType: 'unclassified',
        coreWidthMm: widthMm,
        coreDepthMm: depthMm,
        surroundType: 'none',
        heightMm: null,
        quantity: 1,
        roomKey: '', roomLabel: '', location: '',
      };
      setCompletedPillars((prev) => [...prev, newPillar]);
      selectOnly('pillar', newPillar.id);
      setBoxStartPoint(null);
      markTakeoffItemCompleted('pillar-box');
    }
  };

  const handleDrawableSurfaceClick = (e) => {
    e.cancelBubble = true;
    handleStageClick(e);
  };

  const handleDrawableSurfaceDblClick = (e) => {
    e.cancelBubble = true;
    if (activeTool === 'wall') finalizeCurrentWallRun();
    else if (activeTool === 'eaves') finalizeCurrentEaveRun();
    else if (activeTool === 'floorplan' || activeTool === 'floorcoverings' || activeTool === 'roofarea') finalizeCurrentArea();
  };

  const finalizeCurrentArea = () => {
    if (activeAreaPolyline.length < 3 || !pixelsPerMm) {
      setActiveAreaPolyline([]);
      return;
    }

    if (activeTool === 'floorplan') {
      const conf = FLOORPLAN_TYPES.find(f => f.id === floorplanType) || FLOORPLAN_TYPES[0];
      const newFloorplan = {
        id: Date.now() + Math.random(),
        page: currentPage,
        type: floorplanType,
        label: conf.label,
        color: conf.color,
        stroke: conf.stroke,
        nodes: [...activeAreaPolyline]
      };
      setCompletedFloorplans((prev) => [...prev, newFloorplan]);
      setSelectedFloorplanId(newFloorplan.id);
      setActiveAreaPolyline([]);
      markTakeoffItemCompleted('floorplan-area');
      return;
    }

    if (activeTool === 'roofarea') {
      const roofArea = {
        id: `roof-area-${Date.now()}`,
        page: currentPage,
        category: 'Roof Area',
        level: roofAreaLevel,
        nodes: [...activeAreaPolyline],
        exclusions: [],
      };
      setCompletedAreas((prev) => [...prev, roofArea]);
      setSelectedAreaId(roofArea.id);
      setActiveAreaPolyline([]);
      markTakeoffItemCompleted('roof-area');
      return;
    }

    if (areaDrawMode === 'exclusion' && selectedAreaForExclusion) {
      setCompletedAreas((prev) => prev.map((area) => {
        if (area.id === selectedAreaForExclusion) {
          return {
            ...area,
            exclusions: [...(area.exclusions || []), { id: Date.now(), nodes: [...activeAreaPolyline] }]
          };
        }
        return area;
      }));
      setActiveAreaPolyline([]);
      markTakeoffItemCompleted('floorcovering-exclusion');
    } else {
      const newCovering = {
        id: Date.now() + Math.random(),
        page: currentPage,
        category: floorcoveringOption,
        nodes: [...activeAreaPolyline],
        exclusions: []
      };

      setCompletedAreas((prev) => [...prev, newCovering]);
      setSelectedAreaId(newCovering.id);
      setActiveAreaPolyline([]);
      markTakeoffItemCompleted('floorcovering-area');
    }
  };

  const handleMouseMove = (e) => {
    if (stageContentPanRef.current?.active) return;
    if (stageRef.current?.isDragging?.()) return;
    const pos = getCanvasPointerPos(e);
    if (!pos) return;
    const shiftKey = !!e?.evt?.shiftKey;

    if (draggingMeasureId || draggingEaveId) {
      const updateOffsetLine = (m) => {
        if (m.id === draggingMeasureId || m.id === draggingEaveId) {
          const midX = (m.p1.x + m.p2.x) / 2;
          const midY = (m.p1.y + m.p2.y) / 2;
          const dx = pos.x - midX;
          const dy = pos.y - midY;
          
          const lineDx = m.p2.x - m.p1.x;
          const lineDy = m.p2.y - m.p1.y;
          const isHorizontal = Math.abs(lineDx) >= Math.abs(lineDy);
          
          const constrainedOffset = isHorizontal ? { x: 0, y: dy } : { x: dx, y: 0 };

          return {
            ...m,
            offset: constrainedOffset
          };
        }
        return m;
      };

      if (draggingMeasureId) {
        setCompletedMeasurements((prev) => prev.map(updateOffsetLine));
      } else {
        setCompletedEaves((prev) => prev.map(updateOffsetLine));
      }
      return;
    }

    if (draggingItem) {
      const { type, id } = draggingItem;
      if (type === 'opening') {
        setPlacedOpenings((prev) => prev.map((op) => {
          if (op.id === id) {
            const hostWall = activePageWalls.find((wall) => wall.id === op.hostWallId);
            const constrained = hostWall ? nearestPointOnNodes(hostWall.nodes || [], pos.x, pos.y) : nearestWallSnapOnPage(pos.x, pos.y, op.page || currentPage);
            return { ...op, x: constrained?.x ?? pos.x, y: constrained?.y ?? pos.y, hostWallId: constrained?.wallId || op.hostWallId || '' };
          }
          return op;
        }));
        pointerEditInProgressRef.current = true;
      }
      return;
    }

    if (draggingVertex) {
      const snap = getGeneralSnapPoint(pos.x, pos.y);
      const { type, id, vertexIndex } = draggingVertex;

      if (type === 'floorplan') {
        setCompletedFloorplans((prev) => prev.map((fp) => {
          if (fp.id === id) {
            const updatedNodes = [...fp.nodes];
            updatedNodes[vertexIndex] = { x: pos.x, y: pos.y };
            return { ...fp, nodes: updatedNodes };
          }
          return fp;
        }));
        pointerEditInProgressRef.current = true;
      } else if (type === 'area') {
        setCompletedAreas((prev) => prev.map((area) => {
          if (area.id === id) {
            const updatedNodes = [...area.nodes];
            updatedNodes[vertexIndex] = { x: snap.x, y: snap.y };
            return { ...area, nodes: updatedNodes };
          }
          return area;
        }));
        pointerEditInProgressRef.current = true;
      } else if (type === 'wall') {
        setCompletedWallRuns((prev) => prev.map((wall) => {
          if (wall.id === id) {
            const updatedNodes = [...wall.nodes];
            updatedNodes[vertexIndex] = { x: snap.x, y: snap.y };
            const lengthMm = getWallRunLengthMm(updatedNodes, pixelsPerMm);
            return { ...wall, nodes: updatedNodes, lengthMm };
          }
          return wall;
        }));
        pointerEditInProgressRef.current = true;
      } else if (type === 'eaves') {
        setCompletedEaves((prev) => prev.map((eave) => {
          if (eave.id === id) {
            const updatedNodes = [...getEaveNodes(eave)];
            updatedNodes[vertexIndex] = { x: snap.x, y: snap.y };
            const lengthMm = getWallRunLengthMm(updatedNodes, pixelsPerMm);
            return { ...eave, nodes: updatedNodes, lengthMm };
          }
          return eave;
        }));
        pointerEditInProgressRef.current = true;
      }
      return;
    }

    let snap = activeTool === 'wall' || activeTool === 'eaves'
      ? getStrictWallSnapPoint(pos.x, pos.y)
      : activeTool === 'floorplan'
        ? getFloorplanCornerSnapPoint(pos.x, pos.y)
        : getGeneralSnapPoint(pos.x, pos.y);
    if (!snap) snap = { x: pos.x, y: pos.y, snapped: false, nearestSegment: null };

    if (calibrationMode && calibPoints.length === 1) {
      const firstPt = calibPoints[0];
      const dx = Math.abs(snap.x - firstPt.x);
      const dy = Math.abs(snap.y - firstPt.y);

      if (dx >= dy) {
        scheduleMouseHoverPos({ x: snap.x, y: firstPt.y, snapped: snap.snapped });
      } else {
        scheduleMouseHoverPos({ x: firstPt.x, y: snap.y, snapped: snap.snapped });
      }
    } else if (activeTool === 'measure' && measurePoints.length === 1) {
      const firstPt = measurePoints[0];
      const dx = Math.abs(snap.x - firstPt.x);
      const dy = Math.abs(snap.y - firstPt.y);
      if (dx >= dy) {
        scheduleMouseHoverPos({ x: snap.x, y: firstPt.y, snapped: snap.snapped });
      } else {
        scheduleMouseHoverPos({ x: firstPt.x, y: snap.y, snapped: snap.snapped });
      }
    } else if (activeTool === 'eaves' && eavePoints.length > 0) {
      scheduleMouseHoverPos({ x: snap.x, y: snap.y, snapped: snap.snapped });
    } else if (activeTool === 'wall' && activePolyline.length > 0) {
      scheduleMouseHoverPos({ x: snap.x, y: snap.y, snapped: snap.snapped });
    } else if (activeTool === 'floorplan' && activeAreaPolyline.length > 0) {
      const previousPoint = activeAreaPolyline[activeAreaPolyline.length - 1];
      const nextPoint = resolveFloorplanFreePoint(pos, previousPoint, shiftKey);
      scheduleMouseHoverPos({ ...nextPoint, snapped: false });
    } else if (activeTool === 'floorcoverings' && activeAreaPolyline.length > 0) {
      // Free movement without axis locking for area preview
      scheduleMouseHoverPos({ x: snap.x, y: snap.y, snapped: snap.snapped });
    } else {
      scheduleMouseHoverPos({ x: snap.x, y: snap.y, snapped: snap.snapped });
    }
  };

  const handleMouseUp = () => {
    const completedDragEdit = Boolean(draggingVertex || draggingItem || draggingMeasureId || draggingEaveId);
    setDraggingVertex(null);
    setDraggingItem(null);
    setDraggingMeasureId(null);
    setDraggingEaveId(null);
    if (completedDragEdit && pointerEditInProgressRef.current) {
      pointerEditInProgressRef.current = false;
      markTakeoffItemCompleted('edit-completed');
      const dragChecksum = String(pendingDragChecksumRef.current || '').trim();
      if (dragChecksum) {
        pendingDragChecksumRef.current = '';
        lastSeenContentChecksumRef.current = dragChecksum;
        contentEditVersionRef.current += 1;
        setAutosaveRequest({
          reason: 'drag-edit-completed',
          requestedAt: Date.now(),
          checksum: dragChecksum,
          editVersion: contentEditVersionRef.current,
        });
      }
    }
  };

  const addVertexToPolygon = (type, id, vertexIndex) => {
    if (type === 'floorplan') {
      setCompletedFloorplans((prev) => prev.map((fp) => {
        if (fp.id === id) {
          const nodes = [...fp.nodes];
          const p1 = nodes[vertexIndex];
          const p2 = nodes[(vertexIndex + 1) % nodes.length];
          const midPoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
          nodes.splice(vertexIndex + 1, 0, midPoint);
          return { ...fp, nodes };
        }
        return fp;
      }));
    } else if (type === 'area') {
      setCompletedAreas((prev) => prev.map((area) => {
        if (area.id === id) {
          const nodes = [...area.nodes];
          const p1 = nodes[vertexIndex];
          const p2 = nodes[(vertexIndex + 1) % nodes.length];
          const midPoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
          nodes.splice(vertexIndex + 1, 0, midPoint);
          return { ...area, nodes };
        }
        return area;
      }));
    } else if (type === 'wall') {
      setCompletedWallRuns((prev) => prev.map((wall) => {
        if (wall.id === id) {
          const nodes = [...wall.nodes];
          if (vertexIndex < nodes.length - 1) {
            const p1 = nodes[vertexIndex];
            const p2 = nodes[vertexIndex + 1];
            const midPoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
            nodes.splice(vertexIndex + 1, 0, midPoint);
            const lengthMm = getWallRunLengthMm(nodes, pixelsPerMm);
            return { ...wall, nodes, lengthMm };
          }
        }
        return wall;
      }));
    } else if (type === 'eaves') {
      setCompletedEaves((prev) => prev.map((eave) => {
        if (eave.id === id) {
          const nodes = [...getEaveNodes(eave)];
          if (vertexIndex < nodes.length - 1) {
            const p1 = nodes[vertexIndex];
            const p2 = nodes[vertexIndex + 1];
            const midPoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
            nodes.splice(vertexIndex + 1, 0, midPoint);
            const lengthMm = getWallRunLengthMm(nodes, pixelsPerMm);
            return { ...eave, nodes, lengthMm };
          }
        }
        return eave;
      }));
    }
  };

  const deleteVertexFromPolygon = (type, id, vertexIndex) => {
    if (type === 'floorplan') {
      setCompletedFloorplans((prev) => prev.map((fp) => {
        if (fp.id === id && fp.nodes.length > 3) {
          const nodes = fp.nodes.filter((_, idx) => idx !== vertexIndex);
          return { ...fp, nodes };
        }
        return fp;
      }));
    } else if (type === 'area') {
      setCompletedAreas((prev) => prev.map((area) => {
        if (area.id === id && area.nodes.length > 3) {
          const nodes = area.nodes.filter((_, idx) => idx !== vertexIndex);
          return { ...area, nodes };
        }
        return area;
      }));
    } else if (type === 'wall') {
      setCompletedWallRuns((prev) => prev.map((wall) => {
        if (wall.id === id && wall.nodes.length > 2) {
          const nodes = wall.nodes.filter((_, idx) => idx !== vertexIndex);
          const lengthMm = getWallRunLengthMm(nodes, pixelsPerMm);
          return { ...wall, nodes, lengthMm };
        }
        return wall;
      }));
    } else if (type === 'eaves') {
      setCompletedEaves((prev) => prev.map((eave) => {
        const nodes = getEaveNodes(eave);
        if (eave.id === id && nodes.length > 2) {
          const updatedNodes = nodes.filter((_, idx) => idx !== vertexIndex);
          const lengthMm = getWallRunLengthMm(updatedNodes, pixelsPerMm);
          return { ...eave, nodes: updatedNodes, lengthMm };
        }
        return eave;
      }));
    }
  };

  const updateFloorplanType = (fpId, newTypeId) => {
    const conf = FLOORPLAN_TYPES.find(f => f.id === newTypeId) || FLOORPLAN_TYPES[0];
    setCompletedFloorplans((prev) => prev.map((fp) => {
      if (fp.id === fpId) {
        return {
          ...fp,
          type: newTypeId,
          label: conf.label,
          color: conf.color,
          stroke: conf.stroke
        };
      }
      return fp;
    }));
  };

  const updateWallRun = (wallId, changes) => {
    setCompletedWallRuns((prev) => prev.map((wall) => (
      wall.id === wallId ? { ...wall, ...changes } : wall
    )));
  };

  const commitWallVertexDrag = (wallId, vertexIndex, event) => {
    const position = event.target.position();
    setCompletedWallRuns((prev) => prev.map((wall) => {
      if (wall.id !== wallId) return wall;
      const nodes = [...wall.nodes];
      nodes[vertexIndex] = { x: position.x, y: position.y };
      return { ...wall, nodes, lengthMm: getWallRunLengthMm(nodes, pixelsPerMm) };
    }));
    pointerEditInProgressRef.current = true;
    handleMouseUp();
  };

  const updateWallRunCategory = (wallId, category) => {
    setCompletedWallRuns((prev) => prev.map((wall) => {
      if (wall.id !== wallId) return wall;

      const previousDefaultThickness = getDefaultWallThickness(wall.category);
      const nextDefaultThickness = getDefaultWallThickness(category);
      const thicknessMm = wall.thicknessMm === previousDefaultThickness
        ? nextDefaultThickness
        : wall.thicknessMm;

      return { ...wall, category, thicknessMm };
    }));
  };

  function deleteMarkupItem(type, id) {
    if (isRecoveryPreview) return;
    if (type === 'wall') {
      setCompletedWallRuns((prev) => prev.filter((w) => w.id !== id));
      if (selectedWallId === id) setSelectedWallId(null);
    }
    if (type === 'area') {
      setCompletedAreas((prev) => prev.filter((a) => a.id !== id));
      if (selectedAreaId === id) setSelectedAreaId(null);
    }
    if (type === 'opening') {
      setPlacedOpenings((prev) => prev.filter((o) => o.id !== id));
      if (selectedOpeningId === id) setSelectedOpeningId(null);
    }
    if (type === 'floorplan') {
      setCompletedFloorplans((prev) => prev.filter((f) => f.id !== id));
      if (selectedFloorplanId === id) setSelectedFloorplanId(null);
    }
    if (type === 'measure') {
      setCompletedMeasurements((prev) => prev.filter((m) => m.id !== id));
      if (selectedMeasurementId === id) setSelectedMeasurementId(null);
    }
    if (type === 'eaves') {
      setCompletedEaves((prev) => prev.filter((e) => e.id !== id));
      if (selectedEaveId === id) setSelectedEaveId(null);
    }
    if (type === 'pillar') {
      setCompletedPillars((prev) => prev.filter((p) => p.id !== id));
      if (selectedPillarId === id) setSelectedPillarId(null);
    }
  }

  const levelForPage = useCallback((page) => {
    const assigned = normaliseLevel(sheetLevels?.[Number(page)]);
    return assigned !== 'Unassigned' ? assigned : '';
  }, [sheetLevels]);
  const currentSheetLevel = levelForPage(currentPage);
  const unassignedSheetsWithMeasurements = React.useMemo(() => {
    const pagesWithWork = new Set();
    [completedWallRuns, completedFloorplans, completedAreas, completedPillars].forEach((collection) => {
      (collection || []).forEach((item) => pagesWithWork.add(Number(item.page || item.pageId || 1)));
    });
    return [...pagesWithWork]
      .filter((page) => page !== Number(currentPage) && !levelForPage(page))
      .sort((a, b) => a - b);
  }, [completedWallRuns, completedFloorplans, completedAreas, completedPillars, currentPage, levelForPage]);

  const activePageWalls = React.useMemo(() => completedWallRuns.filter((w) => Number(w.page || w.pageId || 1) === Number(currentPage)), [completedWallRuns, currentPage]);
  const activePageAreas = React.useMemo(() => completedAreas.filter((a) => Number(a.page || a.pageId || 1) === Number(currentPage)), [completedAreas, currentPage]);
  const activePageOpenings = React.useMemo(() => placedOpenings.filter((o) => Number(o.page || o.pageId || 1) === Number(currentPage)), [placedOpenings, currentPage]);
  const activePageFloorplans = React.useMemo(() => completedFloorplans.filter((f) => Number(f.page || f.pageId || 1) === Number(currentPage)), [completedFloorplans, currentPage]);
  const activePageMeasurements = React.useMemo(() => completedMeasurements.filter((m) => Number(m.page || m.pageId || 1) === Number(currentPage)), [completedMeasurements, currentPage]);
  const activePageEaves = React.useMemo(() => completedEaves.filter((e) => Number(e.page || e.pageId || 1) === Number(currentPage)), [completedEaves, currentPage]);
  const activePagePillars = React.useMemo(() => completedPillars.filter((p) => Number(p.page || p.pageId || 1) === Number(currentPage)), [completedPillars, currentPage]);

  const pageFootprintArea = activePageFloorplans
    .filter((f) => f.type === 'Footprint')
    .reduce((sum, f) => sum + calculatePolygonAreaM2(f.nodes, pixelsPerMm), 0);

  const pageDeductionsArea = activePageFloorplans
    .filter((f) => f.type !== 'Footprint')
    .reduce((sum, f) => sum + calculatePolygonAreaM2(f.nodes, pixelsPerMm), 0);

  const pageTotalLivingArea = Math.max(0, pageFootprintArea - pageDeductionsArea);

  const totalOpeningsWidthMm = activePageOpenings.reduce((sum, item) => sum + item.widthMm, 0);
  const rawExteriorWallLengthMm = activePageWalls.filter((w) => w.category === 'exterior').reduce((sum, w) => sum + w.lengthMm, 0);
  const rawInteriorWallLengthMm = activePageWalls.filter((w) => w.category === 'interior').reduce((sum, w) => sum + w.lengthMm, 0);
  const netExteriorWallLengthMm = Math.max(0, rawExteriorWallLengthMm - totalOpeningsWidthMm);

  const pageFloorcoveringTotals = FLOORCOVERING_OPTIONS.reduce((acc, cat) => {
    acc[cat] = activePageAreas
      .filter((a) => a.category === cat)
      .reduce((sum, a) => sum + getNetFloorcoveringAreaM2(a, pixelsPerMm), 0);
    return acc;
  }, {});

  const totalFloorAreaM2 = Object.values(pageFloorcoveringTotals).reduce((a, b) => a + b, 0);

  const pageEaveTotals = EAVE_LEVEL_OPTIONS.reduce((acc, level) => {
    acc[level] = EAVE_WIDTH_OPTIONS.reduce((widthAcc, widthOption) => {
      widthAcc[widthOption] = activePageEaves
        .filter((eave) => resolveTakeoffLevel(eave, sheetLevels) === level && String(eave.widthOption) === widthOption)
        .reduce((sum, eave) => sum + getEaveLengthMm(eave, pixelsPerMm), 0);
      return widthAcc;
    }, {});
    return acc;
  }, {});
  const totalEavesLengthMm = activePageEaves.reduce((sum, eave) => sum + getEaveLengthMm(eave, pixelsPerMm), 0);
  const exteriorWallClassificationTotals = useMemo(
    () => createExteriorClassificationTotals(completedWallRuns, pixelsPerMm, sheetLevels),
    [completedWallRuns, pixelsPerMm, sheetLevels]
  );

  const baseScale = 6.0;
  const dpr = window.devicePixelRatio || 1;
  const currentPlanPage = planPages.find((p) => p.pageNumber === currentPage) || planPages[currentPage - 1];
  const logicalImageWidth = image
    ? currentPlanPage?.logicalWidth || image.width / (currentPlanPage?.renderScale || baseScale * dpr)
    : 0;
  const logicalImageHeight = image
    ? currentPlanPage?.logicalHeight || image.height / (currentPlanPage?.renderScale || baseScale * dpr)
    : 0;

  const getFittedSheetView = useCallback(() => {
    if (!logicalImageWidth || !logicalImageHeight || !canvasSize.width || !canvasSize.height) {
      return { scale: stageScale || 1, pos: stagePos || { x: 0, y: 0 } };
    }
    const normalizedRotation = ((Number(rotation) % 360) + 360) % 360;
    const rotatedQuarterTurn = normalizedRotation === 90 || normalizedRotation === 270;
    const displayWidth = rotatedQuarterTurn ? logicalImageHeight : logicalImageWidth;
    const displayHeight = rotatedQuarterTurn ? logicalImageWidth : logicalImageHeight;
    const fitScale = Math.min(
      canvasSize.width / displayWidth,
      canvasSize.height / displayHeight,
      1
    ) * 0.94;
    const rotationOffsetX = rotatedQuarterTurn ? ((logicalImageWidth - logicalImageHeight) / 2) * fitScale : 0;
    const rotationOffsetY = rotatedQuarterTurn ? ((logicalImageHeight - logicalImageWidth) / 2) * fitScale : 0;
    return {
      scale: fitScale,
      pos: {
        x: ((canvasSize.width - displayWidth * fitScale) / 2) + rotationOffsetX,
        y: ((canvasSize.height - displayHeight * fitScale) / 2) + rotationOffsetY
      }
    };
  }, [canvasSize.height, canvasSize.width, logicalImageHeight, logicalImageWidth, rotation]);

  useEffect(() => {
    if (!image || !logicalImageWidth || !logicalImageHeight || !canvasSize.width || !canvasSize.height) return;
    const savedView = sheetViewStateRef.current[currentPage];
    const fitKey = [
      currentPage,
      rotation,
      logicalImageWidth,
      logicalImageHeight,
      planPages.length,
      planFilename
    ].join(':');
    if (fittedSheetViewKeyRef.current === fitKey) return;
    const nextView = savedView || getFittedSheetView();
    setStageScale(nextView.scale);
    setStagePos(nextView.pos);
    fittedSheetViewKeyRef.current = fitKey;
    if (!savedView) {
      sheetViewStateRef.current[currentPage] = nextView;
    }
  }, [image, logicalImageWidth, logicalImageHeight, canvasSize.width, canvasSize.height, currentPage, rotation, planPages.length, planFilename, getFittedSheetView]);

  const selectedFp = activePageFloorplans.find(f => f.id === selectedFloorplanId);
  const selectedWall = activePageWalls.find(w => w.id === selectedWallId);
  const selectedWallSystem = selectedWall ? resolveConstructionSystem(selectedWall) : null;
  const selectModeActive = activeTool === 'select';
  const markupListening = !isRecoveryPreview;

  const canStartStagePan = () => (
    !isRecoveryPreview
    && !calibrationMode
    && !draggingVertex
    && !draggingItem
    && !draggingMeasureId
    && !draggingEaveId
    && activeTool !== 'select'
    && activeTool !== 'measure'
    && activeTool !== 'eaves'
    && activePolyline.length === 0
    && activeAreaPolyline.length === 0
    && measurePoints.length === 0
    && eavePoints.length === 0
  );

  const handleStageContentPointerDown = (event) => {
    if (event.button !== 0 || !canStartStagePan()) return;
    const stage = stageRef.current;
    if (!stage) return;
    const pointerId = event.pointerId ?? 'mouse';
    stageContentPanRef.current = {
      active: true,
      moved: false,
      pointerId,
      startClient: { x: event.clientX, y: event.clientY },
      startStagePos: { x: stage.x(), y: stage.y() },
      latestPos: { x: stage.x(), y: stage.y() }
    };
  };

  const handleStageContentPointerMove = (event) => {
    const panDrag = stageContentPanRef.current;
    const pointerId = event.pointerId ?? 'mouse';
    if (!panDrag?.active || panDrag.pointerId !== pointerId) return;
    const stage = stageRef.current;
    if (!stage) return;
    const dx = event.clientX - panDrag.startClient.x;
    const dy = event.clientY - panDrag.startClient.y;
    if (Math.abs(dx) <= 2 && Math.abs(dy) <= 2) return;
    event.preventDefault();
    const nextPos = { x: panDrag.startStagePos.x + dx, y: panDrag.startStagePos.y + dy };
    stageContentPanRef.current = { ...panDrag, moved: true, latestPos: nextPos };
    stage.position(nextPos);
    stage.batchDraw();
  };

  const handleStageContentPointerUp = (event) => {
    const panDrag = stageContentPanRef.current;
    const pointerId = event.pointerId ?? 'mouse';
    if (!panDrag?.active || panDrag.pointerId !== pointerId) return;
    const stage = stageRef.current;
    const nextPos = panDrag.latestPos || (stage ? { x: stage.x(), y: stage.y() } : panDrag.startStagePos);
    if (panDrag.moved) suppressNextStageClickRef.current = true;
    stageContentPanRef.current = null;
    if (!stage || !panDrag.moved) return;
    setStagePos(nextPos);
    rememberCurrentSheetView({ scale: stage.scaleX?.() || stageScale, pos: nextPos });
  };
  const selectedEave = activePageEaves.find(e => e.id === selectedEaveId);
  const selectedPillar = activePagePillars.find(p => p.id === selectedPillarId);
  const takeoffSchedule = React.useMemo(() => createTakeoffSchedule({
    aiAnalysis: aiTakeoffAnalysis.report,
    projectInfo,
    planFilename,
    totalPages,
    currentPage,
    pixelsPerMm,
    completedWallRuns,
    placedOpenings,
    completedAreas,
    completedFloorplans,
    completedMeasurements,
    completedEaves,
    completedPillars,
    sheetLevels,
    jobSetupRows: platformContext.jobSetupRows || {}
  }), [projectInfo, planFilename, totalPages, currentPage, pixelsPerMm, completedWallRuns, placedOpenings, completedAreas, completedFloorplans, completedMeasurements, completedEaves, completedPillars, sheetLevels, platformContext.jobSetupRows, aiTakeoffAnalysis.report]);
  const scheduleSignature = React.useMemo(() => getScheduleSignature(takeoffSchedule), [takeoffSchedule]);
  const quoteSheetOutOfDate = !!lastQuoteSyncSignature && lastQuoteSyncSignature !== scheduleSignature;

  const downloadTextFile = (filename, content, type) => {
    const blob = new Blob([content], { type });
    const url = createTakeoffObjectUrl(blob, 'schedule-export', logTakeoffRefresh);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    revokeTakeoffObjectUrl(url, 'schedule-export', logTakeoffRefresh);
  };

  const handleExportCsv = () => {
    const rows = flattenScheduleRows(takeoffSchedule, 'projectTotals');
    downloadTextFile(`${sanitizeJobFileName(jobName || 'takeoff_schedule')}.csv`, exportRowsToCsv(rows), 'text/csv');
  };

  const handleExportExcel = () => {
    downloadTextFile(`${sanitizeJobFileName(jobName || 'takeoff_schedule')}.xls`, exportScheduleToExcelXml(takeoffSchedule), 'application/vnd.ms-excel');
  };

  const handleExportPdfSchedule = () => {
    const rows = flattenScheduleRows(takeoffSchedule, 'projectTotals');
    const html = `
      <html>
        <head><title>Takeoff Schedule</title></head>
        <body style="font-family: Arial, sans-serif;">
          <h1>Takeoff Schedule</h1>
          <p><strong>Project:</strong> ${takeoffSchedule.project.projectName || ''}</p>
          <p><strong>Client:</strong> ${takeoffSchedule.project.clientName || ''}</p>
          <p><strong>Site:</strong> ${takeoffSchedule.project.siteAddress || ''}</p>
          <table border="1" cellspacing="0" cellpadding="5">
            <thead><tr><th>Section</th><th>Item ID</th><th>Category</th><th>Quantity</th><th>Unit</th></tr></thead>
            <tbody>${rows.map((row) => `<tr><td>${row.section}</td><td>${row.itemId}</td><td>${row.category}</td><td>${row.quantity}</td><td>${row.unit}</td></tr>`).join('')}</tbody>
          </table>
        </body>
      </html>`;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleSendToJobSetup = () => {
    if (isRecoveryPreview) {
      alert("Recovery Preview is read-only and cannot transfer data to Job Setup.");
      return;
    }
    if (!hasAttachedProject) {
      setAttachProjectName('Johnson 123');
      setAttachError('Attach this takeoff to a master project before exporting to Job Setup.');
      setAttachDialogOpen(true);
      return;
    }
    const payload = createJobSetupPayload(takeoffSchedule, {
      jobId: platformContext.jobId || openedTakeoffJob?.masterJobId || '',
      takeoffId: openedTakeoffJob?.takeoffId || '',
      revision: savedRevision,
      projectId: openedTakeoffJob?.associatedProjectId || platformContext.projectId || '',
      sheetLevels,
    });
    setJobSetupPayload(payload);
    if (embedded && onJobSetupUpdate) {
      Promise.resolve(onJobSetupUpdate(payload)).then((result) => {
        if (result?.ok === false) throw new Error(result.message || 'Job Setup import could not be prepared.');
        setPlatformSaveMessage('Review the measured quantities in Job Setup to complete the import.');
      }).catch((error) => setPlatformSaveMessage(error.message));
      return;
    }
    const previewRows = Array.isArray(payload.mappingPreview) ? payload.mappingPreview : [];
    const missingRows = previewRows.filter((row) => row.status === 'missing');
    const previewText = [
      `Project: ${payload.projectName || '(unnamed)'}`,
      `Takeoff: ${openedTakeoffJob?.takeoffId || 'unknown'} Revision ${savedRevision || 0}`,
      `Fields prepared: ${previewRows.length}`,
      `Missing or blank fields: ${missingRows.length}`,
      '',
      // The builder reviewing this confirmation sees the real Job Setup destination it is about to
      // update (e.g. "Ground Floor 200mm Core-filled Blockwork: 6 LM"), never the internal row key
      // (e.g. "lowerCoreFilledBlockworkLm") - Job Setup import mappings must read as clean,
      // human-readable Takeoff -> Job Setup pairs, not opaque IDs.
      ...previewRows.slice(0, 20).map((row) => `${row.label || row.destinationKey}: ${row.value ?? ''}${row.unit ? ` ${row.unit}` : ''}`),
      ...(previewRows.length > 20 ? ['...'] : []),
      '',
      ...(payload.warnings || []).map((warning) => `Warning: ${warning}`),
      '',
      'Confirm export to Job Setup?'
    ].join('\n');
    const confirmed = window.confirm(previewText);
    if (!confirmed) return;
    if (onJobSetupUpdate) {
      Promise.resolve(onJobSetupUpdate(payload)).then((result) => {
        if (result?.ok === false) throw new Error(result.message || 'Job Setup import failed.');
        const updatedFields = previewRows.filter((row) => row.status === 'ready').map((row) => row.destinationKey);
        setPlatformSaveMessage(`Exported Takeoff to Job Setup (${updatedFields.length} fields updated).`);
      }).catch((error) => setPlatformSaveMessage(error.message));
    }
  };

  const handlePrepareQuotePreview = () => {
    setQuotePreviewRows(createQuotePreviewRows(takeoffSchedule, quoteSheetRows, scheduleMappings));
  };

  const handleQuoteMappingChange = (itemId, rowId) => {
    const nextMappings = { ...scheduleMappings, [itemId]: rowId };
    setScheduleMappings(nextMappings);
    setQuotePreviewRows(createQuotePreviewRows(takeoffSchedule, quoteSheetRows, nextMappings));
  };

  const handleApplyQuotePreview = () => {
    if (isRecoveryPreview) {
      alert("Recovery Preview is read-only and cannot transfer quantities to the Quote Sheet.");
      return;
    }
    const mappedRows = quotePreviewRows.filter((row) => row.destinationRowId);
    const nextQuoteRows = applyQuotePreviewRows(quoteSheetRows, mappedRows);
    setQuoteSheetRows(nextQuoteRows);
    setLastQuoteSyncSignature(scheduleSignature);
    setQuotePreviewRows(createQuotePreviewRows(takeoffSchedule, nextQuoteRows, scheduleMappings));
    if (onQuoteSheetUpdate) {
      Promise.resolve(onQuoteSheetUpdate({
        previewRows: mappedRows,
        mappings: scheduleMappings,
        scheduleSignature,
        syncedAt: new Date().toISOString()
      })).then(() => {
        setPlatformSaveMessage("Approved takeoff quantities sent to Quote Sheet.");
      });
    }
  };

  const handleScheduleItemClick = (row) => {
    const page = row.planSheet || row.page;
    if (page) goToSheet(page);
    const wall = completedWallRuns.find((item) => item.id === row.itemId);
    const floorplan = completedFloorplans.find((item) => item.id === row.itemId);
    const area = completedAreas.find((item) => item.id === row.itemId);
    const opening = placedOpenings.find((item) => item.id === row.itemId);
    const eave = completedEaves.find((item) => item.id === row.itemId);
    const measurement = completedMeasurements.find((item) => item.id === row.itemId);
    const pillar = completedPillars.find((item) => item.id === row.itemId);
    if (wall) selectOnly('wall', wall.id);
    else if (floorplan) selectOnly('floorplan', floorplan.id);
    else if (area) selectOnly('area', area.id);
    else if (opening) selectOnly('opening', opening.id);
    else if (eave) selectOnly('eaves', eave.id);
    else if (measurement) selectOnly('measure', measurement.id);
    else if (pillar) selectOnly('pillar', pillar.id);
    else selectOnly(null, null);
  };

  const renderScheduleRows = (title, rows, quantityLabel = 'Quantity') => (
    <details open style={{ border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff' }}>
      <summary style={{ padding: '8px 10px', cursor: 'pointer', fontWeight: 'bold', color: '#111827' }}>{title}</summary>
      <div style={{ maxHeight: '220px', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ background: '#f3f4f6' }}>
              <th style={{ textAlign: 'left', padding: '6px', borderBottom: '1px solid #ddd' }}>Category</th>
              <th style={{ textAlign: 'right', padding: '6px', borderBottom: '1px solid #ddd' }}>{quantityLabel}</th>
              <th style={{ textAlign: 'left', padding: '6px', borderBottom: '1px solid #ddd' }}>Unit</th>
              <th style={{ textAlign: 'left', padding: '6px', borderBottom: '1px solid #ddd' }}>Detail</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan="4" style={{ padding: '8px', color: '#6b7280' }}>No measured items.</td></tr>
            )}
            {rows.map((row, idx) => (
              <tr key={`${row.itemId || row.category}-${idx}`} onClick={() => handleScheduleItemClick(row)} style={{ cursor: row.itemId ? 'pointer' : 'default' }}>
                <td style={{ padding: '6px', borderBottom: '1px solid #eee' }}>{row.category || row.wallType}</td>
                <td style={{ padding: '6px', textAlign: 'right', borderBottom: '1px solid #eee', fontWeight: 'bold' }}>{row.quantity ?? row.lengthM ?? row.netAreaM2 ?? 0}</td>
                <td style={{ padding: '6px', borderBottom: '1px solid #eee' }}>{row.unit || 'm2'}</td>
                <td style={{ padding: '6px', borderBottom: '1px solid #eee', color: '#4b5563' }}>
                  {row.level || row.planSheet ? `${row.level || ''} ${row.planSheet ? `Sheet ${row.planSheet}` : ''}` : row.itemId}
                  {row.grossAreaM2 !== undefined ? ` Gross ${row.grossAreaM2} m2 / Net ${row.netAreaM2} m2` : ''}
                  {row.totalOpeningAreaM2 !== undefined ? ` Area ${row.totalOpeningAreaM2} m2` : ''}
                  {row.notes ? <div>{row.notes}</div> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );

  const handleWallSystemRowClick = (row) => {
    if (!row.walls?.length) return;
    const target = row.walls[0];
    if (target.page) goToSheet(target.page);
    selectOnly('wall', target.id);
  };

  // The redesigned wall sections: grouped by level, then by canonical construction system and
  // frame, replacing the old flat "Other"-hiding rows. Zero rows are hidden; Unclassified is
  // always shown (only) when it actually carries length, with a review callout and a click that
  // navigates straight to its first wall run.
  const renderWallSystemSchedule = (title, wallSystems, side) => (
    <details open style={{ border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff' }}>
      <summary style={{ padding: '8px 10px', cursor: 'pointer', fontWeight: 'bold', color: '#111827' }}>{title}</summary>
      <div style={{ maxHeight: '260px', overflow: 'auto', padding: '4px 8px 8px' }}>
        {!(wallSystems?.levels || []).some((levelGroup) => levelGroup[side].rows.some((row) => row.lengthM > 0)) && (
          <div style={{ padding: '8px', color: '#6b7280', fontSize: '12px' }}>No measured walls.</div>
        )}
        {(wallSystems?.levels || []).map((levelGroup) => {
          const group = levelGroup[side];
          const visibleRows = group.rows.filter((row) => row.lengthM > 0);
          if (!visibleRows.length) return null;
          const unclassified = group.rows.find((row) => row.system === 'unclassified' && row.lengthM > 0);
          return (
            <div key={levelGroup.level} style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#374151', textTransform: 'uppercase', padding: '4px 0' }}>
                {levelGroup.level} &mdash; {side === 'external' ? 'External Walls' : 'Internal Walls'}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#f3f4f6' }}>
                    <th style={{ textAlign: 'left', padding: '5px', borderBottom: '1px solid #ddd' }}>Wall System</th>
                    <th style={{ textAlign: 'left', padding: '5px', borderBottom: '1px solid #ddd' }}>Frame</th>
                    <th style={{ textAlign: 'right', padding: '5px', borderBottom: '1px solid #ddd' }}>Length (lm)</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.flatMap((row) => [
                    <tr key={row.itemId} onClick={() => handleWallSystemRowClick(row)}
                      style={{ cursor: row.walls.length ? 'pointer' : 'default', background: row.system === 'unclassified' ? '#fff7ed' : 'transparent' }}>
                      <td style={{ padding: '5px', borderBottom: '1px solid #eee', color: row.system === 'unclassified' ? '#b45309' : '#111827', fontWeight: row.system === 'unclassified' ? 'bold' : 'normal' }}>
                        {row.system === 'unclassified' ? `⚠ Unclassified ${side === 'external' ? 'External' : 'Internal'} Wall — REVIEW REQUIRED` : row.label}
                      </td>
                      <td style={{ padding: '5px', borderBottom: '1px solid #eee' }}>{row.frameLabel}</td>
                      <td style={{ padding: '5px', borderBottom: '1px solid #eee', textAlign: 'right', fontWeight: 'bold' }}>{row.lengthM.toFixed(2)}</td>
                    </tr>,
                    // Cladding product is DETAIL under its parent row, never a second wall total.
                    ...row.products.map((product) => (
                      <tr key={`${row.itemId}:${product.label}`} style={{ color: '#6b7280', fontSize: '11px' }}>
                        <td style={{ padding: '2px 5px 2px 20px', borderBottom: '1px solid #f3f4f6' }}>{product.label}</td>
                        <td style={{ padding: '2px 5px', borderBottom: '1px solid #f3f4f6' }} />
                        <td style={{ padding: '2px 5px', borderBottom: '1px solid #f3f4f6', textAlign: 'right' }}>{product.lengthM.toFixed(2)}</td>
                      </tr>
                    )),
                  ])}
                  <tr style={{ fontWeight: 'bold', borderTop: '2px solid #d1d5db' }}>
                    <td style={{ padding: '5px' }} colSpan={2}>{levelGroup.level} {side === 'external' ? 'External' : 'Internal'} Total</td>
                    <td style={{ padding: '5px', textAlign: 'right' }}>{group.totalLengthM.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
              {unclassified && (
                <div style={{ fontSize: '11px', color: '#b45309', padding: '4px 2px' }}>
                  &#9888; {unclassified.walls.length} unclassified wall run{unclassified.walls.length === 1 ? '' : 's'}, {unclassified.lengthM.toFixed(2)} lm on {levelGroup.level} &mdash; click above to review.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </details>
  );

  const handleOpeningRowClick = (row) => {
    const target = row.openings?.[0];
    if (!target) return;
    if (target.page) goToSheet(target.page);
    selectOnly('opening', target.id);
  };

  // Windows are grouped by level then shown as real, human-readable rows - actual code, size,
  // qty and glass, never an internal window_schedule_N id as the primary description (Phase 2A).
  const renderWindowSchedule = (windows) => {
    const rows = (windows || []).filter((row) => row.category === 'Window');
    const byLevel = new Map();
    rows.forEach((row) => { if (!byLevel.has(row.floor)) byLevel.set(row.floor, []); byLevel.get(row.floor).push(row); });
    const sillTotal = (windows || []).find((row) => row.itemId === 'brick_sill_total');
    return (
      <details open style={{ border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff' }}>
        <summary style={{ padding: '8px 10px', cursor: 'pointer', fontWeight: 'bold', color: '#111827' }}>Windows</summary>
        <div style={{ maxHeight: '260px', overflow: 'auto', padding: '4px 8px 8px' }}>
          {!rows.length && <div style={{ padding: '8px', color: '#6b7280', fontSize: '12px' }}>No measured windows.</div>}
          {Array.from(byLevel.entries()).map(([level, levelRows]) => (
            <div key={level} style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#374151', textTransform: 'uppercase', padding: '4px 0' }}>Windows &mdash; {level}</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#f3f4f6' }}>
                    <th style={{ textAlign: 'left', padding: '5px', borderBottom: '1px solid #ddd' }}>Code</th>
                    <th style={{ textAlign: 'left', padding: '5px', borderBottom: '1px solid #ddd' }}>Size</th>
                    <th style={{ textAlign: 'right', padding: '5px', borderBottom: '1px solid #ddd' }}>Qty</th>
                    <th style={{ textAlign: 'left', padding: '5px', borderBottom: '1px solid #ddd' }}>Glass</th>
                    <th style={{ textAlign: 'left', padding: '5px', borderBottom: '1px solid #ddd' }}>Location</th>
                    <th style={{ textAlign: 'left', padding: '5px', borderBottom: '1px solid #ddd' }}>Wall System</th>
                  </tr>
                </thead>
                <tbody>
                  {levelRows.map((row) => (
                    <tr key={row.itemId} onClick={() => handleOpeningRowClick({ ...row, itemIds: [row.itemId] })}>
                      <td style={{ padding: '5px', borderBottom: '1px solid #eee', fontWeight: 'bold' }}>{row.code || row.itemId}</td>
                      <td style={{ padding: '5px', borderBottom: '1px solid #eee' }}>{row.sizeLabel || '—'}</td>
                      <td style={{ padding: '5px', borderBottom: '1px solid #eee', textAlign: 'right' }}>{row.quantity}</td>
                      <td style={{ padding: '5px', borderBottom: '1px solid #eee' }}>{row.glassType || 'Unspecified'}</td>
                      <td style={{ padding: '5px', borderBottom: '1px solid #eee' }}>{row.roomLabel || row.location}</td>
                      <td style={{ padding: '5px', borderBottom: '1px solid #eee', color: '#6b7280' }}>{row.hostWallSystem || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {sillTotal && sillTotal.quantity > 0 && (
            <div style={{ fontSize: '11px', color: '#475569', padding: '4px 2px' }}>Total brick-veneer sill length: {sillTotal.quantity.toFixed(2)} lm</div>
          )}
        </div>
      </details>
    );
  };

  // Doors follow the same human-readable principle: real code/type, size and qty, never an
  // internal door_schedule_N id as the primary description (Phase 2A).
  const renderDoorSchedule = (doors) => {
    const byLevel = new Map();
    (doors || []).forEach((row) => { if (!byLevel.has(row.floor)) byLevel.set(row.floor, []); byLevel.get(row.floor).push(row); });
    return (
      <details open style={{ border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff' }}>
        <summary style={{ padding: '8px 10px', cursor: 'pointer', fontWeight: 'bold', color: '#111827' }}>Doors</summary>
        <div style={{ maxHeight: '260px', overflow: 'auto', padding: '4px 8px 8px' }}>
          {!(doors || []).length && <div style={{ padding: '8px', color: '#6b7280', fontSize: '12px' }}>No measured doors.</div>}
          {Array.from(byLevel.entries()).map(([level, levelRows]) => (
            <div key={level} style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#374151', textTransform: 'uppercase', padding: '4px 0' }}>Doors &mdash; {level}</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#f3f4f6' }}>
                    <th style={{ textAlign: 'left', padding: '5px', borderBottom: '1px solid #ddd' }}>Code</th>
                    {/* Cavity Sliding Door / Barn Door / Hinged etc. - never collapsed into the
                        coarser "Internal Door" openingClass, so the framing requirement a cavity
                        slider carries (a frame/cage) is never silently lost in this schedule. */}
                    <th style={{ textAlign: 'left', padding: '5px', borderBottom: '1px solid #ddd' }}>Type</th>
                    <th style={{ textAlign: 'left', padding: '5px', borderBottom: '1px solid #ddd' }}>Size</th>
                    <th style={{ textAlign: 'right', padding: '5px', borderBottom: '1px solid #ddd' }}>Qty</th>
                    <th style={{ textAlign: 'left', padding: '5px', borderBottom: '1px solid #ddd' }}>Location</th>
                    <th style={{ textAlign: 'left', padding: '5px', borderBottom: '1px solid #ddd' }}>Wall System</th>
                  </tr>
                </thead>
                <tbody>
                  {levelRows.map((row) => (
                    <tr key={row.itemId} onClick={() => handleOpeningRowClick({ ...row, itemIds: [row.itemId] })}>
                      <td style={{ padding: '5px', borderBottom: '1px solid #eee', fontWeight: 'bold' }}>{row.code || `${row.widthMm || ''}${row.widthMm ? ' ' : ''}${row.doorType}`}</td>
                      <td style={{ padding: '5px', borderBottom: '1px solid #eee', fontWeight: row.isCavitySlider ? 'bold' : 'normal', color: row.isCavitySlider ? '#7c2d12' : 'inherit' }}>{row.doorStyle || row.doorType}</td>
                      <td style={{ padding: '5px', borderBottom: '1px solid #eee' }}>{row.sizeLabel || '—'}</td>
                      <td style={{ padding: '5px', borderBottom: '1px solid #eee', textAlign: 'right' }}>{row.quantity}</td>
                      <td style={{ padding: '5px', borderBottom: '1px solid #eee' }}>{row.roomLabel || row.location}</td>
                      <td style={{ padding: '5px', borderBottom: '1px solid #eee', color: '#6b7280' }}>{row.hostWallSystem || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </details>
    );
  };

  if (embedded && platformContext.isHydratingProject) {
    return (
      <div style={{ padding: '24px', minHeight: '520px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ maxWidth: '520px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '24px', boxShadow: '0 16px 36px rgba(15,23,42,0.08)' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: '22px', color: '#0f172a' }}>Loading project takeoff</h2>
          <p style={{ margin: 0, color: '#475569', lineHeight: 1.5 }}>Resolving the active Project Workspace job before loading AI Plan Takeoff.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: embedded ? 'calc(100vh - 180px)' : '100vh', minHeight: embedded ? '680px' : undefined, fontFamily: 'sans-serif', position: 'relative', overflow: 'hidden' }}>
      {/* Left Sidebar */}
      <div style={{ width: '420px', padding: '16px', borderRight: '1px solid #ccc', background: '#f8f9fa', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
        {!embedded && <h3 style={{ margin: 0, fontSize: '22px', color: '#111' }}>AI Takeoff & Schedule Engine</h3>}
        {embedded && onBackToDashboard && (
          <button onClick={onBackToDashboard} style={{ padding: '9px', background: '#fff', color: '#111827', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
            Back to Project Dashboard
          </button>
        )}
        {embedded && onOpenMasterJob && (
          <button type="button" data-testid="takeoff-open-master-job" onClick={onOpenMasterJob}
            style={{ padding: 10, background: '#fff', color: '#115e59', border: '1px solid #99d8d2', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}>
            Open Job
          </button>
        )}

        {/* Job identity: the takeoff panel must name the job it belongs to, so a sheet printed or
            screenshotted from here can never be misread as belonging to another job. */}
        <div style={{ background: '#fff', padding: '10px 12px', borderRadius: '6px', border: '2px solid #6d28d9', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.06em', color: '#6d28d9', textTransform: 'uppercase' }}>Takeoff for</span>
          <strong style={{ fontSize: '15px', color: '#0f172a', lineHeight: 1.25 }}>{takeoffJobDisplayName}</strong>
          <span style={{ fontSize: '13px', color: takeoffSiteAddress ? '#334155' : '#94a3b8', fontStyle: takeoffSiteAddress ? 'normal' : 'italic', lineHeight: 1.25 }}>
            {takeoffSiteAddress || 'No site address set - add one in Takeoff Schedule'}
          </span>
          {projectInfo.clientName ? (
            <span style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.25 }}>Client: {projectInfo.clientName}</span>
          ) : null}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
          <button
            id="ai-plan-takeoff-new-job-button"
            type="button"
            onClick={createNewTakeoffJob}
            disabled={isRecoveryPreview}
            style={{ display: 'none' }}
          />
          <button
            id="ai-plan-takeoff-save-as-button"
            type="button"
            onClick={handleSaveJobAs}
            disabled={isRecoveryPreview}
            style={{ display: 'none' }}
          />
          <label style={{ padding: '8px', background: isRecoveryPreview ? '#e5e7eb' : '#fff', border: '1px solid #ccc', borderRadius: '4px', textAlign: 'center', cursor: isRecoveryPreview ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
            <Upload size={16} /> Open Plan
            <input type="file" accept="image/*,.pdf" onChange={handleFileUpload} disabled={isRecoveryPreview || (embedded && !platformContext.jobId)} style={{ display: 'none' }} />
          </label>
          <label style={{ display: 'none' }}>
            Relink Original Plan
            <input id="relink-original-plan-loader" type="file" accept="image/*,.pdf" onChange={(event) => handleFileUpload(event, { preserveTakeoffs: true })} />
          </label>
          <button
            id="ai-plan-takeoff-download-backup-button"
            type="button"
            onClick={handleExportTakeoffFile}
            disabled={!hasOpenTakeoffJob || isRecoveryPreview}
            style={{ padding: '8px', background: hasOpenTakeoffJob && !isRecoveryPreview ? '#455a64' : '#94a3b8', color: '#fff', border: 'none', borderRadius: '4px', cursor: hasOpenTakeoffJob && !isRecoveryPreview ? 'pointer' : 'not-allowed', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
            title="Download a complete portable takeoff backup"
          >
            <Download size={16} /> Export Takeoff
          </button>
          <button
            id="ai-plan-takeoff-save-button"
            type="button"
            onClick={handleSaveJob}
            disabled={!hasOpenTakeoffJob || isRecoveryPreview}
            style={{ padding: '8px', background: hasOpenTakeoffJob && !isRecoveryPreview ? '#1976d2' : '#94a3b8', color: '#fff', border: 'none', borderRadius: '4px', cursor: hasOpenTakeoffJob && !isRecoveryPreview ? 'pointer' : 'not-allowed', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
            title="Save complete progress to the active platform project"
          >
            <Download size={16} /> Save Progress
          </button>
          <button
            type="button"
            onClick={handleOpenJob}
            disabled={isRecoveryPreview}
            style={{ padding: '8px', background: isRecoveryPreview ? '#94a3b8' : '#4caf50', color: '#fff', border: 'none', borderRadius: '4px', cursor: isRecoveryPreview ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
            title="Import a previously exported takeoff backup into this project"
          >
            <Upload size={16} /> Import Takeoff
          </button>
          <input id="legacy-job-loader" type="file" accept=".gr8takeoff,.json" onChange={handleLoadJob} style={{ display: 'none' }} />
        </div>

        {isRecoveryPreview && (
          <div
            data-johnson-recovery-preview-banner
            style={{ background: '#7f1d1d', border: '2px solid #fecaca', borderRadius: '6px', padding: '12px', color: '#fff', display: 'grid', gap: '6px', boxShadow: '0 8px 22px rgba(127,29,29,0.18)' }}
          >
            <strong style={{ fontSize: '16px', letterSpacing: '0.02em' }}>ARCHIVED RECOVERY PREVIEW - NOT ATTACHED</strong>
            <span style={{ fontSize: '12px', lineHeight: 1.4 }}>
              Read-only archived recovery evidence. Saves, transfers, imports and editing are disabled.
            </span>
            {recoveryPreviewCounts && (
              <span data-johnson-recovery-preview-counts style={{ fontSize: '12px', fontWeight: 'bold' }}>
                Pages {recoveryPreviewCounts.renderablePlanPages || recoveryPreviewCounts.planPages}; floor coverings {recoveryPreviewCounts.floorCoverings}; footprint/room areas {recoveryPreviewCounts.floorplans}; walls {recoveryPreviewCounts.walls}; openings {recoveryPreviewCounts.openings}
              </span>
            )}
          </div>
        )}

        <div style={{ background: '#fff', border: '1px solid #ddd', borderRadius: '4px', padding: '6px 8px', fontSize: '13px', display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
          <span style={{ color: '#555' }}>Platform project:</span>
          <strong style={{ color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentProjectLabel}</strong>
        </div>
        <div style={{ background: '#fff', border: '1px solid #ddd', borderRadius: '4px', padding: '6px 8px', fontSize: '13px', display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
          <span style={{ color: '#555' }}>Takeoff job:</span>
          <strong style={{ color: hasOpenTakeoffJob ? '#111' : '#b45309', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hasOpenTakeoffJob ? jobName : 'None open'}</strong>
        </div>
        {!hasOpenTakeoffJob && (
          <div style={{ background: '#fff7ed', border: '1px solid #fdba74', borderRadius: '6px', padding: '12px', color: '#9a3412', fontSize: '13px', display: 'grid', gap: '10px' }}>
            <strong style={{ color: '#7c2d12', fontSize: '15px' }}>No takeoff job open</strong>
            <button type="button" onClick={createNewTakeoffJob} style={{ padding: '9px', background: '#111827', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>{embedded && onNewMasterJob ? 'Create New Job' : 'Create New Takeoff Job'}</button>
          </div>
        )}
        {importedTakeoffFileName && (
          <div style={{ background: '#fff', border: '1px solid #ddd', borderRadius: '4px', padding: '6px 8px', fontSize: '12px', color: '#475569' }}>
            Imported takeoff: <strong>{importedTakeoffFileName}</strong>
          </div>
        )}
        {platformSaveMessage && (
          <div style={{ background: platformSaveMessage.includes('SAVE FAILED') ? '#fef2f2' : '#ecfdf5', border: `1px solid ${platformSaveMessage.includes('SAVE FAILED') ? '#fca5a5' : '#86efac'}`, borderRadius: '4px', padding: '6px 8px', color: platformSaveMessage.includes('SAVE FAILED') ? '#991b1b' : '#166534', fontSize: '12px', fontWeight: 'bold' }}>{platformSaveMessage}</div>
        )}
        <AiTakeoffAction analysis={aiTakeoffAnalysis} schedule={takeoffSchedule} sheetLevels={sheetLevels} disabled={isRecoveryPreview || !image}
          onReview={() => setShowSchedule(true)} onSave={handleSaveJob}
          onGoToPage={(page) => { if (page >= 1 && page <= totalPages) setCurrentPage(page); }}
          onCalibrate={() => { setCalibrationMode(true); setCalibPoints([]); setActivePolyline([]); setActiveAreaPolyline([]); }} />
        <AiTakeoffDevelopmentAction bridge={aiTakeoffBridge} currentPage={currentPage} enabled={enableAiTakeoffDevelopment} disabled={isRecoveryPreview || !image || !pixelsPerMm} />
        {attachDialogOpen && (
          <div
            onClick={() => !attachSaving && setAttachDialogOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Save As / Attach to Project"
              onClick={(event) => event.stopPropagation()}
              style={{ width: 'min(520px, 100%)', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', boxShadow: '0 24px 70px rgba(15,23,42,0.28)', padding: '18px', display: 'grid', gap: '14px', color: '#0f172a' }}
            >
              <div>
                <h3 style={{ margin: '0 0 6px', fontSize: '20px' }}>Save As / Attach to Project</h3>
                <p style={{ margin: 0, color: '#475569', fontSize: '13px', lineHeight: 1.45 }}>
                  Save the currently open five-page takeoff under the master project. The source document remains {importedTakeoffFileName || planFilename || 'the imported PDF'}.
                </p>
              </div>
              <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 'bold' }}>
                Master project
                <select
                  value={attachProjectName}
                  onChange={(event) => setAttachProjectName(event.target.value)}
                  disabled={attachSaving}
                  style={{ padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px' }}
                >
                  <option value="Johnson 123">Johnson 123</option>
                </select>
              </label>
              <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 'bold' }}>
                Project name
                <input
                  value={attachProjectName}
                  onChange={(event) => setAttachProjectName(event.target.value)}
                  disabled={attachSaving}
                  style={{ padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px' }}
                />
              </label>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px', fontSize: '12px', color: '#334155', display: 'grid', gap: '4px' }}>
                <div><strong>Visible plan pages:</strong> {planPages.length}</div>
                <div><strong>Source document:</strong> {importedTakeoffFileName || planFilename || 'Not recorded'}</div>
                <div><strong>Takeoff name after save:</strong> {attachProjectName || 'Johnson 123'}</div>
              </div>
              {attachError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '10px', color: '#991b1b', fontSize: '12px', fontWeight: 'bold' }}>{attachError}</div>
              )}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setAttachDialogOpen(false)} disabled={attachSaving} style={{ padding: '9px 12px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: attachSaving ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>Cancel</button>
                <button type="button" onClick={handleAttachProjectSave} disabled={attachSaving || !planPages.length} style={{ padding: '9px 12px', background: attachSaving || !planPages.length ? '#94a3b8' : '#1976d2', color: '#fff', border: 'none', borderRadius: '6px', cursor: attachSaving || !planPages.length ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
                  {attachSaving ? 'Saving...' : 'Attach and Save'}
                </button>
              </div>
            </div>
          </div>
        )}
        {pdfEngineError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '4px', padding: '8px', color: '#991b1b', fontSize: '12px', fontWeight: 'bold' }}>{pdfEngineError}</div>
        )}
        <div style={{ background: hasUnsavedChanges ? '#fff7ed' : '#f8fafc', border: `1px solid ${hasUnsavedChanges ? '#fdba74' : '#cbd5e1'}`, borderRadius: '4px', padding: '6px 8px', color: hasUnsavedChanges ? '#9a3412' : '#334155', fontSize: '12px', fontWeight: 'bold' }}>
          {!hasOpenTakeoffJob ? 'No takeoff job open' : hasUnsavedChanges ? 'Unsaved changes' : `Saved revision ${savedRevision || 0}`}
          {lastSuccessfulSaveAt ? ` - ${new Date(lastSuccessfulSaveAt).toLocaleString()}` : ''}
        </div>

        <button
          onClick={() => setShowSchedule(true)}
          style={{ padding: '12px', background: quoteSheetOutOfDate ? '#f57c00' : '#111827', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          title="Open the live takeoff schedule and exports"
        >
          <Square size={18} /> Takeoff Schedule{quoteSheetOutOfDate ? ' - Quote Out of Date' : ''}
        </button>

        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ddd' }}>
            <button id="ai-plan-takeoff-prev-sheet-button" disabled={currentPage === 1} onClick={() => goToSheet((c) => c - 1)} style={{ cursor: currentPage === 1 ? 'not-allowed' : 'pointer', border: 'none', background: 'transparent' }}><ChevronLeft size={20} /></button>
            <span style={{ fontSize: '16px', fontWeight: 'bold' }}>Sheet {currentPage} of {totalPages}</span>
            <button id="ai-plan-takeoff-next-sheet-button" disabled={currentPage === totalPages} onClick={() => goToSheet((c) => c + 1)} style={{ cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', border: 'none', background: 'transparent' }}><ChevronRight size={20} /></button>
          </div>
        )}

        {/* Job Setup's wall and area inputs are all per level, so every measurement needs to know
            which storey its sheet represents before any of it can import. Nothing else can supply
            this: the sheet's position in the PDF says nothing about the building. */}
        {planPages.length > 0 && (
          <div style={{ background: '#fff', padding: '10px 12px', borderRadius: '4px', border: `2px solid ${currentSheetLevel ? '#0f766e' : '#f59e0b'}`, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a' }}>
              Sheet {currentPage} is which level?
            </label>
            <select
              id="ai-plan-takeoff-sheet-level-select"
              value={currentSheetLevel}
              disabled={isRecoveryPreview}
              onChange={(event) => {
                const nextLevel = event.target.value;
                setSheetLevels((prev) => {
                  const next = { ...prev };
                  if (nextLevel) next[currentPage] = nextLevel;
                  else delete next[currentPage];
                  return next;
                });
                markTakeoffItemCompleted('sheet-level-assignment');
              }}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontWeight: 'bold', fontSize: '14px' }}
            >
              <option value="">Not assigned</option>
              {SHEET_LEVEL_OPTIONS.map((level) => <option key={level} value={level}>{level}</option>)}
            </select>
            <span style={{ fontSize: '11px', color: currentSheetLevel ? '#475569' : '#b45309', fontWeight: currentSheetLevel ? 'normal' : 'bold', lineHeight: 1.35 }}>
              {currentSheetLevel
                ? `Walls, floor areas and roof areas on this sheet import as ${currentSheetLevel}.`
                : 'Until this sheet has a level, nothing measured on it can import into Job Setup.'}
            </span>
            {unassignedSheetsWithMeasurements.length > 0 && (
              <span style={{ fontSize: '11px', color: '#b45309', fontWeight: 'bold' }}>
                Also unassigned with measurements on them: {unassignedSheetsWithMeasurements.map((page) => `Sheet ${page}`).join(', ')}.
              </span>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setRotation((r) => (r + 90) % 360)}
            disabled={isRecoveryPreview}
            style={{ flex: 1, padding: '10px', cursor: isRecoveryPreview ? 'not-allowed' : 'pointer', background: isRecoveryPreview ? '#e5e7eb' : '#fff', border: '1px solid #ccc', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '15px', fontWeight: '600' }}
          >
            <RotateCw size={18} /> Rotate 90°
          </button>
          <button
            onClick={() => { setCalibrationMode(!calibrationMode); setCalibPoints([]); setActivePolyline([]); setActiveAreaPolyline([]); }}
            disabled={isRecoveryPreview}
            style={{ flex: 1, padding: '10px', cursor: isRecoveryPreview ? 'not-allowed' : 'pointer', background: isRecoveryPreview ? '#e5e7eb' : (calibrationMode ? '#ffc107' : '#fff'), border: '1px solid #ccc', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '15px', fontWeight: '600' }}
          >
            <Ruler size={18} /> {calibrationMode ? 'Cancel' : 'Calibrate'}
          </button>
          <button
            onClick={() => { setActiveTool('measure'); setMeasurePoints([]); setEavePoints([]); }}
            disabled={isRecoveryPreview}
            style={{ padding: '10px 14px', cursor: isRecoveryPreview ? 'not-allowed' : 'pointer', background: isRecoveryPreview ? '#e5e7eb' : (activeTool === 'measure' ? '#4caf50' : '#fff'), color: activeTool === 'measure' && !isRecoveryPreview ? '#fff' : '#333', border: '1px solid #ccc', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '14px', fontWeight: '600' }}
            title="Measure any dimension on the plan with fixed axis and offset drag"
          >
            <Ruler size={16} /> Measure
          </button>
        </div>

        {pixelsPerMm && (
          <div style={{ background: '#e8f5e9', padding: '6px 10px', borderRadius: '4px', border: '1px solid #a5d6a7', fontSize: '13px', color: '#2e7d32', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Scale Calibrated ({pixelsPerMm.toFixed(3)} px/mm)</span>
            <span style={{ fontSize: '11px', fontWeight: 'normal' }}>1m = {(1000 * pixelsPerMm).toFixed(0)}px</span>
          </div>
        )}

        <div style={{ display: 'flex', background: '#e0e0e0', borderRadius: '6px', padding: '4px' }}>
          <button
            onClick={() => { setActiveTool('select'); setActivePolyline([]); setActiveAreaPolyline([]); setMeasurePoints([]); setEavePoints([]); }}
            style={{ flex: 1, padding: '8px', fontSize: '12px', fontWeight: 'bold', border: 'none', borderRadius: '4px', cursor: 'pointer', background: activeTool === 'select' ? '#fff' : 'transparent', color: activeTool === 'select' ? '#1976d2' : '#555' }}
          >
            <MousePointer2 size={14} style={{ verticalAlign: 'middle', marginRight: '2px' }} /> Select
          </button>
          <button
            onClick={() => { setActiveTool('wall'); setActiveAreaPolyline([]); setEavePoints([]); }}
            style={{ flex: 1, padding: '8px', fontSize: '12px', fontWeight: 'bold', border: 'none', borderRadius: '4px', cursor: 'pointer', background: activeTool === 'wall' ? '#fff' : 'transparent', color: activeTool === 'wall' ? '#1976d2' : '#555' }}
          >
            <Layers size={14} style={{ verticalAlign: 'middle', marginRight: '2px' }} /> Walls
          </button>
          <button
            onClick={() => { setActiveTool('opening'); setActivePolyline([]); setActiveAreaPolyline([]); setEavePoints([]); }}
            style={{ flex: 1, padding: '8px', fontSize: '12px', fontWeight: 'bold', border: 'none', borderRadius: '4px', cursor: 'pointer', background: activeTool === 'opening' ? '#fff' : 'transparent', color: activeTool === 'opening' ? '#1976d2' : '#555' }}
          >
            <DoorOpen size={14} style={{ verticalAlign: 'middle', marginRight: '2px' }} /> Openings
          </button>
          <button
            onClick={() => { setActiveTool('pillar'); setActivePolyline([]); setActiveAreaPolyline([]); setEavePoints([]); setBoxStartPoint(null); }}
            style={{ flex: 1, padding: '8px', fontSize: '12px', fontWeight: 'bold', border: 'none', borderRadius: '4px', cursor: 'pointer', background: activeTool === 'pillar' ? '#fff' : 'transparent', color: activeTool === 'pillar' ? '#1976d2' : '#555' }}
          >
            <RectangleVertical size={14} style={{ verticalAlign: 'middle', marginRight: '2px' }} /> Posts / Columns
          </button>
          <button
            onClick={() => { setActiveTool('floorplan'); setActivePolyline([]); setActiveAreaPolyline([]); setEavePoints([]); }}
            style={{ flex: 1, padding: '8px', fontSize: '12px', fontWeight: 'bold', border: 'none', borderRadius: '4px', cursor: 'pointer', background: activeTool === 'floorplan' ? '#fff' : 'transparent', color: activeTool === 'floorplan' ? '#1976d2' : '#555' }}
          >
            <Compass size={14} style={{ verticalAlign: 'middle', marginRight: '2px' }} /> Plan
          </button>
          <button
            onClick={() => { setActiveTool('floorcoverings'); setActivePolyline([]); setActiveAreaPolyline([]); setEavePoints([]); }}
            style={{ flex: 1, padding: '8px', fontSize: '12px', fontWeight: 'bold', border: 'none', borderRadius: '4px', cursor: 'pointer', background: activeTool === 'floorcoverings' ? '#fff' : 'transparent', color: activeTool === 'floorcoverings' ? '#1976d2' : '#555' }}
          >
            <Square size={14} style={{ verticalAlign: 'middle', marginRight: '2px' }} /> Areas
          </button>
          <button
            onClick={() => { setActiveTool('roofarea'); setActivePolyline([]); setActiveAreaPolyline([]); setEavePoints([]); }}
            style={{ flex: 1, padding: '8px', fontSize: '12px', fontWeight: 'bold', border: 'none', borderRadius: '4px', cursor: 'pointer', background: activeTool === 'roofarea' ? '#fff' : 'transparent', color: activeTool === 'roofarea' ? '#b45309' : '#555' }}
          >
            <Home size={14} style={{ verticalAlign: 'middle', marginRight: '2px' }} /> Roof
          </button>
          <button
            onClick={() => { setActiveTool('eaves'); setActivePolyline([]); setActiveAreaPolyline([]); setMeasurePoints([]); }}
            style={{ flex: 1, padding: '8px', fontSize: '12px', fontWeight: 'bold', border: 'none', borderRadius: '4px', cursor: 'pointer', background: activeTool === 'eaves' ? '#fff' : 'transparent', color: activeTool === 'eaves' ? '#00838f' : '#555' }}
          >
            <Home size={14} style={{ verticalAlign: 'middle', marginRight: '2px' }} /> Eaves
          </button>
        </div>

        {activeTool === 'wall' && (
          <div style={{ background: '#fff', padding: '12px', borderRadius: '6px', border: '1px solid #1976d2', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => handleWallCategoryChange('exterior')}
                style={{ flex: 1, padding: '8px', fontSize: '14px', border: '1px solid #ccc', borderRadius: '4px', background: wallCategory === 'exterior' ? '#e3f2fd' : '#fff', fontWeight: wallCategory === 'exterior' ? 'bold' : 'normal' }}
              >
                Exterior Wall
              </button>
              <button
                onClick={() => handleWallCategoryChange('interior')}
                style={{ flex: 1, padding: '8px', fontSize: '14px', border: '1px solid #ccc', borderRadius: '4px', background: wallCategory === 'interior' ? '#e3f2fd' : '#fff', fontWeight: wallCategory === 'interior' ? 'bold' : 'normal' }}
              >
                Interior Wall
              </button>
            </div>

            {wallCategory === 'exterior' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>Exterior Wall Type:</label>
                <select
                  id="ai-plan-takeoff-exterior-wall-type"
                  value={resolveExteriorClass({ exteriorType: exteriorWallType })}
                  onChange={(event) => setExteriorWallType(event.target.value)}
                  style={{ padding: '8px', fontSize: '14px', border: '1px solid #1976d2', borderRadius: '4px', fontWeight: 'bold', background: exteriorWallType === 'Other' ? '#fff7ed' : '#fff' }}
                >
                  {EXTERIOR_WALL_CLASS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
                <span style={{ fontSize: '12px', color: exteriorWallType === 'Other' ? '#b45309' : '#475569', fontWeight: exteriorWallType === 'Other' ? 'bold' : 'normal', lineHeight: 1.35 }}>
                  {exteriorWallType === 'Other'
                    ? 'Walls drawn now are recorded as Other and carry no brick, render or cladding quantities.'
                    : `Walls drawn now are recorded as ${exteriorWallType}. Walls already drawn are unchanged.`}
                </span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>Wall Alignment:</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setAlignment('outer')}
                  style={{ flex: 1, padding: '6px', fontSize: '13px', border: '1px solid #ccc', borderRadius: '4px', background: alignment === 'outer' ? '#bbdefb' : '#fff', fontWeight: alignment === 'outer' ? 'bold' : 'normal' }}
                >
                  Outer Face
                </button>
                <button
                  onClick={() => setAlignment('inner')}
                  style={{ flex: 1, padding: '6px', fontSize: '13px', border: '1px solid #ccc', borderRadius: '4px', background: alignment === 'inner' ? '#bbdefb' : '#fff', fontWeight: alignment === 'inner' ? 'bold' : 'normal' }}
                >
                  Inner Face
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: '#f5f5f5', padding: '8px', borderRadius: '4px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#333', flex: 1 }}>Wall Thickness:</label>
                <input
                  type="number"
                  value={detectedWallThicknessMm}
                  onChange={(e) => {
                    setDetectedWallThicknessMm(parseFloat(e.target.value) || 0);
                    setAutoDetectWallThicknessEnabled(false);
                  }}
                  style={{ width: '80px', padding: '4px', fontSize: '14px', fontWeight: 'bold' }}
                />
                <span style={{ fontSize: '14px', color: '#1976d2' }}>mm</span>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: autoDetectWallThickness_Enabled ? '#475569' : '#b45309', fontWeight: autoDetectWallThickness_Enabled ? 'normal' : 'bold' }}>
                <input
                  type="checkbox"
                  checked={autoDetectWallThickness_Enabled}
                  onChange={(e) => setAutoDetectWallThicknessEnabled(e.target.checked)}
                />
                {autoDetectWallThickness_Enabled
                  ? 'Auto-detect thickness from the plan lines'
                  : `Locked to ${detectedWallThicknessMm}mm - auto-detect off`}
              </label>
            </div>

            {selectedWall && (
              <div style={{ background: '#e3f2fd', padding: '8px', borderRadius: '4px', border: '1px solid #90caf9', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#0d47a1' }}>Selected Wall Editing:</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => updateWallRunCategory(selectedWall.id, 'exterior')}
                    style={{ flex: 1, padding: '7px', fontSize: '12px', border: '1px solid #90caf9', borderRadius: '4px', background: selectedWall.category === 'exterior' ? '#bbdefb' : '#fff', color: '#0d47a1', fontWeight: selectedWall.category === 'exterior' ? 'bold' : 'normal', cursor: 'pointer' }}
                  >
                    Exterior
                  </button>
                  <button
                    onClick={() => updateWallRunCategory(selectedWall.id, 'interior')}
                    style={{ flex: 1, padding: '7px', fontSize: '12px', border: '1px solid #90caf9', borderRadius: '4px', background: selectedWall.category === 'interior' ? '#bbdefb' : '#fff', color: '#0d47a1', fontWeight: selectedWall.category === 'interior' ? 'bold' : 'normal', cursor: 'pointer' }}
                  >
                    Interior
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#333', width: '72px' }}>Thickness:</label>
                  <input
                    type="number"
                    value={selectedWall.thicknessMm}
                    onChange={(e) => updateWallRun(selectedWall.id, { thicknessMm: parseFloat(e.target.value) || 0 })}
                    style={{ flex: 1, padding: '5px', fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <span style={{ fontSize: '12px', color: '#0d47a1' }}>mm</span>
                </div>
                <select
                  value={selectedWall.alignment || 'outer'}
                  onChange={(e) => updateWallRun(selectedWall.id, { alignment: e.target.value })}
                  style={{ padding: '6px', fontSize: '12px', fontWeight: 'bold' }}
                >
                  <option value="outer">Outer Face</option>
                  <option value="inner">Inner Face</option>
                </select>
              </div>
            )}

            {activePolyline.length >= 2 && (
              <button
                onClick={finalizeCurrentWallRun}
                style={{ width: '100%', padding: '10px', background: '#e3f2fd', color: '#0d47a1', border: '1px solid #90caf9', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
              >
                Finish Wall Run ({activePolyline.length} points)
              </button>
            )}
          </div>
        )}

        {activeTool === 'opening' && (
          <div style={{ background: '#fff', padding: '14px', borderRadius: '8px', border: '1px solid #ff8787', display: 'flex', flexDirection: 'column', gap: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => setOpeningType('door')}
                style={{ flex: 1, padding: '8px', fontSize: '14px', border: '1px solid #ff6b6b', borderRadius: '4px', background: openingType === 'door' ? '#ff6b6b' : '#fff', color: openingType === 'door' ? '#fff' : '#333', fontWeight: 'bold' }}
              >
                Door
              </button>
              <button
                onClick={() => setOpeningType('window')}
                style={{ flex: 1, padding: '8px', fontSize: '14px', border: '1px solid #ff6b6b', borderRadius: '4px', background: openingType === 'window' ? '#ff6b6b' : '#fff', color: openingType === 'window' ? '#fff' : '#333', fontWeight: 'bold' }}
              >
                Window
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: '#fff5f5', padding: '8px', borderRadius: '4px', border: '1px solid #ffc9c9' }}>
              <label style={{ fontSize: '14px', color: '#c92a2a', fontWeight: 'bold', flex: 1 }}>Size Code (e.g. 1812):</label>
              <input
                type="text"
                value={sizeCodeInput}
                onChange={(e) => handleSizeCodeChange(e.target.value)}
                style={{ width: '90px', padding: '6px', fontSize: '14px', border: '1px solid #ff8787', borderRadius: '4px', fontWeight: 'bold', color: '#c92a2a' }}
                placeholder="1812"
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <label style={{ fontSize: '14px', color: '#333', fontWeight: 'bold', flex: 1 }}>Height (mm):</label>
              <input
                type="number"
                value={openingHeightMm}
                onChange={(e) => setOpeningHeightMm(parseFloat(e.target.value) || 0)}
                style={{ width: '90px', padding: '6px', fontSize: '14px', border: '1px solid #ccc', borderRadius: '4px', fontWeight: 'bold' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <label style={{ fontSize: '14px', color: '#333', fontWeight: 'bold', flex: 1 }}>Width (mm):</label>
              <input
                type="number"
                value={openingWidthMm}
                onChange={(e) => setOpeningWidthMm(parseFloat(e.target.value) || 0)}
                style={{ width: '90px', padding: '6px', fontSize: '14px', border: '1px solid #ccc', borderRadius: '4px', fontWeight: 'bold' }}
              />
            </div>

            {openingType === 'window' ? (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <label style={{ fontSize: '14px', color: '#333', fontWeight: 'bold', flex: 1 }}>Window Type:</label>
                <select
                  value={windowSubtype}
                  onChange={(e) => setWindowSubtype(e.target.value)}
                  style={{ flex: 1, padding: '6px', fontSize: '14px', border: '1px solid #ccc', borderRadius: '4px', background: '#fff', fontWeight: 'bold' }}
                >
                  <option value="standard">Standard Sliding (Blank)</option>
                  <option value="AW">AW - Awning</option>
                  <option value="DH">DH - Double Hung</option>
                  <option value="LVR">LVR - Louvre</option>
                  <option value="FG">FG - Fixed Glass</option>
                  <option value="CA">CA - Casement</option>
                  <option value="BI">BI - Bifold</option>
                  <option value="GSD">GSD - Glass Sliding Door</option>
                  <option value="CO">CO - Centre Opening</option>
                  <option value="Stacker">Stacker</option>
                </select>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <label style={{ fontSize: '14px', color: '#333', fontWeight: 'bold', flex: 1 }}>Door Type:</label>
                <select
                  value={doorSubtype}
                  onChange={(e) => setDoorSubtype(e.target.value)}
                  style={{ flex: 1, padding: '6px', fontSize: '14px', border: '1px solid #ccc', borderRadius: '4px', background: '#fff', fontWeight: 'bold' }}
                >
                  {DOOR_SUBTYPE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <label style={{ fontSize: '14px', color: '#333', fontWeight: 'bold', flex: 1 }}>Opening Class:</label>
              <select
                value={openingClass}
                onChange={(e) => setOpeningClass(e.target.value)}
                style={{ flex: 1, padding: '6px', fontSize: '14px', border: '1px solid #ccc', borderRadius: '4px', background: '#fff', fontWeight: 'bold' }}
              >
                {OPENING_CLASS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <label style={{ fontSize: '14px', color: '#333', fontWeight: 'bold', flex: 1 }}>Glass Type:</label>
              <select
                value={glassType}
                onChange={(e) => setGlassType(e.target.value)}
                style={{ flex: 1, padding: '6px', fontSize: '14px', border: '1px solid #ccc', borderRadius: '4px', background: '#fff', fontWeight: 'bold' }}
              >
                {GLASS_TYPE_OPTIONS.filter((option) => option !== 'Unspecified').map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
          </div>
        )}

        {activeTool === 'select' && (
          <div style={{ background: '#fff', padding: '12px', borderRadius: '6px', border: '1px solid #0f172a', display: 'grid', gap: '10px' }}>
            <strong style={{ fontSize: '14px', color: '#0f172a' }}>Select / Edit</strong>
            <span style={{ fontSize: '12px', color: '#475569' }}>Click to select walls, openings, measurements and areas. Drag handles to edit. Press Delete/Backspace to remove selected item.</span>
            {selectedWall && (
              <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px', display: 'grid', gap: '6px' }}>
                <strong style={{ fontSize: '12px' }}>Selected wall</strong>
                <label style={{ fontSize: '12px' }}>Category
                  <select value={selectedWall.category || 'exterior'} onChange={(e) => { updateWallRunCategory(selectedWall.id, e.target.value); markTakeoffItemCompleted('wall-category-edit'); }} style={{ width: '100%', padding: '6px', marginTop: '4px' }}>
                    <option value="exterior">Exterior</option>
                    <option value="interior">Interior</option>
                  </select>
                </label>
                {selectedWall.category === 'exterior' && (
                  <>
                    <label style={{ fontSize: '12px' }}>Construction system
                      <select value={selectedWallSystem.system} onChange={(e) => {
                        const nextSystem = e.target.value;
                        const framed = nextSystem === 'brick_veneer' || nextSystem === 'lightweight_cladding';
                        updateWallRun(selectedWall.id, {
                          constructionSystem: nextSystem,
                          frameThicknessMm: framed ? (selectedWallSystem.frameThicknessMm || 70) : null,
                          exteriorType: nextSystem === 'brick_veneer' ? (selectedWallSystem.exteriorFinish === 'rendered_brick' ? 'Rendered Brick Veneer' : 'Face Brick Veneer')
                            : nextSystem === 'lightweight_cladding' ? 'Lightweight Cladding'
                              : nextSystem === 'core_filled_blockwork' ? 'Rendered Masonry'
                                : 'Other',
                        });
                        markTakeoffItemCompleted('wall-construction-system-edit');
                      }} style={{ width: '100%', padding: '6px', marginTop: '4px' }}>
                        {EXTERIOR_CONSTRUCTION_SYSTEMS.map((system) => <option key={system} value={system}>{CONSTRUCTION_SYSTEM_LABELS[system]}</option>)}
                      </select>
                    </label>
                    {(selectedWallSystem.system === 'brick_veneer' || selectedWallSystem.system === 'lightweight_cladding') && (
                      <label style={{ fontSize: '12px' }}>Frame thickness
                        <select value={selectedWallSystem.frameThicknessMm || 70} onChange={(e) => { updateWallRun(selectedWall.id, { frameThicknessMm: Number(e.target.value) }); markTakeoffItemCompleted('wall-frame-thickness-edit'); }} style={{ width: '100%', padding: '6px', marginTop: '4px' }}>
                          <option value={70}>70mm</option>
                          <option value={90}>90mm</option>
                        </select>
                      </label>
                    )}
                    {selectedWallSystem.system === 'brick_veneer' && (
                      <label style={{ fontSize: '12px' }}>Exterior finish
                        <select value={selectedWallSystem.exteriorFinish || 'face_brick'} onChange={(e) => {
                          const finish = e.target.value;
                          updateWallRun(selectedWall.id, { exteriorFinish: finish, exteriorType: finish === 'rendered_brick' ? 'Rendered Brick Veneer' : 'Face Brick Veneer' });
                          markTakeoffItemCompleted('wall-exterior-finish-edit');
                        }} style={{ width: '100%', padding: '6px', marginTop: '4px' }}>
                          <option value="face_brick">Face Brick</option>
                          <option value="rendered_brick">Rendered Brick</option>
                        </select>
                      </label>
                    )}
                    {selectedWallSystem.system === 'lightweight_cladding' && (
                      <>
                        <label style={{ fontSize: '12px' }}>Cladding product
                          <select value={CLADDING_PRODUCTS.includes(selectedWall.exteriorFinish) ? selectedWall.exteriorFinish : 'Unspecified'} onChange={(e) => { updateWallRun(selectedWall.id, { exteriorFinish: e.target.value, exteriorFinishCustomLabel: e.target.value === CLADDING_PRODUCT_CUSTOM ? selectedWall.exteriorFinishCustomLabel || '' : '' }); markTakeoffItemCompleted('wall-cladding-product-edit'); }} style={{ width: '100%', padding: '6px', marginTop: '4px' }}>
                            {CLADDING_PRODUCTS.map((product) => <option key={product} value={product}>{product}</option>)}
                          </select>
                        </label>
                        {selectedWall.exteriorFinish === CLADDING_PRODUCT_CUSTOM && (
                          <label style={{ fontSize: '12px' }}>Custom cladding product description
                            <input type="text" value={selectedWall.exteriorFinishCustomLabel || ''} onChange={(e) => updateWallRun(selectedWall.id, { exteriorFinishCustomLabel: e.target.value })} onBlur={() => markTakeoffItemCompleted('wall-cladding-product-custom-edit')} style={{ width: '100%', padding: '6px', marginTop: '4px' }} />
                          </label>
                        )}
                      </>
                    )}
                    {selectedWallSystem.system === 'custom' && (
                      <label style={{ fontSize: '12px' }}>Custom system description
                        <input type="text" value={selectedWall.customSystemLabel || ''} onChange={(e) => updateWallRun(selectedWall.id, { customSystemLabel: e.target.value })} onBlur={() => markTakeoffItemCompleted('wall-custom-label-edit')} style={{ width: '100%', padding: '6px', marginTop: '4px' }} />
                      </label>
                    )}
                    {selectedWallSystem.system === 'unclassified' && (
                      <span style={{ fontSize: '11px', color: '#b45309', fontWeight: 'bold' }}>&#9888; Unclassified external wall &mdash; select a construction system above to clear this from review.</span>
                    )}
                  </>
                )}
                {selectedWall.category === 'interior' && (
                  <>
                    <label style={{ fontSize: '12px' }}>Construction system
                      <select value={selectedWallSystem.system} onChange={(e) => {
                        const nextSystem = e.target.value;
                        updateWallRun(selectedWall.id, {
                          constructionSystem: nextSystem,
                          ...(nextSystem === 'internal_timber_frame' ? { thicknessMm: selectedWallSystem.frameThicknessMm || 70, frameThicknessMm: selectedWallSystem.frameThicknessMm || 70 } : {}),
                        });
                        markTakeoffItemCompleted('wall-construction-system-edit');
                      }} style={{ width: '100%', padding: '6px', marginTop: '4px' }}>
                        {INTERIOR_CONSTRUCTION_SYSTEMS.map((system) => <option key={system} value={system}>{CONSTRUCTION_SYSTEM_LABELS[system]}</option>)}
                      </select>
                    </label>
                    {selectedWallSystem.system === 'internal_timber_frame' && (
                      <label style={{ fontSize: '12px' }}>Frame thickness
                        <select value={selectedWallSystem.frameThicknessMm || 70} onChange={(e) => { const mm = Number(e.target.value); updateWallRun(selectedWall.id, { thicknessMm: mm, frameThicknessMm: mm }); markTakeoffItemCompleted('wall-frame-thickness-edit'); }} style={{ width: '100%', padding: '6px', marginTop: '4px' }}>
                          <option value={70}>70mm</option>
                          <option value={90}>90mm</option>
                        </select>
                      </label>
                    )}
                    {selectedWallSystem.system === 'custom' && (
                      <label style={{ fontSize: '12px' }}>Custom system description
                        <input type="text" value={selectedWall.customSystemLabel || ''} onChange={(e) => updateWallRun(selectedWall.id, { customSystemLabel: e.target.value })} onBlur={() => markTakeoffItemCompleted('wall-custom-label-edit')} style={{ width: '100%', padding: '6px', marginTop: '4px' }} />
                      </label>
                    )}
                    {selectedWallSystem.system === 'unclassified' && (
                      <span style={{ fontSize: '11px', color: '#b45309', fontWeight: 'bold' }}>&#9888; Unclassified internal wall &mdash; select a construction system above to clear this from review.</span>
                    )}
                    <label style={{ fontSize: '12px' }}>Wall height override (m)
                      <input
                        type="number"
                        step="0.01"
                        value={selectedWall.wallHeightM || ''}
                        onChange={(e) => updateWallRun(selectedWall.id, { wallHeightM: Number(e.target.value) || null })}
                        onBlur={() => markTakeoffItemCompleted('wall-height-override-edit')}
                        style={{ width: '100%', padding: '6px', marginTop: '4px' }}
                      />
                    </label>
                    <label style={{ fontSize: '12px' }}>Lined faces
                      <select value={Number(selectedWall.linedFaces || 2) === 1 ? '1' : '2'} onChange={(e) => { updateWallRun(selectedWall.id, { linedFaces: Number(e.target.value) || 2 }); markTakeoffItemCompleted('wall-lined-faces-edit'); }} style={{ width: '100%', padding: '6px', marginTop: '4px' }}>
                        <option value="1">1 face</option>
                        <option value="2">2 faces</option>
                      </select>
                    </label>
                    <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input type="checkbox" checked={selectedWall.openingDeductionsEnabled !== false} onChange={(e) => { updateWallRun(selectedWall.id, { openingDeductionsEnabled: e.target.checked }); markTakeoffItemCompleted('wall-deduction-toggle'); }} />
                      Deduct linked openings from net area
                    </label>
                  </>
                )}
              </div>
            )}
            {activePageOpenings.find((item) => item.id === selectedOpeningId) && (
              <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px', display: 'grid', gap: '6px' }}>
                <strong style={{ fontSize: '12px' }}>Selected opening</strong>
                {(() => {
                  const opening = activePageOpenings.find((item) => item.id === selectedOpeningId);
                  return (
                    <>
                      <label style={{ fontSize: '12px' }}>Opening class
                        <select value={opening?.openingClass || classifyOpeningValue(opening)} onChange={(e) => { setPlacedOpenings((prev) => prev.map((item) => item.id === opening.id ? { ...item, openingClass: e.target.value } : item)); markTakeoffItemCompleted('opening-class-edit'); }} style={{ width: '100%', padding: '6px', marginTop: '4px' }}>
                          {OPENING_CLASS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                      </label>
                      <label style={{ fontSize: '12px' }}>{opening?.type === 'window' ? 'Window' : 'Door'} Code / Tag
                        <input
                          value={opening?.itemTag || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            setPlacedOpenings((prev) => prev.map((item) => {
                              if (item.id !== opening.id) return item;
                              const next = { ...item, itemTag: value };
                              // "1218" = 1200mm high x 1800mm wide (Australian height-first shorthand,
                              // Phase 2A rule) - typing a valid 4-digit size code fills both dimensions
                              // in one step. A dimension already OBSERVED from a higher-authority window
                              // schedule (AI-read, not derived) is never overwritten by this shorthand;
                              // the builder can still correct either field afterwards regardless.
                              const parsed = item.type === 'window' ? parseWindowSizeCode(value.trim()) : null;
                              if (parsed) {
                                if (item.analysisEvidence?.fields?.heightMm?.basis !== 'OBSERVED') next.heightMm = parsed.heightMm;
                                if (item.analysisEvidence?.fields?.widthMm?.basis !== 'OBSERVED') next.widthMm = parsed.widthMm;
                              }
                              return next;
                            }));
                          }}
                          onBlur={() => markTakeoffItemCompleted('opening-tag-edit')}
                          style={{ width: '100%', padding: '6px', marginTop: '4px' }}
                        />
                      </label>
                      {opening?.type !== 'window' && (
                        <label style={{ fontSize: '12px' }}>Door Type
                          <select
                            value={opening?.subType || ''}
                            onChange={(e) => { setPlacedOpenings((prev) => prev.map((item) => item.id === opening.id ? { ...item, subType: e.target.value } : item)); markTakeoffItemCompleted('opening-door-type-edit'); }}
                            style={{ width: '100%', padding: '6px', marginTop: '4px' }}
                          >
                            <option value="">Choose door type</option>
                            {DOOR_SUBTYPE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select>
                        </label>
                      )}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <label style={{ fontSize: '12px', flex: 1 }}>Height (mm)
                          <input type="number" value={opening?.heightMm || ''} onChange={(e) => setPlacedOpenings((prev) => prev.map((item) => item.id === opening.id ? { ...item, heightMm: parseFloat(e.target.value) || 0 } : item))} onBlur={() => markTakeoffItemCompleted('opening-height-edit')} style={{ width: '100%', padding: '6px', marginTop: '4px' }} />
                        </label>
                        <label style={{ fontSize: '12px', flex: 1 }}>Width (mm)
                          <input type="number" value={opening?.widthMm || ''} onChange={(e) => setPlacedOpenings((prev) => prev.map((item) => item.id === opening.id ? { ...item, widthMm: parseFloat(e.target.value) || 0 } : item))} onBlur={() => markTakeoffItemCompleted('opening-width-edit')} style={{ width: '100%', padding: '6px', marginTop: '4px' }} />
                        </label>
                      </div>
                      {(() => {
                        const room = resolveOpeningRoom(opening);
                        return (
                          <>
                            <label style={{ fontSize: '12px' }}>Room / Location
                              <select
                                value={room.roomKey}
                                onChange={(e) => {
                                  const key = e.target.value;
                                  const canonical = ROOM_LOCATION_OPTIONS.find((r) => r.key === key);
                                  setPlacedOpenings((prev) => prev.map((item) => {
                                    if (item.id !== opening.id) return item;
                                    if (key === ROOM_LOCATION_CUSTOM_KEY) return { ...item, roomKey: key, roomLabel: '', location: '' };
                                    return { ...item, roomKey: key, roomLabel: canonical?.label || '', location: canonical?.label || '' };
                                  }));
                                  markTakeoffItemCompleted('opening-room-edit');
                                }}
                                style={{ width: '100%', padding: '6px', marginTop: '4px' }}
                              >
                                <option value="" disabled>Choose room</option>
                                {ROOM_LOCATION_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
                              </select>
                            </label>
                            {room.roomKey === ROOM_LOCATION_CUSTOM_KEY && (
                              <label style={{ fontSize: '12px' }}>Custom room name
                                <input
                                  value={room.custom ? room.roomLabel : ''}
                                  onChange={(e) => setPlacedOpenings((prev) => prev.map((item) => item.id === opening.id ? { ...item, roomKey: ROOM_LOCATION_CUSTOM_KEY, roomLabel: e.target.value, location: e.target.value } : item))}
                                  onBlur={() => markTakeoffItemCompleted('opening-room-custom-edit')}
                                  style={{ width: '100%', padding: '6px', marginTop: '4px' }}
                                  placeholder="Describe this room/location"
                                />
                              </label>
                            )}
                          </>
                        );
                      })()}
                      <label style={{ fontSize: '12px' }}>Glass type
                        <select value={normaliseGlassType(opening?.glassType)} onChange={(e) => { setPlacedOpenings((prev) => prev.map((item) => item.id === opening.id ? { ...item, glassType: e.target.value } : item)); markTakeoffItemCompleted('opening-glass-edit'); }} style={{ width: '100%', padding: '6px', marginTop: '4px' }}>
                          {GLASS_TYPE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                      </label>
                      {/* Frame/Jamb details, Frame material, Frame colour, Sill type and the manual Brick
                          sill required toggle are intentionally not shown here - they are unnecessary
                          clutter in the normal Takeoff editor. Brick sill requirement is now derived from
                          the host wall's construction system (brickSillLength), not a manual per-opening
                          toggle. Any value an older AI response or import already stored on this opening
                          is preserved untouched; this UI change never deletes it. */}
                    </>
                  );
                })()}
              </div>
            )}
            {activePagePillars.find((item) => item.id === selectedPillarId) && (
              <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px', display: 'grid', gap: '6px' }}>
                <strong style={{ fontSize: '12px' }}>Selected post / column</strong>
                {(() => {
                  const pillar = activePagePillars.find((item) => item.id === selectedPillarId);
                  const update = (patch) => setCompletedPillars((prev) => prev.map((item) => item.id === pillar.id ? { ...item, ...patch } : item));
                  const room = resolveOpeningRoom(pillar);
                  return (
                    <>
                      <label style={{ fontSize: '12px' }}>Post / Column type
                        <select
                          value={pillar.coreType === 'unclassified' ? '' : pillar.coreType}
                          onChange={(e) => { update({ coreType: e.target.value }); markTakeoffItemCompleted('pillar-core-type-edit'); }}
                          style={{ width: '100%', padding: '6px', marginTop: '4px' }}
                        >
                          <option value="" disabled>Choose type</option>
                          {POST_CORE_TYPES.filter((type) => type !== 'unclassified').map((type) => <option key={type} value={type}>{POST_CORE_TYPE_LABELS[type]}</option>)}
                        </select>
                      </label>
                      {pillar.coreType === 'timber' && (
                        <label style={{ fontSize: '12px' }}>Timber size
                          <select
                            value={pillar.timberSizeOption || ''}
                            onChange={(e) => {
                              const option = e.target.value;
                              const [w, d] = option.match(/^(\d+) x (\d+)$/)?.slice(1).map(Number) || [];
                              update({ timberSizeOption: option, ...(w && d ? { coreWidthMm: w, coreDepthMm: d } : {}) });
                              markTakeoffItemCompleted('pillar-timber-size-edit');
                            }}
                            style={{ width: '100%', padding: '6px', marginTop: '4px' }}
                          >
                            <option value="" disabled>Choose size</option>
                            {TIMBER_POST_SIZE_OPTIONS.map((option) => <option key={option} value={option}>{option === 'Custom' ? option : `${option} mm`}</option>)}
                          </select>
                        </label>
                      )}
                      {pillar.coreType === 'steel' && (
                        <>
                          <label style={{ fontSize: '12px' }}>Steel section
                            <select
                              value={pillar.steelSectionType || ''}
                              onChange={(e) => { update({ steelSectionType: e.target.value }); markTakeoffItemCompleted('pillar-steel-section-edit'); }}
                              style={{ width: '100%', padding: '6px', marginTop: '4px' }}
                            >
                              <option value="" disabled>Choose section</option>
                              {STEEL_SECTION_TYPES.map((option) => <option key={option} value={option}>{option}</option>)}
                            </select>
                          </label>
                          {/* The documented designation (e.g. "150 x 100", "Ø89" for a CHS) is the
                              authoritative label for a steel section - a section is not always well
                              represented by plain width x depth (a CHS has one diameter, not two
                              dimensions), so this is preserved alongside, never instead of, the
                              numeric core width/depth used for framing calculations. */}
                          <label style={{ fontSize: '12px' }}>Section size / designation
                            <input
                              value={pillar.steelSectionDesignation || ''}
                              onChange={(e) => update({ steelSectionDesignation: e.target.value })}
                              onBlur={() => markTakeoffItemCompleted('pillar-steel-designation-edit')}
                              style={{ width: '100%', padding: '6px', marginTop: '4px' }}
                              placeholder="e.g. 100 x 100, or Ø89 for CHS"
                            />
                          </label>
                        </>
                      )}
                      {pillar.coreType === 'brick' && (
                        <label style={{ fontSize: '12px' }}>Brick finish
                          <select
                            value={pillar.brickFinish || ''}
                            onChange={(e) => { update({ brickFinish: e.target.value }); markTakeoffItemCompleted('pillar-brick-finish-edit'); }}
                            style={{ width: '100%', padding: '6px', marginTop: '4px' }}
                          >
                            <option value="" disabled>Choose finish</option>
                            {POST_BRICK_FINISH_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                          </select>
                        </label>
                      )}
                      {pillar.coreType === 'custom' && (
                        <label style={{ fontSize: '12px' }}>Custom type description
                          <input value={pillar.coreCustomLabel || ''} onChange={(e) => update({ coreCustomLabel: e.target.value })} onBlur={() => markTakeoffItemCompleted('pillar-core-custom-edit')} style={{ width: '100%', padding: '6px', marginTop: '4px' }} />
                        </label>
                      )}
                      {/* Always visible and always editable, regardless of a standard-size pick:
                          a standard timber size (or a steel/brick selection) fills these in as a
                          shortcut, but the actual mm values shown here - never a hidden preset
                          name - are what is authoritative. Editing either field directly (e.g.
                          150x150 -> 140x140) needs no redraw and no switch to Custom first;
                          picking a new standard size afterwards simply overwrites them again. */}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <label style={{ fontSize: '12px', flex: 1 }}>Width (mm)
                          <input type="number" value={pillar.coreWidthMm || ''} onChange={(e) => update({ coreWidthMm: parseFloat(e.target.value) || null })} onBlur={() => markTakeoffItemCompleted('pillar-core-width-edit')} style={{ width: '100%', padding: '6px', marginTop: '4px' }} />
                        </label>
                        <label style={{ fontSize: '12px', flex: 1 }}>Depth (mm)
                          <input type="number" value={pillar.coreDepthMm || ''} onChange={(e) => update({ coreDepthMm: parseFloat(e.target.value) || null })} onBlur={() => markTakeoffItemCompleted('pillar-core-depth-edit')} style={{ width: '100%', padding: '6px', marginTop: '4px' }} />
                        </label>
                      </div>
                      <label style={{ fontSize: '12px' }}>Surround / Cladding
                        <select
                          value={pillar.surroundType || 'none'}
                          onChange={(e) => { update({ surroundType: e.target.value }); markTakeoffItemCompleted('pillar-surround-type-edit'); }}
                          style={{ width: '100%', padding: '6px', marginTop: '4px' }}
                        >
                          {POST_SURROUND_TYPES.map((type) => <option key={type} value={type}>{POST_SURROUND_TYPE_LABELS[type]}</option>)}
                        </select>
                      </label>
                      {pillar.surroundType && pillar.surroundType !== 'none' && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <label style={{ fontSize: '12px', flex: 1 }}>Finished width (mm)
                            <input type="number" value={pillar.surroundWidthMm || ''} onChange={(e) => update({ surroundWidthMm: parseFloat(e.target.value) || null })} onBlur={() => markTakeoffItemCompleted('pillar-surround-width-edit')} style={{ width: '100%', padding: '6px', marginTop: '4px' }} />
                          </label>
                          <label style={{ fontSize: '12px', flex: 1 }}>Finished depth (mm)
                            <input type="number" value={pillar.surroundDepthMm || ''} onChange={(e) => update({ surroundDepthMm: parseFloat(e.target.value) || null })} onBlur={() => markTakeoffItemCompleted('pillar-surround-depth-edit')} style={{ width: '100%', padding: '6px', marginTop: '4px' }} />
                          </label>
                        </div>
                      )}
                      {pillar.surroundType === 'custom' && (
                        <label style={{ fontSize: '12px' }}>Custom surround description
                          <input value={pillar.surroundCustomLabel || ''} onChange={(e) => update({ surroundCustomLabel: e.target.value })} onBlur={() => markTakeoffItemCompleted('pillar-surround-custom-edit')} style={{ width: '100%', padding: '6px', marginTop: '4px' }} />
                        </label>
                      )}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <label style={{ fontSize: '12px', flex: 1 }}>Height (mm)
                          <input type="number" value={pillar.heightMm || ''} onChange={(e) => update({ heightMm: parseFloat(e.target.value) || null })} onBlur={() => markTakeoffItemCompleted('pillar-height-edit')} style={{ width: '100%', padding: '6px', marginTop: '4px' }} />
                        </label>
                        <label style={{ fontSize: '12px', flex: 1 }}>Quantity
                          <input type="number" min="1" value={pillar.quantity || 1} onChange={(e) => update({ quantity: parseFloat(e.target.value) || 1 })} onBlur={() => markTakeoffItemCompleted('pillar-quantity-edit')} style={{ width: '100%', padding: '6px', marginTop: '4px' }} />
                        </label>
                      </div>
                      <label style={{ fontSize: '12px' }}>Room / Location
                        <select
                          value={room.roomKey}
                          onChange={(e) => {
                            const key = e.target.value;
                            const canonical = ROOM_LOCATION_OPTIONS.find((r) => r.key === key);
                            if (key === ROOM_LOCATION_CUSTOM_KEY) update({ roomKey: key, roomLabel: '', location: '' });
                            else update({ roomKey: key, roomLabel: canonical?.label || '', location: canonical?.label || '' });
                            markTakeoffItemCompleted('pillar-room-edit');
                          }}
                          style={{ width: '100%', padding: '6px', marginTop: '4px' }}
                        >
                          <option value="" disabled>Choose room</option>
                          {ROOM_LOCATION_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
                        </select>
                      </label>
                      {room.roomKey === ROOM_LOCATION_CUSTOM_KEY && (
                        <label style={{ fontSize: '12px' }}>Custom room name
                          <input
                            value={room.custom ? room.roomLabel : ''}
                            onChange={(e) => update({ roomKey: ROOM_LOCATION_CUSTOM_KEY, roomLabel: e.target.value, location: e.target.value })}
                            onBlur={() => markTakeoffItemCompleted('pillar-room-custom-edit')}
                            style={{ width: '100%', padding: '6px', marginTop: '4px' }}
                            placeholder="Describe this room/location"
                          />
                        </label>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {activeTool === 'eaves' && (
          <div style={{ background: '#fff', padding: '12px', borderRadius: '6px', border: '1px solid #00838f', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>Eaves Width:</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
              {EAVE_WIDTH_OPTIONS.map((widthOption) => (
                <button
                  key={widthOption}
                  onClick={() => setEaveWidthOption(widthOption)}
                  style={{ padding: '8px 4px', fontSize: '13px', border: '1px solid #80deea', borderRadius: '4px', background: eaveWidthOption === widthOption ? '#b2ebf2' : '#fff', color: '#006064', fontWeight: eaveWidthOption === widthOption ? 'bold' : 'normal', cursor: 'pointer' }}
                >
                  {widthOption === 'Special' ? 'Special' : `${widthOption}mm`}
                </button>
              ))}
            </div>

            {eaveWidthOption === 'Special' && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: '#e0f7fa', padding: '8px', borderRadius: '4px' }}>
                <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#006064', flex: 1 }}>Special Width:</label>
                <input
                  type="number"
                  value={specialEaveWidthMm}
                  onChange={(e) => setSpecialEaveWidthMm(parseFloat(e.target.value) || 0)}
                  style={{ width: '90px', padding: '6px', fontSize: '14px', fontWeight: 'bold' }}
                />
                <span style={{ fontSize: '14px', color: '#00838f' }}>mm</span>
              </div>
            )}

            <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>Level:</label>
            <select
              value={eaveLevel}
              onChange={(e) => setEaveLevel(e.target.value)}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #80deea', fontSize: '14px', fontWeight: 'bold', background: '#fff' }}
            >
              {EAVE_LEVEL_OPTIONS.map((level) => <option key={level} value={level}>{level}</option>)}
            </select>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>Eaves Alignment:</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setEaveAlignment('outer')}
                  style={{ flex: 1, padding: '6px', fontSize: '13px', border: '1px solid #80deea', borderRadius: '4px', background: eaveAlignment === 'outer' ? '#b2ebf2' : '#fff', color: '#006064', fontWeight: eaveAlignment === 'outer' ? 'bold' : 'normal', cursor: 'pointer' }}
                >
                  Outer Face
                </button>
                <button
                  onClick={() => setEaveAlignment('inner')}
                  style={{ flex: 1, padding: '6px', fontSize: '13px', border: '1px solid #80deea', borderRadius: '4px', background: eaveAlignment === 'inner' ? '#b2ebf2' : '#fff', color: '#006064', fontWeight: eaveAlignment === 'inner' ? 'bold' : 'normal', cursor: 'pointer' }}
                >
                  Inner Face
                </button>
              </div>
            </div>

            {selectedEave && (
              <div style={{ background: '#e0f7fa', padding: '8px', borderRadius: '4px', border: '1px solid #80deea', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#006064' }}>Selected Eaves Editing:</span>
                <select
                  value={selectedEave.widthOption}
                  onChange={(e) => {
                    const widthOption = e.target.value;
                    const widthMm = widthOption === 'Special' ? specialEaveWidthMm : parseFloat(widthOption) || 0;
                    setCompletedEaves((prev) => prev.map((item) => item.id === selectedEave.id ? { ...item, widthOption, widthMm } : item));
                  }}
                  style={{ padding: '6px', fontSize: '12px', fontWeight: 'bold' }}
                >
                  {EAVE_WIDTH_OPTIONS.map((widthOption) => <option key={widthOption} value={widthOption}>{widthOption === 'Special' ? 'Special' : `${widthOption}mm`}</option>)}
                </select>
                <select
                  value={resolveTakeoffLevel(selectedEave, sheetLevels)}
                  onChange={(e) => setCompletedEaves((prev) => prev.map((item) => item.id === selectedEave.id ? { ...item, level: e.target.value } : item))}
                  style={{ padding: '6px', fontSize: '12px', fontWeight: 'bold' }}
                >
                  {resolveTakeoffLevel(selectedEave, sheetLevels) === 'Unassigned' && <option value="Unassigned">Not assigned</option>}
                  {EAVE_LEVEL_OPTIONS.map((level) => <option key={level} value={level}>{level}</option>)}
                </select>
                <select
                  value={selectedEave.alignment || 'outer'}
                  onChange={(e) => setCompletedEaves((prev) => prev.map((item) => item.id === selectedEave.id ? { ...item, alignment: e.target.value } : item))}
                  style={{ padding: '6px', fontSize: '12px', fontWeight: 'bold' }}
                >
                  <option value="outer">Outer Face</option>
                  <option value="inner">Inner Face</option>
                </select>
              </div>
            )}

            {eavePoints.length >= 2 && (
              <button
                onClick={finalizeCurrentEaveRun}
                style={{ width: '100%', padding: '10px', background: '#e0f7fa', color: '#006064', border: '1px solid #80deea', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
              >
                Finish Eaves Run ({eavePoints.length} points)
              </button>
            )}
          </div>
        )}

        {activeTool === 'floorplan' && (
          <div style={{ background: '#fff', padding: '12px', borderRadius: '6px', border: '1px solid #1565c0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>Select Floorplan Category:</label>
            <select
              value={floorplanType}
              onChange={(e) => setFloorplanType(e.target.value)}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '14px', fontWeight: 'bold' }}
            >
              {FLOORPLAN_TYPES.map((ft) => <option key={ft.id} value={ft.id}>{ft.label}</option>)}
            </select>
            <span style={{ fontSize: '12px', color: '#666', fontStyle: 'italic' }}>
              Click on the map to place boundary points. Double click or click finish to save.
            </span>

            {selectedFp && (
              <div style={{ background: '#e3f2fd', padding: '8px', borderRadius: '4px', border: '1px solid #90caf9', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#0d47a1' }}>Selected Floorplan Editing:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Change Type:</label>
                  <select
                    value={selectedFp.type}
                    onChange={(e) => updateFloorplanType(selectedFp.id, e.target.value)}
                    style={{ flex: 1, padding: '4px', fontSize: '12px', fontWeight: 'bold' }}
                  >
                    {FLOORPLAN_TYPES.map((ft) => <option key={ft.id} value={ft.id}>{ft.label}</option>)}
                  </select>
                </div>
              </div>
            )}

            {activeAreaPolyline.length > 2 && (
              <button
                onClick={finalizeCurrentArea}
                style={{ width: '100%', padding: '10px', background: '#e3f2fd', color: '#1565c0', border: '1px solid #90caf9', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
              >
                Save {floorplanType} Boundary
              </button>
            )}
          </div>
        )}

        {activeTool === 'floorcoverings' && (
          <div style={{ background: '#fff', padding: '12px', borderRadius: '6px', border: '1px solid #4caf50', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => setAreaDrawMode('polygon')}
                style={{ flex: 1, padding: '8px', fontSize: '13px', fontWeight: '600', border: '1px solid #ccc', borderRadius: '4px', background: areaDrawMode === 'polygon' ? '#e8f5e9' : '#fff' }}
              >
                Polygon (Free)
              </button>
              <button
                onClick={() => setAreaDrawMode('box')}
                style={{ flex: 1, padding: '8px', fontSize: '13px', fontWeight: '600', border: '1px solid #ccc', borderRadius: '4px', background: areaDrawMode === 'box' ? '#e8f5e9' : '#fff' }}
              >
                Box Drag
              </button>
              <button
                onClick={() => setAreaDrawMode('exclusion')}
                style={{ flex: 1, padding: '8px', fontSize: '13px', fontWeight: '600', border: '1px solid #ccc', borderRadius: '4px', background: areaDrawMode === 'exclusion' ? '#ffebee' : '#fff' }}
              >
                Exclusion
              </button>
            </div>
            <select
              value={floorcoveringOption}
              onChange={(e) => setFloorcoveringOption(e.target.value)}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '14px', fontWeight: 'bold' }}
            >
              {FLOORCOVERING_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            <span style={{ fontSize: '12px', color: '#666', fontStyle: 'italic' }}>
              Area markup moves freely in any direction (diagonals permitted).
            </span>

            {activeAreaPolyline.length > 2 && (
              <button
                onClick={finalizeCurrentArea}
                style={{ width: '100%', padding: '10px', background: '#e8f5e9', color: '#2e7d32', border: '1px solid #a5d6a7', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
              >
                Complete Floorcovering Area
              </button>
            )}
          </div>
        )}

        {activeTool === 'roofarea' && (
          <div style={{ background: '#fff', padding: '12px', borderRadius: '6px', border: '1px solid #f59e0b', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <strong style={{ color: '#92400e' }}>Roof Area Takeoff</strong>
            <select value={roofAreaLevel} onChange={(event) => setRoofAreaLevel(event.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #f59e0b', fontWeight: 'bold' }}>
              <option>Ground Floor</option>
              <option>Second Level</option>
              <option>Third Level</option>
            </select>
            <span style={{ fontSize: '12px', color: '#666' }}>Click each roof boundary corner, then click the first corner again or use Complete Roof Area.</span>
            {activeAreaPolyline.length > 2 && <button onClick={finalizeCurrentArea} style={{ width: '100%', padding: '10px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Complete Roof Area</button>}
          </div>
        )}

        {/* Floorcovering Schedule Summary Card */}
        <div style={{ background: '#fff', padding: '12px', borderRadius: '6px', border: '2px solid #2e7d32', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h4 style={{ margin: 0, fontSize: '15px', color: '#2e7d32', borderBottom: '1px solid #eee', paddingBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Square size={16} /> Floorcovering Schedule (Sheet {currentPage})
          </h4>
          {FLOORCOVERING_OPTIONS.map((cat) => {
            const catTotal = pageFloorcoveringTotals[cat] || 0;
            const cfg = FLOORCOVERING_CONFIGS[cat];
            return (
              <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '12px', height: '12px', background: cfg.stroke, display: 'inline-block', borderRadius: '2px' }}></span>
                  Total {cat}:
                </span>
                <strong>{catTotal.toFixed(2)} m²</strong>
              </div>
            );
          })}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 'bold', borderTop: '1px dashed #ccc', paddingTop: '6px', color: '#1b5e20' }}>
            <span>Total Floor Area:</span>
            <span>{totalFloorAreaM2.toFixed(2)} m²</span>
          </div>
        </div>

        {/* Schedule of Areas Summary Card */}
        <div style={{ background: '#fff', padding: '12px', borderRadius: '6px', border: '2px solid #1565c0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h4 style={{ margin: 0, fontSize: '15px', color: '#1565c0', borderBottom: '1px solid #eee', paddingBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Home size={16} /> Schedule of Areas (Sheet {currentPage})
          </h4>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
            <span>Gross Footprint Area:</span>
            <strong>{pageFootprintArea.toFixed(2)} m²</strong>
          </div>
          {activePageFloorplans.filter(f => f.type !== 'Footprint').map((fp) => (
            <div key={fp.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', paddingLeft: '8px', color: '#555' }}>
              <span>Less {fp.label}:</span>
              <span>- {calculatePolygonAreaM2(fp.nodes, pixelsPerMm).toFixed(2)} m²</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 'bold', borderTop: '1px dashed #ccc', paddingTop: '6px', color: '#0d47a1' }}>
            <span>Total Living Area:</span>
            <span>{pageTotalLivingArea.toFixed(2)} m²</span>
          </div>
        </div>

        {/* Eaves Schedule Summary Card */}
        <div style={{ background: '#fff', padding: '12px', borderRadius: '6px', border: '2px solid #00838f', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h4 style={{ margin: 0, fontSize: '15px', color: '#00838f', borderBottom: '1px solid #eee', paddingBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Home size={16} /> Eaves Schedule (Sheet {currentPage})
          </h4>
          {EAVE_LEVEL_OPTIONS.map((level) => {
            const levelTotalMm = EAVE_WIDTH_OPTIONS.reduce((sum, widthOption) => sum + (pageEaveTotals[level][widthOption] || 0), 0);
            if (levelTotalMm === 0) return null;
            return (
              <div key={level} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'bold', color: '#006064' }}>
                  <span>{level}</span>
                  <span>{(levelTotalMm / 1000).toFixed(2)} m</span>
                </div>
                {EAVE_WIDTH_OPTIONS.map((widthOption) => {
                  const totalMm = pageEaveTotals[level][widthOption] || 0;
                  if (totalMm === 0) return null;
                  return (
                    <div key={`${level}-${widthOption}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', paddingLeft: '8px', color: '#555' }}>
                      <span>{widthOption === 'Special' ? 'Special' : `${widthOption}mm`}:</span>
                      <span>{(totalMm / 1000).toFixed(2)} m</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
          {totalEavesLengthMm === 0 && (
            <span style={{ fontSize: '13px', color: '#888', fontStyle: 'italic' }}>No eaves measured on this sheet.</span>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 'bold', borderTop: '1px dashed #ccc', paddingTop: '6px', color: '#006064' }}>
            <span>Total Eaves:</span>
            <span>{(totalEavesLengthMm / 1000).toFixed(2)} m</span>
          </div>
        </div>

        <div style={{ background: '#fff', padding: '12px', borderRadius: '6px', border: '1px solid #ddd', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h4 style={{ margin: 0, fontSize: '15px', borderBottom: '1px solid #eee', paddingBottom: '6px' }}>
            Sheet {currentPage} Takeoff List
          </h4>

          <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {activePageFloorplans.map((fp) => (
              <div 
                key={fp.id} 
                onClick={() => selectOnly('floorplan', fp.id)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', background: fp.id === selectedFloorplanId ? '#bbdefb' : '#e3f2fd', padding: '6px 8px', borderRadius: '4px', cursor: 'pointer', border: fp.id === selectedFloorplanId ? '1px solid #1976d2' : 'none' }}
              >
                <span><strong>[Plan] {fp.label}:</strong> {calculatePolygonAreaM2(fp.nodes, pixelsPerMm).toFixed(2)} m²</span>
                <Trash2 size={16} style={{ cursor: 'pointer', color: '#d32f2f' }} onClick={(e) => { e.stopPropagation(); deleteMarkupItem('floorplan', fp.id); }} />
              </div>
            ))}

            {activePageAreas.map((areaItem) => {
              const cfg = FLOORCOVERING_CONFIGS[areaItem.category] || { stroke: '#2e7d32' };
              const isSelected = areaItem.id === selectedAreaId;
              return (
                <div 
                  key={areaItem.id} 
                  onClick={() => selectOnly('area', areaItem.id)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', background: isSelected ? '#c8e6c9' : '#f1f8e9', padding: '6px 8px', borderRadius: '4px', cursor: 'pointer', borderLeft: `4px solid ${cfg.stroke}`, border: isSelected ? '1px solid #2e7d32' : 'none' }}
                >
                  <span><strong>{areaItem.category}:</strong> {getNetFloorcoveringAreaM2(areaItem, pixelsPerMm).toFixed(2)} m²</span>
                  <Trash2 size={16} style={{ cursor: 'pointer', color: '#d32f2f' }} onClick={(e) => { e.stopPropagation(); deleteMarkupItem('area', areaItem.id); }} />
                </div>
              );
            })}

            {activePageWalls.map((wall) => {
              const isSelected = wall.id === selectedWallId;
              return (
                <div 
                  key={wall.id}
                  onClick={() => selectOnly('wall', wall.id)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', background: isSelected ? '#bbdefb' : '#e3f2fd', padding: '6px 8px', borderRadius: '4px', cursor: 'pointer', border: isSelected ? '1px solid #1976d2' : 'none' }}
                >
                  <span><strong>{wall.category} ({wall.thicknessMm}mm):</strong> {(wall.lengthMm / 1000).toFixed(2)} m</span>
                  <Trash2 size={16} style={{ cursor: 'pointer', color: '#d32f2f' }} onClick={(e) => { e.stopPropagation(); deleteMarkupItem('wall', wall.id); }} />
                </div>
              );
            })}

            {activePageMeasurements.map((meas, idx) => {
              const distPx = Math.hypot(meas.p2.x - meas.p1.x, meas.p2.y - meas.p1.y);
              const distMm = pixelsPerMm ? distPx / pixelsPerMm : 0;
              return (
                <div key={meas.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', background: '#e8f5e9', padding: '6px 8px', borderRadius: '4px', border: '1px solid #a5d6a7' }}>
                  <span><strong>Measurement #{idx + 1}:</strong> {pixelsPerMm ? `${distMm.toFixed(0)} mm` : `${distPx.toFixed(1)} px`}</span>
                  <Trash2 size={16} style={{ cursor: 'pointer', color: '#d32f2f' }} onClick={() => deleteMarkupItem('measure', meas.id)} />
                </div>
              );
            })}

            {activePageEaves.map((eave, idx) => {
              const distMm = getEaveLengthMm(eave, pixelsPerMm);
              const fallbackPx = getEaveNodes(eave).reduce((sum, node, nodeIdx, nodes) => {
                if (nodeIdx === 0) return 0;
                return sum + Math.hypot(node.x - nodes[nodeIdx - 1].x, node.y - nodes[nodeIdx - 1].y);
              }, 0);
              return (
                <div
                  key={eave.id}
                  onClick={() => selectOnly('eaves', eave.id)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', background: eave.id === selectedEaveId ? '#b2ebf2' : '#e0f7fa', padding: '6px 8px', borderRadius: '4px', border: eave.id === selectedEaveId ? '1px solid #00838f' : '1px solid #80deea', cursor: 'pointer' }}
                >
                  <span><strong>Eaves #{idx + 1}:</strong> {getEaveWidthLabel(eave)} {resolveTakeoffLevel(eave, sheetLevels)} - {pixelsPerMm ? `${(distMm / 1000).toFixed(2)} m` : `${fallbackPx.toFixed(1)} px`}</span>
                  <Trash2 size={16} style={{ cursor: 'pointer', color: '#d32f2f' }} onClick={(e) => { e.stopPropagation(); deleteMarkupItem('eaves', eave.id); }} />
                </div>
              );
            })}

            {activePageOpenings.map((op, idx) => {
              const tagPrefix = op.type === 'window' ? 'W' : 'D';
              const dynamicTag = `${tagPrefix}${idx + 1}: ${op.itemTag.split(': ')[1] || op.itemTag}`;
              const isSelected = op.id === selectedOpeningId;
              return (
                <div 
                  key={op.id} 
                  onClick={() => selectOnly('opening', op.id)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', background: isSelected ? '#ffe0b2' : '#fff3e0', padding: '8px', borderRadius: '4px', border: isSelected ? '1px solid #f57c00' : '1px solid #ffe0b2', cursor: 'pointer' }}
                >
                  <span><strong>{dynamicTag}</strong> (H:{op.heightMm} x W:{op.widthMm})</span>
                  <Trash2 size={16} style={{ cursor: 'pointer', color: '#d32f2f' }} onClick={(e) => { e.stopPropagation(); deleteMarkupItem('opening', op.id); }} />
                </div>
              );
            })}

            {activePagePillars.map((pillar) => {
              const core = resolvePostColumnCore(pillar);
              const isSelected = pillar.id === selectedPillarId;
              const sizeLabel = pillar.coreWidthMm && pillar.coreDepthMm ? `${pillar.coreWidthMm}x${pillar.coreDepthMm}` : 'size not set';
              return (
                <div
                  key={pillar.id}
                  onClick={() => selectOnly('pillar', pillar.id)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', background: isSelected ? '#c7d2fe' : '#e0e7ff', padding: '8px', borderRadius: '4px', border: isSelected ? '1px solid #4338ca' : '1px solid #c7d2fe', cursor: 'pointer' }}
                >
                  <span><strong>{core.displayLabel}</strong> ({sizeLabel})</span>
                  <Trash2 size={16} style={{ cursor: 'pointer', color: '#d32f2f' }} onClick={(e) => { e.stopPropagation(); deleteMarkupItem('pillar', pillar.id); }} />
                </div>
              );
            })}

            {activePageFloorplans.length === 0 && activePageAreas.length === 0 && activePageWalls.length === 0 && activePageOpenings.length === 0 && activePageMeasurements.length === 0 && activePageEaves.length === 0 && activePagePillars.length === 0 && (
              <span style={{ fontSize: '13px', color: '#888', fontStyle: 'italic' }}>No markups on this sheet yet.</span>
            )}
          </div>
        </div>

        <div style={{ background: '#fff', padding: '12px', borderRadius: '6px', border: '2px solid #334155', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h4 style={{ margin: 0, fontSize: '15px', color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
            Exterior Wall Classifications
          </h4>
          {EXTERIOR_WALL_CLASS_OPTIONS.map((className) => (
            <div key={`legend-${className}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '12px', background: EXTERIOR_WALL_CLASS_COLOURS[className] || EXTERIOR_WALL_CLASS_COLOURS.Other, borderRadius: '2px' }} />
                {className}
              </span>
              <strong>{(exteriorWallClassificationTotals.all[className] || 0).toFixed(2)} m</strong>
            </div>
          ))}
          {Object.entries(exteriorWallClassificationTotals.byFloor).map(([floor, totals]) => (
            <div key={`floor-${floor}`} style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '6px' }}>
              <strong style={{ fontSize: '12px', color: '#334155' }}>{floor}</strong>
              {EXTERIOR_WALL_CLASS_OPTIONS.map((className) => (
                <div key={`${floor}-${className}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#475569' }}>
                  <span>{className}</span>
                  <span>{(totals[className] || 0).toFixed(2)} m</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div style={{ background: '#212121', color: '#fff', padding: '14px', borderRadius: '6px', fontSize: '15px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div><strong>Total Floorcoverings Area:</strong> {totalFloorAreaM2.toFixed(2)} m²</div>
          <div><strong>Net Exterior Walls:</strong> {(netExteriorWallLengthMm / 1000).toFixed(2)} m</div>
          <div><strong>Interior Walls:</strong> {(rawInteriorWallLengthMm / 1000).toFixed(2)} m</div>
          <div><strong>Eaves:</strong> {(totalEavesLengthMm / 1000).toFixed(2)} m</div>
          <div><strong>Openings Deducted:</strong> {(totalOpeningsWidthMm / 1000).toFixed(2)} m</div>
        </div>
      </div>

      {showSchedule && (
        <div style={{ position: 'fixed', inset: '24px', background: '#f9fafb', border: '1px solid #9ca3af', borderRadius: '8px', zIndex: 50, display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #d1d5db', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111827', color: '#fff', borderRadius: '8px 8px 0 0' }}>
            <strong style={{ fontSize: '18px' }}>Takeoff Schedule</strong>
            {/* Colour must be explicit: the header sets color:#fff, which this button would otherwise inherit onto its white background. */}
            <button onClick={() => setShowSchedule(false)} style={{ background: '#fff', color: '#111827', border: 'none', borderRadius: '4px', padding: '6px 10px', cursor: 'pointer', fontWeight: 'bold' }}>Close</button>
          </div>

          <div style={{ padding: '12px 16px', borderBottom: '1px solid #d1d5db', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', background: '#fff' }}>
            <input value={projectInfo.projectName} onChange={(e) => setProjectInfo((prev) => ({ ...prev, projectName: e.target.value }))} placeholder="Project name" style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
            <input value={projectInfo.clientName} onChange={(e) => setProjectInfo((prev) => ({ ...prev, clientName: e.target.value }))} placeholder="Client name" style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
            <input value={projectInfo.siteAddress} onChange={(e) => setProjectInfo((prev) => ({ ...prev, siteAddress: e.target.value }))} placeholder="Site address" style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
            <input value={projectInfo.storeyOrLevelName} onChange={(e) => setProjectInfo((prev) => ({ ...prev, storeyOrLevelName: e.target.value }))} placeholder="Storey / level name" style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
          </div>

          <div style={{ padding: '10px 16px', display: 'flex', gap: '8px', alignItems: 'center', borderBottom: '1px solid #d1d5db', background: '#f3f4f6' }}>
            <button onClick={handleExportExcel} style={{ padding: '8px 10px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Export Excel</button>
            <button onClick={handleExportCsv} style={{ padding: '8px 10px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Export CSV</button>
            <button onClick={handleExportPdfSchedule} style={{ padding: '8px 10px', background: '#7c2d12', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Export PDF Schedule</button>
            <button disabled={isRecoveryPreview} onClick={handleSendToJobSetup} style={{ padding: '8px 10px', background: isRecoveryPreview ? '#94a3b8' : '#4b5563', color: '#fff', border: 'none', borderRadius: '4px', cursor: isRecoveryPreview ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>Export Takeoff to Job Setup</button>
            <button disabled={isRecoveryPreview} onClick={handlePrepareQuotePreview} style={{ padding: '8px 10px', background: isRecoveryPreview ? '#94a3b8' : (quoteSheetOutOfDate ? '#f57c00' : '#111827'), color: '#fff', border: 'none', borderRadius: '4px', cursor: isRecoveryPreview ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
              {quoteSheetOutOfDate ? 'Update from Takeoff' : 'Send to Quote Sheet'}
            </button>
          </div>

          <div style={{ padding: '14px 16px', overflow: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ background: '#fff', border: '1px solid #d1d5db', borderRadius: '6px', padding: '10px', fontSize: '13px' }}>
                <strong>Project and Floor Information</strong>
                <div>Project: {takeoffSchedule.project.projectName || 'Not set'}</div>
                <div>Client: {takeoffSchedule.project.clientName || 'Not set'}</div>
                <div>Site: {takeoffSchedule.project.siteAddress || 'Not set'}</div>
                <div>Plan filename: {takeoffSchedule.project.planFilename || 'Not set'}</div>
                <div>Plan sheets: {takeoffSchedule.project.numberOfPlanSheets}</div>
                <div>Current sheet scale: {pixelsPerMm ? `${pixelsPerMm.toFixed(3)} px/mm` : 'Not calibrated'}</div>
              </div>
              <h4 style={{ margin: 0 }}>Current Sheet {currentPage}</h4>
              {renderScheduleRows('Floor Areas', takeoffSchedule.currentSheet.floorAreas)}
              {renderWallSystemSchedule('Exterior Walls', takeoffSchedule.currentSheet.wallSystems, 'external')}
              {renderWallSystemSchedule('Internal Walls', takeoffSchedule.currentSheet.wallSystems, 'internal')}
              <details style={{ border: '1px solid #e5e7eb', borderRadius: '6px', background: '#fafafa' }}>
                <summary style={{ padding: '6px 10px', cursor: 'pointer', fontSize: '12px', color: '#6b7280' }}>Diagnostic wall detail (advanced)</summary>
                <div style={{ padding: '6px' }}>
                  {renderScheduleRows('Interior Walls and Plasterboard', takeoffSchedule.currentSheet.interiorWallsAndPlasterboard, 'Length')}
                </div>
              </details>
              {renderWindowSchedule(takeoffSchedule.currentSheet.windows)}
              {renderDoorSchedule(takeoffSchedule.currentSheet.doors)}
              {renderScheduleRows('Roof Areas', takeoffSchedule.currentSheet.roofAreas)}
              {renderScheduleRows('Roof and Eaves', takeoffSchedule.currentSheet.roofAndEaves)}
              {renderScheduleRows('Floor Finishes', takeoffSchedule.currentSheet.floorFinishes)}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h4 style={{ margin: 0 }}>Combined Project Totals</h4>
              {renderScheduleRows('Floor Areas', takeoffSchedule.projectTotals.floorAreas)}
              {renderWallSystemSchedule('Exterior Walls', takeoffSchedule.projectTotals.wallSystems, 'external')}
              {renderWallSystemSchedule('Internal Walls', takeoffSchedule.projectTotals.wallSystems, 'internal')}
              <details style={{ border: '1px solid #e5e7eb', borderRadius: '6px', background: '#fafafa' }}>
                <summary style={{ padding: '6px 10px', cursor: 'pointer', fontSize: '12px', color: '#6b7280' }}>Diagnostic wall detail (advanced)</summary>
                <div style={{ padding: '6px' }}>
                  {renderScheduleRows('Interior Walls and Plasterboard', takeoffSchedule.projectTotals.interiorWallsAndPlasterboard, 'Length')}
                  {renderScheduleRows('Individual Wall Records', takeoffSchedule.projectTotals.wallRecords, 'Length')}
                </div>
              </details>
              {renderWindowSchedule(takeoffSchedule.projectTotals.windows)}
              {renderDoorSchedule(takeoffSchedule.projectTotals.doors)}
              {renderScheduleRows('Roof Areas', takeoffSchedule.projectTotals.roofAreas)}
              {renderScheduleRows('Roof and Eaves', takeoffSchedule.projectTotals.roofAndEaves)}
              {renderScheduleRows('Floor Finishes', takeoffSchedule.projectTotals.floorFinishes)}
              {renderScheduleRows('Rooms and Measurements', takeoffSchedule.projectTotals.rooms)}
              {renderScheduleRows('Custom Takeoffs', takeoffSchedule.projectTotals.customTakeoffs)}
            </div>

            {jobSetupPayload && (
              <div style={{ gridColumn: '1 / -1', background: '#eef2ff', border: '1px solid #a5b4fc', borderRadius: '6px', padding: '10px', fontSize: '12px' }}>
                <strong>Job Setup Payload Ready</strong>
                <pre style={{ whiteSpace: 'pre-wrap', margin: '8px 0 0' }}>{JSON.stringify(jobSetupPayload, null, 2)}</pre>
              </div>
            )}

            {quotePreviewRows.length > 0 && (
              <div style={{ gridColumn: '1 / -1', background: '#fff', border: '1px solid #d1d5db', borderRadius: '6px', padding: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <strong>Quote Sheet Preview and Mapping</strong>
                  <button disabled={isRecoveryPreview} onClick={handleApplyQuotePreview} style={{ padding: '8px 10px', background: isRecoveryPreview ? '#94a3b8' : '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', cursor: isRecoveryPreview ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>Apply Mapped Quantities</button>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: '#f3f4f6' }}>
                      <th style={{ padding: '6px', textAlign: 'left' }}>Takeoff Category</th>
                      <th style={{ padding: '6px', textAlign: 'right' }}>Measured</th>
                      <th style={{ padding: '6px', textAlign: 'left' }}>Unit</th>
                      <th style={{ padding: '6px', textAlign: 'left' }}>Destination Quote Row</th>
                      <th style={{ padding: '6px', textAlign: 'right' }}>Existing</th>
                      <th style={{ padding: '6px', textAlign: 'right' }}>New</th>
                      <th style={{ padding: '6px', textAlign: 'left' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotePreviewRows.map((row) => (
                      <tr key={row.itemId}>
                        <td style={{ padding: '6px', borderBottom: '1px solid #eee' }}>{row.takeoffCategory}</td>
                        <td style={{ padding: '6px', borderBottom: '1px solid #eee', textAlign: 'right' }}>{row.measuredQuantity}</td>
                        <td style={{ padding: '6px', borderBottom: '1px solid #eee' }}>{row.unit}</td>
                        <td style={{ padding: '6px', borderBottom: '1px solid #eee' }}>
                          <select value={row.destinationRowId} onChange={(e) => handleQuoteMappingChange(row.itemId, e.target.value)} style={{ width: '100%', padding: '5px' }}>
                            <option value="">Unmapped</option>
                            {quoteSheetRows.map((quoteRow) => <option key={quoteRow.id} value={quoteRow.id}>{quoteRow.description}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '6px', borderBottom: '1px solid #eee', textAlign: 'right' }}>{row.existingQuantity ?? ''}</td>
                        <td style={{ padding: '6px', borderBottom: '1px solid #eee', textAlign: 'right', fontWeight: 'bold' }}>{row.newQuantity}</td>
                        <td style={{ padding: '6px', borderBottom: '1px solid #eee', color: row.status === 'unmapped' ? '#b91c1c' : row.status === 'changed' ? '#f57c00' : '#166534', fontWeight: 'bold' }}>{row.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Canvas Area */}
      <div
        ref={canvasHostRef}
        onPointerDownCapture={isRecoveryPreview ? undefined : handleStageContentPointerDown}
        onPointerMoveCapture={isRecoveryPreview ? undefined : handleStageContentPointerMove}
        onPointerUpCapture={isRecoveryPreview ? undefined : handleStageContentPointerUp}
        onPointerCancelCapture={isRecoveryPreview ? undefined : handleStageContentPointerUp}
        onMouseDownCapture={isRecoveryPreview ? undefined : handleStageContentPointerDown}
        onMouseMoveCapture={isRecoveryPreview ? undefined : handleStageContentPointerMove}
        onMouseUpCapture={isRecoveryPreview ? undefined : handleStageContentPointerUp}
        style={{ flex: 1, position: 'relative', background: '#e5e5e5', minWidth: 0, touchAction: 'none' }}
      >
        {/* A plan that failed to restore must name what failed. Without this the canvas is simply
            blank, which looks identical to a job that has no plan and hides the asset id. The open
            that failed never reached loadJobData, so the workspace behind this notice is intact. */}
        {planLoadError && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(248, 250, 252, 0.96)' }}>
            <div style={{ background: '#fff', border: '2px solid #dc2626', borderRadius: '8px', padding: '24px', maxWidth: '520px', boxShadow: '0 16px 40px rgba(15, 23, 42, 0.18)' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#991b1b', marginBottom: '8px' }}>
                Plan could not be loaded{planLoadError.jobName ? `: ${planLoadError.jobName}` : ''}
              </div>
              <div style={{ fontSize: '13px', color: '#334155', lineHeight: 1.6, marginBottom: '8px', wordBreak: 'break-word' }}>
                {planLoadError.message}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.5, marginBottom: '16px' }}>
                Nothing was changed. The takeoff open on screen is still the one you had.
                Console entries tagged TAKEOFF_PLAN_LOAD record each step of the attempt.
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px 14px', background: '#1976d2', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
                  <Upload size={16} /> Relink Original Plan
                  <input type="file" accept="image/*,.pdf" onChange={(event) => { setPlanLoadError(null); handleFileUpload(event, { preserveTakeoffs: true }); }} style={{ display: 'none' }} />
                </label>
                <button type="button" onClick={() => setPlanLoadError(null)} style={{ padding: '10px 14px', background: '#fff', color: '#111827', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}
        {planMissingFromSavedJob && !image && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
            <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '24px', maxWidth: '420px', textAlign: 'center', boxShadow: '0 16px 40px rgba(15, 23, 42, 0.12)' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#991b1b', marginBottom: '8px' }}>Plan file missing from saved job</div>
              <div style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5, marginBottom: '16px' }}>Relink the original plan to restore the drawing background. Existing takeoff overlays will be kept.</div>
              <label style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px 14px', background: '#1976d2', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
                <Upload size={16} /> Relink Original Plan
                <input type="file" accept="image/*,.pdf" onChange={(event) => handleFileUpload(event, { preserveTakeoffs: true })} style={{ display: 'none' }} />
              </label>
            </div>
          </div>
        )}
        <Stage
          width={canvasSize.width}
          height={canvasSize.height}
          onWheel={(e) => {
            e.evt.preventDefault();
            const scaleBy = 1.1;
            const stage = stageRef.current;
            if (!stage) return;
            const oldScale = stage.scaleX();
            const pointer = stage.getPointerPosition();
            if (!pointer) return;
            const mousePointTo = { x: (pointer.x - stage.x()) / oldScale, y: (pointer.y - stage.y()) / oldScale };
            const newScale = Math.max(0.05, Math.min(20, e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy));
            const nextPos = { x: pointer.x - mousePointTo.x * newScale, y: pointer.y - mousePointTo.y * newScale };

            setStageScale(newScale);
            setStagePos(nextPos);
            rememberCurrentSheetView({ scale: newScale, pos: nextPos });
          }}
          onClick={isRecoveryPreview ? undefined : handleStageClick}
          onDblClick={isRecoveryPreview ? undefined : () => {
            if (activeTool === 'wall') finalizeCurrentWallRun();
            else if (activeTool === 'eaves') finalizeCurrentEaveRun();
            else if (activeTool === 'floorplan' || activeTool === 'floorcoverings' || activeTool === 'roofarea') finalizeCurrentArea();
          }}
          onMouseMove={isRecoveryPreview ? undefined : handleMouseMove}
          onMouseUp={isRecoveryPreview ? undefined : handleMouseUp}
          draggable={false}
          scaleX={stageScale}
          scaleY={stageScale}
          x={stagePos.x}
          y={stagePos.y}
          style={{ cursor: activeTool === 'select' ? 'pointer' : 'crosshair' }}
          ref={stageRef}
        >
          <Layer
            ref={layerRef}
            listening={!isRecoveryPreview}
            rotation={rotation}
            x={logicalImageWidth / 2}
            y={logicalImageHeight / 2}
            offsetX={logicalImageWidth / 2}
            offsetY={logicalImageHeight / 2}
          >
            <Rect
              x={0}
              y={0}
              width={logicalImageWidth || currentPlanPage?.logicalWidth || 0}
              height={logicalImageHeight || currentPlanPage?.logicalHeight || 0}
              fill="rgba(0,0,0,0)"
              listening={!isRecoveryPreview}
            />
            {image && (
              <KonvaImage
                image={image}
                x={0}
                y={0}
                scaleX={1 / (currentPlanPage?.renderScale || baseScale * dpr)}
                scaleY={1 / (currentPlanPage?.renderScale || baseScale * dpr)}
                listening={false}
              />
            )}

            {/* Floorplans & Vertex Handles */}
            {activePageFloorplans.map((fp) => {
              const isSelected = fp.id === selectedFloorplanId;
              return (
                <React.Fragment key={fp.id}>
                  <Line
                    points={fp.nodes.flatMap((n) => [n.x, n.y])}
                    fill={fp.color}
                    stroke={isSelected ? '#d32f2f' : fp.stroke}
                    strokeWidth={(isSelected ? 3 : 2) / stageScale}
                    closed
                    listening={markupListening}
                    hitStrokeWidth={18 / stageScale}
                    onClick={(e) => {
                      if (!selectModeActive) return;
                      e.cancelBubble = true;
                      selectOnly('floorplan', fp.id);
                    }}
                  />
                  <Text
                    x={fp.nodes[0].x}
                    y={fp.nodes[0].y}
                    text={`${fp.label}: ${calculatePolygonAreaM2(fp.nodes, pixelsPerMm).toFixed(2)} m²`}
                    fontSize={13 / stageScale}
                    fill={fp.stroke}
                    fontStyle="bold"
                    listening={false}
                  />

                  {isSelected && fp.nodes.map((node, idx) => {
                    const nextNode = fp.nodes[(idx + 1) % fp.nodes.length];
                    const midX = (node.x + nextNode.x) / 2;
                    const midY = (node.y + nextNode.y) / 2;

                    return (
                      <React.Fragment key={`fp-handles-${idx}`}>
                        <Circle
                          x={node.x}
                          y={node.y}
                          radius={6 / stageScale}
                          fill="#d32f2f"
                          stroke="#fff"
                          strokeWidth={1.5 / stageScale}
                          listening={markupListening}
                          draggable={selectModeActive}
                          onDragStart={() => setDraggingVertex({ type: 'floorplan', id: fp.id, vertexIndex: idx })}
                          onClick={(e) => {
                            // Cancelling the bubble stops the Stage from seeing this click, so it must never happen
                            // before the tool check, or this markup eats clicks meant for the tool that is drawing.
                            if (!selectModeActive) return;
                            e.cancelBubble = true;
                            if (fp.nodes.length > 3) deleteVertexFromPolygon('floorplan', fp.id, idx);
                          }}
                        />
                        <Circle
                          x={midX}
                          y={midY}
                          radius={4.5 / stageScale}
                          fill="#1976d2"
                          stroke="#fff"
                          strokeWidth={1 / stageScale}
                          opacity={0.7}
                          listening={markupListening}
                          onClick={(e) => {
                            // Cancelling the bubble stops the Stage from seeing this click, so it must never happen
                            // before the tool check, or this markup eats clicks meant for the tool that is drawing.
                            if (!selectModeActive) return;
                            e.cancelBubble = true;
                            addVertexToPolygon('floorplan', fp.id, idx);
                          }}
                        />
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              );
            })}

            {/* Floorcovering Areas & Vertex Handles */}
            {activePageAreas.map((area) => {
              const cfg = FLOORCOVERING_CONFIGS[area.category] || { fill: 'rgba(76, 175, 80, 0.35)', stroke: '#2e7d32', text: '#1b5e20' };
              const isSelected = area.id === selectedAreaId;
              return (
                <React.Fragment key={area.id}>
                  <Line
                    points={area.nodes.flatMap((n) => [n.x, n.y])}
                    fill={isSelected ? "rgba(255, 152, 0, 0.4)" : cfg.fill}
                    stroke={isSelected ? "#e65100" : cfg.stroke}
                    strokeWidth={(isSelected ? 3 : 2) / stageScale}
                    closed
                    listening={markupListening}
                    hitStrokeWidth={18 / stageScale}
                    onClick={(e) => {
                      if (!selectModeActive && areaDrawMode !== 'exclusion') return;
                      e.cancelBubble = true;
                      if (areaDrawMode === 'exclusion') {
                        setSelectedAreaForExclusion(area.id);
                      } else {
                        selectOnly('area', area.id);
                      }
                    }}
                  />
                  {(area.exclusions || []).map((excl) => (
                    <Line
                      key={excl.id}
                      points={excl.nodes.flatMap((n) => [n.x, n.y])}
                      fill="#e5e5e5"
                      stroke="#d32f2f"
                      strokeWidth={1.5 / stageScale}
                      closed
                      listening={markupListening}
                    />
                  ))}
                  <Text
                    x={area.nodes[0].x}
                    y={area.nodes[0].y}
                    text={`${area.category}: ${getNetFloorcoveringAreaM2(area, pixelsPerMm).toFixed(2)} m²`}
                    fontSize={13 / stageScale}
                    fill={cfg.text}
                    fontStyle="bold"
                    listening={false}
                  />

                  {isSelected && area.nodes.map((node, idx) => {
                    const nextNode = area.nodes[(idx + 1) % area.nodes.length];
                    const midX = (node.x + nextNode.x) / 2;
                    const midY = (node.y + nextNode.y) / 2;

                    return (
                      <React.Fragment key={`area-handles-${idx}`}>
                        <Circle
                          x={node.x}
                          y={node.y}
                          radius={6 / stageScale}
                          fill="#d32f2f"
                          stroke="#fff"
                          strokeWidth={1.5 / stageScale}
                          listening={markupListening}
                          draggable={selectModeActive}
                          onDragStart={() => setDraggingVertex({ type: 'area', id: area.id, vertexIndex: idx })}
                          onClick={(e) => {
                            // Cancelling the bubble stops the Stage from seeing this click, so it must never happen
                            // before the tool check, or this markup eats clicks meant for the tool that is drawing.
                            if (!selectModeActive) return;
                            e.cancelBubble = true;
                            if (area.nodes.length > 3) deleteVertexFromPolygon('area', area.id, idx);
                          }}
                        />
                        <Circle
                          x={midX}
                          y={midY}
                          radius={4.5 / stageScale}
                          fill="#1976d2"
                          stroke="#fff"
                          strokeWidth={1 / stageScale}
                          opacity={0.7}
                          listening={markupListening}
                          onClick={(e) => {
                            // Cancelling the bubble stops the Stage from seeing this click, so it must never happen
                            // before the tool check, or this markup eats clicks meant for the tool that is drawing.
                            if (!selectModeActive) return;
                            e.cancelBubble = true;
                            addVertexToPolygon('area', area.id, idx);
                          }}
                        />
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              );
            })}

            {/* Walls & Vertex Handles */}
            {activePageWalls.map((run) => {
              const polyPoints = generateOffsetPolygon(run.nodes, run.thicknessMm * (pixelsPerMm || 1), run.alignment);
              const isSelected = run.id === selectedWallId;
              return (
                <React.Fragment key={run.id}>
                  {polyPoints.length > 0 && (
                    <Line
                      points={polyPoints.flatMap((p) => [p.x, p.y])}
                      fill={run.category === 'exterior' ? EXTERIOR_WALL_CLASS_COLOURS[resolveExteriorClass(run)] : "rgba(171, 71, 188, 0.4)"}
                      stroke={isSelected ? "#d32f2f" : (run.category === 'exterior' ? "#0033aa" : "#7b1fa2")}
                      strokeWidth={(isSelected ? 2.5 : 1.5) / stageScale}
                      closed
                      listening={markupListening}
                      hitStrokeWidth={20 / stageScale}
                      onClick={(e) => {
                        if (!selectModeActive) return;
                        e.cancelBubble = true;
                        selectOnly('wall', run.id);
                      }}
                    />
                  )}
                  <Line
                    points={run.nodes.flatMap((n) => [n.x, n.y])}
                    stroke={isSelected ? "#d32f2f" : "#111"}
                    strokeWidth={(isSelected ? 2 : 1) / stageScale}
                    dash={[3 / stageScale, 3 / stageScale]}
                    listening={markupListening}
                    hitStrokeWidth={24 / stageScale}
                    onClick={(e) => {
                      if (!selectModeActive) return;
                      e.cancelBubble = true;
                      selectOnly('wall', run.id);
                    }}
                  />

                  {isSelected && run.nodes.map((node, idx) => {
                    const nextNode = run.nodes[idx + 1];
                    const midX = nextNode ? (node.x + nextNode.x) / 2 : null;
                    const midY = nextNode ? (node.y + nextNode.y) / 2 : null;

                    return (
                      <React.Fragment key={`wall-handles-${idx}`}>
                        <Circle
                          x={node.x}
                          y={node.y}
                          radius={6.5 / stageScale}
                          fill="#d32f2f"
                          stroke="#fff"
                          strokeWidth={1.5 / stageScale}
                          listening={markupListening}
                          draggable={selectModeActive}
                          onDragStart={(event) => {
                            event.cancelBubble = true;
                            setDraggingVertex({ type: 'wall', id: run.id, vertexIndex: idx });
                          }}
                          onDragEnd={(event) => {
                            event.cancelBubble = true;
                            commitWallVertexDrag(run.id, idx, event);
                          }}
                        />
                        {midX !== null && midY !== null && (
                          <Circle
                            x={midX}
                            y={midY}
                            radius={4.5 / stageScale}
                            fill="#1976d2"
                            stroke="#fff"
                            strokeWidth={1 / stageScale}
                            opacity={0.7}
                            listening={markupListening}
                            visible={selectModeActive}
                            onClick={(e) => {
                              // Cancelling the bubble stops the Stage from seeing this click, so it must never happen
                              // before the tool check, or this markup eats clicks meant for the tool that is drawing.
                              if (!selectModeActive) return;
                              e.cancelBubble = true;
                              addVertexToPolygon('wall', run.id, idx);
                            }}
                          />
                        )}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              );
            })}

            {/* Openings (Doors/Windows) with draggable capability */}
            {activePageOpenings.map((op, idx) => {
              const tagPrefix = op.type === 'window' ? 'W' : 'D';
              const itemTag = String(op.itemTag || op.label || `${tagPrefix}${idx + 1}`);
              const dynamicTag = `${tagPrefix}${idx + 1}: ${itemTag.includes(': ') ? itemTag.split(': ')[1] : itemTag}`;
              const isSelected = op.id === selectedOpeningId;
              const openingWidthPx = Math.max((Number(op.widthMm) || 0) * (pixelsPerMm || 1), 22 / stageScale);
              return (
                <Group
                  key={op.id}
                  x={op.x}
                  y={op.y}
                  listening={markupListening}
                  draggable={!isRecoveryPreview && selectModeActive}
                  onDragStart={() => {
                    if (!selectModeActive) return;
                    selectOnly('opening', op.id);
                    setDraggingItem({ type: 'opening', id: op.id });
                  }}
                  onClick={(e) => {
                    if (!selectModeActive) return;
                    e.cancelBubble = true;
                    selectOnly('opening', op.id);
                  }}
                >
                  <Rect
                    x={-(openingWidthPx / 2)}
                    y={-10 / stageScale}
                    width={openingWidthPx}
                    height={20 / stageScale}
                    fill={isSelected ? '#ffa726' : (op.type === 'window' ? '#ffe0b2' : '#ffcdd2')}
                    stroke={isSelected ? '#e65100' : (op.type === 'window' ? '#e65100' : '#c62828')}
                    strokeWidth={(isSelected ? 2.5 : 1.5) / stageScale}
                  />
                  <Text
                    x={-(openingWidthPx / 2)}
                    y={-24 / stageScale}
                    text={dynamicTag}
                    fontSize={11 / stageScale}
                    fill="#111"
                    fontStyle="bold"
                  />
                </Group>
              );
            })}

            {activePolyline.length > 0 && (
              <React.Fragment>
                {(() => {
                  const currentNodes = [...activePolyline, mouseHoverPos || activePolyline[activePolyline.length - 1]];
                  const previewPoly = generateOffsetPolygon(currentNodes, detectedWallThicknessMm * (pixelsPerMm || 1), alignment);
                  return previewPoly.length > 0 ? (
                    <Line
                      points={previewPoly.flatMap((p) => [p.x, p.y])}
                      fill={wallCategory === 'exterior' ? "rgba(0, 85, 255, 0.35)" : "rgba(171, 71, 188, 0.35)"}
                      stroke={wallCategory === 'exterior' ? "#0055ff" : "#ab47bc"}
                      strokeWidth={1.5 / stageScale}
                      closed
                    />
                  ) : null;
                })()}
              </React.Fragment>
            )}

            {activeAreaPolyline.length > 0 && (
              <Line
                points={[...activeAreaPolyline, mouseHoverPos || activeAreaPolyline[activeAreaPolyline.length - 1]].flatMap((p) => [p.x, p.y])}
                fill={activeTool === 'floorplan' ? "rgba(33, 150, 243, 0.2)" : (FLOORCOVERING_CONFIGS[floorcoveringOption]?.fill || "rgba(76, 175, 80, 0.25)")}
                stroke={activeTool === 'floorplan' ? "#1565c0" : (FLOORCOVERING_CONFIGS[floorcoveringOption]?.stroke || "#2e7d32")}
                strokeWidth={2 / stageScale}
                closed={activeAreaPolyline.length >= 2}
                dash={[4 / stageScale, 4 / stageScale]}
              />
            )}

            {boxStartPoint && mouseHoverPos && (
              <Rect
                x={Math.min(boxStartPoint.x, mouseHoverPos.x)}
                y={Math.min(boxStartPoint.y, mouseHoverPos.y)}
                width={Math.abs(mouseHoverPos.x - boxStartPoint.x)}
                height={Math.abs(mouseHoverPos.y - boxStartPoint.y)}
                fill={activeTool === 'pillar' ? 'rgba(79, 70, 229, 0.3)' : (FLOORCOVERING_CONFIGS[floorcoveringOption]?.fill || "rgba(76, 175, 80, 0.3)")}
                stroke={activeTool === 'pillar' ? '#4338ca' : (FLOORCOVERING_CONFIGS[floorcoveringOption]?.stroke || "#2e7d32")}
                strokeWidth={1.5 / stageScale}
              />
            )}

            {calibPoints.map((pt, idx) => (
              <Circle key={idx} x={pt.x} y={pt.y} radius={8 / stageScale} fill="#d32f2f" />
            ))}
            {calibPoints.length === 1 && mouseHoverPos && (
              <Line
                points={[calibPoints[0].x, calibPoints[0].y, mouseHoverPos.x, mouseHoverPos.y]}
                stroke="#d32f2f"
                strokeWidth={2 / stageScale}
                dash={[6 / stageScale, 4 / stageScale]}
              />
            )}
            {calibPoints.length === 2 && (
              <Line
                points={[calibPoints[0].x, calibPoints[0].y, calibPoints[1].x, calibPoints[1].y]}
                stroke="#d32f2f"
                strokeWidth={2 / stageScale}
              />
            )}

            {/* Measure Tool Display with fixed orthogonal axis & offset drag */}
            {activePageMeasurements.map((meas) => {
              const p1 = meas.p1;
              const p2 = meas.p2;
              const off = meas.offset || { x: 0, y: 0 };
              const offP1 = { x: p1.x + off.x, y: p1.y + off.y };
              const offP2 = { x: p2.x + off.x, y: p2.y + off.y };
              const midX = (offP1.x + offP2.x) / 2;
              const midY = (offP1.y + offP2.y) / 2;
              const distPx = Math.hypot(p2.x - p1.x, p2.y - p1.y);
              const distMm = pixelsPerMm ? distPx / pixelsPerMm : 0;

              const isSelected = meas.id === selectedMeasurementId;
              return (
                <Group key={meas.id}>
                  {(off.x !== 0 || off.y !== 0) && (
                    <React.Fragment>
                      <Line points={[p1.x, p1.y, offP1.x, offP1.y]} stroke="#2e7d32" strokeWidth={1 / stageScale} dash={[3, 3]} opacity={0.6} />
                      <Line points={[p2.x, p2.y, offP2.x, offP2.y]} stroke="#2e7d32" strokeWidth={1 / stageScale} dash={[3, 3]} opacity={0.6} />
                    </React.Fragment>
                  )}
                  <Line
                    points={[offP1.x, offP1.y, offP2.x, offP2.y]}
                    stroke={isSelected ? '#0d47a1' : '#2e7d32'}
                    strokeWidth={(isSelected ? 2.8 : 2) / stageScale}
                    draggable={selectModeActive}
                    hitStrokeWidth={24 / stageScale}
                    onDragStart={() => {
                      if (!selectModeActive) return;
                      selectOnly('measure', meas.id);
                      setDraggingMeasureId(meas.id);
                      pointerEditInProgressRef.current = true;
                    }}
                    onClick={(e) => {
                      if (!selectModeActive) return;
                      e.cancelBubble = true;
                      selectOnly('measure', meas.id);
                    }}
                  />
                  <Circle x={offP1.x} y={offP1.y} radius={3.5 / stageScale} fill="#2e7d32" />
                  <Circle x={offP2.x} y={offP2.y} radius={3.5 / stageScale} fill="#2e7d32" />
                  
                  <Text
                    x={midX}
                    y={midY - MEASURE_LABEL_OFFSET / stageScale}
                    text={pixelsPerMm ? `${distMm.toFixed(0)} mm` : `${distPx.toFixed(1)} px`}
                    fontSize={MEASURE_LABEL_FONT_SIZE / stageScale}
                    fill={isSelected ? '#0d47a1' : '#1b5e20'}
                    fontStyle="bold"
                    draggable={selectModeActive}
                    onDragStart={() => {
                      if (!selectModeActive) return;
                      selectOnly('measure', meas.id);
                      setDraggingMeasureId(meas.id);
                      pointerEditInProgressRef.current = true;
                    }}
                    onClick={(e) => {
                      if (!selectModeActive) return;
                      e.cancelBubble = true;
                      selectOnly('measure', meas.id);
                    }}
                  />
                </Group>
              );
            })}

            {/* Eaves runs with filled selected width */}
            {activePageEaves.map((eave) => {
              const nodes = getEaveNodes(eave);
              const polyPoints = generateOffsetPolygon(nodes, eave.widthMm * (pixelsPerMm || 1), eave.alignment || 'outer');
              const isSelected = eave.id === selectedEaveId;
              const lengthLabel = pixelsPerMm ? `${(getEaveLengthMm(eave, pixelsPerMm) / 1000).toFixed(2)} m` : '';
              const labelNode = nodes[0] || { x: 0, y: 0 };

              return (
                <Group key={eave.id}>
                  {polyPoints.length > 0 && (
                    <Line
                      points={polyPoints.flatMap((p) => [p.x, p.y])}
                      fill={isSelected ? "rgba(0, 188, 212, 0.45)" : "rgba(0, 188, 212, 0.28)"}
                      stroke={isSelected ? "#006064" : "#00838f"}
                      strokeWidth={(isSelected ? 2.5 : 1.5) / stageScale}
                      closed
                      listening={markupListening}
                      onClick={(e) => {
                        // Cancelling the bubble stops the Stage from seeing this click, so it must never happen
                        // before the tool check, or this markup eats clicks meant for the tool that is drawing.
                        if (!selectModeActive) return;
                        e.cancelBubble = true;
                        selectOnly('eaves', eave.id);
                      }}
                    />
                  )}
                  <Line
                    points={nodes.flatMap((n) => [n.x, n.y])}
                    stroke={isSelected ? "#004d40" : "#006064"}
                    strokeWidth={(isSelected ? 2 : 1.5) / stageScale}
                    dash={[3 / stageScale, 3 / stageScale]}
                    listening={markupListening}
                    onClick={(e) => {
                      // Cancelling the bubble stops the Stage from seeing this click, so it must never happen
                      // before the tool check, or this markup eats clicks meant for the tool that is drawing.
                      if (!selectModeActive) return;
                      e.cancelBubble = true;
                      selectOnly('eaves', eave.id);
                    }}
                  />
                  <Text
                    x={labelNode.x}
                    y={labelNode.y - MEASURE_LABEL_OFFSET / stageScale}
                    text={`${getEaveWidthLabel(eave)} ${resolveTakeoffLevel(eave, sheetLevels)}: ${lengthLabel}`}
                    fontSize={16 / stageScale}
                    fill="#006064"
                    fontStyle="bold"
                    listening={false}
                  />

                  {isSelected && nodes.map((node, idx) => {
                    const nextNode = nodes[idx + 1];
                    const midX = nextNode ? (node.x + nextNode.x) / 2 : null;
                    const midY = nextNode ? (node.y + nextNode.y) / 2 : null;

                    return (
                      <React.Fragment key={`eave-handles-${idx}`}>
                        <Circle
                          x={node.x}
                          y={node.y}
                          radius={6 / stageScale}
                          fill="#d32f2f"
                          stroke="#fff"
                          strokeWidth={1.5 / stageScale}
                          listening={markupListening}
                          draggable
                          onDragStart={() => setDraggingVertex({ type: 'eaves', id: eave.id, vertexIndex: idx })}
                          onClick={(e) => {
                            // Cancelling the bubble stops the Stage from seeing this click, so it must never happen
                            // before the tool check, or this markup eats clicks meant for the tool that is drawing.
                            if (!selectModeActive) return;
                            e.cancelBubble = true;
                            if (nodes.length > 2) deleteVertexFromPolygon('eaves', eave.id, idx);
                          }}
                        />
                        {midX !== null && midY !== null && (
                          <Circle
                            x={midX}
                            y={midY}
                            radius={4.5 / stageScale}
                            fill="#00838f"
                            stroke="#fff"
                            strokeWidth={1 / stageScale}
                            opacity={0.75}
                            listening={markupListening}
                            onClick={(e) => {
                              // Cancelling the bubble stops the Stage from seeing this click, so it must never happen
                              // before the tool check, or this markup eats clicks meant for the tool that is drawing.
                              if (!selectModeActive) return;
                              e.cancelBubble = true;
                              addVertexToPolygon('eaves', eave.id, idx);
                            }}
                          />
                        )}
                      </React.Fragment>
                    );
                  })}
                </Group>
              );
            })}

            {/* Pillars, Posts & Columns - a discrete vertical structural object, visually distinct
                from walls (black), openings, areas (green/blue) and eaves (cyan): solid indigo
                fill/stroke, never rendered or reachable as a wall. */}
            {activePagePillars.map((pillar) => {
              const nodes = pillar.nodes || [];
              const isSelected = pillar.id === selectedPillarId;
              const core = resolvePostColumnCore(pillar);
              const labelNode = nodes[0] || { x: 0, y: 0 };
              const sizeLabel = pillar.coreWidthMm && pillar.coreDepthMm ? `${pillar.coreWidthMm}x${pillar.coreDepthMm}` : '';
              return (
                <Group key={pillar.id}>
                  {nodes.length >= 3 && (
                    <Line
                      points={nodes.flatMap((n) => [n.x, n.y])}
                      fill={isSelected ? 'rgba(79, 70, 229, 0.45)' : 'rgba(79, 70, 229, 0.28)'}
                      stroke={isSelected ? '#312e81' : '#4338ca'}
                      strokeWidth={(isSelected ? 2.5 : 1.5) / stageScale}
                      closed
                      listening={markupListening}
                      onClick={(e) => {
                        if (!selectModeActive) return;
                        e.cancelBubble = true;
                        selectOnly('pillar', pillar.id);
                      }}
                    />
                  )}
                  <Text
                    x={labelNode.x}
                    y={labelNode.y - MEASURE_LABEL_OFFSET / stageScale}
                    text={`${core.displayLabel}${sizeLabel ? ` ${sizeLabel}` : ''}`}
                    fontSize={14 / stageScale}
                    fill="#312e81"
                    fontStyle="bold"
                    listening={false}
                  />
                  {/* Corner handles are shown for orientation only when selected - resizing the
                      footprint is done via the Width/Depth fields in the editor, which keep the
                      rectangle axis-aligned (dragging one corner of an existing rectangle freely
                      would otherwise distort it into an arbitrary quadrilateral). */}
                  {isSelected && nodes.map((node, idx) => (
                    <Circle
                      key={`pillar-handle-${idx}`}
                      x={node.x}
                      y={node.y}
                      radius={5 / stageScale}
                      fill="#4338ca"
                      stroke="#fff"
                      strokeWidth={1.5 / stageScale}
                      listening={false}
                    />
                  ))}
                </Group>
              );
            })}

            {measurePoints.map((pt, idx) => (
              <Circle key={`meas-${idx}`} x={pt.x} y={pt.y} radius={6 / stageScale} fill="#4caf50" stroke="#fff" strokeWidth={1.5 / stageScale} />
            ))}
            {measurePoints.length === 1 && mouseHoverPos && (
              <React.Fragment>
                {(() => {
                  const firstPt = measurePoints[0];
                  const dx = Math.abs(mouseHoverPos.x - firstPt.x);
                  const dy = Math.abs(mouseHoverPos.y - firstPt.y);
                  const lockedSecondPoint = dx >= dy ? { x: mouseHoverPos.x, y: firstPt.y } : { x: firstPt.x, y: mouseHoverPos.y };
                  const previewDistPx = Math.hypot(lockedSecondPoint.x - firstPt.x, lockedSecondPoint.y - firstPt.y);
                  return (
                    <React.Fragment>
                      <Line
                        points={[firstPt.x, firstPt.y, lockedSecondPoint.x, lockedSecondPoint.y]}
                        stroke="#4caf50"
                        strokeWidth={2 / stageScale}
                        dash={[4 / stageScale, 4 / stageScale]}
                      />
                      <Text
                        x={(firstPt.x + lockedSecondPoint.x) / 2}
                        y={(firstPt.y + lockedSecondPoint.y) / 2 - MEASURE_LABEL_OFFSET / stageScale}
                        text={pixelsPerMm ? `${(previewDistPx / pixelsPerMm).toFixed(0)} mm` : `${previewDistPx.toFixed(1)} px`}
                        fontSize={MEASURE_LABEL_FONT_SIZE / stageScale}
                        fill="#2e7d32"
                        fontStyle="bold"
                      />
                    </React.Fragment>
                  );
                })()}
              </React.Fragment>
            )}

            {eavePoints.map((pt, idx) => (
              <Circle key={`eave-${idx}`} x={pt.x} y={pt.y} radius={6 / stageScale} fill="#00acc1" stroke="#fff" strokeWidth={1.5 / stageScale} />
            ))}
            {eavePoints.length > 0 && mouseHoverPos && (
              <React.Fragment>
                {(() => {
                  const currentNodes = [...eavePoints, mouseHoverPos];
                  const previewPoly = generateOffsetPolygon(currentNodes, getEaveWidthMm() * (pixelsPerMm || 1), eaveAlignment);
                  const previewLengthMm = getWallRunLengthMm(currentNodes, pixelsPerMm);
                  const previewLabel = pixelsPerMm ? `${(previewLengthMm / 1000).toFixed(2)} m` : '';
                  const previewWidthLabel = eaveWidthOption === 'Special' ? `${getEaveWidthMm()}mm Special` : `${getEaveWidthMm()}mm`;
                  return (
                    <React.Fragment>
                      {previewPoly.length > 0 && (
                        <Line
                          points={previewPoly.flatMap((p) => [p.x, p.y])}
                          fill="rgba(0, 188, 212, 0.28)"
                          stroke="#00acc1"
                          strokeWidth={1.5 / stageScale}
                          closed
                        />
                      )}
                      <Line
                        points={currentNodes.flatMap((p) => [p.x, p.y])}
                        stroke="#006064"
                        strokeWidth={1.5 / stageScale}
                        dash={[4 / stageScale, 4 / stageScale]}
                      />
                      <Text
                        x={currentNodes[0].x}
                        y={currentNodes[0].y - MEASURE_LABEL_OFFSET / stageScale}
                        text={`${previewWidthLabel} ${eaveLevel}: ${previewLabel}`}
                        fontSize={16 / stageScale}
                        fill="#006064"
                        fontStyle="bold"
                      />
                    </React.Fragment>
                  );
                })()}
              </React.Fragment>
            )}

            {/* Pointer crosshair. This is the last child of the layer, so it paints on top of every
                markup, and it is pinned to the cursor - which means its hit region sits under the
                pointer on every single click. It must never listen, or it swallows the click that
                was meant for the wall, area or opening underneath and selection silently dies. */}
            {mouseHoverPos && (
              <Group x={mouseHoverPos.x} y={mouseHoverPos.y} listening={false}>
                <Line
                  points={[-24 / stageScale, 0, 24 / stageScale, 0]}
                  stroke={mouseHoverPos.snapped ? "#00e676" : "#ff1744"}
                  strokeWidth={3 / stageScale}
                  listening={false}
                />
                <Line
                  points={[0, -24 / stageScale, 0, 24 / stageScale]}
                  stroke={mouseHoverPos.snapped ? "#00e676" : "#ff1744"}
                  strokeWidth={3 / stageScale}
                  listening={false}
                />
                <Circle
                  radius={8 / stageScale}
                  stroke={mouseHoverPos.snapped ? "#00e676" : "#ff1744"}
                  strokeWidth={2.5 / stageScale}
                  listening={false}
                />
              </Group>
            )}
          </Layer>
        </Stage>
      </div>
    </div>
  );
}
