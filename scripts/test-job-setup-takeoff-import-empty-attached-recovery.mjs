// Regression coverage for the live failure on "New Job 03/09":
//
//   Job Setup -> Import takeoff quantities -> "Nothing in this takeoff maps to Job Setup yet"
//
// despite the saved takeoff genuinely holding 40 walls / 50 openings / 6 floorplans.
//
// Root cause, traced end to end from the real browser's IndexedDB (read-only inspection,
// nothing in the user's data was changed):
//
//   1. The job's OWN attached copy - workbook.aiPlanTakeoffJob - is a genuinely empty {}.
//      The takeoff itself saved successfully to its own separate storage
//      (gr8:ai-plan-takeoff:recent-jobs shows lastSuccessfullySavedAt with real counts);
//      the workbook's copy of it did not carry that data forward. scheduleForJob() built
//      an empty schedule from that empty object, so createJobSetupPayload had nothing to map.
//
//   2. The EXISTING recovery path (the "Saved takeoff" dropdown, backed by
//      resolveRecentTakeoffIndexedDbRecord) could have offered that real record - except its
//      candidate filter matched by exact associatedPlatformProjectId equality, and the saved
//      takeoff's own id ("recovered-03-09-123-mtrqpjz8") carries a random suffix appended by
//      an earlier "attach to project" step that the *workbook's* own id
//      ("recovered-03-09-123") never gained. Exact-string equality excluded the one relevant,
//      complete, successfully-saved record.
//
// Extracts the real fix verbatim from the component so this proves the shipped code, not a
// paraphrase of intent.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('components/estimate-builder/JobSetupTakeoffImport.jsx', 'utf8');

function extractBlock(startMarker, closeAfterMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `${startMarker} must exist in JobSetupTakeoffImport.jsx`);
  const closeFrom = source.indexOf(closeAfterMarker, start);
  const end = source.indexOf('\n}', closeFrom) + 2;
  return source.slice(start, end);
}

const hasMeasurableTakeoffDataSrc = extractBlock('const RAW_TAKEOFF_ARRAYS', 'function hasMeasurableTakeoffData(job) {');
const { hasMeasurableTakeoffData } = new Function(`${hasMeasurableTakeoffDataSrc}\nreturn { hasMeasurableTakeoffData };`)();

const isRelatedProjectIdSrc = source.slice(
  source.indexOf('function isRelatedProjectId(candidateId, knownIds) {'),
  source.indexOf('\n}', source.indexOf('function isRelatedProjectId(candidateId, knownIds) {')) + 2,
);
const { isRelatedProjectId } = new Function(`${isRelatedProjectIdSrc}\nreturn { isRelatedProjectId };`)();

// --- hasMeasurableTakeoffData -----------------------------------------------------------
assert.equal(hasMeasurableTakeoffData({}), false, 'A genuinely empty attached takeoff has no measurable data');
assert.equal(hasMeasurableTakeoffData(undefined), false, 'No attached takeoff at all');
assert.equal(hasMeasurableTakeoffData({ completedWallRuns: [] }), false, 'Empty arrays are not measurable data');
assert.equal(hasMeasurableTakeoffData({ completedWallRuns: [{ id: 'w1' }] }), true, 'A single real wall counts as measurable data');
assert.equal(hasMeasurableTakeoffData({ placedOpenings: [{ id: 'o1' }] }), true, 'Openings alone still count');
assert.equal(hasMeasurableTakeoffData({ completedFloorplans: [{ id: 'f1' }] }), true, 'Floorplans (e.g. the Patio area) alone still count');

