import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import {createClient} from '@supabase/supabase-js';
import puppeteer from 'puppeteer';
import {createEstimateBuilderWorkbookDefaults} from '../lib/construction-estimation/estimateBuilderWorkbookDefaults.js';
dotenv.config({path:'.env.local',quiet:true});dotenv.config({path:'.env',quiet:true});
const out=path.resolve('test-artifacts/manual-entry-door-recovery/empty-live');fs.mkdirSync(out,{recursive:true});
const projectId='empty-door-verification-20260906';
const defaults=createEstimateBuilderWorkbookDefaults();
const workbook={...defaults,templateType:'job',page:'clientSelections',projectId,commercialProjectId:projectId,registeredJobId:projectId,registeredJob:{jobId:projectId,jobName:'Door Furniture Verification',jobNumber:'DF-TEST',clientName:'Test client',siteAddress:'Test address'},jobFileMeta:{projectId,jobName:'Door Furniture Verification',jobNumber:'DF-TEST',clientName:'Test client',address:'Test address'},takeoffSchedule:{items:[{id:'D01',mark:'ED1',type:'Exterior entry door',level:'Ground',location:'Entry',quantity:1},{id:'D02',mark:'ED2',type:'Exterior entry door',level:'Upper',location:'Terrace',quantity:1}]} };
delete workbook.aiPlanTakeoffJob;delete workbook.takeoffEngine;delete workbook.takeoffSchedule;
const audit=JSON.parse(fs.readFileSync('test-artifacts/manual-entry-door-recovery/server-audit.json','utf8'));
const legacy=audit.books.flatMap(b=>b.doors).find(d=>d.guidedSelection?.productCode==='ENTRY-HUME-SAVOY-1200-XS26-1200');
assert(legacy,'Previously saved legacy door must be available for read-only reproduction');
workbook.clientSelectionsBook={documentType:'luxury_selections_book',rooms:[{id:'manual-test-exterior',name:'Exterior',rows:[{...legacy,id:'legacy-door-test',guidedRequirementKey:'entry-door'}]}],projectInfo:{projectId},metadata:{projectId}};

