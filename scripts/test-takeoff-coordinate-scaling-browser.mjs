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
const out = path.join(root, 'artifacts/test-artifacts/takeoff-coordinate-scaling');
const componentPath = path.join(root, 'components/construction-estimation/ai-plan-takeoff/AIPlanTakeoffStandalone.jsx');
const variant = process.argv.includes('--before') ? 'before' : 'after';
const sourcePath = variant === 'before' ? path.join(out, 'AIPlanTakeoffStandalone.before.txt') : componentPath;
const componentSource = fs.readFileSync(sourcePath, 'utf8');
const expectedNodes = [{ x: 200, y: 200 }, { x: 600, y: 200 }];
const expectedPixelLength = 400;
const calibration = 0.1;
const report = {
  scope: 'Actual component and real pointer events on one known synthetic horizontal plan line; no vector snapping; fixed calibration; isolated browser storage.',
  variant, sourcePath,
  sourceSha256: crypto.createHash('sha256').update(componentSource).digest('hex'),
  expectedNodes, expectedPixelLength, pixelsPerMm: calibration,
  expectedLengthM: expectedPixelLength / calibration / 1000,
  cases: [], errors: [],
};
const output = [];
function log(message) { output.push(message); console.log(message); }
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, `component-source.${variant}.txt`), componentSource);

// Hooks are read or their public dispatch functions invoked only in this owned
// test root. The component and its coordinate/calibration code stay untouched.
function hookIndexes(source) {
  const parsed = ts.createSourceFile(componentPath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  const component = parsed.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'AIPlanTakeoffStandalone');
  assert.ok(component);
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
  return indexes;
}

const loaderPath = path.join(out, 'jsx-loader.cjs');
fs.writeFileSync(loaderPath, `const fs=require('node:fs'); const ts=require(${JSON.stringify(require.resolve('typescript'))});\nmodule.exports=function(source){if(this.resourcePath===${JSON.stringify(componentPath)})source=fs.readFileSync(${JSON.stringify(path.join(out,`component-source.${variant}.txt`))},'utf8');return ts.transpileModule(source,{fileName:this.resourcePath,compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;};\n`);
const entryPath = path.join(out, 'entry.cjs');
fs.writeFileSync(entryPath, `
const React=require('react');
const {createRoot}=require('react-dom/client');
const Takeoff=require(${JSON.stringify(componentPath)}).default;
const {createJobData}=require(${JSON.stringify(path.join(path.dirname(componentPath),'jobPersistence.js'))});
const indexes=${JSON.stringify(hookIndexes(componentSource))};
const knownNodes=${JSON.stringify(expectedNodes)};
const renderScale=Number(new URLSearchParams(location.search).get('renderScale')||1);
const canvas=document.createElement('canvas');canvas.width=1000*renderScale;canvas.height=800*renderScale;
const ctx=canvas.getContext('2d');ctx.scale(renderScale,renderScale);ctx.fillStyle='#fff';ctx.fillRect(0,0,1000,800);
ctx.strokeStyle='#0f172a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(200,200);ctx.lineTo(600,200);ctx.stroke();
for(const point of knownNodes){ctx.beginPath();ctx.moveTo(point.x,point.y-8);ctx.lineTo(point.x,point.y+8);ctx.stroke();}
ctx.font='16px sans-serif';ctx.fillStyle='#334155';ctx.fillText('Known 400 logical pixel line (4.000 m at 0.100 px/mm)',180,170);
const dataUrl=canvas.toDataURL('image/png');
const pages=[1,2,3].map(pageNumber=>({pageNumber,dataUrl,width:canvas.width,height:canvas.height,logicalWidth:1000,logicalHeight:800,renderScale,vectorSegments:[]}));
const job=createJobData({name:'Coordinate regression',takeoffId:'synthetic-coordinate-test',currentPage:3,totalPages:3,pixelsPerMm:${calibration},planPages:pages,sheetLevels:{3:'Second Level'},planFilename:'synthetic-coordinate-plan.png'});
const reactRoot=createRoot(document.getElementById('root'));
function hooks(){const result=[];let hook=reactRoot._internalRoot.current.child?.memoizedState;while(hook){result.push(hook);hook=hook.next;}return result;}
function value(name){return hooks()[indexes[name]]?.memoizedState;}
function dispatch(name,next){const hook=hooks()[indexes[name]];if(!hook?.queue?.dispatch)throw Error('Missing state dispatch '+name);hook.queue.dispatch(next);}
function snapshot(){
 const state={};for(const key of ['eavePoints','completedEaves','measurePoints','completedMeasurements','pixelsPerMm','currentPage','sheetLevels','stageScale','stagePos','rotation','activeTool'])state[key]=value(key);
 const stage=value('stageRef')?.current,layer=value('layerRef')?.current;
 const rect=stage?.content?.getBoundingClientRect();
 return {...JSON.parse(JSON.stringify(state)),imageReady:Boolean(value('image')),vectorSegments:value('vectorSegments')?.length,
  actualStage:stage?{scale:stage.scaleX(),x:stage.x(),y:stage.y(),width:stage.width(),height:stage.height()}:null,
  layerTransform:layer?.getAbsoluteTransform().getMatrix(),canvasRect:rect?{x:rect.x,y:rect.y,width:rect.width,height:rect.height}:null,
  devicePixelRatio:window.devicePixelRatio,renderScale,raster:{width:canvas.width,height:canvas.height},lastClick:window.__gr8LastAiPlanTakeoffClick||null};
}
window.__coordinateHarness={snapshot,
 setView({zoom,pan,rotation}){value('sheetViewStateRef').current[3]={scale:zoom,pos:pan};dispatch('rotation',rotation);dispatch('stageScale',zoom);dispatch('stagePos',pan);},
 setCssScale(scale){const host=value('canvasHostRef').current;host.style.transformOrigin='0 0';host.style.transform='scale('+scale+')';},
 visiblePoints(){const stage=value('stageRef').current,layer=value('layerRef').current,rect=stage.content.getBoundingClientRect();return knownNodes.map(point=>{const visible=layer.getAbsoluteTransform().point(point);return {plan:point,stage:visible,client:{x:rect.left+visible.x*rect.width/stage.width(),y:rect.top+visible.y*rect.height/stage.height()}};});},
};
reactRoot.render(React.createElement(Takeoff,{embedded:true,openTakeoffJobRequest:{requestId:'synthetic-coordinate-open',jobData:job},platformContext:{projectName:'Coordinate regression'}}));
`);

