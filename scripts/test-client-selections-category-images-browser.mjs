import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import {createClient} from '@supabase/supabase-js';
import {register} from 'node:module';

// Client Selections category cards: every card image loads (no broken placeholders), the five
// replaced cards use their local WebP assets with object-fit: cover, and no image request fails.
// Uses an isolated local job in the running app; cloud writes are blocked.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({path:path.join(root, '.env.local'), quiet:true});
dotenv.config({path:path.join(root, '.env'), quiet:true});
const origin = process.env.CLIENT_SELECTIONS_BASE_URL || 'http://localhost:3000';
const out = path.join(root, 'artifacts/test-artifacts/client-selections-category-images');
fs.mkdirSync(out, {recursive:true});
const EXPECTED = {
  'tiles-stone': '/images/client-selections/client-selections-tiles-stone.webp',
  flooring: '/images/client-selections/client-selections-flooring.webp',
  'paint-wall-finishes': '/images/client-selections/client-selections-paint-wall-finishes.webp',
  hvac: '/images/client-selections/client-selections-hvac.webp',
  'hot-water': '/images/client-selections/client-selections-hot-water.webp',
};
// The workbook defaults import JSON without an import attribute; supply it for this script only.
register('data:text/javascript,' + encodeURIComponent('export async function load(url, context, next) { return next(url, url.endsWith(".json") ? { ...context, importAttributes: { type: "json" } } : context); }'));
const {createEstimateBuilderWorkbookDefaults} = await import('../lib/construction-estimation/estimateBuilderWorkbookDefaults.js');
for (const asset of Object.values(EXPECTED)) assert.ok(fs.existsSync(path.join(root, 'public', asset)), `Asset exists: ${asset}`);

const projectId = `local-category-images-${Date.now()}`;
const defaults = createEstimateBuilderWorkbookDefaults();
for (const key of ['aiPlanTakeoffJob', 'takeoffEngine', 'takeoffSchedule', 'clientSelectionsBook']) delete defaults[key];
const jobName = 'Local category images regression';
const workbook = {...defaults, templateType:'job', page:'clientSelections', projectId, commercialProjectId:projectId, registeredJobId:projectId,
  registeredJob:{jobId:projectId, jobName, jobNumber:'LOCAL-IMAGES', clientName:'Local test client', siteAddress:'Local test address'},
  jobFileMeta:{projectId, jobName, jobNumber:'LOCAL-IMAGES', clientName:'Local test client', address:'Local test address'}};
const fixture = path.join(out, 'local-category-images-job.json');
fs.writeFileSync(fixture, JSON.stringify({projectId, jobName, workbook}));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
assert(url && anon && service, 'Existing test account authentication requires Supabase environment values.');
const admin = createClient(url, service, {auth:{persistSession:false}});
const {data:link, error:linkError} = await admin.auth.admin.generateLink({type:'magiclink', email:process.env.PRODUCT_LIBRARY_TEST_EMAIL || 'support@gr8result.com'});
if (linkError) throw linkError;
const authClient = createClient(url, anon, {auth:{persistSession:false}});
const {data:auth, error:authError} = await authClient.auth.verifyOtp({type:'magiclink', token_hash:link.properties.hashed_token});
if (authError) throw authError;

