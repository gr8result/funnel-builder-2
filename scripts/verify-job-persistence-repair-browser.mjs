import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import puppeteer from "puppeteer";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });

const baseUrl = process.env.PRODUCT_LIBRARY_TEST_URL || "http://localhost:3012/modules/estimate-builder?page=dataInput";
const ownerEmail = process.env.PRODUCT_LIBRARY_TEST_EMAIL || "support@gr8result.com";
const outDir = path.join(process.cwd(), "test-artifacts", "job-persistence-repair", String(Date.now()));
fs.mkdirSync(outDir, { recursive: true });

async function mintSession() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    throw new Error("Authenticated Product Library verification requires Supabase URL, service role key and anon key.");
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: ownerEmail });
  if (error) throw error;
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error: verifyError } = await client.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.properties.hashed_token,
  });
  if (verifyError) throw verifyError;
  if (!data?.session?.access_token) throw new Error("Supabase did not return an authenticated session.");
  return { session: data.session, supabaseUrl };
}


const {session,supabaseUrl}=await mintSession();
const storageKey='sb-'+new URL(supabaseUrl).hostname.split('.')[0]+'-auth-token';
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox'],defaultViewport:{width:1600,height:1000}});
let page=await browser.newPage();
page.setDefaultTimeout(60000);
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.evaluateOnNewDocument(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key:storageKey,session});

async function clickText(text) {
 await page.waitForFunction(text => [...document.querySelectorAll('button')].some(b => b.innerText.trim() === text && b.getClientRects().length),{},text);
 const button = await page.evaluateHandle(text => [...document.querySelectorAll('button')].find(b => b.innerText.trim() === text && b.getClientRects().length), text);
 if (!button.asElement()) throw Error(`Missing button: ${text}`);
 await button.asElement().click(); await button.dispose();
}
async function input(selector, value) {
 await page.waitForSelector(selector);
 await page.click(selector);
 await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');
 await page.keyboard.sendCharacter(String(value));
 await page.keyboard.press('Tab');
 await page.waitForFunction((selector,value)=>document.querySelector(selector)?.value===value,{},selector,String(value));
}

