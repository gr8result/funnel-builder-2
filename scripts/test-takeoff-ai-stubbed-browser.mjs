import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import puppeteer from 'puppeteer';
import { createTakeoffAnalysisHandler } from '../lib/construction-estimation/aiTakeoffAnalysis.js';

// Live click-path acceptance WITHOUT a paid provider. The real Takeoff component,
// workbook hook, AiTakeoffAction, analysis hook, client, takeoff-analyse handler,
// normalisation, bridge, canvas, save and reopen all run unmodified. Only the
// OpenAI HTTP call inside the handler is replaced by a deterministic fake, and
// Supabase auth is replaced by a local session (withAuth is bypassed).
// Flow mirrors the estimator: new job -> upload plan -> calibrate -> manual wall
// -> RUN AI TAKEOFF (unconfigured server first, then configured) -> save -> reopen.
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'artifacts/test-artifacts/takeoff-ai-stubbed');
const componentPath = path.join(root, 'components/construction-estimation/ai-plan-takeoff/AIPlanTakeoffStandalone.jsx');
const workbookHookPath = path.join(root, 'hooks/estimate-builder/useEstimateBuilderWorkbook.js');
const takeoffDir = path.dirname(componentPath);
const jobId = 'stubbed-ai-takeoff-job';
const supabaseUrl = 'https://stubbedtakeoff.supabase.invalid';
fs.mkdirSync(out, { recursive: true });

// ---- Fake provider: OpenAI Responses envelope, normalised 0..1 coordinates ----
const evidence = (text, confidence = 0.92) => ({ page: 1, basis: 'OBSERVED', confidence, evidence: text });
const wallSystem = { constructionSystem: null, frameThicknessMm: null, exteriorFinish: null, exteriorFinishCustomLabel: null, customSystemLabel: null };
const inspection = { page: 1, textDirection: 'left-to-right', rotationToUpright: 0, drawingType: 'floor_plan', relevant: true, level: 'Ground Floor',
  scale: { denominator: 100, basis: 'OBSERVED', confidence: 0.95, evidence: 'Printed SCALE 1:100.' }, writtenDimensions: [], review: [] };
