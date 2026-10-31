import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import {createClient} from '@supabase/supabase-js';
import {createEstimateBuilderWorkbookDefaults} from '../lib/construction-estimation/estimateBuilderWorkbookDefaults.js';

// Three Client Selections navigation cycles and a ten-minute heap/DOM/save regression.
// Uses an isolated local job; cloud writes are blocked, existing jobs are never touched.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({path:path.join(root, '.env.local'), quiet:true});
dotenv.config({path:path.join(root, '.env'), quiet:true});
const origin = process.env.CLIENT_SELECTIONS_BASE_URL || 'http://127.0.0.1:3000';
const out = path.join(root, 'artifacts/test-artifacts/client-selections-memory');
fs.mkdirSync(out, {recursive:true});
const projectId = `local-memory-${Date.now()}`;
const defaults = createEstimateBuilderWorkbookDefaults();
for (const key of ['aiPlanTakeoffJob', 'takeoffEngine', 'takeoffSchedule', 'clientSelectionsBook']) delete defaults[key];
const jobName = 'Isolated Client Selections memory regression';
const workbook = {...defaults, templateType:'job', page:'clientSelections', projectId,
  commercialProjectId:projectId, registeredJobId:projectId,
  registeredJob:{jobId:projectId, jobName, jobNumber:'LOCAL-PLUMBING', clientName:'Local test client', siteAddress:'Local test address'},
  jobFileMeta:{projectId, jobName, jobNumber:'LOCAL-PLUMBING', clientName:'Local test client', address:'Local test address'}};
const fixture = path.join(out, 'isolated-memory-job.json');
workbook.quotation = { ELECTRICAL: { rows: [{ id: 'res-gpo', item: 'DOUBLE POWER POINT', qty: 2, unit: 'EACH', excelRate: 90, manualRate: '', materialRate: 20, labourRate: 70 }, { id: 'res-downlights', item: 'DOWNLIGHTS', qty: 24, unit: 'EACH', excelRate: 80, manualRate: '', materialRate: 10, labourRate: 70 }] }, PAINTING: { rows: [{ id: 'res-walls', item: 'Internal wall painting', qty: 100, unit: 'M2', excelRate: 25, materialRate: 5, labourRate: 20 }, { id: 'res-ceilings', item: 'Ceiling painting', qty: 80, unit: 'M2', excelRate: 20 }] } };
workbook.aiPlanTakeoffJob = { aiAnalysis: { rooms: [{ name: 'Master Bedroom', confidence: 1 }, { name: 'Bedroom 2', confidence: 1 }, { name: 'Living', confidence: 1 }] } };
const lighting=JSON.parse(fs.readFileSync('data/product-library/catalogues/residential/AU-BEACON-LIGHTING-FANS.json')).products;
const standardFan=lighting.find(p=>p.requirementKeys.includes('ceiling-fan'));
const standardLight=lighting.find(p=>/downlight/i.test(p.productName));
const hvacProducts=JSON.parse(fs.readFileSync('data/product-library/catalogues/residential/AU-RESIDENTIAL-HVAC.json')).products;
const standardAc=hvacProducts.find(p=>p.attributes.systemType==='Ducted');
workbook.quotation.ELECTRICAL.rows.push({id:'res-fans',item:'Ceiling fans',qty:4,excelRate:180,materialRate:100,labourRate:80,manualRate:''},{id:'res-alarms',item:'Smoke alarms',qty:6,excelRate:110,manualRate:''});
workbook.quotation['AIR CONDITIONING']={rows:[{id:'res-ac',item:'Ducted air conditioning',qty:1,excelRate:10000,manualRate:''}]};
workbook.standardInclusions={standardProducts:{downlight:{productCode:standardLight.productCode},'ceiling-fan':{productCode:standardFan.productCode},'smoke-alarm':{productName:'Standard Smoke Alarm C'},'air-conditioning':{productCode:standardAc.productCode}}};
if (process.env.MEMORY_JOB_FILE) {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(fs.readFileSync(process.env.MEMORY_JOB_FILE));
  const original = JSON.parse(await zip.file('estimate.json').async('string')).workbook;
  Object.assign(workbook, original, {jobId:projectId, projectId, commercialProjectId:projectId, registeredJobId:projectId, page:'clientSelections', templateType:'job'});
  workbook.registeredJob = {...workbook.registeredJob, jobId:projectId, projectId, jobName:'Isolated memory regression'};
  workbook.jobFileMeta = {...workbook.jobFileMeta, projectId, jobName:'Isolated memory regression'};
}
fs.writeFileSync(fixture, JSON.stringify({projectId, jobName, workbook}));
function artworkValues(value, found=[]) {
 if(typeof value==='string'&&value.startsWith('data:'))found.push(value);
 else if(value&&typeof value==='object')for(const child of Object.values(value))artworkValues(child,found);
 return found;
}
const expectedArtworkHash=createHash('sha256').update(JSON.stringify(artworkValues(workbook.projectEstimateBuilder))).digest('hex');
const assetModuleUrl='data:text/javascript;base64,'+fs.readFileSync(path.join(root,'components/construction-estimation/ai-plan-takeoff/planBlobStorage.js')).toString('base64');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
assert(url && anon && service, 'Existing test account authentication requires Supabase environment values.');
console.log('Authenticating isolated browser');
const admin = createClient(url, service, {auth:{persistSession:false}});
const {data:link, error:linkError} = await admin.auth.admin.generateLink({type:'magiclink', email:process.env.PRODUCT_LIBRARY_TEST_EMAIL || 'support@gr8result.com'});
if (linkError) throw linkError;
const authClient = createClient(url, anon, {auth:{persistSession:false}});
const {data:auth, error:authError} = await authClient.auth.verifyOtp({type:'magiclink', token_hash:link.properties.hashed_token});
if (authError) throw authError;
console.log('Launching isolated browser');
const browser = await puppeteer.launch({
  executablePath:process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless:true, protocolTimeout:180000, defaultViewport:{width:1920, height:1080},
});
const report = {passed:false, route:`${origin}/modules/estimate-builder?page=clientSelections`, projectId, tests:{}, screenshots:[], runtimeErrors:[], blockedCloudWrites:[]};
let page;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const selector = testId => `[data-testid="${testId}"]`;
const GUIDED_SCREENS = ['guided-client-selections-home', 'guided-interior-categories', 'guided-exterior-categories', 'guided-plumbing-fixtures-checklist', 'guided-plumbing-fixture-products'].map(id => `[data-testid="${id}"]`).join(', ');
const money = text => Number(String(text).replace(/[^0-9.-]/g, ''));

