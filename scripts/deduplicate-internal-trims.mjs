import fs from 'node:fs';
import {trimIdentity,trimRates} from '../lib/product-library/cataloguePresentation.js';
const file='data/product-library/catalogues/internal/AU-INTERNAL-AREAS-CATALOGUE.json';
const catalogue=JSON.parse(fs.readFileSync(file,'utf8'));
const trims=catalogue.products.filter(p=>['skirting','architraves'].includes(p.family_key));
const backup='data/product-library/source-evidence/internal-finishing/trims-before-deduplication.json';
fs.mkdirSync('data/product-library/source-evidence/internal-finishing',{recursive:true});
if(!fs.existsSync(backup)) fs.writeFileSync(backup,JSON.stringify(trims,null,2));
const groups=new Map();
for(const p of trims){const key=trimIdentity(p);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p);}
const merges=[];
const canonical=[...groups].map(([identity,rows])=>{
  rows.sort((a,b)=>a.product_code.localeCompare(b.product_code));
  const p=structuredClone(rows[0]);
  const verified=rows.find(r=>r.price_verified_at&&r.client_price!=null);
  let lm=p.attributes.price_per_linear_metre;
  let basis=p.attributes.priceBasis || 'builder_catalogue_estimate';
  if(lm==null&&verified){const length=Number(verified.attributes.lengthOptions?.[0]?.match(/[\d.]+/)?.[0]);if(length>0){lm=verified.client_price/length;basis='verified_supplier_price_conversion';}}
  if(lm==null){
    const material=p.material.toLowerCase();
    const base=/oak/.test(material)?12:/meranti/.test(material)?8:/pine/.test(material)?5.5:3.5;
    lm=Math.round(base*(p.attributes.widthMm/66)*(p.attributes.thicknessMm/12)*100)/100;
  }
  const rates=trimRates(lm);
  const aliases=[...new Set(rows.flatMap(r=>[r.product_code,r.product_id,r.model,r.sku,...(r.attributes.sourceCodeAliases||[])]).filter(Boolean))];
  p.finish ||= 'Unfinished';
  p.product_name=`${p.profile} ${p.attributes.widthMm} × ${p.attributes.thicknessMm} mm ${p.material} ${p.finish} — 5.4 m`;
  p.range=p.profile;
  p.description=`${p.profile} profile for ${(p.attributes.productTypes||[]).join(' and ')}. ${p.size}; ${p.material}; ${p.finish}. Builder standard stock length 5.4 m; supplier availability must be confirmed.`;
  p.client_price=rates.price_per_stock_length;p.rrp=null;p.price_status='current';p.price_unit='LENGTH';p.unit='LENGTH';p.currency='AUD';p.gst_included=true;
  Object.assign(p,rates);
  p.attributes={...p.attributes,...rates,trimIdentity:identity,sourceCodeAliases:aliases,stockLengthBasis:'Builder standard stock length, confirm supplier availability',lengthOptions:['5.4 m'],finishOptions:[p.finish],priceBasis:basis,priceIncludesGst:true,priceNote:basis==='builder_catalogue_estimate'?'Editable builder catalogue estimate, AUD including GST. Not a verified supplier price.':'Converted from verified supplier price, AUD including GST.',originalSourceVariants:rows.flatMap(r=>r.attributes.originalSourceVariants||[{code:r.product_code,sku:r.sku,length:r.attributes.lengthOptions,price:r.client_price,priceVerifiedAt:r.price_verified_at,sourceUrl:r.source_url}])};
  if(basis==='builder_catalogue_estimate'){p.price_source_url='';p.price_verified_at='';p.price_source_type=basis;}
  if(rows.length>1)merges.push({canonical:p.product_code,identity,mergedCodes:rows.map(r=>r.product_code),removed:rows.length-1});
  return p;
});
catalogue.products=[...catalogue.products.filter(p=>!['skirting','architraves'].includes(p.family_key)),...canonical];
catalogue.updatedAt=new Date().toISOString();
fs.writeFileSync(file,JSON.stringify(catalogue,null,2)+'\n');
const report={before:trims.length,duplicatesRemoved:trims.length-canonical.length,mergedRecords:merges.reduce((n,m)=>n+m.mergedCodes.length,0),mergedGroups:merges.length,final:canonical.length,enabled:canonical.filter(p=>p.active).length,stockLength:5.4,verifiedPriceConversions:canonical.filter(p=>p.attributes.priceBasis==='verified_supplier_price_conversion').length,builderEstimates:canonical.filter(p=>p.attributes.priceBasis==='builder_catalogue_estimate').length,merges};
if(report.duplicatesRemoved||!fs.existsSync('data/product-library/catalogues/internal/TRIM-DEDUPLICATION-REPORT.json'))fs.writeFileSync('data/product-library/catalogues/internal/TRIM-DEDUPLICATION-REPORT.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
