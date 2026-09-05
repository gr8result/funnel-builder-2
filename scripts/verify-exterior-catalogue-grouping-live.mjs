import { EXTERIOR_CATALOGUE_SECTIONS, exteriorSectionForProduct } from '../lib/product-library/exteriorCatalogueSections.js';
import { getMasterProducts } from '../lib/product-library/catalogueService.js';
import XLSX from 'xlsx';
const parseCsv=text=>XLSX.utils.sheet_to_json(XLSX.read(text,{type:'string',raw:true}).Sheets.Sheet1,{header:1,defval:''});
const master=getMasterProducts();
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import puppeteer from "puppeteer";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });

const baseUrl = process.env.PRODUCT_LIBRARY_TEST_URL || "http://localhost:3000/modules/estimate-builder?page=productLibrary";
const ownerEmail = process.env.PRODUCT_LIBRARY_TEST_EMAIL || "support@gr8result.com";
const outDir = path.join(process.cwd(), "test-artifacts", "exterior-catalogue-grouping", String(Date.now()));
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

function url(query = "") {
  return `${baseUrl}${query ? `&${query}` : ""}`;
}

async function waitForSettledPage(page, selector, text = "") {
  await page.waitForSelector(selector, { visible: true, timeout: 90000 });
  if (text) {
    await page.waitForFunction((expected) => (document.body?.innerText || "").includes(expected), { timeout: 90000 }, text);
  }
  await page.waitForFunction(() => {
    const textContent = (document.body?.innerText || "").trim();
    return textContent && !/^Loading\s*\.\.\.$/i.test(textContent);
  }, { timeout: 90000 });
  await new Promise((resolve) => setTimeout(resolve, 750));
}

async function assertStable(page, label, runtimeErrors, durationMs = 15000) {
  const firstUrl = page.url();
  const start = Date.now();
  while (Date.now() - start < durationMs) {
    await new Promise((resolve) => setTimeout(resolve, 750));
    const state = await page.evaluate(() => ({
      url: location.href,
      text: document.body?.innerText || "",
    }));
    if (state.url !== firstUrl) throw new Error(`${label}: URL changed from ${firstUrl} to ${state.url}`);
    if (/^Loading\s*\.\.\.$/i.test(state.text.trim())) throw new Error(`${label}: page returned to loading-only state`);
    if (runtimeErrors.length) throw new Error(`${label}: runtime errors captured: ${runtimeErrors.join("\n")}`);
  }
}

function imageUrlFromCss(value = "") {
  return String(value || "").replace(/^url\(["']?/, "").replace(/["']?\)$/, "");
}

const { session, supabaseUrl } = await mintSession();
const storageKey = `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || supabaseUrl).hostname.split(".")[0]}-auth-token`;
const browser = await puppeteer.launch({
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: "new",
  defaultViewport: { width: 1920, height: 1080 },
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
});

const page = await browser.newPage();
page.setDefaultNavigationTimeout(180000);
page.setDefaultTimeout(90000);
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
await page.evaluateOnNewDocument(({storageKey,session})=>localStorage.setItem(storageKey,JSON.stringify(session)),{storageKey,session});
const cdp=await page.createCDPSession();
await cdp.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:outDir});
const assert=(value,message)=>{if(!value)throw new Error(message);};
const click=async text=>{await page.waitForFunction(text=>[...document.querySelectorAll('button')].some(b=>!b.disabled&&b.innerText.trim()===text),{timeout:90000},text);await page.evaluate(text=>[...document.querySelectorAll('button')].find(b=>!b.disabled&&b.innerText.trim()===text).click(),text);};
const report={sections:[],errors};
try {
 await page.goto(url('room=exterior'),{waitUntil:'domcontentloaded'});
 await page.waitForSelector('.category-tile[data-room-category="entry-doors"]',{timeout:90000});
 const cards=await page.$$eval('.category-tile',nodes=>nodes.map(n=>({key:n.dataset.roomCategory,text:n.innerText})));
 report.cards=cards;
 for(const removed of ['gutters','fascia','downpipes','external-door-furniture','door-furniture'])assert(!cards.some(c=>c.key===removed),`Unexpected card ${removed}`);
 assert(cards.filter(c=>c.key==='roofing').length===1,'One roofing card');
 assert(cards.some(c=>c.text.includes('Entry Doors & Door Furniture')),'Combined doors card');
 const image=await page.$eval('[data-room-category="entry-doors"] .tile-image',n=>getComputedStyle(n).backgroundImage);
 assert(image.includes('entrance-door-lockset.jpg'),'Local entrance lockset photo');
 await page.screenshot({path:path.join(outDir,'01-exterior.png')});
 for(const [parent,sections] of Object.entries(EXTERIOR_CATALOGUE_SECTIONS)) {
  await page.goto(url(`room=exterior&roomCategory=${parent}`),{waitUntil:'domcontentloaded'});
  await page.waitForSelector('[data-testid="exterior-section-tabs"]',{timeout:90000});
  await page.waitForFunction(()=>document.querySelectorAll('[data-room-product]').length>0,{timeout:90000});
  for(const [key,label] of sections) {
   await click(label);
   await page.waitForFunction(key=>new URL(location.href).searchParams.get('exteriorSection')===key,{},key);
   await page.waitForFunction(label=>document.querySelector('[data-testid="exterior-section-tabs"] button.selected')?.innerText.trim()===label,{},label);
   const count=await page.$$eval('[data-room-product]',ns=>ns.length);
   report.sections.push({parent,key,count});
   if(count) {
    await click('Download Current Section CSV');
    const file=path.join(outDir,`${parent}-${key}.csv`);
    for(let i=0;i<100&&!fs.existsSync(file);i++)await new Promise(r=>setTimeout(r,100));
    assert(fs.existsSync(file),`Download missing ${file}`);
    const rows=parseCsv(fs.readFileSync(file,'utf8'));
    const records=rows.slice(1).map(row=>Object.fromEntries(rows[0].map((header,i)=>[header,row[i]])));
    assert(records.length===count,`CSV count ${parent}/${key}: ${records.length} != ${count}`);
    for(const row of records) {
      const p=master.find(p=>p.productCode===row.product_code||p.productId===row.canonical_product_id||p.productId===row.product_id);
      assert(p,`Unknown canonical record ${JSON.stringify(row)}`);
      const actual=exteriorSectionForProduct(p,parent);
      assert(actual&&(key==='all'||actual===key),`Wrong section ${p.productName}: ${actual} in ${key}`);
    }
   }
  }
  await page.screenshot({path:path.join(outDir,`${parent}-sections.png`)});
 }
 assert(!errors.length,errors.join('\n'));
 report.passed=true;
} catch(error) {report.passed=false;report.error=error.stack;await page.screenshot({path:path.join(outDir,'failure.png')}).catch(()=>{});throw error;}
finally {fs.writeFileSync(path.join(outDir,'report.json'),JSON.stringify(report,null,2));await browser.close();}
