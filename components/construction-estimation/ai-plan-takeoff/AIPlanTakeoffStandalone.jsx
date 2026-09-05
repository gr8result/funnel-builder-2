import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { externalizeTakeoffRecoverySnapshot } from './planBlobStorage.js';
import { Stage, Layer, Image as KonvaImage, Line, Circle, Text, Rect, Group } from 'react-konva';
import { RotateCw, Ruler, ChevronLeft, ChevronRight, DoorOpen, Square, Layers, Trash2, Home, Compass, Download, Upload, MousePointer2 } from 'lucide-react';
import { calculatePolygonAreaM2, findFloorplanCornerSnapPoint, resolveFloorplanFreePoint } from './floorplanGeometry';
import { AI_PLAN_TAKEOFF_EXTENSION, filenameWithoutKnownGr8Extension } from '../../../lib/gr8FileTypes.js';
import { createJobData, createPortableTakeoffExport, createTakeoffContentChecksum, getEmbeddedPlanPages, getSavedFloorCoveringAreas, getTakeoffCounts, rememberRecentTakeoffJob, resolvePortableTakeoffImport } from './jobPersistence';
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
pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;

const MEASURE_LABEL_FONT_SIZE = 24;
const MEASURE_LABEL_OFFSET = 30;
const EAVE_WIDTH_OPTIONS = ['450', '600', '900', 'Special'];
const EAVE_LEVEL_OPTIONS = ['Ground Floor', 'Second Level', 'Third Level'];
const OPENING_CLASS_OPTIONS = ['Window', 'Internal Door', 'External Door', 'Garage Door', 'Large Glazed/Stacker/Sliding Door', 'Other Opening'];
const EXTERIOR_WALL_CLASS_OPTIONS = ['Brick Veneer', 'Lightweight Cladding', 'Rendered Masonry', 'Other'];
const EXTERIOR_WALL_CLASS_COLOURS = {
  'Brick Veneer': 'rgba(178, 34, 34, 0.45)',
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
    exteriorType: category === 'exterior' ? (run.exteriorType || 'Other') : '',
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

function floorFromPage(page = 1) {
  const pageNumber = Number(page) || 1;
  if (pageNumber === 1) return { key: 'lower', label: 'Ground Floor' };
  if (pageNumber === 2) return { key: 'upper', label: 'Second Level' };
  if (pageNumber === 3) return { key: 'third', label: 'Third Level' };
  return { key: `sheet${pageNumber}`, label: `Sheet ${pageNumber}` };
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
  onJobSetupUpdate = null,
  onQuoteSheetUpdate = null,
  onBackToDashboard = null,
  openTakeoffJobRequest = null,
  onRecentTakeoffJobsChange = null,
  onAttachToProject = null
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
  const [calibrationMode, setCalibrationMode] = useState(false);
  const [calibPoints, setCalibPoints] = useState([]);
  const [pixelsPerMm, setPixelsPerMm] = useState(null);

  const [activeTool, setActiveTool] = useState('wall'); // 'wall', 'opening', 'floorplan', 'floorcoverings', 'measure', 'eaves', 'select'

  const [wallCategory, setWallCategory] = useState('exterior');
  const [detectedWallThicknessMm, setDetectedWallThicknessMm] = useState(230);
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
  const [glassType, setGlassType] = useState('Standard Clear');
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

  const [mouseHoverPos, setMouseHoverPos] = useState(null);

  const stageRef = useRef(null);
  const layerRef = useRef(null);
  const canvasHostRef = useRef(null);
  const rawCanvasRef = useRef(document.createElement('canvas'));

  // Cleanup canvas and memory on component unmount or job change
  useEffect(() => {
    return () => {
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
              URL.revokeObjectURL(page.dataUrl);
            } catch (e) {
              // Ignore errors from already-revoked URLs
            }
          }
        });
      }
    };
  }, []);
  const renderTaskRef = useRef(null);
  const loadedInitialJobRef = useRef(false);
  const sheetViewStateRef = useRef({});
  const fittedSheetViewKeyRef = useRef('');
  const autosaveInFlightRef = useRef(false);
  const autosaveTimerRef = useRef(null);
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
  }), [rotation, pixelsPerMm, planPages, completedWallRuns, placedOpenings, completedAreas, completedFloorplans, completedMeasurements, completedEaves]);

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
    });
    return {
      ...jobData,
      contentChecksum,
      takeoffCounts: getTakeoffCounts(jobData),
    };
  };

  useEffect(() => {
    latestBuildJobDataRef.current = buildJobData;
  });

  const downloadJobFile = (name) => {
    const safeName = sanitizeJobFileName(name);
    const jobData = buildJobData(name);
    const portable = createPortableTakeoffExport(jobData, { takeoffName: name });
    const blob = new Blob([JSON.stringify(portable, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}.takeoff${AI_PLAN_TAKEOFF_EXTENSION}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const writeJobToFile = async (fileHandle, name) => {
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(buildJobData(name), null, 2));
    await writable.close();
  };

  const showPlanPage = useCallback(async (pages, pageNumber) => {
    const page = pages.find((p) => p.pageNumber === pageNumber) || pages[pageNumber - 1];
    if (!page?.dataUrl) {
      setImage(null);
      setVectorSegments([]);
      return;
    }

    const img = await loadImageFromDataUrl(page.dataUrl);
    setImage(img);
    setVectorSegments(page.vectorSegments || []);
  }, []);

  const loadJobData = async (data, fallbackName = '') => {
    const imported = resolvePortableTakeoffImport(data);
    const takeoffJobData = imported.ok ? imported.job : data;
    const embeddedPages = normaliseRecoveredPlanPages(getEmbeddedPlanPages(takeoffJobData));
    const isRecoveryPreviewJob = Boolean(takeoffJobData.recoveryPreviewMode);

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
    setProjectInfo(takeoffJobData.projectInfo || initialProjectInfo || { projectName: takeoffJobData.jobName || '', clientName: '', siteAddress: '', storeyOrLevelName: '' });
    setPlanFilename(takeoffJobData.planFilename || '');
    setImportedTakeoffFileName(takeoffJobData.sourceFileName || '');
    setScheduleMappings(takeoffJobData.scheduleState?.scheduleMappings || {});
    setQuoteSheetRows(takeoffJobData.scheduleState?.quoteSheetRows || quoteSheetRows);
    setQuotePreviewRows(takeoffJobData.scheduleState?.quotePreviewRows || []);
    setJobSetupPayload(takeoffJobData.scheduleState?.jobSetupPayload || null);
    setLastQuoteSyncSignature(takeoffJobData.scheduleState?.lastQuoteSyncSignature || '');
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
    setRecoveryPreviewMode(isRecoveryPreviewJob);
    setRecoveryPreviewCounts(isRecoveryPreviewJob ? getTakeoffCounts(takeoffJobData) : null);

    setPlanMissingFromSavedJob(embeddedPages.length === 0 && Boolean(takeoffJobData?.jobName || fallbackName));
    setSavedRevision(Number(takeoffJobData.revision || 0));
    setLastSuccessfulSaveAt(takeoffJobData.updatedAt || '');
    setOpenedTakeoffJob({
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

    if (embeddedPages.length > 0) {
      await showPlanPage(embeddedPages, takeoffJobData.currentPage || 1);
    } else {
      setImage(null);
      setVectorSegments([]);
    }

    setJobName(takeoffJobData.takeoffName || takeoffJobData.jobName || fallbackName);
  };

  useEffect(() => {
    // Emergency interlock: initialJob must never hydrate automatically.
  }, [initialJob, platformContext.projectName]);

  useEffect(() => {
    if (!openTakeoffJobRequest?.jobData) return;
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
    });
    const incomingTakeoffId = String(incomingJob.takeoffId || incomingJob.id || '');
    const currentTakeoffId = String(openedTakeoffJob?.takeoffId || '');
    if (incomingTakeoffId && currentTakeoffId && incomingTakeoffId === currentTakeoffId && incomingChecksum === lastSeenContentChecksumRef.current) {
      return;
    }
    loadJobData(openTakeoffJobRequest.jobData, openTakeoffJobRequest.displayName || openTakeoffJobRequest.jobData.takeoffName || '').catch((error) => {
      console.error("Failed to open recent takeoff job:", error);
      alert("Could not open the selected takeoff job.");
    });
  }, [openTakeoffJobRequest, openedTakeoffJob?.takeoffId]);

  useEffect(() => {
    const handler = (event) => {
      const jobData = event?.detail?.jobData;
      if (!jobData) return;
      loadJobData(jobData, event.detail.displayName || jobData.takeoffName || '').catch((error) => {
        console.error("Failed to open recent takeoff job:", error);
        alert("Could not open the selected takeoff job.");
      });
    };
    window.addEventListener('gr8:ai-plan-takeoff:open-recent', handler);
    return () => window.removeEventListener('gr8:ai-plan-takeoff:open-recent', handler);
  }, []);

  useEffect(() => {
    if (suppressUnsavedChangeRef.current) {
      suppressUnsavedChangeRef.current = false;
      lastSeenContentChecksumRef.current = takeoffContentChecksum;
      if (!lastSavedContentChecksumRef.current) {
        lastSavedContentChecksumRef.current = takeoffContentChecksum;
      }
      if (suppressAutosaveFromLoadRef.current && (!pendingLoadedContentChecksumRef.current || pendingLoadedContentChecksumRef.current === takeoffContentChecksum)) {
        suppressAutosaveFromLoadRef.current = false;
        pendingLoadedContentChecksumRef.current = '';
      }
      return;
    }
    if (suppressAutosaveFromLoadRef.current) {
      if (pendingLoadedContentChecksumRef.current && takeoffContentChecksum !== pendingLoadedContentChecksumRef.current) {
        return;
      }
      suppressAutosaveFromLoadRef.current = false;
      pendingLoadedContentChecksumRef.current = '';
      lastSeenContentChecksumRef.current = takeoffContentChecksum;
      if (!lastSavedContentChecksumRef.current) {
        lastSavedContentChecksumRef.current = takeoffContentChecksum;
      }
      return;
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
      activeTool,
      currentPage,
      totalPages,
      stageScale,
      stagePos,
      activePolylinePoints: activePolyline.length,
      activeAreaPolylinePoints: activeAreaPolyline.length,
      wallRuns: completedWallRuns.length,
      wallSegments: completedWallRuns.reduce((sum, wall) => sum + Math.max(0, (wall.nodes || []).length - 1), 0),
      openings: placedOpenings.length,
      floorCoverings: completedAreas.length,
      floorplans: completedFloorplans.length,
      hasCalibration: Boolean(pixelsPerMm)
    };
  }, [activeTool, currentPage, totalPages, stageScale, stagePos, activePolyline, activeAreaPolyline, completedWallRuns, placedOpenings, completedAreas, completedFloorplans, pixelsPerMm]);

  useEffect(() => {
    if (typeof window === 'undefined' || process.env.NODE_ENV === 'production') return;
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
          glassType: 'Standard Clear',
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
          glassType: 'Standard Clear',
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
      return {
        ok: false,
        message: SAVE_VERIFICATION_FAILED_MESSAGE,
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
    setSelectedWallId(null);
    setSelectedOpeningId(null);
    setSelectedAreaId(null);
    setSelectedFloorplanId(null);
    setSelectedEaveId(null);
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

    if (!jobName) {
      handleExportTakeoffFile();
      return;
    }
    if (jobFileHandle && window.showSaveFilePicker) {
      try {
        await writeJobToFile(jobFileHandle, jobName);
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
        console.error("Failed to overwrite job file:", err);
        alert("Could not update the open job file. Use Export Takeoff File to download a backup.");
        return;
      }
    }
    downloadJobFile(jobName);
  };

  const handleSaveJobAs = async () => {
    if (isRecoveryPreview) {
      alert("Recovery Preview is read-only and cannot be saved as a new takeoff.");
      return;
    }
    if (!hasOpenTakeoffJob) {
      alert("No takeoff job is open.");
      return;
    }
    if (embedded && onSaveToPlatform) {
      setAttachProjectName(attachedProjectName || 'Johnson 123');
      setAttachError('');
      setAttachDialogOpen(true);
      return;
    }
    const nextName = window.prompt('Save takeoff job as', jobName || 'Untitled takeoff') || '';
    if (!nextName.trim()) return;
    const nextTakeoff = {
      takeoffId: `takeoff-${Date.now()}`,
      associatedProjectId: openedTakeoffJob?.associatedProjectId || '',
      associatedProjectName: openedTakeoffJob?.associatedProjectName || ''
    };
    const jobData = {
      ...buildJobData(nextName.trim()),
      takeoffId: nextTakeoff.takeoffId,
      takeoffName: nextName.trim(),
      jobName: nextName.trim()
    };
    setJobName(nextName.trim());
    setOpenedTakeoffJob(nextTakeoff);
    if (embedded && onSaveToPlatform) {
      const result = await Promise.resolve(onSaveToPlatform(jobData));
      const verifiedSave = requireVerifiedSave(result, jobData);
      if (!verifiedSave.ok) {
        setHasUnsavedChanges(true);
        setPlatformSaveMessage(verifiedSave.message);
        alert(verifiedSave.message);
        return;
      }
      const savedJob = { ...jobData, revision: verifiedSave.revision, updatedAt: verifiedSave.savedAt, storageRecordKey: verifiedSave.key || '' };
      const recent = rememberRecentTakeoffJob(savedJob);
      onRecentTakeoffJobsChange?.(recent);
      setSavedRevision(verifiedSave.revision);
      setLastSuccessfulSaveAt(verifiedSave.savedAt);
      setHasUnsavedChanges(false);
      stampSavedContentBaseline(jobData);
      setPlatformSaveMessage(verifiedSave.message);
      return;
    }
    downloadJobFile(nextName.trim());
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
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
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
    if (!autosaveRequest || !embedded || !onSaveToPlatform || isRecoveryPreview || !hasOpenTakeoffJob || !hasAttachedProject || !planPages.length) return;
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
    autosaveTimerRef.current = window.setTimeout(async () => {
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
          if (process.env.NODE_ENV !== 'production' && redundantAutosaveCountRef.current > 1) {
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
    }, 600);
    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [autosaveRequest, embedded, onSaveToPlatform, isRecoveryPreview, hasOpenTakeoffJob, hasAttachedProject, planPages.length, attachedProjectName, jobName, platformContext.projectName, importedTakeoffFileName, planFilename, takeoffContentChecksum, onRecentTakeoffJobsChange, requireVerifiedSave, createRecoverySnapshot]);

  const confirmImportedTakeoff = (imported, fileName) => {
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
        types: [{ description: 'Takeoff Job', accept: { 'application/json': [AI_PLAN_TAKEOFF_EXTENSION, '.json'] } }],
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
      const takeoffJobData = { ...imported.job, sourceFileName: file.name };
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
        const takeoffJobData = { ...imported.job, sourceFileName: file.name };
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
    return eave.lengthMm || getWallRunLengthMm(getEaveNodes(eave), scalePxPerMm);
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
      exteriorType: wallCategory === 'exterior' ? 'Other' : '',
      linedFaces: 2,
      openingDeductionsEnabled: true,
      wallHeightM: null
    };

    setCompletedWallRuns((prev) => [...prev, newRun]);
    setSelectedWallId(newRun.id);
    setActivePolyline([]);
    markTakeoffItemCompleted('wall-run');
  }, [activePolyline, pixelsPerMm, currentPage, wallCategory, detectedWallThicknessMm, alignment, getWallRunLengthMm, markTakeoffItemCompleted]);

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
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteMarkupItem, isRecoveryPreview, markTakeoffItemCompleted, selectedAreaId, selectedEaveId, selectedFloorplanId, selectedMeasurementId, selectedOpeningId, selectedWallId]);

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
      img.onload = () => setImage(img);
    } catch (error) {
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
      vectorSegments: vectorSegmentsForPage
    };
  };

  useEffect(() => {
    if (planPages.length > 0) {
      showPlanPage(planPages, currentPage);
    } else if (pdfDoc) {
      renderPdfPage(pdfDoc, currentPage);
    }
    setActivePolyline([]);
    setActiveAreaPolyline([]);
    setEavePoints([]);
    setBoxStartPoint(null);
  }, [pdfDoc, planPages, currentPage, renderPdfPage, showPlanPage]);

  const handleFileUpload = async (e, options = {}) => {
    const file = e.target.files[0];
    if (!file) return;
    const preserveTakeoffs = Boolean(options.preserveTakeoffs);

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
    img.src = URL.createObjectURL(file);
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
    };
  };

  const getCanvasPointerPos = (event = null) => {
    const stage = stageRef.current;
    if (!stage) return null;
    const nativeEvent = event?.evt || event?.nativeEvent || event;
    const hostRect = canvasHostRef.current?.getBoundingClientRect?.();
    const point = nativeEvent
      && hostRect
      && Number.isFinite(nativeEvent.clientX)
      && Number.isFinite(nativeEvent.clientY)
      ? {
          x: nativeEvent.clientX - hostRect.left,
          y: nativeEvent.clientY - hostRect.top
        }
      : stage.getPointerPosition();
    if (!point) return null;

    const stageScaleValue = Number(stage.scaleX?.() || stageScale || 1);
    const stageLocalPoint = {
      x: (point.x - Number(stage.x?.() || 0)) / stageScaleValue,
      y: (point.y - Number(stage.y?.() || 0)) / stageScaleValue
    };

    if (layerRef.current) {
      const transform = layerRef.current.getTransform().copy().invert();
      return transform.point(stageLocalPoint);
    }

    return stageLocalPoint;
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
    const nodeSnapRadius = 120 / stageScale;
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
    return findFloorplanCornerSnapPoint(vectorSegments, { x: rawX, y: rawY }, 120 / stageScale);
  };

  const autoDetectWallThickness = (clickX, clickY, nearestSegment) => {
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

  const autoDetectOpeningDimensions = (clickX, clickY, nearestSegment) => {
    if (!nearestSegment || !pixelsPerMm) return;
    const segLengthMm = Math.round(Math.hypot(nearestSegment.x2 - nearestSegment.x1, nearestSegment.y2 - nearestSegment.y1) / pixelsPerMm);
    if (segLengthMm >= 400 && segLengthMm <= 5000) {
      setOpeningWidthMm(segLengthMm);
      const hDec = Math.round(openingHeightMm / 100);
      const wDec = Math.round(segLengthMm / 100);
      setSizeCodeInput(`${hDec}${wDec}`);
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
      if (snap.nearestSegment) {
        autoDetectOpeningDimensions(snap.x, snap.y, snap.nearestSegment);
      }

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
        x: snap.x,
        y: snap.y
      };

      setPlacedOpenings((prev) => [...prev, newOpening]);
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
    } else if (activeTool === 'floorcoverings') {
      const snap = getGeneralSnapPoint(pos.x, pos.y);

      if (areaDrawMode === 'box') {
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
    else if (activeTool === 'floorplan' || activeTool === 'floorcoverings') finalizeCurrentArea();
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
  }

  const activePageWalls = React.useMemo(() => completedWallRuns.filter((w) => Number(w.page || w.pageId || 1) === Number(currentPage)), [completedWallRuns, currentPage]);
  const activePageAreas = React.useMemo(() => completedAreas.filter((a) => Number(a.page || a.pageId || 1) === Number(currentPage)), [completedAreas, currentPage]);
  const activePageOpenings = React.useMemo(() => placedOpenings.filter((o) => Number(o.page || o.pageId || 1) === Number(currentPage)), [placedOpenings, currentPage]);
  const activePageFloorplans = React.useMemo(() => completedFloorplans.filter((f) => Number(f.page || f.pageId || 1) === Number(currentPage)), [completedFloorplans, currentPage]);
  const activePageMeasurements = React.useMemo(() => completedMeasurements.filter((m) => Number(m.page || m.pageId || 1) === Number(currentPage)), [completedMeasurements, currentPage]);
  const activePageEaves = React.useMemo(() => completedEaves.filter((e) => Number(e.page || e.pageId || 1) === Number(currentPage)), [completedEaves, currentPage]);

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
        .filter((eave) => eave.level === level && eave.widthOption === widthOption)
        .reduce((sum, eave) => sum + getEaveLengthMm(eave, pixelsPerMm), 0);
      return widthAcc;
    }, {});
    return acc;
  }, {});
  const totalEavesLengthMm = activePageEaves.reduce((sum, eave) => sum + getEaveLengthMm(eave, pixelsPerMm), 0);
  const exteriorWallClassificationTotals = useMemo(() => {
    const result = {
      all: { 'Brick Veneer': 0, 'Lightweight Cladding': 0, 'Rendered Masonry': 0, Other: 0 },
      byFloor: {}
    };
    completedWallRuns.forEach((wall) => {
      if (String(wall.category || '').toLowerCase() !== 'exterior') return;
      const floor = floorFromPage(wall.page).label;
      const className = EXTERIOR_WALL_CLASS_OPTIONS.includes(wall.exteriorType) ? wall.exteriorType : 'Other';
      const lengthM = (Number(wall.lengthMm) || 0) / 1000;
      if (!result.byFloor[floor]) result.byFloor[floor] = { 'Brick Veneer': 0, 'Lightweight Cladding': 0, 'Rendered Masonry': 0, Other: 0 };
      result.byFloor[floor][className] += lengthM;
      result.all[className] += lengthM;
    });
    return result;
  }, [completedWallRuns]);

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
  const selectModeActive = activeTool === 'select';
  const markupListening = !isRecoveryPreview;

  const canStartStagePan = () => (
    !isRecoveryPreview
    && !calibrationMode
    && !draggingVertex
    && !draggingItem
    && !draggingMeasureId
    && !draggingEaveId
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
  const takeoffSchedule = React.useMemo(() => createTakeoffSchedule({
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
    jobSetupRows: platformContext.jobSetupRows || {}
  }), [projectInfo, planFilename, totalPages, currentPage, pixelsPerMm, completedWallRuns, placedOpenings, completedAreas, completedFloorplans, completedMeasurements, completedEaves, platformContext.jobSetupRows]);
  const scheduleSignature = React.useMemo(() => getScheduleSignature(takeoffSchedule), [takeoffSchedule]);
  const quoteSheetOutOfDate = !!lastQuoteSyncSignature && lastQuoteSyncSignature !== scheduleSignature;

  const downloadTextFile = (filename, content, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
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
      takeoffId: openedTakeoffJob?.takeoffId || '',
      revision: savedRevision,
    });
    setJobSetupPayload(payload);
    const previewRows = Array.isArray(payload.mappingPreview) ? payload.mappingPreview : [];
    const missingRows = previewRows.filter((row) => row.status === 'missing');
    const previewText = [
      `Project: ${payload.projectName || '(unnamed)'}`,
      `Takeoff: ${openedTakeoffJob?.takeoffId || 'unknown'} Revision ${savedRevision || 0}`,
      `Fields prepared: ${previewRows.length}`,
      `Missing or blank fields: ${missingRows.length}`,
      '',
      ...previewRows.slice(0, 20).map((row) => `${row.destinationKey}: ${row.value ?? ''}`),
      ...(previewRows.length > 20 ? ['...'] : []),
      '',
      ...(payload.warnings || []).map((warning) => `Warning: ${warning}`),
      '',
      'Confirm export to Job Setup?'
    ].join('\n');
    const confirmed = window.confirm(previewText);
    if (!confirmed) return;
    if (onJobSetupUpdate) {
      Promise.resolve(onJobSetupUpdate(payload)).then(() => {
        const updatedFields = previewRows.filter((row) => row.status === 'ready').map((row) => row.destinationKey);
        setPlatformSaveMessage(`Exported Takeoff to Job Setup (${updatedFields.length} fields updated).`);
      });
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
    setSelectedFloorplanId(null);
    setSelectedWallId(null);
    setSelectedAreaId(null);
    setSelectedOpeningId(null);
    setSelectedEaveId(null);
    const wall = completedWallRuns.find((item) => item.id === row.itemId);
    const floorplan = completedFloorplans.find((item) => item.id === row.itemId);
    const area = completedAreas.find((item) => item.id === row.itemId);
    const opening = placedOpenings.find((item) => item.id === row.itemId);
    const eave = completedEaves.find((item) => item.id === row.itemId);
    const measurement = completedMeasurements.find((item) => item.id === row.itemId);
    if (wall) setSelectedWallId(wall.id);
    if (floorplan) setSelectedFloorplanId(floorplan.id);
    if (area) setSelectedAreaId(area.id);
    if (opening) setSelectedOpeningId(opening.id);
    if (eave) setSelectedEaveId(eave.id);
    if (measurement) setSelectedMeasurementId(measurement.id);
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );

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
            <input type="file" accept="image/*,.pdf" onChange={handleFileUpload} disabled={isRecoveryPreview} style={{ display: 'none' }} />
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
            <Download size={16} /> Download Backup
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
            <Upload size={16} /> Import Backup From Computer
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
            <button type="button" onClick={handleOpenJob} style={{ padding: '9px', background: '#4caf50', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Import Backup From Computer</button>
            <button type="button" onClick={() => document.getElementById('legacy-job-loader')?.click()} style={{ padding: '9px', background: '#fff', color: '#111827', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Import Takeoff Backup From Computer</button>
            <button type="button" onClick={createNewTakeoffJob} style={{ padding: '9px', background: '#111827', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Create New Takeoff Job</button>
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

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setRotation((r) => (r + 90) % 360)}
            disabled={isRecoveryPreview}
            style={{ flex: 1, padding: '10px', cursor: isRecoveryPreview ? 'not-allowed' : 'pointer', background: isRecoveryPreview ? '#e5e7eb' : '#fff', border: '1px solid #ccc', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '15px', fontWeight: '600' }}
          >
            <RotateCw size={18} /> Rotate 90Â°
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

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: '#f5f5f5', padding: '8px', borderRadius: '4px' }}>
              <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#333', flex: 1 }}>Wall Thickness:</label>
              <input
                type="number"
                value={detectedWallThicknessMm}
                onChange={(e) => setDetectedWallThicknessMm(parseFloat(e.target.value) || 0)}
                style={{ width: '80px', padding: '4px', fontSize: '14px', fontWeight: 'bold' }}
              />
              <span style={{ fontSize: '14px', color: '#1976d2' }}>mm</span>
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
                  <option value="Entry">Entry Doors</option>
                  <option value="Internal">Internal Doors</option>
                  <option value="Robe">Robe Sliders</option>
                  <option value="PanelLift">Garage Panel lift Door</option>
                  <option value="Roller">Roller Door</option>
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
                <option value="Standard Clear">Standard Clear</option>
                <option value="Obscured">Obscured (OBS)</option>
                <option value="Tinted">Tinted</option>
                <option value="Low E">Low E</option>
                <option value="Other">Other</option>
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
                  <label style={{ fontSize: '12px' }}>Construction class
                    <select value={selectedWall.exteriorType || 'Other'} onChange={(e) => { updateWallRun(selectedWall.id, { exteriorType: e.target.value }); markTakeoffItemCompleted('wall-construction-edit'); }} style={{ width: '100%', padding: '6px', marginTop: '4px' }}>
                      {EXTERIOR_WALL_CLASS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                )}
                {selectedWall.category === 'interior' && (
                  <>
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
                      <label style={{ fontSize: '12px' }}>Location / room
                        <input value={opening?.location || ''} onChange={(e) => setPlacedOpenings((prev) => prev.map((item) => item.id === opening.id ? { ...item, location: e.target.value } : item))} onBlur={() => markTakeoffItemCompleted('opening-location-edit')} style={{ width: '100%', padding: '6px', marginTop: '4px' }} />
                      </label>
                      <label style={{ fontSize: '12px' }}>Glass type
                        <input value={opening?.glassType || ''} onChange={(e) => setPlacedOpenings((prev) => prev.map((item) => item.id === opening.id ? { ...item, glassType: e.target.value } : item))} onBlur={() => markTakeoffItemCompleted('opening-glass-edit')} style={{ width: '100%', padding: '6px', marginTop: '4px' }} />
                      </label>
                      <label style={{ fontSize: '12px' }}>Frame/Jamb details
                        <input value={opening?.frameJambDetails || ''} onChange={(e) => setPlacedOpenings((prev) => prev.map((item) => item.id === opening.id ? { ...item, frameJambDetails: e.target.value } : item))} onBlur={() => markTakeoffItemCompleted('opening-jamb-edit')} style={{ width: '100%', padding: '6px', marginTop: '4px' }} />
                      </label>
                      <label style={{ fontSize: '12px' }}>Frame material
                        <input value={opening?.frameMaterial || ''} onChange={(e) => setPlacedOpenings((prev) => prev.map((item) => item.id === opening.id ? { ...item, frameMaterial: e.target.value } : item))} onBlur={() => markTakeoffItemCompleted('opening-frame-material-edit')} style={{ width: '100%', padding: '6px', marginTop: '4px' }} />
                      </label>
                      <label style={{ fontSize: '12px' }}>Frame colour
                        <input value={opening?.frameColour || ''} onChange={(e) => setPlacedOpenings((prev) => prev.map((item) => item.id === opening.id ? { ...item, frameColour: e.target.value } : item))} onBlur={() => markTakeoffItemCompleted('opening-frame-colour-edit')} style={{ width: '100%', padding: '6px', marginTop: '4px' }} />
                      </label>
                      <label style={{ fontSize: '12px' }}>Sill type
                        <input value={opening?.sillType || ''} onChange={(e) => setPlacedOpenings((prev) => prev.map((item) => item.id === opening.id ? { ...item, sillType: e.target.value } : item))} onBlur={() => markTakeoffItemCompleted('opening-sill-edit')} style={{ width: '100%', padding: '6px', marginTop: '4px' }} />
                      </label>
                      <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input type="checkbox" checked={Boolean(opening?.brickSillRequired)} onChange={(e) => { setPlacedOpenings((prev) => prev.map((item) => item.id === opening.id ? { ...item, brickSillRequired: e.target.checked } : item)); markTakeoffItemCompleted('opening-brick-sill-toggle'); }} />
                        Brick sill required
                      </label>
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
                  value={selectedEave.level}
                  onChange={(e) => setCompletedEaves((prev) => prev.map((item) => item.id === selectedEave.id ? { ...item, level: e.target.value } : item))}
                  style={{ padding: '6px', fontSize: '12px', fontWeight: 'bold' }}
                >
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
                <strong>{catTotal.toFixed(2)} mÂ²</strong>
              </div>
            );
          })}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 'bold', borderTop: '1px dashed #ccc', paddingTop: '6px', color: '#1b5e20' }}>
            <span>Total Floor Area:</span>
            <span>{totalFloorAreaM2.toFixed(2)} mÂ²</span>
          </div>
        </div>

        {/* Schedule of Areas Summary Card */}
        <div style={{ background: '#fff', padding: '12px', borderRadius: '6px', border: '2px solid #1565c0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h4 style={{ margin: 0, fontSize: '15px', color: '#1565c0', borderBottom: '1px solid #eee', paddingBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Home size={16} /> Schedule of Areas (Sheet {currentPage})
          </h4>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
            <span>Gross Footprint Area:</span>
            <strong>{pageFootprintArea.toFixed(2)} mÂ²</strong>
          </div>
          {activePageFloorplans.filter(f => f.type !== 'Footprint').map((fp) => (
            <div key={fp.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', paddingLeft: '8px', color: '#555' }}>
              <span>Less {fp.label}:</span>
              <span>- {calculatePolygonAreaM2(fp.nodes, pixelsPerMm).toFixed(2)} mÂ²</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 'bold', borderTop: '1px dashed #ccc', paddingTop: '6px', color: '#0d47a1' }}>
            <span>Total Living Area:</span>
            <span>{pageTotalLivingArea.toFixed(2)} mÂ²</span>
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
                onClick={() => setSelectedFloorplanId(fp.id)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', background: fp.id === selectedFloorplanId ? '#bbdefb' : '#e3f2fd', padding: '6px 8px', borderRadius: '4px', cursor: 'pointer', border: fp.id === selectedFloorplanId ? '1px solid #1976d2' : 'none' }}
              >
                <span><strong>[Plan] {fp.label}:</strong> {calculatePolygonAreaM2(fp.nodes, pixelsPerMm).toFixed(2)} mÂ²</span>
                <Trash2 size={16} style={{ cursor: 'pointer', color: '#d32f2f' }} onClick={(e) => { e.stopPropagation(); deleteMarkupItem('floorplan', fp.id); }} />
              </div>
            ))}

            {activePageAreas.map((areaItem) => {
              const cfg = FLOORCOVERING_CONFIGS[areaItem.category] || { stroke: '#2e7d32' };
              const isSelected = areaItem.id === selectedAreaId;
              return (
                <div 
                  key={areaItem.id} 
                  onClick={() => setSelectedAreaId(areaItem.id)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', background: isSelected ? '#c8e6c9' : '#f1f8e9', padding: '6px 8px', borderRadius: '4px', cursor: 'pointer', borderLeft: `4px solid ${cfg.stroke}`, border: isSelected ? '1px solid #2e7d32' : 'none' }}
                >
                  <span><strong>{areaItem.category}:</strong> {getNetFloorcoveringAreaM2(areaItem, pixelsPerMm).toFixed(2)} mÂ²</span>
                  <Trash2 size={16} style={{ cursor: 'pointer', color: '#d32f2f' }} onClick={(e) => { e.stopPropagation(); deleteMarkupItem('area', areaItem.id); }} />
                </div>
              );
            })}

            {activePageWalls.map((wall) => {
              const isSelected = wall.id === selectedWallId;
              return (
                <div 
                  key={wall.id}
                  onClick={() => setSelectedWallId(wall.id)}
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
                  onClick={() => {
                    setSelectedEaveId(eave.id);
                    setSelectedFloorplanId(null);
                    setSelectedWallId(null);
                    setSelectedAreaId(null);
                    setSelectedOpeningId(null);
                  }}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', background: eave.id === selectedEaveId ? '#b2ebf2' : '#e0f7fa', padding: '6px 8px', borderRadius: '4px', border: eave.id === selectedEaveId ? '1px solid #00838f' : '1px solid #80deea', cursor: 'pointer' }}
                >
                  <span><strong>Eaves #{idx + 1}:</strong> {getEaveWidthLabel(eave)} {eave.level} - {pixelsPerMm ? `${(distMm / 1000).toFixed(2)} m` : `${fallbackPx.toFixed(1)} px`}</span>
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
                  onClick={() => setSelectedOpeningId(op.id)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', background: isSelected ? '#ffe0b2' : '#fff3e0', padding: '8px', borderRadius: '4px', border: isSelected ? '1px solid #f57c00' : '1px solid #ffe0b2', cursor: 'pointer' }}
                >
                  <span><strong>{dynamicTag}</strong> (H:{op.heightMm} x W:{op.widthMm})</span>
                  <Trash2 size={16} style={{ cursor: 'pointer', color: '#d32f2f' }} onClick={(e) => { e.stopPropagation(); deleteMarkupItem('opening', op.id); }} />
                </div>
              );
            })}

            {activePageFloorplans.length === 0 && activePageAreas.length === 0 && activePageWalls.length === 0 && activePageOpenings.length === 0 && activePageMeasurements.length === 0 && activePageEaves.length === 0 && (
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
          <div><strong>Total Floorcoverings Area:</strong> {totalFloorAreaM2.toFixed(2)} mÂ²</div>
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
            <button onClick={() => setShowSchedule(false)} style={{ background: '#fff', border: 'none', borderRadius: '4px', padding: '6px 10px', cursor: 'pointer', fontWeight: 'bold' }}>Close</button>
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
              {renderScheduleRows('Exterior Walls', takeoffSchedule.currentSheet.exteriorWalls, 'Length')}
              {renderScheduleRows('Interior Walls and Plasterboard', takeoffSchedule.currentSheet.interiorWallsAndPlasterboard, 'Length')}
              {renderScheduleRows('Windows', takeoffSchedule.currentSheet.windows, 'Count')}
              {renderScheduleRows('Doors', takeoffSchedule.currentSheet.doors, 'Count')}
              {renderScheduleRows('Roof and Eaves', takeoffSchedule.currentSheet.roofAndEaves)}
              {renderScheduleRows('Floor Finishes', takeoffSchedule.currentSheet.floorFinishes)}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h4 style={{ margin: 0 }}>Combined Project Totals</h4>
              {renderScheduleRows('Floor Areas', takeoffSchedule.projectTotals.floorAreas)}
              {renderScheduleRows('Exterior Walls', takeoffSchedule.projectTotals.exteriorWalls, 'Length')}
              {renderScheduleRows('Interior Walls and Plasterboard', takeoffSchedule.projectTotals.interiorWallsAndPlasterboard, 'Length')}
              {renderScheduleRows('Individual Wall Records', takeoffSchedule.projectTotals.wallRecords, 'Length')}
              {renderScheduleRows('Windows', takeoffSchedule.projectTotals.windows, 'Count')}
              {renderScheduleRows('Doors', takeoffSchedule.projectTotals.doors, 'Count')}
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
            else if (activeTool === 'floorplan' || activeTool === 'floorcoverings') finalizeCurrentArea();
          }}
          onMouseMove={isRecoveryPreview ? undefined : handleMouseMove}
          onMouseUp={isRecoveryPreview ? undefined : handleMouseUp}
          draggable={false}
          scaleX={stageScale}
          scaleY={stageScale}
          x={stagePos.x}
          y={stagePos.y}
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
                      setSelectedFloorplanId(fp.id);
                      setSelectedWallId(null);
                      setSelectedAreaId(null);
                      setSelectedOpeningId(null);
                      setSelectedEaveId(null);
                    }}
                  />
                  <Text
                    x={fp.nodes[0].x}
                    y={fp.nodes[0].y}
                    text={`${fp.label}: ${calculatePolygonAreaM2(fp.nodes, pixelsPerMm).toFixed(2)} mÂ²`}
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
                      e.cancelBubble = true;
                      if (!selectModeActive && areaDrawMode !== 'exclusion') return;
                      if (areaDrawMode === 'exclusion') {
                        setSelectedAreaForExclusion(area.id);
                      } else {
                        setSelectedAreaId(area.id);
                        setSelectedFloorplanId(null);
                        setSelectedWallId(null);
                        setSelectedOpeningId(null);
                        setSelectedEaveId(null);
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
                    text={`${area.category}: ${getNetFloorcoveringAreaM2(area, pixelsPerMm).toFixed(2)} mÂ²`}
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
                      fill={run.category === 'exterior' ? (EXTERIOR_WALL_CLASS_COLOURS[run.exteriorType || 'Other'] || EXTERIOR_WALL_CLASS_COLOURS.Other) : "rgba(171, 71, 188, 0.4)"}
                      stroke={isSelected ? "#d32f2f" : (run.category === 'exterior' ? "#0033aa" : "#7b1fa2")}
                      strokeWidth={(isSelected ? 2.5 : 1.5) / stageScale}
                      closed
                      listening={markupListening}
                      hitStrokeWidth={20 / stageScale}
                      onClick={(e) => {
                        if (!selectModeActive) return;
                        e.cancelBubble = true;
                        setSelectedWallId(run.id);
                        setSelectedFloorplanId(null);
                        setSelectedAreaId(null);
                        setSelectedOpeningId(null);
                        setSelectedEaveId(null);
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
                      setSelectedWallId(run.id);
                      setSelectedFloorplanId(null);
                      setSelectedAreaId(null);
                      setSelectedOpeningId(null);
                      setSelectedEaveId(null);
                    }}
                  />

                  {isSelected && run.nodes.map((node, idx) => {
                    const nextNode = run.nodes[idx + 1];
                    const midX = nextNode ? (node.x + nextNode.x) / 2 : null;
                    const midY = nextNode ? (node.y + nextNode.y) / 2 : null;
                    const isEndpoint = idx === 0 || idx === run.nodes.length - 1;

                    return (
                      <React.Fragment key={`wall-handles-${idx}`}>
                        {isEndpoint ? (
                          <Circle
                            x={node.x}
                            y={node.y}
                            radius={6.5 / stageScale}
                            fill="#d32f2f"
                            stroke="#fff"
                            strokeWidth={1.5 / stageScale}
                            listening={markupListening}
                            draggable={selectModeActive}
                            onDragStart={() => setDraggingVertex({ type: 'wall', id: run.id, vertexIndex: idx })}
                          />
                        ) : null}
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
                    setSelectedOpeningId(op.id);
                    setSelectedFloorplanId(null);
                    setSelectedWallId(null);
                    setSelectedAreaId(null);
                    setSelectedEaveId(null);
                    setDraggingItem({ type: 'opening', id: op.id });
                  }}
                  onClick={(e) => {
                    if (!selectModeActive) return;
                    e.cancelBubble = true;
                    setSelectedOpeningId(op.id);
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
                fill={FLOORCOVERING_CONFIGS[floorcoveringOption]?.fill || "rgba(76, 175, 80, 0.3)"}
                stroke={FLOORCOVERING_CONFIGS[floorcoveringOption]?.stroke || "#2e7d32"}
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
                      setSelectedMeasurementId(meas.id);
                      setDraggingMeasureId(meas.id);
                      pointerEditInProgressRef.current = true;
                    }}
                    onClick={(e) => {
                      if (!selectModeActive) return;
                      e.cancelBubble = true;
                      setSelectedMeasurementId(meas.id);
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
                      setSelectedMeasurementId(meas.id);
                      setDraggingMeasureId(meas.id);
                      pointerEditInProgressRef.current = true;
                    }}
                    onClick={(e) => {
                      if (!selectModeActive) return;
                      e.cancelBubble = true;
                      setSelectedMeasurementId(meas.id);
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
                        e.cancelBubble = true;
                        setSelectedEaveId(eave.id);
                        setSelectedFloorplanId(null);
                        setSelectedWallId(null);
                        setSelectedAreaId(null);
                        setSelectedOpeningId(null);
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
                      e.cancelBubble = true;
                      setSelectedEaveId(eave.id);
                      setSelectedFloorplanId(null);
                      setSelectedWallId(null);
                      setSelectedAreaId(null);
                      setSelectedOpeningId(null);
                    }}
                  />
                  <Text
                    x={labelNode.x}
                    y={labelNode.y - MEASURE_LABEL_OFFSET / stageScale}
                    text={`${getEaveWidthLabel(eave)} ${eave.level}: ${lengthLabel}`}
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

            {mouseHoverPos && (
              <Group x={mouseHoverPos.x} y={mouseHoverPos.y}>
                <Line
                  points={[-24 / stageScale, 0, 24 / stageScale, 0]}
                  stroke={mouseHoverPos.snapped ? "#00e676" : "#ff1744"}
                  strokeWidth={3 / stageScale}
                />
                <Line
                  points={[0, -24 / stageScale, 0, 24 / stageScale]}
                  stroke={mouseHoverPos.snapped ? "#00e676" : "#ff1744"}
                  strokeWidth={3 / stageScale}
                />
                <Circle
                  radius={8 / stageScale}
                  stroke={mouseHoverPos.snapped ? "#00e676" : "#ff1744"}
                  strokeWidth={2.5 / stageScale}
                />
              </Group>
            )}
          </Layer>
        </Stage>
      </div>
    </div>
  );
}
