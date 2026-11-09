import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {File} from 'node:buffer';
import {fileURLToPath, pathToFileURL} from 'node:url';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import {createClient} from '@supabase/supabase-js';
import {createProjectInclusionsSnapshot} from '../lib/builders/finalInclusionsSchedule.js';
import {generateAndStoreStandaloneFinalInclusionsPdf} from '../lib/builders/finalInclusionsPdfExecution.js';
import {readJob, writeJob} from '../lib/jobFile.ts';

// Contract schedule PDF from the REAL recovered job and its REAL linked project, with NO production
// writes:
//   - a disposable copy of the job file, linked to the project the way "Attach to Platform Project"
//     records it (project uuid on the job), opened in an isolated browser profile;
//   - production is READ (project, snapshot, products, the cloud book); every write the browser makes
//     to Supabase or to /api is answered by a stand-in here and recorded, never sent;
//   - the Generate request the app builds is captured (not sent) and rendered by the server's own PDF
//     code locally (createProjectInclusionsSnapshot + generateAndStoreStandaloneFinalInclusionsPdf,
//     in-memory storage), with the selection rows the app's own save would have written;
//   - the stored job's selections are compared before and after Generate: generating must not change them.
//   node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/accept-client-selections-real-pdf.mjs
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({path:path.join(root, '.env.local'), quiet:true});
dotenv.config({path:path.join(root, '.env'), quiet:true});
const arg = (name, fallback) => process.argv.find(item => item.startsWith(`--${name}=`))?.split('=').slice(1).join('=') || fallback;
const origin = process.env.CLIENT_SELECTIONS_BASE_URL || 'http://localhost:3017';
if (new URL(origin).port === '3000' && process.env.ALLOW_SHARED_SERVER_READ_ONLY_PDF_ACCEPTANCE !== '1') {
  console.error('Refusing to run against port 3000 without ALLOW_SHARED_SERVER_READ_ONLY_PDF_ACCEPTANCE=1.');
  process.exit(2);
}
const PROJECT_ID = arg('project', '244aedc0-c0ff-4f39-b8de-75ddb0ec3050');
const sourceJob = path.resolve(root, arg('job', 'artifacts/recovered-03-09-123-profile.gr8job'));
const out = path.join(root, 'artifacts/test-artifacts/client-selections-real-pdf');
fs.mkdirSync(out, {recursive:true});
const report = {passed:false, checks:{}, failures:[], blockedWrites:[], consoleErrors:[], pageErrors:[], bookLoads:[]};
const pass = name => { report.checks[name] = 'PASS'; console.log(`PASS ${name}`); };
const fail = (name, detail) => { report.checks[name] = 'FAIL'; report.failures.push(`${name}: ${detail}`); console.log(`FAIL ${name}: ${detail}`); };
const check = (name, ok, detail = '') => ok ? pass(name) : fail(name, detail);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
async function inspectPdf(bytes) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const standardFontDataUrl = `${pathToFileURL(path.resolve(root, 'node_modules/pdfjs-dist/standard_fonts')).href}/`;
  const pdf = await pdfjs.getDocument({data:new Uint8Array(bytes), disableWorker:true, standardFontDataUrl}).promise;
  const text = [];
  let imageOperations = 0;
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    text.push((await page.getTextContent()).items.map(item => item.str).join(' '));
    const operators = await page.getOperatorList();
    imageOperations += operators.fnArray.filter(fn => fn === pdfjs.OPS.paintImageXObject || fn === pdfjs.OPS.paintInlineImageXObject || fn === pdfjs.OPS.paintImageMaskXObject).length;
  }
  return {pageCount:pdf.numPages, text:text.join('\n'), imageOperations};
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}});
const {data:project} = await admin.from('builder_commercial_projects').select('*').eq('id', PROJECT_ID).single();
if (!project) throw new Error(`project ${PROJECT_ID} not found`);
const {data:snapshots} = await admin.from('builder_estimate_snapshots').select('id, workspace_id, project_id, snapshot_number, snapshot_label, status, source_quote_number, final_quote_total, created_at').eq('project_id', PROJECT_ID).order('created_at', {ascending:false}).limit(1);
const {data:cloudBooksBefore} = await admin.from('builder_selection_books').select('id, updated_at').eq('project_id', PROJECT_ID);
const {count:cloudRowsBefore} = await admin.from('builder_client_selections').select('id', {count:'exact', head:true}).eq('project_id', PROJECT_ID);

