import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {register} from 'node:module';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import {createClient} from '@supabase/supabase-js';

// Stair configuration in the running app: lower ceiling height + floor system thickness imported
// from Job Setup, floor-to-floor and risers calculated (stairGeometry.js), override + reset without
// touching Job Setup, and a Job Setup change flowing into the stair. Isolated local job.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent('export async function load(url, context, next) { return next(url, url.endsWith(".json") ? { ...context, importAttributes: { type: "json" } } : context); }'));
const {createEstimateBuilderWorkbookDefaults} = await import('../lib/construction-estimation/estimateBuilderWorkbookDefaults.js');
dotenv.config({path:path.join(root, '.env.local'), quiet:true});
dotenv.config({path:path.join(root, '.env'), quiet:true});
const origin = process.env.CLIENT_SELECTIONS_BASE_URL || 'http://localhost:3000';
const out = path.join(root, 'artifacts/test-artifacts/stair-height');
fs.mkdirSync(out, {recursive:true});
const projectId = `local-stair-height-${Date.now()}`;
const jobName = 'Local stair height regression';

function fixture(name, values) {
  const defaults = createEstimateBuilderWorkbookDefaults();
  for (const key of ['aiPlanTakeoffJob', 'takeoffEngine', 'takeoffSchedule', 'clientSelectionsBook']) delete defaults[key];
  const set = (section, key, value) => { defaults.data[section] = defaults.data[section] || {rows:{}}; defaults.data[section].rows = defaults.data[section].rows || {}; defaults.data[section].rows[key] = {...(defaults.data[section].rows[key] || {}), value}; };
  set('projectSetup', 'floorCount', 'Two Storey');
  set('inputDataSheet', 'lowerCeilingHeight', values.ceiling);
  set('inputDataSheet', 'upperFloorDepthMm', values.floor);
  const workbook = {...defaults, templateType:'job', page:'clientSelections', projectId, commercialProjectId:projectId, registeredJobId:projectId,
    registeredJob:{jobId:projectId, jobName, jobNumber:'LOCAL-STAIR', clientName:'Local test client', siteAddress:'Local test address'},
    jobFileMeta:{projectId, jobName, jobNumber:'LOCAL-STAIR', clientName:'Local test client', address:'Local test address'}};
  const file = path.join(out, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify({projectId, jobName, workbook}));
  return file;
}
const original = fixture('job-2740-319', {ceiling:'2740', floor:'319mm Timber Floor System (300mm I Beams & 19mm Sheet Flooring)'});
const changed = fixture('job-2590-379', {ceiling:'2590', floor:'379mm Timber Floor System (360mm I Beams & 19mm Sheet Flooring)'});

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY, {auth:{persistSession:false}});
const {data:link, error:linkError} = await admin.auth.admin.generateLink({type:'magiclink', email:process.env.PRODUCT_LIBRARY_TEST_EMAIL || 'support@gr8result.com'});
if (linkError) throw linkError;
const authClient = createClient(url, anon, {auth:{persistSession:false}});
const {data:auth, error:authError} = await authClient.auth.verifyOtp({type:'magiclink', token_hash:link.properties.hashed_token});
if (authError) throw authError;

const report = {passed:false, steps:{}, runtimeErrors:[], blockedCloudWrites:[]};
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const browser = await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, protocolTimeout:180000, defaultViewport:{width:1600, height:1100}});
let page;
const text = (id) => page.$eval(`[data-testid="${id}"]`, (element) => element.innerText.trim());
const value = (id) => page.$eval(`[data-testid="${id}"] input`, (element) => element.value);
async function loadJob(file) {
  const input = await page.waitForSelector('[data-testid="open-local-job-file-input"]', {timeout:180000});
  await input.uploadFile(file);
  for (let attempt = 0; attempt < 12; attempt++) {
    await delay(600);
    const labels = await page.$$eval('button', (buttons) => buttons.filter((button) => !button.disabled).map((button) => button.innerText.trim()));
    const dialog = ['Discard Changes', 'Open Job', 'Open Job File', 'Keep Local'].filter((label) => labels.includes(label));
    for (const label of dialog) await page.evaluate((t) => [...document.querySelectorAll('button')].find((button) => !button.disabled && button.innerText.trim() === t)?.click(), label);
    if (!dialog.length && attempt >= 1 && await page.$('[data-testid="guided-client-selections-home"], [data-testid="stair-selection-wizard"], [data-testid="guided-interior-categories"]')) break;
  }
}
async function openStairs() {
  for (let guard = 0; guard < 6 && !(await page.$('[data-testid="guided-client-selections-home"]')); guard++) {
    await page.evaluate(() => [...document.querySelectorAll('button')].find((button) => /^(← |)?(Back|← Stairs & Balustrades|← Interior)$/.test(button.innerText.trim()) || button.dataset.testid === 'stair-back')?.click());
    await delay(700);
  }
  await page.$eval('[data-testid="guided-client-selections-home"] [data-category-key="interior"]', (element) => element.click());
  await page.waitForSelector('[data-category-key="stairs-balustrades"]');
  await page.$eval('[data-category-key="stairs-balustrades"]', (element) => element.click());
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some((button) => button.innerText.trim() === 'View Stairs'), {timeout:30000});
  await page.evaluate(() => [...document.querySelectorAll('button')].find((button) => button.innerText.trim() === 'View Stairs').click());
  await page.waitForSelector('[data-testid="stair-selection-wizard"]');
  if (!(await page.$('[data-testid="stair-height-panel"][data-flight]'))) {
    await page.$eval('[data-testid="stair-type-card"]', (element) => element.click());
    await page.waitForSelector('[data-testid="stair-height-panel"][data-flight]');
  }
  await delay(400);
}
async function typeInto(id, next) {
  const input = await page.$(`[data-testid="${id}"] input`);
  await input.click({clickCount:3});
  await input.type(String(next));
  await delay(300);
}