async function clickText(text, scope = 'body') {
  await waitUntil((text, scope) => [...document.querySelectorAll(`${scope} button`)]
    .some(button => !button.disabled && button.innerText.trim() === text), {}, text, scope);
  await page.evaluate((text, scope) => {
    const button = [...document.querySelectorAll(`${scope} button`)].find(button => !button.disabled && button.innerText.trim() === text);
    button.scrollIntoView({block:'center'});
    button.click();
  }, text, scope);
}

async function screenshot(name) {
  await page.screenshot({path:path.join(out, `${name}.png`)});
  report.screenshots.push(`${name}.png`);
}

async function loadLocalJob(file) {
  const input = await page.waitForSelector(selector('open-local-job-file-input'));
  await input.uploadFile(file);await input.dispose();
  // Importing the real 124 MB legacy job includes durable backup writes. Keep
  // handling dialogs while that work finishes; this is outside the timed soak.
  const deadline=Date.now()+300000;
  for (let attempt = 0; Date.now()<deadline; attempt++) {
    await delay(500);
    const labels = await page.$$eval('button', buttons => buttons.filter(button => !button.disabled).map(button => button.innerText.trim()));
    const dialogLabels = ['Discard Changes', 'Open Job', 'Open Job File', 'Keep Local'].filter(label => labels.includes(label));
    for (const label of dialogLabels) {
      // A load dialog can close between listing and clicking; click only if still present.
      await page.evaluate((text) => [...document.querySelectorAll('button')].find(button => !button.disabled && button.innerText.trim() === text)?.click(), label);
    }
    // Done only once no load dialog is left and the loaded job is showing Client Selections.
    if (!dialogLabels.length && attempt >= 1 && await exists(GUIDED_SCREENS)) return;
  }
  throw new Error('The isolated large job did not finish opening within five minutes');
}