const measurement = {
  page: 1, level: 'Ground Floor',
  walls: [
    { detectionId: 'W01', ...evidence('North and east outer wall.'), nodes: [{ x: 0.2, y: 0.25 }, { x: 0.8, y: 0.25 }, { x: 0.8, y: 0.75 }], category: 'exterior', thicknessMm: null, wallHeightM: null, exteriorType: 'Other', ...wallSystem },
    { detectionId: 'W02', ...evidence('South and west outer wall.'), nodes: [{ x: 0.8, y: 0.75 }, { x: 0.2, y: 0.75 }, { x: 0.2, y: 0.25 }], category: 'exterior', thicknessMm: null, wallHeightM: null, exteriorType: 'Other', ...wallSystem },
    { detectionId: 'W03', ...evidence('Internal wall between Bed 1 and Living.'), nodes: [{ x: 0.5, y: 0.25 }, { x: 0.5, y: 0.75 }], category: 'interior', thicknessMm: null, wallHeightM: null, exteriorType: 'Other', ...wallSystem },
  ],
  openings: [
    { detectionId: 'O01', ...evidence('Window 1218 on north wall.'), x: 0.35, y: 0.25, type: 'window', openingClass: 'Window', hostDetectionId: null, tag: '1218', sizeCode: '1218', explicitWidthMm: null, explicitHeightMm: null, widthMm: 1800, heightMm: 1200, dimensionBasis: 'DERIVED', dimensionEvidence: 'Window code 1218.', subType: null, quantity: 1, glassType: null, scheduleGlassType: null },
    { detectionId: 'O02', ...evidence('Entry door on south wall.'), x: 0.65, y: 0.75, type: 'door', openingClass: 'External Door', hostDetectionId: null, tag: 'D1', sizeCode: null, explicitWidthMm: null, explicitHeightMm: null, widthMm: 820, heightMm: 2040, dimensionBasis: 'ASSUMED', dimensionEvidence: 'Standard entry door.', subType: null, quantity: 1, glassType: null, scheduleGlassType: null },
  ],
  pillars: [], eaves: [],
  buildingAreas: [{ detectionId: 'A01', ...evidence('Living area inside outer walls.'), type: 'Living', label: 'Living', nodes: [{ x: 0.2, y: 0.25 }, { x: 0.8, y: 0.25 }, { x: 0.8, y: 0.75 }, { x: 0.2, y: 0.75 }] }],
  rooms: [{ page: 1, name: 'BED 1', x: 0.35, y: 0.5, basis: 'OBSERVED', confidence: 0.95, evidence: 'Label BED 1.' }, { page: 1, name: 'LIVING', x: 0.65, y: 0.5, basis: 'OBSERVED', confidence: 0.95, evidence: 'Label LIVING.' }],
  fixtures: [], documentedQuantities: [], review: [],
};
const providerCalls = [];
const fakeOpenAi = async (url, options) => {
  const body = JSON.parse(options.body);
  const format = body.text.format.name;
  const scopeText = body.input[0].content.map((item) => item.text || '').join('\n');
  const scope = /Return only walls/.test(scopeText) ? 'geometry' : /Return only openings/.test(scopeText) ? 'items' : null;
  providerCalls.push({ url, format, scope, model: body.model });
  let analysis = format === 'takeoff_inspect_v1' ? inspection : structuredClone(measurement);
  if (scope === 'geometry') Object.assign(analysis, { openings: [], rooms: [], fixtures: [], documentedQuantities: [] });
  if (scope === 'items') Object.assign(analysis, { walls: [], buildingAreas: [], pillars: [], eaves: [] });
  return { ok: true, status: 200, headers: { get: () => 'stub-provider-request' },
    json: async () => ({ id: 'stub-response', model: 'stub-model', status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(analysis) }] }] }) };
};
const unconfiguredHandler = createTakeoffAnalysisHandler({ env: {}, fetchImpl: async () => { throw new Error('Provider must not be called when unconfigured.'); } });
const configuredHandler = createTakeoffAnalysisHandler({ env: { OPENAI_API_KEY: 'stub-not-a-real-key' }, fetchImpl: fakeOpenAi });
// Provider accepts inspection but rejects measurement (HTTP 500): the real error must be shown.
const measureFailsHandler = createTakeoffAnalysisHandler({ env: { OPENAI_API_KEY: 'stub-not-a-real-key' }, fetchImpl: async (url, options) => JSON.parse(options.body).text.format.name === 'takeoff_inspect_v1'
  ? fakeOpenAi(url, options) : { ok: false, status: 500, headers: { get: () => 'stub-failed-request' }, json: async () => ({ error: { code: 'server_error', type: 'server_error' } }) } });
let serverMode = 'unconfigured';
const apiRequests = [];

