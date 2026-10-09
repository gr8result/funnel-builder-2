// Opening a .gr8job file stores it as the job. When this computer already holds a NEWER copy of
// that job, the file must not replace it unless the user chooses to: they can open the file as a
// separate job, cancel, or restore the file's revision over the stored one (which is kept as the
// previous revision). Pure functions; the hook and the dialog act on the result.
import { staleTakeoffOverwrite } from './takeoffFreshnessGuard.js';

export const JOB_FILE_CHOICES = Object.freeze({ SEPARATE: 'open-separately', CANCEL: 'cancel', RESTORE: 'restore' });

const time = (value) => { const parsed = Date.parse(String(value || '').split(':pre-')[0]); return Number.isFinite(parsed) ? parsed : null; };
const when = (value) => (time(value) === null ? 'an unknown date' : new Date(time(value)).toLocaleString());

/**
 * @param storedRecord  the job record already stored under the file's job id (or null)
 * @param fileWorkbook  the workbook the file would store
 * @param fileSavedAt   when the file was written (its own savedAt / lastModified)
 * @returns null when the file can simply be opened, otherwise what would be replaced
 */
export function jobFileReplacesNewerStoredJob(storedRecord, fileWorkbook, fileSavedAt = '') {
  if (!storedRecord?.workbook || !fileWorkbook) return null;
  const staleTakeoff = staleTakeoffOverwrite(storedRecord.workbook, fileWorkbook);
  // Judged by the takeoff's own stamps. The stored record's savedAt is no evidence: it is the
  // moment the job was last stored here, so the very file it came from always looks "older".
  if (!staleTakeoff) return null;
  const wouldLose = staleTakeoff?.wouldLose || [];
  return {
    code: 'STORED_JOB_NEWER',
    stored: { savedAt: storedRecord.savedAt || '', revision: Number(storedRecord.revision || 0), takeoff: staleTakeoff?.stored || null },
    file: { savedAt: fileSavedAt || fileWorkbook.savedAt || '', takeoff: staleTakeoff?.incoming || null },
    wouldLose,
    choices: [JOB_FILE_CHOICES.SEPARATE, JOB_FILE_CHOICES.CANCEL, JOB_FILE_CHOICES.RESTORE],
    message: `This file is older than the copy of this job already stored here (stored ${when(storedRecord.savedAt || storedRecord.workbook.savedAt)}; file ${when(fileSavedAt || fileWorkbook.savedAt)}).`
      + (staleTakeoff ? ` The stored plan takeoff is newer (${staleTakeoff.stored.describe}) than the file's (${staleTakeoff.incoming.describe}).` : '')
      + (wouldLose.length ? ` Restoring the file would replace: ${wouldLose.join(', ')}.` : '')
      + ' Nothing has been changed.',
  };
}

/**
 * The same file as a separate job: a new identity everywhere a job id is recorded, so nothing it
 * saves can reach the stored job. Its takeoff is re-linked to the new job, not shared with the old.
 */
export function asSeparateJob(fileWorkbook, newJobId, openedAt = new Date().toISOString()) {
  if (!newJobId) throw new Error('A separate job needs its own id.');
  const sourceJobId = String(fileWorkbook?.jobId || '');
  const relink = (takeoff) => (takeoff && typeof takeoff === 'object'
    ? { ...takeoff, jobId: newJobId, masterJobId: newJobId, associatedProjectId: newJobId, takeoffId: `takeoff:${newJobId}`,
      platformProject: { ...(takeoff.platformProject || {}), projectId: newJobId } }
    : takeoff);
  const takeoff = relink(fileWorkbook.aiPlanTakeoffJob);
  const name = `${fileWorkbook?.jobFileMeta?.jobName || fileWorkbook?.registeredJob?.jobName || 'Job'} (opened copy)`;
  return {
    ...fileWorkbook,
    jobId: newJobId, projectId: newJobId, commercialProjectId: '', registeredJobId: newJobId,
    registeredJob: { ...(fileWorkbook.registeredJob || {}), jobId: newJobId, jobName: name },
    jobFileMeta: { ...(fileWorkbook.jobFileMeta || {}), projectId: newJobId, jobName: name, localFileOnly: true, openedSeparatelyFrom: sourceJobId, openedSeparatelyAt: openedAt },
    ...(takeoff ? { aiPlanTakeoffJob: takeoff, takeoffEngine: { ...(fileWorkbook.takeoffEngine || {}), ...(fileWorkbook.takeoffEngine?.aiPlanTakeoffJob ? { aiPlanTakeoffJob: takeoff } : {}) } } : {}),
  };
}