// Deterministic in-app navigation back to the Interior / Exterior home: product screen -> category
// hub -> Interior/Exterior page -> home, waiting for each screen before the next step.
async function waitUntil(fn,options,...args) { const handle=await page.waitForFunction(fn,options,...args);await handle.dispose(); }
async function exists(selector) { return page.evaluate(s=>Boolean(document.querySelector(s)),selector); }
async function waitFor(selector,options) { const handle=await page.waitForSelector(selector,options);await handle?.dispose(); }
async function goHome() {
  const home = selector('guided-client-selections-home');
  const sidePage = '[data-testid="guided-interior-categories"], [data-testid="guided-exterior-categories"]';
  for (let guard = 0; guard < 5; guard++) {
    if (await exists(home)) return;
    if (await exists(selector('electrical-room-editor'))) {
      await page.$eval('[data-testid="electrical-all-rooms"]',e=>e.click());
    } else if (await exists(selector('electrical-schedule'))) {
      await page.$eval('[data-testid="electrical-back"]',e=>e.click());
    } else if (await exists(selector('guided-plumbing-fixture-products'))) {
      await page.$eval('.plumbingProductsHeader > button', button => button.click());
      await waitFor('.categoryHubBack');
    } else if (await exists('.categoryHubBack')) {
      await page.$eval('.categoryHubBack', button => button.click());
      await waitFor(sidePage);
    } else if (await exists(sidePage)) {
      await clickText('Back');
      await waitFor(home);
    } else {
      await clickText('Back');
      await delay(800);
    }
  }
  await waitFor(home);
}

async function openSide(side) {
  await goHome();
  await page.$eval(`[data-testid="guided-client-selections-home"] [data-category-key="${side}"]`, element => element.click());
  await waitFor(selector(`guided-${side}-categories`));
}

async function openHomeCategory(key, hubTestId, side = 'interior') {
  await openSide(side);
  await page.$eval(`[data-testid="guided-${side}-categories"] [data-category-key="${key}"]`, element => element.click());
  await waitFor(selector(hubTestId || `guided-category-${key}`));
}


