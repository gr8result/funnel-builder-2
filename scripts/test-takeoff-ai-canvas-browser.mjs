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
const out = path.join(root, 'artifacts/test-artifacts/takeoff-ai-canvas');
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
const initialJob=createJobData({name:'Synthetic AI canvas regression',takeoffId:'synthetic-ai-takeoff',associatedProjectId:jobId,associatedProjectName:'Synthetic AI canvas regression',currentPage:2,totalPages:2,rotation:0,pixelsPerMm:0.1,planPages:pages,planFilename:'synthetic-plan.pdf',completedWallRuns:[manualWall],sheetLevels:{1:'Ground Floor',2:'Second Level'},projectInfo:{projectName:'Synthetic AI canvas regression'},platformProject:{projectId:jobId,projectName:'Synthetic AI canvas regression'}});
function findFiber(fiber){if(!fiber)return null;if(fiber.type===Takeoff)return fiber;return findFiber(fiber.child)||findFiber(fiber.sibling);}
function hooks(){const values=[];let hook=findFiber(reactRoot._internalRoot.current)?.memoizedState;while(hook){values.push(hook);hook=hook.next;}return values;}
function value(name){return hooks()[indexes[name]]?.memoizedState;}
function dispatch(name,next){const hook=hooks()[indexes[name]];if(!hook?.queue?.dispatch)throw Error('Missing state hook '+name);hook.queue.dispatch(next);}
function snapshot(){
 const result={};for(const name of ['currentPage','totalPages','pixelsPerMm','rotation','stageScale','stagePos','activeTool','activePolyline','selectedWallId','selectedOpeningId','completedWallRuns','placedOpenings','completedAreas','completedFloorplans','completedMeasurements','completedEaves','sheetLevels','savedRevision','hasUnsavedChanges','platformSaveMessage','planLoadError'])result[name]=value(name);
 result.imageReady=Boolean(value('image'));result.mounted=Boolean(findFiber(reactRoot._internalRoot.current));
 result.planPages=(value('planPages')||[]).map(p=>({pageNumber:p.pageNumber,hasImage:Boolean(p.dataUrl),dataUrlAssetId:p.dataUrlAssetId||null}));
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
  assert.equal((await snapshot()).completedWallRuns.length, 1);

  // First prove the existing manual object can still be selected, changed,
  // saved, closed, and reopened before exercising the new admission bridge.
  await button('Select');
  await clickPlan({ x: 170, y: 80 });
  await page.waitForFunction(id => harness.snapshot().selectedWallId === id, {}, manualId);
  await dragPlan({ x: 300, y: 80 }, { x: 340, y: 80 });
  let state = await snapshot();
  close(state.completedWallRuns[0].nodes[1].x, 340, 'Manual vertex moved');
  close(state.completedWallRuns[0].lengthMm, 2600, 'Manual length recalculated');
  await save();
  await reopen();
  state = report.cases.manualSaveReopen = await snapshot();
  const preservedManual = state.completedWallRuns.find(wall => wall.id === manualId);
  close(preservedManual.nodes[1].x, 340, 'Manual edited vertex survived reopen');
  assert.equal(preservedManual.notes, 'Manual object must survive AI append');
  assert.equal(state.currentPage, 2);
  await page.screenshot({ path: path.join(out, '1-manual-saved-reopened.png') });
  console.log('Existing manual selection, vertex edit, verified Save and reopen passed.');

  // Preserve a live selection, view and unfinished manual line when admission
  // happens. This would fail if injection went through loadJobData.
  await setView();
  await button('Select');
  await clickPlan({ x: 170, y: 80 });
  await button('Walls');
  await clickPlan({ x: 850, y: 700 });
  const before = await snapshot();
  assert.equal(before.activePolyline.length, 1);
  assert.equal(before.selectedWallId, manualId);
  await fixture();
  await page.waitForFunction(() => harness.snapshot().completedWallRuns.length === 4 && harness.snapshot().placedOpenings.length === 1);
  state = report.cases.injected = await snapshot();
  for (const key of ['currentPage', 'pixelsPerMm', 'rotation', 'stageScale', 'stagePos', 'activePolyline', 'selectedWallId', 'activeTool']) assert.deepEqual(state[key], before[key], `Injection preserves ${key}`);
  assert.deepEqual(state.completedWallRuns.find(wall => wall.id === manualId), preservedManual, 'Manual object unchanged by injection');
  assert.equal(state.hasUnsavedChanges, true, 'Injection marks draft dirty');
  const aiWalls = state.completedWallRuns.filter(wall => wall.source === 'ai');
  assert.equal(aiWalls.filter(wall => wall.category === 'exterior').length, 2);
  assert.equal(aiWalls.filter(wall => wall.category === 'interior').length, 1);
  assert.ok(aiWalls.every(wall => Number.isFinite(wall.confidence) && wall.confidence >= 0 && wall.confidence <= 1));
  const opening = state.placedOpenings[0];
  assert.equal(opening.source, 'ai');
  assert.equal(opening.type, 'window');
  assert.ok(aiWalls.some(wall => wall.id === opening.hostWallId));
  assertSchedule(state);
  await page.screenshot({ path: path.join(out, '2-ai-and-manual-coexist.png') });
  await button('Takeoff Schedule', true);
  report.cases.displayedSchedule = await page.evaluate(() => {
    const titles = ['Exterior Walls', 'Interior Walls and Plasterboard', 'Windows'];
    const sections = [...document.querySelectorAll('details')];
    const result = {};
    for (const title of titles) {
      const section = sections.find(item => item.querySelector('summary')?.textContent.trim() === title);
      result[title] = section ? [...section.querySelectorAll('tbody tr')].map(row => [...row.querySelectorAll('td')].slice(0, 3).map(cell => cell.textContent.trim())) : null;
    }
    // Collapse unrelated native disclosure panels so the screenshot shows the
    // three live schedules together, using the same controls as an estimator.
    for (const section of sections) if (section.open && !titles.includes(section.querySelector('summary')?.textContent.trim())) section.querySelector('summary').click();
    return result;
  });
  // Exterior Walls is now grouped by level then by canonical construction system/frame (Phase 2A),
  // not the old flat per-instance rows: rebuild the same rows the redesigned schedule renders.
  const expectedExteriorRows = state.schedule.currentSheet.wallSystems.levels.flatMap((levelGroup) => {
    const visible = levelGroup.external.rows.filter((row) => row.lengthM > 0);
    if (!visible.length) return [];
    return [
      ...visible.map((row) => [row.system === 'unclassified' ? `⚠ Unclassified External Wall — REVIEW REQUIRED` : row.label, row.frameLabel, row.lengthM.toFixed(2)]),
      [`${levelGroup.level} External Total`, levelGroup.external.totalLengthM.toFixed(2)],
    ];
  });
  assert.deepEqual(report.cases.displayedSchedule['Exterior Walls'], expectedExteriorRows, 'Exterior Walls is rendered grouped by level and canonical construction system/frame');
  assert.deepEqual(report.cases.displayedSchedule['Interior Walls and Plasterboard'], state.schedule.currentSheet.interiorWallsAndPlasterboard.map(row => [String(row.category || row.wallType), String(row.quantity ?? row.lengthM ?? row.netAreaM2 ?? 0), String(row.unit || 'm2')]), 'Interior Walls and Plasterboard is rendered with the expected live categories and quantities');
  // Windows is now real, human-readable rows grouped by level (Phase 2A part 6): actual code,
  // size and qty, never the old generic category/quantity/unit columns.
  const expectedWindowRows = state.schedule.currentSheet.windows.filter((row) => row.category === 'Window')
    .map((row) => [String(row.code || row.itemId), String(row.sizeLabel || '—'), String(row.quantity)]);
  assert.deepEqual(report.cases.displayedSchedule['Windows'], expectedWindowRows, 'Windows is rendered with real code/size/qty rows, not internal ids');
  await settle();
  await page.screenshot({ path: path.join(out, '2b-live-takeoff-schedule.png') });
  await button('Close');
  await fixture();
  const repeated = await snapshot();
  assert.deepEqual(repeated.completedWallRuns, state.completedWallRuns, 'Repeated result does not duplicate walls');
  assert.deepEqual(repeated.placedOpenings, state.placedOpenings, 'Repeated result does not duplicate openings');
  report.cases.duplicateSuppressed = true;
  console.log('Fixture append preserves manual geometry, selection, view and unfinished drawing; duplicate suppression passed.');

  // Use existing Select, vertex drag, opening editor and keyboard deletion.
  // Integer screen pixels at zoom 1 avoid Chromium rounding a fractional mouse
  // position when asserting an exact logical-coordinate endpoint.
  await page.evaluate(() => harness.setView({ zoom: 1, pan: { x: 25, y: 30 } }));
  await settle();
  await button('Select');
  const aiHost = aiWalls.find(wall => wall.id === opening.hostWallId);
  await clickPlan({ x: 300, y: 225 });
  await page.waitForFunction(id => harness.snapshot().selectedWallId === id, {}, aiHost.id);
  await dragPlan(aiHost.nodes[0], { x: aiHost.nodes[0].x - 30, y: aiHost.nodes[0].y });
  state = await snapshot();
  const editedAiWall = state.completedWallRuns.find(wall => wall.id === aiHost.id);
  close(editedAiWall.nodes[0].x, aiHost.nodes[0].x - 30, 'AI wall vertex uses ordinary editing');
  close(editedAiWall.lengthMm, aiHost.lengthMm + 300, 'AI wall edit recalculates its stored length');
  report.cases.aiWallLengthEdit = { id: aiHost.id, beforeM: aiHost.lengthMm / 1000, afterM: editedAiWall.lengthMm / 1000, scheduleAfterM: state.schedule.measurementRecords.find(item => item.id === aiHost.id).quantity };
  assert.equal(editedAiWall.source, 'ai');
  assert.equal(editedAiWall.confidence, aiHost.confidence);
  assertSchedule(state);
  await clickPlan({ x: opening.x, y: opening.y });
  await page.waitForFunction(id => harness.snapshot().selectedOpeningId === id, {}, opening.id);
  await editLabelInput('Location / room', 'Reviewed study window');
  const editedOpening = (await snapshot()).placedOpenings[0];
  assert.equal(editedOpening.location, 'Reviewed study window');
  const interior = aiWalls.find(wall => wall.category === 'interior');
  await clickPlan({ x: 410, y: 405 });
  await page.waitForFunction(id => harness.snapshot().selectedWallId === id, {}, interior.id);
  await page.keyboard.press('Delete');
  await page.waitForFunction(id => !harness.snapshot().completedWallRuns.some(wall => wall.id === id), {}, interior.id);
  state = report.cases.editedAndDeleted = await snapshot();
  assert.equal(state.completedWallRuns.length, 3);
  assert.equal(state.placedOpenings[0].hostWallId, aiHost.id);
  assertSchedule(state);
  await fixture();
  assert.ok(!(await snapshot()).completedWallRuns.some(wall => wall.id === interior.id), 'Repeat cannot resurrect a deleted AI wall');
  await save();
  const stored = await page.evaluate(() => harness.stored());
  assert.equal(stored.key, `job:${jobId}`);
  assert.deepEqual(stored.job, stored.mirror, 'Canonical job and compatibility mirror match');
  assert.ok(stored.raw.plan.pages.every(plan => plan.dataUrlAssetId && !plan.dataUrl), 'Real persistence externalizes plan images');
  assert.ok(stored.job.plan.pages.every(plan => plan.dataUrl), 'Real load materializes all plan images');
  assert.ok(stored.job.scheduleState?.aiAppliedRuns, 'Applied-run receipts use the existing canonical scheduleState');
  report.cases.persistence = { key: stored.key, revision: stored.revision, checksum: stored.checksum, takeoffRevision: stored.job.revision, wallIds: stored.job.completedWallRuns.map(wall => wall.id), openingIds: stored.job.placedOpenings.map(item => item.id), aiAppliedRuns: stored.job.scheduleState.aiAppliedRuns };
  await reopen();
  state = report.cases.aiReopened = await snapshot();
  assert.deepEqual(state.completedWallRuns.find(wall => wall.id === aiHost.id), editedAiWall, 'AI provenance and edited geometry survive canonical save/reopen');
  assert.deepEqual(state.completedWallRuns.find(wall => wall.id === manualId), preservedManual);
  assert.equal(state.placedOpenings[0].location, 'Reviewed study window');
  assert.equal(state.placedOpenings[0].source, 'ai');
  assert.equal(state.placedOpenings[0].confidence, opening.confidence);
  assert.deepEqual(state.placedOpenings[0], { ...editedOpening, openingType: editedOpening.type }, 'All opening fields and AI provenance survive canonical save/reopen, including the existing load-time openingType alias');
  assert.ok(!state.completedWallRuns.some(wall => wall.id === interior.id));
  await fixture();
  assert.equal((await snapshot()).completedWallRuns.length, 3, 'Receipt survives component remount and prevents deleted object resurrection');
  await page.screenshot({ path: path.join(out, '3-ai-edits-saved-reopened.png') });
  console.log('AI selection, vertex edit, opening edit, delete, verified persistence and reopen passed.');

  // Continue normal manual drawing in the mixed job, then test a whole-page
  // reload so restoration cannot rely on retained component state.
  await setView(1);
  await button('Walls');
  await clickPlan({ x: 850, y: 700 });
  await clickPlan({ x: 1100, y: 700 });
  await button('Finish Wall Run', true);
  await page.waitForFunction(() => harness.snapshot().completedWallRuns.length === 4);
  state = await snapshot();
  const secondManual = state.completedWallRuns.find(wall => wall.id !== manualId && wall.source !== 'ai');
  assert.ok(secondManual, 'Manual drawing still creates an ordinary wall after AI review');
  close(secondManual.lengthMm, 2500, 'New manual wall length');
  await save();
  await page.reload({ waitUntil: 'load', timeout: 60000 });
  await ready();
  state = report.cases.fullReload = await snapshot();
  assert.equal(state.completedWallRuns.length, 4);
  assert.deepEqual(state.completedWallRuns.find(wall => wall.id === manualId), preservedManual);
  assert.equal(state.completedWallRuns.find(wall => wall.id === secondManual.id).lengthMm, 2500);
  assert.equal(state.completedWallRuns.filter(wall => wall.source === 'ai').length, 2);
  assert.equal(state.placedOpenings.length, 1);
  assert.equal(state.planPages.filter(plan => plan.hasImage).length, 2);
  assertSchedule(state);
  await fixture();
  assert.equal((await snapshot()).completedWallRuns.length, 4, 'Full reload retains the admission receipt');
  await page.screenshot({ path: path.join(out, '4-full-reload-manual-and-ai.png') });
  // Supabase's own cross-tab auth lock occasionally logs a benign retry notice ("no lock was
  // stolen") under this test's rapid sequence of saves/reopens in one isolated profile; it is a
  // Supabase-internal retry signal, not a functional failure - every save/reopen assertion above
  // already proved the actual saves and reopens succeeded correctly before this could arise.
  const realErrors = report.errors.filter(message => !/no lock was stolen/.test(message));
  assert.deepEqual(realErrors, [], 'No unexpected browser runtime errors');
  assert.deepEqual(report.dialogs, ['Delete selected item?'], 'Only the expected deliberate deletion confirmation was shown');
  report.ok = true;
  console.log('AI Takeoff canvas browser regression passed: real manual edits, fixture append, dedupe, AI selection/edit/delete, schedule quantities, verified IndexedDB save/reopen, and continued manual drawing.');
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
