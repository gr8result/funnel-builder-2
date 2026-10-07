import {useMemo,useState} from 'react';
import VerifiedProductImage from './VerifiedProductImage';
import DoorProductImage from './DoorProductImage';
import {furnitureVariants} from '../../lib/product-library/doorFurnitureVariants.js';
import {familyByKey} from '../../lib/product-library/catalogueModel.js';
import {isDoorProduct,productDisplayImage} from '../../lib/product-library/productPresentation.js';
import {internalProductOptions,prepareInternalSelection} from '../../lib/product-library/internalSelection.js';
import {ALL_DOOR_TYPES,doorFromPrice,internalDoorMeta,internalDoorSizes,queryInternalDoors} from '../../lib/product-library/internalDoorTypes.js';

// Internal Doors are browsed by DOOR TYPE (internalDoorTypes.js): Flush Panel - the standard door -
// opens first, every supplier's doors of that type are listed together, and supplier is a filter.
// Doors get the tall DoorProductImage frame; every other internal product keeps its existing image box.
const ProductImage=({product,src,name,height,size})=>isDoorProduct(product)?<DoorProductImage src={src} name={name} size={size}/>:<VerifiedProductImage src={src} name={name} style={{width:'100%',height}}/>;

const money=value=>new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD',maximumFractionDigits:0}).format(value);
const DOOR_BUTTON={minHeight:44,padding:'8px 16px',borderRadius:999,border:'1px solid #94a3b8',background:'white',color:'#0f172a',fontSize:16,fontWeight:800,cursor:'pointer'};
const DOOR_BUTTON_ACTIVE={...DOOR_BUTTON,background:'#1764d9',borderColor:'#1764d9',color:'white'};
const DOOR_FIELD={minHeight:44,fontSize:16,border:'1px solid #94a3b8',borderRadius:8,padding:'6px 10px',background:'white',color:'#0f172a'};

