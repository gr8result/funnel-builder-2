// A job file carried to another machine embeds its plan images but still carries the
// dataUrlAssetId from wherever it was saved. Opening it must use the embedded image,
// not look up an asset this browser profile has never held.

import assert from 'node:assert/strict';
import Module from 'node:module';

// planBlobStorage reaches for indexedDB/crypto at call time; fail loudly if the
// materialise path touches the asset store when it should not have to.
let assetReads = 0;
globalThis.indexedDB = {
  open() {
    assetReads += 1;
    throw new Error('asset store must not be opened for a page that already carries its image');
  },
};

const { materializeTakeoffPlanPages } = await import('../components/construction-estimation/ai-plan-takeoff/planBlobStorage.js');

const IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function pageFrom(other) { return { pageNumber: 1, width: 2677, height: 3789, ...other }; }

// 1. Foreign job file: image embedded AND a stale asset id from the machine that saved it.
{
  assetReads = 0;
  const workbook = {
    aiPlanTakeoffJob: {
      plan: { pages: [pageFrom({ dataUrl: IMAGE, dataUrlAssetId: 'deadbeef'.repeat(8) })] },
    },
  };
  const out = await materializeTakeoffPlanPages(workbook);
  assert.equal(assetReads, 0, 'must not open the asset store when the page already has its image');
  assert.equal(out.aiPlanTakeoffJob.plan.pages[0].dataUrl, IMAGE, 'the embedded image must survive');
}

// 2. Pages with no image still resolve through the asset store (unchanged behaviour).
{
  assetReads = 0;
  const workbook = {
    aiPlanTakeoffJob: { plan: { pages: [pageFrom({ dataUrlAssetId: 'abc123'.repeat(8) })] } },
  };
  await assert.rejects(
    materializeTakeoffPlanPages(workbook),
    /asset store must not be opened/,
    'a page without an image must still be resolved from the asset store',
  );
  assert.equal(assetReads, 1, 'externalised pages still go to the asset store');
}

// 3. The takeoffEngine copy is materialised on the same terms.
{
  assetReads = 0;
  const job = { plan: { pages: [pageFrom({ dataUrl: IMAGE, dataUrlAssetId: 'f0'.repeat(32) })] } };
  const out = await materializeTakeoffPlanPages({ aiPlanTakeoffJob: job, takeoffEngine: { aiPlanTakeoffJob: job } });
  assert.equal(assetReads, 0);
  assert.equal(out.takeoffEngine.aiPlanTakeoffJob.plan.pages[0].dataUrl, IMAGE);
}

console.log('PASS: a job file opened on another machine renders its plans from the embedded images.');
