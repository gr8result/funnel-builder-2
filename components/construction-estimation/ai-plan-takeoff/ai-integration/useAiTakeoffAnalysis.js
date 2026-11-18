import { readRoomRaster } from './roomBoundaryVision.js';
import { detectRoomBoundary, measureRoom, approveRoom } from './roomGeometry.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fingerprintTakeoffDocument, fingerprintTakeoffPage } from './documentIdentity.js';
import { prepareAnalysisPage, prepareGeometryReviewImage, restoreAnalysisCoordinates } from './analysisPages.js';
import { requestTakeoffAnalysis } from './analysisClient.js';
import { normalizePlanAnalysis, resolveAnalysisScale } from './analysisContract.js';
import { MEASUREMENT_SCOPES, ROOMS_SCOPE, mergeMeasurementScopes } from './measurementScopes.js';
import { ROOMS_RUN_ID, addManualRoom, floorPlanSheets, mergeRoomReadings, removeRoom as removeScheduleRoom, reportWithRooms } from './roomSchedule.js';
import { compactPlanEvidence, evidenceRotation, mergePlanEvidence, projectDefaultsFromJobSetup } from './planEvidence.js';
import { applyReviewDecision, reviewAudience } from './reviewSummary.js';
import { fuseSheetLinework } from '../geometry/lineworkFusion.js';
import { JOB_SCALE_KEY, calibrationsWithSheets, jobPixelsPerMm, sheetPixelsPerMm as scaleOfSheet, rescaleRunLengths, sheetsWithChangedScale, withdrawApprovalsForScaleChange } from '../sheetScale.js';
import { cropPlanRegion, readPlanRaster } from '../geometry/planRaster.js';
import { detectPlanGeometry } from '../geometry/planGeometry.js';
import { collectRegionOpenings, planRegions } from '../geometry/planRegions.js';
import { detectVectorWalls } from '../geometry/vectorWalls.js';
import { roomsFromWallRuns, reviewCandidateResponse } from '../geometry/planModelAdapter.js';
import { buildLocalVectorAnalysis, roomLabelsFromText } from './localVectorAnalysis.js';
import { localVectorReadiness } from './localVectorReadiness.js';
import { vectorProductionAnalysis } from './vectorProductionAnalysis.js';
import { refreshAnalysisReadiness as refreshVectorReview } from './analysisReadiness.js';
import { readPrintedOpeningLabels } from './printedLabels.js';
import { readElectricalPoints } from '../geometry/electricalSymbols.js';
import { applyConstructionInput } from '../constructionQuantities.js';
import { addTrainingExample, buildTrainingExample } from './trainingCapture.js';

const RUN_ID = 'ai-takeoff-v3-linework';
const LOCAL_VECTOR_RUN_ID = 'ai-takeoff-vector-v3';
// The default takeoff: measured on this computer from the drawing's own linework, no provider request.
const LOCAL_RUN_ID = 'ai-takeoff-v3-local';
export const LOCAL_PROVIDER = 'GR8 Result local measurement (no AI)';
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
const closeScale = (a, b) => a > 0 && b > 0 && Math.abs(a - b) / b < 0.000001;
const CONTEXT_TEXT_CHARS = 20000;
const MAX_CACHED_INSPECTIONS = 60;
// Evidence is read from every sheet, most informative first, a few sheets per request.
const EVIDENCE_ORDER = ['window_door_schedule', 'elevation', 'section', 'details', 'floor_plan', 'other', 'roof_plan', 'cover', 'site_plan'];
const MAX_EVIDENCE_SHEETS = 8;
const EVIDENCE_BATCH_BYTES = 7 * 1024 * 1024;
const imageBytes = (page) => Math.ceil(String(page?.imageDataUrl || '').length * 0.75);
// PDF linework with stroke width and colour: the local vector engine can measure the sheet itself.
const hasStyledVectors = (planPage) => Boolean(planPage?.vectorSegments?.some((segment) => segment.paint === 'stroke' && Number.isFinite(segment.widthPx) && typeof segment.color === 'string'));
// A plan reading that adds no semantics: the sheet's geometry comes entirely from its linework.
// Paid provider requests need the builder's explicit authorisation for this run (the screen asks first).
// The local measurement never reaches here; this is the second check after analysisClient's own.
const providerCall = (work, payload) => {
  if (work?.providerAuthorised !== true) {
    throw Object.assign(new Error('AI-assisted analysis was not authorised, so no request was sent to OpenAI and nothing was charged.'), { code: 'provider_not_authorised', hard: true });
  }
  return requestTakeoffAnalysis(payload, work.signal, { authorised: true });
};
const emptySheetReading = (page, level) => ({ page, level: level || 'Unassigned', walls: [], openings: [], buildingAreas: [], pillars: [], eaves: [], rooms: [], fixtures: [], documentedQuantities: [], review: [] });

function sanitizeCalibrations(saved) {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {};
  return Object.fromEntries(Object.entries(saved).filter(([page, entry]) => Number.isInteger(Number(page)) && Number(page) >= JOB_SCALE_KEY
    && Number.isFinite(Number(entry?.pixelsPerMm ?? entry)) && Number(entry?.pixelsPerMm ?? entry) > 0)
    .map(([page, entry]) => [page, { pixelsPerMm: Number(entry?.pixelsPerMm ?? entry), calibratedAt: String(entry?.calibratedAt || ''),
      ...(Number(entry?.appliedFromSheet) > 0 ? { appliedFromSheet: Number(entry.appliedFromSheet) } : {}) }]));
}

// Supporting-page text as reading-order lines (cells joined by " | ") rather than
// positioned JSON records: schedules keep their row structure at a fraction of the size.
function contextText(items = []) {
  const records = items.filter((item) => typeof item?.text === 'string' && item.text.trim());
  const positioned = records.every((item) => Number.isFinite(item.x) && Number.isFinite(item.y));
  const ordered = positioned ? [...records].sort((a, b) => a.y - b.y || a.x - b.x) : records;
  const lines = [];
  let line = null;
  for (const item of ordered) {
    const tolerance = Math.max(2, (Number(item.height) || 0) * 0.5);
    if (!line || !positioned || Math.abs(item.y - line.y) > tolerance) { line = { y: item.y, cells: [] }; lines.push(line); }
    line.cells.push(item.text.trim());
  }
  let text = '';
  for (const { cells } of lines) {
    const next = cells.join(' | ');
    if (text.length + next.length + 1 > CONTEXT_TEXT_CHARS) break;
    text += (text ? '\n' : '') + next;
  }
  return text;
}

// Saved page inspections, keyed by page fingerprint. Malformed entries are dropped.
function sanitizeInspections(saved) {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {};
  return Object.fromEntries(Object.entries(saved).filter(([key, entry]) => key.startsWith(`${RUN_ID}:page-sha256:`)
    && entry?.analysis && typeof entry.analysis === 'object' && Number.isInteger(entry.analysis.page)).slice(-MAX_CACHED_INSPECTIONS));
}

// Orchestration and review metadata only. Geometry admission belongs exclusively
// to the Phase 1 bridge, and saving belongs to the existing canvas save action.

// Electrical points read from each sheet's own text and linework (no plan reading involved). Sheets not
// read this time keep what an earlier run found.
function electricalForPages(planPages = [], pages = [], scaleOf, saved = {}) {
  const next = { ...(saved || {}) };
  for (const pageNumber of pages) {
    const planPage = planPages.find((page) => page.pageNumber === pageNumber);
    if (!planPage) continue;
    try {
      const read = readElectricalPoints({ textItems: planPage.textItems || [], segments: planPage.vectorSegments || [], pixelsPerMm: scaleOf(pageNumber) });
      if (read.points.length || read.legend.length) next[pageNumber] = { points: read.points, counts: read.counts, legend: read.legend, electricalSheet: read.electricalSheet, report: read.report, readAt: new Date().toISOString() };
      else delete next[pageNumber];
    } catch (error) {
      next[pageNumber] = { points: [], counts: {}, legend: [], error: `Electrical points could not be read on sheet ${pageNumber}: ${error.message}` };
    }
  }
  return next;
}

// What stops a re-measure: anything from the earlier run that the builder approved, edited or answered.
export function remeasureBlockers(current, report, receipt) {
  const ofRun = (item) => item?.source === 'ai' && item.ai?.runId === receipt.runId && item.ai?.documentHash === receipt.documentHash;
  const objects = [...(current.completedWallRuns || []), ...(current.placedOpenings || []), ...(current.completedFloorplans || [])].filter(ofRun);
  const approved = objects.filter((item) => item.confirmed === true || item.approvedAt || item.confirmedAt).length;
  const rooms = (report?.rooms || []).filter((room) => room.confirmed || room.boundaryLocked || room.nameEdited || room.boundaryEdited || room.levelEdited).length;
  const answers = Object.keys(report?.resolvedDecisions || {}).length;
  return [
    approved ? `${approved} measured item${approved === 1 ? ' is' : 's are'} approved` : '',
    rooms ? `${rooms} room${rooms === 1 ? ' has' : 's have'} been approved or edited` : '',
    answers ? `${answers} review question${answers === 1 ? ' has' : 's have'} been answered` : '',
  ].filter(Boolean);
}

