import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import dotenv from 'dotenv';import puppeteer from 'puppeteer';import {createClient} from '@supabase/supabase-js';
import {getMasterProducts} from '../lib/product-library/catalogueService.js';
import {getProductLibraryRoomCategory,productBelongsToRoomCategory} from '../lib/product-library/productLibraryTaxonomy.js';
import {sortCatalogueProducts,INTERNAL_CATALOGUE_SECTIONS} from '../lib/product-library/cataloguePresentation.js';
dotenv.config({path:'.env.local',quiet:true});dotenv.config({path:'.env',quiet:true});
const out=path.resolve('test-artifacts/internal-finishing-live');fs.mkdirSync(out,{recursive:true});const origin='http://localhost:3000';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL,anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||process.env.SUPABASE_ANON_KEY;
const admin=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY,{auth:{persistSession:false}});const {data:link,error}=await admin.auth.admin.generateLink({type:'magiclink',email:process.env.PRODUCT_LIBRARY_TEST_EMAIL||'support@gr8result.com'});if(error)throw error;
const authClient=createClient(url,anon,{auth:{persistSession:false}});const {data:auth,error:authError}=await authClient.auth.verifyOtp({type:'magiclink',token_hash:link.properties.hashed_token});if(authError)throw authError;
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,protocolTimeout:180000,defaultViewport:{width:1600,height:1100}});
const page=await browser.newPage();page.setDefaultTimeout(90000);const errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
await page.evaluateOnNewDocument(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key:`sb-${new URL(url).hostname.split('.')[0]}-auth-token`,session:auth.session});
await page.setRequestInterception(true);page.on('request',r=>r.url().includes('/rest/v1/')&&!['GET','HEAD','OPTIONS'].includes(r.method())?r.abort():r.continue());
const go=async(category='')=>{await page.goto(`${origin}/modules/estimate-builder?page=productLibrary&room=internal-areas${category?'&roomCategory='+category:''}`,{waitUntil:'domcontentloaded',timeout:180000});await page.waitForSelector(category?'article[data-room-product]':'button[data-room-category="internal-doors"]');};
const click=async label=>{await page.waitForFunction(label=>{const b=[...document.querySelectorAll('button')].find(b=>b.innerText.trim()===label);if(!b)return false;b.click();return true;},{},label);};
const ids=()=>page.$$eval('article[data-room-product]',es=>es.map(e=>e.dataset.roomProduct));
const shot=async name=>{await page.screenshot({path:path.join(out,name+'.png')});console.log(name);};
try{
 await go();await page.waitForFunction(()=>{const i=document.querySelector('[data-room-category="internal-doors"] img');return i?.complete&&i.naturalWidth>0;});const image=await page.$eval('[data-room-category="internal-doors"] img',i=>({src:i.getAttribute('src'),ratio:i.width/i.height,natural:i.naturalWidth/i.naturalHeight,fit:getComputedStyle(i).objectFit}));assert(image.src.endsWith('category-internal-door.jpg'));assert.equal(image.fit,'cover');assert(Math.abs(image.ratio-image.natural)<0.01);await shot('01-category-cards');
 const all=getMasterProducts();
 for(const category of ['internal-doors','door-furniture','skirting-architraves','stair-components','wardrobe-systems']){
  await go(category);const products=all.filter(p=>p.active!==false&&productBelongsToRoomCategory(p,getProductLibraryRoomCategory(category)));
  for(const view of ['grid','list']){await click(view==='grid'?'Grid view':'List view');await page.waitForFunction(view=>document.querySelector('main[data-product-view]')?.dataset.productView===view,{},view);
   for(const sort of ['name','name-desc','brand','price','price-desc','updated']){const before=page.url();await page.select('[aria-label="Catalogue Sort By"]',sort);const expected=sortCatalogueProducts(products,sort).map(p=>p.productId);await page.waitForFunction(expected=>{const es=[...document.querySelectorAll('article[data-room-product]')];return es.length&&es.every((e,i)=>e.dataset.roomProduct===expected[i]);},{},expected);assert.equal(page.url(),before);checks.push({category,view,sort,rows:(await ids()).length});}
   await page.$eval('article[data-room-product]',e=>e.scrollIntoView({block:'start'}));await page.waitForFunction(()=>{const i=document.querySelector('article[data-room-product] img');return i?.complete&&i.naturalWidth>0;});await shot(category+'-'+view);
  }
  const options=await page.$$eval('[data-testid="product-library-category-page"] select',es=>es.map(e=>({first:e.options[0]?.text,text:e.textContent,values:[...e.options].map(o=>o.value)})));assert(!options.some(o=>/air fry|oven|cooktop/i.test(o.text)),category);
  for(const [key,label] of INTERNAL_CATALOGUE_SECTIONS[category]||[]){await click(label);await page.waitForFunction(()=>document.querySelectorAll('article[data-room-product]').length>0);const expected=products.filter(p=>key==='all'||p.attributes.catalogueSection===key).map(p=>p.productId);await page.waitForFunction(expected=>[...document.querySelectorAll('article[data-room-product]')].every(e=>expected.includes(e.dataset.roomProduct)),{},expected);checks.push({category,section:key,rows:(await ids()).length});}
 }
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForSelector('article[data-room-product]');assert.equal(await page.$eval('main[data-product-view]',e=>e.dataset.productView),'list');
 assert.equal(errors.length,0,errors.join('\n'));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:true,checks,image,errors},null,2));
}catch(e){await shot('failure').catch(()=>{});fs.writeFileSync(path.join(out,'failure.txt'),await page.evaluate(()=>document.body.innerText).catch(()=>''));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:false,error:e.message,checks,errors},null,2));throw e;}finally{await browser.close();}
