import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import ts from 'typescript';
import puppeteer from 'puppeteer';

// Actual workspace, image decoding and IndexedDB in a separate headless profile.
// Synthetic assets only; never connect to the user's browser or saved jobs.
const require = createRequire(import.meta.url);
const root = process.cwd();
const out = path.join(root, 'artifacts/test-artifacts/takeoff-plan-load');
fs.mkdirSync(out, { recursive: true });
const before = process.argv.includes('--before');
const variant = before ? 'before' : 'after';
const component = path.join(root, 'components/construction-estimation/ai-plan-takeoff/AIPlanTakeoffStandalone.jsx');
const source = fs.readFileSync(component, 'utf8');
const parsed = ts.createSourceFile(component, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
const fn = parsed.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'AIPlanTakeoffStandalone');
const indexes = {};
let index = 0;
function visit(node) {
  if (ts.isFunctionLike(node)) return;
  if (ts.isCallExpression(node) && /^(React\.)?use(State|Ref|Effect|Callback|Memo)$/.test(node.expression.getText(parsed))) {
    const d = node.parent;
    if (ts.isVariableDeclaration(d)) {
      const name = ts.isArrayBindingPattern(d.name) ? d.name.elements[0]?.name?.getText(parsed) : d.name.getText(parsed);
      if (name) indexes[name] = index;
    }
    index++;
    return;
  }
  ts.forEachChild(node, visit);
}
visit(fn.body);
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
let props={embedded:true,platformContext:{projectName:'Plan load regression'}};
const canvas=document.createElement('canvas');canvas.width=800;canvas.height=600;
const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,800,600);
ctx.strokeStyle='#334155';ctx.lineWidth=3;ctx.strokeRect(100,100,500,300);
ctx.font='22px sans-serif';ctx.fillStyle='#334155';ctx.fillText('Synthetic saved plan - Sheet 3',120,150);
const image=canvas.toDataURL('image/png');
const page=n=>({pageNumber:n,dataUrl:image,width:800,height:600,logicalWidth:800,logicalHeight:600,renderScale:1,vectorSegments:[]});
const job={takeoffId:'asset-job',jobName:'Asset-only saved job',currentPage:3,totalPages:3,rotation:0,pixelsPerMm:0.1,
plan:{type:'embedded-pages',pages:[page(1),page(2),page(3)]},sheetLevels:{3:'Second Level'},
completedWallRuns:[{id:'wall',page:3,category:'exterior',nodes:[{x:100,y:100},{x:600,y:100}],lengthMm:5000,thicknessMm:70,alignment:'outer',exteriorType:'Other'}],
completedEaves:[{id:'eave',page:3,nodes:[{x:100,y:400},{x:600,y:400}],lengthMm:5000,level:'Second Level',widthOption:'600',widthMm:600}]};
let refs;
let sequence=0;
const reads=[];
const get=IDBObjectStore.prototype.get;
IDBObjectStore.prototype.get=function(key){if(this.name==='blobs')reads.push(String(key));return get.call(this,key);};
const objectUrls=[];
const create=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{const url=create(blob);objectUrls.push(url);return url;};
function render(next){props={...props,...next};root.render(React.createElement(Workspace,props));}
function snapshot(){let hook=root._internalRoot.current.child?.memoizedState;const values=[];while(hook){values.push(hook.memoizedState);hook=hook.next;}
const result={};for(const name of ['currentPage','planPages','completedWallRuns','completedEaves','pixelsPerMm','rotation','jobName','openedTakeoffJob','planMissingFromSavedJob','eavePoints'])result[name]=values[indexes[name]];
result.planPages=result.planPages?.map(p=>({pageNumber:p.pageNumber,assetId:p.dataUrlAssetId,hasImage:Boolean(p.dataUrl),width:p.width,height:p.height,logicalWidth:p.logicalWidth,logicalHeight:p.logicalHeight,renderScale:p.renderScale}));
result.imageReady=Boolean(values[indexes.image]);result.assetReads=[...reads];result.objectUrls=[...objectUrls];result.diagnostics=window.__gr8TakeoffPlanLoadDiagnostics||[];return JSON.parse(JSON.stringify(result));}
window.harness={snapshot,job,async prepare(){refs=(await storage.externalizeTakeoffPlanPages({aiPlanTakeoffJob:job})).aiPlanTakeoffJob;return refs.plan.pages.map(p=>p.dataUrlAssetId);},
open(kind){let data=structuredClone(refs);if(kind==='missing'){data.takeoffId='missing-job';data.jobName='Missing asset job';data.plan.pages[2].dataUrlAssetId='missing-test-asset';}
if(kind==='corrupt'){data.takeoffId='corrupt-job';data.plan.pages[2].dataUrl='data:image/png;base64,bm90LWFuLWltYWdl';}
if(kind==='page'){data.currentPage=99;}
if(kind==='embedded'){data=structuredClone(job);data.plan.pages.forEach(p=>p.dataUrlAssetId='foreign-asset');}
render({openTakeoffJobRequest:{requestId:'open-'+(++sequence),jobData:data}});},
initial(kind){render({initialJob:kind==='empty'?{}:refs});},
async race(){let release;const gate=new Promise(r=>release=r);const original=Blob.prototype.text;let blocked=false;
Blob.prototype.text=async function(){if(!blocked){blocked=true;await gate;}return original.call(this);};
render({initialJob:{...refs,takeoffId:'stale-initial',jobName:'Stale initial job'}});
await new Promise(r=>setTimeout(r,100));
render({openTakeoffJobRequest:{requestId:'open-'+(++sequence),jobData:{...job,takeoffId:'newest-job',jobName:'Newest explicit job'}}});
await new Promise(r=>setTimeout(r,200));release();await new Promise(r=>setTimeout(r,150));Blob.prototype.text=original;},
clone(){render({initialJob:props.initialJob?{...props.initialJob}:null,openTakeoffJobRequest:props.openTakeoffJobRequest?{...props.openTakeoffJobRequest}:null});}};
render({});
`);
const webpackPackage = require('next/dist/compiled/webpack/webpack');
webpackPackage.init();
const webpack = webpackPackage.webpack;
await new Promise((resolve, reject) => {
  const compiler = webpack({ mode:'development', target:'web', devtool:false, context:root, entry,
    output:{path:out,filename:'browser-bundle.js'}, resolve:{extensions:['.js','.jsx','.mjs'],mainFields:['browser','module','main'],fallback:{canvas:false,fs:false,path:false,url:false}},
    module:{rules:[{test:/\.jsx$/,use:loader}]}, plugins:[new webpack.IgnorePlugin({resourceRegExp:/^node:/}),new webpack.DefinePlugin({'process.env':JSON.stringify({NEXT_PUBLIC_SUPABASE_URL:'https://placeholder.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'placeholder-anon-key'})})],optimization:{minimize:false},performance:{hints:false} });
  compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error || new Error(stats.toString({all:false,errors:true}))) : resolve()));
});
const server = http.createServer((req,res) => {
  if(req.url==='/bundle.js'){res.setHeader('Content-Type','application/javascript');fs.createReadStream(path.join(out,'browser-bundle.js')).pipe(res);}
  else {res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Isolated plan loading regression</title><style>html,body,#root{height:100%;margin:0;font-family:Arial}</style><div id="root"></div><script src="/bundle.js"></script>');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
const report={variant,scope:'Actual component; synthetic saved job; real isolated IndexedDB; no access to user profile',cases:{}};
try {
  browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,defaultViewport:{width:1500,height:1000},args:['--disable-background-networking']});
  const url=`http://127.0.0.1:${server.address().port}`;
  async function fixture(){const p=await browser.newPage();p.on('dialog',d=>d.dismiss());p.on('pageerror',e=>{(report.errors??=[]).push(e.message);});await p.setRequestInterception(true);p.on('request',r=>r.url().startsWith(url)||/^(data|blob):/.test(r.url())?r.continue():r.abort());await p.goto(url);await p.waitForFunction(()=>window.harness?.snapshot().currentPage===1);await p.evaluate(()=>harness.prepare());return p;}
  const settle=p=>p.evaluate(()=>new Promise(r=>setTimeout(r,400)));
  const p=await fixture();
  await p.evaluate(()=>harness.open('refs'));await settle(p);
  const restored=report.cases.references=await p.evaluate(()=>harness.snapshot());
  await p.screenshot({path:path.join(out,`${variant}-asset-references.png`)});
  if(before){assert.equal(restored.imageReady,false,'Reproduce blank viewer although all referenced assets exist');assert.equal(restored.assetReads.length,0,'Broken explicit-open path never calls IndexedDB asset read');console.log('BEFORE reproduced: 3 referenced pages restored, 0 asset reads, currentPage=3, imageReady=false, missing-plan warning=false.');}
  else {
    assert.equal(restored.imageReady,true);assert.equal(restored.currentPage,3);assert.ok(restored.assetReads.length>0);
    assert.equal(restored.planPages.length,3);assert.ok(restored.planPages.every(x=>x.hasImage));
    assert.deepEqual(restored.completedEaves,await p.evaluate(()=>harness.job.completedEaves));
    assert.deepEqual(restored.completedWallRuns[0].nodes,await p.evaluate(()=>harness.job.completedWallRuns[0].nodes));
    assert.equal(restored.completedWallRuns[0].lengthMm,5000);assert.equal(restored.pixelsPerMm,0.1);
    assert.equal(restored.objectUrls.length,0,'Saved pages render directly from data URLs');
    console.log('PASS asset references: IndexedDB read succeeds; 3 pages materialized; Sheet 3 rendered; geometry, lengths, calibration and page dimensions preserved; 0 object URLs needed.');
    await p.evaluate(()=>harness.open('missing'));await settle(p);
    const missing=report.cases.missing=await p.evaluate(()=>harness.snapshot());
    assert.equal(missing.openedTakeoffJob.takeoffId,'asset-job','Failed open preserves previous complete workspace');
    assert.match(await p.$eval('body',x=>x.innerText),/missing-test-asset/);
    await p.screenshot({path:path.join(out,'after-missing-asset-error.png')});
    console.log('PASS missing asset: specific visible error; previous plan and overlays preserved.');
    await p.evaluate(()=>harness.open('corrupt'));await settle(p);
    assert.match(await p.$eval('body',x=>x.innerText),/decode|image/i);
    assert.equal((await p.evaluate(()=>harness.snapshot())).openedTakeoffJob.takeoffId,'asset-job');
    console.log('PASS invalid image: decode failure is visible and cannot partially replace the workspace.');
    await p.evaluate(()=>harness.open('page'));await settle(p);
    assert.equal((await p.evaluate(()=>harness.snapshot())).currentPage,1);
    assert.equal((await p.evaluate(()=>harness.snapshot())).imageReady,true);
    console.log('PASS invalid saved currentPage: selects an existing sheet without renumbering overlays.');
    const readCount=(await p.evaluate(()=>harness.snapshot())).assetReads.length;
    await p.evaluate(()=>harness.open('embedded'));await settle(p);
    assert.equal((await p.evaluate(()=>harness.snapshot())).assetReads.length,readCount);
    console.log('PASS portable embedded images: foreign asset IDs do not trigger local asset reads.');
    const q=await fixture();await q.evaluate(()=>harness.initial('empty'));await settle(q);await q.evaluate(()=>harness.initial('refs'));await settle(q);
    report.cases.lateInitial=await q.evaluate(()=>harness.snapshot());assert.equal(report.cases.lateInitial.imageReady,true);
    console.log('PASS delayed initial job: an empty placeholder does not consume the restore.');
    const r=await fixture();await r.evaluate(()=>harness.race());await settle(r);
    report.cases.race=await r.evaluate(()=>harness.snapshot());assert.equal(report.cases.race.openedTakeoffJob.takeoffId,'newest-job');assert.equal(report.cases.race.imageReady,true);
    await r.evaluate(()=>harness.clone());await settle(r);assert.equal((await r.evaluate(()=>harness.snapshot())).openedTakeoffJob.takeoffId,'newest-job');
    console.log('PASS restore race: a delayed old asset read and prop replay cannot replace the newest explicit job.');
    assert.deepEqual(report.errors||[],[],'No uncaught browser errors');
  }
} finally {fs.writeFileSync(path.join(out,`${variant}-browser-report.json`),JSON.stringify(report,null,2));await browser?.close();await new Promise(r=>server.close(r));}
