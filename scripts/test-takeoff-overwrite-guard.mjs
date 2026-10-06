// The New Job 03/09 loss: a save replaced a populated takeoff with {} and persisted it
// before checking, so the tracing was gone by the time the failure was reported.
// These cases lock the guard that now refuses that write.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { evaluateTakeoffOverwrite, bestTakeoffCounts } from '../lib/construction-estimation/takeoffOverwriteGuard.js';

function planPage(pageNumber) {
  return { pageNumber, width: 2677, height: 3789, dataUrl: 'data:image/png;base64,iVBORw0KGgo=' };
}

function populatedJob() {
  return {
    takeoffId: 'takeoff-1',
    plan: { type: 'embedded-pages', totalPages: 2, pages: [planPage(1), planPage(2)] },
    completedWallRuns: [{ id: 'w1' }, { id: 'w2' }],
    placedOpenings: [{ id: 'o1' }],
    completedAreas: [{ id: 'a1' }],
  };
}

// 1. The exact historical failure: populated takeoff, incoming {}.
{
  const result = evaluateTakeoffOverwrite({ aiPlanTakeoffJob: populatedJob() }, {});
  assert.equal(result.refuse, true, 'an empty incoming takeoff must be refused');
  assert.equal(result.reason, 'plan-pages-lost');
  assert.match(result.message, /Nothing was changed/);
}

// 2. Called with no argument at all - the default {} parameter must not wipe either.
{
  const result = evaluateTakeoffOverwrite({ aiPlanTakeoffJob: populatedJob() }, undefined);
  assert.equal(result.refuse, true, 'a missing incoming takeoff must be refused');
}

// 3. The takeoff hiding only in takeoffEngine must still be protected.
{
  const result = evaluateTakeoffOverwrite({ takeoffEngine: { aiPlanTakeoffJob: populatedJob() } }, {});
  assert.equal(result.refuse, true, 'takeoffEngine-only takeoffs must be protected');
  assert.equal(bestTakeoffCounts({ takeoffEngine: { aiPlanTakeoffJob: populatedJob() } }).renderablePlanPages, 2);
}

// 4. Plan kept but every traced item dropped is still a loss.
{
  const stripped = { ...populatedJob(), completedWallRuns: [], placedOpenings: [], completedAreas: [] };
  const result = evaluateTakeoffOverwrite({ aiPlanTakeoffJob: populatedJob() }, stripped);
  assert.equal(result.refuse, true, 'losing every traced item must be refused');
  assert.equal(result.reason, 'overlays-lost');
}

// 5. Ordinary edits must still save: adding, and deleting some but not all.
{
  const grown = { ...populatedJob(), completedWallRuns: [{ id: 'w1' }, { id: 'w2' }, { id: 'w3' }] };
  assert.equal(evaluateTakeoffOverwrite({ aiPlanTakeoffJob: populatedJob() }, grown).refuse, false);

  const trimmed = { ...populatedJob(), completedWallRuns: [{ id: 'w1' }], placedOpenings: [], completedAreas: [] };
  assert.equal(evaluateTakeoffOverwrite({ aiPlanTakeoffJob: populatedJob() }, trimmed).refuse, false,
    'partial deletion is legitimate work and must save');
}

// 6. The first save of a brand new takeoff has nothing to protect.
{
  assert.equal(evaluateTakeoffOverwrite({}, populatedJob()).refuse, false);
  assert.equal(evaluateTakeoffOverwrite({ aiPlanTakeoffJob: {} }, populatedJob()).refuse, false);
  assert.equal(evaluateTakeoffOverwrite({}, {}).refuse, false, 'empty to empty is not a loss');
}

// 7. Pages that carry no image data do not count as a plan, so they cannot be used to
//    smuggle an empty takeoff past the guard.
{
  const hollow = { ...populatedJob(), plan: { pages: [{ pageNumber: 1 }, { pageNumber: 2 }] }, completedWallRuns: [], placedOpenings: [], completedAreas: [] };
  assert.equal(evaluateTakeoffOverwrite({ aiPlanTakeoffJob: populatedJob() }, hollow).refuse, true);
}

// 8. Against the real recovered takeoff: it must be saveable, and the {} that replaced
//    it must be refused.
{
  const restored = path.resolve('E:/dev/funnel-builder-clean/recovery/RECOVERED-2026-09-09/restored-takeoff.json');
  if (fs.existsSync(restored)) {
    const job = JSON.parse(fs.readFileSync(restored, 'utf8')).aiPlanTakeoffJob;
    const counts = bestTakeoffCounts({ aiPlanTakeoffJob: job });
    assert.equal(counts.renderablePlanPages, 5, 'recovered takeoff should show 5 renderable pages');
    assert.equal(counts.walls, 39);
    assert.equal(counts.openings, 50);
    assert.equal(evaluateTakeoffOverwrite({ aiPlanTakeoffJob: job }, {}).refuse, true,
      'the historical wipe of New Job 03/09 must now be refused');
    assert.equal(evaluateTakeoffOverwrite({ aiPlanTakeoffJob: job }, job).refuse, false,
      're-saving the recovered takeoff unchanged must be allowed');
  } else {
    console.log('  (skipped case 8: restored-takeoff.json not present)');
  }
}

console.log('PASS: an empty or plan-less takeoff cannot overwrite a populated one, and ordinary edits still save.');
