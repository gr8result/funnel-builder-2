import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import puppeteer from 'puppeteer';

// Actual Takeoff UI + actual workbook hook + actual IndexedDB persistence. The
// synthetic job and Chromium profile belong exclusively to this test. No server
// AI, credentials, user storage, or substituted save/load implementation is used.
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'artifacts/test-results/interactive-rooms-browser');
const componentPath = path.join(root, 'components/construction-estimation/ai-plan-takeoff/AIPlanTakeoffStandalone.jsx');
const workbookHookPath = path.join(root, 'hooks/estimate-builder/useEstimateBuilderWorkbook.js');
const takeoffDir = path.dirname(componentPath);
const jobId = 'synthetic-ai-canvas-regression';
const manualId = 'existing-manual-wall';
fs.mkdirSync(out, { recursive: true });

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
const manualId=${JSON.stringify(manualId)};
const reactRoot=createRoot(document.getElementById('root'));
let currentSheet=null,control=null;
const saveResults=[];
const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=900;
const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,1200,900);
ctx.strokeStyle='#64748b';ctx.lineWidth=1;ctx.strokeRect(40,40,1120,820);
ctx.fillStyle='#334155';ctx.font='20px sans-serif';ctx.fillText('Synthetic AI canvas regression — second storey',70,55);
const image=canvas.toDataURL('image/png');
const pages=[1,2].map(pageNumber=>({pageNumber,dataUrl:image,width:1200,height:900,logicalWidth:1200,logicalHeight:900,renderScale:1,vectorSegments:[]}));
const manualWall={id:manualId,page:2,category:'exterior',nodes:[{x:80,y:80},{x:300,y:80}],lengthMm:2200,thicknessMm:230,alignment:'outer',exteriorType:'Face Brick Veneer',linedFaces:2,openingDeductionsEnabled:true,wallHeightM:null,notes:'Manual object must survive AI append'};
const roomNames=['Bedroom','Kitchen','Main Bathroom','Ensuite','Laundry','Garage','Alfresco'];
const testRooms=roomNames.map((name,i)=>{const x=100+(i%4)*180,y=200+Math.floor(i/4)*220;return {id:'test-room-'+i,page:2,level:'Second Level',levelId:'Second Level',name,type:name,polygon:[{x,y},{x:x+140,y},{x:x+140,y:y+160},{x,y:y+160}],areaM2:2.24,perimeterM:6,pixelsPerMm:0.1,confidence:0.96,basis:'OBSERVED',source:'plan',boundaryClosed:true,reviewRequired:false,reviewReasons:[],actions:[],selected:false};});
const initialJob=createJobData({name:'Synthetic AI canvas regression',takeoffId:'synthetic-ai-takeoff',associatedProjectId:jobId,associatedProjectName:'Synthetic AI canvas regression',currentPage:2,totalPages:2,rotation:0,pixelsPerMm:0.1,planPages:pages,planFilename:'synthetic-plan.pdf',completedWallRuns:[manualWall],sheetLevels:{1:'Ground Floor',2:'Second Level'},projectInfo:{projectName:'Synthetic AI canvas regression'},platformProject:{projectId:jobId,projectName:'Synthetic AI canvas regression'}});
function findFiber(fiber){if(!fiber)return null;if(fiber.type===Takeoff)return fiber;return findFiber(fiber.child)||findFiber(fiber.sibling);}
function hooks(){const values=[];let hook=findFiber(reactRoot._internalRoot.current)?.memoizedState;while(hook){values.push(hook);hook=hook.next;}return values;}
function value(name){return hooks()[indexes[name]]?.memoizedState;}
function dispatch(name,next){const hook=hooks()[indexes[name]];if(!hook?.queue?.dispatch)throw Error('Missing state hook '+name);hook.queue.dispatch(next);}
function snapshot(){
 const result={};for(const name of ['currentPage','totalPages','pixelsPerMm','rotation','stageScale','stagePos','activeTool','activePolyline','selectedWallId','selectedOpeningId','completedWallRuns','placedOpenings','completedAreas','completedFloorplans','completedMeasurements','completedEaves','sheetLevels','savedRevision','hasUnsavedChanges','platformSaveMessage','planLoadError'])result[name]=value(name);
 result.imageReady=Boolean(value('image'));result.mounted=Boolean(findFiber(reactRoot._internalRoot.current));
 result.planPages=(value('planPages')||[]).map(p=>({pageNumber:p.pageNumber,hasImage:Boolean(p.dataUrl),dataUrlAssetId:p.dataUrlAssetId||null}));
 let analysisHook=findFiber(reactRoot._internalRoot.current)?.memoizedState;while(analysisHook){if(analysisHook.memoizedState?.schemaVersion==='ai-takeoff-analysis.v1')result.aiAnalysis=analysisHook.memoizedState;analysisHook=analysisHook.next;}
 result.roomNodes=value('stageRef').current?.find('Line').filter(n=>n.name().startsWith('room-boundary:')).map(n=>({name:n.name(),fill:n.fill()}));
 result.schedule=createTakeoffSchedule({...result});
 return JSON.parse(JSON.stringify(result));
}
initialJob.scheduleState={...initialJob.scheduleState,aiAnalysis:{schemaVersion:'ai-takeoff-analysis.v1',status:'rooms',rooms:testRooms}};
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
 return visible?React.createElement(Takeoff,{key:mount,embedded:true,enableAiTakeoffDevelopment:true,openTakeoffJobRequest:request,platformContext:{projectId:jobId,projectName:'Synthetic AI canvas regression',noJobOpen:false,isHydratingProject:false},onSaveToPlatform:async incoming=>{const workbook=currentSheet.getCurrentWorkbook();const prepared=prepareAiPlanTakeoffJobForSave(workbook.aiPlanTakeoffJob,incoming,jobId);const result=prepared.ok?await currentSheet.saveAiPlanTakeoffJob(prepared.job):prepared;saveResults.push(result);return result;}}):React.createElement('div',null,'Takeoff closed');
}
window.harness={snapshot,saveResults:()=>saveResults,ready:()=>Boolean(currentSheet?.hydrated),
 async seed(){const workbook={...createEstimateBuilderWorkbookDefaults(),jobId,projectId:jobId,commercialProjectId:jobId,projectName:'Synthetic AI canvas regression',registeredJob:{jobId,jobName:'Synthetic AI canvas regression'},jobFileMeta:{projectId:jobId,jobName:'Synthetic AI canvas regression'},aiPlanTakeoffJob:initialJob,takeoffEngine:{aiPlanTakeoffJob:initialJob}};const result=await currentSheet.loadJobFileData({workbook,jobName:'Synthetic AI canvas regression'},'synthetic-ai-canvas.gr8job');if(!result.ok)throw Error(result.message);await control.open(initialJob);return result;},
 reopen:()=>control.reopen(),
 setView({zoom,pan}){value('sheetViewStateRef').current[2]={scale:zoom,pos:pan};dispatch('stageScale',zoom);dispatch('stagePos',pan);},
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
    plugins: [new webpack.IgnorePlugin({ resourceRegExp: /^node:/ }), new webpack.DefinePlugin({ 'process.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify('http://127.0.0.1:9'), 'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify('isolated-browser-test-anon-key') })],
    optimization: { minimize: false }, performance: { hints: false },
  });
  compiler.run((error, stats) => {
    const result = stats?.toJson({ all: false, errors: true, warnings: true });
    fs.writeFileSync(path.join(out, 'build.json'), JSON.stringify(result || { error: String(error) }, null, 2));
    compiler.close(() => error || stats?.hasErrors() ? reject(error || new Error(JSON.stringify(result.errors))) : resolve());
  });
});
console.log('Browser bundle ready; starting isolated Chromium acceptance checks.');

