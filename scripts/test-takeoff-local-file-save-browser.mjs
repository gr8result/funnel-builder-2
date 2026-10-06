import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import ts from 'typescript';
import puppeteer from 'puppeteer';

// Runtime proof for the local-computer save workflow. The real component runs in a real browser
// with its own isolated profile and its own IndexedDB; synthetic job only, never the user's
// profile or saved jobs.
//
// The OS/browser file picker itself is native UI that cannot be automated, and that is the point:
// the location can only ever come from the user. What is proven here is everything on this side of
// it - that Save As actually calls showSaveFilePicker, that the bytes handed to the chosen file are
// a complete .gr8takeoff, and that those exact bytes reopen the plan and overlays after the
// browser's plan asset storage has been deleted.

const require = createRequire(import.meta.url);
const root = process.cwd();
const out = path.join(root, 'artifacts/test-artifacts/takeoff-local-file-save');
fs.mkdirSync(out, { recursive: true });
const component = path.join(root, 'components/construction-estimation/ai-plan-takeoff/AIPlanTakeoffStandalone.jsx');
const source = fs.readFileSync(component, 'utf8');

// Map hook order so component state can be read back without instrumenting the component.
const parsed = ts.createSourceFile(component, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
const fn = parsed.statements.find((n) => ts.isFunctionDeclaration(n) && n.name?.text === 'AIPlanTakeoffStandalone');
const indexes = {};
let index = 0;
(function visit(node) {
  if (ts.isFunctionLike(node) && node !== fn) return;
  if (ts.isCallExpression(node) && /^(React\.)?use(State|Ref|Effect|Callback|Memo)$/.test(node.expression.getText(parsed))) {
    const d = node.parent;
    if (ts.isVariableDeclaration(d)) {
      const name = ts.isArrayBindingPattern(d.name) ? d.name.elements[0]?.name?.getText(parsed) : d.name.getText(parsed);
      if (name) indexes[name] = index;
    }
    index += 1;
    return;
  }
  ts.forEachChild(node, visit);
})(fn.body);

const loader = path.join(out, 'jsx-loader.cjs');
fs.writeFileSync(loader, `const ts=require(${JSON.stringify(require.resolve('typescript'))}); module.exports=s=>ts.transpileModule(s,{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;`);

const entry = path.join(out, 'browser-entry.cjs');
fs.writeFileSync(entry, `
const React=require('react');
const {createRoot}=require('react-dom/client');
const Workspace=require(${JSON.stringify(component)}).default;
const storage=require(${JSON.stringify(path.join(path.dirname(component), 'planBlobStorage.js'))});
const indexes=${JSON.stringify(indexes)};
const root=createRoot(document.getElementById('root'));
let props={embedded:false,platformContext:{projectName:'Local save regression'}};

const canvas=document.createElement('canvas');canvas.width=800;canvas.height=600;
const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,800,600);
ctx.strokeStyle='#334155';ctx.lineWidth=4;ctx.strokeRect(80,80,640,440);
ctx.font='26px sans-serif';ctx.fillStyle='#334155';ctx.fillText('Portable plan - Sheet 2',110,140);
const image=canvas.toDataURL('image/png');
const page=n=>({pageNumber:n,dataUrl:image,width:800,height:600,logicalWidth:800,logicalHeight:600,renderScale:1,vectorSegments:[]});
const job={takeoffId:'local-save-job',jobName:'Local save job',takeoffName:'Local save job',currentPage:2,totalPages:2,
rotation:90,pixelsPerMm:0.1,planFilename:'plans.pdf',
plan:{type:'embedded-pages',pages:[page(1),page(2)]},
sheetLevels:{2:'Second Level'},
projectInfo:{projectName:'Local save job',clientName:'Bill and Mary',siteAddress:'2 Astreet'},
completedWallRuns:[{id:'wall-ext',page:2,category:'exterior',nodes:[{x:80,y:80},{x:720,y:80}],lengthMm:6400,thicknessMm:230,alignment:'outer',exteriorType:'Rendered Brick Veneer',linedFaces:2,openingDeductionsEnabled:true},
{id:'wall-int',page:2,category:'interior',nodes:[{x:80,y:300},{x:400,y:300}],lengthMm:3200,thicknessMm:90,alignment:'outer',exteriorType:'',linedFaces:2,openingDeductionsEnabled:true}],
completedEaves:[{id:'eave',page:2,nodes:[{x:80,y:520},{x:720,y:520}],lengthMm:6400,level:'Second Level',widthOption:'600',widthMm:600}],
completedAreas:[{id:'tiles',page:2,category:'Tiles',nodes:[{x:100,y:150},{x:400,y:150},{x:400,y:400}],exclusions:[]}],
completedFloorplans:[{id:'fp',page:2,type:'Footprint',label:'Outer Footprint',nodes:[{x:80,y:80},{x:720,y:80},{x:720,y:520}]}],
completedMeasurements:[{id:'meas',page:2,p1:{x:100,y:560},p2:{x:400,y:560},offset:{x:0,y:0}}],
placedOpenings:[{id:'win',page:2,type:'window',openingClass:'Window',widthMm:1800,heightMm:1200,x:300,y:80,hostWallId:'wall-ext'}]};

// Record what the component asks of the file system, and what bytes it hands over.
const savedFiles=[];
const pickerCalls=[];
const downloads=[];
let pickerBehaviour='accept';
function makeFileHandle(name){
  const handle={name,written:[],
    queryPermission:async()=>handle.permission||'granted',
    requestPermission:async()=>handle.permission||'granted',
    createWritable:async()=>({write:async d=>{handle.written.push(d);},close:async()=>{savedFiles.push({name,data:handle.written.join('')});},abort:async()=>{}}),
    getFile:async()=>new File([handle.written.join('')],name,{type:'application/json'})};
  return handle;
}
window.showSaveFilePicker=async options=>{
  pickerCalls.push(options);
  if(pickerBehaviour==='cancel'){const e=new Error('The user aborted a request.');e.name='AbortError';throw e;}
  return makeFileHandle(options?.suggestedName||'untitled.gr8takeoff');
};
const anchorClick=HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click=function(){if(this.download){downloads.push(this.download);return;}return anchorClick.call(this);};

function render(next){props={...props,...next};root.render(React.createElement(Workspace,props));}
function snapshot(){let hook=root._internalRoot.current.child?.memoizedState;const values=[];while(hook){values.push(hook.memoizedState);hook=hook.next;}
const r={};for(const n of ['currentPage','planPages','completedWallRuns','completedEaves','completedAreas','completedFloorplans','completedMeasurements','placedOpenings','pixelsPerMm','rotation','sheetLevels','jobName','jobFileHandle','platformSaveMessage','hasUnsavedChanges','planLoadError'])r[n]=values[indexes[n]];
r.imageReady=Boolean(values[indexes.image]);
r.planPages=r.planPages?.map(p=>({pageNumber:p.pageNumber,hasImage:Boolean(p.dataUrl&&String(p.dataUrl).startsWith('data:')),assetId:p.dataUrlAssetId||null}));
r.hasFileHandle=Boolean(r.jobFileHandle);
delete r.jobFileHandle;
return JSON.parse(JSON.stringify(r));}

window.harness={
  snapshot,
  job,
  savedFiles:()=>savedFiles.map(f=>({name:f.name,bytes:f.data.length})),
  pickerCalls:()=>pickerCalls,
  downloads:()=>downloads,
  lastSavedText:()=>savedFiles.length?savedFiles[savedFiles.length-1].data:null,
  setPicker(mode){pickerBehaviour=mode;},
  removePicker(){delete window.showSaveFilePicker;},
  restorePicker(){window.showSaveFilePicker=async options=>{pickerCalls.push(options);if(pickerBehaviour==='cancel'){const e=new Error('abort');e.name='AbortError';throw e;}return makeFileHandle(options?.suggestedName||'untitled.gr8takeoff');};},
  // Store the plan images in this profile's asset store and open the job by reference only,
  // exactly as a job saved in this browser would be held.
  async openByReference(){
    const refs=(await storage.externalizeTakeoffPlanPages({aiPlanTakeoffJob:job})).aiPlanTakeoffJob;
    render({openTakeoffJobRequest:{requestId:'open-ref-'+Date.now(),jobData:refs}});
    return refs.plan.pages.map(p=>p.dataUrlAssetId);
  },
  // Delete the browser's plan asset store outright, so nothing local can satisfy a reopen.
  async wipePlanAssetStore(){
    await new Promise(r=>{const req=indexedDB.deleteDatabase('gr8-takeoff-plan-assets-v1');req.onsuccess=req.onerror=req.onblocked=()=>r();});
    const names=(await indexedDB.databases?.())||[];
    return names.map(d=>d.name);
  },
  // Reopen from the saved bytes alone.
  openSavedFile(text){render({openTakeoffJobRequest:{requestId:'reopen-'+Date.now(),jobData:JSON.parse(text)}});},
  clickSaveAs(){document.getElementById('ai-plan-takeoff-save-as-button').click();},
  clickSave(){document.getElementById('ai-plan-takeoff-save-button').click();},
};
render({});
`);

const webpackPackage = require('next/dist/compiled/webpack/webpack');
webpackPackage.init();
const webpack = webpackPackage.webpack;
await new Promise((resolve, reject) => {
  const compiler = webpack({
    mode: 'development', target: 'web', devtool: false, context: root, entry,
    output: { path: out, filename: 'browser-bundle.js' },
    resolve: { extensions: ['.js', '.jsx', '.mjs'], mainFields: ['browser', 'module', 'main'], fallback: { canvas: false, fs: false, path: false, url: false } },
    module: { rules: [{ test: /\.jsx$/, use: loader }] },
    plugins: [new webpack.IgnorePlugin({ resourceRegExp: /^node:/ }), new webpack.DefinePlugin({ 'process.env': JSON.stringify({ NEXT_PUBLIC_SUPABASE_URL: 'https://placeholder.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'placeholder-anon-key' }) })],
    optimization: { minimize: false }, performance: { hints: false },
  });
  compiler.run((error, stats) => compiler.close(() => (error || stats.hasErrors() ? reject(error || new Error(stats.toString({ all: false, errors: true }))) : resolve())));
});

const server = http.createServer((req, res) => {
  if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'application/javascript'); fs.createReadStream(path.join(out, 'browser-bundle.js')).pipe(res); }
  else { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><title>Local takeoff file save</title><style>html,body,#root{height:100%;margin:0;font-family:Arial}</style><div id="root"></div><script src="/bundle.js"></script>'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));

const report = { scope: 'Real component, real browser, isolated profile and IndexedDB; synthetic job only', cases: {} };
let browser;
try {
  browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, defaultViewport: { width: 1500, height: 1000 }, args: ['--disable-background-networking'] });
  const url = `http://127.0.0.1:${server.address().port}`;
  const page = await browser.newPage();
  page.on('dialog', (d) => d.dismiss());
  page.on('pageerror', (e) => (report.errors ??= []).push(e.message));
  await page.setRequestInterception(true);
  page.on('request', (r) => (r.url().startsWith(url) || /^(data|blob):/.test(r.url()) ? r.continue() : r.abort()));
  await page.goto(url);
  await page.waitForFunction(() => window.harness?.snapshot().currentPage === 1);
  const settle = () => page.evaluate(() => new Promise((r) => setTimeout(r, 500)));

  // Open a job the way this browser holds one: plan images in the asset store, job by reference.
  const assetIds = await page.evaluate(() => harness.openByReference());
  await settle();
  const opened = report.cases.openedByReference = await page.evaluate(() => harness.snapshot());
  assert.equal(opened.imageReady, true, 'The job opened with its plan rendered');
  assert.equal(opened.currentPage, 2);
  await page.screenshot({ path: path.join(out, '1-opened-from-asset-store.png') });

  // --- Save As -------------------------------------------------------------------------------
  await page.evaluate(() => harness.clickSaveAs());
  await settle();
  const pickerCalls = await page.evaluate(() => harness.pickerCalls());
  assert.equal(pickerCalls.length, 1, 'Save As opened the computer save picker exactly once');
  assert.match(pickerCalls[0].suggestedName, /\.gr8takeoff$/, 'The picker suggests a .gr8takeoff name');
  assert.deepEqual(pickerCalls[0].types[0].accept, { 'application/json': ['.gr8takeoff'] }, 'The picker restricts to .gr8takeoff');
  const files = await page.evaluate(() => harness.savedFiles());
  assert.equal(files.length, 1, 'Exactly one file was written to the chosen location');
  report.cases.saveAs = { picker: pickerCalls[0], file: files[0] };
  const afterSaveAs = await page.evaluate(() => harness.snapshot());
  assert.equal(afterSaveAs.hasUnsavedChanges, false, 'A completed save clears unsaved changes');
  assert.match(afterSaveAs.platformSaveMessage, /Saved to .*\.gr8takeoff on this computer\./);
  await page.screenshot({ path: path.join(out, '2-after-save-as.png') });

  // The written bytes must carry the plan image, not the asset id it was held by.
  const savedText = await page.evaluate(() => harness.lastSavedText());
  const savedJson = JSON.parse(savedText);
  const savedPages = savedJson.takeoffData?.plan?.pages || [];
  assert.equal(savedPages.length, 2, 'Both sheets are in the saved file');
  assert.ok(savedPages.every((p) => typeof p.dataUrl === 'string' && p.dataUrl.startsWith('data:image/')), 'Every sheet carries embedded image data');
  assert.ok(!savedText.includes(assetIds[0]) || savedPages.every((p) => p.dataUrl), 'Plan images are materialized, not left as asset ids');
  assert.equal(savedJson.gr8FileType, 'ai-plan-takeoff');
  report.cases.portable = { bytes: savedText.length, sheets: savedPages.length, embeddedImages: savedPages.filter((p) => p.dataUrl).length };

  // --- Reopen with the browser's plan asset storage deleted ------------------------------------
  const remaining = await page.evaluate(() => harness.wipePlanAssetStore());
  assert.ok(!remaining.includes('gr8-takeoff-plan-assets-v1'), 'The plan asset store was deleted');
  await page.evaluate((text) => harness.openSavedFile(text), savedText);
  await settle();
  const reopened = report.cases.reopenedWithoutStorage = await page.evaluate(() => harness.snapshot());
  assert.equal(reopened.imageReady, true, 'The saved file reopened its plan with no browser asset storage');
  assert.equal(reopened.planLoadError, null, 'Reopening raised no plan load error');
  assert.ok(reopened.planPages.every((p) => p.hasImage), 'Every reopened sheet has its image');
  assert.equal(reopened.currentPage, 2, 'The saved sheet is restored');
  assert.equal(reopened.pixelsPerMm, 0.1, 'Calibration restored');
  assert.equal(reopened.rotation, 90, 'Rotation restored');
  assert.deepEqual(reopened.sheetLevels, { 2: 'Second Level' }, 'Sheet level assignments restored');
  assert.equal(reopened.completedWallRuns.length, 2, 'Wall runs restored');
  assert.equal(reopened.completedWallRuns.find((w) => w.id === 'wall-ext').exteriorType, 'Rendered Brick Veneer', 'Wall classification restored');
  assert.equal(reopened.completedWallRuns.find((w) => w.id === 'wall-ext').lengthMm, 6400, 'Wall length restored');
  assert.equal(reopened.completedEaves.length, 1, 'Eaves restored');
  assert.equal(reopened.completedAreas.length, 1, 'Floorcoverings restored');
  assert.equal(reopened.completedFloorplans.length, 1, 'Floor areas restored');
  assert.equal(reopened.completedMeasurements.length, 1, 'Measurements restored');
  assert.equal(reopened.placedOpenings.length, 1, 'Openings restored');
  await page.screenshot({ path: path.join(out, '3-reopened-without-browser-storage.png') });

  // --- Save writes back to the same file -------------------------------------------------------
  const beforeSave = (await page.evaluate(() => harness.pickerCalls())).length;
  await page.evaluate(() => harness.clickSave());
  await settle();
  assert.equal((await page.evaluate(() => harness.pickerCalls())).length, beforeSave, 'Save reuses the open file and does not ask again');
  assert.equal((await page.evaluate(() => harness.savedFiles())).length, 2, 'Save wrote the file again');
  report.cases.saveReusesHandle = true;

  // --- Cancelling Save As ----------------------------------------------------------------------
  await page.evaluate(() => harness.setPicker('cancel'));
  const filesBeforeCancel = (await page.evaluate(() => harness.savedFiles())).length;
  await page.evaluate(() => harness.clickSaveAs());
  await settle();
  const cancelled = report.cases.cancelled = await page.evaluate(() => harness.snapshot());
  assert.equal((await page.evaluate(() => harness.savedFiles())).length, filesBeforeCancel, 'Cancelling wrote nothing');
  assert.match(cancelled.platformSaveMessage, /cancelled/i, 'Cancelling says it was cancelled');
  assert.doesNotMatch(cancelled.platformSaveMessage, /Saved to/, 'Cancelling never claims a save');
  await page.screenshot({ path: path.join(out, '4-cancelled-save-as.png') });

  // --- No File System Access API ---------------------------------------------------------------
  await page.evaluate(() => { harness.setPicker('accept'); harness.removePicker(); });
  await page.evaluate(() => harness.clickSaveAs());
  await settle();
  const downloads = await page.evaluate(() => harness.downloads());
  assert.deepEqual(downloads.map((d) => d.endsWith('.gr8takeoff')), [true], 'An unsupported browser downloads a .gr8takeoff');
  const fallback = report.cases.downloadFallback = await page.evaluate(() => harness.snapshot());
  assert.match(fallback.platformSaveMessage, /downloaded by the browser/, 'The message says it went to the downloads folder');

  assert.deepEqual(report.errors || [], [], 'No uncaught browser errors');
  console.log('RUNTIME PASS - local takeoff file save');
  console.log(`  save picker        called once, suggestedName=${pickerCalls[0].suggestedName}, accept=.gr8takeoff`);
  console.log(`  written file       ${files[0].name}, ${(files[0].bytes / 1024).toFixed(1)} KB, ${report.cases.portable.embeddedImages}/${report.cases.portable.sheets} sheets carry embedded images`);
  console.log('  asset store        gr8-takeoff-plan-assets-v1 deleted before reopening');
  console.log('  reopened           plan rendered, sheet 2, calibration 0.1, rotation 90, 2 walls,');
  console.log('                     1 eave, 1 area, 1 floorplan, 1 measurement, 1 opening, levels intact');
  console.log('  save               reused the open file handle, no second picker');
  console.log('  cancelled          nothing written, no false success');
  console.log('  no FS Access API   fell back to a .gr8takeoff download');
} finally {
  fs.writeFileSync(path.join(out, 'runtime-report.json'), JSON.stringify(report, null, 2));
  await browser?.close();
  await new Promise((r) => server.close(r));
}
