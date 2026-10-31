import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import {createClient} from '@supabase/supabase-js';
import {createEstimateBuilderWorkbookDefaults} from '../lib/construction-estimation/estimateBuilderWorkbookDefaults.js';

// Plumbing Fixtures: product -> room allocations -> quantity -> totals, in the running app.
// Uses an isolated local job; cloud writes are blocked, existing jobs are never touched.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({path:path.join(root, '.env.local'), quiet:true});
dotenv.config({path:path.join(root, '.env'), quiet:true});
const origin = process.env.CLIENT_SELECTIONS_BASE_URL || 'http://localhost:3000';
const out = path.join(root, 'artifacts/test-artifacts/builder-standard-hvac-browser');
fs.mkdirSync(out, {recursive:true});
const projectId = `local-standard-hvac-${Date.now()}`;
const defaults = createEstimateBuilderWorkbookDefaults();
for (const key of ['aiPlanTakeoffJob', 'takeoffEngine', 'takeoffSchedule', 'clientSelectionsBook']) delete defaults[key];
const jobName = 'Local plumbing allocation regression';
const workbook = {...defaults, templateType:'job', page:'clientSelections', projectId,
  commercialProjectId:projectId, registeredJobId:projectId,
  registeredJob:{jobId:projectId, jobName, jobNumber:'LOCAL-PLUMBING', clientName:'Local test client', siteAddress:'Local test address'},
  jobFileMeta:{projectId, jobName, jobNumber:'LOCAL-PLUMBING', clientName:'Local test client', address:'Local test address'}};
const fixture = path.join(out, 'local-plumbing-job.json');
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
fs.writeFileSync(fixture, JSON.stringify({projectId, jobName, workbook}));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
assert(url && anon && service, 'Existing test account authentication requires Supabase environment values.');
const admin = createClient(url, service, {auth:{persistSession:false}});
const {data:link, error:linkError} = await admin.auth.admin.generateLink({type:'magiclink', email:process.env.PRODUCT_LIBRARY_TEST_EMAIL || 'support@gr8result.com'});
if (linkError) throw linkError;
const authClient = createClient(url, anon, {auth:{persistSession:false}});
const {data:auth, error:authError} = await authClient.auth.verifyOtp({type:'magiclink', token_hash:link.properties.hashed_token});
if (authError) throw authError;
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
  await page.waitForFunction((text, scope) => [...document.querySelectorAll(`${scope} button`)]
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
  await input.uploadFile(file);
  for (let attempt = 0; attempt < 8; attempt++) {
    await delay(500);
    const labels = await page.$$eval('button', buttons => buttons.filter(button => !button.disabled).map(button => button.innerText.trim()));
    const dialogLabels = ['Discard Changes', 'Open Job', 'Open Job File', 'Keep Local'].filter(label => labels.includes(label));
    for (const label of dialogLabels) {
      // A load dialog can close between listing and clicking; click only if still present.
      await page.evaluate((text) => [...document.querySelectorAll('button')].find(button => !button.disabled && button.innerText.trim() === text)?.click(), label);
    }
    // Done only once no load dialog is left and the loaded job is showing Client Selections.
    if (!dialogLabels.length && attempt >= 1 && await page.$(GUIDED_SCREENS)) return;
  }
  await page.waitForSelector(GUIDED_SCREENS);
}

// Deterministic in-app navigation back to the Interior / Exterior home: product screen -> category
// hub -> Interior/Exterior page -> home, waiting for each screen before the next step.
async function goHome() {
  const home = selector('guided-client-selections-home');
  const sidePage = '[data-testid="guided-interior-categories"], [data-testid="guided-exterior-categories"]';
  for (let guard = 0; guard < 5; guard++) {
    if (await page.$(home)) return;
    if (await page.$(selector('guided-plumbing-fixture-products'))) {
      await page.$eval('.plumbingProductsHeader > button', button => button.click());
      await page.waitForSelector('.categoryHubBack');
    } else if (await page.$('.categoryHubBack')) {
      await page.$eval('.categoryHubBack', button => button.click());
      await page.waitForSelector(sidePage);
    } else if (await page.$(sidePage)) {
      await clickText('Back');
      await page.waitForSelector(home);
    } else {
      await clickText('Back');
      await delay(800);
    }
  }
  await page.waitForSelector(home);
}

async function openSide(side) {
  await goHome();
  await page.$eval(`[data-testid="guided-client-selections-home"] [data-category-key="${side}"]`, element => element.click());
  await page.waitForSelector(selector(`guided-${side}-categories`));
}

async function openHomeCategory(key, hubTestId, side = 'interior') {
  await openSide(side);
  await page.$eval(`[data-testid="guided-${side}-categories"] [data-category-key="${key}"]`, element => element.click());
  await page.waitForSelector(selector(hubTestId || `guided-category-${key}`));
}