const webpackPackage = require('next/dist/compiled/webpack/webpack');
webpackPackage.init();
const webpack = webpackPackage.webpack;
await new Promise((resolve,reject)=>{
  const compiler=webpack({mode:'development',target:'web',devtool:false,context:root,entry:entryPath,output:{path:out,filename:'bundle.js'},
    resolve:{extensions:['.js','.jsx','.mjs'],mainFields:['browser','module','main'],fallback:{canvas:false,fs:false,path:false,url:false}},
    module:{rules:[{test:/\.jsx$/,use:[loaderPath]}]},plugins:[new webpack.IgnorePlugin({resourceRegExp:/^node:/}),new webpack.DefinePlugin({'process.env':JSON.stringify({NEXT_PUBLIC_SUPABASE_URL:'https://placeholder.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'placeholder-anon-key'})})],optimization:{minimize:false},performance:{hints:false}});
  compiler.run((error,stats)=>{const summary=stats?.toJson({all:false,errors:true,warnings:true});fs.writeFileSync(path.join(out,'build.json'),JSON.stringify(summary||{error:String(error)},null,2));compiler.close(()=>{});if(error||stats?.hasErrors())reject(error||Error(JSON.stringify(summary.errors)));else resolve();});
});
log(`Built ${variant} actual-component coordinate-scaling browser bundle.`);

const server=http.createServer((req,res)=>{
  if(req.url==='/bundle.js'){res.setHeader('Content-Type','application/javascript');fs.createReadStream(path.join(out,'bundle.js')).pipe(res);}
  else{res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta charset="utf-8"><title>Takeoff coordinate regression</title><style>html,body,#root{height:100%;margin:0}body{font-family:Arial,sans-serif}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');}
});
let browser;
let page;
try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,userDataDir:path.join(out,'isolated-browser-'+Date.now()),args:['--no-first-run','--disable-extensions','--disable-background-networking'],defaultViewport:{width:1800,height:1200}});
  const scenarios=[...[0,90].flatMap(rotation=>[0.75,1,1.5].map(zoom=>({rotation,zoom,cssScale:1}))),{rotation:0,zoom:1,cssScale:0.75},
    {rotation:270,zoom:1,cssScale:1,deviceScaleFactor:0.75,renderScale:4.5},{rotation:270,zoom:1,cssScale:1,deviceScaleFactor:2,renderScale:4.5}];
  for(const {rotation,zoom,cssScale,deviceScaleFactor=1,renderScale=1} of scenarios){
    page=await browser.newPage();
    await page.setViewport({width:1800,height:1200,deviceScaleFactor});
    page.on('pageerror',error=>report.errors.push(error.message));
    page.on('dialog',dialog=>dialog.dismiss());
    await page.setRequestInterception(true);
    page.on('request',request=>request.url().startsWith(origin)||request.url().startsWith('data:')||request.url().startsWith('blob:')?request.continue():request.abort());
    await page.goto(origin+'/?renderScale='+renderScale,{waitUntil:'load',timeout:60000});
    await page.waitForFunction(()=>window.__coordinateHarness?.snapshot().imageReady&&window.__coordinateHarness.snapshot().currentPage===3);
    await page.evaluate(view=>window.__coordinateHarness.setView(view),{zoom,pan:{x:60,y:48},rotation});
    await settle();
    if(cssScale!==1){await page.evaluate(scale=>window.__coordinateHarness.setCssScale(scale),cssScale);await settle();}
    const initial=await snapshot();
    assert.equal(initial.stageScale,zoom);assert.equal(initial.rotation,rotation);assert.equal(initial.pixelsPerMm,calibration);assert.equal(initial.vectorSegments,0);
    const visiblePoints=await page.evaluate(()=>window.__coordinateHarness.visiblePoints());
    const row={zoom,rotation,cssScale,deviceScaleFactor,renderScale,initial,visiblePoints};report.cases.push(row);
    await button('Measure');
    for(const point of visiblePoints)await click(point.client);
    await page.waitForFunction(()=>window.__coordinateHarness.snapshot().completedMeasurements.length===1);
    row.afterMeasure=await snapshot();
    await button('Eaves');
    for(const point of visiblePoints)await click(point.client);
    await page.waitForFunction(()=>window.__coordinateHarness.snapshot().eavePoints.length===2);
    row.beforeEaveFinalize=await snapshot();
    await button('Finish Eaves Run');
    await page.waitForFunction(()=>window.__coordinateHarness.snapshot().completedEaves.length===1);
    row.afterEave=await snapshot();
    const measure=row.afterMeasure.completedMeasurements[0];
    const eave=row.afterEave.completedEaves[0];
    row.measureNodes=[measure.p1,measure.p2];row.eaveNodes=eave.nodes;
    row.measurePixelLength=Math.hypot(measure.p2.x-measure.p1.x,measure.p2.y-measure.p1.y);
    row.eavePixelLength=Math.hypot(eave.nodes[1].x-eave.nodes[0].x,eave.nodes[1].y-eave.nodes[0].y);
    row.measureLengthM=row.measurePixelLength/calibration/1000;row.eaveStoredLengthM=eave.lengthMm/1000;
    row.measureOverEaveRatio=row.measurePixelLength/row.eavePixelLength;
    log(`Zoom ${zoom*100}%, rotation ${rotation}, CSS scale ${cssScale}, DPR ${deviceScaleFactor}, raster scale ${renderScale}: Measure ${row.measurePixelLength.toFixed(6)} px / ${row.measureLengthM.toFixed(6)} m; Eave ${row.eavePixelLength.toFixed(6)} px / ${row.eaveStoredLengthM.toFixed(6)} m; ratio ${row.measureOverEaveRatio.toFixed(6)}; calibration ${row.afterEave.pixelsPerMm}.`);
    for(let i=0;i<2;i++)for(const axis of ['x','y']){
      close(row.measureNodes[i][axis],expectedNodes[i][axis],`Measure node ${i}.${axis}`);
      close(row.eaveNodes[i][axis],expectedNodes[i][axis],`Eave node ${i}.${axis}`);
    }
    close(row.measurePixelLength,expectedPixelLength,'Measure pixel length');close(row.eavePixelLength,expectedPixelLength,'Eave pixel length');
    close(row.eaveStoredLengthM,4,'Stored eave metres');close(row.measureOverEaveRatio,1,'Measure/Eave ratio');
    assert.equal(row.afterEave.pixelsPerMm,calibration,'Measurement never changes calibration');
    assert.equal(row.afterEave.stageScale,zoom,'Measurement never changes zoom');
    assert.deepEqual(row.afterEave.stagePos,{x:60,y:48},'Measurement never changes pan');
    await page.screenshot({path:path.join(out,`${variant}-zoom-${zoom}-rotation-${rotation}-css-${cssScale}-dpr-${deviceScaleFactor}.png`)});
    await page.close();page=null;
  }

  // Continue one actual unfinished eave while its viewing transform changes.
  // Only the test's view state changes; both nodes still come from mouse clicks.
  page=await browser.newPage();
  await page.setViewport({width:1800,height:1200,deviceScaleFactor:1});
  page.on('pageerror',error=>report.errors.push(error.message));
  page.on('dialog',dialog=>dialog.dismiss());
  await page.setRequestInterception(true);
  page.on('request',request=>request.url().startsWith(origin)||request.url().startsWith('data:')||request.url().startsWith('blob:')?request.continue():request.abort());
  await page.goto(origin,{waitUntil:'load',timeout:60000});
  await page.waitForFunction(()=>window.__coordinateHarness?.snapshot().imageReady&&window.__coordinateHarness.snapshot().currentPage===3);
  await page.evaluate(view=>window.__coordinateHarness.setView(view),{zoom:0.75,pan:{x:60,y:48},rotation:0});
  await settle();await button('Eaves');
  const transition={kind:'eave-mid-draft-view-change',initial:await snapshot()};report.cases.push(transition);
  transition.initialVisiblePoints=await page.evaluate(()=>window.__coordinateHarness.visiblePoints());
  await click(transition.initialVisiblePoints[0].client);
  await page.waitForFunction(()=>window.__coordinateHarness.snapshot().eavePoints.length===1);
  transition.firstPoint=await snapshot();
  await page.evaluate(view=>window.__coordinateHarness.setView(view),{zoom:1.5,pan:{x:20,y:10},rotation:0});
  await settle();transition.afterViewChange=await snapshot();
  assert.deepEqual(transition.afterViewChange.eavePoints,transition.firstPoint.eavePoints,'Changing zoom and pan preserves the unfinished first node');
  transition.updatedVisiblePoints=await page.evaluate(()=>window.__coordinateHarness.visiblePoints());
  await click(transition.updatedVisiblePoints[1].client);
  await page.waitForFunction(()=>window.__coordinateHarness.snapshot().eavePoints.length===2);
  transition.beforeFinalize=await snapshot();
  await button('Finish Eaves Run');
  await page.waitForFunction(()=>window.__coordinateHarness.snapshot().completedEaves.length===1);
  transition.afterFinalize=await snapshot();
  const transitionEave=transition.afterFinalize.completedEaves[0];
  transition.eaveNodes=transitionEave.nodes;
  transition.eavePixelLength=Math.hypot(transitionEave.nodes[1].x-transitionEave.nodes[0].x,transitionEave.nodes[1].y-transitionEave.nodes[0].y);
  transition.eaveStoredLengthM=transitionEave.lengthMm/1000;
  for(let i=0;i<2;i++)for(const axis of ['x','y'])close(transition.eaveNodes[i][axis],expectedNodes[i][axis],`Mid-run node ${i}.${axis}`);
  close(transition.eavePixelLength,400,'Mid-run zoom change pixel length');close(transition.eaveStoredLengthM,4,'Mid-run zoom change stored metres');
  assert.equal(transition.afterFinalize.pixelsPerMm,calibration);
  assert.equal(transition.afterFinalize.stageScale,1.5);
  assert.deepEqual(transition.afterFinalize.stagePos,{x:20,y:10});
  await page.screenshot({path:path.join(out,`${variant}-eave-mid-draft-view-change.png`)});
  log(`Mid-draft Eave zoom 75% -> 150%, pan (60,48) -> (20,10): first node preserved; ${transition.eavePixelLength.toFixed(6)} px / ${transition.eaveStoredLengthM.toFixed(6)} m; calibration ${transition.afterFinalize.pixelsPerMm}.`);
  await page.close();page=null;

  assert.deepEqual(report.errors,[],'No browser runtime errors');report.ok=true;
  log('Takeoff coordinate-scaling browser checks passed: real Measure and Eave clicks preserve plan coordinates across stage zoom, pan, rotation, CSS scaling, DPR, raster render scale, and a zoom/pan change during an unfinished eave.');
}catch(error){report.error=error.stack||String(error);if(page){report.failureState=await snapshot().catch(()=>null);await page.screenshot({path:path.join(out,`${variant}-failure.png`)}).catch(()=>{});}throw error;}
finally{fs.writeFileSync(path.join(out,`coordinate-report.${variant}.json`),JSON.stringify(report,null,2));fs.writeFileSync(path.join(out,`test-output.${variant}.txt`),output.join('\n')+'\n'+(report.ok?'Exit code: 0':'FAILED: '+report.error)+'\n');await browser?.close();await new Promise(resolve=>server.listening?server.close(resolve):resolve());}

function close(actual,expected,label){assert.ok(Math.abs(actual-expected)<0.00001,`${label}: expected ${expected}, received ${actual}`);}
async function snapshot(){return page.evaluate(()=>window.__coordinateHarness.snapshot());}
async function settle(){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function button(text){const found=await page.evaluate(label=>{const button=[...document.querySelectorAll('button')].find(el=>el.textContent.trim()===label||(label==='Finish Eaves Run'&&el.textContent.trim().startsWith(label)));if(!button)return false;button.click();return true;},text);assert.ok(found,'Find '+text+' button');await settle();}
async function click(point){await page.mouse.move(point.x,point.y);await settle();await page.mouse.down();await new Promise(resolve=>setTimeout(resolve,80));await page.mouse.up();await new Promise(resolve=>setTimeout(resolve,650));await settle();}