async function liveWorkbook() {
 return page.evaluate(() => {
  const el=document.querySelector('#data-edit-inputDataSheet-projectName') || document.querySelector('[id^=formula-edit]') || document.querySelector('[id^=quote-edit]') || document.querySelector('[data-testid=job-persistence-status]');
  let fiber=el?.[Object.keys(el).find(k=>k.startsWith('__reactFiber$'))];
  while(fiber) {
   if(fiber.memoizedProps?.sheet?.workbook) return JSON.parse(JSON.stringify(fiber.memoizedProps.sheet.workbook));
   if(fiber.memoizedState) {
    let hook=fiber.memoizedState;
    while(hook) {if(hook.memoizedState?.data && hook.memoizedState?.quotation) return JSON.parse(JSON.stringify(hook.memoizedState));hook=hook.next;}
   }
   fiber=fiber.return;
  }
  throw Error('Mounted workbook not found');
 });
}
async function record(key) {
 return page.evaluate(key=>new Promise((resolve,reject)=>{
  const open=indexedDB.open('estimate-builder-template-db',2);
  open.onerror=()=>reject(open.error);
  open.onsuccess=()=>{const db=open.result;const r=db.transaction('jobs','readonly').objectStore('jobs').get(key);r.onsuccess=()=>{db.close();resolve(r.result)};r.onerror=()=>reject(r.error)};
 }),key);
}
async function create(name) {
 await page.click('#estimate-builder-file-menu-button');await clickText('Create New Job');
 await input('[role="dialog"] input',name);await clickText('Create Job');
 await page.waitForFunction(()=>!document.querySelector('[aria-label="Create new job"]'));
 await page.waitForSelector('#data-edit-inputDataSheet-projectName');
 return liveWorkbook();
}
async function save() {
 const workbook=await liveWorkbook();const key='job:'+workbook.jobId;
 const before=await record(key);
 await clickText('Save Job');
 await page.waitForFunction(()=>document.querySelector('[data-testid="job-persistence-status"]')?.innerText.startsWith('Saved at'),{timeout:60000});
 const after=await record(key);
 assert.ok(after.revision>before.revision);assert.equal(after.jobId,workbook.jobId);
 assert.ok(after.checksum.length===64);assert.ok(after.requiredSections.every(k=>after.workbook[k]));
 return after;
}
const assert=(await import('node:assert/strict')).default;
const {isDeepStrictEqual}=await import('node:util');
const results=[];
try {
 await page.evaluateOnNewDocument(()=>localStorage.setItem('estimate-builder-permission-mode','admin'));
 console.log('Opening builder');
 await page.goto(baseUrl,{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForSelector('#estimate-builder-file-menu-button',{timeout:180000});
 console.log('Creating isolation job');
 const other=await create('Persistence isolation '+Date.now());const otherBefore=await save();
 console.log('Creating target job');
 const target=await create('Persistence full job '+Date.now());
 assert.equal(target.data.inputDataSheet.rows.lowerExternalWallLining.value,'Plasterboard to framed walls');
 await page.select('#data-edit-inputDataSheet-lowerExternalWallLining','Battened and plasterboard lined');
 await input('#data-edit-inputDataSheet-clientName','Persistent Client');
 await input('#data-edit-inputDataSheet-marginPercent','23');
 console.log('Data Input save');const dataSaved=await save();assert.equal(dataSaved.workbook.data.inputDataSheet.rows.marginPercent.value,'23');assert.equal(dataSaved.workbook.data.inputDataSheet.rows.clientName.value,'Persistent Client');results.push({page:'Data Input',revision:dataSaved.revision,bytes:JSON.stringify(dataSaved.workbook).length});
 await clickText('Calculations');await page.waitForSelector('#formula-edit-lowerSlabAreaM2');
 await input('#formula-edit-lowerSlabAreaM2','123+7');
 console.log('Calculations save');const calcSaved=await save();results.push({page:'Calculations',revision:calcSaved.revision,formula:calcSaved.workbook.formulas.lowerSlabAreaM2});

 await clickText('Quote Sheet');
 await page.waitForFunction(()=>document.querySelector('[aria-label="Workbook sheets"] [aria-current="page"]')?.innerText==='Quote Sheet');
 const section=Object.entries((await liveWorkbook()).quotation).find(([name,s])=>s.rows?.length>=3 && !/APPLIANCE/.test(name))[0];
 const sectionSelector=`[data-quote-section=${JSON.stringify(section)}]`;
 await page.waitForSelector(sectionSelector);
 if((await liveWorkbook()).quotation[section].collapsed) await page.$eval(sectionSelector,e=>e.querySelector('button').click());
 await page.waitForSelector(sectionSelector+' [data-quote-row]');
 const ids=await page.$$eval(sectionSelector+' [data-quote-row]',els=>els.map(e=>e.dataset.quoteRow));
 const editedId=ids[0],deletedId=ids[1];
 const rowSelector=id=>`[data-quote-row=${JSON.stringify(id)}]`;
 await input(rowSelector(editedId)+' input[id^="quote-edit"]','Persisted edited description');
 const fields=await page.$$eval(rowSelector(editedId)+' input',els=>els.map((e,i)=>({i,id:e.id,value:e.value})));
 console.log('Quote fields',fields);
 // Product name, quantity, unit, rate, then notes are the editable row inputs.
 await input(rowSelector(editedId)+' td:nth-child(9) input','7');
 await input(rowSelector(editedId)+' td:nth-child(10) input','LM');
 await input(rowSelector(editedId)+' td:nth-child(11) input','123.45');
 await page.$eval(rowSelector(editedId),e=>[...e.querySelectorAll('button')].find(b=>b.innerText==='Insert below').click());
 await page.waitForFunction((selector,count)=>document.querySelectorAll(selector+' [data-quote-row]').length>count,{},sectionSelector,ids.length);
 const insertedId=(await page.$$eval(sectionSelector+' [data-quote-row]',els=>els.map(e=>e.dataset.quoteRow))).find(id=>!ids.includes(id));
 await input(rowSelector(insertedId)+' input[id^="quote-edit"]','New persistent row');
 await input(rowSelector(insertedId)+' td:nth-child(9) input','3');
 await input(rowSelector(insertedId)+' td:nth-child(11) input','42');
 await page.$eval(rowSelector(deletedId),e=>[...e.querySelectorAll('button')].find(b=>b.innerText==='Delete').click());
 await page.waitForFunction(selector=>!document.querySelector(selector),{},rowSelector(deletedId));
 await page.evaluate((from,to)=>{
  const dataTransfer=new DataTransfer();
  document.querySelector(from).dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer}));
  document.querySelector(to).dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer}));
 },rowSelector(insertedId),rowSelector(editedId));
 console.log('Quote Sheet save');
 const quoteSaved=await save();
 assert.equal(quoteSaved.workbook.data.inputDataSheet.rows.marginPercent.value,'23');
 assert.equal(quoteSaved.workbook.formulas.lowerSlabAreaM2,'123+7');
 const savedRows=quoteSaved.workbook.quotation[section].rows;
 assert.ok(!savedRows.some(r=>r.id===deletedId));assert.ok(savedRows.some(r=>r.id===insertedId));
 assert.ok(savedRows.findIndex(r=>r.id===insertedId)<savedRows.findIndex(r=>r.id===editedId));
 assert.equal(savedRows.find(r=>r.id===editedId).quantity,'7');
 results.push({page:'Quote Sheet',revision:quoteSaved.revision,editedId,insertedId,deletedId});
 fs.writeFileSync(path.join(outDir,'saved-complete-job.json'),JSON.stringify(quoteSaved,null,2));
 // Destroy the page entirely: a new page has no component state or sessionStorage.
 await page.close();page=await browser.newPage();page.setDefaultTimeout(60000);
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(baseUrl,{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForSelector('#estimate-builder-file-menu-button');
 await page.click('#estimate-builder-file-menu-button');
 const targetName=target.data.inputDataSheet.rows.projectName.value;
 await page.waitForFunction(name=>[...document.querySelectorAll('[role="menuitem"]')].some(b=>b.innerText.includes(name)),{},targetName);
 await page.evaluate(name=>[...document.querySelectorAll('[role="menuitem"]')].find(b=>b.innerText.includes(name)).click(),targetName);
 await page.waitForFunction(name=>document.querySelector('#data-edit-inputDataSheet-projectName')?.value===name,{},targetName);
 const reopened=await liveWorkbook();
 assert.equal(reopened.jobId,target.jobId);
 for(const key of ['data','quotation','formulas','formulaRows','clientPage','cashflowPayments','productLibrary','windowsDoors']) assert.ok(isDeepStrictEqual(reopened[key],quoteSaved.workbook[key]),`Restored ${key} differs`);
 assert.ok(isDeepStrictEqual(await record('job:'+other.jobId),otherBefore),'Other job changed');
 assert.equal(await page.$eval('#data-edit-inputDataSheet-lowerExternalWallLining',e=>e.value),'Battened and plasterboard lined');
 await clickText('Calculations');await page.waitForSelector('#formula-edit-lowerSlabAreaM2');
 assert.equal(await page.$eval('#formula-edit-lowerSlabAreaM2',e=>e.value),'123+7');
 await clickText('Quote Sheet');await page.waitForSelector(rowSelector(editedId));
 assert.equal(await page.$eval(rowSelector(editedId)+' input[id^="quote-edit"]',e=>e.value),'Persisted edited description');
 await page.screenshot({path:path.join(outDir,'reopened.png'),fullPage:false});
 // Exercise the actual persistence implementation against this browser's real database.
 const good=await record('job:'+target.jobId);
 const rejected=await page.evaluate(async ({source,good})=>{
  const module=await import('data:text/javascript;base64,'+btoa(source));
  const incomplete={...good.workbook};delete incomplete.productLibrary;
  try {
   await module.persistCompleteJob({key:good.key,workbook:incomplete,name:good.name,savedAt:new Date().toISOString(),storeName:'jobs',
    openDatabase:()=>new Promise((resolve,reject)=>{const r=indexedDB.open('estimate-builder-template-db',2);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)}),
    activePointer:r=>({key:r.key})});
   return {rejected:false};
  } catch(error) {return {rejected:true,reason:error.message};}
 },{source:fs.readFileSync('lib/construction-estimation/jobPersistence.js','utf8'),good});
 assert.equal(rejected.rejected,true);assert.match(rejected.reason,/missing saved section productLibrary/);
 assert.ok(isDeepStrictEqual(await record('job:'+target.jobId),good),'Rejected partial save changed the valid job');
 results.push({test:'actual persistence rejects partial payload in native IndexedDB transaction',...rejected,previousRevisionPreserved:good.revision});
 const report={ok:true,storage:'IndexedDB estimate-builder-template-db / jobs',jobId:target.jobId,results,checksum:quoteSaved.checksum,bytes:JSON.stringify(quoteSaved.workbook).length,otherJobUnchanged:true,fullUnmountAndReopen:true,errors};
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(outDir,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,outDir}));
} catch(e){console.log('FAIL',e.message,errors,await page.evaluate(()=>document.body.innerText.slice(0,1800)));await page.screenshot({path:path.join(outDir,'failure.png'),fullPage:false}).catch(()=>{});throw e;} finally {await browser.close();}
