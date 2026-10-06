import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verifyAiPlanTakeoffSavedJob, createJobData } from '../components/construction-estimation/ai-plan-takeoff/jobPersistence.js';

// A takeoff save is only reported as saved once the stored copy is read back and confirmed. The
// confirmation must be about the job in hand, not about a page count baked into the checker: the
// only caller passes no options, so a fixed expectation there raises SAVE FAILED on every job that
// does not happen to have that many sheets.

const PLAN_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';
const jobWithSheets = (count, extra = {}) => createJobData({
  name: `${count} sheet job`,
  currentPage: 1,
  totalPages: count,
  rotation: 0,
  pixelsPerMm: 0.1,
  planPages: Array.from({ length: count }, (_, i) => ({
    pageNumber: i + 1, dataUrl: PLAN_IMAGE, width: 100, height: 80, logicalWidth: 100, logicalHeight: 80, renderScale: 1,
  })),
  completedWallRuns: [{ id: 'w1', page: 1, category: 'exterior', nodes: [{ x: 0, y: 0 }, { x: 50, y: 0 }], lengthMm: 5000, thicknessMm: 230, exteriorType: 'Face Brick Veneer' }],
  completedEaves: [], completedAreas: [], completedFloorplans: [], completedMeasurements: [], placedOpenings: [],
  sheetLevels: { 1: 'Ground Floor' }, projectInfo: {}, planFilename: 'plans.pdf',
  takeoffId: `job-${count}`, revision: 7, scheduleState: {}, platformProject: {},
  ...extra,
});

// A faithful read-back verifies, whatever the sheet count. Three and one are the cases a fixed
// expectation of five silently rejected.
for (const sheets of [1, 2, 3, 4, 5, 8]) {
  const submitted = jobWithSheets(sheets);
  const saved = JSON.parse(JSON.stringify(submitted));
  const result = verifyAiPlanTakeoffSavedJob(submitted, saved);
  assert.equal(result.ok, true, `A faithful read-back of a ${sheets}-sheet job must verify`);
  assert.equal(result.planPageCountMatches, true, `${sheets}-sheet job page counts match`);
  assert.equal(result.revision, 7);
}

// A caller that genuinely knows the expected count can still assert it.
const three = jobWithSheets(3);
assert.equal(verifyAiPlanTakeoffSavedJob(three, JSON.parse(JSON.stringify(three)), { expectedPlanPages: 3 }).ok, true);
assert.equal(
  verifyAiPlanTakeoffSavedJob(three, JSON.parse(JSON.stringify(three)), { expectedPlanPages: 5 }).planPageCountMatches,
  false,
  'An explicit expectation is still enforced',
);

// Real corruption must still fail, each for its own reason.
{
  const submitted = jobWithSheets(3);
  const lostPage = JSON.parse(JSON.stringify(submitted));
  lostPage.plan.pages.pop();
  const result = verifyAiPlanTakeoffSavedJob(submitted, lostPage);
  assert.equal(result.ok, false, 'A dropped sheet fails verification');
  assert.equal(result.planPageCountMatches, false);
  assert.equal(result.submittedCounts.planPages, 3);
  assert.equal(result.savedCounts.planPages, 2);
}
{
  const submitted = jobWithSheets(3);
  const unreadable = JSON.parse(JSON.stringify(submitted));
  unreadable.plan.pages[1].dataUrl = '';
  const result = verifyAiPlanTakeoffSavedJob(submitted, unreadable);
  assert.equal(result.ok, false, 'A stored sheet that cannot be read back fails verification');
  assert.equal(result.planPageCountMatches, false);
  assert.equal(result.savedCounts.renderablePlanPages, 2);
}
{
  const submitted = jobWithSheets(3);
  const lostWall = JSON.parse(JSON.stringify(submitted));
  lostWall.completedWallRuns = [];
  const result = verifyAiPlanTakeoffSavedJob(submitted, lostWall);
  assert.equal(result.ok, false, 'Lost measurements fail verification');
  assert.equal(result.countsMatch, false);
}
{
  const submitted = jobWithSheets(3);
  const wrongRevision = { ...JSON.parse(JSON.stringify(submitted)), revision: 6 };
  const result = verifyAiPlanTakeoffSavedJob(submitted, wrongRevision);
  assert.equal(result.ok, false, 'A revision mismatch fails verification');
  assert.equal(result.revisionMatches, false);
}

// The failure the estimator sees has to name the check that failed.
const jsx = readFileSync(new URL('../components/construction-estimation/ai-plan-takeoff/AIPlanTakeoffStandalone.jsx', import.meta.url), 'utf8');
const start = jsx.indexOf('  const requireVerifiedSave = useCallback(');
const body = jsx.slice(start, jsx.indexOf('  const clearTakeoffWorkspace', start));
const requireVerifiedSave = new Function('useCallback', 'createRecoverySnapshot', 'SAVE_VERIFICATION_FAILED_MESSAGE',
  `${body}\nreturn requireVerifiedSave;`)((fn) => fn, () => {}, 'SAVE FAILED – DO NOT CLOSE THIS TAKEOFF');

const pageFailure = requireVerifiedSave({ ok: false, verification: verifyAiPlanTakeoffSavedJob(jobWithSheets(3), (() => { const j = jobWithSheets(3); j.plan.pages.pop(); return j; })()) }, {});
assert.equal(pageFailure.ok, false);
assert.match(pageFailure.message, /^SAVE FAILED/, 'The alert keeps its urgency');
assert.match(pageFailure.message, /plan pages \(sent 3 readable of 3, stored 2 of 2\)/, 'The message names the plan pages actually stored');

const countFailure = requireVerifiedSave({ ok: false, verification: verifyAiPlanTakeoffSavedJob(jobWithSheets(3), (() => { const j = jobWithSheets(3); j.completedWallRuns = []; return j; })()) }, {});
assert.match(countFailure.message, /takeoff item counts/, 'A lost measurement is reported as such');
assert.match(countFailure.message, /content checksum/, 'A changed checksum is reported too');

const noVerification = requireVerifiedSave({ ok: false }, {});
assert.match(noVerification.message, /the save did not complete/, 'A save that never reached verification says so');

const good = requireVerifiedSave({ ok: true, verification: { ok: true, revision: 7 }, revision: 7, savedAt: '2026-09-15T00:00:00.000Z' }, {});
assert.equal(good.ok, true, 'A verified save is still reported as saved');

console.log('Takeoff save verification checks passed:');
console.log('  sheet counts     1, 2, 3, 4, 5 and 8 sheet jobs all verify (previously only 5 could)');
console.log('  explicit count   a caller-supplied expectedPlanPages is still enforced');
console.log('  real corruption  dropped sheet, unreadable sheet, lost wall and wrong revision all still fail');
console.log(`  failure message  ${pageFailure.message}`);
console.log(`                   ${countFailure.message}`);
