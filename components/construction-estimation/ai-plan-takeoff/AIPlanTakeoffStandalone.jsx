import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Stage, Layer, Image as KonvaImage, Line, Circle, Text, Rect, Group } from 'react-konva';
import { RotateCw, Ruler, ChevronLeft, ChevronRight, DoorOpen, Square, Layers, Trash2, Home, Compass, Download, Upload } from 'lucide-react';
import { calculatePolygonAreaM2, findFloorplanCornerSnapPoint, resolveFloorplanFreePoint } from './floorplanGeometry';
import { createJobData, createPortableTakeoffExport, getEmbeddedPlanPages, getSavedFloorCoveringAreas, resolvePortableTakeoffImport } from './jobPersistence';
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

import * as pdfjsLib from 'pdfjs-dist';
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const MEASURE_LABEL_FONT_SIZE = 24;
const MEASURE_LABEL_OFFSET = 30;
const EAVE_WIDTH_OPTIONS = ['450', '600', '900', 'Special'];
const EAVE_LEVEL_OPTIONS = ['Ground Floor', 'Second Level', 'Third Level'];

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function sanitizeJobFileName(name) {
  const cleaned = (name || '').trim().replace(/[^a-z0-9-_ ]/gi, '').replace(/\s+/g, '_');
  return cleaned || `takeoff_job_${Date.now()}`;
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
  onBackToDashboard = null
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
  const [jobName, setJobName] = useState(platformContext.projectName || '');
  const [jobFileHandle, setJobFileHandle] = useState(null);
  const [planPages, setPlanPages] = useState([]);
  const [planFilename, setPlanFilename] = useState(platformContext.fileName || '');
  const [planMissingFromSavedJob, setPlanMissingFromSavedJob] = useState(false);
  const [savedRevision, setSavedRevision] = useState(Number(initialJob?.revision || 0));
  const [lastSuccessfulSaveAt, setLastSuccessfulSaveAt] = useState(initialJob?.updatedAt || '');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [importedTakeoffFileName, setImportedTakeoffFileName] = useState(initialJob?.sourceFileName || '');
  const suppressUnsavedChangeRef = useRef(true);
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
  const [glassType, setGlassType] = useState('Standard Clear');
  const [placedOpenings, setPlacedOpenings] = useState([]);
  const [selectedOpeningId, setSelectedOpeningId] = useState(null);

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
  const renderTaskRef = useRef(null);
  const loadedInitialJobRef = useRef(false);
  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 800 });

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
      const rect = canvasHostRef.current?.getBoundingClientRect?.();
      setCanvasSize({
        width: Math.max(640, Math.floor(rect?.width || (typeof window !== 'undefined' ? window.innerWidth - 420 : 1200))),
        height: Math.max(480, Math.floor(rect?.height || (typeof window !== 'undefined' ? window.innerHeight : 800)))
      });
    };
    updateCanvasSize();
    if (typeof ResizeObserver !== 'undefined' && canvasHostRef.current) {
      const observer = new ResizeObserver(updateCanvasSize);
      observer.observe(canvasHostRef.current);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, []);

  // Save / Load Job functionality
  const buildJobData = (name) => {
    return createJobData({
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
      revision: savedRevision,
      baseRevision: savedRevision,
      platformProject: {
        projectId: platformContext.projectId || '',
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
  };

  const downloadJobFile = (name) => {
    const safeName = sanitizeJobFileName(name);
    const jobData = buildJobData(name);
    const blob = new Blob([JSON.stringify(jobData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}.json`;
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
    const embeddedPages = getEmbeddedPlanPages(takeoffJobData);

    setPdfDoc(null);
    setPlanPages(embeddedPages);
    setCompletedWallRuns(takeoffJobData.completedWallRuns || []);
    setPlacedOpenings(takeoffJobData.placedOpenings || []);
    setCompletedAreas(getSavedFloorCoveringAreas(takeoffJobData, takeoffJobData.pixelsPerMm || pixelsPerMm));
    setCompletedFloorplans(takeoffJobData.completedFloorplans || []);
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

    setPlanMissingFromSavedJob(embeddedPages.length === 0 && Boolean(takeoffJobData?.jobName || fallbackName));
    setSavedRevision(Number(takeoffJobData.revision || 0));
    setLastSuccessfulSaveAt(takeoffJobData.updatedAt || '');
    setHasUnsavedChanges(false);
    suppressUnsavedChangeRef.current = true;

    if (embeddedPages.length > 0) {
      await showPlanPage(embeddedPages, takeoffJobData.currentPage || 1);
    } else {
      setImage(null);
      setVectorSegments([]);
    }

    setJobName(takeoffJobData.jobName || fallbackName);
  };

  useEffect(() => {
    if (loadedInitialJobRef.current || !initialJob) return;
    loadedInitialJobRef.current = true;
    loadJobData(initialJob, initialJob.jobName || platformContext.projectName || '').catch((error) => {
      console.error("Failed to restore platform takeoff job:", error);
    });
  }, [initialJob, platformContext.projectName]);

  useEffect(() => {
    if (suppressUnsavedChangeRef.current) {
      suppressUnsavedChangeRef.current = false;
      return;
    }
    setHasUnsavedChanges(true);
  }, [
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
    scheduleMappings
  ]);

  useEffect(() => {
    setProjectInfo((prev) => ({
      projectName: prev.projectName || platformContext.projectName || '',
      clientName: prev.clientName || platformContext.clientName || '',
      siteAddress: prev.siteAddress || platformContext.siteAddress || platformContext.projectAddress || '',
      storeyOrLevelName: prev.storeyOrLevelName || platformContext.storeyOrLevelName || ''
    }));
    setJobName((current) => current || platformContext.projectName || '');
  }, [platformContext.projectName, platformContext.clientName, platformContext.siteAddress, platformContext.projectAddress, platformContext.storeyOrLevelName]);

  useEffect(() => {
    if (Array.isArray(initialQuoteRows) && initialQuoteRows.length) {
      setQuoteSheetRows(initialQuoteRows);
    }
  }, [initialQuoteRows]);

  const currentProjectLabel = platformContext.projectName || platformContext.jobNumber || projectInfo.projectName || jobName || 'Current Project';

  const handleSaveJob = async () => {
    if (embedded && onSaveToPlatform) {
      if (!platformContext.projectId && !platformContext.jobNumber && !platformContext.projectName) {
        alert("Open or create a platform job before saving AI Plan Takeoff to the platform.");
        return;
      }
      const nextName = jobName || platformContext.projectName || 'AI Plan Takeoff';
      const jobData = buildJobData(nextName);
      const result = await Promise.resolve(onSaveToPlatform(jobData));
      if (!result?.ok) {
        const message = result?.message || "Save failed - latest plan changes were not stored";
        setPlatformSaveMessage(message);
        alert(message);
        return;
      }
      setJobName(nextName);
      setSavedRevision(Number(result.revision || jobData.revision || 0));
      setLastSuccessfulSaveAt(result.savedAt || new Date().toISOString());
      setHasUnsavedChanges(false);
      setPlatformSaveMessage(result.message || `Saved - Revision ${result.revision}`);
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

  const handleExportTakeoffFile = async () => {
    const exportName = currentProjectLabel;
    const jobData = buildJobData(jobName || exportName);
    const portable = createPortableTakeoffExport(jobData, {
      projectId: platformContext.projectId || '',
      projectName: exportName,
      takeoffName: jobName || importedTakeoffFileName || exportName,
      sourceFileName: importedTakeoffFileName || planFilename || ''
    });
    const filename = `${sanitizeJobFileName(`${exportName}-takeoff-rev-${portable.revision || savedRevision || 0}`)}.json`;
    const blob = new Blob([JSON.stringify(portable, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const confirmImportedTakeoff = (imported, fileName) => {
    const counts = imported.summary.counts || {};
    const message = [
      `Import takeoff file into ${currentProjectLabel}?`,
      '',
      `Detected takeoff: ${imported.summary.takeoffName || fileName}`,
      `Pages: ${imported.summary.pageCount}`,
      `Revision: ${imported.summary.revision || 0}`,
      `Floor coverings: ${counts.floorCoverings || 0}`,
      `Floor areas: ${counts.floorplans || 0}`,
      `Walls: ${counts.walls || 0}`,
      `Openings: ${counts.openings || 0}`,
      `Eaves: ${counts.eaves || 0}`
    ].join('\n');
    return window.confirm(message);
  };

  const handleOpenJob = async () => {
    if (!window.showOpenFilePicker) {
      document.getElementById('legacy-job-loader')?.click();
      return;
    }
    try {
      const [fileHandle] = await window.showOpenFilePicker({
        types: [{ description: 'Takeoff Job', accept: { 'application/json': ['.json'] } }],
        multiple: false
      });
      const file = await fileHandle.getFile();
      const data = JSON.parse(await file.text());
      const imported = resolvePortableTakeoffImport(data);
      if (!imported.ok) {
        alert(imported.message);
        return;
      }
      if (!confirmImportedTakeoff(imported, file.name)) return;
      const takeoffJobData = { ...imported.job, sourceFileName: file.name };
      setJobFileHandle(null);
      await loadJobData(takeoffJobData, file.name.replace(/\.json$/i, ''));
      setImportedTakeoffFileName(file.name);
      if (embedded && onSaveToPlatform) {
        const result = await Promise.resolve(onSaveToPlatform({
          ...takeoffJobData,
          takeoffName: takeoffJobData.takeoffName || takeoffJobData.jobName || file.name.replace(/\.json$/i, ''),
          sourceFileName: file.name,
          baseRevision: savedRevision,
          platformProject: buildJobData(takeoffJobData.jobName || file.name).platformProject
        }));
        if (!result?.ok) {
          const message = result?.message || "Save failed - latest plan changes were not stored";
          setPlatformSaveMessage(message);
          alert(message);
          return;
        }
        setSavedRevision(Number(result.revision || 0));
        setLastSuccessfulSaveAt(result.savedAt || new Date().toISOString());
        setHasUnsavedChanges(false);
        setPlatformSaveMessage(`Imported ${file.name} into ${currentProjectLabel}. ${result.message || `Saved - Revision ${result.revision}`}`);
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
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target.result);
        const imported = resolvePortableTakeoffImport(data);
        if (!imported.ok) {
          alert(imported.message);
          return;
        }
        if (!confirmImportedTakeoff(imported, file.name)) return;
        const takeoffJobData = { ...imported.job, sourceFileName: file.name };
        setJobFileHandle(null);
        await loadJobData(takeoffJobData, file.name.replace(/\.json$/i, ''));
        setImportedTakeoffFileName(file.name);
        if (embedded && onSaveToPlatform) {
          const result = await Promise.resolve(onSaveToPlatform({
            ...takeoffJobData,
            takeoffName: takeoffJobData.takeoffName || takeoffJobData.jobName || file.name.replace(/\.json$/i, ''),
            sourceFileName: file.name,
            baseRevision: savedRevision,
            platformProject: buildJobData(takeoffJobData.jobName || file.name).platformProject
          }));
          if (!result?.ok) {
            const message = result?.message || "Save failed - latest plan changes were not stored";
            setPlatformSaveMessage(message);
            alert(message);
            return;
          }
          setSavedRevision(Number(result.revision || 0));
          setLastSuccessfulSaveAt(result.savedAt || new Date().toISOString());
          setHasUnsavedChanges(false);
          setPlatformSaveMessage(`Imported ${file.name} into ${currentProjectLabel}. ${result.message || `Saved - Revision ${result.revision}`}`);
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
      lengthMm
    };

    setCompletedWallRuns((prev) => [...prev, newRun]);
    setSelectedWallId(newRun.id);
    setActivePolyline([]);
  }, [activePolyline, pixelsPerMm, currentPage, wallCategory, detectedWallThicknessMm, alignment, getWallRunLengthMm]);

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
  }, [eavePoints, pixelsPerMm, currentPage, eaveWidthOption, specialEaveWidthMm, eaveLevel, eaveAlignment, getWallRunLengthMm]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (activePolyline.length >= 2) {
          finalizeCurrentWallRun();
        } else if (eavePoints.length >= 2) {
          finalizeCurrentEaveRun();
        } else {
          setActivePolyline([]);
          setEavePoints([]);
        }
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
        setDraggingVertex(null);
        setDraggingItem(null);
        setDraggingMeasureId(null);
        setDraggingEaveId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePolyline, activeAreaPolyline, eavePoints, finalizeCurrentWallRun, finalizeCurrentEaveRun]);

  useEffect(() => {
    if (openingType === 'door') {
      setOpeningHeightMm(2040);
      setOpeningWidthMm(820);
      setSizeCodeInput('2082');
    } else {
      setOpeningHeightMm(1800);
      setOpeningWidthMm(1200);
      setSizeCodeInput('1812');
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

    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      const arrayBuffer = await file.arrayBuffer();
      const loadedPdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const embeddedPages = [];
      for (let pageNumber = 1; pageNumber <= loadedPdf.numPages; pageNumber++) {
        embeddedPages.push(await renderPdfPageForJob(loadedPdf, pageNumber));
      }
      setPdfDoc(null);
      setPlanPages(embeddedPages);
      setTotalPages(loadedPdf.numPages);
      setCurrentPage(1);
      setPlanMissingFromSavedJob(false);
      await showPlanPage(embeddedPages, 1);
    } else {
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
    }
  };

  const getCanvasPointerPos = () => {
    const stage = stageRef.current;
    if (!stage) return null;
    const point = stage.getPointerPosition();
    if (!point) return null;

    if (layerRef.current) {
      const transform = layerRef.current.getAbsoluteTransform().copy().invert();
      return transform.point(point);
    }

    const transform = stage.getAbsoluteTransform().copy().invert();
    return transform.point(point);
  };

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

  const handleStageClick = (e) => {
    if (draggingVertex || draggingItem || draggingMeasureId || draggingEaveId) return;
    const pos = getCanvasPointerPos();
    if (!pos) return;
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
      const snap = getGeneralSnapPoint(pos.x, pos.y);
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
        itemTag: autoLabel,
        heightMm: openingHeightMm,
        widthMm: openingWidthMm,
        subType: openingType === 'window' ? windowSubtype : doorSubtype,
        glassType: glassType,
        x: snap.x,
        y: snap.y
      };

      setPlacedOpenings((prev) => [...prev, newOpening]);
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
    }
  };

  const handleMouseMove = (e) => {
    const pos = getCanvasPointerPos();
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
            return { ...op, x: pos.x, y: pos.y };
          }
          return op;
        }));
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
      } else if (type === 'area') {
        setCompletedAreas((prev) => prev.map((area) => {
          if (area.id === id) {
            const updatedNodes = [...area.nodes];
            updatedNodes[vertexIndex] = { x: snap.x, y: snap.y };
            return { ...area, nodes: updatedNodes };
          }
          return area;
        }));
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
        setMouseHoverPos({ x: snap.x, y: firstPt.y, snapped: snap.snapped });
      } else {
        setMouseHoverPos({ x: firstPt.x, y: snap.y, snapped: snap.snapped });
      }
    } else if (activeTool === 'measure' && measurePoints.length === 1) {
      const firstPt = measurePoints[0];
      const dx = Math.abs(snap.x - firstPt.x);
      const dy = Math.abs(snap.y - firstPt.y);
      if (dx >= dy) {
        setMouseHoverPos({ x: snap.x, y: firstPt.y, snapped: snap.snapped });
      } else {
        setMouseHoverPos({ x: firstPt.x, y: snap.y, snapped: snap.snapped });
      }
    } else if (activeTool === 'eaves' && eavePoints.length > 0) {
      setMouseHoverPos({ x: snap.x, y: snap.y, snapped: snap.snapped });
    } else if (activeTool === 'wall' && activePolyline.length > 0) {
      setMouseHoverPos({ x: snap.x, y: snap.y, snapped: snap.snapped });
    } else if (activeTool === 'floorplan' && activeAreaPolyline.length > 0) {
      const previousPoint = activeAreaPolyline[activeAreaPolyline.length - 1];
      const nextPoint = resolveFloorplanFreePoint(pos, previousPoint, shiftKey);
      setMouseHoverPos({ ...nextPoint, snapped: false });
    } else if (activeTool === 'floorcoverings' && activeAreaPolyline.length > 0) {
      // Free movement without axis locking for area preview
      setMouseHoverPos({ x: snap.x, y: snap.y, snapped: snap.snapped });
    } else {
      setMouseHoverPos({ x: snap.x, y: snap.y, snapped: snap.snapped });
    }
  };

  const handleMouseUp = () => {
    setDraggingVertex(null);
    setDraggingItem(null);
    setDraggingMeasureId(null);
    setDraggingEaveId(null);
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

  const deleteMarkupItem = (type, id) => {
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
    }
    if (type === 'eaves') {
      setCompletedEaves((prev) => prev.filter((e) => e.id !== id));
      if (selectedEaveId === id) setSelectedEaveId(null);
    }
  };

  const activePageWalls = completedWallRuns.filter((w) => w.page === currentPage);
  const activePageAreas = completedAreas.filter((a) => a.page === currentPage);
  const activePageOpenings = placedOpenings.filter((o) => o.page === currentPage);
  const activePageFloorplans = completedFloorplans.filter((f) => f.page === currentPage);
  const activePageMeasurements = completedMeasurements.filter((m) => m.page === currentPage);
  const activePageEaves = completedEaves.filter((e) => e.page === currentPage);

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

  const baseScale = 6.0;
  const dpr = window.devicePixelRatio || 1;
  const currentPlanPage = planPages.find((p) => p.pageNumber === currentPage) || planPages[currentPage - 1];
  const logicalImageWidth = image
    ? currentPlanPage?.logicalWidth || image.width / (currentPlanPage?.renderScale || baseScale * dpr)
    : 0;
  const logicalImageHeight = image
    ? currentPlanPage?.logicalHeight || image.height / (currentPlanPage?.renderScale || baseScale * dpr)
    : 0;

  const selectedFp = activePageFloorplans.find(f => f.id === selectedFloorplanId);
  const selectedWall = activePageWalls.find(w => w.id === selectedWallId);
  const selectedEave = activePageEaves.find(e => e.id === selectedEaveId);
  const takeoffSchedule = createTakeoffSchedule({
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
    completedEaves
  });
  const scheduleSignature = getScheduleSignature(takeoffSchedule);
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
    const payload = createJobSetupPayload(takeoffSchedule);
    setJobSetupPayload(payload);
    if (onJobSetupUpdate) {
      Promise.resolve(onJobSetupUpdate(payload)).then(() => {
        setPlatformSaveMessage("Sent takeoff project details to Job Setup.");
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
    if (page) setCurrentPage(page);
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
    if (wall) setSelectedWallId(wall.id);
    if (floorplan) setSelectedFloorplanId(floorplan.id);
    if (area) setSelectedAreaId(area.id);
    if (opening) setSelectedOpeningId(opening.id);
    if (eave) setSelectedEaveId(eave.id);
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

  if (embedded && platformContext.noJobOpen) {
    return (
      <div style={{ padding: '24px', minHeight: '520px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ maxWidth: '560px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '24px', boxShadow: '0 16px 36px rgba(15,23,42,0.08)' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: '22px', color: '#0f172a' }}>No project open</h2>
          <p style={{ margin: '0 0 16px', color: '#475569', lineHeight: 1.5 }}>Open or create a Project Workspace job before using AI Plan Takeoff. The takeoff will be saved against that project ID.</p>
          <button type="button" onClick={onBackToDashboard} style={{ padding: '10px 14px', background: '#111827', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            Back to Project Dashboard
          </button>
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
          <label style={{ padding: '8px', background: '#fff', border: '1px solid #ccc', borderRadius: '4px', textAlign: 'center', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
            <Upload size={16} /> Open Plan
            <input type="file" accept="image/*,.pdf" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>
          <label style={{ display: 'none' }}>
            Relink Original Plan
            <input id="relink-original-plan-loader" type="file" accept="image/*,.pdf" onChange={(event) => handleFileUpload(event, { preserveTakeoffs: true })} />
          </label>
          <button
            onClick={handleExportTakeoffFile}
            style={{ padding: '8px', background: '#455a64', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
            title="Download a complete portable takeoff backup"
          >
            <Download size={16} /> Export Takeoff File
          </button>
          <button
            onClick={handleSaveJob}
            style={{ padding: '8px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
            title="Save complete progress to the active platform project"
          >
            <Download size={16} /> Save Progress
          </button>
          <button
            onClick={handleOpenJob}
            style={{ padding: '8px', background: '#4caf50', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
            title="Import a previously exported takeoff backup into this project"
          >
            <Upload size={16} /> Import Takeoff File
          </button>
          <input id="legacy-job-loader" type="file" accept=".json" onChange={handleLoadJob} style={{ display: 'none' }} />
        </div>

        <div style={{ background: '#fff', border: '1px solid #ddd', borderRadius: '4px', padding: '6px 8px', fontSize: '13px', display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
          <span style={{ color: '#555' }}>Current Project:</span>
          <strong style={{ color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentProjectLabel}</strong>
        </div>
        {importedTakeoffFileName && (
          <div style={{ background: '#fff', border: '1px solid #ddd', borderRadius: '4px', padding: '6px 8px', fontSize: '12px', color: '#475569' }}>
            Imported takeoff: <strong>{importedTakeoffFileName}</strong>
          </div>
        )}
        {platformSaveMessage && (
          <div style={{ background: '#ecfdf5', border: '1px solid #86efac', borderRadius: '4px', padding: '6px 8px', color: '#166534', fontSize: '12px', fontWeight: 'bold' }}>{platformSaveMessage}</div>
        )}
        <div style={{ background: hasUnsavedChanges ? '#fff7ed' : '#f8fafc', border: `1px solid ${hasUnsavedChanges ? '#fdba74' : '#cbd5e1'}`, borderRadius: '4px', padding: '6px 8px', color: hasUnsavedChanges ? '#9a3412' : '#334155', fontSize: '12px', fontWeight: 'bold' }}>
          {hasUnsavedChanges ? 'Unsaved changes' : `Saved revision ${savedRevision || 0}`}
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
            <button disabled={currentPage === 1} onClick={() => setCurrentPage((c) => c - 1)} style={{ cursor: 'pointer', border: 'none', background: 'transparent' }}><ChevronLeft size={20} /></button>
            <span style={{ fontSize: '16px', fontWeight: 'bold' }}>Sheet {currentPage} of {totalPages}</span>
            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage((c) => c + 1)} style={{ cursor: 'pointer', border: 'none', background: 'transparent' }}><ChevronRight size={20} /></button>
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setRotation((r) => (r + 90) % 360)}
            style={{ flex: 1, padding: '10px', cursor: 'pointer', background: '#fff', border: '1px solid #ccc', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '15px', fontWeight: '600' }}
          >
            <RotateCw size={18} /> Rotate 90°
          </button>
          <button
            onClick={() => { setCalibrationMode(!calibrationMode); setCalibPoints([]); setActivePolyline([]); setActiveAreaPolyline([]); }}
            style={{ flex: 1, padding: '10px', cursor: 'pointer', background: calibrationMode ? '#ffc107' : '#fff', border: '1px solid #ccc', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '15px', fontWeight: '600' }}
          >
            <Ruler size={18} /> {calibrationMode ? 'Cancel' : 'Calibrate'}
          </button>
          <button
            onClick={() => { setActiveTool('measure'); setMeasurePoints([]); setEavePoints([]); }}
            style={{ padding: '10px 14px', cursor: 'pointer', background: activeTool === 'measure' ? '#4caf50' : '#fff', color: activeTool === 'measure' ? '#fff' : '#333', border: '1px solid #ccc', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '14px', fontWeight: '600' }}
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
                onClick={() => setSelectedFloorplanId(fp.id)}
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
                  onClick={() => setSelectedAreaId(areaItem.id)}
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
            <button onClick={handleSendToJobSetup} style={{ padding: '8px 10px', background: '#4b5563', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Send to Job Setup</button>
            <button onClick={handlePrepareQuotePreview} style={{ padding: '8px 10px', background: quoteSheetOutOfDate ? '#f57c00' : '#111827', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
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
              {renderScheduleRows('Walls', takeoffSchedule.currentSheet.walls, 'Length')}
              {renderScheduleRows('Openings', takeoffSchedule.currentSheet.openings, 'Count')}
              {renderScheduleRows('Roof and Eaves', takeoffSchedule.currentSheet.roofAndEaves)}
              {renderScheduleRows('Floor Finishes', takeoffSchedule.currentSheet.floorFinishes)}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h4 style={{ margin: 0 }}>Combined Project Totals</h4>
              {renderScheduleRows('Floor Areas', takeoffSchedule.projectTotals.floorAreas)}
              {renderScheduleRows('Walls', takeoffSchedule.projectTotals.walls, 'Length')}
              {renderScheduleRows('Individual Wall Records', takeoffSchedule.projectTotals.wallRecords, 'Length')}
              {renderScheduleRows('Openings', takeoffSchedule.projectTotals.openings, 'Count')}
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
                  <button onClick={handleApplyQuotePreview} style={{ padding: '8px 10px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Apply Mapped Quantities</button>
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
      <div ref={canvasHostRef} style={{ flex: 1, position: 'relative', background: '#e5e5e5', minWidth: 0 }}>
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
            const oldScale = stage.scaleX();
            const pointer = stage.getPointerPosition();
            const mousePointTo = { x: (pointer.x - stage.x()) / oldScale, y: (pointer.y - stage.y()) / oldScale };
            const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;

            setStageScale(newScale);
            setStagePos({ x: pointer.x - mousePointTo.x * newScale, y: pointer.y - mousePointTo.y * newScale });
          }}
          onClick={handleStageClick}
          onDblClick={() => {
            if (activeTool === 'wall') finalizeCurrentWallRun();
            else if (activeTool === 'eaves') finalizeCurrentEaveRun();
            else if (activeTool === 'floorplan' || activeTool === 'floorcoverings') finalizeCurrentArea();
          }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          draggable={!calibrationMode && !draggingVertex && !draggingItem && !draggingMeasureId && !draggingEaveId && activeTool !== 'measure' && activeTool !== 'eaves' && activePolyline.length === 0 && activeAreaPolyline.length === 0 && eavePoints.length === 0}
          scaleX={stageScale}
          scaleY={stageScale}
          x={stagePos.x}
          y={stagePos.y}
          ref={stageRef}
        >
          <Layer
            ref={layerRef}
            rotation={rotation}
            x={logicalImageWidth / 2}
            y={logicalImageHeight / 2}
            offsetX={logicalImageWidth / 2}
            offsetY={logicalImageHeight / 2}
          >
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
                    listening={activeTool !== 'floorplan'}
                    onClick={(e) => {
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
                          listening={activeTool !== 'floorplan'}
                          draggable
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
                          listening={activeTool !== 'floorplan'}
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
                    listening={activeTool !== 'floorplan'}
                    onClick={(e) => {
                      e.cancelBubble = true;
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
                      listening={activeTool !== 'floorplan'}
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
                          listening={activeTool !== 'floorplan'}
                          draggable
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
                          listening={activeTool !== 'floorplan'}
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
                      fill={run.category === 'exterior' ? "rgba(0, 85, 255, 0.4)" : "rgba(171, 71, 188, 0.4)"}
                      stroke={isSelected ? "#d32f2f" : (run.category === 'exterior' ? "#0033aa" : "#7b1fa2")}
                      strokeWidth={(isSelected ? 2.5 : 1.5) / stageScale}
                      closed
                      listening={activeTool !== 'floorplan'}
                      onClick={(e) => {
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
                    listening={activeTool !== 'floorplan'}
                    onClick={(e) => {
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

                    return (
                      <React.Fragment key={`wall-handles-${idx}`}>
                        <Circle
                          x={node.x}
                          y={node.y}
                          radius={6 / stageScale}
                          fill="#d32f2f"
                          stroke="#fff"
                          strokeWidth={1.5 / stageScale}
                          listening={activeTool !== 'floorplan'}
                          draggable
                          onDragStart={() => setDraggingVertex({ type: 'wall', id: run.id, vertexIndex: idx })}
                          onClick={(e) => {
                            e.cancelBubble = true;
                            if (run.nodes.length > 2) deleteVertexFromPolygon('wall', run.id, idx);
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
                            listening={activeTool !== 'floorplan'}
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
              const dynamicTag = `${tagPrefix}${idx + 1}: ${op.itemTag.split(': ')[1] || op.itemTag}`;
              const isSelected = op.id === selectedOpeningId;
              return (
                <Group
                  key={op.id}
                  x={op.x}
                  y={op.y}
                  listening={activeTool !== 'floorplan'}
                  draggable
                  onDragStart={() => {
                    setSelectedOpeningId(op.id);
                    setSelectedFloorplanId(null);
                    setSelectedWallId(null);
                    setSelectedAreaId(null);
                    setSelectedEaveId(null);
                    setDraggingItem({ type: 'opening', id: op.id });
                  }}
                  onClick={(e) => {
                    e.cancelBubble = true;
                    setSelectedOpeningId(op.id);
                  }}
                >
                  <Rect
                    x={-((op.widthMm * (pixelsPerMm || 1)) / 2)}
                    y={-10 / stageScale}
                    width={op.widthMm * (pixelsPerMm || 1)}
                    height={20 / stageScale}
                    fill={isSelected ? '#ffa726' : (op.type === 'window' ? '#ffe0b2' : '#ffcdd2')}
                    stroke={isSelected ? '#e65100' : (op.type === 'window' ? '#e65100' : '#c62828')}
                    strokeWidth={(isSelected ? 2.5 : 1.5) / stageScale}
                  />
                  <Text
                    x={-((op.widthMm * (pixelsPerMm || 1)) / 2)}
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
                    stroke="#2e7d32"
                    strokeWidth={2 / stageScale}
                    draggable
                    onDragStart={() => setDraggingMeasureId(meas.id)}
                  />
                  <Circle x={offP1.x} y={offP1.y} radius={3.5 / stageScale} fill="#2e7d32" />
                  <Circle x={offP2.x} y={offP2.y} radius={3.5 / stageScale} fill="#2e7d32" />
                  
                  <Text
                    x={midX}
                    y={midY - MEASURE_LABEL_OFFSET / stageScale}
                    text={pixelsPerMm ? `${distMm.toFixed(0)} mm` : `${distPx.toFixed(1)} px`}
                    fontSize={MEASURE_LABEL_FONT_SIZE / stageScale}
                    fill="#1b5e20"
                    fontStyle="bold"
                    draggable
                    onDragStart={() => setDraggingMeasureId(meas.id)}
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
                      listening={activeTool !== 'floorplan'}
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
                    listening={activeTool !== 'floorplan'}
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
                          listening={activeTool !== 'floorplan'}
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
                            listening={activeTool !== 'floorplan'}
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