// Disposable linked copy of the job.
globalThis.File = File;
const sourceBytes = fs.readFileSync(sourceJob);
const file = sourceBytes.subarray(0, 2).toString() === 'PK'
  ? await readJob(new File([sourceBytes], path.basename(sourceJob), {type:'application/zip'}))
  : JSON.parse(sourceBytes.toString('utf8'));
const wb = file.workbook || file;
const jobId = wb.jobId;
Object.assign(wb, {commercialProjectId:PROJECT_ID, projectId:PROJECT_ID, registeredJobId:PROJECT_ID, commercialSnapshotId:snapshots?.[0]?.id || wb.commercialSnapshotId || ''});
wb.jobFileMeta = {...(wb.jobFileMeta || {}), projectId:PROJECT_ID};
wb.registeredJob = {...(wb.registeredJob || {}), jobId:PROJECT_ID, workspaceId:project.workspace_id};
const disposable = path.join(out, 'disposable-linked-job.gr8job');
let disposableBlob = null;
const disposableHandle = {
  name:path.basename(disposable),
  async getFile() {
    if (disposableBlob) return new File([disposableBlob], this.name, {type:'application/zip'});
    const error = new Error('Disposable package does not exist yet.');
    error.code = 'ENOENT';
    throw error;
  },
  async createWritable() {
    return {
      async write(blob) { disposableBlob = blob; },
      async close() {},
      async abort() { disposableBlob = null; },
    };
  },
};
const disposableResult = await writeJob(disposableHandle, file);
if (!disposableResult.ok || !disposableBlob) throw new Error(disposableResult.message || 'Disposable linked package could not be created.');
fs.writeFileSync(disposable, Buffer.from(await disposableBlob.arrayBuffer()));
const sourceSelections = (wb.clientSelectionsBook?.rooms || []).flatMap(room => room.rows || []).filter(row => row.selectedProduct || row.guidedSelection).length;
report.job = {jobId, project:PROJECT_ID, sourceSelectionRows:sourceSelections, cloudBooksBefore, cloudRowsBefore};

const {data:link} = await admin.auth.admin.generateLink({type:'magiclink', email:process.env.PRODUCT_LIBRARY_TEST_EMAIL || 'support@gr8result.com'});
const {data:auth} = await createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {auth:{persistSession:false}}).auth.verifyOtp({type:'magiclink', token_hash:link.properties.hashed_token});
const browser = await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, protocolTimeout:900000, defaultViewport:{width:1600, height:1000}});
const page = await browser.newPage();
page.setDefaultTimeout(180000);
page.on('pageerror', error => report.pageErrors.push(error.message));
page.on('console', message => {
  const text = message.text();
  if (text.includes('[Client Selections debug]') || text.includes('book sources not used')) report.bookLoads.push(text.slice(0, 800));
  if (message.type() === 'error') report.consoleErrors.push(text.slice(0, 300));
});
page.on('dialog', dialog => dialog.accept());
await page.evaluateOnNewDocument(({key, session}) => { localStorage.setItem(key, JSON.stringify(session)); window.__gr8DebugBookLoad = true; }, {key:`sb-${new URL(url).hostname.split('.')[0]}-auth-token`, session:auth.session});

