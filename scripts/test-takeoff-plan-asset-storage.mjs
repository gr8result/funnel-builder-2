import assert from 'node:assert/strict';
import fs from 'node:fs';
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', request => request.respond({ status: 200, contentType: 'text/html', body: '<title>Isolated synthetic storage test</title>' }));
  await page.goto('http://localhost:3000/recovery-storage-fixture');
  const source = fs.readFileSync('components/construction-estimation/ai-plan-takeoff/planBlobStorage.js', 'utf8');
  const result = await page.evaluate(async source => {
    const { externalizeTakeoffPlanPages: encode, materializeTakeoffPlanPages: decode, externalizeTakeoffRecoverySnapshot } = await import('data:text/javascript;base64,' + btoa(source));
    const pages = Array.from({ length: 5 }, (_, i) => ({ pageNumber: i + 1, width: 10, height: 10, dataUrl: `data:image/png;base64,c3ludGhldGlj${i}` }));
    const job = { takeoffId: 'synthetic', plan: { pages }, revision: 1 };
    const input = { aiPlanTakeoffJob: job, takeoffEngine: { aiPlanTakeoffJob: job } };
    const first = await encode(input);
    const second = await encode({ ...input, aiPlanTakeoffJob: { ...job, revision: 2 } });
    const restored = await decode(second);
    const snapshot = await externalizeTakeoffRecoverySnapshot({ portableTakeoff: { plan: job.plan, takeoffData: job, takeoffJob: job } });
    const db = await new Promise(resolve => { const req = indexedDB.open('gr8-takeoff-plan-assets-v1'); req.onsuccess = () => resolve(req.result); });
    const assetCount = await new Promise(resolve => { const req = db.transaction('blobs').objectStore('blobs').count(); req.onsuccess = () => resolve(req.result); });
    db.close();
    let missingFails = false;
    try { await decode({ aiPlanTakeoffJob: { plan: { pages: [{ dataUrlAssetId: 'missing-test-asset' }] } } }); } catch { missingFails = true; }
    return {
      assetCount, missingFails,
      snapshotRefsOnly: !JSON.stringify(snapshot).includes('data:image'),
      roundTrip: restored.aiPlanTakeoffJob.plan.pages.every((page, i) => page.dataUrl === pages[i].dataUrl),
      originalsPreserved: input.aiPlanTakeoffJob.plan.pages.every(page => Boolean(page.dataUrl) && !page.dataUrlAssetId),
      refsOnly: !JSON.stringify(first).includes('data:image') && !JSON.stringify(second).includes('data:image'),
      sameAsset: first.aiPlanTakeoffJob.plan.pages[0].dataUrlAssetId === second.aiPlanTakeoffJob.plan.pages[0].dataUrlAssetId,
    };
  }, source);
  assert.equal(result.assetCount, 5);
  for (const key of ['missingFails', 'roundTrip', 'originalsPreserved', 'refsOnly', 'sameAsset', 'snapshotRefsOnly']) assert.equal(result[key], true, key);
  console.log('Plan storage passed:', JSON.stringify(result));
} finally { await browser.close(); }