const server = http.createServer((req, res) => {
  if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'application/javascript'); fs.createReadStream(path.join(out, 'browser-bundle.js')).pipe(res); }
  else { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><meta charset="utf-8"><title>AI canvas integration regression</title><style>html,body,#root{height:100%;margin:0;font-family:Arial}</style><div id="root"></div><script src="/bundle.js"></script>'); }
});
const report = { scope: 'Real component and real workbook hook, manual Save and reopen through real IndexedDB, synthetic job only, isolated Chromium profile, external network blocked', cases: {}, errors: [], dialogs: [] };
let browser;
let page;
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, userDataDir: path.join(out, 'isolated-browser-' + Date.now()), args: ['--no-first-run', '--disable-extensions', '--disable-background-networking'], defaultViewport: { width: 1800, height: 1200 } });
  page = await browser.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('dialog', async dialog => {
    report.dialogs.push(dialog.message());
    if (dialog.type() === 'confirm' && dialog.message() === 'Delete selected item?') await dialog.accept();
    else await dialog.dismiss();
  });
  await page.setRequestInterception(true);
  page.on('request', request => request.url().startsWith(origin) || /^(data|blob):/.test(request.url()) ? request.continue() : request.abort());
  await page.goto(origin, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.harness?.ready());
  await page.evaluate(() => harness.seed());
  await ready();
  await setView();
  await page.evaluate(()=>document.querySelector('[data-testid="room-boundary-panel"] input[type="checkbox"]').click());
  await settle();
  const roomSnapshot=async()=> (await snapshot()).aiAnalysis.rooms;
  const first=await page.evaluate(()=>harness.point({x:170,y:280}));
  await page.mouse.move(first.x,first.y);await settle();
  assert((await snapshot()).roomNodes.find(n=>n.name==='room-boundary:test-room-0').fill.includes('0.28'),'Hover fill');
  await page.mouse.move(5,5);await settle();
  assert((await snapshot()).roomNodes.find(n=>n.name==='room-boundary:test-room-0').fill.includes('0.01'),'Hover clears');
  await clickPlan({x:170,y:280});
  assert((await roomSnapshot())[0].selected,'Click locks');
  await clickPlan({x:350,y:280});
  assert.equal((await roomSnapshot()).filter(r=>r.selected).length,2,'Multi-select without modifiers');
  const panBefore=(await snapshot()).stagePos;
  await dragPlan({x:850,y:700},{x:890,y:730});
  assert.notDeepEqual((await snapshot()).stagePos,panBefore,'Dragging background pans the plan');
  await setView(0.8);
  assert.equal((await roomSnapshot()).filter(r=>r.selected).length,2,'Selection survives zoom and pan');
  await clickPlan({x:170,y:280});
  assert(!(await roomSnapshot())[0].selected,'Second click deselects');
  await clickPlan({x:170,y:280});
  await button('Floor Tiling',true);
  let rooms=await roomSnapshot();
  assert(rooms[0].actions.includes('Floor Tiling')&&rooms[1].actions.includes('Floor Tiling'));
  assert.equal((await snapshot()).schedule.measurementRecords.filter(r=>r.kind==='floorFinish').length,2);
  await page.evaluate(()=>document.querySelector('[data-room-id="test-room-0"] button').click());
  await settle();
  await dragPlan({x:240,y:360},{x:280,y:360});
  rooms=await roomSnapshot();assert.equal(rooms[0].areaM2,2.56,'Vertex correction recalculates area');
  await page.evaluate(()=>[...document.querySelectorAll('[data-room-id="test-room-0"] button')].find(b=>b.textContent==='Confirm boundary').click());
  await save();await reopen();
  rooms=await roomSnapshot();assert.equal(rooms[0].areaM2,2.56,'Boundary survives real saved-job reopen');assert(rooms[0].selected);
  await page.evaluate(()=>document.querySelector('[data-testid="room-boundary-panel"] input[type="checkbox"]').click());
  await setView(0.8);
  const profiler=await page.createCDPSession();
  await profiler.send('HeapProfiler.collectGarbage');
  const before=await page.metrics();
  const liveNodesBefore=await page.evaluate(()=>document.querySelectorAll('*').length);
  for(let i=0;i<60;i++){await clickPlan({x:350,y:280});await page.mouse.move(5,5);}
  await profiler.send('HeapProfiler.collectGarbage');
  const after=await page.metrics();
  const liveNodesAfter=await page.evaluate(()=>document.querySelectorAll('*').length);
  report.memory={before,after,liveNodesBefore,liveNodesAfter};
  assert.equal(liveNodesAfter,liveNodesBefore,'Mounted DOM size returns to its initial size');
  assert(after.Nodes-before.Nodes<200,'No growing DOM tree');
  assert(after.JSHeapUsedSize-before.JSHeapUsedSize<64*1024*1024,'Bounded heap during repeated selections');
  await profiler.detach();
  report.cases={rooms:(await roomSnapshot()).map(r=>({name:r.name,areaM2:r.areaM2,perimeterM:r.perimeterM})),hover:true,multiselect:true,zoomPan:true,correction:true,persistence:true,heapDelta:after.JSHeapUsedSize-before.JSHeapUsedSize};
  await page.screenshot({path:path.join(out,'interactive-rooms.png')});
  assert.deepEqual(report.errors.filter(message=>!/no lock was stolen/.test(message)),[]);
  report.ok=true;console.log('PASS real takeoff browser: seven room types, hover, deselect, multi-select, zoom/pan, edit, quantities, save/reopen and bounded repeated interaction');
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
async function snapshot() { return page.evaluate(() => harness.snapshot()); }
async function settle() { await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); }
async function ready() { await page.waitForFunction(() => window.harness?.snapshot().imageReady && harness.snapshot().currentPage === 2, { timeout: 60000 }); await settle(); }
async function setView(zoom = 0.85) { await page.evaluate(zoom => harness.setView({ zoom, pan: { x: 25, y: 30 } }), zoom); await settle(); }
async function button(label, prefix = false) { const found = await page.evaluate(({ label, prefix }) => { const element = [...document.querySelectorAll('button')].find(item => prefix ? item.textContent.trim().startsWith(label) : item.textContent.trim() === label); if (!element) return false; element.click(); return true; }, { label, prefix }); assert.ok(found, `Find button ${label}`); await settle(); }
async function fixture() { await page.waitForSelector('#ai-takeoff-development-fixture'); await page.waitForFunction(() => !document.getElementById('ai-takeoff-development-fixture').disabled); await page.evaluate(() => document.getElementById('ai-takeoff-development-fixture').click()); await page.waitForFunction(() => !document.getElementById('ai-takeoff-development-fixture').disabled && document.querySelector('[data-testid="ai-takeoff-development-result"]')); const message = await page.$eval('[data-testid="ai-takeoff-development-result"]', element => element.textContent); assert.ok(!message.startsWith('Import rejected:'), message); await settle(); }
async function clickPlan(point) { const client = await page.evaluate(point => harness.point(point), point); await page.mouse.move(client.x, client.y); await page.mouse.click(client.x, client.y); await settle(); await new Promise(resolve => setTimeout(resolve, 650)); }
async function dragPlan(from, to) { const points = await page.evaluate(({ from, to }) => [harness.point(from), harness.point(to)], { from, to }); await page.mouse.move(points[0].x, points[0].y); await page.mouse.down(); await page.mouse.move(points[1].x, points[1].y, { steps: 12 }); await page.mouse.up(); await settle(); }
async function save() { const count = await page.evaluate(() => harness.saveResults().length); await page.evaluate(() => document.getElementById('ai-plan-takeoff-save-button').click()); await page.waitForFunction(count => harness.saveResults().length > count, { timeout: 60000 }, count); const result = await page.evaluate(() => harness.saveResults().at(-1)); assert.equal(result.ok, true, result.message); assert.equal(result.verification?.ok, true, 'Existing verification confirms saved payload'); await page.waitForFunction(() => !harness.snapshot().hasUnsavedChanges); }
async function reopen() { await page.evaluate(() => harness.reopen()); await ready(); }
async function editLabelInput(label, text) { const input = await page.evaluateHandle(label => [...document.querySelectorAll('label')].find(element => element.textContent.trim().startsWith(label))?.querySelector('input'), label); assert.ok(input.asElement(), `Find input ${label}`); await input.asElement().click({ clickCount: 3 }); await page.keyboard.type(text); await page.keyboard.press('Tab'); await settle(); await input.dispose(); }
function assertSchedule(state) {
  const records = state.schedule.measurementRecords;
  const totals = { exterior: 0, interior: 0 };
  for (const wall of state.completedWallRuns) {
    const record = records.find(item => item.id === String(wall.id) && item.kind === 'wall');
    assert.ok(record, `Schedule includes wall ${wall.id}`);
    const length = wall.nodes.slice(1).reduce((sum, node, index) => sum + Math.hypot(node.x - wall.nodes[index].x, node.y - wall.nodes[index].y), 0) / state.pixelsPerMm / 1000;
    close(record.quantity, length, `Schedule wall quantity ${wall.id}`);
    assert.equal(record.category, wall.category, `Schedule retains ${wall.category} classification for ${wall.id}`);
    const wallRecord = state.schedule.projectTotals.wallRecords.find(item => item.itemId === String(wall.id));
    assert.ok(wallRecord, `Detailed schedule includes ${wall.id}`);
    assert.equal(wallRecord.wallType, wall.category === 'exterior' ? 'External walls' : 'Internal walls');
    if (wall.category === 'exterior') assert.equal(wallRecord.exteriorClassification, wall.exteriorType);
    totals[wall.category] += length;
  }
  for (const [category, itemId] of [['exterior', 'walls_external_total'], ['interior', 'walls_internal_total']]) {
    const row = state.schedule.projectTotals.walls.find(item => item.itemId === itemId);
    assert.ok(row, `Schedule has ${category} aggregate`);
    close(row.quantity, Number(totals[category].toFixed(2)), `Schedule ${category} aggregate`);
  }
  for (const opening of state.placedOpenings) {
    const record = records.find(item => item.id === String(opening.id) && item.kind === 'opening');
    assert.ok(record, `Schedule includes opening ${opening.id}`);
    assert.equal(record.quantity, Number(opening.quantity || 1));
    assert.equal(record.openingClass, opening.openingClass);
  }
}
