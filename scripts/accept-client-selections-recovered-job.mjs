import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import {createClient} from '@supabase/supabase-js';

// Real-browser acceptance of Client Selections on the recovered job (a COPY of its .gr8job, opened
// in an isolated browser profile - the user's own browser storage is never touched).
// Uses the supported project-linking workflow ("Attach to Platform Project" = Sync to Project
// Commercials, which reuses the project already linked to this job id), then checks the job as the
// application stored it, generates the Draft schedule PDF through the Selections Book and saves it.
// Cloud writes are NOT blocked here: the link, the selection sync and the draft document are the
// workflow under test. Every check that fails is reported as FAIL; nothing is skipped silently.
//   node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/accept-client-selections-recovered-job.mjs --job=<copy.gr8job>
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({path:path.join(root, '.env.local'), quiet:true});
dotenv.config({path:path.join(root, '.env'), quiet:true});
const arg = (name, fallback) => process.argv.find(item => item.startsWith(`--${name}=`))?.split('=').slice(1).join('=') || fallback;
// This older script WRITES TO PRODUCTION (project link, selection book, draft document); on
// 2026-10-30 it left an empty book on the live project. Use accept-client-selections-real-pdf.mjs.
if (process.env.ALLOW_PRODUCTION_WRITES !== '1') { console.error('Refusing: this acceptance writes to production. Use scripts/accept-client-selections-real-pdf.mjs (no production writes).'); process.exit(2); }
const origin = process.env.CLIENT_SELECTIONS_BASE_URL || 'http://localhost:3016';
if (new URL(origin).port === '3000') { console.error('Refusing to run against port 3000 (the live development server). Use an isolated port such as 3016.'); process.exit(2); }
const jobFile = path.resolve(root, arg('job', 'artifacts/test-artifacts/recovered-03-09-123-profile.gr8job'));
const out = path.join(root, 'artifacts/test-artifacts/client-selections-acceptance');
fs.mkdirSync(out, {recursive:true});
const report = {passed:false, checks:{}, failures:[], network:[], consoleErrors:[], pageErrors:[]};
const pass = name => { report.checks[name] = 'PASS'; console.log(`PASS ${name}`); };
const fail = (name, detail) => { report.checks[name] = 'FAIL'; report.failures.push(`${name}: ${detail}`); console.log(`FAIL ${name}: ${detail}`); };
const check = (name, ok, detail = '') => ok ? pass(name) : fail(name, detail);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}});
const {data:link, error:linkError} = await admin.auth.admin.generateLink({type:'magiclink', email:process.env.PRODUCT_LIBRARY_TEST_EMAIL || 'support@gr8result.com'});
if (linkError) throw linkError;
const authClient = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {auth:{persistSession:false}});
const {data:auth, error:authError} = await authClient.auth.verifyOtp({type:'magiclink', token_hash:link.properties.hashed_token});
if (authError) throw authError;

const browser = await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, protocolTimeout:900000, defaultViewport:{width:1600, height:1000}});
const page = await browser.newPage();
page.setDefaultTimeout(180000);
page.on('pageerror', error => report.pageErrors.push(error.message));
page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text().slice(0, 400)); });
page.on('dialog', dialog => dialog.accept());
const responses = {};
page.on('response', async response => {
  const address = response.url();
  const key = ['sync-commercial-snapshot', 'final-inclusions-schedule/generate', 'selection-foundation'].find(name => address.includes(name));
  if (!key) return;
  report.network.push({key, status:response.status(), method:response.request().method()});
  if (response.request().method() === 'POST') responses[key] = {status:response.status(), body:await response.json().catch(() => null)};
});
await page.evaluateOnNewDocument(({key, session}) => localStorage.setItem(key, JSON.stringify(session)), {key:`sb-${new URL(url).hostname.split('.')[0]}-auth-token`, session:auth.session});

