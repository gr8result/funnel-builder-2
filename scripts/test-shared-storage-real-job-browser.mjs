import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import {createClient} from '@supabase/supabase-js';
import {readJob} from '../lib/jobFile.ts';
import {JobStore} from '../lib/job-storage/jobStore.js';
import {RemoteJobClient} from '../lib/job-storage/jobClient.js';
import {FileSystemStorageProvider} from '../lib/job-storage/fileSystemProvider.js';

// The REAL job (a copy of New Job 03/09) through Shared Storage in the real application screens:
// opened from its job file, shared by saving, reloaded, Quotation and AI Takeoff opened, then
// opened by a second user in a separate browser instance, edited there, and a stale save refused.
// The job file is only read. The job server is its own process on a temporary storage folder.
// Supabase writes are blocked.
// Usage: node --max-old-space-size=8192 --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-shared-storage-real-job-browser.mjs [--job=path.gr8job]
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({path:path.join(root, '.env.local'), quiet:true});
dotenv.config({path:path.join(root, '.env'), quiet:true});
const arg = (name, fallback) => (process.argv.find(value => value.startsWith(`--${name}=`)) || '').split('=').slice(1).join('=') || fallback;
const jobFile = path.resolve(root, arg('job', 'recovery/quotation-changes-2026-10-03/current-job-verified-1790977156917.gr8job'));
const origin = process.env.CLIENT_SELECTIONS_BASE_URL || 'http://localhost:3000';
const out = path.join(root, 'artifacts/test-artifacts/shared-storage-real-job');
fs.mkdirSync(out, {recursive:true});
const mb = bytes => Math.round(bytes / 104857.6) / 10;

const describe = book => ({
  quotationSections: Object.keys(book.quotation || {}).length,
  quotationRows: Object.values(book.quotation || {}).reduce((total, section) => total + (section.rows || []).length, 0),
  selectionRooms: (book.clientSelectionsBook?.rooms || []).length,
  selectionRows: (book.clientSelectionsBook?.rooms || []).reduce((total, room) => total + (room.rows || []).length, 0),
  takeoffOpenings: (book.aiPlanTakeoffJob?.placedOpenings || []).length,
  takeoffWallRuns: (book.aiPlanTakeoffJob?.completedWallRuns || []).length,
  planPages: (book.aiPlanTakeoffJob?.plan?.pages || []).length,
  pageBuilderPages: (book.projectEstimateBuilder?.pages || []).length,
});
const source = (await readJob(new File([fs.readFileSync(jobFile)], path.basename(jobFile)))).workbook;
const report = {passed:false, job:path.basename(jobFile), jobFileMb:mb(fs.statSync(jobFile).size), source:describe(source), steps:{}, runtimeErrors:[]};

const data = fs.mkdtempSync(path.join(os.tmpdir(), 'gr8-shared-real-'));
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
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const selector = testId => `[data-testid="${testId}"]`;
const HOME = selector('guided-client-selections-home');
const INTERIOR = selector('guided-interior-categories');
const OVERVIEW = selector('electrical-schedule');
const EDITOR = selector('electrical-room-editor');
const GUIDED = [HOME, INTERIOR, selector('guided-exterior-categories'), OVERVIEW, EDITOR, selector('guided-kitchen-checklist'), selector('guided-cabinetry-workflow')].join(', ');
const route = `${origin}/modules/estimate-builder?page=clientSelections`;
const SETTINGS = `${origin}/modules/estimate-builder/storage-settings`;
const browsers = [];

