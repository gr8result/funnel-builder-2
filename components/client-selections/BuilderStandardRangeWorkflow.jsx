import { useMemo, useState } from 'react';
import { standardRangeDefaults, standardRangeOrder, overrideStandardLocation, restoreStandardLocation } from '../../lib/builders/builderStandardRange.js';
import { plumbingFixtureFilterOptions, filterPlumbingFixtureProducts } from '../../lib/product-library/plumbingFixtureCatalogue.js';
import { plumbingLinesFromSelection, plumbingLineFromProduct, plumbingLineWithTotals, plumbingAllocationSummary, plumbingLocationKey } from '../../lib/builders/plumbingFixtureAllocation.js';
import { serviceQuoteRequirements } from '../../lib/builders/residentialServices.js';
import { assignmentsAt, replaceAssignment } from '../../lib/builders/selectionAssignments.js';
import SelectionAssignmentsTable from './SelectionAssignmentsTable.jsx';

const money = n => n == null ? 'Supplier quote required' : new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(n);
const entity = p => p?.metadata?.productEntity || p || {};
const targetKey = l => `${l.quotationSection}::${l.quotationRowId}`;
const sameTarget = (a,b) => targetKey(a) === targetKey(b);
const currentPrice = p => {
  const e=entity(p);
  if (/pending|quote|required|unavailable/i.test(p?.priceStatus || e.priceStatus || '')) return null;
  const raw=p?.selectedCost ?? e.clientPrice;
  return raw==null || raw==='' || !Number.isFinite(Number(raw)) ? null : Number(raw);
};

