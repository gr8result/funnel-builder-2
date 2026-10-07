import EntryDoorLocations from './EntryDoorLocations';
import {useState,useEffect} from 'react';
import {useRouter} from 'next/router';
import {safeSelectionNavigate} from '../../lib/navigation/selectionNavigation';
import {exteriorEntryDoors,defaultManualEntryDoor,entryDoorDetails,patchEntryDoorDraft,furnitureProductOption,doorFurnitureSelections,updateDoorFurnitureBook} from '../../lib/builders/entryDoorFurnitureSelection';

export function useDoorFurniturePicker({workbook,projectId,workspaceId,onClientSelectionsSave,selectionBook,selectionMode}) {
  const router=useRouter();
  const enabled=(selectionMode==='client-selection'||(router.query.mode==='client-selection'&&router.query.returnPage==='clientSelections'))&&router.query.room==='exterior'&&router.query.roomCategory==='door-furniture';
  const [manualDoors,setManualDoors]=useState([]);
  const [savedBook,setSavedBook]=useState(null);
  const [product,setProduct]=useState(null);
  const [doorId,setDoorId]=useState('');
  const [finish,setFinish]=useState('');
  const [size,setSize]=useState('');
  const [lockType,setLockType]=useState('');
  const [quantity,setQuantity]=useState(1);
  const [all,setAll]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [compared,setCompared]=useState([]);
  const compare=p=>setCompared(items=>items.some(i=>i.productCode===p.productCode)?items.filter(i=>i.productCode!==p.productCode):[...items.slice(-2),furnitureProductOption(p)]);
  useEffect(()=>{setSavedBook(null);setProduct(null);setMessage('');setCompared([]);setManualDoors([]);},[projectId]);
  const book=savedBook||selectionBook||workbook?.clientSelectionsBook||workbook?.selectionsBook||{rooms:[]};
  const existingDoors=exteriorEntryDoors({workbook:workbook||{},book});
  const combined=new Map(existingDoors.map(d=>[d.id,d]));for(const d of manualDoors)combined.set(d.id,d);
  const doors=combined.size?[...combined.values()]:[defaultManualEntryDoor()];
  const selections=doorFurnitureSelections(book);
  const routeDoorId=String(router.query.door||'');
  const currentDoor=doors.find(d=>d.id===(routeDoorId||entryDoorDetails(book)[0]?.activeEntryDoorId))||doors[0];
  const isSelected=p=>selections.some(s=>s.door.id===currentDoor?.id&&s.entryDoorFurniture?.productCode===p.productCode);
  function open(p){
    const option=furnitureProductOption(p);const selected=selections.find(s=>s.door.id===currentDoor?.id&&s.entryDoorFurniture?.productCode===p.productCode);
    setProduct(option);setDoorId(currentDoor?.id||'');setFinish(selected?.furnitureFinish||option.finishOptions[0]||'');setSize(selected?.hardwareOptions?.size||option.sizeOptions[0]||'');setLockType(selected?.hardwareOptions?.lockType||option.lockOptions[0]||'');setQuantity(selected?.hardwareOptions?.quantity||currentDoor?.quantity||1);setAll(false);setError('');
  }
  async function save(remove=false){
    setBusy(true);setError('');
    try{
      if(!projectId||!onClientSelectionsSave)throw Error('Open the active job before confirming a selection.');
      if(router.query.projectId&&router.query.projectId!==projectId)throw Error('The selection route belongs to a different job. Return to Client Selections in the active job.');
      let latest=book;
      const key=`gr8:embedded-selections-book:${workspaceId}:${projectId}`;
      try{const cache=JSON.parse(localStorage.getItem(key)||'null');if(cache?.projectId===projectId&&cache.book&&(cache.book.updatedAt||cache.savedAt)>(book.updatedAt||''))latest=cache.book;}catch{}
      const targets=all?doors:doors.filter(d=>d.id===doorId);
      for(const d of targets)latest=patchEntryDoorDraft(latest,d.id,{Door:d});
      const next=updateDoorFurnitureBook(latest,targets,product,{finish,size,lockType,quantity:Number(quantity)},{remove});
      const result=await onClientSelectionsSave(next);
      if(!result?.ok)throw Error(result?.message||'Selection could not be saved.');
      setSavedBook(next);
      try{const payload=JSON.stringify({workspaceId,projectId,savedAt:next.updatedAt,book:next});localStorage.setItem(key,payload);localStorage.setItem(`gr8:embedded-selections-book:${workspaceId}:latest`,payload);}catch{}
      setMessage(remove?'Selection removed.':`${product.productName} saved to chosen inclusions for ${targets.map(d=>d.doorReference).join(', ')}.`);setProduct(null);
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  function returnToDoor(){const url=new URL(window.location.href);url.searchParams.set('page','clientSelections');url.searchParams.set('roomCategory','entry-doors');url.searchParams.set('door',currentDoor?.id||'');url.searchParams.set('doorStep','design');url.searchParams.delete('roomProduct');safeSelectionNavigate(router,url.href);}
  const panel=enabled?<>
    <section data-testid="door-furniture-selection-context" style={{padding:16,background:'#eef6ff',border:'1px solid #2563eb',borderRadius:12,margin:'16px 0'}}>
      <strong>Choose door furniture for {currentDoor?[currentDoor.doorReference,currentDoor.level,currentDoor.location].filter(Boolean).join(' / '):'an exterior entry door'}</strong>
      <p>Selections are saved to the active job. {message}</p>
      <EntryDoorLocations door={currentDoor} doors={doors} onChange={d=>setManualDoors(items=>[...items.filter(i=>i.id!==d.id),d])} onAdd={()=>{const d={...defaultManualEntryDoor(),id:`manual-entry-door:${globalThis.crypto.randomUUID()}`,doorReference:`Entry Door ${doors.length+1}`,location:`Entry ${doors.length+1}`};setManualDoors(items=>[...items,d]);}}/>
      <button type="button" onClick={returnToDoor}>Back to selected exterior door</button>
      <button type="button" onClick={()=>{const url=new URL(window.location.href);url.searchParams.set('page','clientSelections');url.searchParams.set('selectionArea','exterior');for(const key of ['room','roomCategory','roomProduct','doorStep','mode','returnPage'])url.searchParams.delete(key);safeSelectionNavigate(router,url.href);}}>Return to Exterior selections</button>
    </section>
    {compared.length?<section aria-label="Compare door furniture" style={{overflowX:'auto',padding:16}}><h2>Compare door furniture</h2><table><thead><tr><th>Product</th><th>Finish</th><th>Lock/function</th><th>Rate</th><th/></tr></thead><tbody>{compared.map(p=><tr key={p.productCode}><td>{p.brand} {p.productName}</td><td>{p.finishOptions.join(', ')}</td><td>{p.lockingType}</td><td>{p.selectedCost??'Rate required'}</td><td><button type="button" onClick={()=>compare(p)}>Remove from comparison</button></td></tr>)}</tbody></table></section>:null}
    {product?<div role="dialog" aria-modal="true" aria-label="Door furniture options" data-testid="door-furniture-options" style={{position:'fixed',inset:0,zIndex:10000,background:'#0009',display:'grid',placeItems:'center',padding:24}}>
      <section style={{background:'white',color:'#172033',padding:24,borderRadius:16,width:'min(640px,100%)',maxHeight:'90vh',overflow:'auto',display:'grid',gap:14}}>
        <h2>{product.productName}</h2><img src={product.imageUrl} alt={product.productName} style={{height:130,width:'100%',objectFit:'contain'}}/>
        <label>Entry door <select aria-label="Associated entry door" value={doorId} onChange={e=>{setDoorId(e.target.value);setQuantity(doors.find(d=>d.id===e.target.value)?.quantity||1);}}>{doors.map(d=><option key={d.id} value={d.id}>{d.doorReference} / {d.level} / {d.location}</option>)}</select></label>
        <label><input type="checkbox" checked={all} onChange={e=>setAll(e.target.checked)}/> Apply to all {doors.length} applicable entry doors</label>
        {product.finishOptions.length?<label>Finish <select aria-label="Hardware finish" value={finish} onChange={e=>setFinish(e.target.value)}>{product.finishOptions.map(f=><option key={f}>{f}</option>)}</select></label>:<p>Finish not specified by manufacturer.</p>}
        {product.sizeOptions.length?<label>Size <select aria-label="Hardware size" value={size} onChange={e=>setSize(e.target.value)}>{product.sizeOptions.map(f=><option key={f}>{f}</option>)}</select></label>:null}
        {product.lockOptions.length?<label>Lock/function type <select aria-label="Hardware lock type" value={lockType} onChange={e=>setLockType(e.target.value)}>{product.lockOptions.map(f=><option key={f}>{f}</option>)}</select></label>:null}
        <label>Quantity {all?'per door':''} <input aria-label="Hardware quantity" type="number" min="1" step="1" value={quantity} onChange={e=>setQuantity(e.target.value)}/></label>
        <p>{product.selectedCost==null?'Rate required':`Unit rate $${product.selectedCost} · Total allowance $${product.selectedCost*Number(quantity)*(all?doors.length:1)}`}</p>
        {error?<p role="alert">{error}</p>:null}
        <button type="button" disabled={busy||!doors.length} onClick={()=>save()} style={{background:'#1764d9',color:'white',padding:14,border:0,borderRadius:8,fontWeight:700}}>{busy?'Saving…':'Confirm Selection'}</button>
        {selections.some(s=>s.door.id===doorId&&s.entryDoorFurniture)?<button type="button" disabled={busy} onClick={()=>save(true)}>Remove Selection</button>:null}
        <button type="button" disabled={busy} onClick={()=>setProduct(null)}>Cancel</button>
      </section>
    </div>:null}
  </>:null;
  return {enabled,panel,open,isSelected,returnToDoor,compare};
}
