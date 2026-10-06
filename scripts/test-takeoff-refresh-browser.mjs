import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import puppeteer from 'puppeteer';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'artifacts/test-artifacts/takeoff-refresh-browser');
const componentPath = path.join(root, 'components/construction-estimation/ai-plan-takeoff/AIPlanTakeoffStandalone.jsx');
const baselinePath = path.join(root, 'artifacts/test-artifacts/takeoff-refresh-stability/AIPlanTakeoffStandalone.before.txt');
fs.mkdirSync(out, { recursive: true });
const webpackPackage = require('next/dist/compiled/webpack/webpack');
webpackPackage.init();
const webpack = webpackPackage.webpack;
const sources = { before: fs.readFileSync(baselinePath, 'utf8'), after: fs.readFileSync(componentPath, 'utf8') };
const report = { scope: 'Actual component in isolated Chrome; synthetic calibrated plan and in-memory platform save; real React Fast Refresh effect replay.', sources: {}, cases: {} };
for (const [variant, source] of Object.entries(sources)) {
  fs.writeFileSync(path.join(out, `${variant}-component-source.txt`), source);
  report.sources[variant] = { path: variant === 'before' ? baselinePath : componentPath, sha256: crypto.createHash('sha256').update(source).digest('hex') };
}
const loaderPath = path.join(out, 'jsx-loader.cjs');
fs.writeFileSync(loaderPath, `const fs = require('node:fs');\nconst ts = require(${JSON.stringify(require.resolve('typescript'))});\nmodule.exports = function(source) {\n if (this.resourcePath === ${JSON.stringify(componentPath)}) source = fs.readFileSync(this.getOptions().snapshot, 'utf8');\n return ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 }, fileName: this.resourcePath }).outputText;\n};\n`);

