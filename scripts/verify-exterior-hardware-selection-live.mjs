import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import {createClient} from '@supabase/supabase-js';
import puppeteer from 'puppeteer';
import {createEstimateBuilderWorkbookDefaults} from '../lib/construction-estimation/estimateBuilderWorkbookDefaults.js';
dotenv.config({path:'.env.local',quiet:true});dotenv.config({path:'.env',quiet:true});
const baseUrl=process.env.ENTRY_DOOR_TEST_BASE_URL||'http://localhost:3000';
const out=path.resolve('test-artifacts/exterior-hardware-selection-live');fs.mkdirSync(out,{recursive:true});
const projectId='door-furniture-verification-20260905';
const defaults=createEstimateBuilderWorkbookDefaults();
const workbook={...defaults,templateType:'job',page:'clientSelections',projectId,commercialProjectId:projectId,registeredJobId:projectId,registeredJob:{jobId:projectId,jobName:'Door Furniture Verification',jobNumber:'DF-TEST',clientName:'Test client',siteAddress:'Test address'},jobFileMeta:{projectId,jobName:'Door Furniture Verification',jobNumber:'DF-TEST',clientName:'Test client',address:'Test address'},takeoffSchedule:{items:[{id:'D01',mark:'ED1',type:'Exterior entry door',level:'Ground',location:'Entry',quantity:1},{id:'D02',mark:'ED2',type:'Exterior entry door',level:'Upper',location:'Terrace',quantity:1}]} };
delete workbook.aiPlanTakeoffJob;delete workbook.takeoffEngine;
const fixture=path.join(out,'door-furniture-test-job.json');fs.writeFileSync(fixture,JSON.stringify({projectId,jobName:'Door Furniture Verification',workbook}));
const url=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL;const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||process.env.SUPABASE_ANON_KEY;
const admin=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY,{auth:{persistSession:false}});
const {data:link,error}=await admin.auth.admin.generateLink({type:'magiclink',email:process.env.PRODUCT_LIBRARY_TEST_EMAIL||'support@gr8result.com'});if(error)throw error;
const client=createClient(url,anon,{auth:{persistSession:false}});const {data:auth,error:authError}=await client.auth.verifyOtp({type:'magiclink',token_hash:link.properties.hashed_token});if(authError)throw authError;
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,protocolTimeout:300000,defaultViewport:{width:1500,height:1000}});
fs.writeFileSync(path.join(out,'browser-endpoint.txt'),browser.wsEndpoint());
const errors=[],steps=[];let page;
try{
  page=await browser.newPage();page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));
  await page.evaluateOnNewDocument(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key:`sb-${new URL(url).hostname.split('.')[0]}-auth-token`,session:auth.session});
  const click=async(text,exact=false)=>{await page.waitForFunction((text,exact)=>[...document.querySelectorAll('button')].some(b=>!b.disabled&&(exact?b.innerText.trim()===text:b.innerText.includes(text))),{},text,exact);await page.evaluate((text,exact)=>[...document.querySelectorAll('button')].find(b=>!b.disabled&&(exact?b.innerText.trim()===text:b.innerText.includes(text))).click(),text,exact);await new Promise(r=>setTimeout(r,800));};
  const shot=async name=>{steps.push({name,url:page.url()});await page.screenshot({path:path.join(out,name+'.png')});};
  await page.goto(baseUrl+'/modules/estimate-builder?page=clientSelections',{waitUntil:'domcontentloaded',timeout:180000});
  await page.waitForSelector('[data-testid="open-local-job-file-input"]');await (await page.$('[data-testid="open-local-job-file-input"]')).uploadFile(fixture);
  await new Promise(r=>setTimeout(r,2500));
  for(let i=0;i<3;i++){const labels=await page.$$eval('button',bs=>bs.map(b=>b.innerText.trim()));if(labels.includes('Discard Changes'))await click('Discard Changes',true);if(labels.includes('Open Job'))await click('Open Job',true);if(labels.includes('Open Job File'))await click('Open Job File',true);await new Promise(r=>setTimeout(r,1000));}
  await page.goto(`${baseUrl}/modules/estimate-builder?page=productLibrary&room=exterior&roomCategory=door-furniture&mode=client-selection&returnPage=clientSelections&door=D01&projectId=${projectId}`,{waitUntil:'domcontentloaded',timeout:180000});
  await page.waitForSelector('[data-testid="select-door-furniture"]');assert.equal(new URL(page.url()).searchParams.get('mode'),'client-selection');await shot('02-select-controls');
  const productId=await page.$eval('[data-testid="select-door-furniture"]',b=>b.closest('[data-room-product]').getAttribute('data-room-product'));
  await page.$eval('[data-testid="select-door-furniture"]',b=>b.click());
  await page.waitForSelector('[data-testid="door-furniture-options"]');
  const finishSelect=await page.$('[aria-label="Hardware finish"]');let chosenFinish='';if(finishSelect){chosenFinish=await page.$eval('[aria-label="Hardware finish"]',s=>s.options[s.options.length-1].value);await page.select('[aria-label="Hardware finish"]',chosenFinish);}
  await page.$eval('[aria-label="Hardware quantity"]',i=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(i,'2');i.dispatchEvent(new Event('input',{bubbles:true}));});
  await shot('03-options');await click('Confirm Selection',true);
  await page.waitForFunction(()=>document.querySelector('[data-testid="door-furniture-selection-context"]')?.textContent.includes('saved to chosen inclusions'));
  await page.waitForFunction(()=>[...document.querySelectorAll('[data-testid="select-door-furniture"]')].some(b=>b.innerText.startsWith('Selected')));await shot('04-selected');
  const record=await page.evaluate(async key=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('estimate-builder-template-db');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});try{return await new Promise((resolve,reject)=>{const r=db.transaction('jobs','readonly').objectStore('jobs').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}finally{db.close();}},`job:${projectId}`);
  assert(record?.workbook);const selected=record.workbook.clientSelectionsBook.rooms.flatMap(r=>r.rows).find(r=>r.guidedSelection?.entryDoors?.length)?.guidedSelection;
  assert.equal(selected.entryDoors.length,1);assert.equal(selected.entryDoors[0].door.id,'D01');assert.equal(selected.entryDoors[0].furnitureFinish,chosenFinish);assert.equal(selected.entryDoors[0].hardwareOptions.quantity,2);assert.equal(record.workbook.procurement.items.filter(i=>i.source==='client-selections-entry-door-furniture').length,1);
  assert.equal(errors.length,0,errors.join('\n'));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:true,steps,errors,selection:selected.entryDoors[0],schedules:selected.procurementSchedule},null,2));
}catch(e){if(page){await page.screenshot({path:path.join(out,'failure.png'),fullPage:false}).catch(()=>{});fs.writeFileSync(path.join(out,'failure.txt'),await page.evaluate(()=>document.body.innerText).catch(()=>''));}fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:false,error:e.message,errors,steps},null,2));throw e;}finally{await browser.close();}