const samples=[];
const processSamples=[];
let processSampler, processSampling=false;
const runFile=promisify(execFile);
let started=Date.now();
const duration=Number(process.env.MEMORY_DURATION_MS || 600000);
let sampler;
let cdp, sampling=false;
async function sample(label) {
 if(sampling && label==='interval') return;
 while(sampling) await delay(25);
 if(!page || page.isClosed()) return; sampling=true;
 try {
 const perf=await cdp.send('Performance.getMetrics');
 const dom=await cdp.send('Memory.getDOMCounters');
 const extras=await page.evaluate(()=>({pages:document.querySelectorAll('.documentPageFrame').length,mountedPages:document.querySelectorAll('[data-schedule-mounted="true"]').length,liveNodes:document.querySelectorAll('*').length,images:document.images.length,decodedImageEstimate:[...document.images].reduce((n,img)=>n+img.naturalWidth*img.naturalHeight*4,0), ...window.__memoryProbe.snapshot()}));
 const values=Object.fromEntries(perf.metrics.map(m=>[m.name,m.value]));
 const row={label,time:Date.now(),heap:values.JSHeapUsedSize,documents:values.Documents,...dom,...extras};
 samples.push(row);fs.writeFileSync(path.join(out,(process.env.MEMORY_LABEL||'after')+'.json'),JSON.stringify({samples,errors:report.runtimeErrors},null,2));console.log(JSON.stringify(row));
 } finally {sampling=false;}
}
try {
 page=await browser.newPage();page.setDefaultTimeout(90000);
 page.on('pageerror',e=>{report.runtimeErrors.push(e.stack);console.error(e.stack);});
 page.on('error',e=>{report.runtimeErrors.push(e.stack);console.error(e.stack);});
 page.on('dialog',d=>d.accept());
 page.on('response',r=>{if(r.url().includes('/_next/image?')&&r.status()>=400)report.runtimeErrors.push(`Thumbnail response ${r.status()}: ${new URL(r.url()).pathname}`);});
 await page.setRequestInterception(true);
 page.on('request',r=> {
  if(r.url().includes('/api/builders/selection-foundation') || (/\/(rest|storage)\/v1\//.test(r.url())&&!['GET','HEAD','OPTIONS'].includes(r.method())) || (r.url().includes('/api/')&&!['GET','HEAD','OPTIONS'].includes(r.method())))void r.abort();else void r.continue();
 });
 await page.evaluateOnNewDocument(({key,session})=>{
 localStorage.setItem(key,JSON.stringify(session));
 const timers=new Set(),intervals=new Set(),objectUrls=new Set();let saves=0,commits=0,clones=0,bigStringifies=0,pendingFetches=0,workbookSnapshots=0,activeSave=0,pendingSave=0,maxSaveQueue=0;const workbookRefs=new Set(),snapshotRefs=new Set();const saveTraces=[];let savedFields={};
 const createUrl=URL.createObjectURL,revokeUrl=URL.revokeObjectURL;
 URL.createObjectURL=function(...args){const url=createUrl.apply(this,args);objectUrls.add(url);return url;};
 URL.revokeObjectURL=function(url){objectUrls.delete(url);return revokeUrl.call(this,url);};
 const originalClone=window.structuredClone;
 window.structuredClone=function(value,...args){const result=originalClone.call(this,value,...args);if(value?.quotation){clones++;workbookRefs.add(new WeakRef(result));}return result;};
 const originalStringify=JSON.stringify;JSON.stringify=function(...args){const result=originalStringify.apply(this,args);if(result?.length>5000000)bigStringifies++;return result;};
 const originalFetch=window.fetch;window.fetch=function(...args){pendingFetches++;return originalFetch.apply(this,args).finally(()=>pendingFetches--);};
 const st=window.setTimeout,ct=window.clearTimeout,si=window.setInterval,ci=window.clearInterval;
 window.setTimeout=(fn,ms,...a)=>{let id=st(()=>{timers.delete(id);typeof fn==='function'?fn(...a):eval(fn);},ms);timers.add(id);return id;};
 window.clearTimeout=id=>{timers.delete(id);return ct(id);};
 window.setInterval=(fn,ms,...a)=>{const id=si(fn,ms,...a);intervals.add(id);return id;};window.clearInterval=id=>{intervals.delete(id);return ci(id);};
 const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(v,k){if(this.name==='jobs'&&String(k||v?.key||'').startsWith('job:')&&!String(k||v?.key||'').includes(':snapshot:'))saves++;return put.apply(this,arguments);};
 window.__REACT_DEVTOOLS_GLOBAL_HOOK__={supportsFiber:true,renderers:new Map(),inject(renderer){this.renderers.set(1,renderer);return 1;},onCommitFiberRoot(){commits++;},onCommitFiberUnmount(){}};
 window.__memoryProbe={workbookSnapshot:value=>{workbookSnapshots++;snapshotRefs.add(new WeakRef(value));},selectionQueue:(active,pending)=>{activeSave=active;pendingSave=pending;maxSaveQueue=Math.max(maxSaveQueue,active+pending);},trace:(type,fields)=>{saveTraces.push({type,changedFields:Object.keys(savedFields).length?Object.keys(fields).filter(k=>savedFields[k]!==fields[k]):[]});if(type==="explicit-save")savedFields=fields;if(saveTraces.length>20)saveTraces.shift();},snapshot:()=>{for(const refs of [workbookRefs,snapshotRefs])for(const ref of refs)if(!ref.deref())refs.delete(ref);return {timers:timers.size,intervals:intervals.size,saves,commits,clones,bigStringifies,pendingFetches,saveTraces,objectUrls:objectUrls.size,liveWorkbookClones:workbookRefs.size,workbookSnapshots,liveWorkbookSnapshots:snapshotRefs.size,activeSave,pendingSave,maxSaveQueue};}};
 },{key:`sb-${new URL(url).hostname.split('.')[0]}-auth-token`,session:auth.session});
 cdp=await page.createCDPSession();await cdp.send('Performance.enable');
 const browserCdp=await browser.target().createCDPSession();
 processSampler=setInterval(async()=>{
  if(processSampling)return;processSampling=true;
  try {
   const {processInfo}=await browserCdp.send('SystemInfo.getProcessInfo');
   const ids=processInfo.filter(p=>p.type==='renderer').map(p=>Number(p.id)).filter(Number.isInteger);
   if(ids.length){const {stdout}=await runFile('powershell.exe',['-NoProfile','-Command',`Get-Process -Id ${ids.join(',')} -ErrorAction SilentlyContinue | Measure-Object WorkingSet64 -Sum | Select-Object -ExpandProperty Sum`],{windowsHide:true});processSamples.push({time:Date.now(),rendererBytes:Number(stdout.trim())});}
  }catch{}finally{processSampling=false;}
 },2000);
 console.log('Opening route');
 await page.goto(report.route,{waitUntil:'domcontentloaded',timeout:180000});
 await sample('app-shell');sampler=setInterval(()=>sample('interval').catch(e=>report.runtimeErrors.push(e.message)),5000);
 console.log('Loading isolated job');await loadLocalJob(fixture);await delay(30000);await cdp.send('HeapProfiler.collectGarbage');await delay(500);await cdp.send('HeapProfiler.collectGarbage');started=Date.now();await sample('initial');
 for(let cycle=1;cycle<=3;cycle++) {
  for(const key of ['hvac','electrical-technology','cabinetry','flooring','paint-wall-finishes','lighting-fans']) {
   await goHome();await openSide('interior');
   const found=await page.evaluate(key=>{const e=document.querySelector(`[data-category-key="${key}"]`);if(e){e.click();return true;}return [...document.querySelectorAll('[data-category-key]')].map(e=>e.dataset.categoryKey);},key);
   assert.equal(found,true,`Missing category ${key}: ${JSON.stringify(found)}`);console.log('category',key,found);await delay(2500);await sample(`cycle${cycle}:${key}`);
  }
  await clickText('Review Schedule');await delay(3000);await sample(`cycle${cycle}:review`);
  const pageCount=await page.$$eval('.documentPageFrame',es=>es.length);for(let i=0;i<pageCount;i++){await page.evaluate(index=>document.querySelectorAll('.documentPageFrame')[index]?.scrollIntoView({block:'center'}),i);await delay(120);}await delay(1000);await sample(`cycle${cycle}:review-end`);
  const mounted=await page.$$eval('[data-schedule-mounted="true"]',es=>es.length);
  assert(mounted>0 && mounted<=6,'Only nearby schedule pages may be mounted');
  assert.equal(await page.$$eval('[data-schedule-mounted]',es=>es.length),pageCount,'Every page must retain scroll geometry');
  await clickText('Guided Selections');await goHome();
  if(cycle===1){
    await openSide('interior');await page.$eval('[data-category-key="electrical-technology"]',e=>e.click());await waitFor('[data-testid="electrical-room-edit"]');
    await page.$eval('[data-testid="electrical-room-edit"]',e=>e.click());await waitFor('[data-testid="electrical-qty-double-gpo-plus"]');
    const beforeProbe=await page.evaluate(()=>window.__memoryProbe.snapshot());const before=beforeProbe.saves;
    await page.$eval('[data-testid="electrical-qty-double-gpo-plus"]',e=>e.click());await page.$eval('[data-testid="electrical-save-next"]',e=>e.click());
    await waitUntil(n=>window.__memoryProbe.snapshot().saves>n,{timeout:180000},before);
    await delay(45000);const after=await page.evaluate(()=>window.__memoryProbe.snapshot().saves);
    assert.equal(after-before,1,'One selection edit must produce one job save');
    const afterProbe=await page.evaluate(()=>window.__memoryProbe.snapshot());assert.equal(afterProbe.clones-beforeProbe.clones,0,'Selection saves must not duplicate full workbook strings with structuredClone');report.tests.singleEditSaveCount=after-before;await sample('single-edit-saved');await goHome();
  }
  await delay(1000);await cdp.send('HeapProfiler.collectGarbage');await delay(500);await cdp.send('HeapProfiler.collectGarbage');await sample(`cycle${cycle}:gc`);
  const until=started+cycle*duration/3;while(Date.now()<until){await delay(Math.min(15000,until-Date.now()));}
 }
 await cdp.send('HeapProfiler.collectGarbage');await delay(500);await cdp.send('HeapProfiler.collectGarbage');await sample('final:gc');
 const checkpoints=samples.filter(s=>/cycle.*:gc|final:gc/.test(s.label));const base=checkpoints[0];const final=checkpoints.at(-1);
 assert(checkpoints.length===4,'All three navigation cycles and final GC must finish');
 assert(Date.now()-started>=duration,'Required soak duration completed');
 assert(final.heap-base.heap<Math.max(64*1024*1024,base.heap*.15),'Retained heap growth exceeds 64 MB / 15%');
 assert(final.nodes-base.nodes<200,'Retained DOM growth exceeds 200 nodes');
 assert(final.jsEventListeners-base.jsEventListeners<100,'Listener growth exceeds 100');
 assert(final.saves===base.saves,'Idle/navigation unexpectedly saved the job');
 assert.equal(final.liveWorkbookClones,0,'Saved workbook clones must be collectible');
 assert.equal(final.pendingFetches,0,'Requests must settle during idle');
 assert.equal(final.liveWorkbookSnapshots,0,'Completed save snapshots must be collectible');
 assert.equal(final.activeSave+final.pendingSave,0,'Save queue must drain');
 assert(final.maxSaveQueue<=2,'Save queue exceeds one active and one pending');
 assert.equal(final.objectUrls,base.objectUrls,'Preview object URLs must not accumulate');
 assert(Math.max(...samples.filter(s=>s.time>=started).map(s=>s.heap))<1536*1024*1024,'Transient heap exceeded 1.5 GiB; post-GC stability alone is insufficient');
 const rendererDuringSoak=processSamples.filter(s=>s.time>=started && s.time<=final.time);
 assert(rendererDuringSoak.length>0,'Renderer working-set measurements are required');
 assert(Math.max(...rendererDuringSoak.map(s=>s.rendererBytes))<2*1024*1024*1024,'Renderer working set exceeded 2 GiB during the soak');
 assert(final.timers<=base.timers+2 && final.intervals===base.intervals,'Timers must not accumulate');
 assert(!report.runtimeErrors.length,'Browser errors occurred');
 report.tests.persistedArtwork=await page.evaluate(async({projectId,assetModuleUrl,expectedArtworkHash})=>{
  let record;
  for(const info of await indexedDB.databases()) {
   if(!info.name.includes('estimate-builder-template-db'))continue;
   const db=await new Promise((resolve,reject)=>{const r=indexedDB.open(info.name);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
   try{if(db.objectStoreNames.contains('jobs'))record=await new Promise((resolve,reject)=>{const r=db.transaction('jobs').objectStore('jobs').get('job:'+projectId);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}finally{db.close();}
   if(record)break;
  }
  if(!record?.workbook)throw new Error('Isolated saved job not found');
  const {materializeTakeoffPlanPages}=await import(assetModuleUrl);
  const restored=await materializeTakeoffPlanPages({projectEstimateBuilder:record.workbook.projectEstimateBuilder});
  const values=[];function collect(v){if(typeof v==='string'&&v.startsWith('data:'))values.push(v);else if(v&&typeof v==='object')for(const child of Object.values(v))collect(child);}collect(restored.projectEstimateBuilder);
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(values)))),b=>b.toString(16).padStart(2,'0')).join('');
  if(hash!==expectedArtworkHash)throw new Error('Saved quotation artwork differs from imported original');
  return {exactArtworkRoundTrip:true,images:values.length,storedBuilderBytes:JSON.stringify(record.workbook.projectEstimateBuilder||{}).length,selectionRevision:record.workbook.clientSelectionsBook?.metadata?.selectionRevision};
 },{projectId,assetModuleUrl,expectedArtworkHash});
 report.passed=true;
 await page.screenshot({path:path.join(out,'last.png')});
} catch(e){console.error(e);report.runtimeErrors.push(e.stack);if(page&&!page.isClosed())await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});process.exitCode=1;}
finally {clearInterval(sampler);clearInterval(processSampler);fs.writeFileSync(path.join(out,(process.env.MEMORY_LABEL||'after')+'-result.json'),JSON.stringify({passed:report.passed,duration:Date.now()-started,tests:report.tests,samples,processSamples,errors:report.runtimeErrors,measurementNotes:{commits:'React root commits, not individual component renders',liveWorkbookClones:'Live structuredClone results only; excludes IndexedDB internal copies',pendingFetches:'Instrumented fetch promises; all JavaScript promises are not enumerable',catalogueObjects:'Not counted by the browser probe',images:'Decoded estimate is width*height*4 for mounted images; actual GPU/image decoder bytes are not exposed by these CDP metrics'}},null,2));await browser.close();}