export function useAiTakeoffAnalysis(options) {
  const latest = useRef(options);
  latest.current = options;
  const pending = useRef(null);
  const localVectorRunSequence = useRef(0);
  const controller = useRef(null);
  const [report, setReport] = useState(null);
  const [stage, setStage] = useState('idle');
  const [message, setMessage] = useState('');
  const [scaleProposal, setScaleProposal] = useState(null);
  // Page classification survives failed, review-only and repeated runs; it is saved
  // with the takeoff and only invalidated when a page image changes (new fingerprint).
  const inspectionsRef = useRef({});
  const [inspections, setInspections] = useState({});
  // Successful geometry/items halves for this session, so a retry or re-run only
  // repeats the half that failed. Keys include the document hash and calibration.
  const halves = useRef(new Map());
  // The calibration the estimator measured on each sheet. A sheet with its own record keeps it;
  // the others use the takeoff's calibration. Saved with the takeoff.
  const calibrationsRef = useRef({});
  const [sheetCalibrations, setSheetCalibrations] = useState({});
  // `applyTo`: other sheets the estimator chose to give the same scale (same printed scale). Every
  // sheet whose scale changes has its stored lengths restated and its approved areas withdrawn.
  const recordSheetCalibration = useCallback((page, pixelsPerMm, { applyTo = [] } = {}) => {
    if (!(Number(page) > 0) || !(Number(pixelsPerMm) > 0)) return;
    const previous = calibrationsRef.current;
    const base = jobPixelsPerMm(latest.current.pixelsPerMm, previous) || Number(pixelsPerMm);
    const next = calibrationsWithSheets(previous, page, pixelsPerMm, { applyTo, base });
    const before = p => scaleOfSheet(p, base, previous), after = p => scaleOfSheet(p, base, next);
    latest.current.bridge.updateObjects(collections => {
      const pages = [...new Set([...(latest.current.planPages || []).map(item => Number(item.pageNumber)),
        ...['completedFloorplans', 'completedAreas'].flatMap(key => (collections[key] || []).map(item => Number(item?.page || 1)))])];
      const changed = sheetsWithChangedScale(pages, before, after);
      return { ...collections,
        completedWallRuns: rescaleRunLengths(collections.completedWallRuns, before, after),
        completedEaves: rescaleRunLengths(collections.completedEaves, before, after),
        completedMeasurements: rescaleRunLengths(collections.completedMeasurements, before, after),
        completedFloorplans: withdrawApprovalsForScaleChange(collections.completedFloorplans, changed),
        completedAreas: withdrawApprovalsForScaleChange(collections.completedAreas, changed),
      };
    });
    calibrationsRef.current = next;
    setSheetCalibrations(calibrationsRef.current);
  }, []);
  const sheetScale = (page) => scaleOfSheet(page, latest.current.pixelsPerMm, calibrationsRef.current);

  const cancel = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    pending.current = null;
    setScaleProposal(null);
    setStage('idle');
    setRoomsState({ busy: false, error: false, message: '' });
    setMessage('Analysis cancelled. Existing takeoff objects were preserved.');
  }, []);

  const restoreReport = useCallback((saved = null, savedInspections = null, savedCalibrations = null) => {
    setRoomsState({ busy: false, error: false, message: '' });
    calibrationsRef.current = sanitizeCalibrations(savedCalibrations);
    setSheetCalibrations(calibrationsRef.current);
    controller.current?.abort();
    controller.current = null;
    pending.current = null;
    inspectionsRef.current = sanitizeInspections(savedInspections);
    setInspections(inspectionsRef.current);
    halves.current.clear();
    setScaleProposal(null);
    const restored = refreshVectorReview(saved || null);
    setReport(restored);
    setStage(restored && restored.status !== 'rooms' ? (restored.status === 'review' ? 'review' : 'complete') : 'idle');
    setMessage('');
  }, []);

  // ---- Rooms schedule ----------------------------------------------------------------------
  // Detect semantic room boundaries, refine against raster wall evidence, and preserve
  // confirmed corrections. Existing wall/opening objects provide additional geometry evidence.
  const [roomsState, setRoomsState] = useState({ busy: false, message: '', error: false });
  const reportRef = useRef(null);
  reportRef.current = report;
  useEffect(() => {
    if (report?.status === 'review' && stage === 'complete') {
      setStage('review');
      setMessage('AI TAKEOFF REQUIRES REVIEW — check unresolved walls, openings and room boundaries below.');
    }
  }, [report?.status, stage]);
  // Reading room names with the AI provider is paid: it runs only when the builder authorises it.
  const readRooms = async ({ authorised = false } = {}) => {
    if (pending.current || roomsState.busy) return;
    if (authorised !== true) { setRoomsState({ busy: false, error: true, message: 'Reading rooms with AI sends the floor plans to OpenAI and is charged to your OpenAI account. Authorise it first; nothing was sent.' }); return; }
    const current = latest.current;
    if (current.readOnly || !current.jobId || !current.takeoffId || !current.planPages.length) {
      setRoomsState({ busy: false, error: true, message: 'Open an editable job and upload its construction plan first.' }); return;
    }
    let sheets = floorPlanSheets(current.sheetLevels, current.planPages);
    const abort = new AbortController();
    controller.current = abort;
    const work = { jobId: current.jobId, takeoffId: current.takeoffId, planPages: current.planPages, generation: current.lifecycle.hydrationVersion, signal: abort.signal, providerAuthorised: true };
    pending.current = work;
    setRoomsState({ busy: true, error: false, message: 'Detecting room boundaries from the plans…' });
    try {
      const documentHash = await fingerprintTakeoffDocument(work.planPages);
      if (!sheets.length) {
        for (const planPage of work.planPages) {
          assertCurrent(work);
          setRoomsState({ busy: true, error: false, message: `Identifying floor plans and levels — sheet ${planPage.pageNumber}…` });
          const prepared = await prepareAnalysisPage(planPage);
          const inspected = await providerCall(work, { action: 'inspect', jobId: work.jobId, takeoffId: work.takeoffId, documentHash, runId: ROOMS_RUN_ID, page: prepared });
          assertCurrent(work);
          if (['floor_plan','floor-plan'].includes(inspected.analysis.drawingType)) sheets.push({ page: planPage.pageNumber, level: inspected.analysis.level || 'Unassigned' });
        }
        if (!sheets.length) throw new Error('No floor-plan sheets could be identified. Assign the floor-plan sheets to levels and try again.');
        latest.current.onDetectedLevels?.(sheets);
      }
      const readings = [];
      let model = '';
      for (const sheet of sheets) {
        assertCurrent(work);
        setRoomsState({ busy: true, error: false, message: `Detecting room boundaries — sheet ${sheet.page} (${sheet.level})…` });
        const prepared = await prepareAnalysisPage(work.planPages.find((page) => page.pageNumber === sheet.page));
        const result = await providerCall(work, { action: 'measure', measurementScope: ROOMS_SCOPE, jobId: work.jobId, takeoffId: work.takeoffId, documentHash, runId: ROOMS_RUN_ID,
          page: { ...prepared, drawingType: 'floor_plan', level: sheet.level }, pixelsPerMm: latest.current.pixelsPerMm > 0 ? latest.current.pixelsPerMm : 1 });
        assertCurrent(work);
        model = result.model || model;
        const raster = await readRoomRaster(prepared.imageDataUrl);
        assertCurrent(work);
        readings.push({ page: sheet.page, level: sheet.level, rooms: (result.analysis.rooms || []).map((room, index) => detectRoomBoundary(room, { page: sheet.page, level: sheet.level, width: prepared.logicalWidth, height: prepared.logicalHeight, pixelsPerMm: calibrationsRef.current[sheet.page]?.pixelsPerMm || latest.current.pixelsPerMm, walls: latest.current.completedWallRuns, openings: latest.current.placedOpenings, raster }, index)) });
      }
      const rooms = mergeRoomReadings(reportRef.current?.rooms, readings);
      const next = reportWithRooms(reportRef.current, rooms, { readAt: new Date().toISOString(), model, sheets: sheets.map((sheet) => sheet.page) });
      setReport(next);
      latest.current.markCompleted?.("room-boundaries-detected");
      pending.current = null;
      const found = readings.reduce((count, reading) => count + reading.rooms.length, 0);
      setRoomsState({ busy: false, error: !found, message: found ? `${found} room${found === 1 ? '' : 's'} read from ${sheets.length} floor-plan sheet${sheets.length === 1 ? '' : 's'}. Check the list and correct anything that is wrong.`
        : 'No room names could be read from the floor-plan sheets. Add the rooms by hand below.' });
      await nextFrame();
      await latest.current.onRoomsRead?.(next);
    } catch (error) {
      if (pending.current === work) pending.current = null;
      if (!work.signal.aborted) setRoomsState({ busy: false, error: true, message: error.message || 'The room names could not be read. Nothing was changed.' });
      else setRoomsState({ busy: false, error: false, message: '' });
    }
  };
  const addRoom = (name, level) => {
    const page = floorPlanSheets(latest.current.sheetLevels, latest.current.planPages).find((sheet) => sheet.level === level)?.page || latest.current.planPages[0]?.pageNumber || 1;
    setReport((current) => reportWithRooms(current, addManualRoom(current?.rooms, name, level, page)));
  };
  const removeRoom = (name) => setReport((current) => (current ? reportWithRooms(current, removeScheduleRoom(current.rooms, name)) : current));

  const updateRooms = useCallback((ids, incomingPatch) => {
    if (latest.current.readOnly) return;
    // A locked boundary keeps its corners: outline changes (or rejecting it) are refused until the
    // builder unlocks it. Locking needs a successful approval, so a room still in review stays unlocked.
    const patchFor = (room) => {
      if (!room.boundaryLocked || incomingPatch.boundaryLocked === false) return incomingPatch;
      const { polygon, excluded, ...rest } = incomingPatch;
      return rest;
    };
    const lockOnlyIfApproved = (room) => (room.boundaryLocked && !room.confirmed ? { ...room, boundaryLocked: false, lockedAt: null } : room);
    setReport(current => refreshVectorReview(reportWithRooms(current, (current?.rooms || []).map(room => { if (!ids.includes(room.id)) return room; const patch = patchFor(room);
      return lockOnlyIfApproved((patch.confirmed === true ? approveRoom : measureRoom)({ ...room, ...patch, ...(typeof patch.level === 'string' ? { levelEdited: true } : {}), ...(typeof patch.name === 'string' ? { nameEdited: true, label: room.label || room.name } : {}), ...(patch.polygon ? { boundaryEdited: true, confirmed: false, boundaryClosed: false } : {}) }, calibrationsRef.current[room.page]?.pixelsPerMm || latest.current.pixelsPerMm)); }))));
    latest.current.markCompleted?.('room-boundary-updated');
  }, []);

  // Rooms as the closed faces of the walls now on the sheets (detected, accepted or drawn by hand).
  const measureRoomsFromWalls = async () => {
    const current = latest.current;
    if (current.readOnly || pending.current) return;
    const runs = current.completedWallRuns || [];
    const pages = [...new Set(runs.map((run) => Number(run.page) || 1))].filter((page) => current.planPages.some((item) => item.pageNumber === page));
    if (!pages.length) { setRoomsState({ busy: false, error: true, message: 'There are no walls on the plan to measure rooms from.' }); return; }
    let merged = reportRef.current?.rooms || [];
    let count = 0;
    for (const page of pages) {
      const planPage = current.planPages.find((item) => item.pageNumber === page);
      const pixelsPerMm = sheetScale(page);
      if (!(pixelsPerMm > 0)) { setRoomsState({ busy: false, error: true, message: `Sheet ${page} has no calibration, so its rooms were not measured.` }); return; }
      const level = current.sheetLevels?.[page] || merged.find((room) => room.page === page)?.level || 'Unassigned';
      const sheetRuns = runs.filter((run) => (Number(run.page) || 1) === page);
      const spec = { id: `page-${page}`, name: level, page, pixelsPerMm, logicalWidth: planPage.logicalWidth, logicalHeight: planPage.logicalHeight };
      const existingRooms = merged.filter(room => room.page === page);
      const labels = existingRooms.length ? existingRooms.map(room => ({ name: room.label || room.name,
        x: room.x * planPage.logicalWidth, y: room.y * planPage.logicalHeight })) : roomLabelsFromText(planPage);
      const detected = roomsFromWallRuns(sheetRuns, spec, labels)
        .map((room, index) => detectRoomBoundary(room, { page, level, width: planPage.logicalWidth, height: planPage.logicalHeight, pixelsPerMm, walls: sheetRuns, openings: current.placedOpenings, measuredBoundary: true }, index));
      count += detected.length;
      // Re-measuring must not delete labelled rooms when the current walls do not close,
      // or add anonymous faces over existing rooms. Only replace an unambiguous label match.
      const readings = existingRooms.length ? existingRooms.map(old => {
        const matches = detected.filter(room => room.name === (old.label || old.name));
        return matches.length === 1 ? { ...matches[0], id: old.id, x: old.x, y: old.y } : old;
      }) : detected;
      merged = mergeRoomReadings(merged, [{ page, level, rooms: readings }]);
    }
    setReport((previous) => refreshVectorReview(reportWithRooms(previous || reportRef.current, merged)));
    current.markCompleted?.('room-boundaries-detected');
    setRoomsState({ busy: false, error: false, message: `${count} room${count === 1 ? '' : 's'} measured from the walls now on the plan. Confirm each boundary before relying on it.` });
  };

  // The estimator's answer for one review-only wall: Internal or External adds it (with the openings hosted
  // on it) to the takeoff; Reject removes it and remembers it so a re-run does not bring it back.
  const reviewBusy = useRef(false);
  const resolveReviewWall = async (candidateId, decision) => {
    const current = latest.current;
    const base = reportRef.current;
    if (current.readOnly || pending.current || reviewBusy.current || !base) return;
    const candidate = (base.wallReviewCandidates || []).find((item) => item.id === candidateId);
    if (!candidate || !['interior', 'exterior', 'reject'].includes(decision)) return;
    const hosted = (base.openingReviewCandidates || []).filter((item) => item.hostModelWallId === candidate.modelWallId);
    const hostedIds = new Set(hosted.map((item) => item.id));
    const settle = (extra, text) => {
      setReport((previous) => refreshVectorReview({ ...previous,
        wallReviewCandidates: (previous.wallReviewCandidates || []).filter((item) => item.id !== candidateId),
        openingReviewCandidates: (previous.openingReviewCandidates || []).filter((item) => !hostedIds.has(item.id)), ...extra(previous) }));
      latest.current.markCompleted?.('ai-takeoff-review');
      setMessage(text);
    };
    reviewBusy.current = true;
    try {
      if (decision === 'reject') {
        settle((previous) => ({ rejectedWallCandidates: [...(previous.rejectedWallCandidates || []), { id: candidate.id, page: candidate.page, nodes: candidate.nodes }] }),
          `Wall rejected${hosted.length ? ` with ${hosted.length} opening${hosted.length === 1 ? '' : 's'} on it` : ''}. It stays out of the takeoff.`);
        return;
      }
      const identity = await current.bridge.getContext();
      const level = latest.current.sheetLevels?.[candidate.page] || 'Unassigned';
      const context = { ...identity, completedFloorplans: latest.current.completedFloorplans || [], sheetLevels: latest.current.sheetLevels || {} };
      const runId = `${LOCAL_VECTOR_RUN_ID}-review-${Date.now()}-${++localVectorRunSequence.current}`;
      const { batch } = normalizePlanAnalysis({ context, runId, modelVersion: base.modelVersion || 'ai-takeoff-vector',
        responses: [{ page: candidate.page, level, drawingType: 'floor_plan', ...reviewCandidateResponse(candidate, hosted, decision) }] });
      if (!batch.detections.some((item) => item.kind === 'wall')) {
        settle(() => ({}), 'That wall is already in the takeoff, so it was removed from the review list.');
        return;
      }
      const result = await latest.current.bridge.appendDetections(batch);
      const openings = batch.detections.filter((item) => item.kind === 'opening').length;
      settle(() => ({}), `Wall added as ${decision === 'interior' ? 'internal' : 'external'}${openings ? ` with ${openings} opening${openings === 1 ? '' : 's'}` : ''} (${result.added} objects).`);
    } catch (error) {
      setMessage(error.message || 'The wall could not be added. Nothing was changed.');
    } finally { reviewBusy.current = false; }
  };
  useEffect(() => {
    setReport(current => {
      if (!current?.rooms?.some(room => room.polygon && room.pixelsPerMm !== scaleOfSheet(room.page, options.pixelsPerMm, sheetCalibrations))) return current;
      return reportWithRooms(current, current.rooms.map(room => room.polygon ? measureRoom(room, scaleOfSheet(room.page, options.pixelsPerMm, sheetCalibrations)) : room));
    });
  }, [options.pixelsPerMm, sheetCalibrations]);

  useEffect(() => () => controller.current?.abort(), []);

  const assertCurrent = (work, requireScale = false) => {
    const current = latest.current;
    if (pending.current !== work || work.signal.aborted || current.readOnly
      || current.jobId !== work.jobId || current.takeoffId !== work.takeoffId
      || current.planPages !== work.planPages || current.lifecycle.hydrationVersion !== work.generation
      || (requireScale && !closeScale(current.pixelsPerMm, work.pixelsPerMm))) {
      throw new Error('The job, plan or calibration changed. Run AI Takeoff again for the current plan.');
    }
    return current;
  };

  const fail = (error, work) => {
    if (work.signal.aborted || pending.current !== work) return;
    pending.current = null;
    if (work.assisted && error?.code !== 'provider_not_authorised') {
      const notice = `AI-assisted analysis stopped: ${error.message || 'the provider request failed.'}`;
      // A provider that cannot answer (no credit, bad key, timeout) never costs the builder the measurement:
      // the plan is measured locally instead, or the takeoff already measured stays exactly as it was.
      const measuredLocally = latest.current.bridge.appliedRuns.some((receipt) => receipt.documentHash === work.documentHash
        && receipt.takeoffId === work.takeoffId && receipt.runId === LOCAL_RUN_ID);
      if (!measuredLocally && work.documentHash) { void run({ notice: `${notice} Measuring the plan locally instead (no AI, no charge).` }); return; }
      setStage(reportRef.current ? (reportRef.current.status === 'review' ? 'review' : 'complete') : 'error');
      setMessage(`${notice} ${reportRef.current ? 'The measured takeoff already in this job is unchanged.' : ''}`.trim());
      return;
    }
    setStage('error');
    setMessage(error.message || 'AI Takeoff could not complete.');
  };

  const requestHalf = async (work, key, payload) => {
    const cached = halves.current.get(key);
    if (cached) { work.onProviderSettled?.(); return cached; }
    // No credit, bad key or no model access: nothing further is sent once any request has hit one.
    if (work.hardFailure) throw work.hardFailure;
    let result;
    try {
      result = await providerCall(work, payload);
    } catch (error) {
      if (error.hard) work.hardFailure = error;
      else work.onProviderSettled?.();
      throw error;
    }
    work.onProviderSettled?.();
    assertCurrent(work, true);
    work.requests.push({ action: payload.action, scope: payload.measurementScope, page: payload.page.pageNumber, requestId: result.requestId, model: result.model });
    halves.current.set(key, result);
    return result;
  };

  const rememberInspection = (key, result) => {
    const next = { ...inspectionsRef.current };
    delete next[key];
    next[key] = { analysis: structuredClone(result.analysis), model: result.model, requestId: result.requestId, inspectedAt: new Date().toISOString() };
    inspectionsRef.current = sanitizeInspections(next);
    setInspections(inspectionsRef.current);
  };

  // One pass over the whole plan set before any sheet is measured: elevations, sections,
  // schedules, legends and notes are read together, so a floor plan is never judged alone.
  const collectEvidence = async (work) => {
    const sheets = work.inspections.slice().sort((a, b) => EVIDENCE_ORDER.indexOf(a.drawingType) - EVIDENCE_ORDER.indexOf(b.drawingType) || a.page - b.page).slice(0, MAX_EVIDENCE_SHEETS);
    const prepared = [];
    for (const inspection of sheets) {
      const rotation = evidenceRotation(inspection, work.inspections, work.planPages);
      const page = rotation ? await prepareAnalysisPage(work.planPages.find((item) => item.pageNumber === inspection.page), rotation) : work.prepared.get(inspection.page);
      if (page) prepared.push({ ...page, textItems: contextText(page.textItems), drawingType: inspection.drawingType, level: inspection.level });
    }
    const batches = [];
    for (const page of prepared) {
      const last = batches[batches.length - 1];
      if (last && last.length < 4 && last.reduce((sum, item) => sum + imageBytes(item), 0) + imageBytes(page) <= EVIDENCE_BATCH_BYTES) last.push(page);
      else batches.push([page]);
    }
    const responses = [];
    for (const [index, batch] of batches.entries()) {
      assertCurrent(work, true);
      setMessage(`Reading elevations, sections, schedules and notes — ${index + 1} of ${batches.length}…`);
      const [primary, ...contextPages] = batch;
      try {
        const result = await requestHalf(work, [work.documentHash, 'evidence', batch.map((page) => page.pageNumber).join(',')].join('|'),
          { action: 'evidence', ...work.identity, page: primary, contextPages });
        responses.push(result.analysis);
      } catch (error) {
        if (error.hard) throw error;
        assertCurrent(work, true);
        work.warnings.push({ page: primary.pageNumber, message: `Plan-set evidence could not be read from sheet${batch.length > 1 ? 's' : ''} ${batch.map((page) => page.pageNumber).join(', ')}: ${error.message}`, code: 'evidence-failed' });
      }
    }
    return mergePlanEvidence(responses);
  };

  const measure = async (work) => {
    try {
      const current = assertCurrent(work);
      const context = await current.bridge.getContext();
      if (context.documentHash !== work.documentHash) throw new Error('The plan document changed. Run AI Takeoff again.');
      work.pixelsPerMm = context.pixelsPerMm;
      const projectDefaults = projectDefaultsFromJobSetup(latest.current.jobSetupRows || {});
      setStage('measuring');
      const planEvidence = work.assisted ? await collectEvidence(work) : mergePlanEvidence([]);
      const sharedEvidence = compactPlanEvidence(planEvidence, projectDefaults);
      // Each measured sheet's readings are independent of the others, so the sheets are read at the
      // same time: one plan reading takes minutes (about 4 for a single A3 floor plan on gpt-5.4), and
      // reading a two-storey plan sheet after sheet multiplied that wait for the builder.
      const measureSheet = async (inspection) => {
        assertCurrent(work, true);
        const page = work.planPages.find((item) => item.pageNumber === inspection.page);
        // Local measurement: the sheet goes straight to its own linework, with no plan reading at all.
        if (!work.assisted) return { ...emptySheetReading(inspection.page, inspection.level), drawingType: inspection.drawingType };
        const rotation = inspection.rotationToUpright || 0;
        const prepared = rotation ? await prepareAnalysisPage(page, rotation) : work.prepared.get(inspection.page);
        // Supporting sheets travel only with the items half, as line-grouped text
        // instead of positioned records; the primary page keeps its full positioned text.
        const contextPages = work.inspections.filter((item) => item.page !== inspection.page && !item.relevant && /schedule|elevation|section|roof|floor/i.test(item.drawingType)).slice(0, 3)
          .map((item) => {
            const { textItems, ...supporting } = work.prepared.get(item.page);
            return { ...supporting, textItems: contextText(textItems), drawingType: item.drawingType, level: item.level };
          });
        const primary = { ...prepared, drawingType: inspection.drawingType, level: inspection.level };
        const scoped = (action, measurementScope, extra = {}) => ({
          action, measurementScope, ...work.identity, page: primary, pixelsPerMm: context.pixelsPerMm,
          ...(measurementScope === 'items' ? { contextPages } : {}), planEvidence: sharedEvidence, ...extra,
        });
        const halfKey = (action, scope, previous = '') => [work.documentHash, inspection.page, rotation, context.pixelsPerMm, action, scope, previous].join('|');
        // A calibrated vector floor plan is measured from its own linework whatever the reading returns.
        const measurableLinework = inspection.drawingType === 'floor_plan' && hasStyledVectors(page) && sheetScale(inspection.page) > 0;
        try {
          // Geometry then items, one at a time: a failure stops before the next paid
          // request and the shared request prefix can be served from the provider cache.
          const measured = {};
          const failedScopes = [];
          for (const scope of MEASUREMENT_SCOPES) {
            try {
              measured[scope] = await requestHalf(work, halfKey('measure', scope), scoped('measure', scope));
            } catch (error) {
              // A sheet that cannot be measured without the reading stops here, as before. A linework
              // sheet keeps whichever half succeeded; one failed half is reported, not fatal.
              if (error.hard || !measurableLinework) throw error;
              assertCurrent(work, true);
              failedScopes.push({ scope, error });
              if (failedScopes.length === MEASUREMENT_SCOPES.length) throw error;
              measured[scope] = { analysis: emptySheetReading(inspection.page, inspection.level), model: null, failed: true };
            }
          }
          for (const { scope, error } of failedScopes) {
            work.warnings.push({ page: inspection.page, code: 'sheet-reading-failed', audience: 'decision',
              message: `The AI ${scope === 'geometry' ? 'wall and area' : 'door, window and room'} reading of sheet ${inspection.page} failed: ${error.message} ${scope === 'geometry' ? 'Walls and areas were classified from the linework alone; check internal/external walls and the floor areas.' : 'Openings and rooms were measured from the linework without it; check opening types and room names.'}` });
          }
          const firstPass = mergeMeasurementScopes(measured.geometry.analysis, measured.items.analysis);
          work.model = measured.items.model || measured.geometry.model || work.model;
          const refined = { geometry: measured.geometry.analysis, items: measured.items.analysis };
          let geometryPreviewDataUrl = null;
          // The geometry check corrects the reading's own approximate coordinates against the drawing.
          // On a linework sheet those coordinates only pair labels with measured objects (every wall,
          // opening and room is measured from the linework), so the two further multi-minute requests
          // are not made there.
          const refineScopes = measurableLinework ? [] : MEASUREMENT_SCOPES;
          if (refineScopes.length) setMessage(`Checking geometry against the drawing — sheet ${inspection.page}…`);
          for (const scope of refineScopes) {
            if (measured[scope].failed) continue;
            try {
              geometryPreviewDataUrl ??= await prepareGeometryReviewImage(prepared, firstPass);
              const checked = await requestHalf(work, halfKey('refine', scope, JSON.stringify(firstPass)), scoped('refine', scope, { previousAnalysis: firstPass, geometryPreviewDataUrl }));
              refined[scope] = checked.analysis;
              work.model = checked.model;
            } catch (error) {
              if (error.hard) throw error;
              assertCurrent(work, true);
              work.warnings.push({ page: inspection.page, message: `Geometry check failed${scope === 'items' ? ' for openings and rooms' : ''}: ${error.message} Valid first-pass detections are retained for review.`, code: 'refinement-failed' });
            }
          }
          return { ...restoreAnalysisCoordinates(mergeMeasurementScopes(refined.geometry, refined.items), rotation), drawingType: inspection.drawingType };
        } catch (error) {
          // No credit, bad key or no model access: every further sheet would fail the same way.
          if (error.hard) throw error;
          assertCurrent(work, true);
          // Walls, openings and rooms on a calibrated vector sheet are measured from its own PDF
          // linework; the plan reading only adds semantics (opening types, room names). A failed
          // reading must not discard a sheet that can still be measured: it goes on with no
          // semantics and says exactly what failed, so the builder checks those items.
          if (measurableLinework) {
            work.warnings.push({ page: inspection.page, code: 'sheet-reading-failed', audience: 'decision',
              message: `The AI plan reading of sheet ${inspection.page} failed: ${error.message} Walls, openings and rooms on this sheet were measured from the drawing's own linework without it; check opening types and room names before relying on them.` });
            return { ...emptySheetReading(inspection.page, inspection.level), drawingType: inspection.drawingType, readingFailed: true };
          }
          work.warnings.push({ page: inspection.page, message: `Sheet analysis failed: ${error.message}`, code: 'sheet-failed' });
          return null;
        }
      };
      const measuredSheets = work.inspections.filter((item) => item.relevant || item.drawingType === 'roof_plan');
      assertCurrent(work, true);
      setStage('measuring');
      setMessage(work.assisted ? `AI-assisted analysis — reading sheet${measuredSheets.length === 1 ? '' : 's'} ${measuredSheets.map((item) => item.page).join(', ')} of ${work.planPages.length} with OpenAI. Each sheet takes a few minutes…`
        : `Measuring sheet${measuredSheets.length === 1 ? '' : 's'} ${measuredSheets.map((item) => item.page).join(', ')} locally from the drawing (no AI)…`);
      // Two sheets at a time (the analysis route serves two requests per builder at once). The first
      // sheet's first request goes alone: if the account has no credit, a bad key or no model access,
      // that one request finds out and no other sheet sends anything. The second lane starts once it has
      // been answered (or has failed for an ordinary reason such as a timeout).
      let releaseOthers;
      const providerAnswered = new Promise((resolve) => { releaseOthers = resolve; });
      work.onProviderSettled = () => releaseOthers();
      const sheetResults = [];
      let nextSheet = 1;
      const lane = async (first) => {
        if (first !== undefined) sheetResults[first] = await measureSheet(measuredSheets[first]).finally(() => releaseOthers());
        while (nextSheet < measuredSheets.length) { const index = nextSheet++; sheetResults[index] = await measureSheet(measuredSheets[index]); }
      };
      if (measuredSheets.length) await Promise.all([lane(0), providerAnswered.then(() => lane())]);
      work.onProviderSettled = null;
      const responses = sheetResults.filter(Boolean);
      assertCurrent(work, true);
      // Every measured sheet failing is a request failure, not "no reliable geometry".
      // Surface the actual errors instead of a review-only result that hides them.
      const sheetFailures = work.warnings.filter((item) => item.code === 'sheet-failed');
      if (!responses.length && sheetFailures.length) {
        throw new Error(`AI Takeoff could not measure the plan. ${sheetFailures.map((item) => item.message).join(' ')}`);
      }
      // Wall positions, lengths and thicknesses are measured from each floor plan's own linework;
      // the plan reading classifies those walls and locates the openings. A sheet whose linework
      // cannot be measured keeps the plan reading's positions and says so.
      const linework = {};
      const vectorReadings = [];
      const measuredRoomPages = new Set();
      for (const [index, response] of responses.entries()) {
        if (response.drawingType !== 'floor_plan') continue;
        const pageNumber = response.page || response.pageNumber;
        const planPage = work.planPages.find((page) => page.pageNumber === pageNumber);
        try {
          setMessage(`Measuring wall linework — sheet ${pageNumber}…`);
          const raster = await readPlanRaster(planPage?.dataUrl, undefined, { logicalWidth: planPage?.logicalWidth, pixelsPerMm: sheetScale(pageNumber) });
          assertCurrent(work, true);
          const sheetPixelsPerMm = sheetScale(pageNumber);
          const sheet = { pageNumber, logicalWidth: planPage.logicalWidth, logicalHeight: planPage.logicalHeight, pixelsPerMm: sheetPixelsPerMm };
          // Doors and windows read region by region (off unless the takeoff asks for it): each
          // region is enlarged, read on its own and mapped back to the sheet. A sheet whose regions
          // could not all be read keeps the whole-sheet reading as well, and says so.
          if (latest.current.regionOpenings === true && work.assisted) {
            const walls = detectPlanGeometry(raster, sheet, { proposeRooms: false }).walls.flatMap((wall) => wall.nodes);
            if (walls.length) {
              const bounds = { x: Math.min(...walls.map((p) => p.x)), y: Math.min(...walls.map((p) => p.y)), x2: Math.max(...walls.map((p) => p.x)), y2: Math.max(...walls.map((p) => p.y)) };
              const regions = planRegions(bounds, sheet);
              setMessage(`Reading doors and windows by region — sheet ${pageNumber} (${regions.length} regions)…`);
              const prepared = work.prepared.get(pageNumber);
              const read = await collectRegionOpenings({ regions, sheet, crop: (region) => cropPlanRegion(planPage.dataUrl, sheet, region),
                request: (payload) => requestHalf(work, [work.documentHash, pageNumber, context.pixelsPerMm, 'openings-region', payload.region.x, payload.region.y].join('|'), payload),
                base: { ...work.identity, pixelsPerMm: sheetScale(pageNumber), planEvidence: sharedEvidence, page: { pageNumber, logicalWidth: sheet.logicalWidth, logicalHeight: sheet.logicalHeight, pdfUnits: prepared?.pdfUnits === true, drawingType: 'floor_plan', level: response.level } } });
              assertCurrent(work, true);
              for (const failure of read.failures) work.warnings.push({ page: pageNumber, code: 'region-failed', message: `Doors and windows in part of sheet ${pageNumber} (${failure.region}) could not be read: ${failure.message}` });
              response.openings = read.failures.length ? [...read.openings, ...(response.openings || [])] : read.openings;
              response.regionOpenings = read.report;
            }
          }
          const styledVectors = hasStyledVectors(planPage);
          if (styledVectors) {
            const detected = detectVectorWalls(planPage.vectorSegments, { ...sheet, raster, textItems: planPage.textItems || [] });
            // Printed size labels, read locally from the sheet image; off when the takeoff says so.
            let printedLabels = { report: null, warning: null };
            if (latest.current.printedLabels !== false) {
              setMessage(`Reading printed door and window labels on sheet ${pageNumber}…`);
              printedLabels = await readPrintedOpeningLabels({ detected, raster, logicalWidth: sheet.logicalWidth, pixelsPerMm: sheetPixelsPerMm, textItems: planPage.textItems || [] });
              assertCurrent(work, true);
              if (printedLabels.warning) work.warnings.push({ page: pageNumber, code: 'printed-labels', message: printedLabels.warning });
            }
            const measured = vectorProductionAnalysis(response, detected, {
              id: `page-${pageNumber}`, name: response.level, page: pageNumber, pixelsPerMm: sheetPixelsPerMm,
              logicalWidth: sheet.logicalWidth, logicalHeight: sheet.logicalHeight,
            }, { labels: roomLabelsFromText({ ...planPage, ocrRoomLabels: printedLabels.roomLabels || [] }), outdoor: { segments: planPage.vectorSegments || [], textItems: planPage.textItems || [], notes: printedLabels.sheetNotes || [] } });
            responses[index] = { ...measured.response, drawingType: response.drawingType };
            measuredRoomPages.add(pageNumber);
            vectorReadings.push({ page: pageNumber, vector: measured.vector, detected: measured.detected,
              reviewIdentity: `${work.documentHash}:${pageNumber}:${sheetPixelsPerMm}`,
              semanticInput: { page: pageNumber, level: response.level, walls: response.walls || [], openings: response.openings || [], rooms: response.rooms || [], review: [] } });
            linework[pageNumber] = { ...measured.vector.report, engine: detected.engine, detector: detected.stats,
              ...(printedLabels.report ? { printedLabels: { ...printedLabels.report, weak: printedLabels.report.weak.length, unassigned: printedLabels.report.unassigned.length } } : {}) };
            continue;
          }
          const fused = fuseSheetLinework(response, raster, sheet,
            {
              placedOpenings: (latest.current.placedOpenings || []).filter((item) => Number(item.page || item.pageId || 1) === pageNumber),
              completedFloorplans: (latest.current.completedFloorplans || []).filter((item) => Number(item.page) === pageNumber),
              // A vector PDF sheet carries its own drawn lines: wall faces are fitted to them.
              vectorLinework: planPage?.vectorSegments || [],
            });
          responses[index] = { ...fused.response, drawingType: response.drawingType };
          if (fused.geometry.engine !== 'not-run') measuredRoomPages.add(pageNumber);
          linework[pageNumber] = { ...fused.report, gaps: { ...fused.report.gaps, unconfirmed: fused.geometry.openings.filter((gap) => !gap.confirmed) }, proposedRooms: fused.geometry.rooms.filter((room) => !room.verified) };
        } catch (error) {
          assertCurrent(work, true);
          work.warnings.push({ page: pageNumber, code: 'linework-failed', message: `Wall linework could not be measured on sheet ${pageNumber}: ${error.message} Wall positions on this sheet are the plan reading's own and need checking.` });
        }
      }
      setStage('building');
      setMessage('Building Takeoff Schedule…');
      const { batch, analysis } = normalizePlanAnalysis({
        context: { ...context, completedFloorplans: latest.current.completedFloorplans || [], sheetLevels: latest.current.sheetLevels || {} },
        responses, runId: work.runId, modelVersion: work.model, planEvidence, projectDefaults,
      });
      const scaleReview = [...(work.scale?.review || []), ...(work.scale?.notes || [])].map((item) => ({ message: typeof item === 'string' ? item : item.message, code: 'scale-review' }));
      // Only findings a person has to settle are decisions; the rest is kept as diagnostics.
      analysis.review = [...analysis.review, ...scaleReview, ...work.warnings,
        ...planEvidence.review.map((message) => ({ message, code: 'plan-evidence' })),
        ...work.inspections.flatMap((item) => (item.review || []).map((message) => ({ page: item.page, message, code: 'inspection' })))]
        .map((item) => ({ ...item, audience: reviewAudience(item) }));
      analysis.counts.review = analysis.review.length;
      analysis.counts.decisions = analysis.review.filter((item) => item.audience === 'decision').length;
      analysis.planEvidence = { ...planEvidence, openingSchedule: planEvidence.openingSchedule.slice(0, 150) };
      analysis.projectDefaults = projectDefaults;
      // Nothing new to add because the estimator already measured it is a finished run, not a failed one.
      const result = batch.detections.length ? await latest.current.bridge.appendDetections(batch, { signal: work.signal })
        : { status: analysis.alreadyMeasured.length ? 'unchanged' : 'review', added: 0 };
      assertCurrent(work, true);
      let completed = {
        ...analysis, runId: work.runId, documentHash: work.documentHash, provider: work.assisted ? 'OpenAI' : LOCAL_PROVIDER, modelVersion: work.model,
        aiAssisted: work.assisted ? { model: work.model, requests: work.requests.length } : null,
        inspections: work.inspections, scale: work.scale, requests: work.requests,
        completedAt: new Date().toISOString(), added: result.added, status: result.status,
      };
      completed.linework = { ...(completed.linework || {}), ...linework };
      completed.rooms = reportRef.current?.rooms || completed.rooms;
      // Builder decisions (wall checks, acknowledged items) on this same plan survive a rerun.
      if (reportRef.current?.documentHash === work.documentHash && reportRef.current?.resolvedDecisions) completed.resolvedDecisions = reportRef.current.resolvedDecisions;
      for (const response of responses) {
        const pageNumber = response.page || response.pageNumber;
        const planPage = work.planPages.find(page => page.pageNumber === pageNumber);
        if (!planPage || !response.rooms?.length) continue;
        const raster = await readRoomRaster(planPage.dataUrl);
        assertCurrent(work, true);
        const detected = response.rooms.map((room, index) => detectRoomBoundary(room, { page: pageNumber, level: response.level, width: planPage.logicalWidth, height: planPage.logicalHeight, pixelsPerMm: calibrationsRef.current[pageNumber]?.pixelsPerMm || work.pixelsPerMm, walls: latest.current.completedWallRuns, openings: latest.current.placedOpenings, raster, measuredBoundary: measuredRoomPages.has(pageNumber) }, index));
        completed.rooms = mergeRoomReadings(completed.rooms, [{ page: pageNumber, level: response.level, rooms: detected }]);
      }
      if (vectorReadings.length) {
        completed.linework = { ...completed.linework, ...Object.fromEntries(vectorReadings.map((reading) => [reading.page, {
          ...reading.vector.report, engine: reading.detected.engine, detector: reading.detected.stats,
          openings: reading.detected.openings.length, rooms: reading.vector.rooms.length,
          ...(completed.linework?.[reading.page]?.printedLabels ? { printedLabels: completed.linework[reading.page].printedLabels } : {}),
        }])) };
        completed.vectorPlanEvidence = Object.fromEntries(vectorReadings.map(reading => [reading.reviewIdentity, reading.semanticInput]));
        completed.wallReviewCandidates = vectorReadings.flatMap(reading => reading.vector.reviewWallCandidates);
        completed.openingReviewCandidates = vectorReadings.flatMap(reading => reading.vector.reviewOpeningCandidates);
        completed.wallLineage = vectorReadings.flatMap(reading => reading.vector.wallLineage.map(item => ({ ...item, page: reading.page })));
        completed.externalAreas = vectorReadings.flatMap(reading => (reading.vector.externalAreas || []).map(item => ({ ...item, page: reading.page, level: reading.semanticInput?.level })));
        completed.retainingWalls = vectorReadings.flatMap(reading => (reading.vector.retainingWalls || []).map(item => ({ ...item, page: reading.page, level: reading.semanticInput?.level })));
        const issues = vectorReadings.flatMap(reading => localVectorReadiness({ analysis: {}, vector: reading.vector, detected: reading.detected,
          rooms: completed.rooms.filter(room => room.page === reading.page), admission: {} }).issues.map(issue => ({ ...issue, page: reading.page })));
        completed.review = [...completed.review, ...issues];
        if (issues.length || completed.unresolved?.length) { completed.status = 'review'; completed.completedAt = null; }
      }
      completed.counts = { ...completed.counts, review: completed.review.length, rooms: completed.rooms.length, roomBoundaries: completed.rooms.filter(room => room.polygon?.length >= 3).length, roomsForReview: completed.rooms.filter(room => room.reviewRequired).length };
      completed = refreshVectorReview(completed);
      completed.electricalPoints = electricalForPages(work.planPages, responses.map((response) => response.page || response.pageNumber), sheetScale, reportRef.current?.electricalPoints);
      latest.current.onDetectedLevels?.(analysis.pages);
      setReport(completed);
      latest.current.markCompleted('ai-takeoff-analysis');
      setStage(completed.status === 'review' ? 'review' : 'complete');
      const paidRequests = work.requests.filter((item) => !item.cached).length;
      const how = work.assisted ? `AI-assisted: OpenAI ${work.model || ''}, ${paidRequests} paid request${paidRequests === 1 ? '' : 's'}`
        : 'measured locally from the drawing — no AI requests, no charges';
      setMessage(`${work.notice ? `${work.notice} ` : ''}${completed.status === 'review' ? `TAKEOFF REQUIRES REVIEW (${how}) — check unresolved walls, openings and room boundaries below.`
        : result.status === 'duplicate' ? 'This analysis run is already in the takeoff.'
          : result.status === 'unchanged' ? `TAKEOFF COMPLETE (${how}) — everything found on the plans is already in this takeoff.` : `TAKEOFF COMPLETE (${how})`}`);
      setScaleProposal(null);
      // React must commit geometry, receipts and evidence before the existing
      // save action builds its payload. Never save the previous render's arrays.
      await nextFrame();
      assertCurrent(work, true);
      await latest.current.onCompleted?.(completed);
      pending.current = null;
    } catch (error) { fail(error, work); }
  };

  const runVectorTakeoff = async (pageNumber, wallDecision = null) => {
    if (pending.current) return;
    const runId = `${LOCAL_VECTOR_RUN_ID}-${Date.now()}-${++localVectorRunSequence.current}`;
    const current = latest.current;
    if (current.readOnly || !current.jobId || !current.takeoffId) {
      setStage('error'); setMessage('Open an editable takeoff job before running the local vector engine.'); return;
    }
    const planPage = current.planPages.find((page) => page.pageNumber === Number(pageNumber));
    if (!planPage?.vectorSegments?.length) {
      setStage('error'); setMessage('This sheet has no saved PDF vector linework. Re-import the PDF into this disposable takeoff.'); return;
    }
    if (!planPage.vectorSegments.some((segment) => segment.paint === 'stroke' && Number.isFinite(segment.widthPx) && typeof segment.color === 'string')) {
      setStage('error'); setMessage('This saved sheet predates vector style evidence. Re-import the PDF to run the local vector engine.'); return;
    }
    if (!(sheetScale(planPage.pageNumber) > 0)) {
      setStage('error'); setMessage('Calibrate this sheet with the existing Takeoff calibration tool before measuring it.'); return;
    }
    const abort = new AbortController();
    controller.current = abort;
    const work = { jobId: current.jobId, takeoffId: current.takeoffId, planPages: current.planPages,
      generation: current.lifecycle.hydrationVersion, signal: abort.signal, pixelsPerMm: null };
    pending.current = work;
    setStage('measuring'); setMessage(`Running GR8 Result local vector takeoff on sheet ${planPage.pageNumber}…`);
    try {
      const identity = await current.bridge.getContext();
      work.pixelsPerMm = identity.pixelsPerMm;
      assertCurrent(work);
      const pixelsPerMm = scaleOfSheet(planPage.pageNumber, identity.pixelsPerMm, identity.sheetCalibrations);
      if (!(pixelsPerMm > 0)) throw new Error('This sheet has no confirmed calibration. Nothing was measured.');
      const raster = await readPlanRaster(planPage.dataUrl, undefined, { logicalWidth: planPage.logicalWidth, pixelsPerMm });
      assertCurrent(work, true);
      const detected = detectVectorWalls(planPage.vectorSegments, {
        pixelsPerMm, logicalWidth: planPage.logicalWidth, logicalHeight: planPage.logicalHeight, raster,
        textItems: planPage.textItems || [],
      });
      // Printed size labels, read locally from the sheet image; off when the takeoff says so.
      let printedLabels = { report: null, warning: null };
      if (latest.current.printedLabels !== false) {
        setMessage(`Reading printed door and window labels on sheet ${planPage.pageNumber}…`);
        printedLabels = await readPrintedOpeningLabels({ detected, raster, logicalWidth: planPage.logicalWidth, pixelsPerMm, textItems: planPage.textItems || [] });
        assertCurrent(work, true);
      }
      const level = current.sheetLevels?.[planPage.pageNumber] || 'Unassigned';
      const context = {
        ...identity,
        completedWallRuns: current.completedWallRuns || [],
        placedOpenings: current.placedOpenings || [],
        completedFloorplans: current.completedFloorplans || [],
        sheetLevels: current.sheetLevels || {},
      };
      const savedReport = reportRef.current;
      const saved = savedReport?.documentHash === identity.documentHash ? savedReport : null;
      const reviewIdentity = `${identity.documentHash}:${planPage.pageNumber}:${pixelsPerMm}`;
      const wallReviewDecisions = { ...(saved?.wallReviewDecisions || {}) };
      const wallDecisions = { ...(wallReviewDecisions[reviewIdentity] || {}) };
      if (wallDecision) {
        const candidate = (saved?.wallReviewCandidates || []).find(item => item.id === wallDecision.id && item.page === planPage.pageNumber);
        if (!candidate?.detectionKey || !['interior', 'exterior', 'reject', ...(candidate.element === 'retaining' ? ['retaining'] : [])].includes(wallDecision.value)) throw new Error('Select a current measured wall and choose Internal, External, or Not a wall.');
        // A report from another PDF must never authorize this PDF's geometry.
        if (saved.documentHash !== identity.documentHash) throw new Error('The plan changed. Run takeoff again before reviewing this wall.');
        wallDecisions[candidate.detectionKey] = wallDecision.value;
      }
      wallReviewDecisions[reviewIdentity] = wallDecisions;
      // Opt-in only: the builder's decision kept in this job's own report as a training example.
      let trainingExamples = saved?.trainingExamples || [];
      if (wallDecision && latest.current.trainingCapture === true) {
        const candidate = saved.wallReviewCandidates.find(item => item.id === wallDecision.id && item.page === planPage.pageNumber);
        trainingExamples = addTrainingExample(trainingExamples, buildTrainingExample({
          identity: { jobId: current.jobId, takeoffId: current.takeoffId, documentHash: identity.documentHash }, page: planPage.pageNumber, pixelsPerMm,
          detected, detectionKey: candidate.detectionKey, decision: wallDecision.value, segments: planPage.vectorSegments || [] }));
      }
      const { vector, batch, analysis, rooms: readings, detected: admittedGeometry } = buildLocalVectorAnalysis({ planPage: { ...planPage, ocrRoomLabels: printedLabels.roomLabels || [], ocrSheetNotes: printedLabels.sheetNotes || [] }, detected, pixelsPerMm, level, context, runId, wallDecisions, semanticInput: saved?.vectorPlanEvidence?.[reviewIdentity] || null, admitReviewedWallKeys: wallDecision && wallDecision.value !== 'reject'
        ? [saved.wallReviewCandidates.find(item => item.id === wallDecision.id && item.page === planPage.pageNumber).detectionKey] : [] });
      const admission = batch.detections.length
        ? await current.bridge.appendDetections(batch, { signal: work.signal })
        : { status: 'review', added: 0 };
      assertCurrent(work, true);
      const rooms = mergeRoomReadings(reportRef.current?.rooms, [{ page: planPage.pageNumber, level, rooms: readings }]);
      const readiness = localVectorReadiness({ analysis, vector, detected: admittedGeometry, rooms, admission });
      const completed = {
        ...analysis, review: [...analysis.review, ...readiness.issues, ...(printedLabels.warning ? [{ page: planPage.pageNumber, code: 'printed-labels', message: printedLabels.warning }] : [])],
        provider: 'GR8 Result local vector engine', modelVersion: detected.engine, runId,
        ...(trainingExamples.length ? { trainingExamples } : {}),
        ...(saved?.resolvedDecisions ? { resolvedDecisions: saved.resolvedDecisions } : {}),
        printedLabels: { ...(saved?.printedLabels || {}), [planPage.pageNumber]: printedLabels.report ? { ...printedLabels.report, weak: printedLabels.report.weak.length, unassigned: printedLabels.report.unassigned.length } : null },
        localVectorPage: planPage.pageNumber, wallReviewAction: Boolean(wallDecision),
        wallReviewDecisions, vectorPlanEvidence: saved?.vectorPlanEvidence || {},
        wallReviewCandidates: [...(saved?.wallReviewCandidates || []).filter(item => item.page !== planPage.pageNumber), ...vector.reviewWallCandidates],
        openingReviewCandidates: [...(saved?.openingReviewCandidates || []).filter(item => item.page !== planPage.pageNumber), ...vector.reviewOpeningCandidates],
        wallLineage: vector.wallLineage,
        documentHash: identity.documentHash, requests: [],
        inspections: [{ page: planPage.pageNumber, level, drawingType: 'floor_plan', localOnly: true }],
        linework: { ...(saved?.linework || {}), [planPage.pageNumber]: { ...vector.report, detector: detected.stats, openings: detected.openings.length, rooms: vector.rooms.length } },
        // Outdoor recesses in the building outline: shown in the schedule, never floor area.
        externalAreas: [...(saved?.externalAreas || []).filter((item) => item.page !== planPage.pageNumber), ...(vector.externalAreas || []).map((item) => ({ ...item, page: planPage.pageNumber, level }))],
        retainingWalls: [...(saved?.retainingWalls || []).filter((item) => item.page !== planPage.pageNumber), ...(vector.retainingWalls || []).map((item) => ({ ...item, level }))],
        rooms, analysedAt: new Date().toISOString(), completedAt: readiness.needsReview ? null : new Date().toISOString(), added: admission.added,
        status: readiness.needsReview ? 'review' : admission.status,
      };
      completed.counts = { ...analysis.counts, rooms: rooms.length, roomBoundaries: rooms.filter((room) => room.polygon?.length >= 3).length,
        roomsForReview: rooms.filter((room) => room.reviewRequired).length, review: completed.review.length };
      completed.electricalPoints = electricalForPages(work.planPages, [planPage.pageNumber], () => pixelsPerMm, saved?.electricalPoints);
      latest.current.onDetectedLevels?.([{ page: planPage.pageNumber, level }]);
      setReport(completed);
      latest.current.markCompleted('ai-takeoff-local-vector');
      setStage(completed.status === 'review' ? 'review' : 'complete');
      setMessage(readiness.needsReview
        ? `Sheet ${planPage.pageNumber} measured — review required. Resolve withheld walls, opening associations and room boundaries before accepting quantities.`
        : `Local vector takeoff complete on sheet ${planPage.pageNumber}. No external AI requests were made.`);
      await nextFrame();
      assertCurrent(work, true);
      await latest.current.onCompleted?.(completed);
      pending.current = null;
    } catch (error) { fail(error, work); }
  };

  // Which sheets the local measurement measures: the floor plans the builder gave a level, else the job's
  // saved sheet readings (no request is made for them). A sheet it cannot measure is named with the reason.
  const measureLocally = async (work) => {
    const levels = latest.current.sheetLevels || {};
    const chosen = [];
    const fromSaved = [];
    for (const page of work.planPages) {
      const saved = inspectionsRef.current[`${RUN_ID}:${await fingerprintTakeoffPage(page)}`]?.analysis || null;
      assertCurrent(work);
      const builderLevel = levels[page.pageNumber] && levels[page.pageNumber] !== 'Unassigned' ? levels[page.pageNumber] : null;
      if (builderLevel) chosen.push({ ...(saved || {}), page: page.pageNumber, drawingType: 'floor_plan', level: builderLevel, relevant: true, rotationToUpright: saved?.rotationToUpright || 0, levelSource: 'builder' });
      else if (saved?.drawingType === 'floor_plan' && saved.relevant && saved.level && saved.level !== 'Unassigned') fromSaved.push({ ...saved, page: page.pageNumber, levelSource: 'saved-reading' });
    }
    // The builder's own level choices decide; saved readings are used only when no level has been chosen.
    const sheets = chosen.length ? chosen : fromSaved;
    if (!chosen.length) for (const item of fromSaved) work.warnings.push({ page: item.page, code: 'level-from-saved-reading', audience: 'decision',
      message: `Sheet ${item.page} was measured as ${item.level} from the plan's earlier sheet reading. Confirm the level in the sheet level selector.` });
    // Two sheets given one level (an elevation or a dimension sheet levelled with the floor plan): the sheet that
    // reads as that floor's plan is measured — a plan reading that calls it a floor plan first, then the most wall
    // drawn on it. The other is not measured, so the floor is never counted twice, and the builder is told which.
    const wallEvidence = new Map();
    const evidenceOf = (item) => {
      if (wallEvidence.has(item.page)) return wallEvidence.get(item.page);
      const page = work.planPages.find((planPage) => planPage.pageNumber === item.page);
      let metres = 0;
      try {
        if (hasStyledVectors(page) && sheetScale(item.page) > 0) {
          const found = detectVectorWalls(page.vectorSegments, { pageNumber: item.page, pixelsPerMm: sheetScale(item.page), logicalWidth: page.logicalWidth, logicalHeight: page.logicalHeight, textItems: page.textItems || [] });
          metres = (found.walls || []).reduce((sum, wall) => sum + (Number(wall.lengthMm) || 0), 0) / 1000;
        }
      } catch { metres = 0; }
      const reading = inspectionsRef.current ? Object.values(inspectionsRef.current).find((entry) => entry?.analysis?.page === item.page)?.analysis : null;
      const evidence = { metres, notPlan: Boolean(reading?.drawingType && reading.drawingType !== 'floor_plan') };
      wallEvidence.set(item.page, evidence);
      return evidence;
    };
    const byLevel = new Map();
    for (const item of sheets) byLevel.set(item.level, [...(byLevel.get(item.level) || []), item]);
    for (const [level, group] of byLevel) {
      if (group.length < 2) continue;
      const ranked = [...group].sort((a, b) => Number(evidenceOf(a).notPlan) - Number(evidenceOf(b).notPlan) || evidenceOf(b).metres - evidenceOf(a).metres);
      const keep = ranked[0];
      for (const other of ranked.slice(1)) work.warnings.push({ page: other.page, code: 'duplicate-level', audience: 'decision',
        message: `Sheets ${keep.page} and ${other.page} are both set to ${level}. Sheet ${keep.page} reads as the ${level} plan (${evidenceOf(keep).metres.toFixed(0)} m of wall drawn${evidenceOf(other).notPlan ? `; sheet ${other.page} was read as ${'another kind of drawing'}` : `, against ${evidenceOf(other).metres.toFixed(0)} m on sheet ${other.page}`}), so it was measured and sheet ${other.page} was not, to avoid counting the floor twice. Change the sheet levels if that is wrong.` });
      sheets.splice(0, sheets.length, ...sheets.filter((item) => item.level !== level || item === keep));
    }
    const levelsSeen = new Set();
    const measurable = [];
    for (const item of sheets) {
      const page = work.planPages.find((planPage) => planPage.pageNumber === item.page);
      if (levelsSeen.has(item.level)) {
        work.warnings.push({ page: item.page, code: 'duplicate-level', message: `Another floor-plan sheet is already ${item.level}. Sheet ${item.page} was not measured, to avoid counting that floor twice; check which sheet should be measured.` });
        continue;
      }
      if (!hasStyledVectors(page)) {
        work.warnings.push({ page: item.page, code: 'sheet-not-measurable', audience: 'decision', message: `Sheet ${item.page} (${item.level}) has no drawing linework (a scanned image, or a PDF imported before linework was kept), so it could not be measured locally. Re-import the PDF, measure it with the takeoff tools, or run AI-assisted analysis.` });
        continue;
      }
      if (!(sheetScale(item.page) > 0)) {
        work.warnings.push({ page: item.page, code: 'sheet-not-calibrated', audience: 'decision', message: `Sheet ${item.page} (${item.level}) is not calibrated, so it was not measured. Calibrate it with the Calibrate tool and run takeoff again.` });
        continue;
      }
      levelsSeen.add(item.level);
      measurable.push(item);
    }
    if (!measurable.length) {
      pending.current = null;
      const reasons = work.warnings.map((item) => item.message).join(' ');
      setStage(work.warnings.some((item) => item.code === 'sheet-not-calibrated') ? 'calibration' : 'error');
      setMessage((work.notice ? `${work.notice} ` : '') + (sheets.length ? `Nothing could be measured. ${reasons}`
        : 'Choose the level of each floor-plan sheet (the sheet level selector above the plan), calibrate it, then run takeoff. The local measurement measures the floor plans you have given a level; nothing is sent to AI.'));
      return;
    }
    work.inspections = measurable;
    work.model = 'local';
    work.scale = { pixelsPerMm: latest.current.pixelsPerMm, source: 'builder calibration' };
    await measure(work);
  };

  // Run takeoff. By default the plan is measured locally from its own linework and nothing is sent to
  // any provider. AI-assisted analysis (paid OpenAI requests) runs only with assisted + authorised, which
  // the screen passes after the builder has confirmed the charge.
  const run = async ({ assisted = false, authorised = false, notice = '', remeasure = false } = {}) => {
    if (pending.current) return;
    const current = latest.current;
    if (current.readOnly || !current.jobId || !current.takeoffId || !current.planPages.length) {
      setStage('error'); setMessage('Open an editable job and upload its construction plan first.'); return;
    }
    if (assisted && authorised !== true) {
      setMessage('AI-assisted analysis sends the plan to OpenAI and is charged to your OpenAI account. Authorise it first; nothing was sent.'); return;
    }
    const abort = new AbortController();
    controller.current = abort;
    const work = {
      jobId: current.jobId, takeoffId: current.takeoffId, planPages: current.planPages,
      generation: current.lifecycle.hydrationVersion, signal: abort.signal,
      prepared: new Map(), inspections: [], requests: [], warnings: [], pixelsPerMm: current.pixelsPerMm,
      assisted, providerAuthorised: assisted && authorised === true, runId: assisted ? RUN_ID : LOCAL_RUN_ID, notice,
    };
    pending.current = work;
    setStage('reading'); setMessage(assisted ? 'AI-assisted analysis — reading the plan with OpenAI…' : 'Measuring the plan locally (no AI)…'); setScaleProposal(null);
    try {
      work.documentHash = await fingerprintTakeoffDocument(work.planPages);
      assertCurrent(work);
      // The same run on this takeoff, on this plan or on a relinked copy of it (whose page images can hash
      // differently): measuring again would add a second set of the same walls and rooms, so it is refused
      // unless the builder asks to re-measure, which replaces the earlier set.
      const earlier = latest.current.bridge.appliedRuns.find((receipt) => receipt.documentHash === work.documentHash
        && receipt.takeoffId === work.takeoffId && receipt.runId === work.runId)
        || latest.current.bridge.appliedRuns.find((receipt) => receipt.takeoffId === work.takeoffId && receipt.runId === work.runId);
      if (earlier && !(remeasure && !assisted)) {
        pending.current = null;
        setStage(reportRef.current?.status === 'review' ? 'review' : 'complete');
        setMessage(`${notice ? `${notice} ` : ''}This plan has already been ${assisted ? 'analysed with AI' : 'measured'}. Review the existing takeoff${assisted ? '' : ', or re-measure it with the current measuring rules while nothing from it is approved'}.`); return;
      }
      if (earlier) {
        // Measuring again replaces the earlier local measurement: only while nothing from it has been approved or
        // reviewed, so no approved quantity is lost or doubled. Items drawn by hand are never touched.
        const blocked = remeasureBlockers(latest.current, reportRef.current, earlier);
        if (blocked.length) {
          pending.current = null;
          setStage(reportRef.current?.status === 'review' ? 'review' : 'complete');
          setMessage(`Not re-measured: ${blocked.join('; ')}. Re-measuring would replace them. Nothing was changed.`); return;
        }
        const { removed } = latest.current.bridge.removeRun(earlier);
        reportRef.current = null;
        setReport(null);
        work.notice = `${work.notice ? `${work.notice} ` : ''}Re-measured: the earlier measurement (${removed} unapproved items) was replaced.`;
        // Let the removal reach the collections before the new run reads them.
        await new Promise((resolve) => setTimeout(resolve, 50));
        assertCurrent(work);
      }
      work.identity = { jobId: work.jobId, takeoffId: work.takeoffId, documentHash: work.documentHash, runId: work.runId };
      if (!assisted) { await measureLocally(work); return; }
      for (const page of work.planPages) {
        assertCurrent(work);
        setMessage(`Analysing plan — reading sheet ${page.pageNumber} of ${work.planPages.length}…`);
        const prepared = await prepareAnalysisPage(page);
        work.prepared.set(page.pageNumber, prepared);
        const inspectionKey = `${RUN_ID}:${await fingerprintTakeoffPage(page)}`;
        assertCurrent(work);
        const cachedInspection = inspectionsRef.current[inspectionKey];
        if (cachedInspection) {
          work.inspections.push(structuredClone(cachedInspection.analysis));
          work.requests.push({ action: 'inspect', page: page.pageNumber, requestId: cachedInspection.requestId, model: cachedInspection.model, cached: true });
          work.model ??= cachedInspection.model;
          continue;
        }
        try {
        const result = await providerCall(work, { action: 'inspect', ...work.identity, page: prepared });
        assertCurrent(work);
        rememberInspection(inspectionKey, result);
        work.inspections.push(structuredClone(result.analysis));
        work.requests.push({ action: 'inspect', page: page.pageNumber, requestId: result.requestId, model: result.model });
        work.model = result.model;
        } catch (error) {
          assertCurrent(work);
          if (error.hard || ![429, 502, 504].includes(error.status)) throw error;
          work.warnings.push({ page: page.pageNumber, message: `Sheet inspection failed: ${error.message} This sheet requires review.`, code: 'inspection-failed' });
        }
      }
      const relevant = work.inspections.filter((item) => item.relevant);
      if (!relevant.length && !work.inspections.some((item) => item.drawingType === 'roof_plan')) throw new Error(`No measurable floor-plan or roof-plan page was identified. ${work.warnings.map((item) => item.message).join(' ') || 'Review the supplied sheets.'}`);
      // Multiple presentations of one floor must not silently count twice.
      const levels = new Set();
      for (const item of relevant) {
        if (!item.level || item.level === 'Unassigned') {
          if (relevant.some((other) => other !== item && other.level && other.level !== 'Unassigned')) {
            item.relevant = false;
            work.warnings.push({ page: item.page, code: 'unassigned-level', message: `Sheet ${item.page} has floor-plan geometry but no reliable level. It is supporting evidence until its level and scope are confirmed, avoiding duplicate counts.` });
          }
          continue;
        }
        if (levels.has(item.level)) {
          item.relevant = false;
          work.warnings.push({ page: item.page, code: 'duplicate-level', message: `Another floor-plan sheet describes ${item.level}. Sheet ${item.page} is supporting evidence only to avoid double-counting; verify which revision should be measured.` });
        } else levels.add(item.level);
      }
      const scale = resolveAnalysisScale({ pages: work.planPages, inspections: work.inspections, existingPixelsPerMm: latest.current.pixelsPerMm, sheetCalibrations: calibrationsRef.current });
      work.scale = scale;
      if (scale.conflicts?.length) {
        const explanation = scale.conflicts.map((item) => typeof item === 'string' ? item : item.message || JSON.stringify(item)).join(' ');
        if (relevant.length > 1) throw new Error(`Scale evidence needs review across the relevant drawings. ${explanation}`);
        setStage('calibration'); setMessage(`${explanation} Use the existing Calibrate tool; analysis will continue after calibration.`); return;
      }
      if (!scale.pixelsPerMm) {
        setStage('calibration'); setMessage('Scale could not be established reliably. Calibrate the plan with the existing Calibrate tool, then analysis will continue.'); return;
      }
      if (latest.current.objectCount && !closeScale(scale.pixelsPerMm, latest.current.pixelsPerMm)) {
        setStage('calibration'); setMessage('Detected scale differs from the current takeoff. Existing measurements depend on its calibration. Verify it with the existing Calibrate tool before analysis continues.'); return;
      }
      if (scale.requiresConfirmation || !closeScale(scale.pixelsPerMm, latest.current.pixelsPerMm)) {
        setScaleProposal(scale); setStage('scale'); setMessage('Confirming scale…'); return;
      }
      await measure(work);
    } catch (error) { fail(error, work); }
  };

  const confirmScale = async () => {
    const work = pending.current;
    if (!work || !scaleProposal) return;
    try {
      const current = assertCurrent(work);
      if (current.objectCount && !closeScale(scaleProposal.pixelsPerMm, current.pixelsPerMm)) throw new Error('Existing measurements require manual calibration before changing scale.');
      current.setPixelsPerMm(scaleProposal.pixelsPerMm);
      current.markCompleted('ai-confirmed-calibration');
      setStage('measuring'); setMessage('Measuring plan…');
      await nextFrame();
      await measure(work);
    } catch (error) { fail(error, work); }
  };

  useEffect(() => {
    const work = pending.current;
    if (stage !== 'calibration' || !work || !(options.pixelsPerMm > 0) || options.pixelsPerMm === work.pixelsPerMm) return;
    work.scale = { ...work.scale, pixelsPerMm: options.pixelsPerMm, source: 'confirmed-manual-calibration' };
    setStage('measuring');
    void measure(work);
  }, [options.pixelsPerMm, stage]);

  // The builder's answer to one review item: change the objects it names, or note it as seen.
  const resolveDecision = (decision, value) => {
    if (latest.current.readOnly || !decision) return;
    if (decision.topic === 'construction-input') { setReport((current) => applyConstructionInput(current, decision, value)); return; }
    if (decision.topic === 'documented-area') {
      // The printed figure itself carries the builder's answer: confirmed for use, or left out.
      setReport((current) => {
        if (!current?.documentedAreas?.[decision.areaIndex]) return current;
        const documentedAreas = current.documentedAreas.map((item, index) => index !== decision.areaIndex ? item
          : value === 'use' ? { ...item, confirmed: true, excluded: false, confirmedAt: new Date().toISOString() } : { ...item, confirmed: false, excluded: true, excludedAt: new Date().toISOString() });
        return { ...current, documentedAreas };
      });
      return;
    }
    latest.current.bridge.updateObjects((collections) => applyReviewDecision(decision, value, collections));
    if (['acknowledge', 'rerun'].includes(decision.action?.type)) {
      // A wall check also records exactly which walls it covered (see reviewSummary.js).
      setReport((current) => (current ? { ...current, resolvedDecisions: { ...(current.resolvedDecisions || {}), [decision.id]: { resolvedAt: new Date().toISOString(),
        ...(Array.isArray(decision.wallIds) ? { wallIds: decision.wallIds.map(String) } : {}) } } } : current));
    }
  };

  const useManualCalibration = () => {
    if (!pending.current) return;
    setScaleProposal(null);
    setStage('calibration');
    setMessage('Use the existing Calibrate tool to measure a known dimension. Analysis will continue after calibration.');
  };

  const continueManualCalibration = async () => {
    const work = pending.current;
    if (!work || stage !== 'calibration' || !(latest.current.pixelsPerMm > 0)) return;
    work.scale = { ...work.scale, pixelsPerMm: latest.current.pixelsPerMm, source: 'confirmed-manual-calibration' };
    setStage('measuring');
    await measure(work);
  };

  const resolveWallCandidate = (id, value) => {
    const candidate = reportRef.current?.wallReviewCandidates?.find(item => item.id === id);
    if (candidate && !latest.current.readOnly) return runVectorTakeoff(candidate.page, { id, value });
  };

  return {
    resolveWallCandidate, report, inspections, sheetCalibrations, recordSheetCalibration, resolveDecision, restoreReport,
    stage, message, scaleProposal,
    rooms: { ...roomsState, read: readRooms, remeasure: measureRoomsFromWalls, fromWalls: measureRoomsFromWalls, add: addRoom, remove: removeRoom, update: updateRooms },
    run, runVectorTakeoff, confirmScale, cancel, useManualCalibration, continueManualCalibration,
    hasCalibration: options.pixelsPerMm > 0,
  };
}