async function savedLocalRecord() {
  return page.evaluate(async key => {
    const records = [];
    for (const {name} of await indexedDB.databases()) {
      if (!name.includes('estimate-builder-template-db')) continue;
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(name);
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      });
      try {
        if (!db.objectStoreNames.contains('jobs')) continue;
        const record = await new Promise((resolve, reject) => {
          const request = db.transaction('jobs', 'readonly').objectStore('jobs').getAll();
          request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
        });
        if (record) records.push(...record.filter(r=>r.key===key || r.workbook?.registeredJob?.jobName==='Local plumbing allocation regression' || r.workbook?.jobFileMeta?.jobName==='Local plumbing allocation regression'));
      } finally { db.close(); }
    }
    return records.sort((a,b) => String(b.savedAt || b.workbook?.savedAt).localeCompare(String(a.savedAt || a.workbook?.savedAt)))[0];
  }, `job:${projectId}`);
}

try {
  page = await browser.newPage();
  page.setDefaultTimeout(45000);
  page.on('pageerror', error => report.runtimeErrors.push(error.stack || error.message));
  page.on('dialog', dialog => dialog.accept());
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (request.url().includes('/api/builders/selection-foundation')) { void request.abort(); return; }
    if (/\/(rest|storage)\/v1\//.test(request.url()) && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      report.blockedCloudWrites.push({method:request.method(), path:new URL(request.url()).pathname});
      void request.abort();
    } else void request.continue();
  });
  await page.evaluateOnNewDocument(({key, session}) => localStorage.setItem(key, JSON.stringify(session)), {
    key:`sb-${new URL(url).hostname.split('.')[0]}-auth-token`, session:auth.session,
  });
  await page.goto(report.route, {waitUntil:'domcontentloaded', timeout:180000});
  await loadLocalJob(fixture);


  console.log('Browser: local job opened');
  await openHomeCategory('electrical-technology','electrical-schedule');
  const smoke=await page.$eval('[data-testid="electrical-standard-fixtures"]',e=>e.innerText);
  assert(smoke.includes('Standard Smoke Alarm C') && smoke.includes('Qty 6'));
  report.tests.smokeStandardIncluded=true;
  await page.$eval('[data-testid="electrical-back"]',b=>b.click());
  await openHomeCategory('lighting-fans','guided-category-lighting-fans');
  await page.$eval('[data-testid="guided-requirement-ceiling-fan"] button.primary',b=>b.click());
  await page.waitForSelector('[data-testid="standard-included-card"]');
  assert((await page.$eval('.standardRange',e=>e.innerText)).includes(standardFan.productName));
  report.tests.standardPreselected=true;
  await page.$eval('.products article button:last-child',b=>b.click());
  await page.waitForSelector('.dialog');
  const selects=await page.$$('.dialog select');
  await selects.at(-1).select('Master Bedroom');
  await clickText('Save selection','.dialog');
  await page.waitForFunction(()=>!document.querySelector('.dialog'));
  await clickText('Save Progress');
  await delay(2000);
  let record;
  for(let attempt=0;attempt<60;attempt++){record=await savedLocalRecord();if(record?.workbook?.clientSelectionsBook?.rooms.flatMap(r=>r.rows||[]).some(r=>r.guidedSelection?.requirementKey==='ceiling-fan' && r.guidedSelection.plumbingAllocation?.lines.some(l=>!l.isBuilderStandard)))break;await delay(500);}
  report.tests.savedRecordIdentity={key:record?.key,projectId:record?.workbook?.projectId};
  let fan=record?.workbook?.clientSelectionsBook?.rooms.flatMap(r=>r.rows||[]).find(r=>r.guidedSelection?.requirementKey==='ceiling-fan')?.guidedSelection;
  assert.equal(fan?.plumbingAllocation.lines.reduce((n,l)=>n+l.quantity,0),4);
  assert.equal(fan.plumbingAllocation.lines.find(l=>l.isBuilderStandard).quantity,3);
  assert.equal(record.workbook.quotation.ELECTRICAL.rows.filter(r=>r.id==='res-fans').length,1);
  assert(record.workbook.quotation.ELECTRICAL.rows.find(r=>r.id==='res-fans').selectedProducts?.length===2);
  report.tests.roomOverrideAndQuotePersistence=true;
  await screenshot('standard-fan-room-upgrade');
  await page.$eval('.standardRange > button',b=>b.click());
  await openHomeCategory('hvac','guided-category-hvac');
  const img=await page.$eval('[data-testid="guided-requirement-air-conditioning"] img',i=>({src:i.getAttribute('src'),width:i.naturalWidth}));
  assert.equal(img.src,'/images/client-selections/air-conditioning.webp');assert(img.width>0);report.tests.hvacImage=true;
  await screenshot('hvac-home');
  await page.$eval('[data-testid="guided-requirement-air-conditioning"] button.primary',b=>b.click());
  await page.waitForSelector('[data-testid="builder-standard-range-air-conditioning"]');
  await page.select('.filters select','all');
  assert.equal(await page.$$eval('.products article',a=>a.length),6);assert(!(await page.$eval('.products',e=>e.innerText)).includes('$0.00'));report.tests.hvacRange=true;
  await page.$$eval('.products article',cards=>cards.find(c=>c.innerText.includes('S-140PE3R')).querySelector('button:last-child').click());
  await page.waitForSelector('.dialog');assert(!(await page.$eval('.dialog',e=>e.innerText)).includes('Project room'));
  await clickText('Save selection','.dialog');await page.waitForFunction(()=>!document.querySelector('.dialog'));
  await clickText('Save Progress');await delay(2000);
  for(let attempt=0;attempt<60;attempt++){record=await savedLocalRecord();if(record?.workbook?.quotation?.['AIR CONDITIONING']?.rows?.[0]?.selectedProducts?.some(p=>!p.isBuilderStandard))break;await delay(500);}
  assert.equal(record.workbook.quotation['AIR CONDITIONING'].rows.length,1);
  const ac=record.workbook.quotation['AIR CONDITIONING'].rows[0];assert.equal(ac.selectedProducts[0].hvac.systemType,'Ducted');assert.equal(ac.selectedProducts[0].hvac.designCapacityKw,null);
  report.tests.ductedProjectLevelAndNoDuplicateQuote=true;console.log('Browser: ducted selection saved to existing quote');
  await screenshot('hvac-upgrade');
  await page.reload({waitUntil:'domcontentloaded',timeout:180000});await delay(2000);
  record=await savedLocalRecord();assert.equal(record.workbook.quotation['AIR CONDITIONING'].rows.length,1);assert.equal(record.workbook.quotation['AIR CONDITIONING'].rows[0].selectedProducts[0].hvac.systemType,'Ducted');
  await page.waitForSelector('[data-testid="builder-standard-range-air-conditioning"]',{timeout:90000});
  assert((await page.$eval('[aria-label="Current selections"]',e=>e.innerText)).includes('S-140PE3R'));
  report.tests.reload=true;
  await page.$$eval('.products article',cards=>cards.find(c=>c.innerText.includes('SET-ASTH09KNCA')).querySelector('button:last-child').click());
  await page.waitForSelector('.dialog');
  const splitSelects=await page.$$('.dialog select');
  const roomOptions=await splitSelects.at(-1).evaluate(e=>[...e.options].map(o=>o.value));
  assert(roomOptions.includes('Master Bedroom') && roomOptions.includes('Living'));
  await splitSelects.at(-1).select('Master Bedroom');
  await clickText('Save selection','.dialog');await page.waitForFunction(()=>!document.querySelector('.dialog'));
  await clickText('Save Progress');
  for(let attempt=0;attempt<60;attempt++){record=await savedLocalRecord();if(record?.workbook?.quotation?.['AIR CONDITIONING']?.rows?.[0]?.selectedProducts?.[0]?.hvac?.systemType==='Split')break;await delay(500);}
  const splitRow=record.workbook.quotation['AIR CONDITIONING'].rows[0];
  assert.equal(splitRow.selectedProducts[0].hvac.systemType,'Split');assert.equal(splitRow.selectedProducts[0].allocations[0].location,'Master Bedroom');
  assert.equal(record.workbook.quotation['AIR CONDITIONING'].rows.length,1);
  report.tests.splitCanonicalRoomAndReplacement=true;
  await screenshot('split-system-room');
  await page.goto(`${origin}/modules/estimate-builder?page=productLibrary&browse=all&catalogueSection=hvac`,{waitUntil:'domcontentloaded',timeout:180000});
  await page.waitForSelector('.catalogue-items-row',{timeout:90000});
  assert.equal(await page.$$eval('.catalogue-items-row',rows=>rows.length),6);
  await page.$eval('button[data-catalogue-subcategory="split-systems"]',b=>b.click());
  await page.waitForFunction(()=>document.querySelectorAll('.catalogue-items-row').length===3);
  await page.$eval('button[data-catalogue-subcategory="ducted-systems"]',b=>b.click());
  await page.waitForFunction(()=>document.querySelectorAll('.catalogue-items-row').length===3 && [...document.querySelectorAll('.catalogue-items-row')].every(r=>r.dataset.catalogueSubcategory==='ducted-systems'));
  report.tests.productLibraryTaxonomy=true;
  await screenshot('hvac-product-library');
  report.passed=!report.runtimeErrors.length;assert(report.passed,report.runtimeErrors.join('\n'));
} catch(error) {report.error=error.stack;if(page)await screenshot('failure').catch(()=>{});process.exitCode=1;}
finally {fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,tests:report.tests,error:report.error,runtimeErrors:report.runtimeErrors},null,2));await browser.close();}
