import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import {createClient} from '@supabase/supabase-js';
import {getMasterProducts} from '../lib/product-library/catalogueService.js';
import {getProductLibraryRoomCategory, productBelongsToRoomCategory} from '../lib/product-library/productLibraryTaxonomy.js';
import {masterProductMatchesFilters} from '../lib/product-library/productLibraryFilters.js';
import {rowsFromCsv} from '../lib/product-library/productLibraryExchange.js';
import {exteriorSectionForProduct} from '../lib/product-library/exteriorCatalogueSections.js';

dotenv.config({path:'.env.local',quiet:true});dotenv.config({path:'.env',quiet:true});
const baseUrl=process.env.PRODUCT_LIBRARY_TEST_BASE_URL||'http://localhost:3000';
const out=path.resolve('artifacts/test-artifacts/door-category-separation');fs.mkdirSync(out,{recursive:true});
const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL;
const admin=createClient(supabaseUrl,process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const {data:link,error}=await admin.auth.admin.generateLink({type:'magiclink',email:process.env.PRODUCT_LIBRARY_TEST_EMAIL||'support@gr8result.com'});if(error)throw error;
const client=createClient(supabaseUrl,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||process.env.SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const {data:auth,error:authError}=await client.auth.verifyOtp({type:'magiclink',token_hash:link.properties.hashed_token});if(authError)throw authError;
const {data:members,error:memberError}=await admin.from('workspace_members').select('workspace_id').eq('user_id',auth.user.id).eq('status','active');if(memberError)throw memberError;
const database=[];
for(const {workspace_id} of members){
 const categories=await admin.from('builder_product_categories').select('id,category_name').or(`workspace_id.eq.${workspace_id},workspace_id.is.null`);if(categories.error)throw categories.error;
 const categoryById=new Map(categories.data.map(c=>[c.id,c.category_name]));
 const rows=[];
 for(let offset=0;;offset+=1000){const result=await admin.from('builder_products').select('*').eq('workspace_id',workspace_id).order('id').range(offset,offset+999);if(result.error)throw result.error;rows.push(...result.data);if(result.data.length<1000)break;}
 const doorCandidates=rows.filter(p=>/door|corinthian|hume|handle|lock|hinge/i.test(`${p.product_name} ${categoryById.get(p.category_id)||''}`)).map(p=>({id:p.id,name:p.product_name,category:categoryById.get(p.category_id)||'',family:p.metadata?.productEntity?.familyKey||p.metadata?.familyKey||''}));
 const suspects=doorCandidates.filter(p=>/furniture|hardware|handle/i.test(`${p.category} ${p.family}`)&&/corinthian|hume|door leaf|complete.*door/i.test(p.name));
 database.push({workspaceId:workspace_id,productsAudited:rows.length,doorCandidates,suspects});
}
fs.writeFileSync(path.join(out,'database-audit.json'),JSON.stringify(database,null,2));
assert(database.every(w=>!w.suspects.length),'Review database door furniture suspects before declaring audit complete');

const master=getMasterProducts();
const doors=master.filter(p=>p.familyKey==='entry-doors');
const hardware=master.filter(p=>productBelongsToRoomCategory(p,getProductLibraryRoomCategory('external-door-furniture')));
const ids=products=>products.map(p=>p.productId).sort();
const browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,defaultViewport:{width:1500,height:1000},protocolTimeout:120000});
const errors=[],checks=[];let page;
try {
 page=await browser.newPage();page.setDefaultTimeout(60000);
 page.on('pageerror',e=>errors.push(e.message));
 await page.setRequestInterception(true);
 page.on('request',request=>['GET','HEAD','OPTIONS'].includes(request.method())?request.continue():request.abort('blockedbyclient'));
 await page.evaluateOnNewDocument(({key,session,workspaceId})=>{localStorage.setItem(key,JSON.stringify(session));if(workspaceId)localStorage.setItem('active_workspace_id',workspaceId);},{key:`sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`,session:auth.session,workspaceId:members[0]?.workspace_id});
 const route=category=>`${baseUrl}/modules/estimate-builder?page=productLibrary&room=exterior${category?`&roomCategory=${category}`:''}`;
 const waitCount=async count=>page.waitForFunction(count=>document.querySelectorAll('[data-room-product]').length===count,{},count);
 const cardIds=()=>page.$$eval('[data-room-product]',cards=>cards.map(c=>c.dataset.roomProduct).sort());
 const screenshot=async name=>{
  await page.$eval('[data-testid="product-library-category-page"]',element=>element.scrollIntoView({block:'start'})).catch(()=>{});
  await page.screenshot({path:path.join(out,`${name}.png`)});
 };
 await page.goto(route(''),{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForSelector('.category-tile[data-room-category="external-door-furniture"]');
 const tiles=await page.$$eval('.category-tile',cards=>cards.map(c=>({key:c.dataset.roomCategory,text:c.innerText})));
 assert(tiles.some(c=>c.key==='entry-doors'&&c.text.includes('Doors / Entry Doors')));
 assert(tiles.some(c=>c.key==='external-door-furniture'&&c.text.includes('Door Furniture / Handles')));
 await screenshot('01-separated-exterior-categories');
 await page.click('.category-tile[data-room-category="external-door-furniture"]');
 await waitCount(hardware.length);assert.deepEqual(await cardIds(),ids(hardware));
 const brandOptions=await page.$$eval('[data-testid="product-category-filters"] select',nodes=>[...nodes[0].options].map(o=>o.value));
 assert(!brandOptions.some(b=>/Corinthian|Hume/i.test(b)));
 assert(brandOptions.includes('Gainsborough'));
 await screenshot('02-hardware-only');checks.push({category:'external-door-furniture',count:hardware.length,completeDoors:0});
 const downloadDir=fs.mkdtempSync(path.join(out,'csv-'));
 const cdp=await page.createCDPSession();await cdp.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:downloadDir});
 await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='Download All Door Furniture / Handles CSV').click());
 const csvFile=path.join(downloadDir,'external-door-furniture.csv');
 for(let i=0;i<100&&!fs.existsSync(csvFile);i++)await new Promise(r=>setTimeout(r,100));
 const csv=rowsFromCsv(fs.readFileSync(csvFile,'utf8'));
 assert.equal(csv.length,hardware.length);assert(!csv.some(row=>Object.values(row).some(value=>/Corinthian|Hume/i.test(String(value)))));
 const search='[placeholder="Search products, models, brands or codes"]';
 await page.type(search,'Corinthian');await waitCount(0);await screenshot('03-hardware-search-no-doors');
 await page.$eval(search,input=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'');input.dispatchEvent(new Event('input',{bubbles:true}));});
 await page.type(search,'Gainsborough');const gainsborough=hardware.filter(p=>masterProductMatchesFilters(p,{search:'Gainsborough'}));await waitCount(gainsborough.length);assert.deepEqual(await cardIds(),ids(gainsborough));
 checks.push({search:'Corinthian',hardwareResults:0},{search:'Gainsborough',hardwareResults:gainsborough.length});
 await page.goto(route('door-furniture'),{waitUntil:'domcontentloaded'});await waitCount(Math.min(48,hardware.length));
 while(await page.$$eval('button',bs=>bs.some(b=>b.innerText.startsWith('Show more products')))){await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.innerText.startsWith('Show more products')).click());await new Promise(r=>setTimeout(r,100));}
 assert.deepEqual(await cardIds(),ids(hardware));checks.push({legacyExteriorAlias:true,completeDoors:0});
 await page.evaluate(()=>[...document.querySelectorAll('[data-testid="exterior-section-tabs"] button')].find(b=>b.innerText==='Entrance Handles').click());
 const handles=hardware.filter(p=>exteriorSectionForProduct(p,'external-door-furniture')==='entrance-handles');
 await waitCount(handles.length);
 assert.equal(new URL(page.url()).searchParams.get('roomCategory'),'door-furniture','Hardware tabs must preserve the legacy selection route');
 assert((await cardIds()).every(id=>handles.some(p=>p.productId===id)));
 checks.push({hardwareTab:'entrance-handles',legacyAliasPreserved:true});
 await page.goto(route('entry-doors'),{waitUntil:'domcontentloaded'});await waitCount(doors.length);assert.deepEqual(await cardIds(),ids(doors));
 await screenshot('04-entry-doors-only');checks.push({category:'entry-doors',count:doors.length,hardware:0});
 for(const model of ['PRU 21','AWO 2','AWO 2G','AWO 5','AWO 21','PCL 1AG','EXADECO 1S'])assert(doors.some(p=>p.model===model||p.productName.endsWith(model)),model);
 await page.goto(route('external-door-furniture'),{waitUntil:'domcontentloaded'});await page.reload({waitUntil:'domcontentloaded'});await waitCount(hardware.length);assert.deepEqual(await cardIds(),ids(hardware));
 await screenshot('05-hardware-after-reload');
 assert.deepEqual(errors,[]);
 const report={passed:true,url:page.url(),masterProductsAudited:master.length,completeDoorDesigns:doors.filter(p=>p.attributes.recordType==='entry_door_design').length,entryDoorRecords:doors.length,hardwareRecords:hardware.length,databaseRowsChanged:0,productRecordsChanged:0,duplicatesCreated:0,mappingChange:'Separate entry-doors and external-door-furniture in shared category queries, filters, exports and navigation',checks,database,uncertain:[],errors,doors:doors.map(p=>({id:p.productId,code:p.productCode,name:p.productName,recordType:p.attributes.recordType||p.attributes.optionType}))};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({...report,doors:undefined,database:database.map(d=>({...d,doorCandidates:undefined}))},null,2));
}catch(error){if(page){await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'failure.txt'),await page.$eval('body',b=>b.innerText).catch(()=>''));}throw error;}finally{await browser.close();}
