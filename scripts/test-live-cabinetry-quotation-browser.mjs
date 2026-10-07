import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import {createClient} from '@supabase/supabase-js';
import {FINAL_CABINETRY as source} from '../lib/construction-estimation/finalCabinetryQuotation.js';

dotenv.config({path:'.env.local',quiet:true});dotenv.config({path:'.env',quiet:true});
const origin=process.env.CLIENT_SELECTIONS_BASE_URL || 'http://localhost:3000';
const out=path.resolve('artifacts/test-artifacts/live-cabinetry-quotation');fs.mkdirSync(out,{recursive:true});
const projectId=`local-live-cabinetry-${Date.now()}`;
const oldRow={id:'historic-cabinet',item:'Historical cabinet',quantity:3,qty:3,unit:'ITEM',excelRate:850,manualRate:925,quantityFormula:'=1+2',selectionFormula:'=1',notes:'Keep manual override',productLibrarySnapshot:{historicPrice:850},sortOrder:0};
const matchedRow={id:'obsolete-other',item:'Obsolete imported record',quantity:4,unit:'ITEM',excelRate:1};
const workbook={selectionQuoteEngineVersion:1,workspaceId:source.workspaceId,templateType:'job',page:'quotation',projectId,registeredJobId:projectId,jobId:projectId,
 registeredJob:{jobId:projectId,jobName:'Isolated cabinetry preservation test',jobNumber:'CAB-TEST'},jobFileMeta:{projectId,jobName:'Isolated cabinetry preservation test'},
 quotationSectionOrder:['ELECTRICAL','CABINET MAKER'],quotation:{ELECTRICAL:{collapsed:true,rows:[{id:'unrelated-electric',item:'Electrical labour',quantity:2,unit:'HOUR',manualRate:100}]},'CABINET MAKER':{collapsed:false,rows:[oldRow,{id:'unused-old-cabinet',item:'Obsolete zero quantity item',quantity:0,excelRate:400,manualRate:''},matchedRow]}}};
const fixture=path.join(out,'legacy-job.json');fs.writeFileSync(fixture,JSON.stringify({projectId,jobName:'Isolated cabinetry preservation test',workbook}));
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

const report={sourceSha256:source.sourceSha256,passed:false,tests:{},runtimeErrors:[],blockedCloudWrites:[]};let page;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
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
          const request = db.transaction('jobs', 'readonly').objectStore('jobs').get(key);
          request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
        });
        if (record) records.push(record);
      } finally { db.close(); }
    }
    return records.sort((a,b) => String(b.savedAt || b.workbook?.savedAt).localeCompare(String(a.savedAt || a.workbook?.savedAt)))[0];
  }, `job:${projectId}`);
}

