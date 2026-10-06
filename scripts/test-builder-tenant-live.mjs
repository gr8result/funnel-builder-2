// Read-only smoke checks against the local app; uses an isolated browser profile.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import {createClient} from '@supabase/supabase-js';
import puppeteer from 'puppeteer';
import {CURRENT_BUILDER_WORKSPACE_ID} from '../lib/builders/currentBuilderSeed.js';
dotenv.config({path:'.env.local',quiet:true}); dotenv.config({path:'.env',quiet:true});
const url=process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const admin=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY,{auth:{persistSession:false}});
const {data:link,error}=await admin.auth.admin.generateLink({type:'magiclink',email:process.env.PRODUCT_LIBRARY_TEST_EMAIL || 'support@gr8result.com'});
if(error) throw new Error(error.message);
const authClient=createClient(url,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,{auth:{persistSession:false}});
const {data:auth,error:authError}=await authClient.auth.verifyOtp({type:'magiclink',token_hash:link.properties.hashed_token});
if(authError) throw new Error(authError.message);
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,protocolTimeout:120000});
const report={checks:[],errors:[],migrationPending:false};
try {
  const page=await browser.newPage();
  await page.evaluateOnNewDocument(({key,value,workspaceId})=>{localStorage.setItem(key,value);localStorage.setItem('active_workspace_id',workspaceId);},{key:`sb-${new URL(url).hostname.split('.')[0]}-auth-token`,value:JSON.stringify(auth.session),workspaceId:CURRENT_BUILDER_WORKSPACE_ID});
  page.on('pageerror',error=>report.errors.push(error.message));
  for (const [route,title] of [['product-library','Product Library'],['client-selections','Client Selections']]) {
    const response=await page.goto(`http://localhost:3000/modules/builders/${route}`,{waitUntil:'domcontentloaded',timeout:120000});
    assert(response.status()<400,`${route}: HTTP ${response.status()}`);
    await page.waitForFunction(title=>document.body.innerText.includes(title),{timeout:90000},title);
    await page.waitForFunction(()=>!document.body.innerText.includes('Loading builder workspace...'),{timeout:90000});
    report.checks.push(`${title} loads in authenticated builder workspace`);
  }
  const token=auth.session.access_token;
  for(const route of ['builders/selection-foundation','product-library/approved-client-selection-catalogue']) {
    const unauthorized=await fetch(`http://localhost:3000/api/${route}?workspace_id=${CURRENT_BUILDER_WORKSPACE_ID}`);
    assert.equal(unauthorized.status,401); report.checks.push(`${route} rejects anonymous reads`);
    const foreign=await fetch(`http://localhost:3000/api/${route}?workspace_id=11111111-1111-4111-8111-111111111111`,{headers:{Authorization:`Bearer ${token}`}});
    assert.equal(foreign.status,403); report.checks.push(`${route} rejects nonmember workspace reads`);
  }
  const foundation=await fetch(`http://localhost:3000/api/builders/selection-foundation?workspace_id=${CURRENT_BUILDER_WORKSPACE_ID}`,{headers:{Authorization:`Bearer ${token}`}});
  const payload=await foundation.json();
  if(foundation.ok) {
    assert.equal(payload.workspace_id,CURRENT_BUILDER_WORKSPACE_ID);
    for(const name of ['Classic Inclusions','Premier Inclusions','Premium Inclusions']) assert(payload.schedules.some(schedule=>schedule.name===name));
    report.checks.push('Three current-builder schedules load through authenticated API');
  } else {
    assert(/schema cache|does not exist|could not find/i.test(payload.error || ''),payload.error);
    report.migrationPending=true;
  }
  assert.deepEqual(report.errors,[]);
  console.log(JSON.stringify(report,null,2));
} finally {
  await fs.mkdir('artifacts/test-artifacts/tenant-foundation',{recursive:true});
  await fs.writeFile('artifacts/test-artifacts/tenant-foundation/live-smoke.json',JSON.stringify(report,null,2));
  await browser.close();
}
