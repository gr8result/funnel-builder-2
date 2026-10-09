import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import {createClient} from '@supabase/supabase-js';
import {createEstimateBuilderWorkbookDefaults} from '../lib/construction-estimation/estimateBuilderWorkbookDefaults.js';
import {JobStore} from '../lib/job-storage/jobStore.js';
import {RemoteJobClient} from '../lib/job-storage/jobClient.js';
import {FileSystemStorageProvider} from '../lib/job-storage/fileSystemProvider.js';

// Shared Storage in the REAL application screens, with two independent users: two separate
// browser instances (separate profiles, nothing shared between them) and the builder's job server
// as its own process on a storage folder. Storage Settings (mode, connection test, status), a job
// shared by saving it, opened by the second user, a stale save refused, different jobs kept apart.
// Isolated local jobs; Supabase writes are blocked.
// Usage: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-shared-storage-app-browser.mjs
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({path:path.join(root, '.env.local'), quiet:true});
dotenv.config({path:path.join(root, '.env'), quiet:true});
const origin = process.env.CLIENT_SELECTIONS_BASE_URL || 'http://localhost:3000';
const out = path.join(root, 'artifacts/test-artifacts/shared-storage-app-browser');
fs.mkdirSync(out, {recursive:true});
const stamp = Date.now();
function fixtureFor(letter, rooms) {
  const projectId = `local-shared-${letter.toLowerCase()}-${stamp}`;
  const defaults = createEstimateBuilderWorkbookDefaults();
  for (const key of ['aiPlanTakeoffJob', 'takeoffEngine', 'takeoffSchedule', 'clientSelectionsBook']) delete defaults[key];
  const jobName = `Shared Job ${letter}`;
  const workbook = {...defaults, templateType:'job', page:'clientSelections', projectId, commercialProjectId:projectId, registeredJobId:projectId,
    registeredJob:{jobId:projectId, jobName, jobNumber:`SH-${letter}`, clientName:`Client ${letter}`, siteAddress:`${letter} Street`},
    jobFileMeta:{projectId, jobName, jobNumber:`SH-${letter}`, clientName:`Client ${letter}`, address:`${letter} Street`},
    aiPlanTakeoffJob:{placedOpenings:rooms.map(([roomKey, roomLabel], index) => ({id:`opening-${index}`, openingType:'window', roomKey, roomLabel, location:roomLabel}))}};
  const file = path.join(out, `job-${letter}.json`);
  fs.writeFileSync(file, JSON.stringify({projectId, jobName, workbook}));
  return {letter, projectId, jobName, file};
}
const A = fixtureFor('A', [['kitchen', 'Kitchen'], ['bed-1', 'Bed 1'], ['family', 'Family']]);
const B = fixtureFor('B', [['kitchen', 'Kitchen'], ['other', 'Study']]);

// The builder's installation: a storage folder, one company, two staff and an administrator.
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'gr8-shared-app-'));
const seed = new JobStore({provider:new FileSystemStorageProvider({root:path.join(data, 'objects'), kind:'office-server'}), databasePath:path.join(data, 'job-store.sqlite')});
const company = seed.createCompany({name:'Test Builder'});
const staff = ['Alex', 'Sam'].map(name => seed.createUser({companyId:company.id, name, role:'member'}));
const adminAccount = seed.createUser({companyId:company.id, name:'Admin', role:'admin'});
seed.close();
const server = spawn(process.execPath, [path.join(root, 'scripts/job-storage-server.mjs'), 'serve', '--data', data, '--port', '0', '--allow-origin', origin], {stdio:['ignore', 'pipe', 'inherit', 'ipc']});
const port = await new Promise((resolve, reject) => { server.on('message', message => resolve(message.listening)); server.on('exit', () => reject(new Error('job server exited'))); });
const serverUrl = `http://127.0.0.1:${port}`;
const admin = new RemoteJobClient({baseUrl:serverUrl, token:adminAccount.token, companyId:company.id});

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
assert(url && anon && service, 'Existing test account authentication requires Supabase environment values.');
const supabaseAdmin = createClient(url, service, {auth:{persistSession:false}});
async function session() {
  const {data:link, error:linkError} = await supabaseAdmin.auth.admin.generateLink({type:'magiclink', email:process.env.PRODUCT_LIBRARY_TEST_EMAIL || 'support@gr8result.com'});
  if (linkError) throw linkError;
  const {data:auth, error:authError} = await createClient(url, anon, {auth:{persistSession:false}}).auth.verifyOtp({type:'magiclink', token_hash:link.properties.hashed_token});
  if (authError) throw authError;
  return auth.session;
}
const report = {passed:false, steps:{}, runtimeErrors:[]};
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const selector = testId => `[data-testid="${testId}"]`;
const HOME = selector('guided-client-selections-home');
const INTERIOR = selector('guided-interior-categories');
const OVERVIEW = selector('electrical-schedule');
const EDITOR = selector('electrical-room-editor');
const GUIDED = [HOME, INTERIOR, selector('guided-exterior-categories'), OVERVIEW, EDITOR].join(', ');
const route = `${origin}/modules/estimate-builder?page=clientSelections`;
const SETTINGS = `${origin}/modules/estimate-builder/storage-settings`;
const browsers = [];

