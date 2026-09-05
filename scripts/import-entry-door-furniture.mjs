import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {source,cacheDir} from './inspect-door-furniture-sources.mjs';
const output=process.env.ENTRY_FURNITURE_OUTPUT || 'data/product-library/catalogues/exterior/AU-ENTRY-DOOR-FURNITURE-CATALOGUE.json';
const media='/images/product-library/entry-door-furniture';
const clean=v=>String(v?.['en-AU']??v??'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const slug=v=>clean(v).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const unique=a=>[...new Set(a.filter(Boolean))];
const products=[],failures=[];
async function image(url){
  if(!url)return '';const name=createHash('sha256').update(url).digest('hex').slice(0,24)+'.webp';const dest=path.resolve('public'+media,name);
  try{await fs.access(dest);}catch{const r=await fetch(url,{signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error(`Image ${r.status} ${url}`);await fs.mkdir(path.dirname(dest),{recursive:true});await sharp(Buffer.from(await r.arrayBuffer())).resize({width:1000,height:1000,fit:'inside',withoutEnlargement:true}).webp({quality:88}).toFile(dest);}
  return `${media}/${name}`;
}
async function add({brand,name,model,range='',type,description='',url,images=[],finishes=[],attrs={},retailPrice=null,sku=''}){
  if(!name||!model)throw Error(`Missing manufacturer model ${url}`);
  const identity=`${brand.toLowerCase()}:${model.toLowerCase()}`;
  if(products.some(p=>p.manufacturer_identity===identity))return;
  const downloaded=[];
  for(const src of unique(images).slice(0,5)){try{downloaded.push({url:await image(src),sourceUrl:src});}catch(e){failures.push({url:src,error:e.message});}}
  products.push({product_code:`EDF-${slug(brand)}-${slug(model)}`.toUpperCase(),manufacturer_identity:identity,manufacturer:brand,brand,supplier:brand,product_name:name,model,manufacturer_sku:sku,range,description:description||`${name}. ${type} for an entrance-door hardware selection.`,family_key:'entry-door-furniture',top_level_area:'exterior',category:'External Door Furniture',category_key:'external-door-furniture',product_type:'Entry Door Furniture',room_keys:['exterior'],row_classification:'actual_product',active:true,client_selections_enabled:true,clientSelectionsEnabled:true,unit:'EACH',rate:null,price:null,supplier_price:null,price_status:'price_pending',rate_status:'Rate required',manufacturer_retail_price:retailPrice,primary_image_url:downloaded[0]?.url||'',gallery_images:downloaded.slice(1).map(i=>i.url),official_product_url:url,source_url:url,source_name:`${brand} official product page`,source_checked_at:new Date().toISOString().slice(0,10),finish:finishes.join(', '),attributes:{handleUse:'entry-door',hardwareType:type,choiceType:type,finishOptions:finishes,lockingType:'',entryClassification:'',compatibleDoorThickness:'',doorCompatibility:'',material:'',coastalSuitability:'',fireRating:'',accessibilityCompliance:'',dimensions:'',...attrs,clientExplanation:description||`${name}. ${type} for an entrance-door hardware selection.`,gallery:downloaded.slice(1).map(i=>({url:i.url,label:name})),imageSources:downloaded,verificationStatus:'verified_product',rateStatus:'Rate required'}});
}
async function run(label,fn){try{await fn();}catch(e){failures.push({url:label,error:e.message});console.error(label,e.message);}}
async function lemaar(){
  const urls=new Set();const queue=['https://lemaar.com.au/products/door-entry/','https://lemaar.com.au/products/digital-locks/front-door-smart-lock/'];const seen=new Set();
  while(queue.length){const url=queue.shift();if(seen.has(url))continue;seen.add(url);const {doc}=await source(url);
    for(const a of doc.querySelectorAll('a[href]')){const h=a.href.split('#')[0];if(!h.startsWith('https://lemaar.com.au/products/'))continue;
      if(/\/door-entry\/(?:door-pulls|entrance-sets|entry-locks|security-deadbolts|security-sets)\/[^/?]+\/$/.test(h)||/\/digital-locks\/front-door-smart-lock\/[^/?]+\/$/.test(h))urls.add(h);
      else if(/\/door-entry\/?\?start=\d+$/.test(h)||/\/door-entry\/(?:door-pulls|entrance-sets|entry-locks|security-deadbolts|security-sets)\/$/.test(h))queue.push(h);
    }
  }
  console.log('Lemaar pages',urls.size);
  for(const url of urls)await run(url,async()=>{const {doc}=await source(url);doc.querySelectorAll('script,style,header,footer,nav').forEach(n=>n.remove());const text=clean(doc.body.textContent);const field=(label,next)=>text.match(new RegExp(label+':\\s*(.*?)\\s*(?:'+next+':|Available from)'))?.[1]||'';
    const name=clean(doc.querySelector('h1')?.textContent),model=field('Model Number','Colours'),finish=field('Colours','Material'),material=field('Material','Fire Rated'),fire=field('Fire Rated','DDA Compliant'),dda=field('DDA Compliant','Available from');
    const type=url.includes('digital-locks')?'Smart lock':url.includes('security-deadbolts')?'Deadbolt':url.includes('security-sets')?'Security set':url.includes('door-pulls')?'Entrance pull handle':url.includes('entry-locks')?'Entry lock':'Entrance set';
    const imgs=[...doc.querySelectorAll('img')].map(i=>i.src).filter(s=>/\/assets\/Uploads\//.test(s)&&!/_Thumbnail|front-door-handle-bunnings|home-page|white-door-handle-bunnings|Line-Drawing/i.test(s));
    const dim=unique(text.match(/\b\d+(?:\s*[x×–-]\s*\d+)*\s*mm\b/gi)||[]).join('; ');
    await add({brand:'Lemaar',name,model,sku:model,range:name.split(/ Entrance| Entry| Security| Deadbolt| Door Pull| - /)[0],type,url,images:imgs.slice(0,2),finishes:finish?[finish]:[],attrs:{material,fireRating:fire,accessibilityCompliance:dda,dimensions:dim,handleLength:/pull/i.test(type)?dim:'',lockingType:type==='Entrance pull handle'?'Non-locking pull handle; lock selected separately':type,entryClassification:type==='Smart lock'?'smart':type==='Entrance pull handle'?'non-locking':'keyed',coastalSuitability:/marine.grade|coastal/i.test(text)?(text.match(/[^.]*?(?:marine.grade|coastal)[^.]*\./i)?.[0]||'Marine grade stated by manufacturer'):'',cylinderConfiguration:text.match(/C4 \d Pin Cylinder/i)?.[0]||''}});
  });
}
async function gainsborough(){
  let data;for(const file of await fs.readdir(cacheDir)){if(!file.endsWith('.responses.json'))continue;const responses=JSON.parse(await fs.readFile(path.join(cacheDir,file),'utf8'));data ||=responses.find(r=>r.url.includes('contentfragmentlist'))?.data;}
  if(!data)throw Error('Capture an official Gainsborough product page first.');
  for(const item of data.items||[]){const raw=item.elements?.salsifyJson?.value;if(!raw)continue;const {parent={},children=[]}=JSON.parse(raw);
    const tags=item.elements?.productTags?.value||[];
    if(!tags.some(t=>/entrance-hardware|entrance-smart/.test(t)))continue;
    const url=`https://www.gainsboroughhardware.com.au/en/products/${item.title}.html`;
    const candidates=children.filter(c=>clean(c.Web)!=='No'&&clean(c['Brand (AU)']||parent['Brand (AU)'])==='Gainsborough');
    const eligible=candidates.filter(c=>{const p={...parent,...c};const text=clean(p['Product Name_Title'])+' '+clean(p['Function Name']);return /entrance|deadbolt|pull handle|key.in/i.test(text)&&!/dummy|sliding|screen|strike|rebate/i.test(text);});
    if(!eligible.length)continue;
    await run(url,async()=>{await source(url);for(const child of eligible){const p={...parent,...child};const get=k=>clean(p[k]);const name=get('Product Name_Title');const type=/smart|wi.fi|electronic/i.test(name)?'Smart lock':/deadbolt/i.test(name)?'Deadbolt':/pull handle/i.test(name)?'Entrance pull handle':/knob/i.test(name)?'Key-in-knob entrance set':/lever/i.test(name)?'Key-in-lever entrance set':'Entrance set';
      const copy=get('General Marketing Copy');const dims=['Lever Length (mm)','Individual Height (mm)','Individual Width (mm)','Individual Depth (mm)'].map(k=>get(k)?`${k}: ${get(k)}`:'').filter(Boolean).join('; ');
      await add({brand:'Gainsborough',name,model:get('ID')||get('salsify:id'),sku:get('ID')||get('salsify:id'),range:get('Range'),type,url,images:[get('Product Image'),get('Lifestyle Image')].filter(s=>s.startsWith('http')),finishes:[get('Finish Name')].filter(Boolean),attrs:{dimensions:dims,handleLength:get('Lever Length (mm)'),lockingType:get('Function Name')+(get('Locking / Non-Locking')?` — ${get('Locking / Non-Locking')}`:''),entryClassification:/smart|wi.fi|electronic/i.test(name)?'smart':get('Locking / Non-Locking')==='Non-Locking'?'non-locking':'keyed',compatibleDoorThickness:get('Required Door Thickness (mm)'),doorCompatibility:get('Applications'),material:get('Material')||(/316/.test(copy)?'316 stainless steel':''),coastalSuitability:/coastal/i.test(copy)?'Manufacturer describes suitability for coastal homes':'',backset:get('Backset'),cylinderConfiguration:/Double Cylinder/i.test(name)?'Double cylinder':/Single Cylinder/i.test(name)?'Single cylinder':'',externalUseSuitability:/not exposed to direct weather/i.test(copy)?'Entry doors not exposed to direct weather':get('Applications')}});
    }});
  }
}
async function lockwood(){
  const paths=['door-locks/locksets','door-locks/deadbolts','keyless-smart-products/smart-products','door-handles-levers-and-knobs/push-pull-furniture'];
  for(const p of paths){const api=`https://www.lockweb.com.au/rest/api/v1/product-listing.productgrid.branches.json/au/en/products/${p}`;await run(api,async()=>{const r=await fetch(api);if(!r.ok)throw Error(`${r.status}`);const data=await r.json();await fs.writeFile(path.join(cacheDir,`lockwood-${slug(p)}.listing.json`),JSON.stringify({url:api,data}));
    for(const item of data.items||[]){if(!/symmetry|nexion|paradigm|entrance|smart|005|7106|7107|construct|184|185|Brass 38|P2\/2SSS/i.test(item.title)||/rebate|commercial|obsolete/i.test(item.title)||/^Lockwood (Entrance Handles|Pull Handles)$/.test(item.title))continue;
      await run(item.link.url,async()=>{if(/interior|internal/i.test(item.title))return;const {doc}=await source(item.link.url);doc.querySelectorAll('script,style,header,footer,nav').forEach(n=>n.remove());const text=clean(doc.body.textContent);const name=item.title;const type=/smart/i.test(name)?'Smart lock':/pull handle/i.test(name)?(/lockset/i.test(name)?'Entrance handle and lock combination':'Entrance pull handle'):/deadbolt|005/i.test(name)?'Deadbolt':/knob/i.test(name)?'Key-in-knob entrance set':/lever/i.test(name)?'Key-in-lever entrance set':'Entrance set';
        const finishMatches=unique(text.match(/Satin Chrome|Polished Chrome|Chrome Plate|Matt Black|Satin Stainless Steel|Polished Brass|Satin Brass/gi)||[]);
        await add({brand:'Lockwood',name,model:name.replace(/^Lockwood /,'').replace(/[®™]/g,''),range:/Symmetry/.test(name)?'Symmetry':/Paradigm/.test(name)?'Paradigm':/Nexion/.test(name)?'Nexion':'',type,url:item.link.url,description:clean(item.text),images:[item.image?.url,...[...doc.querySelectorAll('img')].map(i=>i.src).filter(s=>s.includes('gw-assets'))],finishes:finishMatches,attrs:{lockingType:/double cylinder/i.test(name)?'Double cylinder':/single cylinder/i.test(name)?'Single cylinder':type,entryClassification:type==='Smart lock'?'smart':'keyed',dimensions:unique(text.match(/\b\d+(?:\s*[-–x]\s*\d+)*\s*mm\b/g)||[]).join('; '),doorCompatibility:/residential/i.test(text)?'Residential doors':'',material:text.match(/316 (?:grade )?stainless steel/i)?.[0]||'',coastalSuitability:text.match(/[^.]*coastal[^.]*\./i)?.[0]||'',accessibilityCompliance:text.match(/AS\s*1428(?:\.1)?/i)?.[0]||''}});
      });
    }
  });}
}
async function zanda(){
  const {doc}=await source('https://zanda.com.au/product/matt-black-roller-lock-kits/');
  const {doc:category}=await source('https://zanda.com.au/product-category/locks-latches-cylinders/');
  const safetyUrl=[...category.querySelectorAll('a[href]')].find(a=>a.textContent.trim()==='Safety Latches')?.href;
  const safety=safetyUrl?(await source(safetyUrl)).doc:null;
  const links=unique([...doc.querySelectorAll('a[href]'),...(safety?[...safety.querySelectorAll('a[href]')]:[])].map(a=>a.href)).filter(u=>/\/product\//.test(u)&&/roller-lock-kits|aldo-entrance|duke-pull-handle|polo-pull-handle|stealth-smart|round-slimline-deadbolt|euro-mortice-lock|euro-profile-cylinder|matt-black-cylinders|tubular-latch/.test(u)&&!/sliding/.test(u));
  for(const url of links)await run(url,async()=>{const {doc}=await source(url);const name=clean(doc.querySelector('h1')?.textContent);const desc=clean(doc.querySelector('#tab-description')?.textContent);const variants=JSON.parse(doc.querySelector('form.variations_form')?.getAttribute('data-product_variations')||'[]');const rows=Array.isArray(variants)&&variants.length?variants:[{sku:clean(doc.querySelector('.sku')?.textContent),attributes:{},image:{src:doc.querySelector('.woocommerce-product-gallery img')?.src}}];
    for(const v of rows){if(v.variation_is_active===false||!v.sku||v.sku==='N/A')continue;const choice=clean(Object.values(v.attributes||{}).join(' / '));if(/passage|privacy|dummy/i.test(choice))continue;
      const type=/smart/i.test(name)?'Smart lock':/deadbolt/i.test(name)?'Deadbolt':/pull handle/i.test(name)?'Entrance pull handle':/cylinder/i.test(name)?'Cylinder':/latch/i.test(name)?'Latch':/mortice/i.test(name)?'Mortice lock':/kit/i.test(name)?'Entrance lock kit':'Entrance set';
      const finish=name.match(/(?:–|—|-)\s*(Matt Black|Satin Brass|Graphite Nickel|Stainless Steel|Satin Chrome)/i)?.[1]||(/matt black/i.test(name)?'Matt Black':'');
      const img=v.image?.full_src||v.image?.src;const gallery=[...doc.querySelectorAll('.woocommerce-product-gallery img')].map(i=>i.getAttribute('data-large_image')||i.src);
      await add({brand:'Zanda',name:choice?`${name} — ${choice}`:name,model:v.sku,sku:v.sku,range:name,type,url,images:[img,...gallery],finishes:finish?[finish]:[],retailPrice:Number.isFinite(v.display_price)?Math.round(v.display_price*100)/100:null,attrs:{dimensions:unique(choice.match(/\b\d+(?:\s*[x×–-]\s*\d+)*\s*mm\b/gi)||[]).join('; '),lockingType:type==='Entrance pull handle'?'Non-locking pull handle; lock selected separately':choice||type,entryClassification:type==='Smart lock'?'smart':type==='Entrance pull handle'?'non-locking':'keyed',material:desc.match(/316 (?:Marine Grade )?Stainless Steel/i)?.[0]||'',coastalSuitability:/coastal/i.test(desc)?'Manufacturer states coastal suitability':'',doorCompatibility:desc.match(/(?:timber|wood)[^.]{0,120}doors/i)?.[0]||'',backset:choice.match(/\d+mm backset/i)?.[0]||desc.match(/\d+mm backset/i)?.[0]||''}});
    }
  });
}
for(const [name,fn] of [['Lockwood',lockwood],['Gainsborough',gainsborough],['Lemaar',lemaar],['Zanda',zanda]]){await run(name,fn);console.log(name,products.filter(p=>p.brand===name).length);}
let existing=[];try{existing=JSON.parse(await fs.readFile(output,'utf8')).products||[];}catch{}
const byIdentity=new Map(existing.map(p=>[p.manufacturer_identity,p]));for(const p of products)byIdentity.set(p.manufacturer_identity,p);
const result={schemaVersion:1,name:'Australian Entry Door Furniture',updatedAt:new Date().toISOString(),products:[...byIdentity.values()]};
// Preserve the existing catalogue identity for this verified brand/model match.
for(const p of result.products)if(p.manufacturer_identity==='lockwood:paradigm pull handle lockset - deadbolt')p.product_code='ENTRY-DOOR-FURNITURE-LOCKWOOD-PARADIGM-PULL-DEADBOLT';
await fs.writeFile(output,JSON.stringify(result,null,2)+'\n');
const report={importedAt:result.updatedAt,brands:Object.fromEntries(['Lockwood','Gainsborough','Lemaar','Zanda'].map(b=>{const ps=products.filter(p=>p.brand===b);return [b,{products:ps.length,missingImages:ps.filter(p=>!p.primary_image_url).length,missingSKUs:ps.filter(p=>!p.manufacturer_sku).length,missingModels:ps.filter(p=>!p.model).length,missingRates:ps.filter(p=>p.rate===null).length}]})),failures};
await fs.writeFile('data/product-library/catalogues/exterior/ENTRY-DOOR-FURNITURE-IMPORT-REPORT.json',JSON.stringify(report,null,2)+'\n');console.log(report);
