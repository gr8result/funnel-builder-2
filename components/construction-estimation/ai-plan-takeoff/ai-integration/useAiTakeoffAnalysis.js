import { useCallback, useEffect, useRef, useState } from 'react';
import { fingerprintTakeoffDocument, fingerprintTakeoffPage } from './documentIdentity.js';
import { prepareAnalysisPage, prepareGeometryReviewImage, restoreAnalysisCoordinates } from './analysisPages.js';
import { requestTakeoffAnalysis } from './analysisClient.js';
import { normalizePlanAnalysis, resolveAnalysisScale } from './analysisContract.js';
import { MEASUREMENT_SCOPES, ROOMS_SCOPE, mergeMeasurementScopes } from './measurementScopes.js';
import { ROOMS_RUN_ID, addManualRoom, floorPlanSheets, mergeRoomReadings, removeRoom as removeScheduleRoom, reportWithRooms } from './roomSchedule.js';
import { compactPlanEvidence, evidenceRotation, mergePlanEvidence, projectDefaultsFromJobSetup } from './planEvidence.js';
import { applyReviewDecision, reviewAudience } from './reviewSummary.js';

const RUN_ID = 'ai-takeoff-v1';
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

  const cancel = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    pending.current = null;
    setScaleProposal(null);
    setStage('idle');
    setMessage('Analysis cancelled. Existing takeoff objects were preserved.');
  }, []);

  const restoreReport = useCallback((saved = null, savedInspections = null, savedCalibrations = null) => {
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
  // Reads only the room names lettered on each floor-plan sheet. Nothing is traced or measured and
  // nothing is added to the canvas, so it is safe on a takeoff that was drawn by hand. One request
  // per floor-plan sheet; the result replaces what was previously read from those sheets.
  const [roomsState, setRoomsState] = useState({ busy: false, message: '', error: false });
  const reportRef = useRef(null);
  reportRef.current = report;
  const readRooms = async () => {
    if (pending.current || roomsState.busy) return;
    const current = latest.current;
    if (current.readOnly || !current.jobId || !current.takeoffId || !current.planPages.length) {
      setRoomsState({ busy: false, error: true, message: 'Open an editable job and upload its construction plan first.' }); return;
    }
    const sheets = floorPlanSheets(current.sheetLevels, current.planPages);
    if (!sheets.length) {
      setRoomsState({ busy: false, error: true, message: 'Tell the takeoff which sheet is which level first ("Sheet 2 is which level?"). Rooms are read from the floor-plan sheets.' }); return;
    }
    const abort = new AbortController();
    controller.current = abort;
    const work = { jobId: current.jobId, takeoffId: current.takeoffId, planPages: current.planPages, generation: current.lifecycle.hydrationVersion, signal: abort.signal };
    pending.current = work;
    setRoomsState({ busy: true, error: false, message: 'Reading room names from the plans…' });
    try {
      const documentHash = await fingerprintTakeoffDocument(work.planPages);
      const readings = [];
      let model = '';
      for (const sheet of sheets) {
        assertCurrent(work);
        setRoomsState({ busy: true, error: false, message: `Reading room names — sheet ${sheet.page} (${sheet.level})…` });
        const prepared = await prepareAnalysisPage(work.planPages.find((page) => page.pageNumber === sheet.page));
        const result = await requestTakeoffAnalysis({ action: 'measure', measurementScope: ROOMS_SCOPE, jobId: work.jobId, takeoffId: work.takeoffId, documentHash, runId: ROOMS_RUN_ID,
          page: { ...prepared, drawingType: 'floor_plan', level: sheet.level }, pixelsPerMm: latest.current.pixelsPerMm > 0 ? latest.current.pixelsPerMm : 1 }, work.signal);
        assertCurrent(work);
        model = result.model || model;
        readings.push({ page: sheet.page, level: sheet.level, rooms: result.analysis.rooms || [] });
      }
      const rooms = mergeRoomReadings(reportRef.current?.rooms, readings);
      const next = reportWithRooms(reportRef.current, rooms, { readAt: new Date().toISOString(), model, sheets: sheets.map((sheet) => sheet.page) });
      setReport(next);
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
      latest.current.onDetectedLevels?.(analysis.pages);
      setReport(completed);
      latest.current.markCompleted('ai-takeoff-analysis');
      setStage(result.status === 'review' ? 'review' : 'complete');
      setMessage(result.status === 'review' ? 'AI TAKEOFF REQUIRES REVIEW — no reliable geometry was accepted. Review the drawing evidence below.'
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
        setStage('complete'); setMessage('This plan has already been analysed. Review the existing takeoff.'); return;
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

  return { report, inspections, sheetCalibrations, recordSheetCalibration, resolveDecision, restoreReport, stage, message, scaleProposal, rooms: { ...roomsState, read: readRooms, add: addRoom, remove: removeRoom }, run, confirmScale, cancel, useManualCalibration, continueManualCalibration, hasCalibration: options.pixelsPerMm > 0 };
}
