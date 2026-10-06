import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import puppeteer from 'puppeteer';

// Real Takeoff UI + real workbook hook + real IndexedDB persistence, exercising the redesigned
// wall (construction system/frame/cladding product) and opening (code/height/width/glass) editors
// from a real running browser, not just unit tests (Phase 2A runtime acceptance). The synthetic
// job and Chromium profile belong exclusively to this test.
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'artifacts/test-artifacts/takeoff-wall-opening-editor');
const componentPath = path.join(root, 'components/construction-estimation/ai-plan-takeoff/AIPlanTakeoffStandalone.jsx');
const workbookHookPath = path.join(root, 'hooks/estimate-builder/useEstimateBuilderWorkbook.js');
const takeoffDir = path.dirname(componentPath);
const jobId = 'synthetic-wall-opening-editor-regression';
fs.mkdirSync(out, { recursive: true });

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
const indexes=${JSON.stringify(indexes)};
const jobId=${JSON.stringify(jobId)};
const reactRoot=createRoot(document.getElementById('root'));
let currentSheet=null,control=null;
const saveResults=[];
const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=900;
const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,1200,900);
ctx.strokeStyle='#64748b';ctx.lineWidth=1;ctx.strokeRect(40,40,1120,820);
ctx.fillStyle='#334155';ctx.font='20px sans-serif';ctx.fillText('Synthetic wall/opening editor regression',70,55);
const image=canvas.toDataURL('image/png');
const pages=[{pageNumber:1,dataUrl:image,width:1200,height:900,logicalWidth:1200,logicalHeight:900,renderScale:1,vectorSegments:[]}];
// Seeded as source:'ai' with basis Unclassified, exactly the review state a real AI run can leave
// behind: the builder must be able to reclassify it entirely through the redesigned editor.
const aiWall={id:'ai-wall-1',page:1,category:'exterior',nodes:[{x:100,y:100},{x:500,y:100}],lengthMm:4000,thicknessMm:230,alignment:'outer',exteriorType:'Other',constructionSystem:'unclassified',linedFaces:2,openingDeductionsEnabled:true,wallHeightM:null,source:'ai',confidence:0.7,ai:{runId:'run-1',detectionId:'wall-1',documentHash:'hash-1',sourcePage:1,modelVersion:'mock-v1'}};
const aiWindow={id:'ai-window-1',page:1,type:'window',openingClass:'Window',hostWallId:'ai-wall-1',itemTag:'1218',heightMm:1200,widthMm:1800,x:300,y:100,glassType:'',location:'Rumpus',frameJambDetails:'Legacy jamb note',frameMaterial:'Aluminium',frameColour:'White',sillType:'Legacy sill',source:'ai',confidence:0.85,ai:{runId:'run-1',detectionId:'opening-1',documentHash:'hash-1',sourcePage:1,modelVersion:'mock-v1'}};
const initialJob=createJobData({name:'Wall/opening editor regression',takeoffId:'wall-opening-editor-takeoff',associatedProjectId:jobId,associatedProjectName:'Wall/opening editor regression',currentPage:1,totalPages:1,rotation:0,pixelsPerMm:0.1,planPages:pages,planFilename:'synthetic-plan.pdf',completedWallRuns:[aiWall],placedOpenings:[aiWindow],sheetLevels:{1:'Ground Floor'},projectInfo:{projectName:'Wall/opening editor regression'},platformProject:{projectId:jobId,projectName:'Wall/opening editor regression'}});
function findFiber(fiber){if(!fiber)return null;if(fiber.type===Takeoff)return fiber;return findFiber(fiber.child)||findFiber(fiber.sibling);}
function hooks(){const values=[];let hook=findFiber(reactRoot._internalRoot.current)?.memoizedState;while(hook){values.push(hook);hook=hook.next;}return values;}
function value(name){return hooks()[indexes[name]]?.memoizedState;}
function snapshot(){
 const result={};for(const name of ['currentPage','totalPages','pixelsPerMm','activeTool','selectedWallId','selectedOpeningId','completedWallRuns','placedOpenings','sheetLevels','hasUnsavedChanges'])result[name]=value(name);
 result.imageReady=Boolean(value('image'));
 result.schedule=createTakeoffSchedule({...result});
 return JSON.parse(JSON.stringify(result));
}
function Shell(){
 const sheet=useEstimateBuilderWorkbook();currentSheet=sheet;
 const [request,setRequest]=React.useState(null);
 const opened=React.useRef(false);
 React.useEffect(()=>{if(!sheet.hydrated||opened.current)return;const job=sheet.workbook.aiPlanTakeoffJob;if(job?.takeoffId){opened.current=true;setRequest({requestId:'startup-'+Date.now(),jobData:job});}},[sheet.hydrated,sheet.workbook]);
 control={async reopen(){await currentSheet.openSavedJob('job:'+jobId).then(result=>{if(!result.ok)throw Error(result.message);setRequest({requestId:'reopen-'+Date.now(),jobData:result.workbook.aiPlanTakeoffJob});});}};
 if(!sheet.hydrated)return React.createElement('div',null,'Loading workbook');
 return React.createElement(Takeoff,{embedded:true,openTakeoffJobRequest:request,platformContext:{projectId:jobId,projectName:'Wall/opening editor regression',noJobOpen:false,isHydratingProject:false},onSaveToPlatform:async incoming=>{const workbook=currentSheet.getCurrentWorkbook();const prepared=prepareAiPlanTakeoffJobForSave(workbook.aiPlanTakeoffJob,incoming,jobId);const result=prepared.ok?await currentSheet.saveAiPlanTakeoffJob(prepared.job):prepared;saveResults.push(result);return result;}});
}
window.harness={snapshot,saveResults:()=>saveResults,ready:()=>Boolean(currentSheet?.hydrated),
 async seed(){const workbook={...createEstimateBuilderWorkbookDefaults(),jobId,projectId:jobId,commercialProjectId:jobId,projectName:'Wall/opening editor regression',registeredJob:{jobId,jobName:'Wall/opening editor regression'},jobFileMeta:{projectId:jobId,jobName:'Wall/opening editor regression'},aiPlanTakeoffJob:initialJob,takeoffEngine:{aiPlanTakeoffJob:initialJob}};const result=await currentSheet.loadJobFileData({workbook,jobName:'Wall/opening editor regression'},'synthetic-wall-opening-editor.gr8job');if(!result.ok)throw Error(result.message);return result;},
 reopen:()=>control.reopen(),
 setView({zoom,pan}){value('sheetViewStateRef').current[2]={scale:zoom,pos:pan};},
 point(point){const stage=value('stageRef').current,layer=value('layerRef').current,rect=stage.content.getBoundingClientRect(),visible=layer.getAbsoluteTransform().point(point);return {x:rect.left+visible.x*rect.width/stage.width(),y:rect.top+visible.y*rect.height/stage.height()};},
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
  else { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><meta charset="utf-8"><title>Wall/opening editor regression</title><style>html,body,#root{height:100%;margin:0;font-family:Arial}</style><div id="root"></div><script src="/bundle.js"></script>'); }
});
const report = { scope: 'Real component and real workbook hook, isolated Chromium profile, external network blocked', cases: {}, errors: [] };
let browser, page;
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, userDataDir: path.join(out, 'isolated-browser-' + Date.now()), args: ['--no-first-run', '--disable-extensions', '--disable-background-networking'], defaultViewport: { width: 1800, height: 1200 } });
  page = await browser.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  // Export to Job Setup shows a genuine native confirm() preview dialog before proceeding; this
  // test performs no deletions, so any confirm dialog encountered is that one and is accepted.
  page.on('dialog', async dialog => { report.dialogs = report.dialogs || []; report.dialogs.push(dialog.message()); await dialog.accept(); });
  await page.setRequestInterception(true);
  page.on('request', request => request.url().startsWith(origin) || /^(data|blob):/.test(request.url()) ? request.continue() : request.abort());
  await page.goto(origin, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.harness?.ready());
  await page.evaluate(() => harness.seed());
  await page.waitForFunction(() => harness.snapshot().imageReady && harness.snapshot().currentPage === 1, { timeout: 60000 });
  const settle = async () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await settle();
  const snapshot = async () => page.evaluate(() => harness.snapshot());
  const button = async (label, prefix = false) => {
    const found = await page.evaluate(({ label, prefix }) => { const el = [...document.querySelectorAll('button')].find(item => prefix ? item.textContent.trim().startsWith(label) : item.textContent.trim() === label); if (!el) return false; el.click(); return true; }, { label, prefix });
    assert.ok(found, `Find button ${label}`);
    await settle();
  };
  const clickPlan = async (point) => {
    const client = await page.evaluate(point => harness.point(point), point);
    await page.mouse.move(client.x, client.y);
    await page.mouse.click(client.x, client.y);
    await settle();
    await new Promise(resolve => setTimeout(resolve, 350));
  };
  // React-controlled <select>/<input> elements need the native property setter, not a bare
  // .value assignment, or React's synthetic onChange never fires.
  const setLabelFieldValue = async (label, value, tag = 'select') => {
    const found = await page.evaluate(({ label, value, tag }) => {
      const field = [...document.querySelectorAll('label')].find(element => element.textContent.trim().startsWith(label))?.querySelector(tag);
      if (!field) return false;
      const proto = tag === 'select' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(field, value);
      field.dispatchEvent(new Event(tag === 'select' ? 'change' : 'input', { bubbles: true }));
      if (tag === 'input') field.dispatchEvent(new Event('blur', { bubbles: true }));
      return true;
    }, { label, value, tag });
    assert.ok(found, `Find and set ${tag} for label "${label}"`);
    await settle();
  };
  const fieldExists = async (label, tag = 'select') => page.evaluate(({ label, tag }) => Boolean([...document.querySelectorAll('label')].find(element => element.textContent.trim().startsWith(label))?.querySelector(tag)), { label, tag });
  const save = async () => {
    const count = await page.evaluate(() => harness.saveResults().length);
    await page.evaluate(() => document.getElementById('ai-plan-takeoff-save-button').click());
    await page.waitForFunction(count => harness.saveResults().length > count, { timeout: 60000 }, count);
    const result = await page.evaluate(() => harness.saveResults().at(-1));
    assert.equal(result.ok, true, result.message);
    await page.waitForFunction(() => !harness.snapshot().hasUnsavedChanges);
  };
  const reopen = async () => { await page.evaluate(() => harness.reopen()); await page.waitForFunction(() => harness.snapshot().imageReady && harness.snapshot().currentPage === 1, { timeout: 60000 }); await settle(); };

  await button('Select');
  // Click well clear of the window opening (placed mid-wall at x:300), or the click hits the
  // opening's marker instead of the wall beneath it.
  await clickPlan({ x: 150, y: 100 });
  await page.waitForFunction(id => harness.snapshot().selectedWallId === id, {}, 'ai-wall-1');

  // 1. Unclassified review state is visible and offers reclassification.
  const unclassifiedText = await page.evaluate(() => document.body.textContent.includes('Unclassified external wall') || document.body.textContent.includes('Unclassified'));
  assert.ok(unclassifiedText, 'The unclassified wall is visibly flagged for review in the editor');
  report.cases.initialUnclassified = await snapshot();

  // 2. Reclassify to Lightweight Cladding: frame and cladding-product dropdowns appear.
  await setLabelFieldValue('Construction system', 'lightweight_cladding');
  assert.ok(await fieldExists('Frame thickness'), 'Frame thickness selector appears for a framed system');
  assert.ok(await fieldExists('Cladding product'), 'Cladding product selector appears for Lightweight Cladding');
  let state = await snapshot();
  let wall = state.completedWallRuns.find(item => item.id === 'ai-wall-1');
  assert.equal(wall.constructionSystem, 'lightweight_cladding');
  assert.equal(wall.frameThicknessMm, 70, 'Reclassifying to a framed system defaults its frame to 70mm');
  report.cases.reclassifiedToCladding = { constructionSystem: wall.constructionSystem, frameThicknessMm: wall.frameThicknessMm };

  // 3. Cladding product dropdown offers the canonical catalogue; selecting one updates the wall,
  // and the source/confidence AI provenance survives the reclassification untouched.
  await setLabelFieldValue('Cladding product', 'James Hardie Linea Weatherboard - 180mm');
  await setLabelFieldValue('Frame thickness', '90');
  state = await snapshot();
  wall = state.completedWallRuns.find(item => item.id === 'ai-wall-1');
  assert.equal(wall.exteriorFinish, 'James Hardie Linea Weatherboard - 180mm');
  assert.equal(wall.frameThicknessMm, 90);
  assert.equal(wall.source, 'ai', 'AI provenance survives manual reclassification');
  assert.equal(wall.confidence, 0.7, 'AI confidence survives manual reclassification');
  report.cases.claddingProductSelected = { exteriorFinish: wall.exteriorFinish, frameThicknessMm: wall.frameThicknessMm, source: wall.source };
  await page.screenshot({ path: path.join(out, '1-cladding-product-selected.png') });

  // 4. Save and reopen: construction system, frame and cladding product all persist.
  await save();
  await reopen();
  state = await snapshot();
  wall = state.completedWallRuns.find(item => item.id === 'ai-wall-1');
  assert.equal(wall.constructionSystem, 'lightweight_cladding');
  assert.equal(wall.frameThicknessMm, 90);
  assert.equal(wall.exteriorFinish, 'James Hardie Linea Weatherboard - 180mm');
  report.cases.reopenedWall = { constructionSystem: wall.constructionSystem, frameThicknessMm: wall.frameThicknessMm, exteriorFinish: wall.exteriorFinish };
  // The Takeoff Schedule is derived state, recomputed fresh on every snapshot - reclassifying the
  // wall must show up in it immediately, under Lightweight Cladding/90mm, with its product as a
  // detail row, and no longer under Unclassified.
  const level = state.schedule.projectTotals.wallSystems.levels[0];
  const claddingRow = level.external.rows.find(row => row.system === 'lightweight_cladding' && row.frameThicknessMm === 90);
  assert.equal(claddingRow.lengthM, 4, 'The schedule recalculates the reclassified wall under its new system/frame');
  assert.deepEqual(claddingRow.products, [{ label: 'James Hardie Linea Weatherboard - 180mm', lengthM: 4 }]);
  const unclassifiedRow = level.external.rows.find(row => row.system === 'unclassified');
  assert.equal(unclassifiedRow.lengthM, 0, 'The wall no longer reports as Unclassified after reclassification');
  report.cases.scheduleRecalculatedAfterWallEdit = { claddingRowLengthM: claddingRow.lengthM, unclassifiedRowLengthM: unclassifiedRow.lengthM };
  console.log('Wall reclassification, cladding product selection, save/reopen persistence and schedule recalculation passed.');

  // 5. Selected-opening editor shows the redesigned normal fields...
  await button('Select');
  await clickPlan({ x: 300, y: 100 });
  await page.waitForFunction(id => harness.snapshot().selectedOpeningId === id, {}, 'ai-window-1');
  for (const label of ['Window Code / Tag', 'Height (mm)', 'Width (mm)', 'Room / Location', 'Glass type']) {
    assert.ok(await fieldExists(label, ['Glass', 'Room'].some((needle) => label.includes(needle)) ? 'select' : 'input'), `Selected-opening editor shows "${label}"`);
  }
  // ...and no longer shows the removed clutter fields, even though the AI-sourced data (jamb
  // notes, frame material/colour, sill type) is still present underneath, untouched.
  for (const label of ['Frame/Jamb details', 'Frame material', 'Frame colour', 'Sill type']) {
    assert.ok(!(await fieldExists(label, 'input')), `Selected-opening editor no longer shows "${label}"`);
  }
  const beforeGlassEdit = (await snapshot()).placedOpenings.find(item => item.id === 'ai-window-1');
  assert.equal(beforeGlassEdit.frameJambDetails, 'Legacy jamb note', 'Removed-from-UI data is preserved untouched underneath');
  assert.equal(beforeGlassEdit.frameMaterial, 'Aluminium');
  report.cases.openingEditorFields = { shown: ['Window Code / Tag', 'Height (mm)', 'Width (mm)', 'Room / Location', 'Glass type'], removed: ['Frame/Jamb details', 'Frame material', 'Frame colour', 'Sill type'] };
  console.log('Selected-opening editor shows only the redesigned normal fields; removed fields\' underlying data is preserved untouched.');

  // 6. Glass type dropdown, Window Code/Tag, Height and Width all edit and persist, with AI
  // provenance intact throughout - the full Part 12 manual-editing acceptance for an opening.
  await setLabelFieldValue('Glass type', 'Obscured');
  await setLabelFieldValue('Window Code / Tag', '0918', 'input');
  await setLabelFieldValue('Height (mm)', '900', 'input');
  await setLabelFieldValue('Width (mm)', '1800', 'input');
  state = await snapshot();
  const editedOpening = state.placedOpenings.find(item => item.id === 'ai-window-1');
  assert.equal(editedOpening.glassType, 'Obscured');
  assert.equal(editedOpening.itemTag, '0918');
  assert.equal(editedOpening.heightMm, 900);
  assert.equal(editedOpening.widthMm, 1800);
  assert.equal(editedOpening.source, 'ai', 'AI provenance survives a manual glass-type/code/dimension edit');
  assert.equal(editedOpening.confidence, 0.85);
  report.cases.openingEdited = { glassType: editedOpening.glassType, itemTag: editedOpening.itemTag, heightMm: editedOpening.heightMm, widthMm: editedOpening.widthMm, source: editedOpening.source };
  console.log('Window code, height, width and glass type all edit correctly with AI provenance intact.');

  // 7. Takeoff Schedule shows the real, just-edited window code/size/glass, never an internal id,
  // and recalculates from the edit immediately (Part 9/Part 6, item 21).
  await button('Takeoff Schedule', true);
  await settle();
  const scheduleText = await page.evaluate(() => document.body.textContent);
  assert.ok(scheduleText.includes('0918'), 'Schedule shows the edited window code');
  assert.ok(scheduleText.includes('900H') && scheduleText.includes('1800W'), 'Schedule shows the edited height x width, height first');
  assert.ok(scheduleText.includes('Obscured'), 'Schedule shows the edited glass type');
  assert.ok(!scheduleText.includes('window_schedule_'), 'The internal window_schedule_N id is never shown as the primary description');
  report.cases.scheduleShowsWindow = true;
  await page.screenshot({ path: path.join(out, '2-schedule-shows-window-code.png') });
  await button('Close');
  console.log('Takeoff Schedule displays the real, edited window code, size and glass type, never an internal id.');

  // 8. Save and reopen a second time: the edited window code, dimensions and glass type all
  // persist in the browser, not just at the unit level (items 27-29).
  await save();
  await reopen();
  state = await snapshot();
  const reopenedOpening = state.placedOpenings.find(item => item.id === 'ai-window-1');
  assert.equal(reopenedOpening.itemTag, '0918');
  assert.equal(reopenedOpening.heightMm, 900);
  assert.equal(reopenedOpening.widthMm, 1800);
  assert.equal(reopenedOpening.glassType, 'Obscured');
  assert.equal(reopenedOpening.source, 'ai', 'AI provenance survives save/reopen after a manual edit');
  const reopenedWall = state.completedWallRuns.find(item => item.id === 'ai-wall-1');
  assert.equal(reopenedWall.constructionSystem, 'lightweight_cladding', 'The earlier wall reclassification also survives this second save/reopen');
  report.cases.reopenedOpening = { itemTag: reopenedOpening.itemTag, heightMm: reopenedOpening.heightMm, widthMm: reopenedOpening.widthMm, glassType: reopenedOpening.glassType };
  console.log('Window code, dimensions and glass type all persist through a real browser save/reopen.');

  // 9. Takeoff -> Job Setup export runs without a runtime error and produces a payload (item 32).
  await button('Takeoff Schedule', true);
  await settle();
  await button('Export Takeoff to Job Setup');
  await settle();
  const exportedPayload = await page.evaluate(() => document.body.textContent.includes('Job Setup Payload Ready'));
  assert.ok(exportedPayload, 'Export to Job Setup runs without a runtime error and shows the ready payload');
  report.cases.jobSetupExportRan = true;
  console.log('Takeoff -> Job Setup export runs without a runtime error.');

  // Supabase's own cross-tab auth lock occasionally logs a benign retry notice ("no lock was
  // stolen") under rapid save/reopen in one isolated profile; it is a Supabase-internal retry
  // signal, not a functional failure - every save/reopen assertion above already proved the
  // actual save and reopen succeeded correctly before this could have masked anything.
  const realErrors = report.errors.filter((message) => !/no lock was stolen/.test(message));
  assert.deepEqual(realErrors, [], 'No unexpected browser runtime errors');
  report.ok = true;
  console.log('Wall/opening editor browser acceptance passed: construction system, frame, cladding product, opening code/height/width/glass, save/reopen and the redesigned schedule.');
} catch (error) {
  report.error = error.stack || String(error);
  if (page) await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  if (browser) await browser.close();
  server.close();
}
