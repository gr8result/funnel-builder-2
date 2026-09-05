import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import puppeteer from "puppeteer";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });

const baseUrl = process.env.PRODUCT_LIBRARY_TEST_URL || "http://localhost:3012/modules/estimate-builder?page=productLibrary&room=exterior";
const ownerEmail = process.env.PRODUCT_LIBRARY_TEST_EMAIL || "support@gr8result.com";
const outDir = path.join(process.cwd(), "test-artifacts", "bricks-card");
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
const page=await browser.newPage();page.setDefaultTimeout(120000);
await page.evaluateOnNewDocument(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key:storageKey,session});
const selector='.category-tile[data-room-category="bricks"]';
try {
 await page.goto(baseUrl,{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForSelector(selector);
 const capture=()=>page.$eval(selector,el=>{const image=el.querySelector('.tile-image');const style=getComputedStyle(image);const rect=image.getBoundingClientRect();return {text:el.innerText,width:rect.width,height:rect.height,src:image.getAttribute('src'),fit:style.objectFit,background:style.backgroundImage,loaded:image.tagName==='IMG'&&image.complete&&image.naturalWidth>0,naturalWidth:image.naturalWidth};});
 const before=await capture();
 if(process.argv.includes('--baseline')) {fs.writeFileSync(path.join(outDir,'baseline.json'),JSON.stringify(before,null,2));console.log(before);}
 else {
  const baseline=JSON.parse(fs.readFileSync(path.join(outDir,'baseline.json'),'utf8'));
  await page.reload({waitUntil:'domcontentloaded',timeout:180000});await page.waitForSelector(selector+' img');
  await page.waitForFunction(selector=>{const img=document.querySelector(selector+' img');return img?.complete&&img.naturalWidth>0;},{},selector);
  const after=await capture();
  if(after.text!==baseline.text||after.width!==baseline.width||after.height!==baseline.height||after.fit!=='cover'||!after.loaded||!after.src.startsWith('/images/'))throw Error('Card image, dimensions or count failed: '+JSON.stringify({baseline,after}));
  const uses=await page.$$eval('img[src="/images/catalogues/product-library/categories/exterior-brickwork.webp"]',els=>els.length);if(uses!==1)throw Error('Image used outside Bricks card');
  await page.$eval(selector,el=>el.scrollIntoView({block:'center'}));await page.screenshot({path:path.join(outDir,'refreshed.png')});
  await page.click(selector);await page.waitForSelector('[data-testid="product-library-category-page"][data-room-category="bricks"]');
  const report={ok:true,baseline,after,link:page.url(),imageUsedOnlyOnBricks:true,refreshVerified:true};fs.writeFileSync(path.join(outDir,'report.json'),JSON.stringify(report,null,2));console.log(report);
 }
}finally{await browser.close();}
