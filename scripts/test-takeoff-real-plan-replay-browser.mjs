import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import puppeteer from 'puppeteer';
import { PDFDocument } from 'pdf-lib';

// Real-plan browser acceptance WITHOUT a paid provider. The actual AI Takeoff screen runs in an
// isolated job: the recovered New Job 03/09 sheets are uploaded as a PDF through the screen's own
// file input, the scale is set with the Calibrate tool, and RUN AI TAKEOFF is clicked. The only
// thing replaced is the network: /api/ai/takeoff-analyse answers with the responses the provider
// actually gave for these sheets (saved 2026-10-06). Everything else - page preparation, the
// analysis hook, linework measurement, fusion, the contract, the canvas, rooms, save and reopen -
// is the app's own code. The result is compared with the estimator's hand trace of the same sheets.
//
// Needs the recovered run (large, not in git); skipped without it:
//   GR8_TAKEOFF_RECOVERY=<dir with takeoff-with-ai-run.decoded.json, plan-pages/, rerun/>
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const recoveryDir = process.env.GR8_TAKEOFF_RECOVERY || 'E:/dev/funnel-builder-clean/recovery/ai-takeoff-run-2026-10-06';
if (!fs.existsSync(path.join(recoveryDir, 'takeoff-with-ai-run.decoded.json'))) { console.log(`SKIPPED real-plan replay: ${recoveryDir} not found (set GR8_TAKEOFF_RECOVERY).`); process.exit(0); }
const out = path.join(root, 'artifacts/test-artifacts/takeoff-real-plan-replay');
const componentPath = path.join(root, 'components/construction-estimation/ai-plan-takeoff/AIPlanTakeoffStandalone.jsx');
const workbookHookPath = path.join(root, 'hooks/estimate-builder/useEstimateBuilderWorkbook.js');
const takeoffDir = path.dirname(componentPath);
const jobId = 'real-plan-replay-job';
const supabaseUrl = 'https://stubbedtakeoff.supabase.invalid';
fs.mkdirSync(out, { recursive: true });
const recovered = JSON.parse(fs.readFileSync(path.join(recoveryDir, 'takeoff-with-ai-run.decoded.json'), 'utf8')).job;
// GR8_TAKEOFF_RESPONSES replays another saved set of provider responses for the same sheets (for example a later live run).
const responsesDir = process.env.GR8_TAKEOFF_RESPONSES ? path.resolve(process.env.GR8_TAKEOFF_RESPONSES) : path.join(recoveryDir, 'rerun');
const assets = fs.readdirSync(path.join(recoveryDir, 'plan-pages')).map((name) => ({ file: path.join(recoveryDir, 'plan-pages', name), size: fs.statSync(path.join(recoveryDir, 'plan-pages', name)).size }));
// What this run has to reach at least (hand trace as reference, 300 mm wall tolerance); a change may improve on these.
const floors = JSON.parse(fs.readFileSync(path.join(root, 'test/fixtures/new-job-03-09-replay-floor.json'), 'utf8')).levels;

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
 let analysisHook=findFiber(reactRoot._internalRoot.current)?.memoizedState;while(analysisHook){if(analysisHook.memoizedState?.schemaVersion==='ai-takeoff-analysis.v1')result.aiAnalysis=analysisHook.memoizedState;analysisHook=analysisHook.next;}
 result.roomNodes=(value('stageRef')?.current?.find('Line')||[]).filter(n=>n.name().startsWith('room-boundary:')).map(n=>({name:n.name(),fill:n.fill()}));
 result.sheetLevels=value('sheetLevels');
 let calibrationHook=findFiber(reactRoot._internalRoot.current)?.memoizedState;while(calibrationHook){const m=calibrationHook.memoizedState;if(m&&typeof m==='object'&&!Array.isArray(m)&&Object.keys(m).length&&Object.values(m).every(v=>v&&typeof v==='object'&&'pixelsPerMm' in v&&'calibratedAt' in v)){result.sheetCalibrations=m;break;}calibrationHook=calibrationHook.next;}
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
  platformContext:{jobId:jid,projectId:jid,projectName:'Real plan replay',noJobOpen:!jid,isHydratingProject:!sheet.hydrated},
  onSaveToPlatform:async incoming=>{saveInputs.push(JSON.parse(JSON.stringify({walls:incoming.completedWallRuns||[],openings:incoming.placedOpenings||[],floorplans:incoming.completedFloorplans||[],scheduleState:incoming.scheduleState||null})));const workbook=currentSheet.getCurrentWorkbook();const owned=linkTakeoffToMasterJob(workbook,incoming);const prepared=prepareAiPlanTakeoffJobForSave(selectJob(workbook),owned,jid);const result=prepared.ok?await currentSheet.saveAiPlanTakeoffJob(prepared.job):prepared;saveResults.push(result);return result;}}):React.createElement('div',null,'Takeoff closed');
}
window.harness={snapshot,saveResults:()=>saveResults,saveInputs:()=>saveInputs,ready:()=>Boolean(currentSheet?.hydrated),
 async newJob(){const workbook={...createEstimateBuilderWorkbookDefaults(),jobId,projectId:jobId,commercialProjectId:jobId,projectName:'Real plan replay',registeredJob:{jobId,jobName:'Real plan replay'},jobFileMeta:{projectId:jobId,jobName:'Real plan replay'}};delete workbook.aiPlanTakeoffJob;if(workbook.takeoffEngine)delete workbook.takeoffEngine.aiPlanTakeoffJob;const result=await currentSheet.loadJobFileData({workbook,jobName:'Real plan replay'},'stubbed-ai-takeoff.gr8job');if(!result.ok)throw Error(result.message);return result;},
 reopen:()=>control.reopen(),
 goToPage(page){dispatch('currentPage',page);},
 setView({zoom,pan}){value('sheetViewStateRef').current[value('currentPage')]={scale:zoom,pos:pan};dispatch('stageScale',zoom);dispatch('stagePos',pan);},
 viewSize(){return {width:value('stageRef').current.width(),height:value('stageRef').current.height()};},
 point(point){const stage=value('stageRef').current,layer=value('layerRef').current,rect=stage.content.getBoundingClientRect(),visible=layer.getAbsoluteTransform().point(point);return {x:rect.left+visible.x*rect.width/stage.width(),y:rect.top+visible.y*rect.height/stage.height()};},
 async stored(){const openDb=(name)=>new Promise((resolve,reject)=>{const request=indexedDB.open(name);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});let record;for(const {name} of await indexedDB.databases()){if(!String(name).startsWith('estimate-builder-template-db'))continue;const db=await openDb(name);if(db.objectStoreNames.contains('jobs'))record=await new Promise((resolve,reject)=>{const request=db.transaction('jobs','readonly').objectStore('jobs').get('job:'+jobId);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});db.close();if(record)break;}const materialized=await materializeTakeoffPlanPages(record.workbook);return JSON.parse(JSON.stringify({job:materialized.aiPlanTakeoffJob}));}
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

// ---- Saved provider responses, replayed by a local server (no provider is called) ----
const apiRequests = [];
const saved = (name) => JSON.parse(fs.readFileSync(path.join(responsesDir, name), 'utf8'));
const inspections = new Map(Object.values(recovered.scheduleState.aiInspections).map((entry) => [entry.analysis.page, entry]));
const evidenceFiles = fs.readdirSync(responsesDir).filter((name) => /^evidence-[\d-]+\.json$/.test(name));
function replay(body) {
  const pageNumber = Number(body.page?.pageNumber);
  if (body.action === 'inspect') { const entry = inspections.get(pageNumber); return { ok: true, provider: 'OpenAI', model: entry.model || 'saved', requestId: `replay-inspect-${pageNumber}`, analysis: entry.analysis }; }
  if (body.action === 'evidence') {
    const name = evidenceFiles.find((file) => file.startsWith(`evidence-${pageNumber}.`) || file.startsWith(`evidence-${pageNumber}-`)) || evidenceFiles.find((file) => file.slice(9, -5).split('-').includes(String(pageNumber))) || evidenceFiles[0];
    const response = saved(name);
    return { ...response, analysis: { ...response.analysis, page: pageNumber } };
  }
  if (body.measurementScope === 'rooms') { const response = saved(`refine-${pageNumber}-items.json`); return { ...response, analysis: { page: pageNumber, level: response.analysis.level, rooms: response.analysis.rooms, review: [] } }; }
  return saved(`${body.action === 'refine' ? 'refine' : 'measure'}-${pageNumber}-${body.measurementScope}.json`);
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'application/javascript'); fs.createReadStream(path.join(out, 'browser-bundle.js')).pipe(res); return; }
  if (req.url === '/pdfjs/pdf.worker.min.mjs') { res.setHeader('Content-Type', 'application/javascript'); fs.createReadStream(path.join(root, 'public/pdfjs/pdf.worker.min.mjs')).pipe(res); return; }
  if (req.url === '/api/ai/takeoff-analyse') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    apiRequests.push({ action: body.action, scope: body.measurementScope || null, page: body.page?.pageNumber, pixelsPerMm: body.pixelsPerMm });
    res.setHeader('Content-Type', 'application/json');
    try { res.end(JSON.stringify(replay(body))); }
    catch (error) { res.statusCode = 500; res.end(JSON.stringify({ ok: false, code: 'replay_missing', message: `No saved response for ${body.action} ${body.measurementScope || ''} page ${body.page?.pageNumber}: ${error.message}` })); }
    return;
  }
  res.setHeader('Content-Type', 'text/html');
  res.end('<!doctype html><meta charset="utf-8"><title>AI Takeoff real-plan replay</title><style>html,body,#root{height:100%;margin:0;font-family:Arial}</style><div id="root"></div><script src="/bundle.js"></script>');
});

