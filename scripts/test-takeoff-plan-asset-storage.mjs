import assert from 'node:assert/strict';
import fs from 'node:fs';
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', request => request.respond({ status: 200, contentType: 'text/html', body: '<title>Isolated synthetic storage test</title>' }));
  await page.goto('http://127.0.0.1:39123/recovery-storage-fixture');
  // A data: module cannot resolve relative imports, so planBlobStorage's one dependency is inlined ahead of it.
  const source = fs.readFileSync('lib/construction-estimation/knownAssetIds.js', 'utf8') + '\n'
    + fs.readFileSync('components/construction-estimation/ai-plan-takeoff/planBlobStorage.js', 'utf8').replace(/^import \{[^}]*\} from '[^']*knownAssetIds\.js';$/m, '');
  const result = await page.evaluate(async source => {
    const { externalizeTakeoffPlanPages: encode, materializeTakeoffPlanPages: decode, externalizeTakeoffRecoverySnapshot } = await import('data:text/javascript;base64,' + btoa(source));
    const pages = Array.from({ length: 5 }, (_, i) => ({ pageNumber: i + 1, width: 10, height: 10, dataUrl: `data:image/png;base64,c3ludGhldGlj${i}` }));
    const job = { takeoffId: 'synthetic', plan: { pages }, revision: 1 };
    const artwork = `data:image/png;base64,${'A'.repeat(2_000_000)}`;
    const projectEstimateBuilder = { pages: [{ baseArtwork: artwork, design: { backgroundImageUrl: artwork }, importedDocument: { baseArtwork: artwork }, blocks: [{ text: 'Keep all quotation content' }] }] };
    const input = { aiPlanTakeoffJob: job, takeoffEngine: { aiPlanTakeoffJob: job }, projectEstimateBuilder };
    const first = await encode(input);
    const second = await encode({ ...input, aiPlanTakeoffJob: { ...job, revision: 2 } });
    const restored = await decode(second);
    const snapshot = await externalizeTakeoffRecoverySnapshot({ portableTakeoff: { plan: job.plan, takeoffData: job, takeoffJob: job } });
    const db = await new Promise(resolve => { const req = indexedDB.open('gr8-takeoff-plan-assets-v1'); req.onsuccess = () => resolve(req.result); });
    const assetCount = await new Promise(resolve => { const req = db.transaction('blobs').objectStore('blobs').count(); req.onsuccess = () => resolve(req.result); });
    db.close();
    // A job whose plan image is not in this browser's asset store still opens (V1, 6 Nov 2026): the page keeps
    // its asset id unchanged (so a later save keeps the reference) and only the image is absent.
    let missingFails = false;
    try {
      const opened = await decode({ aiPlanTakeoffJob: { plan: { pages: [{ pageNumber: 1, dataUrlAssetId: 'missing-test-asset' }] } } });
      const kept = opened.aiPlanTakeoffJob.plan.pages[0];
      missingFails = kept.dataUrlAssetId === 'missing-test-asset' && !kept.dataUrl;
    } catch { missingFails = false; }
    return {
      assetCount, missingFails,
      artworkRoundTrip: JSON.stringify(restored.projectEstimateBuilder) === JSON.stringify(projectEstimateBuilder),
      artworkUnchanged: input.projectEstimateBuilder.pages[0].baseArtwork === artwork,
      compactArtwork: JSON.stringify(second.projectEstimateBuilder).length < 1000,
      snapshotRefsOnly: !JSON.stringify(snapshot).includes('data:image'),
      roundTrip: restored.aiPlanTakeoffJob.plan.pages.every((page, i) => page.dataUrl === pages[i].dataUrl),
      originalsPreserved: input.aiPlanTakeoffJob.plan.pages.every(page => Boolean(page.dataUrl) && !page.dataUrlAssetId),
      refsOnly: !JSON.stringify(first).includes('data:image') && !JSON.stringify(second).includes('data:image'),
      sameAsset: first.aiPlanTakeoffJob.plan.pages[0].dataUrlAssetId === second.aiPlanTakeoffJob.plan.pages[0].dataUrlAssetId,
    };
  }, source);
  assert.equal(result.assetCount, 6);
  for (const key of ['missingFails', 'roundTrip', 'originalsPreserved', 'refsOnly', 'sameAsset', 'snapshotRefsOnly', 'artworkRoundTrip', 'artworkUnchanged', 'compactArtwork']) assert.equal(result[key], true, key);
  console.log('Plan storage passed:', JSON.stringify(result));
} finally { await browser.close(); }
