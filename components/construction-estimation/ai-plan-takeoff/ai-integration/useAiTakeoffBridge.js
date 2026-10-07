import { useCallback, useRef, useState } from 'react';
import { convertAiTakeoffDetections } from './adapter.js';
import { fingerprintTakeoffDocument } from './documentIdentity.js';

export const AI_TAKEOFF_COLLECTIONS = [
  'completedWallRuns', 'placedOpenings', 'completedFloorplans',
  'completedAreas', 'completedMeasurements', 'completedEaves', 'completedPillars',
];

const sameRun = (a, b) => ['jobId', 'takeoffId', 'documentHash', 'runId'].every((key) => a?.[key] === b?.[key]);

// This hook owns admission/idempotence only. Geometry remains in the existing
// canvas arrays; receipts travel inside the existing job's scheduleState.
export function useAiTakeoffBridge(options) {
  const latest = useRef(options);
  latest.current = options;
  const receiptsRef = useRef([]);
  const [appliedRuns, setAppliedRuns] = useState([]);

  const restoreAppliedRuns = useCallback((receipts = []) => {
    const restored = Array.isArray(receipts) ? receipts.filter((receipt) => receipt
      && ['jobId', 'takeoffId', 'documentHash', 'runId'].every((key) => typeof receipt[key] === 'string' && receipt[key]))
      .map(({ jobId, takeoffId, documentHash, runId }) => ({ jobId, takeoffId, documentHash, runId })) : [];
    receiptsRef.current = restored;
    setAppliedRuns(restored);
  }, []);

  const getContext = useCallback(async () => {
    const initial = latest.current;
    const generation = initial.lifecycle.hydrationVersion;
    if (initial.readOnly || !initial.jobId || !initial.takeoffId) throw new Error('Open an editable takeoff job first.');
    if (!(Number.isFinite(initial.pixelsPerMm) && initial.pixelsPerMm > 0)) throw new Error('Calibrate the current plan before importing AI detections.');
    const documentHash = await fingerprintTakeoffDocument(initial.planPages);
    const current = latest.current;
    if (current.readOnly || current.jobId !== initial.jobId || current.takeoffId !== initial.takeoffId
      || current.planPages !== initial.planPages || current.pixelsPerMm !== initial.pixelsPerMm
      || current.lifecycle.hydrationVersion !== generation) {
      throw new Error('The takeoff changed while verifying the AI import. Run it again for the current plan.');
    }
    return {
      jobId: current.jobId, takeoffId: current.takeoffId, documentHash,
      pixelsPerMm: current.pixelsPerMm,
      pages: current.planPages.map(({ pageNumber, logicalWidth, logicalHeight }) => ({ pageNumber, logicalWidth, logicalHeight })),
      completedWallRuns: current.collections.completedWallRuns,
      // What is already in the takeoff is authoritative: the analysis never re-adds it.
      placedOpenings: current.collections.placedOpenings,
      completedEaves: current.collections.completedEaves,
    };
  }, []);

  // Apply a builder's review answer to the objects it names, through the same setters the
  // canvas uses. `change` receives the current collections and returns only those it changed.
  const updateObjects = useCallback((change) => {
    const current = latest.current;
    if (current.readOnly) return false;
    const patch = change(current.collections) || {};
    const keys = AI_TAKEOFF_COLLECTIONS.filter((key) => Array.isArray(patch[key]));
    for (const key of keys) current.setters[key](patch[key]);
    if (keys.length) current.markCompleted('ai-takeoff-review');
    return keys.length > 0;
  }, []);

  const appendDetections = useCallback(async (batch, { signal } = {}) => {
    const assertNotCancelled = () => {
      if (signal?.aborted) throw Object.assign(new Error('AI Takeoff import was cancelled. No objects were inserted.'), { name: 'AbortError' });
    };
    assertNotCancelled();
    // Snapshot the request so a caller cannot mutate it during document hashing.
    const submitted = structuredClone(batch);
    const initial = latest.current;
    const generation = initial.lifecycle.hydrationVersion;
    const context = await getContext();
    assertNotCancelled();
    const current = latest.current;
    if (current.readOnly || current.jobId !== context.jobId || current.takeoffId !== context.takeoffId
      || current.planPages !== initial.planPages || current.pixelsPerMm !== context.pixelsPerMm
      || current.lifecycle.hydrationVersion !== generation) {
      throw new Error('The takeoff changed before the AI import could be committed.');
    }
    const canonical = convertAiTakeoffDetections(submitted, { ...context, completedWallRuns: current.collections.completedWallRuns });
    const receipt = Object.fromEntries(['jobId', 'takeoffId', 'documentHash', 'runId'].map((key) => [key, submitted[key]]));
    if (receiptsRef.current.some((item) => sameRun(item, receipt))) return { status: 'duplicate', added: 0 };

    const existing = AI_TAKEOFF_COLLECTIONS.flatMap((key) => current.collections[key]);
    const ids = new Set(existing.map((item) => String(item.id)));
    const additions = AI_TAKEOFF_COLLECTIONS.flatMap((key) => canonical[key]);
    if (!additions.length) throw new Error('The AI batch contains no supported takeoff objects.');
    if (additions.some((item) => ids.has(String(item.id)))) throw new Error('An AI object ID already exists. No objects were imported.');

    // No awaits after admission: all six updates and the durable receipt are one
    // React batch. Functional appends also retain manual edits queued this turn.
    assertNotCancelled();
    for (const key of AI_TAKEOFF_COLLECTIONS) {
      if (canonical[key].length) current.setters[key]((previous) => [...previous, ...canonical[key]]);
    }
    const nextReceipts = [...receiptsRef.current, receipt];
    receiptsRef.current = nextReceipts;
    setAppliedRuns(nextReceipts);
    current.markCompleted('ai-takeoff-import');
    return { status: 'appended', added: additions.length };
  }, [getContext]);

  return { getContext, appendDetections, updateObjects, appliedRuns, restoreAppliedRuns };
}