try {
 page=await browser.newPage();page.setDefaultTimeout(90000);
 page.on('pageerror',e=>report.runtimeErrors.push(e.message));page.on('dialog',d=>d.accept());
 await page.setRequestInterception(true);page.on('request',r=>{if(/\/(rest|storage)\/v1\//.test(r.url())&&!['GET','HEAD','OPTIONS'].includes(r.method())){report.blockedCloudWrites.push(r.method());void r.abort();}else void r.continue();});
 await page.evaluateOnNewDocument(({key,session,owner})=>{localStorage.setItem(key,JSON.stringify(session));localStorage.setItem('active_workspace_id',owner);},{key:`sb-${new URL(url).hostname.split('.')[0]}-auth-token`,session:auth.session,owner:source.workspaceId});
 await page.goto(`${origin}/modules/estimate-builder?page=quotation`,{waitUntil:'domcontentloaded',timeout:180000});
 const input=await page.waitForSelector('[data-testid="open-local-job-file-input"]');await input.uploadFile(fixture);
 for(let n=0;n<8;n++){await delay(400);await page.evaluate(()=>{for(const text of ['Discard Changes','Open Job','Open Job File','Keep Local'])[...document.querySelectorAll('button')].find(b=>!b.disabled&&b.innerText.trim()===text)?.click();});}
 await page.waitForFunction(()=>document.querySelectorAll('tr[data-cabinetry-import-key]').length===657,{timeout:180000});
 await page.$eval('[data-testid="cabinetry-replacement-picker"]',e=>e.open=true);
 assert.equal(await page.$eval('[data-testid="cabinetry-replacement-picker"] summary',e=>e.innerText.includes('657 products')),true);
 await page.select('select[aria-label="Cabinetry catalogue section"]','KITCHEN CABINETRY');
 await page.select('select[aria-label="Cabinetry finish range"]','STANDARD COLOURBOARD');
 await page.select('select[aria-label="Cabinetry catalogue product"]','final-cabinetry:8');
 await page.$eval('[data-testid="cabinetry-replacement-picker"] button',b=>b.click());
 await page.$eval('[data-testid="cabinetry-replacement-picker"] button',b=>b.click());
 await page.$eval('[data-testid="cabinetry-replacement-picker"]',e=>e.open=false);
 const sections=await page.$$eval('[data-quote-section]',elements=>elements.map(e=>e.dataset.quoteSection));
 assert.deepEqual(sections.filter(s=>/CABINET|BENCHTOP|WARDROB/i.test(s)),['CABINETRY']);
 const products=await page.$$eval('[data-quote-section="CABINETRY"] tr[data-cabinetry-import-key]',rows=>rows.map(row=>({key:row.dataset.cabinetryImportKey, values:[...row.querySelectorAll('input')].map(i=>i.value)})));
 const expectedProducts=source.rows.filter(r=>r.type==='product');
 assert.deepEqual(products.map(r=>r.key),expectedProducts.map(r=>r.key || `final-cabinetry:${r.sourceRow}`));
 for(let i=0;i<products.length;i++) {
   assert.equal(products[i].values[0],expectedProducts[i].description);
   assert.equal(Number(products[i].values[3].replace(/[$,]/g,'')),expectedProducts[i].price);
 }
 const dividers=await page.$$eval('[data-cabinetry-row-type]',rows=>rows.map(row=>({type:row.dataset.cabinetryRowType,sourceRow:Number(row.dataset.cabinetrySourceRow),level:Number(row.dataset.cabinetryHeadingLevel),text:row.innerText.trim(),controls:row.querySelectorAll('input,button,select').length,colour:getComputedStyle(row.cells[0]).backgroundColor,height:row.getBoundingClientRect().height})));
 const importedDividers=dividers.filter(r=>r.sourceRow);
 assert.deepEqual(importedDividers.map(r=>[r.sourceRow,r.text]),source.rows.filter(r=>r.type!=='product').map(r=>[r.sourceRow,r.description]));
 assert(dividers.every(r=>r.controls===0));
 assert(dividers.filter(r=>r.type==='spacer').every(r=>r.height>=16));
 assert.notEqual(dividers.find(r=>r.level===1).colour,dividers.find(r=>r.level===2).colour);
 report.tests={pickerUsesFinalSource:true,oneSection:true,all657DescriptionsAndPrices:true,sourceOrder:true,roomHeadings:true,finishHeadings:true,spacers:true,dividersHaveNoControls:true};
 assert.equal(await page.$('[data-quote-row="unused-old-cabinet"]'),null);
 assert.equal(await page.$('[data-quote-row="historic-cabinet"]'),null);
 assert.equal(await page.$('[data-quote-row="obsolete-other"]'),null);
 assert(!dividers.some(r=>/LEGACY|CUSTOM JOB/.test(r.text)));
 for(const [name,text] of [['kitchen','KITCHEN CABINETRY'],['finish','PREMIUM LAMINATE'],['wardrobes','WARDROBES'],['benchtops','KITCHEN BENCHTOPS']]) {
   await page.evaluate(text=>[...document.querySelectorAll('[data-cabinetry-row-type="heading"]')].find(e=>e.innerText.trim()===text)?.scrollIntoView({block:'center'}),text);
   await page.screenshot({path:path.join(out,`visible-${name}.png`)});
 }
 const panels=expectedProducts.filter(r=>r.approvedAddition);
 assert.equal(panels.filter(r=>r.description.startsWith('Short')).length,5);
 assert.equal(panels.filter(r=>r.description.startsWith('Tall')).length,5);
 assert(panels.every(r=>r.unit==='EACH'&&r.room==='KITCHEN CABINETRY'));
 for(const panel of panels) {
   const row=products.find(r=>r.key===panel.key);assert.equal(row.values[2],'EACH');assert.equal(Number(row.values[3]),panel.price);
 }
 for(const finish of ['standard-colourboard','premium-laminate','2-pack','shaker-style','vinyl-wrap']) {
   await page.$eval(`[data-cabinetry-import-key="kitchen-panel-${finish}-short"]`,r=>r.scrollIntoView({block:'center'}));
   await page.screenshot({path:path.join(out,`panels-${finish}.png`)});
 }
 report.tests.kitchenShortPanels=5;report.tests.kitchenTallPanels=5;report.tests.panelUnitEach=true;report.tests.noPanelsInOtherRooms=true;report.tests.noLegacyRows=true;
 const widths=expectedProducts.filter(r=>/BENCHTOPS/.test(r.room)&&/\d+mm wide/.test(r.description));assert(widths.every(r=>r.unit==='LM'));
 report.tests.benchtopsAtBottom=expectedProducts.at(-1).room==='BATHROOM BENCHTOPS';
 await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='Save Job'&&!b.disabled)?.click());
 let record;const deadline=Date.now()+90000;
 do{record=await savedLocalRecord();if(record?.workbook?.cabinetryDatasetRevision===source.datasetRevision)break;await delay(300);}while(Date.now()<deadline);
 assert.equal(record?.workbook?.cabinetryDatasetRevision,source.datasetRevision,'Approved dataset saved');
 const saved=record.workbook;
 assert.equal(saved.quotation.CABINETRY.rows.length,870);
 assert(!saved.quotation.CABINETRY.rows.some(r=>r.legacyCatalogueReference));
 assert.equal(saved.jobId,projectId);assert.equal(saved.quotation.ELECTRICAL.rows[0].manualRate,100);
 report.tests.jobPreserved=true;
 await page.setCacheEnabled(false);
 await page.reload({waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForFunction(()=>document.querySelectorAll('tr[data-cabinetry-import-key]').length===657,{timeout:180000});
 assert.equal(await page.$$eval('tr[data-cabinetry-import-key]',rows=>new Set(rows.map(r=>r.dataset.cabinetryImportKey)).size),657);
 const reopened=path.join(out,'saved-job.json');fs.writeFileSync(reopened,JSON.stringify(record));
 const reopenInput=await page.waitForSelector('[data-testid="open-local-job-file-input"]');await reopenInput.uploadFile(reopened);
 for(let n=0;n<8;n++){await delay(400);await page.evaluate(()=>{for(const text of ['Discard Changes','Open Job','Open Job File','Keep Local'])[...document.querySelectorAll('button')].find(b=>!b.disabled&&b.innerText.trim()===text)?.click();});}
 await page.waitForFunction(()=>document.querySelectorAll('tr[data-cabinetry-import-key]').length===657,{timeout:180000});
 report.tests.saveReload=true;report.tests.noDuplicates=true;
 assert.equal(report.runtimeErrors.length,0,report.runtimeErrors.join('\n'));report.passed=true;
}catch(error){report.error=error.stack;process.exitCode=1;if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();}