// One user = one browser instance with its own profile.
async function user(account) {
  const browser = await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, protocolTimeout:180000, defaultViewport:{width:1600, height:1000}});
  browsers.push(browser);
  const page = await browser.newPage();
  page.setDefaultTimeout(90000);
  page.on('pageerror', error => report.runtimeErrors.push(`${account.user.name}: ${error.message}`));
  page.on('console', message => { if (/shared|conflict|job save|storage/i.test(message.text()) && /warn|error/.test(message.type())) (report.consoleNotes ||= []).push(`${account.user.name}: ${message.text().slice(0, 260)}`); });
  page.on('dialog', dialog => dialog.accept());
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (/\/(rest|storage)\/v1\//.test(request.url()) && !request.url().startsWith(serverUrl) && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) void request.abort();
    else void request.continue();
  });
  const auth = await session();
  await page.evaluateOnNewDocument(({key, value}) => localStorage.setItem(key, JSON.stringify(value)), {key:`sb-${new URL(url).hostname.split('.')[0]}-auth-token`, value:auth});
  return {page, account, name:account.user.name};
}
const click = (page, sel) => page.$eval(sel, element => element.click());
async function loadJob(page, file) {
  await page.goto(route, {waitUntil:'domcontentloaded', timeout:180000});
  const input = await page.waitForSelector(selector('open-local-job-file-input'));
  await input.uploadFile(file);
  for (let attempt = 0; attempt < 10; attempt++) {
    await delay(500);
    const labels = await page.$$eval('button', buttons => buttons.filter(button => !button.disabled).map(button => button.innerText.trim()));
    const dialogs = ['Discard Changes', 'Open Job', 'Open Job File', 'Keep Local'].filter(text => labels.includes(text));
    for (const text of dialogs) await page.evaluate(value => [...document.querySelectorAll('button')].find(button => !button.disabled && button.innerText.trim() === value)?.click(), text);
    if (!dialogs.length && attempt >= 1 && await page.$(GUIDED)) return;
  }
  await page.waitForSelector(GUIDED);
}
async function openElectrical(page) {
  for (let guard = 0; guard < 12 && !await page.$(OVERVIEW); guard++) {
    if (await page.$(EDITOR)) await click(page, selector('electrical-all-rooms'));
    else if (await page.$(INTERIOR)) await click(page, `${INTERIOR} [data-category-key="electrical-technology"]`);
    else if (await page.$(HOME)) await click(page, `${HOME} [data-category-key="interior"]`);
    else if (!page.url().includes('page=clientSelections')) { await page.goto(`${route}&jobId=${new URL(page.url()).searchParams.get('jobId') || ''}`, {waitUntil:'domcontentloaded'}); await page.waitForSelector(GUIDED, {timeout:120000}).catch(() => {}); }
    else await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.innerText.trim() === 'Back')?.click());
    await delay(900);
  }
  await page.waitForSelector(OVERVIEW);
}
async function setRoom(page, room, quantity) {
  await openElectrical(page);
  await click(page, `${selector('electrical-room')}[data-room="${room}"] ${selector('electrical-room-edit')}`);
  await page.waitForFunction((sel, name) => document.querySelector(sel)?.dataset.room === name, {}, EDITOR, room);
  const value = () => page.$eval(selector('electrical-qty-double-gpo'), input => Number(input.value));
  for (let guard = 0; guard < 60 && await value() !== quantity; guard++) await click(page, selector(`electrical-qty-double-gpo-${await value() < quantity ? 'plus' : 'minus'}`));
  await click(page, selector('electrical-save-next'));
  await page.waitForFunction(() => /saved|failed/.test(document.querySelector('[data-testid="electrical-save-state"]')?.className || ''), {timeout:120000});
  return page.$eval(selector('electrical-save-state'), element => (element.classList.contains('saved') ? 'saved' : 'failed'));
}
const roomText = (page, room) => page.$eval(`${selector('electrical-room')}[data-room="${room}"]`, card => card.innerText.replace(/\s+/g, ' '));
// Storage Settings: choose Shared, enter the server, test, save.
async function connect({page, account}, {token = account.token, address = serverUrl} = {}) {
  await page.goto(SETTINGS, {waitUntil:'domcontentloaded', timeout:180000});
  await page.waitForSelector(selector('storage-settings'));
  await click(page, `${selector('storage-mode-shared')} input`);
  await page.waitForSelector(selector('storage-shared-form'));
  for (const [field, value] of [['storage-server-url', address], ['storage-company-id', company.id], ['storage-token', token]]) { await page.$eval(selector(field), input => { input.focus(); input.select(); }); await page.keyboard.press('Backspace'); await page.type(selector(field), value); }
}
// The job as the shared server holds it: { revision, by, points }.
async function sharedJob(jobId) {
  const found = await admin.open(jobId);
  if (!found) return null;
  const row = (found.workbook.clientSelectionsBook?.rooms || []).flatMap(room => room.rows || []).find(item => item.guidedSelection?.electricalSchedule);
  const points = Object.fromEntries((row?.guidedSelection.electricalSchedule.rooms || []).filter(room => room.points?.['double-gpo']).map(room => [room.room, room.points['double-gpo']]));
  const history = await admin.history(jobId);
  return {revision:found.revision, by:history[0].createdByName, writers:[...new Set(history.map(entry => entry.createdByName))], points, name:found.workbook.registeredJob?.jobName};
}
async function sharedWhen(jobId, predicate) {
  let job;
  for (let attempt = 0; attempt < 90; attempt++) { job = await sharedJob(jobId).catch(() => null); if (job && predicate(job)) return job; await delay(700); }
  return job;
}
const quiet = async (jobId) => { let last = -1, since = Date.now(); for (;;) { const revision = (await sharedJob(jobId))?.revision ?? 0; if (revision !== last) { last = revision; since = Date.now(); } if (Date.now() - since > 7000) return last; await delay(800); } };