export default function BuilderStandardRangeWorkflow({requirement, products=[], selection, workbook={}, projectRoomNames=[], projectRooms=[], onSelectProduct, onBack, onViewDetails}) {
  const key = requirement.requirementKey;
  const hvac = key === 'air-conditioning';
  const saved = plumbingLinesFromSelection(selection?.selected_details);
  const defaults = useMemo(()=>standardRangeDefaults(workbook,products,key),[workbook,products,key]);
  const lines = saved.length ? saved : defaults;
  const [filter,setFilter] = useState('');
  const [range,setRange] = useState('upgrades');
  const [type,setType] = useState('');
  const [facets,setFacets] = useState({});
  const [limit,setLimit] = useState(24);
  const [draft,setDraft] = useState(null);
  const [location,setLocation] = useState('');
  const [quantity,setQuantity] = useState(1);
  const [target,setTarget] = useState('');
  const [error,setError] = useState('');
  const [controller,setController] = useState('');
  const [wifi,setWifi] = useState(false);
  // An assignment being replaced ({lineId, locationKey, location, productName}) and a room that already has a product.
  const [replacing,setReplacing] = useState(null);
  const [occupied,setOccupied] = useState(null);
  const summary = plumbingAllocationSummary(lines);
  const quoteRows = serviceQuoteRequirements(workbook,key);
  const originalDefaults = [...defaults];
  for (const l of lines) if (l.standardBaseline && !originalDefaults.some(d=>sameTarget(d,l))) {
    const b=l.standardBaseline;
    originalDefaults.push({...l,...b,isBuilderStandard:true,lineId:`standard:${key}:${l.quotationSection}:${l.quotationRowId}`,
      quantity:lines.filter(x=>sameTarget(x,l)).reduce((n,x)=>n+x.quantity,0),
      allocations:lines.filter(x=>sameTarget(x,l)).flatMap(x=>x.allocations)});
  }
  const standards = originalDefaults.map(d => {
    const baseline = lines.find(l=>sameTarget(l,d) && l.standardBaseline)?.standardBaseline;
    return baseline ? {...d,...baseline,standardBaseline:baseline,unitAllowance:baseline.unitAllowance,unitPrice:baseline.unitAllowance} : d;
  });
  const commit = next => onSelectProduct(requirement,{plumbingAllocationLines:next});
  // The host initialises missing defaults only after the saved book has hydrated. A product
  // screen must never commit defaults while an existing client's selection is still loading.
  const codes = standards.map(l=>l.productCode);
  const options = plumbingFixtureFilterOptions(products);
  const visible = standardRangeOrder(filterPlumbingFixtureProducts(products,{facets}),codes).filter(p => {
    const e=entity(p);
    return (range !== 'standard' || codes.includes(e.productCode)) && (range !== 'upgrades' || !codes.includes(e.productCode)) && (!type || e.attributes?.systemType===type)
      && `${p.productName} ${p.brand} ${e.model} ${e.productType}`.toLowerCase().includes(filter.toLowerCase());
  });
  const reset = standard => commit([...lines.filter(l=>!sameTarget(l,standard)),standard]);
  // The line a product takes when it replaces another: the same quotation requirement and allowance, its own price.
  function lineLike(p, like) {
    const e=entity(p);
    const same=lines.find(l=>l.productCode===e.productCode && sameTarget(l,like));
    if (same) return same;
    const id=like.quotationRowId ? `override:${like.quotationSection}:${like.quotationRowId}:${e.productCode || p.id}` : `master-${e.productCode || p.id}`;
    return plumbingLineWithTotals({...plumbingLineFromProduct(p),lineId:id,unitPrice:currentPrice(p),unitAllowance:like.unitAllowance,originalMaterialAllowance:like.originalMaterialAllowance,
      allowancePending:like.allowancePending,standardBaseline:like.standardBaseline,quotationRowId:like.quotationRowId,quotationSection:like.quotationSection,priceBasis:like.standardBaseline?'Retail inc GST':plumbingLineFromProduct(p).priceBasis,allocations:[]});
  }
  function replaceWith(p, at) {
    const existing=lines.find(l=>l.lineId===at.lineId);
    if (existing) commit(replaceAssignment(lines,{location:at.location,existingLineId:at.lineId},lineLike(p,existing)));
    setReplacing(null);
  }
  function choose(p) {
    if (replacing) {replaceWith(p,replacing);return;}
    const standard=standards.find(s=>s.productCode===entity(p).productCode);
    if (standard) {reset(standard);return;}
    if (!hvac && !standards.length) { onSelectProduct(requirement,p); return; }
    setDraft(p); setError(''); setLocation(''); setQuantity(1);setController('');setWifi(false);
    setTarget(standards[0] ? targetKey(standards[0]) : quoteRows.length===1 ? `${quoteRows[0].section}::${quoteRows[0].rowId}` : '');
  }
  const ducted = hvac && entity(draft).attributes?.systemType === 'Ducted';
  function save(decision) {
    try {
      const e=entity(draft);
      const standard=standards.find(l=>targetKey(l)===target);
      const q=quoteRows.find(r=>`${r.section}::${r.rowId}`===target);
      if (quoteRows.length && !q) throw new Error('Choose the existing quotation item.');
      if (!ducted && !projectRoomNames.includes(location)) throw new Error('Choose a room from this project.');
      const attrs=e.attributes || {};
      const hvacDetails=hvac ? {systemType:attrs.systemType,brand:e.brand,model:e.model,supplier:e.supplier,
        ratedCoolingCapacityKw:attrs.coolingCapacityKw,designCapacityKw:null,confirmationStatus:'Supplier / Design Confirmation Required',
        zoning:ducted ? (workbook.hvacConfiguration?.standardZoning || 'Supplier design required') : null,
        numberOfZones:ducted ? workbook.hvacConfiguration?.numberOfZones ?? null : null,
        controller:controller || 'Builder standard / supplier confirmation',wifiRequested:wifi} : undefined;
      const price=currentPrice(draft);
      // A room that already has a different (non-standard) product: ask before anything is added.
      const there=ducted || hvac ? [] : assignmentsAt(lines,location).filter(a=>{const l=lines.find(x=>x.lineId===a.lineId);return l && !l.isBuilderStandard && l.productCode!==e.productCode;});
      if (there.length && !decision) {setOccupied({location,existing:there});return;}
      if (there.length && decision==='replace') {replaceWith(draft,{lineId:there[0].lineId,location});setOccupied(null);setDraft(null);return;}
      setOccupied(null);
      if (standard) {
        const replacingProjectSystem = hvac && (ducted || lines.some(l=>sameTarget(l,standard) && !l.isBuilderStandard && l.hvac?.systemType==='Ducted'));
        const base = replacingProjectSystem ? [...lines.filter(l=>!sameTarget(l,standard)),standard] : lines;
        commit(overrideStandardLocation(base,standard,draft,ducted?'Whole project':location,ducted?1:quantity,{unitPrice:price,hvac:hvacDetails}));
      } else if (hvac) {
        const room=ducted?'Whole project':location;
        const id=ducted?'hvac:project':`hvac:split:${plumbingLocationKey(room)}`;
        const allowance=q?.materialAllowance == null ? 0 : Number(q.materialAllowance)*1.1;
        const line=plumbingLineWithTotals({...plumbingLineFromProduct(draft),lineId:id,unitPrice:price,unitAllowance:allowance,priceBasis:'Retail inc GST',
          quotationRowId:q?.rowId || '',quotationSection:q?.section || '',originalMaterialAllowance:q?.materialAllowance ?? null,hvac:hvacDetails,
          allocations:[{locationKey:plumbingLocationKey(room),location:room,quantity:ducted?1:quantity}]});
        commit([...lines.filter(l=>l.lineId!==id && !(ducted && l.hvac?.systemType==='Ducted') && !(!ducted && l.hvac?.systemType==='Ducted' && sameTarget(l,line))),line]);
      } else { onSelectProduct(requirement,draft); }
      setDraft(null);
    } catch(err) {setError(err.message);}
  }
  return <section className="standardRange" data-testid={`builder-standard-range-${key}`}>
    <button type="button" onClick={onBack}>← Back</button>
    <header><span>YOUR HOME INCLUDES</span><h2>{requirement.label}</h2><p>Start with your builder’s included range. Choose an alternative only where you want a change.</p></header>
    {hvac && <p className="notice">Capacity: <strong>Supplier / Design Confirmation Required.</strong> Catalogue ratings describe the equipment; your heat-load design and supplier quotation determine the final system size.</p>}
    <h3>BUILDER STANDARD</h3>
    {standards.length ? <div className="standardCards">{standards.map(s=><article key={s.lineId} className="included" data-testid="standard-included-card">
      {s.imageUrl && <img src={s.imageUrl} alt={s.productName}/>}
      <div><strong>STANDARD INCLUDED</strong><h3>{s.productName}</h3><p>{[s.brand,s.model,s.colour,s.finish].filter(Boolean).join(' · ')}</p>
      <p>{Object.entries(s.standardBaseline.specifications || {}).filter(([k])=>/watt|kelvin|cct|motor|current|fan size/i.test(k)).map(([k,v])=>`${k}: ${v}`).join(' · ')}</p>
      <p>Qty {s.quantity} · {s.standardBaseline.source}</p><b>✓ INCLUDED IN BASE PRICE · $0 variation</b>
      <p>{lines.some(l=>sameTarget(l,s)&&!l.isBuilderStandard)?'Some locations have an override.':'Standard selected — no action required.'}</p>
      <button type="button" onClick={()=>reset(s)}>{lines.some(l=>sameTarget(l,s)&&!l.isBuilderStandard)?'Apply standard to all locations':'Use standard'}</button></div>
    </article>)}</div> : <p className="notice">{hvac?'No standard air-conditioning system is specified for this project.':'The builder has not specified an included product for these quotation items.'} The builder can set the included range in Standard Inclusions or Product Library.</p>}
    {lines.length>0 && <section aria-label="Selection totals"><SelectionAssignmentsTable lines={lines} rooms={projectRooms.length ? projectRooms : projectRoomNames.map(name=>({name}))} unitLabel={hvac?'system':key==='ceiling-fan'?'fan':'fitting'}
      expected={quoteRows.length ? quoteRows.reduce((n,r)=>n+(Number(r.quantity)||0),0) : null} replacing={replacing} onChange={commit} onReplace={hvac?null:setReplacing} onCancelReplace={()=>setReplacing(null)}/><p>Selected: {money(summary.selectedTotal)} · Allowance: {money(summary.allowanceTotal)} · Variation: {lines.some(l=>l.allowancePending)?'Builder allowance required':money(summary.variation)}</p></section>}
    {lines.filter(l=>!l.isBuilderStandard && l.standardBaseline).flatMap(l=>l.allocations.map(a=><button type="button" key={`${l.lineId}:${a.locationKey}`} onClick={()=>commit(restoreStandardLocation(lines,standards.find(s=>sameTarget(s,l)),a.locationKey))}>Use standard in {a.location}</button>))}
    {hvac && lines.filter(l=>!l.standardBaseline).map(l=><button type="button" key={l.lineId} onClick={()=>commit(lines.filter(x=>x.lineId!==l.lineId))}>Remove {l.productName}</button>)}
    <h3>UPGRADES / ALTERNATIVES</h3>
    <div className="filters"><label>Range<select value={range} onChange={e=>setRange(e.target.value)}><option value="standard">Builder standard</option><option value="upgrades">Upgrades</option><option value="all">All products</option></select></label>
      <label>Search<input value={filter} placeholder="Brand, model or fitting type" onChange={e=>{setFilter(e.target.value);setLimit(24);}}/></label>
      {!hvac && Object.entries(options.facets || {}).map(([name,values])=><label key={name}>{name}<select value={facets[name] || ''} onChange={e=>{setFacets({...facets,[name]:e.target.value});setLimit(24);}}><option value="">All</option>{values.map(v=><option key={v}>{v}</option>)}</select></label>)}
      {hvac && <label>System type<select value={type} onChange={e=>setType(e.target.value)}><option value="">All systems</option><option value="Split">Split Systems</option><option value="Ducted">Ducted Systems</option></select></label>}
    </div>
    <div className="products">{visible.slice(0,limit).map(p=>{const e=entity(p);const a=e.attributes || {};return <article key={e.productCode || p.id}>
      {(p.imageUrl || e.primaryImageUrl) && <img src={p.imageUrl || e.primaryImageUrl} alt={p.productName}/>}
      <span>{a.commonUpgrade?'COMMON UPGRADE':hvac?a.systemType+' Systems':p.brand}</span><h3>{p.productName}</h3>
      <p>{[p.colour,p.finish,a.phase].filter(Boolean).join(' · ')}</p>
      {hvac && <p>Rated cooling: {a.coolingCapacityKw ?? 'Not published'} kW · Final sizing by supplier</p>}
      <p>{codes.includes(e.productCode)?'Included in base price':money(currentPrice(p))}{!hvac && currentPrice(p)!=null && !codes.includes(e.productCode)?' each':''}</p>
      {standards.length===1 && currentPrice(p)!=null && !codes.includes(e.productCode) && <p>{standards[0].standardBaseline.allowanceKnown===false ? 'Variation: builder allowance required' : `${money(currentPrice(p)-standards[0].unitAllowance)} ${hvac?'variation':'variation each'}`}</p>}
      <button type="button" onClick={()=>onViewDetails(p)}>View details</button> <button type="button" onClick={()=>choose(p)}>Choose option</button>
    </article>;})}</div>
    {visible.length>limit && <button type="button" onClick={()=>setLimit(limit+24)}>Show more products</button>}
    {!visible.length && <p>No products match these filters.</p>}
    {draft && <div className="overlay" role="dialog" aria-modal="true" aria-label="Choose location or system"><div className="dialog"><h3>{draft.productName}</h3>
      {quoteRows.length>0 && <label>Existing quotation item<select value={target} onChange={e=>setTarget(e.target.value)}><option value="">Choose item</option>{quoteRows.map(r=><option key={`${r.section}::${r.rowId}`} value={`${r.section}::${r.rowId}`}>{r.label}{r.location ? ` - ${r.location}` : ''} · Qty {r.quantity}</option>)}</select></label>}
      {ducted ? <p>One ducted system for the whole project. Zoning: {workbook.hvacConfiguration?.standardZoning || 'Supplier design required'}{workbook.hvacConfiguration?.numberOfZones ? ` · ${workbook.hvacConfiguration.numberOfZones} zones` : ''}.</p> : <><label>Project room<select value={location} onChange={e=>setLocation(e.target.value)}><option value="">Choose room</option>{projectRoomNames.map(n=><option key={n}>{n}</option>)}</select></label><label>Quantity<input type="number" min="1" value={quantity} onChange={e=>setQuantity(Math.max(1,Math.floor(Number(e.target.value)||1)))}/></label></>}
      {ducted && entity(draft).attributes?.controllerOptions && <label>Controller preference<select value={controller} onChange={e=>setController(e.target.value)}><option value="">Builder standard / supplier confirmation</option>{entity(draft).attributes.controllerOptions.map(c=><option key={c}>{c}</option>)}</select></label>}
      {hvac && entity(draft).attributes?.wifi && <label><input type="checkbox" checked={wifi} onChange={e=>setWifi(e.target.checked)}/> Request Wi-Fi control (supplier quote required)</label>}
      {hvac && <p>Supplier / Design Confirmation Required. Installation price and final capacity are confirmed by the builder’s HVAC supplier.</p>}
      {error && <p role="alert">{error}</p>}
      {occupied ? <div className="notice" data-testid="room-occupied-prompt"><p><strong>{occupied.location}</strong> already has {occupied.existing.map(a=>`${a.productName} ×${a.quantity}`).join(' and ')}. What would you like to do?</p>
        <button type="button" onClick={()=>save('replace')}>Replace existing</button> <button type="button" onClick={()=>save('add')}>Add another</button> <button type="button" onClick={()=>setOccupied(null)}>Cancel</button></div>
      : <><button type="button" onClick={()=>setDraft(null)}>Cancel</button> <button type="button" onClick={()=>save()}>Save selection</button></>}</div></div>}
    <style jsx>{`
      .standardRange{color:#102b42;padding:20px;background:#fff;border:1px solid #d4e0ea;border-radius:12px;font-size:16px}.standardRange h2{font-size:26px}.standardRange h3{font-size:18px}.standardRange p{line-height:1.5}.standardRange header span,.included strong{color:#08766e;font-weight:800}.notice{padding:16px;background:#f1f6fa;border-radius:8px}.standardCards{display:grid;gap:16px}.included{display:flex;gap:24px;padding:22px;background:#ecfdf5;border:2px solid #0f766e;border-radius:12px}.included img{width:200px;object-fit:contain}.standardRange button{padding:10px 16px;border:1px solid #0f766e;color:#0f766e;background:white;border-radius:6px;font-size:16px;cursor:pointer}.included button{margin-top:12px;background:#0f766e;color:white}.filters{display:flex;flex-wrap:wrap;gap:16px;margin:20px 0}.standardRange label{display:grid;gap:6px}.standardRange select,.standardRange input{padding:10px;border:1px solid #bdcdd8;border-radius:6px;font-size:16px}.products{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:18px}.products article{padding:16px;border:1px solid #d4e0ea;border-radius:10px}.products img{width:100%;height:180px;object-fit:contain}.products span{color:#0f766e;font-weight:700}.standardRange table{width:100%;border-collapse:collapse}.standardRange th,.standardRange td{padding:12px;text-align:left;border-bottom:1px solid #d4e0ea}.overlay{position:fixed;inset:0;background:#102b4280;z-index:12000;display:grid;place-items:center;padding:24px}.dialog{background:white;border-radius:12px;padding:24px;max-width:650px;max-height:90vh;overflow:auto;width:100%}.dialog label{margin:15px 0}.dialog input[type=checkbox]{width:20px;height:20px}@media(max-width:700px){.included{flex-direction:column}.filters{flex-direction:column}.standardRange table{font-size:16px}}
    `}</style>
  </section>;
}