// Every write is answered here, never sent. Rows the app writes to builder_client_selections are kept:
// they are what the real save would have stored, and what the server would render from.
let capturedGenerate = null;
// In-memory copy of this project's builder_client_selections: seeded from production (read-only),
// then the app's own writes are applied to it and its reads are answered from it, so the browser sees
// exactly what the real save would have left in the table.
const {data:seedRows} = await admin.from('builder_client_selections').select('*').eq('project_id', PROJECT_ID);
const writtenSelectionRows = new Map((seedRows || []).map(row => [row.id, row]));
const touchedSelectionIds = new Set();
const supabaseHost = new URL(url).host;
await page.setRequestInterception(true);
page.on('request', request => {
  const method = request.method();
  const target = new URL(request.url());
  const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(method);
  const toSupabase = target.host === supabaseHost;
  const toApi = target.origin === origin && target.pathname.startsWith('/api/');
  const cors = {'access-control-allow-origin':origin, 'access-control-allow-credentials':'true', 'access-control-expose-headers':'content-range, content-profile'};
  if (['GET', 'HEAD'].includes(method) && toSupabase && target.pathname.endsWith('/builder_client_selections') && target.searchParams.get('project_id') === `eq.${PROJECT_ID}`) {
    const active = target.searchParams.get('is_active');
    const rows = [...writtenSelectionRows.values()].filter(row => (active === 'eq.true' ? row.is_active !== false : true));
    return void request.respond({status:200, contentType:'application/json', headers:{...cors, 'content-range':`0-${Math.max(0, rows.length - 1)}/${rows.length}`}, body:JSON.stringify(rows)});
  }
  if (!isWrite || (!toSupabase && !toApi) || target.pathname.startsWith('/auth/v1/')) return void request.continue();
  const body = (() => { try { return JSON.parse(request.postData() || 'null'); } catch { return null; } })();
  report.blockedWrites.push(`${method} ${target.pathname}`);
  const json = (status, value) => request.respond({status, contentType:'application/json', headers:cors, body:JSON.stringify(value)});
  if (toApi && target.pathname === '/api/builders/final-inclusions-schedule/generate') {
    capturedGenerate = body;
    return void json(200, {ok:true, document:{id:'local-render', status:body?.documentStatus || 'draft'}, pageCounts:{}, warnings:[], validation:{}});
  }
  if (toSupabase && target.pathname.endsWith('/builder_selection_books')) {
    return void json(method === 'POST' ? 201 : 200, {id:cloudBooksBefore?.[0]?.id || crypto.randomUUID(), workspace_id:project.workspace_id, project_id:PROJECT_ID, book_data:body?.book_data || null});
  }
  if (toSupabase && target.pathname.endsWith('/builder_client_selections')) {
    const rows = Array.isArray(body) ? body : body ? [body] : [];
    const idFilter = target.searchParams.get('id');
    const ids = idFilter?.startsWith('in.(') ? idFilter.slice(4, -1).split(',').map(id => id.replace(/"/g, '')) : idFilter ? [idFilter.replace(/^eq\./, '')] : [];
    if (method === 'PATCH' && rows.length === 1 && ids.length) {
      for (const id of ids) { writtenSelectionRows.set(id, {...(writtenSelectionRows.get(id) || {}), ...rows[0], id}); touchedSelectionIds.add(id); }
    } else {
      for (const row of rows) { const id = row.id || crypto.randomUUID(); writtenSelectionRows.set(id, {...(writtenSelectionRows.get(id) || {}), ...row, id}); touchedSelectionIds.add(id); }
    }
    return void json(method === 'POST' ? 201 : 200, []);
  }
  return void json(200, toSupabase ? [] : {ok:true});
});

const buttonTexts = () => page.$$eval('button', buttons => buttons.filter(button => !button.disabled && button.offsetParent).map(button => button.innerText.trim()));
const clickText = async (pattern, timeout = 120000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await page.evaluate(source => { const regex = new RegExp(source, 'i'); const button = [...document.querySelectorAll('button')].find(item => !item.disabled && item.offsetParent && regex.test(item.innerText.trim())); if (!button) return false; button.scrollIntoView({block:'center'}); button.click(); return true; }, pattern.source)) return true;
    await delay(1000);
  }
  throw new Error(`No button matching ${pattern} (visible: ${(await buttonTexts()).slice(0, 40).join(' | ')})`);
};
const storedSelections = () => page.evaluate(async key => {
  const db = await new Promise((resolve, reject) => { const r = indexedDB.open('estimate-builder-template-db'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
  try {
    const record = await new Promise(resolve => { const r = db.transaction('jobs', 'readonly').objectStore('jobs').get(key); r.onsuccess = () => resolve(r.result); r.onerror = () => resolve(null); });
    const rows = (record?.workbook?.clientSelectionsBook?.rooms || []).flatMap(room => (room.rows || []).map(row => ({room:room.name, row})));
    const recorded = rows.filter(({row}) => row.selectedProduct || row.guidedSelection);
    return {revision:record?.revision, count:recorded.length, fingerprint:JSON.stringify(recorded.map(({room, row}) => [room, row.id, row.selectedProduct || '', row.guidedSelection?.productId || '', row.guidedSelection?.plumbingAllocation?.lines?.map(line => [line.productId, line.quantity]) || null]))};
  } finally { db.close(); }
}, `job:${jobId}`);
const selectionsOnScreen = () => page.evaluate(() => document.body.innerText.match(/(\d+)\s*\/\s*(\d+)\s*completed/i)?.slice(1, 3).map(Number) || null);

try {
  await page.goto(`${origin}/modules/estimate-builder?page=clientSelections`, {waitUntil:'domcontentloaded', timeout:600000});
  const input = await page.waitForSelector('[data-testid="open-local-job-file-input"]', {timeout:600000});
  await input.uploadFile(disposable);
  for (let attempt = 0; attempt < 240; attempt++) {
    await delay(1000);
    const labels = await buttonTexts().catch(() => []);
    for (const text of ['Discard Changes', 'Open Job', 'Open Job File', 'Keep Local']) if (labels.includes(text)) await clickText(new RegExp(`^${text}$`), 5000).catch(() => {});
    if (attempt > 3 && await page.$('[data-testid="guided-client-selections-home"]')) break;
  }
  await delay(4000);
  const openedScreen = await selectionsOnScreen();
  const storedBefore = await storedSelections();
  report.opened = {screen:openedScreen, stored:{revision:storedBefore.revision, count:storedBefore.count}};
  const lastLoad = () => { const line = report.bookLoads.filter(text => text.includes('book source')).at(-1) || ''; try { return JSON.parse(line.slice(line.indexOf('{'))); } catch { return null; } };
  report.opened.load = lastLoad();
  check('job opened with its own selections', storedBefore.count === sourceSelections && ['job', 'browser-draft'].includes(report.opened.load?.chosen || '') , JSON.stringify(report.opened));

  // Reopen (reload): the empty newer cloud book for this project must not replace the job's book.
  await page.reload({waitUntil:'domcontentloaded', timeout:600000});
  await page.waitForSelector('[data-testid="guided-client-selections-home"], [data-testid="guided-interior-categories"]', {timeout:600000});
  await delay(6000);
  const reopenedScreen = await selectionsOnScreen();
  report.reopened = {screen:reopenedScreen, load:lastLoad(), stored:(await storedSelections()).count};
  check('reopened linked job opens its own book, not the empty cloud book', ['job', 'browser-draft'].includes(report.reopened.load?.chosen || '') && report.reopened.load?.cloud === true && report.reopened.stored === sourceSelections && JSON.stringify(reopenedScreen) === JSON.stringify(openedScreen), JSON.stringify(report.reopened));
  await page.screenshot({path:path.join(out, 'reopened.png')});

  await clickText(/^(Generate \/ )?Review Schedule$/, 300000);
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => /^Generate Draft PDF$/.test(button.innerText.trim())), {timeout:300000});
  await delay(5000);
  await page.screenshot({path:path.join(out, 'review-schedule.png'), fullPage:false});
  // Every category, not only one: the reopened schedule represents every saved guided selection.
  const guidedInSource = (wb.clientSelectionsBook?.rooms || []).flatMap(room => room.rows || []).filter(row => row.guidedSelection && Object.keys(row.guidedSelection).length).length;
  const represented = await page.evaluate(() => document.body.innerText.match(/(\d+) of (\d+) saved selection records represented/)?.slice(1, 3).map(Number) || null);
  report.represented = {represented, guidedInSource};
  check('after reopen, the schedule represents every saved selection (all categories)', represented && represented[0] === guidedInSource && represented[1] === guidedInSource, JSON.stringify(report.represented));
  await clickText(/^Generate Draft PDF$/, 60000);
  for (let attempt = 0; attempt < 600 && !capturedGenerate; attempt++) await delay(1000);
  check('the app built a schedule from the job (pages supplied)', Array.isArray(capturedGenerate?.previewSchedule?.pages) && capturedGenerate.previewSchedule.pages.length > 0, `pages=${capturedGenerate?.previewSchedule?.pages?.length || 0}`);
  await delay(5000);
  const storedAfter = await storedSelections();
  check('generating the PDF did not change the saved selections', storedAfter.fingerprint === storedBefore.fingerprint && storedAfter.count === storedBefore.count, `before ${storedBefore.count} rows rev ${storedBefore.revision}, after ${storedAfter.count} rows rev ${storedAfter.revision}`);

  // Repeated synchronisation: three further explicit saves must not add or duplicate quotation items.
  const quoteState = () => page.evaluate(async key => {
    const db = await new Promise((resolve, reject) => { const r = indexedDB.open('estimate-builder-template-db'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    try {
      const record = await new Promise(resolve => { const r = db.transaction('jobs', 'readonly').objectStore('jobs').get(key); r.onsuccess = () => resolve(r.result); r.onerror = () => resolve(null); });
      const rows = Object.entries(record?.workbook?.quotation || {}).flatMap(([section, group]) => (group.rows || []).map((row) => ({ section, id: row.id, source: row.source || '', product: row.productName || row.selectedProduct || row.item || '', location: row.location || '', qty: row.quantity ?? row.qty ?? '' })));
      const selectionRows = rows.filter((row) => /client-selection|selection/i.test(row.source));
      const identity = (row) => [row.section, row.source, row.product, row.location].join('|');
      const counts = new Map(); selectionRows.forEach((row) => counts.set(identity(row), (counts.get(identity(row)) || 0) + 1));
      return { revision: record?.revision, rows: rows.length, selectionRows: selectionRows.length, duplicates: [...counts].filter(([, n]) => n > 1).map(([k, n]) => `${k} ×${n}`), pending: record?.workbook?.selectionReconciliationPending || null,
        obsolete: rows.filter((row) => /Origin Back to Wall|STANZA|AeroFlow/i.test(row.product)).map((row) => `${row.section}: ${row.product} ${row.location} ${row.qty}`) };
    } finally { db.close(); }
  }, `job:${jobId}`);
  report.sync = [await quoteState()];
  for (let round = 1; round <= 3; round++) {
    await clickText(/^Save Progress$/, 60000);
    await delay(12000);
    report.sync.push(await quoteState());
  }
  const first = report.sync[0], last = report.sync.at(-1);
  check('repeated saves are idempotent: no quotation row added, removed or duplicated', report.sync.every((state) => state.rows === first.rows && state.selectionRows === first.selectionRows && JSON.stringify(state.duplicates) === JSON.stringify(first.duplicates) && JSON.stringify(state.pending?.delta) === JSON.stringify(first.pending?.delta)), JSON.stringify(report.sync.map(({ revision, rows, selectionRows, duplicates, pending }) => ({ revision, rows, selectionRows, duplicates: duplicates.length, delta: pending?.delta }))));
  // The approved quotation keeps its lines until the builder approves the reconciliation; obsolete products are
  // checked on the PROPOSED quotation the save prepares (captured below).
  report.approvedQuotationObsolete = last.obsolete;
  const storedWorkbook = await page.evaluate(async key => {
    const db = await new Promise((resolve, reject) => { const r = indexedDB.open('estimate-builder-template-db'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    try { const record = await new Promise(resolve => { const r = db.transaction('jobs', 'readonly').objectStore('jobs').get(key); r.onsuccess = () => resolve(r.result); }); const { projectEstimateBuilder, ...rest } = record.workbook; return JSON.stringify(rest); } finally { db.close(); }
  }, `job:${jobId}`);
  fs.writeFileSync(path.join(out, 'stored-workbook-after-saves.json'), storedWorkbook);
  report.syncSummary = { firstRevision: first.revision, lastRevision: last.revision, pending: last.pending };
  const proposed = await page.evaluate(() => window.__gr8ProposedReconciliation || null);
  if (proposed) fs.writeFileSync(path.join(out, 'proposed-reconciliation.json'), proposed);
  const proposal = proposed ? JSON.parse(proposed) : null;
  const proposedRows = proposal ? Object.entries(proposal.proposedQuotation || {}).flatMap(([section, group]) => (group.rows || []).map((row) => ({ section, row }))) : [];
  const obsoleteProposed = proposedRows.filter(({ row }) => /Origin Back to Wall|STANZA|AeroFlow/i.test(String(row.selectedProductName || row.productName || row.item || '')) && Number(row.quantity || row.qty || 0) > 0).map(({ section, row }) => `${section}: ${row.item}`);
  check('the proposed quotation holds no obsolete product (Origin, STANZA, AeroFlow)', proposal && obsoleteProposed.length === 0, JSON.stringify(obsoleteProposed));
  const ids = new Map(); proposedRows.filter(({ row }) => /^(allocated-selection|tiling:|electrical-schedule|flooring:|appliance-selection)/.test(row.id)).forEach(({ row }) => ids.set(row.id, (ids.get(row.id) || 0) + 1));
  const dupProposed = [...ids].filter(([, n]) => n > 1).map(([id, n]) => `${id} ×${n}`);
  check('the proposed quotation has no duplicated selection row', dupProposed.length === 0, dupProposed.join(' | '));
  report.proposal = proposal ? { before: proposal.impact.before, after: proposal.impact.after, delta: proposal.impact.delta, lines: proposal.impact.rowChanges.length } : null;
  report.proposedCaptured = Boolean(proposed);
  save();

  // The server's renderer, locally.
  const body = capturedGenerate;
  fs.writeFileSync(path.join(out, 'captured-generate-request.json'), JSON.stringify(body));
  const projectDetails = body.projectDetails || {};
  const snapshotProject = {...project, project_name:projectDetails.projectName || project.project_name, client_name:projectDetails.clientName || project.client_name, site_address:projectDetails.siteAddress || project.site_address, job_number:projectDetails.jobNumber || project.job_number,
    builder_name:projectDetails.builderName || project.builder_name, builder_logo_url:projectDetails.builderLogo || project.builder_logo_url,
    metadata:{...(project.metadata || {}), builderName:projectDetails.builderName || project.metadata?.builderName, builderLogo:projectDetails.builderLogo || project.metadata?.builderLogo, phone:projectDetails.builderPhone || project.metadata?.phone, email:projectDetails.builderEmail || project.metadata?.email,
      scheduleVersion:projectDetails.scheduleVersion, scheduleStatus:projectDetails.scheduleStatus, datePrepared:projectDetails.datePrepared}};
  const selections = [...writtenSelectionRows.values()].filter(row => row.is_active !== false);
  report.selectionTable = {seeded:(seedRows || []).length, touched:touchedSelectionIds.size, active:selections.length};
  report.renderInputs = {pages:body.previewSchedule.pages.length, itemCount:body.previewSchedule.itemCount, selectionRows:selections.length, builderProfile:body.builderProfile || null, projectDetails};
  const snapshot = createProjectInclusionsSnapshot({project:snapshotProject, workspaceId:project.workspace_id, selections, session:{id:'', project_id:PROJECT_ID, snapshot_id:body.snapshotId || '', status:'ready'},
    estimateSnapshot:snapshots?.[0] || {id:body.snapshotId || ''}, generatedBy:'local-acceptance', documentStatus:body.documentStatus || 'draft', previousDocuments:[], cover:body.previewSchedule.cover || {}, schedulePages:body.previewSchedule.pages, scheduleOutstandingDecisions:body.previewSchedule.outstandingDecisions,
    builderProfile:body.builderProfile || body.builder || {}, preparedBy:'local acceptance', reviewedBy:'', approval:body.approval || {}, contractReference:body.contractReference || '', revisionReason:'',
    masterTemplate:{id:'client-selections-schedule', version:'standalone', pageCount:0}, masterPdfRef:null, closingPdfRef:null});
  let pdfBytes = null;
  const result = await generateAndStoreStandaloneFinalInclusionsPdf({snapshot, previousDocuments:[], generatedAt:new Date().toISOString(),
    puppeteerLaunchOptions:{executablePath:process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'},
    storage:{savePdf:async ({bytes}) => { pdfBytes = Buffer.from(bytes); return {storage_path:'local/contract-schedule.pdf'}; }, registerDocument:async document => document}});
  fs.writeFileSync(path.join(out, 'contract-selections-schedule.pdf'), pdfBytes);
  report.pdf = {bytes:pdfBytes.length, pageCounts:result.merged?.pageCounts, warnings:result.dynamic?.warnings, readiness:snapshot.readiness};
  check('contract schedule PDF rendered by the server renderer', pdfBytes?.subarray(0, 4).toString() === '%PDF' && pdfBytes.length > 10000, `bytes=${pdfBytes?.length || 0}`);
  const inspectedPdf = await inspectPdf(pdfBytes);
  report.pdf = {...report.pdf, pageCount:inspectedPdf.pageCount, imageOperations:inspectedPdf.imageOperations};
  check('PDF contains the corrected toilet selection and rooms', /ICON Close Coupled Toilet Suite/i.test(inspectedPdf.text) && /Main Bathroom/i.test(inspectedPdf.text) && /Powder Room/i.test(inspectedPdf.text) && /B2 Ensuite/i.test(inspectedPdf.text), 'ICON or allocated bathroom text missing');
  check('PDF contains both SPYDA fan allocations', /SPYDA/i.test(inspectedPdf.text) && /Alfresco/i.test(inspectedPdf.text) && /Balcony/i.test(inspectedPdf.text), 'SPYDA, Alfresco or Balcony text missing');
  check('PDF excludes obsolete selections', !/Origin Back to Wall|STANZA|AeroFlow/i.test(inspectedPdf.text), 'obsolete product text found');
  check('PDF contains artwork', inspectedPdf.imageOperations > 0, `image operations=${inspectedPdf.imageOperations}`);
} catch (error) {
  fail('acceptance run', `${error.message}${error.details ? ` ${JSON.stringify(error.details).slice(0, 1500)}` : ''}`);
  await page.screenshot({path:path.join(out, 'failure.png')}).catch(() => {});
} finally {
  // Production must be exactly as it was.
  const {data:cloudBooksAfter} = await admin.from('builder_selection_books').select('id, updated_at').eq('project_id', PROJECT_ID);
  const {count:cloudRowsAfter} = await admin.from('builder_client_selections').select('id', {count:'exact', head:true}).eq('project_id', PROJECT_ID);
  check('production selection book unchanged', JSON.stringify(cloudBooksAfter) === JSON.stringify(cloudBooksBefore), JSON.stringify({cloudBooksBefore, cloudBooksAfter}));
  check('production selection rows unchanged', cloudRowsAfter === cloudRowsBefore, `${cloudRowsBefore} -> ${cloudRowsAfter}`);
  report.passed = report.failures.length === 0;
  save();
  console.log(JSON.stringify({passed:report.passed, failures:report.failures, blockedWrites:[...new Set(report.blockedWrites)], pdf:report.pdf}, null, 2));
  if (!report.passed) process.exitCode = 1;
  await browser.close().catch(() => {});
}