const buttonTexts = () => page.$$eval('button', buttons => buttons.filter(button => !button.disabled && button.offsetParent).map(button => button.innerText.trim()));
const clickText = async (pattern, timeout = 120000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const clicked = await page.evaluate(source => {
      const regex = new RegExp(source, 'i');
      const button = [...document.querySelectorAll('button')].find(item => !item.disabled && item.offsetParent && regex.test(item.innerText.trim()));
      if (!button) return false; button.scrollIntoView({block:'center'}); button.click(); return true;
    }, pattern.source);
    if (clicked) return true;
    await delay(1000);
  }
  throw new Error(`No button matching ${pattern} (visible: ${(await buttonTexts()).slice(0, 40).join(' | ')})`);
};
async function storedJob() {
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open('estimate-builder-template-db'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    try {
      const get = key => new Promise(resolve => { const request = db.transaction('jobs', 'readonly').objectStore('jobs').get(key); request.onsuccess = () => resolve(request.result); request.onerror = () => resolve(null); });
      const keys = await new Promise(resolve => { const request = db.transaction('jobs', 'readonly').objectStore('jobs').getAllKeys(); request.onsuccess = () => resolve(request.result.map(String)); });
      const key = keys.find(item => item.startsWith('job:') && !item.includes(':snapshot:'));
      const record = await get(key);
      const wb = record?.workbook || {};
      const book = wb.clientSelectionsBook || {};
      const rows = (book.rooms || []).flatMap(room => (room.rows || []).map(row => ({room:room.name, row})));
      const allocationLines = rows.flatMap(({row}) => {
        const g = row.guidedSelection || {};
        const key2 = row.guidedRequirementKey || g.requirementKey || '';
        return (g.plumbingAllocation?.lines || []).map(line => ({requirementKey:key2, productId:line.productId || '', productName:line.productName || '', quantity:Number(line.quantity) || 0,
          allocations:(line.allocations || []).map(item => ({location:item.location || '', quantity:Number(item.quantity) || 0}))}));
      });
      const cabinetry = rows.filter(({row}) => /cabinet|benchtop|kitchen|pantry|laundry/i.test(row.guidedRequirementKey || row.guidedSelection?.requirementKey || ''))
        .map(({room, row}) => ({room, key:row.guidedRequirementKey || row.guidedSelection?.requirementKey, product:row.selectedProduct || row.guidedSelection?.productName || '', detailKeys:Object.keys(row.guidedSelection || {})}));
      return {key, revision:record?.revision, jobId:wb.jobId, commercialProjectId:wb.commercialProjectId, projectId:wb.projectId, commercialSnapshotId:wb.commercialSnapshotId || '',
        rooms:(wb.projectRoomModel?.rooms || book.projectRoomModel?.rooms || []).map(room => room.name), allocationLines, cabinetry,
        cabinetSchedule:book.cabinetrySchedule || book.cabinetry || null, storedKeys:keys};
    } finally { db.close(); }
  });
}