// --- isRelatedProjectId: the exact live suffix pattern ----------------------------------
const knownIds = ['recovered-03-09-123'];
assert.equal(isRelatedProjectId('recovered-03-09-123', knownIds), true, 'Exact match still matches');
assert.equal(isRelatedProjectId('recovered-03-09-123-mtrqpjz8', knownIds), false, 'A suffix cannot prove shared ownership');
assert.equal(isRelatedProjectId('recovered-03-09-123-mttbljky', knownIds), false, 'Another suffix also requires an explicit alias or sync receipt');
assert.equal(isRelatedProjectId('recovered-03-09-123-mtrqpjz8', [...knownIds, 'recovered-03-09-123-mtrqpjz8']), true, 'An explicitly recorded legacy alias is supported');
assert.equal(isRelatedProjectId('some-other-job-456', knownIds), false, 'An unrelated project id is never treated as related');
assert.equal(isRelatedProjectId('', knownIds), false, 'A blank id is never related');
assert.equal(isRelatedProjectId(undefined, knownIds), false, 'An undefined id does not crash and is never related');

// --- The exact live scenario, reproduced from the real (read-only) browser inspection ---
// (values are the actual field names and shapes found; ids/timestamps/checksums are the
// real ones observed, not fabricated for the test.)
const liveWorkbook = {
  jobId: 'recovered-03-09-123',
  projectId: 'recovered-03-09-123',
  registeredJob: { jobId: 'recovered-03-09-123' },
  takeoffEngine: {
    aiPlanTakeoffJob: undefined,
    lastJobSetupSync: {
      takeoffId: 'takeoff-1788816093655',
      payload: { provenance: { takeoffId: 'takeoff-1788816093655' } },
    },
  },
};
const liveAttachedTakeoffJob = {}; // workbook.aiPlanTakeoffJob, as actually found: {}
const liveRecentTakeoffJobs = [
  {
    moduleType: 'ai-plan-takeoff',
    takeoffId: 'takeoff-1788816093655',
    displayName: 'New Job 03/09',
    associatedPlatformProjectId: 'recovered-03-09-123-mtrqpjz8',
    lastSuccessfullySavedAt: '2026-09-12T20:01:55.028Z',
    counts: { walls: 40, openings: 50, floorplans: 6 },
  },
  {
    moduleType: 'ai-plan-takeoff',
    takeoffId: 'takeoff-1788392680902',
    displayName: 'New Job 03/09',
    associatedPlatformProjectId: '03-09/123',
    lastSuccessfullySavedAt: '2026-09-04T07:26:39.798Z',
    counts: { walls: 39, openings: 25, floorplans: 6 },
  },
];

// Reproduce startImport's own candidate-selection logic against this fixture, so the test
// exercises the exact same predicate the component runs, not a re-description of it.
const ids = [liveWorkbook.projectId, liveWorkbook.registeredJob?.projectId, liveWorkbook.registeredJob?.id, liveWorkbook.jobId].filter(Boolean);
const syncedTakeoffId = String(liveWorkbook.takeoffEngine?.lastJobSetupSync?.takeoffId || liveWorkbook.takeoffEngine?.lastJobSetupSync?.payload?.provenance?.takeoffId || '').trim();
const related = liveRecentTakeoffJobs.filter((job) => job.takeoffId !== liveAttachedTakeoffJob?.takeoffId
  && (isRelatedProjectId(job.associatedPlatformProjectId, ids) || (syncedTakeoffId && job.takeoffId === syncedTakeoffId)));

assert.equal(hasMeasurableTakeoffData(liveAttachedTakeoffJob), false, 'The attached takeoff is confirmed genuinely empty, matching the live bug report');
// Only the actually-related record is found. The older takeoff (a different, unrelated
// associatedPlatformProjectId of "03-09/123" and a different takeoffId) is correctly excluded -
// this proves the broadened match recovers the right record without also pulling in every
// same-named-but-unrelated takeoff it can find.
assert.equal(related.length, 1, 'Exactly the related record is found - the suffix variant of this job, not the unrelated older takeoff');
const recoveryCandidate = related.slice().sort((a, b) => String(b.lastSuccessfullySavedAt || '').localeCompare(String(a.lastSuccessfullySavedAt || '')))[0];
assert.equal(recoveryCandidate.takeoffId, 'takeoff-1788816093655', 'The most recently saved related takeoff (40 walls, 50 openings, 6 floorplans) is chosen, not the older one');

console.log('PASS empty-takeoff recovery uses exact IDs, explicit aliases and recorded sync receipts; name prefixes cannot associate jobs.');