try {
  page = await browser.newPage();
  page.on('pageerror', (error) => report.runtimeErrors.push(error.message));
  page.on('dialog', (dialog) => dialog.accept());
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    if (/\/(rest|storage)\/v1\//.test(request.url()) && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) { report.blockedCloudWrites.push(new URL(request.url()).pathname); void request.abort(); }
    else void request.continue();
  });
  await page.evaluateOnNewDocument(({key, session}) => localStorage.setItem(key, JSON.stringify(session)), {key:`sb-${new URL(url).hostname.split('.')[0]}-auth-token`, session:auth.session});
  await page.goto(`${origin}/modules/estimate-builder?page=clientSelections`, {waitUntil:'domcontentloaded', timeout:180000});
  await loadJob(original);
  await openStairs();

  // 1-6: imported values and the calculation
  report.steps.imported = {ceiling:await value('stair-ceiling-height'), ceilingSource:await text('stair-ceiling-height-source'), floor:await value('stair-floor-thickness'), floorSource:await text('stair-floor-thickness-source'), f2f:await text('stair-floor-to-floor'), max:await text('stair-max-riser'), risers:await text('stair-riser-count'), height:await text('stair-riser-height'), summary:await text('stair-riser-summary')};
  assert.deepEqual(report.steps.imported, {ceiling:'2740', ceilingSource:'Imported from Job Setup', floor:'319', floorSource:'Imported from Job Setup', f2f:'3059 mm', max:'190 mm', risers:'17', height:'179.9 mm', summary:'17 risers @ 179.9mm'});
  assert.match(await text('stair-height-panel'), /Calculated from: 2740mm ceiling height \+ 319mm floor system/);
  assert.equal(await page.$('input[aria-label="Number of risers"]'), null, 'risers are no longer typed in');
  assert.equal(await page.$('input[aria-label="Floor-to-floor height (mm)"]'), null, 'floor-to-floor is no longer typed in');
  await page.screenshot({path:path.join(out, '01-imported.png'), fullPage:true});

  // 8: manual override of the floor thickness, then reset
  await typeInto('stair-floor-thickness', 335);
  report.steps.override = {source:await text('stair-floor-thickness-source'), f2f:await text('stair-floor-to-floor'), summary:await text('stair-riser-summary'), reset:await text('stair-floor-thickness-reset')};
  assert.deepEqual(report.steps.override, {source:'Manual override', f2f:'3075 mm', summary:'17 risers @ 180.9mm', reset:'Reset to Job Setup: 319mm'});
  await page.screenshot({path:path.join(out, '02-override.png'), fullPage:true});
  await page.$eval('[data-testid="stair-floor-thickness-reset"]', (element) => element.click());
  await delay(300);
  assert.equal(await value('stair-floor-thickness'), '319');
  assert.equal(await text('stair-floor-thickness-source'), 'Imported from Job Setup');
  assert.equal(await text('stair-riser-summary'), '17 risers @ 179.9mm');

  // keep an override on the ceiling height, then change Job Setup (reload the job with new values)
  await typeInto('stair-ceiling-height', 2700);
  assert.equal(await text('stair-ceiling-height-source'), 'Manual override');
  await delay(500); // draft saved
  await loadJob(changed);
  await openStairs();
  report.steps.afterJobSetupChange = {ceiling:await value('stair-ceiling-height'), ceilingSource:await text('stair-ceiling-height-source'), ceilingReset:await text('stair-ceiling-height-reset'), floor:await value('stair-floor-thickness'), floorSource:await text('stair-floor-thickness-source'), f2f:await text('stair-floor-to-floor'), summary:await text('stair-riser-summary')};
  // floor system follows the new Job Setup (379); the stair's own ceiling override (2700) is kept,
  // and its reset now offers the new Job Setup value (2590).
  assert.deepEqual(report.steps.afterJobSetupChange, {ceiling:'2700', ceilingSource:'Manual override', ceilingReset:'Reset to Job Setup: 2590mm', floor:'379', floorSource:'Imported from Job Setup', f2f:'3079 mm', summary:'17 risers @ 181.1mm'});
  await page.$eval('[data-testid="stair-ceiling-height-reset"]', (element) => element.click());
  await delay(300);
  report.steps.afterReset = {f2f:await text('stair-floor-to-floor'), risers:await text('stair-riser-count'), summary:await text('stair-riser-summary')};
  assert.deepEqual(report.steps.afterReset, {f2f:'2969 mm', risers:'16', summary:'16 risers @ 185.6mm'}, '2590 + 379 = 2969 -> 16 risers');
  await page.screenshot({path:path.join(out, '03-after-job-setup-change.png'), fullPage:true});

  assert.deepEqual(report.runtimeErrors, [], 'no runtime errors');
  report.passed = true;
  console.log('Stair height passed: 2740 + 319 = 3059mm -> 17 risers @ 179.9mm imported from Job Setup; override + reset; Job Setup change (2590 + 379 = 2969 -> 16 risers) with stair override kept until reset.');
} catch (error) {
  report.error = error.stack || String(error);
  if (page) await page.screenshot({path:path.join(out, 'failure.png'), fullPage:true}).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