try {
  await page.goto(`${origin}/modules/estimate-builder?page=clientSelections`, {waitUntil:'domcontentloaded', timeout:600000});
  const input = await page.waitForSelector('[data-testid="open-local-job-file-input"]', {timeout:600000});
  await input.uploadFile(jobFile);
  // The supported link: the "Local job file opened" prompt's Attach to Platform Project.
  for (let attempt = 0; attempt < 300; attempt++) {
    const labels = await buttonTexts();
    if (labels.includes('Attach to Platform Project')) break;
    for (const text of ['Discard Changes', 'Open Job', 'Open Job File']) if (labels.includes(text)) await clickText(new RegExp(`^${text}$`));
    await delay(1000);
  }
  await clickText(/^Attach to Platform Project$/, 30000);
  for (let attempt = 0; attempt < 300 && !responses['sync-commercial-snapshot']; attempt++) await delay(1000);
  const sync = responses['sync-commercial-snapshot'];
  const linkedProjectId = sync?.body?.project_id || sync?.body?.data?.project?.id || '';
  report.link = {status:sync?.status, projectId:linkedProjectId, snapshotId:sync?.body?.snapshot_id || sync?.body?.data?.snapshot?.id || '', error:sync?.body?.error || ''};
  check('project link: Sync to Project Commercials succeeds', sync?.status === 200 && /^[0-9a-f-]{36}$/i.test(linkedProjectId), JSON.stringify(report.link));
  check('project link reuses the project already linked to this job', linkedProjectId === '244aedc0-c0ff-4f39-b8de-75ddb0ec3050', `linked ${linkedProjectId}`);
  await delay(8000);

  const job = await storedJob();
  report.job = {key:job.key, revision:job.revision, jobId:job.jobId, commercialProjectId:job.commercialProjectId, projectId:job.projectId, rooms:job.rooms, cabinetry:job.cabinetry};
  check('stored job carries the project UUID after linking', job.commercialProjectId === linkedProjectId, `commercialProjectId=${job.commercialProjectId}`);

  // Rooms.
  const roomSet = new Set(job.rooms.map(name => name.toLowerCase()));
  check('rooms: no Upstairs / Downstairs', !roomSet.has('upstairs') && !roomSet.has('downstairs'), job.rooms.join(', '));
  check('rooms: Butler\'s Pantry present, no separate Pantry', roomSet.has("butler's pantry") && !roomSet.has('pantry'), job.rooms.join(', '));
  check('rooms: no duplicate room names', roomSet.size === job.rooms.length, job.rooms.join(', '));
  const canonical = new Map(job.rooms.map(name => [name.toLowerCase().replace(/[^a-z0-9]/g, ''), name]));
  const nonCanonical = [...new Set(job.allocationLines.flatMap(line => line.allocations.map(item => item.location)).filter(location => !canonical.has(location.toLowerCase().replace(/[^a-z0-9]/g, ''))))];
  report.nonCanonicalAllocationLocations = nonCanonical;
  check('product allocations use project room names', nonCanonical.length === 0, nonCanonical.join(' | '));

  // Products.
  const lines = key => job.allocationLines.filter(line => line.requirementKey === key);
  const toilets = lines('toilet-suite');
  check('toilets: one product line, ICON Close Coupled, quantity 4', toilets.length === 1 && /ICON/i.test(toilets[0].productName) && toilets[0].quantity === 4 && toilets[0].allocations.reduce((sum, item) => sum + item.quantity, 0) === 4, JSON.stringify(toilets));
  const baths = lines('bath');
  check('bath: one Riviere bath', baths.length === 1 && /Riviere/i.test(baths[0].productName) && baths[0].quantity === 1, JSON.stringify(baths));
  const fans = lines('ceiling-fan');
  check('fans: SPYDA black only, no STANZA', fans.length > 0 && fans.every(line => /SPYDA/i.test(line.productName) && /black/i.test(line.productName)) && !fans.some(line => /STANZA/i.test(line.productName)), JSON.stringify(fans));
  report.fans = fans.map(line => ({product:line.productName, allocations:line.allocations}));
  const duplicateAllocations = job.allocationLines.flatMap(line => {
    const seen = new Map();
    return line.allocations.filter(item => { const key = item.location.toLowerCase(); const repeat = seen.has(key); seen.set(key, true); return repeat; }).map(item => `${line.requirementKey}/${line.productName}@${item.location}`);
  });
  check('no duplicate allocations of one product to one room', duplicateAllocations.length === 0, duplicateAllocations.join(' | '));
  const mismatched = job.allocationLines.filter(line => line.allocations.length && line.allocations.reduce((sum, item) => sum + item.quantity, 0) !== line.quantity).map(line => `${line.requirementKey}/${line.productName}: qty ${line.quantity} vs allocated ${line.allocations.reduce((sum, item) => sum + item.quantity, 0)}`);
  check('every product quantity equals its room allocations', mismatched.length === 0, mismatched.join(' | '));
  save();

  // PDF: Selections Book > Review Schedule > Generate Draft PDF.
  // Generated where a builder generates it: Client Selections inside the open job (the standalone
  // /modules/builders/selections-book page reads the cloud copy of the book, not the job).
  const route = process.env.ACCEPT_PDF_ROUTE || 'job';
  await page.goto(route === 'standalone' ? `${origin}/modules/builders/selections-book?projectId=${linkedProjectId}` : `${origin}/modules/estimate-builder?jobId=${encodeURIComponent(job.jobId || job.key.replace(/^job:/, ''))}&page=clientSelections`, {waitUntil:'domcontentloaded', timeout:600000});
  report.pdfRoute = route;
  await delay(5000);
  await clickText(/^(Generate \/ )?Review Schedule$/, 300000);
  await delay(5000);
  await page.screenshot({path:path.join(out, 'review-schedule.png'), fullPage:false});
  await clickText(/^Generate Draft PDF$/, 300000);
  for (let attempt = 0; attempt < 600 && !responses['final-inclusions-schedule/generate']; attempt++) await delay(1000);
  const generated = responses['final-inclusions-schedule/generate'];
  report.pdf = {status:generated?.status, error:generated?.body?.error || '', code:generated?.body?.code || '', pageCounts:generated?.body?.pageCounts, warnings:generated?.body?.warnings, validation:generated?.body?.validation, document:generated?.body?.document};
  check('Generate Draft PDF succeeds for the linked project', generated?.status === 200 && generated?.body?.ok === true, JSON.stringify({status:generated?.status, error:report.pdf.error, code:report.pdf.code}));
  const documentRecord = generated?.body?.document || {};
  const storagePath = documentRecord.storage_path || documentRecord.storagePath || documentRecord.file_path || '';
  const fileUrl = documentRecord.signed_url || documentRecord.signedUrl || documentRecord.url || documentRecord.file_url || '';
  let bytes = null;
  if (fileUrl) bytes = Buffer.from(await (await fetch(fileUrl)).arrayBuffer());
  else if (storagePath) {
    const [bucket, ...rest] = String(storagePath).replace(/^[a-z-]+:/, match => match).split(/[:/]/);
    const {data, error} = await admin.storage.from(bucket).download(rest.join('/'));
    if (!error) bytes = Buffer.from(await data.arrayBuffer());
    else report.pdf.downloadError = error.message;
  }
  if (bytes?.length) fs.writeFileSync(path.join(out, 'recovered-job-schedule.pdf'), bytes);
  check('the generated PDF was downloaded', Boolean(bytes?.length) && bytes.subarray(0, 4).toString() === '%PDF', `bytes=${bytes?.length || 0} path=${storagePath} url=${fileUrl ? 'yes' : 'no'}`);
} catch (error) {
  fail('acceptance run', error.message);
  await page.screenshot({path:path.join(out, 'failure.png')}).catch(() => {});
} finally {
  report.passed = report.failures.length === 0;
  save();
  console.log(JSON.stringify({passed:report.passed, failures:report.failures, link:report.link, pdf:report.pdf && {status:report.pdf.status, error:report.pdf.error, pageCounts:report.pdf.pageCounts}}, null, 2));
  if (!report.passed) process.exitCode = 1;
  await browser.close().catch(() => {});
}