// ---- Bundle the live component inside a real-app-shaped workbook shell ----
function mapHooks(file, functionName, stack = new Set()) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, /x$/.test(file) ? ts.ScriptKind.JSX : ts.ScriptKind.JS);
  const imports = new Map();
  for (const node of source.statements) {
    if (!ts.isImportDeclaration(node)) continue;
    const specifier = node.moduleSpecifier.text;
    if (!specifier.startsWith('.')) continue;
    const base = path.resolve(path.dirname(file), specifier);
    const importedFile = [base, base + '.js', base + '.jsx'].find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
    if (!importedFile) continue;
    const clause = node.importClause;
    if (clause?.name) imports.set(clause.name.text, { file: importedFile, name: 'default' });
    if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const element of clause.namedBindings.elements) imports.set(element.name.text, { file: importedFile, name: element.propertyName?.text || element.name.text });
    }
  }
  let body;
  for (const node of source.statements) {
    if (ts.isFunctionDeclaration(node) && (node.name?.text === functionName || functionName === 'default' && node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword))) body = node.body;
    if (ts.isVariableStatement(node)) for (const declaration of node.declarationList.declarations) {
      if (declaration.name.getText(source) === functionName && declaration.initializer && ts.isArrowFunction(declaration.initializer)) body = declaration.initializer.body;
    }
  }
  assert.ok(body, `Find hook/component ${functionName} in ${file}`);
  const nextStack = new Set([...stack, `${file}:${functionName}`]);
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
const loader = path.join(out, 'jsx-loader.cjs');
fs.writeFileSync(loader, `const ts=require(${JSON.stringify(require.resolve('typescript'))});module.exports=function(source){return ts.transpileModule(source,{fileName:this.resourcePath,compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;};`);
const entry = path.join(out, 'browser-entry.cjs');
fs.writeFileSync(entry, `
const React=require('react');
const {createRoot}=require('react-dom/client');
const Takeoff=require(${JSON.stringify(componentPath)}).default;
const {useEstimateBuilderWorkbook}=require(${JSON.stringify(workbookHookPath)});
const {createEstimateBuilderWorkbookDefaults}=require(${JSON.stringify(path.join(root, 'lib/construction-estimation/estimateBuilderWorkbookDefaults.js'))});
const {masterJobId,linkTakeoffToMasterJob}=require(${JSON.stringify(path.join(root, 'lib/construction-estimation/masterJob.js'))});
const {prepareAiPlanTakeoffJobForSave}=require(${JSON.stringify(path.join(takeoffDir, 'jobPersistence.js'))});
const {materializeTakeoffPlanPages}=require(${JSON.stringify(path.join(takeoffDir, 'planBlobStorage.js'))});
const indexes=${JSON.stringify(indexes)};
const jobId=${JSON.stringify(jobId)};
const reactRoot=createRoot(document.getElementById('root'));
let currentSheet=null,control=null;
const saveResults=[],saveInputs=[];
function findFiber(fiber){if(!fiber)return null;if(fiber.type===Takeoff)return fiber;return findFiber(fiber.child)||findFiber(fiber.sibling);}
function hooks(){const values=[];let hook=findFiber(reactRoot._internalRoot.current)?.memoizedState;while(hook){values.push(hook);hook=hook.next;}return values;}
function value(name){return hooks()[indexes[name]]?.memoizedState;}
function dispatch(name,next){const hook=hooks()[indexes[name]];if(!hook?.queue?.dispatch)throw Error('Missing state hook '+name);hook.queue.dispatch(next);}
function snapshot(){
 const result={};for(const name of ['currentPage','totalPages','pixelsPerMm','completedWallRuns','placedOpenings','completedAreas','completedFloorplans','savedRevision','hasUnsavedChanges','platformSaveMessage','planLoadError','planFilename','openedTakeoffJob'])result[name]=value(name);
 result.imageReady=Boolean(value('image'));
 const layer=value('layerRef')?.current;result.konvaLines=layer?layer.find('Line').length:0;result.konvaGroups=layer?layer.find('Group').length:0;
 return JSON.parse(JSON.stringify(result));
}
const frame=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
// Same selection, key and callbacks EstimateBuilderWorkbook passes to the embedded engine.
function selectJob(workbook){const job=workbook?.aiPlanTakeoffJob;return job&&job.masterJobId===masterJobId(workbook)?job:null;}
function Shell(){
 const sheet=useEstimateBuilderWorkbook();currentSheet=sheet;
 const [request,setRequest]=React.useState(null);
 const [visible,setVisible]=React.useState(true);
 const [mount,setMount]=React.useState(0);
 React.useEffect(()=>{if(!sheet.hydrated||!masterJobId(sheet.workbook)||selectJob(sheet.workbook)?.takeoffId)return;sheet.ensureAiPlanTakeoffWorkspace();},[sheet.hydrated,sheet.workbook]);
 control={async reopen(){setVisible(false);await frame();const result=await currentSheet.openSavedJob('job:'+jobId);if(!result.ok)throw Error(result.message);setRequest({requestId:'reopen-'+Date.now(),jobData:result.workbook.aiPlanTakeoffJob});setMount(n=>n+1);setVisible(true);return result.key;}};
 if(!sheet.hydrated)return React.createElement('div',null,'Loading workbook');
 const wb=sheet.workbook,jid=masterJobId(wb);
 return visible?React.createElement(Takeoff,{key:(jid||'no-job')+':'+sheet.jobLoadVersion+':'+mount,embedded:true,jobId:jid,initialJob:selectJob(wb),openTakeoffJobRequest:request,
  onMasterTakeoffChange:(jobData)=>{try{return currentSheet.updateAiPlanTakeoffDraft(jobData);}catch(error){return {ok:false,message:error.message};}},
  platformContext:{jobId:jid,projectId:jid,projectName:'Stubbed AI takeoff',noJobOpen:!jid,isHydratingProject:!sheet.hydrated},
  onSaveToPlatform:async incoming=>{saveInputs.push(JSON.parse(JSON.stringify({walls:incoming.completedWallRuns||[],openings:incoming.placedOpenings||[],floorplans:incoming.completedFloorplans||[],scheduleState:incoming.scheduleState||null})));const workbook=currentSheet.getCurrentWorkbook();const owned=linkTakeoffToMasterJob(workbook,incoming);const prepared=prepareAiPlanTakeoffJobForSave(selectJob(workbook),owned,jid);const result=prepared.ok?await currentSheet.saveAiPlanTakeoffJob(prepared.job):prepared;saveResults.push(result);return result;}}):React.createElement('div',null,'Takeoff closed');
}
window.harness={snapshot,saveResults:()=>saveResults,saveInputs:()=>saveInputs,ready:()=>Boolean(currentSheet?.hydrated),
 async newJob(){const workbook={...createEstimateBuilderWorkbookDefaults(),jobId,projectId:jobId,commercialProjectId:jobId,projectName:'Stubbed AI takeoff',registeredJob:{jobId,jobName:'Stubbed AI takeoff'},jobFileMeta:{projectId:jobId,jobName:'Stubbed AI takeoff'}};delete workbook.aiPlanTakeoffJob;if(workbook.takeoffEngine)delete workbook.takeoffEngine.aiPlanTakeoffJob;const result=await currentSheet.loadJobFileData({workbook,jobName:'Stubbed AI takeoff'},'stubbed-ai-takeoff.gr8job');if(!result.ok)throw Error(result.message);return result;},
 reopen:()=>control.reopen(),
 setView({zoom,pan}){value('sheetViewStateRef').current[value('currentPage')]={scale:zoom,pos:pan};dispatch('stageScale',zoom);dispatch('stagePos',pan);},
 viewSize(){return {width:value('stageRef').current.width(),height:value('stageRef').current.height()};},
 point(point){const stage=value('stageRef').current,layer=value('layerRef').current,rect=stage.content.getBoundingClientRect(),visible=layer.getAbsoluteTransform().point(point);return {x:rect.left+visible.x*rect.width/stage.width(),y:rect.top+visible.y*rect.height/stage.height()};},
 async stored(){const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('estimate-builder-template-db',2);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});const record=await new Promise((resolve,reject)=>{const request=db.transaction('jobs','readonly').objectStore('jobs').get('job:'+jobId);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});db.close();const materialized=await materializeTakeoffPlanPages(record.workbook);return JSON.parse(JSON.stringify({job:materialized.aiPlanTakeoffJob}));}
};
reactRoot.render(React.createElement(Shell));
`);
const webpackPackage = require('next/dist/compiled/webpack/webpack');
webpackPackage.init();
const webpack = webpackPackage.webpack;
console.log('Building live Takeoff browser bundle.');
await new Promise((resolve, reject) => {
  const compiler = webpack({
    mode: 'development', target: 'web', devtool: false, context: root, entry,
    output: { path: out, filename: 'browser-bundle.js' },
    resolve: { extensions: ['.js', '.jsx', '.mjs', '.ts', '.tsx'], mainFields: ['browser', 'module', 'main'], fallback: { canvas: false, fs: false, path: false, url: false } },
    module: { rules: [{ test: /\.[jt]sx?$/, exclude: /node_modules/, resolve: { fullySpecified: false }, use: loader }] },
    plugins: [new webpack.IgnorePlugin({ resourceRegExp: /^node:/ }), new webpack.DefinePlugin({ 'process.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(supabaseUrl), 'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify('stub-anon-key') })],
    optimization: { minimize: false }, performance: { hints: false },
  });
  compiler.run((error, stats) => {
    const result = stats?.toJson({ all: false, errors: true });
    compiler.close(() => error || stats?.hasErrors() ? reject(error || new Error(JSON.stringify(result.errors).slice(0, 4000))) : resolve());
  });
});

