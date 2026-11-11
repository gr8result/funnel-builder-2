import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import puppeteer from 'puppeteer';
import { PDFDocument } from 'pdf-lib';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { compareOpenings, compareRooms, compareWalls } from '../components/construction-estimation/ai-plan-takeoff/geometry/planAccuracy.js';
import { createTakeoffAnalysisHandler } from '../lib/construction-estimation/aiTakeoffAnalysis.js';
// Vector-plan browser acceptance WITHOUT a paid provider: the original Liberty Terrace and Jesmond Road
// PDFs are uploaded through the AI Takeoff screen's own file input, a floor-plan sheet is selected and
// calibrated with the Calibrate tool, and RUN AI TAKEOFF is clicked. The provider endpoint is stubbed
// to return only sheet type and level (no walls, openings or rooms), so every wall, opening and room on
// screen is measured by the GR8 vector engine from the PDF. Results are scored against independent hand
// references; one measured room is approved explicitly, then save, reopen and rerun are checked.
//   GR8_VECTOR_PLAN=liberty|jesmond limits the run to one plan set; TAKEOFF_REPLAY_ARTIFACT_DIR sets the output folder.
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(root, process.env.TAKEOFF_REPLAY_ARTIFACT_DIR || 'artifacts/test-results/takeoff-vector-plan-browser');
const componentPath = path.join(root, 'components/construction-estimation/ai-plan-takeoff/AIPlanTakeoffStandalone.jsx');
const workbookHookPath = path.join(root, 'hooks/estimate-builder/useEstimateBuilderWorkbook.js');
const takeoffDir = path.dirname(componentPath);
const jobId = 'real-plan-replay-job';
const supabaseUrl = 'https://stubbedtakeoff.supabase.invalid', supabaseAnon = 'stub-anon-key';
fs.mkdirSync(out, { recursive: true });
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
fs.writeFileSync(loader, `const ts=require(${JSON.stringify(require.resolve('typescript'))});module.exports=function(source){if(require('path').basename(this.resourcePath)==='EstimateBuilderWorkbook.js')source=require(${JSON.stringify(path.join(root, 'scripts/lib/takeoff-quotation-test-module.cjs'))})(source,this.resourcePath);return ts.transpileModule(source,{fileName:this.resourcePath,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;};`);
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
const {QuotationSheet}=require(${JSON.stringify(path.join(root, 'components/estimate-builder/EstimateBuilderWorkbook.js'))});
const JobSetupTakeoffImport=require(${JSON.stringify(path.join(root, 'components/estimate-builder/JobSetupTakeoffImport.jsx'))}).default;
const {calculateEstimateBuilderWorkbook}=require(${JSON.stringify(path.join(root, 'lib/construction-estimation/estimateBuilderWorkbookCalculations.js'))});
const {downloadBackupCopy,readJob}=require(${JSON.stringify(path.join(root, 'lib/jobFile.ts'))});
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
 const [setupRequest,setSetupRequest]=React.useState(null);
 const [quotationVisible,setQuotationVisible]=React.useState(false);
 React.useEffect(()=>{if(!sheet.hydrated||!masterJobId(sheet.workbook)||selectJob(sheet.workbook)?.takeoffId)return;sheet.ensureAiPlanTakeoffWorkspace();},[sheet.hydrated,sheet.workbook]);
 control={showQuotation(){setQuotationVisible(true);},async reopen(){setVisible(false);await frame();const result=await currentSheet.openSavedJob('job:'+jobId);if(!result.ok)throw Error(result.message);setRequest({requestId:'reopen-'+Date.now(),jobData:result.workbook.aiPlanTakeoffJob});setMount(n=>n+1);setVisible(true);return result.key;}};
 if(!sheet.hydrated)return React.createElement('div',null,'Loading workbook');
 if(quotationVisible)return React.createElement(QuotationSheet,{sheet,onFormulaTarget:()=>{},canEditFormulas:false});
 if(setupRequest)return React.createElement(JobSetupTakeoffImport,{sheet,takeoffJob:sheet.workbook.aiPlanTakeoffJob,projectId:jobId,jobName:'Disposable scanned replay',jobOpen:true,request:setupRequest,onRequestConsumed:()=>{},onOpenTakeoff:()=>setSetupRequest(null)});
 const wb=sheet.workbook,jid=masterJobId(wb);
 const quoteRows=Object.entries(wb.quotation||{}).flatMap(([section,data])=>(data.rows||[]).map(row=>({id:row.id,section,category:row.item,description:row.item,quantity:row.quantity,unit:row.unit})));
 return visible?React.createElement(Takeoff,{key:(jid||'no-job')+':'+sheet.jobLoadVersion+':'+mount,embedded:true,jobId:jid,initialJob:selectJob(wb),initialQuoteRows:quoteRows,
 onQuoteSheetUpdate:async({previewRows=[]})=>{for(const preview of previewRows){const target=quoteRows.find(row=>row.id===preview.destinationRowId);if(!target)continue;for(const [key,value] of Object.entries({quantity:String(preview.newQuantity??''),importedQuantity:String(preview.newQuantity??''),quantityKey:'aiPlanTakeoff:'+preview.itemId,takeoffSourceId:preview.itemId,takeoffUnit:preview.unit}))currentSheet.updateQuote(target.section,target.id,key,value);}return {ok:true};},openTakeoffJobRequest:request,onJobSetupUpdate:payload=>{setSetupRequest(payload);return {ok:true};},
  onMasterTakeoffChange:(jobData)=>{try{return currentSheet.updateAiPlanTakeoffDraft(jobData);}catch(error){return {ok:false,message:error.message};}},
  platformContext:{jobId:jid,projectId:jid,projectName:'Real plan replay',noJobOpen:!jid,isHydratingProject:!sheet.hydrated},
  onSaveToPlatform:async incoming=>{saveInputs.push(JSON.parse(JSON.stringify({walls:incoming.completedWallRuns||[],openings:incoming.placedOpenings||[],floorplans:incoming.completedFloorplans||[],scheduleState:incoming.scheduleState||null})));const workbook=currentSheet.getCurrentWorkbook();const owned=linkTakeoffToMasterJob(workbook,incoming);const prepared=prepareAiPlanTakeoffJobForSave(selectJob(workbook),owned,jid);const result=prepared.ok?await currentSheet.saveAiPlanTakeoffJob(prepared.job):prepared;saveResults.push(result);return result;}}):React.createElement('div',null,'Takeoff closed');
}
// .gr8job round trip through the real export (verified download path) and the real import.
async function exportImport(){
 const wb=currentSheet.getCurrentWorkbook();let captured=null;
 const createUrl=URL.createObjectURL,click=HTMLAnchorElement.prototype.click,picker=window.showSaveFilePicker;
 URL.createObjectURL=blob=>{captured=blob;return createUrl.call(URL,blob);};HTMLAnchorElement.prototype.click=function(){};window.showSaveFilePicker=undefined;
 let exported;try{exported=await downloadBackupCopy({jobId:wb.jobId,jobName:'Real plan replay',workbook:wb});}finally{URL.createObjectURL=createUrl;HTMLAnchorElement.prototype.click=click;window.showSaveFilePicker=picker;}
 if(!exported?.ok||!captured)throw Error('Export failed: '+(exported?.message||'no file produced'));
 const read=await readJob(new File([captured],'replay.gr8job',{type:'application/zip'}));
 const loaded=await currentSheet.loadJobFileData(read,'replay.gr8job');
 if(loaded?.ok===false)throw Error('Import failed: '+loaded.message);
 const keep=window.__keepExport?await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.readAsDataURL(captured);}):null;
 return {bytes:captured.size,exportMessage:exported.message,imported:true,base64:keep};
}
window.harness={snapshot,exportImport,saveResults:()=>saveResults,saveInputs:()=>saveInputs,ready:()=>Boolean(currentSheet?.hydrated),
 async newJob(){const workbook={...createEstimateBuilderWorkbookDefaults(),jobId,projectId:jobId,commercialProjectId:jobId,projectName:'Real plan replay',registeredJob:{jobId,jobName:'Real plan replay'},jobFileMeta:{projectId:jobId,jobName:'Real plan replay'}};workbook.quotation={'Takeoff browser check':{collapsed:false,rows:[{id:'takeoff-browser-priced-check',item:'Disposable door labour check',quantityKey:'internalDoors',manualRate:'100',unit:'EACH',active:true,formulas:{}},{id:'takeoff-browser-room-check',item:'Disposable approved room floor tiling',quantity:'0',manualRate:'100',unit:'M2',active:true,formulas:{}}]}};delete workbook.aiPlanTakeoffJob;if(workbook.takeoffEngine)delete workbook.takeoffEngine.aiPlanTakeoffJob;const result=await currentSheet.loadJobFileData({workbook,jobName:'Real plan replay'},'stubbed-ai-takeoff.gr8job');if(!result.ok)throw Error(result.message);return result;},
 reopen:()=>control.reopen(),
 workbook:()=>JSON.parse(JSON.stringify(currentSheet.getCurrentWorkbook())),liveWorkbook:()=>currentSheet.getCurrentWorkbook(),
 quotation:()=>calculateEstimateBuilderWorkbook(currentSheet.getCurrentWorkbook()),
 showPricedQuotation(){control.showQuotation();},
 goToPage(page){dispatch('currentPage',page);},
 setView({zoom,pan}){value('sheetViewStateRef').current[value('currentPage')]={scale:zoom,pos:pan};dispatch('stageScale',zoom);dispatch('stagePos',pan);},
 viewSize(){return {width:value('stageRef').current.width(),height:value('stageRef').current.height()};},
 point(point){const stage=value('stageRef').current,layer=value('layerRef').current,rect=stage.content.getBoundingClientRect(),visible=layer.getAbsoluteTransform().point(point);return {x:rect.left+visible.x*rect.width/stage.width(),y:rect.top+visible.y*rect.height/stage.height()};},
 async stored(){const openDb=(name)=>new Promise((resolve,reject)=>{const request=indexedDB.open(name);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});let record;for(const {name} of await indexedDB.databases()){if(!String(name).startsWith('estimate-builder-template-db'))continue;const db=await openDb(name);if(db.objectStoreNames.contains('jobs'))record=await new Promise((resolve,reject)=>{const request=db.transaction('jobs','readonly').objectStore('jobs').get('job:'+jobId);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});db.close();if(record)break;}const materialized=await materializeTakeoffPlanPages(record.workbook);return JSON.parse(JSON.stringify({job:materialized.aiPlanTakeoffJob}));}
};
reactRoot.render(React.createElement(Shell));
`);
const cssLoader = path.join(out, 'css-loader.cjs');
fs.writeFileSync(cssLoader, `module.exports=source=>'const style=document.createElement("style");style.textContent='+JSON.stringify(source)+';document.head.appendChild(style);';`);
const webpackPackage = require('next/dist/compiled/webpack/webpack');
webpackPackage.init();
const webpack = webpackPackage.webpack;
// GR8_BUNDLE_ONLY=1 builds the bundle and stops; GR8_REUSE_BUNDLE=1 runs against the bundle already built.
// Building and running separately keeps webpack and Chrome from holding memory at the same time.
const reuseBundle = process.env.GR8_REUSE_BUNDLE === '1' && fs.existsSync(path.join(out, 'browser-bundle.js'));
console.log(reuseBundle ? `Reusing browser bundle built ${fs.statSync(path.join(out, 'browser-bundle.js')).mtime.toISOString()}.` : 'Building live Takeoff browser bundle.');
if (!reuseBundle) await new Promise((resolve, reject) => {
  const compiler = webpack({
    mode: 'development', target: 'web', devtool: false, context: root, entry,
    output: { path: out, filename: 'browser-bundle.js' },
    resolve: { extensions: ['.js', '.jsx', '.mjs', '.ts', '.tsx'], mainFields: ['browser', 'module', 'main'], fallback: { canvas: false, fs: false, path: false, url: false, stream: false, zlib: false } },
    module: { rules: [{ test: /\.css$/, use: cssLoader }, { test: /\.[jt]sx?$/, exclude: /node_modules/, resolve: { fullySpecified: false }, use: loader }] },
    plugins: [
      // GR8_LOCK_MODULE=<file> swaps lib/nonStealingLock.js inside this test bundle only (e.g. an isolated
      // auth-lock repair under test). The app's own file is not touched.
      ...(process.env.GR8_LOCK_MODULE ? [new webpack.NormalModuleReplacementPlugin(/[\\/]nonStealingLock\.js$/,path.resolve(process.env.GR8_LOCK_MODULE))] : []),
      new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 }), new webpack.ProvidePlugin({ process: require.resolve('next/dist/build/polyfills/process') }), new webpack.IgnorePlugin({ resourceRegExp: /^node:/ }), new webpack.DefinePlugin({ 'process.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(supabaseUrl), 'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnon) })],
    cache: { type: 'filesystem', cacheDirectory: path.join(root,'artifacts/test-results/takeoff-browser-webpack-cache') },
    optimization: { minimize: false }, performance: { hints: false },
  });
  compiler.run((error, stats) => {
    const result = stats?.toJson({ all: false, errors: true });
    compiler.close(() => error || stats?.hasErrors() ? reject(error || new Error(JSON.stringify(result.errors).slice(0, 4000))) : resolve());
  });
});

if (process.env.GR8_BUNDLE_ONLY === '1') { console.log('Bundle built; stopping (GR8_BUNDLE_ONLY).'); process.exit(0); }

// ---- Plans under test: the original vector PDFs, scored against independent hand references ----
const planSets = [
  { name: 'Liberty Terrace', pdf: process.env.GR8_LIBERTY_PDF || 'C:/Users/grant/gr8-e-drive-priority-backup-20261031/08-DOWNLOADS-GR8-RESULT-FILES/25 LIBERTY TERRACE MOOLOOLABA.pdf',
    reference: path.join(root, 'artifacts/test-results/vector-regression-2026-10-18/frozen/reference.json'), sheets: [{ page: 1, level: 'Ground Floor' }] },
  { name: 'Jesmond Road', pdf: process.env.GR8_JESMOND_PDF || 'E:/dev/JESMOND ROAD INDOOROOPILLY CONTRUCTION ISSUE 10 01-07-2025.pdf',
    reference: path.join(root, '.claude/worktrees/ai-takeoff-geometry/recovery/plan-references/jesmond-road/reference.json'), sheets: [{ page: 5, level: 'Lower Floor' }, { page: 4, level: 'Upper Floor' }] },
].filter((set) => fs.existsSync(set.pdf) && fs.existsSync(set.reference));
if (!planSets.length) { console.log('SKIPPED vector plan browser acceptance: no plan PDF/reference available.'); process.exit(0); }
const only = process.env.GR8_VECTOR_PLAN ? planSets.filter((set) => set.name.toLowerCase().startsWith(process.env.GR8_VECTOR_PLAN.toLowerCase())) : planSets;
let activeSet = null;

// ---- The provider is stubbed to say only what kind of sheet each page is. It returns NO walls,
// openings or rooms, so every measured quantity on screen comes from the GR8 vector engine. ----
const apiRequests = [];
const evidenceStub = { levels: [], openingSchedule: [], windowCodeConvention: { order: 'unknown', basis: 'ASSUMED', confidence: 0, evidence: '' },
  standardDoorHeight: { valueMm: null, basis: 'ASSUMED', confidence: 0, evidence: '' }, eaveWidth: { valueMm: null, basis: 'ASSUMED', confidence: 0, evidence: '' },
  roofPitch: { degrees: null, basis: 'ASSUMED', confidence: 0, evidence: '' }, notes: [], review: [] };
// ---- Optional LIVE provider validation (paid). Off unless GR8_LIVE_PROVIDER_APPROVED=yes. Every call to
// the provider passes a counting gate that refuses any request beyond GR8_LIVE_PROVIDER_MAX_REQUESTS before
// it reaches the network, and records each response's token usage and estimated cost.
const live = process.env.GR8_LIVE_PROVIDER_APPROVED === 'yes' ? (() => {
  const maxRequests = Number(process.env.GR8_LIVE_PROVIDER_MAX_REQUESTS);
  assert.ok(Number.isInteger(maxRequests) && maxRequests > 0 && maxRequests <= 12, 'GR8_LIVE_PROVIDER_MAX_REQUESTS (1-12) is required for a live run');
  assert.ok(String(process.env.OPENAI_API_KEY || '').trim(), 'OPENAI_API_KEY is required for a live run');
  const priceIn = Number(process.env.GR8_LIVE_PRICE_IN_PER_M || 2.5), priceOut = Number(process.env.GR8_LIVE_PRICE_OUT_PER_M || 15);
  const ledger = { maxRequests, calls: [], refused: 0, inputTokens: 0, outputTokens: 0, estimatedUsd: 0, priceIn, priceOut };
  const countingFetch = async (target, init) => {
    if (!String(target).startsWith('https://api.openai.com/')) throw new Error('Live validation only calls the OpenAI API.');
    if (ledger.calls.length >= maxRequests) { ledger.refused += 1; throw Object.assign(new Error('Live validation request cap reached; nothing was sent.'), { status: 429 }); }
    const call = { at: new Date().toISOString() }; ledger.calls.push(call);
    const response = await fetch(target, init);
    const body = await response.clone().json().catch(() => null);
    call.status = response.status; call.model = body?.model; call.inputTokens = body?.usage?.input_tokens || 0; call.outputTokens = body?.usage?.output_tokens || 0;
    ledger.inputTokens += call.inputTokens; ledger.outputTokens += call.outputTokens;
    ledger.estimatedUsd = Math.round((ledger.inputTokens * priceIn + ledger.outputTokens * priceOut) / 1e4) / 100;
    return response;
  };
  return { ledger, handler: createTakeoffAnalysisHandler({ fetchImpl: countingFetch }) };
})() : null;
function replay(body) {
  const pageNumber = Number(body.page?.pageNumber);
  const sheet = activeSet.sheets.find((item) => item.page === pageNumber);
  const meta = { ok: true, provider: 'OpenAI', model: 'stub-sheet-type-only', requestId: `stub-${body.action}-${pageNumber}` };
  if (body.action === 'inspect') return { ...meta, analysis: { page: pageNumber, textDirection: 'left-to-right', rotationToUpright: 0,
    drawingType: sheet ? 'floor_plan' : 'other', level: sheet ? sheet.level : 'Unassigned', relevant: Boolean(sheet),
    scale: { denominator: 100, basis: 'OBSERVED', confidence: 0.95, evidence: 'Stub: printed scale 1:100.' }, writtenDimensions: [], review: [] } };
  if (body.action === 'evidence') return { ...meta, analysis: { ...evidenceStub, page: pageNumber } };
  return { ...meta, analysis: { page: pageNumber, level: sheet?.level || 'Unassigned', walls: [], openings: [], buildingAreas: [], pillars: [], eaves: [],
    rooms: [], fixtures: [], documentedQuantities: [], review: [] } };
}
const server = http.createServer(async (req, res) => {
  if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'application/javascript'); fs.createReadStream(path.join(out, 'browser-bundle.js')).pipe(res); return; }
  // The local OCR files the printed-label reader loads (worker, WebAssembly core, language data).
  const ocrFile = /^\/takeoff-ocr\/((?:core|tessdata)\/)?[A-Za-z0-9._-]+$/.test(req.url) ? path.join(root, 'public', req.url) : null;
  if (ocrFile && fs.existsSync(ocrFile)) { res.setHeader('Content-Type', ocrFile.endsWith('.js') ? 'application/javascript' : 'application/octet-stream'); if (req.method === 'HEAD') { res.end(); return; } fs.createReadStream(ocrFile).pipe(res); return; }
  if (ocrFile) { res.statusCode = 404; res.end(); return; }
  if (req.url === '/pdfjs/pdf.worker.min.mjs') { res.setHeader('Content-Type', 'application/javascript'); fs.createReadStream(path.join(root, 'public/pdfjs/pdf.worker.min.mjs')).pipe(res); return; }
  if (req.url === '/api/ai/takeoff-analyse') {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    apiRequests.push({ action: body.action, scope: body.measurementScope || null, page: body.page?.pageNumber });
    if (live) {
      // The real server handler, as a signed-in test user, with the counting gate as its network.
      let statusCode = 200; const headers = {};
      const fakeRes = { setHeader: (k, v) => { headers[k] = v; }, status(code) { statusCode = code; return this; }, json(payload) { res.statusCode = statusCode; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(payload)); } };
      await live.handler({ method: 'POST', body, user: { id: 'live-validation' } }, fakeRes);
      fs.writeFileSync(path.join(out, 'live-provider-ledger.json'), JSON.stringify(live.ledger, null, 2));
      return;
    }
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(replay(body))); return;
  }
  res.setHeader('Content-Type', 'text/html');
  res.end('<!doctype html><meta charset="utf-8"><title>AI Takeoff vector plan acceptance</title><style>html,body,#root{height:100%;margin:0;font-family:Arial}</style><div id="root"></div><script src="/bundle.js"></script>');
});

// Score the walls, openings and rooms on screen against the reference (both in PDF points, mm via each scale).
function scoreSheet(state, reference, sheet) {
  const refPage = reference.pages.find((item) => Number(item.page) === sheet.page) || reference.pages[0];
  const onPage = (item) => item.page === undefined || Number(item.page) === sheet.page;
  const rmm = (p) => ({ x: p.x / refPage.pixelsPerMm, y: p.y / refPage.pixelsPerMm });
  const ppm = state.sheetCalibrations?.[sheet.page]?.pixelsPerMm || state.pixelsPerMm;
  const amm = (p) => ({ x: p.x / ppm, y: p.y / ppm });
  const walls = state.completedWallRuns.filter((wall) => Number(wall.page) === sheet.page);
  const openings = state.placedOpenings.filter((item) => Number(item.page) === sheet.page);
  const rooms = (state.aiAnalysis?.rooms || []).filter((room) => Number(room.page) === sheet.page && room.polygon?.length >= 3 && !room.excluded);
  const wallScore = compareWalls(reference.walls.filter(onPage).map((wall) => ({ ...wall, a: rmm(wall.a), b: rmm(wall.b) })),
    walls.map((wall) => ({ id: wall.id, points: wall.nodes.map(amm), thicknessMm: wall.thicknessMm, category: wall.category })));
  const counted = openings.filter((item) => item.needsClassification !== true);
  const openingScore = compareOpenings(reference.openings.filter(onPage).map((item) => ({ ...item, ...rmm(item) })), openings.map((item) => ({ ...item, ...amm(item), kind: item.type })));
  const roomScore = compareRooms(reference.rooms.filter(onPage).map((room) => ({ ...room, polygon: room.polygon.map(rmm) })), rooms.map((room) => ({ ...room, polygon: room.polygon.map(amm) })));
  return { level: sheet.level, walls: walls.length, wallRecall: +wallScore.recall.toFixed(3), wallPrecision: +wallScore.precision.toFixed(3), extInt: +(wallScore.categoryAgreement ?? 0).toFixed(3),
    openingsOnScreen: openings.length, openingsCounted: counted.length, openingsAwaitingBuilder: openings.length - counted.length,
    openingsMatched: openingScore.matched, openingsReference: openingScore.reference,
    roomsWithBoundary: rooms.length, roomsMatched: roomScore.matched, roomsReference: roomScore.reference, roomsApproved: rooms.filter((room) => room.confirmed === true).length,
    rooms: roomScore.rows.map((row) => ({ name: row.name, iou: Math.round(row.iou * 100) / 100, areaError: row.areaError === null ? null : Math.round(row.areaError * 1000) / 10 })) };
}

const report = { errors: [], dialogs: [], plans: {} };
let browser, page, calibrationAnswer = '';
try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, protocolTimeout: Number(process.env.GR8_PROTOCOL_TIMEOUT_MS) || 3600000,
    userDataDir: path.join(out, 'profile-' + Date.now()), args: ['--no-first-run', '--disable-extensions', '--window-size=1600,1100', ...(process.env.GR8_CHROME_EXTRA_ARGS ? process.env.GR8_CHROME_EXTRA_ARGS.split(' ').filter(Boolean) : [])], defaultViewport: { width: 1600, height: 1100 } });
  page = await browser.newPage();
  page.setDefaultTimeout(180000);
  page.on('pageerror', (error) => { report.errors.push(error.message); console.error('Browser error:', error.message); });
  page.on('dialog', async (dialog) => { report.dialogs.push(dialog.message()); await dialog.accept(); });
  await page.setRequestInterception(true);
  page.on('request', (request) => request.url().startsWith(origin) || /^(data|blob):/.test(request.url()) ? request.continue() : request.abort());
  const expiresAt = Math.floor(Date.now() / 1000) + 86400;
  await page.evaluateOnNewDocument(({ storageKey, session }) => { localStorage.setItem(storageKey, JSON.stringify(session)); }, {
    storageKey: `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`,
    session: { access_token: 'stub-access-token', refresh_token: 'stub-refresh', token_type: 'bearer', expires_in: 86400, expires_at: expiresAt, user: { id: 'stub-user', aud: 'authenticated', role: 'authenticated', email: 'stub@example.test' } },
  });
  await page.goto(origin, { waitUntil: 'load', timeout: 300000 });
  await page.waitForFunction(() => window.harness?.ready());

  for (const set of only) {
    activeSet = set;
    const reference = JSON.parse(fs.readFileSync(set.reference, 'utf8'));
    const result = report.plans[set.name] = { sheets: {} };
    // 1. Fresh isolated job; the multipage PDF goes in through the screen's own file input.
    await page.evaluate(() => harness.newJob());
    await page.waitForFunction(() => Boolean(harness.snapshot().openedTakeoffJob?.takeoffId));
    await page.waitForSelector('input[type="file"][accept="image/*,.pdf"]:not([disabled])');
    let uploadPdf = set.pdf;
    if (live) {
      // A live run uploads only the first measured sheet, so it makes exactly one sheet's requests.
      const source = await PDFDocument.load(fs.readFileSync(set.pdf), { ignoreEncryption: true });
      const single = await PDFDocument.create();
      const [copied] = await single.copyPages(source, [set.sheets[0].page - 1]);
      single.addPage(copied);
      uploadPdf = path.join(out, `${set.name.replace(/W+/g, '-')}-live-sheet.pdf`);
      fs.writeFileSync(uploadPdf, await single.save());
      set.sheets = [{ ...set.sheets[0], page: 1, sourcePage: set.sheets[0].page }];
    }
    const pageCount = (await PDFDocument.load(fs.readFileSync(uploadPdf), { ignoreEncryption: true })).getPageCount();
    const startedUpload = Date.now();
    await (await page.$('input[type="file"][accept="image/*,.pdf"]')).uploadFile(uploadPdf);
    await page.waitForFunction((count) => harness.snapshot().imageReady && harness.snapshot().totalPages === count, { timeout: 600000 }, pageCount);
    result.upload = { pages: pageCount, seconds: Math.round((Date.now() - startedUpload) / 1000) };
    if (process.env.GR8_PROFILE_UPLOAD) {
      const cdp = await page.target().createCDPSession(); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 5000 }); await cdp.send('Profiler.start');
      const busy = []; for (let i = 0; i < 24; i += 1) { const t = Date.now(); await page.evaluate(() => 1); busy.push(Date.now() - t); await new Promise((r) => setTimeout(r, 5000)); }
      const { profile } = await cdp.send('Profiler.stop'); fs.writeFileSync(path.join(out, 'after-upload.cpuprofile'), JSON.stringify(profile));
      result.mainThreadResponseMs = busy; console.log('main-thread response ms after upload', busy.join(','));
    }
    await settle();
    assert.equal((await snapshot()).pixelsPerMm, null, 'an uploaded plan is never calibrated silently');

    // 2. Select the floor-plan sheet and calibrate with the Calibrate tool on a known length (1:100).
    const first = set.sheets[0];
    const refPage = reference.pages.find((item) => Number(item.page) === first.page) || reference.pages[0];
    await goToPage(first.page);
    await centre({ x: 400, y: 400 });
    calibrationAnswer = String(Math.round(400 / refPage.pixelsPerMm * 10) / 10);
    await button('Calibrate');
    await clickPlan({ x: 200, y: 400 });
    await clickPlan({ x: 600, y: 400 });
    await answerCalibration();
    await page.waitForFunction(() => harness.snapshot().pixelsPerMm > 0);
    const calibrated = (await snapshot()).pixelsPerMm;
    result.calibration = { pixelsPerMm: calibrated, expected: refPage.pixelsPerMm };
    assert.ok(Math.abs(calibrated - refPage.pixelsPerMm) / refPage.pixelsPerMm < 0.005, `calibration ${calibrated}`);

    // 3. RUN AI TAKEOFF. The vector engine measures; the stub provider supplies sheet type only.
    const run = async () => {
      await page.click('#run-ai-takeoff');
      await page.waitForFunction(() => /AI TAKEOFF COMPLETE|REQUIRES REVIEW|already been analysed|already in|could not|failed|error|confirm the scale/i.test(document.querySelector('#ai-takeoff-status')?.textContent || ''), { timeout: 600000 });
      // A scale proposal from the inspection is confirmed explicitly when the screen asks for it.
      for (let i = 0; i < 3; i += 1) {
        const confirmScale = await page.$('[data-testid="confirm-ai-scale"]');
        if (!confirmScale) break;
        await confirmScale.click(); await settle();
        await page.waitForFunction(() => /AI TAKEOFF COMPLETE|REQUIRES REVIEW|could not|failed|error/i.test(document.querySelector('#ai-takeoff-status')?.textContent || ''), { timeout: 600000 });
      }
      await settle();
      return page.$eval('#ai-takeoff-status', (element) => element.textContent);
    };
    const startedRun = Date.now();
    result.firstRun = { message: await run() };
    result.firstRun.seconds = Math.round((Date.now() - startedRun) / 1000);
    assert.match(result.firstRun.message, /REQUIRES REVIEW/, 'a vector plan with unapproved rooms is reported as requiring review, never complete');
    const startedSave = Date.now();
    const profiler = process.env.GR8_PROFILE_SAVE ? await page.target().createCDPSession() : null;
    if (profiler) { await profiler.send('Profiler.enable'); await profiler.send('Profiler.setSamplingInterval', { interval: 2000 }); await profiler.send('Profiler.start'); }
    await save();
    if (profiler) { const { profile } = await profiler.send('Profiler.stop'); fs.writeFileSync(path.join(out, 'first-save.cpuprofile'), JSON.stringify(profile)); }
    result.firstSaveSeconds = Math.round((Date.now() - startedSave) / 1000);
    let state = await snapshot();
    for (const sheet of set.sheets) {
      result.sheets[sheet.page] = scoreSheet(state, reference, sheet);
      // Printed size labels read locally in the browser (public/takeoff-ocr), when those files are installed.
      const labels = state.aiAnalysis?.linework?.[sheet.page]?.printedLabels || null;
      const labelWarning = (state.aiAnalysis?.review || []).find((item) => item.code === 'printed-labels' && Number(item.page) === sheet.page);
      result.sheets[sheet.page].printedLabels = labels ? { read: labels.stats?.labels, applied: labels.applied?.length, settled: labels.resolved?.map((x) => `${x.id}:${x.kind} "${x.text}"`), split: labels.split?.length, conflicts: labels.conflicts?.length } : { warning: labelWarning?.message || 'no label report' };
      if (fs.existsSync(path.join(root, 'public/takeoff-ocr/tessdata/eng.traineddata'))) {
        assert.ok(labels && labels.stats?.labels > 0, `${set.name} ${sheet.level}: printed labels read locally (${JSON.stringify(result.sheets[sheet.page].printedLabels)})`);
      }
      const walls = state.completedWallRuns.filter((wall) => Number(wall.page) === sheet.page);
      assert.ok(walls.length > 10, `${set.name} ${sheet.level}: walls measured (${walls.length})`);
      assert.ok(walls.every((wall) => ['exterior', 'interior'].includes(wall.category) && Number(wall.lengthMm) > 0), 'every admitted wall is classified and measured');
      assert.equal(new Set(walls.map((wall) => wall.id)).size, walls.length, 'no wall twice');
      assert.equal(result.sheets[sheet.page].roomsApproved, 0, 'no room is approved automatically');
      await goToPage(sheet.page);
      await page.screenshot({ path: path.join(out, `${set.name.replace(/\W+/g, '-')}-sheet-${sheet.page}-after-run.png`) });
      // Floor areas: the footprint on a measured sheet comes from the measured rooms and walls, and is
      // checked against the area printed on the drawing (the plan reading's rectangle used to run past walls).
      const printed = reference.printedAreas || {};
      const printedLiving = /upper/i.test(sheet.level) ? printed.upperLivingM2 : /lower/i.test(sheet.level) ? printed.lowerLivingM2 : null;
      const sheetPpm = state.sheetCalibrations?.[sheet.page]?.pixelsPerMm || state.pixelsPerMm;
      const floorAreas = (state.completedFloorplans || []).filter((item) => Number(item.page) === sheet.page).map((item) => ({
        type: item.type, source: item.source || 'manual', measuredFrom: item.measuredFrom || null,
        areaM2: Math.round(Math.abs(item.nodes.reduce((sum, p, i) => { const q = item.nodes[(i + 1) % item.nodes.length]; return sum + p.x * q.y - q.x * p.y; }, 0)) / 2 / (sheetPpm * sheetPpm) / 1e4) / 100 }));
      result.sheets[sheet.page].floorAreas = { printedLivingM2: printedLiving, areas: floorAreas };
      const footprint = floorAreas.find((item) => item.type === 'Footprint');
      assert.ok(footprint, `${set.name} ${sheet.level}: a footprint is measured (${JSON.stringify(floorAreas)})`);
      if (printedLiving) assert.ok(Math.abs(footprint.areaM2 - printedLiving) / printedLiving <= 0.04, `${set.name} ${sheet.level}: footprint ${footprint.areaM2} m² within 4% of the printed ${printedLiving} m²`);
      await page.evaluate(() => { const boxes = [...document.querySelectorAll('[data-testid="plan-overlay-key"] input[type="checkbox"]')]; if (boxes[1]?.checked) boxes[1].click(); });
      await settle();
      await page.screenshot({ path: path.join(out, `${set.name.replace(/\W+/g, '-')}-sheet-${sheet.page}-floor-areas.png`) });
      await page.evaluate(() => { const boxes = [...document.querySelectorAll('[data-testid="plan-overlay-key"] input[type="checkbox"]')]; if (boxes[1] && !boxes[1].checked) boxes[1].click(); });
      await settle();
      step(`canvas markers and overlay key: sheet ${sheet.page}`);
      result.sheets[sheet.page].canvas = await checkCanvas(`${set.name.replace(/\W+/g, '-')}-sheet-${sheet.page}`);
    }

    // 4. Review: select the best-matching measured room, approve it explicitly, then save/reopen/rerun.
    const sheetRooms = (await snapshot()).aiAnalysis.rooms.filter((room) => Number(room.page) === first.page && room.polygon?.length >= 3 && !room.excluded);
    const scored = result.sheets[first.page].rooms.filter((row) => row.iou >= 0.9).map((row) => row.name);
    assert.ok(sheetRooms.length > 0, 'measured rooms are offered for review');
    await goToPage(first.page);
    const amm = (p) => ({ x: p.x / calibrated, y: p.y / calibrated });
    const refRooms = reference.rooms.filter((room) => room.page === undefined || Number(room.page) === first.page);
    const candidate = sheetRooms.map((room) => {
      const one = compareRooms(refRooms.map((r) => ({ ...r, polygon: r.polygon.map((p) => ({ x: p.x / refPage.pixelsPerMm, y: p.y / refPage.pixelsPerMm })) })), [{ ...room, polygon: room.polygon.map(amm) }]);
      const best = one.rows.sort((a, b) => b.iou - a.iou)[0];
      return { room, iou: best?.iou || 0, refName: best?.name, refArea: refRooms.find((r) => r.name === best?.name)?.areaM2 };
    }).filter((item) => item.room.areaM2 > 3).sort((a, b) => b.iou - a.iou)[0];
    assert.ok(candidate && candidate.iou >= 0.9, `a measured room matches its reference room (${scored.join(', ')})`);
    const target = candidate.room;
    result.review = { room: target.name, reference: candidate.refName, iou: Math.round(candidate.iou * 100) / 100, measuredM2: target.areaM2, referenceM2: candidate.refArea };
    await page.evaluate(() => { const box = document.querySelector('[data-testid="room-boundary-panel"] input[type="checkbox"]'); if (box && !box.checked) box.click(); });
    await settle();
    await page.evaluate((id) => { const box = document.querySelector('[data-room-id="' + id + '"] input[type="checkbox"]'); if (box && !box.checked) box.click(); }, target.id);
    await settle();
    // Rename to the reference name when the plan had no text label (Liberty has no text layer).
    if (/^Unlabelled room/.test(target.name)) {
      const selector = `input[aria-label=${JSON.stringify(`Name for ${target.name}`)}]`;
      await page.waitForSelector(selector);
      await page.click(selector, { clickCount: 3 });
      await page.type(selector, candidate.refName);
      await page.keyboard.press('Tab');
      await settle();
      const renamedRoom = (await snapshot()).aiAnalysis.rooms.find((room) => room.id === target.id);
      result.review.renamed = renamedRoom?.name;
      assert.equal(renamedRoom?.name, candidate.refName, 'the builder renames the room');
      target.name = renamedRoom.name;
    }
    const approve = await page.evaluate((id) => { const row = document.querySelector(`[data-room-id="${id}"]`); const element = row && [...row.querySelectorAll('button')].find((item) => item.textContent.trim() === 'Approve room'); if (!element || element.disabled) return element ? 'disabled' : 'missing'; element.click(); return 'clicked'; }, target.id);
    result.review.approve = approve;
    await settle();
    const roomsNow = async () => (await snapshot()).aiAnalysis.rooms;
    assert.equal(approve, 'clicked', 'the matched room can be approved by the builder');
    const approved = (await roomsNow()).find((room) => room.id === target.id);
    assert.equal(approved.confirmed, true, 'explicit approval recorded');
    await page.screenshot({ path: path.join(out, `${set.name.replace(/\W+/g, '-')}-room-approved.png`) });
    await save();
    const submitted = await page.evaluate((id) => harness.saveInputs().at(-1)?.scheduleState?.aiAnalysis?.rooms?.find((room) => room.id === id) || null, target.id);
    result.review.savedApproval = submitted ? { confirmed: submitted.confirmed, areaM2: submitted.areaM2, name: submitted.name } : null;
    assert.equal(submitted?.name, target.name, 'the saved room carries the name the builder gave it');
    assert.equal(submitted?.confirmed, true, 'the last save submitted carries the approval');
    // 4b. Required wall check: every sheet with detected walls must be checked by the builder. On Jesmond
    // Upper the kitchen joinery read as a 3.7 m wall is deleted through the wall list, then each sheet's
    // check is confirmed. The detector does not flag that wall; the builder's check is what removes it.
    const wallCheckIds = async () => page.evaluate(() => [...document.querySelectorAll('[data-review-decision^="wall-check:"]')].map((el) => el.getAttribute('data-review-decision')).sort());
    const requiredChecks = await wallCheckIds();
    assert.deepEqual(requiredChecks, set.sheets.map((sheet) => `wall-check:${sheet.page}`).sort(), `every sheet with detected walls requires a wall check (${requiredChecks})`);
    assert.ok(await page.evaluate(() => document.body.textContent.includes('AI TAKEOFF REQUIRES REVIEW')), 'not presented as complete while wall checks are open');
    result.wallCheck = { required: requiredChecks };
    if (set.name === 'Jesmond Road') {
      await goToPage(4); await settle();
      const before = await snapshot();
      const pageWalls = before.completedWallRuns.filter((wall) => Number(wall.page) === 4);
      const kitchen = pageWalls.map((wall, index) => ({ wall, index })).filter(({ wall }) => wall.source === 'ai' && wall.category === 'interior' && Math.abs(Number(wall.lengthMm) - 3684) <= 40);
      result.wallCheck.kitchenCandidates = kitchen.map(({ wall }) => ({ id: wall.id, lengthMm: Math.round(wall.lengthMm), thicknessMm: wall.thicknessMm, category: wall.category }));
      assert.equal(kitchen.length, 1, `one detected 3.7 m wall on Jesmond Upper is the kitchen joinery (${JSON.stringify(result.wallCheck.kitchenCandidates)})`);
      const rows = await page.evaluate((index) => {
        const list = [...document.querySelectorAll('div')].filter((div) => div.children.length === 2 && /^(interior|exterior) \(\d+mm\):/.test(div.children[0]?.textContent || '') && div.children[1]?.tagName?.toLowerCase() === 'svg');
        list[index]?.children[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return list.length;
      }, kitchen[0].index);
      await settle();
      const after = await snapshot();
      assert.equal(rows, pageWalls.length, 'the wall list shows every wall on the sheet');
      assert.ok(!after.completedWallRuns.some((wall) => wall.id === kitchen[0].wall.id), 'the joinery wall is removed by the builder');
      assert.equal(after.completedWallRuns.length, before.completedWallRuns.length - 1, 'exactly one wall removed');
      result.wallCheck.deleted = { id: kitchen[0].wall.id, lengthMm: Math.round(kitchen[0].wall.lengthMm) };
    }
    step('wall checks: confirm each sheet');
    for (const id of await wallCheckIds()) {
      step(`confirm ${id}`);
      const clicked = await page.evaluate((decisionId) => { const box = document.querySelector(`[data-review-decision="${decisionId}"]`); const element = box && [...box.querySelectorAll('button')].find((item) => item.textContent.trim() === 'I have checked this'); if (!element || element.disabled) return false; element.click(); return true; }, id);
      assert.ok(clicked, `the builder can confirm ${id}`);
      await settle();
    }
    assert.deepEqual(await wallCheckIds(), [], 'all wall checks confirmed');
    step('save after wall checks');
    await save();
    step('read saved wall checks');
    const savedChecks = await page.evaluate(() => Object.keys(harness.saveInputs().at(-1)?.scheduleState?.aiAnalysis?.resolvedDecisions || {}).filter((key) => key.startsWith('wall-check:')).sort());
    assert.deepEqual(savedChecks, requiredChecks, 'the saved takeoff carries the wall checks');
    result.wallCheck.saved = savedChecks;
    const beforeReopen = await snapshot();
    const counts = (value) => ({ walls: value.completedWallRuns.length, openings: value.placedOpenings.length, approved: (value.aiAnalysis?.rooms || []).filter((room) => room.confirmed).map((room) => [room.id, Math.round(room.areaM2 * 1000) / 1000]) });
    step('reopen');
    await page.evaluate(() => harness.reopen());
    await page.waitForFunction(() => harness.snapshot().imageReady && harness.snapshot().completedWallRuns.length > 0, { timeout: 300000 });
    await settle();
    const afterReopen = await snapshot();
    assert.deepEqual(counts(afterReopen), counts(beforeReopen), 'save and reopen keeps walls, openings and the approved room');
    assert.deepEqual(await wallCheckIds(), [], 'confirmed wall checks stay confirmed after reopen');
    // Export the saved job as a .gr8job file and import it back through the app's own job-file path.
    // GR8_SKIP_GR8JOB_EXPORT=1 leaves out the .gr8job export/import (it holds the whole job in the page at
    // once - about 300 MB for Jesmond) so the later steps can be checked on a busy machine; run it separately.
    if (process.env.GR8_SKIP_GR8JOB_EXPORT === '1') {
      step('export and import .gr8job: skipped (GR8_SKIP_GR8JOB_EXPORT)');
      result.gr8job = { skipped: true };
      assert.ok(Math.abs(afterReopen.pixelsPerMm - calibrated) / calibrated < 1e-6, 'calibration survives reopen');
    } else {
    step('export and import .gr8job');
    const exportStarted = Date.now();
      if (process.env.TAKEOFF_SAVE_GR8JOB) await page.evaluate(() => { window.__keepExport = true; });
      const exported = await page.evaluate(() => harness.exportImport());
      if (exported.base64) { fs.writeFileSync(process.env.TAKEOFF_SAVE_GR8JOB, Buffer.from(exported.base64, 'base64')); delete exported.base64; }
      await page.waitForFunction(() => harness.snapshot().imageReady && harness.snapshot().completedWallRuns.length > 0, { timeout: 300000 });
      await settle();
      const afterImport = await snapshot();
      result.gr8job = { bytes: exported.bytes, seconds: Math.round((Date.now() - exportStarted) / 1000), message: exported.exportMessage, counts: counts(afterImport) };
      assert.deepEqual(counts(afterImport), counts(beforeReopen), '.gr8job export and import keep walls, openings and the approved room');
      assert.ok(Math.abs(afterReopen.pixelsPerMm - calibrated) / calibrated < 1e-6, 'calibration survives reopen');
    }
    result.reopen = counts(afterReopen);
    // Rerun after review: nothing is duplicated and the approval is not replaced by the new reading.
    step('rerun after review');
    result.rerun = { message: await run() };
    const afterRerun = await snapshot();
    assert.deepEqual(counts(afterRerun).approved, counts(beforeReopen).approved, 'a rerun never replaces or drops an approved room');
    assert.ok(afterRerun.completedWallRuns.length <= beforeReopen.completedWallRuns.length, `a rerun does not duplicate walls (${afterRerun.completedWallRuns.length} vs ${beforeReopen.completedWallRuns.length})`);
    result.rerun.counts = counts(afterRerun);
    assert.deepEqual(await wallCheckIds(), [], 'a rerun keeps the confirmed wall checks');
    // The harness shows the quotation in place of the takeoff, so this runs for the last plan set of a run
    // (run each plan with GR8_VECTOR_PLAN to check each one downstream).
    if (set === only.at(-1)) {
    // 5. Downstream: the approved room is a Floor Tiling area; it reaches the quote sheet once (even after a
    // repeated apply), then Job Setup and the calculated quotation carry the same measured quantity.
    const approvedArea = (await roomsNow()).find((room) => room.id === target.id).areaM2;
    console.log(new Date().toISOString(), 'downstream: select room');
    await goToPage(first.page);
    await page.evaluate(() => { const box = document.querySelector('[data-testid="room-boundary-panel"] input[type="checkbox"]'); if (box && !box.checked) box.click(); });
    await settle();
    await page.evaluate((id) => { for (const row of document.querySelectorAll('[data-room-id]')) { const checkbox = row.querySelector('input[type="checkbox"]'); const want = row.getAttribute('data-room-id') === id; if (checkbox && checkbox.checked !== want) checkbox.click(); } }, target.id);
    await settle();
    await page.evaluate(() => { const panel = document.querySelector('[data-testid="room-boundary-panel"]'); const element = [...panel.querySelectorAll('button')].find((item) => item.textContent === 'Floor Tiling'); if (!element) throw Error('Floor Tiling finish button missing'); element.click(); });
    await settle();
    const finished = (await roomsNow()).find((room) => room.id === target.id);
    assert.equal(finished.confirmed, true, 'assigning the floor finish keeps the approval');
    console.log(new Date().toISOString(), 'downstream: save after Floor Tiling');
    await save();
    console.log(new Date().toISOString(), 'downstream: Takeoff Schedule');
    await button('Takeoff Schedule', true);
    await button('Send to Quote Sheet');
    await page.waitForFunction(() => [...document.querySelectorAll('tr')].some((row) => row.textContent.includes('Floor Tiling') && row.querySelector('select')));
    await page.evaluate((name) => { const row = [...document.querySelectorAll('tr')].find((item) => item.textContent.includes(name) && item.textContent.includes('Floor Tiling') && item.querySelector('select')); if (!row) throw Error('Approved room missing from quote preview'); row.querySelector('select').setAttribute('data-testid', 'approved-room-quote-mapping'); }, target.name);
    await page.select('[data-testid="approved-room-quote-mapping"]', 'takeoff-browser-room-check');
    await settle();
    await button('Apply Mapped Quantities'); await settle();
    await button('Apply Mapped Quantities'); await settle();
    const mappedRoom = await page.evaluate(() => { const row = harness.liveWorkbook().quotation['Takeoff browser check'].rows.find((item) => item.id === 'takeoff-browser-room-check'); return row && { quantity: row.quantity }; });
    assert.ok(Math.abs(Number(mappedRoom.quantity) - approvedArea) < 0.02, `approved room maps to the quote once (${mappedRoom.quantity} vs ${approvedArea})`);
    console.log(new Date().toISOString(), 'downstream: Job Setup');
    await button('Export Takeoff to Job Setup');
    await page.waitForSelector('[data-testid="job-setup-takeoff-import"]');
    assert.equal(await page.$('[data-testid="takeoff-calibration-blocked"]'), null, 'confirmed calibration reaches Job Setup');
    assert.equal(await page.$('[data-testid="takeoff-wall-check-blocked"]'), null, 'checked walls are not blocked in Job Setup');
    await button('Import selected quantities');
    await page.waitForFunction(() => Boolean(harness.liveWorkbook().takeoffEngine?.lastJobSetupSync));
    // Read only the fields checked: returning the whole workbook copies every sheet's vectors over CDP.
    const workbook = await page.evaluate(() => { const book = harness.liveWorkbook(); return { tiles: book.data?.inputDataSheet?.rows?.floorFinishTilesM2?.value, synced: Boolean(book.takeoffEngine?.lastJobSetupSync) }; });
    const tiles = Number(workbook.tiles);
    assert.ok(Math.abs(tiles - approvedArea) < 0.02, `approved room area reaches Job Setup once (${tiles} vs ${approvedArea})`);
    console.log(new Date().toISOString(), 'downstream: quotation');
    await page.evaluate(() => harness.showPricedQuotation());
    await page.waitForSelector('[data-quote-row="takeoff-browser-room-check"]');
    const quote = await page.evaluate(() => { const calculated = harness.quotation(); return { quotation: Object.fromEntries(Object.entries(calculated.quotation || {}).map(([key, section]) => [key, { rows: (section.rows || []).map(({ id, qty, cost }) => ({ id, qty, cost })) }])) }; });
    const roomPriced = Object.values(quote.quotation).flatMap((section) => section.rows || []).find((row) => row.id === 'takeoff-browser-room-check');
    assert.ok(Math.abs(roomPriced.qty - approvedArea) < 0.02, 'approved room area reaches the calculated quotation');
    assert.equal(roomPriced.cost, Math.round(roomPriced.qty * 10000) / 100, 'disposable $100/m2 rate times the measured area');
    const doors = Object.values(quote.quotation).flatMap((section) => section.rows || []).find((row) => row.id === 'takeoff-browser-priced-check');
    result.downstream = { approvedAreaM2: approvedArea, quoteSheetQuantity: Number(mappedRoom.quantity), jobSetupTilesM2: tiles, quotationQty: roomPriced.qty, quotationCost: roomPriced.cost,
      internalDoorsQty: doors?.qty, internalDoorsCost: doors?.cost, receipt: workbook.synced };
    await page.screenshot({ path: path.join(out, `${set.name.replace(/\W+/g, '-')}-quotation.png`) });
    }
    console.log(`${set.name}: ${JSON.stringify(Object.values(result.sheets).map(({ rooms, ...rest }) => rest))}`);
  }
  assert.deepEqual(report.errors, [], 'No browser runtime errors');
  report.ok = true;
  console.log('Vector plan browser acceptance passed.');
} catch (error) {
  report.error = error.stack || String(error);
  if (page) { report.status = await page.$eval('#ai-takeoff-status', (element) => element.textContent).catch(() => null); await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {}); }
  throw error;
} finally {
  report.apiRequests = apiRequests;
  report.providerNote = 'Stub provider: sheet type and level only; no walls, openings or rooms. No paid calls.';
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  await browser?.close();
  await new Promise((resolve) => server.listening ? server.close(resolve) : resolve());
}

// Canvas check at the current zoom: window dots / door triangles with size labels drawn at 16 px on
// screen, and each Plan overlays toggle hides only its own layer without moving or rescaling the plan.
function step(label) { console.log(new Date().toISOString(), `step: ${label}`); }
async function checkCanvas(name) {
  const read = () => page.evaluate(() => {
    const stage = window.Konva?.stages?.find((item) => item.find('.opening-marker').length) || window.Konva?.stages?.[0];
    if (!stage) return null;
    const visibleShapes = stage.find('Shape').filter((shape) => shape.isVisible()).length;
    const layer = stage.getLayers()[0];
    const t = layer.getAbsoluteTransform().getMatrix().map((v) => Math.round(v * 1000) / 1000);
    const markers = stage.find('.opening-marker').map((marker) => {
      const text = marker.getParent().findOne('Text');
      const box = marker.getClientRect();
      return { shape: marker.getClassName(), label: text?.text() || '', screenFontPx: text ? Math.round(text.fontSize() * text.getAbsoluteScale().x * 10) / 10 : null, x: box.x + box.width / 2, y: box.y + box.height / 2 };
    });
    const canvas = stage.container().getBoundingClientRect();
    return { visibleShapes, transform: t, markers, canvas: { x: canvas.x, y: canvas.y, width: canvas.width, height: canvas.height } };
  });
  const before = await read();
  assert.ok(before, 'plan canvas is mounted');
  const windows = before.markers.filter((m) => m.shape === 'Circle');
  const doors = before.markers.filter((m) => m.shape === 'RegularPolygon');
  assert.ok(windows.length > 0 && doors.length > 0, `${name}: window dots (${windows.length}) and door triangles (${doors.length}) are drawn`);
  for (const m of before.markers) {
    assert.match(m.label, /\d+H x \d+W|\d+W · height to confirm|\d+H · width to confirm|size to confirm/, `${name}: marker label shows the size (${m.label})`);
    assert.doesNotMatch(m.label, /:|linework|geometry|detection/i, `${name}: no internal ID in the label (${m.label})`);
    assert.equal(m.screenFontPx, 16, `${name}: marker label is 16 px on screen (${m.screenFontPx})`);
  }
  // Close-up of the densest marker group for visual review.
  const focus = before.markers[Math.floor(before.markers.length / 2)];
  const clip = { x: Math.max(before.canvas.x, before.canvas.x + focus.x - 260), y: Math.max(before.canvas.y, before.canvas.y + focus.y - 160), width: 520, height: 320 };
  await page.screenshot({ path: path.join(out, `${name}-markers-closeup.png`), clip });
  const keys = await page.$$eval('[data-testid="plan-overlay-key"] input[type="checkbox"]', (boxes) => boxes.length);
  assert.equal(keys, 3, 'Plan overlays key offers floor areas, rooms and eaves');
  const toggles = {};
  for (const [index, key] of ['floorAreas', 'rooms', 'eaves'].entries()) {
    await page.$$eval('[data-testid="plan-overlay-key"] input[type="checkbox"]', (boxes, i) => boxes[i].click(), index); await settle();
    const off = await read();
    assert.deepEqual(off.transform, before.transform, `${name}: hiding ${key} does not move or rescale the plan`);
    assert.equal(off.markers.length, before.markers.length, `${name}: hiding ${key} keeps the opening markers`);
    await page.$$eval('[data-testid="plan-overlay-key"] input[type="checkbox"]', (boxes, i) => boxes[i].click(), index); await settle();
    const on = await read();
    assert.equal(on.visibleShapes, before.visibleShapes, `${name}: showing ${key} again restores the same shapes`);
    toggles[key] = { shapesHidden: before.visibleShapes - off.visibleShapes };
  }
  assert.ok(toggles.floorAreas.shapesHidden > 0 || toggles.rooms.shapesHidden > 0, `${name}: the overlay toggles hide shapes (${JSON.stringify(toggles)})`);
  await page.$$eval('[data-testid="plan-overlay-key"] input[type="checkbox"]', (boxes) => boxes.forEach((box) => box.click())); await settle();
  await page.screenshot({ path: path.join(out, `${name}-overlays-off.png`) });
  const allOff = await read();
  assert.deepEqual(allOff.transform, before.transform, `${name}: all overlays off leaves the plan in place`);
  await page.$$eval('[data-testid="plan-overlay-key"] input[type="checkbox"]', (boxes) => boxes.forEach((box) => box.click())); await settle();
  return { windows: windows.length, doors: doors.length, labelFontPx: [...new Set(before.markers.map((m) => m.screenFontPx))], sampleLabels: before.markers.slice(0, 4).map((m) => m.label), toggles, allOffShapes: allOff.visibleShapes, allOnShapes: before.visibleShapes };
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
async function save() {
  // Click Save, then wait until every save the screen has submitted (autosaves queued before it included) has
  // finished, so a reopen reads what was saved last. Large plans can take a minute or more per save.
  const before = await page.evaluate(() => harness.saveInputs().length);
  await page.evaluate(() => document.getElementById('ai-plan-takeoff-save-button').click());
  await page.waitForFunction((count) => harness.saveInputs().length > count, { timeout: 900000 }, before);
  for (let stable = 0; stable < 3;) {
    // Saves that keep arriving with nothing edited are an autosave loop: fail and name what keeps changing.
    const submitted = await page.evaluate(() => harness.saveInputs().length);
    if (submitted - before > 8) {
      const changed = await page.evaluate(() => {
        const [a, b] = harness.saveInputs().slice(-2).map((input) => input || {});
        const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
        return keys.filter((key) => JSON.stringify(a[key]) !== JSON.stringify(b[key])).map((key) => {
          const sub = a[key] && typeof a[key] === 'object' && !Array.isArray(a[key]) ? Object.keys({ ...a[key], ...b[key] }).filter((k) => JSON.stringify(a[key][k]) !== JSON.stringify(b[key]?.[k])).slice(0, 12) : [];
          return `${key}${sub.length ? `{${sub.join(',')}}` : ''}`;
        });
      });
      throw Error(`autosave loop: ${submitted - before} saves submitted after one Save click with no edits; changing between the last two: ${changed.join('; ') || '(nothing — identical saves)'}`);
    }
    await page.waitForFunction(() => harness.saveResults().length >= harness.saveInputs().length, { timeout: 900000 });
    await new Promise((resolve) => setTimeout(resolve, 1500));
    stable = (await page.evaluate(() => harness.saveResults().length >= harness.saveInputs().length)) ? stable + 1 : 0;
  }
  const result = await page.evaluate(() => harness.saveResults().at(-1)); assert.equal(result.ok, true, result.message); await settle(); }
