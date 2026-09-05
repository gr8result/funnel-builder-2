import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import {createClient} from '@supabase/supabase-js';
import puppeteer from 'puppeteer';
import {createEstimateBuilderWorkbookDefaults} from '../lib/construction-estimation/estimateBuilderWorkbookDefaults.js';
dotenv.config({path:'.env.local',quiet:true});dotenv.config({path:'.env',quiet:true});
const out=path.resolve('test-artifacts/entry-door-furniture-live');fs.mkdirSync(out,{recursive:true});
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
const errors=[];const steps=[];let page;
try {
  page=await browser.newPage();page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));
  await page.evaluateOnNewDocument(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key:`sb-${new URL(url).hostname.split('.')[0]}-auth-token`,session:auth.session});
  const pickerUrl=`http://localhost:3000/modules/estimate-builder?page=productLibrary&room=exterior&roomCategory=door-furniture&mode=client-selection&returnPage=clientSelections&door=D01&projectId=${projectId}`;
  await page.goto(pickerUrl,{waitUntil:'domcontentloaded',timeout:180000});
  await page.waitForSelector('[data-testid="open-local-job-file-input"]');await (await page.$('[data-testid="open-local-job-file-input"]')).uploadFile(path.join(out,'saved-job.json'));
  for(let i=0;i<8;i++){
    await new Promise(r=>setTimeout(r,1500));
    await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>['Discard Changes','Open Job','Open Job File','Keep Local'].includes(b.innerText.trim()));b?.click();});
    if(await page.$$eval('[data-testid="select-door-furniture"]',bs=>bs.some(b=>b.innerText.startsWith('Selected'))))break;
  }
  await page.goto(pickerUrl,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>[...document.querySelectorAll('[data-testid="select-door-furniture"]')].some(b=>b.innerText.startsWith('Selected')));
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.innerText==='Back to selected exterior door').click());
  await page.waitForSelector('[data-testid="scheduled-entry-doors"]');await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.innerText==='Review Schedule').click());
  await page.waitForSelector('[data-testid="entry-door-review-schedule"]');
  const review=await page.$eval('[data-testid="entry-door-review-schedule"]',e=>e.innerText);assert(review.includes('ED1')&&review.includes('Matt Black')&&review.includes('Paradigm')&&review.includes('Rate required'));
  await (await page.$('[data-testid="entry-door-review-schedule"]')).screenshot({path:path.join(out,'09-readable-review-schedule.png')});steps.push({name:'readable-review-schedule',url:page.url(),text:review});
  await page.goto(`http://localhost:3000/modules/estimate-builder?page=procurement`,{waitUntil:'domcontentloaded'});await page.waitForSelector('[data-testid="entry-door-supplier-schedule"]');
  const procurement=await page.$eval('[data-testid="entry-door-supplier-schedule"]',e=>e.innerText);assert(procurement.includes('Paradigm')&&procurement.includes('ED1'));await (await page.$('[data-testid="entry-door-supplier-schedule"]')).screenshot({path:path.join(out,'10-procurement-schedule.png')});steps.push({name:'procurement-schedule',text:procurement});
  assert.equal(errors.length,0,errors.join('\n'));fs.writeFileSync(path.join(out,'evidence-report.json'),JSON.stringify({passed:true,errors,steps},null,2));
} catch(e){if(page)await page.screenshot({path:path.join(out,'evidence-failure.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'evidence-report.json'),JSON.stringify({passed:false,error:e.message,errors,steps},null,2));throw e;}finally{await browser.close();}