const server = http.createServer(async (req, res) => {
  if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'application/javascript'); fs.createReadStream(path.join(out, 'browser-bundle.js')).pipe(res); return; }
  if (req.url === '/pdfjs/pdf.worker.min.mjs') { res.setHeader('Content-Type', 'application/javascript'); fs.createReadStream(path.join(root, 'public/pdfjs/pdf.worker.min.mjs')).pipe(res); return; }
  if (req.url === '/api/ai/takeoff-analyse') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    req.body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    apiRequests.push({ mode: serverMode, action: req.body.action, scope: req.body.measurementScope || null, contextPages: req.body.contextPages?.length || 0, page: req.body.page?.pageNumber, authorization: Boolean(req.headers.authorization), imageBytes: req.body.page?.imageDataUrl?.length || 0, pixelsPerMm: req.body.pixelsPerMm });
    req.user = { id: 'stub-user' };
    const shim = { statusCode: 200, setHeader: (k, v) => res.setHeader(k, v), status(code) { this.statusCode = code; return this; },
      json(payload) { res.statusCode = this.statusCode; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(payload)); return this; } };
    await ({ configured: configuredHandler, 'measure-fails': measureFailsHandler, unconfigured: unconfiguredHandler }[serverMode])(req, shim);
    return;
  }
  res.setHeader('Content-Type', 'text/html');
  res.end('<!doctype html><meta charset="utf-8"><title>Stubbed AI Takeoff</title><style>html,body,#root{height:100%;margin:0;font-family:Arial}</style><div id="root"></div><script src="/bundle.js"></script>');
});