function hookIndexes(source) {
  const parsed = ts.createSourceFile(componentPath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  const component = parsed.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === 'AIPlanTakeoffStandalone');
  assert.ok(component, 'Find the actual component definition');
  const indexes = {};
  let index = 0;
  function visit(node) {
    if (ts.isFunctionLike(node)) return;
    if (ts.isCallExpression(node) && /^(React\.)?use(State|Ref|Effect|Callback|Memo)$/.test(node.expression.getText(parsed))) {
      const declaration = node.parent;
      if (ts.isVariableDeclaration(declaration)) {
        const name = ts.isArrayBindingPattern(declaration.name) ? declaration.name.elements[0]?.name?.getText(parsed) : declaration.name.getText(parsed);
        if (name) indexes[name] = index;
      }
      index += 1;
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(component.body);
  assert.ok(Number.isInteger(indexes.eavePoints));
  return indexes;
}

function entryFor(variant) {
  return `
const Refresh = require('next/dist/compiled/react-refresh/runtime');
Refresh.injectIntoGlobalHook(window);
const React = require('react');
const { createRoot } = require('react-dom/client');
const Original = require(${JSON.stringify(componentPath)}).default;
const { createJobData } = require(${JSON.stringify(path.join(path.dirname(componentPath), 'jobPersistence.js'))});
const hookIndexes = ${JSON.stringify(hookIndexes(sources[variant]))};
const imageLoads = [];
const imageDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
Object.defineProperty(HTMLImageElement.prototype, 'src', { ...imageDescriptor, set(value) {
  if (String(value).startsWith('data:image/')) imageLoads.push({ at: performance.now(), length: String(value).length });
  return imageDescriptor.set.call(this, value);
}});
const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 900;
const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 1200, 900);
ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 2; ctx.strokeRect(100, 100, 1000, 700);
ctx.fillStyle = '#334155'; ctx.font = '24px sans-serif'; ctx.fillText('Synthetic takeoff refresh regression', 140, 150);
const dataUrl = canvas.toDataURL('image/png');
const planPages = [1,2,3].map(pageNumber => ({ pageNumber, dataUrl, width: 1200, height: 900, logicalWidth: 1200, logicalHeight: 900, renderScale: 1, vectorSegments: [] }));
const job = createJobData({ name: 'Refresh regression', takeoffId: 'synthetic-refresh-takeoff', currentPage: 3, totalPages: 3, pixelsPerMm: 0.1, planPages,
 completedEaves: [{ id: 'already-completed-eave', page: 3, nodes: [{x:100,y:100},{x:200,y:100}], lengthMm:1000, widthOption:'600',widthMm:600,level:'Second Level',alignment:'outer' }],
 sheetLevels: {3:'Second Level'}, associatedProjectId:'synthetic-refresh-project', associatedProjectName:'Refresh regression', planFilename:'synthetic-plan.png', revision:1 });
const saves = [];
let props = { embedded:true, initialJob:null, platformContext:{projectId:'synthetic-refresh-project',projectName:'Refresh regression'},
 openTakeoffJobRequest:{requestId:'synthetic-open-request',jobData:job},
 onSaveToPlatform: async jobData => { saves.push(structuredClone(jobData)); return {ok:true,verification:{ok:true,revision:2},revision:2,savedAt:new Date().toISOString(),message:'Synthetic save verified'}; } };
const owner = document.getElementById('root');
const root = createRoot(owner);
const signature = 'actual-takeoff-stable-hooks';
Refresh.register(Original,'takeoff-under-test'); Refresh.setSignature(Original,signature,false,()=>[]);
let refreshedType = Original;
function snapshot() {
 const fiber = root._internalRoot.current.child;
 const values = []; let hook = fiber?.memoizedState;
 while (hook) { values.push(hook.memoizedState); hook=hook.next; }
 const state = {};
 for (const name of ['eavePoints','activePolyline','activeAreaPolyline','measurePoints','completedEaves','currentPage','pixelsPerMm','sheetLevels','activeTool','stageScale','stagePos']) state[name]=values[hookIndexes[name]];
 return { ...JSON.parse(JSON.stringify(state)), imageLoads:imageLoads.length, imageReady:Boolean(values[hookIndexes.image]),
  instanceId:window.__gr8AiPlanTakeoffState?.instanceId || null, timeOrigin:performance.timeOrigin,
  lastClick:window.__gr8LastAiPlanTakeoffClick || null,
  savedCalls:saves.length, diagnosticEvents:(window.__gr8TakeoffRefreshDiagnostics||[]).map(event=>({...event})),
  refIdentity:values[hookIndexes.loadedInitialJobRef] === window.__takeoffOriginalRef,
  hookCount:values.length, componentName:fiber?.type?.name };
}
window.__takeoffHarness = { snapshot, saves, imageLoads,
 rememberRef() { let h=root._internalRoot.current.child.memoizedState; for(let i=0;i<hookIndexes.loadedInitialJobRef;i++)h=h.next; window.__takeoffOriginalRef=h.memoizedState; },
 replay() { const Prior=Original; function Refreshed(props) { return Prior(props); }
  Refresh.register(Refreshed,'takeoff-under-test'); Refresh.setSignature(Refreshed,signature,false,()=>[]); refreshedType=Refreshed;
  const update=Refresh.performReactRefresh(); return update ? {updated:update.updatedFamilies.size,stale:update.staleFamilies.size}:null; },
 cloneProps() { props={...props,platformContext:{...props.platformContext},openTakeoffJobRequest:{...props.openTakeoffJobRequest,jobData:structuredClone(props.openTakeoffJobRequest.jobData)}}; root.render(React.createElement(refreshedType,props)); },
};
root.render(React.createElement(Original,props));
`;
}

async function build(variant) {
  const entryPath = path.join(out, `${variant}-entry.cjs`);
  fs.writeFileSync(entryPath, entryFor(variant));
  const config = {
    mode: 'development', target: 'web', devtool: false, context: root, entry: entryPath,
    output: { path: out, filename: `${variant}-bundle.js` },
    resolve: { extensions: ['.js', '.jsx', '.mjs'], mainFields: ['browser', 'module', 'main'], fallback: { canvas:false, fs:false, path:false, url:false } },
    module: { rules: [{ test: /\.jsx$/, use: [{ loader: loaderPath, options: { snapshot: path.join(out, `${variant}-component-source.txt`) } }] }] },
    plugins: [
      new webpack.IgnorePlugin({ resourceRegExp: /^node:/ }),
      // The AI Takeoff bridge transitively imports utils/supabase-client.js,
      // which reads process.env.NEXT_PUBLIC_SUPABASE_* the way Next.js's real
      // build inlines it. This bare bundle has no such step, so without this
      // the component throws "process is not defined" on mount.
      new webpack.DefinePlugin({ 'process.env': JSON.stringify({ NEXT_PUBLIC_SUPABASE_URL: 'https://placeholder.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'placeholder-anon-key' }) }),
    ],
    optimization: { minimize:false }, performance: { hints:false },
  };
  await new Promise((resolve, reject) => {
    const compiler = webpack(config);
    compiler.run((error, stats) => {
      const summary = stats?.toJson({ all:false, errors:true, warnings:true });
      fs.writeFileSync(path.join(out, `${variant}-build.json`), JSON.stringify(summary || {error:String(error)}, null, 2));
      compiler.close(() => {});
      if (error || stats?.hasErrors()) reject(error || new Error(JSON.stringify(summary.errors)));
      else resolve();
    });
  });
  console.log(`Built ${variant} actual-component browser bundle.`);
}

const server = http.createServer((req, res) => {
  const variant = req.url?.includes('before') ? 'before' : 'after';
  if (req.url?.endsWith('-bundle.js')) {
    res.setHeader('Content-Type', 'application/javascript');
    fs.createReadStream(path.join(out, `${variant}-bundle.js`)).pipe(res);
  } else {
    res.setHeader('Content-Type', 'text/html');
    res.end(`<!doctype html><html><head><meta charset="utf-8"><title>Isolated takeoff refresh regression</title><style>html,body,#root{height:100%;margin:0}body{font-family:Arial,sans-serif}</style></head><body><div id="root"></div><script src="/${variant}-bundle.js"></script></body></html>`);
  }
});
let browser;
try {
  await build('before');
  await build('after');
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  browser = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true,
    userDataDir:path.join(out, `isolated-browser-${Date.now()}`), args:['--no-first-run','--disable-extensions','--disable-background-networking'],
    defaultViewport:{width:1600,height:1050} });
  for (const variant of ['before','after']) {
    const page = await browser.newPage();
    const errors = [];
    const logs = [];
    let navigations = 0;
    page.on('pageerror',error => errors.push(error.message));
    page.on('console',async msg => { if(msg.text().includes('TAKEOFF_REFRESH_DIAGNOSTIC')) logs.push(msg.text()); });
    page.on('framenavigated',frame => { if(frame===page.mainFrame())navigations+=1; });
    page.on('dialog',dialog => dialog.dismiss());
    await page.setRequestInterception(true);
    page.on('request',req => req.url().startsWith(baseUrl) || req.url().startsWith('data:') || req.url().startsWith('blob:') ? req.continue() : req.abort());
    const result = report.cases[variant] = { errors, checkpoints:{}, navigations:0 };
    await page.goto(`${baseUrl}/${variant}`, {waitUntil:'load',timeout:60000});
    await page.waitForFunction(() => window.__takeoffHarness?.snapshot().imageReady && window.__takeoffHarness.snapshot().currentPage===3, {timeout:30000});
    await settle(page);
    await page.evaluate(() => window.__takeoffHarness.rememberRef());
    result.checkpoints.initial = await snapshot(page);
    await clickButton(page,'Eaves');
    // Use real browser mouse events at distinct positions, so no double-click finalization occurs.
    await clickPlan(page,0.30,0.30);
    await clickPlan(page,0.52,0.30);
    await clickPlan(page,0.52,0.53);
    await page.waitForFunction(() => window.__takeoffHarness.snapshot().eavePoints.length===3);
    const host = await page.$('.konvajs-content');
    const rect = await host.boundingBox();
    await page.mouse.move(rect.x+rect.width*0.45,rect.y+rect.height*0.45);
    await page.mouse.wheel({deltaY:-100});
    await settle(page);
    result.checkpoints.beforeReplay = await snapshot(page);
    await page.screenshot({path:path.join(out,`${variant}-before-refresh.png`)});
    result.refresh = await page.evaluate(() => window.__takeoffHarness.replay());
    await settle(page);
    result.checkpoints.afterReplay = await snapshot(page);
    await page.screenshot({path:path.join(out,`${variant}-after-refresh.png`)});
    assert.equal(result.refresh?.stale,0,`${variant}: Fast Refresh should preserve the mounted component family`);
    assert.ok(result.refresh?.updated>0,`${variant}: Real React Fast Refresh must run`);
    assert.equal(result.checkpoints.afterReplay.timeOrigin,result.checkpoints.beforeReplay.timeOrigin);
    assert.equal(result.checkpoints.afterReplay.refIdentity,true,`${variant}: Keep the same component ref across replay`);
    if(variant==='before') {
      assert.equal(result.checkpoints.afterReplay.eavePoints.length,0,'Baseline actual browser replay erases all three unfinished eave points');
      assert.ok(result.checkpoints.afterReplay.imageLoads>result.checkpoints.beforeReplay.imageLoads,'Baseline replay decodes the plan image again');
    } else {
      assertStable(result.checkpoints.beforeReplay,result.checkpoints.afterReplay,'Real browser Fast Refresh');
      await page.evaluate(() => window.__takeoffHarness.cloneProps());
      await settle(page);
      result.checkpoints.afterClonedProps = await snapshot(page);
      assertStable(result.checkpoints.afterReplay,result.checkpoints.afterClonedProps,'Equivalent incoming prop objects');
      await page.click('#ai-plan-takeoff-save-button');
      await page.waitForFunction(() => window.__takeoffHarness.snapshot().savedCalls===1);
      await settle(page);
      result.checkpoints.afterSave = await snapshot(page);
      assertStable(result.checkpoints.afterClonedProps,result.checkpoints.afterSave,'Manual platform save');
      await clickButton(page,'Takeoff Schedule');
      await clickButton(page,'Close');
      await settle(page);
      result.checkpoints.afterSchedule = await snapshot(page);
      assertStable(result.checkpoints.afterSave,result.checkpoints.afterSchedule,'Opening and closing schedule');
      await clickPlan(page,0.30,0.53);
      await page.waitForFunction(() => window.__takeoffHarness.snapshot().eavePoints.length===4);
      result.checkpoints.afterAnotherPoint = await snapshot(page);
      assert.deepEqual(result.checkpoints.afterAnotherPoint.eavePoints.slice(0,3),result.checkpoints.beforeReplay.eavePoints,'Continue the same unfinished eave after save/replay');
      assert.deepEqual(result.checkpoints.afterAnotherPoint.completedEaves,result.checkpoints.beforeReplay.completedEaves);
      await page.screenshot({path:path.join(out,'after-save-schedule-and-continued-draft.png')});
    }
    result.navigations=navigations;
    assert.equal(navigations,1,`${variant}: No navigation/reload after initial harness load`);
    assert.deepEqual(errors,[],`${variant}: No browser runtime exceptions`);
    fs.writeFileSync(path.join(out,`${variant}-diagnostic-console.txt`),logs.join('\n'));
    console.log(`${variant.toUpperCase()}: points ${result.checkpoints.beforeReplay.eavePoints.length} -> ${result.checkpoints.afterReplay.eavePoints.length}; image decodes ${result.checkpoints.beforeReplay.imageLoads} -> ${result.checkpoints.afterReplay.imageLoads}; navigation count ${navigations}; same component ref ${result.checkpoints.afterReplay.refIdentity}.`);
    await page.close();
  }
  report.ok=true;
  console.log('Takeoff actual-browser refresh regression passed: baseline loses unfinished eave points; fixed component preserves drafts, image, completed geometry, view, page, level and calibration through real effect replay, prop churn, manual save and schedule UI.');
} catch(error) {
  report.error=error.stack || String(error);
  if(browser) {
    const page=(await browser.pages()).at(-1);
    if(page) { report.failurePage={url:page.url(),text:await page.evaluate(()=>document.body.innerText).catch(()=>''),snapshot:await snapshot(page).catch(()=>null)}; await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{}); }
  }
  throw error;
} finally {
  fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));
  await browser?.close();
  await new Promise(resolve => server.listening ? server.close(resolve) : resolve());
}

async function snapshot(page) { return page.evaluate(()=>window.__takeoffHarness.snapshot()); }
async function settle(page) { await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))); }
async function clickButton(page,text) {
  const found=await page.evaluate(expected=>{const button=[...document.querySelectorAll('button')].find(el=>el.textContent.trim()===expected || (expected==='Takeoff Schedule' && el.textContent.trim().startsWith(expected))); if(!button)return false; button.click(); return true;},text);
  assert.ok(found,`Find ${text} button`); await settle(page);
}
async function clickPlan(page,x,y) {
  const host=await page.$('.konvajs-content'); const box=await host.boundingBox();
  await page.mouse.move(box.x+box.width*x,box.y+box.height*y);
  await settle(page);
  await page.mouse.down();
  await new Promise(resolve=>setTimeout(resolve,80));
  await page.mouse.up();
  // Konva identifies double-clicks by its own time window, even when the two
  // points are far apart. Space ordinary point clicks as the existing browser
  // takeoff harness does, otherwise automation itself finalizes the run.
  await new Promise(resolve=>setTimeout(resolve,650));
  await settle(page);
}
function assertStable(before,after,trigger) {
  for(const key of ['eavePoints','completedEaves','currentPage','pixelsPerMm','sheetLevels','activeTool','stageScale','stagePos','imageLoads','instanceId','timeOrigin']) assert.deepEqual(after[key],before[key],`${trigger} preserves ${key}`);
}
