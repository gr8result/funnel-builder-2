import React from 'react';
export default function EntryDoorLocations({door,doors,onChange,onAdd,onApplyAll}) {
  return <section data-testid="manual-entry-door-controls" style={{padding:16,border:'1px solid #b9cce2',borderRadius:10,background:'#f4f8fc',display:'grid',gap:12}}>
    <strong>Entry door location</strong><p>Takeoff import is optional. Add doors manually, or use imported locations when available.</p>
    <label>Door location/name <input aria-label="Door location/name" value={door.location||''} onChange={e=>onChange({...door,location:e.target.value,doorReference:e.target.value||'Entry Door'})}/></label>
    <label>Level/storey <input aria-label="Door level/storey" value={door.level||''} onChange={e=>onChange({...door,level:e.target.value})}/></label>
    <label>Door quantity <input aria-label="Door quantity" type="number" min="1" value={door.quantity} onChange={e=>onChange({...door,quantity:Math.max(1,Number(e.target.value)||1)})}/></label>
    <div><button type="button" onClick={onAdd}>Add Entry Door</button> {onApplyAll?<button type="button" onClick={onApplyAll}>Use selected door for all entry doors</button>:null}</div>
    {doors.some(d=>d.source==='manual')&&doors.some(d=>d.source==='takeoff_schedule')?<p>Manual selections are retained. Unmatched imported doors are separate locations; choosing hardware for them does not replace existing choices.</p>:null}
  </section>;
}
