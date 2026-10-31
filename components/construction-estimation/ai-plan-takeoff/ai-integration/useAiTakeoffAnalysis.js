import { readRoomRaster } from './roomBoundaryVision.js';
import { detectRoomBoundary, measureRoom } from './roomGeometry.js';
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
import { JOB_SCALE_KEY, jobPixelsPerMm, sheetPixelsPerMm as scaleOfSheet } from '../sheetScale.js';
import { cropPlanRegion, readPlanRaster } from '../geometry/planRaster.js';
import { detectPlanGeometry } from '../geometry/planGeometry.js';
import { collectRegionOpenings, planRegions } from '../geometry/planRegions.js';
import { detectVectorWalls } from '../geometry/vectorWalls.js';
import { buildLocalVectorAnalysis, roomLabelsFromText } from './localVectorAnalysis.js';
import { localVectorReadiness } from './localVectorReadiness.js';
import { vectorProductionAnalysis } from './vectorProductionAnalysis.js';

const RUN_ID = 'ai-takeoff-v3-linework';
const LOCAL_VECTOR_RUN_ID = 'ai-takeoff-vector-v3';
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
const closeScale = (a, b) => a > 0 && b > 0 && Math.abs(a - b) / b < 0.000001;
const CONTEXT_TEXT_CHARS = 20000;
const MAX_CACHED_INSPECTIONS = 60;
// Evidence is read from every sheet, most informative first, a few sheets per request.
const EVIDENCE_ORDER = ['window_door_schedule', 'elevation', 'section', 'details', 'floor_plan', 'other', 'roof_plan', 'cover', 'site_plan'];
const MAX_EVIDENCE_SHEETS = 8;
const EVIDENCE_BATCH_BYTES = 7 * 1024 * 1024;
const imageBytes = (page) => Math.ceil(String(page?.imageDataUrl || '').length * 0.75);

