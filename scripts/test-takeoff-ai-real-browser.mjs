import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Actual Kress PDF + production AI endpoint + real Supabase authentication. This
// acceptance uses only a dedicated test account and isolated local job/profile.
// No API responses, detections, calibration, or persistence behavior are mocked.
// Run only when deliberately authorizing provider usage:
// $env:TAKEOFF_ANALYSE_ALLOW_PROVIDER='1'; node scripts/test-takeoff-ai-real-browser.mjs
if (process.env.TAKEOFF_ANALYSE_ALLOW_PROVIDER !== '1') throw new Error('Set TAKEOFF_ANALYSE_ALLOW_PROVIDER=1 to run real paid plan analysis.');
dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ path: '.env', quiet: true });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const authOptions = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, authOptions);
const auth = createClient(supabaseUrl, supabaseAnon, authOptions);
const testAccount = await admin.auth.admin.getUserById('e32c468e-7111-40c3-b8f5-2ce8345a3993');
const accountRun = testAccount.data?.user?.email?.match(/^codex-johnson-clean-(\d{14})@example\.test$/);
assert.ok(accountRun, 'Reuse the existing documented dedicated test account; never create users');
const signed = await auth.auth.signInWithPassword({ email: testAccount.data.user.email, password: 'Codex-' + accountRun[1] + '-Pass!' });
assert.equal(Boolean(signed.error), false, 'Dedicated test account sign-in succeeds');
const authSession = signed.data.session;
assert.ok(authSession?.access_token, 'Real authenticated session available');
const apiOrigin = process.env.TAKEOFF_TEST_API_ORIGIN || 'http://127.0.0.1:3000';
const planPath = process.env.TAKEOFF_TEST_PLAN || 'C:/Users/grant/Downloads/KRESS ROAD.pdf';
assert.ok(fs.existsSync(planPath), 'Actual construction PDF exists');
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'artifacts/test-artifacts/takeoff-ai-real');
const componentPath = path.join(root, 'components/construction-estimation/ai-plan-takeoff/AIPlanTakeoffStandalone.jsx');
const workbookHookPath = path.join(root, 'hooks/estimate-builder/useEstimateBuilderWorkbook.js');
const takeoffDir = path.dirname(componentPath);
const jobId = 'isolated-real-kress-ai-acceptance';
fs.mkdirSync(out, { recursive: true });
const resume = process.env.TAKEOFF_TEST_RESUME === '1';
const runtimePath = path.join(out, 'isolated-runtime.json');
const resumedRuntime = resume ? JSON.parse(fs.readFileSync(runtimePath, 'utf8')) : null;
const previousReport = resume ? JSON.parse(fs.readFileSync(path.join(out, 'report.json'), 'utf8')) : null;

