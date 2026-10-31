// A job is saved whole, so every module's save carries its own copy of the takeoff. A screen that
// loaded the job before the takeoff was last changed (another tab, an older file, a synced copy)
// would otherwise put its older takeoff back over the newer one without anyone being told.
//
// The takeoff stamps itself (updatedAt, revision, contentChecksum) every time the canvas builds it,
// so staleness is judged from the takeoff's own stamps, whichever path the save arrives by. This
// complements the job-level revision check (jobContext.staleWriteConflict), which cannot see a
// stale copy saved from the same tab, from a tab with no recorded base revision, or over a record
// written before writer stamps existed.
//
// Pure functions. Nothing here restores, merges or rewrites a takeoff: a stale save is refused and
// the stored job is left exactly as it is.

const takeoffOf = (workbook) => {
  const canonical = workbook?.aiPlanTakeoffJob, compatibility = workbook?.takeoffEngine?.aiPlanTakeoffJob;
  return [canonical, compatibility].filter((job) => job && typeof job === 'object');
};
const time = (job) => { const value = Date.parse(job?.updatedAt || ''); return Number.isFinite(value) ? value : null; };
const revision = (job) => (Number.isFinite(Number(job?.revision)) ? Number(job.revision) : null);
const COLLECTIONS = ['completedWallRuns', 'placedOpenings', 'completedFloorplans', 'completedAreas', 'completedMeasurements', 'completedEaves', 'completedPillars'];
const count = (job) => COLLECTIONS.reduce((sum, key) => sum + (Array.isArray(job?.[key]) ? job[key].length : 0), 0);

// The newest of a workbook's takeoff copies, by its own stamp.
function newestTakeoff(workbook) {
  return takeoffOf(workbook).reduce((best, job) => {
    if (!best) return job;
    const a = time(job), b = time(best);
    if (a !== null && b !== null && a !== b) return a > b ? job : best;
    return (revision(job) ?? -1) > (revision(best) ?? -1) ? job : best;
  }, null);
}

// What the stored takeoff holds that is not geometry but must survive a save just the same.
function evidenceOf(job) {
  const state = job?.scheduleState || {};
  return {
    calibration: Number(job?.pixelsPerMm) > 0,
    sheetCalibrations: Object.keys(state.sheetCalibrations || {}).length,
    analysis: Boolean(state.aiAnalysis),
    rooms: (state.aiAnalysis?.rooms || []).length,
    appliedRuns: (state.aiAppliedRuns || []).length,
  };
}

export class StaleTakeoffError extends Error {
  constructor(detail) {
    super(`Save stopped: this screen holds an older copy of the plan takeoff (${detail.incoming.describe}) than the one already saved (${detail.stored.describe}). Nothing was overwritten. Reload the job to get the current takeoff before saving again.`);
    this.name = 'StaleTakeoffError';
    this.code = 'TAKEOFF_STALE';
    Object.assign(this, detail);
  }
}

/**
 * Would saving `incomingWorkbook` over `storedWorkbook` replace the stored takeoff with an older
 * copy of it? Returns null when the save is safe, otherwise a StaleTakeoffError to reject it with.
 *
 * Safe: no stored takeoff; the same takeoff content; an incoming takeoff stamped the same as or
 * later than the stored one; a different takeoff (takeoffId) replacing it deliberately; and jobs
 * whose takeoffs carry no stamps at all (files older than the stamps), which are never blocked.
 */
export function staleTakeoffOverwrite(storedWorkbook, incomingWorkbook) {
  const stored = newestTakeoff(storedWorkbook);
  if (!stored) return null;
  const copies = takeoffOf(incomingWorkbook);
  // Dropping the takeoff section altogether is the job-schema guard's concern, not staleness.
  if (!copies.length) return null;
  const describe = (job) => `${job.updatedAt ? new Date(job.updatedAt).toLocaleString() : 'undated'}, revision ${revision(job) ?? '?'}, ${count(job)} traced items`;
  for (const incoming of copies) {
    if (incoming === stored) continue;
    if (stored.contentChecksum && incoming.contentChecksum === stored.contentChecksum) continue;
    const storedId = String(stored.takeoffId || ''), incomingId = String(incoming.takeoffId || '');
    if (storedId && incomingId && storedId !== incomingId) continue;
    const a = time(incoming), b = time(stored);
    const older = a !== null && b !== null ? a < b
      // Without both dates, only a strictly lower revision is evidence of an older copy.
      : revision(incoming) !== null && revision(stored) !== null && revision(incoming) < revision(stored);
    if (!older) continue;
    const before = evidenceOf(stored), after = evidenceOf(incoming);
    const lost = [
      count(stored) > count(incoming) ? `${count(stored) - count(incoming)} traced items` : '',
      before.calibration && !after.calibration ? 'the confirmed calibration' : '',
      before.sheetCalibrations > after.sheetCalibrations ? 'sheet calibrations' : '',
      before.analysis && !after.analysis ? 'the AI analysis and its evidence' : '',
      before.rooms > after.rooms ? `${before.rooms - after.rooms} rooms` : '',
      before.appliedRuns > after.appliedRuns ? 'the record of applied AI runs' : '',
    ].filter(Boolean);
    return new StaleTakeoffError({
      stored: { updatedAt: stored.updatedAt || '', revision: revision(stored), items: count(stored), describe: describe(stored) },
      incoming: { updatedAt: incoming.updatedAt || '', revision: revision(incoming), items: count(incoming), describe: describe(incoming) },
      wouldLose: lost,
    });
  }
  return null;
}
