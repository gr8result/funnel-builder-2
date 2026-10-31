import { useState } from 'react';
import { applyAssignmentToRooms, applyToRoomsPreview, assignedQuantity, assignmentRows, removeAssignment, updateAssignment } from '../../lib/builders/selectionAssignments.js';
import { plumbingLocationKey } from '../../lib/builders/plumbingFixtureAllocation.js';

// Current selections as an editable table: one row per product in one room. Products used in
// several rooms are grouped under one expandable row. Every change goes through
// selectionAssignments.js, so an edit changes the assignment that is there and never adds a record.
//   lines: allocation lines; rooms: [{ name, level }]; onChange(nextLines);
//   onReplace({ lineId, locationKey, location, productName }) - the host lets the builder pick the replacement product.
//   expected: quantity the quotation carries for this selection (null when it has none).
const money = n => n == null ? 'Supplier quote required' : new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(n);

export default function SelectionAssignmentsTable({lines=[], rooms=[], unitLabel='item', expected=null, replacing=null, onChange, onReplace, onCancelReplace}) {
  const [open,setOpen] = useState({});
  const [editing,setEditing] = useState(null);
  const [applying,setApplying] = useState(null);
  const [saving,setSaving] = useState(false);
  const [saveError,setSaveError] = useState('');
  const rows = assignmentRows(lines);
  const roomNames = rooms.map(r=>r.name);
  const levels = [...new Set(rooms.map(r=>r.level).filter(Boolean))];
  const total = assignedQuantity(lines);
  // Rooms holding more than one product, and quantities sitting against something that is not a room.
  const byRoom = new Map();
  rows.forEach(r=>byRoom.set(r.locationKey,[...(byRoom.get(r.locationKey) || []),r]));
  const roomKeys = new Set(roomNames.map(plumbingLocationKey));
  const shared = [...byRoom.values()].filter(list=>new Set(list.map(r=>r.lineId)).size>1);
  const notRooms = rows.filter(r=>roomKeys.size && !roomKeys.has(r.locationKey));
  const rowKey = r => `${r.lineId}::${r.locationKey}`;
  const isOpen = line => open[line.lineId] ?? true;

  async function saveLines(nextLines) {
    setSaveError('');
    setSaving(true);
    try {
      if (typeof onChange !== 'function') throw new Error('This change cannot be saved to the job.');
      const result = await onChange(nextLines);
      if (result === false || result?.ok === false) throw new Error(result?.message || 'This change could not be saved to the job.');
      return true;
    } catch (error) {
      setSaveError(error?.message || 'This change could not be saved to the job.');
      return false;
    } finally {
      setSaving(false);
    }
  }
  async function saveEdit() {
    const quantity = Math.max(0,Math.floor(Number(editing.quantity) || 0));
    if (await saveLines(updateAssignment(lines,editing.lineId,editing.locationKey,{quantity,...(editing.location!==editing.from ? {location:editing.location} : {})}))) setEditing(null);
  }
  async function remove(r) {
    if (typeof window !== 'undefined' && !window.confirm(`Remove ${r.productName} from ${r.location}? Other rooms are not changed.`)) return;
    await saveLines(removeAssignment(lines,r.lineId,r.locationKey));
  }
  const preview = applying ? applyToRoomsPreview(lines,applying.lineId,applying.rooms.map(name=>({name}))) : [];
  const toggleRoom = name => setApplying(a=>({...a,rooms:a.rooms.includes(name) ? a.rooms.filter(n=>n!==name) : [...a.rooms,name]}));
  async function apply() {
    const result = applyAssignmentToRooms(lines,applying.lineId,applying.rooms.map(name=>({name})),{quantityEach:Math.max(1,Math.floor(Number(applying.quantityEach) || 1)),replaceOccupied:applying.replaceOccupied});
    if (await saveLines(result.lines)) setApplying(null);
  }

  return <section className="assignments" aria-label="Current selections" data-testid="selection-assignments">
    <h3>Current selections</h3>
    {saving ? <p role="status" data-testid="assignment-saving">Saving room assignments…</p> : null}
    {saveError ? <p role="alert" data-testid="assignment-save-error">{saveError}</p> : null}
    <p className="reconcile" data-testid="assignment-reconciliation">
      <strong>{total}</strong> {unitLabel}{total===1?'':'s'} assigned across <strong>{byRoom.size}</strong> location{byRoom.size===1?'':'s'}
      {expected!=null ? <> · quotation carries <strong>{expected}</strong>{expected===total ? ' — matches' : ` — ${total>expected ? `${total-expected} more than` : `${expected-total} fewer than`} the quotation`}</> : null}
    </p>
    {shared.length>0 && <p className="warn" data-testid="assignment-shared-rooms">More than one product in the same room: {shared.map(list=>`${list[0].location} (${list.map(r=>`${r.productName} ×${r.quantity}`).join(' + ')})`).join('; ')}. Keep both only if both are required — otherwise replace or remove one.</p>}
    {notRooms.length>0 && <p className="warn" data-testid="assignment-not-rooms">Not allocated to a project room: {notRooms.map(r=>`${r.productName} ×${r.quantity} in “${r.location}”`).join('; ')}. Edit each one to its room so none is counted twice.</p>}
    {replacing && <p className="notice" data-testid="assignment-replacing">Replacing <strong>{replacing.productName}</strong> in <strong>{replacing.location}</strong>. Choose the replacement product below — the quantity stays the same. <button type="button" onClick={onCancelReplace}>Cancel replace</button></p>}
    <table><thead><tr><th>Product</th><th>Finish</th><th>Room / location</th><th>Qty</th><th>Unit price</th><th>Variation</th><th>Actions</th></tr></thead>
      <tbody>{lines.filter(l=>rows.some(r=>r.lineId===l.lineId)).flatMap(l=>{
        const mine = rows.filter(r=>r.lineId===l.lineId);
        const group = mine.length>1 ? [<tr key={l.lineId} className="group" data-testid="assignment-group">
          <td colSpan={3}><button type="button" className="toggle" aria-expanded={isOpen(l)} onClick={()=>setOpen({...open,[l.lineId]:!isOpen(l)})}>{isOpen(l)?'▾':'▸'} {l.productName}{l.isBuilderStandard?' · STANDARD':''}</button> <span>{mine.length} locations</span></td>
          <td>{l.quantity}</td><td>{money(l.unitPrice)}</td><td>{l.allowancePending?'Builder allowance required':money(l.variation)}</td><td/></tr>] : [];
        if (mine.length>1 && !isOpen(l)) return group;
        return [...group,...mine.map(r=>{
          const edit = editing && rowKey(editing)===rowKey(r) ? editing : null;
          const names = roomNames.includes(r.location) ? roomNames : [r.location,...roomNames];
          return <tr key={rowKey(r)} data-testid="assignment-row" data-location={r.locationKey} className={mine.length>1?'child':''}>
            <td>{mine.length>1 ? '' : <>{r.productName}{r.standard?' · STANDARD':''}</>}{r.additional ? <em> Additional</em> : null}</td>
            <td>{r.finish || '—'}</td>
            <td>{edit ? <select aria-label="Room" value={edit.location} onChange={e=>setEditing({...edit,location:e.target.value})}>{names.map(n=><option key={n}>{n}</option>)}</select> : r.location}</td>
            <td>{edit ? <input aria-label="Quantity" type="number" min="0" value={edit.quantity} onChange={e=>setEditing({...edit,quantity:e.target.value})}/> : r.quantity}</td>
            <td>{money(r.unitPrice)}</td>
            <td>{l.allowancePending ? 'Builder allowance required' : r.variationEach==null ? '—' : money(r.variationEach*r.quantity)}</td>
            <td className="actions">{edit ? <><button type="button" className="solid" onClick={saveEdit}>Save</button><button type="button" onClick={()=>setEditing(null)}>Cancel</button></> : <>
              <button type="button" data-action="edit" onClick={()=>setEditing({lineId:r.lineId,locationKey:r.locationKey,location:r.location,from:r.location,quantity:r.quantity})}>Edit</button>
              {onReplace && <button type="button" data-action="replace" onClick={()=>onReplace(r)}>Replace</button>}
              <button type="button" data-action="remove" onClick={()=>remove(r)}>Remove</button>
              {roomNames.length>0 && <button type="button" data-action="apply" onClick={()=>setApplying({lineId:r.lineId,productName:r.productName,rooms:[],quantityEach:r.quantity,replaceOccupied:false})}>Apply to other rooms</button>}
            </>}</td>
          </tr>;
        })];
      })}</tbody></table>
    {applying && <div className="overlay" role="dialog" aria-modal="true" aria-label="Apply to other rooms" data-testid="apply-to-rooms"><div className="dialog">
      <h3>Apply {applying.productName} to other rooms</h3>
      <p>Each room gets its own assignment, so it can be changed later without affecting the others.</p>
      <p className="pick"><button type="button" onClick={()=>setApplying({...applying,rooms:roomNames})}>Select all</button>
        {levels.map(level=><button type="button" key={level} onClick={()=>setApplying({...applying,rooms:[...new Set([...applying.rooms,...rooms.filter(r=>r.level===level).map(r=>r.name)])]})}>All {level}</button>)}
        <button type="button" onClick={()=>setApplying({...applying,rooms:[]})}>Clear</button></p>
      <div className="roomGrid">{rooms.map(r=><label key={r.name}><input type="checkbox" checked={applying.rooms.includes(r.name)} onChange={()=>toggleRoom(r.name)}/> {r.name}{r.level ? <small> · {r.level}</small> : null}</label>)}</div>
      <label className="each">Quantity in each room<input type="number" min="1" value={applying.quantityEach} onChange={e=>setApplying({...applying,quantityEach:e.target.value})}/></label>
      {preview.length>0 && <><h4>What will change</h4><ul data-testid="apply-preview">{preview.map(p=><li key={p.room} data-state={p.state}><strong>{p.room}</strong> — {p.state==='add' ? `add ×${Math.max(1,Math.floor(Number(applying.quantityEach) || 1))}` : p.state==='already' ? 'already has this product (no change)' : `has ${p.existing.map(e=>`${e.productName} ×${e.quantity}`).join(', ')} — ${applying.replaceOccupied ? 'will be replaced, same quantity' : 'left as it is'}`}</li>)}</ul></>}
      {preview.some(p=>p.state==='occupied') && <label className="check"><input type="checkbox" checked={applying.replaceOccupied} onChange={e=>setApplying({...applying,replaceOccupied:e.target.checked})}/> Replace the product already in those rooms</label>}
      <p><button type="button" disabled={saving} onClick={()=>setApplying(null)}>Cancel</button> <button type="button" className="solid" disabled={saving || !preview.some(p=>p.state==='add' || (p.state==='occupied' && applying.replaceOccupied))} onClick={apply}>{saving ? 'Saving…' : 'Apply to selected rooms'}</button></p>
    </div></div>}
    <style jsx>{`
      .assignments{font-size:16px;color:#102b42;margin:20px 0}.assignments h3{font-size:18px}.assignments h4{font-size:17px;margin:16px 0 6px}.assignments p,.assignments li,.assignments label,.assignments span,.assignments small,.assignments em{font-size:16px;line-height:1.5}
      .assignments table{width:100%;border-collapse:collapse}.assignments th,.assignments td{padding:10px 12px;text-align:left;border-bottom:1px solid #d4e0ea;font-size:16px;vertical-align:middle}
      .group td{background:#f1f6fa;font-weight:700}.group span{font-weight:400;color:#4a6274;margin-left:8px}.child td:first-child{padding-left:32px}.assignments em{color:#9a5b00;font-style:normal;font-weight:700}
      .assignments button{padding:8px 12px;border:1px solid #0f766e;color:#0f766e;background:#fff;border-radius:6px;font-size:16px;cursor:pointer}.assignments button.solid{background:#0f766e;color:#fff}.assignments button:disabled{opacity:.5;cursor:default}
      .assignments button.toggle{border:0;background:none;color:#102b42;font-weight:700;padding:0}.actions{display:flex;flex-wrap:wrap;gap:6px}
      .assignments select,.assignments input[type=number]{padding:8px;border:1px solid #bdcdd8;border-radius:6px;font-size:16px;max-width:220px}.assignments input[type=number]{width:90px}.assignments input[type=checkbox]{width:20px;height:20px;vertical-align:middle}
      .warn{padding:12px 14px;background:#fff7e6;border:1px solid #f0c36d;border-radius:8px}.notice{padding:12px 14px;background:#ecfdf5;border:1px solid #0f766e;border-radius:8px}.reconcile{margin:6px 0 12px}
      .overlay{position:fixed;inset:0;background:#102b4280;z-index:12000;display:grid;place-items:center;padding:24px}.dialog{background:#fff;border-radius:12px;padding:24px;max-width:760px;max-height:90vh;overflow:auto;width:100%}
      .pick{display:flex;flex-wrap:wrap;gap:8px}.roomGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px;margin:12px 0}.each{display:grid;gap:6px;margin:12px 0}.check{display:block;margin:12px 0}.assignments small{color:#4a6274}
      @media(max-width:800px){.assignments table{display:block;overflow-x:auto}}
    `}</style>
  </section>;
}