// Read React hook values without changing production code. Account for custom
// hooks because their internal hooks occupy entries in the same Fiber chain.
function mapHooks(file, functionName, stack = new Set()) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, /x$/.test(file) ? ts.ScriptKind.JSX : ts.ScriptKind.JS);
  const imports = new Map();
  for (const node of source.statements) {
    if (!ts.isImportDeclaration(node)) continue;
    const specifier = node.moduleSpecifier.text;
    if (!specifier.startsWith('.')) continue;
    const base = path.resolve(path.dirname(file), specifier);
    const importedFile = [base, base + '.js', base + '.jsx', base + '.ts', base + '.tsx'].find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
    if (!importedFile) continue;
    const clause = node.importClause;
    if (clause?.name) imports.set(clause.name.text, { file: importedFile, name: 'default' });
    if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const element of clause.namedBindings.elements) imports.set(element.name.text, { file: importedFile, name: element.propertyName?.text || element.name.text });
    }
  }
  let body;
  for (const node of source.statements) {
    if (ts.isFunctionDeclaration(node) && (node.name?.text === functionName || functionName === 'default' && node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.DefaultKeyword))) body = node.body;
    if (ts.isVariableStatement(node)) for (const declaration of node.declarationList.declarations) {
      if (declaration.name.getText(source) === functionName && declaration.initializer && ts.isArrowFunction(declaration.initializer)) body = declaration.initializer.body;
    }
  }
  assert.ok(body, `Find hook/component ${functionName} in ${file}`);
  const identity = `${file}:${functionName}`;
  assert.ok(!stack.has(identity), `No recursive custom hook ${identity}`);
  const nextStack = new Set([...stack, identity]);
  let count = 0;
  const indexes = {};
  function visit(node) {
    if (ts.isFunctionLike(node)) return;
    if (ts.isCallExpression(node)) {
      const called = node.expression.getText(source).replace(/^React\./, '');
      if (/^use(State|Ref|Effect|LayoutEffect|InsertionEffect|Callback|Memo|Reducer|DeferredValue|Id|SyncExternalStore)$/.test(called)) {
        const declaration = node.parent;
        if (ts.isVariableDeclaration(declaration)) {
          const name = ts.isArrayBindingPattern(declaration.name) ? declaration.name.elements[0]?.name?.getText(source) : declaration.name.getText(source);
          if (name) indexes[name] = count;
        }
        count += 1;
        return;
      }
      if (/^use[A-Z]/.test(called) && imports.has(called)) {
        const imported = imports.get(called);
        count += mapHooks(imported.file, imported.name, nextStack).count;
        return;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(body);
  return { count, indexes };
}

const indexes = mapHooks(componentPath, 'AIPlanTakeoffStandalone').indexes;
console.log('Building real Takeoff and workbook hook browser bundle.');
const loader = path.join(out, 'jsx-loader.cjs');
fs.writeFileSync(loader, `const ts=require(${JSON.stringify(require.resolve('typescript'))});module.exports=function(source){return ts.transpileModule(source,{fileName:this.resourcePath,compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;};`);
const entry = path.join(out, 'browser-entry.cjs');
fs.writeFileSync(entry, `
const React=require('react');
const {createRoot}=require('react-dom/client');
const Takeoff=require(${JSON.stringify(componentPath)}).default;
const {useEstimateBuilderWorkbook}=require(${JSON.stringify(workbookHookPath)});
const {createEstimateBuilderWorkbookDefaults}=require(${JSON.stringify(path.join(root, 'lib/construction-estimation/estimateBuilderWorkbookDefaults.js'))});
const {createJobData,prepareAiPlanTakeoffJobForSave}=require(${JSON.stringify(path.join(takeoffDir, 'jobPersistence.js'))});
const {createTakeoffSchedule}=require(${JSON.stringify(path.join(takeoffDir, 'takeoffSchedule.js'))});
const {materializeTakeoffPlanPages}=require(${JSON.stringify(path.join(takeoffDir, 'planBlobStorage.js'))});
const indexes=${JSON.stringify(indexes)};
const jobId=${JSON.stringify(jobId)};
const reactRoot=createRoot(document.getElementById('root'));
let currentSheet=null,control=null;
const saveResults=[];
const initialJob=createJobData({name:'Isolated Kress real AI acceptance',takeoffId:'isolated-real-kress-takeoff',associatedProjectId:jobId,associatedProjectName:'Isolated Kress real AI acceptance',currentPage:1,totalPages:0,rotation:0,pixelsPerMm:null,planPages:[],planFilename:'',projectInfo:{projectName:'Isolated Kress real AI acceptance'},platformProject:{projectId:jobId,projectName:'Isolated Kress real AI acceptance'}});
function findFiber(fiber){if(!fiber)return null;if(fiber.type===Takeoff)return fiber;return findFiber(fiber.child)||findFiber(fiber.sibling);}
function hooks(){const values=[];let hook=findFiber(reactRoot._internalRoot.current)?.memoizedState;while(hook){values.push(hook);hook=hook.next;}return values;}
function value(name){return hooks()[indexes[name]]?.memoizedState;}
function dispatch(name,next){const hook=hooks()[indexes[name]];if(!hook?.queue?.dispatch)throw Error('Missing state hook '+name);hook.queue.dispatch(next);}
function snapshot(){
 const result={};for(const name of ['currentPage','totalPages','pixelsPerMm','rotation','stageScale','stagePos','activeTool','activePolyline','selectedWallId','selectedOpeningId','completedWallRuns','placedOpenings','completedAreas','completedFloorplans','completedMeasurements','completedEaves','sheetLevels','savedRevision','hasUnsavedChanges','platformSaveMessage','planLoadError','planFilename'])result[name]=value(name);
 result.imageReady=Boolean(value('image'));result.mounted=Boolean(findFiber(reactRoot._internalRoot.current));
 result.planPages=(value('planPages')||[]).map(p=>({pageNumber:p.pageNumber,hasImage:Boolean(p.dataUrl),dataUrlAssetId:p.dataUrlAssetId||null,logicalWidth:p.logicalWidth,logicalHeight:p.logicalHeight,pdfUnits:p.pdfUnits,textItemCount:p.textItems?.length||0}));
 result.schedule=createTakeoffSchedule({...result});
 return JSON.parse(JSON.stringify(result));
}
const frame=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
function Shell(){
 const sheet=useEstimateBuilderWorkbook();currentSheet=sheet;
 const [request,setRequest]=React.useState(null);
 const [visible,setVisible]=React.useState(true);
 const [mount,setMount]=React.useState(0);
 const opened=React.useRef(false);
 React.useEffect(()=>{if(!sheet.hydrated||opened.current)return;const job=sheet.workbook.aiPlanTakeoffJob;if(job?.takeoffId){opened.current=true;setRequest({requestId:'startup-'+Date.now(),jobData:job});}},[sheet.hydrated,sheet.workbook]);
 control={async open(job){opened.current=true;setRequest({requestId:'open-'+Date.now(),jobData:job});},async reopen(){setVisible(false);await frame();const result=await currentSheet.openSavedJob('job:'+jobId);if(!result.ok)throw Error(result.message);setRequest({requestId:'reopen-'+Date.now(),jobData:result.workbook.aiPlanTakeoffJob});setMount(n=>n+1);setVisible(true);return result.key;}};
 if(!sheet.hydrated)return React.createElement('div',null,'Loading workbook');
 return visible?React.createElement(Takeoff,{key:mount,embedded:true,openTakeoffJobRequest:request,platformContext:{projectId:jobId,projectName:'Isolated Kress real AI acceptance',noJobOpen:false,isHydratingProject:false},onSaveToPlatform:async incoming=>{const workbook=currentSheet.getCurrentWorkbook();const prepared=prepareAiPlanTakeoffJobForSave(workbook.aiPlanTakeoffJob,incoming,jobId);const result=prepared.ok?await currentSheet.saveAiPlanTakeoffJob(prepared.job):prepared;saveResults.push(result);return result;}}):React.createElement('div',null,'Takeoff closed');
}
window.harness={snapshot,saveResults:()=>saveResults,ready:()=>Boolean(currentSheet?.hydrated),
 async seed(){const workbook={...createEstimateBuilderWorkbookDefaults(),jobId,projectId:jobId,commercialProjectId:jobId,projectName:'Isolated Kress real AI acceptance',registeredJob:{jobId,jobName:'Isolated Kress real AI acceptance'},jobFileMeta:{projectId:jobId,jobName:'Isolated Kress real AI acceptance'},aiPlanTakeoffJob:initialJob,takeoffEngine:{aiPlanTakeoffJob:initialJob}};const result=await currentSheet.loadJobFileData({workbook,jobName:'Isolated Kress real AI acceptance'},'isolated-kress-ai.gr8job');if(!result.ok)throw Error(result.message);await control.open(initialJob);return result;},
 reopen:()=>control.reopen(),
 setView({zoom,pan}){value('sheetViewStateRef').current[value('currentPage')]={scale:zoom,pos:pan};dispatch('stageScale',zoom);dispatch('stagePos',pan);},
 viewSize(){return {width:value('stageRef').current.width(),height:value('stageRef').current.height()};},
 point(point){const stage=value('stageRef').current,layer=value('layerRef').current,rect=stage.content.getBoundingClientRect(),visible=layer.getAbsoluteTransform().point(point);return {x:rect.left+visible.x*rect.width/stage.width(),y:rect.top+visible.y*rect.height/stage.height()};},
 async stored(){const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('estimate-builder-template-db',2);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});const record=await new Promise((resolve,reject)=>{const request=db.transaction('jobs','readonly').objectStore('jobs').get('job:'+jobId);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});db.close();const materialized=await materializeTakeoffPlanPages(record.workbook);return {key:record.key,revision:record.revision,checksum:record.checksum,raw:record.workbook.aiPlanTakeoffJob,job:materialized.aiPlanTakeoffJob,mirror:materialized.takeoffEngine.aiPlanTakeoffJob};}
};
reactRoot.render(React.createElement(Shell));
`);

const webpackPackage = require('next/dist/compiled/webpack/webpack');
webpackPackage.init();
const webpack = webpackPackage.webpack;
await new Promise((resolve, reject) => {
  const compiler = webpack({
    mode: 'development', target: 'web', devtool: false, context: root, entry,
    output: { path: out, filename: 'browser-bundle.js' },
    resolve: { extensions: ['.js', '.jsx', '.mjs', '.ts', '.tsx'], mainFields: ['browser', 'module', 'main'], fallback: { canvas: false, fs: false, path: false, url: false } },
    module: { rules: [{ test: /\.[jt]sx?$/, exclude: /node_modules/, resolve: { fullySpecified: false }, use: loader }] },
    plugins: [new webpack.IgnorePlugin({ resourceRegExp: /^node:/ }), new webpack.DefinePlugin({ 'process.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(supabaseUrl), 'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnon) })],
    optimization: { minimize: false }, performance: { hints: false },
  });
  compiler.run((error, stats) => {
    const result = stats?.toJson({ all: false, errors: true, warnings: true });
    fs.writeFileSync(path.join(out, 'build.json'), JSON.stringify(result || { error: String(error) }, null, 2));
    compiler.close(() => error || stats?.hasErrors() ? reject(error || new Error(JSON.stringify(result.errors))) : resolve());
  });
});
console.log('Browser bundle ready; starting isolated Chromium acceptance checks.');

const report = {
  scope: 'Actual Kress PDF uploaded through existing UI; real authenticated production API; existing canonical adapter, canvas, schedule and workbook IndexedDB persistence; isolated local test job and profile only.',
  source: { path: planPath, bytes: fs.statSync(planPath).size, suppliedPages: 1, drawingSheet: '4 of 18', printedScale: '1:100', printedAreaM2: { Living: 221, Alfresco: 56.23, Garage: 40.31, Patio: 30.14, 'Side Patio': 7.59, Total: 355.27 }, areaTableOriginalPageNormalizedBounds: { x1: 0.815, y1: 0.772, x2: 0.966, y2: 0.968 }, scaleOriginalPageNormalizedBounds: { x1: 0.090, y1: 0.424, x2: 0.123, y2: 0.501 }, note: 'Benchmarks independently transcribed from the actual drawing. They are never sent to the provider or used to alter detections.' },
  requests: previousReport?.requests || [], progress: previousReport?.progress || [], cases: {}, errors: [], dialogs: [],
};
const server = http.createServer(async (req, res) => {
  if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'application/javascript'); fs.createReadStream(path.join(out, 'browser-bundle.js')).pipe(res); return; }
  if (req.url === '/pdfjs/pdf.worker.min.mjs') { res.setHeader('Content-Type', 'application/javascript'); fs.createReadStream(path.join(root, 'public/pdfjs/pdf.worker.min.mjs')).pipe(res); return; }
  if (req.url === '/api/ai/takeoff-analyse') {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks).toString('utf8');
      const parsed = JSON.parse(body);
      const record = { action: parsed.action, page: parsed.page?.pageNumber, logicalWidth: parsed.page?.logicalWidth, logicalHeight: parsed.page?.logicalHeight, imageRotation: parsed.page?.imageRotation, imageBytes: parsed.page?.imageDataUrl?.length || 0, startedAt: new Date().toISOString() };
      report.requests.push(record);
      console.log(`Real authenticated AI request: ${record.action}, sheet ${record.page}.`);
      const upstream = await fetch(apiOrigin + req.url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization || '' }, body, signal: AbortSignal.timeout(600000) });
      const responseBody = await upstream.text();
      record.status = upstream.status;
      record.completedAt = new Date().toISOString();
      try { record.response = JSON.parse(responseBody); } catch { record.response = { error: 'Non-JSON response', length: responseBody.length }; }
      // API response contains detection evidence only. Bearer tokens, environment
      // values, session data and uploaded image bytes are never written to report.
      fs.writeFileSync(path.join(out, 'api-responses.json'), JSON.stringify(report.requests, null, 2));
      console.log(`AI ${record.action} returned HTTP ${record.status}.`);
      res.statusCode = upstream.status; res.setHeader('Content-Type', 'application/json'); res.end(responseBody);
    } catch (error) { res.statusCode = 502; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: error.message })); }
    return;
  }
  res.setHeader('Content-Type', 'text/html');
  res.end('<!doctype html><meta charset="utf-8"><title>Real Kress AI Takeoff acceptance</title><style>html,body,#root{height:100%;margin:0;font-family:Arial}</style><div id="root"></div><script src="/bundle.js"></script>');
});
let browser;
let page;
try {
  await new Promise(resolve => server.listen(resumedRuntime?.port || 0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const profile = resumedRuntime?.profile || path.join(out, 'isolated-browser-' + Date.now());
  fs.writeFileSync(runtimePath, JSON.stringify({ port: server.address().port, profile }, null, 2));
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, userDataDir: profile, args: ['--no-first-run', '--disable-extensions', '--disable-background-networking'], defaultViewport: { width: 1800, height: 1400 } });
  page = await browser.newPage();
  page.setDefaultTimeout(60000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('dialog', async dialog => { report.dialogs.push(dialog.message()); if (dialog.type() === 'confirm' && dialog.message() === 'Delete selected item?') await dialog.accept(); else await dialog.dismiss(); });
  await page.setRequestInterception(true);
  page.on('request', request => request.url().startsWith(origin) || request.url().startsWith(supabaseUrl + '/auth/') || /^(data|blob):/.test(request.url()) ? request.continue() : request.abort());
  await page.evaluateOnNewDocument(({ storageKey, session }) => { if (!localStorage.getItem(storageKey)) localStorage.setItem(storageKey, JSON.stringify(session)); }, { storageKey: `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`, session: authSession });
  await page.goto(origin, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.harness?.ready());
  let scaleConfirmed = Boolean(resume && previousReport?.cases?.scaleConfirmation);
  if (resume) {
    await ready();
    report.cases.scaleConfirmation = previousReport?.cases?.scaleConfirmation;
    report.cases.uploaded = previousReport?.cases?.uploaded;
    report.resumedExistingIsolatedSave = true;
    console.log('Resuming existing isolated canonical save; no new provider calls.');
  } else {
  await page.evaluate(() => harness.seed());
  await page.waitForSelector('input[type="file"][accept="image/*,.pdf"]');
  await (await page.$('input[type="file"][accept="image/*,.pdf"]')).uploadFile(planPath);
  await ready();
  const uploaded = report.cases.uploaded = await snapshot();
  assert.equal(uploaded.planFilename, path.basename(planPath));
  assert.equal(uploaded.totalPages, 1);
  assert.equal(uploaded.completedWallRuns.length, 0);
  assert.equal(uploaded.placedOpenings.length, 0);
  assert.equal(uploaded.pixelsPerMm, null, 'Analysis starts without injected calibration');
  assert.ok(uploaded.planPages[0].pdfUnits, 'Original PDF paper units are retained by existing upload');
  assert.equal(await page.$('#ai-takeoff-development-fixture'), null, 'No development fixture action in normal workflow');
  await page.screenshot({ path: path.join(out, '1-actual-kress-uploaded.png') });
  console.log('Actual Kress construction PDF uploaded through existing Takeoff file input.');

  await page.click('#run-ai-takeoff');
  const started = Date.now();
  while (Date.now() - started < 720000) {
    const status = await page.evaluate(() => ({ text: document.querySelector('#ai-takeoff-status')?.textContent || '', scale: Boolean(document.querySelector('#ai-takeoff-confirm-scale')), review: Boolean(document.querySelector('#ai-takeoff-review')) }));
    if (report.progress.at(-1)?.text !== status.text) { report.progress.push({ at: new Date().toISOString(), text: status.text }); console.log('AI progress:', status.text); }
    if (status.scale && !scaleConfirmed) {
      report.cases.scaleConfirmation = { ...status, calibrationBefore: (await snapshot()).pixelsPerMm };
      await page.screenshot({ path: path.join(out, '2-detected-scale-confirmation.png') });
      await page.click('#ai-takeoff-confirm-scale'); scaleConfirmed = true;
    }
    const state = await snapshot();
    if (status.review && state.completedWallRuns.some(wall => wall.source === 'ai')) break;
    if (/could not|failed|error|calibrate the plan|Use the existing Calibrate tool|conflicts across|before analysis continues|No measurable/i.test(status.text)) throw new Error(status.text);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  }
  let state = report.cases.analysed = await snapshot();
  assert.ok(state.completedWallRuns.some(wall => wall.source === 'ai'), 'Real provider detections reached canonical canvas through bridge');
  assert.ok(state.completedWallRuns.some(wall => wall.category === 'exterior'));
  assert.ok(state.completedWallRuns.some(wall => wall.category === 'interior'));
  assert.ok(state.placedOpenings.filter(opening => opening.source === 'ai').length >= 2, 'Real openings available for edit and delete acceptance');
  assert.ok(report.requests.some(request => request.action === 'inspect' && request.status === 200 && request.response?.ok));
  assert.ok(report.requests.some(request => request.action === 'measure' && request.status === 200 && request.response?.ok));
  assert.equal(scaleConfirmed, true, 'Detected drawing scale was explicitly confirmed');
  assertSchedule(state);
  await page.screenshot({ path: path.join(out, '3-real-ai-geometry.png') });
  report.cases.admission = { walls: state.completedWallRuns.length, exterior: state.completedWallRuns.filter(wall => wall.category === 'exterior').length, interior: state.completedWallRuns.filter(wall => wall.category === 'interior').length, openings: state.placedOpenings.length, buildingAreas: state.completedFloorplans.length, pixelsPerMm: state.pixelsPerMm, providerModels: [...new Set(report.requests.map(request => request.response?.model))] };
  await page.click('#ai-takeoff-review'); await settle();
  await captureSchedule('4-real-takeoff-schedule.png');
  await save(true);
  const firstStored = await page.evaluate(() => harness.stored());
  report.cases.originalAnalysis = firstStored.job.scheduleState?.aiAnalysis || firstStored.job.scheduleState?.aiTakeoffAnalysis || firstStored.job.scheduleState;
  const documented = report.requests.find(request => request.action === 'measure')?.response?.analysis?.documentedQuantities || [];
  report.cases.printedBenchmarkComparison = Object.entries(report.source.printedAreaM2).map(([name, expected]) => ({ name, printedM2: expected, observedByProvider: documented.filter(item => String(item.name || item.type || item.label || '').toLowerCase().includes(name.toLowerCase())).map(item => ({ ...item, differenceFromIndependentTranscriptionM2: item.value - expected })) }));
  console.log('Real AI walls/openings render and live schedule is populated; exercising existing manual editing.');

  // Select and drag the endpoint of a real detected wall with existing tools.
  // Choose the last rendered suitable wall: earlier coincident endpoint handles
  // can sit under a later wall's existing wide selection hit region.
  const wall = [...state.completedWallRuns].reverse().find(item => item.source === 'ai' && item.nodes.length >= 2 && segmentLength(item) > 20);
  const midpoint = { x: (wall.nodes[0].x + wall.nodes[1].x) / 2, y: (wall.nodes[0].y + wall.nodes[1].y) / 2 };
  await centre(midpoint); await button('Select'); await clickPlan(midpoint);
  await page.waitForFunction(id => harness.snapshot().selectedWallId === id, {}, wall.id);
  const endpoint = wall.nodes[0];
  const target = { x: endpoint.x + (Math.abs(wall.nodes[1].x - endpoint.x) >= Math.abs(wall.nodes[1].y - endpoint.y) ? -10 : 0), y: endpoint.y + (Math.abs(wall.nodes[1].x - endpoint.x) < Math.abs(wall.nodes[1].y - endpoint.y) ? -10 : 0) };
  await centre(endpoint); await dragPlan(endpoint, target);
  state = await snapshot();
  const editedWall = state.completedWallRuns.find(item => item.id === wall.id);
  assert.notDeepEqual(editedWall.nodes, wall.nodes, 'AI wall supports existing vertex drag');
  assert.notEqual(editedWall.lengthMm, wall.lengthMm, 'AI wall length recalculates after manual edit');
  assert.equal(editedWall.source, 'ai');
  assertSchedule(state);
  report.cases.editedWall = { id: wall.id, beforeMm: wall.lengthMm, afterMm: editedWall.lengthMm, scheduleAfterM: state.schedule.measurementRecords.find(item => item.id === wall.id).quantity };

  const opening = state.placedOpenings.find(item => item.source === 'ai');
  await centre(opening); await clickPlan(opening);
  await page.waitForFunction(id => harness.snapshot().selectedOpeningId === id, {}, opening.id);
  await editLabelInput('Location / room', 'Builder reviewed Kress opening');
  const editedOpening = (await snapshot()).placedOpenings.find(item => item.id === opening.id);
  assert.equal(editedOpening.location, 'Builder reviewed Kress opening');
  const deletedOpening = state.placedOpenings.find(item => item.source === 'ai' && item.id !== opening.id);
  await centre(deletedOpening); await clickPlan(deletedOpening);
  await page.waitForFunction(id => harness.snapshot().selectedOpeningId === id, {}, deletedOpening.id);
  await page.keyboard.press('Delete');
  await page.waitForFunction(id => !harness.snapshot().placedOpenings.some(item => item.id === id), {}, deletedOpening.id);
  report.cases.openingEditDelete = { editedId: opening.id, deletedId: deletedOpening.id };

  // Add an ordinary manual measurement on the blank paper margin.
  const count = (await snapshot()).completedWallRuns.length;
  await centre({ x: 90, y: 35 }); await button('Walls');
  await clickPlan({ x: 45, y: 35 }); await clickPlan({ x: 115, y: 35 });
  await button('Finish Wall Run', true);
  await page.waitForFunction(count => harness.snapshot().completedWallRuns.length === count + 1, {}, count);
  state = report.cases.editedMixed = await snapshot();
  const manual = state.completedWallRuns.find(item => item.source !== 'ai');
  assert.ok(manual, 'Existing manual drawing works after real AI takeoff');
  assertSchedule(state);
  await save();
  const stored = await page.evaluate(() => harness.stored());
  assert.deepEqual(stored.job, stored.mirror, 'Canonical workbook takeoff and existing mirror match');
  assert.ok(stored.raw.plan.pages.every(plan => plan.dataUrlAssetId && !plan.dataUrl), 'Existing persistence externalizes actual PDF page raster');
  assert.ok(stored.job.plan.pages.every(plan => plan.dataUrl), 'Existing load restores actual PDF page raster');
  assert.ok(stored.job.scheduleState?.aiAppliedRuns?.length, 'Existing scheduleState retains admission receipt');
  report.cases.persistence = { key: stored.key, revision: stored.revision, checksum: stored.checksum, takeoffRevision: stored.job.revision, wallCount: stored.job.completedWallRuns.length, openingCount: stored.job.placedOpenings.length, scheduleState: stored.job.scheduleState };
  await page.evaluate(() => harness.reopen()); await ready();
  state = report.cases.reopened = await snapshot();
  assert.deepEqual(state.completedWallRuns.find(item => item.id === editedWall.id), editedWall, 'Edited AI wall and evidence survive real save/reopen');
  assert.deepEqual(state.completedWallRuns.find(item => item.id === manual.id), manual, 'Manual object survives alongside AI objects');
  assert.deepEqual(state.placedOpenings.find(item => item.id === editedOpening.id), { ...editedOpening, openingType: editedOpening.type }, 'AI opening metadata and edits survive reopen');
  assert.ok(!state.placedOpenings.some(item => item.id === deletedOpening.id));
  assertSchedule(state);
  await page.screenshot({ path: path.join(out, '5-edited-saved-reopened.png') });
  const requestCount = report.requests.length;
  await page.click('#run-ai-takeoff'); await settle();
  await page.waitForFunction(() => /already been analysed|already in the takeoff/i.test(document.querySelector('#ai-takeoff-status')?.textContent || ''));
  assert.equal(report.requests.length, requestCount, 'Saved receipt suppresses repeat paid requests and deleted-object resurrection');
  await page.reload({ waitUntil: 'load', timeout: 60000 }); await ready();
  state = report.cases.fullReload = await snapshot();
  assert.equal(state.completedWallRuns.length, count + 1);
  assert.ok(state.completedWallRuns.some(item => item.id === manual.id && item.source !== 'ai'));
  assert.ok(state.completedWallRuns.some(item => item.id === editedWall.id && item.source === 'ai'));
  assert.ok(!state.placedOpenings.some(item => item.id === deletedOpening.id));
  assertSchedule(state);
  await page.screenshot({ path: path.join(out, '6-reloaded-real-ai-and-manual.png') });
  assert.deepEqual(report.errors, [], 'No browser runtime errors');
  assert.deepEqual(report.dialogs, ['Delete selected item?']);
  report.ok = true;
  console.log('Real AI browser acceptance passed: actual plan, authenticated provider calls, scale confirmation, canonical geometry/schedule, manual edits/delete/add, Save and reopen.');
} catch (error) {
  report.error = error.stack || String(error);
  if (page) { report.failureState = await snapshot().catch(() => null); await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {}); }
  throw error;
} finally {
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  await browser?.close();
  await new Promise(resolve => server.listening ? server.close(resolve) : resolve());
}

function close(actual, expected, message) { assert.ok(Math.abs(actual - expected) < 0.00001, `${message}: expected ${expected}, received ${actual}`); }
function segmentLength(wall) { return Math.hypot(wall.nodes[1].x - wall.nodes[0].x, wall.nodes[1].y - wall.nodes[0].y); }
async function snapshot() { return page.evaluate(() => harness.snapshot()); }
async function settle() { await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); }
async function ready() { await page.waitForFunction(() => window.harness?.snapshot().imageReady && harness.snapshot().currentPage === 1, { timeout: 60000 }); await settle(); }
async function centre(point) { await page.evaluate(point => { const size = harness.viewSize(); harness.setView({ zoom: 1, pan: { x: size.width / 2 - point.x, y: size.height / 2 - point.y } }); }, point); await settle(); }
async function button(label, prefix = false) { const found = await page.evaluate(({ label, prefix }) => { const element = [...document.querySelectorAll('button')].find(item => prefix ? item.textContent.trim().startsWith(label) : item.textContent.trim() === label); if (!element) return false; element.click(); return true; }, { label, prefix }); assert.ok(found, `Find button ${label}`); await settle(); }
async function clickPlan(point) { const client = await page.evaluate(point => harness.point(point), point); await page.mouse.move(client.x, client.y); await page.mouse.click(client.x, client.y); await settle(); await new Promise(resolve => setTimeout(resolve, 650)); }
async function dragPlan(from, to) { const points = await page.evaluate(({ from, to }) => [harness.point(from), harness.point(to)], { from, to }); await page.mouse.move(points[0].x, points[0].y); await page.mouse.down(); await page.mouse.move(points[1].x, points[1].y, { steps: 12 }); await page.mouse.up(); await settle(); }
async function save(fromAiAction = false) { const count = await page.evaluate(() => harness.saveResults().length); await page.evaluate(fromAiAction => document.getElementById(fromAiAction ? 'ai-takeoff-save' : 'ai-plan-takeoff-save-button').click(), fromAiAction); await page.waitForFunction(count => harness.saveResults().length > count, { timeout: 60000 }, count); const result = await page.evaluate(() => harness.saveResults().at(-1)); assert.equal(result.ok, true, result.message); assert.equal(result.verification?.ok, true); await page.waitForFunction(() => !harness.snapshot().hasUnsavedChanges); }
async function editLabelInput(label, text) { const input = await page.evaluateHandle(label => [...document.querySelectorAll('label')].find(element => element.textContent.trim().startsWith(label))?.querySelector('input'), label); assert.ok(input.asElement(), `Find input ${label}`); await input.asElement().click({ clickCount: 3 }); await page.keyboard.type(text); await page.keyboard.press('Tab'); await settle(); await input.dispose(); }
async function captureSchedule(filename) {
  await button('Takeoff Schedule', true);
  report.cases.displayedSchedule = await page.evaluate(() => {
    const result = {};
    for (const section of document.querySelectorAll('details')) {
      const title = section.querySelector('summary')?.textContent.trim();
      if (['Exterior Walls', 'Interior Walls and Plasterboard', 'Windows', 'Doors', 'Floor Plans'].includes(title) && !result[title]) result[title] = [...section.querySelectorAll('tbody tr')].map(row => [...row.querySelectorAll('td')].map(cell => cell.textContent.trim()));
    }
    return result;
  });
  assert.ok(report.cases.displayedSchedule['Exterior Walls']?.length);
  assert.ok(report.cases.displayedSchedule['Interior Walls and Plasterboard']?.length);
  assert.ok(report.cases.displayedSchedule.Windows?.length);
  await page.screenshot({ path: path.join(out, filename) }); await button('Close');
}
function assertSchedule(state) {
  const records = state.schedule.measurementRecords;
  for (const wall of state.completedWallRuns) {
    const record = records.find(item => item.id === String(wall.id) && item.kind === 'wall');
    assert.ok(record, `Schedule includes wall ${wall.id}`);
    const length = wall.nodes.slice(1).reduce((sum, node, index) => sum + Math.hypot(node.x - wall.nodes[index].x, node.y - wall.nodes[index].y), 0) / state.pixelsPerMm / 1000;
    close(record.quantity, length, `Schedule length ${wall.id}`);
    assert.equal(record.category, wall.category);
  }
  for (const opening of state.placedOpenings) {
    const record = records.find(item => item.id === String(opening.id) && item.kind === 'opening');
    assert.ok(record, `Schedule includes opening ${opening.id}`);
    assert.equal(record.quantity, Number(opening.quantity || 1));
  }
}

