import {useState} from 'react';
import VerifiedProductImage from '../product-library/VerifiedProductImage';
import {EXTERIOR_HARDWARE_BRANDS,exteriorHardwareType,exteriorHardwarePage} from '../../lib/builders/exteriorHardwareWizard.js';

// Brand and hardware-type cards are chosen from a photo, so each one shows a product that
// actually belongs to it. The first option carrying an image wins; VerifiedProductImage
// handles the empty case, so a group with no imagery still renders a proper card.
function representativeImage(items = []) {
  return items.find((item) => item.imageUrl)?.imageUrl || '';
}

// A step of the existing door wizard. All products are supplied by its canonical selector.
export default function ExteriorHardwareWizard({options,selectedCode,finish,door,values={},ui={},onUiChange,onOptionsChange,onSelect,onFinishChange,onLocationChange,onContinue}) {
 const [details,setDetails]=useState(null);
 const stage=ui.stage||'brand',brand=ui.brand||'',type=ui.type||'',page=ui.page||0;
 const selected=options.find(p=>p.productCode===selectedCode);
 const types=[...new Set(options.filter(p=>p.brand===brand).map(exteriorHardwareType))];
 const result=exteriorHardwarePage(options,brand,type,page);
 const grid={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,220px),1fr))',gap:16,maxWidth:1040};
 const next=patch=>onUiChange({...ui,...patch});
 const choose=item=>{onSelect(item);onOptionsChange({quantity:door.quantity,size:item.sizeOptions?.[0]||item.dimensions||'',lockType:item.lockOptions?.[0]||item.lockingType||'',entryClassification:item.entryClassification||''});next({stage:'options'});};
 return <section data-testid="entry-door-hardware-step" data-hardware-stage={stage}>
  <h2>Exterior Door Furniture</h2><p>{door.doorReference} · {door.location} · {door.level}</p>
  <nav aria-label="Door furniture steps" style={{display:'flex',gap:8,flexWrap:'wrap'}}>{[['brand','1. Brand'],['type','2. Hardware type'],['product','3. Product'],['options','4. Options']].map(([key,label])=><button type="button" key={key} disabled={key!=='brand'&&!brand||['product','options'].includes(key)&&!type||key==='options'&&!selected} aria-current={stage===key?'step':undefined} onClick={()=>next({stage:key})}>{label}</button>)}</nav>
  {stage==='brand'?<div style={grid} data-testid="entry-door-furniture-brands">{EXTERIOR_HARDWARE_BRANDS.map(b=>{const brandOptions=options.filter(p=>p.brand===b);return <button type="button" className="guidedSupplierCard hardwareChoiceCard" key={b} data-furniture-brand={b} onClick={()=>next({brand:b,type:'',page:0,stage:'type'})}><VerifiedProductImage src={representativeImage(brandOptions)} name={`${b} entry door furniture`} style={{width:'100%',height:180}}/><strong>{b}</strong><span>{brandOptions.length} products</span></button>;})}</div>:null}
  {stage==='type'?<div style={grid} data-testid="entry-door-hardware-types">{types.map(t=>{const typeOptions=options.filter(p=>p.brand===brand&&exteriorHardwareType(p)===t);return <button type="button" className="guidedSupplierCard hardwareChoiceCard" key={t} data-hardware-type={t} onClick={()=>next({type:t,page:0,stage:'product'})}><VerifiedProductImage src={representativeImage(typeOptions)} name={`${t} door hardware`} style={{width:'100%',height:180}}/><strong>{t}</strong><span>{typeOptions.length} products</span></button>;})}</div>:null}
  {stage==='product'?<><h3>{brand} · {type}</h3><p>{result.total} available products</p><div style={grid}>{result.products.map(p=><article className="guidedProductCard" key={p.productCode} data-furniture-product={p.productCode}><VerifiedProductImage src={p.imageUrl} name={p.productName} style={{width:'100%',height:200}}/><strong>{p.productName}</strong><span>{p.range} · {p.model}</span><span>{p.finishOptions?.join(' / ')||'Finish to be confirmed'}</span><span>{p.lockingType}</span><p>{p.clientExplanation}</p><div className="guidedProductActions"><button type="button" className="primary" onClick={()=>choose(p)}>Select</button><button type="button" onClick={()=>setDetails(p)}>View Details</button></div></article>)}</div><div style={{display:'flex',gap:12,marginTop:16}}><button type="button" disabled={!page} onClick={()=>next({page:page-1})}>Previous products</button><span>Page {page+1} of {Math.max(1,result.pages)}</span><button type="button" disabled={page+1>=result.pages} onClick={()=>next({page:page+1})}>Next products</button></div></>:null}
  {stage==='options'&&selected?<div className="entryDoorOptionPanel" data-testid="entry-door-hardware-options"><h3>{selected.productName}</h3><VerifiedProductImage src={selected.imageUrl} name={selected.productName} style={{width:'100%',height:220}}/>
   <label>Finish {selected.finishOptions?.length?<select aria-label="Hardware finish" value={finish} onChange={e=>onFinishChange(e.target.value)}>{selected.finishOptions.map(f=><option key={f}>{f}</option>)}</select>:<span>Supplier confirmation required</span>}</label>
   <label>Size {selected.sizeOptions?.length?<select aria-label="Hardware size" value={values.size||selected.sizeOptions[0]} onChange={e=>onOptionsChange({...values,size:e.target.value})}>{selected.sizeOptions.map(s=><option key={s}>{s}</option>)}</select>:<span>{selected.dimensions||'Manufacturer has not published a size option'}</span>}</label>
   <label>Lock / function <select aria-label="Hardware lock function" value={values.lockType||selected.lockingType||''} onChange={e=>onOptionsChange({...values,lockType:e.target.value})}>{(selected.lockOptions?.length?selected.lockOptions:[selected.lockingType||'']).map(l=><option key={l} value={l}>{l||'Supplier confirmation required'}</option>)}</select></label>
   <p>Keyed / keyless / smart: {selected.entryClassification||'Supplier confirmation required'}</p>
   <label>Quantity <input aria-label="Hardware quantity" type="number" min="1" value={values.quantity??door.quantity} onChange={e=>onOptionsChange({...values,quantity:e.target.value})}/></label>
   <label>Door location <input aria-label="Hardware door location" value={door.location} onChange={e=>onLocationChange(e.target.value)}/></label>
   <button type="button" className="primary" disabled={!(Number(values.quantity??door.quantity)>0)||(selected.finishOptions?.length>0&&!finish)} onClick={onContinue}>Review complete door selection</button>
  </div>:null}
  {details?<div role="dialog" aria-modal="true" aria-label="Hardware details" className="modalBackdrop"><section className="entryDoorDetailsModal"><h2>{details.productName}</h2><VerifiedProductImage src={details.imageUrl} name={details.productName} style={{height:240}}/><p>{details.clientExplanation}</p><p>{details.model} · {details.dimensions} · {details.lockingType}</p><a href={details.productUrl} target="_blank" rel="noreferrer">Manufacturer details</a><button type="button" onClick={()=>setDetails(null)}>Close details</button></section></div>:null}
 </section>;
}