// ---- Reference: the estimator's own trace of these sheets ----
const isAi = (item) => item?.source === 'ai' || String(item?.id || '').startsWith('ai:');
const ppmTrue = recovered.pixelsPerMm;
const segmentsOf = (walls) => walls.flatMap((wall) => wall.nodes.slice(1).map((end, index) => ({ a: wall.nodes[index], b: end })));
const distanceTo = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy; const t = L ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L)) : 0; return Math.hypot(a.x + t * dx - p.x, a.y + t * dy - p.y); };
function foundShare(traced, produced, toleranceMm = 300) {
  let total = 0, hit = 0;
  for (const segment of segmentsOf(traced)) {
    const lengthMm = Math.hypot(segment.b.x - segment.a.x, segment.b.y - segment.a.y) / ppmTrue, parts = Math.max(1, Math.round(lengthMm / 100));
    const angle = Math.atan2(segment.b.y - segment.a.y, segment.b.x - segment.a.x);
    for (let i = 0; i <= parts; i += 1) {
      const point = { x: segment.a.x + (segment.b.x - segment.a.x) * i / parts, y: segment.a.y + (segment.b.y - segment.a.y) * i / parts };
      total += 1;
      if (segmentsOf(produced).some((other) => { const d = Math.abs(angle - Math.atan2(other.b.y - other.a.y, other.b.x - other.a.x)) % Math.PI; return Math.min(d, Math.PI - d) < 0.35 && distanceTo(point, other.a, other.b) <= toleranceMm * ppmTrue; })) hit += 1;
    }
  }
  return total ? hit / total : 0;
}
const accuracy = (state, pageNumber) => {
  const traced = recovered.completedWallRuns.filter((wall) => !isAi(wall) && Number(wall.page) === pageNumber);
  const produced = state.completedWallRuns.filter((wall) => Number(wall.page) === pageNumber);
  const handOpenings = recovered.placedOpenings.filter((item) => !isAi(item) && Number(item.page) === pageNumber);
  const gotOpenings = state.placedOpenings.filter((item) => Number(item.page) === pageNumber);
  const used = new Set();
  const matched = handOpenings.map((item) => { const best = gotOpenings.filter((other) => !used.has(other.id)).map((other) => ({ other, mm: Math.hypot(other.x - item.x, other.y - item.y) / ppmTrue })).sort((a, b) => a.mm - b.mm)[0]; if (best && best.mm <= 600) { used.add(best.other.id); return best.mm; } return null; });
  return {
    externalFound: +foundShare(traced.filter((wall) => wall.category === 'exterior'), produced.filter((wall) => wall.category === 'exterior')).toFixed(3),
    internalFound: +foundShare(traced.filter((wall) => wall.category === 'interior'), produced.filter((wall) => wall.category === 'interior')).toFixed(3),
    walls: produced.length, openings: gotOpenings.length, handOpenings: handOpenings.length, openingsWithin600mm: matched.filter((value) => value !== null).length, openingsWithin300mm: matched.filter((value) => value !== null && value <= 300).length,
  };
};

