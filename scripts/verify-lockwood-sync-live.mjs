import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import {createClient} from '@supabase/supabase-js';
import {createEstimateBuilderWorkbookDefaults} from '../lib/construction-estimation/estimateBuilderWorkbookDefaults.js';
import {getMasterProducts} from '../lib/product-library/catalogueService.js';
import {rowsFromCsv} from '../lib/product-library/productLibraryExchange.js';
dotenv.config({path:'.env.local',quiet:true});dotenv.config({path:'.env',quiet:true});
const origin=process.env.INTERNAL_TEST_ORIGIN||'http://localhost:3000';const out=path.resolve('test-artifacts/lockwood-sync-live');fs.mkdirSync(out,{recursive:true});
const projectId='lockwood-verification-20260906';const defaults=createEstimateBuilderWorkbookDefaults();delete defaults.aiPlanTakeoffJob;delete defaults.takeoffEngine;delete defaults.takeoffSchedule;delete defaults.clientSelectionsBook;
const workbook={...defaults,templateType:'job',page:'clientSelections',projectId,commercialProjectId:projectId,registeredJobId:projectId,registeredJob:{jobId:projectId,jobName:'Internal Catalogue Verification',jobNumber:'INT-TEST',clientName:'Test client',siteAddress:'Test address'},jobFileMeta:{projectId,jobName:'Internal Catalogue Verification',jobNumber:'INT-TEST',clientName:'Test client',address:'Test address'}};
const fixture=path.join(out,'internal-test-job.json');fs.writeFileSync(fixture,JSON.stringify({projectId,jobName:'Internal Catalogue Verification',workbook}));
const url=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL;const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||process.env.SUPABASE_ANON_KEY;
const admin=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY,{auth:{persistSession:false}});const {data:link,error}=await admin.auth.admin.generateLink({type:'magiclink',email:process.env.PRODUCT_LIBRARY_TEST_EMAIL||'support@gr8result.com'});if(error)throw error;
const authClient=createClient(url,anon,{auth:{persistSession:false}});const {data:auth,error:authError}=await authClient.auth.verifyOtp({type:'magiclink',token_hash:link.properties.hashed_token});if(authError)throw authError;
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,protocolTimeout:300000,defaultViewport:{width:1600,height:1100}});fs.writeFileSync(path.join(out,'browser-endpoint.txt'),browser.wsEndpoint());
let page;const errors=[],steps=[],csvExports=[];const canonical=getMasterProducts().filter(p=>p.attributes.internalAreasCatalogue&&p.active);
try{
 page=await browser.newPage();page.setDefaultTimeout(180000);page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);page.on('request',r=>r.url().includes('/rest/v1/')&&!['GET','HEAD','OPTIONS'].includes(r.method())?r.abort():r.continue());
 await page.evaluateOnNewDocument(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key:`sb-${new URL(url).hostname.split('.')[0]}-auth-token`,session:auth.session});
 const cdp=await page.createCDPSession();await cdp.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:out});
 const go=query=>page.goto(`${origin}/modules/estimate-builder?${query}`,{waitUntil:'domcontentloaded',timeout:180000});
 const click=async(text,exact=true)=>{console.log('Click:',text);await page.waitForFunction((text,exact)=>{const b=[...document.querySelectorAll('button')].find(b=>!b.disabled&&(exact?b.innerText.trim()===text:b.innerText.includes(text)));if(!b)return false;b.click();return true;},{},text,exact);await new Promise(r=>setTimeout(r,600));};
 const input=async(selector,value)=>page.$eval(selector,(i,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,value);i.dispatchEvent(new Event('input',{bubbles:true}));},value);
 const shot=async name=>{await page.screenshot({path:path.join(out,name+'.png')});steps.push({name,url:page.url(),heapUsedMB:Math.round((await page.metrics()).JSHeapUsedSize/1048576)});console.log(name);};
 const load=async file=>{await page.waitForSelector('[data-testid="open-local-job-file-input"]');await(await page.$('[data-testid="open-local-job-file-input"]')).uploadFile(file);for(let i=0;i<4;i++){await new Promise(r=>setTimeout(r,1300));const labels=await page.$$eval('button',bs=>bs.map(b=>b.innerText.trim()));for(const label of ['Discard Changes','Open Job','Open Job File','Keep Local'])if(labels.includes(label))await click(label);}};
 await go('page=clientSelections');await load(fixture);await new Promise(r=>setTimeout(r,5000));await click('Interior');await click('Internal Door Furniture',false);await page.waitForSelector('[data-testid="internal-catalogue-picker"]');
 const selected=[];
 for(const [label,brand,key,quantity] of [['Internal Door Furniture','Lockwood','door-hardware','4']]){
  if(false){await click('Back to Interior selections');await click(label,false);await page.waitForSelector('[data-testid="internal-catalogue-picker"]');}
  await page.select('[aria-label="Internal product brand"]',brand);await page.waitForSelector('[data-testid="select-internal-product"]');await page.$eval('[data-testid="select-internal-product"]',b=>b.click());await page.waitForSelector('[data-testid="internal-product-options"]');if(await page.$('[aria-label="Internal size"]')){const values=await page.$$eval('[aria-label="Internal size"] option',os=>os.map(o=>o.value));await page.select('[aria-label="Internal size"]',values.at(-1));}await page.waitForSelector('[aria-label="Internal hardware variant"]');const variantValue=await page.$eval('[aria-label="Internal hardware variant"]',e=>[...e.options].find(o=>o.text.includes('Privacy')&&o.text.includes('Matt black'))?.value||e.options[0].value);await page.select('[aria-label="Internal hardware variant"]',variantValue);await input('[aria-label="Internal quantity"]',quantity);await shot('05-options-'+key);await click('Confirm Selection');await page.waitForSelector('[data-testid="internal-saved-selection"]');selected.push({key,quantity:Number(quantity),text:await page.$eval('[data-testid="internal-saved-selection"]',e=>e.innerText)});
 }
 await click('Save Progress');await new Promise(r=>setTimeout(r,2500));
 const record=await page.evaluate(async key=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('estimate-builder-template-db');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});try{return await new Promise((resolve,reject)=>{const r=db.transaction('jobs','readonly').objectStore('jobs').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}finally{db.close();}},`job:${projectId}`);
 const quote=record.workbook.quotation['INTERNAL PRODUCTS - CLIENT SELECTIONS'].rows;assert.equal(quote.length,1);const row=quote[0];assert.equal(row.brand,'Lockwood');assert.equal(row.qty,4);assert(row.variantCode);assert(row.function);assert(row.finish);assert(row.productImageUrl.startsWith('/images/product-library/internal-areas/lockwood/'));assert(canonical.some(p=>p.productId===row.productId&&p.attributes.controlledVariants?.some(v=>v.productCode===row.variantCode)));assert.equal(row.priceStatus,'Quote required');
 await click('Quotation Builder');await page.waitForFunction(()=>document.querySelectorAll('[data-quote-row^="internal-selection:"]').length===1);await page.$eval('[data-quote-section="INTERNAL PRODUCTS - CLIENT SELECTIONS"]',e=>e.scrollIntoView({block:'start'}));await shot('06-quotation-builder');

 assert.equal(errors.length,0,errors.join('\n'));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:true,steps,csvExports,selected,quotation:quote,errors},null,2));
}catch(e){if(page){await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'failure.txt'),await page.evaluate(()=>document.body.innerText).catch(()=>''));}fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:false,error:e.message,steps,csvExports,errors},null,2));throw e;}finally{await browser.close();}