try {
  const alex = await user(staff[0]);
  const sam = await user(staff[1]);

  // 1 - a new installation is Local Only, and says so
  await loadJob(alex.page, A.file);
  const status0 = await alex.page.$eval(selector('storage-status'), element => ({text:element.innerText.trim(), shared:element.dataset.shared}));
  assert.deepEqual(status0, {text:'Storage: Local only', shared:'false'});
  assert.equal(await admin.open(A.projectId), null, 'nothing is sent anywhere in Local Only mode');

  // 2 - Storage Settings: address rules, a refused token, then a proven connection
  await connect(alex, {address:'http://jobs.example.com:4780'});
  assert(/must use https:\/\//.test(await alex.page.$eval(selector('storage-address-check'), note => note.innerText)), 'plain HTTP to an internet address is refused');
  assert(await alex.page.$eval(selector('storage-test'), button => button.disabled), 'and cannot even be tested');
  await connect(alex, {token:'gr8_not-a-real-token'});
  await click(alex.page, selector('storage-test'));
  await alex.page.waitForSelector(selector('storage-test-result'));
  assert(/refused this access token/.test(await alex.page.$eval(selector('storage-test-result'), note => note.innerText)));
  await click(alex.page, selector('storage-save'));
  await alex.page.waitForSelector(selector('storage-message'));
  assert.equal(await alex.page.$eval(selector('storage-settings'), element => element.dataset.mode), 'local', 'Shared Storage is not switched on by a connection that failed its test');
  await connect(alex);
  await click(alex.page, selector('storage-test'));
  await alex.page.waitForFunction(() => /Connected as Alex/.test(document.querySelector('[data-testid="storage-test-result"]')?.innerText || ''));
  const tested = await alex.page.$eval(selector('storage-test-result'), note => note.innerText);
  assert(/Connected as Alex \(member\)/.test(tested) && /Office server/.test(tested), tested);
  await click(alex.page, selector('storage-save'));
  await alex.page.waitForFunction(() => document.querySelector('[data-testid="storage-settings"]')?.dataset.mode === 'shared');
  assert(/Shared Storage - multi-user · signed in as Alex/.test(await alex.page.$eval(selector('storage-current-mode'), element => element.innerText)));
  assert.equal(await admin.open(A.projectId), null, 'switching mode moved nothing by itself');
  await alex.page.screenshot({path:path.join(out, '01-storage-settings.png')});
  report.steps.settings = {connected:tested};

  // 3 - Alex saves a selection: the job is now in the builder's shared storage, under its own id
  await alex.page.goto(`${route}&jobId=${A.projectId}`, {waitUntil:'domcontentloaded'});
  await alex.page.waitForSelector(GUIDED, {timeout:120000});
  assert.equal(await setRoom(alex.page, 'Kitchen', 6), 'saved');
  let shared = await sharedWhen(A.projectId, job => job.points.Kitchen === 6);
  assert.deepEqual([shared.name, shared.points, shared.writers], ['Shared Job A', {Kitchen:6}, ['Alex']]);
  await alex.page.waitForFunction(() => Number(document.querySelector('[data-testid="storage-status"]')?.dataset.revision) > 0);
  assert(/^Shared · revision \d+$/.test(await alex.page.$eval(selector('storage-status'), element => element.innerText.trim())));
  report.steps.shareBySaving = shared;

  // 4 - Sam, on another computer, opens the job from shared storage and sees Alex's work
  await sam.page.goto(route, {waitUntil:'domcontentloaded', timeout:180000});   // signed in to the workspace, as any user is
  await sam.page.waitForSelector(selector('open-local-job-file-input'));
  await connect(sam);
  await click(sam.page, selector('storage-save'));
  await sam.page.waitForFunction(() => document.querySelector('[data-testid="storage-settings"]')?.dataset.mode === 'shared');
  await quiet(A.projectId);
  await click(sam.page, selector('storage-refresh-jobs'));
  await sam.page.waitForSelector(`${selector('storage-shared-job')}[data-job-id="${A.projectId}"]`);
  assert(/Shared Job A/.test(await sam.page.$eval(`${selector('storage-shared-job')}[data-job-id="${A.projectId}"]`, row => row.innerText)));
  await Promise.all([sam.page.waitForNavigation({waitUntil:'domcontentloaded', timeout:120000}), click(sam.page, `${selector('storage-shared-job')}[data-job-id="${A.projectId}"] ${selector('storage-open-job')}`)]);
  assert.equal(new URL(sam.page.url()).searchParams.get('jobId'), A.projectId, 'the job opens under its own id');
  await openElectrical(sam.page);
  assert(/6 powerpoints/.test(await roomText(sam.page, 'Kitchen')), "Sam sees the Kitchen quantity Alex saved");
  // ... and saves his own change
  assert.equal(await setRoom(sam.page, 'Family', 4), 'saved');
  shared = await sharedWhen(A.projectId, job => job.points.Family === 4);
  report.debugSam = await sam.page.evaluate(() => ({url:location.href, status:document.querySelector('[data-testid="storage-status"]')?.innerText, states:Object.keys(localStorage).filter(key => /shared-job-state|job-storage-settings/.test(key)).map(key => [key, localStorage.getItem(key).replace(/gr8_[a-f0-9]+/, 'gr8_***').slice(0, 260)])}));
  assert.deepEqual([shared.points, shared.by], [{Kitchen:6, Family:4}, 'Sam']);
  const afterSam = await quiet(A.projectId);
  report.steps.secondUser = shared;

  // 5 - Alex still has the older revision: his save is refused, Sam's work is not overwritten
  assert.equal(await setRoom(alex.page, 'Kitchen', 9), 'failed', 'Alex is told his save was not shared');
  await alex.page.waitForFunction(() => document.querySelector('[data-testid="storage-status"]')?.dataset.conflict === 'true');
  await delay(6000);
  shared = await sharedJob(A.projectId);
  assert.deepEqual([shared.points, shared.revision, shared.by], [{Kitchen:6, Family:4}, afterSam, 'Sam'], "the shared job still holds Sam's save, untouched");
  assert(/NOT shared - conflict/.test(await alex.page.$eval(selector('storage-status'), element => element.innerText)));
  await alex.page.screenshot({path:path.join(out, '02-conflict.png')});
  report.steps.conflict = {sharedAfterStaleSave:shared.points, revision:shared.revision};

  // 6 - Alex opens the latest shared version, then his change goes in on top of Sam's
  await alex.page.goto(SETTINGS, {waitUntil:'domcontentloaded'});
  await alex.page.waitForSelector(selector('storage-refresh-jobs'));
  await click(alex.page, selector('storage-refresh-jobs'));
  await alex.page.waitForSelector(`${selector('storage-shared-job')}[data-job-id="${A.projectId}"]`);
  assert(/Your last save was not shared: Sam saved first/.test(await alex.page.$eval(`${selector('storage-shared-job')}[data-job-id="${A.projectId}"]`, row => row.innerText)));
  await Promise.all([alex.page.waitForNavigation({waitUntil:'domcontentloaded', timeout:120000}), click(alex.page, `${selector('storage-shared-job')}[data-job-id="${A.projectId}"] ${selector('storage-open-job')}`)]);
  await openElectrical(alex.page);
  assert(/4 powerpoints/.test(await roomText(alex.page, 'Family')), "Alex now has Sam's Family quantity");
  assert.equal(await setRoom(alex.page, 'Kitchen', 9), 'saved');
  shared = await sharedWhen(A.projectId, job => job.points.Kitchen === 9);
  assert.deepEqual([shared.points, shared.by], [{Kitchen:9, Family:4}, 'Alex'], 'both users’ work is in the job');
  report.steps.resolved = shared.points;

  // 7 - a different job at the same time is a different job
  await quiet(A.projectId);
  const revisionA = (await sharedJob(A.projectId)).revision;
  await loadJob(sam.page, B.file);
  assert.equal(await setRoom(sam.page, 'Study', 3), 'saved');
  const sharedB = await sharedWhen(B.projectId, job => job.points.Study === 3);
  assert.deepEqual([sharedB.name, sharedB.points, sharedB.writers], ['Shared Job B', {Study:3}, ['Sam']]);
  await quiet(B.projectId);
  shared = await sharedJob(A.projectId);
  assert.deepEqual([shared.revision, shared.points], [revisionA, {Kitchen:9, Family:4}], 'saving Job B did not touch Job A');
  assert.deepEqual((await admin.list()).map(job => job.jobId).sort(), [A.projectId, B.projectId].sort());
  report.steps.differentJobs = {A:shared.points, B:sharedB.points};

  // 8 - the documents are in the builder's folder; back to Local Only stops sharing and removes nothing
  assert(fs.readdirSync(path.join(data, 'objects', 'companies')).includes(company.id), "job records are in the builder's storage folder");
  await sam.page.goto(SETTINGS, {waitUntil:'domcontentloaded'});
  await sam.page.waitForSelector(selector('storage-settings'));
  await click(sam.page, `${selector('storage-mode-local')} input`);
  await click(sam.page, selector('storage-save'));
  await sam.page.waitForFunction(() => document.querySelector('[data-testid="storage-settings"]')?.dataset.mode === 'local');
  assert(/Local Only - single user/.test(await sam.page.$eval(selector('storage-current-mode'), element => element.innerText)));
  assert.equal((await sharedJob(B.projectId)).points.Study, 3, 'the shared copy is still there');

  assert.deepEqual(report.runtimeErrors, []);
  report.passed = true;
} catch (error) {
  report.error = error.message;
  process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  for (const browser of browsers) await browser.close().catch(() => {});
  server.send('stop');
  await new Promise(resolve => server.on('exit', resolve));
  fs.rmSync(data, {recursive:true, force:true});
}