async function user(account) {
  const browser = await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, protocolTimeout:600000, defaultViewport:{width:1600, height:1000}});
  browsers.push(browser);
  const page = await browser.newPage();
  page.setDefaultTimeout(180000);
  const person = {page, account, name:account.user.name, crashed:false, loads:0};
  page.on('pageerror', error => report.runtimeErrors.push(`${person.name}: ${error.message}`));
  page.on('error', error => { person.crashed = true; report.runtimeErrors.push(`${person.name}: PAGE CRASH ${error.message}`); });
  page.on('dialog', dialog => dialog.accept());
  page.on('console', message => { if (/warn|error/.test(message.type())) (report.console ||= []).push(`${person.name}: ${message.text().slice(0, 400)}`); });
  page.on('requestfailed', request => { if (request.url().startsWith(serverUrl)) (report.serverRequestFailures ||= []).push(`${person.name}: ${request.method()} ${request.url().slice(serverUrl.length, serverUrl.length + 80)} ${request.failure()?.errorText}`); });
  page.on('response', response => { if (response.url().startsWith(serverUrl) && response.status() >= 400) (report.serverErrors ||= []).push(`${person.name}: ${response.request().method()} ${response.url().slice(serverUrl.length, serverUrl.length + 80)} ${response.status()}`); });
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (/\/(rest|storage)\/v1\//.test(request.url()) && !request.url().startsWith(serverUrl) && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) void request.abort();
    else void request.continue();
  });
  const auth = await session();
  await page.evaluateOnNewDocument(({key, value}) => localStorage.setItem(key, JSON.stringify(value)), {key:`sb-${new URL(url).hostname.split('.')[0]}-auth-token`, value:auth});
  return person;
}
const click = (page, sel) => page.$eval(sel, element => element.click());
const heapMb = async page => mb((await page.metrics()).JSHeapUsedSize);
async function loadJob(page, file) {
  await page.goto(route, {waitUntil:'domcontentloaded', timeout:180000});
  const input = await page.waitForSelector(selector('open-local-job-file-input'));
  await input.uploadFile(file);
  for (let attempt = 0; attempt < 240; attempt++) {
    await delay(1000);
    const labels = await page.$$eval('button', buttons => buttons.filter(button => !button.disabled).map(button => button.innerText.trim())).catch(() => []);
    const dialogs = ['Discard Changes', 'Open Job', 'Open Job File', 'Keep Local'].filter(text => labels.includes(text));
    for (const text of dialogs) await page.evaluate(value => [...document.querySelectorAll('button')].find(button => !button.disabled && button.innerText.trim() === value)?.click(), text);
    if (!dialogs.length && attempt >= 2 && await page.$(GUIDED)) return;
  }
  await page.waitForSelector(GUIDED);
}
async function openElectrical(page) {
  for (let guard = 0; guard < 14 && !await page.$(OVERVIEW); guard++) {
    if (await page.$(EDITOR)) await click(page, selector('electrical-all-rooms'));
    else if (await page.$(INTERIOR)) await click(page, `${INTERIOR} [data-category-key="electrical-technology"]`);
    else if (await page.$(HOME)) await click(page, `${HOME} [data-category-key="interior"]`);
    else if (await page.$('.categoryHubBack')) await click(page, '.categoryHubBack');
    else await page.evaluate(() => [...document.querySelectorAll('button')].find(button => /^(back|← interior)$/i.test(button.innerText.trim()))?.click());
    await delay(1200);
  }
  await page.waitForSelector(OVERVIEW);
}
// Adds `change` double powerpoints to a room and saves; returns { state, quantity }.
async function changeRoom(page, room, change) {
  await openElectrical(page);
  await click(page, `${selector('electrical-room')}[data-room="${room}"] ${selector('electrical-room-edit')}`);
  await page.waitForFunction((sel, name) => document.querySelector(sel)?.dataset.room === name, {}, EDITOR, room);
  for (let index = 0; index < change; index++) await click(page, selector('electrical-qty-double-gpo-plus'));
  const quantity = await page.$eval(selector('electrical-qty-double-gpo'), input => Number(input.value));
  await click(page, selector('electrical-save-next'));
  await page.waitForFunction(() => /saved|failed/.test(document.querySelector('[data-testid="electrical-save-state"]')?.className || ''), {timeout:300000});
  const state = await page.$eval(selector('electrical-save-state'), element => (element.classList.contains('saved') ? 'saved' : 'failed'));
  if (state === 'failed') (report.failedSaves ||= []).push(await page.$eval(selector('electrical-save-state'), element => element.innerText.slice(0, 500)));
  return {state, quantity};
}
async function connect({page, account}) {
  await page.goto(SETTINGS, {waitUntil:'domcontentloaded', timeout:180000});
  await page.waitForSelector(selector('storage-settings'));
  await click(page, `${selector('storage-mode-shared')} input`);
  await page.waitForSelector(selector('storage-shared-form'));
  for (const [field, value] of [['storage-server-url', serverUrl], ['storage-company-id', company.id], ['storage-token', account.token]]) { await page.$eval(selector(field), input => { input.focus(); input.select(); }); await page.keyboard.press('Backspace'); await page.type(selector(field), value); }
  await click(page, selector('storage-test'));
  await page.waitForFunction(name => new RegExp(`Connected as ${name}`).test(document.querySelector('[data-testid="storage-test-result"]')?.innerText || ''), {}, account.user.name);
  await click(page, selector('storage-save'));
  await page.waitForFunction(() => document.querySelector('[data-testid="storage-settings"]')?.dataset.mode === 'shared');
}
const pointsOf = book => { const row = (book.clientSelectionsBook?.rooms || []).flatMap(room => room.rows || []).find(item => item.guidedSelection?.electricalSchedule); return Object.fromEntries((row?.guidedSelection.electricalSchedule.rooms || []).filter(room => room.points?.['double-gpo']).map(room => [room.room, room.points['double-gpo']])); };
async function sharedJob(jobId) {
  const found = await admin.open(jobId);
  if (!found) return null;
  const history = await admin.history(jobId);
  const text = JSON.stringify(found.workbook);
  return {revision:found.revision, by:history[0].createdByName, points:pointsOf(found.workbook), contents:describe(found.workbook), wholeJobMb:mb(Buffer.byteLength(text)),
    localOnlyReferences:(text.match(/"__gr8StoredDataUrl"/g) || []).length, embeddedDocuments:(text.match(/"data:[a-z]+\/[a-z0-9.+-]+;base64,/gi) || []).length};
}
async function sharedWhen(jobId, predicate, seconds = 300) {
  let job;
  for (let attempt = 0; attempt < seconds; attempt++) { job = await sharedJob(jobId).catch(() => null); if (job && predicate(job)) return job; await delay(1000); }
  return job;
}
const quiet = async jobId => { let last = -1, since = Date.now(); for (;;) { const revision = (await admin.history(jobId).catch(() => []))[0]?.revision ?? 0; if (revision !== last) { last = revision; since = Date.now(); } if (Date.now() - since > 12000) return last; await delay(1000); } };
// The job as this browser's own local store holds it (counts only).
const localJob = (page, jobId) => page.evaluate(async (id, describeSource) => {
  const describe = new Function(`return (${describeSource})`)();
  const db = await new Promise((resolve, reject) => { const request = indexedDB.open('estimate-builder-template-db'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
  try { const record = await new Promise(resolve => { const request = db.transaction('jobs', 'readonly').objectStore('jobs').get(`job:${id}`); request.onsuccess = () => resolve(request.result); }); return record?.workbook ? describe(record.workbook) : null; } finally { db.close(); }
}, jobId, describe.toString());
const status = page => page.$eval(selector('storage-status'), element => ({text:element.innerText.trim(), revision:Number(element.dataset.revision || 0), conflict:element.dataset.conflict === 'true'}));
// What a screen of the application shows for the job: it rendered, with the job's own id.
async function visit(page, pageKey, jobId, shot) {
  await page.goto(`${origin}/modules/estimate-builder?page=${pageKey}&jobId=${jobId}`, {waitUntil:'domcontentloaded', timeout:180000});
  await page.waitForSelector(selector('storage-status'), {timeout:240000});
  await delay(12000);
  await page.screenshot({path:path.join(out, shot)});
  return page.evaluate(() => ({jobId:new URL(location.href).searchParams.get('jobId'), textLength:document.body.innerText.length, dollars:(document.body.innerText.match(/\$\s?[\d,]+\.\d\d/g) || []).length, canvases:document.querySelectorAll('canvas').length, images:document.images.length}));
}

try {
  const alex = await user(staff[0]);
  const sam = await user(staff[1]);

  // 1 - open the real job from its file (Local Only): nothing leaves this computer
  await loadJob(alex.page, jobFile);
  await delay(8000);
  const jobId = new URL(alex.page.url()).searchParams.get('jobId');
  assert(jobId, 'the open job is named in the address');
  assert.equal((await status(alex.page)).text, 'Storage: Local only');
  assert.equal((await admin.list()).length, 0, 'Local Only sends nothing to the server');
  report.steps.open = {jobId, heapMb:await heapMb(alex.page), localOnlyContents:await localJob(alex.page, jobId)};

  // 2 - switch to Shared Storage: a tested connection, and still nothing moved by itself
  await connect(alex);
  assert.equal((await admin.list()).length, 0, 'switching mode moved nothing by itself');

  // 3 - a selection saved in the real screen puts the whole job in the builder's shared storage
  await alex.page.goto(`${route}&jobId=${jobId}`, {waitUntil:'domcontentloaded'});
  await alex.page.waitForSelector(GUIDED, {timeout:240000});
  await openElectrical(alex.page);
  const rooms = await alex.page.$$eval(selector('electrical-room'), cards => cards.map(card => card.dataset.room));
  assert(rooms.length >= 2, 'the real job has rooms');
  const [roomA, roomB] = rooms;
  const before = pointsOf(source);
  const first = await changeRoom(alex.page, roomA, 1);
  assert.equal(first.state, 'saved');
  let shared = await sharedWhen(jobId, job => job.points[roomA] === first.quantity);
  assert(shared, 'the job reached shared storage');
  assert.equal(shared.points[roomA], first.quantity, `${roomA} is in the shared job with the saved quantity`);
  await quiet(jobId);
  shared = await sharedJob(jobId);
  report.steps.shared = {room:roomA, before:before[roomA] || 0, saved:first.quantity, ...shared, source:report.source};
  for (const key of ['takeoffOpenings', 'takeoffWallRuns', 'planPages', 'pageBuilderPages']) assert.equal(shared.contents[key], report.source[key], `shared job ${key} matches the job file`);
  report.steps.shared.localContents = await localJob(alex.page, jobId);
  assert.deepEqual(shared.contents, report.steps.shared.localContents, 'the shared job is the job this computer holds');
  assert.equal(shared.localOnlyReferences, 0, 'the shared job holds the documents themselves, not references to one computer');
  const stored = fs.readdirSync(path.join(data, 'objects'), {recursive:true, withFileTypes:true}).filter(entry => entry.isFile());
  report.steps.storageFolder = {files:stored.length, mb:mb(stored.reduce((total, entry) => total + fs.statSync(path.join(entry.parentPath || entry.path, entry.name)).size, 0))};
  await alex.page.waitForFunction(() => Number(document.querySelector('[data-testid="storage-status"]')?.dataset.revision) > 0);
  report.steps.shared.status = (await status(alex.page)).text;

  // 4 - reload: the same job, the saved quantity, still shared
  await alex.page.reload({waitUntil:'domcontentloaded', timeout:180000});
  await alex.page.waitForSelector(GUIDED, {timeout:240000});
  assert.equal(new URL(alex.page.url()).searchParams.get('jobId'), jobId);
  await openElectrical(alex.page);
  await click(alex.page, `${selector('electrical-room')}[data-room="${roomA}"] ${selector('electrical-room-edit')}`);
  await alex.page.waitForFunction((sel, name) => document.querySelector(sel)?.dataset.room === name, {}, EDITOR, roomA);
  assert.equal(await alex.page.$eval(selector('electrical-qty-double-gpo'), input => Number(input.value)), first.quantity, 'the saved quantity is there after a reload');
  report.steps.reload = {quantity:first.quantity, status:(await status(alex.page)).text, heapMb:await heapMb(alex.page)};

  // 5 - Quotation and AI Takeoff open on the same job
  report.steps.quotation = await visit(alex.page, 'quotation', jobId, '01-quotation.png');
  assert.equal(report.steps.quotation.jobId, jobId);
  assert(report.steps.quotation.dollars > 0, 'the quotation shows priced rows');
  report.steps.takeoff = await visit(alex.page, 'aiPlanTakeoff', jobId, '02-takeoff.png');
  assert.equal(report.steps.takeoff.jobId, jobId);
  const revisionAfterViewing = await quiet(jobId);
  report.steps.viewing = {revisionAfterViewing, heapMb:await heapMb(alex.page)};

  // 6 - Sam, in a separate browser, opens the job from shared storage: selections, takeoff, documents
  await sam.page.goto(route, {waitUntil:'domcontentloaded', timeout:180000});
  await sam.page.waitForSelector(selector('open-local-job-file-input'));
  await connect(sam);
  await click(sam.page, selector('storage-refresh-jobs'));
  const rowSel = `${selector('storage-shared-job')}[data-job-id="${jobId}"]`;
  await sam.page.waitForSelector(rowSel);
  await Promise.all([sam.page.waitForNavigation({waitUntil:'domcontentloaded', timeout:300000}), click(sam.page, `${rowSel} ${selector('storage-open-job')}`)]);
  assert.equal(new URL(sam.page.url()).searchParams.get('jobId'), jobId);
  report.steps.secondUserOpen = {landedOn:new URL(sam.page.url()).search, localContents:await localJob(sam.page, jobId)};
  await sam.page.goto(`${route}&jobId=${jobId}`, {waitUntil:'domcontentloaded'});
  await sam.page.waitForSelector(GUIDED, {timeout:240000});
  await openElectrical(sam.page);
  await click(sam.page, `${selector('electrical-room')}[data-room="${roomA}"] ${selector('electrical-room-edit')}`);
  await sam.page.waitForFunction((sel, name) => document.querySelector(sel)?.dataset.room === name, {}, EDITOR, roomA);
  assert.equal(await sam.page.$eval(selector('electrical-qty-double-gpo'), input => Number(input.value)), first.quantity, "Sam sees Alex's saved quantity");
  report.steps.secondUserQuotation = await visit(sam.page, 'quotation', jobId, '03-sam-quotation.png');
  assert(report.steps.secondUserQuotation.dollars > 0, "Sam's quotation shows priced rows");
  await sam.page.goto(`${route}&jobId=${jobId}`, {waitUntil:'domcontentloaded'});
  await sam.page.waitForSelector(GUIDED, {timeout:240000});
  await quiet(jobId);
  const second = await changeRoom(sam.page, roomB, 1);
  assert.equal(second.state, 'saved');
  shared = await sharedWhen(jobId, job => job.points[roomB] === second.quantity && job.by === 'Sam');
  assert.deepEqual([shared.points[roomA], shared.points[roomB], shared.by], [first.quantity, second.quantity, 'Sam']);
  const afterSam = await quiet(jobId);
  report.steps.secondUser = {room:roomB, saved:second.quantity, revision:afterSam, contents:shared.contents, heapMb:await heapMb(sam.page)};

  // 7 - Alex still has the older revision: his save is refused and Sam's work stays
  await alex.page.goto(`${route}&jobId=${jobId}`, {waitUntil:'domcontentloaded'});
  await alex.page.waitForSelector(GUIDED, {timeout:240000});
  const stale = await changeRoom(alex.page, roomA, 1);
  assert.equal(stale.state, 'failed', 'Alex is told his save was not shared');
  await alex.page.waitForFunction(() => document.querySelector('[data-testid="storage-status"]')?.dataset.conflict === 'true');
  await delay(8000);
  shared = await sharedJob(jobId);
  assert.deepEqual([shared.points[roomA], shared.points[roomB], shared.revision, shared.by], [first.quantity, second.quantity, afterSam, 'Sam'], "the shared job still holds Sam's save");
  report.steps.conflict = {status:(await status(alex.page)).text, sharedRevision:shared.revision, heapMb:await heapMb(alex.page)};

  report.crashed = alex.crashed || sam.crashed;
  assert.equal(report.crashed, false);
  assert.deepEqual(report.runtimeErrors, []);
  report.passed = true;
} catch (error) {
  report.error = error.stack || error.message;
  process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  for (const browser of browsers) await browser.close().catch(() => {});
  server.send('stop');
  await new Promise(resolve => server.on('exit', resolve));
  fs.rmSync(data, {recursive:true, force:true});
}
