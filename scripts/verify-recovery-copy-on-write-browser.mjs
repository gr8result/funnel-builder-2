import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import puppeteer from "puppeteer";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });

const baseUrl = process.env.PRODUCT_LIBRARY_TEST_URL || "http://localhost:3012/modules/estimate-builder?page=dataInput";
const ownerEmail = process.env.PRODUCT_LIBRARY_TEST_EMAIL || "support@gr8result.com";
const outDir = path.join(process.cwd(), "test-artifacts", "recovery-copy-on-write", String(Date.now()));
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
const fixturePath=process.env.RECOVERY_TEST_FIXTURE || 'recovery/emergency-2026-09-05T00-42-37-307Z/0001-job_03-09_123_snapshot_2026-09-04T21_10_42.804Z.raw.json';
const archived=JSON.parse(fs.readFileSync(fixturePath,'utf8'));
// Restore an actual archived recovered workbook into an isolated browser's protected source key.
// No changes to the user's browser profile or the archival file.
const key='job:03-09/123',jobId='03-09/123',backupKey=key+':snapshot:recovery-original';
const original={...archived,key};
const results=[];
try {
 console.log('Initialize isolated browser');
 await page.goto(baseUrl,{waitUntil:'domcontentloaded',timeout:180000});await page.waitForSelector('#estimate-builder-file-menu-button');
 await page.evaluate(async original=>{
  await new Promise((resolve,reject)=>{const req=indexedDB.open('estimate-builder-template-db',2);req.onerror=()=>reject(req.error);req.onsuccess=()=>{const db=req.result;const tx=db.transaction('jobs','readwrite');tx.objectStore('jobs').add(original,original.key);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)};});
  localStorage.setItem('estimate-builder-explicit-active-job-key',original.key);
 },original);
 console.log('Open protected recovered job');
 await page.reload({waitUntil:'domcontentloaded',timeout:180000});await page.waitForSelector('#data-edit-inputDataSheet-drivewayM2');
 const working=await record(key),backup=await record(backupKey);
 assert.equal(working.jobId,jobId);assert.equal(working.recovery.originalKey,backupKey);assert.equal(working.recovery.working,true);
 assert.ok(isDeepStrictEqual(backup.originalRecord,original),'Original backup differs before editing');assert.equal(backup.immutable,true);
 results.push({step:'open protected source automatically creates working revision',revision:working.revision,backupKey});
 await input('#data-edit-inputDataSheet-drivewayM2','60');
 await input('#data-edit-inputDataSheet-salesCommissionPercent','4');
 console.log('Save Driveway 60, Sales Commissions 4');
 const saved=await save();
 assert.equal(saved.workbook.data.inputDataSheet.rows.drivewayM2.value,'60');assert.equal(saved.workbook.data.inputDataSheet.rows.salesCommissionPercent.value,'4');
 const saveStatus=await page.$eval('[data-testid="job-persistence-status"]',e=>e.innerText);
 assert.ok(!saveStatus.includes('failed'));results.push({step:'normal Save',revision:saved.revision,status:saveStatus});
 // Names with different slashes remain labels, never separate storage identities.
 for(const name of ['New Job 03/09/123','New Job 03-09','New Job 03/09']) {
  await input('#data-edit-inputDataSheet-projectName',name);const renamed=await save();assert.equal(renamed.key,key);assert.equal(renamed.jobId,jobId);
  results.push({step:'display name change',name,key:renamed.key,jobId:renamed.jobId});
 }
 console.log('Destroy page and reopen same job');
 await page.close();page=await browser.newPage();page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(baseUrl,{waitUntil:'domcontentloaded',timeout:180000});await page.waitForSelector('#estimate-builder-file-menu-button');
 await page.click('#estimate-builder-file-menu-button');
 await page.waitForFunction(()=>[...document.querySelectorAll('[role="menuitem"]')].some(b=>b.innerText.includes('Job #: 03-09/123')));
 await page.evaluate(()=>[...document.querySelectorAll('[role="menuitem"]')].find(b=>b.innerText.includes('Job #: 03-09/123')).click());
 await page.waitForSelector('#data-edit-inputDataSheet-drivewayM2');
 assert.equal(await page.$eval('#data-edit-inputDataSheet-drivewayM2',e=>e.value),'60');
 assert.equal(await page.$eval('#data-edit-inputDataSheet-salesCommissionPercent',e=>e.value),'4');
 assert.equal((await liveWorkbook()).jobId,jobId);
 const preserved=await record(backupKey);assert.ok(isDeepStrictEqual(preserved,backup),'Protected original was modified');
 const keys=await page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('estimate-builder-template-db',2);r.onsuccess=()=>{const db=r.result;const q=db.transaction('jobs','readonly').objectStore('jobs').getAllKeys();q.onsuccess=()=>{db.close();resolve(q.result)};q.onerror=()=>reject(q.error)};}));
 assert.ok(!keys.some(k=>['job:new-job-03-09','job:new-job-03-09-123'].includes(k)),'Display name generated conflicting job key');
 await page.$eval('#data-edit-inputDataSheet-drivewayM2',el=>el.scrollIntoView({block:'center'}));await page.screenshot({path:path.join(outDir,'reopened-driveway.png')});
 await page.$eval('#data-edit-inputDataSheet-salesCommissionPercent',el=>el.scrollIntoView({block:'center'}));await page.screenshot({path:path.join(outDir,'reopened-commissions.png')});
 assert.deepEqual(errors,[]);
 const report={ok:true,fixturePath,fixtureBytes:fs.statSync(fixturePath).size,storage:'IndexedDB estimate-builder-template-db / jobs',jobId,key,backupKey,originalUnchanged:true,driveway:'60',salesCommissions:'4',fullReloadAndReopen:true,results,errors};
 fs.writeFileSync(path.join(outDir,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,outDir}));
} catch(e){console.log('FAIL',e.message,errors,await page.evaluate(()=>document.body.innerText.slice(0,2000)));await page.screenshot({path:path.join(outDir,'failure.png')}).catch(()=>{});throw e;}finally{await browser.close();}
