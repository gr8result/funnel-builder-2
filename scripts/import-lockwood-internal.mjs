import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {normalizeFurnitureFinish} from '../lib/product-library/doorFurnitureVariants.js';
const dir='data/product-library/source-evidence/lockwood-internal',file='data/product-library/catalogues/internal/AU-INTERNAL-AREAS-CATALOGUE.json',media='/images/product-library/internal-areas/lockwood';
const catalogue=JSON.parse(await fs.readFile(file)),details=JSON.parse(await fs.readFile(`${dir}/product-details.json`));
await fs.mkdir('public'+media,{recursive:true});
const products=[],images=[],skipped=[];let packagingDuplicates=0;
const unique=v=>[...new Set(v)];
const finishes={CP:'Bright chrome',SC:'Brushed satin chrome',SP:'Satin chrome pearl',MBK:'Matt black',SS:'Satin stainless steel',PS:'Polished stainless steel',PB:'Polished brass',BU:'Polished brass unlacquered',SB:'Satin brass',AB:'Architectural bronze',AU:'Architectural bronze unlacquered',AC:'Antique copper',ORB:'Oil rubbed bronze'};
async function localImage(url) {
 const local=`${media}/${createHash('sha256').update(url).digest('hex').slice(0,20)}.jpg`;
 try{await fs.access('public'+local);}catch{const r=await fetch(url,{signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error(`${r.status} ${url}`);await fs.writeFile('public'+local,Buffer.from(await r.arrayBuffer()));}
 const m=await sharp('public'+local).metadata();if(m.width<100||m.height<100)throw Error('Undersized '+url);
 if(!images.some(i=>i.local===local))images.push({local,sourceUrl:url,width:m.width,height:m.height,copyright:'ASSA ABLOY / Lockwood; manufacturer product illustration, copyright retained',verification:'Official product gallery mapping; exact design, finish may differ'});
 return local;
}
function variant(code,fn,finish,description='',extra={}) {return {variantId:`lockwood:${code}`,productCode:code,function:fn,finish:normalizeFurnitureFinish(finish),description,price:null,priceStatus:'quote_required',active:true,...extra};}
async function add({model,name,range,type,style,compatibility,source,image,variants,description}) {
 const code='INT-LOCKWOOD-DESIGN-'+model.replace(/[^a-z0-9]+/gi,'-').toUpperCase();
 const local=image.startsWith('/images/')?image:await localImage(image);const fv=unique(variants.map(v=>v.finish));
 products.push({product_code:code,product_id:'master-'+code,manufacturer_identity:`lockwood:design:${model}`,brand:'Lockwood',manufacturer:'Lockwood',supplier:'Lockwood',product_name:name,model,sku:model,range,family_key:'door-hardware',requirement_keys:['door-hardware'],top_level_area:'interior',category_key:'Internal Door Furniture',description:description||`${name}. ${compatibility} Choose a published function and finish. Latches and accessories are included only where specified in the chosen order code.`,finish:fv.join(' / '),size:'',material:'See manufacturer specification',profile:style,price_unit:'EACH',unit:'EACH',client_price:null,rrp:null,price_status:'quote_required',primary_image_url:local,gallery_images:[],image_source_url:image,image_status:'verified_range',image_verified_at:new Date().toISOString(),official_product_url:source,source_url:source,source_type:'official_manufacturer',source_name:'Lockwood Australia / ASSA ABLOY',source_retrieved_at:new Date().toISOString(),active:true,archived:false,discontinued:false,attributes:{internalAreasCatalogue:true,lockwoodControlledCatalogue:true,manufacturerIdentity:`lockwood:design:${model}`,handleUse:'internal-door',hardwareType:type,furnitureType:type,style,doorCompatibility:compatibility,compatibleLatchOrBackset:compatibility,function:unique(variants.map(v=>v.function)).join(' / '),functionOptions:unique(variants.map(v=>v.function)),finishOptions:fv,controlledVariants:variants.map(v=>({...v,imageUrl:local,imageStatus:'verified_range',officialProductUrl:source})),sourceCodeAliases:variants.flatMap(v=>[v.productCode,...(v.orderCodeAliases||[])]),applicableRooms:['internal-areas','bedrooms','living-areas'],imageSources:[{url:local,sourceUrl:image}],imageVerificationStatus:'verified_range',imageScope:'Official image of this design; selected finish or function may differ.',priceNote:'Quote required; no manufacturer retail price published.',clientSelectable:true,quotationEnabled:true}});
}
// Import only explicitly listed order codes. Square-rose conversion kits are separate accessories.
for(const p of details.filter(p=>/Velocity/.test(p.title)&&p.title!=='Velocity accessories'&&!/square-series/.test(p.link.url))) {
 const rows=p.sections.find(s=>s.title==='Ordering')?.column1?.table?.tableItems||[];
 const variants=[];
 for(const row of rows.filter(r=>r.partNumber)) {
  const code=row.partNumber.trim(),finishCode=code.match(/(MBK|SC|SP|CP)(?:DP)?$/)?.[1];
  const fn=/Dummy/i.test(row.description)?'Dummy':/Privacy/i.test(row.description)?'Privacy':/Passage/i.test(row.description)?'Passage':/Mortice/i.test(row.description)?'Mortice furniture':({'0':'Mortice furniture','1':'Passage','2':'Privacy','3':'Dummy'}[code.match(/^VSR([0-3])\//)?.[1]]||'');
  if(!finishCode||!fn){skipped.push({code,reason:'Unrecognised published option'});continue;}
  const identity=code.replace(/DP$/,'');const existing=variants.find(v=>v.productCode===identity);
  if(existing){existing.orderCodeAliases.push(code);packagingDuplicates++;continue;}
  variants.push(variant(identity,fn,finishes[finishCode],row.description,{orderCodeAliases:code===identity?[]:[code],latch:/No Latch/.test(row.description)?'Not included':fn==='Dummy'?'Not applicable':fn==='Mortice furniture'?'Compatible mortice latch required':'60 mm tubular latch'}));
 }
 if(!variants.length){skipped.push({url:p.link.url,reason:'No explicit ordering rows'});continue;}
 const diameter=p.title.includes('63mm')?'63':'55',lever=variants[0].productCode.match(/\/((?:L)?[0-9]+A?)/)?.[1]||p.title.match(/Lever (\w+)$/)?.[1];
 await add({model:`Velocity-${diameter}-${lever}`,name:p.title.replace(/^Lockwood /,''),range:`Velocity ${diameter} mm round rose`,type:'Lever set',style:'Contemporary round rose',compatibility:diameter==='63'?'32–45 mm hinged doors; 60 mm backset tubular latch.':'Velocity small round rose; 60 mm tubular latch or compatible mortice lock according to function.',source:p.link.url,image:p.images[0].url,variants});
}
const accessory=details.find(p=>p.title==='Velocity accessories');
for(const im of accessory.images) {
 const model=im.label,kind=model.includes('TRIM')?'Rose trim':/[56]$/.test(model)?'Escutcheon':'Turnknob';
 const fn=model.includes('TRIM')?'Passage':model.endsWith('5')?'Euro escutcheon':model.endsWith('6')?'Oval escutcheon':'Privacy';
 const finishKeys=model.includes('TRIM')?['SC','CP','SP','MBK']:['SC','CP','MBK'];
 await add({model,name:`Velocity ${model} ${kind}`,range:'Velocity roses and escutcheons',type:kind,style:model.startsWith('VSS')?'Square rose':'Round rose',compatibility:'Velocity small rose furniture; verify lever/escutcheon clearance with the selected mortice lock. Trim is supplied as a pair.',source:accessory.link.url,image:im.url,variants:finishKeys.map(f=>variant(model+f,fn,finishes[f]))});
}
const pull=details.find(p=>p.title==='Lockwood Stainless Steel Flush Pulls');
const pullRows=pull.sections.find(s=>s.title==='Ordering').column1.table.tableItems.filter(r=>r.partNumber);
for(const model of unique(pullRows.map(r=>r.partNumber.replace(/(?:MBK|SS|PS)$/,'')))) {
 const rows=pullRows.filter(r=>r.partNumber.startsWith(model));
 await add({model,name:`${model} stainless steel flush pull`,range:'Stainless steel flush pulls',type:'Door pull',style:model.startsWith('FP1')?'Rectangular flush pull':'Recessed flush pull',compatibility:'Recessed fixing to sliding doors; fixing screws included. No latch or backset required.',source:pull.link.url,image:pull.images.find(i=>i.label.startsWith(model)).url,variants:rows.map(r=>variant(r.partNumber,'Pull',finishes[r.partNumber.match(/(MBK|SS|PS)$/)[1]],r.description))});
}
const knob=details.find(p=>/1360.*Knob 20/.test(p.title));
await add({model:'1360-20',name:'1360 Series Knob 20',range:'1360 Series brass furniture',type:'Knob set',style:'Round brass knob on rose',compatibility:'Lockwood 3770 Selector / 3570 Synergy mortice latches or 5260 tubular latch. Latch ordered separately.',source:knob.link.url,image:knob.images[0].url,variants:['SC','CP','PB','BU','SB','AB','AU','AC','ORB'].flatMap(f=>[variant(`1360/1361/20${f}`,'Passage',finishes[f],'Full furniture set; latch separate'),variant(`1360/20${f}`,'Half set',finishes[f]),variant(`1364/20${f}`,'Dummy',finishes[f])])});
const latchSource='https://www.lockweb.com.au/au/en/documents/catalogues/general-hardware/Lockwood%20General%20Hardware%20Catalogue.pdf';
const latchLocal=`${media}/5260-tubular-latch.jpeg`;await fs.copyFile(`${dir}/5260-page-34-image-415.jpeg`,'public'+latchLocal);
// Original embedded manufacturer JPEG, extracted without editing from catalogue page 34.
const latchCodes=['5260/1SFTCP','5260/1SFTPB','5260/1SFTSC','5260/1SFTSP','5260/1DIRCP','5260/1SFDSC','5260/2DIRCP','5260/2SFDSC'];
// Use the original embedded JPEG for the latch record.
const before=products.length;
await add({model:'5260',name:'5260 Tubular Latch',range:'5260 tubular latches',type:'Latch',style:'Tubular latch',compatibility:'60 mm backset; horizontal through fixing door furniture.',source:latchSource,image:latchLocal,variants:latchCodes.map(code=>variant(code,code.includes('/2')?'Privacy':'Passage',finishes[code.slice(-2)],code.includes('SFT')?'Square faceplate / T strike':code.includes('DIR')?'Drive-in / round strike':'Square faceplate / D strike'))});
const latch=products[before];latch.primary_image_url=latchLocal;latch.image_source_url=latchSource+'#page=34';latch.attributes.imageSources=[{url:latchLocal,sourceUrl:latch.image_source_url}];latch.attributes.controlledVariants.forEach(v=>v.imageUrl=latchLocal);images.push({local:latchLocal,sourceUrl:latch.image_source_url,width:265,height:212,copyright:'ASSA ABLOY / Lockwood; original embedded catalogue image',verification:'5260 latch photo on catalogue page 34'});
// Preserve legacy records and IDs, but remove the entrance-lock photographs from internal browsing.
const old=catalogue.products.filter(p=>p.brand==='Lockwood'&&!p.attributes?.lockwoodControlledCatalogue);
for(const p of old) {
 if(p.attributes.function==='Entrance'){p.attributes.handleUse='external-door';p.top_level_area='exterior';p.category_key='External Door Furniture';continue;}
 p.attributes.legacyImageUrl=p.attributes.legacyImageUrl||p.primary_image_url;p.primary_image_url='';p.image_status='review_required';p.attributes.imageVerificationStatus='review_required';p.attributes.reviewReason='Official Symmetry gallery depicts a keyed entrance lock. Internal function photograph unresolved.';p.active=false;p.attributes.clientSelectable=false;
}
const preserved=catalogue.products.filter(p=>!p.attributes?.lockwoodControlledCatalogue);
for(const p of preserved.filter(p=>p.brand==='Gainsborough'&&p.family_key==='door-hardware')) {
 p.attributes.manufacturerFinishLabels=p.attributes.manufacturerFinishLabels||p.attributes.finishOptions;
 p.finish=normalizeFurnitureFinish(p.finish);p.attributes.finishOptions=unique((p.attributes.finishOptions||[]).map(normalizeFurnitureFinish));
}
catalogue.products=[...preserved,...products];catalogue.updatedAt=new Date().toISOString();await fs.writeFile(file,JSON.stringify(catalogue,null,2)+'\n');
const report={importedProducts:products.length,controlledVariants:products.reduce((n,p)=>n+p.attributes.controlledVariants.length,0),imagesVerified:unique(products.map(p=>p.primary_image_url)).length,packagingDuplicatesPrevented:packagingDuplicates,rerunDuplicatesPrevented:products.length,legacyRecordsPreserved:old.length,unresolvedLegacyImages:unique(old.filter(p=>p.attributes.function!=='Entrance').map(p=>p.range)),skipped,images};
await fs.writeFile(`${dir}/import-report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({...report,images:undefined,skipped:undefined},null,2));
