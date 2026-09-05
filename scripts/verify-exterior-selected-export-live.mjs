import JSZip from 'jszip';
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
const report={passed:false,errors};
try {
 await page.goto(url('room=exterior&roomCategory=entry-doors&exteriorSection=entrance-locksets'),{waitUntil:'domcontentloaded'});
 await page.waitForSelector('[data-room-product] input[type="checkbox"]',{timeout:90000});
 await page.$eval('[data-room-product] input[type="checkbox"]',n=>n.click());
 const downloaded=async label=>{
  const before=new Set(fs.readdirSync(outDir));await click(label);
  for(let i=0;i<900;i++){
   const name=fs.readdirSync(outDir).find(n=>!before.has(n)&&!n.endsWith('.crdownload'));
   if(name)return path.join(outDir,name);
   await new Promise(r=>setTimeout(r,100));
  }
  throw new Error(`Download timed out: ${label}`);
 };
 const csvFile=await downloaded('Download Selected CSV');
 const rows=parseCsv(fs.readFileSync(csvFile,'utf8'));
 assert(rows.length===2,'Exactly one selected CSV record');
 const zipFile=await downloaded('Download Selected + Images ZIP');
 const zip=await JSZip.loadAsync(fs.readFileSync(zipFile));
 const packaged=parseCsv(await zip.file('catalogue.csv').async('string'));
 assert(packaged.length===2,'Exactly one selected ZIP record');
 assert(Object.keys(zip.files).some(name=>name.startsWith('images/')&&!zip.files[name].dir),'Product image included');
 assert(packaged[1][1]===rows[1][1],'Same canonical identity in selected CSV and ZIP');
 report.csv=path.basename(csvFile);report.zip=path.basename(zipFile);report.files=Object.keys(zip.files);report.passed=true;
 assert(!errors.length,errors.join('\n'));
} catch(error){report.error=error.stack;throw error;}
finally{fs.writeFileSync(path.join(outDir,'selected-export-report.json'),JSON.stringify(report,null,2));await browser.close();}