const report = { errors: [], dialogs: [], cases: {} };
let browser, page;
try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, userDataDir: path.join(out, 'profile-' + Date.now()), args: ['--no-first-run', '--disable-extensions', '--disable-background-networking'], defaultViewport: { width: 1800, height: 1400 } });

  // A simple single-storey plan image matching the fake provider's geometry.
  const planPath = path.join(out, 'simple-house-plan.png');
  const drawer = await browser.newPage();
  await drawer.setViewport({ width: 1200, height: 900 });
  await drawer.setContent(`<body style="margin:0"><svg width="1200" height="900" xmlns="http://www.w3.org/2000/svg"><rect width="1200" height="900" fill="#fff"/>
    <rect x="240" y="225" width="720" height="450" fill="none" stroke="#000" stroke-width="10"/><line x1="600" y1="225" x2="600" y2="675" stroke="#000" stroke-width="6"/>
    <line x1="384" y1="225" x2="456" y2="225" stroke="#fff" stroke-width="6"/><path d="M760 675 A40 40 0 0 1 800 635" fill="none" stroke="#000"/>
    <text x="380" y="450" font-size="22">BED 1</text><text x="740" y="450" font-size="22">LIVING</text><text x="60" y="860" font-size="18">SCALE 1:100</text></svg></body>`);
  await drawer.screenshot({ path: planPath });
  await drawer.close();

  page = await browser.newPage();
  page.setDefaultTimeout(60000);
  page.on('pageerror', (error) => report.errors.push(error.message));
  page.on('dialog', async (dialog) => {
    report.dialogs.push(dialog.message());
    if (dialog.type() === 'prompt' && /known dimension/i.test(dialog.message())) await dialog.accept('12000');
    else await dialog.accept();
  });
  await page.setRequestInterception(true);
  page.on('request', (request) => request.url().startsWith(origin) || /^(data|blob):/.test(request.url()) ? request.continue() : request.abort());
  const expiresAt = Math.floor(Date.now() / 1000) + 86400;
  await page.evaluateOnNewDocument(({ storageKey, session }) => { localStorage.setItem(storageKey, JSON.stringify(session)); }, {
    storageKey: 'sb-stubbedtakeoff-auth-token',
    session: { access_token: 'stub-access-token', refresh_token: 'stub-refresh', token_type: 'bearer', expires_in: 86400, expires_at: expiresAt, user: { id: 'stub-user', aud: 'authenticated', role: 'authenticated', email: 'stub@example.test' } },
  });
  await page.goto(origin, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.harness?.ready());

  // 1. New job; the shell creates the master takeoff workspace exactly like the workbook does.
  await page.evaluate(() => harness.newJob());
  await page.waitForFunction(() => Boolean(harness.snapshot().openedTakeoffJob?.takeoffId));
  // 2. Upload the plan through the existing file input.
  await page.waitForSelector('input[type="file"][accept="image/*,.pdf"]:not([disabled])');
  await (await page.$('input[type="file"][accept="image/*,.pdf"]')).uploadFile(planPath);
  await ready();
  let state = await snapshot();
  assert.equal(state.totalPages, 1);
  assert.equal(state.pixelsPerMm, null);
  // 3. Calibrate with the existing Calibrate tool: 720 px north wall = 12000 mm.
  await centre({ x: 600, y: 225 });
  await button('Calibrate');
  await clickPlan({ x: 240, y: 225 });
  await clickPlan({ x: 960, y: 225 });
  await page.waitForFunction(() => harness.snapshot().pixelsPerMm > 0);
  state = await snapshot();
  report.cases.calibrated = state.pixelsPerMm;
  // 4. A manual wall that AI must never remove.
  await centre({ x: 600, y: 120 });
  await button('Walls');
  await clickPlan({ x: 300, y: 100 }); await clickPlan({ x: 500, y: 100 });
  await button('Finish Wall Run', true);
  await page.waitForFunction(() => harness.snapshot().completedWallRuns.length === 1);
  const manual = (await snapshot()).completedWallRuns[0];
  assert.notEqual(manual.source, 'ai');

  // 5. Unconfigured server: the actual server error must be visible, nothing inserted.
  await page.click('#run-ai-takeoff');
  await page.waitForFunction(() => /not configured/i.test(document.querySelector('#ai-takeoff-status')?.textContent || ''));
  report.cases.unconfiguredMessage = await page.$eval('#ai-takeoff-status', (element) => element.textContent);
  assert.equal(await page.$eval('#run-ai-takeoff', (element) => element.disabled), false, 'Button re-enabled after failure');
  state = await snapshot();
  assert.equal(state.completedWallRuns.length, 1, 'Failed analysis inserted nothing');
  assert.equal(providerCalls.length, 0);

  // 6. Provider fails every measurement: the actual error is visible, not a review-only 'no geometry' result.
  serverMode = 'measure-fails';
  await page.click('#run-ai-takeoff');
  await page.waitForFunction(() => !document.querySelector('#run-ai-takeoff').disabled && /could not|REQUIRES REVIEW|COMPLETE/i.test(document.querySelector('#ai-takeoff-status')?.textContent || ''), { timeout: 60000 });
  report.cases.measureFailedMessage = await page.$eval('#ai-takeoff-status', (element) => element.textContent);
  assert.match(report.cases.measureFailedMessage, /could not measure the plan.*HTTP 500/, report.cases.measureFailedMessage);
  assert.equal((await snapshot()).completedWallRuns.length, 1, 'Failed measurement inserted nothing');
  assert.deepEqual(apiRequests.filter((item) => item.mode === 'measure-fails').map((item) => `${item.action}:${item.scope || ''}`), ['inspect:', 'measure:geometry', 'measure:geometry'],
    'Failed geometry half is retried once; the items half is never paid for after it fails.');

  // 7. Configured (fake provider): click RUN AI TAKEOFF and observe the busy state.
  serverMode = 'configured';
  const linesBefore = state.konvaLines, groupsBefore = state.konvaGroups;
  await page.click('#run-ai-takeoff');
  const busy = await page.$eval('#run-ai-takeoff', (element) => ({ disabled: element.disabled, text: element.textContent }));
  report.cases.busy = busy;
  assert.equal(busy.disabled, true, 'Button disabled while analysing');
  assert.match(busy.text, /Analysing plan/);
  await page.waitForFunction(() => /AI TAKEOFF COMPLETE|REQUIRES REVIEW|could not|failed|error|Calibrate|Open an editable/i.test(document.querySelector('#ai-takeoff-status')?.textContent || '')
    && !document.querySelector('#run-ai-takeoff').disabled, { timeout: 60000 });
  report.cases.completedMessage = await page.$eval('#ai-takeoff-status', (element) => element.textContent);
  assert.equal(report.cases.completedMessage, 'AI TAKEOFF COMPLETE', report.cases.completedMessage);
  assert.deepEqual(apiRequests.filter((item) => item.mode === 'configured').map((item) => `${item.action}:${item.scope || ''}`), ['measure:geometry', 'measure:items', 'refine:geometry', 'refine:items'],
    'Unchanged page is not re-inspected; halves run one at a time.');
  assert.deepEqual(providerCalls.slice(-4).map((item) => `${item.format}:${item.scope}`), ['takeoff_measure_v1:geometry', 'takeoff_measure_v1:items', 'takeoff_refine_v1:geometry', 'takeoff_refine_v1:items']);
  assert.ok(apiRequests.every((item) => item.authorization && item.imageBytes > 1000), 'Authenticated requests carry the rendered page image');
  await settle();
  state = await snapshot();
  const aiWalls = state.completedWallRuns.filter((item) => item.source === 'ai');
  const aiOpenings = state.placedOpenings.filter((item) => item.source === 'ai');
  const aiFloorplans = state.completedFloorplans.filter((item) => item.source === 'ai');
  report.cases.admitted = { walls: aiWalls.length, openings: aiOpenings.length, floorplans: aiFloorplans.length, sampleWall: aiWalls[0], sampleOpening: aiOpenings[0], sampleFloorplan: aiFloorplans[0] };
  assert.ok(aiWalls.some((item) => item.category === 'exterior'), 'AI exterior walls reached live state');
  assert.ok(aiWalls.some((item) => item.category === 'interior'), 'AI interior wall reached live state');
  assert.equal(aiOpenings.length, 2, 'AI door and window reached live state');
  assert.ok(aiFloorplans.length >= 1, 'AI floor area reached live state');
  assert.deepEqual(state.completedWallRuns.find((item) => item.id === manual.id), manual, 'Manual wall preserved');
  // Canonical AI output must stay identical across request-efficiency changes.
  // The document hash depends on the rendered PNG bytes, so it is normalised.
  const goldenPath = path.join(root, 'test/fixtures/takeoff-ai-stubbed-golden.json');
  const golden = JSON.parse(JSON.stringify({ walls: aiWalls, openings: aiOpenings, floorplans: aiFloorplans }).replace(/canvas-sha256(%3A|:)[0-9a-f]{64}/g, 'canvas-sha256$1<document>'));
  if (process.env.UPDATE_TAKEOFF_GOLDEN === '1') fs.writeFileSync(goldenPath, JSON.stringify(golden, null, 2) + '\n');
  else assert.deepEqual(golden, JSON.parse(fs.readFileSync(goldenPath, 'utf8')), 'AI geometry/openings/areas identical to the recorded baseline');
  for (const wall of aiWalls) {
    assert.equal(Number(wall.page), 1);
    assert.ok(wall.nodes.length >= 2 && wall.nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y)));
    assert.ok(Number(wall.thicknessMm) > 0, 'Canonical wall thickness for rendering');
    assert.ok(Number(wall.lengthMm) > 0, 'Canonical wall length');
  }
  assert.ok(state.konvaLines > linesBefore, `AI walls/areas rendered on canvas (${linesBefore} -> ${state.konvaLines} lines)`);
  assert.ok(state.konvaGroups > groupsBefore, `AI openings rendered on canvas (${groupsBefore} -> ${state.konvaGroups} groups)`);
  await page.screenshot({ path: path.join(out, '1-ai-geometry-rendered.png') });

  // 8. Completion auto-saves through handleSaveJob; geometry must not be overwritten afterwards.
  await page.waitForFunction(() => harness.saveResults().length > 0, { timeout: 30000 });
  const saved = await page.evaluate(() => harness.saveResults().at(-1));
  assert.equal(saved.ok, true, saved.message);
  const saveInput = await page.evaluate(() => harness.saveInputs().at(-1));
  assert.equal(saveInput.walls.filter((item) => item.source === 'ai').length, aiWalls.length, 'handleSaveJob received AI walls');
  assert.equal(saveInput.openings.filter((item) => item.source === 'ai').length, aiOpenings.length, 'handleSaveJob received AI openings');
  assert.ok(saveInput.walls.some((item) => item.id === manual.id), 'handleSaveJob received manual wall');
  assert.ok(saveInput.scheduleState?.aiAppliedRuns?.length, 'handleSaveJob received admission receipt');
  await new Promise((resolve) => setTimeout(resolve, 3000));
  const later = await snapshot();
  assert.equal(later.completedWallRuns.length, state.completedWallRuns.length, 'No later effect/hydration removed walls');
  assert.equal(later.placedOpenings.length, state.placedOpenings.length, 'No later effect/hydration removed openings');
  assert.equal(later.completedFloorplans.length, state.completedFloorplans.length, 'No later effect/hydration removed floorplans');
  const stored = await page.evaluate(() => harness.stored());
  assert.equal(stored.job.completedWallRuns.filter((item) => item.source === 'ai').length, aiWalls.length, 'Persisted AI walls');
  assert.equal(Object.keys(stored.job.scheduleState?.aiInspections || {}).length, 1, 'Page inspection is saved with the takeoff');

  // 9. Reopen restores the same AI objects and the manual wall.
  await page.evaluate(() => harness.reopen()); await ready();
  const reopened = await snapshot();
  for (const wall of [...aiWalls, manual]) assert.deepEqual(reopened.completedWallRuns.find((item) => item.id === wall.id), wall, `Reopened wall ${wall.id}`);
  for (const opening of aiOpenings) assert.ok(reopened.placedOpenings.some((item) => item.id === opening.id && item.source === 'ai'), `Reopened opening ${opening.id}`);
  for (const area of aiFloorplans) assert.ok(reopened.completedFloorplans.some((item) => item.id === area.id), `Reopened floorplan ${area.id}`);
  assert.ok(reopened.konvaLines >= aiWalls.length + 1 + aiFloorplans.length, 'Reopened walls and areas rendered');
  assert.ok(reopened.konvaGroups >= aiOpenings.length, 'Reopened openings rendered');
  await page.screenshot({ path: path.join(out, '2-reopened.png') });
  assert.deepEqual(report.errors, [], 'No browser runtime errors');
  report.ok = true;
  console.log('Stubbed live AI Takeoff passed: new job, upload, calibrate, manual wall, visible unconfigured error, busy state, inspect/measure/refine via real handler, AI walls/openings/areas in live state and rendered, auto-save via handleSaveJob, no overwrite, reopen restored. No paid provider called.');
} catch (error) {
  report.error = error.stack || String(error);
  if (page) { report.failureState = await snapshot().catch(() => null); report.status = await page.$eval('#ai-takeoff-status', (element) => element.textContent).catch(() => null); await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {}); }
  throw error;
} finally {
  report.apiRequests = apiRequests; report.providerCalls = providerCalls;
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  await browser?.close();
  await new Promise((resolve) => server.listening ? server.close(resolve) : resolve());
}

async function snapshot() { return page.evaluate(() => harness.snapshot()); }
async function settle() { await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))); }
async function ready() { await page.waitForFunction(() => window.harness?.snapshot().imageReady && harness.snapshot().currentPage === 1, { timeout: 60000 }); await settle(); }
async function centre(point) { await page.evaluate((point) => { const size = harness.viewSize(); harness.setView({ zoom: 1, pan: { x: size.width / 2 - point.x, y: size.height / 2 - point.y } }); }, point); await settle(); }
async function button(label, prefix = false) { const found = await page.evaluate(({ label, prefix }) => { const element = [...document.querySelectorAll('button')].find((item) => prefix ? item.textContent.trim().startsWith(label) : item.textContent.trim() === label); if (!element) return false; element.click(); return true; }, { label, prefix }); assert.ok(found, `Find button ${label}`); await settle(); }
async function clickPlan(point) { const client = await page.evaluate((point) => harness.point(point), point); await page.mouse.move(client.x, client.y); await page.mouse.click(client.x, client.y); await settle(); await new Promise((resolve) => setTimeout(resolve, 650)); }