delete workbook.clientSelectionsBook;
const fixture=path.join(out,'door-furniture-test-job.json');fs.writeFileSync(fixture,JSON.stringify({projectId,jobName:'Door Furniture Verification',workbook}));
const url=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL;const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||process.env.SUPABASE_ANON_KEY;
const admin=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY,{auth:{persistSession:false}});
const {data:link,error}=await admin.auth.admin.generateLink({type:'magiclink',email:process.env.PRODUCT_LIBRARY_TEST_EMAIL||'support@gr8result.com'});if(error)throw error;
const client=createClient(url,anon,{auth:{persistSession:false}});const {data:auth,error:authError}=await client.auth.verifyOtp({type:'magiclink',token_hash:link.properties.hashed_token});if(authError)throw authError;
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,protocolTimeout:300000,defaultViewport:{width:1500,height:1000}});
fs.writeFileSync(path.join(out,'browser-endpoint.txt'),browser.wsEndpoint());
const errors=[],steps=[];let page;
try{
 page=await browser.newPage();const originalGoto=page.goto.bind(page);page.goto=(url,options)=>originalGoto(String(url).replace('http://localhost:3000',process.env.DOOR_TEST_ORIGIN||'http://localhost:3000'),options);page.setDefaultTimeout(180000);page.on('pageerror',e=>errors.push(e.message));
 await page.setRequestInterception(true);page.on('request',r=>{if(r.url().includes('/rest/v1/')&&!['GET','HEAD','OPTIONS'].includes(r.method()))return r.abort();r.continue();});
 await page.evaluateOnNewDocument(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key:`sb-${new URL(url).hostname.split('.')[0]}-auth-token`,session:auth.session});
 const click=async(text,exact=false)=>{await page.waitForFunction((text,exact)=>{const b=[...document.querySelectorAll('button')].find(b=>!b.disabled&&(exact?b.innerText.trim()===text:b.innerText.includes(text)));if(!b)return false;b.click();return true;},{},text,exact);await new Promise(r=>setTimeout(r,800));};
 const shot=async(name,selector)=>{if(selector&&await page.$(selector))await (await page.$(selector)).screenshot({path:path.join(out,name+'.png')});else await page.screenshot({path:path.join(out,name+'.png')});steps.push({name,url:page.url()});console.log(name,page.url());};
 const load=async(file)=>{await page.waitForSelector('[data-testid="open-local-job-file-input"]');await (await page.$('[data-testid="open-local-job-file-input"]')).uploadFile(file);for(let i=0;i<4;i++){await new Promise(r=>setTimeout(r,1600));const labels=await page.$$eval('button',bs=>bs.map(b=>b.innerText.trim()));for(const label of ['Discard Changes','Open Job','Open Job File','Keep Local'])if(labels.includes(label))await click(label,true);}};
 await page.goto('http://localhost:3000/modules/estimate-builder?page=clientSelections',{waitUntil:'domcontentloaded',timeout:180000});await load(fixture);
 await page.goto('http://localhost:3000/modules/estimate-builder?page=clientSelections',{waitUntil:'domcontentloaded'});await click('Exterior',true);await click('Entry Doors');await page.waitForSelector('[data-testid="entry-door-supplier-step"]');await shot('01-empty-job-browse','[data-testid="scheduled-entry-doors"]');
 const input=async(label,value)=>page.$eval(`[aria-label="${label}"]`,(i,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,value);i.dispatchEvent(new Event('input',{bubbles:true}));},value);
 await input('Door location/name','Front Entry');await input('Door level/storey','Ground');await input('Door quantity','2');await click('Add Entry Door',true);await input('Door location/name','Side Entry');await input('Door level/storey','Ground');
 await click('Hume Doors');await page.waitForSelector('[data-testid="entry-door-range-step"]');await click('Carringbush');await page.waitForSelector('[data-testid="entry-door-design-step"]');await click('Choose Design');
 for(let i=0;i<8;i++){
  await page.waitForFunction(()=>document.querySelector('[data-testid="door-furniture-selection-context"]')||['entry-door-size-step','entry-door-configuration-step','entry-door-finish-step','entry-door-glazing-step'].some(id=>document.querySelector(`[data-testid="${id}"]`)));
  if(await page.$('[data-testid="door-furniture-selection-context"]'))break;
  const old=await page.evaluate(()=>{for(const id of ['entry-door-size-step','entry-door-configuration-step','entry-door-finish-step','entry-door-glazing-step']){const root=document.querySelector(`[data-testid="${id}"]`);const b=root&&[...root.querySelectorAll('button')].find(b=>!b.disabled);if(b){b.click();return id;}}});await page.waitForFunction(id=>!document.querySelector(`[data-testid="${id}"]`),{},old);
 }
 await page.waitForSelector('[data-testid="furniture-brand-Zanda"]');assert.equal(new URL(page.url()).searchParams.get('page'),'clientSelections');await page.click('[data-testid="furniture-brand-Zanda"]');await page.waitForSelector('[data-testid="select-door-furniture"]');await page.$eval('[data-testid="select-door-furniture"]',b=>b.click());await page.waitForSelector('[data-testid="door-furniture-options"]');await shot('02-new-manual-hardware','[data-testid="door-furniture-options"] section');await click('Confirm Selection',true);await page.waitForFunction(()=>[...document.querySelectorAll('[data-testid="select-door-furniture"]')].some(b=>b.innerText.startsWith('Selected')));await click('Save Progress',true);await new Promise(r=>setTimeout(r,1500));await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>[...document.querySelectorAll('[data-testid="select-door-furniture"]')].some(b=>b.innerText.startsWith('Selected')));await click('Back to selected exterior door',true);await page.waitForSelector('[data-testid="existing-entry-door-selection"]');assert((await page.$eval('[data-testid="existing-entry-door-selection"]',e=>e.innerText)).includes('XCB1'));assert.equal(await page.$eval('[aria-label="Door location/name"]',e=>e.value),'Side Entry');await shot('03-new-door-after-refresh','[data-testid="scheduled-entry-doors"]');
 assert.equal(errors.length,0,errors.join('\n'));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:true,noTakeoffSchedule:true,manualDoorAdded:true,steps,errors},null,2));
}catch(e){if(page){await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'failure.txt'),await page.evaluate(()=>document.body.innerText).catch(()=>''));}fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:false,error:e.message,errors,steps},null,2));throw e;}finally{await browser.close();}