function sanitizeCalibrations(saved) {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {};
  return Object.fromEntries(Object.entries(saved).filter(([page, entry]) => Number.isInteger(Number(page)) && Number(page) > 0
    && Number.isFinite(Number(entry?.pixelsPerMm)) && Number(entry.pixelsPerMm) > 0)
    .map(([page, entry]) => [page, { pixelsPerMm: Number(entry.pixelsPerMm), calibratedAt: String(entry.calibratedAt || '') }]));
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
  const recordSheetCalibration = useCallback((page, pixelsPerMm) => {
    if (!(Number(page) > 0) || !(Number(pixelsPerMm) > 0)) return;
    calibrationsRef.current = { ...calibrationsRef.current, [Number(page)]: { pixelsPerMm: Number(pixelsPerMm), calibratedAt: new Date().toISOString() } };
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
    setReport(saved || null);
    setStage(saved && saved.status !== 'rooms' ? (saved.status === 'review' ? 'review' : 'complete') : 'idle');
    setMessage('');
  }, []);

  // ---- Rooms schedule ----------------------------------------------------------------------
  // Detect semantic room boundaries, refine against raster wall evidence, and preserve
  // confirmed corrections. Existing wall/opening objects provide additional geometry evidence.
  const [roomsState, setRoomsState] = useState({ busy: false, message: '', error: false });
  const reportRef = useRef(null);
  reportRef.current = report;
  const readRooms = async () => {
    if (pending.current || roomsState.busy) return;
    const current = latest.current;
    if (current.readOnly || !current.jobId || !current.takeoffId || !current.planPages.length) {
      setRoomsState({ busy: false, error: true, message: 'Open an editable job and upload its construction plan first.' }); return;
    }
    let sheets = floorPlanSheets(current.sheetLevels, current.planPages);
    const abort = new AbortController();
    controller.current = abort;
    const work = { jobId: current.jobId, takeoffId: current.takeoffId, planPages: current.planPages, generation: current.lifecycle.hydrationVersion, signal: abort.signal };
    pending.current = work;
    setRoomsState({ busy: true, error: false, message: 'Detecting room boundaries from the plans…' });
    try {
      const documentHash = await fingerprintTakeoffDocument(work.planPages);
      if (!sheets.length) {
        for (const planPage of work.planPages) {
          assertCurrent(work);
          setRoomsState({ busy: true, error: false, message: `Identifying floor plans and levels — sheet ${planPage.pageNumber}…` });
          const prepared = await prepareAnalysisPage(planPage);
          const inspected = await requestTakeoffAnalysis({ action: 'inspect', jobId: work.jobId, takeoffId: work.takeoffId, documentHash, runId: ROOMS_RUN_ID, page: prepared }, work.signal);
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
        const result = await requestTakeoffAnalysis({ action: 'measure', measurementScope: ROOMS_SCOPE, jobId: work.jobId, takeoffId: work.takeoffId, documentHash, runId: ROOMS_RUN_ID,
          page: { ...prepared, drawingType: 'floor_plan', level: sheet.level }, pixelsPerMm: latest.current.pixelsPerMm > 0 ? latest.current.pixelsPerMm : 1 }, work.signal);
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

  const updateRooms = useCallback((ids, patch) => {
    if (latest.current.readOnly) return;
    setReport(current => refreshVectorReview(reportWithRooms(current, (current?.rooms || []).map(room => ids.includes(room.id)
      ? measureRoom({ ...room, ...patch, ...(patch.polygon ? { boundaryEdited: true, confirmed: false, boundaryClosed: false } : {}) }, calibrationsRef.current[room.page]?.pixelsPerMm || latest.current.pixelsPerMm) : room))));
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
      const detected = roomsFromWallRuns(sheetRuns, spec, roomLabelsFromText(planPage))
        .map((room, index) => detectRoomBoundary(room, { page, level, width: planPage.logicalWidth, height: planPage.logicalHeight, pixelsPerMm, walls: sheetRuns, openings: current.placedOpenings }, index));
      count += detected.length;
      merged = mergeRoomReadings(merged, [{ page, level, rooms: detected }]);
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
      if (!current?.rooms?.some(room => room.polygon && room.pixelsPerMm !== (sheetCalibrations[room.page]?.pixelsPerMm || options.pixelsPerMm || null))) return current;
      return reportWithRooms(current, current.rooms.map(room => room.polygon ? measureRoom(room, sheetCalibrations[room.page]?.pixelsPerMm || options.pixelsPerMm) : room));
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
    setStage('error');
    setMessage(error.message || 'AI Takeoff could not complete.');
    pending.current = null;
  };

  const requestHalf = async (work, key, payload) => {
    const cached = halves.current.get(key);
    if (cached) return cached;
    const result = await requestTakeoffAnalysis(payload, work.signal);
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
      const planEvidence = await collectEvidence(work);
      const sharedEvidence = compactPlanEvidence(planEvidence, projectDefaults);
      const responses = [];
      for (const inspection of work.inspections.filter((item) => item.relevant || item.drawingType === 'roof_plan')) {
        assertCurrent(work, true);
        setStage('measuring');
        setMessage(`Analysing plan — measuring sheet ${inspection.page} of ${work.planPages.length}…`);
        const page = work.planPages.find((item) => item.pageNumber === inspection.page);
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
        try {
          // Geometry then items, one at a time: a failure stops before the next paid
          // request and the shared request prefix can be served from the provider cache.
          const measured = {};
          for (const scope of MEASUREMENT_SCOPES) measured[scope] = await requestHalf(work, halfKey('measure', scope), scoped('measure', scope));
          const firstPass = mergeMeasurementScopes(measured.geometry.analysis, measured.items.analysis);
          work.model = measured.items.model;
          setMessage(`Checking geometry against the drawing — sheet ${inspection.page}…`);
          const refined = { geometry: measured.geometry.analysis, items: measured.items.analysis };
          let geometryPreviewDataUrl = null;
          for (const scope of MEASUREMENT_SCOPES) {
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
          responses.push({ ...restoreAnalysisCoordinates(mergeMeasurementScopes(refined.geometry, refined.items), rotation), drawingType: inspection.drawingType });
        } catch (error) {
          // No credit, bad key or no model access: every further sheet would fail the same way.
          if (error.hard) throw error;
          assertCurrent(work, true);
          work.warnings.push({ page: inspection.page, message: `Sheet analysis failed: ${error.message}`, code: 'sheet-failed' });
        }
      }
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
          if (latest.current.regionOpenings === true) {
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
          const styledVectors = planPage.vectorSegments?.some(segment => segment.paint === 'stroke' && Number.isFinite(segment.widthPx) && typeof segment.color === 'string');
          if (styledVectors) {
            const detected = detectVectorWalls(planPage.vectorSegments, { ...sheet, raster, textItems: planPage.textItems || [] });
            const measured = vectorProductionAnalysis(response, detected, {
              id: `page-${pageNumber}`, name: response.level, page: pageNumber, pixelsPerMm: sheetPixelsPerMm,
              logicalWidth: sheet.logicalWidth, logicalHeight: sheet.logicalHeight,
            });
            responses[index] = { ...measured.response, drawingType: response.drawingType };
            vectorReadings.push({ page: pageNumber, vector: measured.vector, detected: measured.detected,
              reviewIdentity: `${work.documentHash}:${pageNumber}:${sheetPixelsPerMm}`,
              semanticInput: { page: pageNumber, level: response.level, walls: response.walls || [], openings: response.openings || [], rooms: response.rooms || [], review: [] } });
            linework[pageNumber] = { ...measured.vector.report, engine: detected.engine, detector: detected.stats };
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
        responses, runId: RUN_ID, modelVersion: work.model, planEvidence, projectDefaults,
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
      const completed = {
        ...analysis, runId: RUN_ID, documentHash: work.documentHash, provider: 'OpenAI', modelVersion: work.model,
        inspections: work.inspections, scale: work.scale, requests: work.requests,
        completedAt: new Date().toISOString(), added: result.added, status: result.status,
      };
      completed.linework = { ...(completed.linework || {}), ...linework };
      completed.rooms = reportRef.current?.rooms || completed.rooms;
      for (const response of responses) {
        const pageNumber = response.page || response.pageNumber;
        const planPage = work.planPages.find(page => page.pageNumber === pageNumber);
        if (!planPage || !response.rooms?.length) continue;
        const raster = await readRoomRaster(planPage.dataUrl);
        assertCurrent(work, true);
        const detected = response.rooms.map((room, index) => detectRoomBoundary(room, { page: pageNumber, level: response.level, width: planPage.logicalWidth, height: planPage.logicalHeight, pixelsPerMm: calibrationsRef.current[pageNumber]?.pixelsPerMm || work.pixelsPerMm, walls: latest.current.completedWallRuns, openings: latest.current.placedOpenings, raster }, index));
        completed.rooms = mergeRoomReadings(completed.rooms, [{ page: pageNumber, level: response.level, rooms: detected }]);
      }
      if (vectorReadings.length) {
        completed.linework = { ...completed.linework, ...Object.fromEntries(vectorReadings.map((reading) => [reading.page, {
          ...reading.vector.report, engine: reading.detected.engine, detector: reading.detected.stats,
          openings: reading.detected.openings.length, rooms: reading.vector.rooms.length,
        }])) };
        completed.vectorPlanEvidence = Object.fromEntries(vectorReadings.map(reading => [reading.reviewIdentity, reading.semanticInput]));
        completed.wallReviewCandidates = vectorReadings.flatMap(reading => reading.vector.reviewWallCandidates);
        completed.openingReviewCandidates = vectorReadings.flatMap(reading => reading.vector.reviewOpeningCandidates);
        completed.wallLineage = vectorReadings.flatMap(reading => reading.vector.wallLineage.map(item => ({ ...item, page: reading.page })));
        const issues = vectorReadings.flatMap(reading => localVectorReadiness({ analysis: {}, vector: reading.vector, detected: reading.detected,
          rooms: completed.rooms.filter(room => room.page === reading.page), admission: {} }).issues.map(issue => ({ ...issue, page: reading.page })));
        completed.review = [...completed.review, ...issues];
        if (issues.length || completed.unresolved?.length) { completed.status = 'review'; completed.completedAt = null; }
      }
      completed.counts = { ...completed.counts, review: completed.review.length, rooms: completed.rooms.length, roomBoundaries: completed.rooms.filter(room => room.polygon?.length >= 3).length, roomsForReview: completed.rooms.filter(room => room.reviewRequired).length };
      latest.current.onDetectedLevels?.(analysis.pages);
      setReport(completed);
      latest.current.markCompleted('ai-takeoff-analysis');
      setStage(completed.status === 'review' ? 'review' : 'complete');
      setMessage(completed.status === 'review' ? 'AI TAKEOFF REQUIRES REVIEW — check unresolved walls, openings and room boundaries below.'
        : result.status === 'duplicate' ? 'This analysis run is already in the takeoff.'
          : result.status === 'unchanged' ? 'AI TAKEOFF COMPLETE — everything found on the plans is already in this takeoff.' : 'AI TAKEOFF COMPLETE');
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
        if (!candidate?.detectionKey || !['interior', 'exterior', 'reject'].includes(wallDecision.value)) throw new Error('Select a current measured wall and choose Internal, External, or Not a wall.');
        // A report from another PDF must never authorize this PDF's geometry.
        if (saved.documentHash !== identity.documentHash) throw new Error('The plan changed. Run takeoff again before reviewing this wall.');
        wallDecisions[candidate.detectionKey] = wallDecision.value;
      }
      wallReviewDecisions[reviewIdentity] = wallDecisions;
      const { vector, batch, analysis, rooms: readings, detected: admittedGeometry } = buildLocalVectorAnalysis({ planPage, detected, pixelsPerMm, level, context, runId, wallDecisions, semanticInput: saved?.vectorPlanEvidence?.[reviewIdentity] || null, admitReviewedWallKeys: wallDecision && wallDecision.value !== 'reject'
        ? [saved.wallReviewCandidates.find(item => item.id === wallDecision.id && item.page === planPage.pageNumber).detectionKey] : [] });
      const admission = batch.detections.length
        ? await current.bridge.appendDetections(batch, { signal: work.signal })
        : { status: 'review', added: 0 };
      assertCurrent(work, true);
      const rooms = mergeRoomReadings(reportRef.current?.rooms, [{ page: planPage.pageNumber, level, rooms: readings }]);
      const readiness = localVectorReadiness({ analysis, vector, detected: admittedGeometry, rooms, admission });
      const completed = {
        ...analysis, review: [...analysis.review, ...readiness.issues], provider: 'GR8 Result local vector engine', modelVersion: detected.engine, runId,
        localVectorPage: planPage.pageNumber, wallReviewAction: Boolean(wallDecision),
        wallReviewDecisions, vectorPlanEvidence: saved?.vectorPlanEvidence || {},
        wallReviewCandidates: [...(saved?.wallReviewCandidates || []).filter(item => item.page !== planPage.pageNumber), ...vector.reviewWallCandidates],
        openingReviewCandidates: [...(saved?.openingReviewCandidates || []).filter(item => item.page !== planPage.pageNumber), ...vector.reviewOpeningCandidates],
        wallLineage: vector.wallLineage,
        documentHash: identity.documentHash, requests: [],
        inspections: [{ page: planPage.pageNumber, level, drawingType: 'floor_plan', localOnly: true }],
        linework: { ...(saved?.linework || {}), [planPage.pageNumber]: { ...vector.report, detector: detected.stats, openings: detected.openings.length, rooms: vector.rooms.length } },
        rooms, analysedAt: new Date().toISOString(), completedAt: readiness.needsReview ? null : new Date().toISOString(), added: admission.added,
        status: readiness.needsReview ? 'review' : admission.status,
      };
      completed.counts = { ...analysis.counts, rooms: rooms.length, roomBoundaries: rooms.filter((room) => room.polygon?.length >= 3).length,
        roomsForReview: rooms.filter((room) => room.reviewRequired).length, review: completed.review.length };
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

  const run = async () => {
    if (pending.current) return;
    const current = latest.current;
    if (current.readOnly || !current.jobId || !current.takeoffId || !current.planPages.length) {
      setStage('error'); setMessage('Open an editable job and upload its construction plan first.'); return;
    }
    const abort = new AbortController();
    controller.current = abort;
    const work = {
      jobId: current.jobId, takeoffId: current.takeoffId, planPages: current.planPages,
      generation: current.lifecycle.hydrationVersion, signal: abort.signal,
      prepared: new Map(), inspections: [], requests: [], warnings: [], pixelsPerMm: current.pixelsPerMm,
    };
    pending.current = work;
    setStage('reading'); setMessage('Analysing plan…'); setScaleProposal(null);
    try {
      work.documentHash = await fingerprintTakeoffDocument(work.planPages);
      assertCurrent(work);
      if (latest.current.bridge.appliedRuns.some((receipt) => receipt.documentHash === work.documentHash
        && receipt.takeoffId === work.takeoffId && receipt.runId === RUN_ID)) {
        pending.current = null;
        setStage(reportRef.current?.status === 'review' ? 'review' : 'complete'); setMessage('This plan has already been analysed. Review the existing takeoff.'); return;
      }
      work.identity = { jobId: work.jobId, takeoffId: work.takeoffId, documentHash: work.documentHash, runId: RUN_ID };
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
        const result = await requestTakeoffAnalysis({ action: 'inspect', ...work.identity, page: prepared }, work.signal);
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
    latest.current.bridge.updateObjects((collections) => applyReviewDecision(decision, value, collections));
    if (['acknowledge', 'rerun'].includes(decision.action?.type)) {
      setReport((current) => (current ? { ...current, resolvedDecisions: { ...(current.resolvedDecisions || {}), [decision.id]: { resolvedAt: new Date().toISOString() } } } : current));
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