export default function InternalCataloguePicker({products,requirement,selection,onSelect,onBack,onSave,relatedRequirement,onOpenRelated}) {
 const isInternalDoors=requirement.requirementKey==='internal-doors';
 const saved=selection?.selected_details||selection?.guidedSelection||{};
 // Door type is the first choice; Flush Panel is the default (queryInternalDoors falls back to the
 // first type that has doors). Supplier, size and price are filters within it.
 const [doorType,setDoorType]=useState('flush'),[suppliers,setSuppliers]=useState([]),[doorSize,setDoorSize]=useState(''),[doorSort,setDoorSort]=useState('');
 const [brand,setBrand]=useState(''),[range,setRange]=useState(''),[search,setSearch]=useState(''),[page,setPage]=useState(0),[active,setActive]=useState(null),[choices,setChoices]=useState({}),[error,setError]=useState('');
 const manufacturerScoped=products;
 // Filter by type / supplier / size / search, order by standard priority, THEN paginate.
 const doorQuery=useMemo(()=>isInternalDoors?queryInternalDoors(products,{type:doorType,suppliers,size:doorSize,search,sort:doorSort,page,pageSize:24}):null,[isInternalDoors,products,doorType,suppliers,doorSize,search,doorSort,page]);
 const doorSuppliers=useMemo(()=>isInternalDoors?[...new Set(products.map(p=>p.brand).filter(Boolean))].sort():[],[isInternalDoors,products]);
 const doorSizes=useMemo(()=>isInternalDoors?internalDoorSizes(products):[],[isInternalDoors,products]);
 const filtered=useMemo(()=>manufacturerScoped.filter(p=>(!brand||p.brand===brand)&&(!range||p.range===range)&&[p.productName,p.model,p.profile,p.finish,p.description].join(' ').toLowerCase().includes(search.toLowerCase())),[manufacturerScoped,brand,range,search]);
 const open=p=>{const options=internalProductOptions(p);setChoices({variantId:furnitureVariants(p).find(v=>saved.productId===(p.productId||p.id)&&v.variantId===saved.variantId)?.variantId||furnitureVariants(p)[0]?.variantId,...Object.fromEntries(Object.entries(options).map(([k,v])=>[k,saved.productId===(p.productId||p.id)&&v.includes(saved[k])?saved[k]:v[0]||''])),quantity:saved.productId===(p.productId||p.id)?saved.quantity||1:1});setActive(p);setError('');};
 const price=p=>p.priceState==='Current Price'?new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(p.selectedCost):'Quote required';
 const shown=isInternalDoors?doorQuery.items:filtered.slice(page*24,page*24+24);
 const pageCount=isInternalDoors?doorQuery.pages:Math.max(1,Math.ceil(filtered.length/24));
 const lastPage=isInternalDoors?doorQuery.page>=doorQuery.pages-1:(page+1)*24>=filtered.length;
 const activeDoorType=isInternalDoors?doorQuery.types.find(t=>t.key===doorQuery.activeType):null;
 return <section data-testid="internal-catalogue-picker" style={{padding:20,display:'grid',gap:16}}>
  <div><button type="button" onClick={onBack}>Back to Interior selections</button> <button type="button" onClick={onSave}>Save Progress</button> {relatedRequirement&&onOpenRelated?<button type="button" data-testid="internal-related-requirement" onClick={onOpenRelated}>Also select {relatedRequirement.label} &rarr;</button>:null}</div>
  <h2>{requirement.label}</h2>{isInternalDoors?null:<p>Choose from enabled Product Library products. {filtered.length} products available.</p>}
  {saved.productId?<p data-testid="internal-saved-selection">Selected: {saved.brand} {saved.productName} · {saved.size} · {saved.finish} · {saved.function} · {saved.quantity} {saved.unit}</p>:null}
  {isInternalDoors?<div data-testid="internal-door-browser" style={{display:'grid',gap:14,fontSize:16}}>
   <div data-testid="internal-door-types" style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
    {doorQuery.types.map(t=><button type="button" key={t.key} data-testid={`internal-door-type-${t.key}`} aria-pressed={doorQuery.activeType===t.key} onClick={()=>{setDoorType(t.key);setPage(0);}} style={doorQuery.activeType===t.key?DOOR_BUTTON_ACTIVE:DOOR_BUTTON}>{t.label}{t.standard?' · Standard':''} ({t.count})</button>)}
    <button type="button" data-testid="internal-door-type-all" aria-pressed={doorQuery.activeType===ALL_DOOR_TYPES} onClick={()=>{setDoorType(ALL_DOOR_TYPES);setPage(0);}} style={doorQuery.activeType===ALL_DOOR_TYPES?DOOR_BUTTON_ACTIVE:DOOR_BUTTON}>All doors ({doorQuery.allTotal})</button>
   </div>
   <div style={{display:'flex',gap:14,flexWrap:'wrap',alignItems:'flex-end'}}>
    <label style={{display:'grid',gap:4,fontWeight:700}}>Search<input aria-label="Search internal products" data-testid="internal-door-search" placeholder="flush, hollow core, solid core..." value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}} style={{...DOOR_FIELD,minWidth:260}}/></label>
    <fieldset style={{border:0,padding:0,margin:0,display:'flex',gap:14,flexWrap:'wrap',alignItems:'center'}}><legend style={{fontWeight:700,padding:0}}>Supplier</legend>{doorSuppliers.map(b=><label key={b} style={{display:'inline-flex',gap:8,alignItems:'center',minHeight:44}}><input type="checkbox" data-testid={`internal-door-supplier-${b.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`} checked={suppliers.includes(b)} onChange={()=>{setSuppliers(c=>c.includes(b)?c.filter(x=>x!==b):[...c,b]);setPage(0);}} style={{width:20,height:20}}/>{b}</label>)}</fieldset>
    <label style={{display:'grid',gap:4,fontWeight:700}}>Size<select aria-label="Door size" data-testid="internal-door-size" value={doorSize} onChange={e=>{setDoorSize(e.target.value);setPage(0);}} style={DOOR_FIELD}><option value="">All sizes</option>{doorSizes.map(v=><option key={v}>{v}</option>)}</select></label>
    <label style={{display:'grid',gap:4,fontWeight:700}}>Price<select aria-label="Door price order" data-testid="internal-door-sort" value={doorSort} onChange={e=>{setDoorSort(e.target.value);setPage(0);}} style={DOOR_FIELD}><option value="">Standard doors first</option><option value="price-asc">Lowest price first</option><option value="price-desc">Highest price first</option></select></label>
   </div>
   <h3 data-testid="internal-door-heading" style={{margin:0,fontSize:22}}>{doorQuery.activeType===ALL_DOOR_TYPES?(search?`Results for “${search}”`:'All internal doors'):`${activeDoorType?.label} doors`}{activeDoorType?.standard?' — standard / most common':''} <span style={{fontWeight:500,fontSize:16}}>({doorQuery.total} {doorQuery.total===1?'product':'products'}, all suppliers)</span></h3>
   {activeDoorType?.description?<p style={{margin:0}}>{activeDoorType.description}</p>:null}
   {!doorQuery.total?<p data-testid="internal-door-empty" style={{margin:0,fontWeight:700}}>No doors match these filters.</p>:null}
  </div>:null}
  <div style={{display:isInternalDoors?'none':'flex',gap:12,flexWrap:'wrap'}}>{isInternalDoors?null:<label>Brand <select aria-label="Internal product brand" value={brand} onChange={e=>{setBrand(e.target.value);setRange('');setPage(0);}}><option value="">All brands</option>{[...new Set(products.map(p=>p.brand))].sort().map(b=><option key={b}>{b}</option>)}</select></label>}
   <label>Range <select aria-label="Internal product range" value={range} onChange={e=>{setRange(e.target.value);setPage(0);}}><option value="">All ranges</option>{[...new Set(manufacturerScoped.filter(p=>!brand||p.brand===brand).map(p=>p.range))].filter(Boolean).sort().map(r=><option key={r}>{r}</option>)}</select></label><label>Search <input aria-label="Search internal products" value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}}/></label></div>
  <div style={{display:'grid',gridTemplateColumns:isInternalDoors?'repeat(auto-fill,minmax(min(330px,100%),1fr))':'repeat(auto-fill,minmax(250px,1fr))',gap:16}}>{shown.map(p=><article key={p.id||p.productId} data-testid="internal-product-card" data-door-type={isInternalDoors?internalDoorMeta(p).typeKey:undefined} data-brand={p.brand} style={{padding:14,border:saved.productId===(p.productId||p.id)?'3px solid #1764d9':'1px solid #cbd5e1',borderRadius:10}}>
   <ProductImage product={p} src={p.imageUrl||p.primaryImageUrl||productDisplayImage(p,familyByKey(p.familyKey))} name={p.productName} height={220} size="card"/>{p.metadata?.productEntity?.attributes?.imageScope||p.attributes?.imageScope?<small>{p.metadata?.productEntity?.attributes?.imageScope||p.attributes?.imageScope}</small>:null}<strong>{p.brand}</strong><h3>{p.productName}</h3>{isInternalDoors?<p style={{fontSize:16,margin:0}}><b>{internalDoorMeta(p).typeLabel}</b>{internalDoorMeta(p).isStandard?' · Standard':''}{internalDoorMeta(p).core?` · ${internalDoorMeta(p).core[0].toUpperCase()}${internalDoorMeta(p).core.slice(1)}`:''}</p>:null}<p>{p.range} · {p.model}</p><p>{p.description}</p><p>{isInternalDoors&&doorFromPrice(p)!==null?`From ${money(doorFromPrice(p))}`:price(p)}</p>
   <button type="button" data-testid="select-internal-product" onClick={()=>open(p)} style={{background:'#1764d9',color:'white',padding:'10px 18px',fontWeight:700}}>{saved.productId===(p.productId||p.id)?'Selected — Change':'Select'}</button> <button type="button" onClick={()=>open(p)}>View Details</button>
  </article>)}</div>
  <div><button type="button" disabled={!page} onClick={()=>setPage(p=>p-1)}>Previous</button> <span data-testid="internal-page-label">Page {(isInternalDoors?doorQuery.page:page)+1} of {pageCount}</span> <button type="button" data-testid="internal-page-next" disabled={lastPage} onClick={()=>setPage(p=>p+1)}>Next</button></div>
  {active?<div role="dialog" aria-modal="true" aria-label="Internal product options" data-testid="internal-product-options" style={{position:'fixed',inset:0,zIndex:1500,background:'#0008',display:'grid',placeItems:'center'}}><section style={{background:'white',color:'#172337',padding:24,borderRadius:16,width:'min(620px,95vw)',maxHeight:'90vh',overflowY:'auto',display:'grid',gap:12,'--door-frame-height':'min(720px,62vh)'}}><h3>{active.brand} {active.productName}</h3><ProductImage product={active} src={active.imageUrl||active.primaryImageUrl||productDisplayImage(active,familyByKey(active.familyKey))} name={active.productName} height={160} size="detail"/><p>{active.description}</p>
   {furnitureVariants(active).length?<label>Function, finish and order code<select aria-label="Internal hardware variant" value={choices.variantId||furnitureVariants(active)[0].variantId} onChange={e=>{const v=furnitureVariants(active).find(v=>v.variantId===e.target.value);setChoices(c=>({...c,variantId:v.variantId,function:v.function,finish:v.finish}));}} style={{display:'block',width:'100%'}}>{furnitureVariants(active).map(v=><option key={v.variantId} value={v.variantId}>{v.function} · {v.finish} · {v.productCode}{v.latch?` · ${v.latch}`:''}</option>)}</select></label>:null}
   {Object.entries(internalProductOptions(active)).filter(([key])=>!furnitureVariants(active).length||!['function','finish'].includes(key)).map(([key,values])=>values.length?<label key={key}>{key==='function'?'Function':key[0].toUpperCase()+key.slice(1)}<select aria-label={`Internal ${key}`} value={choices[key]} onChange={e=>setChoices(c=>({...c,[key]:e.target.value}))} style={{display:'block',width:'100%'}}>{values.map(v=><option key={v}>{v}</option>)}</select></label>:null)}
   <label>Quantity<input aria-label="Internal quantity" type="number" min="0.01" step="any" value={choices.quantity} onChange={e=>setChoices(c=>({...c,quantity:e.target.value}))}/></label>
   <p>{(()=>{try{return price(prepareInternalSelection(active,choices));}catch{return 'Enter a valid quantity';}})()}</p><small>{(active.metadata?.productEntity?.attributes||active.attributes)?.priceNote}</small>{(active.metadata?.productEntity?.attributes||active.attributes)?.priceRegion?<small>Published {(active.metadata?.productEntity?.attributes||active.attributes).priceRegion} price, GST inclusive.</small>:null}<a href={active.productUrl||active.officialProductUrl} target="_blank" rel="noreferrer">Official manufacturer product</a>{error?<p role="alert">{error}</p>:null}
   <button type="button" onClick={()=>{try{const next=prepareInternalSelection(active,choices);onSelect(requirement,next);setActive(null);}catch(e){setError(e.message);}}} style={{background:'#1764d9',color:'white',padding:12}}>Confirm Selection</button><button type="button" onClick={()=>setActive(null)}>Cancel</button>
  </section></div>:null}
 </section>;
}