const report = {passed:false, route:`${origin}/modules/estimate-builder?page=clientSelections`, cards:{}, failedImageRequests:[], runtimeErrors:[], blockedCloudWrites:[]};
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const GUIDED_SCREENS = ['guided-client-selections-home', 'guided-interior-categories', 'guided-exterior-categories'].map(id => `[data-testid="${id}"]`).join(', ');
const browser = await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, protocolTimeout:180000, defaultViewport:{width:1920, height:1080}});
let page;
try {
  page = await browser.newPage();
  page.on('pageerror', error => report.runtimeErrors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  page.on('requestfailed', request => { if (request.resourceType() === 'image') report.failedImageRequests.push({url:request.url(), error:request.failure()?.errorText}); });
  page.on('response', response => { if (response.request().resourceType() === 'image' && response.status() >= 400) report.failedImageRequests.push({url:response.url(), status:response.status()}); });
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (/\/(rest|storage)\/v1\//.test(request.url()) && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      report.blockedCloudWrites.push({method:request.method(), path:new URL(request.url()).pathname});
      void request.abort();
    } else void request.continue();
  });
  await page.evaluateOnNewDocument(({key, session}) => localStorage.setItem(key, JSON.stringify(session)), {key:`sb-${new URL(url).hostname.split('.')[0]}-auth-token`, session:auth.session});
  await page.goto(report.route, {waitUntil:'domcontentloaded', timeout:180000});
  const input = await page.waitForSelector('[data-testid="open-local-job-file-input"]', {timeout:180000});
  await input.uploadFile(fixture);
  for (let attempt = 0; attempt < 10; attempt++) {
    await delay(600);
    const labels = await page.$$eval('button', buttons => buttons.filter(button => !button.disabled).map(button => button.innerText.trim()));
    const dialogLabels = ['Discard Changes', 'Open Job', 'Open Job File', 'Keep Local'].filter(label => labels.includes(label));
    for (const label of dialogLabels) await page.evaluate(text => [...document.querySelectorAll('button')].find(button => !button.disabled && button.innerText.trim() === text)?.click(), label);
    if (!dialogLabels.length && attempt >= 1 && await page.$(GUIDED_SCREENS)) break;
  }
  await page.waitForSelector('[data-testid="guided-client-selections-home"]', {timeout:60000});

  // Home area cards: Exterior uses the supplied local facade image; Interior is unchanged.
  await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="guided-client-selections-home"] .guidedImageCard img')].every((img) => img.complete), {timeout:60000});
  report.homeCards = await page.$$eval('[data-testid="guided-client-selections-home"] .guidedImageCard', (cards) => cards.map((card) => {
    const img = card.querySelector('img');
    return {key:card.dataset.categoryKey, src:img.getAttribute('src'), loaded:img.complete && img.naturalWidth > 0, naturalWidth:img.naturalWidth, naturalHeight:img.naturalHeight, objectFit:getComputedStyle(img).objectFit, renderedWidth:Math.round(img.getBoundingClientRect().width), renderedHeight:Math.round(img.getBoundingClientRect().height)};
  }));
  const exteriorCard = report.homeCards.find((card) => card.key === 'exterior');
  const interiorCard = report.homeCards.find((card) => card.key === 'interior');
  assert.deepEqual([exteriorCard.src, exteriorCard.loaded, exteriorCard.naturalWidth, exteriorCard.naturalHeight, exteriorCard.objectFit], ['/images/client-selections/exterior.png', true, 760, 507, 'cover'], 'Exterior card shows the supplied image, uncropped file, cover fit');
  assert.equal(interiorCard.src, 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=80', 'Interior card image unchanged');
  assert.ok(interiorCard.loaded);
  const homeExterior = await page.$('[data-testid="guided-client-selections-home"] [data-category-key="exterior"]');
  await homeExterior.screenshot({path:path.join(out, 'home-exterior-card.png')});
  await page.$eval('[data-testid="guided-client-selections-home"]', (element) => element.scrollIntoView());
  await page.screenshot({path:path.join(out, 'home.png')});

  for (const side of ['interior', 'exterior']) {
    if (!await page.$('[data-testid="guided-client-selections-home"]')) {
      await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.innerText.trim() === 'Back')?.click());
      await page.waitForSelector('[data-testid="guided-client-selections-home"]');
    }
    await page.$eval(`[data-testid="guided-client-selections-home"] [data-category-key="${side}"]`, element => element.click());
    const grid = `[data-testid="guided-${side}-categories"]`;
    await page.waitForSelector(grid);
    // Bring every card into view so lazy images load, then wait for decode.
    await page.$$eval(`${grid} .guidedImageCard`, cards => cards.forEach(card => card.scrollIntoView({block:'center'})));
    await page.waitForFunction(selector => [...document.querySelectorAll(`${selector} .guidedImageCard img`)].every(img => img.complete), {timeout:60000}, grid);
    await delay(500);
    const cards = await page.$$eval(`${grid} .guidedImageCard`, elements => elements.map(card => {
      const img = card.querySelector('img');
      const title = card.querySelector('.guidedImageCardTitle');
      const box = card.getBoundingClientRect();
      return {key:card.dataset.categoryKey, label:title?.innerText.trim(), src:img.getAttribute('src'), loaded:img.complete && img.naturalWidth > 0,
        naturalWidth:img.naturalWidth, naturalHeight:img.naturalHeight, objectFit:getComputedStyle(img).objectFit,
        titleBackground:getComputedStyle(title).backgroundColor, width:Math.round(box.width), height:Math.round(box.height)};
    }));
    report.cards[side] = cards;
    const broken = cards.filter(card => !card.loaded);
    assert.deepEqual(broken.map(card => card.key), [], `${side}: no broken card images`);
    assert.ok(!cards.some(card => /^data:image\/svg/.test(card.src)), `${side}: no generated placeholder card images`);
    await page.screenshot({path:path.join(out, `${side}-categories.png`), fullPage:true});
    for (const [key, asset] of Object.entries(EXPECTED)) {
      const card = cards.find(item => item.key === key);
      if (!card) continue;
      assert.equal(card.src, asset, `${key} uses its local asset`);
      assert.equal(card.naturalWidth, 1600, `${key} is high resolution`);
      assert.equal(card.objectFit, 'cover', `${key} uses object-fit: cover`);
      assert.equal(card.titleBackground, 'rgba(15, 118, 110, 0.76)', `${key} keeps the existing title overlay`);
      const element = await page.$(`${grid} [data-category-key="${key}"]`);
      await element.scrollIntoView();
      await element.screenshot({path:path.join(out, `card-${key}.png`)});
    }
  }
  const found = Object.keys(EXPECTED).filter(key => Object.values(report.cards).flat().some(card => card.key === key));
  assert.deepEqual(found.sort(), Object.keys(EXPECTED).sort(), 'All five replaced cards are rendered');
  assert.deepEqual(report.failedImageRequests, [], 'No failed image requests');
  assert.deepEqual(report.runtimeErrors, [], 'No runtime errors');
  report.passed = true;
  console.log('Client Selections category images passed:', found.map(key => `${key} ${Object.values(report.cards).flat().find(card => card.key === key).width}x${Object.values(report.cards).flat().find(card => card.key === key).height}`).join(', '));
} catch (error) {
  report.error = error.stack || String(error);
  if (page) await page.screenshot({path:path.join(out, 'failure.png'), fullPage:true}).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