const report = { errors: [], dialogs: [], cases: {} };
let browser, page, calibrationAnswer = '19971.7';
try {
  // The five recovered sheets as one PDF, each on its own 595 x 842 page as in the saved job.
  const planPath = path.join(out, 'recovered-plan-set.pdf');
  const document = await PDFDocument.create();
  for (const sheet of recovered.plan.pages) {
    const asset = assets.find((item) => item.size === sheet.dataUrlBytes);
    const text = sheet.dataUrl?.startsWith('data:') ? sheet.dataUrl : fs.readFileSync(asset.file, 'utf8');
    const bytes = Buffer.from(text.slice(text.indexOf(',') + 1), 'base64');
    const image = /^data:image\/jpe?g/.test(text) ? await document.embedJpg(bytes) : await document.embedPng(bytes);
    document.addPage([sheet.logicalWidth, sheet.logicalHeight]).drawImage(image, { x: 0, y: 0, width: sheet.logicalWidth, height: sheet.logicalHeight });
  }
  fs.writeFileSync(planPath, await document.save());

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, userDataDir: path.join(out, 'profile-' + Date.now()), args: ['--no-first-run', '--disable-extensions', '--disable-background-networking'], defaultViewport: { width: 1800, height: 1100 }, protocolTimeout: 900000 });
  page = await browser.newPage();
  page.setDefaultTimeout(120000);
  page.on('pageerror', (error) => report.errors.push(error.message));
  page.on('dialog', async (dialog) => {
    report.dialogs.push(dialog.message());
    if (dialog.type() === 'prompt' && /known dimension/i.test(dialog.message())) await dialog.accept(calibrationAnswer);
    else await dialog.accept();
  });
  await page.setRequestInterception(true);
  page.on('request', (request) => request.url().startsWith(origin) || /^(data|blob):/.test(request.url()) ? request.continue() : request.abort());
  const expiresAt = Math.floor(Date.now() / 1000) + 86400;
  await page.evaluateOnNewDocument(({ storageKey, session }) => { localStorage.setItem(storageKey, JSON.stringify(session)); }, {
    storageKey: 'sb-stubbedtakeoff-auth-token',
    session: { access_token: 'stub-access-token', refresh_token: 'stub-refresh', token_type: 'bearer', expires_in: 86400, expires_at: expiresAt, user: { id: 'stub-user', aud: 'authenticated', role: 'authenticated', email: 'stub@example.test' } },
  });
  await page.goto(origin, { waitUntil: 'load', timeout: 300000 });
  await page.waitForFunction(() => window.harness?.ready());

  // 1. Isolated job, plan set uploaded through the screen's own file input.
  await page.evaluate(() => harness.newJob());
  await page.waitForFunction(() => Boolean(harness.snapshot().openedTakeoffJob?.takeoffId));
  await page.waitForSelector('input[type="file"][accept="image/*,.pdf"]:not([disabled])');
  await (await page.$('input[type="file"][accept="image/*,.pdf"]')).uploadFile(planPath);
  await page.waitForFunction(() => harness.snapshot().imageReady && harness.snapshot().totalPages === 5, { timeout: 180000 });
  await settle();
  let state = await snapshot();
  assert.equal(state.totalPages, 5, 'all five sheets loaded');
  assert.equal(state.pixelsPerMm, null);

  // 2. Calibrate on the Ground Floor sheet with the Calibrate tool: two points 400 plan pixels apart.
  await goToPage(2);
  await centre({ x: 362, y: 436 });
  await button('Calibrate');
  await clickPlan({ x: 162, y: 600 });
  await clickPlan({ x: 562, y: 600 });
  await answerCalibration();
  await page.waitForFunction(() => harness.snapshot().pixelsPerMm > 0);
  state = await snapshot();
  report.cases.calibration = { pixelsPerMm: state.pixelsPerMm, expected: ppmTrue };
  assert.ok(Math.abs(state.pixelsPerMm - ppmTrue) / ppmTrue < 0.01, `calibration ${state.pixelsPerMm} vs ${ppmTrue}`);

  // 3. RUN AI TAKEOFF: saved inspections, plan-set evidence, measure and refine halves for both floor plans.
  const run = async (label) => {
    const before = apiRequests.length;
    await page.click('#run-ai-takeoff');
    await page.waitForFunction(() => /AI TAKEOFF COMPLETE|REQUIRES REVIEW|already been analysed|already in|could not|failed|error/i.test(document.querySelector('#ai-takeoff-status')?.textContent || '') && !document.querySelector('#run-ai-takeoff').disabled, { timeout: 600000, polling: 1000 });
    const message = await page.$eval('#ai-takeoff-status', (element) => element.textContent);
    report.cases[label] = { message, requests: apiRequests.slice(before).map((item) => `${item.action}:${item.scope || ''}:${item.page}`) };
    await settle();
    return message;
  };
  const started = Date.now();
  const first = await run('firstRun');
  report.cases.firstRun.seconds = Math.round((Date.now() - started) / 1000);
  assert.match(first, /AI TAKEOFF COMPLETE/, first);
  await page.waitForFunction(() => harness.saveResults().length > 0, { timeout: 120000 });
  assert.equal((await page.evaluate(() => harness.saveResults().at(-1))).ok, true, 'the run saved itself');
  state = await snapshot();
  const rooms = () => snapshot().then((value) => value.aiAnalysis?.rooms || []);
  report.cases.accuracy = { 'Ground Floor': accuracy(state, 2), 'Second Level': accuracy(state, 3) };
  report.cases.rooms = (await rooms()).map((room) => ({ name: room.name, page: room.page, level: room.level, areaM2: room.areaM2, method: room.polygon?.length ? room.detectionMethod : null, verified: room.lineworkVerified || false, review: room.reviewRequired ? room.reviewReasons : [] }));
  report.cases.linework = state.aiAnalysis?.linework && Object.fromEntries(Object.entries(state.aiAnalysis.linework).map(([key, value]) => [key, { engine: value.engine, wallsEmitted: value.wallsEmitted, openings: value.openings, rooms: value.rooms }]));
  for (const [pageNumber, level] of [[2, 'Ground Floor'], [3, 'Second Level']]) {
    const result = report.cases.accuracy[level];
    // The accuracy floors belong to the saved 2026-10-06 responses; another response set is measured and reported, not held to them.
    if (!process.env.GR8_TAKEOFF_RESPONSES) {
    assert.ok(result.externalFound >= floors[level].externalFound, `${level}: external wall found ${result.externalFound} fell below ${floors[level].externalFound}`);
    assert.ok(result.internalFound >= floors[level].internalFound, `${level}: internal wall found ${result.internalFound} fell below ${floors[level].internalFound}`);
    assert.ok(result.openingsWithin600mm >= floors[level].openingsWithin600mm, `${level}: openings within 600 mm ${result.openingsWithin600mm} fell below ${floors[level].openingsWithin600mm}`);
    }
    const walls = state.completedWallRuns.filter((wall) => Number(wall.page) === pageNumber);
    assert.ok(walls.every((wall) => wall.source === 'ai' && ['exterior', 'interior'].includes(wall.category) && Number(wall.lengthMm) > 0), `${level}: every wall is classified and measured`);
    assert.equal(new Set(walls.map((wall) => wall.id)).size, walls.length, `${level}: no wall is in the takeoff twice`);
    const sheetRooms = (await rooms()).filter((room) => room.page === pageNumber && room.polygon?.length >= 3);
    assert.ok(sheetRooms.length >= floors[level].measuredRooms, `${level}: ${sheetRooms.length} rooms have a measured boundary`);
    assert.ok(sheetRooms.every((room) => ['wall-linework', 'drawn-outline'].includes(room.detectionMethod) && room.level === level), `${level}: boundaries come from the drawing (wall linework, or the drawn outline of an outdoor area) and carry the sheet's level`);
    assert.ok(sheetRooms.filter((room) => room.detectionMethod === 'drawn-outline').every((room) => room.reviewRequired), `${level}: an outdoor area measured to its outline is always flagged`);
    assert.ok(Math.max(...sheetRooms.map((room) => room.areaM2 || 0)) < floors[level].largestRoomM2, `${level}: no room swallows the floor`);
    await goToPage(pageNumber);
    await fit();
    await page.screenshot({ path: path.join(out, `1-after-run-sheet-${pageNumber}.png`) });
  }

  // 4. Rooms on the Second Level: hover highlights, one click selects, the panel shows name, level and area.
  await goToPage(3);
  await fit();
  await page.evaluate(() => { const box = document.querySelector('[data-testid="room-boundary-panel"] input[type="checkbox"]'); if (!box.checked) box.click(); });
  await settle();
  const target = (await rooms()).filter((room) => room.page === 3 && room.polygon?.length >= 3 && room.areaM2 > 9 && !room.openPlanOf).sort((a, b) => b.areaM2 - a.areaM2)[0];
  assert.ok(target, 'a Second Level room to work with');
  const inside = { x: target.polygon.reduce((sum, p) => sum + p.x, 0) / target.polygon.length, y: target.polygon.reduce((sum, p) => sum + p.y, 0) / target.polygon.length };
  const fillOf = async (id) => (await snapshot()).roomNodes.find((node) => node.name === `room-boundary:${id}`)?.fill || '';
  const client = await page.evaluate((point) => harness.point(point), inside);
  await page.mouse.move(client.x, client.y); await settle();
  assert.ok((await fillOf(target.id)).includes('0.28'), 'hovering highlights the whole room');
  await page.mouse.move(5, 5); await settle();
  assert.ok((await fillOf(target.id)).includes('0.01'), 'the highlight clears');
  await clickPlan(inside);
  let selected = (await rooms()).find((room) => room.id === target.id);
  assert.equal(selected.selected, true, 'one click selects the room');
  const panelText = await page.$eval('[data-testid="room-boundary-panel"]', (element) => element.innerText);
  assert.ok(panelText.includes(target.name) && panelText.includes('Second Level') && panelText.includes(`${target.areaM2.toFixed(2)} m²`), 'the panel shows the room name, level and measured area');
  await page.screenshot({ path: path.join(out, '2-room-selected.png') });
  // Floor finish.
  await page.select(`select[aria-label="Floor finish for ${target.name}"]`, 'Carpets');
  await settle();
  selected = (await rooms()).find((room) => room.id === target.id);
  assert.equal(selected.floorFinish, 'Carpets');
  // Manual correction: drag one corner 400 mm; the area is recalculated at once and the identity is kept.
  await button('Adjust / redraw');
  await settle();
  const corner = selected.polygon[0];
  const moved = { x: corner.x + 400 * ppmTrue, y: corner.y + 400 * ppmTrue };
  await dragPlan(corner, moved);
  await new Promise((resolve) => setTimeout(resolve, 400));
  const edited = (await rooms()).find((room) => room.id === target.id);
  assert.ok(edited, 'the room keeps its identity when its boundary is edited');
  assert.equal(edited.boundaryEdited, true);
  assert.notEqual(edited.areaM2, target.areaM2, 'the area is recalculated when the boundary is corrected');
  assert.equal(edited.floorFinish, 'Carpets', 'the finish stays with the room');
  await button('Finish editing');
  report.cases.correction = { room: target.name, before: target.areaM2, after: edited.areaM2 };

  // 4b. The laundry. Its tub bench is drawn like a short wall, so the detected boundary is not the
  // room (independent reference: 5.08 m2). The estimator sees the boundary over the drawing, throws
  // it away, clicks the room's four corners and has the right area at once.
  const laundryCorners = [{ x: 317.0, y: 325.8 }, { x: 353.1, y: 325.8 }, { x: 353.1, y: 382.2 }, { x: 317.0, y: 382.2 }];
  await goToPage(2);
  await page.evaluate(() => { const size = harness.viewSize(); const zoom = 5; harness.setView({ zoom, pan: { x: size.width / 2 - 335 * zoom, y: size.height / 2 - 354 * zoom } }); });
  await settle(); await new Promise((resolve) => setTimeout(resolve, 600));
  const laundryDetected = (await rooms()).find((room) => room.page === 2 && /^(ldry|laundry|l'dry)$/i.test(room.name));
  assert.ok(laundryDetected, 'the laundry is in the room list');
  assert.ok((await snapshot()).roomNodes.some((node) => node.name === `room-boundary:${laundryDetected.id}`), 'its detected boundary is drawn over the plan');
  await page.screenshot({ path: path.join(out, '3-laundry-detected.png') });
  const laundryButton = (label) => page.evaluate(({ id, label }) => { const row = document.querySelector(`[data-room-id="${id}"]`); const element = row && [...row.querySelectorAll('button')].find((item) => item.textContent.trim() === label); if (!element) return false; element.click(); return true; }, { id: laundryDetected.id, label });
  // Selecting the room in the list opens its controls.
  await page.evaluate((id) => { const box = document.querySelector('[data-room-id="' + id + '"] input[type="checkbox"]'); if (box && !box.checked) box.click(); }, laundryDetected.id);
  await settle();
  assert.ok(await laundryButton('Redraw boundary'), 'the laundry has a Redraw boundary button');
  await settle();
  assert.equal((await rooms()).find((room) => room.id === laundryDetected.id).areaM2, null, 'the wrong boundary is gone and nothing is measured from it');
  for (const corner of laundryCorners) await clickPlan(corner);
  const last = await page.evaluate((point) => harness.point(point), laundryCorners.at(-1));
  // A double-click on the last corner closes the boundary.
  await page.mouse.click(last.x, last.y); await page.mouse.click(last.x, last.y);
  await settle(); await new Promise((resolve) => setTimeout(resolve, 600));
  const laundryCorrected = (await rooms()).find((room) => room.id === laundryDetected.id);
  assert.ok(laundryCorrected?.polygon?.length === 4, 'the redrawn boundary is the laundry\'s');
  assert.ok(Math.abs(laundryCorrected.areaM2 - 5.08) / 5.08 <= 0.03, `the corrected laundry measures ${laundryCorrected.areaM2} m2 against the 5.08 m2 reference, straight away`);
  assert.ok(await laundryButton('Confirm boundary'));
  await settle();
  if (await laundryButton('Finish editing')) await settle();
  const laundryKept = (list, when) => { const room = list.find((item) => item.id === laundryDetected.id); assert.ok(room && room.name === laundryDetected.name && room.polygon?.length === 4 && Math.abs(room.areaM2 - laundryCorrected.areaM2) < 0.005, `the corrected laundry is kept ${when}: ${room?.areaM2}`); };
  assert.equal((await rooms()).filter((room) => /^(ldry|laundry|l'dry)$/i.test(room.name) && room.page === 2).length, 1, 'there is still one laundry');
  await page.screenshot({ path: path.join(out, '4-laundry-corrected.png') });
  report.cases.laundry = { referenceM2: 5.08, detectedM2: laundryDetected.areaM2, correctedM2: laundryCorrected.areaM2 };
  await goToPage(3);

  // 4c. The other corrections an estimator makes on the Second Level: confirm a sliding door found
  // from the linework, reclassify a wall, and rename a room whose name was read wrongly.
  await fit();
  await button('Select');
  await settle();
  const pickAt = async (point) => { const client = await page.evaluate((value) => harness.point(value), point); await page.mouse.click(client.x, client.y); await settle(); await new Promise((resolve) => setTimeout(resolve, 500)); };
  const robeDoor = (await snapshot()).placedOpenings.find((item) => Number(item.page) === 3 && item.needsClassification && String(item.itemTag).startsWith('linework:gt-'));   // sliding panels across a recess
  assert.ok(robeDoor, 'a robe sliding door found from the linework is waiting to be confirmed: ' + JSON.stringify((await snapshot()).placedOpenings.filter((item) => Number(item.page) === 3).map((item) => [item.itemTag, item.subType, item.needsClassification, item.openingClass, item.widthMm])));
  await pickAt(robeDoor);
  assert.ok(await page.$('[data-testid="opening-needs-confirmation"]'), 'selecting it says its type is not confirmed and why');
  await page.click('[data-testid="confirm-opening-type"]');
  await settle();
  const confirmedDoor = (await snapshot()).placedOpenings.find((item) => item.id === robeDoor.id);
  assert.ok(confirmedDoor && !confirmedDoor.needsClassification && confirmedDoor.typeConfirmedAt, 'the door is confirmed');
  const reclassified = (await snapshot()).completedWallRuns.filter((wall) => Number(wall.page) === 3 && wall.category === 'interior' && wall.nodes?.length === 2)
    .sort((a, b) => Math.hypot(b.nodes[1].x - b.nodes[0].x, b.nodes[1].y - b.nodes[0].y) - Math.hypot(a.nodes[1].x - a.nodes[0].x, a.nodes[1].y - a.nodes[0].y))[0];
  assert.ok(reclassified, 'an internal wall to reclassify');
  await page.keyboard.press('Escape');
  await pickAt({ x: (reclassified.nodes[0].x * 3 + reclassified.nodes[1].x) / 4, y: (reclassified.nodes[0].y * 3 + reclassified.nodes[1].y) / 4 });
  assert.ok(await page.$('[data-testid="selected-wall-category"]'), 'clicking the wall selects it');
  await page.select('[data-testid="selected-wall-category"]', 'exterior');
  await settle();
  const selectedWallNow = await page.$eval('[data-testid="selected-wall-category"]', (element) => element.value);
  const changedWall = (await snapshot()).completedWallRuns.find((wall) => wall.category === 'exterior' && Number(wall.page) === 3 && wall.id === reclassified.id);
  assert.ok(selectedWallNow === 'exterior' && changedWall, 'the wall is reclassified');
  const misnamed = (await rooms()).find((room) => room.page === 3 && room.name === 'down');
  assert.ok(misnamed, 'the stair landing was read as "down"');
  await page.evaluate((id) => { const box = document.querySelector('[data-room-id="' + id + '"] input[type="checkbox"]'); if (box && !box.checked) box.click(); }, misnamed.id);
  await settle();
  await page.click('[aria-label="Name for down"]', { clickCount: 3 });
  await page.keyboard.type('Landing');
  await page.keyboard.press('Tab');
  await settle();
  const renamed = (await rooms()).find((room) => room.id === misnamed.id);
  assert.equal(renamed?.name, 'Landing', 'the room is renamed and keeps its identity');
  const correctionsKept = (state, when) => {
    const door = state.placedOpenings.find((item) => item.id === robeDoor.id);
    assert.ok(door && !door.needsClassification, `the confirmed door stays confirmed ${when}`);
    assert.equal(state.placedOpenings.filter((item) => item.id === robeDoor.id).length, 1, `the confirmed door is not duplicated ${when}`);
    assert.equal(state.completedWallRuns.find((wall) => wall.id === reclassified.id)?.category, 'exterior', `the reclassified wall stays exterior ${when}`);
    const list = state.aiAnalysis?.rooms || [];
    assert.equal(list.find((room) => room.id === misnamed.id)?.name, 'Landing', `the renamed room keeps its name ${when}`);
    assert.equal(list.filter((room) => room.page === 3 && room.name === 'down').length, 0, `the wrong name does not come back ${when}`);
  };
  report.cases.corrections = { confirmedDoor: robeDoor.id, reclassifiedWall: reclassified.id, renamedRoom: misnamed.id };

  // 5. Save and reopen: geometry, the corrected room and its finish come back unchanged.
  const beforeSave = await snapshot();
  await save();
  await page.evaluate(() => harness.reopen());
  await page.waitForFunction(() => harness.snapshot().imageReady && harness.snapshot().completedWallRuns.length > 0, { timeout: 180000 });
  await settle();
  const reopened = await snapshot();
  assert.deepEqual(reopened.completedWallRuns.map((wall) => wall.id).sort(), beforeSave.completedWallRuns.map((wall) => wall.id).sort(), 'reopened walls');
  assert.deepEqual(reopened.placedOpenings.map((item) => item.id).sort(), beforeSave.placedOpenings.map((item) => item.id).sort(), 'reopened openings');
  const reopenedRoom = (reopened.aiAnalysis?.rooms || []).find((room) => room.id === target.id);
  assert.ok(reopenedRoom && reopenedRoom.areaM2 === edited.areaM2 && reopenedRoom.floorFinish === 'Carpets' && reopenedRoom.boundaryEdited, 'the corrected room, its area and finish survive save and reopen');
  assert.equal((reopened.aiAnalysis?.rooms || []).length, (beforeSave.aiAnalysis?.rooms || []).length, 'reopened rooms');
  laundryKept(reopened.aiAnalysis?.rooms || [], 'after save and reopen');
  correctionsKept(reopened, 'after save and reopen');

  // 6. Run the analysis again on the reopened job: nothing is duplicated and the correction is kept.
  const second = await run('secondRun');
  assert.match(second, /already been analysed|already in|AI TAKEOFF COMPLETE/i, second);
  assert.deepEqual(report.cases.secondRun.requests.filter((item) => /^(measure|refine)/.test(item)), [], 'an analysed plan is not measured a second time');
  const again = await snapshot();
  assert.equal(again.completedWallRuns.length, beforeSave.completedWallRuns.length, 'repeated analysis adds no walls');
  assert.equal(again.placedOpenings.length, beforeSave.placedOpenings.length, 'repeated analysis adds no openings');
  assert.equal(again.completedFloorplans.length, beforeSave.completedFloorplans.length, 'repeated analysis adds no areas');
  const againRooms = again.aiAnalysis?.rooms || [];
  assert.equal(againRooms.length, (beforeSave.aiAnalysis?.rooms || []).length, 'repeated analysis adds no rooms');
  assert.equal(new Set(againRooms.map((room) => room.id)).size, againRooms.length, 'room identities are unique');
  assert.equal(againRooms.find((room) => room.id === target.id)?.areaM2, edited.areaM2, 'the hand-corrected boundary is not replaced');
  laundryKept(againRooms, 'when AI Takeoff is run again');
  correctionsKept(again, 'when AI Takeoff is run again');

  // 7. Re-measure from linework (no request): same rooms, correction kept.
  const requestsBefore = apiRequests.length;
  await page.evaluate(() => document.querySelector('[data-testid="remeasure-rooms"]').click());
  await page.waitForFunction(() => /measured from the wall linework/i.test(document.querySelector('[data-testid="room-boundary-panel"] [role="status"]')?.textContent || ''), { timeout: 600000, polling: 1000 });
  await settle();
  const remeasured = (await rooms());
  assert.equal(apiRequests.length, requestsBefore, 're-measuring makes no provider request');
  assert.equal(remeasured.length, againRooms.length, 're-measuring adds no rooms');
  assert.equal(remeasured.find((room) => room.id === target.id)?.areaM2, edited.areaM2, 're-measuring keeps the corrected room');
  laundryKept(remeasured, 'when rooms are re-measured from the linework');
  correctionsKept(await snapshot(), 'when rooms are re-measured from the linework');

  // 8. Levels and per-sheet calibration: the upper sheet becomes the Third Level with its own scale.
  await goToPage(3);
  await page.select('#ai-plan-takeoff-sheet-level-select', 'Third Level');
  await page.waitForFunction(() => harness.snapshot().sheetLevels?.[3] === 'Third Level');
  await settle();
  await centre({ x: 362, y: 436 });
  calibrationAnswer = String(19971.7 * 2);
  await button('Calibrate');
  await clickPlan({ x: 162, y: 600 });
  await clickPlan({ x: 562, y: 600 });
  await answerCalibration();
  await page.waitForFunction((value) => Math.abs((harness.snapshot().sheetCalibrations?.[3]?.pixelsPerMm || 0) - value) / value < 0.02, { timeout: 30000 }, ppmTrue / 2);
  await settle();
  const levels = await snapshot();
  const upper = (levels.aiAnalysis?.rooms || []).filter((room) => room.page === 3 && room.polygon?.length >= 3);
  const lower = (levels.aiAnalysis?.rooms || []).filter((room) => room.page === 2 && room.polygon?.length >= 3);
  const previousUpper = remeasured.filter((room) => room.page === 3 && room.polygon?.length >= 3);
  report.cases.levels = { sheetLevels: levels.sheetLevels, sheetCalibrations: levels.sheetCalibrations, upperRoom: upper[0] && { name: upper[0].name, areaM2: upper[0].areaM2, was: previousUpper.find((room) => room.id === upper[0].id)?.areaM2 } };
  for (const room of upper) { const was = previousUpper.find((item) => item.id === room.id); assert.ok(Math.abs(room.areaM2 / was.areaM2 - 4) < 0.1, `${room.name}: area follows its own sheet's calibration (${was.areaM2} -> ${room.areaM2})`); }
  for (const room of lower) assert.equal(room.areaM2, remeasured.find((item) => item.id === room.id).areaM2, 'the other sheet is not rescaled');
  // Walls follow their own sheet's calibration too: the recalibrated sheet's walls double, the other sheet's do not move.
  for (const wall of levels.completedWallRuns) {
    const was = again.completedWallRuns.find((item) => item.id === wall.id);
    if (Number(wall.page) === 3) assert.ok(Math.abs(wall.lengthMm / was.lengthMm - 2) < 0.02, 'a wall on the recalibrated sheet follows it: ' + was.lengthMm + ' -> ' + wall.lengthMm);
    else assert.equal(wall.lengthMm, was.lengthMm, 'a wall on another sheet is unchanged');
  }
  assert.ok(Math.abs(levels.pixelsPerMm - ppmTrue / 2) / ppmTrue < 0.02, 'the working scale on the recalibrated sheet is its own');
  await goToPage(2);
  assert.ok(Math.abs((await snapshot()).pixelsPerMm - ppmTrue) / ppmTrue < 0.02, 'and returns to the scale of the other sheet when that sheet is shown');
  await goToPage(3);
  await save();
  const stored = await page.evaluate(() => harness.stored());
  assert.equal(stored.job.sheetLevels['3'], 'Third Level', 'the Third Level assignment is saved');
  assert.ok(Math.abs(stored.job.scheduleState.sheetCalibrations['3'].pixelsPerMm - ppmTrue / 2) / ppmTrue < 0.02, 'the sheet\'s own calibration is saved');
  report.cases.schedule = levels.scheduleLevels;

  assert.deepEqual(report.errors, [], 'No browser runtime errors');
  report.ok = true;
  console.log(`Real-plan replay passed: ${JSON.stringify(report.cases.accuracy)}`);
} catch (error) {
  report.error = error.stack || String(error);
  if (page) { report.failureState = await snapshot().then((value) => ({ ...value, completedWallRuns: value.completedWallRuns?.length, placedOpenings: value.placedOpenings?.length, aiAnalysis: undefined })).catch(() => null); report.status = await page.$eval('#ai-takeoff-status', (element) => element.textContent).catch(() => null); await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {}); }
  throw error;
} finally {
  report.apiRequests = apiRequests.length;
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  await browser?.close();
  await new Promise((resolve) => server.listening ? server.close(resolve) : resolve());
}

async function snapshot() { return page.evaluate(() => harness.snapshot()); }
async function settle() { await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))); }
async function goToPage(number) { await page.evaluate((value) => harness.goToPage(value), number); await page.waitForFunction((value) => harness.snapshot().currentPage === value && harness.snapshot().imageReady, { timeout: 120000 }, number); await settle(); await new Promise((resolve) => setTimeout(resolve, 500)); }
async function centre(point) { await page.evaluate((point) => { const size = harness.viewSize(); harness.setView({ zoom: 1, pan: { x: size.width / 2 - point.x, y: size.height / 2 - point.y } }); }, point); await settle(); }
async function fit() { await page.evaluate(() => { const size = harness.viewSize(); const zoom = 2.3; harness.setView({ zoom, pan: { x: size.width / 2 - 362 * zoom, y: size.height / 2 - 436 * zoom } }); }); await settle(); await new Promise((resolve) => setTimeout(resolve, 300)); }
async function button(label, prefix = false) { const found = await page.evaluate(({ label, prefix }) => { const element = [...document.querySelectorAll('button')].find((item) => prefix ? item.textContent.trim().startsWith(label) : item.textContent.trim() === label); if (!element) return false; element.click(); return true; }, { label, prefix }); assert.ok(found, `Find button ${label}`); await settle(); }
// The screen asks for the known dimension in its own confirmation dialog (it used to be a browser prompt).
async function answerCalibration() {
  await page.waitForSelector('[data-testid="calibration-confirmation"]');
  await page.click('[data-testid="calibration-dimension-mm"]', { clickCount: 3 });
  await page.type('[data-testid="calibration-dimension-mm"]', calibrationAnswer);
  await page.click('[data-testid="confirm-calibration"]');
  await settle();
}
async function clickPlan(point) { const client = await page.evaluate((point) => harness.point(point), point); await page.mouse.move(client.x, client.y); await page.mouse.click(client.x, client.y); await settle(); await new Promise((resolve) => setTimeout(resolve, 650)); }
async function dragPlan(from, to) { const points = await page.evaluate(({ from, to }) => [harness.point(from), harness.point(to)], { from, to }); await page.mouse.move(points[0].x, points[0].y); await page.mouse.down(); await page.mouse.move(points[1].x, points[1].y, { steps: 12 }); await page.mouse.up(); await settle(); }
async function save() { const count = await page.evaluate(() => harness.saveResults().length); await page.evaluate(() => document.getElementById('ai-plan-takeoff-save-button').click()); await page.waitForFunction((count) => harness.saveResults().length > count, { timeout: 120000 }, count);
  // An autosave that was already writing reports first; the Save that was clicked is the last result once no more arrive.
  for (let seen = -1, now = await page.evaluate(() => harness.saveResults().length); seen !== now; now = await page.evaluate(() => harness.saveResults().length)) { seen = now; await new Promise((resolve) => setTimeout(resolve, 1500)); }
  const result = await page.evaluate(() => harness.saveResults().at(-1)); assert.equal(result.ok, true, result.message); await settle(); }
